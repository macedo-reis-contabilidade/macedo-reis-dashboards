// ============================================================
// MACEDO & REIS — Comparativo tributário: o estudo de uma empresa
// Módulo ES puro (a leitura do banco vem de fora, pela função `ler`): o que a tela abre e o assistente do escritório lê —
// o estudo gravado ou os números do sistema, as empresas dos mesmos sócios, os padrões — e a conta inteira (o comparar,
// as premissas que viram o resultado, o roteiro das fases, os prazos, o que muda o resultado e os avisos). Uma regra só
// pra tela (fiscal-comparativo.html) e pro assistente (a ferramenta comparativo da função assistente — pergunta do
// Samuel, 01/11/2026: "o assistente sabe tirar dúvidas sobre o comparativo?"), com o "e se" do assistente (os números
// trocados só na conta, nada gravado). Desde 11/11/2026, o comparativo escolhido (entrada.objetivo: só o Presumido contra o
// Real, ou os três), o que o cadastro veda no Simples (simples-vedacoes.js), a contabilidade feita até que mês (o Controle
// das contabilidades) e a precisão do estudo. Também de 11/11/2026: o lucro da contabilidade até onde ela está feita (o
// período da DRE e o fator que o leva aos 12 meses: periodoDaDre) e o que o Domínio mostra desses meses (contabil.meses:
// a folha ou a escrita fiscal que não entraram, a conta transitória com saldo, o caixa negativo), pra confirmação de quem
// cuida da contabilidade. Testado por tests/comparativo-estudo.test.mjs.
// ============================================================

import { comparar, testarPremissas, REGIMES, ROTULO_REGIME, TIPOS, OBJETIVOS, regimesDoObjetivo } from './comparativo-motor.js';
import { entradaDoSistema, empresasDosSocios, receitaDaEmpresa, situacaoDoGrupo, premissasParaTestar, prazosDaEscolha, foraDaSoma, avisoDaSoma, mesclarSerie, CAMPOS_PONTE,
  objetivoSugerido, objetivoValido, porQueDoObjetivo, rotuloComp, periodoDaDre } from './comparativo-dados.js';
import { roteiroDoEstudo, ultimoMesFechado, precisaoDoEstudo } from './comparativo-roteiro.js';
import { vedacoesDoSimples, resumoDasVedacoes, linhaDasVedacoes } from './simples-vedacoes.js';
import { resumoDaEmpresa as resumoDoControle, mapaDosMeses, estadoDoMes, dominioPorMes, andamentoDaEmpresa, problemasDoMes, folhaCalculada, CAMPOS_DOMINIO, ultimoFechavel } from './contabil-controle.js';

const brl = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (v, d = 1) => (Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: d });
const num = v => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

// ---------- os padrões (os mesmos do motor): ficam na entrada pra aparecer nos campos ----------
export const PADROES = { compras: 0, aliqCreditoIcms: 12, pctComprasSimples: 0, despesasCredito: 0, outrasDespesas: 0, difalSimples: 0,
  folha: 0, proLabore: 0, rat: 2, fap: 1, terceiros: 5.8, cprb: null, crescimentoReceita: 0, crescimentoFolha: 0, semLc224: false,
  mix: { cheia: 100, red60: 0, red40: 0, red30: 0, zero: 0 }, pctImpostoEmbutido: null, pctComprasComCredito: null,
  lucroContabil: null, ajustesLalur: 0 };
export const PADRAO_ATIV = a => ({ aliqIcms: 17, aliqIss: 3, pctST: 0, pctMonofasico: 0, pctAliqZero: 0, aliqZeroCesta: false, aliqIpi: 0, redIcms: 0, redIcmsSimples: 0, ...a });
export function comPadroes(e) {
  const out = { ...PADROES, ...e, mix: { ...PADROES.mix, ...(e && e.mix) } };
  out.atividades = ((e && e.atividades) || [{ tipo: 'comercio', receita: 0 }]).map(PADRAO_ATIV);
  // o comparativo escolhido: só um dos dois nomes (o que veio do banco com outro valor volta à pergunta)
  if (out.objetivo != null && !objetivoValido(out.objetivo)) delete out.objetivo;
  return out;
}
export const ORIGENS_PADRAO = {
  crescimentoReceita: { fonte: 'padrao', texto: 'padrão: sem crescimento', dica: 'os 12 meses se repetem nos anos seguintes' },
  crescimentoFolha: { fonte: 'padrao', texto: 'padrão: sem crescimento', dica: 'os 12 meses se repetem nos anos seguintes' },
  fap: { fonte: 'padrao', texto: 'padrão: 1' },
  pctComprasSimples: { fonte: 'padrao', texto: 'padrão: nenhuma', dica: 'em 2027 o crédito de CBS/IBS de compra de fornecedor do Simples é só o que ele pagou no DAS' },
  difalSimples: { fonte: 'padrao', texto: 'padrão: nada', dica: 'diferencial de alíquota e antecipação do ICMS que o optante paga fora do DAS no ano' },
  despesasCredito: { fonte: 'padrao', texto: 'falta no sistema' },
  cprb: { fonte: 'padrao', texto: 'vazio: sem desoneração', dica: 'preencha a alíquota cheia da CPRB se a empresa está na desoneração da folha' },
  lucroContabil: { fonte: 'padrao', texto: 'vazio: a conta estima o lucro', dica: 'o resultado da DRE antes do IRPJ e da CSLL, até onde a contabilidade está feita (prejuízo, com o sinal de menos). Sem ele, a conta estima o lucro do Real pelas compras, a folha e as despesas' },
  ajustesLalur: { fonte: 'padrao', texto: 'padrão: sem ajustes', dica: 'adições (despesa indedutível: multa, brinde, doação) menos exclusões (receita que não é tributada) do lucro real' }
};

