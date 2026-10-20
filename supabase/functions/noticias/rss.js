// ============================================================
// MACEDO & REIS — Feed de notícias: a leitura do RSS/Atom das fontes (20/10/2026)
// lerFeed(xml) → { tipo, itens: [{ titulo, link, data, trecho }] }: RSS 2.0, RSS 1.0 (RDF, o dos portais gov.br) e Atom.
// Sem dependência (o Deno das Edge Functions não tem DOMParser): expressões sobre o texto, com CDATA e entidades.
// Puro — testes em tests/noticias.test.mjs.
// ============================================================

const NOMEADAS = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  hellip: '…', bull: '•', middot: '·', deg: '°', ordm: 'º', ordf: 'ª', sect: '§', copy: '©', reg: '®', euro: '€', laquo: '«', raquo: '»',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', agrave: 'à', acirc: 'â', ecirc: 'ê', ocirc: 'ô', atilde: 'ã', otilde: 'õ',
  ccedil: 'ç', uuml: 'ü', Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Agrave: 'À', Acirc: 'Â', Ecirc: 'Ê', Ocirc: 'Ô',
  Atilde: 'Ã', Otilde: 'Õ', Ccedil: 'Ç', Uuml: 'Ü', ntilde: 'ñ', Ntilde: 'Ñ'
};
export function decodificar(s) {
  return String(s == null ? '' : s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return Object.prototype.hasOwnProperty.call(NOMEADAS, e) ? NOMEADAS[e] : m;
  });
}
const semCdata = s => String(s == null ? '' : s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
// o texto de um pedaço de HTML: sem script e estilo, as quebras de bloco viram espaço, sem as marcas, com as entidades
export function semTags(html) {
  let s = semCdata(html);
  // entidades de marcação escapadas (o "description" que traz HTML codificado): decodifica antes de tirar as marcas
  if (/&lt;\s*\/?\s*[a-z]/i.test(s)) s = decodificar(s);
  s = s.replace(/<(script|style|noscript|svg|iframe)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\s*(br|\/p|\/div|\/li|\/h\d|\/tr)\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  return decodificar(s).replace(/[ \t\r\f\v\u00a0]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n').trim();
}
// o miolo da primeira marca (com ou sem prefixo, ex.: dc:date, content:encoded)
function miolo(bloco, nome) {
  const re = new RegExp('<' + nome.replace(':', '\\:') + '(?:\\s[^>]*)?>([\\s\\S]*?)<\\/' + nome.replace(':', '\\:') + '\\s*>', 'i');
  const m = re.exec(bloco);
  return m ? m[1] : null;
}
function atributo(tag, nome) {
  const m = new RegExp('\\s' + nome + '\\s*=\\s*("([^"]*)"|\'([^\']*)\')', 'i').exec(tag);
  return m ? decodificar(m[2] != null ? m[2] : m[3]) : null;
}
// a data em ISO (RFC 822 do RSS, ISO do Atom e do dc:date); o que não der pra ler fica null
export function dataIso(s) {
  const t = semTags(s || '');
  if (!t) return null;
  let ms = Date.parse(t);
  if (!Number.isFinite(ms)) {
    // "19/10/2026 22:10" (alguns portais brasileiros)
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/.exec(t);
    if (m) ms = Date.parse(m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0') + 'T' + (m[4] || '12').padStart(2, '0') + ':' + (m[5] || '00') + ':00-03:00');
  }
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}
// o endereço do item: só http(s); relativo vira absoluto pela base (o site da fonte)
export function linkLimpo(l, base = null) {
  const t = semTags(l || '').trim();
  if (!t) return null;
  try {
    const u = new URL(t, base || undefined);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch { return null; }
}
const MAX_TRECHO = 700;
export function lerFeed(xml, { base = null, max = 60 } = {}) {
  const s = String(xml || '');
  let tipo = null, blocos = [];
  if (/<(rss|rdf:RDF)\b/i.test(s) || /<channel\b/i.test(s)) {
    tipo = /<rdf:RDF\b/i.test(s) ? 'rdf' : 'rss';
    blocos = s.match(/<item\b[\s\S]*?<\/item\s*>/gi) || [];
  } else if (/<feed\b/i.test(s)) {
    tipo = 'atom';
    blocos = s.match(/<entry\b[\s\S]*?<\/entry\s*>/gi) || [];
  }
  const itens = [], vistos = new Set();
  for (const b of blocos) {
    const titulo = semTags(miolo(b, 'title') || '').replace(/\s+/g, ' ').trim();
    let link = null;
    if (tipo === 'atom') {
      const tags = b.match(/<link\b[^>]*>/gi) || [];
      const alt = tags.find(t => !/\srel\s*=/i.test(t) || /\srel\s*=\s*["']alternate["']/i.test(t)) || tags[0];
      link = alt ? linkLimpo(atributo(alt, 'href'), base) : null;
    } else {
      link = linkLimpo(miolo(b, 'link'), base);
      if (!link) { const about = /<item\b[^>]*>/i.exec(b); link = about ? linkLimpo(atributo(about[0], 'rdf:about'), base) : null; }
      if (!link) { const g = /<guid\b([^>]*)>([\s\S]*?)<\/guid>/i.exec(b); if (g && !/isPermaLink\s*=\s*["']false/i.test(g[1])) link = linkLimpo(g[2], base); }
    }
    if (!titulo || !link || vistos.has(link)) continue;
    vistos.add(link);
    const data = dataIso(miolo(b, 'pubDate') || miolo(b, 'dc:date') || miolo(b, 'published') || miolo(b, 'updated') || miolo(b, 'dc:created') || '');
    let trecho = semTags(miolo(b, 'description') || miolo(b, 'summary') || miolo(b, 'content:encoded') || miolo(b, 'content') || '');
    if (trecho.length > MAX_TRECHO) trecho = trecho.slice(0, MAX_TRECHO).replace(/\s+\S*$/, '') + '…';
    itens.push({ titulo: titulo.slice(0, 400), link, data, trecho: trecho || null });
    if (itens.length >= max) break;
  }
  return { tipo, itens };
}

// ---------- fonte sem RSS: os links de notícia da página de notícias (formato "html") ----------
// lerListaHtml(html, { base, padrao }) → itens [{ titulo, link }]: os <a> cujo endereço bate com o padrão da fonte (as
// notícias do site), com o texto do link como título — a data e o resumo vêm da página de cada uma, na triagem
export function lerListaHtml(html, { base, padrao, max = 40 } = {}) {
  const re = padrao instanceof RegExp ? padrao : new RegExp(padrao || '.^');
  const itens = [], vistos = new Set();
  for (const m of String(html || '').matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = atributo(m[1], 'href');
    const link = linkLimpo(href, base);
    if (!link || !re.test(link) || vistos.has(link)) continue;
    let titulo = (semTags(m[2]) || atributo(m[1], 'title') || '').replace(/\s+/g, ' ').trim();
    // o aviso que começa com a data ("19/10/2026 - Atenção aos emissores…", o da Receita Estadual): a data vira a do item
    const d = /^(\d{1,2}\/\d{1,2}\/\d{4})\s*[-–—:]\s*/.exec(titulo);
    const data = d ? dataIso(d[1]) : null;
    if (d) titulo = titulo.slice(d[0].length);
    if (titulo.length < 15) continue;
    vistos.add(link);
    itens.push({ titulo: titulo.slice(0, 400), link, data, trecho: null });
    if (itens.length >= max) break;
  }
  return itens;
}
