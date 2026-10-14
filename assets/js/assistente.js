// ============================================================
// MACEDO & REIS — Assistente: o chat de canto de tela (peça única do sistema, 14/10/2026)
// Um balão fixo no canto com uma carinha que pisca e, enquanto o assistente consulta, "lê" (os olhos vão e voltam); um
// recado que aparece sozinho uma vez por sessão (sem abrir o chat na marra); o painel da conversa, com o "digitando…"
// mostrando o que ele está lendo e a resposta aparecendo aos poucos; e o aviso no balão quando a resposta chega com o
// painel fechado. A conversa fica guardada na aba do navegador (sessionStorage "mr_assistente:<id>"): recarregar a
// página não apaga; "Sair" apaga (signOut, em supabase.js). Cada pergunta guarda o contexto em que foi feita (ex.: a
// ficha aberta): o histórico que vai junto é só o do mesmo contexto, e uma nota marca na conversa quando ele muda.
// Cada tela passa o que é dela (montarAssistente): o nome, a saudação, as perguntas de exemplo, o contexto, como
// perguntar (perguntarFuncao — Edge Function que responde em eventos "data: {...}") e como formatar as fontes.
// Estilos em assets/css/style.css (prefixo .as-). Os auxiliares puros (textoParaHtml, lerEventos, mensagemDoErro,
// perguntarFuncao, lerEstado, primeiraFrase) têm teste próprio em tests/assistente.test.mjs; a tela, em
// tests/harness/reforma-chat.py.
// ============================================================

export const escapeHtml = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ------------------------------------------------------------
// textoParaHtml(texto, { fontes }) — a resposta em HTML seguro: o texto é escapado antes de tudo; daí em diante só entra
// marcação daqui (parágrafo, negrito, lista, título vira negrito) e o que "fontes" devolver para o conteúdo de cada
// colchete (já escapado; devolve null pra deixar como está)
// ------------------------------------------------------------
export function textoParaHtml(texto, { fontes } = {}) {
  const inline = s => s.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
    .replace(/\[([^\]\n]{2,240})\]/g, (todo, dentro) => {
      const out = fontes ? fontes(dentro) : null;
      return out == null || out === dentro ? todo : '[' + out + ']';
    });
  let html = '', lista = null, par = [];
  const fecharPar = () => { if (par.length) { html += '<p>' + par.join('<br>') + '</p>'; par = []; } };
  const fecharLista = () => { if (lista) { html += '</' + lista + '>'; lista = null; } };
  escapeHtml(texto).split('\n').forEach(l => {
    const t = l.trim();
    const ul = /^[-*•]\s+(.*)$/.exec(t), ol = /^\d+[.)]\s+(.*)$/.exec(t);
    if (ul || ol) {
      fecharPar();
      const tipo = ul ? 'ul' : 'ol';
      if (lista !== tipo) { fecharLista(); html += '<' + tipo + '>'; lista = tipo; }
      html += '<li>' + inline((ul || ol)[1]) + '</li>';
      return;
    }
    fecharLista();
    if (!t) { fecharPar(); return; }
    const h = /^#{1,4}\s+(.*)$/.exec(t);
    if (h) { fecharPar(); html += '<p><b>' + inline(h[1]) + '</b></p>'; return; }
    par.push(inline(t));
  });
  fecharPar(); fecharLista();
  return html;
}

// ------------------------------------------------------------
// lerEventos(data, cb) — o que a função devolve: o Response em fluxo (o supabase-js devolve o próprio Response pra
// text/event-stream), o texto inteiro dos eventos ou o JSON de quem não pediu fluxo. Cada "data: {...}" vira cb(objeto)
// ------------------------------------------------------------
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

// o erro do supabase-js: a mensagem que a função mandou ou, sem ela, uma frase em português pelo código
export async function mensagemDoErro(error) {
  const r = error && error.context;
  try { if (r && typeof r.json === 'function') { const j = await (typeof r.clone === 'function' ? r.clone() : r).json(); if (j && j.erro) return String(j.erro); } } catch (e) { /* sem corpo */ }
  const st = r && r.status;
  if (st === 401) return 'Sua sessão expirou: saia e entre de novo no sistema.';
  if (st === 403) return 'O assistente é só da equipe do escritório.';
  if (st === 413) return 'A pergunta (com a conversa) ficou grande demais: comece uma conversa nova.';
  if (st === 429) return 'Muitas perguntas agora: espere um pouco e tente de novo.';
  if (st === 502 || st === 503 || st === 504 || st === 546) return 'O assistente demorou demais ou está fora do ar. Tente de novo em instantes.';
  if (st) return 'O assistente não respondeu (código ' + st + '). Tente de novo em instantes.';
  return 'Não consegui falar com o assistente. Confira a internet e tente de novo.';
}

