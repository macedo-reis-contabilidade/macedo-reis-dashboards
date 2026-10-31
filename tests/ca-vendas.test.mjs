// A função ca-vendas (31/10/2026): lança no Conta Azul as vendas do honorário adicional anual. O servidor
// (supabase/functions/ca-vendas/servidor.js) com um banco, um Auth e um Conta Azul de mentira: quem chama, a lista, o
// lançamento (a linha antes da venda, o número, a venda copiando a modelo, o erro do Conta Azul, o lançamento em dobro),
// o boleto, a linha parada, o desfazer e o token perto de vencer. E o commit fixado no index.ts.
// Os nomes e os ids são de mentira (o repositório é público). Rodar com: node tests/ca-vendas.test.mjs
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { posix } from 'node:path';
import { criarServidor, API, MARGEM_TOKEN_MS, motivoDoContaAzul } from '../supabase/functions/ca-vendas/servidor.js';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + extra : '')); };
const J = x => JSON.stringify(x);
const raiz = fileURLToPath(new URL('../', import.meta.url));
const U = n => '9b000000-0000-4000-8000-' + String(n).padStart(12, '0');
let seq = 1000;
const novoId = () => U(++seq);

const URLB = 'https://projeto.supabase.co';
const ENV = { SUPABASE_URL: URLB, SUPABASE_SERVICE_ROLE_KEY: 'chave-servidor', SUPABASE_ANON_KEY: 'chave-anonima' };
const AGORA = new Date('2026-10-31T14:00:00Z');
const CAT = { adicional: U(901), mensal: U(902), mei: U(903) };
const cat = id => [{ id, nome: id === CAT.adicional ? 'HONORÁRIO ADICIONAL ANUAL' : id === CAT.mensal ? 'HONORÁRIOS MENSAIS' : 'MEI - CONTRATOS' }];

