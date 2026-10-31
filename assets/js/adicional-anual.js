// ============================================================
// MACEDO & REIS — O honorário adicional anual (31/10/2026, pedido do Samuel): a lista empresa por empresa e a venda que
// vai pro Conta Azul. Puro (sem rede nem tela): a função ca-vendas monta a lista com ele, e a janela da tela Boletos
// (assets/js/adicional-anual-tela.js) mostra, soma e confere.
// A regra é a que os dados do Conta Azul mostram de 2023 a 2025 (o Samuel lançava à mão):
//  • quem paga: quem tem a mensalidade da competência (categoria HONORÁRIOS MENSAIS); o contrato MEI não paga;
//  • o valor: a mensalidade da competência (outubro, já com os reajustes do ano) — em 2025, 59 das 66 vendas;
//  • quem entrou no ano paga proporcional: 1/12 por mês desde a primeira mensalidade do ano (a MF Orquídeas entrou
//    em setembro de 2025 e pagou 4/12; com mensalidade em dezembro do ano anterior, o ano inteiro);
//  • quem tinha mensalidade no outubro anterior e não pagou o adicional é isento (contrato): fica desmarcado;
//  • a venda: data no último dia da competência, 1x, e a categoria, o serviço, a conta e o vendedor da venda do
//    adicional mais recente (a "modelo" — em 2025, o serviço HONORÁRIO ADICIONAL ANUAL); vence junto com o boleto da
//    competência, porque vai no mesmo boleto do honorário (decisão do Samuel, 31/10/2026), como item extra.
// Testes: tests/adicional-anual.test.mjs.
// ============================================================
import { diaUtil, somaDias, isoValida } from './rescisao-datas.js';

export const TIPO = 'adicional_anual';
export const CATEGORIA = 'HONORÁRIO ADICIONAL ANUAL';
export const CATEGORIA_MENSAL = 'HONORÁRIOS MENSAIS';
export const CATEGORIA_MEI = 'MEI - CONTRATOS';
export const COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;
export const ANOS_HISTORICO = 3;
export const MAX_VALOR = 100000;
export const MAX_POR_LOTE = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const ehUuid = v => UUID.test(String(v || ''));
export const centavos = v => Math.round(Number(v) * 100);
const real = c => Math.round(c) / 100;
const dois = n => String(n).padStart(2, '0');

// o último dia da competência ('2026-10' → '2026-10-31'): a data da venda
export function ultimoDia(comp) {
  const [a, m] = String(comp).split('-').map(Number);
  return comp + '-' + dois(new Date(Date.UTC(a, m, 0)).getUTCDate());
}
export const mesBR = comp => String(comp).slice(5, 7) + '/' + String(comp).slice(0, 4);
const anoDe = comp => Number(String(comp).slice(0, 4));
const mesAnterior = comp => { const [a, m] = comp.split('-').map(Number); return m === 1 ? (a - 1) + '-12' : a + '-' + dois(m - 1); };

// o mesmo dia no mês seguinte (o dia 31 vira o último dia do mês)
export function maisUmMes(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  const [na, nm] = m === 12 ? [a + 1, 1] : [a, m + 1];
  return na + '-' + dois(nm) + '-' + dois(Math.min(d, new Date(Date.UTC(na, nm, 0)).getUTCDate()));
}
export function proximoDiaUtil(iso) {
  let d = iso;
  for (let i = 0; i < 15 && !diaUtil(d); i++) d = somaDias(d, 1);
  return d;
}

// os meses do ano na carteira: com mensalidade em dezembro do ano anterior, 12; senão, da primeira mensalidade do ano
// até dezembro (13 − o mês dela)
export function mesesNoAno(primeira, ano) {
  if (!primeira || !COMPETENCIA.test(primeira)) return 12;
  const [a, m] = primeira.split('-').map(Number);
  if (a < ano) return 12;
  if (a > ano) return 0;
  return 13 - m;
}
export const proporcional = (valor, meses) => real(centavos(valor) * Math.max(0, Math.min(12, meses)) / 12);

