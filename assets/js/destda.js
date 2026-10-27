// Conferência SEDIF/DeSTDA (27/10/2026, pedido da Thalia) — as regras puras da tela fiscal-destda.html.
// Antes ela abria empresa por empresa e nota por nota. Aqui, das notas de entrada do mês (importadas dos XMLs):
//  1. o diferencial de alíquota — a nota de fora do RS com ICMS destacado a 4% (a empresa é a destinatária);
//  2. o ICMS-ST na entrada — o NCM das regras (tabela destda_regras_st: a ração pet, 2309.10.00) vindo dos estados da
//     regra, com qualquer alíquota (mesmo a 12%, o ST é recolhido aqui); a nota diz se o fornecedor já reteve.
// Os dois vêm calculados, nota por nota, com a conta da Thalia conferida ao centavo nas notas dela (abaixo).

export const UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR',
  'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];
export const UF_DA_CASA = 'RS';
// a alíquota interna geral do RS (a modal). O DIFAL da nota a 4% é a diferença, 17% − 4% = 13%, sobre a base do ICMS dos
// itens a 4%, nota por nota — a conta da Thalia, conferida ao centavo com a nota dela (27/10/2026: base 18.038,16 a 4%,
// sem o IPI, → DIFAL 2.344,96). Produto com outra alíquota interna no RS não tem a conta própria aqui
export const ALIQUOTA_INTERNA_RS = 17;

const n = v => { const x = Number(v); return isFinite(x) ? x : 0; };
const centavos = v => Math.round(v * 100) / 100;
export const digitos = s => String(s == null ? '' : s).replace(/\D/g, '');

// o DIFAL de uma nota: a soma das bases do ICMS dos itens a 4% × (interna − 4) ÷ 100, arredondado no centavo (meio
// centavo pra cima), na nota inteira — a conta em centavos inteiros, sem a sobra da vírgula flutuante
export function difalDaNota(itens, interna = ALIQUOTA_INTERNA_RS) {
  const base = (itens || []).reduce((s, i) => s + Math.round(n(i && i.icms_base) * 100), 0);
  return Math.round(base * (interna - 4) / 100) / 100;
}

// o item da regra de ST com o imposto já retido pelo fornecedor na nota: nada a recolher aqui
export const stRetido = i => n(i && i.icms_st_valor) > 0;
// o item da regra sem a base do ICMS na nota (fornecedor do Simples, nota importada antes de 27/10): a conta não sabe o
// ICMS próprio dele — fica fora, pra conferir à parte
export const stSemBase = i => !stRetido(i) && (!i || i.icms_base == null || i.icms_base === '');
// o ICMS-ST da ração a recolher numa nota: a base do ICMS dos itens da regra × 17% (a alíquota do RS) − o ICMS destacado
// neles, na nota inteira, sem MVA — a conta da Thalia, conferida ao centavo com a nota dela (27/10/2026: três rações de
// SC a 12%, base 2.864,98 e ICMS 343,80 → ST 143,25). Fora da conta, o item com o ST retido e o sem a base do ICMS;
// destacado acima dos 17%, nada a recolher
export function stDaNota(itens, interna = ALIQUOTA_INTERNA_RS) {
  const conta = (itens || []).filter(i => i && !stRetido(i) && !stSemBase(i));
  const base = conta.reduce((s, i) => s + Math.round(n(i.icms_base) * 100), 0);
  const icms = conta.reduce((s, i) => s + Math.round(n(i.icms_valor) * 100), 0);
  return Math.max(0, Math.round(base * interna / 100) - icms) / 100;
}

// "sc, ba; GO rn" → { ufs: ['SC','BA','GO','RN'], invalidas: [] }; o que não é UF volta em `invalidas`
export function lerUfs(texto) {
  const ufs = [], invalidas = [];
  String(texto == null ? '' : texto).toUpperCase().split(/[^A-Z]+/).filter(Boolean).forEach(p => {
    if (UFS.includes(p)) { if (!ufs.includes(p)) ufs.push(p); }
    else if (!invalidas.includes(p)) invalidas.push(p);
  });
  return { ufs, invalidas };
}
// o NCM da regra: de 2 a 8 dígitos (prefixo: "2309" pega o capítulo, "23091000" só a ração pet)
export const ncmDaRegra = s => { const d = digitos(s); return d.length >= 2 && d.length <= 8 ? d : null; };
// 2309.10.00 → "2309.10.00" (os pontos só onde há dígito)
export function ncmFormatado(s) {
  const d = digitos(s);
  return [d.slice(0, 4), d.slice(4, 6), d.slice(6, 8)].filter(Boolean).join('.');
}

// a alíquota destacada é 4% (o XML traz "4.00" ou "4.0000")
export const ehQuatro = a => a != null && a !== '' && Math.abs(n(a) - 4) < 0.005;

// a regra de ST do item: a ativa cujo NCM é o começo do NCM do item e cujos estados têm a UF do fornecedor (a mais
// específica, se houver duas)
export function regraDoItem(item, ufOrigem, regras) {
  const ncm = digitos(item && item.ncm), uf = String(ufOrigem || '').toUpperCase();
  if (!ncm || !uf) return null;
  return (regras || [])
    .filter(r => r && r.ativo !== false && ncmDaRegra(r.ncm) && ncm.startsWith(ncmDaRegra(r.ncm)) && (r.ufs || []).includes(uf))
    .sort((a, b) => ncmDaRegra(b.ncm).length - ncmDaRegra(a.ncm).length)[0] || null;
}

