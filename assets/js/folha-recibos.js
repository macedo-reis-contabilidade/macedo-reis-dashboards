// ============================================================
// MACEDO & REIS — Folha de pagamento: os recibos que o escritório faz fora da folha do Domínio, os "frios"
// (05/11/2026, pedido do Samuel: "fazemos muitos recibos frios aqui atualmente no Excel… siga a lógica do excel, tente
// melhorar e simplificar isso pra gente"). As contas, sem banco e sem tela: dp-folha.html usa, os testes estão em
// tests/folha-recibos.test.mjs e o PDF em assets/js/folha-recibos-pdf.js.
//
// A lógica é a da planilha de recibos do DP (a planilha não vai pro repositório: tem dado de cliente):
//   - a hora × as horas (normais, descanso, atestado); a extra de 50% = a hora × 1,5, a de 100% = a hora × 2;
//   - férias e 13º = a hora × 220 ÷ 12 × os meses, e 1/3 nas férias; a 1ª parcela do 13º é a metade;
//   - o adiantamento = a hora × as horas do mês × 40% (as horas do mês = 44 ÷ 6 × os dias do mês: 227,33 em outubro);
//   - o arredondamento leva o total ao real de cima.
// O que a planilha não fazia, e aqui sai sozinho (sempre dá pra mudar): o funcionário cadastrado uma vez, a sugestão do
// descanso pelos domingos e feriados do período, os meses de férias e de 13º pela admissão, o adiantamento do mês e a
// 1ª parcela do 13º já pagos (descontados), e o valor por extenso.
// Quem recebe por mês: a hora é o salário ÷ as horas do mês comercial (220 com 44 por semana) e o salário do mês sai
// pelos dias (÷ 30; o mês inteiro conta 30).
// Dinheiro sempre em centavos inteiros (nada de 0,1 + 0,2).
// ============================================================
import { feriado, isoValida, somaDias, diasEntre } from './rescisao-datas.js';

// ---------- números ----------
export const centavos = v => Math.round(Number(((Number(v) || 0) * 100).toFixed(6)));
const arred2 = v => centavos(v) / 100;
const pad = n => String(n).padStart(2, '0');

// "1.234,56", "1234,56", "8,37", "8.37" → número; vazio → null; o resto → NaN
export function lerNumero(txt) {
  const s0 = String(txt ?? '').replace(/R\$|\s/g, '');
  if (!s0) return null;
  let s = s0;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
  return Number(s);
}
// as horas: "53:30", "53h30", "53h", "53,5" ou "53.5" → 53,5; vazio → null; o resto → NaN
export function lerHoras(txt) {
  const s = String(txt ?? '').trim().toLowerCase();
  if (!s) return null;
  let m = /^(\d{1,4})\s*[:h]\s*([0-5]\d)?$/.exec(s);
  if (m) return Number(m[1]) + (m[2] ? Number(m[2]) / 60 : 0);
  m = /^(\d{1,4})(?:[.,](\d{1,4}))?$/.exec(s);
  if (m) return Number(m[1] + (m[2] ? '.' + m[2] : ''));
  return NaN;
}
// 117,8333 → "117:50"
export function horasTexto(h) {
  if (h == null || !isFinite(h)) return '';
  const min = Math.round(Number(h) * 60);
  return Math.floor(min / 60) + ':' + pad(min % 60);
}
// centavos → "1.234,56"
export const fmtValor = c => ((Number(c) || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtNumero = v => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 4 });
export const fmtData = iso => (isoValida(iso) ? iso.split('-').reverse().join('/') : '');

