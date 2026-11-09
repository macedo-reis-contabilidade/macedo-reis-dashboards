// ============================================================
// MACEDO & REIS — Edge Function ponte: o pacote do Domínio (02/11/2026)
// O que a ponte do PC do escritório lê do banco do Domínio Web (o contrato está em ponte/pacote.py e ponte/fonte.py):
// as empresas do Domínio e, por empresa e mês, a folha, as notas e os lançamentos — só totais. Desde a versão 2 do
// pacote (05/11/2026), também o faturamento, as compras e a folha em reais (somada por empresa, nunca por pessoa).
// Conferido campo a campo e montado de novo só com o que o contrato prevê; quem grava é o banco (dominio_gravar),
// com o pacote que sai daqui. A versão 1 (a ponte antiga) segue aceita: nela, os três blocos novos não foram lidos
// (blocos_ok falso) e o banco não mexe no que já tinha deles.
// O que é da rodada fora do contrato recusa o pacote inteiro (422); a linha de um mês fora do contrato fica de fora
// sozinha e volta em `recusadas`.
// O vazio: a consulta não traz linha pra empresa sem nota ou sem lançamento no mês, e a ponte manda null (nunca um 0
// inventado). Aqui, com o bloco lido inteiro (fora do `faltou`), o null vira 0 — nas notas e nos lançamentos de toda
// empresa, e na folha só da empresa ativa no Domínio (a consulta da folha olha a ativa e a que teve folha calculada no
// mês; a inativa sem folha fica null: o Domínio não diz). O bloco do `faltou` segue null e não apaga o que já estava
// gravado (blocos_ok vai pro banco). Nos blocos da versão 2: no faturamento, o null vira 0 só na receita pelas notas
// (receita_bruta, receita_mercadorias, receita_servicos, devolucoes) — o que é da apuração do Simples segue null na
// empresa sem apuração; nas compras, em toda empresa; na folha em reais, só na empresa ativa, como a folha.
// A versão 3 (05/11/2026): o andamento das contabilidades. Por mês, os lançamentos por origem (origens), a receita, a
// folha e os encargos lançados (cruzamentos) e os saldos estranhos no fim do mês (saldos) — o vazio deles vira 0 em
// toda empresa, menos o incluido_ate —; e duas listas fora do mês: `andamento` (a foto do dia, uma linha por empresa:
// até onde o banco, o extrato e o caixa estão lançados e a data do fechamento) e `encerramento` (o zeramento de cada
// empresa nos anos lidos). Um item delas fora do contrato fica de fora sozinho (volta em `recusadas`); o bloco que veio
// no `faltou` não mexe no que o banco tinha.
// A versão 4 (09/11/2026, a escala 6x1): a lista `jornadas`, outra foto do dia — a jornada dos funcionários somada por
// empresa e grupo de jornada (decisão do Samuel: quantos, as horas e a soma dos salários de cada grupo; nome e CPF
// ficam no PC). Montada de novo só com os campos do contrato (o nome ou o CPF que viesse fica de fora); o grupo fora do
// contrato fica de fora sozinho. Quem grava é a dominio_gravar_jornadas, depois das partes (servidor.js).
// Sem import: testes no node em tests/ponte-funcao.test.mjs.
// ============================================================

