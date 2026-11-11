// As vedações ao Simples Nacional que o cadastro mostra (assets/js/simples-vedacoes.js): as listas dos Anexos VI e VII da
// Res. CGSN 140/2018, o código do CNAE como o cadastro guarda, o CNAE principal e os secundários, a pessoa jurídica entre
// os sócios, a natureza jurídica (pelo código ou pelo nome), as pendências na Receita, o que faltou no cadastro e as frases
// que a tela e o assistente mostram. Rodar com: node tests/simples-vedacoes.test.mjs — dados inventados (o repositório é público).

import { LISTAS_CONFERIDAS_EM, CNAES_IMPEDITIVOS, CNAES_AMBIGUOS, codigoCnae, cnaeImpeditivo, cnaeAmbiguo, BASE_CNAE_IMPEDITIVO, BASE_CNAE_AMBIGUO, NAO_CONFERE,
  vedacoesDoSimples, oQueConferiu, resumoDasVedacoes, linhaDasVedacoes } from '../assets/js/simples-vedacoes.js';
import { digitosCnae } from '../assets/js/dominio-relatorios.js';

let falhas = 0, total = 0;
function ok(nome, cond, extra) {
  total++;
  if (!cond) falhas++;
  console.log((cond ? '  ok ' : 'FALHA') + '  ' + nome + (cond || extra == null ? '' : '  → ' + JSON.stringify(extra).slice(0, 500)));
}

console.log('=== as listas (Res. CGSN 140/2018, Anexos VI e VII) ===');
ok('101 códigos impeditivos e 22 que abrangem atividade impeditiva e permitida', CNAES_IMPEDITIVOS.size === 101 && CNAES_AMBIGUOS.size === 22, [CNAES_IMPEDITIVOS.size, CNAES_AMBIGUOS.size]);
ok('todos com 7 dígitos, e nenhum nas duas listas', [...CNAES_IMPEDITIVOS, ...CNAES_AMBIGUOS].every(c => /^\d{7}$/.test(c)) && ![...CNAES_AMBIGUOS].some(c => CNAES_IMPEDITIVOS.has(c)));
ok('a data da conferência das listas', /^\d{4}-\d{2}-\d{2}$/.test(LISTAS_CONFERIDAS_EM));
// os de sempre: banco, cigarro, automóvel, energia, incorporação, locação de mão de obra, holding e participações, cartório
ok('impeditivos conhecidos', ['6422-1/00', '1220-4/01', '2910-7/01', '3511-5/01', '4110-7/00', '7820-5/00', '6462-0/00', '6463-8/00', '6912-5/00', '6911-7/02', '8112-5/00'].every(cnaeImpeditivo));
ok('permitidos conhecidos: mercado, restaurante, contabilidade, software, fabricação de óleos, compra e venda de imóveis próprios e atacado de óleos',
  !['4711-3/02', '5611-2/01', '6920-6/01', '6201-5/01', '1091-1/02', '6810-2/01', '4637-1/04'].some(c => cnaeImpeditivo(c) || cnaeAmbiguo(c)));
ok('os que abrangem as duas: atacado de bebidas, transporte escolar, outras atividades de serviços', ['4635-4/02', '4635-4/99', '4924-8/00', '8299-7/99'].every(c => cnaeAmbiguo(c) && !cnaeImpeditivo(c)));
ok('os de software saíram do Anexo VII (Res. CGSN 150/2019)', !['6201-5/01', '6202-3/00', '6203-1/00'].some(cnaeAmbiguo));

console.log('=== o código do CNAE como o cadastro guarda ===');
ok('com o nome, com a máscara e só os dígitos', codigoCnae('1091-1/02 - Fabricação de produtos de padaria e confeitaria com predominância de produção própria') === '1091102' && codigoCnae('7820-5/00') === '7820500' && codigoCnae('7820500') === '7820500');
ok('com 6 dígitos, o zero da frente (o CNAE que veio como número)', codigoCnae('161003') === '0161003' && codigoCnae(161003) === '0161003');
ok('o nome com hífen e números não confunde', codigoCnae('4635-4/02 - Comércio atacadista de cerveja, chope e refrigerante - 2 litros') === '4635402');
ok('vazio, texto sem código e código incompleto: sem código', codigoCnae('') === '' && codigoCnae(null) === '' && codigoCnae('Fabricação') === '' && codigoCnae('4711') === '');
ok('igual ao digitosCnae da Reforma no código sozinho', ['1091-1/02', '0161-0/03', '161003', '7820-5/00'].every(c => codigoCnae(c) === digitosCnae(c)));

