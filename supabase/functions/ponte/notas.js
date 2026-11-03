// ============================================================
// MACEDO & REIS — Edge Function ponte: as notas de entrada das empresas autorizadas (03/11/2026)
// A exceção ao "só totais" da ponte do Domínio: as NF-e de compra, nota a nota e com os itens, só das empresas cujo
// cliente autorizou mandar as notas a um projeto de fora (compartilhamentos, que só os sócios veem). A ponte pede a
// lista (`pedir: 'autorizadas'`), lê da Domínio só essas e manda o pacote de cada empresa; o pacote é conferido campo a
// campo e montado de novo só com o que o contrato prevê, e as notas seguem pro destino de cada autorização (o endereço e
// a chave em configuracoes_escritorio.compartilhamentos_destinos, que só o servidor lê). Nada das notas é gravado no
// sistema: só o registro de cada envio (compartilhamentos_envios). O contrato: docs/FILA-CODE-2026-11-03-NOTAS-PONTE.md.
// Recusa o pacote inteiro (422) só o que é do pacote (versão, tipo, rodada, empresa, a lista); a nota fora do contrato
// fica de fora sozinha e volta em `recusadas` ({ chave, campo, erro }), pra ponte anotar e não mandar de novo.
// O XML da nota não viaja (03/11/2026, o contrato do destino: os itens já saem dele) — o que vier em `xml` é jogado
// fora; só vão os itens com CFOP de compra (`CFOPS_DE_COMPRA`), e a nota que fica sem nenhum é recusada.
// Sem import: testes no node em tests/ponte-funcao.test.mjs.
// ============================================================

export const LIMITES_NOTAS = { notas: 200, itens: 990, recusadas: 50, prazo: 60000 };
// os CFOP de compra (com 1, 2 e 3 na frente): fora devolução, bonificação, remessa, transferência, comodato, consignação,
// simples faturamento e industrialização por terceiros — o que a comparação de preços não usa
export const CFOPS_DE_COMPRA = new Set(['101', '102', '111', '113', '116', '117', '118', '120', '121', '122', '126', '128', '401',
  '403', '406', '407', '551', '556'].flatMap(f => ['1' + f, '2' + f, '3' + f]));
export const SEM_DESTINO = 'O destino das notas ainda não foi configurado no sistema.';
export const SEM_AUTORIZACAO = 'Esta empresa não tem autorização ativa pra mandar as notas.';
export const DESTINO_FORA = 'O destino das notas não recebeu agora: elas vão na próxima rodada.';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UFS = new Set(['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO', 'EX']);
const TOTAIS = ['produtos', 'desconto', 'frete', 'ipi', 'icms_st', 'total'];

class Recusa extends Error {}
const recusar = (campo, porque) => { const e = new Recusa(porque); e.campo = campo; throw e; };

const texto = (v, max) => {
  if (v == null) return null;
  const s = String(v).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return s ? s.slice(0, max) : null;
};
// CNPJ (com letras, desde o CNPJ alfanumérico) ou CPF: só letras e dígitos, em maiúscula
const documento = v => {
  const d = String(v == null ? '' : v).replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  return d.length === 14 || d.length === 11 ? d : null;
};
const objeto = (v, campo) => {
  if (v == null || typeof v !== 'object' || Array.isArray(v)) recusar(campo, 'tem que ser um objeto');
  return v;
};
const dataDe = (v, campo) => {
  const s = String(v == null ? '' : v);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) recusar(campo, 'data fora do formato AAAA-MM-DD');
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3] || +m[1] < 2000) recusar(campo, 'data que não existe');
  return s;
};
const momentoDe = (v, campo) => {
  const s = String(v == null ? '' : v);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(s) || Number.isNaN(Date.parse(s))) recusar(campo, 'data e hora fora do formato (com o fuso)');
  return s;
};
const numeroDe = v => (typeof v === 'number' ? v : typeof v === 'string' && /^\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : NaN);
// dinheiro: 0 ou mais, com centavos; null fica null (a Domínio não disse)
const dinheiro = (v, campo, obrigatorio = false) => {
  if (v == null || v === '') { if (obrigatorio) recusar(campo, 'falta o valor'); return null; }
  const n = numeroDe(v);
  if (typeof v === 'boolean' || !Number.isFinite(n) || n < 0 || n > 1e13) recusar(campo, 'valor que não é um número de dinheiro');
  return Math.round(n * 100) / 100;
};
// a quantidade e o valor unitário: como a nota traz (até 4 e até 10 casas), sem arredondar
const medida = (v, campo) => {
  const n = numeroDe(v);
  if (typeof v === 'boolean' || !Number.isFinite(n) || n < 0 || n > 1e11) recusar(campo, 'número fora do contrato');
  return n;
};

