// Teste da simulação explicada da Reforma (assets/js/rt-explicado.js, 17/11/2026): o resultado do motor em palavras e em
// reais, que a ficha do caso mostra no bloco B — o veredito, o ponto em que a conta muda pela parte das vendas para
// empresas, os dois caminhos lado a lado, a conta passo a passo e o resumo pra copiar.
// Rodar com: node tests/rt-explicado.test.mjs
// O módulo não faz conta nova: lê o que o rt-motor.js devolve. O que este teste garante é que o texto diz o que o motor
// calculou — toda igualdade escrita num passo fecha (as "provas"), em qualquer ramo do motor (2.500 empresas sorteadas).

import { simular } from '../assets/js/rt-motor.js';
import { zonasDaCarteira, vereditoEmPalavras, quadroDosCaminhos, linhasDosCaminhos, passosDaConta, premissasDaConta, resumoParaCopiar,
  leituraDaRegua, tipoDoResultado, pctsDistintos, textoDe, brl, pct, NOME_ZONA } from '../assets/js/rt-explicado.js';

let falhas = 0;
const ok = (cond, msg) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + msg); };
const sem = t => String(t).replace(/\u00a0/g, ' ');   // o R$ vem com o espaço que não quebra
const perto = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;
const tudo = ent => { const r = simular(ent), z = zonasDaCarteira(ent); return { r, z, v: vereditoEmPalavras(r, ent, z), q: quadroDosCaminhos(r, ent) }; };

const CASOS = {
  // exercício da indústria do curso (PGDAS no Anexo II, 85% de clientes PJ), com a CBS de estudo de 9,20
  industria: { anexo: 'II', rbt12: 2400000, receita: 200000, mixCheia: 100, pctComprasMercadorias: 60, pctComprasDespesas: 5, pctImpostoEmbutido: 18, pctExcluidoST: 0, partilha: 14, cbs: 9.2, ibs: 0.1, pctPJ: 85 },
  consultoria: { anexo: 'V', rbt12: 900000, receita: 75000, mixCheia: 100, pctComprasMercadorias: 0, pctComprasDespesas: 13.333333, pctImpostoEmbutido: 5, pctExcluidoST: 0, partilha: 19.15, cbs: 11.2, ibs: 0.1, pctPJ: 70 },
  // a farmácia do curso (Drogaria Guerra), o caso do rt-motor.test.mjs
  farmacia: { anexo: 'I', rbt12: 1800000, receita: 150000, mixCheia: 20, mixRed60: 70, mixZero: 10, pctComprasMercadorias: 60, pctComprasDespesas: 8000 / 150000 * 100, pctImpostoEmbutido: 18, pctExcluidoST: 33.5, partilha: 15.5, cbs: 9.3, ibs: 0, pctPJ: 10, creditoEstoqueMes: 1541.67 },
  loja: { anexo: 'I', rbt12: 600000, receita: 50000, mixCheia: 100, pctComprasMercadorias: 50, partilha: 15.5, cbs: 11.2, ibs: 0.1, pctPJ: 0 },
  restaurante: { anexo: 'I', rbt12: 900000, receita: 75000, mixCheia: 15, mixRed40: 85, pctComprasMercadorias: 40, partilha: 15.5, cbs: 11.2, ibs: 0.1, pctPJ: 5 },
  pgdas: { anexo: 'I', rbt12: 1200000, receita: 100000, mixCheia: 100, aliqEfetivaInformada: 6.1, pctExcluidoST: 32, pctReceitaMonofasica: 20, pctComprasMercadorias: 55, pctImpostoEmbutido: 12, partilha: 15.5, cbs: 11.2, ibs: 0.1, pctPJ: 40 }
};

