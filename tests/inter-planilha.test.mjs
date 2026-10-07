// Planilha de boletos do Inter com Pix (assets/js/inter-planilha.js) contra o modelo oficial do Inter guardado em
// assets/inter/: confere as colunas do modelo, o formato de cada célula (igual ao exemplo da linha 4 do próprio Inter),
// os estilos preservados, as strings compartilhadas, o que barra um boleto e a montagem com um JSZip de mentira.
// O .xlsx de verdade (com o JSZip da página) é conferido no teste de tela tests/harness/boletos-inter.py.
// Dados inventados. Rodar com: node tests/inter-planilha.test.mjs
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import {
  MODELO, FOLHA, STRINGS, INSTRUCOES, LIGACOES, COLUNAS, semHyperlinks, dataPlanilha, cepPlanilha, nomePlanilha, problemasPlanilha, linhaPlanilha,
  lerStrings, contarRefs, conferirModelo, preencherFolha, montarPlanilha,
} from '../assets/js/inter-planilha.js';
import { diasPagamento } from '../assets/js/cnab-inter.js';

let falhas = 0;
const chk = (nome, cond) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome); };
const igual = (nome, a, b) => { const ok = JSON.stringify(a) === JSON.stringify(b); chk(`${nome} (${JSON.stringify(a)})`, ok); if (!ok) console.log('      esperado:', JSON.stringify(b)); };
const erro = f => { try { f(); return ''; } catch (e) { return e.message; } };
const erroAsync = async f => { try { await f(); return ''; } catch (e) { return e.message; } };

// leitor de .zip só pro teste (o xlsx é um zip): diretório central + inflate do node
function lerZip(buf) {
  let fim = buf.length - 22;
  while (fim >= 0 && buf.readUInt32LE(fim) !== 0x06054b50) fim--;
  const n = buf.readUInt16LE(fim + 10);
  let p = buf.readUInt32LE(fim + 16);
  const arqs = {};
  for (let i = 0; i < n; i++) {
    const metodo = buf.readUInt16LE(p + 10), tam = buf.readUInt32LE(p + 20);
    const ln = buf.readUInt16LE(p + 28), le = buf.readUInt16LE(p + 30), lc = buf.readUInt16LE(p + 32), off = buf.readUInt32LE(p + 42);
    const nome = buf.toString('utf8', p + 46, p + 46 + ln);
    const ini = off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28);
    const bruto = buf.subarray(ini, ini + tam);
    arqs[nome] = (metodo === 8 ? inflateRawSync(bruto) : bruto).toString('utf8');
    p += 46 + ln + le + lc;
  }
  return arqs;
}
const modelo = readFileSync(new URL('../' + MODELO, import.meta.url));
const zip = lerZip(modelo);
const folha = zip[FOLHA], strings = zip[STRINGS], instrucoes = zip[INSTRUCOES];

// leitura das linhas pra conferir: coluna → { s, t, v }
const linhaXml = (xml, r) => { const i = xml.indexOf(`<row r="${r}"`); return xml.slice(i, xml.indexOf('</row>', i) + 6); };
const cels = (xml, r) => {
  const out = {};
  for (const m of linhaXml(xml, r).matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    out[m[1]] = { s: (/\bs="(\d+)"/.exec(m[2]) || [])[1], t: (/\bt="(\w+)"/.exec(m[2]) || [])[1], v: (/<v>([\s\S]*?)<\/v>/.exec(m[3] || '') || [])[1] };
  }
  return out;
};
const valor = (c, lista) => (!c || c.v == null) ? null : c.t === 's' ? lista[Number(c.v)] : Number(c.v);

