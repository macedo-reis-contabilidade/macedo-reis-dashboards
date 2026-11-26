// ============================================================================
// MACEDO & REIS — Os produtos do societário pro WhatsApp (24/11/2026). São dois, com o mesmo material:
// - a transformação do MEI em ME (o caso real 2 dos produtos: o gerente de uma empresa, pela transformação do MEI do
//   titular). O pedido do Samuel: "passo a passos com prazos em cada etapa e valores, algo objetivo, visual e de simples
//   entendimento", com "a apresentação do que é o serviço de transformação" e, "em documento separado, o orçamento,
//   prazos e forma de pagamento". Às 13h54: "sim vira produto, é la na vitrine que vou buscar esse mesmo material para
//   outros clientes que demandarem e posteriormente anunciaremos esse serviço, claro que sem mostrar valores, por isso
//   orçamento é separado"; e "validade do orçamento sempre até o último dia útil do mês subsequente";
// - a abertura de empresa, a constituição de CNPJ (o caso real 3, no mesmo dia, 14h52: "a gente já precisa criar nos
//   mesmos moldes da transformação, o produto constituição de CNPJ ... documentação, informações e valores são os
//   mesmos da transformação, com poucas exceções no texto como não mencionar sobre desenquadramento").
//
// - a alteração de empresa (26/11/2026, o caso real 4: uma empresa do cliente com o nome fantasia, a natureza jurídica, o
//   endereço na mesma cidade, o e-mail e o telefone; o Samuel: "muito semelhante a constituição e transformação ... acredito que nesse
//   produto seja interessante eu poder marcar em algum local o que vou pedir ou não, pois um o outro documento pode ser
//   que tenhamos e outros não"). Na janela, marca-se o que muda e o que pedir (ALTERACOES e ITENS, de empresa-pedido.js);
//   as etapas, a documentação, o começo dos prazos, o que muda no orçamento e o link do formulário saem da seleção
//   (produtoDaSelecao, linkDoFormulario). O preço depende do que muda: sem valor de sempre, digita-se o do orçamento.
//
// Aqui ficam o texto de cada produto (PRODUTOS), os valores de sempre (lidos do banco), a validade e a mensagem. Puro,
// sem DOM e sem banco: as imagens saem de societario-produtos-imagem.js, e a janela, de societario-produtos-janela.js,
// aberta pelos produtos da Vitrine de serviços (comercial-servicos.html).
// Produto novo da família = uma entrada em PRODUTOS, o grupo dele na aba Parâmetros da Precificação (com o nome em
// TITULOS, pelas 3 primeiras letras, que não podem bater com as de outro grupo) e a linha no MATERIAL da Vitrine.
// ============================================================================
import { diaUtil, somaDias, isoValida, fmtData } from './rescisao-datas.js';
import { primeiroNome, reais, artigo } from './mei-planos.js';
import { ALTERACOES, ITENS, CIVIL, selecao, paramsDaSelecao, oQueMuda } from './empresa-pedido.js';

// ---------- o que os produtos têm em comum ----------
// a apresentação (as duas primeiras imagens: servem pra qualquer cliente e não têm valor nenhum)
export const SUBTITULO = 'Como funciona, na prática, do primeiro passo até a inscrição na prefeitura.';
export const PRIMEIROS = [
  { icone: 'doc', titulo: 'Envio das informações', texto: 'A documentação necessária está na próxima imagem.' },
  { icone: 'reais', titulo: 'Acerto financeiro', texto: 'O investimento e o pagamento estão no orçamento, que vai à parte.' }
];
// a lista do Samuel (24/11/2026, 13h48); o estado civil com a certidão de casamento desde 26/11/2026 (o CIVIL do formulário)
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
    { t: CIVIL },
    { t: 'Profissão' },
    { t: 'Endereço completo' },
    { t: 'Conta gov.br nível prata ou ouro', nota: 'O nível aparece no app gov.br, em "Nível da conta". Não pedimos a sua senha.' }] }
];
export const COMECO = 'Com tudo em mãos e o acerto feito, começamos em até 24 horas.';
// o orçamento (a terceira imagem, à parte)
export const DIAS_DA_PARCELA = 30;
export const PAGAMENTO = 'Aceitamos Pix ou dinheiro. Para o cartão de crédito, consultamos as taxas.';
export const NOTA_PRAZOS = 'O prazo depende do retorno dos órgãos públicos. Por isso, trazemos a média dos últimos processos que fizemos: o seu pode demorar um pouco mais ou um pouco menos.';
export const NAO_INCLUSO = ['Alvará dos Bombeiros (se for necessário)', 'Alvará Sanitário (se for necessário)'];
export const NOTA_NAO_INCLUSO = 'Mesmo assim, podemos ajudar a obter esses alvarás. O sanitário, que pode ser preciso para a inscrição municipal, encaminhamos sem cobrança adicional.';
// os valores de sempre ficam no banco, nunca aqui: o repositório é público, e o anúncio não mostra valores ("claro que sem
// mostrar valores, por isso orçamento é separado"). Ficam na Precificação, aba Parâmetros, cada produto no grupo dele
// (precificacao_parametros, o grupo do produto, uma linha por chave de CHAVES); a janela lê de lá
export const CHAVES = { aVista: 'Valor à vista', entrada: 'Entrada do a prazo', parcela: 'Parcela do a prazo, em 30 dias' };
const COMUM = { subtitulo: SUBTITULO, primeiros: PRIMEIROS, documentos: DOCUMENTOS, comeco: COMECO };

