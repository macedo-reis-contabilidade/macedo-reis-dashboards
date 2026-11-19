// =====================================================================
// MACEDO & REIS — As telas das Integrações (19/11/2026, pedido do Samuel: "um módulo pra cada uma dessas integrações, e
// dentro a listagem das nossas empresas onde clicando abrimos o 'perfil' dela com as informações mais importantes")
// Um módulo só pras duas telas (integracao-dominio.html e integracao-receita.html), que são páginas curtas chamando
// initIntegracao({ tipo: 'dominio' | 'receita' }). Cada tela tem: o que a integração faz e quando rodou por último, a
// lista das empresas de hoje da carteira (os números do alto filtram, os títulos ordenam, a busca acha) e o perfil da
// empresa (clicar na linha; o endereço ganha ?empresa=<id> e o Voltar do navegador funciona).
// Só leitura. As regras e as leituras ficam em assets/js/integracoes.js; o perfil do Domínio usa a mesma peça da ficha
// da empresa (assets/js/dominio-ficha.js). Tudo que vem do banco entra escapado.
// Testes: tests/integracoes.test.mjs (as regras) e tests/harness/integracoes.py (as telas).
// =====================================================================
import { supabase, getCurrentUser, signOut } from './supabase.js';
import { formatDocumento, hojeLocal } from './utils.js';
import { htmlDoDominio } from './dominio-ficha.js';
import { oRelatorio, diaEmBrasilia } from './receita-ficha.js';
import { textoDoAndamento, textoDasOrigens } from './contabil-controle.js';
import { fmtHoras } from './jornada-6x1.js';
import { assistenteDaTela } from './assistente-escritorio.js';
import {
  dataBR, diaMes, mesBR, inteiro, dinheiro, plural, rotuloDoDia, emFechamento, ultimoMesFechado,
  lerSaude, TETO_MES, CONSULTAS, proximasConsultas, BLOCOS_DO_DOMINIO,
  carregarCarteira, carregarListaDominio, carregarListaReceita, carregarPerfilDominio, carregarPerfilReceita,
  linhasDoDominio, mesesDoDominio, FOCOS_DOMINIO, focosDominio, linhasDaReceita, FOCOS_RECEITA, focosReceita,
  contarFocos, filtrar, ordenar, proximaOrdem, procuracaoDe, procuracoesPorVia, DE_QUEM, foraDaConsulta, tipoDoFiltro, totaisDasGuias, anosDasGuias, MESES_NO_PERFIL
} from './integracoes.js';

