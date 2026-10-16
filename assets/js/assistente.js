// ============================================================
// MACEDO & REIS — Assistente: o chat de canto de tela (peça única do sistema, 14/10/2026)
// Um balão fixo no canto com uma carinha que pisca e, enquanto o assistente consulta, "lê" (os olhos vão e voltam); um
// recado que aparece sozinho uma vez por sessão (sem abrir o chat na marra); o painel da conversa, com o "digitando…"
// mostrando o que ele está lendo e a resposta aparecendo aos poucos; e o aviso no balão quando a resposta chega com o
// painel fechado. A conversa fica guardada na aba do navegador (sessionStorage "mr_assistente:<id>"): recarregar a
// página não apaga; "Sair" apaga (signOut, em supabase.js). Cada pergunta guarda o contexto em que foi feita (ex.: a
// ficha aberta): o histórico que vai junto é só o do mesmo contexto, e uma nota marca na conversa quando ele muda.
// Cada tela passa o que é dela (montarAssistente): o nome, a saudação, as perguntas de exemplo, o contexto, como
// perguntar (perguntarFuncao — Edge Function que responde em eventos "data: {...}"), como formatar as fontes e como
// retomar uma resposta depois de trocar de página. Os olhos seguem o mouse; reagir() faz a carinha comemorar e avisar()
// mostra um recado (o assistente do escritório, assets/js/assistente-escritorio.js, usa os dois). A resposta pode trazer
// uma ação proposta ("acao": concluir tarefas, criar, marcar pago, revisar): a tela desenha o cartão dela embaixo da
// resposta (op.cartao) e o estado do cartão (feito, desfeito…) fica guardado na conversa; mostrarAcao() põe um cartão
// sem passar pela IA (ex.: "Revisar as atrasadas", da saudação do dia).
// Abas (16/10/2026): op.abas põe outras abas no mesmo painel, ao lado da do assistente (hoje, a "Equipe" — o chat da
// equipe, assets/js/chat-equipe.js). Cada aba monta o que é dela num lugar próprio do painel e conta as novidades dela,
// que somam no número do balão; a aba aberta fica guardada com a conversa.
// Estilos em assets/css/style.css (prefixo .as-). Os auxiliares puros (textoParaHtml, lerEventos, mensagemDoErro,
// perguntarFuncao, lerEstado, primeiraFrase) têm teste próprio em tests/assistente.test.mjs; a tela, em
// tests/harness/reforma-chat.py.
// ============================================================

import { lerEventos } from './eventos-sse.js';

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

// lerEventos (os eventos "data: {...}" que a função manda) mora em eventos-sse.js: a função do assistente usa o mesmo
export { lerEventos };

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
    return { texto: String(resposta.texto || ''), fontes: resposta.fontes || [], cortada: !!resposta.cortada, acao: acaoValida(resposta.acao) };
  };
}

