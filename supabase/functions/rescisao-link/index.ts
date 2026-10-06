// ============================================================
// MACEDO & REIS - Edge Function: rescisao-link (v2, 06/10/2026 — v2: contrato de experiência, com admissão e prazo)
// Link público das rescisões do DP (rescisao.html), na lógica das admissões: a empresa responde, envia e a rescisão
// nasce no módulo (dp-rescisoes.html) e na agenda (o gatilho do banco cria a tarefa na hora, com prazo no dia do
// envio e "pagar até" no título). A empresa é achada pelo nome digitado, com a mesma regra do admissao-link (o bloco
// "empresa pelo nome" é cópia de lá — o teste tests/rescisao-link.test.mjs confere que continuam iguais); sem um único
// cliente que bata, a rescisão entra sem vínculo e o DP escolhe na ficha.
// As datas (aviso e prazo do pagamento) vêm de ./rescisao-datas.js, cópia de assets/js/rescisao-datas.js — a mesma
// conta que o link mostra pra empresa e que o módulo usa.
//
// verify_jwt = true (regra 10): a página chama com a chave anônima; aqui dentro grava com a chave de servidor — nenhuma
// tabela fica aberta. Trava de 30 envios por hora.
// Ações (corpo JSON, campo "acao"):
//   formulario — os textos do formulário em vigor (sem dado de cliente)
//   enviar     — confere as respostas, calcula as datas e grava a rescisão; devolve { id, datas }
// ============================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { calcularRescisao, combinacaoValida, isoValida, montarRespostas, prazoValido } from "./rescisao-datas.js";

const ENVIOS_HORA = 30;                  // trava contra enxurrada (o link é público)

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
  // contrato de experiência: admissão e prazo do contrato
  const admissao = experiencia ? txt(b.admissao, 10) : "", prazo = experiencia ? txt(b.prazo, 10) : "";
  if (experiencia) {
    if (!isoValida(admissao) || admissao < "2000-01-01") return { error: "Confira a data de admissão." };
    if (!prazoValido(prazo)) return { error: "Responda o prazo do contrato de experiência." };
    if (data < admissao) return { error: "A data de encerramento é antes da admissão." };
  }
  const obs = txt(b.obs, 2000);

  const supa = db();
  const { count } = await supa.from("rescisoes").select("id", { count: "exact", head: true })
    .eq("origem", "externa").gte("criado_em", new Date(Date.now() - 3600e3).toISOString());
  if ((count ?? 0) >= ENVIOS_HORA) return { error: "Muitos envios agora — tente de novo mais tarde." };
  const { data: mod } = await supa.from("rescisao_modelos").select("conteudo").eq("ativo", true).limit(1).maybeSingle();
  if (!mod?.conteudo) return { error: "Formulário indisponível." };

  const cli = await acharCliente(supa, empresa);
  const c = calcularRescisao({ tipo, aviso, data, admissao, prazo });
  if (!c) return { error: "Confira a data informada." };
  const respostas = montarRespostas({ funcionario, tipo, aviso, desconta, data, obs, admissao, prazo });

  const { data: res, error } = await supa.from("rescisoes").insert({
    cliente_id: cli ? cli.id : null, empresa_nome: empresa, contato_nome: contato, origem: "externa", status: "recebida",
    funcionario_nome: funcionario, tipo, aviso: aviso || null, desconta_aviso: desconta, data_base: data,
    data_admissao: admissao || null, prazo_experiencia: prazo || null,
    inicio_aviso: c.inicioAviso, ultimo_dia: c.ultimoDia, data_acerto: c.limite, respostas,
    responsavel: txt(mod.conteudo.responsavel, 60) || null, criado_por: "formulário da empresa",
  }).select("id").single();
  if (error) throw new Error("gravar rescisão: " + error.message);
  console.log("[resc] enviada", res.id, "vinculada:", !!cli, "caso:", tipo + "/" + aviso);
  return { ok: true, id: res.id, email: mod.conteudo.email || "rh@macedoereis.com.br",
    datas: { inicioAviso: c.inicioAviso, ultimoDia: c.ultimoDia, limite: c.limite } };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(origin) });
  if (req.method !== "POST") return resp(origin, { error: "Método não permitido" });
  try {
    const b = await req.json().catch(() => ({}));
    if (b.acao === "formulario") return resp(origin, await formulario());
    if (b.acao === "enviar") return resp(origin, await enviar(b));
    return resp(origin, { error: "Ação desconhecida" });
  } catch (e) {
    console.error("[resc] erro:", (e as Error)?.message);
    return resp(origin, { error: "Não foi possível concluir agora. Tente de novo em instantes." });
  }
});
