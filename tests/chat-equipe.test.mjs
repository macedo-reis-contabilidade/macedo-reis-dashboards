// O chat da equipe (assets/js/chat-equipe.js), os auxiliares puros: o nome de quem tem login, as iniciais, o título e a
// última mensagem de cada conversa na lista, a hora da lista e o separador do dia, os endereços que viram link (só http e
// https, com o texto já escapado), o tamanho e o nome seguro do arquivo na pasta, a conferência dos arquivos (25 MB, 10 por
// mensagem), a ordem da lista (as conversas pela última mensagem, depois quem ainda não tem conversa comigo), o "visto",
// o total do balão (sem as silenciadas), o celular (sem aviso) e o texto do aviso. Rodar com: node tests/chat-equipe.test.mjs
import { nomeDe, iniciais, outroDa, tituloDaConversa, previaDaUltima, horaDaLista, rotuloDoDia, linkificar, tamanhoBR, nomeSeguro, caminhoDoArquivo,
  conferirArquivos, ehImagem, linhasDaLista, vistoPor, textoDoVisto, naoLidasTotal, ehCelular, textoDoAviso, LIMITE_ARQUIVO } from '../assets/js/chat-equipe.js';
import { escapeHtml } from '../assets/js/assistente.js';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + extra : '')); };

const EU = 'financeiro@macedoereis.com.br', TH = 'fiscal@macedoereis.com.br', VI = 'rh@macedoereis.com.br', AD = 'contabil@macedoereis.com.br';
console.log('Quem é quem:');
chk('o nome da equipe pelo e-mail; sem ele, o começo do e-mail', nomeDe(TH) === 'Thalia' && nomeDe('FISCAL@macedoereis.com.br') === 'Thalia' && nomeDe('joao.silva@macedoereis.com.br') === 'Joao Silva' && nomeDe('') === 'Alguém');
chk('as iniciais: duas letras, sem acento', iniciais('Vitória') === 'VI' && iniciais('Fiscal e DP') === 'FD' && iniciais('') === '?' && iniciais('Escritório') === 'ES');

console.log('A lista:');
const D = { conversa_id: 'd1', tipo: 'direta', membros: [EU, TH], ultima_autor: TH, ultima_texto: 'manda a guia da Adega?', ultima_anexos: 0, ultima_apagada: false, ultima_em: '2026-10-16T14:02:00Z', nao_lidas: 2 };
const G = { conversa_id: 'g1', tipo: 'grupo', titulo: 'Fiscal e DP', membros: [EU, TH, VI], ultima_autor: VI, ultima_texto: 'reunião às 15h', ultima_em: '2026-10-16T13:40:00Z', nao_lidas: 1, silenciada: true };
const ESC = { conversa_id: 'e1', tipo: 'grupo', titulo: 'Escritório', chave: 'escritorio', membros: [EU, TH, VI, AD], ultima_autor: null, ultima_em: '2026-10-10T10:00:00Z', nao_lidas: 0 };
chk('na conversa a dois, o título é o outro; no grupo, o nome dele', outroDa(D, EU) === TH && tituloDaConversa(D, EU) === 'Thalia' && tituloDaConversa(G, EU) === 'Fiscal e DP' && outroDa(G, EU) === null);
chk('a última mensagem: a dois sem nome; no grupo, quem mandou; "Você:" na minha', previaDaUltima(D, EU) === 'manda a guia da Adega?' && previaDaUltima(G, EU) === 'Vitória: reunião às 15h'
  && previaDaUltima({ ...D, ultima_autor: EU }, EU) === 'Você: manda a guia da Adega?');
chk('a última mensagem: apagada, só arquivo, nenhuma ainda (e o grupo de todos)', previaDaUltima({ ...D, ultima_apagada: true }, EU) === 'mensagem apagada'
  && previaDaUltima({ ...D, ultima_texto: null, ultima_anexos: 3 }, EU) === '3 arquivos' && previaDaUltima({ ...D, ultima_texto: '', ultima_anexos: 1 }, EU) === 'arquivo'
  && previaDaUltima(ESC, EU) === 'O grupo de todo o escritório' && previaDaUltima({ ...D, ultima_autor: null }, EU) === 'Sem mensagens ainda');
const AGORA = new Date(2026, 9, 16, 15, 0);   // sexta, 16/10/2026, 15h (no fuso do computador)
const L = (dia, h, m = 0) => new Date(2026, 9, dia, h, m).toISOString();
chk('a hora da lista: hoje a hora, ontem, o dia da semana, a data', horaDaLista(L(16, 9, 5), AGORA) === '09:05' && horaDaLista(L(15, 22), AGORA) === 'ontem'
  && horaDaLista(L(12, 8), AGORA) === 'segunda' && horaDaLista(L(2, 8), AGORA) === '02/10/2026' && horaDaLista(null, AGORA) === '', horaDaLista(L(12, 8), AGORA));
chk('o separador do dia na conversa', rotuloDoDia(L(16, 8), AGORA) === 'Hoje' && rotuloDoDia(L(15, 8), AGORA) === 'Ontem' && rotuloDoDia(L(9, 8), AGORA) === '09/10/2026');
const linhas = linhasDaLista([ESC, G, D], [EU, TH, VI, AD], EU);
chk('a ordem: as conversas pela última mensagem, depois quem ainda não tem conversa a dois comigo, por nome',
  linhas.map(l => l.conversa ? l.conversa.conversa_id : l.pessoa).join() === ['d1', 'g1', 'e1', AD, VI].join(), JSON.stringify(linhas.map(l => l.conversa ? l.conversa.conversa_id : l.nome)));
