// As Integrações (assets/js/integracoes.js, 19/11/2026): a saúde das pontes, o calendário das consultas da Receita, a
// carteira de hoje, a linha de cada empresa no Domínio e na Receita, os filtros, a ordem e o que o perfil mostra.
// Dados inventados. Rodar com: node tests/integracoes.test.mjs
import {
  dataBR, mesBR, somaMes, horaEmBrasilia, quandoFoi, rotuloDoDia,
  PONTES, rodadaEsperada, saudeDaPonte, textoDaSaude, seloDasPontes, ultimaRodada, chamadasDoMes, TETO_MES,
  diaDeSemana, prazoPgdas, consultaPgdas, proximasConsultas, CONSULTAS, BLOCOS_DO_DOMINIO,
  ultimoMesFechado, emFechamento, carteiraDeHoje, foraDaConsulta, REGIMES_DA_RECEITA, avisosPorCliente,
  linhaDominio, linhasDoDominio, mesesDoDominio, FOCOS_DOMINIO, focosDominio, CAMPOS_DA_LISTA,
  procuracaoDe, procuracoesPorVia, DE_QUEM, ehDasDoMes, ehParcelaDoSimples, mesesDoDas, valorNoMes, comDasSemPagar, dasPorMes, mesesSemPagamento, naoLidasRecentes, linhaReceita, linhasDaReceita, FOCOS_RECEITA, focosReceita,
  contarFocos, filtrar, ordenar, proximaOrdem, COLUNAS,
  conferenciaDoFaturamento, jornadasDoPerfil, resumoDasPartes, guiasDoPerfil, tipoDoFiltro, totaisDasGuias, anosDasGuias, pgdasDoPerfil, mensagensDoPerfil,
  carregarListaReceita, carregarPerfilReceita
} from '../assets/js/integracoes.js';
import { dominioPorMes } from '../assets/js/contabil-controle.js';
import { ultimoMesFechado as fechadoDoComparativo } from '../assets/js/comparativo-roteiro.js';
import { ultimoMesFechado as fechadoDoFatorR } from '../assets/js/fator-r-monitor.js';
import { empresasDaCarteira, REGIME } from '../supabase/functions/ponte/receita.js';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); };
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// um instante pela hora de Brasília (3 horas atrás do UTC)
const brt = (dia, hora) => new Date(dia + 'T' + hora + ':00-03:00').getTime();

console.log('Datas e horas:');
chk('o dia e o mês em português', dataBR('2026-11-19') === '19/11/2026' && dataBR('2026-11-19T10:00:00Z') === '19/11/2026' && dataBR('x') === '' && mesBR('2026-09') === '09/2026' && mesBR('2026-9') === '');
chk('o mês de antes e o de depois, virando o ano', somaMes('2026-12', 1) === '2027-01' && somaMes('2026-01', -1) === '2025-12' && somaMes('2026-11', -14) === '2025-09');
chk('a hora em Brasília, com o zero da frente', horaEmBrasilia('2026-11-19T10:12:39Z') === '07h12' && horaEmBrasilia('2026-11-20T02:05:00Z') === '23h05' && horaEmBrasilia('x') === '');
const AGORA = brt('2026-11-19', '18:40');
chk('hoje, ontem e o dia', quandoFoi('2026-11-19T10:12:39Z', AGORA) === 'hoje às 07h12' && quandoFoi('2026-11-18T10:12:00Z', AGORA) === 'ontem às 07h12'
  && quandoFoi('2026-11-12T11:30:00Z', AGORA) === 'em 12/11 às 08h30' && quandoFoi('2025-12-30T11:30:00Z', AGORA) === 'em 30/12/2025 às 08h30', quandoFoi('2026-11-12T11:30:00Z', AGORA));
chk('a virada do dia é a de Brasília (23h de ontem em Brasília já é hoje em UTC)', quandoFoi('2026-11-19T02:30:00Z', AGORA) === 'ontem às 23h30');
chk('o rótulo de um dia: hoje, amanhã, o dia', rotuloDoDia('2026-11-19', '2026-11-19') === 'hoje' && rotuloDoDia('2026-11-20', '2026-11-19') === 'amanhã'
  && rotuloDoDia('2026-11-25', '2026-11-19') === '25/11' && rotuloDoDia('2027-01-05', '2026-11-19') === '05/01/2027' && rotuloDoDia('2026-11-17', '2026-11-19') === '17/11');

console.log('A saúde das pontes:');
chk('as horas marcadas: o Domínio todo dia às 7h, a Receita de segunda a sexta às 8h30', igual(PONTES, { dominio: { hora: 7, minuto: 0, uteis: false }, receita: { hora: 8, minuto: 30, uteis: true } }));
let s = saudeDaPonte('dominio', '2026-11-19T10:12:39Z', AGORA);
chk('o Domínio lido hoje: em dia', s.estado === 'ok' && textoDaSaude(s, AGORA) === 'Lida hoje às 07h12', s);
s = saudeDaPonte('receita', '2026-11-19T14:25:41Z', AGORA);
chk('a Receita consultada hoje: em dia', s.estado === 'ok' && textoDaSaude(s, AGORA) === 'Consultada hoje às 11h25', s);
// antes das 9h a rodada de hoje ainda tem prazo pra chegar: vale a de ontem
chk('às 8h30 a rodada das 7h ainda tem prazo: a de ontem vale', rodadaEsperada('dominio', brt('2026-11-19', '08:30')) === brt('2026-11-18', '07:00')
  && saudeDaPonte('dominio', brt('2026-11-18', '07:12'), brt('2026-11-19', '08:30')).estado === 'ok');
s = saudeDaPonte('dominio', brt('2026-11-18', '07:12'), brt('2026-11-19', '09:01'));
chk('às 9h01 sem a de hoje: atrasada', s.estado === 'atrasada' && textoDaSaude(s, brt('2026-11-19', '09:01')) === 'Sem leitura desde 18/11', [s, textoDaSaude(s, brt('2026-11-19', '09:01'))]);
chk('a rodada feita à mão na véspera não vale pela de hoje', saudeDaPonte('dominio', brt('2026-11-18', '20:00'), brt('2026-11-19', '12:00')).estado === 'atrasada');
chk('4 dias sem nenhuma: parada', saudeDaPonte('dominio', brt('2026-11-15', '07:10'), brt('2026-11-19', '09:30')).estado === 'parada'
  && textoDaSaude(saudeDaPonte('dominio', brt('2026-11-15', '07:10'), brt('2026-11-19', '09:30')), brt('2026-11-19', '09:30')) === 'Parada desde 15/11');
// a Receita não roda no fim de semana: na segunda de manhã, a de sexta ainda vale
const SEXTA = brt('2026-11-20', '08:36');
chk('a Receita na segunda às 10h: a de sexta vale', rodadaEsperada('receita', brt('2026-11-23', '10:00')) === brt('2026-11-20', '08:30') && saudeDaPonte('receita', SEXTA, brt('2026-11-23', '10:00')).estado === 'ok');
chk('no sábado e no domingo também', saudeDaPonte('receita', SEXTA, brt('2026-11-21', '15:00')).estado === 'ok' && saudeDaPonte('receita', SEXTA, brt('2026-11-22', '23:00')).estado === 'ok');
s = saudeDaPonte('receita', SEXTA, brt('2026-11-23', '10:31'));
chk('na segunda às 10h31 sem a de segunda: atrasada', s.estado === 'atrasada' && textoDaSaude(s, brt('2026-11-23', '10:31')) === 'Sem consulta desde 20/11', s);
chk('na terça, 4 dias depois: parada', saudeDaPonte('receita', SEXTA, brt('2026-11-24', '10:31')).estado === 'parada');
chk('a Receita roda no feriado que cai em dia de semana (20/11, sexta)', rodadaEsperada('receita', brt('2026-11-20', '12:00')) === brt('2026-11-20', '08:30'));
chk('sem nenhuma leitura', saudeDaPonte('dominio', null, AGORA).estado === 'nunca' && textoDaSaude(saudeDaPonte('receita', undefined, AGORA), AGORA) === 'Ainda sem leitura'
  && saudeDaPonte('dominio', 'x', AGORA).estado === 'nunca');
