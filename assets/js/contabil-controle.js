// ============================================================
// MACEDO & REIS — Controle das contabilidades (04/11/2026, pedido do Samuel, com a planilha de controle da Adaini)
// A contabilidade de cada empresa mês a mês, do jeito da planilha: cada mês feito (com o dia em que foi feito), em
// andamento (digitado, falta fechar), sem movimento ou a fazer; antes do início e depois do fim do controle, fora.
// Não é rotina mensal (não nasce tarefa todo mês): a Adaini atualiza quando faz, muitas vezes vários meses de uma vez.
// "Feita até" é o último mês da sequência fechada desde o início; "a fazer" são os meses abertos até o mês passado
// (o último que dá pra fechar) ou até o fim do controle, em faixas. As pendências dizem o que falta pra fechar (de
// quem se espera, desde quando, de qual mês). Os números do Domínio entram como dica: o mês "sem movimento" com nota
// ou lançamento lá e o mês a fazer sem nada lá. Desde 05/11/2026 (a versão 3 da ponte, o andamento das
// contabilidades), também o mês marcado como feito em que o Domínio discorda — a escrita fiscal ou a folha fora da
// contabilidade, a receita ou a folha lançadas diferentes do faturamento e da folha calculada, o caixa negativo ou a
// transitória com saldo no fim do mês, o banco sem lançamento no mês — sem trocar a marcação (quem fecha é a Adaini).
// Puro: testes em tests/contabil-controle.test.mjs e tests/harness/contabil-controle.py.
// ============================================================

export const SITUACOES = { feita: 'Feita', andamento: 'Em andamento', sem_movimento: 'Sem movimento' };
/** As situações que fecham o mês (em andamento ainda não fecha). */
export const FECHADAS = new Set(['feita', 'sem_movimento']);
/** De quem a pendência espera. */
export const AGUARDANDO = [['cliente', 'Cliente'], ['diego', 'Diego'], ['samuel', 'Samuel'], ['escritorio', 'Escritório']];
export const NOMES_MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const NOMES_MES_LONGO = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const LIMITE_TEXTO = 1000;
export const LIMITE_OBS = 4000;

const RE_MES = /^(\d{4})-(0[1-9]|1[0-2])$/;
const RE_DIA = /^(\d{4})-(\d{2})-(\d{2})$/;

export const mesValido = c => RE_MES.test(String(c || ''));
export function diaValido(iso) {
  const m = RE_DIA.exec(String(iso || ''));
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

/** O mês 'AAAA-MM' n meses depois (n negativo: antes). */
export function somaMes(c, n) {
  const y = +String(c).slice(0, 4), m = +String(c).slice(5, 7) - 1 + n;
  return (y + Math.floor(m / 12)) + '-' + String((((m % 12) + 12) % 12) + 1).padStart(2, '0');
}

/** Os meses de a até b, os dois inclusive (vazio se a > b ou se algum não é mês). */
export function mesesEntre(a, b) {
  const out = [];
  if (!mesValido(a) || !mesValido(b) || a > b) return out;
  for (let c = a; c <= b && out.length < 1200; c = somaMes(c, 1)) out.push(c);
  return out;
}

export const mesDoDia = iso => String(iso || '').slice(0, 7);
export const rotuloMes = c => (mesValido(c) ? c.slice(5, 7) + '/' + c.slice(0, 4) : '');
export const mesPorExtenso = c => (mesValido(c) ? NOMES_MES_LONGO[+c.slice(5, 7) - 1] + ' de ' + c.slice(0, 4) : '');
export const dataBR = iso => { const m = RE_DIA.exec(String(iso || '').slice(0, 10)); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; };

/** O último mês que dá pra fechar no dia 'AAAA-MM-DD': o mês passado. */
export const ultimoFechavel = hoje => somaMes(mesDoDia(hoje), -1);

/** Os dias entre dois 'AAAA-MM-DD' (b − a). */
export function diasEntre(a, b) {
  if (!diaValido(a) || !diaValido(b)) return null;
  return Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 864e5);
}

