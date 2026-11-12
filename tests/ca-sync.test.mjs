// A função ca-sync (o espelho do Conta Azul) — o index.ts de verdade, rodado no node com um banco, um relógio e um Conta
// Azul de mentira. O Conta Azul de mentira recusa, como o de verdade desde 12/11/2026, a busca de contas a receber e a
// pagar com mais de 365 dias entre as datas de vencimento, de pagamento ou de alteração (a v7 pedia de 2024 a 2036 de
// uma vez, e o espelho parou naquele dia). Confere: nenhum pedido largo nos três modos; as marcas do mês e do dia do
// pagamento contra uma conta independente, feita aqui pelas baixas de cada parcela (inclusive a paga de uma janela de
// vencimento distante, a atrasada de 2024 e a marca velha que tem de sair); o que entra no espelho pela varredura; os
// pedidos, no máximo 4 juntos; o 5xx, a queda da rede e o 429 tentados de novo; e o erro que fica no registro.
// O node precisa ler TypeScript (22.18 em diante); sem isso, o teste avisa e não roda.
// Os nomes e os ids são de mentira (o repositório é público). Rodar com: node tests/ca-sync.test.mjs
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

if (!process.features.typescript) {
  console.log('Este node (' + process.version + ') não lê TypeScript: o teste da ca-sync precisa do 22.18 em diante. Não rodou.');
  process.exit(0);
}

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + extra : '')); };
const J = x => JSON.stringify(x);
const raiz = fileURLToPath(new URL('../', import.meta.url));


const CHAVE = 'chave-do-sincronismo';
const API = 'https://api-v2.contaazul.com';

// ---------- o relógio ----------
const DataReal = Date;
let agoraMs = DataReal.UTC(2026, 10, 12, 18, 25, 0);
class DataFalsa extends DataReal {
  constructor(...a) { if (a.length === 0) super(agoraMs); else super(...a); }
  static now() { return agoraMs; }
}
function instalarRelogio() { globalThis.Date = DataFalsa; }
function acertarRelogio(iso) { agoraMs = DataReal.parse(iso); }
function andarRelogio(ms) { agoraMs += ms; }
const agoraIso = () => new DataReal(agoraMs).toISOString();

// as esperas da função (o 429 e o 5xx) não seguram o teste
const esperaReal = globalThis.setTimeout;
function encurtarEsperas() { globalThis.setTimeout = (fn, ms, ...r) => esperaReal(fn, Math.min(Number(ms) || 0, 2), ...r); }

