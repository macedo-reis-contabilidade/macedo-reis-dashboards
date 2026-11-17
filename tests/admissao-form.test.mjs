// O formulário de admissão que a empresa preenche (assets/js/admissao-form.js, 17/11/2026, pedido da Vitória): o que é
// obrigatório, os lugares de anexar (um por documento, dois no de frente e verso), a pergunta que só aparece com uma
// resposta, o que falta pra enviar e o que vai no envio. Rodar com: node tests/admissao-form.test.mjs
import { pedeFrenteEVerso, anexoObrigatorio, itensDe, opcoesDe, grupoDoAnexo, itemDoGrupo, arquivosDoItem, vagasDeAnexo, condicaoDe, blocosVisiveis,
  pendencias, respostasDoEnvio, obrigatoriosDoModelo, problemaDoModelo, MESMO_ARQUIVO, LIMITE_GRUPO, IDENT } from '../assets/js/admissao-form.js';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + extra : '')); };
const J = x => JSON.stringify(x);
const op = (...l) => l.map(texto => ({ texto }));

const DOC = 'Documento com foto (RG ou CNH), frente e verso';
const blocos = [
  /* 0 */ { tipo: 'pergunta', id: 'nome', rotulo: 'Nome do(a) funcionário(a)', formato: 'texto', obrigatoria: true },
  /* 1 */ { tipo: 'documentos', titulo: 'Documentos obrigatórios', anexo_obrigatorio: true, condicional: false, itens: ['Exame médico admissional (ASO)', DOC, '  ', 'Comprovante de endereço'] },
  /* 2 */ { tipo: 'documentos', titulo: 'Outros documentos', condicional: false, itens: ['CPF e Título eleitoral'] },
  /* 3 */ { tipo: 'secao', titulo: 'Informações importantes' },
  /* 4 */ { tipo: 'pergunta', id: 'salario', rotulo: 'Salário', formato: 'texto', obrigatoria: true },
  /* 5 */ { tipo: 'pergunta', id: 'tipo_contrato', rotulo: 'Tipo de Contrato', formato: 'escolha', obrigatoria: true, opcoes: [{ texto: 'Experiência', ajuda: 'até 90 dias' }, { texto: 'Indeterminado' }] },
  /* 6 */ { tipo: 'pergunta', id: 'prazo', rotulo: 'Prazo do contrato de experiência', formato: 'escolha', obrigatoria: true, so_se: { id: 'tipo_contrato', valor: 'Experiência' }, opcoes: op('30 + 30 dias', '45 + 45 dias', 'Outro prazo') },
  /* 7 */ { tipo: 'pergunta', id: 'prazo_outro', rotulo: 'Qual o prazo?', formato: 'texto', obrigatoria: true, so_se: { id: 'prazo', valor: 'Outro prazo' } },
  /* 8 */ { tipo: 'pergunta', id: 'apelido', rotulo: 'Apelido', formato: 'texto', obrigatoria: false },
  /* 9 */ { tipo: 'documentos', titulo: 'Salário família', condicional: true, anexo_obrigatorio: true, itens: ['Certidão de nascimento'] },
  /* 10 */ { tipo: 'declaracao', id: 'ciente', titulo: 'Declaração', rotulo: 'A empresa declara estar ciente', obrigatoria: true, texto: '* texto declarado' },
];
const modelo = { blocos };

console.log('Os documentos e os lugares de anexar:');
chk('"frente e verso" no nome pede os dois lados (com acento, maiúscula ou "frente e o verso"); sem a expressão, um lugar só',
  pedeFrenteEVerso(DOC) && pedeFrenteEVerso('RG - FRENTE E VERSO') && pedeFrenteEVerso('CNH (frente e o verso)') && !pedeFrenteEVerso('RG, frente') && !pedeFrenteEVerso('Comprovante de endereço') && !pedeFrenteEVerso(null));
chk('anexo obrigatório: só a lista de documentos marcada, e nunca a "só quando se aplica"',
  anexoObrigatorio(blocos[1]) && !anexoObrigatorio(blocos[2]) && !anexoObrigatorio(blocos[9]) && !anexoObrigatorio(blocos[0]) && !anexoObrigatorio(null) && !anexoObrigatorio({ tipo: 'documentos', anexo_obrigatorio: 'sim' }));
chk('os itens sem as linhas vazias; as opções pelo texto', J(itensDe(blocos[1])) === J(['Exame médico admissional (ASO)', DOC, 'Comprovante de endereço']) && J(opcoesDe(blocos[5])) === J(['Experiência', 'Indeterminado'])
  && J(opcoesDe({ opcoes: ['Sim', ' Não ', '', null] })) === J(['Sim', 'Não']) && J(itensDe(null)) === '[]');
