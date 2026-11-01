// ============================================================
// MACEDO & REIS — O contrato da mensalidade no Conta Azul (31/10/2026, pedido do Samuel: "pq tu não cadastra e faz o
// contrato? só seguir o padrão de como são feitos os demais"). Puro (sem rede): a função ca-vendas monta e confere com
// ele, e o cartão do vigia mostra o que vai ser criado. O padrão é o dos contratos de setembro de 2026 (Bar da Deja,
// Vanir, Diones), conferidos pela API:
//  • mensal, sem data pra acabar (NUNCA — o Conta Azul pede uma data de fim mesmo assim: a do início + 335 dias, como
//    nos de setembro), a venda emitida no dia 31 (a competência no último dia do mês), sem forma de pagamento;
//  • o vencimento no dia da base de cobrança (o da tela Boletos; sem base, 10), a primeira no mês seguinte ao do início;
//  • a conta do Inter pra quem tem boleto do Inter (a base ativa); sem base, a da última venda do contrato modelo;
//  • o serviço e a categoria HONORÁRIOS MENSAIS (os da última venda de um contrato ativo — o modelo); o MEI (o regime no
//    cadastro), MEI - CONTRATOS, com o modelo de um contrato de MEI;
//  • o valor: o honorário da proposta fechada, senão o da base de cobrança;
//  • o início: o mês de entrada na carteira (a primeira mensalidade é a desse mês), se ela entrou no mês passado ou
//    depois; quem entrou antes (o cliente antigo sem contrato) começa no mês de hoje — o Conta Azul emitiria de uma vez as
//    vendas dos meses que ficaram pra trás;
//  • o vendedor: o sócio que confirma (SAMUEL REIS, DIEGO REIS), pelo nome, entre os vendedores dos contratos.
// O cadastro da empresa no Conta Azul, quando ela ainda não está lá: a razão social, o fantasia, o CNPJ (ou o CPF), o
// e-mail e o telefone do cadastro, o endereço do cadastro (sem ele, o da Receita) e o perfil Cliente.
// Testes: tests/contrato-ca.test.mjs.
// ============================================================
import { nomePorEmail } from './equipe.js';

export const DIA_EMISSAO = 31;
// os tipos de contrato: a categoria da mensalidade no Conta Azul (o modelo é um contrato ativo dessa categoria)
export const TIPOS = { mensal: 'HONORÁRIOS MENSAIS', mei: 'MEI - CONTRATOS' };
export const tipoPeloRegime = regime => (/^\s*MEI\s*$/i.test(String(regime || '')) ? 'mei' : 'mensal');
export const DIAS_ATE_O_FIM = 335;
export const MAX_VALOR = 100000;
const COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;
const dois = n => String(n).padStart(2, '0');
export const digitos = s => String(s || '').replace(/\D/g, '');
const semAcento = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();

const somaDias = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const mesSeguinte = comp => { const [a, m] = comp.split('-').map(Number); return m === 12 ? (a + 1) + '-01' : a + '-' + dois(m + 1); };
const mesAnterior = comp => { const [a, m] = comp.split('-').map(Number); return m === 1 ? (a - 1) + '-12' : a + '-' + dois(m - 1); };
const diasDoMes = comp => { const [a, m] = comp.split('-').map(Number); return new Date(Date.UTC(a, m, 0)).getUTCDate(); };
export const mesBR = comp => String(comp).slice(5, 7) + '/' + String(comp).slice(0, 4);

// o vencimento da primeira mensalidade: o dia do contrato no mês seguinte ao do início (o 31 vira o último dia do mês)
export function primeiroVencimento(inicio, dia) {
  const prox = mesSeguinte(inicio);
  return prox + '-' + dois(Math.min(Number(dia), diasDoMes(prox)));
}
export const fimDoContrato = inicio => somaDias(inicio + '-01', DIAS_ATE_O_FIM);

