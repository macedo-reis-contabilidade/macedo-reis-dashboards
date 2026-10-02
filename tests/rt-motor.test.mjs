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
// ---- alíquota do PGDAS com parte do DAS excluída: a exclusão vale UMA vez (02/10/2026) ----
// O PGDAS já dá o DAS sem o ICMS/ST excluído; antes o motor descontava a exclusão de novo e o DAS de hoje saía
// 32% menor que o pago. Mesmo caso pelos dois caminhos: tabela + exclusão × alíquota do PGDAS + exclusão.
console.log('\nAlíquota do PGDAS com exclusão (ateliê, Anexo II, 32% do DAS excluído):');
{
  const base = { anexo: 'II', rbt12: 1000000, receita: 100000, partilha: 14, cbs: 9.3, ibs: 0.1, mixCheia: 100, pctComprasDespesas: 3, pctExcluidoST: 32, pctPJ: 100 };
  const tab = simular(base);                                        // tabela: 8,95%; DAS de hoje 8,95% × 68% = 6,086%
  const pgdas = simular({ ...base, aliqEfetivaInformada: 6.086 });  // o que o PGDAS mostra: DAS ÷ receita
  linha('tabela: alíquota (%)', 8.95, tab.aliqEfetiva * 100, 0.005);
  linha('PGDAS: DAS de hoje = o pago', 6086.00, pgdas.mes.dasHoje);
  linha('PGDAS: DAS cheio reconstituído', 8950.00, pgdas.mes.dasCheio);
  linha('PGDAS: parcela CBS/IBS (14% do cheio)', 1253.00, pgdas.mes.parcelaCbsIbs);
  linha('DAS de hoje igual pelos dois', tab.mes.dasHoje, pgdas.mes.dasHoje);
  linha('custo por dentro igual pelos dois', tab.semestre.custoDentro, pgdas.semestre.custoDentro);
  linha('custo por fora igual pelos dois', tab.semestre.custoFora, pgdas.semestre.custoFora);
  const semAviso = !pgdas.avisos.some(a => /2 pontos longe/.test(a));
  if (!semAviso) falhas++;
  console.log(semAviso ? '  ✓ sem aviso de "2 pontos longe da tabela" (a comparação é pela alíquota cheia)' : '  ✗ avisou longe da tabela por causa da exclusão');
  const longe = simular({ ...base, aliqEfetivaInformada: 9.0 }).avisos.some(a => /2 pontos longe/.test(a));
  if (!longe) falhas++;
  console.log(longe ? '  ✓ ainda avisa quando a informada, sem a exclusão, foge da tabela (9% ÷ 68% = 13,2% × 8,95%)' : '  ✗ não avisou a informada fora da tabela');
}

process.exit(falhas ? 1 : 0);
