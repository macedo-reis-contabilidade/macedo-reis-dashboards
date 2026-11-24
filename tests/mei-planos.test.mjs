// Os planos do MEI pro cliente (assets/js/mei-planos.js, 24/11/2026): a ordem dos planos, o recomendado (o marcado na aba
// MEI ou o mais simples), a lista por grupo com o ✓ de cada plano, o que todos têm, o que é cobrado à parte, o nome do
// cliente e a mensagem do WhatsApp; as páginas da lista (assets/js/mei-planos-imagem.js: nenhuma imagem passa de 1600 px)
// e o que a janela diz e lê (assets/js/mei-planos-janela.js). Dados inventados (os planos de verdade ficam no banco).
// Rodar com: node tests/mei-planos.test.mjs
import { NFS_PADRAO, GRUPOS, ESCRITORIO, IRPF_A_PARTE, reais, reaisCurto, planosEmOrdem, planoMaisSimples, recomendados, nomeCurto, qtdNotas,
  nomeDoServico, juntar, montarVitrine, precoAParte, primeiroNome, mensagemWhats, quantasImagens } from '../assets/js/mei-planos.js';
import { empacotar, paginar, ALTURA_MAX, LARGURA } from '../assets/js/mei-planos-imagem.js';
import { textoDaRecomendacao, nomeDoArquivo, lerCatalogoMei, COLS_PLANOS, COLS_SERVICOS, COLS_COMP } from '../assets/js/mei-planos-janela.js';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); };
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// um catálogo inventado no formato das tabelas mei_planos, mei_servicos e mei_plano_servicos
const PLANOS = [
  { id: 'cresce', nome: 'MEI CRESCE MAIS', slogan: 'Pra quem quer mais acompanhamento', valor_mensal: '300', ordem: 1, ativo: true },
  { id: 'basico', nome: 'MEI BÁSICO', slogan: 'O essencial do mês', valor_mensal: '200', ordem: 2, ativo: true },
  { id: 'equipe', nome: 'MEI EQUIPE DE PGTO.', slogan: 'Pra quem tem funcionário', valor_mensal: '300', ordem: 3, ativo: true },
  { id: 'velho', nome: 'MEI ANTIGO', slogan: '', valor_mensal: '50', ordem: 4, ativo: false }
];
const S = (id, nome, grupo, ordem, o = {}) => ({ id, nome, grupo, tipo: 'incluso', valor_avulso: null, ordem, ativo: true, ...o });
const SERVICOS = [
  S('anual1', 'Declaração do ano', 'anual', 5), S('guia', 'Guia do mês', 'mensal', 1), S('notas', 'Emissão de NFs inclusas no plano (até X/mês)', 'mensal', 2),
  S('folha', 'Folha do mês', 'mensal', 3), S('receita', 'Acompanhamento na Receita', 'semestral', 4), S('reuniao', 'Reunião do mês', 'mensal', 6),
  S('fora', 'Serviço que nenhum plano tem', 'demanda', 7), S('baixa', 'Baixa do MEI', 'demanda', 8), S('dasn', 'Declaração Anual', 'anual', 9),
  S('morto', 'Serviço desligado', 'mensal', 10, { ativo: false }),
  S('nf_extra', 'Notas além do plano', 'separado', 11, { tipo: 'quantidade', valor_avulso: '3.50' }),
  S('parc', 'Acompanhamento de parcelamento', 'separado', 12, { tipo: 'sim_nao' })
];
const COMP = {
  basico: new Set(['guia', 'notas', 'receita', 'baixa', 'dasn', 'anual1', 'morto']),
  cresce: ['guia', 'reuniao', 'receita', 'baixa', 'dasn', 'anual1'],
  equipe: new Set(['guia', 'folha', 'receita', 'baixa', 'dasn'])
};

