// Teste obrigatório do motor da Reforma (caso "Drogaria Guerra" e, desde 12/10/2026, os exercícios do módulo
// Simuladores do curso: contabilidade, minimercado, indústria, advocacia, consultoria e a apuração do mês).
// Rodar com: node tests/rt-motor.test.mjs
// Tolerância: R$ 0,05 por linha (0,005 p.p. na alíquota). Os casos são a
// referência — se não bater, o motor está errado, não o teste.

import { simular, aliqEfetiva, anexo2027, faixaDe } from '../assets/js/rt-motor.js';

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
  // base cheia: aqui o teste é do lado do DAS; com a exclusão do ICMS/ISS (12/10/2026) o débito por fora acompanha o
  // ICMS do DAS, e por isso muda com a alíquota (conferido logo abaixo)
  const base = { anexo: 'I', rbt12: 1800000, receita: 100000, partilha: 15.5, cbs: 0.9, ibs: 0.1, mixCheia: 100, excluirIcmsIssDaBase: false };
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
  const ie = simular({ ...base, excluirIcmsIssDaBase: true, aliqEfetivaInformada: 12.5 });
  linha('com a exclusão: ICMS do DAS = 12,5% × 33,5%', 4187.50, ie.mes.icmsIssMes);
  linha('com a exclusão: débito sobre a receita sem ele', (100000 - 4187.50) * 0.01, ie.mes.debitoFora);
}
// ---- alíquota do PGDAS com parte do DAS excluída: a exclusão vale UMA vez (02/10/2026) ----
// O PGDAS já dá o DAS sem o ICMS/ST excluído; antes o motor descontava a exclusão de novo e o DAS de hoje saía
// 32% menor que o pago. Mesmo caso pelos dois caminhos: tabela + exclusão × alíquota do PGDAS + exclusão.
console.log('\nAlíquota do PGDAS com exclusão (ateliê, Anexo II, 32% do DAS excluído):');
{
  // ipiMantido: o teste é da exclusão aplicada uma vez, dentro do Anexo II; a passagem da indústria ao Anexo I em 2027
  // tem bloco próprio mais abaixo
  const base = { anexo: 'II', ipiMantido: true, rbt12: 1000000, receita: 100000, partilha: 14, cbs: 9.3, ibs: 0.1, mixCheia: 100, pctComprasDespesas: 3, pctExcluidoST: 32, pctPJ: 100 };
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
  // base cheia: o teste é do crédito do adquirente (art. 276); a exclusão do ICMS só encolhe a base dos dois lados
  const base = { anexo: 'I', rbt12: 1200000, receita: 100000, mixCheia: 20, mixRed40: 80, pctComprasMercadorias: 40,
    partilha: 15.5, cbs: 9.2, ibs: 0.1, pctPJ: 50, excluirIcmsIssDaBase: false };
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

// ============================================================================================================
// Módulo Simuladores do curso (12/10/2026): os seis exercícios rodados no motor. Os valores esperados são os do
// material ("Descontaminado": ICMS/ISS do DAS fora da base do débito por fora). Onde o material faz diferente, o bloco
// diz por quê. Leituras em reforma/base/simuladores/ (Projeto) — nada de material do curso neste repositório.
// ============================================================================================================
const sim = x => simular(x);

// ---- ICMS/ISS fora da base do débito por fora (LC 214, art. 12, §2º, V) ----
console.log('\nExercício 5 · advocacia (Anexo IV, 3ª faixa, redução de 30%, ISS de 40% do DAS fora da base):');
{
  const adv = { anexo: 'IV', rbt12: 720000, receita: 60000, mixRed30: 100, pctComprasMercadorias: 0, pctComprasDespesas: 5000 / 60000 * 100,
    pctImpostoEmbutido: 5, pctExcluidoST: 0, partilha: 24, cbs: 9.2, ibs: 0.1, pctPJ: 60 };
  const r = sim(adv);
  linha('ISS do DAS que sai da base', 2034.00, r.mes.icmsIssMes);
  linha('débito por fora (mês)', 3773.59, r.mes.debitoFora);
  linha('crédito das entradas (mês)', 441.75, r.mes.creditoEntradas);
  linha('custo por dentro', 33160.50, r.semestre.custoDentro);
  linha('custo por fora', 45829.12, r.semestre.custoFora);
  linha('crédito do cliente por fora', 22641.52, r.semestre.creditoClienteFora);
  linha('aproveitado a mais pela carteira', 9191.47, r.veredito.ganhoAproveitado);
  linha('carteira de virada (%)', 82.70, r.veredito.carteiraVirada, 0.005);
  linha('margem da decisão (%)', 27.45, r.veredito.margem, 0.005);
  const ok = r.veredito.tipo === 'MANTENHA' && !r.veredito.apertada; if (!ok) falhas++;
  console.log(ok ? '  ✓ NÃO OPTE (MANTENHA), com folga' : '  ✗ veredito ' + r.veredito.tipo);
  const cheia = sim({ ...adv, excluirIcmsIssDaBase: false });   // o estado "Contamino" do material
  linha('base cheia: débito', 3906.00, cheia.mes.debitoFora);
  linha('base cheia: diferença', 13463.10, cheia.semestre.diferenca);
}

console.log('\nExercício 6 · consultoria (Anexo V, 4ª faixa, ISS de 21% do DAS fora da base):');
{
  const r = sim({ anexo: 'V', rbt12: 900000, receita: 75000, mixCheia: 100, pctComprasMercadorias: 0, pctComprasDespesas: 10000 / 75000 * 100,
    pctImpostoEmbutido: 5, pctExcluidoST: 0, partilha: 19.15, cbs: 9.2, ibs: 0.1, pctPJ: 70 });
  linha('ISS do DAS que sai da base', 2929.50, r.mes.icmsIssMes);
  linha('débito por fora (mês)', 6702.56, r.mes.debitoFora);
  linha('custo por dentro', 89001.00, r.semestre.custoDentro);
  linha('custo por fora', 107886.79, r.semestre.custoFora);
  linha('aproveitado a mais pela carteira', 16930.75, r.veredito.ganhoAproveitado);
  linha('carteira de virada (%)', 78.08, r.veredito.carteiraVirada, 0.005);
  linha('margem da decisão (%)', 10.35, r.veredito.margem, 0.005);
  const ok = r.veredito.tipo === 'MANTENHA' && r.veredito.apertada && /decisão apertada/.test(r.veredito.frase); if (!ok) falhas++;
  console.log(ok ? '  ✓ NÃO OPTE, decisão apertada (margem abaixo de 15%)' : '  ✗ veredito/apertada: ' + r.veredito.tipo + ' ' + r.veredito.apertada);
}

console.log('\nExercício 4 · indústria (Anexo I em 2027, 5ª faixa, ICMS de 33,5% do DAS fora da base, 85% de clientes PJ):');
{
  const ind = { anexo: 'I', rbt12: 2400000, receita: 200000, mixCheia: 100, pctComprasMercadorias: 60, pctComprasDespesas: 5,
    pctImpostoEmbutido: 18, pctExcluidoST: 0, partilha: 15.5, cbs: 9.2, ibs: 0.1, pctPJ: 85 };
  const r = sim(ind);
  linha('ICMS do DAS que sai da base', 7143.88, r.mes.icmsIssMes);
  linha('base do débito', 192856.13, r.mes.baseDebito);
  linha('débito por fora (mês)', 17935.62, r.mes.debitoFora);
  linha('crédito das entradas (mês)', 9913.80, r.mes.creditoEntradas);
  linha('a recolher (mês)', 8021.82, r.meses[0].aRecolher);
  linha('custo por dentro', 187432.80, r.semestre.custoDentro);
  linha('custo por fora', 215731.47, r.semestre.custoFora);
  linha('crédito do cliente por fora', 107613.72, r.semestre.creditoClienteFora);
  linha('aproveitado pela carteira por fora', 91471.66, r.semestre.aproveitadoFora);
  linha('aproveitado a mais pela carteira', 74614.25, r.veredito.ganhoAproveitado);
  linha('carteira de virada (%)', 32.24, r.veredito.carteiraVirada, 0.005);
  linha('margem da decisão (%)', 163.67, r.veredito.margem, 0.005);
  const ok = r.veredito.tipo === 'OPTE_SE' && /o comercial confirma/.test(r.veredito.frase) && r.veredito.pontoEquilibrioPJ != null; if (!ok) falhas++;
  console.log(ok ? '  ✓ OPTE, SE O COMERCIAL CONFIRMAR (âmbar): o custo sobe, mas o crédito a mais da carteira supera a alta' : '  ✗ veredito ' + r.veredito.tipo + ': ' + r.veredito.frase);
  const c30 = sim({ ...ind, pctPJ: 30 });
  linha('carteira 30%: margem (%)', 6.94, c30.veredito.margem, 0.005);
  const ok30 = c30.veredito.tipo === 'MANTENHA' && c30.veredito.apertada; if (!ok30) falhas++;
  console.log(ok30 ? '  ✓ carteira de 30%: vira NÃO OPTE, decisão apertada' : '  ✗ carteira 30%: ' + c30.veredito.tipo);

  // INDÚSTRIA NO ANEXO I EM 2027 (LC 123, art. 18, §5º, red. LC 214): a mesma indústria lida de um PGDAS de 2026 no
  // Anexo II (alíquota da tabela II, partilha 14%) é calculada no Anexo I — dá os mesmos números do exercício
  const pg = sim({ ...ind, anexo: 'II', partilha: 14 });
  linha('PGDAS no Anexo II: DAS de hoje (tabela II)', 22275.00, pg.mes.dasHoje);
  linha('2027 no Anexo I: DAS por dentro', 21325.00, pg.mes.das2027);
  linha('2027 no Anexo I: partilha (%)', 15.50, pg.fatores.partilha2027, 0.005);
  linha('2027 no Anexo I: custo por dentro', 187432.80, pg.semestre.custoDentro);
  linha('2027 no Anexo I: custo por fora', 215731.47, pg.semestre.custoFora);
  const okA = pg.fatores.anexo2027 === 'I' && pg.fatores.mudouAnexo && pg.avisos.some(a => /Anexo II do PGDAS vira Anexo I/.test(a)); if (!okA) falhas++;
  console.log(okA ? '  ✓ Anexo II do PGDAS → Anexo I em 2027, com aviso' : '  ✗ conversão do anexo');
  const ipi = sim({ ...ind, anexo: 'II', partilha: 14, ipiMantido: true });   // o "e se seguisse no Anexo II" do material
  linha('IPI mantido: segue no Anexo II (custo por dentro)', 193132.80, ipi.semestre.custoDentro);
  const okI = ipi.fatores.anexo2027 === 'II' && !ipi.fatores.mudouAnexo; if (!okI) falhas++;
  console.log(okI ? '  ✓ IPI mantido (Zona Franca): o Anexo II continua' : '  ✗ IPI mantido');
  const okH = anexo2027('II') === 'I' && anexo2027('ii', true) === 'II' && anexo2027('III') === 'III' && faixaDe(1800000) === 3 && faixaDe(1800000.01) === 4; if (!okH) falhas++;
  console.log(okH ? '  ✓ anexo2027 e faixaDe' : '  ✗ anexo2027/faixaDe');
}

console.log('\nAteliê de calçados (PGDAS no Anexo II, 32% do DAS excluído — ICMS todo fora do DAS) passando ao Anexo I:');
{
  const r = sim({ anexo: 'II', rbt12: 1000000, receita: 100000, partilha: 14, cbs: 9.2, ibs: 0.1, mixCheia: 100, pctComprasDespesas: 3, pctExcluidoST: 32, pctPJ: 100, aliqEfetivaInformada: 6.086 });
  linha('DAS de hoje (o pago no PGDAS)', 6086.00, r.mes.dasHoje);
  linha('DAS cheio de 2027 no Anexo I (8,45%)', 8450.00, r.mes.dasCheio);
  linha('DAS por dentro de 2027: ICMS de 33,5% segue fora', 8450 * (1 - 0.335), r.mes.das2027);
  linha('parcela CBS/IBS (15,5% do cheio)', 1309.75, r.mes.parcelaCbsIbs);
  linha('sem ICMS no DAS, nada sai da base', 0, r.mes.icmsIssMes);
}

console.log('\nExercício 2 · minimercado (60% da receita com ICMS-ST; o ICMS próprio está na cesta básica):');
{
  const mini = { anexo: 'I', rbt12: 1200000, receita: 100000, mixCheia: 30, mixRed60: 30, mixZero: 40, pctComprasMercadorias: 65, pctComprasDespesas: 6,
    pctImpostoEmbutido: 18, pctExcluidoST: 20.1, partilha: 15.5, cbs: 9.2, ibs: 0.1, pctPJ: 5, creditoEstoqueMes: 1850 / 12 };
  const r = sim(mini);
  linha('ICMS próprio do DAS (40% sem ST × 33,5%)', 1182.55, r.mes.icmsIssMes);
  linha('DAS por dentro', 7051.18, r.mes.das2027);
  linha('crédito das entradas (mês)', 2539.46, r.mes.creditoEntradas);
  linha('custo por dentro', 57543.80, r.semestre.custoDentro);
  // o material põe o ICMS excluído na cesta básica (alíquota zero) e o débito não muda (3.906,00); o motor não sabe que
  // grupo do mix carrega o ICMS próprio e reparte a exclusão pelas vendas: 3.859,81. Com a base cheia, o do material
  linha('débito, exclusão repartida pelo mix', 3859.81, r.mes.debitoFora);
  const cheia = sim({ ...mini, excluirIcmsIssDaBase: false });
  linha('base cheia: débito = o do material', 3906.00, cheia.mes.debitoFora);
  linha('base cheia: custo por fora = o do material', 56764.97, cheia.semestre.custoFora);
  const ok = r.veredito.tipo === 'MANTENHA' && r.veredito.empate && cheia.veredito.empate; if (!ok) falhas++;
  console.log(ok ? '  ✓ empate técnico do escritório nos dois casos (o material diz OPTE: não tem limiar)' : '  ✗ veredito ' + r.veredito.tipo);
}

console.log('\nExercício 1 · contabilidade (Anexo III, ISS fixo por profissional, redução de 30%):');
{
  const ctb = { anexo: 'III', rbt12: 1800000, receita: 150000, mixRed30: 100, pctComprasMercadorias: 0, pctComprasDespesas: 8, pctImpostoEmbutido: 5,
    pctExcluidoST: 32.5, partilha: 16.6, cbs: 9.2, ibs: 0.1, pctPJ: 45, issFixo: true };
  const r = sim(ctb);
  linha('ISS fixo: nada do DAS sai da base', 0, r.mes.icmsIssMes);
  linha('DAS por dentro (sem o ISS)', 14195.25, r.mes.das2027);
  linha('débito por fora (mês)', 9765.00, r.mes.debitoFora);
  linha('crédito da despesa com ISS embutido', 1060.20, r.mes.creditoEntradas);
  // o material soma o ISS fixo (6 × R$ 1.000) nos dois lados; o motor não modela — a diferença é a mesma
  linha('diferença fora − dentro', 31282.92, r.semestre.diferenca);
  linha('aproveitado a mais pela carteira', 16939.85, r.veredito.ganhoAproveitado);
  linha('carteira de virada (%)', 83.10, r.veredito.carteiraVirada, 0.005);
  linha('margem da decisão (%)', 45.85, r.veredito.margem, 0.005);
  const ok = r.veredito.tipo === 'MANTENHA'; if (!ok) falhas++;
  console.log(ok ? '  ✓ NÃO OPTE (MANTENHA)' : '  ✗ veredito ' + r.veredito.tipo);
  const c84 = sim({ ...ctb, pctPJ: 84 });
  linha('84% no regime regular: margem (%)', 1.08, c84.veredito.margem, 0.005);
  const ok84 = c84.veredito.tipo === 'OPTE_SE' && c84.veredito.apertada; if (!ok84) falhas++;
  console.log(ok84 ? '  ✓ com 84% vira OPTE, SE O COMERCIAL CONFIRMAR — decisão apertada' : '  ✗ 84%: ' + c84.veredito.tipo);
  const semFixo = sim({ ...ctb, issFixo: false });
  linha('sem ISS fixo: o ISS do DAS (32,5%) sai da base', 21030 * 0.325, semFixo.mes.icmsIssMes);
}

console.log('\nISS no teto de 5% da receita (Anexo III, 5ª faixa, alíquota efetiva acima de 14,92537%):');
{
  const r = sim({ anexo: 'III', rbt12: 3500000, receita: 100000, mixCheia: 100, partilha: 15.6, cbs: 9.2, ibs: 0.1 });
  linha('ISS do DAS limitado a 5% da receita', 5000.00, r.mes.icmsIssMes);
}
console.log('\nAcima do sublimite (6ª faixa): ICMS/ISS fora do DAS — nada sai da base, com aviso:');
{
  const r = sim({ anexo: 'I', rbt12: 4000000, receita: 300000, mixCheia: 100, partilha: 34.02, cbs: 9.2, ibs: 0.1 });
  linha('ICMS do DAS', 0, r.mes.icmsIssMes);
  const ok = r.avisos.some(a => /sublimite/.test(a)); if (!ok) falhas++;
  console.log(ok ? '  ✓ avisa que a exclusão não entrou' : '  ✗ sem aviso do sublimite');
}

console.log('\nServiço sem compras, toda a receita de clientes PJ: o crédito a mais dos clientes é o próprio custo a mais (empate exato):');
{
  const r = sim({ anexo: 'III', rbt12: 150000, receita: 20000, mixCheia: 100, partilha: 15.6, cbs: 9.2, ibs: 0.1, pctPJ: 100, aliqEfetivaInformada: 6 });
  linha('aproveitado a mais = custo a mais', r.semestre.diferenca, r.veredito.ganhoAproveitado, 0.01);
  const ok = r.veredito.tipo === 'MANTENHA' && /ficam iguais/.test(r.veredito.frase); if (!ok) falhas++;
  console.log(ok ? '  ✓ MANTENHA: no conjunto ninguém ganha (sem "opte, se" por arredondamento)' : '  ✗ empate exato: ' + r.veredito.tipo + ' — ' + r.veredito.frase);
}

// ---- crédito das despesas por tipo (12/10/2026): o crédito é o IBS/CBS que o fornecedor destaca ----
console.log('\nApuração do mês (curso): serviço contábil com redução de 30% credita 70% (651,00, não 930,00):');
{
  const ap = { anexo: 'I', rbt12: 1800000, receita: 105000, mixCheia: 100, pctComprasMercadorias: 30000 / 105000 * 100, pctComprasDespesas: 10000 / 105000 * 100,
    pctImpostoEmbutido: 0, partilha: 15.5, cbs: 9.2, ibs: 0.1, excluirIcmsIssDaBase: false };
  const r = sim({ ...ap, pctDespesasComCredito: 70 });
  linha('créditos do mês (2.790 + 651)', 3441.00, r.mes.creditoEntradas);
  linha('débito − créditos', 6324.00, r.meses[0].aRecolher);
  linha('sem o campo: despesa credita cheio (como antes)', 2790 + 930, sim(ap).mes.creditoEntradas);
  let rejeita = false; try { sim({ ...ap, pctDespesasComCredito: 120 }); } catch (e) { rejeita = /crédito das despesas/.test(e.message); }
  if (!rejeita) falhas++;
  console.log(rejeita ? '  ✓ rejeita crédito das despesas fora de 0–100' : '  ✗ aceitou crédito das despesas acima de 100');
}

// ---- farmácia (exercício 3 = Drogaria Guerra): todo o ICMS é ST — nada sai da base ----
{
  const g = simular({ anexo: 'I', rbt12: 1800000, receita: 150000, mixCheia: 20, mixRed60: 70, mixRed30: 0, mixZero: 10,
    pctComprasMercadorias: 60, pctComprasDespesas: 8000 / 150000 * 100, pctImpostoEmbutido: 18, pctExcluidoST: 33.5, partilha: 15.5, cbs: 9.2, ibs: 0.1, pctPJ: 10, creditoEstoqueMes: 18500 / 12 });
  console.log('\nExercício 3 · farmácia (todo o ICMS em ST):');
  linha('ICMS próprio do DAS', 0, g.mes.icmsIssMes);
  linha('custo por fora = o do curso', 75843.17, g.semestre.custoFora);
}

process.exit(falhas ? 1 : 0);
