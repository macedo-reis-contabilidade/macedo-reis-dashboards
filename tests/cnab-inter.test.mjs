// Arquivo de boletos do Inter (assets/js/cnab-inter.js): posições do CNAB 400 pelo manual do Inter (V2.2, conferidas
// com a V9 de 06/07/2026), textos sem acento, regras do escritório (sem multa/juros, pagável até o fim do mês, seu número
// dia+mês+ano+nº) e o que barra um boleto; o arquivo de retorno (V9, seção 5, com as ocorrências 14/15/16), o código de
// barras e a linha digitável (V9, seção 8) e o desenho do Intercalado 2 de 5 do PDF (assets/js/boleto-pdf.js).
// Dados inventados. Rodar com: node tests/cnab-inter.test.mjs
import {
  textoCnab, seuNumero, diasPagamento, pagavelAte, lerConta, enderecoCnab, problemasBoleto, montarRemessa, controleDe,
  isoValida, lerRetorno, emAberto, codigoBarras, fatorVencimento, mod10, mod11, operacao7, nossoNumeroImpresso,
} from '../assets/js/cnab-inter.js';
import { larguras2de5, nomeArquivoBoleto } from '../assets/js/boleto-pdf.js';

let falhas = 0;
const chk = (nome, cond) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome); };
const igual = (nome, obtido, esperado) => chk(nome + ' (' + JSON.stringify(obtido) + ')', JSON.stringify(obtido) === JSON.stringify(esperado));
const pos = (l, de, ate) => l.slice(de - 1, ate);
const erro = fn => { try { fn(); return ''; } catch (e) { return e.message; } };

console.log('Textos do arquivo:');
igual('acento, & e caractere especial', textoCnab('Comércio & Indústria Ltda. — Nº 35, sala 2/3'), 'COMERCIO E INDUSTRIA LTDA. NO 35, SALA 2/3');
igual('observação da grade continua legível', textoCnab('EMISSÃO NF (2) = 80,00'), 'EMISSAO NF 2 = 80,00');
igual('parcela com barra', textoCnab('PARCELAMENTO ICMS (1/12) = 188,16'), 'PARCELAMENTO ICMS 1/12 = 188,16');
igual('símbolos fora da lista viram espaço', textoCnab('Sala #3 [fundos] "A" @ R$ 10'), 'SALA 3 FUNDOS A R 10');
igual('ç, til e espaços repetidos', textoCnab('  Confecção   São João  '), 'CONFECCAO SAO JOAO');
igual('vazio', textoCnab(null), '');

console.log('Regras do escritório:');
igual('seu número: 06/10/2026, 1º boleto', seuNumero('2026-10-06', 1), '610261');
igual('seu número: 25/12/2026, 12º boleto', seuNumero('2026-12-25', 12), '25122612');
chk('seu número que passa de 10 posições dá erro', erro(() => seuNumero('2026-12-25', 12345)) !== '');
igual('vencimento 10/10: paga até o fim do mês (21 dias)', [diasPagamento('2026-10-10'), pagavelAte('2026-10-10')], [21, '2026-10-31']);
igual('vencimento 15/04 (mês de 30)', [diasPagamento('2026-04-15'), pagavelAte('2026-04-15')], [15, '2026-04-30']);
igual('vencimento 30/10: 1 dia', [diasPagamento('2026-10-30'), pagavelAte('2026-10-30')], [1, '2026-10-31']);
igual('vencimento no último dia: no mínimo 1 dia (o layout não aceita 0)', [diasPagamento('2026-10-31'), pagavelAte('2026-10-31')], [1, '2026-11-01']);
igual('fevereiro de ano bissexto', diasPagamento('2028-02-10'), 19);
igual('conta com hífen', lerConta('12345678-9'), { conta: '12345678', dv: '9' });
igual('conta sem hífen', lerConta('123456789'), { conta: '12345678', dv: '9' });
igual('conta curta demais', lerConta('7'), null);
igual('conta longa demais', lerConta('12345678901'), null);
igual('controle = id sem hífens, 25 primeiros', controleDe('0a1b2c3d-4e5f-6789-abcd-ef0123456789'), '0A1B2C3D4E5F6789ABCDEF012');
chk('data impossível', !isoValida('2026-02-30') && isoValida('2026-02-28'));

