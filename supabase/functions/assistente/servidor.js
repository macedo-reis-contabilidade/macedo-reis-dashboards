// ============================================================
// MACEDO & REIS — Assistente do escritório: o servidor (Edge Function assistente)
// O balão que aparece em todas as telas com login (assets/js/assistente-escritorio.js) pergunta aqui. Só a equipe: o
// login do sistema (e-mail @macedoereis.com.br, conferido no Auth). O modelo lê os dados pelas ferramentas
// (ferramentas.js), com o login de quem pergunta — as regras de acesso do banco valem; nada é gravado nos dados: o que
// muda (concluir, marcar pago, criar tarefa, revisar as atrasadas) sai como proposta ("acao", junto com a resposta e no
// histórico, fontes.acao) e quem grava é a tela, depois que a pessoa confirma. Pergunta da Reforma vai pro chat da
// Reforma (função reforma-chat, com o mesmo login: conta no limite e no histórico de lá).
// O histórico é o assistente_chat: a linha da pergunta nasce "rodando" ANTES da conta do limite do dia (pedidos em
// paralelo não furam o limite; no máximo 2 rodando por pessoa) e com o id que a tela mandou — trocou de tela no meio, a
// pergunta segue (EdgeRuntime.waitUntil) e a tela nova pega a resposta pela linha. Erro pro usuário em português, sem
// detalhe interno (o detalhe fica na linha e no log). Avaliação automática: o banco cria a linha (usuario "avaliacao",
// situacao "pendente") e chama a função com o id dela — vale uma vez, por 30 minutos; roda com a chave de servidor, sem o
// financeiro dos sócios.
// Puro: env, fetch, relógio, chamador e o waitUntil injetados — testes em tests/assistente-funcao.test.mjs.
// ============================================================

import { montarSistema, preambulo, marcaOutroDia } from './prompt.js';
import { DEFINICOES, criarFerramentas, descreverEtapa } from './ferramentas.js';
import { criarChamador, responder } from '../reforma-chat/agente.js';
import { lerEventos } from '../../../assets/js/eventos-sse.js';
import { SOCIOS, nomePorEmail } from '../../../assets/js/equipe.js';

export const DOMINIO = '@macedoereis.com.br';
export const LIMITE_DIA = 80;
export const SIMULTANEAS = 2;   // perguntas da mesma pessoa rodando ao mesmo tempo
const MAX_CORPO = 200000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SETORES = ['dp', 'fiscal', 'contabil', 'financeiro', 'comercial', 'societario', 'irpf', 'gestao', 'clientes', 'geral'];

// o dia no fuso de Brasília (UTC−3, sem horário de verão)
export const diaBR = d => new Date(d.getTime() - 3 * 3600e3).toISOString().slice(0, 10);
const inicioDoDiaBR = d => diaBR(d) + 'T03:00:00Z';

export function mensagemDeErro(e) {
  const tipo = e && e.tipo;
  if (tipo === 'sobrecarga') return 'O serviço de IA está sobrecarregado agora. Tente de novo em um minuto.';
  if (tipo === 'tempo') return 'A resposta demorou demais. Tente de novo — se der, com uma pergunta mais específica.';
  return 'Não consegui responder agora. Tente de novo em instantes.';
}

// a hora de cada pergunta anterior (ISO), quando a tela manda: a de outro dia vai marcada pro modelo (marcaOutroDia)
const quandoValido = v => {
  const s = typeof v === 'string' ? v : '', d = new Date(s);
  return s.length <= 40 && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) && !isNaN(d) ? d.toISOString() : null;
};
export function limparHistorico(h) {
  return (Array.isArray(h) ? h : []).slice(-6)
    .map(x => { const em = quandoValido(x && x.em);
      return { pergunta: String((x && x.pergunta) || '').slice(0, 2000), resposta: String((x && x.resposta) || '').slice(0, 6000), ...(em ? { em } : {}) }; })
    .filter(x => x.pergunta.trim() && x.resposta.trim());
}

