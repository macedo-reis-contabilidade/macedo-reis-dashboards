// ============================================================
// MACEDO & REIS — Assistente do escritório: o comparativo tributário (01/11/2026)
// A ferramenta comparativo: o estudo da empresa como a tela Comparativo tributário abre (assets/js/comparativo-estudo.js —
// o gravado ou os números do sistema, as empresas dos mesmos sócios) e a mesma conta da tela (Simples × Presumido × Real,
// os últimos 12 meses e 2027 e 2028), em texto pro modelo: o resultado, por tributo, o que muda o resultado, as empresas
// dos sócios, os números e de onde veio cada um, as fases do estudo, os prazos e os avisos. Com o "e se", refaz com os
// números trocados (aplicarESe) — só na resposta, nada é gravado. O CPF dos sócios, que casa as empresas dos mesmos
// sócios como na tela, é lido só dentro de carregarEstudo e não sai no texto. Testado em tests/assistente-funcao.test.mjs.
// ============================================================

import { REGIMES, ROTULO_REGIME, TIPOS, fraseDaDecisao } from '../../../assets/js/comparativo-motor.js';
import { FONTES, rotuloComp } from '../../../assets/js/comparativo-dados.js';
import { CAMPOS, carregarEstudo, estudoGravado, contaDoEstudo, aplicarESe } from '../../../assets/js/comparativo-estudo.js';
import { nomePorEmail } from '../../../assets/js/equipe.js';

