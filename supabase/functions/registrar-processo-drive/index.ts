// ============================================================
// MACEDO & REIS - Edge Function: registrar-processo-drive (v13)
// v13: ação criar_pasta_cliente — idempotente: confirma a pasta já
// vinculada, localiza por nome na raiz de clientes ou cria com as
// subpastas padrão, e grava drive_folder_id + drive_folder_url.
// A ação padrão também passa a gravar o drive_folder_id (antes só a URL).
// v10: salvar_societario acha a pasta SOCIETARIO por aproximação
// (acentos/variações) e o erro lista as candidatas vistas.
// IMPLANTADA em 04/09/2026 pelo Claude web via MCP (versão 13 no Supabase);
// este arquivo é a fonte de edição.
// ============================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const DRIVE_API_URL = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";
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
const ok = (origin: string | null, obj: unknown) =>
  new Response(JSON.stringify(obj), { headers: cors(origin) });

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

function folderIdFromUrl(url: string): string | null {
  const m = String(url).match(/folders\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

async function pastaValida(token: string, id: string): Promise<boolean> {
  // fields=id,trashed: pasta na lixeira responde 200 no GET — sem checar trashed,
  // um vínculo pra pasta jogada fora seria confirmado como "existente" pra sempre
  const r = await fetch(`${DRIVE_API_URL}/${id}?fields=id,trashed`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return false;
  const meta = await r.json();
  return !meta.trashed;
}

async function findChildFolder(token: string, parentId: string, nome: string): Promise<string | null> {
  const q = encodeURIComponent(
    `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );
  const res = await fetch(`${DRIVE_API_URL}?q=${q}&fields=files(id,name)&pageSize=200`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Falha ao listar subpastas: ${await res.text()}`);
  const files = (await res.json()).files || [];
  const alvo = nome.trim().toLowerCase();
  const hit = files.find((f: any) => String(f.name).trim().toLowerCase() === alvo);
  return hit ? hit.id : null;
}

async function createFolder(token: string, name: string, parentId: string): Promise<string> {
  const res = await fetch(`${DRIVE_API_URL}?fields=id,name`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }),
  });
  if (!res.ok) throw new Error(`Falha ao criar pasta "${name}": ${await res.text()}`);
  return (await res.json()).id;
}