// ---------- o mundo de mentira ----------
function mundo({ tokenFaltam = 50 * 60 * 1000 } = {}) {
  const P = { paulo: U(1), padaria: U(2), isenta: U(3), boleto: U(9), emitido: U(10), recusa: U(11) };
  const db = {
    ca_tokens: [{ id: 1, access_token: 'tok-ca', expires_at: new Date(AGORA.getTime() + tokenFaltam).toISOString() }],
    configuracoes_escritorio: [{ chave: 'ca_sync_key', valor: 'chave-sync' }],
    ca_categorias: [{ id: CAT.adicional, nome: 'HONORÁRIO ADICIONAL ANUAL', tipo: 'RECEITA' }, { id: CAT.mensal, nome: 'HONORÁRIOS MENSAIS', tipo: 'RECEITA' }, { id: CAT.mei, nome: 'MEI - CONTRATOS', tipo: 'RECEITA' }],
    // o espelho: a mensalidade de dezembro do ano anterior e a da competência
    ca_parcelas: [
      ...[[P.paulo, 'LOJA DO PAULO LTDA', 580], [P.isenta, 'OFICINA ISENTA LTDA', 450], [P.boleto, 'COM BOLETO LTDA', 600], [P.emitido, 'BOLETO EMITIDO LTDA', 700], [P.recusa, 'RECUSADA LTDA', 300]]
        .flatMap(([p, n, v]) => [
          { natureza: 'receita', fornecedor_cliente_id: p, fornecedor_cliente_nome: n, data_competencia: '2025-12-30', data_vencimento: '2026-01-10', total: v, descricao: 'Venda 1', categorias: cat(CAT.mensal) },
          { natureza: 'receita', fornecedor_cliente_id: p, fornecedor_cliente_nome: n, data_competencia: '2026-10-30', data_vencimento: '2026-11-10', total: v, descricao: 'Venda 2', categorias: cat(CAT.mensal) }]),
      { natureza: 'receita', fornecedor_cliente_id: P.padaria, fornecedor_cliente_nome: 'PADARIA NOVA LTDA', data_competencia: '2026-09-30', data_vencimento: '2026-10-28', total: 550, descricao: 'Venda 3', categorias: cat(CAT.mensal) },
      { natureza: 'receita', fornecedor_cliente_id: P.padaria, fornecedor_cliente_nome: 'PADARIA NOVA LTDA', data_competencia: '2026-10-30', data_vencimento: '2026-11-28', total: 550, descricao: 'Venda 4', categorias: cat(CAT.mensal) },
      // uma despesa e uma receita de outra categoria: fora
      { natureza: 'despesa', fornecedor_cliente_id: U(50), fornecedor_cliente_nome: 'FORNECEDOR', data_competencia: '2026-10-30', total: 99, categorias: cat(CAT.mensal) }
    ],
    ca_vendas_lancadas: [],
    clientes: [
      { id: U(101), nome_principal: 'LOJA DO PAULO LTDA', documento: '11.111.111/0001-11', status: 'ativo' },
      { id: U(109), nome_principal: 'COM BOLETO LTDA', documento: '99999999000199', status: 'ativo' },
      { id: U(110), nome_principal: 'BOLETO EMITIDO LTDA', documento: '10101010000110', status: 'ativo' },
      { id: U(199), nome_principal: 'COM BOLETO (ANTIGO)', documento: '99999999000199', status: 'inativo' }
    ],
    cobrancas_mensais: [
      { id: U(209), cliente_id: U(109), competencia: '2026-10', vencimento: '2026-11-09', status: 'a_emitir', itens_extras: [{ faturavel_id: U(600), descricao: 'Abertura de filial', valor: 300 }] },
      { id: U(210), cliente_id: U(110), competencia: '2026-10', vencimento: '2026-11-10', status: 'emitido', itens_extras: [] }
    ]
  };
  // o Conta Azul
  const mensalApi = (p, nome, comp, valor, catId = CAT.mensal) => ({ id: novoId(), descricao: 'Venda 7', data_vencimento: comp + '-10', data_competencia: comp + '-30', total: valor, categorias: cat(catId), cliente: { id: p, nome } });
  const adicionalApi = (p, nome, comp, valor, numero) => ({ id: novoId(), descricao: 'Venda ' + numero, data_vencimento: (Number(comp.slice(0, 4))) + '-11-11', data_competencia: comp + '-31', total: valor, categorias: cat(CAT.adicional), cliente: { id: p, nome } });
  const contaAzul = {
    parcelas: [
      mensalApi(P.paulo, 'LOJA DO PAULO LTDA', '2025-10', 530), adicionalApi(P.paulo, 'LOJA DO PAULO LTDA', '2025-10', 530, 190419223),
      adicionalApi(P.paulo, 'LOJA DO PAULO LTDA', '2024-10', 510, 190416844),
      mensalApi(P.isenta, 'OFICINA ISENTA LTDA', '2025-10', 400),
      mensalApi(P.boleto, 'COM BOLETO LTDA', '2025-10', 600), adicionalApi(P.boleto, 'COM BOLETO LTDA', '2025-10', 600, 190419224),
      mensalApi(P.emitido, 'BOLETO EMITIDO LTDA', '2025-10', 700), adicionalApi(P.emitido, 'BOLETO EMITIDO LTDA', '2025-10', 700, 190419225),
      mensalApi(P.recusa, 'RECUSADA LTDA', '2025-10', 300), adicionalApi(P.recusa, 'RECUSADA LTDA', '2025-10', 300, 190419226)
    ],
    pessoas: [{ id: P.paulo, documento: '11111111000111' }, { id: P.boleto, documento: '99999999000199' }, { id: P.emitido, documento: '10101010000110' }, { id: P.padaria, documento: '' }],
    vendas: new Map(),
    proximo: 190421459,
    proximosForcados: [],
    criadas: [],
    protegidas: new Set(),
    recusar: new Set([P.recusa]),
    chamadas: []
  };
  // a venda modelo (a de 2025 da loja)
  contaAzul.vendas.set(U(401), { numero: 190419223, detalhe: { cliente: { uuid: P.paulo, nome: 'LOJA DO PAULO LTDA' }, vendedor: { id: U(301), nome: 'Contador' },
    venda: { id: U(401), numero: 190419223, data_compromisso: '2025-10-31', id_categoria: CAT.adicional, id_centro_custo: null, situacao: { nome: 'APROVADO' },
      condicao_pagamento: { tipo_pagamento: null, id_conta_financeira: U(302), opcao_condicao_pagamento: '1x' } } },
    itens: { itens: [{ id: U(402), id_item: U(303), nome: 'HONORÁRIO ADICIONAL ANUAL', tipo: 'SERVICO', quantidade: 1, valor: 530 }] } });
  const chamadas = [];

  const filtrar = (linhas, sp) => linhas.filter(r => [...sp.entries()].every(([k, v]) => {
    if (['select', 'order', 'limit', 'offset'].includes(k)) return true;
    const i = v.indexOf('.'); const op = v.slice(0, i), val = v.slice(i + 1);
    const cel = r[k];
    if (op === 'eq') return String(cel) === val;
    if (op === 'gte') return cel != null && String(cel) >= val;
    if (op === 'lte') return cel != null && String(cel) <= val;
    if (op === 'in') return val.replace(/^\(|\)$/g, '').split(',').map(s => s.replace(/^"|"$/g, '')).includes(String(cel));
    if (op === 'not') return val === 'is.null' ? cel != null : true;
    if (op === 'cs') return JSON.parse(val).every(w => (cel || []).some(c => Object.entries(w).every(([kk, vv]) => c[kk] === vv)));
    throw new Error('filtro não suportado no teste: ' + k + '=' + v);
  }));
  const resposta = (status, corpo) => ({ ok: status >= 200 && status < 300, status, text: async () => (corpo === undefined ? '' : JSON.stringify(corpo)), json: async () => corpo });

  async function fetchFalso(url, op = {}) {
    const metodo = op.method || 'GET';
    const corpo = op.body ? JSON.parse(op.body) : undefined;
    chamadas.push({ url, metodo, corpo, headers: op.headers || {} });
    if (url.startsWith(URLB + '/auth/v1/user')) {
      const t = String((op.headers || {}).Authorization || '').replace('Bearer ', '');
      const email = { 'tok-samuel': 'financeiro@macedoereis.com.br', 'tok-thalia': 'fiscal@macedoereis.com.br', 'tok-fora': 'alguem@gmail.com' }[t];
      return email ? resposta(200, { email }) : resposta(401, { msg: 'invalid' });
    }
    if (url.startsWith(URLB + '/functions/v1/ca-sync')) return resposta(200, { ok: true });
    if (url.startsWith(URLB + '/rest/v1/')) {
      const u = new URL(url); const tabela = u.pathname.replace('/rest/v1/', '');
      const linhas = db[tabela]; if (!linhas) throw new Error('tabela desconhecida: ' + tabela);
      if (metodo === 'GET') return resposta(200, filtrar(linhas, u.searchParams));
      if (metodo === 'POST') {
        const n = { id: novoId(), lancada_em: AGORA.toISOString(), atualizada_em: AGORA.toISOString(), cobranca_id: null, ca_venda_id: null, ca_venda_numero: null, erro: null, ...corpo };
        if (tabela === 'ca_vendas_lancadas' && linhas.some(l => l.tipo === n.tipo && l.competencia === n.competencia && l.ca_cliente_id === n.ca_cliente_id && ['lancando', 'lancada'].includes(l.situacao)))
          return resposta(409, { code: '23505', message: 'duplicate key' });
        linhas.push(n);
        return resposta(201, [n]);
      }
      if (metodo === 'PATCH') { const alvo = filtrar(linhas, u.searchParams); alvo.forEach(l => Object.assign(l, corpo)); return resposta(200, alvo); }
    }
    if (url.startsWith(API)) {
      contaAzul.chamadas.push(metodo + ' ' + url.replace(API, '').split('?')[0]);
      const u = new URL(url); const caminho = u.pathname; const sp = u.searchParams;
      if (String((op.headers || {}).Authorization) !== 'Bearer tok-ca') return resposta(401, { error: 'token' });
      if (caminho === '/v1/financeiro/eventos-financeiros/contas-a-receber/buscar') {
        const ids = (sp.get('ids_categorias') || '').split(',');
        const lista = contaAzul.parcelas.filter(p => p.categorias.some(c => ids.includes(c.id)) && p.data_vencimento >= sp.get('data_vencimento_de') && p.data_vencimento <= sp.get('data_vencimento_ate'));
        const tam = Number(sp.get('tamanho_pagina')), pag = Number(sp.get('pagina'));
        return resposta(200, { itens_totais: lista.length, itens: lista.slice((pag - 1) * tam, pag * tam) });
      }
      if (caminho === '/v1/pessoas') { const tam = Number(sp.get('tamanho_pagina')), pag = Number(sp.get('pagina')); return resposta(200, { totalItems: contaAzul.pessoas.length, items: contaAzul.pessoas.slice((pag - 1) * tam, pag * tam) }); }
      if (caminho === '/v1/venda/busca') { const n = Number(sp.get('termo_busca')); const achadas = [...contaAzul.vendas.entries()].filter(([, v]) => v.numero === n).map(([id, v]) => ({ id, numero: v.numero })); return resposta(200, { itens: achadas }); }
      if (caminho === '/v1/venda/proximo-numero') return resposta(200, contaAzul.proximosForcados.length ? contaAzul.proximosForcados.shift() : contaAzul.proximo);
      if (caminho === '/v1/venda' && metodo === 'POST') {
        if (contaAzul.recusar.has(corpo.id_cliente)) return resposta(400, { error: 'Cliente bloqueado para vendas' });
        if ([...contaAzul.vendas.values()].some(v => v.numero === corpo.numero)) return resposta(400, { error: 'Já existe uma venda com este número' });
        const id = novoId();
        contaAzul.vendas.set(id, { numero: corpo.numero, detalhe: { venda: { id, numero: corpo.numero, situacao: { nome: 'APROVADO' } } }, itens: { itens: [] } });
        contaAzul.criadas.push(corpo);
        contaAzul.proximo++;
        contaAzul.parcelas.push({ id: novoId(), descricao: 'Venda ' + corpo.numero, data_vencimento: corpo.condicao_pagamento.parcelas[0].data_vencimento, data_competencia: corpo.data_venda,
          total: corpo.itens[0].valor, categorias: cat(CAT.adicional), cliente: { id: corpo.id_cliente, nome: '' } });
        return resposta(200, { id, numero: corpo.numero });
      }
      if (caminho === '/v1/venda/exclusao-lote') {
        let atualizados = 0, ignorados = 0;
        for (const id of corpo.ids) { if (contaAzul.protegidas.has(id) || !contaAzul.vendas.has(id)) { ignorados++; continue; } contaAzul.vendas.delete(id); atualizados++; }
        return resposta(200, { atualizados, ignorados });
      }
      const m = /^\/v1\/venda\/([0-9a-f-]{36})(\/itens)?$/.exec(caminho);
      if (m) { const v = contaAzul.vendas.get(m[1]); if (!v) return resposta(404, { error: 'Venda não encontrada com o ID informado' }); return resposta(200, m[2] ? v.itens : v.detalhe); }
      return resposta(404, { error: 'caminho do teste: ' + caminho });
    }
    throw new Error('fetch não esperado: ' + url);
  }
  const aguardados = [];
  const servidor = criarServidor({ env: k => ENV[k], fetch: fetchFalso, agora: () => AGORA, aguardar: p => { aguardados.push(p); return p; }, esperar: async () => {} });
  const pedir = async (corpo, { token = 'tok-samuel', sync = null, metodo = 'POST' } = {}) => {
    const headers = new Map([['origin', 'https://macedo-reis-contabilidade.github.io'], ...(token ? [['authorization', 'Bearer ' + token]] : []), ...(sync ? [['x-sync-key', sync]] : [])]);
    const r = await servidor({ method: metodo, headers: { get: k => headers.get(k.toLowerCase()) || null }, json: async () => corpo });
    const txt = await r.text();
    return { status: r.status, corpo: txt ? JSON.parse(txt) : null, headers: r.headers };
  };
  return { db, contaAzul, chamadas, pedir, aguardados, P };
}

