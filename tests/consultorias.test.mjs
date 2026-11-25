// As consultorias (assets/js/consultorias.js, 25/11/2026): o horário em texto, o dia da tarefa de montar (a mesma conta do
// banco, consultoria_dia_de_montar), o colar das datas (com o ano que não virou na agenda), o resumo de cada consultoria, a
// montagem de cada sessão e a pauta (os horários, o tempo, a ordem, copiar da sessão anterior, os arquivos). Datas e nomes
// inventados. Rodar com: node tests/consultorias.test.mjs
import { ANTECEDENCIA_PADRAO, nomeDaSituacao, textoHora, faixaDeHorario, horarioDaSessao, dataPorExtenso, avisoDoDia, diaDeMontar,
  lerHorario, lerDatas, PROBLEMAS, ordenarSessoes, resumo, montagem, seloDoCard, minutosDoDia, textoMinutos, duracaoDaSessao,
  ordenarPauta, cronograma, faixaDoCronograma, tempoDaPauta, resumoDaPauta, trocarOrdem, proximaOrdem, sessaoAnteriorComPauta,
  itensParaCopiar, MAX_ARQUIVO, MAX_ANEXOS, nomeSeguro, caminhoDoArquivo, ehImagem, conferirArquivos, tamanhoDoArquivo,
  anexosValidos, tituloDoDocumento } from '../assets/js/consultorias.js';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); };
const HOJE = '2026-11-25';

console.log('O horário:');
chk('9h30, 14h, das 9h30 às 11h30', textoHora('09:30:00') === '9h30' && textoHora('14:00') === '14h' && textoHora(null) === ''
  && faixaDeHorario('09:30:00', '11:30:00') === '9h30 às 11h30' && faixaDeHorario('09:00', null) === 'às 9h' && faixaDeHorario(null, null) === '');
chk('o horário da sessão: o dela, campo a campo, senão o da consultoria',
  horarioDaSessao({ hora_inicio: '10:00' }, { hora_inicio: '09:30', hora_fim: '11:30' }) === '10h às 11h30'
  && horarioDaSessao({}, { hora_inicio: '09:00', hora_fim: '10:30' }) === '9h às 10h30');
chk('a data por extenso', dataPorExtenso('2026-12-07') === 'segunda-feira, 07/12/2026' && dataPorExtenso('lixo') === '');
chk('o dia que pede atenção: feriado e fim de semana', avisoDoDia('2027-02-08') === 'feriado (Carnaval)' && avisoDoDia('2027-02-09') === 'feriado (Carnaval)'
  && avisoDoDia('2026-12-05') === 'sábado' && avisoDoDia('2026-12-06') === 'domingo' && avisoDoDia('2026-12-07') === null, [avisoDoDia('2027-02-08'), avisoDoDia('2027-02-09')]);
chk('a situação pelo nome', nomeDaSituacao('prevista') === 'Prevista' && nomeDaSituacao('realizada') === 'Realizada' && nomeDaSituacao('cancelada') === 'Cancelada');

console.log('O dia da tarefa de montar (a conta do banco):');
chk('o padrão são 6 dias: "7 dias antes", contando o dia da sessão (a sessão de 07/12 se monta a partir de 01/12)',
  ANTECEDENCIA_PADRAO === 6 && diaDeMontar('2026-12-07', 6, HOJE) === '2026-12-01');
chk('a sessão de terça se monta na quarta da semana anterior', diaDeMontar('2026-12-08', 6, HOJE) === '2026-12-02');
chk('caiu em feriado, vai pro dia útil de antes (21/04 é Tiradentes)', diaDeMontar('2027-04-27', 6, HOJE) === '2027-04-20');
chk('caiu no domingo, vai pra sexta', diaDeMontar('2026-12-13', 7, HOJE) === '2026-12-04', diaDeMontar('2026-12-13', 7, HOJE));
chk('nunca antes de hoje: a sessão daqui a 2 dias se monta hoje', diaDeMontar('2026-11-27', 6, HOJE) === HOJE);
chk('a sessão de hoje se monta hoje; 0 dias = no próprio dia', diaDeMontar(HOJE, 6, HOJE) === HOJE && diaDeMontar('2026-12-01', 0, HOJE) === '2026-12-01');
chk('a data que não existe não tem dia', diaDeMontar('2026-02-30', 6, HOJE) === null);

