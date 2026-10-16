// Ações nas tarefas e nos boletos (assets/js/tarefas-acoes.js): concluir só o que está aberto (sem sobrescrever a conclusão
// de outra pessoa), com a linha no histórico e a regra das dependências; desfazer volta à situação de antes, só de quem
// concluiu e sem a faturável; criar a tarefa avulsa do formulário e desfazer; marcar boleto pago e desfazer; em lotes de 100;
// alterar prazo, responsável e prioridade; e o que o cartão do vigia resolve ali mesmo (o responsável que falta, a proposta
// parada, o boleto enviado ou pago), com o desfazer.
// Sem rede: o cliente do Supabase é um dublê em memória.
// Rodar com: node tests/tarefas-acoes.test.mjs
import { concluirTarefas, desfazerConclusao, criarTarefasAvulsas, excluirTarefasCriadas, marcarPagos, desfazerPagos, avisarDependentes,
  alterarTarefas, desfazerAlteracao, limparMudanca, descreverMudanca, fichaDeOrigem, proximasNascemCom,
  pessoaDaEquipe, definirResponsavelObrigacoes, desfazerResponsavelObrigacoes, definirResponsavelRotina, desfazerResponsavelRotina,
  descartarProposta, desfazerDescarte, avancarBoletos, voltarBoletos, fecharFicha, reabrirFicha, vincularEmpresa, desvincularEmpresa, buscarEmpresas,
  renovarAlvara, desfazerRenovacao, desativarRegistro, reativarRegistro } from '../assets/js/tarefas-acoes.js';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + extra : '')); };

// o dublê: tabelas em memória, filtros in/eq/neq, update/delete/insert com .select() no fim; "antes" roda antes de cada
// update (pra simular outra pessoa mexendo no meio); "falhar" faz a próxima consulta da tabela voltar com erro
function dubla(tabelas) {
  const log = [];
  let seq = 1;
  const sb = { log, antes: null, falhar: null, from(t) {
    const rows = tabelas[t] || (tabelas[t] = []);
    const st = { f: [], patch: null, del: false, ins: null };
    const passa = r => st.f.every(([k, c, v]) => (k === 'in' ? v.map(String).includes(String(r[c])) : k === 'eq' ? r[c] === v : k === 'is' ? r[c] == v : r[c] !== v));
    const exec = () => {
      log.push({ t, op: st.ins ? 'insert' : st.patch ? 'update' : st.del ? 'delete' : 'select', f: st.f.map(x => x.slice()), n: st.f.find(x => x[0] === 'in') ? st.f.find(x => x[0] === 'in')[2].length : null });
      if (sb.falhar === t) { sb.falhar = null; return { data: null, error: { message: 'falhou de propósito' } }; }
      if (st.ins) { rows.push(...st.ins); return { data: st.ins.map(r => ({ ...r })), error: null }; }
      if (st.patch && sb.antes) sb.antes(t, rows);
      const alvo = rows.filter(passa);
      if (st.patch) alvo.forEach(r => Object.assign(r, st.patch));
      if (st.del) alvo.forEach(r => rows.splice(rows.indexOf(r), 1));
      return { data: alvo.map(r => ({ ...r })), error: null };
    };
    const q = {
      select() { return q; }, or(s) { sb.ultimoOr = s; return q; }, limit() { return q; },
      in(c, v) { st.f.push(['in', c, v]); return q; }, eq(c, v) { st.f.push(['eq', c, v]); return q; }, neq(c, v) { st.f.push(['neq', c, v]); return q; }, is(c, v) { st.f.push(['is', c, v]); return q; },
      update(p) { st.patch = p; return q; }, delete() { st.del = true; return q; },
      insert(p) { st.ins = (Array.isArray(p) ? p : [p]).map(r => ({ id: 'novo' + (seq++), ...r })); return q; },
      then(res, rej) { return Promise.resolve(exec()).then(res, rej); }
    };
    return q;
  } };
  return sb;
}
const T = (id, extra = {}) => ({ id, titulo: 'Tarefa ' + id, cliente_id: 'c1', status: 'pendente', faturavel: false, concluida_em: null, concluida_por: null, ...extra });
const EU = 'fiscal@macedoereis.com.br';

