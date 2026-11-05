// O controle das contabilidades (assets/js/contabil-controle.js, 04/11/2026): os meses, o estado de cada mês, o resumo da
// empresa (feita até, a fazer em faixas, em andamento), o "até aqui" e o desfazer, as dicas do Domínio, os avisos da
// empresa, as pendências e os focos. Dados inventados. Rodar com: node tests/contabil-controle.test.mjs
import { mesValido, diaValido, somaMes, mesesEntre, rotuloMes, mesPorExtenso, ultimoFechavel, diasEntre, mapaDosMeses, estadoDoMes,
  alvoDaEmpresa, resumoDaEmpresa, faixas, textoDasFaixas, mesesAteAqui, linhasParaMarcar, desfazerDe, dominioPorMes, textoDoDominio,
  dicaDoDominio, avisosDaEmpresa, limparPendencia, textoDaPendencia, ordenarPendencias, nomeDaEmpresa, semAcento, focosDaEmpresa,
  anosDoControle, inicioSugerido, feitoNoMes, textoDeMeses, andamentoDaEmpresa, folhaCalculada, problemasDoMes, mesesQueDiscordam,
  textoDoAndamento, FOCOS, encerramentoDaEmpresa, textoDasOrigens } from '../assets/js/contabil-controle.js';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); };

const HOJE = '2026-11-04';
const feita = (c, em = '2026-01-31') => ({ cliente_id: 'e1', competencia: c, situacao: 'feita', feita_em: em });
const semMov = c => ({ cliente_id: 'e1', competencia: c, situacao: 'sem_movimento', feita_em: null });
const andam = (c, em = '2026-07-24') => ({ cliente_id: 'e1', competencia: c, situacao: 'andamento', feita_em: em });
const ano = (a, f) => Array.from({ length: 12 }, (_, i) => f(a + '-' + String(i + 1).padStart(2, '0')));

console.log('Os meses e as datas:');
chk('mês válido e dia válido', mesValido('2026-11') && !mesValido('2026-13') && !mesValido('2026-1') && !mesValido(null) && diaValido('2026-02-28') && !diaValido('2026-02-30') && !diaValido('31/01/2026'));
chk('somar meses, virando o ano nos dois sentidos', somaMes('2026-11', 2) === '2027-01' && somaMes('2026-01', -1) === '2025-12' && somaMes('2025-12', -12) === '2024-12' && somaMes('2026-06', 0) === '2026-06');
chk('os meses entre dois meses, inclusive', mesesEntre('2025-11', '2026-02').join() === '2025-11,2025-12,2026-01,2026-02' && mesesEntre('2026-03', '2026-02').length === 0 && mesesEntre('x', '2026-01').length === 0);
chk('o mês em texto', rotuloMes('2026-07') === '07/2026' && mesPorExtenso('2026-10') === 'Outubro de 2026' && rotuloMes('lixo') === '');
chk('o último mês que dá pra fechar é o passado', ultimoFechavel(HOJE) === '2026-10' && ultimoFechavel('2026-01-15') === '2025-12');
chk('dias entre dois dias', diasEntre('2026-07-15', HOJE) === 112 && diasEntre(HOJE, HOJE) === 0 && diasEntre('x', HOJE) === null);
chk('meses em texto', textoDeMeses(1) === '1 mês' && textoDeMeses(10) === '10 meses');

console.log('O estado de cada mês:');
const emp = { cliente_id: 'e1', inicio: '2025-01', fim: null, faz: true };
const mapa = mapaDosMeses([feita('2025-01'), semMov('2025-02'), andam('2025-03'), { competencia: '2025-04', situacao: 'outra' }, { competencia: 'lixo', situacao: 'feita' }]);
chk('só as linhas válidas entram no mapa', mapa.size === 3 && !mapa.has('2025-04'));
chk('feita com o dia, sem movimento e em andamento', estadoDoMes(emp, mapa, '2025-01', HOJE).tipo === 'feita' && estadoDoMes(emp, mapa, '2025-01', HOJE).feita_em === '2026-01-31'
  && estadoDoMes(emp, mapa, '2025-02', HOJE).tipo === 'sem_movimento' && estadoDoMes(emp, mapa, '2025-03', HOJE).tipo === 'andamento');