console.log('Colar as datas:');
chk('o horário da linha', JSON.stringify(lerHorario('9h30 às 11h30')) === '{"hora_inicio":"09:30","hora_fim":"11:30"}'
  && JSON.stringify(lerHorario('09:00 - 10:30')) === '{"hora_inicio":"09:00","hora_fim":"10:30"}'
  && JSON.stringify(lerHorario('9h')) === '{"hora_inicio":"09:00","hora_fim":null}'
  && JSON.stringify(lerHorario('sem hora')) === '{"hora_inicio":null,"hora_fim":null}');
const lidas = lerDatas('AGENDA DE SESSÕES PREVISTAS\nDezembro\t07/12/2026\t9h30 às 11h30\n21/12/26\n11/01\n2027-01-18 09:30 - 11:30\n31/02/2027\n07/12/2026\n08/03/2027 11h às 9h', { hoje: HOJE });
chk('a linha sem data fica de fora sem aviso', lidas[0].problema === 'sem_data' && lidas[0].data === null);
chk('dd/mm/aaaa com o horário; dd/mm/aa; dd/mm (a próxima a partir de hoje); aaaa-mm-dd',
  lidas[1].data === '2026-12-07' && lidas[1].hora_inicio === '09:30' && lidas[1].hora_fim === '11:30' && !lidas[1].problema
  && lidas[2].data === '2026-12-21' && lidas[3].data === '2027-01-11' && lidas[4].data === '2027-01-18' && lidas[4].hora_fim === '11:30',
  lidas.slice(1, 5).map(i => i.data));
chk('o "09:30 - 11:30" não vira uma data (30/11)', lerDatas('18/01/2027 09:30-11:30', { hoje: HOJE })[0].data === '2027-01-18');
chk('a data que não existe, a repetida e o horário ao contrário',
  lidas[5].problema === 'invalida' && lidas[6].problema === 'repetida' && lidas[7].problema === 'horario' && lidas.length === 8,
  lidas.slice(5).map(i => i.problema));
chk('a data de uma sessão que já existe é repetida', lerDatas('07/12/2026', { hoje: HOJE, existentes: ['2026-12-07'] })[0].problema === 'repetida');
chk('os textos dos problemas', Object.keys(PROBLEMAS).sort().join() === 'horario,invalida,passou,repetida');
// o ano que não virou: a agenda com dezembro e, depois, janeiro a maio ainda com o ano de dezembro
const agenda = lerDatas('08/12/2026\n22/12/2026\n12/01/2026\n26/01/2026\n09/02/2026\n25/05/2026', { hoje: HOJE });
chk('o ano que não virou: a data que já passou, logo depois de uma mais nova, vai pro ano seguinte, com a data como estava',
  agenda.map(i => i.data).join() === '2026-12-08,2026-12-22,2027-01-12,2027-01-26,2027-02-09,2027-05-25'
  && agenda.every(i => !i.problema) && agenda[2].escrito === '2026-01-12' && !agenda[1].escrito, agenda.map(i => [i.data, i.escrito, i.problema]));
chk('a agenda colada de novo, com as primeiras já cadastradas: a repetida conta pra ordem',
  lerDatas('08/12/2026\n12/01/2026', { hoje: HOJE, existentes: ['2026-12-08'] })[1].data === '2027-01-12');
chk('a data que já passou, sem uma mais nova antes, segue "já passou"', lerDatas('12/01/2026\n26/01/2027', { hoje: HOJE })[0].problema === 'passou');
chk('a data que só passou por pouco, depois de uma mais nova, não salta um ano se o ano seguinte não continua a ordem',
  lerDatas('15/12/2027\n20/11/2026', { hoje: HOJE })[1].problema === 'passou');

console.log('O resumo, a montagem e o card:');
const sess = [
  { id: 'a', data: '2026-12-07', situacao: 'realizada' }, { id: 'b', data: '2026-11-30', situacao: 'cancelada' },
  { id: 'c', data: '2026-12-21', situacao: 'prevista' }, { id: 'd', data: '2027-01-11', situacao: 'prevista' }
];
const r = resumo(sess, HOJE);
chk('em ordem de data', ordenarSessoes(sess).map(s => s.id).join() === 'b,a,c,d');
chk('as sessões sem as canceladas, as feitas, a próxima, a primeira e a última',
  r.total === 3 && r.realizadas === 1 && r.previstas === 2 && r.canceladas === 1 && r.proxima.id === 'c' && r.primeira === '2026-12-07' && r.ultima === '2027-01-11', r);
