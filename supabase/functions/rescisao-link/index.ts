// ============================================================
// MACEDO & REIS - Edge Function: rescisao-link (v4, 28/10/2026 — v2: contrato de experiência; v3: também a pedido do
// funcionário; v4: os anexos — atestados, cartão ponto… — no Drive, como os das admissões)
// Link público das rescisões do DP (rescisao.html), na lógica das admissões: a empresa responde, envia e a rescisão
// nasce no módulo (dp-rescisoes.html) e na agenda (o gatilho do banco cria a tarefa na hora, com prazo no dia do
// envio e "pagar até" no título). A empresa é achada pelo nome digitado, com a mesma regra do admissao-link (o bloco
// "empresa pelo nome" é cópia de lá — o teste tests/rescisao-link.test.mjs confere que continuam iguais); sem um único
// cliente que bata, a rescisão entra sem vínculo e o DP escolhe na ficha.
// As datas (aviso e prazo do pagamento) vêm de ./rescisao-datas.js, cópia de assets/js/rescisao-datas.js — a mesma
// conta que o link mostra pra empresa e que o módulo usa.
// Os anexos vão pro Drive em BANCO DE INFORMAÇÕES > SETOR DP E RH > RESCISÕES > EMPRESA > FUNCIONÁRIO, com a mesma conta
// Google OAuth do registrar-processo-drive e o mesmo envio em partes das admissões (o bloco "anexos no Drive" é cópia do
// admissao-link, conferida pelo mesmo teste). A pasta RESCISÕES fica ao lado da ADMISSÕES: na primeira vez, a função
// acha a pasta acima da ADMISSÕES, usa a RESCISÕES que já estiver lá (ou cria) e guarda o id em
// configuracoes_escritorio.drive_pasta_rescisoes_id. Sem anexo, nenhuma pasta é criada.
//
// verify_jwt = true (regra 10): a página chama com a chave anônima; aqui dentro grava com a chave de servidor — nenhuma
// tabela fica aberta. Trava de 30 envios por hora.
// Ações (corpo JSON, campo "acao"):
//   formulario — os textos do formulário em vigor (sem dado de cliente)
//   enviar     — confere as respostas, calcula as datas e grava a rescisão; com anexos, cria as pastas;
//                devolve { id, datas, chave } (a chave, pra subir os anexos)
//   arquivo    — abre o envio de um anexo no Drive (sessão resumível)
//   concluir   — fecha o envio (a chave deixa de valer)
//   teste      — diagnóstico interno (exige x-sync-key): acha (ou cria) a pasta RESCISÕES, sobe um arquivo de teste em
//                2 partes e manda a pasta de teste pra lixeira
// Partes dos anexos: corpo binário com o cabeçalho x-acao: parte (x-id, x-chave, x-i, x-inicio, x-total).
// ============================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { calcularRescisao, combinacaoValida, isoValida, montarRespostas, pedeDescontoExperiencia, prazoValido } from "./rescisao-datas.js";

const ENVIOS_HORA = 30;                  // trava contra enxurrada (o link é público)

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

// ---------- empresa pelo nome (cópia do admissao-link) ----------
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
// ---------- fim da cópia ----------

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

