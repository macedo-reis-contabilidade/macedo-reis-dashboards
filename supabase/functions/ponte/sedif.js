// ============================================================
// MACEDO & REIS — Edge Function ponte: as notas de entrada das empresas da SEDIF/DeSTDA, da Domínio (26/11/2026)
// O pedido da Thalia: a Conferência SEDIF/DeSTDA (fiscal-destda.html) precisava dos XMLs de entrada do mês, que ela
// exportava da Domínio e soltava na tela (a do Cleiton, 1.222 notas num mês). A ponte do PC passa a ler da Domínio as
// NF-e de compra dessas empresas (pela data de entrada, a do livro) e o XML que a Domínio guarda, lê cada nota como o
// importador dos XMLs lê (assets/js/importar-xml.js; ponte/nfe.py: a nota e os itens, com a base, a alíquota e o valor do
// ICMS e a base e o valor da ST) e manda, empresa por empresa. O XML não sai do PC. A função confere e o banco grava como
// a importação grava (nf_gravar_notas_entrada): a nota nova entra com os itens e a data de entrada da Domínio; a que já
// estava na base ganha a data e os itens do XML (como importar de novo). A nota de emitente pessoa física não vai.
// O contrato: docs/FILA-CODE-2026-11-26-NOTAS-SEDIF.md.
//   a lista das empresas e a janela: a das datas de entrada ({ versao: 1, tipo: 'entradas', pedir: 'empresas' })
//   { versao: 1, tipo: 'sedif', rodada: { id, inicio, maquina?, ponte? }, empresa: { codigo },
//     notas: [{ chave, entrada, doc: { os campos da nf_documentos }, itens: [{ os campos da nf_itens }] }] }
// Recusa o pacote inteiro (422) só o que é do pacote (a rodada, a empresa, a lista); a nota fora do contrato fica de fora
// sozinha e volta em `recusadas` ({ codigo, chave, campo, erro }), pra ponte anotar no log.
// Sem import do resto da função além das conferências da chave e da janela: testes no node em tests/ponte-funcao.test.mjs.
// ============================================================
import { chaveValida, pareceCpf } from './notas.js';
import { MESES_DA_JANELA } from './entradas.js';

export const LIMITES_SEDIF = { notas: 200, itens: 990, itensNoPacote: 60000, recusadas: 50 };
export const NAO_E_DA_EMPRESA = 'A nota não é de entrada desta empresa (o destinatário é outro, ou ela mesma emitiu).';
const UFS = new Set(['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR',
  'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO']);
const STATUS = new Set(['autorizada', 'cancelada', 'denegada']);
const DOC_TEXTO = { serie: 10, numero: 20, natureza_operacao: 300, emit_nome: 300, emit_municipio: 120, emit_ie: 30,
  dest_nome: 300, dest_municipio: 120, dest_ie: 30 };
const DOC_VALORES = ['valor_total', 'valor_produtos', 'valor_desconto', 'valor_frete', 'icms', 'icms_st', 'ipi', 'pis', 'cofins'];
const ITEM_TEXTO = { codigo: 120, descricao: 600, unidade: 12, icms_origem: 2, icms_cst: 3, csosn: 4, pis_cst: 3, cofins_cst: 3 };
const ITEM_VALORES = ['quantidade', 'valor_unitario', 'valor_total', 'desconto', 'icms_valor', 'icms_st_valor', 'ipi_valor',
  'pis_valor', 'cofins_valor'];
const ITEM_OU_NULO = ['icms_base', 'icms_aliquota', 'icms_st_base'];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RX_CNPJ = /^[0-9A-Z]{12}\d{2}$/;
class Recusa extends Error {}
const recusar = (campo, porque) => { const e = new Recusa(porque); e.campo = campo; throw e; };
const objeto = (v, campo) => {
  if (v == null || typeof v !== 'object' || Array.isArray(v)) recusar(campo, 'tem que ser um objeto');
  return v;
};
// o texto como o importador guarda (sem as pontas), sem os caracteres de controle; o ausente fica nulo
const texto = (v, max, campo) => {
  if (v == null) return null;
  if (typeof v !== 'string') recusar(campo, 'tem que ser texto');
  return v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max);
};
const numero = (v, campo, nulo) => {
  if (v == null) return nulo ? null : 0;
  if (typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) >= 1e13) recusar(campo, 'tem que ser um número');
  return v;
};
const inteiro = (v, campo, aceitos) => {
  if (v == null) return null;
  if (!Number.isInteger(v) || (aceitos && !aceitos.includes(v))) recusar(campo, 'fora dos valores possíveis');
  return v;
};
const digitos = (v, max, campo, exato) => {
  if (v == null) return null;
  const s = String(v);
  if (!(exato ? new RegExp('^\\d{' + max + '}$') : new RegExp('^\\d{1,' + max + '}$')).test(s)) recusar(campo, 'só dígitos, até ' + max);
  return s;
};
const momentoDe = (v, campo) => {
  const s = String(v == null ? '' : v);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(s) || Number.isNaN(Date.parse(s))) recusar(campo, 'data e hora fora do formato (com o fuso)');
  return s;
};
const diaValido = s => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
};
const primeiroDia = (hoje, meses) => {
  const [a, m] = String(hoje).split('-').map(Number);
  return new Date(Date.UTC(a, m - 1 - meses, 1)).toISOString().slice(0, 10);
};