// ---------- o mês ----------
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const competenciaValida = c => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(c || ''));
export const diasNoMes = comp => { const [a, m] = comp.split('-').map(Number); return new Date(Date.UTC(a, m, 0)).getUTCDate(); };
export const primeiroDia = comp => comp + '-01';
export const ultimoDia = comp => comp + '-' + pad(diasNoMes(comp));
export const mudarMes = (comp, n) => { const [a, m] = comp.split('-').map(Number); const d = new Date(Date.UTC(a, m - 1 + n, 1)); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1); };
export const competenciaTexto = comp => (competenciaValida(comp) ? MESES[Number(comp.slice(5, 7)) - 1] + ' de ' + comp.slice(0, 4) : '');
// a competência que a tela abre: a do mês passado até o dia 15 (a folha de outubro se faz no começo de novembro), depois
// a deste mês (o adiantamento sai pelo dia 20)
export const competenciaPadrao = hoje => (Number(hoje.slice(8, 10)) <= 15 ? mudarMes(hoje.slice(0, 7), -1) : hoje.slice(0, 7));

// ---------- as horas ----------
// as do mês comercial: 44 por semana → 220 (cinco semanas)
export const horasMes = (hs = 44) => arred2(hs * 5);
// as do mês do calendário, pro adiantamento: 44 ÷ 6 × os dias (227,33 em outubro, 205,33 em fevereiro de 2026)
export const horasDoMes = (comp, hs = 44) => arred2(hs / 6 * diasNoMes(comp));

// a hora, o salário do mês comercial (férias, 13º, aviso) e o do mês do calendário (o adiantamento)
export function base(r) {
  const hs = Number(r.horas_semana) > 0 ? Number(r.horas_semana) : 44;
  const valor = Number(r.valor) || 0;
  const porMes = r.tipo_valor === 'mes';
  const hm = horasMes(hs);
  const vh = porMes ? valor / hm : valor;
  const hMes = competenciaValida(r.competencia) ? horasDoMes(r.competencia, hs) : hm;
  return { porMes, hs, hm, vh, salarioMes: porMes ? valor : vh * hm, salarioDoMes: porMes ? valor : vh * hMes, horasDoMes: hMes };
}

// ---------- os eventos (o "EVENTO" da planilha: os códigos são os dela, e os novos vêm depois) ----------
// un: h (horas), dias, meses (os avos), % (do salário do mês), R$ (o valor digitado), auto (a conta faz: 1/3 de férias)
// nat: P = provento, D = desconto
export const EVENTOS = {
  horas:        { cod: 1,  rotulo: 'Horas normais', un: 'h', nat: 'P', conta: (q, b) => q * b.vh },
  salario:      { cod: 1,  rotulo: 'Salário', un: 'dias', nat: 'P', conta: (q, b) => q * b.salarioMes / 30 },
  dsr:          { cod: 2,  rotulo: 'Descanso remunerado', un: 'h', nat: 'P', conta: (q, b) => q * b.vh },
  he50:         { cod: 3,  rotulo: 'Horas extras 50%', un: 'h', nat: 'P', conta: (q, b) => q * b.vh * 1.5 },
  he100:        { cod: 10, rotulo: 'Horas extras 100%', un: 'h', nat: 'P', conta: (q, b) => q * b.vh * 2 },
  atestado:     { cod: 4,  rotulo: 'Atestado', un: 'h', nat: 'P', conta: (q, b) => q * b.vh },
  adiantamento_salarial: { cod: 9, rotulo: 'Adiantamento salarial', un: '%', nat: 'P', conta: (q, b) => q / 100 * b.salarioDoMes },
  ferias:       { cod: 7,  rotulo: 'Férias', un: 'meses', nat: 'P', conta: (q, b) => q * b.salarioMes / 12 },
  terco:        { cod: 8,  rotulo: '1/3 de férias', un: 'auto', nat: 'P' },
  decimo1:      { cod: 6,  rotulo: '13º salário - 1ª parcela', un: 'meses', nat: 'P', conta: (q, b) => q * b.salarioMes / 12 / 2 },
  decimo:       { cod: 6,  rotulo: '13º salário', un: 'meses', nat: 'P', conta: (q, b) => q * b.salarioMes / 12 },
  aviso:        { cod: 16, rotulo: 'Aviso prévio indenizado', un: 'dias', nat: 'P', conta: (q, b) => q * b.salarioMes / 30 },
  decimo_aviso: { cod: 17, rotulo: '13º sobre o aviso', un: 'meses', nat: 'P', conta: (q, b) => q * b.salarioMes / 12 },
  ferias_aviso: { cod: 18, rotulo: 'Férias sobre o aviso', un: 'meses', nat: 'P', conta: (q, b) => q * b.salarioMes / 12 },
  reflexo_dsr:  { cod: 15, rotulo: 'Reflexo das extras no descanso', un: 'R$', nat: 'P', conta: q => q },
  diferenca:    { cod: 13, rotulo: 'Diferença salarial', un: 'R$', nat: 'P', conta: q => q },
  outras:       { cod: 14, rotulo: 'Outras verbas', un: 'R$', nat: 'P', conta: q => q },
  faltas:       { cod: 19, rotulo: 'Faltas', un: 'h', nat: 'D', conta: (q, b) => q * b.vh },
  adiantamento: { cod: 9,  rotulo: 'Adiantamento', un: 'R$', nat: 'D', conta: q => q },
  decimo_pago:  { cod: 21, rotulo: '13º - 1ª parcela já paga', un: 'R$', nat: 'D', conta: q => q },
  desconto:     { cod: 22, rotulo: 'Outros descontos', un: 'R$', nat: 'D', conta: q => q },
};
export const COD_ARREDONDAMENTO = 11;
const EH_FERIAS = ev => ev === 'ferias' || ev === 'ferias_aviso';

