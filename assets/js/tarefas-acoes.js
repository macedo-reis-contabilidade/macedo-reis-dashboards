// ============================================================
// MACEDO & REIS — Ações nas tarefas e nos boletos, uma regra só (14/10/2026)
// O que as telas fazem ao concluir, criar e marcar como pago — e o assistente do escritório faz igual, depois que a pessoa
// confirma no cartão dele (assets/js/assistente-acoes.js). Quem chama passa o cliente do Supabase (testes no node em
// tests/tarefas-acoes.test.mjs; nas telas, o de assets/js/supabase.js).
//   concluirTarefas — status "concluida", quando e quem, e a linha no histórico; só conclui quem ainda está aberto (não
//                     sobrescreve a conclusão de outra pessoa). O resto é do banco: tarefa faturável gera a cobrança e a
//                     "Faturar:" pro Samuel; admissão e rescisão ligadas acompanham (gatilhos em tarefas). E a regra das
//                     dependências do mesmo processo (avisarDependentes), a mesma das telas de tarefas dos setores.
//   desfazerConclusao — a tarefa volta à situação de antes, só se ainda está concluída por quem concluiu; a faturável
//                     não volta por aqui (a cobrança já nasceu: reabra na tela de tarefas do setor, que cancela a cobrança).
//   criarTarefasAvulsas — a tarefa avulsa do formulário "Nova tarefa" (uma por cliente; sem cliente, uma interna) e a
//                     linha no histórico; excluirTarefasCriadas desfaz (só a que continua pendente).
//   marcarPagos / desfazerPagos — boleto pago só de quem não está pago nem cancelado; desfazer volta à situação de antes.
//   alterarTarefas / desfazerAlteracao (16/10/2026) — prazo, responsável e prioridade de tarefas abertas, com a linha no
//                     histórico; as de admissão, rescisão e alvará ficam de fora do prazo e do responsável (o banco refaz
//                     os dois a partir da ficha de origem; a prioridade, não). Desfazer volta ao que era, só onde ninguém
//                     mexeu depois.
//   Resolver no cartão do vigia (16/10/2026) — definirResponsavelObrigacoes (como a tela Obrigações fiscais: os vínculos
//                     sem ninguém da equipe e as tarefas abertas deles), definirResponsavelRotina, descartarProposta (como o
//                     seletor da Precificação) e avancarBoletos (a emitir → emitido → enviado → pago, como a grade de
//                     Boletos), cada uma com o desfazer que só volta onde ninguém mexeu depois. E a segunda leva:
//                     fecharFicha (admissão registrada, rescisão concluída, como o seletor das telas do DP — a tarefa o
//                     banco acompanha), vincularEmpresa (a admissão ou a rescisão sem vínculo, com buscarEmpresas, a busca
//                     das fichas), renovarAlvara (como o "Renovar" da tela Alvarás) e desativarRegistro (a cobrança e a
//                     obrigação de quem saiu da carteira). E a terceira: vincularObrigacoes (as do regime, com a sugestão
//                     de sugerirObrigacoes), porNaCobranca (a base de boletos) e acertarCadastro (o cadastro segue a carteira).
//                     E a quarta (20/10/2026): tarefaDaObrigacao (a montagem da tarefa do mês, a mesma da tela Obrigações
//                     fiscais), criarTarefaDoMes (o vínculo que ficou sem a tarefa do mês) e religarVinculo (a obrigação
//                     comum desligada).
//   A mensagem no histórico (20/10/2026, pedido da Thalia) — o que a pessoa escreve vai no fim da linha da conclusão e da
//                     mudança (concluirTarefas e alterarTarefas com "mensagem", como a observação do concluir em lote da
//                     Agenda) ou sozinha, sem mudar a tarefa: registrarNoHistorico (o "Registrar andamento" da Agenda) e
//                     desfazerRegistro (tira as linhas que entraram, só as de quem registrou).
//   Os cadastros (30/10/2026, pedido do Samuel: "esse tipo de coisa ele possa fazer") — incluirNaCampanha (empresas na
//                     campanha da Reforma, como o espelho do banco faz com as do Simples), porNaCompetencia (a empresa que
//                     ficou de fora de um mês dos boletos, como o "Adicionar empresa" da tela Boletos, com
//                     vencimentoDaCompetencia, a conta do vencimento da tela) e ajustarVinculos (quem cuida, o dia do
//                     prazo e o desligar das obrigações das empresas, em lote, como a tela Obrigações fiscais faz uma a
//                     uma), cada uma com o desfazer que só volta onde ninguém mexeu depois.
// ============================================================

import { diaUtil, somaDias } from './rescisao-datas.js';

const LOTE = 100;   // ids por chamada: o filtro vai no endereço
const partes = lista => { const out = []; for (let i = 0; i < lista.length; i += LOTE) out.push(lista.slice(i, i + LOTE)); return out; };
const unicos = ids => [...new Set((Array.isArray(ids) ? ids : []).filter(x => x != null && x !== '').map(String))];
const msg = e => String((e && e.message) || e || 'erro');

// ---- a mensagem no histórico ----
// limparMensagem: numa linha só (o histórico das telas mostra o texto corrido), sem espaço sobrando, até 1000 caracteres
// (contados por caractere de verdade: o corte não parte um emoji ao meio)
export const MAX_MENSAGEM = 1000;
export const limparMensagem = s => [...String(s == null ? '' : s).replace(/\s+/g, ' ').trim()].slice(0, MAX_MENSAGEM).join('').trim();
// a linha do histórico com a mensagem no fim, como a da Agenda ("Tarefa concluída em lote pela Agenda (3 tarefas). <obs>")
export const comMensagem = (texto, mensagem) => { const m = limparMensagem(mensagem); return m ? texto + ' ' + m : texto; };

// ---- dependências entre tarefas geradas pelo mesmo processo ----
// Hoje só uma regra: no kit de Transformação, a escrituração contábil espera a precificação do honorário do novo porte.
// Quando a tarefa comercial é concluída, a contábil irmã (mesmo cliente, ainda aberta) recebe uma linha no histórico e um
// sufixo no título dizendo que pode iniciar.
export async function avisarDependentes(sb, t) {
  if (!t || !t.cliente_id || !/^precificar honor[áa]rios do novo porte/i.test(String(t.titulo || ''))) return;
  const { data: irmas } = await sb.from('tarefas').select('id, titulo')
    .eq('cliente_id', t.cliente_id).neq('status', 'concluida')
    .or('titulo.ilike.Iniciar escrituração contábil do novo enquadramento%,titulo.ilike.Transformação registrada — escrituração aguarda%');
  if (!irmas || !irmas.length) return;
  const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  for (const s of irmas) {
    const titulo = /honorário fechado em/i.test(s.titulo) ? s.titulo : ('Iniciar escrituração contábil do novo enquadramento (honorário fechado em ' + hoje + ')');
    await sb.from('tarefas').update({ titulo }).eq('id', s.id);
    await sb.from('tarefa_historico').insert({ tarefa_id: s.id, descricao: 'Honorário do novo porte precificado em ' + hoje + ' (tarefa comercial concluída) — a escrituração pode iniciar.', autor: 'sistema' });
  }
}

// concluirTarefas(sb, ids, { autor, historico, mensagem }) → { concluidas: [{ id, titulo, cliente_id, status_antes, faturavel }],
//   jaEstavam: [ids que não estavam abertos — concluídos por outra pessoa, ou que não existem mais], semHistorico, erro }
// mensagem: o que a pessoa escreveu, no fim da linha do histórico de cada uma (vazia: só o histórico)
export async function concluirTarefas(sb, ids, { autor = null, historico = 'Tarefa concluída.', mensagem = '' } = {}) {
  const lista = unicos(ids);
  const concluidas = [];
  const fim = (erro = null, semHistorico = false) => {
    const feitas = new Set(concluidas.map(c => c.id));
    return { concluidas, jaEstavam: lista.filter(id => !feitas.has(id)), semHistorico, erro };
  };
  if (!lista.length) return fim();
  // a situação de antes (pra desfazer) e quem ainda está aberto
  const antes = new Map();
  for (const p of partes(lista)) {
    const { data, error } = await sb.from('tarefas').select('id, titulo, cliente_id, status, faturavel').in('id', p);
    if (error) return fim(msg(error));
    (data || []).forEach(t => antes.set(String(t.id), t));
  }
  const abertas = lista.filter(id => antes.has(id) && antes.get(id).status !== 'concluida');
  const agora = new Date().toISOString();
  for (const p of partes(abertas)) {
    const { data, error } = await sb.from('tarefas').update({ status: 'concluida', concluida_em: agora, concluida_por: autor })
      .in('id', p).neq('status', 'concluida').select('id');
    if (error) return fim(msg(error));
    (data || []).forEach(x => {
      const t = antes.get(String(x.id));
      if (t) concluidas.push({ id: String(t.id), titulo: t.titulo || '', cliente_id: t.cliente_id || null, status_antes: t.status || 'pendente', faturavel: !!t.faturavel });
    });
  }
  if (!concluidas.length) return fim();
  // a conclusão vale mesmo sem a linha no histórico (como nas telas): quem chama avisa
  const descricao = comMensagem(historico, mensagem);
  const { error: eh } = await sb.from('tarefa_historico').insert(concluidas.map(c => ({ tarefa_id: c.id, descricao, autor })));
  for (const c of concluidas) { try { await avisarDependentes(sb, c); } catch (e) { /* dependentes: melhor esforço, como nas telas */ } }
  return fim(null, !!eh);
}

// desfazerConclusao(sb, concluidas, { autor, historico }) → { desfeitas: [ids], ficaram: [ids], erro }
// concluidas: o que concluirTarefas devolveu (com a situação de antes). A faturável fica de fora (ver o topo)
export async function desfazerConclusao(sb, concluidas, { autor = null, historico = 'Conclusão desfeita.' } = {}) {
  const lista = (Array.isArray(concluidas) ? concluidas : []).filter(c => c && c.id);
  const grupos = new Map();
  lista.filter(c => !c.faturavel).forEach(c => {
    const s = ['pendente', 'em_andamento', 'aguardando'].includes(c.status_antes) ? c.status_antes : 'pendente';
    if (!grupos.has(s)) grupos.set(s, []);
    grupos.get(s).push(String(c.id));
  });
  const desfeitas = [];
  const fim = (erro = null) => { const ok = new Set(desfeitas); return { desfeitas, ficaram: lista.map(c => String(c.id)).filter(id => !ok.has(id)), erro }; };
  for (const [status, ids] of grupos) {
    for (const p of partes(ids)) {
      let qy = sb.from('tarefas').update({ status, concluida_em: null, concluida_por: null }).in('id', p).eq('status', 'concluida');
      if (autor) qy = qy.eq('concluida_por', autor);
      const { data, error } = await qy.select('id');
      if (error) return fim(msg(error));
      (data || []).forEach(x => desfeitas.push(String(x.id)));
    }
  }
  if (desfeitas.length) await sb.from('tarefa_historico').insert(desfeitas.map(id => ({ tarefa_id: id, descricao: historico, autor })));
  return fim();
}

