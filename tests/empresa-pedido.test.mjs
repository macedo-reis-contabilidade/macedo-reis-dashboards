// O formulário da constituição de CNPJ e da transformação do MEI em ME (assets/js/empresa-pedido.js, 24/11/2026): a
// conferência do pedido (os dados de quem preenche, da empresa e de cada sócio, com o documento de cada sócio anexado), os
// avisos pro escritório, o resumo da tarefa (sem CPF nem endereço dos sócios), o texto das respostas que vai pro Drive, o
// nome de cada anexo na pasta e a pasta do pedido. E a Edge Function empresa-link: importa este arquivo num commit fixado
// (e o commit tem o de agora), o envio dos documentos é o do mei-link (o das admissões) e a trava de 30 pedidos por hora.
// Os dados daqui são inventados (os CPFs e o CNPJ, válidos pelo dígito, não são de ninguém conhecido).
// Rodar com: node tests/empresa-pedido.test.mjs
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { TIPOS, tipoDe, ESTADOS_CIVIS, REGIMES, GOVBR, MAX_SOCIOS, MAX_ARQ, MAX_QTD, OUTROS, grupoDoSocio, conferirAnexos, conferirPedido, alertasDoPedido,
  resumoDoPedido, textoDasRespostas, nomeDoAnexo, pastaDoPedido, empresaDoPedido, ALTERACOES, ITENS, itensDe, selecao, paramsDaSelecao, selecaoDoEndereco,
  emFrase, oQueMuda, comSocios, PERGUNTAS, PERGUNTAS_ALT, AVISO_GOV_ALT, CIVIL, grupoDaCertidao } from '../assets/js/empresa-pedido.js';
import { DOCUMENTOS } from '../assets/js/societario-produtos.js';

const raiz = new URL('../', import.meta.url).pathname;
let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); };
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// CPFs e CNPJ inventados, válidos pelo dígito
const CPF1 = '529.982.247-25', CPF2 = '111.444.777-35', CNPJ_MEI = '11.222.333/0001-81';
const end = { cep: '95660-000', logradouro: 'Rua Inventada', numero: '100', complemento: '', bairro: 'Centro', cidade: 'Três Coroas', uf: 'RS' };
const socio = (o = {}) => ({ nome: 'Fulana de Tal', cpf: CPF1, estadoCivil: 'solteiro', regime: '', profissao: 'Comerciante', endereco: end, govbr: 'sim', ...o });
const doc = (grupo, nome = 'cnh.pdf', tamanho = 1000) => ({ nome, tamanho, tipo: 'application/pdf', grupo });
const base = (o = {}) => ({
  tipo: 'constituicao', contato: { nome: 'Beltrano Pai', telefone: '(51) 99999-0000', email: 'Beltrano@Exemplo.com' },
  razao1: 'Loja Inventada', razao2: 'Inventada Modas', fantasia: '', atividades: 'Loja de roupas femininas e acessórios', capital: '10.000,00',
  funcionamento: 'Segunda a sexta, das 9h às 18h', areaTotal: '80', areaUtilizada: '60,5', empresaTelefone: '51999990000', empresaEmail: 'loja@exemplo.com',
  endereco: end, socios: [socio()], obs: '', arquivos: [doc(grupoDoSocio(0))], ...o });

console.log('Os produtos do link');
chk('a abertura, a transformação e a alteração, pelo endereço', igual(Object.keys(TIPOS), ['constituicao', 'transformacao', 'alteracao']) && tipoDe('transformacao') === 'transformacao'
  && tipoDe('alteracao') === 'alteracao' && tipoDe('x') === null && tipoDe('toString') === null);
chk('os títulos: a abertura de empresa (a constituição de CNPJ) e a transformação', TIPOS.constituicao.titulo === 'Abertura de empresa' && TIPOS.constituicao.tarefa === 'Constituição de CNPJ'
  && TIPOS.transformacao.titulo === 'Transformação do MEI em ME');
chk('as perguntas cobrem a documentação dos produtos (a lista do Samuel: 8 da empresa e 5 de cada sócio)',
  DOCUMENTOS[0].itens.length === 8 && DOCUMENTOS[1].itens.length === 5 && ESTADOS_CIVIS.some(([v]) => v === 'casado') && REGIMES.length === 5 && GOVBR.length === 3);
