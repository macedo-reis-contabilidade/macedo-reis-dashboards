// As regras do robô do atendimento pelo WhatsApp que não dependem da IA (assets/js/atendimento-robo.js, 11/11/2026, o
// começo da etapa 4): o horário da equipe, quando ela volta, quem recebe, as frases da passagem, o aviso dos 30 minutos e
// o balcão aprovado. Rodar com: node tests/atendimento-robo.test.mjs
import * as R from '../assets/js/atendimento-robo.js';
import * as IA from '../supabase/functions/whatsapp/robo.js';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { posix } from 'node:path';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); };
const T = s => new Date(s);

console.log('O horário da equipe (de segunda a sexta, das 7h30 às 17h30, Brasília):');
chk('quarta 10h está no horário', R.dentroDoHorario(T('2026-11-11T13:00:00Z')));
chk('7h29 ainda não, 7h30 já', !R.dentroDoHorario(T('2026-11-11T10:29:00Z')) && R.dentroDoHorario(T('2026-11-11T10:30:00Z')));
chk('17h29 sim, 17h30 não', R.dentroDoHorario(T('2026-11-11T20:29:00Z')) && !R.dentroDoHorario(T('2026-11-11T20:30:00Z')));
chk('sábado não', !R.dentroDoHorario(T('2026-11-14T13:00:00Z')));
chk('feriado em dia de semana não (20/11, Consciência Negra)', !R.dentroDoHorario(T('2026-11-20T13:00:00Z')));
chk('a meia-noite de Brasília é a de UTC−3 (quinta 1h UTC = quarta 22h)', !R.dentroDoHorario(T('2026-11-12T01:00:00Z'))
  && R.emBrasilia(T('2026-11-12T01:00:00Z')).dia === '2026-11-11');

console.log('Quando a equipe volta:');
chk('no horário, null', R.voltaDaEquipe(T('2026-11-11T13:00:00Z')) === null);
chk('6h da manhã: hoje', (R.voltaDaEquipe(T('2026-11-11T09:00:00Z')) || {}).texto === 'hoje, às 7h30');
chk('quarta 18h: amanhã', (R.voltaDaEquipe(T('2026-11-11T21:00:00Z')) || {}).texto === 'amanhã, às 7h30');
chk('sexta 18h: segunda', (R.voltaDaEquipe(T('2026-11-13T21:00:00Z')) || {}).texto === 'segunda, às 7h30');
chk('quinta 19/11 18h, com o feriado na sexta: segunda 23/11', (R.voltaDaEquipe(T('2026-11-19T21:00:00Z')) || {}).dia === '2026-11-23');
chk('sábado de Carnaval de 2027: quarta', (R.voltaDaEquipe(T('2027-02-06T15:00:00Z')) || {}).texto === 'quarta, às 7h30');

console.log('Quem recebe e como o robô fala dela:');
chk('o fiscal: a Thalia, do fiscal', R.quemRecebe('fiscal').comSetor === 'a Thalia, do fiscal');
chk('o DP: a Vitória, do DP', R.quemRecebe('dp').comSetor === 'a Vitória, do DP');
chk('o societário é da Adaini (wa-07)', R.quemRecebe('societario').comSetor === 'a Adaini, do societário');
chk('o financeiro: o Samuel, ele', R.quemRecebe('financeiro').comSetor === 'o Samuel, do financeiro' && R.quemRecebe('financeiro').pronome === 'ele');
chk('sem setor: a Thalia (wa-06)', R.quemRecebe(null).nome === 'Thalia');
chk('com a pessoa escolhida, ela', R.quemRecebe('fiscal', 'diego@macedoereis.com.br').comSetor === 'o Diego, do fiscal');

console.log('A frase da passagem:');
const qua10 = T('2026-11-11T13:00:00Z'), sab = T('2026-11-14T13:00:00Z');
chk('no horário', R.textoDaPassagem({ setor: 'dp', agora: qua10 }) === 'Já passei pra Vitória, do DP, com a sua pergunta; ela te responde por aqui.',
  R.textoDaPassagem({ setor: 'dp', agora: qua10 }));
chk('pro Samuel, "pro"', R.textoDaPassagem({ setor: 'financeiro', agora: qua10 }).startsWith('Já passei pro Samuel, do financeiro,'));
chk('com o motivo, como o exemplo do robo.md', R.textoDaPassagem({ setor: 'fiscal', agora: qua10, motivo: 'depende de como a empresa está enquadrada.' })
  === 'A Thalia, do fiscal, responde melhor — depende de como a empresa está enquadrada. Já passei pra ela com a sua pergunta; ela te responde por aqui.',
  R.textoDaPassagem({ setor: 'fiscal', agora: qua10, motivo: 'depende de como a empresa está enquadrada.' }));
