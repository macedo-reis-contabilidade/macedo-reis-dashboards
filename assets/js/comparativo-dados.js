// ============================================================
// MACEDO & REIS — Comparativo tributário: os números que o sistema já tem
// Módulo ES puro, sem DOM: monta a entrada do motor (comparativo-motor.js) com o que o sistema sabe da empresa —
// o cadastro, o caso da Reforma (os relatórios do Domínio e as notas que já foram lidos lá), o Fator R, o PGDAS que a
// ponte da Receita traz e os relatórios do Domínio soltos na tela — e diz de onde veio cada número (`origens`), como a
// procedência da Reforma: o que não veio de lugar nenhum é "padrão — confira". Testado por
// tests/comparativo-dados.test.mjs.
// ============================================================

import { TIPOS } from './comparativo-motor.js';
import { digitosCnae } from './dominio-relatorios.js';

const num = (v, def = 0) => { if (v == null || v === '') return def; const n = Number(v); return Number.isFinite(n) ? n : def; };
const MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const rotuloComp = c => c ? MES_CURTO[Number(String(c).slice(5, 7)) - 1] + '/' + String(c).slice(2, 4) : '';
const brl = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct1 = v => (Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 });

// ---------- de onde veio ----------
export const FONTES = {
  reforma: 'caso da Reforma',
  dominio: 'relatório do Domínio',
  fator_r: 'Fator R',
  pgdas: 'PGDAS (Receita)',
  cadastro: 'cadastro',
  padrao: 'padrão — confira',
  digitado: 'digitado',
  confirmado: 'conferido',
  gravado: 'estudo gravado'
};
// as fontes que vieram de um registro da empresa (o verde da tela)
export const DO_SISTEMA = ['reforma', 'dominio', 'fator_r', 'pgdas', 'cadastro'];
// texto: o que fica à vista, curto; dica: a explicação, ao passar o mouse
const origem = (fonte, texto, dica) => dica ? { fonte, texto: texto || FONTES[fonte], dica } : { fonte, texto: texto || FONTES[fonte] };

// ---------- o regime e a atividade ----------
export function regimeDoCadastro(r) {
  const t = String(r || '').toLowerCase();
  if (t.includes('simples')) return 'simples';
  if (t.includes('presumido')) return 'presumido';
  if (t.includes('real')) return 'real';
  if (t.includes('mei')) return 'mei';
  return t ? 'outro' : null;
}
const POR_ANEXO = { I: 'comercio', II: 'industria', III: 'servico', IV: 'servico_iv', V: 'servico_r' };
export const tipoPeloAnexo = anexo => POR_ANEXO[String(anexo || '').trim().toUpperCase()] || null;
// pelo CNAE principal, só o grosso — o anexo certo depende da atividade de cada receita (LC 123, art. 18, §§4º a 5º-I):
// comércio (divisões 45 a 47), indústria (05 a 33), construção (41 a 43, Anexo IV), advocacia (6911, Anexo IV),
// contabilidade (6920, Anexo III) e as atividades intelectuais do fator r (TI, consultoria, engenharia e arquitetura,
// pesquisa, publicidade, saúde e veterinária — Anexo V ou III pelo fator r); o resto, Anexo III
const FATOR_R_DIVISOES = ['62', '63', '70', '71', '72', '73', '75', '86'];
export function tipoPeloCnae(cnae) {
  const d = digitosCnae(cnae);
  if (d.length < 4) return null;
  const div = d.slice(0, 2), cl = d.slice(0, 4);
  const n = Number(div);
  // a venda da produção rural própria, sem industrialização, vai com o comércio (Anexo I, presunção de 8%, ICMS)
  if ((n >= 45 && n <= 47) || (n >= 1 && n <= 3)) return 'comercio';
  if (n >= 5 && n <= 33) return 'industria';
  if (n >= 41 && n <= 43) return 'servico_iv';
  if (cl === '6911') return 'servico_iv';
  if (cl === '6920') return 'servico';
  if (FATOR_R_DIVISOES.includes(div)) return 'servico_r';
  return 'servico';
}

// ---------- a refeição no RS ----------
// Receita Estadual do RS ("bares e restaurantes", regime geral fora do RDA e Simples): a refeição feita no estabelecimento,
// pronta pra consumo e vendida direto ao consumidor paga 12% (RICMS-RS, Livro I, art. 27, V, e Apêndice I, Seção II, item
// XII), com a opção da base reduzida a 60% (art. 23, VI) e o crédito das compras na mesma proporção (art. 33, IV) — ou do
// crédito presumido (art. 32, IV), fora da conta; no Simples, a mesma base reduzida na receita de refeição, no DAS (LC 123,
// art. 18, §20). Vale pros bares e restaurantes (5611-2/02 é o código antigo dos bares) e pro CNAE 5620-1/04 (preparo pra
// consumo domiciliar). Bebida revendida e o que não é refeição têm a alíquota deles. Conferido nas orientações da Receita
// Estadual por um agente separado em 01/11/2026 (o texto do RICMS não abriu). As refeições coletivas pra empresas
// (5620-1/01) e as cantinas (5620-1/03) podem ter a base a 60% (o art. 23, VI fala em "empresas preparadoras de refeições
// coletivas"), mas a alíquota de 12% não está confirmada pra elas: ficam com uma nota pra conferir.
// O RDA dos bares e restaurantes (art. 38-A; o motor, RDA_RS) é só do grupo 56.1 da CNAE, no Presumido e no Real.
const CNAE_REFEICAO_RS = ['5611201', '5611202', '5611203', '5611204', '5611205', '5620104'];
const CNAE_REFEICAO_A_CONFERIR = { '5620101': 'refeições pra empresas', '5620103': 'cantina' };
export const ALIQ_REFEICAO_RS = 12, RED_REFEICAO_RS = 40;
const ehRS = uf => !uf || String(uf).trim().toUpperCase() === 'RS';
export const ehRefeicaoRS = (cnae, uf) => CNAE_REFEICAO_RS.includes(digitosCnae(cnae).slice(0, 7)) && ehRS(uf);
export const ehRdaRS = (cnae, uf) => digitosCnae(cnae).startsWith('561') && ehRS(uf);

