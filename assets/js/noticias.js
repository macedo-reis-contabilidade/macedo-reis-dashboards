// ============================================================
// MACEDO & REIS — O feed de notícias na tela (20/10/2026, pedido do Samuel: "um feed no nosso sistema, com atualizações
// que tenham relação com nossos clientes … precisamos ser avisados de mudanças, impossível acompanhar tudo")
// A coleta e a triagem são da Edge Function noticias (de hora em hora, supabase/functions/noticias): a IA lê cada notícia
// das fontes, diz se interessa, de que setor é, por que importa, o que fazer e quais clientes da carteira ela alcança.
// Aqui ficam as regras da tela, as mesmas na aba "Notícias" do balão (montarNoticias, montada pelo assistente-escritorio.js
// em op.abas do assistente.js), na página noticias.html e no card do Painel:
//   - de que setor é cada pessoa: o aviso vai pro setor da notícia e pros sócios (decisão do Samuel, 20/10/2026) —
//     setoresDe: os sócios (e quem não está na lista) veem tudo;
//   - "pra mim": triada, Importante ou Vale saber, de um setor meu (paraMim);
//   - "nova": triada depois do meu "visto" (noticias_visto, cada um o seu; sem visto, os últimos 3 dias).
// O recado da carinha: a Importante nova, uma vez por notícia nesta máquina (localStorage mr_noticias_avisadas:<e-mail>).
// Só lê (noticias, noticias_fontes) e grava o próprio visto. Testes: tests/noticias.test.mjs e tests/harness/noticias.py.
// ============================================================
import { SOCIOS } from './equipe.js';

export const SETORES = ['dp', 'fiscal', 'contabil', 'societario', 'irpf'];
export const ROTULO_SETOR = { dp: 'DP', fiscal: 'Fiscal', contabil: 'Contábil', societario: 'Societário', irpf: 'IRPF' };
export const ROTULO_RELEVANCIA = { alta: 'Importante', media: 'Vale saber', baixa: 'Pouco efeito' };
export const ROTULO_TIPO_FONTE = { oficial: 'oficial', tribunal: 'tribunal', imprensa: 'imprensa', classe: 'entidade de classe' };
// quem cuida de cada setor (o mesmo dono do vigia: DP Vitória, fiscal Thalia, contábil Adaini); os sócios veem tudo
export const SETORES_POR_EMAIL = { 'rh@macedoereis.com.br': ['dp'], 'fiscal@macedoereis.com.br': ['fiscal'], 'contabil@macedoereis.com.br': ['contabil'] };
export const JANELA_DIAS = 30;               // a aba mostra os últimos 30 dias
export const PRIMEIRO_USO_DIAS = 3;          // sem "visto" ainda: novas são as dos últimos 3 dias
export const RAIZ = new URL('../../', import.meta.url);   // a raiz do site (este arquivo mora em assets/js/)

export const escHtml = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export function linkSeguro(u) {
  try { const x = new URL(String(u || '')); return x.protocol === 'https:' || x.protocol === 'http:' ? x.href : null; } catch { return null; }
}
// os setores de quem está logado: null = todos (os sócios, e quem não está na lista — melhor ver demais que de menos)
export function setoresDe(email) {
  const e = String(email || '').toLowerCase().trim();
  if (!e || SOCIOS.includes(e)) return null;
  return SETORES_POR_EMAIL[e] || null;
}
export function paraMim(n, email) {
  if (!n || (n.situacao && n.situacao !== 'triada')) return false;
  if (n.relevancia !== 'alta' && n.relevancia !== 'media') return false;
  const meus = setoresDe(email);
  return meus === null || (n.setores || []).some(s => meus.includes(s));
}
export const vistoPadrao = (agora = Date.now()) => new Date(agora - PRIMEIRO_USO_DIAS * 864e5).toISOString();
export const ehNova = (n, vistoAte) => !!(n && n.triada_em && Date.parse(n.triada_em) > Date.parse(vistoAte || 0));
export const novasPraMim = (lista, email, vistoAte) => (lista || []).filter(n => paraMim(n, email) && ehNova(n, vistoAte));
// a ordem: as mais novas primeiro (a data da publicação; sem ela, a da coleta)
export const quando = n => n.publicada_em || n.coletada_em || n.triada_em || '';
export const ordenar = lista => [...(lista || [])].sort((a, b) => String(quando(b)).localeCompare(String(quando(a))));

