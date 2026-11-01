// Teste do motor do comparativo tributário (Simples × Presumido × Real).
// Rodar com: node tests/comparativo-motor.test.mjs
// Os valores esperados são contas feitas à mão pelas tabelas da lei (LC 123, Anexos I a V; Lei 9.249; Lei 9.430;
// Leis 9.718, 10.637 e 10.833; Lei 8.212; LC 224/2025; Lei 14.973/2024; LC 214 e Res. CGSN 190/2026), escritas
// do lado de cada caso. Tolerância: R$ 0,01 por linha. Se não bater, o motor está errado, não o teste.

import { comparar, calcularAno, normalizar, testarPremissas, irpjCsllReal, fraseDaDecisao, excessosLc224 } from '../assets/js/comparativo-motor.js';

let falhas = 0, total = 0;
function igual(nome, esperado, obtido, tol = 0.01) {
  total++;
  const ok = obtido != null && Math.abs(esperado - obtido) <= tol;
  if (!ok) falhas++;
  console.log((ok ? '  ok ' : 'FALHA') + '  ' + nome.padEnd(58) + ' esperado ' + String(Number(esperado).toFixed(2)).padStart(13) + '  obtido ' + String(obtido == null ? 'null' : Number(obtido).toFixed(2)).padStart(13));
}
function verdade(nome, cond) {
  total++;
  if (!cond) falhas++;
  console.log((cond ? '  ok ' : 'FALHA') + '  ' + nome);
}
const item = (reg, nome) => { const i = reg.itens.find(x => x.tributo === nome); return i ? i.valor : 0; };

// ----------------------------------------------------------------------------------------------------------------
console.log('=== A · comércio, R$ 1,2 milhão, sem ST — Simples × Presumido × Real em 2026 e 2027 ===');
const A = {
  atividades: [{ tipo: 'comercio', receita: 1200000 }],
  folha: 120000, proLabore: 36000, rat: 2, fap: 1, terceiros: 5.8,
  compras: 800000, aliqCreditoIcms: 12, despesasCredito: 30000, outrasDespesas: 60000
};
const a26 = calcularAno(A, 2026);
// Simples: Anexo I, RBT12 1.200.000 (4ª faixa) → (1.200.000 × 10,70% − 22.500) ÷ 1.200.000 = 8,825% → DAS 105.900,00
igual('Simples 2026: DAS', 105900, a26.simples.das);
igual('Simples 2026: total', 105900, a26.simples.total);
// Presumido: base do IRPJ 300.000 × 8% = 24.000 por trimestre → 3.600 (sem adicional) × 4
igual('Presumido 2026: IRPJ', 14400, a26.presumido.irpj);
igual('Presumido 2026: CSLL (300.000 × 12% × 9% × 4)', 12960, a26.presumido.csll);
// ICMS: 1.200.000 × 17% = 204.000 − 800.000 × 12% = 96.000 → 108.000
igual('Presumido 2026: ICMS', 108000, item(a26.presumido, 'ICMS'));
// PIS/Cofins cumulativo sobre 1.200.000 − 204.000 de ICMS = 996.000: 6.474 + 29.880
igual('Presumido 2026: PIS', 6474, item(a26.presumido, 'PIS'));
igual('Presumido 2026: Cofins', 29880, item(a26.presumido, 'Cofins'));
// INSS: 120.000 × (20% + 2% + 5,8%) = 33.360 · pró-labore 36.000 × 20% = 7.200
igual('Presumido 2026: INSS patronal', 33360, item(a26.presumido, 'INSS patronal (CPP, RAT e terceiros)'));
igual('Presumido 2026: INSS do pró-labore', 7200, item(a26.presumido, 'INSS sobre o pró-labore (20%)'));
igual('Presumido 2026: total', 212274, a26.presumido.total);
// Real: PIS/Cofins 996.000 × 9,25% = 92.130 − (800.000 − 96.000 + 30.000) × 9,25% = 67.895 → 24.235
igual('Real 2026: PIS + Cofins', 24235, item(a26.real, 'PIS') + item(a26.real, 'Cofins'));
// lucro: 1.200.000 − 800.000 − 129.600 (folha + FGTS) − 40.560 − 36.000 − 30.000 − 60.000 − 132.235 = −28.395
igual('Real 2026: lucro', -28395, a26.real.lucro);
igual('Real 2026: IRPJ (prejuízo)', 0, a26.real.irpj);
igual('Real 2026: total', 172795, a26.real.total);
verdade('2026: Simples < Real < Presumido', a26.ordem.join(',') === 'simples,real,presumido');

const a27 = calcularAno(A, 2027);
igual('Simples 2027: DAS igual (sem ST nem monofásico)', 105900, a27.simples.das);
// CBS 11,2% + IBS 0,1% (referência do TCU 11,3, menos 0,1 ponto): débito (1.200.000 − 204.000) × 11,3% = 112.548;
// crédito (800.000 × 88% + 30.000) × 11,3% = 82.942 → 29.606 (CBS 29.344, IBS 262)
igual('Presumido 2027: CBS', 29344, item(a27.presumido, 'CBS'));
igual('Presumido 2027: IBS', 262, item(a27.presumido, 'IBS'));
igual('Presumido 2027: total (27.360 + 29.606 + 108.000 + 40.560)', 205526, a27.presumido.total);
igual('Real 2027: lucro (400.000 − 433.766)', -33766, a27.real.lucro);
igual('Real 2027: total', 178166, a27.real.total);

