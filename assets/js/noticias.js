// ============================================================
// MACEDO & REIS — O feed de notícias na tela (20/10/2026, pedido do Samuel: "um feed no nosso sistema, com atualizações
// que tenham relação com nossos clientes … precisamos ser avisados de mudanças, impossível acompanhar tudo")
// A coleta e a triagem são da Edge Function noticias (de hora em hora, supabase/functions/noticias): a IA lê cada notícia
// das fontes, diz se interessa, de que setor é, por que importa, o que fazer e quais clientes da carteira ela alcança; a
// mesma notícia de outras fontes vira um grupo (noticias.grupo = a principal).
// Aqui ficam as regras da tela, as mesmas na aba "Notícias" do balão (montarNoticias, montada pelo assistente-escritorio.js
// em op.abas do assistente.js), na página noticias.html e no card do Painel:
//   - de que setor é cada pessoa: o aviso vai pro setor da notícia e pros sócios (decisão do Samuel, 20/10/2026) —
//     setoresDe: os sócios (e quem não está na lista) veem tudo;
//   - "pra mim": triada, Importante ou Vale saber, de um setor meu (paraMim);
//   - "nova": triada depois do meu "visto" (noticias_visto, cada um o seu; sem visto, os últimos 3 dias) e publicada nos
//     últimos 3 dias (a semana que a primeira coleta trouxe não chega como novidade);
//   - o grupo: só a principal aparece, com as outras fontes em "Também em" (agrupar).
// O número da aba não soma no balão (ctl.contador(n, { balao: false })): o do balão é o das mensagens do chat.
// O recado da carinha: a Importante nova, uma vez por notícia nesta máquina (localStorage mr_noticias_avisadas:<e-mail>),
// nunca no primeiro instante da tela (o recado do dia vem antes).
// Só lê (noticias, noticias_fontes) e grava o próprio visto. Testes: tests/noticias.test.mjs e tests/harness/noticias.py.
// ============================================================
import { SOCIOS } from './equipe.js';

export const SETORES = ['dp', 'fiscal', 'contabil', 'societario', 'irpf'];
export const ROTULO_SETOR = { dp: 'DP', fiscal: 'Fiscal', contabil: 'Contábil', societario: 'Societário', irpf: 'IRPF' };
export const ROTULO_RELEVANCIA = { alta: 'Importante', media: 'Vale saber', baixa: 'Pouco efeito' };
export const ROTULO_TIPO_FONTE = { oficial: 'Oficial', tribunal: 'Tribunal', imprensa: 'Imprensa', classe: 'Entidade de classe' };
// quem cuida de cada setor (o mesmo dono do vigia: DP Vitória, fiscal Thalia, contábil Adaini); os sócios veem tudo
export const SETORES_POR_EMAIL = { 'rh@macedoereis.com.br': ['dp'], 'fiscal@macedoereis.com.br': ['fiscal'], 'contabil@macedoereis.com.br': ['contabil'] };
export const JANELA_DIAS = 30;               // a aba mostra os últimos 30 dias
export const NOVA_DIAS = 3;                  // "nova": publicada nos últimos 3 dias (e sem visto ainda, os últimos 3 dias)
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
// a data que vale pra ordem e pro "novo": a da publicação; sem ela, a da coleta
export const quando = n => n.publicada_em || n.coletada_em || n.triada_em || '';
export const ordenar = lista => [...(lista || [])].sort((a, b) => String(quando(b)).localeCompare(String(quando(a))));
export const vistoPadrao = (agora = Date.now()) => new Date(agora - NOVA_DIAS * 864e5).toISOString();
export const ehNova = (n, vistoAte, agora = Date.now()) => !!(n && n.triada_em && Date.parse(n.triada_em) > Date.parse(vistoAte || 0)
  && Date.parse(quando(n)) >= agora - NOVA_DIAS * 864e5);
export const novasPraMim = (lista, email, vistoAte, agora = Date.now()) => (lista || []).filter(n => paraMim(n, email) && ehNova(n, vistoAte, agora));

// o grupo da mesma notícia: a principal (sem grupo) com as outras em .tambem; a que aponta pra uma que não veio (fora da
// janela) fica sozinha; a corrente (a principal que virou de grupo depois) vai até a raiz
export function agrupar(lista) {
  const porId = new Map((lista || []).map(n => [n.id, { ...n, tambem: [] }]));
  const raiz = n => { let x = n, i = 0; while (x.grupo && porId.has(x.grupo) && x.grupo !== x.id && i++ < 6) x = porId.get(x.grupo); return x; };
  const principais = [];
  for (const n of porId.values()) {
    const r = raiz(n);
    if (r === n) principais.push(n); else r.tambem.push(n);
  }
  principais.forEach(p => p.tambem.sort((a, b) => String(quando(a)).localeCompare(String(quando(b)))));
  return ordenar(principais);
}

