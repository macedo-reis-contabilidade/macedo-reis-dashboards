// ============================================================
// Consultorias (Comercial, 25/11/2026, pedido do Samuel com a Thalia): as regras puras da tela comercial-consultorias.html.
// As consultorias contábeis do escritório, as sessões de cada uma e a tarefa de montar cada sessão, que o banco cria e
// acompanha (os gatilhos de consultoria_sessoes e consultorias, a função consultoria_sincronizar_sessao). Aqui: o horário
// em texto, o dia da tarefa de montar (a mesma conta do banco, consultoria_dia_de_montar, pra a tela mostrar antes de
// gravar), o colar das datas, o resumo de cada consultoria e a situação da montagem de cada sessão. Sem DOM.
// ============================================================

import { isoValida, somaDias, fmtData, diaSemana, feriado, diaUtil } from './rescisao-datas.js';

// a tarefa de montar aparece 6 dias antes: no exemplo da Thalia, a sessão de segunda, 07/12, se monta a partir de 01/12
export const ANTECEDENCIA_PADRAO = 6;
export const SITUACOES = [['prevista', 'Prevista'], ['realizada', 'Realizada'], ['cancelada', 'Cancelada']];
export const nomeDaSituacao = s => (SITUACOES.find(x => x[0] === s) || [null, s || ''])[1];

// 'HH:MM' ou 'HH:MM:SS' → '9h30', '14h'
export function textoHora(h) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(h || ''));
  if (!m) return '';
  const hora = Number(m[1]), min = Number(m[2]);
  return hora + 'h' + (min ? String(min).padStart(2, '0') : '');
}

// 'das 9h30 às 11h30', 'às 9h30' ou ''
export function faixaDeHorario(ini, fim) {
  const a = textoHora(ini), b = textoHora(fim);
  if (a && b) return a + ' às ' + b;
  if (a) return 'às ' + a;
  return '';
}

// o horário de uma sessão: o dela, campo a campo, senão o da consultoria (como o banco, na descrição da tarefa)
export const horarioDaSessao = (s, c) => faixaDeHorario((s && s.hora_inicio) || (c && c.hora_inicio), (s && s.hora_fim) || (c && c.hora_fim));

// 'segunda-feira, 07/12/2026'
export const dataPorExtenso = iso => (isoValida(iso) ? diaSemana(iso) + ', ' + fmtData(iso) : '');

// por que o dia da sessão pede atenção: 'feriado (Carnaval)', 'sábado', 'domingo' (o dia útil não tem aviso)
export function avisoDoDia(iso) {
  if (!isoValida(iso)) return null;
  const f = feriado(iso);
  if (f) return 'feriado (' + f + ')';
  const d = diaSemana(iso);
  return d === 'sábado' || d === 'domingo' ? d : null;
}

// o dia da tarefa de montar, a conta do banco (consultoria_dia_de_montar): a sessão menos a antecedência, no dia útil
// anterior quando cai em fim de semana ou feriado, e nunca antes de hoje (a sessão de hoje em diante)
export function diaDeMontar(data, dias, hoje) {
  if (!isoValida(data)) return null;
  let d = somaDias(data, -Math.max(0, Number(dias) || 0));
  for (let n = 0; n < 15 && !diaUtil(d); n++) d = somaDias(d, -1);
  const piso = hoje && hoje < data ? hoje : data;
  return d > piso ? d : piso;
}

// ---------- colar as datas ----------
// cada linha com uma data — dd/mm/aaaa, dd/mm/aa, dd/mm (a próxima a partir de hoje) ou aaaa-mm-dd — e, se tiver, o
// horário — "9h30 às 11h30", "09:30 - 11:30", "9h" —. A linha sem data (um título, "Dezembro") fica de fora sem erro.
// (o que vem depois de ":" é hora, não data: "09:30-11:30" não vira 30/11)
const DATA_BR = /(^|[^\d:])(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{4}|\d{2}))?(?!\d)/;
const DATA_ISO = /(\d{4})-(\d{2})-(\d{2})/;
const HORA = '(\\d{1,2})(?:h(\\d{2})?|:(\\d{2}))';
const FAIXA = new RegExp(HORA + '\\s*(?:às|as|a|até|ate|-|–)\\s*' + HORA, 'i');
const UMA_HORA = new RegExp(HORA, 'i');
const doisDigitos = n => String(n).padStart(2, '0');
const horaValida = (h, m) => h >= 0 && h <= 23 && m >= 0 && m <= 59;