chk('fora do horário, como o exemplo do sábado', R.textoDaPassagem({ setor: 'dp', agora: sab })
  === 'Oi! A equipe volta segunda, às 7h30 — deixei o seu recado com a Vitória. Se for boleto, guia ou formulário, te ajudo agora mesmo.');
chk('reclamação vai pro Samuel (wa-10), no horário', R.textoDaPassagem({ setor: 'fiscal', reclamacao: true, agora: qua10 })
  === 'Desculpa a demora. Já chamei o Samuel pra ver isso agora, com o seu recado.');
chk('reclamação fora do horário', R.textoDaPassagem({ reclamacao: true, agora: sab }).includes('volta segunda, às 7h30'));

console.log('Os 30 minutos sem ninguém (wa-09):');
const C = (x = {}) => ({ id: 'c1', situacao: 'fila', responsavel: null, ultima_do_cliente_em: '2026-11-11T12:20:00Z', ...x });
chk('na fila, 40 minutos, no horário: lembra', R.precisaLembrar(C(), [], qua10));
chk('29 minutos: ainda não', !R.precisaLembrar(C({ ultima_do_cliente_em: '2026-11-11T12:31:00Z' }), [], qua10));
chk('com alguém atendendo: não', !R.precisaLembrar(C({ situacao: 'atendendo', responsavel: 'rh@macedoereis.com.br' }), [], qua10));
chk('fora do horário: não', !R.precisaLembrar(C({ ultima_do_cliente_em: '2026-11-14T12:00:00Z' }), [], sab));
chk('já lembrou depois da última do cliente: não', !R.precisaLembrar(C(), [{ tipo: 'lembrou', conversa_id: 'c1', criado_em: '2026-11-11T12:50:00Z' }], qua10));
chk('lembrou antes da última do cliente: lembra de novo', R.precisaLembrar(C(), [{ tipo: 'lembrou', conversa_id: 'c1', criado_em: '2026-11-11T12:00:00Z' }], qua10));
chk('o texto do lembrete diz quem', R.textoDoLembrete('contabil').includes('a Adaini'));

console.log('A apresentação e o balcão (wa-01, wa-02, wa-08):');
chk('sem nome próprio', R.APRESENTACAO === 'Aqui é o assistente da Macedo & Reis.');
chk('trata por você, nunca por tu', !/\btu\b|\bte ajudo\b.*\btu\b/.test(Object.values(R.BALCAO).join(' ') + R.E_ROBO));
chk('o endereço fica fora até o Samuel confirmar', !('endereco' in R.BALCAO));
chk('os formulários com o endereço do site', R.BALCAO.admissao.includes('/admissao.html') && R.BALCAO.rescisao.includes('/rescisao.html') && R.BALCAO.proposta.includes('/proposta.html'));
chk('os prazos gerais do robo.md', R.BALCAO.prazos.includes('dia 20') && R.BALCAO.prazos.includes('5º dia útil'));

