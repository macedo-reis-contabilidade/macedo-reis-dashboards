// ============================================================================
// MACEDO & REIS — As imagens dos planos do MEI pro WhatsApp (24/11/2026, pedido do Samuel): a primeira com os planos e a
// recomendação ("qual o melhor pra ele"), as outras com tudo o que cada plano inclui (a lista completa). Desenhadas num
// canvas de 1080 px de largura, com o azul e o champanhe da logo e a letra do sistema (Fraunces nos títulos, Manrope no
// texto). Os textos e as contas vêm de mei-planos.js (montarVitrine); aqui só se desenha.
//
// Nenhuma imagem passa de 1600 px de altura (ALTURA_MAX): na qualidade padrão, o WhatsApp reduz a foto até o lado maior
// ficar com uns 1600 px, e a lista inteira numa imagem só (2.800 px) chegava com a letra miúda no celular. Até 1600, a
// imagem chega como saiu e cabe na tela. Por isso a lista vai em páginas parecidas (paginar), cada uma com o mesmo alto
// (o título, o nome e o preço de cada plano), o "Continua na próxima imagem." e a conta "2/4" no canto; e a primeira
// mostra menos do que cada plano tem a mais quando não cabe (3, 2, 1...). Cada desenho roda duas vezes: a primeira mede
// (a altura, o fim da tabela), a segunda pinta no canvas do tamanho certo.
// ============================================================================
import { reaisCurto, precoAParte, primeiroNome, ESCRITORIO } from './mei-planos.js';