chk('o estado civil, com a certidão de casamento, igual nos três produtos (26/11/2026)', DOCUMENTOS[1].itens[1].t === CIVIL && ITENS.civil.t === CIVIL
  && /certidão de casamento/.test(CIVIL) && /opcional/.test(PERGUNTAS['socio.certidao']));

console.log('A conferência');
const ok = conferirPedido(base());
chk('o pedido completo passa', !!ok.pedido, ok.faltam);
const p = ok.pedido;
chk('limpo: o e-mail em minúsculas, os números só com os dígitos, a área e o capital em número', p.contato.email === 'beltrano@exemplo.com' && p.contato.telefone === '51999990000'
  && p.capital === 10000 && p.areaTotal === 80 && p.areaUtilizada === 60.5 && p.socios[0].cpf === '52998224725' && p.endereco.cep === '95660000');
chk('um sócio só: 100% e administra', p.socios[0].participacao === 100 && p.socios[0].administra === 'sim');
chk('os anexos voltam conferidos', igual(ok.arquivos, [{ nome: 'cnh.pdf', tamanho: 1000, tipo: 'application/pdf', grupo: 'socio-0' }]));
const vazio = conferirPedido({ tipo: 'constituicao' });
chk('vazio: falta tudo, com os ids da página', ['contato.nome', 'contato.telefone', 'contato.email', 'razao1', 'razao2', 'atividades', 'capital', 'funcionamento',
  'areaTotal', 'areaUtilizada', 'empresaTelefone', 'empresaEmail', 'endereco.cep', 'endereco.uf', 'socios.0.nome', 'socios.0.cpf', 'socios.0.estadoCivil',
  'socios.0.profissao', 'socios.0.endereco.cep', 'socios.0.govbr', 'socios.0.documento'].every(id => vazio.faltam.includes(id)), vazio.faltam);
chk('o produto que não existe não passa', conferirPedido(base({ tipo: 'outro' })).erro === 'Formulário inválido.');
chk('a 2ª opção igual à 1ª (sem acento e maiúscula) falta', conferirPedido(base({ razao2: 'LOJA  inventadá' })).faltam.includes('razao2'));
chk('a área utilizada maior que a total falta', conferirPedido(base({ areaUtilizada: '90' })).faltam.includes('areaUtilizada'));
chk('o casado sem o regime falta; com o regime, passa', conferirPedido(base({ socios: [socio({ estadoCivil: 'casado' })] })).faltam.includes('socios.0.regime')
  && !!conferirPedido(base({ socios: [socio({ estadoCivil: 'casado', regime: 'comunhao_parcial' })] })).pedido);
chk('o CPF inválido falta', conferirPedido(base({ socios: [socio({ cpf: '123.456.789-00' })] })).faltam.includes('socios.0.cpf'));
// a certidão de casamento (26/11/2026, "se casado precisa aparecer opção para anexar a certidão de casamento"): opcional,
// só do sócio casado, e o pedido diz se ela veio
const casada = (arqs, o = {}) => conferirPedido(base({ socios: [socio({ estadoCivil: 'casado', regime: 'comunhao_parcial', ...o })], arquivos: arqs }));
const cc = casada([doc('socio-0'), doc(grupoDaCertidao(0), 'certidao.pdf')]);
chk('o casado com a certidão passa, e o sócio diz que ela veio', grupoDaCertidao(0) === 'certidao-0' && !!cc.pedido && cc.pedido.socios[0].certidao === true
  && igual(cc.arquivos.map(a => a.grupo), ['socio-0', 'certidao-0']), cc.faltam);
chk('sem a certidão também passa (é opcional), e o sócio diz que não veio', casada([doc('socio-0')]).pedido.socios[0].certidao === false);
chk('a certidão de quem não é casado não vale; a do solteiro não ganha o campo', conferirPedido(base({ arquivos: [doc('socio-0'), doc('certidao-0')] })).erro === 'Arquivo inválido.'
  && !('certidao' in p.socios[0]) && conferirPedido(base({ socios: [socio({ estadoCivil: 'uniao_estavel' })], arquivos: [doc('socio-0'), doc('certidao-0')] })).erro === 'Arquivo inválido.');