// ---------- os campos: o nome e a unidade de cada um (a tela e o assistente falam igual) ----------
export const CAMPOS = {
  compras: { rotulo: 'Compras de mercadorias e insumos', un: 'R$' },
  aliqCreditoIcms: { rotulo: 'Crédito de ICMS das compras', un: '%' },
  pctComprasSimples: { rotulo: 'Compras de fornecedor do Simples', un: '%' },
  despesasCredito: { rotulo: 'Despesas com crédito (energia, aluguel de empresa, frete)', un: 'R$' },
  outrasDespesas: { rotulo: 'Outras despesas (o resto dos custos)', un: 'R$' },
  lucroContabil: { rotulo: 'Lucro contábil antes do IRPJ e da CSLL (a DRE)', un: 'R$' },
  ajustesLalur: { rotulo: 'Adições menos exclusões do lucro real', un: 'R$' },
  difalSimples: { rotulo: 'ICMS pago fora do DAS (diferencial e antecipação)', un: 'R$' },
  folha: { rotulo: 'Folha (salários, 13º e férias)', un: 'R$' },
  proLabore: { rotulo: 'Pró-labore', un: 'R$' },
  rat: { rotulo: 'RAT', un: '%' }, fap: { rotulo: 'FAP', un: '' }, terceiros: { rotulo: 'Terceiros (sistema S)', un: '%' },
  cprb: { rotulo: 'CPRB (desoneração da folha)', un: '%' },
  crescimentoReceita: { rotulo: 'Crescimento da receita', un: '% ao ano' }, crescimentoFolha: { rotulo: 'Crescimento da folha', un: '% ao ano' },
  pctImpostoEmbutido: { rotulo: 'Imposto embutido nas compras (ICMS, ST, IPI)', un: '%' },
  pctComprasComCredito: { rotulo: 'Compras com crédito cheio de CBS/IBS (pelo NCM)', un: '%' },
  'mix.cheia': { rotulo: 'Vendas com alíquota cheia', un: '%' }, 'mix.red60': { rotulo: 'Com redução de 60%', un: '%' }, 'mix.red30': { rotulo: 'Com redução de 30%', un: '%' },
  'mix.red40': { rotulo: 'Bares e restaurantes (−40%)', un: '%' }, 'mix.zero': { rotulo: 'Alíquota zero', un: '%' },
  'ativ.receita': { rotulo: 'Receita dos 12 meses', un: 'R$' }, 'ativ.aliqIcms': { rotulo: 'ICMS das vendas', un: '%' }, 'ativ.pctST': { rotulo: 'Vendas com ICMS-ST', un: '%' },
  'ativ.pctMonofasico': { rotulo: 'Revenda monofásica (PIS/Cofins)', un: '%' }, 'ativ.pctAliqZero': { rotulo: 'Vendas com alíquota zero de PIS/Cofins', un: '%' }, 'ativ.aliqIss': { rotulo: 'ISS', un: '%' },
  'ativ.presIrpj': { rotulo: 'Presunção do IRPJ', un: '%' }, 'ativ.presCsll': { rotulo: 'Presunção da CSLL', un: '%' },
  'ativ.aliqIpi': { rotulo: 'IPI a recolher em 2026 (Presumido e Real)', un: '%' },
  'ativ.redIcms': { rotulo: 'Redução da base do ICMS no regime geral', un: '%' }, 'ativ.redIcmsSimples': { rotulo: 'Redução do ICMS no DAS', un: '%' },
  'grupo.receita': { rotulo: 'Receita dos 12 meses', un: 'R$' }
};

// a tabela dos estudos ainda não existe no banco (a tela segue sem gravar)
export const erroSemTabela = e => !!e && (e.code === 'PGRST205' || e.code === '42P01' || /comparativos/.test(e.message || '') && /(exist|find|schema)/i.test(e.message || ''));

// a entrada como o motor lê: os padrões vazios (null) ficam de fora pra o motor usar os dele; aliq2027: a CBS de 2027
// (rt_parametros.aliq_ref_2027); objetivo: o comparativo escolhido (sem ele, o da entrada; sem nenhum, os três regimes)
export function entradaDoMotor(entrada, aliq2027 = null, objetivo = null) {
  const e = JSON.parse(JSON.stringify(entrada || {}));
  ['cprb', 'pctImpostoEmbutido', 'pctComprasComCredito', 'lucroContabil'].forEach(k => { if (e[k] == null || e[k] === '') delete e[k]; });
  return { ...e, aliq2027, regimes: regimesDoObjetivo(objetivoValido(objetivo) || objetivoValido(e.objetivo)) };
}

// ---------- qual comparativo ----------
// o comparativo do estudo: o escolhido na tela (entrada.objetivo), senão o que o sistema sugere pelo regime de hoje e pelo
// que o cadastro veda no Simples
export function objetivoDoEstudo(entrada, vedacoes = null, objetivo = null) {
  return objetivoValido(objetivo) || objetivoValido(entrada && entrada.objetivo) || objetivoSugerido(entrada && entrada.regimeAtual, vedacoes);
}
// as duas opções, como a tela pergunta: [{ id, rotulo, texto, sugerido, porque, nota }] — porque: o motivo da sugerida ·
// nota: só na opção com o Simples, o que o cadastro diz dos impedimentos dele, numa linha (linhaDasVedacoes): é ali que
// isso ajuda a escolher; fora dela, o Simples não entra na conversa
export function opcoesDeObjetivo(regimeAtual, vedacoes = null) {
  const sug = objetivoSugerido(regimeAtual, vedacoes);
  return Object.entries(OBJETIVOS).map(([id, x]) => ({ id, rotulo: x.rotulo, texto: x.texto, sugerido: id === sug, porque: id === sug ? porQueDoObjetivo(regimeAtual, vedacoes) : '',
    nota: x.regimes.includes('simples') ? linhaDasVedacoes(vedacoes) : '' }));
}