const pad = x => String(x).padStart(2, '0');
const DIA = x => x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate());
// "hoje, 14:10" · "ontem" · "19/10" · "19/10/2025" (no fuso de quem olha)
export function dataCurta(iso, agora = new Date()) {
  const d = new Date(iso);
  if (!iso || isNaN(d)) return '';
  if (DIA(d) === DIA(agora)) return 'hoje, ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  const ontem = new Date(agora); ontem.setDate(ontem.getDate() - 1);
  if (DIA(d) === DIA(ontem)) return 'ontem';
  return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + (d.getFullYear() !== agora.getFullYear() ? '/' + d.getFullYear() : '');
}
const SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
// o separador do dia na página: "Hoje" · "Ontem" · "Sexta-feira, 16 de outubro"
export function rotuloDoDia(iso, agora = new Date()) {
  const d = new Date(iso);
  if (!iso || isNaN(d)) return 'Sem data';
  if (DIA(d) === DIA(agora)) return 'Hoje';
  const ontem = new Date(agora); ontem.setDate(ontem.getDate() - 1);
  if (DIA(d) === DIA(ontem)) return 'Ontem';
  const s = SEMANA[d.getDay()];
  return s[0].toUpperCase() + s.slice(1) + ', ' + d.getDate() + ' de ' + MESES[d.getMonth()] + (d.getFullYear() !== agora.getFullYear() ? ' de ' + d.getFullYear() : '');
}
export const chaveDoDia = iso => { const d = new Date(iso); return iso && !isNaN(d) ? DIA(d) : ''; };
export const plural = (n, um, varios) => n + ' ' + (n === 1 ? um : varios);
const hora = iso => { const d = new Date(iso); return iso && !isNaN(d) ? pad(d.getHours()) + ':' + pad(d.getMinutes()) : ''; };