// ---------- o banco ----------
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
class Consulta {
  constructor(db, tabela) { this.db = db; this.t = tabela; this.f = []; this.o = []; this.lim = null; this.faixa = null; this.op = 'select'; this.unico = false; this.devolve = false; }
  get linhas() { if (!this.db[this.t]) throw new Error('tabela fora do banco de mentira: ' + this.t); return this.db[this.t]; }
  select() { if (this.op !== 'select') this.devolve = true; return this; }
  insert(v) { this.op = 'insert'; this.v = v; return this; }
  update(v) { this.op = 'update'; this.v = v; return this; }
  upsert(v) { this.op = 'upsert'; this.v = v; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(c, v) { this.f.push(r => r[c] === v); return this; }
  is(c, v) { this.f.push(r => (r[c] ?? null) === v); return this; }
  gte(c, v) { this.f.push(r => r[c] != null && cmp(r[c], v) >= 0); return this; }
  lte(c, v) { this.f.push(r => r[c] != null && cmp(r[c], v) <= 0); return this; }
  gt(c, v) { this.f.push(r => r[c] != null && cmp(r[c], v) > 0); return this; }
  lt(c, v) { this.f.push(r => r[c] != null && cmp(r[c], v) < 0); return this; }
  in(c, vs) { const s = new Set(vs); this.f.push(r => s.has(r[c])); return this; }
  not(c, op, v) { if (op !== 'is' || v !== null) throw new Error('not() fora do previsto'); this.f.push(r => r[c] != null); return this; }
  order(c, o = {}) { this.o.push([c, o.ascending !== false]); return this; }
  limit(n) { this.lim = n; return this; }
  range(a, b) { this.faixa = [a, b]; return this; }
  single() { this.unico = true; return this; }
  then(ok, falha) { return Promise.resolve().then(() => this.rodar()).then(ok, falha); }
  rodar() {
    const casa = r => this.f.every(f => f(r));
    if (this.op === 'select') {
      let rs = this.linhas.filter(casa);
      if (this.o.length) rs = rs.slice().sort((a, b) => { for (const [c, asc] of this.o) { const d = cmp(a[c] ?? '', b[c] ?? ''); if (d) return asc ? d : -d; } return 0; });
      if (this.faixa) rs = rs.slice(this.faixa[0], this.faixa[1] + 1);
      if (this.lim != null) rs = rs.slice(0, this.lim);
      rs = rs.map(r => ({ ...r }));
      if (this.unico) return rs.length ? { data: rs[0], error: null } : { data: null, error: { message: 'nenhuma linha' } };
      return { data: rs, error: null };
    }
    if (this.op === 'insert') {
      const novos = (Array.isArray(this.v) ? this.v : [this.v]).map(v => {
        const r = { ...v };
        if (this.t === 'ca_sync_log') { r.id = this.linhas.length + 1; r.iniciado_em = new Date().toISOString(); r.concluido_em = null; r.sucesso = null; r.erro = null; }
        this.linhas.push(r);
        return r;
      });
      return { data: this.unico ? { ...novos[0] } : novos.map(r => ({ ...r })), error: null };
    }
    if (this.op === 'update') { this.linhas.filter(casa).forEach(r => Object.assign(r, this.v)); return { data: null, error: null }; }
    if (this.op === 'upsert') {
      for (const v of (Array.isArray(this.v) ? this.v : [this.v])) {
        const r = this.linhas.find(x => x.id === v.id);
        if (r) Object.assign(r, v); else this.linhas.push({ mes_pagamento: null, data_pagamento: null, ...v });
      }
      return { data: null, error: null };
    }
    if (this.op === 'delete') {
      const saem = this.linhas.filter(casa);
      this.db[this.t] = this.linhas.filter(r => !saem.includes(r));
      return { data: this.devolve ? saem.map(r => ({ ...r })) : null, error: null };
    }
    throw new Error('operação fora do previsto');
  }
}

// ---------- o mundo: as parcelas do Conta Azul e o espelho como estava ----------
let atual = null;
function usar(m) { atual = m; }
const sbFalso = { from: t => new Consulta(atual.db, t) };

function sorteio(semente) { let a = semente >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const U = (pre, n) => pre + '000000-0000-4000-8000-' + String(n).padStart(12, '0');
const dia = d => new DataReal(d).toISOString().slice(0, 10);
const somaDias = (iso, n) => dia(DataReal.parse(iso + 'T00:00:00Z') + n * 86400000);
const diasEntre = (a, b) => Math.round((DataReal.parse(b.slice(0, 10) + 'T00:00:00Z') - DataReal.parse(a.slice(0, 10) + 'T00:00:00Z')) / 86400000);

// hoje: 'AAAA-MM-DD' (o dia em São Paulo); n: quantas parcelas
function gerarParcelas({ semente = 7, hoje, n = 3000 }) {
  const r = sorteio(semente), entre = (a, b) => a + Math.floor(r() * (b - a + 1));
  const anoHoje = Number(hoje.slice(0, 4));
  const parcelas = [];
  for (let i = 1; i <= n; i++) {
    const natureza = r() < 0.58 ? 'receita' : 'despesa';
    const x = r();
    const ano = x < 0.05 ? 2024 : x < 0.30 ? 2025 : x < 0.68 ? 2026 : x < 0.82 ? 2027 : x < 0.90 ? 2028 : entre(2029, 2034);
    const venc = ano + '-' + String(entre(1, 12)).padStart(2, '0') + '-' + String(entre(1, 28)).padStart(2, '0');
    const total = entre(5000, 300000) / 100;
    const baixas = [];
    const paga = (data, valor) => baixas.push({ id: U('ba', i * 10 + baixas.length), data_pagamento: data, valor_composicao: { valor_bruto: valor, valor_liquido: valor, juros: 0, multa: 0, desconto: 0, taxa: 0 }, conta_financeira: { id: U('cf', 1), nome: 'Banco de mentira' }, metodo_pagamento: 'BOLETO' });
    const y = r();
    if (venc <= hoje) {
      if (y < 0.70) paga(somaDias(venc, entre(-8, 20)) > hoje ? hoje : somaDias(venc, entre(-8, 20)), total);       // no prazo, perto do vencimento
      else if (y < 0.80) paga(somaDias(hoje, -entre(0, 45)), total);                                                  // atrasada, paga agora
      else if (y < 0.86) { const m = Math.round(total * 40) / 100; paga(somaDias(hoje, -entre(30, 70)), m); paga(somaDias(hoje, -entre(0, 25)), Math.round((total - m) * 100) / 100); } // em duas vezes
      else if (y < 0.90) paga(somaDias(hoje, -entre(0, 50)), Math.round(total * 30) / 100);                          // parcial
    } else if (y < 0.05) paga(somaDias(hoje, -entre(0, 40)), total);                                                  // adiantada (o vencimento é futuro)
    else if (y < 0.07 && ano >= anoHoje + 2) paga(somaDias(hoje, -entre(0, 12)), Math.round(total * 50) / 100);     // parcial adiantada, de janela distante
    baixas.sort((a, b) => cmp(a.data_pagamento, b.data_pagamento));
    const pago = Math.round(baixas.reduce((s, b) => s + b.valor_composicao.valor_bruto, 0) * 100) / 100;
    const ultima = baixas.length ? baixas[baixas.length - 1].data_pagamento : null;
    // a alteração: o dia do último pagamento, ou a criação; umas poucas, mexidas agora há pouco
    let alteracao = (ultima || somaDias(venc, -entre(30, 400)) < hoje ? (ultima || somaDias(venc, -entre(30, 400))) : somaDias(hoje, -entre(20, 300))) + 'T10:00:00';
    if (alteracao.slice(0, 10) > hoje) alteracao = hoje + 'T08:00:00';
    const pessoa = { id: U('pe', entre(1, 150)), nome: 'Pessoa ' + entre(1, 150) };
    parcelas.push({
      id: U('pa', i), natureza, descricao: 'Parcela ' + i, data_vencimento: venc, data_competencia: venc.slice(0, 8) + '01', total, pago,
      nao_pago: Math.round((total - pago) * 100) / 100, baixas, data_criacao: '2024-01-02T09:00:00', data_alteracao: alteracao,
      [natureza === 'receita' ? 'cliente' : 'fornecedor']: pessoa, categorias: [{ id: U('ca', entre(1, 12)), nome: 'Categoria ' + entre(1, 12) }], centros_de_custo: []
    });
  }
  return parcelas;
}

const itemDaLista = p => {
  const { baixas, ...resto } = p;
  return { ...resto, status: p.nao_pago <= 0 ? 'ACQUITTED' : p.pago > 0 ? 'PARTIAL' : 'PENDING', status_traduzido: p.nao_pago <= 0 ? 'RECEBIDO' : 'EM_ABERTO' };
};
// a linha do espelho, como a função grava (o mapParcela dela)
function linhaDoEspelho(p, sincronizadoEm) {
  const it = itemDaLista(p);
  return {
    id: it.id, natureza: p.natureza, descricao: it.descricao ?? null, data_vencimento: it.data_vencimento ?? null, data_competencia: it.data_competencia ?? null,
    status: it.status ?? null, status_traduzido: it.status_traduzido ?? null, total: it.total ?? null, pago: it.pago ?? null, nao_pago: it.nao_pago ?? null,
    fornecedor_cliente_id: it.fornecedor?.id ?? it.cliente?.id ?? null, fornecedor_cliente_nome: it.fornecedor?.nome ?? it.cliente?.nome ?? null,
    categorias: it.categorias ?? null, centros_custo: it.centros_custo ?? it.centros_de_custo ?? null, data_criacao: it.data_criacao ?? null,
    data_alteracao: it.data_alteracao ?? null, dados: it, sincronizado_em: sincronizadoEm, mes_pagamento: null, data_pagamento: null
  };
}

const MSG = campo => JSON.stringify({ error: `O intervalo de data de ${campo} excede o limite máximo permitido de 365 dias. Reduza o período e tente novamente.` });
const PAGINAS = new Set(['10', '20', '50', '100', '200', '500', '1000']);

function criarMundo({ parcelas, espelho, baixasNoEspelho = [], log = [], limite365 = true, tokenMin = 50 }) {
  const m = {
    parcelas,
    db: {
      configuracoes_escritorio: [{ chave: 'ca_sync_key', valor: CHAVE }],
      ca_tokens: [{ id: 1, access_token: 'tok-ca', refresh_token: 'ref-ca', expires_at: new DataReal(agoraMs + tokenMin * 60000).toISOString() }],
      ca_sync_log: log.map(l => ({ ...l })),
      ca_parcelas: espelho.map(l => ({ ...l })),
      ca_baixas: baixasNoEspelho.map(l => ({ ...l })),
      ca_categorias: []
    },
    ca: { chamadas: [], agora: 0, maxJuntas: 0, falhar: [], limite365 }
  };
  m.ca.fetch = async (url, opc = {}) => {
    const u = new URL(String(url)), sp = u.searchParams, caminho = u.pathname;
    if (!String(url).startsWith(API)) throw new Error('pedido pra fora do Conta Azul: ' + url);
    const pedido = { caminho, params: Object.fromEntries(sp), n: m.ca.chamadas.length + 1 };
    m.ca.chamadas.push(pedido);
    m.ca.agora++; m.ca.maxJuntas = Math.max(m.ca.maxJuntas, m.ca.agora);
    await new Promise(r => setImmediate(r));
    m.ca.agora--;
    const resposta = (status, corpo) => {
      const texto = typeof corpo === 'string' ? corpo : JSON.stringify(corpo);
      pedido.status = status;
      return { ok: status >= 200 && status < 300, status, json: async () => JSON.parse(texto), text: async () => texto, body: { cancel: async () => {} } };
    };
    if ((opc.headers?.Authorization || opc.headers?.authorization) !== 'Bearer tok-ca') return resposta(401, { error: 'token inválido' });
    // as falhas encomendadas pelo teste: { casa(pedido), status | lancar, vezes }
    for (const f of m.ca.falhar) {
      if (f.vezes > 0 && f.casa(pedido)) { f.vezes--; if (f.lancar) { pedido.status = 'rede'; throw f.lancar; } return resposta(f.status, f.corpo ?? { error: 'Erro interno. Tente novamente.' }); }
    }
    const busca = caminho.match(/^\/v1\/financeiro\/eventos-financeiros\/contas-a-(receber|pagar)\/buscar$/);
    if (busca) {
      const natureza = busca[1] === 'receber' ? 'receita' : 'despesa';
      const vDe = sp.get('data_vencimento_de'), vAte = sp.get('data_vencimento_ate');
      if (!vDe || !vAte) return resposta(400, { error: 'data_vencimento_de e data_vencimento_ate são obrigatórios' });
      const pDe = sp.get('data_pagamento_de'), pAte = sp.get('data_pagamento_ate'), aDe = sp.get('data_alteracao_de'), aAte = sp.get('data_alteracao_ate');
      if (m.ca.limite365) {
        if (diasEntre(vDe, vAte) > 365) return resposta(400, MSG('vencimento'));
        if (pDe && pAte && diasEntre(pDe, pAte) > 365) return resposta(400, MSG('pagamento'));
        if (aDe && aAte && diasEntre(aDe, aAte) > 365) return resposta(400, MSG('alteração'));
      }
      if (!PAGINAS.has(sp.get('tamanho_pagina'))) return resposta(400, { error: 'tamanho_pagina inválido' });
      const tam = Number(sp.get('tamanho_pagina')), pag = Number(sp.get('pagina') || 1);
      const lista = m.parcelas.filter(p => p.natureza === natureza && p.data_vencimento >= vDe && p.data_vencimento <= vAte
        && (!pDe || p.baixas.some(b => b.data_pagamento >= pDe && b.data_pagamento <= pAte))
        && (!aDe || (p.data_alteracao >= aDe && p.data_alteracao <= aAte)))
        .sort((a, b) => cmp(a.data_vencimento, b.data_vencimento) || cmp(a.id, b.id));
      return resposta(200, { itens_totais: lista.length, itens: lista.slice((pag - 1) * tam, pag * tam).map(itemDaLista), totais: {} });
    }
    const um = caminho.match(/^\/v1\/financeiro\/eventos-financeiros\/parcelas\/([0-9a-z-]{36})$/);
    if (um) { const p = m.parcelas.find(x => x.id === um[1]); return p ? resposta(200, { ...itemDaLista(p), baixas: p.baixas }) : resposta(404, { error: 'Parcela não encontrada' }); }
    if (caminho === '/v1/categorias') return resposta(200, { itens: [{ id: U('ca', 1), nome: 'Categoria 1', tipo: 'RECEITA' }, { id: U('ca', 2), nome: 'Categoria 2', tipo: 'DESPESA' }] });
    return resposta(404, { error: 'caminho fora do Conta Azul de mentira: ' + caminho });
  };
  return m;
}

// ---------- a função de verdade, carregada no node ----------
const pegos = [];
function prepararAmbiente() {
  instalarRelogio();
  globalThis.Deno = { env: { get: k => ({ SUPABASE_URL: 'https://projeto.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'chave-servidor', CA_CLIENT_ID: 'id', CA_CLIENT_SECRET: 'segredo' })[k] }, serve: fn => { pegos.push(fn); } };
  globalThis.__sbFalso = sbFalso;
  globalThis.fetch = (url, opc) => atual.ca.fetch(url, opc);
  register('data:text/javascript,' + encodeURIComponent(`
    export async function resolve(especificador, contexto, proximo) {
      if (especificador === 'npm:@supabase/supabase-js@2') return { url: 'data:text/javascript,' + encodeURIComponent('export const createClient = () => globalThis.__sbFalso;'), shortCircuit: true };
      return proximo(especificador, contexto);
    }`));
}
async function carregar(url) { const antes = pegos.length; await import(url); if (pegos.length !== antes + 1) throw new Error('a função não chamou Deno.serve'); return pegos[pegos.length - 1]; }
async function chamar(funcao, corpo, chave = CHAVE) {
  const r = await funcao(new Request('https://projeto.supabase.co/functions/v1/ca-sync', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-sync-key': chave }, body: JSON.stringify(corpo ?? {}) }));
  // a rodada que falha responde na hora, e os pedidos que já tinham saído ainda voltam: espera por eles antes do próximo cenário
  await new Promise(ok => esperaReal(ok, 25));
  return { status: r.status, corpo: await r.json() };
}

// ---------- o mundo de cada cenário ----------
const spDia = iso => new DataReal(DataReal.parse(iso) - 3 * 3600 * 1000).toISOString().slice(0, 10);
const spHora = (iso, menosMin = 0) => new DataReal(DataReal.parse(iso) - 3 * 3600 * 1000 - menosMin * 60000).toISOString().slice(0, 19);
const mesDe = d => d.slice(0, 8) + '01';
const fimDoMes = ini => new DataReal(DataReal.UTC(Number(ini.slice(0, 4)), Number(ini.slice(5, 7)), 0)).toISOString().slice(0, 10);
const ANTES = '2026-01-01T09:00:00.000Z';
const ID = { distante: U('pa', 900001), velha: U('pa', 900002), ultimoDia: U('pa', 900003), estornada: U('pa', 900004), duasVezes: U('pa', 900005), viradaA: U('pa', 900006), viradaB: U('pa', 900007) };

function montar({ agora, semente, n = 2500, ultimoOkHorasAtras = 5 }) {
  acertarRelogio(agora);
  const hoje = spDia(agora);
  const parcelas = gerarParcelas({ semente, hoje, n });
  // as mexidas dentro da janela do incremental (o espelho tem a versão de antes) e as novas (fora do espelho)
  const mexidas = new Set(), novas = new Set();
  parcelas.forEach((p, i) => {
    if (i % 61 === 0) { p.data_alteracao = spHora(agora, 20 + (i % 200)); mexidas.add(p.id); }
    if (i % 407 === 3) { p.data_alteracao = spHora(agora, 30); novas.add(p.id); }
  });
  const feita = (id, venc, natureza, pagamentos, alteracao) => {
    const baixas = pagamentos.map(([data, valor], k) => ({ id: U('ba', 9000000 + Number(id.slice(-6)) * 10 + k), data_pagamento: data,
      valor_composicao: { valor_bruto: valor, valor_liquido: valor, juros: 0, multa: 0, desconto: 0, taxa: 0 }, conta_financeira: { id: U('cf', 1), nome: 'Banco de mentira' }, metodo_pagamento: 'PIX' }));
    const pago = baixas.reduce((s, b) => s + b.valor_composicao.valor_bruto, 0);
    return { id, natureza, descricao: 'Feita à mão ' + venc, data_vencimento: venc, data_competencia: mesDe(venc), total: 100, pago, nao_pago: 100 - pago, baixas,
      data_criacao: '2024-01-02T09:00:00', data_alteracao: alteracao, [natureza === 'receita' ? 'cliente' : 'fornecedor']: { id: U('pe', 1), nome: 'Pessoa 1' }, categorias: [], centros_de_custo: [] };
  };
  parcelas.push(
    feita(ID.distante, '2033-08-15', 'despesa', [[hoje, 100]], spHora(agora, 25)),              // paga hoje, de uma janela de vencimento distante
    feita(ID.velha, '2024-02-29', 'receita', [[somaDias(hoje, -1), 100]], '2024-01-02T09:00:00'), // a atrasada de 2024, paga ontem (sem alteração na janela)
    feita(ID.ultimoDia, '2036-12-31', 'receita', [], spHora(agora, 40)),                          // o último dia da última janela, criada agora
    feita(ID.estornada, '2026-10-10', 'receita', [], '2026-10-01T09:00:00'),                      // o espelho diz paga neste mês; o Conta Azul não tem mais o pagamento
    feita(ID.duasVezes, '2026-09-10', 'receita', [[somaDias(mesDe(hoje), -5), 40], [hoje, 60]], spHora(agora, 22)), // paga no mês passado e neste
    feita(ID.viradaA, '2024-12-20', 'receita', [['2025-01-10', 100]], '2025-01-10T10:00:00'),    // vencimento num ano, pagamento no outro
    feita(ID.viradaB, '2026-01-05', 'receita', [['2025-12-28', 100]], '2025-12-28T10:00:00'));
  novas.add(ID.ultimoDia);

  const espelho = [];
  let k = 0;
  for (const p of parcelas) {
    if (novas.has(p.id)) continue;
    const l = linhaDoEspelho(p, ANTES);
    if (mexidas.has(p.id) || p.id === ID.distante || p.id === ID.duasVezes) { l.pago = 0; l.nao_pago = p.total; l.status = 'PENDING'; l.dados = { ...l.dados, pago: 0 }; }
    // as marcas como estavam: o mês e o dia do último pagamento de até anteontem
    const pagos = p.baixas.filter(b => b.data_pagamento <= somaDias(hoje, -2));
    if (pagos.length) { const u = pagos[pagos.length - 1].data_pagamento; l.mes_pagamento = mesDe(u); if (u >= somaDias(hoje, -25)) l.data_pagamento = u; }
    // marcas velhas, que a rodada tem de limpar
    k++;
    if (!p.baixas.length && k % 97 === 0) l.mes_pagamento = mesDe(hoje);
    if (!p.baixas.length && k % 89 === 0) { l.mes_pagamento = mesDe(somaDias(mesDe(hoje), -1)); l.data_pagamento = somaDias(hoje, -3); }
    if (p.id === ID.estornada) { l.mes_pagamento = mesDe(hoje); l.data_pagamento = somaDias(hoje, -1); }
    if (p.id === ID.viradaA || p.id === ID.viradaB) l.mes_pagamento = null; // a marca que falta: só a passada de 2025 põe
    espelho.push(l);
  }
  // as baixas no espelho: das pagas em duas vezes (metade delas), e umas estornadas (que o Conta Azul não tem mais)
  const baixasNoEspelho = [];
  let j = 0;
  const linhaDaBaixa = (b, p) => ({ id: b.id, parcela_id: p.id, natureza: p.natureza, data_pagamento: b.data_pagamento, valor: b.valor_composicao.valor_bruto, valor_liquido: b.valor_composicao.valor_liquido,
    juros: 0, multa: 0, desconto: 0, taxa: 0, conta_financeira: b.conta_financeira.nome, conta_financeira_id: b.conta_financeira.id, metodo_pagamento: b.metodo_pagamento, dados: {}, sincronizado_em: ANTES });
  for (const p of parcelas) {
    if (novas.has(p.id) || p.baixas.length < 2 || p.id === ID.duasVezes) continue;
    if (j++ % 2) continue;
    for (const b of p.baixas) baixasNoEspelho.push(linhaDaBaixa(b, p));
    if (j % 6 === 1) baixasNoEspelho.push({ ...linhaDaBaixa(p.baixas[0], p), id: U('ba', 7000000 + j), data_pagamento: somaDias(hoje, -90), valor: 1 });
  }
  // parcelas do espelho que o Conta Azul não tem mais (a limpeza do backfill): uma por ano de vencimento, de 2025 a 2028
  const apagadas = [];
  for (let i = 1; i <= 4; i++) {
    const id = U('pa', 800000 + i);
    apagadas.push(id);
    espelho.push(linhaDoEspelho(feita(id, (2024 + i) + '-03-1' + i, i % 2 ? 'receita' : 'despesa', [], '2024-01-02T09:00:00'), ANTES));
  }
  const okEm = new DataReal(DataReal.parse(agora) - ultimoOkHorasAtras * 3600000).toISOString();
  const log = [{ id: 1, tipo: 'incremental', iniciado_em: okEm, concluido_em: new DataReal(DataReal.parse(okEm) + 7000).toISOString(), sucesso: true, erro: null }];
  const m = criarMundo({ parcelas, espelho, baixasNoEspelho, log });
  m.antes = new Map(espelho.map(l => [l.id, { mes: l.mes_pagamento, dia: l.data_pagamento, pago: l.pago }]));
  m.novas = novas; m.mexidas = mexidas; m.apagadas = apagadas; m.hoje = hoje; m.agora = agora;
  m.janelaDe = spHora(okEm, 15); m.janelaAte = spHora(agora);
  usar(m);
  return m;
}

// ---------- a conta independente: as marcas que o espelho tem de ter depois da rodada ----------
// meses: as âncoras ('AAAA-MM-01') dos meses que a rodada remarca; dias: [de, ate] da passada diária (ou null)
function marcasEsperadas(m, { meses, dias, reconcilia }) {
  const porId = new Map(m.parcelas.map(p => [p.id, p]));
  const esperado = new Map();
  for (const l of m.db.ca_parcelas) {
    const p = porId.get(l.id), antes = m.antes.get(l.id) ?? { mes: null, dia: null };
    const pagaEm = (de, ate) => (p ? p.baixas.filter(b => b.data_pagamento >= de && b.data_pagamento <= ate).map(b => b.data_pagamento) : []);
    let mes = antes.mes;
    if (meses.includes(mes)) mes = null;
    for (const ini of meses) if (pagaEm(ini, fimDoMes(ini)).length) mes = ini; // em ordem: o mês mais novo da rodada fica
    let dia = antes.dia;
    if (dias) {
      const pagos = pagaEm(dias[0], dias[1]).sort();
      if (pagos.length) dia = pagos[pagos.length - 1];
      else if (dia && dia >= dias[0] && dia <= dias[1]) dia = null;
      if (reconcilia && mes === null) dia = null;
    }
    esperado.set(l.id, { mes, dia });
  }
  return esperado;
}
function conferirMarcas(m, esperado) {
  const erradas = m.db.ca_parcelas.filter(l => { const e = esperado.get(l.id); return (l.mes_pagamento ?? null) !== e.mes || (l.data_pagamento ?? null) !== e.dia; });
  return { erradas, exemplo: erradas.slice(0, 3).map(l => ({ id: l.id.slice(-6), venc: l.data_vencimento, mes: l.mes_pagamento, dia: l.data_pagamento, esperado: esperado.get(l.id) })) };
}
const buscas = m => m.ca.chamadas.filter(c => /\/buscar$/.test(c.caminho));
const largas = m => buscas(m).filter(c => diasEntre(c.params.data_vencimento_de, c.params.data_vencimento_ate) > 365
  || (c.params.data_pagamento_de && diasEntre(c.params.data_pagamento_de, c.params.data_pagamento_ate) > 365)
  || (c.params.data_alteracao_de && diasEntre(c.params.data_alteracao_de, c.params.data_alteracao_ate) > 365));
const linha = (m, id) => m.db.ca_parcelas.find(l => l.id === id);

// ---------- a função de verdade ----------
prepararAmbiente();
encurtarEsperas();
let sorte = 0.5;
Math.random = () => sorte; // as categorias entram por sorteio (1 em 10): aqui, só quando o cenário pede
const funcao = await carregar(new URL('../supabase/functions/ca-sync/index.ts', import.meta.url).href);
const fonte = readFileSync(raiz + 'supabase/functions/ca-sync/index.ts', 'utf8');

console.log('O Conta Azul de mentira recusa o intervalo largo, como o de verdade desde 12/11/2026:');
{
  const m = montar({ agora: '2026-11-12T18:25:00.000Z', semente: 1, n: 50 });
  const pedir = async params => (await m.ca.fetch(API + '/v1/financeiro/eventos-financeiros/contas-a-receber/buscar?' + new URLSearchParams({ pagina: '1', tamanho_pagina: '10', ...params }), { headers: { Authorization: 'Bearer tok-ca' } }));
  const a = await pedir({ data_vencimento_de: '2024-01-01', data_vencimento_ate: '2036-12-31' });
  chk('de 2024 a 2036 de uma vez: 400, com a frase do Conta Azul', a.status === 400 && /intervalo de data de vencimento excede o limite máximo permitido de 365 dias/.test(await a.text()));
  chk('365 dias de diferença passam, 366 não', (await pedir({ data_vencimento_de: '2025-01-01', data_vencimento_ate: '2026-01-01' })).status === 200
    && (await pedir({ data_vencimento_de: '2025-01-01', data_vencimento_ate: '2026-01-02' })).status === 400);
  chk('o ano bissexto inteiro passa (365 dias de diferença)', (await pedir({ data_vencimento_de: '2024-01-01', data_vencimento_ate: '2024-12-31' })).status === 200);
  const b = await pedir({ data_vencimento_de: '2026-01-01', data_vencimento_ate: '2026-12-31', data_pagamento_de: '2025-01-01', data_pagamento_ate: '2026-11-12' });
  const c = await pedir({ data_vencimento_de: '2026-01-01', data_vencimento_ate: '2026-12-31', data_alteracao_de: '2025-01-01T00:00:00', data_alteracao_ate: '2026-11-12T23:59:59' });
  chk('o mesmo limite no intervalo de pagamento e no de alteração', b.status === 400 && /data de pagamento/.test(await b.text()) && c.status === 400 && /data de alteração/.test(await c.text()));
}

console.log('\nA rodada de 10 em 10 minutos (incremental, sem a passada diária), depois de 5 horas parada:');
{
  const agora = '2026-11-12T18:25:00.000Z';
  const m = montar({ agora, semente: 11 });
  const r = await chamar(funcao, { modo: 'incremental' });
  chk('a rodada termina bem', r.status === 200 && r.corpo.ok === true, J(r.corpo).slice(0, 300));
  chk('nenhum pedido com mais de 365 dias de vencimento, de pagamento ou de alteração', largas(m).length === 0 && !m.ca.chamadas.some(c => c.status === 400), J(largas(m).slice(0, 2)));
  const janelasVistas = new Set(buscas(m).filter(c => c.params.data_alteracao_de).map(c => c.caminho.includes('receber') + ':' + c.params.data_vencimento_de + ':' + c.params.data_vencimento_ate));
  chk('a varredura pede os 13 anos de vencimento, de 2024 a 2036, um por pedido, nas duas naturezas', janelasVistas.size === 26
    && janelasVistas.has('true:2024-01-01:2024-12-31') && janelasVistas.has('false:2036-01-01:2036-12-31') && janelasVistas.has('true:2030-01-01:2030-12-31'), [...janelasVistas].slice(0, 4).join(' '));
  chk('a janela de alteração vai desde a última rodada boa, com 15 minutos de folga', buscas(m).filter(c => c.params.data_alteracao_de).every(c => c.params.data_alteracao_de === m.janelaDe && c.params.data_alteracao_ate === m.janelaAte));
  chk('os pedidos saem no máximo 4 juntos (e não um por um)', m.ca.maxJuntas <= 4 && m.ca.maxJuntas > 1, m.ca.maxJuntas);
  chk('o relato diz quantos pedidos a rodada fez', r.corpo.pedidos_ca === m.ca.chamadas.length, r.corpo.pedidos_ca + ' × ' + m.ca.chamadas.length);
  // o que entra pelo espelho: as alteradas na janela
  const alteradas = m.parcelas.filter(p => p.data_alteracao >= m.janelaDe && p.data_alteracao <= m.janelaAte);
  chk('entram no espelho as alteradas desde a última rodada boa (' + alteradas.length + ')', r.corpo.receitas + r.corpo.despesas === alteradas.length
    && alteradas.every(p => { const l = linha(m, p.id); return l && l.pago === p.pago && l.nao_pago === p.nao_pago && l.sincronizado_em === agora; }));
  chk('a criada agora com vencimento no último dia da última janela (31/12/2036) entra', !!linha(m, ID.ultimoDia) && linha(m, ID.ultimoDia).data_vencimento === '2036-12-31');
  chk('quem não mudou segue como estava', m.db.ca_parcelas.filter(l => l.sincronizado_em === ANTES).length === m.db.ca_parcelas.length - alteradas.length);
  // as marcas do mês
  const esperado = marcasEsperadas(m, { meses: ['2026-10-01', '2026-11-01'], dias: null });
  const conf = conferirMarcas(m, esperado);
  chk('o mês do pagamento de cada parcela do espelho bate com a conta feita aqui pelas baixas (' + m.db.ca_parcelas.length + ' parcelas)', conf.erradas.length === 0, conf.erradas.length + ' erradas: ' + J(conf.exemplo));
  chk('a paga hoje com vencimento em 2033 fica marcada neste mês', linha(m, ID.distante).mes_pagamento === '2026-11-01');
  chk('a atrasada de 2024, paga ontem, fica marcada neste mês', linha(m, ID.velha).mes_pagamento === '2026-11-01');
  chk('a que o espelho dava como paga neste mês e o Conta Azul não tem mais perde a marca', linha(m, ID.estornada).mes_pagamento === null);
  chk('a paga em dois meses fica com o mais novo', linha(m, ID.duasVezes).mes_pagamento === '2026-11-01');
  const marcadas = m.db.ca_parcelas.filter(l => l.mes_pagamento === '2026-10-01' || l.mes_pagamento === '2026-11-01').length;
  chk('várias janelas de vencimento com pagamento nos dois meses (a sonda achou)', r.corpo.janelas_pagas.receita.includes('2024') && r.corpo.janelas_pagas.despesa.includes('2033') && marcadas > 100, J(r.corpo.janelas_pagas));
  chk('sem a passada diária, o dia do pagamento não muda', r.corpo.pagamentosDia === 0 && m.db.ca_parcelas.every(l => (l.data_pagamento ?? null) === (m.antes.get(l.id)?.dia ?? null)));
  // as baixas
  const duas = m.db.ca_baixas.filter(b => b.parcela_id === ID.duasVezes);
  chk('a paga em dois meses tem os dois pagamentos lidos (ca_baixas)', duas.length === 2 && duas.map(b => b.valor).sort().join() === '40,60', J(duas.map(b => b.valor)));
  const mundoDe = new Map(m.parcelas.map(p => [p.id, new Set(p.baixas.map(b => b.id))]));
  const lidasAgora = [...new Set(m.db.ca_baixas.filter(b => b.sincronizado_em === agora).map(b => b.parcela_id))];
  chk('das parcelas relidas, o espelho fica só com as baixas que o Conta Azul tem (a estornada sai)', lidasAgora.length > 5
    && lidasAgora.every(id => { const tem = m.db.ca_baixas.filter(b => b.parcela_id === id).map(b => b.id); return tem.length === mundoDe.get(id).size && tem.every(x => mundoDe.get(id).has(x)); }));
  const reg = m.db.ca_sync_log[m.db.ca_sync_log.length - 1];
  chk('o registro da rodada: sucesso, sem erro, com o que gravou', reg.sucesso === true && !reg.erro && reg.parcelas_upsert === alteradas.length && !!reg.concluido_em);
  chk('quem chama sem a chave não passa', (await chamar(funcao, { modo: 'incremental' }, 'outra-chave')).status === 401);
}

console.log('\nA rodada da hora cheia (com a passada diária dos últimos 10 dias):');
for (const [nome, agora, meses, semente] of [
  ['num dia comum', '2026-11-12T18:05:00.000Z', ['2026-10-01', '2026-11-01'], 12],
  ['na virada do mês (UTC já em dezembro, São Paulo ainda em 30/11)', '2026-12-01T02:05:00.000Z', ['2026-11-01', '2026-12-01'], 13],
  ['em janeiro (dezembro e janeiro: dois anos de pagamento)', '2027-01-05T15:05:00.000Z', ['2026-12-01', '2027-01-01'], 14]]) {
  const m = montar({ agora, semente });
  const r = await chamar(funcao, { modo: 'incremental' });
  const dias = [somaDias(m.hoje, -9), m.hoje];
  const conf = conferirMarcas(m, marcasEsperadas(m, { meses, dias, reconcilia: true }));
  chk(nome + ': termina bem, sem pedido largo, e o mês e o dia de cada parcela batem com a conta daqui', r.status === 200 && largas(m).length === 0 && !m.ca.chamadas.some(c => c.status === 400) && conf.erradas.length === 0,
    r.status + ' · largos ' + largas(m).length + ' · ' + conf.erradas.length + ' erradas: ' + J(conf.exemplo) + ' ' + J(r.corpo).slice(0, 200));
  chk(nome + ': a paga hoje com vencimento em 2033 tem o dia de hoje; a estornada, nenhum', linha(m, ID.distante).data_pagamento === m.hoje && linha(m, ID.estornada).data_pagamento === null && r.corpo.pagamentosDia > 20,
    linha(m, ID.distante).data_pagamento + ' · ' + linha(m, ID.estornada).data_pagamento + ' · ' + r.corpo.pagamentosDia);
  chk(nome + ': no máximo 4 pedidos juntos', m.ca.maxJuntas <= 4, m.ca.maxJuntas);
}

console.log('\nO Conta Azul instável:');
{
  const sonda = c => c.caminho.includes('receber') && c.params.tamanho_pagina === '10' && c.params.data_vencimento_de === '2026-01-01';
  let m = montar({ agora: '2026-11-12T18:25:00.000Z', semente: 21, n: 400 });
  m.ca.falhar.push({ casa: sonda, status: 500, vezes: 1 });
  let r = await chamar(funcao, { modo: 'incremental' });
  chk('um 500 avulso: o pedido é tentado de novo e a rodada termina bem', r.status === 200 && m.ca.chamadas.filter(c => c.status === 500).length === 1, J(r.corpo).slice(0, 200));

  m = montar({ agora: '2026-11-12T18:25:00.000Z', semente: 21, n: 400 });
  m.ca.falhar.push({ casa: c => c.caminho.includes('receber') && !!c.params.data_alteracao_de && c.params.data_vencimento_de === '2027-01-01', lancar: new TypeError('fetch failed'), vezes: 2 });
  r = await chamar(funcao, { modo: 'incremental' });
  chk('a rede cai duas vezes no mesmo pedido: a rodada termina bem', r.status === 200 && m.ca.chamadas.filter(c => c.status === 'rede').length === 2, J(r.corpo).slice(0, 200));

  m = montar({ agora: '2026-11-12T18:25:00.000Z', semente: 21, n: 400 });
  m.ca.falhar.push({ casa: sonda, status: 429, vezes: 3 });
  r = await chamar(funcao, { modo: 'incremental' });
  chk('o 429 (limite de requisições) espera e tenta de novo', r.status === 200 && m.ca.chamadas.filter(c => c.status === 429).length === 3, J(r.corpo).slice(0, 200));

  m = montar({ agora: '2026-11-12T18:05:00.000Z', semente: 21, n: 400 });
  const idsAntes = new Set(m.antes.keys());
  const marcas = () => J(m.db.ca_parcelas.filter(l => idsAntes.has(l.id)).map(l => [l.id, l.mes_pagamento, l.data_pagamento]).sort());
  const marcasAntes = marcas();
  m.ca.falhar.push({ casa: sonda, status: 500, vezes: 99 });
  r = await chamar(funcao, { modo: 'incremental' });
  const reg = m.db.ca_sync_log[m.db.ca_sync_log.length - 1];
  chk('o 500 que não passa (3 tentativas): a rodada falha, com o erro na resposta e no registro', r.status === 500 && r.corpo.ok === false && /respondeu 500/.test(r.corpo.erro)
    && reg.sucesso === false && /respondeu 500/.test(reg.erro) && !!reg.concluido_em && m.ca.chamadas.filter(c => c.status === 500).length === 3, J(r.corpo).slice(0, 200));
  chk('e nenhuma marca de pagamento foi mexida pela metade', marcas() === marcasAntes);

  m = montar({ agora: '2026-11-12T18:25:00.000Z', semente: 21, n: 400 });
  m.ca.falhar.push({ casa: sonda, lancar: Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' }), vezes: 99 });
  r = await chamar(funcao, { modo: 'incremental' });
  chk('o pedido sem resposta no prazo falha a rodada na hora (sem tentar de novo)', r.status === 500 && /não respondeu/.test(r.corpo.erro) && m.ca.chamadas.filter(c => c.status === 'rede').length === 1, J(r.corpo).slice(0, 200));

  // o erro de 12/11, se o Conta Azul apertar o limite de novo: a rodada falha e o registro diz por quê
  m = montar({ agora: '2026-11-12T18:25:00.000Z', semente: 21, n: 400 });
  m.ca.falhar.push({ casa: () => true, status: 400, corpo: { error: 'O intervalo de data de vencimento excede o limite máximo permitido de 90 dias. Reduza o período e tente novamente.' }, vezes: 99 });
  r = await chamar(funcao, { modo: 'incremental' });
  chk('o 400 não é tentado de novo: falha com a frase do Conta Azul no registro', r.status === 500 && /limite máximo permitido de 90 dias/.test(m.db.ca_sync_log[m.db.ca_sync_log.length - 1].erro) && m.ca.chamadas.length <= 4, m.ca.chamadas.length);
}

console.log('\nAs passadas completas de domingo (backfill):');
{
  let m = montar({ agora: '2026-11-15T07:45:00.000Z', semente: 31, n: 3200 });
  let r = await chamar(funcao, { modo: 'backfill', venc_de: '2026-01-01', venc_ate: '2036-12-31' });
  const mesesDoAno = Array.from({ length: 11 }, (_, i) => '2026-' + String(i + 1).padStart(2, '0') + '-01');
  let conf = conferirMarcas(m, marcasEsperadas(m, { meses: mesesDoAno, dias: null }));
  const doFuturo = m.parcelas.filter(p => p.data_vencimento >= '2026-01-01');
  chk('a do futuro (2026 a 2036): termina bem, sem pedido largo', r.status === 200 && largas(m).length === 0 && !m.ca.chamadas.some(c => c.status === 400), J(r.corpo).slice(0, 300));
  chk('regrava todas as parcelas da janela (' + doFuturo.length + '), ano a ano, com as páginas de cada ano', r.corpo.receitas + r.corpo.despesas === doFuturo.length && doFuturo.every(p => linha(m, p.id)?.sincronizado_em === m.agora)
    && buscas(m).some(c => c.params.pagina === '2' && c.params.tamanho_pagina === '500'));
  chk('o mês do pagamento, de janeiro a novembro de 2026, bate com a conta daqui (inclusive as de vencimento fora da janela varrida)', conf.erradas.length === 0, conf.erradas.length + ' erradas: ' + J(conf.exemplo));
  chk('a limpeza tira do espelho só as que o Conta Azul não tem mais, e só as da janela (a de 2025 fica)', r.corpo.limpeza.apagadas === 3 && !linha(m, m.apagadas[1]) && !linha(m, m.apagadas[3]) && !!linha(m, m.apagadas[0]), J(r.corpo.limpeza));

  m = montar({ agora: '2026-11-15T07:30:00.000Z', semente: 32 });
  r = await chamar(funcao, { modo: 'backfill', venc_de: '2025-01-01', venc_ate: '2025-12-31', simular: true });
  conf = conferirMarcas(m, marcasEsperadas(m, { meses: Array.from({ length: 12 }, (_, i) => '2025-' + String(i + 1).padStart(2, '0') + '-01'), dias: null }));
  chk('a de 2025: termina bem, sem pedido largo, e os meses de 2025 batem com a conta daqui', r.status === 200 && largas(m).length === 0 && conf.erradas.length === 0, conf.erradas.length + ' erradas: ' + J(conf.exemplo));
  chk('a paga em 2025 com vencimento em 2024, e a paga em 2025 com vencimento em 2026, ganham o mês certo', linha(m, ID.viradaA).mes_pagamento === '2025-01-01' && linha(m, ID.viradaB).mes_pagamento === '2025-12-01'
    && r.corpo.janelas_pagas.receita.includes('2024') && r.corpo.janelas_pagas.receita.includes('2026'), linha(m, ID.viradaA).mes_pagamento + ' · ' + linha(m, ID.viradaB).mes_pagamento + ' · ' + J(r.corpo.janelas_pagas));
  chk('simulando, a limpeza só relata', r.corpo.limpeza.simular === true && r.corpo.limpeza.sumidas === 1 && r.corpo.limpeza.apagadas === 0 && !!linha(m, m.apagadas[0]), J(r.corpo.limpeza));

  m = montar({ agora: '2027-03-14T07:45:00.000Z', semente: 33 });
  r = await chamar(funcao, { modo: 'backfill', venc_de: '2026-01-01', venc_ate: '2036-12-31' });
  const quinze = [...mesesDoAno, '2026-12-01', '2027-01-01', '2027-02-01', '2027-03-01'];
  conf = conferirMarcas(m, marcasEsperadas(m, { meses: quinze, dias: null }));
  chk('em março de 2027 (15 meses de pagamento: mais de 365 dias): a sonda vai ano a ano, e os meses batem', r.status === 200 && largas(m).length === 0 && conf.erradas.length === 0, r.status + ' ' + conf.erradas.length + ' erradas: ' + J(conf.exemplo));

  m = montar({ agora: '2026-11-15T07:45:00.000Z', semente: 34, n: 300 });
  r = await chamar(funcao, { modo: 'backfill', venc_de: '2026-03-10', venc_ate: '2028-02-15' });
  const varridas = [...new Set(buscas(m).filter(c => !c.params.data_pagamento_de).map(c => c.params.data_vencimento_de + ':' + c.params.data_vencimento_ate))].sort();
  chk('a janela pedida vira um ano do calendário por pedido, com a primeira e a última do tamanho do pedido', r.status === 200 && J(varridas) === J(['2026-03-10:2026-12-31', '2027-01-01:2027-12-31', '2028-01-01:2028-02-15']), J(varridas));

  for (const [nome, corpo, frase] of [
    ['data que não é data', { modo: 'backfill', venc_de: 'ontem', venc_ate: '2026-12-31' }, /intervalo de datas inválido/],
    ['o fim antes do começo', { modo: 'backfill', venc_de: '2027-01-01', venc_ate: '2026-12-31' }, /intervalo de datas inválido/],
    ['cem anos de uma vez', { modo: 'backfill', venc_de: '2000-01-01', venc_ate: '2100-12-31' }, /largo demais/]]) {
    m = montar({ agora: '2026-11-15T07:45:00.000Z', semente: 35, n: 100 });
    const antes = J(m.db.ca_parcelas);
    r = await chamar(funcao, corpo);
    chk('o pedido com ' + nome + ' é recusado antes de qualquer leitura no Conta Azul, e nada muda no espelho', r.status === 500 && frase.test(r.corpo.erro) && m.ca.chamadas.length === 0 && J(m.db.ca_parcelas) === antes
      && m.db.ca_sync_log[m.db.ca_sync_log.length - 1].sucesso === false, J(r.corpo).slice(0, 200));
  }
}

console.log('\nO dia do pagamento em fatias (backfill_dias):');
for (const [nome, agora, de, ate, semente] of [
  ['os últimos 30 dias', '2026-11-15T08:06:00.000Z', '2026-10-17', '2026-11-15', 41],
  ['na virada do ano', '2027-01-10T08:00:00.000Z', '2026-12-11', '2027-01-10', 42]]) {
  const m = montar({ agora, semente });
  const r = await chamar(funcao, { modo: 'backfill_dias', dias_de: de, dias_ate: ate });
  const conf = conferirMarcas(m, marcasEsperadas(m, { meses: [], dias: [de, ate], reconcilia: false })); // este modo não mexe no mês
  chk(nome + ': termina bem, sem pedido largo, e o dia de cada parcela bate com a conta daqui', r.status === 200 && largas(m).length === 0 && !m.ca.chamadas.some(c => c.status === 400) && conf.erradas.length === 0 && r.corpo.pagamentosDia > 50,
    r.status + ' · ' + conf.erradas.length + ' erradas: ' + J(conf.exemplo) + ' ' + J(r.corpo).slice(0, 200));
  chk(nome + ': dia a dia, só nas janelas de vencimento em que a sonda achou pagamento', buscas(m).filter(c => c.params.tamanho_pagina === '10').length === 26 * (de.slice(0, 4) === ate.slice(0, 4) ? 1 : 2)
    && buscas(m).filter(c => c.params.tamanho_pagina === '500').every(c => c.params.data_pagamento_de === c.params.data_pagamento_ate), buscas(m).filter(c => c.params.tamanho_pagina === '10').length);
}

console.log('\nO código:');
chk('nenhum pedido de busca leva a janela larga inteira (só as janelas de um ano)', !/data_vencimento_de:\s*VENC_LARGA_DE|data_vencimento_ate:\s*VENC_LARGA_ATE/.test(fonte.replace(/^\s*\/\/.*$/gm, '')));
chk('segue trancada pela chave do sincronismo e não escreve no Conta Azul', /x-sync-key/.test(fonte) && !/method:\s*'(PUT|PATCH|DELETE)'/.test(fonte) && (fonte.match(/method: 'POST'/g) || []).length === 1 && /TOKEN_URL, \{\s*method: 'POST'/.test(fonte));

console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
