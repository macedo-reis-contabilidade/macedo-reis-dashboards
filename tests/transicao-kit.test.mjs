// O kit da transição (assets/js/transicao-kit.js) e a lista na descrição da tarefa (assets/js/checklist.js), 16/10/2026:
// o DP de uma entrada sem funcionários não ganha as tarefas de funcionários; sem saber, ganha a confirmação; os 13
// documentos do escritório anterior viram uma tarefa só, com a lista; marcando "Sim" depois, o que falta entra sem repetir.
// Na saída, o mesmo com os 13 que vão pro novo escritório (e a confirmação "tem funcionários", que o escritório confere).
// Rodar com: node tests/transicao-kit.test.mjs
import { tarefasDoKit, tarefasQueFaltam, teraFuncionariosDaProposta, diaMais, CONFIRMAR_FUNCIONARIOS, CONFIRMAR_FUNCIONARIOS_SAIDA, SUFIXO_FUNCIONARIOS, rotuloFuncionarios } from '../assets/js/transicao-kit.js';
import { itensDoChecklist, progressoDoChecklist, marcarItem, textoDoChecklist, acrescentarItens, rotuloDoProgresso, ABERTO, FEITO } from '../assets/js/checklist.js';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + extra : '')); };

console.log('A lista na descrição:');
const t0 = 'Peça ao escritório anterior.\n☐ Extrato da folha\n  ☑ Todas as GFIPs\n☐\nObservação solta\n☐ Cópia da RAIS';
const it0 = itensDoChecklist(t0);
chk('os itens: ☐ a fazer, ☑ feito; linha só com a marca e o texto solto ficam de fora', it0.map(i => (i.feito ? 'x' : 'o') + i.texto + '@' + i.linha).join('|') === 'oExtrato da folha@1|xTodas as GFIPs@2|oCópia da RAIS@5', JSON.stringify(it0));
chk('o progresso', JSON.stringify(progressoDoChecklist(t0)) === '{"feitos":1,"total":3}' && progressoDoChecklist('sem lista') === null && progressoDoChecklist(null) === null);
const t1 = marcarItem(t0, 5, true);
chk('marcar troca só a marca da linha (o resto do texto fica)', t1 === t0.replace('☐ Cópia da RAIS', '☑ Cópia da RAIS'), t1);
chk('desmarcar mantém o recuo', marcarItem(t0, 2, false).split('\n')[2] === '  ☐ Todas as GFIPs');
chk('linha que não é item não muda', marcarItem(t0, 0, true) === t0 && marcarItem(t0, 99, true) === t0);
chk('a lista nova: cabeçalho e um ☐ por item, os feitos com ☑', textoDoChecklist(['A', 'B'], { feitos: ['b'] }) === 'Marque cada item quando estiver resolvido.\n' + ABERTO + ' A\n' + FEITO + ' B');
chk('acrescentar no fim, sem repetir (acento e maiúscula não contam)', acrescentarItens('X\n☐ Relatório de férias', ['RELATORIO DE FERIAS', 'Ficha dos empregados', 'Ficha dos empregados']) === 'X\n☐ Relatório de férias\n☐ Ficha dos empregados');
chk('acrescentar numa descrição vazia', acrescentarItens('', ['A']) === '☐ A' && acrescentarItens(null, []) === '');
chk('o chip do cartão', rotuloDoProgresso(t0) === '☑ 1/3' && rotuloDoProgresso('nada') === '');

console.log('Terá funcionários, pela proposta:');
chk('entrada: ativos ou a registrar → sim; zero ativos → não; sem resposta → não se sabe',
  teraFuncionariosDaProposta({ C1: '5' }) === true && teraFuncionariosDaProposta({ C1: '0', C2: '2' }) === true && teraFuncionariosDaProposta({ C1: '0' }) === false
  && teraFuncionariosDaProposta({ C1: '' }) === null && teraFuncionariosDaProposta({}) === null && teraFuncionariosDaProposta(null) === null && teraFuncionariosDaProposta({ C1: 'muitos' }) === null);