const enc = v => encodeURIComponent(String(v));
const aspas = v => '"' + String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
const fin = v => v != null && v !== '' && Number.isFinite(Number(v));
const brl = v => (fin(v) ? Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—');
const moeda = v => (fin(v) ? Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—');
const pct = (v, d = 2) => (Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: d });
const momento = iso => { const d = new Date(iso || ''); return iso && !isNaN(d) ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(d) : '—'; };
const COLS_ESTUDO = 'id,cliente_id,nome,entrada,atualizado_em,atualizado_por';
const COLS_CLIENTE = 'id,nome_principal,nome_fantasia,documento,tipo_pessoa,regime_tributario,cnae_principal,cidade,uf,status';

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
    return { estudo: await carregarEstudo({ ler, cliente: c }) };
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

function blocoResultado(c) {
  const out = [];
  out.push('- Receita: ' + c.anos.map(r => rotAno(r) + ' ' + brl(r.receita)).join(' · '));
  const motivos = [];
  REGIMES.forEach(g => {
    const partes = c.anos.map(r => {
      const x = r[g];
      if (!x.disponivel) { if (x.motivo && !motivos.includes(x.motivo)) motivos.push(x.motivo); return rotAno(r) + ' FORA (não pode ficar no Simples)'; }
      return rotAno(r) + ' ' + brl(x.total) + ' (' + pct(x.aliquota * 100) + '% da receita)' + (r.melhor === g ? ' ← o mais barato' : '');
    });
    out.push('- ' + ROTULO_REGIME[g] + (g === c.entrada.regimeAtual ? ' (o regime de hoje)' : '') + ': ' + partes.join(' · ')
      + (g === 'real' ? ' — lucro antes do IR calculado: ' + c.anos.map(r => rotAno(r) + ' ' + brl(r.real.lucro)).join(' · ') : ''));
  });
  if (motivos.length) out.push('- Por que o Simples fica fora: ' + motivos.join(' | '));
  return out;
}
function blocoTributos(c) {
  return REGIMES.map(g => {
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
  if (!g.length) {
    const porque = estudo.cliente == null ? 'empresa sem cadastro: só as que a equipe pôs à mão' : achadas ? 'a equipe tirou da soma a que o sistema achou' : estudo.socios == null ? 'os sócios não foram lidos'
      : estudo.socios === 0 ? 'o cadastro não tem os sócios desta empresa' : 'o sistema não achou outra empresa dos sócios no cadastro';
    return ['EMPRESAS DOS MESMOS SÓCIOS: nenhuma na soma do limite (' + porque + ').'];
  }
  const soma = receita + g.reduce((s, x) => s + Number(x.receita), 0);
  const out = ['EMPRESAS DOS MESMOS SÓCIOS (o limite de R$ 4,8 milhões do Simples vale pra soma — LC 123, art. 3º, §4º, III e IV)'];
  g.forEach((x, i) => out.push('- ' + x.nome + (x.socios && x.socios.length ? ' — ' + (x.socios.length === 1 ? 'sócio em comum: ' : 'sócios em comum: ') + x.socios.join(', ') : '')
    + ': ' + brl(x.receita) + ' nos 12 meses [' + origemDe(estudo.origens, 'grupo.' + i + '.receita') + ']'));
  out.push('- Nos 12 meses, somadas com esta: ' + brl(soma) + ' (' + pct(soma / 4800000 * 100, 0) + '% do limite).');
  const s = conta.situacao;
  if (s && s.meses) out.push('- O ano de ' + s.ano + ' pelos números do sistema, até ' + rotuloComp(s.ate) + ': ' + brl(s.acumulado)
    + (s.jaPassou ? ' — passou do limite em ' + s.passaEm + ': a exclusão vale a partir de ' + s.saiEm + '.'
      : s.passaEm ? '; no ritmo dos últimos 3 meses (' + brl(s.ritmo) + ' por mês), passa do limite em ' + s.passaEm + ' e as empresas saem do Simples em ' + s.saiEm + '.'
      : s.restantes > 0 ? '; faltam ' + brl(s.faltam) + ' pro limite (' + brl(s.porMesAteOLimite) + ' por mês até dezembro; o ritmo dos últimos 3 meses é ' + brl(s.ritmo) + ' por mês).' : '.'));
  return out;
}
// os números do estudo e de onde veio cada um
function blocoNumeros(estudo) {
  const e = estudo.entrada, o = estudo.origens || {};
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
      if (Number(a.redIcms) > 0 || o[p + 'redIcms']) partes.push('redução da base do ICMS no regime geral ' + pct(a.redIcms) + '% [' + origemDe(o, p + 'redIcms') + ']');
      if (Number(a.redIcmsSimples) > 0 || o[p + 'redIcmsSimples']) partes.push('redução do ICMS no DAS ' + pct(a.redIcmsSimples) + '% [' + origemDe(o, p + 'redIcmsSimples') + ']');
    } else partes.push('ISS ' + pct(a.aliqIss) + '% [' + origemDe(o, p + 'aliqIss') + ']');
    if (a.tipo === 'industria') partes.push('IPI de 2026 ' + pct(a.aliqIpi) + '% da receita [' + origemDe(o, p + 'aliqIpi') + ']' + (a.ipiMantido ? ', IPI mantido (Zona Franca)' : ''));
    const anexo = a.anexo || t.anexo;
    if (anexo !== t.anexo) partes.push('Anexo ' + anexo + ' do Simples');
    if (a.presIrpj != null && Number(a.presIrpj) !== t.presIrpj) partes.push('presunção do IRPJ ' + pct(a.presIrpj) + '%');
    if (a.presCsll != null && Number(a.presCsll) !== t.presCsll) partes.push('presunção da CSLL ' + pct(a.presCsll) + '%');
    if (a.tipo === 'servico_r' && a.fatorR === false) partes.push('sem o fator r (fica no Anexo V)');
    out.push('- Atividade ' + (i + 1) + ': ' + t.rotulo + ' [' + origemDe(o, p + 'tipo') + '] — ' + partes.join('; '));
  });
  ['compras', 'aliqCreditoIcms', 'pctComprasSimples', 'despesasCredito', 'outrasDespesas', 'folha', 'proLabore'].forEach(k => out.push(linha(k)));
  if (Number(e.difalSimples) > 0) out.push(linha('difalSimples'));
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
    f.missoes.forEach(m => out.push('   - [' + (m.estado === 'feita' ? 'cumprida' + (m.como ? ': ' + m.como : '') : (m.falta ? 'falta' : 'a conferir') + ' · ' + (m.peso === 'decide' ? 'decide o resultado' : m.peso === 'detalhe' ? 'extra' : 'importa'))
      + '] ' + m.titulo + ': ' + m.texto));
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
function cabecalho(estudo) {
  const c = estudo.cliente;
  const nome = c ? c.nome_principal + (c.nome_fantasia && c.nome_fantasia !== c.nome_principal ? ' (' + c.nome_fantasia + ')' : '') + ' · id ' + c.id : estudo.nome + ' (empresa sem cadastro no sistema)';
  const quem = estudo.gravadoPor ? ' por ' + (nomePorEmail(estudo.gravadoPor) || estudo.gravadoPor) : '';
  const de = estudo.estudoId
    ? 'O estudo gravado na tela Comparativo tributário em ' + momento(estudo.gravadoEm) + quem + ': os números são os dele (o que a equipe digitou, conferiu ou trouxe dos relatórios do Domínio).'
    : 'Ainda não há estudo gravado: os números são os que o sistema tem hoje, como a tela mostra ao abrir a empresa (' + (estudo.fontes || []).map(f => f.txt).join(' · ') + ').';
  return ['COMPARATIVO TRIBUTÁRIO — ' + nome, de, 'Regime de hoje: ' + (ROTULO_REGIME[estudo.entrada.regimeAtual] || 'não informado no estudo') + '.'];
}
const FIM = 'Na resposta: o resultado em uma ou duas frases (o mais barato no ano da decisão e quanto), o porquê pelos tributos que mais pesam e, se ainda pode virar, o quê (as missões que decidem, as premissas no padrão — diga que são padrão a conferir). Use os números daqui, sem refazer conta: outro cenário é outra chamada, com e_se. Mudar o estudo é na tela Comparativo tributário.';

export function textoDoComparativo({ estudo, conta }) {
  const out = [...cabecalho(estudo)];
  if (!conta.comparacao) {
    out.push('A CONTA NÃO RODA: ' + conta.erro);
    out.push(...blocoNumeros(estudo), '', ...blocoFases(conta.roteiro));
    out.push('Na resposta: diga o que falta (a receita dos 12 meses, na tela Comparativo tributário — digitada ou pelo faturamento do Domínio) e o que o sistema já tem.');
    return out.join('\n');
  }
  const c = conta.comparacao;
  out.push('', 'RESULTADO — os tributos a recolher no ano, a mesma conta da tela (os últimos 12 meses com as regras de ' + c.anos[0].ano + '; ' + c.anos.slice(1).map(r => r.ano).join(' e ') + ' projetados)',
    ...blocoResultado(c), 'A decisão (' + c.anoDecisao + '): ' + fraseDaDecisao(c), ...(conta.limite ? ['ATENÇÃO, O LIMITE DO SIMPLES: ' + conta.limite] : []), ...blocoConferencia(estudo, c));
  out.push('', 'POR TRIBUTO (R$ no ano: ' + c.anos.map(rotAno).join(' · ') + ')', ...blocoTributos(c));
  if (conta.muda.length) out.push('', 'O QUE MUDA O RESULTADO', ...conta.muda.map(m => '- ' + (m.alerta ? '[premissa no padrão que vira o resultado] ' : '') + m.txt));
  out.push('', ...blocoGrupo(estudo, conta));
  out.push('', ...blocoNumeros(estudo));
  out.push('', ...blocoFases(conta.roteiro));
  if (conta.prazos.length) out.push('', 'PRAZOS PRA DECIDIR', ...conta.prazos.map(p => '- ' + p.titulo + ': ' + p.texto));
  if (conta.avisos.length) out.push('', 'AVISOS DA CONTA', ...conta.avisos.map(a => '- ' + a));
  const hoje = blocoSistemaHoje(estudo);
  if (hoje.length) out.push('', ...hoje);
  out.push('', FIM);
  return out.join('\n');
}

// o "e se": o que mudou, o resultado com a mudança e o de antes, lado a lado no ano da decisão
const valorMud = (v, un) => (typeof v === 'string' ? v : !fin(v) ? '—' : un === 'R$' ? brl(v) : pct(v) + (un ? (un.startsWith('%') ? un : ' ' + un) : ''));
export function textoDoESe({ estudo, conta, eSe, contaESe }) {
  const c0 = conta.comparacao;
  const out = [cabecalho(estudo)[0] + ' — E SE', 'Só nesta conta: nada foi gravado. Pra valer, a pessoa muda o campo na tela Comparativo tributário.'];
  out.push('O que mudou:', ...(eSe.mudancas.length ? eSe.mudancas.map(m => '- ' + m.rotulo + ': ' + valorMud(m.antes, m.un) + ' → ' + valorMud(m.depois, m.un)) : ['- nada (nenhum número válido no e_se)']));
  if (eSe.avisos.length) out.push(...eSe.avisos.map(a => '- Atenção: ' + a));
  out.push(estudo.estudoId ? 'Os outros números são os do estudo gravado.' : 'Os outros números são os do sistema (não há estudo gravado).');
  if (!contaESe.comparacao) { out.push('', 'COM A MUDANÇA, A CONTA NÃO RODA: ' + contaESe.erro); return out.join('\n'); }
  const c = contaESe.comparacao;
  out.push('', 'RESULTADO COM A MUDANÇA', ...blocoResultado(c), 'A decisão (' + c.anoDecisao + '): ' + fraseDaDecisao(c),
    ...(contaESe.limite ? ['ATENÇÃO, O LIMITE DO SIMPLES: ' + contaESe.limite] : []));
  out.push('', 'POR TRIBUTO, COM A MUDANÇA (R$ no ano: ' + c.anos.map(rotAno).join(' · ') + ')', ...blocoTributos(c));
  if (contaESe.muda.length) out.push('', 'O QUE MUDA O RESULTADO, COM A MUDANÇA', ...contaESe.muda.map(m => '- ' + (m.alerta ? '[premissa no padrão que vira o resultado] ' : '') + m.txt));
  if (c0) {
    const r0 = c0.anos.find(r => r.ano === c0.anoDecisao) || c0.anos[0];
    out.push('', 'SEM A MUDANÇA (o estudo), em ' + r0.ano + ': ' + REGIMES.map(g => ROTULO_REGIME[g] + ' ' + (r0[g].disponivel ? brl(r0[g].total) : 'fora')).join(' · ')
      + ' — o mais barato: ' + (ROTULO_REGIME[r0.melhor] || '—') + '. ' + fraseDaDecisao(c0));
  } else out.push('', 'Sem a mudança, a conta do estudo não roda: ' + conta.erro);
  const rot = conta.roteiro;
  out.push('O estudo em si (sem a mudança): ' + (rot.pronto ? 'pronto pra apresentar.' : rot.provisorio ? 'provisório — faltam ' + rot.passos.filter(p => p.estado !== 'feito' && p.peso === 'decide').map(p => p.curto || p.titulo).join('; ') + '.' : 'quase lá.'));
  if (contaESe.avisos.length) out.push('', 'AVISOS DA CONTA, COM A MUDANÇA', ...contaESe.avisos.map(a => '- ' + a));
  out.push('', 'Na resposta: o que muda com o "e se" (o mais barato antes e depois, e a diferença), sem refazer conta, e que nada foi gravado.');
  return out.join('\n');
}

// a ferramenta inteira: o estudo, a conta e o texto (com o "e se", os dois)
export async function comparativoDaEmpresa({ banco, termo, eSe = null, contexto = {}, acharEmpresa, hoje }) {
  const r = await estudoDaPergunta({ banco, termo, contexto, acharEmpresa });
  if (r.erro) return r.erro;
  const estudo = r.estudo;
  const { linhas: par } = await banco.ler('rt_parametros?select=valor&chave=eq.aliq_ref_2027').catch(() => ({ linhas: [] }));
  const aliq2027 = par[0] && par[0].valor ? par[0].valor : null;
  const conta = contaDoEstudo({ ...estudo, aliq2027, hoje });
  const pedido = eSe && typeof eSe === 'object' && Object.keys(eSe).length ? eSe : null;
  if (!pedido) return textoDoComparativo({ estudo, conta });
  const e2 = aplicarESe(estudo.entrada, estudo.origens, pedido, { aliq2027 });
  const contaESe = contaDoEstudo({ ...estudo, entrada: e2.entrada, origens: e2.origens, aliq2027, hoje });
  return textoDoESe({ estudo, conta, eSe: e2, contaESe });
}

// o resumo gravado com o estudo (comparativos.resultado), numa linha — pro ver_empresa
export function resumoDoResultado(res) {
  if (!res || !res.melhor) return 'sem resultado gravado';
  const t = (res.totais && res.totais[String(res.anoDecisao)]) || {};
  return 'em ' + res.anoDecisao + ' o mais barato é o ' + (ROTULO_REGIME[res.melhor] || res.melhor) + ' (' + REGIMES.map(g => ROTULO_REGIME[g] + ' ' + (fin(t[g]) ? brl(t[g]) : 'fora')).join(' · ') + ')'
    + (fin(res.diferenca) ? ', ' + brl(res.diferenca) + ' a menos que o segundo' : '');
}
