// ============================================================
// MACEDO & REIS — O kit de tarefas da transição (transicao_kit), uma regra só (16/10/2026, pedido do Samuel)
// Quem cria a transição — a Precificação (a partir da proposta fechada) e a tela da Transição (nova transição) — monta as
// tarefas por aqui, e a Transição completa o kit por aqui quando passa a ter funcionários:
//  • item com so_com_funcionarios só entra com tera_funcionarios = true. Sem saber (null), fica de fora e nasce a tarefa
//    "Confirmar se a empresa terá funcionários" (na saída, "… tem funcionários": quem sabe é o próprio escritório) pro
//    dono desses itens: marcado "Sim" na transição, eles entram sozinhos (tarefasQueFaltam); marcado "Não", a confirmação
//    se conclui;
//  • itens com o mesmo agrupar_em viram UMA tarefa, com a lista na descrição (☐ por item, assets/js/checklist.js), no
//    maior prazo do grupo — no DP, os 13 documentos do escritório anterior (entrada) e os 13 que vão pro novo escritório
//    (saída) eram 13 tarefas cada.
// Quantos funcionários a proposta diz (C1 ativos, C2 a registrar em 90 dias) decide o tera_funcionarios de quem nasce dela.
// ============================================================
import { textoDoChecklist, acrescentarItens, itensDoChecklist } from './checklist.js';

export const CONFIRMAR_FUNCIONARIOS = 'Confirmar se a empresa terá funcionários';
export const CONFIRMAR_FUNCIONARIOS_SAIDA = 'Confirmar se a empresa tem funcionários';
export const SUFIXO_FUNCIONARIOS = ' — funcionários';
/** O nome do campo na tela da Transição: na saída, a empresa já é cliente — "tem"; na entrada e no CNPJ novo, "terá". */
export const rotuloFuncionarios = tipo => tipo === 'saida' ? 'Tem funcionários?' : 'Terá funcionários?';