const ESTILO = `
  .ig-hoje { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:12px; margin:-10px 0 16px; }
  .ig-tile { background:var(--fill-1); border:1px solid var(--line); border-radius:14px; padding:14px 16px; display:flex; flex-direction:column; gap:4px; min-width:0; }
  .ig-tile b { font-size:1.02rem; font-weight:700; color:var(--text); line-height:1.3; font-variant-numeric:tabular-nums; }
  .ig-tile small { font-size:12.5px; color:var(--text-muted); line-height:1.45; }
  .ig-st { display:flex; align-items:center; gap:9px; }
  .ig-ponto { width:9px; height:9px; border-radius:50%; background:var(--ok); flex:none; }
  .ig-tile[data-estado="atrasada"] .ig-ponto { background:var(--warn); }
  .ig-tile[data-estado="parada"] .ig-ponto, .ig-tile[data-estado="erro"] .ig-ponto { background:var(--err); }
  .ig-tile[data-estado="nunca"] .ig-ponto, .ig-tile[data-estado="lendo"] .ig-ponto { background:var(--text-dim); }
  .ig-barra { height:6px; border-radius:999px; background:var(--fill-3); overflow:hidden; margin:3px 0 1px; }
  .ig-barra i { display:block; height:100%; border-radius:999px; background:var(--brand-primary); }
  .ig-barra.is-perto i { background:var(--warn); }

  .ig-sobre { border:1px solid var(--line); border-radius:14px; background:var(--surface); margin-bottom:24px; }
  .ig-sobre > summary { cursor:pointer; padding:13px 18px; font-weight:600; font-size:.95rem; color:var(--text); list-style:none; display:flex; align-items:center; gap:10px; border-radius:14px; }
  .ig-sobre > summary::-webkit-details-marker { display:none; }
  .ig-sobre > summary::before { content:'›'; font-size:1.2rem; line-height:1; color:var(--brand-light); transition:transform .15s ease; }
  .ig-sobre[open] > summary::before { transform:rotate(90deg); }
  .ig-sobre > summary:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
  .ig-sobre > summary small { font-weight:400; color:var(--text-muted); font-size:12.5px; }
  .ig-sobre-corpo { padding:0 18px 18px; }
  .ig-cartoes { display:grid; grid-template-columns:repeat(5, minmax(0, 1fr)); gap:10px; }
  .ig-cartao { background:var(--fill-1); border:1px solid var(--line); border-radius:12px; padding:12px 14px 13px; display:flex; flex-direction:column; gap:6px; min-width:0; }
  .ig-cartao h4 { margin:0; font:600 13.5px/1.4 var(--font-body); color:var(--text); }
  .ig-cartao p { margin:0; font-size:12.5px; line-height:1.5; color:var(--text-2); }
  .ig-cartao .ig-quando { color:var(--text-muted); }
  .ig-cartao .ig-prox { margin-top:auto; padding-top:6px; color:var(--text-muted); }
  .ig-cartao .ig-prox b { color:var(--text); font-variant-numeric:tabular-nums; }
  .ig-nota { margin:12px 0 0; font-size:12.5px; color:var(--text-muted); line-height:1.55; }
  .ig-onde { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-top:14px; font-size:13px; color:var(--text-muted); }
  .ig-chip { display:inline-flex; align-items:center; padding:5px 12px; border-radius:999px; border:1px solid var(--line); background:var(--fill-1); color:var(--brand-pale); font-size:12.5px; text-decoration:none; }
  a.ig-chip:hover { border-color:var(--line-strong); color:var(--text); }
  span.ig-chip { color:var(--text-muted); }

  .ig-focos { display:grid; grid-template-columns:repeat(var(--n, 5), minmax(0, 1fr)); gap:12px; margin-bottom:20px; }
  .ig-foco { background:var(--fill-1); border:1px solid var(--line); border-radius:14px; padding:14px 16px; cursor:pointer; text-align:left; display:flex; flex-direction:column; gap:4px; color:inherit; font:inherit; transition:border-color .15s, background .15s; min-width:0; }
  .ig-foco:hover { border-color:rgba(138,174,200,.4); }
  .ig-foco:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
  .ig-foco[aria-pressed="true"] { border-color:var(--brand-primary); background:rgba(70,130,200,.10); }
  .ig-foco-num { font-size:24px; font-weight:700; color:var(--text); line-height:1; font-variant-numeric:tabular-nums; }
  .ig-foco-lbl { font-size:12px; color:var(--text-muted); }
  .ig-foco[data-zero] .ig-foco-num { color:var(--text-dim); }

  .ig-toolbar { display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:16px; }
  .ig-toolbar .input-search { flex:1 1 260px; min-width:200px; max-width:360px; }
  .ig-toolbar label { display:inline-flex; align-items:center; gap:8px; font-size:13px; color:var(--text-muted); }
  .ig-toolbar .select { width:auto; min-width:190px; padding-top:9px; padding-bottom:9px; font-size:13.5px; }
  .ig-conta { margin-left:auto; font-size:13px; color:var(--text-muted); }

  .ig-tab thead th { padding:12px 16px; white-space:nowrap; }
  .ig-tab tbody td { padding:12px 16px; vertical-align:top; }
  .ig-tab .ig-num, .ig-tab th.ig-num { text-align:right; font-variant-numeric:tabular-nums; }
  .ig-ordem { background:none; border:0; padding:0; margin:0; font:inherit; color:inherit; text-transform:inherit; letter-spacing:inherit; cursor:pointer; display:inline-flex; align-items:center; gap:5px; white-space:nowrap; }
  .ig-ordem:hover, th[aria-sort="ascending"] .ig-ordem, th[aria-sort="descending"] .ig-ordem { color:var(--text); }
  .ig-ordem:focus-visible { outline:2px solid var(--accent); outline-offset:3px; border-radius:4px; }
  th.ig-num .ig-ordem { flex-direction:row-reverse; }
  .ig-seta::after { content:'▲'; font-size:9px; opacity:0; }
  th[aria-sort="ascending"] .ig-seta::after { content:'▲'; opacity:1; color:var(--accent); }
  th[aria-sort="descending"] .ig-seta::after { content:'▼'; opacity:1; color:var(--accent); }
  .ig-nome { font-weight:600; color:var(--text); text-decoration:none; }
  .ig-tab tbody tr:hover .ig-nome, .ig-nome:focus-visible { color:var(--brand-light); }
  .ig-nome:focus-visible { outline:2px solid var(--accent); outline-offset:2px; border-radius:3px; }
  .ig-tab .table-sub { line-height:1.5; }
  .ig-tab td small { display:block; font-size:12px; color:var(--text-muted); margin-top:1px; white-space:nowrap; }
  .ig-tab td.ig-junto { white-space:nowrap; }
  .ig-nd { color:var(--text-dim); }
  .ig-ok { color:var(--ok); }
  .ig-alerta { color:var(--warn); }
  .ig-erro { color:var(--err); }
  .ig-apagado { color:var(--text-dim); }
  .ig-vigia { display:inline-flex; align-items:center; gap:5px; margin-left:8px; padding:1px 9px; border-radius:999px; font-size:11.5px; font-weight:600; color:var(--warn); border:1px solid color-mix(in srgb, var(--warn) 45%, transparent); white-space:nowrap; }
  .ig-vigia[data-alta] { color:var(--err); border-color:color-mix(in srgb, var(--err) 50%, transparent); }
  .ig-etiqueta { display:inline-flex; align-items:center; margin-left:6px; padding:1px 8px; border-radius:999px; font-size:11.5px; color:var(--text-muted); border:1px solid var(--line-strong); white-space:nowrap; }
  .ig-vazio { text-align:center; padding:56px 20px; color:var(--text-muted); }
  .ig-erro-geral { color:var(--err); padding:24px 0; }

  .ig-no-perfil .page-header { margin-bottom:22px; }
  .ig-no-perfil .page-header .eyebrow, .ig-no-perfil .page-header h1, .ig-no-perfil .page-header p { display:none; }
  .ig-perfil-topo { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; margin:0 0 20px; }
  .ig-nav { display:flex; align-items:center; gap:10px; font-size:13px; color:var(--text-muted); }
  .ig-perfil-cab { display:flex; align-items:flex-end; justify-content:space-between; gap:16px 24px; flex-wrap:wrap; margin-bottom:20px; }
  .ig-perfil-cab h2 { margin:0 0 6px; font-size:1.7rem; text-wrap:balance; }
  .ig-perfil-sub { margin:0; color:var(--text-muted); font-size:.9rem; line-height:1.5; }
  .ig-perfil-links { display:flex; gap:8px; flex-wrap:wrap; }
  .ig-secoes { display:grid; gap:16px; }
  .ig-secoes > * { min-width:0; }
  .ig-duas { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:16px; align-items:start; }
  .ig-duas.ig-igual { align-items:stretch; }
  .ig-pilha { display:grid; gap:16px; min-width:0; }
  .ig-estreita { max-width:780px; }
  .ig-sec { background:var(--surface); border:1px solid var(--line); border-radius:16px; padding:18px 20px 20px; min-width:0; }
  .ig-sec > h3 { margin:0 0 12px; font:600 1rem/1.3 var(--font-body); color:var(--text); display:flex; align-items:baseline; gap:10px; flex-wrap:wrap; }
  .ig-sec > h3 small { font-weight:400; font-size:12.5px; color:var(--text-muted); }
  .ig-sec p { margin:0 0 8px; font-size:13.5px; line-height:1.55; color:var(--text-2); }
  .ig-sec p:last-child { margin-bottom:0; }
  .ig-sec .ig-forte { font-size:1.02rem; font-weight:600; color:var(--text); }
  .ig-sec ul { margin:0; padding-left:18px; font-size:13.5px; line-height:1.6; color:var(--text-2); }
  .ig-sec .field-help { line-height:1.55; }
  .ig-sec-avisos { border-color:color-mix(in srgb, var(--warn) 40%, transparent); background:color-mix(in srgb, var(--warn) 6%, var(--surface)); }
  .ig-aviso { padding:9px 0; border-top:1px solid var(--line); font-size:13.5px; line-height:1.5; }
  .ig-aviso:first-of-type { border-top:0; padding-top:0; }
  .ig-aviso b { color:var(--text); }
  .ig-aviso span { display:block; color:var(--text-2); }
  .ig-aviso small { color:var(--text-muted); }
  .ig-rola { overflow-x:auto; }
  .ig-perfil .hist-tbl { width:100%; border-collapse:collapse; font-size:13px; }
  .ig-perfil .hist-tbl th { text-align:left; color:var(--text-muted); font-size:11px; text-transform:uppercase; letter-spacing:.04em; font-weight:600; padding:8px 10px; border-bottom:1px solid var(--fill-3); white-space:nowrap; }
  .ig-perfil .hist-tbl td { padding:9px 10px; border-bottom:1px solid var(--line); color:var(--text); vertical-align:top; }
  .ig-perfil .hist-tbl tbody tr:hover td { background:var(--fill-1); }
  .ig-perfil .hist-tbl .ig-num { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
  .ig-perfil .hist-tbl td small { display:block; font-size:11.5px; color:var(--text-muted); margin-top:1px; }
  .ig-msg { display:flex; gap:12px; padding:8px 0; border-top:1px solid var(--line); font-size:13.5px; line-height:1.5; }
  .ig-msg:first-child { border-top:0; }
  .ig-msg time { flex:none; width:86px; color:var(--text-muted); font-variant-numeric:tabular-nums; }
  .ig-msg b { color:var(--warn); font-weight:600; white-space:nowrap; }
  .ig-filtros { display:flex; flex-wrap:wrap; gap:8px 18px; align-items:center; margin-bottom:12px; }
  .ig-seg { display:inline-flex; border:1px solid var(--line); border-radius:10px; overflow:hidden; }
  .ig-seg button { background:none; border:0; padding:6px 12px; font:500 12.5px var(--font-body); color:var(--text-muted); cursor:pointer; }
  .ig-seg button + button { border-left:1px solid var(--line); }
  .ig-seg button[aria-pressed="true"] { background:var(--sel); color:var(--text); }
  .ig-seg button:focus-visible { outline:2px solid var(--accent); outline-offset:-2px; }
  .ig-total { font-size:13px; color:var(--text-muted); margin-left:auto; }
  .ig-total b { color:var(--text); font-variant-numeric:tabular-nums; }
  .ig-guia { cursor:pointer; }
  .ig-guia td:first-child { white-space:nowrap; }
  .ig-abre { background:none; border:0; padding:0; font:inherit; color:inherit; cursor:pointer; display:inline-flex; align-items:center; gap:7px; }
  .ig-abre::before { content:'›'; color:var(--brand-light); font-size:1.1rem; line-height:1; transition:transform .15s ease; }
  .ig-abre[aria-expanded="true"]::before { transform:rotate(90deg); }
  .ig-abre:focus-visible { outline:2px solid var(--accent); outline-offset:3px; border-radius:4px; }
  .ig-resumo { max-width:420px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .ig-partes td { background:var(--fill-1); padding:4px 10px 14px 34px !important; }
  .ig-partes table { width:100%; border-collapse:collapse; font-size:12.5px; }
  .ig-partes th { text-align:left; font-size:11px; font-weight:600; color:var(--brand-light); padding:8px 8px 6px 0; }
  .ig-partes table td { padding:5px 8px 5px 0 !important; background:none !important; border-bottom:1px solid var(--line); color:var(--text-2); }
  .ig-partes p { margin:8px 0 0; font-size:12.5px; color:var(--text-muted); }
  .ig-lendo { padding:40px 0; color:var(--text-muted); }

  @media (max-width: 1100px) {
    .ig-focos { grid-template-columns:repeat(3, minmax(0, 1fr)); }
    .ig-cartoes { grid-template-columns:repeat(3, minmax(0, 1fr)); }
  }
  @media (max-width: 768px) {
    .ig-hoje, .ig-duas { grid-template-columns:1fr; }
    .ig-focos { grid-template-columns:repeat(2, minmax(0, 1fr)); }
    .ig-cartoes { grid-template-columns:1fr; }
    .ig-pilha { gap:16px; }
    .ig-conta { margin-left:0; width:100%; }
    .ig-sobre > summary small { display:none; }
    .ig-tab tbody td { padding:6px 0; }
    .ig-tab tbody td.ig-c-nome { display:block; padding-bottom:8px; }
    .ig-perfil .ig-rola .hist-tbl td { white-space:nowrap; }
    .ig-perfil .ig-rola .hist-tbl td.ig-quebra { white-space:normal; min-width:190px; }
    .ig-tab tbody td.ig-c-nome::before { display:none; }
    .ig-tab .ig-num { text-align:right; }
    .ig-tab tbody td > span, .ig-tab tbody td > div { text-align:right; }
    .ig-tab tbody td.ig-c-nome > div { text-align:left; }
    .ig-perfil-cab h2 { font-size:1.4rem; }
    .ig-sec { padding:16px; }
    .ig-msg time { width:74px; }
    .ig-total { margin-left:0; width:100%; }
    .ig-resumo { max-width:220px; }
  }
  @media (prefers-reduced-motion: reduce) { .ig-sobre > summary::before, .ig-abre::before, .ig-foco { transition:none; } }
`;

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const nd = titulo => '<span class="ig-nd"' + (titulo ? ' title="' + esc(titulo) + '"' : '') + '>—</span>';
const NOMES_MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