// o mês de início: o da entrada na carteira, se foi do mês passado ao que vem; entrou antes, o mês de hoje (sem as vendas
// dos meses pra trás); depois, o mês que vem
export function inicioDoContrato(entrada, hoje) {
  const mes = String(hoje).slice(0, 7);
  const de = /^\d{4}-\d{2}/.test(String(entrada || '')) ? String(entrada).slice(0, 7) : mes;
  const minimo = mesAnterior(mes), maximo = mesSeguinte(mes);
  return de < minimo ? mes : de > maximo ? maximo : de;
}
// os meses que o pedido aceita: o passado, o de hoje e o que vem
export const mesesDeInicio = hoje => { const mes = String(hoje).slice(0, 7); return [mesAnterior(mes), mes, mesSeguinte(mes)]; };

// o que o contrato vai ter, pelo que o sistema sabe da empresa → { tipo: 'mensal' | 'mei', valor, dia, inicio,
// primeiro_vencimento, data_fim, conta: 'inter' | 'modelo', de: { valor, dia, inicio }, faltam: [o que falta pra criar] }
export function contratoSugerido({ cadastro = null, base = null, proposta = null, entrada = null, hoje }) {
  const faltam = [];
  const hon = proposta && Number(proposta.honorario) > 0 ? Number(proposta.honorario) : null;
  const vb = base && Number(base.valor_base) > 0 ? Number(base.valor_base) : null;
  const valor = hon || vb;
  if (!valor) faltam.push('o valor da mensalidade (sem proposta fechada nem base de cobrança)');
  const d = base ? Number(base.dia_vencimento) : NaN;
  const dia = Number.isInteger(d) && d >= 1 && d <= 31 ? d : 10;
  const doc = digitos(cadastro && cadastro.documento);
  if (doc.length !== 14 && doc.length !== 11) faltam.push('o CNPJ ou o CPF no cadastro');
  const inicio = inicioDoContrato(entrada, hoje);
  return {
    tipo: tipoPeloRegime(cadastro && cadastro.regime_tributario), valor, dia, inicio,
    primeiro_vencimento: primeiroVencimento(inicio, dia),
    data_fim: fimDoContrato(inicio),
    conta: base && base.ativo ? 'inter' : 'modelo',
    de: { valor: hon ? 'proposta' : vb ? 'base' : null, dia: Number.isInteger(d) && d >= 1 && d <= 31 ? 'base' : 'padrao', inicio: entrada ? 'carteira' : 'hoje' },
    faltam
  };
}

// o pedido de criar (o que a tela manda) → o item limpo, ou o motivo
export function limparPedido(x, { hoje }) {
  const i = x && typeof x === 'object' ? x : {};
  const cliente = String(i.cliente_id || '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cliente)) return { erro: 'empresa do cadastro inválida' };
  const valor = Math.round(Number(i.valor) * 100) / 100;
  if (!Number.isFinite(valor) || valor <= 0) return { erro: 'o valor tem de ser maior que zero' };
  if (valor > MAX_VALOR) return { erro: 'valor acima de R$ 100.000,00' };
  const dia = Number(i.dia);
  if (!Number.isInteger(dia) || dia < 1 || dia > 31) return { erro: 'o dia do vencimento vai de 1 a 31' };
  const inicio = String(i.inicio || '');
  if (!COMPETENCIA.test(inicio)) return { erro: "o mês de início vai em 'AAAA-MM'" };
  if (!mesesDeInicio(hoje).includes(inicio)) return { erro: 'o início vai do mês passado ao que vem' };
  const tipo = i.tipo == null || i.tipo === '' ? 'mensal' : String(i.tipo);
  if (!Object.keys(TIPOS).includes(tipo)) return { erro: 'o tipo do contrato é mensal ou mei' };
  return { cliente_id: cliente, valor, dia, inicio, tipo };
}

// o endereço: o do cadastro; sem ele, o da Receita (BrasilAPI), com a cidade do cadastro quando ele tem
export function enderecoDaEmpresa(c, receita = null) {
  const temCadastro = !!(String(c.cep || '').trim() || String(c.logradouro || '').trim());
  const r = receita || {};
  const fonte = temCadastro ? {
    cep: digitos(c.cep), logradouro: c.logradouro, numero: c.numero, complemento: c.complemento, bairro: c.bairro, cidade: c.cidade, estado: c.uf
  } : receita ? {
    cep: digitos(r.cep), logradouro: [r.descricao_tipo_de_logradouro, r.logradouro].filter(Boolean).join(' '), numero: r.numero,
    complemento: r.complemento, bairro: r.bairro, cidade: c.cidade || r.municipio, estado: c.uf || r.uf
  } : null;
  if (!fonte) return null;
  const limpo = {};
  for (const [k, v] of Object.entries(fonte)) { const t = String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); if (t) limpo[k] = t; }
  if (!limpo.logradouro && !limpo.cep) return null;
  return { ...limpo, pais: 'Brasil' };
}

