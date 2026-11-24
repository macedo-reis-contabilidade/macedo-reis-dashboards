// ============================================================================
// MACEDO & REIS — As duas imagens dos planos do MEI pro WhatsApp (24/11/2026, pedido do Samuel): a primeira com os planos
// e a recomendação ("qual o melhor pra ele"), a segunda com tudo o que cada plano inclui (a lista completa). Desenhadas num
// canvas de 1080 px de largura, o tamanho que o WhatsApp e o Instagram mostram sem cortar, com o azul e o champanhe da
// logo e a letra do sistema (Fraunces nos títulos, Manrope no texto). Os textos e as contas vêm de mei-planos.js
// (montarVitrine); aqui só se desenha. Cada desenho roda duas vezes: a primeira mede (a altura, o fim da tabela), a
// segunda pinta no canvas do tamanho certo.
// ============================================================================
import { reaisCurto, precoAParte, primeiroNome, ESCRITORIO } from './mei-planos.js';

export const LARGURA = 1080;
const M = 64;                    // a margem dos lados
const COR = {
  fundo: '#FFFFFF', cartao: '#F2F6FA', linha: '#D5DEE8', tinta: '#1A2330', cinza: '#55606E', apagado: '#B4BFCB',
  azul: '#3A70B4', azulEscuro: '#2C5A96', champ: '#E3A75F', champClaro: '#FFF5EA', champTinta: '#2A1A06'
};
export const FONTES = {
  titulo: "'Fraunces', Georgia, 'Times New Roman', serif",
  texto: "'Manrope', 'Helvetica Neue', Arial, sans-serif"
};

// a letra do sistema vem do Google Fonts (o style.css): o canvas só usa a que já carregou, então pede antes, com prazo
export async function carregarFontes(doc = (typeof document !== 'undefined' ? document : null), ms = 2500) {
  if (!doc || !doc.fonts || !doc.fonts.load) return;
  const pedidos = ['600 64px Fraunces', '700 38px Manrope', '600 24px Manrope', '500 24px Manrope', '400 24px Manrope']
    .map(f => doc.fonts.load(f).catch(() => null));
  await Promise.race([Promise.all(pedidos), new Promise(r => setTimeout(r, ms))]);
}

const fonte = (ctx, peso, tam, fam) => { ctx.font = `${peso} ${tam}px ${fam}`; };

