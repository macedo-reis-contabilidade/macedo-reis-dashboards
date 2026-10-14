// ============================================================
// MACEDO & REIS — Eventos das funções de chat ("data: {...}", text/event-stream)
// Lido pelo assistente na tela (assets/js/assistente.js) e pela função do assistente do escritório, que repassa as
// etapas do chat da Reforma. Aceita o Response em fluxo (lido em pedaços — acento partido entre dois pedaços sai
// inteiro), o texto inteiro dos eventos ou o JSON de quem não pediu fluxo. Cada "data: {...}" vira cb(objeto); linha
// quebrada é ignorada. Testes em tests/assistente.test.mjs.
// ============================================================

export async function lerEventos(data, cb) {
  const processar = bloco => bloco.split('\n').forEach(l => { if (l.startsWith('data: ')) { try { cb(JSON.parse(l.slice(6))); } catch (e) { /* linha quebrada */ } } });
  if (data && data.body && typeof data.body.getReader === 'function') {
    const leitor = data.body.getReader(), dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await leitor.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) { processar(buf.slice(0, i)); buf = buf.slice(i + 2); }
    }
    buf += dec.decode();
    if (buf.trim()) processar(buf);
  } else if (typeof data === 'string') processar(data);
  else if (data && (data.resposta || data.erro)) cb(data.erro ? { tipo: 'erro', texto: data.erro } : { tipo: 'resposta', texto: data.resposta, fontes: data.fontes, cortada: data.cortada });
}
