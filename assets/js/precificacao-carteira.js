// ============================================================
// MACEDO & REIS — Precificação › Carteira (19/10/2026, pedido do Samuel): a revisão do honorário dos clientes da casa
// O motor (assets/js/precificacao-motor.js) com o que o sistema já sabe de cada cliente — o cadastro, os sócios, as
// obrigações vinculadas, a carteira (o sistema que a empresa usa), a ficha da Reforma (o faturamento e a decisão), as
// regularizações, o Fator R — e o honorário de hoje (o boleto; sem boleto, o Conta Azul, que só os sócios leem). O que
// falta responder quase sempre soma: o resultado só com o que o sistema sabe é o "piso". A tela é a aba Carteira de
// comercial-precificacao.html; a revisão grava em revisoes_honorario (só os sócios). Puro: tests/precificacao-carteira.test.mjs.
// ============================================================

const semAcento = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '');
const norm = s => semAcento(s).toUpperCase().replace(/\s+/g, ' ').trim();

// de onde veio cada resposta (a etiqueta ao lado da pergunta)
export const FONTES = { cadastro: 'cadastro', socios: 'sócios', obrigacoes: 'obrigações', carteira: 'carteira', reforma: 'Reforma', regularizacoes: 'regularizações',
  fatorR: 'Fator R', boletos: 'boleto', conta_azul: 'Conta Azul', receita: 'Receita (PGDAS)' };

// o regime do cadastro → a opção da pergunta A10 (MEI fica com a aba MEI)
export const REGIME_DO_CADASTRO = { 'Simples Nacional': 'Simples Nacional', 'Lucro Presumido': 'Lucro Presumido', 'Lucro Real': 'Lucro Real',
  'Imune': 'Imune/Isenta (associação)', 'Isento': 'Imune/Isenta (associação)' };
export const ehMei = cliente => !!cliente && cliente.regime_tributario === 'MEI';

// a natureza jurídica do cadastro → o tipo societário (A4, só informativo)
export function tipoSocietario(natureza, regime) {
  if (regime === 'MEI') return 'MEI';
  const n = norm(natureza), cod = n.replace(/\D/g, '').slice(0, 3);
  if (!n) return null;
  if (/LIMITADA/.test(n) || cod === '206') return 'LTDA';
  if (/INDIVIDUAL/.test(n) || cod === '213') return 'EI';
  if (/ANONIMA/.test(n) || cod === '204' || cod === '205') return 'S/A';
  if (/ASSOCIA|SINDICAL|FUNDACAO/.test(n) || cod === '399' || cod === '307') return 'Associação';
  return 'Outro';
}

// o "sistemas" da carteira → o ERP (B8): emissor da prefeitura/Sefaz, maquininha ou nada = não tem ERP
export function erpDaCarteira(sistemas) {
  const s = norm(sistemas);
  if (!s || /^[-–—.]+$/.test(s)) return 'Não possui';
  const partes = s.split(/\s*[\/,+]\s*/).filter(Boolean);
  const naoEhErp = p => /EMISSOR|PREFEITURA|SEFAZ|^TEF\b|MAQUIN|SAFEWEB|^-$/.test(p);
  return partes.every(naoEhErp) ? 'Não possui' : 'Possui sem integração contábil';
}

// as perguntas de obrigação (bloco D) pelas obrigações vinculadas ao cliente (cliente_obrigacoes → obrigacoes_fiscais)
const OBRIGACAO_DA_QUESTAO = [['D1', /EFD FISCAL/], ['D2', /EFD CONTRIBUI/], ['D4', /^ECF\b/], ['D6', /EFD REINF/], ['D8', /^GIA\b/],
  ['D9', /DEISS|(^|[^A-Z])ISS([^A-Z]|$)/], ['D14', /DESTDA/], ['D15', /^DEISS\b/]];