// o que o PGDAS lido na Reforma mostrou: a redução do ICMS (o "percentual de redução") e a revenda com ST. O caso guarda o
// resumo (`dominio.pgdas`) e, nos montados à mão, os textos de `fontes` — lidos aqui só no que está escrito.
const numBR = t => num(String(t || '').replace(/\./g, '').replace(',', '.'));
function doPgdasDoCaso(sim) {
  const pg = (sim && sim.dominio && sim.dominio.pgdas) || {};
  const fontes = (sim && sim.fontes) || {};
  const inp = (sim && sim.input) || {};
  let red = num(pg.reducaoIcms) > 0 ? num(pg.reducaoIcms) : null;
  if (red == null) {
    for (const t of Object.values(fontes)) {
      const m = /redu[çc][ãa]o de ([\d.,]+)\s*% na base do ICMS/i.exec(String(t || ''));
      if (m && numBR(m[1]) > 0) { red = numBR(m[1]); break; }
    }
  }
  let st = num(pg.pctST) > 0 ? num(pg.pctST) : null;
  if (st == null && /revenda com ST/i.test(String(fontes.mixCheia || '')) && num(inp.mixCheia) > 0 && num(inp.mixCheia) < 100) st = num(inp.mixCheia);
  return { red, st, competencia: pg.competencia || null };
}
const lerSim = caso => { try { return caso && caso.sim_obs ? (typeof caso.sim_obs === 'string' ? JSON.parse(caso.sim_obs) : caso.sim_obs) : null; } catch (e) { return null; } };

// ---------- a receita de 12 meses ----------
// meses: [{ competencia 'AAAA-MM', saidas?, servicos?, total }] — os 12 últimos com receita; com menos de 12, anualiza.
// O motor lê os 12 meses na ordem do calendário (jan a dez: os trimestres do Presumido e o limite da LC 224), então
// cada mês vai pro lugar do seu mês.
export function serieDosMeses(meses) {
  const ult = (meses || []).filter(m => m && /^\d{4}-\d{2}$/.test(m.competencia) && num(m.total) > 0)
    .sort((a, b) => a.competencia < b.competencia ? -1 : 1).slice(-12);
  if (!ult.length) return null;
  const n = ult.length, fator = 12 / n;
  const soma = k => ult.reduce((s, m) => s + num(m[k]), 0);
  const total = soma('total'), saidas = soma('saidas'), servicos = soma('servicos');
  let calendario = null;
  if (n === 12) {
    calendario = Array(12).fill(0);
    ult.forEach(m => { calendario[Number(m.competencia.slice(5, 7)) - 1] += num(m.total); });
  }
  return { n, de: ult[0].competencia, ate: ult[n - 1].competencia, receita: total * fator, mercadorias: saidas * fator, servicos: servicos * fator, meses: calendario };
}
const periodo = s => s.n === 12 ? rotuloComp(s.de) + ' a ' + rotuloComp(s.ate) : rotuloComp(s.de) + ' a ' + rotuloComp(s.ate) + ' (' + s.n + (s.n === 1 ? ' mês' : ' meses') + ', anualizado)';

// as linhas de receita a partir do total e da divisão mercadoria × serviço
function linhas(receita, mercadorias, servicos, tipoMerc, tipoServ) {
  const out = [];
  const totalSplit = mercadorias + servicos;
  if (totalSplit > 0) {
    if (mercadorias > 0.005) out.push({ tipo: tipoMerc, receita: receita * mercadorias / totalSplit });
    if (servicos > 0.005) out.push({ tipo: tipoServ, receita: receita * servicos / totalSplit });
  }
  if (!out.length) out.push({ tipo: tipoMerc, receita });
  return out;
}

