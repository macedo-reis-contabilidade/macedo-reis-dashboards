// O boleto do mês pelo Conta Azul (05/11/2026): as regras puras de assets/js/boletos-conta-azul.js — o que vence no mês
// do boleto, a mensalidade e os extras, o adicional que já está no boleto, o item tirado, o que sobe, desce ou só muda a
// composição, e a conferência do mês inteiro. Os casos são os de novembro de 2026 (os nomes, de mentira: o repositório é
// público). Rodar com: node tests/boletos-conta-azul.test.mjs
import {
  mesDoBoleto, mesSeguinte, ehMensalidade, vendaDe, rotuloDoItem, propostaDoBoleto, conferirMes, mensalidadeDoMes, resumoDaConferencia, APLICAVEIS,
  valorParaTotal, totalDoBoleto, somaExtras, gravacaoDaProposta, marcadaPorPadrao, ehParcela
} from '../assets/js/boletos-conta-azul.js';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + extra : '')); };
const J = x => JSON.stringify(x);
const MENSAL = ['HONORÁRIOS MENSAIS'], EXTRA = ['SERVIÇOS EXTRAS'], ADIC = ['HONORÁRIO ADICIONAL ANUAL'];
const it = (id, valor, cats, competencia, extra = {}) => ({ parcela_id: id, valor, categorias: cats, competencia, vencimento: '2026-11-10', descricao: 'Venda 190421000', ...extra });
const adicionalNoBoleto = (valor, venda) => ({ adicional_id: 'adic-' + venda, descricao: 'Honorário adicional anual (venda ' + venda + ')', valor });

console.log('O mês do boleto, a mensalidade e os rótulos:');
chk('o mês do boleto é o do vencimento dele', mesDoBoleto({ competencia: '2026-10', vencimento: '2026-11-10' }) === '2026-11');
chk('sem vencimento, o mês seguinte ao da competência (dezembro vira janeiro)', mesDoBoleto({ competencia: '2026-12' }) === '2027-01' && mesSeguinte('2026-09') === '2026-10');
chk('a mensalidade pelas categorias (com acento ou sem), o MEI também', ehMensalidade({ categorias: ['HONORÁRIOS MENSAIS'] }) && ehMensalidade({ categorias: ['honorarios mensais'] })
  && ehMensalidade({ categorias: ['MEI - CONTRATOS'] }) && !ehMensalidade({ categorias: EXTRA }) && !ehMensalidade({ categorias: ADIC }));
chk('o número da venda: "1/4 - Venda N" e "(venda N)"', vendaDe('1/4 - Venda 190421319') === '190421319' && vendaDe('Honorário adicional anual (venda 190421461)') === '190421461' && vendaDe('Venda') === null);
chk('o rótulo: a categoria como se escreve e a descrição do Conta Azul, sem a NFS-e',
  rotuloDoItem({ categorias: EXTRA, descricao: '1/4 - Venda 190421319' }, '2026-10') === 'Serviços extras · 1/4 - Venda 190421319'
  && rotuloDoItem({ categorias: MENSAL, competencia: '2026-09-30', descricao: 'Venda 190421224 / NFS-e:1039 - RPS:1039' }, '2026-10') === 'Honorários de 09/2026 · Venda 190421224'
  && rotuloDoItem({ categorias: MENSAL, competencia: '2026-10-31', descricao: 'Venda 190421415 / NFS-e:1110 - RPS:1110' }, '2026-10') === 'Honorários · Venda 190421415'
  && rotuloDoItem({ categorias: ['Descontos incondicionais concedidos', 'SERVIÇOS EXTRAS'], descricao: 'Venda 1904213' }, '2026-10') === 'Serviços extras · Venda 1904213');

