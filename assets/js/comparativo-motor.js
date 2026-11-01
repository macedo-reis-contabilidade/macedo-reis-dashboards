// ============================================================
// MACEDO & REIS — Comparativo tributário (Simples × Presumido × Real)
// Módulo ES puro, sem DOM. Usado por fiscal-comparativo.html e testado por
// tests/comparativo-motor.test.mjs (contas feitas à mão pelas tabelas da lei —
// se não bater, o motor está errado, não o teste).
//
// O que faz (01/11/2026, pedido do Samuel: "calcular e simular com base nas
// informações passadas e projeções futuras, como ficaria o imposto daquela
// empresa no regime X"): pega os 12 meses da empresa (a base) e calcula os
// tributos a recolher no Simples, no Lucro Presumido e no Lucro Real, ano a ano:
// a base pelas regras de 2026 e as projeções de 2027 e 2028, já com a Reforma
// (CBS no lugar do PIS/Cofins, IBS de 0,1%, IPI zero, fim do monofásico no DAS).
//
// Convenção (a mesma do motor da Reforma, rt-motor.js): todo tributo é calculado
// sobre a receita de hoje e conta como custo da empresa — os preços ficam como
// estão. A CBS/IBS do regime regular vai destacada na nota, por fora do preço, e o
// cliente empresa do regime regular a credita; quanto disso vira preço é decisão
// comercial (a opção do Simples por fora, o "híbrido", é a ficha da Reforma).
//
// Fora da conta (nesta versão): o IPI que a atividade não informa (o de 2026 do
// Presumido e do Real é o `aliqIpi` da indústria; de 2027 em diante é zero, salvo
// industrialização incentivada na Zona Franca), Imposto Seletivo, receitas
// financeiras e ganhos de capital, adições e exclusões do Real, compensação de
// prejuízo, JCP, a tributação de lucros e dividendos (Lei 15.270), exportação,
// ICMS-ST e DIFAL de uso e consumo (iguais em todo regime) e os anos de 2029 em
// diante (falta a alíquota de referência do IBS).
// ============================================================

import { TAB_SIMPLES, aliqEfetiva, faixaDe, anexo2027, PARTILHA_CBS_IBS_2027, FATIA_ICMS_ISS_2027, ISS_TETO, aliquotas2027 } from './rt-motor.js';

// ---------- as atividades ----------
// Cada linha de receita tem o anexo do Simples, os percentuais de presunção do Presumido (Lei 9.249/1995, art. 15
// — IRPJ — e art. 20 — CSLL) e o tributo da operação (ICMS ou ISS). Os padrões são os da atividade; tudo é editável
// na tela (transporte de carga, por exemplo: IRPJ 8%, CSLL 12%, ICMS; construção com material: IRPJ 8%).
export const TIPOS = {
  comercio:   { rotulo: 'Comércio (revenda de mercadorias)', anexo: 'I',   fatorR: false, presIrpj: 8,  presCsll: 12, tributo: 'icms' },
  industria:  { rotulo: 'Indústria',                          anexo: 'II',  fatorR: false, presIrpj: 8,  presCsll: 12, tributo: 'icms' },
  servico:    { rotulo: 'Serviços do Anexo III',              anexo: 'III', fatorR: false, presIrpj: 32, presCsll: 32, tributo: 'iss' },
  servico_r:  { rotulo: 'Serviços do fator r (Anexo V ou III)', anexo: 'V', fatorR: true,  presIrpj: 32, presCsll: 32, tributo: 'iss' },
  servico_iv: { rotulo: 'Serviços do Anexo IV',               anexo: 'IV',  fatorR: false, presIrpj: 32, presCsll: 32, tributo: 'iss' }
};
export const ANEXOS = ['I', 'II', 'III', 'IV', 'V'];
export const REGIMES = ['simples', 'presumido', 'real'];
export const ROTULO_REGIME = { simples: 'Simples Nacional', presumido: 'Lucro Presumido', real: 'Lucro Real' };
// os anos que o motor sabe calcular: 2026 (regras de hoje), 2027 e 2028 (CBS cheia, IBS de 0,1%, ICMS e ISS inteiros).
// De 2029 a 2032 o ICMS e o ISS caem e o IBS sobe, mas a alíquota de referência do IBS ainda não existe.
export const ANOS = [2026, 2027, 2028];

// ---------- números da lei ----------
export const SUBLIMITE = 3600000;          // ICMS e ISS (e o IBS, em 2027) saem do DAS acima dele (LC 123, art. 13-A)
export const LIMITE_SIMPLES = 4800000;     // LC 123, art. 3º, II
export const FATOR_R = 0.28;               // LC 123, art. 18, §5º-J e §5º-M
export const FGTS = 0.08;
// Lucro Presumido: IRPJ 15% + adicional de 10% sobre o que passa de R$ 20 mil por mês do período (Lei 9.249, art. 3º, §1º;
// Lei 9.430, art. 4º) — no Presumido, trimestral: R$ 60 mil por trimestre. CSLL 9% (Lei 7.689, art. 3º, III).
export const IRPJ = 0.15, ADICIONAL = 0.10, ADICIONAL_TRIMESTRE = 60000, ADICIONAL_ANO = 240000, CSLL = 0.09;
// PIS/Cofins: cumulativo no Presumido (0,65% da Lei 9.715, art. 8º, I, + 3% da Lei 9.718), não cumulativo no Real (Leis 10.637
// e 10.833: 1,65% + 7,6%).
// O ICMS destacado sai da base das saídas (STF, Tema 69) e do crédito das compras (Lei 14.592/2023).
export const PIS_CUM = 0.0065, COFINS_CUM = 0.03, PIS_NC = 0.0165, COFINS_NC = 0.076;
// LC 224/2025, art. 4º, §4º, VII, e §5º: no Presumido, os percentuais de presunção sobem 10% sobre a parte da receita
// bruta que passa de R$ 5 milhões no ano — limite proporcional a cada período de apuração (R$ 1,25 milhão por trimestre,
// com ajuste nos seguintes), dividido pelas atividades na proporção da receita. IRPJ desde 01/01/2026, CSLL desde
// 01/04/2026. Há liminares individuais (TRF-4, AI 5028128-82.2026.4.04.0000) e a ADI 7936 no STF, sem decisão:
// o motor aplica o aumento; a empresa com liminar o desliga (entrada.semLc224).
export const LC224_LIMITE_ANO = 5000000, LC224_ACRESCIMO = 0.10;
// INSS patronal no Presumido e no Real (Lei 8.212, art. 22): 20% da folha + RAT (1, 2 ou 3%, vezes o FAP) + terceiros
// (5,8% na maioria dos FPAS) e 20% do pró-labore. No Simples só o Anexo IV paga fora do DAS: 20% + RAT, sem terceiros
// (LC 123, art. 18, §5º-C, e art. 13, §3º).
export const CPP = 0.20, CPP_PRO_LABORE = 0.20;
// Desoneração da folha (Lei 14.973/2024): a CPRB cai e a CPP sobe de volta, ano a ano, até acabar em 2028.
export const CPRB_TRANSICAO = { 2025: { cpp: 0.25, cprb: 0.80 }, 2026: { cpp: 0.50, cprb: 0.60 }, 2027: { cpp: 0.75, cprb: 0.40 } };
// Crédito de quem compra de fornecedor do Simples por dentro: só o IBS/CBS que ele recolheu no DAS (LC 214, art. 47,
// §9º) — a mesma estimativa de 15% do crédito cheio da Reforma (dominio-relatorios.js, CREDITO_FORNECEDOR_SIMPLES).
export const CREDITO_FORNECEDOR_SIMPLES = 0.15;