// ---------- cada produto ----------
// etapas: na ordem, com a média de dias úteis dos últimos processos (o orçamento mostra os prazos); pronto: o fim da
// linha do tempo, que não diz "regularizada", porque os alvarás dos Bombeiros e Sanitário não estão no serviço
export const PRODUTOS = {
  transformacao: {
    ...COMUM, id: 'transformacao', slug: 'transformacao-mei', grupo: 'transformacao_mei',
    titulo: 'Transformação do MEI em ME',
    cliente: 'Cliente (o titular do MEI)',
    obrigatorio: 'Daqui em diante, tudo o que fazemos é obrigatório para a empresa se tornar ME de forma regular, conforme as disposições legais vigentes.',
    etapas: [
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
    ],
    pronto: 'Pronto: a empresa passa a ser ME.',
    inicio: 'Em até 24 horas depois das informações e do acerto, fazemos o desenquadramento do MEI e enviamos a viabilidade à Junta Comercial.',
    naMensagem: 'a transformação do seu MEI em ME'
  },
  // a mesma documentação, os mesmos prazos e os mesmos valores (com o grupo dele nos Parâmetros, pra poder mudar à parte);
  // sem o desenquadramento, com o cadastro da empresa na Receita (o DBE), o registro que dá o CNPJ e a opção pelo Simples
  // quando é o regime escolhido (a empresa nova escolhe; o MEI que vira ME já estava no Simples)
  constituicao: {
    ...COMUM, id: 'constituicao', slug: 'constituicao-cnpj', grupo: 'constituicao_cnpj',
    titulo: 'Abertura de empresa',
    cliente: 'Cliente',
    obrigatorio: 'Daqui em diante, tudo o que fazemos é obrigatório para a empresa ser aberta de forma regular, conforme as disposições legais vigentes.',
    etapas: [
      { n: 1, titulo: 'Receita Federal e Junta Comercial', dias: 15, itens: [
        'Envio da viabilidade à Junta Comercial',
        'Cadastro da empresa na Receita Federal (o DBE)',
        'Assinatura do Contrato Social'] },
      { n: 2, titulo: 'Junta Comercial e Simples Nacional', dias: 5, itens: [
        'Registro na Junta Comercial e emissão do CNPJ, após a assinatura do Contrato Social',
        'Opção pelo Simples Nacional, quando for o regime escolhido'] },
      { n: 3, titulo: 'Receita Estadual (SEFAZ RS)', dias: 2, itens: [
        'Solicitação da Inscrição Estadual (comércio e indústria)'] },
      { n: 4, titulo: 'Prefeitura Municipal', dias: 2, itens: [
        'Solicitação da inscrição municipal (Alvará de Localização)'] }
    ],
    pronto: 'Pronto: a empresa está aberta.',
    inicio: 'Em até 24 horas depois das informações e do acerto, enviamos a viabilidade à Junta Comercial.',
    naMensagem: 'a abertura da empresa'
  },
  // a alteração: as etapas da abertura (a Junta e a Receita, a Junta, a SEFAZ e a prefeitura, com os mesmos prazos), com
  // cada linha conforme o que muda (se: só quando muda um destes; naoSe: só quando não muda; geral: o texto da apresentação
  // sem nada marcado, a que vai pro anúncio — null, a linha fica fora dela). No RS, a alteração passa toda pelo Portal de
  // Serviços da JucisRS (a REDESIM): até o e-mail e o telefone, que chegam sozinhos à Receita Estadual
  alteracao: {
    ...COMUM, id: 'alteracao', slug: 'alteracao-empresa', grupo: 'alteracao_empresa',
    titulo: 'Alteração de empresa',
    subtitulo: 'Como funciona, na prática, do primeiro passo até a atualização na prefeitura.',
    cliente: 'Cliente',
    obrigatorio: 'Daqui em diante, tudo o que fazemos é obrigatório para a alteração valer de forma regular, conforme as disposições legais vigentes.',
    selecionavel: true,
    documentos: documentosDaSelecao(null),
    etapas: [
      { n: 1, titulo: 'Junta Comercial e Receita Federal', dias: 15, itens: [
        { t: 'Envio da viabilidade à Junta Comercial', se: ['nome', 'natureza', 'endereco', 'cidade', 'atividades'],
          geral: 'Envio da viabilidade à Junta Comercial, quando muda o nome, a natureza jurídica, o endereço ou as atividades' },
        'Cadastro da alteração na Receita Federal (o DBE)',
        { t: 'Assinatura do Contrato Social pelo gov.br', se: ['natureza'], geral: 'Assinatura da alteração pelo gov.br (o Contrato Social, quando muda a natureza jurídica)' },
        { t: 'Assinatura da alteração pelo gov.br', naoSe: ['natureza'], geral: null }] },
      { n: 2, titulo: 'Junta Comercial', dias: 5, itens: [
        'Registro da alteração na Junta Comercial, após a assinatura, com o CNPJ atualizado'] },
      { n: 3, titulo: 'Receita Estadual (SEFAZ RS)', dias: 2, itens: [
        'Atualização da Inscrição Estadual (comércio e indústria)'] },
      { n: 4, titulo: 'Prefeitura Municipal', dias: 2, itens: [
        { t: 'Atualização da inscrição municipal', naoSe: ['endereco', 'cidade'], geral: 'Atualização da inscrição municipal (e do Alvará de Localização, quando muda o endereço)' },
        { t: 'Atualização da inscrição municipal e do Alvará de Localização no endereço novo', se: ['endereco'], geral: null },
        { t: 'Inscrição na prefeitura da cidade nova (Alvará de Localização) e baixa na prefeitura de antes', se: ['cidade'], geral: null }] }
    ],
    pronto: 'Pronto: a empresa está com os dados novos.',
    inicio: {
      viabilidade: 'Em até 24 horas depois das informações e do acerto, enviamos a viabilidade à Junta Comercial.',
      dbe: 'Em até 24 horas depois das informações e do acerto, fazemos o cadastro da alteração na Receita Federal (o DBE).',
      geral: 'Em até 24 horas depois das informações e do acerto, começamos a alteração pela Junta Comercial.' },
    naMensagem: 'a alteração da sua empresa',
    minutos: 5,
    semValores: 'O preço da alteração depende do que muda: digite os valores deste orçamento.'
  }
};
// o produto pelo id ('transformacao', 'constituicao', 'alteracao'); o que não existe, null
export const produtoDe = id => (Object.prototype.hasOwnProperty.call(PRODUTOS, id) ? PRODUTOS[id] : null);

