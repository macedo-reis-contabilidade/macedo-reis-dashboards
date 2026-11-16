// ============================================================
// MACEDO & REIS — Serviços digitais (Comercial › Serviços digitais, 15/11/2026, pedido do Samuel: "temos uma
// infinitude de serviços digitais simples pra vender pelo escritório, penso em ir estruturando dentro do setor
// comercial, um novo módulo só pra estruturar esses serviços").
//
// As regras puras da vitrine e das vendas (sem banco e sem tela: tests/servicos-digitais.test.mjs roda no node):
//   · A RÉGUA: o que cada serviço precisa ter pra ir pro ar, em cinco grupos (Pode? · Está certo? · A página ·
//     A venda · O ok), cada item com a ajuda e a base (a lei, a norma do CFC ou o combinado do escritório). É a
//     leitura das normas pelo escritório, não um parecer jurídico. Serviço grátis não tem os itens da venda paga
//     (preço, termos, Pix, NFS-e), e nele o "pode cobrar" só informa por que é de graça.
//   · as vendas: o que falta em cada uma (o pagamento, a entrega, a NFS-e), o prazo de arrependimento (CDC, art. 49:
//     7 dias da contratação ou do recebimento), os números por mês e o teste de parar.
//   · a tarefa das NFS-e da Thalia: uma linha ☐ por venda paga (o formato de assets/js/checklist.js).
// Dinheiro "1.234,56"; datas dd/mm/aaaa; os dias, em Brasília. Quem grava é a tela (comercial-servicos.html).
// ============================================================
import { diaUtil, somaDias, isoValida, diasEntre } from './rescisao-datas.js';
import { normalizarDocumento, cnpjValido, formatDocumento, ESTADOS_BR } from './utils.js';

// ---------- as listas ----------
export const SITUACOES = [
  { id: 'ideia', nome: 'Ideia', titulo: 'Ideias' },
  { id: 'estudo', nome: 'Em estudo', titulo: 'Em estudo' },
  { id: 'preparo', nome: 'Em preparo', titulo: 'Em preparo' },
  { id: 'no_ar', nome: 'No ar', titulo: 'No ar' },
  { id: 'pausado', nome: 'Pausado', titulo: 'Pausados' },
  { id: 'encerrado', nome: 'Encerrado', titulo: 'Encerrados' },
  { id: 'descartado', nome: 'Descartado', titulo: 'Descartados' }
];
export const nomeDaSituacao = id => (SITUACOES.find(s => s.id === id) || {}).nome || '';
/** As situações que pedem o porquê (e ficam recolhidas no fim da vitrine). */
export const PEDE_MOTIVO = ['pausado', 'encerrado', 'descartado'];
export const MODELOS = { pago: 'Pago', gratis: 'Grátis' };
export const PAGAMENTOS = { aguardando: 'Aguardando o pagamento', pago: 'Paga', devolvido: 'Devolvida', cancelado: 'Cancelada' };
/** O estado de cada item da régua (sem nada gravado = pendente). */
export const ESTADOS = { pendente: 'Pendente', ok: 'Feito', nao: 'Não', na: 'Não se aplica' };
export const DIAS_ARREPENDIMENTO = 7;
export const LIMITES = { nome: 120, slug: 60, resumo: 800, publico: 400, preco_obs: 200, motivo: 600, parar_criterio: 300, link: 500,
  quem_assina: 160, responsavel: 60, origem: 300, observacao: 4000, nota: 400,
  comprador_nome: 160, email: 200, cidade: 80, pix_id: 80, devolucao_motivo: 400, entrega_obs: 400, nfse_numero: 40, obs_venda: 2000 };
const PRECO_MAXIMO = 99999999.99;

export const GRUPOS = [
  { id: 'pode', nome: 'Pode?' },
  { id: 'certo', nome: 'Está certo?' },
  { id: 'pagina', nome: 'A página' },
  { id: 'venda', nome: 'A venda' },
  { id: 'ok', nome: 'O ok' }
];