console.log('=== rt-explicado · o veredito e o ponto em que a conta muda ===');
{
  const { r, z, v } = tudo(CASOS.loja);
  ok(v.chave === 'dentro' && v.titulo === 'Fique no DAS', 'loja que vende ao consumidor: "Fique no DAS"');
  ok(sem(textoDe(v.porque)) === 'Pagar a CBS e o IBS por fora custaria ' + sem(brl(r.semestre.diferenca)) + ' a mais de janeiro a junho de 2027, perto de ' + sem(brl(r.semestre.diferenca / 6)) + ' por mês.',
    'o porquê traz a diferença do motor no semestre e por mês (' + sem(textoDe(v.porque)) + ')');
  ok(v.porque.some(x => x.b && sem(x.b) === sem(brl(r.semestre.diferenca)) + ' a mais'), 'o valor da diferença é o trecho em negrito');
  ok(z.faixas.length === 2 && z.faixas[0].k === 'dentro' && z.faixas[1].k === 'se' && z.faixas[0].de === 0 && z.faixas[1].ate === 100, 'a régua tem duas faixas: fica no DAS e, depois, depende dos clientes');
  ok(perto(z.viradas[0].em, r.veredito.carteiraVirada, 0.001), 'o ponto da virada é a carteira de virada do motor (' + z.viradas[0].em.toFixed(4) + '% × ' + r.veredito.carteiraVirada + '%)');
  ok(v.depois === 'A conta muda se 43% ou mais das vendas forem para empresas que usam o crédito. Hoje: 0%.', 'a frase da régua diz onde muda e quanto é hoje (' + v.depois + ')');
  ok(v.vira && v.vira.texto === '43%' && v.hoje === '0%', 'o veredito devolve o ponto e o "hoje" já escritos');
  ok(leituraDaRegua(z, 0) === 'De 0% a 43% das vendas para empresas que usam o crédito: fica no DAS. De 43% a 100%: depende dos clientes. Hoje: 0%.', 'a leitura da régua em uma frase, pro leitor de tela');
}
{
  const { r, z, v } = tudo(CASOS.industria);
  ok(r.veredito.tipo === 'OPTE_SE' && v.chave === 'se' && v.titulo === 'Depende dos clientes', 'indústria do curso com 85% de clientes PJ: "Depende dos clientes"');
  ok(sem(textoDe(v.porque)) === 'Por fora a empresa paga R$ 28.298,67 a mais de janeiro a junho de 2027, mas os clientes empresa descontam ' + sem(brl(r.veredito.ganhoAproveitado)) + ' a mais de crédito.',
    'o custo a mais do curso (R$ 215.731,47 − R$ 187.432,80 = R$ 28.298,67) e o crédito a mais dos clientes');
  ok(/comercial que confirma/.test(v.nota), 'a nota diz que é o comercial que confirma');
  ok(perto(z.viradas[0].em, 32.2376, 0.001) && v.depois.startsWith('Com menos de 32,2% das vendas para empresas que usam o crédito, o melhor é ficar no DAS. Hoje: 85%.'), 'abaixo de 32,2% o melhor é ficar no DAS (a virada do curso)');
}
{
  const { r, v } = tudo(CASOS.consultoria);
  ok(r.veredito.tipo === 'MANTENHA' && r.veredito.apertada && v.tags.length === 1 && v.tags[0].startsWith('Decisão apertada'), 'consultoria com 70% de PJ: "Fique no DAS" com a etiqueta de decisão apertada');
  ok(v.depois === 'A conta muda se 80,4% ou mais das vendas forem para empresas que usam o crédito. Hoje: 70%.', 'e o ponto em que muda (' + v.depois + ')');
}
{
  const { r, z, v } = tudo(CASOS.farmacia);
  ok(r.veredito.tipo === 'OPTE' && v.chave === 'fora' && v.titulo === 'Vale pagar por fora', 'farmácia do curso: "Vale pagar por fora"');
  ok(z.faixas.length === 1 && z.faixas[0].k === 'fora' && v.vira === null && v.depois === 'Vale por fora com qualquer parte das vendas para empresas.', 'vale por fora de 0 a 100%: uma faixa só, sem ponto de virada');
  ok(/cai R\$ 4\.142,1\d de janeiro a junho de 2027/.test(sem(textoDe(v.porque))), 'a economia do caso do curso (R$ 4.142,17)');
  ok(sem(v.nota) === 'E os clientes empresa passam a descontar mais crédito: R$ 669,60 por mês, contra R$ 219,71 por dentro.', 'e a nota do crédito a mais dos clientes: o das notas (R$ 6.696,00 e R$ 2.197,13) vezes os 10% vendidos a empresas (' + sem(v.nota) + ')');
}
{
  const { z, v } = tudo(CASOS.restaurante);
  ok(z.faixas.length === 1 && v.depois.includes('a alimentação preparada no bar ou restaurante não dá crédito a quem compra (LC 214, art. 276)'), 'restaurante: vender mais para empresas não muda a conta, com o porquê');
}
{
  // empate técnico: por fora sai um pouco mais barato, abaixo do limiar
  const ent = { anexo: 'I', rbt12: 30000, receita: 2000, mixZero: 100, pctPJ: 0, partilha: 15.5, cbs: 9.2, ibs: 0.1 };
  const { r, v } = tudo(ent);
  ok(r.veredito.empate && r.semestre.diferenca < 0 && v.titulo === 'Empate: fique no DAS' && /seria só R\$ .* menor no semestre/.test(sem(textoDe(v.porque))) && sem(textoDe(v.porque)).includes('R$ 1.000,00'),
    'empate técnico: "Empate: fique no DAS", com a diferença e o limiar de R$ 1.000,00');
  // os dois caminhos com o mesmo custo (tudo com alíquota zero, sem compras e sem CBS e IBS no DAS): sem "custaria R$ 0,00 a mais"
  const igual = { anexo: 'I', rbt12: 600000, receita: 50000, mixZero: 100, partilha: 0, cbs: 11.2, ibs: 0.1, pctPJ: 0 };
  const e = tudo(igual);
  ok(Math.abs(e.r.semestre.diferenca) < 0.005 && e.v.titulo === 'Empate: fique no DAS' && sem(textoDe(e.v.porque)).startsWith('Os dois caminhos saem pelo mesmo custo') && !/R\$ 0,00 a mais/.test(sem(textoDe(e.v.porque))),
    'custo igual nos dois caminhos: "Empate: fique no DAS", sem escrever "R$ 0,00 a mais"');
  ok(linhasDosCaminhos(e.q, 'mes').diferenca === 'Os dois caminhos saem pelo mesmo valor por mês.' && !linhasDosCaminhos(e.q, 'mes').dentro.selo, 'e nenhum caminho leva o "menor custo"');
}
{
  // economia abaixo do limiar que só não é empate porque o crédito a mais dos clientes passa dele (a regra do motor): a
  // explicação tem de dizer isso — senão fica "vale por fora" por R$ 540 sem porquê
  const ent = { ...CASOS.farmacia, cbs: 11.2, ibs: 0.1, pctComprasDespesas: 5.333333, pctExcluidoST: 49, pctReceitaMonofasica: 100 };
  const { r, v } = tudo(ent);
  const lim = r.veredito.limiarEmpate, dif = Math.abs(r.semestre.diferenca);
  ok(r.veredito.tipo === 'OPTE' && dif < lim && r.veredito.ganhoAproveitado >= lim, 'farmácia com 10% de clientes PJ: por fora por ' + sem(brl(dif)) + ', abaixo do limiar de ' + sem(brl(lim)) + ', com os clientes ganhando ' + sem(brl(r.veredito.ganhoAproveitado)));
  ok(sem(v.nota) === 'A economia da empresa é pequena, abaixo dos R$ 2.700,00 que o escritório considera para mudar de regime. O que pesa é o crédito dos clientes empresa: eles descontam ' + sem(brl(r.veredito.ganhoAproveitado)) + ' a mais no semestre.',
    'a nota diz que a economia é pequena e que quem decide é o crédito dos clientes');
  const p9 = passosDaConta(r, ent).passos[8];
  ok(sem(p9.nota).includes('é empate, a não ser que os clientes empresa ganhem mais do que isso em crédito. Aqui a diferença é menor, mas eles descontam ' + sem(brl(r.veredito.ganhoAproveitado)) + ' a mais: não é empate.'),
    'e o passo 9 explica por que não é empate');
  ok(!passosDaConta(simular(CASOS.loja), CASOS.loja).passos[8].nota.includes('Aqui a diferença é menor'), 'com a diferença acima do limiar, o passo 9 não leva essa frase');
}
{
  // "depende dos clientes" com crédito sobrando por fora (o crédito de estoque passa do imposto das vendas de fevereiro a
  // junho): o que a empresa paga a mais e o custo a mais são números diferentes. O veredito fala do custo, que é a diferença
  // do motor, e não escreve "paga"; quem diz o que se paga, e fecha a conta com a sobra, é a frase dos dois caminhos
  const ent = { anexo: 'I', rbt12: 1200000, receita: 100000, mixCheia: 100, pctComprasMercadorias: 10, partilha: 15.5, cbs: 11.2, ibs: 0.1, pctPJ: 50, creditoEstoqueMes: 9900 };
  const { r, v, q } = tudo(ent);
  ok(r.veredito.tipo === 'OPTE_SE' && q.fora.sobra > 100 && r.semestre.diferenca > 0 && perto(q.fora.total - q.dentro.total, r.semestre.diferenca + q.fora.sobra),
    'depende dos clientes com crédito sobrando: a empresa paga ' + sem(brl(q.fora.total - q.dentro.total)) + ' a mais, sobram ' + sem(brl(q.fora.sobra)) + ' e o custo a mais é ' + sem(brl(r.semestre.diferenca)));
  ok(sem(textoDe(v.porque)) === 'Por fora o custo da empresa fica ' + sem(brl(r.semestre.diferenca)) + ' maior de janeiro a junho de 2027, já contando o crédito que sobra, mas os clientes empresa descontam ' + sem(brl(r.veredito.ganhoAproveitado)) + ' a mais de crédito.',
    'o veredito fala do custo, já com o crédito que sobra (' + sem(textoDe(v.porque)) + ')');
  ok(sem(linhasDosCaminhos(q, 'semestre').diferenca) === 'Por fora a empresa paga ' + sem(brl(q.fora.total - q.dentro.total)) + ' a mais no semestre e fica com ' + sem(brl(q.fora.sobra)) + ' de crédito para abater depois. Contando esse crédito, o caminho por fora sai ' + sem(brl(r.semestre.diferenca)) + ' mais caro.',
    'e a frase dos dois caminhos liga o que se paga ao custo do veredito');
  const semSobra = { ...ent, creditoEstoqueMes: 9000 }, t2 = tudo(semSobra);
  ok(t2.r.veredito.tipo === 'OPTE_SE' && t2.q.fora.sobra < 0.005 && sem(textoDe(t2.v.porque)).startsWith('Por fora a empresa paga ' + sem(brl(t2.r.semestre.diferenca)) + ' a mais de janeiro a junho de 2027, mas os clientes empresa descontam '),
    'sem crédito sobrando, o que a empresa paga a mais é o custo a mais: a frase segue com "paga"');
}
{
  // o ponto da virada e o "hoje" quase iguais: os dois nunca saem com o mesmo texto
  const base = CASOS.loja, vira = zonasDaCarteira(base).viradas[0].em;
  const ent = { ...base, pctPJ: vira - 0.004 };
  const { r, v } = tudo(ent);
  ok(tipoDoResultado(r) === 'dentro' && v.vira.texto !== v.hoje, 'a 0,004 ponto da virada: "' + v.depois + '"');
  ok(pctsDistintos(43.006, 43).join(' · ') === '43,01% · 43%' && pctsDistintos(43.2, 35).join(' · ') === '43,2% · 35%' && pctsDistintos(50, 50).join(' · ') === '50% · 50%', 'pctsDistintos: só usa mais casas quando precisa');
}