// ---------- o que o sistema sabe ----------
// cliente: a linha do cadastro · caso: a linha de rt_casos (com sim_obs) · fatorR: lançamentos do Fator R
// [{ competencia 'AAAA-MM-DD', folha_salarios, folha_outros, prolabore }] · pgdas: receita_pgdas [{ competencia, receita_mes }]
export function entradaDoSistema({ cliente = null, caso = null, fatorR = [], pgdas = [] } = {}) {
  const origens = {}, notas = [];
  const sim = lerSim(caso);
  const inp = (sim && sim.input) || {};
  const dom = (sim && sim.dominio) || {};

  // o tipo da atividade: o anexo do PGDAS (o da Reforma) vale sobre o CNAE
  const anexoPgdas = inp.anexo || (caso && caso.anexo) || null;
  const tipoAnexo = tipoPeloAnexo(anexoPgdas);
  const tipoCnae = tipoPeloCnae(cliente && cliente.cnae_principal);
  let tipoMerc = 'comercio', tipoServ = 'servico';
  if (tipoAnexo) {
    if (tipoAnexo === 'comercio' || tipoAnexo === 'industria') tipoMerc = tipoAnexo; else tipoServ = tipoAnexo;
  }
  if (tipoCnae) {
    if ((tipoCnae === 'comercio' || tipoCnae === 'industria') && !(tipoAnexo === 'comercio' || tipoAnexo === 'industria')) tipoMerc = tipoCnae;
    if (!(tipoCnae === 'comercio' || tipoCnae === 'industria') && !tipoAnexo) tipoServ = tipoCnae;
  }

  // a receita: o PGDAS da Receita (o declarado), o faturamento do caso da Reforma ou a receita mensal dele
  const sPgdas = serieDosMeses((pgdas || []).map(p => ({ competencia: p.competencia, total: p.receita_mes })));
  const sDom = serieDosMeses(dom.meses || (dom.vendas && dom.vendas.meses) || []);
  let receita = 0, merc = 0, serv = 0, meses = null, textoRec = null, fonteRec = 'padrao';
  if (sDom) { receita = sDom.receita; merc = sDom.mercadorias; serv = sDom.servicos; meses = sDom.meses; fonteRec = 'reforma'; textoRec = 'caso da Reforma: faturamento do Domínio de ' + periodo(sDom); }
  if (sPgdas) {
    receita = sPgdas.receita; meses = sPgdas.meses; fonteRec = 'pgdas'; textoRec = 'PGDAS na Receita, de ' + periodo(sPgdas) + (sDom ? ' (a divisão mercadoria × serviço é a do faturamento do Domínio)' : '');
  }
  if (!receita && num(inp.receita) > 0) { receita = num(inp.receita) * 12; fonteRec = 'reforma'; textoRec = 'caso da Reforma: receita mensal de ' + brl(num(inp.receita)) + ' × 12'; }
  if (!receita && caso && num(caso.receita_mensal) > 0) { receita = num(caso.receita_mensal) * 12; fonteRec = 'reforma'; textoRec = 'caso da Reforma: receita mensal × 12'; }
  // sem divisão medida, o anexo (ou o CNAE) diz se é mercadoria ou serviço
  if (!(merc + serv > 0)) {
    const ehMerc = tipoAnexo ? (tipoAnexo === 'comercio' || tipoAnexo === 'industria') : !tipoCnae || tipoCnae === 'comercio' || tipoCnae === 'industria';
    if (ehMerc) merc = 1; else serv = 1;
  }
  const atividades = linhas(receita, merc, serv, tipoMerc, tipoServ);
  atividades.forEach((a, i) => {
    origens['atividades.' + i + '.tipo'] = tipoAnexo && (a.tipo === tipoAnexo) ? origem('reforma', 'Anexo ' + anexoPgdas + ' do PGDAS (caso da Reforma)') : tipoCnae && a.tipo === tipoCnae ? origem('cadastro', 'pelo CNAE do cadastro (' + (cliente && cliente.cnae_principal || '') + ') — confira o anexo') : origem('padrao');
    origens['atividades.' + i + '.receita'] = receita > 0 ? origem(fonteRec, textoRec) : origem('padrao', 'falta no sistema: digite os 12 meses');
  });
  // ST e monofásico (só nas mercadorias): ST das saídas do Domínio, monofásico do PGDAS (caso da Reforma)
  const iMerc = atividades.findIndex(a => TIPOS[a.tipo].tributo === 'icms');
  let refeicao = false;
  if (iMerc >= 0) {
    const p = 'atividades.' + iMerc;
    const v = dom.vendas || null;
    const doPg = doPgdasDoCaso(sim);
    const quando = doPg.competencia ? 'PGDAS de ' + rotuloComp(doPg.competencia) : 'PGDAS';
    if (v && num(v.mercadorias) > 0 && v.st != null) {
      atividades[iMerc].pctST = Math.min(100, num(v.st) / num(v.mercadorias) * 100);
      origens[p + '.pctST'] = origem('reforma', 'caso da Reforma: vendas com ST (CFOP x401 a x405) nas saídas do Domínio, ' + brl(v.st) + ' de ' + brl(v.mercadorias));
    } else if (doPg.st > 0) {
      atividades[iMerc].pctST = doPg.st;
      origens[p + '.pctST'] = origem('reforma', quando + ' (caso da Reforma): revenda com ST, ' + pct1(doPg.st) + '% da receita', 'a seção do PGDAS sem ICMS: o ICMS já foi pago por substituição na compra');
    }
    if (num(inp.pctReceitaMonofasica) > 0) {
      atividades[iMerc].pctMonofasico = num(inp.pctReceitaMonofasica);
      origens[p + '.pctMonofasico'] = origem('reforma', 'caso da Reforma: receita monofásica de PIS/Cofins');
    }
    refeicao = ehRefeicaoRS(cliente && cliente.cnae_principal, cliente && cliente.uf);
    if (refeicao) {
      Object.assign(atividades[iMerc], { aliqIcms: ALIQ_REFEICAO_RS, redIcms: RED_REFEICAO_RS, redIcmsSimples: RED_REFEICAO_RS });
      origens[p + '.aliqIcms'] = origem('padrao', 'refeição no RS: 12% — confira', 'RICMS-RS, Livro I, art. 27, V: a refeição feita na casa e vendida pronta ao consumidor; bebida e outras revendas têm a alíquota delas');
      origens[p + '.redIcms'] = origem('padrao', 'base a 60% — confira a opção da empresa', 'RICMS-RS, Livro I, art. 23, VI, com o crédito das compras na mesma proporção (art. 33, IV). A outra opção, o crédito presumido (art. 32, IV), fica fora da conta; sem redução nenhuma, digite 0');
      origens[p + '.redIcmsSimples'] = origem('padrao', '40% — confira no PGDAS', 'a base reduzida a 60% também vale no DAS, na receita de refeição (Receita Estadual do RS; RICMS-RS, Livro I, art. 23, VI, nota do Simples); no PGDAS é o "percentual de redução". Abaixo de R$ 360 mil em 12 meses, o Simples Gaúcho isenta o ICMS do DAS, e a redução fica sem efeito');
    } else {
      const conferir = cliente && ehRS(cliente.uf) ? CNAE_REFEICAO_A_CONFERIR[digitosCnae(cliente.cnae_principal).slice(0, 7)] : null;
      if (conferir) notas.push('CNAE de ' + conferir + ': no RS a base do ICMS pode ser reduzida a 60% (RICMS-RS, Livro I, art. 23, VI, que fala em "empresas preparadoras de refeições coletivas"), mas a alíquota de 12% da refeição não está confirmada pro caso. A conta usou 17% sem redução: confira e preencha a alíquota e as reduções.');
      origens[p + '.aliqIcms'] = origem('padrao', 'padrão: 17%, a interna do RS', 'venda pra outro estado é 12% (7% ou 4% em alguns casos) — confira');
    }
    if (doPg.red > 0) {
      atividades[iMerc].redIcmsSimples = doPg.red;
      origens[p + '.redIcmsSimples'] = origem('reforma', quando + ' (caso da Reforma): ' + pct1(doPg.red) + '% de redução', 'o "percentual de redução" do ICMS que a empresa declara no PGDAS');
      if (!refeicao) notas.push('O ' + quando + ' tem ' + pct1(doPg.red) + '% de redução do ICMS no DAS. No regime geral, a redução depende do benefício que a dá: se ele valer lá também, preencha a redução da base do ICMS no regime geral.');
    }
  }
  atividades.forEach((a, i) => { if (TIPOS[a.tipo].tributo === 'iss') origens['atividades.' + i + '.aliqIss'] = origem('padrao', 'padrão: 3% — confira', 'a alíquota do ISS da atividade no município'); });
  atividades.forEach((a, i) => { if (a.tipo === 'industria') origens['atividades.' + i + '.aliqIpi'] = origem('padrao', 'padrão: zero — confira', 'o IPI a recolher no ano, em % da receita da indústria, já com os créditos; só 2026 — em 2027 ele vira zero'); });

  const e = { atividades, meses };
  if (cliente && cliente.uf) e.uf = String(cliente.uf).trim().toUpperCase();
  // o RDA dos bares e restaurantes (Presumido e Real): a conta usa o mais barato entre ele e o débito e crédito
  if (iMerc >= 0 && ehRdaRS(cliente && cliente.cnae_principal, cliente && cliente.uf)) {
    e.rda = 'melhor';
    origens.rda = origem('padrao', 'RDA: a conta usa o mais barato — confira', 'RICMS-RS, Livro I, art. 38-A (Dec. 55.458/2020; o Dec. 57.930/2024 o estendeu até 2028): 3,5% de todas as vendas de mercadoria, as com ST também, sem crédito, no Presumido e no Real. Exige a alimentação em 60% ou mais das vendas do ano anterior e nenhuma dívida ativa');
  } else if (refeicao) {
    // a refeição fora do grupo 56.1 (o 5620-1/04, a pizzaria de entrega): sem o RDA, e a tela diz por quê
    origens.rda = origem('cadastro', 'fora do RDA: o CNAE ' + (cliente.cnae_principal || '') + ' não é do grupo 56.1', 'o RDA dos bares e restaurantes (3,5% das vendas, sem crédito) é só pra CNAE do grupo 56.1 (RICMS-RS, Livro I, art. 38-A); com o CNAE principal de restaurante, ele vira opção');
  }
  // compras e despesas: o % da receita medido no caso da Reforma (entradas do Domínio ÷ receita dos mesmos meses)
  if (receita > 0 && inp.pctComprasMercadorias != null && inp.pctComprasMercadorias !== '') {
    e.compras = num(inp.pctComprasMercadorias) / 100 * receita;
    origens.compras = origem('reforma', 'caso da Reforma: compras de mercadorias e insumos = ' + pct1(inp.pctComprasMercadorias) + '% da receita');
  }
  if (receita > 0 && num(inp.pctComprasDespesas) > 0) {
    e.despesasCredito = num(inp.pctComprasDespesas) / 100 * receita;
    origens.despesasCredito = origem('reforma', 'caso da Reforma: energia, frete, ativo e consumo = ' + pct1(inp.pctComprasDespesas) + '% da receita');
  }
  if (num(inp.pctImpostoEmbutido) > 0) { e.pctImpostoEmbutido = num(inp.pctImpostoEmbutido); origens.pctImpostoEmbutido = origem('reforma', 'caso da Reforma: imposto embutido nas compras'); }
  if (inp.pctComprasComCredito != null && inp.pctComprasComCredito !== '') { e.pctComprasComCredito = num(inp.pctComprasComCredito); origens.pctComprasComCredito = origem('reforma', 'caso da Reforma: compras com crédito pelo NCM das notas'); }
  if (['mixCheia', 'mixRed60', 'mixRed40', 'mixRed30', 'mixZero'].some(k => inp[k] != null)) {
    e.mix = { cheia: num(inp.mixCheia), red60: num(inp.mixRed60), red40: num(inp.mixRed40), red30: num(inp.mixRed30), zero: num(inp.mixZero) };
    const soma = e.mix.cheia + e.mix.red60 + e.mix.red40 + e.mix.red30 + e.mix.zero;
    if (Math.abs(soma - 100) > 0.5) { delete e.mix; } else origens.mix = origem('reforma', 'caso da Reforma: alíquotas da Reforma nas vendas');
  }
  if (!origens.compras) origens.compras = origem('padrao', 'falta no sistema', 'solte o acompanhamento de entradas do Domínio ou digite as compras dos 12 meses');
  origens.aliqCreditoIcms = origem('padrao', 'padrão: 12% — confira', 'fornecedor do RS no regime normal dá 17%, de outro estado 12%, do Simples bem menos');
  origens.outrasDespesas = origem('padrao', 'falta no sistema: fazem o lucro do Real', 'aluguel de pessoa física, sistemas, contador, manutenção — o resto dos custos do ano, sem compras nem folha');

  // a folha: o Fator R (os últimos 12 meses lançados), senão em branco
  const fr = (fatorR || []).filter(l => l && l.competencia).sort((a, b) => a.competencia < b.competencia ? 1 : -1).slice(0, 12);
  if (fr.length) {
    const f = 12 / fr.length;
    e.folha = fr.reduce((s, l) => s + num(l.folha_salarios) + num(l.folha_outros), 0) * f;
    e.proLabore = fr.reduce((s, l) => s + num(l.prolabore), 0) * f;
    const per = rotuloComp(fr[fr.length - 1].competencia.slice(0, 7)) + ' a ' + rotuloComp(fr[0].competencia.slice(0, 7)) + (fr.length < 12 ? ', anualizado' : '');
    origens.folha = origem('fator_r', 'Fator R: salários, 13º e outros de ' + per);
    origens.proLabore = origem('fator_r', 'Fator R: pró-labore de ' + per);
  } else {
    origens.folha = origem('padrao', 'falta no sistema: digite', 'os salários dos 12 meses, com 13º e férias');
    origens.proLabore = origem('padrao', 'falta no sistema: digite');
    notas.push('A folha e o pró-labore não estão no sistema: sem eles, o INSS do Presumido e do Real sai zero e o serviço do fator r fica no Anexo V.');
  }
  origens.rat = origem('padrao', 'padrão: 2% e FAP 1', 'o RAT vai de 1% a 3% pelo CNAE');
  origens.terceiros = origem('padrao', 'padrão: 5,8%', 'o de terceiros da maioria dos FPAS');

  e.regimeAtual = cliente ? ['simples', 'presumido', 'real'].includes(regimeDoCadastro(cliente.regime_tributario)) ? regimeDoCadastro(cliente.regime_tributario) : null : null;
  if (cliente && regimeDoCadastro(cliente.regime_tributario) === 'mei') notas.push('A empresa é MEI hoje: o comparativo é pra quando ela passar do limite do MEI (Simples como ME × Presumido × Real).');
  if (tipoAnexo === 'servico' && fr.length) notas.push('Serviço no Anexo III no PGDAS: se a atividade é do fator r (vai pro Anexo V quando a folha não chega a 28% da receita), troque o tipo pra "Serviços do fator r".');
  // a conferência do Simples: a alíquota efetiva do último PGDAS lido na Reforma
  const pg = dom.pgdas || null;
  const conferencia = pg && num(pg.aliquotaEfetiva) > 0 ? { competencia: pg.competencia, aliquota: num(pg.aliquotaEfetiva), das: num(pg.dasTotal), fonte: 'reforma' } : null;
  const sd = serieDaEmpresa({ caso, pgdas });
  return { entrada: e, origens, notas, conferencia, serie: sd ? sd.serie : null };
}

