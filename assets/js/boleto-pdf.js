// ============================================================
// MACEDO & REIS — PDF do boleto do Inter (07/10/2026)
// Desenha, com o jsPDF da página, o boleto de um título registrado pelo arquivo do Inter: recibo do pagador em cima,
// ficha de compensação embaixo, com a linha digitável e o código de barras (Intercalado 2 de 5, padrão Febraban) que
// assets/js/cnab-inter.js calcula a partir do arquivo de retorno (nosso número + número da operação).
// Sem QR Code de Pix: o arquivo de retorno não traz o código do Pix.
// Puro: recebe o construtor do jsPDF (window.jspdf.jsPDF) e os dados; a grade de boletos (financeiro-boletos.html) usa.
// ============================================================

// Intercalado 2 de 5: 1 = barra/espaço largo
const ITF = ['00110', '10001', '01001', '11000', '00101', '10100', '01100', '00011', '10010', '01010'];
// larguras alternadas (barra, espaço, barra…) em unidades de barra fina: início, pares de dígitos, fim
export function larguras2de5(codigo, largo = 3) {
  if (!/^\d+$/.test(codigo) || codigo.length % 2) throw new Error('código de barras precisa de quantidade par de dígitos');
  const w = c => (c === '1' ? largo : 1);
  const el = [1, 1, 1, 1];
  for (let i = 0; i < codigo.length; i += 2) {
    const a = ITF[+codigo[i]], b = ITF[+codigo[i + 1]];
    for (let k = 0; k < 5; k++) el.push(w(a[k]), w(b[k]));
  }
  el.push(largo, 1, 1);
  return el;
}