/** O dígito verificador da chave de acesso (módulo 11, pesos de 2 a 9 da direita pra esquerda). Cada caractere vale o
 *  código dele menos 48 — o número, nos dígitos, e a conta do CNPJ alfanumérico, nas letras. */
export function dvDaChave(base43) {
  let soma = 0, peso = 2;
  for (let i = base43.length - 1; i >= 0; i--) {
    soma += (base43.charCodeAt(i) - 48) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const r = soma % 11;
  return r < 2 ? 0 : 11 - r;
}
/** 44 caracteres: a UF e o ano e mês (6 dígitos), o CNPJ do emitente (12 letras ou dígitos e os 2 dígitos dele), o
 *  modelo, a série, o número, o tipo de emissão, o código e o dígito verificador. */
export function chaveValida(ch) {
  return typeof ch === 'string' && /^\d{6}[0-9A-Z]{12}\d{26}$/.test(ch) && dvDaChave(ch.slice(0, 43)) === Number(ch[43]);
}
function cpfValido(d) {
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  const dv = n => { let s = 0; for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}
/** Na chave da nota de emitente pessoa física, o lugar do CNPJ leva o CPF com zeros na frente. */
export const pareceCpf = cnpj => typeof cnpj === 'string' && cnpj.startsWith('000') && cpfValido(cnpj.slice(3));

const gtin = v => { const s = String(v == null ? '' : v).trim(); return /^(\d{8}|\d{12,14})$/.test(s) ? s : null; };   // "SEM GTIN" e o resto: null
const medidaOuNulo = (v, campo) => (v == null || v === '' ? null : medida(v, campo));

function item(it, j, onde) {
  const w = onde + '.itens[' + j + ']';
  objeto(it, w);
  if (!Number.isInteger(it.n) || it.n < 1 || it.n > LIMITES_NOTAS.itens) recusar(w + '.n', 'o número do item vai de 1 a ' + LIMITES_NOTAS.itens);
  const cfop = String(it.cfop == null ? '' : it.cfop).trim();
  // o CFOP é o da entrada, como a nota foi lançada na Domínio (1, 2 ou 3 na frente) — o do fornecedor está no XML
  if (!/^[123]\d{3}$/.test(cfop)) recusar(w + '.cfop', 'o CFOP é o da entrada (4 dígitos, começando por 1, 2 ou 3)');
  const descricao = texto(it.descricao, 500);
  if (!descricao) recusar(w + '.descricao', 'item sem descrição');
  const quantidade = medida(it.quantidade, w + '.quantidade');
  if (!(quantidade > 0)) recusar(w + '.quantidade', 'a quantidade tem que ser maior que zero');
  const ncm = String(it.ncm == null ? '' : it.ncm).replace(/\D/g, '');
  return {
    n: it.n,
    codigo: texto(it.codigo, 60),
    ean: gtin(it.ean),
    descricao,
    ncm: /^\d{8}$/.test(ncm) ? ncm : null,
    cfop,
    unidade: texto(it.unidade, 6),
    quantidade,
    valor_unitario: medida(it.valor_unitario, w + '.valor_unitario'),
    valor_total: dinheiro(it.valor_total, w + '.valor_total', true),
    desconto: dinheiro(it.desconto, w + '.desconto'),
    ipi: dinheiro(it.ipi, w + '.ipi'),
    icms_st: dinheiro(it.icms_st, w + '.icms_st'),
    // a unidade tributável do XML (cEANTrib, uTrib, qTrib, vUnTrib): converte a embalagem (1 CX = 100 UN); sem XML, nulos
    ean_trib: gtin(it.ean_trib),
    unidade_trib: texto(it.unidade_trib, 6),
    quantidade_trib: medidaOuNulo(it.quantidade_trib, w + '.quantidade_trib'),
    valor_unitario_trib: medidaOuNulo(it.valor_unitario_trib, w + '.valor_unitario_trib')
  };
}

function nota(n, i, doc) {
  const onde = 'notas[' + i + ']';
  objeto(n, onde);
  const chave = String(n.chave == null ? '' : n.chave).trim().toUpperCase();
  if (!chaveValida(chave)) recusar(onde + '.chave', 'chave de acesso inválida (44 caracteres, com o dígito verificador)');
  if (chave.slice(20, 22) !== '55' || String(n.modelo) !== '55') recusar(onde + '.modelo', 'só NF-e, modelo 55');
  const numero = String(n.numero == null ? '' : n.numero).trim();
  if (!/^\d{1,9}$/.test(numero) || Number(numero) !== Number(chave.slice(25, 34))) recusar(onde + '.numero', 'o número não é o da chave');
  const serie = String(n.serie == null ? '' : n.serie).trim();
  if (!/^\d{1,3}$/.test(serie) || Number(serie) !== Number(chave.slice(22, 25))) recusar(onde + '.serie', 'a série não é a da chave');
  const emissao = dataDe(n.emissao, onde + '.emissao');
  const entrada = dataDe(n.entrada, onde + '.entrada');
  const em = objeto(n.emitente, onde + '.emitente');
  const cnpj = String(em.cnpj == null ? '' : em.cnpj).replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  if (cnpj !== chave.slice(6, 20)) recusar(onde + '.emitente.cnpj', 'o CNPJ do emitente não é o da chave');
  if (pareceCpf(cnpj)) recusar(onde + '.emitente.cnpj', 'emitente pessoa física (CPF): a nota não vai');
  const uf = String(em.uf == null ? '' : em.uf).trim().toUpperCase();
  if (!UFS.has(uf)) recusar(onde + '.emitente.uf', 'UF desconhecida');
  const dest = objeto(n.destinatario, onde + '.destinatario');
  if (documento(dest.cnpj) !== doc) recusar(onde + '.destinatario.cnpj', 'a nota não é da empresa do pacote');
  const t = objeto(n.totais, onde + '.totais');
  const totais = {};
  for (const k of TOTAIS) totais[k] = dinheiro(t[k], onde + '.totais.' + k, k === 'total');
  if (n.origem !== 'xml' && n.origem !== 'dominio') recusar(onde + '.origem', "tem que ser 'xml' ou 'dominio'");
  if (!Array.isArray(n.itens) || !n.itens.length) recusar(onde + '.itens', 'a nota vai com os itens');
  if (n.itens.length > LIMITES_NOTAS.itens) recusar(onde + '.itens', 'itens demais (até ' + LIMITES_NOTAS.itens + ')');
  const todos = n.itens.map((it, j) => item(it, j, onde));
  if (new Set(todos.map(x => x.n)).size !== todos.length) recusar(onde + '.itens', 'número de item repetido');
  const itens = todos.filter(x => CFOPS_DE_COMPRA.has(x.cfop));
  if (!itens.length) recusar(onde + '.itens', 'nenhum item com CFOP de compra');
  return {
    nota: {
      chave, modelo: '55', numero: String(Number(numero)), serie: String(Number(serie)), emissao, entrada,
      emitente: { cnpj, nome: texto(em.nome, 200), uf },
      destinatario: { cnpj: doc },
      totais, origem: n.origem, itens
    },
    itensFora: todos.length - itens.length
  };
}

/** O pacote de notas de uma empresa, conferido: { ok, pacote, recusadas } ou { ok: false, campo, erro }. */
export function validarPacoteNotas(p) {
  try {
    objeto(p, 'pacote');
    if (p.versao !== 1) recusar('versao', 'versão do pacote desconhecida (esta função lê a 1)');
    if (p.tipo !== 'notas') recusar('tipo', 'não é um pacote de notas');
    const r = objeto(p.rodada, 'rodada');
    if (!UUID.test(String(r.id || ''))) recusar('rodada.id', 'o id da rodada tem que ser um uuid');
    const rodada = { id: String(r.id).toLowerCase(), inicio: momentoDe(r.inicio, 'rodada.inicio'), maquina: texto(r.maquina, 60), ponte: texto(r.ponte, 20) };
    const e = objeto(p.empresa, 'empresa');
    if (!Number.isInteger(e.codigo) || e.codigo < 1 || e.codigo > 1e8) recusar('empresa.codigo', 'o código da empresa no Domínio é um inteiro');
    const doc = documento(e.documento);
    if (!doc) recusar('empresa.documento', 'documento da empresa inválido');
    if (!Array.isArray(p.notas)) recusar('notas', 'tem que ser uma lista');
    if (!p.notas.length) recusar('notas', 'o pacote não tem nota');
    if (p.notas.length > LIMITES_NOTAS.notas) recusar('notas', 'notas demais num pacote (até ' + LIMITES_NOTAS.notas + ')');
    const notas = [], recusadas = [], vistas = new Set();
    let itensFora = 0;
    p.notas.forEach((n, i) => {
      try {
        const { nota: x, itensFora: fora } = nota(n, i, doc);
        if (vistas.has(x.chave)) { recusadas.push({ chave: x.chave, campo: 'notas[' + i + '].chave', erro: 'nota repetida no pacote' }); return; }
        vistas.add(x.chave);
        notas.push(x);
        itensFora += fora;
      } catch (err) {
        if (!(err instanceof Recusa)) throw err;
        const ch = n && typeof n === 'object' ? String(n.chave == null ? '' : n.chave).trim().toUpperCase() : '';
        recusadas.push({ chave: /^[0-9A-Z]{44}$/.test(ch) ? ch : null, campo: err.campo, erro: err.message });
      }
    });
    return { ok: true, pacote: { versao: 1, tipo: 'notas', rodada, empresa: { codigo: e.codigo, documento: doc }, notas }, recusadas, itensFora };
  } catch (err) {
    if (err instanceof Recusa) return { ok: false, campo: err.campo, erro: err.message };
    throw err;
  }
}

/** A autorização vale hoje: das notas de entrada, sem revogação ou com a revogação depois de hoje. */
export const autorizacaoAtiva = (c, hoje) => !!c && c.escopo === 'nfe_entrada' && !!c.notas_desde && (!c.revogado_em || String(c.revogado_em) > hoje);

/** As empresas que a ponte lê: as de autorização ativa, pelo código do Domínio (os dois, quando a empresa tem dois),
 *  com o documento do cadastro, a nota mais antiga que pode ir (a menor data entre os destinos) e `pronta`: o destino
 *  de cada autorização dela já está configurado (sem isso, a rodada não lê a empresa — o --sem-enviar lê).
 *  compart: [{ cliente_id, destino, escopo, notas_desde, revogado_em }] · empresas: [{ codigo, cliente_id }] ·
 *  clientes: [{ id, documento }] · hoje: 'AAAA-MM-DD' · destinos: o de destinosDaConfig */
export function empresasAutorizadas(compart, empresas, clientes, hoje, destinos = {}) {
  const desde = new Map(), pronta = new Map();
  (compart || []).filter(c => autorizacaoAtiva(c, hoje)).forEach(c => {
    const d = String(c.notas_desde).slice(0, 10);
    if (!desde.has(c.cliente_id) || d < desde.get(c.cliente_id)) desde.set(c.cliente_id, d);
    pronta.set(c.cliente_id, (pronta.has(c.cliente_id) ? pronta.get(c.cliente_id) : true) && !!(destinos && destinos[c.destino]));
  });
  const docs = new Map((clientes || []).map(c => [c.id, documento(c.documento)]));
  const out = [];
  (empresas || []).forEach(e => {
    if (!e || !desde.has(e.cliente_id) || !Number.isInteger(e.codigo)) return;
    const doc = docs.get(e.cliente_id);
    if (!doc) return;
    out.push({ codigo: e.codigo, documento: doc, desde: desde.get(e.cliente_id), pronta: pronta.get(e.cliente_id) });
  });
  return out.sort((a, b) => a.codigo - b.codigo);
}

/** O que vai pro destino de uma autorização: as notas de entrada a partir da data dela, no contrato combinado com ele. */
export function corpoDoDestino(pacote, desde, envio) {
  return { versao: 1, envio, notas: pacote.notas.filter(n => n.entrada >= desde) };
}

/** A configuração dos destinos (configuracoes_escritorio.compartilhamentos_destinos): { <destino>: { url, chave } },
 *  só com endereço https e chave de 32 caracteres ou mais. */
export function destinosDaConfig(valor) {
  let obj = null;
  try { obj = typeof valor === 'string' ? JSON.parse(valor) : valor; } catch { obj = null; }
  const out = {};
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return out;
  for (const [nome, d] of Object.entries(obj)) {
    if (!d || typeof d !== 'object') continue;
    let url = null;
    try { const u = new URL(String(d.url || '')); if (u.protocol === 'https:' && !u.username && !u.password) url = u.toString(); } catch { url = null; }
    const chave = typeof d.chave === 'string' && d.chave.length >= 32 && !/\s/.test(d.chave) ? d.chave : null;
    if (url && chave) out[nome] = { url, chave };
  }
  return out;
}

/** O que o destino respondeu: { gravadas, repetidas, recusadas: [{ chave, motivo }], resposta: { atualizadas,
 *  itens_ignorados, apagadas } } — só números (o que não for, nulo; a `resposta` só com o que veio). */
export function respostaDoDestino(obj) {
  const inteiro = v => (Number.isInteger(v) && v >= 0 && v < 1e7 ? v : null);
  const o = obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
  const recusadas = (Array.isArray(o.recusadas) ? o.recusadas : []).slice(0, LIMITES_NOTAS.recusadas).map(x => ({
    chave: x && /^[0-9A-Z]{44}$/.test(String(x.chave || '')) ? String(x.chave) : null,
    motivo: texto(x && x.motivo, 200)
  }));
  const resposta = {};
  for (const k of ['atualizadas', 'itens_ignorados', 'apagadas']) if (inteiro(o[k]) != null) resposta[k] = o[k];
  return { gravadas: inteiro(o.gravadas), repetidas: inteiro(o.repetidas), recusadas, resposta };
}