// junta duas séries datadas ([{ competencia 'AAAA-MM', total }]) — a de b vale no mês que as duas têm —, em ordem. É o que a
// tela faz com o faturamento solto nela: os meses do relatório entram na série do sistema (o ano do limite, o crescimento
// medido e o "até quando" de cada fase passam a contar com eles), e a parte do relatório fica gravada no estudo (serieRel)
export function mesclarSerie(a, b) {
  const m = new Map();
  [...(a || []), ...(b || [])].forEach(x => { if (x && /^\d{4}-\d{2}$/.test(x.competencia) && num(x.total) > 0) m.set(x.competencia, { competencia: x.competencia, total: num(x.total) }); });
  const l = [...m.values()].sort((x, y) => (x.competencia < y.competencia ? -1 : 1));
  return l.length ? l : null;
}

// ---------- as outras empresas dos mesmos sócios ----------
// a série datada da receita: o PGDAS da Receita (o declarado) ou o faturamento do caso da Reforma — [{ competencia, total }]
export function serieDaEmpresa({ caso = null, pgdas = [] } = {}) {
  const ok = m => m && /^\d{4}-\d{2}$/.test(m.competencia) && num(m.total) > 0;
  const ordem = l => l.sort((a, b) => a.competencia < b.competencia ? -1 : 1);
  const pg = ordem((pgdas || []).map(p => ({ competencia: p && p.competencia, total: num(p && p.receita_mes) })).filter(ok));
  if (pg.length) return { fonte: 'pgdas', serie: pg };
  const sim = lerSim(caso), dom = (sim && sim.dominio) || {};
  const ms = ordem((dom.meses || (dom.vendas && dom.vendas.meses) || []).map(m => ({ competencia: m && m.competencia, total: num(m && m.total) })).filter(ok));
  return ms.length ? { fonte: 'reforma', serie: ms } : null;
}
// a receita de 12 meses de uma empresa do grupo, como o motor lê ({ nome, receita, meses }), com a série e a origem
export function receitaDaEmpresa({ cliente = null, caso = null, pgdas = [] } = {}) {
  const nome = cliente ? (cliente.nome_principal || cliente.nome_fantasia || 'outra empresa') + (cliente.nome_fantasia && cliente.nome_principal && cliente.nome_fantasia !== cliente.nome_principal ? ' (' + cliente.nome_fantasia + ')' : '') : 'outra empresa';
  const sd = serieDaEmpresa({ caso, pgdas });
  const s = sd ? serieDosMeses(sd.serie) : null;
  if (s) return { nome, cliente_id: cliente ? cliente.id : null, receita: s.receita, meses: s.meses, serie: sd.serie,
    origem: origem(sd.fonte, (sd.fonte === 'pgdas' ? 'PGDAS na Receita, de ' : 'caso da Reforma: faturamento do Domínio de ') + periodo(s)) };
  if (caso && num(caso.receita_mensal) > 0) return { nome, cliente_id: cliente ? cliente.id : null, receita: num(caso.receita_mensal) * 12, meses: null, serie: null,
    origem: origem('reforma', 'caso da Reforma: receita mensal × 12') };
  return { nome, cliente_id: cliente ? cliente.id : null, receita: 0, meses: null, serie: null, origem: origem('padrao', 'falta no sistema: digite os 12 meses') };
}
// quem é sócio desta e de outra: socios (desta) e outros ([{ cliente_id, nome, cpf, participacao_percentual?,
// eh_administrador? }], das outras) — casa pelo CPF (só os dígitos); sem o CPF de um dos lados, pelo nome sem acento.
// Volta [{ cliente_id, socios: [nomes], participacao, administrador }], sem esta — participacao: a maior entre os sócios em
// comum, na outra (nula = não está no cadastro); administrador: algum deles administra a outra (LC 123, art. 3º, §4º, V).
const semAcento = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
export function empresasDosSocios(socios, outros, clienteId) {
  const meus = (socios || []).filter(s => s && (s.nome || s.cpf)).map(s => ({ nome: s.nome, cpf: String(s.cpf || '').replace(/\D/g, ''), chave: semAcento(s.nome) }));
  const por = new Map();
  (outros || []).forEach(o => {
    if (!o || !o.cliente_id || o.cliente_id === clienteId) return;
    const cpf = String(o.cpf || '').replace(/\D/g, ''), chave = semAcento(o.nome);
    const m = meus.find(s => s.cpf && cpf ? s.cpf === cpf : (s.chave && s.chave === chave));
    if (!m) return;
    const g = por.get(o.cliente_id) || { cliente_id: o.cliente_id, socios: [], participacao: null, administrador: false };
    if (!g.socios.includes(m.nome)) g.socios.push(m.nome);
    const p = o.participacao_percentual == null || o.participacao_percentual === '' ? null : num(o.participacao_percentual, null);
    if (p != null && (g.participacao == null || p > g.participacao)) g.participacao = p;
    if (o.eh_administrador === true) g.administrador = true;
    por.set(o.cliente_id, g);
  });
  return [...por.values()];
}
// quem entra na soma do limite (LC 123, art. 3º, §4º): a outra ME ou EPP — optante ou não — com qualquer participação
// (inciso III); a que não é ME nem EPP (faturou mais de R$ 4,8 milhões nos 12 meses), só com o sócio acima de 10% (IV) ou
// administrando (V). Sem a participação no cadastro, ou sem a receita da outra, entra (a conta fica do lado seguro).
// Volta null (entra) ou o porquê de ficar fora.
export function foraDaSoma(empresa, receita12) {
  const e = empresa || {};
  if (!(num(receita12) > LIMITE_DO_SIMPLES)) return null;
  if (e.administrador || e.participacao == null || num(e.participacao) > 10) return null;
  return 'ela faturou ' + brl(receita12) + ' nos 12 meses (não é ME nem EPP) e o sócio em comum tem ' + pct1(e.participacao) + '% dela, sem administrar — só conta acima de 10% ou com o sócio administrador (LC 123, art. 3º, §4º, IV e V)';
}
const LIMITE_DO_SIMPLES = 4800000;
// a outra que faturou mais de R$ 4,8 milhões e entrou na soma sem a participação no cadastro: o aviso pra conferir
export function avisoDaSoma(empresa, receita12, nome) {
  const e = empresa || {};
  if (!(num(receita12) > LIMITE_DO_SIMPLES) || e.administrador || e.participacao != null) return null;
  return (nome || 'A outra empresa dos sócios') + ' faturou ' + brl(receita12) + ' nos 12 meses (não é ME nem EPP): ela só conta na soma do limite se o sócio em comum tiver mais de 10% dela ou a administrar (LC 123, art. 3º, §4º, IV e V). A participação não está no cadastro, e a conta somou — confira.';
}
// o ano-calendário pelos números do sistema: até o último mês que todas têm, a soma do ano, o ritmo dos últimos 3 meses e,
// nesse ritmo, o mês em que a soma passa do limite. Com as empresas dos sócios, a saída vem no mês seguinte, sem a
// tolerância (LC 123, art. 3º, §6º; Res. CGSN 140, art. 81, II, "c"); sozinha, o excesso de até 20% (R$ 5,76 milhões) só
// tira do Simples no ano seguinte, e acima disso, no mês seguinte ao que passou dos 20% (art. 3º, §§9º e 9º-A).
const MES_LONGO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export function situacaoDoGrupo(serieEmpresa, outras, limite = 4800000) {
  const series = [{ nome: 'esta', serie: serieEmpresa || [] }, ...(outras || []).map(o => ({ nome: o.nome, serie: o.serie || [] }))];
  if (series.some(s => !s.serie.length)) return null;
  const ate = series.map(s => s.serie[s.serie.length - 1].competencia).sort()[0];
  const ano = ate.slice(0, 4), mesAte = Number(ate.slice(5, 7));
  const val = (s, c) => { const m = s.serie.find(x => x.competencia === c); return m ? num(m.total) : null; };
  const comp = (a, m) => a + '-' + String(m).padStart(2, '0');
  // os meses do ano até `ate` que todas têm
  const mesesAno = [];
  for (let m = 1; m <= mesAte; m++) { const c = comp(ano, m); if (series.every(s => val(s, c) != null)) mesesAno.push(c); }
  const porEmpresa = series.map(s => ({ nome: s.nome, ano: mesesAno.reduce((t, c) => t + val(s, c), 0) }));
  const acumulado = porEmpresa.reduce((t, p) => t + p.ano, 0);
  // os últimos 3 meses que todas têm (podem vir do ano anterior)
  const ult3 = [];
  for (let k = 0, a = Number(ano), m = mesAte; ult3.length < 3 && k < 24; k++) {
    const c = comp(a, m);
    if (series.every(s => val(s, c) != null)) ult3.push(c);
    m -= 1; if (m < 1) { m = 12; a -= 1; }
  }
  const ritmo = ult3.length ? ult3.reduce((t, c) => t + series.reduce((u, s) => u + val(s, c), 0), 0) / ult3.length : 0;
  const restantes = 12 - mesAte;
  // o mês em que a soma passou (já aconteceu) ou, no ritmo dos últimos 3 meses, passaria
  // o mês (1 a 12) em que a soma passa de um valor: já aconteceu ou, no ritmo dos últimos 3 meses, aconteceria
  const mesEmQuePassa = lim => {
    let acum = 0;
    for (const c of mesesAno) { acum += series.reduce((u, s) => u + val(s, c), 0); if (acum > lim) return { mes: Number(c.slice(5, 7)), ja: true }; }
    for (let j = 1; j <= restantes; j++) if (acumulado + ritmo * j > lim) return { mes: mesAte + j, ja: false };
    return null;
  };
  const p = mesEmQuePassa(limite);
  const passaEm = p ? p.mes : null, jaPassou = !!(p && p.ja);
  const sozinha = series.length === 1;
  const p20 = sozinha && p ? mesEmQuePassa(limite * 1.2) : null;
  const mesSeguinte = m => m === 12 ? '01/01/' + (Number(ano) + 1) : '01/' + String(m + 1).padStart(2, '0') + '/' + ano;
  const noAnoSeguinte = !!(sozinha && p && !p20);
  const saiEm = !passaEm ? null : noAnoSeguinte ? '01/01/' + (Number(ano) + 1) : mesSeguinte(sozinha ? p20.mes : passaEm);
  return {
    ano: Number(ano), ate, meses: mesesAno.length, acumulado, porEmpresa, ritmo, restantes, limite,
    projecao: acumulado + ritmo * restantes, faltam: Math.max(0, limite - acumulado),
    porMesAteOLimite: restantes > 0 ? Math.max(0, limite - acumulado) / restantes : null,
    passaEm: passaEm ? MES_LONGO[passaEm - 1] : null, jaPassou, saiEm, noAnoSeguinte,
    passa20Em: p20 ? MES_LONGO[p20.mes - 1] : null
  };
}

