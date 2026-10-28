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
// a soma de um campo dos itens em centavos inteiros: o total da nota bate com a soma das linhas da tela
const soma = (itens, campo) => (itens || []).reduce((s, i) => s + Math.round(n(i && i[campo]) * 100), 0) / 100;
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

// os nomes (28/10/2026, pedido da Thalia e do Samuel: "deduz por nome", como ela faz) — o fornecedor manda a ração de cão
// e gato com o NCM 2309.90.10 (o da ração completa, o mesmo da ração de cavalo e de bezerro) em vez do 2309.10.00. O item
// de outro NCM da mesma posição da regra (os 4 primeiros dígitos), vindo dos estados dela, entra no ST quando o nome tem
// uma palavra de `nomes_entram` (cão, gato, a marca) e fica fora com uma de `nomes_fora` (cavalo, bezerro…); com as
// duas, entra (o "sabor peixe" da ração de gato); sem nenhuma, fica a conferir — fora das contas até a palavra entrar
// numa das listas
export const semAcento = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '');
// o nome em palavras: maiúsculas, sem acento e sem pontuação ("G. N. ADULTO" → G, N, ADULTO)
export const palavrasDoNome = s => semAcento(s).toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
// a palavra (ou o trecho, "GRAN NATURE") está no nome: cada pedaço, em sequência, no começo de uma palavra do nome — o
// plural entra ("GATO" pega "GATOS") —; o pedaço de até 3 letras, só a palavra inteira ("CAT" não pega "CATARINENSE")
export function nomeTem(nome, termo) {
  const p = Array.isArray(nome) ? nome : palavrasDoNome(nome), t = palavrasDoNome(termo);
  if (!t.length) return false;
  const bate = (a, b) => b.length <= 3 ? a === b : a.startsWith(b);
  for (let k = 0; k + t.length <= p.length; k++) if (t.every((b, j) => bate(p[k + j], b))) return true;
  return false;
}
// a lista digitada na regra ("cão, gato; GRAN NATURE" ou uma por linha) → em maiúsculas, como os nomes das notas, sem
// repetir (sem olhar maiúscula e acento), até 300 nomes de até 60 letras
export function lerNomes(texto) {
  const vistos = new Set(), out = [];
  String(texto == null ? '' : texto).split(/[,;\n]+/).map(s => s.trim().replace(/\s+/g, ' ')).forEach(s => {
    const chave = palavrasDoNome(s).join(' ');
    if (!chave || s.length > 60 || vistos.has(chave) || out.length >= 300) return;
    vistos.add(chave); out.push(s.toLocaleUpperCase('pt-BR'));
  });
  return out;
}