console.log('Os planos:');
chk('do mais barato pro mais caro, o empate pela ordem da aba, sem o desligado', igual(planosEmOrdem(PLANOS).map(p => p.id), ['basico', 'cresce', 'equipe']));
chk('o mais simples é o mais barato', planoMaisSimples(PLANOS).id === 'basico' && planoMaisSimples([]) === null);
chk('sem nada marcado, recomenda o mais simples', igual(recomendados(PLANOS, new Set()), ['basico']) && igual(recomendados(PLANOS, null), ['basico']));
chk('o marcado na tela é o recomendado', igual(recomendados(PLANOS, new Set(['equipe'])), ['equipe']));
chk('dois marcados: os dois, na ordem dos planos', igual(recomendados(PLANOS, ['equipe', 'basico']), ['basico', 'equipe']));
chk('marcado que não existe (ou desligado) não conta', igual(recomendados(PLANOS, ['velho', 'xx']), ['basico']));
chk('sem planos, ninguém', igual(recomendados([], ['x']), []));
chk('o nome curto da coluna', nomeCurto('MEI EM DIA') === 'Em Dia' && nomeCurto('MEI GESTÃO FINANCEIRA') === 'Gestão Financeira'
  && nomeCurto('MEI EQUIPE DE PGTO.') === 'Equipe de Pgto.' && nomeCurto('MEI') === 'Mei', [nomeCurto('MEI EQUIPE DE PGTO.'), nomeCurto('MEI')]);

console.log('Os serviços:');
chk('as notas inclusas: o número da proposta, senão o padrão', qtdNotas('5') === 5 && qtdNotas(' 3 ') === 3 && qtdNotas('') === NFS_PADRAO
  && qtdNotas('abc') === NFS_PADRAO && qtdNotas('0') === NFS_PADRAO && qtdNotas(null) === NFS_PADRAO && qtdNotas('2,0') === 2 && NFS_PADRAO === 2);
chk('a emissão de notas sai com o número', nomeDoServico({ id: 'nfs_plano', nome: 'x' }, '4') === 'Emissão de até 4 notas fiscais por mês'
  && nomeDoServico({ id: 'nfs_plano', nome: 'x' }, '1') === 'Emissão de até 1 nota fiscal por mês');
chk('o "(até X/mês)" do cadastro sai do nome', nomeDoServico({ id: 'notas', nome: 'Emissão de NFs inclusas no plano (até X/mês)' }) === 'Emissão de NFs inclusas no plano');
chk('juntar: "a, b e c"', juntar(['a', 'b', 'c']) === 'a, b e c' && juntar(['a']) === 'a' && juntar([]) === '' && juntar(['a', '', 'b']) === 'a e b');

const v = montarVitrine({ planos: PLANOS, servicos: SERVICOS, comp: COMP, nfs: '' });
chk('os planos na vitrine: o nome, o curto, o preço e quantos serviços', igual(v.planos.map(p => [p.id, p.curto, p.valor, p.servicos]),
  [['basico', 'Básico', 200, 6], ['cresce', 'Cresce Mais', 300, 6], ['equipe', 'Equipe de Pgto.', 300, 5]]), v.planos.map(p => [p.id, p.curto, p.valor, p.servicos]));
chk('os grupos na ordem de quem lê, só com o que algum plano tem', igual(v.grupos.map(g => g.id), ['mensal', 'semestral', 'anual', 'demanda'])
  && igual(GRUPOS.map(g => g[0]), ['mensal', 'semestral', 'anual', 'demanda']));
const linha = id => v.grupos.flatMap(g => g.linhas).find(l => l.id === id);
chk('o ✓ de cada plano, na ordem dos planos', igual(linha('guia').em, [true, true, true]) && igual(linha('reuniao').em, [false, true, false])
  && igual(linha('folha').em, [false, false, true]));
chk('a linha pela ordem do cadastro dentro do grupo', igual(v.grupos[0].linhas.map(l => l.id), ['guia', 'notas', 'folha', 'reuniao']));
chk('o serviço que nenhum plano tem fica fora, e o desligado também', !linha('fora') && !linha('morto'));
chk('as notas inclusas com o padrão quando a proposta não diz', linha('notas').nome === 'Emissão de NFs inclusas no plano');
const v4 = montarVitrine({ planos: PLANOS, servicos: [...SERVICOS, S('nfs_plano', 'Emissão (até X/mês)', 'mensal', 2)], comp: { ...COMP, basico: new Set([...COMP.basico, 'nfs_plano']) }, nfs: '4' });
chk('a emissão do cadastro de verdade (nfs_plano) com o número da proposta', v4.grupos[0].linhas.some(l => l.nome === 'Emissão de até 4 notas fiscais por mês'));
chk('os destaques: o que o plano tem e nem todos têm, até 3', igual(v.planos[0].destaques, ['Emissão de NFs inclusas no plano', 'Declaração do ano'])
  && igual(v.planos[1].destaques, ['Reunião do mês', 'Declaração do ano']) && igual(v.planos[2].destaques, ['Folha do mês']), v.planos.map(p => p.destaques));