/** As linhas de contabil_meses de uma empresa num Map competência → linha (só as válidas). */
export function mapaDosMeses(linhas) {
  const m = new Map();
  for (const l of linhas || []) if (l && mesValido(l.competencia) && SITUACOES[l.situacao]) m.set(l.competencia, l);
  return m;
}

/**
 * O estado de um mês da empresa: 'fora' (antes do início ou depois do fim do controle), 'feita', 'andamento',
 * 'sem_movimento', 'afazer' (até o mês de hoje) ou 'futuro'.
 */
export function estadoDoMes(emp, mapa, c, hoje) {
  if (!emp || !mesValido(c)) return { tipo: 'fora', porque: null };
  if (mesValido(emp.inicio) && c < emp.inicio) return { tipo: 'fora', porque: 'antes' };
  if (mesValido(emp.fim) && c > emp.fim) return { tipo: 'fora', porque: 'depois' };
  const l = mapa && mapa.get(c);
  if (l) return { tipo: l.situacao, feita_em: l.feita_em || null, por: l.por || null, em: l.em || null };
  return { tipo: c > mesDoDia(hoje) ? 'futuro' : 'afazer' };
}

/** O último mês a fechar no dia: o mês passado, ou o fim do controle quando é antes. */
export function alvoDaEmpresa(emp, hoje) {
  const ultimo = ultimoFechavel(hoje);
  return mesValido(emp && emp.fim) && emp.fim < ultimo ? emp.fim : ultimo;
}

/**
 * O resumo da empresa no dia: feita até (a sequência fechada desde o início), os meses a fazer e em andamento até o
 * alvo, o próximo a fazer, a última vez que alguma coisa foi feita, se o controle está encerrado (com o fim, tudo
 * fechado até ele) e o último mês fechado (que pode vir depois de um buraco).
 */
export function resumoDaEmpresa(emp, linhas, hoje) {
  const mapa = linhas instanceof Map ? linhas : mapaDosMeses(linhas);
  const alvo = alvoDaEmpresa(emp, hoje);
  const meses = mesesEntre(emp && emp.inicio, alvo);
  let feitaAte = null, seguido = true;
  const aFazer = [], andamento = [];
  for (const c of meses) {
    const l = mapa.get(c);
    const fechado = !!(l && FECHADAS.has(l.situacao));
    if (seguido && fechado) feitaAte = c; else seguido = false;
    if (!l) aFazer.push(c);
    else if (l.situacao === 'andamento') andamento.push(c);
  }
  const abertos = meses.filter(c => { const l = mapa.get(c); return !l || l.situacao === 'andamento'; });
  let ultimaFeita = null, ultimoFechado = null;
  for (const l of mapa.values()) {
    if (l.feita_em && diaValido(String(l.feita_em).slice(0, 10)) && (!ultimaFeita || String(l.feita_em) > ultimaFeita)) ultimaFeita = String(l.feita_em).slice(0, 10);
    if (FECHADAS.has(l.situacao) && (!ultimoFechado || l.competencia > ultimoFechado)) ultimoFechado = l.competencia;
  }
  const encerrada = mesValido(emp && emp.fim) && emp.fim <= ultimoFechavel(hoje) && abertos.length === 0;
  return { alvo, feitaAte, aFazer, andamento, abertos, proximo: abertos[0] || null, faltam: abertos.length, ultimaFeita, ultimoFechado, encerrada };
}

/** Os meses (em qualquer ordem) em faixas seguidas: [['2025-02', '2025-12'], ['2026-10', '2026-10']]. */
export function faixas(meses) {
  const ord = [...new Set((meses || []).filter(mesValido))].sort();
  const out = [];
  for (const c of ord) {
    const u = out[out.length - 1];
    if (u && somaMes(u[1], 1) === c) u[1] = c; else out.push([c, c]);
  }
  return out;
}

/** As faixas em texto: "02/2025 a 12/2025, 10/2026" (com mais de max faixas, "e mais N"). */
export function textoDasFaixas(meses, max = 3) {
  const f = faixas(meses);
  const t = f.slice(0, max).map(([a, b]) => (a === b ? rotuloMes(a) : rotuloMes(a) + ' a ' + rotuloMes(b)));
  if (f.length > max) t.push('e mais ' + (f.length - max) + (f.length - max === 1 ? ' faixa' : ' faixas'));
  return t.join(', ');
}