// ---------- a alteração: o produto da seleção ----------
// a documentação da seleção: o que pedir, da empresa e de cada sócio; sem nada marcado (a apresentação do anúncio), tudo o
// que a alteração pode pedir, conforme o que muda
export function documentosDaSelecao(sel) {
  const marcou = !!(sel && sel.alteracoes && sel.alteracoes.length);
  const ids = marcou ? (sel.pedir || []) : Object.keys(ITENS);
  const de = quem => ids.filter(i => ITENS[i] && ITENS[i].de === quem).map(i => (ITENS[i].nota ? { t: ITENS[i].t, nota: ITENS[i].nota } : { t: ITENS[i].t }));
  const empresa = de('empresa'), socio = de('socio');
  if (!marcou) return [{ grupo: 'Da empresa, conforme o que muda', itens: empresa }, { grupo: 'De cada sócio, quando muda a natureza jurídica ou o quadro de sócios', itens: socio }];
  const g = [];
  if (empresa.length) g.push({ grupo: 'Da empresa', itens: empresa });
  if (socio.length) g.push({ grupo: 'De cada sócio', itens: socio });
  if (!g.length) g.push({ grupo: 'Da empresa', itens: [{ t: 'Só confirmar os dados no formulário: o resto o escritório já tem' }] });
  return g;
}
// a linha da etapa na seleção (ids: o que muda; vazio = a apresentação sem nada marcado): o texto, ou null (fica fora)
function linhaDaEtapa(it, ids) {
  if (typeof it === 'string') return it;
  if (!ids.length) return it.geral === null ? null : (it.geral || it.t);
  if (it.se && !it.se.some(x => ids.includes(x))) return null;
  if (it.naoSe && it.naoSe.some(x => ids.includes(x))) return null;
  return it.t;
}
// o produto como a imagem e a mensagem o usam: na alteração, as etapas, a documentação, o começo dos prazos e o que muda
// (escopo) saem da seleção ({ alteracoes, pedir }); os outros produtos voltam como são
export function produtoDaSelecao(p, sel) {
  if (!p || !p.selecionavel) return p;
  const s = selecao(sel && sel.alteracoes, sel && sel.pedir != null ? sel.pedir : null);
  const ids = s.alteracoes;
  const etapas = p.etapas.map(e => ({ ...e, itens: e.itens.map(it => linhaDaEtapa(it, ids)).filter(Boolean) }))
    .filter(e => e.itens.length).map((e, i) => ({ ...e, n: i + 1 }));
  const viab = (p.etapas[0].itens[0].se || []).some(x => ids.includes(x));
  return {
    ...p, selecao: s, etapas, documentos: documentosDaSelecao(s),
    docSubtitulo: ids.length ? 'Só o que precisamos para o que muda. Vai tudo pelo formulário do link.' : 'Conforme o que muda, pedimos só o que for preciso.',
    inicio: !ids.length ? p.inicio.geral : viab ? p.inicio.viabilidade : p.inicio.dbe,
    escopo: ids.length ? oQueMuda(ids) : ''
  };
}
export { ALTERACOES, ITENS };