const BRL = v => (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const DATA = iso => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');

// d = { beneficiario: { nome, documento, endereco, agenciaCodigo }, pagador: { nome, documento, endereco, cidade },
//       vencimento, valor, nossoNumero (impresso), seuNumero, dataDocumento, instrucoes: [linhas], linha, barras }
export function boletoPdf(JsPDF, d) {
  const doc = new JsPDF({ unit: 'mm', format: 'a4' });
  const X = 10, L = 190;
  const caixa = (x, y, w, h, rotulo, valor, o = {}) => {
    doc.setDrawColor(0); doc.setLineWidth(0.2); doc.rect(x, y, w, h);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(70); doc.text(rotulo, x + 1.2, y + 2.8);
    if (valor == null || valor === '') return;
    doc.setFont('helvetica', o.negrito ? 'bold' : 'normal'); doc.setFontSize(o.tam || 9); doc.setTextColor(0);
    const linhas = Array.isArray(valor) ? valor : [String(valor)];
    linhas.forEach((t, i) => {
      if (o.direita) doc.text(t, x + w - 1.5, y + 6.6 + i * 3.8, { align: 'right' });
      else doc.text(t, x + 1.5, y + 6.6 + i * 3.8, { maxWidth: w - 3 });
    });
  };
  const cabecalho = (y, direita) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(0); doc.text('Banco Inter', X, y);
    doc.setLineWidth(0.4); doc.line(X + 35, y - 6, X + 35, y + 1.5); doc.line(X + 55, y - 6, X + 55, y + 1.5);
    doc.setFontSize(13); doc.text('077-9', X + 45, y, { align: 'center' });
    doc.setFontSize(direita.tam || 11); doc.text(direita.texto, X + L, y, { align: 'right' });
    doc.setLineWidth(0.4); doc.line(X, y + 1.5, X + L, y + 1.5);
  };
  const benef = `${d.beneficiario.documento} - ${d.beneficiario.nome}`;
  const pagador = [`${d.pagador.nome}${d.pagador.documento ? ' - ' + d.pagador.documento : ''}`, d.pagador.endereco, d.pagador.cidade].filter(Boolean);

  // ---- recibo do pagador ----
  cabecalho(18, { texto: 'Recibo do Pagador', tam: 10 });
  let y = 22;
  caixa(X, y, L, 9, 'Beneficiário', benef); y += 9;
  caixa(X, y, L, 9, 'Endereço do beneficiário', d.beneficiario.endereco); y += 9;
  caixa(X, y, 120, 9, 'Pagador', pagador[0]); caixa(X + 120, y, 30, 9, 'Vencimento', DATA(d.vencimento), { direita: true, negrito: true });
  caixa(X + 150, y, 40, 9, 'Valor do documento', BRL(d.valor), { direita: true, negrito: true }); y += 9;
  caixa(X, y, 60, 9, 'Agência / Código do beneficiário', d.beneficiario.agenciaCodigo);
  caixa(X + 60, y, 60, 9, 'Nosso número', d.nossoNumero); caixa(X + 120, y, 70, 9, 'Nº do documento', d.seuNumero); y += 9;
  caixa(X, y, L, 18, 'Instruções', d.instrucoes); y += 18;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(70);
  doc.text('Autenticação mecânica', X + L, y + 3.5, { align: 'right' });

  // linha de corte
  y += 12;
  doc.setLineDashPattern([1, 1], 0); doc.setLineWidth(0.2); doc.line(X, y, X + L, y); doc.setLineDashPattern([], 0);
  doc.setFontSize(6); doc.text('Corte na linha pontilhada', X + L, y - 1, { align: 'right' });

  // ---- ficha de compensação ----
  y += 12;
  cabecalho(y, { texto: d.linha, tam: 11.5 });
  y += 2;
  const lin = 9, dir = 50, esq = L - dir;
  caixa(X, y, esq, lin, 'Local de pagamento', 'PAGÁVEL EM QUALQUER BANCO'); caixa(X + esq, y, dir, lin, 'Vencimento', DATA(d.vencimento), { direita: true, negrito: true }); y += lin;
  caixa(X, y, esq, lin, 'Beneficiário', benef); caixa(X + esq, y, dir, lin, 'Agência / Código do beneficiário', d.beneficiario.agenciaCodigo, { direita: true }); y += lin;
  caixa(X, y, 28, lin, 'Data do documento', DATA(d.dataDocumento)); caixa(X + 28, y, 32, lin, 'Nº do documento', d.seuNumero);
  caixa(X + 60, y, 22, lin, 'Espécie doc.', 'DM'); caixa(X + 82, y, 16, lin, 'Aceite', 'NÃO');
  caixa(X + 98, y, esq - 98, lin, 'Data do processamento', DATA(d.dataDocumento));
  caixa(X + esq, y, dir, lin, 'Nosso número', d.nossoNumero, { direita: true }); y += lin;
  caixa(X, y, 28, lin, 'Uso do banco', ''); caixa(X + 28, y, 32, lin, 'Carteira', '112');
  caixa(X + 60, y, 22, lin, 'Espécie', 'R$'); caixa(X + 82, y, 16, lin, 'Quantidade', '');
  caixa(X + 98, y, esq - 98, lin, 'Valor', '');
  caixa(X + esq, y, dir, lin, '(=) Valor do documento', BRL(d.valor), { direita: true, negrito: true }); y += lin;
  const hInstr = 5 * 8;
  caixa(X, y, esq, hInstr, 'Instruções (texto de responsabilidade do beneficiário)', d.instrucoes);
  ['(-) Desconto / Abatimento', '(-) Outras deduções', '(+) Mora / Multa', '(+) Outros acréscimos', '(=) Valor cobrado']
    .forEach((r, i) => caixa(X + esq, y + i * 8, dir, 8, r, ''));
  y += hInstr;
  caixa(X, y, L, 18, 'Pagador', pagador); y += 18;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(70);
  doc.text('Autenticação mecânica - Ficha de Compensação', X + L, y + 3.5, { align: 'right' });

  // código de barras: barra fina 0,254 mm, larga 3x, 13 mm de altura
  const fina = 0.254;
  let x = X; const yb = y + 6;
  doc.setFillColor(0, 0, 0);
  larguras2de5(d.barras).forEach((w, i) => { if (i % 2 === 0) doc.rect(x, yb, w * fina, 13, 'F'); x += w * fina; });
  return doc;
}

// nome do arquivo: "EMPRESA - DD-MM-AAAA.pdf", sem caractere que o Windows recusa
export const nomeArquivoBoleto = (empresa, vencimento) =>
  `${String(empresa || 'BOLETO').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim()} - ${DATA(vencimento).replace(/\//g, '-')}.pdf`;
