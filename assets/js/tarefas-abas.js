// =====================================================================
// MACEDO & REIS — As abas da tela de Tarefas de cada setor (09/11/2026)
// O pedido do Samuel: "dois módulos tratando disso fica complicado, de repente por as recorrentes dentro das
// tarefas seria um caminho, mas cuidar com as coisas que ja estao vinculadas". A tela de Tarefas de cada setor
// ganha duas abas: "Tarefas" (o tarefas-engine.js, como sempre) e "Recorrentes" (o rotinas-setor.js, o mesmo módulo
// da antiga tela "Tarefas recorrentes", embutido). Nada muda no banco: as rotinas, as empresas vinculadas e as
// tarefas que já nasceram seguem iguais. A aba vem do endereço (?aba=recorrentes) e fica nele; o <setor>-regras.html
// de antes só redireciona pra cá (o link do vigia, os favoritos). As recorrentes carregam só quando a aba abre.
// =====================================================================

const CSS = `
  .ta-seg { display:inline-flex; border:1px solid var(--fill-3); border-radius:10px; overflow:hidden; margin:0 0 18px; }
  .ta-seg button { background:transparent; border:none; color:var(--text-muted); font:inherit; font-size:13.5px; padding:8px 18px; cursor:pointer; }
  .ta-seg button + button { border-left:1px solid var(--fill-3); }
  .ta-seg button[aria-selected="true"] { background:rgba(82,180,198,.22); color:var(--text); }
  .ta-seg button:focus-visible { outline:2px solid var(--brand-light); outline-offset:-2px; }
`;

export const ABAS = ['tarefas', 'recorrentes'];

// a aba pedida no endereço; qualquer outra coisa é a de Tarefas
export function abaDoEndereco(busca) {
  const p = new URLSearchParams(busca || '');
  return p.get('aba') === 'recorrentes' ? 'recorrentes' : 'tarefas';
}

// o endereço da tela com a aba: a de Tarefas não leva o ?aba (o endereço de sempre); o resto da busca fica
export function enderecoDaAba(caminho, busca, hash, aba) {
  const p = new URLSearchParams(busca || '');
  if (aba === 'recorrentes') p.set('aba', 'recorrentes'); else p.delete('aba');
  const q = p.toString();
  return caminho + (q ? '?' + q : '') + (hash || '');
}

// o redirecionamento do <setor>-regras.html antigo: a tela de Tarefas do setor, na aba Recorrentes, com o resto
// do endereço que veio (um ?id= ou um #, se alguém tiver guardado)
export function destinoDasRegras(setor, busca, hash) {
  if (!/^[a-z]+$/.test(String(setor || ''))) throw new Error('destinoDasRegras: setor inválido');
  return enderecoDaAba(setor + '-tarefas.html', busca, hash, 'recorrentes');
}

// monta as duas abas em volta do #tarefasApp. cfg: { setor, nomeSetor, hub, equipe, dicaObs } (os mesmos da
// antiga página de recorrentes) e, opcional, appId.
export function montarAbasTarefas(cfg) {
  const C = { appId: 'tarefasApp', ...cfg };
  if (!C.setor || !C.nomeSetor || !C.hub) throw new Error('montarAbasTarefas: informe setor, nomeSetor e hub');
  const app = document.getElementById(C.appId);
  if (!app) throw new Error('montarAbasTarefas: não achei #' + C.appId);
  if (!document.getElementById('taCss')) {
    const st = document.createElement('style'); st.id = 'taCss'; st.textContent = CSS; document.head.appendChild(st);
  }

  const seg = document.createElement('div');
  seg.className = 'ta-seg';
  seg.setAttribute('role', 'tablist');
  seg.setAttribute('aria-label', 'Tarefas do setor');
  seg.innerHTML = '<button type="button" role="tab" id="taAbaTarefas" aria-controls="' + C.appId + '">Tarefas</button>'
    + '<button type="button" role="tab" id="taAbaRecorrentes" aria-controls="rvRaiz">Recorrentes</button>';
  app.parentNode.insertBefore(seg, app);
  app.setAttribute('role', 'tabpanel');
  app.setAttribute('aria-labelledby', 'taAbaTarefas');

  const painel = document.createElement('div');
  painel.id = 'rvRaiz';
  painel.setAttribute('role', 'tabpanel');
  painel.setAttribute('aria-labelledby', 'taAbaRecorrentes');
  painel.hidden = true;
  app.parentNode.insertBefore(painel, app.nextSibling);

  const botoes = { tarefas: seg.querySelector('#taAbaTarefas'), recorrentes: seg.querySelector('#taAbaRecorrentes') };
  let montada = null;   // a promessa do módulo das recorrentes, na primeira vez que a aba abre

  function mostrar(aba, { foco = false, endereco = true } = {}) {
    for (const a of ABAS) {
      const on = a === aba;
      botoes[a].setAttribute('aria-selected', on ? 'true' : 'false');
      botoes[a].tabIndex = on ? 0 : -1;
    }
    app.hidden = aba !== 'tarefas';
    painel.hidden = aba !== 'recorrentes';
    if (foco) botoes[aba].focus();
    if (endereco) {
      const novo = enderecoDaAba(location.pathname, location.search, location.hash, aba);
      if (novo !== location.pathname + location.search + location.hash) history.replaceState(history.state, '', novo);
    }
    if (aba === 'recorrentes' && !montada) {
      montada = import('./rotinas-setor.js')
        .then(m => m.initRotinasSetor({
          setor: C.setor, nomeSetor: C.nomeSetor, hub: C.hub,
          ...(C.equipe ? { equipe: C.equipe } : {}), ...(C.dicaObs ? { dicaObs: C.dicaObs } : {}),
          raiz: 'rvRaiz', embutido: true
        }))
        .catch(() => {
          montada = null;
          painel.innerHTML = '<p style="color:var(--danger,#e66);font-size:13.5px;">Não consegui abrir as recorrentes. Recarregue a página.</p>';
        });
    }
  }

  botoes.tarefas.addEventListener('click', () => mostrar('tarefas'));
  botoes.recorrentes.addEventListener('click', () => mostrar('recorrentes'));
  seg.addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const atual = botoes.recorrentes.getAttribute('aria-selected') === 'true' ? 'recorrentes' : 'tarefas';
    const prox = (e.key === 'Home') ? 'tarefas' : (e.key === 'End') ? 'recorrentes' : (atual === 'tarefas' ? 'recorrentes' : 'tarefas');
    mostrar(prox, { foco: true });
  });

  mostrar(abaDoEndereco(location.search), { endereco: false });
  return { mostrar };
}
