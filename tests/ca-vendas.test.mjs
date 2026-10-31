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
    ca_baixas: [{ conta_financeira_id: U(302), conta_financeira: 'BANCO INTER - CONTA CORRENTE', data_pagamento: '2026-05-10' },
      { conta_financeira_id: U(305), conta_financeira: 'SICREDI CONTA CORRENTE', data_pagamento: '2026-06-10' },
      { conta_financeira_id: U(305), conta_financeira: 'SICREDI CONTA CORRENTE', data_pagamento: '2026-07-10' }],
    clientes: [
      { id: U(101), nome_principal: 'LOJA DO PAULO LTDA', documento: '11.111.111/0001-11', status: 'ativo' },
      { id: U(109), nome_principal: 'COM BOLETO LTDA', documento: '99999999000199', status: 'ativo' },
      { id: U(110), nome_principal: 'BOLETO EMITIDO LTDA', documento: '10101010000110', status: 'ativo' },
      { id: U(199), nome_principal: 'COM BOLETO (ANTIGO)', documento: '99999999000199', status: 'inativo' },
      { id: U(102), nome_principal: 'PADARIA NOVA LTDA', nome_fantasia: null, documento: '22222222000122', status: 'ativo' },
      { id: U(120), nome_principal: 'REDE SABOR UNIDADE CENTRO LTDA', nome_fantasia: 'REDE SABOR', documento: '12121212000112', status: 'ativo' },
      { id: U(121), nome_principal: 'REDE SABOR UNIDADE PRAIA LTDA', nome_fantasia: 'REDE SABOR', documento: '12121212000203', status: 'ativo' },
      // as que entraram em outubro (o contrato da mensalidade): uma sem cadastro no Conta Azul e sem endereço; outra já lá
      { id: U(130), nome_principal: 'METALIZADORA NOVA LTDA', nome_fantasia: 'METAL NOVA', documento: '30.303.030/0001-30', tipo_pessoa: 'PJ', status: 'em_transicao',
        email_principal: null, telefone_principal: '(51) 99999-0000', cep: null, logradouro: null, numero: null, complemento: null, bairro: null, cidade: 'Igrejinha', uf: 'RS' },
      { id: U(131), nome_principal: 'INDUSTRIA DE TESTE LTDA', nome_fantasia: null, documento: '31313131000131', tipo_pessoa: 'PJ', status: 'em_transicao',
        email_principal: 'contato@teste.com.br', telefone_principal: '5133330000', cep: '95660-000', logradouro: 'RUA DE TESTE', numero: '10', complemento: null, bairro: 'CENTRO', cidade: 'Três Coroas', uf: 'RS' }
    ],
    cobrancas_config: [{ cliente_id: U(130), valor_base: 1500, dia_vencimento: 10, ativo: true }, { cliente_id: U(131), valor_base: 450, dia_vencimento: 15, ativo: true }],
    precificacoes: [{ cliente_id: U(131), honorario: 750, status: 'fechada', criado_em: '2026-09-28T10:00:00Z' }, { cliente_id: U(131), honorario: 600, status: 'perdida', criado_em: '2026-09-29T10:00:00Z' }],
    carteira_info: [{ cliente_id: U(130), entrada: '2026-10-01', saida: null }, { cliente_id: U(131), entrada: '2026-10-01', saida: null }],
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
    pessoas: [{ id: P.paulo, nome: 'LOJA DO PAULO LTDA', documento: '11111111000111' }, { id: P.boleto, nome: 'COM BOLETO LTDA', documento: '99999999000199' },
      { id: P.emitido, nome: 'BOLETO EMITIDO LTDA', documento: '10101010000110' }, { id: P.padaria, nome: 'PADARIA NOVA', documento: '' },
      { id: U(20), nome: 'REDE SABOR', documento: '' }, { id: U(31), nome: 'INDUSTRIA DE TESTE LTDA', documento: '31313131000131' }],
    // os contratos: dois ativos (o de cima é o modelo) e um inativo da indústria (não conta)
    contratos: [
      { id: U(501), numero: 402, status: 'ATIVO', cliente: { id: U(32), nome: 'CLIENTE MODELO LTDA' }, total: 850 },
      { id: U(502), numero: 401, status: 'ATIVO', cliente: { id: U(33), nome: 'OUTRO CLIENTE LTDA' }, total: 750 },
      { id: U(503), numero: 300, status: 'INATIVO', cliente: { id: U(31), nome: 'INDUSTRIA DE TESTE LTDA' }, total: 280 }
    ],
    contratoDetalhe: new Map([
      [U(501), { id: U(501), id_ultima_venda_confirmada: U(511), cliente: { id: U(32), nome: 'CLIENTE MODELO LTDA' }, vendedor: { id: U(521), nome: 'DIEGO REIS' }, termos: { numero: 402, dia_emissao_venda: 31 } }],
      [U(502), { id: U(502), id_ultima_venda_confirmada: U(512), cliente: { id: U(33), nome: 'OUTRO CLIENTE LTDA' }, vendedor: { id: U(522), nome: 'SAMUEL REIS' }, termos: { numero: 401, dia_emissao_venda: 31 } }]
    ]),
    proximoContrato: 403,
    contratosCriados: [],
    pessoasCriadas: [],
    exigirPagamento: false,
    vendas: new Map(),
    proximo: 190421459,
    proximosForcados: [],
    criadas: [],
    protegidas: new Set(),
    recusar: new Set([P.recusa]),
    chamadas: []
  };
  // a venda modelo (a de 2025 da loja)
  contaAzul.vendas.set(U(401), { numero: 190419223, data: '2025-10-31', pessoa: P.paulo, categoria: CAT.adicional, detalhe: { cliente: { uuid: P.paulo, nome: 'LOJA DO PAULO LTDA' }, vendedor: { id: U(301), nome: 'Contador' },
    venda: { id: U(401), numero: 190419223, data_compromisso: '2025-10-31', id_categoria: CAT.adicional, id_centro_custo: null, situacao: { nome: 'APROVADO' },
      condicao_pagamento: { tipo_pagamento: null, id_conta_financeira: U(302), opcao_condicao_pagamento: '1x' } } },
    itens: { itens: [{ id: U(402), id_item: U(303), nome: 'HONORÁRIO ADICIONAL ANUAL', tipo: 'SERVICO', quantidade: 1, valor: 530 }] } });
  for (const [id, p, numero] of [[U(411), P.boleto, 190419224], [U(412), P.emitido, 190419225]])
    contaAzul.vendas.set(id, { numero, data: '2025-10-31', pessoa: p, categoria: CAT.adicional, detalhe: { venda: { id, numero, id_categoria: CAT.adicional, condicao_pagamento: { id_conta_financeira: U(305) } } }, itens: { itens: [] } });
  // a última venda dos contratos: a mensalidade (o serviço HONORÁRIOS MENSAIS), na conta do Inter
  for (const [id, numero] of [[U(511), 190421457], [U(512), 190421458]])
    contaAzul.vendas.set(id, { numero, detalhe: { venda: { id, numero, id_categoria: CAT.mensal, condicao_pagamento: { id_conta_financeira: U(302) } } },
      itens: { itens: [{ id: U(530), id_item: U(531), nome: 'HONORÁRIOS MENSAIS', tipo: 'SERVICO', quantidade: 1, valor: 850 }] } });
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
      const email = { 'tok-samuel': 'financeiro@macedoereis.com.br', 'tok-diego': 'diego@macedoereis.com.br', 'tok-thalia': 'fiscal@macedoereis.com.br', 'tok-fora': 'alguem@gmail.com' }[t];
      return email ? resposta(200, { email }) : resposta(401, { msg: 'invalid' });
    }
    if (url.startsWith(URLB + '/functions/v1/ca-sync')) return resposta(200, { ok: true });
    if (url.startsWith(URLB + '/rest/v1/')) {
      const u = new URL(url); const tabela = u.pathname.replace('/rest/v1/', '');
      const linhas = db[tabela]; if (!linhas) throw new Error('tabela desconhecida: ' + tabela);
      // como o PostgREST do Supabase: no máximo mil linhas por consulta (mesmo com limit maior), com order, limit e offset
      if (metodo === 'GET') {
        let achadas = filtrar(linhas, u.searchParams);
        const ordem = u.searchParams.get('order');
        if (ordem) { const [col, dir] = ordem.split('.'); achadas = [...achadas].sort((x, y) => (String(x[col]) < String(y[col]) ? -1 : String(x[col]) > String(y[col]) ? 1 : 0) * (dir === 'desc' ? -1 : 1)); }
        const de = Number(u.searchParams.get('offset') || 0), quantas = Math.min(Number(u.searchParams.get('limit') || 1000), 1000);
        return resposta(200, achadas.slice(de, de + quantas));
      }
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
      if (caminho === '/v1/pessoas' && metodo === 'POST') {
        if (!corpo.nome || !corpo.tipo_pessoa) return resposta(400, { error: 'nome e tipo_pessoa são obrigatórios' });
        const id = novoId();
        contaAzul.pessoasCriadas.push(corpo);
        contaAzul.pessoas.push({ id, nome: corpo.nome, documento: corpo.cnpj || corpo.cpf || '' });
        return resposta(201, { id, nome: corpo.nome, origem: 'API' });
      }
      if (caminho === '/v1/pessoas') { const tam = Number(sp.get('tamanho_pagina')), pag = Number(sp.get('pagina')); return resposta(200, { totalItems: contaAzul.pessoas.length, items: contaAzul.pessoas.slice((pag - 1) * tam, pag * tam) }); }
      // os contratos: no máximo 50 por página; a lista exige o início da recorrência
      if (caminho === '/v1/contratos' && metodo === 'GET') {
        if (!sp.get('data_inicio')) return resposta(400, { error: 'Data de início da recorrência não pode ser nula' });
        const tam = Math.min(Number(sp.get('tamanho_pagina')), 50), pag = Number(sp.get('pagina'));
        return resposta(200, { itens_totais: contaAzul.contratos.length, itens: contaAzul.contratos.slice((pag - 1) * tam, pag * tam) });
      }
      if (caminho === '/v1/contratos/proximo-numero') return resposta(200, contaAzul.proximoContrato);
      if (caminho === '/v1/contratos' && metodo === 'POST') {
        const t = corpo.termos || {}, cp = corpo.condicao_pagamento || {}, it = (corpo.itens || [])[0] || {};
        if (!corpo.id_cliente || !t.data_inicio || !t.data_fim || !t.dia_emissao_venda || !t.numero || !t.tipo_expiracao || !t.tipo_frequencia || !t.intervalo_frequencia
          || !cp.dia_vencimento || !cp.primeira_data_vencimento || !it.id || !(it.valor > 0)) return resposta(400, { error: 'campos obrigatórios' });
        if (contaAzul.exigirPagamento && !cp.tipo_pagamento) return resposta(400, { error: 'condicao_pagamento.tipo_pagamento: forma de pagamento obrigatória' });
        if (contaAzul.contratos.some(k => k.numero === t.numero)) return resposta(400, { error: 'Já existe um contrato com este número' });
        const id = novoId();
        contaAzul.contratos.push({ id, numero: t.numero, status: 'ATIVO', cliente: { id: corpo.id_cliente }, total: it.valor });
        contaAzul.contratosCriados.push(corpo);
        contaAzul.proximoContrato++;
        return resposta(201, { id, id_legado: 9, id_venda: novoId() });
      }
      const mc = /^\/v1\/contratos\/([0-9a-f-]{36})$/.exec(caminho);
      if (mc) { const d = contaAzul.contratoDetalhe.get(mc[1]); return d ? resposta(200, d) : resposta(404, { error: 'contrato não encontrado' }); }
      if (caminho === '/v1/venda/busca') {
        if (sp.get('termo_busca')) { const n = Number(sp.get('termo_busca')); return resposta(200, { itens: [...contaAzul.vendas.entries()].filter(([, v]) => v.numero === n).map(([id, v]) => ({ id, numero: v.numero })) }); }
        const lista = [...contaAzul.vendas.entries()].filter(([, v]) => v.data && v.data >= sp.get('data_inicio') && v.data <= sp.get('data_fim') && (!sp.get('ids_categorias') || v.categoria === sp.get('ids_categorias')))
          .map(([id, v]) => ({ id, numero: v.numero, data: v.data, cliente: { id: v.pessoa } }));
        const tam = Number(sp.get('tamanho_pagina')), pag = Number(sp.get('pagina'));
        return resposta(200, { total_itens: lista.length, itens: lista.slice((pag - 1) * tam, pag * tam) });
      }
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
    // a Receita (BrasilAPI): o endereço de quem não tem no cadastro
    if (url.startsWith('https://brasilapi.com.br/api/cnpj/v1/'))
      return resposta(200, { cep: '95690000', descricao_tipo_de_logradouro: 'RUA', logradouro: 'DAS FLORES', numero: '100', complemento: 'SALA 2', bairro: 'CENTRO', municipio: 'IGREJINHA', uf: 'RS' });
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
  // o lançamento a pedido de um sócio (31/10/2026) ficou aberto só durante o lote de 2026: o pedido no corpo não vale
  const aPedido = await w.pedir({ modo: 'lancar', competencia: '2026-10', itens: [], a_pedido_de: 'financeiro@macedoereis.com.br' }, { token: null, sync: 'chave-sync' });
  chk('o "a pedido de um sócio" no corpo não abre o lançamento: 403', aPedido.status === 403 && /só a consulta/.test(aPedido.corpo.erro));
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
  chk('a venda modelo: a do lote de 2025 (a que não existe mais ou sem serviço fica de lado), com o serviço e a conta',
    J(r.corpo.modelo) === J({ numero: 190419223, data: '2025-10-31', cliente: 'LOJA DO PAULO LTDA', servico: 'HONORÁRIO ADICIONAL ANUAL', vendedor: 'Contador', conta: 'BANCO INTER - CONTA CORRENTE' }), J(r.corpo.modelo));
  chk('a conta de cada uma: com o boleto na grade, a do Inter (até a do boleto já emitido); sem ele, a do adicional do ano passado; sem nada, a da modelo',
    J(it(w.P.boleto).conta) === J({ id: U(302), nome: 'BANCO INTER - CONTA CORRENTE', de: 'boleto' }) && it(w.P.emitido).conta.de === 'boleto'
    && J(it(w.P.paulo).conta) === J({ id: U(302), nome: 'BANCO INTER - CONTA CORRENTE', de: 'ano_anterior' }) && it(w.P.isenta).conta.de === 'modelo', J([it(w.P.boleto).conta, it(w.P.paulo).conta, it(w.P.isenta).conta]));
  chk('as contas pra escolher, pelo nome', J(r.corpo.contas) === J([{ id: U(302), nome: 'BANCO INTER - CONTA CORRENTE' }, { id: U(305), nome: 'SICREDI CONTA CORRENTE' }]), J(r.corpo.contas));
  chk('sem CNPJ no Conta Azul, a empresa do cadastro pelo nome', it(w.P.padaria).cliente_id === U(102));
  chk('a data da venda e o resumo', r.corpo.data_venda === '2026-10-31' && r.corpo.resumo.marcadas === 5 && r.corpo.boletos === 2, J(r.corpo.resumo));
  chk('sem aviso de boleto (a competência já está na grade)', !r.corpo.avisos.some(a => /ainda não foi gerada/.test(a)));
  chk('nenhuma venda criada na consulta', w.contaAzul.criadas.length === 0 && !w.contaAzul.chamadas.some(c => c.startsWith('POST')));
  w.db.cobrancas_mensais.length = 0;
  const sem = await w.pedir({ modo: 'prever', competencia: '2026-10' });
  chk('sem a competência na grade de Boletos: o aviso pra gerar antes', sem.corpo.avisos.some(a => /10\/2026 ainda não foi gerada em Boletos/.test(a)));
  chk('… e, sem o boleto, a conta é a do adicional do ano passado (o Sicredi)', J(sem.corpo.itens.find(i => i.pessoa === w.P.boleto).conta) === J({ id: U(305), nome: 'SICREDI CONTA CORRENTE', de: 'ano_anterior' }));
  // o lote já lançado (duas ou mais vendas do sistema na competência): o resto desmarcado, e o aviso do boleto muda
  for (const n of [1, 2]) w.db.ca_vendas_lancadas.push({ id: U(780 + n), tipo: 'adicional_anual', competencia: '2026-10', ca_cliente_id: U(880 + n), cliente_nome: 'JA LANCADA ' + n,
    valor: 100, vencimento: '2026-11-10', situacao: 'lancada', lancada_em: '2026-10-31T20:00:00Z', atualizada_em: '2026-10-31T20:00:00Z' });
  const depois = await w.pedir({ modo: 'prever', competencia: '2026-10' });
  chk('com o lote lançado: o aviso em cima, o resto desmarcado e o boleto entra sozinho quando gerar',
    /já foi lançado pelo sistema/.test(depois.corpo.avisos[0]) && depois.corpo.resumo.marcadas === 0 && depois.corpo.resumo.lote_lancado
      && depois.corpo.avisos.some(a => /10\/2026 ainda não foi gerada em Boletos: quando for, o adicional já lançado entra sozinho/.test(a)) && !depois.corpo.avisos.some(a => /Gere antes de lançar/.test(a)), J(depois.corpo.avisos));
  w.db.ca_vendas_lancadas.length = 0;
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
    { pessoa: w.P.emitido, nome: 'BOLETO EMITIDO LTDA', valor: 700, vencimento: '2026-11-10', conta: U(305) },
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
  chk('a conta que veio da lista vai na venda (sem ela, a da modelo)', w.contaAzul.criadas[2].condicao_pagamento.id_conta_financeira === U(305) && w.contaAzul.criadas[0].condicao_pagamento.id_conta_financeira === U(302));
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

console.log('A empresa do cadastro pelo nome: só quando uma bate');
{
  const w = mundo();
  const r = await w.pedir({ modo: 'lancar', competencia: '2026-10', modelo: 190419223, itens: [{ pessoa: U(20), nome: 'REDE SABOR', valor: 300, vencimento: '2026-11-10' }] });
  chk('duas unidades com o mesmo nome: lança a venda, mas não chuta o boleto', r.corpo.resultados[0].ok && !r.corpo.resultados[0].boleto.posto && /não foi achada no cadastro/.test(r.corpo.resultados[0].boleto.motivo)
    && w.db.ca_vendas_lancadas[0].cliente_id === null, J(r.corpo.resultados[0]));
}

console.log('O cadastro com mais de mil empresas (o banco devolve mil por vez):');
{
  const w = mundo();
  // 1.100 empresas inventadas antes, pela ordem do id: a loja e as outras ficam depois das primeiras mil linhas
  w.db.clientes.unshift(...Array.from({ length: 1100 }, (_, n) => ({ id: '0a000000-0000-4000-8000-' + String(n).padStart(12, '0'), nome_principal: 'OUTRA EMPRESA ' + n + ' LTDA', documento: String(10000000000000 + n), status: 'ativo' })));
  const r = await w.pedir({ modo: 'prever', competencia: '2026-10' });
  const it = p => r.corpo.itens.find(i => i.pessoa === p);
  chk('a empresa depois das primeiras mil linhas é achada (pelo CNPJ e pelo nome)', it(w.P.paulo).cliente_id === U(101) && it(w.P.padaria).cliente_id === U(102), J([it(w.P.paulo).cliente_id, it(w.P.padaria).cliente_id]));
  const pags = w.chamadas.filter(c => c.url.includes('/rest/v1/clientes?')).map(c => new URL(c.url).searchParams.get('offset'));
  chk('o cadastro lido em páginas de mil, pela ordem do id', pags.join(',') === '0,1000' && w.chamadas.some(c => c.url.includes('/rest/v1/clientes?') && /order=id\.asc/.test(c.url)), pags.join(','));
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

console.log('A venda excluída direto no Conta Azul:');
{
  const w = mundo();
  const r = await w.pedir({ modo: 'lancar', competencia: '2026-10', modelo: 190419223, itens: [
    { pessoa: w.P.boleto, nome: 'COM BOLETO LTDA', valor: 600, vencimento: '2026-11-09' }, { pessoa: w.P.paulo, nome: 'LOJA DO PAULO LTDA', valor: 580, vencimento: '2026-11-10' },
    { pessoa: w.P.emitido, nome: 'BOLETO EMITIDO LTDA', valor: 700, vencimento: '2026-11-10' }] });
  const linha = p => w.db.ca_vendas_lancadas.find(l => l.ca_cliente_id === p);
  const tirarDoCA = (p, tambemAVenda) => {
    const n = linha(p).ca_venda_numero;
    w.contaAzul.parcelas = w.contaAzul.parcelas.filter(x => x.descricao !== 'Venda ' + n);
    if (tambemAVenda) w.contaAzul.vendas.delete(linha(p).ca_venda_id);
  };
  const velho = new Date(AGORA.getTime() - 10 * 60 * 1000).toISOString();
  // a do boleto: excluída no Conta Azul há 10 minutos · a da loja: a parcela ainda não aparece na lista, mas a venda existe
  // · a do boleto emitido: excluída agora mesmo (pode ser a lista atrasada: espera a próxima)
  tirarDoCA(w.P.boleto, true); linha(w.P.boleto).atualizada_em = velho;
  tirarDoCA(w.P.paulo, false); linha(w.P.paulo).atualizada_em = velho;
  tirarDoCA(w.P.emitido, true);
  const lista = await w.pedir({ modo: 'prever', competencia: '2026-10' });
  chk('conferida pelo id: a linha vira "excluida" (pelo Conta Azul) e o extra sai do boleto, o faturável fica',
    linha(w.P.boleto).situacao === 'excluida' && linha(w.P.boleto).excluida_por === 'conta_azul'
    && J(w.db.cobrancas_mensais.find(b => b.id === U(209)).itens_extras.map(x => x.faturavel_id || x.adicional_id)) === J([U(600)]), J(linha(w.P.boleto)));
  chk('… e a empresa volta à lista pra lançar de novo', lista.corpo.itens.find(i => i.pessoa === w.P.boleto).grupo === 'sugerida');
  chk('a venda que existe (só a lista atrasada) continua lançada', linha(w.P.paulo).situacao === 'lancada' && lista.corpo.itens.find(i => i.pessoa === w.P.paulo).grupo === 'lancada');
  chk('a lançada agora mesmo não é conferida (a lista do Conta Azul pode estar atrasada)', linha(w.P.emitido).situacao === 'lancada');
  const de2 = await w.pedir({ modo: 'lancar', competencia: '2026-10', modelo: 190419223, itens: [{ pessoa: w.P.boleto, nome: 'COM BOLETO LTDA', valor: 610, vencimento: '2026-11-09' }] });
  chk('lança de novo, com o valor corrigido, e o extra volta ao boleto', de2.corpo.resultados[0].ok && de2.corpo.resultados[0].boleto.posto
    && w.db.cobrancas_mensais.find(b => b.id === U(209)).itens_extras.some(x => x.adicional_id === de2.corpo.resultados[0].id && x.valor === 610), J(de2.corpo));
}

console.log('O contrato da mensalidade — a conferência (contrato_prever):');
{
  const w = mundo();
  const r = await w.pedir({ modo: 'contrato_prever', clientes: [U(130), U(131), 'nao-e-id'] }, { token: null, sync: 'chave-sync' });
  chk('a consulta com a chave do sincronismo: 200', r.status === 200, J(r.corpo));
  const it = id => r.corpo.itens.find(i => i.cliente_id === id);
  chk('o modelo: o contrato ativo mais recente da mensalidade, com o serviço', J(r.corpo.modelo) === J({ numero: 402, cliente: 'CLIENTE MODELO LTDA', servico: 'HONORÁRIOS MENSAIS' }), J(r.corpo.modelo));
  chk('a que não está no Conta Azul: sem pessoa, sem contrato, o valor e o dia da base, a partir da entrada (10/2026), a primeira em 10/11 e o fim do Conta Azul (+335 dias)',
    it(U(130)).pessoa === null && it(U(130)).contrato_ativo === null && it(U(130)).sugerido.valor === 1500 && it(U(130)).sugerido.dia === 10 && it(U(130)).sugerido.inicio === '2026-10'
    && it(U(130)).sugerido.primeiro_vencimento === '2026-11-10' && it(U(130)).sugerido.data_fim === '2027-09-01' && it(U(130)).documento === '30303030000130', J(it(U(130))));
  chk('com a base ativa, a conta do Inter', J(it(U(130)).conta) === J({ id: U(302), nome: 'BANCO INTER - CONTA CORRENTE' }), J(it(U(130)).conta));
  chk('a que já está no Conta Azul (pelo CNPJ), com um contrato inativo: a pessoa, sem contrato ativo, o valor da proposta fechada (não a perdida) e o dia 15',
    it(U(131)).pessoa.id === U(31) && it(U(131)).contrato_ativo === null && it(U(131)).sugerido.valor === 750 && it(U(131)).sugerido.de.valor === 'proposta' && it(U(131)).sugerido.dia === 15
    && it(U(131)).sugerido.primeiro_vencimento === '2026-11-15', J(it(U(131))));
  chk('o id que não é id fica de fora; sem login de sócio, sem vendedor', r.corpo.itens.length === 2 && r.corpo.vendedor === null);
  chk('nada criado na conferência', !w.contaAzul.chamadas.some(c => c.startsWith('POST')) && w.contaAzul.contratosCriados.length === 0);
  chk('a lista dos contratos pede o início da recorrência, 50 por página', w.chamadas.filter(c => c.url.includes('/v1/contratos?')).every(c => /data_inicio=/.test(c.url) && /tamanho_pagina=50/.test(c.url)));
  const s = await w.pedir({ modo: 'contrato_prever', clientes: [U(130)] });
  chk('com o login do Samuel, o vendedor é ele (pelo nome, entre os vendedores dos contratos)', J(s.corpo.vendedor) === J({ id: U(522), nome: 'SAMUEL REIS' }), J(s.corpo.vendedor));
  chk('nenhuma empresa: 400', (await w.pedir({ modo: 'contrato_prever', clientes: [] })).status === 400);
  const thalia = await w.pedir({ modo: 'contrato_prever', clientes: [U(130)] }, { token: 'tok-thalia' });
  chk('da equipe, mas não sócio: 403', thalia.status === 403);
}

console.log('O contrato da mensalidade — criar (contrato):');
{
  const w = mundo();
  const pedido = { modo: 'contrato', itens: [{ cliente_id: U(130), valor: 1500, dia: 10, inicio: '2026-10' }, { cliente_id: U(131), valor: 750, dia: 15, inicio: '2026-10' }] };
  const semSocio = await w.pedir(pedido, { token: null, sync: 'chave-sync' });
  chk('com a chave do sincronismo, sem um sócio: 403', semSocio.status === 403 && /só a consulta/.test(semSocio.corpo.erro));
  chk('o pedido de quem não é sócio no corpo não vale', (await w.pedir({ ...pedido, a_pedido_de: 'fiscal@macedoereis.com.br' }, { token: null, sync: 'chave-sync' })).status === 403);
  chk('da equipe, mas não sócio: 403', (await w.pedir(pedido, { token: 'tok-thalia' })).status === 403);
  chk('nada criado até aqui', w.contaAzul.contratosCriados.length === 0 && w.contaAzul.pessoasCriadas.length === 0);
  const r = await w.pedir(pedido);
  chk('com o login do Samuel: 200, as duas criadas', r.status === 200 && r.corpo.resultados.length === 2 && r.corpo.resultados.every(x => x.ok), J(r.corpo));
  const res = id => r.corpo.resultados.find(x => x.cliente_id === id);
  const pessoa = w.contaAzul.pessoasCriadas[0];
  chk('a que não estava no Conta Azul: o cadastro, com a razão social, o CNPJ, o fantasia, o telefone, o perfil Cliente e o endereço da Receita (a cidade do cadastro)',
    w.contaAzul.pessoasCriadas.length === 1 && J(pessoa) === J({ nome: 'METALIZADORA NOVA LTDA', tipo_pessoa: 'Jurídica', cnpj: '30303030000130', nome_fantasia: 'METAL NOVA', telefone_comercial: '51999990000',
      enderecos: [{ cep: '95690000', logradouro: 'RUA DAS FLORES', numero: '100', complemento: 'SALA 2', bairro: 'CENTRO', cidade: 'Igrejinha', estado: 'RS', pais: 'Brasil' }], perfis: [{ tipo_perfil: 'Cliente' }] })
    && res(U(130)).pessoa_criada, J(pessoa));
  const k1 = w.contaAzul.contratosCriados[0], k2 = w.contaAzul.contratosCriados[1];
  chk('o contrato: mensal, sem fim (NUNCA), do mês de entrada, a venda no dia 31, o vencimento no dia da base a partir do mês seguinte, na conta do Inter, sem forma de pagamento, o serviço e a categoria da mensalidade e o Samuel de vendedor',
    k1.id_cliente === res(U(130)).pessoa && J(k1.termos) === J({ data_inicio: '2026-10-01', data_fim: '2027-09-01', dia_emissao_venda: 31, intervalo_frequencia: 1, numero: 403, tipo_expiracao: 'NUNCA', tipo_frequencia: 'MENSAL' })
    && J(k1.condicao_pagamento) === J({ dia_vencimento: 10, primeira_data_vencimento: '2026-11-10', id_conta_financeira: U(302) })
    && J(k1.itens) === J([{ id: U(531), quantidade: 1, valor: 1500 }]) && k1.id_categoria === CAT.mensal && k1.id_vendedor === U(522), J(k1));
  chk('a que já estava no Conta Azul (com o contrato antigo inativo): sem cadastro novo, o contrato seguinte (404) na pessoa de lá, 750 no dia 15',
    !res(U(131)).pessoa_criada && k2.id_cliente === U(31) && k2.termos.numero === 404 && k2.itens[0].valor === 750 && k2.condicao_pagamento.primeira_data_vencimento === '2026-11-15', J(k2));
  chk('o resultado: o número, o vendedor e quem pediu', res(U(130)).contrato.numero === 403 && res(U(130)).vendedor === 'SAMUEL REIS' && res(U(130)).por === 'financeiro@macedoereis.com.br', J(res(U(130))));
  const de2 = await w.pedir(pedido);
  chk('de novo: as duas já têm contrato ativo, nada criado', de2.corpo.resultados.every(x => !x.ok && /já tem o contrato 40[34] ativo/.test(x.erro)) && w.contaAzul.contratosCriados.length === 2 && w.contaAzul.pessoasCriadas.length === 1, J(de2.corpo));
  w.db.clientes.push({ id: U(132), nome_principal: 'SEM DOCUMENTO LTDA', documento: null, status: 'ativo' });
  const erros = await w.pedir({ modo: 'contrato', itens: [{ cliente_id: U(130), valor: 0, dia: 10, inicio: '2026-10' }, { cliente_id: U(130), valor: 100, dia: 32, inicio: '2026-10' },
    { cliente_id: U(130), valor: 100, dia: 10, inicio: '2026-07' }, { cliente_id: 'x', valor: 100, dia: 10, inicio: '2026-10' }, { cliente_id: U(132), valor: 100, dia: 10, inicio: '2026-10' }] });
  chk('o pedido que não serve: o motivo de cada um (o valor, o dia, o início longe demais, o id, o cadastro sem CNPJ), sem chegar ao Conta Azul',
    /maior que zero/.test(erros.corpo.resultados[0].erro) && /de 1 a 31/.test(erros.corpo.resultados[1].erro) && /mês passado ao que vem/.test(erros.corpo.resultados[2].erro) && /inválida/.test(erros.corpo.resultados[3].erro)
    && /sem o CNPJ ou o CPF/.test(erros.corpo.resultados[4].erro) && w.contaAzul.contratosCriados.length === 2 && w.contaAzul.pessoasCriadas.length === 1, J(erros.corpo));
  chk('mais de 5 por vez: 400', (await w.pedir({ modo: 'contrato', itens: Array.from({ length: 6 }, () => pedido.itens[0]) })).status === 400);
}

console.log('O contrato da mensalidade — a forma de pagamento, se o Conta Azul exigir:');
{
  const w = mundo();
  w.contaAzul.exigirPagamento = true;
  const r = await w.pedir({ modo: 'contrato', itens: [{ cliente_id: U(131), valor: 750, dia: 15, inicio: '2026-10' }] });
  chk('a primeira tentativa sem a forma, a segunda com boleto', r.corpo.resultados[0].ok && w.contaAzul.contratosCriados.length === 1 && w.contaAzul.contratosCriados[0].condicao_pagamento.tipo_pagamento === 'BOLETO_BANCARIO'
    && w.contaAzul.chamadas.filter(c => c === 'POST /v1/contratos').length === 2, J(r.corpo));
}

console.log('O contrato da mensalidade — com o Diego:');
{
  const w = mundo();
  const r = await w.pedir({ modo: 'contrato', a_pedido_de: 'financeiro@macedoereis.com.br', itens: [{ cliente_id: U(131), valor: 750, dia: 15, inicio: '2026-10' }] }, { token: 'tok-diego' });
  chk('com o login do Diego: cria, com ele de vendedor (o "a pedido de" no corpo não muda quem pediu)', r.status === 200 && r.corpo.resultados[0].ok && r.corpo.resultados[0].por === 'diego@macedoereis.com.br'
    && w.contaAzul.contratosCriados[0].id_vendedor === U(521), J(r.corpo));
  const sync = await w.pedir({ modo: 'contrato', a_pedido_de: 'diego@macedoereis.com.br', itens: [{ cliente_id: U(130), valor: 1500, dia: 10, inicio: '2026-10' }] }, { token: null, sync: 'chave-sync' });
  chk('com a chave do sincronismo, nem a pedido de um sócio: 403, nada criado', sync.status === 403 && w.contaAzul.contratosCriados.length === 1 && w.contaAzul.pessoasCriadas.length === 0);
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