// como o item entra no ICMS-ST (28/10/2026): { regra, como } — 'ncm' (o NCM da regra), 'nome' (outro NCM da mesma posição
// e uma palavra de nomes_entram, em `palavra`), 'fora' (a mesma posição e uma de nomes_fora, em `palavra`: segue como
// qualquer item — a 4%, vai pro DIFAL) ou 'conferir' (a mesma posição, sem palavra de nenhuma lista); null = sem regra
export function classificarItem(item, ufOrigem, regras) {
  const direta = regraDoItem(item, ufOrigem, regras);
  if (direta) return { regra: direta, como: 'ncm' };
  const ncm = digitos(item && item.ncm), uf = String(ufOrigem || '').toUpperCase();
  if (ncm.length < 4 || !uf) return null;
  const regra = (regras || []).filter(r => {
    const rn = r && r.ativo !== false && ncmDaRegra(r.ncm);
    return rn && rn.length > 4 && ncm.slice(0, 4) === rn.slice(0, 4) && (r.ufs || []).includes(uf);
  }).sort((a, b) => ncmDaRegra(b.ncm).length - ncmDaRegra(a.ncm).length)[0];
  if (!regra) return null;
  const nome = palavrasDoNome(item.descricao);
  const entra = (regra.nomes_entram || []).find(t => nomeTem(nome, t));
  if (entra) return { regra, como: 'nome', palavra: entra };
  const fora = (regra.nomes_fora || []).find(t => nomeTem(nome, t));
  if (fora) return { regra, como: 'fora', palavra: fora };
  return { regra, como: 'conferir' };
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
// { diferencial: [{ doc, itens, difal, valor, base, icms }], st: [{ doc, itens (com .regra, .como e .palavra), recolher,
// valor, base, icms, retido }], conferir: [{ doc, itens }], fora: [{ doc, itens }], semAliquota: [doc], totais } — cada
// nota com os totais dela (o totalizador por nota da tela, 27/10/2026, pedido da Thalia: comparar nota a nota com a
// conferência dela sem somar produto por produto); no ST, a base e o ICMS são os dos itens que entram na conta (sem o ST
// retido e com a base do ICMS). Os itens da mesma posição do NCM da regra (28/10/2026, classificarItem): pelo nome, no
// ST; os de nome de fora, em `fora` (e a 4%, no DIFAL); os sem palavra, em `conferir`, fora das duas contas
export function conferirEmpresa(docs, itensPorDoc, regras, docEmpresa) {
  const diferencial = [], st = [], conferir = [], fora = [], incompletas = [];
  const totais = {
    diferencial: { notas: 0, itens: 0, valor: 0, base: 0, icms: 0, difal: 0 },
    st: { notas: 0, itens: 0, valor: 0, base: 0, icms: 0, retido: 0, semRetencao: 0, recolher: 0, semBase: 0, conferir: 0, fora: 0 }
  };
  [...(docs || [])].sort(ordemDasNotas).forEach(d => {
    if (!notaDeFora(d, docEmpresa)) return;
    const itens = [...((itensPorDoc && itensPorDoc.get(d.id)) || [])].sort((a, b) => n(a.n_item) - n(b.n_item));
    if (itens.some(semAliquota)) incompletas.push(d);
    const cls = itens.map(i => ({ i, c: classificarItem(i, d.emit_uf, regras) }));
    const comSt = cls.filter(x => x.c && (x.c.como === 'ncm' || x.c.como === 'nome'))
      .map(x => ({ ...x.i, regra: x.c.regra, como: x.c.como, palavra: x.c.palavra || null }));
    const duvida = cls.filter(x => x.c && x.c.como === 'conferir').map(x => ({ ...x.i, regra: x.c.regra }));
    const peloNome = cls.filter(x => x.c && x.c.como === 'fora').map(x => ({ ...x.i, regra: x.c.regra, palavra: x.c.palavra }));
    // o item da regra de ST vai só pro ST, mesmo a 4%: o ST já leva o imposto até a alíquota do RS, e o DIFAL dele seria
    // cobrado em dobro; o a conferir fica fora das duas contas; o que o nome tirou da regra segue como qualquer item
    const a4 = cls.filter(x => ehQuatro(x.i.icms_aliquota) && (!x.c || x.c.como === 'fora')).map(x => x.i);
    if (a4.length) {
      const nota = { doc: d, itens: a4, difal: difalDaNota(a4), valor: soma(a4, 'valor_total'), base: soma(a4, 'icms_base'), icms: soma(a4, 'icms_valor') };
      diferencial.push(nota);
      const t = totais.diferencial; t.notas++; t.itens += a4.length;
      ['valor', 'base', 'icms', 'difal'].forEach(k => { t[k] += nota[k]; });
    }
    if (comSt.length) {
      const naConta = comSt.filter(i => !stRetido(i) && !stSemBase(i));
      const nota = { doc: d, itens: comSt, recolher: stDaNota(comSt), valor: soma(comSt, 'valor_total'), base: soma(naConta, 'icms_base'),
        icms: soma(naConta, 'icms_valor'), retido: soma(comSt, 'icms_st_valor') };
      st.push(nota);
      const t = totais.st; t.notas++; t.itens += comSt.length;
      ['valor', 'base', 'icms', 'retido', 'recolher'].forEach(k => { t[k] += nota[k]; });
      comSt.forEach(i => { if (!stRetido(i)) t.semRetencao++; if (stSemBase(i)) t.semBase++; });
    }
    if (duvida.length) { conferir.push({ doc: d, itens: duvida }); totais.st.conferir += duvida.length; }
    if (peloNome.length) { fora.push({ doc: d, itens: peloNome }); totais.st.fora += peloNome.length; }
  });
  ['valor', 'base', 'icms', 'difal'].forEach(k => { totais.diferencial[k] = centavos(totais.diferencial[k]); });
  ['valor', 'base', 'icms', 'retido', 'recolher'].forEach(k => { totais.st[k] = centavos(totais.st[k]); });
  return { diferencial, st, conferir, fora, semAliquota: incompletas, totais };
}

// as notas de uma empresa (o diferencial ou o ST de conferirEmpresa) agrupadas por data ou por fornecedor (o "Agrupar"
// da tela, 27/10/2026, pedido do Samuel: recolher por data e por fornecedor) → [{ chave, doc (o da primeira nota, pro
// rótulo), notas, total: { notas, itens, e os valores que as notas têm — valor, base, icms, difal, retido, recolher —
// somados em centavos inteiros } }]; por data na ordem das datas, por fornecedor (o CNPJ, ou o nome sem ele) na do nome;
// dentro do grupo, as notas na ordem em que vieram
const VALORES_DA_NOTA = ['valor', 'base', 'icms', 'difal', 'retido', 'recolher'];
export function agruparNotas(notas, por) {
  const grupos = new Map();
  (notas || []).forEach(x => {
    const d = (x && x.doc) || {};
    const chave = por === 'data' ? String(d.data_emissao || '').slice(0, 10)
      : (String(d.emit_doc || '').toUpperCase().replace(/[^0-9A-Z]/g, '') || String(d.emit_nome || '').trim().toUpperCase());
    if (!grupos.has(chave)) grupos.set(chave, { chave, doc: d, notas: [] });
    grupos.get(chave).notas.push(x);
  });
  const lista = [...grupos.values()].map(gr => {
    const total = { notas: gr.notas.length, itens: gr.notas.reduce((s, x) => s + ((x && x.itens) || []).length, 0) };
    VALORES_DA_NOTA.forEach(k => {
      if (gr.notas.some(x => x && x[k] != null)) total[k] = gr.notas.reduce((s, x) => s + Math.round(n(x && x[k]) * 100), 0) / 100;
    });
    return { ...gr, total };
  });
  return por === 'data'
    ? lista.sort((a, b) => a.chave.localeCompare(b.chave))
    : lista.sort((a, b) => String(a.doc.emit_nome || '').localeCompare(String(b.doc.emit_nome || ''), 'pt-BR') || a.chave.localeCompare(b.chave));
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
  if (conf.diferencial.length || conf.st.length || (conf.conferir || []).length || conf.semAliquota.length) return 'a_conferir';
  return 'nada';
}