console.log('Endereço do pagador (38 posições):');
igual('avenida abreviada, complemento e bairro', enderecoCnab({ logradouro: 'Avenida Central', numero: '100', complemento: 'Sala 2', bairro: 'Centro' }), 'AV CENTRAL 100 SALA 2 - CENTRO');
igual('sem número = S/N', enderecoCnab({ logradouro: 'Rua das Flores', numero: '', bairro: 'Centro' }), 'RUA DAS FLORES S/N - CENTRO');
igual('longo: sai o complemento antes do bairro', enderecoCnab({ logradouro: 'Rua Coronel Fulano', numero: '1234', complemento: 'Pavilhão 3 fundos', bairro: 'Vila Nova' }), 'RUA CORONEL FULANO 1234 - VILA NOVA');
igual('mais longo ainda: fica logradouro e número (bairro pela metade, não)', enderecoCnab({ logradouro: 'Rua Coronel Fulano de Tal', numero: '1234', complemento: 'Pavilhão 3 fundos', bairro: 'Vila Nova' }), 'RUA CORONEL FULANO DE TAL 1234');
chk('nunca passa de 38', enderecoCnab({ logradouro: 'Rua de nome muito muito muito comprido mesmo', numero: '99999' }).length <= 38);

console.log('O que barra um boleto:');
const ok = { nome: 'EMPRESA EXEMPLO LTDA', documento: '11.222.333/0001-81', logradouro: 'Rua Exemplo', numero: '10', bairro: 'Centro', uf: 'RS', cep: '95660-000', vencimento: '2026-10-10', valor: 450 };
igual('cadastro completo passa', problemasBoleto(ok, '2026-10-06'), []);
igual('CPF de 11 dígitos passa', problemasBoleto({ ...ok, documento: '123.456.789-09' }, '2026-10-06'), []);
igual('sem CEP', problemasBoleto({ ...ok, cep: '' }, '2026-10-06'), ['CEP faltando ou incompleto no cadastro']);
igual('sem endereço e sem UF', problemasBoleto({ ...ok, logradouro: ' ', uf: '' }, '2026-10-06'), ['sem endereço no cadastro', 'UF faltando no cadastro']);
igual('CNPJ com letras', problemasBoleto({ ...ok, documento: '12.ABC.345/01DE-35' }, '2026-10-06'), ['CNPJ com letras: o arquivo do Inter só aceita número — emita este no site do Inter']);
igual('documento incompleto', problemasBoleto({ ...ok, documento: '1122233300018' }, '2026-10-06'), ['CPF/CNPJ faltando ou incompleto no cadastro']);
igual('vencimento que já passou', problemasBoleto(ok, '2026-10-11'), ['vencimento já passou']);
igual('vencimento hoje passa', problemasBoleto(ok, '2026-10-10'), []);
igual('sem vencimento', problemasBoleto({ ...ok, vencimento: null }, '2026-10-06'), ['sem vencimento']);
igual('abaixo de R$ 2,50', problemasBoleto({ ...ok, valor: 2.49 }, '2026-10-06'), ['valor abaixo de R$ 2,50 (mínimo do Inter)']);
igual('R$ 2,50 passa', problemasBoleto({ ...ok, valor: 2.5 }, '2026-10-06'), []);

console.log('Arquivo de remessa:');
const longa = 'Honorários de setembro mais a alteração contratual de agosto, conforme combinado com o Diego na reunião do dia 20';
const arq = montarRemessa({
  empresa: 'Macedo e Reis Contabilidade', conta: '1234567', dv: '8', numero: 7, data: '2026-10-06',
  boletos: [
    { ...ok, controle: controleDe('0a1b2c3d-4e5f-6789-abcd-ef0123456789'), seuNumero: '610261', valor: 1234.5, mensagem: '' },
    { ...ok, nome: 'Fulano de Tal Prestação de Serviços com Nome Comprido', documento: '123.456.789-09', controle: controleDe('ffffffff-0000-1111-2222-333333333333'),
      seuNumero: '610262', vencimento: '2026-10-20', valor: 99.9, mensagem: longa },
  ],
});
const [h, d1, d2, t2, tr] = arq.linhas;
igual('nome do arquivo: CI400_001_ + número do arquivo com 7 dígitos', arq.nome, 'CI400_001_0000007.REM');
igual('linhas: header, 2 boletos, 1 tipo 2 (mensagem longa) e trailer', arq.linhas.length, 5);
chk('toda linha com 400 posições', arq.linhas.every(l => l.length === 400));
chk('CRLF no fim de cada linha, inclusive a última', arq.conteudo === arq.linhas.join('\r\n') + '\r\n');
chk('só ASCII', /^[\x20-\x7e\r\n]*$/.test(arq.conteudo));
igual('quantidade e total', [arq.qtd, arq.total], [2, 1334.4]);

