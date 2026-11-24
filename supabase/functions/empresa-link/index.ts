// ============================================================
// MACEDO & REIS - Edge Function: empresa-link (24/11/2026, pedido do Samuel)
// O link público da constituição de CNPJ e da transformação do MEI em ME (empresa.html?t=constituicao ou ?t=transformacao):
// o cliente preenche os dados da empresa e de cada sócio e anexa o documento de cada sócio. O Samuel: "cria um forms com
// link pra eu enviar pro cliente poder preencher as informações e anexar os documentos, se nao ele tem que enviar pra mim
// por email ou whats e dificulta mais (tanto pra transformação quanto para constituição)".
// O pedido nasce em pedidos_empresa e, pelo gatilho do banco (empresa_sincronizar_tarefa), na agenda do Samuel (Societário),
// com o resumo e o link da pasta, e o aviso na conversa Avisos do sistema. As perguntas e a conferência são as de
// assets/js/empresa-pedido.js, importado do repositório num commit fixado (abaixo), como o resto do sistema faz.
// A pasta: CONSTITUIÇÕES E TRANSFORMAÇÕES > A 1ª OPÇÃO DE RAZÃO SOCIAL, no Drive, com as respostas inteiras num arquivo de
// texto e os documentos de cada sócio ("SÓCIO 1 - NOME - arquivo"). Na primeira vez, a função acha (ou cria) a pasta
// CONSTITUIÇÕES E TRANSFORMAÇÕES ao lado da ABERTURAS MEI (a do Societário no BANCO DE INFORMAÇÕES) e guarda o id em
// configuracoes_escritorio.drive_pasta_empresas_id. O envio dos documentos em partes é o das admissões (o bloco "anexos no
// Drive" é cópia do admissao-link, pelo mei-link); o nome e o tamanho de cada documento são os que a conferência gravou.
//
// verify_jwt = true (regra 10): a página chama com a chave anônima; aqui dentro grava com a chave de servidor — nenhuma
// tabela fica aberta. Trava de 30 pedidos por hora.
// Ações (corpo JSON, campo "acao"):
//   enviar   — confere as respostas e os anexos (o documento de cada sócio) e grava o pedido; cria a pasta e o arquivo das
//              respostas; devolve { id, chave } (a chave, pra subir os documentos)
//   arquivo  — abre o envio de um documento no Drive (sessão resumível), pelo número dele na lista gravada
//   concluir — fecha o envio (a chave deixa de valer)
//   teste    — diagnóstico interno (exige x-sync-key): acha (ou cria) a pasta CONSTITUIÇÕES E TRANSFORMAÇÕES, sobe um
//              arquivo de teste em 2 partes e manda a pasta de teste pra lixeira
// Partes dos documentos: corpo binário com o cabeçalho x-acao: parte (x-id, x-chave, x-i, x-inicio, x-total).
// ============================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
// as perguntas, a conferência, o resumo e o nome dos anexos (os da página) vêm do repositório, no commit fixado: a função
// roda o que estava nele. Mudou assets/js/empresa-pedido.js (ou o mei-abertura.js e o utils.js, que ele importa)? Publique,
// troque o commit da linha e reimplante — tests/empresa-pedido.test.mjs falha enquanto o commit fixado estiver atrás.
import { conferirPedido, resumoDoPedido, textoDasRespostas, alertasDoPedido, nomeDoAnexo, pastaDoPedido } from "https://raw.githubusercontent.com/macedo-reis-contabilidade/macedo-reis-dashboards/b12c608ca07c43a402009b15435043aa00cc5a69/assets/js/empresa-pedido.js";

const ENVIOS_HORA = 30;                  // trava contra enxurrada (o link é público)
const TABELA = "pedidos_empresa";

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-acao, x-id, x-chave, x-i, x-inicio, x-total, x-sync-key",
    "Content-Type": "application/json",
  };
}
const resp = (origin: string | null, obj: unknown) => new Response(JSON.stringify(obj), { headers: cors(origin) });
const db = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

const normNome = (s: string) =>
  String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
const txt = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

// ---------- anexos no Drive (cópia do admissao-link) ----------
const DRIVE = "https://www.googleapis.com/drive/v3/files";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const FOLDER = "application/vnd.google-apps.folder";
const MAX_ARQ = 25 * 1024 * 1024;      // 25 MB por arquivo
const MAX_QTD = 20;                      // anexos por envio
const MAX_TOTAL = 100 * 1024 * 1024;    // 100 MB por envio
const HORAS_CHAVE = 3;                   // tempo pra terminar de subir os anexos

