// CNPJ alfanumérico (IN RFB 2.229/2024; os primeiros saíram em julho/2026): validação, máscara e normalização.
// Rodar com: node tests/cnpj-alfanumerico.test.mjs — o exemplo oficial da Receita é 12.ABC.345/01DE-35.
import { normalizarDocumento, ehCnpj, cnpjValido, formatCNPJ, formatDocumento, maskCNPJ } from '../assets/js/utils.js';
import { mascararDoc } from '../assets/js/operacao-xml.js';
import { cnpjsParaConsultar } from '../assets/js/dominio-relatorios.js';

let falhas = 0;
const chk = (nome, cond) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome); };
const igual = (nome, obtido, esperado) => chk(nome + ' (' + JSON.stringify(obtido) + ')', obtido === esperado);

console.log('Validação (dígitos verificadores):');
chk('exemplo da Receita 12.ABC.345/01DE-35 é válido', cnpjValido('12.ABC.345/01DE-35'));
chk('minúsculo também (vira maiúsculo)', cnpjValido('12abc34501de35'));
chk('DV errado não passa', !cnpjValido('12ABC34501DE36'));
chk('letra no DV não passa', !cnpjValido('12ABC34501DE3A'));
chk('CNPJ numérico válido continua válido (11.222.333/0001-81)', cnpjValido('11.222.333/0001-81'));
chk('CNPJ numérico com DV errado não passa', !cnpjValido('11.222.333/0001-82'));
chk('sequência repetida não passa', !cnpjValido('00000000000000'));
chk('CPF não é CNPJ', !cnpjValido('123.456.789-09') && !ehCnpj('123.456.789-09'));

console.log('Normalização (como vai pro banco):');
igual('CNPJ alfanumérico mantém as letras, em maiúsculo', normalizarDocumento('12.abc.345/01de-35'), '12ABC34501DE35');
igual('CNPJ numérico, só dígitos', normalizarDocumento('11.222.333/0001-81'), '11222333000181');
igual('CPF, só dígitos', normalizarDocumento('123.456.789-09'), '12345678909');
igual('texto com rótulo não vira CNPJ com letras', normalizarDocumento('CNPJ 11.222.333/0001-81'), '11222333000181');
igual('vazio', normalizarDocumento(null), '');

console.log('Formatação e máscara:');
igual('formatCNPJ alfanumérico', formatCNPJ('12ABC34501DE35'), '12.ABC.345/01DE-35');
igual('formatCNPJ numérico', formatCNPJ('11222333000181'), '11.222.333/0001-81');
igual('formatDocumento com CPF', formatDocumento('12345678909'), '123.456.789-09');
igual('formatDocumento com CNPJ alfanumérico', formatDocumento('12abc34501de35'), '12.ABC.345/01DE-35');
igual('máscara enquanto digita (minúsculo vira maiúsculo)', maskCNPJ('12abc34501de35'), '12.ABC.345/01DE-35');
igual('máscara ignora letra nos dígitos verificadores', maskCNPJ('12ABC34501DEX35'), '12.ABC.345/01DE-35');
igual('máscara parcial', maskCNPJ('12AB'), '12.AB');
igual('máscara numérica de sempre', maskCNPJ('11222333000181'), '11.222.333/0001-81');

console.log('Notas e relatórios:');
igual('máscara de privacidade das notas', mascararDoc('12ABC34501DE35'), '12.***.***/01DE-35');
const rels = [{ tipo: 'entradas', lancamentos: [
  { grupo: 'mercadoria', documento: '12ABC34501DE35', valor: 1000 },
  { grupo: 'mercadoria', documento: '11222333000181', valor: 500 },
  { grupo: 'mercadoria', documento: '12345678909', valor: 300 } ] }];
const { fornecedores } = cnpjsParaConsultar(rels, 20);
chk('fornecedor com CNPJ alfanumérico vai pra consulta de regime (CPF não)', fornecedores.join(',') === '12ABC34501DE35,11222333000181');

console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