export const LARGURA = 1080;
export const ALTURA_MAX = 1600;
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
// a logo e o nome do escritório e, no canto, qual imagem é ("2/4"); devolve onde terminou
function cabecalho(ctx, y, logo, f, pagina) {
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
// a linha do escritório embaixo (o registro no CRC, que toda peça leva); devolve onde terminou
function rodape(ctx, y, f) {
  ctx.strokeStyle = COR.linha; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(M, y); ctx.lineTo(LARGURA - M, y); ctx.stroke();
  ctx.fillStyle = COR.cinza; fonte(ctx, 500, 22, f.texto); ctx.textAlign = 'center';
  ctx.fillText(ESCRITORIO, LARGURA / 2, y + 42);
  ctx.textAlign = 'left';
  return y + 42 + 40;
}

// ---------- a primeira imagem: os planos, do mais simples pro mais completo, com o recomendado em destaque ----------
function pintarCapa(ctx, v, o) {
  const f = o.fontes || FONTES;
  const rec = new Set(o.recomendados || []);
  const pn = primeiroNome(o.nome);
  const maxD = o.maxDestaques == null ? 3 : o.maxDestaques;
  ctx.fillStyle = COR.fundo; ctx.fillRect(0, 0, LARGURA, o.altura || 6000);
  let y = cabecalho(ctx, 56, o.logo, f, o.pagina) + 44;
  ctx.fillStyle = COR.tinta; fonte(ctx, 600, 62, f.titulo);
  y = escrever(ctx, quebrar(ctx, 'Planos para o seu MEI', LARGURA - 2 * M), M, y, 62, 70) + 12;
  ctx.fillStyle = COR.cinza; fonte(ctx, 400, 28, f.texto);
  const sub = (pn ? pn + ', escolha' : 'Escolha') + ' o plano que combina com o momento do seu negócio.';
  y = escrever(ctx, quebrar(ctx, sub, LARGURA - 2 * M), M, y, 28, 38) + 32;

  const W = LARGURA - 2 * M, PAD = 30, COLP = 250;
  const estreita = W - 2 * PAD - COLP - 20;      // ao lado do preço
  const larga = W - 2 * PAD;                     // embaixo dele
  const ALT_PRECO = 96;                          // o preço e o "por mês" terminam aqui
  for (const p of v.planos) {
    const eRec = rec.has(p.id);
    fonte(ctx, 700, 38, f.texto); const ln = quebrar(ctx, p.nome, estreita);
    fonte(ctx, 400, 26, f.texto); const ls = p.slogan ? quebrar(ctx, p.slogan, estreita) : [];
    const hTopo = ln.length * 46 + (ls.length ? 6 + ls.length * 34 : 0);
    // o que ele tem a mais começa embaixo do preço, com a largura toda; com o nome e o pra quem é curtos, ao lado dele
    const dLarg = (hTopo + 18 >= ALT_PRECO ? larga : estreita) - 44;
    fonte(ctx, 500, 26, f.texto); const ld = p.destaques.slice(0, maxD).map(d => quebrar(ctx, d, dLarg));
    const hD = ld.length ? 18 + ld.reduce((s, l) => s + l.length * 34 + 8, 0) - 8 : 0;
    const topoRec = eRec ? 58 : 0;
    const h = PAD + topoRec + Math.max(hTopo + hD, ALT_PRECO) + PAD;

    caixa(ctx, M, y, W, h, 28);
    ctx.fillStyle = eRec ? COR.champClaro : COR.cartao; ctx.fill();
    ctx.lineWidth = eRec ? 5 : 2; ctx.strokeStyle = eRec ? COR.champ : COR.linha; ctx.stroke();
    let yy = y + PAD;
    if (eRec) {
      fonte(ctx, 700, 22, f.texto);
      const t = 'Recomendado pra você', tw = ctx.measureText(t).width;
      caixa(ctx, M + PAD, yy, tw + 40, 42, 21); ctx.fillStyle = COR.champ; ctx.fill();
      ctx.fillStyle = COR.champTinta; ctx.fillText(t, M + PAD + 20, yy + 29);
      yy += topoRec;
    }
    // o preço, na coluna da direita
    const xr = M + W - PAD;
    ctx.textAlign = 'right';
    ctx.fillStyle = COR.azul; fonte(ctx, 700, 58, f.texto); ctx.fillText(reaisCurto(p.valor), xr, yy + 52);
    ctx.fillStyle = COR.cinza; fonte(ctx, 500, 24, f.texto); ctx.fillText('por mês', xr, yy + 86);
    ctx.textAlign = 'left';
    // o nome, o pra quem é e o que ele tem a mais
    ctx.fillStyle = COR.tinta; fonte(ctx, 700, 38, f.texto);
    let ye = escrever(ctx, ln, M + PAD, yy, 38, 46);
    if (ls.length) { ctx.fillStyle = COR.cinza; fonte(ctx, 400, 26, f.texto); ye = escrever(ctx, ls, M + PAD, ye + 6, 26, 34); }
    if (ld.length) {
      ye += 18;
      fonte(ctx, 500, 26, f.texto);
      ld.forEach((linhas, i) => {
        marca(ctx, M + PAD + 15, ye + 17, 15);
        ctx.fillStyle = COR.tinta;
        ye = escrever(ctx, linhas, M + PAD + 44, ye, 26, 34) + (i < ld.length - 1 ? 8 : 0);
      });
    }
    y += h + 20;
  }

  y += 6;
  if (v.comuns) {
    ctx.fillStyle = COR.tinta; fonte(ctx, 600, 26, f.texto);
    y = escrever(ctx, quebrar(ctx, 'Todos os planos incluem ' + v.comuns + '.', LARGURA - 2 * M), M, y, 26, 36) + 8;
  }
  const total = o.pagina ? o.pagina.total : 2;
  if (total > 1) {
    ctx.fillStyle = COR.cinza; fonte(ctx, 400, 24, f.texto);
    const prox = total > 2 ? 'Nas próximas imagens, tudo o que cada plano inclui.' : 'Na próxima imagem, tudo o que cada plano inclui.';
    y = escrever(ctx, quebrar(ctx, prox, LARGURA - 2 * M), M, y, 24, 32);
  }
  return { altura: rodape(ctx, y + 30, f) };
}

// ---------- as outras imagens: a lista completa, com o ✓ de cada plano, em páginas ----------
// a geometria da tabela: a coluna de cada plano e a largura do nome do serviço
function geometria(v) {
  const n = Math.max(1, v.planos.length);
  const colW = Math.min(140, Math.floor((LARGURA - 2 * M - 440) / n));
  const x0 = LARGURA - M - colW * n;
  return { colW, x0, nomeW: x0 - M - 24, cx: i => x0 + colW * i + colW / 2 };
}
// o nome do grupo ("Todo mês"); devolve onde terminou
function pintarGrupo(ctx, rotulo, y, f) {
  y += 20;
  ctx.textAlign = 'left';
  ctx.fillStyle = COR.azulEscuro; fonte(ctx, 700, 28, f.texto);
  ctx.fillText(rotulo, M, y + 24);
  return y + 42;
}
// a linha de um serviço, com o ✓ ou o traço de cada plano; devolve onde terminou
function pintarLinha(ctx, l, y, g, f) {
  fonte(ctx, 500, 26, f.texto);
  const ln = quebrar(ctx, l.nome, g.nomeW);
  const h = Math.max(ln.length * 34, 36) + 22;
  ctx.strokeStyle = COR.linha; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(M, y); ctx.lineTo(LARGURA - M, y); ctx.stroke();
  ctx.fillStyle = COR.tinta; ctx.textAlign = 'left';
  escrever(ctx, ln, M, y + (h - ln.length * 34) / 2, 26, 34);
  l.em.forEach((tem, i) => { if (tem) marca(ctx, g.cx(i), y + h / 2, 18); else nada(ctx, g.cx(i), y + h / 2); });
  return y + h;
}
// o fim da última página: o que é cobrado à parte e a nota dos valores; devolve onde terminou
function pintarAParte(ctx, v, y, f) {
  y += 44;
  if (v.aParte && v.aParte.length) {
    ctx.textAlign = 'left';
    ctx.fillStyle = COR.tinta; fonte(ctx, 700, 28, f.texto);
    ctx.fillText('Cobrado à parte', M, y + 22);
    y += 44;
    fonte(ctx, 400, 25, f.texto);
    for (const it of v.aParte) {
      const preco = precoAParte(it);
      const ln = quebrar(ctx, it.nome + (preco ? ': ' + preco : ''), LARGURA - 2 * M - 30);
      ctx.fillStyle = COR.azul; ctx.beginPath(); ctx.arc(M + 7, y + 14, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = COR.tinta;
      y = escrever(ctx, ln, M + 30, y, 25, 34) + 6;
    }
    y += 12;
  }
  ctx.fillStyle = COR.cinza; fonte(ctx, 400, 22, f.texto);
  y = escrever(ctx, quebrar(ctx, 'Valores por mês. O que não está no plano escolhido é orçado à parte.', LARGURA - 2 * M), M, y, 22, 30);
  return y + 28;
}
// o fim das outras páginas; devolve onde terminou
function pintarContinua(ctx, y, f) {
  ctx.textAlign = 'left';
  ctx.fillStyle = COR.cinza; fonte(ctx, 600, 24, f.texto);
  ctx.fillText('Continua na próxima imagem.', M, y + 52);
  return y + 30 + 32 + 26;
}
// uma página da lista: o alto (a logo, o título, o nome e o preço de cada plano), os blocos dela e o fim
function pintarLista(ctx, v, o) {
  const f = o.fontes || FONTES;
  const rec = new Set(o.recomendados || []);
  const med = o.medidas || {};
  const g = geometria(v);
  ctx.fillStyle = COR.fundo; ctx.fillRect(0, 0, LARGURA, o.altura || 8000);
  let y = cabecalho(ctx, 56, o.logo, f, o.pagina) + 40;
  ctx.fillStyle = COR.tinta; fonte(ctx, 600, 52, f.titulo);
  y = escrever(ctx, quebrar(ctx, 'Tudo o que cada plano inclui', LARGURA - 2 * M), M, y, 52, 60) + 28;
  const topoTabela = y;

  // a coluna do recomendado, por baixo de tudo (o tamanho vem da medida)
  if (med.tabelaBase) {
    v.planos.forEach((p, i) => {
      if (!rec.has(p.id)) return;
      caixa(ctx, g.x0 + g.colW * i + 6, topoTabela - 12, g.colW - 12, med.tabelaBase - topoTabela + 24, 22);
      ctx.fillStyle = COR.champClaro; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = COR.champ; ctx.stroke();
    });
  }
  // o título das colunas: o nome curto e, embaixo, o preço e o "por mês" (numa linha só não cabia na coluna)
  fonte(ctx, 700, 24, f.texto);
  const nomes = v.planos.map(p => quebrar(ctx, p.curto, g.colW - 14));
  const altNome = Math.max(1, ...nomes.map(l => l.length)) * 30;
  v.planos.forEach((p, i) => {
    ctx.textAlign = 'center';
    ctx.fillStyle = COR.tinta; fonte(ctx, 700, 24, f.texto);
    escrever(ctx, nomes[i], g.cx(i), y + (altNome - nomes[i].length * 30), 24, 30);
    ctx.fillStyle = COR.azul; fonte(ctx, 700, 26, f.texto);
    ctx.fillText(reaisCurto(p.valor), g.cx(i), y + altNome + 34);
    ctx.fillStyle = COR.cinza; fonte(ctx, 500, 19, f.texto);
    ctx.fillText('por mês', g.cx(i), y + altNome + 58);
    ctx.textAlign = 'left';
  });
  y += altNome + 74;
  const inicio = y;

  let ultima = false;
  for (const b of (o.blocos || [])) {
    if (b.tipo === 'grupo') y = pintarGrupo(ctx, b.continua ? b.rotulo + ' (continuação)' : b.rotulo, y, f);
    else if (b.tipo === 'linha') y = pintarLinha(ctx, b.l, y, g, f);
    else if (b.tipo === 'aParte') ultima = true;
  }
  ctx.strokeStyle = COR.linha; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(M, y); ctx.lineTo(LARGURA - M, y); ctx.stroke();
  const tabelaBase = y;
  y = ultima ? pintarAParte(ctx, v, y, f) : pintarContinua(ctx, y, f);
  return { altura: rodape(ctx, y, f), tabelaBase, inicio };
}

// os blocos da lista em páginas (puro: os blocos só com a altura). O nome do grupo vai junto com a primeira linha dele;
// o grupo que continua na página seguinte ganha o nome de novo, com o "(continuação)" (hGrupo, a altura do nome).
export function empacotar(blocos, cap, hGrupo) {
  const paginas = [];
  let atual = null, usado = 0;
  const nova = () => { atual = []; paginas.push(atual); usado = 0; };
  nova();
  blocos.forEach((b, i) => {
    const prox = blocos[i + 1];
    const precisa = b.h + (b.tipo === 'grupo' && prox && prox.tipo === 'linha' ? prox.h : 0);
    if (atual.length && usado + precisa > cap) {
      nova();
      if (b.tipo === 'linha') { atual.push({ tipo: 'grupo', rotulo: b.rotulo, h: hGrupo, continua: true }); usado += hGrupo; }
    }
    atual.push(b); usado += b.h;
  });
  return paginas;
}
// quantas páginas precisa (com a altura que cabe, cap) e, com esse número, a menor altura que ainda dá: as páginas ficam
// parecidas, em vez de uma cheia e a última com duas linhas
export function paginar(blocos, cap, hGrupo) {
  if (!blocos.length) return [[]];
  const base = empacotar(blocos, cap, hGrupo);
  if (base.length <= 1) return base;
  let lo = Math.max(...blocos.map(b => b.h + (b.tipo === 'linha' ? hGrupo : 0))), hi = cap;
  if (lo > hi) return base;
  while (lo < hi) {
    const meio = Math.floor((lo + hi) / 2);
    if (empacotar(blocos, meio, hGrupo).length <= base.length) hi = meio; else lo = meio + 1;
  }
  const parecidas = empacotar(blocos, lo, hGrupo);
  return parecidas.length <= base.length ? parecidas : base;
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

// as páginas da lista: os blocos (o nome de cada grupo, cada linha e o que é cobrado à parte) medidos num rascunho e
// distribuídos de modo que nenhuma página passe da ALTURA_MAX
function paginasDaLista(v, o, doc) {
  const f = o.fontes;
  const ctx = doc.createElement('canvas').getContext('2d');
  const g = geometria(v);
  const alto = pintarLista(ctx, v, { ...o, blocos: [] }).inicio;
  const fim = pintarContinua(ctx, 0, f) + rodape(ctx, 0, f);
  const hGrupo = pintarGrupo(ctx, 'Todo mês', 0, f);
  const blocos = [];
  v.grupos.forEach(gr => {
    blocos.push({ tipo: 'grupo', rotulo: gr.rotulo, h: hGrupo });
    gr.linhas.forEach(l => blocos.push({ tipo: 'linha', rotulo: gr.rotulo, l, h: pintarLinha(ctx, l, 0, g, f) }));
  });
  blocos.push({ tipo: 'aParte', h: pintarAParte(ctx, v, 0, f) });
  return paginar(blocos, ALTURA_MAX - alto - fim, hGrupo);
}

// a primeira imagem com o que cada plano tem a mais (até 3); sem caber na ALTURA_MAX, com menos
function desenharCapa(v, o, doc) {
  let c = null;
  for (const maxDestaques of [3, 2, 1, 0]) {
    c = desenhar(pintarCapa, v, { ...o, maxDestaques }, doc);
    if (c.height <= ALTURA_MAX) break;
  }
  return c;
}

// as imagens, na ordem de mandar: [a dos planos, as da lista...] (canvas de LARGURA px).
// opc: { recomendados: [ids], nome, logo (Image carregada), fontes }
export async function imagensDosPlanos(vitrine, opc = {}, doc = document) {
  await carregarFontes(doc);
  const o = { ...opc, fontes: opc.fontes || FONTES };
  const paginas = paginasDaLista(vitrine, o, doc);
  const total = 1 + paginas.length;
  const capa = desenharCapa(vitrine, { ...o, pagina: { n: 1, total } }, doc);
  const lista = paginas.map((blocos, i) => desenhar(pintarLista, vitrine, { ...o, blocos, pagina: { n: i + 2, total } }, doc));
  return [capa, ...lista];
}

export function paraBlob(canvas, tipo = 'image/png') {
  return new Promise((res, rej) => canvas.toBlob(b => (b ? res(b) : rej(new Error('O navegador não gerou a imagem.'))), tipo));
}
