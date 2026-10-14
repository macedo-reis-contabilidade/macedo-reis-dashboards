// ============================================================
// MACEDO & REIS — Chat da Reforma: a conversa com o modelo (Messages API da Anthropic) e o laço das ferramentas
// O modelo pede ferramenta → o servidor roda → devolve o resultado → … até a resposta final (no máximo 6 rodadas ou
// ~100 s; na última, sem ferramenta). O contexto fixo (instruções, índice, Base legal, sínteses) e a conversa até a
// última mensagem vão com cache. Puro: o "chamar" é injetado (testes com respostas roteirizadas).
// ============================================================

import { descreverEtapa } from './ferramentas.js';

export const MODELOS = ['claude-sonnet-5-5', 'claude-sonnet-4-6'];
const API = 'https://api.anthropic.com/v1/messages';

// chamador da API: modelo que a conta não tem (404) passa pro próximo da lista; sobrecarga ou limite (429, 529, 5xx)
// espera e tenta de novo, duas vezes
export function criarChamador({ fetch: f, chave, modelos = MODELOS, esperar = ms => new Promise(r => setTimeout(r, ms)) }) {
  let i = 0;
  return async function chamar(corpo) {
    let tentativas = 0;
    for (;;) {
      const modelo = modelos[i];
      const resp = await f(API, { method: 'POST', headers: { 'x-api-key': chave, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: modelo, ...corpo }) });
      if (resp.ok) { const j = await resp.json(); j._modelo = modelo; return j; }
      const txt = await resp.text().catch(() => '');
      if (resp.status === 404 && i < modelos.length - 1) { i++; continue; }
      if ((resp.status === 429 || resp.status === 529 || resp.status >= 500) && tentativas < 2) { tentativas++; await esperar(2500 * tentativas); continue; }
      throw new Error('API ' + resp.status + ': ' + txt.slice(0, 300));
    }
  };
}

// cache na última mensagem: a próxima rodada lê do cache tudo o que veio antes
export function comCache(msgs) {
  return msgs.map((m, i) => {
    if (i !== msgs.length - 1) return m;
    const blocos = typeof m.content === 'string' ? [{ type: 'text', text: m.content }] : m.content.map(b => ({ ...b }));
    blocos[blocos.length - 1] = { ...blocos[blocos.length - 1], cache_control: { type: 'ephemeral' } };
    return { role: m.role, content: blocos };
  });
}

// ============================================================
// responder({ chamar, sistema, definicoes, ferramentas, historico, mensagem, aoEtapa }) →
//   { texto, etapas, uso: { entrada, saida, cacheLeitura, cacheEscrita }, modelo, rodadas, cortada }
// historico: [{ pergunta, resposta }] das perguntas anteriores da conversa (só o texto)
// ============================================================
export async function responder({ chamar, sistema, definicoes, ferramentas, historico = [], mensagem, aoEtapa = () => {},
  maxRodadas = 6, prazoMs = 100000, agora = () => Date.now(), maxTokens = 2500 }) {
  const inicio = agora();
  const msgs = [];
  historico.forEach(h => { msgs.push({ role: 'user', content: h.pergunta }); msgs.push({ role: 'assistant', content: h.resposta }); });
  msgs.push({ role: 'user', content: mensagem });
  const uso = { entrada: 0, saida: 0, cacheLeitura: 0, cacheEscrita: 0 };
  const etapas = [];
  let modelo = null;
  for (let rodada = 1; ; rodada++) {
    const ultima = rodada >= maxRodadas || agora() - inicio > prazoMs;
    const corpo = { max_tokens: maxTokens, system: sistema, tools: definicoes, messages: comCache(msgs) };
    if (ultima) corpo.tool_choice = { type: 'none' };
    const r = await chamar(corpo);
    modelo = r._modelo || modelo;
    const u = r.usage || {};
    uso.entrada += u.input_tokens || 0; uso.saida += u.output_tokens || 0;
    uso.cacheLeitura += u.cache_read_input_tokens || 0; uso.cacheEscrita += u.cache_creation_input_tokens || 0;
    const blocos = r.content || [];
    const pedidos = blocos.filter(b => b.type === 'tool_use');
    if (ultima || r.stop_reason !== 'tool_use' || !pedidos.length) {
      const texto = blocos.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
      return { texto: texto || 'Não consegui montar a resposta. Tente perguntar de outro jeito.', etapas, uso, modelo, rodadas: rodada, cortada: r.stop_reason === 'max_tokens' };
    }
    msgs.push({ role: 'assistant', content: blocos });
    const resultados = [];
    for (const b of pedidos) {
      const desc = descreverEtapa(b.name, b.input || {});
      aoEtapa(desc);
      const fn = ferramentas[b.name];
      let saida, erro = false;
      try { saida = fn ? await fn(b.input || {}) : 'Ferramenta desconhecida: ' + b.name; erro = !fn; }
      catch (e) { saida = 'Erro na ferramenta: ' + ((e && e.message) || e); erro = true; }
      saida = String(saida);
      if (saida.length > 14000) saida = saida.slice(0, 14000) + '\n…(cortado: leia por partes com ler_material)';
      etapas.push({ ferramenta: b.name, entrada: b.input || {}, descricao: desc, caracteres: saida.length, erro });
      resultados.push({ type: 'tool_result', tool_use_id: b.id, content: saida, ...(erro ? { is_error: true } : {}) });
    }
    msgs.push({ role: 'user', content: resultados });
  }
}

// as fontes citadas na resposta ([CODIGO, onde] ou [regra CODIGO]); código que não existe na base vai à parte
export function fontesDaResposta(texto, codigosMateriais, codigosRegras) {
  const achadas = new Map(), desconhecidas = new Set();
  for (const m of String(texto || '').matchAll(/\[([^\]\n]{2,240})\]/g)) {
    m[1].split(/[;·]/).forEach(parte => {
      const p = parte.trim();
      const rg = /^regras?\s+([A-Za-z0-9][A-Za-z0-9-]*)/i.exec(p);
      const cod = rg ? rg[1].toUpperCase() : ((/^([A-Z0-9]{2,}(?:-[A-Z0-9]+)+)/.exec(p) || [])[1] || null);
      if (!cod) return;
      if (codigosRegras.has(cod) && (rg || !codigosMateriais.has(cod))) achadas.set('regra:' + cod, { tipo: 'regra', codigo: cod });
      else if (codigosMateriais.has(cod)) achadas.set('material:' + cod, { tipo: 'material', codigo: cod });
      else desconhecidas.add(cod);
    });
  }
  return { fontes: [...achadas.values()], desconhecidas: [...desconhecidas] };
}
