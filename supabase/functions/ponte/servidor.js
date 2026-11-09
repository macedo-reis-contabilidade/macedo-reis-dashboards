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
//   { versao: 1, tipo: 'receita', relatorio: 'situacao_fiscal', documento, emitido_em, ambiente, pdf }
//                                                            → o PDF do relatório de situação fiscal de uma empresa, na
//                                                              pasta dela no Drive (FISCAL › SITUAÇÃO FISCAL), e o link
//                                                              em receita_empresas, que a ficha mostra (09/11/2026,
//                                                              relatorio.js e drive.js); com teste: true, só diz o que
//                                                              faria, sem criar nem gravar nada
//   o pacote do Domínio (sem tipo: rodada, empresas, mensal, faltou)
//                                                            → gravado pelo banco (dominio_gravar), já conferido
//                                                              (dominio.js); a linha de um mês fora do contrato fica
//                                                              de fora sozinha e volta em `recusadas` (02/11/2026);
//                                                              versão 1, ou 2 com o faturamento, as compras e a
//                                                              folha em reais (05/11/2026), ou 3 com o andamento das
//                                                              contabilidades (também 05/11/2026: os lançamentos por
//                                                              origem, os cruzamentos, os saldos, a foto do dia e o
//                                                              encerramento)
//   { versao: 1, tipo: 'notas', pedir: 'autorizadas' }       → as empresas cujo cliente autorizou mandar as notas de
//                                                              entrada (compartilhamentos), pelo código do Domínio
//   { versao: 1, tipo: 'notas', rodada, empresa, notas }     → as notas de uma empresa, conferidas (notas.js) e mandadas
//                                                              ao destino de cada autorização ativa, só as de entrada a
//                                                              partir da data dela; nada das notas fica no sistema, só o
//                                                              registro do envio (compartilhamentos_envios) (03/11/2026)
// Respostas que a ponte entende (ponte/envio.py): 2xx foi · 4xx recusado (não repete) · 5xx tenta de novo.
// Puro: env, banco, relógio, o envio ao destino e o Google injetados (index.ts monta). Testes: tests/ponte-funcao.test.mjs.
// ============================================================
import { validarPacote, empresasDaCarteira, hojeEmBrasilia, sha256Hex, iguais, LIMITES } from './receita.js';
import { validarPacoteDominio } from './dominio.js';
import { validarPacoteNotas, empresasAutorizadas, autorizacaoAtiva, corpoDoDestino, destinosDaConfig, respostaDoDestino,
  SEM_DESTINO, SEM_AUTORIZACAO, DESTINO_FORA, LIMITES_NOTAS } from './notas.js';
import { validarRelatorio, nomeDoRelatorio, pastaFiscal, pastaSituacao, idDaPasta, linkDoArquivo, PASTA_FISCAL, PASTA_SITUACAO,
  SEM_PASTA, SEM_CADASTRO, SEM_DRIVE, DRIVE_FORA } from './relatorio.js';
import { criarDrive, ErroDrive } from './drive.js';

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

