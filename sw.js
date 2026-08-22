// Service worker mínimo do Centro de Comando.
//
// Não faz cache/offline "a sério" de propósito: este painel só faz sentido
// ligado ao servidor local (localhost:8765) a falar com as máquinas na LAN,
// por isso não há vantagem em servir dados antigos offline - podia até
// confundir (mostrar leituras velhas como se fossem atuais). A única razão
// de este ficheiro existir é satisfazer o critério de instalabilidade do
// Chrome/Edge (exige um service worker com um handler de 'fetch' registado
// para mostrar o botão/prompt de "Instalar app").
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
