// ============================================================
// MACEDO & REIS — A lista de itens na descrição da tarefa (16/10/2026)
// Cada linha da descrição que começa com ☐ é um item a fazer, e com ☑, um item feito. Quem mostra a tarefa (a Agenda, as
// tarefas dos setores — tarefas-engine.js — e a Transição) desenha as caixas embaixo da descrição com montarChecklist, e
// cada marcação grava a descrição nova na hora. Sem linha assim, nada aparece. O kit da transição usa pra juntar os
// documentos do escritório anterior numa tarefa só (assets/js/transicao-kit.js).
// ============================================================

export const ABERTO = '☐', FEITO = '☑';
const RX = /^(\s*)([☐☑])\s?(.*)$/;
const normal = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Os itens da descrição, na ordem: { linha (índice da linha), feito, texto }. */
export function itensDoChecklist(texto) {
  return String(texto == null ? '' : texto).split('\n').map((l, linha) => {
    const m = l.match(RX);
    return m && m[3].trim() ? { linha, feito: m[2] === FEITO, texto: m[3].trim() } : null;
  }).filter(Boolean);
}

/** Quantos feitos de quantos — null quando a descrição não tem lista. */
export function progressoDoChecklist(texto) {
  const itens = itensDoChecklist(texto);
  return itens.length ? { feitos: itens.filter(i => i.feito).length, total: itens.length } : null;
}

/** A descrição com o item da linha marcado (ou desmarcado); o resto do texto fica como está. */
export function marcarItem(texto, linha, feito) {
  const linhas = String(texto == null ? '' : texto).split('\n');
  const m = (linhas[linha] || '').match(RX);
  if (!m) return String(texto == null ? '' : texto);
  linhas[linha] = m[1] + (feito ? FEITO : ABERTO) + ' ' + m[3].trim();
  return linhas.join('\n');
}

/** A descrição de uma lista nova: o cabeçalho e um ☐ por item (os de `feitos` já com ☑). */
export function textoDoChecklist(itens, { cabecalho = 'Marque cada item quando estiver resolvido.', feitos = [] } = {}) {
  const ok = new Set(feitos.map(normal));
  return [cabecalho, ...itens.map(t => (ok.has(normal(t)) ? FEITO : ABERTO) + ' ' + t)].filter(Boolean).join('\n');
}

/** A descrição com os itens novos no fim (os que já estão na lista, com ou sem acento e maiúscula, não repetem). */
export function acrescentarItens(texto, novos) {
  const base = String(texto == null ? '' : texto);
  const ja = new Set(itensDoChecklist(base).map(i => normal(i.texto)));
  const add = [...new Set((novos || []).filter(t => t && !ja.has(normal(t))))];
  return add.length ? base.replace(/\s+$/, '') + (base.trim() ? '\n' : '') + add.map(t => ABERTO + ' ' + t).join('\n') : base;
}

/** O chip dos cartões: "☑ 3/13" (ou '' sem lista). */
export function rotuloDoProgresso(texto) {
  const p = progressoDoChecklist(texto);
  return p ? FEITO + ' ' + p.feitos + '/' + p.total : '';
}

// ---------- a parte da tela ----------
// As caixas embaixo do campo da descrição (`area`, um textarea): acompanham o que se digita no campo e, a cada marcação,
// trocam o ☐/☑ no campo e chamam salvar(textoNovo) — que grava a descrição; deu erro, a marcação volta. Pode ser chamada
// de novo no mesmo lugar (o modal que abre outra tarefa): desliga a anterior. Com `somenteLer`, as caixas não mexem.
export function montarChecklist(lugar, { area, salvar, somenteLer = false }) {
  if (!lugar) return { atualizar() {} };
  if (lugar._ckDesligar) lugar._ckDesligar();
  let gravando = Promise.resolve();
  const desenhar = () => {
    const texto = area ? area.value : '';
    const itens = itensDoChecklist(texto);
    lugar.replaceChildren();
    lugar.hidden = !itens.length;
    if (!itens.length) return;
    lugar.classList.add('ck-lista');
    const p = progressoDoChecklist(texto);
    const topo = document.createElement('div');
    topo.className = 'ck-topo';
    const tit = document.createElement('span');
    tit.textContent = 'Lista · ' + p.feitos + ' de ' + p.total;
    const st = document.createElement('span');
    st.className = 'ck-status';
    st.setAttribute('aria-live', 'polite');
    topo.append(tit, st);
    const ul = document.createElement('ul');
    itens.forEach(it => {
      const li = document.createElement('li');
      const lab = document.createElement('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = it.feito;
      cb.disabled = somenteLer;
      const tx = document.createElement('span');
      tx.textContent = it.texto;
      if (it.feito) li.classList.add('ck-feito');
      lab.append(cb, tx);
      li.append(lab);
      ul.append(li);
      // marca no lugar (sem redesenhar a lista: o foco fica na caixa) e grava; deu erro, volta como estava
      cb.addEventListener('change', () => {
        const marcado = cb.checked;
        area.value = marcarItem(area.value, it.linha, marcado);
        li.classList.toggle('ck-feito', marcado);
        const conta = () => { const q = progressoDoChecklist(area.value); tit.textContent = 'Lista · ' + (q ? q.feitos + ' de ' + q.total : ''); };
        conta();
        st.textContent = 'gravando…';
        gravando = gravando.then(() => Promise.resolve(salvar ? salvar(area.value) : null)).then(() => {
          st.textContent = 'gravado';
        }, e => {
          area.value = marcarItem(area.value, it.linha, !marcado);
          cb.checked = !marcado;
          li.classList.toggle('ck-feito', !marcado);
          conta();
          st.textContent = 'não gravou: ' + ((e && e.message) || 'tente de novo');
        });
      });
    });
    lugar.append(topo, ul);
  };
  const aoDigitar = () => desenhar();
  if (area) area.addEventListener('input', aoDigitar);
  lugar._ckDesligar = () => { if (area) area.removeEventListener('input', aoDigitar); lugar._ckDesligar = null; };
  desenhar();
  return { atualizar: desenhar };
}
