// © 2026 bladept696 — Centro de Comando / Hash Commander. Todos os direitos reservados.
// é proibido copiar, modificar, redistribuir ou publicar este ficheiro, no todo ou em parte, sem autorização escrita do autor.
// https://github.com/bladept696/centro-de-comando-v3
//
// Ecrã físico da Hash Commander para a LilyGO T-Display-S3 (ESP32-S3, ST7789 320x170).
// - Lê o resumo das máquinas em <url da dashboard>/screen/data?k=<chave> de 5 em 5 s (tarefa no núcleo 0).
//   Se a dashboard não responder (PC desligado ou app fechada), lê cada máquina diretamente na rede
//   (API AxeOS /api/system/info das Bitaxe/NerdQAxe), com a lista de IPs que a dashboard lhe passou.
// - Desenha a 30 fps no núcleo 1 numa imagem escondida (sprite na PSRAM): céu com brilho, chão em grelha a andar,
//   moeda Bitcoin 3D a rodar, hashrate grande, fita 3D do histórico e uma coluna 3D por máquina; num recorde de
//   share solta partículas douradas.
// - A configuração (Wi-Fi, endereço da dashboard e chave) chega pela USB, mandada pela própria dashboard:
//   uma linha JSON {"cmd":"cfg",...}; responde HC_OK, guarda e reinicia.
// - Botão de baixo (GPIO 0): muda de página. Botão de cima (GPIO 14): brilho.
#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Preferences.h>
#include <ArduinoJson.h>
#include <TFT_eSPI.h>

#define PIN_POWER_ON 15
#define PIN_BL 38
#define PIN_BTN_PAGE 0
#define PIN_BTN_LIGHT 14
#define W 320
#define H 170
#define HORIZON 96
#define MAX_M 12
#define MAX_HIST 60

static inline uint16_t rgb(uint8_t r, uint8_t g, uint8_t b) { return ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3); }
static const uint16_t C_BG = rgb(3, 7, 12), C_SKY = rgb(42, 18, 64), C_FLOOR = rgb(5, 3, 12), C_PINK = rgb(255, 60, 200);
static const uint16_t C_GREEN = rgb(33, 255, 176), C_GREEN_D = rgb(6, 70, 50), C_MUTED = rgb(127, 166, 179), C_TEXT = rgb(227, 241, 245);
static const uint16_t C_GOLD = rgb(255, 176, 32), C_YEL = rgb(255, 211, 74), C_CYAN = rgb(79, 214, 255), C_RED = rgb(255, 93, 93), C_DARK = rgb(26, 18, 0);

TFT_eSPI tft;
TFT_eSprite spr(&tft);
uint16_t *bgBuf = nullptr;
Preferences prefs;
String cfgSsid, cfgPass, cfgUrl, cfgKey;

struct Machine { char n[16]; float h; float t; bool o; };
struct Data {
  bool ok = false; float total = 0; int on = 0, n = 0; float temp = 0; double best = 0; long shares = 0;
  int rec = -1; double recVal = 0; float hist[MAX_HIST]; int histN = 0; Machine m[MAX_M]; uint32_t at = 0;
};
Data netData, view;
SemaphoreHandle_t mtx;
// 0 sem configuração · 1 a ligar ao Wi-Fi · 2 sem resposta de nada · 3 dados da dashboard · 4 máquinas lidas diretamente
volatile int netState = 0;
volatile uint32_t lastOkMs = 0;
// máquinas para o modo direto (nome e IP), guardadas no ecrã
struct MIp { char n[16]; char ip[40]; };
MIp mips[MAX_M]; int mipN = 0;
String mlistJson;
// histórico local do hashrate total (usado no modo direto)
float localHist[MAX_HIST]; int localHistN = 0; uint32_t localHistAt = 0;