// o que muda de uma tela pra outra
const TELAS = {
  dominio: {
    nome: 'Domínio', titulo: 'Domínio', eyebrow: 'Integração',
    intro: 'O que a ponte lê sozinha do Domínio Web, empresa por empresa da carteira. Só leitura: nada é gravado lá.',
    busca: 'Buscar por empresa, CNPJ ou código do Domínio…',
    onde: [['Ficha da empresa', 'clientes/index.html'], ['Comparativo tributário', 'fiscal-comparativo.html'], ['Controle das contabilidades', 'contabil-controle.html'],
      ['Escala 6x1', 'dp-jornada.html'], ['Fator R', 'fator-r.html'], ['Carteira da Precificação', 'comercial-precificacao.html?aba=carteira'], ['Avisos do vigia', null], ['Assistente', null]],
    colunas: [['nome', 'Empresa', ''], ['funcionarios', 'Funcionários', 'ig-num'], ['faturamento', 'Faturamento', 'ig-num'], ['notas', 'Notas de saída · entrada', 'ig-num'], ['contador', 'Contador lançou até', 'ig-num']],
    exemplos: ['Como estão as notas e a folha desta empresa no Domínio?', 'O faturamento do Domínio bate com o PGDAS desta empresa?']
  },
  receita: {
    nome: 'Receita', titulo: 'Receita Federal', eyebrow: 'Integração · Integra Contador',
    intro: 'O que a ponte consulta sozinha na Receita, pelo Integra Contador, empresa por empresa da carteira. Só consulta: nada é transmitido.',
    busca: 'Buscar por empresa ou CNPJ…',
    onde: [['Ficha da empresa', 'clientes/index.html'], ['Comparativo tributário', 'fiscal-comparativo.html'], ['Fator R', 'fator-r.html'],
      ['Carteira da Precificação', 'comercial-precificacao.html?aba=carteira'], ['Avisos do vigia', null], ['Assistente', null]],
    colunas: [['nome', 'Empresa', ''], ['procuracao', 'Procuração', ''], ['pendencias', 'Situação fiscal', ''], ['pgdas', 'PGDAS e DAS', ''], ['mensagens', 'Caixa Postal', ''], ['guias', 'Guias pagas (12 meses)', 'ig-num']],
    exemplos: ['Quais pendências esta empresa tem na Receita?', 'O PGDAS e o DAS desta empresa estão em dia?']
  }
};