const t = (o) => ({ id: 't', status: 'pendente', prazo: '2026-12-01', responsavel: 'Thalia', concluida_em: null, ...o });
chk('a montagem pela tarefa: feita, hoje, atrasada, num dia que vem',
  montagem(sess[2], t({ status: 'concluida', concluida_em: '2026-12-15T10:00:00-03:00' }), HOJE).texto === 'Montada em 15/12 (Thalia)'
  && montagem(sess[2], t({ prazo: HOJE }), HOJE).estado === 'hoje' && montagem(sess[2], t({ prazo: '2026-11-20' }), HOJE).estado === 'atrasada'
  && montagem(sess[2], t(), HOJE).texto === 'Montar em 01/12 (Thalia)');
chk('sem tarefa: a prevista diz que falta, a cancelada não tem', montagem(sess[2], null, HOJE).estado === 'sem' && montagem(sess[1], t(), HOJE).estado === 'nenhuma');
chk('o card: quantas ativas', seloDoCard([{ situacao: 'ativa' }, { situacao: 'encerrada' }]) === '1 ativa' && seloDoCard([]) === '0 ativas'
  && seloDoCard([{ situacao: 'ativa' }, { situacao: 'ativa' }]) === '2 ativas');

console.log('A pauta: os horários e o tempo:');
chk('os minutos do dia e o tempo em texto', minutosDoDia('09:30:00') === 570 && minutosDoDia(null) === null
  && textoMinutos(45) === '45 min' && textoMinutos(60) === '1h' && textoMinutos(110) === '1h50' && textoMinutos(0) === '0 min');
chk('quanto dura a sessão', duracaoDaSessao({}, { hora_inicio: '09:30', hora_fim: '11:30' }) === 120 && duracaoDaSessao({ hora_fim: '10:30' }, { hora_inicio: '09:00' }) === 90
  && duracaoDaSessao({}, { hora_inicio: '09:00' }) === null);
const itens = [
  { id: 'x', ordem: 2, minutos: 30, titulo: 'Caixa' }, { id: 'y', ordem: 1, minutos: 20, titulo: 'Resultado' },
  { id: 'z', ordem: 3, minutos: null, titulo: 'Recados' }, { id: 'w', ordem: 4, minutos: 45, titulo: 'Metas' }
];
chk('a pauta em ordem', ordenarPauta(itens).map(p => p.id).join() === 'y,x,z,w');
const cr = cronograma('09:30:00', 10, itens);
chk('os horários: a abertura e cada assunto com tempo, um depois do outro; o sem tempo não empurra',
  faixaDoCronograma(cr.abertura) === '9h30 às 9h40' && faixaDoCronograma(cr.itens.y) === '9h40 às 10h' && faixaDoCronograma(cr.itens.x) === '10h às 10h30'
  && !cr.itens.z && faixaDoCronograma(cr.itens.w) === '10h30 às 11h15' && cr.total === 105 && cr.fim === '11:15', cr);
const semHora = cronograma(null, 10, itens);
chk('sem o horário da sessão, só o total', semHora.abertura === null && !Object.keys(semHora.itens).length && semHora.total === 105 && semHora.fim === null);
chk('o tempo da pauta contra o da sessão', tempoDaPauta(105, 120).texto === '1h45 de 2h' && !tempoDaPauta(105, 120).passou
  && tempoDaPauta(130, 120).passou && tempoDaPauta(130, 120).texto === '2h10 de pauta: passa 10 min do horário'
  && tempoDaPauta(0, 120).texto === 'Sem tempo marcado (a sessão tem 2h)' && tempoDaPauta(50, null).texto === '50 min de pauta');
chk('a pauta na lista das sessões', resumoDaPauta(itens) === '4 assuntos · 1h35' && resumoDaPauta([{ minutos: null }]) === '1 assunto' && resumoDaPauta([]) === 'vazia');

