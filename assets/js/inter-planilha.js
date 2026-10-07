// ============================================================
// MACEDO & REIS — planilha de boletos do Inter com Pix (07/10/2026)
// Preenche o modelo oficial do Inter ("Template Cobranças – Arquivo Excel", guardado em assets/inter/) com os boletos
// marcados na grade, pra importar em Cobrar ou Receber › Cobranças via arquivo › Importar arquivo › Arquivo Excel.
// Por que a planilha e não o .REM: só ela tem "Boleto com PIX?" — com Sim, o PDF que o Inter gera sai com o código de
// barras e o QR Code do Pix (manual "Emissão boletos de cobrança via Excel" V7, 06/07/2026, item 5.2). Em troca, a
// planilha não gera arquivo de retorno: os PDFs saem do site do Inter e o Pago é marcado na grade.
// Regras do modelo (aba "Instruções de preenchimento"): não mudar o tipo das células, não acrescentar colunas, não mudar
// nome nem ordem das colunas, não mexer nas abas; a linha 4 é um exemplo que a primeira cobrança sobrescreve.
// Cada boleto vai numa linha da aba "Cobrança Simples" (a partir da 4), no formato do exemplo do próprio Inter:
// CPF/CNPJ, número do endereço, valor e vencimento (DDMMAAAA) como número; CEP como texto "00000-000"; os textos como
// strings compartilhadas, como o Excel grava; o estilo de cada célula do modelo fica como está.
// Mesmas regras do escritório do .REM: sem multa, juros e desconto, pagável até o fim do mês do vencimento (1 a 60 dias),
// sem e-mail e sem telefone do pagador (o Inter não manda nada sozinho pro cliente).
// Puro: a página passa o JSZip (window.JSZip) e o modelo; tests/inter-planilha.test.mjs confere.
// ============================================================
import { isoValida, diasPagamento, VALOR_MINIMO } from './cnab-inter.js';

// a lista é daqui mesmo (e não importada): um cnab-inter.js antigo no cache do navegador não derruba a página
const UFS = new Set('AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'.split(' '));

export const MODELO = 'assets/inter/Template_Cobrancas_Arquivo_Excel.xlsx';
export const ONDE_IMPORTAR_PLANILHA = 'Cobrar ou Receber › Cobranças via arquivo › Importar arquivo › Arquivo Excel (.XLS)';
export const ONDE_PDFS = 'Cobrar ou Receber › Gestão de cobrança';
export const FOLHA = 'xl/worksheets/sheet2.xml';     // aba "Cobrança Simples"
export const INSTRUCOES = 'xl/worksheets/sheet1.xml'; // aba "Instruções de preenchimento"
export const STRINGS = 'xl/sharedStrings.xml';
export const LIGACOES = 'xl/worksheets/_rels/sheet2.xml.rels';
export const PRIMEIRA_LINHA = 4;                     // a linha do exemplo
export const ULTIMA_LINHA = 1006;                    // fim da tabela do modelo (A3:AC1006)
export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const LIMITES = { nome: 100, endereco: 54, numero: 32, complemento: 30, bairro: 60, cidade: 60, codigo: 15, descricao: 78 };
export const COLUNAS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
  'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG', 'AH', 'AI', 'AJ'];

// rótulos da linha 2 do modelo (V7): se o Inter mudar a planilha, o sistema para em vez de gerar coluna trocada
const ROTULOS = {
  A: '1. Nome do cliente (Obrigatório)', B: '2. CPF ou CNPJ (Obrigatório)', C: '3. Email', D: '4. Telefone',
  E: '5. Endereço (Obrigatório)', F: '6. Número (Obrigatório)', G: '7. Complemento', H: '8. Bairro (Obrigatório)',
  I: '9. Cidade (Obrigatório)', J: '10. Estado (Obrigatório)', K: '11. CEP (Obrigatório)',
  L: '12. Possui beneficiário final (Obrigatório)', M: '13. Nome do beneficiário final', N: '14. CPF ou CNPJ',
  O: '1. Boleto com PIX? (Obrigatório)', P: '2. Forma de pagamento (Obrigatório)', Q: '1. Valor (Obrigatório)',
  R: '2. Código da cobrança (Obrigatório)', S: '3. Descrição', T: '4. Data de Vencimento (Obrigatório)',
  U: '1. Pagamento após o vencimento (Obrigatório)', V: '2. Prazo limite para pagamento da cobrança (Obrigatório)',
  W: '3. Multa após vencimento (Obrigatório)', X: '4. Multa', Y: '5. Juros após vencimento (Obrigatório)', Z: '6. Juros',
  AA: '7. Desconto por antecipação (Obrigatório)', AB: '8. Desconto', AC: '9. Prazo limite para desconto',
  AD: '1. Emissão cobrança com Nota Fiscal? (Obrigatório)', AE: '2. Natureza da operação', AF: '3. Chave de acesso',
  AG: '4. Número da nota', AH: '5. Número de série', AI: '6. Emissão', AJ: '7. Parcela',
};