// os tipos de recibo (as abas da planilha: folha mensal, adiantamento, extras, férias, 13º e rescisão); o "referente"
// completa o "Recibi de … a importância de R$ …, referente …" do recibo, com a crase de cada um
const mesMinusculo = c => competenciaTexto(c).toLowerCase();
export const TIPOS = {
  mensal:       { rotulo: 'Folha mensal', referente: c => 'à folha mensal de ' + mesMinusculo(c) },
  adiantamento: { rotulo: 'Adiantamento salarial', referente: c => 'ao adiantamento salarial de ' + mesMinusculo(c) },
  extras:       { rotulo: 'Horas extras', referente: c => 'às horas extras de ' + mesMinusculo(c) },
  ferias:       { rotulo: 'Férias', referente: () => 'às férias' },
  decimo1:      { rotulo: '13º salário - 1ª parcela', referente: c => 'à 1ª parcela do 13º salário de ' + String(c).slice(0, 4) },
  decimo2:      { rotulo: '13º salário - 2ª parcela', referente: c => 'à 2ª parcela do 13º salário de ' + String(c).slice(0, 4) },
  rescisao:     { rotulo: 'Rescisão', referente: () => 'à rescisão do contrato de trabalho' },
};
// o período sai no recibo nestes (no adiantamento e no 13º, não)
export const COM_PERIODO = ['mensal', 'extras', 'ferias', 'rescisao'];

// ---------- o período, o descanso e os meses ----------
// dentro do mês: da admissão (ou do dia 1º) até a saída (ou o último dia)
export function periodoPadrao(f, comp) {
  let de = primeiroDia(comp), ate = ultimoDia(comp);
  if (isoValida(f.admissao) && f.admissao > de) de = f.admissao;
  if (isoValida(f.saida) && f.saida < ate) ate = f.saida;
  return { de, ate, vazio: de > ate };
}
// os dias do salário de quem recebe por mês: o mês inteiro conta 30 (o mês comercial); um pedaço, os dias do calendário
export function diasDoSalario(de, ate, comp) {
  if (!isoValida(de) || !isoValida(ate) || ate < de) return 0;
  if (de === primeiroDia(comp) && ate === ultimoDia(comp)) return 30;
  return Math.min(30, diasEntre(de, ate) + 1);
}
const diaDaSemana = iso => new Date(iso + 'T12:00:00Z').getUTCDay();
// os domingos e os feriados do período (os de rescisao-datas.js: os nacionais, o 20 de setembro e os móveis; o
// municipal não entra) — o feriado que cai no domingo conta uma vez
export function diasDeDescanso(de, ate) {
  const out = { domingos: 0, feriados: 0, total: 0 };
  if (!isoValida(de) || !isoValida(ate) || ate < de || diasEntre(de, ate) > 400) return out;
  for (let d = de; d <= ate; d = somaDias(d, 1)) {
    if (diaDaSemana(d) === 0) out.domingos++;
    else if (feriado(d)) out.feriados++;
  }
  out.total = out.domingos + out.feriados;
  return out;
}
// o descanso em horas: cada domingo ou feriado vale as horas de um dia (44 ÷ 6 = 7:20)
export const dsrSugerido = (de, ate, hs = 44) => arred2(diasDeDescanso(de, ate).total * (Number(hs) || 44) / 6);