console.log('A Adega (o exemplo do Samuel): 660 + 660 do adicional + 200 da 1ª parcela = 1.520,00:');
{
  const cob = { competencia: '2026-10', vencimento: '2026-11-10', valor: 660, status: 'a_emitir', itens_extras: [adicionalNoBoleto(660, '190421461')] };
  const itens = [
    it('p-mensal', 660, MENSAL, '2026-10-31', { descricao: 'Venda 190421415 / NFS-e:1110 - RPS:1110' }),
    it('p-1de4', 200, EXTRA, '2026-10-15', { descricao: '1/4 - Venda 190421319' }),
    it('p-2de4', 200, EXTRA, '2026-10-15', { descricao: '2/4 - Venda 190421319', vencimento: '2026-12-10' }),
    it('p-adic', 660, ADIC, '2026-10-31', { descricao: 'Venda 190421461' })
  ];
  const p = propostaDoBoleto(cob, itens);
  chk('o total é 1.520,00 e sobe (era 1.320,00)', p.total === 1520 && p.antes.total === 1320 && p.situacao === 'sobe', J(p));
  chk('o valor fica a mensalidade do Conta Azul (660); a parcela entra como extra, com o id da parcela; a 2ª parcela (dezembro) não',
    p.valor === 660 && p.mensalidade === 'conta_azul' && p.itens_extras.length === 2
    && p.itens_extras.some(x => x.ca_parcela_id === 'p-1de4' && x.valor === 200 && x.descricao === 'Serviços extras · 1/4 - Venda 190421319')
    && !p.itens_extras.some(x => x.ca_parcela_id === 'p-2de4'), J(p.itens_extras));
  chk('o adicional que já está no boleto fica como está e não entra de novo pela venda dele',
    p.itens_extras.some(x => x.adicional_id === 'adic-190421461') && !p.itens_extras.some(x => x.ca_parcela_id === 'p-adic'));
  chk('o que a tela mostra: a mensalidade e o extra', J(p.itens.map(i => [i.rotulo, i.valor, !!i.mensalidade])) === J([['Honorários · Venda 190421415', 660, true], ['Serviços extras · 1/4 - Venda 190421319', 200, false]]));
  chk('marcada pra aplicar, e o que grava é o valor e os extras', marcadaPorPadrao(p) && J(gravacaoDaProposta(p)) === J({ valor: 660, itens_extras: p.itens_extras }));
  // aplicada, a conferência seguinte não muda nada
  const depois = { ...cob, ...gravacaoDaProposta(p) };
  const p2 = propostaDoBoleto(depois, itens);
  chk('aplicada, a conferência seguinte dá "igual" (nada a fazer)', p2.situacao === 'igual' && p2.total === 1520 && !marcadaPorPadrao(p2), J(p2));
  chk('o total da grade com os extras', totalDoBoleto(depois) === 1520 && somaExtras(depois.itens_extras) === 860);
  chk('o valor que dá um total digitado: o total menos os extras (null quando os extras passam do total)',
    valorParaTotal(1600, depois.itens_extras) === 740 && valorParaTotal(800, depois.itens_extras) === null);
  // tirado do boleto: fica marcado e não volta
  const tirado = { ...depois, itens_extras: depois.itens_extras.map(x => x.ca_parcela_id === 'p-1de4' ? { ...x, ignorado: true } : x) };
  chk('o item tirado do boleto não soma', totalDoBoleto(tirado) === 1320);
  const p3 = propostaDoBoleto(tirado, itens);
  chk('… e a conferência seguinte o mantém tirado ("igual")', p3.situacao === 'igual' && p3.total === 1320 && p3.itens_extras.some(x => x.ca_parcela_id === 'p-1de4' && x.ignorado), J(p3));
}