chk('o selo do Painel: em dia, ou quantas atrasadas', igual(seloDasPontes([{ estado: 'ok' }, { estado: 'ok' }]), { texto: 'Em dia', classe: 'st-clear', fora: 0 })
  && seloDasPontes([{ estado: 'ok' }, { estado: 'atrasada' }]).texto === '1 atrasada' && seloDasPontes([{ estado: 'parada' }, { estado: 'nunca' }]).texto === '2 atrasadas'
  && seloDasPontes([{ estado: 'erro' }, { estado: 'ok' }]).classe === 'st-open');
const RODADAS = [
  { id: 'a', recebida_em: '2026-11-19T11:36:00Z', chamadas_mes: 1012 }, { id: 'b', recebida_em: '2026-11-19T14:25:41Z', chamadas_mes: 1097 },
  { id: 'c', recebida_em: '2026-10-30T11:40:00Z', chamadas_mes: 1320 }, { id: 'd', recebida_em: '2026-11-01T02:00:00Z', chamadas_mes: 1400 }];
chk('a rodada mais recente', ultimaRodada(RODADAS).id === 'b' && ultimaRodada([]) === null && ultimaRodada(null) === null);
chk('as consultas do mês: a contagem da última rodada do mês', chamadasDoMes(RODADAS, '2026-11-19') === 1097 && TETO_MES === 1500);
chk('a rodada da noite de 31/10 em Brasília (já 01/11 em UTC) é de outubro', chamadasDoMes(RODADAS, '2026-10-31') === 1400 && chamadasDoMes(RODADAS, '2026-12-01') === null);

console.log('O calendário das consultas da Receita (o mesmo da ponte, ponte/receita/calendario.py):');
// o prazo e o dia da consulta do PGDAS de cada competência, tirados do calendário da ponte em 19/11/2026
const PGDAS = { '2026-01': ['2026-02-20', '2026-02-23'], '2026-02': ['2026-03-20', '2026-03-23'], '2026-03': ['2026-04-20', '2026-04-22'], '2026-04': ['2026-05-20', '2026-05-21'],
  '2026-05': ['2026-06-22', '2026-06-23'], '2026-06': ['2026-07-20', '2026-07-21'], '2026-07': ['2026-08-20', '2026-08-21'], '2026-08': ['2026-09-21', '2026-09-22'],
  '2026-09': ['2026-10-20', '2026-10-21'], '2026-10': ['2026-11-23', '2026-11-24'], '2026-11': ['2026-12-21', '2026-12-22'], '2026-12': ['2027-01-20', '2027-01-21'],
  '2027-01': ['2027-02-22', '2027-02-23'], '2027-02': ['2027-03-22', '2027-03-23'], '2027-03': ['2027-04-20', '2027-04-22'], '2027-04': ['2027-05-20', '2027-05-21'],
  '2027-05': ['2027-06-21', '2027-06-22'], '2027-06': ['2027-07-20', '2027-07-21'], '2027-07': ['2027-08-20', '2027-08-23'], '2027-08': ['2027-09-21', '2027-09-22'],
  '2027-09': ['2027-10-20', '2027-10-21'], '2027-10': ['2027-11-22', '2027-11-23'], '2027-11': ['2027-12-20', '2027-12-21'], '2027-12': ['2028-01-20', '2028-01-21'] };
const erradas = Object.entries(PGDAS).filter(([c, [prazo, consulta]]) => prazoPgdas(c) !== prazo || consultaPgdas(c) !== consulta).map(([c]) => [c, prazoPgdas(c), consultaPgdas(c)]);
chk('o prazo e a consulta do PGDAS de 24 competências, com fim de semana e feriado', erradas.length === 0, erradas);
chk('o feriado de 20/11/2026 (sexta) empurra o prazo pra segunda e a consulta pra terça', prazoPgdas('2026-10') === '2026-11-23' && consultaPgdas('2026-10') === '2026-11-24');
chk('o dia marcado no fim de semana vai pra segunda; o feriado em dia de semana fica', diaDeSemana('2026-12-05') === '2026-12-07' && diaDeSemana('2026-11-01') === '2026-11-02'
  && diaDeSemana('2026-12-25') === '2026-12-25' && diaDeSemana('2026-11-19') === '2026-11-19');
const prox = h => Object.fromEntries(proximasConsultas(h).map(c => [c.chave, c.quando]));
chk('as próximas, em 19/11/2026', igual(prox('2026-11-19'), { autorizacao: '2026-12-01', pgdas: '2026-11-24', caixa_postal: '2026-11-19', situacao_fiscal: '2026-12-07', pagamentos: '2026-11-25' }), prox('2026-11-19'));
chk('no próprio dia marcado, é hoje; no dia seguinte, a do mês que vem', prox('2026-11-25').pagamentos === '2026-11-25' && prox('2026-11-26').pagamentos === '2026-12-25'
  && prox('2026-11-24').pgdas === '2026-11-24' && prox('2026-11-25').pgdas === '2026-12-22');
chk('no sábado, a Caixa Postal é na segunda', prox('2026-11-21').caixa_postal === '2026-11-23');
chk('em dezembro, as de janeiro', igual(prox('2026-12-28'), { autorizacao: '2027-01-01', pgdas: '2027-01-21', caixa_postal: '2026-12-28', situacao_fiscal: '2027-01-05', pagamentos: '2027-01-25' }), prox('2026-12-28'));
chk('as cinco consultas e os cinco blocos do Domínio, com o texto de cada um', CONSULTAS.length === 5 && CONSULTAS.every(c => c.nome && c.traz && c.quando)
  && igual(CONSULTAS.map(c => c.chave), ['autorizacao', 'pgdas', 'caixa_postal', 'situacao_fiscal', 'pagamentos']) && BLOCOS_DO_DOMINIO.length === 5 && BLOCOS_DO_DOMINIO.every(b => b.nome && b.traz));
chk('nenhum texto com travessão ou ponto e vírgula', ![...CONSULTAS, ...BLOCOS_DO_DOMINIO].some(x => /[—;]/.test(x.traz + (x.quando || ''))));

console.log('O último mês fechado:');
let dif = [];
for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2027, 2, 1); t += 864e5) {
  const d = new Date(t).toISOString().slice(0, 10);
  if (ultimoMesFechado(d) !== fechadoDoComparativo(d) || ultimoMesFechado(d) !== fechadoDoFatorR(d)) dif.push(d);
}
chk('a mesma regra do Comparativo e do Fator R, dia a dia, de 01/2026 a 02/2027', dif.length === 0, dif.slice(0, 5));
chk('até o dia 20, o de dois meses atrás; depois, o passado', ultimoMesFechado('2026-11-19') === '2026-09' && ultimoMesFechado('2026-11-20') === '2026-09' && ultimoMesFechado('2026-11-21') === '2026-10'
  && ultimoMesFechado('2026-01-10') === '2025-11' && ultimoMesFechado('x') === null);
chk('em fechamento: o mês de hoje e o passado', emFechamento('2026-11', '2026-11-19') && emFechamento('2026-10', '2026-11-19') && !emFechamento('2026-09', '2026-11-19') && emFechamento('2025-12', '2026-01-05'));

