// ============================================================
// MACEDO & REIS — Edge Function ca-vendas: lança vendas no Conta Azul. A primeira é o honorário adicional anual
// (31/10/2026, pedido do Samuel: "automatizar a criação dessas vendas no conta azul … não tem muito como errar").
// Quem chama: a janela "Honorário adicional anual" da tela Boletos (assets/js/adicional-anual-tela.js), só os sócios — o
// login do escritório conferido no Auth (/auth/v1/user) e o e-mail na lista dos sócios (SOCIOS, assets/js/equipe.js). A
// consulta (prever) também aceita a chave do sincronismo (o cabeçalho x-sync-key, a do ca-sync, que só o servidor lê): é a
// que o arquiteto usa pra conferir a lista no banco. Lançar, pôr no boleto e desfazer: só os sócios, com o login deles.
// Modos (corpo JSON):
//  { modo: 'prever', competencia }  → a lista empresa por empresa (montarLista, assets/js/adicional-anual.js): a
//     mensalidade da competência (o espelho ca_parcelas), o histórico de três anos (a API do Conta Azul: o adicional e a
//     mensalidade de outubro de cada ano), a empresa do cadastro (pelo CNPJ ou CPF da pessoa no Conta Azul), o boleto da
//     competência, as já lançadas e a venda modelo (a do adicional mais recente, que dá o serviço, a conta e o vendedor)
//  { modo: 'lancar', competencia, modelo, itens, boleto } → cria as vendas (até 20 por chamada), uma a uma: a linha de
//     ca_vendas_lancadas nasce "lancando" ANTES (o índice único barra o lançamento em dobro, inclusive de duas abas), o
//     próximo número, o POST /v1/venda e a linha "lancada", com o id e o número — ou "erro", com o motivo; com o boleto
//     (o padrão), o adicional entra como item extra no boleto da competência, se ele está a emitir
//  { modo: 'boleto', competencia }  → põe no boleto as lançadas que ainda não estão (o mês gerado depois do lançamento)
//  { modo: 'desfazer', ids }        → a exclusão em lote no Conta Azul, conferida venda por venda, e o extra sai do
//     boleto; a que o Conta Azul não excluiu (com nota emitida ou recebida) fica, com o motivo
// A venda que o sistema lançou e alguém excluiu direto no Conta Azul é achada no prever (conferirExcluidas): a linha vira
// "excluida", o extra sai do boleto e a empresa pode ser lançada de novo.
// O token do Conta Azul é o que o ca-sync mantém e renova. Perto de vencer, esta função não renova (nunca disputa a
// renovação com ele): chama o ca-sync, que renova no começo da rodada, e responde 503 "renovando" — a tela tenta de novo.
// Puro: env, fetch, relógio, espera e o waitUntil injetados — testes em tests/ca-vendas.test.mjs.
// ============================================================

import { SOCIOS } from '../../../assets/js/equipe.js';
import { nomeBase, nomesBatem } from '../../../assets/js/precificacao-carteira.js';
import {
  COMPETENCIA, TIPO, CATEGORIA, CATEGORIA_MENSAL, CATEGORIA_MEI, ANOS_HISTORICO, MAX_POR_LOTE, ehUuid, ultimoDia, mesBR,
  parcelaNormal, montarLista, modeloDaVenda, vendaParaApi, limparItem, extraDoAdicional, comExtra, semExtra, temExtra
} from '../../../assets/js/adicional-anual.js';

export const API = 'https://api-v2.contaazul.com';
export const DOMINIO = '@macedoereis.com.br';
export const MARGEM_TOKEN_MS = 3 * 60 * 1000;
export const PAGINA = 500;
const LANCANDO_PARADA_MS = 3 * 60 * 1000;   // a linha "lancando" mais velha que isto é conferida no Conta Azul
const LANCANDO_ERRO_MS = 15 * 60 * 1000;    // … e, sem venda no Conta Azul, vira erro (pode lançar de novo)

export const diaBR = d => new Date(d.getTime() - 3 * 3600e3).toISOString().slice(0, 10);
const digitos = s => String(s || '').replace(/\D/g, '');
const dataBR = iso => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '');
const STATUS_BOLETO = { a_emitir: 'a emitir', emitido: 'emitido', enviado: 'enviado', pago: 'pago', cancelado: 'cancelado' };

export class ErroPublico extends Error {
  constructor(mensagem, status = 400, extra = {}) { super(mensagem); this.status = status; this.extra = extra; }
}

// a mensagem que o Conta Azul devolveu, curta (o que a pessoa vê)
export function motivoDoContaAzul(e) {
  const d = e && e.dados;
  const t = d && (d.error || d.message || d.mensagem || (Array.isArray(d.errors) && d.errors.map(x => x && (x.message || x.mensagem)).filter(Boolean).join('; ')));
  return t ? String(t).slice(0, 200) : (e && e.status ? 'código ' + e.status : 'sem resposta');
}

