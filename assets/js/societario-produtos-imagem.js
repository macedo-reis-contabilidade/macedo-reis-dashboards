// ============================================================================
// MACEDO & REIS — As imagens dos produtos do societário pro WhatsApp (24/11/2026: a transformação do MEI em ME e a
// abertura de empresa). São três, pra cada produto:
// 1. o passo a passo (1/2): os primeiros passos, que são com o cliente, e as etapas nos órgãos, numa linha do tempo;
// 2. a documentação (2/2), que é a lista do Samuel;
// 3. o orçamento, à parte: o cliente, a data e a validade, os dois jeitos de pagar, os prazos com a barra de cada etapa
//    e o que não está incluso.
// As duas primeiras não têm valor nenhum: servem pra qualquer cliente e pro anúncio ("claro que sem mostrar valores, por
// isso orçamento é separado").
// O texto vem do produto (PRODUTOS, de societario-produtos.js); o tamanho, as cores, as letras, o cabeçalho e o rodapé,
// da base comum (imagens-whats.js). Nenhuma passa de 1600 px de altura: com a letra do sistema, cabem com folga; com a de reserva
// (sem o Google Fonts), a que passar é reduzida até caber (caber, da base).
// ============================================================================
import { LARGURA, M, W, COR, FONTES, carregarFontes, fonte, quebrar, escrever, caixa, marca, cabecalho, rodape, desenhar, caber } from './imagens-whats.js';
import { PAGAMENTO, NOTA_PRAZOS, NAO_INCLUSO, NOTA_NAO_INCLUSO, totalDeDias, emPalavras } from './societario-produtos.js';
import { reais } from './mei-planos.js';

