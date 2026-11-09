// As abas da tela de Tarefas de cada setor (assets/js/tarefas-abas.js, 09/11/2026): as recorrentes viraram a aba
// "Recorrentes" da tela de Tarefas, e o <setor>-regras.html antigo só redireciona pra ela, com o resto do endereço.
// A tela em si (as abas, o redirecionamento de verdade, o hub sem o card) está em tests/harness/rotinas-tres-setores.py.
// Rodar com: node tests/tarefas-abas.test.mjs
import { readFileSync } from 'node:fs';
import { abaDoEndereco, enderecoDaAba, destinoDasRegras } from '../assets/js/tarefas-abas.js';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + extra : '')); };
const igual = (nome, obtido, esperado) => chk(nome, obtido === esperado, obtido + ' (esperado ' + esperado + ')');

console.log('A aba pelo endereço:');
igual('sem ?aba: Tarefas', abaDoEndereco(''), 'tarefas');
igual('?aba=recorrentes: Recorrentes', abaDoEndereco('?aba=recorrentes'), 'recorrentes');
igual('outra aba qualquer: Tarefas', abaDoEndereco('?aba=xyz'), 'tarefas');
igual('com outros parâmetros junto', abaDoEndereco('?tarefa=9&aba=recorrentes'), 'recorrentes');

console.log('O endereço da aba:');
igual('Recorrentes põe o ?aba', enderecoDaAba('/dp-tarefas.html', '', '', 'recorrentes'), '/dp-tarefas.html?aba=recorrentes');
igual('Tarefas tira o ?aba (o endereço de sempre)', enderecoDaAba('/dp-tarefas.html', '?aba=recorrentes', '', 'tarefas'), '/dp-tarefas.html');
igual('o resto da busca e o # ficam', enderecoDaAba('/dp-tarefas.html', '?tarefa=9', '#x', 'recorrentes'), '/dp-tarefas.html?tarefa=9&aba=recorrentes#x');

console.log('O redirecionamento do <setor>-regras.html:');
igual('dp-regras.html → dp-tarefas.html?aba=recorrentes', destinoDasRegras('dp', '', ''), 'dp-tarefas.html?aba=recorrentes');
igual('leva o resto do endereço', destinoDasRegras('fiscal', '?id=5', '#r'), 'fiscal-tarefas.html?id=5&aba=recorrentes#r');
let recusou = false; try { destinoDasRegras('../x', '', ''); } catch { recusou = true; }
chk('setor que não é um nome simples é recusado (o destino é sempre uma tela do sistema)', recusou);

console.log('As seis telas:');
for (const s of ['comercial', 'contabil', 'dp', 'financeiro', 'fiscal', 'societario']) {
  const regras = readFileSync(new URL('../' + s + '-regras.html', import.meta.url), 'utf8');
  const tarefas = readFileSync(new URL('../' + s + '-tarefas.html', import.meta.url), 'utf8');
  const hub = readFileSync(new URL('../' + s + '.html', import.meta.url), 'utf8');
  chk(s + '-regras.html só redireciona (destinoDasRegras e o refresh de reserva)',
    regras.includes("destinoDasRegras('" + s + "'") && regras.includes('url=' + s + '-tarefas.html?aba=recorrentes') && !regras.includes('initRotinasSetor'));
  chk(s + '-tarefas.html monta as abas com o setor certo', tarefas.includes("montarAbasTarefas({ setor: '" + s + "'"));
  chk(s + '.html sem o card das recorrentes', !hub.includes(s + '-regras.html'));
}

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
