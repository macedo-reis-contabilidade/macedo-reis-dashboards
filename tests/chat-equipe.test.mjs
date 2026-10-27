// O chat da equipe (assets/js/chat-equipe.js), os auxiliares puros: o nome de quem tem login, as iniciais, o título e a
// última mensagem de cada conversa na lista, a hora da lista e o separador do dia, os endereços que viram link (só http e
// https, com o texto já escapado), o tamanho e o nome seguro do arquivo na pasta, a conferência dos arquivos (25 MB, 10 por
// mensagem), a ordem da lista (as conversas pela última mensagem, depois quem ainda não tem conversa comigo), o "visto",
// o total do balão (sem as silenciadas), o celular (sem aviso), o texto do aviso, como avisar e, desde 26/10/2026, o bipe
// mais forte, o religar da ligação ao vivo e o painel "Avisos deste computador"; e os emojis (20/10/2026): os grupos do
// painel, os usados por último, o emoji no lugar do cursor e a mensagem só de emoji. Rodar com: node tests/chat-equipe.test.mjs
import { nomeDe, iniciais, outroDa, tituloDaConversa, previaDaUltima, horaDaLista, rotuloDoDia, linkificar, tamanhoBR, nomeSeguro, caminhoDoArquivo,
  conferirArquivos, ehImagem, linhasDaLista, vistoPor, textoDoVisto, naoLidasTotal, ehCelular, textoDoAviso, comoAvisar, esperaDoAviso, LIMITE_ARQUIVO,
  BIPE, esperaParaReligar, diagnosticoDosAvisos, rotuloDosAvisos,
  linkDoDrive, enviarMensagem, apagarMensagem, conversaDe, EMOJIS, nomeDoEmoji, recentesCom, lerRecentes, inserirNoTexto, soEmojis, MAX_RECENTES, MAX_TEXTO,
  trechoDaCitada, quemDaCitada, MAX_TRECHO, ehAvisos, acaoDoAviso, TITULO_AVISOS } from '../assets/js/chat-equipe.js';
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
// como avisar: o bipe sempre (21/10/2026); atrás, o aviso do Windows junto, sempre com o som dele (26/10/2026: até ali ia
// mudo quando o bipe tocava, e o bipe baixo passava batido — a mensagem chegava sem som que se ouvisse)
const plano = op => JSON.stringify(comoAvisar(op));
chk('na frente: o bipe e o recado, sem o aviso do Windows', plano({ frente: true, podeNotificar: true }) === JSON.stringify({ bipe: true, recado: true, notificacao: false }));
chk('atrás, com os avisos ligados: o bipe e o aviso do Windows (que leva o som dele)',
  plano({ frente: false, podeNotificar: true }) === JSON.stringify({ bipe: true, recado: false, notificacao: true }), plano({ frente: false, podeNotificar: true }));
chk('o plano não tem mais o "sem som": o aviso do Windows nunca vai mudo', !('semSom' in comoAvisar({ frente: false, podeNotificar: true, somPronto: true })));
chk('atrás, sem os avisos ligados: só o bipe', plano({ frente: false, podeNotificar: false }) === JSON.stringify({ bipe: true, recado: false, notificacao: false }));
chk('o bipe desligado no painel dos avisos: sem bipe, e o aviso do Windows', plano({ frente: false, somLigado: false, podeNotificar: true }) === JSON.stringify({ bipe: false, recado: false, notificacao: true }));
chk('no celular: nem bipe nem aviso do Windows (o recado, só com a tela na frente)', plano({ celular: true, frente: false, podeNotificar: true }) === JSON.stringify({ bipe: false, recado: false, notificacao: false })
  && comoAvisar({ celular: true, frente: true }).recado === true && comoAvisar({ celular: true, frente: true }).bipe === false);
