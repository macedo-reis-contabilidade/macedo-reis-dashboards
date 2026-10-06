// ============================================================
// MACEDO & REIS - Edge Function: admissao-link (v2, 06/10/2026)
// v2: o link não pede mais CNPJ nem WhatsApp (pedido do Samuel) — a empresa é achada pelo nome digitado (razão social ou
// fantasia, sem LTDA/ME/EPP…); sem um único cliente que bata, a admissão entra sem vínculo e o DP escolhe na ficha.
// Link público das admissões do DP (admissao.html), na lógica do forms da precificação: a empresa preenche, envia e
// a admissão nasce no módulo (dp-admissoes.html) e na agenda (o gatilho do banco cria a tarefa na hora, com prazo no
// dia do envio). Os anexos vão pro Drive em BANCO DE INFORMAÇÕES > SETOR DP E RH > ADMISSÕES > EMPRESA > FUNCIONÁRIO
// (raiz em configuracoes_escritorio.drive_pasta_admissoes_id; mesma conta Google OAuth do registrar-processo-drive).
//
// verify_jwt = true (regra 10): a página chama com a chave anônima; aqui dentro grava com a chave de servidor — nenhuma
// tabela fica aberta. Trava de 30 envios por hora.
// Ações (corpo JSON, campo "acao"):
//   formulario — o modelo em vigor (sem dado de cliente)
//   enviar     — grava a admissão, cria as pastas e devolve { id, chave } pra subir os anexos
//   arquivo    — abre o envio de um anexo no Drive (sessão resumível)
//   concluir   — fecha o envio (a chave deixa de valer)
//   teste      — diagnóstico interno (exige x-sync-key): sobe um arquivo de teste em 2 partes e manda a pasta pra lixeira
// Partes dos anexos: corpo binário com o cabeçalho x-acao: parte (x-id, x-chave, x-i, x-inicio, x-total).
// ============================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const DRIVE = "https://www.googleapis.com/drive/v3/files";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const FOLDER = "application/vnd.google-apps.folder";
const MAX_ARQ = 25 * 1024 * 1024;      // 25 MB por arquivo
const MAX_QTD = 20;                      // anexos por envio
const MAX_TOTAL = 100 * 1024 * 1024;    // 100 MB por envio
const ENVIOS_HORA = 30;                  // trava contra enxurrada (o link é público)
const HORAS_CHAVE = 3;                   // tempo pra terminar de subir os anexos

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

const normNome = (s: string) =>
  String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
// MEI: o nome oficial vem com o CPF no fim (ou a raiz do CNPJ na frente)
const limpaNome = (n: string) => String(n || "").replace(/\s*\d{11}\s*$/, "").replace(/^\d{2}\.?\d{3}\.?\d{3}\s+/, "").trim();
const txt = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
// chave de comparação de nome de empresa: sem acento, sem pontuação, sem o CPF do MEI e sem LTDA/ME/EPP/EIRELI/S.A. no fim
const SUFIXOS = new Set(["LTDA", "ME", "EPP", "EIRELI", "EIRELLI", "MEI", "SLU", "LIMITADA", "SA"]);
const chaveNome = (n: string) => {
  const t = normNome(limpaNome(n)).split(" ").filter(Boolean);
  for (;;) {
    if (t.length > 1 && SUFIXOS.has(t[t.length - 1])) { t.pop(); continue; }
    if (t.length > 2 && t[t.length - 2] === "S" && t[t.length - 1] === "A") { t.splice(-2); continue; }
    break;
  }
  return t.join(" ");
};
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

async function raizAdmissoes(supa: ReturnType<typeof db>): Promise<string> {
  const { data } = await supa.from("configuracoes_escritorio").select("valor").eq("chave", "drive_pasta_admissoes_id").maybeSingle();
  if (!data?.valor) throw new Error("drive_pasta_admissoes_id não configurado");
  return data.valor as string;
}

