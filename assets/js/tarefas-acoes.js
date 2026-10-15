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
// ============================================================

const LOTE = 100;   // ids por chamada: o filtro vai no endereço
const partes = lista => { const out = []; for (let i = 0; i < lista.length; i += LOTE) out.push(lista.slice(i, i + LOTE)); return out; };
const unicos = ids => [...new Set((Array.isArray(ids) ? ids : []).filter(x => x != null && x !== '').map(String))];
const msg = e => String((e && e.message) || e || 'erro');

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

// concluirTarefas(sb, ids, { autor, historico }) → { concluidas: [{ id, titulo, cliente_id, status_antes, faturavel }],
//   jaEstavam: [ids que não estavam abertos — concluídos por outra pessoa, ou que não existem mais], semHistorico, erro }
export async function concluirTarefas(sb, ids, { autor = null, historico = 'Tarefa concluída.' } = {}) {
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
  const { error: eh } = await sb.from('tarefa_historico').insert(concluidas.map(c => ({ tarefa_id: c.id, descricao: historico, autor })));
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
