// Comparativo tributário — o estudo de uma empresa (assets/js/comparativo-estudo.js): a leitura (o gravado ou os números
// do sistema, as empresas dos mesmos sócios pelo CPF, o CPF que não sai), a conta inteira (a mesma do comparar, o roteiro,
// o que muda, os avisos, o aviso do limite do ano), o resumo gravado e o "e se" do assistente (a receita que leva as
// compras junto, o lucro do Real em % da receita, o ICMS de todas as atividades, as empresas dos sócios fora da soma).
// Rodar com: node tests/comparativo-estudo.test.mjs
import { comparar } from '../assets/js/comparativo-motor.js';
import { PADROES, comPadroes, ORIGENS_PADRAO, CAMPOS, erroSemTabela, entradaDoMotor, carregarEstudo, estudoGravado, contaDoEstudo, situacaoComGrupo,
  oQueMuda, avisosDoEstudo, alertaDoLimite, resumoParaGravar, aplicarESe, E_SE } from '../assets/js/comparativo-estudo.js';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + extra : '')); };
const perto = (a, b, tol = 0.011) => Math.abs(Number(a) - Number(b)) <= tol;
const ALIQ = { cbs: 11.3, cbs_aplicada: 11.2, ibs: 0.1 };

// ---------- um banco de mentira, como a tela e o assistente leem (ler → { data, error }) ----------
const mesesDe = (ini, fim) => Array.from({ length: 12 }, (_, i) => {
  const d = new Date(Date.UTC(2025, 7 + i, 1)); const c = d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');
  return { competencia: c, total: c >= '2026-01' ? fim : ini, saidas: c >= '2026-01' ? fim : ini, servicos: 0, outros: 0 };
});
const RESTAURANTE = { id: 'c5', nome_principal: 'RESTAURANTE EXEMPLO LTDA', nome_fantasia: null, documento: '44444444444444', tipo_pessoa: 'PJ', regime_tributario: 'Simples Nacional', cnae_principal: '5620-1/04', cidade: 'Três Coroas', uf: 'RS' };
const SIM5 = { v: 1, input: { anexo: 'I', receita: 200416.67, pctComprasMercadorias: 45, mixCheia: 8, mixRed40: 92, mixRed60: 0, mixRed30: 0, mixZero: 0, pctReceitaMonofasica: 8 },
  fontes: { mixCheia: 'seções do PGDAS 07/2026: revenda com ST (bebidas) — alíquota cheia por fora', pctExcluidoST: 'do Domínio: PGDAS 2026-07: 14% a menos (receita com ST/monofásico e redução de 40% na base do ICMS)' },
  dominio: { meses: mesesDe(180000, 215000), pgdas: { competencia: '2026-07', aliquotaEfetiva: 9.05, dasTotal: 19457.5 } } };
