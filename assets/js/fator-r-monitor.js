// O Fator R que o sistema acompanha sozinho (08/11/2026, pedido do Samuel: "essa ferramenta precisa rodar e se
// atualizar sozinha" e "cabe ao sistema também, através do CNAE e das notas, identificar quais empresas são Fator R").
// Puro: quem lê o banco é a tela (fator-r.html). As fontes: o cadastro (o CNAE), a ponte do Domínio (o anexo da
// apuração do Simples, a receita de serviço, a folha em reais e o RBT12) e o PGDAS da Receita (o RBT12 declarado).
//
// Fator r = FS12 ÷ RBT12 (LC 123, art. 18, §24; Res. CGSN 140, art. 26): FS12 = a folha dos 12 meses antes do
// período de apuração — salários, 13º, pró-labore, FGTS e o INSS patronal que a empresa recolhe fora do DAS. Com
// 28% ou mais, os serviços do §5º-I tributam no Anexo III; abaixo, no V (§5º-J e §5º-M).

// As classes da CNAE das atividades do §5º-I (Anexo V, ou III pelo fator r). A lista é pelo começo do código; a
// conferência fina (a atividade de verdade de cada empresa) fica com quem cuida do PGDAS.
export const CNAES_FATOR_R = [
  { pre: '62', rot: 'tecnologia da informação' },
  { pre: '631', rot: 'tratamento de dados e portais' },
  { pre: '6391', rot: 'agência de notícias' },
  { pre: '7020', rot: 'consultoria em gestão' },
  { pre: '711', rot: 'arquitetura e engenharia' },
  { pre: '712', rot: 'testes e análises técnicas' },
  { pre: '72', rot: 'pesquisa e desenvolvimento' },
  { pre: '731', rot: 'publicidade' },
  { pre: '7320', rot: 'pesquisa de mercado' },
  { pre: '7410', rot: 'design' },
  { pre: '7490', rot: 'outras atividades técnicas' },
  { pre: '75', rot: 'veterinária' },
  { pre: '86', rot: 'saúde' },
  { pre: '461', rot: 'representação comercial' }
];

// Só os dígitos do código da CNAE do começo do texto ("7319-0/03 - Marketing direto" → "7319003").
export function digitosDoCnae(texto) {
  const m = String(texto == null ? '' : texto).match(/^\s*([\d.\-\/ ]{4,12})/);
  if (!m) return '';
  const d = m[1].replace(/\D/g, '');
  return d.length === 6 ? '0' + d : d;
}

export function cnaeDoFatorR(texto) {
  const d = digitosDoCnae(texto);
  if (d.length < 4) return null;
  const c = CNAES_FATOR_R.find(x => d.startsWith(x.pre));
  return c ? { codigo: d, rotulo: c.rot } : null;
}

const CAMPOS = ['receita_simples', 'receita_bruta', 'receita_anexo_3', 'receita_anexo_5', 'receita_servicos', 'rbt12', 'meses_rbt12',
  'salarios', 'decimo_terceiro', 'pro_labore_valor', 'fgts', 'inss_empresa', 'inss_rat', 'inss_terceiros'];
const FOLHA = ['salarios', 'decimo_terceiro', 'pro_labore_valor', 'fgts', 'inss_empresa', 'inss_rat', 'inss_terceiros'];

const n = v => (v == null || v === '' ? null : Number(v));

// As linhas do Domínio de uma empresa, uma por mês: o mesmo documento em dois códigos fica com o maior de cada número
// (como na ficha e na Carteira); o null fica null (o Domínio não disse).
export function juntarPorMes(linhas) {
  const por = new Map();
  for (const l of linhas || []) {
    if (!l || !/^\d{4}-\d{2}$/.test(l.competencia || '')) continue;
    const m = por.get(l.competencia) || { competencia: l.competencia };
    for (const c of CAMPOS) {
      const v = n(l[c]);
      if (v == null || Number.isNaN(v)) continue;
      m[c] = m[c] == null ? v : Math.max(m[c], v);
    }
    por.set(l.competencia, m);
  }
  return por;
}

