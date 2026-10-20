// A carta de reajuste dos honorários (assets/js/carta-reajuste.js), a que a Precificação › Carteira baixa no "Reajuste
// proposto" e no botão "Carta": a data e o mês por extenso, o dinheiro, o mês do vencimento do primeiro boleto (com a
// virada do ano), sem o honorário de hoje, sem a base de boletos, o MEI, e que nada de dentro do escritório (o motor, o
// piso, percentual, as respostas, as anotações, de onde veio o valor de hoje) entra na carta. Empresas inventadas.
// Rodar com: node tests/carta-reajuste.test.mjs
import { dataPorExtenso, mesPorExtenso, mesSeguinte, dinheiro, nomeDaEmpresa, linhaDoDocumento, nomeDoArquivo, textoDaCarta, desenharCarta,
  cartaEmPdf, MARGENS, ESCRITORIO } from '../assets/js/carta-reajuste.js';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + extra : '')); };
const igual = (nome, obtido, esperado) => chk(nome + ' (' + JSON.stringify(obtido) + ')', JSON.stringify(obtido) === JSON.stringify(esperado), 'esperado ' + JSON.stringify(esperado));
// o espaço que não quebra (entre o R$ e o número, no mês com o ano) vira espaço comum pra comparar
const plano = s => String(s).replace(/ /g, ' ');
const tudo = carta => plano([carta.titulo, carta.local, ...carta.destinatario, carta.saudacao, ...carta.paragrafos, carta.despedida, carta.assinatura].join('\n'));
const PADARIA = { nome_principal: 'PADARIA DO TESTE LTDA', documento: '10000000000191' };
const base = { cliente: PADARIA, atual: 300, novo: 640, vigencia: '2026-11', boleto: true, data: '2026-10-20' };

console.log('As datas e o dinheiro:');
igual('a data por extenso, com o mês em maiúscula e o dia sem zero', [dataPorExtenso('2026-10-20'), dataPorExtenso('2026-08-03'), dataPorExtenso('2027-01-01T10:00:00')],
  ['20 de Outubro de 2026', '3 de Agosto de 2026', '1 de Janeiro de 2027']);
igual('data que não é data: vazio', [dataPorExtenso(''), dataPorExtenso('2026-13-01'), dataPorExtenso(null)], ['', '', '']);
igual('o mês por extenso, minúsculo (no meio da frase)', [mesPorExtenso('2026-11'), mesPorExtenso('2027-03'), mesPorExtenso('2026-13'), mesPorExtenso('')], ['novembro de 2026', 'março de 2027', '', '']);
igual('o mês seguinte, com a virada do ano', [mesSeguinte('2026-11'), mesSeguinte('2026-12'), mesSeguinte('2027-01'), mesSeguinte('x')], ['2026-12', '2027-01', '2027-02', '']);
igual('o dinheiro: R$ 1.234,56 (o espaço não quebra)', [dinheiro(1234.5), dinheiro(640), dinheiro(1234567.891), dinheiro(0.5), dinheiro('99.999')],
  ['R$ 1.234,50', 'R$ 640,00', 'R$ 1.234.567,89', 'R$ 0,50', 'R$ 100,00']);
igual('o nome do MEI sem o CPF do fim e sem a raiz do CNPJ na frente', [nomeDaEmpresa({ nome_principal: 'FULANO DE TESTE 12345678901' }),
  nomeDaEmpresa({ nome_principal: '12.345.678 FULANO DE TESTE' }), nomeDaEmpresa(PADARIA), nomeDaEmpresa({ nome_principal: '  LOJA   TESTE  ' })],
  ['FULANO DE TESTE', 'FULANO DE TESTE', 'PADARIA DO TESTE LTDA', 'LOJA TESTE']);
igual('o documento: CNPJ, CNPJ com letras, CPF, nenhum', [linhaDoDocumento('10000000000191'), linhaDoDocumento('12.ABC.345/01DE-35'), linhaDoDocumento('12345678909'), linhaDoDocumento('')],
  ['CNPJ 10.000.000/0001-91', 'CNPJ 12.ABC.345/01DE-35', 'CPF 123.456.789-09', '']);
