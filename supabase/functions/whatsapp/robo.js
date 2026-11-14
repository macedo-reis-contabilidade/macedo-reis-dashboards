// ============================================================
// MACEDO & REIS — O robô do atendimento pelo WhatsApp: a conversa pela IA (11/11/2026, a etapa 4 da fase 1; as etapas no
// Projeto, whatsapp/fase1.md; o jeito do robô em whatsapp/robo.md, com as decisões wa-01 a wa-10).
// Esta primeira parte é a triagem: a mensagem do cliente (por enquanto só no simulador da tela de atendimento) passa pela
// IA, que cumprimenta, responde o que é de balcão (a lista aprovada, BALCAO de assets/js/atendimento-robo.js) e, no resto,
// entende o assunto, escolhe a fila e deixa o resumo pra quem pega. Desde 14/11/2026, com o número CONFIRMADO da empresa,
// ele também responde o que o sistema tem dela (dadosDaEmpresa: o boleto do escritório do mês — o valor, o vencimento e
// se já foi emitido ou enviado, nunca se está pago —, a validade do certificado digital e o andamento da admissão e da
// rescisão), lido pela função na hora; o resto do que precisa do sistema, ele passa pra pessoa. A frase de quando passa (quem recebe,
// no horário e fora dele, a reclamação pro Samuel) não é da IA: é a textoDaPassagem, a regra pura.
// A resposta vem pela ferramenta "responder" (formato fixo, conferido por lerResposta). Puro: o chamador da API vem de
// fora (o de supabase/functions/noticias/triagem.js) — testes no node em tests/atendimento-robo.test.mjs.
// ============================================================
import { SETORES, nomeDe, donoDoSetor } from '../../../assets/js/atendimento.js';
import { BALCAO, APRESENTACAO, E_ROBO, emBrasilia, dentroDoHorario, voltaDaEquipe, textoDaPassagem } from '../../../assets/js/atendimento-robo.js';
import { totalDoBoleto } from '../../../assets/js/boletos-conta-azul.js';

export const MODELOS_ROBO = ['claude-sonnet-5-5', 'claude-sonnet-4-6'];
export const MAX_TOKENS_ROBO = 6000;      // o modelo pensa antes de responder, e o pensamento conta no limite
export const MAX_RESPOSTAS_SEM_PASSAR = 4;  // depois disso, o robô passa pra pessoa de qualquer jeito
const IDS = SETORES.map(s => s.id);