const EMITE_NOTAS = /^NFS?-E\b|ENVIAR NFS-E/;
const PARCELAMENTO = /PARCELAMENTO/;
const ICMS_ST = /SUBSTITUI|ANTECIPA/;

// os regimes em que cada pergunta aparece (precificacao_obrigacoes: questao_id → regimes); sem a pergunta lá, aparece em todos
export function regimesDasQuestoes(obrigacoesPrec) {
  const m = new Map();
  (obrigacoesPrec || []).forEach(o => { if (!o || !o.questao_id) return; const s = m.get(o.questao_id) || new Set(); (o.regimes || []).forEach(r => s.add(r)); m.set(o.questao_id, s); });
  return m;
}

// ============================================================
// respostasDoSistema(dados, { regimesDaQuestao }) → { respostas, origem }
//   dados: { cliente (o cadastro), socios (quantos), obrigacoes ([nomes das vinculadas e ativas]), fatorR (bool),
//            regularizacoes ([status]), reforma ({ receita_mensal, rbt12, decisao } | null), carteira ({ sistemas, ramo }),
//            hoje ({ valor, fonte } | null), receita ({ competencia, receita_mes, receita_12_meses } | null — a última
//            declaração do PGDAS lida pela ponte da Receita, 23/10/2026: o faturamento dela vem antes do da Reforma) }
//   origem: pergunta → a fonte (FONTES)
// ============================================================
export function respostasDoSistema(d, { regimesDaQuestao = new Map() } = {}) {
  const c = d.cliente || {};
  const respostas = {}, origem = {};
  const por = (id, valor, fonte) => { if (valor == null || valor === '') return; respostas[id] = valor; origem[id] = fonte; };
  const regime = REGIME_DO_CADASTRO[c.regime_tributario] || null;
  const aparece = id => { const rs = regimesDaQuestao.get(id); return !rs || (!!regime && rs.has(regime)); };

  por('A1', c.nome_principal || null, 'cadastro');
  por('A1B', formatarDocumento(c.documento), 'cadastro');
  const local = [c.cidade, c.uf].filter(Boolean).join('/');
  const end = [[c.logradouro, c.numero].filter(Boolean).join(', '), c.bairro, local].filter(Boolean).join(' · ') + (c.cep ? ' · CEP ' + c.cep : '');
  por('A1C', c.logradouro ? end : null, 'cadastro');
  const rf = d.reforma || null;
  // o faturamento médio do mês: a declaração do PGDAS que a ponte da Receita leu (os 12 meses ÷ 12), senão a ficha da Reforma
  const rc = d.receita || null;
  const mensalRc = rc && Number(rc.receita_12_meses) > 0 ? Number(rc.receita_12_meses) / 12 : 0;
  const mensal = rf ? (Number(rf.receita_mensal) > 0 ? Number(rf.receita_mensal) : Number(rf.rbt12) > 0 ? Number(rf.rbt12) / 12 : 0) : 0;
  if (mensalRc > 0) por('A2M', Math.round(mensalRc * 100) / 100, 'receita');
  else por('A2M', mensal > 0 ? Math.round(mensal * 100) / 100 : null, 'reforma');
  por('A4', tipoSocietario(c.natureza_juridica, c.regime_tributario), 'cadastro');
  por('A5', Number(d.socios) > 0 ? Number(d.socios) : null, 'socios');
  por('A6', c.cidade || null, 'cadastro');
  por('A10', regime, 'cadastro');
  const k = d.carteira || {};
  por('A11', [c.cnae_principal, k.ramo].filter(Boolean).join(' · ') || null, 'cadastro');
  if (regime === 'Simples Nacional' && d.fatorR) por('A11B', 'Sim', 'fatorR');
  // já é cliente: não vem de outro escritório
  por('A12', 'Não', 'carteira');
  por('A13', 'Não se aplica', 'carteira');
  if (d.hoje && Number(d.hoje.valor) > 0) por('A12B', Number(d.hoje.valor), d.hoje.fonte === 'conta_azul' ? 'conta_azul' : 'boletos');

  const obr = (d.obrigacoes || []).map(norm);
  const temObrig = obr.length > 0;
  por('B3', temObrig ? (obr.some(n => EMITE_NOTAS.test(n)) ? 'O escritório contábil' : 'Nossa empresa') : null, 'obrigacoes');
  if (k.sistemas != null && String(k.sistemas).trim()) por('B8', erpDaCarteira(k.sistemas), 'carteira');

  // bloco D: com obrigação vinculada, "Sim"; sem ela (e o cliente tem outras vinculadas), "Não" — só nas do regime
  if (regime) {
    OBRIGACAO_DA_QUESTAO.forEach(([id, re]) => {
      if (!aparece(id)) return;
      if (obr.some(n => re.test(n))) por(id, 'Sim', 'obrigacoes');
      else if (temObrig) por(id, 'Não', 'obrigacoes');
    });
    if (temObrig) por('D12', obr.filter(n => PARCELAMENTO.test(n)).length, 'obrigacoes');
    const regs = (d.regularizacoes || []).map(String);
    if (regs.length) por('D11', regs.some(s => ['levantamento', 'apresentado', 'aprovado_cliente', 'sem_acordo'].includes(s)) ? 'Sim' : 'Não', 'regularizacoes');
    const cnae = String(c.cnae_principal || '').replace(/\D/g, '');
    if (obr.some(n => ICMS_ST.test(n))) por('D13', 'Sim', 'obrigacoes');
    else if (/^(41|42|43|49)/.test(cnae)) por('D13', 'Sim', 'cadastro');
    if (regime === 'Simples Nacional' && rf && rf.decisao === 'por_fora') por('D10', 'Sim', 'reforma');
    if (regime === 'Simples Nacional' && rf && rf.decisao === 'por_dentro') por('D10', 'Não', 'reforma');
    if (aparece('D17') && /^86/.test(cnae)) por('D17', 'Sim', 'cadastro');
    if (aparece('D18') && /^682[12]/.test(cnae)) por('D18', 'Sim', 'cadastro');
  }
  return { respostas, origem };
}

