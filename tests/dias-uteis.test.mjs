// O N-ésimo dia útil do mês (assets/js/dias-uteis.js), contado como a CLT: o sábado conta, o domingo e o feriado não,
// e o dia que cai no sábado vale no dia útil anterior. É a mesma conta do dia_util_do_mes do banco, que gera as tarefas
// recorrentes pelo dia útil (a folha da Vitória no 5º dia útil, o pró-labore no 10º, desde 04/11/2026).
// Rodar com: node tests/dias-uteis.test.mjs
import { createHash } from 'node:crypto';
import { nesimoDiaUtil } from '../assets/js/dias-uteis.js';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + extra : '')); };
const igual = (nome, obtido, esperado) => chk(nome, obtido === esperado, obtido + ' (esperado ' + esperado + ')');

console.log('Os casos do pedido (novembro de 2026):');
// 02/11 é Finados e 07/11 é sábado: 1º = 03, 2º = 04, 3º = 05, 4º = 06, 5º = sábado 07 → sexta 06
igual('5º dia útil de novembro de 2026: o sábado 07/11 vale na sexta 06/11', nesimoDiaUtil('2026-11', 5), '2026-11-06');
igual('10º dia útil de novembro de 2026: sexta 13/11', nesimoDiaUtil('2026-11', 10), '2026-11-13');
igual('5º dia útil de dezembro de 2026: o sábado 05/12 vale na sexta 04/12', nesimoDiaUtil('2026-12', 5), '2026-12-04');
igual('10º dia útil de dezembro de 2026: sexta 11/12', nesimoDiaUtil('2026-12', 10), '2026-12-11');

console.log('As pontas:');
igual('sábado dia 1 (agosto de 2026) não sai do mês: vale a segunda 03/08', nesimoDiaUtil('2026-08', 1), '2026-08-03');
igual('o feriado no sábado não conta (01/05/2027): o 1º é a segunda 03/05', nesimoDiaUtil('2027-05', 1), '2027-05-03');
igual('Carnaval fora da conta (fevereiro de 2027, 8 e 9/02): o 7º é a quarta 10/02', nesimoDiaUtil('2027-02', 7), '2027-02-10');
igual('mês com menos dias úteis que N: o último (fevereiro de 2027 tem 22, o 22º é o sábado 27 → sexta 26)', nesimoDiaUtil('2027-02', 22), '2027-02-26');
igual('Sexta-feira Santa fora (03/04/2026): o 3º, o sábado 04/04, vale na quinta 02/04, e o 4º é a segunda 06/04', nesimoDiaUtil('2026-04', 3) + ' ' + nesimoDiaUtil('2026-04', 4), '2026-04-02 2026-04-06');
chk('mês ou N inválido: null', nesimoDiaUtil('2026-13', 5) === null && nesimoDiaUtil('2026-11', 0) === null && nesimoDiaUtil('', 5) === null && nesimoDiaUtil('2026-11', 2.5) === null);

console.log('A mesma conta do banco:');
// A impressão de todos os meses de 2023 a 2031, N de 1 a 22, calculada no banco em 04/11/2026:
//   select md5(string_agg(to_char(m.mes, 'YYYY-MM') || '=' || (select string_agg(to_char(public.dia_util_do_mes(m.mes::date, n),
//     'YYYY-MM-DD'), ',' order by n) from generate_series(1, 22) as n), '|' order by m.mes))
//   from generate_series('2023-01-01'::date, '2031-12-01'::date, interval '1 month') as m(mes)
// Mudou a conta de um lado, mude a do outro e refaça a impressão no banco.
const IMPRESSAO_DO_BANCO = 'dd5080bd06e192d944f129a54967d2a6';
const linhas = [];
for (let a = 2023; a <= 2031; a++) for (let m = 1; m <= 12; m++) {
  const mes = a + '-' + String(m).padStart(2, '0');
  linhas.push(mes + '=' + Array.from({ length: 22 }, (_, i) => nesimoDiaUtil(mes, i + 1)).join(','));
}
igual('108 meses × 22 dias úteis iguais aos do dia_util_do_mes', createHash('md5').update(linhas.join('|')).digest('hex'), IMPRESSAO_DO_BANCO);

console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
