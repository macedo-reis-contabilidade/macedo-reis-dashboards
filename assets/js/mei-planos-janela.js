// ============================================================================
// MACEDO & REIS — A janela dos planos do MEI pro WhatsApp (24/11/2026). Uma só, em duas telas: a aba MEI da
// Precificação (abre com o cliente, os planos marcados e as notas do plano que estão na tela) e o produto "Planos do
// MEI" da Vitrine de serviços (lê os planos do banco). O Samuel: "enviar a imagem direto sem necessidade de clique em
// link ou em arquivo é a forma ideal, dificultar o menos possível pra pessoa abrir e ver".
//
// As imagens vão pra conversa como imagem: copiar e colar (Ctrl+V) no WhatsApp, uma por vez, ou o compartilhar do
// sistema, que manda todas de uma vez, com a mensagem (aparece onde o navegador sabe compartilhar arquivo: o celular e
// o computador com o WhatsApp instalado). A cliente vê ali mesmo, sem abrir link nem arquivo. Nada é gravado: as
// imagens e a mensagem saem do que está na janela. O recomendado é o plano escolhido nela (na Precificação, começa
// pelo marcado na tela); sem nenhum, o mais simples.
// ============================================================================
import { montarVitrine, recomendados as recomendadosDe, mensagemWhats, primeiroNome, planosEmOrdem, nomeCurto, reais, reaisCurto, qtdNotas } from './mei-planos.js';
import { imagensDosPlanos, paraBlob } from './mei-planos-imagem.js';

// as colunas que a janela lê (o mesmo que a aba MEI da Precificação mostra)
export const COLS_PLANOS = 'id, nome, slogan, valor_mensal, ordem, ativo';
export const COLS_SERVICOS = 'id, nome, grupo, tipo, valor_avulso, ordem, ativo';
export const COLS_COMP = 'plano_id, servico_id';

// os planos e os serviços do MEI, com o que cada plano tem (comp: { plano_id: Set de servico_id }); { erro: true } se
// alguma leitura falhar
export async function lerCatalogoMei(supabase) {
  const [p, s, c] = await Promise.all([
    supabase.from('mei_planos').select(COLS_PLANOS).eq('ativo', true).order('ordem'),
    supabase.from('mei_servicos').select(COLS_SERVICOS).eq('ativo', true).order('ordem'),
    supabase.from('mei_plano_servicos').select(COLS_COMP)
  ]);
  if (p.error || s.error || c.error) return { erro: true };
  const comp = {};
  (c.data || []).forEach(x => (comp[x.plano_id] = comp[x.plano_id] || new Set()).add(x.servico_id));
  return { planos: p.data || [], servicos: s.data || [], comp };
}

// a frase do aviso de cima: o que vai como recomendado e por quê (pura: o teste lê)
export function textoDaRecomendacao(planos, rec) {
  const ordem = planosEmOrdem(planos);
  const ids = new Set(rec || []);
  const escolhidos = ordem.filter(p => ids.has(p.id));
  if (!escolhidos.length) return '';
  if (escolhidos.length === 1) {
    const p = escolhidos[0];
    const frase = `Recomendado: ${p.nome}${ordem.length > 1 && p.id === ordem[0].id ? ', o mais simples' : ''}`;
    return (/[.!?]$/.test(frase) ? frase : frase + '.') + ' Clique num plano pra mudar a recomendação.';   // "MEI FOLHA PGTO." sem o ponto dobrado
  }
  const total = escolhidos.reduce((s, p) => s + (Number(p.valor_mensal) || 0), 0);
  return `Recomendados: ${escolhidos.map(p => p.nome).join(' + ')}, ${reais(total)} por mês, juntos. Clique num plano pra mudar.`;
}

// o nome do arquivo de cada imagem: "Planos MEI - Fulana (2 de 4).png"
export function nomeDoArquivo(cliente, i, total) {
  const pn = primeiroNome(cliente);
  return `Planos MEI${pn ? ' - ' + pn : ''} (${i + 1} de ${total}).png`;
}

const ID = 'ovPlanosMei';
const $ = id => document.getElementById(id);
const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const ROTULO = 'font-size:12.5px; color:var(--text-muted);';
let st = null;          // o que a janela tem agora
let espera = null;      // o redesenho que espera a pessoa parar de digitar

