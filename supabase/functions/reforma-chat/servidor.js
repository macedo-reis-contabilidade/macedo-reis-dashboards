// ============================================================
// MACEDO & REIS — Chat da Reforma ("Perguntar à base"): o servidor (Edge Function reforma-chat)
// Só a equipe: login do sistema (o e-mail @macedoereis.com.br, conferido no Auth — a chave pública sozinha não entra),
// com limite de perguntas por dia por pessoa. Lê a base (rt_materiais, rt_regras, rt_regra_materiais, rt_parametros) e os
// casos (rt_casos + nome e CNAE do cliente, nada além) com a chave de servidor, conversa com o modelo (agente.js) e grava
// cada pergunta no histórico (rt_chat). Com "fluxo", devolve as etapas enquanto trabalha (text/event-stream).
// Avaliação automática: o banco cria a linha da pergunta em rt_chat (usuario "avaliacao", situacao "pendente") e chama a
// função com o id dela — vale uma vez só, por 30 minutos; ninguém de fora cria essa linha (a tabela só tem leitura).
// Puro: env, fetch, relógio e chamador injetados — testes em tests/reforma-chat.test.mjs.
// ============================================================

import { criarIndice } from './busca.js';
import { montarSistema, preambulo } from './prompt.js';
import { DEFINICOES, CAMPOS, BOOLS, criarFerramentas, nomeDoCaso } from './ferramentas.js';
import { criarChamador, responder, fontesDaResposta } from './agente.js';
import { aliquotas2027 } from '../../../assets/js/rt-motor.js';

export const DOMINIO = '@macedoereis.com.br';
export const LIMITE_DIA = 60;
const TTL_BASE = 10 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// o dia no fuso de Brasília (UTC−3, sem horário de verão)
const diaBR = d => new Date(d.getTime() - 3 * 3600e3).toISOString().slice(0, 10);
export const hojeBR = d => diaBR(d).split('-').reverse().join('/');
const inicioDoDiaBR = d => diaBR(d) + 'T03:00:00Z';

// a simulação da tela (ficha aberta, calculada e não gravada): só os campos da entrada do motor
export function limparTela(t, casoId) {
  if (!casoId || !t || typeof t !== 'object' || !t.input || typeof t.input !== 'object') return null;
  const input = {};
  Object.entries(t.input).forEach(([k, v]) => {
    if (k in CAMPOS) { if (v === null) input[k] = null; else if (v !== '' && Number.isFinite(+v)) input[k] = +v; }
    else if (k in BOOLS) input[k] = !!v;
    else if (k === 'anexo') input.anexo = String(v || '').trim().toUpperCase().slice(0, 3);
  });
  if (!input.anexo || !(input.receita > 0)) return null;
  const procedencia = t.procedencia && typeof t.procedencia === 'object' && JSON.stringify(t.procedencia).length < 30000 ? t.procedencia : {};
  return { caso_id: casoId, input, procedencia };
}

export function limparHistorico(h) {
  return (Array.isArray(h) ? h : []).slice(-6)
    .map(x => ({ pergunta: String((x && x.pergunta) || '').slice(0, 2000), resposta: String((x && x.resposta) || '').slice(0, 6000) }))
    .filter(x => x.pergunta.trim() && x.resposta.trim());
}

