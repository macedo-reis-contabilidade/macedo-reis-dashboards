// ============================================================
// MACEDO & REIS — Assistente do escritório: os cartões das ações (14/10/2026)
// A função "assistente" não grava nada. Quando a pessoa pede pra concluir tarefas, remarcar, passar pra outra pessoa ou
// mudar a prioridade (16/10/2026), marcar boletos como pagos ou criar uma tarefa, a resposta traz a proposta ("acao") e
// este módulo desenha o cartão embaixo dela: o que vai mudar, lido de novo do banco (com caixas pra desmarcar e, no
// alterar, o antes e o depois de cada uma; ou o formulário curto da tarefa nova), o botão pra confirmar e, depois, o
// "Desfazer" (por 10 minutos). Quem grava é a tela, com o login da pessoa, pela mesma regra das telas
// (assets/js/tarefas-acoes.js).
// A revisão das atrasadas é o assistente perguntando o que já foi feito: grupo por grupo (as tarefas que mais se repetem
// primeiro; as avulsas juntas no fim) — "todas feitas", "escolher quais", "remarcar" (hoje, o próximo dia útil ou outra
// data) ou "ainda não". Começa pelo botão da saudação do dia, pelo recado da Agenda ou pela IA (quando pedem pra passar
// as atrasadas a limpo).
// Depois de mudar, avisa as telas abertas: "mr:feito" (a carinha comemora), "mr:tarefas-mudaram" (a Agenda e as telas de
// tarefas recarregam) e "mr:boletos-mudaram" (a grade de boletos troca a situação).
// O cartão do vigia (15/10/2026) mostra o que o vigia do sistema achou (assets/js/vigia.js), por grupo, com "Abrir" (a
// tela onde se resolve) e "Ignorar" (com "Desfazer" por 10 minutos; os ignorados voltam pela aba "Ignorados").
// Testes de tela: tests/harness/assistente-acoes.py e tests/harness/assistente-vigia.py.
// ============================================================

import { supabase } from './supabase.js';
import { concluirTarefas, desfazerConclusao, marcarPagos, desfazerPagos, criarTarefasAvulsas, excluirTarefasCriadas,
  alterarTarefas, desfazerAlteracao, limparMudanca, mudancaDe, fichaDeOrigem, ficaDeFora } from './tarefas-acoes.js';
import { EQUIPE, SOCIOS, nomePorEmail } from './equipe.js';
import { SETORES } from './nova-tarefa.js';
import { lerAchados, ignorarAchado, reabrirAchado, filtrarAchados, agruparAchados, linkSeguro, ehSocioPeloNome, marcarVisto } from './vigia.js';

const RAIZ = new URL('../../', import.meta.url);   // a raiz do site (este arquivo mora em assets/js/)
const PRAZO_DESFAZER = 10 * 60e3;   // o "Desfazer" vale por 10 minutos
const pad = n => String(n).padStart(2, '0');
const hojeISO = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const dataBR = iso => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : 'sem prazo');
const mesBR = comp => (comp ? String(comp).slice(5, 7) + '/' + String(comp).slice(0, 4) : '—');
const brl = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const qtd = (n, um, varios) => n + ' ' + (n === 1 ? um : varios);
const normal = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const SITUACAO_BOLETO = { a_emitir: 'a emitir', emitido: 'emitido', enviado: 'enviado', pago: 'pago', cancelado: 'cancelado' };
const podeDesfazer = em => !!em && Date.now() - new Date(em).getTime() < PRAZO_DESFAZER;
const avisarTelas = (nome, detail) => { try { window.dispatchEvent(new CustomEvent(nome, { detail })); } catch (e) { /* fora do navegador */ } };
const ID = /^[0-9a-z-]{1,64}$/i;
const idsDe = v => [...new Set((Array.isArray(v) ? v : []).map(String).filter(x => ID.test(x)))];

// h(tag, props, ...filhos): um elemento com texto seguro (textContent); props: class, text, on<evento>, as propriedades
// checked/disabled/value/type e o resto como atributo
function h(tag, props = {}, ...filhos) {
  const el = document.createElement(tag);
  Object.entries(props || {}).forEach(([k, v]) => {
    if (v == null || v === false) return;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (['checked', 'disabled', 'value', 'type', 'selected'].includes(k)) el[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  });
  filhos.flat().forEach(f => { if (f != null && f !== false) el.append(f instanceof Node ? f : document.createTextNode(String(f))); });
  return el;
}
const botao = (rotulo, aoClicar, tipo = '') => h('button', { type: 'button', class: 'as-botao' + (tipo ? ' as-botao-' + tipo : ''), text: rotulo, onclick: aoClicar });
const sub = texto => h('div', { class: 'as-cartao-sub', text: texto });
// redesenhar sem perder o lugar do teclado: quem estava com o foco no cartão continua nele (no primeiro botão)
function trocar(raiz, ...filhos) {
  const tinhaFoco = raiz.contains(document.activeElement);
  raiz.replaceChildren(...filhos.flat().filter(Boolean));
  if (tinhaFoco) { const b = raiz.querySelector('button:not([disabled]), input, select'); if (b) b.focus({ preventScroll: true }); }
}

// os nomes das empresas (o cadastro), em lotes
async function nomesDe(ids) {
  const lista = [...new Set(ids.filter(Boolean).map(String))];
  const mapa = new Map();
  for (let i = 0; i < lista.length; i += 100) {
    const { data, error } = await supabase.from('clientes').select('id, nome_principal').in('id', lista.slice(i, i + 100));
    if (error) throw new Error(error.message);
    (data || []).forEach(c => mapa.set(String(c.id), c.nome_principal));
  }
  return mapa;
}
async function lerPorIds(tabela, colunas, ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabase.from(tabela).select(colunas).in('id', ids.slice(i, i + 100));
    if (error) throw new Error(error.message);
    out.push(...(data || []));
  }
  return out;
}

// a lista com caixas (o que vai mudar). itens: [{ id, titulo, sub, tag }]
function listaComCaixas(itens, { marcadas = true, aoMudar = () => {} } = {}) {
  const caixas = [];
  const ul = h('ul', { class: 'as-cartao-lista' }, itens.map(it => {
    const cx = h('input', { type: 'checkbox', checked: marcadas, onchange: aoMudar });
    cx.dataset.id = it.id;
    caixas.push(cx);
    return h('li', {}, h('label', { class: 'as-cartao-item' }, cx,
      h('span', {}, h('b', {}, it.titulo, it.tag ? h('span', { class: 'as-tag', text: it.tag }) : null), it.sub ? h('small', { text: it.sub }) : null)));
  }));
  return { el: ul, marcadas: () => caixas.filter(c => c.checked).map(c => c.dataset.id), todas: v => { caixas.forEach(c => { c.checked = v; }); aoMudar(); } };
}
// "marcar todas" / "desmarcar todas", pra listas maiores
function alternarTodas(lista, n) {
  if (n < 4) return null;
  let todas = true;
  const b = botao('Desmarcar todas', () => { todas = !todas; lista.todas(todas); b.textContent = todas ? 'Desmarcar todas' : 'Marcar todas'; }, 'link');
  return b;
}

// a tarefa numa linha: título, empresa, prazo e quem
const itemTarefa = (t, nomes) => ({ id: String(t.id), titulo: t.titulo || 'Sem título', tag: t.faturavel ? 'cobrável' : '',
  sub: [t.cliente_id ? nomes.get(String(t.cliente_id)) || 'empresa' : '', 'prazo ' + dataBR(t.prazo), t.responsavel || 'sem responsável'].filter(Boolean).join(' · ') });
const resumoConcluidas = r => (r.concluidas || []).map(c => ({ id: c.id, status_antes: c.status_antes, faturavel: !!c.faturavel }));