// "Venda 190419223 / NFS-e:…" → 190419223; "2/3 - Venda …" → a parcela 2 de 3
export const numeroDaVenda = d => { const m = /Venda (\d+)/.exec(String(d || '')); return m ? Number(m[1]) : null; };
const parcelaDe = d => { const m = /^(\d+)\/(\d+)\b/.exec(String(d || '').trim()); return m ? { n: Number(m[1]), de: Number(m[2]) } : null; };

// uma parcela do Conta Azul — da API (contas a receber: cliente, categorias) ou do espelho (ca_parcelas:
// fornecedor_cliente_id) — no mesmo formato
export function parcelaNormal(p) {
  const x = p || {};
  const cats = (Array.isArray(x.categorias) ? x.categorias : []).map(c => String((c && c.nome) || '').trim().toUpperCase());
  return {
    pessoa: (x.cliente && x.cliente.id) || x.fornecedor_cliente_id || null,
    nome: String((x.cliente && x.cliente.nome) || x.fornecedor_cliente_nome || '').trim(),
    competencia: String(x.data_competencia || '').slice(0, 7),
    vencimento: isoValida(String(x.data_vencimento || '').slice(0, 10)) ? String(x.data_vencimento).slice(0, 10) : null,
    valor: Number(x.total) || 0,
    adicional: cats.includes(CATEGORIA),
    mensal: cats.includes(CATEGORIA_MENSAL),
    mei: cats.includes(CATEGORIA_MEI),
    numero: numeroDaVenda(x.descricao),
    parcela: parcelaDe(x.descricao)
  };
}

// o vencimento da venda: o do boleto da competência (o adicional vai no mesmo boleto); sem o boleto, o da mensalidade
// no Conta Azul — e, quando ela já venceu (a que vence dentro do mês), o mesmo dia no mês seguinte, no dia útil
export function vencimentoSugerido({ boleto = null, mensal = null, hoje }) {
  if (boleto && isoValida(boleto) && boleto >= hoje) return { data: boleto, de: 'boleto' };
  if (mensal && isoValida(mensal)) {
    if (mensal >= hoje) return { data: mensal, de: 'mensalidade' };
    let d = mensal;
    for (let i = 0; i < 24 && d < hoje; i++) d = maisUmMes(d);
    return { data: proximoDiaUtil(d), de: 'mensalidade_ajustada', antes: mensal };
  }
  return { data: null, de: null };
}

const somaPorPessoa = (lista, filtro) => {
  const m = new Map();
  for (const p of lista) {
    if (!p.pessoa || !filtro(p)) continue;
    const a = m.get(p.pessoa) || { pessoa: p.pessoa, nome: p.nome, valor: 0, vencimento: null, numeros: [], parcelas: 0, mei: false };
    a.valor = real(centavos(a.valor) + centavos(p.valor));
    a.parcelas += 1;
    a.mei = a.mei || p.mei;
    if (p.vencimento && (!a.vencimento || p.vencimento < a.vencimento)) a.vencimento = p.vencimento;
    if (p.numero && !a.numeros.includes(p.numero)) a.numeros.push(p.numero);
    if (!a.nome && p.nome) a.nome = p.nome;
    m.set(p.pessoa, a);
  }
  return m;
};

const GRUPOS = ['sugerida', 'nova', 'isenta', 'sem_mensal', 'mei', 'lancada'];
export const ROTULOS = {
  sugerida: 'Pagaram no ano passado',
  nova: 'Novas: confira',
  isenta: 'Isentas no ano passado',
  sem_mensal: 'Sem mensalidade agora',
  mei: 'Contratos MEI',
  lancada: 'Já lançadas'
};

