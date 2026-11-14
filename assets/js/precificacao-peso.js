// ============================================================
// MACEDO & REIS — O que mais pesa no honorário (a Precificação: a Simulação e a revisão da Carteira)
// 14/11/2026, pedido do Samuel: "algum tipo de destaque em questões que sejam cruciais para o valor calculado" (o
// exemplo dele: a E2, a qualidade da organização dos documentos, que "faz bastante diferença" e vai ser revista com o
// Diego e a equipe); e, no mesmo dia, "pq funcionarios e faturamento de fora?". O motor é o de sempre
// (precificacao-motor.js), refeito com as outras respostas como estão, e cada tipo de pergunta se mede de um jeito:
// - a de escolha (sim ou não, e lista): o honorário com cada opção; o peso é a distância entre a mais barata e a mais cara;
// - o faturamento (o mensal médio, A2M, ou a projeção, A2N: o que o motor estiver usando): o preço sai da faixa da tabela
//   (os parâmetros p01), então o honorário na faixa de baixo e na de cima; o peso é a distância entre elas;
// - as quantidades (sócios, filiais, bancos, funcionários, pró-labores, terceirizados, parcelamentos) e o valor da
//   terceirização: o honorário sem elas (zero; o sócio e o banco, um, porque o primeiro não soma); o peso é o que elas
//   põem no preço, e o título diz quanto soma cada um a mais.
// Ficam de fora o tipo societário e o regime (A4 e A10): são do cadastro, e trocar um deles muda o questionário inteiro.
// Puro: tests/precificacao-peso.test.mjs.
// ============================================================
import { calcularMotor, faturamentoAnual } from './precificacao-motor.js';

export const FORA_DO_PESO = ['A4', 'A10'];
export const FATURAMENTO = ['A2M', 'A2N'];
// as quantidades que o motor lê, com o valor que não soma nada no preço
export const QUANTIDADES = { A5: 1, A8: 0, B6: 1, C1: 0, C2: 0, C3: 0, C6: 0, C7: 0, D12: 0, D21: 0 };
export const EM_REAIS = ['D21'];
export const CRUCIAIS = 5;          // quantas ficam em destaque: as que mais pesam (com as empatadas com a última)
export const PESO_MINIMO = 100;     // e só as que mexem no preço a partir de R$ 100/mês...
export const PESO_FRACAO = 0.10;    // ...ou de 10% do honorário, o que for maior

const ehQuantidade = id => Object.prototype.hasOwnProperty.call(QUANTIDADES, id);

// as opções de uma pergunta de escolha (as outras não têm)
export function opcoesDaPergunta(qd) {
  if (!qd) return [];
  if (qd.tipo === 'sim_nao') return ['Sim', 'Não'];
  if (qd.tipo === 'select' && Array.isArray(qd.opcoes)) return qd.opcoes.map(String);
  return [];
}
export const temPeso = qd => !!qd && !FORA_DO_PESO.includes(qd.id)
  && (FATURAMENTO.includes(qd.id) || ehQuantidade(qd.id) || opcoesDaPergunta(qd).length >= 2);

// qual pergunta do faturamento o motor está usando: o mensal médio vale mais que a projeção; o anual (A2) é das
// precificações antigas e não aparece no questionário — com ele, nenhuma das duas
export function faturamentoQueManda(respostas) {
  const n = id => Number((respostas || {})[id]) || 0;
  if (n('A2M') > 0) return 'A2M';
  if (n('A2') > 0) return null;
  return n('A2N') > 0 ? 'A2N' : null;
}

// as faixas da tabela do faturamento (anual), da menor pra maior: { de, valor }
export function faixasDoFaturamento(P) {
  return (((P || {}).p01) || []).map(it => ({ de: Number(it.limite_inferior ?? it.chave), valor: Number(it.valor) }))
    .filter(f => Number.isFinite(f.de)).sort((a, b) => a.de - b.de);
}

function pesoDaEscolha(r, P, qd) {
  let menor = null, maior = null;
  for (const opcao of opcoesDaPergunta(qd)) {
    const valor = calcularMotor({ ...r, [qd.id]: opcao }, P).honorario;
    if (!menor || valor < menor.valor) menor = { valor, opcao };
    if (!maior || valor > maior.valor) maior = { valor, opcao };
  }
  return menor ? { id: qd.id, tipo: 'escolha', peso: maior.valor - menor.valor, menor, maior } : null;
}

function pesoDoFaturamento(r, P, id) {
  const anual = faturamentoAnual(r);
  const faixas = faixasDoFaturamento(P);
  let i = -1;
  faixas.forEach((f, k) => { if (anual >= f.de) i = k; });
  if (i < 0) return null;
  // o anual direto (o A2), sem o mensal e a projeção: a faixa sem a conta do × 12
  const naFaixa = k => calcularMotor({ ...r, A2M: '', A2N: '', A2: faixas[k].de }, P).honorario;
  const atual = calcularMotor(r, P).honorario;
  const abaixo = i > 0 ? { valor: naFaixa(i - 1), de: faixas[i - 1].de } : null;
  const acima = i < faixas.length - 1 ? { valor: naFaixa(i + 1), de: faixas[i + 1].de } : null;
  const valores = [atual, abaixo && abaixo.valor, acima && acima.valor].filter(v => v != null);
  return { id, tipo: 'faturamento', peso: Math.max(...valores) - Math.min(...valores), anual,
    faixa: { de: faixas[i].de, ate: acima ? acima.de - 1 : null }, abaixo, acima };
}

