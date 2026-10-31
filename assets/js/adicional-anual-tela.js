// ============================================================
// MACEDO & REIS — A janela "Honorário adicional anual" da tela Boletos (31/10/2026, pedido do Samuel): a lista empresa
// por empresa — o que foi cobrado nos três anos anteriores, a mensalidade de outubro, o proporcional de quem entrou no
// ano, as isentas, o valor, o vencimento e a conta (editáveis) — e o lançamento das vendas no Conta Azul, com o
// adicional junto no boleto de outubro (o mesmo boleto do honorário, como item extra) e a tarefa da Thalia pras NFS-e.
// Quem monta a lista e lança é a função ca-vendas (só os sócios); as regras, assets/js/adicional-anual.js.
// Usa as classes da tela Boletos (.ov, .ov-box, .ci, table.bo) e estilo em linha no resto.
// Teste de tela: tests/harness/adicional-anual.py.
// ============================================================
import { ROTULOS, mesBR, proximoDiaUtil, tarefaDasNotas, juntarNaTarefa, tirarDaTarefa, centavos } from './adicional-anual.js';
import { criarTarefasAvulsas, excluirTarefasCriadas } from './tarefas-acoes.js';
import { nomePorEmail } from './equipe.js';
import { somaDias } from './rescisao-datas.js';

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const BRL = n => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dataBR = iso => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '');
const diaMes = iso => (iso ? String(iso).slice(8, 10) + '/' + String(iso).slice(5, 7) : '');
const plural = (n, um, varios) => n + ' ' + (n === 1 ? um : varios);
const LOTE = 20;
const ESPERA_RENOVANDO_MS = 20000;
const GRUPOS = ['sugerida', 'nova', 'isenta', 'sem_mensal', 'mei', 'lancada'];
const DE_CONTA = { boleto: 'a do boleto (Inter)', ano_anterior: 'a do ano passado', modelo: 'a da venda modelo' };
const STATUS_BOLETO = { a_emitir: 'a emitir', emitido: 'emitido', enviado: 'enviado', pago: 'pago', cancelado: 'cancelado' };

// a resposta de erro da função, em português
async function mensagemDe(error) {
  const r = error && error.context;
  try { if (r && typeof r.json === 'function') { const j = await (typeof r.clone === 'function' ? r.clone() : r).json(); if (j && j.erro) return { texto: String(j.erro), renovando: !!j.renovando }; } } catch (e) { /* sem corpo */ }
  const st = r && r.status;
  if (st === 401) return { texto: 'Sua sessão expirou: saia e entre de novo no sistema.' };
  if (st === 403) return { texto: 'Só os sócios lançam vendas no Conta Azul.' };
  return { texto: 'Não consegui falar com o Conta Azul agora. Tente de novo em instantes.' };
}