// A receita do mês pela ponte: a apuração do Simples (com as filiais, como o PGDAS), senão a receita bruta.
export function receitaDoMes(m) {
  if (!m) return null;
  return m.receita_simples != null ? m.receita_simples : (m.receita_bruta != null ? m.receita_bruta : null);
}

export function folhaDoMes(m) {
  if (!m) return null;
  let tem = false, s = 0;
  for (const c of FOLHA) if (m[c] != null) { tem = true; s += m[c]; }
  return tem ? s : null;
}

export function mesAntes(comp, k = 1) {
  const a = Number(comp.slice(0, 4)), mm = Number(comp.slice(5, 7)) - 1 - k;
  const d = new Date(Date.UTC(a, mm, 1));
  return d.toISOString().slice(0, 7);
}

// O anexo que o Domínio apurou no mês: III, V, os dois ou nenhum.
export function anexoDoMes(m) {
  if (!m) return null;
  const iii = (m.receita_anexo_3 || 0) > 0, v = (m.receita_anexo_5 || 0) > 0;
  return iii && v ? 'III e V' : iii ? 'III' : v ? 'V' : null;
}

// O fator r do período de apuração comp. rbtPgdas: o RBT12 do PGDAS daquele mês (a Receita), quando o Domínio não
// tem. Com menos de 12 meses de folha lida, a média × 12 (a empresa nova, ou a ponte que começou a ler depois).
export function fatorDoPA(meses, comp, rbtPgdas = null) {
  const m = meses.get(comp);
  let soma = 0, lidos = 0, receita = 0, comReceita = 0;
  for (let k = 1; k <= 12; k++) {
    const a = meses.get(mesAntes(comp, k));
    const f = folhaDoMes(a);
    if (f != null) { soma += f; lidos++; }
    const r = receitaDoMes(a);
    if (r != null) { receita += r; comReceita++; }
  }
  // o RBT12: o que a apuração do Domínio ou o PGDAS disseram; sem eles, a soma da receita dos 12 meses pela ponte
  // (só com os 12 lidos: o PA que a apuração ainda não fez, como o mês que acabou de fechar)
  let rbt = null, fonteRbt = null;
  if (m && m.rbt12 > 0) { rbt = m.rbt12; fonteRbt = 'dominio'; }
  else if (rbtPgdas > 0) { rbt = rbtPgdas; fonteRbt = 'pgdas'; }
  else if (comReceita === 12 && receita > 0) { rbt = receita; fonteRbt = 'ponte'; }
  if (!rbt || !lidos) return { competencia: comp, fator: null, rbt12: rbt, fs12: lidos ? soma : null, lidos, fonteRbt };
  const fs12 = lidos < 12 ? soma / lidos * 12 : soma;
  const fator = fs12 / rbt;
  return { competencia: comp, fator, rbt12: rbt, fs12, lidos, fonteRbt, anexo: fator >= 0.28 ? 'III' : 'V' };
}

// Quão perto dos 28%: até 3 pontos de cada lado é "perto" (a folha de um mês muda o anexo).
export function faixaDoFator(fator) {
  if (fator == null) return 'nd';
  if (fator >= 0.31) return 'folga';
  if (fator >= 0.28) return 'fio';
  if (fator >= 0.25) return 'perto';
  return 'longe';
}

// Por que o sistema acompanha a empresa (a lista vazia = não acompanha). anexoNoAno: algum mês dos últimos 12 com
// receita no III ou no V; servicos: receita de serviço no Domínio nos 12 meses.
export function motivosDaEmpresa(cliente, meses, comps) {
  const motivos = [];
  const doze = (comps || []).slice(-12);
  let iii = 0, v = 0;
  for (const c of doze) {
    const m = meses.get(c);
    if (!m) continue;
    iii += m.receita_anexo_3 || 0; v += m.receita_anexo_5 || 0;
  }
  if (v > 0) motivos.push({ tipo: 'anexo', texto: 'receita no Anexo V no Domínio' });
  const princ = cnaeDoFatorR(cliente && cliente.cnae_principal);
  if (princ) motivos.push({ tipo: 'cnae', texto: 'CNAE principal do fator r (' + princ.rotulo + ')' });
  else {
    const sec = ((cliente && cliente.cnaes_secundarios) || []).map(cnaeDoFatorR).find(Boolean);
    // o secundário só conta com a receita no Anexo V: sozinho, quase sempre é atividade que a empresa não exerce (o
    // escritório de contabilidade com a consultoria no secundário fica no III de sempre)
    if (sec && v > 0) motivos.push({ tipo: 'cnae', texto: 'CNAE secundário do fator r (' + sec.rotulo + ')' });
  }
  // o Anexo III sozinho, sem o CNAE do fator r, é quase sempre o III de sempre (o §5º-B): fica de fora
  if (iii > 0 && motivos.length && !motivos.some(x => x.tipo === 'anexo')) motivos.push({ tipo: 'anexo', texto: 'receita no Anexo III no Domínio' });
  return motivos;
}

