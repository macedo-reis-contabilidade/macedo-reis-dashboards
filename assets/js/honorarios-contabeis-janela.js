// ============================================================================
// MACEDO & REIS — A janela dos honorários contábeis pro WhatsApp (24/11/2026), aberta pelo produto "Honorários
// contábeis" da Vitrine de serviços: as duas imagens (o que está incluso; como funciona e o que é cobrado à parte), sem
// valores nem o nome do cliente, e a mensagem pronta, com o link do questionário da proposta (proposta.html: o da
// empresa que já funciona, ou o da empresa nova, ?perfil=nova). O cliente e a empresa só mudam a mensagem.
// A janela em si (as imagens com o Copiar e o Baixar, o Compartilhar todas, a mensagem) é a de janela-whats.js, a mesma
// dos planos do MEI e dos produtos do societário. Nada é gravado.
// ============================================================================
import { TITULO, PERFIS, perfilDe, linkDaProposta, mensagemDosHonorarios, nomeDoArquivo } from './honorarios-contabeis.js';
import { imagensDosHonorarios } from './honorarios-contabeis-imagem.js';
import { criarJanelaWhats, ROTULO, esc } from './janela-whats.js';

const $ = id => document.getElementById(id);
const LEGENDAS = ['o que está incluso', 'como funciona e o que é à parte'];
const CAMPO = 'display:flex; flex-direction:column; gap:4px;';

const janela = criarJanelaWhats({
  id: 'hc', ov: 'ovHonorarios', titulo: `${TITULO} pro WhatsApp`, foco: 'hcCliente',
  campos: `
      <div style="display:flex; flex-wrap:wrap; gap:12px 18px; align-items:flex-end; margin-bottom:12px;">
        <label style="${CAMPO} flex:2 1 240px; min-width:0;"><span style="${ROTULO}">Cliente</span><input id="hcCliente" class="input" maxlength="120" placeholder="o nome, pra mensagem" autocomplete="off"></label>
        <label style="${CAMPO} flex:1 1 220px; min-width:0;"><span style="${ROTULO}">A empresa (o questionário da proposta)</span><select id="hcPerfil" class="input">
          ${Object.entries(PERFIS).map(([id, p]) => `<option value="${id}">${esc(p.rotulo)}</option>`).join('')}
        </select></label>
      </div>`,
  instrucao: 'No WhatsApp: copie a imagem 1, cole na conversa (Ctrl+V) e mande; depois a 2, e a mensagem por último, com o link do questionário da proposta. As imagens não têm valores nem o nome do cliente: servem pra qualquer um e pro anúncio.',
  legenda: i => LEGENDAS[i] || '',
  nomeDoArquivo: (s, i) => nomeDoArquivo(i),
  ligar(j) {
    $('hcCliente').addEventListener('input', () => {
      const s = j.sessao();
      if (!s) return;
      s.st.cliente = $('hcCliente').value;
      j.redesenharDepois();
    });
    $('hcPerfil').addEventListener('change', () => {
      const s = j.sessao();
      if (!s) return;
      s.st.perfil = perfilDe($('hcPerfil').value);
      j.redesenhar();
    });
  },
  iniciar(s, { cliente = '', quem = '', perfil = 'constituida' }) {
    s.st = { cliente: String(cliente || ''), quem, perfil: perfilDe(perfil) };
    $('hcCliente').value = s.st.cliente;
    $('hcPerfil').value = s.st.perfil;
  },
  async gerar(s) {
    const st = s.st;
    const canvases = await imagensDosHonorarios({ logo: s.logo });
    return {
      canvases,
      mensagem: mensagemDosHonorarios({ nome: st.cliente, quem: st.quem, perfil: st.perfil, link: linkDaProposta(st.perfil, location.href) })
    };
  }
});

// abre a janela. opc: { cliente, quem (o nome de quem manda), perfil ('constituida' ou 'nova'), logo (Image da logo; sem
// ela, carrega assets/logo-mr.png) }
export function abrirHonorarios(opc = {}) {
  return janela.abrir(opc);
}
