// ============================================================
// MACEDO & REIS — Edge Function noticias: a entrada (20/10/2026)
// verify_jwt = true (regra 10). Quem chama:
//   - a coleta de hora em hora (pg_cron, job noticias-coletar): a chave anônima no Authorization e a chave da coleta no
//     cabeçalho x-chave (configuracoes_escritorio.noticias_chave, que só o servidor lê);
//   - um sócio logado (o "Coletar agora" da tela Notícias): no máximo uma vez a cada 10 minutos.
// Corpo: { coletar: true } | { diagnosticar: [urls] } (só a chave) | { triar: true } (só a triagem; só a chave) |
// { pagina: url } (o que a triagem lê daquela página; só a chave).
// Puro: env, fetch, banco e chamador injetados (index.ts monta). O detalhe do erro fica no log e na resposta da chave.
// ============================================================
import { coletar, diagnosticar, triarPendentes, buscar } from './coleta.js';
import { criarChamador } from './triagem.js';
import { textoDaPagina } from './pagina.js';

export const DOMINIO = '@macedoereis.com.br';
// os sócios (a mesma lista de assets/js/equipe.js — tests/noticias.test.mjs confere)
export const SOCIOS = ['financeiro@macedoereis.com.br', 'diego@macedoereis.com.br'];
const INTERVALO_SOCIO_MS = 10 * 60e3;

function cors(origin) {
  return { 'Access-Control-Allow-Origin': origin || '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-chave', 'Content-Type': 'application/json' };
}
const resposta = (origin, obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: cors(origin) });

export function criarServidor({ env, fetch: f = fetch, criarDb, agora = () => Date.now() }) {
  return async function atender(req) {
    const origin = req.headers.get('origin');
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) });
    if (req.method !== 'POST') return resposta(origin, { erro: 'Use POST.' }, 405);
    let corpo = {};
    try { corpo = await req.json(); } catch { corpo = {}; }
    const db = criarDb();
    // quem chama
    let admin = false, email = null;
    const chave = req.headers.get('x-chave');
    if (chave) {
      const { data } = await db.from('configuracoes_escritorio').select('valor').eq('chave', 'noticias_chave').maybeSingle();
      admin = !!(data && data.valor && data.valor === chave);
      if (!admin) return resposta(origin, { erro: 'Sem permissão.' }, 403);
    } else {
      const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
      let u = null;
      try {
        const r = await f(env('SUPABASE_URL') + '/auth/v1/user', { headers: { apikey: env('SUPABASE_ANON_KEY') || env('SUPABASE_SERVICE_ROLE_KEY'), Authorization: 'Bearer ' + jwt } });
        u = r.ok ? await r.json() : null;
      } catch { u = null; }
      email = u && u.email ? String(u.email).toLowerCase() : null;
      if (!email || !email.endsWith(DOMINIO)) return resposta(origin, { erro: 'Sem permissão.' }, 403);
      if (!SOCIOS.includes(email)) return resposta(origin, { erro: 'Coletar agora é dos sócios: a coleta roda sozinha de hora em hora.' }, 403);
    }
    try {
      if (Array.isArray(corpo.diagnosticar)) {
        if (!admin) return resposta(origin, { erro: 'Sem permissão.' }, 403);
        return resposta(origin, { diagnostico: await diagnosticar({ fetch: f, urls: corpo.diagnosticar }) });
      }
      // o que a triagem lê de uma página (pra acertar a leitura de um site)
      if (typeof corpo.pagina === 'string') {
        if (!admin) return resposta(origin, { erro: 'Sem permissão.' }, 403);
        const r = await buscar(f, corpo.pagina, { ms: 15000 });
        const p = textoDaPagina(r.texto);
        // perto: o HTML em volta de um trecho do texto (pra ver onde o miolo está)
        const k = typeof corpo.perto === 'string' && corpo.perto ? r.texto.indexOf(corpo.perto) : -1;
        return resposta(origin, { status: r.status, tipo: r.tipo, final: r.url, bytes: r.texto.length, titulo: p.titulo, descricao: p.descricao, data: p.data,
          texto: p.texto.slice(0, 2500), inicio: r.texto.replace(/\s+/g, ' ').slice(0, 1200),
          perto: k >= 0 ? r.texto.slice(Math.max(0, k - 2500), k + 2500).replace(/\s+/g, ' ') : null });
      }
      const chamar = criarChamador({ fetch: f, chave: env('ANTHROPIC_API_KEY') });
      if (corpo.triar) {
        if (!admin) return resposta(origin, { erro: 'Sem permissão.' }, 403);
        return resposta(origin, { triagem: await triarPendentes({ db, fetch: f, chamar, agora, ate: agora() + 120000 }) });
      }
      if (corpo.coletar) {
        if (!admin) {
          const { data: ult } = await db.from('noticias_fontes').select('ultima_coleta').order('ultima_coleta', { ascending: false, nullsFirst: false }).limit(1);
          const quando = ult && ult[0] && ult[0].ultima_coleta ? Date.parse(ult[0].ultima_coleta) : 0;
          if (agora() - quando < INTERVALO_SOCIO_MS) return resposta(origin, { ok: true, pulou: true, ultima: ult[0].ultima_coleta });
        }
        const r = await coletar({ db, fetch: f, chamar, agora, prazoMs: 120000 });
        return resposta(origin, admin ? { ok: true, ...r } : { ok: true, novas: r.novas, triagem: r.triagem, segundos: r.segundos });
      }
      return resposta(origin, { erro: 'Nada pra fazer: mande { coletar: true }.' }, 400);
    } catch (e) {
      console.error('noticias:', e);
      return resposta(origin, admin ? { erro: String((e && e.message) || e) } : { erro: 'A coleta não rodou agora. Tente de novo em alguns minutos.' }, 500);
    }
  };
}
