// ============================================================================
// MACEDO & REIS — A transformação do MEI em ME (24/11/2026, o caso real 2 dos produtos: o gerente de uma empresa, pela
// transformação do MEI do titular). O pedido do Samuel: "passo a passos com prazos em cada etapa e valores, algo objetivo, visual e de
// simples entendimento", com "a apresentação do que é o serviço de transformação" e, "em documento separado, o
// orçamento, prazos e forma de pagamento". Às 13h54: "sim vira produto, é la na vitrine que vou buscar esse mesmo
// material para outros clientes que demandarem e posteriormente anunciaremos esse serviço, claro que sem mostrar
// valores, por isso orçamento é separado"; e "validade do orçamento sempre até o último dia útil do mês subsequente".
//
// Aqui ficam o texto (o do Samuel, revisado de leve), os valores de sempre, a validade e a mensagem. Puro, sem DOM e
// sem banco: as imagens saem de transformacao-mei-imagem.js, e a janela, de transformacao-mei-janela.js, aberta pelo
// produto "Transformação do MEI em ME" da Vitrine de serviços (comercial-servicos.html).
// ============================================================================
import { diaUtil, somaDias, isoValida, fmtData } from './rescisao-datas.js';
import { primeiroNome, reais, artigo } from './mei-planos.js';

// ---------- a apresentação (as duas primeiras imagens: servem pra qualquer cliente e não têm valor nenhum) ----------
export const TITULO = 'Transformação do MEI em ME';
export const PRIMEIROS = [
  { icone: 'doc', titulo: 'Envio das informações', texto: 'A documentação necessária está na próxima imagem.' },
  { icone: 'reais', titulo: 'Acerto financeiro', texto: 'O investimento e o pagamento estão no orçamento, que vai à parte.' }
];
export const OBRIGATORIO = 'Daqui em diante, tudo o que fazemos é obrigatório para a empresa se tornar ME de forma regular, conforme as disposições legais vigentes.';
// as etapas, na ordem, com a média de dias úteis dos últimos processos (o orçamento mostra os prazos)
export const ETAPAS = [
  { n: 1, titulo: 'Receita Federal e Junta Comercial', dias: 15, itens: [
    'Comunicação do desenquadramento do MEI à Receita Federal',
    'Envio da viabilidade à Junta Comercial',
    'Assinatura do Contrato Social'] },
  { n: 2, titulo: 'Junta Comercial e Simples Nacional', dias: 5, itens: [
    'Conclusão na Junta Comercial, após a assinatura do Contrato Social',
    'Enquadramento da empresa no Simples Nacional'] },
  { n: 3, titulo: 'Receita Estadual (SEFAZ RS)', dias: 2, itens: [
    'Atualização ou solicitação da Inscrição Estadual'] },
  { n: 4, titulo: 'Prefeitura Municipal', dias: 2, itens: [
    'Solicitação da inscrição municipal (Alvará de Localização)'] }
];
// o fim da linha do tempo: "passa a ser ME", e não "regularizada", porque os alvarás dos Bombeiros e Sanitário não estão
// no serviço
export const PRONTO = 'Pronto: a empresa passa a ser ME.';
// a lista do Samuel (24/11/2026, 13h48)
export const DOCUMENTOS = [
  { grupo: 'Da empresa', itens: [
    { t: 'Nome empresarial (razão social): duas opções' },
    { t: 'Nome fantasia (opcional)' },
    { t: 'Endereço completo' },
    { t: 'Área total da edificação e área utilizada' },
    { t: 'Horários e dias de funcionamento' },
    { t: 'Descrição de todas as atividades da empresa' },
    { t: 'Capital social' },
    { t: 'Telefone e e-mail' }] },
  { grupo: 'De cada sócio', itens: [
    { t: 'CNH ou identidade' },
    { t: 'Estado civil e, se for casado, o regime de bens' },
    { t: 'Profissão' },
    { t: 'Endereço completo' },
    { t: 'Conta gov.br nível prata ou ouro', nota: 'O nível aparece no app gov.br, em "Nível da conta". Não pedimos a sua senha.' }] }
];
export const COMECO = 'Com tudo em mãos e o acerto feito, começamos em até 24 horas.';