console.log('Modelo do Inter:');
chk('é a aba "Cobrança Simples" com as colunas do manual', erro(() => conferirModelo(folha, strings)) === '');
const listaModelo = lerStrings(strings);
igual('strings compartilhadas: quantidade bate com o uniqueCount', listaModelo.length, Number(/uniqueCount="(\d+)"/.exec(strings)[1]));
igual('contagem de referências bate com o count do modelo', contarRefs(folha) + contarRefs(instrucoes), Number(/ count="(\d+)"/.exec(strings)[1]));
igual('linha 4 é o exemplo do Inter', [valor(cels(folha, 4).A, listaModelo), valor(cels(folha, 4).T, listaModelo), valor(cels(folha, 4).K, listaModelo)], ['Cliente Inter Nome', 1012025, '30190-131']);
const trocado = strings.replace('1. Boleto com PIX? (Obrigatório)', '1. Boleto? (Obrigatório)');
chk('modelo com coluna trocada é recusado e diz qual', erro(() => conferirModelo(folha, trocado)).includes('mudou (coluna O'));

console.log('Formatos:');
igual('vencimento DDMMAAAA como número', [dataPlanilha('2026-10-20'), dataPlanilha('2026-01-05')], [20102026, 5012026]);
igual('CEP com hífen, como no exemplo', cepPlanilha('95660000'), '95660-000');
igual('nome do arquivo', nomePlanilha(3), 'EXCEL_BOLETOS_0000000003.xlsx');

const ok = {
  nome: 'Empresa Exemplo & Filhos Ltda', documento: '22.333.444/0001-90', logradouro: 'Rua de Teste', numero: '1219',
  complemento: 'Sala <2>', bairro: 'Centro', cidade: 'Três Coroas', uf: 'rs', cep: '95660-000', vencimento: '2026-10-20',
  valor: 678.155, mensagem: 'EMISSÃO NF (2) = 80,00', codigo: '710262',
};
console.log('O que barra um boleto:');
igual('pronto', problemasPlanilha(ok, '2026-10-07'), []);
igual('sem bairro e sem cidade (obrigatórios na planilha)', problemasPlanilha({ ...ok, bairro: ' ', cidade: '' }), ['sem bairro no cadastro', 'sem cidade no cadastro']);
chk('CNPJ com letras', problemasPlanilha({ ...ok, documento: '12.ABC.345/01DE-35' })[0].startsWith('CNPJ com letras'));
chk('CNPJ começando com 000 (o número cabe na máscara de CPF)', problemasPlanilha({ ...ok, documento: '00.012.345/0001-00' })[0].startsWith('CNPJ começando com 000'));
igual('CNPJ com um zero só na frente passa', problemasPlanilha({ ...ok, documento: '07.123.456/0002-10' }), []);
igual('CPF/CNPJ incompleto, CEP e UF', problemasPlanilha({ ...ok, documento: '123', cep: '9566000', uf: 'XX' }),
  ['CPF/CNPJ faltando ou incompleto no cadastro', 'CEP faltando ou incompleto no cadastro', 'UF faltando no cadastro']);
igual('vencimento passado e valor abaixo do mínimo', problemasPlanilha({ ...ok, vencimento: '2026-10-06', valor: 2.49 }, '2026-10-07'),
  ['vencimento já passou', 'valor abaixo de R$ 2,50 (mínimo do Inter)']);
chk('observação acima de 78 letras', problemasPlanilha({ ...ok, mensagem: 'X'.repeat(79) })[0].includes('78 letras'));

console.log('Uma cobrança numa linha (formato do exemplo da linha 4):');
const l = linhaPlanilha(ok);
igual('nome, CNPJ como número, endereço e número como número', [l.A, l.B, l.E, l.F], ['Empresa Exemplo & Filhos Ltda', 22333444000190, 'Rua de Teste', 1219]);
igual('complemento, bairro, cidade, UF e CEP', [l.G, l.H, l.I, l.J, l.K], ['Sala <2>', 'Centro', 'Três Coroas', 'RS', '95660-000']);
igual('sem beneficiário final, boleto com Pix, forma "Boleto"', [l.L, l.O, l.P], ['Não', 'Sim', 'Boleto']);
igual('valor em centavos, código, descrição e vencimento', [l.Q, l.R, l.S, l.T], [678.16, '710262', 'EMISSÃO NF (2) = 80,00', 20102026]);
igual('paga depois do vencimento até o fim do mês; sem multa, juros e desconto; sem nota fiscal',
  [l.U, l.V, l.W, l.X, l.Y, l.Z, l.AA, l.AB, l.AC, l.AD], ['Sim', diasPagamento('2026-10-20'), 'Não aplicar multa', 0, 'Não aplicar juros', 0, 'Não aplicar desconto', 0, 0, 'Não']);