chk('sem o documento do sócio, não passa (o outro documento não basta)', conferirPedido(base({ arquivos: [doc(OUTROS)] })).faltam.includes('socios.0.documento'));
const dois = (o1 = {}, o2 = {}, arqs = [doc('socio-0'), doc('socio-1', 'rg.jpg')]) =>
  conferirPedido(base({ socios: [socio({ participacao: '50', administra: 'sim', ...o1 }), socio({ nome: 'Ciclana Souza', cpf: CPF2, participacao: '50', administra: 'nao', ...o2 })], arquivos: arqs }));
chk('dois sócios: a participação de cada um e quem administra', !!dois().pedido && dois().pedido.socios[1].participacao === 50);
chk('a soma das participações tem de dar 100%', dois({ participacao: '60' }).faltam.includes('socios.participacao') && !dois({ participacao: '50,00' }).faltam);
chk('pelo menos um sócio administra', dois({ administra: 'nao' }).faltam.includes('socios.administra'));
chk('sem a participação ou sem dizer se administra, falta o do sócio', dois({}, { participacao: '' }).faltam.includes('socios.1.participacao')
  && dois({}, { administra: '' }).faltam.includes('socios.1.administra'));
chk('o mesmo CPF em dois sócios falta no segundo', dois({}, { cpf: CPF1 }).faltam.includes('socios.1.cpf'));
chk('cada sócio com o documento dele', dois({}, {}, [doc('socio-0')]).faltam.includes('socios.1.documento'));
chk('no máximo 10 sócios', MAX_SOCIOS === 10 && conferirPedido(base({ socios: Array.from({ length: 12 }, () => socio()) })).faltam.filter(f => /^socios\.\d+\.cpf$/.test(f)).length === 9);
chk('a transformação pede o CNPJ do MEI; a abertura, não', conferirPedido(base({ tipo: 'transformacao' })).faltam.includes('cnpjMei')
  && !!conferirPedido(base({ tipo: 'transformacao', cnpjMei: CNPJ_MEI })).pedido && conferirPedido(base({ cnpjMei: CNPJ_MEI })).pedido.cnpjMei === '');

console.log('Os anexos');
chk('os limites: 25 MB cada, 20 arquivos, 100 MB no total', MAX_ARQ === 25 * 1024 * 1024 && MAX_QTD === 20
  && conferirAnexos([doc('socio-0', 'x', MAX_ARQ + 1)], 1).erro && conferirAnexos(Array.from({ length: 21 }, () => doc('outros')), 1).erro
  && conferirAnexos(Array.from({ length: 5 }, () => doc('outros', 'x', 21 * 1024 * 1024)), 1).erro);
chk('o grupo tem de ser de um sócio que existe ou os outros', conferirAnexos([doc('socio-3')], 2).erro === 'Arquivo inválido.' && !conferirAnexos([doc('socio-1'), doc('outros')], 2).erro);
chk('o erro dos anexos vem antes do resto', conferirPedido(base({ arquivos: [doc('socio-0', 'x', 0)] })).faltam[0] === 'arquivos');

console.log('Os avisos, o resumo e as respostas');
const com = conferirPedido(base({ socios: [socio({ govbr: 'bronze', estadoCivil: 'casado', regime: 'nao_sei' })] })).pedido;
const av = alertasDoPedido(com);
chk('o gov.br bronze, o regime que não sabe e o sócio único da abertura', av.length === 3 && /bronze/.test(av[0]) && /regime de bens/.test(av[1]) && /unipessoal/.test(av[2]), av);
chk('o regime que não sabe, sem a certidão: pede a certidão; com ela, manda conferir nela', /não anexou a certidão de casamento: peça a certidão pelo WhatsApp/.test(av[1])
  && /confira na certidão de casamento\.$/.test(alertasDoPedido(casada([doc('socio-0'), doc('certidao-0')], { regime: 'nao_sei' }).pedido)[0]), av);
chk('o casado que sabe o regime: sem a certidão, o aviso; com ela, nenhum', /não anexou a certidão de casamento: se precisar, peça pelo WhatsApp/.test(alertasDoPedido(casada([doc('socio-0')]).pedido)[0])
  && alertasDoPedido(cc.pedido).filter(x => /certidão/.test(x)).length === 0);