// ---------- abrir a empresa: o que o sistema sabe e o estudo gravado ----------
// ler(tabela, { cols, eq: { coluna: valor }, em: { coluna: [valores] }, ordem: { coluna, desc }, limite }) → { data, error }
// (a tela, pelo supabase-js; o assistente, pelo PostgREST com o login de quem pergunta). cliente: a linha do cadastro
// ({ id, nome_principal, nome_fantasia, documento, regime_tributario, cnae_principal, cidade, uf }). cadastroDe(ids) →
// Map(id → { id, nome_principal, nome_fantasia }) (opcional: a tela já tem a lista; sem ela, lê do banco).
// Volta o estudo como a tela abre — o gravado (o que a equipe digitou e conferiu) ou, sem ele, os números do sistema —, o
// que o sistema sabe hoje (sistema: o "Recomeçar com os números do sistema") e as outras empresas dos mesmos sócios. O CPF
// dos sócios só casa as empresas: não sai daqui (nem na volta, nem pro assistente).
async function lerCadastro(ler, ids) {
  const r = await ler('clientes', { cols: 'id, nome_principal, nome_fantasia', em: { id: ids } });
  return new Map(((r && r.data) || []).map(k => [k.id, k]));
}
// o dia de hoje em Brasília ('AAAA-MM-DD'), pros meses fechados do Domínio
const hojeEmBrasilia = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
// o Domínio pela ponte (05/11/2026): só os meses fechados — o último mês fechado é o do roteiro (o do PGDAS que já venceu)
const soFechados = (linhas, fechado) => (linhas || []).filter(l => l && fechado && String(l.competencia) <= fechado);
export async function carregarEstudo({ ler, cliente, cadastroDe = null, hoje = null }) {
  const c = cliente;
  const fechado = ultimoMesFechado(hoje || hojeEmBrasilia());
  // o Domínio do mês: os números do estudo (CAMPOS_PONTE) e o andamento da contabilidade (CAMPOS_DOMINIO, a versão 3)
  const colsDominio = [...new Set([...CAMPOS_PONTE, ...CAMPOS_DOMINIO, 'ultimo_lancamento', 'incluido_ate'])].join(', ');
  const [rCaso, rFr, rPg, rEst, rDom, rRec, rCtb, rCtbM, rFoto] = await Promise.all([
    ler('rt_casos', { cols: 'id, anexo, rbt12, receita_mensal, sim_obs, atualizado_em', eq: { cliente_id: c.id }, ordem: { coluna: 'atualizado_em', desc: true }, limite: 1 }),
    ler('fr_empresas', { cols: 'id', eq: { cliente_id: c.id }, limite: 1 }),
    ler('receita_pgdas', { cols: 'competencia, receita_mes', eq: { cliente_id: c.id }, ordem: { coluna: 'competencia', desc: true }, limite: 12 }),
    ler('comparativos', { cols: 'id, entrada, atualizado_em, atualizado_por', eq: { cliente_id: c.id }, ordem: { coluna: 'atualizado_em', desc: true }, limite: 1 }),
    ler('dominio_mensal', { cols: 'codigo, competencia, ' + colsDominio, eq: { cliente_id: c.id }, ordem: { coluna: 'competencia', desc: true }, limite: 48 }),
    // o que o cadastro não diz das vedações do Simples (as pendências na Receita) e a contabilidade feita até que mês
    ler('receita_empresas', { cols: 'pendencias, situacao_fiscal_em', eq: { cliente_id: c.id }, limite: 1 }),
    ler('contabil_empresas', { cols: 'faz, inicio, fim, responsavel', eq: { cliente_id: c.id }, limite: 1 }),
    ler('contabil_meses', { cols: 'competencia, situacao, feita_em', eq: { cliente_id: c.id } }),
    ler('dominio_andamento', { cols: COLS_FOTO, eq: { cliente_id: c.id } })
  ]);
  const dominio = soFechados(rDom && !rDom.error ? rDom.data : [], fechado);
  let fr = [];
  const frEmp = rFr && rFr.data && rFr.data[0];
  if (frEmp) { const r = await ler('fr_lancamentos', { cols: 'competencia, folha_salarios, folha_outros, prolabore', eq: { empresa_id: frEmp.id }, ordem: { coluna: 'competencia', desc: true }, limite: 12 }); fr = (r && r.data) || []; }
  // as outras empresas dos mesmos sócios (pelo CPF; sem CPF, pelo nome) e a receita de cada uma — a que não entra na soma
  // pela regra (a que não é ME nem EPP, com o sócio até 10% e sem administrar) fica em grupoFora, com o porquê
  const grupo = [], grupoSeries = [], grupoFora = [], notasGrupo = [];
  let nSocios = null, sociosVed = null;
  try {
    const rSoc = await ler('socios', { cols: 'nome, cpf, participacao_percentual', eq: { cliente_id: c.id } });
    const socios = (rSoc && rSoc.data) || [];
    if (rSoc && !rSoc.error) {
      nSocios = socios.length;
      // pra vedação do Simples: quem é pessoa jurídica (o documento com 14 dígitos) — o documento não sai daqui
      sociosVed = socios.map(s => ({ nome: s.nome || null, pj: String(s.cpf || '').replace(/\D/g, '').length === 14, participacao: s.participacao_percentual == null ? null : Number(s.participacao_percentual) }));
    }
    const cpfs = [...new Set(socios.map(s => String(s.cpf || '').replace(/\D/g, '')).filter(x => x.length === 11))];
    const semCpf = socios.filter(s => String(s.cpf || '').replace(/\D/g, '').length !== 11).map(s => s.nome).filter(Boolean);
    const outros = [];
    const colsOutros = 'cliente_id, nome, cpf, participacao_percentual, eh_administrador';
    if (cpfs.length) { const r = await ler('socios', { cols: colsOutros, em: { cpf: cpfs } }); outros.push(...((r && r.data) || [])); }
    if (semCpf.length) { const r = await ler('socios', { cols: colsOutros, em: { nome: semCpf } }); outros.push(...((r && r.data) || [])); }
    const empresas = empresasDosSocios(socios, outros, c.id);
    if (empresas.length) {
      const ids = empresas.map(x => x.cliente_id);
      const [rC, rP, cad, rD] = await Promise.all([
        ler('rt_casos', { cols: 'cliente_id, receita_mensal, sim_obs, atualizado_em', em: { cliente_id: ids }, ordem: { coluna: 'atualizado_em', desc: true } }),
        ler('receita_pgdas', { cols: 'cliente_id, competencia, receita_mes', em: { cliente_id: ids } }),
        cadastroDe ? cadastroDe(ids) : lerCadastro(ler, ids),
        ler('dominio_mensal', { cols: 'cliente_id, competencia, receita_bruta, receita_simples', em: { cliente_id: ids } })
      ]);
      const domGrupo = soFechados(rD && !rD.error ? rD.data : [], fechado);
      empresas.forEach(x => {
        const cli = (cad && cad.get(x.cliente_id)) || { id: x.cliente_id, nome_principal: 'empresa sem cadastro aberto' };
        const caso = ((rC && rC.data) || []).find(k => k.cliente_id === x.cliente_id) || null;
        const pgs = ((rP && rP.data) || []).filter(k => k.cliente_id === x.cliente_id);
        const r = receitaDaEmpresa({ cliente: cli, caso, pgdas: pgs, dominio: domGrupo.filter(k => k.cliente_id === x.cliente_id) });
        const fora = foraDaSoma(x, r.receita);
        if (fora) { grupoFora.push({ nome: r.nome, cliente_id: x.cliente_id, socios: x.socios, motivo: fora }); return; }
        const aviso = avisoDaSoma(x, r.receita, r.nome);
        if (aviso) notasGrupo.push(aviso);
        grupo.push({ nome: r.nome, cliente_id: x.cliente_id, socios: x.socios, receita: r.receita, meses: r.meses, origem: r.origem });
        grupoSeries.push({ nome: r.nome, cliente_id: x.cliente_id, serie: r.serie });
      });
    }
  } catch (err) { /* sem os sócios, a conta segue sem as outras empresas */ }
  const caso = (rCaso && rCaso.data && rCaso.data[0]) || null;
  const pg = (rPg && rPg.data) || [];
  const sis = entradaDoSistema({ cliente: c, caso, fatorR: fr, pgdas: pg, dominio });
  // as notas das empresas dos sócios são do limite do Simples: só com ele na comparação (notasSimples)
  const doLimite = [...grupoFora.map(g => g.nome + ' é dos mesmos sócios, mas fica fora da soma do limite: ' + g.motivo + '.'), ...notasGrupo];
  sis.notas.push(...doLimite); sis.notasSimples.push(...doLimite);
  sis.entrada.grupo = grupo.map(({ origem, ...g }) => g);
  grupo.forEach((g, i) => { sis.origens['grupo.' + i + '.receita'] = g.origem; });
  // o que o cadastro veda no Simples (o CNAE principal e os secundários, pessoa jurídica entre os sócios, a natureza
  // jurídica) e o que pede conferência (o CNAE ambíguo, as pendências na Receita)
  const rec = rRec && !rRec.error && rRec.data && rRec.data[0];
  const vedacoes = vedacoesDoSimples({ cnaePrincipal: c.cnae_principal, cnaesSecundarios: c.cnaes_secundarios, naturezaJuridica: c.natureza_juridica, socios: sociosVed,
    pendencias: rec ? rec.pendencias : null, pendenciasEm: rec ? rec.situacao_fiscal_em : null });
  // a contabilidade feita até que mês (o Controle das contabilidades): o lucro da DRE só vale até lá
  const ctbEmp = rCtb && !rCtb.error && rCtb.data && rCtb.data[0];
  // e o que o Domínio mostra de cada mês (todos os que ele leu, não só os fechados do estudo), pra confirmação dela
  const contabil = contabilDoEstudo(ctbEmp, (rCtbM && !rCtbM.error && rCtbM.data) || [], rDom && !rDom.error ? rDom.data : [], (rFoto && !rFoto.error && rFoto.data) || [], hoje);
  // a campanha da Reforma, o Fator R e o PGDAS são do Simples: na empresa do Presumido ou do Real, a falta deles não é notícia
  const geral = sis.entrada.regimeAtual === 'presumido' || sis.entrada.regimeAtual === 'real';
  const fontes = [
    { ok: !!caso, soSimples: true, txt: caso ? 'caso da Reforma' : 'sem caso na Reforma' },
    { ok: fr.length > 0, soSimples: true, txt: fr.length ? 'Fator R (' + fr.length + (fr.length === 1 ? ' mês)' : ' meses)') : 'sem folha no Fator R' },
    { ok: pg.length > 0, soSimples: true, txt: pg.length ? 'PGDAS na Receita (' + pg.length + (pg.length === 1 ? ' mês)' : ' meses)') : 'sem PGDAS da Receita' },
    { ok: !!sis.ponte, txt: sis.ponte ? 'Domínio pela ponte (' + sis.ponte.n + (sis.ponte.n === 1 ? ' mês fechado)' : ' meses fechados)') : 'sem o Domínio pela ponte' }
  ].filter(f => f.ok || !(geral && f.soSimples)).map(({ ok, txt }) => ({ ok, txt }));
  if (contabil) fontes.push({ ok: !!contabil.feitaAte, txt: contabil.faz === false ? 'contabilidade fora do escritório' : contabil.feitaAte ? 'contabilidade feita até ' + rotuloComp(contabil.feitaAte) : 'contabilidade sem mês feito' });
  const semTabela = erroSemTabela(rEst && rEst.error);
  const salvo = !semTabela && rEst && rEst.data && rEst.data[0];
  // o que o sistema apurou da atividade, sempre o de hoje (o estudo gravado não guarda): a venda de mercadoria × serviço
  // medida nas notas do Domínio e a presunção própria do CNAE principal — é o que cumpre a missão da presunção
  const atividade = { divisao: sis.divisao || null, especial: sis.especial || null, lida: !!sis.lida };
  const est = { cliente: c, nome: c.nome_principal, notas: sis.notas, notasSimples: sis.notasSimples, serie: sis.serie, serieRel: null, folhaRel: null, grupoSeries, grupoFora, socios: nSocios, sistema: sis, fontes, semTabela,
    vedacoes, contabil, atividade, estudoId: null, gravadoEm: null, gravadoPor: null };
  if (salvo && salvo.entrada && salvo.entrada.entrada) {
    Object.assign(est, { estudoId: salvo.id, gravadoEm: salvo.atualizado_em, gravadoPor: salvo.atualizado_por });
    // os meses do faturamento que a equipe soltou na tela (serieRel) entram na série do sistema
    if (Array.isArray(salvo.entrada.serieRel) && salvo.entrada.serieRel.length) { est.serieRel = salvo.entrada.serieRel; est.serie = mesclarSerie(sis.serie, salvo.entrada.serieRel); }
    // os meses do resumo da folha solto na tela (só os totais), pra o próximo resumo solto se juntar a eles
    if (Array.isArray(salvo.entrada.folhaRel) && salvo.entrada.folhaRel.length) est.folhaRel = salvo.entrada.folhaRel;
    est.entrada = comPadroes(salvo.entrada.entrada); est.origens = salvo.entrada.origens || {}; est.conferencia = salvo.entrada.conferencia || sis.conferencia;
    // o estudo gravado antes da soma das empresas dos sócios: entram as que o sistema achou
    if (!Array.isArray(salvo.entrada.entrada.grupo)) { est.entrada.grupo = sis.entrada.grupo; grupo.forEach((g, i) => { est.origens['grupo.' + i + '.receita'] = g.origem; }); }
    // a atividade que o estudo gravou como "pelo CNAE do cadastro — confira" (ou no padrão) e que hoje o sistema apura pelas
    // notas: a origem passa a dizer isso, se a atividade segue a mesma (o que a equipe digitou ou conferiu não muda)
    est.entrada.atividades.forEach((a, i) => {
      const k = 'atividades.' + i + '.tipo', antes = est.origens[k], hoje = sis.origens[k], aSis = sis.entrada.atividades[i];
      if ((!antes || ['cadastro', 'padrao'].includes(antes.fonte)) && hoje && sis.divisao && ['ponte', 'reforma'].includes(hoje.fonte) && aSis && aSis.tipo === a.tipo) est.origens[k] = hoje;
    });
  } else {
    est.entrada = comPadroes(sis.entrada); est.origens = { ...ORIGENS_PADRAO, ...sis.origens }; est.conferencia = sis.conferencia;
  }
  return est;
}
// ---------- a contabilidade da empresa, pro lucro do Real ----------
// O Controle das contabilidades diz até que mês ela está feita e quem cuida; o Domínio (a versão 3 da ponte) diz o que
// cada mês mostra. O Samuel, 11/11/2026: "eu ainda confirmaria com a Adaini se é confiável usar esse número até essa
// data" — o sistema faz a primeira leitura, pra pergunta chegar a ela com o que olhar.
// emp: a linha de contabil_empresas · linhasMeses: as de contabil_meses · linhasDominio: as de dominio_mensal (com as
// colunas de CAMPOS_DOMINIO) · linhasFoto: as de dominio_andamento. Volta { faz, feitaAte, responsavel, meses, bancoAte }:
// meses: [{ competencia, estado, problemas: [{ tipo, valor }] }] — os que o Domínio leu, até o último que dá pra fechar,
// só com os problemas fortes (problemasDoMes, a regra do Controle das contabilidades) · bancoAte: o dia até onde a conta de
// banco mais atrasada está lançada. Null sem a empresa no Controle.
const COLS_FOTO = 'banco_contas, banco_ate, banco_ultimo, banco_ultimo_geral, caixa_ate, caixa_contador_ate, extrato_contas, extrato_ate, extrato_pendentes, conciliadas, conciliado_ate, fechamento_em, dados_ate';
export function contabilDoEstudo(emp, linhasMeses = [], linhasDominio = [], linhasFoto = [], hoje = null) {
  if (!emp) return null;
  const responsavel = String(emp.responsavel || '').trim() || null;
  if (emp.faz === false) return { faz: false, feitaAte: null, responsavel, meses: [], bancoAte: null };
  const dia = hoje || hojeEmBrasilia();
  const mapa = mapaDosMeses(linhasMeses);
  const dom = dominioPorMes(linhasDominio);
  const foto = andamentoDaEmpresa(linhasFoto);
  const ultimo = ultimoFechavel(dia);
  const valorDe = (tipo, d) => (tipo === 'transitoria' ? (d.transitorias_valor != null ? Number(d.transitorias_valor) : null) : tipo === 'folha' ? folhaCalculada(d) : null);
  const meses = [...dom.keys()].filter(c => c <= ultimo).sort().map(c => {
    const d = dom.get(c);
    return { competencia: c, estado: estadoDoMes(emp, mapa, c, dia).tipo,
      problemas: problemasDoMes(d, c, foto, dom).filter(p => p.forte).map(p => ({ tipo: p.tipo, valor: valorDe(p.tipo, d) })) };
  });
  return { faz: true, feitaAte: resumoDoControle(emp, mapa, dia).feitaAte, responsavel, meses, bancoAte: foto && foto.banco_contas > 0 ? foto.banco_ate || null : null };
}