// A linha da tela pra uma empresa: os motivos, os últimos PAs com o fator, o anexo declarado e o aviso.
export function linhaDaEmpresa({ cliente, linhas, pgdas, hoje }) {
  const meses = juntarPorMes(linhas);
  const comps = [...meses.keys()].sort();
  const motivos = motivosDaEmpresa(cliente, meses, comps);
  if (!motivos.length) return null;
  const rbtPg = new Map((pgdas || []).filter(p => p && p.competencia).map(p => [p.competencia, n(p.receita_12_meses)]));
  // os PAs do mais novo pro mais velho, até o que vem depois do último mês fechado (a folha e a receita do mês em
  // fechamento no Domínio ainda não estão inteiras): o PA que a apuração ainda não fez sai pela soma da ponte
  const ate = proximoPA(hoje);
  const pas = [...new Set([...comps, ...rbtPg.keys(), ate])].filter(c => c <= ate).sort().reverse();
  const calc = [];
  for (const c of pas) {
    const r = fatorDoPA(meses, c, rbtPg.get(c));
    if (r.fator != null) calc.push({ ...r, declarado: anexoDoMes(meses.get(c)) });
    if (calc.length >= 3) break;
  }
  const ult = calc[0] || null;
  const avisos = [];
  if (!ult) avisos.push('Sem folha ou sem RBT12 lidos ainda: o fator não sai.');
  else {
    const comDecl = calc.find(x => x.declarado === 'III' || x.declarado === 'V');
    if (comDecl && comDecl.declarado !== comDecl.anexo)
      avisos.push('Apurado no Anexo ' + comDecl.declarado + ' em ' + rot(comDecl.competencia) + ', mas o fator dá ' + comDecl.anexo + ': conferir.');
    const ant = calc[1];
    if (ant && ant.anexo !== ult.anexo) avisos.push('Trocou do Anexo ' + ant.anexo + ' pro ' + ult.anexo + ' em ' + rot(ult.competencia) + '.');
    if (ult.lidos < 12) avisos.push('Folha de ' + ult.lidos + ' meses só: a conta usa a média × 12.');
  }
  return { cliente, motivos, pas: calc, ultimo: ult, faixa: faixaDoFator(ult && ult.fator), avisos };
}

// O último mês fechado: depois do dia 20, o mês passado; senão, o de dois meses atrás (a regra do Comparativo). O
// PA mais novo que a tela mostra é o mês seguinte a ele.
export function ultimoMesFechado(hoje) {
  const d = String(hoje || new Date().toISOString()).slice(0, 10);
  const mes = d.slice(0, 7), dia = Number(d.slice(8, 10)) || 1;
  return mesAntes(mes, dia > 20 ? 1 : 2);
}
export function proximoPA(hoje) { return mesAntes(ultimoMesFechado(hoje), -1); }

function rot(comp) { return comp.slice(5, 7) + '/' + comp.slice(0, 4); }

// A ordem da tela: com aviso primeiro, depois quem está perto dos 28%, depois o resto pelo nome.
const PESO = { fio: 1, perto: 1, longe: 2, folga: 3, nd: 4 };
export function ordenarLinhas(lista) {
  return [...lista].sort((a, b) => (b.avisos.length > 0) - (a.avisos.length > 0)
    || PESO[a.faixa] - PESO[b.faixa]
    || String(a.cliente.nome_principal || '').localeCompare(String(b.cliente.nome_principal || ''), 'pt-BR'));
}
