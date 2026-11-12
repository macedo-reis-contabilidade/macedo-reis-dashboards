// Comparativo tributário — o estudo de uma empresa (assets/js/comparativo-estudo.js): a leitura (o gravado ou os números
// do sistema, as empresas dos mesmos sócios pelo CPF, o CPF que não sai), a conta inteira (a mesma do comparar, o roteiro,
// o que muda, os avisos, o aviso do limite do ano), o resumo gravado e o "e se" do assistente (a receita que leva as
// compras junto, o lucro do Real em % da receita, o ICMS de todas as atividades, as empresas dos sócios fora da soma).
// Desde 11/11/2026: qual comparativo (o escolhido ou o que o sistema sugere), o que o cadastro veda no Simples (o documento
// do sócio pessoa jurídica não sai), a contabilidade feita até que mês, a precisão do estudo e o lucro da contabilidade.
// E a versão 5 da ponte do Domínio: o lucro da contabilidade que entra sozinho até o mês do Controle (no estudo novo e no
// gravado sem lucro) e a venda com alíquota zero de PIS/Cofins medida no CST das notas.
// Rodar com: node tests/comparativo-estudo.test.mjs
import { comparar } from '../assets/js/comparativo-motor.js';
import { PADROES, comPadroes, ORIGENS_PADRAO, CAMPOS, erroSemTabela, entradaDoMotor, carregarEstudo, estudoGravado, contaDoEstudo, situacaoComGrupo,
  oQueMuda, avisosDoEstudo, alertaDoLimite, resumoParaGravar, aplicarESe, E_SE, objetivoDoEstudo, opcoesDeObjetivo, alertaDasVedacoes, contabilDoEstudo,
  perguntaDaConfirmacao, pedirConfirmacao, ERRO_AO_PERGUNTAR } from '../assets/js/comparativo-estudo.js';

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
function banco({ comparativos = [], semTabela = false, socios = null, pgdas = [], extras = {} } = {}) {
  const T = {
    clientes: [RESTAURANTE, { id: 'c6', nome_principal: 'PADARIA IRMA LTDA', nome_fantasia: null }],
    socios: socios || [{ cliente_id: 'c5', nome: 'FULANO DE TAL', cpf: '111.222.333-44' }, { cliente_id: 'c5', nome: 'BELTRANA DE TAL', cpf: null },
      { cliente_id: 'c6', nome: 'FULANO DE TAL', cpf: '11122233344' }, { cliente_id: 'c7', nome: 'BELTRANA DE TAL', cpf: null }],
    rt_casos: [{ id: 'rc5', cliente_id: 'c5', anexo: 'I', receita_mensal: 200416.67, sim_obs: JSON.stringify(SIM5), atualizado_em: '2026-10-01T12:00:00Z' },
      { id: 'rc6', cliente_id: 'c6', anexo: 'II', receita_mensal: 180416.67, sim_obs: JSON.stringify({ v: 1, input: { anexo: 'II' }, dominio: { meses: mesesDe(160000, 195000) } }), atualizado_em: '2026-10-01T12:00:00Z' }],
    fr_empresas: [], fr_lancamentos: [], receita_pgdas: pgdas, comparativos, ...extras
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
  chk('as fontes, como a tela mostra', JSON.stringify(est.fontes.map(f => f.txt)) === '["caso da Reforma","sem folha no Fator R","sem PGDAS da Receita","sem o Domínio pela ponte"]', JSON.stringify(est.fontes.map(f => f.txt)));
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
  // o "e se" fica no comparativo da conta de antes (a ferramenta do assistente passa o objetivo dela)
  const c6 = contaDoEstudo({ ...est, entrada: r6.entrada, origens: r6.origens, aliq2027: ALIQ, hoje: '2026-11-01', objetivo: 'todos' });
  chk('sem as empresas dos sócios, sem o aviso do limite; os prazos do Presumido', c6.limite === null && c6.prazos.some(p => /Entrar no Simples/.test(p.titulo)));
  const c6b = contaDoEstudo({ ...est, entrada: r6.entrada, origens: r6.origens, aliq2027: ALIQ, hoje: '2026-11-01' });
  chk('sem dizer o comparativo, o regime de hoje sugere: no Presumido, só o Presumido contra o Real (sem o prazo de entrar no Simples)', c6b.objetivo === 'presumido_real' && !c6b.prazos.some(p => /Simples/.test(p.titulo)));
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
  // 11/11/2026: as notas das empresas dos sócios são do limite do Simples — só o Presumido contra o Real não as mostra
  const doLimite = est.notas.find(n => /fica fora da soma do limite/.test(n));
  const soDois = contaDoEstudo({ ...est, aliq2027: ALIQ, hoje: '2026-11-01', objetivo: 'presumido_real' });
  chk('a nota da soma é só do Simples: com ele na comparação, está nos avisos; só com o Presumido e o Real, não (nem no roteiro)', est.notasSimples.includes(doLimite) && conta.avisos.includes(doLimite)
    && !soDois.avisos.includes(doLimite) && !soDois.avisos.some(a => /mesmos sócios|soma do limite/.test(a)) && !JSON.stringify(soDois.roteiro).includes('fica fora da soma'), soDois.avisos);
  chk('sem a lista das notas do Simples (a tela de antes), as notas seguem todas', contaDoEstudo({ ...est, notasSimples: undefined, aliq2027: ALIQ, hoje: '2026-11-01', objetivo: 'presumido_real' }).avisos.includes(doLimite));
  const { ler: l2 } = banco({ socios: soc({ participacao_percentual: 20, eh_administrador: false }), pgdas: grande });
  chk('com 20%, entra (inciso IV)', (await carregarEstudo({ ler: l2, cliente: RESTAURANTE })).entrada.grupo.some(g => g.cliente_id === 'c6'));
  const { ler: l3 } = banco({ socios: soc({ participacao_percentual: 5, eh_administrador: true }), pgdas: grande });
  chk('com 5%, administrando, entra (inciso V)', (await carregarEstudo({ ler: l3, cliente: RESTAURANTE })).entrada.grupo.some(g => g.cliente_id === 'c6'));
  const { ler: l4 } = banco({ socios: soc({}), pgdas: grande });
  const e4 = await carregarEstudo({ ler: l4, cliente: RESTAURANTE });
  chk('sem a participação no cadastro: entra, com o aviso pra conferir (uma nota só do Simples)', e4.entrada.grupo.some(g => g.cliente_id === 'c6') && e4.notas.some(n => /participação não está no cadastro/.test(n))
    && e4.notasSimples.some(n => /participação não está no cadastro/.test(n)));
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

console.log('O resumo da folha solto na tela, gravado com o estudo (só os totais do mês)');
{
  const folhaRel = [{ competencia: '2026-08', folha_salarios: 10000, prolabore: 5000 }, { competencia: '2026-09', folha_salarios: 10000, prolabore: 5000 }];
  const salvo = { id: 'est4', cliente_id: 'c5', entrada: { v: 1, entrada: { atividades: [{ tipo: 'comercio', receita: 2600000 }], grupo: [], folha: 120000, proLabore: 60000 },
    origens: { folha: { fonte: 'dominio', texto: 'resumo da folha do Domínio de out/25 a set/26' } }, conferencia: null, folhaRel }, atualizado_em: '2026-11-01T15:00:00Z', atualizado_por: 'fiscal@macedoereis.com.br' };
  const { ler } = banco({ comparativos: [salvo], socios: [] });
  const est = await carregarEstudo({ ler, cliente: RESTAURANTE });
  chk('os meses da folha voltam com o estudo, pro próximo resumo se juntar a eles', est.folhaRel && est.folhaRel.length === 2 && est.entrada.folha === 120000 && est.origens.folha.fonte === 'dominio');
  const conta = contaDoEstudo({ ...est, aliq2027: ALIQ, hoje: '2026-11-01' });
  const fF = conta.roteiro.fases[1].fontes.find(x => x.id === 'folha');
  chk('na fase 2, a folha do resumo do Domínio fica "tem"', fF.estado === 'tem' && /relatório do Domínio/.test(fF.situacao), fF);
  const g = estudoGravado({ id: 'e9', nome: 'PROSPECT', entrada: { v: 1, entrada: { atividades: [{ tipo: 'comercio', receita: 1 }] }, folhaRel } });
  chk('o estudo sem cadastro também', g.folhaRel && g.folhaRel.length === 2);
  const novo = await carregarEstudo({ ler: banco({ comparativos: [], socios: [] }).ler, cliente: RESTAURANTE });
  chk('sem estudo gravado, sem meses da folha', novo.folhaRel === null);
}

console.log('Qual comparativo, os impedimentos do Simples, a contabilidade e a precisão (11/11/2026)');
{
  // a indústria do Presumido com uma pessoa jurídica entre os sócios e um CNAE secundário impeditivo; o Domínio pela ponte
  // (12 meses de R$ 50.000, compras de R$ 30.000 e pró-labore de R$ 1.621), a contabilidade feita até julho de 2026
  const IND = { id: 'c8', nome_principal: 'INDUSTRIA DE TESTE LTDA', nome_fantasia: null, documento: '88888888000188', tipo_pessoa: 'PJ', regime_tributario: 'Lucro Presumido', cidade: 'Igrejinha', uf: 'RS',
    cnae_principal: '1091-1/02 - Fabricação de produtos de padaria e confeitaria com predominância de produção própria', cnaes_secundarios: ['4637-1/04 - Comércio atacadista de pães, bolos, biscoitos e similares', '7820-5/00 - Locação de mão-de-obra temporária'], natureza_juridica: '206-2 - Sociedade Empresária Limitada' };
  const mes = i => new Date(Date.UTC(2025, i, 1)).toISOString().slice(0, 7);
  const extras = {
    dominio_mensal: Array.from({ length: 12 }, (_, i) => ({ codigo: 800, cliente_id: 'c8', competencia: mes(9 + i), receita_bruta: 50000, receita_mercadorias: 50000, receita_servicos: 0, receita_simples: null,
      compras: 30000, servicos_tomados: 2000, ativo_e_consumo: 0, salarios: 0, decimo_terceiro: 0, pro_labore_valor: 1621 })),
    receita_empresas: [{ cliente_id: 'c8', pendencias: [{ orgao: 'RFB', titulo: 'Débito em cobrança' }, { orgao: 'PGFN', titulo: 'Inscrição' }], situacao_fiscal_em: '2026-11-03' }],
    contabil_empresas: [{ cliente_id: 'c8', faz: true, inicio: '2025-01', fim: null, responsavel: 'Adaini' }],
    contabil_meses: Array.from({ length: 19 }, (_, i) => ({ cliente_id: 'c8', competencia: mes(i), situacao: 'feita', feita_em: '2026-08-10' })),
    dominio_andamento: [{ cliente_id: 'c8', banco_contas: 2, banco_ate: '2026-06-11', banco_ultimo: '2026-07-31' }]
  };
  // o andamento da contabilidade no Domínio (a versão 3 da ponte): de maio a julho de 2026, uma conta transitória com saldo
  extras.dominio_mensal.forEach(l => { Object.assign(l, { notas_saida: 10, notas_entrada: 5, lanc_fiscal: 15, lanc_folha: 1, folha_lancada: 1621, receita_lancada: 50000, caixa_negativo: 0, contra_natureza: 1,
    transitorias: l.competencia >= '2026-05' ? 1 : 0, transitorias_valor: l.competencia >= '2026-05' ? 9000 : 0 }); });
  const SOC = [{ cliente_id: 'c8', nome: 'SOCIA DE TESTE', cpf: '999.888.777-66', participacao_percentual: 50 }, { cliente_id: 'c8', nome: 'HOLDING INVENTADA LTDA', cpf: '12.345.678/0001-99', participacao_percentual: 50 }];
  const { ler, log } = banco({ socios: SOC, extras });
  const est = await carregarEstudo({ ler, cliente: IND, hoje: '2026-11-11' });
  chk('a leitura pede as pendências na Receita e o Controle das contabilidades', log.some(x => x.t === 'receita_empresas' && x.o.cols === 'pendencias, situacao_fiscal_em' && x.o.eq.cliente_id === 'c8')
    && log.some(x => x.t === 'contabil_empresas' && x.o.cols === 'faz, inicio, fim, responsavel') && log.some(x => x.t === 'contabil_meses' && x.o.eq.cliente_id === 'c8'));
  chk('e o andamento da contabilidade no Domínio: as colunas da versão 3 da ponte e a foto do dia', log.some(x => x.t === 'dominio_mensal' && x.o.eq && x.o.eq.cliente_id === 'c8' && /\btransitorias_valor\b/.test(x.o.cols) && /\bfolha_lancada\b/.test(x.o.cols) && /\breceita_bruta\b/.test(x.o.cols) && /\binss_rat\b/.test(x.o.cols))
    && log.some(x => x.t === 'dominio_andamento' && x.o.eq.cliente_id === 'c8' && /\bbanco_ate\b/.test(x.o.cols)));
  chk('a contabilidade do estudo: quem cuida, a conta de banco mais atrasada e o que o Domínio mostra de cada mês (só o forte)', est.contabil.responsavel === 'Adaini' && est.contabil.bancoAte === '2026-06-11'
    && est.contabil.meses.length === 12 && est.contabil.meses[0].competencia === '2025-10' && est.contabil.meses[0].estado === 'feita' && est.contabil.meses[0].problemas.length === 0
    && JSON.stringify(est.contabil.meses.find(m => m.competencia === '2026-07').problemas) === '[{"tipo":"transitoria","valor":9000}]'
    && est.contabil.meses.find(m => m.competencia === '2026-08').estado === 'afazer', JSON.stringify(est.contabil.meses.map(m => m.competencia + ':' + m.estado + ':' + m.problemas.map(p => p.tipo))));
  const v = est.vedacoes;
  chk('o Simples vedado pelo cadastro: o CNAE secundário e a pessoa jurídica entre os sócios, com a participação', v.vedado && v.impedimentos.length === 2 && v.impedimentos[0].texto === 'CNAE secundário impeditivo: 7820-5/00 (Locação de mão-de-obra temporária)'
    && v.impedimentos[1].texto === 'Pessoa jurídica no quadro de sócios: HOLDING INVENTADA LTDA (50% do capital)' && v.semDado.length === 0 && v.secundarios === 2, JSON.stringify(v.impedimentos));
  chk('as pendências na Receita ficam a conferir', v.conferir.length === 1 && /^O relatório de situação fiscal de 03\/11\/2026 tem 2 pendências/.test(v.conferir[0].texto));
  chk('o documento dos sócios (o CPF e o CNPJ da sócia) não sai da leitura', !/12\.345\.678|12345678000199|999\.888\.777|99988877766/.test(JSON.stringify(est)));
  chk('a contabilidade feita até julho de 2026, e a fonte na lista', est.contabil.faz === true && est.contabil.feitaAte === '2026-07' && est.fontes.some(f => f.ok && f.txt === 'contabilidade feita até jul/26'), JSON.stringify(est.contabil));
  chk('as fontes da empresa do Presumido: sem a falta do que é do Simples (a Reforma, o Fator R e o PGDAS)', JSON.stringify(est.fontes.map(f => f.txt)) === '["Domínio pela ponte (12 meses fechados)","contabilidade feita até jul/26"]', JSON.stringify(est.fontes.map(f => f.txt)));
  chk('os números vieram do Domínio pela ponte', perto(est.entrada.atividades[0].receita, 600000) && est.origens['atividades.0.receita'].fonte === 'ponte' && est.entrada.proLabore === 19452 && est.entrada.lucroContabil === null
    && est.origens.lucroContabil.fonte === 'padrao' && est.entrada.objetivo === undefined);
  const ops = opcoesDeObjetivo(est.entrada.regimeAtual, v);
  // pedido do Samuel, 11/11/2026 (18h25): na empresa do regime geral, o motivo da sugestão é o regime dela; o que o
  // cadastro diz do Simples fica numa linha, só na opção com o Simples
  chk('as duas opções, com a sugerida e o porquê (o regime dela, sem o Simples)', ops.map(o => o.id).join() === 'presumido_real,todos' && ops[0].sugerido && !ops[1].sugerido && ops[0].rotulo === 'Presumido × Real' && ops[1].rotulo === 'Simples × Presumido × Real'
    && ops[0].porque === 'A empresa está no Lucro Presumido: a escolha de todo ano é entre o Presumido e o Real.' && ops[1].porque === '', JSON.stringify(ops));
  chk('o que o cadastro diz do Simples: uma linha, só na opção com ele', ops[0].nota === '' && ops[1].nota === 'Hoje o cadastro veda o Simples pra ela (2 impedimentos): ele entra como simulação.'
    && !/Simples|impediment|vedad/i.test(ops[0].texto + ops[0].porque + ops[0].nota), JSON.stringify(ops));
  const opsS = opcoesDeObjetivo('simples', { vedado: false, impedimentos: [], conferir: [], semDado: [], secundarios: 1, comSocios: true });
  chk('a do Simples sem impedimento: os três, sugerido, com a linha de que nada veda', opsS.find(o => o.sugerido).id === 'todos' && opsS[1].porque === 'A empresa está no Simples Nacional: ficar ou sair é a pergunta.'
    && opsS[1].nota === 'Pelo cadastro, nada veda o Simples.' && opsS[0].nota === '', JSON.stringify(opsS));
  chk('a do Simples vedada: o sugerido são os dois, com o Simples vedado como motivo', opcoesDeObjetivo('simples', v)[0].sugerido && opcoesDeObjetivo('simples', v)[0].porque === 'A empresa está no Simples Nacional e o Simples está vedado pra ela.');
  chk('sem cadastro: a linha diz que os impedimentos não são conferidos', opcoesDeObjetivo(null, null)[1].nota === 'Sem cadastro, o sistema não confere os impedimentos do Simples.' && opcoesDeObjetivo(null, null)[1].sugerido);
  chk('o comparativo do estudo: o pedido, senão o escolhido, senão o sugerido', objetivoDoEstudo(est.entrada, v) === 'presumido_real' && objetivoDoEstudo({ ...est.entrada, objetivo: 'todos' }, v) === 'todos'
    && objetivoDoEstudo({ ...est.entrada, objetivo: 'todos' }, v, 'presumido_real') === 'presumido_real' && objetivoDoEstudo({ regimeAtual: 'simples' }, null) === 'todos' && objetivoDoEstudo({ objetivo: 'constructor', regimeAtual: 'simples' }, null) === 'todos');
  chk('comPadroes: o comparativo inválido que venha do banco volta à pergunta; o válido fica', !('objetivo' in comPadroes({ objetivo: 'constructor', atividades: [] })) && comPadroes({ objetivo: 'todos', atividades: [] }).objetivo === 'todos'
    && PADROES.lucroContabil === null && PADROES.ajustesLalur === 0 && ORIGENS_PADRAO.lucroContabil.fonte === 'padrao' && CAMPOS.lucroContabil.un === 'R$');
  chk('entradaDoMotor: os regimes do comparativo (o pedido, senão o da entrada, senão os três); o lucro vazio sai, o zero fica', entradaDoMotor(est.entrada, ALIQ, 'presumido_real').regimes.join() === 'presumido,real'
    && entradaDoMotor({ ...est.entrada, objetivo: 'presumido_real' }, ALIQ).regimes.join() === 'presumido,real' && entradaDoMotor(est.entrada, ALIQ).regimes.join() === 'simples,presumido,real'
    && !('lucroContabil' in entradaDoMotor({ lucroContabil: null, atividades: [] }, ALIQ)) && !('lucroContabil' in entradaDoMotor({ lucroContabil: '', atividades: [] }, ALIQ)) && entradaDoMotor({ lucroContabil: 0, atividades: [] }, ALIQ).lucroContabil === 0);

  // a conta no caminho sugerido: só o Presumido contra o Real
  const conta = contaDoEstudo({ ...est, aliq2027: ALIQ, hoje: '2026-11-11' });
  const d27 = conta.comparacao.anos[1];
  chk('sem escolha, a conta vai no sugerido: só os dois regimes, o Simples fora da comparação', conta.objetivo === 'presumido_real' && conta.regimes.join() === 'presumido,real' && d27.simples.fora === true && ['presumido', 'real'].includes(d27.melhor));
  chk('sem o Simples: sem o aviso do limite, sem o do vedado, sem o ano-calendário e sem prazo do Simples', conta.limite === null && conta.vedado === null && conta.situacao === null && conta.prazos.length === 1 && conta.prazos[0].titulo === 'Presumido ou Real em 2027');
  chk('as fases do caminho e as vedações de volta', conta.roteiro.fases.map(f => f.id).join() === 'presuncao,lucro,premissas,veredito' && conta.vedacoes === v && conta.roteiro.objetivo === 'presumido_real');
  // IRPJ 15% × 8% × 600.000 = 7.200; CSLL 9% × 12% × 600.000 = 6.480
  chk('o Presumido de 2027: IRPJ e CSLL de R$ 13.680 pela presunção', perto(d27.presumido.irpj + d27.presumido.csll, 13680));
  chk('o que muda abre com a diferença entre os dois (só o IRPJ e a CSLL) e o empate do Real', conta.muda[0].txt === 'Em 2027 o Presumido e o Real só diferem no IRPJ e na CSLL: o PIS/Cofins acaba, e a CBS, o IBS, o ICMS, o ISS e o INSS são iguais nos dois.'
    && /^O Real empata com o Presumido em 2027 com lucro de R\$\s57\.000,00 antes do IR \(9,5% da receita\)/.test(conta.muda[1].txt) && !conta.muda.some(m => /empata com o Simples|Simples Nacional/.test(m.txt)), JSON.stringify(conta.muda));
  const pr = conta.precisao;
  chk('a precisão: provisório, o lucro da contabilidade é o primeiro que falta, e o que veio do Domínio já está na conta (a presunção, pelas notas)', pr.nivel === 'provisorio' && pr.falta[0].id === 'lucro' && pr.falta[0].peso === 'decide'
    && pr.tem.map(x => x.id).join() === 'receita,presuncao,folha,compras' && pr.tem.filter(x => x.id !== 'presuncao').every(x => x.como === 'veio do Domínio pela ponte')
    && pr.tem[1].como === 'apurado pelas notas do Domínio' && !pr.falta.some(x => x.id === 'presuncao'), JSON.stringify(pr));
  // pedido do Samuel, 11/11/2026 (19h12): a atividade e a presunção, o próprio sistema apura pelas notas do Domínio
  chk('a leitura traz o que o sistema apurou da atividade: a divisão das notas, sem presunção própria no CNAE', est.atividade && est.atividade.divisao && est.atividade.divisao.fonte === 'ponte' && est.atividade.divisao.de === '2025-10'
    && est.atividade.divisao.ate === '2026-09' && est.atividade.divisao.mercadorias === 600000 && est.atividade.divisao.servicos === 0 && est.atividade.especial === null && est.atividade.lida === true, JSON.stringify(est.atividade));
  chk('a origem da atividade: pelas notas, sem "confira"', est.origens['atividades.0.tipo'].fonte === 'ponte' && est.origens['atividades.0.tipo'].texto === 'Domínio, pela ponte: toda a receita das notas de out/25 a set/26 é venda de mercadoria');
  const mPres = conta.roteiro.fases[0].missoes.find(m => m.id === 'presuncao');
  chk('a missão da presunção vem cumprida pelas notas, e a fase 1 fecha sem ninguém conferir nada', mPres.estado === 'feita' && mPres.como === 'apurado pelas notas do Domínio' && conta.roteiro.fases[0].concluida
    && /^Nas notas do Domínio de out\/25 a set\/26, toda a receita é venda de mercadoria\. A conta usou: Indústria, 8% no IRPJ e 12% na CSLL sobre R\$\s600\.000\.$/.test(mPres.texto)
    && conta.roteiro.proximo.id === 'lucro', mPres.texto);
  // o estudo gravado antes desta mudança (a origem "pelo CNAE do cadastro — confira o anexo") abre com a origem de hoje
  const antigo = { id: 'e-antigo', cliente_id: 'c8', atualizado_em: '2026-11-11T21:21:00Z', atualizado_por: 'financeiro@macedoereis.com.br',
    entrada: { v: 1, entrada: { ...est.entrada, objetivo: 'presumido_real' }, origens: { ...est.origens, 'atividades.0.tipo': { fonte: 'cadastro', texto: 'pelo CNAE do cadastro (1091-1/02 - Fabricação de produtos de padaria) — confira o anexo' } }, conferencia: null } };
  const gravado = await carregarEstudo({ ler: banco({ comparativos: [antigo], socios: SOC, extras }).ler, cliente: IND, hoje: '2026-11-11' });
  const cGrav = contaDoEstudo({ ...gravado, aliq2027: ALIQ, hoje: '2026-11-11' });
  chk('o estudo gravado com "pelo CNAE — confira": a origem passa a dizer as notas, e a missão vem cumprida', gravado.estudoId === 'e-antigo' && gravado.origens['atividades.0.tipo'].fonte === 'ponte'
    && /toda a receita das notas de out\/25 a set\/26 é venda de mercadoria$/.test(gravado.origens['atividades.0.tipo'].texto) && cGrav.roteiro.fases[0].missoes.find(m => m.id === 'presuncao').estado === 'feita', JSON.stringify(gravado.origens['atividades.0.tipo']));
  // o que a equipe digitou ou conferiu fica; e a atividade trocada no estudo (outra que a do sistema) não ganha a origem de hoje
  const mexe = (o, e = {}) => ({ ...antigo, entrada: { ...antigo.entrada, entrada: { ...antigo.entrada.entrada, ...e }, origens: { ...antigo.entrada.origens, 'atividades.0.tipo': o } } });
  const conferido = await carregarEstudo({ ler: banco({ comparativos: [mexe({ fonte: 'confirmado', texto: 'conferido' })], socios: SOC, extras }).ler, cliente: IND, hoje: '2026-11-11' });
  const trocado = await carregarEstudo({ ler: banco({ comparativos: [mexe({ fonte: 'cadastro', texto: 'pelo CNAE — confira' }, { atividades: [{ ...est.entrada.atividades[0], tipo: 'servico' }] })], socios: SOC, extras }).ler, cliente: IND, hoje: '2026-11-11' });
  chk('o que a equipe conferiu fica como está; a atividade que não é a do sistema não ganha a origem das notas', conferido.origens['atividades.0.tipo'].fonte === 'confirmado' && trocado.origens['atividades.0.tipo'].fonte === 'cadastro'
    && contaDoEstudo({ ...trocado, aliq2027: ALIQ, hoje: '2026-11-11' }).roteiro.fases[0].missoes.find(m => m.id === 'presuncao').estado === 'aberta');
  chk('o estudo de empresa sem cadastro: sem a medida da atividade', estudoGravado({ id: 'x', nome: 'SEM CADASTRO', entrada: { entrada: { atividades: [{ tipo: 'comercio', receita: 1 }] } } }).atividade === null);
  // 11/11/2026, 20h11: a contabilidade feita até julho não trava o estudo — a missão pede a DRE até julho, e a confirmação
  // de quem cuida dela já diz o que o Domínio mostra
  chk('a missão do lucro pede a DRE até onde a contabilidade vai', /Pelo Controle das contabilidades, ela está feita até jul\/26: use a DRE de out\/25 a jul\/26 \(10 dos 12 meses da receita\): ago\/26 e set\/26 entram pela margem desses 10\./.test(conta.roteiro.fases[1].missoes.find(m => m.id === 'lucro').texto)
    && conta.dre === null, conta.roteiro.fases[1].missoes.find(m => m.id === 'lucro').texto);
  const mConf = conta.roteiro.fases[1].missoes.find(m => m.id === 'contabil');
  chk('a missão da confirmação: com quem cuida da contabilidade, até julho, e o que o Domínio mostra', mConf && mConf.estado === 'aberta' && mConf.peso === 'decide' && mConf.confirmar.ate === '2026-07'
    && /confirme com quem cuida da contabilidade dela \(Adaini\) se o resultado até jul\/26 é confiável/.test(mConf.texto)
    && /O que o Domínio mostra de out\/25 a jul\/26: conta transitória ou a classificar com saldo de mai\/26 a jul\/26 \(R\$\s9\.000 em jul\/26\); a conta de banco mais atrasada está lançada até 11\/06\/2026\.$/.test(mConf.texto), mConf && mConf.texto);
  const res = resumoParaGravar(conta.comparacao);
  chk('o resumo gravado diz os regimes do comparativo; o Simples vai nulo', res.regimes.join() === 'presumido,real' && res.totais['2027'].simples === null && res.totais['2027'].presumido > 0 && res.melhor === d27.melhor);
  chk('o resumo de um estudo com os três diz os três', resumoParaGravar(comparar(entradaDoMotor({ atividades: [{ tipo: 'comercio', receita: 500000 }] }, ALIQ))).regimes.join() === 'simples,presumido,real');

  // com os três, o Simples entra como simulação
  const todos = contaDoEstudo({ ...est, aliq2027: ALIQ, hoje: '2026-11-11', objetivo: 'todos' });
  const t27 = todos.comparacao.anos[1], alt = ['presumido', 'real'].sort((a, b) => t27[a].total - t27[b].total)[0];
  chk('com os três: o aviso de que a linha do Simples é simulação, com os impedimentos e o mais barato sem ele', todos.objetivo === 'todos' && t27.simples.disponivel
    && todos.vedado === 'O Simples está vedado hoje pelo cadastro (CNAE secundário impeditivo: 7820-5/00 (Locação de mão-de-obra temporária) · pessoa jurídica no quadro de sócios: HOLDING INVENTADA LTDA (50% do capital)): a linha dele vale como simulação, se a empresa tirar os impedimentos.'
      + ' Sem o Simples, o mais barato em 2027 é o ' + (alt === 'real' ? 'Lucro Real' : 'Lucro Presumido') + ', ' + t27[alt].total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) + '.', todos.vedado);
  chk('com os três: a missão dos impedimentos decide e o prazo do Simples pede pra tirá-los antes', todos.roteiro.fases[0].missoes.some(m => m.id === 'vedacoes' && m.peso === 'decide' && m.estado === 'aberta')
    && todos.prazos.some(p => /^Entrar no Simples/.test(p.titulo) && /Antes, a empresa precisa tirar os impedimentos do cadastro\.$/.test(p.texto)) && todos.precisao.falta[0].id === 'vedacoes');
  chk('alertaDasVedacoes: só com o Simples na comparação e com impedimento', alertaDasVedacoes(conta.comparacao, v, ['presumido', 'real']) === null && alertaDasVedacoes(todos.comparacao, { vedado: false, impedimentos: [] }, null) === null
    && alertaDasVedacoes(todos.comparacao, null) === null && alertaDasVedacoes(null, v) === null && /^O Simples está vedado hoje pelo cadastro/.test(alertaDasVedacoes(todos.comparacao, v)));
  const escolhido = contaDoEstudo({ ...est, entrada: { ...est.entrada, objetivo: 'todos' }, aliq2027: ALIQ, hoje: '2026-11-11' });
  chk('o comparativo escolhido na tela (entrada.objetivo) vale sobre o sugerido', escolhido.objetivo === 'todos' && escolhido.regimes.length === 3);

  // o lucro da contabilidade: a DRE de R$ 40.000 no Presumido
  const comLucro = contaDoEstudo({ ...est, entrada: { ...est.entrada, lucroContabil: 40000 }, origens: { ...est.origens, lucroContabil: { fonte: 'digitado', texto: 'digitado' } }, aliq2027: ALIQ, hoje: '2026-11-11' });
  const l27 = comLucro.comparacao.anos[1];
  chk('com a DRE: o lucro do Real é o dela com os tributos de hoje trocados pelos do Real', l27.real.lucroInformado && perto(l27.real.lucro, 40000 + l27.real.trocaTributos) && comLucro.comparacao.decisao.real.informado === true
    && comLucro.muda.some(m => /, pela contabilidade\.$/.test(m.txt)) && comLucro.avisos.some(a => /^O lucro do Real parte do lucro da contabilidade \(R\$\s40\.000,00 nos 12 meses\)/.test(a)));
  chk('com a DRE, a precisão já tem o lucro (digitado)', comLucro.precisao.tem.some(x => x.id === 'lucro' && x.como === 'digitado') && !comLucro.precisao.falta.some(x => x.id === 'lucro'));

  // a DRE até onde a contabilidade está feita: R$ 40.000 de outubro a julho (10 de 12 meses de R$ 50.000: fator 1,2)
  const eDre = { ...est.entrada, lucroContabil: 40000, lucroDe: '2025-10', lucroAte: '2026-07', lucroReceita: 500000 };
  const oDre = { ...est.origens, lucroContabil: { fonte: 'digitado', texto: 'digitado' } };
  const parcial = contaDoEstudo({ ...est, entrada: eDre, origens: oDre, aliq2027: ALIQ, hoje: '2026-11-11' });
  const p27 = parcial.comparacao.anos[1];
  chk('a DRE de outubro a julho: o período, o fator 1,2 e o lucro do Real com os R$ 48.000 dos 12 meses', parcial.dre.de === '2025-10' && parcial.dre.ate === '2026-07' && parcial.dre.meses === 10 && perto(parcial.dre.fator, 1.2, 1e-9)
    && perto(p27.real.lucro, 48000 + p27.real.trocaTributos) && perto(p27.real.trocaTributos, l27.real.trocaTributos) && perto(parcial.comparacao.decisao.real.doze, 48000)
    && parcial.avisos.some(a => /^O lucro do Real parte do lucro da contabilidade \(R\$\s40\.000,00 na DRE: R\$\s48\.000,00 nos 12 meses, pela receita\)/.test(a)), JSON.stringify(parcial.dre));
  chk('as premissas testadas usam o mesmo lucro levado aos 12 meses', parcial.testes.every(x => x.melhorBase === parcial.comparacao.decisao.melhor));
  chk('sem a confirmação de quem cuida da contabilidade, o estudo segue provisório; com ela, o lucro deixa de segurar', parcial.roteiro.provisorio && parcial.precisao.falta.some(x => x.id === 'contabil' && x.peso === 'decide')
    && !contaDoEstudo({ ...est, entrada: eDre, origens: { ...oDre, lucroConfirmado: { fonte: 'confirmado', ate: '2026-07', nome: 'Samuel', em: '2026-11-11' } }, aliq2027: ALIQ, hoje: '2026-11-11' }).precisao.falta.some(x => ['lucro', 'contabil'].includes(x.id)));
  chk('sem a série (o estudo de empresa sem cadastro), o lucro entra como o dos 12 meses', contaDoEstudo({ ...est, serie: null, entrada: { ...est.entrada, lucroContabil: 40000 }, origens: oDre, aliq2027: ALIQ, hoje: '2026-11-11' }).dre === null);

  // a contabilidade do estudo, direto (contabilDoEstudo)
  const cDir = contabilDoEstudo({ faz: true, inicio: '2026-01', fim: null, responsavel: ' Adaini ' }, [{ competencia: '2026-01', situacao: 'feita' }, { competencia: '2026-02', situacao: 'feita' }, { competencia: '2026-03', situacao: 'andamento' }],
    [{ competencia: '2026-01', notas_saida: 4, notas_entrada: 0, lanc_fiscal: 0, salarios: 2000, folha_lancada: 0 }, { competencia: '2026-02', notas_saida: 4, lanc_fiscal: 9, salarios: 2000, folha_lancada: 2000, caixa_negativo: 1, contra_natureza: 3 },
      { competencia: '2026-03', notas_saida: 4, lanc_fiscal: 9 }, { competencia: '2026-11', notas_saida: 1 }], [], '2026-11-11');
  chk('contabilDoEstudo: feita até fevereiro, os problemas fortes de cada mês e só os meses que dá pra fechar', cDir.faz === true && cDir.feitaAte === '2026-02' && cDir.responsavel === 'Adaini' && cDir.bancoAte === null
    && cDir.meses.map(m => m.competencia + ':' + m.estado + ':' + m.problemas.map(p => p.tipo).join('+')).join(' ') === '2026-01:feita:fiscal+folha 2026-02:feita:caixa 2026-03:andamento:'
    && cDir.meses[0].problemas[1].valor === 2000, JSON.stringify(cDir));
  chk('contabilDoEstudo: fora do escritório e fora do Controle', contabilDoEstudo(null) === null && JSON.stringify(contabilDoEstudo({ faz: false, responsavel: null })) === '{"faz":false,"feitaAte":null,"responsavel":null,"meses":[],"bancoAte":null}');

  // o "e se" com o lucro da contabilidade
  const e1 = aplicarESe(est.entrada, est.origens, { lucro_contabil_12_meses: 30000 }, { aliq2027: ALIQ });
  chk('e se o lucro da contabilidade fosse R$ 30.000: entra no campo, de vazio pra 30.000', e1.entrada.lucroContabil === 30000 && e1.origens.lucroContabil.fonte === 'digitado'
    && e1.mudancas.some(m => m.rotulo === CAMPOS.lucroContabil.rotulo && m.antes === null && m.depois === 30000 && m.un === 'R$') && E_SE.lucro_contabil_12_meses.campo === 'lucroContabil', JSON.stringify(e1.mudancas));
  // o "e se" com as vendas com alíquota zero de PIS/Cofins (a cesta básica): vale pra toda atividade de mercadoria
  const eZ = aplicarESe(est.entrada, est.origens, { vendas_aliquota_zero_pis_cofins: 100 }, { aliq2027: ALIQ });
  const cZ0 = comparar(entradaDoMotor(est.entrada, ALIQ, 'presumido_real')), cZ1 = comparar(entradaDoMotor(eZ.entrada, ALIQ, 'presumido_real'));
  const pcDe = c => c.anos[0].presumido.itens.filter(i => i.tributo === 'PIS' || i.tributo === 'Cofins').reduce((t, i) => t + i.valor, 0);
  // fora da Cesta Básica Nacional (o padrão): 10% da alíquota de abril a dezembro (LC 224) — 10% × 9/12 do PIS/Cofins de antes
  chk('e se toda a venda tivesse alíquota zero de PIS/Cofins: entra em toda atividade de mercadoria, e o PIS/Cofins do Presumido de 2026 cai pros 10% da alíquota de abril a dezembro (LC 224)', E_SE.vendas_aliquota_zero_pis_cofins.ativ === 'pctAliqZero'
    && eZ.entrada.atividades.filter(a => a.tipo === 'comercio' || a.tipo === 'industria').every(a => a.pctAliqZero === 100) && eZ.origens['atividades.0.pctAliqZero'].fonte === 'digitado'
    && eZ.mudancas.some(m => m.rotulo.startsWith(CAMPOS['ativ.pctAliqZero'].rotulo) && m.depois === 100) && pcDe(cZ0) > 0 && perto(pcDe(cZ1), pcDe(cZ0) * 0.1 * 9 / 12), JSON.stringify(eZ.mudancas) + ' ' + pcDe(cZ0) + ' ' + pcDe(cZ1));
  const eC = aplicarESe(est.entrada, est.origens, { vendas_aliquota_zero_pis_cofins: 100, aliquota_zero_da_cesta_basica: true }, { aliq2027: ALIQ });
  chk('e se os produtos fossem da Cesta Básica Nacional: a alíquota zero segue, o PIS/Cofins do Presumido de 2026 zera, e a mudança vem dita', eC.entrada.atividades.every(a => a.aliqZeroCesta === true)
    && pcDe(comparar(entradaDoMotor(eC.entrada, ALIQ, 'presumido_real'))) === 0 && eC.mudancas.some(m => m.rotulo === E_SE.aliquota_zero_da_cesta_basica.rotulo && /^não/.test(m.antes) && /^sim \(seguem com zero\)$/.test(m.depois))
    && !aplicarESe(est.entrada, est.origens, { aliquota_zero_da_cesta_basica: false }, { aliq2027: ALIQ }).mudancas.length, JSON.stringify(eC.mudancas));
  const eL = { ...est.entrada, lucroContabil: 40000, ajustesLalur: 2000 };
  const e2 = aplicarESe(eL, est.origens, { receita_12_meses: 1200000 }, { aliq2027: ALIQ });
  chk('a receita em dobro leva o lucro da contabilidade e os ajustes junto', perto(e2.entrada.lucroContabil, 80000) && perto(e2.entrada.ajustesLalur, 4000) && e2.mudancas.some(m => /Lucro contábil.*\(acompanha a receita\)$/.test(m.rotulo) && m.antes === 40000 && perto(m.depois, 80000)));
  const e3 = aplicarESe(eL, est.origens, { margem_lucro_real: 5 }, { aliq2027: ALIQ });
  const c3 = comparar(entradaDoMotor(e3.entrada, ALIQ, 'presumido_real')), r3 = c3.anos.find(a => a.ano === c3.anoDecisao);
  chk('com a DRE no estudo, a margem do lucro do Real acha o lucro contábil (as outras despesas não mudam)', perto(r3.real.lucro, 0.05 * r3.receita, 0.01) && e3.entrada.outrasDespesas === eL.outrasDespesas
    && e3.mudancas.some(m => /^Lucro contábil.*pra o lucro do Real antes do IR dar 5% da receita em 2027$/.test(m.rotulo) && m.antes === 40000), JSON.stringify(e3.mudancas));

  // o "e se" sobre a DRE de 10 dos 12 meses: o lucro do "e se" é sempre o dos 12 meses (o da DRE vai a eles antes)
  const e4 = aplicarESe(eDre, oDre, { lucro_contabil_12_meses: 30000 }, { aliq2027: ALIQ, serie: est.serie });
  chk('e se o lucro dos 12 meses fosse R$ 30.000, com a DRE de 10 meses no estudo: antes R$ 48.000 (a dos 12 meses), e a conta não o leva de novo', e4.entrada.lucroContabil === 30000 && e4.entrada.lucroAnual === true && !('lucroAte' in e4.entrada)
    && e4.mudancas.some(m => m.rotulo === CAMPOS.lucroContabil.rotulo && perto(m.antes, 48000) && m.depois === 30000)
    && contaDoEstudo({ ...est, entrada: e4.entrada, origens: e4.origens, aliq2027: ALIQ, hoje: '2026-11-11' }).dre.fator === 1, JSON.stringify(e4.mudancas));
  const e5 = aplicarESe(eDre, oDre, { margem_lucro_real: 5 }, { aliq2027: ALIQ, serie: est.serie });
  const c5 = contaDoEstudo({ ...est, entrada: e5.entrada, origens: e5.origens, aliq2027: ALIQ, hoje: '2026-11-11' }), r5 = c5.comparacao.anos.find(a => a.ano === c5.comparacao.anoDecisao);
  chk('a margem do lucro do Real com a DRE de 10 meses: a conta inteira (com a série) dá os 5% da receita', perto(r5.real.lucro, 0.05 * r5.receita, 0.01) && e5.entrada.lucroAnual === true && e5.mudancas.some(m => /^Lucro contábil/.test(m.rotulo) && perto(m.antes, 48000)), JSON.stringify(e5.mudancas));
  const e6 = aplicarESe(eDre, oDre, { receita_12_meses: 1200000 }, { aliq2027: ALIQ, serie: est.serie });
  chk('a receita em dobro, com a DRE de 10 meses: o lucro dela dobra e o período fica', perto(e6.entrada.lucroContabil, 80000) && e6.entrada.lucroAte === '2026-07' && !e6.entrada.lucroAnual
    && perto(contaDoEstudo({ ...est, entrada: e6.entrada, origens: e6.origens, aliq2027: ALIQ, hoje: '2026-11-11' }).comparacao.decisao.real.doze, 96000));

  // ---------- a pergunta da confirmação no vigia de quem cuida da contabilidade (11/11/2026, 21h19: "Pra agora vai") ----------
  {
    const PG = { id: 'p1', ate: '2026-07', situacao: 'aberta', sim: false, para: 'Adaini', para_email: 'contabil@macedoereis.com.br', pedida_por: 'Samuel', criada_em: '2026-11-12T00:30:00+00:00' };
    const SIM = { ...PG, situacao: 'respondida', sim: true, resposta: 'Sim, pode usar até jul/26', respondida_em: '2026-11-12T13:00:00+00:00' };
    const feitas = [];
    const chamarCom = resp => async (nome, args) => { feitas.push({ nome, args }); return typeof resp === 'function' ? resp(nome, args) : resp; };
    // a leitura do estado: a função do banco, com a empresa; o que não é pergunta vira null
    chk('a leitura: chama a comparativo_confirmacao com a empresa e devolve a pergunta', (await perguntaDaConfirmacao(chamarCom({ data: PG, error: null }), 'c8')) === PG
      && feitas.length === 1 && feitas[0].nome === 'comparativo_confirmacao' && feitas[0].args.p_cliente === 'c8', JSON.stringify(feitas));
    chk('sem pergunta, com erro, com lixo, com a função que estoura, sem a função ou sem a empresa: null', (await perguntaDaConfirmacao(chamarCom({ data: null, error: null }), 'c8')) === null
      && (await perguntaDaConfirmacao(chamarCom({ data: PG, error: { message: 'x' } }), 'c8')) === null && (await perguntaDaConfirmacao(chamarCom({ data: [], error: null }), 'c8')) === null
      && (await perguntaDaConfirmacao(chamarCom({ data: { ate: '2026-07' }, error: null }), 'c8')) === null && (await perguntaDaConfirmacao(chamarCom(() => { throw new Error('caiu'); }), 'c8')) === null
      && (await perguntaDaConfirmacao(null, 'c8')) === null && (await perguntaDaConfirmacao(chamarCom({ data: PG, error: null }), null)) === null);
    // o estudo abre com a pergunta junto do Controle; sem as funções, ou com a contabilidade de fora, sem ela
    const comPg = await carregarEstudo({ ler: banco({ socios: SOC, extras }).ler, cliente: IND, hoje: '2026-11-11', chamar: chamarCom({ data: PG, error: null }) });
    chk('o estudo abre com a pergunta junto do Controle das contabilidades', comPg.contabil.pergunta === PG && comPg.contabil.feitaAte === '2026-07' && est.contabil.pergunta === null);
    const foraPg = await carregarEstudo({ ler: banco({ socios: SOC, extras: { ...extras, contabil_empresas: [{ cliente_id: 'c8', faz: false, inicio: '2025-01', fim: null }] } }).ler, cliente: IND, hoje: '2026-11-11', chamar: chamarCom({ data: PG, error: null }) });
    chk('a contabilidade de fora do escritório não tem a pergunta', foraPg.contabil.faz === false && !('pergunta' in foraPg.contabil));
    // a conta: o "sim" de quem cuida confirma sozinho (sem marca no estudo); a pergunta aberta deixa provisório
    const cSim = contaDoEstudo({ ...est, contabil: { ...est.contabil, pergunta: SIM }, entrada: eDre, origens: oDre, aliq2027: ALIQ, hoje: '2026-11-12' });
    const cAb = contaDoEstudo({ ...est, contabil: { ...est.contabil, pergunta: PG }, entrada: eDre, origens: oDre, aliq2027: ALIQ, hoje: '2026-11-12' });
    chk('com o sim de quem cuida, o lucro deixa de segurar o estudo; com a pergunta aberta, segue provisório', !cSim.precisao.falta.some(x => ['lucro', 'contabil'].includes(x.id)) && cSim.precisao.tem.some(x => x.id === 'contabil' && /pelo vigia$/.test(x.como))
      && cAb.roteiro.provisorio && cAb.precisao.falta.some(x => x.id === 'contabil' && x.peso === 'decide'), JSON.stringify([cSim.precisao.tem.find(x => x.id === 'contabil'), cAb.precisao.falta.map(x => x.id)]));
    // o pedido: a função, a empresa, o mês e os sinais (até 1.400 letras)
    feitas.length = 0;
    const r1 = await pedirConfirmacao(chamarCom({ data: { id: 'p2', nova: true, para: 'Adaini' }, error: null }), { clienteId: 'c8', ate: '2026-07', sinais: 'x'.repeat(2000) });
    chk('o pedido: a comparativo_pedir_confirmacao com a empresa, o mês e os sinais cortados em 1.400', r1.ok === true && r1.id === 'p2' && r1.nova === true && r1.para === 'Adaini' && feitas.length === 1 && feitas[0].nome === 'comparativo_pedir_confirmacao'
      && feitas[0].args.p_cliente === 'c8' && feitas[0].args.p_ate === '2026-07' && feitas[0].args.p_sinais.length === 1400, JSON.stringify(r1));
    const r2 = await pedirConfirmacao(chamarCom({ data: { id: 'p2', nova: false, para: 'Adaini' }, error: null }), { clienteId: 'c8', ate: '2026-07' });
    chk('sem sinais, vai nulo; a pergunta que já estava aberta volta como a mesma', r2.ok && r2.nova === false && feitas[1].args.p_sinais === null);
    // as recusas da função saem em português; o erro técnico vira a frase genérica
    const recusa = (code, message) => pedirConfirmacao(chamarCom({ data: null, error: { code, message } }), { clienteId: 'c8', ate: '2026-07' });
    chk('a recusa da regra chega com a frase do banco', (await recusa('P0001', 'Quem cuida da contabilidade desta empresa é você: confirme direto no estudo.')).erro === 'Quem cuida da contabilidade desta empresa é você: confirme direto no estudo.'
      && (await recusa('P0001', 'Empresa fora do cadastro.')).erro === 'Empresa fora do cadastro.' && (await recusa('22023', 'Faltou a empresa ou o mês.')).erro === 'Faltou a empresa ou o mês.'
      && (await recusa('42501', 'Só a equipe do escritório pede a confirmação.')).erro === 'Só a equipe do escritório pede a confirmação.' && (await recusa('P0001', 'x')).ok === false);
    chk('o erro técnico (a permissão do banco, a função que não existe, a rede, a resposta sem id) vira a frase genérica', (await recusa('42501', 'permission denied for function comparativo_pedir_confirmacao')).erro === ERRO_AO_PERGUNTAR
      && (await recusa('PGRST202', 'Could not find the function public.comparativo_pedir_confirmacao')).erro === ERRO_AO_PERGUNTAR && (await recusa('P0001', '')).erro === ERRO_AO_PERGUNTAR
      && (await pedirConfirmacao(chamarCom(() => { throw new Error('Failed to fetch'); }), { clienteId: 'c8', ate: '2026-07' })).erro === ERRO_AO_PERGUNTAR
      && (await pedirConfirmacao(chamarCom({ data: [], error: null }), { clienteId: 'c8', ate: '2026-07' })).erro === ERRO_AO_PERGUNTAR && /^Não deu pra enviar a pergunta agora\./.test(ERRO_AO_PERGUNTAR));
    const antes = feitas.length;
    chk('sem a empresa, com o mês torto ou sem as funções, nem chama o banco', (await pedirConfirmacao(chamarCom({ data: { id: 'x' } }), { clienteId: null, ate: '2026-07' })).ok === false
      && (await pedirConfirmacao(chamarCom({ data: { id: 'x' } }), { clienteId: 'c8', ate: 'jul/26' })).ok === false && (await pedirConfirmacao(null, { clienteId: 'c8', ate: '2026-07' })).ok === false
      && (await pedirConfirmacao(chamarCom({ data: { id: 'x' } }))).ok === false && feitas.length === antes);
  }

  // a contabilidade de fora e a empresa sem cadastro
  const { ler: lf } = banco({ socios: SOC, extras: { ...extras, contabil_empresas: [{ cliente_id: 'c8', faz: false, inicio: '2025-01', fim: null }] } });
  const fora = await carregarEstudo({ ler: lf, cliente: IND, hoje: '2026-11-11' });
  chk('a contabilidade que o escritório não faz', fora.contabil.faz === false && fora.contabil.feitaAte === null && fora.fontes.some(f => !f.ok && f.txt === 'contabilidade fora do escritório'));
  const { ler: ls } = banco({ socios: SOC, extras: { ...extras, contabil_empresas: [], contabil_meses: [], receita_empresas: [] } });
  const semCtb = await carregarEstudo({ ler: ls, cliente: IND, hoje: '2026-11-11' });
  chk('fora do Controle das contabilidades e sem a consulta da Receita: sem a fonte e sem pendência a conferir', semCtb.contabil === null && !semCtb.fontes.some(f => /contabilidade/.test(f.txt)) && semCtb.vedacoes.conferir.length === 0 && semCtb.vedacoes.vedado);
  const { ler: lr } = banco();
  const rest = await carregarEstudo({ ler: lr, cliente: RESTAURANTE });
  chk('o restaurante do Simples: nada veda pelo CNAE, e falta a natureza no cadastro', !rest.vedacoes.vedado && rest.vedacoes.semDado.join() === 'a natureza jurídica' && contaDoEstudo({ ...rest, aliq2027: ALIQ, hoje: '2026-11-01' }).objetivo === 'todos');
  const g = estudoGravado({ id: 'e9', cliente_id: null, nome: 'PROSPECT LTDA', entrada: { v: 1, entrada: { atividades: [{ tipo: 'servico', receita: 900000 }], regimeAtual: 'presumido', objetivo: 'todos' }, origens: {} } });
  chk('o estudo de empresa sem cadastro: sem vedações nem contabilidade, e o comparativo gravado vale', g.vedacoes === null && g.contabil === null && g.entrada.objetivo === 'todos' && contaDoEstudo({ ...g, aliq2027: ALIQ, hoje: '2026-11-11' }).objetivo === 'todos'
    && contaDoEstudo({ ...g, entrada: { ...g.entrada, objetivo: undefined }, aliq2027: ALIQ, hoje: '2026-11-11' }).objetivo === 'presumido_real');
  const semRec = contaDoEstudo({ entrada: comPadroes({ atividades: [{ tipo: 'comercio', receita: 0 }], regimeAtual: 'presumido' }), origens: {}, hoje: '2026-11-11' });
  chk('sem receita, a conta não roda, mas diz o caminho e a precisão', semRec.comparacao === null && semRec.objetivo === 'presumido_real' && semRec.vedado === null && semRec.precisao.nivel === 'provisorio' && semRec.precisao.falta[0].id === 'receita');
}

console.log('O resultado da contabilidade e o CST do PIS/Cofins pela ponte do Domínio (a versão 5, 11/11/2026)');
{
  // a indústria do Presumido: 12 meses de R$ 50.000 (out/25 a set/26), o resultado do Domínio de R$ 3.000 por mês, 60% da
  // venda com alíquota zero pelo CST das notas, a contabilidade feita até julho — e outubro, ainda em aberto, com um
  // resultado que não pode entrar
  const IND = { id: 'c9', nome_principal: 'INDUSTRIA DA PONTE LTDA', nome_fantasia: null, documento: '99999999000199', tipo_pessoa: 'PJ', regime_tributario: 'Lucro Presumido', cidade: 'Igrejinha', uf: 'RS',
    cnae_principal: '1041-4/00 - Fabricação de óleos vegetais em bruto, exceto óleo de milho', cnaes_secundarios: [], natureza_juridica: '206-2 - Sociedade Empresária Limitada' };
  const mes = i => new Date(Date.UTC(2025, i, 1)).toISOString().slice(0, 7);
  const linha = (i, extra = {}) => ({ codigo: 900, cliente_id: 'c9', competencia: mes(9 + i), receita_bruta: 50000, receita_mercadorias: 50000, receita_servicos: 0, receita_simples: null, compras: 30000, servicos_tomados: 0, ativo_e_consumo: 0,
    salarios: 0, decimo_terceiro: 0, pro_labore_valor: 1621, pc_tributada: 20000, pc_monofasica: 0, pc_st: 0, pc_aliquota_zero: 30000, pc_isenta: 0, pc_sem_incidencia: 0, pc_suspensa: 0, pc_outras: 0, pc_sem_cst: 0,
    resultado_antes_ir: 3000, irpj_csll_lancados: 500, receitas_financeiras: 0, lanc_resultado: 12, ...extra });
  const extrasDe = (o = {}) => ({
    dominio_mensal: [...Array.from({ length: 12 }, (_, i) => linha(i, (o.linhas || {})[mes(9 + i)] || {})), linha(12, { resultado_antes_ir: 999999, lanc_resultado: 3 })],
    contabil_empresas: o.semControle ? [] : [{ cliente_id: 'c9', faz: true, inicio: '2025-01', fim: null, responsavel: 'Adaini' }],
    contabil_meses: Array.from({ length: 19 }, (_, i) => ({ cliente_id: 'c9', competencia: mes(i), situacao: 'feita', feita_em: '2026-08-10' })), dominio_andamento: [], receita_empresas: [] });
  const SOC = [{ cliente_id: 'c9', nome: 'SOCIO DA PONTE', cpf: '123.456.789-09', participacao_percentual: 100 }];
  const abrir = async (o = {}) => { const b = banco({ socios: SOC, extras: extrasDe(o), comparativos: o.comparativos || [] }); return { est: await carregarEstudo({ ler: b.ler, cliente: IND, hoje: '2026-11-11' }), log: b.log }; };

  // ---------- o estudo novo: o lucro entra sozinho, até onde o Controle dá a contabilidade como feita ----------
  const { est, log } = await abrir();
  chk('a leitura pede as colunas da versão 5: o resultado da contabilidade e a venda pelo CST do PIS/Cofins', log.some(x => x.t === 'dominio_mensal' && x.o.eq && x.o.eq.cliente_id === 'c9'
    && ['resultado_antes_ir', 'irpj_csll_lancados', 'receitas_financeiras', 'lanc_resultado', 'pc_aliquota_zero', 'pc_sem_cst', 'pc_monofasica'].every(c => new RegExp('\\b' + c + '\\b').test(x.o.cols))));
  chk('o lucro da contabilidade entra sozinho: de outubro a julho (10 meses × R$ 3.000), com a receita desses meses e a origem da ponte', est.entrada.lucroContabil === 30000 && est.entrada.lucroDe === '2025-10' && est.entrada.lucroAte === '2026-07'
    && est.entrada.lucroReceita === 500000 && est.origens.lucroContabil.fonte === 'ponte' && est.origens.lucroContabil.texto === 'Domínio, pela ponte: o resultado da contabilidade de out/25 a jul/26', JSON.stringify([est.entrada.lucroContabil, est.origens.lucroContabil]));
  chk('o resultado mês a mês vai com o estudo: só os meses fechados (outubro de 2026, em aberto, fica fora)', est.resultadoPonte.length === 12 && est.resultadoPonte[0].competencia === '2025-10' && est.resultadoPonte[11].competencia === '2026-09'
    && !est.resultadoPonte.some(x => x.resultado === 999999) && est.pelaPonte.length === 0 && !/"codigo"/.test(JSON.stringify(est.resultadoPonte)));
  chk('os números do sistema (o "Recomeçar") também trazem o lucro da ponte', est.sistema.entrada.lucroContabil === 30000 && est.sistema.origens.lucroContabil.fonte === 'ponte');
  chk('a venda com alíquota zero vem do CST das notas: 60%, com a origem da ponte', est.entrada.atividades[0].pctAliqZero === 60 && est.origens['atividades.0.pctAliqZero'].fonte === 'ponte' && est.origens['atividades.0.pctAliqZero'].cst === true);
  const conta = contaDoEstudo({ ...est, entrada: { ...est.entrada, objetivo: 'presumido_real' }, aliq2027: ALIQ, hoje: '2026-11-11' });
  const mLucro = conta.roteiro.fases.flatMap(f => f.missoes).find(m => m.id === 'lucro');
  chk('a conta: o lucro do Real é o da contabilidade, levado aos 12 meses (fator 1,2), e a conta diz o que a ponte tem hoje', conta.comparacao.anos[0].real.lucroInformado === true && perto(conta.dre.fator, 1.2, 1e-9) && conta.lucroPonte.lucro === 30000
    && conta.lucroPonte.ate === '2026-07' && perto(conta.comparacao.decisao.real.doze, 36000), JSON.stringify([conta.dre, conta.lucroPonte]));
  chk('a missão do lucro vem cumprida pela ponte, sem botão; a confirmação de quem cuida segue aberta', mLucro.estado === 'feita' && mLucro.como === 'veio do Domínio pela ponte' && mLucro.usarPonte === null
    && conta.roteiro.fases.flatMap(f => f.missoes).find(m => m.id === 'contabil').estado === 'aberta' && conta.roteiro.provisorio === true, mLucro.texto);
  chk('a missão do PIS/Cofins vem cumprida pela ponte (a alíquota zero medida nas notas)', (() => { const m = conta.roteiro.fases.flatMap(f => f.missoes).find(x => x.id === 'piscofins'); return m && m.estado === 'feita' && m.como === 'veio do Domínio pela ponte'; })());

  // ---------- sem o Controle dizer até onde: nada entra sozinho, mas o resultado fica à mão ----------
  const semCtb = (await abrir({ semControle: true })).est;
  chk('fora do Controle das contabilidades: o lucro não entra sozinho (o sistema não sabe até que mês)', semCtb.entrada.lucroContabil == null && semCtb.origens.lucroContabil.fonte === 'padrao' && semCtb.resultadoPonte.length === 12
    && contaDoEstudo({ ...semCtb, entrada: { ...semCtb.entrada, objetivo: 'presumido_real' }, aliq2027: ALIQ, hoje: '2026-11-11' }).lucroPonte === null);
  // ---------- o mês feito no Controle e sem lançamento de resultado no Domínio: nunca lucro zero ----------
  const semLanc = (await abrir({ linhas: { '2026-07': { lanc_resultado: 0, resultado_antes_ir: null } } })).est;
  const cSL = contaDoEstudo({ ...semLanc, entrada: { ...semLanc.entrada, objetivo: 'presumido_real' }, aliq2027: ALIQ, hoje: '2026-11-11' });
  chk('julho feito no Controle e sem lançamento em conta de resultado no Domínio: o lucro não entra, e a missão diz o mês', semLanc.entrada.lucroContabil == null && cSL.lucroPonte.falta === 'sem_lancamento' && cSL.lucroPonte.quais.join() === '2026-07'
    && /O Domínio não tem lançamento em conta de resultado em jul\/26/.test(cSL.roteiro.fases.flatMap(f => f.missoes).find(m => m.id === 'lucro').texto));

  // ---------- o estudo gravado ----------
  const gravado = (entrada, origens = {}) => [{ id: 'e9', cliente_id: 'c9', entrada: { v: 1, entrada: { atividades: [{ tipo: 'industria', receita: 600000 }], regimeAtual: 'presumido', objetivo: 'presumido_real', compras: 360000, ...entrada }, origens }, atualizado_em: '2026-11-11T20:00:00Z', atualizado_por: 'financeiro@macedoereis.com.br' }];
  const g1 = (await abrir({ comparativos: gravado({}, { 'atividades.0.pctAliqZero': { fonte: 'padrao', texto: 'padrão: nenhuma — confira' } }) })).est;
  chk('o gravado sem o lucro ganha o da ponte, e a alíquota zero no padrão ganha a medida das notas (a tela grava de novo)', g1.estudoId === 'e9' && g1.entrada.lucroContabil === 30000 && g1.entrada.lucroAte === '2026-07' && g1.origens.lucroContabil.fonte === 'ponte'
    && g1.entrada.atividades[0].pctAliqZero === 60 && g1.origens['atividades.0.pctAliqZero'].cst === true && g1.pelaPonte.join() === 'lucro,piscofins', JSON.stringify([g1.entrada.lucroContabil, g1.pelaPonte]));
  const g2 = (await abrir({ comparativos: gravado({ atividades: [{ tipo: 'industria', receita: 600000, pctAliqZero: 100, aliqZeroCesta: true }] }, { lucroContabil: { fonte: 'confirmado', texto: 'conferido' }, 'atividades.0.pctAliqZero': { fonte: 'digitado' } }) })).est;
  const c2 = contaDoEstudo({ ...g2, aliq2027: ALIQ, hoje: '2026-11-11' }), m2 = c2.roteiro.fases.flatMap(f => f.missoes).find(m => m.id === 'lucro');
  chk('quem escolheu seguir com a estimativa fica com ela (a missão oferece o do Domínio), e a alíquota zero digitada fica', g2.entrada.lucroContabil == null && g2.origens.lucroContabil.fonte === 'confirmado' && g2.pelaPonte.length === 0
    && g2.entrada.atividades[0].pctAliqZero === 100 && g2.entrada.atividades[0].aliqZeroCesta === true && m2.estado === 'feita' && m2.usarPonte.ate === '2026-07' && m2.usarPonteRotulo === 'Usar o do Domínio', JSON.stringify([g2.pelaPonte, m2.usarPonte]));
  const g3 = (await abrir({ comparativos: gravado({ lucroContabil: 45000, lucroDe: '2025-10', lucroAte: '2026-07', lucroReceita: 500000 }, { lucroContabil: { fonte: 'digitado', texto: 'digitado' } }) })).est;
  const m3 = contaDoEstudo({ ...g3, aliq2027: ALIQ, hoje: '2026-11-11' }).roteiro.fases.flatMap(f => f.missoes).find(m => m.id === 'lucro');
  chk('o lucro digitado fica: a missão cumprida mostra o do Domínio e oferece usar', g3.entrada.lucroContabil === 45000 && g3.origens.lucroContabil.fonte === 'digitado' && !g3.pelaPonte.includes('lucro') && m3.estado === 'feita'
    && m3.usarPonteRotulo === 'Usar o do Domínio' && /Pelo Domínio, o resultado de out\/25 a jul\/26 é lucro de R\$\s30\.000\./.test(m3.texto), m3.texto);
  // o lucro que veio da ponte num dia e hoje o Domínio mostra outro no mesmo período: fica o do estudo, e a missão reabre
  const g4 = (await abrir({ linhas: { '2026-03': { resultado_antes_ir: 8000 } }, comparativos: gravado({ lucroContabil: 30000, lucroDe: '2025-10', lucroAte: '2026-07', lucroReceita: 500000 },
    { lucroContabil: { fonte: 'ponte', texto: 'Domínio, pela ponte: o resultado da contabilidade de out/25 a jul/26' } }) })).est;
  const m4 = contaDoEstudo({ ...g4, aliq2027: ALIQ, hoje: '2026-11-11' }).roteiro.fases.flatMap(f => f.missoes).find(m => m.id === 'lucro');
  chk('o lucro da ponte que ficou velho não troca sozinho: a missão reabre com "Atualizar pelo Domínio" e o número de hoje (R$ 35.000)', g4.entrada.lucroContabil === 30000 && !g4.pelaPonte.includes('lucro') && m4.estado === 'aberta'
    && m4.usarPonteRotulo === 'Atualizar pelo Domínio' && /hoje ele mostra lucro de R\$\s35\.000\./.test(m4.texto), m4.texto);
  // a empresa sem cadastro não tem a ponte
  chk('o estudo de empresa sem cadastro: sem o resultado da ponte', (() => { const g = estudoGravado({ id: 'e1', nome: 'X', entrada: { v: 1, entrada: { atividades: [{ tipo: 'comercio', receita: 1 }] } } }); return g.resultadoPonte === null && g.pelaPonte.length === 0; })());
}

console.log('\n' + (falhas ? falhas + ' falha(s)' : 'tudo certo'));
process.exit(falhas ? 1 : 0);