chk('o bipe (26/10/2026): mais forte e mais longo que o de antes (pico 0,11, notas de 0,09 e 0,13 s), sem estourar',
  BIPE.volume >= 0.3 && BIPE.volume <= 0.5 && BIPE.notas.length === 2 && BIPE.notas.every(([f, , d]) => f >= 600 && f <= 2000 && d >= 0.2)
  && Math.max(...BIPE.notas.map(([, i, d]) => i + d)) >= 0.5 && Math.max(...BIPE.notas.map(([, i, d]) => i + d)) <= 1 && Object.isFrozen(BIPE) && Object.isFrozen(BIPE.notas[0]), JSON.stringify(BIPE));
chk('religar a ligação ao vivo: logo na primeira queda, depois cada vez mais devagar, até 1 minuto',
  [0, 1, 2, 3, 4, 9].map(esperaParaReligar).join() === '2000,5000,15000,30000,60000,60000' && esperaParaReligar(-2) === 2000 && esperaParaReligar('x') === 2000 && esperaParaReligar(1.7) === 5000,
  [0, 1, 2, 3, 4, 9].map(esperaParaReligar).join());
const diag = op => diagnosticoDosAvisos(op).map(i => i.id + ':' + (i.ok ? 'ok' : 'falta')).join(' ');
chk('o painel dos avisos: tudo ligado e ao vivo', diag({ permissao: 'granted', bipe: true, caiu: false }) === 'windows:ok bipe:ok ligacao:ok', diag({ permissao: 'granted', bipe: true, caiu: false }));
const dd = diagnosticoDosAvisos({ permissao: 'default', bipe: false, caiu: true });
chk('o painel dos avisos: o que falta, em palavras — o aviso do Windows a ligar (com o botão), o bipe desligado, a ligação voltando',
  diag({ permissao: 'default', bipe: false, caiu: true }) === 'windows:falta bipe:falta ligacao:falta' && dd[0].ligar === true && /Ainda não ligado/.test(dd[0].texto)
  && /Desligado/.test(dd[1].texto) && /voltando sozinha/.test(dd[2].texto) && /a cada minuto/.test(dd[2].texto), JSON.stringify(dd));
const dBloq = diagnosticoDosAvisos({ permissao: 'denied' })[0], dSem = diagnosticoDosAvisos({ permissao: 'sem' })[0];
chk('bloqueado: diz onde liberar (o cadeado do endereço), sem botão de ligar; sem o recurso no navegador: só o bipe',
  !dBloq.ok && /cadeado/.test(dBloq.texto) && /Permitir/.test(dBloq.texto) && !dBloq.ligar && !dSem.ok && /só o bipe/.test(dSem.texto) && !dSem.ligar);
chk('o sininho do rodapé diz o principal', rotuloDosAvisos({ permissao: 'granted', bipe: true }) === 'Avisos ligados' && rotuloDosAvisos({ permissao: 'granted', bipe: false }) === 'Avisos · sem bipe'
  && rotuloDosAvisos({ permissao: 'default' }) === 'Ligar os avisos' && rotuloDosAvisos({ permissao: 'denied', bipe: true }) === 'Avisos bloqueados'
  && rotuloDosAvisos({ permissao: 'sem', bipe: true }) === 'Avisos: só o bipe' && rotuloDosAvisos({ permissao: 'sem', bipe: false }) === 'Avisos desligados');
chk('quem avisa entre as abas: a da frente na hora; atrás, a que pode tocar o bipe antes da que não pode',
  esperaDoAviso({ frente: true, somPronto: false }) === 0 && esperaDoAviso({ somPronto: true, sorte: 0 }) === 350 && esperaDoAviso({ somPronto: true, sorte: 1 }) === 600
  && esperaDoAviso({ somPronto: false, sorte: 0 }) === 1600 && esperaDoAviso({ somPronto: true, sorte: 0.99 }) < esperaDoAviso({ somPronto: false, sorte: 0 }) && esperaDoAviso({ somPronto: true, sorte: 'x' }) === 350);

