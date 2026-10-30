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
// tela onde se resolve) e "Ignorar" (com "Desfazer" por 10 minutos; os ignorados voltam pela aba "Ignorados") e, desde
// 16/10/2026, o que dá pra resolver ali mesmo: o responsável que falta, a proposta parada, o boleto enviado ou pago, a
// admissão registrada, a rescisão concluída, a empresa da ficha sem vínculo, o alvará renovado, a cobrança e a obrigação
// de quem saiu da carteira, as obrigações do regime de quem não tem nenhuma, a cobrança de quem não está nela e o cadastro
// desencontrado da carteira.
// O cartão dos arquivos (16/10/2026) só mostra: o que a função achou na pasta da empresa no Drive e nas guias arquivadas,
// o nome como link (abre no Drive, numa aba nova) e, embaixo, a pasta da empresa.
// O cartão da mensagem (19/10/2026): a IA escreve, em nome de quem pede, a mensagem pra alguém da equipe ou um grupo do
// chat (com o link do Drive dos arquivos que buscou); a pessoa confere, edita e envia — pela regra do chat
// (assets/js/chat-equipe.js) —, abre a conversa e tem o "Desfazer" (apaga a mensagem) por 10 minutos.
// A mensagem no histórico (20/10/2026, pedido da Thalia): ao concluir ou mudar tarefas — no cartão e na revisão das
// atrasadas —, o "✎ Mensagem no histórico" abre o campo, e o que a pessoa escrever vai no fim da linha do histórico de cada
// uma (com o que ela pediu pra anotar, a IA já manda preenchido). E o cartão de só registrar (o "Registrar andamento" da
// Agenda): a mensagem no histórico, sem concluir nem mudar a tarefa, com o "Desfazer" que tira as linhas.
// Os cadastros (30/10/2026, pedido do Samuel): incluir empresa na campanha da Reforma, pôr empresa num mês dos boletos (com o
// valor e o vencimento editáveis) e ajustar as obrigações das empresas em lote (quem cuida, o dia do prazo, desligar).
// Testes de tela: tests/harness/assistente-acoes.py, tests/harness/assistente-vigia.py, tests/harness/assistente-mensagem.py e
// tests/harness/assistente-cadastros.py.
// ============================================================

import { supabase } from './supabase.js';
import { concluirTarefas, desfazerConclusao, marcarPagos, desfazerPagos, criarTarefasAvulsas, excluirTarefasCriadas,
  alterarTarefas, desfazerAlteracao, limparMudanca, mudancaDe, fichaDeOrigem, ficaDeFora, proximasNascemCom,
  pessoaDaEquipe, definirResponsavelObrigacoes, desfazerResponsavelObrigacoes, definirResponsavelRotina, desfazerResponsavelRotina,
  descartarProposta, desfazerDescarte, avancarBoletos, voltarBoletos, fecharFicha, reabrirFicha, vincularEmpresa, desvincularEmpresa, buscarEmpresas,
  renovarAlvara, desfazerRenovacao, desativarRegistro, reativarRegistro, obrigacoesParaVincular, vincularObrigacoes, desfazerVinculoObrigacoes,
  dadosDaCobranca, porNaCobranca, desfazerCobranca, acertarCadastro, desfazerCadastro,
  registrarNoHistorico, desfazerRegistro, limparMensagem, MAX_MENSAGEM, tarefaDoMesDoVinculo, criarTarefaDoMes, religarVinculo,
  incluirNaCampanha, desfazerInclusaoCampanha, dadosParaCompetencia, porNaCompetencia, desfazerPorNaCompetencia, COMPETENCIA_ISO,
  limparAjuste, ajusteDoVinculo, ajustarVinculos, desfazerAjusteVinculos } from './tarefas-acoes.js';
import { EQUIPE, SOCIOS, nomePorEmail } from './equipe.js';
import { SETORES } from './nova-tarefa.js';
import { lerAchados, ignorarAchado, reabrirAchado, filtrarAchados, agruparAchados, linkSeguro, ehSocioPeloNome, marcarVisto,
  resolvidosAgora, marcarResolvidoAgora, desmarcarResolvidoAgora, COLUNAS } from './vigia.js';
import { linkDoDrive, conversaDe, enviarMensagem, apagarMensagem, MAX_TEXTO } from './chat-equipe.js';

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
    const cx = h('input', { type: 'checkbox', checked: 'marcada' in it ? !!it.marcada : marcadas, onchange: aoMudar });
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

// ---------- a mensagem no histórico (20/10/2026, pedido da Thalia) ----------
// O link "✎ Mensagem no histórico" abre o campo; com a mensagem que a IA preparou (o que a pessoa pediu pra anotar), ele já
// vem aberto e preenchido. O que estiver escrito vai no fim da linha do histórico de cada tarefa (tarefas-acoes.js).
// aoMudar(texto): a pessoa editou (o cartão guarda, pra voltar igual depois de recarregar)
const textoDaAcao = v => (typeof v === 'string' ? limparMensagem(v) : '');
const trecho = (s, n = 200) => { const a = [...String(s || '')]; return a.length > n ? a.slice(0, n - 1).join('') + '…' : a.join(''); };
function campoMensagem({ valor = '', rotulo = 'Mensagem no histórico (opcional)', aberto = false, aoMudar = null } = {}) {
  const caixa = h('textarea', { rows: '2', maxlength: String(MAX_MENSAGEM) });
  caixa.value = textoDaAcao(valor);
  if (aoMudar) caixa.addEventListener('change', () => { try { aoMudar(limparMensagem(caixa.value)); } catch (e) { /* sem onde guardar */ } });
  const campo = h('div', { class: 'as-cartao-campos' }, h('label', { class: 'as-cartao-campo largo' }, rotulo, caixa));
  const el = h('div', {});
  const abrir = () => { el.replaceChildren(campo); caixa.focus({ preventScroll: true }); };
  el.append(aberto || caixa.value ? campo : botao('✎ Mensagem no histórico', abrir, 'link'));
  return { el, caixa, valor: () => limparMensagem(caixa.value), travar: v => { caixa.disabled = !!v; } };
}
// depois de gravar: a mensagem que foi pro histórico, embaixo do que o cartão fez
const linhaDaMensagem = m => (m ? sub('No histórico: “' + trecho(m) + '”') : null);