chk('o que todos têm, dito curto (só os que estão em todos)', montarVitrine({ planos: PLANOS, servicos: [S('das', 'x', 'mensal', 1), S('dasn', 'y', 'anual', 2), S('sitfiscal', 'z', 'semestral', 3)],
  comp: { basico: ['das', 'dasn', 'sitfiscal'], cresce: ['das', 'dasn'], equipe: ['das', 'dasn', 'sitfiscal'] } }).comuns === 'a guia do DAS todo mês e a declaração anual');
chk('o que é cobrado à parte, com o imposto de renda no fim', igual(v.aParte.map(a => [a.id, a.valor, a.porUnidade]), [['nf_extra', 3.5, true], ['parc', null, false], ['irpf', null, false]])
  && v.aParte[2].nome === IRPF_A_PARTE);
chk('o preço do cobrado à parte', precoAParte(v.aParte[0]) === 'R$ 3,50 por nota' && precoAParte(v.aParte[1]) === ''
  && precoAParte({ nome: 'Guia extra', valor: 5, porUnidade: true }) === 'R$ 5,00 cada' && precoAParte({ nome: 'Taxa', valor: 10, porUnidade: false }) === 'R$ 10,00');
chk('o comp também pode vir num Map', montarVitrine({ planos: PLANOS, servicos: SERVICOS, comp: new Map(Object.entries(COMP)) }).planos[0].servicos === 6);
chk('sem nada, a vitrine vazia (com o imposto de renda à parte)', igual(montarVitrine({}), { planos: [], grupos: [], comuns: '', aParte: [{ id: 'irpf', nome: IRPF_A_PARTE, valor: null, porUnidade: false }] }));

console.log('O cliente e a mensagem:');
chk('o primeiro nome do MEI (sem o CNPJ da frente)', primeiroNome('63.829.984 FULANA DE TAL') === 'Fulana' && primeiroNome('beltrana') === 'Beltrana'
  && primeiroNome('') === '' && primeiroNome('12.345.678') === '' && primeiroNome('  Ana Clara ') === 'Ana', primeiroNome('63.829.984 FULANA DE TAL'));
chk('os valores', reais(250) === 'R$ 250,00' && reais('1234.5') === 'R$ 1.234,50' && reaisCurto(250) === 'R$ 250' && reaisCurto(3.5) === 'R$ 3,50'
  && reaisCurto(1250) === 'R$ 1.250');
chk('o escritório com o registro no CRC', ESCRITORIO.includes('CRC/RS 006418/O'));
const m = mensagemWhats({ nome: '63.829.984 FULANA DE TAL', quem: 'Samuel', vitrine: v, recomendados: ['basico'] });
chk('a mensagem: o nome, quem fala, os planos e o recomendado mais simples', m.startsWith('Oi, Fulana! Tudo bem? Aqui é o Samuel, da Macedo & Reis Contabilidade.')
  && m.includes('a gente tem 3 planos mensais') && m.includes('Te mandei duas imagens')
  && m.includes('Pra começar, eu recomendo o MEI BÁSICO, de R$ 200,00 por mês. É o mais simples: o essencial do mês.')
  && m.trim().endsWith('já te mando a proposta do plano que você escolher.'), m);
chk('o que todos têm, dito curto, na mensagem (aqui, só a declaração anual)', m.includes('\n\nTodos já incluem a declaração anual.\n\n'), m);
chk('sem nada em comum dito curto, a linha não entra', !mensagemWhats({ nome: 'Ana', vitrine: montarVitrine({ planos: PLANOS, servicos: SERVICOS.filter(x => x.id !== 'dasn'), comp: COMP }), recomendados: ['basico'] }).includes('Todos já incluem'));
const m2 = mensagemWhats({ nome: '', quem: 'Thalia', vitrine: v, recomendados: ['basico', 'equipe'] });
chk('dois recomendados: os dois e a soma; sem nome, sem vírgula', m2.startsWith('Oi! Tudo bem? Aqui é a Thalia,')
  && m2.includes('eu recomendo o MEI BÁSICO (R$ 200,00) e o MEI EQUIPE DE PGTO. (R$ 300,00): R$ 500,00 por mês, juntos.'), m2);
