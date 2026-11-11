// ============================================================
// MACEDO & REIS — O robô do atendimento pelo WhatsApp: as regras puras, sem IA (11/11/2026, o começo da etapa 4 da fase 1;
// as etapas no Projeto, whatsapp/fase1.md; o jeito do robô em whatsapp/robo.md, com as decisões wa-01 a wa-10 de
// 06/11/2026 em whatsapp/decisoes.md).
// O que aqui não depende da IA: o horário da equipe (de segunda a sexta, das 7h30 às 17h30, sem os feriados de
// rescisao-datas.js) e quando ela volta, quem do setor recebe e como o robô fala dela ("a Thalia, do fiscal"), as frases
// da passagem pra pessoa (no horário e fora dele), o aviso dos 30 minutos sem ninguém assumir (decisão wa-09), as
// respostas de balcão aprovadas (wa-08) e a apresentação (wa-02: sem nome, "o assistente da Macedo & Reis"; wa-01: você).
// A IA (a conversa, o assunto, o resumo) entra na função whatsapp, que usa estas regras; o teste é
// tests/atendimento-robo.test.mjs.
// ============================================================
import { donoDoSetor, nomeDe } from './atendimento.js';
import { feriado } from './rescisao-datas.js';

// o Brasil não tem horário de verão desde 2019: Brasília é sempre UTC−3
const FUSO_MS = 3 * 3600e3;
export const ABRE_MIN = 7 * 60 + 30;     // 7h30
export const FECHA_MIN = 17 * 60 + 30;   // 17h30
export const SEM_RESPOSTA_MIN = 30;      // wa-09: no horário, sem ninguém assumir em 30 minutos, o robô avisa e chama de novo

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const iso = t => new Date(t).toISOString().slice(0, 10);
// o relógio de Brasília de um instante: o dia 'AAAA-MM-DD', o dia da semana e os minutos desde a meia-noite
export function emBrasilia(agora = new Date()) {
  const t = new Date(agora).getTime() - FUSO_MS;
  const d = new Date(t);
  return { dia: iso(t), semana: d.getUTCDay(), minutos: d.getUTCHours() * 60 + d.getUTCMinutes() };
}
const diaDeTrabalho = (dia, semana) => semana !== 0 && semana !== 6 && !feriado(dia);

export function dentroDoHorario(agora = new Date()) {
  const b = emBrasilia(agora);
  return diaDeTrabalho(b.dia, b.semana) && b.minutos >= ABRE_MIN && b.minutos < FECHA_MIN;
}