const pad = x => String(x).padStart(2, '0');
// "hoje, 14:10" · "ontem" · "19/10" · "19/10/2025" (no fuso de quem olha)
export function dataCurta(iso, agora = new Date()) {
  const d = new Date(iso);
  if (!iso || isNaN(d)) return '';
  const dia = x => x.getFullYear() + '-' + x.getMonth() + '-' + x.getDate();
  if (dia(d) === dia(agora)) return 'hoje, ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  const ontem = new Date(agora); ontem.setDate(ontem.getDate() - 1);
  if (dia(d) === dia(ontem)) return 'ontem';
  return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + (d.getFullYear() !== agora.getFullYear() ? '/' + d.getFullYear() : '');
}
export const plural = (n, um, varios) => n + ' ' + (n === 1 ? um : varios);

// ---------- o banco ----------
export async function lerNoticias(supabase, { dias = JANELA_DIAS, descartadas = false, limite = 400 } = {}) {
  const desde = new Date(Date.now() - dias * 864e5).toISOString();
  let q = supabase.from('noticias').select('id, fonte_id, url, titulo, publicada_em, coletada_em, triada_em, situacao, relevancia, setores, resumo, por_que, acao, clientes')
    .gte('coletada_em', desde).order('publicada_em', { ascending: false }).limit(limite);
  q = descartadas ? q.in('situacao', ['triada', 'descartada']) : q.eq('situacao', 'triada');
  const [r1, r2] = await Promise.all([q, supabase.from('noticias_fontes').select('id, nome, tipo, site, url, ativo, ultima_coleta, ultimo_ok, ultimo_erro, itens_ultima')]);
  if (r1.error) throw r1.error;
  const fontes = r2.data || [];
  const porId = new Map(fontes.map(f => [f.id, f]));
  return { noticias: ordenar((r1.data || []).map(n => ({ ...n, fonte: porId.get(n.fonte_id) || null }))), fontes };
}
export async function lerVisto(supabase, email) {
  const { data } = await supabase.from('noticias_visto').select('visto_ate').eq('email', String(email || '').toLowerCase()).maybeSingle();
  return data && data.visto_ate ? data.visto_ate : null;
}
export async function marcarVisto(supabase, email, agora = new Date().toISOString()) {
  const { error } = await supabase.from('noticias_visto').upsert({ email: String(email || '').toLowerCase(), visto_ate: agora }, { onConflict: 'email' });
  return !error;
}