// ---------- os relatórios do Domínio soltos na tela ----------
// cons: o resultado de consolidar() (dominio-relatorios.js) — muda só o que os relatórios trazem, e marca a origem
export function aplicarRelatorios(entrada, origens, cons) {
  const e = JSON.parse(JSON.stringify(entrada || {}));
  const o = { ...(origens || {}) };
  if (!cons) return { entrada: e, origens: o, conferencia: null };
  const s = serieDosMeses(cons.fat ? cons.fat.meses : cons.resVen ? cons.resVen.meses : []);
  const tipoAnexo = tipoPeloAnexo(cons.campos && cons.campos.anexo);
  if (s) {
    const atuais = e.atividades && e.atividades.length ? e.atividades : [{ tipo: 'comercio', receita: 0 }];
    let tipoMerc = (atuais.find(a => TIPOS[a.tipo] && TIPOS[a.tipo].tributo === 'icms') || {}).tipo || 'comercio';
    let tipoServ = (atuais.find(a => TIPOS[a.tipo] && TIPOS[a.tipo].tributo === 'iss') || {}).tipo || 'servico';
    if (tipoAnexo === 'comercio' || tipoAnexo === 'industria') tipoMerc = tipoAnexo; else if (tipoAnexo) tipoServ = tipoAnexo;
    const novas = linhas(s.receita, s.mercadorias, s.servicos, tipoMerc, tipoServ);
    // o resto de cada linha (ST, ISS, presunção…) fica o que já estava na linha do mesmo tributo
    e.atividades = novas.map(n => ({ ...(atuais.find(a => TIPOS[a.tipo] && TIPOS[a.tipo].tributo === TIPOS[n.tipo].tributo) || {}), tipo: n.tipo, receita: n.receita }));
    e.meses = s.meses;
    Object.keys(o).filter(k => k.startsWith('atividades.')).forEach(k => { if (/\.(receita|tipo)$/.test(k)) delete o[k]; });
    const txt = (cons.fat ? 'faturamento' : 'saídas e serviços') + ' do Domínio de ' + periodo(s);
    e.atividades.forEach((a, i) => { o['atividades.' + i + '.receita'] = origem('dominio', txt); if (tipoAnexo && a.tipo === tipoAnexo) o['atividades.' + i + '.tipo'] = origem('dominio', 'Anexo ' + cons.campos.anexo + ' do PGDAS'); });
  }
  const receita = (e.atividades || []).reduce((t, a) => t + num(a.receita), 0);
  const v = cons.resVen;
  const iMerc = (e.atividades || []).findIndex(a => TIPOS[a.tipo] && TIPOS[a.tipo].tributo === 'icms');
  if (v && iMerc >= 0 && num(v.mercadorias) > 0) {
    e.atividades[iMerc].pctST = Math.min(100, num(v.st) / num(v.mercadorias) * 100);
    o['atividades.' + iMerc + '.pctST'] = origem('dominio', 'saídas do Domínio: vendas com ST (CFOP x401 a x405), ' + brl(v.st) + ' de ' + brl(v.mercadorias));
  }
  const c = cons.campos || {};
  if (receita > 0 && c.pctMerc != null) { e.compras = c.pctMerc / 100 * receita; o.compras = origem('dominio', (cons.origem && cons.origem.pctMerc) || 'entradas do Domínio'); }
  if (receita > 0 && c.pctDesp != null) { e.despesasCredito = c.pctDesp / 100 * receita; o.despesasCredito = origem('dominio', (cons.origem && cons.origem.pctDesp) || 'entradas do Domínio'); }
  const sim = cons.sim;
  // o "percentual de redução" do ICMS no PGDAS solto na tela
  if (sim && num(sim.reducaoIcms) > 0 && iMerc >= 0) {
    e.atividades[iMerc].redIcmsSimples = num(sim.reducaoIcms);
    o['atividades.' + iMerc + '.redIcmsSimples'] = origem('dominio', 'PGDAS de ' + rotuloComp(sim.competencia) + ': ' + pct1(sim.reducaoIcms) + '% de redução', 'o "percentual de redução" do ICMS que a empresa declara no PGDAS');
  }
  const conferencia = sim && sim.aliquotaEfetiva != null ? { competencia: sim.competencia, aliquota: sim.aliquotaEfetiva, das: sim.dasTotal, fonte: 'dominio' } : null;
  return { entrada: e, origens: o, conferencia };
}

