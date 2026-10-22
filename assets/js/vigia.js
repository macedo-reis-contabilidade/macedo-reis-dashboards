// ============================================================
// MACEDO & REIS — O vigia do sistema, do lado da tela (15/10/2026)
// O banco roda as regras de hora em hora (vigia_rodar, pelo pg_cron) e guarda em vigia_achados o que
// ficou pra trás ou está desencontrado — admissão sem registro, alvará vencido, boleto parado, cliente sem cobrança,
// obrigação sem responsável… —, com quem cuida e a tela onde se resolve. Arrumou na tela, o achado some sozinho na
// rodada seguinte; o que não é problema a pessoa ignora (e pode voltar atrás).
// Aqui ficam as contas puras que o assistente usa (de quem é, de qual tela, os grupos) e a leitura e o "ignorar" — quem
// mostra é o assistente do escritório: a saudação do dia, o recado de cada tela (assets/js/assistente-escritorio.js) e o
// cartão "vigia" (assets/js/assistente-acoes.js). Sem import do banco: quem chama passa o cliente do Supabase (assim os
// testes rodam no node — tests/vigia.test.mjs).
// ============================================================

// o nome de cada regra no cartão (a regra nova sem nome aqui cai em "Outros achados")
export const ROTULOS = {
  admissao_nao_registrada: 'Admissões não registradas', admissao_sem_vinculo: 'Admissões sem empresa vinculada',
  rescisao_pagamento: 'Rescisões com pagamento chegando', rescisao_sem_vinculo: 'Rescisões sem empresa vinculada',
  alvara_vencendo: 'Alvarás vencidos ou vencendo', certificado_vencendo: 'Certificados digitais pra avisar o cliente',
  cliente_sem_cobranca: 'Clientes sem cobrança', boletos_nao_gerados: 'Boletos do mês não gerados', boleto_parado: 'Boletos parados',
  cobranca_ex_cliente: 'Cobrança de ex-cliente', faturavel_parado: 'Serviços a faturar parados', reajuste_nao_aplicado: 'Reajustes aceitos fora da cobrança',
  cadastro_desencontrado: 'Carteira e cadastro desencontrados', carteira_sem_cadastro: 'Na carteira sem cadastro', proposta_parada: 'Propostas paradas',
  transicao_atrasada: 'Transições atrasadas',
  cliente_sem_obrigacao: 'Clientes sem obrigação fiscal', obrigacao_sem_responsavel: 'Obrigações sem responsável', obrigacao_ex_cliente: 'Obrigações de ex-cliente',
  obrigacao_desligada: 'Obrigações comuns desligadas', obrigacao_sem_tarefa: 'Obrigações sem a tarefa do mês',
  reforma_prazo: 'Prazo da opção da Reforma', noticia_prazo: 'Prazos das notícias chegando',
  tarefa_responsavel: 'Tarefas sem responsável', tarefa_repetida: 'Tarefas repetidas', tarefa_ex_cliente: 'Tarefas de ex-cliente',
  recorrente_ex_cliente: 'Tarefas recorrentes de ex-cliente', rotina_sem_responsavel: 'Rotinas sem responsável'
};
export const rotuloDaRegra = r => ROTULOS[r] || 'Outros achados';
const PESO = { alta: 0, media: 1, baixa: 2 };
const peso = a => PESO[a && a.gravidade] ?? 1;
export const COLUNAS = 'id, regra, titulo, detalhe, setor, responsavel, gravidade, cliente_id, ref_tabela, ref_id, link, prazo, situacao, primeiro_visto, ultimo_visto, ignorado_em, ignorado_por';

const normal = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// de quem é: o responsável do achado; "Ambos", o que não tem dono e o da Edna (que não tem login) ficam com os sócios
export function eDaPessoa(a, { nome, socio } = {}) {
  const r = normal(a && a.responsavel);
  if (nome && r === normal(nome)) return true;
  return !!socio && (!r || r === 'ambos' || r === 'edna');
}
export const ehSocioPeloNome = nome => ['samuel', 'diego'].includes(normal(nome));

// a tela do achado: o caminho do link, sem a busca
export const caminhoDoLink = link => String(link || '').split('?')[0].replace(/^\/+/, '');
// o achado é desta tela? Na ficha da empresa (clientes/editar.html?id=…), é o que for daquela empresa
export function eDaTela(a, caminho, busca = '') {
  if (caminho === 'clientes/editar.html') {
    const id = new URLSearchParams(busca || '').get('id');
    return !!id && String((a && a.cliente_id) || '') === id;
  }
  return caminhoDoLink(a && a.link) === caminho;
}

// o recorte: as abertas de uma pessoa (todos = as de todo mundo), de um setor, de uma tela ou de uma empresa
export function filtrarAchados(lista, { nome = null, socio = false, todos = false, setor = null, tela = null, clienteId = null, situacao = 'aberto' } = {}) {
  return (Array.isArray(lista) ? lista : []).filter(a => a && (!situacao || a.situacao === situacao)
    && (todos || eDaPessoa(a, { nome, socio }))
    && (!setor || a.setor === setor)
    && (!tela || caminhoDoLink(a.link) === tela)
    && (!clienteId || String(a.cliente_id || '') === String(clienteId)));
}

