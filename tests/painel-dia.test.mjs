// O dia de quem entrou, pra abertura do Painel central (assets/js/painel-dia.js, 13/11/2026): a data por extenso do jeito
// da casa, a saudação pela hora, de quem é a tarefa ("Ambos" com os sócios), o dia em números (as mesmas contas da coluna
// "Seu dia" da Agenda), a frase do dia, o texto do anel e a leitura do banco (o filtro pelo nome, o erro que vira null).
// Rodar com: node tests/painel-dia.test.mjs
import { comMaiusculas, dataPorExtenso, saudacaoDaHora, daPessoa, contarDia, fraseDoDia, textoDoAnel, lerDia } from '../assets/js/painel-dia.js';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); };
const D = s => new Date(s + 'T12:00:00');
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log('A data por extenso:');
chk('o dia da semana e o mês com maiúscula, o "de" não', comMaiusculas('sexta-feira, 13 de novembro') === 'Sexta-feira, 13 de Novembro', comMaiusculas('sexta-feira, 13 de novembro'));
chk('o mês e o ano', comMaiusculas('novembro de 2026') === 'Novembro de 2026');
chk('letra acentuada no começo', comMaiusculas('sábado, 1º de março') === 'Sábado, 1º de Março' && comMaiusculas('terça-feira, 3 de agosto de 2026') === 'Terça-feira, 3 de Agosto de 2026');
chk('o que já está certo fica como está; vazio e nulo não quebram', comMaiusculas('Sexta-feira, 13 de Novembro') === 'Sexta-feira, 13 de Novembro' && comMaiusculas('') === '' && comMaiusculas(null) === '');
chk('dataPorExtenso de 13/11/2026', dataPorExtenso(D('2026-11-13')) === 'Sexta-feira, 13 de Novembro', dataPorExtenso(D('2026-11-13')));
chk('dataPorExtenso de 01/03/2026 (domingo)', dataPorExtenso(D('2026-03-01')) === 'Domingo, 1 de Março', dataPorExtenso(D('2026-03-01')));

console.log('A saudação:');
chk('bom dia até 11h59', saudacaoDaHora(0) === 'Bom dia' && saudacaoDaHora(7) === 'Bom dia' && saudacaoDaHora(11) === 'Bom dia');
chk('boa tarde do meio-dia às 17h59', saudacaoDaHora(12) === 'Boa tarde' && saudacaoDaHora(17) === 'Boa tarde');
chk('boa noite das 18h em diante', saudacaoDaHora(18) === 'Boa noite' && saudacaoDaHora(23) === 'Boa noite');

console.log('De quem é:');
chk('o nome sem maiúscula e sem acento', daPessoa({ responsavel: 'VITORIA ' }, 'Vitória') && daPessoa({ responsavel: 'Vitória' }, 'vitoria'));
chk('"Ambos" é dos dois sócios, e de mais ninguém', daPessoa({ responsavel: 'Ambos' }, 'Samuel') && daPessoa({ responsavel: 'ambos' }, 'Diego') && !daPessoa({ responsavel: 'Ambos' }, 'Thalia'));
chk('de outra pessoa, sem responsável e sem pessoa: não', !daPessoa({ responsavel: 'Adaini' }, 'Samuel') && !daPessoa({ responsavel: null }, 'Samuel') && !daPessoa({ responsavel: '' }, '') && !daPessoa(null, 'Samuel'));

console.log('O dia em números (sexta, 13/11/2026):');
const dia = D('2026-11-13');
const T = (responsavel, prazo, status = 'pendente') => ({ responsavel, prazo, status });
const tarefasHoje = [T('Samuel', '2026-11-13'), T('Samuel', '2026-11-13'), T('Samuel', '2026-11-13', 'concluida'), T('Ambos', '2026-11-13', 'em_andamento'),
  T('Thalia', '2026-11-13'), T('Thalia', '2026-11-13', 'concluida'), T('Samuel', '2026-11-14')];
const atrasadas = [T('Samuel', '2026-11-03'), T('samuel', '2026-11-10', 'em_andamento'), T('Ambos', '2026-11-12'), T('Adaini', '2026-10-20'),
  T('Samuel', '2026-11-01', 'concluida'), T('Samuel', '2026-11-13'), T('Samuel', null)];
const rotinas = [{ responsavel: 'Samuel', periodicidade: 'diaria', ultima_execucao: '2026-11-13' }, { responsavel: 'Samuel', periodicidade: 'diaria', ultima_execucao: '2026-11-12' },
  { responsavel: 'Samuel', periodicidade: 'semanal', dia_semana: 1 },                       // segunda: não é de hoje
  { responsavel: 'Samuel', periodicidade: 'diaria', adiada_para: '2026-11-16' },            // adiada pra segunda: some hoje
  { responsavel: 'Adaini', periodicidade: 'diaria' }];
