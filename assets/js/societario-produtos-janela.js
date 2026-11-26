// ============================================================================
// MACEDO & REIS — A janela dos produtos do societário pro WhatsApp (24/11/2026: a transformação do MEI em ME e a
// abertura de empresa), aberta pelos produtos da Vitrine de serviços. Abre com o nome do cliente, a data de hoje e os
// valores de sempre do produto, lidos do banco (a aba Parâmetros da Precificação: nunca no código, que é público); mudar
// um campo refaz as imagens e a mensagem. O orçamento vale até o último dia útil do mês seguinte.
// A janela em si (as imagens com o Copiar e o Baixar, o Compartilhar todas, a mensagem) é a de janela-whats.js, a mesma
// dos planos do MEI. Uma janela só pros produtos da família: o título e o rótulo do cliente são os do produto aberto.
// A mensagem leva o link do formulário do produto (empresa.html?t=…, 24/11/2026), por onde o cliente manda as
// informações e os documentos. Nada é gravado.
// Na alteração de empresa (26/11/2026), a janela tem mais duas listas: o que muda e o que pedir ao cliente (os itens do
// que muda, todos marcados; o Samuel desmarca o que o escritório já tem). O passo a passo, a documentação, o que muda no
// orçamento e o link do formulário saem do que está marcado (produtoDaSelecao, linkDoFormulario).
// ============================================================================
import { DIAS_DA_PARCELA, produtoDe, valoresDosParametros, dadosDoOrcamento, mensagemDoProduto, nomeDoArquivo, resumoDosValores,
  hojeEmBrasilia, linkDoFormulario, produtoDaSelecao, ALTERACOES, ITENS } from './societario-produtos.js';
import { itensDe } from './empresa-pedido.js';
import { imagensDoProduto } from './societario-produtos-imagem.js';
import { criarJanelaWhats, ROTULO, esc } from './janela-whats.js';

