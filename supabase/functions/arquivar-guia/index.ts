// ============================================================
// MACEDO & REIS - Edge Function: arquivar-guia
// Recebe uma guia (PDF/imagem) e arquiva no Drive em:
//   SETOR FISCAL > {pasta da obrigação} > {competência MM-AAAA}
// v5 — Autentica como a CONTA DONA do Drive do escritório via OAuth
// refresh token: acha/cria pastas e sobe o arquivo com a mesma identidade.
// Sem service account, sem compartilhamento, sem trava de cota.
// Registra na tabela guias_arquivadas.
//
// Espera POST JSON:
// {
//   "cliente_id": "uuid",
//   "obrigacao_id": "uuid",
//   "pasta_obrigacao": "PGDAS-D",          // pasta_drive || nome da regra
//   "competencia": "07-2026",               // MM-AAAA
//   "arquivo": { "nome": "X.pdf", "mime": "application/pdf", "base64": "..." },
//   "subido_por": "email de quem subiu"
// }
// ============================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const DRIVE_API_URL = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE_DRIVE = "https://www.googleapis.com/auth/drive";

// Google solta 500/503 passageiros com frequência — insiste com espera progressiva
async function fetchComRetry(url: string, init: RequestInit, tentativas = 3): Promise<Response> {
  let ultima: Response | null = null;
  for (let t = 1; t <= tentativas; t++) {
    const res = await fetch(url, init);
    if (res.ok) return res;
    ultima = res;
    if (![429, 500, 502, 503, 504].includes(res.status) || t === tentativas) return res;
    await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, t - 1)));
  }
  return ultima!;
}

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
  const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GOOGLE_OAUTH_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Secrets GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_OAUTH_REFRESH_TOKEN não configurados");
  }
  const res = await fetchComRetry(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Falha na autenticação Google (refresh token): ${await res.text()}`);
  return (await res.json()).access_token;
}

// procura uma subpasta pelo nome dentro de um parent (case-insensitive)
async function findChildFolder(token: string, parentId: string, nome: string): Promise<string | null> {
  const q = encodeURIComponent(
    `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );
  const res = await fetchComRetry(`${DRIVE_API_URL}?q=${q}&fields=files(id,name)&pageSize=200`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Falha ao listar subpastas: ${await res.text()}`);
  const files = (await res.json()).files || [];
  const alvo = nome.trim().toLowerCase();
  const hit = files.find((f: any) => String(f.name).trim().toLowerCase() === alvo);
  return hit ? hit.id : null;
}

async function createFolder(token: string, name: string, parentId: string): Promise<string> {
  const res = await fetchComRetry(`${DRIVE_API_URL}?fields=id,name`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }),
  });
  if (!res.ok) throw new Error(`Falha ao criar pasta "${name}": ${await res.text()}`);
  return (await res.json()).id;
}

async function findOrCreateFolder(token: string, parentId: string, nome: string): Promise<string> {
  const achada = await findChildFolder(token, parentId, nome);
  if (achada) return achada;
  return await createFolder(token, nome, parentId);
}

async function uploadFile(token: string, parentId: string, nome: string, mime: string, base64: string): Promise<{ id: string; name: string }> {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const boundary = "mr_" + crypto.randomUUID();
  const meta = JSON.stringify({ name: nome, parents: [parentId] });

  const pre = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${mime || "application/octet-stream"}\r\n\r\n`;
  const post = `\r\n--${boundary}--`;

  const preBytes = new TextEncoder().encode(pre);
  const postBytes = new TextEncoder().encode(post);
  const body = new Uint8Array(preBytes.length + bytes.length + postBytes.length);
  body.set(preBytes, 0);
  body.set(bytes, preBytes.length);
  body.set(postBytes, preBytes.length + bytes.length);

  const res = await fetchComRetry(`${DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id,name`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!res.ok) throw new Error(`Falha no upload de "${nome}": ${await res.text()}`);
  return await res.json();
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(origin) });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: cors(origin) });
  }
  if (!(await quemChama(req))) {
    return new Response(JSON.stringify({ error: "Entre no sistema pra usar esta função." }), { status: 401, headers: cors(origin) });
  }

  try {
    const body = await req.json();
    // ---------- ação: baixar (devolve o arquivo do Drive em base64) ----------
    if (body.acao === "baixar") {
      const fileId = body.drive_file_id;
      if (!fileId) {
        return new Response(JSON.stringify({ error: "drive_file_id é obrigatório na ação baixar" }),
          { status: 400, headers: cors(origin) });
      }
      const token = await getAccessToken();
      const metaRes = await fetchComRetry(`${DRIVE_API_URL}/${fileId}?fields=name,mimeType`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!metaRes.ok) throw new Error(`Falha ao ler o arquivo: ${await metaRes.text()}`);
      const meta = await metaRes.json();
      const binRes = await fetchComRetry(`${DRIVE_API_URL}/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!binRes.ok) throw new Error(`Falha ao baixar o arquivo: ${await binRes.text()}`);
      const buf = new Uint8Array(await binRes.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i += 32768) bin += String.fromCharCode(...buf.subarray(i, i + 32768));
      return new Response(JSON.stringify({ success: true, nome: meta.name, mime: meta.mimeType, base64: btoa(bin) }),
        { headers: cors(origin) });
    }

    const { cliente_id, obrigacao_id, pasta_obrigacao, competencia, arquivo, subido_por } = body;

    if (!cliente_id || !obrigacao_id || !pasta_obrigacao || !competencia || !arquivo?.base64 || !arquivo?.nome) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios: cliente_id, obrigacao_id, pasta_obrigacao, competencia, arquivo{nome,base64}" }),
        { status: 400, headers: cors(origin) });
    }
    if (!/^\d{2}-\d{4}$/.test(String(competencia))) {
      return new Response(JSON.stringify({ error: "competencia deve estar no formato MM-AAAA (ex.: 07-2026)" }),
        { status: 400, headers: cors(origin) });
    }

    const token = await getAccessToken();

    // pasta raiz do setor fiscal, vinda das configurações do escritório
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: cfg } = await supabase.from("configuracoes_escritorio")
      .select("valor").eq("chave", "drive_pasta_setor_fiscal_id").single();
    if (!cfg?.valor || cfg.valor === "COLE_AQUI_O_ID") {
      return new Response(JSON.stringify({ error: "drive_pasta_setor_fiscal_id não configurado em configuracoes_escritorio" }),
        { status: 500, headers: cors(origin) });
    }

    // SETOR FISCAL > {obrigação} > {MM-AAAA} — cria o que faltar
    const pastaObrigacaoId = await findOrCreateFolder(token, cfg.valor as string, String(pasta_obrigacao));
    const pastaCompetenciaId = await findOrCreateFolder(token, pastaObrigacaoId, String(competencia));

    const up = await uploadFile(token, pastaCompetenciaId, arquivo.nome, arquivo.mime, arquivo.base64);
    const fileUrl = `https://drive.google.com/file/d/${up.id}/view`;

    // registro no banco (o link que o futuro envio ao cliente vai usar)
    const { error: eReg } = await supabase.from("guias_arquivadas").insert({
      cliente_id,
      obrigacao_id,
      competencia: String(competencia),
      nome_arquivo: up.name,
      drive_file_id: up.id,
      drive_file_url: fileUrl,
      subido_por: subido_por || null,
    });

    return new Response(JSON.stringify({
      success: true,
      file_id: up.id,
      file_url: fileUrl,
      pasta_competencia_url: `https://drive.google.com/drive/folders/${pastaCompetenciaId}`,
      registro_ok: !eReg,
      registro_erro: eReg ? eReg.message : null,
    }), { headers: cors(origin) });
  } catch (e: any) {
    console.error("arquivar-guia error:", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: cors(origin) });
  }
});
