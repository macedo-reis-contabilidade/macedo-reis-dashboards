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
  resumoDoPedido, textoDasRespostas, nomeDoAnexo, pastaDoPedido } from '../assets/js/empresa-pedido.js';
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
chk('a abertura e a transformação, pelo endereço', igual(Object.keys(TIPOS), ['constituicao', 'transformacao']) && tipoDe('transformacao') === 'transformacao'
  && tipoDe('x') === null && tipoDe('toString') === null);
chk('os títulos: a abertura de empresa (a constituição de CNPJ) e a transformação', TIPOS.constituicao.titulo === 'Abertura de empresa' && TIPOS.constituicao.tarefa === 'Constituição de CNPJ'
  && TIPOS.transformacao.titulo === 'Transformação do MEI em ME');
chk('as perguntas cobrem a documentação dos produtos (a lista do Samuel: 8 da empresa e 5 de cada sócio)',
  DOCUMENTOS[0].itens.length === 8 && DOCUMENTOS[1].itens.length === 5 && ESTADOS_CIVIS.some(([v]) => v === 'casado') && REGIMES.length === 5 && GOVBR.length === 3);

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

console.log('Os nomes no Drive');
chk('o anexo leva o sócio: "SÓCIO 2 - NOME SEM ACENTO - arquivo"', nomeDoAnexo('socio-1', [{ nome: 'Ana' }, { nome: 'Ciclâna Souza' }], 'rg.jpg') === 'SÓCIO 2 - CICLANA SOUZA - rg.jpg'
  && nomeDoAnexo('outros', [], 'aluguel.pdf') === 'OUTROS - aluguel.pdf' && nomeDoAnexo('socio-0', [], 'a/b.pdf') === 'SÓCIO 1 - a b.pdf');
chk('a pasta: a 1ª opção de razão social, em maiúsculas', pastaDoPedido(p) === 'LOJA INVENTADA' && pastaDoPedido({}) === 'PEDIDO');

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
  const login = readFileSync(raiz + 'tests/funcoes-login.test.mjs', 'utf8');
  chk('está na lista das funções abertas de propósito, com a trava', /'empresa-link': \[/.test(login));
}

console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