// a pasta RESCISÕES: a guardada; na primeira vez, a que fica ao lado da ADMISSÕES (SETOR DP E RH) — a que já existir com
// esse nome lá, ou uma nova —, guardada pra próxima
const CHAVE_RAIZ = "drive_pasta_rescisoes_id";
async function raizRescisoes(supa: ReturnType<typeof db>, t: string): Promise<string> {
  const lerChave = async (chave: string) =>
    ((await supa.from("configuracoes_escritorio").select("valor").eq("chave", chave).maybeSingle()).data?.valor as string) || "";
  const guardada = await lerChave(CHAVE_RAIZ);
  if (guardada) return guardada;
  const admissoes = await lerChave("drive_pasta_admissoes_id");
  if (!admissoes) throw new Error("drive_pasta_admissoes_id não configurado");
  const m = await fetch(`${DRIVE}/${admissoes}?fields=parents`, { headers: { Authorization: `Bearer ${t}` } });
  if (!m.ok) throw new Error("Drive (pasta ADMISSÕES): " + (await m.text()).slice(0, 300));
  const pai = ((await m.json()).parents || [])[0];
  if (!pai) throw new Error("a pasta ADMISSÕES não tem pasta acima");
  const id = await pastaFilha(t, pai, "RESCISÕES");
  const { error } = await supa.from("configuracoes_escritorio").insert({ chave: CHAVE_RAIZ, valor: id,
    descricao: "Pasta RESCISÕES do Drive (ao lado da ADMISSÕES, em SETOR DP E RH): os anexos do link das rescisões. A função rescisao-link guarda na primeira vez." });
  if (error && error.code === "23505") return (await lerChave(CHAVE_RAIZ)) || id;   // outro envio guardou no mesmo instante
  if (error) throw new Error("guardar a pasta RESCISÕES: " + error.message);
  return id;
}

async function formulario() {
  const { data } = await db().from("rescisao_modelos").select("conteudo").eq("ativo", true).limit(1).maybeSingle();
  const c = data?.conteudo;
  if (!c) return { error: "Formulário indisponível." };
  return { titulo: c.titulo, introducao: c.introducao, final: c.final, rodape: c.rodape, email: c.email || "rh@macedoereis.com.br" };
}

