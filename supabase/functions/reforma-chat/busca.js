// ============================================================
// MACEDO & REIS — Chat da Reforma: busca na base de materiais (rt_materiais.leitura)
// As leituras são markdown com títulos: cada uma vira trechos por seção (as seções longas em partes de ~2.500
// caracteres, cortadas nos parágrafos), pontuados por BM25 sobre radicais em português — sem acento, com plural e
// gênero reduzidos ("créditos" e "crédito" batem; "isenções" e "isenção" também). Sem banco de vetores e sem rede:
// o servidor (servidor.js) carrega as leituras e chama aqui; os testes também (tests/reforma-chat.test.mjs).
// ============================================================

const STOP = new Set(('a o as os um uma uns umas de da do das dos em na no nas nos num numa ao aos e ou que se por para pra '
  + 'com sem sob sobre entre como mais menos ja ha ser sao foi era sera esta estao tem tinha isso esse essa esses essas este '
  + 'estes estas isto ele ela eles elas seu sua seus suas lhe lhes me mim minha meu nosso nossa voce voces qual quais quando '
  + 'onde quem pelo pela pelos pelas ate apos desde tambem so muito cada todo toda todos todas outro outra outros outras '
  + 'mesmo mesma porque pois entao assim aqui la isso tal').split(' '));