console.log('A carteira de hoje:');
const cli = (id, nome, extra = {}) => ({ id, nome_principal: nome, nome_fantasia: null, documento: '10000000000101', tipo_pessoa: 'PJ', regime_tributario: 'Simples Nacional', status: 'ativo', cidade: 'Três Coroas', uf: 'RS', ...extra });
const CARTEIRA = [
  { cliente_id: 'k1', entrada: '2019-03-01', saida: null, clientes: cli('k1', 'ZETA COMÉRCIO DE TESTE LTDA') },
  { cliente_id: 'k2', entrada: '2020-06-15', saida: '2026-11-30', clientes: cli('k2', 'ÁGUIA SERVIÇOS DE TESTE LTDA', { nome_fantasia: 'Águia', regime_tributario: 'Lucro Presumido' }) },
  { cliente_id: 'k3', entrada: '2021-01-10', saida: '2026-11-19', clientes: cli('k3', 'SAIU HOJE DE TESTE LTDA') },
  { cliente_id: 'k4', entrada: null, saida: null, clientes: cli('k4', 'SEM ENTRADA DE TESTE LTDA') },
  { cliente_id: 'k5', entrada: '2024-05-01', saida: null, clientes: cli('k5', 'FULANO DE TESTE 12345678901', { regime_tributario: 'MEI', documento: '10.000.000/0001-05' }) },
  { cliente_id: 'k6', entrada: '2018-12-01', saida: null, clientes: null },
  { cliente_id: 'k1', entrada: '2019-03-01', saida: null, clientes: cli('k1', 'ZETA COMÉRCIO DE TESTE LTDA') },
  { cliente_id: 'k7', entrada: '2018-12-01', saida: null, clientes: cli('k7', 'ASSOCIAÇÃO DE TESTE', { regime_tributario: 'Imune' }) },
  { cliente_id: 'k8', entrada: '2022-01-01', saida: null, clientes: cli('k8', 'BELTRANO DE TESTE', { tipo_pessoa: 'PF', documento: '123.456.789-01', regime_tributario: 'Isento' }) }
];
const emps = carteiraDeHoje(CARTEIRA, '2026-11-19');
chk('entra quem tem a entrada e não saiu até hoje (a saída de hoje já saiu, a do fim do mês ainda não), sem repetir', igual(emps.map(e => e.id), ['k2', 'k7', 'k8', 'k5', 'k1']), emps.map(e => e.id));
chk('na ordem do nome que a tela mostra (o fantasia primeiro, sem acento, o MEI sem o CPF no fim)', igual(emps.map(e => e.nome), ['Águia', 'ASSOCIAÇÃO DE TESTE', 'BELTRANO DE TESTE', 'FULANO DE TESTE', 'ZETA COMÉRCIO DE TESTE LTDA']), emps.map(e => e.nome));
chk('a busca acha pelo nome, pelo fantasia, pelo CNPJ com e sem pontuação, pelo regime e pela cidade',
  ['aguia servicos', 'aguia', '10000000000101', 'lucro presumido', 'tres coroas'].every(t => emps.find(e => e.id === 'k2').busca.includes(t)) && emps.find(e => e.id === 'k5').busca.includes('10000000000105'));
// a regra de quem a ponte da Receita consulta é a da função ponte: as duas listas têm de bater
const naFuncao = new Set(empresasDaCarteira(CARTEIRA.map(k => ({ cliente_id: k.cliente_id, entrada: k.entrada, saida: k.saida })), CARTEIRA.map(k => k.clientes).filter(Boolean), '2026-11-19').map(e => e.documento));
const naTela = new Set(emps.filter(e => !foraDaConsulta(e)).map(e => e.documento.replace(/[^0-9A-Za-z]/g, '')));
chk('quem a ponte da Receita consulta: a mesma lista da função ponte', igual([...naFuncao].sort(), [...naTela].sort()) && naTela.size === 2, [[...naFuncao], [...naTela]]);
chk('os regimes consultados são os da função', igual([...REGIMES_DA_RECEITA].sort(), Object.keys(REGIME).sort()));
chk('o porquê de quem fica fora', foraDaConsulta(emps.find(e => e.id === 'k7')) === 'Regime Imune: a ponte consulta as empresas do Simples, do MEI, do Presumido e do Real.'
  && foraDaConsulta(emps.find(e => e.id === 'k8')) === 'Pessoa física: a ponte consulta empresas, pelo CNPJ.' && foraDaConsulta({ documento: '', regime: 'MEI' }) === 'Sem CNPJ no cadastro.'
  && foraDaConsulta({ documento: '10000000000101', regime: null }).startsWith('Sem regime no cadastro') && foraDaConsulta(emps.find(e => e.id === 'k1')) === null);

console.log('Os avisos do vigia de cada integração:');
const ACHADOS = [
  { id: 1, regra: 'dominio_notas_paradas', titulo: 'Notas paradas', gravidade: 'media', cliente_id: 'k1', situacao: 'aberto' },
  { id: 2, regra: 'dominio_pgdas_diferente', titulo: 'Faturamento diferente', gravidade: 'alta', cliente_id: 'k1', situacao: 'aberto' },
  { id: 3, regra: 'receita_pendencia', titulo: 'Pendência', gravidade: 'media', cliente_id: 'k1', situacao: 'aberto' },
  { id: 4, regra: 'receita_das_nao_pago', titulo: 'DAS sem pagar', gravidade: 'alta', cliente_id: 'k2', situacao: 'aberto' },
  { id: 5, regra: 'dominio_contabil_parada', titulo: 'Resolvido', gravidade: 'alta', cliente_id: 'k1', situacao: 'resolvido' },
  { id: 6, regra: 'ponte_dominio_parada', titulo: 'Ponte parada', gravidade: 'alta', cliente_id: null, situacao: 'aberto' },
  { id: 7, regra: 'alvara_vencido', titulo: 'Alvará', gravidade: 'alta', cliente_id: 'k1', situacao: 'aberto' }];
const avD = avisosPorCliente(ACHADOS, 'dominio'), avR = avisosPorCliente(ACHADOS, 'receita');
chk('só os abertos da integração, o urgente primeiro', igual(avD.get('k1').map(a => a.id), [2, 1]) && avD.size === 1 && igual(avR.get('k1').map(a => a.id), [3]) && igual(avR.get('k2').map(a => a.id), [4]));
chk('sem a ponte parada (não é de uma empresa) nem as regras de outros assuntos', ![...avD.values(), ...avR.values()].flat().some(a => a.id === 6 || a.id === 7 || a.id === 5));

console.log('O Domínio, empresa por empresa:');
const mensal = (cliente, comp, n) => ({ codigo: 400, cliente_id: cliente, competencia: comp, ...n });
const BASE_D = {
  codigos: [{ codigo: 408, cliente_id: 'k1', ativa: true }, { codigo: 12, cliente_id: 'k1', ativa: false }, { codigo: 77, cliente_id: 'k5', ativa: false }, { codigo: 90, cliente_id: 'k2', ativa: true }],
  mensal: [
    mensal('k1', '2026-09', { funcionarios_ativos: 12, pro_labore: 2, notas_saida: 38, notas_entrada: 12, lancamentos: 140, receita_bruta: 84211.5, receita_simples: 84211.5, lanc_normais: 6, lanc_extrato: 0 }),
    { ...mensal('k1', '2026-09', { funcionarios_ativos: 3, notas_saida: 40, receita_bruta: 100 }), codigo: 12 },
    mensal('k1', '2026-10', { funcionarios_ativos: 13, pro_labore: 2, notas_saida: 41, notas_entrada: 9, lancamentos: 60, receita_bruta: 90500, lanc_normais: 0, lanc_extrato: 0 }),
    mensal('k1', '2025-12', { lanc_normais: 0, lanc_extrato: 25, lancamentos: 25 }),
    mensal('k2', '2026-09', { funcionarios_ativos: 0, pro_labore: 0, notas_saida: 0, notas_entrada: 0, lancamentos: 0, receita_bruta: 0, lanc_normais: 0, lanc_extrato: 0 }),
    mensal('k5', '2026-09', { funcionarios_ativos: null, pro_labore: null, notas_saida: 0, notas_entrada: 0, lancamentos: 0, receita_bruta: 0 })],
  achados: ACHADOS };
