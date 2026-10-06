// ============================================================
// Rescisões do DP — perguntas do link e conta das datas (aviso prévio e prazo do pagamento).
// Um arquivo só, usado pelo link público (rescisao.html), pelo módulo (dp-rescisoes.html) e pela Edge Function
// rescisao-link (que leva uma cópia idêntica: supabase/functions/rescisao-link/rescisao-datas.js — o teste
// tests/rescisao-datas.test.mjs confere que as duas são iguais). Sem DOM e sem import: roda no navegador e no Deno.
//
// Regras (conferidas em 06/10/2026):
// - Aviso prévio de 30 dias, começando no dia seguinte ao pedido/comunicação (Súmula 380 do TST: art. 132 do Código
//   Civil — exclui o dia do começo e inclui o do vencimento) → último dia = data + 30.
// - Pagamento da rescisão até 10 dias corridos contados do término do contrato (CLT art. 477 §6º, redação da Lei
//   13.467/2017; contagem da OJ 162 da SDI-1 do TST: exclui o dia do término e inclui o do vencimento) → término + 10.
//   No aviso indenizado e no desligamento imediato, o término é o último dia de trabalho.
// - 10º dia em sábado, domingo ou feriado: antecipa pro dia útil anterior. O TST já aceitou o pagamento no dia útil
//   seguinte (art. 132 §1º CC — RR-20168-96.2016.5.04.0334, 4ª Turma, 2018), mas antecipar não tem risco de multa.
// - Feriados: os nacionais (20/11 desde 2024, Lei 14.759/2023), 20/09 (RS) e os dias de banco fechado (segunda e
//   terça de Carnaval, Sexta-feira Santa, Corpus Christi) — a mesma lista do financeiro-boletos. Municipal não entra.
// - Aviso proporcional (Lei 12.506/2011: +3 dias por ano completo, até 90): só na demissão por parte da empresa; a
//   conta usa os 30 dias e o DP confere o tempo de casa.
// ============================================================

export const AVISO_DIAS = 30;
export const PRAZO_PAGAMENTO = 10;

// perguntas do link — os textos ficam aqui pra o link, a ficha do módulo e a função dizerem a mesma coisa
export const PERGUNTAS = {
  funcionario: { rotulo: 'Nome completo do(a) funcionário(a)' },
  tipo: {
    rotulo: 'É pedido de demissão do funcionário ou demissão por parte da empresa?',
    opcoes: [['pedido', 'Pedido de demissão do funcionário'], ['dispensa', 'Demissão por parte da empresa']],
  },
  avisoPedido: {
    rotulo: 'Vai cumprir os 30 dias de aviso prévio ou quer fazer o desligamento imediato?',
    opcoes: [['trabalhado', 'Vai cumprir os 30 dias de aviso prévio'], ['imediato', 'Desligamento imediato (não vai cumprir o aviso)']],
  },
  dataPedido: { rotulo: 'Quando foi o pedido de demissão?', ajuda: 'O aviso começa no dia seguinte ao pedido.' },
  desconto: {
    rotulo: 'A empresa vai descontar os 30 dias de aviso na rescisão?',
    opcoes: [['sim', 'Sim, descontar os 30 dias'], ['nao', 'Não descontar']],
  },
  ultimoDia: { rotulo: 'Qual foi (ou vai ser) o último dia de trabalho?' },
  dataComunicacao: {
    rotulo: 'Quando ocorreu ou vai ocorrer a comunicação ao funcionário?',
    ajuda: 'O dia em que a empresa avisa o funcionário da demissão.',
  },
  avisoDispensa: {
    rotulo: 'O aviso prévio vai ser trabalhado ou indenizado?',
    opcoes: [['trabalhado', 'Trabalhado', 'o funcionário trabalha os 30 dias do aviso'],
             ['indenizado', 'Indenizado', 'o funcionário sai no dia da comunicação e a empresa paga o aviso']],
  },
  obs: { rotulo: 'Observações', ajuda: 'Opcional — o que mais o DP precisa saber.' },
};

const textoOpcao = (pergunta, valor) => ((PERGUNTAS[pergunta].opcoes || []).find(o => o[0] === valor) || [])[1] || '';

