// ============================================================
// MACEDO & REIS — Operação por XML (NF-e, NFC-e e NFS-e): carga + agregações
// Uma fonte só pro painel fiscal-operacao.html e pra ponte da
// ficha da Reforma. Só notas autorizadas; devoluções (finNFe 4)
// ficam fora de vendas/compras e são devolvidas à parte.
// ============================================================

export const CFOP_COMPRA_MERCADORIA = new Set(['1101','1102','1111','1113','1116','1117','1118','1120','1121','1122','1401','1403','2101','2102','2111','2113','2116','2117','2118','2120','2121','2122','2401','2403','3101','3102','3127']);
// saídas/entradas que não são venda nem compra: transferência, remessas, retornos, bonificação, demonstração…
// 949 (outra saída/entrada não especificada) fica fora do faturamento, como no relatório da Domínio
const SUFIXOS_NAO_OPERACIONAIS = ['151','152','153','155','156','949','901','902','903','904','905','906','907','908','909','910','911','912','913','914','915','916','917','918','919','920','921','922','923','924','925','926','927','928','929','931','932','933','934'];
export const CFOP_NAO_OPERACIONAL = new Set(['1','2','5','6'].flatMap(p => SUFIXOS_NAO_OPERACIONAIS.map(s => p + s)));
// o CFOP do XML é sempre o do EMITENTE: numa nota de entrada (emitida pelo fornecedor) espelha 5→1 e 6→2
// pra enxergar pelo lado do comprador; nota de entrada emitida pelo próprio cliente já vem 1xxx/2xxx/3xxx
export function cfopOperacao(d) {
  const c = String(d.cfop_principal || '').replace(/\D/g, '');
  if (d.tipo === 'entrada' && /^[56]\d{3}$/.test(c)) return (c[0] === '5' ? '1' : '2') + c.slice(1);
  return c;
}
export const REGIME_LBL = { zero: 'Alíquota zero', reducao_60: 'Redução 60%', reducao_30: 'Redução 30%', cheia: 'Alíquota cheia' };
export const MESES_ABREV = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

const n = v => { const x = Number(v); return isFinite(x) ? x : 0; };

// descrição normalizada: mesma mercadoria em caixa/acentos/espaços diferentes é o mesmo produto
export function normDesc(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
}

// regra de NCM pelo prefixo mais longo (8 → 6 → 4 → 2); sem match = alíquota cheia
export function regimeDoNcm(ncm, regras) {
  const d = String(ncm || '').replace(/\D/g, '');
  for (const len of [8, 6, 4, 2]) {
    if (d.length < len) continue;
    const r = regras.get(d.slice(0, len));
    if (r) return r;
  }
  return { regime: 'cheia', descricao: null };
}

export function mascararDoc(doc) {
  const d = String(doc || '').replace(/\D/g, '');
  if (d.length === 14) return d.slice(0, 2) + '.***.***/' + d.slice(8, 12) + '-' + d.slice(12);
  if (d.length === 11) return '***.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-**';
  return doc || '—';
}

