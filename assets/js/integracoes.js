// ============================================================
// MACEDO & REIS — Integrações (19/11/2026, pedido do Samuel: "to com dificuldade de visualizar e poder mostrar para
// equipe o que a integração da dominio e o integra contador realmente fazem … um módulo pra cada uma dessas
// integrações, e dentro a listagem das nossas empresas onde clicando abrimos o 'perfil' dela")
// As regras do card Integrações do Painel, da página integracoes.html e das duas telas (integracao-dominio.html e
// integracao-receita.html, montadas por assets/js/integracoes-tela.js): a saúde de cada ponte, a carteira de hoje, a
// linha de cada empresa em cada integração, os filtros, a ordem e o que o perfil mostra.
// Só leitura do que as pontes já gravam (dominio_*, receita_*) e do que o vigia avisa (vigia_achados): nada é gravado.
// Só as empresas de hoje da carteira (decisão do Samuel).
// Puro, menos os "ler…" e "carregar…" do fim. Testes: tests/integracoes.test.mjs e tests/harness/integracoes.py.
// ============================================================
import { feriado, somaDias, diasEntre } from './rescisao-datas.js';
import { nomeDaEmpresa, semAcento, dominioPorMes, andamentoDaEmpresa, encerramentoDaEmpresa } from './contabil-controle.js';
import { CAMPOS, CAMPOS_VALOR, mesAntes } from './dominio-ficha.js';
import { diaEmBrasilia } from './receita-ficha.js';
import { padraoDoGrupo } from './jornada-6x1.js';

const RE_MES = /^\d{4}-\d{2}$/;
const RE_DIA = /^\d{4}-\d{2}-\d{2}$/;
const dia10 = v => { const s = String(v || '').slice(0, 10); return RE_DIA.test(s) ? s : null; };
const num = v => (v == null || v === '' || Number.isNaN(+v) ? null : +v);

export const dataBR = iso => { const d = dia10(iso); return d ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : ''; };
export const diaMes = iso => dataBR(iso).slice(0, 5);
export const mesBR = c => (RE_MES.test(String(c || '')) ? c.slice(5, 7) + '/' + c.slice(0, 4) : '');
export const inteiro = v => Number(v).toLocaleString('pt-BR');
export const dinheiro = v => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const plural = (n, um, varios) => inteiro(n) + ' ' + (Number(n) === 1 ? um : varios);
/** O mês 'AAAA-MM' de n meses depois (n negativo: antes). */
export const somaMes = (c, n) => mesAntes(c, -n);

// ---------- as horas, em Brasília ----------
/** A hora de um carimbo, em Brasília: "07h12". */
export function horaEmBrasilia(momento) {
  const d = new Date(momento);
  if (Number.isNaN(d.getTime())) return '';
  const p = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
  const de = t => (p.find(x => x.type === t) || { value: '00' }).value.padStart(2, '0');
  return de('hour') + 'h' + de('minute');
}
/** "hoje às 07h12", "ontem às 07h12", "em 17/11 às 07h12" (com o ano, se for outro). */
export function quandoFoi(momento, agora) {
  const dia = diaEmBrasilia(momento), hoje = diaEmBrasilia(agora);
  if (!dia || !hoje) return '';
  const d = diasEntre(dia, hoje);
  const qual = d === 0 ? 'hoje' : d === 1 ? 'ontem' : 'em ' + (dia.slice(0, 4) === hoje.slice(0, 4) ? diaMes(dia) : dataBR(dia));
  return qual + ' às ' + horaEmBrasilia(momento);
}
/** "hoje", "amanhã" ou o dia ("25/11"; com o ano, se for outro). */
export function rotuloDoDia(iso, hoje) {
  const d = dia10(iso);
  if (!d) return '';
  const n = diasEntre(hoje, d);
  return n === 0 ? 'hoje' : n === 1 ? 'amanhã' : (d.slice(0, 4) === String(hoje).slice(0, 4) ? diaMes(d) : dataBR(d));
}

// ---------- a saúde de cada ponte ----------
// As duas rodam no PC do escritório, que fica ligado dia e noite: a do Domínio todo dia às 7h; a da Receita de segunda
// a sexta às 8h30 (com feriado também: a tarefa do Windows não sabe de feriado). A rodada tem 2 horas pra chegar; a
// partir de 4 dias sem nenhuma, a ponte está parada — a mesma conta do vigia (ponte_parada, ponte_dominio_parada).
export const PONTES = {
  dominio: { hora: 7, minuto: 0, uteis: false },
  receita: { hora: 8, minuto: 30, uteis: true }
};
export const TOLERANCIA_MS = 2 * 60 * 60 * 1000;
export const DIAS_PARADA = 4;
// Brasília está 3 horas atrás do UTC o ano inteiro (sem horário de verão desde 2019)
const momentoEmBrasilia = (iso, h, min) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10), h + 3, min);
const diaDaSemana = iso => new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))).getUTCDay();
const fimDeSemana = iso => { const s = diaDaSemana(iso); return s === 0 || s === 6; };

/** A hora marcada (em milissegundos) da rodada mais recente que já devia ter chegado; null se nenhuma nos últimos dias. */
export function rodadaEsperada(tipo, agora) {
  const p = PONTES[tipo], t = new Date(agora).getTime();
  if (!p || Number.isNaN(t)) return null;
  let dia = diaEmBrasilia(t);
  for (let i = 0; i < 12; i++, dia = somaDias(dia, -1)) {
    if (p.uteis && fimDeSemana(dia)) continue;
    const marcada = momentoEmBrasilia(dia, p.hora, p.minuto);
    if (marcada + TOLERANCIA_MS <= t) return marcada;
  }
  return null;
}

/** estado: 'ok' (a rodada esperada chegou), 'atrasada', 'parada' (4 dias ou mais sem nenhuma) ou 'nunca'. */
export function saudeDaPonte(tipo, ultima, agora) {
  const t = new Date(agora).getTime();
  const u = ultima ? new Date(ultima).getTime() : NaN;
  if (Number.isNaN(u)) return { tipo, estado: 'nunca', ultima: null };
  const esperada = rodadaEsperada(tipo, agora);
  if (esperada == null || u >= esperada) return { tipo, estado: 'ok', ultima: u };
  return { tipo, estado: (t - u) / 864e5 >= DIAS_PARADA ? 'parada' : 'atrasada', ultima: u, esperada };
}

/** A frase curta da saúde: "Lida hoje às 07h12", "Sem leitura desde 17/11", "Parada desde 12/11", "Ainda sem leitura". */
export function textoDaSaude(s, agora) {
  if (!s || s.estado === 'nunca') return 'Ainda sem leitura';
  const receita = s.tipo === 'receita';
  if (s.estado === 'ok') return (receita ? 'Consultada ' : 'Lida ') + quandoFoi(s.ultima, agora);
  const dia = rotuloDoDia(diaEmBrasilia(s.ultima), diaEmBrasilia(agora));
  if (s.estado === 'parada') return 'Parada desde ' + dia;
  return (receita ? 'Sem consulta desde ' : 'Sem leitura desde ') + dia;
}

