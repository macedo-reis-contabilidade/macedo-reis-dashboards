// ============================================================================
// MACEDO & REIS — Os planos do MEI pro cliente (24/11/2026, pedido do Samuel, com o primeiro caso real dos produtos: uma MEI
// de Três Coroas, do turismo, que pediu pelo WhatsApp "ter uma contabilidade me auxiliando, pois quero poder fazer tudo
// certinho"). O cliente vê todos os planos, a lista completa dos serviços e a recomendação; sem saber a demanda, a
// recomendação é o plano mais simples. "Eu quero objetividade e simplicidade na nossa entrega."
//
// Os planos e os serviços são os da aba MEI da Precificação (mei_planos, mei_servicos e mei_plano_servicos): mudou lá,
// muda aqui, sem cópia. Puro, sem DOM e sem banco: as imagens saem de mei-planos-imagem.js, e a janela (mei-planos-janela.js)
// abre em duas telas: a aba MEI de comercial-precificacao.html e o produto "Planos do MEI" da Vitrine de serviços
// (comercial-servicos.html), o botão "Planos pro WhatsApp" nas duas.
// ============================================================================

// as notas inclusas no plano que tem a emissão, quando a proposta não diz quantas (o folder dos planos, de 07/2026)
export const NFS_PADRAO = 2;
// as linhas da lista, na ordem em que o cliente lê
export const GRUPOS = [['mensal', 'Todo mês'], ['semestral', 'A cada 6 meses'], ['anual', 'Todo ano'], ['demanda', 'Quando precisar']];
// o rodapé das imagens (o registro no CRC): mora na base comum das imagens
export { ESCRITORIO } from './imagens-whats.js';
// o que todos os planos têm, dito curto, na ordem do que mais importa pro MEI (o que não está em todos fica de fora)
const COMUNS_CURTOS = [['das', 'a guia do DAS todo mês'], ['dasn', 'a declaração anual'], ['sitfiscal', 'o acompanhamento na Receita Federal']];
// o que o orçamento do MEI sempre diz que é cobrado à parte (o "Cobrado separadamente" do PDF)
export const IRPF_A_PARTE = 'Declaração do Imposto de Renda da pessoa física (anual)';

const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const texto = v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
const porOrdem = (a, b) => num(a.ordem) - num(b.ordem) || texto(a.nome).localeCompare(texto(b.nome), 'pt-BR');