export const textoDeMeses = n => n + (n === 1 ? ' mês' : ' meses');

/**
 * Os meses que "até aqui" marca, do início do controle até c (sem passar do fim): na feita, os a fazer e os em
 * andamento; no sem movimento e no em andamento, só os a fazer (o que já tem situação fica como está).
 */
export function mesesAteAqui(emp, linhas, c, situacao = 'feita') {
  if (!emp || !mesValido(c) || !SITUACOES[situacao]) return [];
  const mapa = linhas instanceof Map ? linhas : mapaDosMeses(linhas);
  const ate = mesValido(emp.fim) && emp.fim < c ? emp.fim : c;
  return mesesEntre(emp.inicio, ate).filter(m => {
    const l = mapa.get(m);
    if (!l) return true;
    return situacao === 'feita' && l.situacao === 'andamento';
  });
}

/** As linhas a gravar (upsert em contabil_meses) pra marcar os meses: feita e em andamento levam o dia. */
export function linhasParaMarcar(clienteId, meses, situacao, dia) {
  if (!SITUACOES[situacao]) throw new Error('Situação desconhecida: ' + situacao);
  if (situacao !== 'sem_movimento' && !diaValido(dia)) throw new Error('Diga o dia em que foi feita.');
  return (meses || []).filter(mesValido).map(c => ({ cliente_id: clienteId, competencia: c, situacao, feita_em: situacao === 'sem_movimento' ? null : dia }));
}

/** O que desfaz uma marcação: os meses que não tinham linha saem; os que tinham voltam como estavam. */
export function desfazerDe(clienteId, meses, antes) {
  const mapa = antes instanceof Map ? antes : mapaDosMeses(antes);
  const apagar = [], voltar = [];
  for (const c of meses || []) {
    const l = mapa.get(c);
    if (l) voltar.push({ cliente_id: clienteId, competencia: c, situacao: l.situacao, feita_em: l.feita_em || null });
    else apagar.push(c);
  }
  return { apagar, voltar };
}

/** O que a tela lê de dominio_mensal (com a versão 3 da ponte: as origens, os cruzamentos e os saldos do fim do mês). */
export const CAMPOS_DOMINIO = ['lancamentos', 'notas_saida', 'valor_saidas', 'notas_entrada', 'valor_entradas', 'funcionarios_ativos', 'pro_labore',
  'receita_bruta', 'salarios', 'decimo_terceiro', 'pro_labore_valor',
  'lanc_normais', 'lanc_extrato', 'lanc_fiscal', 'lanc_folha', 'lanc_apuracao', 'lanc_outros',
  'receita_lancada', 'folha_lancada', 'encargos_lancados', 'caixa_negativo', 'contra_natureza', 'sem_natureza', 'transitorias', 'transitorias_valor'];

/** As linhas de dominio_mensal (de um ou mais códigos da empresa) num Map mês → números (dois códigos: o maior de cada). */
export function dominioPorMes(linhas) {
  const m = new Map();
  for (const l of linhas || []) {
    if (!l || !mesValido(l.competencia)) continue;
    const d = m.get(l.competencia) || { competencia: l.competencia };
    for (const k of CAMPOS_DOMINIO) if (l[k] != null && (d[k] == null || +l[k] > +d[k])) d[k] = +l[k];
    for (const k of ['ultimo_lancamento', 'incluido_ate'])
      if (l[k] && String(l[k]) > String(d[k] || '')) d[k] = String(l[k]).slice(0, 10);
    m.set(l.competencia, d);
  }
  return m;
}

/** A foto do dia do Domínio de uma empresa (dominio_andamento, de um ou mais códigos): o mais adiantado de cada data, o
 * maior de cada contagem — e a conta mais atrasada (banco_ate, extrato_ate, conciliado_ate), a menor. Null sem foto. */