/** O selo do card Integrações do Painel: "Em dia" ou quantas pontes estão atrasadas. */
export function seloDasPontes(saudes) {
  const fora = (saudes || []).filter(s => s && s.estado !== 'ok').length;
  return fora ? { texto: fora + (fora === 1 ? ' atrasada' : ' atrasadas'), classe: 'st-open', fora } : { texto: 'Em dia', classe: 'st-clear', fora: 0 };
}

/** A rodada mais recente de uma lista (pela hora em que chegou ao sistema). */
export function ultimaRodada(rodadas) {
  let melhor = null;
  for (const r of rodadas || []) if (r && r.recebida_em && (!melhor || String(r.recebida_em) > String(melhor.recebida_em))) melhor = r;
  return melhor;
}

// O Integra Contador cobra por consulta: a ponte para no teto do mês (teto_mes, no config.ini do PC do escritório).
// O número daqui é o combinado; mudou lá, mude aqui.
export const TETO_MES = 1500;
/** As consultas do mês de hoje à Receita: a contagem da rodada mais recente do mês (null se ainda não houve rodada). */
export function chamadasDoMes(rodadas, hoje) {
  const mes = String(hoje).slice(0, 7);
  const doMes = (rodadas || []).filter(r => r && r.recebida_em && String(diaEmBrasilia(r.recebida_em)).slice(0, 7) === mes && num(r.chamadas_mes) != null);
  const u = ultimaRodada(doMes);
  return u ? +u.chamadas_mes : null;
}

// ---------- o calendário das consultas da Receita (ponte/receita/calendario.py) ----------
// A tarefa roda de segunda a sexta. Cada consulta tem o dia marcado e roda nele ou na primeira rodada depois dele.
/** O dia, ou a segunda-feira seguinte se cair no fim de semana (o "dia útil" da ponte: feriado conta). */
export function diaDeSemana(iso) { let d = iso; while (fimDeSemana(d)) d = somaDias(d, 1); return d; }
const expediente = iso => !fimDeSemana(iso) && !feriado(iso);
/** O prazo do PGDAS da competência 'AAAA-MM': o dia 20 do mês seguinte ou, sem expediente, o primeiro dia útil depois. */
export function prazoPgdas(competencia) {
  let d = somaMes(competencia, 1) + '-20';
  while (!expediente(d)) d = somaDias(d, 1);
  return d;
}
/** O dia em que a ponte consulta o PGDAS da competência: o primeiro dia útil depois do prazo. */
export function consultaPgdas(competencia) {
  let d = somaDias(prazoPgdas(competencia), 1);
  while (!expediente(d)) d = somaDias(d, 1);
  return d;
}

export const CONSULTAS = [
  { chave: 'autorizacao', nome: 'Procuração', traz: 'Se o escritório tem a autorização de acesso da empresa e até quando ela vale.',
    quando: 'No primeiro dia útil do mês. Quem está sem, toda segunda-feira.' },
  { chave: 'pgdas', nome: 'PGDAS', traz: 'Só do Simples: a declaração transmitida, se o DAS foi pago, a receita do mês e a dos 12 meses anteriores.',
    quando: 'No dia útil seguinte ao prazo (o dia 20). No fim do mês, de novo, pra quem tinha mês sem declaração.' },
  { chave: 'caixa_postal', nome: 'Caixa Postal', traz: 'As mensagens do e-CAC: o assunto, de onde veio e se foi lida. O texto fica no e-CAC.',
    quando: 'Todo dia útil.' },
  { chave: 'situacao_fiscal', nome: 'Situação fiscal', traz: 'As pendências na Receita e na PGFN, com o PDF do relatório salvo na pasta da empresa no Drive.',
    quando: 'No dia 5 de cada mês.' },
  { chave: 'pagamentos', nome: 'Pagamentos', traz: 'As guias pagas (DAS, DARF): o dia, o valor, a multa, os juros e a parte de cada tributo.',
    quando: 'No dia 25 de cada mês: o DAS e o DARF vencem no dia 20.' }
];

/** A próxima vez de cada consulta, a partir de hoje: [{ chave, quando: 'AAAA-MM-DD' }], na ordem de CONSULTAS. */
export function proximasConsultas(hoje) {
  const mes = String(hoje).slice(0, 7), prox = somaMes(mes, 1), ant = somaMes(mes, -1);
  const primeira = (...dias) => dias.filter(d => d >= hoje).sort()[0] || null;
  const quando = {
    autorizacao: primeira(diaDeSemana(mes + '-01'), diaDeSemana(prox + '-01')),
    pgdas: primeira(consultaPgdas(ant), consultaPgdas(mes)),
    caixa_postal: diaDeSemana(hoje),
    situacao_fiscal: primeira(diaDeSemana(mes + '-05'), diaDeSemana(prox + '-05')),
    pagamentos: primeira(diaDeSemana(mes + '-25'), diaDeSemana(prox + '-25'))
  };
  return CONSULTAS.map(c => ({ chave: c.chave, quando: quando[c.chave] }));
}

// O que a ponte do Domínio lê (todo dia às 7h, os últimos 14 meses de novo): só os totais por empresa e por mês.
export const BLOCOS_DO_DOMINIO = [
  { nome: 'Folha', traz: 'Os empregados ativos, as admissões, os desligamentos, os afastados e os sócios com pró-labore. Em reais: salários, 13º, pró-labore, FGTS e INSS.' },
  { nome: 'Notas e faturamento', traz: 'Quantas notas de saída e de entrada e o valor. O faturamento do mês, a apuração do Simples com o RBT12 e as compras.' },
  { nome: 'Impostos das notas', traz: 'As vendas pelo CFOP, o ICMS, o PIS/Cofins e a presunção do Presumido: o que o Comparativo tributário usa.' },
  { nome: 'Contabilidade', traz: 'Os lançamentos por origem, o resultado do mês e até onde o banco, o caixa e o extrato estão lançados, com o zeramento de cada ano.' },
  { nome: 'Jornada', traz: 'A jornada dos funcionários somada por grupo, com a escala e as horas: o que a Escala 6x1 usa.' }
];

// ---------- o último mês fechado (a regra do Comparativo e do Fator R) ----------
/** Depois do dia 20, o mês passado; até o dia 20, o de dois meses atrás. hoje: 'AAAA-MM-DD'. */
export function ultimoMesFechado(hoje) {
  const d = dia10(hoje);
  if (!d) return null;
  return mesAntes(d, +d.slice(8, 10) > 20 ? 1 : 2);
}
/** O mês de hoje e o passado ainda estão em fechamento no Domínio. */
export const emFechamento = (c, hoje) => c === String(hoje).slice(0, 7) || c === mesAntes(hoje, 1);