// PARTILHA DE 2026 (LC 123, Anexos I a V, na redação da LC 155/2016) — só as fatias que as exclusões usam:
// a do ICMS (a revenda com ICMS-ST tira essa fatia do DAS) e a de PIS + Cofins (a revenda monofásica tira essa, só até
// 2026). Faixas 1 a 5: as mesmas da partilha de 2027 do rt-motor (a Res. CGSN 190/2026 manteve o ICMS e a CBS+IBS de
// 2027 é a fatia de PIS+Cofins de 2026, conferido célula a célula). 6ª faixa (2026), conferida em 01/11/2026 nas
// tabelas da LC 123: I 28,27 + 6,13 · II 20,96 + 4,54 · III 16,03 + 3,47 · IV 20,55 + 4,45 · V 16,44 + 3,56.
const PIS_COFINS_2026_6A = { I: 34.40, II: 25.50, III: 19.50, IV: 25.00, V: 20.00 };
function fatiaPisCofins2026(anexo, f) { return f === 5 ? PIS_COFINS_2026_6A[anexo] : PARTILHA_CBS_IBS_2027[anexo][f]; }

const num = (v, def = 0) => {
  if (v == null || v === '') return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};
const entre = (v, a, b) => Math.min(b, Math.max(a, v));
const brl = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct1 = v => (Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 });

// ---------- a entrada ----------
// Valores em R$ dos 12 meses da base; percentuais como a equipe digita (17 = 17%).
//   atividades: [{ tipo, receita, anexo?, fatorR?, presIrpj?, presCsll?, tributo?, aliqIcms?, aliqIss?, pctST?,
//                 pctMonofasico?, ipiMantido? }]
//   meses (opcional): a receita de cada um dos 12 meses da base, na ordem — só a forma do ano (trimestres, RBT12)
//   receitaAnoAnterior (opcional): a receita dos 12 meses antes da base (o RBT12 do primeiro mês, no PGDAS)
//   folha (salários, 13º e férias — a base do INSS) · proLabore · rat (1 a 3) · fap (padrão 1) · terceiros (padrão 5,8)
//   cprb (opcional): alíquota cheia da CPRB da atividade (desoneração da folha), ex.: 1,5
//   compras (mercadorias e insumos) · pctComprasST (padrão: o % de ST das vendas) · pctComprasMonofasico (padrão: o das vendas)
//   creditoIcms (R$, medido) ou aliqCreditoIcms (padrão 12) · pctImpostoEmbutido (ICMS, ST e IPI no valor das compras,
//     padrão: a alíquota do crédito de ICMS) · pctComprasSimples (% das compras de fornecedor do Simples, padrão 0)
//   despesasCredito (energia, aluguel de PJ, frete, serviço de PJ: crédito de PIS/Cofins no Real e de CBS/IBS)
//   outrasDespesas (o resto dos custos e despesas, sem crédito: o que falta pro lucro do Real)
//   difalSimples (ICMS pago fora do DAS pelo optante: diferencial de alíquota e antecipação, por ano)
//   mix (CBS/IBS das vendas): { cheia, red60, red40, red30, zero } — padrão cheia 100 · pctComprasComCredito (opcional)
//   crescimentoReceita / crescimentoFolha (% ao ano, das projeções) · semLc224 · aliq2027 ({ cbs, cbs_aplicada, ibs })
export function normalizar(e = {}) {
  const atividades = (e.atividades || []).map(a => {
    const tipo = TIPOS[a.tipo] ? a.tipo : 'comercio';
    const t = TIPOS[tipo];
    const anexo = ANEXOS.includes(String(a.anexo || '').toUpperCase()) ? String(a.anexo).toUpperCase() : t.anexo;
    return {
      tipo, rotulo: t.rotulo,
      receita: Math.max(0, num(a.receita)),
      anexo,
      fatorR: a.fatorR != null ? !!a.fatorR : t.fatorR,
      presIrpj: entre(num(a.presIrpj, t.presIrpj), 0, 100), presCsll: entre(num(a.presCsll, t.presCsll), 0, 100),
      tributo: a.tributo === 'icms' || a.tributo === 'iss' ? a.tributo : t.tributo,
      aliqIcms: entre(num(a.aliqIcms, 17), 0, 40), aliqIss: entre(num(a.aliqIss, 3), 0, 5),
      pctST: entre(num(a.pctST), 0, 100), pctMonofasico: entre(num(a.pctMonofasico), 0, 100),
      ipiMantido: !!a.ipiMantido,
      // o IPI a recolher em 2026 no Presumido e no Real, em % da receita da indústria (já com os créditos); no Simples
      // ele está no DAS (Anexo II). Em 2027 vira zero, salvo industrialização incentivada na Zona Franca (ADCT, art. 126, III)
      aliqIpi: tipo === 'industria' ? entre(num(a.aliqIpi), 0, 30) : 0
    };
  }).filter(a => a.receita > 0);
  if (!atividades.length) throw new Error('Informe a receita de pelo menos uma atividade.');
  const receita = atividades.reduce((s, a) => s + a.receita, 0);
  // o % de ST e de monofásico das compras segue o das vendas de mercadoria, salvo informado
  const recIcms = atividades.filter(a => a.tributo === 'icms').reduce((s, a) => s + a.receita, 0);
  const media = k => recIcms > 0 ? atividades.filter(a => a.tributo === 'icms').reduce((s, a) => s + a.receita * a[k], 0) / recIcms : 0;
  const mixIn = e.mix || {};
  const mix = { cheia: num(mixIn.cheia, 100), red60: num(mixIn.red60), red40: num(mixIn.red40), red30: num(mixIn.red30), zero: num(mixIn.zero) };
  const somaMix = mix.cheia + mix.red60 + mix.red40 + mix.red30 + mix.zero;
  if (Math.abs(somaMix - 100) > 0.5) throw new Error('O mix das vendas precisa somar 100% (soma: ' + pct1(somaMix) + '%).');
  let meses = Array.isArray(e.meses) && e.meses.length === 12 && e.meses.every(v => num(v, -1) >= 0) ? e.meses.map(v => num(v)) : null;
  const somaMeses = meses ? meses.reduce((s, v) => s + v, 0) : 0;
  if (!(somaMeses > 0)) meses = null;
  const aliqCreditoIcms = entre(num(e.aliqCreditoIcms, 12), 0, 40);
  const n = {
    atividades, receita,
    pesos: meses ? meses.map(v => v / somaMeses) : Array(12).fill(1 / 12),
    receitaAnoAnterior: num(e.receitaAnoAnterior) > 0 ? num(e.receitaAnoAnterior) : null,
    folha: Math.max(0, num(e.folha)), proLabore: Math.max(0, num(e.proLabore)),
    rat: entre(num(e.rat, 2), 0, 3), fap: entre(num(e.fap, 1), 0.5, 2), terceiros: entre(num(e.terceiros, 5.8), 0, 10),
    cprb: num(e.cprb) > 0 ? entre(num(e.cprb), 0, 10) : null,
    compras: Math.max(0, num(e.compras)),
    pctComprasST: entre(num(e.pctComprasST, media('pctST')), 0, 100),
    pctComprasMonofasico: entre(num(e.pctComprasMonofasico, media('pctMonofasico')), 0, 100),
    creditoIcms: e.creditoIcms != null && e.creditoIcms !== '' && num(e.creditoIcms, -1) >= 0 ? num(e.creditoIcms) : null,
    aliqCreditoIcms,
    pctImpostoEmbutido: entre(num(e.pctImpostoEmbutido, aliqCreditoIcms), 0, 60),
    pctComprasSimples: entre(num(e.pctComprasSimples), 0, 100),
    pctComprasComCredito: e.pctComprasComCredito == null || e.pctComprasComCredito === '' ? null : entre(num(e.pctComprasComCredito), 0, 100),
    despesasCredito: Math.max(0, num(e.despesasCredito)),
    outrasDespesas: num(e.outrasDespesas),
    difalSimples: Math.max(0, num(e.difalSimples)),
    mix,
    crescimentoReceita: entre(num(e.crescimentoReceita), -90, 300), crescimentoFolha: entre(num(e.crescimentoFolha), -90, 300),
    semLc224: !!e.semLc224,
    aliq2027: aliquotas2027(e.aliq2027),
    anoBase: ANOS.includes(num(e.anoBase, 2026)) ? num(e.anoBase, 2026) : 2026,
    regimeAtual: REGIMES.includes(e.regimeAtual) ? e.regimeAtual : null
  };
  return n;
}

