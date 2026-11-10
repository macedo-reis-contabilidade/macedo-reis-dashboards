// As regras da tela de atendimento pelo WhatsApp (assets/js/atendimento.js, 08/11/2026): de quem é cada fila, o telefone,
// o que cada um pode fazer, o que cada botão muda, o histórico e a lista; e que a Edge Function whatsapp leva a mesma
// lista de setores e a mesma conta do telefone. Rodar com: node tests/atendimento.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as A from '../assets/js/atendimento.js';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); };
const raiz = fileURLToPath(new URL('../', import.meta.url));
const THALIA = 'fiscal@macedoereis.com.br', VITORIA = 'rh@macedoereis.com.br', ADAINI = 'contabil@macedoereis.com.br',
  SAMUEL = 'financeiro@macedoereis.com.br', DIEGO = 'diego@macedoereis.com.br';
const AGORA = new Date('2026-11-08T21:00:00Z');
const C = (extra = {}) => ({ id: 'c1', telefone: '5551999998888', contato_nome: 'Maria', situacao: 'fila', setor: 'fiscal', responsavel: null,
  ultima_em: '2026-11-08T20:50:00Z', ultima_do_cliente_em: '2026-11-08T20:50:00Z', janela_ate: '2026-11-09T20:50:00Z', criado_em: '2026-11-08T20:50:00Z', ...extra });

console.log('De quem é cada fila (as decisões de 06/11/2026):');
chk('o fiscal e o que não tem setor são da Thalia', JSON.stringify(A.setoresDe(THALIA)) === JSON.stringify(['fiscal', null]));
chk('o DP é da Vitória', JSON.stringify(A.setoresDe(VITORIA)) === JSON.stringify(['dp']));
chk('o contábil e o societário são da Adaini', JSON.stringify(A.setoresDe(ADAINI)) === JSON.stringify(['contabil', 'societario']));
chk('o financeiro e o comercial são do Samuel', JSON.stringify(A.setoresDe(SAMUEL)) === JSON.stringify(['financeiro', 'comercial']));
chk('o Diego não tem fila (vê todas)', A.setoresDe(DIEGO).length === 0);
chk('o e-mail em maiúscula vale', A.setoresDe('FISCAL@MacedoeReis.com.br').includes('fiscal'));
chk('os setores são os do check do banco', A.SETORES.map(s => s.id).join(',') === 'fiscal,dp,contabil,societario,financeiro,comercial');
chk('"pro DP" e "pra fila sem setor"', A.proSetor('dp') === 'pro DP' && A.proSetor(null) === 'pra fila sem setor');

console.log('O telefone:');
chk('com o DDD e o número, ganha o 55', A.normalizarTelefone('(51) 99999-8888') === '5551999998888' && A.normalizarTelefone('5199998888') === '555199998888');
chk('com o 55, fica', A.normalizarTelefone('55 51 99999-8888') === '5551999998888');
chk('com "+", fica como veio (outro país)', A.normalizarTelefone('+1 415 555 0100') === '14155550100');
chk('curto ou comprido demais não vale', A.normalizarTelefone('9999-8888') === null && A.normalizarTelefone('1234567890123456') === null && A.normalizarTelefone('') === null);
chk('o formato da tela', A.formatarTelefone('5551999998888') === '(51) 99999-8888' && A.formatarTelefone('555199998888') === '(51) 9999-8888' && A.formatarTelefone('14155550100') === '+14155550100');
chk('o título: o nome do WhatsApp, senão o número', A.tituloDaConversa(C()) === 'Maria' && A.tituloDaConversa(C({ contato_nome: '  ' })) === '(51) 99999-8888');