// ---------- o banco ----------
const CAMPOS = 'id, fonte_id, url, titulo, publicada_em, coletada_em, triada_em, situacao, relevancia, setores, resumo, por_que, acao, clientes, grupo';
// as triadas da janela (e as descartadas, pra conferir a IA), já agrupadas; as fontes com o estado da última coleta
export async function lerNoticias(supabase, { dias = JANELA_DIAS, descartadas = false, limite = 1000 } = {}) {
  const desde = new Date(Date.now() - dias * 864e5).toISOString();
  let q = supabase.from('noticias').select(CAMPOS).gte('coletada_em', desde).order('coletada_em', { ascending: false }).limit(limite);
  q = descartadas ? q.in('situacao', ['triada', 'descartada']) : q.eq('situacao', 'triada');
  const [r1, r2] = await Promise.all([q, supabase.from('noticias_fontes').select('id, nome, tipo, site, url, ativo, ultima_coleta, ultimo_ok, ultimo_erro, itens_ultima')]);
  if (r1.error) throw r1.error;
  const fontes = (r2.data || []).sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
  const porId = new Map(fontes.map(f => [f.id, f]));
  const todas = (r1.data || []).map(n => ({ ...n, fonte: porId.get(n.fonte_id) || null }));
  // a descartada não entra no grupo de uma triada (e vice-versa): o grupo é só entre as que a IA disse que interessam
  const triadas = agrupar(todas.filter(n => n.situacao === 'triada'));
  const fora = todas.filter(n => n.situacao === 'descartada').map(n => ({ ...n, tambem: [] }));
  return { noticias: ordenar([...triadas, ...fora]), fontes, ultimaColeta: fontes.reduce((m, f) => (f.ultima_coleta && f.ultima_coleta > m ? f.ultima_coleta : m), '') || null };
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
// op: { nova, compacto (a aba do balão: sem o "por que importa", que fica na página), linkClientes (onde ver os clientes;
//       sem ele, o botão que abre a lista na própria página: data-clientes) }
export function cartaoHtml(n, { nova = false, compacto = false, linkClientes = null, agora = new Date() } = {}) {
  const url = linkSeguro(n.url);
  const fonte = n.fonte ? n.fonte.nome : 'Fonte';
  const fora = n.situacao === 'descartada';
  const rel = fora ? '<span class="fd-rel">Descartada pela IA</span>' : '<span class="fd-rel">' + escHtml(ROTULO_RELEVANCIA[n.relevancia] || 'Pouco efeito') + '</span>';
  const setores = (n.setores || []).map(s => '<span class="fd-setor">' + escHtml(ROTULO_SETOR[s] || s) + '</span>').join('');
  const data = dataCurta(quando(n), agora);
  const titulo = url ? '<a class="fd-titulo" href="' + escHtml(url) + '" target="_blank" rel="noopener noreferrer">' + escHtml(n.titulo) + '</a>' : '<span class="fd-titulo">' + escHtml(n.titulo) + '</span>';
  const qtd = (n.clientes || []).length, txtQtd = 'Alcança ' + plural(qtd, 'cliente', 'clientes') + ' da carteira';
  const clientes = fora ? '' : '<div class="fd-clientes">' + (!qtd ? '<span>Nenhum cliente em particular</span>'
    : linkClientes ? '<a href="' + escHtml(linkClientes) + '">' + escHtml(txtQtd) + '</a>'
    : '<button type="button" class="fd-ver-clientes" data-clientes="' + escHtml(n.id) + '" aria-expanded="false">' + escHtml(txtQtd) + '</button>') + '</div>'
    + (!linkClientes && qtd ? '<div class="fd-lista-clientes" data-de="' + escHtml(n.id) + '" hidden></div>' : '');
  const tambem = (n.tambem || []).filter(t => linkSeguro(t.url));
  const linhaTambem = tambem.length ? '<div class="fd-tambem">Também em: ' + tambem.map(t => '<a href="' + escHtml(linkSeguro(t.url)) + '" target="_blank" rel="noopener noreferrer">'
    + escHtml(t.fonte ? t.fonte.nome : 'outra fonte') + '</a>').join(', ') + '</div>' : '';
  return '<article class="fd-item fd-' + (fora ? 'fora' : escHtml(n.relevancia || 'baixa')) + (nova ? ' fd-e-nova' : '') + '" data-id="' + escHtml(n.id) + '">'
    + '<div class="fd-meta">' + rel + setores + '<span class="fd-fonte">' + escHtml(fonte) + (data ? ', <time datetime="' + escHtml(quando(n)) + '">' + escHtml(data) + '</time>' : '') + '</span>'
    + (nova ? '<span class="fd-novo">nova</span>' : '') + '</div>'
    + titulo
    + (n.resumo ? '<p class="fd-resumo">' + escHtml(n.resumo) + '</p>' : '')
    + (n.por_que && !compacto ? '<p class="fd-porque"><b>Por que importa:</b> ' + escHtml(n.por_que) + '</p>' : '')
    + (n.acao ? '<p class="fd-acao"><b>O que fazer:</b> ' + escHtml(n.acao) + '</p>' : '')
    + clientes + linhaTambem + '</article>';
}

// ---------- o recado (a Importante nova) ----------
const CHAVE_AVISADAS = email => 'mr_noticias_avisadas:' + String(email || '').toLowerCase();
const lerAvisadas = email => { try { const v = JSON.parse(localStorage.getItem(CHAVE_AVISADAS(email)) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
const guardarAvisadas = (email, ids) => { try { localStorage.setItem(CHAVE_AVISADAS(email), JSON.stringify(ids.slice(-200))); } catch { /* sem armazenamento: avisa de novo */ } };
// a Importante nova pra mim que esta máquina ainda não avisou
export function paraAvisar(lista, email, vistoAte, avisadas = [], agora = Date.now()) {
  return novasPraMim(lista, email, vistoAte, agora).filter(n => n.relevancia === 'alta' && !avisadas.includes(n.id));
}

// ---------- a aba "Notícias" do balão ----------
export function montarNoticias({ supabase, email, el, ctl, intervaloMs = 10 * 60e3, esperaRecadoMs = 25000 }) {
  let noticias = [], visto = null, filtro = 'mim', carregadoEm = 0, erro = null, timerVisto = null, novasNaTela = new Set(), ultimaColeta = null;
  const montadoEm = Date.now();
  const pagina = new URL('noticias.html', RAIZ).href;
  el.classList.add('fd-aba');
  el.innerHTML = '<div class="fd-aba-topo"><div class="fd-filtro" role="group" aria-label="Quais notícias">'
    + '<button type="button" data-f="mim" aria-pressed="true">Pra você</button><button type="button" data-f="todas" aria-pressed="false">Todas</button></div>'
    + '<a class="fd-ver-pagina" href="' + escHtml(pagina) + '">Abrir a página</a></div>'
    + '<div class="fd-aba-rolar"><div class="fd-aba-lista"><div class="fd-vazio">Lendo as notícias…</div></div></div>';
  const lista = el.querySelector('.fd-aba-lista'), rolar = el.querySelector('.fd-aba-rolar');
  el.querySelector('.fd-filtro').addEventListener('click', e => {
    const b = e.target.closest('[data-f]');
    if (!b) return;
    filtro = b.dataset.f;
    el.querySelectorAll('.fd-filtro [data-f]').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    desenhar(); rolar.scrollTop = 0;
  });
  const triadas = () => noticias.filter(n => n.situacao === 'triada');
  const visiveis = () => (filtro === 'mim' ? triadas().filter(n => paraMim(n, email)) : triadas()).slice(0, 60);
  const novas = () => novasPraMim(triadas(), email, visto || vistoPadrao());
  function desenhar() {
    if (erro && !noticias.length) { lista.innerHTML = '<div class="fd-vazio">Não consegui ler as notícias agora. Tento de novo daqui a pouco.</div>'; return; }
    const vs = visiveis();
    if (!vs.length) {
      lista.innerHTML = '<div class="fd-vazio">' + (!carregadoEm ? 'Lendo as notícias…' : filtro === 'mim'
        ? 'Nada importante pro seu setor nos últimos ' + JANELA_DIAS + ' dias. Em "Todas" estão as outras.'
        : 'Nenhuma notícia nos últimos ' + JANELA_DIAS + ' dias.') + '</div>';
      return;
    }
    lista.innerHTML = vs.map(n => cartaoHtml(n, { nova: novasNaTela.has(n.id), compacto: true, linkClientes: pagina + '?n=' + encodeURIComponent(n.id) })).join('');
  }
  function contar() {
    ctl.contador(ctl.ativa() ? 0 : novas().length, { balao: false });
    ctl.status();
  }
  // a aba aberta: o que está na tela já foi visto (o "nova" fica marcado enquanto ela está aberta)
  function verAgora() {
    clearTimeout(timerVisto);
    timerVisto = setTimeout(async () => {
      if (!ctl.ativa()) return;
      const agora = new Date().toISOString();
      if (await marcarVisto(supabase, email, agora)) { visto = agora; guardarAvisadas(email, [...lerAvisadas(email), ...triadas().filter(n => n.relevancia === 'alta').map(n => n.id)]); contar(); }
    }, 1500);
  }
  async function carregar() {
    try {
      const [r, v] = await Promise.all([lerNoticias(supabase), lerVisto(supabase, email)]);
      noticias = r.noticias; ultimaColeta = r.ultimaColeta; visto = v; erro = null; carregadoEm = Date.now();
    } catch (e) { erro = e; }
    novasNaTela = new Set(novas().map(n => n.id));
    desenhar(); contar();
    if (ctl.ativa()) verAgora();
    // o recado: nunca nos primeiros segundos da tela (o recado do dia vem antes)
    const falta = montadoEm + esperaRecadoMs - Date.now();
    if (falta > 0) setTimeout(avisarImportantes, falta); else avisarImportantes();
  }
  function avisarImportantes() {
    if (ctl.ativa() || document.visibilityState === 'hidden') return;
    const avisadas = lerAvisadas(email);
    const lista = paraAvisar(triadas(), email, visto || vistoPadrao(), avisadas);
    if (!lista.length) return;
    const n = lista[0];
    const ok = ctl.avisar({
      html: '<p><b>Notícia importante</b>, ' + escHtml(n.fonte ? n.fonte.nome : 'fonte') + '</p><p>' + escHtml(n.titulo) + '</p>'
        + (n.por_que ? '<p>' + escHtml(n.por_que) + '</p>' : '') + (lista.length > 1 ? '<p>' + escHtml('E mais ' + plural(lista.length - 1, 'importante nova', 'importantes novas') + '.') + '</p>' : ''),
      botoes: [{ rotulo: 'Ver as notícias', acao: () => ctl.mostrar() }], ms: 20000
    });
    // avisou: estas não avisam de novo nesta máquina (o recado ocupado fica pra próxima leitura)
    if (ok) guardarAvisadas(email, [...avisadas, ...lista.map(x => x.id)]);
  }
  carregar();
  const timer = setInterval(carregar, intervaloMs);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - carregadoEm > 2 * 60e3) carregar(); });
  return {
    aoMostrar() { desenhar(); verAgora(); contar(); },
    aoEsconder() { clearTimeout(timerVisto); novasNaTela = new Set(novas().map(n => n.id)); desenhar(); },
    status() {
      const k = novasNaTela.size || novas().length;
      const quandoTxt = ultimaColeta ? 'atualizado ' + (dataCurta(ultimaColeta).startsWith('hoje') ? 'às ' + hora(ultimaColeta) : dataCurta(ultimaColeta)) : '';
      if (!carregadoEm) return 'Lendo as notícias…';
      return (k ? plural(k, 'nova pra você', 'novas pra você') : 'O que muda pros clientes') + (quandoTxt ? ', ' + quandoTxt : '');
    },
    recarregar: carregar,
    parar() { clearInterval(timer); }
  };
}
