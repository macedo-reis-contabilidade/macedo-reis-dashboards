// ============================================================
// MACEDO & REIS — O dia de quem entrou, pra abertura do Painel central (13/11/2026, pedido do Samuel: o Painel era só um
// menu; agora abre com "Bom dia, <nome>", a frase do dia, o dia em números e o anel do dia)
// As contas são as mesmas da coluna "Seu dia" da Agenda (agenda.html) com o filtro na pessoa que entrou:
//   · o dia = as tarefas com prazo hoje (feitas ou não) e as rotinas do dia (a regra de assets/js/rotinas-dia.js), só as
//     da pessoa; "Ambos" conta pros dois sócios;
//   · atrasadas = as abertas da pessoa com prazo antes de hoje, de todos os setores (as mesmas da revisão do assistente).
// Aqui só leitura e conta: nada é gravado. Regras puras em cima (testadas no node, tests/painel-dia.test.mjs), a leitura
// do banco embaixo. A data por extenso do jeito da casa (comMaiusculas) também é a da Agenda.
// ============================================================
import { rotinaDoDia, rotinaFeita, ymd } from './rotinas-dia.js';

const semAcento = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// "sexta-feira, 13 de novembro" → "Sexta-feira, 13 de Novembro" (o text-transform:capitalize dava "13 De Novembro")
export const comMaiusculas = s => String(s == null ? '' : s).replace(/(^|\s)(\p{Ll})(\p{L}*)/gu, (m, a, b, c) => (/^(de|do|da|a|e)$/.test(b + c) ? m : a + b.toUpperCase() + c));
export const dataPorExtenso = d => comMaiusculas(d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }));
export const saudacaoDaHora = h => (h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite');
const ddmm = iso => String(iso || '').slice(5, 10).split('-').reverse().join('/');

// a tarefa (ou a rotina) é da pessoa? "Ambos" é dos dois sócios — a regra da Agenda
export function daPessoa(item, pessoa) {
  const r = semAcento(item && item.responsavel), f = semAcento(pessoa);
  return !!f && (r === f || (r === 'ambos' && (f === 'samuel' || f === 'diego')));
}

// o dia em números: { total, feitas, faltam, pct, rotinas: { total, feitas }, atrasadas, desde }
export function contarDia({ tarefasHoje = [], atrasadas = [], rotinas = [], pessoa, dia = new Date() } = {}) {
  const hoje = ymd(dia);
  const minhas = tarefasHoje.filter(t => t && t.prazo === hoje && daPessoa(t, pessoa));
  const rot = rotinas.filter(r => r && rotinaDoDia(r, dia) && daPessoa(r, pessoa));
  const feitasR = rot.filter(r => rotinaFeita(r, dia)).length;
  const total = minhas.length + rot.length;
  const feitas = minhas.filter(t => t.status === 'concluida').length + feitasR;
  const atr = atrasadas.filter(t => t && t.prazo && t.prazo < hoje && t.status !== 'concluida' && daPessoa(t, pessoa));
  const desde = atr.length ? atr.reduce((m, t) => (t.prazo < m ? t.prazo : m), atr[0].prazo) : null;
  return { total, feitas, faltam: total - feitas, pct: total ? Math.round(feitas / total * 100) : 0,
    rotinas: { total: rot.length, feitas: feitasR }, atrasadas: atr.length, desde };
}

// a frase embaixo da saudação — direta, sem enfeite; c = o que o contarDia devolve (null = não deu pra ler)
export function fraseDoDia(c, { hoje = ymd(new Date()) } = {}) {
  if (!c) return 'Tudo do escritório num lugar só.';
  const ontem = (() => { const d = new Date(hoje + 'T12:00:00'); d.setDate(d.getDate() - 1); return ymd(d); })();
  const quando = c.desde === ontem ? 'ontem' : ddmm(c.desde);
  const atras = !c.atrasadas ? ''
    : c.atrasadas === 1 ? 'Tem 1 atrasada, de ' + quando + ': que tal começar por ela?'
    : 'Tem ' + c.atrasadas + ' atrasadas, a mais antiga de ' + quando + ': que tal começar por elas?';
  let dia;
  if (!c.total) dia = c.atrasadas ? 'Nada marcado pra hoje.' : 'Nada marcado pra hoje e nenhuma atrasada. Dia livre pra adiantar a semana.';
  else if (!c.faltam) dia = c.atrasadas ? 'O dia de hoje está zerado.' : 'Dia zerado. Bora pro café!';
  else dia = (c.faltam === 1 ? 'Falta 1 tarefa' : 'Faltam ' + c.faltam + ' tarefas') + ' pra fechar o dia.';
  return atras ? dia + ' ' + atras : dia;
}

// o que vai escrito ao lado do anel: { titulo, detalhe }
export function textoDoAnel(c) {
  if (!c || !c.total) return { titulo: 'Nada marcado', detalhe: 'pra hoje' };
  const titulo = c.feitas + ' de ' + c.total + (c.total === 1 ? ' feita' : ' feitas');
  const detalhe = !c.faltam ? 'Dia zerado!' : c.rotinas.total ? 'rotinas ' + c.rotinas.feitas + ' de ' + c.rotinas.total : (c.faltam === 1 ? 'falta 1' : 'faltam ' + c.faltam);
  return { titulo, detalhe };
}

// ---------- a leitura ----------
// As tarefas de hoje vêm de todo mundo (são poucas) e a conta separa as da pessoa; as atrasadas vêm já filtradas pelo
// nome (podem ser muitas no escritório) — a letra acentuada vira "_" no filtro, como no assistente (Vit_ria pega
// Vitória e Vitoria) —, e a conta confere de novo. Erro em qualquer leitura devolve null: a abertura fica sem números.
export async function lerDia(supabase, { pessoa, socio = false, dia = new Date() } = {}) {
  if (!pessoa) return null;
  const hoje = ymd(dia), padrao = String(pessoa).replace(/[^\x00-\x7F]/g, '_');
  const daP = q => (socio ? q.or('responsavel.ilike.' + padrao + ',responsavel.ilike.ambos') : q.ilike('responsavel', padrao));
  try {
    const [t, a, r] = await Promise.all([
      supabase.from('tarefas').select('id, responsavel, status, prazo').eq('prazo', hoje).limit(3000),
      daP(supabase.from('tarefas').select('id, responsavel, status, prazo').lt('prazo', hoje).neq('status', 'concluida')).order('prazo', { ascending: true }).limit(3000),
      supabase.from('rotinas').select('id, responsavel, periodicidade, dia_semana, dia_mes, dia_anual, dia_util, ultima_execucao, adiada_para').eq('ativo', true).limit(3000)
    ]);
    if (t.error || a.error || r.error) return null;
    return contarDia({ tarefasHoje: t.data || [], atrasadas: a.data || [], rotinas: r.data || [], pessoa, dia });
  } catch (e) { return null; }
}
