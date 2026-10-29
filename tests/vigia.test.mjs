// O vigia do sistema, do lado da tela (assets/js/vigia.js): de quem é cada achado (os sócios levam "Ambos", o da Edna e o
// sem dono), de qual tela (na ficha da empresa, o que é dela), o recorte (pessoa, todos, setor, tela, empresa, situação),
// os grupos do cartão (o urgente e o prazo mais perto primeiro), os novos desde a última olhada, o link que vira endereço
// (só página do sistema), o nome de cada regra (as da função do assistente, todas com nome), o resolvido agora pelo cartão
// (fora da lista até a conferência seguinte) e a leitura e o "ignorar" com um banco falso. Rodar com: node tests/vigia.test.mjs
import { ROTULOS, rotuloDaRegra, eDaPessoa, ehSocioPeloNome, caminhoDoLink, eDaTela, filtrarAchados, agruparAchados, novosDesde, linkSeguro,
  lerAchados, ignorarAchado, reabrirAchado, lerVisto, marcarVisto, resolvidosAgora, marcarResolvidoAgora, desmarcarResolvidoAgora, semResolvidosAgora } from '../assets/js/vigia.js';
import { TABELAS } from '../supabase/functions/assistente/ferramentas.js';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + extra : '')); };

const E1 = '9a1b2c3d-0000-4000-8000-0000000000e1';
const A = (id, regra, responsavel, gravidade, link, extra = {}) => ({ id, regra, titulo: regra + ' ' + id, responsavel, gravidade, link, setor: 'fiscal', situacao: 'aberto', cliente_id: null, prazo: null, ...extra });
const LISTA = [
  A('a1', 'admissao_nao_registrada', 'Vitória', 'alta', 'dp-admissoes.html?admissao=x1', { setor: 'dp', cliente_id: E1, prazo: '2026-10-03' }),
  A('a2', 'admissao_nao_registrada', 'VITORIA', 'alta', 'dp-admissoes.html?admissao=x2', { setor: 'dp', prazo: '2026-10-01' }),
  A('a3', 'admissao_sem_vinculo', 'Vitória', 'media', 'dp-admissoes.html?admissao=x3', { setor: 'dp' }),
  A('a4', 'reforma_prazo', 'Ambos', 'media', 'fiscal-reforma.html'),
  A('a5', 'tarefa_responsavel', null, 'baixa', 'agenda.html', { setor: 'geral' }),
  A('a6', 'cliente_sem_obrigacao', 'Thalia', 'media', 'fiscal-obrigacoes.html', { cliente_id: E1 }),
  A('a7', 'tarefa_responsavel', 'Edna', 'baixa', 'agenda.html', { setor: 'gestao' }),
  A('a8', 'boleto_parado', 'Samuel', 'alta', 'financeiro-boletos.html', { setor: 'financeiro', situacao: 'ignorado' }),
  A('a9', 'regra_nova_sem_nome', 'Thalia', 'media', 'fiscal-tarefas.html')];
const ids = l => l.map(a => a.id).join(',');

console.log('De quem é:');
chk('o responsável, sem maiúscula e sem acento', eDaPessoa(LISTA[1], { nome: 'Vitória' }) && !eDaPessoa(LISTA[1], { nome: 'Thalia' }));
chk('os sócios levam "Ambos", o da Edna e o sem dono; quem não é sócio, não', eDaPessoa(LISTA[3], { nome: 'Samuel', socio: true }) && eDaPessoa(LISTA[4], { nome: 'Samuel', socio: true })
  && eDaPessoa(LISTA[6], { nome: 'Diego', socio: true }) && !eDaPessoa(LISTA[3], { nome: 'Thalia', socio: false }) && !eDaPessoa(LISTA[4], { nome: 'Thalia' }));
chk('sócio pelo nome: Samuel e Diego', ehSocioPeloNome('samuel') && ehSocioPeloNome('DIEGO') && !ehSocioPeloNome('Thalia'));

console.log('De qual tela:');
chk('o caminho do link, sem a busca', caminhoDoLink('dp-admissoes.html?admissao=x1') === 'dp-admissoes.html' && caminhoDoLink('/agenda.html') === 'agenda.html' && caminhoDoLink(null) === '');
chk('o caminho do link, sem o # (os Relatórios Vivos abrem o mês)', caminhoDoLink('relatorios-vivos.html#caixa/2026-10-01') === 'relatorios-vivos.html'
  && eDaTela({ link: 'relatorios-vivos.html#dre/2026-10-01' }, 'relatorios-vivos.html'));