// ---------------------------------------------------------------- cores
static uint16_t shade(uint16_t c, float k) {
  int r = ((c >> 11) & 31) * k, g = ((c >> 5) & 63) * k, b = (c & 31) * k;
  if (r > 31) r = 31; if (g > 63) g = 63; if (b > 31) b = 31;
  return (r << 11) | (g << 5) | b;
}
static uint16_t blend(uint16_t fg, uint16_t bg, float a) { if (a <= 0) return bg; if (a >= 1) return fg; return tft.alphaBlend((uint8_t)(a * 255), fg, bg); }
static uint16_t tempCol(float t) { return t >= 75 ? C_RED : t >= 65 ? C_GOLD : C_GREEN; }

static void fmtDiff(double v, char *out, size_t n) {
  const char *u = ""; if (v >= 1e15) { v /= 1e15; u = "P"; } else if (v >= 1e12) { v /= 1e12; u = "T"; } else if (v >= 1e9) { v /= 1e9; u = "G"; } else if (v >= 1e6) { v /= 1e6; u = "M"; } else if (v >= 1e3) { v /= 1e3; u = "K"; }
  if (v >= 100 || !*u) snprintf(out, n, "%.0f%s", v, u); else snprintf(out, n, "%.1f%s", v, u);
}
static void fmtCount(long v, char *out, size_t n) { if (v >= 1000000) snprintf(out, n, "%.1fM", v / 1e6); else if (v >= 10000) snprintf(out, n, "%.1fk", v / 1e3); else snprintf(out, n, "%ld", v); }

// ---------------------------------------------------------------- configuração pela USB
static void parseMachineList(const String &json) {
  JsonDocument d; mipN = 0;
  if (deserializeJson(d, json)) return;
  for (JsonObject o : d.as<JsonArray>()) {
    if (mipN >= MAX_M) break;
    const char *ip = o["ip"] | "";
    if (!*ip) continue;
    strlcpy(mips[mipN].n, o["n"] | ip, sizeof(mips[mipN].n)); strlcpy(mips[mipN].ip, ip, sizeof(mips[mipN].ip)); mipN++;
  }
}
static void saveMachineList(JsonVariantConst list) {
  String s; serializeJson(list, s);
  if (s == mlistJson || s.length() < 2) return;
  prefs.begin("hcscreen", false); prefs.putString("mlist", s); prefs.end();
  mlistJson = s; parseMachineList(s);
}
static void loadCfg() {
  prefs.begin("hcscreen", true);
  cfgSsid = prefs.getString("ssid", ""); cfgPass = prefs.getString("pass", "");
  cfgUrl = prefs.getString("url", ""); cfgKey = prefs.getString("key", "");
  mlistJson = prefs.getString("mlist", "");
  prefs.end();
  parseMachineList(mlistJson);
}
static void serialCfg() {
  static String line;
  while (Serial.available()) {
    char ch = Serial.read();
    if (ch == '\n' || ch == '\r') {
      if (line.length() > 2) {
        JsonDocument d;
        if (!deserializeJson(d, line) && String((const char *)(d["cmd"] | "")) == "cfg") {
          String ssid = d["ssid"] | "", pass = d["pass"] | "", url = d["url"] | "", key = d["key"] | "";
          if (ssid.length() && url.startsWith("http") && key.length() == 32) {
            prefs.begin("hcscreen", false);
            prefs.putString("ssid", ssid); prefs.putString("pass", pass); prefs.putString("url", url); prefs.putString("key", key);
            if (d["m"].is<JsonArray>()) { String ml; serializeJson(d["m"], ml); prefs.putString("mlist", ml); }
            prefs.end();
            Serial.println("HC_OK"); Serial.flush(); delay(300); ESP.restart();
          } else Serial.println("HC_ERR");
        } else if (line.indexOf("hello") >= 0) Serial.println("HC_SCREEN " HC_SCREEN_VERSION);
      }
      line = "";
    } else if (line.length() < 4000) line += ch;
  }
}

