// ============================================================
// MACEDO & REIS — Edge Function ponte: as regras puras (23/10/2026)
// O pacote da Receita que a ponte do PC do escritório manda (o contrato está em docs/FILA-CODE-2026-10-23.md, 2.5) é
// conferido campo a campo e montado de novo só com o que o contrato prevê: o que vier a mais fica de fora, texto é
// cortado, número e data têm de ser de verdade. Quem grava é o banco (receita_gravar), com o pacote que sai daqui.
// E a lista de empresas que a ponte consulta: os clientes de hoje da carteira, CNPJ, com o regime.
// Sem import: testes no node em tests/ponte-funcao.test.mjs.
// ============================================================

export const LIMITES = { empresas: 3000, meses: 36, mensagens: 300, pendencias: 100, faltou: 6000, corpo: 5 * 1024 * 1024 };
export const SERVICOS = ['autorizacao', 'pgdas', 'faturamento', 'caixa_postal', 'situacao_fiscal'];
export const MOTIVOS = ['sem_autorizacao', 'teto', 'erro', 'a_conferir'];
export const REGIME = { 'Simples Nacional': 'simples', MEI: 'mei', 'Lucro Presumido': 'presumido', 'Lucro Real': 'real' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COMPETENCIA = /^[0-9]{4}-(0[1-9]|1[0-2])$/;

class Recusa extends Error {}
const recusar = (campo, porque) => { const e = new Recusa(porque); e.campo = campo; throw e; };

const texto = (v, max) => {
  if (v == null) return null;
  const s = String(v).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return s ? s.slice(0, max) : null;
};
// CNPJ (com letras, desde o CNPJ alfanumérico) ou CPF: só letras e dígitos, em maiúscula
export const documento = v => {
  const d = String(v == null ? '' : v).replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  return d.length === 14 || d.length === 11 ? d : null;
};
const dataDe = (v, campo) => {
  if (v == null || v === '') return null;
  const s = String(v);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) recusar(campo, 'data fora do formato AAAA-MM-DD');
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) recusar(campo, 'data que não existe');
  return s;
};
const momentoDe = (v, campo) => {
  if (v == null || v === '') return null;
  const s = String(v);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(s) || Number.isNaN(Date.parse(s))) recusar(campo, 'data e hora fora do formato (com o fuso)');
  return s;
};
const valorDe = (v, campo) => {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (typeof v === 'boolean' || !Number.isFinite(n) || n < 0 || n > 1e13) recusar(campo, 'valor que não é um número de dinheiro');
  return Math.round(n * 100) / 100;
};
const simNao = (v, campo) => {
  if (v == null) return null;
  if (typeof v !== 'boolean') recusar(campo, 'tem que ser true, false ou null');
  return v;
};
const lista = (v, max, campo) => {
  if (v == null) return [];
  if (!Array.isArray(v)) recusar(campo, 'tem que ser uma lista');
  if (v.length > max) recusar(campo, 'lista longa demais (até ' + max + ')');
  return v;
};
const objeto = (v, campo) => {
  if (v == null || typeof v !== 'object' || Array.isArray(v)) recusar(campo, 'tem que ser um objeto');
  return v;
};

function empresa(e, i) {
  const onde = 'empresas[' + i + ']';
  objeto(e, onde);
  const doc = documento(e.documento);
  if (!doc) recusar(onde + '.documento', 'CNPJ ou CPF inválido');
  const out = { documento: doc };
  if (e.autorizacao != null) {
    const a = objeto(e.autorizacao, onde + '.autorizacao');
    const sit = String(a.situacao || '');
    if (!['ativa', 'vencida', 'sem'].includes(sit)) recusar(onde + '.autorizacao.situacao', 'tem que ser ativa, vencida ou sem');
    out.autorizacao = { situacao: sit, valida_ate: dataDe(a.valida_ate, onde + '.autorizacao.valida_ate') };
  }
  if (e.pgdas != null) {
    const p = objeto(e.pgdas, onde + '.pgdas');
    const ano = p.ano == null ? null : Number(p.ano);
    if (ano != null && !(Number.isInteger(ano) && ano >= 2007 && ano <= 2100)) recusar(onde + '.pgdas.ano', 'ano inválido');
    out.pgdas = { ano, meses: lista(p.meses, LIMITES.meses, onde + '.pgdas.meses').map((m, j) => {
      const w = onde + '.pgdas.meses[' + j + ']';
      objeto(m, w);
      if (!COMPETENCIA.test(String(m.competencia || ''))) recusar(w + '.competencia', 'competência fora do formato AAAA-MM');
      return { competencia: m.competencia, transmitida_em: momentoDe(m.transmitida_em, w + '.transmitida_em'), das_pago: simNao(m.das_pago, w + '.das_pago') };
    }) };
  }
  if (e.faturamento != null) {
    const f = objeto(e.faturamento, onde + '.faturamento');
    if (!COMPETENCIA.test(String(f.competencia || ''))) recusar(onde + '.faturamento.competencia', 'competência fora do formato AAAA-MM');
    out.faturamento = { competencia: f.competencia, receita_mes: valorDe(f.receita_mes, onde + '.faturamento.receita_mes'),
      receita_12_meses: valorDe(f.receita_12_meses, onde + '.faturamento.receita_12_meses') };
  }
  if (e.caixa_postal != null) {
    const c = objeto(e.caixa_postal, onde + '.caixa_postal');
    out.caixa_postal = { mensagens: lista(c.mensagens, LIMITES.mensagens, onde + '.caixa_postal.mensagens').map((m, j) => {
      const w = onde + '.caixa_postal.mensagens[' + j + ']';
      objeto(m, w);
      const id = texto(m.id, 80), assunto = texto(m.assunto, 300);
      if (!id) recusar(w + '.id', 'mensagem sem id');
      if (!assunto) recusar(w + '.assunto', 'mensagem sem assunto');
      return { id, assunto, enviada_em: dataDe(m.enviada_em, w + '.enviada_em'), origem: texto(m.origem, 30), lida: simNao(m.lida, w + '.lida') };
    }) };
  }
  if (e.situacao_fiscal != null) {
    const s = objeto(e.situacao_fiscal, onde + '.situacao_fiscal');
    const em = dataDe(s.consultada_em, onde + '.situacao_fiscal.consultada_em');
    if (!em) recusar(onde + '.situacao_fiscal.consultada_em', 'falta a data da consulta');
    out.situacao_fiscal = { consultada_em: em, pendencias: lista(s.pendencias, LIMITES.pendencias, onde + '.situacao_fiscal.pendencias').map((x, j) => {
      const w = onde + '.situacao_fiscal.pendencias[' + j + ']';
      objeto(x, w);
      const titulo = texto(x.titulo, 200);
      if (!titulo) recusar(w + '.titulo', 'pendência sem título');
      return { orgao: texto(x.orgao, 30) || 'Receita', titulo };
    }) };
  }
  return out;
}

