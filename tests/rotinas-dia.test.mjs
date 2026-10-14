// Rotinas do dia (assets/js/rotinas-dia.js): a regra da agenda — o ciclo (diária, semanal, mensal, anual, com dia útil),
// o fim de semana sem rotina, o "adiada pra" e quando a rotina está feita no período. A agenda, as rotinas dos setores e
// o assistente do escritório usam a mesma regra.
// Rodar com: node tests/rotinas-dia.test.mjs
import { caiNoDia, rotinaDoDia, rotinaFeita, ymd } from '../assets/js/rotinas-dia.js';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + extra : '')); };
const D = s => new Date(s + 'T00:00:00');

console.log('O ciclo:');
chk('diária cai todo dia', caiNoDia({ periodicidade: 'diaria' }, D('2026-10-14')));
chk('semanal cai no dia da semana (3 = quarta)', caiNoDia({ periodicidade: 'semanal', dia_semana: 3 }, D('2026-10-14')) && !caiNoDia({ periodicidade: 'semanal', dia_semana: 4 }, D('2026-10-14')));
chk('mensal no dia do mês', caiNoDia({ periodicidade: 'mensal', dia_mes: 14 }, D('2026-10-14')) && !caiNoDia({ periodicidade: 'mensal', dia_mes: 15 }, D('2026-10-14')));
chk('mensal no dia 31 em mês de 30 cai no último dia', caiNoDia({ periodicidade: 'mensal', dia_mes: 31 }, D('2026-09-30')));
// 10/10/2026 é sábado: com dia útil, passa pra segunda, 12/10
chk('mensal com dia útil: sábado passa pra segunda', caiNoDia({ periodicidade: 'mensal', dia_mes: 10, dia_util: true }, D('2026-10-12')) && !caiNoDia({ periodicidade: 'mensal', dia_mes: 10, dia_util: true }, D('2026-10-10')));
chk('anual pelo "MM-DD" (com dia útil)', caiNoDia({ periodicidade: 'anual', dia_anual: '10-14' }, D('2026-10-14')) && caiNoDia({ periodicidade: 'anual', dia_anual: '10-10', dia_util: true }, D('2026-10-12')));

console.log('O dia da agenda:');
chk('fim de semana não tem rotina (nem a diária)', !rotinaDoDia({ periodicidade: 'diaria' }, D('2026-10-17')) && !rotinaDoDia({ periodicidade: 'diaria' }, D('2026-10-18')));
const adiada = { periodicidade: 'semanal', dia_semana: 1, adiada_para: '2026-10-14' };
chk('adiada: some antes da data, aparece na data, volta ao ciclo depois', !rotinaDoDia(adiada, D('2026-10-12')) && rotinaDoDia(adiada, D('2026-10-14')) && rotinaDoDia(adiada, D('2026-10-19')));

console.log('Feita no período:');
chk('diária: feita só no dia', rotinaFeita({ periodicidade: 'diaria', ultima_execucao: '2026-10-14' }, D('2026-10-14')) && !rotinaFeita({ periodicidade: 'diaria', ultima_execucao: '2026-10-13' }, D('2026-10-14')));
chk('semanal: feita na mesma semana (segunda a domingo)', rotinaFeita({ periodicidade: 'semanal', ultima_execucao: '2026-10-12' }, D('2026-10-16')) && !rotinaFeita({ periodicidade: 'semanal', ultima_execucao: '2026-10-11' }, D('2026-10-14')));
chk('mensal e anual pelo mês e pelo ano', rotinaFeita({ periodicidade: 'mensal', ultima_execucao: '2026-10-01' }, D('2026-10-31')) && rotinaFeita({ periodicidade: 'anual', ultima_execucao: '2026-01-05' }, D('2026-10-14'))
  && !rotinaFeita({ periodicidade: 'mensal', ultima_execucao: '2026-09-30' }, D('2026-10-01')));
chk('sem execução: não feita', !rotinaFeita({ periodicidade: 'diaria' }, D('2026-10-14')));
chk('ymd no fuso local', ymd(D('2026-10-14')) === '2026-10-14');

if (falhas) { console.log('\n' + falhas + ' falha(s)'); process.exit(1); }
console.log('\nTudo certo.');