// o estudo de uma empresa sem cadastro (só o que foi gravado: a linha de comparativos, com o nome)
export function estudoGravado(linha) {
  const g = (linha && linha.entrada) || {};
  const serieRel = Array.isArray(g.serieRel) && g.serieRel.length ? g.serieRel : null;
  const folhaRel = Array.isArray(g.folhaRel) && g.folhaRel.length ? g.folhaRel : null;
  return { cliente: null, nome: (linha && linha.nome) || 'empresa sem cadastro', entrada: comPadroes(g.entrada || {}), origens: g.origens || {}, conferencia: g.conferencia || null,
    notas: [], notasSimples: [], serie: serieRel ? mesclarSerie(null, serieRel) : null, serieRel, folhaRel, grupoSeries: [], grupoFora: [], socios: null, sistema: null, fontes: [], semTabela: false,
    vedacoes: null, contabil: null, atividade: null,
    estudoId: (linha && linha.id) || null, gravadoEm: (linha && linha.atualizado_em) || null, gravadoPor: (linha && linha.atualizado_por) || null };
}

// ---------- a conta ----------
// o ano-calendário pelos números do sistema: a empresa e as outras dos sócios que vieram do sistema (sem a série de uma
// delas, não há como somar o ano)
export function situacaoComGrupo(serie, grupo, grupoSeries) {
  const series = (grupo || []).map(x => (grupoSeries || []).find(s => s.cliente_id && s.cliente_id === x.cliente_id));
  if (series.some(s => !s || !s.serie)) return null;
  return situacaoDoGrupo(serie, series.map(s => ({ nome: s.nome, serie: s.serie })));
}
// o que muda o resultado: o lucro em que o Real empata e as premissas no padrão — [{ txt, alerta }] (alerta: a premissa
// que vira o resultado)
export function oQueMuda(c, testes) {
  const muda = [];
  const d = c && c.decisao;
  // só o Presumido contra o Real, de 2027 em diante: a diferença é o IRPJ e a CSLL
  if (d && c.entrada && Array.isArray(c.entrada.regimes) && !c.entrada.regimes.includes('simples') && d.ano >= 2027)
    muda.push({ txt: 'Em ' + d.ano + ' o Presumido e o Real só diferem no IRPJ e na CSLL: o PIS/Cofins acaba, e a CBS, o IBS, o ICMS, o ISS e o INSS são iguais nos dois.', alerta: false });
  if (d && d.real) {
    const ep = d.real.empate.presumido, es = d.real.empate.simples;
    const rDec = c.anos.find(r => r.ano === d.ano) || c.anos[0];
    const deOnde = d.real.informado ? ', pela contabilidade' : '';
    const lucroTxt = d.real.lucro < 0 ? 'a conta deu prejuízo de ' + brl(-d.real.lucro) + deOnde : 'a conta usou lucro de ' + brl(d.real.lucro) + (d.real.margem != null ? ' (' + pct(d.real.margem * 100) + '% da receita)' : '') + deOnde;
    if (ep) muda.push({ txt: ep.nunca ? 'Nem com lucro zero o Real fica abaixo do Presumido em ' + d.ano + '.' : 'O Real empata com o Presumido em ' + d.ano + ' com lucro de ' + brl(ep.lucro) + ' antes do IR (' + pct(ep.margem * 100) + '% da receita) — abaixo disso, o Real é mais barato; ' + lucroTxt + '.', alerta: false });
    if (es && rDec && rDec.simples && rDec.simples.disponivel) muda.push({ txt: es.nunca ? 'Nem com lucro zero o Real fica abaixo do Simples em ' + d.ano + '.' : 'O Real empata com o Simples em ' + d.ano + ' com lucro de ' + brl(es.lucro) + ' (' + pct(es.margem * 100) + '% da receita).', alerta: false });
  }
  const mudam = (testes || []).filter(t => t.muda), naoMudam = (testes || []).filter(t => !t.muda);
  // "7%", "50% das compras" — ou o nome do valor, quando ele não é número (o RDA: "sem o RDA")
  const un = t => !t.unidade ? '' : t.unidade.startsWith('%') ? t.unidade : ' ' + t.unidade;
  const comNome = t => !!t.nomes;
  const valor = (t, v) => comNome(t) ? (t.nomes[v] != null ? t.nomes[v] : String(v)) : pct(v, 2) + un(t);
  const em = t => comNome(t) ? ' ' : ' em ';
  mudam.forEach(t => {
    const v = t.variantes.filter(x => x.melhor !== t.melhorBase).map(x => valor(t, x.valor) + ', o mais barato passa a ser o ' + ROTULO_REGIME[x.melhor]).join('; com ');
    muda.push({ txt: 'Com ' + t.rotulo + em(t) + v + '. ' + (t.confira || 'O número usado é um padrão — confira.'), alerta: true });
  });
  if (naoMudam.length) muda.push({ txt: 'Não mudam o resultado: ' + naoMudam.map(t => t.rotulo + (comNome(t) ? ' ' + t.variantes.map(x => valor(t, x.valor)).join(' ou ') : t.variantes.length === 1 ? ' em ' + valor(t, t.variantes[0].valor) : ' entre ' + t.variantes.map(x => pct(x.valor, 2)).join(' e ') + un(t))).join('; ') + '.', alerta: false });
  return muda;
}
// os avisos da conta: as notas do que o sistema trouxe (sem a da folha, quando ela está na conta), os do motor e os do ano
// da decisão
export function avisosDoEstudo({ notas = [], entrada = {}, comparacao = null } = {}) {
  const c = comparacao;
  if (!c) return [];
  const temFolha = (Number(entrada.folha) || 0) + (Number(entrada.proLabore) || 0) > 0;
  const rDec = c.anos.find(r => r.ano === c.anoDecisao) || c.anos[0];
  return [...new Set([...(notas || []).filter(n => !(temFolha && /^A folha e o pró-labore não estão no sistema/.test(n))), ...c.avisos, ...REGIMES.flatMap(g => rDec[g].avisos || [])])];
}
// a conta repete os últimos 12 meses; o ano de agora, pelos números do sistema, pode já ter passado (ou passar, no ritmo
// dos últimos 3 meses) do limite de R$ 4,8 milhões — aí o Simples fica fora no ano da decisão inteiro (com as empresas dos
// sócios, a exclusão vem no mês seguinte ao do excesso, sem a tolerância de 20%, e vale até o fim do ano seguinte — SC
// Cosit 135/2026; sozinha, o excesso de até 20% a tira no ano seguinte, LC 123, art. 3º, §9º-A) e a escolha é
// entre o Presumido e o Real. Só quando a conta ainda põe o Simples no ano da decisão e o ano medido é o anterior a ele
export function alertaDoLimite(c, situacao, grupo) {
  const s = situacao, rDec = c && c.anos ? c.anos.find(r => r.ano === c.anoDecisao) : null;
  if (!s || !s.passaEm || !rDec || !rDec.simples.disponivel || s.ano !== c.anoDecisao - 1) return null;
  const alt = ['presumido', 'real'].filter(g => rDec[g].disponivel).sort((a, b) => rDec[a].total - rDec[b].total)[0];
  if (!alt) return null;
  const quem = (grupo || []).some(g => g && Number(g.receita) > 0) ? 'a soma com as empresas dos sócios' : 'a receita';
  return 'A conta repete os últimos 12 meses, mas pelos números do sistema de ' + s.ano + ' ' + quem
    + (s.jaPassou ? ' passou do limite de R$ 4,8 milhões em ' + s.passaEm : ', no ritmo dos últimos 3 meses, passa do limite de R$ 4,8 milhões em ' + s.passaEm)
    + ': a saída do Simples vale a partir de ' + s.saiEm + ' e cobre ' + c.anoDecisao + '. Se isso se confirmar, em ' + c.anoDecisao + ' a escolha é entre o Presumido e o Real — o mais barato deles é o '
    + ROTULO_REGIME[alt] + ', ' + brl(rDec[alt].total) + '.';
}