// ============================================================
// cartaoDaAcao(acao, ajuda) → Element | null
//   ajuda: { salvar(acao), anunciar(texto), reagir(), email, nome } — salvar guarda o estado do cartão na conversa
// ============================================================
export function cartaoDaAcao(acao, ajuda = {}) {
  const fazer = { concluir_tarefas: cartaoConcluir, alterar_tarefas: cartaoAlterar, marcar_pago: cartaoPago, criar_tarefa: cartaoCriar, revisar_atrasadas: cartaoRevisao, vigia: cartaoVigia }[acao && acao.tipo];
  if (!fazer) return null;
  const raiz = h('div', { class: 'as-cartao', role: 'group' });
  const estado = { ...acao };
  const salvar = mudanca => { Object.assign(estado, mudanca); try { ajuda.salvar && ajuda.salvar({ ...estado }); } catch (e) { /* sem onde guardar */ } };
  const ctx = { raiz, estado, salvar, ajuda, anunciar: t => { try { ajuda.anunciar && ajuda.anunciar(t); } catch (e) { /* sem leitor */ } } };
  fazer(ctx);
  return raiz;
}

// ---------- concluir tarefas ----------
function cartaoConcluir({ raiz, estado, salvar, ajuda, anunciar }) {
  raiz.setAttribute('aria-label', 'Concluir tarefas');
  const ids = idsDe(estado.ids).slice(0, 300);
  async function desenhar() {
    if (estado.estado === 'feita') return desenharFeita();
    if (estado.estado === 'cancelada') return trocar(raiz, sub('Deixei como estava.'));
    if (estado.estado === 'desfeita') return desenharDesfeita();
    trocar(raiz, sub('Lendo as tarefas…'));
    let tarefas, nomes;
    try {
      tarefas = (await lerPorIds('tarefas', 'id, titulo, prazo, responsavel, status, faturavel, cliente_id', ids)).filter(t => t.status !== 'concluida');
      nomes = await nomesDe(tarefas.map(t => t.cliente_id));
    } catch (e) { return trocar(raiz, h('div', { class: 'as-cartao-erro', text: 'Não consegui ler as tarefas agora.' }), h('div', { class: 'as-cartao-botoes' }, botao('Tentar de novo', desenhar))); }
    if (!tarefas.length) return trocar(raiz, sub(ids.length === 1 ? 'Essa tarefa já está concluída.' : 'Essas tarefas já estão concluídas.'));
    tarefas.sort((a, b) => String(a.prazo || '9').localeCompare(String(b.prazo || '9')));
    const tit = h('div', { class: 'as-cartao-tit' });
    const erro = h('div', { class: 'as-cartao-erro', hidden: true });
    const ok = botao('Concluir', () => confirmar(lista.marcadas(), ok, nao, erro), 'pri');
    const nao = botao('Agora não', () => { salvar({ estado: 'cancelada' }); desenhar(); });
    const atualizar = () => { const n = lista.marcadas().length; tit.textContent = 'Concluir ' + qtd(tarefas.length, 'tarefa', 'tarefas') + '?'; ok.textContent = n ? 'Concluir ' + n : 'Concluir'; ok.disabled = !n; };
    const lista = listaComCaixas(tarefas.map(t => itemTarefa(t, nomes)), { aoMudar: () => atualizar() });
    atualizar();
    const faltam = ids.length - tarefas.length;
    trocar(raiz, tit, faltam > 0 ? sub(qtd(faltam, 'outra já estava concluída', 'outras já estavam concluídas') + '.') : null, lista.el,
      h('div', { class: 'as-cartao-botoes' }, ok, nao, alternarTodas(lista, tarefas.length)), erro);
  }
  async function confirmar(marcados, ok, nao, erro) {
    if (!marcados.length) return;
    ok.disabled = true; nao.disabled = true; ok.textContent = 'Concluindo…'; erro.hidden = true;
    const r = await concluirTarefas(supabase, marcados, { autor: ajuda.email || null, historico: 'Tarefa concluída pelo assistente do escritório.' });
    if (r.erro && !r.concluidas.length) { erro.textContent = 'Não consegui concluir: ' + r.erro; erro.hidden = false; ok.disabled = false; nao.disabled = false; ok.textContent = 'Concluir ' + marcados.length; return; }
    salvar({ estado: 'feita', resultado: { concluidas: resumoConcluidas(r), ja: r.jaEstavam.length, semHistorico: !!r.semHistorico, em: new Date().toISOString() } });
    if (r.concluidas.length) { avisarTelas('mr:feito', { n: r.concluidas.length }); avisarTelas('mr:tarefas-mudaram', { ids: r.concluidas.map(c => c.id) }); }
    anunciar(qtd(r.concluidas.length, 'tarefa concluída', 'tarefas concluídas') + '.');
    desenhar();
  }
  function desenharFeita() {
    const r = estado.resultado || {};
    const n = (r.concluidas || []).length;
    const linha = h('div', { class: 'as-cartao-feito' }, h('span', { class: 'as-cartao-ok', text: '✓ ' + (n ? qtd(n, 'tarefa concluída', 'tarefas concluídas') : 'Nada foi concluído') + '.' }));
    if (r.ja) linha.append(h('span', { class: 'as-cartao-sub', text: qtd(r.ja, 'já estava concluída', 'já estavam concluídas') + ' antes.' }));
    if (r.semHistorico) linha.append(h('span', { class: 'as-cartao-aviso', text: 'A linha no histórico não foi gravada.' }));
    if ((r.concluidas || []).some(c => !c.faturavel) && podeDesfazer(r.em)) linha.append(botao('Desfazer', desfazer, 'link'));
    trocar(raiz, linha);
  }
  async function desfazer(ev) {
    const b = ev.currentTarget, r = estado.resultado || {};
    if (!podeDesfazer(r.em)) { trocar(raiz, sub('Passou o tempo de desfazer por aqui: reabra a tarefa na Agenda ou na tela do setor.')); return; }
    b.disabled = true; b.textContent = 'Desfazendo…';
    const d = await desfazerConclusao(supabase, r.concluidas || [], { autor: ajuda.email || null, historico: 'Conclusão desfeita no assistente do escritório.' });
    if (d.erro && !d.desfeitas.length) { b.disabled = false; b.textContent = 'Desfazer'; raiz.append(h('div', { class: 'as-cartao-erro', text: 'Não consegui desfazer: ' + d.erro })); return; }
    salvar({ estado: 'desfeita', desfeito: { n: d.desfeitas.length, ficaram: d.ficaram.length } });
    if (d.desfeitas.length) avisarTelas('mr:tarefas-mudaram', { ids: d.desfeitas });
    anunciar('Desfeito.');
    desenhar();
  }
  function desenharDesfeita() {
    const d = estado.desfeito || {};
    trocar(raiz, h('div', { class: 'as-cartao-feito' }, h('span', { text: '↺ Desfeito: ' + qtd(d.n || 0, 'tarefa reaberta', 'tarefas reabertas') + '.' }),
      d.ficaram ? h('span', { class: 'as-cartao-sub', text: qtd(d.ficaram, 'ficou concluída', 'ficaram concluídas') + ' (cobrável, ou concluída de novo por outra pessoa): reabra na tela de tarefas do setor.' }) : null));
  }
  desenhar();
}

// ---------- remarcar, passar pra outra pessoa, mudar a prioridade (16/10/2026) ----------
// A proposta diz quais (ids) e o que muda (mudar: prazo, responsável, prioridade); o cartão lê de novo, mostra o antes e o
// depois de cada uma e deixa de fora a concluída, a que já está assim e, quando muda o prazo ou o responsável, a da ficha
// de origem (admissão, rescisão, alvará: o banco refaz os dois a partir da ficha; a prioridade, não)
const ORIGEM = 'assistente do escritório';
const PRIORIDADE_TXT = { alta: 'alta', media: 'média', baixa: 'baixa' };
const RESPONSAVEIS = [...EQUIPE, 'Ambos'];
const DIA_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
// o que a proposta pede, conferido: prazo de verdade, responsável da equipe (ou "Ambos"), prioridade da lista
function mudancaDaAcao(m) {
  const x = limparMudanca(m);
  if (!x) return null;
  if (x.responsavel) { const n = RESPONSAVEIS.find(r => normal(r) === normal(x.responsavel)); if (n) x.responsavel = n; else delete x.responsavel; }
  return Object.keys(x).length ? x : null;
}
const soMuda = (m, campo) => Object.keys(m).length === 1 && campo in m;
// "sábado, 17/10/2026": com o dia da semana, o "amanhã" que cai no fim de semana não passa batido
const comSemana = iso => { const d = new Date(String(iso).slice(0, 10) + 'T12:00:00'); return isNaN(d) ? dataBR(iso) : DIA_SEMANA[d.getDay()] + ', ' + dataBR(iso); };
const verboAlterar = m => (soMuda(m, 'prazo') ? 'Remarcar' : soMuda(m, 'responsavel') ? 'Passar' : 'Alterar');
const resumoMudanca = m => [m.prazo ? 'prazo → ' + comSemana(m.prazo) : null, m.responsavel ? 'responsável → ' + m.responsavel : null,
  m.prioridade ? 'prioridade → ' + PRIORIDADE_TXT[m.prioridade] : null].filter(Boolean).join(' · ');