console.log('=== o cadastro sem nada que vede ===');
const limpo = vedacoesDoSimples({ cnaePrincipal: '4711-3/02 - Comércio varejista de mercadorias em geral', cnaesSecundarios: ['4712-1/00 - Minimercados', '4721-1/02 - Padaria'], naturezaJuridica: '206-2 - Sociedade Empresária Limitada',
  socios: [{ nome: 'FULANO DE TAL', pj: false, participacao: 60 }, { nome: 'BELTRANA DE TAL', pj: false, participacao: 40 }], pendencias: [], pendenciasEm: '2026-11-03' });
ok('sem impedimento, sem o que conferir e sem dado faltando', !limpo.vedado && limpo.impedimentos.length === 0 && limpo.conferir.length === 0 && limpo.semDado.length === 0, limpo);
ok('o que o cadastro deixou conferir, com a conta dos secundários', oQueConferiu(limpo) === 'o CNAE principal e os 2 secundários, a natureza jurídica e os sócios', oQueConferiu(limpo));
ok('um secundário só, no singular', oQueConferiu(vedacoesDoSimples({ cnaePrincipal: '4711-3/02', cnaesSecundarios: ['4712-1/00'], naturezaJuridica: '2062', socios: [{ nome: 'A', pj: false }] })) === 'o CNAE principal e o secundário, a natureza jurídica e os sócios');
ok('sem secundário no cadastro, a frase diz (a empresa pode não ter, ou o cadastro não foi completado)',
  oQueConferiu(vedacoesDoSimples({ cnaePrincipal: '4711-3/02', cnaesSecundarios: null, naturezaJuridica: '2062', socios: [{ nome: 'A', pj: false }] })) === 'o CNAE principal (sem secundário no cadastro), a natureza jurídica e os sócios');
ok('o resumo vazio', resumoDasVedacoes(limpo) === '' && resumoDasVedacoes(null) === '');

console.log('=== o CNAE ===');
const sec = vedacoesDoSimples({ cnaePrincipal: '1091-1/02 - Fabricação de produtos de padaria e confeitaria com predominância de produção própria', naturezaJuridica: '2062', socios: [{ nome: 'A', pj: false }],
  cnaesSecundarios: ['4637-1/04 - Comércio atacadista de pães, bolos, biscoitos e similares', '7820-5/00 - Locação de mão-de-obra temporária', '6462-0/00 - Holdings de instituições não-financeiras', '7820-5/00 - Locação de mão-de-obra temporária'] });
ok('o secundário impeditivo veda, mesmo com o principal permitido (a opção olha todos os CNAEs do CNPJ)', sec.vedado && sec.impedimentos.length === 2 && sec.impedimentos.every(i => i.tipo === 'cnae' && i.onde === 'secundario' && i.base === BASE_CNAE_IMPEDITIVO), sec.impedimentos);
ok('o texto com o código e o nome da atividade, e o remédio (tirar o CNAE)', sec.impedimentos[0].texto === 'CNAE secundário impeditivo: 7820-5/00 (Locação de mão-de-obra temporária)' && sec.impedimentos[0].codigo === '7820-5/00'
  && /tirar o CNAE por alteração resolve/.test(sec.impedimentos[0].remedio), sec.impedimentos[0]);