/** A última declaração do PGDAS com o faturamento, por cliente (receita_pgdas: { cliente_id, competencia, receita_mes,
 *  receita_12_meses }) → Map(cliente_id → a linha da competência mais recente que tem os 12 meses). */
export function ultimaDeclaracaoPorCliente(linhas) {
  const m = new Map();
  (linhas || []).forEach(l => {
    if (!l || !l.cliente_id || !(Number(l.receita_12_meses) > 0)) return;
    const a = m.get(l.cliente_id);
    if (!a || String(l.competencia) > String(a.competencia)) m.set(l.cliente_id, l);
  });
  return m;
}

const formatarDocumento = doc => {
  const d = String(doc || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  if (d.length === 14) return d.replace(/^(..)(...)(...)(....)(..)$/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/^(...)(...)(...)(..)$/, '$1.$2.$3-$4');
  return d || null;
};

// as perguntas que mexem no preço (as que o motor lê): as que ficaram em branco são o que "falta responder"
export const QUESTOES_DO_PRECO = ['A2M', 'A5', 'A7', 'A8', 'A9', 'A10', 'A11B', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8',
  'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D8', 'D9', 'D10', 'D11', 'D12', 'D13', 'D20', 'D21', 'E1', 'E2', 'E4'];
export const BLOCO_DA_QUESTAO = { A: 'empresa', B: 'notas, bancos e sistema', C: 'folha', D: 'obrigações', E: 'qualidade' };
// faltamResponder(respostas, visivel) → [ids], na ordem do motor; visivel(id): a pergunta aparece no formulário
export function faltamResponder(respostas, visivel = () => true) {
  const r = respostas || {};
  return QUESTOES_DO_PRECO.filter(id => visivel(id) && (r[id] == null || r[id] === ''));
}

// ---------- o honorário de hoje ----------
// o boleto (a última competência, que a geração do mês copia), senão a base de cobrança, senão o Conta Azul
export function honorarioDeHoje({ boleto = null, base = null, contaAzul = null } = {}) {
  if (boleto && Number(boleto.valor) > 0) return { valor: Number(boleto.valor), fonte: 'boletos', competencia: boleto.competencia || null };
  if (Number(base) > 0) return { valor: Number(base), fonte: 'boletos', competencia: null };
  if (contaAzul && Number(contaAzul.total) > 0) return { valor: Number(contaAzul.total), fonte: 'conta_azul', competencia: String(contaAzul.data_vencimento || '').slice(0, 7) || null };
  return null;
}

// o nome como o vigia compara (vigia_nome_base no banco): sem acento e pontuação, sem LTDA/ME/EPP/EIRELI/FILIAL e números
export function nomeBase(p) {
  return semAcento(p).toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\b(LTDA|ME|EPP|EIRELI|LTD|FILIAL|[0-9]+)\b/g, ' ').replace(/\s+/g, ' ').trim();
}
// vigia_nomes_batem: iguais sem espaço; um começa com o outro (8 letras ou mais); ou o sobrenome igual e o primeiro nome pela inicial
export function nomesBatem(a, b) {
  if (!a || !b) return false;
  const A = a.replace(/ /g, ''), B = b.replace(/ /g, '');
  if (A === B) return true;
  if (A.length >= 8 && B.startsWith(A)) return true;
  if (B.length >= 8 && A.startsWith(B)) return true;
  if (a.includes(' ') && b.includes(' ')) {
    const ua = a.slice(a.lastIndexOf(' ') + 1), ub = b.slice(b.lastIndexOf(' ') + 1);
    const pa = a.split(' ')[0], pb = b.split(' ')[0];
    return ua.length >= 4 && ua === ub && (pa.startsWith(pb) || pb.startsWith(pa));
  }
  return false;
}
// as parcelas de honorário do Conta Azul (as categorias de honorário mensal e de contrato MEI), com o nome já comparável
export const CATEGORIAS_HONORARIO = ['HONORARIOS MENSAIS', 'MEI - CONTRATOS'];
export function parcelasDeHonorario(parcelas) {
  return (parcelas || []).filter(p => p && String(p.natureza || '').toLowerCase() === 'receita' && Number(p.total) > 0
    && (Array.isArray(p.categorias) ? p.categorias : []).some(k => CATEGORIAS_HONORARIO.includes(norm(k && (k.nome || k)))))
    .map(p => ({ base: nomeBase(p.fornecedor_cliente_nome), total: Number(p.total), data_vencimento: p.data_vencimento || null }))
    .filter(p => p.base);
}
// a parcela mais recente do cliente (pelo nome ou pelo fantasia), até a data limite
export function parcelaDoCliente(cliente, parcelasPreparadas, ate = null) {
  const nomes = [cliente && cliente.nome_principal, cliente && cliente.nome_fantasia].map(nomeBase).filter(Boolean);
  if (!nomes.length) return null;
  let melhor = null;
  for (const p of parcelasPreparadas || []) {
    if (ate && p.data_vencimento && String(p.data_vencimento) > ate) continue;
    if (!nomes.some(n => nomesBatem(n, p.base))) continue;
    if (!melhor || String(p.data_vencimento || '') > String(melhor.data_vencimento || '')) melhor = p;
  }
  return melhor;
}