console.log('Concluir:');
{
  const db = { tarefas: [T('a'), T('b', { status: 'em_andamento' }), T('c', { status: 'concluida', concluida_por: 'outra@macedoereis.com.br' }), T('f', { faturavel: true })], tarefa_historico: [] };
  const sb = dubla(db);
  const r = await concluirTarefas(sb, ['a', 'b', 'c', 'x', 'f', 'a'], { autor: EU, historico: 'Concluída pelo assistente.' });
  chk('conclui só as abertas, com a situação de antes; as outras (já concluída, inexistente) vêm à parte, sem repetir', r.concluidas.map(c => c.id + ':' + c.status_antes).join() === 'a:pendente,b:em_andamento,f:pendente'
    && r.jaEstavam.join() === 'c,x' && !r.erro, JSON.stringify(r));
  chk('status, quem e quando gravados; a concluída por outra pessoa fica como estava', db.tarefas.filter(t => ['a', 'b', 'f'].includes(t.id)).every(t => t.status === 'concluida' && t.concluida_por === EU && t.concluida_em)
    && db.tarefas.find(t => t.id === 'c').concluida_por === 'outra@macedoereis.com.br');
  chk('a linha no histórico de cada uma, com quem concluiu', db.tarefa_historico.length === 3 && db.tarefa_historico.every(h => h.descricao === 'Concluída pelo assistente.' && h.autor === EU));
  chk('a faturável é marcada (o desfazer não mexe nela)', r.concluidas.find(c => c.id === 'f').faturavel === true);
  chk('o update vai com a trava "só quem não está concluída"', sb.log.some(l => l.op === 'update' && l.f.some(f => f[0] === 'neq' && f[1] === 'status' && f[2] === 'concluida')));
}
{
  // outra pessoa conclui "a" entre a leitura e o clique: não é sobrescrita
  const db = { tarefas: [T('a'), T('b')], tarefa_historico: [] };
  const sb = dubla(db);
  sb.antes = (t, rows) => { if (t === 'tarefas') { const a = rows.find(x => x.id === 'a'); if (a.status !== 'concluida') Object.assign(a, { status: 'concluida', concluida_por: 'outra@macedoereis.com.br' }); } };
  const r = await concluirTarefas(sb, ['a', 'b'], { autor: EU });
  chk('concluída por outra pessoa no meio do caminho: fica com ela e vem em "jaEstavam"', r.concluidas.map(c => c.id).join() === 'b' && r.jaEstavam.join() === 'a'
    && db.tarefas.find(t => t.id === 'a').concluida_por === 'outra@macedoereis.com.br' && db.tarefa_historico.length === 1);
}
{
  const db = { tarefas: Array.from({ length: 250 }, (_, i) => T('t' + i)), tarefa_historico: [] };
  const sb = dubla(db);
  const r = await concluirTarefas(sb, db.tarefas.map(t => t.id), { autor: EU });
  const updates = sb.log.filter(l => l.t === 'tarefas' && l.op === 'update').map(l => l.n);
  chk('250 de uma vez: em lotes de 100 (o filtro vai no endereço)', r.concluidas.length === 250 && updates.join() === '100,100,50', updates.join());
}
{
  const db = { tarefas: [T('a')], tarefa_historico: [] };
  const sb = dubla(db); sb.falhar = 'tarefas';
  const r = await concluirTarefas(sb, ['a'], { autor: EU });
  chk('erro do banco: devolve o erro e não conclui nada', r.erro === 'falhou de propósito' && !r.concluidas.length && db.tarefas[0].status === 'pendente');
  const sb2 = dubla(db); sb2.falhar = 'tarefa_historico';
  const r2 = await concluirTarefas(sb2, ['a'], { autor: EU });
  chk('histórico que falha: a conclusão vale e vem o aviso', r2.concluidas.length === 1 && r2.semHistorico === true && db.tarefas[0].status === 'concluida');
}
{
  // a regra das dependências (a mesma das telas de tarefas): a escrituração irmã fica sabendo
  const db = { tarefas: [T('p', { titulo: 'Precificar honorários do novo porte', cliente_id: 'c9' }), T('e', { titulo: 'Transformação registrada — escrituração aguarda a precificação', cliente_id: 'c9' })], tarefa_historico: [] };
  const sb = dubla(db);
  await concluirTarefas(sb, ['p'], { autor: EU });
  const irma = db.tarefas.find(t => t.id === 'e');
  chk('dependentes: concluir a precificação libera a escrituração irmã (título e histórico)', /^Iniciar escrituração contábil do novo enquadramento \(honorário fechado em \d\d\/\d\d\)$/.test(irma.titulo)
    && db.tarefa_historico.some(h => h.tarefa_id === 'e' && h.autor === 'sistema'), irma.titulo);
  const db2 = { tarefas: [T('q', { titulo: 'Outra coisa' }), T('e2', { titulo: 'Transformação registrada — escrituração aguarda' })], tarefa_historico: [] };
  await avisarDependentes(dubla(db2), db2.tarefas[0]);
  chk('dependentes: tarefa de outro título não mexe em nada', db2.tarefas[1].titulo === 'Transformação registrada — escrituração aguarda' && !db2.tarefa_historico.length);
}

console.log('Desfazer:');
{
  const db = { tarefas: [T('a'), T('b', { status: 'aguardando' }), T('c'), T('f', { faturavel: true })], tarefa_historico: [] };
  const sb = dubla(db);
  const r = await concluirTarefas(sb, ['a', 'b', 'c', 'f'], { autor: EU });
  // "c" foi reaberta e concluída de novo por outra pessoa depois: não é desfeita
  Object.assign(db.tarefas.find(t => t.id === 'c'), { concluida_por: 'outra@macedoereis.com.br' });
  const d = await desfazerConclusao(sb, r.concluidas, { autor: EU, historico: 'Conclusão desfeita no assistente.' });
  const st = id => db.tarefas.find(t => t.id === id);
  chk('volta à situação de antes (pendente, aguardando), sem quem e quando', st('a').status === 'pendente' && st('b').status === 'aguardando' && st('a').concluida_por === null && st('a').concluida_em === null, JSON.stringify(d));
  chk('a concluída por outra pessoa e a faturável ficam concluídas', st('c').status === 'concluida' && st('f').status === 'concluida' && d.ficaram.sort().join() === 'c,f' && d.desfeitas.sort().join() === 'a,b');
  chk('a linha no histórico das desfeitas', db.tarefa_historico.filter(h => h.descricao === 'Conclusão desfeita no assistente.').map(h => h.tarefa_id).sort().join() === 'a,b');
}

