// ============================================================
// MACEDO & REIS — Edge Function ponte: o pacote do Domínio (02/11/2026)
// O que a ponte do PC do escritório lê do banco do Domínio Web (o contrato está em ponte/pacote.py e ponte/fonte.py):
// as empresas do Domínio e, por empresa e mês, a folha, as notas e os lançamentos — só totais. Conferido campo a campo
// e montado de novo só com o que o contrato prevê; quem grava é o banco (dominio_gravar), com o pacote que sai daqui.
// O que é da rodada fora do contrato recusa o pacote inteiro (422); a linha de um mês fora do contrato fica de fora
// sozinha e volta em `recusadas`.
// O vazio: a consulta não traz linha pra empresa sem nota ou sem lançamento no mês, e a ponte manda null (nunca um 0
// inventado). Aqui, com o bloco lido inteiro (fora do `faltou`), o null vira 0 — nas notas e nos lançamentos de toda
// empresa, e na folha só da empresa ativa no Domínio (a consulta da folha olha a ativa e a que teve folha calculada no
// mês; a inativa sem folha fica null: o Domínio não diz). O bloco do `faltou` segue null e não apaga o que já estava
// gravado (blocos_ok vai pro banco).
// Sem import: testes no node em tests/ponte-funcao.test.mjs.
// ============================================================

export const LIMITES_DOMINIO = { empresas: 5000, mensal: 60000, faltou: 20, meses: 36, recusadas: 50 };
export const BLOCOS_DOMINIO = {
  folha: ['funcionarios_ativos', 'admissoes', 'desligamentos', 'afastados', 'pro_labore'],
  fiscal: ['notas_saida', 'valor_saidas', 'notas_entrada', 'valor_entradas'],
  contabil: ['lancamentos', 'ultimo_lancamento']
};
const INTEIROS = new Set(['funcionarios_ativos', 'admissoes', 'desligamentos', 'afastados', 'pro_labore', 'notas_saida', 'notas_entrada', 'lancamentos']);
const VALORES = new Set(['valor_saidas', 'valor_entradas']);

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

// uma linha do mês: o que o contrato prevê, conferido (fora dele, Recusa com o campo)
function linhaDoMes(l, onde, ateMes) {
  objeto(l, onde);
  const codigo = l.codigo;
  if (typeof codigo !== 'number' || !Number.isInteger(codigo) || codigo <= 0) recusar(onde + '.codigo', 'código que não é um inteiro positivo');
  const competencia = String(l.competencia || '');
  if (!COMPETENCIA.test(competencia)) recusar(onde + '.competencia', 'competência fora do formato AAAA-MM');
  const atras = mesesEntre(ateMes, competencia);
  if (atras < 0 || atras >= LIMITES_DOMINIO.meses) recusar(onde + '.competencia', 'competência fora dos ' + LIMITES_DOMINIO.meses + ' meses até dados_ate');
  const saida = { codigo, competencia };
  for (const campos of Object.values(BLOCOS_DOMINIO)) {
    for (const c of campos) {
      const v = l[c];
      if (INTEIROS.has(c)) saida[c] = inteiroDe(v, onde + '.' + c);
      else if (VALORES.has(c)) saida[c] = valorDe(v, onde + '.' + c);
      else {
        const d = dataDe(v, onde + '.' + c);
        if (d && d.slice(0, 7) !== competencia) recusar(onde + '.' + c, 'último lançamento fora do mês da linha');
        saida[c] = d;
      }
    }
  }
  return saida;
}

// validarPacoteDominio(corpo) → { ok: true, pacote, recusadas } | { ok: false, erro, campo }
// pacote = { versao, rodada, empresas, mensal, faltou, blocos_ok } — o que vai pra dominio_gravar
export function validarPacoteDominio(corpo) {
  try {
    objeto(corpo, 'pacote');
    if (corpo.versao !== 1) recusar('versao', 'versão desconhecida (esta função lê a 1)');
    const r = objeto(corpo.rodada, 'rodada');
    const id = String(r.id || '');
    if (!UUID.test(id)) recusar('rodada.id', 'tem que ser um uuid');
    const dadosAte = dataDe(r.dados_ate, 'rodada.dados_ate');
    if (!dadosAte) recusar('rodada.dados_ate', 'falta o dia dos dados');
    const rodada = {
      id: id.toLowerCase(), inicio: momentoDe(r.inicio, 'rodada.inicio'), fim: momentoDe(r.fim, 'rodada.fim'),
      dados_ate: dadosAte, maquina: texto(r.maquina, 100), ponte: texto(r.ponte, 20)
    };

    // o que faltou: só os três blocos do mês (a de empresas, sem ela a ponte nem manda)
    const faltou = lista(corpo.faltou == null ? [] : corpo.faltou, LIMITES_DOMINIO.faltou, 'faltou').map((f, i) => {
      objeto(f, 'faltou[' + i + ']');
      if (!(f.bloco in BLOCOS_DOMINIO)) recusar('faltou[' + i + '].bloco', 'tem que ser folha, fiscal ou contabil');
      return { bloco: f.bloco, motivo: texto(f.motivo, 200) };
    });
    const blocosOk = Object.fromEntries(Object.keys(BLOCOS_DOMINIO).map(b => [b, !faltou.some(f => f.bloco === b)]));

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
      try { linha = linhaDoMes(l, 'mensal[' + i + ']', ateMes); } catch (e) {
        if (!(e instanceof Recusa)) throw e;
        anotar(l, e.campo, e.message); return;
      }
      if (!ativa.has(linha.codigo)) { anotar(l, 'mensal[' + i + '].codigo', 'empresa que não está na lista de empresas'); return; }
      const chave = linha.codigo + '|' + linha.competencia;
      if (vistas.has(chave)) { anotar(l, 'mensal[' + i + ']', 'empresa e mês repetidos'); return; }
      vistas.add(chave);
      // o vazio de um bloco lido inteiro é zero (a nota, o lançamento; a folha só da empresa ativa)
      for (const [bloco, campos] of Object.entries(BLOCOS_DOMINIO)) {
        if (!blocosOk[bloco]) { campos.forEach(c => { linha[c] = null; }); continue; }
        if (bloco === 'folha' && ativa.get(linha.codigo) !== true) continue;
        for (const c of campos) if (linha[c] == null && c !== 'ultimo_lancamento') linha[c] = 0;
      }
      mensal.push(linha);
    });

    return {
      ok: true,
      pacote: { versao: 1, rodada, empresas, mensal, faltou, blocos_ok: blocosOk },
      recusadas, linhas_recusadas: foraDaLista
    };
  } catch (e) {
    if (e instanceof Recusa) return { ok: false, erro: e.message, campo: e.campo };
    throw e;
  }
}