console.log('O robô pela IA (supabase/functions/whatsapp/robo.js):');
{
  const H = [
    { direcao: 'entrada', autor: 'cliente', texto: 'boa tarde', anexos: [] },
    { direcao: 'interna', autor: 'fiscal@macedoereis.com.br', texto: 'nota da equipe', anexos: [] },
    { direcao: 'saida', autor: 'robo', texto: 'Boa tarde! Em que posso ajudar?', anexos: [] },
    { direcao: 'entrada', autor: 'cliente', texto: 'segue o extrato', anexos: [{ nome: 'extrato.pdf' }] },
    { direcao: 'entrada', autor: 'cliente', texto: 'de outubro', anexos: [] },
  ];
  const m = IA.mensagensDaConversa(H);
  chk('o histórico: a nota interna não vai, o mesmo lado junta, o arquivo vira linha', m.length === 3 && m[0].role === 'user' && m[1].role === 'assistant'
    && m[2].content === 'segue o extrato\n[o cliente mandou o arquivo: extrato.pdf]\nde outubro' && !JSON.stringify(m).includes('nota da equipe'), m);
  chk('começa sempre pelo cliente', IA.mensagensDaConversa([{ direcao: 'saida', autor: 'robo', texto: 'oi' }, { direcao: 'entrada', texto: 'x' }])[0].role === 'user');
  chk('a resposta da equipe vai com o nome', IA.mensagensDaConversa([{ direcao: 'entrada', texto: 'a' }, { direcao: 'saida', autor: 'fiscal@macedoereis.com.br', texto: 'b' }])[1].content.startsWith('(Thalia, da equipe)'));
  const corpo = IA.corpoDoRobo(H, { agora: T('2026-11-11T13:00:00Z'), contato: 'Carlos', empresa: 'Padaria Teste', confirmado: true });
  chk('o contexto vai na primeira mensagem: a hora, quem e a empresa', /11\/11\/2026 às 10h00/.test(corpo.messages[0].content) && corpo.messages[0].content.includes('Carlos')
    && corpo.messages[0].content.includes('Padaria Teste (número confirmado)') && corpo.messages[0].content.includes('a equipe está atendendo'));
  chk('o sistema vai com o cache de 1 hora e a ferramenta "responder", sem forçar', corpo.system[0].cache_control.ttl === '1h' && corpo.tools[0].name === 'responder' && corpo.tool_choice.type === 'auto');
  chk('o sistema leva o balcão aprovado e não leva o endereço', corpo.system[0].text.includes(R.BALCAO.irpf) && !/Volkart/.test(corpo.system[0].text));
  chk('fora do horário, o contexto diz quando a equipe volta', IA.contextoDaMensagem({ agora: T('2026-11-14T13:00:00Z') }).includes('fora do horário (a equipe volta segunda, às 7h30)'));
  chk('número não confirmado: não fala da empresa', IA.contextoDaMensagem({ empresa: 'X', confirmado: false }).includes('não fale de dado da empresa'));
  chk('sem histórico, sem chamada', IA.corpoDoRobo([], {}) === null);

  const tool = input => ({ content: [{ type: 'thinking', thinking: '…' }, { type: 'tool_use', name: 'responder', input }] });
  const r1 = IA.lerResposta(tool({ texto: 'Boa tarde, Carlos!', passar: true, setor: 'fiscal', motivo: 'depende do enquadramento.', resumo: 'Quer saber do carro.' }));
  chk('lê a ferramenta: passa pro fiscal, o motivo sem o ponto', r1.passar && r1.setor === 'fiscal' && r1.motivo === 'depende do enquadramento' && r1.resumo === 'Quer saber do carro.');
  chk('setor desconhecido vira sem setor', IA.lerResposta(tool({ texto: '', passar: true, setor: 'xyz' })).setor === null);
  chk('reclamação passa sempre', IA.lerResposta(tool({ texto: 'Desculpa', passar: false, reclamacao: true })).passar === true);
  chk('sem passar, sem setor nem resumo', (x => !x.passar && x.setor === null && x.resumo === '')(IA.lerResposta(tool({ texto: 'Oi!', passar: false, setor: 'dp', resumo: 'z' }))));
  chk('sem a ferramenta: o texto solto e a conversa passa', (x => x.passar && x.semFerramenta && x.texto === 'oi')(IA.lerResposta({ content: [{ type: 'text', text: 'oi' }] })));

  const qua10 = T('2026-11-11T13:00:00Z'), sab = T('2026-11-14T13:00:00Z');
  chk('a mensagem ao passar: o começo da IA e a frase da passagem', IA.mensagemFinal({ ...r1 }, qua10) === 'Boa tarde, Carlos! Já passei pra Thalia, do fiscal, com a sua pergunta; ela te responde por aqui.', IA.mensagemFinal({ ...r1 }, qua10));
  chk('sem o texto da IA, o motivo entra na frase', IA.mensagemFinal({ ...r1, texto: '' }, qua10).startsWith('A Thalia, do fiscal, responde melhor — depende do enquadramento. Já passei pra ela'));
  chk('fora do horário, sem o "Oi!" repetido', IA.mensagemFinal({ ...r1 }, sab) === 'Boa tarde, Carlos! A equipe volta segunda, às 7h30 — deixei o seu recado com a Thalia. Se for boleto, guia ou formulário, te ajudo agora mesmo.', IA.mensagemFinal({ ...r1 }, sab));
  chk('a reclamação vai pro Samuel', IA.mensagemFinal({ texto: '', passar: true, reclamacao: true, setor: 'dp' }, qua10).includes('chamei o Samuel'));
  chk('sem passar, o texto da IA como veio', IA.mensagemFinal({ texto: 'Oi! Em que posso ajudar?', passar: false }, qua10) === 'Oi! Em que posso ajudar?');

  let pediu = null;
  const chamar = async c => { pediu = c; return { ...tool({ texto: 'Oi, Carlos!', passar: false }), usage: { input_tokens: 10, output_tokens: 5 }, _modelo: 'claude-sonnet-5-5' }; };
  const rr = await IA.responderComoRobo({ chamar, historico: H.slice(0, 1), agora: qua10, contato: 'Carlos' });
  chk('responderComoRobo: chama a IA com o corpo e devolve a mensagem e o modelo', pediu && pediu.messages.length === 1 && rr.mensagem === 'Oi, Carlos!' && !rr.passar && rr.modelo === 'claude-sonnet-5-5');
  const muitas = [...Array(IA.MAX_RESPOSTAS_SEM_PASSAR)].flatMap(() => [{ direcao: 'entrada', texto: 'e aí' }, { direcao: 'saida', autor: 'robo', texto: 'oi' }]).concat([{ direcao: 'entrada', texto: 'oi de novo' }]);
  chk('depois de ' + IA.MAX_RESPOSTAS_SEM_PASSAR + ' respostas sem passar, passa', (await IA.responderComoRobo({ chamar, historico: muitas, agora: qua10 })).passar === true);
  let erro = null;
  try { await IA.responderComoRobo({ chamar: async () => ({ stop_reason: 'max_tokens', content: [] }), historico: H.slice(0, 1) }); } catch (e) { erro = e; }
  chk('a resposta cortada é erro (a função passa pra fila sem setor)', erro && erro.tipo === 'formato');
  chk('as filas da IA são os setores do banco', JSON.stringify(IA.FERRAMENTA_ROBO.input_schema.properties.setor.enum) === JSON.stringify(['fiscal', 'dp', 'contabil', 'societario', 'financeiro', 'comercial', 'sem_setor']));
}