// O relatório de situação fiscal de uma empresa (09/11/2026): a empresa é a que o receita_gravar liga pelo documento (a
// de menor id), a pasta é a que o cadastro dela aponta, e dentro dela, FISCAL › SITUAÇÃO FISCAL (as duas criadas se
// faltarem). O mesmo arquivo (o nome leva o dia) não sobe duas vezes: a ponte que manda de novo depois de uma falha no
// banco acha o que já subiu. A ficha fica com o relatório mais novo. Sem a pasta no cadastro, ou com a pasta que não
// abre, nada é feito (200, gravado: false: a ponte manda de novo na rodada seguinte). Com teste: true, só lê: diz o que
// acharia e o que criaria, sem criar pasta, subir arquivo nem gravar no banco.
async function guardarRelatorio(db, drive, r, agora) {
  if (r.ambiente !== 'producao') return resposta({ ok: true, gravado: false, motivo: 'Relatório do ambiente de demonstração: nada foi gravado.' });
  const { data: cli, error: e1 } = await db.from('clientes').select('id, drive_folder_id, drive_folder_url').ilike('documento', r.documento).order('id').limit(1);
  if (e1) throw e1;
  const c = cli && cli[0];
  if (!c) return resposta({ erro: SEM_CADASTRO }, 422);
  if (!drive.configurado()) return resposta({ erro: SEM_DRIVE }, 503);
  const nome = nomeDoRelatorio(r.emitido_em);
  try {
    const raiz = idDaPasta(c);
    if (!raiz || !(await drive.pastaAbre(raiz))) return resposta({ ok: true, gravado: false, motivo: SEM_PASTA, ...(r.teste ? { teste: true } : {}) });
    const fiscal = pastaFiscal(await drive.filhas(raiz));
    const situacao = fiscal ? pastaSituacao(await drive.filhas(fiscal.id)) : null;
    const ja = situacao ? (await drive.arquivos(situacao.id)).find(a => a.name === nome) : null;
    if (r.teste) {
      return resposta({ ok: true, teste: true, gravado: false, pasta: true, fiscal: fiscal ? fiscal.name : null, situacao: situacao ? situacao.name : null,
        arquivo: ja ? 'já está no Drive' : 'subiria', nome, cria: [!fiscal && PASTA_FISCAL, !situacao && PASTA_SITUACAO].filter(Boolean) });
    }
    const idFiscal = fiscal ? fiscal.id : await drive.criarPasta(PASTA_FISCAL, raiz);
    const idSituacao = situacao ? situacao.id : await drive.criarPasta(PASTA_SITUACAO, idFiscal);
    const idArquivo = ja ? ja.id : await drive.subir(idSituacao, nome, r.bytes);
    const link = linkDoArquivo(idArquivo);
    // a ficha fica com o mais novo: o relatório de um dia antes do que ela já mostra só vai pro Drive
    const { data: atual, error: e2 } = await db.from('receita_empresas').select('situacao_fiscal_pdf_em').eq('cliente_id', c.id).maybeSingle();
    if (e2) throw e2;
    const naFicha = !(atual && atual.situacao_fiscal_pdf_em && String(atual.situacao_fiscal_pdf_em).slice(0, 10) > r.emitido_em);
    if (naFicha) {
      const { error: e3 } = await db.from('receita_empresas').upsert({ cliente_id: c.id, situacao_fiscal_pdf_em: r.emitido_em,
        situacao_fiscal_pdf_id: idArquivo, situacao_fiscal_pdf_url: link, atualizado_em: new Date(agora()).toISOString() }, { onConflict: 'cliente_id' });
      if (e3) throw e3;
    }
    return resposta({ ok: true, gravado: true, link, novo: !ja, ficha: naFicha });
  } catch (e) {
    if (!(e instanceof ErroDrive)) throw e;
    console.error('ponte: o Drive do relatório', e.message);
    return resposta({ erro: DRIVE_FORA }, 502);
  }
}