// o ano k da projeção (0 = a base): receita, compras e despesas crescem com a receita; folha e pró-labore com a folha
function dadosDoAno(n, k) {
  const fr = Math.pow(1 + n.crescimentoReceita / 100, k), ff = Math.pow(1 + n.crescimentoFolha / 100, k);
  return {
    fr, ff,
    atividades: n.atividades.map(a => ({ ...a, receita: a.receita * fr })),
    receita: n.receita * fr,
    folha: n.folha * ff, proLabore: n.proLabore * ff,
    compras: n.compras * fr, creditoIcms: n.creditoIcms != null ? n.creditoIcms * fr : null,
    despesasCredito: n.despesasCredito * fr, outrasDespesas: n.outrasDespesas * fr, difalSimples: n.difalSimples * fr
  };
}

// receita de um mês qualquer da série contínua (k pode ser negativo: os anos antes da base). O ano antes da base é o
// receitaAnoAnterior informado (o RBT12 do primeiro mês, no PGDAS) ou a base descontado o crescimento.
function receitaDoMes(n, k, m) {
  while (m < 0) { m += 12; k -= 1; }
  while (m > 11) { m -= 12; k += 1; }
  let total;
  if (k === -1 && n.receitaAnoAnterior != null) total = n.receitaAnoAnterior;
  else if (k < -1 && n.receitaAnoAnterior != null) total = n.receitaAnoAnterior * Math.pow(1 + n.crescimentoReceita / 100, k + 1);
  else total = n.receita * Math.pow(1 + n.crescimentoReceita / 100, k);
  return total * n.pesos[m];
}
// folha do fator r no mês (salários + pró-labore + FGTS; a CPP do Simples está no DAS): por igual nos 12 meses
function folhaDoMes(n, k, m) {
  while (m < 0) { m += 12; k -= 1; }
  while (m > 11) { m -= 12; k += 1; }
  const ff = Math.pow(1 + n.crescimentoFolha / 100, k);
  return (n.folha * (1 + FGTS) + n.proLabore) * ff / 12;
}
// RBT12 e FS12 do mês m do ano k. Até 2026, os 12 meses antes do período; de 2027 em diante, a janela recua um mês
// (Res. CGSN 140, art. 21, II, "a", e art. 26, na redação da Res. CGSN 190/2026: PA de jan/2027 → dez/2025 a nov/2026).
function janela12(n, k, m, ano, f) {
  const recua = ano >= 2027 ? 1 : 0;
  let s = 0;
  for (let j = 1; j <= 12; j++) s += f(n, k, m - j - recua);
  return s;
}

// ---------- ICMS do regime normal (Presumido, Real e o optante acima do sublimite) ----------
// débito: as vendas de mercadoria sem ST × a alíquota delas; crédito: o medido (R$) ou as compras sem ST × a alíquota
// média do crédito. Saldo credor não vira dinheiro: o ICMS do ano é no mínimo zero.
function icmsNormal(n, d, fracaoDoAno = 1) {
  const debito = d.atividades.filter(a => a.tributo === 'icms').reduce((s, a) => s + a.receita * (1 - a.pctST / 100) * a.aliqIcms / 100, 0) * fracaoDoAno;
  if (!(debito > 0)) return { debito: 0, credito: 0, valor: 0 };
  const credito = (d.creditoIcms != null ? d.creditoIcms : d.compras * (1 - n.pctComprasST / 100) * n.aliqCreditoIcms / 100) * fracaoDoAno;
  return { debito, credito, valor: Math.max(0, debito - credito) };
}
function issDe(d, fracaoDoAno = 1) {
  return d.atividades.filter(a => a.tributo === 'iss').reduce((s, a) => s + a.receita * a.aliqIss / 100, 0) * fracaoDoAno;
}
// ICMS destacado nas vendas (sai da base do PIS/Cofins — Tema 69 — e da CBS/IBS até 2032 — LC 214, art. 12, §2º)
// e o crédito de ICMS das compras (sai da base do crédito de PIS/Cofins — Lei 14.592/2023)