// quando a equipe volta: { dia, texto } — "hoje, às 7h30", "amanhã, às 7h30", "segunda, às 7h30" (até 6 dias) ou
// "segunda, 23/11, às 7h30" (mais longe, no Carnaval de sábado a quarta, por exemplo). No horário, null.
export function voltaDaEquipe(agora = new Date()) {
  if (dentroDoHorario(agora)) return null;
  const b = emBrasilia(agora);
  const base = Date.parse(b.dia + 'T00:00:00Z');
  for (let n = 0; n < 15; n++) {
    const t = base + n * 864e5, dia = iso(t), semana = new Date(t).getUTCDay();
    if (!diaDeTrabalho(dia, semana)) continue;
    if (n === 0 && b.minutos >= ABRE_MIN) continue;   // hoje já fechou
    const quando = n === 0 ? 'hoje' : n === 1 ? 'amanhã' : n <= 6 ? DIAS[semana] : `${DIAS[semana]}, ${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
    return { dia, texto: `${quando}, às 7h30` };
  }
  return null;
}

// quem recebe a conversa do setor (a fila: atendimento.js) e como o robô fala dela pro cliente
const COMO_SETOR = { fiscal: 'do fiscal', dp: 'do DP', contabil: 'da contabilidade', societario: 'do societário',
  financeiro: 'do financeiro', comercial: 'do comercial' };
const ELES = new Set(['financeiro@macedoereis.com.br', 'diego@macedoereis.com.br']);   // o Samuel e o Diego: "o", "ele"
export function quemRecebe(setor, responsavel = null) {
  const email = responsavel || donoDoSetor(setor || null);
  const ele = ELES.has(String(email).toLowerCase());
  const nome = nomeDe(email);
  const de = COMO_SETOR[setor] || '';
  return { email, nome, artigo: ele ? 'o' : 'a', pronome: ele ? 'ele' : 'ela',
    comSetor: `${ele ? 'o' : 'a'} ${nome}${de ? ', ' + de : ''}` };
}
const maiuscula = s => s.charAt(0).toUpperCase() + s.slice(1);

// a frase do robô quando passa pra pessoa: no horário, "Já passei pra Thalia, do fiscal, com a sua pergunta; ela te
// responde por aqui."; fora, "A equipe volta segunda, às 7h30 — deixei o seu recado com a Vitória. Se for …"
// motivo (opcional) vem antes, como na conversa de exemplo: "Essa a Thalia, do fiscal, responde melhor — depende …"
export function textoDaPassagem({ setor = null, responsavel = null, agora = new Date(), motivo = '', reclamacao = false } = {}) {
  const q = quemRecebe(reclamacao ? 'financeiro' : setor, reclamacao ? 'financeiro@macedoereis.com.br' : responsavel);
  const volta = voltaDaEquipe(agora);
  if (reclamacao) return volta
    ? `Desculpa a demora. A equipe volta ${volta.texto} — deixei o seu recado com o ${q.nome}, pra ver isso logo cedo.`
    : `Desculpa a demora. Já chamei o ${q.nome} pra ver isso agora, com o seu recado.`;
  if (volta) return `Oi! A equipe volta ${volta.texto} — deixei o seu recado com ${q.artigo} ${q.nome}. `
    + 'Se for boleto, guia ou formulário, te ajudo agora mesmo.';
  const prefixo = motivo ? `${maiuscula(q.comSetor)}${COMO_SETOR[setor] ? "," : ""} responde melhor — ${String(motivo).trim().replace(/[.\s]+$/, '')}. ` : '';
  const quem = prefixo ? q.pronome : `${q.nome}${COMO_SETOR[setor] ? ', ' + COMO_SETOR[setor] + ',' : ''}`;
  return `${prefixo}Já passei pr${prefixo ? 'a' : q.artigo} ${quem} com a sua pergunta; ${q.pronome} te responde por aqui.`;
}

// wa-09: a conversa na fila, sem ninguém, no horário, com a última do cliente há 30 minutos ou mais e sem o robô ter
// lembrado depois dela (o evento 'lembrou' de atend_eventos) — o robô avisa o cliente e chama o dono do setor de novo
export function precisaLembrar(conversa, eventos = [], agora = new Date()) {
  const c = conversa || {};
  if (c.situacao !== 'fila' || c.responsavel || !c.ultima_do_cliente_em) return false;
  if (!dentroDoHorario(agora)) return false;
  const desde = Date.parse(c.ultima_do_cliente_em);
  if (!(agora.getTime() - desde >= SEM_RESPOSTA_MIN * 60e3)) return false;
  return !(eventos || []).some(e => e && e.tipo === 'lembrou' && e.conversa_id === c.id && Date.parse(e.criado_em) >= desde);
}
export function textoDoLembrete(setor = null) {
  const q = quemRecebe(setor);
  return `Ainda estou te devendo a resposta: já chamei ${q.artigo} ${q.nome} de novo. Desculpa a espera.`;
}

// wa-02 e wa-01: sem nome próprio, "o assistente da Macedo & Reis", tratando por você
export const APRESENTACAO = 'Aqui é o assistente da Macedo & Reis.';
export const E_ROBO = 'Sou o assistente do escritório, sim — respondo o que está no sistema e chamo a equipe pro resto. Quer falar com alguém agora?';

// wa-08: as respostas de balcão aprovadas como estão no robo.md (o que não estiver aqui, o robô passa adiante).
// O endereço o robo.md deixou "a confirmar": fica fora até o Samuel confirmar.
const SITE = 'https://macedo-reis-contabilidade.github.io/macedo-reis-dashboards/';
export const BALCAO = {
  horario: 'A equipe atende de segunda a sexta, das 7h30 às 17h30.',
  documento: 'Pode mandar por aqui mesmo, em foto ou PDF. Eu confirmo que recebi e deixo com quem cuida.',
  prazos: 'Os prazos gerais: o DAS do Simples e o do MEI vencem no dia 20; o FGTS e o INSS da folha, também no dia 20; '
    + 'o salário, até o 5º dia útil do mês seguinte. A data certa da sua empresa, quem confirma é a equipe.',
  irpf: 'Pro Imposto de Renda, junte: os informes de rendimentos (do trabalho, dos bancos, das corretoras e da previdência '
    + 'privada); os recibos de médico, dentista, psicólogo e plano de saúde; os comprovantes de escola e faculdade; o CPF e o '
    + 'nascimento dos dependentes; os contratos e comprovantes de compra e venda de imóvel ou veículo, e de financiamentos; '
    + 'o aluguel pago ou recebido; a declaração do ano anterior; e os dados da conta pra restituição.',
  admissao: `Pra admissão, é só preencher este formulário, que pede os dados e os documentos do funcionário (dá pra fazer pelo celular): ${SITE}admissao.html`,
  rescisao: `Pra rescisão, é só preencher este formulário: ${SITE}rescisao.html`,
  proposta: `O mais rápido é responder este questionário (uns 10 minutos): ${SITE}proposta.html — com ele, o Samuel te manda a proposta.`,
};
