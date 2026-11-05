// ============================================================
// MACEDO & REIS — A janela "Conferir com o Conta Azul" da tela Boletos (05/11/2026, pedido do Samuel: "é necessário
// conferência por parte do sistema junto ao conta azul, pois tem serviços adicionais que também devem compor o valor
// deste mês"). A função ca-vendas (modo 'boletos', só os sócios) traz o que vence no mês do boleto e está em aberto no
// Conta Azul, empresa por empresa (pelo CNPJ ou CPF); as regras (assets/js/boletos-conta-azul.js) dizem o que muda em cada
// boleto. A janela mostra as que sobem, as que descem e as que só mudam a composição — marcadas, salvo as que pedem
// conferência —, as que não têm nada lá, as já emitidas e o que vence lá sem boleto aqui; "Aplicar" grava o valor e os
// extras dos boletos a emitir, com "Desfazer" enquanto a janela está aberta.
// Usa as classes da tela Boletos (.ov, .ov-box, .ov-head, .ov-body) e estilo em linha no resto.
// Teste de tela: tests/harness/boletos-conta-azul.py.
// ============================================================
import { conferirMes, gravacaoDaProposta, marcadaPorPadrao, mesDoBoleto, mesBR, centavos, extrasDeFora } from './boletos-conta-azul.js';

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const BRL = n => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sinal = n => (n > 0 ? '+ ' : n < 0 ? '− ' : '') + BRL(Math.abs(n));
const plural = (n, um, varios) => n + ' ' + (n === 1 ? um : varios);
const ESPERA_RENOVANDO_MS = 20000;
const APLICAVEIS = ['desce', 'sobe', 'recompoe'];
const TITULO = { desce: 'Descem', sobe: 'Sobem', recompoe: 'O total fica, muda a composição' };
const COR = { desce: 'var(--warn)', sobe: 'var(--ok)', recompoe: 'var(--brand-light)' };

// a resposta de erro da função, em português
async function mensagemDe(error) {
  const r = error && error.context;
  try { if (r && typeof r.json === 'function') { const j = await (typeof r.clone === 'function' ? r.clone() : r).json(); if (j && j.erro) return { texto: String(j.erro), renovando: !!j.renovando }; } } catch (e) { /* sem corpo */ }
  const st = r && r.status;
  if (st === 401) return { texto: 'Sua sessão expirou: saia e entre de novo no sistema.' };
  if (st === 403) return { texto: 'Só os sócios conferem os boletos com o Conta Azul.' };
  return { texto: 'Não consegui falar com o Conta Azul agora. Tente de novo em instantes.' };
}

/**
 * Abre a janela. linhas: os boletos da grade (os objetos da tela, já gravados); nomeDe(cliente_id): o nome da empresa;
 * ehMei(cliente_id): o MEI do cadastro (a guia do MEI vai junto no boleto: o valor de hoje, maior que o contrato, fica);
 * aoAplicar([{ id, valor, itens_extras }]): a grade troca o valor e os extras das linhas, sem ler o mês de novo.
 */
