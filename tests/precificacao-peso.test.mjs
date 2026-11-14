// Precificação: o que mais pesa no honorário (assets/js/precificacao-peso.js, 14/11/2026). A de escolha: o honorário do
// motor refeito com cada opção, mantendo as outras respostas; a distância entre a mais barata e a mais cara é o peso. O
// faturamento: o honorário na faixa de baixo e na de cima da tabela. As quantidades: o honorário sem elas (o sócio e o
// banco, com um). O tipo societário e o regime ficam de fora. Em destaque, as que mais pesam (até 5, com as empatadas),
// a partir de R$ 100 ou de 10% do honorário. Parâmetros e respostas inventados; as contas, feitas à mão.
// Rodar com: node tests/precificacao-peso.test.mjs
import { indexarParams, calcularMotor } from '../assets/js/precificacao-motor.js';
import { pesoDasPerguntas, cruciais, opcoesDaPergunta, temPeso, faturamentoQueManda, faixasDoFaturamento, tituloDoPeso, reais,
  FORA_DO_PESO, QUANTIDADES, CRUCIAIS, PESO_MINIMO, PESO_FRACAO } from '../assets/js/precificacao-peso.js';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + extra : '')); };

const LINHAS = [
  ['p01_x', '0', 100, 0, 1], ['p01_x', '300000', 200, 300000, 2],
  ['p02_x', 'Simples Nacional', 1, null, 1], ['p02_x', 'Lucro Presumido', 1.5, null, 2],
  ['p07_x', 'Não possui', 300, null, 1], ['p07_x', 'Possui sem integração contábil', 100, null, 2], ['p07_x', 'Possui integrado à contabilidade', -50, null, 3],
  ['p08_x', 'Valor por funcionário registrado', 10, null, 1],
  ['p09_x', 'Baixa', 0, null, 1], ['p09_x', 'Média', 80, null, 2], ['p09_x', 'Alta', 200, null, 3],
  ['p10_x', 'Baixo', 1, null, 1], ['p10_x', 'Médio', 1.2, null, 2], ['p10_x', 'Alto', 1.5, null, 3],
  ['p11_x', 'SPED Fiscal', 40, null, 1], ['p11_x', 'Reforma Tributária (transição/apuração dual)', 300, null, 2], ['p11_x', 'Passivo tributário em aberto', 100, null, 3],
  ['p12_x', 'Multiplicador - setor de risco elevado (Sim)', 1.5, null, 1], ['p12_x', 'Multiplicador - setor sem risco elevado (Não)', 1, null, 2],
  ['p13_x', 'Ótima', -0.1, null, 1], ['p13_x', 'Boa', 0, null, 2], ['p13_x', 'Regular', 0.1, null, 3], ['p13_x', 'Ruim', 0.2, null, 4],
  ['p15_x', 'Adicional - seguro de responsabilidade civil profissional', 10, null, 1],
  ['p16_x', 'Arredondar honorário final para múltiplo de (R$)', 10, null, 1]
];
const comoParams = linhas => linhas.map(([grupo, chave, valor, limite_inferior, ordem]) => ({ grupo, chave, valor, limite_inferior, ordem }));
const P = indexarParams(comoParams(LINHAS));

const Q = (id, tipo, opcoes) => ({ id, tipo, opcoes: opcoes || null, pergunta: id });
const QS = [Q('A1', 'texto'), Q('A2M', 'numero'), Q('A4', 'select', ['MEI', 'LTDA']), Q('A10', 'select', ['Simples Nacional', 'Lucro Presumido']),
  Q('B1', 'select', ['0-50', '51-150']), Q('B8', 'select', ['Não possui', 'Possui sem integração contábil', 'Possui integrado à contabilidade']),
  Q('C1', 'numero'), Q('C4', 'select', ['Baixa', 'Média', 'Alta']), Q('C9', 'select', ['Baixo', 'Médio', 'Alto']),
  Q('D1', 'sim_nao'), Q('D10', 'sim_nao'), Q('D11', 'sim_nao'), Q('D13', 'sim_nao'),
  Q('E2', 'select', ['Ótima', 'Boa', 'Regular', 'Ruim']), Q('E4', 'sim_nao')];
