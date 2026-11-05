// ============================================================
// MACEDO & REIS — o PDF dos recibos da Folha de pagamento (05/11/2026)
// Dois recibos por folha A4, com a linha de corte no meio: a empresa e o CNPJ, o tipo e a competência, o funcionário,
// a tabela dos eventos (código, descrição, referência, proventos e descontos), os totais, o valor líquido e, embaixo,
// "Recebi de … a importância de R$ … (por extenso), referente a …", o local e a data e a assinatura.
// O desenho é o do recibo da planilha do DP (o mesmo da calculadora de salário por hora), com proventos e descontos em
// colunas, como um holerite. Puro: recebe o construtor do jsPDF (window.jspdf.jsPDF) e os recibos gravados (os valores
// de cada linha já calculados — o PDF não refaz conta). Os textos vão sem travessão: a fonte padrão do jsPDF não tem.
// ============================================================
import { TIPOS, COM_PERIODO, EVENTOS, COD_ARREDONDAMENTO, fmtValor, fmtData, competenciaTexto, referenciaTexto, porExtenso, centavos, base } from './folha-recibos.js';

const X = 10, L = 190, ALTURA = 133.5;
const DIREITA = X + L - 5;
const COLS = { cod: X + 5, desc: X + 17, ref: X + 112, prov: X + 137, desc2: X + 161, fim: DIREITA };   // as divisas da tabela