// empresa do cadastro pelo nome digitado: igual (razão ou fantasia) → esse; havendo mais de um, o que está na carteira;
// sem igual, todas as palavras digitadas (3+ letras) dentro do nome de um único cliente da carteira. Fora disso, sem vínculo.
// deno-lint-ignore no-explicit-any
async function acharCliente(supa: ReturnType<typeof db>, digitado: string): Promise<any | null> {
  const alvo = chaveNome(digitado);
  if (!alvo) return null;
  // deno-lint-ignore no-explicit-any
  const clis: any[] = [];
  for (let i = 0; ; i += 1000) {
    const { data, error } = await supa.from("clientes").select("id, nome_principal, nome_fantasia").order("id").range(i, i + 999);
    if (error) throw new Error("clientes: " + error.message);
    clis.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  const { data: cart } = await supa.from("carteira_info").select("cliente_id").is("saida", null).range(0, 4999);
  const ativos = new Set((cart || []).map((c: { cliente_id: string }) => c.cliente_id));
  // deno-lint-ignore no-explicit-any
  const nomes = (c: any) => [c.nome_principal, c.nome_fantasia].filter(Boolean).map(chaveNome);
  // deno-lint-ignore no-explicit-any
  const um = (lista: any[]) => {
    if (lista.length === 1) return lista[0];
    const at = lista.filter((c) => ativos.has(c.id));
    return at.length === 1 ? at[0] : null;
  };
  const iguais = clis.filter((c) => nomes(c).includes(alvo));
  if (iguais.length) return um(iguais);
  const palavras = alvo.split(" ").filter((p) => p.length >= 3);
  if (!palavras.length) return null;
  const contem = clis.filter((c) => ativos.has(c.id) && nomes(c).some((n) => { const t = new Set(n.split(" ")); return palavras.every((p) => t.has(p)); }));
  return contem.length === 1 ? contem[0] : null;
}

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

// ---------------------------------------------------------------------------------------------------------------
async function formulario() {
  const { data } = await db().from("admissao_modelos").select("conteudo").eq("ativo", true).limit(1).maybeSingle();
  const c = data?.conteudo;
  if (!c) return { error: "Formulário indisponível." };
  return { titulo: c.titulo, introducao: c.introducao, blocos: c.blocos, final: c.final, rodape: c.rodape, email: c.email || "rh@macedoereis.com.br" };
}

// deno-lint-ignore no-explicit-any
async function enviar(b: any) {
  const empresa = txt(b.empresa, 200), contato = txt(b.contato, 120);
  if (!empresa || !contato) return { error: "Preencha o nome da empresa e o seu nome." };
  const respostas = b.respostas;
  if (!Array.isArray(respostas) || respostas.length > 200 || JSON.stringify(respostas).length > 100000
    || respostas.some((x: unknown) => !x || typeof x !== "object" || Array.isArray(x))) return { error: "Respostas inválidas." };
  const anexos = Array.isArray(b.arquivos) ? b.arquivos : [];
  const total = anexos.reduce((s: number, a: { tamanho?: number }) => s + (Number(a?.tamanho) || 0), 0);
  if (anexos.length > MAX_QTD) return { error: `No máximo ${MAX_QTD} arquivos por envio.` };
  if (anexos.some((a: { tamanho?: number }) => !(Number(a?.tamanho) > 0) || Number(a.tamanho) > MAX_ARQ) || total > MAX_TOTAL) {
    return { error: "Arquivo grande demais: até 25 MB cada e 100 MB no total." };
  }
  const supa = db();
  const { count } = await supa.from("admissoes").select("id", { count: "exact", head: true })
    .eq("origem", "externa").gte("criado_em", new Date(Date.now() - 3600e3).toISOString());
  if ((count ?? 0) >= ENVIOS_HORA) return { error: "Muitos envios agora — tente de novo mais tarde." };
  const { data: mod } = await supa.from("admissao_modelos").select("conteudo").eq("ativo", true).limit(1).maybeSingle();
  if (!mod?.conteudo) return { error: "Formulário indisponível." };
  const email = mod.conteudo.email || "rh@macedoereis.com.br";

  const cli = await acharCliente(supa, empresa);

  const valor = (id: string) => {
    const x = respostas.find((r: { id?: string }) => r.id === id);
    return x ? String(x.valor ?? "").trim() : "";
  };
  const nome = valor("nome").slice(0, 200) || null;
  const ini = valor("data_inicio");
  const dataIni = /^\d{4}-\d{2}-\d{2}$/.test(ini) && !isNaN(Date.parse(ini + "T12:00:00Z")) ? ini : null;
  // deno-lint-ignore no-explicit-any
  const documentos = (Array.isArray(mod.conteudo.blocos) ? mod.conteudo.blocos : []).filter((bl: any) => bl && bl.tipo === "documentos")
    // deno-lint-ignore no-explicit-any
    .flatMap((bl: any) => (Array.isArray(bl.itens) ? bl.itens : []).map((it: unknown) => String(it).trim()).filter(Boolean)
      .map((item: string) => ({ grupo: bl.titulo || "Documentos", item, condicional: !!bl.condicional, recebido: false })));
  const chave = anexos.length ? crypto.randomUUID() + crypto.randomUUID() : null;

  const { data: adm, error } = await supa.from("admissoes").insert({
    cliente_id: cli ? cli.id : null, empresa_nome: empresa, contato_nome: contato,
    origem: "externa", status: "respondida", funcionario_nome: nome, data_inicio: dataIni,
    responsavel: txt(mod.conteudo.responsavel, 60) || null, respostas, documentos, criado_por: "formulário da empresa",
    envio_chave: chave, envio_expira: chave ? new Date(Date.now() + HORAS_CHAVE * 3600e3).toISOString() : null,
  }).select("id").single();
  if (error) throw new Error("gravar admissão: " + error.message);

  // ADMISSÕES > EMPRESA > FUNCIONÁRIO (a da empresa é reaproveitada quando já existe, mesmo sem o LTDA/ME no nome;
  // tudo em MAIÚSCULAS, padrão do Drive)
  let pasta: string | null = null;
  try {
    const t = await token();
    const raiz = await raizAdmissoes(supa);
    const pEmp = await pastaFilha(t, raiz, seguro(((cli && limpaNome(cli.nome_principal)) || empresa).toUpperCase()), chaveNome);
    pasta = await pastaFilha(t, pEmp, seguro((nome || "FUNCIONÁRIO " + hojeBR()).toUpperCase()));
    await supa.from("admissoes").update({ drive_pasta_id: pasta, drive_pasta_url: `https://drive.google.com/drive/folders/${pasta}` }).eq("id", adm.id);
  } catch (e) {
    console.error("[adm] drive:", (e as Error)?.message);
  }
  console.log("[adm] enviada", adm.id, "vinculada:", !!cli, "anexos:", anexos.length, "pasta:", !!pasta);
  return { ok: true, id: adm.id, chave: pasta ? chave : null, drive: !!pasta, email };
}

async function carregar(supa: ReturnType<typeof db>, id: string, chave: string) {
  if (!/^[0-9a-f-]{36}$/.test(String(id || "")) || !chave) return null;
  const { data: a } = await supa.from("admissoes").select("id, envio_chave, envio_expira, drive_pasta_id, arquivos").eq("id", id).maybeSingle();
  if (!a || !a.envio_chave || a.envio_chave !== chave || !a.envio_expira || Date.parse(a.envio_expira) < Date.now() || !a.drive_pasta_id) return null;
  return a;
}

// deno-lint-ignore no-explicit-any
async function arquivo(b: any) {
  const supa = db();
  const a = await carregar(supa, b.id, b.chave);
  if (!a) return { error: "Envio expirado ou inválido." };
  const i = Number(b.i), tamanho = Number(b.tamanho);
  const nome = seguro(txt(b.nome, 180)) || `arquivo-${i + 1}`;
  const tipo = txt(b.tipo, 120) || "application/octet-stream";
  if (!(Number.isInteger(i) && i >= 0 && i < MAX_QTD) || !(tamanho > 0 && tamanho <= MAX_ARQ)) return { error: "Arquivo inválido." };
  const sessao = await sessaoResumivel(await token(), a.drive_pasta_id, nome, tipo, tamanho);
  const lista = Array.isArray(a.arquivos) ? a.arquivos : [];
  lista[i] = { nome, tamanho, tipo, grupo: txt(b.grupo, 120) || null, status: "enviando", sessao };
  await supa.from("admissoes").update({ arquivos: lista }).eq("id", a.id);
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
    await supa.from("admissoes").update({ arquivos: lista }).eq("id", a.id);
    return { ok: true, concluido: true };
  } catch (e) {
    console.error("[adm] parte:", (e as Error)?.message);
    lista[i] = { nome: arq.nome, tamanho: arq.tamanho, tipo: arq.tipo, grupo: arq.grupo, status: "erro" };
    await supa.from("admissoes").update({ arquivos: lista }).eq("id", a.id);
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
    x && x.status === "enviando" ? { nome: x.nome, tamanho: x.tamanho, tipo: x.tipo, grupo: x.grupo, status: "erro" } : x);
  await supa.from("admissoes").update({ envio_chave: null, envio_expira: null, arquivos: lista }).eq("id", a.id);
  return { ok: true };
}