chk('CNPJ novo: só os a registrar valem', teraFuncionariosDaProposta({ C1: '0' }, 'cnpj_novo') === null && teraFuncionariosDaProposta({ C2: '1' }, 'cnpj_novo') === true && teraFuncionariosDaProposta({ C2: '0' }, 'cnpj_novo') === false);
chk('a conta dos dias no calendário', diaMais('2026-10-30', 5) === '2026-11-04' && diaMais('2026-12-31', 1) === '2027-01-01' && diaMais('2026-10-16', 0) === '2026-10-16');

// o kit de entrada do DP como está no banco (os títulos; prazos em dias), com as marcas novas
const DOC = 'Documentos e acessos do escritório anterior', F = 'Documentos e escritório anterior', C = 'Cadastros e sistemas';
const K = (ordem, titulo, prazo_dias, fase, func = false, grupo = null, setor = 'dp') => ({ ordem, setor, titulo, prazo_dias, fase, so_com_funcionarios: func, agrupar_em: grupo, responsavel_padrao: setor === 'dp' ? 'Vitória' : 'Thalia', ativo: true, tipo: 'entrada' });
const KIT = [
  K(1, 'Cadastro no Domínio', 5, C), K(2, 'Cadastro no FGTS Digital', 7, C, true), K(3, 'Vínculo das rotinas de DP no sistema', 5, C),
  K(4, 'Extrato mensal da folha desde a abertura até o mês de fechamento', 12, F, false, DOC), K(5, 'Login e senha do seguro-desemprego (Empregador Web)', 10, F, true, DOC),
  K(6, 'Ficha dos empregados com quadro de horários', 12, F, true, DOC), K(7, 'Relatório de férias com detalhamento', 12, F, true, DOC),
  K(8, 'Relatório de validados do eSocial', 12, F, false, DOC), K(9, 'Relatório de contribuintes', 12, F, false, DOC),
  K(10, 'FGTS em aberto/ativo ou pago de somente um funcionário — verificar', 12, F, true, DOC), K(11, 'Todas as GFIPs', 15, F, false, DOC),
  K(12, 'Cópia da DIRF entregue', 15, F, false, DOC), K(13, 'Cópia da RAIS', 15, F, false, DOC),
  K(14, 'Vínculo da empresa com clínica (medicina do trabalho) — verificar', 12, F, true, DOC), K(15, 'Informes de rendimentos', 15, F, false, DOC),
  K(16, 'Informações complementares que facilitem a transição', 15, F, false, DOC),
  K(20, 'Configuração no Domínio', 10, C, false, null, 'fiscal'),
  { ...K(99, 'Item desativado', 1, C), ativo: false }
];
const op = { inicio: '2026-10-16', transicaoId: 'tr1', clienteId: 'c1' };

console.log('O kit de quem tem funcionários:');
const com = tarefasDoKit(KIT, { ...op, teraFuncionarios: true });
chk('as tarefas: as soltas, a lista dos documentos no lugar do primeiro item e as de outros setores; o desativado fica fora',
  com.map(t => t.titulo).join('|') === ['Cadastro no Domínio', 'Cadastro no FGTS Digital', 'Vínculo das rotinas de DP no sistema', DOC, 'Configuração no Domínio'].join('|'), com.map(t => t.titulo).join('|'));
const lista = com.find(t => t.titulo === DOC);
chk('a lista com os 13 documentos, na ordem do kit', itensDoChecklist(lista.descricao).length === 13 && itensDoChecklist(lista.descricao)[0].texto.startsWith('Extrato mensal') && itensDoChecklist(lista.descricao)[12].texto === 'Informações complementares que facilitem a transição');
chk('a lista no maior prazo do grupo, com o dono, a fase e o vínculo do kit', lista.prazo === '2026-10-31' && lista.responsavel === 'Vitória' && lista.fase === F && lista.setor === 'dp'
  && lista.transicao_id === 'tr1' && lista.cliente_id === 'c1' && lista.status === 'pendente' && lista.origem === 'transicao' && lista.tipo === 'tarefa');