// com o Simples na comparação e impedimento no cadastro, a linha dele é simulação (só vale se a empresa tirar os
// impedimentos): o aviso diz quais são e o mais barato entre os que ela pode escolher hoje, o Presumido e o Real
export function alertaDasVedacoes(c, vedacoes, regimes = null) {
  if (!c || !c.anos || !vedacoes || !vedacoes.vedado || !(regimes || REGIMES).includes('simples')) return null;
  const rDec = c.anos.find(r => r.ano === c.anoDecisao) || c.anos[0];
  const alt = ['presumido', 'real'].filter(g => rDec[g].disponivel).sort((a, b) => rDec[a].total - rDec[b].total)[0];
  return 'O Simples está vedado hoje pelo cadastro (' + resumoDasVedacoes(vedacoes, { comBase: false }) + '): a linha dele vale como simulação, se a empresa tirar os impedimentos.'
    + (alt ? ' Sem o Simples, o mais barato em ' + rDec.ano + ' é o ' + ROTULO_REGIME[alt] + ', ' + brl(rDec[alt].total) + '.' : '');
}

// a conta inteira do estudo, como a tela mostra: comparar, as premissas no padrão testadas, o ano-calendário com as
// empresas dos sócios, o roteiro (as fases e as missões), os prazos, o que muda o resultado e os avisos. Sem receita (ou
// com o mix fora de 100%), a conta não roda: erro com o porquê, e o roteiro diz o que falta. hoje: 'AAAA-MM-DD'
// objetivo: o comparativo escolhido (sem ele, o da entrada; sem nenhum, o que o sistema sugere) · vedacoes: o que o cadastro
// veda no Simples (carregarEstudo) · contabil: o Controle das contabilidades ({ faz, feitaAte }) · atividade: o que o
// sistema apurou da atividade ({ divisao, especial }: as notas do Domínio e o CNAE — carregarEstudo). A volta diz o objetivo e
// os regimes da conta, as vedações (e `vedado`: o aviso de que a linha do Simples é simulação), a precisão (o que já está
// na conta e o que falta, com o efeito de cada item) e `dre`: o período da DRE do lucro informado e o fator que o levou aos
// 12 meses (periodoDaDre; null sem o lucro).
export function contaDoEstudo({ entrada, origens = {}, conferencia = null, notas = [], notasSimples = [], serie = null, grupoSeries = [], grupoFora = [], socios = null, aliq2027 = null, hoje = null,
  objetivo = null, vedacoes = null, contabil = null, atividade = null } = {}) {
  const achadas = (grupoSeries || []).length;
  const obj = objetivoDoEstudo(entrada, vedacoes, objetivo);
  const regimes = regimesDoObjetivo(obj);
  const comSimples = regimes.includes('simples');
  let comparacao = null, testes = [], erro = null;
  // o lucro da contabilidade até onde ela está feita: o período da DRE e o fator que o leva aos 12 meses da receita
  const dre = num(entrada && entrada.lucroContabil) != null ? periodoDaDre(serie, entrada) : null;
  const doMotor = () => ({ ...entradaDoMotor(entrada, aliq2027, obj), lucroFator: dre ? dre.fator : 1 });
  try {
    comparacao = comparar(doMotor());
    testes = testarPremissas(doMotor(), premissasParaTestar(entrada, origens, regimes));
  } catch (e) { comparacao = null; testes = []; erro = (e && e.message) || 'A conta não rodou.'; }
  if (!comparacao) {
    const roteiro = roteiroDoEstudo({ entrada, origens, serie, socios, achadas, grupoFora, conferencia, hoje, objetivo: obj, vedacoes, contabil, atividade });
    return { comparacao: null, testes: [], situacao: null, erro, prazos: [], muda: [], avisos: [], limite: null, vedado: null, objetivo: obj, regimes, vedacoes, dre, roteiro, precisao: precisaoDoEstudo(roteiro) };
  }
  const situacao = comSimples ? situacaoComGrupo(serie, entrada.grupo, grupoSeries) : null;
  const roteiro = roteiroDoEstudo({ entrada, origens, comparacao, testes, situacao, serie, socios, achadas, grupoFora, conferencia, hoje, objetivo: obj, vedacoes, contabil, atividade });
  return {
    comparacao, testes, situacao, erro: null, objetivo: obj, regimes, vedacoes, dre,
    limite: comSimples ? alertaDoLimite(comparacao, situacao, entrada.grupo) : null,
    vedado: alertaDasVedacoes(comparacao, vedacoes, regimes),
    roteiro, precisao: precisaoDoEstudo(roteiro),
    prazos: prazosDaEscolha(hoje, entrada.regimeAtual, comparacao.anoDecisao, situacao, { objetivo: obj, vedado: !!(vedacoes && vedacoes.vedado) }),
    muda: oQueMuda(comparacao, testes),
    // sem o Simples na comparação, as notas que são só dele (o limite com as empresas dos sócios, o anexo) ficam de fora
    avisos: avisosDoEstudo({ notas: comSimples ? notas : (notas || []).filter(n => !(notasSimples || []).includes(n)), entrada, comparacao })
  };
}
// o resumo gravado com o estudo (comparativos.resultado): o ano da decisão, o mais barato, a distância pro segundo e os
// totais por ano e regime (R$; nulo = fora do Simples)
export function resumoParaGravar(c) {
  if (!c || !c.decisao) return null;
  return {
    anoDecisao: c.anoDecisao, melhor: c.decisao.melhor, diferenca: c.decisao.diferenca,
    // os regimes da comparação (o objetivo do estudo): o que ficou fora dela vai nulo nos totais, e não é "fora do Simples"
    regimes: (c.entrada && c.entrada.regimes) || REGIMES.slice(),
    totais: Object.fromEntries(c.anos.map(r => [r.k === 0 ? 'base' : String(r.ano), Object.fromEntries(REGIMES.map(g => [g, r[g].disponivel ? Math.round(r[g].total * 100) / 100 : null]))]))
  };
}