const limpo = s => String(s ?? '').replace(/\p{Cc}+/gu, ' ').replace(/\s+/g, ' ').trim();
const corta = (s, n) => limpo(s).slice(0, n).trim();
const soDigitos = s => String(s ?? '').replace(/\D/g, '');
const centavos = v => Math.round((Number(v) || 0) * 100);
const colNum = c => [...c].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const desesc = s => s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e) =>
  e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENT[e.toLowerCase()]);

// vencimento como o exemplo do modelo: número DDMMAAAA (a célula mostra 20-10-2026)
export const dataPlanilha = iso => Number(iso.slice(8, 10) + iso.slice(5, 7) + iso.slice(0, 4));
export const cepPlanilha = cep => { const d = soDigitos(cep); return `${d.slice(0, 5)}-${d.slice(5)}`; };
// nome sugerido no manual: EXCEL_ + campo livre + sequência de 10 dígitos
export const nomePlanilha = numero => `EXCEL_BOLETOS_${String(numero).padStart(10, '0')}.xlsx`;

// o que impede o boleto de ir na planilha (textos pra tela); lista vazia = pronto
export function problemasPlanilha(b, hoje) {
  const p = [];
  const doc = String(b.documento || '').replace(/[\s.\-\/]/g, '').toUpperCase();
  if (!limpo(b.nome)) p.push('sem nome no cadastro');
  if (/[A-Z]/.test(doc)) p.push('CNPJ com letras: a planilha do Inter só aceita número — emita este no site do Inter');
  else if (doc.length !== 11 && doc.length !== 14) p.push('CPF/CNPJ faltando ou incompleto no cadastro');
  // na coluna do modelo (número com máscara), um CNPJ que começa com 000 vira um número de CPF
  else if (doc.length === 14 && doc.startsWith('000')) p.push('CNPJ começando com 000: a planilha do Inter leria como CPF — emita este no site do Inter');
  if (!limpo(b.logradouro)) p.push('sem endereço no cadastro');
  if (!limpo(b.bairro)) p.push('sem bairro no cadastro');
  if (!limpo(b.cidade)) p.push('sem cidade no cadastro');
  if (soDigitos(b.cep).length !== 8) p.push('CEP faltando ou incompleto no cadastro');
  if (!UFS.has(String(b.uf || '').trim().toUpperCase())) p.push('UF faltando no cadastro');
  if (!isoValida(b.vencimento)) p.push('sem vencimento');
  else if (hoje && b.vencimento < hoje) p.push('vencimento já passou');
  if (!(centavos(b.valor) >= centavos(VALOR_MINIMO))) p.push('valor abaixo de R$ 2,50 (mínimo do Inter)');
  if (limpo(b.mensagem).length > LIMITES.descricao) p.push(`observação passa de ${LIMITES.descricao} letras (limite da planilha do Inter)`);
  return p;
}

// uma cobrança → { coluna: valor } (número, texto ou nada); colunas de fora ficam vazias
export function linhaPlanilha(b) {
  const num = limpo(b.numero);
  return {
    A: corta(b.nome, LIMITES.nome),
    B: Number(soDigitos(b.documento)),
    E: corta(b.logradouro, LIMITES.endereco),
    F: /^\d{1,9}$/.test(num) ? Number(num) : corta(num || 'S/N', LIMITES.numero),
    G: corta(b.complemento, LIMITES.complemento) || null,
    H: corta(b.bairro, LIMITES.bairro),
    I: corta(b.cidade, LIMITES.cidade),
    J: String(b.uf || '').trim().toUpperCase(),
    K: cepPlanilha(b.cep),
    L: 'Não',
    O: 'Sim',
    P: 'Boleto',
    Q: centavos(b.valor) / 100,
    R: limpo(b.codigo),
    S: corta(b.mensagem, LIMITES.descricao) || null,
    T: dataPlanilha(b.vencimento),
    U: 'Sim',
    V: diasPagamento(b.vencimento),
    W: 'Não aplicar multa', X: 0,
    Y: 'Não aplicar juros', Z: 0,
    AA: 'Não aplicar desconto', AB: 0, AC: 0,
    AD: 'Não',
  };
}