let tok = { v: "", ate: 0 };
async function token(): Promise<string> {
  if (tok.v && Date.now() < tok.ate) return tok.v;
  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_OAUTH_CLIENT_ID") || "",
      client_secret: Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET") || "",
      refresh_token: Deno.env.get("GOOGLE_OAUTH_REFRESH_TOKEN") || "",
      grant_type: "refresh_token",
    }),
  });
  if (!r.ok) throw new Error("Google OAuth: " + (await r.text()).slice(0, 300));
  const d = await r.json();
  if (!d.access_token) throw new Error("Google OAuth sem access_token");
  tok = { v: d.access_token, ate: Date.now() + Math.max(60, (d.expires_in || 3600) - 300) * 1000 };
  return tok.v;
}

// nome de pasta/arquivo no Drive: sem barra nem caractere de controle
const seguro = (s: string, max = 150) =>
  String(s || "").replace(/[\u0000-\u001f\/\\]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const hojeBR = () => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(new Date()).replaceAll("/", "-");

// comparar: normNome (pasta do funcionário) ou chaveNome (pasta da empresa: "PADARIA X" e "PADARIA X LTDA" são a mesma)
async function filhoPorNome(t: string, pai: string, nome: string, comparar = normNome): Promise<string | null> {
  const q = encodeURIComponent(`'${pai}' in parents and mimeType='${FOLDER}' and trashed=false`);
  const alvo = comparar(nome);
  if (!alvo) return null;
  let pagina = "";
  do {
    const r = await fetch(`${DRIVE}?q=${q}&fields=nextPageToken,files(id,name)&pageSize=1000${pagina ? "&pageToken=" + pagina : ""}`, {
      headers: { Authorization: `Bearer ${t}` },
    });
    if (!r.ok) throw new Error("Drive (listar): " + (await r.text()).slice(0, 300));
    const d = await r.json();
    const hit = (d.files || []).find((f: { name: string }) => comparar(f.name) === alvo);
    if (hit) return hit.id;
    pagina = d.nextPageToken || "";
  } while (pagina);
  return null;
}
async function criarPasta(t: string, nome: string, pai: string): Promise<string> {
  const r = await fetch(`${DRIVE}?fields=id`, {
    method: "POST",
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: nome, mimeType: FOLDER, parents: [pai] }),
  });
  if (!r.ok) throw new Error(`Drive (criar pasta "${nome}"): ` + (await r.text()).slice(0, 300));
  return (await r.json()).id;
}
const pastaFilha = async (t: string, pai: string, nome: string, comparar = normNome) =>
  (await filhoPorNome(t, pai, nome, comparar)) || (await criarPasta(t, nome, pai));

async function sessaoResumivel(t: string, pasta: string, nome: string, tipo: string, tamanho: number): Promise<string> {
  const r = await fetch(`${UPLOAD}?uploadType=resumable&fields=id,name,size`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${t}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": tipo,
      "X-Upload-Content-Length": String(tamanho),
    },
    body: JSON.stringify({ name: nome, parents: [pasta] }),
  });
  if (!r.ok) throw new Error("Drive (abrir envio): " + (await r.text()).slice(0, 300));
  await r.body?.cancel();
  const sessao = r.headers.get("Location");
  if (!sessao) throw new Error("Drive não devolveu a sessão de envio");
  return sessao;
}
// devolve { pronto: true, meta } quando o Drive fecha o arquivo, { pronto: false } quando quer mais partes
async function enviarParte(sessao: string, bytes: Uint8Array, inicio: number, total: number) {
  const r = await fetch(sessao, {
    method: "PUT",
    headers: { "Content-Range": `bytes ${inicio}-${inicio + bytes.length - 1}/${total}` },
    body: bytes as unknown as BodyInit,
  });
  if (r.status === 308) { await r.body?.cancel(); return { pronto: false }; }
  if (r.ok) return { pronto: true, meta: await r.json() };
  throw new Error("Drive (parte): " + r.status + " " + (await r.text()).slice(0, 200));
}
// ---------- fim da cópia ----------