const m3 = mensagemWhats({ nome: 'Ana', quem: null, vitrine: v, recomendados: ['equipe'] });
chk('o recomendado que não é o mais simples vai com o pra quem é; sem quem fala, o escritório', m3.includes('Aqui é da Macedo & Reis Contabilidade.')
  && m3.includes('eu recomendo o MEI EQUIPE DE PGTO., de R$ 300,00 por mês. Pra quem tem funcionário.'), m3);
const m4 = mensagemWhats({ nome: 'Ana', quem: 'Fulano', vitrine: v, recomendados: ['basico'] });
chk('quem fala de fora da equipe, sem artigo e sem espaço sobrando', m4.includes('Aqui é Fulano, da Macedo'), m4.split('\n')[0]);
const vc = montarVitrine({ planos: PLANOS.slice(0, 2), servicos: [S('das', 'x', 'mensal', 1), S('dasn', 'y', 'anual', 2)], comp: { basico: ['das', 'dasn'], cresce: ['das', 'dasn'] } });
chk('com o que todos têm, a mensagem diz', mensagemWhats({ nome: 'Ana', quem: 'Samuel', vitrine: vc, recomendados: ['basico'] }).includes('Todos já incluem a guia do DAS todo mês e a declaração anual.'));
chk('quantas imagens, por extenso', quantasImagens(1) === 'uma imagem' && quantasImagens(2) === 'duas imagens' && quantasImagens(4) === 'quatro imagens'
  && quantasImagens(12) === '12 imagens' && quantasImagens('') === 'uma imagem', [quantasImagens(4), quantasImagens(12)]);
chk('duas imagens: a primeira com os planos, a segunda com a lista', m.includes('Te mandei duas imagens: na primeira, os planos; na segunda, tudo o que cada um inclui.'), m);
const m5 = mensagemWhats({ nome: 'Ana', quem: 'Samuel', vitrine: v, recomendados: ['basico'], imagens: 4 });
chk('a lista em mais de uma imagem: a mensagem diz quantas', m5.includes('Te mandei quatro imagens: na primeira, os planos; nas outras, tudo o que cada um inclui.'), m5);

console.log('As páginas da lista (nenhuma imagem passa de ' + ALTURA_MAX + ' px):');
const somas = pags => pags.map(pg => pg.reduce((s, b) => s + b.h, 0));
const G = (rotulo, h = 62) => ({ tipo: 'grupo', rotulo, h });
const Ln = (rotulo, h = 100) => ({ tipo: 'linha', rotulo, h });
chk('a largura e a altura de cada imagem', LARGURA === 1080 && ALTURA_MAX === 1600);
chk('o que cabe numa página fica numa só', paginar([G('Todo mês'), Ln('Todo mês'), Ln('Todo mês'), { tipo: 'aParte', h: 200 }], 1000, 62).length === 1);
const seis = [G('Todo mês'), ...Array.from({ length: 6 }, () => Ln('Todo mês')), { tipo: 'aParte', h: 300 }];
const p1 = empacotar(seis, 700, 62);
chk('sem caber, a página seguinte: o resto do grupo ganha o nome de novo, com a continuação', p1.length === 2 && igual(somas(p1), [662, 300]), somas(p1));
const p2 = paginar(seis, 700, 62);
chk('as páginas parecidas: a menor altura com o mesmo número de páginas (não uma cheia e a outra quase vazia)', p2.length === 2 && igual(somas(p2), [562, 462])
  && p2[1][0].tipo === 'grupo' && p2[1][0].continua === true && p2[1][0].rotulo === 'Todo mês', somas(p2));