chk('a solta no prazo dela', com[1].prazo === '2026-10-23' && com[1].descricao === null);
chk('sem confirmação quando já se sabe', !com.some(t => t.titulo === CONFIRMAR_FUNCIONARIOS));

console.log('O kit de quem não tem:');
const sem = tarefasDoKit(KIT, { ...op, teraFuncionarios: false });
const listaSem = sem.find(t => t.titulo === DOC);
chk('sem o FGTS Digital nem a confirmação', !sem.some(t => t.titulo === 'Cadastro no FGTS Digital') && !sem.some(t => t.titulo === CONFIRMAR_FUNCIONARIOS) && sem.length === 4);
chk('a lista só com os 8 documentos que não dependem de funcionário', itensDoChecklist(listaSem.descricao).map(i => i.texto).join('|') === [
  'Extrato mensal da folha desde a abertura até o mês de fechamento', 'Relatório de validados do eSocial', 'Relatório de contribuintes', 'Todas as GFIPs',
  'Cópia da DIRF entregue', 'Cópia da RAIS', 'Informes de rendimentos', 'Informações complementares que facilitem a transição'].join('|'), listaSem.descricao);

console.log('Sem saber:');
const nsei = tarefasDoKit(KIT, { ...op, teraFuncionarios: null });
const conf = nsei.filter(t => t.titulo === CONFIRMAR_FUNCIONARIOS);
chk('o kit de quem não tem, mais uma confirmação pro DP (o dono dos itens), em 5 dias', nsei.length === 5 && conf.length === 1 && conf[0].setor === 'dp' && conf[0].responsavel === 'Vitória' && conf[0].prazo === '2026-10-21');
chk('a confirmação diz onde marcar e o que entra', /Editar › "Terá funcionários"/.test(conf[0].descricao) && /Cadastro no FGTS Digital/.test(conf[0].descricao) && /Relatório de férias/.test(conf[0].descricao));
chk('kit sem item de funcionário não ganha confirmação', tarefasDoKit(KIT.filter(k => !k.so_com_funcionarios), { ...op, teraFuncionarios: null }).every(t => t.titulo !== CONFIRMAR_FUNCIONARIOS));

console.log('Marcou "Sim" depois:');
const existentes = nsei.map((t, i) => ({ ...t, id: 'x' + i }));
const f1 = tarefasQueFaltam(KIT, existentes, { teraFuncionarios: true, inicio: '2026-10-16', hoje: '2026-11-02', transicaoId: 'tr1', clienteId: 'c1' });
chk('entra o FGTS Digital, a contar de hoje', f1.novas.length === 1 && f1.novas[0].titulo === 'Cadastro no FGTS Digital' && f1.novas[0].prazo === '2026-11-09', JSON.stringify(f1.novas));
const listaX = existentes.find(t => t.titulo === DOC);
chk('a lista aberta ganha os 5 documentos de funcionários no fim', f1.atualizar.length === 1 && f1.atualizar[0].id === listaX.id && itensDoChecklist(f1.atualizar[0].descricao).length === 13
  && itensDoChecklist(f1.atualizar[0].descricao).slice(8).map(i => i.texto).join('|') === 'Login e senha do seguro-desemprego (Empregador Web)|Ficha dos empregados com quadro de horários|Relatório de férias com detalhamento|FGTS em aberto/ativo ou pago de somente um funcionário — verificar|Vínculo da empresa com clínica (medicina do trabalho) — verificar');