function tituloAlterar(m, n) {
  const t = qtd(n, 'tarefa', 'tarefas');
  if (soMuda(m, 'prazo')) return 'Remarcar ' + t + ' pra ' + comSemana(m.prazo) + '?';
  if (soMuda(m, 'responsavel')) return 'Passar ' + t + ' pra ' + m.responsavel + '?';
  if (soMuda(m, 'prioridade')) return 'Mudar a prioridade de ' + t + ' pra ' + PRIORIDADE_TXT[m.prioridade] + '?';
  return 'Alterar ' + t + '?';
}
function feitoAlterar(m, n) {
  if (soMuda(m, 'prazo')) return qtd(n, 'tarefa remarcada', 'tarefas remarcadas') + ' pra ' + comSemana(m.prazo);
  if (soMuda(m, 'responsavel')) return qtd(n, 'tarefa passada', 'tarefas passadas') + ' pra ' + m.responsavel;
  if (soMuda(m, 'prioridade')) return qtd(n, 'tarefa', 'tarefas') + ' com prioridade ' + PRIORIDADE_TXT[m.prioridade];
  return qtd(n, 'tarefa alterada', 'tarefas alteradas') + ' (' + resumoMudanca(m) + ')';
}
// a tarefa com o antes e o depois do que muda nela (o resto como está)
function itemAlterar(t, d, nomes) {
  const prazo = 'prazo' in d ? 'prazo ' + (t.prazo ? dataBR(t.prazo) : 'sem prazo') + ' → ' + dataBR(d.prazo) : 'prazo ' + dataBR(t.prazo);
  const quem = 'responsavel' in d ? (t.responsavel || 'sem responsável') + ' → ' + d.responsavel : t.responsavel || 'sem responsável';
  const prio = 'prioridade' in d ? 'prioridade ' + (PRIORIDADE_TXT[t.prioridade] || t.prioridade || '—') + ' → ' + PRIORIDADE_TXT[d.prioridade] : '';
  return { id: String(t.id), titulo: t.titulo || 'Sem título', sub: [t.cliente_id ? nomes.get(String(t.cliente_id)) || 'empresa' : '', prazo, quem, prio].filter(Boolean).join(' · ') };
}
// "1 é de admissão e fica de fora: o prazo e o responsável dela vêm da ficha (tela Admissões)"
function avisoDaFicha(lista) {
  if (!lista.length) return null;
  const um = lista.length === 1;
  const nomes = [...new Set(lista.map(t => fichaDeOrigem(t).nome))], telas = [...new Set(lista.map(t => fichaDeOrigem(t).tela))];
  return lista.length + (um ? ' é de ' : ' são de ') + nomes.join(', ') + (um ? ' e fica' : ' e ficam') + ' de fora: o prazo e o responsável ' + (um ? 'dela' : 'delas')
    + ' vêm da ficha (tela ' + telas.join(', ') + ')';
}
// o que fica guardado pra desfazer (curto: a conversa guarda o cartão)
const resumoAlteradas = r => (r.alteradas || []).map(a => ({ id: a.id, antes: a.antes, depois: a.depois }));

function cartaoAlterar({ raiz, estado, salvar, ajuda, anunciar }) {
  raiz.setAttribute('aria-label', 'Alterar tarefas');
  const mudar = mudancaDaAcao(estado.mudar);
  const ids = idsDe(estado.ids).slice(0, 300);
  async function desenhar() {
    if (!mudar) return trocar(raiz, sub('Não entendi o que mudar nessas tarefas: peça de novo, com o prazo, o responsável ou a prioridade.'));
    if (estado.estado === 'feita') return desenharFeita();
    if (estado.estado === 'cancelada') return trocar(raiz, sub('Deixei como estava.'));
    if (estado.estado === 'desfeita') return desenharDesfeita();
    trocar(raiz, sub('Lendo as tarefas…'));
    let tarefas, nomes;
    try {
      tarefas = (await lerPorIds('tarefas', 'id, titulo, prazo, responsavel, prioridade, status, cliente_id, admissao_id, rescisao_id, alvara_id', ids)).filter(t => t.status !== 'concluida');
      nomes = await nomesDe(tarefas.map(t => t.cliente_id));
    } catch (e) { return trocar(raiz, h('div', { class: 'as-cartao-erro', text: 'Não consegui ler as tarefas agora.' }), h('div', { class: 'as-cartao-botoes' }, botao('Tentar de novo', desenhar))); }
    const daFicha = tarefas.filter(t => ficaDeFora(t, mudar));
    const mudam = tarefas.filter(t => !ficaDeFora(t, mudar)).map(t => ({ t, d: mudancaDe(t, mudar) })).filter(x => x.d)
      .sort((a, b) => String(a.t.prazo || '9').localeCompare(String(b.t.prazo || '9')));
    const fechadas = ids.length - tarefas.length, iguais = tarefas.length - daFicha.length - mudam.length;
    const avisos = [fechadas ? qtd(fechadas, 'já foi concluída', 'já foram concluídas') : null, iguais ? qtd(iguais, 'já está assim', 'já estão assim') : null, avisoDaFicha(daFicha)].filter(Boolean);
    if (!mudam.length) return trocar(raiz, sub('Nada a mudar' + (avisos.length ? ': ' + avisos.join('; ') : '') + '.'));
    const verbo = verboAlterar(mudar);
    const tit = h('div', { class: 'as-cartao-tit', text: tituloAlterar(mudar, mudam.length) });
    const erro = h('div', { class: 'as-cartao-erro', hidden: true });
    const ok = botao(verbo, () => confirmar(lista.marcadas(), ok, nao, erro), 'pri');
    const nao = botao('Agora não', () => { salvar({ estado: 'cancelada' }); desenhar(); });
    const atualizar = () => { const n = lista.marcadas().length; ok.textContent = n ? verbo + ' ' + n : verbo; ok.disabled = !n; };
    const lista = listaComCaixas(mudam.map(x => itemAlterar(x.t, x.d, nomes)), { aoMudar: () => atualizar() });
    atualizar();
    trocar(raiz, tit, Object.keys(mudar).length > 1 ? sub(resumoMudanca(mudar)) : null, avisos.length ? sub(avisos.join('. ') + '.') : null, lista.el,
      h('div', { class: 'as-cartao-botoes' }, ok, nao, alternarTodas(lista, mudam.length)), erro);
  }
  async function confirmar(marcados, ok, nao, erro) {
    if (!marcados.length) return;
    const verbo = verboAlterar(mudar);
    ok.disabled = true; nao.disabled = true; ok.textContent = 'Gravando…'; erro.hidden = true;
    const r = await alterarTarefas(supabase, marcados, mudar, { autor: ajuda.email || null, origem: ORIGEM });
    if (r.erro && !r.alteradas.length) { erro.textContent = 'Não consegui gravar: ' + r.erro; erro.hidden = false; ok.disabled = false; nao.disabled = false; ok.textContent = verbo + ' ' + marcados.length; return; }
    // os ids saem do estado (o resultado já diz quais mudaram): a conversa guarda o cartão, e 300 tarefas com o antes e o
    // depois de três campos passariam do tamanho que ela aceita
    salvar({ estado: 'feita', ids: [], resultado: { alteradas: resumoAlteradas(r), ficaram: r.fechadas.length + r.iguais.length + r.daFicha.length, semHistorico: !!r.semHistorico, em: new Date().toISOString() } });
    if (r.alteradas.length) avisarTelas('mr:tarefas-mudaram', { ids: r.alteradas.map(a => a.id) });
    anunciar(feitoAlterar(mudar, r.alteradas.length) + '.');
    desenhar();
  }
  function desenharFeita() {
    const r = estado.resultado || {};
    const n = (r.alteradas || []).length;
    const linha = h('div', { class: 'as-cartao-feito' }, h('span', { class: 'as-cartao-ok', text: '✓ ' + (n ? feitoAlterar(mudar, n) : 'Nada mudou') + '.' }));
    if (r.ficaram) linha.append(h('span', { class: 'as-cartao-sub', text: qtd(r.ficaram, 'ficou como estava', 'ficaram como estavam') + ' (concluída ou mudada no meio do caminho).' }));
    if (r.semHistorico) linha.append(h('span', { class: 'as-cartao-aviso', text: 'A linha no histórico não foi gravada.' }));
    if (n && podeDesfazer(r.em)) linha.append(botao('Desfazer', desfazer, 'link'));
    trocar(raiz, linha);
  }
  async function desfazer(ev) {
    const b = ev.currentTarget, r = estado.resultado || {};
    if (!podeDesfazer(r.em)) { trocar(raiz, sub('Passou o tempo de desfazer por aqui: mude a tarefa na Agenda ou na tela do setor.')); return; }
    b.disabled = true; b.textContent = 'Desfazendo…';
    const d = await desfazerAlteracao(supabase, r.alteradas || [], { autor: ajuda.email || null, origem: ORIGEM });
    if (d.erro && !d.desfeitas.length) { b.disabled = false; b.textContent = 'Desfazer'; raiz.append(h('div', { class: 'as-cartao-erro', text: 'Não consegui desfazer: ' + d.erro })); return; }
    salvar({ estado: 'desfeita', desfeito: { n: d.desfeitas.length, ficaram: d.ficaram.length } });
    if (d.desfeitas.length) avisarTelas('mr:tarefas-mudaram', { ids: d.desfeitas });
    anunciar('Desfeito.');
    desenhar();
  }
  function desenharDesfeita() {
    const d = estado.desfeito || {};
    trocar(raiz, h('div', { class: 'as-cartao-feito' }, h('span', { text: '↺ Desfeito: ' + qtd(d.n || 0, 'tarefa voltou como era', 'tarefas voltaram como eram') + '.' }),
      d.ficaram ? h('span', { class: 'as-cartao-sub', text: qtd(d.ficaram, 'mudou de novo depois (ou foi concluída) e ficou como está', 'mudaram de novo depois (ou foram concluídas) e ficaram como estão') + '.' }) : null));
  }
  desenhar();
}

