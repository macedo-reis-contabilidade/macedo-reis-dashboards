// ============================================================================
// MACEDO & REIS — A janela do material pro WhatsApp (24/11/2026). É uma só pros produtos da Vitrine que mandam imagens
// direto na conversa: os planos do MEI (mei-planos-janela.js) e a transformação do MEI em ME
// (transformacao-mei-janela.js). O Samuel: "enviar a imagem direto sem necessidade de clique em link ou em arquivo é a
// forma ideal, dificultar o menos possível pra pessoa abrir e ver".
//
// O que fica aqui, igual pra todos:
// - a janela por cima da tela;
// - as imagens, cada uma com o Copiar (pro Ctrl+V na conversa: chega como imagem) e o Baixar;
// - o Baixar todas e o Compartilhar todas (onde o navegador compartilha arquivo: o celular e o computador com o
//   WhatsApp instalado);
// - a mensagem, que dá pra mudar antes de copiar;
// - o aviso de baixo.
// O produto diz os campos dele, como monta as imagens e a mensagem, e o nome de cada arquivo. Nada é gravado.
// Produto novo com material = um módulo como estes dois, com criarJanelaWhats; nunca copiar esta lógica.
// ============================================================================
import { paraBlob } from './imagens-whats.js';

export const ROTULO = 'font-size:12.5px; color:var(--text-muted);';
export const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