chk('a lista lê só o que a linha usa', igual(CAMPOS_DA_LISTA, ['funcionarios_ativos', 'pro_labore', 'notas_saida', 'notas_entrada', 'lancamentos', 'receita_bruta', 'receita_simples', 'lanc_normais', 'lanc_extrato']));
chk('os meses que o Domínio tem, o mais novo primeiro', igual(mesesDoDominio(BASE_D.mensal), ['2026-10', '2026-09', '2025-12']));
const LD = linhasDoDominio(emps, BASE_D, '2026-09'), ld = id => LD.find(l => l.id === id);
chk('uma linha por empresa da carteira, na mesma ordem', igual(LD.map(l => l.id), emps.map(e => e.id)));
chk('a empresa com dois códigos: os dois na linha e o maior de cada número', igual(ld('k1').codigos, [12, 408]) && ld('k1').funcionarios === 12 && ld('k1').notasSaida === 40 && ld('k1').faturamento === 84211.5 && ld('k1').ligada && !ld('k1').inativa, ld('k1'));
chk('o contador lançou até o último mês com lançamento digitado ou do extrato', ld('k1').contadorAte === '2026-09' && ld('k1').leuOrigens && ld('k2').contadorAte === null && ld('k2').leuOrigens && ld('k5').leuOrigens === false);
chk('o mês trocado troca os números; o contador segue o mesmo', linhasDoDominio(emps, BASE_D, '2026-10').find(l => l.id === 'k1').funcionarios === 13
  && linhasDoDominio(emps, BASE_D, '2026-10').find(l => l.id === 'k1').contadorAte === '2026-09');
chk('sem a linha do mês: tudo vazio (o Domínio não disse), e conta como sem movimento', ld('k1') && linhasDoDominio(emps, BASE_D, '2026-08').find(l => l.id === 'k1').funcionarios === null
  && linhasDoDominio(emps, BASE_D, '2026-08').find(l => l.id === 'k1').semMovimento === true);
chk('o zero é zero e o vazio é vazio', ld('k2').funcionarios === 0 && ld('k2').faturamento === 0 && ld('k5').funcionarios === null && ld('k5').notasSaida === 0);
chk('sem ligação: a que não tem código no Domínio', !ld('k7').ligada && ld('k7').codigos.length === 0 && ld('k7').funcionarios === null && ld('k7').semMovimento === false);
chk('inativa lá: todos os códigos inativos', ld('k5').inativa && !ld('k2').inativa);
chk('os avisos do vigia entram na linha', igual(ld('k1').avisos.map(a => a.id), [2, 1]) && ld('k2').avisos.length === 0);
chk('os focos de cada linha', igual([...focosDominio(ld('k1'))], ['todas', 'funcionarios', 'avisos']) && igual([...focosDominio(ld('k2'))], ['todas', 'sem_movimento'])
  && igual([...focosDominio(ld('k5'))], ['todas', 'sem_ligacao']) && igual([...focosDominio(ld('k7'))], ['todas', 'sem_ligacao']), [...focosDominio(ld('k5'))]);
chk('os números do alto', igual(contarFocos(LD, focosDominio, FOCOS_DOMINIO), { todas: 5, funcionarios: 1, sem_movimento: 1, avisos: 1, sem_ligacao: 3 }), contarFocos(LD, focosDominio, FOCOS_DOMINIO));
chk('a busca: pelo nome sem acento, pelo código do Domínio e por dois termos', igual(filtrar(LD, focosDominio, 'todas', 'aguia').map(l => l.id), ['k2']) && igual(filtrar(LD, focosDominio, 'todas', '408').map(l => l.id), ['k1'])
  && igual(filtrar(LD, focosDominio, 'todas', 'teste mei').map(l => l.id), ['k5']) && filtrar(LD, focosDominio, 'funcionarios', 'aguia').length === 0 && filtrar(LD, focosDominio, 'todas', '  ').length === 5);

console.log('A ordem da lista:');
chk('o primeiro clique: o nome de A a Z, os números do maior pro menor', igual(proximaOrdem(null, 'nome'), { coluna: 'nome', sentido: 'asc' }) && igual(proximaOrdem({ coluna: 'nome', sentido: 'asc' }, 'funcionarios'), { coluna: 'funcionarios', sentido: 'desc' })
  && igual(proximaOrdem({ coluna: 'funcionarios', sentido: 'desc' }, 'funcionarios'), { coluna: 'funcionarios', sentido: 'asc' }) && proximaOrdem(null, 'contador').sentido === 'asc' && proximaOrdem(null, 'procuracao').sentido === 'asc');
chk('pelos funcionários: quem não tem o número fica no fim nos dois sentidos', igual(ordenar(LD, 'dominio', { coluna: 'funcionarios', sentido: 'desc' }).map(l => l.id), ['k1', 'k2', 'k7', 'k8', 'k5'])
  && igual(ordenar(LD, 'dominio', { coluna: 'funcionarios', sentido: 'asc' }).map(l => l.id), ['k2', 'k1', 'k7', 'k8', 'k5']), ordenar(LD, 'dominio', { coluna: 'funcionarios', sentido: 'asc' }).map(l => l.id));
chk('o empate vai pelo nome', igual(ordenar(LD, 'dominio', { coluna: 'notas', sentido: 'desc' }).map(l => l.id), ['k1', 'k2', 'k5', 'k7', 'k8']), ordenar(LD, 'dominio', { coluna: 'notas', sentido: 'desc' }).map(l => l.id));
chk('pelo nome, nos dois sentidos, e a coluna que não existe vai pelo nome', igual(ordenar(LD, 'dominio', { coluna: 'nome', sentido: 'desc' }).map(l => l.id), ['k1', 'k5', 'k8', 'k7', 'k2'])
  && igual(ordenar(LD, 'dominio', { coluna: 'xyz', sentido: 'asc' }).map(l => l.id), emps.map(e => e.id)) && igual(ordenar(LD, 'dominio', null).map(l => l.id), emps.map(e => e.id)));
chk('as colunas de cada lista', igual(Object.keys(COLUNAS.dominio), ['nome', 'funcionarios', 'faturamento', 'notas', 'contador']) && igual(Object.keys(COLUNAS.receita), ['nome', 'procuracao', 'pendencias', 'pgdas', 'mensagens', 'guias']));

console.log('A Receita, empresa por empresa:');
const HOJE = '2026-11-19';
chk('a procuração em palavras', procuracaoDe({ autorizacao: 'ativa', autorizacao_ate: '2027-03-31' }, null, HOJE).texto === 'ativa até 31/03/2027'
  && procuracaoDe({ autorizacao: 'ativa' }, null, HOJE).texto === 'ativa' && procuracaoDe({ autorizacao: 'sem' }, null, HOJE).estado === 'sem'
  && procuracaoDe(null, null, HOJE).estado === 'nao_consultada' && procuracaoDe({ autorizacao: null }, null, HOJE).estado === 'nao_consultada' && procuracaoDe({ autorizacao: 'outra' }, null, HOJE).estado === 'nao_consultada');
chk('vencendo em até 30 dias, com os dias', igual(procuracaoDe({ autorizacao: 'ativa', autorizacao_ate: '2026-12-19' }, null, HOJE), { estado: 'vencendo', texto: 'vence em 30 dias', ate: '2026-12-19', dias: 30, via: null })
  && procuracaoDe({ autorizacao: 'ativa', autorizacao_ate: '2026-12-20' }, null, HOJE).estado === 'ativa' && procuracaoDe({ autorizacao: 'ativa', autorizacao_ate: '2026-11-20' }, null, HOJE).texto === 'vence em 1 dia'
  && procuracaoDe({ autorizacao: 'ativa', autorizacao_ate: HOJE }, null, HOJE).texto === 'vence hoje');