// ---------------------------------------------------------------- rede (núcleo 0)
static bool fetchOnce() {
  String url = cfgUrl + "/screen/data?k=" + cfgKey;
  HTTPClient http; WiFiClient plain; WiFiClientSecure tls;
  bool https = cfgUrl.startsWith("https");
  if (https) { tls.setInsecure(); if (!http.begin(tls, url)) return false; }   // certificado autoassinado da própria dashboard
  else if (!http.begin(plain, url)) return false;
  http.setConnectTimeout(3000); http.setTimeout(5000);
  int code = http.GET();
  if (code != 200) { http.end(); return false; }
  String body = http.getString(); http.end();
  JsonDocument d;
  if (deserializeJson(d, body)) return false;
  Data t;
  t.ok = true; t.total = d["total"] | 0.0f; t.on = d["on"] | 0; t.n = d["n"] | 0; t.temp = d["temp"] | 0.0f;
  t.best = d["best"] | 0.0; t.shares = d["shares"] | 0L; t.rec = d["rec"] | 0; t.recVal = d["rec_val"] | 0.0;
  JsonArray hs = d["hist"].as<JsonArray>(); t.histN = 0;
  for (JsonVariant v : hs) { if (t.histN >= MAX_HIST) break; t.hist[t.histN++] = v.as<float>(); }
  JsonArray ms = d["m"].as<JsonArray>(); int i = 0;
  for (JsonObject o : ms) {
    if (i >= MAX_M) break;
    strlcpy(t.m[i].n, o["n"] | "?", sizeof(t.m[i].n)); t.m[i].h = o["h"] | 0.0f; t.m[i].t = o["t"] | 0.0f; t.m[i].o = (o["o"] | 0) == 1; i++;
  }
  t.n = i; t.at = millis();
  if (d["ips"].is<JsonArray>()) saveMachineList(d["ips"]);   // a lista para o modo direto fica sempre atualizada
  xSemaphoreTake(mtx, portMAX_DELAY); netData = t; xSemaphoreGive(mtx);
  return true;
}

// dificuldade que pode vir como número (87393975622) ou texto ("87.4G")
static double parseDiff(JsonVariantConst v) {
  if (v.is<double>() || v.is<long long>()) return v.as<double>();
  const char *s = v.as<const char *>(); if (!s || !*s) return 0;
  char *end; double x = strtod(s, &end);
  switch (toupper(*end)) { case 'K': x *= 1e3; break; case 'M': x *= 1e6; break; case 'G': x *= 1e9; break; case 'T': x *= 1e12; break; case 'P': x *= 1e15; break; }
  return x;
}
static void pushLocalHist(float total) {
  if (localHistN && millis() - localHistAt < 15000) return;
  if (localHistN >= MAX_HIST) { memmove(localHist, localHist + 1, (MAX_HIST - 1) * sizeof(float)); localHistN--; }
  localHist[localHistN++] = total; localHistAt = millis();
}
// modo direto: lê cada máquina pela API AxeOS, sem passar pelo PC
static bool fetchDirect() {
  JsonDocument filter;
  filter["hashRate"] = true; filter["temp"] = true; filter["bestDiff"] = true; filter["bestSessionDiff"] = true; filter["sharesAccepted"] = true;
  Data t; t.ok = true; int on = 0;
  for (int i = 0; i < mipN; i++) {
    Machine &m = t.m[i]; strlcpy(m.n, mips[i].n, sizeof(m.n)); m.h = 0; m.t = 0; m.o = false;
    HTTPClient http; WiFiClient c;
    if (!http.begin(c, String("http://") + mips[i].ip + "/api/system/info")) continue;
    http.setConnectTimeout(2000); http.setTimeout(3000);
    if (http.GET() == 200) {
      JsonDocument d;
      String body = http.getString();   // getString junta as respostas "chunked"; o fluxo cru não
      if (!deserializeJson(d, body, DeserializationOption::Filter(filter))) {
        m.h = (d["hashRate"] | 0.0f) / 1000.0f; m.t = d["temp"] | 0.0f; m.o = true; on++;
        t.total += m.h; if (m.t > t.temp) t.temp = m.t;
        t.best = max(t.best, max(parseDiff(d["bestDiff"]), parseDiff(d["bestSessionDiff"])));
        t.shares += d["sharesAccepted"] | 0L;
      }
    }
    http.end();
  }
  t.n = mipN; t.on = on;
  if (!on) return false;
  pushLocalHist(t.total);
  t.histN = localHistN; memcpy(t.hist, localHist, localHistN * sizeof(float));
  t.at = millis();
  xSemaphoreTake(mtx, portMAX_DELAY); netData = t; xSemaphoreGive(mtx);
  return true;
}
static void netTask(void *) {
  uint32_t lastDashTry = 0;
  for (;;) {
    if (!cfgSsid.length()) { netState = 0; vTaskDelay(1000); continue; }
    if (WiFi.status() != WL_CONNECTED) {
      netState = 1;
      WiFi.mode(WIFI_STA); WiFi.setAutoReconnect(true); WiFi.begin(cfgSsid.c_str(), cfgPass.c_str());
      for (int i = 0; i < 40 && WiFi.status() != WL_CONNECTED; i++) vTaskDelay(250);
      if (WiFi.status() != WL_CONNECTED) { WiFi.disconnect(); vTaskDelay(3000); continue; }
    }
    // a dashboard tem prioridade; em modo direto só se volta a tentar de 30 em 30 s (não atrasa as leituras)
    bool dashOk = false;
    if (cfgUrl.length() && (netState != 4 || millis() - lastDashTry > 30000)) {
      lastDashTry = millis();
      dashOk = fetchOnce();
    }
    if (dashOk) { netState = 3; lastOkMs = millis(); xSemaphoreTake(mtx, portMAX_DELAY); float tot = netData.total; xSemaphoreGive(mtx); pushLocalHist(tot); }
    else if (mipN && fetchDirect()) { netState = 4; lastOkMs = millis(); }
    else if (millis() - lastOkMs > 20000) netState = 2;
    vTaskDelay(5000);
  }
}