export function andamentoDaEmpresa(linhas) {
  const ls = (linhas || []).filter(Boolean);
  if (!ls.length) return null;
  const MENOR = new Set(['banco_ate', 'extrato_ate', 'conciliado_ate']);
  const DATAS = ['banco_ate', 'banco_ultimo', 'banco_ultimo_geral', 'caixa_ate', 'caixa_contador_ate', 'extrato_ate', 'conciliado_ate', 'fechamento_em', 'dados_ate'];
  const CONTAS = ['banco_contas', 'extrato_contas', 'extrato_pendentes', 'conciliadas'];
  const a = {};
  for (const k of DATAS) {
    const v = ls.map(l => l[k]).filter(Boolean).map(x => String(x).slice(0, 10)).sort();
    a[k] = v.length ? (MENOR.has(k) ? v[0] : v[v.length - 1]) : null;
  }
  for (const k of CONTAS) { const v = ls.map(l => l[k]).filter(x => x != null).map(Number); a[k] = v.length ? Math.max(...v) : null; }
  return a;
}

/** O encerramento da empresa por ano (dominio_encerramento, de um ou mais códigos), o ano mais novo primeiro: no ano, o
 * código com o zeramento (o mais recente), senão o de mais lançamentos. */
export function encerramentoDaEmpresa(linhas) {
  const porAno = new Map();
  for (const z of linhas || []) {
    if (!z || !Number.isInteger(+z.ano)) continue;
    const a = porAno.get(+z.ano);
    const melhor = !a || (z.zerado_em && (!a.zerado_em || String(z.zerado_em) > String(a.zerado_em)))
      || (!z.zerado_em && !a.zerado_em && (+z.lancamentos_do_ano || 0) > (+a.lancamentos_do_ano || 0));
    if (melhor) porAno.set(+z.ano, { ...z, ano: +z.ano });
  }
  return [...porAno.values()].sort((a, b) => b.ano - a.ano);
}

/** Os lançamentos do mês por origem, em texto ("340 da escrita fiscal, 15 da folha, 25 do extrato, 4 digitados"); null
 * sem a versão 3 da ponte ou sem lançamento. */
export function textoDasOrigens(d) {
  if (!d || d.lanc_fiscal == null) return null;
  const p = [];
  const mais = (k, rot) => { if (+d[k] > 0) p.push(inteiro(d[k]) + ' ' + rot); };
  mais('lanc_fiscal', 'da escrita fiscal'); mais('lanc_folha', 'da folha'); mais('lanc_extrato', 'do extrato importado');
  mais('lanc_normais', +d.lanc_normais === 1 ? 'digitado' : 'digitados'); mais('lanc_apuracao', 'da apuração'); mais('lanc_outros', 'de outras origens');
  return p.length ? p.join(', ') : null;
}

const somaOuNull = (...v) => (v.some(x => x != null) ? v.reduce((s, x) => s + (+x || 0), 0) : null);
/** A folha do mês que o Domínio calculou: os proventos, o 13º e o pró-labore (null sem nenhum dos três). */
export const folhaCalculada = d => (d ? somaOuNull(d.salarios, d.decimo_terceiro, d.pro_labore_valor) : null);

/**
 * O que o Domínio diz do mês pelo andamento da contabilidade (a versão 3 da ponte): a escrita fiscal ou a folha que não
 * entraram na contabilidade, a receita e a folha lançadas diferentes do faturamento e da folha calculada (mais de
 * R$ 1,00), o caixa negativo e a transitória com saldo no fim do mês, o banco sem lançamento no mês (nenhuma conta com
 * lançamento do mês em diante: `and` é a foto do dia) e as contas contra a natureza (leve: o resto é forte). Só o que o
 * Domínio disse: o null (a ponte antiga, o bloco que faltou) não vira problema. Cada um: { tipo, forte, texto }.
 */