// a tela de onde veio a pergunta (o que a página manda: caminho, nome, setor)
export function limparPagina(p) {
  if (!p || typeof p !== 'object') return null;
  const caminho = String(p.caminho || '').slice(0, 80);
  if (!/^[a-z0-9][a-z0-9/_.-]*\.html$/i.test(caminho) || caminho.includes('..')) return null;
  const nome = String(p.nome || '').replace(/[\r\n<>[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  return { caminho, nome: nome || null, setor: SETORES.includes(p.setor) ? p.setor : null };
}

// o contexto que a tela manda: a página, a empresa aberta, a ficha da Reforma e o cálculo da ficha (a Reforma confere)
export function limparContexto(c) {
  const x = c && typeof c === 'object' && !Array.isArray(c) ? c : {};
  const uuid = v => (UUID.test(String(v || '')) ? String(v) : null);
  const caso = uuid(x.caso_id);
  let tela = null;
  if (caso && x.tela && typeof x.tela === 'object' && !Array.isArray(x.tela)) { try { if (JSON.stringify(x.tela).length < 60000) tela = x.tela; } catch (e) { tela = null; } }
  return { pagina: limparPagina(x.pagina), cliente_id: uuid(x.cliente_id), caso_id: caso, tela };
}

export function criarServidor({ env, fetch: f = globalThis.fetch, agora = () => new Date(), chamar = null, prazoMs = 70000, aguardar = p => p }) {
  const URLB = env('SUPABASE_URL'), SERVICO = env('SUPABASE_SERVICE_ROLE_KEY'), ANON = env('SUPABASE_ANON_KEY');
  const chamarModelo = chamar || criarChamador({ fetch: f, chave: env('ANTHROPIC_API_KEY') });
  const sistema = montarSistema();

  // o histórico (assistente_chat) e a linha de avaliação da Reforma: com a chave de servidor
  async function rest(caminho, { method = 'GET', body, prefer } = {}) {
    const r = await f(URLB + '/rest/v1/' + caminho, { method,
      headers: { apikey: SERVICO, Authorization: 'Bearer ' + SERVICO, 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) },
      body: body == null ? undefined : JSON.stringify(body) });
    if (!r.ok) { const e = new Error('banco ' + r.status + ': ' + (await r.text().catch(() => '')).slice(0, 200)); e.status = r.status; throw e; }
    return r;
  }

  // os dados que as ferramentas leem: com o login de quem pergunta (as regras de acesso do banco valem); na avaliação,
  // sem login, com a chave de servidor (a lista branca das ferramentas continua valendo)
  function bancoDe(jwt) {
    return { async ler(caminho, { contar = false } = {}) {
      const r = await f(URLB + '/rest/v1/' + caminho, { headers: { apikey: jwt ? ANON : SERVICO, Authorization: 'Bearer ' + (jwt || SERVICO), ...(contar ? { Prefer: 'count=exact' } : {}) } });
      if (!r.ok) throw new Error('o banco recusou a consulta (' + r.status + '): ' + (await r.text().catch(() => '')).slice(0, 300));
      const linhas = await r.json();
      const n = Number(((r.headers && r.headers.get('content-range')) || '').split('/')[1]);
      return { linhas: Array.isArray(linhas) ? linhas : [], total: contar && Number.isFinite(n) ? n : null };
    } };
  }

  async function usuarioDe(req) {
    const h = req.headers.get('Authorization') || '';
    const jwt = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
    if (!jwt) return null;
    const r = await f(URLB + '/auth/v1/user', { headers: { apikey: ANON || SERVICO, Authorization: 'Bearer ' + jwt } });
    if (!r.ok) return null;
    const u = await r.json().catch(() => null);
    return u && u.email ? { email: String(u.email).toLowerCase(), jwt } : null;
  }

  async function contar(caminho) {
    const r = await rest(caminho, { prefer: 'count=exact' });
    const cr = r.headers.get('content-range') || '';
    return +(cr.split('/')[1] || 0) || 0;
  }
  // a conta vai só até a linha que acabou de nascer (criado_em até o dela): em pedidos simultâneos, passa quem chegou
  // primeiro. A que deu erro sem chegar ao modelo (sem tokens) não conta
  const ate = criado => '&criado_em=lte.' + encodeURIComponent(criado);
  const perguntasHoje = (email, criado) => contar('assistente_chat?select=id&limit=1&usuario=eq.' + encodeURIComponent(email) + '&criado_em=gte.' + encodeURIComponent(inicioDoDiaBR(agora()))
    + ate(criado) + '&or=(situacao.neq.erro,tokens_saida.gt.0)');
  const rodandoAgora = (email, criado) => contar('assistente_chat?select=id&limit=1&usuario=eq.' + encodeURIComponent(email) + '&situacao=eq.rodando&criado_em=gte.'
    + encodeURIComponent(new Date(agora().getTime() - 3 * 60e3).toISOString()) + ate(criado));
  async function abrirLinha(linha) {
    const r = await rest('assistente_chat?select=id,criado_em', { method: 'POST', body: { ...linha, situacao: 'rodando' }, prefer: 'return=representation' });
    const j = await r.json().catch(() => null);
    const l = Array.isArray(j) ? j[0] : null;
    return l && UUID.test(String(l.id)) && l.criado_em ? { id: String(l.id), criado: String(l.criado_em) } : null;
  }
  const fecharLinha = (id, campos) => rest('assistente_chat?id=eq.' + id, { method: 'PATCH', body: campos, prefer: 'return=minimal' });
  async function reivindicar(id) {
    if (!UUID.test(id)) return null;
    const desde = new Date(agora().getTime() - 30 * 60e3).toISOString();
    const r = await rest('assistente_chat?id=eq.' + id + '&usuario=eq.avaliacao&situacao=eq.pendente&criado_em=gte.' + encodeURIComponent(desde),
      { method: 'PATCH', body: { situacao: 'rodando' }, prefer: 'return=representation' });
    const linhas = await r.json();
    return linhas[0] || null;
  }

  // a pergunta da Reforma vai pro chat da Reforma, com o login de quem pergunta (as etapas de lá aparecem aqui); na
  // avaliação, como avaliação de lá também (linha "pendente" no rt_chat)
  // o prazo da Reforma é o que resta da pergunta (a função inteira cabe em 150 s)
  async function perguntarReforma({ pergunta, contexto, jwt, conversa, aoEtapa, avaliacao, t0 }) {
    const destino = URLB + '/functions/v1/reforma-chat';
    const prazo = () => AbortSignal.timeout(Math.max(15000, Math.min(130000, t0 + 140000 - agora().getTime())));
    if (avaliacao) {
      const r = await rest('rt_chat?select=id', { method: 'POST', body: { usuario: 'avaliacao', situacao: 'pendente', pergunta, caso_id: contexto.caso_id || null, conversa: conversa || null }, prefer: 'return=representation' });
      const [linha] = await r.json();
      const resp = await f(destino, { method: 'POST', headers: { apikey: ANON, Authorization: 'Bearer ' + ANON, 'Content-Type': 'application/json' },
        body: JSON.stringify({ avaliacao: linha.id }), signal: prazo() });
      const j = await resp.json().catch(() => null);
      if (!resp.ok || !j || !j.resposta) throw new Error((j && j.erro) || 'O assistente da Reforma não respondeu.');
      return { texto: String(j.resposta), cortada: !!j.cortada };
    }
    const resp = await f(destino, { method: 'POST', headers: { apikey: ANON, Authorization: 'Bearer ' + jwt, 'Content-Type': 'application/json' },
      body: JSON.stringify({ pergunta, historico: [], conversa: conversa || null, contexto: { caso_id: contexto.caso_id || null, tela: contexto.tela || null }, fluxo: true }),
      signal: prazo() });
    if (!resp.ok) { const j = await resp.json().catch(() => null); throw new Error((j && j.erro) || 'O assistente da Reforma não respondeu (código ' + resp.status + ').'); }
    let resposta = null, erro = null;
    await lerEventos(resp, ev => {
      if (ev.tipo === 'etapa') { try { aoEtapa(String(ev.texto || '')); } catch (e) { /* a tela fechou */ } }
      else if (ev.tipo === 'resposta') resposta = ev;
      else if (ev.tipo === 'erro') erro = String(ev.texto || '');
    });
    if (erro) throw new Error(erro);
    if (!resposta) throw new Error('O assistente da Reforma não devolveu resposta.');
    return { texto: String(resposta.texto || ''), cortada: !!resposta.cortada };
  }

  async function executar({ usuario, pergunta, historico, contexto, conversa, id, t0, aoEtapa = () => {}, avaliacao = false }) {
    let res = null, erro = null, acao = null;
    const ctx = { ...contexto };
    try {
      const banco = bancoDe(avaliacao ? null : usuario.jwt);
      const hoje = diaBR(agora());
      let empresa = null, ficha = null;
      if (ctx.cliente_id) {
        const { linhas } = await banco.ler('clientes?select=id,nome_principal&id=eq.' + ctx.cliente_id);
        if (linhas[0]) empresa = linhas[0].nome_principal + ' (id ' + linhas[0].id + ')'; else ctx.cliente_id = null;
      }
      if (ctx.caso_id) {
        const { linhas } = await banco.ler('rt_casos?select=id,cliente_id&id=eq.' + ctx.caso_id);
        if (linhas[0]) {
          const { linhas: cl } = linhas[0].cliente_id ? await banco.ler('clientes?select=nome_principal&id=eq.' + linhas[0].cliente_id) : { linhas: [] };
          ficha = (cl[0] ? cl[0].nome_principal : 'caso') + ' (caso ' + linhas[0].id + ')';
        } else { ctx.caso_id = null; ctx.tela = null; }
      }
      const p = ctx.pagina;
      const tela = p ? (p.nome ? p.nome + ' — ' : '') + p.caminho + (p.setor ? ' (setor ' + p.setor + ')' : '') : null;
      const quem = avaliacao ? null : (usuario.nome ? usuario.nome + ' (' + usuario.email + ')' + (usuario.socio ? ', sócio' : '') : usuario.email);
      const ferramentas = criarFerramentas({ banco, contexto: ctx, usuario: { email: usuario.email, nome: usuario.nome, socio: !!usuario.socio }, hoje,
        perguntarReforma: pr => perguntarReforma({ pergunta: pr, contexto: ctx, jwt: usuario.jwt, conversa, aoEtapa, avaliacao, t0 }),
        // passou do tempo de outra rodada do modelo: a resposta da Reforma vai direto pro usuário
        deveFinalizar: () => agora().getTime() - t0 > prazoMs - 15000,
        // a proposta de ação (uma por pergunta) vai junto com a resposta: a tela mostra o cartão
        aoPropor: a => { acao = a; } });
      const mensagem = preambulo({ hoje, quem, tela, empresa, ficha }) + pergunta;
      // a pergunta anterior de outro dia leva a data em que foi feita (a aba pode ter ficado aberta de um dia pro outro)
      const anteriores = historico.map(h => ({ pergunta: marcaOutroDia(h.em, hoje) + h.pergunta, resposta: h.resposta }));
      res = await responder({ chamar: chamarModelo, sistema, definicoes: DEFINICOES, ferramentas, historico: anteriores, mensagem, aoEtapa, prazoMs, descrever: descreverEtapa });
    } catch (e) { erro = e || new Error('erro'); }
    const detalhe = erro ? String((erro && erro.message) || erro).slice(0, 1000) : null;
    const aviso = erro ? mensagemDeErro(erro) : null;
    if (erro) acao = null;
    const linha = { resposta: res ? res.texto : null, aviso, etapas: res ? res.etapas : null, fontes: res ? { reforma: !!res.final, ...(res.cortada ? { cortada: true } : {}), ...(acao ? { acao } : {}) } : null,
      modelo: res ? res.modelo : null, tokens_entrada: res ? res.uso.entrada : null, tokens_saida: res ? res.uso.saida : null, tokens_cache_leitura: res ? res.uso.cacheLeitura : null,
      tokens_cache_escrita: res ? res.uso.cacheEscrita : null, duracao_ms: agora().getTime() - t0, situacao: erro ? 'erro' : 'ok', erro: detalhe };
    try { await fecharLinha(id, linha); }
    catch (e) { console.error('assistente: histórico não gravado —', e && e.message); }
    if (erro) { console.error('assistente: pergunta sem resposta —', detalhe); return { ok: false, erro: aviso }; }
    return { ok: true, texto: res.texto, cortada: !!res.cortada, reforma: !!res.final, acao };
  }
  // a resposta pra tela (com a proposta, quando tem)
  const corpoResposta = res => ({ resposta: res.texto, cortada: res.cortada, reforma: res.reforma, ...(res.acao ? { acao: res.acao } : {}) });

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
      // avaliação automática: a linha criada pelo banco diz a pergunta (e a tela, a empresa ou o caso, quando tem)
      if (body.avaliacao) {
        const linha = await reivindicar(String(body.avaliacao));
        if (!linha) return json({ erro: 'Avaliação inválida ou já usada.' }, 403);
        const contexto = limparContexto({ pagina: linha.pagina ? { caminho: linha.pagina } : null, cliente_id: linha.cliente_id, caso_id: linha.caso_id });
        const res = await executar({ usuario: { email: 'avaliacao', nome: null, socio: false, jwt: null }, pergunta: linha.pergunta, historico: [], contexto,
          conversa: linha.conversa, id: linha.id, t0, avaliacao: true });
        return json(res.ok ? corpoResposta(res) : { erro: res.erro }, res.ok ? 200 : 500);
      }
      const u = await usuarioDe(req);
      if (!u) return json({ erro: 'Entre no sistema pra usar o assistente.' }, 401);
      if (!u.email.endsWith(DOMINIO)) return json({ erro: 'O assistente é só da equipe do escritório.' }, 403);
      const pergunta = String(body.pergunta || '').trim();
      if (!pergunta) return json({ erro: 'Escreva a pergunta.' }, 400);
      if (pergunta.length > 2000) return json({ erro: 'Pergunta longa demais (até 2.000 caracteres).' }, 400);
      const contexto = limparContexto(body.contexto);
      const conversa = UUID.test(String(body.conversa || '')) ? String(body.conversa) : null;
      const pedidoId = UUID.test(String(body.pedido || '')) ? String(body.pedido) : undefined;
      // o limite: a pergunta entra no histórico ("rodando") e só então se conta o dia e as que estão rodando
      let nova;
      try {
        nova = await abrirLinha({ ...(pedidoId ? { id: pedidoId } : {}), usuario: u.email, conversa, pagina: contexto.pagina ? contexto.pagina.caminho : null,
          cliente_id: contexto.cliente_id, caso_id: contexto.caso_id, pergunta });
      } catch (e) {
        if (e && e.status === 409) return json({ erro: 'Essa pergunta já foi enviada.' }, 409);
        throw e;
      }
      if (!nova) return json({ erro: 'Não consegui registrar a pergunta. Tente de novo em instantes.' }, 500);
      const [nDia, nRodando] = await Promise.all([perguntasHoje(u.email, nova.criado), rodandoAgora(u.email, nova.criado)]);
      if (nDia > LIMITE_DIA || nRodando > SIMULTANEAS) {
        const doDia = nDia > LIMITE_DIA;
        const aviso = doDia ? 'Você chegou ao limite de ' + LIMITE_DIA + ' perguntas por dia. Amanhã libera de novo.' : 'Espere a resposta da pergunta anterior antes de mandar outra.';
        await fecharLinha(nova.id, { situacao: 'erro', aviso, erro: doDia ? 'limite do dia' : 'perguntas demais ao mesmo tempo', duracao_ms: agora().getTime() - t0 }).catch(() => {});
        return json({ erro: aviso }, 429);
      }
      const usuario = { email: u.email, nome: nomePorEmail(u.email), socio: SOCIOS.includes(u.email), jwt: u.jwt };
      const pedido = { usuario, pergunta, historico: limparHistorico(body.historico), contexto, conversa, id: nova.id, t0 };
      if (!body.fluxo) {
        const res = await executar(pedido);
        return json(res.ok ? corpoResposta(res) : { erro: res.erro }, res.ok ? 200 : 500);
      }
      // em fluxo: as etapas vão saindo; se a tela fechar (trocou de página), a pergunta segue até o fim e a resposta fica
      // na linha do histórico, que a tela nova lê
      const enc = new TextEncoder();
      const stream = new ReadableStream({
        start(ctrl) {
          let aberto = true;
          const enviar = o => { if (!aberto) return; try { ctrl.enqueue(enc.encode('data: ' + JSON.stringify(o) + '\n\n')); } catch (e) { aberto = false; } };
          const trabalho = executar({ ...pedido, aoEtapa: texto => enviar({ tipo: 'etapa', texto }) }).then(res => {
            enviar(res.ok ? { tipo: 'resposta', texto: res.texto, cortada: res.cortada, reforma: res.reforma, ...(res.acao ? { acao: res.acao } : {}) } : { tipo: 'erro', texto: res.erro });
            if (aberto) { try { ctrl.close(); } catch (e) { /* já fechada */ } }
          });
          try { aguardar(trabalho); } catch (e) { /* fora do Edge Runtime */ }
        },
        cancel() { /* a tela fechou: a pergunta segue e a resposta fica no histórico */ }
      });
      return new Response(stream, { headers: { ...cors, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } });
    } catch (e) {
      console.error('assistente:', e && e.message);
      return json({ erro: 'Erro no assistente. Tente de novo em instantes.' }, 500);
    }
  };
}
