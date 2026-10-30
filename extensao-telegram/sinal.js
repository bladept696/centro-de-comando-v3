// Dentro da moldura do painel: diz ao painel quantas mensagens por ler há no Telegram (só um número; não lê nem envia conversas).
// Conta os avisos de não lidas das conversas (não silenciadas) na lista do Telegram Web; se o título trouxer "(3) Telegram Web", usa esse número.
(function(){
  if(window === window.top) return;
  const alvo = (location.ancestorOrigins && location.ancestorOrigins[0]) || '';
  if(!/^http:\/\/(localhost|127\.0\.0\.1):8765$/.test(alvo)) return;
  let ultimo = -1;
  function contar(){
    const t = document.title || '', m = t.match(/\((\d+)\)/) || t.match(/^(\d+)\s/);
    if(m) return parseInt(m[1], 10) || 0;
    let n = 0;
    document.querySelectorAll('.chatlist-chat .dialog-subtitle-badge, .chatlist-chat .badge').forEach(el => {
      const cls = String(el.className || '');
      if(/badge-icon|badge-gray|muted/.test(cls) || el.closest('.is-muted, .muted') || el.offsetWidth === 0) return;
      if(!/badge-primary|unread/.test(cls) && !el.closest('.chatlist-chat')) return;
      const v = parseInt((el.textContent || '').trim(), 10);
      n += v > 0 ? v : ((el.textContent || '').trim() === '' && /badge-primary/.test(cls) ? 1 : 0);   // sem número = conversa marcada como não lida
    });
    return n;
  }
  function enviar(){
    const n = contar(); if(n === ultimo) return; ultimo = n;
    try { parent.postMessage({ hcTelegram: 'nao-lidas', n }, alvo); } catch(e) {}
  }
  setInterval(enviar, 2000); enviar();
})();
