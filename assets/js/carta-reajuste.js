// ============================================================
// MACEDO & REIS — a carta de reajuste dos honorários (20/10/2026)
// Sai da Precificação › Carteira: escolher "Reajuste proposto" na situação da revisão pede o valor e o mês e baixa esta
// carta pro cliente; o botão "Carta" da linha baixa de novo (no proposto e no aceito).
//   textoDaCarta(dados) → os textos da carta (pura, testada em tests/carta-reajuste.test.mjs)
//   desenharCarta(doc, carta) → escreve a carta num jsPDF, no padrão do kit de boas-vindas (clientes/editar.html:
//     as margens, a Helvetica, as cores e o rodapé do escritório)
//   cartaEmPdf(jsPDF, dados) → { doc, nome, carta }: quem chama faz o doc.save(nome)
// A carta vai pro cliente: leva só o nome e o documento dele, o honorário de hoje, o novo e a mensalidade em que começa
// (com a base de boletos, o mês do vencimento). Nunca o motor, o piso, percentual, as respostas do
// questionário, as anotações nem de onde veio o valor de hoje: textoDaCarta nem recebe nada disso.
// ============================================================
import { formatDocumento, normalizarDocumento } from './utils.js';

export const ESCRITORIO = {
  nome: 'Macedo & Reis Contabilidade',
  razao: 'Macedo & Reis Contabilidade Ltda',
  cidade: 'Três Coroas',
  endereco: 'Rua Luiz Volkart, 35, 1º andar - Centro - Três Coroas/RS',
  telefone: '(51) 9 9823-7182',
  email: 'atendimento@macedoereis.com.br',
};

export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const RX_DIA = /^(\d{4})-(\d{2})-(\d{2})/;
const RX_MES = /^(\d{4})-(0[1-9]|1[0-2])$/;
const maiuscula = s => s.charAt(0).toUpperCase() + s.slice(1);

// '2026-10-20' → '20 de Outubro de 2026' (o mês com maiúscula, como as datas por extenso do sistema e do kit)
export function dataPorExtenso(iso) {
  const m = RX_DIA.exec(String(iso || ''));
  if (!m || +m[2] < 1 || +m[2] > 12) return '';
  return Number(m[3]) + ' de ' + maiuscula(MESES[+m[2] - 1]) + ' de ' + m[1];
}
// '2026-11' → 'novembro de 2026' (no meio da frase, minúsculo)
export function mesPorExtenso(comp) {
  const m = RX_MES.exec(String(comp || ''));
  return m ? MESES[+m[2] - 1] + ' de ' + m[1] : '';
}
// '2026-12' → '2027-01': o boleto da competência M vence no mês seguinte
export function mesSeguinte(comp) {
  const m = RX_MES.exec(String(comp || ''));
  if (!m) return '';
  const t = +m[1] * 12 + (+m[2] - 1) + 1;
  return Math.floor(t / 12) + '-' + String(t % 12 + 1).padStart(2, '0');
}
// 1234.5 → 'R$ 1.234,50', com o espaço que não quebra entre o R$ e o número (a linha não separa os dois)
export function dinheiro(v) {
  const n = Math.round(Number(v) * 100) / 100;
  if (!Number.isFinite(n)) return '';
  const [i, d] = Math.abs(n).toFixed(2).split('.');
  return (n < 0 ? '-' : '') + 'R$\u00a0' + i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + d;
}
// o nome pra carta: o nome oficial do MEI antigo traz o CPF no fim ("FULANO 12345678901") e o do MEI novo, a raiz do CNPJ
// na frente ("12.345.678 FULANO") — a mesma regra da Carteira de clientes (comercial-carteira.html)
export function nomeDaEmpresa(cliente) {
  const nome = String((cliente && (cliente.nome_principal || cliente.nome)) || '').replace(/\s+/g, ' ').trim();
  return nome.replace(/\s+\d{11}$/, '').replace(/^\d{2}\.\d{3}\.\d{3}\s+/, '').trim() || nome;
}
// 'CNPJ 10.000.000/0001-91' ou 'CPF 123.456.789-09'; sem documento, vazio
export function linhaDoDocumento(doc) {
  const d = normalizarDocumento(doc);
  if (d.length === 14) return 'CNPJ ' + formatDocumento(d);
  if (d.length === 11) return 'CPF ' + formatDocumento(d);
  return '';
}
// 'Carta de reajuste - PADARIA DO TESTE LTDA.pdf' (sem os caracteres que o Windows não aceita no nome do arquivo)
export function nomeDoArquivo(cliente) {
  const nome = nomeDaEmpresa(cliente).replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100).trim();
  return 'Carta de reajuste' + (nome ? ' - ' + nome : '') + '.pdf';
}