// ---------- mandar e apagar (19/10/2026): a regra da tela e do cartão do assistente, com um banco de mentira ----------
console.log('Mandar, apagar e pra onde vai:');
chk('o link do Drive: só https do Google Drive ou Docs, sem usuário nem porta', linkDoDrive('https://drive.google.com/file/d/X/view') === 'https://drive.google.com/file/d/X/view'
  && linkDoDrive('https://docs.google.com/document/d/Y/edit') === 'https://docs.google.com/document/d/Y/edit' && linkDoDrive('http://drive.google.com/x') === null
  && linkDoDrive('javascript:alert(1)') === null && linkDoDrive('https://drive.google.com.exemplo.com/x') === null && linkDoDrive('https://eu:senha@drive.google.com/x') === null
  && linkDoDrive('https://drive.google.com:8443/x') === null && linkDoDrive(null) === null);
function sbFalso({ jaTinha = false, falhaRpc = null, grupos = [], pessoas = [] } = {}) {
  const log = [], linhas = [];
  const tabela = nome => {
    const q = { _f: [] };
    q.insert = r => { q._ins = r; return q; };
    q.update = r => { q._upd = r; return q; };
    q.select = () => q;
    q.eq = (k, v) => { q._f.push([k, v]); return q; };
    q.single = async () => {
      if (q._ins) {
        log.push(['insert', nome, q._ins]);
        if (jaTinha || linhas.some(l => l.id === q._ins.id)) return { data: null, error: { code: '23505', message: 'duplicate key' } };
        const l = { ...q._ins, autor: EU, criada_em: '2026-10-19T20:00:00Z', apagada_em: null }; linhas.push(l); return { data: l, error: null };
      }
      if (q._upd) {
        log.push(['update', nome, q._upd, q._f]);
        const l = linhas.find(x => q._f.every(([k, v]) => x[k] === v));
        if (!l) return { data: null, error: { code: 'PGRST116', message: 'no rows' } };
        Object.assign(l, q._upd, { texto: null, anexos: [] }); return { data: l, error: null };
      }
      log.push(['select', nome, q._f]);
      const l = linhas.find(x => q._f.every(([k, v]) => x[k] === v)) || (jaTinha ? { id: q._f[0][1], conversa_id: 'c1', autor: EU, texto: 'já tinha', anexos: [], criada_em: '2026-10-19T19:59:00Z' } : null);
      return { data: l, error: l ? null : { message: 'no rows' } };
    };
    return q;
  };
  const rpc = async (nome, a) => {
    log.push(['rpc', nome, a]);
    if (falhaRpc === nome) return { data: null, error: { message: 'essa pessoa não tem login no sistema' } };
    if (nome === 'chat_abrir_direta') return { data: 'conv-' + a.outro.split('@')[0], error: null };
    if (nome === 'chat_resumo') return { data: grupos, error: null };
    if (nome === 'chat_pessoas') return { data: pessoas, error: null };
    return { data: 'c-esc', error: null };
  };
  return { sb: { from: tabela, rpc }, log, linhas };
}
{
  const { sb, log, linhas } = sbFalso();
  const r = await enviarMensagem(sb, { id: 'm1', conversaId: 'conv-x', texto: 'Segue o contrato.', anexos: [{ nome: 'Contrato.pdf', link: 'https://drive.google.com/file/d/A/view', pasta: '' }] });
  chk('mandar: com o id da tela, o texto e o link do arquivo; quem e quando, o banco põe', r.mensagem && r.mensagem.autor === EU && linhas.length === 1 && linhas[0].id === 'm1'
    && linhas[0].anexos[0].link === 'https://drive.google.com/file/d/A/view' && log[0][0] === 'insert', JSON.stringify(r));
  const r2 = await enviarMensagem(sb, { id: 'm1', conversaId: 'conv-x', texto: 'Segue o contrato.' });
  chk('mandar de novo com o mesmo id: não duplica (lê a que já tinha entrado)', r2.mensagem && r2.mensagem.id === 'm1' && linhas.length === 1, JSON.stringify(r2));
  chk('mandar vazio ou sem conversa: não manda', (await enviarMensagem(sb, { id: 'm2', conversaId: 'conv-x', texto: '' })).erro === 'Mensagem vazia.'
    && (await enviarMensagem(sb, { id: 'm3', texto: 'oi' })).erro === 'Mensagem sem conversa.' && linhas.length === 1);
  const a = await apagarMensagem(sb, 'm1', EU);
  chk('apagar: só a própria (o filtro do autor); o banco tira o texto e o arquivo', a.mensagem && a.mensagem.apagada_em && a.mensagem.texto === null && a.mensagem.anexos.length === 0
    && JSON.stringify(log.find(l => l[0] === 'update')[3]) === JSON.stringify([['id', 'm1'], ['autor', EU]]));
  chk('apagar a de outra pessoa (o banco não acha): erro, sem fingir', (await apagarMensagem(sb, 'm1', TH)).erro === 'Não consegui apagar agora.');
}
{
  const GR = [{ conversa_id: 'c-esc', tipo: 'grupo', titulo: 'Escritório', chave: 'escritorio' }, { conversa_id: 'c-g1', tipo: 'grupo', titulo: 'Fiscal e DP', chave: null },
    { conversa_id: 'c-g2', tipo: 'grupo', titulo: 'Fiscal — fechamento', chave: null }, { conversa_id: 'c-d1', tipo: 'direta', titulo: null, chave: EU + '|' + TH }];
  const { sb, log } = sbFalso({ grupos: GR, pessoas: [AD, EU, TH, VI] });
  const p = await conversaDe(sb, { email: 'RH@macedoereis.com.br' }, EU);
  chk('pra uma pessoa: a conversa a dois (que o banco abre se não existe)', p.id === 'conv-rh' && p.nome === 'Vitória' && log.some(l => l[1] === 'chat_abrir_direta' && l[2].outro === VI), JSON.stringify(p));
  chk('pra si mesmo, não', /você mesmo/.test((await conversaDe(sb, { email: EU }, EU)).erro));
  const e = await conversaDe(sb, { grupo: 'escritorio' }, EU);
  chk('o grupo de todos: prepara (se ninguém abriu o chat ainda) e acha pela chave', e.id === 'c-esc' && e.nome === 'Escritório' && log.some(l => l[1] === 'chat_preparar'), JSON.stringify(e));
  chk('outro grupo: pelo nome, sem acento e maiúscula', (await conversaDe(sb, { grupo: 'fiscal e dp' }, EU)).id === 'c-g1' && (await conversaDe(sb, { grupo: 'FECHAMENTO' }, EU)).id === 'c-g2');
  const amb = await conversaDe(sb, { grupo: 'Fiscal' }, EU);
  chk('nome que bate com dois grupos: não chuta', /nenhum grupo chamado "Fiscal"/.test(amb.erro), JSON.stringify(amb));
  const pessoa = await conversaDe(sb, { grupo: 'Adaini' }, EU);
  chk('sem grupo com o nome, a pessoa do chat com esse nome (a conversa a dois)', pessoa.id === 'conv-contabil' && pessoa.nome === 'Adaini', JSON.stringify(pessoa));
  chk('nem grupo nem pessoa: diz', /nenhum grupo chamado "Diretoria"/.test((await conversaDe(sb, { grupo: 'Diretoria' }, EU)).erro));
  const { sb: sb2 } = sbFalso({ falhaRpc: 'chat_abrir_direta' });
  chk('a pessoa sem login: o banco recusa e o motivo vem em português', /Vitória não tem login no sistema/.test((await conversaDe(sb2, { email: VI }, EU)).erro));
}

