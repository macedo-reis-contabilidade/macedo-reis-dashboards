// ============================================================
// MACEDO & REIS — Chat da Reforma: a conversa com o modelo (Messages API da Anthropic) e o laço das ferramentas
// O modelo pede ferramenta → o servidor roda → devolve o resultado → … até a resposta final (no máximo 6 rodadas ou o
// prazo do servidor, 70 s; na última, sem ferramenta). Cada chamada à API tem prazo próprio (a que começa perto do fim
// ainda tem 30 s): a pergunta inteira cabe no limite de tempo da Edge Function. O contexto fixo (instruções, índice, Base
// legal, sínteses) e a conversa até a última mensagem vão com cache. Puro: o "chamar" é injetado (testes roteirizados).
// ============================================================

import { descreverEtapa } from './ferramentas.js';

export const MODELOS = ['claude-sonnet-5-5', 'claude-sonnet-4-6'];
const API = 'https://api.anthropic.com/v1/messages';

// erro com o tipo (sobrecarga, tempo, rede, api): o servidor escolhe a mensagem em português por ele
export function erroDoChat(tipo, mensagem) { const e = new Error(mensagem); e.tipo = tipo; return e; }

// chamador da API: modelo que a conta não tem (404) passa pro próximo da lista — e as chamadas seguintes já começam nele;
// sobrecarga ou limite (429, 529, 5xx) e erro de rede esperam (o retry-after, se vier) e tentam de novo, duas vezes, se
// ainda houver prazo. "ate" (ms do relógio): o fim do prazo da pergunta — a chamada é abortada nele
export function criarChamador({ fetch: f, chave, modelos = MODELOS, esperar = ms => new Promise(r => setTimeout(r, ms)), agora = () => Date.now() }) {
  let preferido = 0;
  return async function chamar(corpo, { ate = null } = {}) {
    let m = preferido, tentativas = 0;
    const resta = () => ate == null ? 90000 : ate - agora();
    for (;;) {
      if (resta() < 3000) throw erroDoChat('tempo', 'prazo esgotado antes da chamada à API');
      const modelo = modelos[m], limite = Math.min(resta(), 90000);
      let resp;
      try {
        resp = await f(API, { method: 'POST', headers: { 'x-api-key': chave, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
          body: JSON.stringify({ model: modelo, ...corpo }), signal: AbortSignal.timeout(limite) });
      } catch (e) {
        if (e && (e.name === 'TimeoutError' || e.name === 'AbortError')) throw erroDoChat('tempo', 'API sem resposta em ' + Math.round(limite / 1000) + ' s');
        if (tentativas < 2 && resta() > 2000 * (tentativas + 1) + 10000) { tentativas++; await esperar(2000 * tentativas); continue; }
        throw erroDoChat('rede', 'API inacessível: ' + ((e && e.message) || e));
      }
      if (resp.ok) { const j = await resp.json(); j._modelo = modelo; if (m > preferido) preferido = m; return j; }
      const txt = await resp.text().catch(() => '');
      if (resp.status === 404 && m < modelos.length - 1) { m++; continue; }
      if ((resp.status === 429 || resp.status === 529 || resp.status >= 500) && tentativas < 2) {
        const ra = Math.min(20, +((resp.headers && resp.headers.get && resp.headers.get('retry-after')) || 0) || 0) * 1000;
        const espera = Math.max(2500 * (tentativas + 1), ra);
        if (resta() > espera + 10000) { tentativas++; await esperar(espera); continue; }
      }
      throw erroDoChat(resp.status === 429 || resp.status === 529 ? 'sobrecarga' : 'api', 'API ' + resp.status + ': ' + txt.slice(0, 300));
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
// o que fazer quando a saída de uma ferramenta passa do tamanho
const DICA_CORTE = { ler_material: 'leia a seção seguinte com ler_material', buscar_base: 'refine a busca', listar_casos: 'use filtro, busca ou a página seguinte (pagina)' };

export async function responder({ chamar, sistema, definicoes, ferramentas, historico = [], mensagem, aoEtapa = () => {},
  maxRodadas = 6, prazoMs = 70000, agora = () => Date.now(), maxTokens = 2500 }) {
  const inicio = agora();
  const ate = inicio + prazoMs + 30000;   // a chamada que começa perto do prazo ainda tem 30 s pra terminar
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
    const r = await chamar(corpo, { ate });
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
      const entrada = b.input && typeof b.input === 'object' && !Array.isArray(b.input) ? b.input : {};
      let desc = String(b.name);
      try { desc = descreverEtapa(b.name, entrada); } catch (e) { /* entrada estranha: fica o nome */ }
      try { aoEtapa(desc); } catch (e) { /* quem pediu fechou a janela */ }
      const fn = Object.hasOwn(ferramentas, b.name) ? ferramentas[b.name] : null;
      let saida, erro = false;
      try { saida = fn ? await fn(entrada) : 'Ferramenta desconhecida: ' + b.name; erro = !fn; }
      catch (e) { saida = 'Erro na ferramenta: ' + ((e && e.message) || e); erro = true; }
      saida = String(saida);
      if (saida.length > 14000) saida = saida.slice(0, 14000) + '\n…(cortado: a saída passou de 14 mil caracteres' + (DICA_CORTE[b.name] ? ' — ' + DICA_CORTE[b.name] : '') + ')';
      etapas.push({ ferramenta: b.name, entrada, descricao: desc, caracteres: saida.length, erro });
      resultados.push({ type: 'tool_result', tool_use_id: b.id, content: saida, ...(erro ? { is_error: true } : {}) });
    }
    msgs.push({ role: 'user', content: resultados });
  }
}

// os códigos que aparecem numa fonte citada: todos os que existem na base (inclusive "[regras A e B]"); o do começo, mesmo
// que não exista (é o que a resposta quis citar)
export const CODIGO_RX = /\b[A-Z0-9]{2,}(?:-[A-Z0-9]+)+\b/g;

// as fontes citadas na resposta ([CODIGO, onde] ou [regra CODIGO]); código que não existe na base vai à parte
export function fontesDaResposta(texto, codigosMateriais, codigosRegras) {
  const achadas = new Map(), desconhecidas = new Set();
  for (const m of String(texto || '').matchAll(/\[([^\]\n]{2,240})\]/g)) {
    m[1].split(/[;·]/).forEach(parte => {
      const p = parte.trim();
      const rg = /^regras?\s+([A-Za-z0-9][A-Za-z0-9-]*)/i.exec(p);
      const ehRegra = !!rg;
      const cods = [...p.matchAll(CODIGO_RX)].map(x => x[0]);
      if (rg && !cods.includes(rg[1].toUpperCase())) cods.unshift(rg[1].toUpperCase());
      cods.forEach((cod, i) => {
        if (codigosRegras.has(cod) && (ehRegra || !codigosMateriais.has(cod))) achadas.set('regra:' + cod, { tipo: 'regra', codigo: cod });
        else if (codigosMateriais.has(cod)) achadas.set('material:' + cod, { tipo: 'material', codigo: cod });
        else if (i === 0 && (ehRegra || p.startsWith(cod))) desconhecidas.add(cod);
      });
    });
  }
  return { fontes: [...achadas.values()], desconhecidas: [...desconhecidas] };
}
