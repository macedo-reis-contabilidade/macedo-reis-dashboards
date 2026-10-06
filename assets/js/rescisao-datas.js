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
// - Contrato de experiência (06/10/2026): no máximo 90 dias e uma prorrogação (CLT art. 445 p.ú. e 451); o prazo conta
//   o dia da admissão (90 dias a partir de 01/03 terminam em 29/05). Encerrar no último dia do período = término no
//   prazo, sem aviso. Antes disso = rescisão antecipada: a empresa paga metade da remuneração dos dias que faltariam
//   (art. 479) e a multa de 40% do FGTS (Decreto 99.684/1990, art. 14), salvo cláusula de rescisão antecipada (art. 481,
//   aí vale o aviso prévio). Passou de 90 dias: virou contrato por prazo indeterminado. Pagamento: os mesmos 10 dias.
//   A pedido do funcionário, antes do fim: sem multa do FGTS; ele indeniza os prejuízos da empresa, no máximo o que
//   receberia pelo art. 479 — metade dos dias que faltariam (art. 480 e §1º) —, e a empresa decide se desconta.
// ============================================================

export const AVISO_DIAS = 30;
export const PRAZO_PAGAMENTO = 10;
export const EXPERIENCIA_MAX = 90;
// prazos do contrato de experiência: [1º período, prorrogação] em dias; '?' = a empresa não sabe (o DP confere)
export const PRAZOS_EXPERIENCIA = { '30+60': [30, 60], '45+45': [45, 45], '60+30': [60, 30], '90': [90, 0], '?': null };
// só as chaves da lista ("toString" e afins, herdados do objeto, não valem)
export const prazoValido = p => Object.prototype.hasOwnProperty.call(PRAZOS_EXPERIENCIA, String(p));