const s = contarDia({ tarefasHoje, atrasadas, rotinas, pessoa: 'Samuel', dia });
chk('o Samuel: 4 tarefas de hoje (com a de "Ambos") e 2 rotinas = 6, 2 feitas', igual(s, { total: 6, feitas: 2, faltam: 4, pct: 33, rotinas: { total: 2, feitas: 1 }, atrasadas: 3, desde: '2026-11-03' }), s);
const t = contarDia({ tarefasHoje, atrasadas, rotinas, pessoa: 'Thalia', dia });
chk('a Thalia: só as dela, sem as de "Ambos" e sem rotina', igual(t, { total: 2, feitas: 1, faltam: 1, pct: 50, rotinas: { total: 0, feitas: 0 }, atrasadas: 0, desde: null }), t);
const a = contarDia({ tarefasHoje, atrasadas, rotinas, pessoa: 'Adaini', dia });
chk('a Adaini: nenhuma tarefa de hoje, 1 rotina e 1 atrasada', igual(a, { total: 1, feitas: 0, faltam: 1, pct: 0, rotinas: { total: 1, feitas: 0 }, atrasadas: 1, desde: '2026-10-20' }), a);
const fds = contarDia({ tarefasHoje: [T('Samuel', '2026-11-14')], atrasadas, rotinas, pessoa: 'Samuel', dia: D('2026-11-14') });
chk('no sábado não tem rotina (só a tarefa do dia), e a de sexta já é atrasada', fds.total === 1 && fds.rotinas.total === 0 && fds.atrasadas === 4, fds);
chk('a atrasada concluída, a de hoje e a sem prazo não contam como atrasadas', s.atrasadas === 3);
chk('sem nada: tudo zero, sem "desde"', igual(contarDia({ pessoa: 'Diego', dia }), { total: 0, feitas: 0, faltam: 0, pct: 0, rotinas: { total: 0, feitas: 0 }, atrasadas: 0, desde: null }));
chk('sem pessoa, ninguém é dono: tudo zero', contarDia({ tarefasHoje, atrasadas, rotinas, pessoa: null, dia }).total === 0 && contarDia({ tarefasHoje, atrasadas, rotinas, pessoa: '', dia }).atrasadas === 0);
chk('itens nulos na lista não quebram', contarDia({ tarefasHoje: [null, T('Samuel', '2026-11-13')], atrasadas: [null], rotinas: [null], pessoa: 'Samuel', dia }).total === 1);
chk('tudo feito: 100%', contarDia({ tarefasHoje: [T('Samuel', '2026-11-13', 'concluida')], rotinas: [rotinas[0]], pessoa: 'Samuel', dia }).pct === 100);

console.log('A frase do dia:');
const C = (x = {}) => ({ total: 0, feitas: 0, faltam: 0, pct: 0, rotinas: { total: 0, feitas: 0 }, atrasadas: 0, desde: null, ...x });
const hoje = '2026-11-13';
chk('não deu pra ler: a frase de sempre', fraseDoDia(null) === 'Tudo do escritório num lugar só.');
chk('faltam 3', fraseDoDia(C({ total: 5, feitas: 2, faltam: 3 }), { hoje }) === 'Faltam 3 tarefas pra fechar o dia.');
chk('falta 1', fraseDoDia(C({ total: 2, feitas: 1, faltam: 1 }), { hoje }) === 'Falta 1 tarefa pra fechar o dia.');
chk('com 2 atrasadas, a mais antiga com a data', fraseDoDia(C({ total: 5, feitas: 2, faltam: 3, atrasadas: 2, desde: '2026-11-03' }), { hoje })
  === 'Faltam 3 tarefas pra fechar o dia. Tem 2 atrasadas, a mais antiga de 03/11: que tal começar por elas?', fraseDoDia(C({ total: 5, feitas: 2, faltam: 3, atrasadas: 2, desde: '2026-11-03' }), { hoje }));
chk('com 1 atrasada, de ontem', fraseDoDia(C({ total: 1, faltam: 1, atrasadas: 1, desde: '2026-11-12' }), { hoje }) === 'Falta 1 tarefa pra fechar o dia. Tem 1 atrasada, de ontem: que tal começar por ela?',
  fraseDoDia(C({ total: 1, faltam: 1, atrasadas: 1, desde: '2026-11-12' }), { hoje }));
chk('dia zerado, sem atrasada: a comemoração', fraseDoDia(C({ total: 4, feitas: 4 }), { hoje }) === 'Dia zerado. Bora pro café!');
chk('dia zerado, com atrasadas: sem comemorar', fraseDoDia(C({ total: 4, feitas: 4, atrasadas: 3, desde: '2026-10-28' }), { hoje })
  === 'O dia de hoje está zerado. Tem 3 atrasadas, a mais antiga de 28/10: que tal começar por elas?');
chk('nada marcado e nenhuma atrasada', fraseDoDia(C(), { hoje }) === 'Nada marcado pra hoje e nenhuma atrasada. Dia livre pra adiantar a semana.');
chk('nada marcado, com atrasada', fraseDoDia(C({ atrasadas: 1, desde: '2026-11-05' }), { hoje }) === 'Nada marcado pra hoje. Tem 1 atrasada, de 05/11: que tal começar por ela?');
chk('"ontem" atravessa o mês', fraseDoDia(C({ atrasadas: 1, desde: '2026-10-31' }), { hoje: '2026-11-01' }).includes('de ontem'));