const p3 = empacotar([G('Todo mês'), Ln('Todo mês', 300), G('Todo ano'), Ln('Todo ano', 300), { tipo: 'aParte', h: 50 }], 700, 62);
chk('o nome do grupo vai junto com a primeira linha dele (não fica sozinho no fim da página)', p3.length === 2 && p3[1][0].tipo === 'grupo' && !p3[1][0].continua && p3[1][0].rotulo === 'Todo ano', p3.map(pg => pg.map(b => b.tipo)));
chk('nenhuma página passa da altura que cabe', paginar(Array.from({ length: 40 }, (_, i) => i % 8 === 0 ? G('g' + i) : Ln('g' + (i - (i % 8)), 58 + (i % 3) * 32)), 1000, 62)
  .every(pg => pg.reduce((s, b) => s + b.h, 0) <= 1000));
chk('sem blocos, uma página vazia', igual(paginar([], 1000, 62), [[]]));

console.log('A janela:');
chk('o aviso do recomendado: o mais simples', textoDaRecomendacao(PLANOS, ['basico']) === 'Recomendado: MEI BÁSICO, o mais simples. Clique num plano pra mudar a recomendação.', textoDaRecomendacao(PLANOS, ['basico']));
chk('o aviso: outro plano, sem o "mais simples" (e sem o ponto dobrado no nome que termina em ponto)', textoDaRecomendacao(PLANOS, ['equipe']) === 'Recomendado: MEI EQUIPE DE PGTO. Clique num plano pra mudar a recomendação.'
  && textoDaRecomendacao(PLANOS, ['cresce']) === 'Recomendado: MEI CRESCE MAIS. Clique num plano pra mudar a recomendação.', [textoDaRecomendacao(PLANOS, ['equipe']), textoDaRecomendacao(PLANOS, ['cresce'])]);
chk('o aviso: dois planos, com a soma', textoDaRecomendacao(PLANOS, ['equipe', 'basico']) === 'Recomendados: MEI BÁSICO + MEI EQUIPE DE PGTO., R$ 500,00 por mês, juntos. Clique num plano pra mudar.', textoDaRecomendacao(PLANOS, ['equipe', 'basico']));
chk('o nome do arquivo: o primeiro nome do cliente e qual imagem', nomeDoArquivo('63.829.984 FULANA DE TAL', 1, 4) === 'Planos MEI - Fulana (2 de 4).png' && nomeDoArquivo('', 0, 3) === 'Planos MEI (1 de 3).png');
// a leitura do banco: as colunas uma a uma, só os ativos, na ordem; o que cada plano tem num conjunto
const pedidos = [];
const banco = (erroEm) => ({ from: tabela => {
  const q = { cols: null, filtros: [], ordem: null };
  const dados = { mei_planos: [PLANOS[0]], mei_servicos: [SERVICOS[0]], mei_plano_servicos: [{ plano_id: 'basico', servico_id: 'guia' }, { plano_id: 'basico', servico_id: 'dasn' }] }[tabela];
  const fim = () => { pedidos.push({ tabela, ...q }); return Promise.resolve(erroEm === tabela ? { data: null, error: { message: 'permission denied' } } : { data: dados, error: null }); };
  const c = { select: cols => { q.cols = cols; return c; }, eq: (k, v) => { q.filtros.push([k, v]); return c; }, order: k => { q.ordem = k; return c; }, then: (r, j) => fim().then(r, j) };
  return c;
} });
const cat = await lerCatalogoMei(banco());
chk('a leitura do catálogo: as colunas explícitas, só os ativos, na ordem', igual(pedidos.map(x => [x.tabela, x.cols, x.filtros, x.ordem]), [
  ['mei_planos', COLS_PLANOS, [['ativo', true]], 'ordem'], ['mei_servicos', COLS_SERVICOS, [['ativo', true]], 'ordem'], ['mei_plano_servicos', COLS_COMP, [], null]])
  && !/\*/.test(COLS_PLANOS + COLS_SERVICOS + COLS_COMP), pedidos);
chk('o que cada plano tem, num conjunto', cat.comp.basico instanceof Set && igual([...cat.comp.basico], ['guia', 'dasn']) && cat.planos.length === 1 && cat.servicos.length === 1);
chk('a leitura que falha devolve o erro, sem a mensagem do banco', igual(await lerCatalogoMei(banco('mei_servicos')), { erro: true }));

console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