// registrarNoHistorico(sb, ids, { autor, mensagem, origem }) → { registradas: [{ id, linha }], faltam: [ids que não existem], erro }
// Só a mensagem, sem mudar a tarefa (o "Registrar andamento" da Agenda): "<mensagem> (registrado pelo <origem>)" no histórico
// de cada uma. linha = o id da linha que entrou (pro desfazer). A tarefa que não existe mais fica de fora
export async function registrarNoHistorico(sb, ids, { autor = null, mensagem = '', origem = null } = {}) {
  const lista = unicos(ids);
  const m = limparMensagem(mensagem);
  const res = { registradas: [], faltam: [], erro: null };
  if (!m) return { ...res, erro: 'Escreva a mensagem.' };
  if (!lista.length) return res;
  const existem = new Set();
  for (const p of partes(lista)) {
    const { data, error } = await sb.from('tarefas').select('id').in('id', p);
    if (error) return { ...res, erro: msg(error) };
    (data || []).forEach(t => existem.add(String(t.id)));
  }
  res.faltam = lista.filter(id => !existem.has(id));
  const descricao = m + (origem ? ' (registrado pelo ' + origem + ')' : '');
  for (const p of partes(lista.filter(id => existem.has(id)))) {
    const { data, error } = await sb.from('tarefa_historico').insert(p.map(id => ({ tarefa_id: id, descricao, autor }))).select('id, tarefa_id');
    if (error) return { ...res, erro: msg(error) };
    (data || []).forEach(x => res.registradas.push({ id: String(x.tarefa_id), linha: String(x.id) }));
  }
  return res;
}

// desfazerRegistro(sb, registradas, { autor }) → { desfeitas: [ids das tarefas], erro } — tira do histórico as linhas que
// registrarNoHistorico pôs (só as de quem registrou)
export async function desfazerRegistro(sb, registradas, { autor = null } = {}) {
  const porLinha = new Map((Array.isArray(registradas) ? registradas : []).filter(r => r && r.linha).map(r => [String(r.linha), String(r.id)]));
  const desfeitas = [];
  for (const p of partes([...porLinha.keys()])) {
    let qy = sb.from('tarefa_historico').delete().in('id', p);
    if (autor) qy = qy.eq('autor', autor);
    const { data, error } = await qy.select('id');
    if (error) return { desfeitas, erro: msg(error) };
    (data || []).forEach(x => desfeitas.push(porLinha.get(String(x.id))));
  }
  return { desfeitas, erro: null };
}

// criarTarefasAvulsas(sb, dados) → { ids, erro } — a tarefa avulsa do formulário "Nova tarefa": uma por cliente (sem
// cliente, uma interna), pendente, com a linha no histórico
export async function criarTarefasAvulsas(sb, { setor = 'geral', titulo, descricao = null, responsavel = null, prazo = null, prioridade = 'media', faturavel = false,
  clientes = [], autor = null, historico = 'Tarefa cadastrada.' } = {}) {
  const base = { setor, titulo, descricao, responsavel, prazo, prioridade, tipo: 'tarefa', status: 'pendente', origem: 'avulsa', faturavel: !!faturavel };
  const cli = unicos(clientes);
  const alvo = cli.length ? cli : [null];
  const { data: ins, error } = await sb.from('tarefas').insert(alvo.map(cliente_id => ({ ...base, cliente_id }))).select('id');
  if (error) return { ids: [], erro: msg(error) };
  const ids = (ins || []).map(t => String(t.id));
  if (ids.length) await sb.from('tarefa_historico').insert(ids.map(id => ({ tarefa_id: id, descricao: historico + (alvo.length > 1 ? ' (lote de ' + alvo.length + ' clientes)' : ''), autor })));
  return { ids, erro: null };
}

// excluirTarefasCriadas(sb, ids) → { excluidas, erro } — desfaz a criação: só a tarefa que continua pendente (a que
// alguém já mexeu fica); o histórico vai junto (o banco apaga em cascata)
export async function excluirTarefasCriadas(sb, ids) {
  const excluidas = [];
  for (const p of partes(unicos(ids))) {
    const { data, error } = await sb.from('tarefas').delete().in('id', p).eq('status', 'pendente').select('id');
    if (error) return { excluidas, erro: msg(error) };
    (data || []).forEach(x => excluidas.push(String(x.id)));
  }
  return { excluidas, erro: null };
}

// marcarPagos(sb, ids) → { pagos: [{ id, status_antes }], jaEstavam: [ids pagos, cancelados ou que não existem], erro }
export async function marcarPagos(sb, ids) {
  const lista = unicos(ids);
  const pagos = [];
  const fim = (erro = null) => { const ok = new Set(pagos.map(p => p.id)); return { pagos, jaEstavam: lista.filter(id => !ok.has(id)), erro }; };
  const antes = new Map();
  for (const p of partes(lista)) {
    const { data, error } = await sb.from('cobrancas_mensais').select('id, status').in('id', p);
    if (error) return fim(msg(error));
    (data || []).forEach(b => antes.set(String(b.id), b.status));
  }
  const abertos = lista.filter(id => antes.has(id) && !['pago', 'cancelado'].includes(antes.get(id)));
  for (const p of partes(abertos)) {
    const { data, error } = await sb.from('cobrancas_mensais').update({ status: 'pago' }).in('id', p).neq('status', 'pago').neq('status', 'cancelado').select('id');
    if (error) return fim(msg(error));
    (data || []).forEach(x => pagos.push({ id: String(x.id), status_antes: antes.get(String(x.id)) || 'enviado' }));
  }
  return fim();
}

// ---- alterar prazo, responsável e prioridade (16/10/2026) ----
// A tarefa de admissão, de rescisão e de alvará é mantida pelo banco a partir da ficha de origem
// (admissao_/rescisao_/alvara_sincronizar_tarefa): o prazo e o responsável voltariam na próxima mudança de lá — fica de
// fora, e quem chama diz onde mudar.
export const VINCULOS_DA_FICHA = [['admissao_id', 'admissão', 'Admissões'], ['rescisao_id', 'rescisão', 'Rescisões'], ['alvara_id', 'alvará', 'Alvarás']];
export const fichaDeOrigem = t => { const v = VINCULOS_DA_FICHA.find(([c]) => t && t[c]); return v ? { coluna: v[0], nome: v[1], tela: v[2] } : null; };
// a ficha de origem refaz o prazo e o responsável (a prioridade, não): mudar só a prioridade vale pra ela também
export const ficaDeFora = (t, mudar) => (mudar && ('prazo' in mudar || 'responsavel' in mudar) ? fichaDeOrigem(t) : null);
// trocar o responsável da tarefa que nasce de obrigação fiscal (obrigacao_id) ou de tarefa recorrente (origem
// "recorrente") não muda a de origem: a próxima nasce com o responsável de lá — quem chama avisa onde trocar de vez
export function proximasNascemCom(tarefas, mudar) {
  if (!mudar || !('responsavel' in mudar)) return { obrigacao: 0, recorrente: 0 };
  const l = Array.isArray(tarefas) ? tarefas : [];
  return { obrigacao: l.filter(t => t && t.obrigacao_id).length, recorrente: l.filter(t => t && !t.obrigacao_id && t.origem === 'recorrente').length };
}
export const PRIORIDADES = ['alta', 'media', 'baixa'];
const ROTULO_PRIORIDADE = { alta: 'alta', media: 'média', baixa: 'baixa' };
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const dataBR = iso => String(iso).slice(0, 10).split('-').reverse().join('/');
const CAMPOS_MUDANCA = ['prazo', 'responsavel', 'prioridade'];

// limparMudanca({ prazo, responsavel, prioridade }) → só o que vale mudar (prazo AAAA-MM-DD de verdade, responsável com
// nome, prioridade da lista); nada que valha = null
export function limparMudanca(m) {
  const x = m && typeof m === 'object' ? m : {}, out = {};
  if (typeof x.prazo === 'string' && DATA_ISO.test(x.prazo) && !isNaN(new Date(x.prazo + 'T12:00:00Z'))
    && new Date(x.prazo + 'T12:00:00Z').toISOString().slice(0, 10) === x.prazo) out.prazo = x.prazo;
  if (typeof x.responsavel === 'string' && x.responsavel.trim() && x.responsavel.trim().length <= 60) out.responsavel = x.responsavel.trim();
  if (PRIORIDADES.includes(x.prioridade)) out.prioridade = x.prioridade;
  return Object.keys(out).length ? out : null;
}
// o que muda numa tarefa: só os campos de "mudar" com valor diferente do de agora (null = nada); o responsável sem
// diferença de maiúscula e acento (o banco tem "SAMUEL" e "Samuel")
const semAcento = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
export function mudancaDe(t, mudar) {
  const out = {};
  CAMPOS_MUDANCA.forEach(c => {
    if (!(c in mudar)) return;
    const igual = c === 'responsavel' ? semAcento(t[c]) === semAcento(mudar[c]) : String(t[c] ?? '') === String(mudar[c] ?? '');
    if (!igual) out[c] = mudar[c];
  });
  return Object.keys(out).length ? out : null;
}
// a linha do histórico: "Prazo alterado de 15/10/2026 para 16/10/2026; responsável de Thalia para Vitória"
export function descreverMudanca(antes, depois) {
  const partes = [];
  // o = "o prazo", "o responsável"; a = "a prioridade"
  const de = (rotulo, g, a, d, fmt = v => v) => partes.push(a == null || a === '' ? rotulo + ' definid' + g + ': ' + fmt(d) : rotulo + ' alterad' + g + ' de ' + fmt(a) + ' para ' + fmt(d));
  if ('prazo' in depois) { if (depois.prazo == null) partes.push('Prazo retirado (era ' + dataBR(antes.prazo) + ')'); else de('Prazo', 'o', antes.prazo, depois.prazo, dataBR); }
  if ('responsavel' in depois) { if (depois.responsavel == null) partes.push('Responsável retirado (era ' + antes.responsavel + ')'); else de('Responsável', 'o', antes.responsavel, depois.responsavel); }
  if ('prioridade' in depois) de('Prioridade', 'a', antes.prioridade, depois.prioridade, v => ROTULO_PRIORIDADE[v] || v);
  return partes.map((p, i) => (i ? p.charAt(0).toLowerCase() + p.slice(1) : p)).join('; ');
}

// alterarTarefas(sb, ids, mudar, { autor, origem, mensagem }) → { alteradas: [{ id, titulo, antes, depois }], iguais: [ids já assim],
//   fechadas: [ids concluídos ou que não existem], daFicha: [{ id, nome, tela }], semHistorico, erro }
// mudar: { prazo?, responsavel?, prioridade? } (limparMudanca). Só tarefa aberta e fora das da ficha de origem. mensagem: o
// que a pessoa escreveu, no fim da linha do histórico
export async function alterarTarefas(sb, ids, mudar, { autor = null, origem = null, mensagem = '' } = {}) {
  const lista = unicos(ids);
  const m = limparMudanca(mudar);
  const res = { alteradas: [], iguais: [], fechadas: [], daFicha: [], semHistorico: false, erro: null };
  if (!m) return { ...res, erro: 'Nada a mudar: diga o prazo, o responsável ou a prioridade.' };
  if (!lista.length) return res;
  const atual = new Map();
  for (const p of partes(lista)) {
    const { data, error } = await sb.from('tarefas').select('id, titulo, status, prazo, responsavel, prioridade, admissao_id, rescisao_id, alvara_id').in('id', p);
    if (error) return { ...res, erro: msg(error) };
    (data || []).forEach(t => atual.set(String(t.id), t));
  }
  const alvo = [];
  lista.forEach(id => {
    const t = atual.get(id);
    if (!t || t.status === 'concluida') { res.fechadas.push(id); return; }
    const f = ficaDeFora(t, m);
    if (f) { res.daFicha.push({ id, nome: f.nome, tela: f.tela }); return; }
    if (!mudancaDe(t, m)) { res.iguais.push(id); return; }
    alvo.push(id);
  });
  // o mesmo patch pra todas (o campo que já estava igual vai com o mesmo valor): um update por lote; a que foi concluída
  // entre a leitura e o clique fica de fora
  for (const p of partes(alvo)) {
    const { data, error } = await sb.from('tarefas').update(m).in('id', p).neq('status', 'concluida').select('id');
    if (error) return { ...res, erro: msg(error) };
    const feitas = new Set((data || []).map(x => String(x.id)));
    p.forEach(id => {
      const t = atual.get(id);
      if (!feitas.has(id)) { res.fechadas.push(id); return; }
      const antes = {}, depois = mudancaDe(t, m);
      Object.keys(depois).forEach(c => { antes[c] = t[c] ?? null; });
      res.alteradas.push({ id, titulo: t.titulo || '', antes, depois });
    });
  }
  if (!res.alteradas.length) return res;
  const fim = origem ? ' — pelo ' + origem + '.' : '.';
  const { error: eh } = await sb.from('tarefa_historico').insert(res.alteradas.map(a => ({ tarefa_id: a.id, descricao: comMensagem(descreverMudanca(a.antes, a.depois) + fim, mensagem), autor })));
  res.semHistorico = !!eh;
  return res;
}