console.log('=== rt-explicado · sem conclusão e a confirmar ===');
{
  const ent = CASOS.industria, r = simular(ent), z = zonasDaCarteira(ent);
  const v = vereditoEmPalavras(r, ent, z, { conclusao: 'sem_conclusao' });
  ok(v.chave === 'semconc' && v.titulo === 'Sem conclusão' && v.semConclusao && v.tags.length === 0, 'sem conclusão: o título não recomenda nada');
  ok(v.provisorio && v.provisorio.titulo === 'Depende dos clientes' && v.provisorio.chave === 'se', 'a conta fica guardada como provisória, só de referência');
  const l = linhasDosCaminhos(quadroDosCaminhos(r, ent), 'mes', { semConclusao: true });
  ok(![l.dentro.selo, l.fora.selo].some(s => s && s.tipo === 'ok'), 'sem conclusão: nenhum caminho leva o "menor custo"');
  ok(resumoParaCopiar({ r, ent, veredito: v }) === '', 'sem conclusão: não há resumo pra copiar');
  const c = vereditoEmPalavras(r, ent, z, { conclusao: 'a_confirmar' });
  ok(c.titulo === 'Depende dos clientes' && c.tags.includes('A confirmar'), 'a confirmar: o resultado fica, com a etiqueta');
  const resumo = resumoParaCopiar({ r, ent, veredito: c, empresa: 'EMPRESA DE TESTE LTDA', hoje: '17/11/2026', faltam: ['as notas de compra dos últimos meses'] });
  ok(resumo.includes('Este resultado ainda depende de confirmar: as notas de compra dos últimos meses.'), 'e o resumo diz o que falta confirmar');
}