const vagas = vagasDeAnexo(blocos);
chk('as vagas, na ordem da tela: uma por documento obrigatório, duas no de frente e verso, uma só (opcional) em cada lista comum',
  J(vagas.map(v => [v.chave, v.obrigatoria, v.lado])) === J([['1-0', true, null], ['1-1-f', true, 'f'], ['1-1-v', true, 'v'], ['1-2', true, null], ['2', false, null], ['9', false, null]]), J(vagas.map(v => v.chave)));
chk('o grupo que vai com o arquivo: o documento, com o lado; a lista comum segue com o título dela',
  J(vagas.map(v => v.grupo)) === J(['Exame médico admissional (ASO)', DOC + ' (frente)', DOC + ' (verso)', 'Comprovante de endereço', 'Outros documentos', 'Salário família']));
chk('o nome que a pessoa lê em cada vaga', vagas[1].rotulo === DOC + ' (frente)' && vagas[2].rotulo === DOC + ' (verso)' && vagas[0].rotulo === 'Exame médico admissional (ASO)' && vagas[2].par === '1-1' && vagas[0].par === null);
const longo = 'D'.repeat(150);
chk('o grupo cabe no que a função guarda (120): o documento cortado em ' + LIMITE_GRUPO + ', e a ficha acha o documento de volta',
  grupoDoAnexo(longo, 'v').length === LIMITE_GRUPO + 8 && grupoDoAnexo(longo, 'v').length <= 120 && itemDoGrupo(grupoDoAnexo(DOC, 'f')) === DOC && itemDoGrupo(grupoDoAnexo(DOC)) === DOC && itemDoGrupo('Documentos') === 'Documentos');
const arqs = [{ grupo: DOC + ' (frente)', status: 'ok' }, { grupo: DOC + ' (verso)', status: 'ok' }, { grupo: DOC + ' (verso)', status: 'erro' }, { grupo: 'Exame médico admissional (ASO)', status: 'ok' }, { grupo: 'Documentos', status: 'ok' }, null];
chk('a ficha conta os arquivos que chegaram de cada documento (o que não chegou e o da lista comum não contam)',
  arquivosDoItem(arqs, DOC) === 2 && arquivosDoItem(arqs, 'Exame médico admissional (ASO)') === 1 && arquivosDoItem(arqs, 'Comprovante de endereço') === 0 && arquivosDoItem(null, DOC) === 0 && arquivosDoItem(arqs, '') === 0
  && arquivosDoItem([{ grupo: grupoDoAnexo(longo, 'f'), status: 'ok' }], longo) === 1);

console.log('A pergunta que só aparece com uma resposta:');
chk('a condição: só da pergunta e da declaração, e só inteira', J(condicaoDe(blocos[6])) === J({ id: 'tipo_contrato', valor: 'Experiência' }) && condicaoDe(blocos[4]) === null
  && condicaoDe({ tipo: 'pergunta', so_se: { id: 'x', valor: ' ' } }) === null && condicaoDe({ tipo: 'pergunta', so_se: 'x' }) === null && condicaoDe({ tipo: 'documentos', so_se: { id: 'a', valor: 'b' } }) === null);
const ve = v => blocosVisiveis(blocos, v);
chk('sem o tipo de contrato escolhido, o prazo e o "qual o prazo" ficam escondidos; o resto aparece', J(ve({}).map((x, i) => x ? null : i).filter(x => x !== null)) === J([6, 7]));
chk('com "Experiência", o prazo aparece; o "qual o prazo" só com "Outro prazo"', ve({ 5: 'Experiência' })[6] && !ve({ 5: 'Experiência' })[7] && !ve({ 5: 'Experiência', 6: '45 + 45 dias' })[7] && ve({ 5: 'Experiência', 6: 'Outro prazo' })[7]);
chk('trocou pra "Indeterminado": o prazo some, e quem dependia dele some junto, mesmo com a resposta antiga marcada', !ve({ 5: 'Indeterminado', 6: 'Outro prazo' })[6] && !ve({ 5: 'Indeterminado', 6: 'Outro prazo' })[7]);
const quebrada = [{ tipo: 'pergunta', id: 'a', rotulo: 'A', formato: 'escolha', opcoes: op('Sim', 'Não') },
  { tipo: 'pergunta', id: 'b', rotulo: 'B', formato: 'texto', obrigatoria: true, so_se: { id: 'sumiu', valor: 'Sim' } },
  { tipo: 'pergunta', id: 'c', rotulo: 'C', formato: 'texto', obrigatoria: true, so_se: { id: 'a', valor: 'Talvez' } },
  { tipo: 'pergunta', id: 'd', rotulo: 'D', formato: 'texto', so_se: { id: 'e', valor: 'x' } }, { tipo: 'pergunta', id: 'e', rotulo: 'E', formato: 'texto', so_se: { id: 'd', valor: 'y' } },
  { tipo: 'pergunta', id: 'f', rotulo: 'F', formato: 'texto', so_se: { id: 'f', valor: 'z' } }];