/** O pacote da Receita conferido: { ok: true, pacote } (só o contrato) ou { ok: false, campo, erro }. */
export function validarPacote(p) {
  try {
    objeto(p, 'pacote');
    if (p.versao !== 1) recusar('versao', 'versão do pacote desconhecida (esta função lê a 1)');
    if (p.tipo !== 'receita') recusar('tipo', 'não é um pacote da Receita');
    const r = objeto(p.rodada, 'rodada');
    if (!UUID.test(String(r.id || ''))) recusar('rodada.id', 'o id da rodada tem que ser um uuid');
    const chamadas = r.chamadas_mes == null ? null : Number(r.chamadas_mes);
    if (chamadas != null && !(Number.isInteger(chamadas) && chamadas >= 0 && chamadas < 1e7)) recusar('rodada.chamadas_mes', 'número de chamadas inválido');
    const rodada = { id: String(r.id).toLowerCase(), inicio: momentoDe(r.inicio, 'rodada.inicio'), fim: momentoDe(r.fim, 'rodada.fim'),
      maquina: texto(r.maquina, 60), ponte: texto(r.ponte, 20), ambiente: texto(r.ambiente, 20), chamadas_mes: chamadas };
    const empresas = lista(p.empresas, LIMITES.empresas, 'empresas').map(empresa);
    const faltou = lista(p.faltou, LIMITES.faltou, 'faltou').map((f, i) => {
      objeto(f, 'faltou[' + i + ']');
      const motivo = String(f.motivo || '');
      if (!MOTIVOS.includes(motivo)) recusar('faltou[' + i + '].motivo', 'motivo desconhecido');
      const servico = String(f.servico || '');
      if (!SERVICOS.includes(servico)) recusar('faltou[' + i + '].servico', 'serviço desconhecido');
      return { documento: documento(f.documento), servico, motivo, ...(texto(f.detalhe, 200) ? { detalhe: texto(f.detalhe, 200) } : {}) };
    });
    return { ok: true, pacote: { versao: 1, tipo: 'receita', rodada, empresas, faltou } };
  } catch (e) {
    if (e instanceof Recusa) return { ok: false, campo: e.campo, erro: e.message };
    throw e;
  }
}

/** Os clientes de hoje da carteira que a ponte consulta: CNPJ, com regime do Simples, MEI, Presumido ou Real.
 *  carteira: [{ cliente_id, entrada, saida }] · clientes: [{ id, documento, regime_tributario }] · hoje: 'AAAA-MM-DD' */
export function empresasDaCarteira(carteira, clientes, hoje) {
  const ativos = new Set((carteira || []).filter(k => k && k.cliente_id && k.entrada && (!k.saida || String(k.saida) > hoje)).map(k => k.cliente_id));
  const vistos = new Set();
  const out = [];
  (clientes || []).forEach(c => {
    if (!c || !ativos.has(c.id)) return;
    const doc = documento(c.documento);
    const regime = REGIME[c.regime_tributario];
    if (!doc || doc.length !== 14 || !regime || vistos.has(doc)) return;
    vistos.add(doc);
    out.push({ documento: doc, regime });
  });
  return out.sort((a, b) => a.documento.localeCompare(b.documento));
}

/** O dia de hoje em Brasília, AAAA-MM-DD. */
export function hojeEmBrasilia(agora = Date.now()) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(agora));
  return p;
}

/** A impressão digital (SHA-256, em hexadecimal) de um texto. */
export async function sha256Hex(s) {
  const b = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s)));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

/** Comparação que leva o mesmo tempo pra qualquer diferença (a chave não vaza pelo relógio). */
export function iguais(a, b) {
  const x = String(a || ''), y = String(b || '');
  let dif = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) dif |= (x.charCodeAt(i) || 0) ^ (y.charCodeAt(i) || 0);
  return dif === 0 && x.length > 0;
}