chk('o total do balão: sem as silenciadas', naoLidasTotal([D, G, ESC]) === 2 && naoLidasTotal([]) === 0 && naoLidasTotal([{ nao_lidas: -3 }]) === 0);

console.log('As mensagens:');
const esc = linkificar(escapeHtml('veja https://drive.google.com/x?a=1&b=2, e <script>alert(1)</script> javascript:alert(1)'));
chk('os endereços viram link (aba nova, sem a pontuação do fim); o resto continua escapado', esc.includes('<a href="https://drive.google.com/x?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">https://drive.google.com/x?a=1&amp;b=2</a>,')
  && esc.includes('&lt;script&gt;') && !esc.includes('href="javascript'), esc);
chk('o endereço com aspas não sai do atributo', !/href="[^"]*"[^ >]/.test(linkificar(escapeHtml('https://x.com/"onmouseover="alert(1)'))), linkificar(escapeHtml('https://x.com/"onmouseover="alert(1)')));
const mm = (autor, iso) => ({ id: 'm', autor, criada_em: iso });
const membros = [{ email: EU, lido_ate: '2026-10-16T14:10:00Z' }, { email: TH, lido_ate: '2026-10-16T14:05:00Z' }, { email: VI, lido_ate: '2026-10-16T13:00:00Z' }];
chk('o visto: quem leu depois da mensagem, menos quem mandou', vistoPor(mm(EU, '2026-10-16T14:00:00Z'), membros).join() === TH && vistoPor(mm(EU, '2026-10-16T14:06:00Z'), membros).length === 0);
chk('o visto: a dois "Visto"; no grupo, os nomes ou "todos"', textoDoVisto(mm(EU, '2026-10-16T14:00:00Z'), membros.slice(0, 2), D) === 'Visto'
  && textoDoVisto(mm(EU, '2026-10-16T14:00:00Z'), membros, G) === 'Visto por Thalia' && textoDoVisto(mm(EU, '2026-10-16T12:00:00Z'), membros, G) === 'Visto por todos'
  && textoDoVisto(mm(EU, '2026-10-16T15:00:00Z'), membros, G) === '');

console.log('Os arquivos:');
chk('o tamanho', tamanhoBR(512) === '512 bytes' && tamanhoBR(2048) === '2 KB' && tamanhoBR(1258291) === '1,2 MB' && tamanhoBR(null) === '');
chk('o nome na pasta: sem acento, sem barra, sem caractere que o Storage recusa; a extensão fica', nomeSeguro('Guia DAS – março/2026 (cópia).pdf') === 'Guia DAS _ marco_2026 (copia).pdf'
  && nomeSeguro('../../etc/passwd') === '_.._etc_passwd' && nomeSeguro('') === 'arquivo' && nomeSeguro('.pdf') === 'pdf' && nomeSeguro('a'.repeat(300) + '.xlsx').length === 105, nomeSeguro('../../etc/passwd'));
chk('a pasta do arquivo: a da conversa, a da mensagem e o nome', caminhoDoArquivo('c1', 'm1', 'Nota fiscal.pdf') === 'c1/m1/Nota fiscal.pdf');
const F = (name, size) => ({ name, size });
const c1 = conferirArquivos([F('a.pdf', 10), F('vazio.txt', 0), F('grande.zip', LIMITE_ARQUIVO + 1), F('b.png', LIMITE_ARQUIVO)], 0);
chk('até 25 MB cada; vazio não vai', c1.ok.map(f => f.name).join() === 'a.pdf,b.png' && c1.recusados.map(r => r.nome + ':' + r.motivo).join() === 'vazio.txt:está vazio,grande.zip:passa de 25 MB', JSON.stringify(c1.recusados));
const c2 = conferirArquivos([F('1', 1), F('2', 1), F('3', 1)], 8);
chk('no máximo 10 por mensagem (com os que já esperam)', c2.ok.length === 2 && c2.recusados[0].motivo === 'passa de 10 arquivos por mensagem');
chk('imagem é png, jpg, gif e webp', ehImagem('image/png') && ehImagem('image/JPEG') && ehImagem('image/webp') && !ehImagem('image/svg+xml') && !ehImagem('application/pdf'));

console.log('Os avisos:');
const nav = ua => ({ userAgent: ua });
const semToque = q => ({ matches: q === '(pointer: fine)' });
chk('celular e tablet não avisam; o computador sim', ehCelular(nav('Mozilla/5.0 (Linux; Android 14) Mobile Safari'), semToque) && ehCelular(nav('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)'), semToque)
  && !ehCelular(nav('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0'), semToque) && ehCelular(nav('Mozilla/5.0 (X11; Linux)'), q => ({ matches: q === '(pointer: coarse)' })));
const a1 = textoDoAviso(D, { autor: TH, texto: 'manda a guia\nda Adega?' }, EU), a2 = textoDoAviso(G, { autor: VI, texto: null, anexos: [{ nome: 'folha.pdf' }, { nome: 'x' }] }, EU);
chk('o aviso: a dois, o nome e o texto; no grupo, o grupo e "quem: texto"; arquivo pelo nome', a1.titulo === 'Thalia' && a1.corpo === 'manda a guia da Adega?'
  && a2.titulo === 'Fiscal e DP' && a2.corpo === 'Vitória: Arquivo: folha.pdf e mais 1', JSON.stringify([a1, a2]));

console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