export async function initIntegracao(cfg) {
  const C = { raiz: 'igRaiz', ...cfg };
  const T = TELAS[C.tipo];
  if (!T) throw new Error('initIntegracao: informe o tipo (dominio ou receita)');
  const DOMINIO = C.tipo === 'dominio';
  const HOJE = hojeLocal();
  const FOCOS = DOMINIO ? FOCOS_DOMINIO : FOCOS_RECEITA;
  const focosDe = DOMINIO ? focosDominio : focosReceita;
  const $ = id => document.getElementById(id);
  const st = { empresas: [], base: null, linhas: [], foco: 'todas', busca: '', ordem: { coluna: 'nome', sentido: 'asc' }, mes: null, meses: [],
    visiveis: [], perfil: null, rolagem: 0, pedido: 0, veioDaLista: false, guias: { ano: 'todos', tipo: 'todas' } };

  // ---------- a estrutura da tela ----------
  if (!$('igCss')) { const s = document.createElement('style'); s.id = 'igCss'; s.textContent = ESTILO; document.head.appendChild(s); }
  const sobreAberto = (() => {
    let v = null;
    try { v = localStorage.getItem('mr_integ_sobre'); } catch (e) { v = null; }
    return v === '1' || (v !== '0' && window.innerWidth >= 768);
  })();
  $(C.raiz).innerHTML = `
    <div class="page-header">
      <div class="breadcrumb">
        <a href="index.html">Painel central</a><span class="breadcrumb-sep">/</span>
        <a href="integracoes.html">Integrações</a><span class="breadcrumb-sep">/</span>
        <span id="igMigalha"><span>${esc(T.nome)}</span></span>
      </div>
      <div class="eyebrow">${esc(T.eyebrow)}</div>
      <h1>${esc(T.titulo)}</h1>
      <p>${esc(T.intro)}</p>
    </div>
    <div id="igGeral">
      <section class="ig-hoje" id="igHoje" aria-label="Como a integração está hoje">
        <div class="ig-tile" data-estado="lendo"><span class="ig-st"><span class="ig-ponto"></span><b>Lendo…</b></span><small>&nbsp;</small></div>
        <div class="ig-tile"><b>&nbsp;</b><small>&nbsp;</small></div>
        <div class="ig-tile"><b>&nbsp;</b><small>&nbsp;</small></div>
      </section>
      <details class="ig-sobre" id="igSobre"${sobreAberto ? ' open' : ''}>
        <summary>O que esta integração faz <small>${DOMINIO ? 'o que lê, quando e onde aparece no sistema' : 'o que consulta, quando e onde aparece no sistema'}</small></summary>
        <div class="ig-sobre-corpo">${sobreHtml()}</div>
      </details>
      <div class="ig-focos" id="igFocos" style="--n:${FOCOS.length}" role="group" aria-label="Filtrar as empresas"></div>
      <div class="ig-toolbar">
        <input type="search" id="igBusca" class="input input-search" placeholder="${esc(T.busca)}" aria-label="Buscar empresa" autocomplete="off">
        ${DOMINIO ? '<label>Mês <select id="igMes" class="select" aria-label="O mês dos números da lista"></select></label>' : ''}
        <span class="ig-conta" id="igConta" aria-live="polite"></span>
      </div>
      <div class="table-wrap" id="igTabWrap">
        <table class="table ig-tab">
          <thead id="igCab"><tr>${T.colunas.map(([k, rot, cls]) => `<th data-col="${k}" class="${cls}" aria-sort="${k === 'nome' ? 'ascending' : 'none'}"><button type="button" class="ig-ordem" data-ordem="${k}">${esc(rot)}<span class="ig-seta" aria-hidden="true"></span></button></th>`).join('')}</tr></thead>
          <tbody id="igCorpo"><tr class="loading-row"><td colspan="${T.colunas.length}"><span class="spinner"></span>Lendo as empresas da carteira…</td></tr></tbody>
        </table>
      </div>
      <div class="ig-vazio" id="igVazio" hidden></div>
    </div>
    <div class="ig-perfil" id="igPerfil" hidden></div>`;

  function sobreHtml() {
    const chips = '<div class="ig-onde"><span>Onde isso aparece no sistema:</span>'
      + T.onde.map(([rot, href]) => (href ? '<a class="ig-chip" href="' + esc(href) + '">' + esc(rot) + '</a>' : '<span class="ig-chip">' + esc(rot) + '</span>')).join('') + '</div>';
    if (DOMINIO) {
      return '<div class="ig-cartoes">' + BLOCOS_DO_DOMINIO.map(b => '<div class="ig-cartao"><h4>' + esc(b.nome) + '</h4><p>' + esc(b.traz) + '</p></div>').join('') + '</div>'
        + '<p class="ig-nota">Roda todo dia às 7h, no PC do escritório, e lê de novo os últimos 14 meses, pra pegar o que entra atrasado no Domínio. '
        + 'O mês de hoje e o passado ainda estão em fechamento lá. Saem só os totais por empresa: nenhum dado de funcionário sai do Domínio.</p>' + chips;
    }
    const prox = new Map(proximasConsultas(HOJE).map(c => [c.chave, c.quando]));
    return '<div class="ig-cartoes">' + CONSULTAS.map(c => '<div class="ig-cartao" data-consulta="' + esc(c.chave) + '"><h4>' + esc(c.nome) + '</h4><p>' + esc(c.traz) + '</p><p class="ig-quando">' + esc(c.quando) + '</p>'
        + '<p class="ig-prox">Próxima: <b>' + esc(prox.get(c.chave) ? rotuloDoDia(prox.get(c.chave), HOJE) : '') + '</b></p></div>').join('') + '</div>'
      + '<p class="ig-nota">Roda de segunda a sexta às 8h30, no PC do escritório, com o certificado do escritório e a procuração de cada cliente. Com o PC desligado no dia marcado, '
      + 'a consulta roda na rodada seguinte. Cada consulta é paga: a ponte para no teto de ' + esc(inteiro(TETO_MES)) + ' por mês.</p>' + chips;
  }

  // ---------- quem entrou e o assistente ----------
  getCurrentUser().then(u => {
    if (!u) return;
    const n = (u.user_metadata && u.user_metadata.full_name) || (u.email || '').split('@')[0] || 'Usuário';
    if ($('userName')) $('userName').textContent = n;
    if ($('userAvatar')) $('userAvatar').textContent = n.charAt(0).toUpperCase();
  }).catch(() => {});
  if ($('btnLogout')) $('btnLogout').addEventListener('click', signOut);
  let assistente = null;
  try { assistente = assistenteDaTela({ exemplos: c => (c ? T.exemplos : null), seguintes: c => (c ? [T.exemplos[0]] : []), recadoContexto: () => null }); } catch (e) { assistente = null; }

  $('igSobre').addEventListener('toggle', () => { try { localStorage.setItem('mr_integ_sobre', $('igSobre').open ? '1' : '0'); } catch (e) { /* sem guardar */ } });

  // ---------- o alto: a saúde da ponte e os números do dia ----------
  function desenharHoje(saude) {
    const s = saude || { estado: 'erro', texto: 'Não consegui ler agora' }, r = s.rodada || {};
    const tiles = [];
    const saudeTile = (sub) => '<div class="ig-tile" data-estado="' + esc(s.estado) + '"><span class="ig-st"><span class="ig-ponto" aria-hidden="true"></span><b>' + esc(s.texto) + '</b></span><small>' + sub + '</small></div>';
    const nLinhas = st.linhas.length;
    if (DOMINIO) {
      tiles.push(saudeTile('Todo dia às 7h, no PC do escritório' + (r.dados_ate ? '. Dados até ' + esc(diaMes(r.dados_ate)) : '') + '.'));
      tiles.push('<div class="ig-tile"><b>' + (r.empresas != null ? esc(plural(r.empresas, 'empresa', 'empresas')) + ' no Domínio' : '—') + '</b><small>'
        + (r.ligadas != null ? esc(inteiro(r.ligadas)) + ' ligadas ao cadastro do sistema, pelo CNPJ ou CPF.' : '&nbsp;') + '</small></div>');
      const lig = st.linhas.filter(l => l.ligada).length, fora = nLinhas - lig;
      tiles.push('<div class="ig-tile"><b>' + (st.base ? esc(inteiro(lig)) + ' de ' + esc(inteiro(nLinhas)) + ' da carteira ligadas' : '—') + '</b><small>'
        + (st.base ? (fora ? esc(plural(fora, 'empresa', 'empresas')) + ' da carteira sem ligação com o Domínio.' : 'Todas as empresas da carteira estão ligadas.') : '&nbsp;') + '</small></div>');
    } else {
      tiles.push(saudeTile('De segunda a sexta às 8h30, no PC do escritório.'));
      const ch = s.chamadas, pct = ch != null ? Math.min(100, Math.round(ch / TETO_MES * 100)) : 0;
      tiles.push('<div class="ig-tile"><b>' + (ch != null ? esc(inteiro(ch)) + ' de ' + esc(inteiro(TETO_MES)) + ' consultas em ' + NOMES_MES[+HOJE.slice(5, 7) - 1] : 'Sem consulta em ' + NOMES_MES[+HOJE.slice(5, 7) - 1]) + '</b>'
        + '<div class="ig-barra' + (pct >= 90 ? ' is-perto' : '') + '" role="img" aria-label="' + pct + '% do teto do mês"><i style="width:' + pct + '%"></i></div>'
        + '<small>' + (pct >= 90 ? 'Perto do teto: a ponte para ao chegar nele.' : 'O Integra cobra por consulta: a ponte para no teto.') + '</small></div>');
      const cons = st.linhas.filter(l => l.procuracao.estado !== 'fora'), com = cons.filter(l => ['ativa', 'vencendo'].includes(l.procuracao.estado)).length;
      const sem = cons.filter(l => ['sem', 'vencida'].includes(l.procuracao.estado)).length, fora = nLinhas - cons.length;
      // de quem é a procuração: só quando a ponte já disse de alguma (até a 0.4.4 rodar, a linha não aparece)
      const via = procuracoesPorVia(st.linhas), deQuem = via.escritorio + via.procurador
        ? esc(inteiro(via.escritorio)) + ' pro CNPJ do escritório e ' + esc(inteiro(via.procurador)) + ' pro CPF do Diego' + (via.semDizer ? ' (' + esc(inteiro(via.semDizer)) + ' a ponte ainda não disse)' : '') : '';
      tiles.push('<div class="ig-tile"><b>' + (st.base ? esc(inteiro(com)) + ' de ' + esc(inteiro(cons.length)) + ' com procuração' : '—') + '</b><small>'
        + (st.base ? [deQuem, sem ? esc(inteiro(sem)) + ' sem procuração ou com ela vencida' : '', fora ? esc(inteiro(fora)) + ' fora da consulta' : ''].filter(Boolean).join(' · ') || 'Todas com procuração.' : '&nbsp;') + '</small></div>');
    }
    $('igHoje').innerHTML = tiles.join('');
  }

  // ---------- a lista ----------
  function rotuloDoFoco(k, rot) { return DOMINIO && k === 'sem_movimento' && st.mes ? 'Sem movimento em ' + mesBR(st.mes) : rot; }
  function desenharFocos() {
    const n = contarFocos(st.linhas, focosDe, FOCOS);
    $('igFocos').innerHTML = FOCOS.map(([k, rot]) => '<button type="button" class="ig-foco" data-foco="' + k + '" aria-pressed="' + (st.foco === k) + '"' + (n[k] ? '' : ' data-zero') + '>'
      + '<span class="ig-foco-num">' + esc(inteiro(n[k])) + '</span><span class="ig-foco-lbl">' + esc(rotuloDoFoco(k, rot)) + '</span></button>').join('');
  }
  function avisosHtml(avisos) {
    if (!avisos || !avisos.length) return '';
    const alta = avisos.some(a => a.gravidade === 'alta');
    return ' <span class="ig-vigia"' + (alta ? ' data-alta' : '') + ' title="' + esc(avisos.map(a => a.titulo).join(' · ')) + '">' + esc(plural(avisos.length, 'aviso', 'avisos')) + ' do vigia</span>';
  }
  function linhaDominioHtml(l) {
    const meta = [esc(l.regime || 'Sem regime')];
    if (!l.ligada) meta.push('<span class="ig-alerta">sem ligação com o Domínio</span>');
    else meta.push('cód. ' + l.codigos.map(esc).join(' e ') + (l.inativa ? ' <span class="ig-alerta">(inativa no Domínio)</span>' : ''));
    const semDado = l.ligada ? 'O Domínio não disse' : 'Sem ligação com o Domínio';
    const outroSimples = l.noSimples != null && l.faturamento != null && Math.abs(l.noSimples - l.faturamento) >= 1;
    const notas = l.notasSaida == null && l.notasEntrada == null ? nd(semDado)
      : (l.notasSaida == null ? '—' : esc(inteiro(l.notasSaida))) + ' · ' + (l.notasEntrada == null ? '—' : esc(inteiro(l.notasEntrada)));
    const contador = l.contadorAte ? esc(mesBR(l.contadorAte))
      : nd(!l.ligada ? semDado : l.leuOrigens ? 'Nenhum lançamento digitado, importado ou do extrato nos últimos 14 meses' : 'A ponte ainda não leu de onde vêm os lançamentos desta empresa');
    return '<tr class="is-clickable" data-id="' + esc(l.id) + '">'
      + '<td class="ig-c-nome"><a class="ig-nome" href="?empresa=' + encodeURIComponent(l.id) + '">' + esc(l.nome) + '</a><div class="table-sub">' + meta.join(' · ') + avisosHtml(l.avisos) + '</div></td>'
      + '<td class="ig-num" data-label="Funcionários">' + (l.funcionarios == null ? nd(semDado) : esc(inteiro(l.funcionarios))) + '</td>'
      + '<td class="ig-num" data-label="Faturamento"><div>' + (l.faturamento == null ? nd(semDado) : esc(dinheiro(l.faturamento)))
      + (outroSimples ? '<small>no Simples: ' + esc(dinheiro(l.noSimples)) + '</small>' : '') + '</div></td>'
      + '<td class="ig-num" data-label="Notas de saída · entrada">' + notas + '</td>'
      + '<td class="ig-num" data-label="Contador lançou até">' + contador + '</td></tr>';
  }
  const COR_DA_PROCURACAO = { ativa: '', vencendo: 'ig-alerta', vencida: 'ig-erro', sem: 'ig-alerta', nao_consultada: 'ig-apagado', fora: 'ig-apagado' };
  function linhaReceitaHtml(l) {
    const p = l.procuracao, fora = p.estado === 'fora';
    const pend = l.pendencias == null ? nd(fora ? '' : 'A situação fiscal ainda não foi consultada')
      : l.pendencias === 0 ? '<span class="ig-ok">sem pendência</span>' : '<span class="ig-erro">' + esc(plural(l.pendencias, 'pendência', 'pendências')) + '</span>';
    const pg = !l.simples ? nd(fora ? '' : 'Só as empresas do Simples têm PGDAS')
      : !l.pgdasAte ? nd('Nenhuma declaração na Receita neste ano')
        : '<div>declarado até ' + esc(mesBR(l.pgdasAte)) + (l.semPagamento.length
          ? '<small class="ig-alerta" title="' + esc(l.semPagamento.map(mesBR).join(', ')) + '">DAS sem pagamento: ' + esc(plural(l.semPagamento.length, 'mês', 'meses')) + '</small>' : '') + '</div>';
    const cx = l.naoLidas == null ? nd(fora ? '' : 'A Caixa Postal ainda não foi consultada')
      : l.naoLidas > 0 ? '<span class="ig-alerta">' + esc(plural(l.naoLidas, 'não lida', 'não lidas')) + '</span>' : l.mensagens ? '<span class="ig-apagado">tudo lido</span>' : '<span class="ig-apagado">sem mensagem</span>';
    const gs = l.guias12 == null ? nd(fora ? '' : 'Os pagamentos ainda não foram consultados')
      : '<div>' + esc(inteiro(l.guias12)) + (l.ultimaGuia ? '<small>última em ' + esc(diaMes(l.ultimaGuia)) + (l.ultimaGuia.slice(0, 4) !== HOJE.slice(0, 4) ? '/' + esc(l.ultimaGuia.slice(0, 4)) : '') + '</small>' : '') + '</div>';
    return '<tr class="is-clickable" data-id="' + esc(l.id) + '">'
      + '<td class="ig-c-nome"><a class="ig-nome" href="?empresa=' + encodeURIComponent(l.id) + '">' + esc(l.nome) + '</a><div class="table-sub">' + esc(l.regime || 'Sem regime') + avisosHtml(l.avisos) + '</div></td>'
      + '<td class="ig-junto" data-label="Procuração"><span class="' + COR_DA_PROCURACAO[p.estado] + '"' + (p.porque ? ' title="' + esc(p.porque) + '"' : '') + '>' + esc(p.texto) + '</span>'
      + (p.via ? '<small>' + esc(DE_QUEM[p.via]) + '</small>' : '') + '</td>'
      + '<td data-label="Situação fiscal">' + pend + '</td>'
      + '<td data-label="PGDAS e DAS">' + pg + '</td>'
      + '<td data-label="Caixa Postal">' + cx + '</td>'
      + '<td class="ig-num" data-label="Guias pagas (12 meses)">' + gs + '</td></tr>';
  }
  function desenharLista() {
    const filtradas = filtrar(st.linhas, focosDe, st.foco, st.busca);
    st.visiveis = ordenar(filtradas, C.tipo, st.ordem);
    document.querySelectorAll('#igCab th[data-col]').forEach(th => th.setAttribute('aria-sort', th.dataset.col === st.ordem.coluna ? (st.ordem.sentido === 'asc' ? 'ascending' : 'descending') : 'none'));
    $('igCorpo').innerHTML = st.visiveis.map(DOMINIO ? linhaDominioHtml : linhaReceitaHtml).join('');
    const vazio = !st.visiveis.length;
    $('igTabWrap').hidden = vazio; $('igVazio').hidden = !vazio;
    if (vazio) $('igVazio').textContent = st.busca.trim() ? 'Nenhuma empresa com "' + st.busca.trim() + '" neste filtro.' : 'Nenhuma empresa neste filtro.';
    const total = st.linhas.length;
    $('igConta').textContent = st.visiveis.length === total ? plural(total, 'empresa da carteira', 'empresas da carteira') : inteiro(st.visiveis.length) + ' de ' + plural(total, 'empresa', 'empresas');
  }
  function refazerLinhas() {
    st.linhas = DOMINIO ? linhasDoDominio(st.empresas, st.base, st.mes) : linhasDaReceita(st.empresas, st.base, HOJE);
  }
  function desenharMeses() {
    if (!DOMINIO) return;
    $('igMes').innerHTML = st.meses.map(m => '<option value="' + esc(m) + '"' + (m === st.mes ? ' selected' : '') + '>' + esc(mesBR(m)) + (emFechamento(m, HOJE) ? ' · em fechamento' : '') + '</option>').join('');
  }

  $('igFocos').addEventListener('click', e => {
    const b = e.target.closest('[data-foco]');
    if (!b) return;
    st.foco = b.dataset.foco; desenharFocos(); desenharLista();
  });
  $('igBusca').addEventListener('input', e => { st.busca = e.target.value; desenharLista(); });
  $('igCab').addEventListener('click', e => {
    const b = e.target.closest('[data-ordem]');
    if (!b) return;
    st.ordem = proximaOrdem(st.ordem, b.dataset.ordem); desenharLista();
  });
  if (DOMINIO) $('igMes').addEventListener('change', e => { st.mes = e.target.value; refazerLinhas(); desenharFocos(); desenharLista(); });
  $('igCorpo').addEventListener('click', e => {
    const tr = e.target.closest('tr[data-id]');
    if (!tr) return;
    const link = e.target.closest('a.ig-nome');
    if (link && (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1)) return;   // abrir em outra aba: o navegador cuida
    if (window.getSelection && String(window.getSelection())) return;              // selecionando texto da linha
    e.preventDefault();
    abrirPerfil(tr.dataset.id, true);
  });

  // ---------- o perfil ----------
  const idDoEndereco = () => { try { return new URLSearchParams(location.search).get('empresa'); } catch (e) { return null; } };
  function enderecoCom(id) { const u = new URL(location.href); if (id) u.searchParams.set('empresa', id); else u.searchParams.delete('empresa'); return u.pathname + u.search; }
  function abrirPerfil(id, empurrar) {
    if (empurrar) { st.rolagem = window.scrollY; st.veioDaLista = true; history.pushState({ empresa: id }, '', enderecoCom(id)); }
    mostrarPerfil(id);
  }
  function fecharPerfil() {
    if (st.veioDaLista && history.state && history.state.empresa) { history.back(); return; }   // o popstate mostra a lista
    history.replaceState(null, '', enderecoCom(null));
    mostrarLista();
  }
  function migalha(emp) {
    $(C.raiz).classList.toggle('ig-no-perfil', !!emp);
    $('igMigalha').innerHTML = emp ? '<a href="' + esc(enderecoCom(null)) + '" id="igMigalhaLista">' + esc(T.nome) + '</a><span class="breadcrumb-sep">/</span><span>' + esc(emp.nome) + '</span>' : '<span>' + esc(T.nome) + '</span>';
  }
  function mostrarLista() {
    st.perfil = null; migalha(null);
    $('igPerfil').hidden = true; $('igPerfil').innerHTML = ''; $('igGeral').hidden = false;
    if (assistente) assistente.definirContexto(null);
    window.scrollTo(0, st.rolagem || 0);
  }
  const sec = (titulo, corpo, extra = '') => '<section class="ig-sec' + (extra ? ' ' + extra : '') + '"><h3>' + titulo + '</h3>' + corpo + '</section>';
  function secAvisos(avisos) {
    return sec('O que o vigia está avisando desta empresa <small>' + esc(plural(avisos.length, 'aviso aberto', 'avisos abertos')) + '</small>',
      avisos.map(a => '<div class="ig-aviso"><b>' + esc(a.titulo) + '</b>' + (a.detalhe ? '<span>' + esc(a.detalhe) + '</span>' : '')
        + '<small>' + [a.gravidade === 'alta' ? 'Urgente' : '', a.responsavel ? 'com ' + esc(a.responsavel) : '', a.prazo ? 'prazo ' + esc(dataBR(a.prazo)) : ''].filter(Boolean).join(' · ') + '</small></div>').join(''), 'ig-sec-avisos');
  }
  function cabDoPerfil(emp) {
    const pos = st.visiveis.findIndex(l => l.id === emp.id), lista = pos >= 0 ? st.visiveis : st.linhas, i = lista.findIndex(l => l.id === emp.id);
    const ant = i > 0 ? lista[i - 1] : null, prox = i >= 0 && i < lista.length - 1 ? lista[i + 1] : null;
    const sub = [emp.fantasia && emp.razao && emp.fantasia !== emp.razao ? esc(emp.razao) : '', esc(emp.regime || 'Sem regime'), esc(formatDocumento(emp.documento) || ''),
      emp.cidade ? esc(emp.cidade) + (emp.uf ? '/' + esc(emp.uf) : '') : ''].filter(Boolean).join(' · ');
    const outra = DOMINIO ? ['integracao-receita.html', 'Ver na Receita'] : ['integracao-dominio.html', 'Ver no Domínio'];
    return '<div class="ig-perfil-topo"><button type="button" class="btn btn-ghost btn-sm" id="igVoltar">← Todas as empresas</button>'
      + '<div class="ig-nav"><button type="button" class="btn btn-ghost btn-sm" id="igAnt"' + (ant ? ' data-id="' + esc(ant.id) + '" title="' + esc(ant.nome) + '"' : ' disabled') + '>‹ Anterior</button>'
      + '<span>' + (i >= 0 ? esc(inteiro(i + 1)) + ' de ' + esc(inteiro(lista.length)) : '') + '</span>'
      + '<button type="button" class="btn btn-ghost btn-sm" id="igProx"' + (prox ? ' data-id="' + esc(prox.id) + '" title="' + esc(prox.nome) + '"' : ' disabled') + '>Próxima ›</button></div></div>'
      + '<header class="ig-perfil-cab"><div><h2>' + esc(emp.nome) + '</h2><p class="ig-perfil-sub">' + sub + '</p></div>'
      + '<div class="ig-perfil-links"><a class="btn btn-ghost btn-sm" href="clientes/editar.html?id=' + encodeURIComponent(emp.id) + '">Ficha da empresa</a>'
      + '<a class="btn btn-ghost btn-sm" href="' + outra[0] + '?empresa=' + encodeURIComponent(emp.id) + '">' + outra[1] + '</a></div></header>';
  }
  async function mostrarPerfil(id) {
    const emp = st.empresas.find(e => e.id === id);
    const pedido = ++st.pedido;
    st.perfil = id; migalha(emp || { nome: 'Empresa' });
    $('igGeral').hidden = true; $('igPerfil').hidden = false;
    window.scrollTo(0, 0);
    if (!emp) {
      $('igPerfil').innerHTML = '<div class="ig-perfil-topo"><button type="button" class="btn btn-ghost btn-sm" id="igVoltar">← Todas as empresas</button></div>'
        + '<div class="ig-secoes">' + sec('Empresa fora da carteira de hoje', '<p>Este módulo mostra só as empresas que estão hoje na carteira. Esta não está (saiu, ou o endereço está errado).</p>') + '</div>';
      return;
    }
    if (assistente) assistente.definirContexto({ id: 'cliente:' + id, tipo: 'cliente', clienteId: id, nome: emp.nome, rotulo: 'Sobre a empresa aberta', nota: 'Sobre ' });
    $('igPerfil').innerHTML = cabDoPerfil(emp) + '<div class="ig-lendo"><span class="spinner"></span>Lendo o que a ponte trouxe desta empresa…</div>';
    try {
      const p = DOMINIO ? await carregarPerfilDominio(supabase, id, HOJE) : await carregarPerfilReceita(supabase, id);
      if (pedido !== st.pedido) return;
      st.dados = p; st.guias = { ano: 'todos', tipo: 'todas' }; st.abertas = new Set();
      $('igPerfil').innerHTML = cabDoPerfil(emp) + '<div class="ig-secoes">' + (DOMINIO ? perfilDominioHtml(emp, p) : perfilReceitaHtml(emp, p)) + '</div>';
    } catch (e) {
      if (pedido !== st.pedido) return;
      $('igPerfil').innerHTML = cabDoPerfil(emp) + '<div class="ig-secoes">' + sec('Não consegui ler agora', '<p>' + esc((e && e.message) || e) + '</p><p><button type="button" class="btn btn-ghost btn-sm" id="igDeNovo">Tentar de novo</button></p>') + '</div>';
    }
  }

  // ----- o perfil no Domínio -----
  function perfilDominioHtml(emp, p) {
    const s = [];
    if (p.avisos.length) s.push(secAvisos(p.avisos));
    if (!p.empresas.length) {
      s.push(sec('Sem ligação com o Domínio', '<p>O sistema liga a empresa ao Domínio pelo CNPJ ou CPF do cadastro, e esta não foi achada lá. '
        + 'Confira o documento na ficha da empresa e se ela existe no Domínio: ligada, os números aparecem aqui na leitura seguinte.</p>'));
      return s.join('');
    }
    s.push(sec('Mês a mês <small>os últimos ' + MESES_NO_PERFIL + ' meses, como na ficha da empresa</small>', htmlDoDominio({ empresas: p.empresas, linhas: p.linhas }, HOJE)));
    const lado = [];
    if (emp.regime === 'Simples Nacional' || p.conferencia.length) lado.push(sec('Faturamento: o Domínio e o PGDAS', conferenciaHtml(p.conferencia)));
    if (p.jornadas.length) lado.push(sec('Jornada dos funcionários <small>' + (p.jornadaEm ? 'a foto de ' + esc(dataBR(p.jornadaEm)) : '') + '</small>', jornadaHtml(emp, p)));
    const contabil = sec('Contabilidade no Domínio', lado.length ? contabilHtml(emp, p) : '<div class="ig-estreita">' + contabilHtml(emp, p) + '</div>');
    s.push(lado.length ? '<div class="ig-duas">' + contabil + '<div class="ig-pilha">' + lado.join('') + '</div></div>' : contabil);
    return s.join('');
  }
  function conferenciaHtml(conf) {
    if (!conf.length) return '<p>A ponte da Receita ainda não leu a declaração do PGDAS de nenhum mês desta empresa: sem o declarado, não há o que pôr ao lado do Domínio.</p>';
    const dif = c => (c.diferenca == null ? nd('O Domínio não tem este mês entre os lidos') : c.igual ? '<span class="ig-ok">igual</span>'
      : '<span class="ig-alerta">' + esc(dinheiro(Math.abs(c.diferenca))) + (c.diferenca > 0 ? ' a mais no Domínio' : ' a menos no Domínio') + '</span>');
    return '<div class="ig-rola"><table class="hist-tbl"><thead><tr><th>Mês</th><th class="ig-num">Domínio</th><th class="ig-num">PGDAS (declarado)</th><th>Diferença</th></tr></thead><tbody>'
      + conf.map(c => '<tr><td>' + esc(mesBR(c.competencia)) + '</td><td class="ig-num">' + (c.dominio == null ? nd() : esc(dinheiro(c.dominio)) + '<small>' + (c.fonte === 'simples' ? 'apuração do Simples' : 'receita bruta das notas') + '</small>')
        + '</td><td class="ig-num">' + esc(dinheiro(c.declarado)) + '</td><td>' + dif(c) + '</td></tr>').join('') + '</tbody></table></div>'
      + '<div class="field-help" style="margin-top:10px;">O declarado é o da declaração do PGDAS que a ponte da Receita leu (hoje, a do mês mais recente de cada empresa). Igual = até R$ 1,00 de diferença. '
      + 'Quem avisa a diferença é o vigia, no mês já fechado, somando os estabelecimentos da empresa.</div>';
  }
  function contabilHtml(emp, p) {
    const linhas = textoDoAndamento(p.andamento, p.encerramentos);
    const meses = [...p.porMes.values()].sort((a, b) => b.competencia.localeCompare(a.competencia));
    const comOrigem = meses.some(m => m.lanc_fiscal != null);
    let h = linhas.length ? '<ul>' + linhas.map(l => '<li>' + esc(l) + '</li>').join('') + '</ul>' : '<p>A ponte ainda não leu o andamento da contabilidade desta empresa (o banco, o caixa, o extrato e o zeramento).</p>';
    if (comOrigem) {
      h += '<div class="ig-rola" style="margin-top:14px;"><table class="hist-tbl"><thead><tr><th>Mês</th><th class="ig-num">Lançamentos</th><th>De onde vieram</th></tr></thead><tbody>'
        + meses.map(m => '<tr><td>' + esc(mesBR(m.competencia)) + (emFechamento(m.competencia, HOJE) ? '<small>em fechamento</small>' : '') + '</td><td class="ig-num">' + (m.lancamentos == null ? nd() : esc(inteiro(m.lancamentos)))
          + '</td><td class="ig-quebra">' + (textoDasOrigens(m) ? esc(textoDasOrigens(m)) : '<span class="ig-nd">nenhum</span>') + '</td></tr>').join('') + '</tbody></table></div>';
    }
    return h + (p.noControle ? '<p style="margin-top:12px;"><a class="btn btn-ghost btn-sm" href="contabil-controle.html?empresa=' + encodeURIComponent(emp.id) + '">Abrir no Controle das contabilidades</a></p>' : '');
  }
  function jornadaHtml(emp, p) {
    return '<div class="ig-rola"><table class="hist-tbl"><thead><tr><th>Jornada</th><th>Escala</th><th class="ig-num">Horas por semana</th><th class="ig-num">Empregados</th></tr></thead><tbody>'
      + p.jornadas.map(j => '<tr><td class="ig-quebra">' + esc(j.jornada || 'Sem nome') + '</td><td>' + esc(j.escala) + '</td><td class="ig-num">' + esc(fmtHoras(j.horas)) + '</td><td class="ig-num">' + esc(inteiro(j.empregados))
        + (j.afastados ? '<small>' + esc(plural(j.afastados, 'afastado', 'afastados')) + '</small>' : '') + '</td></tr>').join('') + '</tbody></table></div>'
      + '<div class="field-help" style="margin-top:10px;">Somado por grupo de jornada: o nome e o CPF dos funcionários ficam no Domínio.</div>'
      + '<p style="margin-top:12px;"><a class="btn btn-ghost btn-sm" href="dp-jornada.html?empresa=' + encodeURIComponent(emp.id) + '">Abrir na Escala 6x1</a></p>';
  }

  // ----- o perfil na Receita -----
  const O_QUE_PEDIR = 'Peça ao cliente pra autorizar o CNPJ do escritório (Portal de Serviços da Receita, Minhas Autorizações de Acesso) e aceite no e-CAC.';
  function perfilReceitaHtml(emp, p) {
    const s = [];
    if (p.avisos.length) s.push(secAvisos(p.avisos));
    const fora = foraDaConsulta(emp);
    if (fora) { s.push(sec('Fora da consulta', '<p>' + esc(fora) + '</p>')); return s.join(''); }
    const r = p.receita;
    if (!r) { s.push(sec('Ainda não consultada', '<p>A ponte ainda não consultou esta empresa na Receita: ela entra na próxima rodada (de segunda a sexta às 8h30).</p>')); return s.join(''); }
    s.push('<div class="ig-duas ig-igual">' + procuracaoHtml(r) + situacaoHtml(r) + '</div>');
    if (emp.regime === 'Simples Nacional' || p.pgdas.length) s.push(pgdasHtml(r, p));
    s.push(caixaHtml(p));
    s.push('<div id="igGuias">' + guiasHtml(r, p) + '</div>');
    return s.join('');
  }
  function procuracaoHtml(r) {
    const pr = procuracaoDe(r, null, HOJE);
    const frase = { ativa: 'Ativa' + (pr.ate ? ' até ' + dataBR(pr.ate) : '') + '.', vencendo: 'Ativa até ' + dataBR(pr.ate) + ': ' + pr.texto + '.',
      vencida: 'Venceu' + (pr.ate ? ' em ' + dataBR(pr.ate) : '') + '.', sem: 'Sem procuração: a Receita recusou a consulta.', nao_consultada: 'Ainda não consultada.' }[pr.estado];
    const cor = { vencendo: 'ig-alerta', vencida: 'ig-erro', sem: 'ig-alerta' }[pr.estado] || '';
    const quando = diaEmBrasilia(r.autorizacao_em);
    // de quem é: a do CNPJ do escritório ou a do CPF do Diego (a coluna autorizacao_via, que a ponte 0.4.4 manda a cada rodada)
    const temProcuracao = ['ativa', 'vencendo', 'vencida'].includes(pr.estado);
    const vencida = pr.estado === 'vencida';
    const deQuem = !temProcuracao ? '' : pr.via === 'procurador' ? (vencida ? 'Era a procuração pro CPF do Diego.' : 'É a procuração pro CPF do Diego: a ponte consulta esta empresa em nome dele.')
      : pr.via === 'escritorio' ? (vencida ? 'Era' : 'É') + ' a procuração pro CNPJ do escritório.'
      : 'A ponte ainda não disse se ela é a do CNPJ do escritório ou a do CPF do Diego: vem na próxima rodada.';
    return sec('Procuração', '<p class="ig-forte ' + cor + '">' + esc(frase) + '</p>'
      + (deQuem ? '<p' + (pr.via ? '' : ' class="ig-apagado"') + '>' + esc(deQuem) + '</p>' : '')
      + (['vencida', 'sem', 'vencendo'].includes(pr.estado) ? '<p>' + esc(O_QUE_PEDIR) + '</p>' : '')
      + (quando ? '<div class="field-help">Conferida em ' + esc(dataBR(quando)) + '.</div>' : ''));
  }
  function situacaoHtml(r) {
    const rel = oRelatorio(r);   // o link do PDF no Drive (HTML já escapado)
    let corpo;
    if (Array.isArray(r.pendencias)) {
      const quando = r.situacao_fiscal_em ? ' <small>relatório de ' + esc(dataBR(r.situacao_fiscal_em)) + '</small>' : '';
      corpo = r.pendencias.length
        ? '<p class="ig-forte ig-erro">' + esc(plural(r.pendencias.length, 'pendência', 'pendências')) + '</p><ul>' + r.pendencias.map(x => '<li>' + esc((x && x.orgao) || 'Receita') + ': ' + esc(x && x.titulo) + '</li>').join('') + '</ul>'
        : '<p class="ig-forte ig-ok">Sem pendência na Receita e na PGFN.</p>';
      return sec('Situação fiscal' + quando, corpo + (rel.depois ? '<p style="margin-top:10px;">' + rel.depois.trim() + '</p>' : ''));
    }
    return sec('Situação fiscal', rel.naoLido ? '<p>' + rel.depois.trim() + '</p>' : '<p>A situação fiscal desta empresa ainda não foi consultada: a consulta roda no dia 5 de cada mês.</p>');
  }
  function pgdasHtml(r, p) {
    const consulta = diaEmBrasilia(r.pgdas_em);
    if (!p.pgdas.length) return sec('PGDAS e DAS', '<p>' + (consulta ? 'Na consulta de ' + esc(dataBR(consulta)) + ', a Receita não mostrou declaração do PGDAS desta empresa neste ano.' : 'O PGDAS desta empresa ainda não foi consultado.') + '</p>');
    const das = m => {
      const guias = m.guias.length ? '<small>' + m.guias.map(g => 'pago em ' + esc(dataBR(g.pagoEm)) + ': ' + esc(dinheiro(g.total))
        + (g.meses > 1 ? ' (numa guia de ' + esc(inteiro(g.meses)) + ' meses)' : '')).join('<br>') + '</small>' : '';
      if (m.falta) return guias || nd();
      if (m.dasPago === true) return '<span class="ig-ok">pago</span>' + guias;
      if (m.dasPago === false) return m.guias.length ? '<span>sem pagar na consulta</span>' + guias : '<span class="ig-alerta">sem pagamento</span>';
      return guias || nd('A Receita não disse');
    };
    return sec('PGDAS e DAS, mês a mês' + (consulta ? ' <small>consulta de ' + esc(dataBR(consulta)) + '</small>' : ''),
      '<div class="ig-rola"><table class="hist-tbl"><thead><tr><th>Mês</th><th>Declaração</th><th>DAS</th><th class="ig-num">Receita do mês</th><th class="ig-num">12 meses anteriores</th></tr></thead><tbody>'
      + p.pgdas.map(m => '<tr><td>' + esc(mesBR(m.competencia)) + '</td><td>' + (m.falta ? '<span class="ig-erro">sem declaração na Receita</span>' : m.transmitidaEm ? 'transmitida em ' + esc(dataBR(m.transmitidaEm)) : '<span class="ig-erro">sem transmissão</span>')
        + '</td><td>' + das(m) + '</td><td class="ig-num">' + (m.receitaMes == null ? nd() : esc(dinheiro(m.receitaMes))) + '</td><td class="ig-num">' + (m.receita12 == null ? nd() : esc(dinheiro(m.receita12))) + '</td></tr>').join('')
      + '</tbody></table></div><div class="field-help" style="margin-top:10px;">O "pago" é o que o PGDAS mostrava no dia da consulta. O dia e o valor vêm das guias pagas, que são lidas à parte (no dia 25): '
      + 'por isso um mês pode aparecer sem pagar na consulta e já ter a guia paga. O DAS que entrou em parcelamento também aparece sem pagamento: '
      + 'a parcela paga não é o DAS do mês, e fica só nas guias pagas, embaixo. A receita é a da declaração que a ponte leu.</div>');
  }
  function caixaHtml(p) {
    if (!p.mensagens.length) return sec('Caixa Postal do e-CAC', '<p>Nenhuma mensagem lida pela ponte.</p>');
    const naoLidas = p.mensagens.filter(m => !m.lida).length;
    return sec('Caixa Postal do e-CAC <small>' + (naoLidas ? esc(plural(naoLidas, 'não lida', 'não lidas')) + ' entre as ' + p.mensagens.length + ' mais recentes' : 'as ' + p.mensagens.length + ' mais recentes, todas lidas') + '</small>',
      '<div>' + p.mensagens.map(m => '<div class="ig-msg"><time>' + esc(dataBR(m.quando) || '') + '</time><span>' + esc(m.assunto) + (m.origem && m.origem !== 'Receita' ? ' (' + esc(m.origem) + ')' : '')
        + (m.lida ? '' : ' <b>não lida</b>') + '</span></div>').join('') + '</div><div class="field-help" style="margin-top:10px;">Só o assunto: o texto da mensagem fica no e-CAC. "Lida" é o que a Receita marca quando alguém abre a mensagem lá.</div>');
  }
  function guiasHtml(r, p) {
    const titulo = 'Guias pagas';
    if (!r.pagamentos_ate) {
      return sec(titulo, '<p>' + (r.autorizacao === 'sem' ? 'Sem a procuração, a ponte não consegue consultar os pagamentos desta empresa.'
        : 'Os pagamentos desta empresa ainda não foram consultados: a consulta roda no dia 25 de cada mês. Se a procuração do cliente não inclui os pagamentos, a Receita recusa só essa consulta.') + '</p>');
    }
    const janela = 'de ' + dataBR(r.pagamentos_desde) + ' a ' + dataBR(r.pagamentos_ate);
    if (!p.guias.length) return sec(titulo + ' <small>' + esc(janela) + '</small>', '<p>Nenhuma guia paga na Receita nesse período.</p>');
    const anos = anosDasGuias(p.guias), tipos = ['todas', ...['DAS', 'DARF', 'outras'].filter(t => p.guias.some(g => tipoDoFiltro(g) === t))];
    const lista = p.guias.filter(g => (st.guias.ano === 'todos' || g.pagoEm.slice(0, 4) === st.guias.ano) && (st.guias.tipo === 'todas' || tipoDoFiltro(g) === st.guias.tipo));
    const t = totaisDasGuias(lista);
    const seg = (grupo, opcoes, atual) => '<div class="ig-seg" role="group">' + opcoes.map(([v, rot]) => '<button type="button" data-guias="' + grupo + '" data-v="' + esc(v) + '" aria-pressed="' + (atual === v) + '">' + esc(rot) + '</button>').join('') + '</div>';
    const ROT_TIPO = { todas: 'Todas', DAS: 'DAS', DARF: 'DARF', outras: 'Outras' };
    const filtros = '<div class="ig-filtros">' + (anos.length > 1 ? seg('ano', [['todos', 'Todos os anos'], ...anos.map(a => [a, a])], st.guias.ano) : '')
      + (tipos.length > 2 ? seg('tipo', tipos.map(x => [x, ROT_TIPO[x]]), st.guias.tipo) : '')
      + '<span class="ig-total"><b>' + esc(plural(t.n, 'guia', 'guias')) + '</b> · <b>' + esc(dinheiro(t.total)) + '</b> pagos'
      + (t.multa + t.juros > 0 ? ' · ' + esc(dinheiro(Math.round((t.multa + t.juros) * 100) / 100)) + ' de multa e juros' : '') + (t.comAtraso ? ' · ' + esc(inteiro(t.comAtraso)) + ' depois do vencimento' : '') + '</span></div>';
    const linhas = lista.map(g => {
      const aberta = st.abertas.has(g.numero);
      const mj = Math.round((g.multa + g.juros) * 100) / 100;
      return '<tr class="ig-guia" data-guia="' + esc(g.numero) + '"><td><button type="button" class="ig-abre" aria-expanded="' + aberta + '" aria-label="Ver os tributos da guia paga em ' + esc(dataBR(g.pagoEm)) + '">' + esc(dataBR(g.pagoEm)) + '</button></td>'
        + '<td>' + esc(g.tipo) + (g.codigo ? ' <span class="ig-apagado">' + esc(g.codigo) + '</span>' : '')
        + (g.parcela ? ' <span class="ig-etiqueta" title="Vence dentro do próprio mês: é a parcela de um parcelamento do Simples, não o DAS daquele mês. Os meses que ela amortiza estão nos tributos da guia.">parcela de parcelamento</span>' : '')
        + (g.resumo ? '<small class="ig-resumo" title="' + esc(g.resumo) + '">' + esc(g.resumo) + '</small>' : '') + '</td>'
        + '<td>' + (g.mes ? esc(mesBR(g.mes)) : nd()) + (g.meses.length > 1 ? '<small title="A mesma guia pagou ' + esc(g.meses.map(mesBR).join(', ')) + '">e mais ' + esc(plural(g.meses.length - 1, 'mês', 'meses')) + '</small>' : '') + '</td>'
        + '<td>' + (g.vencimento ? esc(dataBR(g.vencimento)) : nd()) + (g.atraso > 0 ? '<small class="ig-alerta">paga ' + esc(plural(g.atraso, 'dia', 'dias')) + ' depois</small>' : '') + '</td>'
        + '<td class="ig-num">' + (g.principal == null ? nd() : esc(dinheiro(g.principal))) + '</td>'
        + '<td class="ig-num">' + (mj > 0 ? '<span class="ig-alerta">' + esc(dinheiro(mj)) + '</span>' : '<span class="ig-apagado">' + esc(dinheiro(0)) + '</span>') + '</td>'
        + '<td class="ig-num"><b>' + esc(dinheiro(g.total)) + '</b></td></tr>' + (aberta ? partesHtml(g) : '');
    }).join('');
    return sec(titulo + ' <small>' + esc(janela) + '</small>', filtros
      + (lista.length ? '<div class="ig-rola"><table class="hist-tbl"><thead><tr><th>Pago em</th><th>Guia</th><th>Período</th><th>Vencimento</th><th class="ig-num">Principal</th><th class="ig-num">Multa e juros</th><th class="ig-num">Total</th></tr></thead><tbody>'
        + linhas + '</tbody></table></div>' : '<p>Nenhuma guia neste filtro.</p>')
      + '<div class="field-help" style="margin-top:10px;">O que a Receita mostra como pago no período que a consulta já cobriu. A guia que falta aqui dentro desse período não consta como paga lá. '
      + 'Clique numa guia pra ver a parte de cada tributo.</div>');
  }
  function partesHtml(g) {
    const v = x => (x == null || x === '' || Number.isNaN(+x) ? '<span class="ig-nd">—</span>' : esc(dinheiro(x)));
    const partes = g.partes.length
      ? '<table><thead><tr><th>Tributo</th><th>Período</th><th class="ig-num">Principal</th><th class="ig-num">Multa</th><th class="ig-num">Juros</th><th class="ig-num">Total</th></tr></thead><tbody>'
        + g.partes.map(x => '<tr><td class="ig-quebra">' + (x.receita_codigo ? '<span class="ig-apagado">' + esc(x.receita_codigo) + '</span> ' : '') + esc(x.receita || 'Sem a descrição') + '</td><td>' + esc(mesBR(String(x.periodo_apuracao || '').slice(0, 7)) || '')
          + '</td><td class="ig-num">' + v(x.principal) + '</td><td class="ig-num">' + v(x.multa) + '</td><td class="ig-num">' + v(x.juros) + '</td><td class="ig-num">' + v(x.valor_total) + '</td></tr>').join('') + '</tbody></table>'
      : '<p>A Receita não detalhou os tributos desta guia.</p>';
    return '<tr class="ig-partes"><td colspan="7">' + partes + '<p>Documento ' + esc(g.numero) + (g.referencia ? ' · referência ' + esc(g.referencia) : '')
      + (g.saldo > 0 ? ' · saldo informado pela Receita: ' + esc(dinheiro(g.saldo)) : '') + '</p></td></tr>';
  }

  $('igPerfil').addEventListener('click', e => {
    if (e.target.closest('#igVoltar')) { fecharPerfil(); return; }
    if (e.target.closest('#igDeNovo')) { mostrarPerfil(st.perfil); return; }
    const nav = e.target.closest('#igAnt, #igProx');
    if (nav && nav.dataset.id) { history.replaceState({ empresa: nav.dataset.id }, '', enderecoCom(nav.dataset.id)); mostrarPerfil(nav.dataset.id); return; }
    const f = e.target.closest('[data-guias]');
    if (f) { st.guias[f.dataset.guias] = f.dataset.v; redesenharGuias(f.dataset.guias, f.dataset.v); return; }
    const g = e.target.closest('tr[data-guia]');
    if (g && !(window.getSelection && String(window.getSelection()))) {
      const n = g.dataset.guia;
      if (st.abertas.has(n)) st.abertas.delete(n); else st.abertas.add(n);
      redesenharGuias(null, null, n);
    }
  });
  // redesenha só as guias (o filtro e a guia aberta), devolvendo o foco pra onde estava
  function redesenharGuias(grupo, valor, numero) {
    const alvo = $('igGuias');
    if (!alvo || !st.dados) return;
    alvo.innerHTML = guiasHtml(st.dados.receita, st.dados);
    const foco = numero ? alvo.querySelector('tr[data-guia="' + CSS.escape(numero) + '"] .ig-abre') : grupo ? alvo.querySelector('[data-guias="' + grupo + '"][data-v="' + CSS.escape(valor) + '"]') : null;
    if (foco) foco.focus({ preventScroll: true });
  }
  $('igMigalha').addEventListener('click', e => { if (e.target.closest('#igMigalhaLista') && !(e.ctrlKey || e.metaKey || e.shiftKey)) { e.preventDefault(); fecharPerfil(); } });
  window.addEventListener('popstate', () => { const id = idDoEndereco(); if (id) mostrarPerfil(id); else mostrarLista(); });

  // ---------- a carga ----------
  const saudeP = lerSaude(supabase).then(s => s[C.tipo]).catch(() => null);
  try {
    st.empresas = await carregarCarteira(supabase, HOJE);
    const ids = st.empresas.map(e => e.id);
    st.base = DOMINIO ? await carregarListaDominio(supabase, ids) : await carregarListaReceita(supabase, ids);
    if (DOMINIO) {
      st.meses = mesesDoDominio(st.base.mensal);
      const fechado = ultimoMesFechado(HOJE);
      st.mes = st.meses.includes(fechado) ? fechado : (st.meses[0] || fechado);
      if (!st.meses.length) st.meses = [st.mes];
      desenharMeses();
    }
    refazerLinhas(); desenharFocos(); desenharLista();
  } catch (e) {
    $('igCorpo').innerHTML = ''; $('igTabWrap').hidden = true;
    $('igVazio').hidden = false; $('igVazio').className = 'ig-erro-geral'; $('igVazio').textContent = 'Não consegui ler as empresas: ' + ((e && e.message) || e);
  }
  desenharHoje(await saudeP);
  const pedida = idDoEndereco();
  if (pedida) mostrarPerfil(pedida);
}