// os grupos do cartão, por regra: primeiro os que têm achado urgente (gravidade alta), depois os maiores; dentro, os
// urgentes e o prazo mais perto primeiro
export function agruparAchados(lista) {
  const m = new Map();
  (Array.isArray(lista) ? lista : []).forEach(a => {
    const k = a.regra || 'outros';
    if (!m.has(k)) m.set(k, { regra: k, rotulo: rotuloDaRegra(k), itens: [] });
    m.get(k).itens.push(a);
  });
  const porItem = (x, y) => peso(x) - peso(y) || String(x.prazo || '9999').localeCompare(String(y.prazo || '9999')) || String(x.titulo || '').localeCompare(String(y.titulo || ''), 'pt-BR');
  return [...m.values()].map(g => ({ ...g, itens: g.itens.slice().sort(porItem), urgentes: g.itens.filter(a => a.gravidade === 'alta').length }))
    .sort((x, y) => Math.min(...x.itens.map(peso)) - Math.min(...y.itens.map(peso)) || y.itens.length - x.itens.length || x.rotulo.localeCompare(y.rotulo, 'pt-BR'));
}

// quantos apareceram depois da última vez que a pessoa olhou (sem "última vez", nenhum é "novo")
export function novosDesde(lista, visto) {
  if (!visto) return 0;
  return (Array.isArray(lista) ? lista : []).filter(a => a && a.primeiro_visto && String(a.primeiro_visto) > String(visto)).length;
}

// o link do achado só vira endereço se for uma página do sistema (caminho .html, busca simples)
export const linkSeguro = link => (/^[a-z0-9][a-z0-9\-/]*\.html(\?[a-z0-9_=&.\-]*)?$/i.test(String(link || '')) && !String(link).includes('..') ? String(link) : null);

// a última vez que a pessoa abriu o cartão do vigia (pros "novos" da saudação); no navegador, por e-mail
const CHAVE_VISTO = email => 'mr_vigia_visto:' + String(email || '').toLowerCase();
export function lerVisto(email) { try { return localStorage.getItem(CHAVE_VISTO(email)); } catch (e) { return null; } }
export function marcarVisto(email, quando = new Date().toISOString()) { try { localStorage.setItem(CHAVE_VISTO(email), quando); } catch (e) { /* sem armazenamento */ } }

// o resolvido agora pelo cartão (16/10/2026): o achado só sai do banco na conferência seguinte (de hora em hora, a do
// minuto 10) — até lá, nesta máquina, ele não entra na saudação, nos recados nem na lista. No navegador, por e-mail, por
// 75 minutos (a conferência seguinte com folga); o desfazer tira de volta
const CHAVE_RESOLVIDOS = email => 'mr_vigia_resolvidos:' + String(email || '').toLowerCase();
const VALE_RESOLVIDO = 75 * 60e3;
function lerResolvidos(email, agora) {
  try {
    const j = JSON.parse(localStorage.getItem(CHAVE_RESOLVIDOS(email)) || '{}');
    return Object.fromEntries(Object.entries(j && typeof j === 'object' ? j : {}).filter(([, em]) => agora - new Date(em).getTime() < VALE_RESOLVIDO));
  } catch (e) { return {}; }
}
export const resolvidosAgora = (email, agora = Date.now()) => new Set(Object.keys(lerResolvidos(email, agora)));
export function marcarResolvidoAgora(email, id, agora = Date.now()) {
  try { localStorage.setItem(CHAVE_RESOLVIDOS(email), JSON.stringify({ ...lerResolvidos(email, agora), [id]: new Date(agora).toISOString() })); } catch (e) { /* sem armazenamento */ }
}
export function desmarcarResolvidoAgora(email, id, agora = Date.now()) {
  try { const j = lerResolvidos(email, agora); delete j[id]; localStorage.setItem(CHAVE_RESOLVIDOS(email), JSON.stringify(j)); } catch (e) { /* sem armazenamento */ }
}
export const semResolvidosAgora = (lista, email, agora = Date.now()) => {
  const r = resolvidosAgora(email, agora);
  return (Array.isArray(lista) ? lista : []).filter(a => a && !r.has(String(a.id)));
};

// ---------- banco (quem chama passa o cliente do Supabase) ----------
// as abertas e as ignoradas que a pessoa pode ver (o que usa o Conta Azul, só os sócios: a regra é do banco)
export async function lerAchados(supabase, { ignorados = true } = {}) {
  const { data, error } = await supabase.from('vigia_achados').select(COLUNAS).in('situacao', ignorados ? ['aberto', 'ignorado'] : ['aberto'])
    .order('primeiro_visto', { ascending: false }).limit(1000);
  if (error) throw new Error(error.message);
  return data || [];
}
// ignorar e voltar a mostrar: só troca a situação (quem e quando, o banco grava); devolve se mudou
export async function ignorarAchado(supabase, id) {
  const { data, error } = await supabase.from('vigia_achados').update({ situacao: 'ignorado' }).eq('id', id).eq('situacao', 'aberto').select('id');
  if (error) throw new Error(error.message);
  return (data || []).length > 0;
}
export async function reabrirAchado(supabase, id) {
  const { data, error } = await supabase.from('vigia_achados').update({ situacao: 'aberto' }).eq('id', id).eq('situacao', 'ignorado').select('id');
  if (error) throw new Error(error.message);
  return (data || []).length > 0;
}