igual('sem e-mail, telefone e beneficiário final', [l.C, l.D, l.M, l.N], [undefined, undefined, undefined, undefined]);
igual('número com letra vai como texto; sem número vira S/N; complemento vazio fica vazio',
  [linhaPlanilha({ ...ok, numero: '35 A' }).F, linhaPlanilha({ ...ok, numero: '' }).F, linhaPlanilha({ ...ok, complemento: '' }).G], ['35 A', 'S/N', null]);
igual('CPF com zero à esquerda vira número (a máscara do modelo mostra o zero)', linhaPlanilha({ ...ok, documento: '012.345.678-90' }).B, 1234567890);

console.log('Preenchendo a aba (linhas 4 e 5):');
const l2 = linhaPlanilha({ ...ok, nome: 'Comércio Modelo Ltda', documento: '33.444.555/0001-00', numero: 'S/N', complemento: '', mensagem: '', codigo: '710263', valor: 300 });
const r = preencherFolha(folha, strings, [l, l2], contarRefs(instrucoes));
const lista = lerStrings(r.strings);
const c4 = cels(r.folha, 4), c5 = cels(r.folha, 5), m4 = cels(folha, 4), m5 = cels(folha, 5);
igual('linha 4 (sobre o exemplo): nome, CNPJ, número, CEP, Pix, valor, vencimento',
  ['A', 'B', 'F', 'K', 'O', 'Q', 'T'].map(c => valor(c4[c], lista)), ['Empresa Exemplo & Filhos Ltda', 22333444000190, 1219, '95660-000', 'Sim', 678.16, 20102026]);
