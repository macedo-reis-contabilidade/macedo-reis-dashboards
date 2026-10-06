// Rescisões do DP: datas do aviso e do prazo do pagamento (assets/js/rescisao-datas.js), feriados e as cópias
// que a Edge Function rescisao-link leva. Rodar com: node tests/rescisao-datas.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  pascoa, feriado, diaUtil, calcularRescisao, resumoDatas, montarRespostas, combinacaoValida, perguntaData,
  resumoCaso, fmtData, diaSemana, isoValida, somaDias, PERGUNTAS,
} from '../assets/js/rescisao-datas.js';

const raiz = fileURLToPath(new URL('..', import.meta.url));
let falhas = 0;
const chk = (nome, cond) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome); };
const igual = (nome, obtido, esperado) => chk(nome + ' (' + JSON.stringify(obtido) + ')', JSON.stringify(obtido) === JSON.stringify(esperado));

console.log('Páscoa e feriados:');
igual('Páscoa 2024', pascoa(2024), '2024-03-31');
igual('Páscoa 2025', pascoa(2025), '2025-04-20');
igual('Páscoa 2026', pascoa(2026), '2026-04-05');
igual('Páscoa 2027', pascoa(2027), '2027-03-28');
igual('Páscoa 2028', pascoa(2028), '2028-04-16');
igual('Carnaval 2026 (segunda e terça)', [feriado('2026-02-16'), feriado('2026-02-17'), feriado('2026-02-18')], ['Carnaval', 'Carnaval', null]);
igual('Sexta-feira Santa 2026', feriado('2026-04-03'), 'Sexta-feira Santa');
igual('Corpus Christi 2026', feriado('2026-06-04'), 'Corpus Christi');
igual('20/09 (RS)', feriado('2026-09-20'), 'Revolução Farroupilha');
igual('20/11 nacional desde 2024', [feriado('2023-11-20'), feriado('2024-11-20')], [null, 'Dia da Consciência Negra']);
chk('dia comum é útil (terça 06/10/2026)', diaUtil('2026-10-06'));
chk('sábado e domingo não são úteis', !diaUtil('2026-10-10') && !diaUtil('2026-10-11'));
chk('12/10 não é útil', !diaUtil('2026-10-12'));

// mesma lista de feriados bancários de 2026 que o financeiro-boletos usa (nacional + RS)
const boletos = readFileSync(raiz + 'financeiro-boletos.html', 'utf8');
const lista = [...(boletos.match(/const FERIADOS = new Set\(\[([\s\S]*?)\]\)/) || [, ''])[1].matchAll(/'(\d{4}-\d{2}-\d{2})'/g)].map(m => m[1]);
chk('lista do financeiro-boletos encontrada', lista.length >= 14);
chk('todo feriado do financeiro-boletos é feriado aqui', lista.every(d => feriado(d)));
const meus2026 = [];
for (let d = '2026-01-01'; d <= '2026-12-31'; d = somaDias(d, 1)) if (feriado(d)) meus2026.push(d);
chk('e todo feriado de 2026 daqui está lá (' + meus2026.length + ')', meus2026.every(d => lista.includes(d)));

console.log('Pedido de demissão, cumprindo o aviso:');
let c = calcularRescisao({ tipo: 'pedido', aviso: 'trabalhado', data: '2026-10-06' });
igual('aviso começa no dia seguinte ao pedido', c.inicioAviso, '2026-10-07');
igual('último dia = pedido + 30', c.ultimoDia, '2026-11-05');
igual('10º dia cai em 15/11 (domingo e feriado)', c.limiteLegal, '2026-11-15');
igual('pagamento antecipa pra sexta 13/11', c.limite, '2026-11-13');
igual('motivo', c.motivo, 'domingo e feriado (Proclamação da República)');
const r = resumoDatas(c);
igual('linhas do link', r.linhas.map(l => [l.rotulo, l.data]), [['Início do aviso prévio', '2026-10-07'], ['Fim do aviso prévio', '2026-11-05'], ['Pagamento da rescisão até', '2026-11-13']]);
igual('imediato: último dia de trabalho', resumoDatas(calcularRescisao({ tipo: 'pedido', aviso: 'imediato', data: '2026-10-06' })).linhas[0].rotulo, 'Último dia de trabalho');
chk('nota do ajuste explica o 10º dia', r.notas.some(n => n.includes('15/11/2026') && n.includes('dia útil anterior')));
chk('nota da CLT', r.notas[0].includes('art. 477, §6º'));
chk('nota do feriado municipal', r.notas.some(n => n.includes('feriado na cidade')));
chk('sem nota do aviso proporcional no pedido', !r.notas.some(n => n.includes('12.506')));