// ---------- a resposta (20/10/2026): o trecho da citada, quem escreveu e a citação que vai junto ----------
console.log('A resposta:');
{
  const t1 = trechoDaCitada({ autor: TH, texto: 'Saiu sim,\n\n  te mando   a guia.' });
  chk('o trecho: o texto numa linha só', t1.texto === 'Saiu sim, te mando a guia.' && !t1.apagada && !t1.ausente, JSON.stringify(t1));
  const longo = trechoDaCitada({ texto: 'a'.repeat(300) }), acento = trechoDaCitada({ texto: 'é'.repeat(MAX_TRECHO) + '😀' });
  chk('o trecho longo: até ' + MAX_TRECHO + ' caracteres, com reticências (sem partir o emoji)', [...longo.texto].length === MAX_TRECHO && longo.texto.endsWith('…')
    && [...acento.texto].length === MAX_TRECHO && !acento.texto.includes('\uFFFD') && trechoDaCitada({ texto: 'x'.repeat(MAX_TRECHO) }).texto === 'x'.repeat(MAX_TRECHO), longo.texto.length);
  chk('sem texto: o arquivo pelo nome (a imagem, como imagem) ou quantos', trechoDaCitada({ texto: null, anexos: [{ nome: 'Guia DAS.pdf', tipo: 'application/pdf' }] }).texto === 'Arquivo: Guia DAS.pdf'
    && trechoDaCitada({ texto: '', anexos: [{ nome: 'print.png', tipo: 'image/png' }] }).texto === 'Imagem: print.png'
    && trechoDaCitada({ anexos: [{ nome: 'a' }, { nome: 'b' }, { nome: 'c' }] }).texto === '3 arquivos' && trechoDaCitada({ anexos: [] }).texto === 'Mensagem');
  const ap = trechoDaCitada({ autor: TH, texto: null, anexos: [], apagada_em: '2026-10-20T20:00:00Z' }), au = trechoDaCitada(null);
  chk('a apagada diz que foi apagada (sem o texto); a que ainda não chegou, "Mensagem anterior"', ap.texto === 'Mensagem apagada' && ap.apagada && au.texto === 'Mensagem anterior' && au.ausente);
  chk('quem escreveu: "Você" na minha; o nome nas outras', quemDaCitada({ autor: EU }, EU) === 'Você' && quemDaCitada({ autor: 'FINANCEIRO@macedoereis.com.br' }, EU) === 'Você'
    && quemDaCitada({ autor: TH }, EU) === 'Thalia' && quemDaCitada(null, EU) === '');
  const { sb, log, linhas } = sbFalso();
  const r = await enviarMensagem(sb, { id: 'r1', conversaId: 'conv-x', texto: 'Ótimo, aguardo', respondeA: 'm2' });
  const r2 = await enviarMensagem(sb, { id: 'r2', conversaId: 'conv-x', texto: 'sem citar' });
  const ins = log.filter(l => l[0] === 'insert').map(l => l[2]);
  chk('mandar respondendo: a citada vai junto (responde_a); sem resposta, nem a chave vai', r.mensagem && ins[0].responde_a === 'm2' && linhas[0].responde_a === 'm2'
    && r2.mensagem && !('responde_a' in ins[1]), JSON.stringify(ins));
}

