// ============================================================
// MACEDO & REIS — Chat da Reforma ("Perguntar à base"): o servidor (Edge Function reforma-chat)
// Só a equipe: login do sistema (o e-mail @macedoereis.com.br, conferido no Auth — a chave pública sozinha não entra),
// com limite de perguntas por dia por pessoa. Lê a base (rt_materiais, rt_regras, rt_regra_materiais, rt_parametros) e os
// casos (rt_casos + nome e CNAE do cliente, nada além; quem saiu da carteira fica fora, como na lista da tela) com a chave
// de servidor, conversa com o modelo (agente.js) e grava cada pergunta no histórico (rt_chat). Com "fluxo", devolve as
// etapas enquanto trabalha (text/event-stream).
// O limite conta a pergunta ANTES de ela rodar: a linha do histórico nasce "rodando" e só então a conta do dia é feita —
// pedidos em paralelo não furam o limite, e no máximo 2 perguntas da mesma pessoa rodam ao mesmo tempo. Pergunta que deu
// erro antes de chegar ao modelo (sem tokens) não gasta a cota. Erro pro usuário sai em português, sem detalhe interno
// (o detalhe fica no rt_chat e no log).
// Avaliação automática: o banco cria a linha da pergunta em rt_chat (usuario "avaliacao", situacao "pendente") e chama a
// função com o id dela — vale uma vez só, por 30 minutos; ninguém de fora cria essa linha (a tabela só tem leitura).
// Puro: env, fetch, relógio e chamador injetados — testes em tests/reforma-chat.test.mjs.
// ============================================================

import { criarIndice } from './busca.js';
import { montarSistema, preambulo } from './prompt.js';
import { DEFINICOES, CAMPOS, BOOLS, criarFerramentas, nomeDoCaso, descreverEtapa } from './ferramentas.js';
import { criarChamador, responder, fontesDaResposta } from './agente.js';
import { aliquotas2027 } from '../../../assets/js/rt-motor.js';

export const DOMINIO = '@macedoereis.com.br';
export const LIMITE_DIA = 60;
export const SIMULTANEAS = 2;   // perguntas da mesma pessoa rodando ao mesmo tempo
const TTL_BASE = 10 * 60 * 1000;
const MAX_CORPO = 200000;       // pergunta (2 mil) + histórico (6 × 8 mil) + a tela, com folga
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NATUREZAS = ['mercadoria', 'servico', 'transporte', 'comunicacao', 'energia'];

// o dia no fuso de Brasília (UTC−3, sem horário de verão)
const diaBR = d => new Date(d.getTime() - 3 * 3600e3).toISOString().slice(0, 10);
export const hojeBR = d => diaBR(d).split('-').reverse().join('/');
const inicioDoDiaBR = d => diaBR(d) + 'T03:00:00Z';

// a simulação da tela (ficha aberta, calculada e não gravada): só os campos da entrada do motor (nome herdado, como
// "constructor", não passa), a procedência daquele cálculo e a natureza das vendas do resumo do Domínio da tela (o da
// importação desta sessão ou o gravado: o perfil da atividade, na confiança, depende dela)
export function limparTela(t, casoId) {
  if (!casoId || !t || typeof t !== 'object' || !t.input || typeof t.input !== 'object') return null;
  const input = {};
  Object.entries(t.input).forEach(([k, v]) => {
    if (Object.hasOwn(CAMPOS, k)) { if (v === null) input[k] = null; else if (v !== '' && Number.isFinite(+v)) input[k] = +v; }
    else if (Object.hasOwn(BOOLS, k)) input[k] = !!v;
    else if (k === 'anexo') input.anexo = String(v || '').trim().toUpperCase().slice(0, 3);
  });
  if (!input.anexo || !(input.receita > 0)) return null;
  const pr = t.procedencia;
  const procedencia = pr && typeof pr === 'object' && !Array.isArray(pr) && JSON.stringify(pr).length < 30000 ? pr : {};
  let natureza = null;
  if (t.natureza && typeof t.natureza === 'object') {
    const n = {};
    NATUREZAS.forEach(k => { const v = t.natureza[k]; if (v != null && v !== '' && Number.isFinite(+v) && +v >= 0) n[k] = +v; });
    if (Object.keys(n).length) natureza = n;
  }
  return { caso_id: casoId, input, procedencia, natureza };
}