console.log('Header (tipo 0):');
igual('1–2: 0 e 1', pos(h, 1, 2), '01');
igual('3–9: REMESSA', pos(h, 3, 9), 'REMESSA');
igual('10–11: 01', pos(h, 10, 11), '01');
igual('12–26: COBRANCA', pos(h, 12, 26), 'COBRANCA       ');
igual('27–46: brancos', pos(h, 27, 46), ' '.repeat(20));
igual('47–76: nome da empresa', pos(h, 47, 76), 'MACEDO E REIS CONTABILIDADE   ');
igual('77–79: 077', pos(h, 77, 79), '077');
igual('80–94: INTER', pos(h, 80, 94), 'INTER          ');
igual('95–100: data DDMMAA', pos(h, 95, 100), '061026');
igual('101–110: brancos', pos(h, 101, 110), ' '.repeat(10));
igual('111–117: número do arquivo (o mesmo do nome)', pos(h, 111, 117), '0000007');
igual('118–394: brancos', pos(h, 118, 394), ' '.repeat(277));
igual('395–400: sequencial 000001', pos(h, 395, 400), '000001');

console.log('Detalhe tipo 1 (CNPJ):');
igual('1: 1', pos(d1, 1, 1), '1');
igual('2–20: brancos', pos(d1, 2, 20), ' '.repeat(19));
igual('21–23: carteira 112', pos(d1, 21, 23), '112');
igual('24–27: agência 0001', pos(d1, 24, 27), '0001');
igual('28–36: conta com zeros à esquerda', pos(d1, 28, 36), '001234567');
igual('37: dígito da conta', pos(d1, 37, 37), '8');
igual('38–62: número de controle', pos(d1, 38, 62), '0A1B2C3D4E5F6789ABCDEF012');
igual('63–65: brancos', pos(d1, 63, 65), '   ');
igual('66–89: sem multa (0, zeros, data zerada)', pos(d1, 66, 89), '0' + '0'.repeat(23));
igual('90–100: nosso número zerado (carteira 112)', pos(d1, 90, 100), '0'.repeat(11));
igual('101–108: brancos', pos(d1, 101, 108), ' '.repeat(8));
igual('109–110: ocorrência 01 (remessa)', pos(d1, 109, 110), '01');
igual('111–120: seu número', pos(d1, 111, 120), '610261    ');
igual('121–126: vencimento DDMMAA', pos(d1, 121, 126), '101026');
igual('127–139: valor em centavos', pos(d1, 127, 139), '0000000123450');
igual('140–141: dias de pagamento depois do vencimento', pos(d1, 140, 141), '21');
igual('142–147: brancos', pos(d1, 142, 147), ' '.repeat(6));
igual('148–150: espécie 01 e N', pos(d1, 148, 150), '01N');
igual('151–159: data de emissão em branco e brancos', pos(d1, 151, 159), ' '.repeat(9));
igual('160–183: sem juros', pos(d1, 160, 183), '0'.repeat(24));
igual('184–207: sem desconto', pos(d1, 184, 207), '0'.repeat(24));
igual('208–220: zeros', pos(d1, 208, 220), '0'.repeat(13));
igual('221–222: 02 = CNPJ', pos(d1, 221, 222), '02');
igual('223–236: CNPJ', pos(d1, 223, 236), '11222333000181');
igual('237–276: nome do pagador', pos(d1, 237, 276), 'EMPRESA EXEMPLO LTDA'.padEnd(40));
igual('277–314: endereço', pos(d1, 277, 314), 'RUA EXEMPLO 10 - CENTRO'.padEnd(38));
igual('315–316: UF', pos(d1, 315, 316), 'RS');
igual('317–324: CEP', pos(d1, 317, 324), '95660000');
igual('325–394: sem mensagem', pos(d1, 325, 394), ' '.repeat(70));
igual('395–400: sequencial 000002', pos(d1, 395, 400), '000002');