// base 200 (360 mil por ano: a faixa de 300 mil) × 1 + ERP 300 + folha 5 × 10 + SPED Fiscal 40 = 590, com os documentos "Boa"
const R = { A1: 'EMPRESA DE TESTE LTDA', A2M: 30000, A4: 'LTDA', A10: 'Simples Nacional', B8: 'Não possui', C1: 5, C4: 'Baixa', C9: 'Baixo',
  D1: 'Sim', D10: 'Não', D11: 'Não', D13: 'Não', E2: 'Boa', E4: 'Não' };
const copia = JSON.stringify(R);

console.log('As opções de cada pergunta:');
chk('sim ou não: as duas; lista: as dela; número e texto: nenhuma', opcoesDaPergunta(Q('D1', 'sim_nao')).join() === 'Sim,Não'
  && opcoesDaPergunta(Q('E2', 'select', ['Ótima', 'Boa'])).join() === 'Ótima,Boa' && opcoesDaPergunta(Q('A2M', 'numero')).length === 0
  && opcoesDaPergunta(Q('A1', 'texto')).length === 0 && opcoesDaPergunta(Q('X', 'select')).length === 0 && opcoesDaPergunta(null).length === 0);
chk('o tipo societário e o regime ficam de fora (são do cadastro)', FORA_DO_PESO.join() === 'A4,A10' && !temPeso(Q('A10', 'select', ['Simples Nacional', 'Lucro Presumido']))
  && temPeso(Q('E2', 'select', ['Ótima', 'Boa'])) && !temPeso(Q('E2', 'select', ['Ótima'])));
chk('o faturamento e as quantidades que o motor lê têm peso; o honorário de hoje (A12B) e o texto, não', temPeso(Q('A2M', 'numero')) && temPeso(Q('A2N', 'numero'))
  && temPeso(Q('C1', 'numero')) && temPeso(Q('A5', 'numero')) && temPeso(Q('D21', 'numero')) && !temPeso(Q('A12B', 'numero')) && !temPeso(Q('A1', 'texto'))
  && Object.keys(QUANTIDADES).join() === 'A5,A8,B6,C1,C2,C3,C6,C7,D12,D21' && QUANTIDADES.A5 === 1 && QUANTIDADES.B6 === 1 && QUANTIDADES.C1 === 0);

console.log('O peso de cada resposta:');
chk('o honorário de agora: R$ 590', calcularMotor(R, P).honorario === 590, calcularMotor(R, P).honorario);
const pesos = pesoDasPerguntas(R, P, QS);
const de = id => pesos.find(p => p.id === id);
chk('a ordem: da que mais pesa pra que menos pesa (as que não mexem no preço ficam de fora; no empate, a ordem do questionário)',
  pesos.map(p => p.id + ':' + p.peso).join() === 'B8:350,D10:300,C4:200,E2:180,A2M:100,D11:100,C1:50,D1:40,C9:30,D13:20,E4:10',
  pesos.map(p => p.id + ':' + p.peso).join());
chk('a E2 (a qualidade dos documentos): de R$ 530 (Ótima, −10%) a R$ 710 (Ruim, +20%)', de('E2').tipo === 'escolha' && de('E2').menor.valor === 530 && de('E2').menor.opcao === 'Ótima'
  && de('E2').maior.valor === 710 && de('E2').maior.opcao === 'Ruim' && de('E2').peso === 180);
chk('o ERP: de R$ 240 (integrado, −50) a R$ 590 (não possui, +300)', de('B8').menor.valor === 240 && de('B8').menor.opcao === 'Possui integrado à contabilidade'
  && de('B8').maior.valor === 590 && de('B8').maior.opcao === 'Não possui');
