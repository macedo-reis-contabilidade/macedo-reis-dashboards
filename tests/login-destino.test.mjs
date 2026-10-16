// A volta depois do login (login.html, destinoSeguro): o ?redirect= só leva pra uma tela do próprio sistema. Um link com
// javascript: rodaria código logo depois de a pessoa entrar, e um com outro site abriria uma página falsa no lugar do sistema
// (16/10/2026). Rodar com: node tests/login-destino.test.mjs
import fs from 'fs';
const page = fs.readFileSync(new URL('../login.html', import.meta.url), 'utf8');
const m = page.match(/function destinoSeguro\(r\) \{[\s\S]*?\n    \}/);
let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + extra : '')); };
chk('a função está no login.html', !!m);
const window = { location: { href: 'https://macedo-reis-contabilidade.github.io/macedo-reis-dashboards/login.html?redirect=x', origin: 'https://macedo-reis-contabilidade.github.io' } };
const destinoSeguro = new Function('window', (m ? m[0] : 'function destinoSeguro(){ return null; }') + '\nreturn destinoSeguro;')(window);
const casos = [
  ['sem redirect, o painel', null, 'index.html'],
  ['a tela de onde veio (o auth-guard manda o caminho e a busca)', '/macedo-reis-dashboards/agenda.html?data=2026-10-16', '/macedo-reis-dashboards/agenda.html?data=2026-10-16'],
  ['caminho relativo do próprio sistema', 'clientes/editar.html?id=1#socios', '/macedo-reis-dashboards/clientes/editar.html?id=1#socios'],
  ['javascript: não roda', 'javascript:alert(document.cookie)', 'index.html'],
  ['JavaScript: com maiúsculas e espaço também não', ' JavaScript:alert(1)', 'index.html'],
  ['data: não', 'data:text/html,<script>alert(1)</script>', 'index.html'],
  ['outro site não', 'https://site-falso.com/login', 'index.html'],
  ['outro site sem o https: (//) não', '//site-falso.com/login', 'index.html'],
  ['endereço do próprio site inteiro, sim', 'https://macedo-reis-contabilidade.github.io/macedo-reis-dashboards/dp.html', '/macedo-reis-dashboards/dp.html'],
];
for (const [nome, r, esperado] of casos) {
  const v = destinoSeguro(r);
  chk(nome, v === esperado, v);
}
console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
