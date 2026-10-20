// ============================================================
// MACEDO & REIS — Feed de notícias: a coleta (20/10/2026)
// coletar({ db, fetch, chamar, agora }) — o que a Edge Function faz a cada hora (pg_cron):
//   1. lê o RSS de cada fonte ativa (noticias_fontes; sem RSS, os links da página de notícias pelo "padrao") e grava as
//      notícias novas (noticias, endereço único; só as dos últimos dias — a primeira coleta não traz o arquivo inteiro);
//   2. faz a triagem das que esperam (as mais novas primeiro, dentro do prazo da função): abre a página, a IA classifica
//      (triagem.js) e os critérios viram os clientes pelo banco (perfil.js). Descartada = sem efeito pro escritório.
// A que dá erro volta pra fila (até 3 tentativas); a que parou no meio (função cortada) volta depois de 20 minutos.
// diagnosticar({ fetch, urls }) — pra escolher as fontes: o que cada endereço devolve, quantos itens e, numa página
// comum, os RSS que ela anuncia (<link rel="alternate">).
// ============================================================
import { lerFeed, lerListaHtml, linkLimpo } from './rss.js';
import { textoDaPagina } from './pagina.js';
import { montarClientes, perfilDaCarteira, clientesDosCriterios } from './perfil.js';
import { triar } from './triagem.js';

export const JANELA_DIAS = 7;          // a coleta só traz o que saiu nos últimos 7 dias
export const SEM_DATA_MAX = 12;        // da fonte sem data, só os primeiros
export const MAX_TENTATIVAS = 3;
const UA = 'Mozilla/5.0 (compatible; MacedoReisFeed/1.0; +https://macedo-reis-contabilidade.github.io/macedo-reis-dashboards/)';

