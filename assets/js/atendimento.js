// ============================================================
// MACEDO & REIS — O atendimento pelo WhatsApp: as regras da tela (atendimento.html), puras, pra tela e os testes
// (08/11/2026, a etapa 2 da fase 1; as etapas no Projeto, whatsapp/fase1.md, e as decisões em whatsapp/decisoes.md).
// A conversa (atend_conversas) é de um telefone; quem a tem é um setor (a fila dele) ou uma pessoa (o responsavel, o
// e-mail do login). A tela muda só a situação, o setor, o responsável e a empresa (o privilégio por coluna do banco) e
// grava o evento de cada mudança (atend_eventos: de onde saem as métricas); a mensagem só o servidor grava (a função
// whatsapp: no simulador, a conversa de teste; o número de verdade entra na etapa 3). A função leva uma cópia dos
// setores e da conta do telefone — tests/atendimento.test.mjs confere que seguem iguais.
// ============================================================
import { NOME_POR_EMAIL, SOCIOS } from './equipe.js';

// os setores do banco (o check de atend_conversas.setor) e de quem é a fila de cada um: a regra do vigia (vigia_dono),
// com as decisões do Samuel de 06/11/2026 — o societário é da Adaini (7) e o que não tem setor, da Thalia (6)
export const SETORES = [
  { id: 'fiscal', nome: 'Fiscal', dono: 'fiscal@macedoereis.com.br' },
  { id: 'dp', nome: 'DP', dono: 'rh@macedoereis.com.br' },
  { id: 'contabil', nome: 'Contábil', dono: 'contabil@macedoereis.com.br' },
  { id: 'societario', nome: 'Societário', dono: 'contabil@macedoereis.com.br' },
  { id: 'financeiro', nome: 'Financeiro', dono: 'financeiro@macedoereis.com.br' },
  { id: 'comercial', nome: 'Comercial', dono: 'financeiro@macedoereis.com.br' }
];
export const SEM_SETOR = { id: null, nome: 'Sem setor', dono: 'fiscal@macedoereis.com.br' };
// quem atende (quem pode receber uma conversa): a equipe com login; a Edna não tem
export const ATENDENTES = ['fiscal@macedoereis.com.br', 'rh@macedoereis.com.br', 'contabil@macedoereis.com.br',
  'financeiro@macedoereis.com.br', 'diego@macedoereis.com.br'];
export const SITUACOES = ['robo', 'fila', 'atendendo', 'encerrada'];
export const ABERTAS = ['robo', 'fila', 'atendendo'];
export const MAX_TEXTO = 4096;   // o limite do WhatsApp pra uma mensagem de texto (o banco aceita até 8 mil)

const minusculo = e => String(e || '').trim().toLowerCase();
export const ehSocio = e => SOCIOS.includes(minusculo(e));
export const nomeDe = e => NOME_POR_EMAIL[minusculo(e)] || (e ? String(e).split('@')[0] : '');
export const setorDe = id => SETORES.find(s => s.id === id) || SEM_SETOR;
export const nomeDoSetor = id => setorDe(id).nome;
export const donoDoSetor = id => setorDe(id).dono;
// as filas de uma pessoa: os setores de que ela é dona (a Thalia leva também o que não tem setor)
export function setoresDe(email) {
  const e = minusculo(email);
  const meus = SETORES.filter(s => s.dono === e).map(s => s.id);
  if (SEM_SETOR.dono === e) meus.push(null);
  return meus;
}
// "pro DP", "pro Fiscal", "pra fila sem setor"
export const proSetor = id => (id ? 'pro ' + nomeDoSetor(id) : 'pra fila sem setor');

