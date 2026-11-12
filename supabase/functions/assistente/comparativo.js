// ============================================================
// MACEDO & REIS — Assistente do escritório: o comparativo tributário (01/11/2026)
// A ferramenta comparativo: o estudo da empresa como a tela Comparativo tributário abre (assets/js/comparativo-estudo.js —
// o gravado ou os números do sistema, as empresas dos mesmos sócios) e a mesma conta da tela (Simples × Presumido × Real,
// os últimos 12 meses e 2027 e 2028), em texto pro modelo: o resultado, por tributo, o que muda o resultado, as empresas
// dos sócios, os números e de onde veio cada um, as fases do estudo, os prazos e os avisos. Com o "e se", refaz com os
// números trocados (aplicarESe) — só na resposta, nada é gravado. O CPF dos sócios, que casa as empresas dos mesmos
// sócios como na tela, é lido só dentro de carregarEstudo e não sai no texto. Desde 11/11/2026, o comparativo escolhido na
// tela (só o Presumido contra o Real, ou com o Simples; sem escolha, o que o sistema sugere — e `objetivo` pede o outro),
// o que o cadastro veda no Simples, o lucro da contabilidade no Real e a precisão do estudo (o que falta e o efeito de cada
// item). No Presumido contra o Real de uma empresa do regime geral, o Simples não entra no texto (simplesNoEstudo: nem os
// impedimentos, nem o anexo) — só uma linha pra quando perguntarem. Testado em tests/assistente-funcao.test.mjs.
// ============================================================

import { REGIMES, ROTULO_REGIME, TIPOS, OBJETIVOS, fraseDaDecisao, rotuloDoTipo } from '../../../assets/js/comparativo-motor.js';
import { FONTES, rotuloComp, objetivoValido, porQueDoObjetivo, simplesNoEstudo } from '../../../assets/js/comparativo-dados.js';
import { CAMPOS, carregarEstudo, estudoGravado, contaDoEstudo, aplicarESe } from '../../../assets/js/comparativo-estudo.js';
import { NIVEL_DA_PRECISAO, PESO_DA_PRECISAO, lucroDoEstudo } from '../../../assets/js/comparativo-roteiro.js';
import { NAO_CONFERE, oQueConferiu, resumoDasVedacoes } from '../../../assets/js/simples-vedacoes.js';
import { nomePorEmail } from '../../../assets/js/equipe.js';