// deno-lint-ignore no-explicit-any
async function enviar(b: any) {
  const empresa = txt(b.empresa, 200), contato = txt(b.contato, 120), funcionario = txt(b.funcionario, 200);
  if (!empresa || !contato) return { error: "Preencha o nome da empresa e o seu nome." };
  if (!funcionario) return { error: "Preencha o nome do funcionário." };
  const tipo = txt(b.tipo, 20), data = txt(b.data, 10);
  const experiencia = tipo === "experiencia";
  const aviso = experiencia ? "" : txt(b.aviso, 20);
  if (!combinacaoValida(tipo, aviso)) return { error: "Responda qual é o caso da rescisão e como fica o aviso." };
  if (!isoValida(data) || data < "2000-01-01" || data > "2100-12-31") return { error: "Confira a data informada." };
  let desconta: boolean | null = null;
  if (tipo === "pedido" && aviso === "imediato") {
    if (typeof b.desconta !== "boolean") return { error: "Responda se a empresa vai descontar os 30 dias de aviso." };
    desconta = b.desconta;
  }
  // contrato de experiência: quem encerra, admissão e prazo do contrato
  const admissao = experiencia ? txt(b.admissao, 10) : "", prazo = experiencia ? txt(b.prazo, 10) : "";
  const iniciativa = experiencia ? txt(b.iniciativa, 12) : "";
  if (experiencia) {
    if (iniciativa !== "empresa" && iniciativa !== "empregado") return { error: "Responda quem quer encerrar o contrato." };
    if (!isoValida(admissao) || admissao < "2000-01-01") return { error: "Confira a data de admissão." };
    if (!prazoValido(prazo)) return { error: "Responda o prazo do contrato de experiência." };
    if (data < admissao) return { error: "A data de encerramento é antes da admissão." };
  }
  const obs = txt(b.obs, 2000);
  const c = calcularRescisao({ tipo, aviso, data, admissao, prazo, iniciativa });
  if (!c) return { error: "Confira a data informada." };
  // a pedido do funcionário, saindo antes do fim: a empresa diz se desconta a indenização do art. 480
  if (pedeDescontoExperiencia(c)) {
    if (typeof b.desconta !== "boolean") return { error: "Responda se a empresa vai descontar a indenização do art. 480." };
    desconta = b.desconta;
  }
  // os anexos: aqui só a lista (nome, tamanho, tipo), com os limites do link; os arquivos sobem depois, com a chave
  const anexos = Array.isArray(b.arquivos) ? b.arquivos : [];
  const total = anexos.reduce((s: number, a: { tamanho?: number }) => s + (Number(a?.tamanho) || 0), 0);
  if (anexos.length > MAX_QTD) return { error: `No máximo ${MAX_QTD} arquivos por envio.` };
  if (anexos.some((a: { tamanho?: number }) => !(Number(a?.tamanho) > 0) || Number(a.tamanho) > MAX_ARQ) || total > MAX_TOTAL) {
    return { error: "Arquivo grande demais: até 25 MB cada e 100 MB no total." };
  }

  const supa = db();
  const { count } = await supa.from("rescisoes").select("id", { count: "exact", head: true })
    .eq("origem", "externa").gte("criado_em", new Date(Date.now() - 3600e3).toISOString());
  if ((count ?? 0) >= ENVIOS_HORA) return { error: "Muitos envios agora — tente de novo mais tarde." };
  const { data: mod } = await supa.from("rescisao_modelos").select("conteudo").eq("ativo", true).limit(1).maybeSingle();
  if (!mod?.conteudo) return { error: "Formulário indisponível." };
  const email = mod.conteudo.email || "rh@macedoereis.com.br";

  const cli = await acharCliente(supa, empresa);
  const respostas = montarRespostas({ funcionario, tipo, aviso, desconta, data, obs, admissao, prazo, iniciativa });
  const chave = anexos.length ? crypto.randomUUID() + crypto.randomUUID() : null;

  const { data: res, error } = await supa.from("rescisoes").insert({
    cliente_id: cli ? cli.id : null, empresa_nome: empresa, contato_nome: contato, origem: "externa", status: "recebida",
    funcionario_nome: funcionario, tipo, aviso: aviso || null, desconta_aviso: desconta, data_base: data,
    data_admissao: admissao || null, prazo_experiencia: prazo || null, iniciativa: iniciativa || null,
    inicio_aviso: c.inicioAviso, ultimo_dia: c.ultimoDia, data_acerto: c.limite, respostas,
    responsavel: txt(mod.conteudo.responsavel, 60) || null, criado_por: "formulário da empresa",
    envio_chave: chave, envio_expira: chave ? new Date(Date.now() + HORAS_CHAVE * 3600e3).toISOString() : null,
  }).select("id").single();
  if (error) throw new Error("gravar rescisão: " + error.message);

  // com anexos: RESCISÕES > EMPRESA > FUNCIONÁRIO (a da empresa é reaproveitada quando já existe, mesmo sem o LTDA/ME no
  // nome; tudo em MAIÚSCULAS, padrão do Drive). Sem o Drive, a rescisão fica gravada e a página pede os arquivos por e-mail.
  let pasta: string | null = null;
  if (chave) {
    try {
      const t = await token();
      const raiz = await raizRescisoes(supa, t);
      const pEmp = await pastaFilha(t, raiz, seguro(((cli && limpaNome(cli.nome_principal)) || empresa).toUpperCase()), chaveNome);
      pasta = await pastaFilha(t, pEmp, seguro((funcionario || "FUNCIONÁRIO " + hojeBR()).toUpperCase()));
      await supa.from("rescisoes").update({ drive_pasta_id: pasta, drive_pasta_url: `https://drive.google.com/drive/folders/${pasta}` }).eq("id", res.id);
    } catch (e) {
      console.error("[resc] drive:", (e as Error)?.message);
    }
  }
  console.log("[resc] enviada", res.id, "vinculada:", !!cli, "caso:", tipo + "/" + aviso, "anexos:", anexos.length, "pasta:", !!pasta);
  return { ok: true, id: res.id, email, chave: pasta ? chave : null,
    datas: { inicioAviso: c.inicioAviso, ultimoDia: c.ultimoDia, limite: c.limite } };
}