function montar() {
  let ov = $(ID);
  if (ov) return ov;
  ov = document.createElement('div');
  ov.id = ID;
  ov.style.cssText = 'display:none; position:fixed; inset:0; background:var(--overlay); z-index:120; align-items:flex-start; justify-content:center; overflow:auto; padding:32px 16px;';
  ov.innerHTML = `
    <div role="dialog" aria-modal="true" aria-labelledby="pmTitulo" style="background:var(--surface); border:1px solid var(--fill-3); border-radius:16px; padding:18px 22px; max-width:1080px; width:100%; min-width:0;">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px;">
        <h3 id="pmTitulo" style="margin:0; font-size:16px;">Os planos do MEI pro WhatsApp</h3>
        <button id="pmFechar" type="button" data-janela-fechar aria-label="Fechar" style="background:none; border:0; color:var(--text-muted); font-size:24px; cursor:pointer; line-height:1;">&times;</button>
      </div>
      <div style="display:flex; flex-wrap:wrap; gap:12px 18px; align-items:flex-start;">
        <label style="display:flex; flex-direction:column; gap:4px; flex:1 1 220px; min-width:0;"><span style="${ROTULO}">Cliente</span><input id="pmCliente" class="input" maxlength="120" placeholder="o nome, pra mensagem e as imagens" autocomplete="off"></label>
        <div role="group" aria-labelledby="pmRecRotulo" style="display:flex; flex-direction:column; gap:4px; flex:3 1 360px; min-width:0;"><span id="pmRecRotulo" style="${ROTULO}">Recomendar</span><div id="pmPlanos" style="display:flex; gap:6px; flex-wrap:wrap;"></div></div>
        <label id="pmNfsCampo" style="display:flex; flex-direction:column; gap:4px; width:120px;"><span style="${ROTULO}">Notas no plano</span><input id="pmNfs" class="input" type="number" min="1" max="99" step="1" inputmode="numeric"></label>
      </div>
      <p id="pmRecomenda" style="margin:10px 0 12px; font-size:13px; color:var(--text-muted);"></p>
      <div id="pmImagens" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:14px;"></div>
      <p style="margin:12px 0 0; font-size:12.5px; color:var(--text-muted); line-height:1.5;">No WhatsApp: copie a imagem 1, cole na conversa (Ctrl+V) e mande; faça o mesmo com as outras, na ordem, e mande a mensagem por último. Ela chega como imagem: a cliente vê ali mesmo, sem abrir link nem arquivo.</p>
      <label style="display:block; margin-top:12px;"><span style="display:block; ${ROTULO} margin-bottom:4px;">A mensagem (dá pra mudar antes de copiar)</span><textarea id="pmMsg" class="input" rows="8" style="width:100%;"></textarea></label>
      <div style="display:flex; gap:10px; align-items:center; margin-top:8px; flex-wrap:wrap;">
        <span id="pmStatus" role="status" style="margin-right:auto; font-size:12.5px; color:var(--text-dim);"></span>
        <button class="btn btn-ghost btn-sm" type="button" id="pmCompartilhar" style="display:none;" title="Manda todas as imagens e a mensagem de uma vez, pelo compartilhar do sistema">Compartilhar todas…</button>
        <button class="btn btn-ghost btn-sm" type="button" id="pmBaixarTodas">Baixar todas</button>
        <button class="btn btn-primary btn-sm" type="button" id="pmCopiarMsg">Copiar a mensagem</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  $('pmFechar').addEventListener('click', fechar);
  $('pmCliente').addEventListener('input', () => { if (!st) return; st.cliente = $('pmCliente').value; redesenharDepois(); });
  $('pmNfs').addEventListener('input', () => { if (!st) return; st.nfs = $('pmNfs').value; redesenharDepois(); });
  $('pmPlanos').addEventListener('click', e => {
    const b = e.target.closest('[data-pm-plano]');
    if (!b || !st) return;
    const id = b.dataset.pmPlano;
    if (st.rec.has(id)) st.rec.delete(id); else st.rec.add(id);
    // sem nenhum escolhido, volta o mais simples
    if (!st.rec.size) st.rec = new Set(recomendadosDe(st.catalogo.planos, []));
    pintarPlanos();
    redesenhar();
  });
  $('pmImagens').addEventListener('click', e => {
    const c = e.target.closest('[data-pm-copiar]'), d = e.target.closest('[data-pm-baixar]');
    if (c) copiar(Number(c.dataset.pmCopiar));
    else if (d) baixar(Number(d.dataset.pmBaixar));
  });
  $('pmBaixarTodas').addEventListener('click', baixarTodas);
  $('pmCompartilhar').addEventListener('click', compartilhar);
  $('pmCopiarMsg').addEventListener('click', copiarMensagem);
  return ov;
}

function aviso(t, cor) {
  const s = $('pmStatus');
  s.style.color = cor || 'var(--text-dim)'; s.textContent = t;
}

// os botões dos planos: o escolhido em champanhe, com o ✓ (a cor do "Recomendado pra você" das imagens)
function pintarPlanos() {
  const ordem = planosEmOrdem(st.catalogo.planos);
  $('pmPlanos').innerHTML = ordem.map(p => {
    const sim = st.rec.has(p.id);
    const cor = sim ? 'background:var(--sol-forte); color:var(--sol-tinta); border-color:var(--sol-forte);' : '';
    return `<button type="button" class="btn btn-ghost btn-sm" data-pm-plano="${esc(p.id)}" aria-pressed="${sim}" style="${cor}">${sim ? '✓ ' : ''}${esc(nomeCurto(p.nome))} · ${esc(reaisCurto(p.valor_mensal))}</button>`;
  }).join('');
  $('pmRecomenda').textContent = textoDaRecomendacao(st.catalogo.planos, [...st.rec]);
}

function redesenharDepois() {
  clearTimeout(espera);
  espera = setTimeout(redesenhar, 350);
}

function soltarImagens() {
  if (!st) return;
  st.urls.forEach(u => u && URL.revokeObjectURL(u));
  st.urls = []; st.blobs = [];
}

async function redesenhar() {
  clearTimeout(espera);
  if (!st || !st.catalogo) return;
  const vez = ++st.vez;
  const c = st.catalogo;
  const v = montarVitrine({ planos: c.planos, servicos: c.servicos, comp: c.comp, nfs: st.nfs });
  const rec = recomendadosDe(c.planos, [...st.rec]);
  aviso('Montando as imagens…');
  $('pmImagens').setAttribute('aria-busy', 'true');
  try {
    await logoPronto(st.logo);
    const canvases = await imagensDosPlanos(v, { recomendados: rec, nome: st.cliente, logo: st.logo });
    const blobs = await Promise.all(canvases.map(cv => paraBlob(cv)));
    if (!st || vez !== st.vez) return;
    soltarImagens();
    st.blobs = blobs;
    st.urls = blobs.map(b => URL.createObjectURL(b));
    st.copiadas = new Set();
    pintarImagens(canvases);
    $('pmMsg').value = mensagemWhats({ nome: st.cliente, quem: st.quem, vitrine: v, recomendados: rec, imagens: blobs.length });
    $('pmCompartilhar').style.display = podeCompartilhar(arquivos()) ? '' : 'none';
    aviso(`Pronto: ${blobs.length} imagens. Copie e cole na conversa, na ordem, e mande a mensagem por último.`);
  } catch (e) {
    if (!st || vez !== st.vez) return;
    aviso('Não deu pra montar as imagens. Feche e abra de novo.', 'var(--err)');
  } finally {
    if (st && vez === st.vez) $('pmImagens').removeAttribute('aria-busy');
  }
}

const LEGENDA = (i, n) => i === 0 ? 'os planos' : n > 2 ? `a lista do que cada um inclui (${i} de ${n - 1})` : 'a lista do que cada um inclui';
function pintarImagens(canvases) {
  const n = canvases.length;
  $('pmImagens').innerHTML = canvases.map((cv, i) => `
    <figure style="margin:0; min-width:0;">
      <figcaption style="display:flex; gap:6px; align-items:center; margin-bottom:8px; font-size:12.5px; color:var(--text-muted); flex-wrap:wrap;">
        <span style="flex:1 1 100%;">${i + 1} · ${esc(LEGENDA(i, n))}</span>
        <button class="btn btn-ghost btn-sm" type="button" data-pm-copiar="${i}">Copiar</button>
        <button class="btn btn-ghost btn-sm" type="button" data-pm-baixar="${i}">Baixar</button>
      </figcaption>
      <div style="max-height:52vh; overflow:auto; border:1px solid var(--line); border-radius:10px; background:#fff;"><img id="pmImg${i + 1}" alt="Imagem ${i + 1} de ${n}: ${esc(LEGENDA(i, n))}" width="${cv.width}" height="${cv.height}" style="display:block; width:100%; height:auto;"></div>
    </figure>`).join('');
  st.urls.forEach((u, i) => { $('pmImg' + (i + 1)).src = u; });
}

function arquivos() {
  return st.blobs.map((b, i) => new File([b], nomeDoArquivo(st.cliente, i, st.blobs.length), { type: 'image/png' }));
}
function podeCompartilhar(files) {
  try { return !!(files.length && navigator.canShare && navigator.share && navigator.canShare({ files })); } catch { return false; }
}

async function copiar(i) {
  const b = st && st.blobs[i];
  if (!b) return;
  try {
    if (!navigator.clipboard || !window.ClipboardItem) throw new Error('sem cópia de imagem');
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]);
    st.copiadas.add(i);
    const botao = $('pmImagens').querySelector(`[data-pm-copiar="${i}"]`);
    if (botao) botao.textContent = '✓ Copiada';
    const n = st.blobs.length;
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
  const b = st && st.blobs[i];
  if (!b) return;
  baixarUm(b, nomeDoArquivo(st.cliente, i, st.blobs.length));
}
async function baixarTodas() {
  if (!st || !st.blobs.length) return;
  const blobs = st.blobs.slice(), n = blobs.length, cliente = st.cliente;
  for (let i = 0; i < n; i++) {
    baixarUm(blobs[i], nomeDoArquivo(cliente, i, n));
    if (i < n - 1) await new Promise(r => setTimeout(r, 300));
  }
  aviso(`${n} imagens baixadas: arraste as ${n} juntas pra conversa (o navegador pode pedir pra permitir vários arquivos).`, 'var(--ok)');
}

async function compartilhar() {
  if (!st || !st.blobs.length) return;
  const files = arquivos();
  let dados = { files, text: $('pmMsg').value };
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
  const ta = $('pmMsg');
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
  const ov = $(ID);
  if (ov) ov.style.display = 'none';
  if (!st) return;
  const voltar = st.voltar;
  soltarImagens();
  st = null;
  if (voltar && document.contains(voltar) && typeof voltar.focus === 'function') voltar.focus();
}

// abre a janela. opc: { supabase, catalogo ({ planos, servicos, comp }, o que a tela já tem; sem ele, lê do banco),
// cliente, marcados (os ids dos planos marcados na tela), nfs (as notas do plano), quem (o nome de quem manda), logo
// (Image da logo; sem ela, carrega assets/logo-mr.png) }
export async function abrirPlanosMei({ supabase, catalogo = null, cliente = '', marcados = [], nfs = '', quem = '', logo = null, logoSrc = 'assets/logo-mr.png' } = {}) {
  const ov = montar();
  if (st) fechar();
  let img = logo;
  if (!img) { img = new Image(); img.src = logoSrc; }
  st = { catalogo: null, cliente: String(cliente || ''), rec: new Set(), nfs: nfs == null ? '' : String(nfs), quem, logo: img, vez: 0, blobs: [], urls: [], copiadas: new Set(), voltar: document.activeElement };
  const meu = st;
  $('pmCliente').value = st.cliente;
  $('pmPlanos').innerHTML = ''; $('pmImagens').innerHTML = ''; $('pmMsg').value = ''; $('pmRecomenda').textContent = '';
  $('pmCompartilhar').style.display = 'none';
  ov.style.display = 'flex';
  setTimeout(() => { if (st === meu) $('pmCliente').focus(); }, 30);
  let c = catalogo && Array.isArray(catalogo.planos) && catalogo.planos.length ? catalogo : null;
  if (!c) {
    aviso('Lendo os planos…');
    c = supabase ? await lerCatalogoMei(supabase) : { erro: true };
    if (st !== meu) return;
    if (c.erro || !c.planos.length) { aviso('Não deu pra ler os planos do MEI agora. Feche e abra de novo.', 'var(--err)'); return; }
  }
  st.catalogo = c;
  st.rec = new Set(recomendadosDe(c.planos, marcados));
  // as notas do plano: só quando algum plano tem a emissão de notas
  const conjuntos = c.comp instanceof Map ? [...c.comp.values()] : Object.values(c.comp || {});
  const temNotas = conjuntos.some(x => (x instanceof Set ? x : new Set(x || [])).has('nfs_plano'));
  $('pmNfsCampo').style.display = temNotas ? 'flex' : 'none';
  $('pmNfs').value = temNotas ? String(qtdNotas(st.nfs)) : '';
  if (temNotas) st.nfs = $('pmNfs').value;
  pintarPlanos();
  await redesenhar();
}