console.log('Pedido de demissão, desligamento imediato:');
c = calcularRescisao({ tipo: 'pedido', aviso: 'imediato', data: '2026-10-06' });
igual('sem aviso', c.inicioAviso, null);
igual('último dia = o informado', c.ultimoDia, '2026-10-06');
igual('pagamento até 16/10 (sexta, sem ajuste)', [c.limite, c.ajustado], ['2026-10-16', false]);
c = calcularRescisao({ tipo: 'pedido', aviso: 'imediato', data: '2026-10-07' });
igual('10º dia num sábado volta pra sexta', [c.limiteLegal, c.limite, c.motivo], ['2026-10-17', '2026-10-16', 'sábado']);
c = calcularRescisao({ tipo: 'pedido', aviso: 'imediato', data: '2027-01-30' });
igual('10º dia na terça de Carnaval volta até a sexta antes', [c.limiteLegal, c.limite, c.motivo], ['2027-02-09', '2027-02-05', 'feriado (Carnaval)']);
c = calcularRescisao({ tipo: 'pedido', aviso: 'imediato', data: '2026-12-22' });
igual('10º dia em 01/01 volta pra 31/12', c.limite, '2026-12-31');

console.log('Demissão por parte da empresa:');
c = calcularRescisao({ tipo: 'dispensa', aviso: 'indenizado', data: '2026-10-02' });
igual('indenizado: último dia = dia da comunicação', c.ultimoDia, '2026-10-02');
igual('10º dia em 12/10 (feriado) volta pra sexta 09/10', [c.limiteLegal, c.limite], ['2026-10-12', '2026-10-09']);
igual('projeção do aviso (30 dias)', c.projecao, '2026-11-01');
igual('rótulo do último dia no indenizado', resumoDatas(c).linhas[0].rotulo, 'Último dia de trabalho (dia da comunicação)');
chk('nota: proporcional muda o valor, não a data', resumoDatas(c).notas.some(n => n.includes('12.506') && n.includes('não a data')));
c = calcularRescisao({ tipo: 'dispensa', aviso: 'trabalhado', data: '2026-08-21' });
igual('trabalhado: aviso de 22/08 a 20/09', [c.inicioAviso, c.ultimoDia], ['2026-08-22', '2026-09-20']);
igual('pagamento até 30/09 (quarta)', [c.limite, c.ajustado, c.projecao], ['2026-09-30', false, null]);
chk('nota: o DP confere o tempo de casa', resumoDatas(c).notas.some(n => n.includes('12.506') && n.includes('tempo de casa')));

console.log('Entradas que não fecham:');
chk('pedido não tem aviso indenizado', calcularRescisao({ tipo: 'pedido', aviso: 'indenizado', data: '2026-10-06' }) === null);
chk('demissão pela empresa não tem desligamento imediato', !combinacaoValida('dispensa', 'imediato'));
chk('data inexistente', calcularRescisao({ tipo: 'pedido', aviso: 'trabalhado', data: '2026-02-30' }) === null);
chk('sem data', calcularRescisao({ tipo: 'pedido', aviso: 'trabalhado' }) === null && calcularRescisao() === null);
chk('isoValida', isoValida('2028-02-29') && !isoValida('2026-02-29') && !isoValida('06/10/2026'));