export const LIMITES_DOMINIO = { empresas: 5000, mensal: 60000, andamento: 5000, encerramento: 20000, jornadas: 20000, anos: 5, faltou: 20, meses: 36, recusadas: 50 };
export const BLOCOS_DOMINIO = {
  folha: ['funcionarios_ativos', 'admissoes', 'desligamentos', 'afastados', 'pro_labore'],
  fiscal: ['notas_saida', 'valor_saidas', 'notas_entrada', 'valor_entradas'],
  contabil: ['lancamentos', 'ultimo_lancamento'],
  // a versão 2 (05/11/2026)
  faturamento: ['receita_bruta', 'receita_mercadorias', 'receita_servicos', 'devolucoes', 'receita_simples',
    'receita_simples_propria', 'receita_st', 'receita_monofasica', 'receita_exportacao', 'receita_anexo_1',
    'receita_anexo_2', 'receita_anexo_3', 'receita_anexo_4', 'receita_anexo_5', 'rbt12', 'meses_rbt12'],
  compras: ['compras', 'compras_st', 'servicos_tomados', 'ativo_e_consumo', 'devolucoes_de_venda', 'outras_entradas'],
  folha_valores: ['salarios', 'ferias', 'rescisoes', 'decimo_terceiro', 'pro_labore_valor', 'base_inss', 'base_fgts',
    'fgts', 'inss_empresa', 'inss_rat', 'inss_terceiros'],
  // a versão 3 (05/11/2026)
  origens: ['lanc_normais', 'lanc_extrato', 'lanc_fiscal', 'lanc_folha', 'lanc_apuracao', 'lanc_outros', 'incluido_ate'],
  cruzamentos: ['receita_lancada', 'folha_lancada', 'encargos_lancados'],
  saldos: ['caixa_negativo', 'contra_natureza', 'sem_natureza', 'transitorias', 'transitorias_valor']
};
// as listas fora do mês (a versão 3): a foto do dia e o encerramento de cada ano
export const CAMPOS_ANDAMENTO = ['banco_contas', 'banco_ate', 'banco_ultimo', 'banco_ultimo_geral', 'caixa_ate',
  'caixa_contador_ate', 'extrato_contas', 'extrato_ate', 'extrato_pendentes', 'conciliadas', 'conciliado_ate', 'fechamento_em'];
export const CAMPOS_ENCERRAMENTO = ['zerado_em', 'zeramentos', 'zerado_incluido_em', 'lancados_depois', 'lancamentos_do_ano'];
// a jornada (a versão 4): o grupo é (codigo, jornada, horas_semana, horas_mes, forma, controle, categoria, unidade)
export const CAMPOS_JORNADA = ['jornada', 'tipo', 'tipo_escala', 'semana', 'min_semana', 'min_maior_dia', 'ciclo_dias',
  'ciclo_trabalho', 'horas_semana', 'horas_mes', 'forma', 'controle', 'categoria', 'unidade', 'empregados', 'afastados',
  'compensa_sabado', 'superior', 'superior_teto', 'salarios'];
const CHAVE_DO_GRUPO = ['codigo', 'jornada', 'horas_semana', 'horas_mes', 'forma', 'controle', 'categoria', 'unidade'];
const BLOCOS_FOTO = ['andamento', 'encerramento', 'jornadas'];
// os blocos de cada versão do pacote
export const BLOCOS_DA_VERSAO = {
  1: ['folha', 'fiscal', 'contabil'],
  2: ['folha', 'fiscal', 'contabil', 'faturamento', 'compras', 'folha_valores'],
  3: [...Object.keys(BLOCOS_DOMINIO), 'andamento', 'encerramento'],
  4: [...Object.keys(BLOCOS_DOMINIO), 'andamento', 'encerramento', 'jornadas']
};
const VERSOES = Object.keys(BLOCOS_DA_VERSAO).map(Number);
const TODOS_OS_BLOCOS = [...Object.keys(BLOCOS_DOMINIO), ...BLOCOS_FOTO];
const INTEIROS = new Set(['funcionarios_ativos', 'admissoes', 'desligamentos', 'afastados', 'pro_labore', 'notas_saida', 'notas_entrada', 'lancamentos', 'meses_rbt12',
  'lanc_normais', 'lanc_extrato', 'lanc_fiscal', 'lanc_folha', 'lanc_apuracao', 'lanc_outros',
  'caixa_negativo', 'contra_natureza', 'sem_natureza', 'transitorias',
  'banco_contas', 'extrato_contas', 'extrato_pendentes', 'conciliadas', 'zeramentos', 'lancados_depois', 'lancamentos_do_ano']);
