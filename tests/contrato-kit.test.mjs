// O contrato do kit de boas-vindas (clientes/editar.html) cita as normas em vigor (24/11/2026, pedido do Samuel:
// "atualize as citações"). Até ali ele citava normas revogadas:
// - o preâmbulo, a Resolução CFC 987/2003, revogada pela Resolução CFC 1.590/2020 (art. 14), em vigor desde 01/07/2020;
// - os itens 1.1 e 1.3, a ITG 1000, revogada pela NBC TG 1002 (Contabilidade para Microentidades, de 18/11/2021), que
//   vale, com a NBC TG 1001 (Contabilidade para Pequenas Empresas), pros exercícios iniciados desde 01/01/2023;
// - a 7.11, o Código de Ética da Resolução CFC 803/1996 (com a 1.307/2010), que deu lugar à NBC PG 01, o Código de
//   Ética Profissional do Contador (aprovada em 07/02/2019, DOU de 14/02/2019, em vigor desde 01/06/2019);
// - a 13.1, uma "Resolução n. 806/96 do CFC" que não se achou (provavelmente a 803/96, cujo art. 6º tratava do valor
//   dos serviços por contrato escrito): hoje, a Resolução CFC 1.590/2020 e a NBC PG 01.
// Este teste confere que as de hoje estão lá e que nenhuma das revogadas volta.
// Rodar com: node tests/contrato-kit.test.mjs
import { readFileSync } from 'node:fs';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); };
const pagina = readFileSync(new URL('../clientes/editar.html', import.meta.url), 'utf8');

// só o texto do contrato: do título dele até o título da carta de responsabilidade, o documento seguinte do kit
const ini = pagina.indexOf("kitTitulo(ctx, 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS CONTÁBEIS')");
const fim = pagina.indexOf("kitTitulo(ctx, 'CARTA DE RESPONSABILIDADE DA ADMINISTRAÇÃO')", ini);
const contrato = ini >= 0 && fim > ini ? pagina.slice(ini, fim) : '';

console.log('O contrato do kit cita as normas em vigor');
chk('achou o texto do contrato', contrato.length > 5000, contrato.length);
chk('o preâmbulo: a Resolução CFC 1.590/2020, com a data e o DOU', contrato.includes('em atendimento à Resolução CFC nº 1.590, de 19/03/2020 (DOU, 26/03/2020), ajustam e contratam'));
chk('o 1.1: a NBC TG 1002 ou a NBC TG 1001, pelo porte', contrato.includes("'1.1 Classificação da contabilidade de acordo com normas e princípios contábeis vigentes na NBC TG 1002 (Contabilidade para Microentidades) ou na NBC TG 1001 (Contabilidade para Pequenas Empresas), conforme o porte da CONTRATANTE.'"));
chk('o 1.3: as mesmas normas', contrato.includes("'1.3 Elaboração de Balanço anual e demais Demonstrações Contábeis obrigatórias, conforme a NBC TG 1002 ou a NBC TG 1001.'"));
chk('a 7.11: a NBC PG 01, o Código de Ética Profissional do Contador', contrato.includes('às normas do Código de Ética Profissional do Contador, a NBC PG 01, aprovada pelo Conselho Federal de Contabilidade em 07/02/2019 (DOU, 14/02/2019).'));
chk('a 13.1: a Resolução CFC 1.590/2020 e a NBC PG 01', contrato.includes('tabela referencial de honorários do SESCON/RS, em consonância com a Resolução CFC nº 1.590/2020 e a NBC PG 01.'));

console.log('Nenhuma norma revogada volta ao contrato');
const REVOGADAS = [
  [/987(\/2003| CFC|, de 11\/12\/2003)/, 'a Resolução CFC 987/2003'],
  [/ITG 1000/, 'a ITG 1000'],
  [/803\/96|803\/1996/, 'a Resolução CFC 803/1996 (o código de ética antigo)'],
  [/1\.307\/10|1\.307\/2010/, 'a Resolução CFC 1.307/2010'],
  [/806\/96|806\/1996/, 'a "Resolução 806/96"'],
  [/Código de Ética do Contabilista/, 'o nome antigo do código de ética']
];
for (const [re, nome] of REVOGADAS) chk('sem ' + nome, !re.test(contrato), (contrato.match(re) || [])[0]);

console.log(falhas ? `\n${falhas} falha(s).` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