// carrega documentos autorizados do cliente no período, os itens deles e as regras de NCM
export async function carregarOperacao(supabase, clienteId, ano, mesIni = 1, mesFim = 12) {
  const ini = ano + '-' + String(mesIni).padStart(2, '0') + '-01';
  const fimD = new Date(Number(ano), Number(mesFim), 0).getDate();
  const fim = ano + '-' + String(mesFim).padStart(2, '0') + '-' + String(fimD).padStart(2, '0');
  const [docsR, itensR, regrasR] = await Promise.all([
    supabase.todasLinhas(() => supabase.from('nf_documentos')
      .select('id, modelo, data_emissao, tipo, finalidade, emit_doc, emit_nome, emit_uf, emit_crt, dest_doc, dest_tipo, dest_nome, dest_uf, valor_total, cfop_principal')
      .eq('cliente_id', clienteId).eq('status', 'autorizada').gte('data_emissao', ini).lte('data_emissao', fim)
      .order('data_emissao').order('id')),
    // itens filtrados pelo documento embutido (!inner): não existe cliente_id no item
    supabase.todasLinhas(() => supabase.from('nf_itens')
      .select('documento_id, ncm, descricao, cfop, unidade, quantidade, valor_total, nf_documentos!inner(cliente_id, status, data_emissao, tipo, finalidade)')
      .eq('nf_documentos.cliente_id', clienteId).eq('nf_documentos.status', 'autorizada')
      .gte('nf_documentos.data_emissao', ini).lte('nf_documentos.data_emissao', fim)
      .order('id')),
    supabase.from('rt_ncm_regras').select('ncm_prefixo, regime, descricao').eq('ativo', true)
  ]);
  const error = docsR.error || itensR.error || regrasR.error;
  if (error) return { error };
  const regras = new Map();
  (regrasR.data || []).forEach(r => { const p = String(r.ncm_prefixo || '').replace(/\D/g, ''); if (p) regras.set(p, { regime: r.regime, descricao: r.descricao }); });
  return { error: null, modelo: agregar(docsR.data || [], itensR.data || [], regras, { ano, mesIni, mesFim }) };
}