function banco({ comparativos = [], semTabela = false, socios = null, pgdas = [] } = {}) {
  const T = {
    clientes: [RESTAURANTE, { id: 'c6', nome_principal: 'PADARIA IRMA LTDA', nome_fantasia: null }],
    socios: socios || [{ cliente_id: 'c5', nome: 'FULANO DE TAL', cpf: '111.222.333-44' }, { cliente_id: 'c5', nome: 'BELTRANA DE TAL', cpf: null },
      { cliente_id: 'c6', nome: 'FULANO DE TAL', cpf: '11122233344' }, { cliente_id: 'c7', nome: 'BELTRANA DE TAL', cpf: null }],
    rt_casos: [{ id: 'rc5', cliente_id: 'c5', anexo: 'I', receita_mensal: 200416.67, sim_obs: JSON.stringify(SIM5), atualizado_em: '2026-10-01T12:00:00Z' },
      { id: 'rc6', cliente_id: 'c6', anexo: 'II', receita_mensal: 180416.67, sim_obs: JSON.stringify({ v: 1, input: { anexo: 'II' }, dominio: { meses: mesesDe(160000, 195000) } }), atualizado_em: '2026-10-01T12:00:00Z' }],
    fr_empresas: [], fr_lancamentos: [], receita_pgdas: pgdas, comparativos
  };
  const log = [];
  const ler = async (t, o = {}) => {
    log.push({ t, o: JSON.parse(JSON.stringify(o)) });
    if (t === 'comparativos' && semTabela) return { data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.comparativos' in the schema cache" } };
    let l = (T[t] || []).slice();
    Object.entries(o.eq || {}).forEach(([k, v]) => { l = l.filter(x => x[k] === v); });
    Object.entries(o.em || {}).forEach(([k, v]) => { l = l.filter(x => v.includes(x[k])); });
    return { data: JSON.parse(JSON.stringify(l.slice(0, o.limite || 1e9))), error: null };
  };
  return { ler, log };
}

console.log('A leitura: sem estudo gravado, os números do sistema');
{
  const { ler, log } = banco();
  const est = await carregarEstudo({ ler, cliente: RESTAURANTE });
  chk('sem gravado: sem id, com os padrões nas origens', est.estudoId === null && est.origens.crescimentoReceita === ORIGENS_PADRAO.crescimentoReceita && est.entrada.rat === PADROES.rat);
  chk('a receita do caso da Reforma e a refeição no RS', perto(est.entrada.atividades[0].receita, 2405000, 1) && est.entrada.atividades[0].aliqIcms === 12 && est.origens['atividades.0.receita'].fonte === 'reforma');
  chk('as empresas dos sócios: a do CPF (com pontuação de um lado) e a do nome (sem CPF)', est.entrada.grupo.length === 1 + 0 + (est.entrada.grupo.some(g => g.cliente_id === 'c7') ? 1 : 0)
    && est.entrada.grupo.some(g => g.cliente_id === 'c6' && g.socios.includes('FULANO DE TAL')), JSON.stringify(est.entrada.grupo));
  chk('a sem caso nem PGDAS entra com zero e "falta no sistema" (e sem nome no cadastro)', (() => { const g = est.entrada.grupo.find(x => x.cliente_id === 'c7'); return !g || (g.receita === 0 && g.nome === 'empresa sem cadastro aberto'); })());
  chk('as séries das outras empresas e os sócios contados', est.grupoSeries.some(s => s.cliente_id === 'c6' && s.serie.length === 12) && est.socios === 2);
  chk('as fontes, como a tela mostra', JSON.stringify(est.fontes.map(f => f.txt)) === '["caso da Reforma","sem folha no Fator R","sem PGDAS da Receita"]');
  chk('o CPF casa as empresas e não sai da leitura', !/11122233344|111\.222\.333-44/.test(JSON.stringify(est)));
  chk('o CPF vai à busca só em dígitos; sem CPF, pelo nome', log.some(x => x.t === 'socios' && x.o.em && JSON.stringify(x.o.em.cpf) === '["11122233344"]')
    && log.some(x => x.t === 'socios' && x.o.em && JSON.stringify(x.o.em.nome) === '["BELTRANA DE TAL"]'));
  chk('o nome das outras empresas vem do cadastro (sem a lista da tela, pelo banco)', log.some(x => x.t === 'clientes' && x.o.em && x.o.em.id.includes('c6')) && est.entrada.grupo.find(g => g.cliente_id === 'c6').nome === 'PADARIA IRMA LTDA');
  const { ler: ler2, log: log2 } = banco();
  const est2 = await carregarEstudo({ ler: ler2, cliente: RESTAURANTE, cadastroDe: async ids => new Map(ids.map(id => [id, { id, nome_principal: 'NOME DA TELA ' + id }])) });
  chk('com a lista da tela, sem ler o cadastro de novo', !log2.some(x => x.t === 'clientes') && est2.entrada.grupo.find(g => g.cliente_id === 'c6').nome === 'NOME DA TELA c6');
}

console.log('A leitura: o estudo gravado');
{
  const salvo = { id: 'est1', cliente_id: 'c5', entrada: { v: 1, entrada: { atividades: [{ tipo: 'comercio', receita: 3000000 }], folha: 400000, grupo: [], regimeAtual: 'simples' },
    origens: { folha: { fonte: 'digitado', texto: 'digitado' } }, conferencia: null }, atualizado_em: '2026-11-01T15:00:00Z', atualizado_por: 'financeiro@macedoereis.com.br' };
  const { ler } = banco({ comparativos: [salvo] });
  const est = await carregarEstudo({ ler, cliente: RESTAURANTE });
  chk('o gravado vale: os números dele, com os padrões no que falta', est.estudoId === 'est1' && est.entrada.folha === 400000 && est.entrada.atividades[0].aliqIcms === 17 && est.entrada.rat === 2);
  chk('as origens do gravado, quem e quando', est.origens.folha.fonte === 'digitado' && est.gravadoPor === 'financeiro@macedoereis.com.br' && est.gravadoEm === '2026-11-01T15:00:00Z');
  chk('a equipe tirou a outra empresa da soma: fica tirada (as séries continuam lidas)', est.entrada.grupo.length === 0 && est.grupoSeries.length >= 1);
  chk('o que o sistema sabe hoje fica à mão (o "Recomeçar")', est.sistema && perto(est.sistema.entrada.atividades[0].receita, 2405000, 1));
  const antigo = { ...salvo, entrada: { ...salvo.entrada, entrada: { atividades: [{ tipo: 'comercio', receita: 3000000 }] } } };
  const { ler: l2 } = banco({ comparativos: [antigo] });
  const e2 = await carregarEstudo({ ler: l2, cliente: RESTAURANTE });
  chk('o gravado antes da soma das empresas: entram as que o sistema achou, com a origem', e2.entrada.grupo.some(g => g.cliente_id === 'c6') && e2.origens['grupo.0.receita'] && e2.origens['grupo.0.receita'].fonte);
  const { ler: l3 } = banco({ semTabela: true });
  const e3 = await carregarEstudo({ ler: l3, cliente: RESTAURANTE });
  chk('sem a tabela dos estudos: semTabela e os números do sistema', e3.semTabela === true && e3.estudoId === null && perto(e3.entrada.atividades[0].receita, 2405000, 1));
  chk('erroSemTabela: o código e a mensagem', erroSemTabela({ code: '42P01' }) && erroSemTabela({ message: 'relation "comparativos" does not exist' }) && !erroSemTabela({ code: '23505', message: 'duplicate' }) && !erroSemTabela(null));
  const g = estudoGravado({ id: 'e9', cliente_id: null, nome: 'PROSPECT LTDA', entrada: { v: 1, entrada: { atividades: [{ tipo: 'servico', receita: 900000 }] }, origens: {} }, atualizado_em: '2026-11-01T10:00:00Z', atualizado_por: 'diego@macedoereis.com.br' });
  chk('o estudo de empresa sem cadastro: pelo nome, com os padrões', g.cliente === null && g.nome === 'PROSPECT LTDA' && g.estudoId === 'e9' && g.entrada.atividades[0].aliqIss === 3 && g.socios === null);
}

console.log('A conta');
{
  // sem a empresa do sócio que não tem número nenhum (com ela, o ano não soma — abaixo)
  const SOCIOS = [{ cliente_id: 'c5', nome: 'FULANO DE TAL', cpf: '111.222.333-44' }, { cliente_id: 'c6', nome: 'FULANO DE TAL', cpf: '11122233344' }];
  const { ler } = banco({ socios: SOCIOS });
  const est = await carregarEstudo({ ler, cliente: RESTAURANTE });
  const conta = contaDoEstudo({ ...est, aliq2027: ALIQ, hoje: '2026-11-01' });
  const direto = comparar(entradaDoMotor(est.entrada, ALIQ));
  chk('a mesma conta do comparar (os totais de todos os anos e regimes)', conta.comparacao.anos.every((r, i) => ['simples', 'presumido', 'real'].every(g => r[g].total === direto.anos[i][g].total)));
  chk('entradaDoMotor: os vazios saem e a CBS de 2027 entra', (() => { const e = entradaDoMotor({ cprb: null, pctImpostoEmbutido: null, pctComprasComCredito: 50, atividades: [] }, ALIQ); return !('cprb' in e) && !('pctImpostoEmbutido' in e) && e.pctComprasComCredito === 50 && e.aliq2027 === ALIQ; })());
  chk('o ano-calendário com a outra empresa: passa do limite em dezembro', conta.situacao && conta.situacao.passaEm === 'dezembro' && conta.situacao.saiEm === '01/01/2027');
  chk('situacaoComGrupo: sem a série de uma delas, não soma', situacaoComGrupo(est.serie, [{ cliente_id: 'zz', receita: 1 }], est.grupoSeries) === null);
  chk('o aviso do limite: a conta põe o Simples em 2027, mas o ano de 2026 passa', /passa do limite de R\$ 4,8 milhões em dezembro/.test(conta.limite || '') && /a escolha é entre o Presumido e o Real/.test(conta.limite));
  const semGrupo = contaDoEstudo({ ...est, entrada: { ...est.entrada, grupo: [] }, aliq2027: ALIQ, hoje: '2026-11-01' });
  chk('sem a outra empresa, a receita sozinha não passa: sem aviso', semGrupo.limite === null);
  chk('alertaDoLimite: o ano medido tem de ser o anterior à decisão', alertaDoLimite(conta.comparacao, { ...conta.situacao, ano: 2025 }, est.entrada.grupo) === null);
  chk('o roteiro: provisório, com a soma do limite pra conferir', conta.roteiro.provisorio && conta.roteiro.passos.some(p => p.id === 'limite' && p.peso === 'decide'));
  chk('os prazos pelo dia: sair do Simples até 31/12/2026', conta.prazos.some(p => /31\/12\/2026/.test(p.texto)));
  const muda = conta.muda;
  chk('o que muda: o empate do Real com o Presumido e com o Simples', muda.some(m => /^O Real empata com o Presumido em 2027 com lucro de R\$/.test(m.txt) && !m.alerta) && muda.some(m => /^O Real empata com o Simples em 2027/.test(m.txt)));
  chk('o que muda: a premissa no padrão que vira, em alerta', muda.some(m => m.alerta && /^Com o crédito de ICMS das compras em 17%, o mais barato passa a ser o Lucro Presumido\. O número usado é um padrão — confira\.$/.test(m.txt)), JSON.stringify(muda));
  chk('os avisos: a nota da folha, os do motor e os do ano, sem repetir', conta.avisos.some(a => /^A folha e o pró-labore não estão no sistema/.test(a)) && new Set(conta.avisos).size === conta.avisos.length);
  const comFolha = avisosDoEstudo({ notas: est.notas, entrada: { ...est.entrada, folha: 100000 }, comparacao: conta.comparacao });
  chk('com a folha na conta, a nota de que ela falta sai', !comFolha.some(a => /^A folha e o pró-labore não estão no sistema/.test(a)));
  chk('oQueMuda sem decisão: vazio', oQueMuda(null, []).length === 0);
  const r = resumoParaGravar(conta.comparacao);
  chk('o resumo gravado: o ano, o mais barato e os totais por ano', r.anoDecisao === 2027 && r.melhor === conta.comparacao.decisao.melhor && Object.keys(r.totais).sort().join() === '2027,2028,base'
    && r.totais['2027'].simples === Math.round(conta.comparacao.anos[1].simples.total * 100) / 100);
  const { ler: lc7 } = banco();
  const e7 = await carregarEstudo({ ler: lc7, cliente: RESTAURANTE });
  chk('a empresa do sócio sem número nenhum: o ano não soma (falta a receita dela), e sem o aviso', contaDoEstudo({ ...e7, aliq2027: ALIQ, hoje: '2026-11-01' }).situacao === null
    && contaDoEstudo({ ...e7, aliq2027: ALIQ, hoje: '2026-11-01' }).limite === null);
  const sem = contaDoEstudo({ entrada: comPadroes({ atividades: [{ tipo: 'comercio', receita: 0 }] }), origens: {}, hoje: '2026-11-01' });
  chk('sem receita, a conta não roda: o porquê e o roteiro do que falta', sem.comparacao === null && /receita/.test(sem.erro) && sem.roteiro.passos.some(p => p.id === 'receita' && p.estado === 'falta'));
  chk('os rótulos dos campos, um lugar só', CAMPOS.folha.rotulo === 'Folha (salários, 13º e férias)' && CAMPOS['ativ.redIcmsSimples'].un === '%');
}

console.log('O "e se" do assistente');
{
  const { ler } = banco();
  const est = await carregarEstudo({ ler, cliente: RESTAURANTE });
  const antes = JSON.stringify(est.entrada);
  const r1 = aplicarESe(est.entrada, est.origens, { receita_12_meses: 3000000 }, { aliq2027: ALIQ });
  const f = 3000000 / 2405000;
  chk('a receita nova: as atividades e as compras na mesma proporção', perto(r1.entrada.atividades[0].receita, 3000000, 1) && perto(r1.entrada.compras, est.entrada.compras * f, 0.5));
  chk('o que mudou, com o antes e o depois (as compras acompanham)', r1.mudancas[0].rotulo === 'Receita dos 12 meses' && perto(r1.mudancas[0].antes, 2405000, 1) && r1.mudancas.some(m => /^Compras de mercadorias e insumos \(acompanha a receita\)$/.test(m.rotulo)));
  chk('a entrada do estudo não muda (o e se é uma cópia)', JSON.stringify(est.entrada) === antes);
  chk('o número trocado vira "digitado" (sai dos testes de premissa)', r1.origens['atividades.0.receita'].fonte === 'digitado' && est.origens['atividades.0.receita'].fonte === 'reforma');
  const r2 = aplicarESe(est.entrada, est.origens, { folha_12_meses: 480000, pro_labore_12_meses: 60000, margem_lucro_real: 6 }, { aliq2027: ALIQ });
  const c2 = comparar(entradaDoMotor(r2.entrada, ALIQ));
  const dec = c2.anos.find(a => a.ano === c2.anoDecisao);
  chk('a margem do Real: o lucro antes do IR dá 6% da receita do ano da decisão', perto(dec.real.lucro, 0.06 * dec.receita, 0.01), dec.real.lucro + ' × ' + 0.06 * dec.receita);
  chk('a folha e o pró-labore trocados, e as outras despesas que dão o lucro', r2.entrada.folha === 480000 && r2.entrada.proLabore === 60000 && r2.entrada.outrasDespesas > 0 && r2.mudancas.some(m => /pra o lucro do Real antes do IR dar 6% da receita em 2027/.test(m.rotulo)));
  const r3 = aplicarESe(est.entrada, est.origens, { crescimento_receita: 20, margem_lucro_real: 5 }, { aliq2027: ALIQ });
  const c3 = comparar(entradaDoMotor(r3.entrada, ALIQ)), d3 = c3.anos.find(a => a.ano === c3.anoDecisao);
  chk('com crescimento, a margem vale no ano da decisão (as despesas crescem com a receita)', perto(d3.real.lucro, 0.05 * d3.receita, 0.01));
  const r4 = aplicarESe(est.entrada, est.origens, { margem_lucro_real: 95 }, { aliq2027: ALIQ });
  chk('margem impossível: as outras despesas ficam em zero, com o aviso', r4.entrada.outrasDespesas === 0 && r4.avisos.some(a => /^Nem sem outras despesas o lucro do Real chega a 95%/.test(a)));
  const r5 = aplicarESe(est.entrada, est.origens, { icms_vendas: 17, iss: 5 }, { aliq2027: ALIQ });
  chk('o ICMS das vendas em todas as atividades com ICMS; sem atividade de ISS, o aviso', r5.entrada.atividades.every(a => a.aliqIcms === 17) && r5.avisos.some(a => /não tem atividade com ISS/.test(a))
    && r5.mudancas.some(m => m.rotulo === 'ICMS das vendas' && m.antes === 12 && m.depois === 17));
  const r6 = aplicarESe(est.entrada, est.origens, { sem_empresas_dos_socios: true, regime_atual: 'presumido' }, { aliq2027: ALIQ });
  chk('as empresas dos sócios fora da soma, e o regime de hoje trocado', r6.entrada.grupo.length === 0 && r6.entrada.regimeAtual === 'presumido'
    && r6.mudancas.some(m => /PADARIA IRMA LTDA/.test(m.antes) && m.depois === 'nenhuma') && r6.mudancas.some(m => m.depois === 'Lucro Presumido'));
  const c6 = contaDoEstudo({ ...est, entrada: r6.entrada, origens: r6.origens, aliq2027: ALIQ, hoje: '2026-11-01' });
  chk('sem as empresas dos sócios, sem o aviso do limite; os prazos do Presumido', c6.limite === null && c6.prazos.some(p => /Entrar no Simples/.test(p.titulo)));
  const r7 = aplicarESe(est.entrada, est.origens, { folha_12_meses: 'abc', nada: 3, regime_atual: 'mei' }, { aliq2027: ALIQ });
  chk('o que não é número nem campo conhecido fica de fora', r7.mudancas.length === 0 && r7.entrada.folha === est.entrada.folha);
  chk('os campos do e se têm nome na tela', Object.values(E_SE).every(d => (d.campo ? CAMPOS[d.campo] : d.ativ ? CAMPOS['ativ.' + d.ativ] : d.rotulo)));
}

console.log('A regra da soma (LC 123, art. 3º, §4º, III a V), o que muda com nome e o aviso do limite sozinha');
{
  // a outra empresa do sócio faturou 6 milhões nos 12 meses (não é ME nem EPP)
  const grande = Array.from({ length: 12 }, (_, i) => { const d = new Date(Date.UTC(2025, 9 + i, 1)); return { cliente_id: 'c6', competencia: d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0'), receita_mes: 500000 }; });
  const soc = p => [{ cliente_id: 'c5', nome: 'FULANO DE TAL', cpf: '111.222.333-44' }, { cliente_id: 'c6', nome: 'FULANO DE TAL', cpf: '11122233344', ...p }];
  const { ler, log } = banco({ socios: soc({ participacao_percentual: 5, eh_administrador: false }), pgdas: grande });
  const est = await carregarEstudo({ ler, cliente: RESTAURANTE });
  chk('a leitura pede a participação e o administrador das outras', log.some(x => x.t === 'socios' && x.o.em && /participacao_percentual, eh_administrador/.test(x.o.cols)));
  chk('5% de uma empresa de 6 milhões, sem administrar: fora da soma, com o porquê', !est.entrada.grupo.some(g => g.cliente_id === 'c6') && est.grupoFora.length === 1
    && /não é ME nem EPP/.test(est.grupoFora[0].motivo) && est.notas.some(n => /fica fora da soma do limite/.test(n)), JSON.stringify(est.grupoFora));
  const conta = contaDoEstudo({ ...est, aliq2027: ALIQ, hoje: '2026-11-01' });
  chk('o roteiro diz que ela ficou fora da soma', JSON.stringify(conta.roteiro).includes('fica fora da soma'));
  const { ler: l2 } = banco({ socios: soc({ participacao_percentual: 20, eh_administrador: false }), pgdas: grande });
  chk('com 20%, entra (inciso IV)', (await carregarEstudo({ ler: l2, cliente: RESTAURANTE })).entrada.grupo.some(g => g.cliente_id === 'c6'));
  const { ler: l3 } = banco({ socios: soc({ participacao_percentual: 5, eh_administrador: true }), pgdas: grande });
  chk('com 5%, administrando, entra (inciso V)', (await carregarEstudo({ ler: l3, cliente: RESTAURANTE })).entrada.grupo.some(g => g.cliente_id === 'c6'));
  const { ler: l4 } = banco({ socios: soc({}), pgdas: grande });
  const e4 = await carregarEstudo({ ler: l4, cliente: RESTAURANTE });
  chk('sem a participação no cadastro: entra, com o aviso pra conferir', e4.entrada.grupo.some(g => g.cliente_id === 'c6') && e4.notas.some(n => /participação não está no cadastro/.test(n)));
  const { ler: l5 } = banco({ socios: soc({ participacao_percentual: 5, eh_administrador: false }) });
  chk('a outra ME ou EPP: entra com qualquer participação (inciso III)', (await carregarEstudo({ ler: l5, cliente: RESTAURANTE })).entrada.grupo.some(g => g.cliente_id === 'c6'));
  // o que muda, quando o valor testado tem nome (o RDA)
  const teste = { rotulo: 'o ICMS do restaurante no Presumido e no Real', nomes: { null: 'sem o RDA' }, confira: 'A conta supõe que a empresa pode optar pelo RDA — confira.' };
  const m1 = oQueMuda(null, [{ ...teste, variantes: [{ valor: null, melhor: 'simples' }], melhorBase: 'presumido', muda: true }]);
  chk('o que muda com nome: sem o "em", sem número e com o confira dele', m1.length === 1 && m1[0].alerta && m1[0].txt === 'Com o ICMS do restaurante no Presumido e no Real sem o RDA, o mais barato passa a ser o Simples Nacional. A conta supõe que a empresa pode optar pelo RDA — confira.', m1[0] && m1[0].txt);
  const m2 = oQueMuda(null, [{ ...teste, variantes: [{ valor: null, melhor: 'presumido' }], melhorBase: 'presumido', muda: false }]);
  chk('... e quando não muda', m2.length === 1 && m2[0].txt === 'Não mudam o resultado: o ICMS do restaurante no Presumido e no Real sem o RDA.', m2[0] && m2[0].txt);
  // sozinha, o excesso de até 20%: o aviso do limite diz que a saída é em 01/01 do ano seguinte
  const c = comparar(entradaDoMotor({ atividades: [{ tipo: 'comercio', receita: 4000000 }] }, ALIQ));
  const seis = Array.from({ length: 6 }, (_, i) => ({ competencia: '2026-0' + (i + 1), total: 450000 }));
  const sit = situacaoComGrupo(seis, [], []);
  const av = alertaDoLimite(c, sit, []);
  chk('sozinha, passa em novembro com excesso de até 20%: a saída vale a partir de 01/01/2027', /passa do limite de R\$ 4,8 milhões em novembro/.test(av || '') && /a partir de 01\/01\/2027 e cobre 2027/.test(av || ''), av);
}

console.log('O faturamento solto na tela, gravado com o estudo');
{
  const salvo = { id: 'est2', cliente_id: 'c5', entrada: { v: 1, entrada: { atividades: [{ tipo: 'comercio', receita: 2600000 }], grupo: [] }, origens: { 'atividades.0.receita': { fonte: 'dominio' } }, conferencia: null,
    serieRel: [{ competencia: '2026-08', total: 230000 }, { competencia: '2026-09', total: 240000 }] }, atualizado_em: '2026-11-01T15:00:00Z', atualizado_por: 'financeiro@macedoereis.com.br' };
  const { ler } = banco({ comparativos: [salvo], socios: [] });
  const est = await carregarEstudo({ ler, cliente: RESTAURANTE });
  const ult = est.serie[est.serie.length - 1];
  chk('os meses do relatório entram na série do sistema (o de agosto troca, setembro entra)', ult.competencia === '2026-09' && ult.total === 240000 && est.serie.find(m => m.competencia === '2026-08').total === 230000 && est.serieRel.length === 2);
  const conta = contaDoEstudo({ ...est, aliq2027: ALIQ, hoje: '2026-11-01' });
  const fr = conta.roteiro.fases[0].fontes.find(x => x.id === 'receita');
  chk('com setembro, a receita da fase 1 fica em dia em 01/11', fr.estado === 'tem' && /até set\/26/.test(fr.situacao), fr.situacao);
  const g = estudoGravado({ id: 'e8', nome: 'PROSPECT', entrada: { v: 1, entrada: { atividades: [{ tipo: 'comercio', receita: 1 }] }, serieRel: [{ competencia: '2026-09', total: 1 }] } });
  chk('o estudo sem cadastro volta com a série que foi solta nele', g.serie && g.serie.length === 1 && g.serieRel.length === 1);
}

console.log('\n' + (falhas ? falhas + ' falha(s)' : 'tudo certo'));
process.exit(falhas ? 1 : 0);
