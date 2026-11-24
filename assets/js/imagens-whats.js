// ============================================================================
// MACEDO & REIS — A base das imagens pro WhatsApp (24/11/2026): o que as imagens dos produtos da Vitrine têm em comum.
// Usam esta base os planos do MEI (mei-planos-imagem.js), os produtos do societário, a transformação do MEI em ME e a
// abertura de empresa (societario-produtos-imagem.js), e os honorários contábeis (honorarios-contabeis-imagem.js).
// - O tamanho: 1080 px de largura e no máximo 1600 de altura (ALTURA_MAX). Na qualidade padrão, o WhatsApp reduz a foto
//   até o lado maior ficar com uns 1600 px; até aí, a imagem chega como saiu e cabe na tela do celular.
// - As cores: o azul e o champanhe da logo.
// - As letras do sistema: Fraunces nos títulos e Manrope no texto.
// - O cabeçalho: a logo, o nome e, no canto, qual imagem é ("2/4").
// - O rodapé: o escritório com o registro no CRC.
// - O texto que quebra na largura.
// Cada desenho roda duas vezes (desenhar): a primeira mede, num rascunho; a segunda pinta no canvas do tamanho certo.
// Produto novo com imagem = o módulo do desenho dele, com esta base; nunca copiar estas funções.
// ============================================================================

export const LARGURA = 1080;
export const ALTURA_MAX = 1600;
export const M = 64;                    // a margem dos lados
export const W = LARGURA - 2 * M;       // a largura do conteúdo
export const COR = {
  fundo: '#FFFFFF', cartao: '#F2F6FA', linha: '#D5DEE8', tinta: '#1A2330', cinza: '#55606E', apagado: '#B4BFCB',
  azul: '#3A70B4', azulEscuro: '#2C5A96', azulClaro: '#E4EDF7', champ: '#E3A75F', champClaro: '#FFF5EA', champTinta: '#2A1A06'
};
export const FONTES = {
  titulo: "'Fraunces', Georgia, 'Times New Roman', serif",
  texto: "'Manrope', 'Helvetica Neue', Arial, sans-serif"
};
// o rodapé de toda imagem (o registro no CRC, que toda peça leva)
export const ESCRITORIO = 'Macedo & Reis Contabilidade · CRC/RS 006418/O · Três Coroas – RS';

// a letra do sistema vem do Google Fonts (o style.css): o canvas só usa a que já carregou, então pede antes, com prazo
export async function carregarFontes(doc = (typeof document !== 'undefined' ? document : null), ms = 2500) {
  if (!doc || !doc.fonts || !doc.fonts.load) return;
  const pedidos = ['600 64px Fraunces', '700 38px Manrope', '600 24px Manrope', '500 24px Manrope', '400 24px Manrope']
    .map(f => doc.fonts.load(f).catch(() => null));
  await Promise.race([Promise.all(pedidos), new Promise(r => setTimeout(r, ms))]);
}

export const fonte = (ctx, peso, tam, fam) => { ctx.font = `${peso} ${tam}px ${fam}`; };