console.log('"Pra mim" e o que a lista diz:');
chk('a da fila do meu setor, sem ninguém, é pra mim', A.ehPraMim(C(), THALIA) && !A.ehPraMim(C(), VITORIA));
chk('a sem setor é da Thalia', A.ehPraMim(C({ setor: null }), THALIA) && !A.ehPraMim(C({ setor: null }), SAMUEL));
chk('a passada pra uma pessoa é só dela', A.ehPraMim(C({ responsavel: VITORIA }), VITORIA) && !A.ehPraMim(C({ responsavel: VITORIA }), THALIA));
chk('a encerrada não é de ninguém', !A.ehPraMim(C({ situacao: 'encerrada' }), THALIA));
chk('na fila do Fiscal há 10 min', A.situacaoDaConversa(C(), THALIA, AGORA).texto === 'Na fila do Fiscal há 10 min');
chk('com você / com a Vitória / passada', A.situacaoDaConversa(C({ situacao: 'atendendo', responsavel: THALIA }), THALIA).texto === 'Com você'
  && A.situacaoDaConversa(C({ situacao: 'atendendo', responsavel: VITORIA }), THALIA).texto === 'Com Vitória'
  && A.situacaoDaConversa(C({ responsavel: THALIA }), THALIA).texto === 'Passaram pra você'
  && A.situacaoDaConversa(C({ responsavel: VITORIA }), THALIA).texto === 'Passada pra Vitória');
chk('encerrada por quem', A.situacaoDaConversa(C({ situacao: 'encerrada', encerrada_por: ADAINI }), THALIA).texto === 'Encerrada por Adaini');
chk('há quanto tempo', A.haQuanto('2026-11-08T20:59:40Z', AGORA) === 'agora' && A.haQuanto('2026-11-08T18:00:00Z', AGORA) === 'há 3 h' && A.haQuanto('2026-11-06T20:00:00Z', AGORA) === 'há 2 dias');
chk('a janela de 24 horas', A.janelaAberta(C(), AGORA) && !A.janelaAberta(C({ janela_ate: '2026-11-08T20:00:00Z' }), AGORA) && !A.janelaAberta(C({ janela_ate: null }), AGORA));

console.log('O que cada um pode fazer:');
chk('assumir: a da fila sem ninguém ou passada pra mim', A.podeAssumir(C(), VITORIA) && A.podeAssumir(C({ responsavel: THALIA }), THALIA) && !A.podeAssumir(C({ responsavel: THALIA }), VITORIA));
chk('não assume a que já está com alguém', !A.podeAssumir(C({ situacao: 'atendendo', responsavel: THALIA }), VITORIA));
chk('responder e devolver: só quem está com ela', A.podeResponder(C({ situacao: 'atendendo', responsavel: THALIA }), THALIA) && !A.podeResponder(C({ situacao: 'atendendo', responsavel: THALIA }), VITORIA) && !A.podeResponder(C(), THALIA)
  && A.podeDevolver(C({ situacao: 'atendendo', responsavel: THALIA }), THALIA) && !A.podeDevolver(C(), THALIA));
chk('passar e encerrar: a sem ninguém, a minha, e os sócios sempre', A.podeTransferir(C(), VITORIA) && !A.podeTransferir(C({ situacao: 'atendendo', responsavel: THALIA }), VITORIA)
  && A.podeTransferir(C({ situacao: 'atendendo', responsavel: THALIA }), SAMUEL) && A.podeEncerrar(C({ situacao: 'atendendo', responsavel: THALIA }), DIEGO) && !A.podeEncerrar(C({ situacao: 'encerrada' }), THALIA));
chk('reabrir: só a encerrada', A.podeReabrir(C({ situacao: 'encerrada' })) && !A.podeReabrir(C()));
chk('a nota no lugar da caixa', A.porQueNaoResponde(C(), THALIA, AGORA) === 'Assuma a conversa pra responder.'
  && A.porQueNaoResponde(C({ situacao: 'atendendo', responsavel: VITORIA }), THALIA, AGORA) === 'A conversa está com Vitória.'
  && /24 horas/.test(A.porQueNaoResponde(C({ situacao: 'atendendo', responsavel: THALIA, janela_ate: '2026-11-08T10:00:00Z' }), THALIA, AGORA))
  && /Reabra/.test(A.porQueNaoResponde(C({ situacao: 'encerrada' }), THALIA, AGORA))
  && A.porQueNaoResponde(C({ situacao: 'atendendo', responsavel: THALIA }), THALIA, AGORA) === null);

