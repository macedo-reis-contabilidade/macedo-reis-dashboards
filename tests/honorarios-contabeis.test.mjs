// Os honorários contábeis pro WhatsApp (assets/js/honorarios-contabeis.js, 24/11/2026): o produto "genérico" da Vitrine
// de serviços, pra responder "o que vocês fazem?". O que está incluso segue o contrato do kit de boas-vindas
// (clientes/editar.html, cláusulas 1 a 4, e o que o cliente manda, 6.2 e 6.3), e o que é cobrado à parte, o orçamento da
// Precificação (ORC_SERVICOS_SEPARADOS de comercial-precificacao.html): os dois são conferidos aqui, pra lista não ficar
// pra trás quando o contrato ou o orçamento mudarem. Sem valores e sem o nome do cliente nas imagens; a mensagem leva o
// link do questionário da proposta (proposta.html, o da empresa que já funciona ou o da nova).
// Rodar com: node tests/honorarios-contabeis.test.mjs
import { readFileSync } from 'node:fs';
import { TITULO, SUBTITULO, AREAS, COMO_FUNCIONA, A_PARTE, PERFIS, perfilDe, linkDaProposta, mensagemDosHonorarios, nomeDoArquivo }
  from '../assets/js/honorarios-contabeis.js';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); };
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const ler = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

console.log('O que vai nas imagens');
chk('o título e a frase', TITULO === 'Honorários contábeis' && SUBTITULO === 'O que fazemos pela sua empresa, todo mês.');
chk('as quatro áreas do contrato, na ordem', igual(AREAS.map(a => a.area), ['Contabilidade', 'Fiscal', 'Departamento pessoal', 'Regime de impostos']));
chk('cada área com pelo menos um serviço, sem repetir', AREAS.every(a => a.itens.length >= 1)
  && new Set(AREAS.flatMap(a => a.itens)).size === AREAS.flatMap(a => a.itens).length);
chk('como funciona: a proposta, o contrato e o dia a dia', igual(COMO_FUNCIONA.map(p => p.titulo), ['A proposta', 'O contrato', 'Todo mês']));
const textoDasImagens = JSON.stringify({ TITULO, SUBTITULO, AREAS, COMO_FUNCIONA, A_PARTE });
chk('nenhum valor nas imagens (servem pra qualquer cliente e pro anúncio)', !/R\$|\d+,\d{2}|\d{3,}/.test(textoDasImagens), textoDasImagens.match(/.{0,20}(R\$|\d+,\d{2}|\d{3,}).{0,20}/));
chk('nem promessa que o contrato não faz (score, garantia, grátis)', !/garant|score|gr[aá]tis|de graça/i.test(textoDasImagens));

console.log('O contrato (clientes/editar.html) segue dizendo o que está incluso');
const contrato = ler('clientes/editar.html');
for (const t of ['1. DA ÁREA CONTÁBIL', '2. DA ÁREA FISCAL', '3. DA ÁREA TRABALHISTA E PREVIDENCIÁRIA', '4. ENQUADRAMENTO TRIBUTÁRIO'])
  chk('a cláusula "' + t + '"', contrato.includes(`S('${t}')`));