// perguntas do link — os textos ficam aqui pra o link, a ficha do módulo e a função dizerem a mesma coisa
export const PERGUNTAS = {
  funcionario: { rotulo: 'Nome completo do(a) funcionário(a)' },
  tipo: {
    rotulo: 'Qual é o caso?',
    opcoes: [['pedido', 'Pedido de demissão do funcionário'], ['dispensa', 'Demissão por parte da empresa'],
             ['experiencia', 'Contrato de experiência', 'funcionário nos primeiros 90 dias — encerrado pela empresa ou a pedido dele']],
  },
  iniciativa: {
    rotulo: 'Quem quer encerrar o contrato?',
    opcoes: [['empresa', 'A empresa'], ['empregado', 'O funcionário (pediu para sair)']],
  },
  admissao: { rotulo: 'Data de admissão (início do contrato de experiência)' },
  prazoExperiencia: {
    rotulo: 'Prazo do contrato de experiência',
    ajuda: 'Está no contrato assinado na admissão.',
    opcoes: [['30+60', '30 + 60 dias'], ['45+45', '45 + 45 dias'], ['60+30', '60 + 30 dias'], ['90', '90 dias, sem prorrogação'], ['?', 'Outro / não sei']],
  },
  dataDesligamento: { rotulo: 'Quando o contrato vai ser encerrado? (último dia de trabalho)' },
  descontoExperiencia: {
    rotulo: 'A empresa vai descontar a indenização do art. 480?',
    ajuda: 'Saindo antes do fim do contrato, o funcionário indeniza os prejuízos da empresa — no máximo metade da remuneração dos dias que faltariam.',
    opcoes: [['sim', 'Sim, descontar'], ['nao', 'Não descontar']],
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
export const diasEntre = (de, ate) => Math.round((paraUTC(ate) - paraUTC(de)) / MS_DIA);
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
// no contrato de experiência não há aviso a escolher (o que vale é o prazo do contrato)
export const combinacaoValida = (tipo, aviso) => tipo === 'experiencia'
  || (tipo === 'pedido' && (aviso === 'trabalhado' || aviso === 'imediato')) || (tipo === 'dispensa' && (aviso === 'trabalhado' || aviso === 'indenizado'));

// pergunta da data que o caso usa
export const perguntaData = (tipo, aviso) => (tipo === 'experiencia' ? 'dataDesligamento' : tipo === 'dispensa' ? 'dataComunicacao' : aviso === 'imediato' ? 'ultimoDia' : 'dataPedido');

export function resumoCaso(tipo, aviso, desconta, prazo, iniciativa) {
  if (tipo === 'pedido') {
    if (aviso === 'trabalhado') return 'Pedido de demissão · cumpre o aviso';
    if (aviso === 'imediato') return 'Pedido de demissão · desligamento imediato' + (desconta === true ? ' (desconta o aviso)' : desconta === false ? ' (sem desconto)' : '');
    return 'Pedido de demissão';
  }
  if (tipo === 'dispensa') return 'Demissão pela empresa' + (aviso === 'trabalhado' ? ' · aviso trabalhado' : aviso === 'indenizado' ? ' · aviso indenizado' : '');
  if (tipo === 'experiencia') {
    return 'Contrato de experiência' + (prazoValido(prazo) && PRAZOS_EXPERIENCIA[prazo] ? ' · ' + textoOpcao('prazoExperiencia', prazo) : '')
      + (iniciativa === 'empregado' ? ' · a pedido do funcionário' + (desconta === true ? ' (desconta o art. 480)' : desconta === false ? ' (sem desconto)' : '') : '');
  }
  return 'Tipo não informado';
}

// prazo do pagamento a partir do último dia de contrato
function prazoPagamento(ultimoDia) {
  const limiteLegal = somaDias(ultimoDia, PRAZO_PAGAMENTO);
  let limite = limiteLegal;
  while (!diaUtil(limite)) limite = somaDias(limite, -1);
  return { limiteLegal, limite, ajustado: limite !== limiteLegal, motivo: limite !== limiteLegal ? motivoNaoUtil(limiteLegal) : null };
}

// contrato de experiência: em que ponto do contrato cai o último dia
//   fim1 / fim → no último dia do 1º período / do contrato; antecipada → antes do fim (fimRef, faltam dias);
//   passou → mais de 90 dias de contrato; indefinido → prazo não informado
function situacaoExperiencia(admissao, prazo, data) {
  const dia = diasEntre(admissao, data) + 1;
  const p = prazoValido(prazo) ? PRAZOS_EXPERIENCIA[prazo] : null;
  const fim1 = p ? somaDias(admissao, p[0] - 1) : null;
  const fim2 = p && p[1] ? somaDias(admissao, p[0] + p[1] - 1) : null;
  const r = { dia, fim1, fim2, situacao: 'indefinido', fimRef: null, faltam: 0 };
  if (dia > EXPERIENCIA_MAX) r.situacao = 'passou';
  else if (!p) r.situacao = 'indefinido';
  else if (data === fim1) r.situacao = fim2 ? 'fim1' : 'fim';
  else if (data < fim1) Object.assign(r, { situacao: 'antecipada', fimRef: fim1, faltam: diasEntre(data, fim1) });
  else if (fim2 && data === fim2) r.situacao = 'fim';
  else if (fim2 && data < fim2) Object.assign(r, { situacao: 'antecipada', fimRef: fim2, faltam: diasEntre(data, fim2) });
  else r.situacao = 'passou';
  return r;
}

// datas do caso; null se faltar ou não fizer sentido
export function calcularRescisao({ tipo, aviso, data, admissao, prazo, iniciativa } = {}) {
  if (!combinacaoValida(tipo, aviso) || !isoValida(data)) return null;
  if (tipo === 'experiencia') {
    if (!isoValida(admissao) || data < admissao || !prazoValido(prazo)) return null;
    return { tipo, aviso: null, dataBase: data, admissao, prazo, iniciativa: iniciativa === 'empregado' ? 'empregado' : 'empresa',
      inicioAviso: null, ultimoDia: data, ...prazoPagamento(data), projecao: null, experiencia: situacaoExperiencia(admissao, prazo, data) };
  }
  const trabalhado = aviso === 'trabalhado';
  const inicioAviso = trabalhado ? somaDias(data, 1) : null;
  const ultimoDia = trabalhado ? somaDias(data, AVISO_DIAS) : data;
  return {
    tipo, aviso, dataBase: data, inicioAviso, ultimoDia, ...prazoPagamento(ultimoDia),
    // aviso indenizado: projeção dos 30 dias (CTPS/eSocial); não muda o prazo do pagamento
    projecao: tipo === 'dispensa' && aviso === 'indenizado' ? somaDias(data, AVISO_DIAS) : null,
  };
}

// experiência a pedido do funcionário saindo antes do fim (ou sem saber o prazo): a empresa diz se desconta o art. 480
export const pedeDescontoExperiencia = c => !!c && c.tipo === 'experiencia' && c.iniciativa === 'empregado'
  && (c.experiencia.situacao === 'antecipada' || c.experiencia.situacao === 'indefinido');

// notas do prazo do pagamento (iguais pra todo caso)
function notasPagamento(c) {
  const n = [`O pagamento vence ${PRAZO_PAGAMENTO} dias corridos depois do último dia de contrato (CLT, art. 477, §6º).`];
  if (c.ajustado) n.push(`O ${PRAZO_PAGAMENTO}º dia (${fmtData(c.limiteLegal)}) cai em ${c.motivo} — por isso o pagamento fica para o dia útil anterior.`);
  return n;
}
const NOTA_MUNICIPAL = 'Se o dia do pagamento for feriado na cidade da empresa, pague no dia útil anterior.';

function resumoExperiencia(c) {
  const e = c.experiencia, p = prazoValido(c.prazo) ? PRAZOS_EXPERIENCIA[c.prazo] : null;
  const linhas = [];
  if (p && e.fim2) {
    linhas.push({ rotulo: `Fim do 1º período (${p[0]} dias)`, data: e.fim1 });
    linhas.push({ rotulo: `Fim da prorrogação (${p[0] + p[1]} dias)`, data: e.fim2 });
  } else if (p) linhas.push({ rotulo: `Fim do contrato de experiência (${p[0]} dias)`, data: e.fim1 });
  linhas.push({ rotulo: `Último dia de trabalho (${e.dia}º dia de contrato)`, data: c.ultimoDia });
  linhas.push({ rotulo: 'Pagamento da rescisão até', data: c.limite, destaque: true });
  const notas = [];
  let alerta = null;
  if (c.iniciativa === 'empregado') {
    if (e.situacao === 'passou') {
      alerta = `Passou de ${EXPERIENCIA_MAX} dias de contrato: a experiência já acabou e o contrato virou por prazo indeterminado — é pedido de demissão comum, com aviso prévio de 30 dias. Marque "Pedido de demissão do funcionário".`;
    } else if (e.situacao === 'fim1' || e.situacao === 'fim') {
      notas.push(`É o último dia do ${e.situacao === 'fim1' ? '1º período' : 'contrato de experiência'}: o contrato termina no prazo — sem indenização de nenhum lado.`);
    } else if (e.situacao === 'antecipada') {
      notas.push(`Saindo antes do fim do contrato (${fmtData(e.fimRef)}), o funcionário indeniza os prejuízos da empresa, no máximo metade da remuneração dos ${e.faltam} ${e.faltam === 1 ? 'dia' : 'dias'} que faltariam (CLT, art. 480) — a empresa decide se desconta. Não há multa de 40% do FGTS.`);
      notas.push('Se o contrato tiver cláusula de rescisão antecipada (art. 481), valem as regras do aviso prévio de 30 dias — o DP confere.');
    } else {
      notas.push(`Se ${fmtData(c.ultimoDia)} for antes do fim do contrato de experiência, o funcionário indeniza os prejuízos da empresa, no máximo metade da remuneração dos dias que faltariam (CLT, art. 480) — o DP confere no contrato.`);
    }
    notas.push(...notasPagamento(c), NOTA_MUNICIPAL);
    return { linhas, notas, alerta };
  }
  if (e.situacao === 'passou') {
    alerta = `Passou de ${EXPERIENCIA_MAX} dias de contrato: a experiência já acabou e o contrato virou por prazo indeterminado — a demissão segue as regras normais, com aviso prévio. Marque "Demissão por parte da empresa".`;
  } else if (e.situacao === 'fim1') {
    notas.push('É o último dia do 1º período: o contrato termina no prazo, sem prorrogar — sem aviso prévio e sem a indenização do art. 479 da CLT.');
  } else if (e.situacao === 'fim') {
    notas.push('É o último dia do contrato de experiência: termina no prazo — sem aviso prévio e sem a indenização do art. 479 da CLT.');
  } else if (e.situacao === 'antecipada') {
    notas.push(`Antes do fim do contrato (${fmtData(e.fimRef)}): a empresa paga metade da remuneração dos ${e.faltam} ${e.faltam === 1 ? 'dia' : 'dias'} que faltariam (CLT, art. 479) e a multa de 40% do FGTS.`);
    notas.push(`Encerrando em ${fmtData(e.fimRef)}, no fim do prazo, não há essa indenização. Se o contrato tiver cláusula de rescisão antecipada (art. 481), valem as regras do aviso prévio — o DP confere.`);
  } else {
    notas.push(`Se ${fmtData(c.ultimoDia)} não for o último dia do contrato de experiência, a empresa paga metade da remuneração dos dias que faltariam (CLT, art. 479) e a multa de 40% do FGTS — o DP confere no contrato.`);
  }
  notas.push(...notasPagamento(c), NOTA_MUNICIPAL);
  return { linhas, notas, alerta };
}

// o que o link e a ficha mostram: linhas de data + notas curtas (+ alerta, quando o caso não fecha)
export function resumoDatas(c) {
  if (!c) return null;
  if (c.tipo === 'experiencia') return resumoExperiencia(c);
  const linhas = [];
  if (c.inicioAviso) linhas.push({ rotulo: 'Início do aviso prévio', data: c.inicioAviso });
  // no aviso trabalhado o contrato termina no fim do aviso (mesmo se o funcionário folgar os 7 últimos dias, art. 488)
  linhas.push({ rotulo: c.aviso === 'trabalhado' ? 'Fim do aviso prévio' : c.tipo === 'dispensa' ? 'Último dia de trabalho (dia da comunicação)' : 'Último dia de trabalho', data: c.ultimoDia });
  linhas.push({ rotulo: 'Pagamento da rescisão até', data: c.limite, destaque: true });
  const notas = notasPagamento(c);
  if (c.tipo === 'dispensa') {
    notas.push(c.aviso === 'indenizado'
      ? 'Funcionário com mais de 1 ano de empresa tem 3 dias a mais de aviso por ano completo (até 90 dias, Lei 12.506/2011): isso muda o valor da rescisão, não a data do pagamento.'
      : 'Funcionário com mais de 1 ano de empresa tem 3 dias a mais de aviso por ano completo (até 90 dias, Lei 12.506/2011). As datas acima contam 30 dias: o DP confere o tempo de casa e confirma.');
  }
  notas.push(NOTA_MUNICIPAL);
  return { linhas, notas, alerta: null };
}

// respostas como ficam gravadas na rescisão (o que a empresa respondeu, com as perguntas que ela viu)
export function montarRespostas({ funcionario, tipo, aviso, desconta, data, obs, admissao, prazo, iniciativa } = {}) {
  const r = [{ id: 'funcionario', rotulo: PERGUNTAS.funcionario.rotulo, valor: funcionario || '' }];
  r.push({ id: 'tipo', rotulo: PERGUNTAS.tipo.rotulo, valor: textoOpcao('tipo', tipo) });
  if (tipo === 'experiencia') {
    r.push({ id: 'iniciativa', rotulo: PERGUNTAS.iniciativa.rotulo, valor: textoOpcao('iniciativa', iniciativa) });
    r.push({ id: 'admissao', rotulo: PERGUNTAS.admissao.rotulo, tipo: 'data', valor: admissao || '' });
    r.push({ id: 'prazo', rotulo: PERGUNTAS.prazoExperiencia.rotulo, valor: textoOpcao('prazoExperiencia', prazo) });
  }
  if (tipo === 'pedido') {
    r.push({ id: 'aviso', rotulo: PERGUNTAS.avisoPedido.rotulo, valor: textoOpcao('avisoPedido', aviso) });
    if (aviso === 'imediato') r.push({ id: 'desconto', rotulo: PERGUNTAS.desconto.rotulo, valor: desconta === true ? textoOpcao('desconto', 'sim') : desconta === false ? textoOpcao('desconto', 'nao') : '' });
  }
  if (tipo === 'dispensa') r.push({ id: 'aviso', rotulo: PERGUNTAS.avisoDispensa.rotulo, valor: textoOpcao('avisoDispensa', aviso) });
  if (combinacaoValida(tipo, aviso)) r.push({ id: 'data', rotulo: PERGUNTAS[perguntaData(tipo, aviso)].rotulo, tipo: 'data', valor: data || '' });
  if (tipo === 'experiencia' && iniciativa === 'empregado' && typeof desconta === 'boolean') {
    r.push({ id: 'desconto', rotulo: PERGUNTAS.descontoExperiencia.rotulo, valor: textoOpcao('descontoExperiencia', desconta ? 'sim' : 'nao') });
  }
  r.push({ id: 'obs', rotulo: PERGUNTAS.obs.rotulo, valor: obs || '' });
  return r;
}
