// ============================================================
// MACEDO & REIS — Assistente do escritório: o mesmo balão em todas as telas com login (14/10/2026)
// O auth-guard monta (iniciarAssistente) depois de conferir a sessão: a carinha no canto de toda tela, com a conversa que
// acompanha de tela em tela (a mesma chave da aba, "mr_assistente:escritorio"). A pergunta vai pra Edge Function
// "assistente", que lê tudo do sistema (só leitura, com o login de quem pergunta) e repassa o que é da Reforma pro chat
// da Reforma. Trocou de tela no meio da resposta: a tela nova retoma pelo id da pergunta (assistente_chat).
// Por tela: o nome e o setor (a função sabe onde a pessoa está), as perguntas prontas e o recado do dia — uma vez por dia
// em cada tela, o que ela tem de novo, contado direto do banco, sem IA (na primeira tela do dia, a saudação com a agenda
// de quem entrou). A carinha comemora quando alguém conclui tarefa ou rotina (evento "mr:feito", da agenda e das telas de
// tarefas) e fica discreta quando uma janela está aberta. Na ficha da empresa (clientes/editar.html?id=…), "esta empresa"
// é ela. Uma tela com coisa própria (a Reforma: a ficha, o cálculo, a Base legal) chama assistenteDaTela({...}).
// As fontes da Reforma ([CODIGO]) viram link: material → o original no Drive; regra → a Base legal (na tela da Reforma,
// por cima; nas outras, fiscal-reforma.html#regra-COD). Testes de tela: tests/harness/assistente-escritorio.py.
// ============================================================

import { supabase } from './supabase.js';
import { montarAssistente, perguntarFuncao, textoParaHtml, escapeHtml } from './assistente.js';
import { nomePorEmail, SOCIOS } from './equipe.js';
import { janelaDeCima } from './janelas.js';

const RAIZ = new URL('../../', import.meta.url);   // a raiz do site (este arquivo mora em assets/js/)

// ---------- a tela ----------
export function caminhoDaTela(href = location.href) {
  const u = new URL(href);
  let c = decodeURIComponent(u.pathname);
  if (c.startsWith(RAIZ.pathname)) c = c.slice(RAIZ.pathname.length);
  c = c.replace(/^\/+/, '');
  if (!c || c.endsWith('/')) c += 'index.html';
  return c;
}
export function setorDaTela(c) {
  if (c.startsWith('clientes/')) return 'clientes';
  if (c === 'fator-r.html') return 'contabil';
  const m = /^(dp|fiscal|contabil|financeiro|comercial|societario|irpf|gestao)[-.]/.exec(c);
  return m ? m[1] : null;
}
const NOME_SETOR = { dp: 'DP', fiscal: 'Fiscal', contabil: 'Contábil', financeiro: 'Financeiro', comercial: 'Comercial', societario: 'Societário', irpf: 'IRPF', gestao: 'Gestão', clientes: 'Clientes' };

// ---------- datas e contas pequenas ----------
const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const hojeISO = () => ymd(new Date());
const maisDias = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return ymd(d); };
const dataBR = iso => String(iso || '').slice(0, 10).split('-').reverse().join('/');
const qtd = (n, um, varios) => n + ' ' + (n === 1 ? um : varios);
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const contar = async q => { try { const { count, error } = await q; return error ? null : (count || 0); } catch (e) { return null; } };
const tarefasAbertas = () => supabase.from('tarefas').select('id', { count: 'exact', head: true }).neq('status', 'concluida');

// ---------- as perguntas prontas, por setor e por tela ----------
const EXEMPLOS_SETOR = {
  dp: ['Quais admissões chegaram e ainda não foram registradas?', 'Alguma rescisão com pagamento até o fim da semana?', 'O que está atrasado no DP?'],
  fiscal: ['O que do fiscal vence esta semana?', 'O que está atrasado no fiscal?', 'Quais casos da Reforma estão sem conclusão?'],
  contabil: ['O que do contábil vence esta semana?', 'O que está atrasado no contábil?'],
  financeiro: ['Quais boletos deste mês ainda não foram pagos?', 'Quem está inadimplente e desde quando?', 'Tem faturável pra entrar no boleto?'],
  comercial: ['Quem entrou e quem saiu da carteira este ano?', 'Quais propostas estão em aberto?', 'Como estão as transições em andamento?'],
  societario: ['Quais alvarás vencem nos próximos 60 dias?', 'O que está atrasado no societário?'],
  irpf: ['Quantas declarações deste ano faltam entregar?', 'Quem ainda não pagou o IRPF?'],
  gestao: ['O que está atrasado no escritório, por pessoa?', 'Quantas tarefas cada um concluiu esta semana?'],
  clientes: ['Quantos clientes temos na carteira, por regime?', 'Quais empresas entraram na carteira este mês?']
};
const EXEMPLOS_GERAIS = ['O que tenho pra hoje?', 'O que está atrasado no escritório, por pessoa?', 'Quais boletos deste mês ainda não foram pagos?'];

