// ============================================================
// MACEDO & REIS — Chat da equipe (16/10/2026): a aba "Equipe" do balão do canto, no lugar do Beep
// Conversa a dois com cada um e grupos — o "Escritório", com todo mundo, já existe; qualquer um cria outros —, mensagens
// com arquivos (até 25 MB cada, na pasta privada "chat" do Supabase), quem está com o sistema aberto, o "visto" e a busca.
// O banco guarda e manda na hora (tabelas chat_*, cada um lê só as conversas de que participa; conversa e grupo nascem
// pelas funções chat_*; mensagem enviada só se apaga) — o tempo real do Supabase entrega a mensagem em todas as telas
// abertas de quem participa.
// O aviso é só no computador: um bipe curto a cada mensagem nova; com a tela do sistema na frente, o recado da carinha;
// com ela atrás (outra janela na frente, minimizada), também o aviso do Windows (a notificação do navegador), sem o som
// dele quando o bipe toca (21/10/2026: antes o aviso do Windows tomava o lugar do bipe, e no Windows que não mostra o
// aviso a mensagem chegava muda — comoAvisar). No celular, nada: só o número no balão. Com várias abas do sistema
// abertas, uma avisa (a da frente, se houver; atrás, a que pode tocar o bipe).
// Os emojis (20/10/2026): o botão da carinha ao lado do clipe abre o painel (os usados por último e os grupos); a mensagem
// só de emoji sai maior.
// A resposta (20/10/2026), como no WhatsApp: o "Responder" da mensagem põe a barra "Respondendo a…" em cima da caixa; a
// mensagem enviada leva a citação (chat_mensagens.responde_a, só da mesma conversa — o banco confere), com quem e o trecho,
// e clicar nela leva até a original (as páginas anteriores até ela); Esc ou o ✕ desiste.
// Os avisos do sistema (20/10/2026, pedido do Samuel: "sendo poucas coisas, as que interessam mesmo, e podendo silenciar"):
// a conversa "Avisos do sistema" de cada um (um grupo só dele, chave 'avisos|<e-mail>', que o banco cria no primeiro aviso)
// recebe a admissão e a rescisão que chegam pelo link, a proposta do formulário e a tarefa que alguém passa pra pessoa —
// quem escreve é o banco (autor "sistema", com o botão que abre a tela da coisa, chat_mensagens.acao); ela só lê, e avisa
// como qualquer conversa (silenciar é o de sempre).
// Os auxiliares puros têm teste em tests/chat-equipe.test.mjs; a tela, em tests/harness/chat-equipe.py e
// tests/harness/chat-avisos.py.
// ============================================================

import { nomePorEmail } from './equipe.js';
import { escapeHtml } from './assistente.js';

// ---------- auxiliares puros ----------
export const LIMITE_ARQUIVO = 25 * 1024 * 1024;   // o mesmo limite da pasta "chat" no Supabase
export const MAX_ARQUIVOS = 10;                    // por mensagem (a regra do banco)
export const MAX_TEXTO = 4000;
const pad = n => String(n).padStart(2, '0');
const semAcento = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '');
export const normal = s => semAcento(s).toLowerCase().replace(/\s+/g, ' ').trim();

// a raiz do site (as telas do sistema): o botão do aviso abre a tela a partir dela, de qualquer tela (as de clientes/ também)
const RAIZ = (() => { try { return new URL('../../', import.meta.url).href; } catch (e) { return '/'; } })();

// ---------- os avisos do sistema (20/10/2026) ----------
export const TITULO_AVISOS = 'Avisos do sistema';
export const AUTOR_SISTEMA = 'sistema';
// a conversa de avisos de cada um: um grupo só dele, com a chave 'avisos|<e-mail>' (como o 'escritorio' é o de todos)
export const ehAvisos = c => !!c && String(c.chave || '').startsWith('avisos|');
// o botão do aviso → { rotulo, href } | null: só uma tela do sistema (o caminho relativo, como "dp-admissoes.html?admissao=…",
// que fica dentro do site — endereço de fora, "javascript:" ou "../" não viram botão) e só na mensagem do sistema
const LINK_DO_SISTEMA = /^[a-z0-9-]+(?:\/[a-z0-9-]+)?\.html(?:\?[A-Za-z0-9_=&%.-]*)?(?:#[A-Za-z0-9_-]*)?$/;
export function acaoDoAviso(m, raiz = RAIZ) {
  const a = m && m.autor === AUTOR_SISTEMA && !m.apagada_em ? m.acao : null;
  if (!a || typeof a !== 'object' || Array.isArray(a)) return null;
  const link = String(a.link || '');
  if (!LINK_DO_SISTEMA.test(link)) return null;
  let base, url;
  try { base = new URL(raiz); url = new URL(link, base); } catch (e) { return null; }
  if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) return null;
  const rotulo = String(a.rotulo || '').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Abrir';
  return { rotulo, href: url.href };
}