console.log('Detalhe tipo 1 (CPF, mensagem longa) e tipo 2:');
igual('221–222: 01 = CPF', pos(d2, 221, 222), '01');
igual('223–236: CPF com zeros à esquerda', pos(d2, 223, 236), '00012345678909');
igual('237–276: nome cortado em 40', pos(d2, 237, 276), 'FULANO DE TAL PRESTACAO DE SERVICOS COM ');
igual('140–141: vencimento 20/10 → 11 dias', pos(d2, 140, 141), '11');
igual('127–139: R$ 99,90', pos(d2, 127, 139), '0000000009990');
const msg = textoCnab(longa);
igual('325–394: começo da mensagem', pos(d2, 325, 394), msg.slice(0, 70));
igual('tipo 2 — 1: 2', pos(t2, 1, 1), '2');
igual('tipo 2 — 2–79: resto da mensagem', pos(t2, 2, 79), msg.slice(70).trim().padEnd(78));
igual('tipo 2 — 80–313: mensagens 3 a 5 em branco', pos(t2, 80, 313), ' '.repeat(234));
igual('tipo 2 — 314–394: descontos 2 e 3 zerados e nosso número zerado', pos(t2, 314, 394), '0'.repeat(23) + ' '.repeat(10) + '0'.repeat(23) + ' '.repeat(10) + '0'.repeat(11) + ' '.repeat(4));
igual('tipo 2 — sequencial 000004', pos(t2, 395, 400), '000004');

console.log('Trailer (tipo 9):');
igual('1: 9', pos(tr, 1, 1), '9');
igual('2–7: quantidade de boletos (sem contar o tipo 2)', pos(tr, 2, 7), '000002');
igual('8–394: brancos', pos(tr, 8, 394), ' '.repeat(387));
igual('395–400: sequencial 000005', pos(tr, 395, 400), '000005');

console.log('Nada de arquivo pela metade:');
const base = { empresa: 'X', conta: '1234567', dv: '8', numero: 1, data: '2026-10-06', boletos: [{ ...ok, controle: 'A1', seuNumero: '1' }] };
chk('arquivo válido de 1 boleto', erro(() => montarRemessa(base)) === '');
chk('conta com letra', erro(() => montarRemessa({ ...base, conta: '12A' })).includes('Conta corrente'));
chk('conta com 10 dígitos', erro(() => montarRemessa({ ...base, conta: '1234567890' })).includes('Conta corrente'));
chk('sem dígito', erro(() => montarRemessa({ ...base, dv: '' })).includes('Dígito'));
chk('número do arquivo zero', erro(() => montarRemessa({ ...base, numero: 0 })).includes('Número do arquivo'));
chk('sem boletos', erro(() => montarRemessa({ ...base, boletos: [] })).includes('Nenhum boleto'));
chk('boleto sem CEP barra o arquivo e diz qual', erro(() => montarRemessa({ ...base, boletos: [{ ...ok, cep: '', controle: 'A1', seuNumero: '1' }] })) === 'EMPRESA EXEMPLO LTDA: CEP faltando ou incompleto no cadastro');
chk('controle repetido', erro(() => montarRemessa({ ...base, boletos: [{ ...ok, controle: 'A1', seuNumero: '1' }, { ...ok, controle: 'A1', seuNumero: '2' }] })).includes('repetido'));
chk('sem seu número', erro(() => montarRemessa({ ...base, boletos: [{ ...ok, controle: 'A1', seuNumero: '' }] })).includes('seu número'));