console.log('A composição, o que desce e o que pede conferência:');
{
  // o extra que estava somado à mão no valor: o total fica, a mensalidade volta a ser a do Conta Azul
  const r = propostaDoBoleto({ competencia: '2026-10', vencimento: '2026-11-10', valor: 905, status: 'a_emitir', itens_extras: [] },
    [it('m', 825, MENSAL, '2026-10-31'), it('x', 80, EXTRA, '2026-10-10')]);
  chk('o extra somado no valor: o total fica (905) e a mensalidade passa a 825, com o extra à parte ("recompõe")',
    r.situacao === 'recompoe' && r.total === 905 && r.valor === 825 && r.itens_extras.length === 1 && marcadaPorPadrao(r) && /passa de R\$\s905,00 para R\$\s825,00/.test(r.avisos.join(' ')), J(r));
  // o extra de um mês que tinha ido junto pro outro: desce, sem pedir conferência
  const d = propostaDoBoleto({ competencia: '2026-10', vencimento: '2026-11-10', valor: 320, status: 'a_emitir', itens_extras: [adicionalNoBoleto(300, '190421487')] },
    [it('m', 300, MENSAL, '2026-10-31'), it('a', 300, ADIC, '2026-10-31', { descricao: 'Venda 190421487' })]);
  chk('desce de 620 para 600 (o extra antigo saiu), marcada', d.situacao === 'desce' && d.total === 600 && !d.confira && marcadaPorPadrao(d), J(d));
  // cai mais de 30%: pede conferência
  const q = propostaDoBoleto({ competencia: '2026-10', vencimento: '2026-11-16', valor: 1000, status: 'a_emitir', itens_extras: [] }, [it('m', 500, MENSAL, '2026-10-31', { vencimento: '2026-11-15' })]);
  chk('o total que cai mais de 30% pede conferência e começa desmarcado', q.situacao === 'desce' && q.confira && !marcadaPorPadrao(q) && /mais de 30%/.test(q.avisos.join(' ')), J(q));
  // o MEI: o escritório paga a guia do MEI e cobra junto (a guia não está no Conta Azul) — o valor de hoje, maior, fica
  const g = propostaDoBoleto({ competencia: '2026-10', vencimento: '2026-11-16', valor: 175, status: 'a_emitir', itens_extras: [] }, [it('m', 87.95, ['MEI - CONTRATOS'], '2026-10-31', { vencimento: '2026-11-15' })]);
  chk('o MEI (pela categoria MEI - CONTRATOS): o valor de hoje fica, com a guia do MEI — nada muda, nada a conferir',
    g.situacao === 'igual' && g.valor === 175 && !g.confira && /R\$\s87,05 a mais que o contrato do Conta Azul \(R\$\s87,95\), a guia do MEI/.test(g.avisos.join(' ')) && g.itens[0].rotulo === 'Mensalidade com a guia do MEI', J(g));
  const gc = propostaDoBoleto({ competencia: '2026-10', vencimento: '2026-11-10', valor: 225, status: 'a_emitir', itens_extras: [] }, [it('m', 137.95, MENSAL, '2026-10-31'), it('x', 30, EXTRA, '2026-10-20')], { mei: true });
  chk('o MEI do cadastro (o contrato em HONORÁRIOS MENSAIS): a guia fica no valor e o extra entra', gc.valor === 225 && gc.total === 255 && gc.situacao === 'sobe', J(gc));
  const gm = propostaDoBoleto({ competencia: '2026-10', vencimento: '2026-11-10', valor: 80, status: 'a_emitir', itens_extras: [] }, [it('m', 87.95, ['MEI - CONTRATOS'], '2026-10-31')], { mei: true });
  chk('o MEI com o boleto abaixo do contrato: vale o contrato', gm.valor === 87.95 && gm.situacao === 'sobe', J(gm));
  // sem a mensalidade lá (nem com o mesmo valor): fica o valor de hoje e os itens entram por cima — pede conferência
  const s = propostaDoBoleto({ competencia: '2026-10', vencimento: '2026-11-10', valor: 450, status: 'a_emitir', itens_extras: [] }, [it('x', 300, EXTRA, '2026-10-20')]);
  chk('sem a mensalidade no Conta Azul: fica a de hoje, o item entra por cima, e pede conferência',
    s.mensalidade === 'mantida' && s.valor === 450 && s.total === 750 && s.confira && !marcadaPorPadrao(s) && /não tem a mensalidade/.test(s.avisos.join(' ')), J(s));
  // o contrato noutra categoria, com o mesmo valor do boleto (o MEI em "MEI - SERVIÇOS PRESTADOS"): é a mensalidade
  const v = propostaDoBoleto({ competencia: '2026-10', vencimento: '2026-11-10', valor: 165, status: 'a_emitir', itens_extras: [] }, [it('m', 165, ['MEI - SERVIÇOS PRESTADOS'], '2026-10-31')]);
  chk('o contrato noutra categoria, com o mesmo valor do boleto, é a mensalidade (não soma duas vezes)', v.situacao === 'igual' && v.total === 165 && v.mensalidade === 'conta_azul', J(v));
  chk('… mas o adicional com o mesmo valor não vira mensalidade', mensalidadeDoMes([it('a', 165, ADIC, '2026-10-31')], '2026-10', 165).length === 0);
  // a mensalidade de outro mês que vence neste: fica fora (decisão do Samuel, 05/11/2026), com o aviso
  const c = propostaDoBoleto({ competencia: '2026-10', vencimento: '2026-11-10', valor: 575, status: 'a_emitir', itens_extras: [] },
    [it('m10', 575, MENSAL, '2026-10-31'), it('m09', 575, MENSAL, '2026-09-30', { vencimento: '2026-11-06', descricao: 'Venda 190421224 / NFS-e:1039 - RPS:1039' })]);
  chk('a mensalidade de outro mês que vence neste fica fora do boleto, com o aviso', c.situacao === 'igual' && c.total === 575 && c.itens_extras.length === 0
    && /Fica fora: Honorários de 09\/2026 · Venda 190421224 \(R\$\s575,00\) — mensalidade de outro mês não entra no boleto/.test(c.avisos.join(' ')) && c.fora.length === 1, J(c));
  // … mas a parcela de uma venda parcelada de honorário entra
  const pp = propostaDoBoleto({ competencia: '2026-10', vencimento: '2026-11-10', valor: 1007.25, status: 'a_emitir', itens_extras: [] },
    [it('m', 750, MENSAL, '2026-10-31'), it('p1', 87, MENSAL, '2024-02-29', { descricao: '4/4 - Venda 190400001' }), it('p2', 170.25, MENSAL, '2024-07-31', { descricao: '1/4 - Venda 190400002' })]);
  chk('a parcela de uma venda parcelada de honorário entra (o total fica, a composição muda)', pp.situacao === 'recompoe' && pp.total === 1007.25 && pp.valor === 750 && pp.itens_extras.length === 2
    && pp.itens_extras.some(x => x.descricao === 'Honorários de 02/2024 · 4/4 - Venda 190400001'), J(pp));
  chk('o que é parcela', ehParcela({ descricao: '2/4 - Venda 190421319' }) && ehParcela({ descricao: '1/2 - Venda 190416834 1/2' }) && !ehParcela({ descricao: 'Venda 190421224 / NFS-e:1039' }));
  // sem a mensalidade da competência: a de outro mês com o mesmo valor do boleto é a mensalidade (não fica fora)
  const so = propostaDoBoleto({ competencia: '2026-10', vencimento: '2026-11-10', valor: 850, status: 'a_emitir', itens_extras: [] }, [it('m09', 850, MENSAL, '2026-09-30')]);
  chk('sem a mensalidade da competência, a de outro mês com o mesmo valor do boleto é a mensalidade', so.situacao === 'igual' && so.mensalidade === 'conta_azul' && so.fora.length === 0, J(so));
  // o faturável fica
  const f = propostaDoBoleto({ competencia: '2026-10', vencimento: '2026-11-10', valor: 500, status: 'a_emitir', itens_extras: [{ faturavel_id: 'f1', descricao: 'Abertura de filial', valor: 300 }] },
    [it('m', 500, MENSAL, '2026-10-31')]);
  chk('o faturável que já estava no boleto fica', f.situacao === 'igual' && f.total === 800 && f.itens_extras.some(x => x.faturavel_id === 'f1'), J(f));
  // o boleto já emitido: não muda, só compara
  const e = propostaDoBoleto({ competencia: '2026-10', vencimento: '2026-11-10', valor: 500, status: 'emitido', itens_extras: [] }, [it('m', 500, MENSAL, '2026-10-31'), it('x', 40, EXTRA, '2026-10-20')]);
  chk('o boleto já emitido: "fechado", nunca marcado, com o aviso', e.situacao === 'fechado' && !marcadaPorPadrao(e) && /já está emitido/.test(e.avisos.join(' ')), J(e));
  const n = propostaDoBoleto({ competencia: '2026-10', vencimento: '2026-11-10', valor: 500, status: 'a_emitir', itens_extras: [] }, [it('m', 500, MENSAL, '2026-10-31', { vencimento: '2026-12-10' })]);
  chk('nada vencendo no mês do boleto: "sem_conta_azul", nada muda', n.situacao === 'sem_conta_azul' && n.total === 500 && !marcadaPorPadrao(n));
}