console.log('Os emojis:');
{
  const todos = EMOJIS.flatMap(g => g.itens.map(([e]) => e));
  chk('os grupos do painel: carinhas, gestos, trabalho, símbolos, festa e lazer', EMOJIS.map(g => g.id).join() === 'carinhas,gestos,trabalho,simbolos,festa');
  chk('cada emoji com o nome em português, sem repetir entre os grupos', EMOJIS.every(g => g.itens.length >= 20 && g.itens.every(([e, n]) => e && n && n === n.toLowerCase()))
    && new Set(todos).size === todos.length, todos.length);
  chk('cada um é um emoji só (o que o painel põe é o que a mensagem grande reconhece)', todos.every(e => soEmojis(e, 1)), todos.filter(e => !soEmojis(e, 1)).join(' '));
  // os mais novos que o Emoji 12 (2019) virariam quadradinho nos computadores antigos
  const novos = ['🫡', '🥹', '🫶', '🫠', '🥲', '🤌', '🫂', '🥸'];
  chk('nada além do Emoji 12', !todos.some(e => novos.includes(e)));
  chk('o nome pelo emoji (o dos usados por último)', nomeDoEmoji('👍') === 'joinha' && nomeDoEmoji('🧉') === 'chimarrão' && nomeDoEmoji('x') === '');
  const r1 = recentesCom([], '👍'), r2 = recentesCom(r1, '😀'), r3 = recentesCom(r2, '👍');
  chk('os usados por último: o mais recente primeiro, sem repetir', r1.join() === '👍' && r2.join() === '😀,👍' && r3.join() === '👍,😀');
  const muitos = todos.slice(0, 30).reduce((l, e) => recentesCom(l, e), []);
  chk('no máximo ' + MAX_RECENTES, muitos.length === MAX_RECENTES && muitos[0] === todos[29]);
  chk('o guardado no navegador: só emoji, sem repetir; o que não for, fica de fora', lerRecentes('["👍","😀","👍","oi",3,"<b>"]').join() === '👍,😀' && lerRecentes('{x') .length === 0
    && lerRecentes(null).length === 0 && lerRecentes('{"a":1}').length === 0 && lerRecentes(JSON.stringify(todos)).length === MAX_RECENTES);
  const i1 = inserirNoTexto('Bom dia', 3, 3, '😀'), i2 = inserirNoTexto('Bom dia', 0, 3, '👋'), i3 = inserirNoTexto('', undefined, undefined, '👍'), i4 = inserirNoTexto('fim', null, null, '✅');
  chk('o emoji no lugar do cursor (e no lugar da seleção), com o cursor depois dele', i1.valor === 'Bom😀 dia' && i1.cursor === 5 && i2.valor === '👋 dia' && i2.cursor === 2
    && i3.valor === '👍' && i4.valor === 'fim✅', JSON.stringify([i1, i2, i3, i4]));
  chk('não passa do limite da mensagem', inserirNoTexto('a'.repeat(MAX_TEXTO - 1), MAX_TEXTO - 1, MAX_TEXTO - 1, '👍') === null && inserirNoTexto('a'.repeat(MAX_TEXTO - 2), 0, 0, '👍').valor.length === MAX_TEXTO);
  chk('a mensagem só de emoji (até três): sai maior', soEmojis('👍') && soEmojis(' 👍👍 ') && soEmojis('🎉🎉🎉') && soEmojis('❤️') && soEmojis('✌️ 😀'));
  chk('o tom de pele, a família e a bandeira contam como um', soEmojis('👋🏽', 1) && soEmojis('👨‍👩‍👧', 1) && soEmojis('🇧🇷', 1));
  chk('com texto, número ou quatro emojis: o balão normal', !soEmojis('ok 👍') && !soEmojis('👍👍👍👍') && !soEmojis('123') && !soEmojis('#') && !soEmojis('') && !soEmojis(null) && !soEmojis('😀'.repeat(30)));
}