// diagnóstico interno: conta Google, pasta ADMISSÕES, pasta + arquivo em 2 partes; a pasta de teste vai pra lixeira
async function teste(req: Request) {
  const supa = db();
  const { data: k } = await supa.from("configuracoes_escritorio").select("valor").eq("chave", "ca_sync_key").maybeSingle();
  if (!k?.valor || req.headers.get("x-sync-key") !== k.valor) return { error: "sem permissão" };
  const t = await token();
  const raiz = await raizAdmissoes(supa);
  const m = await fetch(`${DRIVE}/${raiz}?fields=id,name,trashed`, { headers: { Authorization: `Bearer ${t}` } });
  if (!m.ok) return { error: "pasta ADMISSÕES inacessível: " + (await m.text()).slice(0, 200) };
  const meta = await m.json();
  const pEmp = await criarPasta(t, "TESTE DO SISTEMA (APAGAR)", raiz);
  const pFunc = await criarPasta(t, "FUNCIONÁRIO TESTE", pEmp);
  const bytes = new Uint8Array(300 * 1024).map((_, i) => i % 251);
  const sessao = await sessaoResumivel(t, pFunc, "teste.bin", "application/octet-stream", bytes.length);
  const p1 = await enviarParte(sessao, bytes.subarray(0, 256 * 1024), 0, bytes.length);
  const p2 = await enviarParte(sessao, bytes.subarray(256 * 1024), 256 * 1024, bytes.length);
  const lixo = await fetch(`${DRIVE}/${pEmp}`, {
    method: "PATCH", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" }, body: JSON.stringify({ trashed: true }),
  });
  return { ok: true, raiz: meta.name, raiz_na_lixeira: meta.trashed, parte1_pronto: p1.pronto, arquivo: p2.pronto ? p2.meta : null, teste_na_lixeira: lixo.ok };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(origin) });
  if (req.method !== "POST") return resp(origin, { error: "Método não permitido" });
  try {
    if (req.headers.get("x-acao") === "parte") return resp(origin, await parte(req));
    const b = await req.json().catch(() => ({}));
    if (b.acao === "formulario") return resp(origin, await formulario());
    if (b.acao === "enviar") return resp(origin, await enviar(b));
    if (b.acao === "arquivo") return resp(origin, await arquivo(b));
    if (b.acao === "concluir") return resp(origin, await concluir(b));
    if (b.acao === "teste") return resp(origin, await teste(req));
    return resp(origin, { error: "Ação desconhecida" });
  } catch (e) {
    console.error("[adm] erro:", (e as Error)?.message);
    return resp(origin, { error: "Não foi possível concluir agora. Tente de novo em instantes." });
  }
});
