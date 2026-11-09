// ============================================================
// MACEDO & REIS - Edge Function: whatsapp (08/11/2026, a etapa 2 do atendimento pelo WhatsApp; as etapas no Projeto,
// whatsapp/fase1.md)
// A porta das mensagens do atendimento: a mensagem (atend_mensagens) só esta função grava — a tela não tem insert nela.
// Por enquanto, só o simulador da tela de atendimento (atendimento.html), com o login do escritório:
//   { acao: 'simular', telefone, nome?, texto, setor?, id?, anexos? }  o cliente de mentira escreve: a conversa de teste nasce (na fila
//                                                        do setor que o simulador escolheu, no lugar do assistente, que é a
//                                                        etapa 4) ou segue a que está aberta pro número
//   { acao: 'responder', conversa_id, texto, id? }       quem está com a conversa responde; o id é o da tela (tentar de novo
//                                                        não duplica). No simulador, a resposta só fica gravada
//   { acao: 'nota', conversa_id, texto, id? }            a nota interna (09/11/2026): qualquer um do escritório, em
//                                                        qualquer conversa; o cliente nunca vê
// Os arquivos (09/11/2026): a tela sobe cada um na pasta privada "atendimento" do Storage, em <id da mensagem>/<nome>, e
// manda em anexos [{ caminho, nome, tamanho, tipo }] (até 5, 25 MB cada) junto com o id; a função confere o caminho e
// que o arquivo está lá antes de gravar (com arquivo, o texto é opcional). A regra é cópia da anexosValidos e da
// tipoDaMensagem de assets/js/atendimento.js (tests/atendimento.test.mjs confere).
// O número de verdade (a Meta, com a assinatura X-Hub-Signature-256 como trava) entra na etapa 3: aí o verify_jwt
// desliga, a função vai pra lista ABERTAS do tests/funcoes-login.test.mjs e a conversa de verdade responde pela API.
// Os setores e a conta do telefone são cópia dos de assets/js/atendimento.js (tests/atendimento.test.mjs confere).
// ============================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SETORES = ["fiscal", "dp", "contabil", "societario", "financeiro", "comercial"];
const MAX_TEXTO = 4096;
const JANELA_MS = 24 * 60 * 60 * 1000;   // as 24 horas do WhatsApp pra resposta livre, contadas da última do cliente

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
  };
}

// Quem chama: só quem entrou no sistema com e-mail do escritório — ou o próprio servidor, com a chave de servidor. O
// verify_jwt sozinho deixa passar a chave anônima, que é pública: a mesma conferência de todas as funções internas (o
// teste tests/funcoes-login.test.mjs confere).
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
// o telefone do banco: só os dígitos, com o país (de 10 a 15); com 10 ou 11 dígitos, é do Brasil e ganha o 55
function normalizarTelefone(s: unknown): string | null {
  const bruto = String(s == null ? "" : s).trim();
  let d = bruto.replace(/\D/g, "");
  if (!bruto.startsWith("+") && (d.length === 10 || d.length === 11)) d = "55" + d;
  return /^[0-9]{12,15}$/.test(d) || (bruto.startsWith("+") && /^[0-9]{10,15}$/.test(d)) ? d : null;
}

