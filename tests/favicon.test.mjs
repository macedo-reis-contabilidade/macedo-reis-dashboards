// A logo do escritório na aba do navegador (23/10/2026, pedido da equipe): toda página do sistema leva no <head> o
// <link rel="icon"> pro assets/favicon.ico (com ../ quando a página está numa pasta). Página nova sem ele falha aqui.
// Rodar com: node tests/favicon.test.mjs
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const FORA = new Set(['tests', '.harness', '.git', 'node_modules']);
let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); };

function paginas(dir) {
  return readdirSync(dir).flatMap(n => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return FORA.has(n) ? [] : paginas(p);
    return n.endsWith('.html') ? [p] : [];
  });
}

console.log('O ícone:');
const ico = readFileSync(join(raiz, 'assets', 'favicon.ico'));
const qtos = ico.readUInt16LE(4);
const lados = Array.from({ length: qtos }, (_, i) => ico[6 + i * 16] || 256);
chk('assets/favicon.ico é um ICO com os tamanhos da aba (16 e 32, e maiores pra tela de alta resolução)', ico.readUInt16LE(0) === 0 && ico.readUInt16LE(2) === 1 && lados.includes(16) && lados.includes(32), lados);

console.log('As páginas:');
const todas = paginas(raiz.replace(/[\\/]$/, ''));
const sem = [], errado = [];
for (const f of todas) {
  const s = readFileSync(f, 'utf8');
  const cabeca = (s.match(/<head[^>]*>([\s\S]*?)<\/head>/i) || [])[1] || '';
  const m = cabeca.match(/<link rel="icon" href="([^"]+)">/);
  if (!m) { sem.push(relative(raiz, f)); continue; }
  const alvo = resolve(dirname(f), m[1]);
  if (alvo !== resolve(raiz, 'assets', 'favicon.ico') || !existsSync(alvo)) errado.push(relative(raiz, f) + ' → ' + m[1]);
}
chk(`todas as ${todas.length} páginas têm o ícone no <head>`, sem.length === 0, sem);
chk('o caminho de cada uma chega no assets/favicon.ico (com ../ dentro de pasta)', errado.length === 0, errado);
chk('as páginas das pastas também entraram (clientes/, ferramentas/)', todas.some(f => relative(raiz, f).split(sep)[0] === 'clientes'));

console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