// as palavras e, dentro de cada uma, os pedaços depois de cada barra: "notas/faturamento/produtos" quebra na barra, sem
// espaço, em vez de passar por cima da coluna do lado
function pedacos(t) {
  const out = [];
  String(t || '').split(/\s+/).filter(Boolean).forEach(w => w.split(/(?<=\/)/).forEach((p, i) => out.push({ p, cola: i > 0 })));
  return out;
}
// as linhas de um texto que cabem na largura (o pedaço maior que a largura fica sozinho na linha)
export function quebrar(ctx, t, larg) {
  const linhas = [];
  let atual = '';
  for (const { p, cola } of pedacos(t)) {
    const tenta = atual ? atual + (cola ? '' : ' ') + p : p;
    if (!atual || ctx.measureText(tenta).width <= larg) atual = tenta;
    else { linhas.push(atual); atual = p; }
  }
  if (atual) linhas.push(atual);
  return linhas;
}
// escreve as linhas a partir do topo (y) e devolve onde terminou
export function escrever(ctx, linhas, x, y, tam, alt) {
  linhas.forEach((l, i) => ctx.fillText(l, x, y + Math.round(tam * 0.8) + i * alt));
  return y + linhas.length * alt;
}
export function caixa(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
// o ✓: o círculo (azul, ou a cor dada) com o traço (branco, ou a cor dada)
export function marca(ctx, cx, cy, r, fundo = COR.azul, traco = '#FFFFFF') {
  ctx.fillStyle = fundo;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = traco; ctx.lineWidth = Math.max(2, r * 0.22); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(cx - r * 0.45, cy + r * 0.02); ctx.lineTo(cx - r * 0.12, cy + r * 0.34); ctx.lineTo(cx + r * 0.48, cy - r * 0.3); ctx.stroke();
}
// o número do passo no círculo azul (a linha do tempo dos produtos do societário e o "como funciona" dos honorários)
export function numero(ctx, n, cx, cy, r, f) {
  ctx.fillStyle = COR.azul;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#FFFFFF'; fonte(ctx, 700, Math.round(r * 0.95), f.texto); ctx.textAlign = 'center';
  ctx.fillText(String(n), cx, cy + Math.round(r * 0.34));
  ctx.textAlign = 'left';
}
// a bolinha da lista
export function bolinha(ctx, x, y) {
  ctx.fillStyle = COR.azul; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
}
// o título grande e a frase de baixo; devolve onde terminou
export function titulo(ctx, t, sub, y, f) {
  ctx.fillStyle = COR.tinta; fonte(ctx, 600, 62, f.titulo);
  y = escrever(ctx, quebrar(ctx, t, W), M, y, 62, 70) + 10;
  if (!sub) return y;
  ctx.fillStyle = COR.cinza; fonte(ctx, 400, 28, f.texto);
  return escrever(ctx, quebrar(ctx, sub, W), M, y, 28, 38);
}
// "CONTABILIDADE" espaçado, como no folder
export function espacado(ctx, t, x, y, esp) {
  if ('letterSpacing' in ctx) {
    const antes = ctx.letterSpacing;
    ctx.letterSpacing = esp + 'px'; ctx.fillText(t, x, y); ctx.letterSpacing = antes;
    return;
  }
  let xx = x;
  for (const ch of t) { ctx.fillText(ch, xx, y); xx += ctx.measureText(ch).width + esp; }
}
// a logo e o nome do escritório e, no canto, qual imagem é ("2/4"); devolve onde terminou
export function cabecalho(ctx, y, logo, f, pagina) {
  let x = M;
  if (logo && logo.naturalWidth) { ctx.drawImage(logo, M, y, 76, 76); x = M + 76 + 22; }
  ctx.textAlign = 'left';
  ctx.fillStyle = COR.tinta; fonte(ctx, 600, 34, f.titulo);
  ctx.fillText('Macedo & Reis', x, y + 36);
  ctx.fillStyle = COR.cinza; fonte(ctx, 600, 19, f.texto);
  espacado(ctx, 'CONTABILIDADE', x, y + 66, 4.5);
  if (pagina && pagina.total > 1) {
    fonte(ctx, 700, 22, f.texto);
    const t = pagina.n + '/' + pagina.total, w = ctx.measureText(t).width + 32;
    caixa(ctx, LARGURA - M - w, y + 17, w, 42, 21);
    ctx.fillStyle = COR.cartao; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = COR.linha; ctx.stroke();
    ctx.fillStyle = COR.cinza; ctx.textAlign = 'center';
    ctx.fillText(t, LARGURA - M - w / 2, y + 46);
    ctx.textAlign = 'left';
  }
  return y + 76;
}
// a linha do escritório embaixo; devolve onde terminou
export function rodape(ctx, y, f) {
  ctx.strokeStyle = COR.linha; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(M, y); ctx.lineTo(LARGURA - M, y); ctx.stroke();
  ctx.fillStyle = COR.cinza; fonte(ctx, 500, 22, f.texto); ctx.textAlign = 'center';
  ctx.fillText(ESCRITORIO, LARGURA / 2, y + 42);
  ctx.textAlign = 'left';
  return y + 42 + 40;
}

// mede e pinta: um canvas do tamanho certo. pintar(ctx, o) desenha e devolve { altura, ... }; na segunda vez, recebe
// também o que a primeira mediu (o.medidas) e a altura do canvas (o.altura)
export function desenhar(pintar, o, doc) {
  const rasc = doc.createElement('canvas');
  rasc.width = LARGURA; rasc.height = 10;
  const m = pintar(rasc.getContext('2d'), o);
  const c = doc.createElement('canvas');
  c.width = LARGURA; c.height = Math.ceil(m.altura);
  pintar(c.getContext('2d'), { ...o, medidas: m, altura: c.height });
  return c;
}

// a imagem que passou da ALTURA_MAX é reduzida por inteiro até caber: fica um pouco mais estreita, nunca cortada. Acontece
// quando a letra do sistema não carregou (sem a internet do Google Fonts) e a de reserva, mais larga, quebra mais linhas
export function caber(canvas, doc) {
  if (canvas.height <= ALTURA_MAX) return canvas;
  const c = doc.createElement('canvas');
  c.height = ALTURA_MAX; c.width = Math.round(canvas.width * ALTURA_MAX / canvas.height);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, 0, 0, c.width, c.height);
  return c;
}

export function paraBlob(canvas, tipo = 'image/png') {
  return new Promise((res, rej) => canvas.toBlob(b => (b ? res(b) : rej(new Error('O navegador não gerou a imagem.'))), tipo));
}