chk('a rotatividade passa pelo multiplicador do risco trabalhista; o risco trabalhista, pela folha (R$ 50 × 1,5 = 75: R$ 620)', de('C4').peso === 200 && de('C9').maior.valor === 620 && de('C9').menor.opcao === 'Baixo');
chk('a Reforma (sim ou não): R$ 300 a mais; o setor de risco multiplica as obrigações (R$ 40 × 1,5)', de('D10').maior.opcao === 'Sim' && de('D10').peso === 300 && de('D13').peso === 20);
chk('o texto, o tipo societário e o regime não entram', !de('A1') && !de('A4') && !de('A10'));
chk('a lista sem parâmetro não pesa (as faixas de notas sem valor)', !de('B1'));
chk('as respostas não mudam', JSON.stringify(R) === copia);
const semReforma = pesoDasPerguntas(R, P, QS, qd => qd.id !== 'D10');
chk('a que não aparece no questionário fica de fora', !semReforma.find(p => p.id === 'D10') && semReforma.length === pesos.length - 1);
const pesosRuim = pesoDasPerguntas({ ...R, E2: 'Ruim' }, P, QS);
chk('o peso de uma resposta não depende da opção escolhida nela (a E2 em Ruim: o mesmo R$ 180)', pesosRuim.find(p => p.id === 'E2').peso === 180);
const semResposta = pesoDasPerguntas({ ...R, E2: '' }, P, QS);
chk('a pergunta em branco também mostra o quanto pesa', semResposta.find(p => p.id === 'E2').peso === 180);
chk('sem parâmetros, nada pesa', pesoDasPerguntas(R, {}, QS).length === 0 && pesoDasPerguntas(R, P, []).length === 0 && pesoDasPerguntas(null, P, null).length === 0);

console.log('O faturamento, pela faixa da tabela:');
chk('as faixas, da menor pra maior', faixasDoFaturamento(P).map(f => f.de + ':' + f.valor).join() === '0:100,300000:200' && faixasDoFaturamento({}).length === 0);
chk('qual o motor usa: o mensal médio, senão a projeção; com o anual das precificações antigas, nenhum', faturamentoQueManda(R) === 'A2M'
  && faturamentoQueManda({ A2M: '', A2N: 20000 }) === 'A2N' && faturamentoQueManda({ A2M: 0, A2: 400000, A2N: 20000 }) === null
  && faturamentoQueManda({ A2M: 10, A2N: 20000 }) === 'A2M' && faturamentoQueManda({}) === null);
const fat = de('A2M');
chk('na última faixa (360 mil por ano, a partir de 300 mil): na de baixo, a base cai de 200 pra 100 (R$ 490); o peso é R$ 100',
  fat.tipo === 'faturamento' && fat.anual === 360000 && fat.faixa.de === 300000 && fat.faixa.ate === null && fat.abaixo.valor === 490 && fat.abaixo.de === 0 && fat.acima === null && fat.peso === 100,
  JSON.stringify(fat));
chk('o título da última faixa', tituloDoPeso(fat, 590) === 'O faturamento de R$ 360.000 por ano está na faixa a partir de R$ 300.000. Na faixa de baixo, o honorário seria R$ 490. Agora: R$ 590.',
  tituloDoPeso(fat, 590));
const P3 = indexarParams(comoParams(LINHAS.concat([['p01_x', '600000', 300, 600000, 3]])));
const fat3 = pesoDasPerguntas(R, P3, QS).find(p => p.id === 'A2M');
chk('entre duas faixas (de 300 a 600 mil): de R$ 490 (a de baixo) a R$ 690 (a de cima), o peso é R$ 200',
  fat3.abaixo.valor === 490 && fat3.acima.valor === 690 && fat3.acima.de === 600000 && fat3.faixa.ate === 599999 && fat3.peso === 200, JSON.stringify(fat3));
