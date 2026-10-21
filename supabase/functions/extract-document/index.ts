// ============================================================
// MACEDO & REIS — Edge Function extract-document: a leitura de documentos (contrato, cartão CNPJ, alvará, convenção,
// relatórios do Fator R, pareceres). A lógica está em servidor.ts e quadro.js, no repositório; a função importa esse código
// do arquivo cru do GitHub, no commit fixado abaixo: roda exatamente o que estava naquele commit. Mudou o servidor.ts ou o
// que ele importa? Publique, troque o commit daqui, publique de novo e reimplante — o teste avisa quando ficou pra trás.
// verify_jwt = true · segredo: ANTHROPIC_API_KEY
// ============================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { atender } from "https://raw.githubusercontent.com/macedo-reis-contabilidade/macedo-reis-dashboards/0000000000000000000000000000000000000000/supabase/functions/extract-document/servidor.ts";

Deno.serve(atender);