// a ação proposta (o cartão embaixo da resposta): um objeto com "tipo"; o resto quem confere é o cartão (op.cartao).
// Grande demais ou fora do formato fica de fora
export function acaoValida(a) {
  if (!a || typeof a !== 'object' || Array.isArray(a) || typeof a.tipo !== 'string' || !a.tipo || a.tipo.length > 40) return null;
  try { return JSON.stringify(a).length <= 64000 ? a : null; } catch (e) { return null; }
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
      etapas: Array.isArray(m.etapas) ? m.etapas.filter(str).map(e => e.slice(0, 300)).slice(0, 20) : [], ...(id(m.pedido) ? { pedido: id(m.pedido) } : {}),
      ...(m.tipo === 'ia' && id(m.id) && acaoValida(m.acao) ? { id: id(m.id), acao: m.acao } : {}) }));
  const historico = (Array.isArray(j.historico) ? j.historico : [])
    .filter(h => h && typeof h === 'object' && str(h.pergunta) && str(h.resposta))
    .map(h => ({ pergunta: h.pergunta.slice(0, 2000), resposta: h.resposta.slice(0, 20000), ctxId: id(h.ctxId), ...(str(h.em) && h.em ? { em: h.em.slice(0, 40) } : {}) }));
  // a hora de cada pergunta (a conversa pode passar de um dia pro outro, e a função precisa saber quando foi cada uma).
  // Na conversa guardada antes de 16/10/2026, sem ela: vem da mensagem da pergunta, de trás pra frente (o mesmo texto no
  // mesmo contexto — a pergunta repetida casa com a mais recente que ainda não casou)
  for (let i = historico.length - 1, k = msgs.length - 1; i >= 0; i--) {
    const h = historico[i];
    while (k >= 0 && !(msgs[k].tipo === 'eu' && msgs[k].ctxId === h.ctxId && msgs[k].texto.slice(0, 2000) === h.pergunta)) k--;
    if (k < 0) break;
    if (!h.em && msgs[k].em) h.em = msgs[k].em;
    k--;
  }
  const n = Number(j.naoLidas);
  return { v: 1, conversa: id(j.conversa), historico, msgs, aberto: j.aberto === true, largo: j.largo === true,
    naoLidas: Number.isFinite(n) ? Math.max(0, Math.min(99, Math.round(n))) : 0,
    recadoVisto: j.recadoVisto === true, recadoContextoVisto: j.recadoContextoVisto === true, aba: (str(j.aba) && /^[a-z0-9-]{1,40}$/.test(j.aba) ? j.aba : 'assistente') };
}
const estadoNovo = () => ({ v: 1, conversa: null, historico: [], msgs: [], aberto: false, largo: false, naoLidas: 0, recadoVisto: false, recadoContextoVisto: false, aba: 'assistente' });

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
// a carinha: cabeça na cor da marca, dois olhos (piscam; seguem o mouse; "leem" enquanto ele consulta) e o sorriso de
// olhos (^ ^) quando a resposta chega ou quando alguém conclui uma tarefa
// ------------------------------------------------------------
const ROSTO = '<svg class="as-rosto" viewBox="0 0 56 56" aria-hidden="true" focusable="false">'
  + '<rect class="as-cabeca" x="2" y="2" width="52" height="52" rx="18"/>'
  + '<g class="as-mira"><g class="as-olhos"><rect class="as-olho" x="16" y="19.5" width="8" height="15" rx="4"/><rect class="as-olho" x="32" y="19.5" width="8" height="15" rx="4"/></g></g>'
  + '<path class="as-sorri" d="M16 29.5q4-6.5 8 0M32 29.5q4-6.5 8 0"/></svg>';
const ICONE = {
  nova: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  maior: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>',
  menor: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/></svg>',
  fechar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
  enviar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>'
};
const valorOuFuncao = v => (typeof v === 'function' ? v() : v);