// ---------------------------------------------------------------- fundo fixo (desenhado uma vez)
static void buildBackground() {
  for (int y = 0; y < H; y++) {
    uint16_t base = y < HORIZON ? blend(C_SKY, C_BG, (float)y / HORIZON) : C_FLOOR;
    for (int x = 0; x < W; x++) {
      uint16_t c = base;
      if (y < HORIZON + 8) {   // brilho laranja no horizonte
        float dx = x - W * 0.3f, dy = (y - HORIZON) * 1.6f, dd = sqrtf(dx * dx + dy * dy) / 120.0f;
        if (dd < 1) c = blend(rgb(255, 140, 40), c, (1 - dd) * (1 - dd) * 0.45f);
      }
      float cx = x - 52, cy = y - 58, cd = sqrtf(cx * cx + cy * cy) / 46.0f;   // brilho dourado atrás da moeda
      if (cd < 1) c = blend(C_GOLD, c, (1 - cd) * (1 - cd) * 0.30f);
      spr.drawPixel(x, y, c);
    }
  }
  memcpy(bgBuf, spr.getPointer(), W * H * 2);
}

// ---------------------------------------------------------------- moeda 3D
struct P3 { float x, y, z; bool b; };
P3 coinPts[200]; int coinN = 0;
static void buildCoin() {
  for (int i = 0; i < 48; i++) { float a = i / 48.0f * TWO_PI; coinPts[coinN++] = {cosf(a), sinf(a), 0.12f, false}; coinPts[coinN++] = {cosf(a), sinf(a), -0.12f, false}; }
  const char *B[7] = {"01110", "01001", "01001", "01110", "01001", "01001", "01110"};
  for (int ry = 0; ry < 7; ry++) for (int rx = 0; rx < 5; rx++) if (B[ry][rx] == '1') {
    coinPts[coinN++] = {(rx - 2) * 0.2f, (ry - 3) * 0.2f, 0.13f, true}; coinPts[coinN++] = {(rx - 2) * 0.2f, (ry - 3) * 0.2f, -0.13f, true};
  }
  const float tick[8][2] = {{-.1f, -.85f}, {-.1f, -.65f}, {.15f, -.85f}, {.15f, -.65f}, {-.1f, .65f}, {-.1f, .85f}, {.15f, .65f}, {.15f, .85f}};
  for (auto &p : tick) coinPts[coinN++] = {p[0], p[1], 0.13f, true};
}
static void drawCoin(float t) {
  const float cx = 52, cy = 58, R = 30, ay = t * 1.6f, ax = sinf(t * 0.7f) * 0.35f;
  for (int pass = 0; pass < 2; pass++) for (int i = 0; i < coinN; i++) {
    const P3 &p = coinPts[i];
    float X = p.x * cosf(ay) + p.z * sinf(ay), Z = -p.x * sinf(ay) + p.z * cosf(ay);
    float Y = p.y * cosf(ax) - Z * sinf(ax); Z = p.y * sinf(ax) + Z * cosf(ax);
    if ((pass == 0) != (Z > 0)) continue;   // primeiro os pontos de trás
    float s = 2.6f / (2.6f + Z), l = 0.55f + (1 - Z) * 0.45f;
    uint16_t c = p.b ? shade(rgb(255, 241, 176), l) : shade(C_GOLD, l);
    spr.fillRect((int)(cx + X * R * s) - 1, (int)(cy + Y * R * s) - 1, p.b ? 3 : 2, p.b ? 3 : 2, c);
  }
}

