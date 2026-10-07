// Arquivo de boletos do Inter (assets/js/cnab-inter.js): posições do CNAB 400 pelo manual V2.2 do Inter, textos sem
// acento, regras do escritório (sem multa/juros, pagável até o fim do mês, seu número dia+mês+ano+nº) e o que barra
// um boleto. Dados inventados. Rodar com: node tests/cnab-inter.test.mjs
import {
  textoCnab, seuNumero, diasPagamento, pagavelAte, lerConta, enderecoCnab, problemasBoleto, montarRemessa, controleDe,
  isoValida,
} from '../assets/js/cnab-inter.js';

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

console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