/** O documento como o sistema guarda (o normalizarDocumento de assets/js/utils.js): o CNPJ com letras fica com elas. */
export function docNorm(doc) {
  const s = String(doc ?? '').toUpperCase().replace(/[\s.\-\/]/g, '');
  return RX_CNPJ.test(s) ? s : s.replace(/\D/g, '');
}

function docDaNota(d, onde, chave) {
  objeto(d, onde);
  if (d.modelo != null && String(d.modelo) !== '55') recusar(onde + '.modelo', 'só NF-e, modelo 55');
  const out = { modelo: '55' };
  for (const [k, max] of Object.entries(DOC_TEXTO)) out[k] = texto(d[k], max, onde + '.' + k);
  if (!diaValido(d.data_emissao)) recusar(onde + '.data_emissao', 'data fora do formato AAAA-MM-DD, ou que não existe');
  out.data_emissao = d.data_emissao;
  out.tp_nf = inteiro(d.tp_nf, onde + '.tp_nf', [0, 1]);
  out.finalidade = inteiro(d.finalidade, onde + '.finalidade', [1, 2, 3, 4]);
  out.emit_crt = inteiro(d.emit_crt, onde + '.emit_crt', [1, 2, 3, 4]);
  out.dest_ind_ie = inteiro(d.dest_ind_ie, onde + '.dest_ind_ie', [1, 2, 9]);
  const emit = docNorm(d.emit_doc);
  if (emit.length === 11) recusar(onde + '.emit_doc', 'emitente pessoa física (CPF): a nota não vai');
  if (emit !== chave.slice(6, 20)) recusar(onde + '.emit_doc', 'o emitente do XML não é o da chave');
  out.emit_doc = emit;
  const uf = d.emit_uf == null ? null : String(d.emit_uf).toUpperCase();
  if (uf != null && !UFS.has(uf)) recusar(onde + '.emit_uf', 'UF que não existe');
  out.emit_uf = uf;
  const dest = docNorm(d.dest_doc);
  if (!(dest.length === 14 || dest.length === 11)) recusar(onde + '.dest_doc', 'o destinatário sem CNPJ ou CPF');
  out.dest_doc = dest;
  if (!['PJ', 'PF', 'EX'].includes(d.dest_tipo)) recusar(onde + '.dest_tipo', 'PJ, PF ou EX');
  out.dest_tipo = d.dest_tipo;
  const ufd = d.dest_uf == null ? null : String(d.dest_uf).toUpperCase();
  if (ufd != null && !UFS.has(ufd) && ufd !== 'EX') recusar(onde + '.dest_uf', 'UF que não existe');
  out.dest_uf = ufd;
  for (const k of DOC_VALORES) out[k] = numero(d[k], onde + '.' + k, false);
  out.cfop_principal = digitos(d.cfop_principal, 4, onde + '.cfop_principal', true);
  const st = d.status == null ? 'autorizada' : d.status;
  if (!STATUS.has(st)) recusar(onde + '.status', 'autorizada, cancelada ou denegada');
  out.status = st;
  return out;
}

function itemDaNota(i, onde) {
  objeto(i, onde);
  if (!Number.isInteger(i.n_item) || i.n_item < 1 || i.n_item > LIMITES_SEDIF.itens) recusar(onde + '.n_item', 'o número do item, de 1 a ' + LIMITES_SEDIF.itens);
  const out = { n_item: i.n_item };
  for (const [k, max] of Object.entries(ITEM_TEXTO)) out[k] = texto(i[k], max, onde + '.' + k);
  out.ncm = digitos(i.ncm, 8, onde + '.ncm');
  out.cest = digitos(i.cest, 7, onde + '.cest');
  out.cfop = digitos(i.cfop, 4, onde + '.cfop', true);
  for (const k of ITEM_VALORES) out[k] = numero(i[k], onde + '.' + k, false);
  for (const k of ITEM_OU_NULO) out[k] = numero(i[k], onde + '.' + k, true);
  return out;
}