console.log('Quem chama:');
{
  const w = mundo();
  const op = await w.pedir(null, { metodo: 'OPTIONS' });
  chk('o OPTIONS do navegador passa (sem login), com o CORS', op.status === 200 && /x-sync-key/.test(op.headers.get('Access-Control-Allow-Headers')));
  chk('GET: 405', (await w.pedir({}, { metodo: 'GET' })).status === 405);
  chk('sem login: 401', (await w.pedir({ modo: 'prever', competencia: '2026-10' }, { token: null })).status === 401);
  chk('login de fora do escritório: 401', (await w.pedir({ modo: 'prever', competencia: '2026-10' }, { token: 'tok-fora' })).status === 401);
  const thalia = await w.pedir({ modo: 'prever', competencia: '2026-10' }, { token: 'tok-thalia' });
  chk('da equipe, mas não sócio: 403, com o porquê', thalia.status === 403 && /sócios/.test(thalia.corpo.erro));
  chk('a chave do sincronismo errada: 401', (await w.pedir({ modo: 'prever', competencia: '2026-10' }, { token: null, sync: 'outra' })).status === 401);
  const soConsulta = await w.pedir({ modo: 'lancar', competencia: '2026-10', itens: [] }, { token: null, sync: 'chave-sync' });
  chk('com a chave do sincronismo, lançar não: 403', soConsulta.status === 403 && /só a consulta/.test(soConsulta.corpo.erro));
  chk('a chave de servidor também só consulta', (await w.pedir({ modo: 'desfazer', ids: [U(1)] }, { token: 'chave-servidor' })).status === 403);
  chk('competência fora do formato: 400', (await w.pedir({ modo: 'prever', competencia: '10/2026' })).status === 400);
  chk('modo desconhecido: 400', (await w.pedir({ modo: 'outro', competencia: '2026-10' })).status === 400);
  chk('nada foi pedido ao Conta Azul nesses casos', w.contaAzul.chamadas.length === 0);
}