// soPago: só no serviço pago · aceitaNa: pode ficar "não se aplica" (com o porquê)
export const REGUA = [
  { chave: 'pode_vender', grupo: 'pode', rotulo: 'O escritório pode vender este serviço',
    ajuda: 'O serviço cabe no que um escritório de contabilidade pode fazer e anunciar, e quem vende é o escritório registrado no CRCRS, nunca uma empresa sem registro.',
    base: 'Res. CFC 1.640/2021, arts. 3º e 5º · DL 9.295/1946, arts. 15 e 20' },
  { chave: 'pode_cobrar', grupo: 'pode', rotulo: 'Pode cobrar por ele',
    ajuda: 'Nenhuma lei manda fazer de graça. O exemplo do que não se cobra: o escritório do Simples faz de graça a inscrição, a opção e a primeira declaração anual do MEI.',
    base: 'LC 123/2006, art. 18, §§ 22-B e 22-C' },
  { chave: 'carteira', grupo: 'pode', rotulo: 'Não concorre com a carteira nem com a equipe',
    ajuda: 'Não disputa mercado com um cliente da carteira nem com quem trabalha dentro do escritório.',
    base: 'Combinado do escritório (12/11/2026)' },

  { chave: 'regra_conferida', grupo: 'certo', rotulo: 'A regra conferida no texto oficial', aceitaNa: true,
    ajuda: 'Cada regra que o serviço aplica tem a lei, o artigo e o dia em que foi conferida no texto oficial. O que a regra não decide sai como "confira", nunca chutado.',
    base: 'NBC PG 01, item 5 (o trabalho feito sem observar as normas) · o método do escritório' },
  { chave: 'testado', grupo: 'certo', rotulo: 'Testado com casos de verdade', aceitaNa: true,
    ajuda: 'Antes de ir pro ar, o resultado bate com casos já conferidos à mão. Erro achado depois: a regra é corrigida, quem comprou recebe o certo de graça e o caso entra no teste.',
    base: 'NBC PG 01, item 5 · o método do escritório' },

  { chave: 'identificacao', grupo: 'pagina', rotulo: 'Quem vende, com o registro, e o tom informativo',
    ajuda: 'Na página, no anúncio e na entrega: a razão social, o CNPJ, o registro do escritório no CRCRS e o contador responsável, com a categoria e o registro. O texto é técnico e informativo: sem "promoção", sem "garantido", sem comparar com outro contador e sem citar cliente sem autorização por escrito.',
    base: 'NBC PG 01, item 4, r, e itens 11 a 15 · DL 9.295/1946, art. 20' },
  { chave: 'preco_escrito', grupo: 'pagina', rotulo: 'O preço por escrito, com o que inclui e o que não inclui', soPago: true,
    ajuda: 'O valor, como se cobra (por loja, por mês, uma vez) e a lista do que vem e do que não vem, junto do preço e antes de pagar.',
    base: 'NBC PG 01, itens 7 e 8' },
  { chave: 'termos', grupo: 'pagina', rotulo: 'Os termos aceitos antes de pagar e o arrependimento em 7 dias', soPago: true,
    ajuda: 'Os termos do serviço, com as cláusulas do contrato de prestação de serviços contábeis, a caixa "li e aceito" antes do Pix, a cópia por e-mail e o registro do aceite (o dia, a hora, a versão, o documento e o e-mail). Quem comprou desiste em até 7 dias, com o dinheiro de volta.',
    base: 'Res. CFC 1.590/2020 · CDC, art. 49 · Decreto 7.962/2013' },
  { chave: 'dados', grupo: 'pagina', rotulo: 'O sigilo e os dados de quem usa', aceitaNa: true,
    ajuda: 'O que a pessoa envia serve só pro serviço, pro contrato, pra nota e pro atendimento, com o aviso de privacidade na página. O que a página promete (por exemplo, "nada sai do seu computador") tem de ser verdade.',
    base: 'NBC PG 01, item 4, c · LGPD (Lei 13.709/2018)' },

  { chave: 'pix', grupo: 'venda', rotulo: 'O pagamento confirmado antes da entrega', soPago: true,
    ajuda: 'O Pix cai na conta do escritório e a confirmação é de verdade (conferida no banco), não simulada. Sem pagamento confirmado, sem entrega.',
    base: 'O caixa do escritório' },
  { chave: 'nfse', grupo: 'venda', rotulo: 'A NFS-e de cada venda', soPago: true,
    ajuda: 'Toda venda paga tem a nota de serviço do escritório. A tela põe cada venda paga na tarefa das NFS-e da Thalia.',
    base: 'A nota de serviço do escritório, como em todo serviço prestado' },
  { chave: 'entrega', grupo: 'venda', rotulo: 'A entrega pronta e registrada',
    ajuda: 'O que a pessoa recebe (o arquivo, o relatório, o atendimento), como chega e em quanto tempo. No serviço pago, cada entrega fica registrada na venda, com o dia.',
    base: 'CDC, art. 49 (os 7 dias também contam do recebimento)' },

  { chave: 'responsavel_tecnico', grupo: 'ok', rotulo: 'O ok do contador responsável',
    ajuda: 'O contador que assina o serviço (o responsável técnico do escritório) conhece o que vai ao ar e está de acordo: a responsabilidade pelo trabalho é dele.',
    base: 'DL 9.295/1946, art. 15 · NBC PG 01, item 5' },
  { chave: 'ok_samuel', grupo: 'ok', rotulo: 'O ok do Samuel pra ir pro ar',
    ajuda: 'A decisão de pôr no ar é do Samuel, com o preço, a janela e a data de reavaliar.',
    base: 'Combinado do escritório: nada novo vai ao ar sem o "vai"' }
];
const POR_CHAVE = new Map(REGUA.map(i => [i.chave, i]));

// ---------- miudezas ----------
const ehObjeto = v => !!v && typeof v === 'object' && !Array.isArray(v);
const umaLinha = v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
const texto = v => String(v == null ? '' : v).trim();
const vazioNulo = v => { const t = texto(v); return t || null; };
const centavos = v => Math.round(Number(v || 0) * 100);
const plural = (n, um, varios) => n + ' ' + (n === 1 ? um : varios);
const NOMES_MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** O dia em Brasília ('AAAA-MM-DD') de um instante (ISO com hora, Date) ou de um dia já pronto; inválido, null. */
export function diaEmBrasilia(quando) {
  if (quando == null || quando === '') return null;
  if (typeof quando === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(quando)) return isoValida(quando) ? quando : null;
  const t = quando instanceof Date ? quando.getTime() : Date.parse(quando);
  // Brasília é UTC−3 o ano todo (sem horário de verão desde 2019)
  return Number.isFinite(t) ? new Date(t - 3 * 3600e3).toISOString().slice(0, 10) : null;
}
export const fmtData = quando => { const d = diaEmBrasilia(quando); return d ? d.split('-').reverse().join('/') : ''; };
export const mesDe = quando => { const d = diaEmBrasilia(quando); return d ? d.slice(0, 7) : null; };
export const rotuloDoMes = m => (/^\d{4}-(0[1-9]|1[0-2])$/.test(String(m || '')) ? NOMES_MES[Number(m.slice(5, 7)) - 1] + '/' + m.slice(2, 4) : '');
const somaMes = (m, n) => { const a = Number(m.slice(0, 4)), i = Number(m.slice(5, 7)) - 1 + n; return (a + Math.floor(i / 12)) + '-' + String((((i % 12) + 12) % 12) + 1).padStart(2, '0'); };
/** O instante que a tela grava pra um dia escolhido: hoje, agora; outro dia, o meio-dia de Brasília. */
export const instanteDoDia = (dia, hoje, agora = new Date()) => (dia === hoje ? agora.toISOString() : dia + 'T12:00:00-03:00');