// ----------------------------------------------------------------------------------------------------------------
console.log('=== B · serviço do fator r com folha (Anexo III) e sem folha (Anexo V) ===');
const B = { atividades: [{ tipo: 'servico_r', receita: 600000, aliqIss: 3 }], folha: 120000, proLabore: 60000, outrasDespesas: 100000 };
const b26 = calcularAno(B, 2026);
// FS12 = 120.000 × 1,08 + 60.000 = 189.600 → r = 31,6% → Anexo III, 3ª faixa: (600.000 × 13,5% − 17.640) = 63.360
igual('Simples 2026: fator r', 0.316, b26.simples.fatorR, 0.0001);
verdade('Simples 2026: Anexo III', b26.simples.porAnexo.III > 0 && !b26.simples.porAnexo.V);
igual('Simples 2026: DAS', 63360, b26.simples.das);
// Presumido: 150.000 × 32% = 48.000 por trimestre → IRPJ 7.200 × 4 = 28.800 · CSLL 4.320 × 4 = 17.280 · PIS/Cofins 21.900
// · ISS 18.000 · INSS 120.000 × 27,8% = 33.360 + 12.000 → 131.340
igual('Presumido 2026: total', 131340, b26.presumido.total);
const C = { atividades: [{ tipo: 'servico_r', receita: 600000, aliqIss: 3 }], folha: 0, proLabore: 30000, outrasDespesas: 50000 };
const c26 = calcularAno(C, 2026);
// r = 30.000 ÷ 600.000 = 5% → Anexo V, 3ª faixa: 600.000 × 19,5% − 9.900 = 107.100
igual('Simples 2026 sem folha: DAS no Anexo V', 107100, c26.simples.das);
// Presumido: 28.800 + 17.280 + 21.900 + 18.000 + 6.000 (pró-labore) = 91.980
igual('Presumido 2026 sem folha: total', 91980, c26.presumido.total);
verdade('sem folha, o Presumido ganha do Simples', c26.melhor === 'presumido');

// ----------------------------------------------------------------------------------------------------------------
console.log('=== D · LC 224/2025: comércio de R$ 6 milhões no Presumido ===');
const D = { atividades: [{ tipo: 'comercio', receita: 6000000, aliqIcms: 17 }], compras: 4000000, folha: 600000, outrasDespesas: 300000 };
const d27 = calcularAno(D, 2027);
// por trimestre: 1.500.000 × 8% = 120.000 + excesso de 250.000 × 8% × 10% = 2.000 → 122.000:
// IRPJ 18.300 + adicional (122.000 − 60.000) × 10% = 6.200 → 24.500 × 4 = 98.000
igual('Presumido 2027: IRPJ com o aumento', 98000, d27.presumido.irpj);
// CSLL: 1.500.000 × 12% = 180.000 + 250.000 × 12% × 10% = 3.000 → 183.000 × 9% = 16.470 × 4
igual('Presumido 2027: CSLL com o aumento', 65880, d27.presumido.csll);
const d26 = calcularAno(D, 2026);
// 2026: a CSLL majorada só a partir de abril — 1º trimestre 16.200 + 3 × 16.470
igual('Presumido 2026: CSLL (aumento só de abril)', 65610, d26.presumido.csll);
const d27sem = calcularAno({ ...D, semLc224: true }, 2027);
// sem o aumento (liminar): 120.000 → 18.000 + 6.000 = 24.000 × 4 = 96.000
igual('Presumido 2027 com liminar: IRPJ', 96000, d27sem.presumido.irpj);
verdade('Simples fora do limite com R$ 6 milhões', d27.simples.disponivel === false);

// ----------------------------------------------------------------------------------------------------------------
console.log('=== E · IRPJ e CSLL do Real ===');
const e1 = irpjCsllReal(300000);
igual('IRPJ sobre lucro de 300.000 (45.000 + 6.000)', 51000, e1.irpj);
igual('CSLL sobre lucro de 300.000', 27000, e1.csll);
igual('IRPJ sobre prejuízo', 0, irpjCsllReal(-5000).irpj);