console.log('Textos:');
igual('fmtData', fmtData('2026-11-13'), '13/11/2026');
igual('diaSemana', diaSemana('2026-11-13'), 'sexta-feira');
igual('pergunta da data por caso', [perguntaData('pedido', 'trabalhado'), perguntaData('pedido', 'imediato'), perguntaData('dispensa', 'indenizado')], ['dataPedido', 'ultimoDia', 'dataComunicacao']);
igual('resumo do caso', [resumoCaso('pedido', 'imediato', true), resumoCaso('dispensa', 'indenizado')], ['Pedido de demissão · desligamento imediato (desconta o aviso)', 'Demissão pela empresa · aviso indenizado']);
let resp = montarRespostas({ funcionario: 'Maria', tipo: 'pedido', aviso: 'imediato', desconta: true, data: '2026-10-06', obs: 'x' });
igual('respostas do pedido imediato', resp.map(x => [x.id, x.valor]), [['funcionario', 'Maria'], ['tipo', 'Pedido de demissão do funcionário'],
  ['aviso', 'Desligamento imediato (não vai cumprir o aviso)'], ['desconto', 'Sim, descontar os 30 dias'], ['data', '2026-10-06'], ['obs', 'x']]);
igual('a data leva a pergunta que a empresa viu', resp.find(x => x.id === 'data').rotulo, PERGUNTAS.ultimoDia.rotulo);
resp = montarRespostas({ funcionario: 'João', tipo: 'dispensa', aviso: 'indenizado', data: '2026-10-02' });
igual('respostas da demissão pela empresa', resp.map(x => [x.id, x.valor]), [['funcionario', 'João'], ['tipo', 'Demissão por parte da empresa'],
  ['aviso', 'Indenizado'], ['data', '2026-10-02'], ['obs', '']]);

console.log('Contrato de experiência:');
// admissão em 01/09/2026 (terça)
let e = calcularRescisao({ tipo: 'experiencia', data: '2026-10-15', admissao: '2026-09-01', prazo: '45+45' });
igual('45+45: fim do 1º período 15/10 e da prorrogação 29/11', [e.experiencia.fim1, e.experiencia.fim2], ['2026-10-15', '2026-11-29']);
igual('encerrar em 15/10 = 45º dia, no fim do 1º período', [e.experiencia.dia, e.experiencia.situacao], [45, 'fim1']);
igual('pagamento: 25/10 é domingo → sexta 23/10', [e.limiteLegal, e.limite, e.inicioAviso, e.aviso], ['2026-10-25', '2026-10-23', null, null]);
let rr = resumoDatas(e);
igual('linhas da experiência', rr.linhas.map(l => [l.rotulo, l.data]), [['Fim do 1º período (45 dias)', '2026-10-15'], ['Fim da prorrogação (90 dias)', '2026-11-29'],
  ['Último dia de trabalho (45º dia de contrato)', '2026-10-15'], ['Pagamento da rescisão até', '2026-10-23']]);