const $ = id => document.getElementById(id);
const LEGENDAS = ['o passo a passo', 'a documentação', 'o orçamento (vai à parte)'];
// o valor no campo: "1.234,50" (sem valor, vazio)
const noCampo = v => (v == null || v === '' ? '' : (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const CAMPO = 'display:flex; flex-direction:column; gap:4px;';
// o campo de cada valor
const CAMPOS = { aVista: 'spAVista', entrada: 'spEntrada', parcela: 'spParcela' };
const MARCA = 'display:flex; gap:8px; align-items:flex-start; font-size:13.5px; line-height:1.35; cursor:pointer;';
const SUB = 'font-size:12px; color:var(--text-dim); margin:6px 0 2px;';

// a seleção da alteração: o que muda e, dos itens disso, os que o escritório não desmarcou
const selecaoDe = st => ({ alteracoes: st.alt.slice(), pedir: itensDe(st.alt).filter(i => !st.fora.has(i)) });
// as duas listas da alteração: o que muda (as caixas, com o que está marcado) e o que pedir (os itens do que muda, por
// de quem é, marcados os que o escritório não desmarcou)
function pintarAlteracao(st) {
  $('spAlt').hidden = !st.p.selecionavel;
  if (!st.p.selecionavel) return;
  $('spMuda').innerHTML = ALTERACOES.map(a => `<label style="${MARCA}"><input type="checkbox" data-sp-alt="${a.id}"${st.alt.includes(a.id) ? ' checked' : ''} style="margin-top:2px;"><span>${esc(a.rotulo)}</span></label>`).join('');
  const itens = itensDe(st.alt);
  if (!itens.length) { $('spPedir').innerHTML = `<p style="margin:0; font-size:13px; color:var(--text-muted);">Marque o que muda: os itens a pedir aparecem aqui, todos marcados.</p>`; return; }
  const grupo = (de, titulo) => {
    const l = itens.filter(i => ITENS[i].de === de);
    return l.length ? `<div style="${SUB}">${titulo}</div>` + l.map(i => `<label style="${MARCA}"><input type="checkbox" data-sp-item="${i}"${st.fora.has(i) ? '' : ' checked'} style="margin-top:2px;"><span>${esc(ITENS[i].t)}</span></label>`).join('') : '';
  };
  $('spPedir').innerHTML = grupo('empresa', 'Da empresa') + grupo('socio', 'De cada sócio');
}

// o resumo de cima: o a prazo somado, o desconto e a validade; o que falta, em vermelho (com o porquê, quando os valores
// de sempre não vieram do banco)
function pintarResumo(st) {
  const d = dadosDoOrcamento({ cliente: st.cliente, dia: st.dia, valores: st.valores });
  const el = $('spResumo');
  if (d.problemas.length) {
    el.style.color = 'var(--err)';
    el.textContent = [st.avisoValores, ...d.problemas].filter(Boolean).join(' ');
  } else {
    el.style.color = 'var(--text-muted)';
    el.textContent = resumoDosValores(d);
  }
  return d;
}

const janela = criarJanelaWhats({
  id: 'sp', ov: 'ovProdutoSocietario', titulo: 'O material pro WhatsApp', foco: 'spCliente',
  campos: `
      <div style="display:flex; flex-wrap:wrap; gap:12px 18px; align-items:flex-end;">
        <label style="${CAMPO} flex:2 1 240px; min-width:0;"><span id="spClienteRotulo" style="${ROTULO}">Cliente</span><input id="spCliente" class="input" maxlength="120" placeholder="o nome, pro orçamento e a mensagem" autocomplete="off"></label>
        <label style="${CAMPO} width:160px;"><span style="${ROTULO}">Data do orçamento</span><input id="spData" class="input" type="date"></label>
        <label style="${CAMPO} width:130px;"><span style="${ROTULO}">À vista (R$)</span><input id="spAVista" class="input" inputmode="decimal" autocomplete="off"></label>
        <label style="${CAMPO} width:130px;"><span style="${ROTULO}">Entrada (R$)</span><input id="spEntrada" class="input" inputmode="decimal" autocomplete="off"></label>
        <label style="${CAMPO} width:150px;"><span style="${ROTULO}">Parcela em ${DIAS_DA_PARCELA} dias (R$)</span><input id="spParcela" class="input" inputmode="decimal" autocomplete="off"></label>
      </div>
      <div id="spAlt" hidden style="margin-top:12px; padding:12px 14px; border:1px solid var(--line); border-radius:12px;">
        <div style="display:flex; flex-wrap:wrap; gap:14px 28px;">
          <fieldset style="flex:1 1 300px; min-width:0; border:0; margin:0; padding:0;">
            <legend style="${ROTULO} padding:0; margin-bottom:6px;">O que muda na empresa</legend>
            <div id="spMuda" style="display:flex; flex-direction:column; gap:5px;"></div>
          </fieldset>
          <fieldset style="flex:1 1 300px; min-width:0; border:0; margin:0; padding:0;">
            <legend style="${ROTULO} padding:0; margin-bottom:6px;">O que pedir ao cliente: desmarque o que o escritório já tem</legend>
            <div id="spPedir" style="display:flex; flex-direction:column; gap:5px;"></div>
          </fieldset>
        </div>
      </div>
      <p id="spResumo" role="status" style="margin:10px 0 12px; font-size:13px; color:var(--text-muted);"></p>`,
  instrucao: 'No WhatsApp: copie a imagem 1, cole na conversa (Ctrl+V) e mande; depois a 2 e o orçamento, e a mensagem por último. As imagens 1 e 2 não têm valores: servem pra qualquer cliente e pro anúncio.',
  legenda: i => LEGENDAS[i] || '',
  nomeDoArquivo: (s, i) => nomeDoArquivo(s.st.p, s.st.cliente, i),
  ligar(j) {
    const mudou = (campo, valor) => {
      const s = j.sessao();
      if (!s) return;
      if (campo === 'cliente') s.st.cliente = valor;
      else if (campo === 'dia') { if (!valor) return; s.st.dia = valor; }
      else s.st.valores = { ...s.st.valores, [campo]: valor };
      pintarResumo(s.st);
      j.redesenharDepois();
    };
    $('spCliente').addEventListener('input', () => mudou('cliente', $('spCliente').value));
    $('spData').addEventListener('change', () => mudou('dia', $('spData').value));
    for (const [campo, id] of Object.entries(CAMPOS)) $(id).addEventListener('input', () => mudou(campo, $(id).value));
    // a alteração: marcar o que muda põe os itens dele, todos marcados (o endereço na mesma cidade e o de outra cidade não
    // vão juntos); desmarcar um item é o escritório que já tem
    $('spMuda').addEventListener('change', e => {
      const s = j.sessao(), id = e.target && e.target.getAttribute('data-sp-alt');
      if (!s || !id) return;
      const a = ALTERACOES.find(x => x.id === id);
      if (e.target.checked) s.st.alt = ALTERACOES.map(x => x.id).filter(x => x === id || (s.st.alt.includes(x) && x !== a.sai));
      else s.st.alt = s.st.alt.filter(x => x !== id);
      pintarAlteracao(s.st);
      const caixa = $('spMuda').querySelector(`[data-sp-alt="${id}"]`);
      if (caixa) caixa.focus();
      j.redesenharDepois();
    });
    $('spPedir').addEventListener('change', e => {
      const s = j.sessao(), id = e.target && e.target.getAttribute('data-sp-item');
      if (!s || !id) return;
      if (e.target.checked) s.st.fora.delete(id); else s.st.fora.add(id);
      j.redesenharDepois();
    });
  },
  iniciar(s, { produto = 'transformacao', cliente = '', quem = '', dia = '', valores = null }) {
    const p = produtoDe(produto) || produtoDe('transformacao');
    s.st = { p, cliente: String(cliente || ''), quem, dia: dia || hojeEmBrasilia(), valores: { ...(valores || {}) }, avisoValores: '', alt: [], fora: new Set() };
    $('spTitulo').textContent = `${p.titulo} pro WhatsApp`;
    $('spClienteRotulo').textContent = p.cliente;
    $('spCliente').value = s.st.cliente;
    $('spData').value = s.st.dia;
    for (const [campo, id] of Object.entries(CAMPOS)) $(id).value = noCampo(s.st.valores[campo]);
    $('spResumo').textContent = '';
    pintarAlteracao(s.st);
  },
  // os valores de sempre do produto, do banco; quem abriu com os valores (opc.valores) fica com eles. A leitura que falha
  // diz no resumo e segue: a apresentação sai igual (não tem valor nenhum), e o orçamento espera os valores digitados
  async preparar(s, { supabase, valores = null }) {
    if (!valores) {
      s.aviso('Lendo os valores de sempre…');
      let r;
      try {
        r = supabase ? await supabase.from('precificacao_parametros').select('grupo, chave, valor').eq('grupo', s.st.p.grupo) : { error: true };
      } catch (e) { r = { error: true }; }
      if (!s.ativa()) return false;
      const v = r.error ? {} : valoresDosParametros(r.data, s.st.p);
      // só o que veio do banco vai pro campo: o que a pessoa já digitou enquanto lia fica
      for (const [campo, id] of Object.entries(CAMPOS)) {
        if (s.st.valores[campo] == null && v[campo] != null) { s.st.valores[campo] = v[campo]; $(id).value = noCampo(v[campo]); }
      }
      // o produto sem valor de sempre diz o dele (na alteração, o preço depende do que muda)
      s.st.avisoValores = r.error ? 'Não deu pra ler os valores de sempre agora: digite os do orçamento.'
        : Object.values(v).some(x => x == null) ? (s.st.p.semValores || 'Falta valor de sempre deste produto na Precificação, aba Parâmetros: digite o do orçamento.') : '';
    }
    pintarResumo(s.st);
    return true;
  },
  async gerar(s) {
    const st = s.st;
    const sel = st.p.selecionavel ? selecaoDe(st) : null;
    // na alteração, o passo a passo, a documentação e o que muda saem do que está marcado
    const p = produtoDaSelecao(st.p, sel);
    const d = dadosDoOrcamento({ cliente: st.cliente, dia: st.dia, valores: st.valores });
    const canvases = await imagensDoProduto(p, d, { logo: s.logo });
    const semMarca = st.p.selecionavel && !st.alt.length;
    return {
      canvases,
      // a mensagem leva o link do formulário do produto (empresa.html), pras informações e os documentos não irem pela conversa
      mensagem: mensagemDoProduto(p, { nome: st.cliente, quem: st.quem, validade: d.validadeIso, formulario: linkDoFormulario(st.p, location.href, sel) }),
      pronto: semMarca ? 'Marque o que muda: a documentação, o que muda no orçamento e o link do formulário saem do que você marcar.'
        : d.problemas.length ? 'As imagens estão prontas, mas confira os valores do orçamento antes de mandar.' : undefined
    };
  }
});

// abre a janela. opc: { produto ('transformacao', 'constituicao' ou 'alteracao', de PRODUTOS), supabase, cliente, quem (o
// nome de quem manda), dia ('AAAA-MM-DD'; sem ele, hoje), valores ({ aVista, entrada, parcela }; sem eles, os de sempre,
// lidos do banco), logo (Image da logo; sem ela, carrega assets/logo-mr.png) }
export function abrirProdutoSocietario(opc = {}) {
  return janela.abrir(opc);
}