// ---------- a pasta das constituições e transformações ----------
// a guardada; na primeira vez, ao lado da ABERTURAS MEI (a pasta do Societário), senão a do Societário achada pelo
// BANCO DE INFORMAÇÕES (acima da SETOR DP E RH, que fica acima da ADMISSÕES), como a do mei-link — guardada pra próxima
const CHAVE_RAIZ = "drive_pasta_empresas_id";
const NOME_RAIZ = "CONSTITUIÇÕES E TRANSFORMAÇÕES";
async function raizEmpresas(supa: ReturnType<typeof db>, t: string): Promise<string> {
  const lerChave = async (chave: string) =>
    ((await supa.from("configuracoes_escritorio").select("valor").eq("chave", chave).maybeSingle()).data?.valor as string) || "";
  const guardada = await lerChave(CHAVE_RAIZ);
  if (guardada) return guardada;
  const pai = async (id: string) => {
    const m = await fetch(`${DRIVE}/${id}?fields=parents`, { headers: { Authorization: `Bearer ${t}` } });
    if (!m.ok) throw new Error("Drive (pasta acima): " + (await m.text()).slice(0, 300));
    return ((await m.json()).parents || [])[0] as string | undefined;
  };
  let societario: string | undefined;
  const mei = await lerChave("drive_pasta_mei_id");
  if (mei) societario = await pai(mei);
  if (!societario) {
    const admissoes = await lerChave("drive_pasta_admissoes_id");
    if (!admissoes) throw new Error("drive_pasta_admissoes_id não configurado");
    const setorDp = await pai(admissoes);
    const banco = setorDp ? await pai(setorDp) : undefined;
    if (!banco) throw new Error("não achei o BANCO DE INFORMAÇÕES acima da SETOR DP E RH");
    const q = encodeURIComponent(`'${banco}' in parents and mimeType='${FOLDER}' and trashed=false`);
    const r = await fetch(`${DRIVE}?q=${q}&fields=files(id,name)&pageSize=1000`, { headers: { Authorization: `Bearer ${t}` } });
    if (!r.ok) throw new Error("Drive (listar o BANCO DE INFORMAÇÕES): " + (await r.text()).slice(0, 300));
    const s = ((await r.json()).files || []).find((f: { name: string }) => normNome(f.name).includes("SOCIETARIO"));
    societario = s ? s.id : banco;
  }
  const id = await pastaFilha(t, societario!, NOME_RAIZ);
  const { error } = await supa.from("configuracoes_escritorio").insert({ chave: CHAVE_RAIZ, valor: id,
    descricao: "Pasta CONSTITUIÇÕES E TRANSFORMAÇÕES do Drive: as respostas e os documentos do link da constituição de CNPJ e da transformação do MEI em ME. A função empresa-link guarda na primeira vez." });
  if (error && error.code === "23505") return (await lerChave(CHAVE_RAIZ)) || id;   // outro envio guardou no mesmo instante
  if (error) throw new Error("guardar a pasta CONSTITUIÇÕES E TRANSFORMAÇÕES: " + error.message);
  return id;
}

// as respostas inteiras, num arquivo de texto na pasta do pedido (envio simples: o texto é pequeno)
async function subirTexto(t: string, pasta: string, nome: string, conteudo: string): Promise<string> {
  const limite = "mr" + crypto.randomUUID().replaceAll("-", "");
  const corpo = `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` + JSON.stringify({ name: nome, parents: [pasta], mimeType: "text/plain" })
    + `\r\n--${limite}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n` + conteudo + `\r\n--${limite}--`;
  const r = await fetch(`${UPLOAD}?uploadType=multipart&fields=id`, {
    method: "POST",
    headers: { Authorization: `Bearer ${t}`, "Content-Type": `multipart/related; boundary=${limite}` },
    body: new TextEncoder().encode(corpo),
  });
  if (!r.ok) throw new Error("Drive (respostas): " + (await r.text()).slice(0, 300));
  return (await r.json()).id;
}

const agoraBR = () => {
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", ...o }).format(new Date());
  return { data: f({ day: "2-digit", month: "2-digit", year: "numeric" }), hora: f({ hour: "2-digit", minute: "2-digit" }) };
};