const VALORES = new Set(['valor_saidas', 'valor_entradas', 'receita_lancada', 'folha_lancada', 'encargos_lancados', 'transitorias_valor',
  ...['faturamento', 'compras', 'folha_valores'].flatMap(b => BLOCOS_DOMINIO[b]).filter(c => c !== 'meses_rbt12')]);
// o vazio de um bloco lido inteiro: o que vira 0 em toda empresa (o resto do bloco segue null)
const ZERO_EM_TODA = {
  fiscal: BLOCOS_DOMINIO.fiscal, contabil: ['lancamentos'],
  faturamento: ['receita_bruta', 'receita_mercadorias', 'receita_servicos', 'devolucoes'], compras: BLOCOS_DOMINIO.compras,
  origens: BLOCOS_DOMINIO.origens.filter(c => c !== 'incluido_ate'), cruzamentos: BLOCOS_DOMINIO.cruzamentos,
  saldos: BLOCOS_DOMINIO.saldos
};
// … e o que vira 0 só na empresa ativa no Domínio (a inativa sem folha: o Domínio não diz)
const ZERO_NA_ATIVA = { folha: BLOCOS_DOMINIO.folha, folha_valores: BLOCOS_DOMINIO.folha_valores };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COMPETENCIA = /^([0-9]{4})-(0[1-9]|1[0-2])$/;

class Recusa extends Error {}
const recusar = (campo, porque) => { const e = new Recusa(porque); e.campo = campo; throw e; };

const texto = (v, max) => {
  if (v == null) return null;
  const s = String(v).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return s ? s.slice(0, max) : null;
};
// o documento como o Domínio guarda: CNPJ (com letras, desde o CNPJ alfanumérico), CPF, CEI ou CAEPF — só letras e
// dígitos, em maiúscula; fora disso, sem documento (a empresa entra, só não se liga ao cadastro)
const documentoDe = v => {
  const d = String(v == null ? '' : v).replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  return d.length >= 11 && d.length <= 14 ? d : null;
};
const dataDe = (v, campo) => {
  if (v == null || v === '') return null;
  const s = String(v);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) recusar(campo, 'data fora do formato AAAA-MM-DD');
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) recusar(campo, 'data que não existe');
  return s;
};
const momentoDe = (v, campo) => {
  if (v == null || v === '') recusar(campo, 'falta a data e hora');
  const s = String(v);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(s) || Number.isNaN(Date.parse(s))) recusar(campo, 'data e hora fora do formato (com o fuso)');
  return s;
};
const inteiroDe = (v, campo) => {
  if (v == null) return null;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 1e7) recusar(campo, 'contagem que não é um inteiro de 0 a 10 milhões');
  return v;
};
const valorDe = (v, campo) => {
  if (v == null) return null;
  if (typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > 1e13) recusar(campo, 'valor que não é um número de dinheiro');
  return Math.round(v * 100) / 100;
};
const lista = (v, max, campo) => {
  if (!Array.isArray(v)) recusar(campo, 'tem que ser uma lista');
  if (v.length > max) recusar(campo, 'lista longa demais (até ' + max + ')');
  return v;
};
const objeto = (v, campo) => {
  if (v == null || typeof v !== 'object' || Array.isArray(v)) recusar(campo, 'tem que ser um objeto');
  return v;
};
// quantos meses do mês `b` até o `a` ('AAAA-MM'): positivo = `a` depois
const mesesEntre = (a, b) => { const [ya, ma] = a.split('-').map(Number), [yb, mb] = b.split('-').map(Number); return (ya - yb) * 12 + (ma - mb); };
// as datas que não são do mês da linha (o dia em que entrou no Domínio, a foto do dia, o fechamento, o zeramento): de
// 1990 até o fim do ano depois do de dados_ate — o que cai fora disso é lixo e fica de fora
const DATA_MIN = '1990-01-01';
const dataLarga = (v, campo, dadosAte) => {
  const d = dataDe(v, campo);
  if (d && (d < DATA_MIN || d > (+dadosAte.slice(0, 4) + 1) + '-12-31')) recusar(campo, 'data fora de 1990 até o ano que vem');
  return d;
};

