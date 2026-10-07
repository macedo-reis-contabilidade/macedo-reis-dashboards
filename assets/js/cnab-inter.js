// ============================================================
// MACEDO & REIS — arquivo de boletos do Banco Inter (CNAB 400, carteira 112), 06/10/2026
// Monta o arquivo .REM que o Inter importa em Cobrar ou Receber › Cobrança via arquivo › Importar arquivo › Arquivo (.REM).
// Layout do "Manual CNAB400 Emissão boletos de cobrança V2.2" do Inter: header, um detalhe tipo 1 por boleto (mais um
// tipo 2 quando a mensagem passa de 70 letras) e o trailer; 400 posições por linha, CRLF no fim de cada uma,
// maiúsculas sem acento nem caractere especial.
// - Carteira 112: já vem em toda conta Inter PJ, sem pedir nada ao banco; o Inter gera o nosso número (volta no retorno).
// - Sem multa, sem juros e sem desconto; aceita pagamento até o fim do mês do vencimento (como no site do Inter), no
//   mínimo 1 e no máximo 60 dias depois do vencimento (limite do layout).
// - Sem o registro tipo 3 (e-mail do pagador): o Inter não manda nada sozinho pro cliente.
// - Número de controle (posições 38 a 62) = id da cobrança sem hífens, 25 primeiros caracteres: é o que volta no
//   arquivo de retorno pra achar a cobrança.
// Puro (sem tela, sem banco): a grade de boletos (financeiro-boletos.html) usa; tests/cnab-inter.test.mjs confere.
// ============================================================

export const BANCO = '077';
export const AGENCIA = '0001';
export const CARTEIRA = '112';
export const VALOR_MINIMO = 2.5;            // "Valor mínimo R$2,50"
export const DIAS_PAGAMENTO = [1, 60];      // "Informar valor entre '01' e '60' - dias após o vencimento"
export const ONDE_IMPORTAR = 'Cobrar ou Receber › Cobrança via arquivo › Importar arquivo › Arquivo (.REM)';
const UFS = new Set('AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'.split(' '));

// texto do arquivo: maiúsculas, sem acento e sem caractere especial (o "&" vira "E"). Ficam ponto, vírgula, hífen, barra,
// igual, dois-pontos, ponto e vírgula, % e + — a observação da grade ("EMISSÃO NF (2) = 80,00") sai legível no boleto
// ("EMISSAO NF 2 = 80,00"); parênteses e os demais símbolos viram espaço
export function textoCnab(s) {
  return String(s ?? '').normalize('NFKD').replace(/\p{M}+/gu, '').toUpperCase()
    .replace(/&/g, ' E ').replace(/[^A-Z0-9 .,\-\/=:;%+]/g, ' ').replace(/\s+/g, ' ').trim();
}
const alfa = (s, n) => textoCnab(s).slice(0, n).padEnd(n, ' ');
const brancos = n => ' '.repeat(n);
const zeros = n => '0'.repeat(n);
function num(v, n, campo) {
  const t = String(v ?? '');
  if (!/^\d*$/.test(t)) throw new Error(`${campo}: só números`);
  if (t.length > n) throw new Error(`${campo}: passa de ${n} dígitos`);
  return t.padStart(n, '0');
}
const centavos = v => Math.round((Number(v) || 0) * 100);
const soDigitos = s => String(s ?? '').replace(/\D/g, '');

export function isoValida(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
const ddmmaa = s => s.slice(8, 10) + s.slice(5, 7) + s.slice(2, 4);

// dias depois do vencimento em que o boleto ainda aceita pagamento: até o último dia do mês do vencimento, entre 1 e 60
export function diasPagamento(venc) {
  const [y, m, d] = venc.split('-').map(Number);
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Math.min(DIAS_PAGAMENTO[1], Math.max(DIAS_PAGAMENTO[0], ultimo - d));
}
export function pagavelAte(venc) {
  const [y, m, d] = venc.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + diasPagamento(venc))).toISOString().slice(0, 10);
}

// "seu número" (10 posições, volta no retorno) no padrão do escritório: dia, mês e ano, sem zero à esquerda no dia e
// no mês, e o número do boleto no dia — 06/10/2026, 1º boleto → 610261
export function seuNumero(dataIso, seq) {
  const [y, m, d] = dataIso.split('-').map(Number);
  const s = `${d}${m}${String(y).slice(2)}${seq}`;
  if (s.length > 10) throw new Error('seu número passa de 10 posições');
  return s;
}

// número de controle: id da cobrança sem hífens, 25 primeiros caracteres
export const controleDe = id => String(id || '').replace(/-/g, '').toUpperCase().slice(0, 25);

// conta corrente digitada com o dígito ("12345678-9" ou "123456789") → { conta, dv }; null se não fecha
export function lerConta(txt) {
  const d = soDigitos(txt);
  if (d.length < 2 || d.length > 10) return null;
  return { conta: d.slice(0, -1), dv: d.slice(-1) };
}

const ABREV = [[/^AVENIDA\b/, 'AV'], [/^TRAVESSA\b/, 'TV'], [/^ESTRADA\b/, 'EST'], [/^RODOVIA\b/, 'ROD'],
  [/^ALAMEDA\b/, 'AL'], [/^LOTEAMENTO\b/, 'LOT']];
// endereço do pagador em 38 posições: logradouro e número, mais complemento e bairro enquanto couber
export function enderecoCnab(c) {
  let lg = textoCnab(c.logradouro);
  for (const [re, ab] of ABREV) lg = lg.replace(re, ab);
  const base = lg + ' ' + (textoCnab(c.numero) || 'S/N');
  const comp = textoCnab(c.complemento), bai = textoCnab(c.bairro);
  const opcoes = [
    [base, comp, bai && '- ' + bai].filter(Boolean).join(' '),
    [base, bai && '- ' + bai].filter(Boolean).join(' '),
    base,
  ];
  return (opcoes.find(o => o.length <= 38) || base).slice(0, 38).trim();
}

