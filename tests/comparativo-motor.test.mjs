// Teste do motor do comparativo tributário (Simples × Presumido × Real).
// Rodar com: node tests/comparativo-motor.test.mjs
// Os valores esperados são contas feitas à mão pelas tabelas da lei (LC 123, Anexos I a V; Lei 9.249; Lei 9.430;
// Leis 9.718, 10.637 e 10.833; Lei 8.212; LC 224/2025; Lei 14.973/2024; LC 214 e Res. CGSN 190/2026), escritas
// do lado de cada caso. Tolerância: R$ 0,01 por linha. Se não bater, o motor está errado, não o teste.

import { comparar, calcularAno, normalizar, testarPremissas, irpjCsllReal, fraseDaDecisao } from '../assets/js/comparativo-motor.js';

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
const M = { atividades: [{ tipo: 'industria', receita: 10000000 }], folha: 1000000, cprb: 1.5, rat: 2, terceiros: 5.8 };
const m26 = calcularAno(M, 2026), m27 = calcularAno(M, 2027), m28 = calcularAno(M, 2028);
igual('2026: CPP 50% (1.000.000 × 20% × 0,5)', 100000, m26.presumido.inss.cpp);
igual('2026: CPRB 60% (10.000.000 × 1,5% × 0,6)', 90000, m26.presumido.inss.cprb);
igual('2027: CPP 75%', 150000, m27.presumido.inss.cpp);
igual('2027: CPRB 40%', 60000, m27.presumido.inss.cprb);
igual('2028: CPP cheia', 200000, m28.presumido.inss.cpp);
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
console.log('=== R · entradas inválidas ===');
let erro = null;
try { comparar({ atividades: [] }); } catch (e) { erro = e.message; }
verdade('sem receita: erro em português', /receita/.test(erro || ''));
erro = null;
try { comparar({ atividades: [{ tipo: 'comercio', receita: 1000 }], mix: { cheia: 50, red60: 20 } }); } catch (e) { erro = e.message; }
verdade('mix que não soma 100: erro', /mix/.test(erro || ''));

console.log('\n' + (total - falhas) + ' de ' + total + ' conferências ok' + (falhas ? ' — ' + falhas + ' FALHA(S)' : ''));
process.exit(falhas ? 1 : 0);