// uma linha do mês: o que o contrato prevê, conferido (fora dele, Recusa com o campo)
function linhaDoMes(l, onde, ateMes, blocos, dadosAte) {
  objeto(l, onde);
  const codigo = l.codigo;
  if (typeof codigo !== 'number' || !Number.isInteger(codigo) || codigo <= 0) recusar(onde + '.codigo', 'código que não é um inteiro positivo');
  const competencia = String(l.competencia || '');
  if (!COMPETENCIA.test(competencia)) recusar(onde + '.competencia', 'competência fora do formato AAAA-MM');
  const atras = mesesEntre(ateMes, competencia);
  if (atras < 0 || atras >= LIMITES_DOMINIO.meses) recusar(onde + '.competencia', 'competência fora dos ' + LIMITES_DOMINIO.meses + ' meses até dados_ate');
  const saida = { codigo, competencia };
  for (const [bloco, campos] of Object.entries(BLOCOS_DOMINIO)) {
    for (const c of campos) {
      if (!blocos.includes(bloco)) { saida[c] = null; continue; }
      const v = l[c];
      if (INTEIROS.has(c)) {
        saida[c] = inteiroDe(v, onde + '.' + c);
        // os meses que entraram no RBT12: de 0 a 12 (o banco recusa o resto, e a rodada inteira não gravaria)
        if (c === 'meses_rbt12' && saida[c] != null && saida[c] > 12) recusar(onde + '.' + c, 'meses do RBT12 acima de 12');
      }
      else if (VALORES.has(c)) saida[c] = valorDe(v, onde + '.' + c);
      else if (c === 'ultimo_lancamento') {
        const d = dataDe(v, onde + '.' + c);
        if (d && d.slice(0, 7) !== competencia) recusar(onde + '.' + c, 'último lançamento fora do mês da linha');
        saida[c] = d;
      }
      else saida[c] = dataLarga(v, onde + '.' + c, dadosAte);
    }
  }
  return saida;
}