// ---------- as premissas que valem um teste ----------
// as que ficaram no padrão e mexem na conta: o motor refaz o ano da decisão com os valores de cada lado
export function premissasParaTestar(entrada, origens) {
  const e = entrada || {}, o = origens || {};
  const padrao = k => !o[k] || o[k].fonte === 'padrao';
  const out = [];
  const ats = e.atividades || [];
  const temIcms = ats.some(a => TIPOS[a.tipo] && TIPOS[a.tipo].tributo === 'icms' && num(a.receita) > 0);
  if (temIcms && num(e.compras) > 0 && padrao('aliqCreditoIcms')) out.push({ campo: 'aliqCreditoIcms', valores: [7, 17], rotulo: 'o crédito de ICMS das compras', unidade: '%' });
  ats.forEach((a, i) => {
    const t = TIPOS[a.tipo];
    if (!t || !(num(a.receita) > 0)) return;
    const qual = ats.length > 1 ? ' (' + t.rotulo.toLowerCase() + ')' : '';
    if (t.tributo === 'icms' && padrao('atividades.' + i + '.aliqIcms')) out.push({ campo: 'atividades.' + i + '.aliqIcms', valores: [num(a.aliqIcms, 17) === 12 ? 17 : 12], rotulo: 'o ICMS das vendas' + qual, unidade: '%' });
    if (t.tributo === 'icms' && num(a.redIcms) > 0 && padrao('atividades.' + i + '.redIcms')) out.push({ campo: 'atividades.' + i + '.redIcms', valores: [0], rotulo: 'a redução da base do ICMS no regime geral' + qual, unidade: '%' });
    if (t.tributo === 'icms' && num(a.redIcmsSimples) > 0 && padrao('atividades.' + i + '.redIcmsSimples')) out.push({ campo: 'atividades.' + i + '.redIcmsSimples', valores: [0], rotulo: 'a redução do ICMS no DAS' + qual, unidade: '%' });
    if (t.tributo === 'iss' && padrao('atividades.' + i + '.aliqIss')) out.push({ campo: 'atividades.' + i + '.aliqIss', valores: [2, 5], rotulo: 'o ISS' + (ats.length > 1 ? ' (' + t.rotulo.toLowerCase() + ')' : ''), unidade: '%' });
  });
  if (padrao('rat') && num(e.folha) > 0) out.push({ campo: 'rat', valores: [1, 3], rotulo: 'o RAT', unidade: '%' });
  if (temIcms && e.rda === 'melhor' && padrao('rda')) out.push({ campo: 'rda', valores: [null], rotulo: 'o ICMS do restaurante no Presumido e no Real', nomes: { null: 'sem o RDA' }, confira: 'A conta supõe que a empresa pode optar pelo RDA (alimentação em 60% ou mais das vendas, sem dívida ativa) — confira.' });
  if (num(e.compras) > 0 && padrao('pctComprasSimples')) out.push({ campo: 'pctComprasSimples', valores: [50], rotulo: 'as compras de fornecedor do Simples (crédito menor de CBS/IBS)', unidade: '% das compras' });
  return out;
}