// soma meses mantendo o dia (ou o último do mês, quando o dia não existe nele)
export function somaMeses(iso, k) {
  const [a, m, d] = iso.split('-').map(Number);
  const alvo = new Date(Date.UTC(a, m - 1 + k, 1));
  const ult = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  return alvo.getUTCFullYear() + '-' + pad(alvo.getUTCMonth() + 1) + '-' + pad(Math.min(d, ult));
}
// 13º: os meses do ano com 15 dias ou mais de trabalho (Lei 4.090/1962, art. 1º, § 2º), até a data
export function avos13(admissao, ate) {
  if (!isoValida(ate)) return 0;
  const ano = ate.slice(0, 4);
  let n = 0;
  for (let m = 1; m <= Number(ate.slice(5, 7)); m++) {
    const comp = ano + '-' + pad(m);
    let ini = primeiroDia(comp), fim = ultimoDia(comp);
    if (isoValida(admissao) && admissao > ini) ini = admissao;
    if (ate < fim) fim = ate;
    if (fim >= ini && diasEntre(ini, fim) + 1 >= 15) n++;
  }
  return n;
}
// o início do período aquisitivo em curso: o aniversário da admissão mais recente até a data
export function inicioAquisitivo(admissao, ate) {
  if (!isoValida(admissao) || !isoValida(ate) || ate < admissao) return isoValida(admissao) ? admissao : null;
  let k = 0;
  while (somaMeses(admissao, 12 * (k + 1)) <= ate) k++;
  return somaMeses(admissao, 12 * k);
}
// férias: os meses desde o início do período aquisitivo, com a fração de 15 dias ou mais (CLT, art. 146, parágrafo
// único) — no máximo 12
export function avosFerias(inicio, ate) {
  if (!isoValida(inicio) || !isoValida(ate) || ate < inicio) return 0;
  let n = 0;
  while (n < 12 && somaMeses(inicio, n + 1) <= somaDias(ate, 1)) n++;
  if (n < 12 && diasEntre(somaMeses(inicio, n), ate) + 1 >= 15) n++;
  return n;
}
// os meses de férias que o recibo sugere: o período aquisitivo inteiro (12) pra quem já tem um ano de casa; antes
// disso, os meses desde a admissão
export function mesesDeFerias(admissao, ate) {
  if (!isoValida(admissao) || !isoValida(ate) || ate < admissao) return 0;
  return somaMeses(admissao, 12) <= somaDias(ate, 1) ? 12 : avosFerias(admissao, ate);
}

// ---------- o que já foi pago (os outros recibos do funcionário) ----------
// o adiantamento do mês (pra descontar na folha e na rescisão) e a 1ª parcela do 13º do ano (pra descontar na 2ª)
export function jaPago(recibos, funcionarioId, comp, atualId = null) {
  const dele = (recibos || []).filter(r => r.funcionario_id === funcionarioId && r.id !== atualId);
  const soma = lista => lista.reduce((s, r) => s + centavos(r.total), 0);
  const adiantamentos = dele.filter(r => r.tipo === 'adiantamento' && r.competencia === comp);
  const primeiras = dele.filter(r => r.tipo === 'decimo1' && String(r.competencia).slice(0, 4) === String(comp).slice(0, 4));
  return { adiantamento: soma(adiantamentos), decimoPago: soma(primeiras), decimoPagoEm: primeiras.map(r => r.competencia).sort().pop() || null };
}