// def: {
//   id: o prefixo dos ids da janela ('pm': pmImagens, pmMsg, pmStatus...), só letras minúsculas;
//   ov: o id da janela; titulo; foco: o id do campo que recebe o foco ao abrir;
//   campos: o HTML dos campos do produto (com os ids dele), entre o título e as imagens;
//   instrucao: o texto do como mandar, embaixo das imagens;
//   ligar(j): liga os eventos dos campos (uma vez, quando a janela nasce);
//   iniciar(s, opc): põe nos campos o que veio de quem abriu (s: a sessão, abaixo);
//   preparar(s, opc): async e opcional, lê o que falta antes do primeiro desenho; false = não deu (já avisou);
//   gerar(s): async, devolve { canvases, mensagem, pronto? (o aviso do fim) };
//   legenda(i, n): o texto de cada imagem; nomeDoArquivo(s, i, n): o nome do arquivo de cada uma }
// A sessão (s) é a janela aberta: s.st (o estado do produto, livre), s.logo, s.ativa() (segue aberta?), s.aviso(texto,
// cor). O que o produto liga em ligar(j) usa j.sessao() (a sessão aberta, ou null), j.redesenhar() e j.redesenharDepois().
export function criarJanelaWhats(def) {
  const P = def.id;
  const $ = id => document.getElementById(id);
  let s = null;           // a sessão aberta
  let espera = null;      // o redesenho que espera a pessoa parar de digitar

  const j = { sessao: () => s, redesenhar: () => redesenhar(), redesenharDepois, aviso };

  function montar() {
    let ov = $(def.ov);
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id = def.ov;
    ov.style.cssText = 'display:none; position:fixed; inset:0; background:var(--overlay); z-index:120; align-items:flex-start; justify-content:center; overflow:auto; padding:32px 16px;';
    ov.innerHTML = `
    <div role="dialog" aria-modal="true" aria-labelledby="${P}Titulo" style="background:var(--surface); border:1px solid var(--fill-3); border-radius:16px; padding:18px 22px; max-width:1080px; width:100%; min-width:0;">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px;">
        <h3 id="${P}Titulo" style="margin:0; font-size:16px;">${esc(def.titulo)}</h3>
        <button id="${P}Fechar" type="button" data-janela-fechar aria-label="Fechar" style="background:none; border:0; color:var(--text-muted); font-size:24px; cursor:pointer; line-height:1;">&times;</button>
      </div>
      ${def.campos || ''}
      <div id="${P}Imagens" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:14px;"></div>
      <p style="margin:12px 0 0; font-size:12.5px; color:var(--text-muted); line-height:1.5;">${esc(def.instrucao)}</p>
      <label style="display:block; margin-top:12px;"><span style="display:block; ${ROTULO} margin-bottom:4px;">A mensagem (dá pra mudar antes de copiar)</span><textarea id="${P}Msg" class="input" rows="8" style="width:100%;"></textarea></label>
      <div style="display:flex; gap:10px; align-items:center; margin-top:8px; flex-wrap:wrap;">
        <span id="${P}Status" role="status" style="margin-right:auto; font-size:12.5px; color:var(--text-dim);"></span>
        <button class="btn btn-ghost btn-sm" type="button" id="${P}Compartilhar" style="display:none;" title="Manda todas as imagens e a mensagem de uma vez, pelo compartilhar do sistema">Compartilhar todas…</button>
        <button class="btn btn-ghost btn-sm" type="button" id="${P}BaixarTodas">Baixar todas</button>
        <button class="btn btn-primary btn-sm" type="button" id="${P}CopiarMsg">Copiar a mensagem</button>
      </div>
    </div>`;
    document.body.appendChild(ov);
    $(P + 'Fechar').addEventListener('click', fechar);
    $(P + 'Imagens').addEventListener('click', e => {
      const c = e.target.closest(`[data-${P}-copiar]`), d = e.target.closest(`[data-${P}-baixar]`);
      if (c) copiar(Number(c.getAttribute(`data-${P}-copiar`)));
      else if (d) baixar(Number(d.getAttribute(`data-${P}-baixar`)));
    });
    $(P + 'BaixarTodas').addEventListener('click', baixarTodas);
    $(P + 'Compartilhar').addEventListener('click', compartilhar);
    $(P + 'CopiarMsg').addEventListener('click', copiarMensagem);
    if (def.ligar) def.ligar(j);
    return ov;
  }

  function aviso(t, cor) {
    const el = $(P + 'Status');
    if (!el) return;
    el.style.color = cor || 'var(--text-dim)'; el.textContent = t;
  }

  function redesenharDepois() {
    clearTimeout(espera);
    espera = setTimeout(redesenhar, 350);
  }

  function soltarImagens() {
    if (!s) return;
    s.urls.forEach(u => u && URL.revokeObjectURL(u));
    s.urls = []; s.blobs = [];
  }

  async function redesenhar() {
    clearTimeout(espera);
    if (!s || !s.pronta) return;
    const eu = s, vez = ++s.vez;
    aviso('Montando as imagens…');
    $(P + 'Imagens').setAttribute('aria-busy', 'true');
    try {
      await logoPronto(eu.logo);
      const r = await def.gerar(eu);
      const blobs = await Promise.all(r.canvases.map(cv => paraBlob(cv)));
      if (s !== eu || vez !== eu.vez) return;
      soltarImagens();
      eu.blobs = blobs;
      eu.urls = blobs.map(b => URL.createObjectURL(b));
      eu.copiadas = new Set();
      pintarImagens(r.canvases);
      $(P + 'Msg').value = r.mensagem;
      $(P + 'Compartilhar').style.display = podeCompartilhar(arquivos()) ? '' : 'none';
      aviso(r.pronto || `Pronto: ${blobs.length} imagens. Copie e cole na conversa, na ordem, e mande a mensagem por último.`);
    } catch (e) {
      if (s !== eu || vez !== eu.vez) return;
      aviso('Não deu pra montar as imagens. Feche e abra de novo.', 'var(--err)');
    } finally {
      if (s === eu && vez === eu.vez) $(P + 'Imagens').removeAttribute('aria-busy');
    }
  }

  function pintarImagens(canvases) {
    const n = canvases.length;
    $(P + 'Imagens').innerHTML = canvases.map((cv, i) => `
      <figure style="margin:0; min-width:0;">
        <figcaption style="display:flex; gap:6px; align-items:center; margin-bottom:8px; font-size:12.5px; color:var(--text-muted); flex-wrap:wrap;">
          <span style="flex:1 1 100%;">${i + 1} · ${esc(def.legenda(i, n))}</span>
          <button class="btn btn-ghost btn-sm" type="button" data-${P}-copiar="${i}">Copiar</button>
          <button class="btn btn-ghost btn-sm" type="button" data-${P}-baixar="${i}">Baixar</button>
        </figcaption>
        <div style="max-height:52vh; overflow:auto; border:1px solid var(--line); border-radius:10px; background:#fff;"><img id="${P}Img${i + 1}" alt="Imagem ${i + 1} de ${n}: ${esc(def.legenda(i, n))}" width="${cv.width}" height="${cv.height}" style="display:block; width:100%; height:auto;"></div>
      </figure>`).join('');
    s.urls.forEach((u, i) => { $(P + 'Img' + (i + 1)).src = u; });
  }

  function arquivos() {
    const n = s.blobs.length;
    return s.blobs.map((b, i) => new File([b], def.nomeDoArquivo(s, i, n), { type: 'image/png' }));
  }
  function podeCompartilhar(files) {
    try { return !!(files.length && navigator.canShare && navigator.share && navigator.canShare({ files })); } catch { return false; }
  }

  async function copiar(i) {
    const b = s && s.blobs[i];
    if (!b) return;
    try {
      if (!navigator.clipboard || !window.ClipboardItem) throw new Error('sem cópia de imagem');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]);
      s.copiadas.add(i);
      const botao = $(P + 'Imagens').querySelector(`[data-${P}-copiar="${i}"]`);
      if (botao) botao.textContent = '✓ Copiada';
      const n = s.blobs.length;
      aviso(`Imagem ${i + 1} copiada: no WhatsApp, cole na conversa com Ctrl+V.${i + 1 < n ? ` Depois, a ${i + 2}.` : ' Por último, a mensagem.'}`, 'var(--ok)');
    } catch {
      aviso('O navegador não deixou copiar a imagem: use o Baixar e arraste o arquivo pra conversa.', 'var(--warn)');
    }
  }

  function baixarUm(b, nome) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  function baixar(i) {
    const b = s && s.blobs[i];
    if (!b) return;
    baixarUm(b, def.nomeDoArquivo(s, i, s.blobs.length));
  }
  async function baixarTodas() {
    if (!s || !s.blobs.length) return;
    const eu = s, blobs = s.blobs.slice(), n = blobs.length;
    const nomes = blobs.map((_, i) => def.nomeDoArquivo(eu, i, n));
    for (let i = 0; i < n; i++) {
      baixarUm(blobs[i], nomes[i]);
      if (i < n - 1) await new Promise(r => setTimeout(r, 300));
    }
    aviso(`${n} imagens baixadas: arraste as ${n} juntas pra conversa (o navegador pode pedir pra permitir vários arquivos).`, 'var(--ok)');
  }

  async function compartilhar() {
    if (!s || !s.blobs.length) return;
    const files = arquivos();
    let dados = { files, text: $(P + 'Msg').value };
    try { if (!navigator.canShare(dados)) dados = { files }; } catch { dados = { files }; }
    try {
      await navigator.share(dados);
      aviso('Compartilhado.', 'var(--ok)');
    } catch (e) {
      if (e && e.name === 'AbortError') return;    // a pessoa fechou o compartilhar
      aviso('O compartilhar não abriu: copie ou baixe as imagens.', 'var(--warn)');
    }
  }

  async function copiarMensagem() {
    const ta = $(P + 'Msg');
    try {
      await navigator.clipboard.writeText(ta.value);
      aviso('Mensagem copiada.', 'var(--ok)');
    } catch {
      ta.focus(); ta.select();
      aviso('Selecionei a mensagem: copie com Ctrl+C.', 'var(--warn)');
    }
  }

  function logoPronto(img) {
    if (!img || (img.complete && img.naturalWidth)) return Promise.resolve();
    return new Promise(r => { img.addEventListener('load', r, { once: true }); img.addEventListener('error', r, { once: true }); setTimeout(r, 3000); });
  }

  function fechar() {
    clearTimeout(espera);
    const ov = $(def.ov);
    if (ov) ov.style.display = 'none';
    if (!s) return;
    const voltar = s.voltar;
    soltarImagens();
    s = null;
    if (voltar && document.contains(voltar) && typeof voltar.focus === 'function') voltar.focus();
  }

  // abre a janela. opc: o que o produto recebe (iniciar e preparar), mais logo (Image da logo; sem ela, carrega
  // logoSrc, assets/logo-mr.png)
  async function abrir(opc = {}) {
    const ov = montar();
    if (s) fechar();
    let img = opc.logo;
    if (!img) { img = new Image(); img.src = opc.logoSrc || 'assets/logo-mr.png'; }
    const eu = { st: {}, logo: img, vez: 0, pronta: false, blobs: [], urls: [], copiadas: new Set(), voltar: document.activeElement };
    eu.ativa = () => s === eu;
    eu.aviso = (t, cor) => { if (s === eu) aviso(t, cor); };
    s = eu;
    $(P + 'Imagens').innerHTML = ''; $(P + 'Msg').value = '';
    $(P + 'Compartilhar').style.display = 'none';
    aviso('');
    if (def.iniciar) def.iniciar(eu, opc);
    ov.style.display = 'flex';
    setTimeout(() => { if (s === eu && def.foco && $(def.foco)) $(def.foco).focus(); }, 30);
    if (def.preparar) {
      const deu = await def.preparar(eu, opc);
      if (s !== eu || !deu) return;
    }
    eu.pronta = true;
    await redesenhar();
  }

  return { abrir, fechar, sessao: () => s };
}
