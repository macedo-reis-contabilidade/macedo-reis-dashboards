// ============================================================
// MACEDO & REIS — A senha de quem entra (21/10/2026): trocar a própria senha e a troca obrigatória no primeiro acesso
// A conta nova nasce com uma senha provisória e a marca user_metadata.trocar_senha = true: o auth-guard.js manda pra tela
// de entrar (login.html), que pede a senha nova antes de qualquer outra tela; quem quiser trocar a sua clica no próprio
// nome, no alto da tela (login.html?trocar=1). As regras ficam aqui, puras — testes em tests/senha.test.mjs.
// ============================================================

export const MINIMO_SENHA = 8;

// a conta ainda está com a senha provisória
export const precisaTrocar = u => !!(u && u.user_metadata && u.user_metadata.trocar_senha === true);

// o que impede a troca antes de ir ao servidor (null = pode ir)
export function problemaDaSenha({ atual = '', nova = '', repete = '', provisoria = false } = {}) {
  if (!atual) return provisoria ? 'Digite a senha provisória que você recebeu.' : 'Digite a senha atual.';
  if (String(nova).length < MINIMO_SENHA) return 'A senha nova precisa ter pelo menos ' + MINIMO_SENHA + ' caracteres.';
  if (nova !== repete) return 'As duas senhas novas não conferem.';
  if (nova === atual) return provisoria ? 'A senha nova precisa ser diferente da provisória.' : 'A senha nova precisa ser diferente da atual.';
  return null;
}

const codigo = e => String((e && e.code) || '');
const mensagem = e => String((e && e.message) || '');
const comDetalhe = (texto, e) => texto + (mensagem(e) ? ' (' + mensagem(e) + ')' : '') + '. Tente de novo.';

// o erro do login, em português
export function erroDoLogin(e) {
  const c = codigo(e), m = mensagem(e);
  if (c === 'invalid_credentials' || /invalid login credentials/i.test(m)) return 'E-mail ou senha não conferem.';
  if (c === 'email_not_confirmed' || /email not confirmed/i.test(m)) return 'Este login ainda não foi liberado. Fale com o Samuel.';
  if (c === 'user_banned' || /banned/i.test(m)) return 'Este login está bloqueado. Fale com o Samuel.';
  if (c === 'over_request_rate_limit' || /rate limit|too many/i.test(m)) return 'Muitas tentativas seguidas. Espere uns minutos e tente de novo.';
  return comDetalhe('Não consegui entrar agora', e);
}

// o erro da troca, em português
export function erroDaTroca(e) {
  const c = codigo(e), m = mensagem(e);
  if (c === 'same_password' || /different from the old/i.test(m)) return 'A senha nova precisa ser diferente da atual.';
  if (c === 'weak_password' || /password should|weak password/i.test(m))
    return 'O sistema recusou essa senha por ser fraca. Use pelo menos ' + MINIMO_SENHA + ' caracteres, misturando letras e números.';
  if (c === 'reauthentication_needed' || /reauthentication/i.test(m)) return 'Por segurança, saia, entre de novo e troque a senha logo em seguida.';
  if (c === 'session_not_found' || c === 'session_expired' || /session missing|session expired/i.test(m)) return 'A sessão expirou. Saia, entre de novo e troque a senha.';
  if (c === 'over_request_rate_limit' || /rate limit|too many/i.test(m)) return 'Muitas tentativas seguidas. Espere uns minutos e tente de novo.';
  return comDetalhe('Não consegui trocar a senha agora', e);
}
