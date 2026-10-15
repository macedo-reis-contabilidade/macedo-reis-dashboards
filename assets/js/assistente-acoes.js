// ============================================================
// MACEDO & REIS — Assistente do escritório: os cartões das ações (14/10/2026)
// A função "assistente" não grava nada. Quando a pessoa pede pra concluir tarefas, marcar boletos como pagos ou criar uma
// tarefa, a resposta traz a proposta ("acao") e este módulo desenha o cartão embaixo dela: o que vai mudar, lido de novo
// do banco (com caixas pra desmarcar, ou o formulário curto da tarefa nova), o botão pra confirmar e, depois, o
// "Desfazer" (por 10 minutos). Quem grava é a tela, com o login da pessoa, pela mesma regra das telas
// (assets/js/tarefas-acoes.js).
// A revisão das atrasadas é o assistente perguntando o que já foi feito: grupo por grupo (as tarefas que mais se repetem
// primeiro; as avulsas juntas no fim) — "todas feitas", "escolher quais" ou "ainda não". Começa pelo botão da saudação do
// dia, pelo recado da Agenda ou pela IA (quando pedem pra passar as atrasadas a limpo).
// Depois de mudar, avisa as telas abertas: "mr:feito" (a carinha comemora), "mr:tarefas-mudaram" (a Agenda e as telas de
// tarefas recarregam) e "mr:boletos-mudaram" (a grade de boletos troca a situação). Testes de tela:
// tests/harness/assistente-acoes.py.
// ============================================================

import { supabase } from './supabase.js';
import { concluirTarefas, desfazerConclusao, marcarPagos, desfazerPagos, criarTarefasAvulsas, excluirTarefasCriadas } from './tarefas-acoes.js';
import { EQUIPE } from './equipe.js';
import { SETORES } from './nova-tarefa.js';

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
  const fazer = { concluir_tarefas: cartaoConcluir, marcar_pago: cartaoPago, criar_tarefa: cartaoCriar, revisar_atrasadas: cartaoRevisao }[acao && acao.tipo];
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
      return trocar(raiz, sub('Revisão parada' + (estado.feitas ? ' — ' + qtd(estado.feitas, 'tarefa concluída', 'tarefas concluídas') + ' nela' : '') + '.'),
        h('div', { class: 'as-cartao-botoes' }, botao('Continuar a revisão', () => { salvar({ estado: 'ativa' }); desenhar(); })));
    }
    trocar(raiz, sub('Lendo as atrasadas…'));
    let lista, nomes;
    try { lista = await atrasadasDe(pessoa); nomes = await nomesDe(lista.map(t => t.cliente_id)); }
    catch (e) { return trocar(raiz, h('div', { class: 'as-cartao-erro', text: 'Não consegui ler as atrasadas agora.' }), h('div', { class: 'as-cartao-botoes' }, botao('Tentar de novo', desenhar))); }
    const topo = h('div', { class: 'as-cartao-tit' }, (minhas ? 'Suas atrasadas' : 'Atrasadas de ' + pessoa) + ': ', h('span', { class: 'as-cartao-cont', text: String(lista.length) }));
    const feitas = estado.feitas ? sub(qtd(estado.feitas, 'concluída', 'concluídas') + ' nesta revisão.') : null;
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
  // o grupo da vez: "já foram feitas?" — todas, escolher quais, ou ainda não
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
    const escolher = (marcadas) => {
      const lista = listaComCaixas(g.itens.map(t => itemTarefa(t, nomes)), { marcadas, aoMudar: () => { const k = lista.marcadas().length; ok.textContent = k ? 'Concluir ' + k : 'Concluir as marcadas'; ok.disabled = !k; } });
      const ok = botao('Concluir as marcadas', () => concluir(lista.marcadas(), g, [ok, pular], erro), 'pri');
      ok.disabled = !marcadas;
      return [sub('Marque as que já foram feitas:'), lista.el, h('div', { class: 'as-cartao-botoes' }, ok, pular)];
    };
    if (g.avulsas) { box.append(cab, info, ...escolher(false), erro); return box; }
    const pergunta = h('div', { class: 'as-cartao-pergunta', text: n === 1 ? 'Já foi feita?' : 'Já foram feitas?' });
    const todas = botao(n === 1 ? 'Já fiz' : 'Todas feitas (' + n + ')', () => concluir(g.itens.map(t => String(t.id)), g, [todas, maisBtn, pular], erro), 'pri');
    const maisBtn = botao('Escolher quais', () => { trocarDentro(box, cab, info, ...escolher(false), erro); });
    box.append(cab, info, pergunta, h('div', { class: 'as-cartao-botoes' }, todas, maisBtn, pular), erro);
    return box;
  }
  function trocarDentro(box, ...filhos) { box.replaceChildren(...filhos.filter(Boolean)); const c = box.querySelector('input'); if (c) c.focus({ preventScroll: true }); }
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
  // a última conclusão da revisão, com o "Desfazer" (10 minutos)
  function linhaUltimo() {
    const u = estado.ultimo;
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
