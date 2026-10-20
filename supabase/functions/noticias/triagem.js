// ============================================================
// MACEDO & REIS — Feed de notícias: a triagem pela IA (20/10/2026)
// Cada notícia nova vai pro modelo com o retrato da carteira (perfil.js, com cache de 1 hora): ele diz se interessa ao
// escritório, quanto (alta, média, baixa), de que setor é, resume em português, diz por que importa e o que fazer, e
// QUEM ela alcança — em critérios (regime, CNAE, cidade, obrigação…), que a coleta transforma nos clientes pelo banco.
// A resposta vem pela ferramenta "classificar" (formato fixo, conferido por lerClassificacao). O chamador da API é o
// mesmo jeito do chat da Reforma (supabase/functions/reforma-chat/agente.js): modelo que a conta não tem passa pro
// próximo; sobrecarga e rede esperam e tentam de novo. Puro: fetch e chave injetados — testes em tests/noticias.test.mjs.
// ============================================================

export const MODELOS = ['claude-sonnet-5-5', 'claude-sonnet-4-6'];
const API = 'https://api.anthropic.com/v1/messages';
export const SETORES = ['dp', 'fiscal', 'contabil', 'societario', 'irpf'];
export const RELEVANCIAS = ['alta', 'media', 'baixa'];

export function erroDaIa(tipo, mensagem) { const e = new Error(mensagem); e.tipo = tipo; return e; }
export function criarChamador({ fetch: f, chave, modelos = MODELOS, esperar = ms => new Promise(r => setTimeout(r, ms)), limiteMs = 60000 }) {
  let preferido = 0;
  return async function chamar(corpo) {
    let m = preferido, tentativas = 0;
    for (;;) {
      const modelo = modelos[m];
      let resp;
      try {
        resp = await f(API, { method: 'POST', headers: { 'x-api-key': chave, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
          body: JSON.stringify({ model: modelo, ...corpo }), signal: AbortSignal.timeout(limiteMs) });
      } catch (e) {
        if (e && (e.name === 'TimeoutError' || e.name === 'AbortError')) throw erroDaIa('tempo', 'API sem resposta em ' + Math.round(limiteMs / 1000) + ' s');
        if (tentativas < 2) { tentativas++; await esperar(2000 * tentativas); continue; }
        throw erroDaIa('rede', 'API inacessível: ' + ((e && e.message) || e));
      }
      if (resp.ok) { const j = await resp.json(); j._modelo = modelo; if (m > preferido) preferido = m; return j; }
      const txt = await resp.text().catch(() => '');
      if (resp.status === 404 && m < modelos.length - 1) { m++; continue; }
      if ((resp.status === 429 || resp.status === 529 || resp.status >= 500) && tentativas < 2) {
        const ra = Math.min(20, +((resp.headers && resp.headers.get && resp.headers.get('retry-after')) || 0) || 0) * 1000;
        tentativas++; await esperar(Math.max(3000 * tentativas, ra)); continue;
      }
      throw erroDaIa(resp.status === 429 || resp.status === 529 ? 'sobrecarga' : 'api', 'API ' + resp.status + ': ' + txt.slice(0, 300));
    }
  };
}

const REGRAS = `Você faz a triagem das notícias para o escritório Macedo & Reis Contabilidade, de Três Coroas/RS (Vale do Paranhana e Serra gaúcha).
O escritório atende empresas do Simples Nacional, MEIs, Lucro Presumido e algumas imunes (associações), quase todas no RS. Faz a parte fiscal (ICMS, ISS, Simples/PGDAS-D, DeSTDA, ST, notas fiscais, SPED, parcelamentos, a Reforma Tributária do IBS/CBS), o departamento pessoal (folha, admissões, rescisões, eSocial, FGTS, INSS, 13º, férias, pró-labore), a contabilidade (balanço, ECD, ECF, IRPJ e CSLL do Presumido, normas contábeis), o societário (abertura, alteração e baixa de empresas, Junta Comercial, alvarás, CNPJ, MEI) e o IR de pessoas físicas (sócios dos clientes).

Para cada notícia, decida com base SÓ no texto que vier (título, trecho e texto da página). Não invente fato, número, data ou artigo que não esteja no texto; se o texto não basta pra saber o que mudou, diga isso no resumo.

relevante = false quando a notícia não tem efeito prático pra um escritório contábil nem pros clientes: agenda de autoridade, evento, posse, homenagem, institucional, balanço de arrecadação, operação policial, política, esporte, saúde, notícia de outro estado ou município que não alcança o RS nem os clientes, assunto de grandes empresas que nenhum cliente da carteira tem (por exemplo, só Lucro Real de grande porte, comércio exterior, mercado financeiro).
Quando relevante, a relevância:
- alta: muda imposto, alíquota, obrigação, prazo, multa, regra ou benefício que alcança clientes da carteira (ou o próprio escritório) e pede ação ou atenção agora ou nos próximos meses; decisão de STF ou STJ com efeito prático em clientes da carteira; prazo que vence logo.
- media: é da área e alcança clientes da carteira, mas não pede ação já (projeto em tramitação, consulta pública, orientação, mudança com data distante, sistema que mudou de tela).
- baixa: é da área, mas o efeito nos clientes da carteira é pequeno ou incerto.

setores: os setores do escritório que precisam saber — dp, fiscal, contabil, societario, irpf (um ou mais).
resumo: 2 ou 3 frases em português, diretas: o que mudou, para quem e a partir de quando (datas em dd/mm/aaaa).
por_que: 1 ou 2 frases: por que importa pros clientes da carteira, dizendo o grupo alcançado com os números do retrato (ex.: "os 34 clientes com DeSTDA", "as 13 empresas de alimentação").
acao: o que o escritório deve fazer (conferir, avisar os clientes, ajustar a apuração, acompanhar), em 1 ou 2 frases; vazio se nada.
criterios: QUEM da carteira a notícia alcança, usando só valores do retrato abaixo — regimes (os nomes exatos), cnaes (prefixos de 2 a 7 dígitos dos códigos que aparecem no retrato), cidades (os nomes do retrato), obrigacoes (um trecho do nome da obrigação como está no retrato), naturezas (um trecho da natureza jurídica), com_funcionarios / com_prolabore (true quando é da folha). Entre os critérios vale todos ao mesmo tempo; dentro de cada lista, qualquer um. Use "todos": true quando alcança a carteira inteira (ou todo um regime — aí junto com regimes). Se alcança ninguém em particular, deixe os critérios vazios. Nunca cite nome de cliente.`;

export function montarSistema(perfil) {
  return [{ type: 'text', text: REGRAS + '\n\nRetrato da carteira hoje:\n' + perfil, cache_control: { type: 'ephemeral', ttl: '1h' } }];
}

export const FERRAMENTA = {
  name: 'classificar',
  description: 'Registra a triagem da notícia para o escritório.',
  input_schema: {
    type: 'object',
    properties: {
      relevante: { type: 'boolean' },
      relevancia: { type: 'string', enum: RELEVANCIAS },
      setores: { type: 'array', items: { type: 'string', enum: SETORES } },
      resumo: { type: 'string' },
      por_que: { type: 'string' },
      acao: { type: 'string' },
      criterios: {
        type: 'object',
        properties: {
          todos: { type: 'boolean' },
          regimes: { type: 'array', items: { type: 'string' } },
          cnaes: { type: 'array', items: { type: 'string' } },
          cidades: { type: 'array', items: { type: 'string' } },
          obrigacoes: { type: 'array', items: { type: 'string' } },
          naturezas: { type: 'array', items: { type: 'string' } },
          com_funcionarios: { type: 'boolean' },
          com_prolabore: { type: 'boolean' }
        }
      }
    },
    required: ['relevante', 'resumo']
  }
};

const fmtDia = iso => { if (!iso) return 'sem data'; const d = new Date(iso); return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10).split('-').reverse().join('/') : 'sem data'; };
// a mensagem com a notícia (o que a coleta tem dela)
export function mensagemDaNoticia({ titulo, fonte, tipoFonte, publicada_em, link, trecho, pagina }) {
  const partes = [`Fonte: ${fonte || 'desconhecida'}${tipoFonte ? ' (' + tipoFonte + ')' : ''}`, `Publicada: ${fmtDia(publicada_em)}`, `Título: ${titulo}`, `Endereço: ${link}`];
  if (trecho) partes.push('Trecho do RSS: ' + trecho);
  if (pagina && pagina.descricao && pagina.descricao !== trecho) partes.push('Descrição da página: ' + pagina.descricao);
  partes.push('Texto da página: ' + (pagina && pagina.texto ? pagina.texto : '(não foi possível ler a página)'));
  return partes.join('\n');
}