// carregar, arquivo, parte e concluir: os do admissao-link, com a tabela das rescisões e sem a lista de documentos (grupo)
// — o teste confere; "a" é a linha da rescisão, como lá é a da admissão
async function carregar(supa: ReturnType<typeof db>, id: string, chave: string) {
  if (!/^[0-9a-f-]{36}$/.test(String(id || "")) || !chave) return null;
  const { data: a } = await supa.from("rescisoes").select("id, envio_chave, envio_expira, drive_pasta_id, arquivos").eq("id", id).maybeSingle();
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
  lista[i] = { nome, tamanho, tipo, status: "enviando", sessao };
  await supa.from("rescisoes").update({ arquivos: lista }).eq("id", a.id);
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
    lista[i] = { nome: arq.nome, tamanho: arq.tamanho, tipo: arq.tipo, status: "ok", drive_id: r.meta.id };
    await supa.from("rescisoes").update({ arquivos: lista }).eq("id", a.id);
    return { ok: true, concluido: true };
  } catch (e) {
    console.error("[resc] parte:", (e as Error)?.message);
    lista[i] = { nome: arq.nome, tamanho: arq.tamanho, tipo: arq.tipo, status: "erro" };
    await supa.from("rescisoes").update({ arquivos: lista }).eq("id", a.id);
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
    x && x.status === "enviando" ? { nome: x.nome, tamanho: x.tamanho, tipo: x.tipo, status: "erro" } : x);
  await supa.from("rescisoes").update({ envio_chave: null, envio_expira: null, arquivos: lista }).eq("id", a.id);
  return { ok: true };
}

// diagnóstico interno: conta Google, pasta RESCISÕES (achada ou criada na primeira vez), pasta + arquivo em 2 partes;
// a pasta de teste vai pra lixeira
async function teste(req: Request) {
  const supa = db();
  const { data: k } = await supa.from("configuracoes_escritorio").select("valor").eq("chave", "ca_sync_key").maybeSingle();
  if (!k?.valor || req.headers.get("x-sync-key") !== k.valor) return { error: "sem permissão" };
  const t = await token();
  const raiz = await raizRescisoes(supa, t);
  const m = await fetch(`${DRIVE}/${raiz}?fields=id,name,trashed,parents`, { headers: { Authorization: `Bearer ${t}` } });
  if (!m.ok) return { error: "pasta RESCISÕES inacessível: " + (await m.text()).slice(0, 200) };
  const meta = await m.json();
  const acima = meta.parents?.[0] ? await fetch(`${DRIVE}/${meta.parents[0]}?fields=name`, { headers: { Authorization: `Bearer ${t}` } }) : null;
  const pEmp = await criarPasta(t, "TESTE DO SISTEMA (APAGAR)", raiz);
  const pFunc = await criarPasta(t, "FUNCIONÁRIO TESTE", pEmp);
  const bytes = new Uint8Array(300 * 1024).map((_, i) => i % 251);
  const sessao = await sessaoResumivel(t, pFunc, "teste.bin", "application/octet-stream", bytes.length);
  const p1 = await enviarParte(sessao, bytes.subarray(0, 256 * 1024), 0, bytes.length);
  const p2 = await enviarParte(sessao, bytes.subarray(256 * 1024), 256 * 1024, bytes.length);
  const lixo = await fetch(`${DRIVE}/${pEmp}`, {
    method: "PATCH", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" }, body: JSON.stringify({ trashed: true }),
  });
  return { ok: true, raiz: meta.name, pasta_acima: acima && acima.ok ? (await acima.json()).name : null, raiz_na_lixeira: meta.trashed,
    parte1_pronto: p1.pronto, arquivo: p2.pronto ? p2.meta : null, teste_na_lixeira: lixo.ok };
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
    console.error("[resc] erro:", (e as Error)?.message);
    return resp(origin, { error: "Não foi possível concluir agora. Tente de novo em instantes." });
  }
});
