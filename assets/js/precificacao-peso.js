// ============================================================
// MACEDO & REIS — O que mais pesa no honorário (a Precificação: a Simulação e a revisão da Carteira)
// 14/11/2026, pedido do Samuel: "algum tipo de destaque em questões que sejam cruciais para o valor calculado" (o
// exemplo dele: a E2, a qualidade da organização dos documentos, que "faz bastante diferença" e vai ser revista com o
// Diego e a equipe). Pra cada pergunta de escolha que o motor lê (sim ou não, e lista), o honorário refeito com cada
// opção, mantendo as outras respostas: a distância entre a opção mais barata e a mais cara é o quanto aquela resposta
// pesa no preço desta empresa. Ficam de fora as de número (sócios, filiais, funcionários, o faturamento): são
// quantidades que o cadastro, o Domínio e a Receita dizem, não escolhas. E o tipo societário e o regime, que são do
// cadastro (mudar um deles muda o questionário inteiro). O motor é o de sempre (precificacao-motor.js).
// Puro: tests/precificacao-peso.test.mjs.
// ============================================================
import { calcularMotor } from './precificacao-motor.js';

export const FORA_DO_PESO = ['A4', 'A10'];
export const CRUCIAIS = 5;          // quantas ficam em destaque: as que mais pesam (com as empatadas com a última)
export const PESO_MINIMO = 100;     // e só as que mexem no preço a partir de R$ 100/mês...
export const PESO_FRACAO = 0.10;    // ...ou de 10% do honorário, o que for maior

// as opções de uma pergunta de escolha (as outras não têm)
export function opcoesDaPergunta(qd) {
  if (!qd) return [];
  if (qd.tipo === 'sim_nao') return ['Sim', 'Não'];
  if (qd.tipo === 'select' && Array.isArray(qd.opcoes)) return qd.opcoes.map(String);
  return [];
}
export const temPeso = qd => !!qd && !FORA_DO_PESO.includes(qd.id) && opcoesDaPergunta(qd).length >= 2;

// pesoDasPerguntas(respostas, P, questoes, visivel) → [{ id, peso, menor: { valor, opcao }, maior: { valor, opcao } }]:
// só as que mexem no preço (peso > 0) e aparecem no questionário (visivel(qd)), da que mais pesa pra que menos pesa
// (no empate, na ordem do questionário). Não muda as respostas.
export function pesoDasPerguntas(respostas, P, questoes, visivel = () => true) {
  const r = respostas || {};
  const lista = [];
  (questoes || []).forEach((qd, ordem) => {
    if (!temPeso(qd) || !visivel(qd)) return;
    let menor = null, maior = null;
    for (const opcao of opcoesDaPergunta(qd)) {
      const valor = calcularMotor({ ...r, [qd.id]: opcao }, P).honorario;
      if (!menor || valor < menor.valor) menor = { valor, opcao };
      if (!maior || valor > maior.valor) maior = { valor, opcao };
    }
    const peso = maior.valor - menor.valor;
    if (peso > 0) lista.push({ id: qd.id, peso, menor, maior, ordem });
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