// ---------- a carteira de hoje ----------
/** As empresas de hoje da carteira (carteira_info com o cadastro junto): a entrada marcada e sem saída até hoje. */
export function carteiraDeHoje(linhas, hoje) {
  const vistos = new Set(), out = [];
  for (const k of linhas || []) {
    const c = k && k.clientes;
    if (!k || !k.cliente_id || !c || !k.entrada || (k.saida && String(k.saida) <= hoje) || vistos.has(k.cliente_id)) continue;
    vistos.add(k.cliente_id);
    const razao = String(c.nome_principal || '').trim(), fantasia = String(c.nome_fantasia || '').trim();
    out.push({ id: k.cliente_id, nome: nomeDaEmpresa(c), razao, fantasia, documento: c.documento || '', tipoPessoa: c.tipo_pessoa || null,
      regime: c.regime_tributario || null, status: c.status || null, cidade: String(c.cidade || '').trim(), uf: String(c.uf || '').trim(), entrada: dia10(k.entrada),
      busca: semAcento([razao, fantasia, c.documento, String(c.documento || '').replace(/\D/g, ''), c.regime_tributario, c.cidade].filter(Boolean).join(' ')) });
  }
  return out.sort((a, b) => semAcento(a.nome).localeCompare(semAcento(b.nome)) || String(a.id).localeCompare(String(b.id)));
}

// Quem a ponte da Receita consulta (empresasDaCarteira, em supabase/functions/ponte/receita.js — o teste confere as
// duas): a empresa com CNPJ e o regime do Simples, do MEI, do Presumido ou do Real.
export const REGIMES_DA_RECEITA = ['Simples Nacional', 'MEI', 'Lucro Presumido', 'Lucro Real'];
/** Por que a empresa fica fora da consulta da Receita; null = é consultada. */
export function foraDaConsulta(emp) {
  const doc = String((emp && emp.documento) || '').replace(/[^0-9A-Za-z]/g, '');
  if (doc.length !== 14) return doc.length === 11 ? 'Pessoa física: a ponte consulta empresas, pelo CNPJ.' : 'Sem CNPJ no cadastro.';
  if (!REGIMES_DA_RECEITA.includes(emp.regime)) {
    return (emp.regime ? 'Regime ' + emp.regime : 'Sem regime no cadastro') + ': a ponte consulta as empresas do Simples, do MEI, do Presumido e do Real.';
  }
  return null;
}

// ---------- o vigia ----------
// Os avisos do vigia que nascem de cada integração (as regras de vigia_regras_dominio e vigia_regras_receita).
const REGRA_DA = { dominio: /^dominio_/, receita: /^receita_/ };
const PESO = { alta: 0, media: 1, baixa: 2 };
/** Os avisos abertos do vigia de uma integração, por empresa: Map(cliente_id → [aviso]), o urgente primeiro. */
export function avisosPorCliente(achados, tipo) {
  const m = new Map(), re = REGRA_DA[tipo];
  for (const a of achados || []) {
    if (!a || !a.cliente_id || !re || !re.test(String(a.regra || '')) || (a.situacao && a.situacao !== 'aberto')) continue;
    if (!m.has(a.cliente_id)) m.set(a.cliente_id, []);
    m.get(a.cliente_id).push(a);
  }
  for (const l of m.values()) l.sort((a, b) => (PESO[a.gravidade] ?? 1) - (PESO[b.gravidade] ?? 1) || String(a.titulo || '').localeCompare(String(b.titulo || '')));
  return m;
}

const agrupar = (linhas, chave = 'cliente_id') => {
  const m = new Map();
  for (const l of linhas || []) { if (!l || l[chave] == null) continue; if (!m.has(l[chave])) m.set(l[chave], []); m.get(l[chave]).push(l); }
  return m;
};

// ---------- o Domínio: a linha de cada empresa ----------
// o que a lista lê de dominio_mensal (o perfil lê o resto)
export const CAMPOS_DA_LISTA = ['funcionarios_ativos', 'pro_labore', 'notas_saida', 'notas_entrada', 'lancamentos', 'receita_bruta', 'receita_simples', 'lanc_normais', 'lanc_extrato'];

/**
 * A linha de uma empresa no Domínio, num mês. dados: { codigos: [{ codigo, ativa }], porMes: Map(mês → números, de
 * dominioPorMes), avisos: [aviso do vigia] }. O null segue null: o Domínio não disse.
 */
export function linhaDominio(emp, dados, mes) {
  const { codigos = [], porMes = new Map(), avisos = [] } = dados || {};
  const ligada = codigos.length > 0;
  const inativa = ligada && codigos.every(c => c.ativa === false);
  const d = porMes.get(mes) || null;
  const comLanc = [...porMes.values()].filter(m => (+m.lanc_normais || 0) + (+m.lanc_extrato || 0) > 0).map(m => m.competencia).sort();
  const leuOrigens = [...porMes.values()].some(m => m.lanc_normais != null || m.lanc_extrato != null);
  const n = k => (d && d[k] != null ? +d[k] : null);
  const semMovimento = ligada && !(n('notas_saida') > 0 || n('notas_entrada') > 0 || n('funcionarios_ativos') > 0 || n('pro_labore') > 0 || n('lancamentos') > 0);
  return {
    ...emp, ligada, inativa, codigos: codigos.map(c => c.codigo).sort((a, b) => a - b), mes,
    funcionarios: n('funcionarios_ativos'), proLabore: n('pro_labore'), faturamento: n('receita_bruta'), noSimples: n('receita_simples'),
    notasSaida: n('notas_saida'), notasEntrada: n('notas_entrada'), lancamentos: n('lancamentos'),
    contadorAte: comLanc.length ? comLanc[comLanc.length - 1] : null, leuOrigens, semMovimento, avisos
  };
}

export const FOCOS_DOMINIO = [
  ['todas', 'Todas'], ['funcionarios', 'Com funcionários'], ['sem_movimento', 'Sem movimento no mês'],
  ['avisos', 'Com aviso do vigia'], ['sem_ligacao', 'Sem ligação ou inativa']
];
export function focosDominio(l) {
  const f = new Set(['todas']);
  if (l.funcionarios > 0) f.add('funcionarios');
  if (l.semMovimento && !l.inativa) f.add('sem_movimento');
  if (l.avisos && l.avisos.length) f.add('avisos');
  if (!l.ligada || l.inativa) f.add('sem_ligacao');
  return f;
}

/** As linhas do Domínio de todas as empresas, no mês. base: { codigos, mensal, achados } (as leituras cruas). */
export function linhasDoDominio(empresas, base, mes) {
  const cods = agrupar(base.codigos), mens = agrupar(base.mensal), av = avisosPorCliente(base.achados, 'dominio');
  return (empresas || []).map(e => linhaDominio(e, { codigos: cods.get(e.id) || [], porMes: dominioPorMes(mens.get(e.id) || []), avisos: av.get(e.id) || [] }, mes));
}
/** Os meses que o Domínio tem (o mais novo primeiro). */
export const mesesDoDominio = mensal => [...new Set((mensal || []).map(l => l && l.competencia).filter(c => RE_MES.test(String(c || ''))))].sort().reverse();

// ---------- a Receita: a linha de cada empresa ----------
export const DIAS_VENCENDO = 30;      // a procuração a 30 dias de vencer (a conta do vigia)
export const DIAS_NAO_LIDAS = 90;     // as mensagens não lidas dos últimos 90 dias

