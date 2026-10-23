// ============================================================
// MACEDO & REIS — Edge Function ponte: recebe os pacotes da ponte do PC do escritório (23/10/2026)
// A lógica está nos módulos ao lado (servidor.js, receita.js) — testes no node em tests/ponte-funcao.test.mjs. Como a
// função assistente, roda o código do repositório (o arquivo cru do GitHub) no commit fixado abaixo. Mudou algum desses
// arquivos? Publique, troque o commit daqui pelo novo, publique de novo e reimplante a função — o teste avisa quando o
// commit fixado ficou pra trás.
// verify_jwt = true · a impressão digital da chave da ponte em configuracoes_escritorio.ponte_chave_sha256 (só o servidor
// lê) · grava pela receita_gravar (só o service_role executa).
// ============================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { criarServidor } from "https://raw.githubusercontent.com/macedo-reis-contabilidade/macedo-reis-dashboards/78cb33a76d2f2e737283815d7be086b3254cd679/supabase/functions/ponte/servidor.js";

Deno.serve(criarServidor({
  criarDb: () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } }),
}));
