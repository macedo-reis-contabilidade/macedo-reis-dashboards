// ============================================================
// MACEDO & REIS — Edge Function ca-vendas: lança vendas no Conta Azul (31/10/2026: o honorário adicional anual)
// A lógica está em servidor.js e nas regras de assets/js/adicional-anual.js (testados no node: tests/ca-vendas.test.mjs
// e tests/adicional-anual.test.mjs). A função importa esse código do repositório (o arquivo cru do GitHub), no commit
// fixado abaixo: roda exatamente o que estava naquele commit. Mudou algum desses arquivos? Publique, troque o commit daqui
// pelo novo, publique de novo e reimplante a função — o teste avisa quando o commit fixado ficou pra trás.
// verify_jwt = true · só os sócios (o login conferido no Auth); a consulta também com a chave do sincronismo (x-sync-key).
// Sem segredo novo: o token do Conta Azul é o do ca-sync (ca_tokens), que esta função só lê.
// ============================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { criarServidor } from "https://raw.githubusercontent.com/macedo-reis-contabilidade/macedo-reis-dashboards/275cb39b6f7b03732fcc673c2353a2700db1f655/supabase/functions/ca-vendas/servidor.js";

Deno.serve(criarServidor({ env: (k: string) => Deno.env.get(k), aguardar: (p: Promise<unknown>) => EdgeRuntime.waitUntil(p) }));
