import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { criarServidor } from "https://raw.githubusercontent.com/macedo-reis-contabilidade/macedo-reis-dashboards/b9a3a8f24996e49b67ed5534a9d724fddafd3911/supabase/functions/ponte/servidor.js";

// os segredos do Google (o Drive do relatório de situação fiscal, 09/11/2026) são lidos aqui, na hora, e só eles
const SEGREDOS = new Set(["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET", "GOOGLE_OAUTH_REFRESH_TOKEN"]);

Deno.serve(criarServidor({
  criarDb: () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } }),
  env: (k: string) => (SEGREDOS.has(k) ? Deno.env.get(k) ?? null : null),
}));