// ============================================================
// montarAssistente(op) → { abrir, fechar, enviar, definirContexto, atualizar, redesenhar, novaConversa, reagir, avisar, raiz }
//   op.id            chave da conversa guardada (sessionStorage "mr_assistente:<id>")
//   op.nome          nome no topo do painel · op.status: a frase embaixo do nome (texto ou função) · op.rotulo: o nome do
//                    balão (leitor de tela) · op.placeholder: o texto da caixa vazia
//   op.saudacao      HTML da primeira mensagem (texto fixo da tela, ou função)
//   op.exemplos(ctx) perguntas de exemplo (conversa nova, ou contexto novo) · op.seguintes(ctx): depois de cada resposta
//   op.recado        { texto, exemplos } — o recado da primeira visita na sessão (opcional)
//   op.recadoContexto(ctx) { texto, exemplos } — o recado na primeira vez que um contexto (ex.: a ficha) aparece na sessão
//   op.contexto(ctx) o que vai junto de toda pergunta (ctx = null sem nada aberto ou com a caixa desmarcada)
//   op.perguntar(corpo, aoEtapa) → { texto, fontes, cortada } (perguntarFuncao). O corpo leva "pedido": o id da pergunta
//   op.retomar(pedido, aoEtapa) → { texto, cortada } | null: a página recarregou (trocou de tela) com a pergunta no ar —
//                    busca a resposta pelo id; null = a pergunta não chegou. Sem retomar, a pergunta volta pra caixa
//   op.formatar(texto) → HTML da resposta · op.antes(): preparo antes de mostrar/enviar (ex.: carregar os códigos)
//   op.aoClicar(ev)  clique dentro de uma resposta (ex.: a regra abre a Base legal); true = tratado
//   op.cartao(acao, ajuda) → Element: o cartão da ação proposta, embaixo da resposta; ajuda = { salvar(acao): guarda o
//                    estado do cartão na conversa, anunciar(texto): o leitor de tela, reagir() }. Sem op.cartao, sem cartão
// ctx (definirContexto): { id, nome, rotulo?, nota?, ... } ou null — rotulo: a faixa ("Sobre a ficha aberta"); nota: o
// começo da nota na conversa ("Sobre a ficha de "); os outros campos podem ser getters (são lidos na hora).
// atualizar() redesenha as perguntas prontas (a tela mudou o que elas leem); redesenhar() refaz a conversa (ex.: os códigos
// das fontes chegaram); reagir() faz a carinha comemorar; avisar({ texto | html, exemplos, botoes, ms }) mostra um recado
// (botoes: [{ rotulo, acao }] — o que acontece na tela, sem perguntar à IA); mostrarAcao({ texto, acao }) põe na conversa
// uma mensagem com o cartão, sem passar pela IA, e abre o painel.
//   op.abas          [{ id, rotulo, nome?, montar(lugar, ctl) → { aoMostrar({ foco }), aoEsconder(), status() } }] — as outras
//                    abas do painel. ctl: { ativa(): o painel aberto nesta aba · mostrar(): abre o painel nela · contador(n):
//                    as novidades dela (somam no balão) · status(): redesenha a linha do topo · avisar(msg) · anunciar(t) ·
//                    reagir() · largo(): o painel aumentado }. mostrarAba(id) troca de aba
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
  const novoId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : null);

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
    + '<div class="as-abas" role="tablist" aria-label="Abas do painel" hidden></div>'
    + '<div class="as-vista" data-aba="assistente" role="tabpanel">'
    + '<div class="as-ctx" hidden><label><input type="checkbox" checked> <span><span class="as-ctx-rot">Sobre a ficha aberta</span>: <b></b></span></label></div>'
    + '<div class="as-msgs"><div class="as-lista"></div><div class="as-cauda"></div></div>'
    + '<form class="as-entrada"><textarea rows="1" maxlength="2000" data-no-autogrow placeholder="' + escapeHtml(op.placeholder || 'Pergunte à base…') + '" aria-label="Sua pergunta" title="Enter envia; Shift+Enter quebra a linha"></textarea>'
    + '<button type="submit" class="as-enviar" aria-label="Enviar">' + ICONE.enviar + '</button></form>'
    + '</div>'
    + '</section>'
    + '<div class="as-vivo" role="status" aria-live="polite"></div>';
  document.body.appendChild(raiz);
  const q = s => raiz.querySelector(s);
  const lancador = q('.as-lancador'), selo = q('.as-selo'), recado = q('.as-recado'), painel = q('.as-painel');
  const msgs = q('.as-msgs'), lista = q('.as-lista'), cauda = q('.as-cauda'), vivo = q('.as-vivo');
  const texto = q('.as-entrada textarea'), enviarBtn = q('.as-enviar'), novaBtn = q('[data-a="nova"]'), statusTxt = q('.as-status-txt');
  const ctxBox = q('.as-ctx'), ctxCheck = q('.as-ctx input'), ctxNome = q('.as-ctx b'), ctxRot = q('.as-ctx-rot');

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
  // comemora (alguém concluiu uma tarefa): sorri e dá um pulinho
  function reagir() {
    sorrir();
    if (reduzido) return;
    raiz.classList.remove('as-pulo'); void raiz.offsetWidth; raiz.classList.add('as-pulo');
    setTimeout(() => raiz.classList.remove('as-pulo'), 700);
  }
  // os olhos seguem o mouse (de leve; parado por um tempo, olham pra frente)
  if (!reduzido) {
    const miras = [...raiz.querySelectorAll('.as-mira')];
    let px = 0, py = 0, pendente = false, ultimoMov = 0;
    const mirar = () => {
      pendente = false;
      const r = (est.aberto && !estreito() ? q('.as-avatar') : lancador).getBoundingClientRect();
      if (!r.width) return;
      const dx = px - (r.left + r.width / 2), dy = py - (r.top + r.height / 2), dist = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, dist / 360);
      const t = 'translate(' + (dx / dist * 3.2 * k).toFixed(2) + 'px,' + (dy / dist * 2.6 * k).toFixed(2) + 'px)';
      miras.forEach(m => { m.style.transform = t; });
    };
    document.addEventListener('pointermove', ev => {
      px = ev.clientX; py = ev.clientY; ultimoMov = Date.now();
      if (!pendente) { pendente = true; requestAnimationFrame(mirar); }
    }, { passive: true });
    setInterval(() => { if (ultimoMov && Date.now() - ultimoMov > 7000) { ultimoMov = 0; miras.forEach(m => { m.style.transform = ''; }); } }, 2500);
  }

  // ---------- as abas (op.abas: o chat da equipe, por exemplo) ----------
  const abas = (Array.isArray(op.abas) ? op.abas : []).filter(a => a && /^[a-z0-9-]{1,40}$/.test(String(a.id)) && a.id !== 'assistente' && typeof a.montar === 'function');
  const barra = q('.as-abas'), nomeTopo = q('.as-nome');
  const contagens = {}, instancias = {};
  const abaAtual = () => (abas.some(a => a.id === est.aba) ? est.aba : 'assistente');
  const abaDe = id => abas.find(a => a.id === id) || null;

  // ---------- status, selo, botões travados enquanto ele responde ----------
  // o topo: o nome e a frase de quem está na frente (o assistente ou a aba aberta)
  function atualizarTopo() {
    const a = abaDe(abaAtual());
    nomeTopo.textContent = a ? a.nome || a.rotulo : op.nome;
    if (a) { let t = ''; try { t = instancias[a.id] && instancias[a.id].status ? instancias[a.id].status() || '' : ''; } catch (e) { t = ''; } statusTxt.textContent = t; }
    else if (!raiz.classList.contains('as-ocupado')) statusTxt.textContent = valorOuFuncao(op.status) || '';
  }
  const statusPadrao = () => { raiz.classList.remove('as-ocupado'); atualizarTopo(); };
  statusPadrao();
  const totalAbas = () => abas.reduce((n, a) => n + (contagens[a.id] || 0), 0);
  const atualizarSelo = () => {
    const n = est.naoLidas + totalAbas();
    selo.hidden = !n;
    selo.textContent = n > 9 ? '9+' : String(n || '');
    const partes = [est.naoLidas ? est.naoLidas + (est.naoLidas === 1 ? ' resposta nova' : ' respostas novas') : '',
      ...abas.filter(a => contagens[a.id]).map(a => contagens[a.id] + ' em ' + a.rotulo)].filter(Boolean);
    lancador.setAttribute('aria-label', (op.rotulo || op.nome) + (partes.length ? ' — ' + partes.join(', ') : ''));
    // o número de cada aba, na barra (o do assistente: as respostas que chegaram com outra aba na frente)
    barra.querySelectorAll('.as-aba').forEach(b => {
      const k = b.dataset.aba === 'assistente' ? est.naoLidas : contagens[b.dataset.aba] || 0;
      const el = b.querySelector('.as-aba-n'); el.hidden = !k; el.textContent = k > 99 ? '99+' : String(k || '');
    });
  };
  // "Conversa nova" também trava: a pergunta no ar continuaria rodando na função (e contando no limite do dia)
  const travar = sim => { enviarBtn.disabled = sim; novaBtn.disabled = sim; };

  // ---------- recado (o balãozinho ao lado da carinha) ----------
  function mostrarRecado({ html, chips = [], ms = 16000 }) {
    if (est.aberto) return false;
    clearTimeout(timerRecado);
    q('.as-recado-txt').innerHTML = html;
    const cx = recado.querySelector('.as-chips');
    cx.innerHTML = '';
    chips.forEach(c => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'as-chip' + (c.principal ? ' as-chip-acao' : ''); b.textContent = c.rotulo;
      b.onclick = () => { esconderRecado(); c.acao(); };
      cx.appendChild(b);
    });
    recado.hidden = false;
    recado.classList.remove('as-surge'); void recado.offsetWidth; recado.classList.add('as-surge');
    chamarAtencao();
    if (ms) timerRecado = setTimeout(() => { if (!recado.matches(':hover') && !recado.contains(document.activeElement)) esconderRecado(); }, ms);
    return true;
  }
  function esconderRecado() { clearTimeout(timerRecado); recado.hidden = true; }
  q('.as-recado-x').onclick = () => { esconderRecado(); lancador.focus({ preventScroll: true }); };
  // pergunta pronta do recado: abre e envia; com outra pergunta no ar, deixa na caixa
  const chipsDe = perguntas => (perguntas || []).map(p => ({ rotulo: p, acao: () => {
    mostrarAba('assistente');
    abrir();
    if (ocupado) { texto.value = p; ajustarAltura(); } else enviar(p);
  } }));
  // um recado da tela (o assistente do escritório: a saudação do dia, o que a tela tem de novo). Não aparece com o painel
  // aberto, com outro recado na tela ou com uma pergunta no ar; true = apareceu
  function avisar({ texto: t, html, exemplos, botoes, ms = 16000 } = {}) {
    if (est.aberto || ocupado || !recado.hidden) return false;
    const acoes = (botoes || []).filter(b => b && b.rotulo && typeof b.acao === 'function').map(b => ({ rotulo: b.rotulo, acao: b.acao, principal: true }));
    return mostrarRecado({ html: html || '<p>' + escapeHtml(t || '') + '</p>', chips: [...acoes, ...chipsDe(exemplos)], ms });
  }

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
    // o cartão da ação proposta entra depois (montarCartoes): aqui fica só o lugar dele
    const lugar = !erro && m.acao && m.id && op.cartao ? '<div class="as-cartao-lugar" data-msg="' + escapeHtml(m.id) + '"></div>' : '';
    return '<div class="as-msg ia' + (erro ? ' erro' : '') + n + '"><div class="as-resposta">' + (erro ? '<p>' + escapeHtml(m.texto) + '</p>' : op.formatar(m.texto)) + '</div>'
      + lugar + '<div class="as-meta"><time>' + hora(m.em) + '</time>' + consultas + '</div></div>';
  }
  // os cartões: um elemento por mensagem, guardado — redesenhar a conversa não perde o que a pessoa marcou nele
  const cartoes = new Map();
  function montarCartoes(dentro) {
    if (!op.cartao) return;
    dentro.querySelectorAll('.as-cartao-lugar').forEach(lugar => {
      const id = lugar.dataset.msg, m = est.msgs.find(x => x.id === id);
      if (!m || !m.acao) { lugar.remove(); return; }
      let el = cartoes.get(id);
      if (!el) {
        try {
          el = op.cartao(m.acao, { salvar: a => { const v = acaoValida(a); if (v) { m.acao = v; guardar(); } }, anunciar, reagir });
        } catch (e) { el = null; }
        if (!el) { lugar.remove(); return; }
        cartoes.set(id, el);
      }
      lugar.replaceWith(el);
    });
  }
  const htmlSaudacao = () => '<div class="as-msg ia as-saudacao"><div class="as-resposta">' + (valorOuFuncao(op.saudacao) || '') + '</div></div>';
  // as perguntas prontas: conversa nova, ou contexto diferente do da última pergunta → os exemplos do contexto de agora;
  // depois de uma resposta → as seguintes (menos as já feitas no mesmo contexto)
  function chipsDaConversa() {
    if (ocupado) return '';
    const atual = idDe(ctxAtual()), ultimaP = ultimaPergunta(), ultimo = est.msgs[est.msgs.length - 1];
    let lst = [];
    if (!ultimaP || ultimaP.ctxId !== atual) lst = op.exemplos ? op.exemplos(ctxAtual()) : [];
    else if (ultimo && ultimo.tipo === 'ia' && op.seguintes) {
      const feitas = new Set(est.msgs.filter(m => m.tipo === 'eu' && m.ctxId === atual).map(m => m.texto));
      lst = (op.seguintes(ctxAtual()) || []).filter(p => !feitas.has(p));
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
    montarCartoes(lista);
    desenharCauda();
    if (manterRolagem && !noFim) msgs.scrollTop = topo; else rolar();
  }
  function acrescentar(m) {
    const s = lista.querySelector('.as-saudacao'); if (s) s.remove();
    lista.insertAdjacentHTML('beforeend', htmlDaMsg(m, true));
    const el = lista.lastElementChild;
    montarCartoes(el);
    return el;
  }
  const atualizarDigitando = () => {
    const t = ultimaEtapa || 'Lendo a base…';
    const el = cauda.querySelector('.as-lendo'); if (el) el.textContent = t;
    if (abaAtual() === 'assistente') statusTxt.textContent = t;
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
    if (ctx) { ctxNome.textContent = ctx.nome || ''; ctxRot.textContent = ctx.rotulo || 'Sobre a ficha aberta'; }
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
    const naAssistente = abaAtual() === 'assistente';
    const tinhaNova = naAssistente && est.naoLidas > 0;
    esconderRecado();
    est.aberto = true; if (naAssistente) est.naoLidas = 0; guardar(); atualizarSelo();
    painel.hidden = false;
    raiz.classList.add('as-aberto');
    document.documentElement.classList.add('as-painel-aberto');
    lancador.setAttribute('aria-expanded', 'true');
    if (!naAssistente) { chamarAba(abaAtual(), 'aoMostrar', { foco: foco && !estreito() }); return; }
    ajustarAltura();
    const respostas = lista.querySelectorAll('.as-msg.ia:not(.as-saudacao)');
    if (tinhaNova && respostas.length) mostrarComeco(respostas[respostas.length - 1]); else rolar();
    // no celular, sem foco automático: o teclado subiria por cima da conversa
    if (foco && !estreito()) setTimeout(() => texto.focus({ preventScroll: true }), 30);
  }
  function fechar() {
    const tinhaFoco = raiz.contains(document.activeElement);
    if (abaAtual() !== 'assistente') chamarAba(abaAtual(), 'aoEsconder');
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
    cartoes.clear();
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
    else if (b.dataset.a === 'largo') { est.largo = !est.largo; guardar(); aplicarLargo(); rolar(); if (abaAtual() !== 'assistente') chamarAba(abaAtual(), 'aoMostrar', { foco: false }); }
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
  const agoraIso = () => new Date().toISOString();

  // "pensando": a carinha lê, o digitando aparece, enviar e conversa nova travam
  function comecarEspera(etapa) {
    ocupado = true; travar(true); ultimaEtapa = etapa || '';
    raiz.classList.add('as-pensando', 'as-ocupado');
    desenharCauda(); atualizarDigitando(); rolar();
  }
  // a resposta (ou o erro) entra na conversa; com o painel fechado, o selo e o recado "Respondi"
  function concluir({ t, cid, res, erro, etapas, devolver = true, em = '' }) {
    ocupado = false; travar(false);
    raiz.classList.remove('as-pensando'); statusPadrao();
    let el = null;
    if (res) {
      const nova = { tipo: 'ia', texto: res.texto, etapas: (etapas || []).slice(0, 20), em: agoraIso(), ctxId: cid };
      // a ação proposta vem junto: a mensagem ganha um id (o estado do cartão fica nela)
      const acao = acaoValida(res.acao), mid = acao ? novoId() : null;
      if (acao && mid) { nova.id = mid; nova.acao = acao; }
      est.msgs.push(nova); el = acrescentar(nova);
      if (res.cortada) { const n = { tipo: 'nota', texto: 'A resposta passou do tamanho máximo e foi cortada — peça a continuação.', em: agoraIso(), ctxId: cid }; est.msgs.push(n); acrescentar(n); }
      est.historico.push({ pergunta: t, resposta: res.texto, ctxId: cid, em: em || agoraIso() });
      sorrir();
      anunciar('Resposta: ' + primeiraFrase(res.texto));
    } else {
      const falha = { tipo: 'erro', texto: erro, em: agoraIso(), ctxId: cid };
      est.msgs.push(falha); el = acrescentar(falha);
      if (devolver && !texto.value.trim()) { texto.value = t; ajustarAltura(); }
      anunciar('Não consegui responder: ' + erro);
    }
    if (!est.aberto) {
      est.naoLidas++; atualizarSelo();
      mostrarRecado({ html: res ? '<p><b>Respondi.</b> ' + escapeHtml(primeiraFrase(res.texto)) + '</p>' : '<p><b>Não consegui responder.</b> ' + escapeHtml(erro) + '</p>',
        chips: [{ rotulo: 'Ver a resposta', acao: () => { mostrarAba('assistente'); abrir(); } }], ms: 30000 });
    } else if (abaAtual() !== 'assistente') { est.naoLidas++; atualizarSelo(); }
    guardar();
    desenharCauda();
    if (est.aberto) {
      mostrarComeco(el);
      if (res && !document.hidden) revelar(el.querySelector('.as-resposta'));
    }
  }

  async function enviar(pergunta) {
    const t = String(pergunta != null ? pergunta : texto.value).trim();
    if (!t || ocupado) return;
    const g = geracao, c = ctxAtual(), cid = idDe(c);
    if (!est.conversa) est.conversa = novoId();
    // a pergunta muda de contexto (outra ficha, ou nenhuma): uma nota marca a troca na conversa
    const anterior = ultimaPergunta();
    if ((anterior ? anterior.ctxId : null) !== cid) {
      const nota = { tipo: 'nota', texto: c ? (c.nota || 'Sobre a ficha de ') + (c.nome || '—') : 'Pergunta geral', em: agoraIso(), ctxId: cid };
      est.msgs.push(nota); acrescentar(nota);
    }
    const pedido = novoId();
    const eu = { tipo: 'eu', texto: t, em: agoraIso(), ctxId: cid, ...(pedido ? { pedido } : {}) };
    est.msgs.push(eu); acrescentar(eu);
    if (pergunta == null) { texto.value = ''; ajustarAltura(); }
    guardar();
    comecarEspera('');
    anunciar('Pergunta enviada. Consultando.');
    const etapas = [];
    let res = null, erro = null;
    try {
      // o histórico que vai junto é só o do mesmo contexto: a conversa sobre uma empresa não entra na de outra
      // com a hora de cada pergunta: a de outro dia vai marcada pra IA ("amanhã", dito ontem, não vira erro hoje)
      const historico = est.historico.filter(h => h.ctxId === cid).slice(-6).map(h => ({ pergunta: h.pergunta, resposta: h.resposta, ...(h.em ? { em: h.em } : {}) }));
      const corpo = { pergunta: t, historico, conversa: est.conversa, ...(pedido ? { pedido } : {}), contexto: (op.contexto ? op.contexto(c) : null) || {} };
      if (op.antes) await Promise.resolve().then(op.antes).catch(() => {});
      res = await op.perguntar(corpo, e => { if (g !== geracao) return; etapas.push(e); ultimaEtapa = e; atualizarDigitando(); });
    } catch (e) { erro = (e && e.message) || 'Erro no assistente.'; }
    if (g !== geracao) return;   // a conversa mudou enquanto esperava
    concluir({ t, cid, res, erro, etapas, em: eu.em });
  }

  // a página recarregou (trocou de tela) com uma pergunta no ar: busca a resposta pelo id da pergunta
  async function retomar(eu) {
    const g = geracao;
    comecarEspera('Terminando a resposta…');
    let res = null, erro = null;
    try {
      res = await op.retomar(eu.pedido, e => { if (g === geracao) { ultimaEtapa = e; atualizarDigitando(); } });
      if (!res) erro = 'A página mudou antes de a pergunta chegar. Pergunte de novo.';
    } catch (e) { erro = (e && e.message) || 'Erro no assistente.'; }
    if (g !== geracao) return;
    concluir({ t: eu.texto, cid: eu.ctxId, res, erro, devolver: true, em: eu.em });
  }

  // uma mensagem com o cartão de uma ação, sem passar pela IA (ex.: "Revisar as atrasadas", da saudação do dia); não entra
  // no histórico que vai pra IA. Com uma pergunta no ar, espera ela acabar
  function mostrarAcao({ texto: t, acao, abrirPainel = true } = {}) {
    const a = acaoValida(acao), mid = novoId();
    if (!a || !mid || ocupado) return false;
    const m = { tipo: 'ia', texto: String(t || ''), etapas: [], em: agoraIso(), ctxId: idDe(ctxAtual()), id: mid, acao: a };
    est.msgs.push(m);
    const el = acrescentar(m);
    guardar(); desenharCauda();
    if (abrirPainel) { mostrarAba('assistente'); if (!est.aberto) abrir(false); mostrarComeco(el); }
    else if (!est.aberto || abaAtual() !== 'assistente') { est.naoLidas++; atualizarSelo(); guardar(); }
    return true;
  }

  // ---------- as outras abas ----------
  function chamarAba(id, metodo, ...args) {
    const inst = instancias[id];
    if (!inst || typeof inst[metodo] !== 'function') return;
    try { inst[metodo](...args); } catch (e) { /* a aba com problema não derruba o painel */ }
  }
  // troca a aba da frente (a barra, o lugar de cada uma, o topo e o número de cada aba)
  function mostrarAba(id, { foco = false } = {}) {
    if (!abas.length) return;
    const destino = id === 'assistente' || abaDe(id) ? id : 'assistente';
    const antes = abaAtual();
    est.aba = destino;
    if (destino === 'assistente' && est.aberto) est.naoLidas = 0;
    guardar();
    barra.querySelectorAll('.as-aba').forEach(b => {
      const on = b.dataset.aba === destino;
      b.setAttribute('aria-selected', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1; b.classList.toggle('as-aba-atual', on);
    });
    painel.querySelectorAll('.as-vista').forEach(v => { v.hidden = v.dataset.aba !== destino; });
    novaBtn.hidden = destino !== 'assistente';
    raiz.classList.toggle('as-outra-aba', destino !== 'assistente');
    if (antes !== destino && antes !== 'assistente') chamarAba(antes, 'aoEsconder');
    atualizarTopo(); atualizarSelo();
    if (est.aberto) {
      if (destino === 'assistente') { desenharCauda(); rolar(); if (foco && !estreito()) setTimeout(() => texto.focus({ preventScroll: true }), 30); }
      else chamarAba(destino, 'aoMostrar', { foco });
    }
  }
  if (abas.length) {
    barra.hidden = false;
    barra.innerHTML = [{ id: 'assistente', rotulo: op.rotuloAba || 'Assistente' }, ...abas].map(a => '<button type="button" role="tab" class="as-aba" data-aba="' + a.id + '" id="as-aba-' + op.id + '-' + a.id
      + '" aria-controls="as-vista-' + op.id + '-' + a.id + '"><span>' + escapeHtml(a.rotulo) + '</span><span class="as-aba-n" hidden></span></button>').join('');
    q('.as-vista[data-aba="assistente"]').id = 'as-vista-' + op.id + '-assistente';
    barra.onclick = ev => { const b = ev.target.closest('.as-aba'); if (b) mostrarAba(b.dataset.aba, { foco: true }); };
    barra.addEventListener('keydown', ev => {
      if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
      const bs = [...barra.querySelectorAll('.as-aba')], i = bs.findIndex(b => b.dataset.aba === abaAtual());
      const prox = bs[(i + (ev.key === 'ArrowRight' ? 1 : bs.length - 1)) % bs.length];
      ev.preventDefault(); mostrarAba(prox.dataset.aba); prox.focus();
    });
    abas.forEach(a => {
      const lugar = document.createElement('div');
      lugar.className = 'as-vista'; lugar.dataset.aba = a.id; lugar.id = 'as-vista-' + op.id + '-' + a.id;
      lugar.setAttribute('role', 'tabpanel'); lugar.setAttribute('aria-labelledby', 'as-aba-' + op.id + '-' + a.id); lugar.hidden = true;
      painel.appendChild(lugar);
      const ctl = {
        ativa: () => est.aberto && abaAtual() === a.id,
        mostrar: (foco = true) => { mostrarAba(a.id); if (!est.aberto) abrir(foco); else chamarAba(a.id, 'aoMostrar', { foco }); },
        contador: n => { const v = Math.max(0, Math.round(Number(n) || 0)); if (contagens[a.id] !== v) { contagens[a.id] = v; atualizarSelo(); } },
        status: () => { if (abaAtual() === a.id) atualizarTopo(); },
        avisar: msg => avisar(msg),
        anunciar: t => anunciar(t),
        reagir: () => reagir(),
        largo: () => !!est.largo
      };
      contagens[a.id] = 0;
      try { instancias[a.id] = a.montar(lugar, ctl) || {}; } catch (e) { instancias[a.id] = {}; }
    });
    mostrarAba(abaAtual());
  }

  // ---------- começo ----------
  aplicarLargo();
  atualizarSelo();
  const ultima = est.msgs[est.msgs.length - 1];
  const pendente = ultima && ultima.tipo === 'eu' ? ultima : null;
  if (pendente && !(op.retomar && pendente.pedido)) {
    // sem como retomar: avisa e devolve a pergunta pra caixa
    est.msgs.push({ tipo: 'erro', texto: 'A página recarregou antes da resposta. Pergunte de novo.', em: agoraIso(), ctxId: pendente.ctxId });
    texto.value = pendente.texto;
    guardar();
  }
  desenharTudo();
  // o painel aberto continua aberto depois de recarregar — no computador; no celular ele cobriria a tela toda
  if (est.aberto) { if (estreito()) { est.aberto = false; guardar(); } else abrir(false); }
  if (pendente && op.retomar && pendente.pedido) retomar(pendente);
  // as fontes viram link quando os códigos chegam
  if (op.antes) Promise.resolve().then(op.antes).then(() => { if (est.msgs.some(m => m.tipo === 'ia')) desenharTudo({ manterRolagem: true }); }).catch(() => {});
  if (!est.recadoVisto && !est.msgs.length && !est.aberto && op.recado) {
    setTimeout(() => {
      if (est.aberto || est.msgs.length) return;
      est.recadoVisto = true; guardar();
      if (recado.hidden) mostrarRecado({ html: '<p>' + escapeHtml(op.recado.texto) + '</p>', chips: chipsDe(op.recado.exemplos) });
    }, 2500);
  }

  return { abrir, fechar, enviar, definirContexto, atualizar: desenharCauda, redesenhar: () => desenharTudo({ manterRolagem: true }), novaConversa, reagir, avisar, mostrarAcao, mostrarAba,
    get aberto() { return est.aberto; }, get ocupado() { return ocupado; }, get aba() { return abaAtual(); }, raiz };
}