function pesoDaQuantidade(r, P, id) {
  const base = QUANTIDADES[id];
  const n = Number(r[id]) || 0;
  if (!(n > base)) return null;
  const agora = calcularMotor(r, P);
  const sem = calcularMotor({ ...r, [id]: base }, P);
  const emReais = EM_REAIS.includes(id);
  const porUnidade = emReais ? null : Math.round((calcularMotor({ ...r, [id]: n + 1 }, P).bruto - agora.bruto) * 100) / 100;
  return { id, tipo: 'quantidade', peso: agora.honorario - sem.honorario, valor: n, base, sem: sem.honorario, porUnidade, emReais };
}

// pesoDasPerguntas(respostas, P, questoes, visivel) → [{ id, tipo, peso, … }]: só as que mexem no preço (peso > 0) e
// aparecem no questionário (visivel(qd)), da que mais pesa pra que menos pesa (no empate, na ordem do questionário).
// Não muda as respostas. O que vem com cada tipo: escolha → menor e maior ({ valor, opcao }); faturamento → anual, faixa
// ({ de, ate }), abaixo e acima ({ valor, de }, ou null na primeira e na última); quantidade → valor, base, sem (o
// honorário sem ela), porUnidade e emReais.
export function pesoDasPerguntas(respostas, P, questoes, visivel = () => true) {
  const r = respostas || {};
  const fat = faturamentoQueManda(r);
  const lista = [];
  (questoes || []).forEach((qd, ordem) => {
    if (!temPeso(qd) || !visivel(qd)) return;
    const p = FATURAMENTO.includes(qd.id) ? (qd.id === fat ? pesoDoFaturamento(r, P, qd.id) : null)
      : ehQuantidade(qd.id) ? pesoDaQuantidade(r, P, qd.id)
      : pesoDaEscolha(r, P, qd);
    if (p && p.peso > 0) lista.push({ ...p, ordem });
  });
  return lista.sort((a, b) => b.peso - a.peso || a.ordem - b.ordem).map(({ ordem, ...x }) => x);
}

// as que ficam em destaque: as que mais pesam, a partir de PESO_MINIMO ou de PESO_FRACAO do honorário (o que for maior),
// até CRUCIAIS (com as empatadas com a última)
export function cruciais(pesos, honorario) {
  const limite = Math.max(PESO_MINIMO, PESO_FRACAO * (Number(honorario) || 0));
  const acima = (pesos || []).filter(p => p.peso >= limite);
  if (acima.length <= CRUCIAIS) return acima;
  const corte = acima[CRUCIAIS - 1].peso;
  return acima.filter(p => p.peso >= corte);
}

// o dinheiro do título: o inteiro sem centavos, o quebrado com os dois
export function reais(v) {
  const c = Math.round((Number(v) || 0) * 100);
  const casas = c % 100 === 0 ? 0 : 2;
  return 'R$ ' + (c / 100).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

// o título da etiqueta: de quanto a quanto, e por quê
export function tituloDoPeso(p, agora) {
  if (!p) return '';
  if (p.tipo === 'faturamento') {
    const f = p.faixa;
    const faixa = f.ate == null ? 'a partir de ' + reais(f.de) : f.de <= 0 ? 'até ' + reais(f.ate) : 'de ' + reais(f.de) + ' a ' + reais(f.ate);
    const lados = [];
    if (p.abaixo) lados.push('Na faixa de baixo, o honorário seria ' + reais(p.abaixo.valor));
    if (p.acima) lados.push((p.abaixo ? 'na de cima, ' : 'Na faixa de cima, o honorário seria ') + reais(p.acima.valor)
      + ' (faltam ' + reais(Math.round(p.acima.de - p.anual)) + ' por ano pra chegar nela)');
    return 'O faturamento de ' + reais(Math.round(p.anual)) + ' por ano está na faixa ' + faixa + '. ' + lados.join('; ') + '. Agora: ' + reais(agora) + '.';
  }
  if (p.tipo === 'quantidade') {
    if (p.emReais) return 'Com ' + reais(p.valor) + ' por mês, o honorário é ' + reais(agora) + '; sem a terceirização, seria ' + reais(p.sem) + '.';
    return 'Com ' + p.valor + ', o honorário é ' + reais(agora) + '; ' + (p.base ? 'com ' + p.base + ', seria ' : 'sem nenhum, seria ') + reais(p.sem) + '.'
      + (p.porUnidade > 0 ? ' Cada um a mais soma ' + reais(p.porUnidade) + '.' : '');
  }
  return 'Conforme a resposta, o honorário vai de ' + reais(p.menor.valor) + ' (' + p.menor.opcao + ') a ' + reais(p.maior.valor)
    + ' (' + p.maior.opcao + '). Agora: ' + reais(agora) + '.';
}