export function problemasDoMes(d, c, and) {
  const out = [];
  const n = v => (v == null ? null : +v);
  if (d) {
    const notas = somaOuNull(d.notas_saida, d.notas_entrada);
    const fiscalFora = notas > 0 && n(d.lanc_fiscal) === 0;
    if (fiscalFora) out.push({ tipo: 'fiscal', forte: true, texto: 'a escrita fiscal (' + inteiro(notas) + (notas === 1 ? ' nota' : ' notas') + ') não entrou na contabilidade' });
    const folha = folhaCalculada(d);
    if (folha > 0 && n(d.folha_lancada) === 0) out.push({ tipo: 'folha', forte: true, texto: 'a folha (' + dinheiro(folha) + ') não entrou na contabilidade' });
    else if (folha > 0 && n(d.folha_lancada) > 0 && Math.abs(folha - d.folha_lancada) > 1)
      out.push({ tipo: 'folha_difere', forte: true, texto: 'a folha lançada (' + dinheiro(d.folha_lancada) + ') é diferente da calculada (' + dinheiro(folha) + ')' });
    if (!fiscalFora && n(d.receita_bruta) > 0 && d.receita_lancada != null && Math.abs(d.receita_bruta - d.receita_lancada) > 1)
      out.push({ tipo: 'receita', forte: true, texto: 'a receita lançada (' + dinheiro(d.receita_lancada) + ') é diferente do faturamento (' + dinheiro(d.receita_bruta) + ')' });
    if (n(d.caixa_negativo) > 0) out.push({ tipo: 'caixa', forte: true, texto: 'o caixa fechou o mês negativo' });
    if (n(d.transitorias) > 0) out.push({ tipo: 'transitoria', forte: true, texto: (d.transitorias === 1 ? 'uma conta transitória ou a classificar' : d.transitorias + ' contas transitórias ou a classificar') + ' com saldo no fim do mês' + (n(d.transitorias_valor) > 0 ? ' (' + dinheiro(d.transitorias_valor) + ')' : '') });
    if (n(d.contra_natureza) > 0) out.push({ tipo: 'natureza', forte: false, texto: (d.contra_natureza === 1 ? 'uma conta' : d.contra_natureza + ' contas') + ' com saldo contra a natureza no fim do mês' });
  }
  if (and && mesValido(c) && n(and.banco_contas) > 0 && and.banco_ultimo && String(and.banco_ultimo).slice(0, 10) < c + '-01')
    out.push({ tipo: 'banco', forte: true, texto: 'o banco não tem lançamento neste mês (o último é de ' + dataBR(and.banco_ultimo) + ')' });
  return out;
}

const inteiro = v => Number(v).toLocaleString('pt-BR');
export const dinheiro = v => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** O que o Domínio tem no mês, em texto curto ("173 lançamentos, 12 notas de saída, 3 funcionários"); null sem nada a dizer. */
export function textoDoDominio(d) {
  if (!d) return null;
  const p = [];
  if (d.lancamentos != null) p.push(d.lancamentos === 1 ? '1 lançamento' : inteiro(d.lancamentos) + ' lançamentos');
  if (d.notas_saida) p.push(d.notas_saida === 1 ? '1 nota de saída' : inteiro(d.notas_saida) + ' notas de saída');
  if (d.notas_entrada) p.push(d.notas_entrada === 1 ? '1 nota de entrada' : inteiro(d.notas_entrada) + ' notas de entrada');
  if (d.funcionarios_ativos) p.push(d.funcionarios_ativos === 1 ? '1 funcionário' : inteiro(d.funcionarios_ativos) + ' funcionários');
  if (d.pro_labore) p.push(d.pro_labore === 1 ? '1 pró-labore' : inteiro(d.pro_labore) + ' pró-labores');
  return p.length ? p.join(', ') : null;
}

/**
 * A dica do Domínio pro mês: o "sem movimento" que tem nota ou lançamento lá (conferir) e o mês a fazer, já passado,
 * em que o Domínio não tem lançamento, nota, funcionário nem pró-labore (sem movimento?). O Domínio que não disse
 * (null) não vira dica.
 */
