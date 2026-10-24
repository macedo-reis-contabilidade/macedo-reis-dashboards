// ============================================================
// MACEDO & REIS - Edge Function: create-drive-folder — DESLIGADA em 24/10/2026 (com o ok do Samuel)
// Criava a pasta do cliente no Drive e trocava o drive_folder_url do cadastro. Nenhuma tela a chamava (a pasta do
// cliente nasce pelo "Registrar processo", na registrar-processo-drive) e, até 24/10, sem conferir quem chamava, ela
// atendia qualquer um com a chave pública. O conector do Supabase não apaga função: esta versão só responde que está
// desligada — sem Drive, sem banco e sem segredo nenhum. Apagar de vez é no painel do Supabase (Edge Functions).
// O código antigo está no histórico do repositório (commit d4a4410).
// ============================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

Deno.serve((req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  return new Response(JSON.stringify({ error: "Esta função foi desligada em 24/10/2026." }), { status: 410, headers: cors });
});
