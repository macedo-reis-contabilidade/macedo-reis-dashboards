// O alvará repetido (assets/js/alvaras-repetidos.js, 12/11/2026, pedido da Adaini): a mesma empresa não fica com dois
// alvarás de mesmo tipo e número. Dados inventados. Rodar com: node tests/alvaras-repetidos.test.mjs
import { chaveDoNumero, chaveDoTipo, repetidosDe, emDobro, descreverAlvara } from '../assets/js/alvaras-repetidos.js';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); };

const FUNC = 'Alvará de Funcionamento', SANIT = 'Alvará Sanitário (Vigilância Sanitária)', AVCB = 'Alvará do Corpo de Bombeiros (AVCB)';
const A = (id, cliente_id, tipo, numero, o = {}) => ({ id, cliente_id, tipo, numero, vencimento: '2026-11-18', status: 'vigente', ...o });
const LISTA = [
  A('a1', 'c1', FUNC, '219270'),
  A('a2', 'c1', SANIT, '77/2026'),
  A('a3', 'c2', FUNC, '219270'),                 // outra empresa com o mesmo número: não é repetido
  A('a4', 'c2', AVCB, 'A00035634AA001', { vencimento: '2030-09-16' }),
  A('a5', 'c1', FUNC, null),                     // sem número: nunca é repetido
  A('a6', 'c1', FUNC, ''),
];

console.log('O número e o tipo como se comparam:');
chk('sem maiúscula, ponto, traço, barra e espaço', chaveDoNumero(' A-000.356/34 aa 001 ') === 'a00035634aa001' && chaveDoNumero('AVCB 00123/2026') === 'avcb001232026');
chk('sem os zeros da frente', chaveDoNumero('0219270') === '219270' && chaveDoNumero('000219270') === chaveDoNumero('219270') && chaveDoNumero('000') === '0');
chk('os zeros do meio ficam', chaveDoNumero('2001') === '2001' && chaveDoNumero('A001') === 'a001');
chk('sem acento (e o º, que não é letra, sai)', chaveDoNumero('PPCI 15-Á') === 'ppci15a' && chaveDoNumero('Nº 15') === 'n15');
chk('vazio, nulo e só pontuação = sem número', chaveDoNumero('') === '' && chaveDoNumero(null) === '' && chaveDoNumero(undefined) === '' && chaveDoNumero(' - / . ') === '');
chk('o tipo sem acento, maiúscula e pontuação', chaveDoTipo('Alvará  Sanitário (Vigilância Sanitária)') === chaveDoTipo('ALVARA SANITARIO - VIGILANCIA SANITARIA') && chaveDoTipo(null) === '');

console.log('O alvará novo:');
let r = repetidosDe(LISTA, { cliente_id: 'c1', tipo: FUNC, numero: '219270' });
chk('mesma empresa, mesmo tipo e mesmo número: igual', r.iguais.map(a => a.id).join() === 'a1' && r.outroTipo.length === 0, r);
r = repetidosDe(LISTA, { cliente_id: 'c1', tipo: 'alvara de funcionamento', numero: ' 0219.270 ' });
chk('digitado de outro jeito (zeros, ponto, espaço, o tipo sem acento) é o mesmo', r.iguais.map(a => a.id).join() === 'a1', r);
r = repetidosDe(LISTA, { cliente_id: 'c1', tipo: SANIT, numero: '219270' });
chk('o mesmo número em outro tipo: só avisa (outroTipo)', r.iguais.length === 0 && r.outroTipo.map(a => a.id).join() === 'a1', r);
r = repetidosDe(LISTA, { cliente_id: 'c9', tipo: FUNC, numero: '219270' });
chk('outra empresa pode ter o mesmo número', r.iguais.length === 0 && r.outroTipo.length === 0, r);
r = repetidosDe(LISTA, { cliente_id: 'c1', tipo: FUNC, numero: '219271' });
chk('outro número: nada', r.iguais.length === 0 && r.outroTipo.length === 0, r);
chk('sem número, nunca é repetido (mesmo com outros sem número na empresa)',
  repetidosDe(LISTA, { cliente_id: 'c1', tipo: FUNC, numero: '' }).iguais.length === 0 && repetidosDe(LISTA, { cliente_id: 'c1', tipo: FUNC, numero: null }).iguais.length === 0
  && repetidosDe(LISTA, { cliente_id: 'c1', tipo: FUNC, numero: ' - ' }).iguais.length === 0);