chk('condição quebrada (a pergunta sumiu, a opção saiu da lista, depende de si mesma) deixa a pergunta à vista; em círculo, não trava',
  J(blocosVisiveis(quebrada, {}).slice(0, 3)) === J([true, true, true]) && blocosVisiveis(quebrada, {})[5] === true && blocosVisiveis(quebrada, {}).length === 6);
chk('sem blocos, lista vazia', J(blocosVisiveis(null)) === '[]' && J(vagasDeAnexo(undefined)) === '[]');

console.log('O que falta pra enviar:');
const vazio = pendencias(modelo, {});
chk('formulário em branco: a empresa, quem preenche, o nome, os 4 anexos (o documento conta frente e verso), o salário, o tipo de contrato e a declaração — nesta ordem',
  J(vazio.map(f => f.chave)) === J(['empresa', 'contato', 'q0', '1-0', '1-1-f', '1-1-v', '1-2', 'q4', 'q5', 'q10']), J(vazio.map(f => f.chave)));
chk('cada falta diz o que fazer: preencher, anexar, escolher, marcar', J(vazio.map(f => f.acao)) === J(['preencher', 'preencher', 'preencher', 'anexar', 'anexar', 'anexar', 'anexar', 'preencher', 'escolher', 'marcar'])
  && vazio[0].rotulo === IDENT[0].rot && vazio[4].rotulo === DOC + ' (frente)' && vazio[4].tipo === 'anexo' && vazio[4].bloco === 1 && vazio[9].tipo === 'declaracao');
chk('a pergunta que não é obrigatória, a lista comum e a lista "só quando se aplica" nunca faltam', !vazio.some(f => ['q8', '2', '9', '9-0'].includes(f.chave)));
const cheio = { ident: { empresa: 'Comércio Modelo', contato: 'Fulano' }, valores: { 0: 'FULANA', 4: 'R$ 2.000,00', 5: 'Indeterminado' }, marcados: { 10: true }, anexos: { '1-0': 1, '1-1-f': 1, '1-1-v': 2, '1-2': 1 } };
chk('tudo preenchido e anexado: nada falta (o prazo da experiência não é pedido no contrato indeterminado)', J(pendencias(modelo, cheio)) === '[]', J(pendencias(modelo, cheio)));
chk('escolheu "Experiência": passa a faltar o prazo; com "Outro prazo", falta dizer qual',
  J(pendencias(modelo, { ...cheio, valores: { ...cheio.valores, 5: 'Experiência' } }).map(f => f.chave)) === J(['q6'])
  && J(pendencias(modelo, { ...cheio, valores: { ...cheio.valores, 5: 'Experiência', 6: 'Outro prazo' } }).map(f => f.chave)) === J(['q7'])
  && J(pendencias(modelo, { ...cheio, valores: { ...cheio.valores, 5: 'Experiência', 6: 'Outro prazo', 7: '60 dias' } })) === '[]');
chk('só espaços não é resposta; a declaração desmarcada falta', J(pendencias(modelo, { ...cheio, ident: { empresa: '  ', contato: 'Fulano' }, valores: { ...cheio.valores, 4: '   ' }, marcados: {} }).map(f => f.chave)) === J(['empresa', 'q4', 'q10']));
chk('sem o verso, falta o verso; "frente e verso no mesmo arquivo" dispensa o verso, nunca a frente',
  J(pendencias(modelo, { ...cheio, anexos: { ...cheio.anexos, '1-1-v': 0 } }).map(f => f.chave)) === J(['1-1-v'])
  && J(pendencias(modelo, { ...cheio, anexos: { ...cheio.anexos, '1-1-v': 0 }, mesmo: { '1-1': true } })) === '[]'
  && J(pendencias(modelo, { ...cheio, anexos: { ...cheio.anexos, '1-1-f': 0, '1-1-v': 0 }, mesmo: { '1-1': true } }).map(f => f.chave)) === J(['1-1-f']));
chk('arquivo em outra vaga não vale pela que falta', J(pendencias(modelo, { ...cheio, anexos: { '1-0': 5, 2: 3 } }).map(f => f.chave)) === J(['1-1-f', '1-1-v', '1-2']));
chk('o formulário de antes (sem as marcas novas) segue como era: só as perguntas e a declaração obrigatórias',
  J(pendencias({ blocos: [{ tipo: 'pergunta', id: 'nome', rotulo: 'Nome', formato: 'texto', obrigatoria: true }, { tipo: 'documentos', titulo: 'Documentos', itens: ['RG'] }, { tipo: 'declaracao', id: 'c', rotulo: 'Ciente', obrigatoria: true }] },
    { ident: { empresa: 'A', contato: 'B' } }).map(f => f.chave)) === J(['q0', 'q2']));