// ---------------------------------------------------------------- partículas do recorde
struct Part { float x, y, vx, vy, l; };
Part parts[70]; int partN = 0; float burstAt = -100; char burstTxt[24] = "";
static void burst(double val) {
  partN = 0;
  for (int i = 0; i < 70; i++) { float a = random(0, 6283) / 1000.0f, v = 20 + random(0, 70); parts[partN++] = {52, 58, cosf(a) * v, sinf(a) * v - 20, 1}; }
  char d[12]; fmtDiff(val, d, sizeof d); snprintf(burstTxt, sizeof burstTxt, "RECORDE %s", d);
}

// ---------------------------------------------------------------- páginas
int page = 0;
float shownTotal = 0;
static void drawGrid(float t) {
  for (int i = 0; i < 14; i++) {
    float z = (i + fmodf(t * 1.6f, 1.0f)) / 14.0f; int y = HORIZON + (int)(powf(z, 2.2f) * (H - HORIZON));
    spr.drawFastHLine(0, y, W, blend(C_PINK, C_FLOOR, (0.25f + z * 0.75f) * 0.55f));
  }
  uint16_t lc = blend(C_PINK, C_FLOOR, 0.33f);
  for (int i = -12; i <= 12; i++) spr.drawLine(W * 0.3f + i * 6, HORIZON, W * 0.3f + i * 70, H, lc);
}
static void drawHeader(const Data &d) {
  spr.setTextFont(2); spr.setTextColor(C_MUTED); spr.setTextDatum(TL_DATUM); spr.drawString("HASH COMMANDER", 104, 2);
  char s[16]; snprintf(s, sizeof s, "%d/%d", d.on, d.n);
  spr.setTextDatum(TR_DATUM); spr.setTextColor(d.on == d.n && d.n ? C_GREEN : C_GOLD); spr.drawString(s, 316, 2);
  spr.fillCircle(316 - spr.textWidth(s) - 7, 10, 3, d.on == d.n && d.n ? C_GREEN : C_GOLD);
}
// aviso numa faixa fina em cima (tapa só o título, nunca o hashrate)
static void drawStrip(const char *txt, uint16_t col) {
  spr.fillRect(96, 0, W - 96, 17, blend(col, C_BG, 0.22f));
  spr.drawFastHLine(96, 17, W - 96, col);
  spr.setTextFont(2); spr.setTextDatum(TC_DATUM); spr.setTextColor(col); spr.drawString(txt, 96 + (W - 96) / 2, 1);
  spr.setTextDatum(TL_DATUM);
}
static void pageMain(float t, const Data &d) {
  drawGrid(t);
  drawCoin(t);
  drawHeader(d);
  // hashrate (dígitos de 7 segmentos) com brilho
  shownTotal += (d.total - shownTotal) * 0.08f;
  char s[16]; snprintf(s, sizeof s, shownTotal >= 100 ? "%.0f" : shownTotal >= 10 ? "%.1f" : "%.2f", shownTotal);
  spr.setTextFont(7); spr.setTextDatum(TL_DATUM);
  spr.setTextColor(C_GREEN_D); spr.drawString(s, 103, 23); spr.drawString(s, 101, 21);
  spr.setTextColor(C_GREEN); int tw = spr.drawString(s, 102, 22);
  spr.setTextFont(2); spr.setTextColor(C_MUTED); spr.drawString("TH/s", 108 + tw, 52);
  // fita 3D do histórico
  int n = d.histN;
  if (n >= 2) {
    float lo = d.hist[0], hi = d.hist[0];
    for (int i = 1; i < n; i++) { lo = min(lo, d.hist[i]); hi = max(hi, d.hist[i]); }
    float span = (hi - lo) > 0.0001f ? hi - lo : 1;
    const int gx = 104, gy = 84, gw = 210, gh = 14;
    int px[MAX_HIST], py[MAX_HIST];
    for (int i = 0; i < n; i++) { px[i] = gx + i * gw / (n - 1); py[i] = gy - (int)((d.hist[i] - lo) / span * gh); }
    uint16_t side = blend(C_GREEN, C_BG, 0.18f);
    for (int i = 0; i < n - 1; i++) {
      spr.fillTriangle(px[i], py[i], px[i + 1], py[i + 1], px[i + 1] + 5, py[i + 1] + 5, side);
      spr.fillTriangle(px[i], py[i], px[i] + 5, py[i] + 5, px[i + 1] + 5, py[i + 1] + 5, side);
    }
    for (int i = 0; i < n - 1; i++) { spr.drawLine(px[i], py[i], px[i + 1], py[i + 1], C_GREEN); spr.drawLine(px[i], py[i] + 1, px[i + 1], py[i + 1] + 1, C_GREEN); }
    spr.fillCircle(px[n - 1], py[n - 1], 2 + (sinf(t * 6) > 0 ? 1 : 0), TFT_WHITE);
  }
  // colunas 3D por máquina (no máximo 6, as de mais hashrate)
  int idx[MAX_M], k = 0;
  for (int i = 0; i < d.n; i++) idx[k++] = i;
  for (int a = 0; a < k; a++) for (int b = a + 1; b < k; b++) if (d.m[idx[b]].h > d.m[idx[a]].h) { int x = idx[a]; idx[a] = idx[b]; idx[b] = x; }
  if (k > 6) k = 6;
  float maxH = 0.001f; for (int i = 0; i < k; i++) maxH = max(maxH, d.m[idx[i]].h);
  int step = k ? 200 / k : 200, bw = min(26, (int)(step * 0.45f));
  for (int j = 0; j < k; j++) {
    const Machine &m = d.m[idx[j]];
    int bx = 112 + j * step + (step - bw) / 2 - 6, by = 152, dx = 10, dy = 6;
    float grow = constrain((t - j * 0.25f) / 1.2f, 0, 1), e = 1 - powf(1 - grow, 3);
    int hh = m.o ? (int)((8 + m.h / maxH * 44) * e * (1 + sinf(t * 2 + j) * 0.03f)) : 4;
    uint16_t col = m.o ? tempCol(m.t) : rgb(90, 100, 110);
    spr.fillRect(bx, by - hh, bw, hh, shade(col, 0.55f));
    spr.fillTriangle(bx + bw, by - hh, bx + bw + dx, by - hh - dy, bx + bw + dx, by - dy, shade(col, 0.35f));
    spr.fillTriangle(bx + bw, by - hh, bx + bw + dx, by - dy, bx + bw, by, shade(col, 0.35f));
    spr.fillTriangle(bx, by - hh, bx + dx, by - hh - dy, bx + bw + dx, by - hh - dy, shade(col, 1.05f));
    spr.fillTriangle(bx, by - hh, bx + bw + dx, by - hh - dy, bx + bw, by - hh, shade(col, 1.05f));
    char v[10]; if (m.o) snprintf(v, sizeof v, "%.2f", m.h); else strcpy(v, "OFF");
    spr.setTextFont(1); spr.setTextDatum(BL_DATUM); spr.setTextColor(m.o ? C_TEXT : C_RED); spr.drawString(v, bx, by - hh - dy - 2);
    char nm[10]; strlcpy(nm, m.n, min((int)sizeof nm, max(2, step / 6 + 1))); spr.setTextColor(C_MUTED); spr.setTextDatum(TL_DATUM); spr.drawString(nm, bx - 2, by + 6);
  }
  // dados à esquerda
  char b1[12], b2[12], b3[12];
  snprintf(b1, sizeof b1, "%.0fC", d.temp); fmtDiff(d.best, b2, sizeof b2); fmtCount(d.shares, b3, sizeof b3);
  spr.setTextDatum(TL_DATUM);
  spr.setTextFont(1); spr.setTextColor(C_MUTED); spr.drawString("TEMP", 6, 108); spr.drawString("MELHOR", 6, 130); spr.drawString("SHARES", 6, 152);
  spr.setTextFont(2); spr.setTextColor(d.temp ? tempCol(d.temp) : C_MUTED); spr.drawString(b1, 50, 104);
  spr.setTextColor(C_GOLD); spr.drawString(b2, 50, 126); spr.setTextColor(C_TEXT); spr.drawString(b3, 50, 148);
}
static void pageList(float t, const Data &d) {
  drawGrid(t);
  spr.setTextFont(2); spr.setTextDatum(TL_DATUM); spr.setTextColor(C_MUTED); spr.drawString("MAQUINAS", 8, 4);
  int rows = min(d.n, 7), off = d.n > 7 ? ((int)(t / 3) % (d.n - 6)) : 0;
  for (int r = 0; r < rows; r++) {
    const Machine &m = d.m[r + off]; int y = 26 + r * 20;
    spr.fillRoundRect(6, y, 308, 18, 4, blend(C_BG, C_FLOOR, 0.5f));
    spr.fillCircle(16, y + 9, 4, m.o ? C_GREEN : C_RED);
    spr.setTextColor(C_TEXT); spr.drawString(m.n, 26, y + 1);
    char v[24]; if (m.o) snprintf(v, sizeof v, "%.2f TH/s", m.h); else strcpy(v, "offline");
    spr.setTextDatum(TR_DATUM); spr.setTextColor(m.o ? C_CYAN : C_RED); spr.drawString(v, 250, y + 1);
    if (m.o) { char tt[8]; snprintf(tt, sizeof tt, "%.0fC", m.t); spr.setTextColor(tempCol(m.t)); spr.drawString(tt, 308, y + 1); }
    spr.setTextDatum(TL_DATUM);
  }
}
static void pageInfo(float t, const Data &d) {
  drawGrid(t); drawCoin(t);
  spr.setTextFont(2); spr.setTextDatum(TL_DATUM);
  char s[64]; int y = 8;
  auto row = [&](const char *k, const char *v, uint16_t c) { spr.setTextColor(C_MUTED); spr.drawString(k, 104, y); spr.setTextColor(c); spr.drawString(v, 170, y); y += 19; };
  row("WI-FI", WiFi.status() == WL_CONNECTED ? cfgSsid.c_str() : "desligado", WiFi.status() == WL_CONNECTED ? C_GREEN : C_RED);
  snprintf(s, sizeof s, "%d dBm", WiFi.RSSI()); row("SINAL", WiFi.status() == WL_CONNECTED ? s : "-", C_TEXT);
  row("IP", WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString().c_str() : "-", C_TEXT);
  String u = cfgUrl; u.replace("http://", ""); u.replace("https://", ""); row("PAINEL", u.length() ? u.c_str() : "-", netState == 3 ? C_CYAN : C_RED);
  row("DADOS", netState == 3 ? "da dashboard" : netState == 4 ? "direto das maquinas" : "-", netState == 3 ? C_GREEN : netState == 4 ? C_GOLD : C_RED);
  if (d.ok) snprintf(s, sizeof s, "ha %lus", (unsigned long)((millis() - d.at) / 1000)); else strcpy(s, "-");
  row("LEITURA", s, d.ok ? C_TEXT : C_RED);
  row("VERSAO", HC_SCREEN_VERSION, C_MUTED);
}