console.log('A função whatsapp roda o robô do repositório num commit fixado:');
{
  const raiz = fileURLToPath(new URL('../', import.meta.url));
  const idx = readFileSync(raiz + 'supabase/functions/whatsapp/index.ts', 'utf8');
  const shas = [...idx.matchAll(/raw\.githubusercontent\.com\/macedo-reis-contabilidade\/macedo-reis-dashboards\/([0-9a-f]{40})\/(supabase\/functions\/[a-z-]+\/[a-z-]+\.js)/g)];
  chk('as duas importações, no mesmo commit', shas.length === 2 && shas[0][1] === shas[1][1], shas.map(x => x[1]));
  const vistos = new Set(), fila = shas.map(x => x[2]);
  while (fila.length) {
    const a = fila.shift();
    if (vistos.has(a)) continue;
    vistos.add(a);
    for (const im of readFileSync(raiz + a, 'utf8').matchAll(/(?:import|export)\s[^'"]*?from\s*['"](\.{1,2}\/[^'"]+)['"]/g)) fila.push(posix.normalize(posix.join(posix.dirname(a), im[1])));
  }
  const ARQS = [...vistos];
  chk('a trava segue os imports (o robô, as regras puras, o atendimento, a equipe)', ['supabase/functions/whatsapp/robo.js', 'assets/js/atendimento-robo.js', 'assets/js/atendimento.js', 'assets/js/equipe.js'].every(x => ARQS.includes(x)), ARQS);
  if (shas.length) {
    const sha = shas[0][1];
    const atrasados = ARQS.filter(a => {
      let noCommit = null;
      try { noCommit = execFileSync('git', ['show', sha + ':' + a], { cwd: raiz, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 24 }); } catch { noCommit = null; }
      return noCommit === null || noCommit.replace(/\r\n/g, '\n') !== readFileSync(raiz + a, 'utf8').replace(/\r\n/g, '\n');
    });
    chk('o código que a função roda é o daqui', atrasados.length === 0,
      'mudaram depois do commit ' + sha.slice(0, 7) + ': ' + atrasados.join(', ') + ' — publique, fixe o commit novo em index.ts e reimplante a função whatsapp');
  }
  chk('o robô não lê credenciais', ARQS.every(a => !/credenciais/.test(readFileSync(raiz + a, 'utf8').replace(/^\s*\/\/.*$/gm, ''))) && !/credenciais/.test(idx.replace(/^\s*\/\/.*$/gm, '')));
}

console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