// ---------- INSS patronal do regime regular ----------
// Na desoneração (Lei 12.546, art. 9º-A, na redação da Lei 14.973/2024), a contribuição reduzida da transição vale pros
// empregados e pro pró-labore (art. 22, I e III) e não alcança o 13º (§1º): o 13º fica só na CPRB. A folha da tela traz o
// 13º junto: ele é estimado em 1/13,33 dela (12 salários, o 13º e o terço de férias). RAT e terceiros, cheios.
// (Revisão de 01/11/2026: antes o pró-labore pagava 20% cheio e o 13º, a CPP reduzida.)
export const PARTE_DO_13 = 1 / (13 + 1 / 3);
function inssRegular(n, d, ano) {
  const t = n.cprb ? (CPRB_TRANSICAO[ano] || (ano < 2025 ? { cpp: 0, cprb: 1 } : { cpp: 1, cprb: 0 })) : { cpp: 1, cprb: 0 };
  const decimo = n.cprb && t.cpp < 1 ? d.folha * PARTE_DO_13 : 0;
  const cpp = (d.folha - decimo) * CPP * t.cpp;
  const rat = d.folha * (n.rat / 100) * n.fap;
  const terceiros = d.folha * n.terceiros / 100;
  const proLabore = d.proLabore * CPP_PRO_LABORE * (n.cprb ? t.cpp : 1);
  const cprb = n.cprb ? d.receita * (n.cprb / 100) * t.cprb : 0;
  return { cpp, rat, terceiros, proLabore, cprb, decimo, total: cpp + rat + terceiros + proLabore + cprb };
}

// ---------- CBS/IBS do regime regular (2027 em diante) ----------
// débito sobre a venda sem o ICMS e o ISS (LC 214, art. 12, §2º — até 2032), pelo mix das vendas (−60%, −40% de bares,
// −30%, zero); crédito das compras sem o imposto embutido (ICMS, ST e IPI), com o mix das compras (o medido ou o das
// vendas) e o crédito menor de fornecedor do Simples; despesas com crédito cheio.
function fatorDoMix(m) { return (m.cheia + 0.4 * m.red60 + 0.6 * m.red40 + 0.7 * m.red30) / 100; }
function cbsIbsRegular(n, d, ano, icmsDebito, iss) {
  const aliq = (n.aliq2027.cbs + (ano <= 2028 ? n.aliq2027.ibs : 0)) / 100;
  const fMix = fatorDoMix(n.mix);
  const fCompras = n.pctComprasComCredito != null ? n.pctComprasComCredito / 100 : fMix;
  const fForn = 1 - n.pctComprasSimples / 100 * (1 - CREDITO_FORNECEDOR_SIMPLES);
  const debito = Math.max(0, d.receita - icmsDebito - iss) * aliq * fMix;
  const credito = (d.compras * (1 - n.pctImpostoEmbutido / 100) * fCompras * fForn + d.despesasCredito) * aliq;
  const valor = Math.max(0, debito - credito);
  const parteCbs = n.aliq2027.cbs / (n.aliq2027.cbs + n.aliq2027.ibs);
  return { debito, credito, valor, cbs: valor * parteCbs, ibs: valor * (1 - parteCbs), sobraCredito: Math.max(0, credito - debito) };
}

// ---------- PIS/Cofins de 2026 ----------
// a receita sem a revenda monofásica (alíquota zero na revenda) e sem o ICMS destacado só da parte tributada — o ICMS das
// vendas monofásicas não sai de novo (revisão de 01/11/2026: antes saía o ICMS de todas as vendas)
function baseSaidasPisCofins(d) {
  return Math.max(0, d.atividades.reduce((s, a) => {
    const mono = a.tributo === 'icms' ? a.pctMonofasico / 100 : 0;
    const icms = a.tributo === 'icms' ? a.receita * (1 - a.pctST / 100) * a.aliqIcms / 100 : 0;
    return s + (a.receita - icms) * (1 - mono);
  }, 0));
}
// o IPI a recolher de 2026 (a indústria no Presumido e no Real)
const ipiDe = (d, ano) => ano >= 2027 ? 0 : d.atividades.reduce((s, a) => s + a.receita * (a.aliqIpi || 0) / 100, 0);

// ---------- SIMPLES NACIONAL ----------
// AS FRONTEIRAS PELA RECEITA DO ANO-CALENDÁRIO (revisão de 01/11/2026; antes, pelo RBT12 do mês):
//   · sublimite de R$ 3,6 milhões (LC 123, art. 20, §§1º e 1º-A): a receita do ano passou dele, o ICMS e o ISS saem do
//     DAS no ano seguinte; passou de R$ 4,32 milhões (20% a mais), já a partir do mês seguinte. Enquanto não está
//     impedida, com o RBT12 acima de R$ 3,6 milhões o ICMS e o ISS ficam no DAS pela fórmula da 5ª faixa × a fatia deles
//     na 5ª — o ISS até 5% (as notas dos Anexos da LC 123; Res. CGSN 140, art. 21, IV, que em 2027 junta o IBS);
//   · limite de R$ 4,8 milhões (art. 3º, §§9º e 9º-A): a receita do ano anterior passou dele, fora do Simples no ano todo;
//     no ano, passou de R$ 5,76 milhões (20% a mais), fora a partir do mês seguinte. Até lá, o RBT12 acima de R$ 4,8
//     milhões segue a fórmula da 6ª faixa (a tributação do excesso fica avisada, pra conferir).
const SUBLIMITE_20 = SUBLIMITE * 1.2, LIMITE_20 = LIMITE_SIMPLES * 1.2;
const ANEXOS_ISS = ['III', 'IV', 'V'];
const MESES_NOME = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
// a fatia do IBS no DAS na 5ª faixa em 2027–2028 (Res. CGSN 140, Anexos I a V, na redação da Res. CGSN 190/2026)
const IBS_5A_2027 = { I: 0.17, II: 0.15, III: 0.17, IV: 0.24, V: 0.19 };
// a alíquota efetiva com o RBT12 acima de R$ 4,8 milhões: a fórmula da 6ª faixa
function aliqEfetivaAte6(anexo, rbt12) {
  const a = aliqEfetiva(anexo, rbt12);
  if (a != null) return a;
  const t = TAB_SIMPLES[anexo];
  return t && rbt12 > 0 ? (rbt12 * t.aliq[5] - t.pd[5]) / rbt12 : null;
}
// o ICMS ou o ISS (e, em 2027, o IBS) que fica no DAS na 6ª faixa de quem ainda não está impedido: a fórmula da 5ª × a fatia
function icmsIssPela5a(anexo, rbt12, ano) {
  const t = TAB_SIMPLES[anexo];
  const ae5 = (rbt12 * t.aliq[4] - t.pd[4]) / rbt12;
  const x = ae5 * (FATIA_ICMS_ISS_2027[anexo][4] + (ano >= 2027 ? IBS_5A_2027[anexo] : 0)) / 100;
  return ANEXOS_ISS.includes(anexo) ? Math.min(x, ISS_TETO) : x;
}
const receitaDoAno = (n, k) => { let s = 0; for (let m = 0; m < 12; m++) s += receitaDoMes(n, k, m); return s; };
const indisponivel = (motivo, avisos = []) => ({ disponivel: false, motivo, total: null, itens: [], avisos });

