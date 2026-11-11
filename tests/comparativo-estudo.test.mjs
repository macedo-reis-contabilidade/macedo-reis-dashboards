// Comparativo tributário — o estudo de uma empresa (assets/js/comparativo-estudo.js): a leitura (o gravado ou os números
// do sistema, as empresas dos mesmos sócios pelo CPF, o CPF que não sai), a conta inteira (a mesma do comparar, o roteiro,
// o que muda, os avisos, o aviso do limite do ano), o resumo gravado e o "e se" do assistente (a receita que leva as
// compras junto, o lucro do Real em % da receita, o ICMS de todas as atividades, as empresas dos sócios fora da soma).
// Desde 11/11/2026: qual comparativo (o escolhido ou o que o sistema sugere), o que o cadastro veda no Simples (o documento
// do sócio pessoa jurídica não sai), a contabilidade feita até que mês, a precisão do estudo e o lucro da contabilidade.
// Rodar com: node tests/comparativo-estudo.test.mjs
import { comparar } from '../assets/js/comparativo-motor.js';
import { PADROES, comPadroes, ORIGENS_PADRAO, CAMPOS, erroSemTabela, entradaDoMotor, carregarEstudo, estudoGravado, contaDoEstudo, situacaoComGrupo,
  oQueMuda, avisosDoEstudo, alertaDoLimite, resumoParaGravar, aplicarESe, E_SE, objetivoDoEstudo, opcoesDeObjetivo, alertaDasVedacoes } from '../assets/js/comparativo-estudo.js';

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
    contabil_empresas: [{ cliente_id: 'c8', faz: true, inicio: '2025-01', fim: null }],
    contabil_meses: Array.from({ length: 19 }, (_, i) => ({ cliente_id: 'c8', competencia: mes(i), situacao: 'feita', feita_em: '2026-08-10' }))
  };
  const SOC = [{ cliente_id: 'c8', nome: 'SOCIA DE TESTE', cpf: '999.888.777-66', participacao_percentual: 50 }, { cliente_id: 'c8', nome: 'HOLDING INVENTADA LTDA', cpf: '12.345.678/0001-99', participacao_percentual: 50 }];
  const { ler, log } = banco({ socios: SOC, extras });
  const est = await carregarEstudo({ ler, cliente: IND, hoje: '2026-11-11' });
  chk('a leitura pede as pendências na Receita e o Controle das contabilidades', log.some(x => x.t === 'receita_empresas' && x.o.cols === 'pendencias, situacao_fiscal_em' && x.o.eq.cliente_id === 'c8')
    && log.some(x => x.t === 'contabil_empresas' && x.o.cols === 'faz, inicio, fim') && log.some(x => x.t === 'contabil_meses' && x.o.eq.cliente_id === 'c8'));
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
  chk('a missão do lucro diz até onde a contabilidade vai', /Pelo Controle das contabilidades, ela está feita até jul\/26: a DRE até set\/26 ainda não fecha\.$/.test(conta.roteiro.fases[1].missoes.find(m => m.id === 'lucro').texto));
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

console.log('\n' + (falhas ? falhas + ' falha(s)' : 'tudo certo'));
process.exit(falhas ? 1 : 0);