export function dicaDoDominio(estado, d, c, hoje, and = null) {
  if (estado && estado.tipo === 'feita') {
    // o mês marcado como feito em que o Domínio discorda (o forte: as contas contra a natureza ficam na ficha)
    const p = problemasDoMes(d, c, and).filter(x => x.forte);
    if (p.length) return { tipo: 'conferir', texto: 'Marcado como feito, mas no Domínio ' + p.map(x => x.texto).join('; ') + '.' };
  }
  if (!estado || !d) return null;
  const tem = k => d[k] != null && +d[k] > 0;
  if (estado.tipo === 'sem_movimento' && (tem('lancamentos') || tem('notas_saida') || tem('notas_entrada')))
    return { tipo: 'conferir', texto: 'Marcado sem movimento, mas o Domínio tem ' + textoDoDominio({ lancamentos: d.lancamentos || null, notas_saida: d.notas_saida, notas_entrada: d.notas_entrada }) + ' neste mês.' };
  const zero = k => d[k] === 0;
  if (estado.tipo === 'afazer' && mesValido(c) && c <= ultimoFechavel(hoje)
      && zero('lancamentos') && zero('notas_saida') && zero('notas_entrada') && !tem('funcionarios_ativos') && !tem('pro_labore'))
    return { tipo: 'sem_movimento', texto: 'O Domínio não tem lançamento nem nota neste mês: sem movimento?' };
  return null;
}

/**
 * Os avisos da empresa pelo que o sistema sabe (ctx: cliente do cadastro, linha da carteira, códigos no Domínio):
 * saiu da carteira com o controle ainda sem fim (com a ação de encerrar no mês da saída), fora da carteira, inativa
 * no Domínio, inativa no cadastro, MEI no cadastro.
 */
export function avisosDaEmpresa(emp, ctx = {}) {
  const out = [];
  if (!emp || emp.faz === false) return out;
  const cart = ctx.carteira || null, cli = ctx.cliente || null, dom = ctx.dominio || [];
  if (cart && cart.saida && diaValido(String(cart.saida).slice(0, 10))) {
    const mes = mesDoDia(cart.saida);
    if (!mesValido(emp.fim)) out.push({ tipo: 'saida', texto: 'Saiu da carteira em ' + dataBR(cart.saida) + ', e o controle segue sem fim.', acao: { rotulo: 'Encerrar em ' + rotuloMes(mes), fim: mes < emp.inicio ? emp.inicio : mes } });
  } else if (!cart || !cart.entrada) out.push({ tipo: 'carteira', texto: 'Não está na carteira de clientes.' });
  if (dom.length && dom.every(d => d.ativa === false)) out.push({ tipo: 'dominio', texto: 'Inativa no Domínio.' });
  if (cli && cli.status === 'inativo') out.push({ tipo: 'cadastro', texto: 'Inativa no cadastro.' });
  if (cli && cli.regime_tributario === 'MEI') out.push({ tipo: 'mei', texto: 'Está como MEI no cadastro.' });
  return out;
}

/** Confere a pendência antes de gravar: o texto (1 a 1000), de quem se espera, desde (dia ou vazio), o mês (ou vazio). */
export function limparPendencia(p = {}) {
  const texto = String(p.texto || '').replace(/\s+/g, ' ').trim();
  if (!texto) return { erro: 'Escreva o que falta.' };
  if ([...texto].length > LIMITE_TEXTO) return { erro: 'O texto passou de ' + LIMITE_TEXTO + ' caracteres.' };
  const aguardando = AGUARDANDO.some(([v]) => v === p.aguardando) ? p.aguardando : 'escritorio';
  const desde = p.desde ? String(p.desde).slice(0, 10) : null;
  if (desde && !diaValido(desde)) return { erro: 'O dia de "desde" não é uma data.' };
  const competencia = p.competencia ? String(p.competencia) : null;
  if (competencia && !mesValido(competencia)) return { erro: 'O mês não é um mês.' };
  return { valor: { texto, aguardando, desde, competencia } };
}

export const rotuloAguardando = k => (AGUARDANDO.find(([v]) => v === k) || [k, String(k || '')])[1];

/** A linha de baixo da pendência: "Esperando o cliente, desde 15/07/2026 (há 112 dias), de 12/2025". */
export function textoDaPendencia(p, hoje) {
  if (!p) return '';
  const quem = { cliente: 'o cliente', diego: 'o Diego', samuel: 'o Samuel', escritorio: 'o escritório' }[p.aguardando] || 'o escritório';
  const partes = ['Esperando ' + quem];
  if (p.desde && diaValido(String(p.desde).slice(0, 10))) {
    const d = String(p.desde).slice(0, 10), n = diasEntre(d, hoje);
    partes.push('desde ' + dataBR(d) + (n > 1 ? ' (há ' + n + ' dias)' : n === 1 ? ' (ontem)' : n === 0 ? ' (hoje)' : ''));
  }
  if (mesValido(p.competencia)) partes.push('de ' + rotuloMes(p.competencia));
  return partes.join(', ');
}