console.log('Criar:');
{
  const db = { tarefas: [], tarefa_historico: [] };
  const sb = dubla(db);
  const r = await criarTarefasAvulsas(sb, { setor: 'dp', titulo: 'Ligar pra empresa', responsavel: 'Vitória', prazo: '2026-10-15', prioridade: 'alta', clientes: ['c1', 'c2', 'c1'], autor: EU });
  chk('uma por cliente (sem repetir), avulsa e pendente, com os campos do formulário', r.ids.length === 2 && db.tarefas.every(t => t.origem === 'avulsa' && t.status === 'pendente' && t.tipo === 'tarefa' && t.setor === 'dp'
    && t.responsavel === 'Vitória' && t.prazo === '2026-10-15' && t.prioridade === 'alta' && t.faturavel === false) && db.tarefas.map(t => t.cliente_id).join() === 'c1,c2', JSON.stringify(db.tarefas));
  chk('o histórico diz o lote', db.tarefa_historico.length === 2 && db.tarefa_historico.every(h => h.descricao === 'Tarefa cadastrada. (lote de 2 clientes)' && h.autor === EU));
  const r2 = await criarTarefasAvulsas(sb, { titulo: 'Interna', autor: EU });
  chk('sem cliente: uma interna, setor geral, prioridade média', r2.ids.length === 1 && db.tarefas.at(-1).cliente_id === null && db.tarefas.at(-1).setor === 'geral' && db.tarefas.at(-1).prioridade === 'media');
  db.tarefas.find(t => t.id === r.ids[1]).status = 'em_andamento';
  const x = await excluirTarefasCriadas(sb, r.ids);
  chk('desfazer a criação: só a que continua pendente', x.excluidas.join() === r.ids[0] && db.tarefas.some(t => t.id === r.ids[1]) && !db.tarefas.some(t => t.id === r.ids[0]));
}

console.log('Boletos:');
{
  const B = (id, status) => ({ id, status, cliente_id: 'c1', competencia: '2026-09', valor: 100 });
  const db = { cobrancas_mensais: [B('b1', 'enviado'), B('b2', 'emitido'), B('b3', 'pago'), B('b4', 'cancelado'), B('b5', 'a_emitir')] };
  const sb = dubla(db);
  const r = await marcarPagos(sb, ['b1', 'b2', 'b3', 'b4', 'b5', 'b9']);
  chk('marca pago só quem está em aberto, com a situação de antes', r.pagos.map(p => p.id + ':' + p.status_antes).join() === 'b1:enviado,b2:emitido,b5:a_emitir' && r.jaEstavam.join() === 'b3,b4,b9'
    && db.cobrancas_mensais.filter(b => b.status === 'pago').length === 4 && db.cobrancas_mensais.find(b => b.id === 'b4').status === 'cancelado', JSON.stringify(r));
  db.cobrancas_mensais.find(b => b.id === 'b2').status = 'cancelado';   // alguém cancelou no meio: fica cancelado
  const d = await desfazerPagos(sb, r.pagos);
  const st = id => db.cobrancas_mensais.find(b => b.id === id).status;
  chk('desfazer volta à situação de antes, só de quem continua pago', d.desfeitos.sort().join() === 'b1,b5' && st('b1') === 'enviado' && st('b5') === 'a_emitir' && st('b2') === 'cancelado' && st('b3') === 'pago');
}

