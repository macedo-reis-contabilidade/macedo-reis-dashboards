// ============================================================
// MACEDO & REIS — Os cards dos painéis (13/11/2026, pedido do Samuel: "dar um pouco mais de alegria" ao sistema)
// O Painel central, Setores e o painel de cada setor usam o mesmo card (.dashboard-card, em assets/css/style.css).
// Este arquivo faz duas coisas neles, sem mexer no que cada tela calcula:
//   1. leva a cor do ícone de cada card (que a tela já pinta) pro card inteiro, na variável --cor: o sopro de cor no
//      canto, o fio do alto e a borda do hover saem dela;
//   2. põe o número na frente: "9 abertas" vira <b>9</b> abertas (o texto continua o mesmo pra quem lê pelo código
//      e pros testes), e o zero fica apagado. "Em dia", "—" e o "·" de carregando ficam como estão.
// A descrição cortada em duas linhas ganha o texto inteiro no title.
// Quem chama é o auth-guard.js, em toda tela com login, antes de a tela aparecer. Erro aqui não derruba a tela.
// Testes: tests/cards-painel.test.mjs e tests/harness/painel-bom-dia.py.
// ============================================================

// "9 abertas" → { numero: '9', rotulo: 'abertas', zero: false }; o que não começa com número → null
export function partesDoSelo(texto) {
  const m = /^(\d[\d.]*)\s+(\S[\s\S]*)$/.exec(String(texto == null ? '' : texto).trim());
  if (!m) return null;
  return { numero: m[1], rotulo: m[2].replace(/\s+/g, ' '), zero: /^0+$/.test(m[1].replace(/\./g, '')) };
}

function pintarSelo(selo) {
  const p = partesDoSelo(selo.textContent);
  if (!p) return;
  const b = selo.firstElementChild;
  if (b && b.tagName === 'B' && selo.childNodes.length === 2 && b.textContent === p.numero && selo.lastChild.nodeValue === ' ' + p.rotulo) return;   // já está
  const n = selo.ownerDocument.createElement('b');
  n.textContent = p.numero;
  if (p.zero) n.setAttribute('data-zero', '');
  selo.textContent = '';
  selo.append(n, ' ' + p.rotulo);
}

export function iniciarCards(doc = document) {
  const cards = doc.querySelectorAll('.dashboard-card');
  if (!cards.length) return 0;
  const ver = doc.defaultView || window;
  const corDoTexto = ver.getComputedStyle(doc.body).color;
  for (const card of cards) {
    try {
      const icone = card.querySelector('.dashboard-card-icon');
      const cor = icone ? ver.getComputedStyle(icone).color : '';
      // o ícone sem cor própria (o padrão, branco sobre o azul) deixa o card no azul da marca
      if (cor && cor !== corDoTexto && cor !== ver.getComputedStyle(card).color) card.style.setProperty('--cor', cor);
      const desc = card.querySelector('p');
      if (desc && !desc.title) desc.title = desc.textContent.trim().replace(/\s+/g, ' ');
      for (const selo of card.querySelectorAll('.dashboard-card-footer .card-status')) {
        pintarSelo(selo);
        // a tela escreve o número depois (cada uma conta o seu, quando o banco responde): acompanhar
        new ver.MutationObserver(() => pintarSelo(selo)).observe(selo, { childList: true, characterData: true, subtree: true });
      }
    } catch (e) { /* enfeite: um card que der erro fica como a tela o pintou */ }
  }
  return cards.length;
}
