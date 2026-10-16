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
//                     Boletos), cada uma com o desfazer que só volta onde ninguém mexeu depois.
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

// alterarTarefas(sb, ids, mudar, { autor, origem }) → { alteradas: [{ id, titulo, antes, depois }], iguais: [ids já assim],
//   fechadas: [ids concluídos ou que não existem], daFicha: [{ id, nome, tela }], semHistorico, erro }
// mudar: { prazo?, responsavel?, prioridade? } (limparMudanca). Só tarefa aberta e fora das da ficha de origem
export async function alterarTarefas(sb, ids, mudar, { autor = null, origem = null } = {}) {
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
  const { error: eh } = await sb.from('tarefa_historico').insert(res.alteradas.map(a => ({ tarefa_id: a.id, descricao: descreverMudanca(a.antes, a.depois) + fim, autor })));
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
const DA_EQUIPE = { thalia: 'Thalia', vitoria: 'Vitória', adaini: 'Adaini', samuel: 'Samuel', diego: 'Diego', edna: 'Edna', ambos: 'Ambos' };
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