chk('sem linha: a fazer até o mês de hoje, futuro depois', estadoDoMes(emp, mapa, '2026-10', HOJE).tipo === 'afazer' && estadoDoMes(emp, mapa, '2026-11', HOJE).tipo === 'afazer' && estadoDoMes(emp, mapa, '2026-12', HOJE).tipo === 'futuro');
const nova = { cliente_id: 'e2', inicio: '2026-08', fim: null };
const saiu = { cliente_id: 'e3', inicio: '2025-01', fim: '2026-06' };
chk('antes do início e depois do fim, fora (com o porquê)', estadoDoMes(nova, new Map(), '2026-07', HOJE).tipo === 'fora' && estadoDoMes(nova, new Map(), '2026-07', HOJE).porque === 'antes'
  && estadoDoMes(saiu, new Map(), '2026-07', HOJE).porque === 'depois' && estadoDoMes(saiu, new Map(), '2026-06', HOJE).tipo === 'afazer');

console.log('O resumo da empresa:');
let r = resumoDaEmpresa(emp, [...ano('2025', c => feita(c)), feita('2026-01', '2026-02-28'), feita('2026-02', '2026-03-31')], HOJE);
chk('feita até o último mês da sequência fechada', r.feitaAte === '2026-02' && r.alvo === '2026-10', r);
chk('a fazer: do mês seguinte até o mês passado', r.aFazer.join() === mesesEntre('2026-03', '2026-10').join() && r.faltam === 8 && r.proximo === '2026-03');
chk('a última vez que foi feita', r.ultimaFeita === '2026-03-31' && r.ultimoFechado === '2026-02');
r = resumoDaEmpresa(emp, [feita('2025-01'), ...mesesEntre('2026-01', '2026-09').map(c => feita(c, '2026-10-23'))], HOJE);
chk('o buraco no meio: feita até o começo, a fazer em faixas, o último fechado depois do buraco', r.feitaAte === '2025-01' && textoDasFaixas(r.abertos) === '02/2025 a 12/2025, 10/2026' && r.ultimoFechado === '2026-09' && r.faltam === 12, r);
r = resumoDaEmpresa(emp, ano('2025', c => andam(c)), HOJE);
chk('em andamento não fecha o mês: nada fechado, 12 em andamento', r.feitaAte === null && r.andamento.length === 12 && r.aFazer.length === 10 && r.faltam === 22 && r.proximo === '2025-01');
r = resumoDaEmpresa(emp, [...ano('2025', semMov), ...mesesEntre('2026-01', '2026-10').map(c => feita(c, '2026-11-02'))], HOJE);
chk('sem movimento fecha o mês: em dia', r.feitaAte === '2026-10' && r.faltam === 0 && r.ultimaFeita === '2026-11-02');
r = resumoDaEmpresa(saiu, [...ano('2025', c => feita(c))], HOJE);
chk('com o fim: o alvo é o fim, e o controle encerra quando fecha até ele', r.alvo === '2026-06' && r.faltam === 6 && !r.encerrada
  && resumoDaEmpresa(saiu, [...ano('2025', c => feita(c)), ...mesesEntre('2026-01', '2026-06').map(c => feita(c))], HOJE).encerrada);
r = resumoDaEmpresa({ inicio: '2026-11', fim: null }, [], HOJE);
chk('quem começou este mês ainda não tem nada a fazer', r.faltam === 0 && r.feitaAte === null && alvoDaEmpresa({ fim: '2027-01' }, HOJE) === '2026-10');

console.log('As faixas:');
chk('faixas seguidas, sem repetir, em ordem', JSON.stringify(faixas(['2026-03', '2026-01', '2026-02', '2026-02', '2026-05'])) === JSON.stringify([['2026-01', '2026-03'], ['2026-05', '2026-05']]));
chk('a faixa atravessa o ano', JSON.stringify(faixas(['2025-12', '2026-01'])) === JSON.stringify([['2025-12', '2026-01']]));
chk('com muitas faixas, "e mais"', textoDasFaixas(['2026-01', '2026-03', '2026-05', '2026-07', '2026-09'], 3) === '01/2026, 03/2026, 05/2026, e mais 2 faixas' && textoDasFaixas([]) === '');