console.log('A lista (prever):');
{
  const w = mundo();
  const r = await w.pedir({ modo: 'prever', competencia: '2026-10' }, { token: null, sync: 'chave-sync' });
  chk('a consulta com a chave do sincronismo: 200', r.status === 200, J(r.corpo));
  const it = p => r.corpo.itens.find(i => i.pessoa === p);
  chk('a loja que pagou em 2025: marcada, a mensalidade de agora (580), o histórico de 2024 e 2025, a empresa do cadastro pelo CNPJ',
    it(w.P.paulo).grupo === 'sugerida' && it(w.P.paulo).valor === 580 && it(w.P.paulo).historico[2025].valor === 530 && it(w.P.paulo).historico[2024].valor === 510 && it(w.P.paulo).cliente_id === U(101), J(it(w.P.paulo)));
  chk('a padaria nova (primeira mensalidade em 09/2026): 4/12', it(w.P.padaria).grupo === 'nova' && it(w.P.padaria).valor === 183.33);
  chk('a isenta em 2025: desmarcada', it(w.P.isenta).grupo === 'isenta' && !it(w.P.isenta).marcada);
  chk('a do boleto: o CNPJ acha a empresa ativa (não a antiga) e o vencimento é o do boleto', it(w.P.boleto).cliente_id === U(109) && it(w.P.boleto).vencimento === '2026-11-09' && it(w.P.boleto).vencimento_de === 'boleto');
  chk('a despesa e o fornecedor ficam de fora', !r.corpo.itens.some(i => i.pessoa === U(50)));
  chk('a venda modelo: a do lote de 2025, com o serviço e a conta', J(r.corpo.modelo) === J({ numero: 190419223, data: '2025-10-31', cliente: 'LOJA DO PAULO LTDA', servico: 'HONORÁRIO ADICIONAL ANUAL', vendedor: 'Contador', conta: true }), J(r.corpo.modelo));
  chk('a data da venda e o resumo', r.corpo.data_venda === '2026-10-31' && r.corpo.resumo.marcadas === 5 && r.corpo.boletos === 2, J(r.corpo.resumo));
  chk('sem aviso de boleto (a competência já está na grade)', !r.corpo.avisos.some(a => /ainda não foi gerada/.test(a)));
  chk('nenhuma venda criada na consulta', w.contaAzul.criadas.length === 0 && !w.contaAzul.chamadas.some(c => c.startsWith('POST')));
  w.db.cobrancas_mensais.length = 0;
  const sem = await w.pedir({ modo: 'prever', competencia: '2026-10' });
  chk('sem a competência na grade de Boletos: o aviso pra gerar antes', sem.corpo.avisos.some(a => /10\/2026 ainda não foi gerada em Boletos/.test(a)));
}

