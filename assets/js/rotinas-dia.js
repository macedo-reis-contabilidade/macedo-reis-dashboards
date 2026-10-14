// ============================================================
// MACEDO & REIS — Rotinas do dia: quando uma rotina cai num dia e quando ela está feita (a regra da agenda)
// Uma regra só pra agenda (agenda.html), pras rotinas dos setores (tarefas-engine.js) e pro assistente do escritório
// (função assistente, ferramenta "agenda"). Escritório é de segunda a sexta: fim de semana não tem rotina. "Adiada pra"
// manda: antes da data a rotina some, na data ela aparece, depois volta ao ciclo dela. Mensal e anual com "dia útil":
// caindo em sábado ou domingo, passa pra segunda. Datas: Date local à meia-noite (new Date(ano, mes, dia)).
// Testes: tests/rotinas-dia.test.mjs.
// ============================================================

const diaSemanaISO = d => { const x = d.getDay(); return x === 0 ? 7 : x; };
const diasNoMes = (ano, mes0) => new Date(ano, mes0 + 1, 0).getDate();
const segundaDaSemana = d => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - (diaSemanaISO(x) - 1)); return x; };
export const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

// o ciclo: a rotina vence neste dia? (sem olhar fim de semana nem adiamento)
export function caiNoDia(r, d) {
  const p = r.periodicidade || 'diaria';
  if (p === 'diaria') return true;
  if (p === 'semanal') return diaSemanaISO(d) === (r.dia_semana || 1);
  if (p === 'mensal') {
    const alvo = Math.min(r.dia_mes || 1, diasNoMes(d.getFullYear(), d.getMonth()));
    if (!r.dia_util) return d.getDate() === alvo;
    const dt = new Date(d.getFullYear(), d.getMonth(), alvo);
    while (dt.getDay() === 0 || dt.getDay() === 6) dt.setDate(dt.getDate() + 1);
    return d.getDate() === dt.getDate() && d.getMonth() === dt.getMonth();
  }
  if (p === 'anual') {
    const a = String(r.dia_anual || '01-01').split('-').map(Number); const mm = (a[0] || 1) - 1, dd = a[1] || 1;
    const dt = new Date(d.getFullYear(), mm, Math.min(dd, diasNoMes(d.getFullYear(), mm)));
    if (r.dia_util) while (dt.getDay() === 0 || dt.getDay() === 6) dt.setDate(dt.getDate() + 1);
    return d.getMonth() === dt.getMonth() && d.getDate() === dt.getDate();
  }
  return false;
}

// a rotina aparece neste dia? (a regra da agenda: fim de semana não tem; "adiada pra" manda)
export function rotinaDoDia(r, d) {
  if (d.getDay() === 0 || d.getDay() === 6) return false;
  if (r.adiada_para) {
    const s = ymd(d);
    if (s < r.adiada_para) return false;
    if (s === r.adiada_para) return true;
  }
  return caiNoDia(r, d);
}

// feita no período que contém o dia: no dia (diária), na semana (semanal), no mês (mensal) ou no ano (anual)
export function rotinaFeita(r, d) {
  if (!r.ultima_execucao) return false;
  const s = String(r.ultima_execucao).slice(0, 10);
  const u = new Date(s + 'T00:00:00');
  const p = r.periodicidade || 'diaria';
  if (p === 'diaria') return s === ymd(d);
  if (p === 'semanal') return segundaDaSemana(u).getTime() === segundaDaSemana(d).getTime();
  if (p === 'mensal') return u.getFullYear() === d.getFullYear() && u.getMonth() === d.getMonth();
  if (p === 'anual') return u.getFullYear() === d.getFullYear();
  return s === ymd(d);
}
