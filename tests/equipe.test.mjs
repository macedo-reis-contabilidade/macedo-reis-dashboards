// Teste de quem é da equipe e de quem saiu (assets/js/equipe.js; 05/11/2026, pedido do Samuel: "pra não aparecer mais
// ela como opção"). Rode: node tests/equipe.test.mjs
import { EQUIPE, NOME_POR_EMAIL, SAIRAM, saiuDaEquipe, nomePorEmail } from '../assets/js/equipe.js';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + extra : '')); };

console.log('Quem saiu da equipe');
chk('quem saiu: tem o nome pelo e-mail e não está na EQUIPE (hoje, a Deize)', JSON.stringify(SAIRAM) === '["Deize"]', JSON.stringify(SAIRAM));
chk('o nome dela pelo e-mail continua (o histórico e as conversas antigas)', nomePorEmail('atendimento@macedoereis.com.br') === 'Deize');
chk('sem maiúscula, sem acento e com espaço sobrando, é ela', saiuDaEquipe('deize') && saiuDaEquipe(' DEIZE ') && saiuDaEquipe('Deíze'));
chk('ninguém da equipe "saiu" (a Edna, sem login, também não)', EQUIPE.every(n => !saiuDaEquipe(n)), EQUIPE.filter(saiuDaEquipe).join());
chk('"Ambos", o vazio e um nome de fora da equipe não contam como quem saiu', !saiuDaEquipe('Ambos') && !saiuDaEquipe('') && !saiuDaEquipe(null) && !saiuDaEquipe('Fernanda'));
chk('quem tem login e está na equipe não está em SAIRAM', Object.values(NOME_POR_EMAIL).filter(n => EQUIPE.includes(n)).every(n => !SAIRAM.includes(n)));

if (falhas) { console.log('\n' + falhas + ' falha(s)'); process.exit(1); }
console.log('\nTudo certo.');