const DO_CONTRATO = [
  ['Os balancetes', 'Emissão de balancetes'],
  ['O balanço anual e as demonstrações contábeis obrigatórias', 'Elaboração de Balanço anual e demais Demonstrações Contábeis obrigatórias'],
  ['A escrituração das notas de entrada, de saída e de serviço', 'Escrituração dos Registros Fiscais de Entrada, Saída, IPI e ISSQN'],
  ['A apuração dos impostos do regime da empresa, com as guias', 'Apuração de Impostos'],
  ['A orientação sobre as leis federais, estaduais e municipais', 'Orientação dos dispositivos legais vigentes, sejam federais, estaduais ou municipais'],
  ['O registro dos funcionários', 'Registro de funcionário(s)'],
  ['A folha de pagamento e o pró-labore dos sócios', 'Geração, transmissão e entrega da Folha de pagamento'],
  ['As guias do FGTS, do INSS e do IRRF', 'guia de INSS e IRRF'],
  ['As férias e as rescisões, com o seguro-desemprego', 'requerimento para Seguro Desemprego'],
  ['As declarações mensais e anuais e o informe de rendimentos', 'Comprovante de rendimento (empregados e empregadores)'],
  ['Os esclarecimentos pra escolher o melhor regime, com base no movimento da empresa', 'melhor decisão no que se refere ao seu enquadramento tributário']
];
const itens = AREAS.flatMap(a => a.itens);
const PELO_CONTRATO = [...DO_CONTRATO.map(([img]) => img), 'A contabilidade da empresa, pelas normas contábeis'];
chk('cada serviço da imagem tem o seu no contrato (e só os de lá)', itens.length === PELO_CONTRATO.length && itens.every(i => PELO_CONTRATO.includes(i))
  && DO_CONTRATO.every(([, ctr]) => contrato.includes(ctr)),
  { sobra: itens.filter(i => !PELO_CONTRATO.includes(i)), falta_no_contrato: DO_CONTRATO.filter(([, ctr]) => !contrato.includes(ctr)).map(([, c]) => c) });
chk('a contabilidade pelas normas (a ITG 1000 do contrato)', contrato.includes('normas e princípios contábeis vigentes na ITG 1000'));
chk('o que o cliente manda: os extratos até o 4º dia útil e as notas até o 5º (6.2 e 6.3)',
  /até o 4º dia útil do mês seguinte, e as notas até o 5º/.test(COMO_FUNCIONA[2].texto)
  && contrato.includes('até o 4º (quarto) dia útil do mês subsequente') && contrato.includes('no 5º (quinto) dia útil do mês seguinte'));