console.log('O token do Conta Azul perto de vencer:');
{
  const w = mundo({ tokenFaltam: MARGEM_TOKEN_MS - 1000 });
  const r = await w.pedir({ modo: 'prever', competencia: '2026-10' });
  await Promise.all(w.aguardados);
  chk('503 "renovando", sem chamar o Conta Azul', r.status === 503 && r.corpo.renovando === true && w.contaAzul.chamadas.length === 0, J(r.corpo));
  chk('… e cutuca o ca-sync (que renova), com a chave dele, sem esperar a rodada', w.chamadas.some(c => c.url.endsWith('/functions/v1/ca-sync') && c.headers['x-sync-key'] === 'chave-sync'));
  chk('a função não renova o token ela mesma', !w.chamadas.some(c => /oauth2\/token/.test(c.url)));
}

console.log('Lançar:');
{
  const w = mundo();
  const itens = [
    { pessoa: w.P.paulo, nome: 'LOJA DO PAULO LTDA', valor: 580, vencimento: '2026-11-10' },
    { pessoa: w.P.boleto, nome: 'COM BOLETO LTDA', valor: 600, vencimento: '2026-11-09' },
    { pessoa: w.P.emitido, nome: 'BOLETO EMITIDO LTDA', valor: 700, vencimento: '2026-11-10' },
    { pessoa: w.P.recusa, nome: 'RECUSADA LTDA', valor: 300, vencimento: '2026-11-10' },
    { pessoa: w.P.padaria, nome: 'PADARIA NOVA LTDA', valor: 183.33, vencimento: '2026-10-30' }
  ];
  const r = await w.pedir({ modo: 'lancar', competencia: '2026-10', modelo: 190419223, itens });
  chk('200, um resultado por empresa', r.status === 200 && r.corpo.resultados.length === 5, J(r.corpo));
  const res = p => r.corpo.resultados.find(x => x.pessoa === p);
  chk('a loja: lançada, com o número do Conta Azul', res(w.P.paulo).ok && res(w.P.paulo).numero === 190421459, J(res(w.P.paulo)));
  const venda = w.contaAzul.criadas[0];
  chk('a venda: aprovada, no último dia da competência, 1x, com o serviço, a categoria, a conta e o vendedor da modelo',
    venda.situacao === 'APROVADO' && venda.data_venda === '2026-10-31' && venda.id_categoria === CAT.adicional && venda.itens[0].id === U(303) && venda.itens[0].valor === 580
    && venda.condicao_pagamento.id_conta_financeira === U(302) && venda.condicao_pagamento.opcao_condicao_pagamento === '1x' && venda.id_vendedor === U(301)
    && J(venda.condicao_pagamento.parcelas) === J([{ data_vencimento: '2026-11-10', valor: 580 }]), J(venda));
  chk('os números em sequência, pelo próximo número do Conta Azul', J(w.contaAzul.criadas.map(v => v.numero)) === J([190421459, 190421460, 190421461]));
  const linha = p => w.db.ca_vendas_lancadas.find(l => l.ca_cliente_id === p);
  chk('o registro: lançada, com o id e o número da venda, quem lançou e a empresa do cadastro',
    linha(w.P.paulo).situacao === 'lancada' && linha(w.P.paulo).ca_venda_numero === 190421459 && !!linha(w.P.paulo).ca_venda_id && linha(w.P.paulo).lancada_por === 'financeiro@macedoereis.com.br' && linha(w.P.paulo).cliente_id === U(101));
  chk('o boleto pago da loja não existe (sem boleto na grade): o motivo', res(w.P.paulo).boleto.posto === false && /sem boleto de 10\/2026/.test(res(w.P.paulo).boleto.motivo), J(res(w.P.paulo).boleto));
  const b209 = w.db.cobrancas_mensais.find(b => b.id === U(209));
  chk('com o boleto a emitir: o adicional entra como item extra, junto do faturável que já estava',
    res(w.P.boleto).boleto.posto && b209.itens_extras.length === 2 && b209.itens_extras[0].faturavel_id === U(600)
    && b209.itens_extras[1].adicional_id === linha(w.P.boleto).id && b209.itens_extras[1].valor === 600 && /venda 190421460/.test(b209.itens_extras[1].descricao) && linha(w.P.boleto).cobranca_id === U(209), J(b209.itens_extras));
  chk('com o boleto já emitido: a venda entra, o boleto não muda, e o motivo', res(w.P.emitido).ok && !res(w.P.emitido).boleto.posto && /já está emitido/.test(res(w.P.emitido).boleto.motivo)
    && w.db.cobrancas_mensais.find(b => b.id === U(210)).itens_extras.length === 0);
  chk('o Conta Azul recusou: o motivo dele, e o registro fica em erro (dá pra lançar de novo)', !res(w.P.recusa).ok && /Cliente bloqueado para vendas/.test(res(w.P.recusa).erro) && linha(w.P.recusa).situacao === 'erro', J(res(w.P.recusa)));
  chk('o vencimento que já passou: nem chega ao Conta Azul', !res(w.P.padaria).ok && /já passou/.test(res(w.P.padaria).erro) && !linha(w.P.padaria) && w.contaAzul.criadas.length === 3);
  const de2 = await w.pedir({ modo: 'lancar', competencia: '2026-10', modelo: 190419223, itens: [itens[0]] });
  chk('lançar de novo a mesma: barrado pelo registro, sem venda nova', !de2.corpo.resultados[0].ok && /já lançada/.test(de2.corpo.resultados[0].erro) && w.contaAzul.criadas.length === 3, J(de2.corpo));
  const lista = await w.pedir({ modo: 'prever', competencia: '2026-10' });
  const lp = lista.corpo.itens.find(i => i.pessoa === w.P.paulo);
  chk('na lista seguinte, a lançada aparece lançada (pelo sistema), com o número', lp.grupo === 'lancada' && lp.lancada.de === 'sistema' && lp.lancada.numero === 190421459, J(lp));
  chk('a recusada volta a ser lançável (o erro não trava)', lista.corpo.itens.find(i => i.pessoa === w.P.recusa).grupo === 'sugerida');
  chk('mais de 20 por vez: 400', (await w.pedir({ modo: 'lancar', competencia: '2026-10', modelo: 190419223, itens: Array.from({ length: 21 }, () => itens[0]) })).status === 400);
  chk('sem modelo: 400', (await w.pedir({ modo: 'lancar', competencia: '2026-10', itens: [itens[3]] })).status === 400);
  w.contaAzul.vendas.get(U(401)).detalhe.venda.id_categoria = CAT.mensal;
  const outraModelo = await w.pedir({ modo: 'lancar', competencia: '2026-10', modelo: 190419223, itens: [itens[3]] });
  chk('a modelo que não é do adicional: recusada, sem lançar nada', outraModelo.status === 500 && /não serve de modelo/.test(outraModelo.corpo.erro) && w.contaAzul.criadas.length === 3);
}