// as palavras e, dentro de cada uma, os pedaços depois de cada barra: "notas/faturamento/produtos" quebra na barra, sem
// espaço, em vez de passar por cima da coluna do lado
function pedacos(t) {
  const out = [];
  String(t || '').split(/\s+/).filter(Boolean).forEach(w => w.split(/(?<=\/)/).forEach((p, i) => out.push({ p, cola: i > 0 })));
  return out;
}
// as linhas de um texto que cabem na largura (o pedaço maior que a largura fica sozinho na linha)
function quebrar(ctx, t, larg) {
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
function escrever(ctx, linhas, x, y, tam, alt) {
  linhas.forEach((l, i) => ctx.fillText(l, x, y + Math.round(tam * 0.8) + i * alt));
  return y + linhas.length * alt;
}
function caixa(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
// o ✓ do serviço que está no plano: o círculo azul com o traço branco
function marca(ctx, cx, cy, r) {
  ctx.fillStyle = COR.azul;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = Math.max(2, r * 0.22); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(cx - r * 0.45, cy + r * 0.02); ctx.lineTo(cx - r * 0.12, cy + r * 0.34); ctx.lineTo(cx + r * 0.48, cy - r * 0.3); ctx.stroke();
}
// o traço do que não está no plano
function nada(ctx, cx, cy) {
  ctx.strokeStyle = COR.apagado; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - 10, cy); ctx.lineTo(cx + 10, cy); ctx.stroke();
}
// "CONTABILIDADE" espaçado, como no folder
function espacado(ctx, t, x, y, esp) {
  if ('letterSpacing' in ctx) {
    const antes = ctx.letterSpacing;
    ctx.letterSpacing = esp + 'px'; ctx.fillText(t, x, y); ctx.letterSpacing = antes;
    return;
  }
  let xx = x;
  for (const ch of t) { ctx.fillText(ch, xx, y); xx += ctx.measureText(ch).width + esp; }
}
// a logo e o nome do escritório; devolve onde terminou
function cabecalho(ctx, y, logo, f) {
  let x = M;
  if (logo && logo.naturalWidth) { ctx.drawImage(logo, M, y, 76, 76); x = M + 76 + 22; }
  ctx.textAlign = 'left';
  ctx.fillStyle = COR.tinta; fonte(ctx, 600, 34, f.titulo);
  ctx.fillText('Macedo & Reis', x, y + 36);
  ctx.fillStyle = COR.cinza; fonte(ctx, 600, 19, f.texto);
  espacado(ctx, 'CONTABILIDADE', x, y + 66, 4.5);
  return y + 76;
}
// a linha do escritório embaixo (o registro no CRC, que toda peça leva); devolve onde terminou
function rodape(ctx, y, f) {
  ctx.strokeStyle = COR.linha; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(M, y); ctx.lineTo(LARGURA - M, y); ctx.stroke();
  ctx.fillStyle = COR.cinza; fonte(ctx, 500, 22, f.texto); ctx.textAlign = 'center';
  ctx.fillText(ESCRITORIO, LARGURA / 2, y + 44);
  ctx.textAlign = 'left';
  return y + 44 + 42;
}

// ---------- a primeira imagem: os planos, do mais simples pro mais completo, com o recomendado em destaque ----------
function pintarCapa(ctx, v, o) {
  const f = o.fontes || FONTES;
  const rec = new Set(o.recomendados || []);
  const pn = primeiroNome(o.nome);
  ctx.fillStyle = COR.fundo; ctx.fillRect(0, 0, LARGURA, o.altura || 6000);
  let y = cabecalho(ctx, 64, o.logo, f) + 56;
  ctx.fillStyle = COR.tinta; fonte(ctx, 600, 64, f.titulo);
  y = escrever(ctx, quebrar(ctx, 'Planos para o seu MEI', LARGURA - 2 * M), M, y, 64, 72) + 14;
  ctx.fillStyle = COR.cinza; fonte(ctx, 400, 29, f.texto);
  const sub = (pn ? pn + ', escolha' : 'Escolha') + ' o plano que combina com o momento do seu negócio.';
  y = escrever(ctx, quebrar(ctx, sub, LARGURA - 2 * M), M, y, 29, 40) + 40;

  const W = LARGURA - 2 * M, PAD = 36, COLP = 250;
  const larg = W - 2 * PAD - COLP - 20;
  for (const p of v.planos) {
    const eRec = rec.has(p.id);
    fonte(ctx, 700, 38, f.texto); const ln = quebrar(ctx, p.nome, larg);
    fonte(ctx, 400, 26, f.texto); const ls = p.slogan ? quebrar(ctx, p.slogan, larg) : [];
    fonte(ctx, 500, 25, f.texto); const ld = p.destaques.map(d => quebrar(ctx, d, larg - 46));
    const topoRec = eRec ? 64 : 0;
    const hEsq = ln.length * 46 + (ls.length ? 6 + ls.length * 36 : 0) + (ld.length ? 20 + ld.reduce((s, l) => s + l.length * 34 + 10, 0) - 10 : 0);
    const h = PAD + topoRec + Math.max(hEsq, 104) + PAD;

    caixa(ctx, M, y, W, h, 28);
    ctx.fillStyle = eRec ? COR.champClaro : COR.cartao; ctx.fill();
    ctx.lineWidth = eRec ? 5 : 2; ctx.strokeStyle = eRec ? COR.champ : COR.linha; ctx.stroke();
    let yy = y + PAD;
    if (eRec) {
      fonte(ctx, 700, 22, f.texto);
      const t = 'Recomendado pra você', tw = ctx.measureText(t).width;
      caixa(ctx, M + PAD, yy, tw + 40, 44, 22); ctx.fillStyle = COR.champ; ctx.fill();
      ctx.fillStyle = COR.champTinta; ctx.fillText(t, M + PAD + 20, yy + 30);
      yy += topoRec;
    }
    // o preço, na coluna da direita
    const xr = M + W - PAD;
    ctx.textAlign = 'right';
    ctx.fillStyle = COR.azul; fonte(ctx, 700, 58, f.texto); ctx.fillText(reaisCurto(p.valor), xr, yy + 52);
    ctx.fillStyle = COR.cinza; fonte(ctx, 500, 24, f.texto); ctx.fillText('por mês', xr, yy + 88);
    ctx.textAlign = 'left';
    // o nome, o pra quem é e o que ele tem a mais
    ctx.fillStyle = COR.tinta; fonte(ctx, 700, 38, f.texto);
    let ye = escrever(ctx, ln, M + PAD, yy, 38, 46);
    if (ls.length) { ctx.fillStyle = COR.cinza; fonte(ctx, 400, 26, f.texto); ye = escrever(ctx, ls, M + PAD, ye + 6, 26, 36); }
    if (ld.length) {
      ye += 20;
      fonte(ctx, 500, 25, f.texto);
      ld.forEach((linhas, i) => {
        marca(ctx, M + PAD + 15, ye + 17, 15);
        ctx.fillStyle = COR.tinta;
        ye = escrever(ctx, linhas, M + PAD + 46, ye, 25, 34) + (i < ld.length - 1 ? 10 : 0);
      });
    }
    y += h + 26;
  }

  y += 10;
  if (v.comuns) {
    ctx.fillStyle = COR.tinta; fonte(ctx, 600, 26, f.texto);
    y = escrever(ctx, quebrar(ctx, 'Todos os planos incluem ' + v.comuns + '.', LARGURA - 2 * M), M, y, 26, 36) + 10;
  }
  ctx.fillStyle = COR.cinza; fonte(ctx, 400, 24, f.texto);
  y = escrever(ctx, quebrar(ctx, 'Na próxima imagem, tudo o que cada plano inclui.', LARGURA - 2 * M), M, y, 24, 34) + 34;
  return { altura: rodape(ctx, y, f) };
}

// ---------- a segunda imagem: a lista completa, com o ✓ de cada plano ----------
function pintarLista(ctx, v, o) {
  const f = o.fontes || FONTES;
  const rec = new Set(o.recomendados || []);
  const med = o.medidas || {};
  ctx.fillStyle = COR.fundo; ctx.fillRect(0, 0, LARGURA, o.altura || 8000);
  let y = cabecalho(ctx, 64, o.logo, f) + 52;
  ctx.fillStyle = COR.tinta; fonte(ctx, 600, 54, f.titulo);
  y = escrever(ctx, quebrar(ctx, 'Tudo o que cada plano inclui', LARGURA - 2 * M), M, y, 54, 62) + 34;

  const n = Math.max(1, v.planos.length);
  const colW = Math.min(150, Math.floor((LARGURA - 2 * M - 420) / n));
  const x0 = LARGURA - M - colW * n;
  const nomeW = x0 - M - 24;
  const cx = i => x0 + colW * i + colW / 2;
  const topoTabela = y;

  // a coluna do recomendado, por baixo de tudo (o tamanho vem da medida)
  if (med.tabelaBase) {
    v.planos.forEach((p, i) => {
      if (!rec.has(p.id)) return;
      caixa(ctx, x0 + colW * i + 6, topoTabela - 12, colW - 12, med.tabelaBase - topoTabela + 24, 22);
      ctx.fillStyle = COR.champClaro; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = COR.champ; ctx.stroke();
    });
  }
  // o título das colunas: o nome curto e o preço
  fonte(ctx, 700, 23, f.texto);
  const nomes = v.planos.map(p => quebrar(ctx, p.curto, colW - 16));
  const altNome = Math.max(...nomes.map(l => l.length), 1) * 29;
  v.planos.forEach((p, i) => {
    ctx.textAlign = 'center';
    ctx.fillStyle = COR.tinta; fonte(ctx, 700, 23, f.texto);
    escrever(ctx, nomes[i], cx(i), y + (altNome - nomes[i].length * 29), 23, 29);
    ctx.fillStyle = COR.azul; fonte(ctx, 700, 22, f.texto);
    ctx.fillText(reaisCurto(p.valor) + '/mês', cx(i), y + altNome + 30);
    ctx.textAlign = 'left';
  });
  y += altNome + 48;

  for (const g of v.grupos) {
    y += 22;
    ctx.fillStyle = COR.azulEscuro; fonte(ctx, 700, 26, f.texto);
    ctx.fillText(g.rotulo, M, y + 22);
    y += 40;
    for (const l of g.linhas) {
      fonte(ctx, 500, 24, f.texto);
      const ln = quebrar(ctx, l.nome, nomeW);
      const h = Math.max(ln.length * 32, 34) + 24;
      ctx.strokeStyle = COR.linha; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(M, y); ctx.lineTo(LARGURA - M, y); ctx.stroke();
      ctx.fillStyle = COR.tinta;
      escrever(ctx, ln, M, y + (h - ln.length * 32) / 2, 24, 32);
      l.em.forEach((tem, i) => { if (tem) marca(ctx, cx(i), y + h / 2, 17); else nada(ctx, cx(i), y + h / 2); });
      y += h;
    }
  }
  ctx.strokeStyle = COR.linha; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(M, y); ctx.lineTo(LARGURA - M, y); ctx.stroke();
  const tabelaBase = y;

  y += 50;
  if (v.aParte && v.aParte.length) {
    ctx.fillStyle = COR.tinta; fonte(ctx, 700, 28, f.texto);
    ctx.fillText('Cobrado à parte', M, y + 22);
    y += 46;
    fonte(ctx, 400, 24, f.texto);
    for (const it of v.aParte) {
      const preco = precoAParte(it);
      const ln = quebrar(ctx, it.nome + (preco ? ': ' + preco : ''), LARGURA - 2 * M - 30);
      ctx.fillStyle = COR.azul; ctx.beginPath(); ctx.arc(M + 7, y + 17, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = COR.tinta;
      y = escrever(ctx, ln, M + 30, y, 24, 33) + 8;
    }
    y += 12;
  }
  ctx.fillStyle = COR.cinza; fonte(ctx, 400, 22, f.texto);
  y = escrever(ctx, quebrar(ctx, 'Valores por mês. O que não está no plano escolhido é orçado à parte.', LARGURA - 2 * M), M, y, 22, 31) + 30;
  return { altura: rodape(ctx, y, f), tabelaBase };
}

// mede e pinta: um canvas do tamanho certo
function desenhar(pintar, v, o, doc) {
  const rasc = doc.createElement('canvas');
  rasc.width = LARGURA; rasc.height = 10;
  const m = pintar(rasc.getContext('2d'), v, o);
  const c = doc.createElement('canvas');
  c.width = LARGURA; c.height = Math.ceil(m.altura);
  pintar(c.getContext('2d'), v, { ...o, medidas: m, altura: c.height });
  return c;
}

// as duas imagens: { capa, lista } (canvas). opc: { recomendados: [ids], nome, logo (Image carregada), fontes }
export async function imagensDosPlanos(vitrine, opc = {}, doc = document) {
  await carregarFontes(doc);
  const o = { ...opc, fontes: opc.fontes || FONTES };
  return { capa: desenhar(pintarCapa, vitrine, o, doc), lista: desenhar(pintarLista, vitrine, o, doc) };
}

export function paraBlob(canvas, tipo = 'image/png') {
  return new Promise((res, rej) => canvas.toBlob(b => (b ? res(b) : rej(new Error('O navegador não gerou a imagem.'))), tipo));
}