// ---------- o "e se" (o assistente): os números trocados, só na conta ----------
// eSe: os números como a pessoa falou (R$ dos 12 meses; percentuais como a equipe digita). Volta { entrada, origens,
// mudancas: [{ rotulo, antes, depois, un }], avisos } — a entrada nova vai pra contaDoEstudo; nada é gravado.
// A receita nova leva as atividades na mesma proporção, e as compras e as despesas acompanham (o mesmo % da receita); a
// folha e o pró-labore ficam. margem_lucro_real: as outras despesas que dão esse lucro do Real antes do IR, em % da
// receita do ano da decisão (o lucro é a receita menos os custos e os tributos sobre a receita, que não dependem delas)
export const E_SE = {
  receita_12_meses: { rotulo: 'Receita dos 12 meses', un: 'R$' },
  folha_12_meses: { campo: 'folha', un: 'R$' },
  pro_labore_12_meses: { campo: 'proLabore', un: 'R$' },
  compras_12_meses: { campo: 'compras', un: 'R$' },
  outras_despesas_12_meses: { campo: 'outrasDespesas', un: 'R$' },
  lucro_contabil_12_meses: { campo: 'lucroContabil', un: 'R$' },
  margem_lucro_real: { rotulo: 'Lucro do Real antes do IR', un: '% da receita' },
  crescimento_receita: { campo: 'crescimentoReceita', un: '% ao ano' },
  crescimento_folha: { campo: 'crescimentoFolha', un: '% ao ano' },
  credito_icms_compras: { campo: 'aliqCreditoIcms', un: '%' },
  icms_vendas: { ativ: 'aliqIcms', tributo: 'icms', un: '%' },
  iss: { ativ: 'aliqIss', tributo: 'iss', un: '%' },
  vendas_aliquota_zero_pis_cofins: { ativ: 'pctAliqZero', tributo: 'icms', un: '% das vendas' },
  aliquota_zero_da_cesta_basica: { rotulo: 'Alíquota zero de PIS/Cofins: os produtos são da Cesta Básica Nacional' },
  compras_fornecedor_simples: { campo: 'pctComprasSimples', un: '% das compras' },
  rat: { campo: 'rat', un: '%' },
  sem_empresas_dos_socios: { rotulo: 'Empresas dos sócios na soma do limite' },
  regime_atual: { rotulo: 'Regime de hoje' }
};
const receitaDe = e => ((e && e.atividades) || []).reduce((s, a) => s + (Number(a.receita) || 0), 0);
const tributoDe = a => a.tributo || (TIPOS[a.tipo] || TIPOS.comercio).tributo;
export function aplicarESe(entrada, origens, eSe, { aliq2027 = null, serie = null } = {}) {
  const e = JSON.parse(JSON.stringify(entrada || {}));
  if (!Array.isArray(e.atividades) || !e.atividades.length) e.atividades = [PADRAO_ATIV({ tipo: 'comercio', receita: 0 })];
  const o = { ...(origens || {}) };
  const x = eSe && typeof eSe === 'object' ? eSe : {};
  const mudancas = [], avisos = [];
  const marca = campo => { o[campo] = { fonte: 'digitado', texto: 'e se (assistente)' }; };
  // o lucro do "e se" é sempre o dos 12 meses: o da DRE de só uma parte deles (a contabilidade feita até antes do fim da
  // receita) vai primeiro aos 12 meses, pelo fator do período (serie: a série do estudo), e a conta não o leva de novo
  const lucroAosDoze = () => {
    if (e.lucroAnual) return;
    const dre = num(e.lucroContabil) != null ? periodoDaDre(serie, e) : null;
    if (dre && Math.abs(dre.fator - 1) > 0.0005) {
      e.lucroContabil = Number(e.lucroContabil) * dre.fator;
      if (num(e.ajustesLalur)) e.ajustesLalur = Number(e.ajustesLalur) * dre.fator;
    }
    e.lucroAnual = true; delete e.lucroDe; delete e.lucroAte; delete e.lucroReceita;
  };
  if (num(x.lucro_contabil_12_meses) != null || num(x.margem_lucro_real) != null) lucroAosDoze();
  // a receita: as atividades na mesma proporção; as compras e as despesas acompanham
  const rec = num(x.receita_12_meses);
  if (rec != null && rec >= 0) {
    const antes = receitaDe(e);
    if (antes > 0) {
      const f = rec / antes;
      e.atividades.forEach(a => { a.receita = (Number(a.receita) || 0) * f; });
      ['compras', 'despesasCredito', 'outrasDespesas', 'difalSimples'].forEach(k => {
        const v = Number(e[k]) || 0;
        if (!v) return;
        e[k] = v * f;
        mudancas.push({ rotulo: CAMPOS[k].rotulo + ' (acompanha a receita)', antes: v, depois: e[k], un: 'R$' });
      });
      if (e.creditoIcms != null && e.creditoIcms !== '') e.creditoIcms = Number(e.creditoIcms) * f;
      // o lucro da contabilidade acompanha a receita (o mesmo % dela), com os ajustes
      if (num(e.lucroContabil) != null) {
        const v = Number(e.lucroContabil);
        e.lucroContabil = v * f; if (num(e.ajustesLalur)) e.ajustesLalur = Number(e.ajustesLalur) * f;
        mudancas.push({ rotulo: CAMPOS.lucroContabil.rotulo + ' (acompanha a receita)', antes: v, depois: e.lucroContabil, un: 'R$' });
      }
    } else e.atividades[0].receita = rec;
    e.atividades.forEach((a, i) => marca('atividades.' + i + '.receita'));
    mudancas.unshift({ rotulo: E_SE.receita_12_meses.rotulo, antes, depois: rec, un: 'R$' });
  }
  // os números de um campo só
  Object.entries(E_SE).filter(([, d]) => d.campo).forEach(([k, d]) => {
    const v = num(x[k]);
    if (v == null) return;
    const antes = num(e[d.campo]);
    e[d.campo] = v; marca(d.campo);
    mudancas.push({ rotulo: CAMPOS[d.campo].rotulo, antes: antes == null ? num(PADROES[d.campo]) : antes, depois: v, un: d.un });
  });
  // o ICMS e o ISS das vendas: todas as atividades daquele tributo
  Object.entries(E_SE).filter(([, d]) => d.ativ).forEach(([k, d]) => {
    const v = num(x[k]);
    if (v == null) return;
    const alvo = e.atividades.map((a, i) => ({ a, i })).filter(({ a }) => tributoDe(a) === d.tributo);
    if (!alvo.length) { avisos.push('A empresa não tem atividade com ' + (d.tributo === 'icms' ? 'ICMS' : 'ISS') + ': ' + k.replace(/_/g, ' ') + ' não entrou na conta.'); return; }
    const antes = [...new Set(alvo.map(({ a }) => Number(a[d.ativ]) || 0))];
    alvo.forEach(({ a, i }) => { a[d.ativ] = v; marca('atividades.' + i + '.' + d.ativ); });
    mudancas.push({ rotulo: CAMPOS['ativ.' + d.ativ].rotulo, antes: antes.length === 1 ? antes[0] : antes.map(y => pct(y, 2)).join(' e '), depois: v, un: d.un });
  });
  if (x.sem_empresas_dos_socios === true && (e.grupo || []).length) {
    mudancas.push({ rotulo: E_SE.sem_empresas_dos_socios.rotulo, antes: e.grupo.map(g => g.nome).join(', '), depois: 'nenhuma', un: '' });
    e.grupo = [];
    marca('grupo');
  }
  if (REGIMES.includes(x.regime_atual) && x.regime_atual !== e.regimeAtual) {
    mudancas.push({ rotulo: E_SE.regime_atual.rotulo, antes: ROTULO_REGIME[e.regimeAtual] || '—', depois: ROTULO_REGIME[x.regime_atual], un: '' });
    e.regimeAtual = x.regime_atual;
  }
  // a alíquota zero de PIS/Cofins: da Cesta Básica Nacional (segue zero) ou não (10% da alíquota desde abril de 2026, LC 224)
  if (typeof x.aliquota_zero_da_cesta_basica === 'boolean') {
    const alvo = e.atividades.filter(a => tributoDe(a) === 'icms');
    const dizer = v => (v ? 'sim (seguem com zero)' : 'não (10% da alíquota desde abril de 2026)');
    if (alvo.some(a => !!a.aliqZeroCesta !== x.aliquota_zero_da_cesta_basica)) {
      mudancas.push({ rotulo: E_SE.aliquota_zero_da_cesta_basica.rotulo, antes: dizer(alvo.every(a => a.aliqZeroCesta)), depois: dizer(x.aliquota_zero_da_cesta_basica), un: '' });
      alvo.forEach(a => { a.aliqZeroCesta = x.aliquota_zero_da_cesta_basica; });
    }
  }
  // o lucro do Real: por último, com as outras mudanças já feitas
  const m = num(x.margem_lucro_real);
  if (m != null) {
    try {
      const c = comparar(entradaDoMotor(e, aliq2027));
      const r = c.anos.find(a => a.ano === c.anoDecisao) || c.anos[0];
      const fr = c.entrada.receita > 0 ? r.receita / c.entrada.receita : 1;
      if (num(e.lucroContabil) != null) {
        // com o lucro da contabilidade na conta, é ele que muda (as outras despesas não entram no lucro)
        const antesL = Number(e.lucroContabil);
        e.lucroContabil = antesL + (m / 100 * r.receita - r.real.lucro) / fr; marca('lucroContabil');
        mudancas.push({ rotulo: CAMPOS.lucroContabil.rotulo + ', pra o lucro do Real antes do IR dar ' + pct(m) + '% da receita em ' + r.ano, antes: antesL, depois: e.lucroContabil, un: 'R$' });
        return { entrada: e, origens: o, mudancas, avisos };
      }
      const antes = Number(e.outrasDespesas) || 0;
      let depois = antes + (r.real.lucro - m / 100 * r.receita) / fr;
      if (depois < 0) {
        avisos.push('Nem sem outras despesas o lucro do Real chega a ' + pct(m) + '% da receita em ' + r.ano + ': sem elas, ele fica em ' + pct((r.real.lucro + antes * fr) / r.receita * 100) + '%. A conta usou zero de outras despesas.');
        depois = 0;
      }
      e.outrasDespesas = depois; marca('outrasDespesas');
      mudancas.push({ rotulo: CAMPOS.outrasDespesas.rotulo + ', pra o lucro do Real antes do IR dar ' + pct(m) + '% da receita em ' + r.ano, antes, depois, un: 'R$' });
    } catch (err) { avisos.push('Sem a conta (' + ((err && err.message) || 'erro') + '), não dá pra achar o lucro do Real.'); }
  }
  return { entrada: e, origens: o, mudancas, avisos };
}
