// ============================================================
// MACEDO & REIS — O boleto do mês pelo Conta Azul (05/11/2026, pedido do Samuel: "o que deve aparecer no sistema dos
// boletos é 1.520,00, soma de tudo que vence de serviços dessa empresa em novembro"). Regras puras: a tela Boletos
// (financeiro-boletos.html) e os testes no node (tests/boletos-conta-azul.test.mjs).
//
// O que entra: tudo o que o Conta Azul tem a receber da empresa com vencimento no mês do boleto (o mês do vencimento
// dele) e ainda em aberto — a mensalidade, os serviços extras, as parcelas, a renegociação, o adicional anual. Pelo
// vencimento, não pela competência da venda: a venda parcelada tem a mesma competência em todas as parcelas (o
// parcelamento da Adega, 4 × R$ 200, todas de 15/10/2026, venciam de novembro a fevereiro). Quem liga a pessoa do Conta
// Azul à empresa do cadastro é a função ca-vendas (modo 'boletos'), pelo CNPJ ou CPF.
//
// O valor do boleto (cobrancas_mensais.valor) fica sendo a mensalidade — a da competência do boleto, no Conta Azul — e o
// resto vai em itens_extras, cada um com o ca_parcela_id: a geração do mês seguinte copia o valor, e o extra de um mês
// não vai junto pro outro (até 05/11/2026, o extra somado à mão no valor seguia nos meses seguintes). O extra que não
// veio do Conta Azul (o adicional anual que a janela do adicional pôs, o faturável) fica como está; o adicional não entra
// de novo pela venda dele. O item do Conta Azul tirado do boleto na tela fica marcado (ignorado) e não volta na
// conferência seguinte. Decisões do Samuel na primeira conferência (05/11/2026): a mensalidade de outro mês que vence
// neste não entra no boleto (a parcela de uma venda parcelada entra, mesmo de honorário); e, no MEI, o escritório paga a
// guia do MEI e cobra junto — a guia não está no Conta Azul, então o valor de hoje, maior que o contrato de lá, fica.
// ============================================================

const semAcento = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '');
const norm = s => semAcento(s).toUpperCase().replace(/\s+/g, ' ').trim();
export const centavos = v => Math.round((Number(v) || 0) * 100);
const real = c => Math.round(c) / 100;
const dois = n => String(n).padStart(2, '0');

export const COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;
// as categorias da mensalidade no Conta Azul (as mesmas da Carteira e do vigia)
export const CATEGORIAS_MENSALIDADE = ['HONORARIOS MENSAIS', 'MEI - CONTRATOS'];

export function mesSeguinte(comp) {
  const [a, m] = String(comp).split('-').map(Number);
  return m === 12 ? (a + 1) + '-01' : a + '-' + dois(m + 1);
}
export const mesBR = comp => String(comp).slice(5, 7) + '/' + String(comp).slice(0, 4);

// o mês do boleto: o do vencimento dele; sem vencimento, o mês seguinte ao da competência (a regra da geração)
export function mesDoBoleto(cob) {
  const v = String((cob && cob.vencimento) || '').slice(0, 7);
  if (COMPETENCIA.test(v)) return v;
  return cob && COMPETENCIA.test(String(cob.competencia)) ? mesSeguinte(cob.competencia) : null;
}

export const categoriasDo = item => (item && Array.isArray(item.categorias) ? item.categorias : []).map(c => String((c && c.nome) || c || '')).filter(Boolean);
export const ehMensalidade = item => categoriasDo(item).some(c => CATEGORIAS_MENSALIDADE.includes(norm(c)));
// o número da venda no texto ("1/4 - Venda 190421319", "Honorário adicional anual (venda 190421461)")
export function vendaDe(texto) {
  const m = /\bvenda\s+(\d{6,})/i.exec(String(texto || ''));
  return m ? m[1] : null;
}

