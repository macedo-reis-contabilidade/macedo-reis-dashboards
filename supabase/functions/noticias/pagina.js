// ============================================================
// MACEDO & REIS — Feed de notícias: o texto da página da notícia (20/10/2026)
// O RSS costuma trazer só o título e uma linha; pra IA entender a notícia, a coleta abre a página e tira o texto:
// textoDaPagina(html) → { titulo, descricao, data, texto } — o título (og:title ou <title>), a descrição (og/meta), a data
// de publicação (article:published_time ou datePublished), e os parágrafos do miolo (o maior bloco de parágrafos
// seguidos — maiorBloco), sem menu, rodapé, script e estilo. Puro — testes em tests/noticias.test.mjs.
// ============================================================
import { semTags, decodificar, dataIso } from './rss.js';

function meta(html, nome) {
  for (const m of String(html).matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    const chave = /\s(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i.exec(tag);
    if (!chave || chave[1].toLowerCase() !== nome) continue;
    const v = /\scontent\s*=\s*("([^"]*)"|'([^']*)')/i.exec(tag);
    if (v) return decodificar(v[2] != null ? v[2] : v[3]).trim();
  }
  return null;
}
function regiao(html, tag) {
  const ini = new RegExp('<' + tag + '\\b[^>]*>', 'i').exec(html);
  if (!ini) return null;
  const fim = html.toLowerCase().lastIndexOf('</' + tag);
  return fim > ini.index ? html.slice(ini.index + ini[0].length, fim) : null;
}
// o miolo: o maior bloco de parágrafos seguidos — o texto da notícia. As listas de "leia também" e "mais lidas" são
// títulos curtos (li, h3) e quase nunca parágrafos longos, então perdem; o bloco é medido só pelo texto dos <p>.
// Entre um parágrafo e o próximo do mesmo bloco cabem até 3 mil caracteres de marcação (imagem, anúncio, citação).
const GAP_BLOCO = 3000;
function maiorBloco(corpo) {
  const itens = [];
  for (const m of corpo.matchAll(/<(p|li|h2|h3|h4|blockquote)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi)) {
    const tag = m[1].toLowerCase(), t = semTags(m[2]).replace(/\s+/g, ' ').trim();
    const par = tag === 'p' || tag === 'blockquote';
    if (t.length >= (par ? 40 : 25)) itens.push({ ini: m.index, fim: m.index + m[0].length, t, par });
  }
  const peso = b => b.reduce((s, x) => s + (x.par ? x.t.length : 0), 0);
  let melhor = [], atual = [];
  for (const x of itens) {
    if (atual.length && x.ini - atual[atual.length - 1].fim > GAP_BLOCO) { if (peso(atual) > peso(melhor)) melhor = atual; atual = []; }
    atual.push(x);
  }
  if (peso(atual) > peso(melhor)) melhor = atual;
  // as pontas que não são parágrafo (o título da lista ao lado, um "leia também" colado) ficam de fora
  while (melhor.length && !melhor[0].par) melhor = melhor.slice(1);
  while (melhor.length && !melhor[melhor.length - 1].par) melhor = melhor.slice(0, -1);
  const vistos = new Set();
  return melhor.filter(x => !vistos.has(x.t) && vistos.add(x.t)).map(x => x.t);
}
export function textoDaPagina(html, { max = 6000 } = {}) {
  let s = String(html || '');
  const titulo = meta(s, 'og:title') || (/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(s) || [])[1] || '';
  const descricao = meta(s, 'og:description') || meta(s, 'description') || null;
  const ld = /"datePublished"\s*:\s*"([^"]+)"/i.exec(s);
  const data = dataIso(meta(s, 'article:published_time') || (ld && ld[1]) || meta(s, 'date') || meta(s, 'dc.date') || '');
  s = s.replace(/<(script|style|noscript|svg|iframe|form|template)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<(nav|header|footer|aside)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const corpo = regiao(s, 'body') || s;
  let texto = maiorBloco(corpo).join('\n');
  // sem parágrafos (o texto em <div> com <br>): o texto do <article>, senão do <main>, senão do corpo
  if (texto.length < 200) {
    const miolo = regiao(s, 'article') || regiao(s, 'main') || corpo;
    const alt = semTags(miolo).replace(/\n{2,}/g, '\n');
    if (alt.length > texto.length) texto = alt;
  }
  if (texto.length > max) texto = texto.slice(0, max).replace(/\s+\S*$/, '') + '…';
  return { titulo: semTags(titulo).replace(/\s+/g, ' ').trim() || null, descricao: descricao || null, data, texto };
}