chk('o título diz quanto falta pra faixa de cima', tituloDoPeso(fat3, 590) === 'O faturamento de R$ 360.000 por ano está na faixa de R$ 300.000 a R$ 599.999. '
  + 'Na faixa de baixo, o honorário seria R$ 490; na de cima, R$ 690 (faltam R$ 240.000 por ano pra chegar nela). Agora: R$ 590.', tituloDoPeso(fat3, 590));
const fatPres = pesoDasPerguntas({ ...R, A10: 'Lucro Presumido' }, P3, QS).find(p => p.id === 'A2M');
chk('o regime multiplica a faixa (no Presumido, × 1,5: de R$ 540 a R$ 840, o peso é R$ 300)', fatPres.abaixo.valor === 540 && fatPres.acima.valor === 840 && fatPres.peso === 300,
  JSON.stringify(fatPres));
const fat1 = pesoDasPerguntas({ ...R, A2M: 10000 }, P, QS).find(p => p.id === 'A2M');
chk('na primeira faixa (120 mil por ano): só a de cima (R$ 590), o peso é R$ 100', fat1.abaixo === null && fat1.acima.valor === 590 && fat1.faixa.de === 0 && fat1.faixa.ate === 299999 && fat1.peso === 100);
chk('o título da primeira faixa', tituloDoPeso(fat1, 490) === 'O faturamento de R$ 120.000 por ano está na faixa até R$ 299.999. Na faixa de cima, o honorário seria R$ 590 '
  + '(faltam R$ 180.000 por ano pra chegar nela). Agora: R$ 490.', tituloDoPeso(fat1, 490));
const QSN = QS.concat([Q('A2N', 'numero')]);
const comProjecao = pesoDasPerguntas({ ...R, A2M: '', A2N: 30000 }, P, QSN);
chk('a projeção (empresa em constituição) pesa quando o mensal médio está em branco, e só ela', comProjecao.find(p => p.id === 'A2N').peso === 100 && !comProjecao.find(p => p.id === 'A2M'));
chk('com o mensal médio respondido, a projeção não pesa (o motor não a usa)', !pesoDasPerguntas({ ...R, A2N: 90000 }, P, QSN).find(p => p.id === 'A2N'));
chk('com o anual das precificações antigas, o faturamento fica sem etiqueta', !pesoDasPerguntas({ ...R, A2M: '', A2: 360000 }, P, QSN).find(p => p.id === 'A2M' || p.id === 'A2N'));

console.log('As quantidades:');
const fol = de('C1');
chk('os 5 funcionários põem R$ 50 no preço (sem nenhum, R$ 540); cada um a mais, R$ 10', fol.tipo === 'quantidade' && fol.valor === 5 && fol.base === 0 && fol.sem === 540 && fol.peso === 50 && fol.porUnidade === 10,
  JSON.stringify(fol));
chk('o título dos funcionários', tituloDoPeso(fol, 590) === 'Com 5, o honorário é R$ 590; sem nenhum, seria R$ 540. Cada um a mais soma R$ 10.', tituloDoPeso(fol, 590));
const R6 = { ...R, C9: 'Médio', E2: 'Regular' };
const fol6 = pesoDasPerguntas(R6, P, QS).find(p => p.id === 'C1');
chk('com o risco trabalhista (× 1,2) e a qualidade (+10%): R$ 660 contra R$ 590 sem ninguém; cada um a mais, R$ 10 × 1,2 × 1,1 = R$ 13,20',
  calcularMotor(R6, P).honorario === 660 && fol6.sem === 590 && fol6.peso === 70 && fol6.porUnidade === 13.2, JSON.stringify(fol6));
