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

// ---- alíquotas de 2027 (03/10/2026): CBS = referência − 0,1 p.p. (ADCT art. 127 p.ú.) + IBS 0,10 = 9,30% ----
// O caso do curso soma tudo na CBS (9,30 + 0); a tela usa 9,20 + 0,10 — tem que dar o mesmo resultado.
console.log('\nAlíquotas de 2027 (CBS 9,20 + IBS 0,10 = 9,30% do caso):');
{
  const base = { anexo: 'I', rbt12: 1800000, receita: 150000, mixCheia: 20, mixRed60: 70, mixRed30: 0, mixZero: 10,
    pctComprasMercadorias: 90000 / 150000 * 100, pctComprasDespesas: 8000 / 150000 * 100, pctImpostoEmbutido: 18,
    pctExcluidoST: 33.5, partilha: 15.5, pctPJ: 10, creditoEstoqueMes: 18500 / 12 };
  const tela = simular({ ...base, cbs: 9.2, ibs: 0.1 });
  linha('custo dentro (9,20 + 0,10)', 79985.32, tela.semestre.custoDentro);
  linha('custo fora (9,20 + 0,10)', 75843.17, tela.semestre.custoFora);
  linha('diferença (9,20 + 0,10)', -4142.16, tela.semestre.diferenca);
}

// ---- PIS/COFINS monofásico (03/10/2026): a exclusão acaba em 2027 (Res. CGSN 140 art. 25 §6º, red. Res. 190) ----
// A mesma drogaria pelo PGDAS de 2026: hoje o DAS exclui o ICMS-ST (33,5%) e também o PIS/COFINS dos medicamentos
// (15,5%) = 49%. Em 2027 só a exclusão do ICMS-ST continua: o DAS por dentro volta aos 9.426,38 do curso.
console.log('\nMonofásico de PIS/COFINS (drogaria pelo PGDAS de 2026: 49% excluído, receita toda monofásica):');
{
  const base = { anexo: 'I', rbt12: 1800000, receita: 150000, mixCheia: 20, mixRed60: 70, mixRed30: 0, mixZero: 10,
    pctComprasMercadorias: 90000 / 150000 * 100, pctComprasDespesas: 8000 / 150000 * 100, pctImpostoEmbutido: 18,
    pctExcluidoST: 49, partilha: 15.5, cbs: 9.2, ibs: 0.1, pctPJ: 10, creditoEstoqueMes: 18500 / 12 };
  const mono = simular({ ...base, pctReceitaMonofasica: 100 });
  const semMono = simular(base);
  linha('DAS de hoje (2026)', 7229.25, mono.mes.dasHoje);
  linha('DAS por dentro de 2027', 9426.38, mono.mes.das2027);
  linha('DAS que sobra por fora', 7229.25, mono.mes.dasSobra);
  linha('custo dentro = o do curso', 79985.32, mono.semestre.custoDentro);
  linha('custo fora = o do curso', 75843.17, mono.semestre.custoFora);
  linha('caixa por dentro (6 × DAS 2027)', 56558.25, mono.semestre.caixaDentro);
  linha('sem o campo: DAS 2027 = o de hoje', 7229.25, semMono.mes.das2027);
  linha('a diferença não depende do campo', mono.semestre.diferenca, semMono.semestre.diferenca);
  const avisa = simular({ ...base, pctExcluidoST: 10, pctReceitaMonofasica: 100 });
  const okAviso = avisa.avisos.some(a => /monofásica/.test(a)) && Math.abs(avisa.mes.exclMono - 0.10) < 1e-9;
  if (!okAviso) falhas++;
  console.log(okAviso ? '  ✓ monofásico maior que o % excluído: avisa e limita ao excluído' : '  ✗ não limitou/avisou o monofásico acima do % excluído');
  let rejeita = false; try { simular({ ...base, pctReceitaMonofasica: 120 }); } catch (e) { rejeita = /monofásica/.test(e.message); }
  if (!rejeita) falhas++;
  console.log(rejeita ? '  ✓ rejeita % de receita monofásica fora de 0–100' : '  ✗ aceitou % monofásico acima de 100');
}

// ---- bar e restaurante (03/10/2026): a alimentação preparada (−40%) não gera crédito ao adquirente (LC 214 art. 276) ----
console.log('\nBar e restaurante (80% preparado com −40%, 20% bebida revendida à alíquota cheia):');
{
  const base = { anexo: 'I', rbt12: 1200000, receita: 100000, mixCheia: 20, mixRed40: 80, pctComprasMercadorias: 40,
    partilha: 15.5, cbs: 9.2, ibs: 0.1, pctPJ: 50 };
  const r = simular(base);
  linha('débito por fora (mês)', 6324.00, r.mes.debitoFora);                 // 100.000 × 9,3% × (0,2 + 0,8 × 0,6)
  linha('débito que o cliente credita (mês)', 1860.00, r.mes.debitoCreditavel); // só a parte cheia: 100.000 × 9,3% × 0,2
  linha('crédito do cliente por fora (semestre)', 11160.00, r.semestre.creditoClienteFora);
  linha('aproveitado pela carteira (50% PJ)', 5580.00, r.semestre.aproveitadoFora);
  const sohCheia = simular({ ...base, mixCheia: 100, mixRed40: 0 });
  linha('sem restaurante: crédito = débito', sohCheia.semestre.creditoClienteFora, 6 * sohCheia.mes.debitoFora);
  const okFrase = /art\. 276/.test(r.veredito.frase) && !/não há carteira de clientes/.test(r.veredito.frase);
  if (!okFrase) falhas++;
  console.log(okFrase ? '  ✓ frase cita o art. 276 sem dizer que nenhum cliente credita' : '  ✗ frase do veredito: ' + r.veredito.frase);
}

// ---- preço final mantido (sensibilidade, 03/10/2026): o imposto sai de dentro do preço ----
console.log('\nPreço final mantido (drogaria do curso, só como sensibilidade):');
{
  const base = { anexo: 'I', rbt12: 1800000, receita: 150000, mixCheia: 20, mixRed60: 70, mixRed30: 0, mixZero: 10,
    pctComprasMercadorias: 90000 / 150000 * 100, pctComprasDespesas: 8000 / 150000 * 100, pctImpostoEmbutido: 18,
    pctExcluidoST: 33.5, partilha: 15.5, cbs: 9.2, ibs: 0.1, pctPJ: 10, creditoEstoqueMes: 18500 / 12 };
  const p = simular({ ...base, precoFinalMantido: true });
  linha('débito ÷ 1,093', 6696 / 1.093, p.mes.debitoFora);
  linha('créditos das entradas ÷ 1,093', 3904.51 / 1.093, p.mes.creditoEntradas);
  linha('DAS por dentro não muda', 9426.38, p.mes.das2027);
  const padrao = simular(base);
  const ok = !padrao.fatores.precoFinalMantido && p.fatores.precoFinalMantido;
  if (!ok) falhas++;
  console.log(ok ? '  ✓ o padrão segue o método do curso; a variante fica marcada nos fatores' : '  ✗ marcação da variante');
}

process.exit(falhas ? 1 : 0);