// o nome de quem tem login: o da equipe (assets/js/equipe.js) ou, sem ele, o começo do e-mail; o autor dos avisos, "Sistema"
export function nomeDe(email) {
  if (String(email || '').toLowerCase() === AUTOR_SISTEMA) return 'Sistema';
  const n = nomePorEmail(email);
  if (n) return n;
  const p = String(email || '').split('@')[0].replace(/[._-]+/g, ' ').trim();
  return p ? p.replace(/\b\w/g, c => c.toUpperCase()) : 'Alguém';
}
export function iniciais(nome) {
  const ps = semAcento(nome).replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  if (!ps.length) return '?';
  return (ps.length === 1 ? ps[0].slice(0, 2) : ps[0][0] + ps[ps.length - 1][0]).toUpperCase();
}
// na conversa a dois, o outro
export const outroDa = (c, eu) => (c && c.tipo === 'direta' ? (c.membros || []).find(e => e !== eu) || null : null);
export function tituloDaConversa(c, eu) {
  if (!c) return '';
  if (ehAvisos(c)) return TITULO_AVISOS;
  if (c.tipo === 'direta') { const o = outroDa(c, eu); return o ? nomeDe(o) : 'Conversa'; }
  return c.titulo || 'Grupo';
}
// a última mensagem, na linha da lista (nos avisos, sem "Sistema:" na frente)
export function previaDaUltima(c, eu) {
  if (!c || !c.ultima_autor) return c && c.chave === 'escritorio' ? 'O grupo de todo o escritório' : ehAvisos(c) ? 'Nenhum aviso ainda' : 'Sem mensagens ainda';
  const quem = c.ultima_autor === eu ? 'Você: ' : c.tipo === 'grupo' && !ehAvisos(c) ? nomeDe(c.ultima_autor) + ': ' : '';
  if (c.ultima_apagada) return quem + 'mensagem apagada';
  const t = String(c.ultima_texto || '').replace(/\s+/g, ' ').trim();
  if (t) return quem + t;
  return quem + (c.ultima_anexos > 1 ? c.ultima_anexos + ' arquivos' : 'arquivo');
}
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
// a hora na lista: hoje, a hora; ontem; nesta semana, o dia; antes, a data
export function horaDaLista(iso, agora = new Date()) {
  const d = new Date(iso);
  if (!iso || isNaN(d)) return '';
  const hoje = ymd(agora), dia = ymd(d);
  if (dia === hoje) return pad(d.getHours()) + ':' + pad(d.getMinutes());
  const ontem = new Date(agora); ontem.setDate(ontem.getDate() - 1);
  if (dia === ymd(ontem)) return 'ontem';
  const dias = Math.round((new Date(hoje + 'T12:00:00') - new Date(dia + 'T12:00:00')) / 864e5);
  if (dias > 0 && dias < 7) return SEMANA[d.getDay()];
  return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear();
}
export const horaCurta = iso => { const d = new Date(iso); return isNaN(d) ? '' : pad(d.getHours()) + ':' + pad(d.getMinutes()); };
// o separador do dia na conversa
export function rotuloDoDia(iso, agora = new Date()) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const hoje = ymd(agora), dia = ymd(d);
  if (dia === hoje) return 'Hoje';
  const ontem = new Date(agora); ontem.setDate(ontem.getDate() - 1);
  if (dia === ymd(ontem)) return 'Ontem';
  return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear();
}
// os endereços da mensagem viram link (o texto chega escapado; só http e https)
export function linkificar(escapado) {
  return String(escapado || '').replace(/\bhttps?:\/\/[^\s<>"']+/g, url => {
    const limpo = url.replace(/[.,;:!?)]+$/, ''), resto = url.slice(limpo.length);
    return '<a href="' + limpo + '" target="_blank" rel="noopener noreferrer">' + limpo + '</a>' + resto;
  });
}
export function tamanhoBR(n) {
  const v = Number(n);
  if (n == null || !Number.isFinite(v) || v < 0) return '';
  if (v < 1024) return v + ' bytes';
  if (v < 1024 * 1024) return Math.max(1, Math.round(v / 1024)) + ' KB';
  return (v / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' MB';
}
// o nome do arquivo na pasta (sem acento e sem caractere que o Storage recusa); o nome de verdade vai na mensagem
export function nomeSeguro(nome) {
  const s = semAcento(String(nome || 'arquivo')).replace(/[\/\\]+/g, '_').replace(/[^A-Za-z0-9._ ()-]+/g, '_').replace(/\s+/g, ' ').trim();
  const ponto = s.lastIndexOf('.');
  const ext = ponto > 0 && s.length - ponto <= 12 ? s.slice(ponto) : '';
  const base = (ext ? s.slice(0, ponto) : s).replace(/^[.\s]+/, '').slice(0, 100) || 'arquivo';
  return base + ext;
}
// a pasta do arquivo: a da conversa (a regra do Storage confere quem participa), a da mensagem e o nome
export const caminhoDoArquivo = (conversaId, mensagemId, nome) => conversaId + '/' + mensagemId + '/' + nomeSeguro(nome);
// os arquivos escolhidos: até 25 MB cada, no máximo 10 por mensagem (com os que já estão esperando)
export function conferirArquivos(novos, jaTem = 0) {
  const ok = [], recusados = [];
  [...(novos || [])].forEach(f => {
    if (!f) return;
    if (!(f.size > 0)) recusados.push({ nome: f.name || 'arquivo', motivo: 'está vazio' });
    else if (f.size > LIMITE_ARQUIVO) recusados.push({ nome: f.name || 'arquivo', motivo: 'passa de 25 MB' });
    else if (jaTem + ok.length >= MAX_ARQUIVOS) recusados.push({ nome: f.name || 'arquivo', motivo: 'passa de 10 arquivos por mensagem' });
    else ok.push(f);
  });
  return { ok, recusados };
}
export const ehImagem = tipo => /^image\/(png|jpe?g|gif|webp)$/i.test(String(tipo || ''));
// o link do Drive (19/10/2026: o arquivo que o assistente manda pelo chat fica no Drive; a mensagem leva o link): só
// endereço do Google Drive ou Docs, https, sem usuário e porta — o resto não vira link. O cartão dos arquivos do
// assistente usa o mesmo (assets/js/assistente-acoes.js)
export function linkDoDrive(link) {
  try {
    const u = new URL(String(link || ''));
    return u.protocol === 'https:' && ['drive.google.com', 'docs.google.com'].includes(u.hostname) && !u.username && !u.password && !u.port ? u.href : null;
  } catch (e) { return null; }
}
// a lista: as conversas pela última mensagem; quem ainda não tem conversa a dois comigo vem depois, em ordem de nome
export function linhasDaLista(convs, pessoas, eu) {
  const lista = [...(convs || [])].sort((a, b) => String(b.ultima_em || '').localeCompare(String(a.ultima_em || '')));
  const comConversa = new Set(lista.filter(c => c.tipo === 'direta').map(c => outroDa(c, eu)).filter(Boolean));
  const sem = (pessoas || []).filter(e => e && e !== eu && !comConversa.has(e)).map(e => ({ pessoa: e, nome: nomeDe(e) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return [...lista.map(c => ({ conversa: c })), ...sem];
}
// quem já leu a mensagem (o "visto"): quem participa, menos quem mandou
export function vistoPor(msg, membros) {
  if (!msg || !msg.criada_em) return [];
  const t = new Date(msg.criada_em).getTime();
  return (membros || []).filter(m => m && m.email !== msg.autor && m.lido_ate && new Date(m.lido_ate).getTime() >= t).map(m => m.email);
}
export function textoDoVisto(msg, membros, conversa) {
  const quem = vistoPor(msg, membros);
  if (!quem.length) return '';
  if (conversa && conversa.tipo === 'direta') return 'Visto';
  const outros = (membros || []).filter(m => m.email !== msg.autor).length;
  if (quem.length >= outros) return 'Visto por todos';
  const nomes = quem.map(nomeDe);
  return 'Visto por ' + (nomes.length === 1 ? nomes[0] : nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1]);
}
// o total do balão: as não lidas das conversas que não estão silenciadas
export const naoLidasTotal = convs => [...(convs || [])].reduce((n, c) => n + (c && !c.silenciada ? Math.max(0, c.nao_lidas || 0) : 0), 0);
// celular ou tablet: sem aviso nenhum (o aviso é só no computador)
export function ehCelular(nav = typeof navigator !== 'undefined' ? navigator : null, mm = typeof matchMedia === 'function' ? matchMedia : null) {
  const ua = String((nav && nav.userAgent) || '');
  if (/Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(ua)) return true;
  if (nav && nav.userAgentData && nav.userAgentData.mobile) return true;
  try { return !!(mm && mm('(pointer: coarse)').matches && !mm('(pointer: fine)').matches); } catch (e) { return false; }
}
// como avisar a mensagem que ninguém está vendo (21/10/2026): o bipe sempre, com a tela na frente ou atrás; na frente, o
// recado da carinha; atrás, com os avisos ligados, o aviso do Windows junto — sem o som dele quando o bipe vai tocar. Antes,
// atrás, o aviso do Windows tomava o lugar do bipe, e no escritório o Windows não mostrava o aviso: a mensagem chegava
// muda. Sem o som pronto (a tela ainda sem clique nem tecla, e o navegador não deixa tocar), o aviso do Windows leva o som
// dele. No celular, nem bipe nem aviso do Windows
export function comoAvisar({ frente = false, celular = false, somLigado = true, somPronto = false, podeNotificar = false } = {}) {
  if (celular) return { bipe: false, recado: !!frente, notificacao: false, semSom: false };
  const bipe = !!somLigado;
  return { bipe, recado: !!frente, notificacao: !frente && !!podeNotificar, semSom: bipe && !!somPronto };
}
// quanto cada aba espera antes de avisar (uma aba só avisa cada mensagem): a da frente, nada; atrás, a que pode tocar o
// bipe vem antes da que não pode — e um tanto ao acaso, pras abas não empatarem
export const esperaDoAviso = ({ frente = false, somPronto = false, sorte = Math.random() } = {}) =>
  frente ? 0 : (somPronto ? 350 : 1600) + Math.floor(Math.max(0, Math.min(1, Number(sorte) || 0)) * 250);
// a mensagem na notificação: quem e o começo do texto (ou o arquivo)
export function textoDoAviso(c, m, eu) {
  const quem = nomeDe(m && m.autor);
  const corpo = m && m.texto ? String(m.texto).replace(/\s+/g, ' ').trim().slice(0, 140)
    : m && Array.isArray(m.anexos) && m.anexos.length ? 'Arquivo: ' + (m.anexos[0].nome || 'arquivo') + (m.anexos.length > 1 ? ' e mais ' + (m.anexos.length - 1) : '') : 'Mensagem nova';
  if (ehAvisos(c)) return { titulo: TITULO_AVISOS, corpo, quem };
  if (c && c.tipo === 'grupo') return { titulo: tituloDaConversa(c, eu), corpo: quem + ': ' + corpo, quem };
  return { titulo: quem, corpo, quem };
}
// a resposta (20/10/2026, pedido do Samuel: "marcar o que a pessoa falou no chat e responder, estilo whats"): o trecho da
// mensagem citada — o texto numa linha só, até MAX_TRECHO caracteres; sem texto, o arquivo pelo nome; a apagada; e a que
// ainda não chegou na tela (ausente)
export const MAX_TRECHO = 120;
export function trechoDaCitada(m) {
  if (!m) return { texto: 'Mensagem anterior', apagada: false, ausente: true };
  if (m.apagada_em) return { texto: 'Mensagem apagada', apagada: true, ausente: false };
  const t = [...String(m.texto || '').replace(/\s+/g, ' ').trim()];
  if (t.length) return { texto: t.length > MAX_TRECHO ? t.slice(0, MAX_TRECHO - 1).join('').trimEnd() + '…' : t.join(''), apagada: false, ausente: false };
  const arqs = (Array.isArray(m.anexos) ? m.anexos : []).filter(a => a && typeof a === 'object' && a.nome);
  if (!arqs.length) return { texto: 'Mensagem', apagada: false, ausente: false };
  return { texto: arqs.length > 1 ? arqs.length + ' arquivos' : (ehImagem(arqs[0].tipo) ? 'Imagem: ' : 'Arquivo: ') + arqs[0].nome, apagada: false, ausente: false };
}
// quem escreveu a citada: "Você" na minha
export const quemDaCitada = (m, eu) => (!m ? '' : String(m.autor || '').toLowerCase() === String(eu || '').toLowerCase() ? 'Você' : nomeDe(m.autor));

// ---------- mandar e apagar: a regra do chat, a da tela e a do cartão do assistente (assets/js/assistente-acoes.js) ----------
const COLUNAS_MSG = 'id, conversa_id, autor, texto, anexos, criada_em, apagada_em, responde_a, acao';
// enviarMensagem(sb, { id, conversaId, texto, anexos, respondeA }) → { mensagem } | { erro }: com o id gerado na tela —
// mandar de novo com o mesmo id não duplica (23505 = já tinha entrado: lê de volta). Quem manda e quando, o banco põe;
// respondeA = a mensagem citada (o banco só aceita uma da mesma conversa: outra, a resposta vai sem a citação)
export async function enviarMensagem(sb, { id, conversaId, texto = null, anexos = [], respondeA = null } = {}) {
  const an = Array.isArray(anexos) ? anexos.slice(0, MAX_ARQUIVOS) : [];
  const t = texto ? String(texto).slice(0, MAX_TEXTO) : null;
  if (!id || !conversaId) return { erro: 'Mensagem sem conversa.' };
  if (!t && !an.length) return { erro: 'Mensagem vazia.' };
  const linha = { id, conversa_id: conversaId, texto: t, anexos: an };
  if (respondeA) linha.responde_a = String(respondeA);
  let { data, error } = await sb.from('chat_mensagens').insert(linha).select(COLUNAS_MSG).single();
  if (error && error.code === '23505') ({ data, error } = await sb.from('chat_mensagens').select(COLUNAS_MSG).eq('id', id).single());
  if (error || !data) return { erro: 'A mensagem não foi.' };
  return { mensagem: data };
}
// apagarMensagem(sb, id, eu) → { mensagem } | { erro }: só a própria; o banco tira o texto e os arquivos da mensagem (os da
// pasta "chat", quem chama tira antes; o link do Drive aponta pro arquivo, que fica lá)
export async function apagarMensagem(sb, id, eu) {
  const { data, error } = await sb.from('chat_mensagens').update({ apagada_em: new Date().toISOString() }).eq('id', id).eq('autor', eu).select(COLUNAS_MSG).single();
  if (error || !data) return { erro: 'Não consegui apagar agora.' };
  return { mensagem: data };
}
// conversaDe(sb, destino, eu) → { id, nome } | { erro }: pra onde vai — { email } (a conversa a dois, que nasce se não
// existe), { grupo: 'escritorio' } (o grupo de todos) ou { grupo: nome } (entre os grupos de quem está na tela; sem grupo
// com esse nome, a pessoa do chat com esse nome)
export async function conversaDe(sb, destino, eu) {
  const d = destino || {};
  if (d.email) {
    const email = String(d.email).toLowerCase();
    if (email === String(eu || '').toLowerCase()) return { erro: 'não dá pra mandar pra você mesmo' };
    const { data, error } = await sb.rpc('chat_abrir_direta', { outro: email });
    if (error || !data) return { erro: /login/i.test(String((error && error.message) || '')) ? nomeDe(email) + ' não tem login no sistema' : 'não consegui abrir a conversa' };
    return { id: String(data), nome: nomeDe(email) };
  }
  const g = normal(d.grupo);
  if (!g) return { erro: 'sem destino' };
  if (g === 'escritorio') { try { await sb.rpc('chat_preparar'); } catch (e) { /* o grupo de todos já existe */ } }
  const { data, error } = await sb.rpc('chat_resumo');
  if (error) return { erro: 'não consegui ler as conversas' };
  const grupos = (data || []).filter(c => c && c.tipo === 'grupo' && !ehAvisos(c));   // a de avisos é só pra ler
  const parecidos = grupos.filter(c => normal(c.titulo).includes(g));
  const achado = g === 'escritorio' ? grupos.find(c => c.chave === 'escritorio') : grupos.find(c => normal(c.titulo) === g) || (parecidos.length === 1 ? parecidos[0] : null);
  if (achado) return { id: String(achado.conversa_id), nome: achado.chave === 'escritorio' ? 'Escritório' : achado.titulo || 'Grupo' };
  // não é grupo: alguém do chat com esse nome
  const { data: pessoas } = await sb.rpc('chat_pessoas');
  const p = (Array.isArray(pessoas) ? pessoas : []).map(x => (typeof x === 'string' ? x : x && x.email)).filter(Boolean).find(e => normal(nomeDe(e)) === g);
  if (p) return conversaDe(sb, { email: p }, eu);
  return { erro: 'você não está em nenhum grupo chamado "' + String(d.grupo).slice(0, 80) + '"' };
}

// ---------- os emojis (20/10/2026, pedido do Samuel) ----------
// O painel da caixa de mensagem: os grupos, cada emoji com o nome em português (o leitor de tela lê e a dica mostra). Sem
// fonte de fora: sai o emoji do sistema (no Windows, o Segoe UI Emoji) — por isso nada além do Emoji 12 (2019); os mais
// novos virariam um quadradinho nos computadores mais antigos
export const EMOJIS = [
  { id: 'carinhas', nome: 'Carinhas', icone: '😀', itens: [['😀', 'sorriso'], ['😃', 'sorrisão'], ['😄', 'rindo'], ['😁', 'sorriso largo'], ['😆', 'gargalhada'],
    ['😅', 'riso nervoso'], ['😂', 'chorando de rir'], ['🤣', 'rolando de rir'], ['🙂', 'sorrisinho'], ['😉', 'piscadinha'], ['😊', 'feliz'], ['😇', 'anjinho'],
    ['🥰', 'apaixonado'], ['😍', 'olhos de coração'], ['😘', 'beijo'], ['😋', 'delícia'], ['😛', 'língua de fora'], ['😜', 'brincadeira'], ['🤪', 'maluquinho'],
    ['😎', 'de óculos escuros'], ['🤩', 'maravilhado'], ['🥳', 'comemorando'], ['🤗', 'abraço'], ['🤭', 'risadinha'], ['🤫', 'segredo'], ['🤔', 'pensando'],
    ['🧐', 'analisando'], ['🤨', 'desconfiado'], ['😐', 'sem expressão'], ['😑', 'sem paciência'], ['🙄', 'revirando os olhos'], ['😏', 'sorriso de lado'],
    ['😬', 'eita'], ['😌', 'aliviado'], ['😴', 'com sono'], ['🤯', 'cabeça explodindo'], ['😮', 'surpreso'], ['😱', 'apavorado'], ['😳', 'envergonhado'],
    ['🥺', 'por favor'], ['😢', 'triste'], ['😭', 'chorando'], ['😤', 'bufando'], ['😡', 'bravo'], ['🤐', 'boca fechada'], ['🤓', 'nerd']] },
  { id: 'gestos', nome: 'Gestos', icone: '👍', itens: [['👍', 'joinha'], ['👎', 'não curti'], ['👌', 'certinho'], ['✌️', 'paz'], ['🤞', 'dedos cruzados'],
    ['🤟', 'te amo'], ['🤙', 'me liga'], ['👏', 'palmas'], ['🙌', 'mãos pro alto'], ['🤝', 'aperto de mão'], ['🙏', 'obrigado'], ['💪', 'força'], ['👋', 'tchau'],
    ['✋', 'mão levantada'], ['👊', 'soquinho'], ['✍️', 'escrevendo'], ['👀', 'olhando'], ['👉', 'olha isso'], ['👆', 'aqui em cima'], ['👇', 'aqui embaixo'],
    ['🙋', 'eu'], ['🤷', 'sei lá'], ['🤦', 'mão na testa'], ['🙆', 'tudo certo'], ['🙅', 'não'], ['💁', 'informação']] },
  { id: 'trabalho', nome: 'Trabalho', icone: '💼', itens: [['💼', 'maleta'], ['📁', 'pasta'], ['📂', 'pasta aberta'], ['🗂️', 'fichário'], ['📄', 'documento'],
    ['📑', 'páginas'], ['📋', 'prancheta'], ['🧾', 'recibo'], ['📝', 'anotação'], ['✏️', 'lápis'], ['🖊️', 'caneta'], ['📌', 'alfinete'], ['📎', 'clipe'],
    ['📅', 'calendário'], ['🗓️', 'agenda'], ['⏰', 'despertador'], ['⏳', 'ampulheta'], ['⌛', 'prazo'], ['💻', 'notebook'], ['🖥️', 'computador'],
    ['🖨️', 'impressora'], ['📞', 'telefone'], ['📱', 'celular'], ['📧', 'e-mail'], ['📨', 'mensagem chegando'], ['📤', 'enviado'], ['📥', 'recebido'],
    ['📦', 'caixa'], ['💰', 'dinheiro'], ['💸', 'dinheiro voando'], ['💳', 'cartão'], ['🏦', 'banco'], ['🧮', 'ábaco'], ['📈', 'subiu'], ['📉', 'caiu'],
    ['📊', 'gráfico'], ['🔒', 'cadeado'], ['🔑', 'chave'], ['🏢', 'empresa'], ['☕', 'café']] },
  { id: 'simbolos', nome: 'Símbolos', icone: '✅', itens: [['✅', 'feito'], ['☑️', 'marcado'], ['✔️', 'certo'], ['❌', 'errado'], ['⚠️', 'atenção'],
    ['❗', 'importante'], ['❓', 'dúvida'], ['‼️', 'urgente'], ['⭐', 'estrela'], ['🌟', 'brilhando'], ['✨', 'brilho'], ['🔥', 'pegando fogo'], ['⚡', 'rápido'],
    ['💡', 'ideia'], ['🎯', 'no alvo'], ['🚀', 'foguete'], ['🔄', 'de novo'], ['⬆️', 'pra cima'], ['⬇️', 'pra baixo'], ['➡️', 'pra frente'], ['🔴', 'vermelho'],
    ['🔵', 'azul'], ['🆗', 'ok'], ['🆕', 'novo'], ['💯', 'cem por cento'], ['❤️', 'coração'], ['💙', 'coração azul'], ['💚', 'coração verde'],
    ['💛', 'coração amarelo'], ['💜', 'coração roxo'], ['🖤', 'coração preto'], ['💔', 'coração partido']] },
  { id: 'festa', nome: 'Festa e lazer', icone: '🎉', itens: [['🎉', 'festa'], ['🎊', 'confete'], ['🎂', 'bolo de aniversário'], ['🍰', 'fatia de bolo'],
    ['🎁', 'presente'], ['🎈', 'balão'], ['🍾', 'champanhe'], ['🥂', 'brinde'], ['🍻', 'cerveja'], ['🧉', 'chimarrão'], ['🍕', 'pizza'], ['🍔', 'hambúrguer'],
    ['🥩', 'churrasco'], ['🍫', 'chocolate'], ['🍩', 'rosquinha'], ['☀️', 'sol'], ['🌧️', 'chuva'], ['❄️', 'frio'], ['⚽', 'futebol'], ['🏆', 'troféu'],
    ['🥇', 'medalha'], ['👑', 'coroa'], ['🌷', 'flor'], ['🌻', 'girassol'], ['🐶', 'cachorro'], ['🐱', 'gato'], ['🎶', 'música'], ['🏖️', 'praia'], ['✈️', 'viagem']] }
];
const NOME_DO_EMOJI = new Map(EMOJIS.flatMap(g => g.itens));
export const nomeDoEmoji = e => NOME_DO_EMOJI.get(e) || '';
export const MAX_RECENTES = 16;
// os usados por último (o mais recente primeiro, sem repetir)
export const recentesCom = (lista, emoji, max = MAX_RECENTES) => [emoji, ...(Array.isArray(lista) ? lista : []).filter(e => e !== emoji)].slice(0, max);
// o que estava guardado no navegador: só texto curto, sem repetir — o resto (guardado errado, outro formato) fica de fora
export function lerRecentes(guardado, max = MAX_RECENTES) {
  let l;
  try { l = JSON.parse(guardado || '[]'); } catch (e) { return []; }
  if (!Array.isArray(l)) return [];
  return [...new Set(l.filter(e => typeof e === 'string' && e.length > 0 && e.length <= 16 && soEmojis(e, 1)))].slice(0, max);
}
// o emoji no lugar do cursor (ou da seleção) → { valor, cursor } — null se passar do limite da mensagem
export function inserirNoTexto(valor, ini, fim, emoji, max = MAX_TEXTO) {
  const v = String(valor == null ? '' : valor);
  const a = Math.max(0, Math.min(Number.isInteger(ini) ? ini : v.length, v.length)), b = Math.max(a, Math.min(Number.isInteger(fim) ? fim : a, v.length));
  const novo = v.slice(0, a) + emoji + v.slice(b);
  if (novo.length > max) return null;
  return { valor: novo, cursor: a + emoji.length };
}
// a mensagem é só emoji (até max, como no WhatsApp): sai maior, sem o balão. A pessoa com tom de pele, a família (o ZWJ) e a
// bandeira contam como um
export function soEmojis(texto, max = 3) {
  const t = String(texto == null ? '' : texto).replace(/\s+/g, '');
  if (!t || t.length > 40) return false;
  if (!/^(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator}|[\u200d\ufe0f\u20e3])+$/u.test(t) || !/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(t)) return false;
  let n;
  try { n = [...new Intl.Segmenter('pt', { granularity: 'grapheme' }).segment(t)].length; }
  catch (e) { n = (t.match(/\p{Extended_Pictographic}(?!\u200d)/gu) || []).length; }
  return n >= 1 && n <= max;
}

// ---------- os ícones (traço, como os do balão) ----------
const SVG = d => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + d + '</svg>';
const ICONE = {
  voltar: SVG('<path d="M15 18l-6-6 6-6"/>'),
  clipe: SVG('<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>'),
  carinha: SVG('<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/>'),
  enviar: SVG('<path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>'),
  mais: SVG('<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>'),
  sino: SVG('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>'),
  sinoMudo: SVG('<path d="M13.73 21a2 2 0 0 1-3.46 0M18.63 13A17.89 17.89 0 0 1 18 8M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14M18 8a6 6 0 0 0-9.33-5M1 1l22 22"/>'),
  grupo: SVG('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>'),
  arquivo: SVG('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>'),
  x: SVG('<path d="M18 6L6 18M6 6l12 12"/>'),
  predio: SVG('<path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h1M14 9h1M9 13h1M14 13h1M9 17h1M14 17h1"/>')
};

// ============================================================
// montarChatEquipe({ supabase, email, el, ctl }) — monta a aba no lugar dela (el) e devolve o que o painel chama:
// { aoMostrar({ foco }), aoEsconder(), status() }. ctl vem do balão (assets/js/assistente.js): ativa(), mostrar(),
// contador(n), status(), avisar(msg), anunciar(t), largo()
// ============================================================
export function montarChatEquipe({ supabase, email, el, ctl }) {
  const eu = String(email || '').toLowerCase();
  const celular = ehCelular();
  const chaveAba = 'mr_chat:' + eu;
  const lerAba = () => { try { return JSON.parse(sessionStorage.getItem(chaveAba) || 'null') || {}; } catch (e) { return {}; } };
  const guardarAba = () => { try { sessionStorage.setItem(chaveAba, JSON.stringify({ aberta: st.aberta, vista: st.vista })); } catch (e) { /* sem armazenamento */ } };
  const salvo = lerAba();
  const st = {
    convs: new Map(), pessoas: [], online: new Set(), aberta: typeof salvo.aberta === 'string' ? salvo.aberta : null,
    vista: ['lista', 'conversa', 'novo', 'grupo'].includes(salvo.vista) ? salvo.vista : 'lista',
    msgs: [], membros: [], temAntigas: false, carregando: false, pendentes: [], busca: '', achadas: null, lidoAoAbrir: null,
    pronto: false, erro: '', caiu: false, confirmarApagar: null, menu: false, emojis: false, abaEmoji: null, respondendo: null
  };
  const urls = new Map();   // os links assinados dos arquivos (valem 1 hora)
  const citadas = new Map();   // as mensagens citadas que não estão na página aberta (null = não achou)
  const avisa = (nome, detail) => { try { window.dispatchEvent(new CustomEvent(nome, { detail })); } catch (e) { /* fora do navegador */ } };
  const espera = ms => new Promise(r => setTimeout(r, ms));
  const novoId = () => (crypto && crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16)));

  // ---------- o lugar ----------
  el.classList.add('ch-raiz');
  el.innerHTML =
    '<div class="ch-col ch-col-lista">'
    + '<div class="ch-ativar" hidden><p>Quer o aviso do Windows quando chegar mensagem da equipe com o sistema atrás de outra janela?</p>'
    + '<div class="ch-ativar-botoes"><button type="button" class="as-botao as-botao-pri" data-ch="ativar">Ativar avisos</button><button type="button" class="as-botao as-botao-link" data-ch="agora-nao">Agora não</button></div></div>'
    + '<div class="ch-busca"><input type="search" maxlength="80" placeholder="Buscar pessoa, grupo ou mensagem" aria-label="Buscar pessoa, grupo ou mensagem"></div>'
    + '<div class="ch-rolar ch-rolar-lista"><ul class="ch-conversas"></ul><div class="ch-achadas" hidden></div></div>'
    + '<div class="ch-rodape"><button type="button" class="ch-rodape-btn" data-ch="novo-grupo">' + ICONE.grupo + '<span>Novo grupo</span></button>'
    + '<button type="button" class="ch-rodape-btn" data-ch="avisos">' + ICONE.sino + '<span class="ch-avisos-txt"></span></button></div>'
    + '</div>'
    + '<div class="ch-col ch-col-conversa">'
    + '<div class="ch-vazio-dir"><p>Escolha uma conversa ao lado.</p></div>'
    + '<div class="ch-vista ch-v-conversa" hidden>'
    + '<div class="ch-cab"><button type="button" class="ch-icone ch-voltar" data-ch="voltar" aria-label="Voltar às conversas" title="Voltar às conversas">' + ICONE.voltar + '</button>'
    + '<div class="ch-cab-quem"><b></b><small></small></div>'
    + '<div class="ch-menu-lugar"><button type="button" class="ch-icone" data-ch="menu" aria-haspopup="true" aria-expanded="false" aria-label="Mais opções da conversa" title="Mais opções">' + ICONE.mais + '</button>'
    + '<div class="ch-menu" hidden></div></div></div>'
    + '<div class="ch-rolar ch-msgs" role="log" aria-live="off" aria-label="Mensagens"></div>'
    + '<div class="ch-pendentes" hidden></div>'
    + '<div class="ch-erro" role="alert" hidden></div>'
    + '<div class="ch-respondendo" hidden></div>'
    + '<form class="ch-entrada"><div class="ch-emojis" role="dialog" aria-label="Emojis" hidden></div>'
    + '<label class="ch-icone ch-clipe" title="Anexar arquivo (até 25 MB cada)"><input type="file" multiple hidden aria-label="Anexar arquivo">' + ICONE.clipe + '</label>'
    + '<button type="button" class="ch-icone ch-emoji-btn" data-ch="emojis" aria-haspopup="dialog" aria-expanded="false" aria-label="Emojis" title="Emojis">' + ICONE.carinha + '</button>'
    + '<textarea rows="1" maxlength="' + MAX_TEXTO + '" data-no-autogrow placeholder="Escreva uma mensagem…" aria-label="Mensagem" title="Enter envia; Shift+Enter quebra a linha"></textarea>'
    + '<button type="submit" class="as-enviar ch-enviar" aria-label="Enviar">' + ICONE.enviar + '</button></form>'
    + '<div class="ch-so-ler" hidden>' + ICONE.sino + '<span>Aqui chegam os avisos do sistema pra você; não dá pra responder. Pra ficar sem o bipe e o aviso do Windows, silencie no menu ⋯ do alto.</span></div>'
    + '</div>'
    + '<div class="ch-vista ch-v-novo" hidden>'
    + '<div class="ch-cab"><button type="button" class="ch-icone ch-voltar" data-ch="voltar" aria-label="Voltar às conversas" title="Voltar">' + ICONE.voltar + '</button><div class="ch-cab-quem"><b>Novo grupo</b><small>O nome e quem entra</small></div></div>'
    + '<div class="ch-rolar ch-form"><label class="ch-campo">Nome do grupo<input type="text" maxlength="60" data-ch="nome-grupo" placeholder="Ex.: Fiscal e DP"></label>'
    + '<fieldset class="ch-quem"><legend>Quem entra</legend><div class="ch-quem-lista"></div></fieldset>'
    + '<div class="ch-form-botoes"><button type="button" class="as-botao as-botao-pri" data-ch="criar-grupo">Criar grupo</button></div><div class="ch-erro" role="alert" hidden></div></div>'
    + '</div>'
    + '<div class="ch-vista ch-v-grupo" hidden>'
    + '<div class="ch-cab"><button type="button" class="ch-icone ch-voltar" data-ch="voltar-conversa" aria-label="Voltar à conversa" title="Voltar à conversa">' + ICONE.voltar + '</button><div class="ch-cab-quem"><b></b><small></small></div></div>'
    + '<div class="ch-rolar ch-form ch-grupo-corpo"></div>'
    + '</div>'
    + '</div>';
  const q = s => el.querySelector(s);
  const colLista = q('.ch-col-lista'), colConversa = q('.ch-col-conversa');
  const ul = q('.ch-conversas'), achadasEl = q('.ch-achadas'), busca = q('.ch-busca input'), ativarEl = q('.ch-ativar');
  const vConversa = q('.ch-v-conversa'), vNovo = q('.ch-v-novo'), vGrupo = q('.ch-v-grupo'), vazioDir = q('.ch-vazio-dir');
  const msgsEl = q('.ch-msgs'), ta = q('.ch-entrada textarea'), arquivoInput = q('.ch-clipe input'), pendEl = q('.ch-pendentes'), erroEl = q('.ch-v-conversa .ch-erro');
  const cabNome = q('.ch-v-conversa .ch-cab-quem b'), cabSub = q('.ch-v-conversa .ch-cab-quem small'), menuBtn = q('[data-ch="menu"]'), menuEl = q('.ch-menu');
  const emojiBtn = q('[data-ch="emojis"]'), emojisEl = q('.ch-emojis'), respEl = q('.ch-respondendo');
  const formEl = q('.ch-entrada'), soLerEl = q('.ch-so-ler');
  if (celular) q('[data-ch="avisos"]').hidden = true;
  // a conversa de avisos é só pra ler: no lugar da caixa, a nota
  const soLer = () => ehAvisos(conv(st.aberta));
  function aplicarSoLer() {
    const so = soLer();
    formEl.hidden = so; soLerEl.hidden = !so;
    if (so) { pendEl.hidden = true; respEl.hidden = true; fecharEmojis(); }
  }

  // duas colunas com o painel aumentado (a lista ao lado da conversa); uma só no painel pequeno e no celular
  const duas = () => el.clientWidth >= 600;
  function aplicarColunas() {
    const d = duas();
    el.classList.toggle('ch-duas', d);
    if (d) { colLista.hidden = false; colConversa.hidden = false; }
    else { colLista.hidden = st.vista !== 'lista'; colConversa.hidden = st.vista === 'lista'; }
    vConversa.hidden = st.vista !== 'conversa';
    vNovo.hidden = st.vista !== 'novo';
    vGrupo.hidden = st.vista !== 'grupo';
    vazioDir.hidden = !d || st.vista !== 'lista';
  }
  try { new ResizeObserver(() => aplicarColunas()).observe(el); } catch (e) { /* sem ResizeObserver: uma coluna */ }

  // ---------- o que vem do banco ----------
  const conv = id => st.convs.get(id) || null;
  const minhaConversaCom = email => [...st.convs.values()].find(c => c.tipo === 'direta' && outroDa(c, eu) === email) || null;
  function contar() {
    const n = naoLidasTotal(st.convs.values());
    try { ctl.contador(n); } catch (e) { /* sem balão */ }
    // o número no título da aba do navegador, como o Beep piscando
    const base = document.title.replace(/^\(\d+\+?\)\s/, '');
    const novo = (n ? '(' + (n > 99 ? '99+' : n) + ') ' : '') + base;
    if (document.title !== novo) document.title = novo;
  }
  async function sincronizar({ avisar = false } = {}) {
    let data, error;
    try { ({ data, error } = await supabase.rpc('chat_resumo')); } catch (e) { error = e; }
    if (error || !Array.isArray(data)) { if (!st.pronto) { st.erro = 'Não consegui abrir o chat agora.'; desenharLista(); } return false; }
    const antes = st.convs;
    // a conversa que acabou de aparecer (o grupo que alguém criou, a de avisos no primeiro aviso) fica marcada uns segundos: a
    // mensagem dela que chegar pelo tempo real já está contada no número que veio do banco
    const recem = st.pronto ? Date.now() : 0;
    st.convs = new Map(data.filter(r => r && r.conversa_id).map(r => [r.conversa_id, { ...r, membros: Array.isArray(r.membros) ? r.membros : [],
      ...(recem && !antes.has(r.conversa_id) ? { _recem: recem } : {}) }]));
    st.erro = '';
    // o que chegou sem o tempo real (a conexão caiu, o computador dormiu): avisa o que é novo
    if (avisar && st.pronto) {
      st.convs.forEach(c => {
        const a = antes.get(c.conversa_id), novas = (c.nao_lidas || 0) - (a ? a.nao_lidas || 0 : 0);
        if (novas > 0 && c.ultima_autor && c.ultima_autor !== eu && !vendo(c.conversa_id))
          avisarDe(c, { id: c.conversa_id + ':' + c.ultima_em, autor: c.ultima_autor, texto: novas > 1 ? novas + ' mensagens novas' : c.ultima_texto, anexos: c.ultima_anexos ? [{ nome: 'arquivo' }] : [] });
      });
    }
    st.pronto = true;
    if (st.aberta && !st.convs.has(st.aberta)) { st.aberta = null; if (st.vista === 'conversa' || st.vista === 'grupo') st.vista = 'lista'; guardarAba(); }
    desenharLista(); contar();
    if (st.aberta && st.vista === 'conversa') { desenharCabecalho(); if (vendo(st.aberta) && (conv(st.aberta) || {}).nao_lidas) recarregarAberta(); }
    try { ctl.status(); } catch (e) { /* sem balão */ }
    return true;
  }
  async function carregarPessoas() {
    try { const { data, error } = await supabase.rpc('chat_pessoas'); if (!error && Array.isArray(data)) st.pessoas = data.map(x => String(typeof x === 'string' ? x : (x && (x.chat_pessoas || x.email)) || '').toLowerCase()).filter(Boolean); }
    catch (e) { /* a lista sai só com as conversas */ }
  }
  const COLS = COLUNAS_MSG;
  const porData = (a, b) => String(a.criada_em || '').localeCompare(String(b.criada_em || ''));
  async function carregarMensagens(id, { antesDe } = {}) {
    let qy = supabase.from('chat_mensagens').select(COLS).eq('conversa_id', id);
    if (antesDe) qy = qy.lt('criada_em', antesDe);
    const { data, error } = await qy.order('criada_em', { ascending: false }).limit(50);
    if (error) throw new Error('Não consegui ler as mensagens agora.');
    return (data || []).filter(m => m && m.conversa_id === id).sort(porData);
  }
  async function carregarMembros(id) {
    const { data, error } = await supabase.from('chat_membros').select('conversa_id, email, lido_ate, silenciada').eq('conversa_id', id);
    if (!error && Array.isArray(data)) st.membros = data.filter(m => m.conversa_id === id);
  }

  // ---------- quem está vendo o quê ----------
  const naFrente = () => document.visibilityState === 'visible' && (typeof document.hasFocus !== 'function' || document.hasFocus());
  const conversaNaTela = id => { try { return ctl.ativa() && st.vista === 'conversa' && st.aberta === id; } catch (e) { return false; } };
  const vendo = id => conversaNaTela(id) && naFrente();

  // ---------- os avisos ----------
  const CHAVE_AVISADAS = 'mr_chat_avisadas:' + eu, CHAVE_SOM = 'mr_chat_som:' + eu, CHAVE_ATIVAR = 'mr_chat_ativar:' + eu;
  const lerLocal = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const gravarLocal = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* sem armazenamento */ } };
  const somLigado = () => lerLocal(CHAVE_SOM) !== 'nao';
  // uma aba avisa por mensagem: quem chega primeiro marca (a da frente não espera; as outras esperam um pouco)
  async function reivindicar(id, atraso) {
    if (atraso) await espera(atraso);
    const tentar = () => {
      let lst = [];
      try { lst = JSON.parse(lerLocal(CHAVE_AVISADAS) || '[]'); } catch (e) { lst = []; }
      if (!Array.isArray(lst)) lst = [];
      if (lst.includes(id)) return false;
      lst.push(id); gravarLocal(CHAVE_AVISADAS, JSON.stringify(lst.slice(-300)));
      return true;
    };
    try { if (navigator.locks && navigator.locks.request) return await navigator.locks.request('mr_chat_avisos:' + eu, () => tentar()); } catch (e) { /* sem Web Locks */ }
    return tentar();
  }
  let audio = null;
  const destravarSom = () => { try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume().catch(() => {}); } catch (e) { audio = null; } };
  ['pointerdown', 'keydown'].forEach(t => document.addEventListener(t, destravarSom, { once: true, capture: true, passive: true }));
  // o som pronto pra tocar: o áudio já ligado, ou a tela já recebeu um clique ou uma tecla (aí o navegador deixa ligar)
  const somPronto = () => {
    if (audio && audio.state === 'running') return true;
    try { return !!(navigator.userActivation && navigator.userActivation.hasBeenActive); } catch (e) { return false; }
  };
  // o bipe: duas notas curtas e baixas; diz se vai soar
  function bipe() {
    if (celular || !somLigado()) return false;
    const pronto = somPronto();
    avisa('mr:chat-aviso', { tipo: 'bipe', som: pronto });
    try {
      destravarSom();
      if (!audio) return false;
      const t = audio.currentTime + 0.02;
      [[880, 0, 0.09], [1175, 0.11, 0.13]].forEach(([f, ini, dur]) => {
        const o = audio.createOscillator(), g = audio.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t + ini);
        g.gain.exponentialRampToValueAtTime(0.11, t + ini + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t + ini + dur);
        o.connect(g); g.connect(audio.destination);
        o.start(t + ini); o.stop(t + ini + dur + 0.03);
      });
      return pronto;
    } catch (e) { return false; }
  }
  const podeNotificar = () => !celular && typeof Notification !== 'undefined' && Notification.permission === 'granted';
  // o aviso do Windows (a notificação do navegador): clicar abre a conversa nesta aba; sem o som dele quando o bipe toca
  function notificar(c, m, { semSom = false } = {}) {
    if (!podeNotificar()) return false;
    const { titulo, corpo } = textoDoAviso(c, m, eu);
    try {
      const n = new Notification(titulo, { body: corpo, tag: 'mr-chat-' + c.conversa_id, renotify: true, silent: !!semSom });
      n.onclick = () => { try { window.focus(); } catch (e) { /* foco */ } abrirConversa(c.conversa_id, { mostrar: true }); try { n.close(); } catch (e) { /* já fechou */ } };
      avisa('mr:chat-aviso', { tipo: 'notificacao', conversa: c.conversa_id, titulo, corpo, semSom: !!semSom });
      return true;
    } catch (e) { return false; }
  }
  // a mensagem de outra pessoa que ninguém está vendo: o bipe; na tela da frente, o recado; atrás, o aviso do Windows junto
  // (a regra em comoAvisar, lá em cima)
  function avisarDe(c, m) {
    if (!c || c.silenciada) return;
    avisa('mr:chat-mensagem', { conversa: c.conversa_id, autor: m.autor });
    const frente = naFrente();
    reivindicar(String(m.id), esperaDoAviso({ frente, somPronto: somPronto() })).then(ganhou => {
      if (!ganhou) return;
      const plano = comoAvisar({ frente, celular, somLigado: somLigado(), somPronto: somPronto(), podeNotificar: podeNotificar() });
      const tocou = plano.bipe ? bipe() : false;
      if (plano.notificacao) notificar(c, m, { semSom: plano.semSom && tocou });
      if (plano.recado) {
        let aberto = false;
        try { aberto = ctl.ativa(); } catch (e) { aberto = false; }
        if (!aberto) {
          const { titulo, corpo } = textoDoAviso(c, m, eu);
          // o aviso do sistema traz o botão dele (abrir a admissão, a tarefa…); a mensagem de alguém, "Responder"
          const acao = acaoDoAviso(m);
          const botao = acao ? { rotulo: acao.rotulo, acao: () => irPara(acao.href) }
            : { rotulo: ehAvisos(c) ? 'Ver o aviso' : 'Responder', acao: () => abrirConversa(c.conversa_id, { mostrar: true }) };
          try { ctl.avisar({ html: '<p><b>' + escapeHtml(titulo) + '</b><br>' + escapeHtml(corpo) + '</p>', botoes: [botao], ms: 12000 }); } catch (e) { /* sem balão */ }
        }
      }
    }).catch(() => {});
  }
  // o botão do aviso (no recado da carinha): abre a tela nesta aba, como o link da mensagem
  const irPara = href => { try { window.location.assign(href); } catch (e) { /* fora do navegador */ } };
  function textoDosAvisos() {
    if (celular) return '';
    if (typeof Notification === 'undefined') return 'Avisos: só o bipe';
    if (Notification.permission === 'granted') return 'Avisos ligados' + (somLigado() ? '' : ' · sem bipe');
    if (Notification.permission === 'denied') return 'Avisos bloqueados';
    return 'Ativar avisos';
  }
  function desenharAvisos() {
    const b = q('[data-ch="avisos"]'), t = q('.ch-avisos-txt');
    if (!b || !t) return;
    t.textContent = textoDosAvisos();
    const permissao = typeof Notification !== 'undefined' ? Notification.permission : '';
    b.title = permissao === 'denied'
      ? 'O navegador bloqueou os avisos deste site: clique no cadeado ao lado do endereço e libere as notificações.'
      : permissao === 'default'
        ? 'Clique pra ligar o aviso do Windows, que aparece com o sistema atrás de outra janela. O bipe já toca a cada mensagem nova.'
        : 'O bipe toca a cada mensagem nova e, com o sistema atrás de outra janela, vem também o aviso do Windows; clique pra ' + (somLigado() ? 'desligar' : 'ligar') + ' o bipe.';
    ativarEl.hidden = celular || typeof Notification === 'undefined' || Notification.permission !== 'default' || lerLocal(CHAVE_ATIVAR) === new Date().toISOString().slice(0, 10);
  }
  async function pedirAvisos() {
    if (typeof Notification === 'undefined') return;
    try { await Notification.requestPermission(); } catch (e) { /* recusado */ }
    desenharAvisos();
    if (Notification.permission === 'granted') try { ctl.anunciar('Avisos ligados.'); } catch (e) { /* sem leitor */ }
  }

  // ---------- a lista ----------
  const avatar = (nome, { grupo = false, online = false, escritorio = false, avisos = false } = {}) => '<span class="ch-avatar' + (avisos ? ' ch-avatar-avisos' : grupo ? ' ch-avatar-grupo' : '') + '" aria-hidden="true">'
    + (avisos ? ICONE.sino : escritorio ? ICONE.predio : grupo ? ICONE.grupo : escapeHtml(iniciais(nome))) + (online ? '<i class="ch-online"></i>' : '') + '</span>';
  function desenharLista() {
    if (!st.pronto && !st.erro) { ul.innerHTML = '<li class="ch-carregando">Abrindo o chat…</li>'; return; }
    if (st.erro && !st.convs.size) { ul.innerHTML = '<li class="ch-carregando">' + escapeHtml(st.erro) + ' <button type="button" class="as-botao as-botao-link" data-ch="tentar">Tentar de novo</button></li>'; return; }
    const termo = normal(st.busca);
    const linhas = linhasDaLista([...st.convs.values()], st.pessoas, eu).filter(l => {
      if (!termo) return true;
      const c = l.conversa;
      const nomes = c ? [tituloDaConversa(c, eu), ...(c.membros || []).map(nomeDe)] : [l.nome];
      return nomes.some(n => normal(n).includes(termo));
    });
    ul.innerHTML = linhas.map(l => {
      if (l.pessoa) {
        return '<li><button type="button" class="ch-linha" data-pessoa="' + escapeHtml(l.pessoa) + '" aria-label="' + escapeHtml('Conversar com ' + l.nome + (st.online.has(l.pessoa) ? ', online' : '')) + '">'
          + avatar(l.nome, { online: st.online.has(l.pessoa) }) + '<span class="ch-linha-txt"><span class="ch-linha-topo"><b>' + escapeHtml(l.nome) + '</b></span><span class="ch-linha-baixo"><small>Começar a conversa</small></span></span></button></li>';
      }
      const c = l.conversa, titulo = tituloDaConversa(c, eu), o = outroDa(c, eu);
      const online = o ? st.online.has(o) : false, n = c.nao_lidas || 0, atual = st.aberta === c.conversa_id && st.vista !== 'lista';
      const previa = previaDaUltima(c, eu);
      return '<li><button type="button" class="ch-linha' + (n ? ' ch-tem-novas' : '') + (atual ? ' ch-atual' : '') + '" data-conversa="' + escapeHtml(c.conversa_id) + '"'
        + (atual ? ' aria-current="true"' : '') + ' aria-label="' + escapeHtml(titulo + (online ? ', online' : '') + (n ? ', ' + n + (n === 1 ? ' mensagem nova' : ' mensagens novas') : '') + (c.silenciada ? ', silenciada' : '') + '. ' + previa) + '">'
        + avatar(titulo, { grupo: c.tipo === 'grupo', online, escritorio: c.chave === 'escritorio', avisos: ehAvisos(c) })
        + '<span class="ch-linha-txt"><span class="ch-linha-topo"><b>' + escapeHtml(titulo) + '</b><time>' + escapeHtml(horaDaLista(c.ultima_autor ? c.ultima_em : null)) + '</time></span>'
        + '<span class="ch-linha-baixo"><small>' + escapeHtml(previa) + '</small>' + (c.silenciada ? '<span class="ch-mudo" title="Silenciada: sem aviso">' + ICONE.sinoMudo + '</span>' : '')
        + (n ? '<span class="ch-n">' + (n > 99 ? '99+' : n) + '</span>' : '') + '</span></span></button></li>';
    }).join('') || '<li class="ch-carregando">' + (termo ? 'Ninguém com “' + escapeHtml(st.busca.trim()) + '”.' : 'Nenhuma conversa ainda.') + '</li>';
    desenharAvisos();
  }
  // a busca nas mensagens (3 letras ou mais): as conversas de que participo
  let timerBusca = null;
  busca.addEventListener('input', () => {
    st.busca = busca.value; desenharLista();
    clearTimeout(timerBusca);
    const t = busca.value.trim();
    if (t.length < 3) { st.achadas = null; achadasEl.hidden = true; return; }
    timerBusca = setTimeout(() => buscarMensagens(t), 350);
  });
  async function buscarMensagens(t) {
    const padrao = '%' + t.replace(/[%_\\]/g, ' ') + '%';
    const { data, error } = await supabase.from('chat_mensagens').select(COLS).ilike('texto', padrao).is('apagada_em', null).order('criada_em', { ascending: false }).limit(30);
    if (busca.value.trim() !== t) return;
    const alvo = normal(t);
    st.achadas = error ? [] : (data || []).filter(m => m.texto && normal(m.texto).includes(alvo) && st.convs.has(m.conversa_id)).slice(0, 20);
    achadasEl.hidden = false;
    achadasEl.innerHTML = '<div class="ch-achadas-tit">' + (st.achadas.length ? 'Mensagens com “' + escapeHtml(t) + '”' : 'Nenhuma mensagem com “' + escapeHtml(t) + '”.') + '</div>'
      + st.achadas.map(m => {
        const c = conv(m.conversa_id);
        return '<button type="button" class="ch-achada" data-conversa="' + escapeHtml(m.conversa_id) + '" data-msg="' + escapeHtml(m.id) + '"><span class="ch-linha-topo"><b>' + escapeHtml(tituloDaConversa(c, eu))
          + '</b><time>' + escapeHtml(horaDaLista(m.criada_em)) + '</time></span><small>' + escapeHtml((m.autor === eu ? 'Você: ' : nomeDe(m.autor) + ': ') + String(m.texto).replace(/\s+/g, ' ').slice(0, 160)) + '</small></button>';
      }).join('');
  }

  // ---------- a conversa ----------
  function desenharCabecalho() {
    const c = conv(st.aberta);
    if (!c) return;
    cabNome.textContent = tituloDaConversa(c, eu);
    aplicarSoLer();
    if (ehAvisos(c)) { cabSub.textContent = 'Só pra ler' + (c.silenciada ? ' · silenciada' : ''); return; }
    const o = outroDa(c, eu);
    if (o) cabSub.textContent = st.online.has(o) ? 'online' : 'fora do sistema agora';
    else {
      const on = (c.membros || []).filter(e => e !== eu && st.online.has(e)).map(nomeDe);
      cabSub.textContent = (c.membros || []).length + ' pessoas' + (on.length ? ' · ' + on.join(', ') + ' online' : '') + (c.silenciada ? ' · silenciada' : '');
    }
    if (o && c.silenciada) cabSub.textContent += ' · silenciada';
  }
  const arquivosDe = m => (Array.isArray(m.anexos) ? m.anexos : []).filter(a => a && typeof a === 'object' && a.nome);
  function htmlAnexo(a, m) {
    // o arquivo do Drive (o assistente manda o link; o arquivo fica lá): abre numa aba nova
    if (a.link) {
      const l = linkDoDrive(a.link);
      const corpo = ICONE.arquivo + '<span>' + escapeHtml(a.nome) + '</span><small>' + (l ? 'Drive' : 'sem link') + '</small>';
      return l ? '<a class="ch-arq ch-arq-link" href="' + escapeHtml(l) + '" target="_blank" rel="noopener noreferrer" title="' + escapeHtml('Abrir ' + a.nome + ' no Drive' + (a.pasta ? ' (' + a.pasta + ')' : '')) + '">' + corpo + '</a>'
        : '<span class="ch-arq ch-arq-sem">' + corpo + '</span>';
    }
    const caminho = typeof a.caminho === 'string' ? a.caminho : '';
    if (!caminho) return '<span class="ch-arq ch-arq-indo">' + ICONE.arquivo + '<span>' + escapeHtml(a.nome) + '</span><small>' + (m._erro ? 'não foi' : 'enviando…') + '</small></span>';
    if (ehImagem(a.tipo)) {
      const u = urls.get(caminho);
      return '<button type="button" class="ch-img" data-caminho="' + escapeHtml(caminho) + '" data-nome="' + escapeHtml(a.nome) + '" title="' + escapeHtml('Abrir ' + a.nome) + '">'
        + '<img alt="' + escapeHtml(a.nome) + '"' + (u && u.vale > Date.now() ? ' src="' + escapeHtml(u.url) + '"' : '') + ' loading="lazy"></button>';
    }
    return '<button type="button" class="ch-arq" data-caminho="' + escapeHtml(caminho) + '" data-nome="' + escapeHtml(a.nome) + '" title="' + escapeHtml('Baixar ' + a.nome) + '">' + ICONE.arquivo
      + '<span>' + escapeHtml(a.nome) + '</span><small>' + escapeHtml(tamanhoBR(a.tamanho)) + '</small></button>';
  }
  function htmlMensagem(m, anterior, c, ultimaMinha, primeiraNova) {
    const minha = m.autor === eu;
    const separa = !anterior || rotuloDoDia(anterior.criada_em) !== rotuloDoDia(m.criada_em);
    let h = separa ? '<div class="ch-dia"><span>' + escapeHtml(rotuloDoDia(m.criada_em)) + '</span></div>' : '';
    // onde começam as que eu não tinha lido quando abri a conversa
    if (m.id === primeiraNova) h += '<div class="ch-novas"><span>Novas</span></div>';
    const junta = !separa && anterior && anterior.autor === m.autor && new Date(m.criada_em) - new Date(anterior.criada_em) < 5 * 60e3;
    const avisos = ehAvisos(c);
    const nomeAutor = !minha && c && c.tipo === 'grupo' && !avisos && !junta ? '<div class="ch-autor">' + escapeHtml(nomeDe(m.autor)) + '</div>' : '';
    const cls = 'ch-msg' + (minha ? ' eu' : '') + (junta ? ' ch-junta' : '') + (m.apagada_em ? ' ch-apagada' : '') + (m._enviando ? ' ch-indo' : '') + (m._erro ? ' ch-nao-foi' : '') + (m.autor === AUTOR_SISTEMA ? ' ch-aviso' : '');
    let corpo;
    if (m.apagada_em) corpo = '<div class="ch-bolha"><i>Mensagem apagada</i></div>';
    else {
      const arqs = arquivosDe(m);
      // o aviso do sistema: o botão que abre a tela da coisa, embaixo do texto
      const acao = acaoDoAviso(m);
      // a citação vem em cima (com ela, o emoji sozinho fica no balão)
      corpo = (m.responde_a ? htmlCitacao(m.responde_a) : '')
        + (arqs.length ? '<div class="ch-anexos">' + arqs.map(a => htmlAnexo(a, m)).join('') + '</div>' : '')
        + (m.texto ? '<div class="ch-bolha' + (soEmojis(m.texto) && !m.responde_a && !acao ? ' ch-so-emoji' : '') + '">' + linkificar(escapeHtml(m.texto)) + '</div>' : '')
        + (acao ? '<a class="as-botao ch-acao" href="' + escapeHtml(acao.href) + '">' + escapeHtml(acao.rotulo) + '</a>' : '');
    }
    let meta = '<time>' + escapeHtml(horaCurta(m.criada_em)) + '</time>';
    if (minha && m._enviando) meta += '<span>enviando…</span>';
    else if (minha && m._erro) meta += '<span class="ch-meta-erro">não foi</span><button type="button" class="as-botao as-botao-link" data-ch="reenviar" data-id="' + escapeHtml(m.id) + '">Tentar de novo</button>';
    else if (minha && m.id === ultimaMinha && !m.apagada_em) { const v = textoDoVisto(m, st.membros, c); if (v) meta += '<span class="ch-visto">' + escapeHtml(v) + '</span>'; }
    // responder: a de qualquer um, menos a apagada e a que ainda não foi (e nos avisos, que são só pra ler)
    if (!avisos && !m.apagada_em && !m._enviando && !m._erro)
      meta += '<button type="button" class="as-botao as-botao-link ch-responder" data-ch="responder" data-id="' + escapeHtml(m.id) + '" aria-label="Responder a esta mensagem">Responder</button>';
    if (minha && !m.apagada_em && !m._enviando && !m._erro) {
      meta += st.confirmarApagar === m.id
        ? '<span class="ch-confirma">Apagar pra todos? <button type="button" class="as-botao as-botao-link" data-ch="apagar-sim" data-id="' + escapeHtml(m.id) + '">Apagar</button> <button type="button" class="as-botao as-botao-link" data-ch="apagar-nao">Cancelar</button></span>'
        : '<button type="button" class="as-botao as-botao-link ch-apagar" data-ch="apagar" data-id="' + escapeHtml(m.id) + '" aria-label="Apagar esta mensagem">Apagar</button>';
    }
    return h + '<div class="' + cls + '" data-id="' + escapeHtml(m.id) + '">' + nomeAutor + corpo + '<div class="ch-meta">' + meta + '</div></div>';
  }
  function desenharMensagens({ fim = false, manter = null } = {}) {
    const c = conv(st.aberta);
    const perto = msgsEl.scrollHeight - msgsEl.scrollTop - msgsEl.clientHeight < 60;
    const ultimaMinha = [...st.msgs].reverse().find(m => m.autor === eu && !m._enviando && !m._erro);
    const nova = st.lidoAoAbrir ? st.msgs.find(m => m.autor !== eu && m.criada_em > st.lidoAoAbrir) : null;
    msgsEl.innerHTML = (st.temAntigas ? '<div class="ch-antigas"><button type="button" class="as-botao as-botao-link" data-ch="antigas">Ver mensagens anteriores</button></div>' : '')
      + (st.msgs.length ? '' : '<div class="ch-vazio"><p>' + (st.carregando ? 'Lendo as mensagens…' : 'Nenhuma mensagem ainda. Diga oi!') + '</p></div>')
      + st.msgs.map((m, i) => htmlMensagem(m, st.msgs[i - 1], c, ultimaMinha && ultimaMinha.id, nova && nova.id)).join('');
    if (manter) msgsEl.scrollTop = msgsEl.scrollHeight - manter;
    else if (fim || perto) msgsEl.scrollTop = msgsEl.scrollHeight;
    preencherImagens();
    buscarCitadas();
  }

  // ---------- a resposta (20/10/2026): a citação, a barra "Respondendo a…" e ir até a original ----------
  const original = id => st.msgs.find(x => x.id === id) || citadas.get(id) || null;
  function htmlCitacao(id) {
    const o = original(id), t = trechoDaCitada(o), quem = quemDaCitada(o, eu);
    return '<button type="button" class="ch-citacao' + (t.apagada ? ' ch-cit-apagada' : '') + '" data-ch="ir-citada" data-id="' + escapeHtml(id) + '"'
      + ' aria-label="' + escapeHtml('Ir pra mensagem respondida' + (quem ? ', de ' + quem : '') + ': ' + t.texto) + '">'
      + (quem ? '<b>' + escapeHtml(quem) + '</b>' : '') + '<span>' + escapeHtml(t.texto) + '</span></button>';
  }
  // as citadas que não estão na página aberta (respondem a uma mais antiga): numa leitura só; chegou, redesenha. A que não
  // achou (o banco não deixa ler) fica guardada como null, pra não perguntar de novo
  let lendoCitadas = false;
  async function buscarCitadas() {
    const faltam = [...new Set(st.msgs.map(m => m.responde_a).filter(id => id && !citadas.has(id) && !st.msgs.some(x => x.id === id)))].slice(0, 100);
    if (!faltam.length || lendoCitadas) return;
    lendoCitadas = true;
    const aberta = st.aberta;
    try {
      const { data, error } = await supabase.from('chat_mensagens').select(COLS).in('id', faltam);
      if (!error) { (data || []).forEach(m => citadas.set(m.id, m)); faltam.forEach(id => { if (!citadas.has(id)) citadas.set(id, null); }); }
    } catch (e) { /* fica "Mensagem anterior" */ }
    lendoCitadas = false;
    if (st.aberta === aberta && st.vista === 'conversa' && faltam.some(id => citadas.get(id))) { desenharMensagens(); desenharRespondendo(); }
  }
  function desenharRespondendo() {
    const r = st.respondendo;
    respEl.hidden = !r;
    if (!r) { respEl.innerHTML = ''; return; }
    const o = original(r.id), t = trechoDaCitada(o);
    const titulo = o && quemDaCitada(o, eu) === 'Você' ? 'Respondendo à sua mensagem' : 'Respondendo a ' + (o ? nomeDe(o.autor) : 'uma mensagem');
    respEl.innerHTML = '<button type="button" class="ch-respondendo-txt" data-ch="ir-citada" data-id="' + escapeHtml(r.id) + '" title="Ver a mensagem"><b>' + escapeHtml(titulo) + '</b>'
      + '<span' + (t.apagada ? ' class="ch-cit-apagada"' : '') + '>' + escapeHtml(t.texto) + '</span></button>'
      + '<button type="button" class="ch-icone" data-ch="nao-responder" aria-label="Cancelar a resposta" title="Cancelar a resposta (Esc)">' + ICONE.x + '</button>';
  }
  function responder(id) {
    const m = st.msgs.find(x => x.id === id);
    if (!m || m.apagada_em || m._enviando || m._erro || soLer()) return;
    st.respondendo = { id };
    fecharEmojis(); desenharRespondendo();
    ta.focus({ preventScroll: true });
    try { ctl.anunciar((quemDaCitada(m, eu) === 'Você' ? 'Respondendo à sua mensagem' : 'Respondendo a ' + nomeDe(m.autor)) + '. Esc desiste.'); } catch (e) { /* sem leitor */ }
  }
  function desistirDeResponder({ foco = false } = {}) {
    if (!st.respondendo) return;
    st.respondendo = null; desenharRespondendo();
    if (foco) ta.focus({ preventScroll: true });
  }
  // clicar na citação: a original, com as páginas anteriores até ela (no máximo 20, mil mensagens), em destaque
  async function irParaMensagem(id) {
    const aberta = st.aberta;
    let achou = st.msgs.some(m => m.id === id), carregou = false;
    for (let i = 0; !achou && i < 20 && st.temAntigas; i++) {
      const primeira = st.msgs.find(m => !m._enviando && !m._erro);
      if (!primeira) break;
      try {
        const mais = await carregarMensagens(aberta, { antesDe: primeira.criada_em });
        if (st.aberta !== aberta) return;
        st.msgs = mesclar(st.msgs, mais); st.temAntigas = mais.length >= 50; carregou = true;
      } catch (e) { mostrarErro(e.message); break; }
      achou = st.msgs.some(m => m.id === id);
    }
    if (st.aberta !== aberta) return;
    if (carregou) desenharMensagens({ manter: msgsEl.scrollHeight - msgsEl.scrollTop });
    const alvo = achou ? msgsEl.querySelector('.ch-msg[data-id="' + CSS.escape(id) + '"]') : null;
    if (!alvo) { mostrarErro('A mensagem respondida não está mais nesta conversa.'); return; }
    alvo.scrollIntoView({ block: 'center' });
    alvo.classList.add('ch-destaque');
    setTimeout(() => alvo.classList.remove('ch-destaque'), 2500);
  }
  // as imagens: o link assinado (1 hora), em lote
  async function preencherImagens() {
    const imgs = [...msgsEl.querySelectorAll('.ch-img img:not([src])')];
    const faltam = [...new Set(imgs.map(i => i.parentElement.dataset.caminho).filter(p => !(urls.get(p) && urls.get(p).vale > Date.now())))];
    if (faltam.length && supabase.storage) {
      try {
        const { data } = await supabase.storage.from('chat').createSignedUrls(faltam, 3600);
        (data || []).forEach(x => { if (x && x.signedUrl && x.path) urls.set(x.path, { url: x.signedUrl, vale: Date.now() + 3300e3 }); });
      } catch (e) { /* sem a miniatura: fica o nome */ }
    }
    msgsEl.querySelectorAll('.ch-img img:not([src])').forEach(img => {
      const u = urls.get(img.parentElement.dataset.caminho);
      if (u) img.src = u.url; else img.parentElement.classList.add('ch-img-sem');
    });
  }
  async function abrirArquivo(caminho, nome, baixar) {
    if (!supabase.storage) return;
    try {
      const { data, error } = await supabase.storage.from('chat').createSignedUrl(caminho, 300, baixar ? { download: nome } : undefined);
      if (error || !data || !data.signedUrl) throw new Error('sem link');
      const a = document.createElement('a');
      a.href = data.signedUrl; a.target = '_blank'; a.rel = 'noopener noreferrer';
      if (baixar) a.download = nome;
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) { mostrarErro('Não consegui abrir o arquivo agora.'); }
  }
  function mostrarErro(t) { erroEl.textContent = t || ''; erroEl.hidden = !t; if (t) setTimeout(() => { if (erroEl.textContent === t) { erroEl.hidden = true; erroEl.textContent = ''; } }, 8000); }

  let geracao = 0;
  async function abrirConversa(id, { mostrar = false, destacar = null } = {}) {
    if (!id) return;
    if (!conv(id)) await sincronizar();
    const c = conv(id);
    if (!c) { mostrarErro('Essa conversa não está mais com você.'); return; }
    const g = ++geracao;
    const trocou = st.aberta !== id;
    st.aberta = id; st.vista = 'conversa'; st.menu = false; st.confirmarApagar = null;
    if (trocou) { st.msgs = []; st.membros = []; st.temAntigas = false; st.pendentes = []; desenharPendentes(); ta.value = ''; ajustar(); fecharEmojis(); st.respondendo = null; desenharRespondendo(); }
    aplicarSoLer();
    st.lidoAoAbrir = c.nao_lidas ? c.lido_ate : null;
    guardarAba(); aplicarColunas(); desenharLista(); desenharCabecalho(); fecharMenu();
    if (mostrar) { try { ctl.mostrar(false); } catch (e) { /* sem balão */ } }
    st.carregando = true; desenharMensagens({ fim: true });
    try {
      const [lst] = await Promise.all([carregarMensagens(id), carregarMembros(id)]);
      if (g !== geracao) return;
      st.msgs = mesclar(st.msgs.filter(m => m._enviando || m._erro), lst);
      st.temAntigas = lst.length >= 50;
      // a mensagem achada na busca: as páginas anteriores até ela (no máximo 5)
      for (let i = 0; destacar && i < 5 && st.temAntigas && !st.msgs.some(m => m.id === destacar); i++) {
        const mais = await carregarMensagens(id, { antesDe: st.msgs[0].criada_em });
        if (g !== geracao) return;
        st.msgs = mesclar(st.msgs, mais); st.temAntigas = mais.length >= 50;
      }
    } catch (e) { if (g === geracao) mostrarErro(e.message); }
    st.carregando = false;
    if (g !== geracao) return;
    desenharMensagens({ fim: !destacar });
    if (destacar) {
      const alvo = msgsEl.querySelector('.ch-msg[data-id="' + CSS.escape(destacar) + '"]');
      if (alvo) { alvo.classList.add('ch-destaque'); alvo.scrollIntoView({ block: 'center' }); setTimeout(() => alvo.classList.remove('ch-destaque'), 2500); }
    }
    if (vendo(id)) marcarLido();
    if (!celular && !soLer() && (mostrar || ctl.ativa())) setTimeout(() => { if (st.aberta === id && conversaNaTela(id)) ta.focus({ preventScroll: true }); }, 30);
  }
  const mesclar = (a, b) => { const m = new Map(); [...a, ...b].forEach(x => m.set(x.id, { ...(m.get(x.id) || {}), ...x })); return [...m.values()].sort(porData); };
  async function recarregarAberta() {
    const id = st.aberta;
    try { const lst = await carregarMensagens(id); if (st.aberta !== id) return; st.msgs = mesclar(st.msgs, lst); desenharMensagens(); if (vendo(id)) marcarLido(); } catch (e) { /* fica o que já está */ }
  }
  // lido até a última mensagem da conversa (a hora do banco, não a do computador)
  let timerLido = null;
  function marcarLido() {
    clearTimeout(timerLido);
    timerLido = setTimeout(async () => {
      const id = st.aberta, c = conv(id);
      if (!c || !vendo(id)) return;
      const ultima = [...st.msgs].reverse().find(m => m.criada_em && !m._enviando && !m._erro);
      const ate = ultima ? ultima.criada_em : null;
      if (!ate || (c.lido_ate && c.lido_ate >= ate && !c.nao_lidas)) { if (c.nao_lidas) { c.nao_lidas = 0; desenharLista(); contar(); } return; }
      c.nao_lidas = 0; c.lido_ate = ate; desenharLista(); contar();
      try { await supabase.from('chat_membros').update({ lido_ate: ate }).eq('conversa_id', id).eq('email', eu); } catch (e) { /* tenta na próxima */ }
    }, 250);
  }

  // ---------- enviar ----------
  const ajustar = () => { ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight + 2) + 'px'; };
  ta.addEventListener('input', ajustar);
  ta.addEventListener('keydown', ev => { if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); enviar(); } });
  q('.ch-entrada').addEventListener('submit', ev => { ev.preventDefault(); enviar(); });
  function adicionarArquivos(lista) {
    const { ok, recusados } = conferirArquivos(lista, st.pendentes.length);
    ok.forEach(f => st.pendentes.push({ id: novoId(), arquivo: f, nome: f.name || 'arquivo', tamanho: f.size, tipo: f.type || 'application/octet-stream' }));
    desenharPendentes();
    if (recusados.length) mostrarErro(recusados.map(r => r.nome + ' ' + r.motivo).join(' · ') + '.');
  }
  function desenharPendentes() {
    pendEl.hidden = !st.pendentes.length;
    pendEl.innerHTML = st.pendentes.map(p => '<span class="ch-pend">' + ICONE.arquivo + '<span>' + escapeHtml(p.nome) + '</span><small>' + escapeHtml(tamanhoBR(p.tamanho)) + '</small>'
      + '<button type="button" class="ch-icone" data-ch="tirar" data-id="' + escapeHtml(p.id) + '" aria-label="' + escapeHtml('Tirar ' + p.nome) + '" title="Tirar">' + ICONE.x + '</button></span>').join('');
  }
  arquivoInput.addEventListener('change', () => { adicionarArquivos(arquivoInput.files); arquivoInput.value = ''; ta.focus({ preventScroll: true }); });
  // colar uma imagem (a captura de tela) direto na caixa
  ta.addEventListener('paste', ev => {
    const fs = [...((ev.clipboardData && ev.clipboardData.files) || [])];
    if (!fs.length) return;
    ev.preventDefault();
    const agora = new Date(), carimbo = pad(agora.getDate()) + '-' + pad(agora.getMonth() + 1) + '-' + agora.getFullYear() + ' ' + pad(agora.getHours()) + 'h' + pad(agora.getMinutes());
    adicionarArquivos(fs.map(f => (f.name && f.name !== 'image.png' ? f : new File([f], 'imagem ' + carimbo + '.' + ((f.type.split('/')[1] || 'png').replace('jpeg', 'jpg')), { type: f.type }))));
  });
  // arrastar arquivos pra conversa
  vConversa.addEventListener('dragover', ev => { if (!soLer() && ev.dataTransfer && [...ev.dataTransfer.types].includes('Files')) { ev.preventDefault(); vConversa.classList.add('ch-soltar'); } });
  vConversa.addEventListener('dragleave', ev => { if (!vConversa.contains(ev.relatedTarget)) vConversa.classList.remove('ch-soltar'); });
  vConversa.addEventListener('drop', ev => { vConversa.classList.remove('ch-soltar'); if (!soLer() && ev.dataTransfer && ev.dataTransfer.files.length) { ev.preventDefault(); adicionarArquivos(ev.dataTransfer.files); } });

  // ---------- os emojis (20/10/2026) ----------
  // o botão da carinha abre o painel por cima da caixa: os usados por último (guardados neste navegador) e os grupos; clicar
  // põe o emoji no lugar do cursor e o painel fica aberto pra pôr outros; Esc, clicar fora ou enviar fecha
  const CHAVE_EMOJIS = 'mr_chat_emojis:' + eu;
  let recentes = lerRecentes(lerLocal(CHAVE_EMOJIS));
  function gruposDeEmoji() {
    return (recentes.length ? [{ id: 'recentes', nome: 'Usados por último', icone: '🕘', itens: recentes.map(e => [e, nomeDoEmoji(e)]) }] : []).concat(EMOJIS);
  }
  function desenharEmojis() {
    const grupos = gruposDeEmoji();
    const atual = grupos.find(g => g.id === st.abaEmoji) || grupos[0];
    st.abaEmoji = atual.id;
    emojisEl.innerHTML = '<div class="ch-emoji-abas" role="toolbar" aria-label="Grupos de emojis">'
      + grupos.map(g => '<button type="button" class="ch-emoji-aba" data-aba-emoji="' + g.id + '" aria-pressed="' + (g.id === atual.id) + '" aria-label="' + escapeHtml(g.nome) + '" title="' + escapeHtml(g.nome) + '">' + g.icone + '</button>').join('')
      + '</div><div class="ch-emoji-tit">' + escapeHtml(atual.nome) + '</div>'
      + '<div class="ch-emoji-grade" role="group" aria-label="' + escapeHtml(atual.nome) + '">'
      + atual.itens.map(([e, n]) => '<button type="button" class="ch-emoji" data-emoji="' + escapeHtml(e) + '" aria-label="' + escapeHtml(n || e) + '"' + (n ? ' title="' + escapeHtml(n) + '"' : '') + '>' + escapeHtml(e) + '</button>').join('')
      + '</div>';
  }
  function abrirEmojis() {
    st.emojis = true; st.abaEmoji = null;   // abre nos usados por último (sem eles, nas carinhas)
    desenharEmojis(); emojisEl.hidden = false;
    emojiBtn.setAttribute('aria-expanded', 'true'); emojiBtn.classList.add('ch-ligado');
  }
  function fecharEmojis() {
    if (!st.emojis) return;
    st.emojis = false; emojisEl.hidden = true;
    emojiBtn.setAttribute('aria-expanded', 'false'); emojiBtn.classList.remove('ch-ligado');
  }
  // pelo mouse, o cursor volta pra caixa; pelo teclado, o foco fica no emoji (pra pôr outro sem voltar ao painel)
  function inserirEmoji(e, peloTeclado) {
    const fim = ta.selectionEnd, ini = ta.selectionStart;
    const r = inserirNoTexto(ta.value, ini, fim, e);
    if (!r) { mostrarErro('A mensagem chegou no limite de ' + MAX_TEXTO.toLocaleString('pt-BR') + ' caracteres.'); return; }
    ta.value = r.valor; ajustar();
    try { ta.setSelectionRange(r.cursor, r.cursor); } catch (er) { /* sem seleção */ }
    if (!peloTeclado) ta.focus({ preventScroll: true });
    recentes = recentesCom(recentes, e);
    gravarLocal(CHAVE_EMOJIS, JSON.stringify(recentes));
  }
  // as setas andam pela grade
  emojisEl.addEventListener('keydown', ev => {
    const b = ev.target.closest('.ch-emoji');
    if (!b) return;
    const todos = [...emojisEl.querySelectorAll('.ch-emoji')], i = todos.indexOf(b);
    const grade = emojisEl.querySelector('.ch-emoji-grade');
    const cols = Math.max(1, String(getComputedStyle(grade).gridTemplateColumns || '').split(' ').filter(Boolean).length);
    const d = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[ev.key];
    if (d == null) return;
    ev.preventDefault();
    const alvo = todos[Math.min(todos.length - 1, Math.max(0, i + d))];
    if (alvo) alvo.focus({ preventScroll: false });
  });

  async function enviar(reenvio = null) {
    const id = reenvio ? reenvio.id : novoId(), conversaId = reenvio ? reenvio.conversa_id : st.aberta;
    const texto = reenvio ? reenvio.texto || '' : ta.value.trim().slice(0, MAX_TEXTO);
    const pendentes = reenvio ? reenvio._pendentes || [] : st.pendentes.slice();
    if (!conversaId || (!texto && !pendentes.length) || ehAvisos(conv(conversaId))) return;
    // a resposta: a citada vai junto (e a barra sai); no "Tentar de novo", a mesma de antes
    const respondeA = reenvio ? reenvio.responde_a || null : (st.respondendo && st.respondendo.id) || null;
    let m = reenvio;
    if (!m) {
      m = { id, conversa_id: conversaId, autor: eu, texto: texto || null, anexos: pendentes.map(p => ({ nome: p.nome, tamanho: p.tamanho, tipo: p.tipo })), criada_em: new Date().toISOString(), apagada_em: null, responde_a: respondeA, _enviando: true, _pendentes: pendentes };
      st.msgs.push(m);
      ta.value = ''; ajustar(); st.pendentes = []; desenharPendentes(); fecharEmojis(); st.respondendo = null; desenharRespondendo();
    } else { m._enviando = true; m._erro = null; }
    desenharMensagens({ fim: true });
    try {
      const anexos = [];
      for (const p of pendentes) {
        const caminho = p.caminho || caminhoDoArquivo(conversaId, id, p.nome);
        if (!p.caminho) {
          const { error } = await supabase.storage.from('chat').upload(caminho, p.arquivo, { contentType: p.tipo, upsert: false, cacheControl: '3600' });
          if (error && !/exists|duplicate/i.test(String(error.message || error.error || ''))) throw new Error('O arquivo ' + p.nome + ' não subiu.');
          p.caminho = caminho;
        }
        anexos.push({ caminho, nome: p.nome, tamanho: p.tamanho, tipo: p.tipo });
      }
      // a regra do chat (a mesma do cartão do assistente): a que já tinha entrado — a resposta é que se perdeu — volta lida
      const r = await enviarMensagem(supabase, { id, conversaId, texto: texto || null, anexos, respondeA });
      if (r.erro) throw new Error(r.erro);
      const data = r.mensagem;
      Object.assign(m, { autor: eu, criada_em: new Date().toISOString(), ...data, anexos: data.anexos || anexos, _enviando: false, _erro: null, _pendentes: null });
      const c = conv(conversaId);
      if (c) { Object.assign(c, { ultima_em: m.criada_em, ultima_autor: eu, ultima_texto: m.texto, ultima_anexos: anexos.length, ultima_apagada: false, lido_ate: m.criada_em }); }
    } catch (e) { m._enviando = false; m._erro = (e && e.message) || 'A mensagem não foi.'; }
    st.msgs.sort(porData);
    if (st.aberta === conversaId) desenharMensagens({ fim: true });
    desenharLista();
  }

  // ---------- apagar a própria mensagem ----------
  async function apagar(id) {
    const m = st.msgs.find(x => x.id === id);
    st.confirmarApagar = null;
    if (!m || m.autor !== eu) return desenharMensagens();
    const caminhos = arquivosDe(m).map(a => a.caminho).filter(Boolean);
    try {
      if (caminhos.length && supabase.storage) await supabase.storage.from('chat').remove(caminhos).catch(() => {});
      const r = await apagarMensagem(supabase, id, eu);
      if (r.erro) throw new Error(r.erro);
      const data = r.mensagem;
      Object.assign(m, data || {}, { apagada_em: (data && data.apagada_em) || new Date().toISOString(), texto: null, anexos: [] });
      const c = conv(m.conversa_id), ultima = st.msgs[st.msgs.length - 1];
      if (c && ultima && ultima.id === id) c.ultima_apagada = true;
      try { ctl.anunciar('Mensagem apagada.'); } catch (e) { /* sem leitor */ }
    } catch (e) { mostrarErro('Não consegui apagar agora.'); }
    desenharMensagens(); desenharLista();
  }

  // ---------- o menu da conversa: silenciar; no grupo, as pessoas ----------
  function fecharMenu() { st.menu = false; menuEl.hidden = true; menuBtn.setAttribute('aria-expanded', 'false'); }
  function abrirMenu() {
    const c = conv(st.aberta);
    if (!c) return;
    st.menu = true;
    const itens = [['silenciar', c.silenciada ? 'Voltar a avisar' : ehAvisos(c) ? 'Silenciar (sem bipe nem aviso do Windows)' : 'Silenciar os avisos desta conversa']];
    if (c.tipo === 'grupo' && !ehAvisos(c)) itens.push(['pessoas', c.chave === 'escritorio' ? 'Quem está no grupo' : 'Pessoas e nome do grupo']);
    menuEl.innerHTML = itens.map(([k, t]) => '<button type="button" class="ch-menu-item" data-ch="' + k + '">' + escapeHtml(t) + '</button>').join('');
    menuEl.hidden = false; menuBtn.setAttribute('aria-expanded', 'true');
    menuEl.querySelector('button').focus({ preventScroll: true });
  }
  async function silenciar() {
    const c = conv(st.aberta);
    if (!c) return;
    const v = !c.silenciada;
    const { error } = await supabase.from('chat_membros').update({ silenciada: v }).eq('conversa_id', c.conversa_id).eq('email', eu);
    if (error) return mostrarErro('Não consegui mudar agora.');
    c.silenciada = v; desenharCabecalho(); desenharLista(); contar();
    try { ctl.anunciar(v ? 'Conversa silenciada: sem aviso nem bipe.' : 'Os avisos desta conversa voltaram.'); } catch (e) { /* sem leitor */ }
  }

  // ---------- o grupo: quem está, pôr alguém, trocar o nome, sair ----------
  function desenharGrupo(erro = '') {
    const c = conv(st.aberta);
    if (!c) return;
    vGrupo.querySelector('.ch-cab-quem b').textContent = tituloDaConversa(c, eu);
    vGrupo.querySelector('.ch-cab-quem small').textContent = (c.membros || []).length + ' pessoas';
    const fixo = c.chave === 'escritorio';
    const fora = st.pessoas.filter(e => !(c.membros || []).includes(e));
    vGrupo.querySelector('.ch-grupo-corpo').innerHTML =
      '<ul class="ch-membros">' + (c.membros || []).map(e => '<li>' + avatar(nomeDe(e), { online: st.online.has(e) }) + '<span>' + escapeHtml(nomeDe(e)) + (e === eu ? ' (você)' : '') + '</span>'
        + (st.online.has(e) ? '<small>online</small>' : '') + '</li>').join('') + '</ul>'
      + (fixo ? '<p class="ch-nota">Todo mundo que tem login no sistema está neste grupo.</p>'
        : (fora.length ? '<label class="ch-campo">Pôr alguém no grupo<span class="ch-linha-form"><select data-ch="quem-por">' + fora.map(e => '<option value="' + escapeHtml(e) + '">' + escapeHtml(nomeDe(e)) + '</option>').join('')
          + '</select><button type="button" class="as-botao" data-ch="por">Pôr</button></span></label>' : '')
          + '<label class="ch-campo">Nome do grupo<span class="ch-linha-form"><input type="text" maxlength="60" data-ch="novo-nome" value="' + escapeHtml(c.titulo || '') + '"><button type="button" class="as-botao" data-ch="renomear">Trocar</button></span></label>'
          + '<div class="ch-form-botoes">' + (st.confirmarSair ? '<span class="ch-confirma">Sair de “' + escapeHtml(c.titulo || 'grupo') + '”? <button type="button" class="as-botao as-botao-link" data-ch="sair-sim">Sair</button> <button type="button" class="as-botao as-botao-link" data-ch="sair-nao">Cancelar</button></span>'
            : '<button type="button" class="as-botao" data-ch="sair">Sair do grupo</button>') + '</div>')
      + '<div class="ch-erro" role="alert"' + (erro ? '' : ' hidden') + '>' + escapeHtml(erro) + '</div>';
  }
  const erroDoBanco = (error, padrao) => { const t = String((error && error.message) || ''); return /login|grupo|pessoa|nome|sair|acesso/i.test(t) && t.length < 120 ? t.charAt(0).toUpperCase() + t.slice(1) + '.' : padrao; };
  async function acaoNoGrupo(acao) {
    const c = conv(st.aberta);
    if (!c) return;
    let r;
    if (acao === 'por') r = await supabase.rpc('chat_grupo_adicionar', { c: c.conversa_id, email: vGrupo.querySelector('[data-ch="quem-por"]').value });
    else if (acao === 'renomear') r = await supabase.rpc('chat_grupo_renomear', { c: c.conversa_id, titulo: vGrupo.querySelector('[data-ch="novo-nome"]').value });
    else if (acao === 'sair') r = await supabase.rpc('chat_grupo_sair', { c: c.conversa_id });
    st.confirmarSair = false;
    if (r && r.error) return desenharGrupo(erroDoBanco(r.error, 'Não consegui agora. Tente de novo.'));
    if (acao === 'sair') { st.aberta = null; st.vista = 'lista'; guardarAba(); await sincronizar(); aplicarColunas(); return; }
    await sincronizar();
    desenharGrupo(); desenharCabecalho();
  }

  // ---------- grupo novo ----------
  function desenharNovo() {
    const lista = st.pessoas.filter(e => e !== eu);
    vNovo.querySelector('.ch-quem-lista').innerHTML = lista.map(e => '<label class="ch-quem-item"><input type="checkbox" value="' + escapeHtml(e) + '">' + avatar(nomeDe(e), { online: st.online.has(e) }) + '<span>' + escapeHtml(nomeDe(e)) + '</span></label>').join('')
      || '<p class="ch-nota">Ninguém mais com login no sistema.</p>';
    const er = vNovo.querySelector('.ch-erro'); er.hidden = true; er.textContent = '';
  }
  async function criarGrupo() {
    const nome = vNovo.querySelector('[data-ch="nome-grupo"]').value.trim();
    const emails = [...vNovo.querySelectorAll('.ch-quem-item input:checked')].map(i => i.value);
    const er = vNovo.querySelector('.ch-erro');
    const falhou = t => { er.textContent = t; er.hidden = false; };
    if (!nome) return falhou('Dê um nome ao grupo.');
    if (!emails.length) return falhou('Escolha quem entra.');
    const { data, error } = await supabase.rpc('chat_criar_grupo', { titulo: nome, emails });
    if (error || !data) return falhou(erroDoBanco(error, 'Não consegui criar o grupo agora.'));
    vNovo.querySelector('[data-ch="nome-grupo"]').value = '';
    await sincronizar();
    abrirConversa(String(data));
  }

  // ---------- os cliques (um ouvinte só) ----------
  el.addEventListener('click', async ev => {
    const emo = ev.target.closest('.ch-emoji');
    if (emo && el.contains(emo)) { inserirEmoji(emo.dataset.emoji, ev.detail === 0); return; }
    const abaE = ev.target.closest('.ch-emoji-aba');
    if (abaE && el.contains(abaE)) {
      st.abaEmoji = abaE.dataset.abaEmoji; desenharEmojis();
      const nova = emojisEl.querySelector('.ch-emoji-aba[aria-pressed="true"]');
      if (nova && ev.detail === 0) nova.focus({ preventScroll: true });
      return;
    }
    if (st.emojis && !ev.target.closest('.ch-emojis') && !ev.target.closest('[data-ch="emojis"]') && ev.target !== ta) fecharEmojis();
    const alvo = ev.target.closest('[data-ch], .ch-linha, .ch-achada, .ch-img, .ch-arq[data-caminho]');
    if (!alvo || !el.contains(alvo)) { if (st.menu && !ev.target.closest('.ch-menu-lugar')) fecharMenu(); return; }
    if (st.menu && !alvo.closest('.ch-menu-lugar')) fecharMenu();
    if (alvo.classList.contains('ch-linha')) {
      if (alvo.dataset.conversa) return abrirConversa(alvo.dataset.conversa);
      const pessoa = alvo.dataset.pessoa, ja = minhaConversaCom(pessoa);
      if (ja) return abrirConversa(ja.conversa_id);
      alvo.disabled = true;
      const { data, error } = await supabase.rpc('chat_abrir_direta', { outro: pessoa });
      alvo.disabled = false;
      if (error || !data) { st.erro = erroDoBanco(error, 'Não consegui abrir a conversa agora.'); desenharLista(); return; }
      await sincronizar();
      return abrirConversa(String(data));
    }
    if (alvo.classList.contains('ch-achada')) return abrirConversa(alvo.dataset.conversa, { destacar: alvo.dataset.msg });
    if (alvo.classList.contains('ch-img')) return abrirArquivo(alvo.dataset.caminho, alvo.dataset.nome, false);
    if (alvo.classList.contains('ch-arq')) return abrirArquivo(alvo.dataset.caminho, alvo.dataset.nome, true);
    const k = alvo.dataset.ch;
    if (k === 'voltar') { st.vista = 'lista'; st.menu = false; guardarAba(); aplicarColunas(); desenharLista(); setTimeout(() => { const b = ul.querySelector('.ch-linha'); if (b && !celular) b.focus({ preventScroll: true }); }, 20); }
    else if (k === 'voltar-conversa') { st.vista = 'conversa'; guardarAba(); aplicarColunas(); }
    else if (k === 'menu') { if (st.menu) fecharMenu(); else abrirMenu(); }
    else if (k === 'emojis') {
      if (st.emojis) fecharEmojis();
      else { abrirEmojis(); if (ev.detail === 0) { const b = emojisEl.querySelector('.ch-emoji'); if (b) b.focus({ preventScroll: true }); } }
    }
    else if (k === 'silenciar') { fecharMenu(); silenciar(); }
    else if (k === 'pessoas') { fecharMenu(); st.vista = 'grupo'; st.confirmarSair = false; guardarAba(); if (!st.pessoas.length) await carregarPessoas(); desenharGrupo(); aplicarColunas(); }
    else if (k === 'por' || k === 'renomear' || k === 'sair-sim') acaoNoGrupo(k === 'sair-sim' ? 'sair' : k);
    else if (k === 'sair') { st.confirmarSair = true; desenharGrupo(); }
    else if (k === 'sair-nao') { st.confirmarSair = false; desenharGrupo(); }
    else if (k === 'novo-grupo') { st.vista = 'novo'; guardarAba(); if (!st.pessoas.length) await carregarPessoas(); desenharNovo(); aplicarColunas(); setTimeout(() => vNovo.querySelector('[data-ch="nome-grupo"]').focus({ preventScroll: true }), 20); }
    else if (k === 'criar-grupo') criarGrupo();
    else if (k === 'avisos') {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') pedirAvisos();
      else { gravarLocal(CHAVE_SOM, somLigado() ? 'nao' : 'sim'); desenharAvisos(); try { ctl.anunciar(somLigado() ? 'Bipe ligado.' : 'Bipe desligado.'); } catch (e) { /* sem leitor */ } if (somLigado()) bipe(); }
    }
    else if (k === 'ativar') { gravarLocal(CHAVE_ATIVAR, new Date().toISOString().slice(0, 10)); pedirAvisos(); }
    else if (k === 'agora-nao') { gravarLocal(CHAVE_ATIVAR, new Date().toISOString().slice(0, 10)); desenharAvisos(); }
    else if (k === 'tirar') { st.pendentes = st.pendentes.filter(p => p.id !== alvo.dataset.id); desenharPendentes(); }
    else if (k === 'apagar') { st.confirmarApagar = alvo.dataset.id; desenharMensagens(); const b = msgsEl.querySelector('[data-ch="apagar-nao"]'); if (b) b.focus({ preventScroll: true }); }
    else if (k === 'apagar-nao') { st.confirmarApagar = null; desenharMensagens(); }
    else if (k === 'apagar-sim') apagar(alvo.dataset.id);
    else if (k === 'reenviar') { const m = st.msgs.find(x => x.id === alvo.dataset.id); if (m) enviar(m); }
    else if (k === 'responder') responder(alvo.dataset.id);
    else if (k === 'nao-responder') desistirDeResponder({ foco: true });
    else if (k === 'ir-citada') irParaMensagem(alvo.dataset.id);
    else if (k === 'antigas') {
      const primeira = st.msgs.find(m => !m._enviando && !m._erro);
      if (!primeira) return;
      const altura = msgsEl.scrollHeight - msgsEl.scrollTop;
      try { const mais = await carregarMensagens(st.aberta, { antesDe: primeira.criada_em }); st.msgs = mesclar(st.msgs, mais); st.temAntigas = mais.length >= 50; } catch (e) { mostrarErro(e.message); }
      desenharMensagens({ manter: altura });
    }
    else if (k === 'tentar') { st.erro = ''; desenharLista(); await carregarPessoas(); sincronizar(); }
  });
  el.addEventListener('keydown', ev => {
    if (ev.key === 'Escape' && st.emojis) { ev.preventDefault(); ev.stopPropagation(); const naCaixa = ev.target === ta; fecharEmojis(); if (!naCaixa) emojiBtn.focus({ preventScroll: true }); return; }
    if (ev.key === 'Escape' && st.menu) { ev.preventDefault(); ev.stopPropagation(); fecharMenu(); menuBtn.focus({ preventScroll: true }); return; }
    // Esc na conversa com a resposta montada: desiste dela (o painel fica aberto)
    if (ev.key === 'Escape' && st.respondendo && vConversa.contains(ev.target)) { ev.preventDefault(); ev.stopPropagation(); desistirDeResponder({ foco: true }); }
  });

  // ---------- o tempo real ----------
  function aoChegar(m, { contada = false } = {}) {
    if (!m || !m.conversa_id || !m.id) return;
    const c = conv(m.conversa_id);
    // conversa nova pra mim (o grupo que alguém criou, a de avisos no primeiro aviso): o número vem do banco; depois segue
    // como sempre, sem contar de novo — e o aviso sai com a mensagem de verdade (o botão do aviso do sistema vem nela)
    if (!contada && (!c || (c._recem && Date.now() - c._recem < 30e3))) {
      sincronizar().then(() => { if (conv(m.conversa_id)) aoChegar(m, { contada: true }); });
      return;
    }
    if (!c) return;
    const ja = st.msgs.find(x => x.id === m.id);
    if (st.aberta === m.conversa_id) {
      if (ja) Object.assign(ja, m, { _enviando: false, _erro: null });
      else { st.msgs.push(m); st.msgs.sort(porData); }
      if (st.vista === 'conversa') desenharMensagens();
    }
    const novaUltima = !c.ultima_em || String(m.criada_em) >= String(c.ultima_em) || !c.ultima_autor;
    if (novaUltima) Object.assign(c, { ultima_em: m.criada_em, ultima_autor: m.autor, ultima_texto: m.texto, ultima_anexos: arquivosDe(m).length, ultima_apagada: !!m.apagada_em });
    if (m.autor === eu) { if (!c.lido_ate || m.criada_em > c.lido_ate) c.lido_ate = m.criada_em; }
    else if (vendo(m.conversa_id)) { reivindicar(String(m.id), 0); marcarLido(); try { ctl.anunciar(nomeDe(m.autor) + ': ' + (m.texto || 'arquivo')); } catch (e) { /* sem leitor */ } }
    else if (!ja) { if (!contada) c.nao_lidas = (c.nao_lidas || 0) + 1; avisarDe(c, m); }
    desenharLista(); contar();
  }
  function aoMudarMensagem(m) {
    if (!m || !m.id) return;
    const local = st.msgs.find(x => x.id === m.id);
    if (local) { Object.assign(local, m); if (st.vista === 'conversa') desenharMensagens(); }
    // a citada de uma página antiga (apagaram a original): as citações e a barra acompanham
    const fora = citadas.get(m.id);
    if (fora) { Object.assign(fora, m); if (!local && st.vista === 'conversa' && st.msgs.some(x => x.responde_a === m.id)) desenharMensagens(); }
    if (st.respondendo && st.respondendo.id === m.id) desenharRespondendo();
    const c = conv(m.conversa_id);
    if (c && m.apagada_em) {
      if (c.ultima_em && m.criada_em === c.ultima_em) c.ultima_apagada = true;
      // a que eu não tinha lido some das não lidas
      if (m.autor !== eu && c.nao_lidas && (!c.lido_ate || m.criada_em > c.lido_ate)) c.nao_lidas--;
      desenharLista(); contar();
    }
  }
  function aoMudarMembro(r) {
    if (!r || !r.conversa_id) return;
    const c = conv(r.conversa_id);
    if (r.email === eu) {
      if (!c) return;
      c.silenciada = !!r.silenciada;
      // li em outra tela: as não lidas daqui somem
      if (r.lido_ate && (!c.lido_ate || r.lido_ate > c.lido_ate)) { c.lido_ate = r.lido_ate; if (c.ultima_em && r.lido_ate >= c.ultima_em) c.nao_lidas = 0; }
      desenharLista(); contar();
      if (st.aberta === r.conversa_id) desenharCabecalho();
      return;
    }
    if (st.aberta === r.conversa_id) {
      const m = st.membros.find(x => x.email === r.email);
      if (m) Object.assign(m, r); else st.membros.push(r);
      if (st.vista === 'conversa') desenharMensagens();
    }
  }
  let canal = null, online = null;
  async function ligarTempoReal() {
    if (typeof supabase.channel !== 'function') return;
    try { if (supabase.realtime && typeof supabase.realtime.setAuth === 'function') await supabase.realtime.setAuth(); } catch (e) { /* segue com o token da sessão */ }
    try {
      canal = supabase.channel('chat-db:' + eu)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_mensagens' }, p => aoChegar(p && p.new))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_mensagens' }, p => aoMudarMensagem(p && p.new))
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_membros', filter: 'email=eq.' + eu }, () => sincronizar())
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_membros' }, p => aoMudarMembro(p && p.new))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_conversas' }, p => { const r = p && p.new, c = r && conv(r.id); if (c && r.titulo !== c.titulo) { c.titulo = r.titulo; desenharLista(); desenharCabecalho(); } })
        .subscribe(status => {
          if (status === 'SUBSCRIBED') { if (st.caiu) { st.caiu = false; sincronizar({ avisar: true }); if (st.aberta) recarregarAberta(); } }
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') st.caiu = true;
        });
    } catch (e) { canal = null; }
    // quem está com o sistema aberto: o canal privado "chat:online" (só com login)
    try {
      online = supabase.channel('chat:online', { config: { private: true, presence: { key: eu } } });
      online.on('presence', { event: 'sync' }, () => {
        let s = {};
        try { s = online.presenceState() || {}; } catch (e) { s = {}; }
        st.online = new Set(Object.keys(s).map(k => k.toLowerCase()));
        desenharLista(); if (st.vista === 'conversa') desenharCabecalho(); if (st.vista === 'grupo') desenharGrupo();
        try { ctl.status(); } catch (e) { /* sem balão */ }
      }).subscribe(async status => { if (status === 'SUBSCRIBED') { try { await online.track({ desde: new Date().toISOString() }); } catch (e) { /* sem presença */ } } });
    } catch (e) { online = null; }
  }

  // ---------- a vida da aba ----------
  // voltou pra tela (o computador acordou, a janela veio pra frente): o que chegou enquanto isso e o lido da conversa aberta
  let ultimaVolta = 0;
  const aoVoltar = () => {
    if (!st.pronto) return;
    if (st.aberta && vendo(st.aberta)) marcarLido();
    if (Date.now() - ultimaVolta > 30e3) { ultimaVolta = Date.now(); sincronizar({ avisar: true }); }
  };
  window.addEventListener('focus', aoVoltar);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') aoVoltar(); });
  window.addEventListener('online', () => sincronizar({ avisar: true }));
  // a conferência de garantia: a cada 5 minutos (a cada 1 com o tempo real fora)
  setInterval(() => { if (document.visibilityState === 'visible' || st.caiu) sincronizar({ avisar: true }); }, 60e3 * 5);
  setInterval(() => { if (st.caiu) sincronizar({ avisar: true }); }, 60e3);

  async function comecar() {
    desenharLista();
    try { await supabase.rpc('chat_preparar'); } catch (e) { /* o grupo de todos vem na próxima */ }
    await Promise.all([carregarPessoas(), sincronizar()]);
    ligarTempoReal();
    if (st.vista === 'conversa' && st.aberta && conv(st.aberta)) abrirConversa(st.aberta);
    else if (st.vista === 'novo') desenharNovo();
    else if (st.vista === 'grupo' && conv(st.aberta) && !soLer()) desenharGrupo();
    else if (st.vista !== 'lista') { st.vista = 'lista'; guardarAba(); }
    aplicarColunas();
  }
  aplicarColunas();
  comecar();

  return {
    aoMostrar({ foco = false } = {}) {
      aplicarColunas(); desenharLista(); desenharAvisos();
      if (st.vista === 'conversa' && st.aberta) {
        desenharCabecalho();
        if ((conv(st.aberta) || {}).nao_lidas) recarregarAberta(); else marcarLido();
        if (foco && !celular && !soLer()) setTimeout(() => ta.focus({ preventScroll: true }), 30);
        msgsEl.scrollTop = msgsEl.scrollHeight;
      }
    },
    aoEsconder() { fecharMenu(); fecharEmojis(); },
    status() {
      const outros = [...st.online].filter(e => e !== eu).map(nomeDe);
      if (!st.pronto) return 'Abrindo…';
      return outros.length ? (outros.length <= 3 ? outros.join(', ') + ' online' : outros.length + ' pessoas online') : 'Ninguém mais online agora';
    },
    abrirConversa: id => abrirConversa(id, { mostrar: true })
  };
}