function calcSimples(n, d, k, ano) {
  const avisos = [];
  const r = { das: 0, icmsIssDentro: 0, cppForaIV: 0, icmsFora: 0, issFora: 0, difal: d.difalSimples, porAnexo: {}, fatorR: null, anexosServico: [], faixas: [], impedida: 0, faixa6: 0, alemDoLimite: 0 };
  const anoAnterior = receitaDoAno(n, k - 1);
  if (anoAnterior > LIMITE_SIMPLES) return indisponivel('A receita do ano anterior (' + brl(anoAnterior) + ') passa do limite de ' + brl(LIMITE_SIMPLES) + ': fora do Simples no ano todo (LC 123, art. 3º, §9º).');
  const rFatores = [];
  let acum = 0;
  for (let m = 0; m < 12; m++) {
    if (acum > LIMITE_20) return indisponivel('A receita do ano passa de ' + brl(LIMITE_20) + ' (o limite e mais 20%) até ' + MESES_NOME[m - 1] + ': exclusão do Simples a partir de ' + MESES_NOME[m] + ' (LC 123, art. 3º, §9º-A).');
    const impedida = anoAnterior > SUBLIMITE || acum > SUBLIMITE_20;
    const rbt12 = janela12(n, k, m, ano, receitaDoMes);
    let f = faixaDe(rbt12);
    if (f === -1) { r.alemDoLimite++; f = 5; }
    r.faixas.push(f);
    if (f === 5) r.faixa6++;
    if (impedida) r.impedida++;
    const fs12 = janela12(n, k, m, ano, folhaDoMes);
    const fr = rbt12 > 0 ? fs12 / rbt12 : 0;
    rFatores.push(fr);
    for (const a of d.atividades) {
      const recMes = a.receita * n.pesos[m];
      let anexo = ano >= 2027 ? anexo2027(a.anexo, a.ipiMantido) : a.anexo;
      if (a.fatorR) anexo = fr >= FATOR_R ? 'III' : 'V';
      const aliq = aliqEfetivaAte6(anexo, rbt12);
      // a fatia de PIS+Cofins na revenda monofásica sai só até 2026 (em 2027 a CBS do DAS alcança essa receita —
      // Res. CGSN 140, art. 25, §6º, na redação da Res. 190)
      const mono = ano < 2027 && a.tributo === 'icms' ? a.pctMonofasico / 100 * fatiaPisCofins2026(anexo, f) / 100 : 0;
      // até a 5ª faixa o ICMS ou o ISS está no DAS: sai a fatia do ICMS da revenda com ST — ou a fatia inteira, se a
      // empresa está impedida (aí ele vai pelas regras normais). Na 6ª faixa a tabela já é só dos federais.
      let excl = 0;
      if (f <= 4) {
        const fatia = FATIA_ICMS_ISS_2027[anexo][f] / 100;
        excl = impedida ? fatia : (a.tributo === 'icms' && (anexo === 'I' || anexo === 'II') ? a.pctST / 100 * fatia : 0);
      }
      let das = recMes * aliq * (1 - excl - mono);
      // 6ª faixa sem impedimento: o ICMS ou o ISS no DAS pela fórmula da 5ª (sem o da revenda com ST)
      if (f === 5 && !impedida) {
        const dentro = recMes * icmsIssPela5a(anexo, rbt12, ano) * (a.tributo === 'icms' ? 1 - a.pctST / 100 : 1);
        r.icmsIssDentro += dentro; das += dentro;
      }
      r.das += das;
      r.porAnexo[anexo] = (r.porAnexo[anexo] || 0) + das;
      if (a.tipo !== 'comercio' && a.tipo !== 'industria' && !r.anexosServico.includes(anexo)) r.anexosServico.push(anexo);
    }
    // impedida: o ICMS e o ISS do mês pelas regras normais
    if (impedida) {
      const dMes = { ...d, atividades: d.atividades.map(a => ({ ...a, receita: a.receita * n.pesos[m] })), compras: d.compras * n.pesos[m], creditoIcms: d.creditoIcms != null ? d.creditoIcms * n.pesos[m] : null };
      r.icmsFora += icmsNormal(n, dMes).valor;
      r.issFora += issDe(dMes);
    }
    acum += d.receita * n.pesos[m];
  }
  if (rFatores.length) r.fatorR = rFatores.reduce((s, v) => s + v, 0) / rFatores.length;
  // Anexo IV: a CPP fica fora do DAS (20% + RAT, sem terceiros), proporcional à receita do Anexo IV
  const recIV = d.atividades.filter(a => a.anexo === 'IV' && !a.fatorR).reduce((s, a) => s + a.receita, 0);
  if (recIV > 0) {
    const parte = recIV / d.receita;
    r.cppForaIV = (d.folha * (CPP + n.rat / 100 * n.fap) + d.proLabore * CPP_PRO_LABORE) * parte;
    if (parte < 0.999) avisos.push('A CPP do Anexo IV foi rateada pela receita (' + pct1(parte * 100) + '% da receita é do Anexo IV): certo pra quem trabalha nas duas atividades; quem trabalha só no Anexo IV paga sobre a remuneração inteira.');
  }
  const nm = q => q + (q === 1 ? ' mês' : ' meses');
  if (r.impedida) avisos.push('Impedida de recolher o ICMS e o ISS no Simples em ' + nm(r.impedida) + ' (a receita ' + (anoAnterior > SUBLIMITE ? 'do ano anterior passou' : 'do ano passou de ' + brl(SUBLIMITE_20) + ',') + ' do sublimite de ' + brl(SUBLIMITE) + '): esses tributos foram calculados fora do DAS, pelas regras normais.' + (ano >= 2027 ? ' O IBS de 0,1% também sai do DAS e não entrou na conta.' : ''));
  if (r.faixa6 > r.impedida) avisos.push('RBT12 acima de ' + brl(SUBLIMITE) + ' sem a empresa estar impedida: os federais pela 6ª faixa e o ICMS ou o ISS no DAS pela fórmula da 5ª faixa.' + (ano >= 2027 ? ' A tabela da 6ª faixa de 2027 (Res. CGSN 190: alíquotas 0,1 ponto menores) não está no motor: usada a de 2026.' : ''));
  else if (r.faixa6 && ano >= 2027) avisos.push('A tabela da 6ª faixa de 2027 (Res. CGSN 190: alíquotas 0,1 ponto menores) não está no motor: usada a de 2026.');
  if (r.alemDoLimite) avisos.push('O RBT12 passa de ' + brl(LIMITE_SIMPLES) + ' em ' + nm(r.alemDoLimite) + ' e a empresa segue no Simples até o fim do ano (excesso de até 20%): a conta usou a fórmula da 6ª faixa — confira a tributação do excesso. No ano seguinte, fora do Simples.');
  const itens = [{ tributo: 'DAS', valor: r.das }];
  if (r.cppForaIV) itens.push({ tributo: 'CPP fora do DAS (Anexo IV)', valor: r.cppForaIV });
  if (r.icmsFora) itens.push({ tributo: 'ICMS fora do DAS (sublimite)', valor: r.icmsFora });
  if (r.issFora) itens.push({ tributo: 'ISS fora do DAS (sublimite)', valor: r.issFora });
  if (r.difal) itens.push({ tributo: 'ICMS pago fora do DAS (diferencial e antecipação)', valor: r.difal });
  const total = itens.reduce((s, x) => s + x.valor, 0);
  return { disponivel: true, total, itens, das: r.das, icmsIssDentro: r.icmsIssDentro, porAnexo: r.porAnexo, fatorR: r.fatorR, anexosServico: r.anexosServico, faixaFinal: r.faixas[11], avisos };
}