export function criarServidor({ env, fetch: f = globalThis.fetch, agora = () => new Date(), aguardar = p => p, esperar = ms => new Promise(r => setTimeout(r, ms)) }) {
  const URLB = env('SUPABASE_URL'), SERVICO = env('SUPABASE_SERVICE_ROLE_KEY'), ANON = env('SUPABASE_ANON_KEY');
  const enc = encodeURIComponent;
  const agoraIso = () => agora().toISOString();

  const cors = origin => ({
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sync-key',
    'Content-Type': 'application/json'
  });

  // ---------- o banco, com a chave de servidor ----------
  async function db(caminho, { method = 'GET', body, prefer } = {}) {
    const r = await f(URLB + '/rest/v1/' + caminho, {
      method,
      headers: { apikey: SERVICO, Authorization: 'Bearer ' + SERVICO, 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    });
    const txt = await r.text();
    let dados = null;
    try { dados = txt ? JSON.parse(txt) : null; } catch (e) { dados = null; }
    if (!r.ok) { const e = new Error('banco ' + r.status + ': ' + txt.slice(0, 200)); e.status = r.status; e.codigo = dados && dados.code; throw e; }
    return dados;
  }
  // todas as linhas: o banco devolve no máximo mil por consulta (o limite do Supabase), mesmo pedindo mais — com 1.036
  // empresas no cadastro, as de depois das mil ficavam sem empresa (31/10/2026). Vai em páginas de mil, pela ordem do id.
  const POR_PAGINA = 1000;
  async function dbTodas(caminho) {
    const out = [];
    for (let de = 0; de < 200 * POR_PAGINA; de += POR_PAGINA) {
      const lote = (await db(caminho + '&order=id.asc&limit=' + POR_PAGINA + '&offset=' + de)) || [];
      out.push(...lote);
      if (lote.length < POR_PAGINA) break;
    }
    return out;
  }

  // ---------- quem chama: o login do escritório (os sócios), ou a chave do sincronismo só pra consulta ----------
  async function quemChama(req) {
    const m = /^Bearer\s+(\S+)/i.exec(req.headers.get('authorization') || '');
    const jwt = m ? m[1] : '';
    if (!jwt) return null;
    if (SERVICO && jwt === SERVICO) return 'servidor';
    try {
      const r = await f(URLB + '/auth/v1/user', { headers: { apikey: ANON || SERVICO, Authorization: 'Bearer ' + jwt } });
      if (!r.ok) return null;
      const u = await r.json().catch(() => null);
      const email = String((u && u.email) || '').toLowerCase();
      return email.endsWith(DOMINIO) ? email : null;
    } catch (e) {
      return null;
    }
  }
  async function chaveDoSync() {
    const d = await db('configuracoes_escritorio?select=valor&chave=eq.ca_sync_key');
    const v = d && d[0] ? d[0].valor : null;
    return typeof v === 'string' ? v : '';
  }

  // ---------- o Conta Azul ----------
  async function tokenCA() {
    const d = await db('ca_tokens?select=access_token,expires_at&id=eq.1');
    const t = d && d[0];
    if (!t || !t.access_token) throw new ErroPublico('A conexão com o Conta Azul não está feita: refaça a autorização.', 500);
    if (new Date(t.expires_at).getTime() - agora().getTime() < MARGEM_TOKEN_MS) {
      aguardar(cutucarSync().catch(() => {}));
      throw new ErroPublico('A conexão com o Conta Azul está sendo renovada. Tento de novo em instantes.', 503, { renovando: true });
    }
    return t.access_token;
  }
  // o ca-sync renova o token no começo da rodada (a trava dele não deixa duas rodadas juntas)
  async function cutucarSync() {
    const chave = await chaveDoSync();
    if (!chave) return;
    await f(URLB + '/functions/v1/ca-sync', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-sync-key': chave }, body: '{}' });
  }
  async function ca(token, caminho, { method = 'GET', params = null, body } = {}) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    for (let t = 0; t < 5; t++) {
      const r = await f(API + caminho + qs, {
        method,
        headers: { Authorization: 'Bearer ' + token, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {})
      });
      if (r.status === 429) { await esperar(1500 * (t + 1)); continue; }
      const txt = await r.text();
      let dados = null;
      try { dados = txt ? JSON.parse(txt) : null; } catch (e) { dados = null; }
      if (!r.ok) { const e = new Error(caminho + ' respondeu ' + r.status + ': ' + txt.slice(0, 300)); e.status = r.status; e.dados = dados; throw e; }
      return dados;
    }
    const e = new Error(caminho + ': o Conta Azul limitou as chamadas'); e.status = 429; throw e;
  }
  const itensDe = resp => {
    if (Array.isArray(resp)) return resp;
    for (const k of ['itens', 'items', 'data', 'content']) if (resp && Array.isArray(resp[k])) return resp[k];
    return [];
  };
  async function todas(token, caminho, params) {
    const out = [];
    for (let pagina = 1; pagina <= 40; pagina++) {
      const resp = await ca(token, caminho, { params: { ...params, pagina: String(pagina), tamanho_pagina: String(PAGINA) } });
      const lote = itensDe(resp);
      out.push(...lote);
      const total = resp && !Array.isArray(resp) ? (resp.itens_totais ?? resp.totalItems ?? resp.total_itens ?? null) : null;
      if (lote.length < PAGINA || (total !== null && out.length >= Number(total))) break;
    }
    return out;
  }
  const RECEBER = '/v1/financeiro/eventos-financeiros/contas-a-receber/buscar';

  // as categorias de receita pelo nome (o espelho ca_categorias)
  async function categorias() {
    const nomes = [CATEGORIA, CATEGORIA_MENSAL, CATEGORIA_MEI];
    const d = await db('ca_categorias?select=id,nome&tipo=eq.RECEITA&nome=in.(' + nomes.map(n => enc('"' + n + '"')).join(',') + ')');
    const por = new Map((d || []).map(c => [String(c.nome).trim().toUpperCase(), c.id]));
    const cats = { adicional: por.get(CATEGORIA) || null, mensal: por.get(CATEGORIA_MENSAL) || null, mei: por.get(CATEGORIA_MEI) || null };
    if (!cats.adicional || !cats.mensal) throw new ErroPublico('Não achei no Conta Azul as categorias ' + CATEGORIA + ' e ' + CATEGORIA_MENSAL + '.', 500);
    return cats;
  }

  // a venda pelo número (a busca do Conta Azul) → o detalhe e os itens → a modelo; só serve a da categoria do adicional
  async function modeloPeloNumero(token, numero, cats) {
    if (!Number.isInteger(numero) || numero <= 0) throw new ErroPublico('Falta a venda modelo: abra a lista de novo.');
    const achadas = itensDe(await ca(token, '/v1/venda/busca', { params: { termo_busca: String(numero) } }));
    const v = achadas.find(x => x && Number(x.numero) === numero);
    if (!v || !ehUuid(v.id)) throw new ErroPublico('Não achei no Conta Azul a venda ' + numero + ', que serve de modelo.', 500);
    const detalhe = await ca(token, '/v1/venda/' + v.id);
    const itens = await ca(token, '/v1/venda/' + v.id + '/itens');
    const modelo = modeloDaVenda(detalhe, itens);
    if (!modelo || modelo.id_categoria !== cats.adicional) throw new ErroPublico('A venda ' + numero + ' não serve de modelo: precisa ser do ' + CATEGORIA + ', com um serviço só.', 500);
    return modelo;
  }

  // a pessoa do Conta Azul → a empresa do cadastro: pelo CNPJ ou CPF (a ativa, quando há mais de uma); sem documento
  // que bata, pelo nome (a regra do vigia e da Carteira, nomeBase/nomesBatem) — só quando uma empresa ativa bate, e só
  // ela: com duas parecidas (as unidades de uma rede), fica sem
  async function empresasDasPessoas(token) {
    const pessoas = await todas(token, '/v1/pessoas', { tipo_perfil: 'Cliente' });
    const cad = await dbTodas('clientes?select=id,nome_principal,nome_fantasia,documento,status');
    const porDoc = new Map();
    for (const c of cad) {
      const d = digitos(c.documento);
      if (d.length !== 11 && d.length !== 14) continue;
      const a = porDoc.get(d);
      if (!a || (a.status !== 'ativo' && c.status === 'ativo')) porDoc.set(d, c);
    }
    const ativos = cad.filter(c => c.status === 'ativo').map(c => ({ c, nomes: [c.nome_principal, c.nome_fantasia].map(nomeBase).filter(Boolean) }));
    const mapa = new Map();
    for (const p of pessoas) {
      if (!p || !ehUuid(p.id)) continue;
      let c = porDoc.get(digitos(p.documento));
      if (!c) {
        const n = nomeBase(p.nome);
        const batem = n ? ativos.filter(a => a.nomes.some(x => nomesBatem(x, n))) : [];
        if (batem.length === 1) c = batem[0].c;
      }
      if (c) mapa.set(p.id, { id: c.id, nome: c.nome_principal });
    }
    return mapa;
  }

  // as contas financeiras: os nomes (o espelho das baixas), a do Inter, e a da venda do adicional mais recente de cada
  // empresa no ano anterior (o detalhe de cada venda, 4 de cada vez)
  async function contasDoAdicional(token, ano, cats) {
    const linhas = await dbTodas('ca_baixas?select=conta_financeira_id,conta_financeira&conta_financeira_id=not.is.null&data_pagamento=gte.' + (ano - 2) + '-01-01');
    const nomes = new Map();
    for (const l of linhas) if (ehUuid(l.conta_financeira_id) && l.conta_financeira && !nomes.has(l.conta_financeira_id)) nomes.set(l.conta_financeira_id, String(l.conta_financeira));
    const inter = [...nomes.entries()].filter(([, n]) => /\bINTER\b/i.test(n)).map(([id]) => id);
    const vendas = await todas(token, '/v1/venda/busca', { data_inicio: (ano - 1) + '-01-01', data_fim: (ano - 1) + '-12-31', ids_categorias: cats.adicional });
    const maisRecente = new Map();
    vendas.filter(v => v && ehUuid(v.id) && v.cliente && ehUuid(v.cliente.id))
      .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')) || Number(b.numero) - Number(a.numero))
      .forEach(v => { if (!maisRecente.has(v.cliente.id)) maisRecente.set(v.cliente.id, v); });
    const alvo = [...maisRecente.values()].slice(0, 200);
    const anterior = new Map();
    for (let i = 0; i < alvo.length; i += 4) {
      const lote = alvo.slice(i, i + 4);
      const res = await Promise.allSettled(lote.map(v => ca(token, '/v1/venda/' + v.id)));
      res.forEach((r, j) => {
        const c = r.status === 'fulfilled' && r.value && r.value.venda && r.value.venda.condicao_pagamento ? r.value.venda.condicao_pagamento.id_conta_financeira : null;
        if (ehUuid(c)) anterior.set(lote[j].cliente.id, c);
      });
    }
    return { nomes, inter: inter.length === 1 ? inter[0] : null, anterior };
  }

  async function boletosDaCompetencia(comp) {
    const d = await dbTodas('cobrancas_mensais?select=id,cliente_id,vencimento,status,itens_extras&competencia=eq.' + comp);
    return new Map((d || []).map(b => [b.cliente_id, b]));
  }

  // ---------- prever: a lista ----------
  async function prever(comp) {
    const hoje = diaBR(agora());
    const ano = Number(comp.slice(0, 4));
    const token = await tokenCA();
    const cats = await categorias();
    // o adicional: o histórico e o que já existe na competência (a API, ao vivo: o espelho tem só desde 2025)
    const adicionais = (await todas(token, RECEBER, { ids_categorias: cats.adicional, data_vencimento_de: (ano - ANOS_HISTORICO) + '-01-01', data_vencimento_ate: (ano + 2) + '-12-31' })).map(parcelaNormal);
    // a mensalidade de outubro de cada ano do histórico (a API)
    const idsMensal = [cats.mensal, cats.mei].filter(Boolean).join(',');
    const mensais = [];
    for (let y = ano - ANOS_HISTORICO; y < ano; y++) {
      const mes = y + '-' + comp.slice(5, 7);
      const fim = new Date(Date.UTC(y, Number(comp.slice(5, 7)) + 2, 0)).toISOString().slice(0, 10);
      const lote = (await todas(token, RECEBER, { ids_categorias: idsMensal, data_vencimento_de: mes + '-01', data_vencimento_ate: fim })).map(parcelaNormal);
      mensais.push(...lote.filter(p => p.competencia === mes));
    }
    // a mensalidade do ano, desde dezembro do anterior (os meses de quem entrou), e a da competência: o espelho
    const de = (ano - 1) + '-12-01', ate = ultimoDia(comp);
    for (const nome of [CATEGORIA_MENSAL, CATEGORIA_MEI]) {
      const filtro = 'categorias=cs.' + enc(JSON.stringify([{ nome }]));
      const d = await dbTodas('ca_parcelas?select=fornecedor_cliente_id,fornecedor_cliente_nome,data_competencia,data_vencimento,total,descricao,categorias&natureza=eq.receita&data_competencia=gte.' + de + '&data_competencia=lte.' + ate + '&' + filtro);
      mensais.push(...(d || []).map(parcelaNormal));
    }
    const lancadas = await db('ca_vendas_lancadas?select=*&tipo=eq.' + TIPO + '&competencia=eq.' + comp + '&order=lancada_em.asc');
    await conferirParadas(token, lancadas || [], adicionais, comp);
    await conferirExcluidas(token, lancadas || [], adicionais, comp);
    const clientes = await empresasDasPessoas(token);
    const boletos = await boletosDaCompetencia(comp);

    // a venda modelo: a do adicional mais recente antes da competência — de preferência, do lote do ano anterior; a que
    // não existe mais (excluída) ou não serve (outro serviço junto): a seguinte, até 5
    const lote = (ano - 1) + '-' + comp.slice(5, 7);
    const candidatas = adicionais.filter(p => p.numero && p.competencia < comp)
      .sort((a, b) => Number(b.competencia === lote) - Number(a.competencia === lote) || b.competencia.localeCompare(a.competencia) || b.numero - a.numero);
    const avisos = [];
    let modelo = null;
    for (const numero of [...new Set(candidatas.map(p => p.numero))].slice(0, 5)) {
      try { modelo = await modeloPeloNumero(token, numero, cats); break; } catch (e) { if (!(e instanceof ErroPublico)) throw e; }
    }
    if (!modelo) avisos.push('Não achei no Conta Azul uma venda do adicional de anos anteriores pra copiar o serviço e a conta: lance a primeira à mão.');
    const contas = await contasDoAdicional(token, ano, cats);
    contas.padrao = modelo ? modelo.id_conta_financeira : null;
    if (!contas.inter) avisos.push('Não achei a conta do Inter pelo nome: com o boleto, a conta fica a da venda do ano passado. Confira na coluna Conta.');
    if (!boletos.size) avisos.push('A competência ' + mesBR(comp) + ' ainda não foi gerada em Boletos. Gere antes de lançar, pra o adicional entrar no boleto, a venda vencer no mesmo dia dele e a conta ser a do Inter.');
    const { itens, anos, resumo } = montarLista({ competencia: comp, hoje, mensais, adicionais, lancadas: lancadas || [], clientes, boletos, contas });
    const emUso = new Set(itens.map(i => i.conta && i.conta.id).filter(Boolean));
    const listaContas = [...new Set([...contas.nomes.keys(), ...emUso])].map(id => ({ id, nome: contas.nomes.get(id) || 'outra conta' }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    return {
      competencia: comp, data_venda: ultimoDia(comp), hoje, anos, itens, resumo, avisos,
      boletos: boletos.size, contas: listaContas,
      modelo: modelo && { numero: modelo.numero, data: modelo.data, cliente: modelo.cliente, servico: modelo.servico, vendedor: modelo.vendedor,
        conta: modelo.id_conta_financeira ? contas.nomes.get(modelo.id_conta_financeira) || 'outra conta' : null }
    };
  }

  // a linha "lancando" que ficou parada (a função caiu entre a venda e o registro): com a venda no Conta Azul, vira
  // "lancada"; sem ela, depois de 15 minutos, "erro" — e pode ser lançada de novo
  async function conferirParadas(token, lancadas, adicionais, comp) {
    for (const l of lancadas) {
      if (l.situacao !== 'lancando') continue;
      const idade = agora().getTime() - new Date(l.atualizada_em || l.lancada_em).getTime();
      if (idade < LANCANDO_PARADA_MS) continue;
      const achou = adicionais.find(p => p.pessoa === l.ca_cliente_id && p.competencia === comp && p.numero);
      if (achou) {
        let id = null;
        try { const v = itensDe(await ca(token, '/v1/venda/busca', { params: { termo_busca: String(achou.numero) } })).find(x => Number(x.numero) === achou.numero); id = v && ehUuid(v.id) ? v.id : null; } catch (e) { id = null; }
        await db('ca_vendas_lancadas?id=eq.' + l.id + '&situacao=eq.lancando', { method: 'PATCH', body: { situacao: 'lancada', ca_venda_numero: achou.numero, ...(id ? { ca_venda_id: id } : {}), atualizada_em: agoraIso() } });
        Object.assign(l, { situacao: 'lancada', ca_venda_numero: achou.numero, ca_venda_id: id });
      } else if (idade > LANCANDO_ERRO_MS) {
        await db('ca_vendas_lancadas?id=eq.' + l.id + '&situacao=eq.lancando', { method: 'PATCH', body: { situacao: 'erro', erro: 'não confirmou no Conta Azul: confira lá antes de lançar de novo', atualizada_em: agoraIso() } });
        l.situacao = 'erro';
      }
    }
  }

  // a venda que o sistema lançou e alguém excluiu direto no Conta Azul: sem o adicional da competência daquela empresa na
  // lista do Conta Azul, a venda é conferida pelo id — excluída (ou cancelada), a linha vira "excluida" (por "conta_azul"),
  // o extra sai do boleto e a empresa volta à lista, pra lançar de novo. Erro na conferência: fica como está.
  async function conferirExcluidas(token, lancadas, adicionais, comp) {
    const comAdicional = new Set(adicionais.filter(p => p.adicional && p.competencia === comp).map(p => p.pessoa));
    for (const l of lancadas) {
      if (l.situacao !== 'lancada' || !ehUuid(l.ca_venda_id) || comAdicional.has(l.ca_cliente_id)) continue;
      if (agora().getTime() - new Date(l.atualizada_em || l.lancada_em).getTime() < LANCANDO_PARADA_MS) continue;
      let existe;
      try { existe = await vendaExiste(token, l.ca_venda_id); } catch (e) { continue; }
      if (existe) continue;
      const r = await db('ca_vendas_lancadas?id=eq.' + l.id + '&situacao=eq.lancada', { method: 'PATCH', prefer: 'return=representation', body: { situacao: 'excluida', excluida_por: 'conta_azul', excluida_em: agoraIso(), atualizada_em: agoraIso() } });
      if (!r || !r.length) continue;
      l.situacao = 'excluida';
      await tirarDoBoleto(l).catch(() => null);
    }
  }

  // a venda ainda existe no Conta Azul? (404 ou 410, ou a situação excluída ou cancelada: não)
  async function vendaExiste(token, id) {
    try {
      const v = await ca(token, '/v1/venda/' + id);
      return !/EXCLU|CANCEL/.test(String((v && v.venda && v.venda.situacao && v.venda.situacao.nome) || '').toUpperCase());
    } catch (e) {
      if (e.status === 404 || e.status === 410) return false;
      throw e;
    }
  }

  // a venda excluída: o extra dela sai do boleto (o pago fica como está) → o que aconteceu, pra quem vê
  async function tirarDoBoleto(l) {
    if (!l.cobranca_id) return null;
    const b = ((await db('cobrancas_mensais?select=id,status,itens_extras&id=eq.' + l.cobranca_id)) || [])[0];
    if (!b || !temExtra(b.itens_extras, l.id)) return null;
    if (b.status === 'pago') return 'o boleto já está pago: o extra ficou nele';
    await db('cobrancas_mensais?id=eq.' + b.id, { method: 'PATCH', body: { itens_extras: semExtra(b.itens_extras, l.id) } });
    return b.status === 'a_emitir' ? 'saiu do boleto' : 'saiu do boleto, que já estava ' + (STATUS_BOLETO[b.status] || b.status) + ': reemita';
  }

  // ---------- o boleto: o adicional como item extra do boleto a emitir da competência ----------
  async function porNoBoletoUma(linha, comp) {
    if (!linha.cliente_id) return { posto: false, motivo: 'a empresa não foi achada no cadastro (pelo CNPJ nem pelo nome)' };
    const b = ((await db('cobrancas_mensais?select=id,status,itens_extras&competencia=eq.' + comp + '&cliente_id=eq.' + linha.cliente_id)) || [])[0];
    if (!b) return { posto: false, motivo: 'sem boleto de ' + mesBR(comp) + ' em Boletos' };
    if (temExtra(b.itens_extras, linha.id)) {
      if (linha.cobranca_id !== b.id) await db('ca_vendas_lancadas?id=eq.' + linha.id, { method: 'PATCH', body: { cobranca_id: b.id, atualizada_em: agoraIso() } });
      return { posto: true, ja: true };
    }
    if (b.status !== 'a_emitir') return { posto: false, motivo: 'o boleto de ' + mesBR(comp) + ' já está ' + (STATUS_BOLETO[b.status] || b.status) + ': o adicional não entrou' };
    const r = await db('cobrancas_mensais?id=eq.' + b.id + '&status=eq.a_emitir', { method: 'PATCH', prefer: 'return=representation', body: { itens_extras: comExtra(b.itens_extras, extraDoAdicional(linha)) } });
    if (!r || !r.length) return { posto: false, motivo: 'o boleto mudou de situação agora: tente de novo' };
    await db('ca_vendas_lancadas?id=eq.' + linha.id, { method: 'PATCH', body: { cobranca_id: b.id, atualizada_em: agoraIso() } });
    return { posto: true };
  }

  // ---------- lançar ----------
  async function lancar(comp, corpo, quem) {
    const lista = Array.isArray(corpo.itens) ? corpo.itens : [];
    if (!lista.length) throw new ErroPublico('Nenhuma empresa marcada.');
    if (lista.length > MAX_POR_LOTE) throw new ErroPublico('Até ' + MAX_POR_LOTE + ' empresas por vez.');
    const hoje = diaBR(agora());
    const dataVenda = ultimoDia(comp);
    const token = await tokenCA();
    const cats = await categorias();
    const modelo = await modeloPeloNumero(token, Number(corpo.modelo), cats);
    const comBoleto = corpo.boleto !== false;
    const empresas = comBoleto ? await empresasDasPessoas(token) : new Map();
    // o que já existe no Conta Azul nesta competência (lançado à mão): o espelho
    const pessoasPedidas = [...new Set(lista.map(x => x && x.pessoa).filter(ehUuid))];
    const jaNoCA = new Map();
    if (pessoasPedidas.length) {
      const d = await db('ca_parcelas?select=fornecedor_cliente_id,descricao&natureza=eq.receita&data_competencia=gte.' + comp + '-01&data_competencia=lte.' + dataVenda
        + '&categorias=cs.' + enc(JSON.stringify([{ nome: CATEGORIA }])) + '&fornecedor_cliente_id=in.(' + pessoasPedidas.join(',') + ')');
      for (const p of d || []) jaNoCA.set(p.fornecedor_cliente_id, parcelaNormal({ ...p, total: 0 }).numero);
    }
    const resultados = [];
    for (const bruto of lista) {
      const it = limparItem(bruto, { hoje });
      if (it.erro) { resultados.push({ pessoa: (bruto && bruto.pessoa) || null, ok: false, erro: it.erro }); continue; }
      if (jaNoCA.has(it.pessoa)) { resultados.push({ pessoa: it.pessoa, ok: false, erro: 'já existe no Conta Azul' + (jaNoCA.get(it.pessoa) ? ' (venda ' + jaNoCA.get(it.pessoa) + ')' : '') }); continue; }
      const empresa = empresas.get(it.pessoa) || null;
      // 1) a linha nasce antes da venda: o índice único barra o lançamento em dobro
      let linha;
      try {
        linha = ((await db('ca_vendas_lancadas', { method: 'POST', prefer: 'return=representation', body: {
          tipo: TIPO, competencia: comp, ca_cliente_id: it.pessoa, cliente_nome: it.nome || '(sem nome)', cliente_id: empresa ? empresa.id : null,
          valor: it.valor, vencimento: it.vencimento, data_venda: dataVenda, situacao: 'lancando', lancada_por: quem
        } })) || [])[0];
      } catch (e) {
        if (e.codigo === '23505') { resultados.push({ pessoa: it.pessoa, ok: false, erro: 'já lançada (ou em lançamento agora)' }); continue; }
        throw e;
      }
      // 2) o número e a venda (número repetido: pega o seguinte e tenta mais uma vez)
      let venda = null, falha = null;
      for (let t = 0; t < 2 && !venda; t++) {
        try {
          const prox = await ca(token, '/v1/venda/proximo-numero');
          const numero = Number(typeof prox === 'object' && prox !== null ? (prox.numero ?? prox.proximo_numero) : prox);
          if (!Number.isInteger(numero) || numero <= 0) throw Object.assign(new Error('próximo número inválido'), { status: 500 });
          const r = await ca(token, '/v1/venda', { method: 'POST', body: vendaParaApi({ modelo, pessoa: it.pessoa, valor: it.valor, vencimento: it.vencimento, numero, dataVenda, conta: it.conta || undefined }) });
          venda = { id: r && r.id, numero: Number((r && r.numero) || numero) };
        } catch (e) {
          falha = e;
          if (!(e.status === 400 || e.status === 409) || !/n[uú]mero/i.test(motivoDoContaAzul(e))) break;
        }
      }
      if (!venda) {
        await db('ca_vendas_lancadas?id=eq.' + linha.id, { method: 'PATCH', body: { situacao: 'erro', erro: String((falha && falha.message) || 'sem resposta').slice(0, 500), atualizada_em: agoraIso() } }).catch(() => {});
        resultados.push({ pessoa: it.pessoa, ok: false, erro: 'o Conta Azul não aceitou: ' + motivoDoContaAzul(falha) });
        continue;
      }
      await db('ca_vendas_lancadas?id=eq.' + linha.id, { method: 'PATCH', body: { situacao: 'lancada', ca_venda_id: ehUuid(venda.id) ? venda.id : null, ca_venda_numero: venda.numero, atualizada_em: agoraIso() } });
      linha = { ...linha, situacao: 'lancada', ca_venda_id: venda.id, ca_venda_numero: venda.numero };
      // 3) o boleto
      let boleto = null;
      if (comBoleto) {
        try { boleto = await porNoBoletoUma(linha, comp); } catch (e) { boleto = { posto: false, motivo: 'não consegui gravar no boleto agora' }; }
      }
      resultados.push({ pessoa: it.pessoa, ok: true, id: linha.id, numero: venda.numero, valor: it.valor, vencimento: it.vencimento, nome: linha.cliente_nome, cliente_id: linha.cliente_id, boleto });
    }
    return { resultados, modelo: modelo.numero };
  }

  // ---------- pôr no boleto as que faltam ----------
  async function porNoBoleto(comp) {
    const linhas = (await db('ca_vendas_lancadas?select=*&tipo=eq.' + TIPO + '&competencia=eq.' + comp + '&situacao=eq.lancada&order=cliente_nome.asc')) || [];
    const semEmpresa = linhas.filter(l => !l.cliente_id);
    if (semEmpresa.length) {
      const token = await tokenCA();
      const empresas = await empresasDasPessoas(token);
      for (const l of semEmpresa) {
        const e = empresas.get(l.ca_cliente_id);
        if (!e) continue;
        await db('ca_vendas_lancadas?id=eq.' + l.id, { method: 'PATCH', body: { cliente_id: e.id, atualizada_em: agoraIso() } });
        l.cliente_id = e.id;
      }
    }
    const resultados = [];
    for (const l of linhas) resultados.push({ id: l.id, nome: l.cliente_nome, numero: l.ca_venda_numero, ...(await porNoBoletoUma(l, comp)) });
    return { resultados };
  }

  // ---------- desfazer ----------
  async function desfazer(corpo, quem) {
    const ids = [...new Set((Array.isArray(corpo.ids) ? corpo.ids : []).map(String).filter(ehUuid))].slice(0, 100);
    if (!ids.length) throw new ErroPublico('Nenhuma venda pra desfazer.');
    const linhas = ((await db('ca_vendas_lancadas?select=*&id=in.(' + ids.join(',') + ')&situacao=eq.lancada')) || []).filter(l => ehUuid(l.ca_venda_id));
    if (!linhas.length) return { excluidas: [], ficaram: [] };
    const token = await tokenCA();
    await ca(token, '/v1/venda/exclusao-lote', { method: 'POST', body: { ids: linhas.map(l => l.ca_venda_id) } });
    const excluidas = [], ficaram = [];
    for (const l of linhas) {
      if (await vendaExiste(token, l.ca_venda_id)) { ficaram.push({ id: l.id, nome: l.cliente_nome, numero: l.ca_venda_numero, motivo: 'o Conta Azul não excluiu (tem nota emitida ou valor recebido?)' }); continue; }
      await db('ca_vendas_lancadas?id=eq.' + l.id, { method: 'PATCH', body: { situacao: 'excluida', excluida_por: quem, excluida_em: agoraIso(), atualizada_em: agoraIso() } });
      const boleto = await tirarDoBoleto(l);
      excluidas.push({ id: l.id, nome: l.cliente_nome, numero: l.ca_venda_numero, boleto });
    }
    return { excluidas, ficaram };
  }

  // ---------- a entrada ----------
  return async function servidor(req) {
    const origin = req.headers.get('origin');
    const resp = (status, corpo) => new Response(JSON.stringify(corpo), { status, headers: cors(origin) });
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors(origin) });
    if (req.method !== 'POST') return resp(405, { erro: 'Só POST.' });
    let quem = await quemChama(req);
    let soConsulta = false;
    const chaveSync = req.headers.get('x-sync-key') || '';
    if (!quem && chaveSync) {
      const k = await chaveDoSync().catch(() => '');
      if (k && chaveSync === k) { quem = 'servidor'; soConsulta = true; }
    }
    if (!quem) return resp(401, { erro: 'Entre no sistema pra usar esta função.' });
    if (quem !== 'servidor' && !SOCIOS.includes(quem)) return resp(403, { erro: 'Só os sócios lançam vendas no Conta Azul.' });
    let corpo;
    try { corpo = await req.json(); } catch (e) { return resp(400, { erro: 'Pedido inválido.' }); }
    const modo = String((corpo && corpo.modo) || '');
    if ((soConsulta || quem === 'servidor') && modo !== 'prever') return resp(403, { erro: 'Sem o login de um sócio, só a consulta.' });
    try {
      if (modo === 'desfazer') return resp(200, await desfazer(corpo, quem));
      const comp = String(corpo.competencia || '');
      if (!COMPETENCIA.test(comp)) return resp(400, { erro: "A competência vai em 'AAAA-MM'." });
      if (modo === 'prever') return resp(200, await prever(comp));
      if (modo === 'lancar') return resp(200, await lancar(comp, corpo, quem));
      if (modo === 'boleto') return resp(200, await porNoBoleto(comp));
      return resp(400, { erro: 'Modo desconhecido.' });
    } catch (e) {
      if (e instanceof ErroPublico) return resp(e.status, { erro: e.message, ...e.extra });
      console.error('ca-vendas:', (e && e.message) || e);
      return resp(500, { erro: 'Não consegui falar com o Conta Azul agora. Tente de novo em instantes.' });
    }
  };
}

export { dataBR };