const semTravessao = t => String(t == null ? '' : t).replace(/[–—]/g, '-');
const documentoTexto = d => {
  const s = String(d || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  if (s.length === 14) return 'CNPJ ' + s.replace(/^(\w{2})(\w{3})(\w{3})(\w{4})(\w{2})$/, '$1.$2.$3/$4-$5');
  if (s.length === 11) return 'CPF ' + s.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return '';
};

// cada item: { empresa: { nome, documento, cidade }, funcionario: { nome, funcao, admissao }, recibo: a linha gravada
// (tipo, competencia, periodo_de, periodo_ate, tipo_valor, valor, itens, arredondamento, total, pagamento, nome) }
export function recibosPdf(JsPDF, lista, { vias = 1 } = {}) {
  const doc = new JsPDF({ unit: 'mm', format: 'a4' });
  const blocos = [];
  (lista || []).forEach(item => { for (let v = 1; v <= vias; v++) blocos.push({ ...item, via: vias > 1 ? v : null }); });
  blocos.forEach((b, i) => {
    if (i && i % 2 === 0) doc.addPage();
    const y0 = i % 2 === 0 ? 10 : 10 + ALTURA + 9;
    desenharRecibo(doc, b, y0);
    if (i % 2 === 0 && i + 1 < blocos.length) {
      doc.setDrawColor(150); doc.setLineWidth(0.2);
      if (doc.setLineDashPattern) doc.setLineDashPattern([1.5, 1.5], 0);
      doc.line(4, 148.5, 206, 148.5);
      if (doc.setLineDashPattern) doc.setLineDashPattern([], 0);
    }
  });
  return doc;
}

export function desenharRecibo(doc, { empresa = {}, funcionario = {}, recibo = {}, via = null }, y0) {
  const tipo = TIPOS[recibo.tipo] || { rotulo: 'Recibo', referente: () => 'ao pagamento' };
  const nome = semTravessao(recibo.nome || funcionario.nome || '').toUpperCase();
  doc.setDrawColor(0); doc.setTextColor(0); doc.setLineWidth(0.3);
  doc.rect(X, y0, L, ALTURA);

  // a empresa e o recibo
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
  doc.text(semTravessao(empresa.nome || ''), X + 5, y0 + 8, { maxWidth: 118 });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  const docEmp = documentoTexto(empresa.documento);
  if (docEmp) doc.text(docEmp, X + 5, y0 + 13);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
  doc.text(semTravessao(tipo.rotulo), DIREITA, y0 + 8, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text('Competência: ' + competenciaTexto(recibo.competencia), DIREITA, y0 + 13, { align: 'right' });
  if (via) { doc.setFontSize(7); doc.setTextColor(90); doc.text(via === 1 ? 'Via do empregador' : 'Via do funcionário', DIREITA, y0 + 3.6, { align: 'right' }); doc.setTextColor(0); }
  doc.setLineWidth(0.2); doc.line(X, y0 + 16, X + L, y0 + 16);

  // o funcionário
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.text('Funcionário:', X + 5, y0 + 21.5);
  doc.setFont('helvetica', 'bold'); doc.text(nome, X + 25, y0 + 21.5, { maxWidth: 110 });
  doc.setFont('helvetica', 'normal');
  if (funcionario.admissao) doc.text('Admissão: ' + fmtData(funcionario.admissao), DIREITA, y0 + 21.5, { align: 'right' });
  const meio = [];
  if (funcionario.funcao) meio.push('Função: ' + semTravessao(funcionario.funcao));
  if (COM_PERIODO.includes(recibo.tipo) && recibo.periodo_de && recibo.periodo_ate) meio.push('Período: ' + fmtData(recibo.periodo_de) + ' a ' + fmtData(recibo.periodo_ate));
  // no adiantamento de quem recebe por hora, o salário do mês sobre o qual vai o percentual (a hora × as horas do mês)
  if (recibo.tipo === 'adiantamento' && recibo.tipo_valor !== 'mes' && centavos(recibo.valor)) {
    const b = base(recibo);
    meio.push('Salário do mês: R$ ' + fmtValor(centavos(b.salarioDoMes)) + ' (' + String(b.horasDoMes).replace('.', ',') + ' h)');
  }
  if (meio.length) doc.text(meio.join('    '), X + 5, y0 + 26.5, { maxWidth: 125 });
  const vc = centavos(recibo.valor);
  if (vc) doc.text((recibo.tipo_valor === 'mes' ? 'Salário: R$ ' : 'Valor da hora: R$ ') + fmtValor(vc), DIREITA, y0 + 26.5, { align: 'right' });

  // a tabela
  const linhas = (recibo.itens || []).filter(l => centavos(l.v ? l.v / 100 : 0) || l.q != null).map(l => {
    const ev = EVENTOS[l.ev] || { cod: '', rotulo: l.ev, un: 'R$', nat: 'P' };
    return { cod: ev.cod, rotulo: semTravessao(l.desc || ev.rotulo), ref: referenciaTexto(ev.un, l.q), nat: ev.nat, v: Number(l.v) || 0 };
  });
  const arred = centavos(recibo.arredondamento);
  if (arred) linhas.push({ cod: COD_ARREDONDAMENTO, rotulo: 'Arredondamento', ref: '', nat: arred > 0 ? 'P' : 'D', v: Math.abs(arred) });
  const topo = y0 + 30, hCab = 6, hLin = linhas.length > 10 ? 55 / linhas.length : 5.5, hCorpo = 55;
  doc.setLineWidth(0.2);
  doc.rect(COLS.cod - 2, topo, COLS.fim - COLS.cod + 2, hCab + hCorpo);
  doc.line(COLS.cod - 2, topo + hCab, COLS.fim, topo + hCab);
  [COLS.desc, COLS.ref, COLS.prov, COLS.desc2].forEach(x => doc.line(x - 2, topo, x - 2, topo + hCab + hCorpo));
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
  doc.text('Cód.', COLS.cod + 3, topo + 4.2, { align: 'center' });
  doc.text('Descrição', COLS.desc, topo + 4.2);
  doc.text('Referência', (COLS.ref + COLS.prov) / 2 - 2, topo + 4.2, { align: 'center' });
  doc.text('Proventos', COLS.desc2 - 4, topo + 4.2, { align: 'right' });
  doc.text('Descontos', COLS.fim - 2, topo + 4.2, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(linhas.length > 10 ? 7.5 : 8.5);
  linhas.forEach((l, i) => {
    const y = topo + hCab + hLin * (i + 1) - (hLin - 3) / 2 - 0.3;
    doc.text(String(l.cod), COLS.cod + 3, y, { align: 'center' });
    doc.text(l.rotulo, COLS.desc, y, { maxWidth: COLS.ref - COLS.desc - 4 });
    if (l.ref) doc.text(l.ref, (COLS.ref + COLS.prov) / 2 - 2, y, { align: 'center' });
    doc.text(fmtValor(l.v), l.nat === 'D' ? COLS.fim - 2 : COLS.desc2 - 4, y, { align: 'right' });
  });

  // os totais
  const prov = linhas.filter(l => l.nat === 'P').reduce((s, l) => s + l.v, 0);
  const desc = linhas.filter(l => l.nat === 'D').reduce((s, l) => s + l.v, 0);
  const yt = topo + hCab + hCorpo;
  doc.rect(COLS.prov - 2, yt, COLS.fim - COLS.prov + 2, 6);
  doc.line(COLS.desc2 - 2, yt, COLS.desc2 - 2, yt + 6);
  doc.setFontSize(7.5); doc.text('Totais', COLS.prov - 4, yt + 4.2, { align: 'right' });
  doc.setFontSize(8.5);
  doc.text(fmtValor(prov), COLS.desc2 - 4, yt + 4.2, { align: 'right' });
  doc.text(fmtValor(desc), COLS.fim - 2, yt + 4.2, { align: 'right' });
  const total = centavos(recibo.total);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
  doc.text('Valor líquido   R$ ' + fmtValor(total), COLS.fim - 2, yt + 13, { align: 'right' });

  // o recebimento
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  const frase = 'Recebi de ' + semTravessao(empresa.nome || 'a empresa') + ' a importância de R$ ' + fmtValor(total) + ' (' + porExtenso(total / 100)
    + '), referente ' + tipo.referente(recibo.competencia || '') + '.';
  const partes = doc.splitTextToSize ? doc.splitTextToSize(frase, L - 10) : [frase];
  partes.slice(0, 3).forEach((t, i) => doc.text(t, X + 5, yt + 20 + i * 4.3));
  const yAss = y0 + ALTURA - 9;
  const local = (empresa.cidade ? semTravessao(empresa.cidade) : '____________________') + ', ' + (recibo.pagamento ? fmtData(recibo.pagamento) : '____/____/________');
  doc.text(local, X + 5, yAss);
  doc.setLineWidth(0.3); doc.line(X + 100, yAss - 0.5, DIREITA, yAss - 0.5);
  doc.setFontSize(8.5); doc.text(nome, (X + 100 + DIREITA) / 2, yAss + 4, { align: 'center', maxWidth: DIREITA - X - 100 });
}

// o nome do arquivo: "Recibos ESMERO 2026-10.pdf", "Recibo FULANO Folha mensal 2026-10.pdf"
export function nomeDoArquivo({ empresa, funcionario, recibo, varios }) {
  const limpo = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w .-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  if (varios) return 'Recibos ' + limpo(empresa) + ' ' + (recibo && recibo.competencia || '') + '.pdf';
  return 'Recibo ' + limpo(funcionario) + ' ' + limpo((TIPOS[recibo.tipo] || {}).rotulo) + ' ' + recibo.competencia + '.pdf';
}