// desfazerAlteracao(sb, alteradas, { autor, origem }) → { desfeitas: [ids], ficaram: [ids], erro }
// cada uma volta ao que era — só se continua aberta e como ficou (ninguém mexeu depois: o update confere cada campo)
export async function desfazerAlteracao(sb, alteradas, { autor = null, origem = null } = {}) {
  const lista = (Array.isArray(alteradas) ? alteradas : []).filter(a => a && a.id && a.antes && a.depois && typeof a.depois === 'object');
  const desfeitas = [];
  const fim = (erro = null) => { const ok = new Set(desfeitas); return { desfeitas, ficaram: lista.map(a => String(a.id)).filter(id => !ok.has(id)), erro }; };
  // juntas as que voltam pro mesmo lugar (o mesmo antes e o mesmo depois): um update por grupo
  const grupos = new Map();
  lista.forEach(a => {
    const campos = CAMPOS_MUDANCA.filter(c => c in a.depois);
    if (!campos.length) return;
    const chave = JSON.stringify(campos.map(c => [c, a.antes[c] ?? null, a.depois[c] ?? null]));
    if (!grupos.has(chave)) grupos.set(chave, { campos, antes: a.antes, depois: a.depois, ids: [] });
    grupos.get(chave).ids.push(String(a.id));
  });
  for (const g of grupos.values()) {
    const volta = {};
    g.campos.forEach(c => { volta[c] = g.antes[c] ?? null; });
    for (const p of partes(g.ids)) {
      let qy = sb.from('tarefas').update(volta).in('id', p).neq('status', 'concluida');
      g.campos.forEach(c => { qy = g.depois[c] == null ? qy.is(c, null) : qy.eq(c, g.depois[c]); });
      const { data, error } = await qy.select('id');
      if (error) return fim(msg(error));
      (data || []).forEach(x => desfeitas.push(String(x.id)));
    }
  }
  if (desfeitas.length) {
    const ok = new Set(desfeitas), sufixo = origem ? ' — alteração desfeita no ' + origem + '.' : ' — alteração desfeita.';
    await sb.from('tarefa_historico').insert(lista.filter(a => ok.has(String(a.id))).map(a => {
      const volta = {}; Object.keys(a.depois).forEach(c => { volta[c] = a.antes[c] ?? null; });
      return { tarefa_id: String(a.id), descricao: descreverMudanca(a.depois, volta) + sufixo, autor };
    }));
  }
  return fim();
}

// ---- resolver no cartão do vigia (16/10/2026) ----
// quem é da equipe pelo nome gravado (o banco tem "SAMUEL", "Vitoria"…): a mesma conta do vigia_pessoa do banco — fora
// disso (vazio ou um nome que não é da equipe), "sem responsável"
const DA_EQUIPE = { thalia: 'Thalia', vitoria: 'Vitória', adaini: 'Adaini', samuel: 'Samuel', diego: 'Diego', edna: 'Edna', deize: 'Deize', ambos: 'Ambos' };
export const pessoaDaEquipe = n => DA_EQUIPE[semAcento(n)] || null;
const VAZIO = '\u0000';   // a chave do "sem ninguém" nos grupos por responsável de antes
const porAntes = (lista, campo = 'antes') => {
  const m = new Map();
  lista.forEach(x => { const k = x[campo] == null ? VAZIO : String(x[campo]); if (!m.has(k)) m.set(k, []); m.get(k).push(x); });
  return m;
};
const deVolta = k => (k === VAZIO ? null : k);

// obrigação sem responsável (o achado é da empresa): o responsável vai pros vínculos ativos dela sem ninguém da equipe e,
// como na tela Obrigações fiscais, pras tarefas abertas desses vínculos que estavam com o de antes (ou sem ninguém) — a
// tarefa repassada à mão pra outra pessoa fica como está. → { vinculos: [{ id, antes }], tarefas: [{ id, antes }], erro }
export async function definirResponsavelObrigacoes(sb, clienteId, responsavel, { autor = null, origem = null } = {}) {
  const res = { vinculos: [], tarefas: [], erro: null };
  const para = pessoaDaEquipe(responsavel);
  if (!clienteId || !para) return { ...res, erro: 'Escolha alguém da equipe.' };
  const { data, error } = await sb.from('cliente_obrigacoes').select('id, obrigacao_id, responsavel').eq('cliente_id', clienteId).eq('ativo', true);
  if (error) return { ...res, erro: msg(error) };
  const sem = (data || []).filter(v => !pessoaDaEquipe(v.responsavel)).map(v => ({ ...v, antes: v.responsavel ?? null }));
  for (const [k, vs] of porAntes(sem)) {
    const antes = deVolta(k);
    // o update confere que o vínculo continua com o mesmo de antes (ninguém trocou no meio)
    let q = sb.from('cliente_obrigacoes').update({ responsavel: para }).in('id', vs.map(v => v.id));
    q = antes == null ? q.is('responsavel', null) : q.eq('responsavel', antes);
    const { data: foram, error: e1 } = await q.select('id, obrigacao_id');
    if (e1) return { ...res, erro: msg(e1) };
    (foram || []).forEach(v => res.vinculos.push({ id: String(v.id), antes }));
    const obrig = [...new Set((foram || []).map(v => v.obrigacao_id).filter(Boolean).map(String))];
    if (!obrig.length) continue;
    let qt = sb.from('tarefas').update({ responsavel: para }).eq('cliente_id', clienteId).in('obrigacao_id', obrig).neq('status', 'concluida');
    qt = antes == null ? qt.is('responsavel', null) : qt.eq('responsavel', antes);
    const { data: ts, error: e2 } = await qt.select('id');
    if (e2) return { ...res, erro: 'O responsável das obrigações foi gravado, mas o das tarefas abertas não: ' + msg(e2) };
    (ts || []).forEach(t => res.tarefas.push({ id: String(t.id), antes }));
  }
  if (res.tarefas.length) {
    await sb.from('tarefa_historico').insert(res.tarefas.map(t => ({ tarefa_id: t.id, descricao: 'Responsável definido pela obrigação: ' + para + (origem ? ' — pelo ' + origem : '') + '.', autor })));
  }
  return res;
}
// desfazer: cada vínculo e cada tarefa voltam ao de antes — só os que continuam com quem foi definido (e a tarefa aberta)
export async function desfazerResponsavelObrigacoes(sb, feito, responsavel, { autor = null, origem = null } = {}) {
  const out = { vinculos: 0, tarefas: [], erro: null };
  const para = pessoaDaEquipe(responsavel);
  if (!para || !feito) return out;
  for (const [k, vs] of porAntes(Array.isArray(feito.vinculos) ? feito.vinculos : [])) {
    for (const p of partes(vs.map(v => String(v.id)))) {
      const { data, error } = await sb.from('cliente_obrigacoes').update({ responsavel: deVolta(k) }).in('id', p).eq('responsavel', para).select('id');
      if (error) return { ...out, erro: msg(error) };
      out.vinculos += (data || []).length;
    }
  }
  for (const [k, ts] of porAntes(Array.isArray(feito.tarefas) ? feito.tarefas : [])) {
    for (const p of partes(ts.map(t => String(t.id)))) {
      const { data, error } = await sb.from('tarefas').update({ responsavel: deVolta(k) }).in('id', p).eq('responsavel', para).neq('status', 'concluida').select('id');
      if (error) return { ...out, erro: msg(error) };
      (data || []).forEach(x => out.tarefas.push(String(x.id)));
    }
  }
  if (out.tarefas.length) {
    await sb.from('tarefa_historico').insert(out.tarefas.map(id => ({ tarefa_id: id, descricao: 'Responsável definido pela obrigação desfeito' + (origem ? ' no ' + origem : '') + '.', autor })));
  }
  return out;
}

// rotina do escritório sem responsável: como o editor das rotinas (o campo responsável) → { rotina: { id, antes }, jaTinha, erro }
export async function definirResponsavelRotina(sb, id, responsavel) {
  const para = pessoaDaEquipe(responsavel);
  if (!id || !para) return { rotina: null, erro: 'Escolha alguém da equipe.' };
  const { data, error } = await sb.from('rotinas').select('id, responsavel').eq('id', id);
  if (error) return { rotina: null, erro: msg(error) };
  const r = (data || [])[0];
  if (!r) return { rotina: null, erro: 'A rotina não existe mais.' };
  if (pessoaDaEquipe(r.responsavel)) return { rotina: null, jaTinha: pessoaDaEquipe(r.responsavel), erro: null };
  let q = sb.from('rotinas').update({ responsavel: para }).eq('id', id);
  q = r.responsavel == null ? q.is('responsavel', null) : q.eq('responsavel', r.responsavel);
  const { data: foi, error: e2 } = await q.select('id');
  if (e2) return { rotina: null, erro: msg(e2) };
  return { rotina: (foi || []).length ? { id: String(id), antes: r.responsavel ?? null } : null, erro: null };
}
export async function desfazerResponsavelRotina(sb, rotina, responsavel) {
  const para = pessoaDaEquipe(responsavel);
  if (!rotina || !rotina.id || !para) return { desfeita: false, erro: null };
  const { data, error } = await sb.from('rotinas').update({ responsavel: rotina.antes ?? null }).eq('id', rotina.id).eq('responsavel', para).select('id');
  return { desfeita: !error && (data || []).length > 0, erro: error ? msg(error) : null };
}

// proposta parada: descartar, como o seletor de situação da tela Precificação (a situação e o "atualizado em"); desfazer
// volta os dois — pro vigia, a proposta continua parada desde a mesma data. A proposta "recebida" (a do formulário
// público) tem a tarefa de olhar a proposta, que o banco conclui quando ela sai de "recebida" (fn_proposta_externa_concluir):
// o desfazer reabre essa tarefa → { proposta: { id, status_antes, atualizado_antes, tarefas }, ja, erro }
const PROPOSTA_EM_ABERTO = ['recebida', 'rascunho', 'calculada', 'apresentada'];
const CONCLUIDA_PELA_PROPOSTA = 'sistema (proposta em andamento)';
export async function descartarProposta(sb, id) {
  const { data, error } = await sb.from('precificacoes').select('id, status, atualizado_em').eq('id', id);
  if (error) return { proposta: null, erro: msg(error) };
  const p = (data || [])[0];
  if (!p) return { proposta: null, erro: 'A proposta não existe mais.' };
  if (!PROPOSTA_EM_ABERTO.includes(p.status)) return { proposta: null, ja: p.status, erro: null };
  let tarefas = [];
  if (p.status === 'recebida') {
    const { data: ts, error: e0 } = await sb.from('tarefas').select('id').eq('proposta_id', id).eq('origem', 'proposta_externa').eq('status', 'pendente');
    if (e0) return { proposta: null, erro: msg(e0) };
    tarefas = (ts || []).map(t => String(t.id));
  }
  const { data: foi, error: e2 } = await sb.from('precificacoes').update({ status: 'descartada', atualizado_em: new Date().toISOString() }).eq('id', id).eq('status', p.status).select('id');
  if (e2) return { proposta: null, erro: msg(e2) };
  return { proposta: (foi || []).length ? { id: String(id), status_antes: p.status, atualizado_antes: p.atualizado_em ?? null, tarefas } : null, erro: null };
}
// → { desfeita, tarefas: [ids reabertas], erro }
export async function desfazerDescarte(sb, proposta) {
  if (!proposta || !proposta.id || !PROPOSTA_EM_ABERTO.includes(proposta.status_antes)) return { desfeita: false, tarefas: [], erro: null };
  const { data, error } = await sb.from('precificacoes').update({ status: proposta.status_antes, atualizado_em: proposta.atualizado_antes }).eq('id', proposta.id).eq('status', 'descartada').select('id');
  if (error) return { desfeita: false, tarefas: [], erro: msg(error) };
  if (!(data || []).length) return { desfeita: false, tarefas: [], erro: null };
  const ids = unicos(proposta.tarefas);
  if (!ids.length) return { desfeita: true, tarefas: [], erro: null };
  const { data: ts, error: e2 } = await sb.from('tarefas').update({ status: 'pendente', concluida_em: null, concluida_por: null })
    .in('id', ids).eq('status', 'concluida').eq('concluida_por', CONCLUIDA_PELA_PROPOSTA).select('id');
  if (e2) return { desfeita: true, tarefas: [], erro: 'A proposta voltou, mas a tarefa dela continua concluída: ' + msg(e2) };
  return { desfeita: true, tarefas: (ts || []).map(t => String(t.id)), erro: null };
}