const enc = v => encodeURIComponent(String(v));
const aspas = v => '"' + String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
const fin = v => v != null && v !== '' && Number.isFinite(Number(v));
const brl = v => (fin(v) ? Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—');
const moeda = v => (fin(v) ? Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—');
const pct = (v, d = 2) => (Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: d });
const momento = iso => { const d = new Date(iso || ''); return iso && !isNaN(d) ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(d) : '—'; };
const COLS_ESTUDO = 'id,cliente_id,nome,entrada,atualizado_em,atualizado_por';
const COLS_CLIENTE = 'id,nome_principal,nome_fantasia,documento,tipo_pessoa,regime_tributario,cnae_principal,cnaes_secundarios,natureza_juridica,cidade,uf,status';

// ---------- a leitura do estudo (a mesma da tela, pelo PostgREST com o login de quem pergunta) ----------
export function lerDoBanco(banco) {
  return async (tabela, o = {}) => {
    const p = ['select=' + String(o.cols || '*').replace(/\s+/g, '')];
    Object.entries(o.eq || {}).forEach(([k, v]) => p.push(k + '=eq.' + enc(v)));
    Object.entries(o.em || {}).forEach(([k, v]) => p.push(k + '=in.' + enc('(' + (v || []).map(aspas).join(',') + ')')));
    if (o.ordem) p.push('order=' + o.ordem.coluna + '.' + (o.ordem.desc ? 'desc' : 'asc'));
    if (o.limite) p.push('limit=' + o.limite);
    try { const r = await banco.ler(tabela + '?' + p.join('&')); return { data: r.linhas, error: null }; }
    catch (e) { return { data: null, error: { message: (e && e.message) || 'erro' } }; }
  };
}

// as funções do banco que o estudo lê (hoje, o estado da pergunta da confirmação da contabilidade no vigia de quem cuida
// dela): pelo banco.chamar do servidor, com o login de quem pergunta. Sem ele (os testes, a avaliação antiga), nada
export function chamarDoBanco(banco) {
  return async (nome, args = {}) => {
    if (!banco || typeof banco.chamar !== 'function') return { data: null, error: { message: 'sem a leitura de funções' } };
    try { return { data: await banco.chamar(nome, args), error: null }; }
    catch (e) { return { data: null, error: { message: (e && e.message) || 'erro' } }; }
  };
}

// o estudo da pergunta: o aberto na tela (comparativo_id), o da empresa (a aberta, ou pelo nome, id ou CNPJ) ou, sem
// empresa no cadastro com esse nome, o estudo de empresa sem cadastro gravado com ele. acharEmpresa: a das ferramentas
export async function estudoDaPergunta({ banco, termo, contexto = {}, acharEmpresa }) {
  const ler = lerDoBanco(banco);
  const t = String(termo || '').trim();
  async function porCliente(id) {
    const { linhas } = await banco.ler('clientes?select=' + COLS_CLIENTE + '&id=eq.' + enc(id));
    const c = linhas[0];
    if (!c) return { erro: 'Nenhuma empresa no cadastro com o id ' + id + '.' };
    if (c.tipo_pessoa === 'PF') return { erro: c.nome_principal + ' é pessoa física (IRPF): o comparativo tributário é de empresa.' };
    return { estudo: await carregarEstudo({ ler, cliente: c, chamar: chamarDoBanco(banco) }) };
  }
  if (!t && contexto.comparativo_id) {
    const { linhas } = await banco.ler('comparativos?select=' + COLS_ESTUDO + '&id=eq.' + enc(contexto.comparativo_id));
    const l = linhas[0];
    if (l && l.cliente_id) return porCliente(l.cliente_id);
    if (l) return { estudo: estudoGravado(l) };
  }
  const a = await acharEmpresa(t);
  if (!a.erro) return porCliente(a.id);
  if (t) {
    const nome = t.replace(/[*%]/g, '').trim();
    const { linhas } = nome ? await banco.ler('comparativos?select=' + COLS_ESTUDO + '&cliente_id=is.null&nome=ilike.' + enc('*' + nome + '*') + '&order=atualizado_em.desc&limit=6') : { linhas: [] };
    if (linhas.length === 1) return { estudo: estudoGravado(linhas[0]) };
    if (linhas.length > 1) return { erro: 'Mais de um estudo de empresa sem cadastro com "' + t + '": ' + linhas.map(l => l.nome).join(', ') + '. Diga qual.' };
  }
  return { erro: a.erro };
}

// ---------- o texto ----------
const rotAno = r => (r.k === 0 ? 'últimos 12 meses' : String(r.ano));
const origemDe = (origens, k) => { const o = origens && origens[k]; return o ? (o.texto || FONTES[o.fonte] || o.fonte) : FONTES.padrao; };
const tributoDe = a => a.tributo || (TIPOS[a.tipo] || TIPOS.comercio).tributo;

// os regimes do comparativo escolhido (sem a conta dizer, os três)
const regimesDe = conta => REGIMES.filter(g => !conta || !conta.regimes || conta.regimes.includes(g));
const lucroDoReal = c => (c.anos.some(r => r.real.lucroInformado) ? 'lucro antes do IR, o da contabilidade com os tributos de hoje trocados pelos do Real' : 'lucro antes do IR estimado (a receita menos as compras, a folha e as despesas)');
function blocoResultado(c, conta) {
  const out = [];
  out.push('- Receita: ' + c.anos.map(r => rotAno(r) + ' ' + brl(r.receita)).join(' · '));
  const motivos = [];
  regimesDe(conta).forEach(g => {
    const partes = c.anos.map(r => {
      const x = r[g];
      if (!x.disponivel) { if (x.motivo && !motivos.includes(x.motivo)) motivos.push(x.motivo); return rotAno(r) + ' FORA (não pode ficar no Simples)'; }
      return rotAno(r) + ' ' + brl(x.total) + ' (' + pct(x.aliquota * 100) + '% da receita)' + (r.melhor === g ? ' ← o mais barato' : '');
    });
    out.push('- ' + ROTULO_REGIME[g] + (g === c.entrada.regimeAtual ? ' (o regime de hoje)' : '') + ': ' + partes.join(' · ')
      + (g === 'real' ? ' — ' + lucroDoReal(c) + ': ' + c.anos.map(r => rotAno(r) + ' ' + brl(r.real.lucro)).join(' · ') : ''));
  });
  if (motivos.length) out.push('- Por que o Simples fica fora: ' + motivos.join(' | '));
  const fora = REGIMES.filter(g => !regimesDe(conta).includes(g));
  // (na empresa do regime geral que compara só o Presumido com o Real, o Simples não é assunto: a linha dele vem mais abaixo)
  if (fora.length && simplesNoEstudo(conta.objetivo, c.entrada.regimeAtual)) out.push('- Fora desta comparação: ' + fora.map(g => ROTULO_REGIME[g]).join(' e ') + ' (o comparativo é ' + OBJETIVOS[conta.objetivo].rotulo + '; com objetivo "todos", a conta põe os três).');
  return out;
}
function blocoTributos(c, conta) {
  return regimesDe(conta).map(g => {
    const nomes = [];
    c.anos.forEach(r => (r[g].itens || []).forEach(it => { if (!nomes.includes(it.tributo)) nomes.push(it.tributo); }));
    if (!nomes.length) return null;
    const fator = c.anos.some(r => r.simples.disponivel && r.simples.fatorR != null && r.simples.anexosServico && r.simples.anexosServico.length);
    return '- ' + ROTULO_REGIME[g] + ': ' + nomes.map(nm => nm + ' ' + c.anos.map(r => { const it = (r[g].itens || []).find(x => x.tributo === nm); return r[g].disponivel ? (it ? moeda(it.valor) : '—') : 'fora'; }).join(' · ')).join('; ')
      + (g === 'simples' && fator ? '; fator r médio ' + c.anos.map(r => (r.simples.disponivel && r.simples.fatorR != null ? pct(r.simples.fatorR * 100, 1) + '%' : '—')).join(' · ') : '');
  }).filter(Boolean);
}
// as empresas dos mesmos sócios e o ano-calendário pelos números do sistema
function blocoGrupo(estudo, conta) {
  const e = estudo.entrada, g = (e.grupo || []).filter(x => x && Number(x.receita) > 0);
  const receita = (e.atividades || []).reduce((s, a) => s + (Number(a.receita) || 0), 0);
  const achadas = (estudo.grupoSeries || []).length;
  const fora = (estudo.grupoFora || []).map(x => '- Fica fora da soma: ' + x.nome + ' — ' + x.motivo + '.');
  if (!g.length) {
    const porque = estudo.cliente == null ? 'empresa sem cadastro: só as que a equipe pôs à mão' : achadas ? 'a equipe tirou da soma a que o sistema achou' : fora.length ? 'a regra deixa fora a que o sistema achou' : estudo.socios == null ? 'os sócios não foram lidos'
      : estudo.socios === 0 ? 'o cadastro não tem os sócios desta empresa' : 'o sistema não achou outra empresa dos sócios no cadastro';
    return ['EMPRESAS DOS MESMOS SÓCIOS: nenhuma na soma do limite (' + porque + ').', ...fora];
  }
  const soma = receita + g.reduce((s, x) => s + Number(x.receita), 0);
  const out = ['EMPRESAS DOS MESMOS SÓCIOS (o limite de R$ 4,8 milhões do Simples vale pra soma — LC 123, art. 3º, §4º, III a V: outra ME ou EPP com qualquer participação, outra com mais de 10% ou administrada pelo sócio)'];
  g.forEach((x, i) => out.push('- ' + x.nome + (x.socios && x.socios.length ? ' — ' + (x.socios.length === 1 ? 'sócio em comum: ' : 'sócios em comum: ') + x.socios.join(', ') : '')
    + ': ' + brl(x.receita) + ' nos 12 meses [' + origemDe(estudo.origens, 'grupo.' + i + '.receita') + ']'));
  out.push(...fora);
  out.push('- Nos 12 meses, somadas com esta: ' + brl(soma) + ' (' + pct(soma / 4800000 * 100, 0) + '% do limite).');
  const s = conta.situacao;
  if (s && s.meses) out.push('- O ano de ' + s.ano + ' pelos números do sistema, até ' + rotuloComp(s.ate) + ': ' + brl(s.acumulado)
    + (s.jaPassou ? ' — passou do limite em ' + s.passaEm + ': a exclusão vale a partir de ' + s.saiEm + '.'
      : s.passaEm ? '; no ritmo dos últimos 3 meses (' + brl(s.ritmo) + ' por mês), passa do limite em ' + s.passaEm + ' e as empresas saem do Simples em ' + s.saiEm + '.'
      : s.restantes > 0 ? '; faltam ' + brl(s.faltam) + ' pro limite (' + brl(s.porMesAteOLimite) + ' por mês até dezembro; o ritmo dos últimos 3 meses é ' + brl(s.ritmo) + ' por mês).' : '.'));
  return out;
}
// os números do estudo e de onde veio cada um
function blocoNumeros(estudo, conta = null) {
  const e = estudo.entrada, o = estudo.origens || {};
  const comSimples = regimesDe(conta).includes('simples');
  const v = (k, un) => (un === 'R$' ? brl(e[k]) : pct(e[k]) + (un ? (un.startsWith('%') ? un : ' ' + un) : ''));
  const linha = (k, rot) => '- ' + (rot || CAMPOS[k].rotulo) + ': ' + v(k, CAMPOS[k].un) + ' [' + origemDe(o, k) + ']';
  const out = ['OS NÚMEROS DO ESTUDO (R$ dos últimos 12 meses) E DE ONDE VEIO CADA UM'];
  (e.atividades || []).forEach((a, i) => {
    const t = TIPOS[a.tipo] || TIPOS.comercio, p = 'atividades.' + i + '.';
    const partes = ['receita ' + brl(a.receita) + ' [' + origemDe(o, p + 'receita') + ']'];
    if (tributoDe(a) === 'icms') {
      partes.push('ICMS das vendas ' + pct(a.aliqIcms) + '% [' + origemDe(o, p + 'aliqIcms') + ']');
      if (Number(a.pctST) > 0 || o[p + 'pctST']) partes.push('vendas com ICMS-ST ' + pct(a.pctST, 1) + '% [' + origemDe(o, p + 'pctST') + ']');
      if (Number(a.pctMonofasico) > 0) partes.push('revenda monofásica ' + pct(a.pctMonofasico, 1) + '% [' + origemDe(o, p + 'pctMonofasico') + ']');
      // a venda com alíquota zero de PIS/Cofins (a cesta básica): sai do PIS/Cofins do Presumido e do Real; no Simples, paga no DAS
      // (da Cesta Básica Nacional, segue zero; fora dela, 10% da alíquota desde abril de 2026 — LC 224/2025)
      if (Number(a.pctAliqZero) > 0 || o[p + 'pctAliqZero']) partes.push('vendas com alíquota zero de PIS/Cofins ' + pct(a.pctAliqZero, 1) + '% [' + origemDe(o, p + 'pctAliqZero') + ']'
        + (Number(a.pctAliqZero) > 0 ? (a.aliqZeroCesta ? ' (da Cesta Básica Nacional, LC 214, Anexos I e XV: seguem com zero)' : ' (fora da Cesta Básica Nacional: pagam 10% da alíquota desde abril de 2026, LC 224/2025 — 0,365% no Presumido e 0,925% no Real)') : ''));
      if (Number(a.redIcms) > 0 || o[p + 'redIcms']) partes.push('redução da base do ICMS no regime geral ' + pct(a.redIcms) + '% [' + origemDe(o, p + 'redIcms') + ']');
      if (comSimples && (Number(a.redIcmsSimples) > 0 || o[p + 'redIcmsSimples'])) partes.push('redução do ICMS no DAS ' + pct(a.redIcmsSimples) + '% [' + origemDe(o, p + 'redIcmsSimples') + ']');
    } else partes.push('ISS ' + pct(a.aliqIss) + '% [' + origemDe(o, p + 'aliqIss') + ']');
    if (a.tipo === 'industria') partes.push('IPI de 2026 ' + pct(a.aliqIpi) + '% da receita [' + origemDe(o, p + 'aliqIpi') + ']' + (a.ipiMantido ? ', IPI mantido (Zona Franca)' : ''));
    const anexo = a.anexo || t.anexo;
    if (comSimples && anexo !== t.anexo) partes.push('Anexo ' + anexo + ' do Simples');
    if (!comSimples) partes.push('presunção de ' + pct(a.presIrpj != null ? a.presIrpj : t.presIrpj) + '% no IRPJ e ' + pct(a.presCsll != null ? a.presCsll : t.presCsll) + '% na CSLL');
    if (comSimples && a.presIrpj != null && Number(a.presIrpj) !== t.presIrpj) partes.push('presunção do IRPJ ' + pct(a.presIrpj) + '%');
    if (comSimples && a.presCsll != null && Number(a.presCsll) !== t.presCsll) partes.push('presunção da CSLL ' + pct(a.presCsll) + '%');
    if (comSimples && a.tipo === 'servico_r' && a.fatorR === false) partes.push('sem o fator r (fica no Anexo V)');
    // a origem da atividade: com o Simples na comparação, vai junto a parte que é só dele (o anexo que as notas não dizem)
    const oTipo = o[p + 'tipo'];
    out.push('- Atividade ' + (i + 1) + ': ' + rotuloDoTipo(TIPOS[a.tipo] ? a.tipo : 'comercio', comSimples) + ' [' + (comSimples ? origemDe(o, p + 'tipo') + (oTipo && oTipo.simples ? ' · ' + oTipo.simples : '') : origemDe(o, p + 'tipo').replace(/ — confira o anexo$/, ' — confira')) + '] — ' + partes.join('; '));
  });
  ['compras', 'aliqCreditoIcms', 'pctComprasSimples', 'despesasCredito', 'outrasDespesas', 'folha', 'proLabore'].forEach(k => out.push(linha(k)));
  // o lucro do Real: o da contabilidade (a DRE até onde ela está feita, levada aos 12 meses pela receita), com os ajustes;
  // sem ele, a conta estima. E a confirmação de quem cuida da contabilidade, com o que o Domínio mostra daqueles meses
  const L = lucroDoEstudo({ entrada: e, origens: o, serie: estudo.serie, contabil: estudo.contabil });
  const mm = c => rotuloComp(c);
  if (fin(e.lucroContabil)) {
    const dre = L.dre, parcial = !!(dre && Math.abs(dre.fator - 1) > 0.0005);
    out.push(linha('lucroContabil') + (dre ? ' — a DRE de ' + mm(dre.de) + ' a ' + mm(dre.ate) + (parcial ? ' (' + dre.meses + (dre.janela ? ' dos ' + dre.janela.meses : '') + ' meses da receita): levado aos 12 meses pela receita (a margem dos meses que a DRE tem), ' + brl(Number(e.lucroContabil) * dre.fator) : '') : ''));
    out.push(linha('ajustesLalur'));
  } else {
    const s = L.sug;
    out.push('- ' + CAMPOS.lucroContabil.rotulo + ': não informado — a conta estima o lucro do Real pela receita menos as compras, a folha e as despesas [' + origemDe(o, 'lucroContabil') + ']'
      + (s && !s.antes && s.faltam.length ? '. A DRE a pedir: de ' + mm(s.de) + ' a ' + mm(s.ate) + ' (' + s.meses + ' dos ' + s.total + ' meses da receita, até onde a contabilidade está feita); os que faltam entram pela margem dos outros' : ''));
  }
  const ctb = estudo.contabil;
  if (ctb) out.push('- A contabilidade, pelo Controle das contabilidades: ' + (ctb.faz === false ? 'o escritório não faz a desta empresa' : ctb.feitaAte ? 'feita até ' + rotuloComp(ctb.feitaAte) : 'nenhum mês feito')
    + (ctb.responsavel && ctb.faz !== false ? ' · quem cuida: ' + ctb.responsavel : '') + '.');
  if (L.ate && L.sinais && L.sinais.lidos) out.push('- O que o Domínio mostra da contabilidade de ' + mm(L.de) + ' a ' + mm(L.ate) + ': ' + (L.sinais.itens.length ? L.sinais.itens.join('; ') + ' (' + L.sinais.comProblema + ' de ' + L.sinais.lidos + ' meses com problema)' : 'nenhum problema') + '.');
  if (L.ate) {
    // a confirmação: a marcada no estudo, ou o "sim" de quem cuida à pergunta do vigia; aberta, onde a pergunta está
    const dBR = d => (d ? String(d).split('-').reverse().join('/') : ''), p = L.perg, ela = (p && p.para) || L.responsavel || 'quem cuida';
    const estado = L.conf && L.conf.vale ? 'feita' + (L.conf.nome ? ' por ' + L.conf.nome : '') + (L.conf.em ? ' em ' + dBR(L.conf.em) : '')
      : L.pelaPergunta ? 'feita pela resposta de ' + ela + (p.respondidaEm ? ' em ' + dBR(p.respondidaEm) : '') + ' à pergunta do vigia (o resultado até ' + mm(p.ate) + ')'
      : 'falta (na tela, a missão "A confirmação da contabilidade", que confirma com um clique ou manda a pergunta pro vigia de quem cuida)'
        + (!p ? '' : p.estado === 'aberta' ? '. A pergunta está no vigia de ' + ela + (p.em ? ' desde ' + dBR(p.em) : '') + (p.pedidaPor ? ', feita por ' + p.pedidaPor : '') + (p.cobre ? '' : ', até ' + mm(p.ate)) + ', sem resposta'
          : p.estado === 'sim' ? '. ' + ela + ' confirmou só até ' + mm(p.ate) + (p.respondidaEm ? ', em ' + dBR(p.respondidaEm) : '')
          : '. ' + ela + ' respondeu' + (p.respondidaEm ? ' em ' + dBR(p.respondidaEm) : '') + ' à pergunta do vigia: "' + (p.resposta || p.texto || 'sem confirmar') + '"' + (p.resposta && p.texto ? ' — escreveu: "' + p.texto + '"' : ''));
    out.push('- A confirmação de ' + L.quem + ' de que o resultado até ' + mm(L.ate) + ' é confiável: ' + estado + '.');
  }
  if (e.rda || o.rda) out.push('- ICMS do restaurante no Presumido e no Real: ' + (e.rda === 'sim' ? 'optante do RDA (3,5% de todas as vendas de mercadoria, sem crédito)' : e.rda === 'melhor' ? 'o mais barato entre o RDA (3,5% das vendas, sem crédito) e o débito e crédito — os avisos dizem qual a conta usou' : 'débito e crédito, sem o RDA') + ' [' + origemDe(o, 'rda') + ']');
  if (comSimples && Number(e.difalSimples) > 0) out.push(linha('difalSimples'));
  out.push('- RAT ' + pct(e.rat) + '% · FAP ' + pct(e.fap) + ' · terceiros ' + pct(e.terceiros) + '% [' + origemDe(o, 'rat') + ']' + (Number(e.cprb) > 0 ? ' · CPRB ' + pct(e.cprb) + '% (desoneração da folha)' : ''));
  out.push('- Crescimento: da receita ' + pct(e.crescimentoReceita) + '% ao ano [' + origemDe(o, 'crescimentoReceita') + '] · da folha ' + pct(e.crescimentoFolha) + '% ao ano');
  const m = e.mix || {};
  if (Number(m.cheia) !== 100) out.push('- Vendas na Reforma (2027): cheia ' + pct(m.cheia, 1) + '% · −60% ' + pct(m.red60, 1) + '% · −40% ' + pct(m.red40, 1) + '% · −30% ' + pct(m.red30, 1) + '% · zero ' + pct(m.zero, 1) + '% [' + origemDe(o, 'mix') + ']');
  if (e.pctImpostoEmbutido != null) out.push('- Imposto embutido nas compras: ' + pct(e.pctImpostoEmbutido, 1) + '% [' + origemDe(o, 'pctImpostoEmbutido') + ']');
  if (e.pctComprasComCredito != null) out.push('- Compras com crédito cheio de CBS/IBS (pelo NCM): ' + pct(e.pctComprasComCredito, 1) + '% [' + origemDe(o, 'pctComprasComCredito') + ']');
  if (e.semLc224) out.push('- Com liminar contra o aumento do Presumido (LC 224/2025): fora da conta');
  return out;
}
// o "Por onde começar" da tela: as fases e as missões
function blocoFases(rot) {
  const sit = rot.pronto ? 'PRONTO PRA APRESENTAR: as missões que decidem estão cumpridas.'
    : rot.provisorio ? 'PROVISÓRIO: faltam missões que podem virar o resultado — ' + rot.passos.filter(p => p.estado !== 'feito' && p.peso === 'decide').map(p => p.curto || p.titulo).join('; ') + '.'
    : 'QUASE LÁ: o que falta não vira o resultado.';
  const out = ['O ESTUDO (o "Por onde começar" da tela, em fases e missões)', 'Situação: ' + sit,
    'Missões: ' + rot.feitas + ' de ' + rot.total + (rot.extras ? ' (extras, que não seguram a fase: ' + rot.extrasFeitas + ' de ' + rot.extras + ')' : '') + '.'];
  rot.fases.forEach((f, i) => {
    out.push((i + 1) + '. ' + f.titulo + ' — ' + (f.concluida ? 'concluída' + (f.conquista ? ': ' + f.conquista : '') : i === rot.faseAtual ? 'a fase de agora' : 'por fazer'));
    // a missão aberta diz o que a tela oferece pra cumprir: soltar o relatório na caixa dos relatórios do Domínio (o jeito
    // preferido: a origem fica verde), digitar ou marcar como conferido
    const comoCumprir = m => {
      if (m.estado === 'feita') return '';
      const minuscula = t => t.charAt(0).toLowerCase() + t.slice(1);   // só a primeira letra: "digitar o lucro da DRE"
      const jeitos = [m.relatorio ? 'soltar ' + m.relatorio + ' na caixa dos relatórios do Domínio' : null, m.campo ? minuscula(m.irRotulo || 'ir ao campo') : null,
        m.conferir ? 'marcar "' + (m.conferirRotulo || 'Está certo') + '"' : null].filter(Boolean);
      return jeitos.length ? ' (na tela: ' + jeitos.join(', ou ') + ')' : '';
    };
    f.missoes.forEach(m => out.push('   - [' + (m.estado === 'feita' ? 'cumprida' + (m.como ? ': ' + m.como : '') : (m.falta ? 'falta' : 'a conferir') + ' · ' + (m.peso === 'decide' ? 'decide o resultado' : m.peso === 'detalhe' ? 'extra' : 'importa'))
      + '] ' + m.titulo + ': ' + m.texto + comoCumprir(m)));
    // o que usar na fase: onde buscar cada informação hoje e o que vai chegar sozinho pelas pontes
    (f.fontes || []).forEach(x => out.push('   - Fonte: ' + x.info + ' [' + (x.situacao || x.rotuloEstado) + '] — onde buscar: ' + x.onde + (x.auto ? ' ' + x.auto : '')));
  });
  if (rot.proximo) out.push('Próximo passo: ' + rot.proximo.titulo + '.');
  return out;
}
function blocoConferencia(estudo, c) {
  const b0 = c.anos[0], cf = estudo.conferencia;
  if (!cf || !b0 || !b0.simples.disponivel || !(b0.receita > 0) || !fin(cf.aliquota)) return [];
  const nossa = b0.simples.das / b0.receita * 100;
  const longe = Math.abs(nossa - Number(cf.aliquota)) > 0.5;
  return ['Conferência com o PGDAS de ' + rotuloComp(cf.competencia) + ': a alíquota efetiva declarada foi ' + pct(cf.aliquota) + '%; a conta do Simples nos 12 meses dá ' + pct(nossa) + '%.'
    + (longe ? ' A diferença pode ser receita em outro anexo, ST ou monofásico, ou o RBT12 — confira as linhas de receita.' : ' Bate.')];
}
// o estudo gravado e o que o sistema tem hoje: quando os números grandes mudaram, dizer (a tela recomeça com eles)
function blocoSistemaHoje(estudo) {
  const s = estudo.sistema && estudo.sistema.entrada;
  if (!estudo.estudoId || !s) return [];
  const rec = x => (x.atividades || []).reduce((t, a) => t + (Number(a.receita) || 0), 0);
  const dif = (a, b) => Math.abs((Number(a) || 0) - (Number(b) || 0)) > Math.max(100, 0.01 * Math.abs(Number(b) || 0));
  const partes = [];
  if (dif(rec(s), rec(estudo.entrada))) partes.push('receita dos 12 meses ' + brl(rec(s)) + ' (o estudo usa ' + brl(rec(estudo.entrada)) + ')');
  [['folha', 'folha'], ['proLabore', 'pró-labore'], ['compras', 'compras']].forEach(([k, n]) => {
    if (fin(s[k]) && Number(s[k]) > 0 && dif(s[k], estudo.entrada[k])) partes.push(n + ' ' + brl(s[k]) + ' (o estudo usa ' + brl(estudo.entrada[k]) + ')');
  });
  return partes.length ? ['O SISTEMA HOJE tem números diferentes dos do estudo gravado: ' + partes.join('; ') + '. Na tela, "Recomeçar com os números do sistema" troca pelos de hoje (o que foi digitado se perde).'] : [];
}
// qual comparativo a conta fez e por quê: o escolhido na tela, o pedido nesta pergunta ou, sem escolha, o que o sistema
// sugere (na tela, a pergunta "Qual comparativo você quer fazer?" ainda está aberta)
function linhaDoObjetivo(estudo, conta, pedido) {
  const obj = conta && conta.objetivo;
  if (!objetivoValido(obj)) return [];
  const naTela = objetivoValido(estudo.entrada && estudo.entrada.objetivo);
  const outro = Object.keys(OBJETIVOS).find(k => k !== obj);
  const de = pedido && pedido === obj && pedido !== naTela ? 'pedido nesta pergunta' + (naTela ? '; o escolhido na tela é ' + OBJETIVOS[naTela].rotulo : '; na tela, a escolha ainda não foi feita')
    : naTela === obj ? 'o escolhido na tela'
    : 'ainda não escolhido na tela (ela abre perguntando "Qual comparativo você quer fazer?"): o sistema sugere este — ' + porQueDoObjetivo(estudo.entrada && estudo.entrada.regimeAtual, estudo.vedacoes);
  return ['Comparativo: ' + OBJETIVOS[obj].rotulo + ' (' + de + '). O outro é ' + OBJETIVOS[outro].rotulo + ': outra chamada, com objetivo "' + outro + '".'];
}
// o que o cadastro veda no Simples (o CNAE principal e os secundários, pessoa jurídica entre os sócios, a natureza jurídica).
// Só com o Simples no estudo (está no comparativo, ou é o regime da empresa hoje): no Presumido contra o Real de uma
// empresa do regime geral ele não é assunto — fica uma linha, pra quando perguntarem, e o detalhe vem com objetivo "todos"
function blocoVedacoes(estudo, conta = null) {
  const v = estudo.vedacoes;
  const regime = estudo.entrada && estudo.entrada.regimeAtual;
  if (conta && !simplesNoEstudo(conta.objetivo, regime)) {
    return ['O SIMPLES NÃO ENTRA NESTE ESTUDO (empresa do ' + ROTULO_REGIME[regime] + ', só o Presumido contra o Real): não fale dele na resposta, nem dos impedimentos. Só se perguntarem: '
      + (!v ? 'sem cadastro, o sistema não confere os impedimentos' : v.vedado ? 'hoje o cadastro veda o Simples pra ela (' + resumoDasVedacoes(v, { comBase: false }) + ')' : 'pelo cadastro, nada veda o Simples')
      + ' — o detalhe e a conta com ele são outra chamada, com objetivo "todos".'];
  }
  if (!v) return ['IMPEDIMENTOS DO SIMPLES: não conferidos (empresa sem cadastro: o sistema não tem o CNAE, os sócios nem a natureza jurídica).'];
  const item = i => '- ' + i.texto + ' (' + i.base + ')' + (i.remedio ? ' ' + i.remedio : '');
  const sem = v.semDado && v.semDado.length ? ['- Faltou no cadastro pra conferir: ' + v.semDado.join(', ') + '.'] : [];
  const nao = '- O sistema não confere: ' + NAO_CONFERE.join('; ') + '.';
  if (v.vedado) return ['IMPEDIMENTOS DO SIMPLES, PELO CADASTRO: o Simples está vedado pra ela hoje', ...v.impedimentos.map(item),
    ...(v.conferir.length ? ['- A conferir: ' + v.conferir.map(i => i.texto + ' (' + i.base + ')').join('; ') + '.'] : []), ...sem, nao];
  return ['IMPEDIMENTOS DO SIMPLES, PELO CADASTRO: ' + (oQueConferiu(v) ? 'nada veda — o sistema olhou ' + oQueConferiu(v) + '.' : 'o cadastro não tem o que conferir.'),
    ...(v.conferir.length ? ['- A conferir: ' + v.conferir.map(i => i.texto + ' (' + i.base + ')').join('; ') + '.'] : []), ...sem, nao];
}
// a precisão do estudo: o que falta (o que decide primeiro), com o efeito de cada item, e o que já está na conta
function blocoPrecisao(conta) {
  const p = conta.precisao;
  if (!p) return [];
  const out = ['PRECISÃO DO ESTUDO: ' + NIVEL_DA_PRECISAO[p.nivel]];
  if (p.falta.length) out.push('Falta, pra ficar mais preciso (o que decide primeiro):', ...p.falta.map(x => '- ' + x.titulo + ' [' + PESO_DA_PRECISAO[x.peso] + ']' + (x.efeito ? ': ' + x.efeito : '') + '.'));
  else out.push('Nada falta: as missões estão todas cumpridas.');
  if (p.tem.length) out.push('Já está na conta: ' + p.tem.map(x => x.titulo.charAt(0).toLowerCase() + x.titulo.slice(1) + ' (' + x.como + ')').join(' · ') + '.');
  return out;
}
// a decisão provisória: as missões que decidem e ainda faltam (a linha "Ainda pode virar" da tela)
function aindaPodeVirar(rot) {
  const decidem = rot && rot.provisorio ? rot.passos.filter(p => p.estado !== 'feito' && p.peso === 'decide') : [];
  return decidem.length ? ['PROVISÓRIO, ainda pode virar — ' + (decidem.length === 1 ? 'missão que falta: ' : 'missões que faltam: ') + decidem.map(p => p.curto || p.titulo).join('; ') + '.'] : [];
}
function cabecalho(estudo) {
  const c = estudo.cliente;
  const nome = c ? c.nome_principal + (c.nome_fantasia && c.nome_fantasia !== c.nome_principal ? ' (' + c.nome_fantasia + ')' : '') + ' · id ' + c.id : estudo.nome + ' (empresa sem cadastro no sistema)';
  const quem = estudo.gravadoPor ? ' por ' + (nomePorEmail(estudo.gravadoPor) || estudo.gravadoPor) : '';
  const de = estudo.estudoId
    ? 'O estudo gravado na tela Comparativo tributário em ' + momento(estudo.gravadoEm) + quem + ': os números são os dele (o que a equipe digitou, conferiu ou trouxe dos relatórios do Domínio).'
    : 'Ainda não há estudo gravado: os números são os que o sistema tem hoje, como a tela mostra ao abrir a empresa (' + (estudo.fontes || []).map(f => f.txt).join(' · ') + ').';
  return ['COMPARATIVO TRIBUTÁRIO — ' + nome, de, 'Regime de hoje: ' + (ROTULO_REGIME[estudo.entrada.regimeAtual] || 'não informado no estudo') + '.'];
}
// com o aviso do limite, ele é a notícia: a conta põe o Simples, mas o ano de agora tira a empresa dele
const LIMITE_PRIMEIRO = 'o aviso do limite vem na primeira frase, junto com o resultado (a conta dos 12 meses põe o Simples, mas pelo ano de agora a empresa sai dele: diga desde quando e qual fica mais barato entre o Presumido e o Real); depois, ';
// com o Simples vedado pelo cadastro e na comparação, a linha dele é simulação: vem na frente, com o mais barato sem ele
const VEDADO_PRIMEIRO = 'o Simples está vedado hoje pelo cadastro e a linha dele é simulação: diga isso na primeira frase, com os impedimentos e o mais barato sem ele; depois, ';
// só o Presumido contra o Real: de 2027 em diante a diferença é o IRPJ e a CSLL — a presunção de um lado, o lucro do outro
const GERAL = ' Entre o Presumido e o Real, de 2027 em diante a diferença é só o IRPJ e a CSLL (a presunção contra o lucro): diga o lucro em que os dois empatam e de onde veio o lucro da conta — o da contabilidade (a DRE, até que mês ela vai e se quem cuida da contabilidade já confirmou; se o Domínio mostra problema naqueles meses, diga quais) ou a estimativa, que não serve pra decidir quando as compras passam da receita.';
const fim = conta => 'Na resposta: ' + (conta.limite ? LIMITE_PRIMEIRO : conta.vedado ? VEDADO_PRIMEIRO : '') + 'o resultado em uma ou duas frases (o mais barato no ano da decisão e quanto), o porquê pelos tributos que mais pesam e, se ainda pode virar, o quê (as missões que decidem, as premissas no padrão — diga que são padrão a conferir).'
  + (conta.regimes && !conta.regimes.includes('simples') ? GERAL : '') + ' Perguntaram o que falta pra o estudo ficar mais preciso: a precisão do estudo, com o efeito de cada item, o que decide primeiro. Use os números daqui, sem refazer conta: outro cenário é outra chamada, com e_se. Mudar o estudo é na tela Comparativo tributário.';

export function textoDoComparativo({ estudo, conta, pedido = null }) {
  const out = [...cabecalho(estudo), ...linhaDoObjetivo(estudo, conta, pedido)];
  const comSimples = regimesDe(conta).includes('simples');
  if (!conta.comparacao) {
    out.push('A CONTA NÃO RODA: ' + conta.erro);
    out.push(...blocoNumeros(estudo, conta), '', ...blocoVedacoes(estudo, conta), '', ...blocoFases(conta.roteiro));
    out.push('Na resposta: diga o que falta (a receita dos 12 meses, na tela Comparativo tributário — digitada ou pelo faturamento do Domínio) e o que o sistema já tem.');
    return out.join('\n');
  }
  const c = conta.comparacao;
  out.push('', 'RESULTADO — os tributos a recolher no ano, a mesma conta da tela (os últimos 12 meses com as regras de ' + c.anos[0].ano + '; ' + c.anos.slice(1).map(r => r.ano).join(' e ') + ' projetados)',
    ...blocoResultado(c, conta), 'A decisão (' + c.anoDecisao + '): ' + fraseDaDecisao(c), ...aindaPodeVirar(conta.roteiro), ...(conta.limite ? ['ATENÇÃO, O LIMITE DO SIMPLES: ' + conta.limite] : []),
    ...(conta.vedado ? ['ATENÇÃO, OS IMPEDIMENTOS DO SIMPLES: ' + conta.vedado] : []), ...blocoConferencia(estudo, c));
  out.push('', ...blocoPrecisao(conta));
  out.push('', 'POR TRIBUTO (R$ no ano: ' + c.anos.map(rotAno).join(' · ') + ')', ...blocoTributos(c, conta));
  if (conta.muda.length) out.push('', 'O QUE MUDA O RESULTADO', ...conta.muda.map(m => '- ' + (m.alerta ? '[premissa no padrão que vira o resultado] ' : '') + m.txt));
  out.push('', ...blocoVedacoes(estudo, conta));
  // o limite do Simples com as empresas dos sócios só interessa com o Simples na comparação
  if (comSimples) out.push('', ...blocoGrupo(estudo, conta));
  out.push('', ...blocoNumeros(estudo, conta));
  out.push('', ...blocoFases(conta.roteiro));
  if (conta.prazos.length) out.push('', 'PRAZOS PRA DECIDIR', ...conta.prazos.map(p => '- ' + p.titulo + ': ' + p.texto));
  if (conta.avisos.length) out.push('', 'AVISOS DA CONTA', ...conta.avisos.map(a => '- ' + a));
  const hoje = blocoSistemaHoje(estudo);
  if (hoje.length) out.push('', ...hoje);
  out.push('', fim(conta));
  return out.join('\n');
}

// o "e se": o que mudou, o resultado com a mudança e o de antes, lado a lado no ano da decisão
const valorMud = (v, un) => (typeof v === 'string' ? v : !fin(v) ? '—' : un === 'R$' ? brl(v) : pct(v) + (un ? (un.startsWith('%') ? un : ' ' + un) : ''));
export function textoDoESe({ estudo, conta, eSe, contaESe, pedido = null }) {
  const c0 = conta.comparacao;
  const out = [cabecalho(estudo)[0] + ' — E SE', 'Só nesta conta: nada foi gravado. Pra valer, a pessoa muda o campo na tela Comparativo tributário.', ...linhaDoObjetivo(estudo, contaESe, pedido)];
  out.push('O que mudou:', ...(eSe.mudancas.length ? eSe.mudancas.map(m => '- ' + m.rotulo + ': ' + valorMud(m.antes, m.un) + ' → ' + valorMud(m.depois, m.un)) : ['- nada (nenhum número válido no e_se)']));
  if (eSe.avisos.length) out.push(...eSe.avisos.map(a => '- Atenção: ' + a));
  out.push(estudo.estudoId ? 'Os outros números são os do estudo gravado.' : 'Os outros números são os do sistema (não há estudo gravado).');
  if (!contaESe.comparacao) { out.push('', 'COM A MUDANÇA, A CONTA NÃO RODA: ' + contaESe.erro); return out.join('\n'); }
  const c = contaESe.comparacao;
  out.push('', 'RESULTADO COM A MUDANÇA', ...blocoResultado(c, contaESe), 'A decisão (' + c.anoDecisao + '): ' + fraseDaDecisao(c),
    ...(contaESe.limite ? ['ATENÇÃO, O LIMITE DO SIMPLES: ' + contaESe.limite] : []), ...(contaESe.vedado ? ['ATENÇÃO, OS IMPEDIMENTOS DO SIMPLES: ' + contaESe.vedado] : []));
  out.push('', 'POR TRIBUTO, COM A MUDANÇA (R$ no ano: ' + c.anos.map(rotAno).join(' · ') + ')', ...blocoTributos(c, contaESe));
  if (contaESe.muda.length) out.push('', 'O QUE MUDA O RESULTADO, COM A MUDANÇA', ...contaESe.muda.map(m => '- ' + (m.alerta ? '[premissa no padrão que vira o resultado] ' : '') + m.txt));
  if (c0) {
    const r0 = c0.anos.find(r => r.ano === c0.anoDecisao) || c0.anos[0];
    out.push('', 'SEM A MUDANÇA (o estudo), em ' + r0.ano + ': ' + regimesDe(conta).map(g => ROTULO_REGIME[g] + ' ' + (r0[g].disponivel ? brl(r0[g].total) : 'fora')).join(' · ')
      + ' — o mais barato: ' + (ROTULO_REGIME[r0.melhor] || '—') + '. ' + fraseDaDecisao(c0));
  } else out.push('', 'Sem a mudança, a conta do estudo não roda: ' + conta.erro);
  const rot = conta.roteiro;
  out.push('O estudo em si (sem a mudança): ' + (rot.pronto ? 'pronto pra apresentar.' : rot.provisorio ? 'provisório — faltam ' + rot.passos.filter(p => p.estado !== 'feito' && p.peso === 'decide').map(p => p.curto || p.titulo).join('; ') + '.' : 'quase lá.'));
  if (contaESe.avisos.length) out.push('', 'AVISOS DA CONTA, COM A MUDANÇA', ...contaESe.avisos.map(a => '- ' + a));
  out.push('', 'Na resposta: ' + (contaESe.limite ? LIMITE_PRIMEIRO : contaESe.vedado ? VEDADO_PRIMEIRO : '') + 'o que muda com o "e se" (o mais barato antes e depois, e a diferença), sem refazer conta, e que nada foi gravado.');
  return out.join('\n');
}

// a ferramenta inteira: o estudo, a conta e o texto (com o "e se", os dois)
// objetivo: o comparativo pedido na pergunta ('presumido_real' ou 'todos'); sem ele, o escolhido na tela e, sem escolha,
// o que o sistema sugere pelo regime de hoje e pelo que o cadastro veda no Simples
export async function comparativoDaEmpresa({ banco, termo, eSe = null, objetivo = null, contexto = {}, acharEmpresa, hoje }) {
  const r = await estudoDaPergunta({ banco, termo, contexto, acharEmpresa });
  if (r.erro) return r.erro;
  const estudo = r.estudo;
  const { linhas: par } = await banco.ler('rt_parametros?select=valor&chave=eq.aliq_ref_2027').catch(() => ({ linhas: [] }));
  const aliq2027 = par[0] && par[0].valor ? par[0].valor : null;
  const pedido = objetivoValido(objetivo);
  const conta = contaDoEstudo({ ...estudo, aliq2027, hoje, objetivo: pedido });
  const troca = eSe && typeof eSe === 'object' && Object.keys(eSe).length ? eSe : null;
  if (!troca) return textoDoComparativo({ estudo, conta, pedido });
  const e2 = aplicarESe(estudo.entrada, estudo.origens, troca, { aliq2027, serie: estudo.serie });
  // o "e se" fica no mesmo comparativo da conta de antes (trocar o regime de hoje não troca o caminho no meio)
  const contaESe = contaDoEstudo({ ...estudo, entrada: e2.entrada, origens: e2.origens, aliq2027, hoje, objetivo: conta.objetivo });
  return textoDoESe({ estudo, conta, eSe: e2, contaESe, pedido });
}

// o resumo gravado com o estudo (comparativos.resultado), numa linha — pro ver_empresa
export function resumoDoResultado(res) {
  if (!res || !res.melhor) return 'sem resultado gravado';
  const t = (res.totais && res.totais[String(res.anoDecisao)]) || {};
  // os regimes do comparativo do estudo (o gravado antes de 11/11/2026 não diz: os três)
  const regs = Array.isArray(res.regimes) && res.regimes.length ? REGIMES.filter(g => res.regimes.includes(g)) : REGIMES;
  return 'em ' + res.anoDecisao + ' o mais barato é o ' + (ROTULO_REGIME[res.melhor] || res.melhor) + ' (' + regs.map(g => ROTULO_REGIME[g] + ' ' + (fin(t[g]) ? brl(t[g]) : 'fora')).join(' · ') + ')'
    + (fin(res.diferenca) ? ', ' + brl(res.diferenca) + ' a menos que o segundo' : '');
}
