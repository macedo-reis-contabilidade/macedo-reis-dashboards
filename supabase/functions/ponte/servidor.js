// ============================================================
// MACEDO & REIS — Edge Function ponte: a porta de entrada dos pacotes da ponte do PC do escritório (23/10/2026)
// verify_jwt = true (regra 10): a ponte manda a chave anônima no Authorization e a chave da ponte no cabeçalho x-chave.
// A chave da ponte nasce no PC da ponte e nunca sai de lá: o sistema guarda só a impressão digital dela (SHA-256, em
// configuracoes_escritorio.ponte_chave_sha256, que só o servidor lê). Vazia = a ponte ainda não foi instalada: 503.
// Corpo:
//   { versao: 1, ping: true }                                 → 200, sem gravar (o "conferir" da ponte)
//   { versao: 1, tipo: 'receita', pedir: 'empresas' }        → os clientes de hoje da carteira que a ponte consulta
//   { versao: 1, tipo: 'receita', rodada, empresas, faltou } → o pacote da Receita, gravado pelo banco (receita_gravar);
//                                                              do ambiente de demonstração, nada é gravado; o bloco de
//                                                              uma empresa fora do contrato fica de fora sozinho e volta
//                                                              em `recusadas` (a rodada não trava por causa dele)
//   o pacote do Domínio (sem tipo: rodada, empresas, mensal, faltou)
//                                                            → gravado pelo banco (dominio_gravar), já conferido
//                                                              (dominio.js); a linha de um mês fora do contrato fica
//                                                              de fora sozinha e volta em `recusadas` (02/11/2026);
//                                                              versão 1, ou 2 com o faturamento, as compras e a
//                                                              folha em reais (05/11/2026)
//   { versao: 1, tipo: 'notas', pedir: 'autorizadas' }       → as empresas cujo cliente autorizou mandar as notas de
//                                                              entrada (compartilhamentos), pelo código do Domínio
//   { versao: 1, tipo: 'notas', rodada, empresa, notas }     → as notas de uma empresa, conferidas (notas.js) e mandadas
//                                                              ao destino de cada autorização ativa, só as de entrada a
//                                                              partir da data dela; nada das notas fica no sistema, só o
//                                                              registro do envio (compartilhamentos_envios) (03/11/2026)
// Respostas que a ponte entende (ponte/envio.py): 2xx foi · 4xx recusado (não repete) · 5xx tenta de novo.
// Puro: env, banco, relógio e o envio ao destino injetados (index.ts monta). Testes: tests/ponte-funcao.test.mjs.
// ============================================================
import { validarPacote, empresasDaCarteira, hojeEmBrasilia, sha256Hex, iguais, LIMITES } from './receita.js';
import { validarPacoteDominio } from './dominio.js';
import { validarPacoteNotas, empresasAutorizadas, autorizacaoAtiva, corpoDoDestino, destinosDaConfig, respostaDoDestino,
  SEM_DESTINO, SEM_AUTORIZACAO, DESTINO_FORA, LIMITES_NOTAS } from './notas.js';

const CABECALHOS = { 'Content-Type': 'application/json' };
const resposta = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: CABECALHOS });

async function empresasParaConsultar(db, agora) {
  const { data: k, error: e1 } = await db.from('carteira_info').select('cliente_id, entrada, saida').not('entrada', 'is', null);
  if (e1) throw e1;
  const ids = [...new Set((k || []).map(x => x.cliente_id).filter(Boolean))];
  const clientes = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await db.from('clientes').select('id, documento, regime_tributario').in('id', ids.slice(i, i + 100));
    if (error) throw error;
    clientes.push(...(data || []));
  }
  return empresasDaCarteira(k, clientes, hojeEmBrasilia(agora()));
}

async function destinosConfigurados(db) {
  const { data: cfg, error } = await db.from('configuracoes_escritorio').select('valor').eq('chave', 'compartilhamentos_destinos').maybeSingle();
  if (error) throw error;
  return destinosDaConfig(cfg && cfg.valor);
}

async function autorizadasHoje(db, hoje) {
  const { data: comp, error: e1 } = await db.from('compartilhamentos').select('cliente_id, destino, escopo, notas_desde, revogado_em').eq('escopo', 'nfe_entrada');
  if (e1) throw e1;
  const ativas = (comp || []).filter(c => autorizacaoAtiva(c, hoje));
  const ids = [...new Set(ativas.map(c => c.cliente_id).filter(Boolean))];
  if (!ids.length) return [];
  const { data: emp, error: e2 } = await db.from('dominio_empresas').select('codigo, cliente_id').in('cliente_id', ids);
  if (e2) throw e2;
  const { data: cli, error: e3 } = await db.from('clientes').select('id, documento').in('id', ids);
  if (e3) throw e3;
  return empresasAutorizadas(ativas, emp, cli, hoje, await destinosConfigurados(db));
}