console.log('Alterar prazo, responsável e prioridade:');
{
  const db = { tarefas: [T('a', { prazo: '2026-10-15', responsavel: 'Thalia', prioridade: 'media' }), T('b', { status: 'em_andamento', prazo: '2026-10-10', responsavel: 'THALIA', prioridade: 'baixa' }),
    T('c', { status: 'concluida', prazo: '2026-10-01' }), T('d', { prazo: '2026-10-12', admissao_id: 'adm1' }), T('e', { prazo: '2026-10-16' }), T('g', { prazo: null, responsavel: null })], tarefa_historico: [] };
  const sb = dubla(db);
  const r = await alterarTarefas(sb, ['a', 'b', 'c', 'd', 'e', 'x', 'g', 'a'], { prazo: '2026-10-16' }, { autor: EU, origem: 'assistente do escritório' });
  const st = id => db.tarefas.find(t => t.id === id);
  chk('remarca só as abertas e fora da ficha de origem; as outras vêm à parte (já assim, concluída/inexistente, da admissão), sem repetir',
    r.alteradas.map(a => a.id).join() === 'a,b,g' && r.iguais.join() === 'e' && r.fechadas.join() === 'c,x' && r.daFicha.map(f => f.id + ':' + f.nome + ':' + f.tela).join() === 'd:admissão:Admissões' && !r.erro, JSON.stringify(r));
  chk('o prazo novo gravado; a concluída e a da admissão ficam como estavam', ['a', 'b', 'g'].every(id => st(id).prazo === '2026-10-16') && st('c').prazo === '2026-10-01' && st('d').prazo === '2026-10-12');
  chk('o antes e o depois de cada uma (pra desfazer), só do que mudou', JSON.stringify(r.alteradas.find(a => a.id === 'b')) === JSON.stringify({ id: 'b', titulo: 'Tarefa b', antes: { prazo: '2026-10-10' }, depois: { prazo: '2026-10-16' } })
    && r.alteradas.find(a => a.id === 'g').antes.prazo === null);
  const linhas = db.tarefa_historico.map(h => h.tarefa_id + ': ' + h.descricao);
  chk('a linha no histórico, com o antes, o depois e por onde', linhas.join(' | ') === 'a: Prazo alterado de 15/10/2026 para 16/10/2026 — pelo assistente do escritório. | b: Prazo alterado de 10/10/2026 para 16/10/2026 — pelo assistente do escritório. | g: Prazo definido: 16/10/2026 — pelo assistente do escritório.'
    && db.tarefa_historico.every(h => h.autor === EU), linhas.join(' | '));
  chk('o update vai com a trava "só quem não está concluída", num lote só', sb.log.filter(l => l.t === 'tarefas' && l.op === 'update').length === 1 && sb.log.some(l => l.op === 'update' && l.f.some(f => f[0] === 'neq' && f[1] === 'status' && f[2] === 'concluida')));

  // passar pra Vitória e deixar urgente: o responsável sem diferença de maiúscula ou acento
  const db2 = { tarefas: [T('h', { responsavel: 'VITÓRIA', prioridade: 'media' }), T('i', { responsavel: 'Adaini', prioridade: 'alta' }), T('j', { responsavel: 'Vitoria', prioridade: 'alta' })], tarefa_historico: [] };
  const r2 = await alterarTarefas(dubla(db2), ['h', 'i', 'j'], { responsavel: 'Vitória', prioridade: 'alta' }, { autor: EU, origem: 'assistente do escritório' });
  chk('responsável e prioridade: "VITÓRIA" e "Vitoria" já são a Vitória; só o que muda entra no depois', r2.alteradas.map(a => a.id + ':' + Object.keys(a.depois).join('+')).join() === 'h:prioridade,i:responsavel' && r2.iguais.join() === 'j', JSON.stringify(r2));
  chk('o histórico: "prioridade alterada de média para alta", "responsável alterado de Adaini para Vitória"', db2.tarefa_historico.map(h => h.descricao).join(' | ')
    === 'Prioridade alterada de média para alta — pelo assistente do escritório. | Responsável alterado de Adaini para Vitória — pelo assistente do escritório.', db2.tarefa_historico.map(h => h.descricao).join(' | '));
  chk('com os dois campos mudando, a linha junta os dois', descreverMudanca({ prazo: '2026-10-15', responsavel: 'Thalia' }, { prazo: '2026-10-16', responsavel: 'Vitória' }) === 'Prazo alterado de 15/10/2026 para 16/10/2026; responsável alterado de Thalia para Vitória');

  chk('mudança que não vale: data inexistente, prioridade fora da lista, nada → erro, sem tocar no banco', (await alterarTarefas(dubla({ tarefas: [T('k')] }), ['k'], { prazo: '2026-02-30', prioridade: 'urgente' })).erro === 'Nada a mudar: diga o prazo, o responsável ou a prioridade.'
    && limparMudanca({ prazo: '2026-10-16', responsavel: ' Vitória ', prioridade: 'alta', outro: 1 }) && JSON.stringify(limparMudanca({ prazo: '2026-10-16', responsavel: ' Vitória ', prioridade: 'alta', outro: 1 })) === '{"prazo":"2026-10-16","responsavel":"Vitória","prioridade":"alta"}'
    && limparMudanca({}) === null && limparMudanca(null) === null);
  chk('a tarefa da ficha de origem: admissão, rescisão, alvará', fichaDeOrigem({ rescisao_id: 'r' }).tela === 'Rescisões' && fichaDeOrigem({ alvara_id: 'v' }).nome === 'alvará' && fichaDeOrigem({ obrigacao_id: 'o' }) === null);
  // a ficha refaz o prazo e o responsável, não a prioridade
  const db3 = { tarefas: [T('m', { admissao_id: 'adm', prioridade: 'media', prazo: '2026-10-10' })], tarefa_historico: [] };
  const r3 = await alterarTarefas(dubla(db3), ['m'], { prioridade: 'alta' }, { autor: EU });
  chk('só a prioridade: vale também na tarefa da admissão', r3.alteradas.map(a => a.id).join() === 'm' && db3.tarefas[0].prioridade === 'alta' && !r3.daFicha.length, JSON.stringify(r3));
  const r4 = await alterarTarefas(dubla(db3), ['m'], { prioridade: 'baixa', prazo: '2026-10-20' }, { autor: EU });
  chk('com o prazo junto, a da admissão fica de fora inteira', !r4.alteradas.length && r4.daFicha.length === 1 && db3.tarefas[0].prazo === '2026-10-10' && db3.tarefas[0].prioridade === 'alta');
  const lista = [{ obrigacao_id: 'o1', origem: 'recorrente' }, { origem: 'recorrente' }, { origem: 'avulsa' }, { obrigacao_id: 'o2' }];
  chk('responsável novo: quantas nascem de obrigação fiscal e de tarefa recorrente (a próxima vem com o de lá); sem trocar o responsável, nenhuma',
    JSON.stringify(proximasNascemCom(lista, { responsavel: 'Thalia' })) === '{"obrigacao":2,"recorrente":1}' && JSON.stringify(proximasNascemCom(lista, { prazo: '2026-10-20' })) === '{"obrigacao":0,"recorrente":0}');
}
{
  // concluída por outra pessoa entre a leitura e o clique: não muda e vem em "fechadas"
  const db = { tarefas: [T('a', { prazo: '2026-10-15' }), T('b', { prazo: '2026-10-15' })], tarefa_historico: [] };
  const sb = dubla(db);
  sb.antes = (t, rows) => { if (t === 'tarefas') { const a = rows.find(x => x.id === 'a'); if (a.status !== 'concluida') a.status = 'concluida'; } };
  const r = await alterarTarefas(sb, ['a', 'b'], { prazo: '2026-10-20' }, { autor: EU });
  chk('concluída no meio do caminho: fica como estava e vem em "fechadas"', r.alteradas.map(a => a.id).join() === 'b' && r.fechadas.join() === 'a' && db.tarefas.find(t => t.id === 'a').prazo === '2026-10-15' && db.tarefa_historico.length === 1);
}
{
  const db = { tarefas: Array.from({ length: 250 }, (_, i) => T('t' + i, { prazo: '2026-10-01' })), tarefa_historico: [] };
  const sb = dubla(db);
  const r = await alterarTarefas(sb, db.tarefas.map(t => t.id), { prazo: '2026-10-20' }, { autor: EU });
  const updates = sb.log.filter(l => l.t === 'tarefas' && l.op === 'update').map(l => l.n);
  chk('250 de uma vez: em lotes de 100', r.alteradas.length === 250 && updates.join() === '100,100,50', updates.join());
  const d = await desfazerAlteracao(sb, r.alteradas, { autor: EU });
  chk('desfazer as 250 (o mesmo antes): também em lotes', d.desfeitas.length === 250 && db.tarefas.every(t => t.prazo === '2026-10-01'));
}
{
  const db = { tarefas: [T('a', { prazo: '2026-10-15', responsavel: 'Thalia' }), T('b', { prazo: '2026-10-10', responsavel: 'Thalia' }), T('c', { prazo: '2026-10-11', responsavel: 'Thalia' }), T('d', { prazo: null, responsavel: 'Thalia' })], tarefa_historico: [] };
  const sb = dubla(db);
  const r = await alterarTarefas(sb, ['a', 'b', 'c', 'd'], { prazo: '2026-10-16', responsavel: 'Vitória' }, { autor: EU, origem: 'assistente do escritório' });
  const st = id => db.tarefas.find(t => t.id === id);
  // depois: "b" foi remarcada de novo por outra pessoa e "c" foi concluída — ficam como estão
  st('b').prazo = '2026-10-30'; st('c').status = 'concluida';
  const d = await desfazerAlteracao(sb, r.alteradas, { autor: EU, origem: 'assistente do escritório' });
  chk('desfazer: volta ao que era (prazo e responsável; "sem prazo" volta sem prazo); a mexida depois e a concluída ficam', d.desfeitas.sort().join() === 'a,d' && d.ficaram.sort().join() === 'b,c'
    && st('a').prazo === '2026-10-15' && st('a').responsavel === 'Thalia' && st('d').prazo === null && st('d').responsavel === 'Thalia' && st('b').prazo === '2026-10-30' && st('b').responsavel === 'Vitória' && st('c').prazo === '2026-10-16', JSON.stringify(d));
  const desfeitas = db.tarefa_historico.filter(h => /desfeita/.test(h.descricao)).map(h => h.tarefa_id + ': ' + h.descricao);
  chk('a linha no histórico das desfeitas', desfeitas.join(' | ') === 'a: Prazo alterado de 16/10/2026 para 15/10/2026; responsável alterado de Vitória para Thalia — alteração desfeita no assistente do escritório. | d: Prazo retirado (era 16/10/2026); responsável alterado de Vitória para Thalia — alteração desfeita no assistente do escritório.', desfeitas.join(' | '));
}