// ---------- datas (sempre 'AAAA-MM-DD', contadas em UTC pra não sofrer com fuso e horário de verão) ----------
const MS_DIA = 864e5;
const paraUTC = iso => { const [a, m, d] = String(iso).split('-').map(Number); return Date.UTC(a, m - 1, d); };
const deUTC = t => new Date(t).toISOString().slice(0, 10);
export const isoValida = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && deUTC(paraUTC(s)) === s;
export const somaDias = (iso, n) => deUTC(paraUTC(iso) + n * MS_DIA);
export const fmtData = iso => (isoValida(iso) ? iso.split('-').reverse().join('/') : '');
const SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
export const diaSemana = iso => SEMANA[new Date(paraUTC(iso)).getUTCDay()];

// Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano)
export function pascoa(ano) {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const x = h + l - 7 * m + 114;
  return `${ano}-${String(Math.floor(x / 31)).padStart(2, '0')}-${String((x % 31) + 1).padStart(2, '0')}`;
}

const FIXOS = [['01-01', 'Confraternização Universal'], ['04-21', 'Tiradentes'], ['05-01', 'Dia do Trabalho'],
  ['09-07', 'Independência do Brasil'], ['09-20', 'Revolução Farroupilha'], ['10-12', 'Nossa Senhora Aparecida'],
  ['11-02', 'Finados'], ['11-15', 'Proclamação da República'], ['11-20', 'Dia da Consciência Negra'], ['12-25', 'Natal']];
const porAno = new Map();
function feriadosDoAno(ano) {
  if (porAno.has(ano)) return porAno.get(ano);
  const m = new Map(FIXOS.filter(([d]) => d !== '11-20' || ano >= 2024).map(([d, n]) => [`${ano}-${d}`, n]));
  const p = pascoa(ano);
  m.set(somaDias(p, -48), 'Carnaval');
  m.set(somaDias(p, -47), 'Carnaval');
  m.set(somaDias(p, -2), 'Sexta-feira Santa');
  m.set(somaDias(p, 60), 'Corpus Christi');
  porAno.set(ano, m);
  return m;
}
export const feriado = iso => (isoValida(iso) ? feriadosDoAno(Number(iso.slice(0, 4))).get(iso) || null : null);
export const diaUtil = iso => { const s = new Date(paraUTC(iso)).getUTCDay(); return s !== 0 && s !== 6 && !feriado(iso); };

// por que o dia não é útil: "domingo", "feriado (Natal)", "domingo e feriado (Proclamação da República)"
function motivoNaoUtil(iso) {
  const s = new Date(paraUTC(iso)).getUTCDay();
  const fds = s === 0 ? 'domingo' : s === 6 ? 'sábado' : '';
  const f = feriado(iso);
  return [fds, f ? `feriado (${f})` : ''].filter(Boolean).join(' e ');
}

// ---------- o caso ----------
export const combinacaoValida = (tipo, aviso) =>
  (tipo === 'pedido' && (aviso === 'trabalhado' || aviso === 'imediato')) || (tipo === 'dispensa' && (aviso === 'trabalhado' || aviso === 'indenizado'));

// pergunta da data que o caso usa
export const perguntaData = (tipo, aviso) => (tipo === 'dispensa' ? 'dataComunicacao' : aviso === 'imediato' ? 'ultimoDia' : 'dataPedido');

export function resumoCaso(tipo, aviso, desconta) {
  if (tipo === 'pedido') {
    if (aviso === 'trabalhado') return 'Pedido de demissão · cumpre o aviso';
    if (aviso === 'imediato') return 'Pedido de demissão · desligamento imediato' + (desconta === true ? ' (desconta o aviso)' : desconta === false ? ' (sem desconto)' : '');
    return 'Pedido de demissão';
  }
  if (tipo === 'dispensa') return 'Demissão pela empresa' + (aviso === 'trabalhado' ? ' · aviso trabalhado' : aviso === 'indenizado' ? ' · aviso indenizado' : '');
  return 'Tipo não informado';
}

