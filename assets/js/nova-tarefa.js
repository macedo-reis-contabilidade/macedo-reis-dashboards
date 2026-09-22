// ============================================================
// MACEDO & REIS - Nova tarefa (formulário único, 17/09/2026)
// Um só formulário pra criar tarefa em qualquer lugar: Agenda e telas de
// Tarefas dos setores. Tarefa, recorrente ou rotina deixaram de ser abas:
// é uma tarefa, e o campo "Repetir" diz se ela se repete.
//
// Onde cada escolha vai parar (sem mudar o modelo do banco):
//   Repetir = Não .................. tarefas (uma por cliente; sem cliente = uma interna)
//   Repetir ≠ Não, sem cliente ..... rotinas (quadro "Rotinas do dia" / Rotinas do setor)
//   Repetir mensal/anual, com cliente  tarefas_recorrentes (uma regra por cliente)
//                                      + a primeira tarefa já nasce; as seguintes, a função gerar_tarefas_recorrentes (pg_cron, diária)
//   Repetir diária/semanal, com cliente  ainda não existe — o formulário avisa
// ============================================================
import { supabase } from './supabase.js';

export const SETORES = [
  ['clientes', 'Clientes'], ['dp', 'DP'], ['fiscal', 'Fiscal'], ['contabil', 'Contábil'],
  ['societario', 'Societário'], ['financeiro', 'Financeiro'], ['comercial', 'Comercial'],
  ['irpf', 'IRPF'], ['gestao', 'Gestão'], ['geral', 'Geral'],
];
const EQUIPE_PADRAO = ['Thalia', 'Vitória', 'Adaini', 'Samuel', 'Diego', 'Edna'];
const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const ymd = d => d.toISOString().slice(0, 10);

let el = null, clis = [], timer = null, cfg = {};