ok('o mesmo código duas vezes conta uma, e os secundários são os 4 do cadastro', sec.impedimentos.filter(i => i.codigo === '7820-5/00').length === 1 && sec.secundarios === 4);
const princ = vedacoesDoSimples({ cnaePrincipal: '6422-1/00 - Bancos múltiplos, com carteira comercial', naturezaJuridica: '2062', socios: [{ nome: 'A', pj: false }] });
ok('o principal impeditivo: sem remédio de tirar o CNAE', princ.vedado && princ.impedimentos[0].onde === 'principal' && /^CNAE principal impeditivo: 6422-1\/00 \(Bancos múltiplos, com carteira comercial\)$/.test(princ.impedimentos[0].texto) && !princ.impedimentos[0].remedio);
const amb = vedacoesDoSimples({ cnaePrincipal: '4635-4/02 - Comércio atacadista de cerveja, chope e refrigerante', cnaesSecundarios: ['8299-7/99 - Outras atividades de serviços prestados principalmente às empresas'], naturezaJuridica: '2062', socios: [{ nome: 'A', pj: false }] });
ok('o que abrange as duas não veda: fica a conferir, com a declaração', !amb.vedado && amb.conferir.length === 2 && amb.conferir.every(i => i.base === BASE_CNAE_AMBIGUO) && /^CNAE principal que abrange atividade impeditiva e permitida: 4635-4\/02/.test(amb.conferir[0].texto)
  && /declaração de que a empresa só exerce a permitida/.test(amb.conferir[0].texto) && /^CNAE secundário que abrange/.test(amb.conferir[1].texto), amb.conferir);
ok('sem o CNAE principal: falta no cadastro, e a frase não diz que olhou', vedacoesDoSimples({ naturezaJuridica: '2062', socios: [{ nome: 'A', pj: false }] }).semDado.join() === 'o CNAE'
  && oQueConferiu(vedacoesDoSimples({ naturezaJuridica: '2062', socios: [{ nome: 'A', pj: false }] })) === 'a natureza jurídica e os sócios');

console.log('=== os sócios ===');
const pj = vedacoesDoSimples({ cnaePrincipal: '4711-3/02', naturezaJuridica: '2062', socios: [{ nome: 'FULANA DE TAL', pj: false, participacao: 50 }, { nome: 'HOLDING INVENTADA LTDA', pj: true, participacao: 50 }, { nome: null, pj: true, participacao: null }] });
ok('pessoa jurídica no quadro veda, com a participação', pj.vedado && pj.impedimentos.length === 2 && pj.impedimentos[0].tipo === 'socio_pj' && pj.impedimentos[0].texto === 'Pessoa jurídica no quadro de sócios: HOLDING INVENTADA LTDA (50% do capital)'
  && pj.impedimentos[0].base === 'LC 123, art. 3º, §4º, I', pj.impedimentos);
ok('sem nome no cadastro, diz', pj.impedimentos[1].texto === 'Pessoa jurídica no quadro de sócios: sem nome no cadastro');
ok('o documento do sócio não entra nem sai (só o "pj")', !JSON.stringify(vedacoesDoSimples({ cnaePrincipal: '4711-3/02', naturezaJuridica: '2062', socios: [{ nome: 'X', pj: true, cpf: '12.345.678/0001-99' }] })).includes('12.345.678'));
ok('sem os sócios no cadastro (não lidos, ou a lista vazia): falta, e a frase não diz que olhou', vedacoesDoSimples({ cnaePrincipal: '4711-3/02', naturezaJuridica: '2062', socios: null }).semDado.join() === 'os sócios'
  && vedacoesDoSimples({ cnaePrincipal: '4711-3/02', naturezaJuridica: '2062', socios: [] }).semDado.join() === 'os sócios'
  && oQueConferiu(vedacoesDoSimples({ cnaePrincipal: '4711-3/02', naturezaJuridica: '2062', socios: [] })) === 'o CNAE principal (sem secundário no cadastro) e a natureza jurídica');
const ind = vedacoesDoSimples({ cnaePrincipal: '4711-3/02', naturezaJuridica: 'Empresário (Individual)', socios: [] });
ok('o empresário individual não tem quadro de sócios: não é dado que falta (pelo nome e pelo código)', ind.semDado.length === 0 && oQueConferiu(ind) === 'o CNAE principal (sem secundário no cadastro) e a natureza jurídica'
  && vedacoesDoSimples({ cnaePrincipal: '4711-3/02', naturezaJuridica: '213-5 - Empresário (Individual)', socios: null }).semDado.length === 0 && vedacoesDoSimples({ cnaePrincipal: '4711-3/02', naturezaJuridica: '2135', socios: [] }).semDado.length === 0, ind);