console.log('Arquivo de retorno:');
const L400 = campos => { const l = Array(400).fill(' '); for (const [a, b, s] of campos) { if (s.length !== b - a + 1) throw new Error(`${a}-${b}`); l.splice(a - 1, s.length, ...s); } return l.join(''); };
const retH = L400([[1, 19, '02RETORNO01COBRANCA'], [77, 94, '077INTER'.padEnd(18)], [95, 100, '071026'], [395, 400, '000001']]);
const titulo = (seq, ctl, nn, oc, extra = []) => L400([[1, 1, '1'], [38, 62, ctl.padEnd(25)], [71, 81, nn], [87, 89, '112'], [90, 91, oc], [92, 97, '071026'],
  [98, 107, '710261'.padEnd(10)], [108, 118, nn], [119, 124, '091026'], [125, 137, '0000000067816'], [182, 221, 'PAGADOR DE TESTE LTDA'.padEnd(40)],
  [227, 240, '22333444000190'], [381, 394, '0123456'.padEnd(14)], [395, 400, String(seq).padStart(6, '0')], ...extra]);
const ret = lerRetorno([retH, titulo(2, 'ABC', '12345678903', '02'),
  titulo(3, 'DEF', '12345678911', '06', [[160, 172, '0000000067816'], [173, 178, '081026']]),
  titulo(4, 'GHI', '00000000000', '03', [[241, 380, 'CEP INVALIDO'.padEnd(140)]]), L400([[1, 1, '9'], [395, 400, '000005']])].join('\n') + '\n');
igual('data do arquivo e quantidade', [ret.data, ret.titulos.length], ['2026-10-07', 3]);
const [r1, r2, r3] = ret.titulos;
igual('registrado: controle, nosso número, operação, situação', [r1.controle, r1.nossoNumero, r1.operacao, r1.situacao], ['ABC', '12345678903', '0123456', 'registrado']);
igual('vencimento, valor, seu número e data do registro', [r1.vencimento, r1.valor, r1.seuNumero, r1.dataOcorrencia], ['2026-10-09', 678.16, '710261', '2026-10-07']);
igual('pago: valor pago e data do crédito', [r2.situacao, r2.valorPago, r2.dataCredito], ['pago', 678.16, '2026-10-08']);
igual('erro com o motivo', [r3.situacao, r3.motivo], ['erro', 'CEP INVALIDO']);
igual('pagador e CNPJ', [r1.pagador, r1.documento], ['PAGADOR DE TESTE LTDA', '22333444000190']);
// V9: vencimento/valor alterados no site do Inter (14, 15, 16) seguem em aberto, com a data e o valor novos
const alt = lerRetorno([retH, titulo(2, 'JKL', '12345678938', '14', [[119, 124, '201026']]),
  titulo(3, 'MNO', '12345678946', '16', [[119, 124, '231026'], [125, 137, '0000000070000']])].join('\n'));
igual('vencimento alterado (14): situação e a data nova', [alt.titulos[0].situacao, alt.titulos[0].vencimento], ['vencimento alterado', '2026-10-20']);
igual('vencimento e valor alterados (16): data e valor novos', [alt.titulos[1].situacao, alt.titulos[1].vencimento, alt.titulos[1].valor], ['vencimento e valor alterados', '2026-10-23', 700]);
igual('em aberto: 02, 14, 15 e 16; pago, erro e cancelado não', ['02', '14', '15', '16', '03', '06', '07'].map(emAberto), [true, true, true, true, false, false, false]);
chk('linha com CRLF também lê', lerRetorno([retH, titulo(2, 'ABC', '12345678903', '02')].join('\r\n')).titulos[0].nossoNumero === '12345678903');
chk('arquivo que não é retorno do Inter é recusado', erro(() => lerRetorno('QUALQUER COISA\n')).includes('Não é um arquivo de retorno'));
chk('arquivo vazio é recusado', erro(() => lerRetorno('')).includes('vazio'));