// ---------- o cartão de uma notícia (a aba e a página) ----------
// op: { nova, compacto (a aba do balão: sem o "por que importa", que fica na página), linkClientes (onde ver os clientes) }
export function cartaoHtml(n, { nova = false, compacto = false, linkClientes = null, agora = new Date() } = {}) {
  const url = linkSeguro(n.url);
  const fonte = n.fonte ? n.fonte.nome : 'fonte';
  const rel = n.situacao === 'descartada' ? '<span class="nt-rel nt-rel-fora">Descartada pela IA</span>'
    : '<span class="nt-rel nt-rel-' + escHtml(n.relevancia || 'baixa') + '">' + escHtml(ROTULO_RELEVANCIA[n.relevancia] || 'Pouco efeito') + '</span>';
  const setores = (n.setores || []).map(s => '<span class="nt-setor">' + escHtml(ROTULO_SETOR[s] || s) + '</span>').join('');
  const data = dataCurta(quando(n), agora);
  const titulo = url ? '<a class="nt-titulo" href="' + escHtml(url) + '" target="_blank" rel="noopener noreferrer">' + escHtml(n.titulo) + '</a>' : '<span class="nt-titulo">' + escHtml(n.titulo) + '</span>';
  const qtd = (n.clientes || []).length;
  const clientes = n.situacao === 'descartada' ? '' : '<div class="nt-clientes">' + (qtd
    ? (linkClientes ? '<a href="' + escHtml(linkClientes) + '">' + escHtml('Alcança ' + plural(qtd, 'cliente', 'clientes') + ' da carteira') + '</a>' : escHtml('Alcança ' + plural(qtd, 'cliente', 'clientes') + ' da carteira'))
    : 'Nenhum cliente em particular') + '</div>';
  return '<article class="nt-item nt-' + escHtml(n.situacao === 'descartada' ? 'fora' : n.relevancia || 'baixa') + (nova ? ' nt-e-nova' : '') + '" data-id="' + escHtml(n.id) + '">'
    + '<div class="nt-meta">' + rel + setores + '<span class="nt-fonte">' + escHtml(fonte) + (data ? ' · <time datetime="' + escHtml(quando(n)) + '">' + escHtml(data) + '</time>' : '') + '</span>'
    + (nova ? '<span class="nt-novo">nova</span>' : '') + '</div>'
    + titulo
    + (n.resumo ? '<p class="nt-resumo">' + escHtml(n.resumo) + '</p>' : '')
    + (n.por_que && !compacto ? '<p class="nt-porque"><b>Por que importa:</b> ' + escHtml(n.por_que) + '</p>' : '')
    + (n.acao ? '<p class="nt-acao"><b>O que fazer:</b> ' + escHtml(n.acao) + '</p>' : '')
    + clientes + '</article>';
}