// ----------------------------------------------------------------------------------------------------------------
console.log('=== G · ST e monofásico no Simples; indústria no Anexo I em 2027 ===');
const g = calcularAno({ atividades: [{ tipo: 'comercio', receita: 1200000, pctST: 50 }] }, 2026);
// exclusão: 50% × 33,5% (fatia do ICMS na 4ª faixa) = 16,75% → 105.900 × 83,25% = 88.161,75
igual('Simples 2026 com 50% de ST', 88161.75, g.simples.das);
const h26 = calcularAno({ atividades: [{ tipo: 'comercio', receita: 1200000, pctMonofasico: 40 }] }, 2026);
const h27 = calcularAno({ atividades: [{ tipo: 'comercio', receita: 1200000, pctMonofasico: 40 }] }, 2027);
// 2026: 40% × 15,5% (PIS + Cofins na 4ª faixa) = 6,2% → 105.900 × 93,8% = 99.334,20; 2027: sem a exclusão
igual('Simples 2026 com 40% monofásico', 99334.2, h26.simples.das);
igual('Simples 2027: o monofásico acaba no DAS', 105900, h27.simples.das);
const i26 = calcularAno({ atividades: [{ tipo: 'industria', receita: 1200000 }] }, 2026);
const i27 = calcularAno({ atividades: [{ tipo: 'industria', receita: 1200000 }] }, 2027);
// Anexo II, 4ª faixa: 1.200.000 × 11,2% − 22.500 = 111.900; em 2027 vai pro Anexo I: 105.900
igual('Simples 2026: indústria no Anexo II', 111900, i26.simples.das);
igual('Simples 2027: indústria no Anexo I', 105900, i27.simples.das);
const i27z = calcularAno({ atividades: [{ tipo: 'industria', receita: 1200000, ipiMantido: true }] }, 2027);
igual('Simples 2027: IPI mantido segue no Anexo II', 111900, i27z.simples.das);

// ----------------------------------------------------------------------------------------------------------------
console.log('=== J · Anexo IV: a CPP fora do DAS ===');
const j = calcularAno({ atividades: [{ tipo: 'servico_iv', receita: 600000 }], folha: 200000, proLabore: 50000, rat: 3 }, 2026);
// 3ª faixa: 600.000 × 10,2% − 12.420 = 48.780 · CPP 200.000 × 23% + 50.000 × 20% = 56.000
igual('Simples Anexo IV: DAS', 48780, j.simples.das);
igual('Simples Anexo IV: CPP fora do DAS', 56000, item(j.simples, 'CPP fora do DAS (Anexo IV)'));
igual('Simples Anexo IV: total', 104780, j.simples.total);

// ----------------------------------------------------------------------------------------------------------------
console.log('=== K · acima do sublimite (RBT12 de R$ 4,2 milhões) ===');
const k = calcularAno({ atividades: [{ tipo: 'comercio', receita: 4200000 }], compras: 3000000 }, 2026);
// 6ª faixa do Anexo I: 4.200.000 × 19% − 378.000 = 420.000 · ICMS fora: 714.000 − 360.000 = 354.000
igual('Simples acima do sublimite: DAS (sem ICMS)', 420000, k.simples.das);
igual('Simples acima do sublimite: ICMS fora do DAS', 354000, item(k.simples, 'ICMS fora do DAS (sublimite)'));

// ----------------------------------------------------------------------------------------------------------------
console.log('=== M · desoneração da folha (CPRB) na transição ===');
const M = { atividades: [{ tipo: 'industria', receita: 10000000 }], folha: 1000000, proLabore: 120000, cprb: 1.5, rat: 2, terceiros: 5.8 };
const m26 = calcularAno(M, 2026), m27 = calcularAno(M, 2027), m28 = calcularAno(M, 2028);
// a CPP reduzida não alcança o 13º (Lei 12.546, art. 9º-A, §1º): 13º estimado em 1.000.000 ÷ 13,33 = 75.000
igual('2026: CPP 50% sem o 13º (925.000 × 20% × 0,5)', 92500, m26.presumido.inss.cpp);
igual('2026: pró-labore também reduzido (120.000 × 20% × 0,5)', 12000, m26.presumido.inss.proLabore);
igual('2026: CPRB 60% (10.000.000 × 1,5% × 0,6)', 90000, m26.presumido.inss.cprb);
igual('2027: CPP 75% sem o 13º', 138750, m27.presumido.inss.cpp);
igual('2027: pró-labore 75%', 18000, m27.presumido.inss.proLabore);
igual('2027: CPRB 40%', 60000, m27.presumido.inss.cprb);
igual('2028: CPP cheia, com o 13º', 200000, m28.presumido.inss.cpp);
igual('2028: pró-labore cheio', 24000, m28.presumido.inss.proLabore);
igual('2028: sem CPRB', 0, m28.presumido.inss.cprb);

// ----------------------------------------------------------------------------------------------------------------
console.log('=== N · projeção: crescimento e a janela do RBT12 de 2027 ===');
const N = { atividades: [{ tipo: 'comercio', receita: 1200000 }], crescimentoReceita: 10 };
const n27 = calcularAno(N, 2027);
igual('2027: receita com 10% a mais', 1320000, n27.receita);
// RBT12 de jan/2027 = dez da base anterior (1.200.000 ÷ 1,1 ÷ 12) + jan a nov da base (11 × 100.000)
// = 90.909,09 + 1.100.000 = 1.190.909,09; os meses seguintes trocam um mês da base anterior/base por um da base/2027
const nNorm = normalizar(N);
verdade('normaliza o crescimento', nNorm.crescimentoReceita === 10);
// DAS de jan/2027: 110.000 × (1.190.909,09 × 10,7% − 22.500) ÷ 1.190.909,09
const rbtJan = 1200000 / 1.1 / 12 + 11 * 100000;
const dasJan = 110000 * (rbtJan * 0.107 - 22500) / rbtJan;
verdade('DAS de 2027 maior que 12 × o de janeiro com RBT12 subindo', n27.simples.das > 12 * dasJan - 0.01);