const FILAS = SETORES.map(s => `- ${s.id}: ${s.nome} — recebe ${nomeDe(s.dono)}`).join('\n');
const REGRAS = `Você é o assistente da Macedo & Reis Contabilidade, de Três Coroas/RS, respondendo clientes no WhatsApp do escritório.
${APRESENTACAO} Você não tem nome próprio. Trate o cliente por "você".

O TOM: o de alguém do balcão que conhece o cliente — educado sem cerimônia, curto e direto, sem "prezado cliente", sem menu de números, emoji quase nunca. Cumprimente pelo nome quando souber. Responda primeiro o que foi perguntado. Frases curtas; uma mensagem por vez. Se perguntarem se é robô: "${E_ROBO}"

O QUE VOCÊ RESPONDE SOZINHO (passar = false):
- O cumprimento sem pedido ("oi", "bom dia"): cumprimente, diga quem é na primeira vez e pergunte em que pode ajudar.
- As respostas de balcão, SÓ como estão aqui (pode encurtar, nunca acrescentar fato):
${Object.entries(BALCAO).map(([k, v]) => `  · ${k}: ${v}`).join('\n')}
- "É robô?": a frase acima.
- Agradecimento ou despedida: responda curto.
- Mensagem que não dá pra entender: pergunte o que a pessoa precisa, numa frase.
- Dado da empresa que está no bloco "O QUE O SISTEMA TEM DESTA EMPRESA" do contexto (só vem com o número confirmado): o valor e o vencimento do boleto do escritório e se ele já foi emitido ou enviado, a validade do certificado digital, em que pé está uma admissão ou uma rescisão. Responda SÓ o que está lá, como está, sem calcular nem deduzir; e o que o cliente pedir além disso (o arquivo, mudar a data, o porquê), passe pra quem cuida.

O QUE VOCÊ PASSA PRA PESSOA (passar = true) — todo o resto, e em especial:
- Pedido de dado da empresa que NÃO está no bloco "O QUE O SISTEMA TEM DESTA EMPRESA" do contexto (guia, declaração, imposto, nota, folha, o arquivo do boleto ou a segunda via), ou com o número não confirmado: passa.
- Se o boleto está pago, em aberto ou atrasado: passa pro financeiro (o sistema não diz isso, e você nunca afirma).
- Orientação ("posso…?", "como faço…?", "vale a pena…?") em imposto, folha, contrato ou empresa: NUNCA oriente.
- Assunto sensível: demissão, cobrança da Receita, fiscalização, cancelamento do contrato, honorário, desconto.
- Documento ou arquivo que o cliente mandou: agradeça e passe pra quem cuida.
- O cliente pede pra falar com alguém, ou com uma pessoa pelo nome.
- O cliente chateado ou reclamando de demora ou do atendimento: reclamacao = true (vai pro Samuel).
- Você não tem certeza.

AS FILAS (setor):
${FILAS}
- sem_setor: o que não se encaixa em nenhuma (recebe ${nomeDe(donoDoSetor(null))})
Pra qual: imposto, guia, nota fiscal, Simples, MEI (o DAS), ICMS, ISS, parcelamento, Receita → fiscal; folha, funcionário, admissão, rescisão, férias, 13º, pró-labore, eSocial, FGTS, INSS da folha → dp; contabilidade, balanço, extratos, lançamentos → contabil; alvará, certificado digital, alteração contratual, abertura, encerramento de empresa → societario; boleto do escritório, honorário, contrato com o escritório, cobrança → financeiro; quem ainda não é cliente, proposta, quanto custa → comercial. Pedido de uma pessoa pelo nome: o setor dela (Thalia → fiscal, Vitória → dp, Adaini → contabil, Samuel → financeiro).

NUNCA: orientar; prometer prazo, valor ou resultado; inventar o que não está aqui; mandar senha ou credencial; contar de uma empresa pra outro número; negociar honorário; cobrar; dizer o que vai mudar no sistema. Funcionário do cliente pedindo holerite, férias ou o FGTS dele: passe pro dp, sem dado nenhum.

COMO RESPONDER: SEMPRE chamando a ferramenta "responder", uma vez, sem texto fora dela.
- texto: o que vai pro cliente. Quando passa, o sistema põe DEPOIS do seu texto a frase de quem recebe e quando ("Já passei pra Thalia, do fiscal…", ou "A equipe volta amanhã, às 7h30…"): então, ao passar, escreva só o começo — o cumprimento, se for a primeira mensagem, e um "Recebi, obrigado!" quando veio arquivo — ou deixe vazio; nunca diga você mesmo pra quem passou nem quando a equipe volta.
- motivo (só ao passar, opcional): quando é orientação, em poucas palavras por que a pessoa responde melhor ("depende de como a empresa está enquadrada"); sem ponto final.
- resumo (só ao passar): pra quem pega, em 1 a 3 frases: quem é (o nome e a empresa, se sabe), o que pediu, o que você já respondeu. Sem inventar.`;

export function montarSistema() {
  return [{ type: 'text', text: REGRAS, cache_control: { type: 'ephemeral', ttl: '1h' } }];
}

export const FERRAMENTA_ROBO = {
  name: 'responder',
  description: 'Registra a resposta do assistente ao cliente e se a conversa passa pra uma pessoa.',
  input_schema: {
    type: 'object',
    properties: {
      texto: { type: 'string', description: 'O que vai pro cliente (ao passar, só o começo, ou vazio).' },
      passar: { type: 'boolean', description: 'true = a conversa vai pra fila de uma pessoa.' },
      setor: { type: 'string', enum: [...IDS, 'sem_setor'], description: 'A fila, ao passar.' },
      reclamacao: { type: 'boolean', description: 'true = cliente chateado ou reclamando (vai pro Samuel).' },
      motivo: { type: 'string', description: 'Ao passar por orientação: por que a pessoa responde melhor, curto.' },
      resumo: { type: 'string', description: 'Ao passar: o resumo pra quem pega, 1 a 3 frases.' },
    },
    required: ['texto', 'passar'],
  },
};