chk('na transformação, o sócio único não é aviso', alertasDoPedido({ ...p, tipo: 'transformacao' }).length === 0);
const r = resumoDoPedido(dois().pedido);
chk('o resumo da tarefa: o produto, quem preencheu, a razão social, as atividades, o capital, a cidade e os sócios',
  r.startsWith('Constituição de CNPJ: o formulário preenchido pelo link.') && r.includes('Quem preencheu: Beltrano Pai · WhatsApp (51) 99999-0000 · beltrano@exemplo.com')
  && r.includes('Razão social: 1ª opção Loja Inventada · 2ª opção Inventada Modas') && r.includes('Cidade: Três Coroas/RS')
  && r.includes('Sócios (2): Fulana de Tal (50%, administra) · Ciclana Souza (50%)'), r);
chk('sem CPF e sem endereço dos sócios na tarefa (a equipe toda vê a agenda)', !r.includes('529') && !r.includes('Rua Inventada'));
const t = textoDasRespostas(dois().pedido, '24/11/2026 às 15:30');
chk('as respostas inteiras pro Drive: com o CPF, o endereço e o estado civil de cada sócio', t.startsWith('ABERTURA DE EMPRESA: AS RESPOSTAS DO FORMULÁRIO\nRecebido em 24/11/2026 às 15:30')
  && t.includes('SÓCIO 2\nNome: Ciclana Souza\nCPF: 111.444.777-35') && t.includes('Área utilizada: 60,5 m²') && t.includes('Capital social: R$')
  && t.includes('Participação no capital: 50%') && t.includes('Endereço: Rua Inventada, 100 · Centro · Três Coroas/RS · CEP 95660-000'), t);
chk('na transformação, o CNPJ do MEI', textoDasRespostas(conferirPedido(base({ tipo: 'transformacao', cnpjMei: CNPJ_MEI })).pedido).includes('O MEI\nCNPJ: 11.222.333/0001-81'));
chk('as respostas dizem se a certidão de casamento veio (só no casado)', textoDasRespostas(cc.pedido).includes('Estado civil: Casado(a), comunhão parcial de bens\nCertidão de casamento: anexada\nProfissão')
  && textoDasRespostas(casada([doc('socio-0')]).pedido).includes('Certidão de casamento: não anexada') && !t.includes('Certidão de casamento'));

console.log('Os nomes no Drive');
chk('o anexo leva o sócio: "SÓCIO 2 - NOME SEM ACENTO - arquivo"', nomeDoAnexo('socio-1', [{ nome: 'Ana' }, { nome: 'Ciclâna Souza' }], 'rg.jpg') === 'SÓCIO 2 - CICLANA SOUZA - rg.jpg'
  && nomeDoAnexo('outros', [], 'aluguel.pdf') === 'OUTROS - aluguel.pdf' && nomeDoAnexo('socio-0', [], 'a/b.pdf') === 'SÓCIO 1 - a b.pdf');
chk('a certidão leva o sócio e o que é: "SÓCIO 2 - NOME - CERTIDÃO DE CASAMENTO - arquivo"', nomeDoAnexo('certidao-1', [{ nome: 'Ana' }, { nome: 'Ciclâna Souza' }], 'cert.pdf') === 'SÓCIO 2 - CICLANA SOUZA - CERTIDÃO DE CASAMENTO - cert.pdf'
  && nomeDoAnexo('imovel', [], 'iptu.pdf') === 'OUTROS - iptu.pdf');
chk('a pasta: a 1ª opção de razão social, em maiúsculas', pastaDoPedido(p) === 'LOJA INVENTADA' && pastaDoPedido({}) === 'PEDIDO');

console.log('A alteração de empresa (26/11/2026): o que muda e o que pedir');
chk('o que pode mudar, na ordem da tela', igual(ALTERACOES.map(a => a.id), ['nome', 'fantasia', 'natureza', 'endereco', 'cidade', 'atividades', 'capital', 'socios', 'contato'])
  && TIPOS.alteracao.titulo === 'Alteração de empresa' && TIPOS.alteracao.tarefa === 'Alteração de empresa');