chk('a confirmação se conclui', f1.concluir.length === 1 && f1.concluir[0] === existentes.find(t => t.titulo === CONFIRMAR_FUNCIONARIOS).id);
const fechadas = existentes.map(t => t.titulo === DOC ? { ...t, status: 'concluida' } : t);
const f2 = tarefasQueFaltam(KIT, fechadas, { teraFuncionarios: true, inicio: '2026-10-16', hoje: '2026-10-20' });
const extra = f2.novas.find(t => t.titulo === DOC + SUFIXO_FUNCIONARIOS);
chk('com a lista já concluída, nasce outra só com os de funcionários', !!extra && itensDoChecklist(extra.descricao).length === 5 && f2.atualizar.length === 0 && extra.prazo === '2026-11-01');
const f3 = tarefasQueFaltam(KIT, [...fechadas, { id: 'y', setor: 'dp', titulo: DOC + SUFIXO_FUNCIONARIOS, status: 'pendente' }, { id: 'z', setor: 'dp', titulo: 'CADASTRO NO FGTS DIGITAL', status: 'concluida' }], { teraFuncionarios: true, inicio: '2026-10-16', hoje: '2026-10-20' });
chk('nada repete: a lista extra e a tarefa que já existem (maiúscula não conta) ficam', f3.novas.length === 0 && f3.atualizar.length === 0, JSON.stringify(f3));
const f4 = tarefasQueFaltam(KIT, existentes, { teraFuncionarios: false, inicio: '2026-10-16', hoje: '2026-10-20' });
chk('marcou "Não": só conclui a confirmação', f4.novas.length === 0 && f4.atualizar.length === 0 && f4.concluir.length === 1);
const comLista = tarefasQueFaltam(KIT, com.map((t, i) => ({ ...t, id: 'w' + i })), { teraFuncionarios: true, inicio: '2026-10-16', hoje: '2026-10-16' });
chk('quem já nasceu com funcionários não ganha nada', comLista.novas.length === 0 && comLista.atualizar.length === 0 && comLista.concluir.length === 0);

// a saída do DP como está no banco (16/10/2026): os 13 que vão pro novo escritório numa lista, 5 só com funcionários
console.log('A saída:');
const NOVO = 'Documentos e acessos pro novo escritório';
const S = (ordem, titulo, func = false) => ({ ordem, setor: 'dp', titulo, prazo_dias: ordem === 41 ? 5 : 10, fase: F, so_com_funcionarios: func, agrupar_em: NOVO,
  responsavel_padrao: 'Vitória', ativo: true, tipo: 'saida' });
const KIT_SAIDA = [
  S(40, 'Extrato mensal da folha desde a abertura até o mês atual — enviar'), S(41, 'Login e senha do Empregador Web — enviar', true),
  S(42, 'Ficha dos empregados com quadro de horários — enviar', true), S(43, 'Relatório de férias com detalhamento — enviar', true),
  S(44, 'Relatório de dependentes com detalhamento — enviar'), S(45, 'Relatório de validados do eSocial — enviar'), S(46, 'Relatório de contribuintes — enviar'),
  S(47, 'FGTS em aberto/ativo ou pago de um funcionário — informar', true), S(48, 'Todas as GFIPs — enviar'), S(49, 'Cópia da DIRF entregue — enviar'),
  S(50, 'Cópia da RAIS — enviar'), S(51, 'Vínculo com clínica (medicina do trabalho) — informar', true),
  S(52, 'Informações complementares que facilitem a transição — enviar'),
  { ...S(10, 'Encerrar o acesso ao sistema do cliente'), setor: 'fiscal', agrupar_em: null, responsavel_padrao: 'Thalia' }
];
const sCom = tarefasDoKit(KIT_SAIDA, { ...op, teraFuncionarios: true });
const sLista = sCom.find(t => t.titulo === NOVO);
chk('com funcionários: o DP ganha uma tarefa só, com os 13 na ordem do kit, no maior prazo (10 dias); o fiscal fica como está',
  sCom.map(t => t.titulo).join('|') === 'Encerrar o acesso ao sistema do cliente|' + NOVO && itensDoChecklist(sLista.descricao).length === 13
  && itensDoChecklist(sLista.descricao)[1].texto === 'Login e senha do Empregador Web — enviar' && sLista.prazo === '2026-10-26' && sLista.responsavel === 'Vitória' && sLista.fase === F,
  sCom.map(t => t.titulo + ' ' + t.prazo).join('|'));