chk('sem modelo ou sem estado, não quebra', J(pendencias(null, null).map(f => f.chave)) === J(['empresa', 'contato']) && J(pendencias({ blocos: 'x' })) === J(pendencias({})));

console.log('O que vai no envio:');
let r = respostasDoEnvio(modelo, cheio);
chk('só as perguntas que apareceram, com a seção de cada uma (como era): o prazo escondido não vai',
  J(r.map(x => x.id)) === J(['nome', 'salario', 'tipo_contrato', 'apelido', 'ciente']) && r[0].secao === '' && r[1].secao === 'Informações importantes' && r[1].valor === 'R$ 2.000,00' && r[2].tipo === 'escolha' && r[3].valor === '');
chk('a declaração vai com o texto declarado e a seção dela', J(r[4]) === J({ id: 'ciente', rotulo: 'A empresa declara estar ciente', tipo: 'declaracao', secao: 'Declaração', valor: 'Sim', texto: '* texto declarado' }));
r = respostasDoEnvio(modelo, { ...cheio, valores: { ...cheio.valores, 5: 'Experiência', 6: '45 + 45 dias' } });
chk('com "Experiência", o prazo vai junto', J(r.map(x => x.id)) === J(['nome', 'salario', 'tipo_contrato', 'prazo', 'apelido', 'ciente']) && r[3].valor === '45 + 45 dias');
r = respostasDoEnvio(modelo, { ...cheio, anexos: { ...cheio.anexos, '1-1-v': 0 }, mesmo: { '1-1': true } });
chk('o verso dispensado vai dito, na seção da lista de documentos, pra ficha do DP mostrar',
  J(r[1]) === J({ id: 'anexo_1-1-v', rotulo: DOC + ' (verso)', tipo: 'anexo', secao: 'Documentos obrigatórios', valor: MESMO_ARQUIVO }) && r.length === 6);
chk('com o verso anexado, a caixa marcada não vira resposta', !respostasDoEnvio(modelo, { ...cheio, mesmo: { '1-1': true } }).some(x => x.tipo === 'anexo'));

console.log('O aviso do alto do formulário:');
const ob = obrigatoriosDoModelo(blocos);
chk('os documentos de anexar e os campos de preencher (o que depende de outra resposta e o que não é obrigatório ficam fora)',
  J(ob) === J({ anexos: ['Exame médico admissional (ASO)', DOC, 'Comprovante de endereço'], campos: ['Nome do(a) funcionário(a)', 'Salário', 'Tipo de Contrato'] }), J(ob));
chk('formulário sem nada obrigatório: listas vazias', J(obrigatoriosDoModelo([{ tipo: 'texto', texto: 'oi' }, { tipo: 'documentos', itens: ['RG'] }])) === J({ anexos: [], campos: [] }) && J(obrigatoriosDoModelo(null)) === J({ anexos: [], campos: [] }));

console.log('O que impede salvar o formulário no editor:');
chk('o formulário certo passa', problemaDoModelo(blocos.filter((_, i) => i !== 9)) === '' && problemaDoModelo(null) === '' && problemaDoModelo([]) === '');
chk('"só quando se aplica" com anexo obrigatório não salva', problemaDoModelo(blocos).includes('"Salário família" não pode ser "só quando se aplica" e ter anexo obrigatório') && problemaDoModelo(blocos).includes('(item 10)'));
const com = troca => problemaDoModelo(blocos.filter((_, i) => i !== 9).map((b, i) => (troca[i] !== undefined ? troca[i] : b)));
chk('condição pela metade', com({ 6: { ...blocos[6], so_se: { id: 'tipo_contrato', valor: '' } } }).includes('escolha a resposta que faz a pergunta aparecer'));
chk('a pergunta de que depende saiu do formulário', com({ 5: { tipo: 'texto', texto: 'no lugar' } }).includes('"Prazo do contrato de experiência" depende de uma pergunta que não está mais no formulário (item 7)'));
chk('a opção saiu da lista', com({ 5: { ...blocos[5], opcoes: op('Determinado', 'Indeterminado') } }).includes('aparece com a resposta "Experiência", que não está mais nas opções de "Tipo de Contrato"'));
chk('a pergunta de que depende deixou de ser de escolha', com({ 5: { ...blocos[5], formato: 'texto' } }).includes('que precisa ser uma pergunta de escolha'));
const invertido = blocos.filter((_, i) => i !== 9); [invertido[5], invertido[6]] = [invertido[6], invertido[5]];
chk('a pergunta que depende veio pra cima da outra', problemaDoModelo(invertido).includes('"Prazo do contrato de experiência" precisa vir depois de "Tipo de Contrato"'));

console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
