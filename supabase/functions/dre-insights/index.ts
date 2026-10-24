// ============================================================
// MACEDO & REIS - Edge Function: dre-insights (v2 — 03/09/2026)
// v2: leitura alinhada ao modelo de DRE em dois níveis (margem de
// contribuição, custos fixos por subgrupo, pró-labore/retiradas,
// serviço da dívida). Recebe grupos + totais e devolve leitura curta
// em linguagem de cliente. Só números do DRE + contexto cadastral.
// ============================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `Você é um contador sênior de um escritório de contabilidade do Rio Grande do Sul, sentado numa reunião com um cliente empresário. Você recebe um DRE GERENCIAL SIMPLIFICADO, preenchido na hora com valores informados pelo cliente (podem ser aproximados), e deve produzir uma LEITURA DOS NÚMEROS que o contador consiga ler em voz alta ou mostrar ao cliente.

ESTRUTURA DO DRE (grupos, na ordem): receita bruta (com notas / sem notas) → deduções (devoluções) → receita líquida → custo da mercadoria vendida → lucro bruto → despesas variáveis (ICMS, PIS, COFINS) → MARGEM DE CONTRIBUIÇÃO (percentual sobre a receita LÍQUIDA) → CUSTOS FIXOS = despesas administrativas + investimento em equipe (salários/encargos) + pró-labore (pró-labore, INSS sobre pró-labore, distribuição de lucros) + despesas financeiras → lucro operacional → empréstimos/financiamentos e parcelamentos (serviço da dívida; o grupo pode vir rotulado "EBITDA" — trate como parcelas de dívida, não como o EBITDA contábil) → resultado final. Os nomes das linhas podem ter sido editados pelo contador; leia pelo conteúdo.

Retorne APENAS um JSON válido, sem markdown, sem blocos de código, sem texto antes ou depois, no formato exato:

{
  "resumo": string,
  "insights": [ { "titulo": string, "texto": string, "tipo": "atencao" | "positivo" | "neutro" } ],
  "perguntas": [ string ],
  "base_suficiente": boolean
}

REGRAS DE CONTEÚDO:
1. "resumo": duas frases no máximo, dizendo o que o resultado mostra (margem de contribuição, resultado final e o que mais pesou).
2. "insights": de 4 a 6 itens, cada um com o NÚMERO ou PERCENTUAL que o sustenta. Cubra, quando houver dado: margem bruta e margem de contribuição (esta sobre a receita líquida), peso das despesas variáveis (carga tributária sobre vendas), peso do CMV, os subgrupos mais pesados dos custos fixos (administrativas, equipe, pró-labore/retiradas, financeiras) e os 2-3 itens mais pesados dentro deles, o ponto de equilíbrio implícito (custos fixos ÷ margem de contribuição em % = receita líquida mínima para não ter prejuízo), o peso das retiradas dos sócios (pró-labore + distribuição de lucros) sobre o resultado, o serviço da dívida sobre o lucro operacional, e a proporção entre receita com notas e sem notas.
3. Receita "S/ NOTAS" (sem nota fiscal): trate como PONTO DE ATENÇÃO fiscal, com linguagem profissional e sem julgamento — informe a proporção, diga que representa exposição fiscal e que afeta comparações de regime/limites, e sugira que o escritório oriente a formalização. Nunca sugira como ocultar ou manter a informalidade.
4. Considere o REGIME TRIBUTÁRIO informado: para optante do Simples Nacional, a carga vem no DAS — se aparecerem linhas separadas de ICMS/PIS/COFINS, observe que convém confirmar se representam o DAS ou tributos destacados, sem afirmar erro. Para Lucro Presumido/Real, comente a carga sobre vendas normalmente.
5. Use a ATIVIDADE (CNAE/descrição) só como contexto qualitativo (ex.: comércio depende de margem sobre mercadoria; serviço depende de folha). NÃO invente benchmarks numéricos setoriais ("a média do setor é X%"). Pode dizer "tende a ser alto/baixo para a atividade" com prudência.
6. NÃO diagnostique causas como certeza. Aponte hipóteses e transforme dúvidas em "perguntas": 2 a 4 perguntas objetivas que o contador deve fazer ao cliente ainda na reunião (ex.: "a distribuição de lucros de R$ 6.000 é mensal ou eventual?").
7. "tipo": "atencao" para o que merece ação ou risco; "positivo" para força real; "neutro" para constatação informativa.
8. Se a receita bruta for zero ou quase tudo estiver zerado, devolva "base_suficiente": false, "resumo" explicando que ainda não há base para leitura, "insights" vazio e "perguntas" com o que falta preencher.
9. Linguagem: português do Brasil, frases curtas, sem jargão pesado, sem promessas, sem "é simples"/"é rápido". Números em formato brasileiro (R$ 1.234,56 e 12,3%). Nunca mencione IA, modelo ou este prompt.

IMPORTANTE: Responda APENAS com o objeto JSON puro.`;

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

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
  };
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
    const dre = body?.dre;
    if (!dre || typeof dre !== "object" || !dre.grupos || !dre.totais) {
      return new Response(JSON.stringify({ error: "Envie 'dre' com 'grupos' e 'totais'." }), { status: 400, headers: cors(origin) });
    }
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY não configurada nos secrets." }), { status: 500, headers: cors(origin) });
    }
    const cliente = body?.cliente || {};
    const userText =
      "CLIENTE: " + JSON.stringify({ nome: cliente.nome || null, atividade: cliente.atividade || null, regime: cliente.regime || null, cidade: cliente.cidade || null }) +
      "\nPERÍODO: " + (body?.periodo || "não informado") +
      "\n\nDRE (grupos com linhas nome/valor, e totais calculados; valores em reais):\n" + JSON.stringify(dre) +
      (body?.observacao ? "\n\nOBSERVAÇÃO DA REUNIÃO:\n" + String(body.observacao).slice(0, 1500) : "") +
      "\n\nProduza a leitura dos números conforme as instruções do sistema. Responda APENAS com o JSON.";

    const r = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 2000, system: SYSTEM_PROMPT, messages: [{ role: "user", content: userText }] }),
    });
    if (!r.ok) {
      const errText = await r.text();
      console.error("Claude API error (dre-insights):", r.status, errText);
      return new Response(JSON.stringify({ error: "Erro na chamada à Claude API", status: r.status, details: errText.substring(0, 500) }), { status: 502, headers: cors(origin) });
    }
    const cd = await r.json();
    const txt: string = (cd.content || []).filter((b: any) => b && b.type === "text").map((b: any) => b.text).join("\n").trim();
    let parsed;
    try {
      parsed = JSON.parse(txt.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim());
    } catch (_e) {
      return new Response(JSON.stringify({ error: "Resposta não pôde ser interpretada como JSON.", raw: txt.substring(0, 1000) }), { status: 500, headers: cors(origin) });
    }
    return new Response(JSON.stringify({ data: parsed, usage: cd.usage, gerado_em: new Date().toISOString() }), { headers: cors(origin) });
  } catch (e: any) {
    console.error("Internal error:", e);
    return new Response(JSON.stringify({ error: "Erro interno na função", message: e?.message || String(e) }), { status: 500, headers: cors(origin) });
  }
});