// ------------------------------------------------------------
// perguntarFuncao(supabase, nome) — o "perguntar" de uma Edge Function do tipo da reforma-chat: manda a pergunta com
// "fluxo", repassa cada etapa (aoEtapa) e devolve { texto, fontes, cortada }; erro vira exceção com a frase pro usuário
// (sempre em português: o detalhe técnico não ajuda quem está do outro lado)
// ------------------------------------------------------------
export function perguntarFuncao(supabase, nome) {
  return async function perguntar(corpo, aoEtapa = () => {}) {
    let data, error;
    try { ({ data, error } = await supabase.functions.invoke(nome, { body: { ...corpo, fluxo: true } })); }
    catch (e) { throw new Error('Não consegui falar com o assistente. Confira a internet e tente de novo.'); }
    if (error) throw new Error(await mensagemDoErro(error));
    let resposta = null, erro = null, caiu = false;
    try {
      await lerEventos(data, ev => {
        if (ev.tipo === 'etapa') aoEtapa(String(ev.texto || ''));
        else if (ev.tipo === 'resposta') resposta = ev;
        else if (ev.tipo === 'erro') erro = String(ev.texto || '');
      });
    } catch (e) { caiu = true; }
    if (erro) throw new Error(erro);
    if (!resposta) throw new Error(caiu ? 'A conexão caiu no meio da resposta. Tente de novo.' : 'O assistente não devolveu resposta. Tente de novo.');
    return { texto: String(resposta.texto || ''), fontes: resposta.fontes || [], cortada: !!resposta.cortada };
  };
}

// ------------------------------------------------------------
// lerEstado(texto) — a conversa guardada na aba, conferida campo a campo: o que vier fora do formato (versão antiga,
// alguém mexendo no navegador) é descartado em vez de derrubar a tela. null = começa do zero
// ------------------------------------------------------------
const TIPOS_MSG = ['eu', 'ia', 'erro', 'nota'];
export function lerEstado(texto) {
  let j;
  try { j = JSON.parse(texto || 'null'); } catch (e) { return null; }
  if (!j || typeof j !== 'object' || Array.isArray(j) || j.v !== 1) return null;
  const str = x => typeof x === 'string';
  const id = x => (str(x) && x.length <= 100 ? x : null);
  const msgs = (Array.isArray(j.msgs) ? j.msgs : [])
    .filter(m => m && typeof m === 'object' && TIPOS_MSG.includes(m.tipo) && str(m.texto))
    .map(m => ({ tipo: m.tipo, texto: m.texto.slice(0, 20000), em: str(m.em) ? m.em.slice(0, 40) : '', ctxId: id(m.ctxId),
      etapas: Array.isArray(m.etapas) ? m.etapas.filter(str).map(e => e.slice(0, 300)).slice(0, 20) : [] }));
  const historico = (Array.isArray(j.historico) ? j.historico : [])
    .filter(h => h && typeof h === 'object' && str(h.pergunta) && str(h.resposta))
    .map(h => ({ pergunta: h.pergunta.slice(0, 2000), resposta: h.resposta.slice(0, 20000), ctxId: id(h.ctxId) }));
  const n = Number(j.naoLidas);
  return { v: 1, conversa: id(j.conversa), historico, msgs, aberto: j.aberto === true, largo: j.largo === true,
    naoLidas: Number.isFinite(n) ? Math.max(0, Math.min(99, Math.round(n))) : 0,
    recadoVisto: j.recadoVisto === true, recadoContextoVisto: j.recadoContextoVisto === true };
}
const estadoNovo = () => ({ v: 1, conversa: null, historico: [], msgs: [], aberto: false, largo: false, naoLidas: 0, recadoVisto: false, recadoContextoVisto: false });

// a primeira frase da resposta (sem as fontes e os separadores delas), pro recado "Respondi" e pro leitor de tela; frase
// curta demais ("Sim.") leva a seguinte junto
export const primeiraFrase = t => {
  const s = String(t || '').replace(/\[[^\]\n]*\]/g, '').replace(/\*\*/g, '').replace(/·/g, ' ')
    .replace(/\s+/g, ' ').replace(/\s+([.,;:!?])/g, '$1').replace(/[,;:]+([.!?])/g, '$1').trim();
  const m = /^(.{20,160}?[.!?])(\s|$)/.exec(s);
  return m ? m[1] : (s.length > 140 ? s.slice(0, 137) + '…' : s);
};
const hora = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };

