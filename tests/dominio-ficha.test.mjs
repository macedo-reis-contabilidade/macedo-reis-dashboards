// O Domínio na ficha da empresa (assets/js/dominio-ficha.js, 02/11/2026): o que a ponte do Domínio leu, os últimos 6
// meses em tabela, escapado, e nada quando a empresa não está ligada ao Domínio. Dados inventados.
// Rodar com: node tests/dominio-ficha.test.mjs
import { htmlDoDominio, juntarMeses, mesAntes, temDado, temValores, folhaDoMes, encargosDoMes, MESES_NA_FICHA } from '../assets/js/dominio-ficha.js';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); };
const texto = h => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const L = (comp, x = {}) => ({ codigo: 7, competencia: comp, funcionarios_ativos: 6, admissoes: 1, desligamentos: 0, afastados: 0, pro_labore: 2, notas_saida: 120,
  valor_saidas: 300000, notas_entrada: 80, valor_entradas: 150000.5, lancamentos: 250, ultimo_lancamento: comp + '-28', atualizado_em: '2026-11-02T10:05:00Z', ...x });

console.log('Sem o Domínio:');
chk('sem empresa e sem linha, nada', htmlDoDominio(null, '2026-11-02') === '' && htmlDoDominio({ empresas: [], linhas: [] }, '2026-11-02') === '' && !temDado({}));

console.log('As contas:');
chk('o mês de n meses antes, virando o ano', mesAntes('2026-11-02', 5) === '2026-06' && mesAntes('2026-02-10', 3) === '2025-11' && mesAntes('2026-01-31', 13) === '2024-12' && MESES_NA_FICHA === 6);
const j = juntarMeses([L('2026-08', { codigo: 7, funcionarios_ativos: 0, notas_saida: 2, ultimo_lancamento: '2026-08-10' }), L('2026-09'),
  L('2026-08', { codigo: 9, funcionarios_ativos: 4, notas_saida: 50, valor_saidas: 1000, ultimo_lancamento: '2026-08-31', admissoes: null }), { competencia: 'x' }]);
chk('um por mês, do mais recente pro mais antigo; dois códigos: o maior de cada número; o null não apaga o número do outro',
  j.length === 2 && j[0].competencia === '2026-09' && j[1].funcionarios_ativos === 4 && j[1].notas_saida === 50 && j[1].valor_saidas === 300000
  && j[1].ultimo_lancamento === '2026-08-31' && j[1].admissoes === 1, j);

console.log('A seção:');
const d = { empresas: [{ codigo: 7, ativa: true }], linhas: [L('2026-11', { admissoes: 0, notas_saida: 0, valor_saidas: 0, notas_entrada: 0, valor_entradas: 0, lancamentos: 0, ultimo_lancamento: null }),
  L('2026-10'), L('2026-09', { admissoes: 0, desligamentos: 1, afastados: 1, pro_labore: 1 }), L('2026-05')] };
const h = htmlDoDominio(d, '2026-11-02'), t = texto(h);
chk('a empresa no Domínio, pelo código', t.includes('Empresa no Domínio: código 7') && !t.includes('inativa'));
chk('os meses do mais recente pro mais antigo', t.indexOf('11/2026') < t.indexOf('10/2026') && t.indexOf('10/2026') < t.indexOf('09/2026'), t);
chk('o mês de hoje e o passado marcados em fechamento; o de antes, não', /11\/2026 em fechamento/.test(t) && /10\/2026 em fechamento/.test(t) && !/09\/2026 em fechamento/.test(t), t);
chk('a folha: os empregados e o que mudou no mês', /10\/2026 em fechamento 6 \+1 adm\. 2 /.test(t) && /09\/2026 6 −1 desl\. · 1 afast\. 1 /.test(t), t);
chk('as notas com o valor contábil e os lançamentos até o último dia', /120 R\$ 300\.000,00 80 R\$ 150\.000,50 250 até 28\/10/.test(t), t);
chk('o mês sem nota: o zero, sem valor', /11\/2026 em fechamento 6 2 0 0 0/.test(t), t);
chk('o rodapé: de onde veio, quando, o que é parcial e que não é o faturamento', t.includes('a última vez em 02/11/2026') && t.includes('nenhum dado de funcionário sai do Domínio')
  && t.includes('não o faturamento'));
