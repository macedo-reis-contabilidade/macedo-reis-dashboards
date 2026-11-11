// As regras do robô do atendimento pelo WhatsApp que não dependem da IA (assets/js/atendimento-robo.js, 11/11/2026, o
// começo da etapa 4): o horário da equipe, quando ela volta, quem recebe, as frases da passagem, o aviso dos 30 minutos e
// o balcão aprovado. Rodar com: node tests/atendimento-robo.test.mjs
import * as R from '../assets/js/atendimento-robo.js';

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

console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