// o boleto pra frente: a emitir → emitido → enviado → pago (como a grade da tela Boletos); o cancelado e o que já está
// lá na frente ficam → { mudados: [{ id, status_antes }], jaEstavam: [ids], erro }
export const ORDEM_BOLETO = ['a_emitir', 'emitido', 'enviado', 'pago'];
export async function avancarBoletos(sb, ids, status) {
  const lista = unicos(ids);
  const res = { mudados: [], jaEstavam: [], erro: null };
  const alvo = ORDEM_BOLETO.indexOf(status);
  if (alvo < 1) return { ...res, erro: 'Situação inválida.' };
  const antes = new Map();
  for (const p of partes(lista)) {
    const { data, error } = await sb.from('cobrancas_mensais').select('id, status').in('id', p);
    if (error) return { ...res, erro: msg(error) };
    (data || []).forEach(b => antes.set(String(b.id), b.status));
  }
  const vao = [];
  lista.forEach(id => { const i = ORDEM_BOLETO.indexOf(antes.get(id)); if (i < 0 || i >= alvo) res.jaEstavam.push(id); else vao.push({ id, antes: antes.get(id) }); });
  for (const [k, bs] of porAntes(vao)) {
    for (const p of partes(bs.map(b => b.id))) {
      const { data, error } = await sb.from('cobrancas_mensais').update({ status }).in('id', p).eq('status', deVolta(k)).select('id');
      if (error) return { ...res, erro: msg(error) };
      (data || []).forEach(x => res.mudados.push({ id: String(x.id), status_antes: deVolta(k) }));
    }
  }
  return res;
}
// desfazer: volta à situação de antes, só de quem continua na nova → { desfeitos: [{ id, status }], erro }
export async function voltarBoletos(sb, mudados, status) {
  const desfeitos = [];
  for (const [k, bs] of porAntes((Array.isArray(mudados) ? mudados : []).filter(b => b && b.id && ORDEM_BOLETO.includes(b.status_antes)), 'status_antes')) {
    for (const p of partes(bs.map(b => String(b.id)))) {
      const { data, error } = await sb.from('cobrancas_mensais').update({ status: deVolta(k) }).in('id', p).eq('status', status).select('id');
      if (error) return { desfeitos, erro: msg(error) };
      (data || []).forEach(x => desfeitos.push({ id: String(x.id), status: deVolta(k) }));
    }
  }
  return { desfeitos, erro: null };
}

// ---- resolver no cartão do vigia, a segunda leva (16/10/2026) ----
// a ficha da admissão e da rescisão: registrada / concluída, como o seletor de situação das telas Admissões e Rescisões
// (o quando e o quem); a tarefa dela o banco acompanha, nos dois sentidos (admissao_/rescisao_sincronizar_tarefa)
export const FICHAS_DP = {
  admissoes: { abertas: ['respondida', 'em_registro'], fim: 'registrada', em: 'registrada_em', por: 'registrada_por' },
  rescisoes: { abertas: ['recebida', 'em_andamento'], fim: 'concluida', em: 'concluida_em', por: 'concluida_por' } };
// → { ficha: { tabela, id, status_antes }, ja: a situação de agora (quando já não estava aberta), erro }
export async function fecharFicha(sb, tabela, id, { autor = null } = {}) {
  const f = FICHAS_DP[tabela];
  if (!f || !id) return { ficha: null, erro: 'Ficha inválida.' };
  const { data, error } = await sb.from(tabela).select('id, status').eq('id', id);
  if (error) return { ficha: null, erro: msg(error) };
  const r = (data || [])[0];
  if (!r) return { ficha: null, erro: 'A ficha não existe mais.' };
  if (!f.abertas.includes(r.status)) return { ficha: null, ja: r.status, erro: null };
  const agora = new Date().toISOString();
  const { data: foi, error: e2 } = await sb.from(tabela).update({ status: f.fim, [f.em]: agora, [f.por]: autor, atualizado_em: agora })
    .eq('id', id).eq('status', r.status).select('id');
  if (e2) return { ficha: null, erro: msg(e2) };
  return { ficha: (foi || []).length ? { tabela, id: String(id), status_antes: r.status } : null, erro: null };
}
// desfazer: volta à situação de antes (sem o quando e o quem), só se continua como ficou → { desfeita, erro }
export async function reabrirFicha(sb, ficha) {
  const f = ficha && FICHAS_DP[ficha.tabela];
  if (!f || !ficha.id || !f.abertas.includes(ficha.status_antes)) return { desfeita: false, erro: null };
  const { data, error } = await sb.from(ficha.tabela).update({ status: ficha.status_antes, [f.em]: null, [f.por]: null, atualizado_em: new Date().toISOString() })
    .eq('id', ficha.id).eq('status', f.fim).select('id');
  return { desfeita: !error && (data || []).length > 0, erro: error ? msg(error) : null };
}

