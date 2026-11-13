// ============================================================
// MACEDO & REIS — Reforma Tributária · prazos da opção IBS/CBS no Simples Nacional
// Fonte ÚNICA das datas que a tela, a análise técnica, o comunicado e a agenda mostram — quando o CGSN mudar
// um prazo, muda aqui e em rt_casos.prazo_opcao (o banco guarda o prazo de cada caso).
//
// Resolução CGSN 186/2026, alterada pela Resolução CGSN 194/2026 (DOU de 28/09/2026); nota da Receita Federal
// de 29/09/2026 ("Simples Nacional 2027: entenda os novos prazos"):
//   · opção pelo regime regular de IBS/CBS ("por fora"): 01/09 a 30/10/2026, efeitos a partir de 01/01/2027;
//   · opção pelo Simples Nacional para 2027: 01/09 a 15/10/2026;
//   · cancelamento das opções: 03/11 a 20/12/2026 — o cancelamento é irretratável.
// Até a 194 eram 30/09 (opção) e "até 30/11" (cancelamento). Próximas janelas (Res. CGSN 190/2026, art. 40-D,
// efeitos a partir de 2027): março (efeito em 1º/jul) e setembro (efeito em 1º/jan seguinte).
// ============================================================
export const RT_PRAZO = {
  opcaoFim: '2026-10-30',          // último dia da opção pelo regime regular de IBS/CBS com efeito em 01/01/2027
  opcao: '30/10/2026',
  opcaoDM: '30/10',
  simples: '15/10/2026',           // opção pelo Simples Nacional para 2027
  cancelaDe: '03/11/2026',
  cancelaAte: '20/12/2026',
  cancelaAteDM: '20/12',
  cancelamento: 'de 03/11 a 20/12/2026',
  norma: 'Resolução CGSN 186/2026, alterada pela 194/2026',
  proxima: 'março/2027',
  proximaEfeito: 'julho/2027'
};

// Notas fiscais no padrão do IBS e da CBS para o optante do Simples, por dentro ou por fora — "manter" não dispensa a
// adequação do emissor. Ato Conjunto RFB/CGIBS nº 4/2026, art. 1º, § 1º, na redação do Ato Conjunto nº 7/2026 (DOU de
// 13/11/2026, em vigor na publicação): a NFS-e das alíneas "d" a "h" do inciso III (os serviços em geral, os bens
// imateriais e a locação) a partir de 01/01/2027 · as demais hipóteses do caput (NF-e, NFC-e, CT-e, MDF-e, BP-e e a
// NFS-e das alíneas "a" a "c": plataformas digitais e os subitens 1.03, 1.05, 1.09 e 16.01 da LC 116) a partir de
// 01/03/2027. Até 12/11/2026, no texto original do Ato nº 4, era 01/01/2027 para tudo. A análise técnica e o
// comunicado leem daqui.
export const RT_NOTAS = {
  servico: '01/01/2027',
  mercadoria: '01/03/2027',
  norma: 'Ato Conjunto RFB/CGIBS nº 4/2026, art. 1º, § 1º, na redação do Ato Conjunto nº 7/2026',
  texto: 'as de serviço (NFS-e) a partir de 01/01/2027, e as de mercadoria e de transporte (NF-e, NFC-e, CT-e e BP-e) a partir de 01/03/2027, data que vale também para a NFS-e de licenciamento de software, processamento e hospedagem de dados, conteúdo pela internet, plataformas digitais e transporte coletivo municipal'
};

// a janela de 2026 está aberta? (hojeISO = 'AAAA-MM-DD' no fuso local)
export const janelaAberta = hojeISO => String(hojeISO || '') <= RT_PRAZO.opcaoFim;