// ---------- as revisões ----------
export const SITUACOES = [['estudo', 'Estudo'], ['proposto', 'Reajuste proposto'], ['aceito', 'Aceito'], ['mantido', 'Mantido']];
export const rotuloSituacao = s => (SITUACOES.find(x => x[0] === s) || [s, s || '—'])[1];
// a revisão mais recente de cada cliente
export function ultimaPorCliente(revisoes) {
  const m = new Map();
  (revisoes || []).forEach(r => { const a = m.get(r.cliente_id); if (!a || String(r.atualizado_em || r.criado_em) > String(a.atualizado_em || a.criado_em)) m.set(r.cliente_id, r); });
  return m;
}
// os meses que o reajuste pode começar: do mês de hoje até um ano depois ('AAAA-MM')
export function mesesDaVigencia(hojeISO, n = 13) {
  const [a, m] = String(hojeISO).split('-').map(Number);
  return Array.from({ length: n }, (_, i) => { const d = new Date(Date.UTC(a, m - 1 + i, 1)); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0'); });
}
export const mesBR = comp => (comp ? String(comp).slice(5, 7) + '/' + String(comp).slice(0, 4) : '—');
// a diferença em % (do motor pra hoje)
export const diferenca = (motor, hoje) => (Number(hoje) > 0 && Number.isFinite(Number(motor)) ? (Number(motor) - Number(hoje)) / Number(hoje) : null);

// ---------- o número que vale na lista e no resumo (19/10/2026, pedido do Samuel) ----------
// referenciaDaLinha({ piso, revisao, hoje }) → { valor, tipo, ... } | null: o combinado (aceito, com a vigência), o de hoje
// (mantido — com o motor da revisão), a revisão (o motor com as respostas conferidas, com a data) ou, sem revisão, o piso
// (o motor só com o que o sistema sabe). Depois de revisado, o piso sai de cena
export function referenciaDaLinha({ piso = null, revisao = null, hoje = null } = {}) {
  const r = revisao;
  if (r && r.status === 'aceito' && Number(r.honorario_novo) > 0) return { valor: Number(r.honorario_novo), tipo: 'combinado', vigencia: r.vigencia || null };
  if (r && r.status === 'mantido') {
    const v = hoje && Number(hoje.valor) > 0 ? Number(hoje.valor) : Number(r.honorario_atual) > 0 ? Number(r.honorario_atual) : null;
    return v ? { valor: v, tipo: 'mantido', motor: Number(r.honorario_sugerido) > 0 ? Number(r.honorario_sugerido) : null } : null;
  }
  if (r && Number(r.honorario_sugerido) > 0) return { valor: Number(r.honorario_sugerido), tipo: 'revisado', em: r.atualizado_em || r.criado_em || null };
  if (piso != null && Number.isFinite(Number(piso))) return { valor: Number(piso), tipo: 'piso' };
  return null;
}
// paga menos que o motor: ainda sem decisão (o piso ou a revisão em estudo/proposta) e abaixo dele. O combinado e o
// mantido já estão decididos — o combinado conta nos reajustes aceitos
export function pagaMenosQueOMotor(linha) {
  const ref = referenciaDaLinha(linha || {});
  const hoje = linha && linha.hoje ? Number(linha.hoje.valor) : 0;
  return !!ref && (ref.tipo === 'piso' || ref.tipo === 'revisado') && hoje > 0 && ref.valor > hoje;
}
// resumoDaCarteira(linhas) → os números do alto da aba: o de hoje, quantos revisados, quem paga menos que o motor e quanto
// falta até ele (e quanto disso já vem de revisões conferidas), os reajustes aceitos e o ganho deles
export function resumoDaCarteira(linhas) {
  const ls = linhas || [];
  const comHoje = ls.filter(l => l.hoje && Number(l.hoje.valor) > 0);
  const r2 = x => Math.round(x * 100) / 100;
  let abaixo = 0, falta = 0, abaixoRevisados = 0, faltaRevisados = 0;
  ls.filter(pagaMenosQueOMotor).forEach(l => {
    const ref = referenciaDaLinha(l), d = ref.valor - Number(l.hoje.valor);
    abaixo++; falta += d;
    if (ref.tipo === 'revisado') { abaixoRevisados++; faltaRevisados += d; }
  });
  const aceitos = ls.filter(l => l.revisao && l.revisao.status === 'aceito' && Number(l.revisao.honorario_novo) > 0);
  const ganho = aceitos.reduce((s, l) => s + Number(l.revisao.honorario_novo) - (Number(l.revisao.honorario_atual) || (l.hoje ? Number(l.hoje.valor) : 0)), 0);
  return { clientes: ls.length, comHoje: comHoje.length, somaHoje: r2(comHoje.reduce((s, l) => s + Number(l.hoje.valor), 0)), revisados: ls.filter(l => l.revisao).length,
    abaixo, falta: r2(falta), abaixoRevisados, faltaRevisados: r2(faltaRevisados), aceitos: aceitos.length, ganho: r2(ganho) };
}

// ---------- o reajuste aceito entra no boleto ----------
// Os meses que o reajuste pode começar: não o que já tem boleto emitido, enviado ou pago (aquele valor já saiu)
export function mesesLivres(meses, boletos) {
  const saiu = new Set((boletos || []).filter(b => b && b.status && b.status !== 'a_emitir').map(b => String(b.competencia)));
  return (meses || []).map(m => ({ mes: m, livre: !saiu.has(m) }));
}
// reajustesDoMes(revisoes, comp) → Map cliente_id → a revisão aceita, ainda não aplicada, com a vigência até o mês gerado
// (a mais recente de cada cliente). A geração do mês (financeiro-boletos.html) põe o valor novo no lugar do copiado
export function reajustesDoMes(revisoes, comp) {
  const m = new Map();
  (revisoes || []).filter(r => r && r.status === 'aceito' && !r.aplicado_em && Number(r.honorario_novo) > 0 && r.vigencia && String(r.vigencia) <= String(comp))
    .forEach(r => { const a = m.get(r.cliente_id); if (!a || String(r.atualizado_em || '') > String(a.atualizado_em || '')) m.set(r.cliente_id, r); });
  return m;
}
// marcarAplicados(sb, revisoes, email) → { erro? }: a revisão que entrou no boleto fica marcada (quando e quem) e a base
// de cobrança do cliente ganha o valor novo (a base só vale pra quem não tem mês anterior pra copiar)
export async function marcarAplicados(sb, revisoes, email) {
  const agora = new Date().toISOString();
  for (const r of revisoes || []) {
    const { error } = await sb.from('revisoes_honorario').update({ aplicado_em: agora, aplicado_por: email || null }).eq('id', r.id).is('aplicado_em', null);
    if (error) return { erro: error.message };
    await sb.from('cobrancas_config').update({ valor_base: Number(r.honorario_novo) }).eq('cliente_id', r.cliente_id).eq('ativo', true);
  }
  return {};
}
// aplicarReajusteAgora(sb, { revisao, email }) → { trocados } | { erro }: o boleto do mês do reajuste (e dos seguintes) que
// já foi gerado e ainda está a emitir ganha o valor novo agora; com algum trocado, a revisão fica aplicada. Sem nenhum, o
// valor entra quando o mês for gerado
export async function aplicarReajusteAgora(sb, { revisao, email }) {
  const { data: bs, error } = await sb.from('cobrancas_mensais').select('id, competencia, status').eq('cliente_id', revisao.cliente_id).gte('competencia', revisao.vigencia).eq('status', 'a_emitir');
  if (error) return { erro: error.message };
  if (!bs || !bs.length) return { trocados: 0 };
  const { error: e2 } = await sb.from('cobrancas_mensais').update({ valor: Number(revisao.honorario_novo) }).in('id', bs.map(b => b.id)).eq('status', 'a_emitir');
  if (e2) return { erro: e2.message };
  const m = await marcarAplicados(sb, [revisao], email);
  if (m.erro) return { erro: m.erro };
  return { trocados: bs.length, meses: bs.map(b => b.competencia).sort() };
}