// uma nota: a chave da NF-e (o dígito verificador conferido) de um emitente que não é pessoa física, a data de entrada de
// verdade, na janela, não antes do mês da emissão; a nota e os itens com os campos da nf_documentos e da nf_itens
function nota(n, onde, desde, hoje) {
  objeto(n, onde);
  const chave = String(n.chave == null ? '' : n.chave).trim().toUpperCase();
  if (!chaveValida(chave)) recusar(onde + '.chave', 'chave de acesso inválida (44 caracteres, com o dígito verificador)');
  if (chave.slice(20, 22) !== '55') recusar(onde + '.chave', 'só NF-e, modelo 55');
  if (pareceCpf(chave.slice(6, 20))) recusar(onde + '.chave', 'emitente pessoa física (CPF): a nota não vai');
  const entrada = String(n.entrada == null ? '' : n.entrada).trim();
  if (!diaValido(entrada)) recusar(onde + '.entrada', 'data fora do formato AAAA-MM-DD, ou que não existe');
  if (entrada < desde || entrada > hoje) recusar(onde + '.entrada', 'data de entrada fora da janela (' + desde + ' a ' + hoje + ')');
  if (entrada.slice(2, 4) + entrada.slice(5, 7) < chave.slice(2, 6)) recusar(onde + '.entrada', 'entrada antes do mês da emissão');
  const doc = docDaNota(n.doc, onde + '.doc', chave);
  if (!Array.isArray(n.itens) || !n.itens.length) recusar(onde + '.itens', 'a nota sem os itens');
  if (n.itens.length > LIMITES_SEDIF.itens) recusar(onde + '.itens', 'itens demais (até ' + LIMITES_SEDIF.itens + ')');
  const itens = [], numeros = new Set();
  n.itens.forEach((i, k) => {
    const x = itemDaNota(i, onde + '.itens[' + k + ']');
    if (numeros.has(x.n_item)) recusar(onde + '.itens[' + k + '].n_item', 'item repetido na nota');
    numeros.add(x.n_item);
    itens.push(x);
  });
  return { chave, entrada, doc, itens };
}

/** O pacote de uma empresa, conferido: { ok, pacote: { versao, tipo, rodada, empresa: { codigo }, notas }, recusadas } ou
 *  { ok: false, campo, erro }. hoje: 'AAAA-MM-DD' (em Brasília). */
export function validarPacoteSedif(p, hoje) {
  try {
    objeto(p, 'pacote');
    if (p.versao !== 1) recusar('versao', 'versão do pacote desconhecida (esta função lê a 1)');
    if (p.tipo !== 'sedif') recusar('tipo', 'não é um pacote das notas de entrada da SEDIF/DeSTDA');
    const r = objeto(p.rodada, 'rodada');
    if (!UUID.test(String(r.id || ''))) recusar('rodada.id', 'o id da rodada tem que ser um uuid');
    const rodada = { id: String(r.id).toLowerCase(), inicio: momentoDe(r.inicio, 'rodada.inicio'),
      maquina: r.maquina == null ? null : String(r.maquina).replace(/\s+/g, ' ').trim().slice(0, 60) || null,
      ponte: r.ponte == null ? null : String(r.ponte).replace(/\s+/g, ' ').trim().slice(0, 20) || null };
    const e = objeto(p.empresa, 'empresa');
    if (!Number.isInteger(e.codigo) || e.codigo < 1 || e.codigo > 1e8) recusar('empresa.codigo', 'o código da empresa no Domínio é um inteiro');
    if (!Array.isArray(p.notas)) recusar('notas', 'tem que ser uma lista');
    if (p.notas.length > LIMITES_SEDIF.notas) recusar('notas', 'notas demais num pacote (até ' + LIMITES_SEDIF.notas + ')');
    const itensNoPacote = p.notas.reduce((s, n) => s + (n && Array.isArray(n.itens) ? n.itens.length : 0), 0);
    if (itensNoPacote > LIMITES_SEDIF.itensNoPacote) recusar('notas', 'itens demais num pacote (até ' + LIMITES_SEDIF.itensNoPacote + ')');
    const desde = primeiroDia(hoje, MESES_DA_JANELA + 1);
    const notas = [], recusadas = [], vistas = new Set();
    p.notas.forEach((n, j) => {
      try {
        const x = nota(n, 'notas[' + j + ']', desde, hoje);
        if (vistas.has(x.chave)) recusar('notas[' + j + '].chave', 'nota repetida no pacote');
        vistas.add(x.chave);
        notas.push(x);
      } catch (err) {
        if (!(err instanceof Recusa)) throw err;
        const ch = n && typeof n === 'object' ? String(n.chave == null ? '' : n.chave).trim().toUpperCase() : '';
        recusadas.push({ codigo: e.codigo, chave: /^[0-9A-Z]{44}$/.test(ch) ? ch : null, campo: err.campo, erro: err.message });
      }
    });
    return { ok: true, pacote: { versao: 1, tipo: 'sedif', rodada, empresa: { codigo: e.codigo }, notas }, recusadas };
  } catch (err) {
    if (err instanceof Recusa) return { ok: false, campo: err.campo, erro: err.message };
    throw err;
  }
}

/** As notas que são de entrada da empresa do cadastro: o destinatário é ela, e quem emitiu não é ela. docEmpresa: o
 *  documento do cadastro (clientes.documento). → { notas, recusadas } */
export function notasDaEmpresa(pacote, docEmpresa) {
  const doc = docNorm(docEmpresa);
  const notas = [], recusadas = [];
  pacote.notas.forEach(n => {
    if (doc && n.doc.dest_doc === doc && n.doc.emit_doc !== doc) notas.push(n);
    else recusadas.push({ codigo: pacote.empresa.codigo, chave: n.chave, campo: 'notas.doc.dest_doc', erro: NAO_E_DA_EMPRESA });
  });
  return { notas, recusadas };
}