// deno-lint-ignore no-explicit-any
async function enviar(b: any) {
  const c = conferirPedido(b);
  if (!c.pedido) return { error: c.erro || "Confira as respostas.", faltam: c.faltam || [] };
  const p = c.pedido;
  const supa = db();
  const { count } = await supa.from(TABELA).select("id", { count: "exact", head: true })
    .gte("criado_em", new Date(Date.now() - 3600e3).toISOString());
  if ((count ?? 0) >= ENVIOS_HORA) return { error: "Muitos envios agora — tente de novo mais tarde." };
  const chave = crypto.randomUUID() + crypto.randomUUID();
  // os documentos: aqui só a lista conferida (o nome, o tamanho, o tipo e de quem é); os arquivos sobem depois, com a chave
  const arquivos = (c.arquivos || []).map((a: { nome: string; tamanho: number; tipo: string; grupo: string }) =>
    ({ nome: a.nome, tamanho: a.tamanho, tipo: a.tipo, grupo: a.grupo, status: "pendente" }));
  const { data: res, error } = await supa.from(TABELA).insert({
    tipo: p.tipo, nome: p.contato.nome, telefone: p.contato.telefone, email: p.contato.email, empresa: p.razao1,
    resumo: resumoDoPedido(p), pedido: p, alertas: alertasDoPedido(p), arquivos,
    envio_chave: chave, envio_expira: new Date(Date.now() + HORAS_CHAVE * 3600e3).toISOString(),
  }).select("id").single();
  if (error) throw new Error("gravar o pedido: " + error.message);

  // a pasta do pedido, com as respostas inteiras num arquivo de texto. Sem o Drive, o pedido fica gravado (com a tarefa e
  // o resumo) e a página pede os documentos pelo WhatsApp
  let pasta: string | null = null;
  try {
    const t = await token();
    const raiz = await raizEmpresas(supa, t);
    pasta = await pastaFilha(t, raiz, seguro(pastaDoPedido(p)));
    const { data, hora } = agoraBR();
    try {
      await subirTexto(t, pasta, seguro(`Respostas do formulário (${data.replaceAll("/", "-")} ${hora.replace(":", "h")}).txt`), textoDasRespostas(p, `${data} às ${hora}`));
    } catch (e) {
      console.error("[empresa] respostas no drive:", (e as Error)?.message);
    }
    await supa.from(TABELA).update({ drive_pasta_id: pasta, drive_pasta_url: `https://drive.google.com/drive/folders/${pasta}` }).eq("id", res.id);
  } catch (e) {
    console.error("[empresa] drive:", (e as Error)?.message);
    pasta = null;
  }
  if (!pasta) await supa.from(TABELA).update({ envio_chave: null, envio_expira: null }).eq("id", res.id);
  console.log("[empresa] enviado", res.id, p.tipo, "documentos:", arquivos.length, "pasta:", !!pasta);
  return { ok: true, id: res.id, chave: pasta ? chave : null };
}

// carregar, arquivo, parte e concluir: os do mei-link (que são os do admissao-link), com a tabela dos pedidos; o nome, o
// tamanho e o tipo de cada documento vêm da lista gravada no envio, não do que a página manda agora
async function carregar(supa: ReturnType<typeof db>, id: string, chave: string) {
  if (!/^[0-9a-f-]{36}$/.test(String(id || "")) || !chave) return null;
  const { data: a } = await supa.from(TABELA).select("id, envio_chave, envio_expira, drive_pasta_id, arquivos, pedido").eq("id", id).maybeSingle();
  if (!a || !a.envio_chave || a.envio_chave !== chave || !a.envio_expira || Date.parse(a.envio_expira) < Date.now() || !a.drive_pasta_id) return null;
  return a;
}

// deno-lint-ignore no-explicit-any
async function arquivo(b: any) {
  const supa = db();
  const a = await carregar(supa, b.id, b.chave);
  if (!a) return { error: "Envio expirado ou inválido." };
  const i = Number(b.i);
  const lista = Array.isArray(a.arquivos) ? a.arquivos : [];
  const item = lista[i];
  if (!(Number.isInteger(i) && i >= 0 && i < MAX_QTD) || !item || item.status === "ok" || !(Number(item.tamanho) > 0)) return { error: "Arquivo inválido." };
  const nome = seguro(nomeDoAnexo(item.grupo, (a.pedido || {}).socios, item.nome), 200) || `arquivo-${i + 1}`;
  const sessao = await sessaoResumivel(await token(), a.drive_pasta_id, nome, txt(item.tipo, 120) || "application/octet-stream", Number(item.tamanho));
  lista[i] = { nome: item.nome, tamanho: item.tamanho, tipo: item.tipo, grupo: item.grupo, status: "enviando", sessao };
  await supa.from(TABELA).update({ arquivos: lista }).eq("id", a.id);
  return { ok: true };
}

async function parte(req: Request) {
  const h = (k: string) => req.headers.get(k) || "";
  const supa = db();
  const a = await carregar(supa, h("x-id"), h("x-chave"));
  if (!a) return { error: "Envio expirado ou inválido." };
  const i = Number(h("x-i")), inicio = Number(h("x-inicio")), total = Number(h("x-total"));
  const lista = Array.isArray(a.arquivos) ? a.arquivos : [];
  const arq = lista[i];
  if (!arq || arq.status !== "enviando" || !arq.sessao || total !== Number(arq.tamanho) || !(inicio >= 0)) return { error: "Parte inválida." };
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (!bytes.length || inicio + bytes.length > total) return { error: "Parte inválida." };
  try {
    const r = await enviarParte(arq.sessao, bytes, inicio, total);
    if (!r.pronto) return { ok: true, recebido: inicio + bytes.length };
    lista[i] = { nome: arq.nome, tamanho: arq.tamanho, tipo: arq.tipo, grupo: arq.grupo, status: "ok", drive_id: r.meta.id };
    await supa.from(TABELA).update({ arquivos: lista }).eq("id", a.id);
    return { ok: true, concluido: true };
  } catch (e) {
    console.error("[empresa] parte:", (e as Error)?.message);
    lista[i] = { nome: arq.nome, tamanho: arq.tamanho, tipo: arq.tipo, grupo: arq.grupo, status: "erro" };
    await supa.from(TABELA).update({ arquivos: lista }).eq("id", a.id);
    return { error: "O Drive recusou o arquivo." };
  }
}