// montarLista({ competencia, hoje, mensais, adicionais, lancadas, clientes, boletos }) → { itens, resumo, anos }
//  • mensais: parcelas (parcelaNormal) da mensalidade — a da competência, as do ano (desde dezembro do anterior, pra
//    contar os meses) e as de outubro dos anos do histórico;
//  • adicionais: parcelas (parcelaNormal) do adicional — o histórico e o que já existe na competência no Conta Azul;
//  • lancadas: as linhas de ca_vendas_lancadas da competência ({ id, ca_cliente_id, valor, vencimento, ca_venda_numero,
//    situacao, cobranca_id, cliente_id });
//  • clientes: Map pessoa → { id, nome } (o cadastro, pelo CNPJ ou CPF);
//  • boletos: Map cliente_id → { id, vencimento, status, itens_extras } (a grade da competência).
export function montarLista({ competencia, hoje, mensais = [], adicionais = [], lancadas = [], clientes = new Map(), boletos = new Map() }) {
  if (!COMPETENCIA.test(String(competencia || ''))) throw new Error('competência inválida');
  const ano = anoDe(competencia);
  const anos = Array.from({ length: ANOS_HISTORICO }, (_, i) => ano - ANOS_HISTORICO + i);
  const outubro = y => y + '-' + competencia.slice(5, 7);
  const dezAnterior = (ano - 1) + '-12';

  const atual = somaPorPessoa(mensais, p => p.competencia === competencia && (p.mensal || p.mei));
  const primeira = new Map();
  for (const p of mensais) {
    if (!p.pessoa || !(p.mensal || p.mei) || p.competencia < dezAnterior || p.competencia > competencia) continue;
    const a = primeira.get(p.pessoa);
    if (!a || p.competencia < a) primeira.set(p.pessoa, p.competencia);
  }
  const mensalNoAno = new Map(anos.map(y => [y, somaPorPessoa(mensais, p => p.competencia === outubro(y) && (p.mensal || p.mei))]));
  const adicionalNoAno = new Map(anos.map(y => [y, somaPorPessoa(adicionais, p => p.adicional && anoDe(p.competencia) === y && p.competencia !== competencia)]));
  const noContaAzul = somaPorPessoa(adicionais, p => p.adicional && p.competencia === competencia);
  const doSistema = new Map();
  for (const l of lancadas) if (l && ['lancando', 'lancada'].includes(l.situacao)) doSistema.set(l.ca_cliente_id, l);

  const pagouAntes = adicionalNoAno.get(ano - 1) || new Map();
  // quem pagou no lote do ano anterior (a competência de outubro) entra na lista mesmo sem a mensalidade de agora; o
  // adicional cobrado fora do lote (o proporcional de quem saiu no meio do ano) só conta no histórico
  const pagouNoLote = somaPorPessoa(adicionais, p => p.adicional && p.competencia === outubro(ano - 1));
  const pessoas = new Set([...atual.keys(), ...pagouNoLote.keys(), ...noContaAzul.keys(), ...doSistema.keys()]);
  const itens = [];
  for (const pessoa of pessoas) {
    const m = atual.get(pessoa) || null;
    const nome = (m && m.nome) || (pagouAntes.get(pessoa) || {}).nome || (noContaAzul.get(pessoa) || {}).nome || (doSistema.get(pessoa) || {}).cliente_nome || '';
    const historico = {};
    for (const y of anos) {
      const ad = adicionalNoAno.get(y).get(pessoa);
      const me = mensalNoAno.get(y).get(pessoa);
      historico[y] = ad ? { valor: ad.valor, parcelas: ad.parcelas }
        : me ? { isento: !me.mei, mei: me.mei, mensal: me.valor }
        : null;
    }
    const cli = clientes.get(pessoa) || null;
    const bol = cli ? boletos.get(cli.id) || null : null;
    const boletoAberto = bol && !['pago', 'cancelado'].includes(bol.status) ? bol : null;
    const meses = mesesNoAno(primeira.get(pessoa) || null, ano);
    const venc = vencimentoSugerido({ boleto: boletoAberto && boletoAberto.vencimento, mensal: m && m.vencimento, hoje });
    const base = {
      pessoa, nome, cliente_id: cli ? cli.id : null, cliente_nome: cli ? cli.nome : null,
      mensal: m ? { valor: m.valor, vencimento: m.vencimento, numeros: m.numeros, mei: m.mei } : null,
      historico, meses, primeira: primeira.get(pessoa) || null,
      vencimento: venc.data, vencimento_de: venc.de, vencimento_antes: venc.antes || null,
      boleto: bol ? { id: bol.id, vencimento: bol.vencimento, status: bol.status } : null
    };
    const sis = doSistema.get(pessoa);
    const ca = noContaAzul.get(pessoa);
    if (sis || ca) {
      const temNoBoleto = !!(sis && bol && Array.isArray(bol.itens_extras) && bol.itens_extras.some(x => x && x.adicional_id === sis.id));
      itens.push({ ...base, grupo: 'lancada', marcada: false,
        valor: sis ? Number(sis.valor) : ca.valor, vencimento: sis ? sis.vencimento : ca.vencimento,
        lancada: {
          id: sis ? sis.id : null, situacao: sis ? sis.situacao : 'lancada', de: sis ? 'sistema' : 'conta_azul',
          numero: sis ? sis.ca_venda_numero || null : ca.numeros[0] || null, no_boleto: temNoBoleto
        },
        motivo: sis ? (sis.situacao === 'lancando' ? 'Em lançamento: confira no Conta Azul.' : 'Lançada pelo sistema.')
          : 'Já existe no Conta Azul (lançada fora do sistema).' });
      continue;
    }
    const antes = pagouAntes.get(pessoa);
    const anoAntes = historico[ano - 1];
    if (m && m.mei) {
      itens.push({ ...base, grupo: 'mei', marcada: false, valor: proporcional(m.valor, meses), motivo: 'Contrato MEI: não paga o adicional.' });
    } else if (!m) {
      itens.push({ ...base, grupo: 'sem_mensal', marcada: false, valor: antes ? antes.valor : null,
        motivo: 'Pagou em ' + (ano - 1) + ', mas não tem mensalidade de ' + mesBR(competencia) + ' no Conta Azul.' });
    } else if (antes) {
      itens.push({ ...base, grupo: 'sugerida', marcada: true, valor: proporcional(m.valor, meses),
        motivo: meses < 12 ? 'Pagou em ' + (ano - 1) + '. Proporcional: ' + meses + '/12.' : 'Pagou em ' + (ano - 1) + '. A mensalidade de ' + mesBR(competencia) + '.' });
    } else if (anoAntes && anoAntes.isento) {
      itens.push({ ...base, grupo: 'isenta', marcada: false, valor: proporcional(m.valor, meses),
        motivo: 'Tinha mensalidade em ' + mesBR(outubro(ano - 1)) + ' e não pagou o adicional: isenta?' });
    } else {
      const p = primeira.get(pessoa);
      itens.push({ ...base, grupo: 'nova', marcada: true, valor: proporcional(m.valor, meses),
        motivo: meses < 12 ? 'Primeira mensalidade em ' + mesBR(p) + ': ' + meses + '/12.'
          : 'Sem mensalidade em ' + mesBR(outubro(ano - 1)) + ' (ou era MEI): o ano inteiro.' });
    }
  }
  itens.sort((a, b) => GRUPOS.indexOf(a.grupo) - GRUPOS.indexOf(b.grupo) || a.nome.localeCompare(b.nome, 'pt-BR'));
  return { itens, anos, resumo: resumoDaLista(itens) };
}