console.log('O que cada botão muda (só as colunas que a tela pode mudar) e o evento:');
const colunas = m => Object.keys(m.patch).every(k => ['situacao', 'setor', 'responsavel', 'cliente_id'].includes(k));
const ass = A.mudancaDe('assumir', C(), { eu: 'FISCAL@macedoereis.com.br' });
chk('assumir: atendendo, comigo (o e-mail em minúscula), o evento assumiu', ass.patch.situacao === 'atendendo' && ass.patch.responsavel === THALIA && ass.evento.tipo === 'assumiu' && colunas(ass));
const tr = A.mudancaDe('transferir', C({ situacao: 'atendendo', responsavel: THALIA }), { eu: THALIA, setor: 'dp', para: null, observacao: '  é sobre a férias  ' });
chk('passar pro DP: a fila do DP, sem ninguém, com o recado', tr.patch.situacao === 'fila' && tr.patch.setor === 'dp' && tr.patch.responsavel === null && tr.evento.tipo === 'transferiu' && tr.evento.observacao === 'é sobre a férias' && colunas(tr));
const trp = A.mudancaDe('transferir', C({ situacao: 'atendendo', responsavel: THALIA }), { eu: THALIA, setor: 'dp', para: 'RH@macedoereis.com.br' });
chk('passar pra Vitória: passada pra ela, na fila até ela assumir', trp.patch.situacao === 'fila' && trp.patch.responsavel === VITORIA && trp.evento.para === VITORIA);
const trEu = A.mudancaDe('transferir', C(), { eu: THALIA, setor: 'fiscal', para: THALIA });
chk('passar pra mim mesma é assumir', trEu.patch.situacao === 'atendendo' && trEu.evento.tipo === 'assumiu');
chk('passar sem dizer o setor mantém o de agora', A.mudancaDe('transferir', C({ setor: 'contabil' }), { eu: THALIA, para: SAMUEL }).patch.setor === 'contabil');
const dev = A.mudancaDe('devolver', C({ situacao: 'atendendo', responsavel: THALIA }), { eu: THALIA });
chk('devolver: a fila do mesmo setor, sem ninguém', dev.patch.situacao === 'fila' && dev.patch.responsavel === null && dev.patch.setor === undefined && dev.evento.tipo === 'devolveu');
chk('encerrar e reabrir', A.mudancaDe('encerrar', C(), { eu: THALIA }).patch.situacao === 'encerrada' && A.mudancaDe('reabrir', C({ situacao: 'encerrada' }), { eu: VITORIA }).patch.responsavel === VITORIA);
const vin = A.mudancaDe('vincular', C(), { eu: THALIA, cliente: { id: 'cli-1', nome: 'EMPRESA EXEMPLO' } });
chk('ligar a empresa: só a empresa, o evento com o nome', JSON.stringify(vin.patch) === '{"cliente_id":"cli-1"}' && vin.evento.tipo === 'vinculou' && vin.evento.observacao === 'EMPRESA EXEMPLO');
chk('a ação desconhecida não muda nada', A.mudancaDe('apagar', C(), { eu: THALIA }) === null);
chk('o recado de mais de mil letras é cortado', A.mudancaDe('encerrar', C(), { eu: THALIA, observacao: 'x'.repeat(1500) }).evento.observacao.length === 1000);

