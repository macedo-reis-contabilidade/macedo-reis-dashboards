// consultar-cnpjs (27/09/2026) — regime tributário de CNPJs de terceiros (fornecedores e clientes dos nossos clientes).
// Ordem: cache (cnpj_regime, 60 dias) > nosso cadastro (clientes.regime_tributario) > Receita via BrasilAPI.
// Entrada: { cnpjs: string[] } (até 40). Saída: { resultados: [{ cnpj, razao, simples, mei, situacao, fonte }] }.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const dig = (s: string) => String(s || '').replace(/\D/g, '');
const espera = (ms: number) => new Promise(r => setTimeout(r, ms));

// Quem chama (24/10/2026): só quem entrou no sistema com e-mail do escritório — ou o próprio servidor, com a chave de
// servidor. O verify_jwt sozinho deixa passar a chave anônima, que é pública (está nas páginas e no repositório): sem
// esta conferência, qualquer um na internet chamaria esta função. A mesma em todas as funções internas — o teste
// tests/funcoes-login.test.mjs confere.
async function quemChama(req: Request): Promise<string | null> {
  const m = /^Bearer\s+(\S+)/i.exec(req.headers.get("authorization") || "");
  const jwt = m ? m[1] : "";
  if (!jwt) return null;
  const servidor = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (servidor && jwt === servidor) return "servidor";
  try {
    const r = await fetch((Deno.env.get("SUPABASE_URL") || "") + "/auth/v1/user", {
      headers: { apikey: Deno.env.get("SUPABASE_ANON_KEY") || servidor, Authorization: "Bearer " + jwt },
    });
    if (!r.ok) return null;
    const u = await r.json().catch(() => null);
    const email = String((u && u.email) || "").toLowerCase();
    return email.endsWith("@macedoereis.com.br") ? email : null;
  } catch (_e) {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (!(await quemChama(req))) return new Response(JSON.stringify({ erro: 'Entre no sistema pra usar esta função.' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } });
  try {
    const body = await req.json().catch(() => ({}));
    const lista = [...new Set((body.cnpjs || []).map(dig).filter((c: string) => c.length === 14))].slice(0, 40) as string[];
    if (!lista.length) return new Response(JSON.stringify({ resultados: [] }), { headers: { ...cors, 'Content-Type': 'application/json' } });
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const limite = new Date(Date.now() - 60 * 86400000).toISOString();
    const { data: cache } = await sb.from('cnpj_regime').select('*').in('cnpj', lista).gte('consultado_em', limite);
    const achados = new Map((cache || []).map((r: any) => [r.cnpj, r]));
    const faltam = lista.filter(c => !achados.has(c));
    // nosso cadastro
    if (faltam.length) {
      const { data: cli } = await sb.from('clientes').select('documento, nome_principal, regime_tributario').not('regime_tributario', 'is', null);
      const porDoc = new Map((cli || []).map((c: any) => [dig(c.documento), c]));
      for (const c of faltam) {
        const x: any = porDoc.get(c);
        if (!x) continue;
        const reg = String(x.regime_tributario);
        const r = { cnpj: c, razao: x.nome_principal, simples: reg === 'Simples Nacional' || reg === 'MEI', mei: reg === 'MEI', situacao: 'ATIVA', fonte: 'cadastro do escritório (' + reg + ')', consultado_em: new Date().toISOString() };
        achados.set(c, r);
        await sb.from('cnpj_regime').upsert(r);
      }
    }
    // Receita (BrasilAPI), com pausa curta entre chamadas
    for (const c of lista.filter(c => !achados.has(c))) {
      try {
        const resp = await fetch('https://brasilapi.com.br/api/cnpj/v1/' + c, { headers: { 'User-Agent': 'macedo-reis-dashboards' } });
        if (resp.ok) {
          const j: any = await resp.json();
          const r = { cnpj: c, razao: j.razao_social || null, simples: j.opcao_pelo_simples === true, mei: j.opcao_pelo_mei === true, situacao: j.descricao_situacao_cadastral || null, fonte: 'Receita Federal (BrasilAPI)', consultado_em: new Date().toISOString() };
          achados.set(c, r);
          await sb.from('cnpj_regime').upsert(r);
        }
      } catch (_) { /* segue: fica sem resposta */ }
      await espera(350);
    }
    const resultados = lista.map(c => achados.get(c) || { cnpj: c, razao: null, simples: null, mei: null, situacao: null, fonte: 'não consultado' });
    return new Response(JSON.stringify({ resultados }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ erro: String(e) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