chk('cada coisa pede itens que existem, e todo item é pedido por alguma', ALTERACOES.every(a => a.pedir.length && a.pedir.every(i => ITENS[i]))
  && Object.keys(ITENS).every(i => ALTERACOES.some(a => a.pedir.includes(i))));
chk('o endereço na mesma cidade e o de outra cidade não vão juntos, e pedem o mesmo', ALTERACOES.find(a => a.id === 'endereco').sai === 'cidade'
  && ALTERACOES.find(a => a.id === 'cidade').sai === 'endereco' && igual(ALTERACOES.find(a => a.id === 'endereco').pedir, ALTERACOES.find(a => a.id === 'cidade').pedir));
chk('o anexo que se pede: o documento de cada sócio (o do imóvel saiu em 26/11/2026)', igual(Object.keys(ITENS).filter(i => ITENS[i].anexo), ['doc']) && !ITENS.imovel
  && /gov\.br/.test(ITENS.gov.t) && /Não pedimos a sua senha/.test(ITENS.gov.nota));
chk('os itens, na ordem da lista', igual(itensDe(['contato', 'fantasia']), ['fantasia', 'contato']) && igual(itensDe(['natureza', 'socios']), ['doc', 'civil', 'profissao', 'residencia', 'gov'])
  && igual(itensDe(['nada']), []) && igual(itensDe(null), []));
const sv = selecao('contato,fantasia,xx,endereco,cidade,fantasia,natureza', null);
chk('a seleção: na ordem da tela, sem repetir e sem o que não existe; do endereço, fica o primeiro', igual(sv.alteracoes, ['fantasia', 'natureza', 'endereco', 'contato']), sv);
chk('sem a lista do que pedir, tudo do que muda', igual(sv.pedir, ['fantasia', 'endereco', 'area', 'horario', 'contato', 'doc', 'civil', 'profissao', 'residencia', 'gov']), sv.pedir);
chk('com a lista, só o dela que é do que muda; a lista vazia, nada', igual(selecao(['contato'], ['contato', 'razao']).pedir, ['contato']) && igual(selecao(['contato'], '').pedir, [])
  && igual(selecao(['cidade', 'endereco']).alteracoes, ['cidade']));
const VANIR = { alteracoes: ['fantasia', 'natureza', 'endereco', 'contato'], pedir: ['fantasia', 'endereco', 'area', 'horario', 'contato', 'civil', 'profissao', 'gov'] };
chk('o endereço do link: o que muda e, quando não se pede tudo, o que o escritório já tem', paramsDaSelecao(VANIR) === 'm=fantasia,natureza,endereco,contato&n=doc,residencia'
  && paramsDaSelecao({ alteracoes: ['endereco'] }) === 'm=endereco' && paramsDaSelecao({ alteracoes: ['contato'], pedir: [] }) === 'm=contato&n=contato'
  && paramsDaSelecao({ alteracoes: [] }) === '' && paramsDaSelecao(null) === '', paramsDaSelecao(VANIR));
chk('e o link lido de volta dá a mesma seleção', igual(selecaoDoEndereco('fantasia,natureza,endereco,contato', 'doc,residencia'), VANIR)
  && igual(selecaoDoEndereco('endereco', null).pedir, ['endereco', 'area', 'horario']) && igual(selecaoDoEndereco(null, null), { alteracoes: [], pedir: [] }));
chk('o link de antes com o imóvel no "n" (o escritório já tinha) é lido igual, sem o imóvel', igual(selecaoDoEndereco('endereco', 'imovel').pedir, ['endereco', 'area', 'horario']));
chk('o que muda, numa frase', oQueMuda(VANIR.alteracoes) === 'o nome fantasia, a natureza jurídica, o endereço (na mesma cidade) e os contatos (e-mail e telefone)'
  && oQueMuda(['capital']) === 'o capital social' && emFrase(['a', 'b']) === 'a e b' && emFrase([]) === '');
chk('os sócios, só quando muda a natureza jurídica ou o quadro', comSocios(['natureza']) && comSocios(['socios']) && !comSocios(['endereco', 'contato']));
chk('o aviso do gov.br da alteração e as perguntas dela: de quem preenche, só o nome; nem a empresa nem o CNPJ',
  /Quem administra/.test(AVISO_GOV_ALT) && /prata ou ouro/.test(AVISO_GOV_ALT) && PERGUNTAS_ALT['contato.nome'] === 'Seu nome'
  && !('razaoAtual' in PERGUNTAS_ALT) && !('cnpj' in PERGUNTAS_ALT) && !('imovel' in PERGUNTAS_ALT));