// ----------------------------------------------------------------------------------------------------------------
console.log('=== O · a decisão e o lucro de empate do Real ===');
const cA = comparar(A);
verdade('ano da decisão: 2027', cA.anoDecisao === 2027);
verdade('melhor em 2027: Simples', cA.decisao.melhor === 'simples');
// Real 2027 sem o IRPJ/CSLL: 178.166; Presumido: 205.526 → folga 27.360 → lucro de empate 27.360 ÷ 24% = 114.000
igual('lucro em que o Real empata com o Presumido', 114000, cA.decisao.real.empate.presumido.lucro);
verdade('o Real não empata com o Simples nem com lucro zero', cA.decisao.real.empate.simples.nunca === true);
const fr = fraseDaDecisao({ ...cA, decisao: { ...cA.decisao, regimeAtual: 'presumido', economiaVsAtual: 99626 } });
verdade('a frase cita o Simples e o regime de hoje', /Simples Nacional sai mais barato/.test(fr) && /Lucro Presumido/.test(fr));
// lucro acima de 240 mil: folga 100.000 → 100.000 ÷ 24% = 416.667 > 240.000 → (100.000 + 24.000) ÷ 34% = 364.705,88
const P = { atividades: [{ tipo: 'servico', receita: 3000000, aliqIss: 3 }], folha: 400000, outrasDespesas: 1500000 };
const cP = comparar(P);
const rP = cP.anos.find(x => x.ano === 2027);
const folga = rP.presumido.total - rP.real.outros;
const esperado = folga / 0.24 <= 240000 ? folga / 0.24 : (folga + 24000) / 0.34;
igual('lucro de empate na faixa do adicional (fórmula inversa)', esperado, cP.decisao.real.empate.presumido.lucro);
const conf = irpjCsllReal(cP.decisao.real.empate.presumido.lucro);
igual('no lucro de empate, o Real custa o mesmo que o Presumido', rP.presumido.total, rP.real.outros + conf.irpj + conf.csll);

// ----------------------------------------------------------------------------------------------------------------
console.log('=== Q · premissas que mudam o resultado ===');
// comércio no limite: o crédito de ICMS decide entre Simples e regime regular
const Q = { atividades: [{ tipo: 'comercio', receita: 1200000 }], compras: 900000, folha: 60000, outrasDespesas: 150000, despesasCredito: 20000 };
const t = testarPremissas(Q, [{ campo: 'aliqCreditoIcms', valores: [7, 17], rotulo: 'crédito de ICMS das compras' }, { campo: 'rat', valores: [1, 3], rotulo: 'RAT' }]);
verdade('o teste devolve uma linha por premissa', t.length === 2 && t[0].variantes.length === 2);
verdade('o RAT não muda o resultado', t[1].muda === false);
const q17 = calcularAno({ ...Q, aliqCreditoIcms: 17 }, 2027), q7 = calcularAno({ ...Q, aliqCreditoIcms: 7 }, 2027);
verdade('o crédito de ICMS maior baixa o Presumido', q17.presumido.total < q7.presumido.total);
verdade('o teste marca "muda" quando o mais barato troca', t[0].muda === (q17.melhor !== q7.melhor || q17.melhor !== t[0].melhorBase));