chk('a ativa com a data passada é vencida (como no vigia)', procuracaoDe({ autorizacao: 'ativa', autorizacao_ate: '2026-11-18' }, null, HOJE).texto === 'vencida em 18/11/2026'
  && procuracaoDe({ autorizacao: 'vencida' }, null, HOJE).texto === 'vencida');
chk('fora da consulta, com o porquê', igual(procuracaoDe({ autorizacao: 'ativa' }, 'Pessoa física.', HOJE), { estado: 'fora', texto: 'fora da consulta', porque: 'Pessoa física.' }));
// de quem é a procuração (a coluna autorizacao_via, que a ponte 0.4.4 manda): a do CNPJ do escritório ou a do CPF do Diego
chk('de quem é a procuração: a do escritório, a do procurador e a que a ponte ainda não disse',
  procuracaoDe({ autorizacao: 'ativa', autorizacao_ate: '2027-03-31', autorizacao_via: 'procurador' }, null, HOJE).via === 'procurador'
  && procuracaoDe({ autorizacao: 'ativa', autorizacao_ate: '2026-12-01', autorizacao_via: 'escritorio' }, null, HOJE).via === 'escritorio'
  && procuracaoDe({ autorizacao: 'vencida', autorizacao_ate: '2026-10-31', autorizacao_via: 'procurador' }, null, HOJE).via === 'procurador'
  && procuracaoDe({ autorizacao: 'ativa', autorizacao_ate: '2027-03-31' }, null, HOJE).via === null
  && procuracaoDe({ autorizacao: 'ativa', autorizacao_via: 'toString' }, null, HOJE).via === null && procuracaoDe({ autorizacao: 'ativa', autorizacao_via: 'outra' }, null, HOJE).via === null);
chk('sem procuração, sem consulta e fora da consulta não têm de quem', !('via' in procuracaoDe({ autorizacao: 'sem', autorizacao_via: 'procurador' }, null, HOJE))
  && !('via' in procuracaoDe(null, null, HOJE)) && !('via' in procuracaoDe({ autorizacao: 'ativa', autorizacao_via: 'procurador' }, 'Pessoa física.', HOJE)));
chk('os nomes das duas', DE_QUEM.escritorio === 'pro CNPJ do escritório' && DE_QUEM.procurador === 'pro CPF do Diego' && Object.keys(DE_QUEM).length === 2);
chk('quantas de cada, só das que têm procuração hoje (ativa ou vencendo)', igual(procuracoesPorVia([
  { procuracao: { estado: 'ativa', via: 'procurador' } }, { procuracao: { estado: 'vencendo', via: 'procurador' } }, { procuracao: { estado: 'ativa', via: 'escritorio' } },
  { procuracao: { estado: 'ativa', via: null } }, { procuracao: { estado: 'vencida', via: 'escritorio' } }, { procuracao: { estado: 'sem' } }, { procuracao: { estado: 'fora' } }, null, {}]),
  { escritorio: 1, procurador: 2, semDizer: 1 }) && igual(procuracoesPorVia(null), { escritorio: 0, procurador: 0, semDizer: 0 }));

const guia = (cliente, n, tipo, pa, pago, extra = {}) => ({ cliente_id: cliente, numero_documento: n, tipo_codigo: tipo === 'DAS' ? '9' : tipo === 'DARF' ? '4' : '10', tipo, periodo_apuracao: pa, arrecadado_em: pago,
  vencimento: extra.vencimento || pago, receita_codigo: tipo === 'DAS' ? '3333' : '1410', receita: null, referencia: null, valor_total: 100, valor_principal: 100, valor_multa: 0, valor_juros: 0, saldo_total: 0, partes: [], ...extra });
const GUIAS = [
  guia('k1', '07202600000001', 'DAS', '2026-08-01', '2026-09-21'),
  guia('k1', '07202600000002', 'DAS', '2026-09-01', '2026-11-12', { vencimento: '2026-10-20', valor_total: 1250.4, valor_principal: 1200, valor_multa: 40.4, valor_juros: 10,
    partes: [{ receita_codigo: '1001', receita: 'IRPJ - Simples Nacional', principal: 300 }, { receita_codigo: '1002', receita: 'CSLL - Simples Nacional' }, { receita_codigo: '1001-1', receita: 'IRPJ - Simples Nacional' }] }),
  guia('k1', '07202600000003', 'DAS', '2026-07-31', '2026-08-25', { referencia: '1234567', receita_codigo: '1734', partes: [{ receita: 'R D Ativa - IRPJ - Simples Nacional' }] }),
  guia('k1', '07202600000004', 'DARF', '2026-09-30', '2026-10-20', { valor_total: 800, valor_principal: 800 }),
  guia('k1', '07202500000005', 'DARF', '2025-10-31', '2025-11-10'),
  guia('k1', '07202600000006', 'DAE', '2026-09-30', '2026-10-07', { tipo: 'DAE' })];
const DAS_DO_MES = { tipo_codigo: 9, referencia: '', periodo_apuracao: '2026-09-01', vencimento: '2026-10-20' };
chk('o DAS do mês: o do PGDAS e o do MEI; fora o de dívida ativa (com a referência) e o DARF', ehDasDoMes(GUIAS[0]) && ehDasDoMes(GUIAS[1]) && !ehDasDoMes(GUIAS[2]) && !ehDasDoMes(GUIAS[3]) && !ehDasDoMes(null)
  && !ehDasDoMes({ ...DAS_DO_MES, partes: [{ receita: 'R D Ativa - CSLL - Simples Nacional' }] }) && !ehDasDoMes({ ...DAS_DO_MES, partes: [{ receita: 'TJLP IRPJ - Parcelamento' }] })
  && !ehDasDoMes({ ...DAS_DO_MES, referencia: ' 123 ' }) && ehDasDoMes(DAS_DO_MES) && ehDasDoMes({ ...DAS_DO_MES, referencia: '  ', vencimento: '2026-12-21' }));
chk('as guias do DAS por mês de apuração', igual([...dasPorMes(GUIAS).keys()].sort(), ['2026-08', '2026-09']) && dasPorMes(GUIAS).get('2026-09')[0].numero_documento === '07202600000002');
// a parcela de um parcelamento (como vem nos pagamentos lidos em 19/11/2026): o período no último dia do mês da parcela, o
// vencimento dentro dele e, nas partes, os meses antigos que ela amortiza. Não é o DAS do mês em que vence
const PARCELA = guia('k1', '07202600000011', 'DAS', '2026-06-30', '2026-06-29', { vencimento: '2026-06-30', valor_total: 583.66, valor_principal: 437.58, valor_multa: 87.51, valor_juros: 58.57,
  partes: [{ receita: 'IRPJ - Simples Nacional', periodo_apuracao: '2024-03-01', valor_total: 300 }, { receita: 'INSS - Simples Nacional', periodo_apuracao: '2024-04-01', valor_total: 283.66 }] });
// uma guia só pagando três meses atrasados: o período da guia é o do mês mais novo, e cada parte diz o mês dela
const VARIOS = guia('k1', '07202600000012', 'DAS', '2026-04-01', '2026-06-19', { vencimento: '2026-05-20', valor_total: 900.3,
  partes: [{ receita: 'IRPJ - Simples Nacional', periodo_apuracao: '2026-02-01', valor_total: 100.1 }, { receita: 'INSS - Simples Nacional', periodo_apuracao: '2026-02-01', valor_total: 200.1 },
    { receita: 'IRPJ - Simples Nacional', periodo_apuracao: '2026-03-01', principal: 250, multa: 40, juros: 10.05 }, { receita: 'IRPJ - Simples Nacional', periodo_apuracao: '2026-04-01', valor_total: 300.05 },
    { receita: 'INSS - Simples Nacional', valor_total: 0 }, null] });