console.log('Os avisos do sistema:');
{
  const AV = { conversa_id: 'a1', tipo: 'grupo', titulo: 'Avisos do sistema', chave: 'avisos|' + EU, membros: [EU], ultima_autor: 'sistema',
    ultima_texto: 'Thalia te passou uma tarefa: Emitir a nota · prazo 22/10.', ultima_em: '2026-10-20T21:00:00Z', nao_lidas: 1 };
  chk('a conversa de avisos é a da chave "avisos|" (o grupo de todos e os outros, não)', ehAvisos(AV) && !ehAvisos(ESC) && !ehAvisos(G) && !ehAvisos(D) && !ehAvisos(null) && !ehAvisos({ chave: null }));
  chk('o título é "Avisos do sistema" e quem escreve, "Sistema"', tituloDaConversa(AV, EU) === TITULO_AVISOS && TITULO_AVISOS === 'Avisos do sistema' && nomeDe('sistema') === 'Sistema' && nomeDe('SISTEMA') === 'Sistema');
  chk('na lista, o aviso sem "Sistema:" na frente; sem aviso ainda, o recado dele', previaDaUltima(AV, EU) === 'Thalia te passou uma tarefa: Emitir a nota · prazo 22/10.'
    && previaDaUltima({ ...AV, ultima_autor: null }, EU) === 'Nenhum aviso ainda');
  const av = textoDoAviso(AV, { autor: 'sistema', texto: 'Chegou uma admissão pelo link: Maria — Padaria X.' }, EU);
  chk('a notificação: o título é a conversa, o corpo é o aviso (sem o nome na frente)', av.titulo === 'Avisos do sistema' && av.corpo === 'Chegou uma admissão pelo link: Maria — Padaria X.', JSON.stringify(av));
  const RAIZ = 'https://exemplo.github.io/macedo-reis-dashboards/';
  const M = (acao, x = {}) => ({ autor: 'sistema', texto: 'aviso', acao, apagada_em: null, ...x });
  const a1 = acaoDoAviso(M({ rotulo: 'Abrir a admissão', link: 'dp-admissoes.html?admissao=4c28edc8-8b21-4e9a-90fd-53b1aa18abfb' }), RAIZ);
  chk('o botão: a tela do sistema, a partir da raiz do site', a1 && a1.rotulo === 'Abrir a admissão' && a1.href === RAIZ + 'dp-admissoes.html?admissao=4c28edc8-8b21-4e9a-90fd-53b1aa18abfb', JSON.stringify(a1));
  const a2 = acaoDoAviso(M({ link: 'clientes/editar.html?id=c1' }), RAIZ), a3 = acaoDoAviso(M({ rotulo: '  Abrir   a\ntarefa ', link: 'agenda.html?tarefa=t1' }), 'http://127.0.0.1:8000/');
  chk('a tela de uma pasta (clientes/), sem rótulo vira "Abrir"; o rótulo numa linha só', a2 && a2.href === RAIZ + 'clientes/editar.html?id=c1' && a2.rotulo === 'Abrir'
    && a3 && a3.href === 'http://127.0.0.1:8000/agenda.html?tarefa=t1' && a3.rotulo === 'Abrir a tarefa', JSON.stringify([a2, a3]));
  const ruins = ['https://fora.com/x.html', '//fora.com/x.html', 'javascript:alert(1)', '../outro/x.html', 'x.html?a=<b>', 'x.html?a="1"', '/agenda.html',
    'agenda.html?x=1 y', 'data:text/html,oi', 'agenda.htm', 'Agenda.html', 'a/b/c.html', ' agenda.html', ''];
  chk('endereço de fora, "javascript:", "../", com caractere estranho ou que não é uma tela: sem botão', ruins.every(l => acaoDoAviso(M({ rotulo: 'x', link: l }), RAIZ) === null),
    ruins.filter(l => acaoDoAviso(M({ rotulo: 'x', link: l }), RAIZ)).join(' | '));
  chk('só na mensagem do sistema, não apagada, com o botão como objeto', acaoDoAviso(M({ link: 'agenda.html' }, { autor: TH }), RAIZ) === null
    && acaoDoAviso(M({ link: 'agenda.html' }, { apagada_em: '2026-10-20T21:00:00Z' }), RAIZ) === null && acaoDoAviso(M(null), RAIZ) === null
    && acaoDoAviso(M('agenda.html'), RAIZ) === null && acaoDoAviso(M(['agenda.html']), RAIZ) === null && acaoDoAviso(null, RAIZ) === null
    && acaoDoAviso(M({ link: 'agenda.html' }), 'não é endereço') === null);
}

console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