const sSem = tarefasDoKit(KIT_SAIDA, { ...op, teraFuncionarios: false });
chk('sem funcionários: a lista com os 8 que não dependem de funcionário (o relatório de dependentes fica: o sócio também tem dependente no IR)',
  itensDoChecklist(sSem.find(t => t.titulo === NOVO).descricao).map(i => i.texto).join('|') === ['Extrato mensal da folha desde a abertura até o mês atual — enviar',
    'Relatório de dependentes com detalhamento — enviar', 'Relatório de validados do eSocial — enviar', 'Relatório de contribuintes — enviar', 'Todas as GFIPs — enviar',
    'Cópia da DIRF entregue — enviar', 'Cópia da RAIS — enviar', 'Informações complementares que facilitem a transição — enviar'].join('|') && sSem.length === 2);
const sNsei = tarefasDoKit(KIT_SAIDA, { ...op, teraFuncionarios: null });
const sConf = sNsei.filter(t => t.titulo === CONFIRMAR_FUNCIONARIOS_SAIDA);
chk('sem saber: a lista dos 8 e "Confirmar se a empresa tem funcionários" pro DP, em 5 dias (sem o "terá" da entrada)',
  sNsei.length === 3 && sConf.length === 1 && sConf[0].responsavel === 'Vitória' && sConf[0].prazo === '2026-10-21' && !sNsei.some(t => t.titulo === CONFIRMAR_FUNCIONARIOS));
chk('a confirmação da saída manda conferir na folha e marcar no "Tem funcionários"', /^Confira na folha/.test(sConf[0].descricao) && /Editar › "Tem funcionários"/.test(sConf[0].descricao)
  && /Login e senha do Empregador Web/.test(sConf[0].descricao) && !/Pergunte à empresa/.test(sConf[0].descricao), sConf[0].descricao);
const sExist = sNsei.map((t, i) => ({ ...t, id: 's' + i }));
const sF1 = tarefasQueFaltam(KIT_SAIDA, sExist, { teraFuncionarios: true, inicio: '2026-10-16', hoje: '2026-10-19' });
chk('marcou "Sim": a lista ganha os 5 de funcionários no fim, nenhuma tarefa nova, e a confirmação da saída se conclui',
  sF1.novas.length === 0 && sF1.atualizar.length === 1 && itensDoChecklist(sF1.atualizar[0].descricao).slice(8).map(i => i.texto).join('|') === ['Login e senha do Empregador Web — enviar',
    'Ficha dos empregados com quadro de horários — enviar', 'Relatório de férias com detalhamento — enviar', 'FGTS em aberto/ativo ou pago de um funcionário — informar',
    'Vínculo com clínica (medicina do trabalho) — informar'].join('|') && sF1.concluir.length === 1 && sF1.concluir[0] === sExist.find(t => t.titulo === CONFIRMAR_FUNCIONARIOS_SAIDA).id,
  JSON.stringify(sF1));
const sF2 = tarefasQueFaltam(KIT_SAIDA, sExist, { teraFuncionarios: false, inicio: '2026-10-16', hoje: '2026-10-19' });
chk('marcou "Não": só conclui a confirmação da saída', sF2.novas.length === 0 && sF2.atualizar.length === 0 && sF2.concluir.length === 1);
chk('o nome do campo: "Tem funcionários?" na saída, "Terá funcionários?" na entrada e no CNPJ novo',
  rotuloFuncionarios('saida') === 'Tem funcionários?' && rotuloFuncionarios('entrada') === 'Terá funcionários?' && rotuloFuncionarios('cnpj_novo') === 'Terá funcionários?');

console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