// ---------- o orçamento (a terceira imagem, à parte) ----------
// os valores de sempre ficam no banco, nunca aqui: o repositório é público, e o anúncio não mostra valores ("claro que sem
// mostrar valores, por isso orçamento é separado"). Ficam na Precificação, aba Parâmetros, no grupo "Transformação do MEI
// em ME" (precificacao_parametros, grupo transformacao_mei, uma linha por chave de CHAVES); a janela lê de lá
export const GRUPO_PARAMETROS = 'transformacao_mei';
export const CHAVES = { aVista: 'Valor à vista', entrada: 'Entrada do a prazo', parcela: 'Parcela do a prazo, em 30 dias' };
export const DIAS_DA_PARCELA = 30;
export const PAGAMENTO = 'Aceitamos Pix ou dinheiro. Para o cartão de crédito, consultamos as taxas.';
export const INICIO = 'Em até 24 horas depois das informações e do acerto, fazemos o desenquadramento do MEI e enviamos a viabilidade à Junta Comercial.';
export const NOTA_PRAZOS = 'O prazo depende do retorno dos órgãos públicos. Por isso, trazemos a média dos últimos processos que fizemos: o seu pode demorar um pouco mais ou um pouco menos.';
export const NAO_INCLUSO = ['Alvará dos Bombeiros (se for necessário)', 'Alvará Sanitário (se for necessário)'];
export const NOTA_NAO_INCLUSO = 'Mesmo assim, podemos ajudar a obter esses alvarás. O sanitário, que pode ser preciso para a inscrição municipal, encaminhamos sem cobrança adicional.';

// a soma das médias de todas as etapas (24 dias úteis)
export const totalDeDias = () => ETAPAS.reduce((s, e) => s + e.dias, 0);
// "um pouco mais de um mês": os dias úteis em semanas de 5, contados como gente conta
export function emPalavras(dias) {
  const semanas = dias / 5;
  if (semanas <= 3.5) return `umas ${Math.round(semanas)} semanas`;
  if (semanas < 4.5) return 'cerca de um mês';
  if (semanas < 6.5) return 'um pouco mais de um mês';
  return `uns ${Math.round(semanas / 4.3)} meses`;
}

// o dia de hoje em Brasília ('AAAA-MM-DD')
export function hojeEmBrasilia(agora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
}
// a validade do orçamento: o último dia útil do mês seguinte (a regra do Samuel), pelos feriados de rescisao-datas.js
export function validadeDoOrcamento(dia) {
  if (!isoValida(dia)) return null;
  const [a, m] = dia.split('-').map(Number);
  // o dia 0 do mês depois do seguinte é o último dia do seguinte (m é de 1 a 12; no Date, o mês conta de 0)
  let iso = new Date(Date.UTC(a, m + 1, 0)).toISOString().slice(0, 10);
  while (!diaUtil(iso)) iso = somaDias(iso, -1);
  return iso;
}
// "24 de Novembro de 2026" (o jeito do sistema: o mês com maiúscula)
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export function porExtenso(iso) {
  if (!isoValida(iso)) return '';
  const [a, m, d] = iso.split('-').map(Number);
  return `${d} de ${MESES[m - 1]} de ${a}`;
}

// os valores digitados: "1.234,50", "1234", "R$ 987" → número (ou null)
export function lerValor(v) {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : null;
  const s = String(v == null ? '' : v).replace(/[R$\s]/g, '');
  if (!s) return null;
  const n = Number(/,\d{1,2}$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s.replace(/[.,](?=\d{3}(\D|$))/g, ''));
  return Number.isFinite(n) && n >= 0 && n <= 1e7 ? Math.round(n * 100) / 100 : null;
}
// os valores de sempre, das linhas do banco ({ grupo, chave, valor }): { aVista, entrada, parcela }, com null no que falta
// (o zero também: preço zero não é preço)
export function valoresDosParametros(linhas) {
  const v = {};
  for (const [campo, chave] of Object.entries(CHAVES)) {
    const l = (linhas || []).find(x => x && x.grupo === GRUPO_PARAMETROS && x.chave === chave);
    const n = l && l.valor != null && l.valor !== '' ? lerValor(Number(l.valor)) : null;
    v[campo] = n > 0 ? n : null;
  }
  return v;
}