chk('a tela onde se resolve', eDaTela(LISTA[0], 'dp-admissoes.html') && !eDaTela(LISTA[0], 'agenda.html'));
chk('na ficha da empresa, o que é dela (qualquer tela)', eDaTela(LISTA[0], 'clientes/editar.html', '?id=' + E1) && eDaTela(LISTA[5], 'clientes/editar.html', '?id=' + E1)
  && !eDaTela(LISTA[1], 'clientes/editar.html', '?id=' + E1) && !eDaTela(LISTA[0], 'clientes/editar.html', ''));

console.log('O recorte:');
chk('os abertos de uma pessoa (o ignorado fica fora)', ids(filtrarAchados(LISTA, { nome: 'Vitória' })) === 'a1,a2,a3');
chk('os do sócio: os dele, "Ambos", Edna e sem dono', ids(filtrarAchados(LISTA, { nome: 'Samuel', socio: true })) === 'a4,a5,a7');
chk('de todos, num setor', ids(filtrarAchados(LISTA, { todos: true, setor: 'dp' })) === 'a1,a2,a3');
chk('de uma tela e de uma empresa', ids(filtrarAchados(LISTA, { todos: true, tela: 'agenda.html' })) === 'a5,a7' && ids(filtrarAchados(LISTA, { todos: true, clienteId: E1 })) === 'a1,a6');
chk('os ignorados, e qualquer situação', ids(filtrarAchados(LISTA, { todos: true, situacao: 'ignorado' })) === 'a8' && filtrarAchados(LISTA, { todos: true, situacao: null }).length === 9);
chk('lista que não é lista: vazio, sem erro', filtrarAchados(null, { todos: true }).length === 0 && agruparAchados(undefined).length === 0);

console.log('Os grupos do cartão:');
const g = agruparAchados(filtrarAchados(LISTA, { todos: true }));
chk('o grupo com urgente primeiro, depois pela gravidade (o de baixa no fim, mesmo maior); o sem nome cai em "Outros achados"', g[0].regra === 'admissao_nao_registrada' && g[0].urgentes === 2
  && g.at(-1).regra === 'tarefa_responsavel' && g.at(-1).itens.length === 2 && g.find(x => x.regra === 'regra_nova_sem_nome').rotulo === 'Outros achados', g.map(x => x.regra).join());
chk('dentro do grupo: o urgente e o prazo mais perto primeiro', ids(g[0].itens) === 'a2,a1');

console.log('Os novos, o link e os nomes:');
const comVisto = [{ primeiro_visto: '2026-10-15T12:00:00Z' }, { primeiro_visto: '2026-10-15T09:00:00Z' }, { primeiro_visto: null }];
chk('novos: os achados depois da última olhada; sem olhada, nenhum', novosDesde(comVisto, '2026-10-15T10:00:00Z') === 1 && novosDesde(comVisto, null) === 0);
chk('o link vira endereço só se for página do sistema', linkSeguro('dp-admissoes.html?admissao=7a00-1') === 'dp-admissoes.html?admissao=7a00-1' && linkSeguro('clientes/editar.html?id=' + E1)
  && !linkSeguro('javascript:alert(1)') && !linkSeguro('https://exemplo.com/a.html') && !linkSeguro('//exemplo.com/a.html') && !linkSeguro('../fora.html') && !linkSeguro('a.html?x=<b>') && !linkSeguro(null));
chk('o # do link só com o caminho do relatório (letras, números, / e -)', linkSeguro('relatorios-vivos.html#caixa/2026-10-01') === 'relatorios-vivos.html#caixa/2026-10-01'
  && !linkSeguro('relatorios-vivos.html#<img>') && !linkSeguro('relatorios-vivos.html#javascript:alert(1)') && !linkSeguro('relatorios-vivos.html#a b') && !linkSeguro('a.html#x#y'));
const regrasDaFuncao = TABELAS.vigia_achados.notas.regra.split('|').map(s => s.trim());
chk('toda regra que a função do assistente conhece tem nome no cartão (e vice-versa)', regrasDaFuncao.every(r => ROTULOS[r]) && Object.keys(ROTULOS).every(r => regrasDaFuncao.includes(r)),
  regrasDaFuncao.filter(r => !ROTULOS[r]).join() + ' / ' + Object.keys(ROTULOS).filter(r => !regrasDaFuncao.includes(r)).join());