// De quem é a procuração (19/11/2026, a coluna autorizacao_via, que a ponte 0.4.4 manda): a do CNPJ do escritório ou a do
// CPF do procurador — o Diego, em nome de quem a ponte consulta a empresa pelo Autentica Procurador
export const DE_QUEM = { escritorio: 'pro CNPJ do escritório', procurador: 'pro CPF do Diego' };
/** A procuração (a autorização de acesso) em palavras. estado: fora, nao_consultada, sem, vencida, vencendo, ativa.
 *  Na que tem procuração (ativa, vencendo ou vencida), via: 'escritorio' | 'procurador' | null (a ponte ainda não disse). */
export function procuracaoDe(rec, fora, hoje) {
  if (fora) return { estado: 'fora', texto: 'fora da consulta', porque: fora };
  if (!rec || !rec.autorizacao) return { estado: 'nao_consultada', texto: 'ainda não consultada' };
  const ate = dia10(rec.autorizacao_ate);
  if (rec.autorizacao === 'sem') return { estado: 'sem', texto: 'sem procuração' };
  const via = Object.prototype.hasOwnProperty.call(DE_QUEM, rec.autorizacao_via) ? rec.autorizacao_via : null;
  if (rec.autorizacao === 'vencida' || (rec.autorizacao === 'ativa' && ate && ate < hoje)) return { estado: 'vencida', texto: ate ? 'vencida em ' + dataBR(ate) : 'vencida', ate, via };
  if (rec.autorizacao !== 'ativa') return { estado: 'nao_consultada', texto: 'ainda não consultada' };
  const dias = ate ? diasEntre(hoje, ate) : null;
  if (dias != null && dias <= DIAS_VENCENDO) return { estado: 'vencendo', texto: dias === 0 ? 'vence hoje' : 'vence em ' + plural(dias, 'dia', 'dias'), ate, dias, via };
  return { estado: 'ativa', texto: ate ? 'ativa até ' + dataBR(ate) : 'ativa', ate, dias, via };
}
/** Das empresas com procuração (ativa ou vencendo), de quem ela é: { escritorio, procurador, semDizer } (as linhas da lista). */
export function procuracoesPorVia(linhas) {
  const n = { escritorio: 0, procurador: 0, semDizer: 0 };
  for (const l of linhas || []) {
    const p = l && l.procuracao;
    if (!p || !['ativa', 'vencendo'].includes(p.estado)) continue;
    n[p.via || 'semDizer']++;
  }
  return n;
}

/** O mês 'AAAA-MM' do período de apuração de uma guia (ou de uma parte dela). */
export const mesDaApuracao = iso => { const d = dia10(iso); return d ? d.slice(0, 7) : null; };
// A guia do Simples (o tipo 9, o DAS) sem a referência da dívida ativa: nos pagamentos lidos em 19/11/2026 ela vem de
// dois jeitos, e só o primeiro é o DAS de um mês.
//   o DAS do mês (o do PGDAS ou o do MEI): o período de apuração no dia 1º e o vencimento no mês seguinte (o dia 20);
//     uma guia só pode pagar vários meses atrasados de uma vez, e aí cada parte diz o mês dela
//   a parcela de um parcelamento: o período no último dia do mês da parcela, o vencimento dentro desse mesmo mês e, nas
//     partes, os meses antigos que a parcela amortiza — ela NÃO paga o DAS do mês em que vence
// Quem separa é o vencimento: o DAS de um mês nunca vence dentro dele. O vigia usa a mesma regra (vigia_regras_receita,
// a parte das_pago): mudou aqui, mude lá.
const mesmoSimples = g => !!g && String(g.tipo_codigo) === '9' && !String(g.referencia || '').trim()
  && !(Array.isArray(g.partes) ? g.partes : []).some(p => /R D Ativa|D[ií]vida Ativa|Parcelamento/i.test(String((p && p.receita) || '')));
/** A guia é a parcela de um parcelamento do Simples (ou do MEI)? Vence dentro do mês do próprio período de apuração. */
export function ehParcelaDoSimples(g) {
  if (!mesmoSimples(g)) return false;
  const pa = dia10(g.periodo_apuracao), venc = dia10(g.vencimento);
  return !!pa && !!venc && venc.slice(0, 7) <= pa.slice(0, 7);
}
/** A guia é o DAS de um mês (o do PGDAS ou o do MEI)? Fora a de dívida ativa (com a referência) e a parcela de
 *  parcelamento; sem o período ou sem o vencimento não dá pra dizer, e ela não conta. */
export function ehDasDoMes(g) {
  if (!mesmoSimples(g)) return false;
  const pa = dia10(g.periodo_apuracao), venc = dia10(g.vencimento);
  return !!pa && !!venc && venc.slice(0, 7) > pa.slice(0, 7);
}
// os centavos de cada mês que a guia pagou: Map('AAAA-MM' → centavos). A parte sem o período fica no mês da guia; sem
// partes (ou com um mês só), o total da guia
function centavosPorMes(g) {
  const c = v => Math.round((+v || 0) * 100);
  const topo = mesDaApuracao(g.periodo_apuracao), m = new Map();
  for (const p of (Array.isArray(g.partes) ? g.partes : []).filter(Boolean)) {
    const mes = mesDaApuracao(p.periodo_apuracao) || topo;
    if (!mes) continue;
    const v = p.valor_total != null && p.valor_total !== '' ? c(p.valor_total) : c(p.principal) + c(p.multa) + c(p.juros);
    m.set(mes, (m.get(mes) || 0) + v);
  }
  if (!m.size && topo) m.set(topo, 0);
  if (m.size === 1) m.set([...m.keys()][0], c(g.valor_total));
  return m;
}
/** Os meses que a guia do DAS pagou (os das partes; sem elas, o da guia), em ordem. A que não é o DAS de um mês: nenhum. */
export const mesesDoDas = g => (ehDasDoMes(g) ? [...centavosPorMes(g).keys()].sort() : []);
/** Quanto da guia do DAS é de um mês: o total dela, ou, na guia de vários meses, a soma das partes daquele mês. */
export const valorNoMes = (g, mes) => (ehDasDoMes(g) ? (centavosPorMes(g).get(mes) || 0) / 100 : 0);
/** As guias do DAS por mês pago: Map('AAAA-MM' → [guia]), a paga primeiro na frente. A guia de vários meses entra em cada um. */
export function dasPorMes(guias) {
  const m = new Map();
  for (const g of guias || []) {
    for (const c of mesesDoDas(g)) {
      if (!m.has(c)) m.set(c, []);
      m.get(c).push(g);
    }
  }
  for (const l of m.values()) l.sort((a, b) => String(a.arrecadado_em).localeCompare(String(b.arrecadado_em)));
  return m;
}
/** Os meses declarados em que a Receita mostra o DAS sem pagar e não há guia paga do DAS daquele mês (a regra do aviso
 *  "DAS sem pagar" do vigia, sem a parte do parcelamento, que o vigia tira pelo relatório de situação fiscal). */
