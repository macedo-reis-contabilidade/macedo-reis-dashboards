// Ações nas tarefas e nos boletos (assets/js/tarefas-acoes.js): concluir só o que está aberto (sem sobrescrever a conclusão
// de outra pessoa), com a linha no histórico e a regra das dependências; desfazer volta à situação de antes, só de quem
// concluiu e sem a faturável; criar a tarefa avulsa do formulário e desfazer; marcar boleto pago e desfazer; em lotes de 100.
// Sem rede: o cliente do Supabase é um dublê em memória.
// Rodar com: node tests/tarefas-acoes.test.mjs
import { concluirTarefas, desfazerConclusao, criarTarefasAvulsas, excluirTarefasCriadas, marcarPagos, desfazerPagos, avisarDependentes } from '../assets/js/tarefas-acoes.js';

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
    const passa = r => st.f.every(([k, c, v]) => (k === 'in' ? v.map(String).includes(String(r[c])) : k === 'eq' ? r[c] === v : r[c] !== v));
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
      in(c, v) { st.f.push(['in', c, v]); return q; }, eq(c, v) { st.f.push(['eq', c, v]); return q; }, neq(c, v) { st.f.push(['neq', c, v]); return q; },
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

if (falhas) { console.log('\n' + falhas + ' falha(s)'); process.exit(1); }
console.log('\nTudo certo.');