// o próximo dia útil (sem sábado e domingo) e o nome dele no botão: "Amanhã" ou "Segunda, 19/10"
function proximoDiaUtil(iso) {
  const d = new Date(iso + 'T12:00:00');
  do d.setDate(d.getDate() + 1); while (d.getDay() === 0 || d.getDay() === 6);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}
function rotuloDia(iso, hoje) {
  const d = new Date(iso + 'T12:00:00'), h0 = new Date(hoje + 'T12:00:00');
  if (Math.round((d - h0) / 864e5) === 1) return 'Amanhã';
  const n = DIA_SEMANA[d.getDay()];
  return n.charAt(0).toUpperCase() + n.slice(1) + ', ' + pad(d.getDate()) + '/' + pad(d.getMonth() + 1);
}

// ---------- marcar boletos como pagos ----------
function cartaoPago({ raiz, estado, salvar, anunciar }) {
  raiz.setAttribute('aria-label', 'Marcar boletos como pagos');
  const ids = idsDe(estado.ids).slice(0, 100);
  const mudou = mudancas => avisarTelas('mr:boletos-mudaram', { mudancas });
  async function desenhar() {
    if (estado.estado === 'feita') return desenharFeita();
    if (estado.estado === 'cancelada') return trocar(raiz, sub('Deixei como estava.'));
    if (estado.estado === 'desfeita') return trocar(raiz, h('span', { text: '↺ Desfeito: ' + qtd((estado.desfeito || {}).n || 0, 'boleto voltou', 'boletos voltaram') + ' pra situação de antes.' }));
    trocar(raiz, sub('Lendo os boletos…'));
    let boletos, nomes;
    try {
      boletos = (await lerPorIds('cobrancas_mensais', 'id, cliente_id, competencia, valor, vencimento, status', ids)).filter(b => !['pago', 'cancelado'].includes(b.status));
      nomes = await nomesDe(boletos.map(b => b.cliente_id));
    } catch (e) { return trocar(raiz, h('div', { class: 'as-cartao-erro', text: 'Não consegui ler os boletos agora.' }), h('div', { class: 'as-cartao-botoes' }, botao('Tentar de novo', desenhar))); }
    if (!boletos.length) return trocar(raiz, sub(ids.length === 1 ? 'Esse boleto já está pago (ou cancelado).' : 'Esses boletos já estão pagos (ou cancelados).'));
    const tit = h('div', { class: 'as-cartao-tit' });
    const erro = h('div', { class: 'as-cartao-erro', hidden: true });
    const ok = botao('Marcar como pago', () => confirmar(lista.marcadas(), ok, nao, erro), 'pri');
    const nao = botao('Agora não', () => { salvar({ estado: 'cancelada' }); desenhar(); });
    const atualizar = () => { const n = lista.marcadas().length; tit.textContent = 'Marcar ' + qtd(boletos.length, 'boleto', 'boletos') + ' como pago?'; ok.textContent = n > 1 ? 'Marcar ' + n + ' como pagos' : 'Marcar como pago'; ok.disabled = !n; };
    const lista = listaComCaixas(boletos.map(b => ({ id: String(b.id), titulo: nomes.get(String(b.cliente_id)) || 'empresa',
      sub: 'competência ' + mesBR(b.competencia) + ' · ' + brl(b.valor) + ' · vence ' + dataBR(b.vencimento) + ' · ' + (SITUACAO_BOLETO[b.status] || b.status) })), { aoMudar: () => atualizar() });
    atualizar();
    trocar(raiz, tit, lista.el, h('div', { class: 'as-cartao-botoes' }, ok, nao, alternarTodas(lista, boletos.length)), erro);
  }
  async function confirmar(marcados, ok, nao, erro) {
    if (!marcados.length) return;
    ok.disabled = true; nao.disabled = true; ok.textContent = 'Marcando…'; erro.hidden = true;
    const r = await marcarPagos(supabase, marcados);
    if (r.erro && !r.pagos.length) { erro.textContent = 'Não consegui marcar: ' + r.erro; erro.hidden = false; ok.disabled = false; nao.disabled = false; ok.textContent = 'Marcar como pago'; return; }
    salvar({ estado: 'feita', resultado: { pagos: r.pagos, ja: r.jaEstavam.length, em: new Date().toISOString() } });
    if (r.pagos.length) mudou(r.pagos.map(p => ({ id: p.id, status: 'pago' })));
    anunciar(qtd(r.pagos.length, 'boleto marcado', 'boletos marcados') + ' como pago.');
    desenhar();
  }
  function desenharFeita() {
    const r = estado.resultado || {};
    const n = (r.pagos || []).length;
    const linha = h('div', { class: 'as-cartao-feito' }, h('span', { class: 'as-cartao-ok', text: '✓ ' + (n ? qtd(n, 'boleto marcado', 'boletos marcados') + ' como pago' : 'Nenhum boleto mudou') + '.' }));
    if (r.ja) linha.append(h('span', { class: 'as-cartao-sub', text: qtd(r.ja, 'já estava pago ou cancelado', 'já estavam pagos ou cancelados') + '.' }));
    if (n && podeDesfazer(r.em)) linha.append(botao('Desfazer', desfazer, 'link'));
    trocar(raiz, linha);
  }
  async function desfazer(ev) {
    const b = ev.currentTarget, r = estado.resultado || {};
    if (!podeDesfazer(r.em)) { trocar(raiz, sub('Passou o tempo de desfazer por aqui: troque a situação na tela Boletos.')); return; }
    b.disabled = true; b.textContent = 'Desfazendo…';
    const d = await desfazerPagos(supabase, r.pagos || []);
    if (d.erro && !d.desfeitos.length) { b.disabled = false; b.textContent = 'Desfazer'; raiz.append(h('div', { class: 'as-cartao-erro', text: 'Não consegui desfazer: ' + d.erro })); return; }
    salvar({ estado: 'desfeita', desfeito: { n: d.desfeitos.length } });
    const antes = new Map((r.pagos || []).map(p => [p.id, p.status_antes]));
    if (d.desfeitos.length) mudou(d.desfeitos.map(id => ({ id, status: antes.get(id) || 'enviado' })));
    anunciar('Desfeito.');
    desenhar();
  }
  desenhar();
}