// a categoria como gente escreve ("SERVIÇOS EXTRAS" → "Serviços extras"); a que já vem em minúsculas fica
function categoriaLegivel(c) {
  const t = String(c || '').trim();
  if (!t || t !== t.toUpperCase()) return t;
  const s = t.toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// o rótulo do item no boleto: a categoria e a descrição do Conta Azul ("Serviços extras · 1/4 - Venda 190421319"); a
// mensalidade de outra competência diz de qual mês é ("Honorários de 09/2026 · Venda 190421224")
export function rotuloDoItem(item, competenciaDoBoleto) {
  const desc = String((item && item.descricao) || '').replace(/\s*\/\s*NFS-e:.*$/i, '').trim();
  const comp = String((item && item.competencia) || '').slice(0, 7);
  if (ehMensalidade(item)) {
    const de = COMPETENCIA.test(comp) && comp !== competenciaDoBoleto ? 'Honorários de ' + mesBR(comp) : 'Honorários';
    return de + (desc ? ' · ' + desc : '');
  }
  const cats = categoriasDo(item).filter(c => !/desconto/i.test(c));
  const cat = categoriaLegivel(cats[0] || 'Conta Azul');
  return cat + (desc ? ' · ' + desc : '');
}

export const extrasDe = extras => (Array.isArray(extras) ? extras : []).filter(x => x && typeof x === 'object');
// o que entra na soma: o tirado do boleto (ignorado) não
export const extrasAtivos = extras => extrasDe(extras).filter(x => !x.ignorado);
export const extrasDeFora = extras => extrasDe(extras).filter(x => !x.ca_parcela_id);
export const somaExtras = extras => real(extrasAtivos(extras).reduce((s, x) => s + centavos(x.valor), 0));
export const totalDoBoleto = cob => real(centavos(cob && cob.valor) + centavos(somaExtras(cob && cob.itens_extras)));

// o valor de base que dá o total digitado: o total menos os extras (null quando os extras já passam do total)
export function valorParaTotal(total, extras) {
  const c = centavos(total) - centavos(somaExtras(extras));
  return c < 0 ? null : real(c);
}

/**
 * A proposta do Conta Azul pra um boleto.
 * cob: { competencia, vencimento, valor, status, itens_extras }. itens: o que o Conta Azul tem a receber da empresa
 * ([{ parcela_id, descricao, categorias, vencimento, competencia, valor }], a função ca-vendas) — aqui fica só o que vence
 * no mês do boleto.
 * Devolve { mes, valor, itens_extras, total, antes: { valor, total }, situacao, mensalidade, avisos, itens }:
 *  - situacao: 'sobe' | 'desce' | 'recompoe' (o total fica, a composição muda) | 'igual' | 'sem_conta_azul' (nada vence
 *    no mês lá) | 'fechado' (o boleto já não está a emitir: não muda, só se compara);
 *  - mensalidade: 'conta_azul' (a da competência do boleto, ou a única do mês) | 'mantida' (o Conta Azul não tem
 *    mensalidade vencendo no mês: fica o valor de hoje);
 *  - avisos: textos curtos pra tela.
 */
export function propostaDoBoleto(cob, itens, { mei = false } = {}) {
  const mes = mesDoBoleto(cob);
  const comp = String((cob && cob.competencia) || '');
  const antes = { valor: real(centavos(cob && cob.valor)), total: totalDoBoleto(cob) };
  const extrasHoje = extrasDe(cob && cob.itens_extras);
  const doMes = (Array.isArray(itens) ? itens : [])
    .filter(i => i && i.parcela_id && String(i.vencimento || '').slice(0, 7) === mes && centavos(i.valor) > 0);
  // a venda que já está no boleto por fora (o adicional da janela do adicional): não entra de novo
  const vendasDeFora = new Set(extrasDeFora(extrasHoje).map(x => vendaDe(x.descricao)).filter(Boolean));
  const semAsDeFora = doMes.filter(i => !(vendaDe(i.descricao) && vendasDeFora.has(vendaDe(i.descricao))));
  const mensalidade = mensalidadeDoMes(semAsDeFora, comp, antes.valor);
  // a mensalidade de outro mês que vence neste não entra no boleto (decisão do Samuel, 05/11/2026: "mensalidade de outros
  // meses não devem ser somadas aos boletos"); a parcela de uma venda parcelada ("2/4 - Venda …") entra, mesmo de honorário
  const deOutroMes = semAsDeFora.filter(i => ehMensalidade(i) && !mensalidade.includes(i) && !ehParcela(i));
  const novos = semAsDeFora.filter(i => !deOutroMes.includes(i));
  const ignorados = new Set(extrasHoje.filter(x => x.ca_parcela_id && x.ignorado).map(x => String(x.ca_parcela_id)));
  const avisos = [];
  if (deOutroMes.length) avisos.push('Fica fora: ' + deOutroMes.map(i => rotuloDoItem(i, comp) + ' (' + brl(i.valor) + ')').join(', ')
    + ' — mensalidade de outro mês não entra no boleto.');

  const fechado = !!(cob && cob.status && cob.status !== 'a_emitir');
  if (!doMes.length) {
    return { mes, valor: antes.valor, itens_extras: extrasHoje, total: antes.total, antes, situacao: fechado ? 'fechado' : 'sem_conta_azul',
      mensalidade: 'mantida', confira: false, avisos: ['Nada desta empresa vence em ' + mesBR(mes) + ' no Conta Azul (ou ela não está ligada lá pelo CNPJ).'], itens: [], fora: [] };
  }
  const doContrato = real(mensalidade.reduce((s, i) => s + centavos(i.valor), 0));
  // o MEI: o escritório paga a guia do MEI (o DAS) e cobra junto, no boleto (o Samuel, 05/11/2026) — a guia não está no
  // Conta Azul, então o valor de hoje, maior que o contrato de lá, fica
  const ehMei = !!mei || mensalidade.some(i => categoriasDo(i).some(c => norm(c) === 'MEI - CONTRATOS'));
  const comGuia = ehMei && mensalidade.length && centavos(antes.valor) > centavos(doContrato);
  const valor = !mensalidade.length || comGuia ? antes.valor : doContrato;
  if (!mensalidade.length) avisos.push('O Conta Azul não tem a mensalidade vencendo em ' + mesBR(mes) + ': fica a de hoje, ' + brl(antes.valor) + '.');
  else if (comGuia) avisos.push('O valor de hoje fica: ' + brl(real(centavos(antes.valor) - centavos(doContrato))) + ' a mais que o contrato do Conta Azul (' + brl(doContrato) + '), a guia do MEI cobrada junto.');
  else if (centavos(valor) !== centavos(antes.valor)) avisos.push('A mensalidade passa de ' + brl(antes.valor) + ' para ' + brl(valor) + ', a do Conta Azul.');
  const doCA = novos.filter(i => !mensalidade.includes(i)).map(i => ({
    ca_parcela_id: String(i.parcela_id), descricao: rotuloDoItem(i, comp), valor: real(centavos(i.valor)),
    vencimento: String(i.vencimento || '').slice(0, 10) || null,
    ...(ignorados.has(String(i.parcela_id)) ? { ignorado: true } : {})
  }));
  const itens_extras = [...extrasDeFora(extrasHoje), ...doCA];
  const total = real(centavos(valor) + centavos(somaExtras(itens_extras)));
  const igualComposicao = centavos(valor) === centavos(antes.valor) && mesmaLista(extrasHoje, itens_extras);
  const situacao = fechado ? 'fechado'
    : centavos(total) > centavos(antes.total) ? 'sobe'
    : centavos(total) < centavos(antes.total) ? 'desce'
    : igualComposicao ? 'igual' : 'recompoe';
  if (fechado) avisos.push('O boleto já está ' + (cob.status === 'emitido' ? 'emitido' : cob.status === 'enviado' ? 'enviado' : cob.status === 'pago' ? 'pago' : cob.status) + ': não muda. No Conta Azul, vence ' + brl(total) + ' em ' + mesBR(mes) + '.');
  // pede conferência (e começa desmarcada): sem a mensalidade lá, o valor de hoje fica e os itens entram por cima — um
  // deles pode ser a própria mensalidade, noutra categoria e com outro valor; e o total que cai mais de 30%
  const confira = !fechado && situacao !== 'igual' && (!mensalidade.length || (situacao === 'desce' && centavos(total) < centavos(antes.total) * 0.7));
  if (confira && mensalidade.length) avisos.push('O total cai mais de 30%: confira se o Conta Azul não está sem algum item desta empresa.');
  return { mes, valor, itens_extras, total, antes, situacao, confira, mensalidade: mensalidade.length ? 'conta_azul' : 'mantida', avisos,
    itens: [...(comGuia ? [{ rotulo: 'Mensalidade com a guia do MEI', valor, mensalidade: true }]
      : mensalidade.map(i => ({ rotulo: rotuloDoItem(i, comp), valor: real(centavos(i.valor)), mensalidade: true }))),
      ...doCA.map(x => ({ rotulo: x.descricao, valor: x.valor, ignorado: !!x.ignorado }))],
    fora: deOutroMes.map(i => ({ rotulo: rotuloDoItem(i, comp), valor: real(centavos(i.valor)) })) };
}

/**
 * A mensalidade entre o que vence no mês: a das categorias da mensalidade com a competência do boleto; sem ela, o item
 * com o mesmo valor do boleto de hoje — o contrato lançado noutra categoria (o MEI em "MEI - SERVIÇOS PRESTADOS", a MU em
 * "SERVIÇOS EXTRAS") ou com a competência noutro mês —, da competência do boleto de preferência, fora o adicional anual e
 * as parcelas. Nada disso: [] (fica o valor de hoje, e a proposta pede conferência).
 */
export function mensalidadeDoMes(itens, competencia, valorDeHoje) {
  const daComp = i => String(i.competencia || '').slice(0, 7) === competencia;
  const mensais = itens.filter(ehMensalidade);
  if (mensais.some(daComp)) return mensais.filter(daComp);
  const mesmoValor = itens.filter(i => centavos(i.valor) === centavos(valorDeHoje) && centavos(valorDeHoje) > 0 && !ehParcela(i)
    && !categoriasDo(i).some(c => /ADICIONAL/.test(norm(c))));
  const escolhido = mesmoValor.find(daComp) || mesmoValor.find(ehMensalidade) || mesmoValor[0];
  return escolhido ? [escolhido] : [];
}

// a parcela de uma venda parcelada: "2/4 - Venda 190421319", "1/2 - Venda 190416834 1/2"
export const ehParcela = item => /^\s*\d+\s*\/\s*\d+\s*-/.test(String((item && item.descricao) || ''));

// a mesma lista de extras (o que muda o boleto: o item, o valor e se está tirado)
function chaveDoExtra(x) {
  return [x.ca_parcela_id || '', x.adicional_id || '', x.faturavel_id || '', centavos(x.valor), x.ignorado ? 1 : 0, x.ca_parcela_id ? '' : String(x.descricao || '')].join('|');
}
function mesmaLista(a, b) {
  const A = extrasDe(a).map(chaveDoExtra).sort(), B = extrasDe(b).map(chaveDoExtra).sort();
  return A.length === B.length && A.every((x, i) => x === B[i]);
}

const brl = v => 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * A conferência do mês: um boleto por empresa (as linhas da grade) e o que a função trouxe ({ itens: [{ cliente_id, … }],
 * soltas }). Devolve { propostas: [{ cobranca, proposta }], soltas, resumo }, a ordem: o que sobe e o que desce primeiro.
 */
export const ORDEM = ['desce', 'sobe', 'recompoe', 'sem_conta_azul', 'fechado', 'igual'];
export function conferirMes(cobrancas, dados, { ehMei = () => false } = {}) {
  const porCliente = new Map();
  for (const i of (dados && Array.isArray(dados.itens) ? dados.itens : [])) {
    if (!i || !i.cliente_id) continue;
    if (!porCliente.has(i.cliente_id)) porCliente.set(i.cliente_id, []);
    porCliente.get(i.cliente_id).push(i);
  }
  const propostas = (cobrancas || []).filter(c => c && c.cliente_id).map(c => ({ cobranca: c, proposta: propostaDoBoleto(c, porCliente.get(c.cliente_id) || [], { mei: !!ehMei(c.cliente_id) }) }));
  propostas.sort((a, b) => ORDEM.indexOf(a.proposta.situacao) - ORDEM.indexOf(b.proposta.situacao));
  const comBoleto = new Set((cobrancas || []).map(c => c && c.cliente_id));
  // o que vence no mês lá de empresa sem boleto aqui (ligada a uma empresa do cadastro que não está na grade)
  const semBoleto = [];
  for (const [cid, its] of porCliente) {
    if (comBoleto.has(cid)) continue;
    semBoleto.push({ cliente_id: cid, nome: its[0].cliente_nome || '', valor: real(its.reduce((s, i) => s + centavos(i.valor), 0)), itens: its.length });
  }
  const resumo = {};
  for (const s of ORDEM) resumo[s] = propostas.filter(p => p.proposta.situacao === s).length;
  resumo.diferenca = real(propostas.filter(p => ['sobe', 'desce'].includes(p.proposta.situacao))
    .reduce((s, p) => s + centavos(p.proposta.total) - centavos(p.proposta.antes.total), 0));
  return { propostas, semBoleto: semBoleto.sort((a, b) => b.valor - a.valor),
    soltas: (dados && Array.isArray(dados.soltas) ? dados.soltas : []).slice().sort((a, b) => (b.valor || 0) - (a.valor || 0)), resumo };
}

// o que a grade grava ao aplicar (só o boleto a emitir): o valor e os extras
export function gravacaoDaProposta(p) {
  return { valor: p.valor, itens_extras: p.itens_extras };
}

// a proposta que já vem marcada na janela: a que muda o boleto a emitir, salvo a que pede conferência
export const marcadaPorPadrao = p => !!p && ['sobe', 'desce', 'recompoe'].includes(p.situacao) && !p.confira;
