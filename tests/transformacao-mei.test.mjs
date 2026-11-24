// A transformação do MEI em ME (assets/js/transformacao-mei.js, 24/11/2026): a validade do orçamento (o último dia útil
// do mês seguinte, pelos feriados de rescisao-datas.js), a data por extenso, os valores (os de sempre vêm das linhas do
// banco, a aba Parâmetros da Precificação, nunca do código: o repositório é público; o a prazo é a entrada mais a parcela,
// o à vista não passa dele), o que vai pra imagem do orçamento, a mensagem do WhatsApp, o nome dos arquivos e o texto da
// apresentação (sem valor nenhum: serve pra qualquer cliente e pro anúncio). E a base comum das imagens
// (assets/js/imagens-whats.js), que os planos do MEI também usam. Os valores daqui são inventados.
// Rodar com: node tests/transformacao-mei.test.mjs
import { readFileSync } from 'node:fs';
import { TITULO, PRIMEIROS, OBRIGATORIO, ETAPAS, PRONTO, DOCUMENTOS, COMECO, GRUPO_PARAMETROS, CHAVES, DIAS_DA_PARCELA, PAGAMENTO, INICIO, NOTA_PRAZOS,
  NAO_INCLUSO, NOTA_NAO_INCLUSO, totalDeDias, emPalavras, hojeEmBrasilia, validadeDoOrcamento, porExtenso, lerValor, valoresDosParametros,
  conferirValores, dadosDoOrcamento, mensagemDaTransformacao, nomeDoArquivo, resumoDosValores } from '../assets/js/transformacao-mei.js';
import { LARGURA, ALTURA_MAX, ESCRITORIO, COR, FONTES } from '../assets/js/imagens-whats.js';
import { ESCRITORIO as ESCRITORIO_PLANOS } from '../assets/js/mei-planos.js';
import { LARGURA as LARGURA_PLANOS, ALTURA_MAX as ALTURA_PLANOS } from '../assets/js/mei-planos-imagem.js';
import { feriado } from '../assets/js/rescisao-datas.js';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); };
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log('A validade do orçamento: o último dia útil do mês seguinte');
chk('de 24/11/2026, até 31/12/2026 (uma quinta)', validadeDoOrcamento('2026-11-24') === '2026-12-31', validadeDoOrcamento('2026-11-24'));
chk('o primeiro e o último dia do mês dão o mesmo', validadeDoOrcamento('2026-11-01') === '2026-12-31' && validadeDoOrcamento('2026-11-30') === '2026-12-31');
chk('de dezembro, o fim de janeiro do ano seguinte; 31/01/2027 é domingo, vale até a sexta 29', validadeDoOrcamento('2026-12-15') === '2027-01-29', validadeDoOrcamento('2026-12-15'));
chk('de janeiro, o fim de fevereiro: 28/02/2027 é domingo, vale até a sexta 26', validadeDoOrcamento('2027-01-31') === '2027-02-26', validadeDoOrcamento('2027-01-31'));
chk('o feriado também sai: a Sexta-feira Santa de 30/03/2029, com o sábado 31, deixa a quinta 29',
  feriado('2029-03-30') === 'Sexta-feira Santa' && validadeDoOrcamento('2029-02-10') === '2029-03-29', validadeDoOrcamento('2029-02-10'));
chk('o ano bissexto com o Carnaval: 29/02/2028 é a terça e 28/02 a segunda de Carnaval, vale até a sexta 25',
  feriado('2028-02-29') === 'Carnaval' && feriado('2028-02-28') === 'Carnaval' && validadeDoOrcamento('2028-01-05') === '2028-02-25', validadeDoOrcamento('2028-01-05'));
chk('o bissexto sem feriado: de janeiro de 2032, até a sexta 27/02/2032 (o dia 29 é domingo)', validadeDoOrcamento('2032-01-20') === '2032-02-27',
  validadeDoOrcamento('2032-01-20'));
chk('a data que não existe não tem validade', validadeDoOrcamento('2026-02-30') === null && validadeDoOrcamento('') === null && validadeDoOrcamento('24/11/2026') === null);
chk('hoje em Brasília: às 01h de 25/11 em UTC ainda é 24/11 aqui', hojeEmBrasilia(new Date('2026-11-25T01:00:00Z')) === '2026-11-24');

console.log('A data por extenso');
chk('"24 de Novembro de 2026", com o mês em maiúscula', porExtenso('2026-11-24') === '24 de Novembro de 2026');
chk('o dia sem o zero da frente', porExtenso('2027-01-05') === '5 de Janeiro de 2027' && porExtenso('2026-03-01') === '1 de Março de 2026');
chk('sem data, nada', porExtenso('') === '' && porExtenso(null) === '');