chk('sem empresa, nada', repetidosDe(LISTA, { cliente_id: '', tipo: FUNC, numero: '219270' }).iguais.length === 0 && repetidosDe(LISTA, { tipo: FUNC, numero: '219270' }).iguais.length === 0);
chk('lista vazia ou nula não quebra', repetidosDe(null, { cliente_id: 'c1', tipo: FUNC, numero: '1' }).iguais.length === 0 && repetidosDe([null, undefined], { cliente_id: 'c1', tipo: FUNC, numero: '1' }).iguais.length === 0
  && repetidosDe(LISTA, null).iguais.length === 0);

console.log('O alvará que já existe (editar e renovar):');
r = repetidosDe(LISTA, { id: 'a1', cliente_id: 'c1', tipo: FUNC, numero: '219270' });
chk('ele mesmo não conta', r.iguais.length === 0 && r.outroTipo.length === 0, r);
r = repetidosDe(LISTA, { id: 'a2', cliente_id: 'c1', tipo: SANIT, numero: '77-2026' });
chk('o número de sempre, escrito de outro jeito, não vira repetido dele mesmo', r.iguais.length === 0, r);
const COM_COPIA = [...LISTA, A('a7', 'c1', FUNC, '219.270', { vencimento: '2027-11-18' })];
r = repetidosDe(COM_COPIA, { id: 'a7', cliente_id: 'c1', tipo: FUNC, numero: '219.270' });
chk('com a cópia na lista, cada um vê o outro', r.iguais.map(a => a.id).join() === 'a1' && repetidosDe(COM_COPIA, { id: 'a1', cliente_id: 'c1', tipo: FUNC, numero: '219270' }).iguais.map(a => a.id).join() === 'a7', r);

console.log('Os que já estão em dobro na lista:');
chk('sem cópia, ninguém', emDobro(LISTA).size === 0);
let d = emDobro(COM_COPIA);
chk('a cópia e o original, cada um apontando pro outro', d.size === 2 && d.get('a1').join() === 'a7' && d.get('a7').join() === 'a1', [...d]);
d = emDobro([...COM_COPIA, A('a8', 'c1', FUNC, '0219270'), A('a9', 'c1', SANIT, '219270'), A('a10', 'c2', FUNC, '219270')]);
chk('três iguais: cada um aponta pros outros dois; outro tipo e outra empresa ficam fora', d.size === 5 && d.get('a8').sort().join() === 'a1,a7' && !d.has('a9') && d.get('a3').join() === 'a10', [...d]);
chk('sem número ou sem empresa não entra', emDobro([A('x1', 'c1', FUNC, null), A('x2', 'c1', FUNC, null), A('x3', null, FUNC, '5'), A('x4', null, FUNC, '5')]).size === 0);
chk('lista nula não quebra', emDobro(null).size === 0 && emDobro([]).size === 0);

console.log('A frase do aviso:');
chk('tipo, número e vencimento', descreverAlvara(LISTA[0]) === 'Alvará de Funcionamento nº 219270, vence em 18/11/2026', descreverAlvara(LISTA[0]));
chk('sem vencimento e sem número', descreverAlvara({ tipo: 'Licença Ambiental', numero: null, vencimento: null }) === 'Licença Ambiental, sem vencimento' && descreverAlvara({ tipo: '', numero: '9' }) === 'Alvará nº 9, sem vencimento');
chk('nada vira texto vazio', descreverAlvara(null) === '');

console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