function horaDe(g1, g2, g3) {
  const h = Number(g1), m = Number(g2 || g3 || 0);
  return horaValida(h, m) ? doisDigitos(h) + ':' + doisDigitos(m) : null;
}

export function lerHorario(texto) {
  const t = String(texto || '');
  const f = FAIXA.exec(t);
  if (f) {
    const ini = horaDe(f[1], f[2], f[3]), fim = horaDe(f[4], f[5], f[6]);
    if (ini && fim) return { hora_inicio: ini, hora_fim: fim };
  }
  const u = UMA_HORA.exec(t);
  if (u) { const ini = horaDe(u[1], u[2], u[3]); if (ini) return { hora_inicio: ini, hora_fim: null }; }
  return { hora_inicio: null, hora_fim: null };
}

function lerData(linha, hoje) {
  const iso = DATA_ISO.exec(linha);
  if (iso) return { data: iso[1] + '-' + iso[2] + '-' + iso[3], resto: linha.replace(iso[0], ' ') };
  const br = DATA_BR.exec(linha);
  if (!br) return null;
  const dia = Number(br[2]), mes = Number(br[3]);
  let ano = br[4] ? Number(br[4]) : null;
  if (ano != null && ano < 100) ano += 2000;
  const resto = linha.replace(br[0], br[1] + ' ');
  if (ano == null) {
    const anoHoje = Number(String(hoje || '').slice(0, 4)) || new Date().getFullYear();
    let d = anoHoje + '-' + doisDigitos(mes) + '-' + doisDigitos(dia);
    if (hoje && isoValida(d) && d < hoje) d = (anoHoje + 1) + '-' + doisDigitos(mes) + '-' + doisDigitos(dia);
    return { data: d, resto };
  }
  return { data: ano + '-' + doisDigitos(mes) + '-' + doisDigitos(dia), resto };
}

