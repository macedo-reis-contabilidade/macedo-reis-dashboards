// ============================================================
// MACEDO & REIS — Feed de notícias: o texto da página da notícia (20/10/2026)
// O RSS costuma trazer só o título e uma linha; pra IA entender a notícia, a coleta abre a página e tira o texto:
// textoDaPagina(html) → { titulo, descricao, data, texto } — o título (og:title ou <title>), a descrição (og/meta), a data
// de publicação (article:published_time ou datePublished), e os parágrafos do miolo (o <article>, senão o <main>, senão o
// corpo), sem menu, rodapé, script e estilo. Puro — testes em tests/noticias.test.mjs.
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
export function textoDaPagina(html, { max = 6000 } = {}) {
  let s = String(html || '');
  const titulo = meta(s, 'og:title') || (/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(s) || [])[1] || '';
  const descricao = meta(s, 'og:description') || meta(s, 'description') || null;
  const ld = /"datePublished"\s*:\s*"([^"]+)"/i.exec(s);
  const data = dataIso(meta(s, 'article:published_time') || (ld && ld[1]) || meta(s, 'date') || meta(s, 'dc.date') || '');
  s = s.replace(/<(script|style|noscript|svg|iframe|form|template)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<(nav|header|footer|aside)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const miolo = regiao(s, 'article') || regiao(s, 'main') || regiao(s, 'body') || s;
  // os parágrafos com texto de verdade (o resto do miolo costuma ser compartilhar, tags, "leia também")
  const pars = [];
  for (const m of miolo.matchAll(/<(p|li|h2|h3|blockquote)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi)) {
    const t = semTags(m[2]).replace(/\s+/g, ' ').trim();
    if (t.length >= (m[1].toLowerCase() === 'p' ? 40 : 25) && !pars.includes(t)) pars.push(t);
  }
  let texto = pars.join('\n');
  if (texto.length < 200) texto = semTags(miolo).replace(/\n{2,}/g, '\n');
  if (texto.length > max) texto = texto.slice(0, max).replace(/\s+\S*$/, '') + '…';
  return { titulo: semTags(titulo).replace(/\s+/g, ' ').trim() || null, descricao: descricao || null, data, texto };
}