console.log('O número repetido e a lançada à mão:');
{
  const w = mundo();
  // alguém lançou à mão, ao mesmo tempo, com o número que o Conta Azul ainda deu como próximo
  w.contaAzul.vendas.set(U(450), { numero: 190421459, detalhe: { venda: { id: U(450), numero: 190421459 } }, itens: { itens: [] } });
  w.contaAzul.proximosForcados.push(190421459);
  w.contaAzul.proximo = 190421460;
  w.db.ca_parcelas.push({ natureza: 'receita', fornecedor_cliente_id: w.P.boleto, fornecedor_cliente_nome: 'COM BOLETO LTDA', data_competencia: '2026-10-31', data_vencimento: '2026-11-09', total: 600, descricao: 'Venda 190421300', categorias: cat(CAT.adicional) });
  const r = await w.pedir({ modo: 'lancar', competencia: '2026-10', modelo: 190419223, itens: [{ pessoa: w.P.paulo, nome: 'LOJA', valor: 580, vencimento: '2026-11-10' }, { pessoa: w.P.boleto, nome: 'COM BOLETO', valor: 600, vencimento: '2026-11-09' }] });
  chk('número repetido: o Conta Azul recusa e a função pega o próximo e tenta mais uma vez', r.corpo.resultados[0].ok && r.corpo.resultados[0].numero === 190421460
    && w.contaAzul.chamadas.filter(c => c === 'GET /v1/venda/proximo-numero').length === 2 && w.contaAzul.criadas.length === 1, J(r.corpo.resultados[0]));
  chk('a lançada à mão nesta competência (o espelho): não lança de novo', !r.corpo.resultados[1].ok && /já existe no Conta Azul \(venda 190421300\)/.test(r.corpo.resultados[1].erro), J(r.corpo.resultados[1]));
}