// ----------------------------------------------------------------------------------------------------------------
console.log('=== S · as fronteiras do Simples pela receita do ano (revisão de 01/11/2026) ===');
// 3,3 mi em 2026 crescendo 20%: em 2027 a empresa não está impedida (2026 abaixo de 3,6 mi; em 2027 o excesso não passa de
// 20%) — o ICMS fica no DAS pela fórmula da 5ª faixa nos meses de RBT12 acima de 3,6 mi. A conta à mão da revisão dá
// 484.288,61 com a 6ª faixa de 2026 (o motor ainda não tem a de 2027; com ela, 482.638,61). Antes saía 559.717,76.
const S2 = { atividades: [{ tipo: 'comercio', receita: 3300000, aliqIcms: 17 }], crescimentoReceita: 20, compras: 2310000, aliqCreditoIcms: 12, folha: 300000, outrasDespesas: 400000 };
const s2 = calcularAno(S2, 2027);
igual('sublimite sem impedimento: o ICMS no DAS pela 5ª faixa', 484288.61, s2.simples.total);
igual('... e nada de ICMS fora do DAS', 0, item(s2.simples, 'ICMS fora do DAS (sublimite)'));
verdade('o aviso diz que não está impedida', s2.simples.avisos.some(a => /sem a empresa estar impedida/.test(a)));
// 3,5 mi no ano anterior e 4,8 mi no ano: passa de 4,32 mi (o sublimite + 20%) com novembro → impedida em dezembro
const S3 = { atividades: [{ tipo: 'comercio', receita: 4800000 }], receitaAnoAnterior: 3500000, compras: 3000000 };
const s3 = calcularAno(S3, 2026);
verdade('passou de 4,32 mi no ano: o ICMS de dezembro fora do DAS', item(s3.simples, 'ICMS fora do DAS (sublimite)') > 0 && s3.simples.avisos.some(a => /em 1 mês/.test(a)));
// 4,5 mi crescendo 10%: em 2027 o RBT12 passa de 4,8 mi em dezembro, mas o excesso do ano é de 3% — segue no Simples em
// 2027 e sai em 2028 (LC 123, art. 3º, §§9º e 9º-A)
const S4 = { atividades: [{ tipo: 'comercio', receita: 4500000 }], crescimentoReceita: 10, compras: 3000000 };
verdade('excesso de até 20%: segue no Simples no ano, com o aviso', calcularAno(S4, 2027).simples.disponivel === true && calcularAno(S4, 2027).simples.avisos.some(a => /segue no Simples até o fim do ano/.test(a)));
verdade('... e sai no ano seguinte', calcularAno(S4, 2028).simples.disponivel === false);
// 4,7 mi crescendo 40%: em 2027 a receita passa de 5,76 mi (o limite + 20%) com novembro → sai em dezembro
const S5 = calcularAno({ atividades: [{ tipo: 'comercio', receita: 4700000 }], crescimentoReceita: 40 }, 2027);
verdade('excesso acima de 20% no ano: fora do Simples, com o mês', S5.simples.disponivel === false && /a partir de dezembro/.test(S5.simples.motivo), S5.simples.motivo);

// ----------------------------------------------------------------------------------------------------------------
console.log('=== T · os casos da revisão independente (contas à mão de outro revisor, 01/11/2026) ===');
// (fora do RS: aqui, com a receita abaixo de R$ 360 mil, o Simples Gaúcho tiraria o ICMS do DAS — a seção X)
const T1 = { uf: 'SC', atividades: [{ tipo: 'comercio', receita: 300000, pctST: 30, pctMonofasico: 20, aliqIcms: 17 }], receitaAnoAnterior: 240000, crescimentoReceita: 25,
  folha: 40000, proLabore: 18000, rat: 2, fap: 1, terceiros: 5.8, compras: 190000, aliqCreditoIcms: 12, despesasCredito: 12000, outrasDespesas: 30000 };
const t26 = calcularAno(T1, 2026), t27 = calcularAno(T1, 2027);
igual('2ª faixa com ST e monofásico: Simples 2026', 13187.39, t26.simples.total);
igual('Simples 2027 (janela recuada, 3ª faixa em dezembro)', 18469.37, t27.simples.total);
// o ICMS sai da base do PIS/Cofins só da parte tributada: (300.000 − 35.700) × 80% = 211.440 × 3,65%
igual('Presumido 2026: PIS + Cofins com monofásico', 7717.56, item(t26.presumido, 'PIS') + item(t26.presumido, 'Cofins'));
igual('Presumido 2026: total', 49017.56, t26.presumido.total);
igual('Real 2026: total', 40029.24, t26.real.total);
igual('Presumido 2027: total', 59965.38, t27.presumido.total);
igual('Real 2027: total', 51415.38, t27.real.total);
const T2 = { atividades: [{ tipo: 'servico_r', receita: 2500000, aliqIss: 3 }], folha: 500000, proLabore: 85000, rat: 1, fap: 1, terceiros: 5.8, despesasCredito: 150000, outrasDespesas: 600000, crescimentoFolha: 15 };
igual('fator r de 25% (Anexo V, 5ª faixa): Simples 2026', 512900, calcularAno(T2, 2026).simples.total);
igual('2027: dezembro vai ao Anexo III pela FS12 recuada', 503438.33, calcularAno(T2, 2027).simples.total);
igual('Real 2026 (lucro de 681.625)', 651127.5, calcularAno(T2, 2026).real.total);
igual('Presumido 2027 (CBS + IBS)', 753725, calcularAno(T2, 2027).presumido.total);
igual('empate do Real com o Presumido acima de R$ 240 mil', 800000, comparar(T2).decisao.real.empate.presumido.lucro);
// LC 224 com 40% da receita no 1º trimestre: o excesso anual fica no 1º trimestre (o refazimento da IN 2.306); a CSLL de
// 2026 conta R$ 3,75 milhões a partir de abril
const q1 = 2200000 / 3, resto = 1100000 / 3;
const T3 = { atividades: [{ tipo: 'comercio', receita: 5500000, aliqIcms: 17 }], meses: [q1, q1, q1, resto, resto, resto, resto, resto, resto, resto, resto, resto],
  folha: 400000, proLabore: 60000, rat: 2, fap: 1, terceiros: 5.8, compras: 3800000, aliqCreditoIcms: 12, despesasCredito: 100000, outrasDespesas: 600000 };