console.log('O histórico:');
chk('os eventos em português', A.textoDoEvento({ tipo: 'assumiu', por: THALIA }) === 'Thalia assumiu'
  && A.textoDoEvento({ tipo: 'transferiu', por: THALIA, setor: 'dp', para: null, observacao: 'férias' }) === 'Thalia passou pro DP: “férias”'
  && A.textoDoEvento({ tipo: 'transferiu', por: THALIA, setor: 'dp', para: VITORIA }) === 'Thalia passou pra Vitória (DP)'
  && A.textoDoEvento({ tipo: 'devolveu', por: VITORIA, setor: null }) === 'Vitória devolveu pra fila sem setor'
  && A.textoDoEvento({ tipo: 'abriu', setor: 'fiscal' }) === 'A conversa começou, na fila do Fiscal'
  && A.textoDoEvento({ tipo: 'vinculou', por: THALIA, observacao: 'EMPRESA EXEMPLO' }) === 'Thalia ligou o número à empresa EMPRESA EXEMPLO');
const lt = A.linhaDoTempo([{ id: 'm2', criada_em: '2026-11-08T20:52:00Z' }, { id: 'm1', criada_em: '2026-11-08T20:50:00Z' }], [{ id: 1, tipo: 'assumiu', em: '2026-11-08T20:50:00Z' }]);
chk('as mensagens e os eventos na ordem do tempo (o evento depois da mensagem do mesmo instante)', lt.map(x => x.tipo === 'msg' ? x.m.id : x.e.tipo).join(',') === 'm1,assumiu,m2');
const lt2 = A.linhaDoTempo([{ id: 'm1', criada_em: '2026-11-08T20:50:00Z' }], [{ id: 2, tipo: 'abriu', em: '2026-11-08T20:50:00Z' }]);
chk('no mesmo instante, o começo da conversa vem antes da primeira mensagem', lt2.map(x => x.tipo === 'msg' ? x.m.id : x.e.tipo).join(',') === 'abriu,m1');
chk('a prévia: numa linha, com "Você:" na resposta, o tipo quando não há texto', A.previa({ direcao: 'entrada', texto: 'oi\n tudo  bem?' }) === 'oi tudo bem?'
  && A.previa({ direcao: 'saida', texto: 'ok' }) === 'Você: ok' && A.previa({ direcao: 'entrada', tipo: 'audio' }) === 'Áudio' && [...A.previa({ direcao: 'entrada', texto: 'a'.repeat(200) })].length === 90);
chk('espera resposta quando a última é do cliente', A.esperaResposta(C(), { direcao: 'entrada' }) && !A.esperaResposta(C(), { direcao: 'saida' }) && !A.esperaResposta(C({ situacao: 'encerrada' }), { direcao: 'entrada' }));

console.log('A lista:');
const LISTA = [
  C({ id: 'f1', setor: 'fiscal', ultima_do_cliente_em: '2026-11-08T20:40:00Z', ultima_em: '2026-11-08T20:40:00Z' }),
  C({ id: 'f2', setor: 'fiscal', ultima_do_cliente_em: '2026-11-08T20:10:00Z', ultima_em: '2026-11-08T20:55:00Z' }),
  C({ id: 's1', setor: null }),
  C({ id: 'd1', setor: 'dp' }),
  C({ id: 'a1', situacao: 'atendendo', responsavel: THALIA, setor: 'dp', ultima_em: '2026-11-08T20:30:00Z' }),
  C({ id: 'p1', responsavel: THALIA, setor: 'contabil', ultima_em: '2026-11-08T20:20:00Z' }),
  C({ id: 'v1', situacao: 'atendendo', responsavel: VITORIA, setor: 'dp' }),
  C({ id: 'e1', situacao: 'encerrada', setor: 'fiscal' })
];
const ids = l => l.map(c => c.id).join(',');
chk('minhas: as que estão comigo e as passadas pra mim, a mais recente primeiro', ids(A.filtrar(LISTA, 'minhas', THALIA)) === 'a1,p1');
chk('fila dos meus setores: o fiscal e o sem setor, quem espera há mais tempo primeiro', ids(A.filtrar(LISTA, 'fila', THALIA, 'meus')) === 'f2,f1,s1', ids(A.filtrar(LISTA, 'fila', THALIA, 'meus')));
chk('fila de todos, de um setor, sem setor', ids(A.filtrar(LISTA, 'fila', THALIA, 'todos')).split(',').sort().join(',') === 'd1,f1,f2,s1' && ids(A.filtrar(LISTA, 'fila', THALIA, 'dp')) === 'd1' && ids(A.filtrar(LISTA, 'fila', THALIA, 'sem')) === 's1');
chk('quem não tem setor ("meus") vê todos', A.filtrar(LISTA, 'fila', DIEGO, 'meus').length === 4);
chk('abertas e encerradas', A.filtrar(LISTA, 'todas', DIEGO, 'todos').length === 7 && ids(A.filtrar(LISTA, 'encerradas', THALIA, 'todos')) === 'e1');
chk('as contagens das abas', JSON.stringify(A.contagens(LISTA, THALIA, 'meus')) === JSON.stringify({ minhas: 2, fila: 3, todas: 3, encerradas: 1 }), A.contagens(LISTA, THALIA, 'meus'));