export function mesesSemPagamento(pgdas, guias) {
  const das = dasPorMes(guias);
  return (pgdas || []).filter(p => p && p.transmitida_em && p.das_pago === false && !das.has(p.competencia)).map(p => p.competencia).sort();
}
/** As empresas que a Receita mostra com algum DAS declarado e sem pagar: só delas a lista precisa das partes das guias. */
export const comDasSemPagar = pgdas => [...new Set((pgdas || []).filter(p => p && p.cliente_id && p.transmitida_em && p.das_pago === false).map(p => p.cliente_id))];
/** As mensagens não lidas dos últimos 90 dias (pela data em que a Receita mandou; sem ela, a da chegada). */
export function naoLidasRecentes(mensagens, hoje) {
  const desde = somaDias(hoje, -DIAS_NAO_LIDAS);
  return (mensagens || []).filter(m => m && m.lida === false && (dia10(m.enviada_em) || diaEmBrasilia(m.recebida_em) || '') >= desde);
}

/**
 * A linha de uma empresa na Receita. dados: { receita: linha de receita_empresas | null, pgdas, mensagens, guias,
 * avisos }. O que não foi consultado fica null (a tela mostra o traço).
 */
export function linhaReceita(emp, dados, hoje) {
  const { receita = null, pgdas = [], mensagens = [], guias = [], avisos = [] } = dados || {};
  const fora = foraDaConsulta(emp);
  const procuracao = procuracaoDe(receita, fora, hoje);
  const pend = receita && Array.isArray(receita.pendencias) ? receita.pendencias.length : null;
  const declarados = pgdas.filter(p => p && p.transmitida_em).map(p => p.competencia).sort();
  const leuGuias = !!(receita && receita.pagamentos_ate);
  const umAno = somaDias(hoje, -365);
  const pagas = guias.map(g => dia10(g && g.arrecadado_em)).filter(Boolean).sort();
  return {
    ...emp, fora, procuracao,
    pendencias: pend, situacaoEm: receita ? dia10(receita.situacao_fiscal_em) : null,
    simples: emp.regime === 'Simples Nacional', pgdasAte: declarados.length ? declarados[declarados.length - 1] : null,
    semPagamento: mesesSemPagamento(pgdas, guias),
    // sem a procuração (ou com ela vencida) e sem mensagem nenhuma: a Caixa Postal não foi consultada
    naoLidas: receita && (mensagens.length || ['ativa', 'vencendo'].includes(procuracao.estado)) ? naoLidasRecentes(mensagens, hoje).length : null, mensagens: mensagens.length,
    guias12: leuGuias ? pagas.filter(d => d >= umAno).length : null, ultimaGuia: pagas.length ? pagas[pagas.length - 1] : null,
    pagamentosAte: receita ? dia10(receita.pagamentos_ate) : null, avisos
  };
}

export const FOCOS_RECEITA = [
  ['todas', 'Todas'], ['pendencias', 'Com pendência'], ['das', 'DAS sem pagamento'], ['mensagens', 'Mensagens não lidas'],
  ['sem_procuracao', 'Sem procuração ou vencida'], ['fora', 'Fora da consulta']
];
export function focosReceita(l) {
  const f = new Set(['todas']);
  if (l.pendencias > 0) f.add('pendencias');
  if (l.semPagamento && l.semPagamento.length) f.add('das');
  if (l.naoLidas > 0) f.add('mensagens');
  if (['sem', 'vencida', 'vencendo'].includes(l.procuracao.estado)) f.add('sem_procuracao');
  if (l.procuracao.estado === 'fora') f.add('fora');
  return f;
}

/** As linhas da Receita de todas as empresas. base: { empresas, pgdas, mensagens, guias, achados } (as leituras cruas). */
export function linhasDaReceita(empresas, base, hoje) {
  const rec = new Map((base.empresas || []).map(r => [r.cliente_id, r]));
  const pg = agrupar(base.pgdas), ms = agrupar(base.mensagens), gs = agrupar(base.guias), av = avisosPorCliente(base.achados, 'receita');
  return (empresas || []).map(e => linhaReceita(e, { receita: rec.get(e.id) || null, pgdas: pg.get(e.id) || [], mensagens: ms.get(e.id) || [],
    guias: gs.get(e.id) || [], avisos: av.get(e.id) || [] }, hoje));
}

/** Os números dos dois cards da página Integrações: quantas empresas da carteira estão ligadas ao Domínio e com procuração. */
export function resumoDaCarteira(empresas, codigos, receitas, hoje) {
  const ids = new Set((empresas || []).map(e => e.id));
  const ligadas = new Set((codigos || []).filter(c => c && ids.has(c.cliente_id)).map(c => c.cliente_id)).size;
  const rec = new Map((receitas || []).map(r => [r.cliente_id, r]));
  const consultadas = (empresas || []).filter(e => !foraDaConsulta(e));
  const comProcuracao = consultadas.filter(e => ['ativa', 'vencendo'].includes(procuracaoDe(rec.get(e.id) || null, null, hoje).estado)).length;
  return { carteira: ids.size, ligadas, consultadas: consultadas.length, comProcuracao };
}

// ---------- a lista: os números do alto, a busca e a ordem ----------
/** Quantas linhas em cada foco: { chave: n }. */
export function contarFocos(linhas, focosDe, focos) {
  const n = Object.fromEntries(focos.map(([k]) => [k, 0]));
  for (const l of linhas || []) for (const k of focosDe(l)) if (k in n) n[k]++;
  return n;
}
/** As linhas do foco que batem com a busca (nome, fantasia, CNPJ, regime, cidade e o código do Domínio). */
export function filtrar(linhas, focosDe, foco, busca) {
  const termos = semAcento(String(busca || '').trim()).split(/\s+/).filter(Boolean);
  return (linhas || []).filter(l => {
    if (!focosDe(l).has(foco)) return false;
    if (!termos.length) return true;
    const alvo = l.busca + ' ' + (l.codigos || []).join(' ');
    return termos.every(t => alvo.includes(t));
  });
}

