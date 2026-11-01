// ============================================================
// MACEDO & REIS — Arquivos dos relatórios da Domínio (PDF e planilha)
// Do arquivo às linhas que o leitor de relatórios (dominio-relatorios.js) entende: as páginas de texto do PDF
// (pdf.js, carregado pela tela em window.pdfjsLib) e as abas da planilha (o .xls da Domínio pelo leitor próprio,
// xls-biff.js; .xlsx e .csv pelo SheetJS, em window.XLSX). Uma regra só pra Reforma Tributária e o Comparativo
// tributário (01/11/2026: a leitura morava dentro da fiscal-reforma.html).
// ============================================================

import { lerXls } from './xls-biff.js';

export const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// as linhas de cada página: os pedaços de texto na mesma altura (2 pt de tolerância), da esquerda pra direita, com
// dois espaços onde há buraco entre eles — é assim que os leitores separam as colunas
export async function paginasDoPdf(file) {
  const pdfjsLib = globalThis.pdfjsLib;
  if (!pdfjsLib) throw new Error('o leitor de PDF não carregou — verifique a conexão e recarregue a página (Ctrl+F5)');
  pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const paginas = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const tc = await (await doc.getPage(p)).getTextContent();
    const linhas = new Map();
    for (const it of tc.items) {
      if (!it.str || !it.str.trim()) continue;
      const y = Math.round(it.transform[5] / 2) * 2;          // 2pt de tolerância = mesma linha
      if (!linhas.has(y)) linhas.set(y, []);
      linhas.get(y).push({ x: it.transform[4], w: it.width, s: it.str });
    }
    paginas.push([...linhas.entries()].sort((a, b) => b[0] - a[0]).map(([, its]) => {
      its.sort((a, b) => a.x - b.x);
      let out = '', fim = null;
      for (const it of its) { if (fim != null && it.x - fim > 1.5) out += '  '; out += it.s; fim = it.x + it.w; }
      return out;
    }));
  }
  return paginas;
}

// as abas da planilha: [{ nome, linhas }] (uma linha = um array de células). O .xls da Domínio é fora do padrão e o
// SheetJS devolve a aba vazia depois de minutos: vai pelo leitor próprio, com o SheetJS de reserva.
export async function abasDaPlanilha(file) {
  const XLSX = globalThis.XLSX;
  const buf = await file.arrayBuffer();
  if (!buf.byteLength || new Uint8Array(buf).every(b => b === 0)) throw new Error('arquivo vazio (só zeros) — a exportação da Domínio não terminou ou o arquivo foi copiado antes de gravar');
  const peloSheetJs = () => {
    if (!XLSX) throw new Error('o leitor de planilha não carregou — verifique a conexão e recarregue a página (Ctrl+F5)');
    const wb = XLSX.read(buf, { type: 'array', raw: true });
    return wb.SheetNames.map(n => ({ nome: n, linhas: XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' }) }));
  };
  if (/\.xls$/i.test(file.name)) {
    try { return lerXls(buf).abas; } catch (e) { return peloSheetJs(); }
  }
  return peloSheetJs();
}

// o rótulo curto de um relatório lido, pros chips das telas
export function rotuloRel(r) {
  if (r.tipo === 'faturamento') return 'faturamento · ' + r.meses.length + ' mês(es)' + (r.conferido === false ? ' ⚠ soma não fecha' : '');
  if (r.tipo === 'simples') return 'PGDAS ' + (r.competencia || '?');
  if (r.tipo === 'saidas' || r.tipo === 'servicos') return (r.tipo === 'saidas' ? 'saídas' : 'serviços') + ' · ' + r.vendas.length + ' nota(s)' + (r.fonte === 'planilha' ? ' · CNPJ do cliente' : '') + (r.conferido === false ? ' ⚠ soma não fecha' : '');
  return 'entradas · ' + r.lancamentos.length + ' lançamento(s)' + (r.conferido === false ? ' ⚠ soma não fecha' : '');
}
