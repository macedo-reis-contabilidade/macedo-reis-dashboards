// ============================================================
// MACEDO & REIS — Engine única de Tarefas + Rotinas por setor
// Uma casca por setor chama initTarefas(config); tudo o que a
// financeiro-tarefas.html fazia (grupos por tipo, faixa de foco,
// detalhe com linha do tempo, geração do mês) vive aqui — mais
// as rotinas leves (ciclo por periodicidade, dia útil, adiar),
// transplantadas de financeiro-rotinas.html e da agenda.
// Rotina NÃO gera tarefa nem histórico (decisão do Samuel).
// ============================================================

import { supabase, getCurrentUser, signOut } from './supabase.js';
import { formatDate } from './utils.js';

const CSS = `
  .fa-focus { display:grid; grid-template-columns:repeat(5,1fr); gap:12px; margin-bottom:22px; }
  .fa-focus-card { background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.08); border-radius:14px; padding:14px 16px; cursor:pointer; text-align:left; transition:border-color .15s, background .15s; display:flex; flex-direction:column; gap:4px; }
  .fa-focus-card:hover { border-color:rgba(138,174,200,.4); }
  .fa-focus-card.is-active { border-color:#5B82A6; background:rgba(91,130,166,.10); }
  .fc-num { font-size:24px; font-weight:700; color:#E6EBF2; line-height:1; }
  .fc-lbl { font-size:12px; color:#8A93A6; }
  .fa-focus-card.fc-danger .fc-num { color:#E06C6C; }

  .fa-sel { max-width:200px; }
  .fa-toolbar-actions { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }

  .fa-grupo { background:rgba(255,255,255,.025); border:1px solid rgba(255,255,255,.08); border-radius:14px; margin-bottom:10px; overflow:hidden; }
  .fa-grupo-head { display:flex; align-items:center; gap:12px; padding:14px 18px; cursor:pointer; list-style:none; user-select:none; }
  .fa-grupo-head::-webkit-details-marker { display:none; }
  .fa-grupo-chev { color:#8A93A6; transition:transform .15s; flex:none; }
  .fa-grupo[open] .fa-grupo-chev { transform:rotate(90deg); }
  .fa-grupo-nome { font-weight:600; color:#E6EBF2; font-size:15px; }
  .fa-grupo-meta { color:#8A93A6; font-size:13px; flex:1; }
  .fa-grupo-prog { color:#8AAEC8; font-size:13px; font-variant-numeric:tabular-nums; background:rgba(91,130,166,.12); border:1px solid rgba(91,130,166,.25); border-radius:999px; padding:2px 10px; }
  .fa-grupo-body { border-top:1px solid rgba(255,255,255,.06); padding:4px 6px 8px; }
  .fa-grupo-body .table { margin:0; }
  .fa-grupo-body .table td { padding:9px 12px; }

  .fa-atrasada { color:#E06C6C; font-weight:600; }
  .fa-row-done { opacity:.5; }
  .fa-row-proc { cursor:pointer; transition:background .12s; }
  .fa-row-proc:hover { background:rgba(255,255,255,.04); }
  .pill { display:inline-block; font-size:11px; font-weight:600; border-radius:999px; padding:3px 10px; }
  .pill-pend { color:#E3B341; background:rgba(227,179,65,.14); border:1px solid rgba(227,179,65,.3); }
  .pill-and { color:#8AAEC8; background:rgba(91,130,166,.14); border:1px solid rgba(91,130,166,.3); }
  .pill-ok { color:#3FB07A; background:rgba(63,176,122,.14); border:1px solid rgba(63,176,122,.3); }
  .det-empresa { display:flex; flex-direction:column; gap:2px; }
  .det-empresa span { font-size:13px; color:#8AAEC8; }
  .det-empresa strong { color:#E6EBF2; font-size:15px; }
  .alv-conc-banner { background:rgba(63,176,122,.12); border:1px solid rgba(63,176,122,.35); color:#3FB07A; border-radius:10px; padding:8px 12px; font-size:13px; }
  .alv-hr { border:none; border-top:1px solid rgba(255,255,255,.08); margin:8px 0 2px; }
  .alv-tl-head { font-weight:600; color:#E6EBF2; font-size:15px; }
  .tl { display:flex; flex-direction:column; gap:0; margin-top:8px; }
  .tl-item { position:relative; padding:0 0 16px 22px; border-left:2px solid rgba(255,255,255,.10); }
  .tl-item:last-child { border-left-color:transparent; padding-bottom:2px; }
  .tl-item::before { content:''; position:absolute; left:-6px; top:3px; width:10px; height:10px; border-radius:50%; background:#5B82A6; border:2px solid #141A22; }
  .tl-when { font-size:12px; color:#8A93A6; }
  .tl-desc { color:#E6EBF2; font-size:14px; margin-top:2px; white-space:pre-wrap; }
  .tl-autor { font-size:12px; color:#8AAEC8; margin-top:2px; }
  .tl-empty { color:#8A93A6; font-size:13px; }

  .fa-modal-overlay { position:fixed; inset:0; background:rgba(8,12,18,.72); display:none; align-items:center; justify-content:center; padding:20px; z-index:100; }
  .fa-modal-overlay.is-open { display:flex; }
  #modalOverlay { z-index:110; }  /* acima do Gerenciar rotinas, que segue aberto por trás */
  .fa-modal { width:100%; max-width:520px; background:#141A22; border:1px solid rgba(255,255,255,.10); border-radius:16px; overflow:hidden; max-height:92vh; display:flex; flex-direction:column; }
  .fa-modal-head { display:flex; align-items:center; justify-content:space-between; padding:18px 22px; border-bottom:1px solid rgba(255,255,255,.08); }
  .fa-modal-head h3 { margin:0; color:#E6EBF2; font-size:18px; }
  .fa-modal-close { background:none; border:none; color:#8A93A6; font-size:26px; line-height:1; cursor:pointer; padding:0 4px; }
  .fa-modal-close:hover { color:#E6EBF2; }
  .fa-modal-body { padding:22px; display:flex; flex-direction:column; gap:14px; overflow:auto; }
  .fa-field { display:flex; flex-direction:column; gap:6px; }
  .fa-field > span { font-size:13px; color:#8AAEC8; }
  .fa-field-row { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  .fa-checkline { display:flex; align-items:center; gap:8px; color:#C5D8E8; font-size:14px; cursor:pointer; }
  .fa-modal-foot { display:flex; justify-content:flex-end; gap:10px; padding:16px 22px; border-top:1px solid rgba(255,255,255,.08); }
  .fa-modal textarea.input { resize:vertical; font-family:inherit; }

  /* seletor de tipo no modal Nova */
  .te-tipos { display:flex; gap:8px; padding:16px 22px 0; }
  .te-tipo { flex:1; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.1); border-radius:10px; color:#8A93A6; padding:9px 6px; font-size:13px; cursor:pointer; font-family:inherit; text-align:center; }
  .te-tipo.is-on { background:rgba(91,130,166,.22); color:#E6EBF2; border-color:rgba(91,130,166,.6); }

  /* faixa Rotinas de hoje */
  .te-rot-faixa { background:rgba(91,130,166,.08); border:1px solid rgba(91,130,166,.22); border-radius:14px; padding:12px 16px; margin-bottom:18px; }
  .te-rot-top { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:8px; }
  .te-rot-tit { color:#E6EBF2; font-size:14px; font-weight:600; }
  .te-rot-item { display:flex; align-items:center; gap:12px; padding:7px 2px; }
  .te-rot-item + .te-rot-item { border-top:1px solid rgba(255,255,255,.05); }
  .rt-check { flex:0 0 auto; width:26px; height:26px; border-radius:50%; border:2px solid rgba(255,255,255,.25); background:none; color:transparent; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all .15s ease; }
  .rt-check:hover { border-color:#3FB07A; }
  .rt-check.is-done { background:#3FB07A; border-color:#3FB07A; color:#0B0F14; }
  .te-rot-nome { color:#E6EBF2; font-size:14px; flex:1; min-width:0; }
  .te-rot-nome small { color:#8A93A6; font-size:12px; margin-left:8px; }
  .rt-pill { display:inline-block; font-size:11px; font-weight:600; color:#8AAEC8; background:rgba(91,130,166,.16); border:1px solid rgba(91,130,166,.3); border-radius:999px; padding:2px 8px; }
  .rt-link { background:none; border:none; color:#8AAEC8; cursor:pointer; font-size:13px; padding:3px 6px; font-family:inherit; }
  .rt-link:hover { color:#C5D8E8; text-decoration:underline; }
  .rt-del:hover { color:#E06C6C; }

  /* overlay Gerenciar rotinas */
  .te-rot-modal { max-width:640px; }
  .rt-item { display:flex; align-items:center; gap:14px; background:rgba(255,255,255,.025); border:1px solid rgba(255,255,255,.08); border-radius:14px; padding:12px 14px; margin-bottom:8px; }
  .rt-item.is-done { background:rgba(63,176,122,.06); border-color:rgba(63,176,122,.18); }
  .rt-body { flex:1 1 auto; min-width:0; }
  .rt-titulo { color:#E6EBF2; font-size:14.5px; font-weight:500; }
  .rt-item.is-done .rt-titulo { text-decoration:line-through; color:#8A93A6; }
  .rt-meta { color:#8A93A6; font-size:12.5px; margin-top:3px; }
  .rt-desc { color:#A9B2C2; font-size:13px; margin-top:5px; line-height:1.5; white-space:pre-wrap; }
  .rt-acoes { display:flex; align-items:center; gap:4px; flex:0 0 auto; }
  .rt-inativa { opacity:.5; }
  .rt-sec-title { color:#8A93A6; font-size:12.5px; text-transform:uppercase; letter-spacing:.04em; margin:18px 0 8px; }
  .rt-item.is-done .rt-pill { color:#7FBF8E; border-color:rgba(63,176,122,.3); background:rgba(63,176,122,.12); }
  .rt-agendada { opacity:.7; }
  .rt-check-off { color:#8A93A6; cursor:default; }
  .rt-check-off:hover { border-color:rgba(255,255,255,.25); }
  .rt-mv { background:none; border:none; color:#6E7787; cursor:pointer; font-size:13px; padding:3px 4px; }
  .rt-mv:hover { color:#C9D3E0; }

  @media (max-width:720px){ .fa-focus { grid-template-columns:repeat(2,1fr); } }
  @media (max-width:560px){ .rt-item { flex-wrap:wrap; } .rt-acoes { width:100%; justify-content:flex-end; margin-top:4px; } }
`;