function montar() {
  if (el) return;
  el = document.createElement('div');
  el.className = 'fa-modal-overlay';
  el.id = 'ntOverlay';
  el.innerHTML = `
    <div class="fa-modal" style="max-width:620px;">
      <div class="fa-modal-head"><h3>Nova tarefa</h3><button class="fa-modal-close" id="ntClose">&times;</button></div>
      <div class="fa-modal-body">
        <label class="fa-field"><span>O que precisa ser feito? *</span><input type="text" id="ntTitulo" class="input" placeholder="Ex.: Conciliação bancária de maio"></label>
        <div class="fa-field-row">
          <label class="fa-field"><span>Setor</span><select id="ntSetor" class="select">${SETORES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
          <label class="fa-field"><span>Responsável</span><select id="ntResp" class="select"><option value="">— ninguém ainda —</option></select></label>
        </div>
        <label class="fa-field"><span>Cliente(s) <i style="font-style:normal;color:var(--text-dim);">— opcional; pode escolher vários, cada um vira uma tarefa própria</i></span>
          <input type="text" id="ntCliBusca" class="input" placeholder="Buscar por razão ou fantasia… (3+ letras)" autocomplete="off"></label>
        <div id="ntCliRes" class="nt-res" style="display:none;"></div>
        <div id="ntCliChips" class="cli-chips"></div>
        <div class="fa-field-row">
          <label class="fa-field"><span>Prazo</span><input type="date" id="ntPrazo" class="input"></label>
          <label class="fa-field"><span>Prioridade</span><select id="ntPri" class="select"><option value="media">Média</option><option value="alta">Alta</option><option value="baixa">Baixa</option></select></label>
        </div>
        <div class="fa-field-row">
          <label class="fa-field"><span>🔁 Repetir</span><select id="ntRep" class="select">
            <option value="nao">Não — tarefa única</option>
            <option value="diaria">Todo dia</option>
            <option value="semanal">Toda semana</option>
            <option value="mensal">Todo mês</option>
            <option value="anual">Todo ano</option>
          </select></label>
          <label class="fa-field" id="ntWrapSemana" style="display:none;"><span>Dia da semana</span><select id="ntSemana" class="select">
            <option value="1">Segunda</option><option value="2">Terça</option><option value="3">Quarta</option><option value="4">Quinta</option><option value="5">Sexta</option><option value="6">Sábado</option><option value="0">Domingo</option>
          </select></label>
          <label class="fa-field" id="ntWrapMes" style="display:none;"><span>Dia do mês</span><input type="number" id="ntDiaMes" class="input" min="1" max="31" value="1"></label>
          <label class="fa-field" id="ntWrapAnual" style="display:none;"><span>Data (MM-DD)</span><input type="text" id="ntAnual" class="input" placeholder="ex.: 01-15"></label>
        </div>
        <label id="ntWrapUtil" style="display:none; align-items:center; gap:8px; font-size:12.5px; color:var(--text-2); margin:-4px 0 12px; cursor:pointer;"><input type="checkbox" id="ntUtil" checked> Se cair no fim de semana, vale o próximo dia útil</label>
        <div id="ntRepDica" class="nt-dica" style="display:none;"></div>
        <label class="fa-field"><span>Descrição (opcional)</span><textarea id="ntDesc" class="input" rows="3"></textarea></label>
      </div>
      <div class="fa-modal-foot">
        <button class="btn btn-ghost" id="ntCancelar">Cancelar</button>
        <button class="btn btn-primary" id="ntSalvar">Criar tarefa</button>
      </div>
    </div>`;
  document.body.appendChild(el);
  const $ = id => el.querySelector('#' + id);

  $('ntClose').addEventListener('click', fechar);
  $('ntCancelar').addEventListener('click', fechar);
  el.addEventListener('click', e => { if (e.target === el) fechar(); });
  $('ntRep').addEventListener('change', atualizarRep);
  $('ntSalvar').addEventListener('click', salvar);

  $('ntCliBusca').addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const t = $('ntCliBusca').value.trim();
      const res = $('ntCliRes');
      if (t.length < 3) { res.style.display = 'none'; return; }
      const { data } = await supabase.from('clientes')
        .select('id, nome_principal, nome_fantasia, cidade')
        .or(`nome_principal.ilike.*${t}*,nome_fantasia.ilike.*${t}*,nome_busca.ilike.*${t.toLowerCase().replace(/[^a-z0-9]/g, '') || t}*`).limit(8);
      res.innerHTML = (data || []).map(c => `<button type="button" data-id="${esc(c.id)}" data-nome="${esc(c.nome_principal)}">${esc(c.nome_principal)}<small>${esc([c.nome_fantasia, c.cidade].filter(Boolean).join(' · '))}</small></button>`).join('')
        || '<button type="button" disabled>Nada encontrado.</button>';
      res.style.display = 'block';
      res.querySelectorAll('[data-id]').forEach(b => b.addEventListener('click', () => {
        if (!clis.some(c => c.id === b.dataset.id)) clis.push({ id: b.dataset.id, nome: b.dataset.nome });
        renderClis(); $('ntCliBusca').value = ''; res.style.display = 'none'; $('ntCliBusca').focus();
      }));
    }, 300);
  });
}

function $(id) { return el.querySelector('#' + id); }