// ---------- a aba "Notícias" do balão ----------
const CHAVE_AVISADAS = email => 'mr_noticias_avisadas:' + String(email || '').toLowerCase();
const lerAvisadas = email => { try { const v = JSON.parse(localStorage.getItem(CHAVE_AVISADAS(email)) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
const guardarAvisadas = (email, ids) => { try { localStorage.setItem(CHAVE_AVISADAS(email), JSON.stringify(ids.slice(-200))); } catch { /* sem armazenamento: avisa de novo */ } };
// o recado: a Importante nova pra mim, publicada (ou coletada) nos últimos 3 dias, que esta máquina ainda não avisou
export function paraAvisar(lista, email, vistoAte, avisadas = [], agora = Date.now()) {
  const recente = n => Date.parse(quando(n)) >= agora - 3 * 864e5;
  return novasPraMim(lista, email, vistoAte).filter(n => n.relevancia === 'alta' && recente(n) && !avisadas.includes(n.id));
}

export function montarNoticias({ supabase, email, el, ctl, intervaloMs = 10 * 60e3 }) {
  let noticias = [], visto = null, filtro = 'mim', carregadoEm = 0, erro = null, timerVisto = null, novasNaTela = new Set();
  const pagina = new URL('noticias.html', RAIZ).href;
  el.classList.add('nt-raiz');
  el.innerHTML = '<div class="nt-topo"><div class="nt-filtro" role="group" aria-label="Quais notícias">'
    + '<button type="button" data-f="mim" aria-pressed="true">Pra você</button><button type="button" data-f="todas" aria-pressed="false">Todas</button></div>'
    + '<a class="nt-ver-tudo" href="' + escHtml(pagina) + '">Ver a página</a></div>'
    + '<div class="nt-rolar"><div class="nt-lista" aria-live="polite"><div class="nt-vazio">Lendo as notícias…</div></div></div>';
  const lista = el.querySelector('.nt-lista'), rolar = el.querySelector('.nt-rolar');
  el.querySelector('.nt-filtro').addEventListener('click', e => {
    const b = e.target.closest('[data-f]');
    if (!b) return;
    filtro = b.dataset.f;
    el.querySelectorAll('.nt-filtro [data-f]').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    desenhar(); rolar.scrollTop = 0;
  });
  const visiveis = () => (filtro === 'mim' ? noticias.filter(n => paraMim(n, email)) : noticias).slice(0, 60);
  function desenhar() {
    if (erro && !noticias.length) { lista.innerHTML = '<div class="nt-vazio">Não consegui ler as notícias agora. Tento de novo daqui a pouco.</div>'; return; }
    const vs = visiveis();
    if (!vs.length) {
      lista.innerHTML = '<div class="nt-vazio">' + (filtro === 'mim'
        ? 'Nada novo pro seu setor nos últimos ' + JANELA_DIAS + ' dias. Em "Todas" estão as outras.'
        : carregadoEm ? 'Nenhuma notícia triada nos últimos ' + JANELA_DIAS + ' dias.' : 'Lendo as notícias…') + '</div>';
      return;
    }
    lista.innerHTML = vs.map(n => cartaoHtml(n, { nova: novasNaTela.has(n.id), compacto: true, linkClientes: pagina + '?n=' + encodeURIComponent(n.id) })).join('');
  }
  function contar() {
    const novas = novasPraMim(noticias, email, visto || vistoPadrao());
    ctl.contador(ctl.ativa() ? 0 : novas.length);
    ctl.status();
  }
  // a aba aberta: o que está na tela já foi visto (o "nova" fica marcado enquanto ela está aberta)
  function verAgora() {
    clearTimeout(timerVisto);
    timerVisto = setTimeout(async () => {
      if (!ctl.ativa()) return;
      const agora = new Date().toISOString();
      if (await marcarVisto(supabase, email, agora)) { visto = agora; contar(); }
    }, 1500);
  }
  async function carregar() {
    try {
      const [r, v] = await Promise.all([lerNoticias(supabase), lerVisto(supabase, email)]);
      noticias = r.noticias; visto = v; erro = null; carregadoEm = Date.now();
    } catch (e) { erro = e; }
    const base = visto || vistoPadrao();
    novasNaTela = new Set(novasPraMim(noticias, email, base).map(n => n.id));
    desenhar(); contar();
    if (ctl.ativa()) verAgora();
    avisarImportantes();
  }
  function avisarImportantes() {
    if (ctl.ativa()) return;
    const avisadas = lerAvisadas(email);
    const novas = paraAvisar(noticias, email, visto || vistoPadrao(), avisadas);
    if (!novas.length) return;
    const n = novas[0];
    const ok = ctl.avisar({
      html: '<p><b>Notícia importante</b> · ' + escHtml(n.fonte ? n.fonte.nome : 'fonte') + '</p><p>' + escHtml(n.titulo) + '</p>'
        + (n.por_que ? '<p>' + escHtml(n.por_que) + '</p>' : '') + (novas.length > 1 ? '<p>' + escHtml('E mais ' + plural(novas.length - 1, 'importante nova', 'importantes novas') + '.') + '</p>' : ''),
      botoes: [{ rotulo: 'Ver no feed', acao: () => ctl.mostrar() }], ms: 20000
    });
    // avisou: estas não avisam de novo nesta máquina (o recado ocupado fica pra próxima leitura)
    if (ok) guardarAvisadas(email, [...avisadas, ...novas.map(x => x.id)]);
  }
  carregar();
  const timer = setInterval(carregar, intervaloMs);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - carregadoEm > 2 * 60e3) carregar(); });
  return {
    aoMostrar() { desenhar(); verAgora(); contar(); },
    aoEsconder() { clearTimeout(timerVisto); novasNaTela = new Set(novasPraMim(noticias, email, visto || vistoPadrao()).map(n => n.id)); desenhar(); },
    status() {
      const novas = novasPraMim(noticias, email, visto || vistoPadrao()).length;
      return novasNaTela.size ? plural(novasNaTela.size, 'nova pra você', 'novas pra você') : novas ? plural(novas, 'nova pra você', 'novas pra você')
        : carregadoEm ? 'As notícias que afetam os clientes' : 'Lendo as notícias…';
    },
    recarregar: carregar,
    parar() { clearInterval(timer); }
  };
}