// ---------- o recibo novo: os eventos com que cada tipo começa ----------
// f = o funcionário (tipo_valor, admissao, saida…); pago = jaPago(…). O que dá pra saber já vem preenchido; as horas
// ficam em branco (vêm da folha de ponto) e o descanso fica pra quem clicar na sugestão
export function linhasIniciais(tipo, f, comp, pago = {}) {
  const per = periodoPadrao(f, comp);
  const fim = per.vazio ? ultimoDia(comp) : per.ate;
  const porMes = f.tipo_valor === 'mes';
  const nulo = n => (n ? n : null);
  const adiant = pago.adiantamento ? [{ ev: 'adiantamento', q: pago.adiantamento / 100 }] : [];
  const salarioOuHoras = porMes
    ? [{ ev: 'salario', q: per.vazio ? null : nulo(diasDoSalario(per.de, per.ate, comp)) }]
    : [{ ev: 'horas', q: null }, { ev: 'dsr', q: null }];
  switch (tipo) {
    case 'mensal': return [...salarioOuHoras, { ev: 'he50', q: null }, ...(porMes ? [{ ev: 'faltas', q: null }] : []), ...adiant];
    case 'adiantamento': return [{ ev: 'adiantamento_salarial', q: 40 }];
    case 'extras': return [{ ev: 'he50', q: null }, { ev: 'he100', q: null }];
    case 'ferias': return [{ ev: 'ferias', q: nulo(mesesDeFerias(f.admissao, fim)) }];
    case 'decimo1': return [{ ev: 'decimo1', q: nulo(avos13(f.admissao, fim)) }];
    case 'decimo2': {
      const fimDoAno = isoValida(f.saida) && f.saida < comp.slice(0, 4) + '-12-31' ? f.saida : comp.slice(0, 4) + '-12-31';
      return [{ ev: 'decimo', q: nulo(avos13(f.admissao, fimDoAno)) }, ...(pago.decimoPago ? [{ ev: 'decimo_pago', q: pago.decimoPago / 100 }] : [])];
    }
    case 'rescisao': return [...salarioOuHoras, { ev: 'aviso', q: null },
      { ev: 'decimo', q: nulo(avos13(f.admissao, fim)) },
      { ev: 'ferias', q: nulo(isoValida(f.admissao) ? avosFerias(inicioAquisitivo(f.admissao, fim), fim) : 0) }, ...adiant];
    default: return [];
  }
}

// ---------- a conta ----------
// r = { tipo_valor, valor, horas_semana, competencia, itens: [{ ev, q, desc }], arredondar }
// → as linhas com o valor de cada uma (centavos), o 1/3 de férias logo depois das férias, os proventos, os descontos,
// o arredondamento (até o real de cima, quando ligado e o líquido é positivo) e o total
export function calcularRecibo(r) {
  const b = base(r);
  const linhas = [];
  for (const it of r.itens || []) {
    const ev = EVENTOS[it.ev];
    if (!ev || ev.un === 'auto') continue;
    const q = it.q == null || it.q === '' ? null : Number(it.q);
    const v = q == null || !isFinite(q) ? 0 : centavos(ev.conta(q, b));
    const desc = it.desc == null ? '' : String(it.desc).trim().slice(0, 80);
    linhas.push({ ev: it.ev, cod: ev.cod, rotulo: desc || ev.rotulo, desc: desc || null, q, un: ev.un, nat: ev.nat, v });
  }
  const ferias = linhas.filter(l => EH_FERIAS(l.ev)).reduce((s, l) => s + l.v, 0);
  if (ferias > 0) {
    const i = linhas.map(l => EH_FERIAS(l.ev)).lastIndexOf(true);
    linhas.splice(i + 1, 0, { ev: 'terco', cod: EVENTOS.terco.cod, rotulo: EVENTOS.terco.rotulo, desc: null, q: null, un: 'auto', nat: 'P', v: Math.round(ferias / 3) });
  }
  const proventos = linhas.filter(l => l.nat === 'P').reduce((s, l) => s + l.v, 0);
  const descontos = linhas.filter(l => l.nat === 'D').reduce((s, l) => s + l.v, 0);
  const liquido = proventos - descontos;
  const arredondamento = r.arredondar !== false && liquido > 0 && liquido % 100 ? 100 - (liquido % 100) : 0;
  return { linhas, proventos, descontos, liquido, arredondamento, total: liquido + arredondamento, base: b };
}