// ---------- criar uma tarefa ----------
function cartaoCriar({ raiz, estado, salvar, ajuda, anunciar }) {
  raiz.setAttribute('aria-label', 'Criar tarefa');
  const t = estado.tarefa && typeof estado.tarefa === 'object' ? estado.tarefa : {};
  const empresa = t.empresa && t.empresa.id ? { id: String(t.empresa.id), nome: String(t.empresa.nome || 'empresa') } : null;
  let semEmpresa = false;
  function desenhar() {
    if (estado.estado === 'feita') return desenharFeita();
    if (estado.estado === 'cancelada') return trocar(raiz, sub('Deixei como estava.'));
    if (estado.estado === 'desfeita') return trocar(raiz, h('span', { text: (estado.desfeito || {}).n ? '↺ Desfeito: a tarefa foi apagada.' : 'A tarefa já tinha mudado (alguém mexeu nela) e ficou.' }));
    const campo = (rotulo, el, largo) => h('label', { class: 'as-cartao-campo' + (largo ? ' largo' : '') }, rotulo, el);
    const titulo = h('input', { type: 'text', value: String(t.titulo || ''), maxlength: '200', 'aria-required': 'true' });
    const resp = h('select', {}, h('option', { value: '', text: '— ninguém ainda —' }), EQUIPE.map(n => h('option', { value: n, text: n })));
    resp.value = EQUIPE.includes(t.responsavel) ? t.responsavel : '';
    const prazo = h('input', { type: 'date', value: /^\d{4}-\d{2}-\d{2}$/.test(String(t.prazo || '')) ? t.prazo : hojeISO() });
    const prio = h('select', {}, [['media', 'Média'], ['alta', 'Alta'], ['baixa', 'Baixa']].map(([v, r]) => h('option', { value: v, text: r })));
    prio.value = ['alta', 'media', 'baixa'].includes(t.prioridade) ? t.prioridade : 'media';
    const setor = h('select', {}, SETORES.map(([v, r]) => h('option', { value: v, text: r })));
    setor.value = SETORES.some(([v]) => v === t.setor) ? t.setor : 'geral';
    const desc = t.descricao ? h('textarea', { rows: '2', maxlength: '1000' }) : null;
    if (desc) desc.value = String(t.descricao);
    const chip = empresa && !semEmpresa ? h('div', { class: 'as-cartao-sub' }, 'Empresa: ', h('b', { text: empresa.nome }), ' ', botao('tirar', () => { semEmpresa = true; desenhar(); }, 'link')) : null;
    const erro = h('div', { class: 'as-cartao-erro', hidden: true });
    const ok = botao('Criar tarefa', criar, 'pri');
    const nao = botao('Agora não', () => { salvar({ estado: 'cancelada' }); desenhar(); });
    async function criar() {
      const tt = titulo.value.replace(/\s+/g, ' ').trim();
      if (!tt) { erro.textContent = 'Dê um nome pra tarefa.'; erro.hidden = false; titulo.focus(); return; }
      ok.disabled = true; nao.disabled = true; ok.textContent = 'Criando…'; erro.hidden = true;
      const dados = { titulo: tt, responsavel: resp.value || null, prazo: prazo.value || null, prioridade: prio.value, setor: setor.value, descricao: desc ? (desc.value.trim() || null) : null };
      const r = await criarTarefasAvulsas(supabase, { ...dados, clientes: empresa && !semEmpresa ? [empresa.id] : [], autor: ajuda.email || null, historico: 'Tarefa cadastrada pelo assistente do escritório.' });
      if (r.erro || !r.ids.length) { erro.textContent = 'Não consegui criar: ' + (r.erro || 'o banco não devolveu a tarefa'); erro.hidden = false; ok.disabled = false; nao.disabled = false; ok.textContent = 'Criar tarefa'; return; }
      salvar({ estado: 'feita', resultado: { ids: r.ids, titulo: dados.titulo, responsavel: dados.responsavel, prazo: dados.prazo, em: new Date().toISOString() } });
      avisarTelas('mr:tarefas-mudaram', { ids: r.ids });
      try { ajuda.reagir && ajuda.reagir(); } catch (e) { /* sem carinha */ }
      anunciar('Tarefa criada.');
      desenhar();
    }
    trocar(raiz, h('div', { class: 'as-cartao-tit', text: 'Nova tarefa' }),
      h('div', { class: 'as-cartao-campos' }, campo('O que precisa ser feito', titulo, true), campo('Responsável', resp), campo('Prazo', prazo), campo('Prioridade', prio), campo('Setor', setor),
        desc ? campo('Descrição', desc, true) : null),
      chip, h('div', { class: 'as-cartao-botoes' }, ok, nao), erro);
  }
  function desenharFeita() {
    const r = estado.resultado || {};
    const linha = h('div', { class: 'as-cartao-feito' }, h('span', { class: 'as-cartao-ok', text: '✓ Tarefa criada.' }),
      h('span', { class: 'as-cartao-sub', text: [r.titulo, r.responsavel || 'sem responsável', 'prazo ' + dataBR(r.prazo)].filter(Boolean).join(' · ') }));
    if ((r.ids || []).length && podeDesfazer(r.em)) linha.append(botao('Desfazer', desfazer, 'link'));
    trocar(raiz, linha);
  }
  async function desfazer(ev) {
    const b = ev.currentTarget, r = estado.resultado || {};
    if (!podeDesfazer(r.em)) { trocar(raiz, sub('Passou o tempo de desfazer por aqui: exclua a tarefa na Agenda.')); return; }
    b.disabled = true; b.textContent = 'Desfazendo…';
    const d = await excluirTarefasCriadas(supabase, r.ids || []);
    if (d.erro) { b.disabled = false; b.textContent = 'Desfazer'; raiz.append(h('div', { class: 'as-cartao-erro', text: 'Não consegui desfazer: ' + d.erro })); return; }
    salvar({ estado: 'desfeita', desfeito: { n: d.excluidas.length } });
    if (d.excluidas.length) avisarTelas('mr:tarefas-mudaram', { ids: d.excluidas });
    anunciar('Desfeito.');
    desenhar();
  }
  desenhar();
}

// ---------- a revisão das atrasadas: o assistente pergunta o que já foi feito ----------
// as atrasadas de uma pessoa (Samuel e Diego levam o "Ambos"), todas (em lotes de mil)
async function atrasadasDe(pessoa) {
  const hoje = hojeISO();
  const padrao = pessoa.replace(/[^\x00-\x7F]/g, '_');   // Vit_ria pega Vitória, Vitoria e VITÓRIA (como a função)
  const socio = ['samuel', 'diego'].includes(normal(pessoa));
  const { data, error } = await supabase.todasLinhas(() => {
    let q = supabase.from('tarefas').select('id, titulo, prazo, cliente_id, status, faturavel, prioridade, responsavel').neq('status', 'concluida').lt('prazo', hoje);
    q = socio ? q.or('responsavel.ilike.' + padrao + ',responsavel.ilike.ambos') : q.ilike('responsavel', padrao);
    return q.order('prazo', { ascending: true }).order('id', { ascending: true });
  });
  if (error) throw new Error(error.message);
  const daPessoa = r => { const n = normal(r); return n === normal(pessoa) || (socio && n === 'ambos'); };
  return (data || []).filter(t => daPessoa(t.responsavel) && t.status !== 'concluida' && t.prazo && String(t.prazo) < hoje);
}
// os grupos: as tarefas de mesmo título juntas (as que mais se repetem primeiro); as avulsas, todas num grupo no fim
export function agruparAtrasadas(lista, pulados = []) {
  const pul = new Set(pulados);
  const m = new Map();
  lista.forEach(t => {
    const k = normal(t.titulo) || '(sem título)';
    if (!m.has(k)) m.set(k, { chave: k, rotulo: String(t.titulo || 'Sem título').trim(), itens: [] });
    m.get(k).itens.push(t);
  });
  const porPrazo = (a, b) => String(a.prazo).localeCompare(String(b.prazo));
  const grupos = [...m.values()].filter(g => g.itens.length >= 2 && !pul.has(g.chave))
    .map(g => ({ ...g, itens: g.itens.sort(porPrazo) }))
    .sort((a, b) => b.itens.length - a.itens.length || porPrazo(a.itens[0], b.itens[0]));
  const avulsas = [...m.values()].filter(g => g.itens.length < 2).flatMap(g => g.itens).sort(porPrazo);
  if (avulsas.length && !pul.has('*avulsas*')) grupos.push({ chave: '*avulsas*', rotulo: grupos.length || pulados.length ? 'As outras atrasadas' : 'As atrasadas', avulsas: true, itens: avulsas });
  return grupos;
}

