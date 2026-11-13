// Os cards dos painéis (assets/js/cards-painel.js, 13/11/2026): o número na frente ("9 abertas" vira <b>9</b> abertas, o
// texto continua o mesmo) e a cor do ícone no card inteiro. Aqui, a regra pura (partesDoSelo) e o iniciarCards num
// documento de mentira; na tela de verdade, tests/harness/painel-bom-dia.py.
// Rodar com: node tests/cards-painel.test.mjs
import { partesDoSelo, iniciarCards } from '../assets/js/cards-painel.js';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); };
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log('O número e o rótulo:');
chk('"9 abertas"', igual(partesDoSelo('9 abertas'), { numero: '9', rotulo: 'abertas', zero: false }));
chk('"1 pra você"', igual(partesDoSelo('1 pra você'), { numero: '1', rotulo: 'pra você', zero: false }));
chk('"0 em aberto": zero', igual(partesDoSelo('0 em aberto'), { numero: '0', rotulo: 'em aberto', zero: true }));
chk('com o ponto de milhar', igual(partesDoSelo('1.234 notas'), { numero: '1.234', rotulo: 'notas', zero: false }));
chk('espaços sobrando e quebra de linha', igual(partesDoSelo('  12   em   andamento \n'), { numero: '12', rotulo: 'em andamento', zero: false }));
chk('"Em dia", "—", "·" e vazio ficam como estão', partesDoSelo('Em dia') === null && partesDoSelo('—') === null && partesDoSelo('·') === null && partesDoSelo('') === null && partesDoSelo(null) === null);
chk('só o número, sem rótulo: fica como está', partesDoSelo('12') === null);
chk('número no meio do texto não conta', partesDoSelo('até 12 notas') === null);

console.log('Nos cards (um documento de mentira):');
// o mínimo do DOM que o iniciarCards usa: um card com o ícone, a descrição e o selo
function documento({ corIcone = 'rgb(143, 192, 240)', corTexto = 'rgb(232, 236, 242)', texto = '9 abertas' } = {}) {
  const observados = [];
  const no = (tagName, extra = {}) => ({ tagName, childNodes: [], attrs: {}, style: { props: {}, setProperty(k, v) { this.props[k] = v; } },
    setAttribute(k, v) { this.attrs[k] = v; }, get firstElementChild() { return this.childNodes.find(c => c.tagName) || null; }, get lastChild() { return this.childNodes[this.childNodes.length - 1] || null; },
    get textContent() { return this.childNodes.map(c => (c.tagName ? c.textContent : c.nodeValue)).join(''); },
    set textContent(v) { this.childNodes = v ? [{ nodeValue: String(v) }] : []; },
    append(...xs) { xs.forEach(x => this.childNodes.push(typeof x === 'string' ? { nodeValue: x } : x)); }, ...extra });
  const selo = no('SPAN'); selo.textContent = texto;
  const icone = no('DIV', { cor: corIcone }), desc = no('P', { title: '' });
  desc.textContent = '  Tarefas do dia a dia\n   do setor.  ';
  const card = no('A', { cor: corTexto, querySelector: s => (s === '.dashboard-card-icon' ? icone : s === 'p' ? desc : null), querySelectorAll: () => [selo] });
  const body = no('BODY', { cor: corTexto });
  const doc = { body, querySelectorAll: s => (s === '.dashboard-card' ? [card] : []), createElement: t => no(t.toUpperCase()),
    defaultView: { getComputedStyle: el => ({ color: el.cor }), MutationObserver: class { constructor(f) { this.f = f; } observe(alvo) { observados.push({ alvo, f: this.f }); } } } };
  selo.ownerDocument = doc;
  return { doc, card, selo, desc, observados };
}
{
  const { doc, card, selo, desc, observados } = documento();
  chk('devolve quantos cards achou', iniciarCards(doc) === 1);
  chk('a cor do ícone vai pro card (--cor)', card.style.props['--cor'] === 'rgb(143, 192, 240)', card.style.props);
  chk('o número vira <b>, e o texto do selo continua "9 abertas"', selo.childNodes.length === 2 && selo.childNodes[0].tagName === 'B' && selo.childNodes[0].textContent === '9' && selo.textContent === '9 abertas', selo.textContent);
  chk('a descrição inteira no title, numa linha só', desc.title === 'Tarefas do dia a dia do setor.', desc.title);
  chk('o selo fica acompanhado (a tela escreve o número depois)', observados.length === 1 && observados[0].alvo === selo);
  // a tela escreve o número de verdade: o observador pinta de novo
  selo.textContent = '0 abertas'; observados[0].f();
  chk('escrito de novo pela tela: pinta de novo, com o zero apagado', selo.childNodes[0].tagName === 'B' && 'data-zero' in selo.childNodes[0].attrs && selo.textContent === '0 abertas');
  const antes = selo.childNodes[0]; observados[0].f();
  chk('já pintado: não mexe de novo (o observador não entra em volta)', selo.childNodes[0] === antes);
  selo.textContent = 'Em dia'; observados[0].f();
  chk('"Em dia" fica como a tela escreveu', selo.childNodes.length === 1 && selo.textContent === 'Em dia');
}
{
  const { doc, card } = documento({ corIcone: 'rgb(232, 236, 242)' });
  iniciarCards(doc);
  chk('o ícone sem cor própria (a do texto) deixa o card no azul da marca', !('--cor' in card.style.props));
}
chk('tela sem card: zero, sem erro', iniciarCards({ querySelectorAll: () => [] }) === 0);

if (falhas) { console.log('\n' + falhas + ' falha(s)'); process.exit(1); }
console.log('\nTudo certo.');