export const fmtDinheiro = v => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** "97", "97,5", "1.234,56", "R$ 1.234" → número com 2 casas; ilegível ou negativo, null. */
export function lerDinheiro(v) {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : null;
  let s = String(v == null ? '' : v).replace(/[R$\s]/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  return /^\d+(\.\d{1,2})?$/.test(s) ? Math.round(Number(s) * 100) / 100 : null;
}
/** O preço do cartão: "R$ 97,00", "Grátis" ou "a definir". */
export function textoDoPreco(servico) {
  const s = servico || {};
  if (s.modelo === 'gratis') return 'Grátis';
  return temPreco(s) ? 'R$ ' + fmtDinheiro(s.preco) : 'Preço a definir';
}
const temPreco = s => s.preco != null && s.preco !== '' && Number(s.preco) > 0;

/** "Cadastro de produtos 2027 (RS)" → "cadastro-de-produtos-2027-rs" (sem acento, até 60). */
export function slugDe(nome) {
  return String(nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, LIMITES.slug).replace(/-+$/, '');
}
export const slugValido = s => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(String(s || '')) && String(s).length <= LIMITES.slug;

/** O endereço que pode virar link: http(s) de verdade ou uma tela do próprio sistema (ex.: "mei.html"); o resto, ''. */
export function linkSeguro(url) {
  const u = texto(url);
  if (!u || u.length > LIMITES.link || /[\s<>"'`\\\u0000-\u001f\u007f]/.test(u)) return '';
  if (/^https?:\/\//i.test(u)) {
    try {
      const p = new URL(u);
      return (p.protocol === 'http:' || p.protocol === 'https:') && p.hostname && !p.username && !p.password ? u : '';
    } catch { return ''; }
  }
  return /^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.html(?:\?[A-Za-z0-9_\-.~%=&+,:@/]*)?(?:#[A-Za-z0-9_\-.~%=&+,:@/]*)?$/.test(u) ? u : '';
}
export const linkDeFora = url => /^https?:\/\//i.test(texto(url));

// ---------- a régua ----------
/** Os itens da régua que valem pro serviço, com o estado de cada um. No grátis, sem os da venda paga, e o
 *  "pode cobrar" só informa (não conta nem trava). */
export function itensDaRegua(servico) {
  const s = servico || {}, gratis = s.modelo === 'gratis';
  const regua = ehObjeto(s.regua) ? s.regua : {};
  return REGUA.filter(i => !(gratis && i.soPago)).map(i => {
    const g = ehObjeto(regua[i.chave]) ? regua[i.chave] : {};
    let estado = Object.prototype.hasOwnProperty.call(ESTADOS, g.estado) ? g.estado : 'pendente';
    if (estado === 'na' && !i.aceitaNa) estado = 'pendente';
    return { ...i, estado, nota: texto(g.nota).slice(0, LIMITES.nota), em: g.em || null, por: g.por || null,
      informativo: gratis && i.chave === 'pode_cobrar', resolvido: estado === 'ok' || estado === 'na' };
  });
}

/** O que falta pro serviço ir pro ar: os itens da régua em aberto (o "não" trava; no pago, o "não pode cobrar"
 *  também) e os campos que a vitrine precisa → [{ chave, rotulo, tipo: 'regua' | 'campo', estado? }]. */
export function faltaPraIrProAr(servico) {
  const s = servico || {};
  const falta = itensDaRegua(s).filter(i => !i.informativo && !i.resolvido).map(i => ({ chave: i.chave, rotulo: i.rotulo, tipo: 'regua', estado: i.estado }));
  if (s.modelo !== 'gratis' && !temPreco(s)) falta.push({ chave: 'preco', rotulo: 'O preço', tipo: 'campo' });
  if (!texto(s.quem_assina)) falta.push({ chave: 'quem_assina', rotulo: 'Quem assina', tipo: 'campo' });
  if (!linkSeguro(s.link_pagina)) falta.push({ chave: 'link_pagina', rotulo: 'O endereço da página', tipo: 'campo' });
  return falta;
}
export const podeIrProAr = servico => faltaPraIrProAr(servico).length === 0;

/** Quanto da régua está feito → { feitos, total, proximo: { chave, rotulo, estado, grupo } | null, fechada }. */
export function progressoDaRegua(servico) {
  const itens = itensDaRegua(servico).filter(i => !i.informativo);
  const feitos = itens.filter(i => i.resolvido).length;
  const p = itens.find(i => !i.resolvido) || null;
  return { feitos, total: itens.length, fechada: feitos === itens.length, proximo: p ? { chave: p.chave, rotulo: p.rotulo, estado: p.estado, grupo: p.grupo } : null };
}

/** A régua que a tela grava: só o que mudou ganha o quem e o quando de agora; o pendente sem nota sai. */
export function reguaParaGravar(antes, form, quem, agora) {
  const velho = ehObjeto(antes) ? antes : {}, novo = ehObjeto(form) ? form : {}, fim = {};
  for (const i of REGUA) {
    const a = ehObjeto(velho[i.chave]) ? velho[i.chave] : null, f = ehObjeto(novo[i.chave]) ? novo[i.chave] : null;
    if (!f) { if (a) fim[i.chave] = a; continue; }
    let estado = Object.prototype.hasOwnProperty.call(ESTADOS, f.estado) ? f.estado : 'pendente';
    if (estado === 'na' && !i.aceitaNa) estado = 'pendente';
    const nota = texto(f.nota).slice(0, LIMITES.nota);
    if (a && (a.estado || 'pendente') === estado && texto(a.nota) === nota) { fim[i.chave] = a; continue; }
    if (estado === 'pendente' && !nota) continue;
    fim[i.chave] = { estado, nota, em: agora, por: quem || null };
  }
  return fim;
}

/** O próximo passo do serviço, numa frase → { texto, alerta }. */
export function proximoPasso(servico, { hoje = null, vendas = [] } = {}) {
  const s = servico || {}, p = progressoDaRegua(s);
  if (PEDE_MOTIVO.includes(s.situacao)) return { texto: nomeDaSituacao(s.situacao) + (texto(s.motivo) ? ': ' + texto(s.motivo) : '.'), alerta: false };
  if (s.situacao === 'no_ar') {
    if (!p.fechada) return { texto: 'No ar com ' + plural(p.total - p.feitos, 'item da régua em aberto', 'itens da régua em aberto') + '. O próximo: ' + p.proximo.rotulo + '.', alerta: true };
    const t = hoje ? testeDeParar(s, vendas, hoje) : { estado: 'fora' };
    if (t.estado === 'chegou' || t.estado === 'sem') return { texto: t.texto, alerta: true };
    const j = hoje ? janelaDoServico(s, hoje) : { estado: 'sem' };
    if (j.estado === 'fechada') return { texto: j.texto, alerta: true };
    return { texto: t.estado === 'no_prazo' ? t.texto : 'No ar.', alerta: false };
  }
  const falta = faltaPraIrProAr(s);
  if (!falta.length) return { texto: 'A régua fechou: pode ir pro ar.', alerta: false };
  // a ideia ainda não começou: o passo dela é entrar em estudo, não a régua inteira
  if (s.situacao === 'ideia') return { texto: 'Ideia guardada. Pra começar, passe pra "Em estudo".', alerta: false };
  if (p.proximo) {
    const n = p.total - p.feitos;
    return { texto: (n === 1 ? 'Falta 1 item da régua' : 'Faltam ' + n + ' itens da régua. O próximo') + ': ' + p.proximo.rotulo + '.', alerta: false };
  }
  return { texto: 'A régua fechou. Falta preencher: ' + falta.map(f => f.rotulo.charAt(0).toLowerCase() + f.rotulo.slice(1)).join(', ') + '.', alerta: false };
}

/** A janela de venda do serviço (o "janela até") → { estado: 'sem' | 'aberta' | 'fechada', dias, texto }. */
export function janelaDoServico(servico, hoje) {
  const s = servico || {};
  if (!isoValida(s.janela_ate) || !isoValida(hoje)) return { estado: 'sem', dias: null, texto: '' };
  const dias = diasEntre(hoje, s.janela_ate);
  if (dias < 0) return { estado: 'fechada', dias, texto: 'A janela fechou em ' + fmtData(s.janela_ate) + '.' };
  return { estado: 'aberta', dias, texto: 'Janela até ' + fmtData(s.janela_ate) + (dias === 0 ? ' (é hoje)' : ' (' + plural(dias, 'dia', 'dias') + ')') + '.' };
}

// ---------- o serviço que a tela grava ----------
/** Confere a ficha do serviço → { ok, erros: { campo: frase }, valor } (o valor é o que vai pro banco). */
export function conferirServico(dados, { novo = false } = {}) {
  const d = dados || {}, erros = {};
  const nome = umaLinha(d.nome);
  if (!nome) erros.nome = 'Dê um nome ao serviço.';
  else if (nome.length > LIMITES.nome) erros.nome = 'O nome passa de ' + LIMITES.nome + ' letras.';
  const slug = texto(d.slug) || (novo ? slugDe(nome) : '');
  if (!slugValido(slug)) erros.slug = 'O endereço curto usa só letras minúsculas, números e hífen (até ' + LIMITES.slug + ').';
  const modelo = d.modelo === 'gratis' ? 'gratis' : 'pago';
  let preco = null;
  if (modelo === 'pago' && texto(d.preco) !== '') {
    preco = lerDinheiro(d.preco);
    if (preco == null || preco > PRECO_MAXIMO) erros.preco = 'Preço ilegível. Use o formato 97,00 (ou deixe em branco: a definir).';
  }
  const situacao = SITUACOES.some(s => s.id === d.situacao) ? d.situacao : 'ideia';
  let motivo = vazioNulo(d.motivo);
  if (!PEDE_MOTIVO.includes(situacao)) motivo = null;
  else if (!motivo) erros.motivo = 'Diga o motivo: por que ' + (situacao === 'pausado' ? 'pausou' : situacao === 'encerrado' ? 'encerrou' : 'descartou') + '.';
  else if (motivo.length > LIMITES.motivo) erros.motivo = 'O motivo passa de ' + LIMITES.motivo + ' letras.';
  const dia = (v, campo, frase) => { const t = texto(v); if (!t) return null; if (!isoValida(t)) { erros[campo] = frase; return null; } return t; };
  const janela_ate = dia(d.janela_ate, 'janela_ate', 'Data da janela inválida.');
  const parar_em = dia(d.parar_em, 'parar_em', 'Data de reavaliar inválida.');
  const link = (v, campo) => { const t = texto(v); if (!t) return null; if (!linkSeguro(t)) { erros[campo] = 'Use um endereço que começa com https:// ou uma tela do sistema (ex.: mei.html).'; return null; } return t; };
  const link_pagina = link(d.link_pagina, 'link_pagina'), link_prototipo = link(d.link_prototipo, 'link_prototipo');
  const curto = (v, campo, max, nomeDoCampo) => { const t = vazioNulo(v); if (t && t.length > max) erros[campo] = nomeDoCampo + ' passa de ' + max + ' letras.'; return t; };
  const ordem = Number.isInteger(Number(d.ordem)) && Math.abs(Number(d.ordem)) <= 9999 ? Number(d.ordem) : 0;
  // a régua: o "não" e o "não se aplica" pedem o porquê
  const regua = {};
  for (const i of REGUA) {
    const g = ehObjeto(d.regua) && ehObjeto(d.regua[i.chave]) ? d.regua[i.chave] : null;
    if (!g) continue;
    const estado = Object.prototype.hasOwnProperty.call(ESTADOS, g.estado) && !(g.estado === 'na' && !i.aceitaNa) ? g.estado : 'pendente';
    const nota = texto(g.nota);
    if (nota.length > LIMITES.nota) erros['regua.' + i.chave] = 'A nota passa de ' + LIMITES.nota + ' letras.';
    else if ((estado === 'nao' || estado === 'na') && !nota && !(modelo === 'gratis' && i.soPago)) erros['regua.' + i.chave] = 'Diga o porquê na nota.';
    regua[i.chave] = { ...g, estado, nota };
  }
  const valor = { slug, nome, resumo: curto(d.resumo, 'resumo', LIMITES.resumo, 'O resumo'), publico: curto(d.publico, 'publico', LIMITES.publico, 'O "pra quem"'),
    modelo, preco, preco_obs: modelo === 'pago' ? curto(d.preco_obs, 'preco_obs', LIMITES.preco_obs, 'A nota do preço') : null,
    situacao, motivo,
    janela_ate, parar_em, parar_criterio: curto(d.parar_criterio, 'parar_criterio', LIMITES.parar_criterio, 'O critério'),
    link_pagina, link_prototipo, quem_assina: curto(d.quem_assina, 'quem_assina', LIMITES.quem_assina, 'O "quem assina"'),
    responsavel: curto(d.responsavel, 'responsavel', LIMITES.responsavel, 'O responsável'), origem: curto(d.origem, 'origem', LIMITES.origem, 'A origem'),
    observacao: curto(d.observacao, 'observacao', LIMITES.observacao, 'A observação'), ordem, regua };
  if (situacao === 'no_ar' && !Object.keys(erros).length) {
    const falta = faltaPraIrProAr(valor);
    if (falta.length) erros.situacao = 'Ainda não pode ir pro ar. Falta: ' + falta.map(f => f.rotulo).join(' · ') + '.';
  }
  return { ok: !Object.keys(erros).length, erros, valor };
}

// ---------- as vendas ----------
export function cpfValido(c) {
  const d = String(c == null ? '' : c).replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = n => { let s = 0; for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}
/** Dá pra registrar venda: serviço pago que está no ar, ou que já esteve (a venda de antes, lançada depois). */
export const aceitaVenda = servico => !!servico && servico.modelo === 'pago'
  && (servico.situacao === 'no_ar' || ((servico.situacao === 'pausado' || servico.situacao === 'encerrado') && !!servico.no_ar_desde));

/** Confere a venda digitada → { ok, erros, valor } (o documento só com letras e números, o WhatsApp com o 55). */
export function conferirVenda(dados, { servicos = null } = {}) {
  const d = dados || {}, erros = {};
  const servico = Array.isArray(servicos) ? servicos.find(s => s.id === d.servico_id) || null : null;
  if (!d.servico_id) erros.servico_id = 'Escolha o serviço.';
  else if (Array.isArray(servicos) && !servico) erros.servico_id = 'Serviço não encontrado.';
  else if (servico && !aceitaVenda(servico)) erros.servico_id = 'Só dá pra registrar venda de serviço pago que está no ar (ou que já esteve).';
  const nome = umaLinha(d.comprador_nome);
  if (!nome) erros.comprador_nome = 'Diga o nome de quem comprou.';
  else if (nome.length > LIMITES.comprador_nome) erros.comprador_nome = 'O nome passa de ' + LIMITES.comprador_nome + ' letras.';
  let doc = normalizarDocumento(d.comprador_documento) || null;
  if (texto(d.comprador_documento) && !(doc && (doc.length === 11 ? cpfValido(doc) : cnpjValido(doc)))) { erros.comprador_documento = 'CPF ou CNPJ inválido: confira os números.'; doc = null; }
  const email = vazioNulo(d.comprador_email);
  if (email && (email.length > LIMITES.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) erros.comprador_email = 'E-mail inválido.';
  let zap = String(d.comprador_whatsapp == null ? '' : d.comprador_whatsapp).replace(/\D/g, '') || null;
  if (zap) {
    if (zap.length === 10 || zap.length === 11) zap = '55' + zap;
    if (zap.length < 12 || zap.length > 15) { erros.comprador_whatsapp = 'WhatsApp com o DDD, como (51) 99999-9999.'; zap = null; }
  }
  const cidade = vazioNulo(umaLinha(d.comprador_cidade));
  if (cidade && cidade.length > LIMITES.cidade) erros.comprador_cidade = 'A cidade passa de ' + LIMITES.cidade + ' letras.';
  let uf = texto(d.comprador_uf).toUpperCase() || null;
  if (uf && !ESTADOS_BR.includes(uf)) { erros.comprador_uf = 'UF inválida.'; uf = null; }
  const valor = lerDinheiro(d.valor);
  if (valor == null || valor > PRECO_MAXIMO) erros.valor = 'Diga o valor (ex.: 97,00).';
  const observacao = vazioNulo(d.observacao);
  if (observacao && observacao.length > LIMITES.obs_venda) erros.observacao = 'A observação passa de ' + LIMITES.obs_venda + ' letras.';
  return { ok: !Object.keys(erros).length, erros,
    valor: { servico_id: d.servico_id || null, comprador_nome: nome, comprador_documento: doc, comprador_email: email, comprador_whatsapp: zap,
      comprador_cidade: cidade, comprador_uf: uf, valor, observacao } };
}

/** O que falta na venda → [{ chave: 'pagamento' | 'entrega' | 'nfse', texto }]. A cortesia (valor zero) não tem nota. */
export function pendenciasDaVenda(venda) {
  const v = venda || {};
  if (v.pagamento === 'aguardando') return [{ chave: 'pagamento', texto: 'Confirmar o pagamento' }];
  if (v.pagamento !== 'pago') return [];
  const p = [];
  if (!v.entregue_em) p.push({ chave: 'entrega', texto: 'Entregar' });
  if (Number(v.valor) > 0 && !texto(v.nfse_numero)) p.push({ chave: 'nfse', texto: 'Emitir a NFS-e' });
  return p;
}

/** Até que dia vale o arrependimento (CDC, art. 49): 7 dias da contratação ou, se veio depois, do recebimento. */
export function arrependimentoAte(venda) {
  const v = venda || {};
  const compra = diaEmBrasilia(v.termos_aceitos_em) || diaEmBrasilia(v.pago_em) || diaEmBrasilia(v.criado_em);
  if (!compra) return null;
  const entrega = diaEmBrasilia(v.entregue_em);
  return somaDias(entrega && entrega > compra ? entrega : compra, DIAS_ARREPENDIMENTO);
}
/** A venda paga ainda pode ser desfeita pelo comprador: sem entrega, os 7 dias nem começaram a contar do recebimento. */
export function dentroDoArrependimento(venda, hoje) {
  const v = venda || {};
  if (v.pagamento !== 'pago') return false;
  if (!v.entregue_em) return true;
  const ate = arrependimentoAte(v);
  return !!ate && !!hoje && hoje <= ate;
}
export function textoDoArrependimento(venda, hoje) {
  if (!dentroDoArrependimento(venda, hoje)) return '';
  return venda.entregue_em ? 'Dentro do prazo de arrependimento até ' + fmtData(arrependimentoAte(venda)) + '.' : 'Arrependimento: os 7 dias contam da entrega.';
}

/** As contas de cada serviço → Map(servico_id → { pagas, receita, aguardando, devolvidas, canceladas, pendentes }). */
export function contasPorServico(vendas) {
  const m = new Map();
  for (const v of vendas || []) {
    if (!v || !v.servico_id) continue;
    const c = m.get(v.servico_id) || { pagas: 0, centavos: 0, aguardando: 0, devolvidas: 0, canceladas: 0, pendentes: 0 };
    if (v.pagamento === 'pago') { c.pagas++; c.centavos += centavos(v.valor); }
    else if (v.pagamento === 'aguardando') c.aguardando++;
    else if (v.pagamento === 'devolvido') c.devolvidas++;
    else if (v.pagamento === 'cancelado') c.canceladas++;
    if (pendenciasDaVenda(v).length) c.pendentes++;
    m.set(v.servico_id, c);
  }
  for (const c of m.values()) { c.receita = c.centavos / 100; delete c.centavos; }
  return m;
}

/** O retrato da vitrine: quantos em cada situação, as vendas pagas, a receita e o selo do card do Comercial. */
export function resumoDaVitrine(servicos, vendas) {
  const porSituacao = Object.fromEntries(SITUACOES.map(s => [s.id, 0]));
  for (const s of servicos || []) if (s && porSituacao[s.situacao] != null) porSituacao[s.situacao]++;
  let pagas = 0, cent = 0, aguardando = 0, comPendencia = 0;
  for (const v of vendas || []) {
    if (!v) continue;
    if (v.pagamento === 'pago') { pagas++; cent += centavos(v.valor); }
    if (v.pagamento === 'aguardando') aguardando++;
    if (pendenciasDaVenda(v).length) comPendencia++;
  }
  return { total: (servicos || []).length, porSituacao, noAr: porSituacao.no_ar, emPreparo: porSituacao.preparo,
    vendasPagas: pagas, receita: cent / 100, aguardando, comPendencia, selo: seloDoCard(servicos) };
}
/** O número do card no painel do Comercial: "N no ar" ou, sem nenhum, "N em preparo". */
export function seloDoCard(servicos) {
  const noAr = (servicos || []).filter(s => s && s.situacao === 'no_ar').length;
  return noAr ? noAr + ' no ar' : (servicos || []).filter(s => s && s.situacao === 'preparo').length + ' em preparo';
}

/** As seções da vitrine, na ordem: No ar, Em preparo, Em estudo, Ideias e, recolhidos, os de fora. */
export function secoesDaVitrine(servicos) {
  const ordem = (a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0) || String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
  const de = ids => (servicos || []).filter(s => s && ids.includes(s.situacao)).sort(ordem);
  return [
    { id: 'no_ar', titulo: 'No ar', itens: de(['no_ar']), recolhida: false },
    { id: 'preparo', titulo: 'Em preparo', itens: de(['preparo']), recolhida: false },
    { id: 'estudo', titulo: 'Em estudo', itens: de(['estudo']), recolhida: false },
    { id: 'ideia', titulo: 'Ideias', itens: de(['ideia']), recolhida: false },
    { id: 'fora', titulo: 'Pausados, encerrados e descartados', itens: de(PEDE_MOTIVO), recolhida: true }
  ];
}

/** As vendas pagas por serviço e mês (o mês do pagamento, em Brasília), os meses seguidos até o último, no máximo
 *  maxMeses → { meses, linhas: [{ servico_id, nome, porMes, total }], totais: { porMes, total }, antes }. Cada célula:
 *  { vendas, receita, devolvidas } — a devolvida não conta na venda nem na receita. */
export function numerosPorMes(servicos, vendas, { hoje = null, maxMeses = 12 } = {}) {
  const pagas = (vendas || []).filter(v => v && (v.pagamento === 'pago' || v.pagamento === 'devolvido') && mesDe(v.pago_em));
  const zero = () => ({ vendas: 0, centavos: 0, devolvidas: 0 });
  const fecha = c => ({ vendas: c.vendas, receita: c.centavos / 100, devolvidas: c.devolvidas });
  let primeiro = null, ultimo = isoValida(hoje) ? hoje.slice(0, 7) : null;
  for (const v of pagas) { const m = mesDe(v.pago_em); if (!primeiro || m < primeiro) primeiro = m; if (!ultimo || m > ultimo) ultimo = m; }
  if (!primeiro) return { meses: [], linhas: [], totais: { porMes: {}, total: fecha(zero()) }, antes: null };
  const meses = [];
  for (let m = ultimo; m >= primeiro && meses.length < maxMeses; m = somaMes(m, -1)) meses.unshift(m);
  const nomes = new Map((servicos || []).map(s => [s.id, s]));
  const porServico = new Map(), totMes = Object.fromEntries(meses.map(m => [m, zero()])), total = zero(), antes = zero();
  for (const v of pagas) {
    const m = mesDe(v.pago_em), soma = c => { if (v.pagamento === 'pago') { c.vendas++; c.centavos += centavos(v.valor); } else c.devolvidas++; };
    if (m < meses[0]) { soma(antes); continue; }
    let l = porServico.get(v.servico_id);
    if (!l) porServico.set(v.servico_id, l = { porMes: Object.fromEntries(meses.map(x => [x, zero()])), total: zero() });
    soma(l.porMes[m]); soma(l.total); soma(totMes[m]); soma(total);
  }
  const linhas = [...porServico.entries()].map(([id, l]) => ({ servico_id: id, nome: (nomes.get(id) || {}).nome || 'Serviço fora da lista',
    situacao: (nomes.get(id) || {}).situacao || null, porMes: Object.fromEntries(meses.map(m => [m, fecha(l.porMes[m])])), total: fecha(l.total) }))
    .sort((a, b) => b.total.receita - a.total.receita || b.total.vendas - a.total.vendas || a.nome.localeCompare(b.nome, 'pt-BR'));
  return { meses, linhas, totais: { porMes: Object.fromEntries(meses.map(m => [m, fecha(totMes[m])])), total: fecha(total) },
    antes: antes.vendas || antes.devolvidas ? fecha(antes) : null };
}

/** O teste de parar do serviço no ar: a data de reavaliar e o critério, com o que vendeu até aqui
 *  → { estado: 'fora' | 'sem' | 'no_prazo' | 'chegou', dias, vendas, receita, texto }. */
export function testeDeParar(servico, vendas, hoje) {
  const s = servico || {};
  const c = contasPorServico((vendas || []).filter(v => v && v.servico_id === s.id)).get(s.id) || { pagas: 0, receita: 0 };
  const base = { vendas: c.pagas, receita: c.receita };
  if (s.situacao !== 'no_ar' || (s.modelo === 'gratis' && !isoValida(s.parar_em))) return { estado: 'fora', dias: null, ...base, texto: '' };
  const vendeu = s.modelo === 'gratis' ? '' : plural(c.pagas, 'venda', 'vendas') + (c.pagas ? ', R$ ' + fmtDinheiro(c.receita) : '');
  if (!isoValida(s.parar_em) || !isoValida(hoje)) return { estado: 'sem', dias: null, ...base, texto: 'Sem data de reavaliar: ponha a data e o critério de parar.' };
  const dias = diasEntre(hoje, s.parar_em), criterio = texto(s.parar_criterio);
  if (dias > 0) return { estado: 'no_prazo', dias, ...base,
    texto: 'Reavaliar em ' + fmtData(s.parar_em) + ' (' + plural(dias, 'dia', 'dias') + ')' + (criterio ? ': ' + criterio : '') + (vendeu ? ' · até aqui, ' + vendeu : '') + '.' };
  return { estado: 'chegou', dias, ...base,
    texto: 'Chegou a data de reavaliar (' + fmtData(s.parar_em) + ')' + (criterio ? ': ' + criterio : '') + (vendeu ? ' · vendeu ' + vendeu : '') + '. Decida: segue, pausa ou encerra.' };
}

/** "Por onde começar": o que pede atenção agora, o mais urgente primeiro → [{ tipo, texto, servico?, aba? }]. */
export function guiaDoComeco(servicos, vendas, hoje) {
  const passos = [], lista = servicos || [];
  for (const s of lista.filter(x => x && x.situacao === 'no_ar')) {
    const p = proximoPasso(s, { hoje, vendas });
    if (p.alerta) passos.push({ tipo: 'alerta', texto: s.nome + ': ' + p.texto, servico: s.slug });
  }
  const pend = { pagamento: 0, entrega: 0, nfse: 0 };
  for (const v of vendas || []) for (const x of pendenciasDaVenda(v)) pend[x.chave]++;
  const partes = [pend.pagamento ? plural(pend.pagamento, 'esperando o pagamento', 'esperando o pagamento') : '', pend.entrega ? plural(pend.entrega, 'paga sem entrega', 'pagas sem entrega') : '',
    pend.nfse ? plural(pend.nfse, 'paga sem NFS-e', 'pagas sem NFS-e') : ''].filter(Boolean);
  if (partes.length) passos.push({ tipo: 'vendas', texto: 'Vendas: ' + partes.join(', ') + '.', aba: 'vendas' });
  for (const s of secoesDaVitrine(lista).find(x => x.id === 'preparo').itens) passos.push({ tipo: 'preparo', texto: s.nome + ': ' + proximoPasso(s, { hoje, vendas }).texto, servico: s.slug });
  for (const s of secoesDaVitrine(lista).find(x => x.id === 'estudo').itens) passos.push({ tipo: 'estudo', texto: s.nome + ' (em estudo): ' + proximoPasso(s, { hoje, vendas }).texto, servico: s.slug });
  if (!passos.length) {
    const ideias = lista.filter(x => x && x.situacao === 'ideia').length;
    passos.push(lista.length
      ? { tipo: 'vazio', texto: ideias ? 'Nada em preparo. Escolha uma das ' + plural(ideias, 'ideia', 'ideias') + ' e passe pra "Em estudo".' : 'Tudo em dia. Tem ideia nova? Cadastre em "+ Novo serviço".' }
      : { tipo: 'vazio', texto: 'Comece cadastrando a primeira ideia em "+ Novo serviço".' });
  }
  return passos;
}

// ---------- a tarefa das NFS-e (fiscal, Thalia): uma linha por venda paga ----------
export const TITULO_TAREFA_NOTAS = 'Emitir as NFS-e dos serviços digitais';
export const INTRO_TAREFA_NOTAS = 'As vendas pagas dos serviços digitais (Comercial › Serviços digitais). Emita a NFS-e de cada uma e informe o número na venda:';
const RE_LINHA_NOTA = /^([☐☑]) Venda nº (\d+) · /;
const linhaDaVenda = (l, numero) => { const m = RE_LINHA_NOTA.exec(l); return m && Number(m[2]) === Number(numero) ? m[1] : null; };

/** "☐ Venda nº 12 · Cadastro de produtos 2027 (RS) · LOJA TAL LTDA (12.345.678/0001-90) · R$ 97,00 · paga em 15/11/2026" */
export function linhaDaNota(venda, servico) {
  const v = venda || {};
  return '☐ Venda nº ' + v.numero + ' · ' + umaLinha(servico && servico.nome) + ' · ' + umaLinha(v.comprador_nome)
    + (v.comprador_documento ? ' (' + formatDocumento(v.comprador_documento) + ')' : '') + ' · R$ ' + fmtDinheiro(v.valor) + ' · paga em ' + fmtData(v.pago_em);
}
export const descricaoDaTarefaNotas = linhas => INTRO_TAREFA_NOTAS + '\n' + (linhas || []).join('\n');
export const temVendaNaTarefa = (descricao, numero) => String(descricao || '').split('\n').some(l => linhaDaVenda(l, numero));
/** A linha da venda entra no fim da lista, uma vez só → { descricao, entrou }. */
export function juntarNaTarefaNotas(descricao, linha, numero) {
  const atual = String(descricao || '');
  if (temVendaNaTarefa(atual, numero)) return { descricao: atual, entrou: false };
  return { descricao: (atual.trim() ? atual.replace(/\s+$/, '') + '\n' : '') + linha, entrou: true };
}
/** A nota informada marca a linha da venda (☐ vira ☑, com o número da nota no fim) → { descricao, marcou }. */
export function marcarNotaNaTarefa(descricao, numero, nfse) {
  let marcou = false;
  const linhas = String(descricao || '').split('\n').map(l => {
    if (linhaDaVenda(l, numero) !== '☐') return l;
    marcou = true;
    return '☑' + l.slice(1) + (umaLinha(nfse) ? ' · NFS-e ' + umaLinha(nfse) : '');
  });
  return { descricao: linhas.join('\n'), marcou };
}
/** O desfazer da nota: a linha volta a ☐, sem o número → { descricao, desmarcou }. */
export function desmarcarNotaNaTarefa(descricao, numero) {
  let desmarcou = false;
  const linhas = String(descricao || '').split('\n').map(l => {
    if (linhaDaVenda(l, numero) !== '☑') return l;
    desmarcou = true;
    return '☐' + l.slice(1).replace(/ · NFS-e [^·]*$/, '');
  });
  return { descricao: linhas.join('\n'), desmarcou };
}
/** O desfazer do pagamento: a linha ainda ☐ sai da lista → { descricao, tirou, sobram (as linhas de venda que ficam) }. */
export function tirarDaTarefaNotas(descricao, numero) {
  let tirou = false;
  const ficam = String(descricao || '').split('\n').filter(l => { if (linhaDaVenda(l, numero) === '☐') { tirou = true; return false; } return true; });
  return { descricao: ficam.join('\n'), tirou, sobram: ficam.filter(l => RE_LINHA_NOTA.test(l)).length };
}
/** O prazo da tarefa das notas: o próximo dia útil depois de hoje (os feriados de rescisao-datas.js). */
export function prazoDaTarefaNotas(hoje) {
  let d = somaDias(hoje, 1);
  for (let i = 0; i < 15 && !diaUtil(d); i++) d = somaDias(d, 1);
  return d;
}