console.log('=== rt-explicado · os dois caminhos ===');
{
  const { r, q } = tudo(CASOS.loja);
  const mes = linhasDosCaminhos(q, 'mes'), sem6 = linhasDosCaminhos(q, 'semestre');
  ok(sem(mes.dentro.total) === 'R$ 3.595,00' && sem(sem6.dentro.total) === 'R$ 21.570,00' && mes.sufixo === 'por mês' && sem6.sufixo === 'no semestre', 'loja: por dentro paga R$ 3.595,00 por mês e R$ 21.570,00 no semestre (600 mil a 7,19%)');
  ok(sem(mes.fora.total) === sem(brl(r.semestre.caixaFora / 6)) && mes.fora.linhas.map(x => x.rotulo).join(' | ') === 'DAS sem a CBS e o IBS | CBS e IBS das vendas | Crédito das compras | CBS e IBS a pagar', 'por fora: o DAS que sobra, o imposto das vendas, o crédito das compras e o que fica a pagar');
  ok(mes.dentro.selo && mes.dentro.selo.texto === 'menor custo' && mes.fora.selo === null && mes.rotuloCliente === 'Crédito dos clientes empresa (hoje, sem vendas para empresas)' && sem(mes.fora.cliente) === 'R$ 0,00',
    'sem vendas para empresas: o menor custo fica por dentro, ninguém desconta crédito e nenhum caminho leva o selo do crédito ao cliente');
  const com35 = { ...CASOS.loja, pctPJ: 35 }, l35 = linhasDosCaminhos(quadroDosCaminhos(simular(com35), com35), 'mes');
  ok(l35.rotuloCliente === 'Crédito dos clientes empresa (35% das vendas)' && sem(l35.dentro.cliente) === 'R$ 195,03' && sem(l35.fora.cliente) === 'R$ 1.929,87' && l35.fora.selo && l35.fora.selo.texto === 'mais crédito ao cliente',
    'com 35% das vendas para empresas: elas descontam R$ 195,03 por dentro e R$ 1.929,87 por fora (35% dos R$ 557,23 e dos R$ 5.513,91 das notas), e o selo vai por fora');
  const p10 = passosDaConta(simular(com35), com35).passos[9], p10zero = passosDaConta(r, CASOS.loja).passos[9];
  ok(sem(textoDe(p10.formula)) === 'Por dentro: R$ 557,23 × 35% = R$ 195,03 por mês · Por fora: R$ 5.513,91 × 35% = R$ 1.929,87 por mês' && sem(p10.nota).includes('No semestre, elas descontam ' + sem(brl(simular(com35).veredito.ganhoAproveitado)) + ' a mais se a empresa for por fora.'),
    'o passo 10 mostra a conta do crédito dos clientes (' + sem(textoDe(p10.formula)) + ')');
  ok(sem(textoDe(p10zero.formula)) === 'Nas notas de todas as vendas: R$ 557,23 por mês por dentro · R$ 5.513,91 por mês por fora' && p10zero.nota.startsWith('Hoje a ficha não tem vendas para empresas que usam o crédito'),
    'e, sem vendas para empresas, só o crédito das notas, dizendo que ninguém desconta');
  ok(sem(mes.diferenca) === 'Por fora a empresa paga ' + sem(brl(r.semestre.diferenca / 6)) + ' a mais por mês.' && mes.fora.largura === 100 && mes.dentro.largura < 100, 'a frase da diferença e a barra de cada caminho na proporção do que se paga');
}
{
  // crédito maior que o imposto das vendas: sobra crédito, e a diferença do veredito é a de caixa menos a sobra
  const ent = { anexo: 'I', rbt12: 1500000, receita: 125000, mixCheia: 30, mixZero: 70, pctComprasMercadorias: 85, pctComprasComCredito: 90, partilha: 15.5, cbs: 11.2, ibs: 0.1, pctPJ: 0 };
  const { r, q } = tudo(ent);
  ok(q.fora.sobra > 1000 && perto(q.fora.total - q.dentro.total - q.fora.sobra, r.semestre.diferenca), 'com crédito sobrando: caixa por fora − caixa por dentro − sobra = a diferença de custo do motor');
  const l = linhasDosCaminhos(q, 'semestre');
  ok(sem(l.diferenca).includes('e fica com ' + sem(brl(q.fora.sobra)) + ' de crédito para abater depois. Contando esse crédito, o caminho por fora sai ' + sem(brl(Math.abs(r.semestre.diferenca))) + (r.semestre.diferenca < 0 ? ' mais barato.' : ' mais caro.')),
    'a frase fecha com o saldo, que é a diferença do veredito (' + sem(l.diferenca) + ')');
  const p8 = passosDaConta(r, ent).passos[7];
  ok(sem(textoDe(p8.formula)).includes('o crédito é maior. Nada a pagar, e sobram ') && !/= R\$ 0,00/.test(sem(textoDe(p8.formula))), 'o passo 8 não escreve "débito − crédito = R$ 0,00": diz que o crédito é maior e quanto sobra');
}
{
  const { q } = tudo(CASOS.farmacia);
  const l = linhasDosCaminhos(q, 'mes');
  ok(!q.mesesIguais && l.sufixo === 'por mês, em média' && l.fora.linhas.some(x => x.rotulo === 'Crédito de estoque'), 'com crédito de estoque, os meses não são iguais: "por mês, em média", com a linha do estoque');
}