console.log('A linha parada em "lancando":');
{
  const w = mundo();
  // a função caiu entre a venda e o registro: a venda existe no Conta Azul
  w.contaAzul.vendas.set(U(460), { numero: 190421500, detalhe: { venda: { id: U(460), numero: 190421500 } }, itens: { itens: [] } });
  w.contaAzul.parcelas.push({ id: novoId(), descricao: 'Venda 190421500', data_vencimento: '2026-11-10', data_competencia: '2026-10-31', total: 580, categorias: cat(CAT.adicional), cliente: { id: w.P.paulo, nome: 'LOJA' } });
  const velho = new Date(AGORA.getTime() - 5 * 60 * 1000).toISOString();
  w.db.ca_vendas_lancadas.push({ id: U(700), tipo: 'adicional_anual', competencia: '2026-10', ca_cliente_id: w.P.paulo, cliente_nome: 'LOJA', valor: 580, vencimento: '2026-11-10', situacao: 'lancando', lancada_em: velho, atualizada_em: velho });
  // e outra parada há 20 minutos, sem venda no Conta Azul
  const muitoVelho = new Date(AGORA.getTime() - 20 * 60 * 1000).toISOString();
  w.db.ca_vendas_lancadas.push({ id: U(701), tipo: 'adicional_anual', competencia: '2026-10', ca_cliente_id: w.P.isenta, cliente_nome: 'ISENTA', valor: 450, vencimento: '2026-11-10', situacao: 'lancando', lancada_em: muitoVelho, atualizada_em: muitoVelho });
  const r = await w.pedir({ modo: 'prever', competencia: '2026-10' });
  const l700 = w.db.ca_vendas_lancadas.find(l => l.id === U(700)), l701 = w.db.ca_vendas_lancadas.find(l => l.id === U(701));
  chk('com a venda no Conta Azul: vira lançada, com o número e o id', l700.situacao === 'lancada' && l700.ca_venda_numero === 190421500 && l700.ca_venda_id === U(460), J(l700));
  chk('sem a venda, depois de 15 minutos: erro (pode lançar de novo)', l701.situacao === 'erro' && /não confirmou/.test(l701.erro));
  chk('na lista: a primeira lançada, a outra de volta às isentas', r.corpo.itens.find(i => i.pessoa === w.P.paulo).grupo === 'lancada' && r.corpo.itens.find(i => i.pessoa === w.P.isenta).grupo === 'isenta');
}

console.log('Pôr no boleto depois (o mês gerado depois do lançamento):');
{
  const w = mundo();
  w.db.cobrancas_mensais.length = 0;
  const r = await w.pedir({ modo: 'lancar', competencia: '2026-10', modelo: 190419223, itens: [{ pessoa: w.P.boleto, nome: 'COM BOLETO LTDA', valor: 600, vencimento: '2026-11-09' }] });
  chk('sem a grade: lançou, sem boleto', r.corpo.resultados[0].ok && !r.corpo.resultados[0].boleto.posto);
  w.db.cobrancas_mensais.push({ id: U(229), cliente_id: U(109), competencia: '2026-10', vencimento: '2026-11-09', status: 'a_emitir', itens_extras: [] });
  const b = await w.pedir({ modo: 'boleto', competencia: '2026-10' });
  chk('gerado o mês, "pôr no boleto" põe o extra', b.status === 200 && b.corpo.resultados[0].posto && w.db.cobrancas_mensais[0].itens_extras.length === 1, J(b.corpo));
  const b2 = await w.pedir({ modo: 'boleto', competencia: '2026-10' });
  chk('de novo: não duplica', b2.corpo.resultados[0].posto && b2.corpo.resultados[0].ja && w.db.cobrancas_mensais[0].itens_extras.length === 1);
}

