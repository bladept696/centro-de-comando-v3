
// ---------- Rodapé de notícias de Bitcoin ----------
// As notícias vêm do servidor local (/api/btc-news), que junta vários feeds RSS.
// As preocupantes (ataques, quedas, proibições...) aparecem primeiro, a vermelho.
function newsAgo(ts){
  if(!ts) return '';
  const m = Math.max(1, Math.round((Date.now() / 1000 - ts) / 60));
  return m < 60 ? 'há ' + m + ' min' : m < 1440 ? 'há ' + Math.round(m / 60) + ' h' : 'há ' + Math.round(m / 1440) + ' d';
}
// A faixa é fixa no topo da janela, alinhada com o painel principal
function newsPlace(){
  const box = $('newsTicker'), fr = $('mainFrame');
  if(!box || !fr) return;
  const r = fr.getBoundingClientRect();
  if(r.width){ box.style.left = Math.max(0, r.left) + 'px'; box.style.right = Math.max(0, window.innerWidth - r.right) + 'px'; }
}
function newsMessage(text){
  const track = $('newsTrack');
  if(!track) return;
  track.innerHTML = '<span class="news-empty">' + escapeHtml(text) + '</span>';
  track.style.animation = 'none';
  $('newsAlerts').textContent = '';
}
function newsRender(items){
  const box = $('newsTicker'), track = $('newsTrack');
  if(!box || !track) return;
  if(!items.length){ newsMessage('Sem notícias de Bitcoin de momento.'); return; }
  track.style.animation = '';
  const list = items.filter(i => i.worry).concat(items.filter(i => !i.worry)).slice(0, 25);
  const html = list.map(i => '<a class="news-item' + (i.worry ? ' worry' : '') + '" href="' + escapeHtml(i.link) + '" target="_blank" rel="noopener noreferrer">' +
    (i.worry ? '⚠ ' : '') + escapeHtml(i.title) + '<small>' + escapeHtml(i.source) + (i.ts ? ' · ' + newsAgo(i.ts) : '') + '</small></a>').join('<span class="news-sep">•</span>');
  track.innerHTML = html + '<span class="news-sep">•</span>' + html;   // duplicado para a faixa correr sem saltos
  track.style.setProperty('--news-dur', Math.max(60, list.length * 9) + 's');
  const w = list.filter(i => i.worry).length;
  $('newsAlerts').textContent = w ? '⚠ ' + w + ' preocupante' + (w > 1 ? 's' : '') : '';
}
async function newsFetch(){
  try {
    if(window.authReady) await window.authReady;   // só depois de saber se há login (e de o token existir)
    const res = await fetch(`${API_BASE}/api/btc-news`);
    if(!res.ok){ newsMessage(res.status === 404 ? 'Notícias indisponíveis: reinicia o servidor para ativar.' : res.status === 401 ? 'Notícias disponíveis depois de iniciares sessão.' : 'Notícias indisponíveis de momento.'); return; }
    const d = await res.json();
    newsRender(Array.isArray(d.items) ? d.items : []);
  } catch(e) { newsMessage('Notícias indisponíveis: sem ligação ao servidor ou à internet.'); }
}
if($('newsTicker')) document.body.appendChild($('newsTicker'));   // fora do painel: assim fica mesmo fixa na janela
document.body.classList.add('has-news');
newsPlace();
window.addEventListener('resize', newsPlace);
if(window.ResizeObserver && $('mainFrame')) new ResizeObserver(newsPlace).observe($('mainFrame'));
newsFetch();
setInterval(newsFetch, 10 * 60 * 1000);
