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
import { reaisCurto, precoAParte, primeiroNome } from './mei-planos.js';
import { LARGURA, ALTURA_MAX, M, COR, FONTES, carregarFontes, fonte, quebrar, escrever, caixa, marca, cabecalho, rodape, desenhar as desenharBase,
  paraBlob } from './imagens-whats.js';

// a base comum (o tamanho, as cores, as letras, o cabeçalho, o rodapé) mora em imagens-whats.js; o que é da lista dos
// planos fica aqui. LARGURA, ALTURA_MAX, FONTES, carregarFontes e paraBlob seguem exportados daqui, pra quem já os lia.
export { LARGURA, ALTURA_MAX, FONTES, carregarFontes, paraBlob };

// o traço do que não está no plano
function nada(ctx, cx, cy) {
  ctx.strokeStyle = COR.apagado; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - 10, cy); ctx.lineTo(cx + 10, cy); ctx.stroke();
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

// mede e pinta: um canvas do tamanho certo (o da base, com a vitrine)
const desenhar = (pintar, v, o, doc) => desenharBase((ctx, oo) => pintar(ctx, v, oo), o, doc);

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

