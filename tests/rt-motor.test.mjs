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
// ---- alíquota efetiva informada (PGDAS) vale sobre a tabela ----
console.log('\nAlíquota efetiva informada:');
{
  const base = { anexo: 'I', rbt12: 1800000, receita: 100000, partilha: 15.5, cbs: 0.9, ibs: 0.1, mixCheia: 100 };
  const t = simular(base), i = simular({ ...base, aliqEfetivaInformada: 12.5 });
  linha('tabela (%)', 9.45, t.aliqEfetiva * 100, 0.005);
  linha('informada (%)', 12.5, i.aliqEfetiva * 100, 0.005);
  linha('DAS cheio sobe na proporção', 100000 * 0.125, i.mes.dasCheio, 0.01);
  linha('parcela CBS/IBS acompanha', 100000 * 0.125 * 0.155, i.mes.parcelaCbsIbs, 0.01);
  linha('fora não muda', t.mes.debitoFora, i.mes.debitoFora, 0.001);
  console.log(i.fatores.aliqFonte === 'informada' && Math.abs(i.fatores.aliqTabela - 0.0945) < 0.0001 ? '  ✓ fatores registram fonte e tabela' : '  ✗ fatores');
  console.log(i.avisos.some(a => /2 pontos longe/.test(a)) ? '  ✓ avisa quando a informada foge muito da tabela' : '  ✗ aviso da diferença');
  let erro = null; try { simular({ ...base, aliqEfetivaInformada: 0 }); } catch (e) { erro = e; }
  console.log(erro ? '  ✓ rejeita alíquota informada fora de 0–35%' : '  ✗ aceitou 0%');
}

process.exit(falhas ? 1 : 0);