// R$ 250,00 (o texto) e R$ 250 (a imagem, quando não tem centavo)
export function reais(v) {
  return 'R$ ' + num(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function reaisCurto(v) {
  const n = num(v);
  return Number.isInteger(n) ? 'R$ ' + n.toLocaleString('pt-BR') : reais(n);
}

// os planos ativos, do mais barato pro mais caro (o empate, pela ordem da aba MEI)
export function planosEmOrdem(planos) {
  return (planos || []).filter(p => p && p.id && p.ativo !== false)
    .slice().sort((a, b) => num(a.valor_mensal) - num(b.valor_mensal) || porOrdem(a, b));
}
export function planoMaisSimples(planos) {
  return planosEmOrdem(planos)[0] || null;
}

// os planos recomendados: os marcados na aba MEI (marcar o plano é recomendar) e, sem nenhum, o mais simples
export function recomendados(planos, marcados) {
  const ordem = planosEmOrdem(planos);
  const m = new Set(marcados ? [...marcados] : []);
  const r = ordem.filter(p => m.has(p.id)).map(p => p.id);
  if (r.length) return r;
  return ordem.length ? [ordem[0].id] : [];
}

// "MEI EM DIA" → "Em Dia"; "MEI GESTÃO FINANCEIRA" → "Gestão Financeira" (o título da coluna da lista)
const MINUSCULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
export function nomeCurto(nome) {
  const t = texto(nome).replace(/^MEI\s+/i, '') || texto(nome);
  return t.toLowerCase().split(' ').filter(Boolean)
    .map((w, i) => (i > 0 && MINUSCULAS.has(w)) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// quantas notas o plano inclui: o número da proposta, senão o padrão
export function qtdNotas(v) {
  const n = Math.floor(Number(String(v == null ? '' : v).replace(',', '.').trim() || NaN));
  return Number.isFinite(n) && n > 0 && n <= 999 ? n : NFS_PADRAO;
}

// o nome do serviço pro cliente: a emissão de notas com o número, e sem o "(até X/mês)" do cadastro
export function nomeDoServico(s, nfs) {
  if (s && s.id === 'nfs_plano') {
    const n = qtdNotas(nfs);
    return `Emissão de até ${n} ${n === 1 ? 'nota fiscal' : 'notas fiscais'} por mês`;
  }
  return texto(s && s.nome).replace(/\s*\(até X\/mês\)\s*$/i, '');
}

// "a, b e c"
export function juntar(lista) {
  const l = (lista || []).filter(Boolean);
  if (l.length <= 1) return l.join('');
  return l.slice(0, -1).join(', ') + ' e ' + l[l.length - 1];
}

// o que vai nas duas imagens: os planos (com o que cada um tem a mais), a lista por grupo (o ✓ de cada plano), o que todos
// têm e o que é cobrado à parte. comp: { plano_id: Set|Array de servico_id } ou um Map.
export function montarVitrine({ planos, servicos, comp, nfs } = {}) {
  const ps = planosEmOrdem(planos);
  const doPlano = pid => {
    const c = comp ? (comp instanceof Map ? comp.get(pid) : comp[pid]) : null;
    if (!c) return new Set();
    return c instanceof Set ? c : new Set([...c]);
  };
  const sets = ps.map(p => doPlano(p.id));
  const ativos = (servicos || []).filter(s => s && s.id && s.ativo !== false);
  const grupos = GRUPOS.map(([id, rotulo]) => ({
    id, rotulo,
    linhas: ativos.filter(s => s.grupo === id).sort(porOrdem)
      .map(s => ({ id: s.id, nome: nomeDoServico(s, nfs), em: sets.map(st => st.has(s.id)) }))
      .filter(l => l.em.some(Boolean))      // serviço que nenhum plano tem não entra na lista dos planos
  })).filter(g => g.linhas.length);
  const linhas = grupos.flatMap(g => g.linhas);
  const emTodos = l => l.em.length > 0 && l.em.every(Boolean);
  const comuns = new Set(linhas.filter(emTodos).map(l => l.id));
  const vPlanos = ps.map((p, i) => ({
    id: p.id,
    nome: texto(p.nome),
    curto: nomeCurto(p.nome),
    slogan: texto(p.slogan),
    valor: num(p.valor_mensal),
    servicos: linhas.filter(l => l.em[i]).length,
    // o que este plano tem e nem todos têm: o que o diferencia, na ordem da lista
    destaques: linhas.filter(l => l.em[i] && !emTodos(l)).map(l => l.nome).slice(0, 3)
  }));
  const aParte = ativos.filter(s => s.grupo === 'separado').sort(porOrdem).map(s => ({
    id: s.id,
    nome: nomeDoServico(s, nfs),
    valor: s.valor_avulso == null || s.valor_avulso === '' ? null : num(s.valor_avulso),
    porUnidade: s.tipo === 'quantidade'
  }));
  aParte.push({ id: 'irpf', nome: IRPF_A_PARTE, valor: null, porUnidade: false });
  return {
    planos: vPlanos,
    grupos,
    comuns: juntar(COMUNS_CURTOS.filter(([id]) => comuns.has(id)).map(([, t]) => t)),
    aParte
  };
}

// o preço de um serviço cobrado à parte ("R$ 4,00 por nota"), ou vazio quando não tem preço fixo
export function precoAParte(item) {
  if (!item || item.valor == null) return '';
  const unidade = item.porUnidade ? (/nota/i.test(item.nome) ? ' por nota' : ' cada') : '';
  return reais(item.valor) + unidade;
}

// o primeiro nome do cliente, pra falar com ele ("63.829.984 FULANA DE TAL" → "Fulana")
export function primeiroNome(nome) {
  const p = texto(nome).replace(/[\d./-]+/g, ' ').split(' ').find(w => /^[A-Za-zÀ-ÖØ-öø-ÿ]{2,}/.test(w));
  if (!p) return '';
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
}

// "duas imagens", "quatro imagens": quantas foram (a lista grande vai em mais de uma imagem, pra caber na tela do celular)
const POR_EXTENSO = ['', 'uma', 'duas', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez'];
export function quantasImagens(n) {
  const k = Math.max(1, Math.floor(Number(n) || 0));
  return (POR_EXTENSO[k] || String(k)) + (k === 1 ? ' imagem' : ' imagens');
}
// o que cada imagem tem, na ordem em que chegam: a primeira com os planos, as outras com a lista
function frasesDasImagens(n) {
  const k = Math.max(2, Math.floor(Number(n) || 2));
  if (k === 2) return `Te mandei duas imagens: na primeira, os planos; na segunda, tudo o que cada um inclui.`;
  return `Te mandei ${quantasImagens(k)}: na primeira, os planos; nas outras, tudo o que cada um inclui.`;
}

// a mensagem que vai junto das imagens, no WhatsApp (a tela deixa editar antes de copiar). imagens: quantas vão (2 ou mais)
export function mensagemWhats({ nome, quem, vitrine, recomendados: rec, imagens = 2 } = {}) {
  const v = vitrine || { planos: [] };
  const pn = primeiroNome(nome);
  const ids = new Set(rec || []);
  const escolhidos = v.planos.filter(p => ids.has(p.id));
  const simples = v.planos[0];
  const n = v.planos.length;
  const linhas = [];
  const eu = texto(quem);
  linhas.push(`Oi${pn ? ', ' + pn : ''}! Tudo bem? ${eu ? `Aqui é ${[artigo(eu), eu].filter(Boolean).join(' ')}, da Macedo & Reis Contabilidade.` : 'Aqui é da Macedo & Reis Contabilidade.'}`);
  linhas.push('');
  linhas.push(`Pra deixar o seu MEI em dia, a gente tem ${n === 1 ? 'um plano mensal' : n + ' planos mensais'}. ${frasesDasImagens(imagens)}`);
  if (escolhidos.length === 1) {
    const p = escolhidos[0];
    const porque = simples && p.id === simples.id && n > 1 ? ' É o mais simples' + (p.slogan ? ': ' + minuscula(p.slogan) : '') + '.' : (p.slogan ? ' ' + ponto(p.slogan) : '');
    linhas.push('');
    linhas.push(`Pra começar, eu recomendo o ${p.nome}, de ${reais(p.valor)} por mês.${porque}`);
  } else if (escolhidos.length > 1) {
    const total = escolhidos.reduce((s, p) => s + p.valor, 0);
    linhas.push('');
    linhas.push(`Pra você, eu recomendo ${juntar(escolhidos.map(p => `o ${p.nome} (${reais(p.valor)})`))}: ${reais(total)} por mês, juntos.`);
  }
  if (v.comuns) {
    linhas.push('');
    linhas.push(`Todos já incluem ${v.comuns}.`);
  }
  linhas.push('');
  linhas.push('Se quiser, eu te explico cada um ou já te mando a proposta do plano que você escolher.');
  return linhas.join('\n');
}
// o Samuel, a Thalia: o artigo pelo nome (o da equipe; nome que não está na lista vai sem artigo). As mensagens dos
// produtos do societário (societario-produtos.js) usam também.
const FEMININOS = new Set(['Thalia', 'Vitória', 'Adaini', 'Edna']);
const MASCULINOS = new Set(['Samuel', 'Diego']);
export function artigo(nome) {
  return FEMININOS.has(nome) ? 'a' : MASCULINOS.has(nome) ? 'o' : '';
}
const minuscula = t => t ? t.charAt(0).toLowerCase() + t.slice(1).replace(/\.$/, '') : '';
const ponto = t => /[.!?]$/.test(t) ? t : t + '.';