function renderClis() {
  const box = $('ntCliChips');
  box.innerHTML = clis.map(c => `<span class="chip">🏢 ${esc(c.nome)} <a href="#" data-tira="${esc(c.id)}" title="Tirar">✕</a></span>`).join('');
  box.querySelectorAll('[data-tira]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); clis = clis.filter(c => c.id !== a.dataset.tira); renderClis(); }));
  atualizarRep();
}

function atualizarRep() {
  const rep = $('ntRep').value;
  $('ntWrapSemana').style.display = rep === 'semanal' ? '' : 'none';
  $('ntWrapMes').style.display = rep === 'mensal' ? '' : 'none';
  $('ntWrapAnual').style.display = rep === 'anual' ? '' : 'none';
  $('ntWrapUtil').style.display = (rep === 'mensal' || rep === 'anual') ? 'flex' : 'none';
  $('ntPrazo').closest('label').style.display = rep === 'nao' ? '' : 'none';
  const n = clis.length;
  const dica = $('ntRepDica');
  let txt = '', btn = 'Criar tarefa';
  if (rep === 'nao') { btn = n > 1 ? `Criar ${n} tarefas` : 'Criar tarefa'; }
  else if (!n) { txt = 'Sem cliente, vira uma rotina do setor: aparece em "Rotinas do dia" e se marca como feita a cada vez.'; btn = 'Criar rotina'; }
  else if (rep === 'mensal' || rep === 'anual') { txt = `Vira uma regra por cliente (${n}); a primeira tarefa já nasce com prazo na próxima ocorrência e as seguintes nascem sozinhas, todo dia de madrugada.`; btn = n > 1 ? `Criar ${n} recorrências` : 'Criar recorrência'; }
  else { txt = 'Repetição diária ou semanal por cliente ainda não existe: escolha mensal/anual, ou tire os clientes pra virar rotina.'; btn = 'Criar'; }
  dica.textContent = txt; dica.style.display = txt ? 'block' : 'none';
  $('ntSalvar').textContent = btn;
}

function proximaOcorrencia(rep, diaMes, mmdd) {
  const hoje = new Date(); hoje.setHours(12, 0, 0, 0);
  let d;
  if (rep === 'mensal') {
    d = new Date(hoje.getFullYear(), hoje.getMonth(), Math.min(diaMes, 28), 12);
    if (ymd(d) < ymd(hoje)) d = new Date(hoje.getFullYear(), hoje.getMonth() + 1, Math.min(diaMes, 28), 12);
    // dia 29–31: usa o último dia do mês quando não existe
    const ult = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(diaMes, ult));
  } else {
    const [mm, dd] = mmdd.split('-').map(Number);
    d = new Date(hoje.getFullYear(), mm - 1, dd, 12);
    if (ymd(d) < ymd(hoje)) d = new Date(hoje.getFullYear() + 1, mm - 1, dd, 12);
  }
  return d;
}

