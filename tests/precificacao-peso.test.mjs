// Precificação: o que mais pesa no honorário (assets/js/precificacao-peso.js, 14/11/2026): pra cada pergunta de escolha,
// o honorário do motor refeito com cada opção, mantendo as outras respostas; a distância entre a mais barata e a mais
// cara é o peso. As de número, o tipo societário e o regime ficam de fora. Em destaque, as que mais pesam (até 5, com as
// empatadas), a partir de R$ 100 ou de 10% do honorário. Parâmetros e respostas inventados; as contas, feitas à mão.
// Rodar com: node tests/precificacao-peso.test.mjs
import { indexarParams, calcularMotor } from '../assets/js/precificacao-motor.js';
import { pesoDasPerguntas, cruciais, opcoesDaPergunta, temPeso, FORA_DO_PESO, CRUCIAIS, PESO_MINIMO, PESO_FRACAO } from '../assets/js/precificacao-peso.js';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + extra : '')); };

const PARAMS = [
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
].map(([grupo, chave, valor, limite_inferior, ordem]) => ({ grupo, chave, valor, limite_inferior, ordem }));
const P = indexarParams(PARAMS);

const Q = (id, tipo, opcoes) => ({ id, tipo, opcoes: opcoes || null, pergunta: id });
const QS = [Q('A1', 'texto'), Q('A2M', 'numero'), Q('A4', 'select', ['MEI', 'LTDA']), Q('A10', 'select', ['Simples Nacional', 'Lucro Presumido']),
  Q('B1', 'select', ['0-50', '51-150']), Q('B8', 'select', ['Não possui', 'Possui sem integração contábil', 'Possui integrado à contabilidade']),
  Q('C1', 'numero'), Q('C4', 'select', ['Baixa', 'Média', 'Alta']), Q('C9', 'select', ['Baixo', 'Médio', 'Alto']),
  Q('D1', 'sim_nao'), Q('D10', 'sim_nao'), Q('D11', 'sim_nao'), Q('D13', 'sim_nao'),
  Q('E2', 'select', ['Ótima', 'Boa', 'Regular', 'Ruim']), Q('E4', 'sim_nao')];
// base 200 (360 mil por ano) × 1 + ERP 300 + folha 5 × 10 + SPED Fiscal 40 = 590, com os documentos "Boa"
const R = { A1: 'EMPRESA DE TESTE LTDA', A2M: 30000, A4: 'LTDA', A10: 'Simples Nacional', B8: 'Não possui', C1: 5, C4: 'Baixa', C9: 'Baixo',
  D1: 'Sim', D10: 'Não', D11: 'Não', D13: 'Não', E2: 'Boa', E4: 'Não' };
const copia = JSON.stringify(R);

console.log('As opções de cada pergunta:');
chk('sim ou não: as duas; lista: as dela; número e texto: nenhuma', opcoesDaPergunta(Q('D1', 'sim_nao')).join() === 'Sim,Não'
  && opcoesDaPergunta(Q('E2', 'select', ['Ótima', 'Boa'])).join() === 'Ótima,Boa' && opcoesDaPergunta(Q('A2M', 'numero')).length === 0
  && opcoesDaPergunta(Q('A1', 'texto')).length === 0 && opcoesDaPergunta(Q('X', 'select')).length === 0 && opcoesDaPergunta(null).length === 0);
chk('o tipo societário e o regime ficam de fora (são do cadastro)', FORA_DO_PESO.join() === 'A4,A10' && !temPeso(Q('A10', 'select', ['Simples Nacional', 'Lucro Presumido']))
  && temPeso(Q('E2', 'select', ['Ótima', 'Boa'])) && !temPeso(Q('E2', 'select', ['Ótima'])));