console.log('Código de barras e linha digitável (manual V9, seção 8):');
igual('fator: 22/02/2025 reinicia em 1000', fatorVencimento('2025-02-22'), 1000);
igual('fator: 21/02/2025 era 9999', fatorVencimento('2025-02-21'), 9999);
igual('fator: 03/07/2000 era 1000', fatorVencimento('2000-07-03'), 1000);
igual('fator: 09/10/2026', fatorVencimento('2026-10-09'), 1594);
igual('módulo 10 (exemplo do manual, 999977721)', mod10('999977721'), 3);
igual('módulo 11: soma 2 → 11 − 2 = 9', mod11('0'.repeat(42) + '1'), 9);
igual('módulo 11: resto 10 vira 1 (regra do manual)', mod11('0'.repeat(42) + '5'), 1);
igual('módulo 11: resto 0 vira 1', mod11('0'.repeat(43)), 1);
igual('operação: 7 dígitos com espaço à direita', operacao7('0201390       '), '0201390');
igual('operação: zeros à esquerda nos 14', operacao7('00000000201390'), '0201390');
igual('operação com mais de 7 dígitos que contam é recusada', operacao7('12345678'), null);
const cb = codigoBarras({ operacao: '0123456', nossoNumero: '12345678903', vencimento: '2026-10-09', valor: 678.16 });
// conta feita à parte, por outro caminho: DV geral pelo módulo 11 e DVs dos campos pelo módulo 10
const dvGeral = (() => { const s = cb.barras.slice(0, 4) + cb.barras.slice(5); let t = 0; [...s].reverse().forEach((ch, i) => { t += Number(ch) * (2 + (i % 8)); }); const r = t % 11; return (r === 0 || r === 1 || r === 10) ? 1 : 11 - r; })();
const dv10 = s => { let t = 0; [...s].reverse().forEach((ch, i) => { const p = Number(ch) * (i % 2 ? 1 : 2); t += Math.floor(p / 10) + (p % 10); }); return (10 - (t % 10)) % 10; };
igual('44 dígitos: banco, moeda, fator, valor e campo livre (agência, carteira 112, operação, nosso número)', [cb.barras.length, cb.barras.slice(0, 4), cb.barras.slice(5, 9), cb.barras.slice(9, 19), cb.barras.slice(19)],
  [44, '0779', '1594', '0000067816', '0001' + '112' + '0123456' + '12345678903']);
igual('DV geral confere com a conta à parte', Number(cb.barras[4]), dvGeral);
const ld = cb.linha.replace(/[ .]/g, '');
igual('linha digitável: 47 dígitos no formato do boleto', [ld.length, /^\d{5}\.\d{5} \d{5}\.\d{6} \d{5}\.\d{6} \d \d{14}$/.test(cb.linha)], [47, true]);
igual('DVs dos três campos conferem', [Number(ld[9]), Number(ld[20]), Number(ld[31])], [dv10(ld.slice(0, 9)), dv10(ld.slice(10, 20)), dv10(ld.slice(21, 31))]);
igual('campo 4 = DV geral; campo 5 = fator + valor', [ld[32], ld.slice(33)], [cb.barras[4], '15940000067816']);
igual('linha digitável e código de barras falam a mesma coisa', ld.slice(0, 4) + ld.slice(32, 33) + ld.slice(33) + ld.slice(4, 9) + ld.slice(10, 20) + ld.slice(21, 31), cb.barras);
chk('sem número da operação, não monta', erro(() => codigoBarras({ operacao: '', nossoNumero: '12345678903', vencimento: '2026-10-09', valor: 1 })).includes('operação'));
chk('nosso número incompleto, não monta', erro(() => codigoBarras({ operacao: '0123456', nossoNumero: '123', vencimento: '2026-10-09', valor: 1 })).includes('nosso número'));
igual('nosso número como o Inter imprime', nossoNumeroImpresso('12345678903'), '00019/112/1234567890-3');

console.log('PDF do boleto:');
const el = larguras2de5(cb.barras);
igual('Intercalado 2 de 5: 405 unidades de barra fina (103 mm com 0,254 mm)', [el.reduce((a, b) => a + b, 0), (el.reduce((a, b) => a + b, 0) * 0.254).toFixed(1)], [405, '102.9']);
igual('início (4 finos) e fim (largo, fino, fino)', [el.slice(0, 4), el.slice(-3)], [[1, 1, 1, 1], [3, 1, 1]]);
igual('par "00": barras e espaços intercalados', larguras2de5('00').slice(4, 14), [1, 1, 1, 1, 3, 3, 3, 3, 1, 1]);
chk('quantidade ímpar de dígitos é recusada', erro(() => larguras2de5('123')) !== '');
igual('nome do arquivo sem caractere proibido', nomeArquivoBoleto('A/B: C*D LTDA', '2026-10-30'), 'A B C D LTDA - 30-10-2026.pdf');

console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