// a empresa da admissão ou da rescisão que entrou sem vínculo (o nome digitado não bateu com o cadastro): como a ficha da
// tela — o banco leva a empresa pra tarefa → { ficha: { tabela, id, cliente_id }, ja: a empresa que já estava, erro }
export async function vincularEmpresa(sb, tabela, id, clienteId) {
  if (!FICHAS_DP[tabela] || !id || !clienteId) return { ficha: null, erro: 'Escolha a empresa.' };
  const { data, error } = await sb.from(tabela).select('id, cliente_id').eq('id', id);
  if (error) return { ficha: null, erro: msg(error) };
  const r = (data || [])[0];
  if (!r) return { ficha: null, erro: 'A ficha não existe mais.' };
  if (r.cliente_id) return { ficha: null, ja: String(r.cliente_id), erro: null };
  const { data: foi, error: e2 } = await sb.from(tabela).update({ cliente_id: clienteId, atualizado_em: new Date().toISOString() })
    .eq('id', id).is('cliente_id', null).select('id');
  if (e2) return { ficha: null, erro: msg(e2) };
  return { ficha: (foi || []).length ? { tabela, id: String(id), cliente_id: String(clienteId) } : null, erro: null };
}
export async function desvincularEmpresa(sb, ficha) {
  if (!ficha || !FICHAS_DP[ficha.tabela] || !ficha.id || !ficha.cliente_id) return { desfeita: false, erro: null };
  const { data, error } = await sb.from(ficha.tabela).update({ cliente_id: null, atualizado_em: new Date().toISOString() })
    .eq('id', ficha.id).eq('cliente_id', ficha.cliente_id).select('id');
  return { desfeita: !error && (data || []).length > 0, erro: error ? msg(error) : null };
}
// a busca de empresa das fichas de Admissões e Rescisões (razão social, fantasia, o nome sem pontuação ou o CNPJ), sem o
// que quebraria o filtro (vírgula, parênteses, asterisco) → { empresas: [{ id, nome_principal, nome_fantasia, documento, cidade }], erro }
export async function buscarEmpresas(sb, termo, limite = 8) {
  const t = String(termo || '').replace(/[,()*%\\:"']/g, ' ').replace(/\s+/g, ' ').trim();
  if (t.length < 3) return { empresas: [], erro: null };
  const chave = t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  const { data, error } = await sb.from('clientes').select('id, nome_principal, nome_fantasia, documento, cidade')
    .or('nome_principal.ilike.*' + t + '*,nome_fantasia.ilike.*' + t + '*' + (chave ? ',nome_busca.ilike.*' + chave + '*,documento.ilike.*' + chave + '*' : '')).limit(limite);
  if (error) return { empresas: [], erro: msg(error) };
  return { empresas: data || [], erro: null };
}

// alvará renovado: como o "Renovar" da tela Alvarás — vigente, com o vencimento novo, e a linha na linha do tempo dele; a
// tarefa de renovação o banco refaz pro vencimento novo (alvara_sincronizar_tarefa). A data nova vem depois de hoje e do
// vencimento de agora → { alvara: { id, status_antes, vencimento_antes, vencimento }, erro }
const hojeLocal = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
export async function renovarAlvara(sb, id, vencimento, { autor = null, origem = null, hoje = hojeLocal() } = {}) {
  const v = String(vencimento || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(new Date(v + 'T12:00:00').getTime())) return { alvara: null, erro: 'Informe a nova data de vencimento.' };
  if (v <= hoje) return { alvara: null, erro: 'A nova data de vencimento precisa ser depois de hoje.' };
  const { data, error } = await sb.from('alvaras').select('id, status, vencimento').eq('id', id);
  if (error) return { alvara: null, erro: msg(error) };
  const a = (data || [])[0];
  if (!a) return { alvara: null, erro: 'O alvará não existe mais.' };
  const antes = a.vencimento ? String(a.vencimento).slice(0, 10) : null;
  if (antes && v <= antes) return { alvara: null, erro: 'A nova data precisa ser depois do vencimento de agora (' + dataBR(antes) + ').' };
  let q = sb.from('alvaras').update({ status: 'vigente', vencimento: v }).eq('id', id);
  q = antes == null ? q.is('vencimento', null) : q.eq('vencimento', antes);
  const { data: foi, error: e2 } = await q.select('id');
  if (e2) return { alvara: null, erro: msg(e2) };
  if (!(foi || []).length) return { alvara: null, erro: 'O alvará mudou no meio do caminho: confira na tela Alvarás.' };
  await sb.from('alvara_historico').insert({ alvara_id: String(id), autor,
    descricao: 'Renovado: vencimento ' + (antes ? dataBR(antes) : '—') + ' → ' + dataBR(v) + (origem ? ' — pelo ' + origem : '') + '.' });
  return { alvara: { id: String(id), status_antes: a.status ?? null, vencimento_antes: antes, vencimento: v }, erro: null };
}
// desfazer: o vencimento e a situação de antes, só se o vencimento continua o da renovação → { desfeita, erro }
export async function desfazerRenovacao(sb, alvara, { autor = null, origem = null } = {}) {
  if (!alvara || !alvara.id || !alvara.vencimento) return { desfeita: false, erro: null };
  const { data, error } = await sb.from('alvaras').update({ status: alvara.status_antes ?? null, vencimento: alvara.vencimento_antes ?? null })
    .eq('id', alvara.id).eq('vencimento', alvara.vencimento).select('id');
  if (error) return { desfeita: false, erro: msg(error) };
  if (!(data || []).length) return { desfeita: false, erro: null };
  await sb.from('alvara_historico').insert({ alvara_id: String(alvara.id), autor,
    descricao: 'Renovação desfeita: vencimento ' + dataBR(alvara.vencimento) + ' → ' + (alvara.vencimento_antes ? dataBR(alvara.vencimento_antes) : '—') + (origem ? ' — no ' + origem : '') + '.' });
  return { desfeita: true, erro: null };
}

// o que segue ativo de quem saiu da carteira: a cobrança na base de boletos (como o "parar de vez" da tela Boletos) e a
// obrigação fiscal (como a chave da tela Obrigações fiscais — as tarefas já criadas ficam) → { desativado: { tabela, id }, erro }
export const DESATIVAVEIS = ['cobrancas_config', 'cliente_obrigacoes'];
export async function desativarRegistro(sb, tabela, id) {
  if (!DESATIVAVEIS.includes(tabela) || !id) return { desativado: null, erro: 'Registro inválido.' };
  const { data, error } = await sb.from(tabela).update({ ativo: false }).eq('id', id).eq('ativo', true).select('id');
  if (error) return { desativado: null, erro: msg(error) };
  return { desativado: (data || []).length ? { tabela, id: String(id) } : null, erro: null };
}
export async function reativarRegistro(sb, feito) {
  if (!feito || !DESATIVAVEIS.includes(feito.tabela) || !feito.id) return { desfeita: false, erro: null };
  const { data, error } = await sb.from(feito.tabela).update({ ativo: true }).eq('id', feito.id).eq('ativo', false).select('id');
  return { desfeita: !error && (data || []).length > 0, erro: error ? msg(error) : null };
}

// ---- resolver no cartão do vigia, a terceira leva (16/10/2026) ----
const maiusSemAcento = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
const DEISS = /^DEISS\s*-\s*(.+)$/;

// as obrigações do regime da empresa, pra vincular: as que metade ou mais das empresas do mesmo regime já têm e o DEISS da
// cidade dela vêm sugeridas; as outras do regime (de um cliente só, de parcelamento, de um canal de envio) ficam pra quem
// confere marcar. vinculos: [{ cliente_id, obrigacao_id }] ativos; regimeDe: { cliente_id: regime }; jaTem: as que a
// empresa já tem ativas; clienteId: ela, fora da conta → [{ id, nome, periodicidade, sugerida, n, total, cidade }] (n de total
// empresas do regime têm)
export function sugerirObrigacoes({ obrigacoes, vinculos, regimeDe, regime, cidade, jaTem = [], clienteId = null }) {
  const reg = maiusSemAcento(regime), cid = maiusSemAcento(cidade), tem = new Set(unicos(jaTem));
  // as outras empresas do regime com obrigação (a própria fica de fora da conta)
  const doRegime = new Set((Array.isArray(vinculos) ? vinculos : []).map(v => String(v.cliente_id)).filter(c => c !== String(clienteId) && maiusSemAcento((regimeDe || {})[c]) === reg));
  const total = doRegime.size;
  const quem = new Map();
  (Array.isArray(vinculos) ? vinculos : []).forEach(v => {
    const c = String(v.cliente_id), o = String(v.obrigacao_id);
    if (!doRegime.has(c)) return;
    if (!quem.has(o)) quem.set(o, new Set());
    quem.get(o).add(c);
  });
  return (Array.isArray(obrigacoes) ? obrigacoes : [])
    .filter(o => o && o.ativo !== false && !tem.has(String(o.id)) && (Array.isArray(o.regimes_aplicaveis) ? o.regimes_aplicaveis : []).some(r => maiusSemAcento(r) === reg))
    .map(o => {
      const n = (quem.get(String(o.id)) || new Set()).size;
      const d = DEISS.exec(maiusSemAcento(o.nome));
      const daCidade = !!d && !!cid && d[1].trim() === cid;
      return { id: String(o.id), nome: o.nome, periodicidade: o.periodicidade || null, n, total, cidade: daCidade, sugerida: d ? daCidade : total > 0 && n * 2 >= total };
    })
    .sort((x, y) => Number(y.sugerida) - Number(x.sugerida) || y.n - x.n || String(x.nome).localeCompare(String(y.nome), 'pt-BR'));
}
// lê o que a sugestão precisa: a empresa, as obrigações ativas, os vínculos ativos de todas e o regime de cada empresa
// → { cliente: { id, nome, regime, cidade }, opcoes: sugerirObrigacoes(...), erro }
export async function obrigacoesParaVincular(sb, clienteId) {
  const fim = (erro, extra = {}) => ({ cliente: null, opcoes: [], erro, ...extra });
  const { data: cs, error: e1 } = await sb.from('clientes').select('id, nome_principal, regime_tributario, cidade').eq('id', clienteId);
  if (e1) return fim(msg(e1));
  const c = (cs || [])[0];
  if (!c) return fim('A empresa não existe mais no cadastro.');
  if (!c.regime_tributario) return fim('A empresa está sem regime no cadastro: acerte o regime e vincule na tela Obrigações fiscais.');
  const { data: obr, error: e2 } = await sb.from('obrigacoes_fiscais').select('id, nome, periodicidade, regimes_aplicaveis, ativo').eq('ativo', true);
  if (e2) return fim(msg(e2));
  const vinculos = [];
  for (let i = 0; ; i += 1000) {
    const { data, error } = await sb.from('cliente_obrigacoes').select('cliente_id, obrigacao_id').eq('ativo', true).range(i, i + 999);
    if (error) return fim(msg(error));
    vinculos.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  const regimeDe = {};
  for (const p of partes(unicos(vinculos.map(v => v.cliente_id)))) {
    const { data, error } = await sb.from('clientes').select('id, regime_tributario').in('id', p);
    if (error) return fim(msg(error));
    (data || []).forEach(x => { regimeDe[String(x.id)] = x.regime_tributario; });
  }
  const jaTem = vinculos.filter(v => String(v.cliente_id) === String(clienteId)).map(v => v.obrigacao_id);
  const cliente = { id: String(c.id), nome: c.nome_principal, regime: c.regime_tributario, cidade: c.cidade || null };
  return { cliente, opcoes: sugerirObrigacoes({ obrigacoes: obr, vinculos, regimeDe, regime: c.regime_tributario, cidade: c.cidade, jaTem, clienteId }), erro: null };
}
// vincula as escolhidas, como o "Vincular" da tela Obrigações fiscais (com quem cuida; o dia do prazo, o da obrigação); a
// que já teve vínculo e foi desligada volta a valer (como a chave da tela). As tarefas saem na geração do mês, na tela
// (ou, na tela Obrigações fiscais, já no vincular: a do mês escolhido). Desde 20/10/2026 é a regra do vincular nas três
// telas — o cartão do vigia, Obrigações fiscais e a ficha da empresa —: antes, o vínculo desligado aparecia na tela como
// "já vinculado" (caso da Pizzaria Arsenal), e na ficha a escolha dele derrubava o lote inteiro (a chave única).
// dia: o dia do prazo do vínculo (1 a 31; null = o da obrigação) — sem passar, o novo nasce com o da obrigação e o
// religado fica com o que tinha
// → { feitos: [{ id, obrigacao_id, novo, antes }], jaTinha: [obrigacao_id], erro }
export async function vincularObrigacoes(sb, clienteId, obrigacaoIds, responsavel, { dia } = {}) {
  const para = pessoaDaEquipe(responsavel);
  const res = { feitos: [], jaTinha: [], erro: null };
  if (!para || para === 'Ambos') return { ...res, erro: 'Escolha quem vai cuidar.' };
  const ids = unicos(obrigacaoIds);
  if (!clienteId || !ids.length) return { ...res, erro: 'Marque pelo menos uma obrigação.' };
  const comDia = dia === null || (Number.isInteger(dia) && dia >= 1 && dia <= 31);
  const { data: ex, error } = await sb.from('cliente_obrigacoes').select('id, obrigacao_id, ativo, responsavel, dia_prazo_override').eq('cliente_id', clienteId).in('obrigacao_id', ids);
  if (error) return { ...res, erro: msg(error) };
  const porObr = new Map((ex || []).map(v => [String(v.obrigacao_id), v]));
  const novos = ids.filter(o => !porObr.has(o));
  ids.filter(o => porObr.has(o) && porObr.get(o).ativo).forEach(o => res.jaTinha.push(o));
  if (novos.length) {
    const { data: ins, error: e2 } = await sb.from('cliente_obrigacoes')
      .insert(novos.map(o => ({ cliente_id: clienteId, obrigacao_id: o, responsavel: para, dia_prazo_override: comDia ? dia : null, ativo: true }))).select('id, obrigacao_id');
    if (e2) return { ...res, erro: msg(e2) };
    (ins || []).forEach(v => res.feitos.push({ id: String(v.id), obrigacao_id: String(v.obrigacao_id), novo: true, antes: null }));
  }
  for (const o of ids.filter(x => porObr.has(x) && !porObr.get(x).ativo)) {
    const v = porObr.get(o);
    const { data, error: e3 } = await sb.from('cliente_obrigacoes').update({ ativo: true, responsavel: para, ...(comDia ? { dia_prazo_override: dia } : {}) })
      .eq('id', v.id).eq('ativo', false).select('id');
    if (e3) return { ...res, erro: msg(e3) };
    if ((data || []).length) res.feitos.push({ id: String(v.id), obrigacao_id: o, novo: false,
      antes: { responsavel: v.responsavel ?? null, ...(comDia ? { dia_prazo_override: v.dia_prazo_override ?? null } : {}) } });
  }
  return res;
}
// desfazer: o vínculo novo sai — se já ganhou tarefa no meio do caminho, fica desligado; o que voltou a valer volta a
// desligado, com quem cuidava antes → { desfeitos: n, erro }
export async function desfazerVinculoObrigacoes(sb, clienteId, feitos) {
  const lista = (Array.isArray(feitos) ? feitos : []).filter(f => f && f.id && f.obrigacao_id);
  let desfeitos = 0;
  const novos = lista.filter(f => f.novo), religados = lista.filter(f => !f.novo);
  if (novos.length) {
    const { data: ts, error } = await sb.from('tarefas').select('obrigacao_id').eq('cliente_id', clienteId).in('obrigacao_id', novos.map(f => f.obrigacao_id));
    if (error) return { desfeitos, erro: msg(error) };
    const comTarefa = new Set((ts || []).map(t => String(t.obrigacao_id)));
    const apagar = novos.filter(f => !comTarefa.has(String(f.obrigacao_id))).map(f => f.id), desligar = novos.filter(f => comTarefa.has(String(f.obrigacao_id))).map(f => f.id);
    if (apagar.length) {
      const { data, error: e2 } = await sb.from('cliente_obrigacoes').delete().in('id', apagar).eq('cliente_id', clienteId).select('id');
      if (e2) return { desfeitos, erro: msg(e2) };
      desfeitos += (data || []).length;
    }
    if (desligar.length) {
      const { data, error: e3 } = await sb.from('cliente_obrigacoes').update({ ativo: false }).in('id', desligar).eq('ativo', true).select('id');
      if (e3) return { desfeitos, erro: msg(e3) };
      desfeitos += (data || []).length;
    }
  }
  for (const f of religados) {
    const volta = { ativo: false, responsavel: f.antes ? f.antes.responsavel ?? null : null };
    if (f.antes && 'dia_prazo_override' in f.antes) volta.dia_prazo_override = f.antes.dia_prazo_override ?? null;
    const { data, error } = await sb.from('cliente_obrigacoes').update(volta).eq('id', f.id).eq('ativo', true).select('id');
    if (error) return { desfeitos, erro: msg(error) };
    desfeitos += (data || []).length;
  }
  return { desfeitos, erro: null };
}

// ---- a tarefa da obrigação de um vínculo num mês (20/10/2026) ----
// A mesma montagem do "Gerar rotinas do mês", do "Gerar a deste mês" e do vincular da tela Obrigações fiscais — e do
// cartão do vigia ("sem a tarefa do mês", "religar"). O prazo é o dia do vínculo (ou o da obrigação) naquele mês, no
// próximo dia útil (sábado e domingo; feriado, não — como a tela sempre fez); a competência fiscal, pelo deslocamento da
// obrigação ("09/2026", ou o ano, nas anuais)
const pad2 = n => String(n).padStart(2, '0');
const ultimoDiaDoMes = (a, m) => new Date(a, m, 0).getDate();
const ymdLocal = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
const proximoDiaUtil = d => { const x = new Date(d); while (x.getDay() === 0 || x.getDay() === 6) x.setDate(x.getDate() + 1); return x; };
export function competenciaFiscal(r, anoOcc, M) {
  if (r.competencia_formato === 'AAAA') return String(anoOcc - (r.competencia_offset_meses || 0));
  let m = M - (r.competencia_offset_meses || 0), a = anoOcc;
  while (m < 1) { m += 12; a -= 1; }
  return pad2(m) + '/' + a;
}
export function tarefaDaObrigacao(r, v, anoOcc, M) {
  const dia = Math.min(v.dia_prazo_override || r.dia_prazo, ultimoDiaDoMes(anoOcc, M));
  const prazoD = proximoDiaUtil(new Date(anoOcc, M - 1, dia));
  const cf = competenciaFiscal(r, anoOcc, M);
  return {
    setor: 'fiscal', titulo: r.nome, cliente_id: v.cliente_id,
    responsavel: v.responsavel || null, prazo: ymdLocal(prazoD),
    status: 'pendente', prioridade: 'media', origem: 'recorrente',
    obrigacao_id: r.id, competencia: anoOcc + '-' + pad2(M), competencia_fiscal: cf,
    descricao: 'Competência ' + cf + ' · Gerada pelo módulo Obrigações'
  };
}
// o que a tarefa do mês do vínculo seria → { vinculo, obrigacao, tarefa, ja, erro }: tarefa = a montada (sem gravar), ja =
// a do vínculo naquele mês já existe; erro quando não dá (o vínculo sumiu, a obrigação não vence no mês…)
export async function tarefaDoMesDoVinculo(sb, vinculoId, { ano, mes } = {}) {
  const fim = (erro, extra = {}) => ({ vinculo: null, obrigacao: null, tarefa: null, ja: false, erro, ...extra });
  if (!vinculoId || !(Number(ano) >= 2000) || !(Number(mes) >= 1 && Number(mes) <= 12)) return fim('Mês inválido.');
  const { data: vs, error: e1 } = await sb.from('cliente_obrigacoes').select('id, cliente_id, obrigacao_id, responsavel, dia_prazo_override, ativo').eq('id', vinculoId);
  if (e1) return fim(msg(e1));
  const v = (vs || [])[0];
  if (!v) return fim('O vínculo não existe mais: confira na tela Obrigações fiscais.');
  const { data: os, error: e2 } = await sb.from('obrigacoes_fiscais').select('id, nome, dia_prazo, meses_vencimento, competencia_offset_meses, competencia_formato, ativo').eq('id', v.obrigacao_id);
  if (e2) return fim(msg(e2));
  const r = (os || [])[0];
  if (!r || r.ativo === false) return fim('A obrigação não está mais ativa: confira na tela Obrigações fiscais.', { vinculo: v });
  if (!(Array.isArray(r.meses_vencimento) ? r.meses_vencimento : []).map(Number).includes(Number(mes)))
    return fim('A obrigação não vence em ' + pad2(mes) + '/' + ano + '.', { vinculo: v, obrigacao: r });
  const comp = ano + '-' + pad2(mes);
  const { data: ex, error: e3 } = await sb.from('tarefas').select('id').eq('obrigacao_id', v.obrigacao_id).eq('cliente_id', v.cliente_id).eq('competencia', comp);
  if (e3) return fim(msg(e3));
  return { vinculo: v, obrigacao: r, tarefa: tarefaDaObrigacao(r, v, Number(ano), Number(mes)), ja: (ex || []).length > 0, erro: null };
}
// cria a tarefa do mês do vínculo (o "Gerar a deste mês" de um só) → { tarefa: { id, titulo, prazo, responsavel,
// competencia }, ja, erro }: o vínculo tem de estar ligado e a tarefa ainda não existir. Desfazer: excluirTarefasCriadas
// (só a que continua pendente)
export async function criarTarefaDoMes(sb, vinculoId, { ano, mes } = {}) {
  const p = await tarefaDoMesDoVinculo(sb, vinculoId, { ano, mes });
  if (p.erro) return { tarefa: null, ja: false, erro: p.erro };
  if (!p.vinculo.ativo) return { tarefa: null, ja: false, erro: 'A obrigação está desligada nessa empresa: religue antes.' };
  if (p.ja) return { tarefa: null, ja: true, erro: null };
  const { data, error } = await sb.from('tarefas').insert(p.tarefa).select('id, titulo, prazo, responsavel, competencia');
  if (error) return { tarefa: null, ja: false, erro: msg(error) };
  const t = (data || [])[0];
  return { tarefa: t ? { ...t, id: String(t.id) } : null, ja: false, erro: t ? null : 'A tarefa não foi criada.' };
}
// o vínculo desligado volta a ligar, com quem cuida (a regra do vincular: o dia que ele tinha fica) → o retorno do
// vincularObrigacoes, com o cliente_id (o desfazer é o desfazerVinculoObrigacoes, que o desliga de novo)
export async function religarVinculo(sb, vinculoId, responsavel) {
  const { data, error } = await sb.from('cliente_obrigacoes').select('id, cliente_id, obrigacao_id, ativo').eq('id', vinculoId);
  if (error) return { feitos: [], jaTinha: [], cliente_id: null, erro: msg(error) };
  const v = (data || [])[0];
  if (!v) return { feitos: [], jaTinha: [], cliente_id: null, erro: 'O vínculo não existe mais: confira na tela Obrigações fiscais.' };
  const r = await vincularObrigacoes(sb, v.cliente_id, [v.obrigacao_id], responsavel);
  return { ...r, cliente_id: String(v.cliente_id) };
}

// a empresa da carteira sem cobrança: na base de boletos, como o "+ empresa" da tela Boletos (canal WhatsApp; contato,
// destino e responsável em branco, pra acertar na grade), com o valor e o dia do vencimento; a que tinha a cobrança parada
// volta a valer com eles. A sugestão: o valor e o dia da cobrança parada, senão o honorário da proposta fechada
export async function dadosDaCobranca(sb, clienteId) {
  const { data: cs, error } = await sb.from('cobrancas_config').select('id, ativo, valor_base, dia_vencimento').eq('cliente_id', clienteId);
  if (error) return { config: null, valor: null, dia: 10, erro: msg(error) };
  const config = (cs || [])[0] || null;
  let valor = config && Number(config.valor_base) > 0 ? Number(config.valor_base) : null;
  if (valor == null) {
    const { data: ps } = await sb.from('precificacoes').select('honorario').eq('cliente_id', clienteId).eq('status', 'fechada').order('atualizado_em', { ascending: false }).limit(1);
    const hon = ps && ps[0] ? Number(ps[0].honorario) : null;
    if (hon > 0) valor = hon;
  }
  const dia = config && Number(config.dia_vencimento) >= 1 && Number(config.dia_vencimento) <= 31 ? Number(config.dia_vencimento) : 10;
  return { config, valor, dia, erro: null };
}
// → { feito: { id, novo, antes }, ja: true quando já está ativa, erro }
export async function porNaCobranca(sb, clienteId, { valor, dia } = {}) {
  const v = Math.round(Number(valor) * 100) / 100, d = Number(dia);
  if (!clienteId || !(v > 0)) return { feito: null, erro: 'Informe o valor da cobrança.' };
  if (!Number.isInteger(d) || d < 1 || d > 31) return { feito: null, erro: 'Informe o dia do vencimento (1 a 31).' };
  const { data: cs, error } = await sb.from('cobrancas_config').select('id, ativo, valor_base, dia_vencimento').eq('cliente_id', clienteId);
  if (error) return { feito: null, erro: msg(error) };
  const c = (cs || [])[0];
  if (c && c.ativo) return { feito: null, ja: true, erro: null };
  if (c) {
    const { data, error: e2 } = await sb.from('cobrancas_config').update({ ativo: true, valor_base: v, dia_vencimento: d }).eq('id', c.id).eq('ativo', false).select('id');
    if (e2) return { feito: null, erro: msg(e2) };
    return { feito: (data || []).length ? { id: String(c.id), novo: false, valor: v, dia: d, antes: { valor_base: c.valor_base ?? null, dia_vencimento: c.dia_vencimento ?? null } } : null, erro: null };
  }
  const { data, error: e3 } = await sb.from('cobrancas_config').insert({ cliente_id: clienteId, valor_base: v, dia_vencimento: d, canal: 'whatsapp', contato_envio: '', destino: '', responsavel: '', ativo: true }).select('id');
  if (e3) return { feito: null, erro: msg(e3) };
  const id = data && data[0] ? String(data[0].id) : null;
  return { feito: id ? { id, novo: true, valor: v, dia: d, antes: null } : null, erro: id ? null : 'A base de boletos não confirmou a gravação.' };
}
// desfazer: a nova sai da base; a que voltou a valer volta a parada, com o valor e o dia de antes → { desfeita, erro }
export async function desfazerCobranca(sb, feito) {
  if (!feito || !feito.id) return { desfeita: false, erro: null };
  const q = feito.novo ? sb.from('cobrancas_config').delete().eq('id', feito.id).eq('ativo', true)
    : sb.from('cobrancas_config').update({ ativo: false, valor_base: feito.antes ? feito.antes.valor_base : null, dia_vencimento: feito.antes ? feito.antes.dia_vencimento : null }).eq('id', feito.id).eq('ativo', true);
  const { data, error } = await q.select('id');
  return { desfeita: !error && (data || []).length > 0, erro: error ? msg(error) : null };
}

// o cadastro que não bate com a carteira passa a seguir a carteira, como a situação na ficha da empresa: saiu = inativo (o
// "fim como cliente" vazio ganha a data da saída); na carteira = ativo → { cliente: { id, para, status_antes, fim_antes, fim }, ja, erro }
export async function acertarCadastro(sb, clienteId, { hoje = hojeLocal() } = {}) {
  const { data: cs, error } = await sb.from('clientes').select('id, status, data_fim_cliente').eq('id', clienteId);
  if (error) return { cliente: null, erro: msg(error) };
  const k = (cs || [])[0];
  if (!k) return { cliente: null, erro: 'A empresa não existe mais no cadastro.' };
  const { data: cart, error: e2 } = await sb.from('carteira_info').select('entrada, saida').eq('cliente_id', clienteId);
  if (e2) return { cliente: null, erro: msg(e2) };
  const c = (cart || [])[0];
  const saida = c && c.saida ? String(c.saida).slice(0, 10) : null, entrada = c && c.entrada ? String(c.entrada).slice(0, 10) : null;
  const para = saida && saida <= hoje ? 'inativo' : entrada && entrada <= hoje ? 'ativo' : null;
  if (!para) return { cliente: null, erro: 'A carteira não diz se ela é cliente hoje: confira na tela Carteira.' };
  if (k.status === para) return { cliente: null, ja: para, erro: null };
  const fimAntes = k.data_fim_cliente ? String(k.data_fim_cliente).slice(0, 10) : null;
  const patch = { status: para, ...(para === 'inativo' && !fimAntes ? { data_fim_cliente: saida } : {}) };
  const { data, error: e3 } = await sb.from('clientes').update(patch).eq('id', clienteId).eq('status', k.status).select('id');
  if (e3) return { cliente: null, erro: msg(e3) };
  if (!(data || []).length) return { cliente: null, erro: 'O cadastro mudou no meio do caminho: confira na ficha da empresa.' };
  return { cliente: { id: String(clienteId), para, status_antes: k.status, fim_antes: fimAntes, fim: 'data_fim_cliente' in patch ? patch.data_fim_cliente : fimAntes }, erro: null };
}
export async function desfazerCadastro(sb, cliente) {
  if (!cliente || !cliente.id || !cliente.para || !cliente.status_antes) return { desfeita: false, erro: null };
  const { data, error } = await sb.from('clientes').update({ status: cliente.status_antes, data_fim_cliente: cliente.fim_antes ?? null }).eq('id', cliente.id).eq('status', cliente.para).select('id');
  return { desfeita: !error && (data || []).length > 0, erro: error ? msg(error) : null };
}

// desfazerPagos(sb, pagos) → { desfeitos: [ids], erro } — volta à situação de antes, só de quem continua pago
export async function desfazerPagos(sb, pagos) {
  const grupos = new Map();
  (Array.isArray(pagos) ? pagos : []).filter(p => p && p.id).forEach(p => {
    const s = ['a_emitir', 'emitido', 'enviado'].includes(p.status_antes) ? p.status_antes : 'enviado';
    if (!grupos.has(s)) grupos.set(s, []);
    grupos.get(s).push(String(p.id));
  });
  const desfeitos = [];
  for (const [status, ids] of grupos) {
    for (const p of partes(ids)) {
      const { data, error } = await sb.from('cobrancas_mensais').update({ status }).in('id', p).eq('status', 'pago').select('id');
      if (error) return { desfeitos, erro: msg(error) };
      (data || []).forEach(x => desfeitos.push(String(x.id)));
    }
  }
  return { desfeitos, erro: null };
}

// ============================================================
// Os cadastros (30/10/2026, pedido do Samuel: "as vezes acho que o assistente ta um pouco limitado nas ações, preciso que
// esse tipo de coisa ele possa fazer") — o que o assistente recusava por "só leio": incluir empresa na campanha da Reforma,
// pôr empresa num mês dos boletos e ajustar as obrigações das empresas em lote. Cada uma com o desfazer que só volta onde
// ninguém mexeu depois.
// ============================================================

// lê as linhas dos ids, em lotes (o filtro vai no endereço)
async function lerTodosPorIds(sb, tabela, colunas, ids, coluna = 'id') {
  const out = [];
  for (const p of partes(unicos(ids))) {
    const { data, error } = await sb.from(tabela).select(colunas).in(coluna, p);
    if (error) throw new Error(msg(error));
    out.push(...(data || []));
  }
  return out;
}

// ---- incluir na campanha da Reforma ----
// A campanha da opção IBS/CBS de 2027 se monta sozinha com as empresas do Simples da carteira (o espelho do banco,
// rt_incluir_na_campanha). A que vai pro Simples e a que está fora da carteira (o próprio escritório) entram por aqui: o caso
// nasce como o do espelho — triado, pendente, o CNAE do cadastro — com a observação de quem incluiu e por quê. Só empresa
// (PJ) e uma vez por empresa (o banco tem a chave empresa + campanha). Desfazer apaga o caso em que ninguém mexeu depois: o
// atualizado_em continua o da inclusão (a tela da Reforma grava a hora a cada mudança) e a decisão, pendente
export const MAX_OBS_CAMPANHA = 300;
export function obsDaInclusao({ hoje = hojeLocal(), quem = null, observacao = '' } = {}) {
  const o = [...String(observacao || '').replace(/\s+/g, ' ').trim()].slice(0, MAX_OBS_CAMPANHA).join('').replace(/[.\s]+$/, '');
  return 'Entrou na campanha pelo assistente do escritório em ' + dataBR(hoje) + (quem ? ', a pedido de ' + quem : '') + (o ? ': ' + o : '') + '.';
}
// → { incluidos: [{ id, cliente_id, atualizado_em }], jaEstavam: [cliente_id], naoPj: [cliente_id], erro }
export async function incluirNaCampanha(sb, clienteIds, { quem = null, observacao = '', hoje = hojeLocal(), agora = new Date().toISOString() } = {}) {
  const res = { incluidos: [], jaEstavam: [], naoPj: [], erro: null };
  const ids = unicos(clienteIds);
  if (!ids.length) return res;
  let cli, casos;
  try {
    cli = await lerTodosPorIds(sb, 'clientes', 'id, tipo_pessoa, cnae_principal', ids);
    casos = await lerTodosPorIds(sb, 'rt_casos', 'id, cliente_id', ids, 'cliente_id');
  } catch (e) { return { ...res, erro: msg(e) }; }
  const tem = new Set(casos.map(c => String(c.cliente_id)));
  const porId = new Map(cli.map(c => [String(c.id), c]));
  const obs = obsDaInclusao({ hoje, quem, observacao });
  for (const id of ids) {
    const c = porId.get(id);
    if (!c) continue;   // saiu do cadastro no meio do caminho
    if (tem.has(id)) { res.jaEstavam.push(id); continue; }
    if (c.tipo_pessoa !== 'PJ') { res.naoPj.push(id); continue; }
    const linha = { cliente_id: id, cnae_base: String(c.cnae_principal || '').slice(0, 9) || null, status: 'triado', decisao: 'pendente', obs, atualizado_em: agora };
    const { data, error } = await sb.from('rt_casos').insert(linha).select('id, cliente_id, atualizado_em');
    if (error) {
      if (error.code === '23505') { res.jaEstavam.push(id); continue; }   // outra pessoa incluiu no meio do caminho
      return { ...res, erro: msg(error) };
    }
    const x = (data || [])[0];
    if (x) res.incluidos.push({ id: String(x.id), cliente_id: id, atualizado_em: x.atualizado_em || agora });
  }
  return res;
}
// → { desfeitos: [id do caso], ficaram: quantos alguém já mexeu, erro }
export async function desfazerInclusaoCampanha(sb, incluidos) {
  const out = { desfeitos: [], ficaram: 0, erro: null };
  for (const c of Array.isArray(incluidos) ? incluidos : []) {
    if (!c || !c.id) continue;
    let q = sb.from('rt_casos').delete().eq('id', c.id).eq('decisao', 'pendente');
    if (c.atualizado_em) q = q.eq('atualizado_em', c.atualizado_em);
    const { data, error } = await q.select('id');
    if (error) return { ...out, erro: msg(error) };
    if ((data || []).length) out.desfeitos.push(String(c.id)); else out.ficaram++;
  }
  return out;
}

// ---- pôr a empresa num mês dos boletos ----
// O vencimento da competência M: no mês seguinte, no dia da cobrança (acima do último dia do mês, o último), no próximo dia
// útil — sábado, domingo e os feriados da rescisao-datas.js (os mesmos da tela Boletos, que usa esta conta)
export function vencimentoDaCompetencia(competencia, dia) {
  const [y, m] = String(competencia || '').split('-').map(Number);
  if (!(y >= 2000) || !(m >= 1 && m <= 12)) return null;
  let vy = y, vm = m + 1;
  if (vm > 12) { vm = 1; vy++; }
  const ultimo = new Date(vy, vm, 0).getDate();
  const dd = Math.min(Math.max(parseInt(dia, 10) || 10, 1), ultimo);
  let iso = vy + '-' + pad2(vm) + '-' + pad2(dd);
  while (!diaUtil(iso)) iso = somaDias(iso, 1);
  return iso;
}
export const COMPETENCIA_ISO = /^\d{4}-(0[1-9]|1[0-2])$/;
// O que cada empresa levaria na competência, como a geração do mês da tela Boletos monta: o valor, o dia e os dados de envio
// da cobrança mais recente dela antes dessa competência (a geração copia a última) — sem nenhuma, os da base de cobrança;
// sem base, valor em branco e dia 10 (o padrão do "Adicionar empresa"). → Map(cliente_id → { cliente_id, ja (a situação
// da que já está na competência, ou null), valor, dia, vencimento, canal, contato_envio, destino, responsavel, fonte:
// 'copia' | 'base' | 'nada', de (a competência copiada), base (a base: { id, ativo } ou null) })
export async function dadosParaCompetencia(sb, clienteIds, competencia) {
  const out = new Map();
  const ids = unicos(clienteIds);
  if (!ids.length || !COMPETENCIA_ISO.test(String(competencia || ''))) return out;
  const linhas = await lerTodosPorIds(sb, 'cobrancas_mensais', 'cliente_id, competencia, valor, vencimento, canal, contato_envio, destino, responsavel, status', ids, 'cliente_id');
  const bases = await lerTodosPorIds(sb, 'cobrancas_config', 'id, cliente_id, valor_base, dia_vencimento, canal, contato_envio, destino, responsavel, ativo', ids, 'cliente_id');
  const baseDe = new Map(bases.map(b => [String(b.cliente_id), b]));
  for (const id of ids) {
    const minhas = linhas.filter(l => String(l.cliente_id) === id);
    const naComp = minhas.find(l => l.competencia === competencia);
    const antes = minhas.filter(l => String(l.competencia) < competencia).sort((a, b) => String(b.competencia).localeCompare(String(a.competencia)))[0] || null;
    const b = baseDe.get(id) || null;
    const diaDe = v => (v ? parseInt(String(v).slice(8, 10), 10) : null);
    const fonte = antes ? 'copia' : b ? 'base' : 'nada';
    const valor = antes ? Number(antes.valor) || 0 : b ? Number(b.valor_base) || 0 : null;
    const dia = (antes && diaDe(antes.vencimento)) || (b && Number(b.dia_vencimento)) || 10;
    const de = antes || b || {};
    out.set(id, { cliente_id: id, ja: naComp ? naComp.status || 'a_emitir' : null, valor, dia, vencimento: vencimentoDaCompetencia(competencia, dia),
      canal: de.canal || 'whatsapp', contato_envio: de.contato_envio || '', destino: de.destino || '', responsavel: de.responsavel || '',
      fonte, de: antes ? antes.competencia : null, base: b ? { id: String(b.id), ativo: b.ativo !== false } : null });
  }
  return out;
}
// itens: [{ cliente_id, valor, vencimento, canal, contato_envio, destino, responsavel }] — a linha nasce "a emitir"; a empresa
// sem base de cobrança ganha a base com o valor e o dia (senão a geração dos próximos meses a esquece: o caso de Arsenal,
// Massa e Mirelle em ago/2026, que o "Adicionar empresa" da tela também trata)
// → { postos: [{ id, cliente_id, valor }], bases: [{ id, cliente_id, valor_base, dia_vencimento }], jaEstavam: [cliente_id], erro }
export async function porNaCompetencia(sb, competencia, itens) {
  const res = { postos: [], bases: [], jaEstavam: [], erro: null };
  if (!COMPETENCIA_ISO.test(String(competencia || ''))) return { ...res, erro: "A competência vai em 'AAAA-MM'." };
  for (const it of Array.isArray(itens) ? itens : []) {
    const id = it && it.cliente_id ? String(it.cliente_id) : null;
    if (!id) continue;
    const valor = Math.round(Number(it.valor) * 100) / 100;
    if (!(valor >= 0) || !Number.isFinite(valor)) return { ...res, erro: 'Valor inválido.' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(it.vencimento || ''))) return { ...res, erro: 'Vencimento inválido.' };
    const dia = parseInt(String(it.vencimento).slice(8, 10), 10);
    const envio = { canal: it.canal || 'whatsapp', contato_envio: it.contato_envio || '', destino: it.destino || '', responsavel: it.responsavel || '' };
    const linha = { cliente_id: id, competencia, valor, vencimento: it.vencimento, ...envio, observacao: '', status: 'a_emitir', itens_extras: [] };
    const { data, error } = await sb.from('cobrancas_mensais').insert(linha).select('id, cliente_id, valor');
    if (error) {
      if (error.code === '23505') { res.jaEstavam.push(id); continue; }   // já estava no mês (outra pessoa pôs no meio)
      return { ...res, erro: msg(error) };
    }
    const x = (data || [])[0];
    if (!x) continue;
    res.postos.push({ id: String(x.id), cliente_id: id, valor });
    // entrou no mês: sem base de cobrança, ganha a base
    const { data: bs, error: eb } = await sb.from('cobrancas_config').select('id').eq('cliente_id', id);
    if (eb) return { ...res, erro: 'O boleto entrou, mas não consegui conferir a base de cobrança: ' + msg(eb) };
    if (!(bs || []).length) {
      const { data: nb, error: en } = await sb.from('cobrancas_config').insert({ cliente_id: id, valor_base: valor, dia_vencimento: dia, ...envio, ativo: true }).select('id');
      if (en && en.code !== '23505') return { ...res, erro: 'O boleto entrou, mas a base de cobrança não: ' + msg(en) };
      if (nb && nb[0]) res.bases.push({ id: String(nb[0].id), cliente_id: id, valor_base: valor, dia_vencimento: dia });
    }
  }
  return res;
}
// desfazer: sai a linha que continua "a emitir" com o valor de quando entrou, e a base que nasceu aqui e ninguém mexeu
// → { desfeitos: [id], ficaram: quantas linhas alguém já mexeu, erro }
export async function desfazerPorNaCompetencia(sb, feito) {
  const out = { desfeitos: [], ficaram: 0, erro: null };
  for (const p of feito && Array.isArray(feito.postos) ? feito.postos : []) {
    if (!p || !p.id) continue;
    const { data, error } = await sb.from('cobrancas_mensais').delete().eq('id', p.id).eq('status', 'a_emitir').eq('valor', p.valor).select('id');
    if (error) return { ...out, erro: msg(error) };
    if ((data || []).length) out.desfeitos.push(String(p.id)); else out.ficaram++;
  }
  for (const b of feito && Array.isArray(feito.bases) ? feito.bases : []) {
    if (!b || !b.id) continue;
    const { error } = await sb.from('cobrancas_config').delete().eq('id', b.id).eq('ativo', true).eq('valor_base', b.valor_base).eq('dia_vencimento', b.dia_vencimento).select('id');
    if (error) return { ...out, erro: msg(error) };
  }
  return out;
}

// ---- as obrigações das empresas, em lote ----
// Quem cuida, o dia do prazo daqui pra frente e desligar — o que a tela Obrigações fiscais faz vínculo por vínculo (a edição
// na linha e o liga/desliga), pra vários de uma vez (os pedidos da Thalia de 21 e 27/10/2026). Quem cuida: as tarefas
// abertas do vínculo vão junto, só as que estavam com o de antes ou sem ninguém (a repassada à mão pra outra pessoa fica — a
// regra da tela). O dia: o próprio da empresa (dia_prazo_override; igual ao da obrigação = sem dia próprio), da próxima tarefa
// gerada em diante — as já criadas ficam com o prazo delas. Desligar: a tarefa do mês não nasce mais; as abertas ficam.
// mudar: { responsavel } e/ou { dia }, ou { desligar: true } sozinho → o limpo, ou null
export function limparAjuste(m) {
  if (!m || typeof m !== 'object') return null;
  if (m.desligar === true) return { desligar: true };
  const out = {};
  if (m.responsavel != null && String(m.responsavel).trim()) { const p = pessoaDaEquipe(m.responsavel); if (!p) return null; out.responsavel = p; }
  if (m.dia != null && m.dia !== '') { const d = Number(m.dia); if (!Number.isInteger(d) || d < 1 || d > 31) return null; out.dia = d; }
  return Object.keys(out).length ? out : null;
}
// o que muda num vínculo (com a obrigação dele: { dia_prazo }) → { responsavel?, dia_prazo_override?, ativo? } ou null (já está assim)
export function ajusteDoVinculo(v, r, mudar) {
  const m = limparAjuste(mudar);
  if (!m || !v || v.ativo === false) return null;
  if (m.desligar) return { ativo: false };
  const out = {};
  if (m.responsavel && semAcento(v.responsavel) !== semAcento(m.responsavel)) out.responsavel = m.responsavel;
  if (m.dia) {
    const novo = r && Number(r.dia_prazo) === m.dia ? null : m.dia;
    if ((v.dia_prazo_override ?? null) !== novo) out.dia_prazo_override = novo;
  }
  return Object.keys(out).length ? out : null;
}
const chaveDe = (...xs) => JSON.stringify(xs);
// → { vinculos: [{ id, cliente_id, obrigacao_id, antes: { campo: valor }, depois: { campo: valor } }], tarefas: [{ id, antes }], erro }
export async function ajustarVinculos(sb, ids, mudar, { autor = null, origem = null } = {}) {
  const res = { vinculos: [], tarefas: [], erro: null };
  const m = limparAjuste(mudar);
  if (!m) return { ...res, erro: 'Diga o que muda: quem cuida (alguém da equipe), o dia do prazo (1 a 31) ou desligar.' };
  let vs, regras;
  try {
    vs = (await lerTodosPorIds(sb, 'cliente_obrigacoes', 'id, cliente_id, obrigacao_id, responsavel, dia_prazo_override, ativo', ids)).filter(v => v.ativo !== false);
    regras = new Map((await lerTodosPorIds(sb, 'obrigacoes_fiscais', 'id, dia_prazo', vs.map(v => v.obrigacao_id))).map(r => [String(r.id), r]));
  } catch (e) { return { ...res, erro: msg(e) }; }
  const feitos = new Map();
  const anotar = (v, campo, antes, depois) => {
    const f = feitos.get(String(v.id)) || { id: String(v.id), cliente_id: String(v.cliente_id), obrigacao_id: String(v.obrigacao_id), antes: {}, depois: {} };
    f.antes[campo] = antes; f.depois[campo] = depois;
    feitos.set(String(v.id), f);
  };
  const pronto = erro => ({ ...res, vinculos: [...feitos.values()], erro });
  const planos = vs.map(v => ({ v, d: ajusteDoVinculo(v, regras.get(String(v.obrigacao_id)), m) })).filter(x => x.d);
  // quem cuida — por quem estava (o update confere que ninguém trocou no meio) e, pras tarefas, por obrigação
  const trocam = planos.filter(x => 'responsavel' in x.d).map(x => x.v);
  for (const [k, grupo] of porAntes(trocam, 'responsavel')) {
    const antes = deVolta(k);
    for (const p of partes(grupo.map(v => String(v.id)))) {
      let q = sb.from('cliente_obrigacoes').update({ responsavel: m.responsavel }).in('id', p).eq('ativo', true);
      q = antes == null ? q.is('responsavel', null) : q.eq('responsavel', antes);
      const { data, error } = await q.select('id');
      if (error) return pronto(msg(error));
      const foram = new Set((data || []).map(x => String(x.id)));
      const mudaram = grupo.filter(v => foram.has(String(v.id)));
      mudaram.forEach(v => anotar(v, 'responsavel', antes, m.responsavel));
      const porObrig = new Map();
      mudaram.forEach(v => { const o = String(v.obrigacao_id); if (!porObrig.has(o)) porObrig.set(o, []); porObrig.get(o).push(String(v.cliente_id)); });
      for (const [o, clis] of porObrig) {
        for (const pc of partes(clis)) {
          let qt = sb.from('tarefas').update({ responsavel: m.responsavel }).eq('obrigacao_id', o).in('cliente_id', pc).neq('status', 'concluida');
          qt = antes == null ? qt.is('responsavel', null) : qt.eq('responsavel', antes);
          const { data: ts, error: et } = await qt.select('id');
          if (et) return pronto('Os vínculos mudaram, mas as tarefas abertas deles não: ' + msg(et));
          (ts || []).forEach(t => res.tarefas.push({ id: String(t.id), antes }));
        }
      }
    }
  }
  // o dia — por (o de antes, o novo)
  const grupos = new Map();
  planos.filter(x => 'dia_prazo_override' in x.d).forEach(({ v, d }) => {
    const k = chaveDe(v.dia_prazo_override ?? null, d.dia_prazo_override);
    if (!grupos.has(k)) grupos.set(k, { antes: v.dia_prazo_override ?? null, novo: d.dia_prazo_override, vs: [] });
    grupos.get(k).vs.push(v);
  });
  for (const g of grupos.values()) {
    for (const p of partes(g.vs.map(v => String(v.id)))) {
      let q = sb.from('cliente_obrigacoes').update({ dia_prazo_override: g.novo }).in('id', p).eq('ativo', true);
      q = g.antes == null ? q.is('dia_prazo_override', null) : q.eq('dia_prazo_override', g.antes);
      const { data, error } = await q.select('id');
      if (error) return pronto(msg(error));
      const foram = new Set((data || []).map(x => String(x.id)));
      g.vs.filter(v => foram.has(String(v.id))).forEach(v => anotar(v, 'dia_prazo_override', g.antes, g.novo));
    }
  }
  // desligar
  const desligam = planos.filter(x => 'ativo' in x.d).map(x => x.v);
  for (const p of partes(desligam.map(v => String(v.id)))) {
    const { data, error } = await sb.from('cliente_obrigacoes').update({ ativo: false }).in('id', p).eq('ativo', true).select('id');
    if (error) return pronto(msg(error));
    const foram = new Set((data || []).map(x => String(x.id)));
    desligam.filter(v => foram.has(String(v.id))).forEach(v => anotar(v, 'ativo', true, false));
  }
  if (res.tarefas.length) {
    await sb.from('tarefa_historico').insert(res.tarefas.map(t => ({ tarefa_id: t.id,
      descricao: 'Responsável trocado na obrigação: ' + (t.antes || 'sem responsável') + ' → ' + m.responsavel + (origem ? ' — pelo ' + origem : '') + '.', autor })));
  }
  return pronto(null);
}
// desfazer: cada campo volta ao de antes só onde continua como ficou; as tarefas, só as abertas que continuam com quem
// assumiu → { vinculos: quantos voltaram, tarefas: [ids], erro }
export async function desfazerAjusteVinculos(sb, feito, { autor = null, origem = null } = {}) {
  const out = { vinculos: 0, tarefas: [], erro: null };
  const vs = feito && Array.isArray(feito.vinculos) ? feito.vinculos.filter(v => v && v.id && v.depois) : [];
  const voltaram = new Set();
  for (const campo of ['ativo', 'responsavel', 'dia_prazo_override']) {
    const grupos = new Map();
    vs.filter(v => campo in v.depois).forEach(v => {
      const k = chaveDe(v.antes[campo] ?? null, v.depois[campo] ?? null);
      if (!grupos.has(k)) grupos.set(k, { antes: v.antes[campo] ?? null, depois: v.depois[campo] ?? null, ids: [] });
      grupos.get(k).ids.push(String(v.id));
    });
    for (const g of grupos.values()) {
      for (const p of partes(g.ids)) {
        let q = sb.from('cliente_obrigacoes').update({ [campo]: g.antes }).in('id', p);
        q = g.depois == null ? q.is(campo, null) : q.eq(campo, g.depois);
        const { data, error } = await q.select('id');
        if (error) return { ...out, vinculos: voltaram.size, erro: msg(error) };
        (data || []).forEach(x => voltaram.add(String(x.id)));
      }
    }
  }
  out.vinculos = voltaram.size;
  const para = vs.map(v => v.depois.responsavel).find(Boolean);
  if (para) {
    for (const [k, ts] of porAntes(feito && Array.isArray(feito.tarefas) ? feito.tarefas : [])) {
      for (const p of partes(ts.map(t => String(t.id)))) {
        const { data, error } = await sb.from('tarefas').update({ responsavel: deVolta(k) }).in('id', p).eq('responsavel', para).neq('status', 'concluida').select('id');
        if (error) return { ...out, erro: msg(error) };
        (data || []).forEach(x => out.tarefas.push(String(x.id)));
      }
    }
    if (out.tarefas.length) {
      await sb.from('tarefa_historico').insert(out.tarefas.map(id => ({ tarefa_id: id, descricao: 'Troca do responsável pela obrigação desfeita' + (origem ? ' no ' + origem : '') + '.', autor })));
    }
  }
  return out;
}