const END2 = { cep: '95660-000', logradouro: 'Rua Nova Inventada', numero: '20', complemento: '', bairro: 'Centro', cidade: 'Três Coroas', uf: 'RS' };
const alt = (o = {}) => ({ tipo: 'alteracao', ...VANIR, contato: { nome: 'Beltrano Pai' },
  fantasia: 'Loja Inventada', endereco: END2, areaTotal: '100', areaUtilizada: '80', funcionamento: 'Segunda a sexta, das 8h às 18h',
  empresaTelefone: '5133334444', empresaEmail: 'loja@exemplo.com', socios: [socio({ estadoCivil: 'casado', regime: 'comunhao_parcial', endereco: undefined })],
  arquivos: [], obs: '', ...o });
const ca = conferirPedido(alt());
chk('a alteração do caso: o pedido completo passa', !!ca.pedido, ca.faltam);
const pa = ca.pedido || {};
chk('limpo: quem preencheu (só o nome), o que muda e o que se pediu', pa.tipo === 'alteracao' && igual(pa.contato, { nome: 'Beltrano Pai', telefone: '', email: '' })
  && !('razaoAtual' in pa) && !('cnpj' in pa)
  && igual(pa.alteracoes, VANIR.alteracoes) && igual(pa.pedir, VANIR.pedir) && pa.fantasia === 'Loja Inventada' && pa.areaUtilizada === 80 && pa.empresaEmail === 'loja@exemplo.com');
chk('o nome de quem preenche basta sozinho (não precisa o completo); vazio, falta', !!conferirPedido(alt({ contato: { nome: 'Beltrano' } })).pedido
  && conferirPedido(alt({ contato: { nome: ' ' } })).faltam.includes('contato.nome') && !conferirPedido(alt({ contato: {} })).pedido);
chk('o telefone, o e-mail, a razão social e o CNPJ que viessem ficam fora', (() => {
  const x = conferirPedido(alt({ contato: { nome: 'Beltrano Pai', telefone: '51999990000', email: 'b@exemplo.com' }, razaoAtual: 'Empresa Inventada', cnpj: CNPJ_MEI })).pedido;
  return x.contato.telefone === '' && x.contato.email === '' && !('razaoAtual' in x) && !('cnpj' in x);
})());
chk('o que não se pediu fica vazio, mesmo que venha', !conferirPedido(alt({ razao1: 'Outra', atividades: 'Qualquer coisa a mais', capital: '5000' })).pedido.razao1
  && conferirPedido(alt({ capital: '5000' })).pedido.capital === null && pa.atividades === '');
chk('o sócio: o nome, o CPF e o que se pediu (sem o endereço, que o escritório já tem)', pa.socios.length === 1 && pa.socios[0].estadoCivil === 'casado' && pa.socios[0].regime === 'comunhao_parcial'
  && pa.socios[0].profissao === 'Comerciante' && pa.socios[0].govbr === 'sim' && pa.socios[0].endereco === null && pa.socios[0].certidao === false);
chk('sem o documento do sócio, passa: não foi pedido', !conferirPedido(alt()).faltam);
chk('com o documento pedido, sem ele não passa', conferirPedido(alt({ pedir: [...VANIR.pedir, 'doc'] })).faltam.includes('socios.0.documento')
  && !!conferirPedido(alt({ pedir: [...VANIR.pedir, 'doc'], arquivos: [doc('socio-0')] })).pedido);
chk('o documento do imóvel não se pede mais: o anexo dele não vale', conferirPedido(alt({ arquivos: [doc('imovel', 'iptu.pdf')] })).erro === 'Arquivo inválido.');
const ccA = conferirPedido(alt({ arquivos: [doc('certidao-0', 'certidao.pdf')] }));
chk('a certidão do sócio casado vai junto, sem o documento pedido', !!ccA.pedido && ccA.pedido.socios[0].certidao === true && igual(ccA.arquivos.map(a => a.grupo), ['certidao-0']));
chk('sem o estado civil pedido, a certidão não vale (o sócio não diz que é casado)',
  conferirPedido(alt({ pedir: VANIR.pedir.filter(i => i !== 'civil'), arquivos: [doc('certidao-0')] })).erro === 'Arquivo inválido.');