console.log('Até aqui e o desfazer:');
const linhas = [feita('2025-01'), semMov('2025-02'), andam('2025-03')];
chk('feita até aqui: os a fazer e os em andamento até o mês, sem o que já fechou', mesesAteAqui(emp, linhas, '2025-06', 'feita').join() === '2025-03,2025-04,2025-05,2025-06');
chk('sem movimento até aqui: só os a fazer', mesesAteAqui(emp, linhas, '2025-06', 'sem_movimento').join() === '2025-04,2025-05,2025-06');
chk('não passa do fim nem começa antes do início', mesesAteAqui(saiu, [], '2026-09').slice(-1)[0] === '2026-06' && mesesAteAqui(nova, [], '2026-09').join() === '2026-08,2026-09');
const gravar = linhasParaMarcar('e1', ['2025-04', '2025-05'], 'feita', '2026-11-04');
chk('as linhas a gravar levam o dia; sem movimento, sem dia', gravar.length === 2 && gravar[0].feita_em === '2026-11-04' && gravar[0].situacao === 'feita'
  && linhasParaMarcar('e1', ['2025-04'], 'sem_movimento', null)[0].feita_em === null);
let erro = null; try { linhasParaMarcar('e1', ['2025-04'], 'feita', ''); } catch (e) { erro = e.message; }
chk('feita sem o dia não grava', erro === 'Diga o dia em que foi feita.');
const des = desfazerDe('e1', ['2025-03', '2025-04'], linhas);
chk('desfazer: o que não tinha linha sai, o que tinha volta como estava', des.apagar.join() === '2025-04' && des.voltar.length === 1 && des.voltar[0].situacao === 'andamento' && des.voltar[0].feita_em === '2026-07-24');

console.log('O Domínio:');
const dom = dominioPorMes([
  { codigo: 10, competencia: '2026-09', lancamentos: 100, notas_saida: 12, valor_saidas: 1000, notas_entrada: 3, funcionarios_ativos: 2, pro_labore: 1, ultimo_lancamento: '2026-09-30' },
  { codigo: 11, competencia: '2026-09', lancamentos: 40, notas_saida: 20, valor_saidas: 500, notas_entrada: null, funcionarios_ativos: null, pro_labore: null, ultimo_lancamento: '2026-09-15' },
  { codigo: 10, competencia: '2026-08', lancamentos: 0, notas_saida: 0, notas_entrada: 0, funcionarios_ativos: 0, pro_labore: 0 },
  { codigo: 10, competencia: '2026-07', lancamentos: 0, notas_saida: 0, notas_entrada: 0, funcionarios_ativos: null, pro_labore: null }]);
chk('dois códigos no mesmo mês: o maior de cada número', dom.get('2026-09').lancamentos === 100 && dom.get('2026-09').notas_saida === 20 && dom.get('2026-09').ultimo_lancamento === '2026-09-30');
chk('o Domínio em texto', textoDoDominio(dom.get('2026-09')) === '100 lançamentos, 20 notas de saída, 3 notas de entrada, 2 funcionários, 1 pró-labore' && textoDoDominio({}) === null);
chk('sem movimento com nota ou lançamento lá: conferir', dicaDoDominio({ tipo: 'sem_movimento' }, dom.get('2026-09'), '2026-09', HOJE).tipo === 'conferir'
  && dicaDoDominio({ tipo: 'sem_movimento' }, dom.get('2026-09'), '2026-09', HOJE).texto === 'Marcado sem movimento, mas o Domínio tem 100 lançamentos, 20 notas de saída, 3 notas de entrada neste mês.');
chk('a fazer sem nada no Domínio: sem movimento?', dicaDoDominio({ tipo: 'afazer' }, dom.get('2026-08'), '2026-08', HOJE).tipo === 'sem_movimento');
chk('o que o Domínio não disse (null) não vira "sem nada"', dicaDoDominio({ tipo: 'afazer' }, dom.get('2026-07'), '2026-07', HOJE).tipo === 'sem_movimento'
  && dicaDoDominio({ tipo: 'afazer' }, { lancamentos: null, notas_saida: 0, notas_entrada: 0 }, '2026-07', HOJE) === null);