// sem acento e em minúsculas (o "º" e o "§" viram separador)
export function normalizar(t) {
  return String(t == null ? '' : t).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

// radical leve: plural, "ões/ães" → "ão", "ais" → "al", "ns" → "m" e a vogal final (gênero) das palavras longas
export function radical(w) {
  if (w.length <= 3 || /\d/.test(w)) return w;
  let r = w;
  if (r.endsWith('oes') || r.endsWith('aes')) r = r.slice(0, -3) + 'ao';
  else if (r.endsWith('ais')) r = r.slice(0, -3) + 'al';
  else if (r.endsWith('eis') && r.length > 5) r = r.slice(0, -3) + 'el';
  else if (r.endsWith('ois')) r = r.slice(0, -3) + 'ol';
  else if (r.endsWith('ns')) r = r.slice(0, -2) + 'm';
  else if (r.endsWith('res') && r.length > 5) r = r.slice(0, -2);
  else if (r.endsWith('s') && r.length > 4) r = r.slice(0, -1);
  if (r.length > 5 && /[aoe]$/.test(r)) r = r.slice(0, -1);
  return r;
}

// palavras da consulta ou do texto, já em radical; número fica (artigo, ano, CFOP); letra solta sai
export function tokens(t) {
  return normalizar(t).replace(/[^a-z0-9]+/g, ' ').split(' ')
    .filter(w => w && !STOP.has(w) && (w.length > 1 || /\d/.test(w)))
    .map(radical);
}

const ALVO = 2500, MAXIMO = 3500;

// partes de uma seção longa: junta parágrafos até ~2.500 caracteres; parágrafo maior que 3.500 (tabela) é cortado por linha
function partes(texto) {
  if (texto.length <= MAXIMO) return [texto];
  const blocos = [];
  texto.split(/\n\s*\n/).forEach(par => {
    if (par.length <= MAXIMO) { blocos.push(par); return; }
    let buf = '';
    par.split('\n').forEach(l => { if (buf && buf.length + l.length + 1 > ALVO) { blocos.push(buf); buf = ''; } buf += (buf ? '\n' : '') + l; });
    if (buf) blocos.push(buf);
  });
  const out = []; let atual = '';
  blocos.forEach(b => { if (atual && atual.length + b.length + 2 > ALVO) { out.push(atual); atual = ''; } atual += (atual ? '\n\n' : '') + b; });
  if (atual) out.push(atual);
  return out;
}

// as seções de uma leitura, na ordem: { secao: "Título › Subtítulo", texto } — o título fica no texto da seção
export function secoesDe(leitura) {
  const linhas = String(leitura || '').split('\n');
  const out = []; let caminho = [], buf = [];
  const fechar = () => {
    const texto = buf.join('\n').trim();
    if (texto) {
      const nome = caminho.filter(Boolean).join(' › ') || '(início)';
      const ps = partes(texto);
      ps.forEach((p, i) => out.push({ secao: ps.length > 1 ? nome + ' (parte ' + (i + 1) + ' de ' + ps.length + ')' : nome, texto: p }));
    }
    buf = [];
  };
  linhas.forEach(l => {
    const h = /^(#{1,4})\s+(.*)$/.exec(l);
    if (h) { fechar(); const nivel = h[1].length; caminho = caminho.slice(0, nivel - 1); caminho[nivel - 1] = h[2].replace(/[*_`]/g, '').trim(); }
    buf.push(l);
  });
  fechar();
  return out;
}

// índice da base: os trechos de todas as leituras, com a contagem de termos (BM25)
export function criarIndice(materiais) {
  const docs = [];
  const codigos = new Set();
  (materiais || []).forEach(m => {
    codigos.add(m.codigo);
    secoesDe(m.leitura).forEach((s, i) => docs.push({ codigo: m.codigo, material: m.titulo || '', tipo: m.tipo || '', modulo: m.modulo || '', n: i + 1, secao: s.secao, texto: s.texto }));
  });
  const df = new Map(); let soma = 0;
  docs.forEach(d => {
    // o título da seção e o do material pesam a mais
    const tk = tokens(d.texto).concat(tokens(d.secao), tokens(d.secao), tokens(d.material));
    d.tf = new Map();
    tk.forEach(t => d.tf.set(t, (d.tf.get(t) || 0) + 1));
    d.len = tk.length; soma += tk.length;
    d.tf.forEach((_, t) => df.set(t, (df.get(t) || 0) + 1));
  });
  return { docs, df, N: docs.length, media: soma / Math.max(1, docs.length), codigos };
}

// o pedaço do trecho com mais termos da consulta (pra mostrar no resultado da busca)
export function recorte(texto, termos, tamanho = 700) {
  const linhas = texto.split('\n');
  let melhor = 0, pontos = -1;
  linhas.forEach((l, i) => {
    const tk = new Set(tokens(l));
    const p = termos.filter(t => tk.has(t)).length;
    if (p > pontos) { pontos = p; melhor = i; }
  });
  let ini = melhor, fim = melhor, total = linhas[melhor].length;
  while (total < tamanho && (ini > 0 || fim < linhas.length - 1)) {
    if (fim < linhas.length - 1) { fim++; total += linhas[fim].length + 1; }
    if (total < tamanho && ini > 0) { ini--; total += linhas[ini].length + 1; }
  }
  let r = linhas.slice(ini, fim + 1).join('\n').trim();
  if (r.length > tamanho + 300) r = r.slice(0, tamanho + 300) + '…';
  return (ini > 0 ? '…\n' : '') + r + (fim < linhas.length - 1 ? '\n…' : '');
}

// busca: os trechos mais relevantes (no máximo 2 do mesmo material, pra variar as fontes)
export function buscar(indice, consulta, opcoes = {}) {
  const { modulo, tipo, codigo } = opcoes;
  const limite = Math.max(1, Math.min(10, +opcoes.limite || 6));
  const q = [...new Set(tokens(consulta))];
  const citados = new Set((String(consulta || '').toUpperCase().match(/[A-Z0-9]{2,}(?:-[A-Z0-9]+)+/g) || []).filter(c => indice.codigos.has(c)));
  if (!q.length && !citados.size) return [];
  const k1 = 1.2, b = 0.75;
  const idf = t => { const n = indice.df.get(t) || 0; return Math.log(1 + (indice.N - n + 0.5) / (n + 0.5)); };
  const nm = modulo ? normalizar(modulo) : null;
  const res = [];
  indice.docs.forEach(d => {
    if (nm && !normalizar(d.modulo).includes(nm)) return;
    if (tipo && d.tipo !== tipo) return;
    if (codigo && d.codigo !== codigo) return;
    let s = 0, achados = 0;
    q.forEach(t => {
      const f = d.tf.get(t);
      if (!f) return;
      achados++;
      s += idf(t) * f * (k1 + 1) / (f + k1 * (1 - b + b * d.len / indice.media));
    });
    if (q.length) s *= 1 + 0.5 * (achados / q.length);
    if (citados.has(d.codigo)) s = s * 2 + 1;
    if (s > 0) res.push({ d, s });
  });
  res.sort((x, y) => y.s - x.s);
  const porMaterial = new Map(), out = [];
  for (const r of res) {
    const n = porMaterial.get(r.d.codigo) || 0;
    if (n >= 2) continue;
    porMaterial.set(r.d.codigo, n + 1);
    out.push(r);
    if (out.length >= limite) break;
  }
  return out.map(({ d, s }) => ({ codigo: d.codigo, material: d.material, tipo: d.tipo, n: d.n, secao: d.secao, trecho: recorte(d.texto, q), pontos: Math.round(s * 100) / 100 }));
}

// leitura de um material: sem seção, o cabeçalho e o sumário das seções; com seção (número do sumário ou parte do título),
// o texto dela e das seguintes até ~8.000 caracteres
export function lerMaterial(material, secao, limite = 8000) {
  if (!material) return null;
  const ss = secoesDe(material.leitura);
  const cab = material.codigo + ' — ' + (material.titulo || '') + '\nTipo: ' + (material.tipo || '—') + (material.oficial ? ' (oficial)' : '')
    + ' · módulo: ' + (material.modulo || '—') + (material.autor ? ' · autor: ' + material.autor : '') + (material.data_ref ? ' · data: ' + material.data_ref : '');
  const sumario = ss.map((s, i) => (i + 1) + '. ' + s.secao + ' (' + s.texto.length + ' caracteres)').join('\n');
  if (secao == null || String(secao).trim() === '') {
    return cab + '\n\nSeções:\n' + sumario + '\n\nPara ler, chame de novo com "secao" (o número ou parte do título).';
  }
  let i = -1;
  const sx = String(secao).trim();
  if (/^\d+$/.test(sx)) i = +sx - 1;
  else { const ns = normalizar(sx); i = ss.findIndex(s => normalizar(s.secao).includes(ns)); if (i < 0) { const tk = tokens(sx); i = ss.findIndex(s => { const t = new Set(tokens(s.secao)); return tk.length && tk.every(x => t.has(x)); }); } }
  if (i < 0 || i >= ss.length) return cab + '\n\nSeção "' + sx + '" não encontrada. Seções:\n' + sumario;
  let texto = '', j = i;
  while (j < ss.length && (texto === '' || texto.length + ss[j].texto.length <= limite)) { texto += (texto ? '\n\n' : '') + ss[j].texto; j++; }
  if (texto.length > limite) texto = texto.slice(0, limite) + '…';
  return cab + '\n\n[seções ' + (i + 1) + (j - 1 > i ? ' a ' + j : '') + ' de ' + ss.length + ']\n\n' + texto + (j < ss.length ? '\n\n(continua: secao ' + (j + 1) + ' — ' + ss[j].secao + ')' : '\n\n(fim do material)');
}