chk('nota: termina no prazo, sem a indenização', rr.notas[0].includes('último dia do 1º período') && rr.notas[0].includes('sem a indenização do art. 479'));
chk('notas do pagamento e do feriado municipal também', rr.notas.some(n => n.includes('art. 477')) && rr.notas.some(n => n.includes('feriado na cidade')) && rr.alerta === null);
e = calcularRescisao({ tipo: 'experiencia', data: '2026-10-10', admissao: '2026-09-01', prazo: '45+45' });
igual('antes do fim: faltam 5 dias até 15/10', [e.experiencia.situacao, e.experiencia.fimRef, e.experiencia.faltam], ['antecipada', '2026-10-15', 5]);
rr = resumoDatas(e);
chk('nota: metade dos 5 dias (art. 479) e 40% do FGTS', rr.notas[0].includes('5 dias') && rr.notas[0].includes('art. 479') && rr.notas[0].includes('40% do FGTS'));
chk('nota: no fim do prazo não há indenização; cláusula do art. 481', rr.notas[1].includes('15/10/2026') && rr.notas[1].includes('art. 481'));
igual('quem sai num sábado (10/10) recebe até terça 20/10', e.limite, '2026-10-20');
e = calcularRescisao({ tipo: 'experiencia', data: '2026-11-01', admissao: '2026-09-01', prazo: '45+45' });
igual('na prorrogação: antes do fim (29/11), faltam 28 dias', [e.experiencia.situacao, e.experiencia.fimRef, e.experiencia.faltam], ['antecipada', '2026-11-29', 28]);
e = calcularRescisao({ tipo: 'experiencia', data: '2026-11-29', admissao: '2026-09-01', prazo: '45+45' });
igual('no 90º dia: fim do contrato', [e.experiencia.dia, e.experiencia.situacao], [90, 'fim']);
e = calcularRescisao({ tipo: 'experiencia', data: '2026-11-30', admissao: '2026-09-01', prazo: '45+45' });
rr = resumoDatas(e);
igual('91º dia: passou da experiência', [e.experiencia.dia, e.experiencia.situacao], [91, 'passou']);
chk('alerta: virou prazo indeterminado, marcar "Demissão por parte da empresa"', !!rr.alerta && rr.alerta.includes('prazo indeterminado') && rr.alerta.includes('Demissão por parte da empresa'));
e = calcularRescisao({ tipo: 'experiencia', data: '2026-09-30', admissao: '2026-09-01', prazo: '30+60' });
igual('30+60: fim do 1º período no 30º dia', [e.experiencia.fim1, e.experiencia.fim2, e.experiencia.situacao], ['2026-09-30', '2026-11-29', 'fim1']);
e = calcularRescisao({ tipo: 'experiencia', data: '2026-05-29', admissao: '2026-03-01', prazo: '90' });
igual('90 dias a partir de 01/03 terminam em 29/05 (a admissão conta)', [e.experiencia.fim1, e.experiencia.fim2, e.experiencia.situacao], ['2026-05-29', null, 'fim']);
igual('90 dias: uma linha só de fim', resumoDatas(e).linhas[0].rotulo, 'Fim do contrato de experiência (90 dias)');
e = calcularRescisao({ tipo: 'experiencia', data: '2026-10-10', admissao: '2026-09-01', prazo: '?' });
rr = resumoDatas(e);
igual('não sabe o prazo: sem linhas de fim', [e.experiencia.situacao, rr.linhas.length, rr.linhas[0].rotulo], ['indefinido', 2, 'Último dia de trabalho (40º dia de contrato)']);
chk('nota: o DP confere no contrato', rr.notas[0].includes('o DP confere no contrato'));
chk('encerrar antes da admissão não fecha', calcularRescisao({ tipo: 'experiencia', data: '2026-08-31', admissao: '2026-09-01', prazo: '45+45' }) === null);
chk('prazo fora da lista (até nome herdado do objeto) não fecha', calcularRescisao({ tipo: 'experiencia', data: '2026-10-10', admissao: '2026-09-01', prazo: 'toString' }) === null
  && resumoCaso('experiencia', null, null, 'toString') === 'Contrato de experiência');
chk('sem prazo ou sem admissão não fecha', calcularRescisao({ tipo: 'experiencia', data: '2026-10-10', admissao: '2026-09-01' }) === null
  && calcularRescisao({ tipo: 'experiencia', data: '2026-10-10', prazo: '45+45' }) === null);
igual('resumo do caso', [resumoCaso('experiencia', null, null, '45+45'), resumoCaso('experiencia', null, null, '?')], ['Contrato de experiência · 45 + 45 dias', 'Contrato de experiência']);
igual('pergunta da data', perguntaData('experiencia'), 'dataDesligamento');
resp = montarRespostas({ funcionario: 'Ana', tipo: 'experiencia', admissao: '2026-09-01', prazo: '45+45', data: '2026-10-15', obs: '' });
igual('respostas da experiência', resp.map(x => [x.id, x.valor]), [['funcionario', 'Ana'], ['tipo', 'Contrato de experiência — a empresa vai encerrar'],
  ['admissao', '2026-09-01'], ['prazo', '45 + 45 dias'], ['data', '2026-10-15'], ['obs', '']]);
igual('a data leva a pergunta do encerramento', resp.find(x => x.id === 'data').rotulo, PERGUNTAS.dataDesligamento.rotulo);

console.log('Cópia da Edge Function:');
const original = readFileSync(raiz + 'assets/js/rescisao-datas.js', 'utf8');
let copia = '';
try { copia = readFileSync(raiz + 'supabase/functions/rescisao-link/rescisao-datas.js', 'utf8'); } catch (e) { copia = ''; }
chk('supabase/functions/rescisao-link/rescisao-datas.js é igual a assets/js/rescisao-datas.js', copia === original);

console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