igual('o exemplo do Inter some da linha 4 (nota fiscal e e-mail vazios)', ['C', 'D', 'AE', 'AF', 'AG', 'AH', 'AI', 'AJ'].map(c => valor(c4[c], lista)), [null, null, null, null, null, null, null, null]);
igual('linha 5: nome, S/N como texto, sem complemento nem descrição', ['A', 'F', 'G', 'S', 'R'].map(c => valor(c5[c], lista)), ['Comércio Modelo Ltda', 'S/N', null, null, '710263']);
chk('estilos das células iguais aos do modelo (linha 4)', COLUNAS.every(c => !m4[c] || (c4[c] && c4[c].s === m4[c].s)));
chk('estilos das células iguais aos do modelo (linha 5)', COLUNAS.every(c => !m5[c] || (c5[c] && c5[c].s === m5[c].s)));
chk('números como número e textos como texto compartilhado', c4.B.t === undefined && c4.T.t === undefined && c4.K.t === 's' && c4.A.t === 's');
chk('colunas depois da AJ ficam como estavam', ['AK', 'AL', 'AQ'].every(c => JSON.stringify(c5[c]) === JSON.stringify(m5[c])));
const daLinha6 = x => x.slice(x.indexOf('<row r="6"'), x.indexOf('</sheetData>'));
igual('linha 6 em diante intacta', linhaXml(r.folha, 6) === linhaXml(folha, 6) && daLinha6(r.folha) === daLinha6(folha), true);
chk('sai o e-mail de exemplo do Inter como hyperlink (C4 e C5)', folha.includes('<hyperlink ref="C4"') && folha.includes('<hyperlink ref="C5"') && !r.folha.includes('<hyperlink'));
const lig = semHyperlinks(zip[LIGACOES]);
chk('ligações da aba: saem os 2 hyperlinks, fica a tabela', (zip[LIGACOES].match(/relationships\/hyperlink"/g) || []).length === 2 && !lig.includes('hyperlink') && lig.includes('relationships/table'));
igual('total de linhas do modelo igual', (r.folha.match(/<row /g) || []).length, (folha.match(/<row /g) || []).length);
igual('reaproveita os textos do modelo (Sim, Não, Boleto, Não aplicar multa)', [c4.O.v, c4.L.v, c4.P.v, c4.W.v].map(Number),
  ['Sim', 'Não', 'Boleto', 'Não aplicar multa'].map(t => listaModelo.indexOf(t)));
igual('strings novas no fim, contadas no uniqueCount e no count',
  [lista.length, Number(/uniqueCount="(\d+)"/.exec(r.strings)[1]), Number(/ count="(\d+)"/.exec(r.strings)[1])],
  [listaModelo.length + r.novas, listaModelo.length + r.novas, contarRefs(r.folha) + contarRefs(instrucoes)]);
chk('& e < viram entidade no XML e voltam certos', r.strings.includes('Empresa Exemplo &amp; Filhos Ltda') && r.strings.includes('Sala &lt;2&gt;') && valor(c4.G, lista) === 'Sala <2>');
chk('a aba abre no começo (A1)', /<sheetView [^>]*topLeftCell="A1"/.test(r.folha) && r.folha.includes('<selection activeCell="A4" sqref="A4"/>'));
chk('mais de 1003 boletos não cabe no modelo', erro(() => preencherFolha(folha, strings, Array(1004).fill(l))).includes('cabe até 1003'));

console.log('Montagem (JSZip de mentira):');
let opcoesLoad = null, gravouSemPasta = true;
const JSZipFalso = {
  loadAsync: async (_, o) => {
    opcoesLoad = o;
    const arqs = { ...zip };
    return {
      file(n, conteudo, o) { if (conteudo !== undefined) { arqs[n] = conteudo; gravouSemPasta = gravouSemPasta && !!o && o.createFolders === false; return this; } return n in arqs ? { async: async () => arqs[n] } : null; },
      generateAsync: async o => ({ arqs, o }),
    };
  },
};
const boletos = [ok, { ...ok, nome: 'Comércio Modelo Ltda', codigo: '710263', valor: 300 }];
const m = await montarPlanilha(JSZipFalso, modelo, { numero: 2, boletos });
igual('nome, quantidade e total', [m.nome, m.qtd, m.total], ['EXCEL_BOLETOS_0000000002.xlsx', 2, 978.16]);
chk('gera o .xlsx compactado, com o tipo de planilha', m.dados.o.type === 'uint8array' && m.dados.o.compression === 'DEFLATE' && m.dados.o.mimeType.includes('spreadsheetml'));
chk('abre e grava sem criar entradas de pasta (o .xlsx sai só com as partes do modelo)', opcoesLoad && opcoesLoad.createFolders === false && gravouSemPasta);
chk('as duas linhas foram pra aba', valor(cels(m.dados.arqs[FOLHA], 5).A, lerStrings(m.dados.arqs[STRINGS])) === 'Comércio Modelo Ltda');
chk('grava as ligações da aba sem os hyperlinks', !m.dados.arqs[LIGACOES].includes('hyperlink') && m.dados.arqs[LIGACOES].includes('table'));
chk('boleto com pendência barra a planilha e diz qual', (await erroAsync(() => montarPlanilha(JSZipFalso, modelo, { numero: 2, boletos: [{ ...ok, cep: '' }] }))).includes('Empresa Exemplo & Filhos Ltda: CEP'));
chk('código repetido barra', (await erroAsync(() => montarPlanilha(JSZipFalso, modelo, { numero: 2, boletos: [ok, ok] }))).includes('repetido'));
chk('sem boletos', (await erroAsync(() => montarPlanilha(JSZipFalso, modelo, { numero: 2, boletos: [] }))).includes('Nenhum boleto'));
chk('número da planilha inválido', (await erroAsync(() => montarPlanilha(JSZipFalso, modelo, { numero: 0, boletos }))).includes('Número da planilha'));

console.log(falhas ? `\n${falhas} falha(s).` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