export function criarServidor({ env, fetch: f = globalThis.fetch, agora = () => new Date(), chamar = null, prazoMs = 70000 }) {
  const URLB = env('SUPABASE_URL'), SERVICO = env('SUPABASE_SERVICE_ROLE_KEY'), ANON = env('SUPABASE_ANON_KEY');
  const chamarModelo = chamar || criarChamador({ fetch: f, chave: env('ANTHROPIC_API_KEY') });
  let cacheBase = null;

  async function rest(caminho, { method = 'GET', body, prefer } = {}) {
    const r = await f(URLB + '/rest/v1/' + caminho, { method,
      headers: { apikey: SERVICO, Authorization: 'Bearer ' + SERVICO, 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) },
      body: body == null ? undefined : JSON.stringify(body) });
    if (!r.ok) throw new Error('banco ' + r.status + ': ' + (await r.text().catch(() => '')).slice(0, 200));
    return r;
  }
  const lista = async caminho => (await rest(caminho)).json();

  // a base fixa (recarrega a cada 10 minutos: material novo entra sozinho)
  async function carregarBase() {
    if (cacheBase && agora().getTime() - cacheBase.em < TTL_BASE) return cacheBase;
    const [materiais, regras, vinculos, prm] = await Promise.all([
      lista('rt_materiais?select=codigo,modulo,titulo,tipo,oficial,autor,data_ref,leitura,ordem&ativo=eq.true&order=modulo.asc,ordem.asc,codigo.asc'),
      lista('rt_regras?select=codigo,titulo,dispositivo,regra,aplica_a,efeito,fonte,verificado_em&ativo=eq.true&order=codigo.asc'),
      lista('rt_regra_materiais?select=regra_codigo,material_codigo,onde,ordem&order=regra_codigo.asc,ordem.asc'),
      lista('rt_parametros?select=chave,valor')
    ]);
    const aliq = (prm.find(p => p.chave === 'aliq_ref_2027') || {}).valor;
    cacheBase = { em: agora().getTime(), params: aliquotas2027(aliq), indice: criarIndice(materiais), porCodigo: new Map(materiais.map(m => [m.codigo, m])),
      sistema: montarSistema({ materiais, regras, vinculos }), codMateriais: new Set(materiais.map(m => m.codigo)), codRegras: new Set(regras.map(r => r.codigo)) };
    return cacheBase;
  }

  // os casos da campanha com o nome e o CNAE do cliente (nada mais do cadastro)
  async function carregarCasosDoBanco() {
    const casos = await lista('rt_casos?select=id,cliente_id,cnae_base,segmento,triagem,score,decisao,status,fundamento,comunicado_em,prazo_opcao,sim_custo_dentro,sim_custo_fora,sim_credito_cliente_dentro,sim_credito_cliente_fora,sim_obs&order=criado_em.asc');
    const ids = [...new Set(casos.map(c => c.cliente_id).filter(id => UUID.test(String(id))))];
    const clientes = [];
    for (let i = 0; i < ids.length; i += 80) clientes.push(...await lista('clientes?select=id,nome_principal,nome_fantasia,cnae_principal,cidade&id=in.(' + ids.slice(i, i + 80).join(',') + ')'));
    const porId = new Map(clientes.map(c => [c.id, c]));
    return casos.map(c => ({ ...c, cliente: porId.get(c.cliente_id) || {} }));
  }

  async function usuarioDe(req) {
    const h = req.headers.get('Authorization') || '';
    const jwt = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
    if (!jwt) return null;
    const r = await f(URLB + '/auth/v1/user', { headers: { apikey: ANON || SERVICO, Authorization: 'Bearer ' + jwt } });
    if (!r.ok) return null;
    const u = await r.json().catch(() => null);
    return u && u.email ? u : null;
  }

  async function perguntasHoje(email) {
    const r = await rest('rt_chat?select=id&limit=1&usuario=eq.' + encodeURIComponent(email) + '&criado_em=gte.' + encodeURIComponent(inicioDoDiaBR(agora())), { prefer: 'count=exact' });
    const cr = r.headers.get('content-range') || '';
    return +(cr.split('/')[1] || 0) || 0;
  }

  // a linha da avaliação: vale uma vez (passa de "pendente" a "rodando"), até 30 minutos depois de criada
  async function reivindicar(id) {
    if (!UUID.test(id)) return null;
    const desde = new Date(agora().getTime() - 30 * 60e3).toISOString();
    const r = await rest('rt_chat?id=eq.' + id + '&usuario=eq.avaliacao&situacao=eq.pendente&criado_em=gte.' + encodeURIComponent(desde),
      { method: 'PATCH', body: { situacao: 'rodando' }, prefer: 'return=representation' });
    const linhas = await r.json();
    return linhas[0] || null;
  }

  async function executar({ usuario, pergunta, historico, contexto, conversa, id, t0, aoEtapa }) {
    let base = null, res = null, erro = null, ctx = { ...contexto };
    try {
      base = await carregarBase();
      let memo = null;
      const carregarCasos = async () => memo || (memo = await carregarCasosDoBanco());
      let nomeFicha = null;
      if (ctx.caso_id) {
        const c = (await carregarCasos()).find(x => x.id === ctx.caso_id);
        if (c) nomeFicha = nomeDoCaso(c); else ctx = { caso_id: null, tela: null };
      }
      const ferramentas = criarFerramentas({ base, carregarCasos, params: base.params, contexto: ctx });
      const mensagem = preambulo({ hoje: hojeBR(agora()), caso: nomeFicha, telaNaoGravada: !!ctx.tela }) + pergunta;
      res = await responder({ chamar: chamarModelo, sistema: base.sistema, definicoes: DEFINICOES, ferramentas, historico, mensagem, aoEtapa, prazoMs });
    } catch (e) { erro = (e && e.message) || String(e); }
    const fs = res && base ? fontesDaResposta(res.texto, base.codMateriais, base.codRegras) : { fontes: [], desconhecidas: [] };
    const linha = { usuario, conversa: conversa || null, caso_id: ctx.caso_id || null, pergunta, resposta: res ? res.texto : null,
      fontes: res ? { citadas: fs.fontes, desconhecidas: fs.desconhecidas } : null, etapas: res ? res.etapas : null, modelo: res ? res.modelo : null,
      tokens_entrada: res ? res.uso.entrada : null, tokens_saida: res ? res.uso.saida : null, tokens_cache_leitura: res ? res.uso.cacheLeitura : null,
      tokens_cache_escrita: res ? res.uso.cacheEscrita : null, duracao_ms: agora().getTime() - t0, situacao: erro ? 'erro' : 'ok', erro: erro ? erro.slice(0, 1000) : null };
    try {
      if (id) await rest('rt_chat?id=eq.' + id, { method: 'PATCH', body: linha, prefer: 'return=minimal' });
      else await rest('rt_chat', { method: 'POST', body: linha, prefer: 'return=minimal' });
    } catch (e) { console.error('reforma-chat: histórico não gravado —', e && e.message); }
    if (erro) return { ok: false, erro: 'Não consegui responder agora (' + erro.slice(0, 160) + '). Tente de novo em instantes.' };
    return { ok: true, texto: res.texto, fontes: fs.fontes, cortada: res.cortada };
  }

  return async function atender(req) {
    const cors = { 'Access-Control-Allow-Origin': req.headers.get('origin') || '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.method !== 'POST') return json({ erro: 'Use POST.' }, 405);
    let body;
    try { body = await req.json(); } catch (e) { return json({ erro: 'Corpo inválido.' }, 400); }
    if (!body || typeof body !== 'object') return json({ erro: 'Corpo inválido.' }, 400);
    const t0 = agora().getTime();
    try {
      // avaliação automática: a linha criada pelo banco diz a pergunta (e o caso, quando é sobre um)
      if (body.avaliacao) {
        const linha = await reivindicar(String(body.avaliacao));
        if (!linha) return json({ erro: 'Avaliação inválida ou já usada.' }, 403);
        const res = await executar({ usuario: 'avaliacao', pergunta: linha.pergunta, historico: [], contexto: { caso_id: linha.caso_id || null, tela: null }, conversa: linha.conversa, id: linha.id, t0 });
        return json(res.ok ? { resposta: res.texto, fontes: res.fontes } : { erro: res.erro }, res.ok ? 200 : 500);
      }
      const u = await usuarioDe(req);
      if (!u) return json({ erro: 'Entre no sistema pra usar o chat.' }, 401);
      const email = String(u.email).toLowerCase();
      if (!email.endsWith(DOMINIO)) return json({ erro: 'O chat é só da equipe do escritório.' }, 403);
      const pergunta = String(body.pergunta || '').trim();
      if (!pergunta) return json({ erro: 'Escreva a pergunta.' }, 400);
      if (pergunta.length > 2000) return json({ erro: 'Pergunta longa demais (até 2.000 caracteres).' }, 400);
      if (await perguntasHoje(email) >= LIMITE_DIA) return json({ erro: 'Você chegou ao limite de ' + LIMITE_DIA + ' perguntas por dia. Amanhã libera de novo.' }, 429);
      const ctxIn = body.contexto && typeof body.contexto === 'object' ? body.contexto : {};
      const casoId = UUID.test(String(ctxIn.caso_id || '')) ? String(ctxIn.caso_id) : null;
      const contexto = { caso_id: casoId, tela: limparTela(ctxIn.tela, casoId) };
      const conversa = UUID.test(String(body.conversa || '')) ? String(body.conversa) : null;
      const pedido = { usuario: email, pergunta, historico: limparHistorico(body.historico), contexto, conversa, t0 };
      if (!body.fluxo) {
        const res = await executar(pedido);
        return json(res.ok ? { resposta: res.texto, fontes: res.fontes, cortada: res.cortada } : { erro: res.erro }, res.ok ? 200 : 500);
      }
      const enc = new TextEncoder();
      const stream = new ReadableStream({
        async start(ctrl) {
          const enviar = o => { try { ctrl.enqueue(enc.encode('data: ' + JSON.stringify(o) + '\n\n')); } catch (e) { /* quem pediu fechou a janela */ } };
          const res = await executar({ ...pedido, aoEtapa: texto => enviar({ tipo: 'etapa', texto }) });
          enviar(res.ok ? { tipo: 'resposta', texto: res.texto, fontes: res.fontes, cortada: res.cortada } : { tipo: 'erro', texto: res.erro });
          try { ctrl.close(); } catch (e) { /* idem */ }
        }
      });
      return new Response(stream, { headers: { ...cors, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } });
    } catch (e) {
      console.error('reforma-chat:', e && e.message);
      return json({ erro: 'Erro no chat: ' + String((e && e.message) || e).slice(0, 200) }, 500);
    }
  };
}