console.log('Resolver no cartão do vigia:');
chk('quem é da equipe pelo nome gravado (como o vigia do banco)', pessoaDaEquipe('VITÓRIA') === 'Vitória' && pessoaDaEquipe(' samuel ') === 'Samuel' && pessoaDaEquipe('ambos') === 'Ambos'
  && pessoaDaEquipe('Fulano') === null && pessoaDaEquipe('') === null && pessoaDaEquipe(null) === null);
{
  const db = { cliente_obrigacoes: [
      { id: 'v1', cliente_id: 'c1', obrigacao_id: 'o1', responsavel: null, ativo: true }, { id: 'v2', cliente_id: 'c1', obrigacao_id: 'o2', responsavel: 'Fulano', ativo: true },
      { id: 'v3', cliente_id: 'c1', obrigacao_id: 'o3', responsavel: 'THALIA', ativo: true }, { id: 'v4', cliente_id: 'c1', obrigacao_id: 'o4', responsavel: null, ativo: false },
      { id: 'v5', cliente_id: 'c2', obrigacao_id: 'o1', responsavel: null, ativo: true }],
    tarefas: [T('t1', { obrigacao_id: 'o1', responsavel: null }), T('t2', { obrigacao_id: 'o1', responsavel: 'Adaini' }), T('t3', { obrigacao_id: 'o2', responsavel: 'Fulano' }),
      T('t4', { obrigacao_id: 'o1', responsavel: null, status: 'concluida' }), T('t5', { cliente_id: 'c2', obrigacao_id: 'o1', responsavel: null }), T('t6', { obrigacao_id: 'o3', responsavel: null })],
    tarefa_historico: [] };
  const sb = dubla(db);
  const v = id => db.cliente_obrigacoes.find(x => x.id === id).responsavel, t = id => db.tarefas.find(x => x.id === id).responsavel;
  const r = await definirResponsavelObrigacoes(sb, 'c1', 'thalia', { autor: EU, origem: 'assistente do escritório (vigia)' });
  chk('obrigação: os vínculos ativos da empresa sem ninguém da equipe (vazio ou nome de fora) ganham o responsável; o que já tinha, o inativo e o de outra empresa ficam',
    v('v1') === 'Thalia' && v('v2') === 'Thalia' && v('v3') === 'THALIA' && v('v4') === null && v('v5') === null && r.vinculos.map(x => x.id + ':' + x.antes).sort().join() === 'v1:null,v2:Fulano', JSON.stringify(r));
  chk('obrigação: as tarefas abertas desses vínculos que estavam com o de antes vão junto (como na tela); a repassada à mão, a concluída e as de outros vínculos ficam',
    t('t1') === 'Thalia' && t('t3') === 'Thalia' && t('t2') === 'Adaini' && t('t4') === null && t('t5') === null && t('t6') === null && r.tarefas.map(x => x.id).sort().join() === 't1,t3');
  chk('obrigação: a linha no histórico das tarefas que mudaram', db.tarefa_historico.map(h => h.tarefa_id + ': ' + h.descricao).sort().join(' | ')
    === 't1: Responsável definido pela obrigação: Thalia — pelo assistente do escritório (vigia). | t3: Responsável definido pela obrigação: Thalia — pelo assistente do escritório (vigia).');
  db.tarefas.find(x => x.id === 't3').responsavel = 'Vitória';   // depois, alguém passou a t3 pra Vitória: fica com ela
  const d = await desfazerResponsavelObrigacoes(sb, r, 'Thalia', { autor: EU, origem: 'assistente do escritório (vigia)' });
  chk('desfazer: vínculos e tarefas voltam ao de antes (vazio, "Fulano"); a mexida depois fica', v('v1') === null && v('v2') === 'Fulano' && t('t1') === null && t('t3') === 'Vitória'
    && d.vinculos === 2 && d.tarefas.join() === 't1', JSON.stringify(d));
  chk('obrigação sem alguém da equipe escolhido: não grava', (await definirResponsavelObrigacoes(sb, 'c1', 'Fulano')).erro === 'Escolha alguém da equipe.' && v('v1') === null);
}
{
  const db = { rotinas: [{ id: 'r1', responsavel: null }, { id: 'r2', responsavel: 'samuel' }, { id: 'r3', responsavel: 'Contábil' }] };
  const sb = dubla(db);
  const a = await definirResponsavelRotina(sb, 'r1', 'Vitória'), b = await definirResponsavelRotina(sb, 'r2', 'Vitória'), c = await definirResponsavelRotina(sb, 'r3', 'Adaini');
  chk('rotina: sem ninguém (ou com nome de fora) ganha o responsável; a que já tem fica', db.rotinas[0].responsavel === 'Vitória' && a.rotina.antes === null && b.jaTinha === 'Samuel' && !b.rotina
    && db.rotinas[1].responsavel === 'samuel' && db.rotinas[2].responsavel === 'Adaini' && c.rotina.antes === 'Contábil');
  const d = await desfazerResponsavelRotina(sb, a.rotina, 'Vitória'), e = await desfazerResponsavelRotina(sb, c.rotina, 'Adaini');
  chk('rotina: desfazer volta ao de antes', d.desfeita && e.desfeita && db.rotinas[0].responsavel === null && db.rotinas[2].responsavel === 'Contábil');
}
{
  const db = { precificacoes: [{ id: 'p1', status: 'apresentada', atualizado_em: '2026-09-01T10:00:00Z' }, { id: 'p2', status: 'fechada', atualizado_em: '2026-09-02T10:00:00Z' }] };
  const sb = dubla(db);
  const a = await descartarProposta(sb, 'p1'), b = await descartarProposta(sb, 'p2');
  chk('proposta: descartar a parada (situação e "atualizado em", como o seletor da tela); a fechada fica', db.precificacoes[0].status === 'descartada' && db.precificacoes[0].atualizado_em !== '2026-09-01T10:00:00Z'
    && a.proposta.status_antes === 'apresentada' && b.ja === 'fechada' && db.precificacoes[1].status === 'fechada');
  const d = await desfazerDescarte(sb, a.proposta);
  chk('proposta: desfazer volta a situação e a data de antes (pro vigia, parada desde a mesma data)', d.desfeita && db.precificacoes[0].status === 'apresentada' && db.precificacoes[0].atualizado_em === '2026-09-01T10:00:00Z');
}
{
  // a proposta "recebida" (do formulário público): o banco conclui a tarefa dela quando sai de "recebida"; o desfazer reabre
  const db = { precificacoes: [{ id: 'p3', status: 'recebida', atualizado_em: '2026-09-05T10:00:00Z' }],
    tarefas: [T('tp', { proposta_id: 'p3', origem: 'proposta_externa' }), T('tq', { proposta_id: 'p3', origem: 'manual' }),
      T('tr', { proposta_id: 'p3', origem: 'proposta_externa', status: 'concluida', concluida_por: EU })] };
  const sb = dubla(db);
  // o gatilho do banco (fn_proposta_externa_concluir), no dublê
  sb.antes = t => { if (t === 'precificacoes') db.tarefas.filter(x => x.proposta_id === 'p3' && x.origem === 'proposta_externa' && x.status === 'pendente')
    .forEach(x => Object.assign(x, { status: 'concluida', concluida_em: 'agora', concluida_por: 'sistema (proposta em andamento)' })); };
  const tk = id => db.tarefas.find(x => x.id === id);
  const a = await descartarProposta(sb, 'p3');
  chk('proposta recebida: guarda a tarefa dela, que o banco conclui', a.proposta && a.proposta.tarefas.join() === 'tp' && tk('tp').status === 'concluida', JSON.stringify(a));
  sb.antes = null;
  const d = await desfazerDescarte(sb, a.proposta);
  chk('proposta recebida: desfazer volta a "recebida" e reabre a tarefa dela; a concluída por alguém e a de outra origem ficam', d.desfeita && d.tarefas.join() === 'tp'
    && db.precificacoes[0].status === 'recebida' && tk('tp').status === 'pendente' && tk('tp').concluida_por === null && tk('tr').status === 'concluida' && tk('tq').status === 'pendente', JSON.stringify(d));
}
{
  const B = (id, status) => ({ id, status, cliente_id: 'c1', competencia: '2026-09', valor: 100 });
  const db = { cobrancas_mensais: [B('b1', 'a_emitir'), B('b2', 'emitido'), B('b3', 'enviado'), B('b4', 'pago'), B('b5', 'cancelado')] };
  const sb = dubla(db);
  const r = await avancarBoletos(sb, ['b1', 'b2', 'b3', 'b4', 'b5', 'bx'], 'enviado');
  const st = id => db.cobrancas_mensais.find(b => b.id === id).status;
  chk('boleto: pra frente (a emitir e emitido viram enviado); o enviado, o pago, o cancelado e o que não existe ficam', r.mudados.map(m => m.id + ':' + m.status_antes).sort().join() === 'b1:a_emitir,b2:emitido'
    && r.jaEstavam.sort().join() === 'b3,b4,b5,bx' && st('b1') === 'enviado' && st('b2') === 'enviado' && st('b5') === 'cancelado', JSON.stringify(r));
  db.cobrancas_mensais.find(b => b.id === 'b2').status = 'pago';   // alguém marcou pago no meio: fica pago
  const v = await voltarBoletos(sb, r.mudados, 'enviado');
  chk('boleto: desfazer volta à situação de antes, só de quem continua na nova', v.desfeitos.map(x => x.id + ':' + x.status).join() === 'b1:a_emitir' && st('b1') === 'a_emitir' && st('b2') === 'pago');
  chk('boleto: voltar pra "a emitir" não é avançar', (await avancarBoletos(sb, ['b1'], 'a_emitir')).erro === 'Situação inválida.' && st('b1') === 'a_emitir');
}

