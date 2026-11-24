// ============================================================================
// MACEDO & REIS — Os honorários contábeis pro WhatsApp (24/11/2026). O pedido do Samuel: "eu queria criar o produto
// 'genérico' HONORÁRIOS CONTÁBEIS e listar nossos serviços de forma objetiva, afim de responder questionamentos do tipo
// 'o que voces fazem?'" (o caso: um cliente perguntou se o escritório faz o acompanhamento da empresa e como seria).
//
// De onde vem cada coisa (não inventar serviço: mudou lá, mude aqui):
// - o que está incluso: o contrato de prestação de serviços, o do kit de boas-vindas (clientes/editar.html, cláusulas 1
//   a 4: a área contábil, a fiscal, a trabalhista e previdenciária e o enquadramento tributário);
// - o que o cliente manda e quando: as cláusulas 6.2 e 6.3 do mesmo contrato;
// - o que é cobrado à parte: o orçamento da Precificação (ORC_SERVICOS_SEPARADOS, em comercial-precificacao.html). O
//   teste confere que a lista daqui segue a de lá.
// Sem valores: o honorário de cada empresa sai da proposta, feita sob medida pela Precificação. A mensagem leva o link
// do questionário da proposta (proposta.html), que vira proposta na Precificação e tarefa na agenda.
// Puro, sem DOM e sem banco: as imagens saem de honorarios-contabeis-imagem.js, e a janela, de
// honorarios-contabeis-janela.js, aberta pelo produto da Vitrine de serviços (comercial-servicos.html).
// ============================================================================
import { primeiroNome, artigo } from './mei-planos.js';

export const TITULO = 'Honorários contábeis';
export const SUBTITULO = 'O que fazemos pela sua empresa, todo mês.';

// o que está incluso (o contrato, cláusulas 1 a 4)
export const AREAS = [
  { area: 'Contabilidade', itens: [
    'A contabilidade da empresa, pelas normas contábeis',
    'Os balancetes',
    'O balanço anual e as demonstrações contábeis obrigatórias'] },
  { area: 'Fiscal', itens: [
    'A escrituração das notas de entrada, de saída e de serviço',
    'A apuração dos impostos do regime da empresa, com as guias',
    'A orientação sobre as leis federais, estaduais e municipais'] },
  { area: 'Departamento pessoal', itens: [
    'O registro dos funcionários',
    'A folha de pagamento e o pró-labore dos sócios',
    'As guias do FGTS, do INSS e do IRRF',
    'As férias e as rescisões, com o seguro-desemprego',
    'As declarações mensais e anuais e o informe de rendimentos'] },
  { area: 'Regime de impostos', itens: [
    'Os esclarecimentos pra escolher o melhor regime, com base no movimento da empresa'] }
];

// como funciona: a proposta (a Precificação), o contrato (e a troca de escritório, a Transição) e o dia a dia (o contrato,
// cláusulas 6.2 e 6.3)
export const COMO_FUNCIONA = [
  { titulo: 'A proposta', texto: 'Você responde um questionário rápido, e montamos os honorários sob medida: pelo regime, pelo faturamento, pelas notas e pelos funcionários da empresa.' },
  { titulo: 'O contrato', texto: 'Com a proposta aceita, assinamos o contrato. Se a empresa vem de outro escritório, pedimos a ele os documentos e cuidamos da troca.' },
  { titulo: 'Todo mês', texto: 'Você manda os extratos e os comprovantes até o 4º dia útil do mês seguinte, e as notas até o 5º. Nós fazemos o resto e mandamos as guias pra pagar.' }
];

// o que é cobrado à parte, na ordem do orçamento da Precificação (ORC_SERVICOS_SEPARADOS)
export const A_PARTE = [
  'Um honorário adicional por ano, pago em novembro: o fechamento do balanço e as declarações do fim do ano',
  'A declaração do imposto de renda (IRPF)',
  'As alterações no CNPJ',
  'A reemissão de guias de impostos',
  'O parcelamento de impostos em atraso'
];

// os dois questionários da proposta (o mesmo proposta.html, com as perguntas de cada perfil; os convites da Precificação
// dizem uns 5 e uns 4 minutos)
export const PERFIS = {
  constituida: { rotulo: 'Já funciona', caminho: 'proposta.html', minutos: 5 },
  nova: { rotulo: 'Vai abrir', caminho: 'proposta.html?perfil=nova', minutos: 4 }
};
export const perfilDe = id => (id === 'nova' ? 'nova' : 'constituida');

// o link do questionário da proposta. base: o endereço da tela que monta o link (location.href)
export function linkDaProposta(perfil, base) {
  try { return new URL(PERFIS[perfilDe(perfil)].caminho, base).href; } catch (e) { return ''; }
}

// a mensagem que vai junto das imagens (a janela deixa editar antes de copiar). link: o do questionário (só o endereço
// http(s) entra)
export function mensagemDosHonorarios({ nome, quem, perfil, link } = {}) {
  const pn = primeiroNome(nome);
  const eu = String(quem || '').trim();
  const nova = perfilDe(perfil) === 'nova';
  const linhas = [];
  linhas.push(`Oi${pn ? ', ' + pn : ''}! Tudo bem? ${eu ? `Aqui é ${[artigo(eu), eu].filter(Boolean).join(' ')}, da Macedo & Reis Contabilidade.` : 'Aqui é da Macedo & Reis Contabilidade.'}`);
  linhas.push('');
  linhas.push('Cuidamos da empresa todo mês: a contabilidade, os impostos e o departamento pessoal.');
  linhas.push('Na 1ª imagem, o que está incluso. Na 2ª, como funciona e o que é cobrado à parte.');
  linhas.push('');
  linhas.push('O valor dos honorários é sob medida: depende do regime, do faturamento, das notas e dos funcionários da empresa.');
  if (/^https?:\/\/\S+$/.test(String(link || ''))) {
    const min = PERFIS[perfilDe(perfil)].minutos;
    linhas.push(nova
      ? `Pra montarmos a proposta da sua futura empresa, é só responder este questionário rápido (uns ${min} minutos, pelo celular), com a previsão do começo:`
      : `Pra montarmos a sua proposta, é só responder este questionário rápido (uns ${min} minutos, pelo celular):`);
    linhas.push(String(link));
  }
  linhas.push('');
  linhas.push('Qualquer dúvida, me chama por aqui!');
  return linhas.join('\n');
}

// o nome dos arquivos: as duas imagens não têm o nome do cliente (servem pra qualquer um)
export const nomeDoArquivo = i => `${TITULO} (${i + 1} de 2).png`;