// textoDaCarta({ cliente, atual, novo, vigencia, boleto, data }) → { titulo, local, destinatario, saudacao, paragrafos,
// despedida, assinatura }.
//   cliente: { nome_principal, documento } · atual: o honorário de hoje (sem ele, a carta diz só o novo) · novo: o valor
//   proposto (no MEI, o do plano) · vigencia: 'AAAA-MM', a mensalidade em que o novo começa · boleto: o cliente está na base
//   de boletos (a carta diz o mês do vencimento — a mensalidade do mês M vence no mês seguinte, como o boleto e a cláusula
//   10.2 do contrato do kit — e, enquanto ele ainda vem, que os boletos de antes seguem com o valor atual) · data:
//   'AAAA-MM-DD', o dia da carta (baixada de novo depois, sai com o dia de hoje)
// Pra quem é a carta: a empresa, o MEI (o nome de uma pessoa) ou a pessoa física — por isso sem o "À" (pede o feminino,
// "à empresa"), sem "a empresa" no corpo e com "Prezado cliente" e "Se quiser", que servem pros três
export function textoDaCarta({ cliente, atual = null, novo, vigencia, boleto = false, data } = {}) {
  const valorNovo = Math.round(Number(novo) * 100) / 100;
  if (!(valorNovo > 0)) throw new Error('a carta precisa do valor novo');
  if (!RX_MES.test(String(vigencia || ''))) throw new Error('a carta precisa do mês em que o valor novo começa (AAAA-MM)');
  const dia = dataPorExtenso(data);
  if (!dia) throw new Error('a carta precisa da data (AAAA-MM-DD)');
  const valorAtual = Number(atual) > 0 ? Math.round(Number(atual) * 100) / 100 : null;
  const temAtual = valorAtual != null && valorAtual !== valorNovo;
  const sobe = !temAtual || valorNovo > valorAtual;
  // o mês com o ano (e o telefone) não se separam na quebra da linha: o espaço entre eles é o que não quebra
  const junto = s => String(s).replace(/ /g, '\u00a0');
  const ehDaquiPraFrente = String(vigencia) >= String(data).slice(0, 7);   // a mensalidade do valor novo ainda não passou
  const destinatario = [nomeDaEmpresa(cliente), linhaDoDocumento(cliente && cliente.documento)].filter(Boolean);
  const paragrafos = [
    'Agradecemos a confiança no trabalho da ' + ESCRITORIO.nome + '.',
    'Revisamos periodicamente os honorários de cada cliente, para que acompanhem o trabalho que fazemos hoje: as obrigações do mês, os documentos que conferimos e o atendimento do dia a dia.'
      + (sobe ? ' Nos últimos anos, as mudanças na legislação também trouxeram novas obrigações e mais verificações.' : ''),
    'Com esta revisão, os honorários mensais ' + (temAtual ? 'passam de ' + dinheiro(valorAtual) + ' para ' : 'passam a ser de ') + dinheiro(valorNovo)
      + ' a partir da mensalidade de ' + junto(mesPorExtenso(vigencia))
      + (boleto ? ', com vencimento em ' + junto(mesPorExtenso(mesSeguinte(vigencia))) + '.' + (temAtual && ehDaquiPraFrente ? ' Até lá, os boletos seguem com o valor atual.' : '') : '.'),
    'Se quiser conversar sobre o novo valor, estamos à disposição pelo telefone ' + junto(ESCRITORIO.telefone) + ' e pelo e-mail ' + ESCRITORIO.email + '.',
  ];
  return {
    titulo: 'REAJUSTE DOS HONORÁRIOS CONTÁBEIS',
    local: ESCRITORIO.cidade + ', ' + dia + '.',
    destinatario,
    saudacao: 'Prezado cliente,',
    paragrafos,
    despedida: 'Atenciosamente,',
    assinatura: ESCRITORIO.nome,
  };
}

// ---------- o PDF: o padrão do kit de boas-vindas (clientes/editar.html: KIT_MX, KIT_MR, KIT_TOPO, KIT_FUNDO, kitRodape) ----------
export const MARGENS = { esquerda: 56, direita: 539, topo: 56, fundo: 780 };
const CENTRO = 297.5;
const COR_TEXTO = [30, 34, 42];

function rodape(doc) {
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(91, 130, 166);
    doc.text(ESCRITORIO.razao, CENTRO, 800, { align: 'center' });
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(138, 147, 166);
    doc.text(ESCRITORIO.endereco, CENTRO, 811, { align: 'center' });
    doc.text(ESCRITORIO.telefone + ' - ' + ESCRITORIO.email, CENTRO, 822, { align: 'center' });
  }
}

// desenharCarta(doc, carta): a carta numa folha A4 em pontos (o jsPDF de { unit: 'pt', format: 'a4' }); o parágrafo que não
// cabe no fim da folha vai inteiro pra próxima, como no kit
export function desenharCarta(doc, carta) {
  const { esquerda: MX, direita: MR, topo: TOPO, fundo: FUNDO } = MARGENS;
  let y = TOPO;
  const escrever = (txt, { size = 10.5, bold = false, center = false, gap = 10 } = {}) => {
    const lh = size * 1.42;
    doc.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(size).setTextColor(...COR_TEXTO);
    const linhas = doc.splitTextToSize(String(txt), MR - MX);
    if (y + linhas.length * lh > FUNDO) { doc.addPage(); y = TOPO; }
    linhas.forEach(l => {
      if (center) doc.text(l, CENTRO, y, { align: 'center' });
      else doc.text(l, MX, y);
      y += lh;
    });
    y += gap;
  };
  escrever(carta.titulo, { size: 12.5, bold: true, center: true, gap: 24 });
  escrever(carta.local, { gap: 20 });
  carta.destinatario.forEach((l, i, a) => escrever(l, { bold: i === 0, gap: i === a.length - 1 ? 20 : 0 }));
  escrever(carta.saudacao, { gap: 12 });
  carta.paragrafos.forEach(p => escrever(p, { gap: 10 }));
  y += 6;
  escrever(carta.despedida, { gap: 26 });
  escrever(carta.assinatura, { bold: true, gap: 0 });
  rodape(doc);
  return doc;
}

// cartaEmPdf(jsPDF, dados) → { doc, nome, carta }: a carta pronta (dados: os de textoDaCarta)
export function cartaEmPdf(JsPDF, dados) {
  const carta = textoDaCarta(dados);
  const doc = new JsPDF({ unit: 'pt', format: 'a4' });
  if (typeof doc.setProperties === 'function') doc.setProperties({ title: 'Reajuste dos honorários contábeis - ' + nomeDaEmpresa(dados.cliente), author: ESCRITORIO.nome });
  desenharCarta(doc, carta);
  return { doc, nome: nomeDoArquivo(dados.cliente), carta };
}