function cartaoRevisao({ raiz, estado, salvar, ajuda, anunciar }) {
  raiz.setAttribute('aria-label', 'Revisão das atrasadas');
  raiz.classList.add('as-cartao-revisao');
  const pessoa = EQUIPE.find(n => normal(n) === normal(estado.pessoa || ajuda.nome)) || null;
  const minhas = pessoa && ajuda.nome && normal(pessoa) === normal(ajuda.nome);
  const pulados = () => (Array.isArray(estado.pulados) ? estado.pulados.map(String).slice(0, 500) : []);
  async function desenhar() {
    if (!pessoa) return trocar(raiz, sub('Não sei de quem são as atrasadas: pergunte com o nome de alguém da equipe.'));
    if (estado.estado === 'encerrada') {
      const fez = [estado.feitas ? qtd(estado.feitas, 'tarefa concluída', 'tarefas concluídas') : null, estado.remarcadas ? qtd(estado.remarcadas, 'remarcada', 'remarcadas') : null].filter(Boolean);
      return trocar(raiz, sub('Revisão parada' + (fez.length ? ' — ' + fez.join(' e ') + ' nela' : '') + '.'),
        h('div', { class: 'as-cartao-botoes' }, botao('Continuar a revisão', () => { salvar({ estado: 'ativa' }); desenhar(); })));
    }
    trocar(raiz, sub('Lendo as atrasadas…'));
    let lista, nomes;
    try { lista = await atrasadasDe(pessoa); nomes = await nomesDe(lista.map(t => t.cliente_id)); }
    catch (e) { return trocar(raiz, h('div', { class: 'as-cartao-erro', text: 'Não consegui ler as atrasadas agora.' }), h('div', { class: 'as-cartao-botoes' }, botao('Tentar de novo', desenhar))); }
    const topo = h('div', { class: 'as-cartao-tit' }, (minhas ? 'Suas atrasadas' : 'Atrasadas de ' + pessoa) + ': ', h('span', { class: 'as-cartao-cont', text: String(lista.length) }));
    const conta = [estado.feitas ? qtd(estado.feitas, 'concluída', 'concluídas') : null, estado.remarcadas ? qtd(estado.remarcadas, 'remarcada', 'remarcadas') : null].filter(Boolean);
    const feitas = conta.length ? sub(conta.join(' e ') + ' nesta revisão.') : null;
    const ultimo = linhaUltimo();
    if (!lista.length) return trocar(raiz, topo, h('div', { class: 'as-cartao-ok', text: '✓ Nada atrasado.' }), feitas, ultimo);
    const grupos = agruparAtrasadas(lista, pulados());
    const parar = botao('Parar a revisão', () => { salvar({ estado: 'encerrada' }); desenhar(); }, 'link');
    if (!grupos.length) {
      return trocar(raiz, topo, feitas, ultimo, sub('Passamos por todas: as que ficaram ainda não foram feitas.'),
        h('div', { class: 'as-cartao-botoes' }, botao('Começar de novo', () => { salvar({ pulados: [] }); desenhar(); }), parar));
    }
    trocar(raiz, topo, feitas, ultimo, blocoDoGrupo(grupos[0], nomes, grupos.length), h('div', { class: 'as-cartao-botoes as-cartao-rodape' }, parar));
  }
  // o grupo da vez: "já foram feitas?" — todas, escolher quais, remarcar ou ainda não
  function blocoDoGrupo(g, nomes, quantos) {
    const n = g.itens.length;
    const prazos = n > 1 && g.itens[0].prazo !== g.itens[n - 1].prazo ? 'prazos de ' + dataBR(g.itens[0].prazo) + ' a ' + dataBR(g.itens[n - 1].prazo) : 'prazo ' + dataBR(g.itens[0].prazo);
    const empresas = [...new Set(g.itens.map(t => (t.cliente_id ? nomes.get(String(t.cliente_id)) : null)).filter(Boolean))];
    const quem = empresas.length ? (empresas.length <= 2 ? empresas.join(' e ') : empresas.slice(0, 2).join(', ') + ' e mais ' + (empresas.length - 2)) : '';
    const box = h('div', { class: 'as-cartao-grupo' });
    const cab = h('div', { class: 'as-cartao-tit' }, g.rotulo + ' ', h('span', { class: 'as-cartao-cont', text: '· ' + n }));
    const info = sub([prazos, quem].filter(Boolean).join(' · ') + (quantos > 1 ? ' · grupo 1 de ' + quantos : ''));
    const erro = h('div', { class: 'as-cartao-erro', hidden: true });
    const pular = botao(g.avulsas ? 'Pular estas' : 'Ainda não', () => { salvar({ pulados: [...pulados(), g.chave] }); desenhar(); });
    const todosIds = () => g.itens.map(t => String(t.id));
    // remarcar (16/10/2026): hoje, o próximo dia útil ou outra data — todas do grupo, ou só as marcadas
    const quando = (ids, voltar) => {
      const hoje = hojeISO(), prox = proximoDiaUtil(hoje);
      const data = h('input', { type: 'date', value: prox, min: hoje });
      const vai = iso => remarcar(ids, iso, g, botoes, erro);
      const bHoje = botao('Hoje', () => vai(hoje), 'pri');
      const bProx = botao(rotuloDia(prox, hoje), () => vai(prox));
      const bData = botao('Remarcar', () => { if (/^\d{4}-\d{2}-\d{2}$/.test(data.value)) vai(data.value); else { erro.textContent = 'Escolha a data.'; erro.hidden = false; data.focus(); } });
      const bVoltar = botao('Voltar', voltar, 'link');
      const botoes = [bHoje, bProx, bData, bVoltar];
      trocarDentro(box, cab, info, h('div', { class: 'as-cartao-pergunta', text: ids.length === 1 ? 'Remarcar pra quando?' : 'Remarcar as ' + ids.length + ' pra quando?' }),
        h('div', { class: 'as-cartao-botoes' }, bHoje, bProx), h('div', { class: 'as-cartao-botoes' }, h('label', { class: 'as-cartao-campo' }, 'Outra data', data), bData, bVoltar), erro);
    };
    const escolher = () => {
      const lista = listaComCaixas(g.itens.map(t => itemTarefa(t, nomes)), { marcadas: false, aoMudar: () => { const k = lista.marcadas().length; ok.textContent = k ? 'Concluir ' + k : 'Concluir as marcadas'; ok.disabled = !k; rem.disabled = !k; } });
      const ok = botao('Concluir as marcadas', () => concluir(lista.marcadas(), g, [ok, rem, pular], erro), 'pri');
      const rem = botao('Remarcar as marcadas', () => quando(lista.marcadas(), () => trocarDentro(box, cab, info, ...escolher(), erro)));
      ok.disabled = true; rem.disabled = true;
      return [sub('Marque as que já foram feitas (ou as que quer remarcar):'), lista.el, h('div', { class: 'as-cartao-botoes' }, ok, rem, pular)];
    };
    if (g.avulsas) { box.append(cab, info, ...escolher(), erro); return box; }
    const principal = (montar = false) => {
      const pergunta = h('div', { class: 'as-cartao-pergunta', text: n === 1 ? 'Já foi feita?' : 'Já foram feitas?' });
      const todas = botao(n === 1 ? 'Já fiz' : 'Todas feitas (' + n + ')', () => concluir(todosIds(), g, [todas, maisBtn, remBtn, pular], erro), 'pri');
      const maisBtn = botao('Escolher quais', () => { trocarDentro(box, cab, info, ...escolher(), erro); });
      const remBtn = botao('Remarcar', () => quando(todosIds(), () => principal()));
      const filhos = [cab, info, pergunta, h('div', { class: 'as-cartao-botoes' }, todas, maisBtn, remBtn, pular), erro];
      if (montar) box.append(...filhos); else trocarDentro(box, ...filhos);
    };
    principal(true);
    return box;
  }
  // troca o que está no grupo e leva o foco pro primeiro campo (ou botão) — quem usa o teclado não se perde
  function trocarDentro(box, ...filhos) { box.replaceChildren(...filhos.filter(Boolean)); const c = box.querySelector('input, button:not([disabled])'); if (c) c.focus({ preventScroll: true }); }
  async function concluir(ids, g, botoes, erro) {
    if (!ids.length) return;
    botoes.forEach(b => { b.disabled = true; });
    erro.hidden = true;
    const r = await concluirTarefas(supabase, ids, { autor: ajuda.email || null, historico: 'Tarefa concluída na revisão das atrasadas (assistente do escritório).' });
    if (r.erro && !r.concluidas.length) { erro.textContent = 'Não consegui concluir: ' + r.erro; erro.hidden = false; botoes.forEach(b => { b.disabled = false; }); return; }
    const n = r.concluidas.length;
    // o grupo sai da revisão: as que ficaram (escolhendo quais) ainda não foram feitas
    salvar({ feitas: (estado.feitas || 0) + n, pulados: [...pulados(), g.chave],
      ultimo: { rotulo: g.avulsas ? 'Avulsas' : g.rotulo, chave: g.chave, concluidas: resumoConcluidas(r), em: new Date().toISOString() } });
    if (n) { avisarTelas('mr:feito', { n }); avisarTelas('mr:tarefas-mudaram', { ids: r.concluidas.map(c => c.id) }); }
    anunciar(qtd(n, 'tarefa concluída', 'tarefas concluídas') + '. Próximo grupo.');
    desenhar();
  }
  // remarcar o grupo (ou as marcadas): o grupo sai da revisão, como no concluir; a tarefa da ficha de origem fica (o banco
  // refaria o prazo dela)
  const ORIGEM_REVISAO = 'assistente do escritório (revisão das atrasadas)';
  async function remarcar(ids, prazo, g, botoes, erro) {
    if (!ids.length) return;
    botoes.forEach(b => { b.disabled = true; });
    erro.hidden = true;
    const r = await alterarTarefas(supabase, ids, { prazo }, { autor: ajuda.email || null, origem: ORIGEM_REVISAO });
    if (r.erro && !r.alteradas.length) { erro.textContent = 'Não consegui remarcar: ' + r.erro; erro.hidden = false; botoes.forEach(b => { b.disabled = false; }); return; }
    const n = r.alteradas.length;
    salvar({ remarcadas: (estado.remarcadas || 0) + n, pulados: [...pulados(), g.chave],
      ultimo: { tipo: 'remarcar', rotulo: g.avulsas ? 'Avulsas' : g.rotulo, chave: g.chave, prazo, alteradas: resumoAlteradas(r),
        daFicha: r.daFicha.length, telas: [...new Set(r.daFicha.map(f => f.tela))], em: new Date().toISOString() } });
    if (n) avisarTelas('mr:tarefas-mudaram', { ids: r.alteradas.map(a => a.id) });
    anunciar(qtd(n, 'tarefa remarcada', 'tarefas remarcadas') + ' pra ' + dataBR(prazo) + '. Próximo grupo.');
    desenhar();
  }
  // a última conclusão (ou remarcação) da revisão, com o "Desfazer" (10 minutos)
  function linhaUltimo() {
    const u = estado.ultimo;
    if (u && u.tipo === 'remarcar') {
      const n = (u.alteradas || []).length;
      if (u.desfeito) return sub('↺ ' + u.rotulo + ': remarcação desfeita.');
      if (!n && !u.daFicha) return null;
      const linha = h('div', { class: 'as-cartao-feito' }, h('span', { class: n ? 'as-cartao-ok' : 'as-cartao-sub', text: (n ? '✓ ' : '') + u.rotulo + ': ' + qtd(n, 'remarcada', 'remarcadas') + ' pra ' + dataBR(u.prazo) + '.' }));
      if (u.daFicha) linha.append(h('span', { class: 'as-cartao-sub', text: qtd(u.daFicha, 'ficou', 'ficaram') + ' como estava' + (u.daFicha === 1 ? '' : 'm') + ': o prazo vem da ficha de origem' + ((u.telas || []).length ? ' (tela ' + u.telas.join(', ') + ')' : '') + '.' }));
      if (n && podeDesfazer(u.em)) linha.append(botao('Desfazer', desfazerUltimo, 'link'));
      return linha;
    }
    if (!u || !(u.concluidas || []).length) return null;
    const n = u.concluidas.length;
    if (u.desfeito) return sub('↺ ' + u.rotulo + ': conclusão desfeita.');
    const linha = h('div', { class: 'as-cartao-feito' }, h('span', { class: 'as-cartao-ok', text: '✓ ' + u.rotulo + ': ' + qtd(n, 'concluída', 'concluídas') + '.' }));
    if (u.concluidas.some(c => !c.faturavel) && podeDesfazer(u.em)) linha.append(botao('Desfazer', desfazerUltimo, 'link'));
    return linha;
  }
  async function desfazerUltimo(ev) {
    const b = ev.currentTarget, u = estado.ultimo || {};
    if (!podeDesfazer(u.em)) { desenhar(); return; }
    b.disabled = true; b.textContent = 'Desfazendo…';
    if (u.tipo === 'remarcar') {
      const d = await desfazerAlteracao(supabase, u.alteradas || [], { autor: ajuda.email || null, origem: ORIGEM_REVISAO });
      if (d.erro && !d.desfeitas.length) { b.disabled = false; b.textContent = 'Desfazer'; return; }
      salvar({ remarcadas: Math.max(0, (estado.remarcadas || 0) - d.desfeitas.length), ultimo: { ...u, desfeito: true },
        pulados: pulados().filter(k => k !== u.chave) });   // o grupo volta pra revisão (as que voltaram a estar atrasadas)
      if (d.desfeitas.length) avisarTelas('mr:tarefas-mudaram', { ids: d.desfeitas });
      anunciar('Desfeito.');
      desenhar();
      return;
    }
    const d = await desfazerConclusao(supabase, u.concluidas || [], { autor: ajuda.email || null, historico: 'Conclusão desfeita na revisão das atrasadas (assistente do escritório).' });
    if (d.erro && !d.desfeitas.length) { b.disabled = false; b.textContent = 'Desfazer'; return; }
    salvar({ feitas: Math.max(0, (estado.feitas || 0) - d.desfeitas.length), ultimo: { ...u, desfeito: true },
      pulados: pulados().filter(k => k !== u.chave) });   // o grupo volta pra revisão
    if (d.desfeitas.length) avisarTelas('mr:tarefas-mudaram', { ids: d.desfeitas });
    anunciar('Desfeito.');
    desenhar();
  }
  desenhar();
}