// um item da foto do dia: o código e os campos do contrato
function itemDoAndamento(a, onde, dadosAte) {
  objeto(a, onde);
  if (typeof a.codigo !== 'number' || !Number.isInteger(a.codigo) || a.codigo <= 0) recusar(onde + '.codigo', 'código que não é um inteiro positivo');
  const saida = { codigo: a.codigo };
  for (const c of CAMPOS_ANDAMENTO) saida[c] = INTEIROS.has(c) ? inteiroDe(a[c], onde + '.' + c) : dataLarga(a[c], onde + '.' + c, dadosAte);
  return saida;
}
// um item do encerramento: o código, o ano (dos LIMITES_DOMINIO.anos até o de dados_ate) e o zeramento dentro do ano
function itemDoEncerramento(z, onde, dadosAte) {
  objeto(z, onde);
  if (typeof z.codigo !== 'number' || !Number.isInteger(z.codigo) || z.codigo <= 0) recusar(onde + '.codigo', 'código que não é um inteiro positivo');
  const anoHoje = +dadosAte.slice(0, 4);
  if (typeof z.ano !== 'number' || !Number.isInteger(z.ano) || z.ano > anoHoje || z.ano < anoHoje - LIMITES_DOMINIO.anos) recusar(onde + '.ano', 'ano fora dos ' + LIMITES_DOMINIO.anos + ' anos até o de dados_ate');
  const saida = { codigo: z.codigo, ano: z.ano };
  for (const c of CAMPOS_ENCERRAMENTO) saida[c] = INTEIROS.has(c) ? inteiroDe(z[c], onde + '.' + c) : dataLarga(z[c], onde + '.' + c, dadosAte);
  if (saida.zerado_em && saida.zerado_em.slice(0, 4) !== String(z.ano)) recusar(onde + '.zerado_em', 'zeramento fora do ano do item');
  return saida;
}
// um grupo da jornada (a versão 4): só os campos do contrato, cada um na faixa dele
const inteiroNaFaixa = (v, campo, min, max, porque) => {
  if (v == null) return null;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) recusar(campo, porque);
  return v;
};
const horasDe = (v, campo, max) => {
  if (v == null) return null;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > max) recusar(campo, 'horas fora de 0 a ' + max);
  return Math.round(v * 100) / 100;
};
const SEMANA = /^[TCF-]{7}$/;
function itemDaJornada(j, onde) {
  objeto(j, onde);
  if (typeof j.codigo !== 'number' || !Number.isInteger(j.codigo) || j.codigo <= 0) recusar(onde + '.codigo', 'código que não é um inteiro positivo');
  const s = { codigo: j.codigo };
  s.jornada = inteiroNaFaixa(j.jornada, onde + '.jornada', 0, 1e9, 'jornada que não é um inteiro');
  s.tipo = inteiroNaFaixa(j.tipo, onde + '.tipo', 0, 99, 'tipo que não é um inteiro de 0 a 99');
  s.tipo_escala = inteiroNaFaixa(j.tipo_escala, onde + '.tipo_escala', 0, 99, 'tipo de escala que não é um inteiro de 0 a 99');
  if (j.semana != null && (typeof j.semana !== 'string' || !SEMANA.test(j.semana))) recusar(onde + '.semana', 'semana que não são 7 letras T, C, F ou -');
  s.semana = j.semana == null ? null : j.semana;
  s.min_semana = inteiroNaFaixa(j.min_semana, onde + '.min_semana', 0, 7 * 24 * 60, 'minutos na semana fora de 0 a 10.080');
  s.min_maior_dia = inteiroNaFaixa(j.min_maior_dia, onde + '.min_maior_dia', 0, 24 * 60, 'minutos no dia fora de 0 a 1.440');
  s.ciclo_dias = inteiroNaFaixa(j.ciclo_dias, onde + '.ciclo_dias', 1, 400, 'ciclo fora de 1 a 400 dias');
  s.ciclo_trabalho = inteiroNaFaixa(j.ciclo_trabalho, onde + '.ciclo_trabalho', 0, 400, 'dias trabalhados no ciclo fora de 0 a 400');
  if (s.ciclo_trabalho != null && s.ciclo_dias != null && s.ciclo_trabalho > s.ciclo_dias) recusar(onde + '.ciclo_trabalho', 'mais dias trabalhados que os dias do ciclo');
  s.horas_semana = horasDe(j.horas_semana, onde + '.horas_semana', 168);
  s.horas_mes = horasDe(j.horas_mes, onde + '.horas_mes', 744);
  s.forma = inteiroNaFaixa(j.forma, onde + '.forma', 0, 99, 'forma de cálculo que não é um inteiro de 0 a 99');
  s.controle = inteiroNaFaixa(j.controle, onde + '.controle', 0, 99, 'tipo de horário que não é um inteiro de 0 a 99');
  s.categoria = inteiroNaFaixa(j.categoria, onde + '.categoria', 101, 111, 'categoria que não é de empregado (101 a 111)');
  if (s.categoria == null) recusar(onde + '.categoria', 'falta a categoria');
  s.unidade = inteiroNaFaixa(j.unidade, onde + '.unidade', 1, 7, 'unidade do salário fora de 1 a 7');
  s.empregados = inteiroNaFaixa(j.empregados, onde + '.empregados', 1, 1e6, 'grupo sem empregados');
  if (s.empregados == null) recusar(onde + '.empregados', 'grupo sem empregados');
  for (const c of ['afastados', 'compensa_sabado', 'superior', 'superior_teto']) {
    const v = inteiroNaFaixa(j[c], onde + '.' + c, 0, s.empregados, 'mais que os empregados do grupo');
    s[c] = v == null ? 0 : v;
  }
  if (s.superior_teto > s.superior) recusar(onde + '.superior_teto', 'mais que os com o superior completo');
  s.salarios = valorDe(j.salarios, onde + '.salarios');
  if (s.salarios != null && s.salarios < 0) recusar(onde + '.salarios', 'soma dos salários negativa');
  return s;
}

