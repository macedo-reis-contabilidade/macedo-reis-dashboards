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
  gravado: 'estudo gravado'
};
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
  let sim = null;
  try { sim = caso && caso.sim_obs ? JSON.parse(caso.sim_obs) : null; } catch (e) { sim = null; }
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
  if (iMerc >= 0) {
    const v = dom.vendas || null;
    if (v && num(v.mercadorias) > 0 && v.st != null) {
      atividades[iMerc].pctST = Math.min(100, num(v.st) / num(v.mercadorias) * 100);
      origens['atividades.' + iMerc + '.pctST'] = origem('reforma', 'caso da Reforma: vendas com ST (CFOP x401 a x405) nas saídas do Domínio, ' + brl(v.st) + ' de ' + brl(v.mercadorias));
    }
    if (num(inp.pctReceitaMonofasica) > 0) {
      atividades[iMerc].pctMonofasico = num(inp.pctReceitaMonofasica);
      origens['atividades.' + iMerc + '.pctMonofasico'] = origem('reforma', 'caso da Reforma: receita monofásica de PIS/Cofins');
    }
    origens['atividades.' + iMerc + '.aliqIcms'] = origem('padrao', 'padrão: 17%, a interna do RS', 'venda pra outro estado é 12% (7% ou 4% em alguns casos) — confira');
  }
  atividades.forEach((a, i) => { if (TIPOS[a.tipo].tributo === 'iss') origens['atividades.' + i + '.aliqIss'] = origem('padrao', 'padrão: 3% — confira', 'a alíquota do ISS da atividade no município'); });

  const e = { atividades, meses };
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
  const conferencia = pg && num(pg.aliquotaEfetiva) > 0 ? { competencia: pg.competencia, aliquota: num(pg.aliquotaEfetiva), das: num(pg.dasTotal) } : null;
  return { entrada: e, origens, notas, conferencia };
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
  const conferencia = sim && sim.aliquotaEfetiva != null ? { competencia: sim.competencia, aliquota: sim.aliquotaEfetiva, das: sim.dasTotal } : null;
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
    if (t.tributo === 'icms' && padrao('atividades.' + i + '.aliqIcms')) out.push({ campo: 'atividades.' + i + '.aliqIcms', valores: [12], rotulo: 'o ICMS das vendas' + (ats.length > 1 ? ' (' + t.rotulo.toLowerCase() + ')' : ''), unidade: '%' });
    if (t.tributo === 'iss' && padrao('atividades.' + i + '.aliqIss')) out.push({ campo: 'atividades.' + i + '.aliqIss', valores: [2, 5], rotulo: 'o ISS' + (ats.length > 1 ? ' (' + t.rotulo.toLowerCase() + ')' : ''), unidade: '%' });
  });
  if (padrao('rat') && num(e.folha) > 0) out.push({ campo: 'rat', valores: [1, 3], rotulo: 'o RAT', unidade: '%' });
  if (num(e.compras) > 0 && padrao('pctComprasSimples')) out.push({ campo: 'pctComprasSimples', valores: [50], rotulo: 'as compras de fornecedor do Simples (crédito menor de CBS/IBS)', unidade: '% das compras' });
  return out;
}

// ---------- os prazos da escolha ----------
// hoje: 'AAAA-MM-DD' · ano: o ano da decisão. Entrada no Simples: 1º a 30/09 do ano anterior, com cancelamento até 30/11
// (LC 123, art. 16, na redação da LC 214; Res. CGSN 140, art. 6º, na redação da Res. CGSN 190/2026). Saída por opção:
// a qualquer tempo, com efeitos em 1º de janeiro do ano seguinte (Res. CGSN 140, art. 81, I, na redação da Res. 190,
// em vigor desde 01/01/2027; até 2026 a comunicação de dezembro já valia pra janeiro seguinte e a de janeiro, pro
// próprio ano). Presumido: a opção é o pagamento da 1ª quota do IRPJ do 1º trimestre (Lei 9.430, art. 26, §1º).
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
  if (regimeAtual !== 'mei') out.push({ titulo: 'Presumido ou Real em ' + ano, texto: 'A escolha se faz no primeiro pagamento do IRPJ de ' + ano + ': no Presumido, a quota do 1º trimestre, que vence no fim de abril (Lei 9.430, art. 26, §1º).' });
  return out;
}
