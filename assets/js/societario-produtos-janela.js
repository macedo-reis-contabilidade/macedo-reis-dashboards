// ============================================================================
// MACEDO & REIS — A janela dos produtos do societário pro WhatsApp (24/11/2026: a transformação do MEI em ME e a
// abertura de empresa), aberta pelos produtos da Vitrine de serviços. Abre com o nome do cliente, a data de hoje e os
// valores de sempre do produto, lidos do banco (a aba Parâmetros da Precificação: nunca no código, que é público); mudar
// um campo refaz as imagens e a mensagem. O orçamento vale até o último dia útil do mês seguinte.
// A janela em si (as imagens com o Copiar e o Baixar, o Compartilhar todas, a mensagem) é a de janela-whats.js, a mesma
// dos planos do MEI. Uma janela só pros produtos da família: o título e o rótulo do cliente são os do produto aberto.
// Nada é gravado.
// ============================================================================
import { DIAS_DA_PARCELA, produtoDe, valoresDosParametros, dadosDoOrcamento, mensagemDoProduto, nomeDoArquivo, resumoDosValores,
  hojeEmBrasilia } from './societario-produtos.js';
import { imagensDoProduto } from './societario-produtos-imagem.js';
import { criarJanelaWhats, ROTULO } from './janela-whats.js';

const $ = id => document.getElementById(id);
const LEGENDAS = ['o passo a passo', 'a documentação', 'o orçamento (vai à parte)'];
// o valor no campo: "1.234,50" (sem valor, vazio)
const noCampo = v => (v == null || v === '' ? '' : (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const CAMPO = 'display:flex; flex-direction:column; gap:4px;';
// o campo de cada valor
const CAMPOS = { aVista: 'spAVista', entrada: 'spEntrada', parcela: 'spParcela' };

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
  },
  iniciar(s, { produto = 'transformacao', cliente = '', quem = '', dia = '', valores = null }) {
    const p = produtoDe(produto) || produtoDe('transformacao');
    s.st = { p, cliente: String(cliente || ''), quem, dia: dia || hojeEmBrasilia(), valores: { ...(valores || {}) }, avisoValores: '' };
    $('spTitulo').textContent = `${p.titulo} pro WhatsApp`;
    $('spClienteRotulo').textContent = p.cliente;
    $('spCliente').value = s.st.cliente;
    $('spData').value = s.st.dia;
    for (const [campo, id] of Object.entries(CAMPOS)) $(id).value = noCampo(s.st.valores[campo]);
    $('spResumo').textContent = '';
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
      s.st.avisoValores = r.error ? 'Não deu pra ler os valores de sempre agora: digite os do orçamento.'
        : Object.values(v).some(x => x == null) ? 'Falta valor de sempre deste produto na Precificação, aba Parâmetros: digite o do orçamento.' : '';
    }
    pintarResumo(s.st);
    return true;
  },
  async gerar(s) {
    const st = s.st;
    const d = dadosDoOrcamento({ cliente: st.cliente, dia: st.dia, valores: st.valores });
    const canvases = await imagensDoProduto(st.p, d, { logo: s.logo });
    return {
      canvases,
      mensagem: mensagemDoProduto(st.p, { nome: st.cliente, quem: st.quem, validade: d.validadeIso }),
      pronto: d.problemas.length ? 'As imagens estão prontas, mas confira os valores do orçamento antes de mandar.' : undefined
    };
  }
});

// abre a janela. opc: { produto ('transformacao' ou 'constituicao', de PRODUTOS), supabase, cliente, quem (o nome de
// quem manda), dia ('AAAA-MM-DD'; sem ele, hoje), valores ({ aVista, entrada, parcela }; sem eles, os de sempre, lidos
// do banco), logo (Image da logo; sem ela, carrega assets/logo-mr.png) }
export function abrirProdutoSocietario(opc = {}) {
  return janela.abrir(opc);
}
