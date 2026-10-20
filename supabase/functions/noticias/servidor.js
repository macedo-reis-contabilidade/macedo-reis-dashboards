// ============================================================
// MACEDO & REIS — Edge Function noticias: a entrada (20/10/2026)
// verify_jwt = true (regra 10). Quem chama:
//   - a coleta de hora em hora (pg_cron, job noticias-coletar): a chave anônima no Authorization e a chave da coleta no
//     cabeçalho x-chave (configuracoes_escritorio.noticias_chave, que só o servidor lê);
//   - um sócio logado (o "Coletar agora" da tela Notícias): no máximo uma vez a cada 10 minutos.
// Corpo: { coletar: true } | { diagnosticar: [urls] } (só a chave) | { triar: true } (só a triagem; só a chave).
// Puro: env, fetch, banco e chamador injetados (index.ts monta). O detalhe do erro fica no log e na resposta da chave.
// ============================================================
import { coletar, diagnosticar, triarPendentes } from './coleta.js';
import { criarChamador } from './triagem.js';

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
        return resposta(origin, { diagnostico: await diagnosticar({ fetch: f, urls: corpo.diagnosticar.map(String) }) });
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