// os números do alto: quantas em cada grupo e o total das marcadas
export function resumoDaLista(itens) {
  const r = { total: 0, marcadas: 0, valor: 0, grupos: Object.fromEntries(GRUPOS.map(g => [g, 0])) };
  let c = 0;
  for (const i of itens || []) {
    r.total++;
    if (r.grupos[i.grupo] !== undefined) r.grupos[i.grupo]++;
    if (i.marcada && i.grupo !== 'lancada' && Number(i.valor) > 0) { r.marcadas++; c += centavos(i.valor); }
  }
  r.valor = real(c);
  return r;
}

// a venda modelo: a do adicional mais recente (o detalhe e os itens dela, da API do Conta Azul) — a categoria, o
// serviço, a conta e o vendedor que as novas copiam. Sem um serviço só, ou sem a categoria, não serve.
export function modeloDaVenda(detalhe, itens) {
  const v = detalhe && detalhe.venda;
  const cp = (v && v.condicao_pagamento) || {};
  const servicos = ((itens && itens.itens) || []).filter(i => i && String(i.tipo || '').toUpperCase() === 'SERVICO' && ehUuid(i.id_item));
  if (!v || !ehUuid(v.id_categoria) || servicos.length !== 1) return null;
  return {
    numero: v.numero || null, data: String(v.data_compromisso || '').slice(0, 10) || null,
    cliente: (detalhe.cliente && detalhe.cliente.nome) || null,
    id_categoria: v.id_categoria, id_centro_custo: ehUuid(v.id_centro_custo) ? v.id_centro_custo : null,
    id_vendedor: detalhe.vendedor && ehUuid(detalhe.vendedor.id) ? detalhe.vendedor.id : null,
    vendedor: (detalhe.vendedor && detalhe.vendedor.nome) || null,
    id_conta_financeira: ehUuid(cp.id_conta_financeira) ? cp.id_conta_financeira : null,
    tipo_pagamento: cp.tipo_pagamento ? String(cp.tipo_pagamento) : null,
    id_servico: servicos[0].id_item, servico: servicos[0].nome || null
  };
}