// ---------- o telefone ----------
// o do banco: só os dígitos, com o país (o check do banco: de 10 a 15). Digitado com "+", fica como veio; com 10 ou 11
// dígitos (o DDD e o número), é do Brasil e ganha o 55
export function normalizarTelefone(s) {
  const bruto = String(s == null ? '' : s).trim();
  let d = bruto.replace(/\D/g, '');
  if (!bruto.startsWith('+') && (d.length === 10 || d.length === 11)) d = '55' + d;
  return /^[0-9]{12,15}$/.test(d) || (bruto.startsWith('+') && /^[0-9]{10,15}$/.test(d)) ? d : null;
}
export function formatarTelefone(t) {
  const d = String(t || '').replace(/\D/g, '');
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) {
    const ddd = d.slice(2, 4), n = d.slice(4);
    return '(' + ddd + ') ' + n.slice(0, n.length - 4) + '-' + n.slice(-4);
  }
  return d ? '+' + d : '';
}

// ---------- a conversa ----------
export const tituloDaConversa = c => String((c && c.contato_nome) || '').trim() || formatarTelefone(c && c.telefone) || 'Sem número';
export const estaAberta = c => !!c && ABERTAS.includes(c.situacao);
// "pra mim": a que está com a pessoa (ou foi passada pra ela) e a da fila de um setor dela, sem ninguém
export function ehPraMim(c, eu) {
  if (!estaAberta(c)) return false;
  const e = minusculo(eu);
  if (c.responsavel) return minusculo(c.responsavel) === e;
  return c.situacao === 'fila' && setoresDe(e).includes(c.setor || null);
}
// quanto tempo esperando: "agora", "há 5 min", "há 2 h", "há 3 dias"
export function haQuanto(iso, agora = new Date()) {
  const t = new Date(iso || '').getTime();
  if (isNaN(t)) return '';
  const min = Math.max(0, Math.floor((agora.getTime() - t) / 60000));
  if (min < 1) return 'agora';
  if (min < 60) return 'há ' + min + ' min';
  const h = Math.floor(min / 60);
  if (h < 24) return 'há ' + h + ' h';
  const dias = Math.floor(h / 24);
  return 'há ' + dias + (dias === 1 ? ' dia' : ' dias');
}
// o que a lista e o cabeçalho dizem da conversa → { texto, tipo } (tipo: robo, fila, pra-mim, comigo, com-outro, encerrada)
export function situacaoDaConversa(c, eu, agora = new Date()) {
  const e = minusculo(eu), resp = minusculo(c && c.responsavel);
  switch (c && c.situacao) {
    case 'robo': return { texto: 'Com o assistente', tipo: 'robo' };
    case 'fila':
      if (resp) return resp === e ? { texto: 'Passaram pra você', tipo: 'pra-mim' } : { texto: 'Passada pra ' + nomeDe(resp), tipo: 'com-outro' };
      return { texto: 'Na fila ' + (c.setor ? 'do ' + nomeDoSetor(c.setor) : 'sem setor') + (c.ultima_do_cliente_em ? ' ' + haQuanto(c.ultima_do_cliente_em, agora) : ''), tipo: 'fila' };
    case 'atendendo': return resp === e ? { texto: 'Com você', tipo: 'comigo' } : { texto: 'Com ' + nomeDe(resp), tipo: 'com-outro' };
    case 'encerrada': return { texto: 'Encerrada' + (c.encerrada_por ? ' por ' + nomeDe(c.encerrada_por) : ''), tipo: 'encerrada' };
    default: return { texto: '', tipo: '' };
  }
}
// a janela de 24 horas do WhatsApp: depois dela, só modelo aprovado pela Meta (a fase 2)
export const janelaAberta = (c, agora = new Date()) => !!(c && c.janela_ate) && new Date(c.janela_ate).getTime() > agora.getTime();