// ---------- LUCRO PRESUMIDO ----------
// A LC 224 por trimestre (IN RFB 2.305/2025, art. 15, na redação da IN 2.306/2026; revisão de 01/11/2026): o limite de
// R$ 1,25 milhão por trimestre, com a sobra levada adiante; no fim do ano o imposto é refeito pelo limite anual e o que foi
// pago a mais nos trimestres de excesso é deduzido. A conta do ano: o excesso anual fica nos trimestres que pagaram
// excesso, dos primeiros pros últimos. Em 2026 a CSLL majorada começa em abril, com R$ 3,75 milhões contados de lá (P&R
// da RFB, pergunta 13). Antes, o motor acumulava contra R$ 5 milhões e fazia ajuste negativo em qualquer trimestre.
export function excessosLc224(recQs, inicio = 0) {
  const lim = LC224_LIMITE_ANO / 4;
  let sobra = 0;
  const pago = recQs.map((r, q) => {
    if (q < inicio) return 0;
    const l = lim + sobra;
    sobra = Math.max(0, l - r);
    return Math.max(0, r - l);
  });
  let resta = Math.max(0, recQs.slice(inicio).reduce((s, r) => s + r, 0) - lim * (4 - inicio));
  return pago.map(x => { const v = Math.min(x, resta); resta -= v; return v; });
}
function calcPresumido(n, d, k, ano) {
  const avisos = [];
  let irpj = 0, csll = 0, baseIrpjAno = 0, baseCsllAno = 0, extraIrpjAno = 0, extraCsllAno = 0;
  // presunção média ponderada pela receita (a LC 224 divide o excesso pelas atividades na proporção da receita)
  const presI = d.atividades.reduce((s, a) => s + a.receita * a.presIrpj / 100, 0) / d.receita;
  const presC = d.atividades.reduce((s, a) => s + a.receita * a.presCsll / 100, 0) / d.receita;
  const recQs = [0, 1, 2, 3].map(q => d.receita * (n.pesos[3 * q] + n.pesos[3 * q + 1] + n.pesos[3 * q + 2]));
  const exI = n.semLc224 ? [0, 0, 0, 0] : excessosLc224(recQs, 0);
  const exC = n.semLc224 ? [0, 0, 0, 0] : excessosLc224(recQs, ano === 2026 ? 1 : 0);
  for (let q = 0; q < 4; q++) {
    const recQ = recQs[q];
    const extraI = exI[q] * presI * LC224_ACRESCIMO;
    const extraC = exC[q] * presC * LC224_ACRESCIMO;
    const baseI = recQ * presI + extraI;
    const baseC = recQ * presC + extraC;
    baseIrpjAno += baseI; baseCsllAno += baseC; extraIrpjAno += extraI; extraCsllAno += extraC;
    irpj += baseI * IRPJ + Math.max(0, baseI - ADICIONAL_TRIMESTRE) * ADICIONAL;
    csll += baseC * CSLL;
  }
  if (extraIrpjAno > 0.005) avisos.push('Receita acima de ' + brl(LC224_LIMITE_ANO) + ' no ano: presunção 10% maior sobre o excesso (LC 224/2025) — ' + brl(extraIrpjAno) + ' a mais na base do IRPJ e ' + brl(extraCsllAno) + ' na da CSLL. Há liminares individuais e a ADI 7936 no STF; empresa com liminar: desligue na tela.');
  const icms = icmsNormal(n, d);
  const iss = issDe(d);
  const inss = inssRegular(n, d, ano);
  const itens = [{ tributo: 'IRPJ', valor: irpj }, { tributo: 'CSLL', valor: csll }];
  let pis = 0, cofins = 0, cbs = null;
  if (ano < 2027) {
    const base = baseSaidasPisCofins(d);
    pis = base * PIS_CUM; cofins = base * COFINS_CUM;
    itens.push({ tributo: 'PIS', valor: pis }, { tributo: 'Cofins', valor: cofins });
    const ipi = ipiDe(d, ano);
    if (ipi) itens.push({ tributo: 'IPI', valor: ipi });
  } else {
    cbs = cbsIbsRegular(n, d, ano, icms.debito, iss);
    itens.push({ tributo: 'CBS', valor: cbs.cbs }, { tributo: 'IBS', valor: cbs.ibs });
    if (cbs.sobraCredito > 0.005) avisos.push('Crédito de CBS/IBS maior que o débito em ' + brl(cbs.sobraCredito) + ': a sobra fica para compensar ou pedir ressarcimento — fora da conta.');
  }
  if (icms.valor || icms.debito) itens.push({ tributo: 'ICMS', valor: icms.valor });
  if (iss) itens.push({ tributo: 'ISS', valor: iss });
  itens.push({ tributo: 'INSS patronal (CPP, RAT e terceiros)', valor: inss.cpp + inss.rat + inss.terceiros });
  if (inss.proLabore) itens.push({ tributo: 'INSS sobre o pró-labore (20%)', valor: inss.proLabore });
  if (inss.cprb) itens.push({ tributo: 'CPRB (desoneração da folha)', valor: inss.cprb });
  const total = itens.reduce((s, x) => s + x.valor, 0);
  return { disponivel: true, total, itens, irpj, csll, baseIrpj: baseIrpjAno, baseCsll: baseCsllAno, icms, iss, inss, cbs, avisos };
}