function normNome(s: string): string {
  return String(s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

async function findClienteFolder(token: string, parentId: string, nomeCliente: string, estrito = false): Promise<{ id: string; name: string } | null> {
  const q = encodeURIComponent(
    `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );
  const res = await fetch(`${DRIVE_API_URL}?q=${q}&fields=files(id,name)&pageSize=1000`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Falha ao listar pastas de clientes: ${await res.text()}`);
  const files = (await res.json()).files || [];
  const alvo = normNome(nomeCliente);
  if (!alvo) return null;
  let hit = files.find((f: any) => normNome(f.name) === alvo);
  if (hit) return { id: hit.id, name: hit.name };
  // modo estrito (criar_pasta_cliente): só o match exato normalizado vale — o fuzzy
  // por substring pode casar com a pasta de OUTRO cliente e o vínculo fica gravado;
  // pasta duplicada se conserta à mão, vínculo errado vaza documento de cliente
  if (estrito) return null;
  if (alvo.length >= 6) {
    hit = files.find((f: any) => { const n = normNome(f.name); return n.includes(alvo) || alvo.includes(n); });
    if (hit) return { id: hit.id, name: hit.name };
  }
  return null;
}

async function uploadFile(token: string, parentId: string, nome: string, mime: string, base64: string): Promise<{ id: string; name: string }> {
  const limpo = String(base64).replace(/^data:[^;]+;base64,/, "");
  const bytes = Uint8Array.from(atob(limpo), (c) => c.charCodeAt(0));
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

  const res = await fetch(`${DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id,name`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!res.ok) throw new Error(`Falha no upload de "${nome}": ${await res.text()}`);
  return await res.json();
}

async function listSubfolders(token: string, parentId: string): Promise<{ id: string; name: string; modifiedTime: string }[]> {
  const q = encodeURIComponent(
    `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );
  const res = await fetch(`${DRIVE_API_URL}?q=${q}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc&pageSize=200`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Falha ao listar subpastas: ${await res.text()}`);
  return (await res.json()).files || [];
}

async function listPdfs(token: string, parentId: string): Promise<{ id: string; name: string }[]> {
  const q = encodeURIComponent(
    `'${parentId}' in parents and mimeType='application/pdf' and trashed=false`,
  );
  const res = await fetch(`${DRIVE_API_URL}?q=${q}&fields=files(id,name)&orderBy=name&pageSize=200`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Falha ao listar arquivos: ${await res.text()}`);
  return (await res.json()).files || [];
}

async function downloadAsBase64(token: string, fileId: string): Promise<string> {
  const res = await fetch(`${DRIVE_API_URL}/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Falha ao baixar arquivo: ${await res.text()}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    bin += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + chunk)) as any);
  }
  return btoa(bin);
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(origin) });
  if (req.method !== "POST") {
    return ok(origin, { error: "Method not allowed" });
  }

  try {
    const body = await req.json();
    const { acao, drive_folder_url, nome_processo, arquivos, cliente_id, nome_cliente } = body;
    console.log("[rpd] entrada", { acao: acao || "upload", temUrl: !!drive_folder_url, nome_cliente, arquivos: (arquivos || []).length });

    const faltando = ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET", "GOOGLE_OAUTH_REFRESH_TOKEN"]
      .filter((k) => !Deno.env.get(k));
    if (faltando.length) {
      console.error("[rpd] secrets ausentes:", faltando);
      return ok(origin, { error: `Secrets ausentes: ${faltando.join(", ")}` });
    }
    const token = await getAccessToken();
    console.log("[rpd] token ok");

    const supa = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    async function resolverPastaCliente(): Promise<string | null> {
      const byUrl = folderIdFromUrl(drive_folder_url || "");
      if (byUrl) {
        if (await pastaValida(token, byUrl)) { console.log("[rpd] pasta cliente via URL", byUrl); return byUrl; }
        console.log("[rpd] URL salva é fantasma (era SA) — caindo pra busca por nome");
      }
      if (!nome_cliente) return null;
      const { data: cfg } = await supa().from("configuracoes_escritorio").select("valor").eq("chave", "drive_pasta_clientes_id").single();
      if (!cfg?.valor) return null;
      const achada = await findClienteFolder(token, cfg.valor as string, nome_cliente);
      console.log("[rpd] pasta cliente via nome:", achada?.id);
      return achada ? achada.id : null;
    }

    if (acao === "listar_processos") {
      const cliId = await resolverPastaCliente();
      if (!cliId) return ok(origin, { error: "NAO_ACHEI_PASTA" });
      const processosId = await findChildFolder(token, cliId, "PROCESSOS");
      console.log("[rpd] PROCESSOS:", processosId);
      if (!processosId) return ok(origin, { subpastas: [] });
      const subs = await listSubfolders(token, processosId);
      return ok(origin, { subpastas: subs });
    }

    if (acao === "listar_pdfs") {
      const pastaId = body.pasta_id;
      if (!pastaId) return ok(origin, { error: "pasta_id é obrigatório" });
      const pdfs = await listPdfs(token, pastaId);
      return ok(origin, { pdfs });
    }

    if (acao === "baixar_pdf") {
      const fileId = body.file_id;
      if (!fileId) return ok(origin, { error: "file_id é obrigatório" });
      const base64 = await downloadAsBase64(token, fileId);
      return ok(origin, { base64 });
    }

    if (acao === "salvar_societario") {
      const ano = String(body.ano || new Date().getFullYear());
      const subpasta = String(body.subpasta || "").trim();
      const arq = body.arquivo;
      if (!subpasta || !arq?.base64 || !arq?.nome) {
        return ok(origin, { error: "subpasta e arquivo{nome, base64} são obrigatórios" });
      }
      const qSoc = encodeURIComponent(`name contains 'SOCIET' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
      const rSoc = await fetch(`${DRIVE_API_URL}?q=${qSoc}&fields=files(id,name)&pageSize=20`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!rSoc.ok) throw new Error(`Falha ao localizar SOCIETARIO: ${await rSoc.text()}`);
      const cand = ((await rSoc.json()).files || []) as any[];
      console.log("[rpd] candidatas SOCIETARIO:", cand.map((f) => f.name).join(" | ") || "nenhuma");
      const socs = cand.filter((f) => normNome(f.name) === "SOCIETARIO");
      if (!socs.length) {
        return ok(origin, { error: `Pasta SOCIETARIO não encontrada no Drive (candidatas vistas: ${cand.map((f) => f.name).join(", ") || "nenhuma"})` });
      }
      const socId = socs[0].id;
      console.log("[rpd] SOCIETARIO:", socId);
      let andId = await findChildFolder(token, socId, "PROCESSOS EM ANDAMENTO");
      if (!andId) andId = await createFolder(token, "PROCESSOS EM ANDAMENTO", socId);
      let anoId = await findChildFolder(token, andId, ano);
      if (!anoId) anoId = await createFolder(token, ano, andId);
      let subId = await findChildFolder(token, anoId, subpasta);
      if (!subId) { subId = await createFolder(token, subpasta, anoId); console.log("[rpd] subpasta criada:", subpasta); }
      const up = await uploadFile(token, subId, arq.nome,
        arq.mime || "application/vnd.openxmlformats-officedocument.wordprocessingml.document", arq.base64);
      const url = `https://drive.google.com/drive/folders/${subId}`;
      console.log("[rpd] societario salvo:", up.name, "em", subpasta);
      return ok(origin, { success: true, folder_id: subId, folder_url: url, arquivo: up.name });
    }

    if (acao === "criar_pasta_cliente") {
      if (!cliente_id) return ok(origin, { error: "cliente_id é obrigatório" });
      const nome = String(nome_cliente || "").trim();
      // normNome vazio (nome só de pontuação) nunca casaria na busca — cada chamada
      // criaria mais uma pasta duplicada; melhor recusar e mandar arrumar o cadastro
      if (!nome || !normNome(nome)) return ok(origin, { error: "Cliente sem nome utilizável — arrume o nome no cadastro antes de criar a pasta." });
      const supabase = supa();
      const { data: cli, error: eCli } = await supabase.from("clientes")
        .select("drive_folder_id, drive_folder_url").eq("id", cliente_id).single();
      if (eCli) return ok(origin, { error: `Cliente não encontrado: ${eCli.message}` });

      // 1) já vinculado (id direto ou só a URL legada) e a pasta ainda existe → só confirma
      const idSalvo = cli?.drive_folder_id || folderIdFromUrl(cli?.drive_folder_url || "");
      if (idSalvo && await pastaValida(token, idSalvo)) {
        const url = `https://drive.google.com/drive/folders/${idSalvo}`;
        await supabase.from("clientes").update({ drive_folder_id: idSalvo, drive_folder_url: url }).eq("id", cliente_id);
        console.log("[rpd] criar_pasta_cliente: já vinculada", idSalvo);
        return ok(origin, { success: true, folder_id: idSalvo, folder_url: url, origem: "existente" });
      }

      const { data: cfg } = await supabase.from("configuracoes_escritorio")
        .select("valor").eq("chave", "drive_pasta_clientes_id").single();
      if (!cfg?.valor) {
        return ok(origin, { error: "drive_pasta_clientes_id não configurado em configuracoes_escritorio" });
      }
      const raiz = cfg.valor as string;

      // 2) procurar por nome na raiz (modo ESTRITO: só match exato normalizado —
      // sem fuzzy, pra nunca vincular a pasta de outro cliente); 3) não achou → criar
      const achadaEstrita = await findClienteFolder(token, raiz, nome, true);
      let folderId = achadaEstrita ? achadaEstrita.id : null;
      let folderName = achadaEstrita ? achadaEstrita.name : nome;
      let origem: "localizada" | "criada" = "localizada";
      let subFalhas = 0;
      if (!folderId) {
        folderId = await createFolder(token, nome, raiz);
        const subs = await Promise.allSettled(SUBPASTAS.map((n) => createFolder(token, n, folderId!)));
        subFalhas = subs.filter((s) => s.status === "rejected").length;
        folderName = nome;
        origem = "criada";
        // corrida: outro usuário pode ter vinculado o mesmo cliente enquanto criávamos —
        // se apareceu um id no banco nesse meio-tempo, o dele vale e a nossa vira órfã
        const { data: recheca } = await supabase.from("clientes")
          .select("drive_folder_id").eq("id", cliente_id).single();
        if (recheca?.drive_folder_id && recheca.drive_folder_id !== folderId) {
          console.log("[rpd] criar_pasta_cliente: corrida — mantendo", recheca.drive_folder_id, "e deixando órfã", folderId);
          const url0 = `https://drive.google.com/drive/folders/${recheca.drive_folder_id}`;
          return ok(origin, { success: true, folder_id: recheca.drive_folder_id, folder_url: url0, origem: "existente" });
        }
      }
      const url = `https://drive.google.com/drive/folders/${folderId}`;
      const { error: eUp } = await supabase.from("clientes")
        .update({ drive_folder_id: folderId, drive_folder_url: url }).eq("id", cliente_id);
      if (eUp) return ok(origin, { error: `Pasta ${origem}, mas falhou ao gravar no cliente: ${eUp.message}` });
      console.log("[rpd] criar_pasta_cliente:", origem, folderId, "subFalhas:", subFalhas);
      return ok(origin, { success: true, folder_id: folderId, folder_url: url, origem, folder_name: folderName, subpastas_falharam: subFalhas });
    }

    // ===== Ação padrão: registrar processo (subir arquivos) =====
    if (!nome_processo) {
      return ok(origin, { error: "nome_processo é obrigatório" });
    }

    let clienteFolderId = folderIdFromUrl(drive_folder_url || "");
    let achadaPorNome = false;
    let pastaCriada = false;

    if (clienteFolderId && !(await pastaValida(token, clienteFolderId))) {
      console.log("[rpd] URL salva é fantasma (pasta inacessível — era SA). Ignorando e recomeçando por nome.");
      clienteFolderId = null;
    }

    if (!clienteFolderId) {
      if (!nome_cliente) {
        return ok(origin, { error: "Cliente sem pasta vinculada e sem nome para localizar. Informe nome_cliente ou crie a pasta." });
      }
      const supabase = supa();
      const { data: cfg } = await supabase.from("configuracoes_escritorio")
        .select("valor").eq("chave", "drive_pasta_clientes_id").single();
      if (!cfg?.valor) {
        return ok(origin, { error: "drive_pasta_clientes_id não configurado em configuracoes_escritorio" });
      }
      const achadaPadrao = await findClienteFolder(token, cfg.valor as string, nome_cliente);
      clienteFolderId = achadaPadrao ? achadaPadrao.id : null;
      if (!clienteFolderId) {
        console.log("[rpd] pasta do cliente inexistente — criando nova (OAuth) com subpastas padrão");
        clienteFolderId = await createFolder(token, nome_cliente, cfg.valor as string);
        await Promise.allSettled(SUBPASTAS.map((n) => createFolder(token, n, clienteFolderId!)));
        pastaCriada = true;
      }
      achadaPorNome = true;
      if (cliente_id) {
        const url = `https://drive.google.com/drive/folders/${clienteFolderId}`;
        await supabase.from("clientes").update({ drive_folder_id: clienteFolderId, drive_folder_url: url }).eq("id", cliente_id);
      }
    }
    console.log("[rpd] cliente folder:", clienteFolderId, "porNome:", achadaPorNome, "criada:", pastaCriada);

    let processosId = await findChildFolder(token, clienteFolderId, "PROCESSOS");
    if (!processosId) {
      processosId = await createFolder(token, "PROCESSOS", clienteFolderId);
      console.log("[rpd] PROCESSOS criada:", processosId);
    } else console.log("[rpd] PROCESSOS existente:", processosId);

    let processoId = await findChildFolder(token, processosId, nome_processo);
    if (!processoId) {
      processoId = await createFolder(token, nome_processo, processosId);
      console.log("[rpd] subpasta do processo criada:", processoId);
    } else console.log("[rpd] subpasta do processo existente:", processoId);
    const processoUrl = `https://drive.google.com/drive/folders/${processoId}`;

    const enviados: string[] = [];
    const falhas: { nome: string; erro: string }[] = [];
    for (const a of (arquivos || [])) {
      if (!a?.base64 || !a?.nome) continue;
      try {
        console.log("[rpd] subindo", a.nome, "b64len:", String(a.base64).length);
        const up = await uploadFile(token, processoId, a.nome, a.mime, a.base64);
        enviados.push(up.name);
        console.log("[rpd] ok", up.name);
      } catch (e: any) {
        console.error("[rpd] falha upload", a.nome, e?.message);
        falhas.push({ nome: a.nome, erro: e?.message || String(e) });
      }
    }
    console.log("[rpd] fim — enviados:", enviados.length, "falhas:", falhas.length);

    return ok(origin, {
      success: true,
      cliente_folder_id: clienteFolderId,
      cliente_folder_url: `https://drive.google.com/drive/folders/${clienteFolderId}`,
      achada_por_nome: achadaPorNome,
      pasta_criada: pastaCriada,
      processo_folder_id: processoId,
      processo_folder_url: processoUrl,
      enviados,
      falhas,
    });
  } catch (e: any) {
    console.error("[rpd] ERRO GERAL:", e?.message, e?.stack?.slice(0, 300));
    return ok(origin, { error: e?.message || String(e) });
  }
});