console.log('=== a natureza jurídica (pelo código ou pelo nome, que é o que a consulta do CNPJ grava) ===');
const nat = n => vedacoesDoSimples({ cnaePrincipal: '4711-3/02', naturezaJuridica: n, socios: [{ nome: 'A', pj: false }] });
ok('a limitada, a simples, a unipessoal de advocacia e a cooperativa de consumo podem', ['2062', '206-2 - Sociedade Empresária Limitada', 'Sociedade Empresária Limitada', 'Sociedade Simples Limitada', '224-0', 'Sociedade Unipessoal de Advocacia', 'Cooperativa de Consumo', '233-0']
  .every(n => !nat(n).vedado && nat(n).semDado.length === 0));
ok('a sociedade anônima, pelo código', nat('2054').impedimentos[0].texto === 'Natureza jurídica 205-4: sociedade anônima fechada' && nat('205-4').vedado && nat('2046').impedimentos[0].base === 'LC 123, art. 3º, §4º, X', nat('2054').impedimentos);
ok('pelo código com o nome, e só pelo nome (com ou sem acento)', nat('205-4 - Sociedade Anônima Fechada').impedimentos[0].texto === 'Natureza jurídica 205-4 (Sociedade Anônima Fechada)'
  && nat('Sociedade Anônima Fechada').impedimentos[0].texto === 'Natureza jurídica: Sociedade Anônima Fechada' && nat('SOCIEDADE ANONIMA ABERTA').vedado);
ok('a cooperativa (só a de consumo pode), a filial de estrangeira, a empresa pública e a de economia mista', /^Natureza jurídica: Cooperativa — só a cooperativa de consumo pode optar$/.test(nat('Cooperativa').impedimentos[0].texto) && nat('2143').impedimentos[0].base === 'LC 123, art. 3º, §4º, VI'
  && nat('2178').impedimentos[0].base === 'LC 123, art. 3º, §4º, II' && nat('Empresa Pública').vedado && nat('2038').vedado && nat('Sociedade em Comandita por Ações').vedado);
ok('a associação, a fundação, o sindicato e a igreja: fora do conceito de ME e EPP (pelo nome e pelo código 3xx-x)', ['Associação Privada', '399-9 - Associação Privada', '3999', 'Fundação Privada', 'Entidade Sindical', 'Organização Religiosa', '1244']
  .every(n => nat(n).vedado && nat(n).impedimentos[0].base === 'LC 123, art. 3º, caput' && /fica fora do conceito de microempresa e de empresa de pequeno porte$/.test(nat(n).impedimentos[0].texto)), nat('Associação Privada').impedimentos);
ok('sem a natureza no cadastro: falta, e a frase não diz que olhou', nat(null).semDado.join() === 'a natureza jurídica' && nat('').semDado.join() === 'a natureza jurídica' && oQueConferiu(nat(null)) === 'o CNAE principal (sem secundário no cadastro) e os sócios');

console.log('=== as pendências na Receita ===');
const pend = vedacoesDoSimples({ cnaePrincipal: '4711-3/02', naturezaJuridica: '2062', socios: [{ nome: 'A', pj: false }], pendencias: [{ orgao: 'RFB', titulo: 'x' }, { orgao: 'PGFN', titulo: 'y' }], pendenciasEm: '2026-11-03' });
ok('não vedam sozinhas: ficam a conferir (o relatório não diz se a exigibilidade está suspensa)', !pend.vedado && pend.conferir.length === 1 && pend.conferir[0].tipo === 'debito'
  && pend.conferir[0].texto === 'O relatório de situação fiscal de 03/11/2026 tem 2 pendências na Receita ou na PGFN. Débito sem exigibilidade suspensa impede a opção' && pend.conferir[0].base === 'LC 123, art. 17, V', pend.conferir);