chk('o mês de hoje (ainda aberto) não ganha a dica, nem o mês feito', dicaDoDominio({ tipo: 'afazer' }, dom.get('2026-08'), '2026-11', HOJE) === null && dicaDoDominio({ tipo: 'feita' }, dom.get('2026-09'), '2026-09', HOJE) === null);
chk('funcionário ou pró-labore no mês: não sugere sem movimento', dicaDoDominio({ tipo: 'afazer' }, { lancamentos: 0, notas_saida: 0, notas_entrada: 0, funcionarios_ativos: 1 }, '2026-08', HOJE) === null);

console.log('Os avisos da empresa:');
let av = avisosDaEmpresa(emp, { carteira: { entrada: '2020-01-01', saida: '2026-05-08' }, cliente: { status: 'inativo', regime_tributario: 'Simples Nacional' }, dominio: [{ ativa: false }] });
chk('saiu da carteira com o controle sem fim: a ação de encerrar no mês da saída', av[0].tipo === 'saida' && av[0].texto === 'Saiu da carteira em 08/05/2026, e o controle segue sem fim.' && av[0].acao.fim === '2026-05' && av[0].acao.rotulo === 'Encerrar em 05/2026');
chk('inativa no Domínio e no cadastro', av.some(a => a.tipo === 'dominio') && av.some(a => a.tipo === 'cadastro'));
chk('com o fim já posto, a saída não avisa', !avisosDaEmpresa({ ...emp, fim: '2026-05' }, { carteira: { entrada: '2020-01-01', saida: '2026-05-08' } }).length);
chk('fora da carteira, MEI no cadastro, o Domínio ativo em algum código', avisosDaEmpresa(emp, { carteira: null, cliente: { regime_tributario: 'MEI' }, dominio: [{ ativa: false }, { ativa: true }] }).map(a => a.tipo).join() === 'carteira,mei');
chk('quem não faz não tem aviso', avisosDaEmpresa({ ...emp, faz: false }, { carteira: null }).length === 0);
chk('a saída antes do início encerra no início', avisosDaEmpresa(nova, { carteira: { entrada: '2026-07-01', saida: '2026-07-20' } })[0].acao.fim === '2026-08');

console.log('As pendências:');
chk('o texto limpo, de quem se espera, desde e o mês', JSON.stringify(limparPendencia({ texto: '  Extratos   do Sicoob ', aguardando: 'cliente', desde: '2026-07-15', competencia: '2025-12' }).valor)
  === JSON.stringify({ texto: 'Extratos do Sicoob', aguardando: 'cliente', desde: '2026-07-15', competencia: '2025-12' }));
chk('vazio, data errada e mês errado não passam', limparPendencia({ texto: ' ' }).erro === 'Escreva o que falta.' && !!limparPendencia({ texto: 'x', desde: '2026-02-30' }).erro && !!limparPendencia({ texto: 'x', competencia: '2026-13' }).erro);
chk('de quem se espera, fora da lista, vira o escritório', limparPendencia({ texto: 'x', aguardando: 'fulano' }).valor.aguardando === 'escritorio');
chk('o texto longo demais não passa', !!limparPendencia({ texto: 'a'.repeat(1001) }).erro && !limparPendencia({ texto: 'a'.repeat(1000) }).erro);
chk('a linha de baixo da pendência', textoDaPendencia({ aguardando: 'cliente', desde: '2026-07-15', competencia: '2025-12' }, HOJE) === 'Esperando o cliente, desde 15/07/2026 (há 112 dias), de 12/2025'
  && textoDaPendencia({ aguardando: 'diego' }, HOJE) === 'Esperando o Diego' && textoDaPendencia({ aguardando: 'samuel', desde: HOJE }, HOJE) === 'Esperando o Samuel, desde 04/11/2026 (hoje)');
const ord = ordenarPendencias([{ id: 'a', desde: '2026-09-01' }, { id: 'b', desde: null, criado_em: '2026-11-01' }, { id: 'c', desde: '2026-07-15' }, { id: 'd', resolvida_em: '2026-10-01T10:00:00Z' }, { id: 'e', resolvida_em: '2026-11-01T10:00:00Z' }]);
chk('abertas: a mais antiga primeiro, sem o desde no fim; resolvidas: a mais recente primeiro', ord.abertas.map(p => p.id).join() === 'c,a,b' && ord.resolvidas.map(p => p.id).join() === 'e,d');