/** As pendências abertas primeiro (a mais antiga primeiro; sem o desde, pela criação), depois as resolvidas (a mais recente primeiro). */
export function ordenarPendencias(lista) {
  const abertas = (lista || []).filter(p => !p.resolvida_em), resolvidas = (lista || []).filter(p => p.resolvida_em);
  const chave = p => String(p.desde || '9999') + '|' + String(p.criado_em || '');
  abertas.sort((a, b) => (chave(a) < chave(b) ? -1 : chave(a) > chave(b) ? 1 : 0));
  resolvidas.sort((a, b) => String(b.resolvida_em).localeCompare(String(a.resolvida_em)));
  return { abertas, resolvidas };
}

/** O nome que a tela mostra: o fantasia, senão a razão social (sem o CPF do MEI no fim). */
export function nomeDaEmpresa(cli) {
  if (!cli) return 'Empresa sem cadastro';
  const f = String(cli.nome_fantasia || '').trim(), r = String(cli.nome_principal || '').trim().replace(/\s+\d{11}$/, '');
  return f || r || 'Empresa sem nome';
}

export const semAcento = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Os focos (os cartões do alto): a que a empresa pertence no dia. */
export const FOCOS = [
  ['todas', 'Todas'],
  ['em_dia', 'Em dia'],
  ['ano_passado', 'Ano passado aberto'],
  ['pendencia', 'Com pendência'],
  ['saindo', 'Saindo ou baixadas'],
  ['discorda', 'O Domínio discorda'],
  ['nao_faz', 'Não fazemos'],
];

/** Os focos da empresa: em dia (nada aberto até o mês passado), ano passado aberto, com pendência, saindo (com o fim e
 * meses abertos), o Domínio discorda (algum mês fechado em que o Domínio diz outra coisa — `discordam`, os meses de
 * mesesQueDiscordam), não fazemos. */
export function focosDaEmpresa(emp, resumo, pendenciasAbertas, hoje, discordam = 0) {
  const f = new Set();
  if (!emp) return f;
  if (emp.faz === false) { f.add('nao_faz'); return f; }
  f.add('todas');
  if (resumo.faltam === 0) f.add('em_dia');
  const anoPassado = String(+String(hoje).slice(0, 4) - 1);
  if (resumo.abertos.some(c => c.startsWith(anoPassado + '-'))) f.add('ano_passado');
  if (pendenciasAbertas > 0) f.add('pendencia');
  if (mesValido(emp.fim) && resumo.faltam > 0) f.add('saindo');
  if (discordam > 0) f.add('discorda');
  return f;
}

/** Os meses da empresa (do início do controle ao último que dá pra fechar) em que a marcação e o Domínio discordam: o
 * feito com problema forte no Domínio e o sem movimento com nota ou lançamento lá. */
export function mesesQueDiscordam(emp, mapa, dominio, and, hoje) {
  if (!emp || emp.faz === false) return [];
  const ate = mesValido(emp.fim) && emp.fim < ultimoFechavel(hoje) ? emp.fim : ultimoFechavel(hoje);
  return mesesEntre(emp.inicio, ate).filter(c => {
    const e = estadoDoMes(emp, mapa, c, hoje);
    if (e.tipo !== 'feita' && e.tipo !== 'sem_movimento') return false;
    const dica = dicaDoDominio(e, dominio && dominio.get(c), c, hoje, and);
    return !!(dica && dica.tipo === 'conferir');
  });
}

/**
 * A foto do dia do Domínio em linhas de texto, pra ficha: o banco (as contas do ano, até onde a mais atrasada e a mais
 * adiantada estão lançadas; sem movimento há mais de um ano; nunca teve), o extrato importado (e as linhas sem
 * lançamento), o caixa do contador (e o da integração), a data do fechamento e o zeramento de cada ano.
 */