ok('uma pendência, no singular e sem a data', /tem 1 pendência na Receita/.test(vedacoesDoSimples({ cnaePrincipal: '4711-3/02', naturezaJuridica: '2062', socios: [{ nome: 'A' }], pendencias: [{ orgao: 'RFB' }] }).conferir[0].texto));
ok('sem pendência, ou sem a consulta da ponte: nada a conferir', limpo.conferir.length === 0 && vedacoesDoSimples({ cnaePrincipal: '4711-3/02', naturezaJuridica: '2062', socios: [{ nome: 'A' }], pendencias: null }).conferir.length === 0);

console.log('=== as frases ===');
const tudo = vedacoesDoSimples({ cnaePrincipal: '1091-1/02 - Fabricação de produtos de padaria', cnaesSecundarios: ['7820-5/00 - Locação de mão-de-obra temporária'], naturezaJuridica: '2062', socios: [{ nome: 'HOLDING INVENTADA LTDA', pj: true, participacao: 50 }] });
ok('o resumo numa frase: a primeira letra minúscula, menos na sigla; com e sem a base legal',
  resumoDasVedacoes(tudo) === 'CNAE secundário impeditivo: 7820-5/00 (Locação de mão-de-obra temporária) (' + BASE_CNAE_IMPEDITIVO + ') · pessoa jurídica no quadro de sócios: HOLDING INVENTADA LTDA (50% do capital) (LC 123, art. 3º, §4º, I)'
  && resumoDasVedacoes(tudo, { comBase: false }) === 'CNAE secundário impeditivo: 7820-5/00 (Locação de mão-de-obra temporária) · pessoa jurídica no quadro de sócios: HOLDING INVENTADA LTDA (50% do capital)', resumoDasVedacoes(tudo));
ok('o que o sistema não confere: dito, com a base de cada um', NAO_CONFERE.length === 5 && NAO_CONFERE.every(t => /\((LC 123, )?art\. /.test(t)) && /sócio domiciliado no exterior/.test(NAO_CONFERE[0]) && /cessão ou locação de mão de obra de fato/.test(NAO_CONFERE.join()));
ok('sem argumento: tudo falta, nada veda', (() => { const v = vedacoesDoSimples(); return !v.vedado && v.semDado.join() === 'o CNAE,os sócios,a natureza jurídica' && oQueConferiu(v) === ''; })());
// a linha da opção com o Simples, na pergunta "Qual comparativo" (11/11/2026): quantos impedimentos, ou que nada veda
ok('numa linha: vedado, com quantos impedimentos (no singular e no plural)', linhaDasVedacoes(tudo) === 'Hoje o cadastro veda o Simples pra ela (2 impedimentos): ele entra como simulação.'
  && linhaDasVedacoes(nat('2054')) === 'Hoje o cadastro veda o Simples pra ela (1 impedimento): ele entra como simulação.', linhaDasVedacoes(tudo));
ok('numa linha: nada veda; com as pendências a conferir; e com o que faltou no cadastro', linhaDasVedacoes(limpo) === 'Pelo cadastro, nada veda o Simples.' && linhaDasVedacoes(pend) === 'Pelo cadastro, nada veda o Simples (1 ponto a conferir).'
  && linhaDasVedacoes(nat(null)) === 'Pelo cadastro, nada veda o Simples (faltou no cadastro: a natureza jurídica).', [linhaDasVedacoes(limpo), linhaDasVedacoes(pend), linhaDasVedacoes(nat(null))]);
ok('numa linha: sem cadastro, e com o cadastro sem nada pra olhar', linhaDasVedacoes(null) === 'Sem cadastro, o sistema não confere os impedimentos do Simples.'
  && linhaDasVedacoes(vedacoesDoSimples()) === 'O cadastro não tem o que conferir dos impedimentos do Simples (faltou no cadastro: o CNAE, os sócios, a natureza jurídica).', linhaDasVedacoes(vedacoesDoSimples()));
ok('a linha não traz nome de sócio nem base legal (o detalhe fica onde o Simples está no estudo)', !/HOLDING|LC 123|CGSN|7820/.test(linhaDasVedacoes(tudo)));

console.log('\n' + (total - falhas) + ' de ' + total + ' conferências ok' + (falhas ? ' — ' + falhas + ' FALHA(S)' : ''));
process.exit(falhas ? 1 : 0);