// ---------- LUCRO REAL (anual) ----------
// o lucro: a receita menos as compras (o custo das mercadorias, com estoque estável), a folha com os encargos e o FGTS,
// o pró-labore, as despesas e os tributos sobre a receita (que, pela convenção, saem da margem)
export function irpjCsllReal(lucro) {
  const l = Math.max(0, lucro);
  return { irpj: l * IRPJ + Math.max(0, l - ADICIONAL_ANO) * ADICIONAL, csll: l * CSLL };
}
function calcReal(n, d, k, ano) {
  const avisos = [];
  const icms = icmsNormal(n, d);
  const iss = issDe(d);
  const inss = inssRegular(n, d, ano);
  const itens = [];
  let pisCofins = 0, pis = 0, cofins = 0, cbs = null, creditoPisCofins = 0;
  if (ano < 2027) {
    const debito = baseSaidasPisCofins(d) * (PIS_NC + COFINS_NC);
    // crédito: compras (sem a revenda monofásica, que não credita, e sem o ICMS) e as despesas com crédito
    const icmsCompras = icms.debito > 0 ? icms.credito : 0;
    const baseCred = Math.max(0, d.compras * (1 - n.pctComprasMonofasico / 100) - icmsCompras * (1 - n.pctComprasMonofasico / 100)) + d.despesasCredito;
    creditoPisCofins = baseCred * (PIS_NC + COFINS_NC);
    pisCofins = Math.max(0, debito - creditoPisCofins);
    pis = pisCofins * PIS_NC / (PIS_NC + COFINS_NC); cofins = pisCofins - pis;
    if (creditoPisCofins > debito + 0.005) avisos.push('Crédito de PIS/Cofins maior que o débito em ' + brl(creditoPisCofins - debito) + ': a sobra fica para os meses seguintes — fora da conta.');
  } else {
    cbs = cbsIbsRegular(n, d, ano, icms.debito, iss);
    if (cbs.sobraCredito > 0.005) avisos.push('Crédito de CBS/IBS maior que o débito em ' + brl(cbs.sobraCredito) + ': a sobra fica para compensar ou pedir ressarcimento — fora da conta.');
  }
  const ipi = ipiDe(d, ano);
  const tributosReceita = icms.valor + iss + pisCofins + ipi + (cbs ? cbs.valor : 0);
  const lucro = d.receita - d.compras - d.folha * (1 + FGTS) - inss.total - d.proLabore - d.despesasCredito - d.outrasDespesas - tributosReceita;
  const { irpj, csll } = irpjCsllReal(lucro);
  if (lucro < 0) avisos.push('Prejuízo de ' + brl(-lucro) + ' no ano: sem IRPJ e CSLL — o prejuízo compensa até 30% do lucro dos anos seguintes (fora da conta).');
  itens.push({ tributo: 'IRPJ', valor: irpj }, { tributo: 'CSLL', valor: csll });
  if (cbs) itens.push({ tributo: 'CBS', valor: cbs.cbs }, { tributo: 'IBS', valor: cbs.ibs });
  else itens.push({ tributo: 'PIS', valor: pis }, { tributo: 'Cofins', valor: cofins });
  if (ipi) itens.push({ tributo: 'IPI', valor: ipi });
  if (icms.valor || icms.debito) itens.push({ tributo: 'ICMS', valor: icms.valor });
  if (iss) itens.push({ tributo: 'ISS', valor: iss });
  itens.push({ tributo: 'INSS patronal (CPP, RAT e terceiros)', valor: inss.cpp + inss.rat + inss.terceiros });
  if (inss.proLabore) itens.push({ tributo: 'INSS sobre o pró-labore (20%)', valor: inss.proLabore });
  if (inss.cprb) itens.push({ tributo: 'CPRB (desoneração da folha)', valor: inss.cprb });
  const total = itens.reduce((s, x) => s + x.valor, 0);
  return { disponivel: true, total, itens, lucro, irpj, csll, icms, iss, inss, cbs, pisCofins, creditoPisCofins, tributosReceita, outros: total - irpj - csll, avisos };
}

// ---------- um ano ----------
export function calcularAno(entrada, ano, k = null) {
  const n = entrada && entrada.atividades && entrada.pesos ? entrada : normalizar(entrada);
  if (!ANOS.includes(ano)) throw new Error('Ano fora do que o motor calcula (' + ANOS.join(', ') + ').');
  const kk = k != null ? k : ano - n.anoBase;
  if (kk < 0) throw new Error('O ano ' + ano + ' é anterior à base (' + n.anoBase + ').');
  const d = dadosDoAno(n, kk);
  const simples = calcSimples(n, d, kk, ano);
  const presumido = calcPresumido(n, d, kk, ano);
  const real = calcReal(n, d, kk, ano);
  const res = { ano, k: kk, receita: d.receita, simples, presumido, real };
  const comTotal = REGIMES.filter(r => res[r].disponivel && res[r].total != null);
  comTotal.forEach(r => { res[r].aliquota = d.receita > 0 ? res[r].total / d.receita : null; });
  res.ordem = comTotal.slice().sort((a, b) => res[a].total - res[b].total);
  res.melhor = res.ordem[0] || null;
  return res;
}