console.log('Os valores');
chk('lê o jeito brasileiro e o número', lerValor('1.234,00') === 1234 && lerValor('987') === 987 && lerValor('R$ 456,50') === 456.5 && lerValor(2468) === 2468);
chk('o vazio e o que não é número', lerValor('') === null && lerValor('abc') === null && lerValor(null) === null && lerValor(-5) === null);
const VALORES = { aVista: 1000, entrada: 700, parcela: 500 };   // inventados
const ok = conferirValores(VALORES);
chk('à vista R$ 1.000, a prazo R$ 1.200 (700 + 500), R$ 200 a menos', ok.aVista === 1000 && ok.aPrazo === 1200 && ok.desconto === 200 && !ok.problemas.length, ok);
chk('a parcela é de 30 dias', DIAS_DA_PARCELA === 30);
const caro = conferirValores({ aVista: '1.500,00', entrada: '700', parcela: '500' });
chk('o à vista acima do a prazo é problema, sem desconto', caro.problemas.includes('O à vista está maior que o a prazo.') && caro.desconto === 0, caro);
const falta = conferirValores({ aVista: '', entrada: '700', parcela: '' });
chk('o que falta é dito', igual(falta.problemas, ['Falta o valor à vista.', 'Falta a parcela dos 30 dias.']) && falta.aPrazo === null, falta);
chk('à vista igual ao a prazo: sem desconto e sem problema', conferirValores({ aVista: 1200, entrada: 700, parcela: 500 }).desconto === 0
  && !conferirValores({ aVista: 1200, entrada: 700, parcela: 500 }).problemas.length);

console.log('Os valores de sempre: do banco (a aba Parâmetros da Precificação), nunca do código');
chk('o grupo e as três chaves das linhas do banco', GRUPO_PARAMETROS === 'transformacao_mei'
  && igual(CHAVES, { aVista: 'Valor à vista', entrada: 'Entrada do a prazo', parcela: 'Parcela do a prazo, em 30 dias' }));
const linhas = [
  { grupo: 'transformacao_mei', chave: 'Valor à vista', valor: 1000 },
  { grupo: 'transformacao_mei', chave: 'Entrada do a prazo', valor: '700.00' },   // o numeric pode vir como texto
  { grupo: 'transformacao_mei', chave: 'Parcela do a prazo, em 30 dias', valor: 500 },
  { grupo: 'p01', chave: 'Valor à vista', valor: 9 }                             // outro grupo: fica fora
];
chk('as três linhas viram os valores', igual(valoresDosParametros(linhas), VALORES), valoresDosParametros(linhas));
chk('a linha que falta, a vazia e a de zero ficam null', igual(valoresDosParametros([linhas[0], { ...linhas[1], valor: null }, { ...linhas[2], valor: 0 }]),
  { aVista: 1000, entrada: null, parcela: null }));
