// Os atalhos do alto das telas (assets/js/atalhos.js, 23/10/2026): a lista guardada no banco só vale com nome, endereço
// http(s) e o arquivo do ícone. Endereços inventados. Rodar com: node tests/atalhos.test.mjs
import { lerAtalhos } from '../assets/js/atalhos.js';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); };

const BOA = [
  { nome: 'Onvio', url: 'https://exemplo.com.br/login/#/', icone: 'onvio.png' },
  { nome: 'Drive', url: 'https://drive.exemplo.com/drive/u/1/folders/PASTA-INVENTADA', icone: 'drive.png' },
  { nome: 'Webmail', url: 'http://webmail.exemplo.com.br/', icone: 'webmail.png' }
];

console.log('A lista do banco:');
chk('o texto JSON vira a lista, na ordem', JSON.stringify(lerAtalhos(JSON.stringify(BOA)).map(a => a.nome)) === '["Onvio","Drive","Webmail"]');
chk('a lista já como objeto também vale', lerAtalhos(BOA).length === 3);
chk('o http do webmail fica (o servidor dele não atende em https)', lerAtalhos(BOA)[2].url === 'http://webmail.exemplo.com.br/');
chk('texto que não é JSON, ou não é lista: nada', lerAtalhos('{quebrado').length === 0 && lerAtalhos('{"nome":"x"}').length === 0 && lerAtalhos(null).length === 0 && lerAtalhos('').length === 0);

console.log('O que fica de fora:');
const ruins = lerAtalhos([
  { nome: 'Script', url: 'javascript:alert(1)', icone: 'a.png' },
  { nome: 'Dados', url: 'data:text/html,oi', icone: 'a.png' },
  { nome: 'Relativo', url: '/agenda.html', icone: 'a.png' },
  { nome: '', url: 'https://exemplo.com', icone: 'a.png' },
  { nome: 'Sem ícone', url: 'https://exemplo.com', icone: '' },
  { nome: 'Ícone com caminho', url: 'https://exemplo.com', icone: '../../segredo.png' },
  { nome: 'Ícone de fora', url: 'https://exemplo.com', icone: 'https://outro.com/x.png' },
  { nome: 'Ícone com aspas', url: 'https://exemplo.com', icone: 'a".png' },
  { nome: 'Certo', url: 'https://exemplo.com', icone: 'certo.svg' }
]);
chk('só o endereço http(s) e o ícone de assets/atalhos/ (sem caminho, sem endereço de fora)', JSON.stringify(ruins.map(a => a.nome)) === '["Certo"]', ruins.map(a => a.nome));
chk('o nome sem espaço sobrando e curto', lerAtalhos([{ nome: '  Meu   Drive ' + 'x'.repeat(40), url: 'https://exemplo.com', icone: 'a.png' }])[0].nome.startsWith('Meu Drive x')
  && lerAtalhos([{ nome: 'x'.repeat(60), url: 'https://exemplo.com', icone: 'a.png' }])[0].nome.length === 30);
chk('no máximo 8 atalhos', lerAtalhos(Array.from({ length: 12 }, (_, i) => ({ nome: 'A' + i, url: 'https://exemplo.com/' + i, icone: 'a.png' }))).length === 8);

console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