// o valor de cada coluna pra ordenar (null = sem o número: vai pro fim nos dois sentidos)
const ORDEM_DA_PROCURACAO = { vencida: 0, vencendo: 1, sem: 2, nao_consultada: 3, ativa: 4, fora: 5 };
export const COLUNAS = {
  dominio: {
    nome: l => semAcento(l.nome),
    funcionarios: l => l.funcionarios,
    faturamento: l => l.faturamento,
    notas: l => (l.notasSaida == null && l.notasEntrada == null ? null : (l.notasSaida || 0) + (l.notasEntrada || 0)),
    contador: l => l.contadorAte
  },
  receita: {
    nome: l => semAcento(l.nome),
    procuracao: l => ORDEM_DA_PROCURACAO[l.procuracao.estado] * 1e6 + (l.procuracao.dias != null ? Math.max(0, Math.min(l.procuracao.dias, 999999)) : 0),
    pendencias: l => l.pendencias,
    pgdas: l => (l.simples && l.pgdasAte ? l.semPagamento.length : null),
    mensagens: l => l.naoLidas,
    guias: l => l.guias12
  }
};
// o primeiro clique de cada coluna: o nome e a procuração crescem (A a Z, quem precisa de atenção primeiro); os números, do maior pro menor
export const SENTIDO_INICIAL = { nome: 'asc', procuracao: 'asc', contador: 'asc' };
/** A ordem que o clique no título pede: outra coluna = o sentido inicial dela; a mesma = inverte. */
export function proximaOrdem(atual, coluna) {
  if (!atual || atual.coluna !== coluna) return { coluna, sentido: SENTIDO_INICIAL[coluna] || 'desc' };
  return { coluna, sentido: atual.sentido === 'asc' ? 'desc' : 'asc' };
}
/** As linhas na ordem pedida: quem não tem o número fica no fim nos dois sentidos, e o empate vai pelo nome. */
export function ordenar(linhas, tipo, ordem) {
  const col = (COLUNAS[tipo] || {})[ordem && ordem.coluna] || COLUNAS[tipo].nome;
  const s = ordem && ordem.sentido === 'desc' ? -1 : 1;
  return [...(linhas || [])].sort((a, b) => {
    const x = col(a), y = col(b);
    if (x == null || y == null) { if (x == null && y == null) return semAcento(a.nome).localeCompare(semAcento(b.nome)); return x == null ? 1 : -1; }
    const c = typeof x === 'string' || typeof y === 'string' ? String(x).localeCompare(String(y)) : x - y;
    return c ? c * s : semAcento(a.nome).localeCompare(semAcento(b.nome));
  });
}

// ---------- o perfil no Domínio ----------
/**
 * O faturamento do Domínio ao lado do declarado no PGDAS, nos meses em que a ponte da Receita leu a declaração.
 * meses: os de dominioPorMes (Map) · pgdas: receita_pgdas. O Domínio = a apuração do Simples (com as filiais, como o
 * PGDAS), senão a receita bruta. Igual = até R$ 1,00 de diferença (a tolerância do vigia).
 */
export function conferenciaDoFaturamento(porMes, pgdas, max = 6) {
  const out = [];
  for (const p of pgdas || []) {
    if (!p || !RE_MES.test(String(p.competencia || '')) || num(p.receita_mes) == null) continue;
    const m = porMes && porMes.get(p.competencia);
    const simples = m && m.receita_simples != null ? +m.receita_simples : null, bruta = m && m.receita_bruta != null ? +m.receita_bruta : null;
    const dominio = simples != null ? simples : bruta;
    const diferenca = dominio == null ? null : Math.round((dominio - +p.receita_mes) * 100) / 100;
    out.push({ competencia: p.competencia, dominio, fonte: dominio == null ? null : simples != null ? 'simples' : 'bruta', declarado: +p.receita_mes,
      diferenca, igual: diferenca == null ? null : Math.abs(diferenca) <= 1 });
  }
  return out.sort((a, b) => b.competencia.localeCompare(a.competencia)).slice(0, max);
}

/** Os grupos de jornada da empresa, o de mais gente primeiro: { jornada, escala, horas, empregados, afastados }. */
export function jornadasDoPerfil(grupos) {
  return (grupos || []).filter(g => g && +g.empregados > 0).map(g => {
    const p = padraoDoGrupo(g);
    return { jornada: String(g.jornada || '').trim(), escala: p.rotulo, horas: p.horas, empregados: +g.empregados, afastados: +g.afastados || 0 };
  }).sort((a, b) => b.empregados - a.empregados || a.jornada.localeCompare(b.jornada));
}

// ---------- o perfil na Receita ----------
/** O que a guia pagou, numa linha: "Simples Nacional: IRPJ, CSLL, Cofins" ou os dois primeiros tributos e "e mais N". */
export function resumoDasPartes(partes, max = 2) {
  const descs = [];
  for (const p of Array.isArray(partes) ? partes : []) {
    const d = String((p && p.receita) || '').replace(/\s+/g, ' ').trim();
    if (d && !descs.some(x => x.toLowerCase() === d.toLowerCase())) descs.push(d);
  }
  if (!descs.length) return '';
  const cortes = descs.map(d => { const i = d.indexOf(' - '); return i > 0 ? [d.slice(0, i).trim(), d.slice(i + 3).trim()] : null; });
  if (descs.length >= 2 && cortes.every(Boolean) && cortes.every(c => c[1].toLowerCase() === cortes[0][1].toLowerCase())) {
    // a grafia mais comum do nome (a Receita escreve "SImples Nacional - MEI" numa das linhas)
    const conta = new Map();
    cortes.forEach(c => conta.set(c[1], (conta.get(c[1]) || 0) + 1));
    const nome = [...conta.entries()].sort((a, b) => b[1] - a[1])[0][0];
    return nome + ': ' + [...new Set(cortes.map(c => c[0]))].join(', ');
  }
  return descs.slice(0, max).join(' · ') + (descs.length > max ? ' e mais ' + (descs.length - max) : '');
}

/** As guias pagas pro perfil, a mais recente primeiro, com o mês de apuração, o atraso e o que foi pago. das: o DAS de
 *  um mês (meses: os que ela pagou — mais de um na guia de vários meses) · parcela: a de um parcelamento do Simples. */
export function guiasDoPerfil(guias) {
  return (guias || []).filter(g => g && dia10(g.arrecadado_em)).map(g => {
    const pago = dia10(g.arrecadado_em), venc = dia10(g.vencimento);
    const atraso = venc && pago > venc ? diasEntre(venc, pago) : 0;
    const partes = (Array.isArray(g.partes) ? g.partes : []).filter(Boolean);
    return { numero: String(g.numero_documento || ''), tipo: String(g.tipo || '').trim() || 'Guia', tipoCodigo: g.tipo_codigo == null ? null : String(g.tipo_codigo),
      codigo: String(g.receita_codigo || '').trim(), receita: String(g.receita || '').trim(), mes: mesDaApuracao(g.periodo_apuracao), pagoEm: pago, vencimento: venc, atraso,
      total: num(g.valor_total) || 0, principal: num(g.valor_principal), multa: num(g.valor_multa) || 0, juros: num(g.valor_juros) || 0, saldo: num(g.saldo_total) || 0,
      referencia: String(g.referencia || '').trim(), resumo: resumoDasPartes(partes), partes, das: ehDasDoMes(g), meses: mesesDoDas(g), parcela: ehParcelaDoSimples(g) };
  }).sort((a, b) => b.pagoEm.localeCompare(a.pagoEm) || b.numero.localeCompare(a.numero));
}
/** Os tipos das guias pra filtrar: DAS, DARF e "outras" (o resto junto). */
export const tipoDoFiltro = g => (g.tipo === 'DAS' || g.tipo === 'DARF' ? g.tipo : 'outras');
/** As somas de uma lista de guias (em centavos inteiros, pra não acumular erro). */
export function totaisDasGuias(lista) {
  const c = v => Math.round((+v || 0) * 100);
  const t = { n: 0, total: 0, multa: 0, juros: 0, comAtraso: 0 };
  for (const g of lista || []) { t.n++; t.total += c(g.total); t.multa += c(g.multa); t.juros += c(g.juros); if (g.atraso > 0) t.comAtraso++; }
  return { n: t.n, total: t.total / 100, multa: t.multa / 100, juros: t.juros / 100, comAtraso: t.comAtraso };
}
/** Os anos em que há guia paga (o mais novo primeiro). */
export const anosDasGuias = lista => [...new Set((lista || []).map(g => g.pagoEm.slice(0, 4)))].sort().reverse();