chk('a parcela de parcelamento vence dentro do próprio mês: não é o DAS daquele mês, e não paga mês nenhum', ehParcelaDoSimples(PARCELA) && !ehDasDoMes(PARCELA) && mesesDoDas(PARCELA).length === 0
  && valorNoMes(PARCELA, '2026-06') === 0 && !dasPorMes([PARCELA]).size && ehParcelaDoSimples({ ...PARCELA, arrecadado_em: '2026-11-10' }) && ehParcelaDoSimples({ ...PARCELA, vencimento: '2026-05-29' }));
chk('o DAS do mês, o de dívida ativa (com a referência), o DARF e a guia sem o período ou sem o vencimento não são parcela', !ehParcelaDoSimples(GUIAS[0]) && !ehParcelaDoSimples(GUIAS[1])
  && !ehParcelaDoSimples(GUIAS[2]) && !ehParcelaDoSimples(GUIAS[3]) && !ehParcelaDoSimples(null) && !ehParcelaDoSimples({ tipo_codigo: '9' })
  && !ehParcelaDoSimples({ ...PARCELA, vencimento: null }) && !ehParcelaDoSimples({ ...PARCELA, periodo_apuracao: null }));
chk('sem o período ou sem o vencimento não dá pra dizer: a guia não conta como o DAS de um mês', !ehDasDoMes({ tipo_codigo: 9, referencia: '' }) && !ehDasDoMes({ ...DAS_DO_MES, vencimento: null })
  && !ehDasDoMes({ ...DAS_DO_MES, periodo_apuracao: 'x' }) && !ehDasDoMes({ ...DAS_DO_MES, vencimento: '2026-09-30' }));
chk('quem separa é o vencimento, não o dia do período (o DAS de um mês nunca vence dentro dele)', ehDasDoMes({ ...DAS_DO_MES, periodo_apuracao: '2026-09-30' }) && ehParcelaDoSimples({ ...DAS_DO_MES, vencimento: '2026-09-30' }));
chk('a guia de vários meses paga os meses das partes (a parte sem o período fica no mês da guia)', ehDasDoMes(VARIOS) && igual(mesesDoDas(VARIOS), ['2026-02', '2026-03', '2026-04'])
  && igual([...dasPorMes([VARIOS, PARCELA]).keys()].sort(), ['2026-02', '2026-03', '2026-04']) && dasPorMes([VARIOS]).get('2026-03')[0] === VARIOS, mesesDoDas(VARIOS));
chk('e o valor de cada mês é a soma das partes dele, em centavos (sem o total da parte, o principal, a multa e os juros)', valorNoMes(VARIOS, '2026-02') === 300.2 && valorNoMes(VARIOS, '2026-03') === 300.05
  && valorNoMes(VARIOS, '2026-04') === 300.05 && valorNoMes(VARIOS, '2026-05') === 0, [valorNoMes(VARIOS, '2026-02'), valorNoMes(VARIOS, '2026-03'), valorNoMes(VARIOS, '2026-04')]);
chk('na guia de um mês só, o valor é o total dela (com as partes ou sem elas)', valorNoMes(GUIAS[1], '2026-09') === 1250.4 && valorNoMes(GUIAS[0], '2026-08') === 100 && igual(mesesDoDas(GUIAS[0]), ['2026-08'])
  && valorNoMes(GUIAS[1], '2026-08') === 0 && valorNoMes(GUIAS[3], '2026-09') === 0);
const PG = [
  { cliente_id: 'k1', competencia: '2026-06', transmitida_em: '2026-07-15T13:00:00Z', das_pago: false },
  { cliente_id: 'k1', competencia: '2026-08', transmitida_em: '2026-09-15T13:00:00Z', das_pago: true, receita_mes: null, receita_12_meses: null },
  { cliente_id: 'k1', competencia: '2026-09', transmitida_em: '2026-10-18T13:02:00Z', das_pago: false, receita_mes: 84211.5, receita_12_meses: 912000 }];
chk('o DAS sem pagamento: a Receita mostra sem pagar e não há guia do DAS daquele mês (a paga depois da consulta não conta)', igual(mesesSemPagamento(PG, GUIAS), ['2026-06']) && igual(mesesSemPagamento(PG, []), ['2026-06', '2026-09'])
  && mesesSemPagamento([{ competencia: '2026-05', transmitida_em: null, das_pago: false }], []).length === 0);
const PG2 = ['2026-02', '2026-03', '2026-04', '2026-06'].map(c => ({ cliente_id: 'k1', competencia: c, transmitida_em: c + '-28T13:00:00Z', das_pago: false }));
chk('a parcela paga em junho não tira junho do DAS sem pagamento; a guia de vários meses tira os três', igual(mesesSemPagamento(PG2, [PARCELA, VARIOS]), ['2026-06'])
  && igual(mesesSemPagamento(PG2, [PARCELA]), ['2026-02', '2026-03', '2026-04', '2026-06']));
chk('sem as partes (a leitura leve da lista), a guia de vários meses só tira o mês dela: por isso a lista lê as partes de quem tem DAS sem pagar',
  igual(mesesSemPagamento(PG2, [{ ...VARIOS, partes: undefined }]), ['2026-02', '2026-03', '2026-06']) && igual(comDasSemPagar(PG2.concat(PG)), ['k1'])
  && igual(comDasSemPagar([{ cliente_id: 'k2', competencia: '2026-09', transmitida_em: '2026-10-10T12:00:00Z', das_pago: true }, { cliente_id: 'k3', competencia: '2026-09', transmitida_em: null, das_pago: false }, null]), [])
  && comDasSemPagar(null).length === 0);
const MSGS = [
  { cliente_id: 'k1', assunto: 'Termo de Exclusão do Simples Nacional', enviada_em: '2026-10-20', origem: 'Estado', lida: false, recebida_em: '2026-10-21T12:00:00Z' },
  { cliente_id: 'k1', assunto: 'Antiga não lida', enviada_em: '2026-08-01', origem: 'Receita', lida: false, recebida_em: '2026-08-02T12:00:00Z' },
  { cliente_id: 'k1', assunto: 'Lida', enviada_em: '2026-11-10', origem: 'Receita', lida: true, recebida_em: '2026-11-11T12:00:00Z' },
  { cliente_id: 'k1', assunto: 'Sem a data da Receita', enviada_em: null, origem: 'Receita', lida: false, recebida_em: '2026-11-18T12:00:00Z' }];
chk('as não lidas dos últimos 90 dias (sem a data da Receita, a da chegada)', igual(naoLidasRecentes(MSGS, HOJE).map(m => m.assunto), ['Termo de Exclusão do Simples Nacional', 'Sem a data da Receita']));
const BASE_R = {
  empresas: [
    { cliente_id: 'k1', autorizacao: 'ativa', autorizacao_ate: '2027-03-31', pendencias: [{ orgao: 'Receita', titulo: 'Débito (SIEF)' }, { orgao: 'PGFN', titulo: 'Inscrição' }], situacao_fiscal_em: '2026-11-05', pagamentos_desde: '2025-01-01', pagamentos_ate: '2026-11-18' },
    { cliente_id: 'k2', autorizacao: 'sem', autorizacao_ate: null, pendencias: null, situacao_fiscal_em: null, pagamentos_ate: null },
    { cliente_id: 'k5', autorizacao: 'ativa', autorizacao_ate: '2026-12-01', pendencias: [], situacao_fiscal_em: '2026-11-05', pagamentos_desde: '2025-01-01', pagamentos_ate: '2026-11-18' }],
  pgdas: PG, mensagens: MSGS, guias: GUIAS, achados: ACHADOS };
const LR = linhasDaReceita(emps, BASE_R, HOJE), lr = id => LR.find(l => l.id === id);
chk('a empresa consultada: a procuração, as pendências, o PGDAS, as mensagens e as guias', lr('k1').procuracao.texto === 'ativa até 31/03/2027' && lr('k1').pendencias === 2 && lr('k1').situacaoEm === '2026-11-05'
  && lr('k1').simples && lr('k1').pgdasAte === '2026-09' && igual(lr('k1').semPagamento, ['2026-06']) && lr('k1').naoLidas === 2 && lr('k1').guias12 === 5 && lr('k1').ultimaGuia === '2026-11-12', lr('k1'));
