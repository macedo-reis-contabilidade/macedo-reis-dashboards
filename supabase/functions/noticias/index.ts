// ============================================================
// MACEDO & REIS — Edge Function noticias: o feed de notícias (20/10/2026, pedido do Samuel)
// A lógica está nos módulos ao lado (servidor.js, coleta.js, triagem.js, perfil.js, pagina.js, rss.js) — testes no node em
// tests/noticias.test.mjs. Como a função assistente, roda o código do repositório (o arquivo cru do GitHub) no commit
// fixado abaixo. Mudou algum desses arquivos? Publique, troque o commit daqui pelo novo, publique de novo e reimplante a
// função — o teste avisa quando o commit fixado ficou pra trás.
// verify_jwt = true · segredo: ANTHROPIC_API_KEY (o mesmo do chat da Reforma) · a chave da coleta em
// configuracoes_escritorio.noticias_chave (só o servidor lê) · pg_cron: noticias-coletar, de hora em hora.
// ============================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { criarServidor } from "https://raw.githubusercontent.com/macedo-reis-contabilidade/macedo-reis-dashboards/42df9c994e9b38575d3eca1a034d58bd7dc333cd/supabase/functions/noticias/servidor.js";

Deno.serve(criarServidor({
  env: (k: string) => Deno.env.get(k),
  criarDb: () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } }),
}));
