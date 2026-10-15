// ============================================================
// MACEDO & REIS — Edge Function reforma-chat: o chat da Reforma ("Perguntar à base", em fiscal-reforma.html)
// A lógica está em servidor.js e nos módulos ao lado (testados no node: tests/reforma-chat.test.mjs), e a conta é a
// mesma da ficha (assets/js/rt-motor.js, rt-confianca.js, dominio-relatorios.js). A função importa esse código do
// repositório (o arquivo cru do GitHub), no commit fixado abaixo: roda exatamente o que estava naquele commit. Mudou algum desses
// arquivos? Publique, troque o commit daqui pelo novo, publique de novo e reimplante a função — o teste avisa quando o
// commit fixado ficou pra trás. verify_jwt = true · segredo: ANTHROPIC_API_KEY (o mesmo do leitor de documentos e do DRE).
// ============================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { criarServidor } from "https://raw.githubusercontent.com/macedo-reis-contabilidade/macedo-reis-dashboards/32205598ee57cd5f0df6b0227a0eb3ef4c8410c7/supabase/functions/reforma-chat/servidor.js";

Deno.serve(criarServidor({ env: (k: string) => Deno.env.get(k) }));
