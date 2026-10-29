// =============================================================================
// Edge Function: analise-fiscal
// Macedo & Reis Contabilidade — Agente Fiscal
// =============================================================================
// Recebe os dados de um cliente, monta o prompt (system prompt + manual),
// chama a Claude API e retorna a análise tributária estruturada (JSON do Bloco 12).
//
// Padrão: Supabase Edge Functions (Deno). Espelha a arquitetura da função
// `extract-document` já existente (mesmo projeto Supabase).
//
// Deploy:  supabase functions deploy analise-fiscal
// Segredo: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// =============================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// -----------------------------------------------------------------------------
// CORS
// -----------------------------------------------------------------------------
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// -----------------------------------------------------------------------------
// Config
// -----------------------------------------------------------------------------
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Modelo: para análise fiscal recomenda-se um modelo forte (precisão > custo).
// 28/10/2026: o claude-sonnet-4-20250514 foi aposentado pela Anthropic em 15/06/2026 e a análise parou de funcionar
// desde então (a API responde que o modelo não existe). O claude-sonnet-4-6 é o mesmo do leitor de documentos e do
// DRE, ativo até pelo menos 17/02/2027, e responde sem pensar antes (o Sonnet 5.5 pensaria e o pensamento contaria no
// MAX_TOKENS, cortando o JSON).
const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 8000;

// O que nunca vai pra IA, mesmo que a tela mande: as credenciais do cliente e os documentos pessoais (28/10/2026: a tela
// mandava o cadastro inteiro, com o `select('*')`, inclusive as credenciais).
const NUNCA_PRA_IA = ["credenciais", "rg", "data_nascimento", "estado_civil", "profissao", "nacionalidade",
  "email_principal", "telefone_principal", "drive_folder_id", "drive_folder_url"];
function semSensiveis(entrada: Record<string, unknown>): Record<string, unknown> {
  const limpa = { ...entrada };
  const cad = limpa.dados_cadastrais_completos;
  if (cad && typeof cad === "object" && !Array.isArray(cad)) {
    const c = { ...(cad as Record<string, unknown>) };
    for (const k of NUNCA_PRA_IA) delete c[k];
    limpa.dados_cadastrais_completos = c;
  }
  for (const k of NUNCA_PRA_IA) delete limpa[k];
  return limpa;
}

// O system prompt operacional (system-prompt-agente-fiscal.md) com o marcador
// {{MANUAL_COMPLETO}} já substituído pelo conteúdo de manual-fiscal-completo.md.
//
// OPÇÃO A (recomendada): armazenar o system prompt final no Supabase Storage
//   (bucket privado, ex.: "prompts/system-prompt-agente-fiscal.md") e buscá-lo
//   aqui — permite atualizar o manual sem redeploy da função.
// OPÇÃO B: incluir como arquivo estático no deploy e ler com Deno.readTextFile.
//
// Abaixo, a Opção A:
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

async function carregarSystemPrompt(
  supabase: ReturnType<typeof createClient>,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from("prompts")
    .download("system-prompt-agente-fiscal-final.md");
  if (error || !data) {
    throw new Error(`Falha ao carregar system prompt: ${error?.message}`);
  }
  return await data.text();
}

// -----------------------------------------------------------------------------
// Handler
// -----------------------------------------------------------------------------
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (!(await quemChama(req))) {
    return new Response(JSON.stringify({ ok: false, erro: "Entre no sistema pra usar esta função." }),
      { status: 401, headers: { ...corsHeaders, "content-type": "application/json" } });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1) Dados de entrada do cliente (vindos do dashboard de Clientes)
    // deno-lint-ignore no-explicit-any
    const clienteInput: Record<string, any> = semSensiveis(await req.json());
    // clienteInput esperado: { cnpj, razao_social, regime_tributario, cnaes,
    //   porte, faturamento_12m, municipio, uf, operacoes, cliente_id? }

    // 2) System prompt (instruções + manual embutido)
    const systemPrompt = await carregarSystemPrompt(supabase);

    // 3) Chamada à Claude API
    const anthropicResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "prompt-caching-2024-07-31",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        // Prompt caching: o system prompt (instruções + manual, ~129k tokens)
        // é estável entre chamadas. Marcá-lo com cache_control reduz o custo de
        // input em ~10x nas chamadas com cache hit e diminui a latência.
        // Requer o header "anthropic-beta: prompt-caching-2024-07-31" (ver headers).
        system: [
          {
            type: "text",
            text: systemPrompt,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          {
            role: "user",
            content:
              "Analise o seguinte cliente e retorne APENAS o JSON conforme o Bloco 12:\n\n" +
              JSON.stringify(clienteInput, null, 2),
          },
        ],
      }),
    });

    if (!anthropicResp.ok) {
      const errText = await anthropicResp.text();
      throw new Error(`Anthropic API erro ${anthropicResp.status}: ${errText}`);
    }

    const anthropicData = await anthropicResp.json();

    // 4) Extrair o texto e parsear o JSON (o agente deve responder só com JSON)
    const rawText = (anthropicData.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("")
      .trim();

    // Robustez: remover eventuais cercas ```json caso o modelo as inclua
    const cleaned = rawText.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();

    let analise: unknown;
    try {
      analise = JSON.parse(cleaned);
    } catch (_e) {
      // Não conseguiu parsear: retorna erro estruturado para revisão
      return new Response(
        JSON.stringify({
          ok: false,
          erro: "Resposta do agente não é JSON válido",
          raw: rawText,
        }),
        { status: 422, headers: { ...corsHeaders, "content-type": "application/json" } },
      );
    }

    // 5) Persistir no Supabase (tabela sugerida: fiscal_analises)
    //    Estrutura sugerida da tabela:
    //      id uuid pk default gen_random_uuid()
    //      cliente_id uuid references clientes(id)
    //      analise jsonb            -- o JSON completo do Bloco 12
    //      confianca_geral text     -- meta.confianca_geral (para filtro no dashboard)
    //      requer_revisao boolean   -- true se houver qualquer requer_verificacao
    //      revisado boolean default false
    //      created_at timestamptz default now()
    const a = analise as Record<string, any>;
    const confiancaGeral = a?.meta?.confianca_geral ?? "media";
    const requerRevisao =
      Array.isArray(a?.verificacao_humana) && a.verificacao_humana.length > 0;

    if (clienteInput.cliente_id) {
      const { error: insErr } = await supabase.from("fiscal_analises").insert({
        cliente_id: clienteInput.cliente_id,
        analise: a,
        confianca_geral: confiancaGeral,
        requer_revisao: requerRevisao,
      });
      if (insErr) {
        // Não falha a resposta ao usuário por erro de persistência; loga.
        console.error("Erro ao gravar análise:", insErr.message);
      }
    }

    // 6) Retorno ao dashboard
    return new Response(
      JSON.stringify({ ok: true, analise: a, requer_revisao: requerRevisao }),
      { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, erro: String(err) }),
      { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } },
    );
  }
});