// ---------- o comparativo: a base e as projeções ----------
// anos: os anos a calcular (padrão: do ano da base a 2028); anoDecisao: o ano da escolha (padrão: 2027, ou o primeiro
// depois da base)
export function comparar(entrada, opcoes = {}) {
  const n = normalizar(entrada);
  const anos = (opcoes.anos || ANOS.filter(a => a >= n.anoBase)).filter(a => ANOS.includes(a) && a >= n.anoBase);
  const resultados = anos.map(a => calcularAno(n, a));
  const anoDecisao = opcoes.anoDecisao && anos.includes(opcoes.anoDecisao) ? opcoes.anoDecisao : (anos.find(a => a > n.anoBase) || anos[0]);
  const rd = resultados.find(r => r.ano === anoDecisao);
  const decisao = resumoDaDecisao(n, rd);
  const avisos = [];
  // folha zerada com serviço do fator r: o Anexo V é certo, e o "Anexo III" depende de folha
  if (n.atividades.some(a => a.fatorR) && !(n.folha + n.proLabore > 0)) avisos.push('Sem folha nem pró-labore informados, o serviço do fator r fica no Anexo V. Informe a folha dos últimos 12 meses.');
  if (n.atividades.some(a => a.tipo === 'industria')) avisos.push('Indústria: em 2026 o IPI do Presumido e do Real é o informado na atividade (no Simples ele está no DAS); em 2027 vira zero, salvo produto com industrialização incentivada na Zona Franca de Manaus. Em 2027 a indústria do Simples passa ao Anexo I (LC 123, art. 18, §5º, na redação da LC 214).');
  if (n.anoBase < 2027 && n.atividades.some(a => a.tributo === 'icms' && a.pctST > 0)) avisos.push('O ICMS-ST pago na compra pode sair da base do PIS/Cofins de quem revende (STJ, Tema 1125, aceito pela PGFN): fora da conta — o PIS/Cofins de 2026 do Presumido e do Real com ST fica um pouco maior.');
  if (n.cprb) avisos.push('Desoneração da folha: na transição, a CPP reduzida vale pro pró-labore também, e o 13º fica só na CPRB (Lei 12.546, art. 9º-A, na redação da Lei 14.973) — o 13º foi estimado em 1/13,33 da folha.');
  if (!(n.outrasDespesas > 0)) avisos.push('Sem as outras despesas (aluguel, sistemas, contador, manutenção…), o lucro do Real sai maior que o de verdade e o Real, mais caro. Informe o resto dos custos do ano.');
  return { entrada: n, anos: resultados, anoDecisao, decisao, avisos };
}

// o resumo do ano da decisão: o mais barato, a distância pro segundo e pro regime de hoje, e o lucro em que o Real empata
export function resumoDaDecisao(n, r) {
  if (!r || !r.melhor) return null;
  const [melhor, segundo] = r.ordem;
  const dif = segundo ? r[segundo].total - r[melhor].total : null;
  const out = {
    ano: r.ano, melhor, segundo: segundo || null,
    diferenca: dif, pctReceita: dif != null && r.receita > 0 ? dif / r.receita : null,
    regimeAtual: n.regimeAtual,
    economiaVsAtual: n.regimeAtual && n.regimeAtual !== melhor && r[n.regimeAtual].disponivel ? r[n.regimeAtual].total - r[melhor].total : null
  };
  // o lucro em que o Real empata com o Presumido e com o Simples: os outros tributos do Real não dependem do lucro, e o
  // IRPJ + CSLL é 24% do lucro até R$ 240 mil e 34% − R$ 24 mil acima (a conta inversa de irpjCsllReal)
  const lucroDeEmpate = alvo => {
    const folga = alvo - r.real.outros;
    if (!(folga > 0)) return 0;   // nem com lucro zero o Real empata
    const l = folga / (IRPJ + CSLL);
    return l <= ADICIONAL_ANO ? l : (folga + ADICIONAL_ANO * ADICIONAL) / (IRPJ + CSLL + ADICIONAL);
  };
  out.real = { lucro: r.real.lucro, margem: r.receita > 0 ? r.real.lucro / r.receita : null, empate: {} };
  ['presumido', 'simples'].forEach(reg => {
    if (!r[reg].disponivel) return;
    const l = lucroDeEmpate(r[reg].total);
    out.real.empate[reg] = { lucro: l, margem: r.receita > 0 ? l / r.receita : null, nunca: l === 0 };
  });
  return out;
}

// ---------- premissas que mudam o resultado ----------
// testes: [{ campo: 'aliqCreditoIcms' | 'atividades.0.aliqIss' | …, valores: [a, b], rotulo }] — refaz o ano da decisão
// com cada valor e diz em quais o regime mais barato troca
function comValor(entrada, campo, valor) {
  const e = JSON.parse(JSON.stringify(entrada));
  const partes = campo.split('.');
  let o = e;
  for (let i = 0; i < partes.length - 1; i++) {
    const p = partes[i];
    if (o[p] == null) o[p] = /^\d+$/.test(partes[i + 1]) ? [] : {};
    o = o[p];
  }
  o[partes[partes.length - 1]] = valor;
  return e;
}
export function testarPremissas(entrada, testes, opcoes = {}) {
  const base = comparar(entrada, opcoes);
  const ano = base.anoDecisao;
  const melhor = base.decisao && base.decisao.melhor;
  return (testes || []).map(t => {
    const variantes = (t.valores || []).map(v => {
      const r = calcularAno(normalizar(comValor(entrada, t.campo, v)), ano);
      return { valor: v, melhor: r.melhor, totais: Object.fromEntries(REGIMES.map(g => [g, r[g].disponivel ? r[g].total : null])) };
    });
    return { ...t, ano, melhorBase: melhor, variantes, muda: variantes.some(v => v.melhor !== melhor) };
  });
}

// a frase do ano da decisão, pra tela e pro resumo gravado
export function fraseDaDecisao(c) {
  const d = c && c.decisao;
  if (!d) return '';
  const r = c.anos.find(x => x.ano === d.ano);
  let f = 'Em ' + d.ano + ', o ' + ROTULO_REGIME[d.melhor] + ' sai mais barato: ' + brl(r[d.melhor].total) + ' de tributos (' + pct1(r[d.melhor].aliquota * 100) + '% da receita)';
  if (d.segundo) f += ', ' + brl(d.diferenca) + ' a menos que o ' + ROTULO_REGIME[d.segundo] + ' (' + pct1(d.pctReceita * 100) + '% da receita)';
  f += '.';
  if (d.regimeAtual && d.regimeAtual !== d.melhor && d.economiaVsAtual != null) f += ' Contra o regime de hoje (' + ROTULO_REGIME[d.regimeAtual] + '), a diferença é de ' + brl(d.economiaVsAtual) + ' no ano.';
  if (d.regimeAtual === d.melhor) f += ' É o regime de hoje.';
  return f;
}