igual('o nome do arquivo, sem o que o Windows não aceita', [nomeDoArquivo(PADARIA), nomeDoArquivo({ nome_principal: 'A/B: "C"*D?<E>|F' }), nomeDoArquivo({ nome_principal: 'FULANO DE TESTE 12345678901' })],
  ['Carta de reajuste - PADARIA DO TESTE LTDA.pdf', 'Carta de reajuste - A B C D E F.pdf', 'Carta de reajuste - FULANO DE TESTE.pdf']);

console.log('\nO texto da carta:');
{
  const c = textoDaCarta(base), t = tudo(c);
  igual('o título, o local e a data, a saudação e quem assina', [c.titulo, c.local, c.saudacao, c.despedida, c.assinatura],
    ['REAJUSTE DOS HONORÁRIOS CONTÁBEIS', 'Três Coroas, 20 de Outubro de 2026.', 'Prezado cliente,', 'Atenciosamente,', 'Macedo & Reis Contabilidade']);
  igual('pra quem: o nome e o CNPJ (sem o "À", que pede o feminino)', c.destinatario, ['PADARIA DO TESTE LTDA', 'CNPJ 10.000.000/0001-91']);
  chk('o valor: de hoje para o novo, a partir da mensalidade, com o mês do vencimento — e os boletos de antes seguem com o atual',
    t.includes('Com esta revisão, os honorários mensais passam de R$ 300,00 para R$ 640,00 a partir da mensalidade de novembro de 2026, com vencimento em dezembro de 2026. Até lá, os boletos seguem com o valor atual.'), t);
  chk('o porquê: o trabalho de hoje e as obrigações novas da legislação', t.includes('Revisamos periodicamente os honorários de cada cliente, para que acompanhem o trabalho que fazemos hoje')
    && t.includes('trouxeram novas obrigações e mais verificações.'), t);
  chk('o contato do escritório pra conversar', t.includes('Se quiser conversar sobre o novo valor, estamos à disposição pelo telefone ' + ESCRITORIO.telefone + ' e pelo e-mail ' + ESCRITORIO.email + '.'), t);
  chk('o R$ não se separa do número, nem o mês do ano', c.paragrafos[2].includes('R$ 640,00') && c.paragrafos[2].includes('novembro de 2026'));
}
{
  const t = tudo(textoDaCarta({ ...base, vigencia: '2026-12' }));
  chk('a virada do ano: a mensalidade de dezembro de 2026 vence em janeiro de 2027', t.includes('a partir da mensalidade de dezembro de 2026, com vencimento em janeiro de 2027.'), t);
}
{
  const t = tudo(textoDaCarta({ ...base, atual: null }));
  chk('sem o honorário de hoje: diz só o novo', t.includes('os honorários mensais passam a ser de R$ 640,00 a partir da mensalidade de novembro de 2026, com vencimento em dezembro de 2026.')
    && !t.includes('passam de') && !t.includes('Até lá'), t);
  const t0 = tudo(textoDaCarta({ ...base, atual: 0 }));
  chk('o de hoje zerado conta como sem', t0.includes('passam a ser de R$ 640,00'), t0);
}
{
  const t = tudo(textoDaCarta({ ...base, boleto: false, cliente: { nome_principal: 'OFICINA DE TESTE LTDA', documento: '10000000000272' }, atual: 900, novo: 1234.5 }));
  chk('fora da base de boletos (o Conta Azul): nem boleto, nem vencimento', !/boleto|vencimento|vence/i.test(t) && t.includes('passam de R$ 900,00 para R$ 1.234,50 a partir da mensalidade de novembro de 2026.'), t);
}
{
  // baixada de novo depois que a mensalidade passou: os meses da proposta, sem o "Até lá"; no mês da mensalidade, com ele
  const depois = tudo(textoDaCarta({ ...base, data: '2027-03-15' })), noMes = tudo(textoDaCarta({ ...base, data: '2026-11-03' }));
  chk('a carta baixada de novo meses depois não promete "até lá"', depois.includes('Três Coroas, 15 de Março de 2027.') && depois.includes('a partir da mensalidade de novembro de 2026, com vencimento em dezembro de 2026.')
    && !depois.includes('Até lá'), depois);
  chk('no próprio mês da mensalidade, ainda vale o "até lá"', noMes.includes('Até lá, os boletos seguem com o valor atual.'), noMes);
}
{
  const mei = textoDaCarta({ ...base, cliente: { nome_principal: 'FULANO DE TESTE 12345678901', documento: '10000000000353', regime_tributario: 'MEI' }, atual: 100, novo: 120 });
  const t = tudo(mei);
  igual('o MEI: o nome sem o CPF e o CNPJ, sem "À" na frente do nome da pessoa', mei.destinatario, ['FULANO DE TESTE', 'CNPJ 10.000.000/0003-53']);
  chk('o MEI: o mesmo texto, com o valor do plano', t.includes('passam de R$ 100,00 para R$ 120,00') && !t.includes('12345678901'), t);
  const cpf = textoDaCarta({ ...base, cliente: { nome_principal: 'PRODUTOR DE TESTE', documento: '123.456.789-09', tipo_pessoa: 'PF' } });
  igual('pessoa física: o nome e o CPF', cpf.destinatario, ['PRODUTOR DE TESTE', 'CPF 123.456.789-09']);
  igual('sem documento: só o nome', textoDaCarta({ ...base, cliente: { nome_principal: 'SEM DOCUMENTO TESTE' } }).destinatario, ['SEM DOCUMENTO TESTE']);
  // serve pra empresa, MEI e pessoa física: nenhum "À", nenhum "a empresa", tudo no singular
  const textos = [base, { ...base, cliente: mei.destinatario && { nome_principal: 'FULANO DE TESTE 12345678901' } }, { ...base, cliente: { nome_principal: 'PRODUTOR DE TESTE', documento: '12345678909' } },
    { ...base, atual: null, boleto: false }, { ...base, atual: 600, novo: 520 }].map(d => tudo(textoDaCarta(d)));
  const ruins = textos.filter(x => /(^|\n)À\b/.test(x) || /\bempresa\b/i.test(x) || /Prezados|quiserem|vocês/.test(x));
  chk('o mesmo texto serve pra empresa, MEI e pessoa física (sem "À", sem "a empresa", no singular)', ruins.length === 0, ruins[0]);
}
{
  const t = tudo(textoDaCarta({ ...base, atual: 600, novo: 520 }));
  chk('valor menor que o de hoje: sem a frase das obrigações novas', t.includes('passam de R$ 600,00 para R$ 520,00') && !t.includes('novas obrigações'), t);
  const ti = tudo(textoDaCarta({ ...base, atual: 640 }));
  chk('o mesmo valor de hoje não vira "de R$ 640,00 para R$ 640,00"', ti.includes('passam a ser de R$ 640,00') && !ti.includes('Até lá'), ti);
}
{
  // o que é de dentro do escritório chega junto (a linha da Carteira inteira) e não pode sair na carta
  const dentro = { ...base, motor: 777.77, piso: 888.88, honorario_sugerido: 999.99, fonte_atual: 'conta_azul', fonte: 'Conta Azul', observacao: 'NAO PODE SAIR NA CARTA',
    respostas: { _obs_interna: 'ANOTACAO INTERNA', obs_orcamento: 'OBSERVACAO DO ORCAMENTO', A12B: 300 }, revisao: { observacao: 'NAO PODE SAIR', honorario_sugerido: 999.99 } };
  const t = tudo(textoDaCarta(dentro));
  const vazou = ['777', '888', '999', 'Conta Azul', 'conta_azul', 'NAO PODE', 'ANOTACAO', 'OBSERVACAO', '%', 'motor', 'piso', 'questionário'].filter(x => t.toLowerCase().includes(x.toLowerCase()));
  chk('nada de dentro: o motor, o piso, percentual, as respostas, as anotações, de onde veio o valor de hoje', vazou.length === 0, vazou.join(', '));
}
{
  const erro = d => { try { textoDaCarta(d); return null; } catch (e) { return e.message; } };
  chk('sem o valor novo, sem o mês ou sem a data: não sai carta', !!erro({ ...base, novo: 0 }) && !!erro({ ...base, vigencia: '2026-13' }) && !!erro({ ...base, vigencia: null })
    && !!erro({ ...base, data: '' }) && erro(base) === null);
}