// strings compartilhadas: texto simples de cada <si> (null = texto com formatação, não reaproveita)
export function lerStrings(xml) {
  const lista = [];
  const re = /<si\/>|<si>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = re.exec(xml))) {
    if (m[1] == null) { lista.push(''); continue; }
    const t = /^<t(?: xml:space="preserve")?>([\s\S]*)<\/t>$/.exec(m[1]);
    lista.push(t ? desesc(t[1]) : null);
  }
  return lista;
}
export const contarRefs = xml => (String(xml).match(/<c [^>]*t="s"/g) || []).length;

// acha <row r="N" …>…</row> (ou <row …/>) a partir de "de"
function acharLinha(xml, r, de = 0) {
  const ini = xml.indexOf(`<row r="${r}"`, de);
  if (ini < 0) return null;
  const fimTag = xml.indexOf('>', ini);
  if (xml[fimTag - 1] === '/') return { ini, fim: fimTag + 1, abre: xml.slice(ini, fimTag - 1) + '>', corpo: '' };
  const fim = xml.indexOf('</row>', fimTag) + 6;
  return { ini, fim, abre: xml.slice(ini, fimTag + 1), corpo: xml.slice(fimTag + 1, fim - 6) };
}
// células de uma linha: coluna → { s, xml, v, t }
function celulas(corpo) {
  const mapa = new Map();
  const re = /<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  let m;
  while ((m = re.exec(corpo))) {
    const s = (/\bs="(\d+)"/.exec(m[2]) || [])[1] || null;
    const t = (/\bt="(\w+)"/.exec(m[2]) || [])[1] || null;
    const v = (/<v>([\s\S]*?)<\/v>/.exec(m[3] || '') || [])[1];
    mapa.set(m[1], { s, t, v: v == null ? null : v, xml: m[0] });
  }
  return mapa;
}

// confere a linha 2 do modelo: é a aba "Cobrança Simples" com as colunas na ordem do manual
export function conferirModelo(folha, strings) {
  const lista = lerStrings(strings);
  const l2 = acharLinha(folha, 2);
  if (!l2) throw new Error('O modelo da planilha do Inter não tem a linha dos títulos.');
  const cel = celulas(l2.corpo);
  const norm = s => limpo(s).replace(/\s+/g, ' ');
  for (const [col, rotulo] of Object.entries(ROTULOS)) {
    const c = cel.get(col);
    const texto = c && c.t === 's' && c.v != null ? lista[Number(c.v)] : null;
    if (norm(texto) !== norm(rotulo)) {
      throw new Error(`O modelo da planilha do Inter mudou (coluna ${col}: esperava "${rotulo}"). Baixe o modelo novo no Inter e mande pro sistema.`);
    }
  }
}