// o corpo no charset certo (há portal em ISO-8859-1): o do cabeçalho, o da declaração XML ou o do <meta>
export function decodificarCorpo(buf, contentType = '') {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let cs = (/charset\s*=\s*["']?([\w-]+)/i.exec(contentType || '') || [])[1];
  if (!cs) {
    const ini = new TextDecoder('latin1').decode(bytes.slice(0, 2048));
    cs = (/<\?xml[^>]*encoding\s*=\s*["']([\w-]+)/i.exec(ini) || /<meta[^>]*charset\s*=\s*["']?([\w-]+)/i.exec(ini) || [])[1];
  }
  cs = (cs || 'utf-8').toLowerCase();
  try { return new TextDecoder(cs === 'iso-8859-1' || cs === 'latin1' ? 'windows-1252' : cs).decode(bytes); }
  catch { return new TextDecoder('utf-8').decode(bytes); }
}
export async function buscar(f, url, { ms = 15000, max = 3_000_000 } = {}) {
  const r = await f(url, { headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.5', 'Accept-Language': 'pt-BR,pt;q=0.9' },
    redirect: 'follow', signal: AbortSignal.timeout(ms) });
  const tipo = (r.headers && r.headers.get && r.headers.get('content-type')) || '';
  const buf = new Uint8Array(await r.arrayBuffer());
  return { status: r.status, ok: r.ok, tipo, url: r.url || url, texto: decodificarCorpo(buf.length > max ? buf.slice(0, max) : buf, tipo) };
}
// os RSS que uma página anuncia (<link rel="alternate" type="application/rss+xml" href="…">)
export function feedsAnunciados(html, base) {
  const out = [];
  for (const m of String(html || '').matchAll(/<link\b[^>]*>/gi)) {
    const t = m[0];
    if (!/rel\s*=\s*["']?alternate/i.test(t) || !/type\s*=\s*["']?application\/(rss|atom)\+xml/i.test(t)) continue;
    const h = /href\s*=\s*["']([^"']+)["']/i.exec(t);
    const l = h && linkLimpo(h[1], base);
    if (l && !out.includes(l)) out.push(l);
  }
  return out;
}

// cada pedido: o endereço, ou { url, padrao } (a página sem RSS: os links de notícia pelo padrão). Página comum sem padrão:
// os RSS que ela anuncia e os links com texto, pra montar o padrão
export async function diagnosticar({ fetch: f, urls = [] }) {
  const lista = urls.slice(0, 40).map(u => (typeof u === 'string' ? { url: u } : u || {}));
  return Promise.all(lista.map(async ({ url, padrao = null, ms = 15000 }) => {
    try {
      const r = await buscar(f, url, { ms: Math.min(Number(ms) || 15000, 40000) });
      const feed = lerFeed(r.texto, { base: r.url });
      const base = { url, final: r.url !== url ? r.url : undefined, status: r.status, tipo: r.tipo.slice(0, 60), bytes: r.texto.length, formato: feed.tipo };
      if (feed.tipo) return { ...base, itens: feed.itens.length, exemplos: feed.itens.slice(0, 5).map(i => (i.data ? i.data.slice(0, 10) + ' ' : '') + i.titulo.slice(0, 90)) };
      if (padrao) { const it = lerListaHtml(r.texto, { base: r.url, padrao }); return { ...base, itens: it.length, exemplos: it.slice(0, 8).map(i => i.titulo.slice(0, 80) + ' | ' + i.link) }; }
      const links = [];
      for (const m of r.texto.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
        const t = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (t.length >= 25 && links.length < 30) links.push(t.slice(0, 70) + ' | ' + m[1].slice(0, 140));
      }
      return { ...base, anuncia: feedsAnunciados(r.texto, r.url).slice(0, 8), links };
    } catch (e) { return { url, erro: String((e && e.message) || e).slice(0, 200) }; }
  }));
}

// o item que é arquivo — a imagem, a folha de estilo, o PDF anexado que o RSS geral dos portais gov.br lista junto com as
// notícias ("esocial-full.png", "Cirruculo LUANA.pdf", "regras.html") — não é notícia: pelo endereço (termina em extensão
// de arquivo) ou pelo título (o nome do arquivo)
const EXT_ARQUIVO = /\.(pdf|jpe?g|png|gif|svg|webp|bmp|ico|css|js|json|xml|zip|rar|7z|docx?|xlsx?|pptx?|odt|ods|odp|csv|txt|mp3|mp4|avi|mov|wav)$/i;
const TITULO_ARQUIVO = /\.(html?|pdf|jpe?g|png|gif|svg|webp|ico|css|js|docx?|xlsx?|pptx?|odt|ods|csv|zip|txt)$/i;
export function ehArquivo(item) {
  let caminho = '';
  try { caminho = new URL(item.link).pathname; } catch { caminho = String(item.link || ''); }
  if (EXT_ARQUIVO.test(caminho)) return true;
  const t = String(item.titulo || '').trim();
  return TITULO_ARQUIVO.test(t) && t.split(/\s+/).length <= 4;
}

const iso = ms => new Date(ms).toISOString();
async function emPartes(itens, n, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, itens.length) }, async () => { while (i < itens.length) { const k = i++; out[k] = await fn(itens[k], k); } }));
  return out;
}

// 1. as fontes → as notícias novas
export async function coletarFontes({ db, fetch: f, agora = () => Date.now() }) {
  const { data: fontes, error } = await db.from('noticias_fontes').select('id, nome, url, site, tipo, formato, padrao, filtro').eq('ativo', true);
  if (error) throw new Error('fontes: ' + error.message);
  const limite = agora() - JANELA_DIAS * 864e5;
  let novas = 0;
  const resultado = await emPartes(fontes || [], 5, async fonte => {
    const quando = iso(agora());
    try {
      const r = await buscar(f, fonte.url, { ms: 15000 });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      let itens = fonte.formato === 'html' ? lerListaHtml(r.texto, { base: r.url, padrao: fonte.padrao }) : lerFeed(r.texto, { base: fonte.site || r.url }).itens;
      if (fonte.formato !== 'html' && !itens.length && !lerFeed(r.texto).tipo) throw new Error('não é RSS/Atom');
      itens = itens.filter(i => !ehArquivo(i));
      // fonte de muito volume: só o que bate com o filtro (no título ou no trecho), o resto nem vai pra triagem
      if (fonte.filtro) { const re = new RegExp(fonte.filtro, 'i'); itens = itens.filter(i => re.test(i.titulo + ' ' + (i.trecho || ''))); }
      let semData = 0;
      itens = itens.filter(i => (i.data ? Date.parse(i.data) >= limite : semData++ < SEM_DATA_MAX));
      let gravadas = 0;
      if (itens.length) {
        const rows = itens.map(i => ({ fonte_id: fonte.id, url: i.link, titulo: i.titulo, publicada_em: i.data, trecho: i.trecho }));
        const { data, error: e2 } = await db.from('noticias').upsert(rows, { onConflict: 'url', ignoreDuplicates: true }).select('id');
        if (e2) throw new Error('gravar: ' + e2.message);
        gravadas = (data || []).length;
      }
      novas += gravadas;
      await db.from('noticias_fontes').update({ ultima_coleta: quando, ultimo_ok: quando, ultimo_erro: null, itens_ultima: itens.length }).eq('id', fonte.id);
      return { fonte: fonte.nome, itens: itens.length, novas: gravadas };
    } catch (e) {
      const msg = String((e && e.message) || e).slice(0, 300);
      await db.from('noticias_fontes').update({ ultima_coleta: quando, ultimo_erro: msg }).eq('id', fonte.id);
      return { fonte: fonte.nome, erro: msg };
    }
  });
  return { fontes: resultado, novas };
}

// a carteira de hoje, no formato da busca (perfil.js)
export async function lerCarteira(db, hojeISO) {
  const { data: ks, error } = await db.from('carteira_info').select('cliente_id, saida').not('entrada', 'is', null);
  if (error) throw new Error('carteira: ' + error.message);
  const ids = [...new Set((ks || []).filter(k => k.cliente_id && (!k.saida || String(k.saida) > hojeISO)).map(k => k.cliente_id))];
  const lotes = async montar => { const out = []; for (let i = 0; i < ids.length; i += 100) { const { data, error: e } = await montar(ids.slice(i, i + 100)); if (e) throw new Error(e.message); out.push(...(data || [])); } return out; };
  const [clientes, vinc, obrs, trs, modelos] = await Promise.all([
    lotes(l => db.from('clientes').select('id, nome_principal, regime_tributario, cidade, uf, cnae_principal, cnaes_secundarios, natureza_juridica, tipo_pessoa').in('id', l)),
    lotes(l => db.from('cliente_obrigacoes').select('cliente_id, obrigacao_id').eq('ativo', true).in('cliente_id', l)),
    db.from('obrigacoes_fiscais').select('id, nome').then(r => r.data || []),
    db.from('tarefas_recorrentes').select('cliente_id, titulo, modelo_id').eq('setor', 'dp').eq('ativo', true).then(r => r.data || []),
    db.from('rotinas_modelo').select('id, nome').then(r => r.data || [])
  ]);
  const nomeObr = new Map(obrs.map(o => [o.id, o.nome])), nomeMod = new Map(modelos.map(m => [m.id, m.nome]));
  return montarClientes({
    clientes,
    obrigacoes: vinc.map(v => ({ cliente_id: v.cliente_id, nome: nomeObr.get(v.obrigacao_id) })).filter(v => v.nome),
    rotinasDp: trs.filter(t => ids.includes(t.cliente_id)).map(t => ({ cliente_id: t.cliente_id, nome: nomeMod.get(t.modelo_id) || t.titulo }))
  });
}

// 2. a triagem das que esperam, dentro do prazo
export async function triarPendentes({ db, fetch: f, chamar, agora = () => Date.now(), ate, max = 40, paralelas = 3 }) {
  // a que parou no meio (a função foi cortada) volta pra fila
  await db.from('noticias').update({ situacao: 'erro', erro: 'a triagem anterior parou no meio' }).eq('situacao', 'triando').lt('triagem_inicio', iso(agora() - 20 * 60e3));
  const { data: fila, error } = await db.from('noticias').select('id, url, titulo, publicada_em, trecho, tentativas, fonte_id, situacao')
    .in('situacao', ['nova', 'erro']).lt('tentativas', MAX_TENTATIVAS).order('publicada_em', { ascending: false, nullsFirst: false }).limit(max);
  if (error) throw new Error('fila: ' + error.message);
  if (!fila || !fila.length) return { triadas: 0, descartadas: 0, erros: 0, restam: 0 };
  const { data: fontes } = await db.from('noticias_fontes').select('id, nome, tipo');
  const fonteDe = new Map((fontes || []).map(x => [x.id, x]));
  const hoje = new Date(agora() - 3 * 3600e3).toISOString().slice(0, 10);
  const carteira = await lerCarteira(db, hoje);
  const perfil = perfilDaCarteira(carteira);
  const conta = { triadas: 0, descartadas: 0, erros: 0, puladas: 0 };
  await emPartes(fila, paralelas, async n => {
    if (agora() > ate - 40000) { conta.puladas++; return; }   // sem prazo pra mais uma: fica pra próxima
    const { data: peguei } = await db.from('noticias').update({ situacao: 'triando', tentativas: n.tentativas + 1, triagem_inicio: iso(agora()) })
      .eq('id', n.id).eq('situacao', n.situacao).eq('tentativas', n.tentativas).select('id');
    if (!peguei || !peguei.length) return;   // outra coleta pegou
    try {
      let pagina = null;
      try {
        const r = await buscar(f, n.url, { ms: 12000, max: 2_000_000 });
        if (r.ok && /html/i.test(r.tipo || 'text/html')) pagina = textoDaPagina(r.texto);
      } catch { /* sem a página: a IA lê o título e o trecho */ }
      const fonte = fonteDe.get(n.fonte_id) || {};
      const { classificacao: c, modelo, uso } = await triar({ chamar, perfil,
        noticia: { titulo: n.titulo, fonte: fonte.nome, tipoFonte: fonte.tipo, publicada_em: n.publicada_em || (pagina && pagina.data), link: n.url, trecho: n.trecho, pagina } });
      const clientes = c.relevante ? clientesDosCriterios(c.criterios, carteira) : [];
      const mud = { situacao: c.relevante ? 'triada' : 'descartada', relevancia: c.relevancia, setores: c.setores, resumo: c.resumo, por_que: c.por_que, acao: c.acao,
        criterios: c.criterios, clientes, modelo, tokens_entrada: uso.entrada, tokens_saida: uso.saida, tokens_cache: uso.cache, triada_em: iso(agora()), erro: null };
      if (!n.publicada_em && pagina && pagina.data) mud.publicada_em = pagina.data;
      const { error: e } = await db.from('noticias').update(mud).eq('id', n.id);
      if (e) throw new Error('gravar: ' + e.message);
      conta[c.relevante ? 'triadas' : 'descartadas']++;
    } catch (e) {
      conta.erros++;
      await db.from('noticias').update({ situacao: 'erro', erro: String((e && e.message) || e).slice(0, 400) }).eq('id', n.id);
    }
  });
  const { count } = await db.from('noticias').select('id', { count: 'exact', head: true }).in('situacao', ['nova', 'erro']).lt('tentativas', MAX_TENTATIVAS);
  return { ...conta, restam: count || 0 };
}

export async function coletar({ db, fetch: f, chamar, agora = () => Date.now(), prazoMs = 120000, triar: comTriagem = true }) {
  const inicio = agora(), ate = inicio + prazoMs;
  const fontes = await coletarFontes({ db, fetch: f, agora });
  const triagem = comTriagem ? await triarPendentes({ db, fetch: f, chamar, agora, ate }) : null;
  return { ...fontes, triagem, segundos: Math.round((agora() - inicio) / 1000) };
}