export async function abrirConferenciaCA({ supabase, competencia, linhas, nomeDe = () => '', ehMei = () => false, aoAplicar = () => {},
  esperaRenovando = (typeof window !== 'undefined' && Number(window.__boletosEsperaMs)) || ESPERA_RENOVANDO_MS }) {
  const antiga = document.getElementById('caOv');
  if (antiga) antiga.remove();
  const meses = [...new Set((linhas || []).map(mesDoBoleto).filter(Boolean))].sort();
  const mesTitulo = meses.length ? meses.map(mesBR).join(' e ') : '';
  const ov = document.createElement('div');
  ov.className = 'ov open';
  ov.id = 'caOv';
  ov.setAttribute('role', 'dialog');
  ov.setAttribute('aria-modal', 'true');
  ov.setAttribute('aria-labelledby', 'caTitulo');
  ov.style.zIndex = '200';
  ov.style.padding = '24px 16px';
  ov.innerHTML = `<div class="ov-box" style="max-width:1100px;max-height:94vh;">
    <div class="ov-head"><h3 id="caTitulo">Conferir com o Conta Azul · boletos de ${esc(mesBR(competencia))}</h3>
      <button class="btn btn-ghost btn-sm" id="caFechar" data-janela-fechar>Fechar</button></div>
    <div class="ov-body" id="caBody" style="padding:14px 20px;"></div>
  </div>`;
  const deOnde = document.activeElement;
  document.body.appendChild(ov);
  const corpo = ov.querySelector('#caBody');
  ov.querySelector('#caFechar').focus();
  // itens e soltas: o que a função trouxe (refaz a conferência depois de aplicar e de desfazer, sem ler o Conta Azul de novo)
  const est = { conf: null, itens: [], soltas: [], marcadas: new Set(), rodando: false, aplicadas: null, aviso: null };

  const fechar = () => {
    if (est.rodando) return;
    ov.remove();
    if (deOnde && typeof deOnde.focus === 'function' && document.contains(deOnde)) deOnde.focus();
  };
  ov.querySelector('#caFechar').addEventListener('click', fechar);

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
    if (!meses.length) { corpo.innerHTML = '<p style="color:var(--text-muted);font-size:13.5px;">Nenhum boleto neste mês pra conferir.</p>'; return; }
    corpo.innerHTML = '<p style="color:var(--text-muted);font-size:13px;margin:6px 0 14px;"><span class="spin"></span>Lendo o Conta Azul: o que vence em '
      + esc(mesTitulo) + ' de cada empresa.</p>';
    try {
      const dados = await chamar({ modo: 'boletos', meses }, s => {
        corpo.innerHTML = '<p style="color:var(--text-muted);font-size:13px;"><span class="spin"></span>O Conta Azul está renovando a conexão. Tento de novo em ' + s + ' s.</p>';
      });
      est.itens = Array.isArray(dados.itens) ? dados.itens : [];
      est.soltas = Array.isArray(dados.soltas) ? dados.soltas : [];
      est.conf = conferirMes(linhas, { itens: est.itens, soltas: est.soltas }, { ehMei });
      est.marcadas = new Set(est.conf.propostas.filter(x => marcadaPorPadrao(x.proposta)).map(x => x.cobranca.id));
      desenhar();
    } catch (e) {
      corpo.innerHTML = '<p style="color:var(--err);font-size:13.5px;">' + esc(e.message) + '</p><button class="btn btn-ghost btn-sm" id="caDeNovo">Tentar de novo</button>';
      corpo.querySelector('#caDeNovo').addEventListener('click', carregar);
    }
  }

  const doGrupo = s => est.conf.propostas.filter(x => x.proposta.situacao === s);
  const marcadasAgora = () => est.conf.propostas.filter(x => est.marcadas.has(x.cobranca.id) && APLICAVEIS.includes(x.proposta.situacao));

  function linhaDaProposta({ cobranca: c, proposta: p }) {
    const dif = (centavos(p.total) - centavos(p.antes.total)) / 100;
    const fora = extrasDeFora(p.itens_extras).filter(x => !x.ignorado);
    const itens = [...p.itens.map(i => esc(i.rotulo) + ' <b style="color:var(--text);">' + BRL(i.valor) + '</b>' + (i.ignorado ? ' <i>(tirado deste boleto)</i>' : '')),
      ...fora.map(x => esc(x.descricao || 'item extra') + ' <b style="color:var(--text);">' + BRL(x.valor) + '</b> <i>(já estava no boleto)</i>')];
    const marcada = est.marcadas.has(c.id);
    return `<label class="ca-linha" data-id="${esc(c.id)}" style="display:grid;grid-template-columns:22px minmax(0,1fr) auto;gap:4px 10px;align-items:start;padding:9px 10px;border:1px solid var(--fill-3);border-radius:10px;margin-bottom:6px;cursor:pointer;${p.confira ? 'border-left:3px solid var(--warn);' : ''}">
      <input type="checkbox" class="ca-marca" data-id="${esc(c.id)}"${marcada ? ' checked' : ''} style="margin-top:3px;">
      <span><b style="color:var(--text);font-size:13.5px;">${esc(nomeDe(c.cliente_id) || '(empresa)')}</b>
        <span style="display:block;color:var(--text-muted);font-size:12px;margin-top:3px;line-height:1.6;">${itens.join(' · ') || 'nada'}</span>
        ${p.avisos.length ? `<span style="display:block;color:var(--warn);font-size:12px;margin-top:2px;">${p.avisos.map(esc).join(' ')}</span>` : ''}</span>
      <span style="text-align:right;white-space:nowrap;font-size:12.5px;color:var(--text-muted);">hoje ${BRL(p.antes.total)}<br>
        <b style="color:var(--text);font-size:14px;">${BRL(p.total)}</b><br>
        <span style="color:${dif ? COR[p.situacao] : 'var(--text-muted)'};font-weight:600;">${dif ? sinal(dif) : 'o total fica'}</span></span>
    </label>`;
  }

  function lista(titulo, itens, aberta = false) {
    if (!itens.length) return '';
    return `<details style="margin-top:12px;"${aberta ? ' open' : ''}><summary style="cursor:pointer;font-size:13px;color:var(--brand-light);font-weight:600;">${titulo}</summary>
      <ul style="margin:8px 0 0;padding-left:18px;font-size:12.5px;color:var(--text-muted);line-height:1.7;">${itens.join('')}</ul></details>`;
  }

  function desenhar() {
    const r = est.conf.resumo, total = est.conf.propostas.length;
    const partes = [r.igual ? plural(r.igual, 'igual ao Conta Azul', 'iguais ao Conta Azul') : '', r.sobe ? plural(r.sobe, 'sobe', 'sobem') : '',
      r.desce ? plural(r.desce, 'desce', 'descem') : '', r.recompoe ? plural(r.recompoe, 'muda só a composição', 'mudam só a composição') : '',
      r.sem_conta_azul ? plural(r.sem_conta_azul, 'sem nada vencendo lá', 'sem nada vencendo lá') : '', r.fechado ? plural(r.fechado, 'já emitido', 'já emitidos') : ''].filter(Boolean);
    const aplic = APLICAVEIS.flatMap(doGrupo);
    const marcadas = marcadasAgora();
    const difMarcadas = marcadas.reduce((s, x) => s + centavos(x.proposta.total) - centavos(x.proposta.antes.total), 0) / 100;
    const fechadosDif = doGrupo('fechado').filter(x => centavos(x.proposta.total) !== centavos(x.proposta.antes.total));
    corpo.innerHTML = `
      <p style="font-size:13px;color:var(--text-muted);margin:0 0 4px;line-height:1.55;">O que vence em <b style="color:var(--text);">${esc(mesTitulo)}</b> no Conta Azul, em aberto, empresa por empresa (pelo CNPJ): a mensalidade, os serviços extras, as parcelas, a renegociação e o adicional. O valor do boleto vira a mensalidade do Conta Azul, e o resto entra como extra, com o aviso na grade.</p>
      <p style="font-size:13.5px;color:var(--text);margin:8px 0 12px;">${plural(total, 'boleto', 'boletos')}: ${esc(partes.join(', '))}.</p>
      ${est.aviso ? `<div id="caAviso" role="status" style="padding:9px 12px;border-radius:10px;background:rgba(87,171,90,.12);border:1px solid rgba(87,171,90,.35);color:var(--text);font-size:13px;margin-bottom:12px;">${est.aviso}</div>` : '<div id="caAviso" role="status"></div>'}
      ${aplic.length ? APLICAVEIS.map(s => doGrupo(s).length ? `<h4 style="font-size:13px;margin:14px 0 6px;color:${COR[s]};">${TITULO[s]} (${doGrupo(s).length})</h4>${doGrupo(s).map(linhaDaProposta).join('')}` : '').join('')
        : '<p style="font-size:13.5px;color:var(--ok);">Nenhum boleto a emitir muda: todos batem com o Conta Azul.</p>'}
      ${lista('Sem nada vencendo no Conta Azul em ' + esc(mesTitulo) + ' (' + doGrupo('sem_conta_azul').length + '): o boleto fica como está',
        doGrupo('sem_conta_azul').map(x => '<li>' + esc(nomeDe(x.cobranca.cliente_id)) + ' — ' + BRL(x.proposta.total) + '</li>'))}
      ${lista('Já emitidos, com outro valor no Conta Azul (' + fechadosDif.length + '): não mudam',
        fechadosDif.map(x => '<li>' + esc(nomeDe(x.cobranca.cliente_id)) + ' — boleto ' + BRL(x.proposta.antes.total) + ', Conta Azul ' + BRL(x.proposta.total) + '</li>'))}
      ${lista('Vence no Conta Azul, de quem não tem boleto aqui (' + (est.conf.semBoleto.length + est.conf.soltas.length) + '): paga por outro banco, ou falta na grade',
        [...est.conf.semBoleto.map(s => '<li>' + esc(s.nome) + ' — ' + BRL(s.valor) + '</li>'),
          ...est.conf.soltas.map(s => '<li>' + esc(s.nome || '(sem cliente no Conta Azul)') + ' — ' + BRL(s.valor) + ' <i>(no Conta Azul, sem empresa do cadastro com o mesmo CNPJ)</i></li>')])}
      <div style="position:sticky;bottom:-14px;background:var(--surface);padding:12px 0 2px;margin-top:12px;border-top:1px solid var(--line);display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
        ${aplic.length ? `<button class="btn btn-primary" id="caAplicar"${marcadas.length && !est.rodando ? '' : ' disabled'}>Aplicar ${plural(marcadas.length, 'marcada', 'marcadas')}</button>
        <span style="font-size:12.5px;color:var(--text-muted);">no mês: ${difMarcadas ? sinal(difMarcadas) : 'o total fica'}</span>` : ''}
        ${est.aplicadas && est.aplicadas.length ? '<button class="btn btn-ghost" id="caDesfazer">Desfazer</button>' : ''}
      </div>`;
    corpo.querySelectorAll('.ca-marca').forEach(cb => cb.addEventListener('change', () => {
      if (cb.checked) est.marcadas.add(cb.dataset.id); else est.marcadas.delete(cb.dataset.id);
      const rolagem = corpo.scrollTop;
      desenhar();
      corpo.scrollTop = rolagem;
      const de = corpo.querySelector('.ca-marca[data-id="' + CSS.escape(cb.dataset.id) + '"]');
      if (de) de.focus();
    }));
    const ap = corpo.querySelector('#caAplicar');
    if (ap) ap.addEventListener('click', aplicar);
    const df = corpo.querySelector('#caDesfazer');
    if (df) df.addEventListener('click', desfazer);
  }

  // grava o valor e os extras de cada boleto marcado, só se ele segue a emitir; guarda o de antes pro Desfazer
  async function aplicar() {
    if (est.rodando) return;
    const alvo = marcadasAgora();
    if (!alvo.length) return;
    est.rodando = true;
    const btn = corpo.querySelector('#caAplicar');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spin"></span>Aplicando…'; }
    const feitas = [], ficaram = [];
    for (const { cobranca: c, proposta: p } of alvo) {
      const novo = gravacaoDaProposta(p);
      const { data, error } = await supabase.from('cobrancas_mensais').update(novo).eq('id', c.id).eq('status', 'a_emitir').select('id');
      if (error || !data || !data.length) { ficaram.push(nomeDe(c.cliente_id)); continue; }
      feitas.push({ id: c.id, antes: { valor: c.valor, itens_extras: Array.isArray(c.itens_extras) ? c.itens_extras : [] }, depois: novo });
      c.valor = novo.valor;
      c.itens_extras = novo.itens_extras;
    }
    est.rodando = false;
    est.aplicadas = feitas;
    if (feitas.length) aoAplicar(feitas.map(f => ({ id: f.id, ...f.depois })));
    // depois de aplicar, a conferência é refeita com o que ficou gravado (o que foi aplicado vira "igual")
    est.conf = conferirMes(linhas, { itens: est.itens, soltas: est.soltas }, { ehMei });
    est.aviso = plural(feitas.length, 'boleto atualizado', 'boletos atualizados') + '.' + (ficaram.length ? ' Não mudaram (já não estavam a emitir, ou a gravação falhou): ' + esc(ficaram.join(', ')) + '.' : '');
    est.marcadas = new Set(est.conf.propostas.filter(x => marcadaPorPadrao(x.proposta)).map(x => x.cobranca.id));
    desenhar();
  }

  // volta o valor e os extras de antes — só onde ninguém mexeu depois (o que está gravado é o que foi aplicado)
  async function desfazer() {
    if (est.rodando || !est.aplicadas || !est.aplicadas.length) return;
    est.rodando = true;
    const ids = est.aplicadas.map(f => f.id);
    const { data: vivas } = await supabase.from('cobrancas_mensais').select('id, valor, itens_extras, status').in('id', ids);
    const porId = new Map((vivas || []).map(v => [v.id, v]));
    const voltaram = [], nao = [];
    for (const f of est.aplicadas) {
      const v = porId.get(f.id);
      const igual = v && centavos(v.valor) === centavos(f.depois.valor) && JSON.stringify(v.itens_extras || []) === JSON.stringify(f.depois.itens_extras || []);
      if (!igual) { nao.push(f.id); continue; }
      const { data, error } = await supabase.from('cobrancas_mensais').update(f.antes).eq('id', f.id).select('id');
      if (error || !data || !data.length) { nao.push(f.id); continue; }
      voltaram.push({ id: f.id, ...f.antes });
      const c = (linhas || []).find(x => x.id === f.id);
      if (c) { c.valor = f.antes.valor; c.itens_extras = f.antes.itens_extras; }
    }
    est.rodando = false;
    est.aplicadas = null;
    if (voltaram.length) aoAplicar(voltaram);
    est.conf = conferirMes(linhas, { itens: est.itens, soltas: est.soltas }, { ehMei });
    est.aviso = plural(voltaram.length, 'boleto voltou', 'boletos voltaram') + ' ao que era.' + (nao.length ? ' ' + plural(nao.length, 'não voltou', 'não voltaram') + ': alguém mexeu depois.' : '');
    est.marcadas = new Set(est.conf.propostas.filter(x => marcadaPorPadrao(x.proposta)).map(x => x.cobranca.id));
    desenhar();
  }

  await carregar();
  return { fechar };
}