chk('o centavo no título', tituloDoPeso(fol6, 660) === 'Com 5, o honorário é R$ 660; sem nenhum, seria R$ 590. Cada um a mais soma R$ 13,20.', tituloDoPeso(fol6, 660));
const P5 = indexarParams(comoParams(LINHAS.concat([['p03_x', 'Valor por sócio adicional (além do 1º)', 40, null, 1], ['p08_x', 'Pró-labore por sócio recebendo', 15, null, 2]])));
const QS5 = QS.concat([Q('A5', 'numero'), Q('C6', 'numero'), Q('D21', 'numero')]);
const soc = pesoDasPerguntas({ ...R, A5: 3 }, P5, QS5).find(p => p.id === 'A5');
chk('os sócios: o primeiro não soma (3 sócios, R$ 670; com 1, R$ 590); cada um a mais, R$ 40', soc.base === 1 && soc.sem === 590 && soc.peso === 80 && soc.porUnidade === 40
  && tituloDoPeso(soc, 670) === 'Com 3, o honorário é R$ 670; com 1, seria R$ 590. Cada um a mais soma R$ 40.', JSON.stringify(soc));
chk('um sócio só, ou nenhum funcionário: sem peso', !pesoDasPerguntas({ ...R, A5: 1, C1: 0 }, P5, QS5).find(p => p.id === 'A5' || p.id === 'C1'));
chk('o pró-labore só pesa com "Sim" no recebe pró-labore', !pesoDasPerguntas({ ...R, C5: 'Não', C6: 2 }, P5, QS5).find(p => p.id === 'C6')
  && pesoDasPerguntas({ ...R, C5: 'Sim', C6: 2 }, P5, QS5).find(p => p.id === 'C6').peso === 30);
const ter = pesoDasPerguntas({ ...R, D20: 'Sim', D21: 500 }, P5, QS5).find(p => p.id === 'D21');
chk('a terceirização informada (R$ 500) pesa o que soma, sem o "cada um"', ter.emReais && ter.porUnidade === null && ter.peso === 500
  && tituloDoPeso(ter, 1090) === 'Com R$ 500 por mês, o honorário é R$ 1.090; sem a terceirização, seria R$ 590.', tituloDoPeso(ter, 1090));

console.log('Em destaque:');
chk('os números da regra', CRUCIAIS === 5 && PESO_MINIMO === 100 && PESO_FRACAO === 0.1);
chk('as que mais pesam, a partir de R$ 100 (o honorário de R$ 590: 10% é menos que isso); o faturamento empata com a D11 e entram as duas',
  cruciais(pesos, 590).map(p => p.id).join() === 'B8,D10,C4,E2,A2M,D11', cruciais(pesos, 590).map(p => p.id).join());
chk('com o honorário de R$ 2.500, só a partir de R$ 250 (10%)', cruciais(pesos, 2500).map(p => p.id).join() === 'B8,D10');
const S = [['a', 500], ['b', 400], ['c', 300], ['d', 200], ['e', 150], ['f', 150], ['g', 120]].map(([id, peso]) => ({ id, peso }));
chk('até 5, com as empatadas com a última', cruciais(S, 1000).map(p => p.id).join() === 'a,b,c,d,e,f');
chk('sem nada acima do mínimo, nada em destaque', cruciais([{ id: 'x', peso: 90 }], 300).length === 0 && cruciais([], 900).length === 0 && cruciais(null, 0).length === 0);

console.log('O título da etiqueta:');
chk('a de escolha: de quanto a quanto, com a opção de cada ponta', tituloDoPeso(de('E2'), 590) === 'Conforme a resposta, o honorário vai de R$ 530 (Ótima) a R$ 710 (Ruim). Agora: R$ 590.',
  tituloDoPeso(de('E2'), 590));
chk('o dinheiro: o inteiro sem centavos, o quebrado com os dois', reais(1840) === 'R$ 1.840' && reais(13.2) === 'R$ 13,20' && reais(0) === 'R$ 0' && reais(1234.5) === 'R$ 1.234,50'
  && tituloDoPeso(null, 0) === '');

console.log(falhas ? `\n${falhas} falha(s).` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