// a venda pra API do Conta Azul (POST /v1/venda), copiando a modelo
export function vendaParaApi({ modelo, pessoa, valor, vencimento, numero, dataVenda }) {
  const v = real(centavos(valor));
  return {
    id_cliente: pessoa,
    numero,
    situacao: 'APROVADO',
    data_venda: dataVenda,
    id_categoria: modelo.id_categoria,
    ...(modelo.id_centro_custo ? { id_centro_custo: modelo.id_centro_custo } : {}),
    ...(modelo.id_vendedor ? { id_vendedor: modelo.id_vendedor } : {}),
    itens: [{ id: modelo.id_servico, quantidade: 1, valor: v }],
    condicao_pagamento: {
      ...(modelo.tipo_pagamento ? { tipo_pagamento: modelo.tipo_pagamento } : {}),
      ...(modelo.id_conta_financeira ? { id_conta_financeira: modelo.id_conta_financeira } : {}),
      opcao_condicao_pagamento: '1x',
      parcelas: [{ data_vencimento: vencimento, valor: v }]
    }
  };
}

// o item que a tela manda pra lançar: a pessoa do Conta Azul, o valor, o vencimento (de hoje em diante) e, se tem,
// a empresa do cadastro (pro boleto). Fora disso, o motivo.
export function limparItem(x, { hoje }) {
  const i = x && typeof x === 'object' ? x : {};
  const pessoa = String(i.pessoa || '');
  if (!ehUuid(pessoa)) return { erro: 'empresa do Conta Azul inválida' };
  const c = centavos(i.valor);
  if (!Number.isFinite(c) || c <= 0) return { erro: 'o valor tem de ser maior que zero' };
  if (c > MAX_VALOR * 100) return { erro: 'valor acima de R$ 100.000,00' };
  const venc = String(i.vencimento || '');
  if (!isoValida(venc)) return { erro: 'vencimento inválido' };
  if (venc < hoje) return { erro: 'o vencimento já passou' };
  const nome = String(i.nome || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  return { pessoa, valor: real(c), vencimento: venc, nome, cliente_id: ehUuid(i.cliente_id) ? String(i.cliente_id) : null };
}

// o item extra do boleto (o mesmo formato dos faturáveis: descrição e valor; o adicional_id liga à venda lançada)
export function extraDoAdicional(l) {
  return { adicional_id: l.id, descricao: 'Honorário adicional anual' + (l.ca_venda_numero ? ' (venda ' + l.ca_venda_numero + ')' : ''), valor: real(centavos(l.valor)) };
}
export const comExtra = (extras, extra) => [...(Array.isArray(extras) ? extras : []).filter(x => x && x.adicional_id !== extra.adicional_id), extra];
export const semExtra = (extras, id) => (Array.isArray(extras) ? extras : []).filter(x => x && x.adicional_id !== id);
export const temExtra = (extras, id) => (Array.isArray(extras) ? extras : []).some(x => x && x.adicional_id === id);

// a tarefa da Thalia pras NFS-e (quem emite as notas no Conta Azul): uma linha ☐ por venda, pela ordem do nome
export function tarefaDasNotas({ competencia, vendas }) {
  const lista = (vendas || []).filter(v => v && v.numero).slice().sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
  const brl = v => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return {
    titulo: 'Emitir as NFS-e do honorário adicional anual (' + mesBR(competencia) + ')',
    descricao: 'As vendas do honorário adicional anual que o sistema lançou no Conta Azul (serviço HONORÁRIO ADICIONAL ANUAL, o mesmo de '
      + (anoDe(competencia) - 1) + '). Emita a NFS-e de cada uma no Conta Azul:\n'
      + lista.map(v => '☐ ' + v.nome + ' — venda ' + v.numero + ' — R$ ' + brl(v.valor)).join('\n')
  };
}