// → [{ linha, data, hora_inicio, hora_fim, problema, escrito? }]: problema é null (entra), 'sem_data' (a linha sem data,
// fica de fora sem aviso), 'invalida', 'passou', 'repetida' (no que foi colado ou numa sessão que já existe) ou 'horario'
// (o fim antes do começo). `existentes`: as datas das sessões que não foram canceladas.
// O ano que não virou (a agenda da Verde Louro, 25/11/2026: dezembro de 2026 e, depois, "12/01/2026"): a data que já
// passou, logo depois de uma data mais nova na lista, entra no ano seguinte quando assim ela segue a ordem — `escrito`
// guarda a data como estava, pra a prévia dizer. A primeira da lista não tem com o que comparar e fica "já passou".
export function lerDatas(texto, { hoje = null, existentes = [] } = {}) {
  const vistas = new Set(existentes);
  let ultima = null;
  return String(texto || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(linha => {
    const achou = lerData(linha, hoje);
    if (!achou) return { linha, data: null, hora_inicio: null, hora_fim: null, problema: 'sem_data' };
    const { hora_inicio, hora_fim } = lerHorario(achou.resto);
    const item = { linha, data: achou.data, hora_inicio, hora_fim, problema: null };
    if (hoje && isoValida(item.data) && item.data < hoje && ultima && ultima > item.data) {
      const seguinte = (Number(item.data.slice(0, 4)) + 1) + item.data.slice(4);
      if (isoValida(seguinte) && seguinte > ultima && seguinte >= hoje) { item.escrito = item.data; item.data = seguinte; }
    }
    if (!isoValida(item.data)) item.problema = 'invalida';
    else if (hoje && item.data < hoje) item.problema = 'passou';
    else if (vistas.has(item.data)) item.problema = 'repetida';
    else if (hora_inicio && hora_fim && hora_fim <= hora_inicio) item.problema = 'horario';
    if (item.problema !== 'invalida' && isoValida(item.data)) vistas.add(item.data);
    // a mais nova da lista até aqui (a repetida conta: a agenda colada de novo, com as primeiras já cadastradas)
    if (isoValida(item.data) && item.problema !== 'passou' && (!ultima || item.data > ultima)) ultima = item.data;
    return item;
  });
}

export const PROBLEMAS = {
  invalida: 'essa data não existe',
  passou: 'essa data já passou',
  repetida: 'já tem sessão nesse dia',
  horario: 'o fim vem antes do começo'
};

// ---------- a consultoria na lista ----------
export const ordenarSessoes = lista => [...(lista || [])].sort((a, b) => String(a.data).localeCompare(String(b.data)));

// quantas sessões (as canceladas à parte), quantas já foram, a próxima prevista e o último dia
export function resumo(sessoes, hoje) {
  const todas = ordenarSessoes(sessoes);
  const validas = todas.filter(s => s.situacao !== 'cancelada');
  const proxima = validas.find(s => s.situacao === 'prevista' && (!hoje || s.data >= hoje)) || null;
  return {
    total: validas.length,
    realizadas: validas.filter(s => s.situacao === 'realizada').length,
    previstas: validas.filter(s => s.situacao === 'prevista').length,
    canceladas: todas.length - validas.length,
    proxima,
    primeira: validas[0] ? validas[0].data : null,
    ultima: validas.length ? validas[validas.length - 1].data : null
  };
}

// a montagem de uma sessão, pela tarefa dela: feita, pra hoje, atrasada, num dia que vem, ou nenhuma
export function montagem(sessao, tarefa, hoje) {
  if (!sessao || sessao.situacao === 'cancelada') return { estado: 'nenhuma', texto: '—' };
  if (tarefa) {
    const quem = tarefa.responsavel ? ' (' + tarefa.responsavel + ')' : '';
    if (tarefa.status === 'concluida') {
      const dia = String(tarefa.concluida_em || '').slice(0, 10);
      return { estado: 'feita', texto: 'Montada' + (isoValida(dia) ? ' em ' + fmtData(dia).slice(0, 5) : '') + quem };
    }
    if (!tarefa.prazo) return { estado: 'futura', texto: 'Montar, sem prazo' + quem };
    if (hoje && tarefa.prazo < hoje) return { estado: 'atrasada', texto: 'Atrasada desde ' + fmtData(tarefa.prazo).slice(0, 5) + quem };
    if (hoje && tarefa.prazo === hoje) return { estado: 'hoje', texto: 'Montar hoje' + quem };
    return { estado: 'futura', texto: 'Montar em ' + fmtData(tarefa.prazo).slice(0, 5) + quem };
  }
  if (sessao.situacao === 'prevista' && (!hoje || sessao.data >= hoje)) return { estado: 'sem', texto: 'Sem a tarefa de montar' };
  return { estado: 'nenhuma', texto: '—' };
}

// o selo do card no Comercial
export function seloDoCard(consultorias) {
  const n = (consultorias || []).filter(c => c.situacao === 'ativa').length;
  return n === 1 ? '1 ativa' : n + ' ativas';
}

// ---------- a pauta da sessão (25/11/2026, como nas Reuniões: os assuntos, o tempo, as anotações e os arquivos) ----------
// os minutos do dia de 'HH:MM' (null sem hora)
export function minutosDoDia(h) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(h || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
const horaDosMinutos = n => doisDigitos(Math.floor(n / 60) % 24) + ':' + doisDigitos(n % 60);

// 45 → '45 min', 60 → '1h', 110 → '1h50'
export function textoMinutos(min) {
  const n = Math.round(Number(min) || 0);
  if (n <= 0) return '0 min';
  if (n < 60) return n + ' min';
  return Math.floor(n / 60) + 'h' + (n % 60 ? doisDigitos(n % 60) : '');
}

// quanto dura a sessão, pelo horário dela (o da sessão, senão o da consultoria)
export function duracaoDaSessao(s, c) {
  const a = minutosDoDia((s && s.hora_inicio) || (c && c.hora_inicio)), b = minutosDoDia((s && s.hora_fim) || (c && c.hora_fim));
  return a != null && b != null && b > a ? b - a : null;
}

const minutosValidos = v => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.round(Number(v)) : 0);
export const ordenarPauta = itens => [...(itens || [])].sort((a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0)
  || String(a.criado_em || '').localeCompare(String(b.criado_em || '')));

// os horários da pauta, a partir do começo da sessão: a abertura e cada assunto com tempo, um depois do outro (o assunto
// sem tempo não tem horário e não empurra os outros) → { abertura: {ini, fim} | null, itens: { id: {ini, fim} }, total, fim }
export function cronograma(inicio, aberturaMin, itens) {
  const comeco = minutosDoDia(inicio);
  const out = { abertura: null, itens: {}, total: 0, fim: null };
  let t = comeco;
  const ab = minutosValidos(aberturaMin);
  if (ab) { if (t != null) { out.abertura = { ini: horaDosMinutos(t), fim: horaDosMinutos(t + ab) }; t += ab; } out.total += ab; }
  ordenarPauta(itens).forEach(p => {
    const m = minutosValidos(p.minutos);
    if (!m) return;
    if (t != null) { out.itens[p.id] = { ini: horaDosMinutos(t), fim: horaDosMinutos(t + m) }; t += m; }
    out.total += m;
  });
  if (t != null && out.total) out.fim = horaDosMinutos(t);
  return out;
}
export const faixaDoCronograma = f => (f ? textoHora(f.ini) + ' às ' + textoHora(f.fim) : '');

// o tempo da pauta contra o da sessão: '1h50 de 2h', 'passa 20 min do horário' (passou: true)
export function tempoDaPauta(total, duracao) {
  if (!total) return { texto: duracao ? 'Sem tempo marcado (a sessão tem ' + textoMinutos(duracao) + ')' : '', passou: false };
  if (!duracao) return { texto: textoMinutos(total) + ' de pauta', passou: false };
  if (total > duracao) return { texto: textoMinutos(total) + ' de pauta: passa ' + textoMinutos(total - duracao) + ' do horário', passou: true };
  return { texto: textoMinutos(total) + ' de ' + textoMinutos(duracao), passou: false };
}

// a pauta na lista das sessões: '4 assuntos · 1h50', '1 assunto', 'vazia'
export function resumoDaPauta(itens) {
  const n = (itens || []).length;
  if (!n) return 'vazia';
  const min = (itens || []).reduce((s, p) => s + minutosValidos(p.minutos), 0);
  return (n === 1 ? '1 assunto' : n + ' assuntos') + (min ? ' · ' + textoMinutos(min) : '');
}

// mudar a ordem com as setas: troca com o vizinho e numera de 1 em diante; devolve só o que mudou ([{ id, ordem }])
export function trocarOrdem(itens, id, direcao) {
  const lista = ordenarPauta(itens);
  const i = lista.findIndex(p => p.id === id), j = i + (direcao < 0 ? -1 : 1);
  if (i < 0 || j < 0 || j >= lista.length) return [];
  [lista[i], lista[j]] = [lista[j], lista[i]];
  return lista.map((p, k) => ({ id: p.id, ordem: k + 1, era: Number(p.ordem) || 0 })).filter(x => x.ordem !== x.era).map(({ id, ordem }) => ({ id, ordem }));
}
export const proximaOrdem = itens => (itens || []).reduce((m, p) => Math.max(m, Number(p.ordem) || 0), 0) + 1;

// copiar a pauta: a sessão anterior (pela data, não cancelada) que tem assunto, e o que vai de cada um (o assunto, o
// detalhe, o tempo e se é só do escritório: as anotações e os arquivos são daquela sessão e ficam)
export function sessaoAnteriorComPauta(sessoes, atual, contagem) {
  if (!atual) return null;
  return ordenarSessoes(sessoes).filter(s => s.id !== atual.id && s.situacao !== 'cancelada' && s.data < atual.data && (contagem[s.id] || 0) > 0).pop() || null;
}
export const itensParaCopiar = itens => ordenarPauta(itens).map((p, k) => ({
  titulo: p.titulo, descricao: p.descricao || null, minutos: minutosValidos(p.minutos) || null, interno: !!p.interno, ordem: k + 1
}));

// ---------- os arquivos (a pasta privada "consultorias": <sessão>/<id>-<nome>, 25 MB cada, até 20 por assunto) ----------
export const MAX_ARQUIVO = 25 * 1024 * 1024;
export const MAX_ANEXOS = 20;
const semAcento = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
export function nomeSeguro(nome) {
  const s = semAcento(nome || 'arquivo').replace(/[\/\\]+/g, '_').replace(/[^A-Za-z0-9._ ()-]+/g, '_').replace(/\s+/g, ' ').trim();
  const ponto = s.lastIndexOf('.');
  const ext = ponto > 0 && s.length - ponto <= 12 ? s.slice(ponto) : '';
  const base = (ext ? s.slice(0, ponto) : s).replace(/^[.\s]+/, '').slice(0, 100) || 'arquivo';
  return base + ext;
}
export const caminhoDoArquivo = (sessaoId, id, nome) => sessaoId + '/' + id + '-' + nomeSeguro(nome);
export const ehImagem = a => /^image\/(png|jpe?g|gif|webp)$/i.test(String((a && a.tipo) || ''));

// os que cabem: até 25 MB e até 20 no assunto → { ok: [arquivos], recusados: [{ nome, motivo }] }
export function conferirArquivos(arquivos, jaTem = 0) {
  const ok = [], recusados = [];
  [...(arquivos || [])].forEach(f => {
    if (!f) return;
    if (!f.size) recusados.push({ nome: f.name, motivo: 'está vazio' });
    else if (f.size > MAX_ARQUIVO) recusados.push({ nome: f.name, motivo: 'passa de 25 MB' });
    else if (jaTem + ok.length >= MAX_ANEXOS) recusados.push({ nome: f.name, motivo: 'o assunto já tem ' + MAX_ANEXOS + ' arquivos' });
    else ok.push(f);
  });
  return { ok, recusados };
}

// 850 → '850 bytes', 12_345 → '12 KB', 1_234_567 → '1,2 MB'
export function tamanhoDoArquivo(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return n + ' bytes';
  if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB';
  return (n / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB';
}

// o anexo como foi gravado: só o que a tela usa, conferido (o que vier diferente fica de fora)
export function anexosValidos(lista, sessaoId) {
  return (Array.isArray(lista) ? lista : []).filter(a => a && typeof a.caminho === 'string' && a.caminho.startsWith(String(sessaoId) + '/')
    && typeof a.nome === 'string' && a.nome.trim()).slice(0, MAX_ANEXOS)
    .map(a => ({ caminho: a.caminho, nome: a.nome.trim().slice(0, 200), tamanho: Number(a.tamanho) || 0, tipo: typeof a.tipo === 'string' ? a.tipo.slice(0, 100) : '' }));
}

// o título do documento da sessão: com anotação, é a pauta com o que foi conversado
export function tituloDoDocumento(itens, sessao) {
  const anotou = (itens || []).some(p => !p.interno && String(p.discussao || '').trim()) || String((sessao && sessao.anotacoes) || '').trim();
  return anotou ? 'Pauta e anotações da sessão' : 'Pauta da sessão';
}