console.log('Desfazer:');
{
  const w = mundo();
  const r = await w.pedir({ modo: 'lancar', competencia: '2026-10', modelo: 190419223, itens: [
    { pessoa: w.P.boleto, nome: 'COM BOLETO LTDA', valor: 600, vencimento: '2026-11-09' }, { pessoa: w.P.paulo, nome: 'LOJA DO PAULO LTDA', valor: 580, vencimento: '2026-11-10' }] });
  const [lb, lp] = [r.corpo.resultados[0].id, r.corpo.resultados[1].id];
  // a da loja já tem nota emitida: o Conta Azul não exclui
  w.contaAzul.protegidas.add(w.db.ca_vendas_lancadas.find(l => l.id === lp).ca_venda_id);
  const d = await w.pedir({ modo: 'desfazer', ids: [lb, lp, 'nao-e-id'] });
  chk('a exclusão em lote, conferida venda por venda', d.status === 200 && d.corpo.excluidas.length === 1 && d.corpo.ficaram.length === 1, J(d.corpo));
  chk('a excluída: some do Conta Azul, o registro fica "excluida" com quem e quando, e o extra sai do boleto (o faturável fica)',
    w.db.ca_vendas_lancadas.find(l => l.id === lb).situacao === 'excluida' && w.db.ca_vendas_lancadas.find(l => l.id === lb).excluida_por === 'financeiro@macedoereis.com.br'
    && J(w.db.cobrancas_mensais.find(b => b.id === U(209)).itens_extras.map(x => x.faturavel_id || x.adicional_id)) === J([U(600)]) && d.corpo.excluidas[0].boleto === 'saiu do boleto');
  chk('a que o Conta Azul não excluiu: fica lançada, com o motivo', w.db.ca_vendas_lancadas.find(l => l.id === lp).situacao === 'lancada' && /não excluiu/.test(d.corpo.ficaram[0].motivo));
  chk('sem nada pra desfazer: 400', (await w.pedir({ modo: 'desfazer', ids: [] })).status === 400);
}

console.log('A mensagem do Conta Azul:');
chk('o error, o message, a lista de errors, ou o código', motivoDoContaAzul({ dados: { error: 'X' } }) === 'X' && motivoDoContaAzul({ dados: { message: 'Y' } }) === 'Y'
  && motivoDoContaAzul({ dados: { errors: [{ message: 'a' }, { mensagem: 'b' }] } }) === 'a; b' && motivoDoContaAzul({ status: 502 }) === 'código 502');

console.log('Commit fixado na função (o código cru do GitHub):');
const idx = readFileSync(raiz + 'supabase/functions/ca-vendas/index.ts', 'utf8');
const m = /raw\.githubusercontent\.com\/macedo-reis-contabilidade\/macedo-reis-dashboards\/([0-9a-f]{40})\/supabase\/functions\/ca-vendas\/servidor\.js/.exec(idx);
chk('index.ts importa o servidor do repositório num commit fixado, com o waitUntil', !!m && /EdgeRuntime\.waitUntil/.test(idx));
function importados(inicio) {
  const vistos = new Set(), fila = [inicio];
  while (fila.length) {
    const a = fila.shift();
    if (vistos.has(a)) continue;
    vistos.add(a);
    const fonte = readFileSync(raiz + a, 'utf8');
    for (const im of fonte.matchAll(/(?:import|export)\s[^'"]*?from\s*['"](\.{1,2}\/[^'"]+)['"]/g)) fila.push(posix.normalize(posix.join(posix.dirname(a), im[1])));
  }
  return [...vistos];
}
const ARQS = importados('supabase/functions/ca-vendas/servidor.js');
chk('a trava segue os imports: o servidor, as regras do adicional, as datas e a equipe', ['assets/js/adicional-anual.js', 'assets/js/rescisao-datas.js', 'assets/js/equipe.js'].every(a => ARQS.includes(a)), ARQS.join(', '));
if (m) {
  const atrasados = ARQS.filter(a => {
    let noCommit = null;
    try { noCommit = execFileSync('git', ['show', m[1] + ':' + a], { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 24 }); } catch (e) { noCommit = null; }
    return noCommit === null || noCommit.replace(/\r\n/g, '\n') !== readFileSync(raiz + a, 'utf8').replace(/\r\n/g, '\n');
  });
  chk('o código que a função roda é o daqui', atrasados.length === 0,
    'mudaram depois do commit ' + m[1].slice(0, 7) + ': ' + atrasados.join(', ') + ' — publique, fixe o commit novo em index.ts e reimplante a função ca-vendas');
}
const codigo = a => readFileSync(raiz + a, 'utf8').replace(/^\s*\/\/.*$/gm, '');
chk('a função não renova o token do Conta Azul nem lê credenciais', !/oauth2\/token|refresh_token|credenciais/.test(codigo('supabase/functions/ca-vendas/servidor.js')));

console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