// confere os valores: { aVista, entrada, parcela } → { aPrazo, desconto, problemas: [frases] }
export function conferirValores(v = {}) {
  const aVista = lerValor(v.aVista), entrada = lerValor(v.entrada), parcela = lerValor(v.parcela);
  const problemas = [];
  if (!aVista) problemas.push('Falta o valor à vista.');
  if (!entrada) problemas.push('Falta a entrada do a prazo.');
  if (!parcela) problemas.push(`Falta a parcela dos ${DIAS_DA_PARCELA} dias.`);
  const aPrazo = entrada && parcela ? Math.round((entrada + parcela) * 100) / 100 : null;
  if (aVista && aPrazo && aVista > aPrazo) problemas.push('O à vista está maior que o a prazo.');
  const desconto = aVista && aPrazo && aPrazo > aVista ? Math.round((aPrazo - aVista) * 100) / 100 : 0;
  return { aVista, entrada, parcela, aPrazo, desconto, problemas };
}

// o que a imagem do orçamento recebe: o cliente, a data e a validade por extenso e os valores conferidos
export function dadosDoOrcamento({ cliente = '', dia, valores = {} } = {}) {
  const c = conferirValores(valores);
  const validade = validadeDoOrcamento(dia);
  return {
    cliente: String(cliente || '').replace(/\s+/g, ' ').trim(),
    data: porExtenso(dia), validade: porExtenso(validade), validadeIso: validade,
    aVista: c.aVista, entrada: c.entrada, parcela: c.parcela, aPrazo: c.aPrazo, desconto: c.desconto, dias: DIAS_DA_PARCELA,
    problemas: c.problemas
  };
}

// a mensagem que vai junto das imagens (a tela deixa editar antes de copiar)
export function mensagemDaTransformacao({ nome, quem, validade } = {}) {
  const pn = primeiroNome(nome);
  const eu = String(quem || '').trim();
  const linhas = [];
  linhas.push(`Oi${pn ? ', ' + pn : ''}! Tudo bem? ${eu ? `Aqui é ${[artigo(eu), eu].filter(Boolean).join(' ')}, da Macedo & Reis Contabilidade.` : 'Aqui é da Macedo & Reis Contabilidade.'}`);
  linhas.push('');
  linhas.push('Segue como funciona, na prática, a transformação do seu MEI em ME:');
  linhas.push('');
  linhas.push('Na 1ª imagem, o passo a passo: os primeiros passos com você e as 4 etapas que fazemos nos órgãos.');
  linhas.push('Na 2ª, a documentação que vamos precisar.');
  linhas.push('E, em separado, o orçamento, com os prazos de cada etapa e as formas de pagamento' + (isoValida(validade) ? ` (vale até ${fmtData(validade)}).` : '.'));
  linhas.push('');
  linhas.push('Qualquer dúvida, me chama por aqui!');
  return linhas.join('\n');
}

// o nome dos arquivos: as duas da apresentação e o orçamento, com o primeiro nome do cliente
export function nomeDoArquivo(cliente, i) {
  if (i < 2) return `${TITULO} (${i + 1} de 2).png`;
  const pn = primeiroNome(cliente);
  return `Orçamento - ${TITULO}${pn ? ' - ' + pn : ''}.png`;
}

// o texto do resumo da janela: o a prazo somado e a validade
export function resumoDosValores(d) {
  if (!d) return '';
  const partes = [];
  if (d.aPrazo) partes.push(`A prazo: ${reais(d.aPrazo)} (entrada de ${reais(d.entrada)} + ${reais(d.parcela)} em ${d.dias} dias).`);
  if (d.desconto) partes.push(`À vista: ${reais(d.aVista)}, ${reais(d.desconto)} a menos.`);
  if (d.validadeIso) partes.push(`Vale até ${fmtData(d.validadeIso)}, o último dia útil do mês seguinte.`);
  return partes.join(' ');
}
