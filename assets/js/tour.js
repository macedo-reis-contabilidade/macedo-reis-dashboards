/* MRTour — tour guiado da casa. Sem dependências. */
(function () {
  const CSS = `
  .mrt-block { position:fixed; inset:0; z-index:9997; }
  .mrt-spot { position:absolute; z-index:9998; border-radius:10px; pointer-events:none;
    box-shadow: 0 0 0 4px rgba(138,174,200,.6), 0 0 0 9999px rgba(4,8,14,.78); transition: all .25s ease; }
  .mrt-box { position:fixed; z-index:9999; width:min(330px, calc(100vw - 24px));
    background:#0F1620; border:1px solid rgba(138,174,200,.35); border-radius:12px;
    padding:16px 18px; color:#E6EBF2; font-family:inherit; box-shadow:0 12px 40px rgba(0,0,0,.5); }
  .mrt-box h4 { margin:0 0 6px; font-size:15px; }
  .mrt-box p { margin:0; font-size:13px; line-height:1.55; color:#B9C2D0; }
  .mrt-foot { display:flex; align-items:center; gap:8px; margin-top:14px; }
  .mrt-passo { font-size:11.5px; color:#8A93A6; margin-right:auto; }
  .mrt-btn { font:inherit; font-size:12.5px; padding:6px 12px; border-radius:8px; cursor:pointer;
    border:1px solid rgba(255,255,255,.14); background:transparent; color:#B9C2D0; }
  .mrt-btn.pri { background:rgba(91,130,166,.35); border-color:rgba(138,174,200,.5); color:#E6EBF2; }
  .mrt-btn:disabled { opacity:.35; cursor:default; }`;

  let estado = null;

  function montar() {
    if (document.getElementById('mrt-style')) return;
    const st = document.createElement('style');
    st.id = 'mrt-style'; st.textContent = CSS;
    document.head.appendChild(st);
  }

  function limpar() {
    if (!estado) return;
    ['block', 'spot', 'box'].forEach(k => estado[k] && estado[k].remove());
    window.removeEventListener('resize', reposicionar);
    window.removeEventListener('scroll', reposicionar, true);
    document.removeEventListener('keydown', teclas);
    estado = null;
  }

  function terminar(concluiu) {
    if (estado) localStorage.setItem('mr_tour_' + estado.chave, concluiu ? 'ok' : 'pulado');
    limpar();
  }

  function teclas(e) {
    if (e.key === 'Escape') terminar(false);
    if (e.key === 'ArrowRight' || e.key === 'Enter') avancar(1);
    if (e.key === 'ArrowLeft') avancar(-1);
  }

  function passoValido(i) {
    while (i >= 0 && i < estado.passos.length && !document.querySelector(estado.passos[i].el)) i += estado.dir;
    return i;
  }

  function avancar(dir) {
    estado.dir = dir;
    const prox = passoValido(estado.i + dir);
    if (prox < 0) return;
    if (prox >= estado.passos.length) { terminar(true); return; }
    estado.i = prox;
    mostrar();
  }

  function reposicionar() {
    if (!estado) return;
    const alvo = document.querySelector(estado.passos[estado.i].el);
    if (!alvo) return;
    const r = alvo.getBoundingClientRect();
    Object.assign(estado.spot.style, {
      top: (r.top + window.scrollY - 6) + 'px',
      left: (r.left + window.scrollX - 6) + 'px',
      width: (r.width + 12) + 'px',
      height: (r.height + 12) + 'px'
    });
    const box = estado.box;
    const h = box.offsetHeight || 170;
    let top = r.bottom + 14;
    if (top + h > window.innerHeight - 10) top = Math.max(10, r.top - h - 14);
    let left = Math.min(Math.max(12, r.left), window.innerWidth - box.offsetWidth - 12);
    Object.assign(box.style, { top: top + 'px', left: left + 'px' });
  }

  function mostrar() {
    const p = estado.passos[estado.i];
    const alvo = document.querySelector(p.el);
    alvo.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const vistos = estado.passos.filter(x => document.querySelector(x.el)).length;
    const pos = estado.passos.slice(0, estado.i + 1).filter(x => document.querySelector(x.el)).length;
    estado.box.innerHTML =
      '<h4>' + p.titulo + '</h4><p>' + p.texto + '</p>' +
      '<div class="mrt-foot"><span class="mrt-passo">' + pos + ' de ' + vistos + '</span>' +
      '<button class="mrt-btn" data-a="pular">Pular</button>' +
      '<button class="mrt-btn" data-a="ant"' + (pos <= 1 ? ' disabled' : '') + '>Anterior</button>' +
      '<button class="mrt-btn pri" data-a="prox">' + (pos >= vistos ? 'Concluir' : 'Próximo') + '</button></div>';
    estado.box.querySelector('[data-a="pular"]').onclick = () => terminar(false);
    estado.box.querySelector('[data-a="ant"]').onclick = () => avancar(-1);
    estado.box.querySelector('[data-a="prox"]').onclick = () => avancar(1);
    setTimeout(reposicionar, 260);
    reposicionar();
  }

  function iniciar(passos, chave, forca) {
    if (estado) return;
    if (!forca && localStorage.getItem('mr_tour_' + chave)) return;
    if (!passos.some(p => document.querySelector(p.el))) return;
    montar();
    estado = { passos, chave, i: -1, dir: 1,
      block: document.createElement('div'),
      spot: document.createElement('div'),
      box: document.createElement('div') };
    estado.block.className = 'mrt-block';
    estado.spot.className = 'mrt-spot';
    estado.box.className = 'mrt-box';
    document.body.append(estado.block, estado.spot, estado.box);
    window.addEventListener('resize', reposicionar);
    window.addEventListener('scroll', reposicionar, true);
    document.addEventListener('keydown', teclas);
    avancar(1);
  }

  window.MRTour = { iniciar };
})();