console.log('O nome, os focos, os anos e o resto:');
chk('o nome: o fantasia, senão a razão social sem o CPF do MEI', nomeDaEmpresa({ nome_fantasia: 'SEDUÇÃO', nome_principal: 'A. R. LTDA' }) === 'SEDUÇÃO' && nomeDaEmpresa({ nome_principal: 'FULANA DE TAL 12345678901' }) === 'FULANA DE TAL' && nomeDaEmpresa(null) === 'Empresa sem cadastro');
chk('a busca sem acento', semAcento('Calçados São José') === 'calcados sao jose');
let f = focosDaEmpresa(emp, resumoDaEmpresa(emp, [feita('2025-01')], HOJE), 2, HOJE);
chk('ano passado aberto e com pendência', f.has('todas') && f.has('ano_passado') && f.has('pendencia') && !f.has('em_dia') && !f.has('saindo'));
f = focosDaEmpresa(saiu, resumoDaEmpresa(saiu, ano('2025', c => feita(c)), HOJE), 0, HOJE);
chk('com o fim e meses abertos: saindo; o ano passado fechado não aparece', f.has('saindo') && !f.has('ano_passado'));
chk('em dia', focosDaEmpresa(emp, resumoDaEmpresa(emp, [...ano('2025', semMov), ...mesesEntre('2026-01', '2026-10').map(c => feita(c))], HOJE), 0, HOJE).has('em_dia'));
chk('não fazemos fica só nesse foco', [...focosDaEmpresa({ ...emp, faz: false }, resumoDaEmpresa(emp, [], HOJE), 3, HOJE)].join() === 'nao_faz');
chk('os anos da grade: do início mais antigo até hoje', anosDoControle([{ inicio: '2025-01' }, { inicio: '2026-08' }], HOJE).join() === '2025,2026' && anosDoControle([], HOJE).join() === '2026');
chk('o início sugerido: o mês da entrada, nunca antes de janeiro do ano passado', inicioSugerido('2026-03-05', HOJE) === '2026-03' && inicioSugerido('2023-01-09', HOJE) === '2025-01' && inicioSugerido(null, HOJE) === '2026-11');
const nm = feitoNoMes([feita('2025-01', '2026-11-02'), { ...feita('2025-02', '2026-11-03'), cliente_id: 'e2' }, feita('2025-03', '2026-10-30'), semMov('2025-04')], HOJE);
chk('o que foi feito no mês de hoje', nm.meses === 2 && nm.empresas === 2);

