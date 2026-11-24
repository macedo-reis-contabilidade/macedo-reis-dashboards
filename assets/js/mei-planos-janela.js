// ============================================================================
// MACEDO & REIS — A janela dos planos do MEI pro WhatsApp (24/11/2026). Uma só, em duas telas: a aba MEI da
// Precificação (abre com o cliente, os planos marcados e as notas do plano que estão na tela) e o produto "Planos do
// MEI" da Vitrine de serviços (lê os planos do banco). O Samuel: "enviar a imagem direto sem necessidade de clique em
// link ou em arquivo é a forma ideal, dificultar o menos possível pra pessoa abrir e ver".
//
// A janela (as imagens com o Copiar e o Baixar, o Compartilhar todas, a mensagem) é a de janela-whats.js, a mesma da
// transformação do MEI em ME; aqui ficam o que é dos planos: o cliente, os botões do Recomendar e as notas do plano. Nada
// é gravado: as imagens e a mensagem saem do que está na janela. O recomendado é o plano escolhido nela (na
// Precificação, começa pelo marcado na tela); sem nenhum, o mais simples.
// ============================================================================
import { montarVitrine, recomendados as recomendadosDe, mensagemWhats, primeiroNome, planosEmOrdem, nomeCurto, reais, reaisCurto, qtdNotas } from './mei-planos.js';
import { imagensDosPlanos } from './mei-planos-imagem.js';
import { criarJanelaWhats, ROTULO, esc } from './janela-whats.js';

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

const $ = id => document.getElementById(id);
const LEGENDA = (i, n) => i === 0 ? 'os planos' : n > 2 ? `a lista do que cada um inclui (${i} de ${n - 1})` : 'a lista do que cada um inclui';

// os botões dos planos: o escolhido em champanhe, com o ✓ (a cor do "Recomendado pra você" das imagens)
function pintarPlanos(st) {
  const ordem = planosEmOrdem(st.catalogo.planos);
  $('pmPlanos').innerHTML = ordem.map(p => {
    const sim = st.rec.has(p.id);
    const cor = sim ? 'background:var(--sol-forte); color:var(--sol-tinta); border-color:var(--sol-forte);' : '';
    return `<button type="button" class="btn btn-ghost btn-sm" data-pm-plano="${esc(p.id)}" aria-pressed="${sim}" style="${cor}">${sim ? '✓ ' : ''}${esc(nomeCurto(p.nome))} · ${esc(reaisCurto(p.valor_mensal))}</button>`;
  }).join('');
  $('pmRecomenda').textContent = textoDaRecomendacao(st.catalogo.planos, [...st.rec]);
}

