// Pedir documentos ao cliente na transição (assets/js/transicao-pedido.js, 21/10/2026): as datas que a mensagem já traz
// (fiscal e DP em 2 dias úteis, contábil em 7 dias úteis, os demais em 30 dias corridos no dia útil), o texto padrão
// do escritório com as datas e o aviso de fim de semana e feriado. Rodar com: node tests/transicao-pedido.test.mjs
import { datasPadrao, mensagemDoPedido, avisoDaData, rotuloDoDia, diasUteisDepois, proximoDiaUtil, CARD_PDF, CARD_NOME } from '../assets/js/transicao-pedido.js';
import { existsSync } from 'node:fs';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + extra : '')); };
const J = x => JSON.stringify(x);

console.log('As datas padrão:');
chk('pedido de quarta, 21/10/2026 (a Ind Perin): 23/10, 30/10 e 23/11 (20/11 é feriado, Consciência Negra)',
  J(datasPadrao('2026-10-21')) === J({ urgente: '2026-10-23', contabil: '2026-10-30', demais: '2026-11-23' }), J(datasPadrao('2026-10-21')));
chk('pedido de sexta, 30/10/2026: o fim de semana e Finados (02/11) não contam — 04/11 e 11/11; os 30 dias caem num domingo (29/11) e vão pra segunda, 30/11',
  J(datasPadrao('2026-10-30')) === J({ urgente: '2026-11-04', contabil: '2026-11-11', demais: '2026-11-30' }), J(datasPadrao('2026-10-30')));
chk('pedido de sábado conta a partir da segunda: 2 dias úteis = terça', datasPadrao('2026-10-24').urgente === '2026-10-27', datasPadrao('2026-10-24').urgente);
chk('o fim do ano: Natal e Ano-Novo não contam', datasPadrao('2026-12-23').urgente === '2026-12-28' && datasPadrao('2026-12-23').contabil === '2027-01-05', J(datasPadrao('2026-12-23')));
chk('data inválida: as três vazias', J(datasPadrao('2026-02-30')) === J({ urgente: '', contabil: '', demais: '' }) && J(datasPadrao('')) === J({ urgente: '', contabil: '', demais: '' }));
chk('dias úteis: o próprio dia não conta; 0 é o próprio dia', diasUteisDepois('2026-10-21', 1) === '2026-10-22' && diasUteisDepois('2026-10-21', 0) === '2026-10-21' && diasUteisDepois('x', 2) === '');
chk('o próximo dia útil: o próprio, se útil; do feriado numa sexta (20/11) e do domingo (20/09, também feriado), a segunda', proximoDiaUtil('2026-10-22') === '2026-10-22' && proximoDiaUtil('2026-11-20') === '2026-11-23'
  && proximoDiaUtil('2026-09-20') === '2026-09-21' && proximoDiaUtil('') === '');

console.log('A mensagem:');
const ESPERADA = [
  'OBS.: Os documentos solicitados abaixo possuem caráter de maior urgência, e precisamos que nos sejam enviados até as datas estipuladas.',
  '',
  'Setor Fiscal - Enviar até dia 23/10/2026.',
  '- Certificado digital e senha',
  '',
  'DP - Enviar até dia 23/10/2026.',
  '- Extrato mensal da folha (desde a abertura, ou últimos 5 anos até o mês de fechamento);',
  '- Login e senha do seguro desemprego EMPREGADOR WEB;',
  '- Ficha de empregados com quadro de horários;',
  '- Relatório de férias com detalhamento;',
  '- Relatório de dependentes com detalhamento;',
  '- Informações complementares que podem facilitar na transição;',
  '',
  'Setor Contábil - Enviar até dia 30/10/2026.',
  '- Relação dos bancos que as empresas possuem conta',
  '',
  'Pedimos, por gentileza, que os demais documentos que constam no card sejam encaminhados até 20/11/2026.',
  '',
  'Qualquer dúvida, ficamos à disposição.',
].join('\n');
const m = mensagemDoPedido({ urgente: '2026-10-23', contabil: '2026-10-30', demais: '2026-11-20' });
chk('o texto padrão, com as datas da Ind Perin', m === ESPERADA, '\n' + m);
chk('as três correções do original: "Certificado", "nos sejam enviados", sem vírgula antes de "possuem"',
  m.includes('- Certificado digital e senha') && !m.includes('Certitificado') && m.includes('nos sejam enviados') && !m.includes('abaixo, possuem'));
chk('a data que falta (ou inválida) sai "__/__/____"', mensagemDoPedido({ urgente: '2026-10-23', contabil: '', demais: '2026-13-01' }).includes('Setor Contábil - Enviar até dia __/__/____.')
  && mensagemDoPedido({}).includes('encaminhados até __/__/____.') && mensagemDoPedido().split('__/__/____').length === 5);

console.log('O aviso da data:');
chk('feriado com o nome; sábado e domingo; dia útil sem nada', avisoDaData('2026-11-20') === 'feriado: Dia da Consciência Negra' && avisoDaData('2026-10-24') === 'sábado'
  && avisoDaData('2026-10-25') === 'domingo' && avisoDaData('2026-10-23') === '' && avisoDaData('x') === '');
chk('a linha embaixo da data: o dia da semana; o aviso no fim de semana e no feriado', rotuloDoDia('2026-10-23') === 'sexta-feira' && rotuloDoDia('2026-10-24') === '⚠ sábado, fim de semana'
  && rotuloDoDia('2026-11-20') === 'sexta-feira · ⚠ feriado: Dia da Consciência Negra' && rotuloDoDia('2026-11-15') === 'domingo · ⚠ feriado: Proclamação da República' && rotuloDoDia('') === '');

console.log('O card:');
chk('o PDF está no repositório, no caminho que a tela usa, com o nome do download', existsSync(new URL('../' + CARD_PDF, import.meta.url)) && CARD_NOME === 'Documentos solicitados - Macedo & Reis.pdf');

console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
