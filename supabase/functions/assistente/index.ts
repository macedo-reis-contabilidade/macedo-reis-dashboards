// ============================================================
// MACEDO & REIS — Edge Function assistente: o assistente do escritório (o balão de todas as telas com login)
// A lógica está em servidor.js e nos módulos ao lado (testados no node: tests/assistente-funcao.test.mjs), com o laço do
// modelo do chat da Reforma (../reforma-chat/agente.js) e a regra das rotinas da agenda (assets/js/rotinas-dia.js). A
// função importa esse código do repositório (o arquivo cru do GitHub), no commit fixado abaixo: roda exatamente o que
// estava naquele commit. Mudou algum desses arquivos? Publique, troque o commit daqui pelo novo, publique de novo e
// reimplante a função — o teste avisa quando o commit fixado ficou pra trás.
// verify_jwt = true · segredos: ANTHROPIC_API_KEY (o mesmo do chat da Reforma) e, pra ler a lista dos arquivos da empresa no
// Drive (16/10/2026), GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET e GOOGLE_OAUTH_REFRESH_TOKEN (os do "Registrar processo").
// EdgeRuntime.waitUntil: trocou de tela no meio da resposta, a pergunta segue até o fim e a resposta fica no histórico.
// ============================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { criarServidor } from "https://raw.githubusercontent.com/macedo-reis-contabilidade/macedo-reis-dashboards/9158060787d80b60d25ab1237c2fc252362aa3f0/supabase/functions/assistente/servidor.js";

Deno.serve(criarServidor({ env: (k: string) => Deno.env.get(k), aguardar: (p: Promise<unknown>) => EdgeRuntime.waitUntil(p) }));