const limpo = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);

// o histórico da conversa → as mensagens da API: o cliente é "user", o escritório (o robô e a equipe) é "assistant"; a
// nota interna não vai; o arquivo vira uma linha; as seguidas do mesmo lado juntam; começa sempre pelo cliente
export function mensagensDaConversa(historico = []) {
  const out = [];
  for (const m of historico || []) {
    if (!m || (m.direcao !== 'entrada' && m.direcao !== 'saida')) continue;
    const arqs = (Array.isArray(m.anexos) ? m.anexos : []).map(a => '[o cliente mandou o arquivo: ' + limpo(a && a.nome, 120) + ']');
    const partes = [String(m.texto || '').trim(), ...(m.direcao === 'entrada' ? arqs : [])].filter(Boolean);
    if (!partes.length) continue;
    const role = m.direcao === 'entrada' ? 'user' : 'assistant';
    const txt = (role === 'assistant' && m.autor && m.autor !== 'robo' ? '(' + nomeDe(m.autor) + ', da equipe) ' : '') + partes.join('\n');
    const ult = out[out.length - 1];
    if (ult && ult.role === role) ult.content += '\n' + txt; else out.push({ role, content: txt });
  }
  while (out.length && out[0].role !== 'user') out.shift();
  return out;
}

// ---------- o que o sistema tem da empresa do número confirmado (14/11/2026) ----------
// A função lê (cobrancas_mensais, certificados_digitais, admissoes, rescisoes do cliente_id) e passa aqui as linhas;
// isto só formata, em texto pro contexto. Só com o número confirmado (quem chama confere, e contextoDaMensagem também).
const SIT_BOLETO = { a_emitir: 'ainda não emitido', emitido: 'emitido, ainda não enviado', enviado: 'enviado' };
const SIT_ADMISSAO = { respondida: 'recebida pelo escritório, a registrar', aguardando_empresa: 'esperando informações da empresa', em_registro: 'em registro', registrada: 'registrada' };
const SIT_RESCISAO = { recebida: 'recebida pelo escritório, a calcular', em_andamento: 'em cálculo', concluida: 'concluída' };
const dataBr = d => /^\d{4}-\d{2}-\d{2}/.test(String(d || '')) ? String(d).slice(0, 10).split('-').reverse().join('/') : '';
const compBr = c => /^\d{4}-\d{2}$/.test(String(c || '')) ? String(c).slice(5) + '/' + String(c).slice(0, 4) : '';
export function reaisBr(v) {
  const c = Math.round((Number(v) || 0) * 100), neg = c < 0, a = Math.abs(c);
  const int = String(Math.floor(a / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (neg ? '-' : '') + 'R$ ' + int + ',' + String(a % 100).padStart(2, '0');
}
const diasEntre = (de, ate) => Math.round((Date.parse(String(ate).slice(0, 10)) - Date.parse(String(de).slice(0, 10))) / 86400000);

/**
 * { cobrancas, certificados, admissoes, rescisoes, hoje: 'AAAA-MM-DD' } → o bloco em texto (sempre algum texto).
 * O boleto: os 2 mais recentes pela competência, com o total (a mensalidade e os extras) — o "pago" não entra (o
 * escritório quase nunca marca: o robô diria "em aberto" de um boleto pago). O certificado: os acompanhados.
 * A admissão e a rescisão: as dos últimos 60 dias (pela data de criação), fora as canceladas.
 */
export function dadosDaEmpresa({ cobrancas = [], certificados = [], admissoes = [], rescisoes = [], hoje } = {}) {
  const linhas = [];
  const bol = (cobrancas || []).filter(c => c && compBr(c.competencia) && c.status !== 'cancelado')
    .sort((a, b) => String(b.competencia).localeCompare(String(a.competencia))).slice(0, 2);
  for (const c of bol) {
    const sit = c.status === 'pago' ? 'já emitido' : (SIT_BOLETO[c.status] || 'emitido');
    linhas.push(`Boleto do honorário do escritório, competência ${compBr(c.competencia)}: ${reaisBr(totalDoBoleto(c))}`
      + (dataBr(c.vencimento) ? `, vence em ${dataBr(c.vencimento)}` : '') + `, ${sit}.`);
  }
  const cert = (certificados || []).filter(c => c && c.acompanhar !== false && dataBr(c.validade))
    .sort((a, b) => String(a.validade).localeCompare(String(b.validade))).slice(0, 3);
  for (const c of cert) {
    const n = hoje ? diasEntre(hoje, c.validade) : null;
    const quanto = n == null ? '' : n < 0 ? ` (venceu há ${-n} ${-n === 1 ? 'dia' : 'dias'})` : n === 0 ? ' (vence hoje)' : ` (faltam ${n} ${n === 1 ? 'dia' : 'dias'})`;
    linhas.push(`Certificado digital ${c.tipo ? c.tipo + ' ' : ''}de ${limpo(c.titular, 80) || 'titular não informado'}: válido até ${dataBr(c.validade)}${quanto}. O escritório só lembra da renovação; quem renova é a certificadora.`);
  }
  const recente = r => !hoje || !r.criado_em || diasEntre(String(r.criado_em).slice(0, 10), hoje) <= 60;
  for (const a of (admissoes || []).filter(a => a && a.status !== 'cancelada' && recente(a)).slice(0, 5))
    linhas.push(`Admissão de ${limpo(a.funcionario_nome, 80) || 'funcionário sem nome'}` + (dataBr(a.data_inicio) ? `, início em ${dataBr(a.data_inicio)}` : '') + `: ${SIT_ADMISSAO[a.status] || 'recebida pelo escritório'}.`);
  for (const r of (rescisoes || []).filter(r => r && r.status !== 'cancelada' && recente(r)).slice(0, 5))
    linhas.push(`Rescisão de ${limpo(r.funcionario_nome, 80) || 'funcionário sem nome'}` + (dataBr(r.ultimo_dia) ? `, último dia ${dataBr(r.ultimo_dia)}` : '')
      + (dataBr(r.data_acerto) ? `, pagamento até ${dataBr(r.data_acerto)}` : '') + `: ${SIT_RESCISAO[r.status] || 'recebida pelo escritório'}.`);
  return linhas.length ? linhas.map(l => '- ' + l).join('\n') : '- Nenhum boleto, certificado acompanhado, admissão ou rescisão recente desta empresa no sistema.';
}

// o que a IA precisa saber de agora, que não é do sistema (o sistema fica no cache): a hora, quem está falando e, com o
// número confirmado, o que o sistema tem da empresa (dados, o texto do dadosDaEmpresa)
export function contextoDaMensagem({ agora = new Date(), contato = null, empresa = null, confirmado = false, dados = null } = {}) {
  const b = emBrasilia(agora), volta = voltaDaEquipe(agora);
  return [
    `Agora: ${b.dia.split('-').reverse().join('/')} às ${String(Math.floor(b.minutos / 60)).padStart(2, '0')}h${String(b.minutos % 60).padStart(2, '0')}, hora de Brasília — `
      + (dentroDoHorario(agora) ? 'a equipe está atendendo.' : `fora do horário (a equipe volta ${volta ? volta.texto : 'no próximo dia útil'}).`),
    'Quem escreve: ' + (contato ? limpo(contato, 80) : 'nome não informado') + '.',
    'Empresa do número: ' + (empresa ? limpo(empresa, 120) + (confirmado ? ' (número confirmado)' : ' (número ainda não confirmado: não fale de dado da empresa)') : 'desconhecida (não pergunte dado nenhum além do nome da empresa, se precisar)') + '.',
    ...(empresa && confirmado && dados ? ['O QUE O SISTEMA TEM DESTA EMPRESA (lido agora; só pra este número):\n' + String(dados).slice(0, 3000)] : []),
  ].join('\n');
}

// a chamada: o sistema (com cache) + o contexto de agora na primeira mensagem do cliente + o histórico
export function corpoDoRobo(historico, ctx) {
  const msgs = mensagensDaConversa(historico);
  if (!msgs.length) return null;
  const primeiro = { ...msgs[0], content: '[' + contextoDaMensagem(ctx) + ']\n\n' + msgs[0].content };
  return { max_tokens: MAX_TOKENS_ROBO, system: montarSistema(), tools: [FERRAMENTA_ROBO], tool_choice: { type: 'auto' },
    messages: [primeiro, ...msgs.slice(1)] };
}

// a resposta da API → { texto, passar, setor, reclamacao, motivo, resumo }, conferida; sem a ferramenta, o texto solto
// vira a resposta e a conversa passa (o robô não decidiu: quem decide é a pessoa)
export function lerResposta(json) {
  const blocos = (json && Array.isArray(json.content)) ? json.content : [];
  const uso = blocos.find(b => b && b.type === 'tool_use' && b.name === 'responder');
  if (!uso || !uso.input || typeof uso.input !== 'object') {
    const solto = blocos.filter(b => b && b.type === 'text').map(b => b.text).join(' ');
    return { texto: limpo(solto, 1500), passar: true, setor: null, reclamacao: false, motivo: '', resumo: 'O assistente não classificou a mensagem: veja a conversa.', semFerramenta: true };
  }
  const i = uso.input;
  const passar = i.passar === true || i.reclamacao === true;
  const setor = IDS.includes(i.setor) ? i.setor : null;
  return { texto: limpo(i.texto, 1500), passar, setor: passar ? setor : null, reclamacao: i.reclamacao === true,
    motivo: passar ? limpo(i.motivo, 160).replace(/[.\s]+$/, '') : '', resumo: passar ? limpo(i.resumo, 1500) : '' };
}

// a mensagem que vai pro cliente: a da IA e, ao passar, a frase da passagem (a regra pura). Fora do horário a frase
// começa com "Oi!": com o cumprimento da IA na frente, ele sai; com o texto da IA, o motivo não entra (já está dito)
export function mensagemFinal(r, agora = new Date()) {
  if (!r.passar) return r.texto || 'Oi! Em que posso ajudar?';
  const passagem = textoDaPassagem({ setor: r.reclamacao ? 'financeiro' : r.setor, agora, motivo: r.texto ? '' : r.motivo, reclamacao: r.reclamacao });
  if (!r.texto) return passagem;
  return r.texto.replace(/\s+$/, '') + ' ' + passagem.replace(/^Oi! /, '');
}

// quantas respostas o robô já deu sem passar (a trava: depois de MAX_RESPOSTAS_SEM_PASSAR, passa)
export const respostasDoRobo = historico => (historico || []).filter(m => m && m.direcao === 'saida' && m.autor === 'robo').length;

// tudo junto: o histórico (com a mensagem nova) → a resposta do robô, pronta pra gravar
export async function responderComoRobo({ chamar, historico, agora = new Date(), contato = null, empresa = null, confirmado = false, dados = null }) {
  const corpo = corpoDoRobo(historico, { agora, contato, empresa, confirmado, dados });
  if (!corpo) return null;
  const json = await chamar(corpo);
  if (json && json.stop_reason === 'max_tokens') throw Object.assign(new Error('a resposta da IA veio cortada'), { tipo: 'formato' });
  const r = lerResposta(json);
  if (!r.passar && respostasDoRobo(historico) >= MAX_RESPOSTAS_SEM_PASSAR) {
    r.passar = true;
    r.resumo = r.resumo || 'O cliente seguiu conversando com o assistente sem um pedido que ele resolvesse: veja a conversa.';
  }
  const u = (json && json.usage) || {};
  return { ...r, mensagem: mensagemFinal(r, agora), modelo: (json && json._modelo) || null,
    tokens: { entrada: u.input_tokens || 0, saida: u.output_tokens || 0, cache: u.cache_read_input_tokens || 0 } };
}