console.log('=== rt-explicado · a conta passo a passo ===');
{
  const ent = CASOS.loja, { r } = tudo(ent), { passos, fecho } = passosDaConta(r, ent);
  ok(passos.length === 10 && passos.map(p => p.titulo).join(' | ') === 'A alíquota do Simples | O DAS do mês em 2027, com tudo por dentro | A parte desse DAS que é CBS e IBS | O DAS por fora | A base da CBS e do IBS por fora | A CBS e o IBS das vendas | O crédito das compras | A CBS e o IBS a pagar por fora | Os seis meses lado a lado | O crédito de quem compra da empresa',
    'dez passos, na ordem em que se explica');
  ok(sem(textoDe(passos[0].formula)) === '(R$ 600.000,00 × 9,50% − R$ 13.860,00) ÷ R$ 600.000,00 = 7,19%' && passos[0].nota === 'Anexo I, 3ª faixa (LC 123/2006, art. 18).', 'passo 1: a alíquota efetiva pela tabela (' + sem(textoDe(passos[0].formula)) + ')');
  ok(passos[0].tabela && passos[0].tabela.anexo === 'I' && passos[0].tabela.linhas.length === 6 && passos[0].tabela.linhas.filter(l => l.aqui).length === 1 && passos[0].tabela.linhas[2].aqui, 'com a tabela do anexo e a faixa da empresa marcada');
  ok(sem(textoDe(passos[1].formula)) === 'R$ 50.000,00 × 7,19% = R$ 3.595,00' && sem(textoDe(passos[2].formula)) === 'R$ 3.595,00 × 15,50% = R$ 557,23' && sem(textoDe(passos[3].formula)) === 'R$ 3.595,00 − R$ 557,23 = R$ 3.037,78',
    'passos 2 a 4: o DAS, a parte de CBS e IBS e o DAS por fora');
  ok(sem(textoDe(passos[6].formula)) === 'R$ 25.000,00 × 11,30% = R$ 2.825,00', 'passo 7: o crédito das compras');
  ok(sem(fecho).includes('R$ 38.520,00 por dentro e R$ 51.310,12 por fora no semestre') && fecho.includes('A diferença é a mesma.'), 'o fecho liga a conta ao custo tributário do detalhe técnico');
}
{
  const ent = CASOS.industria, { r } = tudo(ent), { passos } = passosDaConta(r, ent);
  ok(passos[0].nota.includes('Em 2027 a indústria passa para o Anexo I, com alíquota de 10,6625%') && passos[0].tabela.anexo === 'I', 'indústria: o passo 1 avisa o Anexo I de 2027 e mostra a tabela dele');
  ok(sem(passos[1].nota).includes('Hoje o DAS é de R$ 22.275,00: muda porque a indústria passa ao Anexo I.') && sem(textoDe(passos[1].formula)) === 'R$ 200.000,00 × 10,6625% = R$ 21.325,00', 'e o passo 2 compara com o DAS de hoje');
  ok(sem(textoDe(passos[6].formula)) === 'R$ 120.000,00 × 0,82 × 9,30% + R$ 10.000,00 × 0,82 × 9,30% = R$ 9.913,80', 'o crédito das compras sem o imposto embutido (o 0,82), mercadorias e despesas');
}
{
  const ent = CASOS.pgdas, { r } = tudo(ent), { passos } = passosDaConta(r, ent);
  ok(sem(textoDe(passos[0].formula)) === 'Informada, do PGDAS: 6,10%' && passos[0].nota.startsWith('Pela tabela do Anexo I daria 8,825%.'), 'alíquota do PGDAS: o passo 1 diz que foi informada e quanto daria a tabela');
  ok(sem(textoDe(passos[1].formula)).includes('de DAS cheio · com a exclusão que continua em 2027: ') && passos[1].nota.includes('o PIS/Cofins monofásico, que deixa de ser excluído em 2027'), 'com ST e monofásico, o passo 2 mostra o DAS cheio e o de 2027');
  ok(passos[2].nota.includes('A partilha é sobre o DAS cheio'), 'e o passo 3 diz que a partilha é sobre o DAS cheio');
}