const texto = (v, max) => { const t = String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); return t ? t.slice(0, max) : null; };
const strs = (v, max = 30) => (Array.isArray(v) ? v : []).map(x => String(x == null ? '' : x).trim()).filter(Boolean).slice(0, max);
// a resposta do modelo → a triagem no formato da tabela (o que vier fora do formato é descartado, não gravado)
export function lerClassificacao(resposta) {
  const bloco = (resposta && resposta.content || []).find(b => b.type === 'tool_use' && b.name === 'classificar');
  if (!bloco || !bloco.input || typeof bloco.input !== 'object') throw erroDaIa('formato', 'a IA não devolveu a classificação');
  const i = bloco.input;
  const relevante = i.relevante === true;
  const c = i.criterios && typeof i.criterios === 'object' ? i.criterios : {};
  const criterios = {
    todos: c.todos === true, regimes: strs(c.regimes, 8), cnaes: strs(c.cnaes).map(x => x.replace(/\D/g, '')).filter(x => x.length >= 2 && x.length <= 7),
    cidades: strs(c.cidades), obrigacoes: strs(c.obrigacoes), naturezas: strs(c.naturezas, 8),
    com_funcionarios: c.com_funcionarios === true, com_prolabore: c.com_prolabore === true
  };
  return {
    relevante,
    relevancia: relevante ? (RELEVANCIAS.includes(i.relevancia) ? i.relevancia : 'baixa') : null,
    setores: relevante ? [...new Set(strs(i.setores).filter(s => SETORES.includes(s)))] : [],
    resumo: texto(i.resumo, 1200) || '(sem resumo)',
    por_que: relevante ? texto(i.por_que, 800) : null,
    acao: relevante ? texto(i.acao, 800) : null,
    criterios: relevante ? criterios : null
  };
}

// triar({ chamar, perfil, noticia }) → { classificacao, modelo, uso }
export async function triar({ chamar, perfil, noticia, maxTokens = 1200 }) {
  const resp = await chamar({
    max_tokens: maxTokens, system: montarSistema(perfil), tools: [FERRAMENTA], tool_choice: { type: 'tool', name: 'classificar' },
    messages: [{ role: 'user', content: mensagemDaNoticia(noticia) }]
  });
  const u = resp.usage || {};
  return { classificacao: lerClassificacao(resp), modelo: resp._modelo || null,
    uso: { entrada: u.input_tokens || 0, saida: u.output_tokens || 0, cache: (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0) } };
}
