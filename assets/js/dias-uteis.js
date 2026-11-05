// O N-ésimo dia útil do mês, contado como a CLT (art. 459, § 1º, e IN MTb 1/1989, a do "5º dia útil" do salário):
// o sábado conta, o domingo e o feriado não. O dia que cai no sábado vale no dia útil anterior, que no sábado o banco
// não abre (no sábado dia 1, o seguinte, pra não sair do mês). Mês com menos dias úteis que N: o último.
// Os feriados são os de rescisao-datas.js (nacionais, 20/09 do RS, Carnaval, Sexta Santa e Corpus Christi), os mesmos
// do vigia_dia_util do banco. É a conta do dia_util_do_mes do banco, que o gerar_tarefas_recorrentes usa nas tarefas
// recorrentes pelo dia útil (tarefas_recorrentes.dia_util_n) — tests/dias-uteis.test.mjs confere as duas, mês a mês.
import { diaUtil, feriado, somaDias } from './rescisao-datas.js';

const diaDaSemana = iso => new Date(iso + 'T12:00:00Z').getUTCDay();   // 0 = domingo, 6 = sábado

// anoMes 'AAAA-MM', n de 1 a 22 → 'AAAA-MM-DD' (ou null, com mês ou n inválido)
export function nesimoDiaUtil(anoMes, n) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(anoMes || '')) || !Number.isInteger(n) || n < 1) return null;
  let alvo = null, vistos = 0;
  for (let d = anoMes + '-01'; d.startsWith(anoMes); d = somaDias(d, 1)) {
    if (diaDaSemana(d) === 0 || feriado(d)) continue;
    alvo = d;
    if (++vistos === n) break;
  }
  if (!alvo || diaUtil(alvo)) return alvo;
  // caiu no sábado: o dia útil anterior do mesmo mês
  for (let a = somaDias(alvo, -1); a.startsWith(anoMes); a = somaDias(a, -1)) if (diaUtil(a)) return a;
  // sábado dia 1, sem dia útil antes no mês: o seguinte
  let a = alvo;
  while (!diaUtil(a)) a = somaDias(a, 1);
  return a;
}