console.log('=== rt-explicado · o resumo e as premissas ===');
{
  const ent = CASOS.loja, { r, v, q } = tudo(ent);
  const t = resumoParaCopiar({ r, ent, veredito: v, quadro: q, empresa: 'LOJA DE TESTE LTDA', hoje: '17/11/2026' });
  const linhas = t.split('\n');
  ok(!/\u00a0/.test(t) && !/NaN|undefined|<b>/.test(t), 'o resumo é texto puro, com espaço comum');
  ok(linhas[0] === 'Simples em 2027: CBS e IBS por dentro ou por fora do DAS' && linhas[1] === 'LOJA DE TESTE LTDA' && linhas[2] === 'Macedo & Reis Contabilidade · simulação de 17/11/2026', 'abre com o assunto, a empresa e a data');
  ok(t.includes('Tudo no DAS (por dentro): R$ 3.595,00 por mês · R$ 21.570,00 no semestre') && t.includes('Resultado para janeiro a junho de 2027: Fique no DAS.') && t.includes(v.depois), 'traz os dois caminhos em reais, o resultado e a frase da régua');
  ok(!t.includes('Crédito que os clientes empresa descontam'), 'sem vendas para empresas, o resumo não fala do crédito dos clientes');
  const e35 = { ...ent, pctPJ: 35 }, t35 = tudo(e35);
  ok(resumoParaCopiar({ r: t35.r, ent: e35, veredito: t35.v, quadro: t35.q }).includes('Crédito que os clientes empresa descontam (35% das vendas): R$ 195,03 por mês por dentro · R$ 1.929,87 por fora'), 'com 35% para empresas, traz o que elas descontam em cada caminho');
  ok(t.includes('(referência de 11,3%, calculada pelo TCU, pendente de resolução do Senado)') && t.trim().endsWith('A decisão é da empresa.'), 'e fecha com a premissa da CBS e o aviso de que a decisão é da empresa');
  const p = premissasDaConta(r, ent);
  ok(p.length === 6 && p[0].startsWith('CBS de 11,20% e IBS de 0,10% em 2027. A alíquota de referência de 11,3% foi calculada pelo TCU em 28/10/2026') && sem(p[5]).includes('R$ 1.000,00'), 'as seis premissas, com a referência do TCU e o limiar do empate');
  const outra = premissasDaConta(simular({ ...ent, cbs: 9.2 }), { ...ent, cbs: 9.2 });
  ok(outra[0].startsWith('CBS de 9,20% e IBS de 0,10%, como está na ficha.'), 'a CBS digitada na ficha sai como digitada, sem dizer que é a do TCU');
  // a conta de sensibilidade com o preço final mantido (a ficha não usa; a análise, sim): a premissa e o resumo dizem isso, e
  // não que o imposto foi calculado sobre o faturamento de hoje
  const mantido = { ...ent, precoFinalMantido: true }, rm = simular(mantido), vm = vereditoEmPalavras(rm, mantido, zonasDaCarteira(mantido));
  ok(p[1] === 'O imposto é calculado sobre o faturamento de hoje: a conta não supõe aumento de preço.'
    && premissasDaConta(rm, mantido)[1] === 'O preço final fica igual ao de hoje: a CBS e o IBS saem de dentro do preço, na venda e na compra.'
    && resumoParaCopiar({ r: rm, ent: mantido, veredito: vm }).includes('; preço final igual ao de hoje, com o imposto saindo de dentro dele; seis meses')
    && t.includes('; imposto calculado sobre o faturamento de hoje; seis meses'), 'a premissa do preço acompanha a conta: sobre o faturamento de hoje, ou com o preço final mantido');
}