// O pacote do Domínio vai pro banco em partes (05/11/2026: o primeiro da versão 2, com os 14 meses de 474 empresas e os
// valores em reais, passou dos 5 MB e voltou 413): a primeira parte leva as empresas (que as linhas de mês precisam), as
// outras só as linhas; a rodada nasce na primeira (o banco não a repete: on conflict do nothing) e, no fim, fica com o
// total de linhas. Uma parte que falha devolve o erro (5xx: a ponte manda de novo, e o banco troca pelos mesmos números).
// A foto do dia e o encerramento (a versão 3) vão só na primeira parte; nas outras, as listas vazias e as marcas deles
// falsas — o banco apaga da foto a empresa que não veio, e uma parte sem a foto não pode parecer uma foto vazia.
// A jornada (a versão 4, 09/11/2026) não vai nas partes: depois delas (as empresas já gravadas, que a ligam ao cadastro
// pelo código), a foto inteira vai pra dominio_gravar_jornadas — só com a lista lida inteira e com algum grupo. Um erro
// nela não derruba a rodada: os números do mês já foram, e a foto da jornada é do dia (a de amanhã vem de novo).
export const LINHAS_POR_PARTE = 800;
export async function gravarDominio(db, p) {
  const { jornadas = [], ...resto } = p;
  const total = { empresas: 0, ligadas: 0, sem_cadastro: 0, linhas: 0, andamento: 0, encerramento: 0, jornadas: 0 };
  const n = Math.max(1, Math.ceil(p.mensal.length / LINHAS_POR_PARTE));
  for (let i = 0; i < n; i++) {
    const primeira = i === 0;
    const parte = {
      ...resto,
      empresas: primeira ? p.empresas : [],
      andamento: primeira ? (p.andamento || []) : [],
      encerramento: primeira ? (p.encerramento || []) : [],
      blocos_ok: primeira ? p.blocos_ok : { ...p.blocos_ok, andamento: false, encerramento: false },
      mensal: p.mensal.slice(i * LINHAS_POR_PARTE, (i + 1) * LINHAS_POR_PARTE)
    };
    const { data, error } = await db.rpc('dominio_gravar', { p: parte });
    if (error) throw error;
    const d = data || {};
    if (primeira) Object.assign(total, { empresas: d.empresas || 0, ligadas: d.ligadas || 0, sem_cadastro: d.sem_cadastro || 0, andamento: d.andamento || 0, encerramento: d.encerramento || 0 });
    total.linhas += d.linhas || 0;
  }
  if (n > 1) {
    const { error } = await db.from('dominio_rodadas').update({ linhas: total.linhas }).eq('id', p.rodada.id);
    if (error) console.error('ponte: o total de linhas da rodada', error);
  }
  if (p.blocos_ok && p.blocos_ok.jornadas === true && jornadas.length) {
    const { data, error } = await db.rpc('dominio_gravar_jornadas', { p: { rodada: p.rodada, jornadas } });
    if (error) { console.error('ponte: a jornada', error); total.jornadas_erro = 'Não gravei a jornada agora; fica a da rodada anterior.'; }
    else total.jornadas = (data && Number.isInteger(data.jornadas)) ? data.jornadas : jornadas.length;
  }
  return { ...total, partes: n };
}

export function criarServidor({ criarDb, agora = () => Date.now(), enviar = (url, init) => fetch(url, init), env = () => null,
  google = (url, init) => fetch(url, init), esperar }) {
  const drive = criarDrive({ fetch: google, env, agora, esperar });
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
    // as versões 2 a 4 são só do pacote do Domínio (05/11/2026: o faturamento, as compras e a folha em reais; o
    // andamento das contabilidades; 09/11/2026: a jornada dos funcionários); o resto lê a 1
    const doDominio = corpo.tipo == null && Array.isArray(corpo.mensal);
    if (corpo.versao !== 1 && !(doDominio && [2, 3, 4].includes(corpo.versao))) return resposta({ erro: 'Versão do pacote desconhecida (esta função lê a 1; o pacote do Domínio, da 1 à 4).' }, 422);
    try {
      if (corpo.ping === true) return resposta({ ok: true, ponte: 'ok' });
      if (corpo.tipo === 'receita' && corpo.pedir === 'empresas') {
        return resposta({ empresas: await empresasParaConsultar(db, agora) });
      }
      if (corpo.tipo === 'receita' && corpo.relatorio != null) {
        const v = validarRelatorio(corpo, hojeEmBrasilia(agora()));
        if (!v.ok) return resposta({ erro: 'Relatório recusado: ' + v.erro + ' (' + v.campo + ').' }, 422);
        return await guardarRelatorio(db, drive, v.relatorio, agora);
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