console.log('A conferência do mês:');
{
  const cobs = [
    { id: 'b1', cliente_id: 'c1', competencia: '2026-10', vencimento: '2026-11-10', valor: 500, status: 'a_emitir', itens_extras: [] },
    { id: 'b2', cliente_id: 'c2', competencia: '2026-10', vencimento: '2026-11-10', valor: 320, status: 'a_emitir', itens_extras: [] },
    { id: 'b3', cliente_id: 'c3', competencia: '2026-10', vencimento: '2026-11-10', valor: 400, status: 'a_emitir', itens_extras: [] }
  ];
  const dados = { itens: [
    { ...it('m1', 500, MENSAL, '2026-10-31'), cliente_id: 'c1' }, { ...it('x1', 100, EXTRA, '2026-10-20'), cliente_id: 'c1' },
    { ...it('m2', 300, MENSAL, '2026-10-31'), cliente_id: 'c2' },
    { ...it('m4', 700, MENSAL, '2026-10-31'), cliente_id: 'c4', cliente_nome: 'EMPRESA SEM BOLETO LTDA' }
  ], soltas: [{ nome: 'PESSOA A', valor: 50, itens: 1 }, { nome: 'PESSOA B', valor: 90, itens: 2 }] };
  const r = conferirMes(cobs, dados);
  chk('uma proposta por boleto, o que desce primeiro', r.propostas.map(p => p.cobranca.id + ':' + p.proposta.situacao).join(' ') === 'b2:desce b1:sobe b3:sem_conta_azul', r.propostas.map(p => p.cobranca.id + ':' + p.proposta.situacao).join(' '));
  chk('o resumo: quantas sobem, descem, sem o Conta Azul, e a diferença do total', r.resumo.sobe === 1 && r.resumo.desce === 1 && r.resumo.sem_conta_azul === 1 && r.resumo.diferenca === 80, J(r.resumo));
  chk('a empresa com coisa vencendo lá e sem boleto aqui', r.semBoleto.length === 1 && r.semBoleto[0].nome === 'EMPRESA SEM BOLETO LTDA' && r.semBoleto[0].valor === 700);
  chk('as pessoas do Conta Azul sem empresa, a maior primeiro', r.soltas.map(s => s.nome).join(',') === 'PESSOA B,PESSOA A');
}