export function textoDoAndamento(and, encerramentos = []) {
  const out = [];
  if (and) {
    const nb = and.banco_contas || 0;
    if (nb > 0) out.push('Banco: ' + (nb === 1 ? '1 conta' : nb + ' contas') + ' com movimento nos últimos 12 meses, '
      + (nb === 1 || and.banco_ate === and.banco_ultimo ? 'lançada' + (nb === 1 ? '' : 's') + ' até ' + dataBR(and.banco_ultimo || and.banco_ate)
        : 'lançadas até ' + dataBR(and.banco_ate) + ' (a mais atrasada) e ' + dataBR(and.banco_ultimo) + ' (a mais adiantada)') + '.');
    else if (and.banco_ultimo_geral) out.push('Banco: sem movimento nos últimos 12 meses (o último lançamento em conta de banco é de ' + dataBR(and.banco_ultimo_geral) + ').');
    else out.push('Banco: nenhum lançamento em conta de banco no Domínio.');
    if (and.extrato_contas > 0) out.push('Extrato importado até ' + dataBR(and.extrato_ate) + (and.extrato_pendentes > 0 ? ', com ' + (and.extrato_pendentes === 1 ? '1 linha' : inteiro(and.extrato_pendentes) + ' linhas') + ' ainda sem lançamento' : ', tudo lançado') + '.');
    if (and.caixa_contador_ate) out.push('Caixa lançado pelo contador até ' + dataBR(and.caixa_contador_ate) + (and.caixa_ate && and.caixa_ate > and.caixa_contador_ate ? ' (com a integração das notas, até ' + dataBR(and.caixa_ate) + ')' : '') + '.');
    else if (and.caixa_ate) out.push('Caixa: só a integração das notas (até ' + dataBR(and.caixa_ate) + ').');
    if (and.fechamento_em) out.push('Data do fechamento nos parâmetros do Domínio: ' + dataBR(and.fechamento_em) + '.');
  }
  for (const z of [...(encerramentos || [])].sort((a, b) => b.ano - a.ano)) {
    if (z.zerado_em) out.push(z.ano + ': zerado em ' + dataBR(z.zerado_em) + (z.zeramentos > 1 ? ' (' + z.zeramentos + ' zeramentos no ano)' : '')
      + (z.zerado_incluido_em ? ', feito em ' + dataBR(z.zerado_incluido_em) : '')
      + (z.lancados_depois > 0 ? '; ' + (z.lancados_depois === 1 ? '1 lançamento entrou' : inteiro(z.lancados_depois) + ' lançamentos entraram') + ' depois do zeramento' : '') + '.');
    else if (z.lancamentos_do_ano > 0) out.push(z.ano + ': sem o zeramento (' + inteiro(z.lancamentos_do_ano) + (z.lancamentos_do_ano === 1 ? ' lançamento' : ' lançamentos') + ' no ano).');
  }
  return out;
}

/** Os anos da grade: do início mais antigo do controle até o ano de hoje. */
export function anosDoControle(empresas, hoje) {
  const atual = +String(hoje).slice(0, 4);
  let menor = atual;
  for (const e of empresas || []) if (mesValido(e.inicio)) menor = Math.min(menor, +e.inicio.slice(0, 4));
  const out = [];
  for (let a = Math.max(menor, atual - 10); a <= atual; a++) out.push(a);
  return out;
}

/** O início do controle pra quem entra agora: o mês da entrada na carteira, mas não antes de janeiro do ano passado. */
export function inicioSugerido(entrada, hoje) {
  const piso = (+String(hoje).slice(0, 4) - 1) + '-01';
  const mes = diaValido(String(entrada || '').slice(0, 10)) ? mesDoDia(entrada) : mesDoDia(hoje);
  return mes < piso ? piso : mes;
}

/** O que foi feito no mês de hoje (pelo dia de feita): quantos meses e de quantas empresas. */
export function feitoNoMes(linhas, hoje) {
  const mes = mesDoDia(hoje);
  const empresas = new Set();
  let meses = 0;
  for (const l of linhas || []) if (l && l.situacao === 'feita' && String(l.feita_em || '').slice(0, 7) === mes) { meses++; empresas.add(l.cliente_id); }
  return { meses, empresas: empresas.size };
}