// o que vai pro banco nas linhas (itens): o evento, a quantidade, a descrição e o valor de cada uma — o recibo
// gravado fica como foi impresso, mesmo que a conta mude um dia
export const itensParaGravar = calc => calc.linhas.filter(l => l.v || l.q != null).map(l => ({ ev: l.ev, q: l.q, desc: l.desc, v: l.v }));

// a referência de cada linha no recibo: "53:30", "9/12", "40%", "30 dias"
export function referenciaTexto(un, q) {
  if (q == null || q === '' || !isFinite(q)) return '';
  if (un === 'h') return horasTexto(q);
  if (un === 'meses') return fmtNumero(q) + '/12';
  if (un === '%') return fmtNumero(q) + '%';
  if (un === 'dias') return fmtNumero(q) + (Number(q) === 1 ? ' dia' : ' dias');
  return '';
}
// e no campo do editor: as horas em h:mm, o resto como número
export function quantidadeTexto(un, q) {
  if (q == null || q === '' || !isFinite(q)) return '';
  if (un === 'h') return horasTexto(q);
  if (un === 'R$') return fmtValor(centavos(q));
  return fmtNumero(q);
}
// o campo do editor de volta pra quantidade (null = vazio; NaN = não deu pra ler)
export const lerQuantidade = (un, txt) => (un === 'h' ? lerHoras(txt) : lerNumero(txt));

// ---------- o que impede gravar ----------
export function problemaDoFuncionario(f) {
  if (!String(f.nome || '').trim()) return { campo: 'nome', texto: 'Escreva o nome do funcionário.' };
  if (String(f.nome).trim().length > 120) return { campo: 'nome', texto: 'O nome passa de 120 letras.' };
  const v = Number(f.valor);
  if (f.valor == null || !isFinite(v) || v <= 0) return { campo: 'valor', texto: f.tipo_valor === 'mes' ? 'Informe o salário do mês.' : 'Informe o valor da hora.' };
  if (v >= 1e7) return { campo: 'valor', texto: 'O valor está alto demais: confira.' };
  const hs = Number(f.horas_semana);
  if (!isFinite(hs) || hs < 1 || hs > 60) return { campo: 'horas_semana', texto: 'As horas por semana vão de 1 a 60.' };
  if (isoValida(f.admissao) && isoValida(f.saida) && f.saida < f.admissao) return { campo: 'saida', texto: 'A saída é antes da admissão.' };
  return null;
}
export function problemaDoRecibo(r, calc) {
  if (!competenciaValida(r.competencia)) return { campo: 'competencia', texto: 'Escolha a competência.' };
  if (r.periodo_de && r.periodo_ate && r.periodo_ate < r.periodo_de) return { campo: 'periodo', texto: 'O fim do período é antes do começo.' };
  const ruim = (r.itens || []).find(it => it.q != null && it.q !== '' && !isFinite(Number(it.q)));
  if (ruim) {
    const ev = EVENTOS[ruim.ev] || {};
    return { campo: 'linha', ev: ruim.ev, texto: 'Confira "' + (ruim.desc || ev.rotulo || ruim.ev) + '"' + (ev.un === 'h' ? ': as horas vão como 8:30 ou 8,5.' : ': não deu pra ler o número.') };
  }
  const longa = (r.itens || []).find(it => (EVENTOS[it.ev] || {}).un === 'h' && Number(it.q) > 744);
  if (longa) return { campo: 'linha', ev: longa.ev, texto: 'Mais de 744 horas em "' + EVENTOS[longa.ev].rotulo + '": confira.' };
  if (!(Number(r.valor) > 0) && calc.linhas.some(l => !['R$', 'auto'].includes(l.un) && l.q)) {
    return { campo: 'valor', texto: 'Sem o valor da hora (ou o salário), as horas não têm valor.' };
  }
  if (calc.proventos <= 0) return { campo: 'linha', texto: 'O recibo está sem valor: preencha as horas ou os valores.' };
  if (calc.liquido < 0) return { campo: 'linha', texto: 'Os descontos passam dos proventos.' };
  return null;
}