/**
 * O PGDAS mês a mês pro perfil, o mais novo primeiro: do primeiro mês declarado ao último, com o buraco no meio marcado
 * (falta: a Receita não mostra declaração daquele mês) e as guias do DAS de cada mês — o dia do pagamento e o valor
 * daquele mês (meses: quantos a guia pagou; na de vários, o valor é só a parte do mês). A parcela de parcelamento não
 * é o DAS do mês e não entra aqui.
 */
export function pgdasDoPerfil(pgdas, guias) {
  const linhas = (pgdas || []).filter(p => p && RE_MES.test(String(p.competencia || '')));
  if (!linhas.length) return [];
  const das = dasPorMes(guias), por = new Map(linhas.map(p => [p.competencia, p]));
  const meses = [...por.keys()].sort();
  const out = [];
  for (let c = meses[0]; c <= meses[meses.length - 1]; c = somaMes(c, 1)) {
    const p = por.get(c), gs = (das.get(c) || []).map(g => ({ pagoEm: dia10(g.arrecadado_em), total: valorNoMes(g, c), numero: String(g.numero_documento || ''), meses: mesesDoDas(g).length }));
    out.push(p ? { competencia: c, falta: false, transmitidaEm: p.transmitida_em ? diaEmBrasilia(p.transmitida_em) : null, dasPago: p.das_pago === true ? true : p.das_pago === false ? false : null,
      receitaMes: num(p.receita_mes), receita12: num(p.receita_12_meses), guias: gs }
      : { competencia: c, falta: true, transmitidaEm: null, dasPago: null, receitaMes: null, receita12: null, guias: gs });
  }
  return out.reverse();
}

/** As mensagens da Caixa Postal, a mais recente primeiro (pela data em que a Receita mandou; sem ela, a da chegada). */
export function mensagensDoPerfil(mensagens) {
  const quando = m => dia10(m.enviada_em) || diaEmBrasilia(m.recebida_em) || '';
  return (mensagens || []).filter(Boolean).map(m => ({ assunto: String(m.assunto || '').trim(), origem: String(m.origem || '').trim(), lida: m.lida !== false, quando: quando(m) }))
    .sort((a, b) => b.quando.localeCompare(a.quando));
}

// ============================================================
// As leituras (o resto do arquivo é puro). Tudo só leitura, com as colunas explícitas.
// ============================================================
const PARTE = 60;   // ids por pedido (o endereço do pedido tem limite)
// ordem: as colunas de uma ordem estável (a paginação de mil em mil do todasLinhas precisa dela)
async function lerPorClientes(supabase, tabela, cols, ids, ordem, filtro) {
  const out = [];
  for (let i = 0; i < ids.length; i += PARTE) {
    const parte = ids.slice(i, i + PARTE);
    const { data, error } = await supabase.todasLinhas(() => {
      let q = supabase.from(tabela).select(cols).in('cliente_id', parte);
      if (filtro) q = filtro(q);
      for (const c of ordem) q = q.order(c);
      return q;
    });
    if (error) throw new Error(error.message || String(error));
    out.push(...(data || []));
  }
  return out;
}
const ou = r => { if (r.error) throw new Error(r.error.message || String(r.error)); return r.data || []; };

/** A saúde das duas pontes e o que cada uma leu por último. Erro na leitura de uma: ela vem com estado 'erro'. */
export async function lerSaude(supabase, agora = Date.now()) {
  const ler = async (tabela, cols, filtro) => {
    try {
      const r = await filtro(supabase.from(tabela).select(cols)).order('recebida_em', { ascending: false }).limit(40);
      return r.error ? null : (r.data || []);
    } catch (e) { return null; }
  };
  const [dom, rec] = await Promise.all([
    ler('dominio_rodadas', 'id, inicio, fim, dados_ate, ponte, empresas, ligadas, linhas, faltou, recebida_em', q => q),
    ler('receita_rodadas', 'id, inicio, fim, ponte, ambiente, chamadas_mes, empresas, sem_cadastro, recebida_em', q => q.eq('ambiente', 'producao'))
  ]);
  const hoje = diaEmBrasilia(agora);
  const de = (tipo, rodadas) => {
    if (!rodadas) return { tipo, estado: 'erro', ultima: null, rodada: null, texto: 'Não consegui ler agora' };
    const u = ultimaRodada(rodadas), s = saudeDaPonte(tipo, u && u.recebida_em, agora);
    return { ...s, rodada: u, texto: textoDaSaude(s, agora), chamadas: tipo === 'receita' ? chamadasDoMes(rodadas, hoje) : null };
  };
  return { dominio: de('dominio', dom), receita: de('receita', rec) };
}

/** As empresas de hoje da carteira, com o cadastro. */
export async function carregarCarteira(supabase, hoje) {
  const { data, error } = await supabase.todasLinhas(() => supabase.from('carteira_info')
    .select('cliente_id, entrada, saida, clientes(id, nome_principal, nome_fantasia, documento, tipo_pessoa, regime_tributario, status, cidade, uf)').order('cliente_id'));
  if (error) throw new Error(error.message || String(error));
  return carteiraDeHoje(data, hoje);
}

/** O que os dois cards da página Integrações mostram da carteira (leitura leve: só os códigos e as procurações). */
export async function carregarResumo(supabase, hoje) {
  const empresas = await carregarCarteira(supabase, hoje);
  const ids = empresas.map(e => e.id);
  const [codigos, receitas] = await Promise.all([
    lerPorClientes(supabase, 'dominio_empresas', 'codigo, cliente_id', ids, ['codigo']),
    lerPorClientes(supabase, 'receita_empresas', 'cliente_id, autorizacao, autorizacao_ate', ids, ['cliente_id'])
  ]);
  return resumoDaCarteira(empresas, codigos, receitas, hoje);
}

const COLS_AVISO = 'id, regra, titulo, detalhe, gravidade, cliente_id, link, responsavel, setor, prazo, situacao';
/** O que a lista do Domínio precisa das empresas (ids): os códigos, os 14 meses e os avisos abertos do vigia. */
export async function carregarListaDominio(supabase, ids) {
  const [codigos, mensal, achados] = await Promise.all([
    lerPorClientes(supabase, 'dominio_empresas', 'codigo, cliente_id, ativa', ids, ['codigo']),
    lerPorClientes(supabase, 'dominio_mensal', 'codigo, cliente_id, competencia, ' + CAMPOS_DA_LISTA.join(', '), ids, ['codigo', 'competencia']),
    lerPorClientes(supabase, 'vigia_achados', COLS_AVISO, ids, ['id'], q => q.eq('situacao', 'aberto'))
  ]);
  return { codigos, mensal, achados };
}

