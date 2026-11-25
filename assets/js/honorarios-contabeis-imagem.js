// ============================================================================
// MACEDO & REIS — As imagens dos honorários contábeis pro WhatsApp (24/11/2026). São duas, na ordem de mandar:
// 1. o que está incluso (1/2): cada área do contrato num cartão, com o ✓ em cada serviço, e o horário de atendimento;
// 2. como funciona e o que é cobrado à parte (2/2): a proposta, o contrato e o que fazemos todo mês, numa linha do
//    tempo, e a lista do orçamento da Precificação.
// Nenhuma tem valor nem o nome do cliente: servem pra qualquer um e pro anúncio.
// O texto vem de honorarios-contabeis.js; o tamanho, as cores, as letras, o cabeçalho, o título e o rodapé, da base
// comum (imagens-whats.js). Nenhuma passa de 1600 px de altura: com a letra do sistema, cabem com folga; com a de
// reserva (sem o Google Fonts), a que passar é reduzida até caber (caber, da base).
// ============================================================================
import { LARGURA, M, W, COR, FONTES, carregarFontes, fonte, quebrar, escrever, caixa, marca, cabecalho, rodape, desenhar, caber,
  numero, bolinha, titulo } from './imagens-whats.js';
import { TITULO, SUBTITULO, AREAS, ATENDIMENTO, COMO_FUNCIONA, A_PARTE } from './honorarios-contabeis.js';

// ---------- 1. o que está incluso ----------
function pintarIncluso(ctx, o) {
  const f = o.fontes;
  ctx.fillStyle = COR.fundo; ctx.fillRect(0, 0, LARGURA, o.altura || 5000);
  let y = cabecalho(ctx, 56, o.logo, f, o.pagina) + 44;
  y = titulo(ctx, TITULO, SUBTITULO, y, f) + 30;

  const PAD = 28, R = 15, xt = M + PAD + 2 * R + 16, lt = M + W - PAD - xt;
  AREAS.forEach(a => {
    // mede antes de pintar a caixa: as linhas de cada serviço
    fonte(ctx, 500, 27, f.texto);
    const itens = a.itens.map(t => quebrar(ctx, t, lt));
    const hItens = itens.reduce((s, l) => s + l.length * 36, 0) + (itens.length - 1) * 12;
    const h = PAD + 34 + 14 + hItens + PAD;
    caixa(ctx, M, y, W, h, 24);
    ctx.fillStyle = COR.cartao; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = COR.linha; ctx.stroke();
    let yy = y + PAD;
    ctx.fillStyle = COR.azulEscuro; fonte(ctx, 700, 30, f.texto);
    ctx.fillText(a.area, M + PAD, yy + 26);
    yy += 34 + 14;
    itens.forEach(l => {
      marca(ctx, M + PAD + R, yy + 16, R);
      ctx.fillStyle = COR.tinta; fonte(ctx, 500, 27, f.texto);
      yy = escrever(ctx, l, xt, yy, 27, 36) + 12;
    });
    y += h + 18;
  });

  // o horário de atendimento, no mesmo cartão, sem o ✓
  fonte(ctx, 500, 27, f.texto);
  const at = quebrar(ctx, ATENDIMENTO, W - 2 * PAD);
  const hAt = PAD + 34 + 14 + at.length * 36 + PAD;
  caixa(ctx, M, y, W, hAt, 24);
  ctx.fillStyle = COR.cartao; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = COR.linha; ctx.stroke();
  ctx.fillStyle = COR.azulEscuro; fonte(ctx, 700, 30, f.texto);
  ctx.fillText('Atendimento', M + PAD, y + PAD + 26);
  ctx.fillStyle = COR.tinta; fonte(ctx, 500, 27, f.texto);
  escrever(ctx, at, M + PAD, y + PAD + 34 + 14, 27, 36);
  y += hAt + 18;

  y += 22;
  return { altura: rodape(ctx, y, f) };
}

// ---------- 2. como funciona e o que é cobrado à parte ----------
function pintarComoFunciona(ctx, o) {
  const f = o.fontes;
  ctx.fillStyle = COR.fundo; ctx.fillRect(0, 0, LARGURA, o.altura || 5000);
  let y = cabecalho(ctx, 56, o.logo, f, o.pagina) + 44;
  y = titulo(ctx, 'Como funciona', 'Da proposta ao dia a dia.', y, f) + 34;

  // a proposta, o contrato e o que fazemos todo mês, numa linha do tempo
  const R = 28, cx = M + R, x0 = M + 2 * R + 26, lt = M + W - x0;
  const centros = [];
  COMO_FUNCIONA.forEach((p, i) => {
    const c = y + R;
    centros.push(c);
    ctx.fillStyle = COR.tinta; fonte(ctx, 700, 32, f.texto);
    let ye = escrever(ctx, quebrar(ctx, p.titulo, lt), x0, y + R - 24, 32, 40) + 6;
    ctx.fillStyle = COR.cinza; fonte(ctx, 400, 26, f.texto);
    ye = escrever(ctx, quebrar(ctx, p.texto, lt), x0, ye, 26, 35);
    y = Math.max(ye, y + 2 * R) + 30;
    numero(ctx, i + 1, cx, c, R, f);
  });
  ctx.strokeStyle = COR.linha; ctx.lineWidth = 4; ctx.lineCap = 'butt';
  for (let i = 0; i < centros.length - 1; i++) {
    ctx.beginPath(); ctx.moveTo(cx, centros[i] + R + 6); ctx.lineTo(cx, centros[i + 1] - R - 6); ctx.stroke();
  }
  y += 14;

  // o que é cobrado à parte (o orçamento da Precificação)
  ctx.fillStyle = COR.tinta; fonte(ctx, 600, 40, f.titulo);
  ctx.fillText('Cobrado à parte', M, y + 36);
  y += 56;
  fonte(ctx, 500, 26, f.texto);
  A_PARTE.forEach(t => {
    bolinha(ctx, M + 7, y + 15);
    ctx.fillStyle = COR.tinta;
    y = escrever(ctx, quebrar(ctx, t, W - 30), M + 30, y, 26, 34) + 10;
  });
  y += 30;
  return { altura: rodape(ctx, y, f) };
}

// as imagens, na ordem de mandar: [o que está incluso, como funciona e o que é à parte] (canvas de 1080 px de largura).
// opc: { logo (Image carregada), fontes }
export async function imagensDosHonorarios(opc = {}, doc = document) {
  await carregarFontes(doc);
  const o = { ...opc, fontes: opc.fontes || FONTES };
  return [
    desenhar(pintarIncluso, { ...o, pagina: { n: 1, total: 2 } }, doc),
    desenhar(pintarComoFunciona, { ...o, pagina: { n: 2, total: 2 } }, doc)
  ].map(c => caber(c, doc));
}
