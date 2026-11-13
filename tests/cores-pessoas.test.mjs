// Cada pessoa com a sua cor (assets/js/cores-pessoas.js, 13/11/2026): uma cor fixa pra cada pessoa da equipe, a mesma
// pelo nome e pelo e-mail, e uma cor estável pra quem não está na lista. Confere também que ninguém da equipe ficou sem
// cor (pessoa nova = cor nova no arquivo) e que as cores da equipe leem bem nos dois temas, do jeito que o style.css as usa.
// Rodar com: node tests/cores-pessoas.test.mjs
import { CORES, chaveDaPessoa, corDaPessoa, inicialDaPessoa } from '../assets/js/cores-pessoas.js';
import { EQUIPE, NOME_POR_EMAIL } from '../assets/js/equipe.js';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); };

console.log('A equipe:');
chk('todo mundo da equipe tem cor própria (pessoa nova: ponha a cor dela em cores-pessoas.js)', EQUIPE.every(n => CORES[chaveDaPessoa(n)]), EQUIPE.filter(n => !CORES[chaveDaPessoa(n)]));
chk('nenhuma cor repetida', new Set(Object.values(CORES).map(c => c.toLowerCase())).size === Object.keys(CORES).length);
chk('todas no formato #RRGGBB (vão num style do HTML)', Object.values(CORES).every(c => /^#[0-9A-F]{6}$/i.test(c)));
chk('a mesma cor pelo nome e pelo e-mail', Object.entries(NOME_POR_EMAIL).every(([email, nome]) => corDaPessoa(email) === corDaPessoa(nome)));
chk('sem maiúscula, sem acento e com o sobrenome', corDaPessoa('VITORIA') === CORES.vitoria && corDaPessoa('Vitória Souza') === CORES.vitoria && corDaPessoa('  thalia ') === CORES.thalia);

console.log('Quem não tem cor, e quem não está na lista:');
chk('"Ambos", vazio e nulo: sem cor', corDaPessoa('Ambos') === null && corDaPessoa('') === null && corDaPessoa(null) === null && corDaPessoa('   ') === null);
const nova = corDaPessoa('Fulana de Tal');
chk('um nome novo ganha uma cor válida, sempre a mesma', /^#[0-9A-F]{6}$/i.test(nova) && nova === corDaPessoa('fulana') && nova === corDaPessoa('FULANA DE TAL'), nova);
chk('e-mail de fora da lista: pela parte antes do @', corDaPessoa('fulana@macedoereis.com.br') === nova);
chk('nomes diferentes podem ter cores diferentes', new Set(['Ana', 'Bruno', 'Carla', 'Davi', 'Elis', 'Fábio', 'Gabi', 'Hugo'].map(corDaPessoa)).size > 1);

console.log('A inicial:');
chk('a primeira letra, maiúscula', inicialDaPessoa('samuel') === 'S' && inicialDaPessoa('Vitória') === 'V' && inicialDaPessoa(' édna') === 'É');
chk('pelo e-mail, a do nome', inicialDaPessoa('rh@macedoereis.com.br') === 'V');
chk('vazio e nulo: sem inicial', inicialDaPessoa('') === '' && inicialDaPessoa(null) === '');
// a inicial vai num atributo do HTML (data-i): nunca aspas, <, > ou &
chk('nome com HTML: só letra ou número', inicialDaPessoa('"><img src=x onerror=alert(1)>') === 'I' && inicialDaPessoa('<b>') === 'B' && inicialDaPessoa('"\'&<>') === '');
chk('sempre um caractere só, letra ou número', ['Samuel', '9 de Julho', '"x"', '😀 Ana', 'ç'].every(n => /^[\p{L}\p{N}]?$/u.test(inicialDaPessoa(n))));

console.log('O contraste, como o style.css usa as cores:');
// as contas de color-mix (sRGB) do .pessoa-chip::before e do .ch-avatar[style*="--p"]: no tema escuro, a letra é 70% da cor
// com branco sobre 22% da cor por cima do fundo (o da tela, o do card e os dois de cima); no claro, 48% da cor com preto
// sobre 30% da cor com branco. Mudou a conta no style.css, mude aqui
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, p) => a.map((v, i) => v * p + b[i] * (1 - p));
const lum = c => { const [r, g, b] = c.map(v => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contraste = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const BRANCO = [255, 255, 255], PRETO = [0, 0, 0];
const FUNDOS_ESCUROS = { '--bg': '#0B111E', '--surface': '#121A2A', '--surface-2': '#182236', '--surface-hover': '#1F2C44' };
const css = (await import('node:fs')).readFileSync(new URL('../assets/css/style.css', import.meta.url), 'utf8');
chk('os fundos do tema escuro daqui são os do style.css', Object.entries(FUNDOS_ESCUROS).every(([k, v]) => new RegExp(k + ':\\s*' + v, 'i').test(css.split(':root[data-theme="light"]')[0])));
chk('e a conta é a do style.css (22% e 70% no escuro, 30% e 48% no claro)',
  css.includes('.ch-avatar[style*="--p"] { background:color-mix(in srgb, var(--p) 22%, transparent); color:color-mix(in srgb, var(--p) 70%, #fff)')
  && css.includes('background:color-mix(in srgb, var(--p) 22%, transparent); color:color-mix(in srgb, var(--p) 70%, #fff); box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--p) 40%, transparent); }')
  && css.split(':root[data-theme="light"] .pessoa-chip::before { background:color-mix(in srgb, var(--p) 30%, #fff); color:color-mix(in srgb, var(--p) 48%, #000); }').length === 2
  && css.split(':root[data-theme="light"] .ch-avatar[style*="--p"] { background:color-mix(in srgb, var(--p) 30%, #fff); color:color-mix(in srgb, var(--p) 48%, #000); }').length === 2);
const fracas = [];
// as da equipe e as de quem não está na lista (um nome pra cada cor de reserva)
const todas = { ...CORES };
for (let i = 0; Object.keys(todas).length < Object.keys(CORES).length + 6 && i < 400; i++) { const c = corDaPessoa('pessoa' + i); if (!Object.values(todas).includes(c)) todas['reserva ' + c] = c; }
chk('as 6 cores de reserva entram na conferência', Object.keys(todas).length === Object.keys(CORES).length + 6, Object.keys(todas).length);
for (const [quem, cor] of Object.entries(todas)) {
  const c = rgb(cor);
  for (const [nome, f] of Object.entries(FUNDOS_ESCUROS)) {
    const v = contraste(mix(c, BRANCO, 0.70), mix(c, rgb(f), 0.22));
    if (v < 4.5) fracas.push(quem + ' no escuro sobre ' + nome + ': ' + v.toFixed(2));
  }
  const claro = contraste(mix(c, PRETO, 0.48), mix(c, BRANCO, 0.30));
  if (claro < 4.5) fracas.push(quem + ' no claro: ' + claro.toFixed(2));
}
chk('a inicial lê bem nos dois temas, em qualquer fundo (4,5:1 ou mais)', !fracas.length, fracas);

if (falhas) { console.log('\n' + falhas + ' falha(s)'); process.exit(1); }
console.log('\nTudo certo.');