// ---------------------------------------------------------------- botões e brilho
const uint8_t LIGHT[] = {255, 140, 50, 12};
int lightIdx = 0;
static void setLight() { ledcWrite(0, LIGHT[lightIdx]); }
static bool pressed(int pin, bool &prev) { bool now = digitalRead(pin) == LOW, r = now && !prev; prev = now; return r; }

void setup() {
  pinMode(PIN_POWER_ON, OUTPUT); digitalWrite(PIN_POWER_ON, HIGH);   // necessário quando funciona a bateria
  pinMode(PIN_BTN_PAGE, INPUT_PULLUP); pinMode(PIN_BTN_LIGHT, INPUT_PULLUP);
  Serial.begin(115200);
  tft.init(); tft.setRotation(1); tft.fillScreen(TFT_BLACK);
  ledcSetup(0, 5000, 8); ledcAttachPin(PIN_BL, 0); setLight();
  spr.setColorDepth(16);
  if (!spr.createSprite(W, H)) { tft.setTextColor(TFT_RED); tft.drawString("Sem memoria para o ecra", 10, 10, 2); for (;;) delay(1000); }
  bgBuf = (uint16_t *)ps_malloc(W * H * 2);
  if (!bgBuf) bgBuf = (uint16_t *)malloc(W * H * 2);
  buildBackground(); buildCoin();
  loadCfg();
  mtx = xSemaphoreCreateMutex();
  xTaskCreatePinnedToCore(netTask, "net", 10240, nullptr, 1, nullptr, 0);
  Serial.println("HC_SCREEN " HC_SCREEN_VERSION);
}