// validarPacoteDominio(corpo) → { ok: true, pacote, recusadas } | { ok: false, erro, campo }
// pacote = { versao, rodada, empresas, mensal, andamento, encerramento, jornadas, faltou, blocos_ok } — o que vai pra
// dominio_gravar (a jornada vai à parte, pra dominio_gravar_jornadas)
// (blocos_ok com todos os blocos: o que a versão do pacote não tem vai falso, e o banco não mexe nele)
export function validarPacoteDominio(corpo) {
  try {
    objeto(corpo, 'pacote');
    if (!VERSOES.includes(corpo.versao)) recusar('versao', 'versão desconhecida (esta função lê da 1 à ' + Math.max(...VERSOES) + ')');
    const blocos = BLOCOS_DA_VERSAO[corpo.versao];
    const r = objeto(corpo.rodada, 'rodada');
    const id = String(r.id || '');
    if (!UUID.test(id)) recusar('rodada.id', 'tem que ser um uuid');
    const dadosAte = dataDe(r.dados_ate, 'rodada.dados_ate');
    if (!dadosAte) recusar('rodada.dados_ate', 'falta o dia dos dados');
    const rodada = {
      id: id.toLowerCase(), inicio: momentoDe(r.inicio, 'rodada.inicio'), fim: momentoDe(r.fim, 'rodada.fim'),
      dados_ate: dadosAte, maquina: texto(r.maquina, 100), ponte: texto(r.ponte, 20)
    };

    // o que faltou: só os blocos da versão (a de empresas, sem ela a ponte nem manda)
    const faltou = lista(corpo.faltou == null ? [] : corpo.faltou, LIMITES_DOMINIO.faltou, 'faltou').map((f, i) => {
      objeto(f, 'faltou[' + i + ']');
      if (!blocos.includes(f.bloco)) recusar('faltou[' + i + '].bloco', 'tem que ser um destes: ' + blocos.join(', '));
      return { bloco: f.bloco, motivo: texto(f.motivo, 200) };
    });
    const blocosOk = Object.fromEntries(TODOS_OS_BLOCOS.map(b => [b, blocos.includes(b) && !faltou.some(f => f.bloco === b)]));

    // as empresas: o código do Domínio é a chave (repetido, fica o primeiro)
    const empresas = [], ativa = new Map();
    const brutas = lista(corpo.empresas, LIMITES_DOMINIO.empresas, 'empresas');
    if (!brutas.length) recusar('empresas', 'sem empresas não há o que gravar');
    brutas.forEach((e, i) => {
      objeto(e, 'empresas[' + i + ']');
      const codigo = e.codigo;
      if (typeof codigo !== 'number' || !Number.isInteger(codigo) || codigo <= 0) recusar('empresas[' + i + '].codigo', 'código que não é um inteiro positivo');
      if (ativa.has(codigo)) return;
      if (e.ativa != null && typeof e.ativa !== 'boolean') recusar('empresas[' + i + '].ativa', 'tem que ser true, false ou null');
      const emp = { codigo, documento: documentoDe(e.documento), nome: texto(e.nome, 200), ativa: e.ativa == null ? null : e.ativa };
      ativa.set(codigo, emp.ativa);
      empresas.push(emp);
    });

    // as linhas do mês: a de fora do contrato (ou de empresa que não está na lista, ou repetida) fica de fora sozinha
    const ateMes = dadosAte.slice(0, 7);
    const mensal = [], recusadas = [], vistas = new Set();
    let foraDaLista = 0;
    const anotar = (l, campo, erro) => {
      foraDaLista++;
      if (recusadas.length < LIMITES_DOMINIO.recusadas) {
        recusadas.push({ codigo: l && Number.isInteger(l.codigo) ? l.codigo : null, competencia: l && typeof l.competencia === 'string' ? l.competencia.slice(0, 7) : null, campo, erro });
      }
    };
    lista(corpo.mensal, LIMITES_DOMINIO.mensal, 'mensal').forEach((l, i) => {
      let linha;
      try { linha = linhaDoMes(l, 'mensal[' + i + ']', ateMes, blocos, dadosAte); } catch (e) {
        if (!(e instanceof Recusa)) throw e;
        anotar(l, e.campo, e.message); return;
      }
      if (!ativa.has(linha.codigo)) { anotar(l, 'mensal[' + i + '].codigo', 'empresa que não está na lista de empresas'); return; }
      const chave = linha.codigo + '|' + linha.competencia;
      if (vistas.has(chave)) { anotar(l, 'mensal[' + i + ']', 'empresa e mês repetidos'); return; }
      vistas.add(chave);
      // o vazio de um bloco lido inteiro é zero (a nota, o lançamento, a receita pelas notas, as compras; a folha e a
      // folha em reais só da empresa ativa); o bloco que não foi lido sai null inteiro
      for (const [bloco, campos] of Object.entries(BLOCOS_DOMINIO)) {
        if (!blocosOk[bloco]) { campos.forEach(c => { linha[c] = null; }); continue; }
        const zerar = ZERO_EM_TODA[bloco] || (ativa.get(linha.codigo) === true ? ZERO_NA_ATIVA[bloco] : null) || [];
        for (const c of zerar) if (linha[c] == null) linha[c] = 0;
      }
      mensal.push(linha);
    });

    // a foto do dia e o encerramento (a versão 3): o item fora do contrato, de empresa que não está na lista ou repetido
    // fica de fora sozinho; o bloco que não foi lido (versão antiga ou no faltou) vai vazio, e o banco não mexe nele
    const lerLista = (bloco, chave, item) => {
      if (!blocosOk[bloco]) return [];
      const saida = [], vistos = new Set();
      lista(corpo[bloco] == null ? [] : corpo[bloco], LIMITES_DOMINIO[bloco], bloco).forEach((x, i) => {
        let it;
        try { it = item(x, bloco + '[' + i + ']', dadosAte); } catch (e) {
          if (!(e instanceof Recusa)) throw e;
          anotar(x && typeof x === 'object' ? { codigo: x.codigo } : null, e.campo, e.message); return;
        }
        if (!ativa.has(it.codigo)) { anotar(it, bloco + '[' + i + '].codigo', 'empresa que não está na lista de empresas'); return; }
        const k = chave(it);
        if (vistos.has(k)) { anotar(it, bloco + '[' + i + ']', 'item repetido'); return; }
        vistos.add(k);
        saida.push(it);
      });
      return saida;
    };
    const andamento = lerLista('andamento', it => it.codigo, itemDoAndamento);
    const encerramento = lerLista('encerramento', it => it.codigo + '|' + it.ano, itemDoEncerramento);
    // a jornada (a versão 4): o grupo repetido (a mesma chave) fica de fora, como o item repetido das outras fotos
    const jornadas = lerLista('jornadas', it => CHAVE_DO_GRUPO.map(c => it[c]).join('|'), itemDaJornada);

    return {
      ok: true,
      pacote: { versao: corpo.versao, rodada, empresas, mensal, andamento, encerramento, jornadas, faltou, blocos_ok: blocosOk },
      recusadas, linhas_recusadas: foraDaLista
    };
  } catch (e) {
    if (e instanceof Recusa) return { ok: false, erro: e.message, campo: e.campo };
    throw e;
  }
}