// deno-lint-ignore no-explicit-any
async function concluir(b: any) {
  const supa = db();
  const a = await carregar(supa, b.id, b.chave);
  if (!a) return { ok: true };
  // deno-lint-ignore no-explicit-any
  const lista = (Array.isArray(a.arquivos) ? a.arquivos : []).map((x: any) =>
    x && (x.status === "enviando" || x.status === "pendente") ? { nome: x.nome, tamanho: x.tamanho, tipo: x.tipo, grupo: x.grupo, status: "erro" } : x);
  await supa.from(TABELA).update({ envio_chave: null, envio_expira: null, arquivos: lista }).eq("id", a.id);
  return { ok: true };
}

// diagnóstico interno (como o do mei-link; exige x-sync-key, que só o servidor lê): a conta Google, a pasta
// CONSTITUIÇÕES E TRANSFORMAÇÕES (achada ou criada na primeira vez), uma pasta de teste com um arquivo em 2 partes e as
// respostas de mentira; a pasta de teste vai pra lixeira
async function teste(req: Request) {
  const supa = db();
  const { data: k } = await supa.from("configuracoes_escritorio").select("valor").eq("chave", "ca_sync_key").maybeSingle();
  if (!k?.valor || req.headers.get("x-sync-key") !== k.valor) return { error: "sem permissão" };
  const t = await token();
  const raiz = await raizEmpresas(supa, t);
  const m = await fetch(`${DRIVE}/${raiz}?fields=id,name,trashed,parents`, { headers: { Authorization: `Bearer ${t}` } });
  if (!m.ok) return { error: "pasta CONSTITUIÇÕES E TRANSFORMAÇÕES inacessível: " + (await m.text()).slice(0, 200) };
  const meta = await m.json();
  const acima = meta.parents?.[0] ? await fetch(`${DRIVE}/${meta.parents[0]}?fields=name`, { headers: { Authorization: `Bearer ${t}` } }) : null;
  const pTeste = await criarPasta(t, "TESTE DO SISTEMA (APAGAR)", raiz);
  const texto = await subirTexto(t, pTeste, "Respostas do formulário (teste).txt", "Teste do sistema: pode apagar.\nAcentuação: ção, ã, é.");
  const bytes = new Uint8Array(300 * 1024).map((_, i) => i % 251);
  const sessao = await sessaoResumivel(t, pTeste, "teste.bin", "application/octet-stream", bytes.length);
  const p1 = await enviarParte(sessao, bytes.subarray(0, 256 * 1024), 0, bytes.length);
  const p2 = await enviarParte(sessao, bytes.subarray(256 * 1024), 256 * 1024, bytes.length);
  const lixo = await fetch(`${DRIVE}/${pTeste}`, {
    method: "PATCH", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" }, body: JSON.stringify({ trashed: true }),
  });
  return { ok: true, raiz: meta.name, pasta_acima: acima && acima.ok ? (await acima.json()).name : null, raiz_na_lixeira: meta.trashed,
    respostas: !!texto, parte1_pronto: p1.pronto, arquivo: p2.pronto ? p2.meta : null, teste_na_lixeira: lixo.ok };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(origin) });
  if (req.method !== "POST") return resp(origin, { error: "Método não permitido" });
  try {
    if (req.headers.get("x-acao") === "parte") return resp(origin, await parte(req));
    const b = await req.json().catch(() => ({}));
    if (b.acao === "enviar") return resp(origin, await enviar(b));
    if (b.acao === "arquivo") return resp(origin, await arquivo(b));
    if (b.acao === "concluir") return resp(origin, await concluir(b));
    if (b.acao === "teste") return resp(origin, await teste(req));
    return resp(origin, { error: "Ação desconhecida" });
  } catch (e) {
    console.error("[empresa] erro:", (e as Error)?.message);
    return resp(origin, { error: "Não foi possível concluir agora. Tente de novo em instantes." });
  }
});