const vaziaAlt = conferirPedido({ tipo: 'alteracao' });
chk('sem nada marcado, falta o que muda e o nome de quem preenche (nem telefone, e-mail, empresa ou CNPJ)', ['alteracoes', 'contato.nome'].every(f => vaziaAlt.faltam.includes(f))
  && !['contato.telefone', 'contato.email', 'razaoAtual', 'cnpj'].some(f => vaziaAlt.faltam.includes(f)), vaziaAlt.faltam);
const so = conferirPedido({ tipo: 'alteracao', alteracoes: ['contato'], contato: { nome: 'Beltrano Pai' } });
chk('só o e-mail e o telefone: falta só o telefone e o e-mail novos, sem sócio nem endereço', igual(so.faltam, ['empresaTelefone', 'empresaEmail']), so.faltam);
chk('sem o que pedir no corpo, pede tudo do que muda', conferirPedido(alt({ pedir: undefined })).faltam.includes('socios.0.endereco.cep'));
chk('a 2ª razão social igual à 1ª e a área maior que a total faltam',
  conferirPedido(alt({ alteracoes: ['nome'], pedir: null, razao1: 'Nova Inventada', razao2: 'NOVA inventada', arquivos: [] })).faltam.includes('razao2')
  && conferirPedido(alt({ areaUtilizada: '120' })).faltam.includes('areaUtilizada'));
const ra = resumoDoPedido(pa);
chk('o resumo da tarefa da alteração', ra.startsWith('Alteração de empresa: o formulário preenchido pelo link.\nQuem preencheu: Beltrano Pai\nO que muda: o nome fantasia, a natureza jurídica, o endereço (na mesma cidade) e os contatos (e-mail e telefone)')
  && !ra.includes('Empresa:') && ra.includes('Nome fantasia novo: Loja Inventada')
  && ra.includes('Endereço novo em Três Coroas/RS') && ra.includes('Telefone e e-mail novos: (51) 3333-4444 · loja@exemplo.com') && ra.includes('Sócios (1): Fulana de Tal')
  && ra.includes('Não pedido no formulário (o escritório já tem): CNH ou identidade (do sócio) · Endereço completo (do sócio)'), ra);
chk('sem CPF e sem a rua na tarefa', !ra.includes('529') && !ra.includes('Rua Nova'));
const ta = textoDasRespostas(pa, '26/11/2026 às 15:30');
chk('as respostas da alteração pro Drive', ta.startsWith('ALTERAÇÃO DE EMPRESA: AS RESPOSTAS DO FORMULÁRIO\nRecebido em 26/11/2026 às 15:30\n\nQUEM PREENCHEU\nNome: Beltrano Pai\n\nO QUE MUDA\n- Nome fantasia (inclusão ou troca)')
  && !ta.includes('A EMPRESA') && !ta.includes('WhatsApp') && !ta.includes('E-mail: \n') && ta.includes('Endereço: Rua Nova Inventada, 20 · Centro · Três Coroas/RS · CEP 95660-000')
  && ta.includes('SÓCIO 1\nNome: Fulana de Tal\nCPF: 529.982.247-25\nEstado civil: Casado(a), comunhão parcial de bens\nCertidão de casamento: não anexada')
  && !ta.includes('SÓCIO 1\nNome: Fulana de Tal\nCPF: 529.982.247-25\nEndereço')
  && ta.includes('NÃO PEDIDO NO FORMULÁRIO (O ESCRITÓRIO JÁ TEM)\n- CNH ou identidade (do sócio)'), ta);
chk('a empresa e a pasta da alteração: sem a empresa, o nome de quem preencheu', empresaDoPedido(pa) === '' && pastaDoPedido(pa) === 'ALTERAÇÃO - BELTRANO PAI'
  && empresaDoPedido(p) === 'Loja Inventada' && pastaDoPedido({ tipo: 'alteracao' }) === 'PEDIDO' && pastaDoPedido({ tipo: 'alteracao', contato: { nome: 'Ana/ da\tSilva' } }) === 'ALTERAÇÃO - ANA DA SILVA');