// ---------- o valor por extenso ----------
const UNI = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze',
  'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const DEZ = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const CEN = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
function ate999(x) {
  if (x === 100) return 'cem';
  const partes = [];
  const c = Math.floor(x / 100), r = x % 100;
  if (c) partes.push(CEN[c]);
  if (r) partes.push(r < 20 ? UNI[r] : DEZ[Math.floor(r / 10)] + (r % 10 ? ' e ' + UNI[r % 10] : ''));
  return partes.join(' e ');
}
export function numeroPorExtenso(n) {
  n = Math.floor(Math.abs(Number(n) || 0));
  if (!n) return 'zero';
  const grupos = [];
  let resto = n;
  for (const [v, um, varios] of [[1e9, 'bilhão', 'bilhões'], [1e6, 'milhão', 'milhões'], [1e3, 'mil', 'mil']]) {
    const q = Math.floor(resto / v);
    resto %= v;
    if (q) grupos.push({ q, texto: v === 1e3 ? (q === 1 ? 'mil' : ate999(q) + ' mil') : ate999(q) + ' ' + (q === 1 ? um : varios) });
  }
  if (resto) grupos.push({ q: resto, texto: ate999(resto) });
  // o "e" antes do último grupo quando ele é menor que cem ou centena redonda: "mil e cem", "dois mil e vinte"
  return grupos.map((g, i) => (i === 0 ? '' : i === grupos.length - 1 && (g.q < 100 || g.q % 100 === 0) ? ' e ' : ' ') + g.texto).join('');
}
// R$ 616,00 → "seiscentos e dezesseis reais"; 1.000.000,00 → "um milhão de reais"
export function porExtenso(valor) {
  const c = centavos(valor);
  if (c < 0) return 'menos ' + porExtenso(-c / 100);
  const inteiro = Math.floor(c / 100), cent = c % 100;
  const partes = [];
  if (inteiro) partes.push(numeroPorExtenso(inteiro) + (inteiro >= 1e6 && inteiro % 1e6 === 0 ? ' de' : '') + (inteiro === 1 ? ' real' : ' reais'));
  if (cent) partes.push(numeroPorExtenso(cent) + (cent === 1 ? ' centavo' : ' centavos'));
  return partes.length ? partes.join(' e ') : 'zero reais';
}

// ---------- os recibos do mês ----------
export function totaisDoMes(recibos, comp) {
  const doMes = (recibos || []).filter(r => r.competencia === comp);
  return { quantos: doMes.length, total: doMes.reduce((s, r) => s + centavos(r.total), 0) };
}
// a ordem da lista e da impressão: pelo nome, e no mesmo funcionário, pela ordem em que se paga no mês (o adiantamento
// antes da folha)
const ORDEM_TIPOS = ['adiantamento', 'mensal', 'extras', 'ferias', 'decimo1', 'decimo2', 'rescisao'];
export const ordenarRecibos = lista => [...lista].sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR')
  || ORDEM_TIPOS.indexOf(a.tipo) - ORDEM_TIPOS.indexOf(b.tipo) || String(a.criado_em || '').localeCompare(String(b.criado_em || '')));
// quem aparece no mês: quem estava na empresa em algum dia dele, e quem tem recibo nele (mesmo que já tenha saído)
export function ativoNoMes(f, comp, recibos = []) {
  if ((recibos || []).some(r => r.funcionario_id === f.id && r.competencia === comp)) return true;
  if (isoValida(f.admissao) && f.admissao > ultimoDia(comp)) return false;
  if (isoValida(f.saida) && f.saida < primeiroDia(comp)) return false;
  return true;
}