// ---------- o vigia: o que ele achou, por grupo, com "Abrir" e "Ignorar" ----------
// estado (guardado na conversa): ver ('meus' | 'todos' | 'ignorados'); pessoa (de quem — sem: quem está na tela); o
// recorte — setor, tela (o caminho da página) ou cliente_id (a ficha da empresa); e os ignorados agora há pouco
// (feitos: { id: quando }), que continuam na lista com o "Desfazer" por 10 minutos. Ignorar só tira da lista: quem e
// quando o banco grava, e a aba "Ignorados" traz de volta. O que for arrumado na tela some sozinho na conferência seguinte
const NOME_SETOR = { dp: 'DP', fiscal: 'Fiscal', contabil: 'Contábil', financeiro: 'Financeiro', comercial: 'Comercial', societario: 'Societário', irpf: 'IRPF', gestao: 'Gestão', clientes: 'Clientes', geral: 'Geral' };
const diaDe = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const horaDe = iso => { const d = new Date(iso); return isNaN(d) ? '' : pad(d.getHours()) + 'h' + pad(d.getMinutes()); };

function cartaoVigia({ raiz, estado, salvar, ajuda, anunciar }) {
  raiz.setAttribute('aria-label', 'O que o vigia achou');
  raiz.classList.add('as-cartao-vigia');
  const email = String(ajuda.email || '').toLowerCase();
  const pessoa = EQUIPE.find(n => normal(n) === normal(estado.pessoa || ajuda.nome)) || null;
  const minha = !!pessoa && !!ajuda.nome && normal(pessoa) === normal(ajuda.nome);
  const socio = pessoa ? ehSocioPeloNome(pessoa) : SOCIOS.includes(email);
  const abertos = new Set();   // os grupos que a pessoa abriu (redesenhar não fecha)
  let primeira = true;         // ao abrir e ao trocar de aba: o primeiro grupo aberto (todos, com até 6 achados)
  const modo = () => (['meus', 'todos', 'ignorados'].includes(estado.ver) && !(estado.ver === 'meus' && !pessoa) ? estado.ver : pessoa ? 'meus' : 'todos');
  // os "Desfazer" que ainda valem (os de mais de 10 minutos saem)
  const feitos = () => Object.fromEntries(Object.entries(estado.feitos && typeof estado.feitos === 'object' ? estado.feitos : {}).filter(([id, em]) => ID.test(id) && podeDesfazer(em)));
  const recorte = () => ({ setor: NOME_SETOR[estado.setor] ? estado.setor : null, tela: !estado.cliente_id && typeof estado.tela === 'string' ? estado.tela.slice(0, 120) : null,
    clienteId: ID.test(String(estado.cliente_id || '')) ? String(estado.cliente_id) : null });
  const nomeRecorte = r => (r.clienteId ? 'desta empresa' : r.tela ? 'nesta tela' : r.setor ? 'no ' + NOME_SETOR[r.setor] : '');

  async function desenhar() {
    if (!raiz.childNodes.length) trocar(raiz, sub('Lendo o que o vigia achou…'));
    let lista;
    try { lista = await lerAchados(supabase); }
    catch (e) { return trocar(raiz, h('div', { class: 'as-cartao-erro', text: 'Não consegui ler o que o vigia achou agora.' }), h('div', { class: 'as-cartao-botoes' }, botao('Tentar de novo', desenhar))); }
    marcarVisto(email);
    const r = recorte(), f = feitos(), m = modo(), onde = nomeRecorte(r);
    const base = lista.map(a => (a.situacao === 'ignorado' && f[a.id] ? { ...a, _agora: true } : a));
    const doModo = md => filtrarAchados(base, { nome: pessoa, socio, todos: md !== 'meus', ...r, situacao: null })
      .filter(a => (md === 'ignorados' ? a.situacao === 'ignorado' && !a._agora : a.situacao === 'aberto' || a._agora));
    const conta = md => doModo(md).filter(a => !a._agora).length;
    const itens = doModo(m);
    const titulo = (m === 'ignorados' ? 'Ignorados' : m === 'todos' ? 'O que o vigia achou' : minha ? 'O que o vigia achou pra você' : 'O que o vigia achou pra ' + pessoa) + (onde ? ' ' + onde : '') + ': ';
    const topo = h('div', { class: 'as-cartao-tit' }, titulo, h('span', { class: 'as-cartao-cont', text: String(itens.filter(a => !a._agora).length) }));
    const ultimo = lista.reduce((x, a) => (String(a.ultimo_visto || '') > x ? String(a.ultimo_visto) : x), '');
    const quando = ultimo ? sub('Conferido ' + (diaDe(ultimo) === hojeISO() ? 'hoje' : 'em ' + dataBR(diaDe(ultimo))) + ' às ' + horaDe(ultimo)
      + '. O que for arrumado some na conferência seguinte (de hora em hora).') : null;
    // as abas, logo abaixo do título (os meus, de todos, os ignorados) e, num recorte, "Ver tudo"
    const aba = (md, rotulo) => {
      const b = botao(rotulo, () => { salvar({ ver: md }); primeira = true; desenhar(); }, 'link');
      b.setAttribute('aria-pressed', String(m === md));
      if (m === md) b.classList.add('as-vigia-aba-atual');
      return b;
    };
    const abas = h('div', { class: 'as-cartao-botoes as-vigia-abas' },
      pessoa ? aba('meus', (minha ? 'Os meus' : 'De ' + pessoa) + ' (' + conta('meus') + ')') : null,
      aba('todos', 'De todos (' + conta('todos') + ')'), aba('ignorados', 'Ignorados (' + conta('ignorados') + ')'),
      onde ? botao('Ver tudo', () => { salvar({ tela: null, cliente_id: null, setor: null }); primeira = true; desenhar(); }, 'link') : null);
    if (!itens.length) {
      const vazio = m === 'ignorados' ? sub('Nada ignorado' + (onde ? ' ' + onde : '') + '.') : h('div', { class: 'as-cartao-ok', text: '✓ Nada pra conferir' + (onde ? ' ' + onde : '') + '.' });
      return trocar(raiz, topo, abas, vazio, quando);
    }
    const blocos = agruparAchados(itens).map((g, i) => {
      const det = h('details', { class: 'as-vigia-grupo' },
        h('summary', {}, g.rotulo, ' ', h('span', { class: 'as-cartao-cont', text: '· ' + g.itens.length }),
          g.urgentes && m !== 'ignorados' ? h('span', { class: 'as-tag', text: g.urgentes === 1 ? 'urgente' : g.urgentes + ' urgentes' }) : null),
        h('ul', { class: 'as-cartao-lista' }, g.itens.map(a => itemAchado(a, m))));
      det.open = abertos.has(g.regra) || (primeira && (itens.length <= 6 || i === 0));
      if (det.open) abertos.add(g.regra);
      det.addEventListener('toggle', () => { if (det.open) abertos.add(g.regra); else abertos.delete(g.regra); });
      return det;
    });
    primeira = false;
    trocar(raiz, topo, abas, blocos, quando);
  }
  // um achado: o que é, o porquê, de quem (fora dos meus) e o que fazer
  function itemAchado(a, m) {
    const href = linkSeguro(a.link);
    const linhas = [h('b', {}, a.titulo || 'Achado', a.gravidade === 'alta' && m !== 'ignorados' && !a._agora ? h('span', { class: 'as-tag', text: 'urgente' }) : null),
      a.detalhe ? h('small', { text: a.detalhe }) : null, m !== 'meus' && a.responsavel ? h('small', { text: 'Com ' + a.responsavel + '.' }) : null];
    let acoes;
    if (m === 'ignorados') {
      const quem = a.ignorado_por ? nomePorEmail(a.ignorado_por) || a.ignorado_por : null;
      acoes = [h('span', { class: 'as-cartao-sub', text: 'Ignorado' + (quem ? ' por ' + quem : '') + (a.ignorado_em ? ' em ' + dataBR(diaDe(a.ignorado_em)) : '') + '.' }),
        botao('Voltar a mostrar', ev => reabrir(a, ev.currentTarget), 'link')];
    } else if (a._agora) {
      acoes = [h('span', { class: 'as-cartao-sub', text: 'Ignorado.' }), botao('Desfazer', ev => reabrir(a, ev.currentTarget), 'link')];
    } else {
      acoes = [href ? h('a', { class: 'as-botao as-botao-link', href: new URL(href, RAIZ).href, text: 'Abrir' }) : null, botao('Ignorar', ev => ignorar(a, ev.currentTarget), 'link')];
    }
    return h('li', { class: 'as-vigia-item' + (a._agora ? ' as-vigia-ignorado' : '') }, linhas, h('div', { class: 'as-vigia-acoes' }, acoes));
  }
  const falhou = (b, rotulo, msg) => { b.disabled = false; b.textContent = rotulo; const li = b.closest('li'); if (li) li.append(h('div', { class: 'as-cartao-erro', text: msg })); };
  async function ignorar(a, b) {
    b.disabled = true; b.textContent = 'Ignorando…';
    try { await ignorarAchado(supabase, a.id); } catch (e) { return falhou(b, 'Ignorar', 'Não consegui ignorar: ' + e.message); }
    salvar({ feitos: { ...feitos(), [a.id]: new Date().toISOString() } });
    anunciar('Ignorado. Dá pra desfazer por 10 minutos.');
    desenhar();
  }
  async function reabrir(a, b) {
    const rotulo = b.textContent;
    b.disabled = true; b.textContent = 'Voltando…';
    try { await reabrirAchado(supabase, a.id); } catch (e) { return falhou(b, rotulo, 'Não consegui: ' + e.message); }
    const f = feitos(); delete f[a.id];
    salvar({ feitos: f });
    anunciar('Voltou pra lista.');
    desenhar();
  }
  desenhar();
}