// dica(): o recado do dia da tela — contado direto do banco, sem IA; null = nada a dizer hoje
const dicaSetor = setor => async () => {
  const hoje = hojeISO();
  const [nHoje, nAtras] = await Promise.all([contar(tarefasAbertas().eq('setor', setor).eq('prazo', hoje)), contar(tarefasAbertas().eq('setor', setor).lt('prazo', hoje))]);
  if (!nHoje && !nAtras) return null;
  return { texto: NOME_SETOR[setor] + ': ' + [nHoje ? qtd(nHoje, 'tarefa pra hoje', 'tarefas pra hoje') : '', nAtras ? qtd(nAtras, 'atrasada', 'atrasadas') : ''].filter(Boolean).join(' e ') + '.',
    exemplos: nAtras ? ['O que está atrasado no ' + NOME_SETOR[setor] + ', por pessoa?'] : ['O que do ' + NOME_SETOR[setor] + ' vence hoje?'] };
};
const TELAS = {
  'index.html': { nome: 'Painel central', exemplos: EXEMPLOS_GERAIS },
  'agenda.html': { nome: 'Agenda', exemplos: ['O que tenho pra hoje?', 'O que tenho esta semana?', 'O que está atrasado, por pessoa?'] },
  'ajuda.html': { nome: 'Ajuda', exemplos: ['O que mudou no sistema esta semana?', 'Onde vejo os boletos do mês?'] },
  'clientes/index.html': { nome: 'Clientes' },
  'clientes/editar.html': { nome: 'Ficha da empresa' },
  'clientes/novo.html': { nome: 'Novo cliente' },
  'financeiro-boletos.html': { nome: 'Boletos', exemplos: ['Quais boletos deste mês ainda não foram pagos?', 'Quanto vamos cobrar este mês no total?', 'Quem está inadimplente e desde quando?'],
    dica: async () => {
      const hoje = hojeISO(), comp = hoje.slice(0, 7), mes = MESES[+comp.slice(5) - 1];
      const { data, error } = await supabase.from('cobrancas_mensais').select('status, vencimento').eq('competencia', comp);
      if (error) return null;
      if (!data.length) return { texto: 'Os boletos de ' + mes + ' ainda não foram gerados.', exemplos: ['Quanto vamos cobrar este mês no total?'] };
      const aEmitir = data.filter(x => x.status === 'a_emitir').length;
      const abertos = data.filter(x => x.status === 'emitido' || x.status === 'enviado');
      const vencidos = abertos.filter(x => x.vencimento && x.vencimento < hoje).length;
      const semana = abertos.filter(x => x.vencimento && x.vencimento >= hoje && x.vencimento <= maisDias(hoje, 7)).length;
      const partes = [aEmitir ? qtd(aEmitir, 'boleto a emitir', 'boletos a emitir') : '', semana ? qtd(semana, 'vence nos próximos 7 dias', 'vencem nos próximos 7 dias') : '',
        vencidos ? qtd(vencidos, 'vencido ainda sem "pago"', 'vencidos ainda sem "pago"') : ''].filter(Boolean);
      return partes.length ? { texto: 'Boletos de ' + mes + ': ' + partes.join(', ') + '.', exemplos: ['Quais boletos deste mês ainda não foram pagos?'] } : null;
    } },
  'financeiro-faturaveis.html': { nome: 'Faturáveis', exemplos: ['O que tem a faturar e de quem?', 'Quanto tem a faturar no total?'],
    dica: async () => { const n = await contar(supabase.from('faturaveis').select('id', { count: 'exact', head: true }).eq('status', 'a_faturar'));
      return n ? { texto: qtd(n, 'serviço extra esperando', 'serviços extras esperando') + ' pra entrar no boleto.', exemplos: ['O que tem a faturar e de quem?'] } : null; } },
  'comercial-carteira.html': { nome: 'Carteira', exemplos: ['Quem está inadimplente e desde quando?', 'Quem entrou e quem saiu da carteira este ano?', 'Quantos clientes temos por segmento?'],
    dica: async () => {
      const hoje = hojeISO(), ini = hoje.slice(0, 8) + '01';
      const [inad, entr, sai] = await Promise.all([
        contar(supabase.from('carteira_info').select('cliente_id', { count: 'exact', head: true }).not('inadimplente_desde', 'is', null).or('saida.is.null,saida.gt.' + hoje)),
        contar(supabase.from('carteira_info').select('cliente_id', { count: 'exact', head: true }).gte('entrada', ini).lte('entrada', hoje)),
        contar(supabase.from('carteira_info').select('cliente_id', { count: 'exact', head: true }).gte('saida', ini).lte('saida', hoje))]);
      const partes = [inad ? qtd(inad, 'cliente inadimplente', 'clientes inadimplentes') : '', entr ? qtd(entr, 'entrada', 'entradas') + ' este mês' : '', sai ? qtd(sai, 'saída', 'saídas') + ' este mês' : ''].filter(Boolean);
      return partes.length ? { texto: 'Carteira: ' + partes.join(', ') + '.', exemplos: inad ? ['Quem está inadimplente e desde quando?'] : ['Quem entrou e quem saiu da carteira este ano?'] } : null;
    } },
  'comercial-precificacao.html': { nome: 'Precificação', exemplos: ['Quais propostas estão em aberto e de quanto?', 'Quantas propostas fechamos este ano?'],
    dica: async () => { const n = await contar(supabase.from('precificacoes').select('id', { count: 'exact', head: true }).in('status', ['recebida', 'calculada', 'apresentada']));
      return n ? { texto: qtd(n, 'proposta em aberto', 'propostas em aberto') + ' (recebida, calculada ou apresentada).', exemplos: ['Quais propostas estão em aberto e de quanto?'] } : null; } },
  'comercial-transicao.html': { nome: 'Transição de clientes', exemplos: ['Como estão as transições em andamento?', 'Quais tarefas de transição estão atrasadas?'],
    dica: async () => {
      const [n, atras] = await Promise.all([contar(supabase.from('transicoes').select('id', { count: 'exact', head: true }).eq('status', 'em_andamento')),
        contar(tarefasAbertas().not('transicao_id', 'is', null).lt('prazo', hojeISO()))]);
      return n ? { texto: qtd(n, 'transição em andamento', 'transições em andamento') + (atras ? ', com ' + qtd(atras, 'tarefa atrasada', 'tarefas atrasadas') : '') + '.', exemplos: ['Como estão as transições em andamento?'] } : null;
    } },
  'comercial-reunioes.html': { nome: 'Reuniões', exemplos: ['Quais reuniões estão marcadas?', 'Quais reuniões foram feitas este mês?'] },
  'dp-admissoes.html': { nome: 'Admissões', exemplos: ['Quais admissões chegaram e ainda não foram registradas?', 'Alguma admissão sem vínculo com o cadastro?'],
    dica: async () => { const n = await contar(supabase.from('admissoes').select('id', { count: 'exact', head: true }).eq('status', 'respondida'));
      return n ? { texto: n === 1 ? '1 admissão chegou e ainda não foi registrada.' : n + ' admissões chegaram e ainda não foram registradas.', exemplos: ['Quais admissões chegaram e ainda não foram registradas?'] } : null; } },
  'dp-rescisoes.html': { nome: 'Rescisões', exemplos: ['Quais rescisões têm pagamento até o fim da semana?', 'Quais rescisões ainda estão a calcular?'],
    dica: async () => {
      const hoje = hojeISO();
      const { data, error } = await supabase.from('rescisoes').select('status, data_acerto').in('status', ['recebida', 'em_andamento']);
      if (error || !data.length) return null;
      const breve = data.filter(x => x.data_acerto && x.data_acerto >= hoje && x.data_acerto <= maisDias(hoje, 5)).length;
      const passou = data.filter(x => x.data_acerto && x.data_acerto < hoje).length;
      const aCalc = data.filter(x => x.status === 'recebida').length;
      const partes = [breve ? qtd(breve, 'rescisão com pagamento nos próximos 5 dias', 'rescisões com pagamento nos próximos 5 dias') : '', passou ? qtd(passou, 'com o prazo de pagamento já passado', 'com o prazo de pagamento já passado') : '',
        aCalc ? qtd(aCalc, 'a calcular', 'a calcular') : ''].filter(Boolean);
      return partes.length ? { texto: 'Rescisões: ' + partes.join(', ') + '.', exemplos: ['Quais rescisões têm pagamento até o fim da semana?'] } : null;
    } },
  'dp-convencoes.html': { nome: 'Convenções coletivas', exemplos: ['Quais convenções vencem este ano?', 'Qual o piso do comércio?'] },
  'dp-pareceres.html': { nome: 'Pareceres' }, 'dp-custo.html': { nome: 'Custo do funcionário' },
  'fiscal-obrigacoes.html': { nome: 'Obrigações', exemplos: ['Quais obrigações vencem esta semana?', 'Quais obrigações estão atrasadas, por pessoa?'],
    dica: async () => {
      const hoje = hojeISO();
      const [semana, atras] = await Promise.all([contar(tarefasAbertas().not('obrigacao_id', 'is', null).gte('prazo', hoje).lte('prazo', maisDias(hoje, 7))),
        contar(tarefasAbertas().not('obrigacao_id', 'is', null).lt('prazo', hoje))]);
      const partes = [semana ? qtd(semana, 'obrigação vence nos próximos 7 dias', 'obrigações vencem nos próximos 7 dias') : '', atras ? qtd(atras, 'atrasada', 'atrasadas') : ''].filter(Boolean);
      return partes.length ? { texto: partes.join(' e ') + '.', exemplos: ['Quais obrigações vencem esta semana?'] } : null;
    } },
  'fiscal-reforma.html': { nome: 'Reforma Tributária',
    dica: async () => {
      const { data, error } = await supabase.from('rt_casos').select('decisao, prazo_opcao').eq('decisao', 'pendente');
      if (error) return null;
      const prazo = data.map(x => x.prazo_opcao).filter(Boolean).sort()[0];
      const dias = prazo ? Math.round((new Date(prazo + 'T12:00:00') - new Date(hojeISO() + 'T12:00:00')) / 864e5) : null;
      if (!data.length) return null;
      return { texto: qtd(data.length, 'caso da Reforma ainda sem decisão', 'casos da Reforma ainda sem decisão') + (dias != null && dias >= 0 ? ' — faltam ' + qtd(dias, 'dia', 'dias') + ' pro prazo da opção (' + dataBR(prazo) + ')' : '') + '.',
        exemplos: ['Quais casos estão sem conclusão e o que falta em cada um?'] };
    } },
  'fiscal-regularizacao.html': { nome: 'Regularizações', exemplos: ['Quais regularizações estão em aberto?'] },
  'fiscal-xml.html': { nome: 'Notas fiscais (XML)' }, 'fiscal-analise.html': { nome: 'Análise fiscal' }, 'fiscal-clientes.html': { nome: 'Fiscal por cliente' },
  'contabil-dre.html': { nome: 'DRE do cliente' }, 'fator-r.html': { nome: 'Fator R' },
  'societario-alvaras.html': { nome: 'Alvarás', exemplos: ['Quais alvarás vencem nos próximos 60 dias?', 'Algum alvará vencido?'],
    dica: async () => {
      const hoje = hojeISO();
      const [venc, breve] = await Promise.all([contar(supabase.from('alvaras').select('id', { count: 'exact', head: true }).lt('vencimento', hoje)),
        contar(supabase.from('alvaras').select('id', { count: 'exact', head: true }).gte('vencimento', hoje).lte('vencimento', maisDias(hoje, 60)))]);
      const partes = [venc ? qtd(venc, 'alvará vencido', 'alvarás vencidos') : '', breve ? qtd(breve, 'vence nos próximos 60 dias', 'vencem nos próximos 60 dias') : ''].filter(Boolean);
      return partes.length ? { texto: partes.join(' e ') + '.', exemplos: ['Quais alvarás vencem nos próximos 60 dias?'] } : null;
    } },
  'irpf-declaracoes.html': { nome: 'Declarações de IRPF', exemplos: ['Quantas declarações deste ano faltam entregar?', 'Quem ainda não pagou o IRPF?'] }
};
// as telas dos setores (hub e Tarefas) contam as tarefas do setor
['dp', 'fiscal', 'contabil', 'financeiro', 'comercial', 'societario', 'irpf', 'gestao'].forEach(s => {
  [s + '.html', s + '-tarefas.html'].forEach(c => { if (!TELAS[c]) TELAS[c] = { nome: c.includes('-tarefas') ? 'Tarefas · ' + NOME_SETOR[s] : NOME_SETOR[s], dica: dicaSetor(s) }; });
});