console.log('O peso de cada resposta:');
chk('o honorário de agora: R$ 590', calcularMotor(R, P).honorario === 590, calcularMotor(R, P).honorario);
const pesos = pesoDasPerguntas(R, P, QS);
const de = id => pesos.find(p => p.id === id);
chk('a ordem: da que mais pesa pra que menos pesa (as que não mexem no preço ficam de fora)', pesos.map(p => p.id + ':' + p.peso).join() === 'B8:350,D10:300,C4:200,E2:180,D11:100,D1:40,C9:30,D13:20,E4:10',
  pesos.map(p => p.id + ':' + p.peso).join());
chk('a E2 (a qualidade dos documentos): de R$ 530 (Ótima, −10%) a R$ 710 (Ruim, +20%)', de('E2').menor.valor === 530 && de('E2').menor.opcao === 'Ótima'
  && de('E2').maior.valor === 710 && de('E2').maior.opcao === 'Ruim' && de('E2').peso === 180);
chk('o ERP: de R$ 240 (integrado, −50) a R$ 590 (não possui, +300)', de('B8').menor.valor === 240 && de('B8').menor.opcao === 'Possui integrado à contabilidade'
  && de('B8').maior.valor === 590 && de('B8').maior.opcao === 'Não possui');
chk('a rotatividade passa pelo multiplicador do risco trabalhista; o risco trabalhista, pela folha (R$ 50 × 1,5 = 75: R$ 620)', de('C4').peso === 200 && de('C9').maior.valor === 620 && de('C9').menor.opcao === 'Baixo');
chk('a Reforma (sim ou não): R$ 300 a mais; o setor de risco multiplica as obrigações (R$ 40 × 1,5)', de('D10').maior.opcao === 'Sim' && de('D10').peso === 300 && de('D13').peso === 20);
chk('as de número, o texto, o tipo societário e o regime não entram', !de('A2M') && !de('C1') && !de('A1') && !de('A4') && !de('A10'));
chk('a lista sem parâmetro não pesa (as faixas de notas sem valor)', !de('B1'));
chk('as respostas não mudam', JSON.stringify(R) === copia);
const semReforma = pesoDasPerguntas(R, P, QS, qd => qd.id !== 'D10');
chk('a que não aparece no questionário fica de fora', !semReforma.find(p => p.id === 'D10') && semReforma.length === pesos.length - 1);
const pesosRuim = pesoDasPerguntas({ ...R, E2: 'Ruim' }, P, QS);
chk('o peso de uma resposta não depende da opção escolhida nela (a E2 em Ruim: o mesmo R$ 180)', pesosRuim.find(p => p.id === 'E2').peso === 180);
const semResposta = pesoDasPerguntas({ ...R, E2: '' }, P, QS);
chk('a pergunta em branco também mostra o quanto pesa', semResposta.find(p => p.id === 'E2').peso === 180);
chk('sem parâmetros, nada pesa', pesoDasPerguntas(R, {}, QS).length === 0 && pesoDasPerguntas(R, P, []).length === 0 && pesoDasPerguntas(null, P, null).length === 0);

console.log('Em destaque:');
chk('os números da regra', CRUCIAIS === 5 && PESO_MINIMO === 100 && PESO_FRACAO === 0.1);
chk('as que mais pesam, a partir de R$ 100 (o honorário de R$ 590: 10% é menos que isso)', cruciais(pesos, 590).map(p => p.id).join() === 'B8,D10,C4,E2,D11');
chk('com o honorário de R$ 2.500, só a partir de R$ 250 (10%)', cruciais(pesos, 2500).map(p => p.id).join() === 'B8,D10');
const S = [['a', 500], ['b', 400], ['c', 300], ['d', 200], ['e', 150], ['f', 150], ['g', 120]].map(([id, peso]) => ({ id, peso }));
chk('até 5, com as empatadas com a última', cruciais(S, 1000).map(p => p.id).join() === 'a,b,c,d,e,f');
chk('sem nada acima do mínimo, nada em destaque', cruciais([{ id: 'x', peso: 90 }], 300).length === 0 && cruciais([], 900).length === 0 && cruciais(null, 0).length === 0);

console.log(falhas ? `\n${falhas} falha(s).` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
