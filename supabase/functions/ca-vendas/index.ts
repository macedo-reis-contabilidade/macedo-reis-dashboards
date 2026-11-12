// ============================================================
// MACEDO & REIS — Edge Function ca-vendas: lança vendas no Conta Azul (31/10/2026: o honorário adicional anual) e cria o
// contrato da mensalidade do cliente novo (o cadastro e o contrato, no padrão dos demais)
// A lógica está em servidor.js e nas regras de assets/js/adicional-anual.js e assets/js/contrato-ca.js (testados no node:
// tests/ca-vendas.test.mjs, tests/adicional-anual.test.mjs e tests/contrato-ca.test.mjs). A função importa esse código
// do repositório (o arquivo cru do GitHub), no commit fixado abaixo: roda exatamente o que estava naquele commit. Mudou
// algum desses arquivos? Publique, troque o commit daqui pelo novo, publique de novo e reimplante a função — o teste
// avisa quando o commit fixado ficou pra trás.
// verify_jwt = true · só os sócios (o login conferido no Auth); a consulta também com a chave do sincronismo (x-sync-key).
// Sem segredo novo: o token do Conta Azul é o do ca-sync (ca_tokens), que esta função só lê.
// ============================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { criarServidor } from "https://raw.githubusercontent.com/macedo-reis-contabilidade/macedo-reis-dashboards/e9736bccbb725572e9c7b9938b174aef5628ea9a/supabase/functions/ca-vendas/servidor.js";

Deno.serve(criarServidor({ env: (k: string) => Deno.env.get(k), aguardar: (p: Promise<unknown>) => EdgeRuntime.waitUntil(p) }));