// a espera do "renovando": o teste de tela encurta por window.__adicionalEsperaMs
export async function abrirAdicionalAnual({ supabase, email, competencia, aoMudar = () => {},
  esperaRenovando = (typeof window !== 'undefined' && Number(window.__adicionalEsperaMs)) || ESPERA_RENOVANDO_MS }) {
  const antiga = document.getElementById('aaOv');
  if (antiga) antiga.remove();
  const ov = document.createElement('div');
  ov.className = 'ov open';
  ov.id = 'aaOv';
  ov.setAttribute('role', 'dialog');
  ov.setAttribute('aria-modal', 'true');
  ov.setAttribute('aria-labelledby', 'aaTitulo');
  ov.style.zIndex = '200';
  ov.style.padding = '24px 16px';
  ov.innerHTML = `<div class="ov-box" style="max-width:1320px;max-height:94vh;">
    <div class="ov-head"><h3 id="aaTitulo">Honorário adicional anual de ${esc(mesBR(competencia))}</h3>
      <button class="btn btn-ghost btn-sm" id="aaFechar" data-janela-fechar>Fechar</button></div>
    <div class="ov-body" id="aaBody" style="padding:14px 20px;"></div>
  </div>`;
  const deOnde = document.activeElement;
  document.body.appendChild(ov);
  const corpo = ov.querySelector('#aaBody');
  const est = { dados: null, filtro: 'todas', busca: '', rodando: false, porPessoa: new Map(), daJanela: [], aviso: null };
  ov.querySelector('#aaFechar').focus();
  const autor = nomePorEmail(email) || email;

  // fechar com empresa marcada e mudança que ainda não foi pro Conta Azul pergunta antes (a lista não fica gravada)
  const fechar = () => {
    if (est.rodando) return;
    if (est.mexeu && est.dados && prontas().length && !window.confirm('Fechar sem lançar? O que você mudou na lista se perde.')) return;
    ov.remove();
    if (deOnde && typeof deOnde.focus === 'function' && document.contains(deOnde)) deOnde.focus();
  };
  ov.querySelector('#aaFechar').addEventListener('click', fechar);

  // a função, com a espera quando o Conta Azul está renovando a conexão
  async function chamar(corpoPedido, aoEsperar = () => {}) {
    for (let t = 0; t < 7; t++) {
      let data = null, error = null;
      try { ({ data, error } = await supabase.functions.invoke('ca-vendas', { body: corpoPedido })); }
      catch (e) { throw new Error('Não consegui falar com o sistema. Confira a internet e tente de novo.'); }
      if (!error && data && !data.erro) return data;
      const m = error ? await mensagemDe(error) : { texto: String((data && data.erro) || 'Erro'), renovando: !!(data && data.renovando) };
      if (!m.renovando || t === 6) throw new Error(m.texto);
      aoEsperar(Math.round(esperaRenovando / 1000));
      await new Promise(r => setTimeout(r, esperaRenovando));
    }
    throw new Error('O Conta Azul não respondeu. Tente de novo em alguns minutos.');
  }

  async function carregar() {
    corpo.innerHTML = '<p style="color:var(--text-muted);font-size:13px;margin:6px 0 14px;"><span class="spin"></span>Lendo o Conta Azul: a mensalidade de '
      + esc(mesBR(competencia)) + ', o que foi cobrado nos três anos anteriores e as contas de cada empresa. Leva uns 30 segundos.</p>';
    try {
      const d = await chamar({ modo: 'prever', competencia }, s => {
        corpo.innerHTML = '<p style="color:var(--text-muted);font-size:13px;"><span class="spin"></span>O Conta Azul está renovando a conexão. Tento de novo em ' + s + ' s.</p>';
      });
      est.dados = d;
      est.mexeu = false;
      est.porPessoa = new Map(d.itens.map(i => [i.pessoa, { ...i, valorTela: i.valor == null ? '' : String(i.valor), vencTela: i.vencimento || '', contaTela: (i.conta && i.conta.id) || '' }]));
      desenhar();
    } catch (e) {
      ov.querySelector('#aaFechar').disabled = false;
      corpo.innerHTML = '<p style="color:var(--err);font-size:13.5px;">' + esc(e.message) + '</p><button class="btn btn-ghost btn-sm" id="aaDeNovo">Tentar de novo</button>';
      corpo.querySelector('#aaDeNovo').addEventListener('click', carregar);
    }
  }

  const itens = () => [...est.porPessoa.values()];
  const visiveis = () => itens().filter(i => (est.filtro === 'todas' || i.grupo === est.filtro)
    && (!est.busca || (i.nome + ' ' + (i.cliente_nome || '')).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(est.busca)));
  const valorDe = i => { const v = Number(String(i.valorTela).replace(',', '.')); return Number.isFinite(v) ? v : 0; };
  const prontas = () => itens().filter(i => i.marcada && i.grupo !== 'lancada' && valorDe(i) > 0 && i.vencTela)
    .sort((a, b) => GRUPOS.indexOf(a.grupo) - GRUPOS.indexOf(b.grupo) || a.nome.localeCompare(b.nome, 'pt-BR'));
  const totalProntas = () => prontas().reduce((s, i) => s + centavos(valorDe(i)), 0) / 100;

  function celulaAno(h) {
    if (!h) return '<span style="color:var(--text-muted)">—</span>';
    if (h.valor != null) return BRL(h.valor) + (h.parcelas > 1 ? ' <small style="color:var(--text-muted)">(' + h.parcelas + 'x)</small>' : '');
    if (h.mei) return '<span style="color:var(--text-muted)" title="contrato MEI">MEI</span>';
    if (h.isento) return '<span style="color:var(--warn)" title="tinha mensalidade de ' + esc(BRL(h.mensal)) + ' e não pagou">isento</span>';
    return '<span style="color:var(--text-muted)">—</span>';
  }
  function celulaBoleto(i) {
    if (i.grupo === 'lancada') {
      if (!i.lancada || i.lancada.de !== 'sistema') return '<span style="color:var(--text-muted)">—</span>';
      return i.lancada.no_boleto ? '<span style="color:var(--ok)">no boleto</span>' : '<span style="color:var(--warn)">fora do boleto</span>';
    }
    if (!i.cliente_id) return '<span style="color:var(--warn)" title="a empresa do Conta Azul não foi achada no cadastro: o adicional não entra no boleto">sem cadastro</span>';
    if (!i.boleto) return '<span style="color:var(--text-muted)">sem boleto</span>';
    const st = STATUS_BOLETO[i.boleto.status] || i.boleto.status;
    return i.boleto.status === 'a_emitir' ? esc(st) + ' · ' + esc(diaMes(i.boleto.vencimento)) : '<span style="color:var(--warn)" title="o boleto já saiu: o adicional não entra nele">' + esc(st) + '</span>';
  }
  function linha(i) {
    const d = est.dados;
    const lanc = i.grupo === 'lancada';
    const opcoes = (d.contas || []).map(c => `<option value="${esc(c.id)}"${c.id === i.contaTela ? ' selected' : ''}>${esc(c.nome)}</option>`).join('');
    const cad = i.cliente_nome && i.cliente_nome !== i.nome ? '<small>' + esc(i.cliente_nome) + '</small>' : '';
    const resultado = i.erro ? '<div style="color:var(--err);font-size:11.5px;margin-top:3px;">' + esc(i.erro) + '</div>' : '';
    const sit = lanc
      ? (i.lancada && i.lancada.numero ? '<span style="color:var(--ok)">✓ venda ' + esc(i.lancada.numero) + '</span>' : '<span style="color:var(--ok)">✓ lançada</span>') + (i.lancada && i.lancada.de === 'conta_azul' ? '<small style="display:block;color:var(--text-muted)">lançada fora do sistema</small>' : '')
      : '';
    return `<tr data-pessoa="${esc(i.pessoa)}"${i.grupo === 'mei' || i.grupo === 'sem_mensal' ? ' style="opacity:.78"' : ''}>
      <td style="text-align:center;"><input type="checkbox" data-marcar aria-label="Lançar o adicional de ${esc(i.nome)}"${i.marcada ? ' checked' : ''}${lanc ? ' disabled' : ''}></td>
      <td class="bo-emp" style="max-width:260px;">${esc(i.nome)}${cad}<small style="color:var(--text-muted)">${esc(i.motivo || '')}</small>${resultado}</td>
      ${d.anos.map(a => `<td style="white-space:nowrap;font-size:12px;">${celulaAno(i.historico && i.historico[a])}</td>`).join('')}
      <td style="white-space:nowrap;font-size:12px;">${i.mensal ? BRL(i.mensal.valor) + '<small style="display:block;color:var(--text-muted)">vence ' + esc(diaMes(i.mensal.vencimento)) + '</small>' : '<span style="color:var(--text-muted)">—</span>'}</td>
      <td style="text-align:center;font-size:12px;${i.meses < 12 ? 'color:var(--warn);font-weight:600;' : 'color:var(--text-muted);'}">${i.mensal ? i.meses + '/12' : ''}</td>
      <td>${lanc ? BRL(i.valor) : `<input class="ci val" type="number" step="0.01" min="0" data-f="valor" value="${esc(i.valorTela)}" aria-label="Valor do adicional de ${esc(i.nome)}" style="width:92px;">`}</td>
      <td>${lanc ? esc(dataBR(i.vencimento)) : `<input class="ci dt" type="date" data-f="venc" value="${esc(i.vencTela)}" aria-label="Vencimento do adicional de ${esc(i.nome)}">`}${!lanc && i.vencimento_de === 'mensalidade_ajustada' ? '<small style="display:block;color:var(--text-muted);font-size:11px;">a de outubro venceu ' + esc(diaMes(i.vencimento_antes)) + '</small>' : ''}</td>
      <td>${lanc ? '' : `<select class="ci" data-f="conta" aria-label="Conta do adicional de ${esc(i.nome)}" style="width:150px;">${opcoes}</select>${i.conta && i.conta.de ? '<small style="display:block;color:var(--text-muted);font-size:11px;">' + esc(DE_CONTA[i.conta.de] || '') + '</small>' : ''}`}</td>
      <td style="font-size:12px;white-space:nowrap;">${celulaBoleto(i)}</td>
      <td style="font-size:12px;white-space:nowrap;">${sit}</td>
    </tr>`;
  }

  function desenhar() {
    const d = est.dados;
    ov.querySelector('#aaFechar').disabled = est.rodando;
    const r = { total: 0, grupos: Object.fromEntries(GRUPOS.map(g => [g, 0])) };
    for (const i of itens()) { r.total++; r.grupos[i.grupo]++; }
    const daSessao = est.daJanela.length;
    const lancadasSistema = itens().filter(i => i.grupo === 'lancada' && i.lancada && i.lancada.de === 'sistema');
    const foraDoBoleto = lancadasSistema.filter(i => !i.lancada.no_boleto && i.boleto && i.boleto.status === 'a_emitir');
    const card = (g, rot, n) => `<button type="button" class="fa-focus-card" data-filtro="${g}" aria-pressed="${est.filtro === g}" style="cursor:pointer;text-align:left;font:inherit;color:inherit;${est.filtro === g ? 'border-color:var(--brand-primary);background:rgba(91,130,166,.14);' : ''}"><span class="fc-num">${n}</span><span class="fc-lbl">${esc(rot)}</span></button>`;
    const nProntas = prontas().length;
    corpo.innerHTML = `
      <p style="font-size:13px;color:var(--text-muted);margin:0 0 10px;line-height:1.55;">
        As vendas entram com data de ${esc(dataBR(d.data_venda))}${d.modelo ? `, copiando a venda ${esc(d.modelo.numero)} de ${esc(dataBR(d.modelo.data))} (${esc(d.modelo.cliente || '')}): serviço <b>${esc(d.modelo.servico || '')}</b>, vendedor ${esc(d.modelo.vendedor || '—')}` : ''}.
        O adicional vai no mesmo boleto do honorário de ${esc(mesBR(competencia))}, como item extra. A NFS-e de cada venda, a Thalia emite no Conta Azul.</p>
      ${(d.avisos || []).map(a => `<div style="background:rgba(227,179,65,.12);border:1px solid rgba(227,179,65,.4);color:var(--warn);border-radius:10px;padding:8px 12px;font-size:12.5px;margin-bottom:8px;">${esc(a)}</div>`).join('')}
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin:12px 0;">
        ${card('todas', 'Todas', r.total)}${GRUPOS.map(g => card(g, ROTULOS[g], r.grupos[g])).join('')}
      </div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px;">
        <input type="text" class="input input-search" id="aaBusca" placeholder="Buscar empresa…" value="${esc(est.busca)}" style="max-width:280px;">
        <span style="font-size:12px;color:var(--text-muted);">Marcadas pra lançar: <b style="color:var(--text);" id="aaTot">${plural(nProntas, 'empresa', 'empresas')} · ${BRL(totalProntas())}</b></span>
      </div>
      <div style="overflow:auto;max-height:52vh;border:1px solid var(--line);border-radius:10px;">
        <table class="bo" style="width:100%;">
          <thead style="position:sticky;top:0;background:var(--surface);z-index:1;"><tr>
            <th style="width:30px;"></th><th>Empresa</th>${d.anos.map(a => '<th>' + a + '</th>').join('')}
            <th>Mensal ${esc(mesBR(competencia))}</th><th>Meses</th><th>Valor</th><th>Vencimento</th><th>Conta</th><th>Boleto</th><th></th>
          </tr></thead>
          <tbody>${visiveis().map(linha).join('') || '<tr><td colspan="12" style="text-align:center;color:var(--text-muted);padding:22px;">Nenhuma empresa aqui.</td></tr>'}</tbody>
        </table>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-top:12px;">
        <div style="display:flex;flex-direction:column;gap:5px;font-size:12.5px;color:var(--text-2);">
          <label><input type="checkbox" id="aaBoleto" checked> Pôr no boleto de ${esc(mesBR(competencia))} (os a emitir)</label>
          <label><input type="checkbox" id="aaTarefa" checked> Criar a tarefa da Thalia pra emitir as NFS-e</label>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
          ${daSessao ? `<button class="btn btn-ghost btn-sm" id="aaDesfazer">${daSessao === 1 ? 'Desfazer a lançada agora' : 'Desfazer as ' + daSessao + ' lançadas agora'}</button>` : ''}
          ${foraDoBoleto.length ? `<button class="btn btn-ghost btn-sm" id="aaPorBoleto">${foraDoBoleto.length === 1 ? 'Pôr no boleto a que falta' : 'Pôr no boleto as ' + foraDoBoleto.length + ' que faltam'}</button>` : ''}
          ${d.modelo && !lancadasSistema.length && nProntas > 1 ? '<button class="btn btn-ghost" id="aaPrimeira">Lançar a primeira pra conferir</button>' : ''}
          <button class="btn btn-primary" id="aaLancar"${nProntas && d.modelo ? '' : ' disabled'}>Lançar ${plural(nProntas, 'marcada', 'marcadas')} no Conta Azul</button>
        </div>
      </div>
      <div id="aaMsg" role="status" aria-live="polite" style="font-size:13px;color:var(--text-muted);min-height:18px;margin-top:8px;">${est.aviso ? est.aviso : ''}</div>`;
    ligar();
  }

  function atualizarTotal() {
    const n = prontas().length;
    const t = corpo.querySelector('#aaTot'); if (t) t.textContent = plural(n, 'empresa', 'empresas') + ' · ' + BRL(totalProntas());
    const b = corpo.querySelector('#aaLancar'); if (b) { b.textContent = 'Lançar ' + plural(n, 'marcada', 'marcadas') + ' no Conta Azul'; b.disabled = !n || est.rodando || !est.dados.modelo; }
  }
  const msg = (html, cor) => { const m = corpo.querySelector('#aaMsg'); if (m) { m.innerHTML = html; m.style.color = cor || 'var(--text-muted)'; } };

  function ligar() {
    corpo.querySelectorAll('[data-filtro]').forEach(b => b.addEventListener('click', () => { est.filtro = b.dataset.filtro; est.aviso = null; desenhar(); }));
    const busca = corpo.querySelector('#aaBusca');
    busca.addEventListener('input', () => {
      est.busca = busca.value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const pos = busca.selectionStart;
      desenhar();
      const nova = corpo.querySelector('#aaBusca'); nova.focus(); try { nova.setSelectionRange(pos, pos); } catch (e) { /* ok */ }
    });
    corpo.querySelectorAll('tr[data-pessoa]').forEach(tr => {
      const i = est.porPessoa.get(tr.dataset.pessoa);
      if (!i) return;
      const cx = tr.querySelector('[data-marcar]');
      if (cx) cx.addEventListener('change', () => { i.marcada = cx.checked; est.mexeu = true; atualizarTotal(); });
      tr.querySelectorAll('[data-f]').forEach(el => el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => {
        if (el.dataset.f === 'valor') i.valorTela = el.value;
        else if (el.dataset.f === 'venc') i.vencTela = el.value;
        else i.contaTela = el.value;
        est.mexeu = true;
        atualizarTotal();
      }));
    });
    const lancar = corpo.querySelector('#aaLancar'); if (lancar) lancar.addEventListener('click', () => lancarMarcadas(false));
    const primeira = corpo.querySelector('#aaPrimeira'); if (primeira) primeira.addEventListener('click', () => lancarMarcadas(true));
    const desf = corpo.querySelector('#aaDesfazer'); if (desf) desf.addEventListener('click', desfazer);
    const pb = corpo.querySelector('#aaPorBoleto'); if (pb) pb.addEventListener('click', porNoBoleto);
  }

  function travar(sim) {
    est.rodando = sim;
    corpo.querySelectorAll('button, input, select').forEach(el => { el.disabled = sim || (el.id === 'aaLancar' && (!prontas().length || !est.dados.modelo)) || (el.hasAttribute('data-marcar') && el.closest('tr') && est.porPessoa.get(el.closest('tr').dataset.pessoa)?.grupo === 'lancada'); });
    const f = ov.querySelector('#aaFechar'); if (f) f.disabled = sim;
  }

  async function lancarMarcadas(soPrimeira) {
    const fila = prontas();
    if (!fila.length) return;
    const alvo = soPrimeira ? fila.slice(0, 1) : fila;
    if (!soPrimeira && !window.confirm('Lançar ' + plural(alvo.length, 'venda', 'vendas') + ' no Conta Azul, num total de ' + BRL(totalProntas()) + '?')) return;
    const comBoleto = corpo.querySelector('#aaBoleto').checked;
    const comTarefa = corpo.querySelector('#aaTarefa').checked;
    travar(true);
    let ok = 0, falhas = 0;
    try {
      for (let k = 0; k < alvo.length; k += LOTE) {
        const lote = alvo.slice(k, k + LOTE);
        msg('<span class="spin"></span>Lançando ' + Math.min(k + LOTE, alvo.length) + ' de ' + alvo.length + '…');
        const r = await chamar({ modo: 'lancar', competencia, modelo: est.dados.modelo && est.dados.modelo.numero, boleto: comBoleto,
          itens: lote.map(i => ({ pessoa: i.pessoa, nome: i.nome, valor: valorDe(i), vencimento: i.vencTela, conta: i.contaTela || null })) },
          s => msg('<span class="spin"></span>O Conta Azul está renovando a conexão. Tento de novo em ' + s + ' s.'));
        for (const res of r.resultados || []) {
          const i = est.porPessoa.get(res.pessoa);
          if (!i) continue;
          if (res.ok) {
            ok++;
            Object.assign(i, { grupo: 'lancada', marcada: false, erro: null, valor: res.valor, vencimento: res.vencimento,
              lancada: { id: res.id, numero: res.numero, de: 'sistema', no_boleto: !!(res.boleto && res.boleto.posto) },
              motivo: res.boleto && !res.boleto.posto && res.boleto.motivo ? 'Lançada. Boleto: ' + res.boleto.motivo + '.' : 'Lançada agora.' });
            est.daJanela.push({ id: res.id, nome: i.nome, numero: res.numero, valor: res.valor });
          } else { falhas++; i.erro = res.erro || 'não lançada'; }
        }
      }
      let aviso = ok ? '✓ ' + plural(ok, 'venda lançada', 'vendas lançadas') + ' no Conta Azul.' : '';
      if (falhas) aviso += (aviso ? ' ' : '') + plural(falhas, 'não foi', 'não foram') + ': o motivo está na linha.';
      if (soPrimeira && ok) aviso = '✓ Lançada a venda ' + esc(est.daJanela[est.daJanela.length - 1].numero) + ' de ' + esc(est.daJanela[est.daJanela.length - 1].nome) + '. Confira no Conta Azul e lance as outras.';
      if (!soPrimeira && comTarefa && ok) {
        const t = await tarefaDaThalia();
        aviso += t.erro ? ' A tarefa da Thalia não foi gravada (' + esc(t.erro) + '): avise ela das NFS-e.'
          : t.criou ? ' Criei a tarefa da Thalia pra emitir as NFS-e (' + plural(t.criou, 'venda', 'vendas') + ').'
          : t.juntou ? ' ' + plural(t.juntou, 'venda entrou', 'vendas entraram') + ' na tarefa da Thalia que já estava aberta.' : '';
      }
      est.aviso = aviso;
      aoMudar();
    } catch (e) {
      est.aviso = '<span style="color:var(--err)">' + esc(e.message) + '</span>' + (ok ? ' Antes disso, ' + plural(ok, 'venda foi lançada', 'vendas foram lançadas') + '.' : '');
      if (ok) aoMudar();
    } finally {
      est.rodando = false;
      desenhar();
    }
  }

  // a tarefa da Thalia pras NFS-e: as vendas que o sistema lançou na competência e que ainda não estão em nenhuma
  // tarefa com este título (a concluída conta: aquelas notas já saíram); com uma aberta, entram no fim da lista dela
  async function tarefaDaThalia() {
    const vendas = itens().filter(i => i.grupo === 'lancada' && i.lancada && i.lancada.de === 'sistema' && i.lancada.numero)
      .map(i => ({ nome: i.nome, numero: i.lancada.numero, valor: i.valor }));
    const { titulo } = tarefaDasNotas({ competencia, vendas: [] });
    const { data: ja, error } = await supabase.from('tarefas').select('id, descricao, status').eq('setor', 'fiscal').eq('titulo', titulo);
    if (error) return { erro: error.message };
    const { novas } = juntarNaTarefa((ja || []).map(x => x.descricao || '').join('\n'), vendas);
    if (!novas.length) return {};
    const aberta = (ja || []).find(x => x.status !== 'concluida');
    if (aberta) {
      const { descricao } = juntarNaTarefa(aberta.descricao, novas);
      const { error: e2 } = await supabase.from('tarefas').update({ descricao }).eq('id', aberta.id).neq('status', 'concluida');
      if (e2) return { erro: e2.message };
      await supabase.from('tarefa_historico').insert({ tarefa_id: aberta.id, descricao: plural(novas.length, 'venda nova', 'vendas novas') + ' do honorário adicional anual na lista.', autor });
      return { juntou: novas.length };
    }
    const t = tarefaDasNotas({ competencia, vendas: novas });
    const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
    const { erro } = await criarTarefasAvulsas(supabase, { setor: 'fiscal', titulo: t.titulo, descricao: t.descricao, responsavel: 'Thalia',
      prazo: proximoDiaUtil(somaDias(hoje, 1)), prioridade: 'alta', autor, historico: 'Tarefa criada pelo lançamento do honorário adicional anual.' });
    return erro ? { erro } : { criou: novas.length };
  }

  // o desfazer tira da tarefa aberta as vendas excluídas; a lista que fica vazia, com a tarefa ainda pendente, sai
  async function tirarDaThalia(numeros) {
    if (!numeros.length) return;
    const { titulo } = tarefaDasNotas({ competencia, vendas: [] });
    const { data: ja } = await supabase.from('tarefas').select('id, descricao, status').eq('setor', 'fiscal').eq('titulo', titulo).neq('status', 'concluida');
    for (const t of ja || []) {
      const r = tirarDaTarefa(t.descricao, numeros);
      if (!r.tiradas) continue;
      if (!r.sobram && t.status === 'pendente') { await excluirTarefasCriadas(supabase, [t.id]); continue; }
      await supabase.from('tarefas').update({ descricao: r.descricao }).eq('id', t.id).neq('status', 'concluida');
      await supabase.from('tarefa_historico').insert({ tarefa_id: t.id, descricao: plural(r.tiradas, 'venda saiu', 'vendas saíram') + ' da lista: excluída' + (r.tiradas > 1 ? 's' : '') + ' do Conta Azul.', autor });
    }
  }

  async function desfazer() {
    const ids = est.daJanela.map(v => v.id);
    if (!ids.length || !window.confirm('Excluir do Conta Azul ' + (ids.length === 1 ? 'a venda lançada' : 'as ' + ids.length + ' vendas lançadas') + ' agora (e tirar o adicional do boleto)?')) return;
    travar(true);
    try {
      const r = await chamar({ modo: 'desfazer', ids });
      const fic = r.ficaram || [];
      const exc = r.excluidas || [];
      est.daJanela = est.daJanela.filter(v => fic.some(f => f.id === v.id));
      try { await tirarDaThalia(exc.map(x => x.numero).filter(Boolean)); } catch (e) { /* a tarefa fica como estava */ }
      const doBoleto = exc.filter(x => x.boleto && x.boleto !== 'saiu do boleto');
      est.aviso = '✓ ' + plural(exc.length, 'venda excluída', 'vendas excluídas') + ' do Conta Azul.'
        + (doBoleto.length ? ' Boleto: ' + doBoleto.map(x => esc(x.nome) + ' (' + esc(x.boleto) + ')').join('; ') + '.' : '')
        + (fic.length ? ' Ficaram: ' + fic.map(f => esc(f.nome) + ' (' + esc(f.motivo) + ')').join('; ') + '.' : '');
      aoMudar();
      est.rodando = false;
      const aviso = est.aviso;
      await carregar();
      est.aviso = aviso; desenhar();
    } catch (e) {
      est.rodando = false;
      est.aviso = '<span style="color:var(--err)">' + esc(e.message) + '</span>';
      desenhar();
    }
  }

  async function porNoBoleto() {
    travar(true);
    try {
      const r = await chamar({ modo: 'boleto', competencia });
      const res = r.resultados || [];
      const postas = res.filter(x => x.posto && !x.ja).length;
      const fora = res.filter(x => !x.posto);
      est.aviso = '✓ ' + plural(postas, 'adicional entrou', 'adicionais entraram') + ' no boleto.' + (fora.length ? ' Fora: ' + fora.map(x => esc(x.nome) + ' (' + esc(x.motivo) + ')').join('; ') + '.' : '');
      aoMudar();
      est.rodando = false;
      const aviso = est.aviso;
      await carregar();
      est.aviso = aviso; desenhar();
    } catch (e) {
      est.rodando = false;
      est.aviso = '<span style="color:var(--err)">' + esc(e.message) + '</span>';
      desenhar();
    }
  }

  await carregar();
  return { fechar };
}