chk('nome da regra', rotuloDaRegra('boleto_parado') === 'Boletos parados' && rotuloDaRegra('xyz') === 'Outros achados');
chk('a última olhada fora do navegador: sem erro, sem valor', (marcarVisto('a@b'), lerVisto('a@b')) === null);

console.log('O resolvido agora pelo cartão (até a conferência seguinte):');
chk('fora do navegador: sem erro, nada fica de fora', (marcarResolvidoAgora('a@b', 'a1'), resolvidosAgora('a@b').size) === 0 && semResolvidosAgora(LISTA, 'a@b').length === LISTA.length);
{
  const guardado = new Map();
  globalThis.localStorage = { getItem: k => (guardado.has(k) ? guardado.get(k) : null), setItem: (k, v) => guardado.set(k, String(v)), removeItem: k => guardado.delete(k) };
  const t0 = Date.parse('2026-10-16T10:00:00Z'), EU = 'fiscal@macedoereis.com.br';
  marcarResolvidoAgora('Fiscal@MacedoeReis.com.br', 'a1', t0);
  marcarResolvidoAgora(EU, 'a3', t0 + 60e3);
  chk('o resolvido sai da lista, por e-mail (sem maiúscula); pra outra pessoa, não', ids(semResolvidosAgora(LISTA, EU, t0 + 120e3)) === 'a2,a4,a5,a6,a7,a8,a9'
    && semResolvidosAgora(LISTA, 'rh@macedoereis.com.br', t0).length === LISTA.length);
  chk('vale 75 minutos (a conferência é de hora em hora): depois, volta', resolvidosAgora(EU, t0 + 74 * 60e3).has('a1') && !resolvidosAgora(EU, t0 + 75 * 60e3).has('a1')
    && resolvidosAgora(EU, t0 + 75 * 60e3).has('a3'));
  desmarcarResolvidoAgora(EU, 'a3', t0 + 120e3);
  chk('o desfazer põe de volta', !resolvidosAgora(EU, t0 + 120e3).has('a3') && resolvidosAgora(EU, t0 + 120e3).has('a1'));
  guardado.set('mr_vigia_resolvidos:' + EU, '{quebrado');
  chk('guardado fora do formato: começa do zero, sem erro', resolvidosAgora(EU, t0).size === 0);
  delete globalThis.localStorage;
}

console.log('Leitura e "ignorar" (banco falso):');
{
  const linhas = LISTA.map(a => ({ ...a }));
  const log = [];
  const sb = { from(t) {
    const q = { t, f: [], patch: null };
    const ch = {
      select(c) { q.sel = c; return ch; }, in(c, v) { q.f.push(['in', c, v]); return ch; }, eq(c, v) { q.f.push(['eq', c, v]); return ch; },
      order() { return ch; }, limit() { return ch; }, update(p) { q.patch = p; return ch; },
      then(res, rej) {
        log.push(q);
        let d = linhas.filter(r => q.f.every(([k, c, v]) => (k === 'in' ? v.includes(r[c]) : r[c] === v)));
        if (q.patch) d.forEach(r => Object.assign(r, q.patch));
        return Promise.resolve({ data: d.map(r => ({ ...r })), error: null }).then(res, rej);
      } };
    return ch;
  } };
  const abertas = await lerAchados(sb, { ignorados: false });
  chk('lê só a tabela do vigia, as abertas (e, pedindo, as ignoradas)', log[0].t === 'vigia_achados' && abertas.length === 8 && (await lerAchados(sb)).length === 9);
  chk('ignorar: só troca a situação, e só de quem está aberto', await ignorarAchado(sb, 'a4') && linhas[3].situacao === 'ignorado' && JSON.stringify(log.at(-1).patch) === '{"situacao":"ignorado"}'
    && log.at(-1).f.some(([k, c, v]) => c === 'situacao' && v === 'aberto') && !(await ignorarAchado(sb, 'a4')));
  chk('voltar a mostrar: só de quem está ignorado', await reabrirAchado(sb, 'a4') && linhas[3].situacao === 'aberto' && !(await reabrirAchado(sb, 'a4')));
  const erro = { from: () => ({ select() { return this; }, in() { return this; }, order() { return this; }, limit() { return this; }, then: (res) => res({ data: null, error: { message: 'sem acesso' } }) }) };
  let msg = null; try { await lerAchados(erro); } catch (e) { msg = e.message; }
  chk('erro do banco: vira erro com a mensagem (o cartão mostra "Tentar de novo")', msg === 'sem acesso');
}

console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