igual('LC 224 sazonal: IRPJ 2026', 87000, calcularAno(T3, 2026).presumido.irpj);
igual('LC 224 sazonal: CSLL 2026 (abril a dezembro abaixo de 3,75 mi)', 59400, calcularAno(T3, 2026).presumido.csll);
igual('LC 224 sazonal: CSLL 2027', 59940, calcularAno(T3, 2027).presumido.csll);
igual('Presumido 2026: total', 915222.5, calcularAno(T3, 2026).presumido.total);
const ex = excessosLc224([2200000, 1100000, 1100000, 1100000], 0);
verdade('o excesso do ano (500 mil) fica no 1º trimestre', ex.join(',') === '500000,0,0,0', ex);
verdade('a CSLL de 2026 começa em abril', excessosLc224([2200000, 1100000, 1100000, 1100000], 1).every(v => v === 0));
// o IPI de 2026 da indústria no Presumido e no Real
const ipi = calcularAno({ atividades: [{ tipo: 'industria', receita: 1200000, aliqIpi: 5 }] }, 2026);
igual('IPI de 2026 no Presumido (5% da receita)', 60000, item(ipi.presumido, 'IPI'));
verdade('em 2027 o IPI é zero', !calcularAno({ atividades: [{ tipo: 'industria', receita: 1200000, aliqIpi: 5 }] }, 2027).presumido.itens.some(x => x.tributo === 'IPI'));

// ----------------------------------------------------------------------------------------------------------------
console.log('=== U · a redução do ICMS: no DAS (o "percentual de redução" do PGDAS) e no regime geral (base reduzida) ===');
// Simples, Anexo I, RBT12 constante de 2.000.000 (5ª faixa): (2.000.000 × 14,30% − 87.300) ÷ 2.000.000 = 9,935% → 198.700
// pela tabela. 10% da receita com ST e monofásica, 40% de redução no ICMS do resto: sai 33,5% × (10% + 90% × 40%) =
// 15,41% e, em 2026, 10% × 15,5% (PIS + Cofins) = 1,55% → 198.700 × 83,04% = 165.000,48. Sem a redução: 33,5% × 10% =
// 3,35% → 198.700 × 95,10% = 188.963,70. Em 2027 o monofásico não sai: 198.700 × 84,59% = 168.080,33.
const U1 = { atividades: [{ tipo: 'comercio', receita: 2000000, pctST: 10, pctMonofasico: 10, redIcmsSimples: 40 }], receitaAnoAnterior: 2000000 };
igual('DAS com 40% de redução do ICMS (2026)', 165000.48, calcularAno(U1, 2026).simples.das);
igual('DAS sem a redução (2026)', 188963.70, calcularAno({ ...U1, atividades: [{ ...U1.atividades[0], redIcmsSimples: 0 }] }, 2026).simples.das);
igual('DAS com a redução em 2027 (sem a exclusão do monofásico)', 168080.33, calcularAno(U1, 2027).simples.das);
// regime geral, a refeição no RS: 12% com a base a 60% (RICMS-RS, Livro I, art. 23, VI) e o crédito proporcional (art. 33, IV):
// débito 2.000.000 × 90% (sem ST) × 60% × 12% = 129.600 · crédito 1.000.000 × 90% × 12% × 60% = 64.800 → ICMS 64.800.
// PIS/Cofins cumulativo sobre 2.000.000 − 129.600 = 1.870.400: 12.157,60 + 56.112,00
const U2 = { atividades: [{ tipo: 'comercio', receita: 2000000, pctST: 10, aliqIcms: 12, redIcms: 40 }], compras: 1000000, aliqCreditoIcms: 12 };
const u2 = calcularAno(U2, 2026);
igual('ICMS com a base a 60% e o crédito proporcional', 64800, item(u2.presumido, 'ICMS'));
igual('PIS sobre a receita menos o ICMS da base reduzida', 12157.60, item(u2.presumido, 'PIS'));
igual('Cofins sobre a receita menos o ICMS da base reduzida', 56112.00, item(u2.presumido, 'Cofins'));
// duas atividades: 1.000.000 a 12% com base a 60% + 1.000.000 a 17% cheia → débito 72.000 + 170.000 = 242.000; o crédito
// cai na proporção da base: (600.000 + 1.000.000) ÷ 2.000.000 = 80% → 1.000.000 × 12% × 80% = 96.000 → ICMS 146.000
const U3 = { atividades: [{ tipo: 'comercio', receita: 1000000, aliqIcms: 12, redIcms: 40 }, { tipo: 'comercio', receita: 1000000, aliqIcms: 17 }], compras: 1000000, aliqCreditoIcms: 12 };
igual('duas atividades: o crédito rateado pela base de cada uma', 146000, item(calcularAno(U3, 2026).presumido, 'ICMS'));
verdade('serviço não tem redução de ICMS', normalizar({ atividades: [{ tipo: 'servico', receita: 1000, redIcms: 40, redIcmsSimples: 40 }] }).atividades[0].redIcms === 0);