chk('os avisos do sócio valem na alteração (a certidão que não veio); o sócio único não é aviso',
  alertasDoPedido(pa).length === 1 && /não anexou a certidão de casamento/.test(alertasDoPedido(pa)[0])
  && alertasDoPedido({ ...pa, socios: [{ ...pa.socios[0], govbr: 'bronze' }] }).length === 2 && alertasDoPedido(ccA.pedido).length === 0, alertasDoPedido(pa));

console.log('A Edge Function empresa-link');
{
  const fn = readFileSync(raiz + 'supabase/functions/empresa-link/index.ts', 'utf8');
  const fixados = [...fn.matchAll(/from "https:\/\/raw\.githubusercontent\.com\/macedo-reis-contabilidade\/macedo-reis-dashboards\/([0-9a-f]{40})\/(assets\/js\/[a-z-]+\.js)"/g)];
  chk('importa empresa-pedido.js do repositório, num commit fixado', fixados.length === 1 && fixados[0][2] === 'assets/js/empresa-pedido.js', fixados.map(m => m[2]));
  // o que ele importa também vem do commit fixado (o mesmo endereço): o mei-abertura.js e o utils.js
  const atrasados = fixados.flatMap(([, sha]) => ['assets/js/empresa-pedido.js', 'assets/js/mei-abertura.js', 'assets/js/utils.js'].filter(arq => {
    let noCommit = null;
    try { noCommit = execFileSync('git', ['show', sha + ':' + arq], { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 24 }); } catch (e) { noCommit = null; }
    return noCommit === null || noCommit.replace(/\r\n/g, '\n') !== readFileSync(raiz + arq, 'utf8').replace(/\r\n/g, '\n');
  }));
  chk('o código que a função roda é o daqui', atrasados.length === 0, 'mudaram depois do commit fixado: ' + atrasados.join(', ') + ' — publique, fixe o commit novo no index.ts da empresa-link e reimplante');
  const mei = readFileSync(raiz + 'supabase/functions/mei-link/index.ts', 'utf8');
  const bloco = (s, ini, fim) => { const i = s.indexOf(ini); const j = s.indexOf(fim, i); return i >= 0 && j > i ? s.slice(i, j) : null; };
  const drive = bloco(mei, '// ---------- anexos no Drive (cópia do admissao-link) ----------', '// ---------- fim da cópia ----------');
  chk('o envio dos documentos pro Drive é o mesmo do mei-link (que é o das admissões)', drive && fn.includes(drive));
  chk('a trava de 30 pedidos por hora', /const ENVIOS_HORA = 30;/.test(fn) && /Muitos envios agora/.test(fn) && /3600e3/.test(fn));
  chk('o pedido conferido pela mesma regra da página, com o resumo e os avisos gravados', /conferirPedido\(b\)/.test(fn) && /resumo: resumoDoPedido\(p\)/.test(fn) && /alertas: alertasDoPedido\(p\)/.test(fn));
  chk('o nome, o tamanho e o tipo do documento vêm da lista gravada, não do que a página manda agora', /nomeDoAnexo\(item\.grupo/.test(fn) && /Number\(item\.tamanho\)/.test(fn) && !/b\.tamanho/.test(fn));
  chk('as respostas inteiras vão pro Drive, num arquivo de texto na pasta do pedido', /textoDasRespostas\(p,/.test(fn) && /uploadType=multipart/.test(fn));
  chk('a empresa do pedido pela regra da página (na alteração, vazia: grava null, e a tarefa leva o nome)', /empresa: empresaDoPedido\(p\) \|\| null/.test(fn) && !/empresa: p\.razao1/.test(fn));
  chk('o telefone e o e-mail vazios (a alteração não pergunta) gravam null', /telefone: p\.contato\.telefone \|\| null/.test(fn) && /email: p\.contato\.email \|\| null/.test(fn));
  const login = readFileSync(raiz + 'tests/funcoes-login.test.mjs', 'utf8');
  chk('está na lista das funções abertas de propósito, com a trava', /'empresa-link': \[/.test(login));
}

console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