// ---------- os arquivos (cópia de assets/js/atendimento.js) ----------
const MAX_ANEXOS = 5;
const MAX_ARQUIVO = 25 * 1024 * 1024;
type Anexo = { caminho: string; nome: string; tamanho: number; tipo: string | null };
function anexosValidos(lista: unknown, mensagemId: string): Anexo[] | null {
  if (lista == null) return [];
  if (!Array.isArray(lista) || lista.length > MAX_ANEXOS) return null;
  const out: Anexo[] = [];
  for (const a of lista) {
    if (!a || typeof a !== "object") return null;
    const caminho = String(a.caminho || ""), nome = String(a.nome || "").trim().slice(0, 200), tamanho = Number(a.tamanho), tipo = String(a.tipo || "").slice(0, 120);
    if (!caminho.startsWith(mensagemId + "/") || !/^[A-Za-z0-9._ ()-]{1,140}$/.test(caminho.slice(mensagemId.length + 1))) return null;
    if (!nome || !Number.isFinite(tamanho) || tamanho <= 0 || tamanho > MAX_ARQUIVO) return null;
    if (tipo && !/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(tipo)) return null;
    out.push({ caminho, nome, tamanho, tipo: tipo || null });
  }
  return out;
}
function tipoDaMensagem(anexos: Anexo[]): string {
  const t = String(((anexos || [])[0] || {}).tipo || "");
  if (!(anexos || []).length) return "texto";
  return t.startsWith("image/") ? "imagem" : t.startsWith("audio/") ? "audio" : t.startsWith("video/") ? "video" : "documento";
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const letras = (s: string) => [...s].length;

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const responder = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: cors(origin) });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  let quem: string | null = null;
  if (!(quem = await quemChama(req))) {
    return new Response(JSON.stringify({ error: "Entre no sistema pra usar esta função." }), { status: 401, headers: cors(origin) });
  }
  if (req.method !== "POST") return responder({ error: "Use POST." }, 405);
  if (quem === "servidor") return responder({ error: "Esta função é da tela de atendimento: entre com o seu login." }, 403);
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return responder({ error: "Pedido sem corpo." }, 400);
  const sb = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "", { auth: { persistSession: false } });
  const texto = String(body.texto == null ? "" : body.texto).trim();
  const agora = new Date();
  const janela = new Date(agora.getTime() + JANELA_MS).toISOString();

  // os arquivos: o id da mensagem é o da tela (é a pasta deles); cada um tem de estar na pasta antes de gravar
  const id = UUID.test(String(body.id || "")) ? String(body.id) : crypto.randomUUID();
  const anexos = anexosValidos(body.anexos, id);
  if (anexos === null) return responder({ error: "Os arquivos vieram num formato que eu não aceito: escolha de novo." }, 400);
  async function arquivosNaPasta(): Promise<boolean> {
    if (!anexos || !anexos.length) return true;
    const { data, error } = await sb.storage.from("atendimento").list(id, { limit: 100 });
    if (error) throw error;
    const tem = new Set((data || []).map((o: { name: string }) => id + "/" + o.name));
    return anexos.every(a => tem.has(a.caminho));
  }
  const tipo = tipoDaMensagem(anexos || []);

  try {
    if (body.acao === "simular") {
      const tel = normalizarTelefone(body.telefone);
      if (!tel) return responder({ error: "Telefone inválido: use o DDD e o número." }, 400);
      if (!texto && !anexos.length) return responder({ error: "Escreva a mensagem." }, 400);
      if (letras(texto) > MAX_TEXTO) return responder({ error: "A mensagem passou de 4.096 letras, o limite do WhatsApp." }, 400);
      if (!(await arquivosNaPasta())) return responder({ error: "Algum arquivo não chegou na pasta: mande de novo." }, 409);
      const nome = String(body.nome == null ? "" : body.nome).trim().slice(0, 120) || null;
      const setor = body.setor == null || body.setor === "" ? null : String(body.setor);
      if (setor && !SETORES.includes(setor)) return responder({ error: "Setor desconhecido." }, 400);
      const { data: abertas, error: e1 } = await sb.from("atend_conversas").select("id, teste")
        .eq("telefone", tel).neq("situacao", "encerrada").order("criado_em", { ascending: false }).limit(1);
      if (e1) throw e1;
      let conversa = (abertas || [])[0] as { id: string; teste: boolean } | undefined;
      if (conversa && !conversa.teste) return responder({ error: "Este número tem uma conversa de verdade aberta: use outro no simulador." }, 409);
      let nova = false;
      if (!conversa) {
        // a empresa do número: a única confirmada (o número de duas empresas espera a pessoa escolher)
        const { data: nums, error: e2 } = await sb.from("atend_numeros").select("cliente_id").eq("telefone", tel).eq("ativo", true).eq("confirmado", true);
        if (e2) throw e2;
        const empresas = [...new Set((nums || []).map((n: { cliente_id: string }) => n.cliente_id))];
        const { data: criada, error: e3 } = await sb.from("atend_conversas").insert({
          telefone: tel, contato_nome: nome, situacao: "fila", setor, teste: true, cliente_id: empresas.length === 1 ? empresas[0] : null,
          ultima_em: agora.toISOString(), ultima_do_cliente_em: agora.toISOString(), janela_ate: janela,
        }).select("id, teste").single();
        if (e3) throw e3;
        conversa = criada as { id: string; teste: boolean };
        nova = true;
        const { error: e4 } = await sb.from("atend_eventos").insert({ conversa_id: conversa.id, tipo: "abriu", setor, observacao: "simulador" });
        if (e4) throw e4;
      }
      const { data: msg, error: e5 } = await sb.from("atend_mensagens")
        .insert({ id, conversa_id: conversa.id, direcao: "entrada", autor: "cliente", tipo, texto: texto || null, anexos }).select("id, criada_em").single();
      if (e5 && e5.code === "23505") return responder({ ok: true, conversa_id: conversa.id, nova, mensagem_id: id, repetida: true });
      if (e5) throw e5;
      if (!nova) {
        const mudar: Record<string, unknown> = { ultima_em: msg.criada_em, ultima_do_cliente_em: msg.criada_em, janela_ate: janela };
        if (nome) mudar.contato_nome = nome;
        const { error: e6 } = await sb.from("atend_conversas").update(mudar).eq("id", conversa.id);
        if (e6) throw e6;
      }
      return responder({ ok: true, conversa_id: conversa.id, nova, mensagem_id: msg.id });
    }

    if (body.acao === "responder") {
      if (!UUID.test(String(body.conversa_id || ""))) return responder({ error: "Conversa inválida." }, 400);
      if (!texto && !anexos.length) return responder({ error: "Escreva a mensagem." }, 400);
      if (letras(texto) > MAX_TEXTO) return responder({ error: "A mensagem passou de 4.096 letras, o limite do WhatsApp." }, 400);
      const { data: c, error: e1 } = await sb.from("atend_conversas").select("id, situacao, responsavel, teste, janela_ate").eq("id", body.conversa_id).maybeSingle();
      if (e1) throw e1;
      if (!c) return responder({ error: "A conversa não existe mais." }, 404);
      const dono = String(c.responsavel || "").toLowerCase();
      if (c.situacao !== "atendendo" || dono !== quem) {
        return responder({ error: c.situacao === "atendendo" && dono ? "A conversa está com outra pessoa: peça pra passarem pra você." : "Assuma a conversa pra responder." }, 409);
      }
      if (!c.janela_ate || new Date(c.janela_ate).getTime() <= agora.getTime()) {
        return responder({ error: "Passaram 24 horas da última mensagem do cliente: o WhatsApp só deixa escrever com um modelo aprovado." }, 409);
      }
      if (!c.teste) return responder({ error: "O envio pelo WhatsApp de verdade ainda não está ligado: por enquanto só as conversas do simulador respondem." }, 409);
      if (!(await arquivosNaPasta())) return responder({ error: "Algum arquivo não chegou na pasta: mande de novo." }, 409);
      const { error: e2 } = await sb.from("atend_mensagens").insert({ id, conversa_id: c.id, direcao: "saida", autor: quem, tipo, texto: texto || null, anexos, status: "enviada" });
      if (e2 && e2.code !== "23505") throw e2;
      const { error: e3 } = await sb.from("atend_conversas").update({ ultima_em: agora.toISOString() }).eq("id", c.id);
      if (e3) throw e3;
      return responder({ ok: true, id, repetida: !!e2 });
    }

    if (body.acao === "nota") {
      // a nota interna: o recado pra equipe dentro da conversa (direcao 'interna'). Qualquer um do escritório anota em
      // qualquer conversa, com ou sem ela, aberta ou encerrada; não sai pro WhatsApp e não mexe na ordem da lista
      if (!UUID.test(String(body.conversa_id || ""))) return responder({ error: "Conversa inválida." }, 400);
      if (!texto) return responder({ error: "Escreva a nota." }, 400);
      if (letras(texto) > MAX_TEXTO) return responder({ error: "A nota passou de 4.096 letras." }, 400);
      const { data: c, error: e1 } = await sb.from("atend_conversas").select("id").eq("id", body.conversa_id).maybeSingle();
      if (e1) throw e1;
      if (!c) return responder({ error: "A conversa não existe mais." }, 404);
      const { error: e2 } = await sb.from("atend_mensagens").insert({ id, conversa_id: c.id, direcao: "interna", autor: quem, tipo: "texto", texto });
      if (e2 && e2.code !== "23505") throw e2;
      return responder({ ok: true, id, repetida: !!e2 });
    }

    return responder({ error: "Ação desconhecida." }, 400);
  } catch (e) {
    console.error("whatsapp:", e && (e as Error).message ? (e as Error).message : e);
    return responder({ error: "Não consegui gravar agora. Tente de novo em instantes." }, 500);
  }
});