chk('sem linha nenhuma, nada', igual(valoresDosParametros([]), { aVista: null, entrada: null, parcela: null }) && igual(valoresDosParametros(null), { aVista: null, entrada: null, parcela: null }));
const fonte = readFileSync(new URL('../assets/js/transformacao-mei.js', import.meta.url), 'utf8');
chk('o código não tem preço: nenhum valor escrito nas chaves do orçamento', !/\b(aVista|entrada|parcela)\s*:\s*\d/.test(fonte));
const precificacao = readFileSync(new URL('../comercial-precificacao.html', import.meta.url), 'utf8');
chk('a aba Parâmetros da Precificação dá nome ao grupo (pelas 3 primeiras letras, que não batem com as do motor, p01 a p16)',
  GRUPO_PARAMETROS.slice(0, 3) === 'tra' && /"tra":\s*"Transformação do MEI em ME/.test(precificacao));

console.log('O que vai pra imagem do orçamento');
const d = dadosDoOrcamento({ cliente: '  Fulano   Beltrano da Silva ', dia: '2026-11-24', valores: VALORES });
chk('o cliente, a data e a validade por extenso', d.cliente === 'Fulano Beltrano da Silva' && d.data === '24 de Novembro de 2026' && d.validade === '31 de Dezembro de 2026'
  && d.validadeIso === '2026-12-31', d);
chk('os valores conferidos e os dias da parcela', d.aVista === 1000 && d.entrada === 700 && d.parcela === 500 && d.aPrazo === 1200 && d.desconto === 200 && d.dias === 30);
const r = resumoDosValores(d).replace(/\u00a0/g, ' ');
chk('o resumo da janela: o a prazo somado, o desconto e a validade',
  r === 'A prazo: R$ 1.200,00 (entrada de R$ 700,00 + R$ 500,00 em 30 dias). À vista: R$ 1.000,00, R$ 200,00 a menos. Vale até 31/12/2026, o último dia útil do mês seguinte.', r);
const semValores = dadosDoOrcamento({ cliente: 'Fulano', dia: '2026-11-24' });
chk('sem os valores, nenhum vem do código: os três faltam', igual(semValores.problemas, ['Falta o valor à vista.', 'Falta a entrada do a prazo.', 'Falta a parcela dos 30 dias.'])
  && semValores.aVista === null && semValores.aPrazo === null, semValores.problemas);

console.log('A mensagem do WhatsApp');
const msg = mensagemDaTransformacao({ nome: 'Fulano Beltrano da Silva', quem: 'Samuel', validade: '2026-12-31' });
chk('o primeiro nome e quem fala', msg.startsWith('Oi, Fulano! Tudo bem? Aqui é o Samuel, da Macedo & Reis Contabilidade.'), msg.split('\n')[0]);
chk('o que vai em cada imagem e a validade', msg.includes('Na 1ª imagem, o passo a passo') && msg.includes('Na 2ª, a documentação que vamos precisar.')
  && msg.includes('E, em separado, o orçamento, com os prazos de cada etapa e as formas de pagamento (vale até 31/12/2026).') && msg.endsWith('Qualquer dúvida, me chama por aqui!'), msg);
chk('a Thalia fala com "a", e sem nome a saudação fica sem', mensagemDaTransformacao({ quem: 'Thalia' }).startsWith('Oi! Tudo bem? Aqui é a Thalia, da Macedo & Reis Contabilidade.'));
chk('sem quem fala, o escritório; sem validade, sem o parêntese', mensagemDaTransformacao({ nome: 'ana' }).startsWith('Oi, Ana! Tudo bem? Aqui é da Macedo & Reis Contabilidade.')
  && mensagemDaTransformacao({ nome: 'ana' }).includes('as formas de pagamento.'));

console.log('O nome dos arquivos');
chk('as duas da apresentação, sem o cliente', nomeDoArquivo('Fulano Beltrano da Silva', 0) === 'Transformação do MEI em ME (1 de 2).png' && nomeDoArquivo('Fulano Beltrano da Silva', 1) === 'Transformação do MEI em ME (2 de 2).png');
chk('o orçamento, com o primeiro nome', nomeDoArquivo('Fulano Beltrano da Silva', 2) === 'Orçamento - Transformação do MEI em ME - Fulano.png' && nomeDoArquivo('', 2) === 'Orçamento - Transformação do MEI em ME.png');

console.log('A apresentação: as etapas, a documentação e nenhum valor');
chk('as 4 etapas, na ordem, com os prazos de 15, 5, 2 e 2 dias úteis', igual(ETAPAS.map(e => [e.n, e.dias]), [[1, 15], [2, 5], [3, 2], [4, 2]]) && ETAPAS.every(e => e.itens.length));
chk('somando, 24 dias úteis: um pouco mais de um mês', totalDeDias() === 24 && emPalavras(24) === 'um pouco mais de um mês');
chk('as palavras do tempo', emPalavras(10) === 'umas 2 semanas' && emPalavras(20) === 'cerca de um mês' && emPalavras(60) === 'uns 3 meses');
chk('a documentação do Samuel: 8 itens da empresa e 5 de cada sócio, com o gov.br prata ou ouro', igual(DOCUMENTOS.map(g => [g.grupo, g.itens.length]), [['Da empresa', 8], ['De cada sócio', 5]])
  && DOCUMENTOS[1].itens.some(i => /gov\.br nível prata ou ouro/.test(i.t) && /Não pedimos a sua senha/.test(i.nota || '')));
const apresentacao = [TITULO, OBRIGATORIO, PRONTO, COMECO, ...PRIMEIROS.flatMap(p => [p.titulo, p.texto]), ...ETAPAS.flatMap(e => [e.titulo, ...e.itens]),
  ...DOCUMENTOS.flatMap(g => [g.grupo, ...g.itens.flatMap(i => [i.t, i.nota || ''])])].join(' | ');
chk('nada de valor nas duas primeiras imagens (vão pro anúncio)', !/R\$|\d+[.,]\d{2}\b/.test(apresentacao), apresentacao.match(/R\$.{0,20}/));
chk('o orçamento diz o pagamento, o começo em 24 horas, a nota dos prazos e o que não está incluso',
  /Pix ou dinheiro/.test(PAGAMENTO) && /24 horas/.test(INICIO) && /órgãos públicos/.test(NOTA_PRAZOS) && igual(NAO_INCLUSO.map(t => t.split(' (')[0]), ['Alvará dos Bombeiros', 'Alvará Sanitário'])
  && /sem cobrança adicional/.test(NOTA_NAO_INCLUSO));

console.log('A base comum das imagens');
chk('1080 de largura e no máximo 1600 de altura, as mesmas dos planos do MEI', LARGURA === 1080 && ALTURA_MAX === 1600 && LARGURA_PLANOS === LARGURA && ALTURA_PLANOS === ALTURA_MAX);
chk('o rodapé com o registro no CRC, o mesmo dos planos', ESCRITORIO.includes('CRC/RS 006418/O') && ESCRITORIO === ESCRITORIO_PLANOS);
chk('o azul e o champanhe da logo, e as letras do sistema', COR.azul === '#3A70B4' && COR.champ === '#E3A75F' && /Fraunces/.test(FONTES.titulo) && /Manrope/.test(FONTES.texto));

console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