// a nota entra na conferência: entrada autorizada vinda de outro estado em que a empresa é a destinatária (a nota de
// entrada que a própria empresa emite — a devolução, o retorno do depósito — não é compra de fora)
export function notaDeFora(doc, docEmpresa) {
  if (!doc || doc.tipo !== 'entrada' || doc.status !== 'autorizada') return false;
  const uf = String(doc.emit_uf || '').toUpperCase();
  if (!uf || uf === UF_DA_CASA) return false;
  if (docEmpresa && (doc.dest_doc !== docEmpresa || doc.emit_doc === docEmpresa)) return false;
  return true;
}

const ordemDasNotas = (a, b) => String(a.data_emissao || '').localeCompare(String(b.data_emissao || ''))
  || String(a.numero || '').localeCompare(String(b.numero || ''), 'pt-BR', { numeric: true });

// o item com ICMS destacado sem a alíquota: a nota foi importada antes de 27/10/2026, quando a base e a alíquota não
// eram guardadas — importar o XML de novo completa (o importador regrava os itens da nota que já estava na base)
export const semAliquota = i => n(i && i.icms_valor) > 0 && (i.icms_aliquota == null || i.icms_aliquota === '');

// a conferência de uma empresa no mês: docs [{ id, tipo, status, emit_uf, emit_doc, dest_doc, data_emissao, numero, … }],
// itensPorDoc Map(id da nota → itens), regras (destda_regras_st) e o CNPJ da empresa (só dígitos e letras) →
// { diferencial: [{ doc, itens, difal }], st: [{ doc, itens (com .regra), recolher }], semAliquota: [doc], totais }
export function conferirEmpresa(docs, itensPorDoc, regras, docEmpresa) {
  const diferencial = [], st = [], incompletas = [];
  const totais = {
    diferencial: { notas: 0, itens: 0, valor: 0, base: 0, icms: 0, difal: 0 },
    st: { notas: 0, itens: 0, valor: 0, retido: 0, semRetencao: 0, recolher: 0, semBase: 0 }
  };
  [...(docs || [])].sort(ordemDasNotas).forEach(d => {
    if (!notaDeFora(d, docEmpresa)) return;
    const itens = [...((itensPorDoc && itensPorDoc.get(d.id)) || [])].sort((a, b) => n(a.n_item) - n(b.n_item));
    if (itens.some(semAliquota)) incompletas.push(d);
    const comSt = itens.map(i => ({ ...i, regra: regraDoItem(i, d.emit_uf, regras) })).filter(i => i.regra);
    // o item da regra de ST vai só pro ST, mesmo a 4%: o ST já leva o imposto até a alíquota do RS, e o DIFAL dele seria
    // cobrado em dobro
    const a4 = itens.filter(i => ehQuatro(i.icms_aliquota) && !regraDoItem(i, d.emit_uf, regras));
    if (a4.length) {
      const difal = difalDaNota(a4);
      diferencial.push({ doc: d, itens: a4, difal });
      const t = totais.diferencial; t.notas++; t.difal += difal;
      a4.forEach(i => { t.itens++; t.valor += n(i.valor_total); t.base += n(i.icms_base); t.icms += n(i.icms_valor); });
    }
    if (comSt.length) {
      const recolher = stDaNota(comSt);
      st.push({ doc: d, itens: comSt, recolher });
      const t = totais.st; t.notas++; t.recolher += recolher;
      comSt.forEach(i => {
        t.itens++; t.valor += n(i.valor_total); t.retido += n(i.icms_st_valor);
        if (!stRetido(i)) t.semRetencao++;
        if (stSemBase(i)) t.semBase++;
      });
    }
  });
  ['valor', 'base', 'icms', 'difal'].forEach(k => { totais.diferencial[k] = centavos(totais.diferencial[k]); });
  ['valor', 'retido', 'recolher'].forEach(k => { totais.st[k] = centavos(totais.st[k]); });
  return { diferencial, st, semAliquota: incompletas, totais };
}

// o mês da DeSTDA que vence agora: a do mês anterior (a de setembro vence em 20 de outubro)
export function mesAnterior(hojeIso) {
  const [a, m] = String(hojeIso || '').split('-').map(Number);
  if (!a || !m) return null;
  return m === 1 ? (a - 1) + '-12' : a + '-' + String(m - 1).padStart(2, '0');
}
// 'AAAA-MM' → { de: 'AAAA-MM-01', ate: 'AAAA-MM-<último dia>' }
export function limitesDoMes(comp) {
  const [a, m] = String(comp || '').split('-').map(Number);
  if (!a || !m || m < 1 || m > 12) return null;
  const ultimo = new Date(a, m, 0).getDate();
  const mm = String(m).padStart(2, '0');
  return { de: a + '-' + mm + '-01', ate: a + '-' + mm + '-' + String(ultimo).padStart(2, '0') };
}
export const rotuloDoMes = comp => /^\d{4}-\d{2}$/.test(String(comp || '')) ? comp.slice(5, 7) + '/' + comp.slice(0, 4) : '';

// a situação da empresa no mês, pra ordenar e agrupar a tela: o que tem a recolher primeiro
export function situacaoDaEmpresa(conf, temNotas) {
  if (!temNotas) return 'sem_notas';
  if (conf.diferencial.length || conf.st.length || conf.semAliquota.length) return 'a_conferir';
  return 'nada';
}
