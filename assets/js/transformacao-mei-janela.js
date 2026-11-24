// ============================================================================
// MACEDO & REIS — A janela da transformação do MEI em ME pro WhatsApp (24/11/2026), aberta pelo produto
// "Transformação do MEI em ME" da Vitrine de serviços. Abre com o nome do cliente, a data de hoje e os valores de
// sempre, lidos do banco (a aba Parâmetros da Precificação: nunca no código, que é público); mudar um campo refaz as
// imagens e a mensagem. O orçamento vale até o último dia útil do mês seguinte.
// A janela em si (as imagens com o Copiar e o Baixar, o Compartilhar todas, a mensagem) é a de janela-whats.js, a mesma
// dos planos do MEI. Nada é gravado.
// ============================================================================
import { GRUPO_PARAMETROS, DIAS_DA_PARCELA, valoresDosParametros, dadosDoOrcamento, mensagemDaTransformacao, nomeDoArquivo, resumoDosValores,
  hojeEmBrasilia } from './transformacao-mei.js';
import { imagensDaTransformacao } from './transformacao-mei-imagem.js';
import { criarJanelaWhats, ROTULO } from './janela-whats.js';

const $ = id => document.getElementById(id);
const LEGENDAS = ['o passo a passo', 'a documentação', 'o orçamento (vai à parte)'];
// o valor no campo: "1.234,50" (sem valor, vazio)
const noCampo = v => (v == null || v === '' ? '' : (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const CAMPO = 'display:flex; flex-direction:column; gap:4px;';

// o campo de cada valor
const CAMPOS = { aVista: 'tmAVista', entrada: 'tmEntrada', parcela: 'tmParcela' };

// o resumo de cima: o a prazo somado, o desconto e a validade; o que falta, em vermelho (com o porquê, quando os valores
// de sempre não vieram do banco)
function pintarResumo(st) {
  const d = dadosDoOrcamento({ cliente: st.cliente, dia: st.dia, valores: st.valores });
  const el = $('tmResumo');
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
  id: 'tm', ov: 'ovTransformacaoMei', titulo: 'A transformação do MEI em ME pro WhatsApp', foco: 'tmCliente',
  campos: `
      <div style="display:flex; flex-wrap:wrap; gap:12px 18px; align-items:flex-end;">
        <label style="${CAMPO} flex:2 1 240px; min-width:0;"><span style="${ROTULO}">Cliente (o titular do MEI)</span><input id="tmCliente" class="input" maxlength="120" placeholder="o nome, pro orçamento e a mensagem" autocomplete="off"></label>
        <label style="${CAMPO} width:160px;"><span style="${ROTULO}">Data do orçamento</span><input id="tmData" class="input" type="date"></label>
        <label style="${CAMPO} width:130px;"><span style="${ROTULO}">À vista (R$)</span><input id="tmAVista" class="input" inputmode="decimal" autocomplete="off"></label>
        <label style="${CAMPO} width:130px;"><span style="${ROTULO}">Entrada (R$)</span><input id="tmEntrada" class="input" inputmode="decimal" autocomplete="off"></label>
        <label style="${CAMPO} width:150px;"><span style="${ROTULO}">Parcela em ${DIAS_DA_PARCELA} dias (R$)</span><input id="tmParcela" class="input" inputmode="decimal" autocomplete="off"></label>
      </div>
      <p id="tmResumo" role="status" style="margin:10px 0 12px; font-size:13px; color:var(--text-muted);"></p>`,
  instrucao: 'No WhatsApp: copie a imagem 1, cole na conversa (Ctrl+V) e mande; depois a 2 e o orçamento, e a mensagem por último. As imagens 1 e 2 não têm valores: servem pra qualquer cliente e pro anúncio.',
  legenda: i => LEGENDAS[i] || '',
  nomeDoArquivo: (s, i) => nomeDoArquivo(s.st.cliente, i),
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
    $('tmCliente').addEventListener('input', () => mudou('cliente', $('tmCliente').value));
    $('tmData').addEventListener('change', () => mudou('dia', $('tmData').value));
    $('tmAVista').addEventListener('input', () => mudou('aVista', $('tmAVista').value));
    $('tmEntrada').addEventListener('input', () => mudou('entrada', $('tmEntrada').value));
    $('tmParcela').addEventListener('input', () => mudou('parcela', $('tmParcela').value));
  },
  iniciar(s, { cliente = '', quem = '', dia = '', valores = null }) {
    s.st = { cliente: String(cliente || ''), quem, dia: dia || hojeEmBrasilia(), valores: { ...(valores || {}) }, avisoValores: '' };
    $('tmCliente').value = s.st.cliente;
    $('tmData').value = s.st.dia;
    for (const [campo, id] of Object.entries(CAMPOS)) $(id).value = noCampo(s.st.valores[campo]);
    $('tmResumo').textContent = '';
  },
  // os valores de sempre, do banco; quem abriu com os valores (opc.valores) fica com eles. A leitura que falha diz no
  // resumo e segue: a apresentação sai igual (não tem valor nenhum), e o orçamento espera os valores digitados
  async preparar(s, { supabase, valores = null }) {
    if (!valores) {
      s.aviso('Lendo os valores de sempre…');
      let r;
      try {
        r = supabase ? await supabase.from('precificacao_parametros').select('grupo, chave, valor').eq('grupo', GRUPO_PARAMETROS) : { error: true };
      } catch (e) { r = { error: true }; }
      if (!s.ativa()) return false;
      const v = r.error ? {} : valoresDosParametros(r.data);
      // só o que veio do banco vai pro campo: o que a pessoa já digitou enquanto lia fica
      for (const [campo, id] of Object.entries(CAMPOS)) {
        if (s.st.valores[campo] == null && v[campo] != null) { s.st.valores[campo] = v[campo]; $(id).value = noCampo(v[campo]); }
      }
      s.st.avisoValores = r.error ? 'Não deu pra ler os valores de sempre agora: digite os do orçamento.'
        : Object.values(v).some(x => x == null) ? 'Falta valor de sempre na Precificação, aba Parâmetros (o grupo da transformação): digite o do orçamento.' : '';
    }
    pintarResumo(s.st);
    return true;
  },
  async gerar(s) {
    const st = s.st;
    const d = dadosDoOrcamento({ cliente: st.cliente, dia: st.dia, valores: st.valores });
    const canvases = await imagensDaTransformacao(d, { logo: s.logo });
    return {
      canvases,
      mensagem: mensagemDaTransformacao({ nome: st.cliente, quem: st.quem, validade: d.validadeIso }),
      pronto: d.problemas.length ? 'As imagens estão prontas, mas confira os valores do orçamento antes de mandar.' : undefined
    };
  }
});

// abre a janela. opc: { supabase, cliente, quem (o nome de quem manda), dia ('AAAA-MM-DD'; sem ele, hoje), valores
// ({ aVista, entrada, parcela }; sem eles, os de sempre, lidos do banco), logo (Image da logo; sem ela, carrega
// assets/logo-mr.png) }
export function abrirTransformacaoMei(opc = {}) {
  return janela.abrir(opc);
}