// o que impede o boleto de ir no arquivo (textos pra tela); lista vazia = pronto
export function problemasBoleto(b, hoje) {
  const p = [];
  const doc = String(b.documento || '').replace(/[\s.\-\/]/g, '').toUpperCase();
  if (!textoCnab(b.nome)) p.push('sem nome no cadastro');
  if (/[A-Z]/.test(doc)) p.push('CNPJ com letras: o arquivo do Inter só aceita número — emita este no site do Inter');
  else if (doc.length !== 11 && doc.length !== 14) p.push('CPF/CNPJ faltando ou incompleto no cadastro');
  if (!textoCnab(b.logradouro)) p.push('sem endereço no cadastro');
  if (soDigitos(b.cep).length !== 8) p.push('CEP faltando ou incompleto no cadastro');
  if (!UFS.has(String(b.uf || '').trim().toUpperCase())) p.push('UF faltando no cadastro');
  if (!isoValida(b.vencimento)) p.push('sem vencimento');
  else if (hoje && b.vencimento < hoje) p.push('vencimento já passou');
  if (!(centavos(b.valor) >= centavos(VALOR_MINIMO))) p.push('valor abaixo de R$ 2,50 (mínimo do Inter)');
  return p;
}

// boletos: [{ controle, seuNumero, vencimento, valor, documento, nome, logradouro, numero, complemento, bairro, uf, cep,
// mensagem }] → { nome, conteudo, linhas, qtd, total }. Erro (Error) se algo não fecha — nada de arquivo pela metade.
export function montarRemessa({ empresa, conta, dv, numero, data, boletos }) {
  if (!/^\d{1,9}$/.test(String(conta ?? ''))) throw new Error('Conta corrente do Inter: até 9 números, sem o dígito.');
  if (!/^\d$/.test(String(dv ?? ''))) throw new Error('Dígito da conta: um número.');
  if (!(Number.isInteger(numero) && numero >= 1 && numero <= 9999999)) throw new Error('Número do arquivo inválido.');
  if (!isoValida(data)) throw new Error('Data do arquivo inválida.');
  if (!textoCnab(empresa)) throw new Error('Falta o nome da empresa no arquivo.');
  if (!boletos || !boletos.length) throw new Error('Nenhum boleto marcado.');
  const linhas = [];
  const seq = () => String(linhas.length + 1).padStart(6, '0');
  const nr = String(numero).padStart(7, '0');
  linhas.push(['0', '1', 'REMESSA', '01', alfa('COBRANCA', 15), brancos(20), alfa(empresa, 30), BANCO, alfa('INTER', 15),
    ddmmaa(data), brancos(10), nr, brancos(277), seq()].join(''));
  let total = 0;
  const controles = new Set();
  boletos.forEach((b, i) => {
    const quem = textoCnab(b.nome) || `boleto ${i + 1}`;
    const probl = problemasBoleto(b);
    if (probl.length) throw new Error(`${quem}: ${probl.join('; ')}`);
    if (!b.controle || controles.has(b.controle)) throw new Error(`${quem}: número de controle vazio ou repetido`);
    controles.add(b.controle);
    if (!textoCnab(b.seuNumero)) throw new Error(`${quem}: sem o seu número`);
    const doc = soDigitos(b.documento), cent = centavos(b.valor), msg = textoCnab(b.mensagem);
    total += cent;
    linhas.push(['1', brancos(19), CARTEIRA, AGENCIA, num(conta, 9, 'conta'), String(dv),
      alfa(b.controle, 25), brancos(3),
      '0', zeros(13), zeros(4), zeros(6),           // sem multa
      zeros(11), brancos(8), '01',                  // nosso número: o Inter gera (carteira 112); 01 = remessa
      alfa(b.seuNumero, 10), ddmmaa(b.vencimento), num(cent, 13, 'valor'),
      num(diasPagamento(b.vencimento), 2, 'dias de pagamento'), brancos(6), '01', 'N', brancos(6), brancos(3),
      '0', zeros(13), zeros(4), zeros(6),           // sem juros/mora
      '0', zeros(13), zeros(4), zeros(6),           // sem desconto
      zeros(13),
      doc.length === 14 ? '02' : '01', num(doc, 14, 'CPF/CNPJ'), alfa(b.nome, 40),
      alfa(enderecoCnab(b), 38), alfa(String(b.uf).trim(), 2), num(soDigitos(b.cep), 8, 'CEP'),
      alfa(msg.slice(0, 70), 70), seq()].join(''));
    const resto = msg.slice(70).trim();
    if (resto) {
      const m = k => alfa(resto.slice(k * 78, k * 78 + 78), 78);
      linhas.push(['2', m(0), m(1), m(2), m(3), zeros(6), zeros(13), zeros(4), brancos(10), zeros(6), zeros(13), zeros(4),
        brancos(10), zeros(11), brancos(4), seq()].join(''));
    }
  });
  linhas.push(['9', String(boletos.length).padStart(6, '0'), brancos(387), seq()].join(''));
  linhas.forEach((l, i) => { if (l.length !== 400) throw new Error(`linha ${i + 1} com ${l.length} posições`); });
  return { nome: `CI400_001_${nr}.REM`, conteudo: linhas.join('\r\n') + '\r\n', linhas, qtd: boletos.length, total: total / 100 };
}