// ---------- os prazos da escolha ----------
// hoje: 'AAAA-MM-DD' · ano: o ano da decisão. Entrada no Simples: 1º a 30/09 do ano anterior, com cancelamento até 30/11
// (LC 123, art. 16, na redação da LC 214; Res. CGSN 140, art. 6º, na redação da Res. CGSN 190/2026). Saída por opção:
// a qualquer tempo, com efeitos em 1º de janeiro do ano seguinte (Res. CGSN 140, art. 81, I, na redação da Res. 190,
// em vigor desde 01/01/2027; até 2026 a comunicação de dezembro já valia pra janeiro seguinte e a de janeiro, pro
// próprio ano). Presumido: a opção é o pagamento da 1ª quota do IRPJ do 1º trimestre (Lei 9.430, art. 26, §1º); Real
// anual: a estimativa de janeiro, paga até o fim de fevereiro (art. 3º, parágrafo único, e art. 6º); Real trimestral: o 1º trimestre.
export function prazosDaEscolha(hoje, regimeAtual, ano = 2027) {
  const h = String(hoje || '').slice(0, 10);
  const antes = (d) => h <= d;
  const out = [];
  if (regimeAtual === 'simples') {
    out.push(antes((ano - 1) + '-12-31')
      ? { titulo: 'Sair do Simples em ' + ano, texto: 'Comunicar a exclusão por opção no Portal do Simples até 31/12/' + (ano - 1) + ', com efeito em 01/01/' + ano + '. Em janeiro de ' + ano + ' a comunicação já vale só pra ' + (ano + 1) + ' (Res. CGSN 140, art. 81, I, na redação da Res. CGSN 190/2026).' }
      : { titulo: 'Sair do Simples', texto: 'A exclusão por opção comunicada agora vale a partir de 01/01 do ano seguinte (Res. CGSN 140, art. 81, I, na redação da Res. CGSN 190/2026).' });
    out.push({ titulo: 'IBS/CBS por fora, sem sair do Simples', texto: 'Janelas em março (efeito em julho) e setembro (efeito em janeiro), na ficha da Reforma Tributária.' });
  } else if (regimeAtual === 'presumido' || regimeAtual === 'real') {
    out.push(antes((ano - 1) + '-09-30')
      ? { titulo: 'Entrar no Simples em ' + ano, texto: 'A opção vai de 01 a 30/09/' + (ano - 1) + ', no Portal do Simples (LC 123, art. 16, na redação da LC 214).' }
      : { titulo: 'Entrar no Simples', texto: 'A janela de ' + ano + ' fechou em 30/09/' + (ano - 1) + '. A próxima é de 01 a 30/09/' + ano + ', pra ' + (ano + 1) + '.' });
  }
  if (regimeAtual !== 'mei') out.push({ titulo: 'Presumido ou Real em ' + ano, texto: 'A escolha se faz no primeiro pagamento do IRPJ de ' + ano + ': no Presumido e no Real trimestral, a quota do 1º trimestre, que vence no fim de abril (Lei 9.430, art. 26, §1º); no Real anual, a estimativa de janeiro, que vence no fim de fevereiro (Lei 9.430, art. 3º, parágrafo único).' });
  return out;
}