const nomeDoTitulo = () => String(document.title || '').replace(/\s*[—–-]\s*Macedo\s*&(amp;)?\s*Reis.*$/i, '').replace(/^Macedo\s*&\s*Reis\s*[—–-]\s*/i, '').trim().slice(0, 60);

// ---------- as fontes da Reforma nas respostas ----------
const fontes = { materiais: null, regras: null, carregando: null };
const linkDrive = u => (/^https:\/\/(drive|docs)\.google\.com\//.test(String(u || '')) ? String(u) : null);
function carregarFontes() {
  if (fontes.materiais || fontes.carregando) return fontes.carregando;
  fontes.carregando = Promise.all([
    supabase.from('rt_materiais').select('codigo, titulo, drive_url').eq('ativo', true),
    supabase.from('rt_regras').select('codigo, titulo').eq('ativo', true)
  ]).then(([m, r]) => {
    if (m.error || r.error) { fontes.carregando = null; return; }
    fontes.materiais = new Map((m.data || []).map(x => [x.codigo, x]));
    fontes.regras = new Map((r.data || []).map(x => [x.codigo, x]));
    if (api) api.redesenhar();
  }).catch(() => { fontes.carregando = null; });
  return fontes.carregando;
}
// uma fonte citada ("CODIGO, onde", "regra CODIGO", "regras A e B"): todo código da base vira link — o material abre o
// original no Drive (só endereço do Google), a regra abre a Base legal. Código que não existe fica texto. Chega escapado
function fonteDaReforma(parte) {
  const temRegra = c => fontes.regras.has(c), temMaterial = c => fontes.materiais.has(c);
  const regra = (cod, rot) => '<a class="fonte" href="' + escapeHtml(new URL('fiscal-reforma.html#regra-' + cod, RAIZ).href) + '" data-regra="' + cod + '" title="'
    + escapeHtml('Base legal — ' + (fontes.regras.get(cod).titulo || cod)) + '">' + rot + '</a>';
  const material = cod => {
    const m = fontes.materiais.get(cod), url = linkDrive(m.drive_url);
    const tit = escapeHtml((m.titulo || cod) + (url ? ' — abre o original no Drive' : ''));
    return url ? '<a class="fonte" href="' + escapeHtml(url) + '" target="_blank" rel="noopener" title="' + tit + '">' + cod + '</a>' : '<span class="fonte" title="' + tit + '">' + cod + '</span>';
  };
  const rg = /^(\s*)(regras?\s+)([A-Za-z0-9][A-Za-z0-9-]*)/i.exec(parte);
  let inicio = '', resto = parte;
  if (rg && temRegra(rg[3].toUpperCase())) { inicio = rg[1] + regra(rg[3].toUpperCase(), 'regra ' + rg[3].toUpperCase()); resto = parte.slice(rg[0].length); }
  return inicio + resto.replace(/\b[A-Z0-9]{2,}(?:-[A-Z0-9]+)+\b/g, cod => temRegra(cod) && (rg || !temMaterial(cod)) ? regra(cod, cod) : temMaterial(cod) ? material(cod) : cod);
}
const fontesDoColchete = dentro => dentro.split(/([;·])/).map((p, i) => (i % 2 ? p : fonteDaReforma(p))).join('');
function formatar(texto) {
  if (!fontes.materiais && /\[[^\]\n]*\b[A-Z0-9]{2,}-[A-Z0-9]/.test(String(texto || ''))) carregarFontes();
  return textoParaHtml(texto, fontes.materiais ? { fontes: fontesDoColchete } : {});
}

// ---------- a resposta retomada depois de trocar de tela ----------
// a pergunta segue na função mesmo com a tela fechada; aqui a tela nova lê a linha do histórico (cada um lê as suas)
async function retomar(pedido, aoEtapa) {
  const espera = ms => new Promise(r => setTimeout(r, ms));
  const fim = Date.now() + 170000;
  let semLinha = 0;
  aoEtapa('Terminando a resposta…');
  while (Date.now() < fim) {
    const { data, error } = await supabase.from('assistente_chat').select('situacao, resposta, aviso, fontes').eq('id', pedido).maybeSingle();
    if (!error && data) {
      if (data.situacao === 'ok') return { texto: data.resposta || '', cortada: !!(data.fontes && data.fontes.cortada) };
      if (data.situacao === 'erro') throw new Error(data.aviso || 'Não consegui responder agora. Tente de novo em instantes.');
    } else if (!error && ++semLinha >= 5) return null;   // a pergunta não chegou a sair da tela anterior
    await espera(2000);
  }
  throw new Error('A resposta demorou demais. Tente de novo.');
}

// ---------- a montagem ----------
let api = null, email = '', socio = false, nomePessoa = null, ctxPendente;
const tela = {};   // o que a tela registrou (assistenteDaTela)
const caminho = caminhoDaTela();
const setor = setorDaTela(caminho);
const cfg = TELAS[caminho] || {};
const nomeTela = () => cfg.nome || nomeDoTitulo() || caminho;

// a tela registra o que é dela; vale antes ou depois da montagem
export function assistenteDaTela(config = {}) {
  Object.assign(tela, config);
  if (api) api.atualizar();
  return {
    definirContexto(c) { ctxPendente = c || null; if (api) api.definirContexto(ctxPendente); },
    atualizar() { if (api) api.atualizar(); }
  };
}

export function iniciarAssistente({ email: e } = {}) {
  if (api) return api;
  email = String(e || '').toLowerCase();
  socio = SOCIOS.includes(email);
  nomePessoa = nomePorEmail(email);
  try { api = montar(); } catch (err) { console.error('Assistente do escritório fora do ar:', err); api = null; return null; }
  if (ctxPendente !== undefined) api.definirContexto(ctxPendente);
  else if (caminho === 'clientes/editar.html') contextoDaEmpresa();
  setTimeout(recadoDoDia, 1600);
  ligarVida();
  return api;
}

function montar() {
  return montarAssistente({
    id: 'escritorio',
    nome: 'Assistente do escritório',
    rotulo: 'Perguntar ao assistente do escritório',
    placeholder: 'Pergunte o que precisar…',
    status: () => 'Vê tudo do sistema · ' + nomeTela(),
    saudacao: () => '<p>Oi' + (nomePessoa ? ', ' + escapeHtml(nomePessoa) : '') + '! Eu vejo tudo do sistema — empresas, agenda, boletos, DP, fiscal, comercial — '
      + 'e a base da Reforma, em qualquer tela. Pergunte com as suas palavras.</p><p>Só leio: pra mudar alguma coisa, eu digo em que tela se faz.</p>' + (tela.saudacaoExtra || ''),
    exemplos: c => (tela.exemplos && tela.exemplos(c)) || (c && c.tipo === 'cliente' ? ['Me resume esta empresa', 'O que está pendente com ela?', 'Ela está em dia com os honorários?'] : null)
      || cfg.exemplos || EXEMPLOS_SETOR[setor] || EXEMPLOS_GERAIS,
    seguintes: c => (tela.seguintes ? tela.seguintes(c) : c && c.tipo === 'cliente' ? ['O que está pendente com ela?', 'Ela está em dia com os honorários?'] : []),
    recadoContexto: c => (tela.recadoContexto ? tela.recadoContexto(c) : c && c.tipo === 'cliente' ? { texto: 'Quer um resumo de ' + c.nome + '? Eu junto tudo o que o sistema tem dela.', exemplos: ['Me resume esta empresa'] } : null),
    contexto: c => ({ pagina: { caminho, nome: nomeTela(), setor }, ...(c && c.tipo === 'cliente' ? { cliente_id: c.clienteId } : {}), ...(tela.contexto ? tela.contexto(c) || {} : {}) }),
    perguntar: perguntarFuncao(supabase, 'assistente'),
    retomar,
    formatar,
    // na tela da Reforma as respostas citam a base: os códigos vêm antes (nas outras, só quando uma resposta cita)
    antes: () => (caminho === 'fiscal-reforma.html' ? carregarFontes() : null),
    aoClicar: ev => (tela.aoClicar ? tela.aoClicar(ev) : false)
  });
}

// a ficha da empresa aberta: "esta empresa" é ela
async function contextoDaEmpresa() {
  const id = new URLSearchParams(location.search).get('id');
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return;
  const { data } = await supabase.from('clientes').select('id, nome_principal').eq('id', id).maybeSingle();
  if (data && api) api.definirContexto({ id: 'cliente:' + data.id, tipo: 'cliente', clienteId: data.id, nome: data.nome_principal, rotulo: 'Sobre a empresa aberta', nota: 'Sobre ' });
}

// ---------- vida sem chat ----------
const guardado = {
  ler(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  gravar(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sem armazenamento */ } }
};
// o recado do dia: na primeira tela do dia, a saudação com a agenda de quem entrou; depois, uma vez por dia em cada tela, o
// que ela tem de novo. Nunca com o painel aberto, com pergunta no ar ou com a aba escondida
async function recadoDoDia() {
  if (!api || api.aberto || api.ocupado || document.visibilityState === 'hidden') return;
  const hoje = hojeISO(), base = 'mr_assistente_dia:' + email + ':' + hoje + ':';
  try {
    if (!guardado.ler(base + 'saudacao')) {
      const r = await saudacaoDoDia();
      guardado.gravar(base + 'saudacao', '1');
      if (r) { api.avisar({ texto: r.texto, exemplos: r.exemplos, ms: 15000 }); return; }
    }
    const dica = cfg.dica || null;
    if (!dica || guardado.ler(base + caminho)) return;
    guardado.gravar(base + caminho, '1');
    const r = await dica();
    if (r && !api.aberto) api.avisar({ texto: r.texto, exemplos: r.exemplos, ms: 14000 });
  } catch (e) { /* o recado é enfeite: erro aqui não atrapalha a tela */ }
}
async function saudacaoDoDia() {
  const h = new Date().getHours();
  const oi = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  if (!nomePessoa) return { texto: oi + '! Eu vejo tudo do sistema, em qualquer tela — é só perguntar.', exemplos: EXEMPLOS_GERAIS.slice(0, 2) };
  const hoje = hojeISO();
  // o nome no filtro como na função: a letra acentuada vira "_" (Vit_ria pega Vitória, Vitoria e VITÓRIA)
  const padrao = nomePessoa.replace(/[^\x00-\x7F]/g, '_');
  const daPessoa = q => (socio ? q.or('responsavel.ilike.' + padrao + ',responsavel.ilike.ambos') : q.ilike('responsavel', padrao));
  const [nHoje, nAtras] = await Promise.all([contar(daPessoa(tarefasAbertas().eq('prazo', hoje))), contar(daPessoa(tarefasAbertas().lt('prazo', hoje)))]);
  let t = oi + ', ' + nomePessoa + '! ';
  if (nHoje == null || nAtras == null) t += 'Eu vejo tudo do sistema, em qualquer tela — é só perguntar.';
  else if (!nHoje && !nAtras) t += 'Nenhuma tarefa sua pra hoje nem atrasada.';
  else t += 'Hoje você tem ' + qtd(nHoje, 'tarefa', 'tarefas') + (nAtras ? ', e ' + qtd(nAtras, 'atrasada', 'atrasadas') : '') + '.';
  return { texto: t, exemplos: nAtras ? ['O que tenho pra hoje?', 'O que está atrasado comigo?'] : ['O que tenho pra hoje?'] };
}

function ligarVida() {
  // comemora quem conclui (agenda, telas de tarefas, rotinas): a carinha sorri e pula; a cada 5 no dia, um recadinho
  window.addEventListener('mr:feito', ev => {
    if (!api) return;
    api.reagir();
    const n = Math.max(1, Math.min(50, +((ev && ev.detail && ev.detail.n) || 1)));
    const k = 'mr_assistente_feitas:' + email + ':' + hojeISO();
    const antes = +(guardado.ler(k) || 0), depois = antes + n;
    guardado.gravar(k, String(depois));
    if (Math.floor(depois / 5) > Math.floor(antes / 5)) api.avisar({ texto: 'Já são ' + Math.floor(depois / 5) * 5 + ' concluídas hoje. Bom ritmo!', ms: 6000 });
  });
  // com uma janela aberta, o balão fica discreto (menor e mais claro) pra não cobrir o canto dela
  let t1 = null, t2 = null;
  const conferir = () => { try { api.raiz.classList.toggle('as-sob-janela', !!janelaDeCima(api.raiz)); } catch (e) { /* sem janelas.js */ } };
  const depois = () => { clearTimeout(t1); clearTimeout(t2); t1 = setTimeout(conferir, 180); t2 = setTimeout(conferir, 900); };
  document.addEventListener('click', depois, true);
  document.addEventListener('keyup', depois, true);
  depois();
}