console.log('O andamento das contabilidades no Domínio (a versão 3 da ponte, 05/11/2026):');
{
  const dm = dominioPorMes([
    { codigo: 1, competencia: '2026-09', lanc_fiscal: 40, incluido_ate: '2026-10-04', receita_lancada: 1000, receita_bruta: 1000 },
    { codigo: 2, competencia: '2026-09', lanc_fiscal: 5, incluido_ate: '2026-10-09', caixa_negativo: 1 }
  ]).get('2026-09');
  chk('dois códigos no mês: o maior de cada (também o dia em que a integração entrou)', dm.lanc_fiscal === 40 && dm.incluido_ate === '2026-10-09' && dm.caixa_negativo === 1 && dm.receita_lancada === 1000);
  const a = andamentoDaEmpresa([
    { codigo: 1, banco_contas: 2, banco_ate: '2026-08-31', banco_ultimo: '2026-09-30', extrato_ate: '2026-09-30', extrato_pendentes: 3, caixa_ate: '2026-10-31' },
    { codigo: 2, banco_contas: 1, banco_ate: '2026-07-31', banco_ultimo: '2026-07-31', extrato_ate: '2026-07-31', extrato_pendentes: 0, caixa_ate: '2026-09-30' }
  ]);
  chk('a foto de dois códigos: a conta mais atrasada fica a menor, as outras datas a maior, as contagens a maior',
    a.banco_ate === '2026-07-31' && a.banco_ultimo === '2026-09-30' && a.extrato_ate === '2026-07-31' && a.caixa_ate === '2026-10-31' && a.banco_contas === 2 && a.extrato_pendentes === 3);
  chk('sem foto, null', andamentoDaEmpresa([]) === null && andamentoDaEmpresa(null) === null);
  chk('a folha calculada: os proventos, o 13º e o pró-labore (null sem nenhum)', folhaCalculada({ salarios: 4000, decimo_terceiro: null, pro_labore_valor: 1518 }) === 5518 && folhaCalculada({}) === null && folhaCalculada({ salarios: 0 }) === 0);
  const tipos = (d, c = '2026-09', and = null) => problemasDoMes(d, c, and).map(p => p.tipo).join();
  chk('a escrita fiscal que não entrou (nota no mês, nenhum lançamento da integração): e aí não compara a receita',
    tipos({ notas_saida: 12, notas_entrada: 3, lanc_fiscal: 0, receita_bruta: 5000, receita_lancada: 0 }) === 'fiscal'
    && problemasDoMes({ notas_saida: 12, notas_entrada: 3, lanc_fiscal: 0 }, '2026-09')[0].texto === 'a escrita fiscal (15 notas) não entrou na contabilidade');
  chk('a folha que não entrou e a que entrou diferente (mais de R$ 1,00)',
    tipos({ salarios: 4000, pro_labore_valor: 1518, folha_lancada: 0 }) === 'folha'
    && tipos({ salarios: 4000, folha_lancada: 3990 }) === 'folha_difere' && tipos({ salarios: 4000, folha_lancada: 3999.5 }) === '');
  chk('a receita lançada diferente do faturamento; igual (até R$ 1,00), nada', tipos({ notas_saida: 2, lanc_fiscal: 10, receita_bruta: 5000, receita_lancada: 4200 }) === 'receita'
    && tipos({ notas_saida: 2, lanc_fiscal: 10, receita_bruta: 5000, receita_lancada: 4999.2 }) === '');
  chk('o fim do mês: o caixa negativo, a transitória (com o valor) e as contas contra a natureza (leve)',
    tipos({ caixa_negativo: 1, transitorias: 2, transitorias_valor: 350.75, contra_natureza: 3 }) === 'caixa,transitoria,natureza'
    && problemasDoMes({ transitorias: 2, transitorias_valor: 350.75 }, '2026-09')[0].texto === '2 contas transitórias ou a classificar com saldo no fim do mês (R$ 350,75)'
    && problemasDoMes({ contra_natureza: 3 }, '2026-09')[0].forte === false);
  const and = { banco_contas: 2, banco_ultimo: '2026-07-31' };
  chk('o banco sem lançamento no mês (nenhuma conta do mês em diante); o mês de antes do último, não; sem conta no ano, não',
    tipos({}, '2026-09', and) === 'banco' && tipos({}, '2026-07', and) === '' && tipos({}, '2026-09', { banco_contas: 0, banco_ultimo_geral: '2023-05-31' }) === ''
    && problemasDoMes({}, '2026-09', and)[0].texto === 'o banco não tem lançamento neste mês (o último é de 31/07/2026)');
  chk('o que o Domínio não disse (a ponte de antes, sem a versão 3) não vira problema', tipos({ notas_saida: 12, salarios: 4000, receita_bruta: 5000 }) === '');
  const feito = { tipo: 'feita', feita_em: '2026-10-20' };
  const dc = dicaDoDominio(feito, { notas_saida: 12, lanc_fiscal: 0, caixa_negativo: 1, contra_natureza: 4 }, '2026-09', HOJE);
  chk('o mês feito em que o Domínio discorda: conferir, com o que não bate (as contas contra a natureza ficam de fora)',
    dc && dc.tipo === 'conferir' && dc.texto === 'Marcado como feito, mas no Domínio a escrita fiscal (12 notas) não entrou na contabilidade; o caixa fechou o mês negativo.', dc);
  chk('o mês feito só com contas contra a natureza, ou sem nada: sem dica', dicaDoDominio(feito, { contra_natureza: 4 }, '2026-09', HOJE) === null && dicaDoDominio(feito, { lanc_fiscal: 3, notas_saida: 2 }, '2026-09', HOJE) === null);
  chk('o mês feito com o banco parado antes dele: conferir', dicaDoDominio(feito, null, '2026-09', HOJE, and).tipo === 'conferir');
  const empD = { cliente_id: 'e1', faz: true, inicio: '2026-07', fim: null };
  const mapaD = mapaDosMeses([{ competencia: '2026-07', situacao: 'feita' }, { competencia: '2026-08', situacao: 'feita' }, { competencia: '2026-09', situacao: 'sem_movimento' }, { competencia: '2026-10', situacao: 'feita' }]);
  const domD = dominioPorMes([
    { competencia: '2026-07', notas_saida: 3, lanc_fiscal: 9 },
    { competencia: '2026-08', salarios: 2000, folha_lancada: 0 },
    { competencia: '2026-09', lancamentos: 12, notas_saida: 0, notas_entrada: 0 },
    { competencia: '2026-10', notas_saida: 2, lanc_fiscal: 6 }
  ]);
  chk('os meses em que a marcação e o Domínio discordam: o feito com problema e o sem movimento com lançamento',
    mesesQueDiscordam(empD, mapaD, domD, null, HOJE).join() === '2026-08,2026-09' && mesesQueDiscordam({ ...empD, faz: false }, mapaD, domD, null, HOJE).length === 0);
  chk('o foco "O Domínio discorda"', FOCOS.some(([k]) => k === 'discorda') && focosDaEmpresa(empD, resumoDaEmpresa(empD, mapaD, HOJE), 0, HOJE, 2).has('discorda')
    && !focosDaEmpresa(empD, resumoDaEmpresa(empD, mapaD, HOJE), 0, HOJE).has('discorda'));
  const tx = textoDoAndamento({ banco_contas: 2, banco_ate: '2026-08-31', banco_ultimo: '2026-09-30', extrato_contas: 1, extrato_ate: '2026-09-30', extrato_pendentes: 3,
    caixa_ate: '2026-10-31', caixa_contador_ate: '2026-09-15', fechamento_em: '2025-12-31' },
    [{ ano: 2024, zerado_em: '2024-12-31', zeramentos: 1, zerado_incluido_em: '2025-03-15', lancados_depois: 0 }, { ano: 2025, zerado_em: null, lancamentos_do_ano: 4300 }]);
  chk('a foto em texto, pra ficha', tx.join(' | ') === 'Banco: 2 contas com movimento nos últimos 12 meses, lançadas até 31/08/2026 (a mais atrasada) e 30/09/2026 (a mais adiantada).'
    + ' | Extrato importado até 30/09/2026, com 3 linhas ainda sem lançamento.'
    + ' | Caixa lançado pelo contador até 15/09/2026 (com a integração das notas, até 31/10/2026).'
    + ' | Data do fechamento nos parâmetros do Domínio: 31/12/2025.'
    + ' | 2025: sem o zeramento (4.300 lançamentos no ano).'
    + ' | 2024: zerado em 31/12/2024, feito em 15/03/2025.', tx);
  const enc = encerramentoDaEmpresa([{ codigo: 1, ano: 2025, zerado_em: null, lancamentos_do_ano: 10 }, { codigo: 2, ano: 2025, zerado_em: '2025-12-31', lancamentos_do_ano: 3 },
    { codigo: 1, ano: 2024, zerado_em: null, lancamentos_do_ano: 5 }, { codigo: 2, ano: 2024, zerado_em: null, lancamentos_do_ano: 9 }]);
  chk('o encerramento de dois códigos: no ano, o que zerou, senão o de mais lançamentos; o ano mais novo primeiro',
    enc.map(z => z.ano + ':' + z.codigo).join() === '2025:2,2024:2');
  chk('as origens em texto (só as que têm); sem a versão 3, null', textoDasOrigens({ lanc_fiscal: 340, lanc_folha: 15, lanc_extrato: 25, lanc_normais: 1, lanc_apuracao: 0, lanc_outros: 0 })
    === '340 da escrita fiscal, 15 da folha, 25 do extrato importado, 1 digitado' && textoDasOrigens({ lancamentos: 5 }) === null && textoDasOrigens({ lanc_fiscal: 0 }) === null);
  chk('sem banco no ano, nunca teve banco, só a integração no caixa',
    textoDoAndamento({ banco_contas: 0, banco_ultimo_geral: '2023-05-31' })[0] === 'Banco: sem movimento nos últimos 12 meses (o último lançamento em conta de banco é de 31/05/2023).'
    && textoDoAndamento({ banco_contas: 0, caixa_ate: '2026-10-31' }).join(' | ') === 'Banco: nenhum lançamento em conta de banco no Domínio. | Caixa: só a integração das notas (até 31/10/2026).');
}

console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
