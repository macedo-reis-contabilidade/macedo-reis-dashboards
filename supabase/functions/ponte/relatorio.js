// ============================================================
// MACEDO & REIS — Edge Function ponte: o relatório de situação fiscal no Drive (09/11/2026, pedido da Thalia com o ok
// do Samuel: "se o sistema salvar o PDF no drive e fornecer um link pro arquivo, não precisa ter um botão")
// A ponte da Receita (no PC do escritório) manda o PDF do relatório de situação fiscal (o SITFIS do Integra Contador)
// de cada empresa, um por pedido. A função o salva na pasta da empresa no Drive — a que o cadastro aponta —, em
// FISCAL › SITUAÇÃO FISCAL, e guarda o link em receita_empresas (situacao_fiscal_pdf_*), que a ficha da empresa mostra.
// Do PDF, o banco fica só com o link, o id do arquivo e o dia.
// Aqui, as regras puras: o pedido conferido, o nome do arquivo e, entre as pastas que existem, a certa.
// Testes no node em tests/ponte-funcao.test.mjs.
// ============================================================
import { documento } from './receita.js';

export const LIMITES_RELATORIO = { pdf: 10 * 1024 * 1024, dias: 400 };
export const TIPOS_RELATORIO = ['situacao_fiscal'];
export const PASTA_FISCAL = 'FISCAL';
export const PASTA_SITUACAO = 'SITUAÇÃO FISCAL';
export const SEM_PASTA = 'A empresa não tem a pasta do Drive no cadastro (ou a pasta não abre): o PDF fica no PC e vai de novo na próxima rodada.';
export const SEM_CADASTRO = 'A empresa não está no cadastro do sistema.';
export const SEM_DRIVE = 'O Drive ainda não foi configurado na função.';
export const DRIVE_FORA = 'O Drive não respondeu agora. A ponte manda de novo na próxima rodada.';

// o id de arquivo ou pasta do Drive (vai dentro da consulta: nada além disso passa)
export const ID_DRIVE = /^[A-Za-z0-9_-]{10,100}$/;
export const linkDoArquivo = id => 'https://drive.google.com/file/d/' + id + '/view';

/** O nome do arquivo no Drive: o dia primeiro na ordem do nome (AAAA-MM-DD), pra a pasta ficar na ordem dos meses. */
export const nomeDoRelatorio = dia => 'Relatório de situação fiscal ' + dia + '.pdf';

/** O nome de uma pasta pra comparar: sem acento, em maiúscula, só letras e dígitos, um espaço entre as palavras. */
export const nomeNormal = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
  .replace(/[^A-Z0-9]+/g, ' ').trim();

// a pasta certa entre as filhas ([{ id, name }]): a de nome exato primeiro, depois as variações aceitas, na ordem do nome
function escolher(filhas, exato, aceita) {
  const lista = (Array.isArray(filhas) ? filhas : []).filter(f => f && ID_DRIVE.test(String(f.id || '')));
  const ordem = (a, b) => String(a.name).localeCompare(String(b.name));
  const exatas = lista.filter(f => nomeNormal(f.name) === exato).sort(ordem);
  if (exatas.length) return exatas[0];
  const outras = lista.filter(f => aceita(nomeNormal(f.name))).sort(ordem);
  return outras[0] || null;
}

/** A pasta do fiscal dentro da pasta da empresa: FISCAL (a das subpastas padrão do "Registrar processo"), ou a
 *  numerada ("01 - FISCAL"), ou a SETOR FISCAL. Nenhuma: null (quem chama cria a FISCAL). */
export const pastaFiscal = filhas => escolher(filhas, 'FISCAL', n => /^(\d+ )?(SETOR )?FISCAL$/.test(n));

/** A pasta dos relatórios dentro da do fiscal: SITUAÇÃO FISCAL (sem acento e sem maiúscula também vale). */
export const pastaSituacao = filhas => escolher(filhas, 'SITUACAO FISCAL', n => /^(\d+ )?(RELATORIOS? DE )?SITUACAO FISCAL$/.test(n));

/** A pasta da empresa que o cadastro aponta: o drive_folder_id, senão o id que está no drive_folder_url. */
export function idDaPasta(c) {
  const id = String((c && c.drive_folder_id) || '').trim();
  if (ID_DRIVE.test(id)) return id;
  const m = /\/folders\/([A-Za-z0-9_-]{10,100})/.exec(String((c && c.drive_folder_url) || ''));
  return m ? m[1] : null;
}

const DIA = /^(\d{4})-(\d{2})-(\d{2})$/;
const diaValido = s => {
  const m = DIA.exec(String(s || ''));
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
};
const diasEntre = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);

/** O pedido do relatório conferido: { ok: true, relatorio: { tipo, documento, emitido_em, ambiente, bytes, teste } }
 *  ou { ok: false, campo, erro }. hoje: 'AAAA-MM-DD' (Brasília). O PDF tem de ser um PDF (começa com %PDF-), até
 *  10 MB; o dia, de verdade, não depois de hoje nem de mais de 400 dias atrás; o documento, um CNPJ. */
export function validarRelatorio(p, hoje) {
  const recusa = (campo, erro) => ({ ok: false, campo, erro });
  if (!p || typeof p !== 'object' || Array.isArray(p)) return recusa('pedido', 'tem que ser um objeto');
  if (p.versao !== 1) return recusa('versao', 'versão do pedido desconhecida (esta função lê a 1)');
  if (p.tipo !== 'receita') return recusa('tipo', 'não é um pedido da Receita');
  if (!TIPOS_RELATORIO.includes(p.relatorio)) return recusa('relatorio', 'relatório desconhecido (esta função lê o situacao_fiscal)');
  const doc = documento(p.documento);
  if (!doc || doc.length !== 14) return recusa('documento', 'o relatório é de um CNPJ');
  const dia = String(p.emitido_em || '');
  if (!diaValido(dia)) return recusa('emitido_em', 'data fora do formato AAAA-MM-DD, ou que não existe');
  const atras = diasEntre(dia, hoje);
  if (atras < 0) return recusa('emitido_em', 'o relatório não pode ser de depois de hoje');
  if (atras > LIMITES_RELATORIO.dias) return recusa('emitido_em', 'relatório de mais de ' + LIMITES_RELATORIO.dias + ' dias');
  const ambiente = String(p.ambiente || '').trim().slice(0, 20);
  if (!ambiente) return recusa('ambiente', 'falta o ambiente');
  if (typeof p.pdf !== 'string') return recusa('pdf', 'o PDF vai em base64');
  const b64 = p.pdf.replace(/\s+/g, '');
  if (!b64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64) || b64.length % 4 === 1) return recusa('pdf', 'o PDF não está em base64');
  if (Math.floor(b64.length / 4) * 3 > LIMITES_RELATORIO.pdf + 3) return recusa('pdf', 'PDF grande demais (até 10 MB)');
  let bin;
  try { bin = atob(b64.length % 4 ? b64 + '='.repeat(4 - (b64.length % 4)) : b64); } catch { return recusa('pdf', 'o PDF não está em base64'); }
  if (bin.length > LIMITES_RELATORIO.pdf) return recusa('pdf', 'PDF grande demais (até 10 MB)');
  if (!bin.startsWith('%PDF-')) return recusa('pdf', 'não é um PDF');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { ok: true, relatorio: { tipo: p.relatorio, documento: doc, emitido_em: dia, ambiente, bytes, teste: p.teste === true } };
}