chk('a guia de mais de 12 meses atrás fica fora da contagem', lr('k1').guias12 === GUIAS.length - 1);
chk('sem procuração: nada consultado fica vazio (não zero)', lr('k2').procuracao.estado === 'sem' && lr('k2').pendencias === null && lr('k2').guias12 === null && lr('k2').naoLidas === null && lr('k2').pgdasAte === null && !lr('k2').simples);
chk('o MEI com a procuração vencendo e sem pendência: a Caixa Postal consultada e vazia é zero', lr('k5').procuracao.texto === 'vence em 12 dias' && lr('k5').pendencias === 0 && lr('k5').guias12 === 0 && lr('k5').naoLidas === 0 && !lr('k5').simples);
chk('fora da consulta: a imune e a pessoa física', lr('k7').procuracao.estado === 'fora' && lr('k8').procuracao.estado === 'fora' && lr('k7').pendencias === null && lr('k7').naoLidas === null);
chk('a que devia ser consultada e ainda não foi', lr('k1').fora === null && linhaReceita(emps.find(e => e.id === 'k1'), {}, HOJE).procuracao.estado === 'nao_consultada');
chk('os focos de cada linha', igual([...focosReceita(lr('k1'))], ['todas', 'pendencias', 'das', 'mensagens']) && igual([...focosReceita(lr('k2'))], ['todas', 'sem_procuracao'])
  && igual([...focosReceita(lr('k5'))], ['todas', 'sem_procuracao']) && igual([...focosReceita(lr('k7'))], ['todas', 'fora']));
chk('os números do alto', igual(contarFocos(LR, focosReceita, FOCOS_RECEITA), { todas: 5, pendencias: 1, das: 1, mensagens: 1, sem_procuracao: 2, fora: 2 }), contarFocos(LR, focosReceita, FOCOS_RECEITA));
chk('pela procuração: a vencendo primeiro, depois a sem, a ativa e, no fim, as de fora', igual(ordenar(LR, 'receita', { coluna: 'procuracao', sentido: 'asc' }).map(l => l.id), ['k5', 'k2', 'k1', 'k7', 'k8']),
  ordenar(LR, 'receita', { coluna: 'procuracao', sentido: 'asc' }).map(l => l.id));
chk('pelas pendências e pelas guias: os vazios no fim', igual(ordenar(LR, 'receita', { coluna: 'pendencias', sentido: 'desc' }).map(l => l.id), ['k1', 'k5', 'k2', 'k7', 'k8'])
  && igual(ordenar(LR, 'receita', { coluna: 'guias', sentido: 'desc' }).map(l => l.id), ['k1', 'k5', 'k2', 'k7', 'k8']));

console.log('O perfil no Domínio:');
const porMes = dominioPorMes(BASE_D.mensal.filter(l => l.cliente_id === 'k1'));
let conf = conferenciaDoFaturamento(porMes, PG);
chk('o faturamento do Domínio ao lado do declarado: só os meses com a declaração lida', conf.length === 1 && igual(conf[0], { competencia: '2026-09', dominio: 84211.5, fonte: 'simples', declarado: 84211.5, diferenca: 0, igual: true }), conf);
conf = conferenciaDoFaturamento(porMes, [{ competencia: '2026-10', receita_mes: 90000 }, { competencia: '2026-09', receita_mes: 84212.4 }, { competencia: '2026-07', receita_mes: 10 }, { competencia: '2026-06', receita_mes: null }]);
chk('sem a apuração do Simples, a receita bruta; a diferença em reais; até R$ 1,00 é igual', igual(conf.map(c => [c.competencia, c.fonte, c.diferenca, c.igual]),
  [['2026-10', 'bruta', 500, false], ['2026-09', 'simples', -0.9, true], ['2026-07', null, null, null]]), conf);
const jor = jornadasDoPerfil([
  { jornada: 'COMERCIAL 44H', semana: 'TTTTTT-', min_semana: 2640, horas_semana: 44, empregados: 9, afastados: 1 },
  { jornada: 'ADMINISTRATIVO', semana: 'TTTTTF-', min_semana: 2400, horas_semana: 40, empregados: 3, afastados: 0 },
  { jornada: 'VAZIA', semana: 'TTTTT--', horas_semana: 40, empregados: 0 }]);
chk('a jornada por grupo, o de mais gente primeiro, sem o salário', jor.length === 2 && jor[0].jornada === 'COMERCIAL 44H' && jor[0].horas === 44 && jor[0].empregados === 9 && jor[0].afastados === 1
  && /6x1/.test(jor[0].escala) && /5x2/.test(jor[1].escala) && !('salarios' in jor[0]), jor);

console.log('O perfil na Receita:');
chk('o que a guia pagou: o nome em comum na frente', resumoDasPartes(GUIAS[1].partes) === 'Simples Nacional: IRPJ, CSLL'
  && resumoDasPartes([{ receita: 'ISS - Simples Nacional - MEI' }, { receita: 'INSS - SImples Nacional - MEI' }, { receita: 'ICMS - Simples Nacional - MEI' }]) === 'Simples Nacional - MEI: ISS, INSS, ICMS');
chk('tributos diferentes: os dois primeiros e quantos mais', resumoDasPartes([{ receita: 'Contribuição previdenciária  descontada de segurados' }, { receita: 'IRRF - Rendimento do Trabalho Assalariado' }, { receita: 'Contribuição empresa' }])
  === 'Contribuição previdenciária descontada de segurados · IRRF - Rendimento do Trabalho Assalariado e mais 1' && resumoDasPartes([{ receita: 'PIS - Faturamento' }]) === 'PIS - Faturamento'
  && resumoDasPartes([]) === '' && resumoDasPartes(null) === '' && resumoDasPartes([{ receita: null }, null]) === '');
const gp = guiasDoPerfil(GUIAS.concat([{ numero_documento: 'sem-dia', arrecadado_em: null }]));
chk('as guias, a mais recente primeiro, sem a que não tem o dia do pagamento', igual(gp.map(g => g.numero.slice(-1)), ['2', '4', '6', '1', '3', '5']), gp.map(g => g.numero));
chk('a guia paga depois do vencimento: os dias de atraso, a multa e os juros', gp[0].atraso === 23 && gp[0].multa === 40.4 && gp[0].juros === 10 && gp[0].total === 1250.4 && gp[0].mes === '2026-09'
  && gp[0].resumo === 'Simples Nacional: IRPJ, CSLL' && gp[0].das === true && gp[1].atraso === 0, gp[0]);
{
  const g2 = guiasDoPerfil([PARCELA, VARIOS, GUIAS[1], GUIAS[3]]), de = n => g2.find(g => g.numero === n);
  chk('cada guia diz o que é: o DAS de um mês, o de vários meses e a parcela de parcelamento', de('07202600000011').parcela === true && de('07202600000011').das === false && de('07202600000011').meses.length === 0
    && de('07202600000011').mes === '2026-06' && de('07202600000012').das === true && de('07202600000012').parcela === false && igual(de('07202600000012').meses, ['2026-02', '2026-03', '2026-04'])
    && igual(de('07202600000002').meses, ['2026-09']) && de('07202600000002').parcela === false && de('07202600000004').das === false && de('07202600000004').parcela === false && de('07202600000004').meses.length === 0, g2);
}
chk('o filtro por tipo: DAS, DARF e o resto junto', igual(gp.map(tipoDoFiltro), ['DAS', 'DARF', 'outras', 'DAS', 'DAS', 'DARF']));
chk('as somas, em centavos', igual(totaisDasGuias(gp), { n: 6, total: 2450.4, multa: 40.4, juros: 10, comAtraso: 1 }) && igual(totaisDasGuias([]), { n: 0, total: 0, multa: 0, juros: 0, comAtraso: 0 })
  && totaisDasGuias([{ total: 0.1 }, { total: 0.2 }]).total === 0.3, totaisDasGuias(gp));
