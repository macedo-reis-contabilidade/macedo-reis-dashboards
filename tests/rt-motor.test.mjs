// Teste obrigatório do motor da Reforma (caso "Drogaria Guerra").
// Rodar com: node tests/rt-motor.test.mjs
// Tolerância: R$ 0,05 por linha (0,005 p.p. na alíquota). O caso é a
// referência — se não bater, o motor está errado, não o teste.

import { simular, aliqEfetiva } from '../assets/js/rt-motor.js';

const r = simular({
  anexo: 'I',
  rbt12: 1800000,
  receita: 150000,
  mixCheia: 20, mixRed60: 70, mixRed30: 0, mixZero: 10,
  pctComprasMercadorias: 90000 / 150000 * 100,  // 60% da receita
  pctComprasDespesas: 8000 / 150000 * 100,      // 5,33% da receita
  pctImpostoEmbutido: 18,
  pctExcluidoST: 33.5,
  partilha: 15.5,
  cbs: 9.3, ibs: 0,                              // o caso usa 9,30 total
  pctPJ: 10,
  creditoEstoqueMes: 1541.67                     // a partir de fev (5 parcelas)
});

let falhas = 0;
function linha(nome, esperado, obtido, tol = 0.05) {
  const ok = Math.abs(esperado - obtido) <= tol;
  if (!ok) falhas++;
  console.log(
    (ok ? '  ok ' : 'FALHA') + '  ' + nome.padEnd(28) +
    ' esperado ' + String(esperado.toFixed(2)).padStart(12) +
    '  ×  obtido ' + String(obtido.toFixed(2)).padStart(12)
  );
}

console.log('=== rt-motor · caso Drogaria Guerra (anexo I · RBT12 1.800.000) ===');
console.log('--- mês (janeiro) ---');
linha('aliqEfetiva (%)', 9.45, r.aliqEfetiva * 100, 0.005);
linha('DAScheio', 14175.00, r.mes.dasCheio);
linha('DAShoje', 9426.38, r.mes.dasHoje);
linha('parcelaCbsIbs', 2197.13, r.mes.parcelaCbsIbs);
linha('DASsobra', 7229.25, r.mes.dasSobra);
linha('debitoFora', 6696.00, r.mes.debitoFora);
linha('creditoEntradas', 3904.51, r.mes.creditoEntradas);
linha('aRecolher (jan)', 2791.49, r.meses[0].aRecolher);
console.log('--- semestre (jan–jun/2027) ---');
linha('custoDentro', 79985.32, r.semestre.custoDentro);
linha('custoFora', 75843.17, r.semestre.custoFora);
linha('creditoClienteDentro', 13182.75, r.semestre.creditoClienteDentro);
linha('creditoClienteFora', 40176.00, r.semestre.creditoClienteFora);

const veredOk = r.veredito.tipo === 'OPTE';
if (!veredOk) falhas++;
console.log((veredOk ? '  ok ' : 'FALHA') + '  veredito'.padEnd(33) + ' esperado         OPTE  ×  obtido ' + r.veredito.tipo.padStart(12));

// sanidade extra da função exportada isolada
const aeOk = Math.abs(aliqEfetiva('I', 1800000) * 100 - 9.45) <= 0.005;
if (!aeOk) falhas++;
console.log((aeOk ? '  ok ' : 'FALHA') + '  aliqEfetiva(\'I\', 1.800.000)  esperado         9.45  ×  obtido ' + (aliqEfetiva('I', 1800000) * 100).toFixed(4).padStart(12));

console.log(falhas ? '\n✗ ' + falhas + ' linha(s) fora da tolerância' : '\n✓ todas as linhas dentro da tolerância de R$ 0,05');
process.exit(falhas ? 1 : 0);