// ----------------------------------------------------------------------------------------------------------------
console.log('=== V · a receita global: as outras empresas dos mesmos sócios (LC 123, art. 3º, §4º, III e IV) ===');
// 2.500.000 + 2.500.000 no ano anterior = 5.000.000 > 4.800.000 → fora do Simples o ano todo
const V1 = comparar({ atividades: [{ tipo: 'comercio', receita: 2500000 }], grupo: [{ nome: 'OUTRA', receita: 2500000 }] });
verdade('a soma do ano anterior passou de 4,8 milhões: Simples fora em todos os anos', V1.anos.every(r => r.simples.disponivel === false) && /§4º/.test(V1.anos[0].simples.motivo));
// 2.400.000 + 2.350.000 = 4.750.000: dentro, com a folga de 50.000
const V2 = { atividades: [{ tipo: 'comercio', receita: 2400000 }], grupo: [{ nome: 'OUTRA', receita: 2350000 }] };
const v2 = calcularAno(V2, 2026);
verdade('4,75 milhões somadas: Simples disponível, com o aviso da folga de R$ 50.000,00', v2.simples.disponivel && v2.simples.avisos.some(a => /folga é de R\$\s50\.000,00/.test(a)));
// crescendo 10%: 2027 soma 5.225.000 e passa em dezembro → 2027 inteiro no Simples (a exclusão vale do mês seguinte, em
// 2028) e 2028 fora (o ano anterior passou)
const v3 = comparar({ ...V2, crescimentoReceita: 10 });
verdade('passa em dezembro de 2027: 2027 no Simples, 2028 fora', v3.anos.find(r => r.ano === 2027).simples.disponivel === true && v3.anos.find(r => r.ano === 2028).simples.disponivel === false);
// crescendo 40%: 2027 soma 6.650.000, 554.166,67 por mês → até setembro 4.987.500 > 4.800.000 → fora a partir de outubro,
// sem a tolerância de 20%, que é só do excesso da própria receita (LC 123, art. 3º, §6º; Res. CGSN 140, art. 81, II, "c")
const v4 = calcularAno({ ...V2, crescimentoReceita: 40 }, 2027);
verdade('passa em setembro: fora a partir de outubro, sem a tolerância', v4.simples.disponivel === false && /setembro/.test(v4.simples.motivo) && /a partir de outubro/.test(v4.simples.motivo));
verdade('sem outras empresas, nenhum aviso de soma', !calcularAno({ atividades: [{ tipo: 'comercio', receita: 2400000 }] }, 2026).simples.avisos.some(a => /folga/.test(a)));
verdade('o aviso da soma: depois da saída, a receita dela segue somando enquanto for ME ou EPP (inciso III)', v2.simples.avisos.some(a => /enquanto ela for ME ou EPP/.test(a) && /III a V/.test(a)));

// ----------------------------------------------------------------------------------------------------------------
console.log('=== W · o RDA dos bares e restaurantes do RS (RICMS-RS, Livro I, art. 38-A) ===');
// restaurante de 3 milhões, 10% com ST, 12% com a base a 60%; compras de 1.050.000 a 12% (10% com ST, como as vendas).
// Débito e crédito: 3.000.000 × 90% × 60% × 12% = 194.400 − 1.050.000 × 90% × 12% × 60% = 68.040 → 126.360.
// RDA: 3,5% de todas as vendas de mercadoria, as com ST também: 105.000, sem crédito → o mais barato.
const W1 = { atividades: [{ tipo: 'comercio', receita: 3000000, pctST: 10, aliqIcms: 12, redIcms: 40 }], compras: 1050000, aliqCreditoIcms: 12, rda: 'melhor' };
const w1 = calcularAno(W1, 2026);
igual('RDA mais barato: o ICMS do Presumido', 105000, item(w1.presumido, 'ICMS'));
igual('... e o do Real', 105000, item(w1.real, 'ICMS'));
// PIS/Cofins cumulativo sobre a receita menos o ICMS do RDA (3,5% de tudo): 2.895.000 × 0,65% e × 3%
igual('PIS sobre a receita menos o ICMS do RDA', 18817.50, item(w1.presumido, 'PIS'));
igual('Cofins sobre a receita menos o ICMS do RDA', 86850, item(w1.presumido, 'Cofins'));
verdade('o aviso diz que a conta usou o RDA e quanto ficou a menos', w1.presumido.avisos.some(a => /RDA dos bares e restaurantes, o mais barato/.test(a) && /21\.360,00 a menos/.test(a)));
igual('sem o RDA: o débito e crédito', 126360, item(calcularAno({ ...W1, rda: null }, 2026).presumido, 'ICMS'));
// compras de 2.500.000: crédito 2.500.000 × 90% × 12% × 60% = 162.000 → débito e crédito 32.400, abaixo do RDA
const W2 = { ...W1, compras: 2500000 };
igual('débito e crédito mais barato: a conta fica com ele', 32400, item(calcularAno(W2, 2026).presumido, 'ICMS'));
igual('optante do RDA: 3,5% mesmo assim', 105000, item(calcularAno({ ...W2, rda: 'sim' }, 2026).presumido, 'ICMS'));
verdade('o aviso diz quanto o RDA daria', calcularAno(W2, 2026).presumido.avisos.some(a => /daria R\$\s105\.000,00/.test(a)));
// o Real: o PIS/Cofins não credita o ICMS que incidiu nas compras, antes do estorno da base reduzida (Lei 14.592/2023):
// débito (3.000.000 − 194.400) × 9,25% = 259.518 · crédito (2.500.000 − 270.000) × 9,25% = 206.275 → 53.243
const w2r = calcularAno({ ...W2, rda: null }, 2026).real;
igual('Real: PIS + Cofins sem o ICMS das compras de antes do estorno', 53243, item(w2r, 'PIS') + item(w2r, 'Cofins'));
verdade('o RDA não vale no Simples', calcularAno(W1, 2026).simples.itens.every(x => !/RDA/.test(x.tributo)) && !calcularAno(W1, 2026).simples.avisos.some(a => /RDA/.test(a)));