console.log('=== rt-explicado · 2.500 empresas sorteadas (toda igualdade escrita fecha) ===');
{
  // gerador com semente fixa
  let s = 20261117; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const entre = (a, b) => a + rnd() * (b - a);
  const sorteio = () => {
    const anexo = ['I', 'II', 'III', 'IV', 'V'][Math.floor(rnd() * 5)];
    const rbt12 = Math.round(entre(20000, 4800000));
    const cortes = [0, rnd(), rnd(), rnd(), rnd(), 1].sort((a, b) => a - b);
    let mix = rnd() < 0.5 ? [100, 0, 0, 0, 0] : cortes.slice(1).map((c, i) => Math.round((c - cortes[i]) * 1000) / 10);
    mix[0] += Math.round((100 - mix.reduce((a, b) => a + b, 0)) * 10) / 10;
    if (mix[0] < 0) mix = [100, 0, 0, 0, 0];
    return { anexo, rbt12, receita: Math.round(rbt12 / 12 * entre(0.3, 2) * 100) / 100,
      mixCheia: mix[0], mixRed60: mix[1], mixRed40: mix[2], mixRed30: mix[3], mixZero: mix[4],
      pctComprasMercadorias: rnd() < 0.2 ? 0 : entre(0, 95), pctComprasDespesas: rnd() < 0.4 ? 0 : entre(0, 30), pctImpostoEmbutido: rnd() < 0.5 ? 0 : entre(0, 25),
      pctExcluidoST: rnd() < 0.6 ? 0 : entre(0, 60), pctReceitaMonofasica: rnd() < 0.7 ? 0 : entre(0, 100), partilha: rnd() < 0.7 ? 15.5 : entre(5, 35),
      cbs: rnd() < 0.7 ? 11.2 : entre(5, 15), ibs: 0.1, pctPJ: rnd() < 0.3 ? 0 : entre(0, 100), creditoEstoqueMes: rnd() < 0.8 ? 0 : entre(0, 20000),
      ...(rnd() < 0.3 ? { aliqEfetivaInformada: entre(2, 20) } : {}), ...(rnd() < 0.3 ? { pctComprasComCredito: entre(0, 100) } : {}),
      ...(rnd() < 0.3 ? { pctDespesasComCredito: entre(0, 100) } : {}), ...(rnd() < 0.2 ? { ipiMantido: true } : {}), ...(rnd() < 0.2 ? { issFixo: true } : {}),
      ...(rnd() < 0.1 ? { excluirIcmsIssDaBase: false } : {}), ...(rnd() < 0.05 ? { precoFinalMantido: true } : {}) };
  };
  const ruim = /NaN|undefined|Infinity|null|\[object/;
  const TITULOS = { fora: ['Vale pagar por fora'], se: ['Depende dos clientes'], dentro: ['Fique no DAS', 'Empate: fique no DAS'] };
  let n = 0, comZonas = 0, piorProva = 0, comSobra = 0, comVirada = 0;
  const erros = [];
  const erro = (m, ent) => { if (erros.length < 6) erros.push(m + ' · ' + JSON.stringify(ent)); };
  for (let i = 0; i < 2500; i++) {
    const ent = sorteio();
    let r; try { r = simular(ent); } catch (e) { continue; }
    n++;
    const q = quadroDosCaminhos(r, ent), { passos, fecho } = passosDaConta(r, ent);
    if (passos.length !== 10) erro('passos: ' + passos.length, ent);
    for (const [k, p] of passos.entries()) {
      const t = textoDe(p.formula) + ' ' + p.nota + ' ' + p.titulo;
      if (ruim.test(t)) erro('passo ' + (k + 1) + ' com texto quebrado: ' + sem(t), ent);
      for (const [a, b] of p.prova) {
        const d = Math.abs(a - b) / Math.max(1, Math.abs(b));
        piorProva = Math.max(piorProva, d);
        if (!(d < 1e-7)) erro('passo ' + (k + 1) + ' não fecha: ' + a + ' × ' + b, ent);
      }
    }
    if (ruim.test(fecho)) erro('fecho quebrado', ent);
    // o quadro: o que se paga em cada caminho e a diferença do motor
    if (!perto(q.dentro.total, q.dentro.das) || !perto(q.fora.total, q.fora.das + q.fora.aRecolher) || !perto(q.fora.total - q.dentro.total - q.fora.sobra, r.semestre.diferenca)) erro('quadro não fecha', ent);
    if (q.fora.sobra > 0.005) comSobra++;
    for (const per of ['mes', 'semestre']) {
      const l = linhasDosCaminhos(q, per);
      const t = [l.sufixo, l.diferenca, l.dentro.total, l.fora.total, l.dentro.cliente, l.fora.cliente, ...l.dentro.linhas.concat(l.fora.linhas).flatMap(x => [x.rotulo, x.valor])].join(' ');
      if (ruim.test(t) || !(l.dentro.largura > 0 && l.dentro.largura <= 100) || !(l.fora.largura >= 0 && l.fora.largura <= 100)) erro('linhas dos caminhos quebradas (' + per + ')', ent);
      const ganha = l.dentro.selo && l.dentro.selo.tipo === 'ok' ? 'dentro' : l.fora.selo && l.fora.selo.tipo === 'ok' ? 'fora' : null;
      if (ganha && (ganha === 'dentro') !== (r.semestre.diferenca > 0)) erro('"menor custo" no caminho errado', ent);
    }
    if (ruim.test(premissasDaConta(r, ent).join(' '))) erro('premissas quebradas', ent);
    // a régua (mais cara: 1 a cada 8)
    if (i % 8) continue;
    comZonas++;
    const z = zonasDaCarteira(ent), v = vereditoEmPalavras(r, ent, z);
    const tipo = tipoDoResultado(r);
    if (z.faixas[0].de !== 0 || z.faixas[z.faixas.length - 1].ate !== 100 || z.viradas.length !== z.faixas.length - 1) erro('faixas da régua não cobrem de 0 a 100', ent);
    z.faixas.forEach((f, k) => {
      if (k && f.de !== z.faixas[k - 1].ate) erro('faixas com buraco', ent);
      if (tipoDoResultado(simular({ ...ent, pctPJ: (f.de + f.ate) / 2 })) !== f.k) erro('o meio da faixa não é do tipo dela', ent);
    });
    // no máximo um ponto de virada, e sempre saindo de "fica no DAS": é o que a tela supõe ao mostrar um ponto só
    if (z.viradas.length > 1 || (z.viradas.length && z.viradas[0].de !== 'dentro')) erro('mais de uma virada, ou virada que não sai do DAS', ent);
    if (z.viradas.length) comVirada++;
    const aqui = z.faixas.find(f => ent.pctPJ >= f.de && ent.pctPJ < f.ate) || z.faixas[z.faixas.length - 1];
    if (aqui.k !== tipo && Math.abs(ent.pctPJ - (z.viradas[0] || {}).em) > 1e-6) erro('o % de hoje cai numa faixa de outro tipo', ent);
    if (v.chave !== tipo || !TITULOS[tipo].includes(v.titulo) || !v.depois || ruim.test(textoDe(v.porque) + v.nota + v.depois + v.curto + v.hoje)) erro('veredito incoerente: ' + v.titulo + ' × ' + r.veredito.tipo, ent);
    if (v.vira && v.vira.texto === v.hoje && Math.abs(v.vira.em - ent.pctPJ) > 1e-9) erro('virada e hoje com o mesmo texto', ent);
    // no "depende dos clientes", "paga" só quando o que se paga a mais é o custo a mais (sem crédito sobrando por fora)
    if (tipo === 'se' && /a empresa paga/.test(textoDe(v.porque)) !== !(q.fora.sobra > 0.005)) erro('"paga" × custo no veredito', ent);
    const t = resumoParaCopiar({ r, ent, veredito: v, quadro: q, empresa: 'EMPRESA', hoje: '17/11/2026' });
    if (!t || ruim.test(t) || /\u00a0/.test(t) || !t.includes(v.titulo)) erro('resumo quebrado', ent);
    if (ruim.test(leituraDaRegua(z, ent.pctPJ)) || !z.faixas.every(f => NOME_ZONA[f.k])) erro('leitura da régua quebrada', ent);
  }
  erros.forEach(e => console.log('    ' + e));
  ok(n > 2000, n + ' empresas válidas simuladas');
  ok(erros.length === 0, 'toda igualdade escrita nos passos fecha com o motor (maior desvio relativo: ' + piorProva.toExponential(1) + '), o quadro fecha e nenhum texto sai quebrado');
  ok(comSobra > 20 && comVirada > 20, 'o sorteio passou pelos ramos raros: ' + comSobra + ' com crédito sobrando e ' + comVirada + ' das ' + comZonas + ' réguas com ponto de virada');
}

console.log(falhas ? '\n✗ ' + falhas + ' checagem(ns) falharam' : '\n✓ a simulação explicada diz o que o motor calculou');
process.exit(falhas ? 1 : 0);