chk('os anos com guia, o mais novo primeiro', igual(anosDasGuias(gp), ['2026', '2025']));
const pp = pgdasDoPerfil(PG, GUIAS);
chk('o PGDAS do mais novo pro mais antigo, com o buraco do meio marcado', igual(pp.map(p => [p.competencia, p.falta]), [['2026-09', false], ['2026-08', false], ['2026-07', true], ['2026-06', false]]), pp.map(p => [p.competencia, p.falta]));
chk('em cada mês, a declaração, o DAS e as guias pagas daquele mês', pp[0].transmitidaEm === '2026-10-18' && pp[0].dasPago === false && pp[0].receitaMes === 84211.5 && pp[0].receita12 === 912000
  && igual(pp[0].guias, [{ pagoEm: '2026-11-12', total: 1250.4, numero: '07202600000002', meses: 1 }]) && pp[1].dasPago === true && pp[1].guias.length === 1 && pp[3].guias.length === 0 && pp[2].dasPago === null, pp[0]);
{
  const p2 = pgdasDoPerfil(PG2, [PARCELA, VARIOS]), de = c => p2.find(m => m.competencia === c);
  chk('a parcela de parcelamento não aparece como o DAS do mês em que foi paga', de('2026-06').dasPago === false && de('2026-06').guias.length === 0);
  chk('a guia de vários meses aparece em cada mês que pagou, com a parte daquele mês e quantos meses ela tem',
    igual(de('2026-02').guias, [{ pagoEm: '2026-06-19', total: 300.2, numero: '07202600000012', meses: 3 }]) && de('2026-03').guias[0].total === 300.05 && de('2026-04').guias[0].total === 300.05
    && de('2026-05').falta === true && de('2026-05').guias.length === 0, de('2026-02'));
}
chk('sem PGDAS, nada', pgdasDoPerfil([], GUIAS).length === 0 && pgdasDoPerfil(null, null).length === 0);
const mp = mensagensDoPerfil(MSGS);
chk('as mensagens, a mais recente primeiro (sem a data da Receita, a da chegada)', igual(mp.map(m => m.quando), ['2026-11-18', '2026-11-10', '2026-10-20', '2026-08-01']) && mp[0].lida === false && mp[1].lida === true && mp[2].origem === 'Estado');

console.log('As leituras da Receita:');
{
  // um banco de mentira que devolve só as colunas pedidas (o do teste de tela devolve a linha inteira): a lista lê as
  // guias sem as partes e, só de quem a Receita mostra com DAS sem pagar, as partes das guias do DAS
  const banco = dados => {
    const pedidos = [];
    const from = tabela => {
      const q = { tabela, cols: [], filtros: [], em: null, eq: [] };
      const api = {
        select(c) { q.cols = String(c).split(',').map(x => x.trim()); return api; },
        in(col, vals) { q.filtros.push(r => vals.includes(r[col])); q.em = vals; return api; },
        eq(col, v) { q.filtros.push(r => r[col] === v); q.eq.push([col, v]); return api; },
        order() { return api; }, limit() { return api; },
        then(res, rej) { pedidos.push(q); return Promise.resolve({ data: (dados[tabela] || []).filter(r => q.filtros.every(f => f(r))).map(r => Object.fromEntries(q.cols.map(c => [c, r[c] === undefined ? null : r[c]]))), error: null }).then(res, rej); }
      };
      return api;
    };
    return { from, todasLinhas: async montar => montar(), pedidos };
  };
  const DAS_K2 = guia('k2', '07202600000031', 'DAS', '2026-09-01', '2026-10-20', { partes: [{ receita: 'IRPJ - Simples Nacional', periodo_apuracao: '2026-09-01', valor_total: 100 }] });
  const DARF_K1 = guia('k1', '07202600000032', 'DARF', '2026-09-30', '2026-10-20', { partes: [{ receita: 'IRRF', periodo_apuracao: '2026-09-30', valor_total: 100 }] });
  const DADOS = {
    receita_empresas: [{ cliente_id: 'k1', autorizacao: 'ativa', autorizacao_ate: '2027-03-31', autorizacao_via: 'procurador', pagamentos_ate: '2026-11-18' }, { cliente_id: 'k2', autorizacao: 'ativa', autorizacao_via: 'escritorio' }],
    receita_pgdas: PG2.concat([{ cliente_id: 'k2', competencia: '2026-09', transmitida_em: '2026-10-10T12:00:00Z', das_pago: true }]),
    receita_mensagens: [], receita_pagamentos: [VARIOS, PARCELA, DAS_K2, DARF_K1], vigia_achados: []
  };
  let sb = banco(DADOS);
  const base = await carregarListaReceita(sb, ['k1', 'k2']);
  const pag = sb.pedidos.filter(q => q.tabela === 'receita_pagamentos'), g = n => base.guias.find(x => x.numero_documento === n);
  chk('a lista lê as guias sem as partes, com o vencimento (que separa o DAS do mês da parcela)', pag.length === 2 && !pag[0].cols.includes('partes') && pag[0].cols.includes('vencimento') && igual(pag[0].em, ['k1', 'k2']), pag.map(q => q.cols));
  chk('e as partes só das guias do DAS de quem tem DAS sem pagar', igual(pag[1].cols, ['cliente_id', 'numero_documento', 'partes']) && igual(pag[1].em, ['k1']) && igual(pag[1].eq, [['tipo_codigo', '9']]), pag[1]);
  chk('as partes entram na guia certa (a do DAS de quem deve), e só nela', Array.isArray(g('07202600000012').partes) && g('07202600000012').partes.length === VARIOS.partes.length
    && Array.isArray(g('07202600000011').partes) && !('partes' in g('07202600000031')) && !('partes' in g('07202600000032')), base.guias.map(x => [x.numero_documento, 'partes' in x]));
  const linhas = linhasDaReceita([{ id: 'k1', nome: 'K1', regime: 'Simples Nacional', documento: '10000000000101', tipo: 'PJ' }, { id: 'k2', nome: 'K2', regime: 'Simples Nacional', documento: '10000000000102', tipo: 'PJ' }], base, HOJE);
  chk('com as partes, a guia de vários meses tira os três meses e a parcela não tira nenhum', igual(linhas[0].semPagamento, ['2026-06']) && linhas[1].semPagamento.length === 0, linhas[0].semPagamento);
  chk('de quem é a procuração vem na leitura da lista', sb.pedidos.find(q => q.tabela === 'receita_empresas').cols.includes('autorizacao_via') && linhas[0].procuracao.via === 'procurador' && linhas[1].procuracao.via === 'escritorio');
  sb = banco({ ...DADOS, receita_pgdas: DADOS.receita_pgdas.filter(p => p.cliente_id === 'k2') });
  await carregarListaReceita(sb, ['k1', 'k2']);
  chk('sem ninguém com DAS sem pagar, as partes nem são pedidas', sb.pedidos.filter(q => q.tabela === 'receita_pagamentos').length === 1);
  sb = banco(DADOS);
  const perfil = await carregarPerfilReceita(sb, 'k1');
  chk('o perfil lê de quem é a procuração e as guias inteiras', sb.pedidos.find(q => q.tabela === 'receita_empresas').cols.includes('autorizacao_via') && perfil.receita.autorizacao_via === 'procurador'
    && sb.pedidos.find(q => q.tabela === 'receita_pagamentos').cols.includes('partes') && perfil.guias.find(x => x.numero === '07202600000011').parcela === true
    && perfil.pgdas.find(m => m.competencia === '2026-06').guias.length === 0, perfil.receita);
}

console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