// o que o usuário lê quando a pergunta falha (o detalhe vai pro histórico e pro log)
export function mensagemDeErro(e) {
  const tipo = e && e.tipo;
  if (tipo === 'sobrecarga') return 'O serviço de IA está sobrecarregado agora. Tente de novo em um minuto.';
  if (tipo === 'tempo') return 'A resposta demorou demais. Tente de novo — se der, com uma pergunta mais específica.';
  return 'Não consegui responder agora. Tente de novo em instantes.';
}

export function limparHistorico(h) {
  return (Array.isArray(h) ? h : []).slice(-6)
    .map(x => ({ pergunta: String((x && x.pergunta) || '').slice(0, 2000), resposta: String((x && x.resposta) || '').slice(0, 6000) }))
    .filter(x => x.pergunta.trim() && x.resposta.trim());
}

export function criarServidor({ env, fetch: f = globalThis.fetch, agora = () => new Date(), chamar = null, prazoMs = 70000 }) {
  const URLB = env('SUPABASE_URL'), SERVICO = env('SUPABASE_SERVICE_ROLE_KEY'), ANON = env('SUPABASE_ANON_KEY');
  const chamarModelo = chamar || criarChamador({ fetch: f, chave: env('ANTHROPIC_API_KEY') });
  let cacheBase = null, carregando = null;

  async function rest(caminho, { method = 'GET', body, prefer } = {}) {
    const r = await f(URLB + '/rest/v1/' + caminho, { method,
      headers: { apikey: SERVICO, Authorization: 'Bearer ' + SERVICO, 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) },
      body: body == null ? undefined : JSON.stringify(body) });
    if (!r.ok) throw new Error('banco ' + r.status + ': ' + (await r.text().catch(() => '')).slice(0, 200));
    return r;
  }
  const lista = async caminho => (await rest(caminho)).json();

  // a base fixa (recarrega a cada 10 minutos: material novo entra sozinho). Pedidos ao mesmo tempo esperam a mesma carga;
  // a ordem é estável (o texto fixo igual mantém o cache do modelo)
  async function carregarBase() {
    if (cacheBase && agora().getTime() - cacheBase.em < TTL_BASE) return cacheBase;
    if (!carregando) carregando = (async () => {
      const [materiais, regras, vinculos, prm] = await Promise.all([
        lista('rt_materiais?select=codigo,modulo,titulo,tipo,oficial,autor,data_ref,leitura,ordem&ativo=eq.true&order=modulo.asc,ordem.asc,codigo.asc'),
        lista('rt_regras?select=codigo,titulo,dispositivo,regra,aplica_a,efeito,fonte,verificado_em&ativo=eq.true&order=codigo.asc'),
        lista('rt_regra_materiais?select=regra_codigo,material_codigo,onde,ordem&order=regra_codigo.asc,ordem.asc,material_codigo.asc'),
        lista('rt_parametros?select=chave,valor')
      ]);
      const aliq = (prm.find(p => p.chave === 'aliq_ref_2027') || {}).valor;
      cacheBase = { em: agora().getTime(), params: aliquotas2027(aliq), indice: criarIndice(materiais), porCodigo: new Map(materiais.map(m => [m.codigo, m])),
        sistema: montarSistema({ materiais, regras, vinculos }), codMateriais: new Set(materiais.map(m => m.codigo)), codRegras: new Set(regras.map(r => r.codigo)) };
      return cacheBase;
    })().finally(() => { carregando = null; });
    return carregando;
  }

  // os casos da campanha com o nome e o CNAE do cliente (nada mais do cadastro). Quem saiu da carteira (carteira_info.saida
  // até hoje) fica fora, como na lista da tela
  async function carregarCasosDoBanco() {
    const casos = await lista('rt_casos?select=id,cliente_id,cnae_base,segmento,triagem,score,decisao,status,fundamento,comunicado_em,prazo_opcao,sim_custo_dentro,sim_custo_fora,sim_credito_cliente_dentro,sim_credito_cliente_fora,sim_obs&order=criado_em.asc');
    const ids = [...new Set(casos.map(c => c.cliente_id).filter(id => UUID.test(String(id))))];
    const clientes = [], carteira = [];
    for (let i = 0; i < ids.length; i += 80) {
      const lote = ids.slice(i, i + 80).join(',');
      const [cl, ca] = await Promise.all([
        lista('clientes?select=id,nome_principal,nome_fantasia,cnae_principal,cidade&id=in.(' + lote + ')'),
        lista('carteira_info?select=cliente_id,saida&cliente_id=in.(' + lote + ')')
      ]);
      clientes.push(...cl); carteira.push(...ca);
    }
    const hoje = diaBR(agora());
    const saiu = new Set(carteira.filter(x => x.saida && String(x.saida).slice(0, 10) <= hoje).map(x => x.cliente_id));
    const porId = new Map(clientes.map(c => [c.id, c]));
    return casos.filter(c => !saiu.has(c.cliente_id)).map(c => ({ ...c, cliente: porId.get(c.cliente_id) || {} }));
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

  async function contar(caminho) {
    const r = await rest(caminho, { prefer: 'count=exact' });
    const cr = r.headers.get('content-range') || '';
    return +(cr.split('/')[1] || 0) || 0;
  }
  // a conta vai só até a linha que acabou de nascer (criado_em até o dela): em pedidos simultâneos, passa quem chegou
  // primeiro. As do dia: a que deu erro sem chegar ao modelo (sem tokens) não conta
  const ate = criado => '&criado_em=lte.' + encodeURIComponent(criado);
  const perguntasHoje = (email, criado) => contar('rt_chat?select=id&limit=1&usuario=eq.' + encodeURIComponent(email) + '&criado_em=gte.' + encodeURIComponent(inicioDoDiaBR(agora()))
    + ate(criado) + '&or=(situacao.neq.erro,tokens_saida.gt.0)');
  // as que estão rodando agora (as dos últimos 3 minutos: uma que morreu no meio não trava a pessoa)
  const rodandoAgora = (email, criado) => contar('rt_chat?select=id&limit=1&usuario=eq.' + encodeURIComponent(email) + '&situacao=eq.rodando&criado_em=gte.'
    + encodeURIComponent(new Date(agora().getTime() - 3 * 60e3).toISOString()) + ate(criado));
  // a linha do histórico nasce "rodando", antes da conta do limite
  async function abrirLinha(linha) {
    const r = await rest('rt_chat?select=id,criado_em', { method: 'POST', body: { ...linha, situacao: 'rodando' }, prefer: 'return=representation' });
    const j = await r.json().catch(() => null);
    const l = Array.isArray(j) ? j[0] : null;
    return l && UUID.test(String(l.id)) && l.criado_em ? { id: String(l.id), criado: String(l.criado_em) } : null;
  }
  const fecharLinha = (id, campos) => rest('rt_chat?id=eq.' + id, { method: 'PATCH', body: campos, prefer: 'return=minimal' });

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
      res = await responder({ chamar: chamarModelo, sistema: base.sistema, definicoes: DEFINICOES, ferramentas, historico, mensagem, aoEtapa, prazoMs, descrever: descreverEtapa });
    } catch (e) { erro = e || new Error('erro'); }
    const fs = res && base ? fontesDaResposta(res.texto, base.codMateriais, base.codRegras) : { fontes: [], desconhecidas: [] };
    const detalhe = erro ? String((erro && erro.message) || erro).slice(0, 1000) : null;
    const linha = { usuario, conversa: conversa || null, caso_id: ctx.caso_id || null, pergunta, resposta: res ? res.texto : null,
      fontes: res ? { citadas: fs.fontes, desconhecidas: fs.desconhecidas, ...(res.cortada ? { cortada: true } : {}) } : null, etapas: res ? res.etapas : null, modelo: res ? res.modelo : null,
      tokens_entrada: res ? res.uso.entrada : null, tokens_saida: res ? res.uso.saida : null, tokens_cache_leitura: res ? res.uso.cacheLeitura : null,
      tokens_cache_escrita: res ? res.uso.cacheEscrita : null, duracao_ms: agora().getTime() - t0, situacao: erro ? 'erro' : 'ok', erro: detalhe };
    try { await fecharLinha(id, linha); }
    catch (e) { console.error('reforma-chat: histórico não gravado —', e && e.message); }
    if (erro) { console.error('reforma-chat: pergunta sem resposta —', detalhe); return { ok: false, erro: mensagemDeErro(erro) }; }
    return { ok: true, texto: res.texto, fontes: fs.fontes, cortada: !!res.cortada };
  }

  return async function atender(req) {
    const cors = { 'Access-Control-Allow-Origin': req.headers.get('origin') || '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.method !== 'POST') return json({ erro: 'Use POST.' }, 405);
    if (+(req.headers.get('content-length') || 0) > MAX_CORPO) return json({ erro: 'Pedido grande demais.' }, 413);
    let body;
    try {
      const txt = await req.text();
      if (txt.length > MAX_CORPO) return json({ erro: 'Pedido grande demais.' }, 413);
      body = JSON.parse(txt);
    } catch (e) { return json({ erro: 'Corpo inválido.' }, 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ erro: 'Corpo inválido.' }, 400);
    const t0 = agora().getTime();
    try {
      // avaliação automática: a linha criada pelo banco diz a pergunta (e o caso, quando é sobre um)
      if (body.avaliacao) {
        const linha = await reivindicar(String(body.avaliacao));
        if (!linha) return json({ erro: 'Avaliação inválida ou já usada.' }, 403);
        const res = await executar({ usuario: 'avaliacao', pergunta: linha.pergunta, historico: [], contexto: { caso_id: linha.caso_id || null, tela: null }, conversa: linha.conversa, id: linha.id, t0 });
        return json(res.ok ? { resposta: res.texto, fontes: res.fontes, cortada: res.cortada } : { erro: res.erro }, res.ok ? 200 : 500);
      }
      const u = await usuarioDe(req);
      if (!u) return json({ erro: 'Entre no sistema pra usar o chat.' }, 401);
      const email = String(u.email).toLowerCase();
      if (!email.endsWith(DOMINIO)) return json({ erro: 'O chat é só da equipe do escritório.' }, 403);
      const pergunta = String(body.pergunta || '').trim();
      if (!pergunta) return json({ erro: 'Escreva a pergunta.' }, 400);
      if (pergunta.length > 2000) return json({ erro: 'Pergunta longa demais (até 2.000 caracteres).' }, 400);
      const ctxIn = body.contexto && typeof body.contexto === 'object' ? body.contexto : {};
      const casoId = UUID.test(String(ctxIn.caso_id || '')) ? String(ctxIn.caso_id) : null;
      const contexto = { caso_id: casoId, tela: limparTela(ctxIn.tela, casoId) };
      const conversa = UUID.test(String(body.conversa || '')) ? String(body.conversa) : null;
      // o limite: a pergunta entra no histórico ("rodando") e só então se conta o dia e as que estão rodando
      const nova = await abrirLinha({ usuario: email, conversa, caso_id: casoId, pergunta });
      if (!nova) return json({ erro: 'Não consegui registrar a pergunta. Tente de novo em instantes.' }, 500);
      const id = nova.id;
      const [nDia, nRodando] = await Promise.all([perguntasHoje(email, nova.criado), rodandoAgora(email, nova.criado)]);
      if (nDia > LIMITE_DIA || nRodando > SIMULTANEAS) {
        const doDia = nDia > LIMITE_DIA;
        await fecharLinha(id, { situacao: 'erro', erro: doDia ? 'limite do dia' : 'perguntas demais ao mesmo tempo', duracao_ms: agora().getTime() - t0 }).catch(() => {});
        return json({ erro: doDia ? 'Você chegou ao limite de ' + LIMITE_DIA + ' perguntas por dia. Amanhã libera de novo.' : 'Espere a resposta da pergunta anterior antes de mandar outra.' }, 429);
      }
      const pedido = { usuario: email, pergunta, historico: limparHistorico(body.historico), contexto, conversa, id, t0 };
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
      return json({ erro: 'Erro no chat. Tente de novo em instantes.' }, 500);
    }
  };
}
