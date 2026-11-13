// O contraste das cores do tema (assets/css/style.css), nos dois temas — 13/11/2026, com o "mais alegria": o texto
// secundário, o champanhe (--sol), as cores de estado e a letra branca do botão principal têm de dar 4,5:1 ou mais sobre
// os fundos em que aparecem (o mínimo pra letra pequena). Lê as cores do próprio style.css: mudou uma cor pra uma que
// não lê, o teste falha.
// Rodar com: node tests/tema-contraste.test.mjs
import { readFileSync } from 'node:fs';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); };

const css = readFileSync(new URL('../assets/css/style.css', import.meta.url), 'utf8');
// as cores (#RRGGBB) de um bloco: o :root (tema escuro) e o :root[data-theme="light"]
function cores(seletor) {
  const i = css.indexOf(seletor + ' {');
  const bloco = css.slice(i, css.indexOf('\n}', i));
  return Object.fromEntries([...bloco.matchAll(/(--[a-z0-9-]+):\s*(#[0-9a-f]{6})\b/gi)].map(m => [m[1], m[2]]));
}
const ESCURO = cores(':root'), CLARO = { ...ESCURO, ...cores(':root[data-theme="light"]') };

const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const lum = c => { const [r, g, b] = c.map(v => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contraste = (a, b) => { const [x, y] = [lum(rgb(a)), lum(rgb(b))].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

chk('o style.css tem os dois temas com as cores esperadas', ['--bg', '--surface', '--surface-2', '--text', '--text-muted', '--text-dim', '--sol', '--sol-forte', '--sol-tinta', '--btn-1', '--btn-2']
  .every(k => ESCURO[k] && CLARO[k]) && ESCURO['--bg'] !== CLARO['--bg'], { escuro: Object.keys(ESCURO).length, claro: Object.keys(cores(':root[data-theme="light"]')).length });

const FUNDOS = ['--bg', '--surface', '--surface-2'];
// o que é texto (ou vira texto) em cima dos fundos da tela
const TEXTOS = ['--text', '--text-2', '--text-muted', '--text-dim', '--sol', '--brand-light', '--ok', '--warn', '--err', '--accent'];
for (const [nome, T] of [['Tema escuro', ESCURO], ['Tema claro', CLARO]]) {
  console.log(nome + ':');
  const fracas = [];
  for (const t of TEXTOS) for (const f of FUNDOS) { const v = contraste(T[t], T[f]); if (v < 4.5) fracas.push(t + ' sobre ' + f + ': ' + v.toFixed(2)); }
  chk('o texto, o champanhe e as cores de estado leem sobre os três fundos (4,5:1 ou mais)', !fracas.length, fracas);
  chk('a tinta sobre o champanhe cheio (o selo das mensagens novas): ' + contraste(T['--sol-tinta'], T['--sol-forte']).toFixed(1) + ':1', contraste(T['--sol-tinta'], T['--sol-forte']) >= 4.5);
  const b1 = contraste('#FFFFFF', T['--btn-1']), b2 = contraste('#FFFFFF', T['--btn-2']);
  chk('a letra branca nas duas pontas do botão principal e da bolha do chat: ' + b1.toFixed(2) + ' e ' + b2.toFixed(2), b1 >= 4.5 && b2 >= 4.5);
  chk('a ordem do texto: --text > --text-2 > --text-muted > --text-dim', [['--text', '--text-2'], ['--text-2', '--text-muted'], ['--text-muted', '--text-dim']]
    .every(([a, b]) => contraste(T[a], T['--surface']) > contraste(T[b], T['--surface'])));
}

if (falhas) { console.log('\n' + falhas + ' falha(s)'); process.exit(1); }
console.log('\nTudo certo.');