console.log('O texto do anel:');
chk('2 de 5, com rotinas', igual(textoDoAnel(C({ total: 5, feitas: 2, faltam: 3, rotinas: { total: 2, feitas: 1 } })), { titulo: '2 de 5 feitas', detalhe: 'rotinas 1 de 2' }));
chk('sem rotina: quanto falta', igual(textoDoAnel(C({ total: 4, feitas: 1, faltam: 3 })), { titulo: '1 de 4 feitas', detalhe: 'faltam 3' }) && textoDoAnel(C({ total: 2, feitas: 1, faltam: 1 })).detalhe === 'falta 1');
chk('uma só: "feita"', textoDoAnel(C({ total: 1, feitas: 0, faltam: 1 })).titulo === '0 de 1 feita');
chk('tudo feito: dia zerado', igual(textoDoAnel(C({ total: 3, feitas: 3, rotinas: { total: 1, feitas: 1 } })), { titulo: '3 de 3 feitas', detalhe: 'Dia zerado!' }));
chk('nada marcado (e sem leitura)', igual(textoDoAnel(C()), { titulo: 'Nada marcado', detalhe: 'pra hoje' }) && igual(textoDoAnel(null), { titulo: 'Nada marcado', detalhe: 'pra hoje' }));

console.log('A leitura do banco:');
// um Supabase de mentira: guarda os filtros de cada consulta e devolve o que o teste mandar
function banco(respostas = {}) {
  const pedidos = [];
  return { pedidos, from(tabela) {
    const p = { tabela, filtros: [] }; pedidos.push(p);
    const q = new Proxy({}, { get(_, k) {
      if (k === 'then') return (res, rej) => Promise.resolve(typeof respostas[tabela] === 'function' ? respostas[tabela](p) : respostas[tabela] || { data: [], error: null }).then(res, rej);
      return (...args) => { p.filtros.push([k, ...args]); return q; };
    } });
    return q;
  } };
}
const filtro = (p, nome) => p.filtros.find(f => f[0] === nome);
{
  const b = banco({ tarefas: p => ({ data: filtro(p, 'eq') ? tarefasHoje : atrasadas, error: null }), rotinas: { data: rotinas, error: null } });
  const r = await lerDia(b, { pessoa: 'Samuel', socio: true, dia });
  chk('devolve a conta do dia', igual(r, s), r);
  const [hojeQ, atrQ, rotQ] = b.pedidos;
  chk('as de hoje: prazo = hoje, de todo mundo (a conta separa)', hojeQ.tabela === 'tarefas' && igual(filtro(hojeQ, 'eq'), ['eq', 'prazo', '2026-11-13']) && !filtro(hojeQ, 'ilike') && !filtro(hojeQ, 'or'));
  chk('as atrasadas: abertas, antes de hoje, do sócio com as de "Ambos"', igual(filtro(atrQ, 'lt'), ['lt', 'prazo', '2026-11-13']) && igual(filtro(atrQ, 'neq'), ['neq', 'status', 'concluida'])
    && igual(filtro(atrQ, 'or'), ['or', 'responsavel.ilike.Samuel,responsavel.ilike.ambos']), atrQ.filtros);
  chk('as rotinas: só as ativas, com as colunas da regra do dia', rotQ.tabela === 'rotinas' && igual(filtro(rotQ, 'eq'), ['eq', 'ativo', true])
    && ['responsavel', 'periodicidade', 'dia_semana', 'dia_mes', 'dia_anual', 'dia_util', 'ultima_execucao', 'adiada_para'].every(c => filtro(rotQ, 'select')[1].includes(c)));
  chk('colunas explícitas, nunca "*"', b.pedidos.every(p => !filtro(p, 'select')[1].includes('*')));
}
{
  const b = banco();
  await lerDia(b, { pessoa: 'Vitória', socio: false, dia });
  chk('quem não é sócio: só o nome, com a letra acentuada como "_" (Vit_ria pega Vitória e Vitoria)', igual(filtro(b.pedidos[1], 'ilike'), ['ilike', 'responsavel', 'Vit_ria']) && !filtro(b.pedidos[1], 'or'), b.pedidos[1].filtros);
}
chk('erro numa leitura: null (a abertura fica sem números)', await lerDia(banco({ rotinas: { data: null, error: { message: 'x' } } }), { pessoa: 'Samuel', dia }) === null
  && await lerDia(banco({ tarefas: { data: null, error: { message: 'x' } } }), { pessoa: 'Samuel', dia }) === null);
chk('a leitura que estoura: null', await lerDia({ from() { throw new Error('fora do ar'); } }, { pessoa: 'Samuel', dia }) === null);
{
  const b = banco();
  chk('sem pessoa: null, sem pedir nada ao banco', await lerDia(b, { pessoa: null, dia }) === null && b.pedidos.length === 0);
}

if (falhas) { console.log('\n' + falhas + ' falha(s)'); process.exit(1); }
console.log('\nTudo certo.');