const SEM_NOME = { 1:'segunda', 2:'terça', 3:'quarta', 4:'quinta', 5:'sexta', 6:'sábado', 7:'domingo' };
const SEM_ABREV = { 1:'seg', 2:'ter', 3:'qua', 4:'qui', 5:'sex', 6:'sáb', 7:'dom' };
const MESES_NOME = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export function initTarefas(userCfg) {
  const C = Object.assign({
    setor: null,
    containerId: 'tarefasApp',
    gerarMes: false,
    gerarMesAvisoVazio: 'Não há regras mensais cadastradas. Crie uma pelo botão Nova → Tarefa recorrente.',
    recorrentes: false,               // oferece o tipo "Tarefa recorrente" no modal Nova
    filtroObrigacaoNull: false,       // fiscal: só tarefas fora do motor de obrigações
    item: 'tarefa',                   // rótulo singular ('tarefa' | 'processo')
    itemPluralFem: true,              // Concluídas/Todas × Concluídos/Todos
    btnNova: 'Nova tarefa',
    buscaPlaceholder: 'Buscar por tarefa ou cliente…',
    clienteLabel: 'Cliente',
    semClienteOption: '— Sem cliente (interna) —',
    semClienteDetalhe: 'Sem cliente',
    tituloLabel: 'Título *',
    tituloPlaceholder: 'Ex.: Emitir boletos de honorários',
    tituloAviso: 'Informe o título da tarefa.',
    andamentoPlaceholder: 'Ex.: Andamento registrado…',
    historicoCadastro: 'Tarefa cadastrada.',
    historicoConcluida: 'Tarefa concluída.',
    historicoReaberta: 'Tarefa reaberta.',
    confirmConcluir: 'Concluir esta tarefa?',
    confirmExcluir: 'Excluir esta tarefa e toda a sua linha do tempo? Esta ação não pode ser desfeita.',
    emptyTitulo: 'Nenhuma tarefa ainda',
    emptyDica: 'Crie uma tarefa avulsa no botão Nova tarefa.',
    grupoUnidade: ['tarefa', 'empresas']  // [singular, plural] do meta do grupo
  }, userCfg);
  if (!C.setor) throw new Error('initTarefas: informe o setor.');

  // ---------- CSS (uma fonte só, injetada) ----------
  if (!document.getElementById('tarefas-engine-css')) {
    const st = document.createElement('style');
    st.id = 'tarefas-engine-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  const esc = t => String(t == null ? '' : t).replace(/[&<>]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]));
  const escA = t => String(t == null ? '' : t).replace(/"/g, '&quot;');
  const escF = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const $ = id => document.getElementById(id);
  const fem = C.itemPluralFem;

  // ---------- esqueleto ----------
  const raiz = $(C.containerId);
  raiz.innerHTML = `
    <div id="teRotFaixa"></div>

    <div class="fa-focus">
      <button class="fa-focus-card fc-danger" data-periodo="atrasadas"><span class="fc-num" id="cAtras">0</span><span class="fc-lbl">Atrasadas</span></button>
      <button class="fa-focus-card" data-periodo="hoje"><span class="fc-num" id="cHoje">0</span><span class="fc-lbl">Vencem hoje</span></button>
      <button class="fa-focus-card" data-periodo="7dias"><span class="fc-num" id="c7">0</span><span class="fc-lbl">Próximos 7 dias</span></button>
      <button class="fa-focus-card is-active" data-periodo="mes"><span class="fc-num" id="cMes">0</span><span class="fc-lbl">Este mês</span></button>
      <button class="fa-focus-card" data-periodo="todas"><span class="fc-num" id="cTodas">0</span><span class="fc-lbl">Todas</span></button>
    </div>

    <div class="toolbar">
      <div class="toolbar-filters">
        <input type="text" id="searchInput" class="input input-search" placeholder="${escA(C.buscaPlaceholder)}">
        <select id="filterStatus" class="select fa-sel">
          <option value="afazer">A fazer</option>
          <option value="concluida">${fem ? 'Concluídas' : 'Concluídos'}</option>
          <option value="todas">${fem ? 'Todas' : 'Todos'}</option>
        </select>
        <select id="filterResp" class="select fa-sel">
          <option value="">Todos os responsáveis</option>
        </select>
      </div>
      <div class="fa-toolbar-actions">
        <button class="btn btn-ghost btn-sm" id="btnRotinas">Gerenciar rotinas</button>
        ${C.gerarMes ? '<button class="btn btn-ghost" id="btnGerarMes">Gerar tarefas do mês</button>' : ''}
        <button class="btn btn-primary" id="btnNova">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          ${esc(C.btnNova)}
        </button>
      </div>
    </div>

    <div id="grupos">
      <div class="loading-row" style="padding:40px;text-align:center;"><span class="spinner"></span>Carregando tarefas…</div>
    </div>

    <!-- modal Nova (tarefa / recorrente / rotina) — z-index acima do Gerenciar,
         que fica aberto por trás ao editar/criar rotina -->
    <div class="fa-modal-overlay" id="modalOverlay">
      <div class="fa-modal">
        <div class="fa-modal-head"><h3 id="nvTitulo">${esc(C.btnNova)}</h3><button class="fa-modal-close" id="modalClose">&times;</button></div>
        <div class="te-tipos" id="nvTipos">
          <button class="te-tipo is-on" data-tipo="tarefa">${C.item === 'processo' ? 'Processo' : 'Tarefa'}</button>
          ${C.recorrentes ? '<button class="te-tipo" data-tipo="recorrente">Tarefa recorrente</button>' : ''}
          <button class="te-tipo" data-tipo="rotina">Rotina</button>
        </div>
        <div class="fa-modal-body" id="formTarefa">
          <label class="fa-field"><span>${esc(C.tituloLabel)}</span><input type="text" id="fTitulo" class="input" placeholder="${escA(C.tituloPlaceholder)}"></label>
          <label class="fa-field"><span>${esc(C.clienteLabel)}</span><select id="fCliente" class="select"><option value="">${esc(C.semClienteOption)}</option></select></label>
          <div class="fa-field-row">
            <label class="fa-field"><span>Responsável</span><input type="text" id="fResponsavel" class="input" placeholder="Ex.: Thalia"></label>
            <label class="fa-field"><span>Prazo</span><input type="date" id="fPrazo" class="input"></label>
          </div>
          <label class="fa-field"><span>Prioridade</span><select id="fPrioridade" class="select"><option value="media">Média</option><option value="alta">Alta</option><option value="baixa">Baixa</option></select></label>
          <label class="fa-field"><span>Descrição</span><textarea id="fDescricao" class="input" rows="3" placeholder="Detalhes (opcional)"></textarea></label>
        </div>
        <div class="fa-modal-body" id="formRecorrente" style="display:none;">
          <label class="fa-field"><span>Título / obrigação *</span><input type="text" id="qTitulo" class="input" placeholder="Ex.: Emitir boletos de honorários"></label>
          <label class="fa-field"><span>${esc(C.clienteLabel)}</span><select id="qCliente" class="select"><option value="">${esc(C.semClienteOption)}</option></select></label>
          <div class="fa-field-row">
            <label class="fa-field"><span>Periodicidade</span>
              <select id="qPeri" class="select"><option value="mensal">Mensal</option><option value="diaria">Diária</option><option value="semanal">Semanal</option><option value="anual">Anual</option></select>
            </label>
            <label class="fa-field" id="qDiaWrap"><span>Dia de vencimento</span><input type="number" id="qDia" class="input" min="1" max="31" placeholder="Ex.: 10"></label>
          </div>
          <label class="fa-field" id="qMesWrap" style="display:none;"><span>Mês de vencimento</span>
            <select id="qMes" class="select">${MESES_NOME.map((m, i) => '<option value="' + (i + 1) + '">' + m + '</option>').join('')}</select>
          </label>
          <label class="fa-field"><span>Responsável</span><input type="text" id="qResp" class="input" placeholder="Ex.: Thalia"></label>
          <label class="fa-field"><span>Descrição</span><textarea id="qDesc" class="input" rows="2" placeholder="Detalhes (opcional)"></textarea></label>
          <p style="font-size:12px;color:#8A93A6;margin:0;">A regra entra na base de recorrentes do setor; as tarefas do mês nascem pelo botão “Gerar tarefas do mês”.</p>
        </div>
        <div class="fa-modal-body" id="formRotina" style="display:none;">
          <label class="fa-field"><span>Título *</span><input type="text" id="rTitulo" class="input" placeholder="Ex.: Conferir e-mails"></label>
          <label class="fa-field"><span>Responsável</span><input type="text" id="rResp" class="input" placeholder="Ex.: Thalia"></label>
          <label class="fa-field"><span>Periodicidade</span>
            <select id="rPeri" class="select">
              <option value="diaria">Diária — todo dia</option>
              <option value="semanal">Semanal — num dia da semana</option>
              <option value="mensal">Mensal — num dia do mês</option>
              <option value="anual">Anual — numa data fixa</option>
            </select>
          </label>
          <label class="fa-field" id="campoSemana" style="display:none;"><span>Dia da semana</span>
            <select id="rDiaSemana" class="select">
              <option value="1">Segunda-feira</option><option value="2">Terça-feira</option><option value="3">Quarta-feira</option>
              <option value="4">Quinta-feira</option><option value="5">Sexta-feira</option><option value="6">Sábado</option><option value="7">Domingo</option>
            </select>
          </label>
          <label class="fa-field" id="campoMes" style="display:none;"><span>Dia do mês</span>
            <input type="number" id="rDiaMes" class="input" min="1" max="31" placeholder="Ex.: 5">
          </label>
          <div class="fa-field-row" id="campoAnual" style="display:none;">
            <label class="fa-field"><span>Dia</span><input type="number" id="rDiaAnualD" class="input" min="1" max="31" placeholder="31"></label>
            <label class="fa-field"><span>Mês</span>
              <select id="rDiaAnualM" class="select">${MESES_NOME.map((m, i) => '<option value="' + (i + 1) + '">' + m + '</option>').join('')}</select>
            </label>
          </div>
          <label class="fa-checkline" id="campoUtil" style="display:none;"><input type="checkbox" id="rDiaUtil"><span>Cair sempre em dia útil (fim de semana empurra pra segunda)</span></label>
          <label class="fa-field"><span>Descrição</span><textarea id="rDesc" class="input" rows="3" placeholder="O que fazer nessa rotina (opcional)"></textarea></label>
          <label class="fa-checkline"><input type="checkbox" id="rAtivo" checked><span>Rotina ativa (aparece no checklist)</span></label>
        </div>
        <div class="fa-modal-foot">
          <button class="btn btn-danger" id="rExcluir" style="display:none;margin-right:auto;">Excluir</button>
          <button class="btn btn-ghost" id="btnCancelar">Cancelar</button>
          <button class="btn btn-primary" id="btnSalvar">Salvar</button>
        </div>
      </div>
    </div>

    <!-- detalhe da tarefa (linha do tempo) -->
    <div class="fa-modal-overlay" id="detOverlay">
      <div class="fa-modal" style="max-width:560px;">
        <div class="fa-modal-head"><h3 id="dTipo">Tarefa</h3><button class="fa-modal-close" id="detClose">&times;</button></div>
        <div class="fa-modal-body">
          <div class="alv-conc-banner" id="dConcBanner" style="display:none;"></div>
          <div class="det-empresa"><span>${esc(C.clienteLabel)}</span><strong id="dEmpresa"></strong></div>
          <div class="fa-field-row">
            <label class="fa-field"><span>Responsável</span><input type="text" id="dResp" class="input"></label>
            <label class="fa-field"><span>Prazo</span><input type="date" id="dPrazo" class="input"></label>
          </div>
          <div class="fa-field-row">
            <label class="fa-field"><span>Prioridade</span><select id="dPrioridade" class="select"><option value="media">Média</option><option value="alta">Alta</option><option value="baixa">Baixa</option></select></label>
            <label class="fa-field" id="dStatusWrap"><span>Status</span><select id="dStatus" class="select"><option value="pendente">Pendente</option><option value="em_andamento">Em andamento</option></select></label>
          </div>
          <label class="fa-field"><span>Descrição</span><textarea id="dDescricao" class="input" rows="2"></textarea></label>
          <div><button class="btn btn-primary btn-sm" id="dSalvar">Salvar alterações</button></div>
          <hr class="alv-hr">
          <div class="alv-tl-head">Linha do tempo</div>
          <label class="fa-field"><span>Registrar andamento</span><textarea id="dNovoAnd" class="input" rows="2" placeholder="${escA(C.andamentoPlaceholder)}"></textarea></label>
          <div><button class="btn btn-primary btn-sm" id="dAddAnd">Adicionar andamento</button></div>
          <div class="tl" id="dTimeline"></div>
        </div>
        <div class="fa-modal-foot">
          <button class="btn btn-danger" id="dExcluir" style="margin-right:auto;">Excluir</button>
          <button class="btn btn-ghost" id="dBtnReabrir" style="display:none;">Reabrir</button>
          <button class="btn btn-primary" id="dBtnConcluir">Concluir ${esc(C.item)}</button>
        </div>
      </div>
    </div>

    <!-- gerenciar rotinas -->
    <div class="fa-modal-overlay" id="rotOverlay">
      <div class="fa-modal te-rot-modal">
        <div class="fa-modal-head"><h3>Rotinas do setor</h3><button class="fa-modal-close" id="rotClose">&times;</button></div>
        <div class="fa-modal-body" id="rotLista"></div>
        <div class="fa-modal-foot">
          <button class="btn btn-ghost" id="rotFechar">Fechar</button>
          <button class="btn btn-primary" id="rotNova">+ Nova rotina</button>
        </div>
      </div>
    </div>

    <!-- adiar rotina -->
    <div class="fa-modal-overlay" id="adiOverlay">
      <div class="fa-modal" style="max-width:420px;">
        <div class="fa-modal-head"><h3>Adiar rotina</h3><button class="fa-modal-close" id="adiClose">&times;</button></div>
        <div class="fa-modal-body">
          <div style="color:#C5D8E8;font-size:14px;" id="adiNome"></div>
          <label class="fa-field"><span>Adiar para</span><input type="date" id="adiData" class="input"></label>
          <div style="font-size:12.5px;color:#8A93A6;" id="adiAtual"></div>
        </div>
        <div class="fa-modal-foot">
          <button class="btn btn-ghost" id="adiVoltar" style="display:none;margin-right:auto;">Voltar ao ciclo normal</button>
          <button class="btn btn-ghost" id="adiCancelar">Cancelar</button>
          <button class="btn btn-primary" id="adiConfirmar">Adiar</button>
        </div>
      </div>
    </div>
  `;

  // ---------- estado ----------
  const SETOR = C.setor;
  const elGrupos = $('grupos');
  const searchInput = $('searchInput');
  const filterStatus = $('filterStatus');
  const filterResp = $('filterResp');

  let tarefas = [];
  let rotinas = [];
  let usuarioEmail = null;
  let usuarioNome = 'Usuário';
  let periodo = 'mes';
  let gruposAbertos = new Set();

  function pad(n){ return String(n).padStart(2,'0'); }
  function toYMD(d){ return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
  const hojeD = new Date(); hojeD.setHours(0,0,0,0);
  const hojeStr = toYMD(hojeD);
  const em7D = new Date(hojeD); em7D.setDate(em7D.getDate()+7);
  const em7Str = toYMD(em7D);
  const anoMes = hojeStr.slice(0,7);

  (async () => {
    const user = await getCurrentUser();
    if (user) {
      usuarioEmail = user.email;
      const n = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuário';
      usuarioNome = n.charAt(0).toUpperCase() + n.slice(1);
      const un = $('userName'), ua = $('userAvatar');
      if (un) un.textContent = n;
      if (ua) ua.textContent = n.charAt(0).toUpperCase();
    }
    await carregarClientesSelect();
    await Promise.all([carregarTarefas(), carregarRotinas()]);
  })();

  const elLogout = $('btnLogout');
  if (elLogout) elLogout.addEventListener('click', signOut);

  document.querySelectorAll('.fa-focus-card').forEach(c => c.addEventListener('click', () => {
    periodo = c.dataset.periodo;
    document.querySelectorAll('.fa-focus-card').forEach(x => x.classList.toggle('is-active', x === c));
    render();
  }));

  async function carregarClientesSelect() {
    const { data } = await supabase.todosClientes('id, nome_principal');
    ['fCliente', 'qCliente'].forEach(idSel => {
      const sel = $(idSel);
      if (!sel) return;
      (data || []).forEach(c => { const o = document.createElement('option'); o.value = c.id; o.textContent = c.nome_principal; sel.appendChild(o); });
    });
  }

  // ==================== MODAL NOVA (tarefa / recorrente / rotina) ====================
  const overlay = $('modalOverlay');
  let tipoNova = 'tarefa';
  let rotinaEditando = null;   // rotina em edição (via Gerenciar) — trava o modal no tipo rotina

  function mostrarTipo(tipo) {
    tipoNova = tipo;
    document.querySelectorAll('#nvTipos .te-tipo').forEach(b => b.classList.toggle('is-on', b.dataset.tipo === tipo));
    $('formTarefa').style.display = tipo === 'tarefa' ? 'flex' : 'none';
    const fr = $('formRecorrente'); if (fr) fr.style.display = tipo === 'recorrente' ? 'flex' : 'none';
    $('formRotina').style.display = tipo === 'rotina' ? 'flex' : 'none';
    $('nvTitulo').textContent = tipo === 'rotina' ? (rotinaEditando ? 'Editar rotina' : 'Nova rotina')
      : tipo === 'recorrente' ? 'Nova tarefa recorrente' : C.btnNova;
  }
  document.querySelectorAll('#nvTipos .te-tipo').forEach(b => b.addEventListener('click', () => { if (!rotinaEditando) mostrarTipo(b.dataset.tipo); }));

  $('btnNova').addEventListener('click', () => { rotinaEditando = null; $('nvTipos').style.display = 'flex'; $('rExcluir').style.display = 'none'; mostrarTipo('tarefa'); overlay.classList.add('is-open'); });
  $('modalClose').addEventListener('click', fecharModal);
  $('btnCancelar').addEventListener('click', fecharModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) fecharModal(); });

  function fecharModal(){
    overlay.classList.remove('is-open');
    rotinaEditando = null;
    ['fTitulo','fCliente','fResponsavel','fPrazo','fDescricao','qTitulo','qCliente','qDia','qResp','qDesc','rTitulo','rResp','rDiaMes','rDiaAnualD','rDesc'].forEach(id => { const el = $(id); if (el) el.value = ''; });
    $('fPrioridade').value = 'media';
    const qp = $('qPeri'); if (qp) { qp.value = 'mensal'; camposRecorrente(); }
    $('rPeri').value = 'diaria';
    $('rDiaSemana').value = '1';
    const ram = $('rDiaAnualM'); if (ram) ram.value = '1';
    $('rDiaUtil').checked = false;
    $('rAtivo').checked = true;
    camposRotina();
  }

  // --- campos condicionais ---
  function camposRotina() {
    const p = $('rPeri').value;
    $('campoSemana').style.display = p === 'semanal' ? 'flex' : 'none';
    $('campoMes').style.display = p === 'mensal' ? 'flex' : 'none';
    $('campoAnual').style.display = p === 'anual' ? 'grid' : 'none';
    $('campoUtil').style.display = (p === 'mensal' || p === 'anual') ? 'flex' : 'none';
  }
  $('rPeri').addEventListener('change', camposRotina);

  function camposRecorrente() {
    const qp = $('qPeri'); if (!qp) return;
    const p = qp.value;
    const semDiaMes = (p === 'diaria' || p === 'semanal');
    $('qDiaWrap').style.display = semDiaMes ? 'none' : 'flex';
    $('qMesWrap').style.display = p === 'anual' ? 'flex' : 'none';
  }
  const qPeriEl = $('qPeri');
  if (qPeriEl) qPeriEl.addEventListener('change', camposRecorrente);

  $('btnSalvar').addEventListener('click', async () => {
    if (tipoNova === 'tarefa') return salvarTarefaNova();
    if (tipoNova === 'recorrente') return salvarRecorrenteNova();
    return salvarRotinaForm();
  });

  async function salvarTarefaNova() {
    const titulo = $('fTitulo').value.trim();
    if (!titulo) { alert(C.tituloAviso); return; }
    const novo = {
      setor: SETOR, titulo,
      cliente_id: $('fCliente').value || null,
      responsavel: $('fResponsavel').value.trim() || null,
      prazo: $('fPrazo').value || null,
      prioridade: $('fPrioridade').value,
      descricao: $('fDescricao').value.trim() || null,
      origem: 'avulsa', status: 'pendente'
    };
    const { data: ins, error } = await supabase.from('tarefas').insert(novo).select('id').single();
    if (error) { alert('Erro ao salvar: ' + error.message); return; }
    if (ins) await supabase.from('tarefa_historico').insert({ tarefa_id: ins.id, descricao: C.historicoCadastro, autor: usuarioEmail });
    fecharModal();
    await carregarTarefas();
  }

  async function salvarRecorrenteNova() {
    const titulo = $('qTitulo').value.trim();
    if (!titulo) { alert('Informe a obrigação / título.'); return; }
    const period = $('qPeri').value;
    const semDiaMes = (period === 'diaria' || period === 'semanal');
    const payload = {
      cliente_id: $('qCliente').value || null,
      setor: SETOR, titulo, periodicidade: period,
      dia_vencimento: (!semDiaMes && $('qDia').value) ? parseInt($('qDia').value, 10) : null,
      mes_vencimento: (period === 'anual' && $('qMes').value) ? parseInt($('qMes').value, 10) : null,
      descricao: $('qDesc').value.trim() || null,
      responsavel: $('qResp').value.trim() || null,
      ativo: true, origem: 'manual'
    };
    const { error } = await supabase.from('tarefas_recorrentes').insert(payload);
    if (error) { alert('Erro ao salvar: ' + error.message); return; }
    fecharModal();
    alert('Tarefa recorrente criada. As tarefas do mês nascem pelo botão “Gerar tarefas do mês”.');
  }

  async function salvarRotinaForm() {
    const titulo = $('rTitulo').value.trim();
    if (!titulo) { alert('Informe o título da rotina.'); return; }
    const peri = $('rPeri').value;
    const campos = {
      titulo,
      responsavel: $('rResp').value || null,
      descricao: $('rDesc').value.trim() || null,
      ativo: $('rAtivo').checked,
      periodicidade: peri,
      dia_semana: null, dia_mes: null, dia_anual: null,
      dia_util: (peri === 'mensal' || peri === 'anual') ? $('rDiaUtil').checked : false
    };
    if (peri === 'semanal') {
      campos.dia_semana = Number($('rDiaSemana').value);
    } else if (peri === 'mensal') {
      const dm = Number($('rDiaMes').value);
      if (!dm || dm < 1 || dm > 31) { alert('Informe o dia do mês (1 a 31).'); return; }
      campos.dia_mes = dm;
    } else if (peri === 'anual') {
      const dd = Number($('rDiaAnualD').value);
      const mm = Number($('rDiaAnualM').value);
      if (!dd || dd < 1 || dd > 31) { alert('Informe o dia (1 a 31) para a rotina anual.'); return; }
      campos.dia_anual = String(mm).padStart(2, '0') + '-' + String(dd).padStart(2, '0');
    }
    let error;
    if (rotinaEditando) {
      ({ error } = await supabase.from('rotinas').update(campos).eq('id', rotinaEditando.id));
    } else {
      ({ error } = await supabase.from('rotinas').insert({ ...campos, setor: SETOR, ordem: 999 }));
    }
    if (error) { alert('Erro ao salvar: ' + error.message); return; }
    fecharModal();
    await carregarRotinas();
    if ($('rotOverlay').classList.contains('is-open')) renderRotinasGerenciar();
  }

  $('rExcluir').addEventListener('click', async () => {
    if (!rotinaEditando) return;
    if (!confirm('Excluir a rotina “' + rotinaEditando.titulo + '”?')) return;
    const { error } = await supabase.from('rotinas').delete().eq('id', rotinaEditando.id);
    if (error) { alert('Erro: ' + error.message); return; }
    fecharModal();
    await carregarRotinas();
    if ($('rotOverlay').classList.contains('is-open')) renderRotinasGerenciar();
  });

  // ==================== GERAR TAREFAS DO MÊS ====================
  if (C.gerarMes) $('btnGerarMes').addEventListener('click', gerarTarefasDoMes);
  async function gerarTarefasDoMes() {
    const { data: regras, error: eR } = await supabase.from('tarefas_recorrentes').select('*').eq('setor', SETOR).eq('ativo', true).eq('periodicidade', 'mensal');
    if (eR) { alert('Erro ao ler as regras: ' + eR.message); return; }
    if (!regras || !regras.length) { alert(C.gerarMesAvisoVazio); return; }
    const { data: existentes, error: eE } = await supabase.from('tarefas').select('regra_id').eq('setor', SETOR).eq('competencia', anoMes).not('regra_id', 'is', null);
    if (eE) { alert('Erro ao conferir as já geradas: ' + eE.message); return; }
    const jaTem = new Set((existentes || []).map(t => t.regra_id));
    const ultimoDia = diasNoMes(hojeD.getFullYear(), hojeD.getMonth());
    const novas = [];
    for (const r of regras) {
      if (jaTem.has(r.id)) continue;
      let prazo = r.dia_vencimento ? (anoMes + '-' + pad(Math.min(r.dia_vencimento, ultimoDia))) : null;
      novas.push({ cliente_id: r.cliente_id, setor: SETOR, titulo: r.titulo, responsavel: r.responsavel, prazo, status: 'pendente', prioridade: 'media', origem: 'recorrente', regra_id: r.id, competencia: anoMes });
    }
    if (!novas.length) { alert('As tarefas mensais deste mês já foram geradas.'); return; }
    const { error } = await supabase.from('tarefas').insert(novas);
    if (error) { alert('Erro ao gerar: ' + error.message); return; }
    alert(novas.length + ' tarefa(s) gerada(s) para ' + anoMes.split('-').reverse().join('/') + '.');
    await carregarTarefas();
  }

  // ==================== TAREFAS: carga, filtros, render ====================
  async function carregarTarefas() {
    let q = supabase.from('tarefas').select('*, clientes(nome_principal)').eq('setor', SETOR);
    if (C.filtroObrigacaoNull) q = q.is('obrigacao_id', null);
    const { data, error } = await q.order('prazo', { ascending: true, nullsFirst: false });
    if (error) { elGrupos.innerHTML = '<div style="text-align:center;color:var(--danger);padding:40px;">Erro ao carregar: ' + esc(error.message) + '</div>'; return; }
    tarefas = data || [];
    const resps = [...new Set(tarefas.map(t => t.responsavel).filter(Boolean))].sort();
    const cur = filterResp.value;
    filterResp.innerHTML = '<option value="">Todos os responsáveis</option>' + resps.map(r => '<option value="'+escA(r)+'">'+esc(r)+'</option>').join('');
    filterResp.value = cur;
    render();
  }

  function noPeriodo(t){
    if (periodo === 'todas') return true;
    if (periodo === 'atrasadas') return t.prazo && t.prazo < hojeStr && t.status !== 'concluida';
    if (periodo === 'hoje') return t.prazo === hojeStr;
    if (periodo === '7dias') return t.prazo && t.prazo >= hojeStr && t.prazo <= em7Str;
    if (periodo === 'mes') return !t.prazo || t.prazo.slice(0,7) === anoMes;
    return true;
  }
  function noStatus(t){
    const v = filterStatus.value;
    if (v === 'concluida') return t.status === 'concluida';
    if (v === 'todas') return true;
    return t.status !== 'concluida';
  }
  function noResp(t){ const v = filterResp.value; return !v || t.responsavel === v; }
  function noBusca(t){ const s = searchInput.value.toLowerCase().trim(); if(!s) return true; return (t.titulo+' '+(t.clientes?.nome_principal||'')+' '+(t.responsavel||'')).toLowerCase().includes(s); }

  function atualizarFoco(){
    const af = tarefas.filter(t => t.status !== 'concluida');
    $('cAtras').textContent = af.filter(t => t.prazo && t.prazo < hojeStr).length;
    $('cHoje').textContent = af.filter(t => t.prazo === hojeStr).length;
    $('c7').textContent = af.filter(t => t.prazo && t.prazo >= hojeStr && t.prazo <= em7Str).length;
    $('cMes').textContent = af.filter(t => !t.prazo || t.prazo.slice(0,7) === anoMes).length;
    $('cTodas').textContent = af.length;
  }

  function render() {
    atualizarFoco();
    const vis = tarefas.filter(t => noPeriodo(t) && noStatus(t) && noResp(t) && noBusca(t));

    if (vis.length === 0) {
      elGrupos.innerHTML = '<div class="empty-state" style="padding:48px 24px;">'+
        '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>'+
        '<h3>'+(tarefas.length===0?esc(C.emptyTitulo):'Nada neste recorte')+'</h3>'+
        '<p>'+(tarefas.length===0?esc(C.emptyDica):'Ajuste a faixa de foco, o filtro ou a busca.')+'</p></div>';
      return;
    }

    const grupos = {};
    vis.forEach(t => { (grupos[t.titulo] = grupos[t.titulo] || []).push(t); });
    const ordenados = Object.keys(grupos).sort((a,b) => {
      const pa = menorPrazo(grupos[a]), pb = menorPrazo(grupos[b]);
      if (!pa) return 1; if (!pb) return -1; return pa < pb ? -1 : 1;
    });

    elGrupos.innerHTML = ordenados.map(titulo => {
      const itens = grupos[titulo];
      const total = itens.length;
      const concl = itens.filter(t => t.status === 'concluida').length;
      const prazos = [...new Set(itens.map(t => t.prazo).filter(Boolean))];
      let prazoLbl = '';
      if (prazos.length === 1) prazoLbl = '· vence ' + formatDate(prazos[0]);
      else if (prazos.length > 1) prazoLbl = '· vários prazos';
      const aberto = gruposAbertos.has(titulo) ? 'open' : '';
      const linhas = itens.map(t => {
        const atrasada = t.prazo && t.prazo < hojeStr && t.status !== 'concluida';
        const cli = t.clientes?.nome_principal ? esc(t.clientes.nome_principal) : '<span style="color:#6B7385">Interna</span>';
        return '<tr class="fa-row-proc '+(t.status==='concluida'?'fa-row-done':'')+'" data-id="'+t.id+'">'+
          '<td data-label="'+escA(C.clienteLabel)+'">'+cli+'</td>'+
          '<td data-label="Responsável">'+(t.responsavel?esc(t.responsavel):'—')+'</td>'+
          '<td data-label="Prazo">'+(t.prazo?'<span class="'+(atrasada?'fa-atrasada':'')+'">'+formatDate(t.prazo)+'</span>':'—')+'</td>'+
          '<td data-label="Status">'+statusPill(t.status)+'</td></tr>';
      }).join('');
      return '<details class="fa-grupo" '+aberto+' data-titulo="'+escA(titulo)+'">'+
        '<summary class="fa-grupo-head">'+
          '<svg class="fa-grupo-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>'+
          '<span class="fa-grupo-nome">'+esc(titulo)+'</span>'+
          '<span class="fa-grupo-meta">'+total+(total>1?' '+esc(C.grupoUnidade[1])+' ':' '+esc(C.grupoUnidade[0])+' ')+prazoLbl+'</span>'+
          '<span class="fa-grupo-prog">'+concl+'/'+total+'</span>'+
        '</summary>'+
        '<div class="fa-grupo-body"><table class="table"><tbody>'+linhas+'</tbody></table></div>'+
      '</details>';
    }).join('');

    elGrupos.querySelectorAll('details.fa-grupo').forEach(d => {
      d.addEventListener('toggle', () => { if (d.open) gruposAbertos.add(d.dataset.titulo); else gruposAbertos.delete(d.dataset.titulo); });
    });
    elGrupos.querySelectorAll('tr.fa-row-proc').forEach(tr => {
      tr.addEventListener('click', () => abrirDetalhe(tr.dataset.id));
    });
  }

  function menorPrazo(itens){ const ps = itens.map(t=>t.prazo).filter(Boolean).sort(); return ps[0] || ''; }
  const STATUS_LBL = { pendente:'Pendente', em_andamento:'Em andamento', concluida:'Concluído' };
  function statusPill(s){
    if (s==='concluida') return '<span class="pill pill-ok">Concluído</span>';
    if (s==='em_andamento') return '<span class="pill pill-and">Em andamento</span>';
    return '<span class="pill pill-pend">Pendente</span>';
  }
  function fmtDataHora(iso){ if(!iso) return ''; const d=new Date(iso); return d.toLocaleDateString('pt-BR')+' '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}); }

  // ==================== DETALHE DA TAREFA ====================
  const detOverlay = $('detOverlay');
  let procAtual = null;
  $('detClose').addEventListener('click', fecharDetalhe);
  detOverlay.addEventListener('click', e => { if (e.target === detOverlay) fecharDetalhe(); });
  $('dAddAnd').addEventListener('click', addAndamento);
  $('dSalvar').addEventListener('click', salvarDetalhe);
  $('dBtnConcluir').addEventListener('click', concluirProc);
  $('dBtnReabrir').addEventListener('click', reabrirProc);
  $('dExcluir').addEventListener('click', excluirProc);

  function fecharDetalhe(){ detOverlay.classList.remove('is-open'); procAtual = null; $('dNovoAnd').value = ''; }

  async function abrirDetalhe(id){
    const t = tarefas.find(x => x.id === id);
    if (!t) return;
    procAtual = t;
    const concl = t.status === 'concluida';
    $('dTipo').textContent = t.titulo || 'Tarefa';
    $('dEmpresa').textContent = t.clientes?.nome_principal || C.semClienteDetalhe;
    $('dResp').value = t.responsavel || '';
    $('dPrazo').value = t.prazo ? String(t.prazo).slice(0,10) : '';
    $('dPrioridade').value = t.prioridade || 'media';
    $('dStatus').value = concl ? 'em_andamento' : (t.status || 'pendente');
    $('dDescricao').value = t.descricao || '';
    const banner = $('dConcBanner');
    banner.style.display = concl ? 'block' : 'none';
    if (concl) banner.textContent = 'Concluído em ' + fmtDataHora(t.concluida_em) + (t.concluida_por ? ' por ' + t.concluida_por : '');
    $('dStatusWrap').style.display = concl ? 'none' : 'flex';
    $('dBtnConcluir').style.display = concl ? 'none' : 'inline-flex';
    $('dBtnReabrir').style.display = concl ? 'inline-flex' : 'none';
    detOverlay.classList.add('is-open');
    await renderTimeline(id);
  }

  async function renderTimeline(id){
    const tl = $('dTimeline');
    tl.innerHTML = '<div class="tl-empty">Carregando…</div>';
    const { data } = await supabase.from('tarefa_historico').select('*').eq('tarefa_id', id).order('created_at', { ascending: false });
    if (!data || !data.length){ tl.innerHTML = '<div class="tl-empty">Nenhum andamento ainda.</div>'; return; }
    tl.innerHTML = data.map(h => `<div class="tl-item"><div class="tl-when">${fmtDataHora(h.created_at)}</div><div class="tl-desc">${esc(h.descricao)}</div>${h.autor ? `<div class="tl-autor">${esc(h.autor)}</div>` : ''}</div>`).join('');
  }

  async function addAndamento(){
    if (!procAtual) return;
    const id = procAtual.id;
    const inp = $('dNovoAnd');
    const txt = inp.value.trim();
    if (!txt) { alert('Escreva o andamento.'); return; }
    const btn = $('dAddAnd'); btn.disabled = true; btn.textContent = 'Salvando…';
    const { error } = await supabase.from('tarefa_historico').insert({ tarefa_id: id, descricao: txt, autor: usuarioEmail });
    btn.disabled = false; btn.textContent = 'Adicionar andamento';
    if (error) { alert('Erro: ' + error.message); return; }
    inp.value = '';
    if (procAtual && procAtual.id === id) await renderTimeline(id);
  }

  async function salvarDetalhe(){
    if (!procAtual) return;
    const id = procAtual.id;
    const concl = procAtual.status === 'concluida';
    const novoStatus = $('dStatus').value;
    const patch = {
      responsavel: $('dResp').value.trim() || null,
      prazo: $('dPrazo').value || null,
      prioridade: $('dPrioridade').value,
      descricao: $('dDescricao').value.trim() || null
    };
    if (!concl) patch.status = novoStatus;
    const statusMudou = !concl && procAtual.status !== novoStatus;
    const { error } = await supabase.from('tarefas').update(patch).eq('id', id);
    if (error) { alert('Erro ao salvar: ' + error.message); return; }
    if (statusMudou) await supabase.from('tarefa_historico').insert({ tarefa_id: id, descricao: 'Status alterado para: ' + STATUS_LBL[novoStatus] + '.', autor: usuarioEmail });
    fecharDetalhe();
    await carregarTarefas();
  }

  async function concluirProc(){
    if (!procAtual) return;
    const id = procAtual.id;
    if (!confirm(C.confirmConcluir)) return;
    const { error } = await supabase.from('tarefas').update({ status:'concluida', concluida_em:new Date().toISOString(), concluida_por:usuarioEmail }).eq('id', id);
    if (error){ alert('Erro: '+error.message); return; }
    await supabase.from('tarefa_historico').insert({ tarefa_id:id, descricao:C.historicoConcluida, autor:usuarioEmail });
    fecharDetalhe();
    await carregarTarefas();
  }

  async function reabrirProc(){
    if (!procAtual) return;
    const id = procAtual.id;
    const { error } = await supabase.from('tarefas').update({ status:'em_andamento', concluida_em:null, concluida_por:null }).eq('id', id);
    if (error){ alert('Erro: '+error.message); return; }
    await supabase.from('tarefa_historico').insert({ tarefa_id:id, descricao:C.historicoReaberta, autor:usuarioEmail });
    fecharDetalhe();
    await carregarTarefas();
  }

  async function excluirProc(){
    if (!procAtual) return;
    const id = procAtual.id;
    if (!confirm(C.confirmExcluir)) return;
    const { error } = await supabase.from('tarefas').delete().eq('id', id);
    if (error){ alert('Erro: '+error.message); return; }
    fecharDetalhe();
    await carregarTarefas();
  }

  searchInput.addEventListener('input', render);
  filterStatus.addEventListener('change', render);
  filterResp.addEventListener('change', render);

  // ==================== ROTINAS ====================
  // Ciclo transplantado da agenda (dia útil + adiada_para) e da
  // financeiro-rotinas.html (feitaNoPeriodo, CRUD, seções).
  function diaSemanaISO(d){ const x = d.getDay(); return x === 0 ? 7 : x; }
  function diasNoMes(ano, mes0){ return new Date(ano, mes0 + 1, 0).getDate(); }
  function segundaDaSemana(d){ const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - (diaSemanaISO(x) - 1)); return x; }
  function periDe(r){ return r.periodicidade || 'diaria'; }

  function caiNoDia(r, d){
    const p = periDe(r);
    if (p === 'diaria') return true;
    if (p === 'semanal') return diaSemanaISO(d) === (r.dia_semana || 1);
    if (p === 'mensal'){
      const alvo = Math.min(r.dia_mes || 1, diasNoMes(d.getFullYear(), d.getMonth()));
      if (!r.dia_util) return d.getDate() === alvo;
      const dt = new Date(d.getFullYear(), d.getMonth(), alvo);
      while (dt.getDay() === 0 || dt.getDay() === 6) dt.setDate(dt.getDate() + 1);
      return d.getDate() === dt.getDate() && d.getMonth() === dt.getMonth();
    }
    if (p === 'anual'){
      const a = String(r.dia_anual || '01-01').split('-').map(Number); const mm = (a[0] || 1) - 1, dd = a[1] || 1;
      const dt = new Date(d.getFullYear(), mm, Math.min(dd, diasNoMes(d.getFullYear(), mm)));
      if (r.dia_util) while (dt.getDay() === 0 || dt.getDay() === 6) dt.setDate(dt.getDate() + 1);
      return d.getMonth() === dt.getMonth() && d.getDate() === dt.getDate();
    }
    return false;
  }
  function feitaNoPeriodo(r){
    if (!r.ultima_execucao) return false;
    const u = new Date(String(r.ultima_execucao).slice(0,10) + 'T00:00:00');
    const p = periDe(r);
    if (p === 'diaria') return String(r.ultima_execucao).slice(0,10) === hojeStr;
    if (p === 'semanal') return segundaDaSemana(u).getTime() === segundaDaSemana(hojeD).getTime();
    if (p === 'mensal') return u.getFullYear() === hojeD.getFullYear() && u.getMonth() === hojeD.getMonth();
    if (p === 'anual') return u.getFullYear() === hojeD.getFullYear();
    return String(r.ultima_execucao).slice(0,10) === hojeStr;
  }
  function dataGatilho(r){
    const ano = hojeD.getFullYear(), mes0 = hojeD.getMonth();
    const p = periDe(r);
    if (p === 'semanal') { const seg = segundaDaSemana(hojeD); const alvo = new Date(seg); alvo.setDate(seg.getDate() + ((r.dia_semana || 1) - 1)); return alvo; }
    if (p === 'mensal') return new Date(ano, mes0, Math.min(r.dia_mes || 1, diasNoMes(ano, mes0)));
    if (p === 'anual') { const a = String(r.dia_anual || '01-01').split('-').map(Number); const mm = a[0], dd = a[1]; return new Date(ano, (mm || 1) - 1, Math.min(dd || 1, diasNoMes(ano, (mm || 1) - 1))); }
    return hojeD;
  }
  function gatilhoChegou(r){ return periDe(r) === 'diaria' ? true : dataGatilho(r) <= hojeD; }
  function pillTexto(r){
    const p = periDe(r);
    if (p === 'semanal') return 'Semanal · ' + (SEM_ABREV[r.dia_semana] || 'seg');
    if (p === 'mensal') return 'Mensal · dia ' + (r.dia_mes || 1) + (r.dia_util ? ' útil' : '');
    if (p === 'anual') { const a = String(r.dia_anual || '01-01').split('-').map(Number); return 'Anual · ' + pad(a[1] || 1) + '/' + pad(a[0] || 1) + (r.dia_util ? ' útil' : ''); }
    return 'Diária';
  }
  function fmtDia(d){ return d.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' }); }

  // devidas hoje = semântica da agenda (fim de semana zera; adiada_para manda)
  function rotinasDevidasHoje(){
    if (hojeD.getDay() === 0 || hojeD.getDay() === 6) return [];
    return rotinas.filter(r => r.ativo).filter(r => {
      if (r.adiada_para) {
        if (hojeStr < r.adiada_para) return false;
        if (hojeStr === r.adiada_para) return true;
      }
      return caiNoDia(r, hojeD);
    });
  }

  let rotinasErro = null;
  async function carregarRotinas(){
    const { data, error } = await supabase.from('rotinas').select('*').eq('setor', SETOR)
      .order('ordem', { ascending: true }).order('titulo', { ascending: true });
    rotinasErro = error ? error.message : null;
    if (error) { $('teRotFaixa').innerHTML = '<div class="te-rot-faixa" style="color:#E06C6C;">Erro ao carregar as rotinas: ' + esc(error.message) + '</div>'; return; }
    rotinas = data || [];
    renderRotinasFaixa();
  }

  function renderRotinasFaixa(){
    const box = $('teRotFaixa');
    const pendentes = rotinasDevidasHoje().filter(r => !feitaNoPeriodo(r));
    if (!pendentes.length) { box.innerHTML = ''; return; }
    box.innerHTML = '<div class="te-rot-faixa">'
      + '<div class="te-rot-top"><span class="te-rot-tit">Rotinas de hoje</span><span style="font-size:12.5px;color:#8AAEC8;">' + pendentes.length + ' pendente(s)</span></div>'
      + pendentes.map(r =>
        '<div class="te-rot-item">'
        + '<button class="rt-check" data-marca="' + r.id + '" title="Marcar feita"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></button>'
        + '<span class="te-rot-nome">' + escF(r.titulo)
          + (r.adiada_para === hojeStr ? ' <small>↪ adiada pra hoje</small>' : '')
          + (r.responsavel ? ' <small>' + escF(r.responsavel) + '</small>' : '') + '</span>'
        + '<span class="rt-pill">' + pillTexto(r) + '</span>'
        + '<button class="rt-link" data-adia="' + r.id + '">adiar</button>'
        + '</div>').join('')
      + '</div>';
    box.querySelectorAll('[data-marca]').forEach(b => b.addEventListener('click', () => marcarRotina(b.dataset.marca)));
    box.querySelectorAll('[data-adia]').forEach(b => b.addEventListener('click', () => abrirAdiar(b.dataset.adia)));
  }

  async function marcarRotina(id){
    const r = rotinas.find(x => String(x.id) === String(id));
    if (!r) return;
    const patch = { ultima_execucao: hojeStr, ultima_por: usuarioNome, adiada_para: null };
    Object.assign(r, patch);   // atualização otimista
    renderRotinasFaixa();
    const { error } = await supabase.from('rotinas').update(patch).eq('id', r.id);
    if (error) { alert('Erro ao salvar: ' + error.message); await carregarRotinas(); }
    if ($('rotOverlay').classList.contains('is-open')) renderRotinasGerenciar();
  }

  // --- adiar ---
  let rotAdiando = null;
  const adiOverlay = $('adiOverlay');
  function abrirAdiar(id){
    const r = rotinas.find(x => String(x.id) === String(id));
    if (!r) return;
    rotAdiando = r;
    $('adiNome').textContent = r.titulo || '';
    const amanha = new Date(hojeD.getTime() + 864e5);
    $('adiData').value = r.adiada_para || toYMD(amanha);
    $('adiAtual').textContent = r.adiada_para ? ('Adiada pra ' + r.adiada_para.split('-').reverse().join('/') + '.') : '';
    $('adiVoltar').style.display = r.adiada_para ? 'inline-flex' : 'none';
    adiOverlay.classList.add('is-open');
  }
  async function salvarAdiar(valor){
    if (!rotAdiando) return;
    const { error } = await supabase.from('rotinas').update({ adiada_para: valor }).eq('id', rotAdiando.id);
    if (error) { alert('Erro ao adiar: ' + error.message); return; }
    rotAdiando.adiada_para = valor;
    adiOverlay.classList.remove('is-open');
    rotAdiando = null;
    renderRotinasFaixa();
    if ($('rotOverlay').classList.contains('is-open')) renderRotinasGerenciar();
  }
  $('adiConfirmar').addEventListener('click', () => {
    const v = $('adiData').value;
    if (!v) { alert('Escolha a data.'); return; }
    salvarAdiar(v);
  });
  $('adiVoltar').addEventListener('click', () => salvarAdiar(null));
  $('adiCancelar').addEventListener('click', () => { adiOverlay.classList.remove('is-open'); rotAdiando = null; });
  $('adiClose').addEventListener('click', () => { adiOverlay.classList.remove('is-open'); rotAdiando = null; });
  adiOverlay.addEventListener('click', e => { if (e.target === adiOverlay) { adiOverlay.classList.remove('is-open'); rotAdiando = null; } });

  // --- gerenciar (CRUD transplantado de financeiro-rotinas.html) ---
  const rotOverlay = $('rotOverlay');
  $('btnRotinas').addEventListener('click', () => { renderRotinasGerenciar(); rotOverlay.classList.add('is-open'); });
  $('rotClose').addEventListener('click', () => rotOverlay.classList.remove('is-open'));
  $('rotFechar').addEventListener('click', () => rotOverlay.classList.remove('is-open'));
  rotOverlay.addEventListener('click', e => { if (e.target === rotOverlay) rotOverlay.classList.remove('is-open'); });
  $('rotNova').addEventListener('click', () => {
    rotinaEditando = null;
    $('nvTipos').style.display = 'none';
    $('rExcluir').style.display = 'none';
    mostrarTipo('rotina');
    overlay.classList.add('is-open');
  });

  function cardRotina(r, estado, idx, total){
    const done = estado === 'feita';
    const agendada = estado === 'agendada';
    const partes = [];
    if (r.responsavel) partes.push(escF(r.responsavel));
    if (done) {
      const u = r.ultima_execucao ? new Date(String(r.ultima_execucao).slice(0,10) + 'T00:00:00') : null;
      partes.push('feito' + (u ? ' em ' + fmtDia(u) : '') + (r.ultima_por ? ' por ' + escF(r.ultima_por) : ''));
    } else if (agendada) {
      partes.push('abre ' + (periDe(r) === 'semanal' ? (SEM_NOME[r.dia_semana] || 'segunda') : fmtDia(dataGatilho(r))));
    } else {
      const g = dataGatilho(r);
      if (periDe(r) !== 'diaria' && g < hojeD) partes.push('desde ' + fmtDia(g));
      if (r.adiada_para) partes.push('adiada pra ' + r.adiada_para.split('-').reverse().join('/'));
    }
    const meta = '<span class="rt-pill">' + pillTexto(r) + '</span>' + (partes.length ? ' · ' + partes.join(' · ') : '');
    const check = agendada
      ? '<span class="rt-check rt-check-off" title="Abre depois"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 8 12 12 14 14"/></svg></span>'
      : '<button class="rt-check' + (done ? ' is-done' : '') + '" data-tg="' + r.id + '" title="' + (done ? 'Desmarcar' : 'Marcar feito') + '"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></button>';
    const setas = '<button class="rt-mv" data-mv="-1" data-id="' + r.id + '" title="Subir"' + (idx === 0 ? ' disabled' : '') + '>↑</button>'
      + '<button class="rt-mv" data-mv="1" data-id="' + r.id + '" title="Descer"' + (idx === total - 1 ? ' disabled' : '') + '>↓</button>';
    return '<div class="rt-item' + (done ? ' is-done' : '') + (agendada ? ' rt-agendada' : '') + '">'
      + check
      + '<div class="rt-body"><div class="rt-titulo">' + escF(r.titulo) + '</div>'
        + '<div class="rt-meta">' + meta + '</div>'
        + (r.descricao ? '<div class="rt-desc">' + escF(r.descricao) + '</div>' : '') + '</div>'
      + '<div class="rt-acoes">' + setas
        + '<button class="rt-link" data-act="editar" data-id="' + r.id + '">Editar</button>'
        + (C.recorrentes && periDe(r) === 'mensal' ? '<button class="rt-link" data-act="converter" data-id="' + r.id + '" title="Cria a tarefa recorrente equivalente e desativa a rotina">→ recorrente</button>' : '')
        + '<button class="rt-link" data-act="desativar" data-id="' + r.id + '">Pausar</button>'
        + '<button class="rt-link rt-del" data-act="excluir" data-id="' + r.id + '">Excluir</button>'
      + '</div></div>';
  }
  function cardRotinaInativa(r){
    return '<div class="rt-item rt-inativa">'
      + '<div class="rt-body"><div class="rt-titulo">' + escF(r.titulo) + '</div>'
        + '<div class="rt-meta"><span class="rt-pill">' + pillTexto(r) + '</span>' + (r.responsavel ? ' · ' + escF(r.responsavel) : '') + '</div></div>'
      + '<div class="rt-acoes">'
        + '<button class="rt-link" data-act="reativar" data-id="' + r.id + '">Reativar</button>'
        + '<button class="rt-link rt-del" data-act="excluir" data-id="' + r.id + '">Excluir</button>'
      + '</div></div>';
  }

  function renderRotinasGerenciar(){
    const box = $('rotLista');
    if (rotinasErro) {
      box.innerHTML = '<div class="tl-empty" style="padding:16px 4px;color:#E06C6C;">Erro ao carregar as rotinas: ' + esc(rotinasErro) + '</div>';
      return;
    }
    const ativas = rotinas.filter(r => r.ativo);
    const inativas = rotinas.filter(r => !r.ativo);
    if (!ativas.length && !inativas.length) {
      box.innerHTML = '<div class="tl-empty" style="padding:16px 4px;">Nenhuma rotina no setor ainda — crie a primeira no botão abaixo.</div>';
      return;
    }
    const feitas = [], aFazer = [], agendadas = [];
    ativas.forEach(r => {
      if (feitaNoPeriodo(r)) feitas.push(r);
      else if (gatilhoChegou(r) || r.adiada_para === hojeStr) aFazer.push(r);
      else agendadas.push(r);
    });
    let html = '';
    const bloco = (titulo, lista, estado) => {
      if (!lista.length) return;
      html += '<div class="rt-sec-title">' + titulo + '</div>';
      html += lista.map(r => cardRotina(r, estado, ativas.indexOf(r), ativas.length)).join('');
    };
    bloco('A fazer', aFazer, 'afazer');
    bloco('Feitas no período', feitas, 'feita');
    bloco('Agendadas', agendadas, 'agendada');
    if (inativas.length) { html += '<div class="rt-sec-title">Pausadas</div>'; html += inativas.map(cardRotinaInativa).join(''); }
    box.innerHTML = html;

    box.querySelectorAll('[data-tg]').forEach(b => b.addEventListener('click', () => toggleFeitoGerenciar(b.dataset.tg)));
    box.querySelectorAll('[data-mv]').forEach(b => b.addEventListener('click', () => moverRotina(b.dataset.id, Number(b.dataset.mv))));
    box.querySelectorAll('.rt-link[data-act]').forEach(b => b.addEventListener('click', () => acaoRotina(b.dataset.act, b.dataset.id)));
  }

  async function toggleFeitoGerenciar(id){
    const r = rotinas.find(x => String(x.id) === String(id));
    if (!r) return;
    const done = feitaNoPeriodo(r);
    const patch = done ? { ultima_execucao: null, ultima_por: null } : { ultima_execucao: hojeStr, ultima_por: usuarioNome, adiada_para: null };
    Object.assign(r, patch);
    renderRotinasGerenciar();
    renderRotinasFaixa();
    const { error } = await supabase.from('rotinas').update(patch).eq('id', r.id);
    if (error) { alert('Erro ao salvar: ' + error.message); await carregarRotinas(); renderRotinasGerenciar(); }
  }

  async function moverRotina(id, dir){
    const ativas = rotinas.filter(r => r.ativo);
    const i = ativas.findIndex(r => String(r.id) === String(id));
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= ativas.length) return;
    [ativas[i], ativas[j]] = [ativas[j], ativas[i]];
    // reindexa a ordem de todas as ativas do setor (lista pequena)
    for (let k = 0; k < ativas.length; k++) {
      if (ativas[k].ordem !== k + 1) {
        ativas[k].ordem = k + 1;
        const { error } = await supabase.from('rotinas').update({ ordem: k + 1 }).eq('id', ativas[k].id);
        if (error) { alert('Erro ao reordenar: ' + error.message); await carregarRotinas(); renderRotinasGerenciar(); return; }
      }
    }
    rotinas.sort((a, b) => (a.ordem || 999) - (b.ordem || 999) || (a.titulo || '').localeCompare(b.titulo || ''));
    renderRotinasGerenciar();
    renderRotinasFaixa();
  }

  async function acaoRotina(act, id){
    const r = rotinas.find(x => String(x.id) === String(id));
    if (!r) return;
    if (act === 'editar') {
      rotinaEditando = r;
      $('nvTipos').style.display = 'none';
      mostrarTipo('rotina');
      $('rTitulo').value = r.titulo || '';
      $('rResp').value = r.responsavel || '';
      $('rDesc').value = r.descricao || '';
      $('rAtivo').checked = !!r.ativo;
      $('rPeri').value = periDe(r);
      $('rDiaSemana').value = String(r.dia_semana || 1);
      $('rDiaMes').value = r.dia_mes || '';
      if (r.dia_anual) { const a = String(r.dia_anual).split('-'); $('rDiaAnualM').value = String(Number(a[0])); $('rDiaAnualD').value = String(Number(a[1])); }
      else { $('rDiaAnualM').value = '1'; $('rDiaAnualD').value = ''; }
      $('rDiaUtil').checked = !!r.dia_util;
      camposRotina();
      $('rExcluir').style.display = 'inline-flex';
      overlay.classList.add('is-open');
      return;
    }
    if (act === 'desativar') { await mutRotina({ ativo: false }, id); return; }
    if (act === 'reativar') { await mutRotina({ ativo: true }, id); return; }
    if (act === 'converter') { await converterEmRecorrente(r); return; }
    if (act === 'excluir') {
      if (!confirm('Excluir a rotina “' + r.titulo + '”?')) return;
      const { error } = await supabase.from('rotinas').delete().eq('id', id);
      if (error) { alert('Erro: ' + error.message); return; }
      await carregarRotinas();
      renderRotinasGerenciar();
    }
  }

  async function mutRotina(patch, id){
    const { error } = await supabase.from('rotinas').update(patch).eq('id', id);
    if (error) { alert('Erro: ' + error.message); return; }
    await carregarRotinas();
    renderRotinasGerenciar();
  }

  // nice-to-have: rotina MENSAL → tarefa recorrente equivalente (nunca o inverso).
  // Só mensal: a geração do mês materializa apenas regras mensais — converter
  // outra periodicidade criaria regra morta e sumiria com o trabalho.
  async function converterEmRecorrente(r){
    if (periDe(r) !== 'mensal') { alert('Só rotinas mensais têm tarefa recorrente equivalente — a geração do mês trabalha com regras mensais.'); return; }
    if (!confirm('Converter “' + r.titulo + '” em tarefa recorrente? A recorrente equivalente é criada na base de regras e a rotina fica pausada.')) return;
    const payload = {
      setor: SETOR, titulo: r.titulo, descricao: r.descricao || null,
      responsavel: r.responsavel || null, periodicidade: 'mensal',
      dia_vencimento: r.dia_mes || null, mes_vencimento: null,
      cliente_id: null, ativo: true, origem: 'manual'
    };
    const { error } = await supabase.from('tarefas_recorrentes').insert(payload);
    if (error) { alert('Erro ao criar a recorrente: ' + error.message); return; }
    const { error: e2 } = await supabase.from('rotinas').update({ ativo: false }).eq('id', r.id);
    if (e2) { alert('Recorrente criada, mas a rotina não pôde ser pausada: ' + e2.message); }
    await carregarRotinas();
    renderRotinasGerenciar();
    alert('Tarefa recorrente criada; a rotina foi pausada.');
  }
}
