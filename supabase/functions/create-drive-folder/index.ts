// ============================================================
// MACEDO & REIS - Edge Function: create-drive-folder (v6)
// Cria pasta do cliente no Drive (com subpastas setoriais)
// e atualiza drive_folder_url no banco.
// v6: OAuth refresh token da conta Google dona do Drive do escritório.
// Service Account aposentada — pastas criadas por ela ficavam
// invisíveis à conta dona.
// ============================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const DRIVE_API_URL = "https://www.googleapis.com/drive/v3/files";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

const SUBPASTAS = [
  "Documentos Constitutivos",
  "Fiscal",
  "Departamento Pessoal",
  "Contábil",
  "Societário",
  "Financeiro",
];

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
  };
}

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

async function getAccessToken(): Promise<string> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_OAUTH_CLIENT_ID") || "",
      client_secret: Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET") || "",
      refresh_token: Deno.env.get("GOOGLE_OAUTH_REFRESH_TOKEN") || "",
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Falha na autenticação Google (OAuth): ${await res.text()}`);
  const data = await res.json();
  if (!data.access_token) throw new Error(`OAuth sem access_token: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function createDriveFolder(
  accessToken: string,
  name: string,
  parentId: string,
): Promise<{ id: string; name: string }> {
  const res = await fetch(`${DRIVE_API_URL}?fields=id,name`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Falha ao criar pasta "${name}": ${err}`);
  }

  return await res.json();
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors(origin) });
  }
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: cors(origin) },
    );
  }
  if (!(await quemChama(req))) {
    return new Response(JSON.stringify({ error: "Entre no sistema pra usar esta função." }), { status: 401, headers: cors(origin) });
  }

  try {
    const { cliente_id, nome_cliente } = await req.json();

    if (!cliente_id || !nome_cliente) {
      return new Response(
        JSON.stringify({
          error: "cliente_id e nome_cliente são obrigatórios",
        }),
        { status: 400, headers: cors(origin) },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Lê folder_id da pasta-pai
    const { data: config, error: configErr } = await supabase
      .from("configuracoes_escritorio")
      .select("valor")
      .eq("chave", "drive_pasta_clientes_id")
      .single();

    if (configErr || !config?.valor) {
      return new Response(
        JSON.stringify({
          error:
            "drive_pasta_clientes_id não configurado em configuracoes_escritorio",
        }),
        { status: 500, headers: cors(origin) },
      );
    }
    const parentId = config.valor as string;

    // Autentica no Google (conta dona)
    const accessToken = await getAccessToken();

    // Cria pasta principal do cliente
    const mainFolder = await createDriveFolder(
      accessToken,
      nome_cliente,
      parentId,
    );
    const folderUrl =
      `https://drive.google.com/drive/folders/${mainFolder.id}`;

    // Cria subpastas em paralelo
    const subResults = await Promise.allSettled(
      SUBPASTAS.map((name) =>
        createDriveFolder(accessToken, name, mainFolder.id)
      ),
    );

    const subsCriadas = subResults.filter((r) => r.status === "fulfilled").length;
    const subsFalharam = SUBPASTAS.length - subsCriadas;

    // Atualiza drive_folder_url do cliente
    const { error: updateErr } = await supabase
      .from("clientes")
      .update({ drive_folder_url: folderUrl })
      .eq("id", cliente_id);

    if (updateErr) {
      return new Response(
        JSON.stringify({
          success: true,
          folder_url: folderUrl,
          folder_id: mainFolder.id,
          subpastas_criadas: subsCriadas,
          subpastas_falharam: subsFalharam,
          warning:
            `Pasta criada, mas erro ao atualizar cliente no banco: ${updateErr.message}`,
        }),
        { headers: cors(origin) },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        folder_url: folderUrl,
        folder_id: mainFolder.id,
        subpastas_criadas: subsCriadas,
        subpastas_falharam: subsFalharam,
      }),
      { headers: cors(origin) },
    );
  } catch (e: any) {
    console.error("create-drive-folder error:", e);
    return new Response(
      JSON.stringify({
        error: e?.message || String(e),
      }),
      { status: 500, headers: cors(origin) },
    );
  }
});