console.log('A nota interna:');
chk('anota em qualquer conversa, aberta ou encerrada', ['robo', 'fila', 'atendendo', 'encerrada'].every(sit => A.podeNotar({ situacao: sit })) && !A.podeNotar(null));
chk('a nota não conta como a última da lista', !A.contaComoUltima({ direcao: 'interna' }) && A.contaComoUltima({ direcao: 'entrada' }) && A.contaComoUltima({ direcao: 'saida' }));
chk('a conversa com a nota depois do cliente segue esperando (a lista guarda a do cliente)', A.esperaResposta({ situacao: 'fila' }, [{ direcao: 'entrada' }, { direcao: 'interna' }].filter(A.contaComoUltima).pop()));

console.log('A Edge Function whatsapp leva a mesma regra:');
const fn = readFileSync(raiz + 'supabase/functions/whatsapp/index.ts', 'utf8');
const setoresFn = /const SETORES = \[([^\]]*)\]/.exec(fn);
chk('os mesmos setores', setoresFn && setoresFn[1].replace(/["\s]/g, '') === A.SETORES.map(s => s.id).join(','));
const corpo = (src, nome) => { const i = src.indexOf('function ' + nome + '('); const j = src.indexOf('\n}\n', i); return src.slice(src.indexOf('{', i), j + 2); };
const modulo = readFileSync(raiz + 'assets/js/atendimento.js', 'utf8');
const sem = s => s.replace(/\s+/g, '').replace(/"/g, "'");
chk('a mesma conta do telefone', sem(corpo(fn, 'normalizarTelefone')) === sem(corpo(modulo, 'normalizarTelefone')));
chk('o mesmo limite do texto', /MAX_TEXTO = 4096/.test(fn) && A.MAX_TEXTO === 4096);
chk('a resposta só na conversa de teste, enquanto o número de verdade não está ligado', /if \(!c\.teste\)/.test(fn));
chk('a nota grava direcao interna, com quem anotou, sem mexer na conversa', /acao === "nota"/.test(fn) && /direcao: "interna", autor: quem/.test(fn));
chk('a mensagem nasce com o id da tela (tentar de novo não duplica: 23505 é "já entrou")', /insert\(\{ id, conversa_id/.test(fn) && /e2\.code !== "23505"/.test(fn));

chk('os mesmos arquivos aceitos (o caminho na pasta da mensagem, até 5, 25 MB)', sem(corpo(fn, 'anexosValidos')).replace(':Anexo[]', '') === sem(corpo(modulo, 'anexosValidos')) && /MAX_ANEXOS = 5/.test(fn) && /MAX_ARQUIVO = 25 \* 1024 \* 1024/.test(fn));
chk('o mesmo tipo da mensagem pelo arquivo', sem(corpo(fn, 'tipoDaMensagem')) === sem(corpo(modulo, 'tipoDaMensagem')));
chk('o mesmo nome no Drive (o dia e a hora de Brasília)', sem(corpo(fn, 'nomeNoDrive')) === sem(corpo(modulo, 'nomeNoDrive')) && /PASTA_WHATSAPP = "WHATSAPP"/.test(fn) && A.PASTA_WHATSAPP === 'WHATSAPP');
chk('o Salvar no Drive: só com a empresa ligada e a pasta no cadastro; o que já foi devolve o link de antes', /acao === "salvar_drive"/.test(fn) && /Ligue a conversa a uma empresa/.test(fn) && /ja: true/.test(fn) && !/\.delete\(|method: "DELETE"/.test(fn));
chk('o nome no Drive: o dia e a hora de Brasília e o nome sem barra', A.nomeNoDrive('Guia/DAS.pdf', '2026-11-10T13:05:00Z') === '2026-11-10 10h05 Guia DAS.pdf' && A.nomeNoDrive('', '2026-01-01T02:00:00Z') === '2025-12-31 23h00 arquivo');
chk('o link do Drive só quando é do Drive', A.linkDoDrive({ drive_url: 'https://drive.google.com/file/d/abc/view' }) === 'https://drive.google.com/file/d/abc/view' && A.linkDoDrive({ drive_url: 'javascript:alert(1)' }) === null && A.linkDoDrive({}) === null);
chk('o arquivo tem de estar na pasta antes de gravar', /storage\.from\("atendimento"\)\.list\(id/.test(fn) && /arquivosNaPasta\(\)/.test(fn));

console.log('Os arquivos:');
const ID = '0b6e4f3a-1c2d-4e5f-8a9b-0c1d2e3f4a5b';
chk('o nome na pasta, sem acento nem barra', A.caminhoDoAnexo(ID, 'Guia/DAS ção.pdf') === ID + '/Guia_DAS cao.pdf' && A.caminhoDoAnexo(ID, 'x.pdf', 2) === ID + '/3-x.pdf');
const f = (name, size) => ({ name, size });
const cf = A.conferirAnexos([f('a.pdf', 10), f('vazio.txt', 0), f('grande.mp4', 26 * 1024 * 1024), f('b', 1), f('c', 1), f('d', 1), f('e', 1)], 0);
chk('até 5 por mensagem, nem vazio nem acima de 25 MB', cf.ok.length === 5 && cf.recusados.map(r => r.nome).join(',') === 'vazio.txt,grande.mp4', cf);
chk('o tipo pela primeira', A.tipoDaMensagem([]) === 'texto' && A.tipoDaMensagem([{ tipo: 'image/jpeg' }]) === 'imagem' && A.tipoDaMensagem([{ tipo: 'audio/ogg' }]) === 'audio' && A.tipoDaMensagem([{ tipo: 'application/pdf' }]) === 'documento');
const ok = { caminho: ID + '/a.pdf', nome: 'a.pdf', tamanho: 10, tipo: 'application/pdf' };
chk('aceita o arquivo na pasta da mensagem', JSON.stringify(A.anexosValidos([ok], ID)) === JSON.stringify([ok]) && A.anexosValidos(undefined, ID).length === 0);
chk('recusa outra pasta, subpasta, ../, tamanho ruim, tipo esquisito e mais de 5',
  A.anexosValidos([{ ...ok, caminho: 'outra/a.pdf' }], ID) === null && A.anexosValidos([{ ...ok, caminho: ID + '/x/a.pdf' }], ID) === null
  && A.anexosValidos([{ ...ok, caminho: ID + '/../a.pdf' }], ID) === null && A.anexosValidos([{ ...ok, tamanho: 0 }], ID) === null
  && A.anexosValidos([{ ...ok, tipo: 'text/html"><b>' }], ID) === null && A.anexosValidos(Array(6).fill(ok), ID) === null);

console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