const numero = v => {
  if (v == null || String(v).trim() === '') return null;
  const n = Number(String(v).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const normal = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
// o dia n dias depois de aaaa-mm-dd, no calendário (sem fuso)
export function diaMais(iso, n) {
  const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  const x = new Date(Date.UTC(a, m - 1, d + (Number(n) || 0)));
  return x.toISOString().slice(0, 10);
}

/** Terá funcionários, pelas respostas da proposta: true, false ou null (não dá pra saber). Na entrada vale quem já está
 *  registrado (C1) e quem vai ser (C2); no CNPJ novo, só quem vai ser. */
export function teraFuncionariosDaProposta(respostas, tipo = 'entrada') {
  const r = respostas || {};
  const c1 = numero(r.C1), c2 = numero(r.C2);
  if (tipo === 'cnpj_novo') return c2 == null ? null : c2 > 0;
  if ((c1 || 0) > 0 || (c2 || 0) > 0) return true;
  if (c1 === 0) return false;
  return null;
}

const ordenar = kit => (kit || []).filter(k => k && k.ativo !== false).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
const tarefa = (k, { titulo, descricao = null, prazo, transicaoId, clienteId }) => ({
  setor: k.setor, tipo: 'tarefa', titulo, descricao,
  responsavel: k.responsavel_padrao || null, prazo,
  status: 'pendente', origem: 'transicao', transicao_id: transicaoId, fase: k.fase || null, cliente_id: clienteId || null
});

/** As tarefas que a transição ganha ao nascer. */
export function tarefasDoKit(kit, { inicio, teraFuncionarios = null, transicaoId = null, clienteId = null }) {
  const itens = ordenar(kit);
  const entra = k => !k.so_com_funcionarios || teraFuncionarios === true;
  const saida = [], grupos = new Map();
  for (const k of itens) {
    if (!entra(k)) continue;
    if (!k.agrupar_em) { saida.push(tarefa(k, { titulo: k.titulo, prazo: diaMais(inicio, k.prazo_dias), transicaoId, clienteId })); continue; }
    const chave = k.setor + '|' + k.agrupar_em;
    if (!grupos.has(chave)) { grupos.set(chave, []); saida.push({ _grupo: chave }); }
    grupos.get(chave).push(k);
  }
  const tarefas = saida.map(t => {
    if (!t._grupo) return t;
    const ks = grupos.get(t._grupo);
    const prazo = diaMais(inicio, Math.max(...ks.map(k => Number(k.prazo_dias) || 0)));
    return tarefa(ks[0], { titulo: ks[0].agrupar_em, descricao: textoDoChecklist(ks.map(k => k.titulo)), prazo, transicaoId, clienteId });
  });
  if (teraFuncionarios == null) tarefas.push(...confirmacoes(itens, { inicio, transicaoId, clienteId }));
  return tarefas;
}

// uma confirmação por setor que tem item só com funcionários (o dono é o desses itens). Na saída a empresa ainda é
// cliente: o escritório confere na folha dela, sem perguntar
function confirmacoes(itens, { inicio, transicaoId, clienteId }) {
  const porSetor = new Map();
  itens.filter(k => k.so_com_funcionarios).forEach(k => { if (!porSetor.has(k.setor)) porSetor.set(k.setor, []); porSetor.get(k.setor).push(k); });
  return [...porSetor.values()].map(ks => {
    const saida = ks[0].tipo === 'saida', lista = ks.map(k => k.titulo).join(' · ');
    return tarefa(ks[0], {
      titulo: saida ? CONFIRMAR_FUNCIONARIOS_SAIDA : CONFIRMAR_FUNCIONARIOS,
      descricao: saida
        ? 'Confira na folha se a empresa tem funcionários e marque em Comercial › Transição › Editar › "Tem funcionários". '
          + 'Com "Sim", entram sozinhos: ' + lista + '.'
        : 'Pergunte à empresa se ela tem (ou terá) funcionários e marque em Comercial › Transição › Editar › "Terá funcionários". '
          + 'Com "Sim", entram sozinhas: ' + lista + '.',
      prazo: diaMais(inicio, 5), transicaoId, clienteId
    });
  });
}
const ehConfirmacao = titulo => [CONFIRMAR_FUNCIONARIOS, CONFIRMAR_FUNCIONARIOS_SAIDA].some(c => normal(c) === normal(titulo));

/** A transição passou a ter funcionários (ou deixou de não saber): o que falta do kit, sem repetir o que ela já tem.
 *  existentes = as tarefas dela ({ id, setor, titulo, descricao, status }). Devolve { novas, atualizar: [{ id, descricao }],
 *  concluir: [ids das confirmações abertas] }. Com teraFuncionarios false, só conclui as confirmações. */
export function tarefasQueFaltam(kit, existentes, { teraFuncionarios, inicio, hoje, transicaoId = null, clienteId = null }) {
  const lista = existentes || [];
  const concluir = lista.filter(t => ehConfirmacao(t.titulo) && t.status !== 'concluida').map(t => t.id);
  if (teraFuncionarios !== true) return { novas: [], atualizar: [], concluir };
  const base = String(hoje || inicio) > String(inicio) ? String(hoje) : String(inicio);   // o que entra agora conta o prazo a partir de hoje
  const tem = (setor, titulo) => lista.find(t => t.setor === setor && normal(t.titulo) === normal(titulo));
  const itens = ordenar(kit).filter(k => k.so_com_funcionarios);
  const novas = [], atualizar = [], grupos = new Map();
  for (const k of itens) {
    if (!k.agrupar_em) { if (!tem(k.setor, k.titulo)) novas.push(tarefa(k, { titulo: k.titulo, prazo: diaMais(base, k.prazo_dias), transicaoId, clienteId })); continue; }
    const chave = k.setor + '|' + k.agrupar_em;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(k);
  }
  for (const ks of grupos.values()) {
    const k0 = ks[0], lista0 = tem(k0.setor, k0.agrupar_em);
    const titulos = ks.map(k => k.titulo);
    if (lista0 && lista0.status !== 'concluida') {
      const ja = new Set(itensDoChecklist(lista0.descricao).map(i => normal(i.texto)));
      const faltam = titulos.filter(t => !ja.has(normal(t)));
      if (faltam.length) atualizar.push({ id: lista0.id, descricao: acrescentarItens(lista0.descricao, faltam) });
      continue;
    }
    const extra = k0.agrupar_em + SUFIXO_FUNCIONARIOS;
    if (tem(k0.setor, extra)) continue;
    const prazo = diaMais(base, Math.max(...ks.map(k => Number(k.prazo_dias) || 0)));
    novas.push(tarefa(k0, { titulo: extra, descricao: textoDoChecklist(titulos), prazo, transicaoId, clienteId }));
  }
  return { novas, atualizar, concluir };
}