console.log('O aviso do alto da tela (a conferência ao abrir o mês, 05/11/2026)');
{
  const cobs = [
    { id: 'b1', cliente_id: 'c1', competencia: '2026-10', vencimento: '2026-11-10', valor: 500, status: 'a_emitir', itens_extras: [] },
    { id: 'b2', cliente_id: 'c2', competencia: '2026-10', vencimento: '2026-11-10', valor: 1000, status: 'a_emitir', itens_extras: [] },
    { id: 'b3', cliente_id: 'c3', competencia: '2026-10', vencimento: '2026-11-10', valor: 400, status: 'a_emitir', itens_extras: [] },
    { id: 'b4', cliente_id: 'c4', competencia: '2026-10', vencimento: '2026-11-10', valor: 300, status: 'emitido', itens_extras: [] },
    { id: 'b5', cliente_id: 'c5', competencia: '2026-10', vencimento: '2026-11-10', valor: 250, status: 'a_emitir', itens_extras: [] }
  ];
  const dados = { itens: [
    { ...it('m1', 500, MENSAL, '2026-10-31'), cliente_id: 'c1' }, { ...it('x1', 100, EXTRA, '2026-10-20'), cliente_id: 'c1' },
    { ...it('m2', 500, MENSAL, '2026-10-31'), cliente_id: 'c2' },
    { ...it('m4', 340, MENSAL, '2026-10-31'), cliente_id: 'c4' },
    { ...it('m5', 250, MENSAL, '2026-10-31'), cliente_id: 'c5' }
  ], soltas: [] };
  const res = resumoDaConferencia(conferirMes(cobs, dados));
  chk('conta os boletos a emitir que o Conta Azul mudaria (o já emitido não entra), e como', res.aEmitir === 4 && res.muda === 2 && res.sobe === 1 && res.desce === 1 && res.recompoe === 0, J(res));
  chk('a queda de mais de 30% conta como "pede a sua conferência"', res.confira === 1, J(res));
  chk('o mês do vencimento lido', J(res.meses) === '["2026-11"]', J(res.meses));
  const igual = resumoDaConferencia(conferirMes([cobs[4]], dados));
  chk('tudo batendo: nada muda', igual.muda === 0 && igual.aEmitir === 1, J(igual));
  chk('sem conferência: zero', resumoDaConferencia(null).muda === 0 && resumoDaConferencia(null).aEmitir === 0);
  chk('as que mudam o boleto: as que sobem, descem e só mudam a composição', J(APLICAVEIS) === '["desce","sobe","recompoe"]');
}

if (falhas) { console.log('\n' + falhas + ' falha(s)'); process.exit(1); }
console.log('\nTudo certo.');