// ---------- o que cada um pode fazer ----------
const minha = (c, eu) => !!c && minusculo(c.responsavel) === minusculo(eu);
const semDono = c => !!c && !c.responsavel;
export const podeAssumir = (c, eu) => !!c && (c.situacao === 'fila' || c.situacao === 'robo') && (semDono(c) || minha(c, eu));
export const podeResponder = (c, eu) => !!c && c.situacao === 'atendendo' && minha(c, eu);
export const podeDevolver = (c, eu) => !!c && c.situacao === 'atendendo' && minha(c, eu);
export const podeTransferir = (c, eu) => estaAberta(c) && (semDono(c) || minha(c, eu) || ehSocio(eu));
export const podeEncerrar = (c, eu) => estaAberta(c) && (semDono(c) || minha(c, eu) || ehSocio(eu));
export const podeReabrir = c => !!c && c.situacao === 'encerrada';
// por que não dá pra responder (a nota no lugar da caixa) — null quando dá
export function porQueNaoResponde(c, eu, agora = new Date()) {
  if (!c) return null;
  if (c.situacao === 'encerrada') return 'Conversa encerrada. Reabra pra responder.';
  if (c.situacao !== 'atendendo') return minha(c, eu) || semDono(c) ? 'Assuma a conversa pra responder.' : 'A conversa foi passada pra ' + nomeDe(c.responsavel) + '.';
  if (!minha(c, eu)) return 'A conversa está com ' + nomeDe(c.responsavel) + '.';
  if (!janelaAberta(c, agora)) return 'Passaram 24 horas da última mensagem do cliente: o WhatsApp só deixa escrever com um modelo aprovado (entra na fase 2, com os avisos).';
  return null;
}

// a mudança de cada botão → { patch, evento }: o patch vai pro update da conversa (só as colunas que a tela pode mudar),
// conferindo que ela segue como a tela leu (a situação e o responsável), e o evento vai pro atend_eventos
export function mudancaDe(acao, c, { eu, setor, para, observacao, cliente } = {}) {
  const e = minusculo(eu), obs = String(observacao || '').trim().slice(0, 1000) || null;
  switch (acao) {
    case 'assumir': return { patch: { situacao: 'atendendo', responsavel: e }, evento: { tipo: 'assumiu', setor: c.setor || null, para: e, observacao: null } };
    case 'transferir': {
      const s = setor === undefined ? (c.setor || null) : (setor || null), p = minusculo(para) || null;
      if (p && p === e) return { patch: { situacao: 'atendendo', setor: s, responsavel: e }, evento: { tipo: 'assumiu', setor: s, para: e, observacao: obs } };
      return { patch: { situacao: 'fila', setor: s, responsavel: p }, evento: { tipo: 'transferiu', setor: s, para: p, observacao: obs } };
    }
    case 'devolver': return { patch: { situacao: 'fila', responsavel: null }, evento: { tipo: 'devolveu', setor: c.setor || null, para: null, observacao: obs } };
    case 'encerrar': return { patch: { situacao: 'encerrada' }, evento: { tipo: 'encerrou', setor: c.setor || null, para: null, observacao: obs } };
    case 'reabrir': return { patch: { situacao: 'atendendo', responsavel: e }, evento: { tipo: 'reabriu', setor: c.setor || null, para: e, observacao: null } };
    case 'vincular': return { patch: { cliente_id: cliente ? cliente.id : null }, evento: { tipo: 'vinculou', setor: c.setor || null, para: null,
      observacao: cliente ? String(cliente.nome || '').slice(0, 1000) || null : 'sem empresa' } };
    default: return null;
  }
}

