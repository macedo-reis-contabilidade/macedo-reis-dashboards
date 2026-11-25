// ============================================================================
// MACEDO & REIS — Os honorários contábeis pro WhatsApp (24/11/2026). O pedido do Samuel: "eu queria criar o produto
// 'genérico' HONORÁRIOS CONTÁBEIS e listar nossos serviços de forma objetiva, afim de responder questionamentos do tipo
// 'o que voces fazem?'" (o caso: um cliente perguntou se o escritório faz o acompanhamento da empresa e como seria).
//
// De onde vem cada coisa (não inventar serviço: mudou lá, mude aqui):
// - o que está incluso: o contrato de prestação de serviços, o do kit de boas-vindas (clientes/editar.html, cláusulas 1
//   a 3: a área contábil, a fiscal e a trabalhista e previdenciária, as que a mensalidade cobre, cláusula 9.1). O
//   enquadramento tributário (cláusula 4) não aparece, nem no incluso nem no cobrado à parte (a revisão do Samuel,
//   24/11/2026: "dependendo da complexidade de um comparativo tributário, temos que cobrar por fora" e "o regime nem
//   deveria aparecer");
// - todo mês: o que o escritório faz no mês (a mesma revisão). O que o cliente manda e quando (as cláusulas 6.2 e 6.3)
//   não entra: as notas chegam pelo sistema de importação do Domínio e os extratos, cada vez mais, por acesso direto;
// - o que é cobrado à parte: o orçamento da Precificação (ORC_SERVICOS_SEPARADOS, em comercial-precificacao.html). O
//   adicional anual cita a cláusula 13.4 do contrato e a Resolução CFC 1.590/2020, que manda o contrato trazer o
//   honorário de cada serviço (art. 2º, e). Resolução que crie o adicional não existe: o CFC não fixa valores e diz que
//   é praxe a cláusula do adicional, de uma mensalidade, pelos serviços do fim do exercício (a resposta "Cobrança de 13º
//   Salário por parte do Contabilista", nas perguntas frequentes do CFC, lida em 24/11/2026). O teste confere que a lista
//   daqui segue a de lá;
// - o horário de atendimento: o que o Samuel definiu em 24/11/2026, o mesmo do contrato (cláusula 7.8) e do robô do
//   WhatsApp (TURNOS de atendimento-robo.js): o teste confere os três.
// Sem valores: o honorário de cada empresa sai da proposta, feita sob medida pela Precificação. A mensagem leva o link
// do questionário da proposta (proposta.html), que vira proposta na Precificação e tarefa na agenda.
// Puro, sem DOM e sem banco: as imagens saem de honorarios-contabeis-imagem.js, e a janela, de
// honorarios-contabeis-janela.js, aberta pelo produto da Vitrine de serviços (comercial-servicos.html).
// ============================================================================
import { primeiroNome, artigo } from './mei-planos.js';

export const TITULO = 'Honorários contábeis';
export const SUBTITULO = 'O que fazemos pela sua empresa, todo mês.';

// o que está incluso (o contrato, cláusulas 1 a 3)
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
    'As declarações mensais e anuais e o informe de rendimentos'] }
];

// o horário de atendimento (o que o Samuel definiu em 24/11/2026), embaixo do que está incluso
export const ATENDIMENTO = 'De segunda a sexta, das 7h30 às 12h e das 13h30 às 17h30.';

// como funciona: a proposta (a Precificação), o contrato (e a troca de escritório, a Transição) e o que fazemos todo mês
export const COMO_FUNCIONA = [
  { titulo: 'A proposta', texto: 'Você responde um questionário rápido, e montamos os honorários sob medida: pelo regime, pelo faturamento, pelas notas e pelos funcionários da empresa, entre outras informações.' },
  { titulo: 'O contrato', texto: 'Com a proposta aceita, assinamos o contrato. Se a empresa vem de outro escritório, pedimos a ele os documentos e cuidamos da troca.' },
  { titulo: 'Todo mês', texto: 'Apuramos os impostos, fechamos a folha, entregamos as declarações e mandamos as guias dos impostos e das contribuições pra pagar. As notas fiscais chegam pelo nosso sistema de importação e, sempre que possível, acessamos os extratos direto, sem você precisar mandar.' }
];

// o que é cobrado à parte, na ordem do orçamento da Precificação (ORC_SERVICOS_SEPARADOS)
export const A_PARTE = [
  'O honorário adicional anual, previsto na cláusula 13.4 do contrato, como manda a Resolução CFC 1.590/2020: um honorário mensal a mais, na competência de outubro (vence em novembro), que cobre o fechamento do balanço, as declarações anuais, as duas parcelas do 13º salário dos funcionários e a apuração do estoque, entre outros serviços do fim do ano',
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
  linhas.push('O valor dos honorários é sob medida: depende do regime, do faturamento, das notas e dos funcionários da empresa, entre outras informações.');
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