const janela = criarJanelaWhats({
  id: 'pm', ov: 'ovPlanosMei', titulo: 'Os planos do MEI pro WhatsApp', foco: 'pmCliente',
  campos: `
      <div style="display:flex; flex-wrap:wrap; gap:12px 18px; align-items:flex-start;">
        <label style="display:flex; flex-direction:column; gap:4px; flex:1 1 220px; min-width:0;"><span style="${ROTULO}">Cliente</span><input id="pmCliente" class="input" maxlength="120" placeholder="o nome, pra mensagem e as imagens" autocomplete="off"></label>
        <div role="group" aria-labelledby="pmRecRotulo" style="display:flex; flex-direction:column; gap:4px; flex:3 1 360px; min-width:0;"><span id="pmRecRotulo" style="${ROTULO}">Recomendar</span><div id="pmPlanos" style="display:flex; gap:6px; flex-wrap:wrap;"></div></div>
        <label id="pmNfsCampo" style="display:flex; flex-direction:column; gap:4px; width:120px;"><span style="${ROTULO}">Notas no plano</span><input id="pmNfs" class="input" type="number" min="1" max="99" step="1" inputmode="numeric"></label>
      </div>
      <p id="pmRecomenda" style="margin:10px 0 12px; font-size:13px; color:var(--text-muted);"></p>`,
  instrucao: 'No WhatsApp: copie a imagem 1, cole na conversa (Ctrl+V) e mande; faça o mesmo com as outras, na ordem, e mande a mensagem por último. Ela chega como imagem: a cliente vê ali mesmo, sem abrir link nem arquivo.',
  legenda: LEGENDA,
  nomeDoArquivo: (s, i, n) => nomeDoArquivo(s.st.cliente, i, n),
  ligar(j) {
    $('pmCliente').addEventListener('input', () => { const s = j.sessao(); if (!s) return; s.st.cliente = $('pmCliente').value; j.redesenharDepois(); });
    $('pmNfs').addEventListener('input', () => { const s = j.sessao(); if (!s) return; s.st.nfs = $('pmNfs').value; j.redesenharDepois(); });
    $('pmPlanos').addEventListener('click', e => {
      const b = e.target.closest('[data-pm-plano]');
      const s = j.sessao();
      if (!b || !s || !s.st.catalogo) return;
      const st = s.st, id = b.dataset.pmPlano;
      if (st.rec.has(id)) st.rec.delete(id); else st.rec.add(id);
      // sem nenhum escolhido, volta o mais simples
      if (!st.rec.size) st.rec = new Set(recomendadosDe(st.catalogo.planos, []));
      pintarPlanos(st);
      j.redesenhar();
    });
  },
  iniciar(s, { cliente = '', marcados = [], nfs = '', quem = '' }) {
    s.st = { catalogo: null, cliente: String(cliente || ''), rec: new Set(), nfs: nfs == null ? '' : String(nfs), quem, marcados };
    $('pmCliente').value = s.st.cliente;
    $('pmPlanos').innerHTML = ''; $('pmRecomenda').textContent = '';
  },
  async preparar(s, { supabase, catalogo = null }) {
    let c = catalogo && Array.isArray(catalogo.planos) && catalogo.planos.length ? catalogo : null;
    if (!c) {
      s.aviso('Lendo os planos…');
      c = supabase ? await lerCatalogoMei(supabase) : { erro: true };
      if (!s.ativa()) return false;
      if (c.erro || !c.planos.length) { s.aviso('Não deu pra ler os planos do MEI agora. Feche e abra de novo.', 'var(--err)'); return false; }
    }
    const st = s.st;
    st.catalogo = c;
    st.rec = new Set(recomendadosDe(c.planos, st.marcados));
    // as notas do plano: só quando algum plano tem a emissão de notas
    const conjuntos = c.comp instanceof Map ? [...c.comp.values()] : Object.values(c.comp || {});
    const temNotas = conjuntos.some(x => (x instanceof Set ? x : new Set(x || [])).has('nfs_plano'));
    $('pmNfsCampo').style.display = temNotas ? 'flex' : 'none';
    $('pmNfs').value = temNotas ? String(qtdNotas(st.nfs)) : '';
    if (temNotas) st.nfs = $('pmNfs').value;
    pintarPlanos(st);
    return true;
  },
  async gerar(s) {
    const st = s.st, c = st.catalogo;
    const v = montarVitrine({ planos: c.planos, servicos: c.servicos, comp: c.comp, nfs: st.nfs });
    const rec = recomendadosDe(c.planos, [...st.rec]);
    const canvases = await imagensDosPlanos(v, { recomendados: rec, nome: st.cliente, logo: s.logo });
    return { canvases, mensagem: mensagemWhats({ nome: st.cliente, quem: st.quem, vitrine: v, recomendados: rec, imagens: canvases.length }) };
  }
});

// abre a janela. opc: { supabase, catalogo ({ planos, servicos, comp }, o que a tela já tem; sem ele, lê do banco),
// cliente, marcados (os ids dos planos marcados na tela), nfs (as notas do plano), quem (o nome de quem manda), logo
// (Image da logo; sem ela, carrega assets/logo-mr.png) }
export function abrirPlanosMei(opc = {}) {
  return janela.abrir(opc);
}