void loop() {
  static uint32_t t0 = millis(), lastFrame = 0; static bool pb1 = false, pb2 = false; static double bestSeen = -1;
  serialCfg();
  if (pressed(PIN_BTN_PAGE, pb1)) page = (page + 1) % 3;
  if (pressed(PIN_BTN_LIGHT, pb2)) { lightIdx = (lightIdx + 1) % 4; setLight(); }
  uint32_t now = millis();
  if (now - lastFrame < 33) { delay(1); return; }
  lastFrame = now;
  float t = (now - t0) / 1000.0f;
  xSemaphoreTake(mtx, portMAX_DELAY); view = netData; xSemaphoreGive(mtx);

  // recorde novo (a melhor dificuldade subiu, venha da dashboard ou das máquinas): explosão.
  // A primeira leitura só serve de referência.
  if (view.ok && view.best > 0) {
    if (bestSeen > 0 && view.best > bestSeen * 1.0001) { burst(view.best); burstAt = t; }
    if (view.best > bestSeen) bestSeen = view.best;
  }

  memcpy(spr.getPointer(), bgBuf, W * H * 2);
  if (page == 0) pageMain(t, view); else if (page == 1) pageList(t, view); else pageInfo(t, view);

  if (partN) {
    int alive = 0;
    for (int i = 0; i < partN; i++) {
      Part &p = parts[i]; p.l -= 1 / 45.0f; if (p.l <= 0) continue; alive++;
      p.x += p.vx / 30; p.y += p.vy / 30; p.vy += 2;
      spr.fillRect((int)p.x, (int)p.y, 2, 2, p.l > 0.6f ? rgb(255, 246, 200) : C_GOLD);
    }
    if (!alive) partN = 0;
  }
  if (t - burstAt < 2.4f && page == 0) {
    spr.fillRoundRect(104, 66, 156, 17, 3, C_GOLD);
    spr.setTextFont(2); spr.setTextDatum(TL_DATUM); spr.setTextColor(C_DARK); spr.drawString(burstTxt, 112, 67);
  }
  if (page == 0) {
    if (netState == 0) drawStrip("Instalar pelo painel (USB)", C_YEL);
    else if (netState == 1) drawStrip("A ligar ao Wi-Fi...", C_YEL);
    else if (netState == 2) drawStrip(mipN ? "Maquinas sem resposta" : "Sem ligacao ao painel", C_RED);
    else if (netState == 4) {   // sem PC: lido diretamente das máquinas
      spr.fillRoundRect(4, 4, 50, 13, 3, blend(C_GOLD, C_BG, 0.25f));
      spr.setTextFont(1); spr.setTextDatum(TL_DATUM); spr.setTextColor(C_GOLD); spr.drawString("SEM PC", 11, 7);
    }
  }
  spr.pushSprite(0, 0);
}