console.log('\nO PDF (um jsPDF de mentira que anota o que a carta escreve):');
class Doc {
  constructor(o) { this.opcoes = o; this.paginas = [[]]; this.atual = 0; this.fonte = {}; this.salvo = null; this.props = null; }
  setFont(f, s) { this.fonte = { ...this.fonte, f, s }; return this; }
  setFontSize(n) { this.fonte = { ...this.fonte, n }; return this; }
  setTextColor(...c) { this.fonte = { ...this.fonte, c: c.join(',') }; return this; }
  // ~0,5 da letra por caractere: quebra como o de verdade (só no espaço comum)
  splitTextToSize(t, w) {
    const max = Math.floor(w / (this.fonte.n * 0.5)), linhas = [];
    let l = '';
    String(t).split(' ').forEach(p => { const n = l ? l + ' ' + p : p; if (n.length > max && l) { linhas.push(l); l = p; } else l = n; });
    if (l) linhas.push(l);
    return linhas;
  }
  text(t, x, y, o) { this.paginas[this.atual].push({ t: String(t), x, y, centro: !!(o && o.align === 'center'), bold: this.fonte.s === 'bold', n: this.fonte.n }); return this; }
  addPage() { this.paginas.push([]); this.atual = this.paginas.length - 1; return this; }
  getNumberOfPages() { return this.paginas.length; }
  setPage(i) { this.atual = i - 1; return this; }
  setProperties(p) { this.props = p; return this; }
  save(n) { this.salvo = n; return this; }
}
{
  const { doc, nome, carta } = cartaEmPdf(Doc, base);
  const ts = doc.paginas.flat();
  const corpo = ts.filter(x => x.y <= MARGENS.fundo), pe = ts.filter(x => x.y > MARGENS.fundo);
  chk('A4 em pontos, uma folha só', doc.opcoes.unit === 'pt' && doc.opcoes.format === 'a4' && doc.paginas.length === 1, JSON.stringify(doc.opcoes) + ' · ' + doc.paginas.length);
  chk('o título em negrito, centralizado, no alto', ts[0].t === 'REAJUSTE DOS HONORÁRIOS CONTÁBEIS' && ts[0].bold && ts[0].centro && ts[0].y === MARGENS.topo);
  chk('o corpo dentro das margens do kit (56 a 539, até 780)', corpo.every(x => x.centro || x.x === MARGENS.esquerda) && corpo.every(x => x.y >= MARGENS.topo && x.y <= MARGENS.fundo));
  igual('o rodapé do escritório, como o do kit', pe.map(x => [x.t, x.y, x.centro]), [[ESCRITORIO.razao, 800, true], [ESCRITORIO.endereco, 811, true], [ESCRITORIO.telefone + ' - ' + ESCRITORIO.email, 822, true]]);
  const escrito = plano(corpo.map(x => x.t).join(' '));
  chk('tudo o que a carta diz está na folha', tudo(carta).split('\n').every(l => escrito.includes(l.split(' ').slice(0, 4).join(' '))) && escrito.includes('R$ 300,00 para R$ 640,00'));
  chk('a empresa em negrito; quem assina em negrito, no fim', corpo.find(x => x.t === 'PADARIA DO TESTE LTDA').bold && corpo[corpo.length - 1].t === 'Macedo & Reis Contabilidade' && corpo[corpo.length - 1].bold);
  chk('as linhas descem sem se sobrepor', corpo.every((x, i) => i === 0 || x.y > corpo[i - 1].y));
  chk('o nome do arquivo e as propriedades do PDF; quem salva é a tela', nome === 'Carta de reajuste - PADARIA DO TESTE LTDA.pdf' && doc.salvo === null
    && doc.props && doc.props.title === 'Reajuste dos honorários contábeis - PADARIA DO TESTE LTDA' && doc.props.author === ESCRITORIO.nome, JSON.stringify(doc.props));
}
{
  // a carta que não cabe numa folha: o parágrafo vai inteiro pra próxima e o rodapé sai nas duas
  const doc = new Doc({ unit: 'pt', format: 'a4' });
  const carta = textoDaCarta(base);
  desenharCarta(doc, { ...carta, paragrafos: Array.from({ length: 8 }, (_, i) => 'Parágrafo ' + (i + 1) + ' ' + 'texto de teste '.repeat(30)) });
  const p2 = doc.paginas[1] || [];
  chk('mais de uma folha, com o rodapé em todas e o corpo dentro das margens', doc.paginas.length >= 2 && doc.paginas.every(p => p.filter(x => x.y > MARGENS.fundo).length === 3)
    && doc.paginas.flat().filter(x => x.y <= MARGENS.fundo).every(x => x.y >= MARGENS.topo), doc.paginas.length);
  chk('a folha 2 começa no alto com um parágrafo inteiro', p2.length > 0 && p2[0].y === MARGENS.topo && /^Parágrafo \d+ /.test(p2[0].t), p2[0] && p2[0].t.slice(0, 20));
}

console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