async function salvar() {
  const titulo = $('ntTitulo').value.trim();
  if (!titulo) { alert('Dá um nome pra tarefa, pelo menos isso.'); $('ntTitulo').focus(); return; }
  const rep = $('ntRep').value;
  const setor = $('ntSetor').value;
  const responsavel = $('ntResp').value || null;
  const descricao = $('ntDesc').value.trim() || null;
  const autor = cfg.usuarioEmail || null;
  const btn = $('ntSalvar'); btn.disabled = true;
  try {
    if (rep === 'nao') {
      const base = { setor, titulo, descricao, responsavel, prazo: $('ntPrazo').value || null, prioridade: $('ntPri').value, tipo: 'tarefa', status: 'pendente', origem: 'avulsa' };
      const ids = clis.length ? clis.map(c => c.id) : [null];
      const { data: ins, error } = await supabase.from('tarefas').insert(ids.map(cliente_id => ({ ...base, cliente_id }))).select('id');
      if (error) { alert('Erro ao criar: ' + error.message); return; }
      if (ins?.length) await supabase.from('tarefa_historico').insert(ins.map(t => ({ tarefa_id: t.id, descricao: (cfg.historico || 'Tarefa cadastrada.') + (ids.length > 1 ? ` (lote de ${ids.length} clientes)` : ''), autor })));
      fechar(); await cfg.aoSalvar?.('tarefa', ins?.length || 0); return;
    }
    if (rep === 'anual' && !/^\d{2}-\d{2}$/.test($('ntAnual').value.trim())) { alert('Data anual no formato MM-DD, ex.: 01-15'); return; }
    const diaMes = Math.min(31, Math.max(1, parseInt($('ntDiaMes').value || '1', 10)));
    const mmdd = $('ntAnual').value.trim();
    if (!clis.length) {
      const rotina = { titulo, setor, responsavel, descricao, periodicidade: rep, ativo: true, ordem: 999,
        dia_semana: rep === 'semanal' ? parseInt($('ntSemana').value, 10) : null,
        dia_mes: rep === 'mensal' ? diaMes : null,
        dia_anual: rep === 'anual' ? mmdd : null,
        dia_util: (rep === 'mensal' || rep === 'anual') ? $('ntUtil').checked : false };
      const { error } = await supabase.from('rotinas').insert(rotina);
      if (error) { alert('Erro ao criar a rotina: ' + error.message); return; }
      fechar(); await cfg.aoSalvar?.('rotina', 1); return;
    }
    if (rep !== 'mensal' && rep !== 'anual') { alert('Repetição diária ou semanal por cliente ainda não existe. Escolha mensal/anual, ou tire os clientes pra virar rotina.'); return; }
    const regras = clis.map(c => ({ cliente_id: c.id, setor, titulo, descricao, responsavel, periodicidade: rep, ativo: true, origem: 'manual', dia_util: $('ntUtil').checked,
      dia_vencimento: rep === 'mensal' ? diaMes : parseInt(mmdd.slice(3), 10),
      mes_vencimento: rep === 'anual' ? parseInt(mmdd.slice(0, 2), 10) : null }));
    const { data: rIns, error: rErr } = await supabase.from('tarefas_recorrentes').insert(regras).select('id, cliente_id');
    if (rErr) { alert('Erro ao criar a recorrência: ' + rErr.message); return; }
    // primeira tarefa de cada regra: prazo na próxima ocorrência (a função diária pula regra+competência já existentes)
    let d = proximaOcorrencia(rep, diaMes, mmdd);
    if ($('ntUtil').checked) { while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1); }
    const prazo = ymd(d), competencia = prazo.slice(0, 7);
    const primeiras = (rIns || []).map(r => ({ cliente_id: r.cliente_id, setor, titulo, descricao, responsavel, prazo, status: 'pendente', prioridade: 'media', origem: 'recorrente', regra_id: r.id, competencia }));
    const { data: tIns, error: tErr } = await supabase.from('tarefas').insert(primeiras).select('id');
    if (tErr) { alert('Recorrência criada, mas a primeira tarefa falhou: ' + tErr.message); }
    else if (tIns?.length) await supabase.from('tarefa_historico').insert(tIns.map(t => ({ tarefa_id: t.id, descricao: `Primeira tarefa da recorrência ${rep} (${regras.length > 1 ? 'lote de ' + regras.length + ' clientes' : '1 cliente'}).`, autor })));
    fechar(); await cfg.aoSalvar?.('recorrente', regras.length);
  } catch (e) {
    alert('Falha inesperada: ' + e.message);
  } finally {
    btn.disabled = false;
  }
}

function fechar() { if (el) el.classList.remove('is-open'); }

/**
 * Abre o formulário único.
 * @param {object} opts
 *   setor        setor pré-selecionado (ex.: 'contabil'); padrão 'geral'
 *   responsaveis lista de nomes pro select; padrão equipe do escritório
 *   usuarioEmail autor do histórico
 *   historico    texto do histórico da tarefa criada (padrão 'Tarefa cadastrada.')
 *   aoSalvar     async (tipo, quantidade) chamado depois de salvar — 'tarefa' | 'rotina' | 'recorrente'
 */
export function abrirNovaTarefa(opts = {}) {
  montar(); cfg = opts; clis = [];
  const resp = $('ntResp');
  resp.innerHTML = '<option value="">— ninguém ainda —</option>' + (opts.responsaveis || EQUIPE_PADRAO).map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
  ['ntTitulo', 'ntCliBusca', 'ntDesc', 'ntAnual'].forEach(id => $(id).value = '');
  $('ntSetor').value = SETORES.some(([v]) => v === opts.setor) ? opts.setor : 'geral';
  $('ntPrazo').value = ymd(new Date());
  $('ntPri').value = 'media'; $('ntRep').value = 'nao'; $('ntDiaMes').value = '1'; $('ntUtil').checked = true;
  $('ntCliRes').style.display = 'none';
  renderClis();
  el.classList.add('is-open');
  setTimeout(() => $('ntTitulo').focus(), 50);
}