/** O que a lista da Receita precisa das empresas (ids). */
export async function carregarListaReceita(supabase, ids) {
  const [empresas, pgdas, mensagens, guias, achados] = await Promise.all([
    lerPorClientes(supabase, 'receita_empresas', 'cliente_id, autorizacao, autorizacao_ate, autorizacao_via, pendencias, situacao_fiscal_em, pgdas_em, pagamentos_desde, pagamentos_ate', ids, ['cliente_id']),
    lerPorClientes(supabase, 'receita_pgdas', 'cliente_id, competencia, transmitida_em, das_pago', ids, ['cliente_id', 'competencia']),
    lerPorClientes(supabase, 'receita_mensagens', 'cliente_id, id_receita, lida, enviada_em, recebida_em', ids, ['cliente_id', 'id_receita']),
    lerPorClientes(supabase, 'receita_pagamentos', 'cliente_id, numero_documento, tipo_codigo, periodo_apuracao, arrecadado_em, vencimento, referencia', ids, ['cliente_id', 'numero_documento']),
    lerPorClientes(supabase, 'vigia_achados', COLS_AVISO, ids, ['id'], q => q.eq('situacao', 'aberto'))
  ]);
  // a guia do DAS de vários meses diz o mês de cada parte: as partes são pesadas (3 MB com todas as guias), e só fazem
  // diferença pra quem a Receita mostra com DAS sem pagar — só delas a lista lê as partes, e só das guias do DAS
  const devem = comDasSemPagar(pgdas);
  if (devem.length) {
    const partes = await lerPorClientes(supabase, 'receita_pagamentos', 'cliente_id, numero_documento, partes', devem, ['cliente_id', 'numero_documento'], q => q.eq('tipo_codigo', '9'));
    const por = new Map(partes.map(p => [p.cliente_id + '|' + p.numero_documento, p.partes]));
    for (const g of guias) { const p = por.get(g.cliente_id + '|' + g.numero_documento); if (p) g.partes = p; }
  }
  return { empresas, pgdas, mensagens, guias, achados };
}

// as origens dos lançamentos (a versão 3 da ponte), que o perfil mostra além do que a ficha da empresa lê
export const CAMPOS_ORIGENS = ['lanc_normais', 'lanc_extrato', 'lanc_fiscal', 'lanc_folha', 'lanc_apuracao', 'lanc_outros', 'incluido_ate'];
export const MESES_NO_PERFIL = 6;
/** Tudo o que o perfil do Domínio mostra de uma empresa. */
export async function carregarPerfilDominio(supabase, clienteId, hoje) {
  const desde = mesAntes(hoje, MESES_NO_PERFIL - 1);
  const [emp, men, and, enc, jor, pg, ctl, ach] = await Promise.all([
    supabase.from('dominio_empresas').select('codigo, ativa').eq('cliente_id', clienteId).order('codigo'),
    supabase.from('dominio_mensal').select('codigo, competencia, ' + [...CAMPOS, ...CAMPOS_VALOR, ...CAMPOS_ORIGENS].join(', ') + ', atualizado_em')
      .eq('cliente_id', clienteId).gte('competencia', desde).order('competencia', { ascending: false }).limit(60),
    supabase.from('dominio_andamento').select('codigo, banco_contas, banco_ate, banco_ultimo, banco_ultimo_geral, caixa_ate, caixa_contador_ate, extrato_contas, extrato_ate, extrato_pendentes, conciliadas, conciliado_ate, fechamento_em, dados_ate').eq('cliente_id', clienteId),
    supabase.from('dominio_encerramento').select('codigo, ano, zerado_em, zeramentos, zerado_incluido_em, lancados_depois, lancamentos_do_ano').eq('cliente_id', clienteId),
    supabase.from('dominio_jornadas').select('jornada, tipo, tipo_escala, semana, min_semana, min_maior_dia, ciclo_dias, ciclo_trabalho, horas_semana, empregados, afastados, dados_ate').eq('cliente_id', clienteId),
    supabase.from('receita_pgdas').select('competencia, receita_mes').eq('cliente_id', clienteId).order('competencia', { ascending: false }).limit(24),
    supabase.from('contabil_empresas').select('cliente_id, faz').eq('cliente_id', clienteId).limit(1),
    supabase.from('vigia_achados').select(COLS_AVISO).eq('cliente_id', clienteId).eq('situacao', 'aberto')
  ]);
  const linhas = ou(men).filter(l => String(l.competencia) >= desde);
  const porMes = dominioPorMes(linhas);
  return {
    empresas: ou(emp), linhas, porMes,
    andamento: andamentoDaEmpresa(ou(and)), encerramentos: encerramentoDaEmpresa(ou(enc)),
    jornadas: jornadasDoPerfil(ou(jor)), jornadaEm: ou(jor).map(j => dia10(j.dados_ate)).filter(Boolean).sort().pop() || null,
    conferencia: conferenciaDoFaturamento(porMes, ou(pg)),
    noControle: ou(ctl).length > 0,
    avisos: avisosPorCliente(ou(ach), 'dominio').get(clienteId) || []
  };
}

/** Tudo o que o perfil da Receita mostra de uma empresa. */
export async function carregarPerfilReceita(supabase, clienteId) {
  const [emp, pg, ms, gs, ach] = await Promise.all([
    supabase.from('receita_empresas').select('cliente_id, autorizacao, autorizacao_ate, autorizacao_via, autorizacao_em, pgdas_em, pendencias, situacao_fiscal_em, situacao_fiscal_pdf_em, situacao_fiscal_pdf_url, pagamentos_desde, pagamentos_ate, pagamentos_em')
      .eq('cliente_id', clienteId).limit(1),
    supabase.from('receita_pgdas').select('competencia, transmitida_em, das_pago, receita_mes, receita_12_meses').eq('cliente_id', clienteId).order('competencia', { ascending: false }).limit(36),
    supabase.from('receita_mensagens').select('assunto, enviada_em, origem, lida, recebida_em').eq('cliente_id', clienteId)
      .order('enviada_em', { ascending: false, nullsFirst: false }).order('recebida_em', { ascending: false }).limit(30),
    supabase.todasLinhas(() => supabase.from('receita_pagamentos')
      .select('numero_documento, tipo_codigo, tipo, periodo_apuracao, arrecadado_em, vencimento, receita_codigo, receita, referencia, valor_total, valor_principal, valor_multa, valor_juros, saldo_total, partes')
      .eq('cliente_id', clienteId).order('arrecadado_em', { ascending: false }).order('numero_documento')),
    supabase.from('vigia_achados').select(COLS_AVISO).eq('cliente_id', clienteId).eq('situacao', 'aberto')
  ]);
  const guias = ou(gs);
  return {
    receita: ou(emp)[0] || null,
    pgdas: pgdasDoPerfil(ou(pg), guias),
    mensagens: mensagensDoPerfil(ou(ms)),
    guias: guiasDoPerfil(guias),
    avisos: avisosPorCliente(ou(ach), 'receita').get(clienteId) || []
  };
}