// ---------- os desenhos pequenos ----------
// a folha com o canto dobrado (o envio das informações)
function iconeDoc(ctx, cx, cy) {
  const w = 30, h = 38, x = cx - w / 2, y = cy - h / 2, d = 10;
  ctx.strokeStyle = COR.champTinta; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y + 3); ctx.lineTo(x + w - d, y); ctx.lineTo(x + w, y + d); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + w - d, y); ctx.lineTo(x + w - d, y + d); ctx.lineTo(x + w, y + d); ctx.stroke();
  [16, 23, 30].forEach(dy => { ctx.beginPath(); ctx.moveTo(x + 7, y + dy); ctx.lineTo(x + w - 7, y + dy); ctx.stroke(); });
}
// o círculo do primeiro passo: a folha ou o "R$" (o acerto financeiro)
function icone(ctx, tipo, cx, cy, f) {
  ctx.fillStyle = COR.fundo;
  ctx.beginPath(); ctx.arc(cx, cy, 34, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = COR.champ; ctx.stroke();
  if (tipo === 'doc') return iconeDoc(ctx, cx, cy);
  ctx.fillStyle = COR.champTinta; fonte(ctx, 700, 25, f.texto); ctx.textAlign = 'center';
  ctx.fillText('R$', cx, cy + 9);
  ctx.textAlign = 'left';
}
// o número da etapa no círculo azul
function numero(ctx, n, cx, cy, r, f) {
  ctx.fillStyle = COR.azul;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#FFFFFF'; fonte(ctx, 700, Math.round(r * 0.95), f.texto); ctx.textAlign = 'center';
  ctx.fillText(String(n), cx, cy + Math.round(r * 0.34));
  ctx.textAlign = 'left';
}
// a caixinha de marcar da documentação
function quadrado(ctx, x, y, s) {
  caixa(ctx, x, y, s, s, 7);
  ctx.fillStyle = COR.fundo; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = COR.azul; ctx.stroke();
}
// a bolinha da lista
function bolinha(ctx, x, y) {
  ctx.fillStyle = COR.azul; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
}
// o título e a frase de baixo; devolve onde terminou
function titulo(ctx, t, sub, y, f) {
  ctx.fillStyle = COR.tinta; fonte(ctx, 600, 62, f.titulo);
  y = escrever(ctx, quebrar(ctx, t, W), M, y, 62, 70) + 10;
  if (!sub) return y;
  ctx.fillStyle = COR.cinza; fonte(ctx, 400, 28, f.texto);
  return escrever(ctx, quebrar(ctx, sub, W), M, y, 28, 38);
}

// ---------- 1. o passo a passo ----------
function pintarPassoAPasso(ctx, o) {
  const f = o.fontes, p = o.produto;
  ctx.fillStyle = COR.fundo; ctx.fillRect(0, 0, LARGURA, o.altura || 5000);
  let y = cabecalho(ctx, 56, o.logo, f, o.pagina) + 44;
  y = titulo(ctx, p.titulo, p.subtitulo, y, f) + 32;

  // os primeiros passos (com o cliente), na caixa champanhe
  const PAD = 32, xi = M + PAD, xt = xi + 68 + 24, larg = M + W - PAD - xt;
  const medidas = p.primeiros.map(x => {
    fonte(ctx, 700, 30, f.texto); const lt = quebrar(ctx, x.titulo, larg);
    fonte(ctx, 400, 25, f.texto); const ld = quebrar(ctx, x.texto, larg);
    return { lt, ld, h: Math.max(68, lt.length * 38 + 4 + ld.length * 33) };
  });
  const hCab = 46;
  const hBox = PAD + hCab + 12 + medidas.reduce((s, m) => s + m.h, 0) + (medidas.length - 1) * 20 + PAD;
  caixa(ctx, M, y, W, hBox, 28);
  ctx.fillStyle = COR.champClaro; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = COR.champ; ctx.stroke();
  let yy = y + PAD;
  ctx.fillStyle = COR.tinta; fonte(ctx, 600, 40, f.titulo);
  ctx.fillText('Primeiros passos', xi, yy + 36);
  yy += hCab + 12;
  p.primeiros.forEach((x, i) => {
    const m = medidas[i];
    icone(ctx, x.icone, xi + 34, yy + 34, f);
    ctx.fillStyle = COR.tinta; fonte(ctx, 700, 30, f.texto);
    const ye = escrever(ctx, m.lt, xt, yy, 30, 38) + 4;
    ctx.fillStyle = COR.cinza; fonte(ctx, 400, 25, f.texto);
    escrever(ctx, m.ld, xt, ye, 25, 33);
    yy += m.h + 20;
  });
  y += hBox + 34;

  // daqui em diante, o que o escritório faz nos órgãos
  ctx.fillStyle = COR.tinta; fonte(ctx, 600, 40, f.titulo);
  ctx.fillText('As etapas', M, y + 36);
  y += 58;
  ctx.fillStyle = COR.cinza; fonte(ctx, 500, 26, f.texto);
  y = escrever(ctx, quebrar(ctx, p.obrigatorio, W), M, y, 26, 35) + 24;

  const R = 28, cx = M + R, x0 = M + 2 * R + 26, lt = M + W - x0;
  const centros = [];
  p.etapas.forEach(e => {
    const c = y + R;
    centros.push(c);
    ctx.fillStyle = COR.tinta; fonte(ctx, 700, 32, f.texto);
    let ye = escrever(ctx, quebrar(ctx, e.titulo, lt), x0, y + R - 24, 32, 40) + 8;
    fonte(ctx, 400, 26, f.texto);
    e.itens.forEach(it => {
      bolinha(ctx, x0 + 6, ye + 17);
      ctx.fillStyle = COR.tinta;
      ye = escrever(ctx, quebrar(ctx, it, lt - 26), x0 + 26, ye, 26, 34) + 6;
    });
    y = Math.max(ye, y + 2 * R) + 20;
    numero(ctx, e.n, cx, c, R, f);
  });
  // o fim: a empresa passa a ser ME, ou está aberta
  centros.push(y + R);
  marca(ctx, cx, y + R, R, COR.champ, COR.champTinta);
  ctx.fillStyle = COR.tinta; fonte(ctx, 700, 32, f.texto);
  ctx.fillText(p.pronto, x0, y + R + 11);
  // a linha entre os círculos
  ctx.strokeStyle = COR.linha; ctx.lineWidth = 4; ctx.lineCap = 'butt';
  for (let i = 0; i < centros.length - 1; i++) {
    ctx.beginPath(); ctx.moveTo(cx, centros[i] + R + 6); ctx.lineTo(cx, centros[i + 1] - R - 6); ctx.stroke();
  }
  y += 2 * R + 36;
  return { altura: rodape(ctx, y, f) };
}

// ---------- 2. a documentação ----------
function pintarDocumentacao(ctx, o) {
  const f = o.fontes, p = o.produto;
  ctx.fillStyle = COR.fundo; ctx.fillRect(0, 0, LARGURA, o.altura || 5000);
  let y = cabecalho(ctx, 56, o.logo, f, o.pagina) + 44;
  y = titulo(ctx, 'Documentação necessária', 'Pode mandar tudo por aqui mesmo, em foto ou por escrito.', y, f) + 16;

  const S = 30, xt = M + S + 20, lt = M + W - xt;
  p.documentos.forEach(g => {
    y += 22;
    ctx.fillStyle = COR.azulEscuro; fonte(ctx, 700, 28, f.texto);
    ctx.fillText(g.grupo, M, y + 24);
    y += 50;
    g.itens.forEach(it => {
      quadrado(ctx, M, y + 3, S);
      ctx.fillStyle = COR.tinta; fonte(ctx, 500, 27, f.texto);
      let ye = escrever(ctx, quebrar(ctx, it.t, lt), xt, y, 27, 36);
      if (it.nota) {
        ctx.fillStyle = COR.cinza; fonte(ctx, 400, 23, f.texto);
        ye = escrever(ctx, quebrar(ctx, it.nota, lt), xt, ye + 2, 23, 31);
      }
      y = ye + 16;
    });
  });

  y += 18;
  fonte(ctx, 600, 27, f.texto);
  const ln = quebrar(ctx, p.comeco, W - 2 * 30);
  const h = 2 * 26 + ln.length * 36;
  caixa(ctx, M, y, W, h, 24);
  ctx.fillStyle = COR.cartao; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = COR.linha; ctx.stroke();
  ctx.fillStyle = COR.tinta;
  escrever(ctx, ln, M + 30, y + 26, 27, 36);
  y += h + 40;
  return { altura: rodape(ctx, y, f) };
}

// ---------- 3. o orçamento ----------
function pintarOrcamento(ctx, o) {
  const f = o.fontes, d = o.orcamento, p = o.produto;
  ctx.fillStyle = COR.fundo; ctx.fillRect(0, 0, LARGURA, o.altura || 5000);
  let y = cabecalho(ctx, 56, o.logo, f, null) + 44;
  y = titulo(ctx, 'Orçamento', p.titulo, y, f) + 14;

  // pra quem, quando e até quando vale
  fonte(ctx, 500, 24, f.texto); ctx.fillStyle = COR.cinza;
  ctx.fillText('Cliente', M, y + 21);
  ctx.textAlign = 'right';
  if (d.data) ctx.fillText(d.data, M + W, y + 21);
  let wv = 0;
  if (d.validade) {
    ctx.fillStyle = COR.tinta; fonte(ctx, 700, 25, f.texto);
    const t = 'Válido até ' + d.validade;
    ctx.fillText(t, M + W, y + 21 + 33);
    wv = ctx.measureText(t).width;
  }
  ctx.textAlign = 'left';
  ctx.fillStyle = COR.tinta; fonte(ctx, 700, 25, f.texto);
  // o nome em até duas linhas (o resto, com as reticências), pra imagem não passar de 1600 px
  let ln = d.cliente ? quebrar(ctx, d.cliente, W - wv - 40) : ['—'];
  if (ln.length > 2) ln = [ln[0], ln[1] + '…'];
  escrever(ctx, ln, M, y + 33, 25, 33);
  y += 33 + ln.length * 33 + 16;

  // os dois jeitos de pagar
  const G = 24, cw = (W - G) / 2, PAD = 26;
  const cartoes = [
    { rotulo: 'A prazo', valor: d.aPrazo, linhas: [`Entrada de ${d.entrada ? reais(d.entrada) : '—'}`, `+ ${d.parcela ? reais(d.parcela) : '—'} em ${d.dias} dias`] },
    { rotulo: 'À vista', valor: d.aVista, selo: d.desconto ? `${reais(d.desconto)} a menos` : '' }
  ];
  const hC = PAD + 32 + 10 + 54 + 16 + 2 * 33 + PAD;
  cartoes.forEach((c, i) => {
    const x = M + i * (cw + G);
    caixa(ctx, x, y, cw, hC, 26);
    ctx.fillStyle = COR.cartao; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = COR.linha; ctx.stroke();
    let yy = y + PAD;
    ctx.fillStyle = COR.tinta; fonte(ctx, 700, 28, f.texto);
    ctx.fillText(c.rotulo, x + PAD, yy + 26);
    yy += 32 + 10;
    ctx.fillStyle = COR.azul; fonte(ctx, 700, 52, f.texto);
    ctx.fillText(c.valor ? reais(c.valor) : '—', x + PAD, yy + 46);
    yy += 54 + 16;
    if (c.linhas) {
      ctx.fillStyle = COR.cinza; fonte(ctx, 500, 25, f.texto);
      c.linhas.forEach((l, k) => ctx.fillText(l, x + PAD, yy + 24 + k * 33));
    }
    if (c.selo) {
      fonte(ctx, 700, 23, f.texto);
      const tw = ctx.measureText(c.selo).width;
      caixa(ctx, x + PAD, yy, tw + 36, 42, 21); ctx.fillStyle = COR.champ; ctx.fill();
      ctx.fillStyle = COR.champTinta; ctx.fillText(c.selo, x + PAD + 18, yy + 29);
    }
  });
  y += hC + 22;
  ctx.fillStyle = COR.tinta; fonte(ctx, 500, 26, f.texto);
  y = escrever(ctx, quebrar(ctx, PAGAMENTO, W), M, y, 26, 35) + 24;

  // os prazos de cada etapa, com a barra de cada uma no tempo
  ctx.fillStyle = COR.tinta; fonte(ctx, 600, 40, f.titulo);
  ctx.fillText('Prazos', M, y + 36);
  y += 46;
  fonte(ctx, 500, 25, f.texto);
  const inicio = quebrar(ctx, p.inicio, W - 2 * 26);
  const hI = 2 * 17 + inicio.length * 33;
  caixa(ctx, M, y, W, hI, 20);
  ctx.fillStyle = COR.champClaro; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = COR.champ; ctx.stroke();
  ctx.fillStyle = COR.champTinta;
  escrever(ctx, inicio, M + 26, y + 17, 25, 33);
  y += hI + 14;

  const total = totalDeDias(p);
  const R = 22, xn = M + R, xt = M + 2 * R + 18, xr = M + W;
  let acum = 0;
  p.etapas.forEach(e => {
    numero(ctx, e.n, xn, y + 20, R, f);
    ctx.fillStyle = COR.azul; fonte(ctx, 700, 26, f.texto); ctx.textAlign = 'right';
    const dur = e.dias + (e.dias === 1 ? ' dia útil' : ' dias úteis');
    ctx.fillText(dur, xr, y + 29);
    const wd = ctx.measureText(dur).width;
    ctx.textAlign = 'left';
    ctx.fillStyle = COR.tinta; fonte(ctx, 600, 26, f.texto);
    const ye = escrever(ctx, quebrar(ctx, e.titulo, xr - wd - 24 - xt), xt, y + 1, 26, 34);
    // a barra: onde a etapa começa e termina, na soma das médias
    const yb = ye + 8, hb = 12;
    caixa(ctx, xt, yb, xr - xt, hb, 6); ctx.fillStyle = COR.azulClaro; ctx.fill();
    const a = xt + (xr - xt) * acum / total, b = xt + (xr - xt) * (acum + e.dias) / total;
    caixa(ctx, a + 1, yb, Math.max(12, b - a - 2), hb, 6); ctx.fillStyle = COR.azul; ctx.fill();
    acum += e.dias;
    y = yb + hb + 12;
  });
  ctx.fillStyle = COR.tinta; fonte(ctx, 700, 26, f.texto);
  y = escrever(ctx, quebrar(ctx, `Somando as médias, são cerca de ${total} dias úteis: ${emPalavras(total)}.`, W), M, y + 2, 26, 35) + 6;
  ctx.fillStyle = COR.cinza; fonte(ctx, 400, 23, f.texto);
  y = escrever(ctx, quebrar(ctx, NOTA_PRAZOS, W), M, y, 23, 31) + 22;

  // o que não está incluso
  ctx.fillStyle = COR.tinta; fonte(ctx, 600, 40, f.titulo);
  ctx.fillText('Não está incluso', M, y + 36);
  y += 50;
  fonte(ctx, 500, 26, f.texto);
  NAO_INCLUSO.forEach(t => {
    bolinha(ctx, M + 7, y + 17);
    ctx.fillStyle = COR.tinta;
    y = escrever(ctx, quebrar(ctx, t, W - 30), M + 30, y, 26, 34) + 6;
  });
  ctx.fillStyle = COR.cinza; fonte(ctx, 400, 24, f.texto);
  y = escrever(ctx, quebrar(ctx, NOTA_NAO_INCLUSO, W), M, y + 4, 24, 32) + 26;
  return { altura: rodape(ctx, y, f) };
}

// as imagens do produto, na ordem de mandar: [o passo a passo, a documentação, o orçamento] (canvas de 1080 px de
// largura). produto: um de PRODUTOS (societario-produtos.js); orcamento: o que dadosDoOrcamento devolve;
// opc: { logo (Image carregada), fontes }
export async function imagensDoProduto(produto, orcamento, opc = {}, doc = document) {
  await carregarFontes(doc);
  const o = { ...opc, produto, fontes: opc.fontes || FONTES };
  return [
    desenhar(pintarPassoAPasso, { ...o, pagina: { n: 1, total: 2 } }, doc),
    desenhar(pintarDocumentacao, { ...o, pagina: { n: 2, total: 2 } }, doc),
    desenhar(pintarOrcamento, { ...o, orcamento }, doc)
  ].map(c => caber(c, doc));
}