// datas do caso; null se faltar ou não fizer sentido
export function calcularRescisao({ tipo, aviso, data } = {}) {
  if (!combinacaoValida(tipo, aviso) || !isoValida(data)) return null;
  const trabalhado = aviso === 'trabalhado';
  const inicioAviso = trabalhado ? somaDias(data, 1) : null;
  const ultimoDia = trabalhado ? somaDias(data, AVISO_DIAS) : data;
  const limiteLegal = somaDias(ultimoDia, PRAZO_PAGAMENTO);
  let limite = limiteLegal;
  while (!diaUtil(limite)) limite = somaDias(limite, -1);
  return {
    tipo, aviso, dataBase: data, inicioAviso, ultimoDia, limiteLegal, limite,
    ajustado: limite !== limiteLegal, motivo: limite !== limiteLegal ? motivoNaoUtil(limiteLegal) : null,
    // aviso indenizado: projeção dos 30 dias (CTPS/eSocial); não muda o prazo do pagamento
    projecao: tipo === 'dispensa' && aviso === 'indenizado' ? somaDias(data, AVISO_DIAS) : null,
  };
}

// o que o link e a ficha mostram: linhas de data + notas curtas
export function resumoDatas(c) {
  if (!c) return null;
  const linhas = [];
  if (c.inicioAviso) linhas.push({ rotulo: 'Início do aviso prévio', data: c.inicioAviso });
  // no aviso trabalhado o contrato termina no fim do aviso (mesmo se o funcionário folgar os 7 últimos dias, art. 488)
  linhas.push({ rotulo: c.aviso === 'trabalhado' ? 'Fim do aviso prévio' : c.tipo === 'dispensa' ? 'Último dia de trabalho (dia da comunicação)' : 'Último dia de trabalho', data: c.ultimoDia });
  linhas.push({ rotulo: 'Pagamento da rescisão até', data: c.limite, destaque: true });
  const notas = [`O pagamento vence ${PRAZO_PAGAMENTO} dias corridos depois do último dia de contrato (CLT, art. 477, §6º).`];
  if (c.ajustado) notas.push(`O ${PRAZO_PAGAMENTO}º dia (${fmtData(c.limiteLegal)}) cai em ${c.motivo} — por isso o pagamento fica para o dia útil anterior.`);
  if (c.tipo === 'dispensa') {
    notas.push(c.aviso === 'indenizado'
      ? 'Funcionário com mais de 1 ano de empresa tem 3 dias a mais de aviso por ano completo (até 90 dias, Lei 12.506/2011): isso muda o valor da rescisão, não a data do pagamento.'
      : 'Funcionário com mais de 1 ano de empresa tem 3 dias a mais de aviso por ano completo (até 90 dias, Lei 12.506/2011). As datas acima contam 30 dias: o DP confere o tempo de casa e confirma.');
  }
  notas.push('Se o dia do pagamento for feriado na cidade da empresa, pague no dia útil anterior.');
  return { linhas, notas };
}

// respostas como ficam gravadas na rescisão (o que a empresa respondeu, com as perguntas que ela viu)
export function montarRespostas({ funcionario, tipo, aviso, desconta, data, obs } = {}) {
  const r = [{ id: 'funcionario', rotulo: PERGUNTAS.funcionario.rotulo, valor: funcionario || '' }];
  r.push({ id: 'tipo', rotulo: PERGUNTAS.tipo.rotulo, valor: textoOpcao('tipo', tipo) });
  if (tipo === 'pedido') {
    r.push({ id: 'aviso', rotulo: PERGUNTAS.avisoPedido.rotulo, valor: textoOpcao('avisoPedido', aviso) });
    if (aviso === 'imediato') r.push({ id: 'desconto', rotulo: PERGUNTAS.desconto.rotulo, valor: desconta === true ? textoOpcao('desconto', 'sim') : desconta === false ? textoOpcao('desconto', 'nao') : '' });
  }
  if (tipo === 'dispensa') r.push({ id: 'aviso', rotulo: PERGUNTAS.avisoDispensa.rotulo, valor: textoOpcao('avisoDispensa', aviso) });
  if (combinacaoValida(tipo, aviso)) r.push({ id: 'data', rotulo: PERGUNTAS[perguntaData(tipo, aviso)].rotulo, tipo: 'data', valor: data || '' });
  r.push({ id: 'obs', rotulo: PERGUNTAS.obs.rotulo, valor: obs || '' });
  return r;
}
