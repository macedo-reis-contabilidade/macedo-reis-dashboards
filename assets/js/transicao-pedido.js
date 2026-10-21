// ============================================================
// MACEDO & REIS — Pedir documentos ao cliente na transição (21/10/2026, pedido do Samuel: "hoje eu procuro o arquivo
// na última transição feita e o texto também")
// O card de documentos (assets/transicao/documentos-solicitados.pdf, o mesmo PDF que vai pra toda empresa que chega de
// outro escritório) e a mensagem padrão que segue junto, com o prazo de cada setor. Puro, sem o Supabase: a tela
// Transição de clientes (comercial-transicao.html, o "📨 Pedir documentos" da transição de entrada) e o teste no node
// (tests/transicao-pedido.test.mjs) usam o mesmo.
// ============================================================
import { diaUtil, somaDias, fmtData, feriado, diaSemana, isoValida } from './rescisao-datas.js';

export const CARD_PDF = 'assets/transicao/documentos-solicitados.pdf';
export const CARD_NOME = 'Documentos solicitados - Macedo & Reis.pdf';

// n dias úteis depois do dia (o próprio dia não conta); dia útil = sem sábado, domingo e os feriados da rescisao-datas.js
export function diasUteisDepois(iso, n) {
  if (!isoValida(iso)) return '';
  let d = iso, faltam = Math.max(0, Math.floor(Number(n) || 0));
  while (faltam > 0) { d = somaDias(d, 1); if (diaUtil(d)) faltam--; }
  return d;
}
// o próprio dia, se for útil; senão, o próximo dia útil
export function proximoDiaUtil(iso) {
  if (!isoValida(iso)) return '';
  let d = iso;
  while (!diaUtil(d)) d = somaDias(d, 1);
  return d;
}

// as datas que a mensagem já traz, contadas do dia em que ela sai: fiscal e DP (o urgente) em 2 dias úteis, o contábil em
// 7 dias úteis e os demais documentos do card em 30 dias corridos, no dia útil se cair em fim de semana ou feriado. É a
// conta que bate com o pedido da Ind Perin (23/10, 30/10 e 20/11): gerada em 21/10/2026, dá 23/10, 30/10 e 23/11 — o
// 20/11 é feriado (Consciência Negra)
export function datasPadrao(hojeIso) {
  if (!isoValida(hojeIso)) return { urgente: '', contabil: '', demais: '' };
  return { urgente: diasUteisDepois(hojeIso, 2), contabil: diasUteisDepois(hojeIso, 7), demais: proximoDiaUtil(somaDias(hojeIso, 30)) };
}

const dataDaMensagem = iso => fmtData(iso) || '__/__/____';

// a mensagem padrão do escritório, com as datas em dd/mm/aaaa (a que falta sai "__/__/____", pra ninguém mandar sem ver)
export function mensagemDoPedido({ urgente, contabil, demais } = {}) {
  const u = dataDaMensagem(urgente), c = dataDaMensagem(contabil), d = dataDaMensagem(demais);
  return [
    'OBS.: Os documentos solicitados abaixo possuem caráter de maior urgência, e precisamos que nos sejam enviados até as datas estipuladas.',
    '',
    `Setor Fiscal - Enviar até dia ${u}.`,
    '- Certificado digital e senha',
    '',
    `DP - Enviar até dia ${u}.`,
    '- Extrato mensal da folha (desde a abertura, ou últimos 5 anos até o mês de fechamento);',
    '- Login e senha do seguro desemprego EMPREGADOR WEB;',
    '- Ficha de empregados com quadro de horários;',
    '- Relatório de férias com detalhamento;',
    '- Relatório de dependentes com detalhamento;',
    '- Informações complementares que podem facilitar na transição;',
    '',
    `Setor Contábil - Enviar até dia ${c}.`,
    '- Relação dos bancos que as empresas possuem conta',
    '',
    `Pedimos, por gentileza, que os demais documentos que constam no card sejam encaminhados até ${d}.`,
    '',
    'Qualquer dúvida, ficamos à disposição.',
  ].join('\n');
}

// o aviso da data: feriado (com o nome), sábado ou domingo; dia útil (ou data inválida), nada
export function avisoDaData(iso) {
  if (!isoValida(iso)) return '';
  const f = feriado(iso);
  if (f) return 'feriado: ' + f;
  const s = diaSemana(iso);
  return s === 'sábado' || s === 'domingo' ? s : '';
}
// a linha embaixo de cada data na janela: o dia da semana e, fora do dia útil, o aviso
export function rotuloDoDia(iso) {
  if (!isoValida(iso)) return '';
  const dia = diaSemana(iso), aviso = avisoDaData(iso);
  if (!aviso) return dia;
  return aviso.startsWith('feriado') ? `${dia} · ⚠ ${aviso}` : `⚠ ${dia}, fim de semana`;
}
