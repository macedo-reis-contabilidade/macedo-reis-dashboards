/* MRTour — tour guiado da casa. Sem dependências. */
(function () {
  const CSS = `
  .mrt-block { position:fixed; inset:0; z-index:9997; }
  .mrt-spot { position:absolute; z-index:9998; border-radius:10px; pointer-events:none;
    box-shadow: 0 0 0 4px rgba(138,174,200,.6), 0 0 0 9999px var(--overlay); transition: all .25s ease; }
  .mrt-box { position:fixed; z-index:9999; width:min(330px, calc(100vw - 24px));
    background:var(--surface); border:1px solid rgba(138,174,200,.35); border-radius:12px;
    padding:16px 18px; color:var(--text); font-family:inherit; box-shadow:0 12px 40px rgba(0,0,0,.5); }
  .mrt-box h4 { margin:0 0 6px; font-size:15px; }
  .mrt-box p { margin:0; font-size:13px; line-height:1.55; color:var(--text-2); }
  .mrt-foot { display:flex; align-items:center; gap:8px; margin-top:14px; }
  .mrt-passo { font-size:11.5px; color:var(--text-muted); margin-right:auto; }
  .mrt-btn { font:inherit; font-size:12.5px; padding:6px 12px; border-radius:8px; cursor:pointer;
    border:1px solid var(--fill-3); background:transparent; color:var(--text-2); }
  .mrt-btn.pri { background:rgba(91,130,166,.35); border-color:rgba(138,174,200,.5); color:var(--text); }
  .mrt-btn:disabled { opacity:.35; cursor:default; }
  .mrt-help { position:fixed; right:18px; bottom:18px; z-index:9000; width:40px; height:40px;
    border-radius:50%; display:flex; align-items:center; justify-content:center;
    background:var(--pop); border:1px solid rgba(224,143,168,.45); color:#E08FA8;
    font-size:19px; font-weight:700; text-decoration:none; box-shadow:0 4px 16px rgba(0,0,0,.4); transition:.15s; }
  .mrt-help:hover { background:rgba(224,143,168,.18); transform:scale(1.06); }
  [data-theme="light"] .mrt-help { color:#A8406A; border-color:rgba(168,64,106,.45); box-shadow:0 4px 16px rgba(0,0,0,.12); }
  .mrt-menu { position:fixed; right:18px; bottom:66px; z-index:9001; background:var(--surface);
    border:1px solid var(--fill-3); border-radius:12px; padding:6px; min-width:220px;
    box-shadow:0 12px 40px rgba(0,0,0,.5); display:none; }
  .mrt-menu.is-open { display:block; }
  .mrt-menu a, .mrt-menu button { display:block; width:100%; text-align:left; background:transparent;
    border:none; color:var(--text); font:inherit; font-size:13.5px; padding:9px 12px; border-radius:8px;
    cursor:pointer; text-decoration:none; }
  .mrt-menu a:hover, .mrt-menu button:hover { background:var(--line); }`;

  let estado = null;
  let registrado = null; // { passos, chave } da página atual
  let usuarioAtual = '';

  function montar() {
    if (document.getElementById('mrt-style')) return;
    const st = document.createElement('style');
    st.id = 'mrt-style'; st.textContent = CSS;
    document.head.appendChild(st);
  }

  // O passo: { el, titulo, texto } — el é o seletor do que o passo mostra (ou uma função que devolve o elemento).
  // Opcionais (04/11/2026, o tour do Controle das contabilidades): antes() prepara a tela pro passo (abre o que ele mostra:
  // uma janela, as opções de um mês) e se() diz se o passo vale quando o que ele mostra só existe depois do antes().
  // No iniciar, { aoTerminar } arruma a tela quando o tour acaba (Concluir, Pular ou Esc). Erro num deles não trava o tour.
  function alvoDe(p) {
    try { return typeof p.el === 'function' ? p.el() : document.querySelector(p.el); } catch (e) { return null; }
  }
  function vale(p) {
    try { return p.se ? !!p.se() : !!alvoDe(p); } catch (e) { return false; }
  }
  function chamar(f) {
    if (typeof f === 'function') { try { f(); } catch (e) { /* o gancho da página não trava o tour */ } }
  }

  function limpar() {
    if (!estado) return;
    ['block', 'spot', 'box'].forEach(k => estado[k] && estado[k].remove());
    window.removeEventListener('resize', reposicionar);
    window.removeEventListener('scroll', reposicionar, true);
    document.removeEventListener('keydown', teclas, true);
    const fim = estado.aoTerminar;
    estado = null;
    chamar(fim);
  }

  function terminar(concluiu) {
    if (estado) { try { localStorage.setItem(chaveStorage(estado.chave), concluiu ? 'ok' : 'pulado'); } catch (e) {} }
    limpar();
  }

  // na captura e sem a ação padrão: com o tour aberto, o Enter não aperta o botão que estava com o foco na tela
  function teclas(e) {
    if (!estado) return;
    if (e.key === 'Escape') { e.preventDefault(); terminar(false); }
    else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); avancar(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); avancar(-1); }
  }

  function passoValido(i) {
    while (i >= 0 && i < estado.passos.length && !vale(estado.passos[i])) i += estado.dir;
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
    const alvo = alvoDe(estado.passos[estado.i]);
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
    chamar(p.antes);
    if (!estado) return;
    const alvo = alvoDe(p);
    if (!alvo) {   // o preparo não abriu o que o passo mostra: segue pro próximo
      estado.dir = 1;
      const prox = passoValido(estado.i + 1);
      if (prox >= estado.passos.length) { terminar(true); return; }
      estado.i = prox;
      mostrar();
      return;
    }
    alvo.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const validos = estado.passos.map(vale);
    const vistos = validos.filter(Boolean).length;
    const pos = validos.slice(0, estado.i + 1).filter(Boolean).length;
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

  function chaveStorage(chave) {
    return 'mr_tour_' + chave + (usuarioAtual ? '::' + usuarioAtual : '');
  }

  function iniciar(passos, chave, forca, usuario, opcoes) {
    if (usuario) usuarioAtual = String(usuario);
    registrado = { passos, chave, opcoes: opcoes || {} };
    if (estado) return;
    let visto = null;
    try { visto = localStorage.getItem(chaveStorage(chave)); } catch (e) {}
    if (!forca && visto) return;
    if (!passos.some(vale)) return;
    montar();
    estado = { passos, chave, i: -1, dir: 1, aoTerminar: (opcoes || {}).aoTerminar,
      block: document.createElement('div'),
      spot: document.createElement('div'),
      box: document.createElement('div') };
    estado.block.className = 'mrt-block';
    estado.spot.className = 'mrt-spot';
    estado.box.className = 'mrt-box';
    document.body.append(estado.block, estado.spot, estado.box);
    window.addEventListener('resize', reposicionar);
    window.addEventListener('scroll', reposicionar, true);
    document.addEventListener('keydown', teclas, true);
    avancar(1);
  }

  function botaoAjuda() {
    if (document.querySelector('.mrt-help')) return;
    montar();
    const hrefAjuda = location.pathname.includes('/clientes/') ? '../ajuda.html' : 'ajuda.html';
    const a = document.createElement('a');
    a.className = 'mrt-help';
    a.href = hrefAjuda;
    a.title = 'Ajuda';
    a.textContent = '?';
    const menu = document.createElement('div');
    menu.className = 'mrt-menu';
    menu.innerHTML = '<a href="' + hrefAjuda + '">Central de ajuda</a>' +
                     '<button type="button" data-a="rever">↻ Rever o tour desta página</button>';
    a.addEventListener('click', e => {
      if (!registrado) return; // sem tour na página → link direto
      e.preventDefault();
      menu.classList.toggle('is-open');
    });
    menu.querySelector('[data-a="rever"]').addEventListener('click', () => {
      menu.classList.remove('is-open');
      if (registrado && !estado) iniciar(registrado.passos, registrado.chave, true, '', registrado.opcoes);
    });
    document.addEventListener('click', e => {
      if (!menu.contains(e.target) && e.target !== a) menu.classList.remove('is-open');
    });
    document.body.append(a, menu);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', botaoAjuda);
  else botaoAjuda();

  window.MRTour = { iniciar };
})();