// a soma das médias de todas as etapas (24 dias úteis)
export const totalDeDias = p => p.etapas.reduce((s, e) => s + e.dias, 0);
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
// os valores de sempre do produto, das linhas do banco ({ grupo, chave, valor }): { aVista, entrada, parcela }, com null
// no que falta (o zero também: preço zero não é preço)
export function valoresDosParametros(linhas, p) {
  const v = {};
  for (const [campo, chave] of Object.entries(CHAVES)) {
    const l = (linhas || []).find(x => x && p && x.grupo === p.grupo && x.chave === chave);
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
// o link do formulário do produto (empresa.html?t=<id do produto>, 24/11/2026): o cliente preenche os dados da empresa e
// de cada sócio e anexa os documentos; o pedido vira tarefa na agenda (a Edge Function empresa-link). base: o endereço da
// tela que monta o link (location.href)
// Na alteração, o link leva a seleção (sel: { alteracoes, pedir }): "&m=…" (o que muda) e, quando não se pede tudo,
// "&n=…" (o que o escritório já tem) — o formulário pergunta só o resto; sem a seleção, o cliente marca o que muda
export function linkDoFormulario(p, base, sel = null) {
  if (!p || !p.id) return '';
  const extra = p.selecionavel && sel ? paramsDaSelecao(sel) : '';
  try { return new URL('empresa.html?t=' + encodeURIComponent(p.id) + (extra ? '&' + extra : ''), base).href; } catch (e) { return ''; }
}

export function mensagemDoProduto(p, { nome, quem, validade, formulario } = {}) {
  const pn = primeiroNome(nome);
  const eu = String(quem || '').trim();
  const linhas = [];
  linhas.push(`Oi${pn ? ', ' + pn : ''}! Tudo bem? ${eu ? `Aqui é ${[artigo(eu), eu].filter(Boolean).join(' ')}, da Macedo & Reis Contabilidade.` : 'Aqui é da Macedo & Reis Contabilidade.'}`);
  linhas.push('');
  linhas.push(`Segue como funciona, na prática, ${p.naMensagem}:`);
  // na alteração, o que muda (o escopo da seleção)
  if (p.escopo) linhas.push(`O que muda: ${p.escopo}.`);
  linhas.push('');
  linhas.push(`Na 1ª imagem, o passo a passo: os primeiros passos com você e as ${p.etapas.length} etapas que fazemos nos órgãos.`);
  linhas.push('Na 2ª, a documentação que vamos precisar.');
  linhas.push('E, em separado, o orçamento, com os prazos de cada etapa e as formas de pagamento' + (isoValida(validade) ? ` (vale até ${fmtData(validade)}).` : '.'));
  // o formulário: as informações e os documentos vão por ele, não pela conversa (só o endereço http(s) entra)
  if (/^https?:\/\/\S+$/.test(String(formulario || ''))) {
    linhas.push('');
    linhas.push(`Quando quiser seguir, é só preencher este formulário com as informações e os documentos (leva uns ${p.minutos || 10} minutos):`);
    linhas.push(formulario);
  }
  linhas.push('');
  linhas.push('Qualquer dúvida, me chama por aqui!');
  return linhas.join('\n');
}

// o nome dos arquivos: as duas da apresentação e o orçamento, com o primeiro nome do cliente
export function nomeDoArquivo(p, cliente, i) {
  if (i < 2) return `${p.titulo} (${i + 1} de 2).png`;
  const pn = primeiroNome(cliente);
  return `Orçamento - ${p.titulo}${pn ? ' - ' + pn : ''}.png`;
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
