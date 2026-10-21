// A senha de quem entra (assets/js/senha.js, 21/10/2026): a conta com senha provisória (user_metadata.trocar_senha), o
// que barra a senha nova antes de ir ao servidor e os erros do Supabase em português. Rodar com: node tests/senha.test.mjs
import { precisaTrocar, problemaDaSenha, erroDoLogin, erroDaTroca, MINIMO_SENHA } from '../assets/js/senha.js';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + extra : '')); };

console.log('A conta com senha provisória:');
chk('só a marca true obriga a trocar', precisaTrocar({ user_metadata: { trocar_senha: true } }) && !precisaTrocar({ user_metadata: { trocar_senha: false } })
  && !precisaTrocar({ user_metadata: { trocar_senha: 'true' } }) && !precisaTrocar({ user_metadata: {} }) && !precisaTrocar({}) && !precisaTrocar(null));

console.log('A senha nova:');
const p = o => problemaDaSenha(o);
chk('o mínimo é 8', MINIMO_SENHA === 8);
chk('sem a atual: pede a atual (ou a provisória)', p({ atual: '', nova: 'abcdefgh', repete: 'abcdefgh' }) === 'Digite a senha atual.'
  && p({ atual: '', nova: 'abcdefgh', repete: 'abcdefgh', provisoria: true }) === 'Digite a senha provisória que você recebeu.');
chk('curta demais', p({ atual: 'x', nova: 'abc1234', repete: 'abc1234' }) === 'A senha nova precisa ter pelo menos 8 caracteres.');
chk('as duas não conferem', p({ atual: 'x', nova: 'abcdefgh1', repete: 'abcdefgh2' }) === 'As duas senhas novas não conferem.');
chk('igual à atual (e à provisória)', p({ atual: 'abcdefgh', nova: 'abcdefgh', repete: 'abcdefgh' }) === 'A senha nova precisa ser diferente da atual.'
  && p({ atual: 'abcdefgh', nova: 'abcdefgh', repete: 'abcdefgh', provisoria: true }) === 'A senha nova precisa ser diferente da provisória.');
chk('a boa passa', p({ atual: 'Provisoria1', nova: 'cafe com leite 2026', repete: 'cafe com leite 2026' }) === null);

console.log('Os erros em português:');
chk('login: e-mail ou senha', erroDoLogin({ code: 'invalid_credentials', message: 'Invalid login credentials' }) === 'E-mail ou senha não conferem.'
  && erroDoLogin({ message: 'Invalid login credentials' }) === 'E-mail ou senha não conferem.');
chk('login: não liberado, bloqueado, tentativas demais', /não foi liberado/.test(erroDoLogin({ code: 'email_not_confirmed' })) && /bloqueado/.test(erroDoLogin({ code: 'user_banned' }))
  && /Muitas tentativas/.test(erroDoLogin({ code: 'over_request_rate_limit' })));
chk('login: o resto com o detalhe', erroDoLogin({ message: 'Failed to fetch' }) === 'Não consegui entrar agora (Failed to fetch). Tente de novo.'
  && erroDoLogin(null) === 'Não consegui entrar agora. Tente de novo.');
chk('troca: igual à antiga', erroDaTroca({ code: 'same_password', message: 'New password should be different from the old password.' }) === 'A senha nova precisa ser diferente da atual.');
chk('troca: fraca', /fraca/.test(erroDaTroca({ code: 'weak_password', message: 'Password should be at least 6 characters.' }))
  && /fraca/.test(erroDaTroca({ message: 'Password should contain at least one character of each' })));
chk('troca: reautenticação e sessão vencida', /entre de novo/.test(erroDaTroca({ code: 'reauthentication_needed' })) && /sessão expirou/.test(erroDaTroca({ message: 'Auth session missing!' })));
chk('troca: o resto com o detalhe', erroDaTroca({ message: 'boom' }) === 'Não consegui trocar a senha agora (boom). Tente de novo.');

console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