const sete = htmlDoDominio({ empresas: [{ codigo: 7, ativa: true }], linhas: ['2026-11', '2026-10', '2026-09', '2026-08', '2026-07', '2026-06', '2026-05'].map(c => L(c)) }, '2026-11-02');
chk('no máximo 6 meses na tabela', (sete.match(/<tr>/g) || []).length === 7 && !texto(sete).includes('05/2026'), (sete.match(/<tr>/g) || []).length);
const fora = texto(htmlDoDominio({ empresas: [{ codigo: 3, ativa: false }], linhas: [L('2026-07', { funcionarios_ativos: null, admissoes: null, desligamentos: null, afastados: null, pro_labore: null })] }, '2026-11-02'));
chk('a inativa no Domínio dita; a folha que ele não disse sai como traço, não zero', fora.includes('código 3 (inativa no Domínio)') && /07\/2026 — — 120/.test(fora), fora);
chk('ligada sem movimento: diz', texto(htmlDoDominio({ empresas: [{ codigo: 7, ativa: true }], linhas: [] }, '2026-11-02')).includes('Sem movimento no Domínio nos últimos 6 meses.'));
const x = htmlDoDominio({ empresas: [{ codigo: '<img src=x onerror=alert(1)>', ativa: true }], linhas: [L('2026-10', { ultimo_lancamento: '<b>' })] }, '2026-11-02');
chk('o que vem do banco entra escapado', !/<img/.test(x) && x.includes('&lt;img'), x.slice(0, 200));
chk('sem os valores da versão 2: sem a tabela em reais, e o rodapé de antes', !t.includes('Em reais') && t.includes('o faturamento é o da declaração do PGDAS') && !temValores(juntarMeses(d.linhas)));

console.log('Em reais (a versão 2 da ponte, 05/11/2026):');
const V = (comp, x = {}) => L(comp, { receita_bruta: 100000, receita_simples: 100000, rbt12: 1150000.4, meses_rbt12: 12, compras: 40000, servicos_tomados: 0, salarios: 18000,
  rescisoes: 0, decimo_terceiro: 0, pro_labore_valor: 3036, fgts: 1440, inss_empresa: 3600, inss_rat: 360, inss_terceiros: 1044, ...x });
const dv = { empresas: [{ codigo: 7, ativa: true }], linhas: [V('2026-11', { rbt12: null, meses_rbt12: null }), V('2026-10', { receita_simples: 130000.5, servicos_tomados: 2500, decimo_terceiro: 9000, rescisoes: 4000 }),
  V('2026-09', { rbt12: 999, meses_rbt12: 7 }), L('2026-08')] };
const hv = htmlDoDominio(dv, '2026-11-02'), tv = texto(hv);
const tabV = texto(hv.slice(hv.indexOf('dm-valor')));
chk('a tabela em reais, depois da de quantidades', hv.includes('dm-qtd') && hv.indexOf('dm-qtd') < hv.indexOf('dm-valor') && tv.includes('Em reais'), tv);
chk('o faturamento; a apuração do Simples só quando é outra (as filiais)', /09\/2026 R\$ 100\.000,00 R\$ 40\.000,00/.test(tabV) && /10\/2026 em fechamento R\$ 100\.000,00 no Simples: R\$ 130\.000,50/.test(tabV), tabV);
chk('as compras com os serviços tomados', /R\$ 40\.000,00 \+ serviços R\$ 2\.500,00/.test(tabV), tabV);
chk('a folha com o 13º e as rescisões (dentro dos proventos)', /R\$ 27\.000,00 com 13º R\$ 9\.000,00 · rescisões R\$ 4\.000,00 R\$ 3\.036,00/.test(tabV), tabV);
chk('os encargos: FGTS + INSS da empresa, RAT e terceiros', /R\$ 6\.444,00 FGTS R\$ 1\.440,00 · INSS R\$ 5\.004,00/.test(tabV), tabV);
chk('o RBT12 do mês mais recente que tem (o de hoje ainda não)', /RBT12 de 10\/2026 no Simples .* R\$ 1\.150\.000,40/.test(tv) && !tv.includes('média × 12'), tv);
chk('o mês que o Domínio não leu em reais: traços', /08\/2026 — — — — —/.test(tabV), tabV);
chk('o rodapé explica o faturamento, a folha e os encargos', tv.includes('O faturamento é a receita bruta pelos acumuladores de faturamento do Domínio') && tv.includes('não o faturamento') && tv.includes('com o RAT e os terceiros'));
const curto = texto(htmlDoDominio({ empresas: [{ codigo: 7 }], linhas: [V('2026-09', { rbt12: 840000, meses_rbt12: 7 })] }, '2026-11-02'));
chk('o RBT12 com menos de 12 meses de atividade: a média × 12', /RBT12 de 09\/2026 .* R\$ 840\.000,00 \(com 7 meses de atividade: a média × 12\)/.test(curto), curto);
chk('as contas: a folha e os encargos somam o que veio; nada veio = null', folhaDoMes({ salarios: 10, decimo_terceiro: null }) === 10 && folhaDoMes({}) === null
  && encargosDoMes({ fgts: 1, inss_empresa: 2, inss_rat: null, inss_terceiros: 3 }) === 6 && encargosDoMes({ fgts: null }) === null);
const jv = juntarMeses([V('2026-09', { codigo: 7, receita_bruta: 10 }), V('2026-09', { codigo: 9, receita_bruta: 50, compras: null })]);
chk('dois códigos: o maior também nos valores', jv.length === 1 && jv[0].receita_bruta === 50 && jv[0].compras === 40000, jv);

console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