// as notas de uma empresa: a autorização conferida de novo aqui (o código do Domínio, o documento do cadastro e a
// autorização ativa hoje), e cada destino recebe só as de entrada a partir da data da autorização dele
async function encaminharNotas(db, v, hoje, agora, enviar) {
  const { empresa, rodada } = v.pacote;
  const { data: emp, error: e1 } = await db.from('dominio_empresas').select('codigo, cliente_id').eq('codigo', empresa.codigo);
  if (e1) throw e1;
  const clienteId = emp && emp[0] && emp[0].cliente_id;
  if (!clienteId) return resposta({ erro: SEM_AUTORIZACAO }, 403);
  const { data: cli, error: e2 } = await db.from('clientes').select('id, documento').eq('id', clienteId);
  if (e2) throw e2;
  const docCadastro = String((cli && cli[0] && cli[0].documento) || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  if (docCadastro !== empresa.documento) return resposta({ erro: SEM_AUTORIZACAO }, 403);
  const { data: comp, error: e3 } = await db.from('compartilhamentos').select('id, destino, escopo, notas_desde, revogado_em').eq('cliente_id', clienteId);
  if (e3) throw e3;
  const ativas = (comp || []).filter(c => autorizacaoAtiva(c, hoje));
  if (!ativas.length) return resposta({ erro: SEM_AUTORIZACAO }, 403);
  const destinos = await destinosConfigurados(db);
  if (ativas.some(c => !destinos[c.destino])) return resposta({ erro: SEM_DESTINO }, 503);

  const recusadas = v.recusadas.slice();
  let falhou = false, mandadas = 0;
  for (const c of ativas) {
    const corpoDest = corpoDoDestino(v.pacote, String(c.notas_desde).slice(0, 10), null);
    if (!corpoDest.notas.length) continue;
    const entradas = corpoDest.notas.map(n => n.entrada).sort();
    const { data: env, error: e5 } = await db.from('compartilhamentos_envios').insert({
      destino: c.destino, compartilhamento_id: c.id, cliente_id: clienteId, tipo: 'notas', rodada_id: rodada.id,
      de: entradas[0], ate: entradas[entradas.length - 1], notas: corpoDest.notas.length,
      itens: corpoDest.notas.reduce((s, n) => s + n.itens.length, 0), com_xml: corpoDest.notas.filter(n => n.origem === 'xml').length,
      situacao: 'enviando'
    }).select('id').single();
    if (e5) throw e5;
    corpoDest.envio = env.id;
    const concluir = async dados => {
      const { error } = await db.from('compartilhamentos_envios').update({ ...dados, concluido_em: new Date(agora()).toISOString() }).eq('id', env.id);
      if (error) console.error('ponte: o registro do envio', error);
    };
    let status = null, corpoResp = null, erro = null;
    try {
      const r = await enviar(destinos[c.destino].url, {
        method: 'POST', redirect: 'manual',
        headers: { 'Content-Type': 'application/json', 'x-chave': destinos[c.destino].chave },
        body: JSON.stringify(corpoDest), signal: AbortSignal.timeout(LIMITES_NOTAS.prazo)
      });
      status = r.status;
      const txt = await r.text();
      try { corpoResp = JSON.parse(txt); } catch { corpoResp = null; }
      if (status < 200 || status >= 300) erro = 'o destino respondeu ' + status + (corpoResp && corpoResp.erro ? ': ' + String(corpoResp.erro).slice(0, 200) : '');
    } catch (e) {
      erro = e && e.name === 'TimeoutError' ? 'o destino não respondeu em ' + (LIMITES_NOTAS.prazo / 1000) + ' s' : 'não consegui falar com o destino';
    }
    if (erro) {
      falhou = true;
      console.error('ponte: notas pro destino', erro);
      await concluir({ situacao: 'erro', http_status: status, erro });
      continue;
    }
    const rd = respostaDoDestino(corpoResp);
    await concluir({ situacao: 'ok', http_status: status, gravadas: rd.gravadas, repetidas: rd.repetidas, recusadas: rd.recusadas, resposta: rd.resposta });
    mandadas += corpoDest.notas.length;
    rd.recusadas.forEach(x => recusadas.push({ chave: x.chave, campo: 'destino', erro: x.motivo || 'recusada pelo destino' }));
  }
  if (falhou) return resposta({ erro: DESTINO_FORA }, 502);
  return resposta({ ok: true, notas: v.pacote.notas.length, mandadas, itens_fora: v.itensFora,
    recusadas: recusadas.slice(0, LIMITES_NOTAS.recusadas), total_recusadas: recusadas.length });
}

// O pacote do Domínio vai pro banco em partes (05/11/2026: o primeiro da versão 2, com os 14 meses de 474 empresas e os
// valores em reais, passou dos 5 MB e voltou 413): a primeira parte leva as empresas (que as linhas de mês precisam), as
// outras só as linhas; a rodada nasce na primeira (o banco não a repete: on conflict do nothing) e, no fim, fica com o
// total de linhas. Uma parte que falha devolve o erro (5xx: a ponte manda de novo, e o banco troca pelos mesmos números).
export const LINHAS_POR_PARTE = 800;
export async function gravarDominio(db, p) {
  const total = { empresas: 0, ligadas: 0, sem_cadastro: 0, linhas: 0 };
  const n = Math.max(1, Math.ceil(p.mensal.length / LINHAS_POR_PARTE));
  for (let i = 0; i < n; i++) {
    const parte = { ...p, empresas: i === 0 ? p.empresas : [], mensal: p.mensal.slice(i * LINHAS_POR_PARTE, (i + 1) * LINHAS_POR_PARTE) };
    const { data, error } = await db.rpc('dominio_gravar', { p: parte });
    if (error) throw error;
    const d = data || {};
    if (i === 0) Object.assign(total, { empresas: d.empresas || 0, ligadas: d.ligadas || 0, sem_cadastro: d.sem_cadastro || 0 });
    total.linhas += d.linhas || 0;
  }
  if (n > 1) {
    const { error } = await db.from('dominio_rodadas').update({ linhas: total.linhas }).eq('id', p.rodada.id);
    if (error) console.error('ponte: o total de linhas da rodada', error);
  }
  return { ...total, partes: n };
}

export function criarServidor({ criarDb, agora = () => Date.now(), enviar = (url, init) => fetch(url, init) }) {
  return async function atender(req) {
    if (req.method !== 'POST') return resposta({ erro: 'Use POST.' }, 405);
    const bruto = await req.text();
    if (bruto.length > LIMITES.corpo) return resposta({ erro: 'Pacote grande demais.' }, 413);
    const db = criarDb();
    // a chave da ponte: só a impressão digital fica no sistema
    const { data: cfg, error: eCfg } = await db.from('configuracoes_escritorio').select('valor').eq('chave', 'ponte_chave_sha256').maybeSingle();
    if (eCfg) { console.error('ponte: configuração', eCfg); return resposta({ erro: 'Não consegui ler a configuração agora. Tente de novo.' }, 500); }
    const esperada = String((cfg && cfg.valor) || '').trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(esperada)) return resposta({ erro: 'A chave da ponte ainda não foi cadastrada no sistema.' }, 503);
    const chave = req.headers.get('x-chave') || '';
    if (!chave || !iguais(await sha256Hex(chave), esperada)) return resposta({ erro: 'Chave da ponte recusada.' }, 401);

    let corpo;
    try { corpo = JSON.parse(bruto); } catch { return resposta({ erro: 'O corpo não é um JSON.' }, 400); }
    if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) return resposta({ erro: 'O corpo não é um objeto.' }, 400);
    // a versão 2 é só do pacote do Domínio (05/11/2026: o faturamento, as compras e a folha em reais); o resto lê a 1
    const doDominio = corpo.tipo == null && Array.isArray(corpo.mensal);
    if (corpo.versao !== 1 && !(doDominio && corpo.versao === 2)) return resposta({ erro: 'Versão do pacote desconhecida (esta função lê a 1; o pacote do Domínio, também a 2).' }, 422);
    try {
      if (corpo.ping === true) return resposta({ ok: true, ponte: 'ok' });
      if (corpo.tipo === 'receita' && corpo.pedir === 'empresas') {
        return resposta({ empresas: await empresasParaConsultar(db, agora) });
      }
      if (corpo.tipo === 'receita') {
        const v = validarPacote(corpo);
        if (!v.ok) return resposta({ erro: 'Pacote da Receita recusado: ' + v.erro + ' (' + v.campo + ').' }, 422);
        // o que ficou de fora (um bloco de uma empresa fora do contrato) volta pra ponte anotar no log; o resto segue
        if (v.pacote.rodada.ambiente !== 'producao') {
          return resposta({ ok: true, gravado: false, motivo: 'Pacote do ambiente de demonstração: nada foi gravado.', recusadas: v.recusadas });
        }
        const { data, error } = await db.rpc('receita_gravar', { p: v.pacote });
        if (error) throw error;
        return resposta({ ok: true, gravado: true, ...(data || {}), recusadas: v.recusadas });
      }
      if (doDominio) {
        const v = validarPacoteDominio(corpo);
        if (!v.ok) return resposta({ erro: 'Pacote do Domínio recusado: ' + v.erro + ' (' + v.campo + ').' }, 422);
        const data = await gravarDominio(db, v.pacote);
        return resposta({ ok: true, gravado: true, ...data, recusadas: v.recusadas, linhas_recusadas: v.linhas_recusadas });
      }
      if (corpo.tipo === 'notas' && corpo.pedir === 'autorizadas') {
        return resposta({ empresas: await autorizadasHoje(db, hojeEmBrasilia(agora())) });
      }
      if (corpo.tipo === 'notas') {
        const v = validarPacoteNotas(corpo);
        if (!v.ok) return resposta({ erro: 'Pacote de notas recusado: ' + v.erro + ' (' + v.campo + ').' }, 422);
        return await encaminharNotas(db, v, hojeEmBrasilia(agora()), agora, enviar);
      }
      return resposta({ erro: 'Nada pra fazer com este pacote.' }, 422);
    } catch (e) {
      console.error('ponte:', e);
      return resposta({ erro: 'Não gravei agora. A ponte tenta de novo.' }, 500);
    }
  };
}