export function agregar(docs, itens, regras, periodo) {
  const docPorId = new Map(docs.map(d => [d.id, d]));
  const naoOperacional = d => CFOP_NAO_OPERACIONAL.has(cfopOperacao(d));
  const devolucoes = docs.filter(d => d.finalidade === 4);
  const outrasSaidas = docs.filter(d => d.tipo === 'saida' && d.finalidade !== 4 && naoOperacional(d));
  const outrasEntradas = docs.filter(d => d.tipo === 'entrada' && d.finalidade !== 4 && naoOperacional(d));
  const vendas = docs.filter(d => d.tipo === 'saida' && d.finalidade !== 4 && !naoOperacional(d));
  const compras = docs.filter(d => d.tipo === 'entrada' && d.finalidade !== 4 && !naoOperacional(d));
  const soma = arr => arr.reduce((s, d) => s + n(d.valor_total), 0);
  const totV = soma(vendas), totC = soma(compras);
  const ehSimples = d => d.emit_crt === 1 || d.emit_crt === 2 || d.emit_crt === 4;   // 4 = MEI (NT 2023.001)
  // NFC-e sem destinatário: o consumidor está no balcão — a UF é a do emitente
  const ufVenda = d => d.dest_uf || d.emit_uf || '—';

  // KPIs
  const vendasPJ = soma(vendas.filter(d => d.dest_tipo === 'PJ'));
  const comprasNormal = soma(compras.filter(d => d.emit_crt === 3));
  const comprasSimples = soma(compras.filter(ehSimples));
  const kpis = {
    vendas: totV, nVendas: vendas.length, compras: totC, nCompras: compras.length,
    ticket: vendas.length ? totV / vendas.length : 0,
    pctPJ: totV ? vendasPJ / totV * 100 : 0,
    pctComprasNormal: totC ? comprasNormal / totC * 100 : 0,
    pctComprasSimples: totC ? comprasSimples / totC * 100 : 0,
    devolucoes: soma(devolucoes), nDevolucoes: devolucoes.length,
    outrasSaidas: soma(outrasSaidas), nOutrasSaidas: outrasSaidas.length,
    outrasEntradas: soma(outrasEntradas), nOutrasEntradas: outrasEntradas.length,
    nfce: vendas.filter(d => d.modelo === '65').length,
    nfse: vendas.filter(d => d.modelo === 'nfse').length
  };

  // rankings (clientes por destinatário, fornecedores por emitente)
  const ranking = (arr, chaveDe, montar, top) => {
    const g = new Map();
    arr.forEach(d => {
      const k = chaveDe(d);
      const r = g.get(k) || montar(d);
      r.valor += n(d.valor_total); r.notas++;
      g.set(k, r);
    });
    const lista = [...g.values()].sort((a, b) => b.valor - a.valor);
    const total = lista.reduce((s, r) => s + r.valor, 0);
    let acum = 0;
    const topo = lista.slice(0, top).map(r => { acum += r.valor; return { ...r, pct: total ? r.valor / total * 100 : 0, acum: total ? acum / total * 100 : 0 }; });
    const resto = lista.slice(top);
    const outros = resto.length ? { nome: 'Outros (' + resto.length + ')', valor: resto.reduce((s, r) => s + r.valor, 0), notas: resto.reduce((s, r) => s + r.notas, 0), outros: true } : null;
    if (outros) { outros.pct = total ? outros.valor / total * 100 : 0; outros.acum = 100; }
    return { topo, outros, total, distintos: lista.length };
  };
  const clientes = ranking(vendas,
    d => d.dest_doc || (d.modelo === '65' ? '__nfce' : ('__' + (d.dest_nome || 'sem nome'))),
    d => ({ nome: d.dest_doc ? (d.dest_nome || '—') : (d.modelo === '65' ? 'Consumidor final (NFC-e)' : (d.dest_nome || 'Sem identificação')), doc: d.dest_doc, tipo: d.dest_tipo || 'PF', uf: ufVenda(d), valor: 0, notas: 0 }), 15);
  const fornecedores = ranking(compras,
    d => d.emit_doc || ('__' + (d.emit_nome || 'sem nome')),
    d => ({ nome: d.emit_nome || '—', doc: d.emit_doc, regime: d.emit_crt === 3 ? 'normal' : ehSimples(d) ? 'simples' : 'ni', uf: d.emit_uf || '—', valor: 0, notas: 0 }), 15);

  // produtos (por NCM + descrição normalizada), com regime da Reforma pelo NCM
  const produtos = (tipo, top) => {
    const g = new Map();
    itens.forEach(it => {
      const d = docPorId.get(it.documento_id);
      if (!d || d.tipo !== tipo || d.finalidade === 4 || naoOperacional(d)) return;
      const ncm = String(it.ncm || '').replace(/\D/g, '');
      const k = ncm + '|' + normDesc(it.descricao);
      const p = g.get(k) || { ncm, descricao: String(it.descricao || '').trim(), qtd: 0, valor: 0, unidades: {}, regime: regimeDoNcm(ncm, regras) };
      p.qtd += n(it.quantidade); p.valor += n(it.valor_total);
      const u = String(it.unidade || '').trim().toUpperCase(); if (u) p.unidades[u] = (p.unidades[u] || 0) + 1;
      g.set(k, p);
    });
    const lista = [...g.values()].map(p => ({ ...p, unidade: Object.entries(p.unidades).sort((a, b) => b[1] - a[1])[0]?.[0] || '' })).sort((a, b) => b.valor - a.valor);
    const total = lista.reduce((s, p) => s + p.valor, 0);
    let acum = 0;
    const topo = lista.slice(0, top).map(p => { acum += p.valor; return { ...p, pct: total ? p.valor / total * 100 : 0, acum: total ? acum / total * 100 : 0 }; });
    const porRegime = { zero: 0, reducao_60: 0, reducao_30: 0, cheia: 0 };
    lista.forEach(p => { porRegime[p.regime.regime in porRegime ? p.regime.regime : 'cheia'] += p.valor; });
    const mix = {};
    Object.keys(porRegime).forEach(k => { mix[k] = total ? porRegime[k] / total * 100 : 0; });
    return { topo, total, distintos: lista.length, mix, semNcm: lista.filter(p => !p.ncm).length };
  };
  const vendidos = produtos('saida', 20);
  const comprados = produtos('entrada', 10);

  // operações: CFOP de saída por valor (nível de item), UFs de destino, evolução mensal
  const cfops = new Map();
  itens.forEach(it => {
    const d = docPorId.get(it.documento_id);
    if (!d || d.tipo !== 'saida' || d.finalidade === 4 || naoOperacional(d)) return;
    const c = String(it.cfop || '').replace(/\D/g, '') || '—';
    cfops.set(c, (cfops.get(c) || 0) + n(it.valor_total));
  });
  const cfopLista = [...cfops.entries()].map(([cfop, valor]) => ({ cfop, valor, grupo: cfop[0] === '5' ? 'internas' : cfop[0] === '6' ? 'interestaduais' : cfop[0] === '7' ? 'exportacao' : 'outros' })).sort((a, b) => b.valor - a.valor);
  const cfopTotal = cfopLista.reduce((s, c) => s + c.valor, 0);
  const cfopGrupos = { internas: 0, interestaduais: 0, exportacao: 0, outros: 0 };
  cfopLista.forEach(c => { cfopGrupos[c.grupo] += c.valor; });
  const ufs = new Map();
  vendas.forEach(d => { const u = ufVenda(d); ufs.set(u, (ufs.get(u) || 0) + n(d.valor_total)); });
  const ufLista = [...ufs.entries()].map(([uf, valor]) => ({ uf, valor, pct: totV ? valor / totV * 100 : 0 })).sort((a, b) => b.valor - a.valor).slice(0, 5);
  const meses = [];
  for (let m = Number(periodo.mesIni) || 1; m <= (Number(periodo.mesFim) || 12); m++) {
    const pref = periodo.ano + '-' + String(m).padStart(2, '0');
    const v = soma(vendas.filter(d => String(d.data_emissao).startsWith(pref)));
    const c = soma(compras.filter(d => String(d.data_emissao).startsWith(pref)));
    meses.push({ mes: m, rotulo: MESES_ABREV[m - 1], vendas: v, compras: c, nV: vendas.filter(d => String(d.data_emissao).startsWith(pref)).length });
  }
  const mesesComVenda = meses.filter(m => m.nV > 0);

  // ponte com a ficha da Reforma
  const comprasMerc = soma(compras.filter(d => CFOP_COMPRA_MERCADORIA.has(cfopOperacao(d))));
  const pctMercBruto = totV ? comprasMerc / totV * 100 : 0;
  const pctDespBruto = totV ? (totC - comprasMerc) / totV * 100 : 0;
  // NFS-e de saída entra na receita (serviço prestado); NFS-e de entrada entra como despesa (serviço tomado, sem CFOP → não é mercadoria)
  const servPrestados = vendas.filter(d => d.modelo === 'nfse');
  const ponte = {
    receitaMensal: mesesComVenda.length ? totV / mesesComVenda.length : 0,
    nServicos: servPrestados.length, pctServicos: totV ? soma(servPrestados) / totV * 100 : 0,
    nServTomados: compras.filter(d => d.modelo === 'nfse').length,
    mesesComVenda: mesesComVenda.map(m => m.mes),
    pctPJ: kpis.pctPJ,
    // razões sobre as vendas; acima de 100% (estoque montado, empresa nova) vira teto — a ficha avisa
    pctMerc: Math.min(100, pctMercBruto),
    pctDesp: Math.min(100, pctDespBruto),
    comprasSuperamVendas: totC > totV,
    mixZero: vendidos.mix.zero, mixRed60: vendidos.mix.reducao_60, mixRed30: vendidos.mix.reducao_30,
    mixCheia: Math.max(0, 100 - vendidos.mix.zero - vendidos.mix.reducao_60 - vendidos.mix.reducao_30),
    nSaidas: vendas.length, nEntradas: compras.length
  };

  return { periodo, kpis, clientes, fornecedores, vendidos, comprados, cfops: { lista: cfopLista, total: cfopTotal, grupos: cfopGrupos }, ufs: ufLista, meses, ponte, totalDocs: docs.length };
}