// o cadastro da empresa no Conta Azul (POST /v1/pessoas), como os de setembro de 2026
export function pessoaParaApi(c, receita = null) {
  const doc = digitos(c.documento);
  const pj = doc.length === 14;
  const email = String(c.email_principal || '').replace(/;/g, ',').replace(/\s+/g, '').slice(0, 100);
  const fone = digitos(c.telefone_principal);
  const end = enderecoDaEmpresa(c, receita);
  return {
    nome: String(c.nome_principal || '').replace(/\s+/g, ' ').trim().slice(0, 200),
    tipo_pessoa: pj ? 'Jurídica' : 'Física',
    ...(pj ? { cnpj: doc } : { cpf: doc }),
    ...(c.nome_fantasia && String(c.nome_fantasia).trim() ? { nome_fantasia: String(c.nome_fantasia).replace(/\s+/g, ' ').trim().slice(0, 200) } : {}),
    ...(email ? { email, contato_cobranca_faturamento: { emails: email.split(',').filter(Boolean) } } : {}),
    ...(fone.length >= 10 ? { telefone_comercial: fone } : {}),
    ...(end ? { enderecos: [end] } : {}),
    perfis: [{ tipo_perfil: 'Cliente' }]
  };
}

// o vendedor: o sócio que confirma, pelo primeiro nome, entre os vendedores dos contratos ({ id, nome })
export function vendedorDoSocio(vendedores, email) {
  const nome = semAcento(nomePorEmail(String(email || '').replace(/\s*\(.*$/, '')));
  if (!nome) return null;
  const v = (vendedores || []).find(x => x && x.id && semAcento(x.nome).split(' ')[0] === nome);
  return v ? { id: v.id, nome: v.nome } : null;
}

// o contrato (POST /v1/contratos), como os de setembro de 2026; a forma de pagamento só se o Conta Azul exigir
export function contratoParaApi({ pessoa, valor, dia, inicio, numero, conta = null, modelo, vendedor = null, tipoPagamento = null }) {
  const v = Math.round(Number(valor) * 100) / 100;
  return {
    id_cliente: pessoa,
    termos: {
      data_inicio: inicio + '-01', data_fim: fimDoContrato(inicio), dia_emissao_venda: Number(modelo.dia_emissao_venda) || DIA_EMISSAO,
      intervalo_frequencia: 1, numero, tipo_expiracao: 'NUNCA', tipo_frequencia: 'MENSAL'
    },
    condicao_pagamento: {
      dia_vencimento: dia, primeira_data_vencimento: primeiroVencimento(inicio, dia),
      ...(tipoPagamento ? { tipo_pagamento: tipoPagamento } : {}),
      ...(conta ? { id_conta_financeira: conta } : {})
    },
    itens: [{ id: modelo.id_servico, quantidade: 1, valor: v }],
    id_categoria: modelo.id_categoria,
    ...(vendedor ? { id_vendedor: vendedor } : {})
  };
}

// o resumo do contrato pra quem confirma: "R$ 1.500,00 por mês, vencendo dia 10, a partir de 10/2026 (a primeira em 10/11/2026)"
export function resumoDoContrato({ valor, dia, inicio }) {
  const brl = Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pv = primeiroVencimento(inicio, dia).split('-').reverse().join('/');
  return 'R$ ' + brl + ' por mês, vencendo dia ' + dia + ', a partir de ' + mesBR(inicio) + ' (a primeira em ' + pv + ')';
}