// ---------- o histórico ----------
const comLetraGrande = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
export function textoDoEvento(ev) {
  const quem = ev.por ? nomeDe(ev.por) : '', obs = ev.observacao ? ': “' + ev.observacao + '”' : '';
  switch (ev.tipo) {
    case 'abriu': return 'A conversa começou' + (ev.setor ? ', na fila do ' + nomeDoSetor(ev.setor) : '');
    case 'robo_passou': return 'O assistente passou ' + proSetor(ev.setor) + obs;
    case 'assumiu': return (quem || 'Alguém') + ' assumiu' + obs;
    case 'transferiu': return (quem || 'Alguém') + ' passou ' + (ev.para ? 'pra ' + nomeDe(ev.para) + (ev.setor ? ' (' + nomeDoSetor(ev.setor) + ')' : '') : proSetor(ev.setor)) + obs;
    case 'devolveu': return (quem || 'Alguém') + ' devolveu ' + (ev.setor ? 'pra fila do ' + nomeDoSetor(ev.setor) : 'pra fila sem setor') + obs;
    case 'encerrou': return (quem || 'Alguém') + ' encerrou' + obs;
    case 'reabriu': return (quem || 'Alguém') + ' reabriu';
    case 'vinculou': return comLetraGrande((quem ? quem + ' ligou' : 'Ligado') + ' o número ' + (ev.observacao && ev.observacao !== 'sem empresa' ? 'à empresa ' + ev.observacao : 'a nenhuma empresa'));
    case 'lembrou': return 'O assistente lembrou o setor' + obs;
    default: return ev.tipo || '';
  }
}
// as mensagens e os eventos juntos, na ordem do tempo; no mesmo instante, o começo da conversa vem antes da mensagem e
// os outros eventos depois dela
export function linhaDoTempo(mensagens = [], eventos = []) {
  const t = iso => { const n = new Date(iso || '').getTime(); return isNaN(n) ? 0 : n; };
  const ordem = x => (x.tipo === 'msg' ? 0 : x.e.tipo === 'abriu' ? -1 : 1);
  return [...(mensagens || []).map(m => ({ tipo: 'msg', em: t(m.criada_em), m })), ...(eventos || []).map(e => ({ tipo: 'evento', em: t(e.em), e }))]
    .sort((a, b) => a.em - b.em || ordem(a) - ordem(b));
}
// a linha da lista com a última mensagem: o texto numa linha só, até 90 letras
export function previa(m) {
  if (!m) return '';
  const quem = m.direcao === 'saida' ? 'Você: ' : m.direcao === 'interna' ? 'Nota: ' : '';
  const txt = String(m.texto || m.transcricao || '').replace(/\s+/g, ' ').trim();
  const corpo = txt || ({ imagem: 'Imagem', documento: 'Documento', audio: 'Áudio', video: 'Vídeo', figurinha: 'Figurinha', localizacao: 'Localização', contato: 'Contato' }[m.tipo] || '');
  const a = [...(quem + corpo)];
  return a.length > 90 ? a.slice(0, 89).join('') + '…' : a.join('');
}
// a conversa espera resposta quando a última mensagem é do cliente
export const esperaResposta = (c, ultima) => estaAberta(c) && !!ultima && ultima.direcao === 'entrada';

// ---------- a lista ----------
// as abas: minhas (com a pessoa, ou passadas pra ela), fila (as filas sem ninguém), todas (as abertas), encerradas.
// O filtro do setor vale na fila, em todas e nas encerradas: 'meus' (os setores da pessoa; sem setor dela, todos), 'todos',
// o id de um setor ou 'sem' (sem setor)
export const ABAS = ['minhas', 'fila', 'todas', 'encerradas'];
function noSetor(c, filtro, eu) {
  const s = c.setor || null;
  if (!filtro || filtro === 'todos') return true;
  if (filtro === 'meus') { const m = setoresDe(eu); return !m.length || m.includes(s); }
  if (filtro === 'sem') return s === null;
  return s === filtro;
}
export function naAba(c, aba, eu, filtro = 'meus') {
  switch (aba) {
    case 'minhas': return estaAberta(c) && minha(c, eu);
    case 'fila': return c.situacao === 'fila' && semDono(c) && noSetor(c, filtro, eu);
    case 'todas': return estaAberta(c) && noSetor(c, filtro, eu);
    case 'encerradas': return c.situacao === 'encerrada' && noSetor(c, filtro, eu);
    default: return false;
  }
}
// a fila, quem espera há mais tempo primeiro; o resto, a mais recente primeiro
export function ordenar(lista, aba) {
  const t = iso => new Date(iso || 0).getTime() || 0;
  const v = [...(lista || [])];
  if (aba === 'fila') return v.sort((a, b) => t(a.ultima_do_cliente_em || a.criado_em) - t(b.ultima_do_cliente_em || b.criado_em));
  return v.sort((a, b) => t(b.ultima_em) - t(a.ultima_em));
}
export const filtrar = (lista, aba, eu, filtro = 'meus') => ordenar((lista || []).filter(c => naAba(c, aba, eu, filtro)), aba);
export function contagens(lista, eu, filtro = 'meus') {
  const n = {};
  ABAS.forEach(a => { n[a] = (lista || []).filter(c => naAba(c, a, eu, filtro)).length; });
  return n;
}