// ----------------------------------------------------------------------------------------------------------------
console.log('=== X · o Simples Gaúcho: abaixo de R$ 360 mil em 12 meses, o ICMS do DAS é isento no RS ===');
// o T1 no RS: 2026 com o RBT12 de 240.000 a 295.000 (2ª faixa) o ano todo — a fatia do ICMS (34%) sai inteira, e não só a
// da revenda com ST: Σ 25.000 × (7,3% − 5.940 ÷ RBT12) = 15.210,38 × (1 − 34% − 20% × 15,5%) = 9.567,33
const X1 = { ...T1, uf: 'RS' };
igual('2026: o ICMS do DAS isento (12 meses)', 9567.33, calcularAno(X1, 2026).simples.total);
verdade('o aviso do Simples Gaúcho', calcularAno(X1, 2026).simples.avisos.some(a => /Simples Gaúcho/.test(a) && /todos os meses/.test(a)));
// 2027: o RBT12 passa de 360.000 em dezembro (362.500): isento de janeiro a novembro, dezembro com o ICMS (contas à mão)
igual('2027: isento até novembro, dezembro com o ICMS', 13997.27, calcularAno(X1, 2027).simples.total);
verdade('sem a UF, a conta supõe o RS', Math.abs(calcularAno({ ...T1, uf: null }, 2026).simples.total - 9567.33) < 0.01);
// a isenção não soma com a redução da refeição: 240.000 no Anexo I, 2ª faixa → 11.580 de DAS pela tabela; no RS sai a
// fatia inteira do ICMS (34%): 7.642,80; fora do RS, a redução de 40% na fatia: 11.580 × (1 − 13,6%) = 10.005,12
const X2 = { atividades: [{ tipo: 'comercio', receita: 240000, aliqIcms: 12, redIcmsSimples: 40 }], receitaAnoAnterior: 240000 };
igual('restaurante pequeno no RS: a isenção, sem somar a redução', 7642.80, calcularAno({ ...X2, uf: 'RS' }, 2026).simples.das);
igual('fora do RS: só a redução de 40%', 10005.12, calcularAno({ ...X2, uf: 'SC' }, 2026).simples.das);

// ----------------------------------------------------------------------------------------------------------------
console.log('=== Y · LC 224: o excesso do ano rateado na proporção do excesso de cada trimestre (IN 2.305, art. 15, §5º, II) ===');
// 2,0 + 2,0 + 0,5 + 0,6 milhões: os trimestres pagaram 750 mil de excesso cada um nos dois primeiros (1,5 milhão); o
// excesso do ano é 100 mil → 1/15 de cada: 50 mil e 50 mil (antes, os 100 mil iam todos pro 1º)
verdade('rateio proporcional: 50 mil + 50 mil', excessosLc224([2000000, 2000000, 500000, 600000], 0).map(v => Math.round(v)).join(',') === '50000,50000,0,0');
// o excesso do ano maior que o dos trimestres anteriores: o último fica com a diferença (inciso III)
verdade('o último trimestre fica com a diferença', excessosLc224([1000000, 1000000, 1500000, 2500000], 0).map(v => Math.round(v)).join(',') === '0,0,0,1000000');

// ----------------------------------------------------------------------------------------------------------------
console.log('=== R · entradas inválidas ===');
let erro = null;
try { comparar({ atividades: [] }); } catch (e) { erro = e.message; }
verdade('sem receita: erro em português', /receita/.test(erro || ''));
erro = null;
try { comparar({ atividades: [{ tipo: 'comercio', receita: 1000 }], mix: { cheia: 50, red60: 20 } }); } catch (e) { erro = e.message; }
verdade('mix que não soma 100: erro', /mix/.test(erro || ''));

console.log('\n' + (total - falhas) + ' de ' + total + ' conferências ok' + (falhas ? ' — ' + falhas + ' FALHA(S)' : ''));
process.exit(falhas ? 1 : 0);
