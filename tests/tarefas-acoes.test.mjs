// Ações nas tarefas e nos boletos (assets/js/tarefas-acoes.js): concluir só o que está aberto (sem sobrescrever a conclusão
// de outra pessoa), com a linha no histórico e a regra das dependências; desfazer volta à situação de antes, só de quem
// concluiu e sem a faturável; criar a tarefa avulsa do formulário e desfazer; marcar boleto pago e desfazer; em lotes de 100.
// Sem rede: o cliente do Supabase é um dublê em memória.
// Rodar com: node tests/tarefas-acoes.test.mjs
import { concluirTarefas, desfazerConclusao, criarTarefasAvulsas, excluirTarefasCriadas, marcarPagos, desfazerPagos, avisarDependentes,
  alterarTarefas, desfazerAlteracao, limparMudanca, descreverMudanca, fichaDeOrigem, proximasNascemCom } from '../assets/js/tarefas-acoes.js';

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
      select() { return q; }, or() { return q; },
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

if (falhas) { console.log('\n' + falhas + ' falha(s)'); process.exit(1); }
console.log('\nTudo certo.');