console.log('Resolver no cartão do vigia, a segunda leva:');
{
  const db = { admissoes: [{ id: 'a1', status: 'em_registro', cliente_id: null, registrada_em: null, registrada_por: null }, { id: 'a2', status: 'registrada', cliente_id: 'c9' }],
    rescisoes: [{ id: 'r1', status: 'recebida', cliente_id: null, concluida_em: null, concluida_por: null }] };
  const sb = dubla(db);
  const ad = id => db.admissoes.find(x => x.id === id), rs = id => db.rescisoes.find(x => x.id === id);
  const a = await fecharFicha(sb, 'admissoes', 'a1', { autor: EU }), b = await fecharFicha(sb, 'admissoes', 'a2', { autor: EU }), r = await fecharFicha(sb, 'rescisoes', 'r1', { autor: EU });
  chk('ficha: a admissão aberta vira registrada e a rescisão, concluída, com quando e quem (como o seletor das telas); a já registrada fica',
    ad('a1').status === 'registrada' && ad('a1').registrada_por === EU && ad('a1').registrada_em && a.ficha.status_antes === 'em_registro' && b.ja === 'registrada'
    && rs('r1').status === 'concluida' && rs('r1').concluida_por === EU && r.ficha.status_antes === 'recebida', JSON.stringify([a, b, r]));
  const da = await reabrirFicha(sb, a.ficha), dr = await reabrirFicha(sb, r.ficha);
  chk('ficha: desfazer volta à situação de antes, sem o quando e o quem', da.desfeita && dr.desfeita && ad('a1').status === 'em_registro' && ad('a1').registrada_em === null
    && ad('a1').registrada_por === null && rs('r1').status === 'recebida' && rs('r1').concluida_por === null);
  chk('ficha: tabela de fora não grava', (await fecharFicha(sb, 'tarefas', 'a1')).erro === 'Ficha inválida.');
  const v = await vincularEmpresa(sb, 'admissoes', 'a1', 'c1'), w = await vincularEmpresa(sb, 'admissoes', 'a2', 'c1');
  chk('vínculo: a ficha sem empresa ganha a escolhida; a que já tinha empresa fica', ad('a1').cliente_id === 'c1' && v.ficha.cliente_id === 'c1' && w.ja === 'c9' && ad('a2').cliente_id === 'c9');
  ad('a1').cliente_id = 'c1';
  const dv = await desvincularEmpresa(sb, v.ficha);
  chk('vínculo: desfazer tira a empresa, só se continua a mesma', dv.desfeita && ad('a1').cliente_id === null);
}
{
  const db = { clientes: [{ id: 'c1', nome_principal: 'PADARIA TESTE LTDA' }] };
  const sb = dubla(db);
  const r = await buscarEmpresas(sb, ' Padaria (Teste), "Ltda" ');
  chk('busca de empresa: como a das fichas, sem o que quebraria o filtro (vírgula, parênteses, aspas)',
    sb.ultimoOr === 'nome_principal.ilike.*Padaria Teste Ltda*,nome_fantasia.ilike.*Padaria Teste Ltda*,nome_busca.ilike.*padariatesteltda*,documento.ilike.*padariatesteltda*'
    && r.empresas.length === 1, sb.ultimoOr);
  chk('busca de empresa: com menos de 3 letras, nem consulta', (await buscarEmpresas(sb, 'pa')).empresas.length === 0 && !sb.log.some(l => l.t === 'clientes' && l.op === 'select' && sb.log.indexOf(l) > 0));
}
{
  const db = { alvaras: [{ id: 'al1', status: 'vigente', vencimento: '2026-10-10' }, { id: 'al2', status: 'a_confirmar', vencimento: null }], alvara_historico: [] };
  const sb = dubla(db);
  const al = id => db.alvaras.find(x => x.id === id);
  const HOJE = '2026-10-16', ORIG = { autor: EU, origem: 'assistente do escritório (vigia)', hoje: HOJE };
  chk('alvará: a data nova vem depois de hoje e do vencimento de agora', (await renovarAlvara(sb, 'al1', '2026-10-16', ORIG)).erro === 'A nova data de vencimento precisa ser depois de hoje.'
    && (await renovarAlvara(sb, 'al1', '16/10/2027', ORIG)).erro === 'Informe a nova data de vencimento.' && al('al1').vencimento === '2026-10-10');
  const r = await renovarAlvara(sb, 'al1', '2027-10-10', ORIG), s = await renovarAlvara(sb, 'al2', '2027-03-01', ORIG);
  chk('alvará: renovado — vigente, com o vencimento novo e a linha na linha do tempo (como o "Renovar" da tela)', al('al1').status === 'vigente' && al('al1').vencimento === '2027-10-10'
    && r.alvara.vencimento_antes === '2026-10-10' && al('al2').status === 'vigente' && s.alvara.status_antes === 'a_confirmar'
    && db.alvara_historico[0].descricao === 'Renovado: vencimento 10/10/2026 → 10/10/2027 — pelo assistente do escritório (vigia).' && db.alvara_historico[0].autor === EU
    && db.alvara_historico[1].descricao === 'Renovado: vencimento — → 01/03/2027 — pelo assistente do escritório (vigia).', JSON.stringify(db.alvara_historico));
  const d = await desfazerRenovacao(sb, r.alvara, ORIG), e = await desfazerRenovacao(sb, s.alvara, ORIG);
  chk('alvará: desfazer volta o vencimento e a situação de antes, com a linha', d.desfeita && e.desfeita && al('al1').vencimento === '2026-10-10' && al('al1').status === 'vigente'
    && al('al2').vencimento === null && al('al2').status === 'a_confirmar' && db.alvara_historico[2].descricao === 'Renovação desfeita: vencimento 10/10/2027 → 10/10/2026 — no assistente do escritório (vigia).');
  chk('alvará: a data nova antes do vencimento de agora não grava', (await renovarAlvara(sb, 'al1', '2026-10-05', { ...ORIG, hoje: '2026-10-01' })).erro === 'A nova data precisa ser depois do vencimento de agora (10/10/2026).'
    && al('al1').vencimento === '2026-10-10');
}
{
  const db = { cobrancas_config: [{ id: 'cc1', ativo: true }, { id: 'cc2', ativo: false }], cliente_obrigacoes: [{ id: 'co1', ativo: true }] };
  const sb = dubla(db);
  const a = await desativarRegistro(sb, 'cobrancas_config', 'cc1'), b = await desativarRegistro(sb, 'cobrancas_config', 'cc2'), c = await desativarRegistro(sb, 'cliente_obrigacoes', 'co1');
  chk('ex-cliente: a cobrança e a obrigação ativas desativam; a que já estava parada fica', db.cobrancas_config[0].ativo === false && a.desativado.id === 'cc1' && !b.desativado
    && db.cliente_obrigacoes[0].ativo === false && c.desativado.tabela === 'cliente_obrigacoes');
  const d = await reativarRegistro(sb, a.desativado), e = await reativarRegistro(sb, c.desativado);
  chk('ex-cliente: desfazer reativa', d.desfeita && e.desfeita && db.cobrancas_config[0].ativo === true && db.cliente_obrigacoes[0].ativo === true);
  chk('ex-cliente: outra tabela não', (await desativarRegistro(sb, 'clientes', 'c1')).erro === 'Registro inválido.');
}

if (falhas) { console.log('\n' + falhas + ' falha(s)'); process.exit(1); }
console.log('\nTudo certo.');