// ------------------------------------------------------------
// a carinha: cabeça na cor da marca, dois olhos (piscam; "leem" enquanto ele consulta) e o sorriso de olhos (^ ^)
// quando a resposta chega
// ------------------------------------------------------------
const ROSTO = '<svg class="as-rosto" viewBox="0 0 56 56" aria-hidden="true" focusable="false">'
  + '<rect class="as-cabeca" x="2" y="2" width="52" height="52" rx="18"/>'
  + '<g class="as-olhos"><rect class="as-olho" x="16" y="19.5" width="8" height="15" rx="4"/><rect class="as-olho" x="32" y="19.5" width="8" height="15" rx="4"/></g>'
  + '<path class="as-sorri" d="M16 29.5q4-6.5 8 0M32 29.5q4-6.5 8 0"/></svg>';
const ICONE = {
  nova: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  maior: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>',
  menor: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/></svg>',
  fechar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
  enviar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>'
};

// ============================================================
// montarAssistente(op) → { abrir, fechar, enviar, definirContexto, atualizar, novaConversa }
//   op.id            chave da conversa guardada (sessionStorage "mr_assistente:<id>")
//   op.nome          nome no topo do painel · op.status: a frase embaixo do nome · op.rotulo: o nome do balão (leitor de tela)
//   op.saudacao      HTML da primeira mensagem (texto fixo da tela)
//   op.exemplos(ctx) perguntas de exemplo (conversa nova, ou contexto novo) · op.seguintes(ctx): depois de cada resposta
//   op.recado        { texto, exemplos } — o recado da primeira visita na sessão
//   op.recadoContexto(ctx) { texto, exemplos } — o recado na primeira vez que um contexto (ex.: a ficha) aparece na sessão
//   op.contexto(ctx) o que vai junto da pergunta quando o contexto está marcado (ex.: { caso_id, tela })
//   op.perguntar(corpo, aoEtapa) → { texto, fontes, cortada } (perguntarFuncao)
//   op.formatar(texto) → HTML da resposta · op.antes(): preparo antes de mostrar/enviar (ex.: carregar os códigos)
//   op.aoClicar(ev) clique dentro de uma resposta (ex.: a regra abre a Base legal); true = tratado
// ctx (definirContexto): { id, nome, ... } ou null — os outros campos podem ser getters (são lidos na hora); atualizar()
// redesenha as perguntas prontas quando a tela muda o que elas leem (ex.: a ficha acabou de ser simulada)
// ============================================================
export function montarAssistente(op) {
  const temMedia = q => typeof matchMedia === 'function' && matchMedia(q).matches;
  const reduzido = temMedia('(prefers-reduced-motion: reduce)');
  const estreito = () => temMedia('(max-width: 560px)');   // no celular o painel ocupa a tela inteira
  const chave = 'mr_assistente:' + op.id;
  let est = null;
  try { est = lerEstado(sessionStorage.getItem(chave)); } catch (e) { est = null; }
  if (!est) est = estadoNovo();
  const guardar = () => {
    est.msgs = est.msgs.slice(-60); est.historico = est.historico.slice(-12);
    try { sessionStorage.setItem(chave, JSON.stringify(est)); } catch (e) { /* aba sem armazenamento (ou cheia): segue sem guardar */ }
  };
  let ctx = null, usarCtx = true, ocupado = false, geracao = 0, timerRecado = null, ultimaEtapa = '';
  const ctxAtual = () => (ctx && usarCtx ? ctx : null);
  const idDe = c => (c ? String(c.id) : null);
  const ultimaPergunta = () => { for (let i = est.msgs.length - 1; i >= 0; i--) if (est.msgs[i].tipo === 'eu') return est.msgs[i]; return null; };

  // ---------- DOM ----------
  const raiz = document.createElement('div');
  raiz.className = 'as-raiz';
  raiz.dataset.assistente = op.id;
  const idPainel = 'as-painel-' + op.id;
  raiz.innerHTML =
    '<div class="as-recado" hidden><button type="button" class="as-recado-x" aria-label="Fechar o recado">×</button><div class="as-recado-txt"></div><div class="as-chips"></div></div>'
    + '<button type="button" class="as-lancador" aria-expanded="false" aria-controls="' + idPainel + '" aria-label="' + escapeHtml(op.rotulo || op.nome) + '" title="' + escapeHtml(op.rotulo || op.nome) + '">' + ROSTO + '<span class="as-selo" hidden></span></button>'
    + '<section class="as-painel" id="' + idPainel + '" role="dialog" aria-label="' + escapeHtml(op.nome) + '" hidden>'
    + '<header class="as-topo"><span class="as-avatar">' + ROSTO + '</span>'
    + '<div class="as-quem"><b class="as-nome">' + escapeHtml(op.nome) + '</b><span class="as-status"><i class="as-ponto"></i><span class="as-status-txt"></span></span></div>'
    + '<div class="as-acoes"><button type="button" class="as-acao" data-a="nova" title="Começar uma conversa nova" aria-label="Conversa nova">' + ICONE.nova + '</button>'
    + '<button type="button" class="as-acao" data-a="largo" title="Aumentar o painel" aria-label="Aumentar o painel">' + ICONE.maior + '</button>'
    + '<button type="button" class="as-acao" data-a="fechar" data-janela-fechar title="Minimizar" aria-label="Minimizar">' + ICONE.fechar + '</button></div></header>'
    + '<div class="as-ctx" hidden><label><input type="checkbox" checked> <span>Sobre a ficha aberta: <b></b></span></label></div>'
    + '<div class="as-msgs"><div class="as-lista"></div><div class="as-cauda"></div></div>'
    + '<form class="as-entrada"><textarea rows="1" maxlength="2000" data-no-autogrow placeholder="Pergunte à base…" aria-label="Sua pergunta" title="Enter envia; Shift+Enter quebra a linha"></textarea>'
    + '<button type="submit" class="as-enviar" aria-label="Enviar">' + ICONE.enviar + '</button></form>'
    + '</section>'
    + '<div class="as-vivo" role="status" aria-live="polite"></div>';
  document.body.appendChild(raiz);
  const q = s => raiz.querySelector(s);
  const lancador = q('.as-lancador'), selo = q('.as-selo'), recado = q('.as-recado'), painel = q('.as-painel');
  const msgs = q('.as-msgs'), lista = q('.as-lista'), cauda = q('.as-cauda'), vivo = q('.as-vivo');
  const texto = q('.as-entrada textarea'), enviarBtn = q('.as-enviar'), novaBtn = q('[data-a="nova"]'), statusTxt = q('.as-status-txt');
  const ctxBox = q('.as-ctx'), ctxCheck = q('.as-ctx input'), ctxNome = q('.as-ctx b');

  // a "?" da ajuda (tour) mora no mesmo canto: o balão sobe pra cima dela
  const conferirAjuda = () => raiz.classList.toggle('as-com-ajuda', !!document.querySelector('.mrt-help'));
  conferirAjuda(); setTimeout(conferirAjuda, 1500); setTimeout(conferirAjuda, 4000);
  // leitor de tela: só o que acabou de acontecer (a conversa não é relida a cada mudança)
  const anunciar = t => { vivo.textContent = ''; setTimeout(() => { vivo.textContent = t; }, 60); };

  // ---------- a carinha viva ----------
  const piscar = () => {
    if (!reduzido && !document.hidden && !raiz.classList.contains('as-pensando')) {
      raiz.classList.add('as-piscar');
      setTimeout(() => raiz.classList.remove('as-piscar'), 150);
    }
    setTimeout(piscar, 3500 + Math.random() * 3500);
  };
  setTimeout(piscar, 2000 + Math.random() * 2000);
  const sorrir = () => { raiz.classList.add('as-sorrindo'); setTimeout(() => raiz.classList.remove('as-sorrindo'), 1100); };
  const chamarAtencao = () => { if (reduzido) return; raiz.classList.remove('as-atencao'); void raiz.offsetWidth; raiz.classList.add('as-atencao'); setTimeout(() => raiz.classList.remove('as-atencao'), 800); };

  // ---------- status, selo, botões travados enquanto ele responde ----------
  const statusPadrao = () => { statusTxt.textContent = op.status || ''; raiz.classList.remove('as-ocupado'); };
  statusPadrao();
  const atualizarSelo = () => {
    selo.hidden = !est.naoLidas;
    selo.textContent = est.naoLidas > 9 ? '9+' : String(est.naoLidas || '');
    lancador.setAttribute('aria-label', (op.rotulo || op.nome) + (est.naoLidas ? ' — ' + est.naoLidas + (est.naoLidas === 1 ? ' resposta nova' : ' respostas novas') : ''));
  };
  // "Conversa nova" também trava: a pergunta no ar continuaria rodando na função (e contando no limite do dia)
  const travar = sim => { enviarBtn.disabled = sim; novaBtn.disabled = sim; };

  // ---------- recado (o balãozinho ao lado da carinha) ----------
  function mostrarRecado({ html, chips = [], ms = 16000 }) {
    if (est.aberto) return;
    clearTimeout(timerRecado);
    q('.as-recado-txt').innerHTML = html;
    const cx = recado.querySelector('.as-chips');
    cx.innerHTML = '';
    chips.forEach(c => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'as-chip'; b.textContent = c.rotulo;
      b.onclick = () => { esconderRecado(); c.acao(); };
      cx.appendChild(b);
    });
    recado.hidden = false;
    recado.classList.remove('as-surge'); void recado.offsetWidth; recado.classList.add('as-surge');
    chamarAtencao();
    if (ms) timerRecado = setTimeout(() => { if (!recado.matches(':hover') && !recado.contains(document.activeElement)) esconderRecado(); }, ms);
  }
  function esconderRecado() { clearTimeout(timerRecado); recado.hidden = true; }
  q('.as-recado-x').onclick = () => { esconderRecado(); lancador.focus({ preventScroll: true }); };
  // pergunta pronta do recado: abre e envia; com outra pergunta no ar, deixa na caixa
  const chipsDe = perguntas => (perguntas || []).map(p => ({ rotulo: p, acao: () => {
    abrir();
    if (ocupado) { texto.value = p; ajustarAltura(); } else enviar(p);
  } }));

  // ---------- mensagens: a lista cresce no fim (o que já está na tela fica como está); a cauda tem o "digitando…" e as
  // perguntas prontas ----------
  const rolar = () => { msgs.scrollTop = msgs.scrollHeight; };
  // a resposta nova: se cabe, rola até o fim; se é maior que o painel, mostra o começo dela (a leitura começa ali)
  const mostrarComeco = el => {
    const topo = msgs.scrollTop + el.getBoundingClientRect().top - msgs.getBoundingClientRect().top - 12;
    msgs.scrollTop = Math.min(topo, msgs.scrollHeight - msgs.clientHeight);
  };
  function htmlDaMsg(m, nova) {
    const n = nova ? ' as-nova' : '';
    if (m.tipo === 'nota') return '<div class="as-nota' + n + '">' + escapeHtml(m.texto) + '</div>';
    if (m.tipo === 'eu') return '<div class="as-msg eu' + n + '"><div class="as-bolha">' + escapeHtml(m.texto) + '</div><div class="as-meta"><time>' + hora(m.em) + '</time></div></div>';
    const erro = m.tipo === 'erro';
    const etapas = m.etapas || [];
    const consultas = etapas.length ? '<details class="as-consultas"><summary>' + etapas.length + (etapas.length === 1 ? ' consulta' : ' consultas') + '</summary><ol>'
      + etapas.map(e => '<li>' + escapeHtml(e) + '</li>').join('') + '</ol></details>' : '';
    return '<div class="as-msg ia' + (erro ? ' erro' : '') + n + '"><div class="as-resposta">' + (erro ? '<p>' + escapeHtml(m.texto) + '</p>' : op.formatar(m.texto)) + '</div>'
      + '<div class="as-meta"><time>' + hora(m.em) + '</time>' + consultas + '</div></div>';
  }
  const htmlSaudacao = () => '<div class="as-msg ia as-saudacao"><div class="as-resposta">' + (op.saudacao || '') + '</div></div>';
  // as perguntas prontas: conversa nova, ou contexto diferente do da última pergunta → os exemplos do contexto de agora;
  // depois de uma resposta → as seguintes (menos as já feitas no mesmo contexto)
  function chipsDaConversa() {
    if (ocupado) return '';
    const atual = idDe(ctxAtual()), ultimaP = ultimaPergunta(), ultimo = est.msgs[est.msgs.length - 1];
    let lst = [];
    if (!ultimaP || ultimaP.ctxId !== atual) lst = op.exemplos ? op.exemplos(ctxAtual()) : [];
    else if (ultimo && ultimo.tipo === 'ia' && op.seguintes) {
      const feitas = new Set(est.msgs.filter(m => m.tipo === 'eu' && m.ctxId === atual).map(m => m.texto));
      lst = op.seguintes(ctxAtual()).filter(p => !feitas.has(p));
    }
    if (!lst || !lst.length) return '';
    return '<div class="as-chips as-chips-conversa">' + lst.map(p => '<button type="button" class="as-chip" data-pergunta="' + escapeHtml(p) + '">' + escapeHtml(p) + '</button>').join('') + '</div>';
  }
  const htmlDigitando = () => '<div class="as-msg ia as-digitando-msg"><div class="as-digitando"><span class="as-pontos"><i></i><i></i><i></i></span><span class="as-lendo">'
    + escapeHtml(ultimaEtapa || 'Lendo a base…') + '</span></div></div>';
  function desenharCauda() { cauda.innerHTML = (ocupado ? htmlDigitando() : '') + chipsDaConversa(); }
  function desenharTudo({ manterRolagem = false } = {}) {
    const topo = msgs.scrollTop, noFim = msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight < 40;
    lista.innerHTML = (est.msgs.length ? '' : htmlSaudacao()) + est.msgs.map(m => htmlDaMsg(m, false)).join('');
    desenharCauda();
    if (manterRolagem && !noFim) msgs.scrollTop = topo; else rolar();
  }
  function acrescentar(m) {
    const s = lista.querySelector('.as-saudacao'); if (s) s.remove();
    lista.insertAdjacentHTML('beforeend', htmlDaMsg(m, true));
    return lista.lastElementChild;
  }
  const atualizarDigitando = () => {
    const t = ultimaEtapa || 'Lendo a base…';
    const el = cauda.querySelector('.as-lendo'); if (el) el.textContent = t;
    statusTxt.textContent = t;
  };

  // a resposta aparece aos poucos (palavra por palavra, ~1,5 s no total); clique completa na hora
  function revelar(el) {
    if (reduzido || document.hidden) return;
    const final = el.innerHTML;
    const palavras = [];
    const andar = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nos = [];
    while (andar.nextNode()) nos.push(andar.currentNode);
    nos.forEach(n => {
      const frag = document.createDocumentFragment();
      n.textContent.split(/(\s+)/).forEach(p => {
        if (!p) return;
        if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(p)); return; }
        const s = document.createElement('span'); s.className = 'as-pal'; s.textContent = p; frag.appendChild(s); palavras.push(s);
      });
      n.parentNode.replaceChild(frag, n);
    });
    if (!palavras.length) return;
    let i = 0, pronto = false;
    const porQuadro = Math.max(2, Math.ceil(palavras.length / 90));
    const terminar = () => { if (pronto) return; pronto = true; el.innerHTML = final; el.removeEventListener('click', terminar); };
    el.addEventListener('click', terminar);
    const passo = () => {
      if (pronto) return;
      const fim = Math.min(palavras.length, i + porQuadro);
      for (; i < fim; i++) palavras[i].classList.add('on');
      if (i < palavras.length) requestAnimationFrame(passo); else setTimeout(terminar, 220);
    };
    requestAnimationFrame(passo);
  }

  // ---------- contexto (ex.: a ficha aberta) ----------
  function mostrarContexto() {
    ctxBox.hidden = !ctx;
    if (ctx) ctxNome.textContent = ctx.nome || '';
  }
  ctxCheck.onchange = () => { usarCtx = ctxCheck.checked; desenharCauda(); };
  function definirContexto(novo) {
    const antes = idDe(ctx);
    ctx = novo || null;
    const mudou = idDe(ctx) !== antes;
    if (mudou) { usarCtx = true; ctxCheck.checked = true; }
    mostrarContexto();
    if (ctx && mudou && !est.aberto) {
      // a primeira ficha da sessão ganha o recado; as seguintes, só um aceno do balão
      const r = !est.recadoContextoVisto && op.recadoContexto ? op.recadoContexto(ctx) : null;
      if (r) {
        est.recadoContextoVisto = true; guardar();
        mostrarRecado({ html: '<p>' + escapeHtml(r.texto) + '</p>', chips: chipsDe(r.exemplos), ms: 14000 });
      } else chamarAtencao();
    }
    desenharCauda();
  }

  // ---------- abrir, fechar ----------
  const ajustarAltura = () => { texto.style.height = 'auto'; texto.style.height = Math.min(140, texto.scrollHeight + 2) + 'px'; };
  function abrir(foco = true) {
    const tinhaNova = est.naoLidas > 0;
    esconderRecado();
    est.aberto = true; est.naoLidas = 0; guardar(); atualizarSelo();
    painel.hidden = false;
    raiz.classList.add('as-aberto');
    document.documentElement.classList.add('as-painel-aberto');
    lancador.setAttribute('aria-expanded', 'true');
    ajustarAltura();
    const respostas = lista.querySelectorAll('.as-msg.ia:not(.as-saudacao)');
    if (tinhaNova && respostas.length) mostrarComeco(respostas[respostas.length - 1]); else rolar();
    // no celular, sem foco automático: o teclado subiria por cima da conversa
    if (foco && !estreito()) setTimeout(() => texto.focus({ preventScroll: true }), 30);
  }
  function fechar() {
    const tinhaFoco = raiz.contains(document.activeElement);
    est.aberto = false; guardar();
    painel.hidden = true;
    raiz.classList.remove('as-aberto');
    document.documentElement.classList.remove('as-painel-aberto');
    lancador.setAttribute('aria-expanded', 'false');
    if (tinhaFoco) lancador.focus({ preventScroll: true });
  }
  function aplicarLargo() {
    painel.classList.toggle('as-largo', !!est.largo);
    const b = q('[data-a="largo"]');
    b.innerHTML = est.largo ? ICONE.menor : ICONE.maior;
    b.title = est.largo ? 'Diminuir o painel' : 'Aumentar o painel';
    b.setAttribute('aria-label', b.title);
  }
  function novaConversa() {
    if (ocupado) return;
    geracao++; ultimaEtapa = '';
    est.conversa = null; est.historico = []; est.msgs = [];
    guardar(); statusPadrao();
    desenharTudo();
    anunciar('Conversa nova.');
    if (est.aberto) texto.focus({ preventScroll: true });
  }
  lancador.onclick = () => (est.aberto ? fechar() : abrir());
  q('.as-acoes').onclick = ev => {
    const b = ev.target.closest('.as-acao'); if (!b || b.disabled) return;
    if (b.dataset.a === 'fechar') fechar();
    else if (b.dataset.a === 'nova') novaConversa();
    else if (b.dataset.a === 'largo') { est.largo = !est.largo; guardar(); aplicarLargo(); rolar(); }
  };
  // Esc dentro do assistente (painel, balão, recado) fecha o painel ou o recado — salvo quando outra janela está por cima
  // do painel (ex.: a Base legal aberta por uma fonte): aí o Esc é dela (janelas.js fecha a de cima)
  const coberto = () => {
    const r = painel.getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!el && !raiz.contains(el);
  };
  raiz.addEventListener('keydown', ev => {
    if (ev.key !== 'Escape' || ev.defaultPrevented || ev.isComposing) return;
    if (est.aberto) { if (coberto()) return; ev.preventDefault(); fechar(); }
    else if (!recado.hidden) { ev.preventDefault(); esconderRecado(); lancador.focus({ preventScroll: true }); }
  });
  msgs.addEventListener('click', ev => {
    const chip = ev.target.closest('.as-chip[data-pergunta]');
    if (chip) { enviar(chip.dataset.pergunta); if (!estreito()) texto.focus({ preventScroll: true }); return; }
    if (op.aoClicar) op.aoClicar(ev);
  });

  // ---------- enviar ----------
  texto.addEventListener('input', ajustarAltura);
  texto.addEventListener('keydown', ev => { if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); enviar(); } });
  q('.as-entrada').onsubmit = ev => { ev.preventDefault(); enviar(); };

  async function enviar(pergunta) {
    const t = String(pergunta != null ? pergunta : texto.value).trim();
    if (!t || ocupado) return;
    const g = geracao, c = ctxAtual(), cid = idDe(c), agora = () => new Date().toISOString();
    ocupado = true; travar(true); ultimaEtapa = '';
    if (!est.conversa && typeof crypto !== 'undefined' && crypto.randomUUID) est.conversa = crypto.randomUUID();
    // a pergunta muda de contexto (outra ficha, ou nenhuma): uma nota marca a troca na conversa
    const anterior = ultimaPergunta();
    if ((anterior ? anterior.ctxId : null) !== cid) {
      const nota = { tipo: 'nota', texto: c ? 'Sobre a ficha de ' + (c.nome || '—') : 'Pergunta geral', em: agora(), ctxId: cid };
      est.msgs.push(nota); acrescentar(nota);
    }
    const eu = { tipo: 'eu', texto: t, em: agora(), ctxId: cid };
    est.msgs.push(eu); acrescentar(eu);
    if (pergunta == null) { texto.value = ''; ajustarAltura(); }
    guardar();
    raiz.classList.add('as-pensando', 'as-ocupado');
    desenharCauda(); atualizarDigitando(); rolar();
    anunciar('Pergunta enviada. Consultando a base.');
    const etapas = [];
    let res = null, erro = null;
    try {
      // o histórico que vai junto é só o do mesmo contexto: a conversa sobre uma empresa não entra na de outra
      const historico = est.historico.filter(h => h.ctxId === cid).slice(-6).map(h => ({ pergunta: h.pergunta, resposta: h.resposta }));
      const corpo = { pergunta: t, historico, conversa: est.conversa, contexto: (c && op.contexto ? op.contexto(c) : null) || {} };
      if (op.antes) await Promise.resolve().then(op.antes).catch(() => {});
      res = await op.perguntar(corpo, e => { if (g !== geracao) return; etapas.push(e); ultimaEtapa = e; atualizarDigitando(); });
    } catch (e) { erro = (e && e.message) || 'Erro no assistente.'; }
    if (g !== geracao) return;   // a conversa mudou enquanto esperava
    ocupado = false; travar(false);
    raiz.classList.remove('as-pensando'); statusPadrao();
    let el = null;
    if (res) {
      const nova = { tipo: 'ia', texto: res.texto, etapas: etapas.slice(0, 20), em: agora(), ctxId: cid };
      est.msgs.push(nova); el = acrescentar(nova);
      if (res.cortada) { const n = { tipo: 'nota', texto: 'A resposta passou do tamanho máximo e foi cortada — peça a continuação.', em: agora(), ctxId: cid }; est.msgs.push(n); acrescentar(n); }
      est.historico.push({ pergunta: t, resposta: res.texto, ctxId: cid });
      sorrir();
      anunciar('Resposta: ' + primeiraFrase(res.texto));
    } else {
      const falha = { tipo: 'erro', texto: erro, em: agora(), ctxId: cid };
      est.msgs.push(falha); el = acrescentar(falha);
      if (!texto.value.trim()) { texto.value = t; ajustarAltura(); }
      anunciar('Não consegui responder: ' + erro);
    }
    if (!est.aberto) {
      est.naoLidas++; atualizarSelo();
      mostrarRecado({ html: res ? '<p><b>Respondi.</b> ' + escapeHtml(primeiraFrase(res.texto)) + '</p>' : '<p><b>Não consegui responder.</b> ' + escapeHtml(erro) + '</p>',
        chips: [{ rotulo: 'Ver a resposta', acao: () => abrir() }], ms: 30000 });
    }
    guardar();
    desenharCauda();
    if (est.aberto) {
      mostrarComeco(el);
      if (res && !document.hidden) revelar(el.querySelector('.as-resposta'));
    }
  }

  // ---------- começo ----------
  // a página recarregou com uma pergunta sem resposta: avisa e devolve a pergunta pra caixa
  const ultima = est.msgs[est.msgs.length - 1];
  if (ultima && ultima.tipo === 'eu') {
    est.msgs.push({ tipo: 'erro', texto: 'A página recarregou antes da resposta. Pergunte de novo.', em: new Date().toISOString(), ctxId: ultima.ctxId });
    texto.value = ultima.texto;
    guardar();
  }
  aplicarLargo();
  atualizarSelo();
  desenharTudo();
  // o painel aberto continua aberto depois de recarregar — no computador; no celular ele cobriria a tela toda
  if (est.aberto) { if (estreito()) { est.aberto = false; guardar(); } else abrir(false); }
  // as fontes viram link quando os códigos chegam
  if (op.antes) Promise.resolve().then(op.antes).then(() => { if (est.msgs.some(m => m.tipo === 'ia')) desenharTudo({ manterRolagem: true }); }).catch(() => {});
  if (!est.recadoVisto && !est.msgs.length && !est.aberto && op.recado) {
    setTimeout(() => {
      if (est.aberto || est.msgs.length) return;
      est.recadoVisto = true; guardar();
      if (recado.hidden) mostrarRecado({ html: '<p>' + escapeHtml(op.recado.texto) + '</p>', chips: chipsDe(op.recado.exemplos) });
    }, 2500);
  }

  return { abrir, fechar, enviar, definirContexto, atualizar: desenharCauda, novaConversa };
}