// ============================================================
// cartaoDaAcao(acao, ajuda) → Element | null
//   ajuda: { salvar(acao), anunciar(texto), reagir(), email, nome } — salvar guarda o estado do cartão na conversa
// ============================================================
export function cartaoDaAcao(acao, ajuda = {}) {
  const fazer = { concluir_tarefas: cartaoConcluir, alterar_tarefas: cartaoAlterar, registrar_historico: cartaoRegistrar, marcar_pago: cartaoPago, criar_tarefa: cartaoCriar,
    revisar_atrasadas: cartaoRevisao, vigia: cartaoVigia, arquivos: cartaoArquivos, enviar_mensagem: cartaoMensagem,
    incluir_reforma: cartaoReforma, por_na_competencia: cartaoCompetencia, ajustar_obrigacoes: cartaoObrigacoes }[acao && acao.tipo];
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
  const msg = campoMensagem({ valor: estado.mensagem, aoMudar: m => salvar({ mensagem: m }) });
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
    trocar(raiz, tit, faltam > 0 ? sub(qtd(faltam, 'outra já estava concluída', 'outras já estavam concluídas') + '.') : null, lista.el, msg.el,
      h('div', { class: 'as-cartao-botoes' }, ok, nao, alternarTodas(lista, tarefas.length)), erro);
  }
  async function confirmar(marcados, ok, nao, erro) {
    if (!marcados.length) return;
    const mensagem = msg.valor();
    ok.disabled = true; nao.disabled = true; msg.travar(true); ok.textContent = 'Concluindo…'; erro.hidden = true;
    const r = await concluirTarefas(supabase, marcados, { autor: ajuda.email || null, historico: 'Tarefa concluída pelo assistente do escritório.', mensagem });
    if (r.erro && !r.concluidas.length) { erro.textContent = 'Não consegui concluir: ' + r.erro; erro.hidden = false; ok.disabled = false; nao.disabled = false; msg.travar(false); ok.textContent = 'Concluir ' + marcados.length; return; }
    salvar({ estado: 'feita', resultado: { concluidas: resumoConcluidas(r), ja: r.jaEstavam.length, semHistorico: !!r.semHistorico, ...(mensagem ? { mensagem } : {}), em: new Date().toISOString() } });
    if (r.concluidas.length) { avisarTelas('mr:feito', { n: r.concluidas.length }); avisarTelas('mr:tarefas-mudaram', { ids: r.concluidas.map(c => c.id) }); }
    anunciar(qtd(r.concluidas.length, 'tarefa concluída', 'tarefas concluídas') + '.');
    desenhar();
  }
  function desenharFeita() {
    const r = estado.resultado || {};
    const n = (r.concluidas || []).length;
    const linha = h('div', { class: 'as-cartao-feito' }, h('span', { class: 'as-cartao-ok', text: '✓ ' + (n ? qtd(n, 'tarefa concluída', 'tarefas concluídas') : 'Nada foi concluído') + '.' }));
    if (r.ja) linha.append(h('span', { class: 'as-cartao-sub', text: qtd(r.ja, 'já estava concluída', 'já estavam concluídas') + ' antes.' }));
    if (r.semHistorico) linha.append(h('span', { class: 'as-cartao-aviso', text: r.mensagem ? 'A linha no histórico (com a mensagem) não foi gravada.' : 'A linha no histórico não foi gravada.' }));
    if ((r.concluidas || []).some(c => !c.faturavel) && podeDesfazer(r.em)) linha.append(botao('Desfazer', desfazer, 'link'));
    trocar(raiz, linha, n && !r.semHistorico ? linhaDaMensagem(r.mensagem) : null);
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
  const msg = campoMensagem({ valor: estado.mensagem, aoMudar: m => salvar({ mensagem: m }) });
  async function desenhar() {
    if (!mudar) return trocar(raiz, sub('Não entendi o que mudar nessas tarefas: peça de novo, com o prazo, o responsável ou a prioridade.'));
    if (estado.estado === 'feita') return desenharFeita();
    if (estado.estado === 'cancelada') return trocar(raiz, sub('Deixei como estava.'));
    if (estado.estado === 'desfeita') return desenharDesfeita();
    trocar(raiz, sub('Lendo as tarefas…'));
    let tarefas, nomes;
    try {
      tarefas = (await lerPorIds('tarefas', 'id, titulo, prazo, responsavel, prioridade, status, cliente_id, origem, obrigacao_id, admissao_id, rescisao_id, alvara_id', ids)).filter(t => t.status !== 'concluida');
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
    // o responsável novo na que nasce de obrigação ou de tarefa recorrente: a próxima vem com o de lá
    const px = proximasNascemCom(mudam.map(x => x.t), mudar);
    const proximas = [px.obrigacao ? qtd(px.obrigacao, 'vem', 'vêm') + ' de obrigação fiscal: a próxima nasce com o responsável da obrigação — pra ficar de vez, troque em Obrigações fiscais' : null,
      px.recorrente ? qtd(px.recorrente, 'vem', 'vêm') + ' de tarefa recorrente: a próxima nasce com o responsável de lá — pra ficar de vez, troque em Tarefas recorrentes do setor' : null].filter(Boolean);
    trocar(raiz, tit, Object.keys(mudar).length > 1 ? sub(resumoMudanca(mudar)) : null, avisos.length ? sub(avisos.join('. ') + '.') : null,
      proximas.length ? h('div', { class: 'as-cartao-aviso', text: proximas.join('. ') + '.' }) : null, lista.el, msg.el,
      h('div', { class: 'as-cartao-botoes' }, ok, nao, alternarTodas(lista, mudam.length)), erro);
  }
  async function confirmar(marcados, ok, nao, erro) {
    if (!marcados.length) return;
    const verbo = verboAlterar(mudar);
    const mensagem = msg.valor();
    ok.disabled = true; nao.disabled = true; msg.travar(true); ok.textContent = 'Gravando…'; erro.hidden = true;
    const r = await alterarTarefas(supabase, marcados, mudar, { autor: ajuda.email || null, origem: ORIGEM, mensagem });
    if (r.erro && !r.alteradas.length) { erro.textContent = 'Não consegui gravar: ' + r.erro; erro.hidden = false; ok.disabled = false; nao.disabled = false; msg.travar(false); ok.textContent = verbo + ' ' + marcados.length; return; }
    // os ids saem do estado (o resultado já diz quais mudaram): a conversa guarda o cartão, e 300 tarefas com o antes e o
    // depois de três campos passariam do tamanho que ela aceita
    salvar({ estado: 'feita', ids: [], resultado: { alteradas: resumoAlteradas(r), ficaram: r.fechadas.length + r.iguais.length + r.daFicha.length, semHistorico: !!r.semHistorico,
      ...(mensagem ? { mensagem } : {}), em: new Date().toISOString() } });
    if (r.alteradas.length) avisarTelas('mr:tarefas-mudaram', { ids: r.alteradas.map(a => a.id) });
    anunciar(feitoAlterar(mudar, r.alteradas.length) + '.');
    desenhar();
  }
  function desenharFeita() {
    const r = estado.resultado || {};
    const n = (r.alteradas || []).length;
    const linha = h('div', { class: 'as-cartao-feito' }, h('span', { class: 'as-cartao-ok', text: '✓ ' + (n ? feitoAlterar(mudar, n) : 'Nada mudou') + '.' }));
    if (r.ficaram) linha.append(h('span', { class: 'as-cartao-sub', text: qtd(r.ficaram, 'ficou como estava', 'ficaram como estavam') + ' (concluída ou mudada no meio do caminho).' }));
    if (r.semHistorico) linha.append(h('span', { class: 'as-cartao-aviso', text: r.mensagem ? 'A linha no histórico (com a mensagem) não foi gravada.' : 'A linha no histórico não foi gravada.' }));
    if (n && podeDesfazer(r.em)) linha.append(botao('Desfazer', desfazer, 'link'));
    trocar(raiz, linha, n && !r.semHistorico ? linhaDaMensagem(r.mensagem) : null);
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

// ---------- só a mensagem no histórico (20/10/2026): o "Registrar andamento" da Agenda, pelo assistente ----------
// A IA separou as tarefas e escreveu o que a pessoa pediu pra registrar; aqui ela confere (edita a mensagem, desmarca
// alguma) e registra, sem concluir nem mudar a tarefa. O "Desfazer" (10 minutos) tira do histórico as linhas que entraram
const sobreTarefas = n => (n === 1 ? 'da tarefa' : 'de ' + n + ' tarefas');
function cartaoRegistrar({ raiz, estado, salvar, ajuda, anunciar }) {
  raiz.setAttribute('aria-label', 'Mensagem no histórico das tarefas');
  const ids = idsDe(estado.ids).slice(0, 300);
  const msg = campoMensagem({ valor: estado.mensagem, rotulo: 'A mensagem — vai pro histórico de cada uma, em seu nome', aberto: true, aoMudar: m => salvar({ mensagem: m }) });
  async function desenhar() {
    if (estado.estado === 'feita') return desenharFeita();
    if (estado.estado === 'cancelada') return trocar(raiz, sub('Não registrei nada.'));
    if (estado.estado === 'desfeita') return desenharDesfeita();
    trocar(raiz, sub('Lendo as tarefas…'));
    let tarefas, nomes;
    try {
      tarefas = await lerPorIds('tarefas', 'id, titulo, prazo, responsavel, status, cliente_id', ids);
      nomes = await nomesDe(tarefas.map(t => t.cliente_id));
    } catch (e) { return trocar(raiz, h('div', { class: 'as-cartao-erro', text: 'Não consegui ler as tarefas agora.' }), h('div', { class: 'as-cartao-botoes' }, botao('Tentar de novo', desenhar))); }
    if (!tarefas.length) return trocar(raiz, sub(ids.length === 1 ? 'Essa tarefa não existe mais.' : 'Essas tarefas não existem mais.'));
    tarefas.sort((a, b) => String(a.prazo || '9').localeCompare(String(b.prazo || '9')));
    const erro = h('div', { class: 'as-cartao-erro', hidden: true });
    const ok = botao('Registrar', () => confirmar(lista.marcadas(), ok, nao, erro), 'pri');
    const nao = botao('Agora não', () => { salvar({ estado: 'cancelada' }); desenhar(); });
    const atualizar = () => { const n = lista.marcadas().length; ok.textContent = n > 1 ? 'Registrar em ' + n : 'Registrar'; ok.disabled = !n; };
    const lista = listaComCaixas(tarefas.map(t => ({ ...itemTarefa(t, nomes), tag: t.status === 'concluida' ? 'concluída' : '' })), { aoMudar: () => atualizar() });
    atualizar();
    const faltam = ids.length - tarefas.length;
    trocar(raiz, h('div', { class: 'as-cartao-tit', text: 'Registrar no histórico ' + sobreTarefas(tarefas.length) + '?' }), msg.el,
      faltam > 0 ? sub(qtd(faltam, 'outra não existe mais', 'outras não existem mais') + '.') : null, lista.el,
      h('div', { class: 'as-cartao-botoes' }, ok, nao, alternarTodas(lista, tarefas.length)), erro);
  }
  async function confirmar(marcados, ok, nao, erro) {
    if (!marcados.length) return;
    const mensagem = msg.valor();
    if (!mensagem) { erro.textContent = 'Escreva a mensagem.'; erro.hidden = false; msg.caixa.focus(); return; }
    ok.disabled = true; nao.disabled = true; msg.travar(true); ok.textContent = 'Registrando…'; erro.hidden = true;
    const r = await registrarNoHistorico(supabase, marcados, { autor: ajuda.email || null, mensagem, origem: ORIGEM });
    if (r.erro && !r.registradas.length) {
      erro.textContent = 'Não consegui registrar: ' + r.erro; erro.hidden = false; ok.disabled = false; nao.disabled = false; msg.travar(false);
      ok.textContent = marcados.length > 1 ? 'Registrar em ' + marcados.length : 'Registrar';
      return;
    }
    // os ids saem do estado (o resultado diz onde entrou, com a linha de cada uma pro "Desfazer")
    salvar({ estado: 'feita', ids: [], mensagem, resultado: { registradas: r.registradas, faltam: r.faltam.length, em: new Date().toISOString() } });
    try { ajuda.reagir && ajuda.reagir(); } catch (e) { /* sem carinha */ }
    anunciar('Mensagem registrada no histórico ' + sobreTarefas(r.registradas.length) + '.');
    desenhar();
  }
  function desenharFeita() {
    const r = estado.resultado || {};
    const n = (r.registradas || []).length;
    const linha = h('div', { class: 'as-cartao-feito' }, h('span', { class: 'as-cartao-ok', text: '✓ ' + (n ? 'Mensagem registrada no histórico ' + sobreTarefas(n) : 'Nada foi registrado') + '.' }));
    if (r.faltam) linha.append(h('span', { class: 'as-cartao-sub', text: qtd(r.faltam, 'não existia mais', 'não existiam mais') + '.' }));
    if (n && podeDesfazer(r.em)) linha.append(botao('Desfazer', desfazer, 'link'));
    trocar(raiz, linha, n ? linhaDaMensagem(textoDaAcao(estado.mensagem)) : null);
  }
  async function desfazer(ev) {
    const b = ev.currentTarget, r = estado.resultado || {};
    if (!podeDesfazer(r.em)) { trocar(raiz, sub('Passou o tempo de desfazer por aqui: a mensagem fica no histórico.')); return; }
    b.disabled = true; b.textContent = 'Desfazendo…';
    const d = await desfazerRegistro(supabase, r.registradas || [], { autor: ajuda.email || null });
    if (d.erro && !d.desfeitas.length) { b.disabled = false; b.textContent = 'Desfazer'; raiz.append(h('div', { class: 'as-cartao-erro', text: 'Não consegui desfazer: ' + d.erro })); return; }
    salvar({ estado: 'desfeita', desfeito: { n: d.desfeitas.length } });
    anunciar('Desfeito.');
    desenhar();
  }
  function desenharDesfeita() {
    const n = (estado.desfeito || {}).n || 0;
    trocar(raiz, h('span', { text: n ? '↺ Desfeito: a mensagem saiu do histórico ' + sobreTarefas(n) + '.' : 'A mensagem já não estava no histórico.' }));
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
    // a mensagem no histórico do grupo (20/10/2026): a mesma em todas as telas do grupo (escolher quais, remarcar), e vai
    // junto ao concluir ou remarcar
    const msg = campoMensagem({ rotulo: 'Mensagem no histórico — vai junto ao concluir ou remarcar' });
    // remarcar (16/10/2026): hoje, o próximo dia útil ou outra data — todas do grupo, ou só as marcadas
    const quando = (ids, voltar) => {
      const hoje = hojeISO(), prox = proximoDiaUtil(hoje);
      const data = h('input', { type: 'date', value: prox, min: hoje });
      const vai = iso => remarcar(ids, iso, g, botoes, erro, msg);
      const bHoje = botao('Hoje', () => vai(hoje), 'pri');
      const bProx = botao(rotuloDia(prox, hoje), () => vai(prox));
      const bData = botao('Remarcar', () => { if (/^\d{4}-\d{2}-\d{2}$/.test(data.value)) vai(data.value); else { erro.textContent = 'Escolha a data.'; erro.hidden = false; data.focus(); } });
      const bVoltar = botao('Voltar', voltar, 'link');
      const botoes = [bHoje, bProx, bData, bVoltar];
      trocarDentro(box, cab, info, h('div', { class: 'as-cartao-pergunta', text: ids.length === 1 ? 'Remarcar pra quando?' : 'Remarcar as ' + ids.length + ' pra quando?' }), msg.el,
        h('div', { class: 'as-cartao-botoes' }, bHoje, bProx), h('div', { class: 'as-cartao-botoes' }, h('label', { class: 'as-cartao-campo' }, 'Outra data', data), bData, bVoltar), erro);
    };
    const escolher = () => {
      const lista = listaComCaixas(g.itens.map(t => itemTarefa(t, nomes)), { marcadas: false, aoMudar: () => { const k = lista.marcadas().length; ok.textContent = k ? 'Concluir ' + k : 'Concluir as marcadas'; ok.disabled = !k; rem.disabled = !k; } });
      const ok = botao('Concluir as marcadas', () => concluir(lista.marcadas(), g, [ok, rem, pular], erro, msg), 'pri');
      const rem = botao('Remarcar as marcadas', () => quando(lista.marcadas(), () => trocarDentro(box, cab, info, ...escolher(), erro)));
      ok.disabled = true; rem.disabled = true;
      return [sub('Marque as que já foram feitas (ou as que quer remarcar):'), lista.el, msg.el, h('div', { class: 'as-cartao-botoes' }, ok, rem, pular)];
    };
    if (g.avulsas) { box.append(cab, info, ...escolher(), erro); return box; }
    const principal = (montar = false) => {
      const pergunta = h('div', { class: 'as-cartao-pergunta', text: n === 1 ? 'Já foi feita?' : 'Já foram feitas?' });
      const todas = botao(n === 1 ? 'Já fiz' : 'Todas feitas (' + n + ')', () => concluir(todosIds(), g, [todas, maisBtn, remBtn, pular], erro, msg), 'pri');
      const maisBtn = botao('Escolher quais', () => { trocarDentro(box, cab, info, ...escolher(), erro); });
      const remBtn = botao('Remarcar', () => quando(todosIds(), () => principal()));
      const filhos = [cab, info, pergunta, msg.el, h('div', { class: 'as-cartao-botoes' }, todas, maisBtn, remBtn, pular), erro];
      if (montar) box.append(...filhos); else trocarDentro(box, ...filhos);
    };
    principal(true);
    return box;
  }
  // troca o que está no grupo e leva o foco pra caixa da primeira tarefa, senão pro botão principal, senão pro primeiro
  // campo ou botão — quem usa o teclado não se perde (e não cai no "✎ Mensagem no histórico", que vem antes dos botões)
  function trocarDentro(box, ...filhos) {
    box.replaceChildren(...filhos.filter(Boolean));
    const c = box.querySelector('input[type="checkbox"]') || box.querySelector('.as-botao-pri:not([disabled])') || box.querySelector('input, button:not([disabled])');
    if (c) c.focus({ preventScroll: true });
  }
  async function concluir(ids, g, botoes, erro, msg) {
    if (!ids.length) return;
    const mensagem = msg ? msg.valor() : '';
    botoes.forEach(b => { b.disabled = true; });
    if (msg) msg.travar(true);
    erro.hidden = true;
    const r = await concluirTarefas(supabase, ids, { autor: ajuda.email || null, historico: 'Tarefa concluída na revisão das atrasadas (assistente do escritório).', mensagem });
    if (r.erro && !r.concluidas.length) { erro.textContent = 'Não consegui concluir: ' + r.erro; erro.hidden = false; botoes.forEach(b => { b.disabled = false; }); if (msg) msg.travar(false); return; }
    const n = r.concluidas.length;
    // o grupo sai da revisão: as que ficaram (escolhendo quais) ainda não foram feitas
    salvar({ feitas: (estado.feitas || 0) + n, pulados: [...pulados(), g.chave],
      ultimo: { rotulo: g.avulsas ? 'Avulsas' : g.rotulo, chave: g.chave, concluidas: resumoConcluidas(r), ...(mensagem && !r.semHistorico ? { comMensagem: true } : {}), em: new Date().toISOString() } });
    if (n) { avisarTelas('mr:feito', { n }); avisarTelas('mr:tarefas-mudaram', { ids: r.concluidas.map(c => c.id) }); }
    anunciar(qtd(n, 'tarefa concluída', 'tarefas concluídas') + '. Próximo grupo.');
    desenhar();
  }
  // remarcar o grupo (ou as marcadas): o grupo sai da revisão, como no concluir; a tarefa da ficha de origem fica (o banco
  // refaria o prazo dela)
  const ORIGEM_REVISAO = 'assistente do escritório (revisão das atrasadas)';
  async function remarcar(ids, prazo, g, botoes, erro, msg) {
    if (!ids.length) return;
    const mensagem = msg ? msg.valor() : '';
    botoes.forEach(b => { b.disabled = true; });
    if (msg) msg.travar(true);
    erro.hidden = true;
    const r = await alterarTarefas(supabase, ids, { prazo }, { autor: ajuda.email || null, origem: ORIGEM_REVISAO, mensagem });
    if (r.erro && !r.alteradas.length) { erro.textContent = 'Não consegui remarcar: ' + r.erro; erro.hidden = false; botoes.forEach(b => { b.disabled = false; }); if (msg) msg.travar(false); return; }
    const n = r.alteradas.length;
    salvar({ remarcadas: (estado.remarcadas || 0) + n, pulados: [...pulados(), g.chave],
      ultimo: { tipo: 'remarcar', rotulo: g.avulsas ? 'Avulsas' : g.rotulo, chave: g.chave, prazo, alteradas: resumoAlteradas(r),
        daFicha: r.daFicha.length, telas: [...new Set(r.daFicha.map(f => f.tela))], ...(mensagem && n && !r.semHistorico ? { comMensagem: true } : {}), em: new Date().toISOString() } });
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
      const linha = h('div', { class: 'as-cartao-feito' }, h('span', { class: n ? 'as-cartao-ok' : 'as-cartao-sub', text: (n ? '✓ ' : '') + u.rotulo + ': ' + qtd(n, 'remarcada', 'remarcadas') + ' pra ' + dataBR(u.prazo)
        + (u.comMensagem ? ', com a mensagem no histórico' : '') + '.' }));
      if (u.daFicha) linha.append(h('span', { class: 'as-cartao-sub', text: qtd(u.daFicha, 'ficou', 'ficaram') + ' como estava' + (u.daFicha === 1 ? '' : 'm') + ': o prazo vem da ficha de origem' + ((u.telas || []).length ? ' (tela ' + u.telas.join(', ') + ')' : '') + '.' }));
      if (n && podeDesfazer(u.em)) linha.append(botao('Desfazer', desfazerUltimo, 'link'));
      return linha;
    }
    if (!u || !(u.concluidas || []).length) return null;
    const n = u.concluidas.length;
    if (u.desfeito) return sub('↺ ' + u.rotulo + ': conclusão desfeita.');
    const linha = h('div', { class: 'as-cartao-feito' }, h('span', { class: 'as-cartao-ok', text: '✓ ' + u.rotulo + ': ' + qtd(n, 'concluída', 'concluídas') + (u.comMensagem ? ', com a mensagem no histórico' : '') + '.' }));
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

// ---------- os arquivos da empresa (16/10/2026): a pasta dela no Drive e as guias arquivadas ----------
// Só mostra o que a função achou (o nome, a pasta, a data e o tamanho — o conteúdo ninguém leu): o nome é o link, que abre
// o arquivo no Drive numa aba nova (só endereço do Google Drive ou Docs; o resto sai sem link). Embaixo, a pasta da empresa
const TIPO_GOOGLE = { 'application/vnd.google-apps.document': 'Documento Google', 'application/vnd.google-apps.spreadsheet': 'Planilha Google',
  'application/vnd.google-apps.presentation': 'Apresentação Google', 'application/vnd.google-apps.form': 'Formulário Google' };
// o filtro do link (só Google Drive ou Docs) é o do chat, que mostra o link que o assistente manda
export { linkDoDrive };
const diaLocal = iso => { const d = new Date(iso); return iso && !isNaN(d) ? pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() : ''; };
const horaLocal = iso => { const d = new Date(iso); return iso && !isNaN(d) ? pad(d.getHours()) + 'h' + pad(d.getMinutes()) : ''; };
const tamanhoBR = n => {
  const v = Number(n);
  if (n == null || !Number.isFinite(v) || v <= 0) return '';
  if (v < 1024) return v + ' bytes';
  return v < 1024 * 1024 ? Math.max(1, Math.round(v / 1024)) + ' KB' : (v / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' MB';
};
function cartaoArquivos({ raiz, estado }) {
  raiz.setAttribute('aria-label', 'Arquivos da empresa');
  const itens = (Array.isArray(estado.itens) ? estado.itens : []).filter(x => x && typeof x === 'object' && typeof x.nome === 'string' && x.nome).slice(0, 50);
  const total = Math.max(itens.length, Math.floor(Number(estado.total)) || 0);
  const empresa = (typeof estado.empresa === 'string' && estado.empresa ? estado.empresa.slice(0, 200) : 'a empresa')
    + (typeof estado.fantasia === 'string' && estado.fantasia ? ' (' + estado.fantasia.slice(0, 120) + ')' : '');
  const termo = typeof estado.termo === 'string' ? estado.termo.trim().slice(0, 120) : '';
  const pasta = linkDoDrive(estado.pasta);
  const titulo = h('div', { class: 'as-cartao-tit' }, 'Arquivos de ' + empresa + (termo ? ' com “' + termo + '”' : ', os mais recentes') + ': ',
    h('span', { class: 'as-cartao-cont', text: String(total) }));
  // o mesmo nome mais de uma vez (a guia enviada de novo, uma cópia): a data com a hora, pra saber qual é a mais recente
  const vezes = new Map();
  itens.forEach(x => { const k = normal(x.nome); vezes.set(k, (vezes.get(k) || 0) + 1); });
  const linha = x => {
    const link = linkDoDrive(x.link);
    const quando = diaLocal(x.modificado) + (vezes.get(normal(x.nome)) > 1 && horaLocal(x.modificado) ? ', ' + horaLocal(x.modificado) : '');
    const meta = [typeof x.pasta === 'string' && x.pasta ? x.pasta.slice(0, 300) : 'pasta da empresa', quando, TIPO_GOOGLE[x.tipo] || tamanhoBR(x.tamanho), link ? '' : 'sem link']
      .filter(Boolean).join(' · ');
    const corpo = [h('b', { text: x.nome.slice(0, 300) }), h('small', { text: meta })];
    return h('li', {}, link ? h('a', { class: 'as-arquivo', href: link, target: '_blank', rel: 'noopener noreferrer' }, corpo) : h('div', { class: 'as-arquivo as-arquivo-sem' }, corpo));
  };
  const nada = !itens.length ? h('div', { class: 'as-cartao-pergunta', text: termo ? 'Nada com “' + termo + '” nos arquivos de ' + empresa + '. Tente outras palavras do nome do arquivo.' : 'Nenhum arquivo nos arquivos de ' + empresa + '.' }) : null;
  const mais = total > itens.length && itens.length ? sub('E mais ' + qtd(total - itens.length, 'arquivo', 'arquivos') + ': diga mais palavras do nome pra afinar.') : null;
  const rodape = pasta ? h('div', { class: 'as-cartao-botoes as-cartao-rodape' }, h('a', { class: 'as-botao as-botao-link', href: pasta, target: '_blank', rel: 'noopener noreferrer', text: 'Abrir a pasta da empresa no Drive' }))
    : sub('A empresa não tem a pasta do Drive no cadastro: crie ou vincule no cadastro da empresa.');
  trocar(raiz, titulo, nada, itens.length ? h('ul', { class: 'as-cartao-lista as-arquivos' }, itens.map(linha)) : null, mais, rodape);
}

// ---------- a mensagem no chat da equipe ----------
// A IA escreveu em nome de quem pede; aqui a pessoa confere, edita e envia — pra cada destino, na conversa a dois (que
// nasce se não existe) ou no grupo —, pela regra do chat (assets/js/chat-equipe.js). Os arquivos vão como o link do
// Drive (o arquivo fica lá). Cada destino tem o id da mensagem guardado no estado: tentar de novo não duplica. Depois:
// "Abrir a conversa" e o "Desfazer" por 10 minutos (apaga a mensagem — quem já leu, leu)
const chaveDestino = d => (d.grupo ? 'g:' + normal(d.grupo) : d.email);
const novoIdMsg = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : null);
// "pra Thalia", "pro grupo Escritório", "pra Diego e o grupo Escritório"
function pra(nomes) {
  const lista = nomes.length > 1 ? nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1] : nomes[0] || '';
  return /^o /.test(lista) ? 'pr' + lista : 'pra ' + lista;
}
function cartaoMensagem({ raiz, estado, salvar, ajuda, anunciar }) {
  raiz.setAttribute('aria-label', 'Mensagem no chat da equipe');
  const destinos = (Array.isArray(estado.para) ? estado.para : []).filter(d => d && typeof d === 'object' && (typeof d.email === 'string' && /@/.test(d.email) || typeof d.grupo === 'string' && d.grupo.trim()))
    .slice(0, 6).map(d => d.grupo ? { grupo: d.grupo.trim().slice(0, 80), nome: String(d.nome || d.grupo).slice(0, 80) }
      : { email: d.email.trim().toLowerCase().slice(0, 120), nome: String(d.nome || nomePorEmail(d.email) || d.email).slice(0, 80) });
  const arquivos = (Array.isArray(estado.arquivos) ? estado.arquivos : []).filter(a => a && typeof a.nome === 'string' && a.nome && linkDoDrive(a.link)).slice(0, 10)
    .map(a => ({ nome: a.nome.slice(0, 200), link: linkDoDrive(a.link), pasta: typeof a.pasta === 'string' ? a.pasta.slice(0, 300) : '' }));
  const rotulo = d => (d.grupo ? 'o grupo ' + d.nome : d.nome);
  const listaArquivos = () => (arquivos.length ? h('ul', { class: 'as-cartao-lista as-arquivos' }, arquivos.map(a => h('li', {},
    h('a', { class: 'as-arquivo', href: a.link, target: '_blank', rel: 'noopener noreferrer' }, h('b', { text: a.nome }), h('small', { text: (a.pasta || 'pasta da empresa') + ' · vai o link do Drive' }))))) : null);

  // manda pros destinos que faltam (com o texto já conferido); o que der certo fica guardado
  async function mandar(texto) {
    const ids = estado.ids && typeof estado.ids === 'object' ? { ...estado.ids } : {};
    const feitas = Array.isArray(estado.feitas) ? estado.feitas.slice() : [];
    const faltam = [];
    for (const d of destinos) {
      const k = chaveDestino(d);
      if (feitas.some(f => f.chave === k)) continue;
      if (!ids[k]) ids[k] = novoIdMsg();
      if (!ids[k]) { faltam.push({ chave: k, nome: rotulo(d), erro: 'este navegador não gera o código da mensagem' }); continue; }
      const c = await conversaDe(supabase, d, ajuda.email || '');
      if (c.erro) { faltam.push({ chave: k, nome: rotulo(d), erro: c.erro }); continue; }
      const r = await enviarMensagem(supabase, { id: ids[k], conversaId: c.id, texto: texto || null, anexos: arquivos.map(a => ({ nome: a.nome, link: a.link, pasta: a.pasta })) });
      if (r.erro) { faltam.push({ chave: k, nome: rotulo(d), erro: r.erro.replace(/\.$/, '').toLowerCase() }); continue; }
      feitas.push({ chave: k, id: ids[k], conversa_id: c.id, nome: d.grupo ? c.nome || d.nome : d.nome, grupo: !!d.grupo });
    }
    const novas = feitas.length > (Array.isArray(estado.feitas) ? estado.feitas.length : 0);
    salvar({ texto, ids, feitas, faltam, ...(feitas.length ? { estado: 'enviada' } : {}), ...(novas ? { em: new Date().toISOString() } : {}) });
    if (novas) {
      try { ajuda.reagir && ajuda.reagir(); } catch (e) { /* sem carinha */ }
      anunciar(faltam.length ? 'Parte da mensagem foi.' : 'Mensagem enviada.');
    }
    return { feitas, faltam };
  }

  function desenhar() {
    if (!destinos.length) return trocar(raiz, sub('A mensagem veio sem destino: diga pra quem é.'));
    if (estado.estado === 'cancelada') return trocar(raiz, sub('Não enviei.'));
    if (estado.estado === 'desfeita') {
      const n = (estado.desfeito || {}).n || 0;
      return trocar(raiz, h('span', { text: n ? '↺ Desfeito: ' + (n === 1 ? 'a mensagem foi apagada' : 'as mensagens foram apagadas') + ' (quem já tinha lido, leu).' : 'A mensagem já tinha mudado e ficou como estava.' }));
    }
    if (estado.estado === 'enviada') return desenharEnviada();
    const caixa = h('textarea', { rows: '4', maxlength: String(MAX_TEXTO) });
    caixa.value = typeof estado.texto === 'string' ? estado.texto.slice(0, MAX_TEXTO) : '';
    const erro = h('div', { class: 'as-cartao-erro', hidden: true });
    const ok = botao('Enviar', enviar, 'pri');
    const nao = botao('Agora não', () => { salvar({ estado: 'cancelada' }); desenhar(); });
    async function enviar() {
      const t = caixa.value.replace(/\r\n/g, '\n').trim().slice(0, MAX_TEXTO);
      if (!t && !arquivos.length) { erro.textContent = 'Escreva a mensagem.'; erro.hidden = false; caixa.focus(); return; }
      ok.disabled = true; nao.disabled = true; ok.textContent = 'Enviando…'; erro.hidden = true;
      const r = await mandar(t);
      if (!r.feitas.length) {
        erro.textContent = 'Não foi: ' + r.faltam.map(f => f.nome + ' — ' + f.erro).join(' · ') + '.';
        erro.hidden = false; ok.disabled = false; nao.disabled = false; ok.textContent = 'Enviar';
        return;
      }
      desenhar();
    }
    trocar(raiz, h('div', { class: 'as-cartao-tit', text: 'Mensagem ' + pra(destinos.map(rotulo)) }),
      h('div', { class: 'as-cartao-campos' }, h('label', { class: 'as-cartao-campo largo' }, 'A mensagem — sai em seu nome; confira antes de enviar', caixa)),
      listaArquivos(), h('div', { class: 'as-cartao-botoes' }, ok, nao), erro);
  }

  function desenharEnviada() {
    const feitas = Array.isArray(estado.feitas) ? estado.feitas : [];
    const faltam = Array.isArray(estado.faltam) ? estado.faltam : [];
    const linha = h('div', { class: 'as-cartao-feito' }, h('span', { class: 'as-cartao-ok', text: '✓ Enviada ' + pra(feitas.map(f => (f.grupo ? 'o grupo ' + f.nome : f.nome))) + '.' }));
    if (typeof ajuda.abrirConversa === 'function') feitas.forEach(f => linha.append(botao(feitas.length === 1 ? 'Abrir a conversa' : 'Abrir: ' + f.nome, () => ajuda.abrirConversa(f.conversa_id), 'link')));
    if (feitas.length && podeDesfazer(estado.em)) linha.append(botao('Desfazer', desfazer, 'link'));
    const partes = [linha];
    if (faltam.length) {
      const erro = h('div', { class: 'as-cartao-erro', text: 'Não foi ' + faltam.map(f => pra([f.nome]) + ' (' + f.erro + ')').join(', ') + '.' });
      const tentar = botao('Tentar de novo', async () => { tentar.disabled = true; tentar.textContent = 'Enviando…'; await mandar(typeof estado.texto === 'string' ? estado.texto : ''); desenhar(); }, 'link');
      partes.push(erro, h('div', { class: 'as-cartao-botoes' }, tentar));
    }
    trocar(raiz, ...partes);
  }

  async function desfazer(ev) {
    const b = ev.currentTarget;
    if (!podeDesfazer(estado.em)) { trocar(raiz, sub('Passou o tempo de desfazer por aqui: apague a mensagem na conversa (aba Equipe).')); return; }
    b.disabled = true; b.textContent = 'Desfazendo…';
    let n = 0;
    const ficaram = [];
    for (const f of (Array.isArray(estado.feitas) ? estado.feitas : [])) {
      const r = await apagarMensagem(supabase, f.id, ajuda.email || '');
      if (r.erro) ficaram.push(f.nome); else n++;
    }
    if (ficaram.length && !n) { b.disabled = false; b.textContent = 'Desfazer'; raiz.append(h('div', { class: 'as-cartao-erro', text: 'Não consegui apagar agora. Tente de novo ou apague na conversa.' })); return; }
    salvar({ estado: 'desfeita', desfeito: { n, ficaram } });
    anunciar('Desfeito.');
    desenhar();
  }
  desenhar();
}

// ---------- o vigia: o que ele achou, por grupo, com "Abrir", "Ignorar" e o que dá pra resolver ali ----------
// estado (guardado na conversa): ver ('meus' | 'todos' | 'ignorados'); pessoa (de quem — sem: quem está na tela); o
// recorte — setor, tela (o caminho da página) ou cliente_id (a ficha da empresa); os ignorados agora há pouco
// (feitos: { id: quando }) e os resolvidos agora há pouco (resolvidos: { id: { em, texto, desfazer } }), que continuam na
// lista com o "Desfazer" por 10 minutos. Ignorar só tira da lista: quem e quando o banco grava, e a aba "Ignorados" traz
// de volta. O que for arrumado na tela (ou aqui) some sozinho na conferência seguinte
const NOME_SETOR = { dp: 'DP', fiscal: 'Fiscal', contabil: 'Contábil', financeiro: 'Financeiro', comercial: 'Comercial', societario: 'Societário', irpf: 'IRPF', gestao: 'Gestão', clientes: 'Clientes', geral: 'Geral' };
const diaDe = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const horaDe = iso => { const d = new Date(iso); return isNaN(d) ? '' : pad(d.getHours()) + 'h' + pad(d.getMinutes()); };

// ---------- resolver no próprio cartão do vigia (16/10/2026) ----------
// O que dá pra resolver com um clique, pela mesma regra das telas (assets/js/tarefas-acoes.js): o responsável que falta
// (obrigação — leva as tarefas abertas junto, como em Obrigações fiscais —, tarefa e rotina), a proposta parada
// (descartar), o boleto parado (enviado, pago) e, na segunda leva, a admissão registrada, a rescisão concluída, a empresa
// da admissão e da rescisão sem vínculo (com a busca das fichas), o alvará renovado (com a data nova) e o que segue ativo
// de quem saiu da carteira (a cobrança, a obrigação). O achado só sai do banco na conferência seguinte (de hora em hora):
// aqui ele fica "resolvido", com o "Desfazer" por 10 minutos, e depois some desta máquina até a conferência
const ORIGEM_VIGIA = 'assistente do escritório (vigia)';
const RESOLVE_RESPONSAVEL = ['obrigacao_sem_responsavel', 'tarefa_responsavel', 'rotina_sem_responsavel'];
// a regra e a tabela do registro que o achado aponta: só resolve aqui o que bate (o resto é "Abrir")
const REF_DA_REGRA = { obrigacao_sem_responsavel: 'clientes', tarefa_responsavel: 'tarefas', rotina_sem_responsavel: 'rotinas', proposta_parada: 'precificacoes',
  boleto_parado: 'cobrancas_mensais', admissao_nao_registrada: 'admissoes', admissao_sem_vinculo: 'admissoes', rescisao_pagamento: 'rescisoes',
  rescisao_sem_vinculo: 'rescisoes', alvara_vencendo: 'alvaras', cobranca_ex_cliente: 'cobrancas_config', obrigacao_ex_cliente: 'cliente_obrigacoes',
  cliente_sem_obrigacao: 'clientes', cliente_sem_cobranca: 'clientes', cadastro_desencontrado: 'clientes',
  obrigacao_desligada: 'cliente_obrigacoes', obrigacao_sem_tarefa: 'cliente_obrigacoes' };
const resolvivel = a => !!a && ID.test(String(a.ref_id || '')) && !!REF_DA_REGRA[a.regra] && REF_DA_REGRA[a.regra] === a.ref_tabela;
// o mês do achado "sem a tarefa do mês": o do prazo dele (o dia do vínculo naquele mês) → { ano, mes } | null
const mesDoAchado = a => { const m = /^(\d{4})-(\d{2})/.exec(String((a && a.prazo) || '')); return m ? { ano: Number(m[1]), mes: Number(m[2]) } : null; };
const SITUACAO_FICHA = { respondida: 'recebida — a registrar', em_registro: 'em registro', registrada: 'registrada', recebida: 'recebida — a calcular',
  em_andamento: 'em andamento', concluida: 'concluída', cancelada: 'cancelada', aguardando_empresa: 'aguardando a empresa' };
const maisDias = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const docBR = v => { const s = String(v || '').replace(/\D/g, ''); return s.length === 14 ? s.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  : s.length === 11 ? s.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4') : String(v || ''); };
const NADA_VOLTOU = 'nada-voltou';   // o desfazer não achou o que voltar: alguém mexeu depois
// resolve e devolve { texto, desfazer, segue? } (o que o cartão guarda pro "Desfazer"; segue = o vigia continua avisando) ou { erro }
async function resolverAchado(a, escolha, ajuda) {
  const autor = ajuda.email || null;
  const quem = pessoaDaEquipe(escolha);
  if (RESOLVE_RESPONSAVEL.includes(a.regra) && !quem) return { erro: 'Escolha quem vai cuidar.' };
  if (a.regra === 'obrigacao_sem_responsavel') {
    const r = await definirResponsavelObrigacoes(supabase, a.ref_id, quem, { autor, origem: ORIGEM_VIGIA });
    if (r.erro && !r.vinculos.length) return { erro: r.erro };
    if (!r.vinculos.length) return { erro: 'As obrigações dela já têm responsável: confira na tela Obrigações fiscais.' };
    if (r.tarefas.length) avisarTelas('mr:tarefas-mudaram', { ids: r.tarefas.map(t => t.id) });
    return { texto: qtd(r.vinculos.length, 'obrigação passada', 'obrigações passadas') + ' pra ' + quem + (r.tarefas.length ? ' (e ' + qtd(r.tarefas.length, 'tarefa aberta', 'tarefas abertas') + ')' : '') + '.',
      aviso: r.erro || null, desfazer: { tipo: 'obrigacoes', responsavel: quem, vinculos: r.vinculos, tarefas: r.tarefas } };
  }
  if (a.regra === 'tarefa_responsavel') {
    const r = await alterarTarefas(supabase, [a.ref_id], { responsavel: quem }, { autor, origem: ORIGEM_VIGIA });
    if (r.erro && !r.alteradas.length) return { erro: r.erro };
    if (r.daFicha.length) return { erro: 'O responsável dela vem da ficha de origem: mude na tela ' + r.daFicha[0].tela + '.' };
    if (!r.alteradas.length) return { erro: r.fechadas.length ? 'A tarefa já foi concluída (ou não existe mais).' : 'A tarefa já está com alguém da equipe.' };
    avisarTelas('mr:tarefas-mudaram', { ids: [String(a.ref_id)] });
    return { texto: 'Tarefa passada pra ' + quem + '.', desfazer: { tipo: 'tarefa', alteradas: resumoAlteradas(r) } };
  }
  if (a.regra === 'rotina_sem_responsavel') {
    const r = await definirResponsavelRotina(supabase, a.ref_id, quem);
    if (r.erro) return { erro: r.erro };
    if (!r.rotina) return { erro: r.jaTinha ? 'A rotina já está com ' + r.jaTinha + '.' : 'A rotina mudou no meio do caminho: confira na tela.' };
    return { texto: 'Rotina passada pra ' + quem + '.', desfazer: { tipo: 'rotina', responsavel: quem, rotina: r.rotina } };
  }
  if (a.regra === 'proposta_parada') {
    const r = await descartarProposta(supabase, a.ref_id);
    if (r.erro) return { erro: r.erro };
    if (!r.proposta) return { erro: r.ja ? 'A proposta já está "' + r.ja + '".' : 'A proposta mudou no meio do caminho: confira na tela Precificação.' };
    if (r.proposta.tarefas.length) avisarTelas('mr:tarefas-mudaram', { ids: r.proposta.tarefas });
    return { texto: 'Proposta descartada' + (r.proposta.tarefas.length ? ' (e a tarefa dela, concluída)' : '') + '.', desfazer: { tipo: 'proposta', proposta: r.proposta } };
  }
  if (a.regra === 'boleto_parado') {
    const r = await avancarBoletos(supabase, [a.ref_id], escolha);
    if (r.erro) return { erro: r.erro };
    if (!r.mudados.length) return { erro: 'O boleto já estava assim (ou mais à frente).' };
    avisarTelas('mr:boletos-mudaram', { mudancas: r.mudados.map(b => ({ id: b.id, status: escolha })) });
    return { texto: 'Boleto marcado como ' + (SITUACAO_BOLETO[escolha] || escolha) + '.', desfazer: { tipo: 'boleto', status: escolha, mudados: r.mudados } };
  }
  if (a.regra === 'admissao_nao_registrada' || a.regra === 'rescisao_pagamento') {
    const adm = a.ref_tabela === 'admissoes';
    const r = await fecharFicha(supabase, a.ref_tabela, a.ref_id, { autor });
    if (r.erro) return { erro: r.erro };
    if (!r.ficha) return { erro: r.ja ? 'Ela já está "' + (SITUACAO_FICHA[r.ja] || r.ja) + '".' : 'Ela mudou no meio do caminho: confira na tela ' + (adm ? 'Admissões' : 'Rescisões') + '.' };
    avisarTelas('mr:feito', { n: 1 });
    avisarTelas('mr:tarefas-mudaram', { ids: [] });
    return { texto: adm ? 'Admissão registrada (e a tarefa dela, concluída).' : 'Rescisão concluída (e a tarefa dela também).', desfazer: { tipo: 'ficha', ficha: r.ficha } };
  }
  if (a.regra === 'admissao_sem_vinculo' || a.regra === 'rescisao_sem_vinculo') {
    const c = escolha && typeof escolha === 'object' && ID.test(String(escolha.id || '')) ? escolha : null;
    if (!c) return { erro: 'Escolha a empresa.' };
    const r = await vincularEmpresa(supabase, a.ref_tabela, a.ref_id, c.id);
    if (r.erro) return { erro: r.erro };
    if (!r.ficha) return { erro: r.ja ? 'Ela já foi vinculada a uma empresa: confira na tela.' : 'Ela mudou no meio do caminho: confira na tela.' };
    avisarTelas('mr:tarefas-mudaram', { ids: [] });
    return { texto: 'Vinculada a ' + String(c.nome || 'empresa do cadastro') + '.', desfazer: { tipo: 'vinculo', ficha: r.ficha } };
  }
  if (a.regra === 'alvara_vencendo') {
    const r = await renovarAlvara(supabase, a.ref_id, escolha, { autor, origem: ORIGEM_VIGIA, hoje: hojeISO() });
    if (r.erro) return { erro: r.erro };
    avisarTelas('mr:tarefas-mudaram', { ids: [] });
    // a renovação curta (vence em até 30 dias) continua no vigia: não sai desta máquina
    const segue = r.alvara.vencimento <= maisDias(hojeISO(), 30);
    return { texto: 'Renovado até ' + dataBR(r.alvara.vencimento) + '.' + (segue ? ' Vence em menos de 30 dias: o vigia continua avisando.' : ''), segue,
      desfazer: { tipo: 'alvara', alvara: r.alvara } };
  }
  if (a.regra === 'cobranca_ex_cliente' || a.regra === 'obrigacao_ex_cliente') {
    const r = await desativarRegistro(supabase, a.ref_tabela, a.ref_id);
    if (r.erro) return { erro: r.erro };
    if (!r.desativado) return { erro: 'Já estava desativada: confira na tela.' };
    return { texto: a.regra === 'cobranca_ex_cliente' ? 'Cobrança parada: sai da base de boletos.' : 'Obrigação desativada (as tarefas já criadas ficam).',
      desfazer: { tipo: 'desativado', feito: r.desativado } };
  }
  if (a.regra === 'cliente_sem_obrigacao') {
    const e = escolha && typeof escolha === 'object' ? escolha : {};
    const r = await vincularObrigacoes(supabase, a.ref_id, e.ids || [], e.responsavel);
    if (r.erro && !r.feitos.length) return { erro: r.erro };
    if (!r.feitos.length) return { erro: 'Ela já tinha essas obrigações: confira na tela Obrigações fiscais.' };
    const quem = pessoaDaEquipe(e.responsavel);
    return { texto: qtd(r.feitos.length, 'obrigação vinculada', 'obrigações vinculadas') + ', com ' + quem + '. As tarefas saem na próxima geração do mês, em Obrigações fiscais.',
      aviso: r.erro || null, desfazer: { tipo: 'obrigacoes_vinc', cliente_id: String(a.ref_id), feitos: r.feitos } };
  }
  if (a.regra === 'cliente_sem_cobranca') {
    const e = escolha && typeof escolha === 'object' ? escolha : {};
    const r = await porNaCobranca(supabase, a.ref_id, { valor: e.valor, dia: e.dia });
    if (r.erro) return { erro: r.erro };
    if (!r.feito) return { erro: r.ja ? 'Ela já está na base de boletos.' : 'A base de boletos mudou no meio do caminho: confira na tela Boletos.' };
    return { texto: 'Na cobrança: ' + brl(r.feito.valor) + ', vencimento dia ' + r.feito.dia + ' (canal WhatsApp — o contato e o destino se acertam na grade de Boletos).',
      desfazer: { tipo: 'cobranca', feito: r.feito } };
  }
  if (a.regra === 'cadastro_desencontrado') {
    const r = await acertarCadastro(supabase, a.ref_id, { hoje: hojeISO() });
    if (r.erro) return { erro: r.erro };
    if (!r.cliente) return { erro: 'O cadastro já está "' + (r.ja || '') + '".' };
    return { texto: 'Cadastro marcado como ' + r.cliente.para + (r.cliente.para === 'inativo' && r.cliente.fim && r.cliente.fim !== r.cliente.fim_antes ? ' (fim como cliente: ' + dataBR(r.cliente.fim) + ')' : '') + '.',
      desfazer: { tipo: 'cadastro', cliente: r.cliente } };
  }
  // a quarta leva (20/10/2026): a obrigação comum desligada volta a ligar (com quem cuida e, se ela vence no mês, a tarefa
  // dele), e o vínculo ligado que ficou sem a tarefa do mês ganha ela — a mesma montagem da tela Obrigações fiscais
  if (a.regra === 'obrigacao_desligada') {
    const e = escolha && typeof escolha === 'object' ? escolha : {};
    const para = pessoaDaEquipe(e.responsavel);
    if (!para || para === 'Ambos') return { erro: 'Escolha quem vai cuidar.' };
    const r = await religarVinculo(supabase, a.ref_id, para);
    if (r.erro && !r.feitos.length) return { erro: r.erro };
    if (!r.feitos.length) return { erro: 'Ela já está ligada: confira na tela Obrigações fiscais.' };
    let tarefa = null, aviso = r.erro || null;
    if (e.mes) {
      const t = await criarTarefaDoMes(supabase, a.ref_id, e.mes);
      if (t.tarefa) { tarefa = t.tarefa; avisarTelas('mr:tarefas-mudaram', { ids: [t.tarefa.id] }); }
      else if (t.erro) aviso = 'A tarefa do mês não foi criada: ' + t.erro;
    }
    return { texto: 'Religada, com ' + para + (tarefa ? ', e a tarefa de ' + mesBR(tarefa.competencia) + ' criada (prazo ' + dataBR(tarefa.prazo) + ')' : '') + '.',
      aviso, desfazer: { tipo: 'religada', cliente_id: r.cliente_id, feitos: r.feitos, tarefas: tarefa ? [tarefa.id] : [] } };
  }
  if (a.regra === 'obrigacao_sem_tarefa') {
    const mes = mesDoAchado(a);
    if (!mes) return { erro: 'Não sei de que mês é: crie em Obrigações fiscais.' };
    const t = await criarTarefaDoMes(supabase, a.ref_id, mes);
    if (t.erro) return { erro: t.erro };
    if (t.ja) return { erro: 'A tarefa de ' + pad(mes.mes) + '/' + mes.ano + ' já existe: confira na Agenda.' };
    avisarTelas('mr:tarefas-mudaram', { ids: [t.tarefa.id] });
    return { texto: 'Tarefa de ' + mesBR(t.tarefa.competencia) + ' criada' + (t.tarefa.responsavel ? ' pra ' + t.tarefa.responsavel : ' (sem responsável)') + ', prazo ' + dataBR(t.tarefa.prazo) + '.',
      desfazer: { tipo: 'tarefa_mes', tarefas: [t.tarefa.id] } };
  }
  return { erro: 'Esse achado se resolve na tela dele.' };
}
// desfaz e devolve { erro } — erro também quando nada voltou (alguém mexeu depois)
async function desfazerResolucao(d, ajuda) {
  const autor = ajuda.email || null;
  const nada = (r, voltou) => ({ erro: r.erro || (voltou ? null : NADA_VOLTOU) });
  if (!d || typeof d !== 'object') return { erro: 'Não há o que desfazer.' };
  if (d.tipo === 'obrigacoes') {
    const r = await desfazerResponsavelObrigacoes(supabase, d, d.responsavel, { autor, origem: ORIGEM_VIGIA });
    if (r.tarefas.length) avisarTelas('mr:tarefas-mudaram', { ids: r.tarefas });
    return nada(r, r.vinculos > 0 || r.tarefas.length > 0);
  }
  if (d.tipo === 'tarefa') {
    const r = await desfazerAlteracao(supabase, d.alteradas || [], { autor, origem: ORIGEM_VIGIA });
    if (r.desfeitas.length) avisarTelas('mr:tarefas-mudaram', { ids: r.desfeitas });
    return nada(r, r.desfeitas.length > 0);
  }
  if (d.tipo === 'rotina') { const r = await desfazerResponsavelRotina(supabase, d.rotina, d.responsavel); return nada(r, r.desfeita); }
  if (d.tipo === 'proposta') {
    const r = await desfazerDescarte(supabase, d.proposta);
    if (r.tarefas.length) avisarTelas('mr:tarefas-mudaram', { ids: r.tarefas });
    return nada(r, r.desfeita);
  }
  if (d.tipo === 'boleto') {
    const r = await voltarBoletos(supabase, d.mudados || [], d.status);
    if (r.desfeitos.length) avisarTelas('mr:boletos-mudaram', { mudancas: r.desfeitos });
    return nada(r, r.desfeitos.length > 0);
  }
  if (d.tipo === 'ficha' || d.tipo === 'vinculo' || d.tipo === 'alvara') {
    const r = d.tipo === 'ficha' ? await reabrirFicha(supabase, d.ficha) : d.tipo === 'vinculo' ? await desvincularEmpresa(supabase, d.ficha)
      : await desfazerRenovacao(supabase, d.alvara, { autor, origem: ORIGEM_VIGIA });
    if (r.desfeita) avisarTelas('mr:tarefas-mudaram', { ids: [] });
    return nada(r, r.desfeita);
  }
  if (d.tipo === 'desativado') { const r = await reativarRegistro(supabase, d.feito); return nada(r, r.desfeita); }
  if (d.tipo === 'obrigacoes_vinc') { const r = await desfazerVinculoObrigacoes(supabase, d.cliente_id, d.feitos); return nada(r, r.desfeitos > 0); }
  if (d.tipo === 'cobranca') { const r = await desfazerCobranca(supabase, d.feito); return nada(r, r.desfeita); }
  if (d.tipo === 'cadastro') { const r = await desfazerCadastro(supabase, d.cliente); return nada(r, r.desfeita); }
  // a tarefa do mês criada aqui sai (só a que continua pendente); a obrigação religada desliga de novo, com quem cuidava
  if (d.tipo === 'tarefa_mes' || d.tipo === 'religada') {
    let voltou = false, erro = null;
    if (idsDe(d.tarefas).length) {
      const t = await excluirTarefasCriadas(supabase, idsDe(d.tarefas));
      if (t.excluidas.length) { voltou = true; avisarTelas('mr:tarefas-mudaram', { ids: t.excluidas }); }
      erro = t.erro;
    }
    if (d.tipo === 'religada') {
      const r = await desfazerVinculoObrigacoes(supabase, d.cliente_id, d.feitos || []);
      if (r.desfeitos > 0) voltou = true;
      erro = erro || r.erro;
    }
    return { erro: erro || (voltou ? null : NADA_VOLTOU) };
  }
  return { erro: 'Não há o que desfazer.' };
}

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
  // os "Desfazer" que ainda valem (os de mais de 10 minutos saem): os ignorados e os resolvidos agora
  const feitos = () => Object.fromEntries(Object.entries(estado.feitos && typeof estado.feitos === 'object' ? estado.feitos : {}).filter(([id, em]) => ID.test(id) && podeDesfazer(em)));
  const resolvidos = () => Object.fromEntries(Object.entries(estado.resolvidos && typeof estado.resolvidos === 'object' ? estado.resolvidos : {})
    .filter(([id, x]) => ID.test(id) && x && typeof x === 'object' && podeDesfazer(x.em)));
  const recorte = () => ({ setor: NOME_SETOR[estado.setor] ? estado.setor : null, tela: !estado.cliente_id && typeof estado.tela === 'string' ? estado.tela.slice(0, 120) : null,
    clienteId: ID.test(String(estado.cliente_id || '')) ? String(estado.cliente_id) : null });
  const nomeRecorte = r => (r.clienteId ? 'desta empresa' : r.tela ? 'nesta tela' : r.setor ? 'no ' + NOME_SETOR[r.setor] : '');

  async function desenhar() {
    if (!raiz.childNodes.length) trocar(raiz, sub('Lendo o que o vigia achou…'));
    let lista;
    try { lista = await lerAchados(supabase); }
    catch (e) { return trocar(raiz, h('div', { class: 'as-cartao-erro', text: 'Não consegui ler o que o vigia achou agora.' }), h('div', { class: 'as-cartao-botoes' }, botao('Tentar de novo', desenhar))); }
    marcarVisto(email);
    const r = recorte(), f = feitos(), rs = resolvidos(), ja = resolvidosAgora(email), m = modo(), onde = nomeRecorte(r);
    // resolvido aqui e já tirado do banco pela conferência (de hora em hora) dentro dos 10 minutos: continua com o "Desfazer"
    const faltam = Object.keys(rs).filter(id => !lista.some(a => String(a.id) === id));
    if (faltam.length) {
      try { lista = lista.concat((await lerPorIds('vigia_achados', COLUNAS, faltam)).filter(a => a.situacao === 'resolvido').map(a => ({ ...a, situacao: 'aberto', _conferido: true }))); }
      catch (e) { /* sem eles: o "Desfazer" some antes da hora */ }
    }
    // o resolvido agora: com o "Desfazer" nos primeiros 10 minutos; depois (ou resolvido em outra tela), fora até a conferência
    const base = lista.filter(a => !(a.situacao === 'aberto' && ja.has(String(a.id)) && !rs[a.id]))
      .map(a => (a.situacao === 'ignorado' && f[a.id] ? { ...a, _agora: true } : a.situacao === 'aberto' && rs[a.id] ? { ...a, _resolvido: rs[a.id] } : a));
    const doModo = md => filtrarAchados(base, { nome: pessoa, socio, todos: md !== 'meus', ...r, situacao: null })
      .filter(a => (md === 'ignorados' ? a.situacao === 'ignorado' && !a._agora : a.situacao === 'aberto' || a._agora));
    const conta = md => doModo(md).filter(a => !a._agora && !a._resolvido).length;
    const itens = doModo(m);
    const titulo = (m === 'ignorados' ? 'Ignorados' : m === 'todos' ? 'O que o vigia achou' : minha ? 'O que o vigia achou pra você' : 'O que o vigia achou pra ' + pessoa) + (onde ? ' ' + onde : '') + ': ';
    const topo = h('div', { class: 'as-cartao-tit' }, titulo, h('span', { class: 'as-cartao-cont', text: String(itens.filter(a => !a._agora && !a._resolvido).length) }));
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
      a.detalhe ? h('small', { text: a.detalhe }) : null, m !== 'meus' && a.responsavel && !a._resolvido ? h('small', { text: 'Com ' + a.responsavel + '.' }) : null];
    let acoes;
    if (m === 'ignorados') {
      const quem = a.ignorado_por ? nomePorEmail(a.ignorado_por) || a.ignorado_por : null;
      acoes = [h('span', { class: 'as-cartao-sub', text: 'Ignorado' + (quem ? ' por ' + quem : '') + (a.ignorado_em ? ' em ' + dataBR(diaDe(a.ignorado_em)) : '') + '.' }),
        botao('Voltar a mostrar', ev => reabrir(a, ev.currentTarget), 'link')];
    } else if (a._agora) {
      acoes = [h('span', { class: 'as-cartao-sub', text: 'Ignorado.' }), botao('Desfazer', ev => reabrir(a, ev.currentTarget), 'link')];
    } else if (a._resolvido) {
      acoes = [h('span', { class: 'as-cartao-ok', text: '✓ ' + String(a._resolvido.texto || 'Resolvido.') }),
        h('span', { class: 'as-cartao-sub', text: 'Sai da lista na conferência seguinte.' }), botao('Desfazer', ev => desfazerUm(a, ev.currentTarget), 'link')];
    } else {
      acoes = [href ? h('a', { class: 'as-botao as-botao-link', href: new URL(href, RAIZ).href, text: 'Abrir' }) : null, botao('Ignorar', ev => ignorar(a, ev.currentTarget), 'link')];
    }
    const controles = m !== 'ignorados' && !a._agora && !a._resolvido && resolvivel(a) ? controlesDeResolver(a) : null;
    return h('li', { class: 'as-vigia-item' + (a._agora || a._resolvido ? ' as-vigia-ignorado' : '') }, linhas, controles, h('div', { class: 'as-vigia-acoes' }, acoes));
  }
  // os botões que resolvem ali mesmo: quem vai cuidar (o dono do setor já marcado), descartar a proposta, o boleto enviado
  // ou pago (o vigia pega o "a emitir" e o "emitido" — marcar como emitido não tiraria o achado)
  function controlesDeResolver(a) {
    const linha = h('div', { class: 'as-vigia-resolver' });
    if (RESOLVE_RESPONSAVEL.includes(a.regra)) {
      // a obrigação é de uma pessoa (como em Obrigações fiscais); a tarefa e a rotina aceitam "Ambos" (os sócios)
      const nomes = a.regra === 'obrigacao_sem_responsavel' ? EQUIPE : [...EQUIPE, 'Ambos'];
      const sel = h('select', { 'aria-label': 'Quem vai cuidar' }, h('option', { value: '', text: 'Quem vai cuidar…' }), nomes.map(n => h('option', { value: n, text: n })));
      sel.value = pessoaDaEquipe(a.responsavel) || '';
      const ok = botao('Definir responsável', ev => resolver(a, sel.value, ev.currentTarget), 'pri');
      ok.disabled = !sel.value;
      sel.addEventListener('change', () => { ok.disabled = !sel.value; });
      linha.append(sel, ok);
    } else if (a.regra === 'proposta_parada') {
      linha.append(botao('Descartar proposta', ev => resolver(a, 'descartar', ev.currentTarget)));
    } else if (a.regra === 'boleto_parado') {
      ['enviado', 'pago'].forEach(st => linha.append(botao('Marcar como ' + SITUACAO_BOLETO[st], ev => resolver(a, st, ev.currentTarget))));
    } else if (a.regra === 'admissao_nao_registrada' || a.regra === 'rescisao_pagamento') {
      linha.append(botao(a.regra === 'admissao_nao_registrada' ? 'Marcar como registrada' : 'Marcar como concluída', ev => resolver(a, null, ev.currentTarget)));
    } else if (a.regra === 'admissao_sem_vinculo' || a.regra === 'rescisao_sem_vinculo') {
      linha.append(botao('Vincular a empresa', () => abrirBusca(a, linha)));
    } else if (a.regra === 'alvara_vencendo') {
      const quando = h('input', { type: 'date', 'aria-label': 'Novo vencimento do alvará' });
      quando.min = maisDias(hojeISO(), 1);
      const ok = botao('Renovar', ev => resolver(a, quando.value, ev.currentTarget), 'pri');
      ok.disabled = true;
      ['input', 'change'].forEach(t => quando.addEventListener(t, () => { ok.disabled = !quando.value; }));
      linha.append(h('label', { class: 'as-vigia-campo' }, h('span', { text: 'Renovado até' }), quando), ok);
    } else if (a.regra === 'cobranca_ex_cliente' || a.regra === 'obrigacao_ex_cliente') {
      linha.append(botao(a.regra === 'cobranca_ex_cliente' ? 'Parar a cobrança' : 'Desativar a obrigação', ev => resolver(a, null, ev.currentTarget)));
    } else if (a.regra === 'cliente_sem_obrigacao') {
      linha.append(botao('Vincular obrigações', () => abrirObrigacoes(a, linha)));
    } else if (a.regra === 'cliente_sem_cobranca') {
      linha.append(botao('Pôr na cobrança', () => abrirCobranca(a, linha)));
    } else if (a.regra === 'cadastro_desencontrado') {
      // o título diz o lado: saiu da carteira (o cadastro vira inativo) ou está nela (vira ativo); a regra confere de novo
      linha.append(botao('Marcar o cadastro como ' + (/saiu da carteira/i.test(String(a.titulo || '')) ? 'inativo' : 'ativo'), ev => resolver(a, null, ev.currentTarget)));
    } else if (a.regra === 'obrigacao_desligada') {
      linha.append(botao('Religar', () => abrirReligar(a, linha)));
    } else if (a.regra === 'obrigacao_sem_tarefa') {
      const m = mesDoAchado(a);
      linha.append(botao(m ? 'Criar a tarefa de ' + pad(m.mes) + '/' + m.ano : 'Criar a tarefa do mês', ev => resolver(a, null, ev.currentTarget)));
    }
    return linha;
  }
  // religar a obrigação desligada (a quarta leva, 20/10/2026): quem vai cuidar (o dono já escolhido) e, se ela vence neste
  // mês e a empresa ainda não tem a tarefa dele, "Criar já a tarefa de MM/AAAA" marcada — como o religar da tela Obrigações
  // fiscais
  async function abrirReligar(a, linha) {
    const caixa = h('div', { class: 'as-vigia-resolver as-vigia-busca' }, sub('Lendo a obrigação…'));
    linha.replaceWith(caixa);
    const voltar = () => caixa.replaceWith(controlesDeResolver(a));
    const hoje = hojeISO(), mes = { ano: Number(hoje.slice(0, 4)), mes: Number(hoje.slice(5, 7)) };
    let p;
    try { p = await tarefaDoMesDoVinculo(supabase, a.ref_id, mes); } catch (e) { p = { erro: (e && e.message) || 'erro' }; }
    // a obrigação que não vence neste mês ainda religa (só não cria a tarefa)
    if (p.erro && !p.obrigacao) { caixa.replaceChildren(h('div', { class: 'as-cartao-erro', text: p.erro }), botao('Voltar', voltar, 'link')); return; }
    if (p.vinculo && p.vinculo.ativo) { caixa.replaceChildren(h('div', { class: 'as-cartao-ok', text: '✓ Ela já está ligada de novo: some na conferência seguinte.' }), botao('Voltar', voltar, 'link')); return; }
    const sel = h('select', { 'aria-label': 'Quem vai cuidar' }, h('option', { value: '', text: 'Quem vai cuidar…' }), EQUIPE.map(n => h('option', { value: n, text: n })));
    const dono = pessoaDaEquipe((p.vinculo && p.vinculo.responsavel) || a.responsavel);
    sel.value = dono && dono !== 'Ambos' ? dono : '';
    const criar = !p.erro && p.tarefa && !p.ja ? h('input', { type: 'checkbox', checked: true }) : null;
    const ok = botao('Religar', ev => resolver(a, { responsavel: sel.value, mes: criar && criar.checked ? mes : null }, ev.currentTarget), 'pri');
    const conferir = () => { ok.disabled = !sel.value; };
    sel.addEventListener('change', conferir);
    caixa.replaceChildren(
      criar ? h('label', { class: 'as-cartao-item' }, criar, h('span', { text: 'Criar já a tarefa de ' + pad(mes.mes) + '/' + mes.ano
        + ' (prazo ' + dataBR(p.tarefa.prazo) + (p.tarefa.prazo < hoje ? ', já vencido' : '') + '), pra ela ir pra agenda' })) : null,
      h('div', { class: 'as-vigia-busca-linha' }, sel, ok, botao('Cancelar', voltar, 'link')));
    conferir();
    try { caixa.scrollIntoView({ block: 'nearest' }); } catch (e) { /* sem rolagem */ }
  }
  // as obrigações do regime da empresa, com as sugeridas já marcadas (as que a maioria das empresas do regime tem e o DEISS
  // da cidade dela) e as outras num "ver as outras"; quem vai cuidar e "Vincular as marcadas"
  async function abrirObrigacoes(a, linha) {
    const caixa = h('div', { class: 'as-vigia-resolver as-vigia-busca' }, sub('Lendo as obrigações do regime…'));
    linha.replaceWith(caixa);
    const voltar = () => caixa.replaceWith(controlesDeResolver(a));
    let r;
    try { r = await obrigacoesParaVincular(supabase, a.ref_id); } catch (e) { r = { erro: (e && e.message) || 'erro', opcoes: [] }; }
    if (r.erro || !r.opcoes.length) {
      caixa.replaceChildren(h('div', { class: 'as-cartao-erro', text: r.erro || 'Nenhuma obrigação do regime dela está cadastrada: vincule na tela Obrigações fiscais.' }), botao('Voltar', voltar, 'link'));
      return;
    }
    const reg = r.cliente.regime;
    const item = o => ({ id: o.id, marcada: o.sugerida, titulo: o.nome, sub: o.cidade ? 'o DEISS da cidade dela' : o.total ? o.n + ' de ' + o.total + ' empresas do ' + reg + ' têm' : '' });
    const sug = r.opcoes.filter(o => o.sugerida), outras = r.opcoes.filter(o => !o.sugerida);
    const sel = h('select', { 'aria-label': 'Quem vai cuidar' }, h('option', { value: '', text: 'Quem vai cuidar…' }), EQUIPE.map(n => h('option', { value: n, text: n })));
    const dono = pessoaDaEquipe(a.responsavel);
    sel.value = dono && dono !== 'Ambos' ? dono : '';
    const ok = botao('Vincular', ev => resolver(a, { ids: marcadas(), responsavel: sel.value }, ev.currentTarget), 'pri');
    const atualizar = () => {
      const n = marcadas().length;
      ok.textContent = n ? 'Vincular ' + (n === 1 ? 'a marcada' : 'as ' + n + ' marcadas') : 'Marque as obrigações';
      ok.disabled = !n || !sel.value;
    };
    const l1 = sug.length ? listaComCaixas(sug.map(item), { aoMudar: () => atualizar() }) : null;
    const l2 = outras.length ? listaComCaixas(outras.map(item), { aoMudar: () => atualizar() }) : null;
    const marcadas = () => [...(l1 ? l1.marcadas() : []), ...(l2 ? l2.marcadas() : [])];
    sel.addEventListener('change', atualizar);
    caixa.replaceChildren(
      sub(sug.length ? 'Já marcadas: as que a maioria das empresas do ' + reg + ' tem' + (sug.some(o => o.cidade) ? ' e o DEISS da cidade dela' : '') + '. Confira antes de vincular.'
        : 'Nenhuma é comum à maioria das empresas do ' + reg + ': marque as dela.'),
      l1 ? l1.el : null,
      l2 ? h('details', { class: 'as-vigia-outras' }, h('summary', { text: (sug.length ? 'As outras do ' : 'As do ') + reg + ' (' + outras.length + ')' }), l2.el) : null,
      h('div', { class: 'as-vigia-busca-linha' }, sel, ok, botao('Cancelar', voltar, 'link')));
    atualizar();
    try { caixa.scrollIntoView({ block: 'nearest' }); } catch (e) { /* sem rolagem */ }
  }
  // a empresa na base de boletos: o valor e o dia (sugeridos pela cobrança parada ou pela proposta fechada)
  async function abrirCobranca(a, linha) {
    const caixa = h('div', { class: 'as-vigia-resolver' }, sub('Lendo a base de boletos…'));
    linha.replaceWith(caixa);
    const voltar = () => caixa.replaceWith(controlesDeResolver(a));
    let d;
    try { d = await dadosDaCobranca(supabase, a.ref_id); } catch (e) { d = { erro: (e && e.message) || 'erro' }; }
    if (d.erro) { caixa.replaceChildren(h('div', { class: 'as-cartao-erro', text: 'Não consegui ler a base de boletos: ' + d.erro }), botao('Voltar', voltar, 'link')); return; }
    const valor = h('input', { type: 'number', class: 'as-vigia-valor', 'aria-label': 'Valor da cobrança, em reais', placeholder: '0,00' });
    valor.min = '0.01'; valor.step = '0.01';
    if (d.valor) valor.value = String(d.valor);
    const dia = h('input', { type: 'number', class: 'as-vigia-dia', 'aria-label': 'Dia do vencimento' });
    dia.min = '1'; dia.max = '31'; dia.step = '1'; dia.value = String(d.dia || 10);
    const ok = botao('Pôr na cobrança', ev => resolver(a, { valor: valor.value, dia: Number(dia.value) }, ev.currentTarget), 'pri');
    const conferir = () => { ok.disabled = !(Number(valor.value) > 0) || !(Number.isInteger(Number(dia.value)) && Number(dia.value) >= 1 && Number(dia.value) <= 31); };
    [valor, dia].forEach(x => ['input', 'change'].forEach(t => x.addEventListener(t, conferir)));
    caixa.replaceChildren(h('label', { class: 'as-vigia-campo' }, h('span', { text: 'Valor (R$)' }), valor),
      h('label', { class: 'as-vigia-campo' }, h('span', { text: 'Vence dia' }), dia), ok, botao('Cancelar', voltar, 'link'),
      d.config ? sub('Ela já teve cobrança na base, parada: volta a valer com estes dados.') : null);
    conferir();
    valor.focus({ preventScroll: true });
  }
  // a busca da empresa (a mesma das fichas de Admissões e Rescisões), começando pelo nome que a empresa digitou no link;
  // escolher a empresa já vincula (o "Desfazer" tira)
  function abrirBusca(a, linha) {
    const campo = h('input', { type: 'search', 'aria-label': 'Buscar a empresa no cadastro', placeholder: 'Nome, fantasia ou CNPJ' });
    const lista = h('div', { class: 'as-vigia-empresas' });
    let vez = 0, timer = null;
    const buscar = async () => {
      const esta = ++vez;
      if (campo.value.trim().length < 3) { lista.replaceChildren(sub('Digite pelo menos 3 letras.')); return; }
      lista.replaceChildren(sub('Buscando…'));
      let r;
      try { r = await buscarEmpresas(supabase, campo.value, 6); } catch (e) { r = { empresas: [], erro: (e && e.message) || 'erro' }; }
      if (esta !== vez) return;   // a resposta de uma busca que já ficou pra trás
      if (r.erro) { lista.replaceChildren(h('div', { class: 'as-cartao-erro', text: 'Não consegui buscar: ' + r.erro })); return; }
      if (!r.empresas.length) { lista.replaceChildren(sub('Nada encontrado no cadastro.')); return; }
      lista.replaceChildren(...r.empresas.map(c => {
        const b = h('button', { type: 'button', class: 'as-vigia-empresa' }, h('b', { text: c.nome_principal || 'Sem nome' }),
          h('small', { text: [c.nome_fantasia, c.documento ? docBR(c.documento) : '', c.cidade].filter(Boolean).join(' · ') || ' ' }));
        b.addEventListener('click', () => resolver(a, { id: String(c.id), nome: c.nome_principal }, b));
        return b;
      }));
    };
    campo.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(buscar, 300); });
    const caixa = h('div', { class: 'as-vigia-resolver as-vigia-busca' },
      h('div', { class: 'as-vigia-busca-linha' }, campo, botao('Cancelar', () => caixa.replaceWith(controlesDeResolver(a)), 'link')), lista);
    linha.replaceWith(caixa);
    campo.focus({ preventScroll: true });
    try { caixa.scrollIntoView({ block: 'nearest' }); } catch (e) { /* sem rolagem */ }
    supabase.from(a.ref_tabela).select('empresa_nome').eq('id', a.ref_id).then(({ data }) => {
      const n = data && data[0] && data[0].empresa_nome;
      if (n && !campo.value) { campo.value = String(n).trim(); buscar(); }
    }, () => { /* sem o nome digitado: a pessoa digita */ });
  }
  async function resolver(a, escolha, b) {
    const conteudo = [...b.childNodes].map(n => n.cloneNode(true));   // o rótulo (na busca, o nome e o CNPJ) pra voltar se der erro
    const li = b.closest('li');
    if (li) li.querySelectorAll('.as-cartao-erro').forEach(x => x.remove());
    b.disabled = true; b.textContent = 'Gravando…';
    let r;
    try { r = await resolverAchado(a, escolha, ajuda); } catch (e) { r = { erro: (e && e.message) || 'erro' }; }
    if (r.erro) {
      b.disabled = false; b.replaceChildren(...conteudo);
      if (li) li.append(h('div', { class: 'as-cartao-erro', text: r.erro }));
      return;
    }
    salvar({ resolvidos: { ...resolvidos(), [a.id]: { em: new Date().toISOString(), texto: r.texto + (r.aviso ? ' ' + r.aviso : ''), desfazer: r.desfazer } } });
    if (!r.segue) marcarResolvidoAgora(email, String(a.id));   // o que o vigia continua avisando não sai desta máquina
    try { ajuda.reagir && ajuda.reagir(); } catch (e) { /* sem carinha */ }
    anunciar(r.texto + ' Dá pra desfazer por 10 minutos.');
    desenhar();
  }
  async function desfazerUm(a, b) {
    const x = resolvidos()[a.id];
    if (!x) { desenhar(); return; }
    b.disabled = true; b.textContent = 'Desfazendo…';
    let r;
    try { r = await desfazerResolucao(x.desfazer, ajuda); } catch (e) { r = { erro: (e && e.message) || 'erro' }; }
    if (r.erro === NADA_VOLTOU) {
      // alguém mexeu depois: o "Desfazer" não tem mais o que voltar
      const rs = resolvidos(); delete rs[a.id];
      salvar({ resolvidos: rs });
      anunciar('Nada voltou: isso mudou depois, na tela ou por outra pessoa.');
      trocar(b.closest('li') || raiz, h('div', { class: 'as-cartao-sub', text: 'Nada voltou: depois daqui, isso mudou na tela ou por outra pessoa. Confira na tela.' }));
      return;
    }
    if (r.erro) return falhou(b, 'Desfazer', 'Não consegui desfazer: ' + r.erro);
    const rs = resolvidos(); delete rs[a.id];
    salvar({ resolvidos: rs });
    desmarcarResolvidoAgora(email, String(a.id));
    // a conferência já tinha tirado o achado do banco: ele volta na seguinte (a tela não reabre achado)
    if (a._conferido) {
      anunciar('Desfeito. O vigia já tinha conferido: o achado volta na próxima conferência.');
      trocar(b.closest('li') || raiz, h('div', { class: 'as-cartao-sub', text: 'Desfeito. O vigia já tinha conferido: o achado volta na próxima conferência (de hora em hora).' }));
      return;
    }
    anunciar('Desfeito: voltou pra lista.');
    desenhar();
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

// ============================================================
// Os cadastros (30/10/2026, pedido do Samuel: "as vezes acho que o assistente ta um pouco limitado nas ações, preciso que
// esse tipo de coisa ele possa fazer") — o que antes era "só leio": incluir empresa na campanha da Reforma, pôr empresa num
// mês dos boletos e ajustar as obrigações das empresas em lote. A regra de gravar é a de tarefas-acoes.js; depois, as telas
// abertas são avisadas: "mr:reforma-mudou" (a lista da Reforma recarrega), "mr:boletos-mudaram" com a competência (a grade
// do mês recarrega) e "mr:obrigacoes-mudaram" (a tela Obrigações fiscais recarrega) — e "mr:tarefas-mudaram" quando as
// tarefas abertas da obrigação vão junto pra quem assumiu.
// ============================================================
const fmtDocumento = d => { const x = String(d || '').replace(/\D/g, '');
  return x.length === 14 ? x.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : x.length === 11 ? x.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4') : String(d || ''); };
const naCarteira = (c, hoje) => !!c && !!c.entrada && (!c.saida || String(c.saida).slice(0, 10) > hoje);
const textoCarteira = (c, hoje) => (naCarteira(c, hoje) ? 'na carteira desde ' + dataBR(c.entrada) : c && c.saida ? 'saiu da carteira em ' + dataBR(c.saida) : 'fora da carteira');
const quemPede = ajuda => ajuda.nome || nomePorEmail(ajuda.email) || null;
const erroDeLeitura = (texto, deNovo) => [h('div', { class: 'as-cartao-erro', text: texto }), h('div', { class: 'as-cartao-botoes' }, botao('Tentar de novo', deNovo))];
async function lerPorColuna(tabela, colunas, coluna, ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabase.from(tabela).select(colunas).in(coluna, ids.slice(i, i + 100));
    if (error) throw new Error(error.message);
    out.push(...(data || []));
  }
  return out;
}

// ---------- incluir na campanha da Reforma ----------
function cartaoReforma({ raiz, estado, salvar, ajuda, anunciar }) {
  raiz.setAttribute('aria-label', 'Incluir na campanha da Reforma');
  const ids = idsDe(estado.ids).slice(0, 20);
  async function desenhar() {
    if (estado.estado === 'feita') return desenharFeita();
    if (estado.estado === 'cancelada') return trocar(raiz, sub('Deixei como estava.'));
    if (estado.estado === 'desfeita') return desenharDesfeita();
    trocar(raiz, sub('Lendo as empresas…'));
    let cli, comCaso, cart;
    try {
      cli = await lerPorIds('clientes', 'id, nome_principal, nome_fantasia, documento, regime_tributario, tipo_pessoa', ids);
      comCaso = new Set((await lerPorColuna('rt_casos', 'cliente_id', 'cliente_id', ids)).map(c => String(c.cliente_id)));
      cart = new Map((await lerPorColuna('carteira_info', 'cliente_id, entrada, saida', 'cliente_id', ids)).map(c => [String(c.cliente_id), c]));
    } catch (e) { return trocar(raiz, ...erroDeLeitura('Não consegui ler as empresas agora.', desenhar)); }
    const ordem = new Map(ids.map((id, i) => [id, i]));
    const pj = cli.filter(c => c.tipo_pessoa !== 'PF').sort((a, b) => (ordem.get(String(a.id)) ?? 99) - (ordem.get(String(b.id)) ?? 99));
    const livres = pj.filter(c => !comCaso.has(String(c.id)));
    const jaTem = pj.filter(c => comCaso.has(String(c.id)));
    if (!livres.length) return trocar(raiz, sub(jaTem.length === 1 ? 'Essa empresa já está na campanha da Reforma.' : 'Essas empresas já estão na campanha da Reforma.'));
    const hoje = hojeISO();
    const tit = h('div', { class: 'as-cartao-tit' });
    const erro = h('div', { class: 'as-cartao-erro', hidden: true });
    const obs = h('textarea', { rows: '2', maxlength: '300' });
    obs.value = typeof estado.observacao === 'string' ? estado.observacao.slice(0, 300) : '';
    obs.addEventListener('change', () => salvar({ observacao: obs.value.replace(/\s+/g, ' ').trim().slice(0, 300) }));
    const ok = botao('Incluir', () => confirmar(lista.marcadas(), ok, nao, erro, obs), 'pri');
    const nao = botao('Agora não', () => { salvar({ estado: 'cancelada' }); desenhar(); });
    const atualizar = () => { const n = lista.marcadas().length; tit.textContent = 'Incluir ' + qtd(livres.length, 'empresa', 'empresas') + ' na campanha da Reforma?'; ok.textContent = n ? 'Incluir ' + n : 'Incluir'; ok.disabled = !n; };
    const lista = listaComCaixas(livres.map(c => ({ id: String(c.id), titulo: c.nome_principal || 'empresa',
      tag: c.regime_tributario && c.regime_tributario !== 'Simples Nacional' ? 'hoje: ' + c.regime_tributario : '',
      sub: [c.nome_fantasia, fmtDocumento(c.documento), textoCarteira(cart.get(String(c.id)), hoje)].filter(Boolean).join(' · ') })), { aoMudar: () => atualizar() });
    atualizar();
    trocar(raiz, tit, sub('A opção IBS/CBS de 2027: o caso entra pendente; a simulação e a decisão seguem na tela Reforma Tributária.'), lista.el,
      h('div', { class: 'as-cartao-campos' }, h('label', { class: 'as-cartao-campo largo' }, 'Observação no caso (opcional)', obs)),
      jaTem.length ? sub((jaTem.length === 1 ? 'Já está' : 'Já estão') + ' na campanha: ' + jaTem.map(c => c.nome_principal).join(', ') + '.') : null,
      h('div', { class: 'as-cartao-botoes' }, ok, nao, alternarTodas(lista, livres.length)), erro);
  }
  async function confirmar(marcados, ok, nao, erro, obs) {
    if (!marcados.length) return;
    ok.disabled = true; nao.disabled = true; obs.disabled = true; ok.textContent = 'Incluindo…'; erro.hidden = true;
    const r = await incluirNaCampanha(supabase, marcados, { quem: quemPede(ajuda), observacao: obs.value });
    if (r.erro && !r.incluidos.length) { erro.textContent = 'Não consegui incluir: ' + r.erro; erro.hidden = false; ok.disabled = false; nao.disabled = false; obs.disabled = false; ok.textContent = 'Incluir ' + marcados.length; return; }
    salvar({ estado: 'feita', resultado: { incluidos: r.incluidos, ja: r.jaEstavam.length, ...(r.erro ? { erro: r.erro } : {}), em: new Date().toISOString() } });
    if (r.incluidos.length) { avisarTelas('mr:reforma-mudou', { ids: r.incluidos.map(c => c.id) }); try { ajuda.reagir && ajuda.reagir(); } catch (e) { /* sem carinha */ } }
    anunciar(qtd(r.incluidos.length, 'empresa incluída', 'empresas incluídas') + ' na campanha da Reforma.');
    desenhar();
  }
  function desenharFeita() {
    const r = estado.resultado || {};
    const inc = Array.isArray(r.incluidos) ? r.incluidos : [];
    const linha = h('div', { class: 'as-cartao-feito' }, h('span', { class: 'as-cartao-ok', text: '✓ ' + (inc.length ? qtd(inc.length, 'empresa incluída', 'empresas incluídas') + ' na campanha da Reforma' : 'Nenhuma empresa entrou') + '.' }));
    if (r.ja) linha.append(h('span', { class: 'as-cartao-sub', text: qtd(r.ja, 'já estava', 'já estavam') + ' na campanha.' }));
    if (r.erro) linha.append(h('span', { class: 'as-cartao-aviso', text: 'Parei no meio: ' + r.erro }));
    if (inc.length) linha.append(h('a', { class: 'as-botao as-botao-link', href: new URL('fiscal-reforma.html' + (inc.length === 1 && ID.test(String(inc[0].id)) ? '#caso-' + inc[0].id : ''), RAIZ).href,
      text: inc.length === 1 ? 'Abrir o caso' : 'Abrir a Reforma' }));
    if (inc.length && podeDesfazer(r.em)) linha.append(botao('Desfazer', desfazer, 'link'));
    trocar(raiz, linha);
  }
  async function desfazer(ev) {
    const b = ev.currentTarget, r = estado.resultado || {};
    if (!podeDesfazer(r.em)) { trocar(raiz, sub('Passou o tempo de desfazer por aqui: o caso fica na tela Reforma Tributária.')); return; }
    b.disabled = true; b.textContent = 'Desfazendo…';
    const d = await desfazerInclusaoCampanha(supabase, r.incluidos || []);
    if (d.erro && !d.desfeitos.length) { b.disabled = false; b.textContent = 'Desfazer'; raiz.append(h('div', { class: 'as-cartao-erro', text: 'Não consegui desfazer: ' + d.erro })); return; }
    salvar({ estado: 'desfeita', desfeito: { n: d.desfeitos.length, ficaram: d.ficaram } });
    if (d.desfeitos.length) avisarTelas('mr:reforma-mudou', { ids: d.desfeitos });
    anunciar('Desfeito.');
    desenhar();
  }
  function desenharDesfeita() {
    const d = estado.desfeito || {};
    trocar(raiz, h('div', { class: 'as-cartao-feito' }, h('span', { text: '↺ Desfeito: ' + qtd(d.n || 0, 'empresa saiu', 'empresas saíram') + ' da campanha.' }),
      d.ficaram ? h('span', { class: 'as-cartao-sub', text: qtd(d.ficaram, 'ficou', 'ficaram') + ': alguém já mexeu no caso — tire na tela Reforma Tributária, se for o caso.' }) : null));
  }
  desenhar();
}

// ---------- pôr a empresa num mês dos boletos ----------
// cada empresa com o valor e o vencimento (dá pra editar antes de confirmar); a que já está no mês fica de fora
const valorBR = v => (v == null || v === '' ? '' : Number(v).toFixed(2).replace('.', ','));
const lerValor = s => { const t = String(s || '').trim().replace(/\s/g, '').replace(/^R\$/i, ''); if (!t) return NaN; const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t); return Math.round(n * 100) / 100; };
function cartaoCompetencia({ raiz, estado, salvar, ajuda, anunciar }) {
  raiz.setAttribute('aria-label', 'Pôr no mês dos boletos');
  const ids = idsDe(estado.ids).slice(0, 20);
  const comp = COMPETENCIA_ISO.test(String(estado.competencia || '')) ? estado.competencia : null;
  async function desenhar() {
    if (!comp) return trocar(raiz, sub('A competência não veio na proposta: peça de novo, dizendo o mês.'));
    if (estado.estado === 'feita') return desenharFeita();
    if (estado.estado === 'cancelada') return trocar(raiz, sub('Deixei como estava.'));
    if (estado.estado === 'desfeita') return desenharDesfeita();
    trocar(raiz, sub('Lendo as cobranças…'));
    let dados, nomes;
    try { dados = await dadosParaCompetencia(supabase, ids, comp); nomes = await nomesDe(ids); }
    catch (e) { return trocar(raiz, ...erroDeLeitura('Não consegui ler as cobranças agora.', desenhar)); }
    const livres = ids.map(id => dados.get(id)).filter(d => d && !d.ja);
    const ja = ids.map(id => dados.get(id)).filter(d => d && d.ja);
    if (!livres.length) return trocar(raiz, sub((ja.length === 1 ? 'Essa empresa já está' : 'Essas empresas já estão') + ' em ' + mesBR(comp) + '.'));
    const tit = h('div', { class: 'as-cartao-tit', text: 'Pôr ' + qtd(livres.length, 'empresa', 'empresas') + ' nos boletos de ' + mesBR(comp) + '?' });
    const erro = h('div', { class: 'as-cartao-erro', hidden: true });
    const linhas = livres.map(d => {
      const cx = h('input', { type: 'checkbox', checked: true, onchange: () => atualizar() });
      const valor = h('input', { type: 'text', inputmode: 'decimal', value: valorBR(d.valor), placeholder: '0,00', 'aria-label': 'Valor de ' + (nomes.get(d.cliente_id) || 'empresa') });
      const venc = h('input', { type: 'date', value: d.vencimento || '', 'aria-label': 'Vencimento de ' + (nomes.get(d.cliente_id) || 'empresa') });
      const fonte = d.fonte === 'copia' ? 'copiado de ' + mesBR(d.de) : d.fonte === 'base' ? 'da base de cobrança' : 'sem cobrança anterior nem base: preencha o valor';
      const aviso = !d.base ? 'Sem base de cobrança: ganha a base, e os próximos meses passam a gerar.' : d.base.ativo === false ? 'A base de cobrança dela está parada: os próximos meses não geram (volte a cobrar na tela Boletos).' : '';
      const el = h('li', {}, h('label', { class: 'as-cartao-item' }, cx, h('span', {}, h('b', { text: nomes.get(d.cliente_id) || 'empresa' }), h('small', { text: fonte }))),
        h('div', { class: 'as-cartao-campos', style: 'margin:0 0 6px 24px' }, h('label', { class: 'as-cartao-campo' }, 'Valor (R$)', valor), h('label', { class: 'as-cartao-campo' }, 'Vencimento', venc)),
        aviso ? h('div', { class: 'as-cartao-aviso', style: 'margin:0 0 6px 24px', text: aviso }) : null);
      return { d, cx, valor, venc, el };
    });
    const ok = botao('Pôr no mês', () => confirmar(ok, nao, erro), 'pri');
    const nao = botao('Agora não', () => { salvar({ estado: 'cancelada' }); desenhar(); });
    function atualizar() { const n = linhas.filter(l => l.cx.checked).length; ok.textContent = n ? 'Pôr ' + n + ' no mês' : 'Pôr no mês'; ok.disabled = !n; }
    async function confirmar() {
      const itens = [];
      for (const l of linhas.filter(x => x.cx.checked)) {
        const v = lerValor(l.valor.value);
        if (!(v >= 0) || !Number.isFinite(v)) { erro.textContent = 'Preencha o valor de ' + (nomes.get(l.d.cliente_id) || 'cada empresa') + '.'; erro.hidden = false; l.valor.focus(); return; }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(l.venc.value)) { erro.textContent = 'Preencha o vencimento de ' + (nomes.get(l.d.cliente_id) || 'cada empresa') + '.'; erro.hidden = false; l.venc.focus(); return; }
        itens.push({ cliente_id: l.d.cliente_id, valor: v, vencimento: l.venc.value, canal: l.d.canal, contato_envio: l.d.contato_envio, destino: l.d.destino, responsavel: l.d.responsavel });
      }
      if (!itens.length) return;
      ok.disabled = true; nao.disabled = true; ok.textContent = 'Gravando…'; erro.hidden = true;
      linhas.forEach(l => { l.valor.disabled = true; l.venc.disabled = true; l.cx.disabled = true; });
      const r = await porNaCompetencia(supabase, comp, itens);
      if (r.erro && !r.postos.length) {
        erro.textContent = 'Não consegui gravar: ' + r.erro; erro.hidden = false; ok.disabled = false; nao.disabled = false; atualizar();
        linhas.forEach(l => { l.valor.disabled = false; l.venc.disabled = false; l.cx.disabled = false; });
        return;
      }
      salvar({ estado: 'feita', resultado: { postos: r.postos, bases: r.bases, ja: r.jaEstavam.length, ...(r.erro ? { erro: r.erro } : {}), em: new Date().toISOString() } });
      if (r.postos.length) avisarTelas('mr:boletos-mudaram', { mudancas: [], competencia: comp, novos: r.postos.map(p => p.id) });
      anunciar(qtd(r.postos.length, 'boleto posto', 'boletos postos') + ' em ' + mesBR(comp) + '.');
      desenhar();
    }
    atualizar();
    trocar(raiz, tit, sub('Entram "a emitir", como o "Adicionar empresa" da tela Boletos; o vencimento é no mês seguinte ao da competência.'),
      h('ul', { class: 'as-cartao-lista' }, linhas.map(l => l.el)),
      ja.length ? sub((ja.length === 1 ? 'Já está' : 'Já estão') + ' em ' + mesBR(comp) + ': ' + ja.map(d => nomes.get(d.cliente_id) || 'empresa').join(', ') + '.') : null,
      h('div', { class: 'as-cartao-botoes' }, ok, nao), erro);
  }
  function desenharFeita() {
    const r = estado.resultado || {};
    const n = (r.postos || []).length;
    const linha = h('div', { class: 'as-cartao-feito' }, h('span', { class: 'as-cartao-ok', text: '✓ ' + (n ? qtd(n, 'boleto posto', 'boletos postos') + ' em ' + mesBR(comp) + ', a emitir' : 'Nenhum boleto entrou') + '.' }));
    if ((r.bases || []).length) linha.append(h('span', { class: 'as-cartao-sub', text: qtd(r.bases.length, 'empresa ganhou', 'empresas ganharam') + ' a base de cobrança.' }));
    if (r.ja) linha.append(h('span', { class: 'as-cartao-sub', text: qtd(r.ja, 'já estava', 'já estavam') + ' no mês.' }));
    if (r.erro) linha.append(h('span', { class: 'as-cartao-aviso', text: 'Parei no meio: ' + r.erro }));
    if (n) linha.append(h('a', { class: 'as-botao as-botao-link', href: new URL('financeiro-boletos.html?competencia=' + comp, RAIZ).href, text: 'Abrir Boletos' }));
    if (n && podeDesfazer(r.em)) linha.append(botao('Desfazer', desfazer, 'link'));
    trocar(raiz, linha);
  }
  async function desfazer(ev) {
    const b = ev.currentTarget, r = estado.resultado || {};
    if (!podeDesfazer(r.em)) { trocar(raiz, sub('Passou o tempo de desfazer por aqui: tire o boleto na tela Boletos.')); return; }
    b.disabled = true; b.textContent = 'Desfazendo…';
    const d = await desfazerPorNaCompetencia(supabase, { postos: r.postos || [], bases: r.bases || [] });
    if (d.erro && !d.desfeitos.length) { b.disabled = false; b.textContent = 'Desfazer'; raiz.append(h('div', { class: 'as-cartao-erro', text: 'Não consegui desfazer: ' + d.erro })); return; }
    salvar({ estado: 'desfeita', desfeito: { n: d.desfeitos.length, ficaram: d.ficaram } });
    if (d.desfeitos.length) avisarTelas('mr:boletos-mudaram', { mudancas: [], competencia: comp, novos: [] });
    anunciar('Desfeito.');
    desenhar();
  }
  function desenharDesfeita() {
    const d = estado.desfeito || {};
    trocar(raiz, h('div', { class: 'as-cartao-feito' }, h('span', { text: '↺ Desfeito: ' + qtd(d.n || 0, 'boleto saiu', 'boletos saíram') + ' de ' + mesBR(comp) + '.' }),
      d.ficaram ? h('span', { class: 'as-cartao-sub', text: qtd(d.ficaram, 'ficou', 'ficaram') + ': já tinha mudado (emitido, outro valor) — tire na tela Boletos, se for o caso.' }) : null));
  }
  desenhar();
}