console.log('O orçamento da Precificação segue dizendo o que é cobrado à parte');
const prec = ler('comercial-precificacao.html');
const bloco = (prec.match(/const ORC_SERVICOS_SEPARADOS = \[([\s\S]*?)\];/) || [])[1] || '';
const orc = [...bloco.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map(m => m[1]);
const CHAVES = [/adicional anual/i, /IRPF/, /CNPJ/, /Reemiss/i, /Parcelamento/i];
chk('a mesma quantidade de itens, na mesma ordem', orc.length === A_PARTE.length && orc.length === CHAVES.length, { orc: orc.length, aqui: A_PARTE.length });
chk('cada item da imagem é o mesmo do orçamento', CHAVES.every((re, i) => re.test(orc[i] || '') && (re.test(A_PARTE[i]) || (i === 0 && /adicional por ano/.test(A_PARTE[0])))),
  CHAVES.map((re, i) => [orc[i], A_PARTE[i]]));
chk('o adicional: em novembro, pelo fechamento do balanço e as declarações (o contrato, 13.4)',
  /pago em novembro/.test(A_PARTE[0]) && /fechamento do balanço/.test(A_PARTE[0]) && contrato.includes('Na competência outubro, vencimento novembro, haverá cobrança de 1 (um) honorário adicional anual'));

console.log('O questionário da proposta');
const BASE = 'https://exemplo.github.io/sistema/comercial-servicos.html?s=honorarios-contabeis';
chk('a empresa que já funciona: proposta.html', linkDaProposta('constituida', BASE) === 'https://exemplo.github.io/sistema/proposta.html', linkDaProposta('constituida', BASE));
chk('a empresa nova: proposta.html?perfil=nova', linkDaProposta('nova', BASE) === 'https://exemplo.github.io/sistema/proposta.html?perfil=nova');
chk('o perfil que não existe vale o de quem já funciona', linkDaProposta('outra', BASE) === linkDaProposta('constituida', BASE) && perfilDe() === 'constituida' && perfilDe('nova') === 'nova');
chk('sem endereço de base, sem link', linkDaProposta('nova', 'não é endereço') === '');
chk('os rótulos dos dois', PERFIS.constituida.rotulo === 'Já funciona' && PERFIS.nova.rotulo === 'Vai abrir');
const proposta = ler('proposta.html');
chk('o proposta.html segue com os dois perfis (o ?perfil=nova)', /get\('perfil'\) === 'nova' \? 'nova' : 'constituida'/.test(proposta));
chk('os minutos são os dos convites da Precificação (uns 5 e uns 4)', PERFIS.constituida.minutos === 5 && PERFIS.nova.minutos === 4
  && /uns 5 minutos/.test(prec.match(/const CONVITE = [^\n]*/)[0]) && /uns 4 minutos/.test(prec.match(/const CONVITE_NOVA = [^\n]*/)[0]));

console.log('A mensagem');
const LINK = linkDaProposta('constituida', BASE);
const m = mensagemDosHonorarios({ nome: 'Fulano de Tal', quem: 'Samuel', perfil: 'constituida', link: LINK });
const L = m.split('\n');
chk('começa pelo primeiro nome e por quem manda', L[0] === 'Oi, Fulano! Tudo bem? Aqui é o Samuel, da Macedo & Reis Contabilidade.', L[0]);
chk('diz o que fazemos e o que vai em cada imagem', m.includes('Cuidamos da empresa todo mês: a contabilidade, os impostos e o departamento pessoal.')
  && m.includes('Na 1ª imagem, o que está incluso. Na 2ª, como funciona e o que é cobrado à parte.'));
chk('o valor é sob medida, sem número', m.includes('O valor dos honorários é sob medida') && !/R\$|\d+,\d{2}/.test(m));
chk('o link do questionário, antes da despedida', L.includes(LINK) && L.indexOf(LINK) < L.indexOf('Qualquer dúvida, me chama por aqui!')
  && L[L.indexOf(LINK) - 1] === 'Pra montarmos a sua proposta, é só responder este questionário rápido (uns 5 minutos, pelo celular):');
const n = mensagemDosHonorarios({ nome: 'Beltrana', quem: 'Thalia', perfil: 'nova', link: linkDaProposta('nova', BASE) });
chk('a empresa nova: a futura empresa, uns 4 minutos e o link dela', n.startsWith('Oi, Beltrana! Tudo bem? Aqui é a Thalia, da Macedo & Reis Contabilidade.')
  && n.includes('Pra montarmos a proposta da sua futura empresa, é só responder este questionário rápido (uns 4 minutos, pelo celular), com a previsão do começo:')
  && n.split('\n').includes('https://exemplo.github.io/sistema/proposta.html?perfil=nova'));
const sem = mensagemDosHonorarios({});
chk('sem nome, sem quem e sem link: a mensagem fica de pé, sem a linha do questionário', sem.startsWith('Oi! Tudo bem? Aqui é da Macedo & Reis Contabilidade.')
  && !sem.includes('questionário') && sem.endsWith('Qualquer dúvida, me chama por aqui!'));
chk('o link que não é http(s) não entra', !mensagemDosHonorarios({ link: 'javascript:alert(1)' }).includes('javascript')
  && !mensagemDosHonorarios({ link: 'https://a b' }).includes('questionário'));

console.log('Os arquivos e a Vitrine');
chk('o nome dos arquivos, sem o cliente', nomeDoArquivo(0) === 'Honorários contábeis (1 de 2).png' && nomeDoArquivo(1) === 'Honorários contábeis (2 de 2).png');
const vitrine = ler('comercial-servicos.html');
chk('o produto tem o material na Vitrine, com o questionário na ficha', /'honorarios-contabeis': \{ rotulo: '📲 Honorários pro WhatsApp'/.test(vitrine)
  && vitrine.includes("abrir: () => abrirHonorarios({ quem })") && vitrine.includes("linkDaProposta('constituida', location.href)"));

console.log(falhas ? `\n${falhas} falha(s).` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