console.log('A pauta: a ordem e copiar da sessão anterior:');
chk('subir troca com o de cima e numera de 1 em diante (só o que mudou)', JSON.stringify(trocarOrdem(itens, 'x', -1)) === '[{"id":"x","ordem":1},{"id":"y","ordem":2}]');
chk('o primeiro não sobe, o último não desce', trocarOrdem(itens, 'y', -1).length === 0 && trocarOrdem(itens, 'w', 1).length === 0);
chk('a pauta copiada (toda com ordem 0) ganha a ordem inteira', JSON.stringify(trocarOrdem([{ id: 'a', ordem: 0, criado_em: '1' }, { id: 'b', ordem: 0, criado_em: '2' }], 'b', -1))
  === '[{"id":"b","ordem":1},{"id":"a","ordem":2}]');
chk('o assunto novo vai pro fim', proximaOrdem(itens) === 5 && proximaOrdem([]) === 1);
const contagem = { a: 3, b: 2 };
chk('copiar: a sessão anterior que tem pauta (a cancelada não conta)', sessaoAnteriorComPauta(sess, sess[3], contagem).id === 'a'
  && sessaoAnteriorComPauta(sess, sess[0], contagem) === null && sessaoAnteriorComPauta(sess, sess[2], {}) === null);
const copia = itensParaCopiar([{ titulo: 'Metas', ordem: 9, minutos: '15', interno: true, descricao: 'd', discussao: 'conversado', anexos: [{ caminho: 'a/b' }] }, { titulo: 'Abertura', ordem: 2 }]);
chk('copiar leva o assunto, o detalhe, o tempo e se é só do escritório; as anotações e os arquivos ficam',
  JSON.stringify(copia) === '[{"titulo":"Abertura","descricao":null,"minutos":null,"interno":false,"ordem":1},{"titulo":"Metas","descricao":"d","minutos":15,"interno":true,"ordem":2}]', copia);

console.log('Os arquivos:');
chk('o nome na pasta, sem acento e sem barra; o caminho começa pela sessão',
  nomeSeguro('Relatório / DRE nov.pdf') === 'Relatorio _ DRE nov.pdf' && nomeSeguro('') === 'arquivo' && nomeSeguro('.oculto') === 'oculto'
  && caminhoDoArquivo('s1', 'u1', 'Ação.xlsx') === 's1/u1-Acao.xlsx', [nomeSeguro('Relatório / DRE nov.pdf'), nomeSeguro('.oculto')]);
chk('a imagem que vai no PDF', ehImagem({ tipo: 'image/png' }) && ehImagem({ tipo: 'image/JPEG' }) && !ehImagem({ tipo: 'image/svg+xml' }) && !ehImagem({ tipo: 'application/pdf' }) && !ehImagem(null));
const conf = conferirArquivos([{ name: 'a.pdf', size: 10 }, { name: 'b.mp4', size: MAX_ARQUIVO + 1 }, { name: 'c.txt', size: 0 }, { name: 'd.pdf', size: 5 }], MAX_ANEXOS - 1);
chk('até 25 MB, não vazio e até 20 no assunto', conf.ok.map(f => f.name).join() === 'a.pdf'
  && conf.recusados.map(r => r.nome + ':' + r.motivo).join('|') === 'b.mp4:passa de 25 MB|c.txt:está vazio|d.pdf:o assunto já tem 20 arquivos', conf);
chk('o tamanho em texto', tamanhoDoArquivo(850) === '850 bytes' && tamanhoDoArquivo(12345) === '12 KB' && tamanhoDoArquivo(1234567) === '1,2 MB');
chk('o anexo gravado, conferido: só o da sessão, com nome', JSON.stringify(anexosValidos([
  { caminho: 's1/u-a.png', nome: ' a.png ', tamanho: '3', tipo: 'image/png', extra: 1 }, { caminho: 's2/u-b.pdf', nome: 'b.pdf' },
  { caminho: 's1/u-c.pdf' }, null, 'lixo'], 's1')) === '[{"caminho":"s1/u-a.png","nome":"a.png","tamanho":3,"tipo":"image/png"}]'
  && anexosValidos('lixo', 's1').length === 0);

console.log('O documento:');
chk('sem anotação, a pauta; com anotação de um assunto do cliente ou a geral, a pauta com as anotações',
  tituloDoDocumento([{ discussao: '' }], {}) === 'Pauta da sessão' && tituloDoDocumento([{ discussao: 'x' }], {}) === 'Pauta e anotações da sessão'
  && tituloDoDocumento([], { anotacoes: 'x' }) === 'Pauta e anotações da sessão' && tituloDoDocumento([{ discussao: 'x', interno: true }], {}) === 'Pauta da sessão');

console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