// ---------- as obrigações das empresas, em lote ----------
const textoDoAjuste = (v, r, d) => ['responsavel' in d ? 'quem cuida: ' + (v.responsavel || 'ninguém') + ' → ' + d.responsavel : null,
  'dia_prazo_override' in d ? 'dia do prazo: ' + (v.dia_prazo_override || (r && r.dia_prazo) || '—') + ' → ' + (d.dia_prazo_override || (r && r.dia_prazo) || '—') : null,
  'ativo' in d ? 'desligar' : null].filter(Boolean).join(' · ');
function cartaoObrigacoes({ raiz, estado, salvar, ajuda, anunciar }) {
  raiz.setAttribute('aria-label', 'Ajustar as obrigações das empresas');
  const ids = idsDe(estado.ids).slice(0, 300);
  const mudar = limparAjuste(estado.mudar);
  async function desenhar() {
    if (!mudar) return trocar(raiz, sub('O que muda não veio na proposta: peça de novo.'));
    if (estado.estado === 'feita') return desenharFeita();
    if (estado.estado === 'cancelada') return trocar(raiz, sub('Deixei como estava.'));
    if (estado.estado === 'desfeita') return desenharDesfeita();
    trocar(raiz, sub('Lendo as obrigações…'));
    let vs, regras, nomes;
    try {
      vs = (await lerPorIds('cliente_obrigacoes', 'id, cliente_id, obrigacao_id, responsavel, dia_prazo_override, ativo', ids)).filter(v => v.ativo !== false);
      regras = new Map((await lerPorIds('obrigacoes_fiscais', 'id, nome, dia_prazo', [...new Set(vs.map(v => String(v.obrigacao_id)))])).map(r => [String(r.id), r]));
      nomes = await nomesDe(vs.map(v => v.cliente_id));
    } catch (e) { return trocar(raiz, ...erroDeLeitura('Não consegui ler as obrigações agora.', desenhar)); }
    const planos = vs.map(v => ({ v, r: regras.get(String(v.obrigacao_id)), d: ajusteDoVinculo(v, regras.get(String(v.obrigacao_id)), mudar) })).filter(x => x.d)
      .sort((a, b) => String(nomes.get(String(a.v.cliente_id)) || '').localeCompare(String(nomes.get(String(b.v.cliente_id)) || ''), 'pt-BR'));
    const fora = ids.length - planos.length;
    if (!planos.length) return trocar(raiz, sub('Nada a mudar: essas obrigações já estão assim (ou foram desligadas).'));
    const varias = new Set(planos.map(x => String(x.v.obrigacao_id))).size > 1;
    const oQue = mudar.desligar ? 'Desligar' : 'Mudar';
    const tit = h('div', { class: 'as-cartao-tit' });
    const erro = h('div', { class: 'as-cartao-erro', hidden: true });
    const ok = botao('Confirmar', () => confirmar(lista.marcadas(), ok, nao, erro), 'pri');
    const nao = botao('Agora não', () => { salvar({ estado: 'cancelada' }); desenhar(); });
    const atualizar = () => { const n = lista.marcadas().length;
      tit.textContent = oQue + ' ' + (varias ? 'as obrigações' : (planos[0].r || {}).nome || 'a obrigação') + ' em ' + qtd(planos.length, 'empresa', 'empresas') + '?';
      ok.textContent = n ? 'Confirmar ' + n : 'Confirmar'; ok.disabled = !n; };
    const lista = listaComCaixas(planos.map(({ v, r, d }) => ({ id: String(v.id), titulo: nomes.get(String(v.cliente_id)) || 'empresa',
      sub: [varias && r ? r.nome : null, textoDoAjuste(v, r, d)].filter(Boolean).join(' · ') })), { aoMudar: () => atualizar() });
    atualizar();
    const nota = mudar.desligar ? 'Desligada, a tarefa do mês não nasce mais nessas empresas; as abertas ficam (dá pra concluir ou remarcar).'
      : [mudar.responsavel ? 'As tarefas abertas dessas obrigações que estavam com quem cuidava vão junto pra ' + mudar.responsavel + ' (a repassada à mão pra outra pessoa fica).' : null,
        mudar.dia ? 'O dia novo vale das próximas tarefas geradas; as já criadas ficam com o prazo delas.' : null].filter(Boolean).join(' ');
    trocar(raiz, tit, sub(nota), lista.el, fora > 0 ? sub(qtd(fora, 'outra já está', 'outras já estão') + ' assim (ou foi desligada).') : null,
      h('div', { class: 'as-cartao-botoes' }, ok, nao, alternarTodas(lista, planos.length)), erro);
  }
  async function confirmar(marcados, ok, nao, erro) {
    if (!marcados.length) return;
    ok.disabled = true; nao.disabled = true; ok.textContent = 'Gravando…'; erro.hidden = true;
    const r = await ajustarVinculos(supabase, marcados, mudar, { autor: ajuda.email || null, origem: ORIGEM });
    if (r.erro && !r.vinculos.length) { erro.textContent = 'Não consegui mudar: ' + r.erro; erro.hidden = false; ok.disabled = false; nao.disabled = false; ok.textContent = 'Confirmar ' + marcados.length; return; }
    salvar({ estado: 'feita', resultado: { vinculos: r.vinculos, tarefas: r.tarefas, ...(r.erro ? { erro: r.erro } : {}), em: new Date().toISOString() } });
    if (r.vinculos.length) avisarTelas('mr:obrigacoes-mudaram', { ids: r.vinculos.map(v => v.id) });
    if (r.tarefas.length) avisarTelas('mr:tarefas-mudaram', { ids: r.tarefas.map(t => t.id) });
    anunciar(qtd(r.vinculos.length, 'empresa mudou', 'empresas mudaram') + '.');
    desenhar();
  }
  function desenharFeita() {
    const r = estado.resultado || {};
    const n = (r.vinculos || []).length, nt = (r.tarefas || []).length;
    const linha = h('div', { class: 'as-cartao-feito' }, h('span', { class: 'as-cartao-ok', text: '✓ ' + (n ? (mudar && mudar.desligar ? 'Desligada em ' : 'Mudou em ') + qtd(n, 'empresa', 'empresas') : 'Nada mudou') + '.' }));
    if (nt) linha.append(h('span', { class: 'as-cartao-sub', text: qtd(nt, 'tarefa aberta foi junto', 'tarefas abertas foram junto') + ' pra ' + ((mudar && mudar.responsavel) || 'quem assumiu') + '.' }));
    if (r.erro) linha.append(h('span', { class: 'as-cartao-aviso', text: 'Parei no meio: ' + r.erro }));
    if (n) linha.append(h('a', { class: 'as-botao as-botao-link', href: new URL('fiscal-obrigacoes.html', RAIZ).href, text: 'Abrir Obrigações fiscais' }));
    if (n && podeDesfazer(r.em)) linha.append(botao('Desfazer', desfazer, 'link'));
    trocar(raiz, linha);
  }
  async function desfazer(ev) {
    const b = ev.currentTarget, r = estado.resultado || {};
    if (!podeDesfazer(r.em)) { trocar(raiz, sub('Passou o tempo de desfazer por aqui: volte na tela Obrigações fiscais.')); return; }
    b.disabled = true; b.textContent = 'Desfazendo…';
    const d = await desfazerAjusteVinculos(supabase, { vinculos: r.vinculos || [], tarefas: r.tarefas || [] }, { autor: ajuda.email || null, origem: ORIGEM });
    if (d.erro && !d.vinculos) { b.disabled = false; b.textContent = 'Desfazer'; raiz.append(h('div', { class: 'as-cartao-erro', text: 'Não consegui desfazer: ' + d.erro })); return; }
    salvar({ estado: 'desfeita', desfeito: { n: d.vinculos, total: (r.vinculos || []).length, tarefas: d.tarefas.length } });
    avisarTelas('mr:obrigacoes-mudaram', { ids: (r.vinculos || []).map(v => v.id) });
    if (d.tarefas.length) avisarTelas('mr:tarefas-mudaram', { ids: d.tarefas });
    anunciar('Desfeito.');
    desenhar();
  }
  function desenharDesfeita() {
    const d = estado.desfeito || {};
    const ficaram = Math.max(0, (d.total || 0) - (d.n || 0));
    trocar(raiz, h('div', { class: 'as-cartao-feito' }, h('span', { text: '↺ Desfeito: ' + qtd(d.n || 0, 'empresa voltou', 'empresas voltaram') + ' a como estava' + (d.tarefas ? ', com ' + qtd(d.tarefas, 'tarefa', 'tarefas') : '') + '.' }),
      ficaram ? h('span', { class: 'as-cartao-sub', text: qtd(ficaram, 'ficou', 'ficaram') + ': alguém mexeu depois — confira na tela Obrigações fiscais.' }) : null));
  }
  desenhar();
}