// escreve as linhas (a partir da 4) na aba e devolve { folha, strings } novas
export function preencherFolha(folha, strings, linhas, refsOutras = 0) {
  if (!linhas.length) throw new Error('Nenhum boleto marcado.');
  if (PRIMEIRA_LINHA + linhas.length - 1 > ULTIMA_LINHA) {
    throw new Error(`A planilha do Inter cabe até ${ULTIMA_LINHA - PRIMEIRA_LINHA + 1} boletos.`);
  }
  const lista = lerStrings(strings);
  const idx = new Map();
  lista.forEach((t, i) => { if (t != null && !idx.has(t)) idx.set(t, i); });
  const novas = [];
  const sid = t => { if (!idx.has(t)) { idx.set(t, lista.length + novas.length); novas.push(t); } return idx.get(t); };
  // estilo de reserva pra coluna sem célula na linha: o da linha logo abaixo do exemplo
  const reserva = celulas((acharLinha(folha, PRIMEIRA_LINHA + 1) || { corpo: '' }).corpo);
  let saida = '', pos = 0;
  linhas.forEach((linha, i) => {
    const r = PRIMEIRA_LINHA + i;
    const achou = acharLinha(folha, r, pos);
    if (!achou) throw new Error(`O modelo da planilha do Inter não tem a linha ${r}.`);
    const cel = celulas(achou.corpo);
    for (const col of COLUNAS) {
      const v = linha[col] ?? null;
      const atual = cel.get(col);
      const s = atual ? atual.s : (reserva.get(col) || {}).s || null;
      const sa = s ? ` s="${s}"` : '';
      if (v === null || v === '') {
        if (atual) cel.set(col, { s, xml: `<c r="${col}${r}"${sa}/>` });
      } else if (typeof v === 'number') {
        if (!Number.isFinite(v)) throw new Error(`Valor inválido na coluna ${col}.`);
        cel.set(col, { s, xml: `<c r="${col}${r}"${sa}><v>${v}</v></c>` });
      } else {
        cel.set(col, { s, xml: `<c r="${col}${r}"${sa} t="s"><v>${sid(String(v))}</v></c>` });
      }
    }
    const corpo = [...cel.entries()].sort((a, b) => colNum(a[0]) - colNum(b[0])).map(e => e[1].xml).join('');
    saida += folha.slice(pos, achou.ini) + achou.abre + corpo + '</row>';
    pos = achou.fim;
  });
  saida += folha.slice(pos);
  // o e-mail de exemplo do Inter (cliente@inter.co) vem como hyperlink em C4 e C5: sai junto com o exemplo, pra nenhum
  // leitor de planilha tomar o link por e-mail do pagador
  saida = saida.replace(/<hyperlinks>[\s\S]*?<\/hyperlinks>/, '');
  // abre a planilha no começo da aba (o modelo vem rolado até a coluna AC)
  saida = saida.replace(/(<sheetView [^>]*?)topLeftCell="[A-Z]+\d+"/, '$1topLeftCell="A1"')
    .replace(/<selection activeCell="[A-Z]+\d+" sqref="[A-Z]+\d+"\/>/, `<selection activeCell="A${PRIMEIRA_LINHA}" sqref="A${PRIMEIRA_LINHA}"/>`);
  const total = lista.length + novas.length;
  const refs = contarRefs(saida) + refsOutras;
  const abre = /<sst\b[^>]*>/.exec(strings);
  if (!abre) throw new Error('O modelo da planilha do Inter está sem a lista de textos.');
  const novaAbre = abre[0].replace(/ count="\d+"/, ` count="${refs}"`).replace(/ uniqueCount="\d+"/, ` uniqueCount="${total}"`);
  const extra = novas.map(t => `<si><t xml:space="preserve">${esc(t)}</t></si>`).join('');
  const sst = strings.replace(abre[0], novaAbre).replace('</sst>', extra + '</sst>');
  return { folha: saida, strings: sst, novas: novas.length };
}

// as ligações da aba sem os hyperlinks do exemplo (a tabela fica)
export const semHyperlinks = rels => rels.replace(/<Relationship [^>]*Type="[^"]*\/hyperlink"[^>]*\/>/g, '');

// boletos: [{ nome, documento, logradouro, numero, complemento, bairro, cidade, uf, cep, vencimento, valor, mensagem,
// codigo }] → { nome, dados (Uint8Array do .xlsx), qtd, total }. Erro se algo não fecha — nada de planilha pela metade.
export async function montarPlanilha(JSZip, modelo, { numero, boletos }) {
  if (!(Number.isInteger(numero) && numero >= 1)) throw new Error('Número da planilha inválido.');
  if (!boletos || !boletos.length) throw new Error('Nenhum boleto marcado.');
  const codigos = new Set();
  boletos.forEach((b, i) => {
    const quem = limpo(b.nome) || `boleto ${i + 1}`;
    const p = problemasPlanilha(b);
    if (p.length) throw new Error(`${quem}: ${p.join('; ')}`);
    const cod = limpo(b.codigo);
    if (!cod || cod.length > LIMITES.codigo || codigos.has(cod)) throw new Error(`${quem}: código da cobrança vazio, longo demais ou repetido`);
    codigos.add(cod);
  });
  // createFolders: false (ao abrir e ao gravar) — sem isso o JSZip acrescenta entradas de pasta ("xl/",
  // "xl/worksheets/"…) que o modelo do Inter não tem
  const zip = await JSZip.loadAsync(modelo, { createFolders: false });
  const ler = n => { const f = zip.file(n); if (!f) throw new Error(`O modelo da planilha do Inter está incompleto (${n}).`); return f.async('string'); };
  const [folha, strings, instrucoes, ligacoes] = await Promise.all([ler(FOLHA), ler(STRINGS), ler(INSTRUCOES), ler(LIGACOES)]);
  conferirModelo(folha, strings);
  const r = preencherFolha(folha, strings, boletos.map(linhaPlanilha), contarRefs(instrucoes));
  zip.file(FOLHA, r.folha, { createFolders: false });
  zip.file(STRINGS, r.strings, { createFolders: false });
  zip.file(LIGACOES, semHyperlinks(ligacoes), { createFolders: false });
  const dados = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', mimeType: XLSX_MIME });
  const total = boletos.reduce((s, b) => s + centavos(b.valor), 0) / 100;
  return { nome: nomePlanilha(numero), dados, qtd: boletos.length, total };
}
