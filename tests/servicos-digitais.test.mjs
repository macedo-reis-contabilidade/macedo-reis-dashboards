// Os serviços digitais do Comercial (assets/js/servicos-digitais.js, 15/11/2026): a régua de cada serviço, o que falta
// pra ir pro ar, as contas das vendas (pendências, arrependimento, números por mês, teste de parar) e a tarefa das
// NFS-e da Thalia. Dados inventados. Rodar com: node tests/servicos-digitais.test.mjs
import { SITUACOES, PEDE_MOTIVO, ESTADOS, GRUPOS, REGUA, LIMITES, nomeDaSituacao, diaEmBrasilia, fmtData, mesDe, rotuloDoMes, instanteDoDia,
  fmtDinheiro, lerDinheiro, textoDoPreco, slugDe, slugValido, linkSeguro, linkDeFora, itensDaRegua, faltaPraIrProAr, podeIrProAr, progressoDaRegua,
  reguaParaGravar, proximoPasso, janelaDoServico, conferirServico, cpfValido, aceitaVenda, conferirVenda, pendenciasDaVenda, arrependimentoAte,
  dentroDoArrependimento, textoDoArrependimento, contasPorServico, resumoDaVitrine, seloDoCard, secoesDaVitrine, numerosPorMes, testeDeParar,
  guiaDoComeco, TITULO_TAREFA_NOTAS, INTRO_TAREFA_NOTAS, linhaDaNota, descricaoDaTarefaNotas, temVendaNaTarefa, juntarNaTarefaNotas,
  marcarNotaNaTarefa, desmarcarNotaNaTarefa, tirarDaTarefaNotas, prazoDaTarefaNotas } from '../assets/js/servicos-digitais.js';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); };
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const HOJE = '2026-11-15';
const CNPJ = '11222333000181', CPF = '52998224725';
const todos = (estado, fora = []) => Object.fromEntries(REGUA.filter(i => !fora.includes(i.chave)).map(i => [i.chave, { estado, nota: estado === 'ok' ? '' : 'porque sim' }]));
const servico = (o = {}) => ({ id: 's1', slug: 'servico-teste', nome: 'Serviço de teste', modelo: 'pago', preco: 97, situacao: 'preparo', regua: {}, ordem: 0,
  quem_assina: 'Escritório Exemplo Ltda', link_pagina: 'https://exemplo.com.br/servico', ...o });
const venda = (o = {}) => ({ id: 'v1', numero: 1, servico_id: 's1', comprador_nome: 'LOJA EXEMPLO LTDA', comprador_documento: CNPJ, valor: 97, pagamento: 'aguardando',
  criado_em: '2026-11-10T15:00:00Z', pago_em: null, entregue_em: null, nfse_numero: null, ...o });

console.log('A régua:');
chk('14 itens em 5 grupos, na ordem combinada', REGUA.length === 14 && GRUPOS.length === 5
  && REGUA.map(i => i.chave).join(',') === 'pode_vender,pode_cobrar,carteira,regra_conferida,testado,identificacao,preco_escrito,termos,dados,pix,nfse,entrega,responsavel_tecnico,ok_samuel',
  REGUA.map(i => i.chave));
chk('cada item tem o grupo, o rótulo, a ajuda e a base', REGUA.every(i => GRUPOS.some(g => g.id === i.grupo) && i.rotulo && i.ajuda.length > 40 && i.base.length > 5));
chk('cada grupo tem pelo menos um item', GRUPOS.every(g => REGUA.some(i => i.grupo === g.id)));
chk('só da venda paga: o preço, os termos, o Pix e a NFS-e', REGUA.filter(i => i.soPago).map(i => i.chave).join(',') === 'preco_escrito,termos,pix,nfse');
chk('"não se aplica" só onde faz sentido (a regra, o teste e os dados)', REGUA.filter(i => i.aceitaNa).map(i => i.chave).join(',') === 'regra_conferida,testado,dados');
chk('as bases citadas: o CFC, o Decreto-Lei, o Código de Ética, o CDC e a LC 123', ['Res. CFC 1.640/2021', 'DL 9.295/1946', 'NBC PG 01', 'Res. CFC 1.590/2020', 'CDC, art. 49', 'Decreto 7.962/2013', 'LC 123/2006, art. 18']
  .every(b => REGUA.some(i => i.base.includes(b))));
chk('os estados e as situações', igual(Object.keys(ESTADOS), ['pendente', 'ok', 'nao', 'na']) && SITUACOES.map(s => s.id).join(',') === 'ideia,estudo,preparo,no_ar,pausado,encerrado,descartado'
  && igual(PEDE_MOTIVO, ['pausado', 'encerrado', 'descartado']) && nomeDaSituacao('no_ar') === 'No ar' && nomeDaSituacao('x') === '');

console.log('Os itens de cada serviço:');
{
  const pago = itensDaRegua(servico()), gratis = itensDaRegua(servico({ modelo: 'gratis', preco: null }));
  chk('o pago tem os 14, todos pendentes sem nada gravado', pago.length === 14 && pago.every(i => i.estado === 'pendente' && !i.resolvido && !i.informativo));
  chk('o grátis não tem os 4 da venda paga', gratis.length === 10 && !gratis.some(i => i.soPago));
  chk('no grátis, o "pode cobrar" só informa', gratis.find(i => i.chave === 'pode_cobrar').informativo === true && gratis.filter(i => i.informativo).length === 1);
  const r = itensDaRegua(servico({ regua: { pode_vender: { estado: 'ok', nota: ' conferido ', em: '2026-11-12T12:00:00Z', por: 'Samuel' }, carteira: { estado: 'na' }, testado: { estado: 'na', nota: 'sem regra' }, dados: { estado: 'lixo' }, pix: 'texto' } }));
  const de = k => r.find(i => i.chave === k);
  chk('o gravado vem com o estado, a nota, o quem e o quando', de('pode_vender').estado === 'ok' && de('pode_vender').nota === 'conferido' && de('pode_vender').por === 'Samuel' && de('pode_vender').resolvido);
  chk('"não se aplica" onde não cabe vira pendente', de('carteira').estado === 'pendente' && !de('carteira').resolvido);
  chk('"não se aplica" onde cabe conta como resolvido', de('testado').estado === 'na' && de('testado').resolvido);
  chk('estado desconhecido e item que não é objeto: pendente', de('dados').estado === 'pendente' && de('pix').estado === 'pendente');
  chk('sem serviço, sem régua ou com régua que não é objeto: não quebra', itensDaRegua(null).length === 14 && itensDaRegua({ regua: [] }).length === 14 && itensDaRegua({ regua: 'x' }).every(i => i.estado === 'pendente'));
}

console.log('O que falta pra ir pro ar:');
{
  const pronto = servico({ regua: todos('ok') });
  chk('régua fechada, com preço, quem assina e a página: pode', podeIrProAr(pronto) && faltaPraIrProAr(pronto).length === 0);
  chk('sem nada: faltam os 14', faltaPraIrProAr(servico()).filter(f => f.tipo === 'regua').length === 14 && !podeIrProAr(servico()));
  const semCobrar = servico({ regua: { ...todos('ok'), pode_cobrar: { estado: 'nao', nota: 'a lei manda fazer de graça' } } });
  chk('no pago, o "não pode cobrar" trava', !podeIrProAr(semCobrar) && igual(faltaPraIrProAr(semCobrar).map(f => f.chave), ['pode_cobrar']) && faltaPraIrProAr(semCobrar)[0].estado === 'nao');
  const gratis = servico({ modelo: 'gratis', preco: null, regua: { ...todos('ok', ['preco_escrito', 'termos', 'pix', 'nfse']), pode_cobrar: { estado: 'nao', nota: 'LC 123' } } });
  chk('no grátis, o "não pode cobrar" não trava (é por isso que é grátis)', podeIrProAr(gratis), faltaPraIrProAr(gratis));
  chk('o grátis não precisa de preço', !faltaPraIrProAr(gratis).some(f => f.chave === 'preco'));
  chk('o "não" em qualquer outro item trava, no pago e no grátis', !podeIrProAr({ ...gratis, regua: { ...gratis.regua, carteira: { estado: 'nao', nota: 'concorre' } } })
    && !podeIrProAr({ ...pronto, regua: { ...pronto.regua, ok_samuel: { estado: 'nao', nota: 'ainda não' } } }));
  chk('sem preço (ou com zero), o pago não vai', igual(faltaPraIrProAr({ ...pronto, preco: null }).map(f => f.chave), ['preco']) && !podeIrProAr({ ...pronto, preco: 0 }) && !podeIrProAr({ ...pronto, preco: '' }));
  chk('sem quem assina e sem a página, não vai', igual(faltaPraIrProAr({ ...pronto, quem_assina: ' ', link_pagina: null }).map(f => f.chave), ['quem_assina', 'link_pagina']));
  chk('a página com endereço que não é seguro não conta', !podeIrProAr({ ...pronto, link_pagina: 'javascript:alert(1)' }) && podeIrProAr({ ...pronto, link_pagina: 'mei.html' }));
  chk('"não se aplica" (onde cabe) fecha o item', podeIrProAr({ ...pronto, regua: { ...pronto.regua, testado: { estado: 'na', nota: 'sem regra' }, dados: { estado: 'na', nota: 'não coleta nada' } } }));
  chk('"não se aplica" no ok do Samuel não vale', !podeIrProAr({ ...pronto, regua: { ...pronto.regua, ok_samuel: { estado: 'na', nota: 'x' } } }));
  const p = progressoDaRegua(servico({ regua: { pode_vender: { estado: 'ok' }, pode_cobrar: { estado: 'ok' }, carteira: { estado: 'nao', nota: 'x' } } }));
  chk('o progresso: feitos, total e o próximo em aberto, na ordem da régua', p.feitos === 2 && p.total === 14 && !p.fechada && p.proximo.chave === 'carteira' && p.proximo.estado === 'nao' && p.proximo.grupo === 'pode', p);
  const pg = progressoDaRegua(gratis);
  chk('no grátis o total é 9 (sem os 4 da venda e sem o informativo)', pg.total === 9 && pg.feitos === 9 && pg.fechada && pg.proximo === null, pg);
}

console.log('A régua que a tela grava:');
{
  const antes = { pode_vender: { estado: 'ok', nota: 'conferido', em: '2026-11-12T12:00:00Z', por: 'Samuel' }, carteira: { estado: 'ok', nota: '', em: '2026-11-12T12:00:00Z', por: 'Samuel' } };
  const form = { pode_vender: { estado: 'ok', nota: 'conferido' }, carteira: { estado: 'nao', nota: 'concorre com um cliente' }, testado: { estado: 'pendente', nota: '' }, dados: { estado: 'pendente', nota: 'falta o aviso' },
    ok_samuel: { estado: 'na', nota: 'x' }, pix: { estado: 'ok', nota: '' } };
  const r = reguaParaGravar(antes, form, 'Thalia', '2026-11-15T20:00:00Z');
  chk('o que não mudou fica com o quem e o quando de antes', igual(r.pode_vender, antes.pode_vender));
  chk('o que mudou ganha o quem e o quando de agora', igual(r.carteira, { estado: 'nao', nota: 'concorre com um cliente', em: '2026-11-15T20:00:00Z', por: 'Thalia' }));
  chk('o pendente sem nota não é gravado, o pendente com nota é', !('testado' in r) && r.dados.estado === 'pendente' && r.dados.nota === 'falta o aviso' && r.dados.por === 'Thalia');
  chk('"não se aplica" onde não cabe vira pendente (com a nota)', r.ok_samuel.estado === 'pendente' && r.ok_samuel.nota === 'x');
  chk('item novo marcado entra', r.pix.estado === 'ok' && r.pix.em === '2026-11-15T20:00:00Z');
  chk('voltar a pendente sem nota tira o item', !('carteira' in reguaParaGravar(antes, { carteira: { estado: 'pendente', nota: '' } }, 'Thalia', 'x')));
  chk('item que o formulário não trouxe fica como estava', igual(reguaParaGravar(antes, {}, 'Thalia', 'x'), antes) && igual(reguaParaGravar(null, null, 'x', 'y'), {}));
  chk('chave que não é da régua não entra', !('invasor' in reguaParaGravar({}, { invasor: { estado: 'ok' } }, 'x', 'y')));
  chk('a nota é cortada no limite', reguaParaGravar({}, { dados: { estado: 'ok', nota: 'a'.repeat(900) } }, 'x', 'y').dados.nota.length === LIMITES.nota);
}

console.log('O próximo passo:');
{
  const pronto = servico({ regua: todos('ok') });
  chk('em preparo, diz quantos faltam e o próximo', proximoPasso(servico({ regua: { pode_vender: { estado: 'ok' } } })).texto === 'Faltam 13 itens da régua. O próximo: Pode cobrar por ele.');
  chk('faltando um só', proximoPasso(servico({ regua: todos('ok', ['ok_samuel']) })).texto === 'Falta 1 item da régua: O ok do Samuel pra ir pro ar.');
  chk('régua fechada e campos em dia: pode ir pro ar', proximoPasso(pronto).texto === 'A régua fechou: pode ir pro ar.' && !proximoPasso(pronto).alerta);
  chk('régua fechada, falta campo', proximoPasso({ ...pronto, quem_assina: null, preco: null }).texto === 'A régua fechou. Falta preencher: o preço, quem assina.');
  chk('a ideia: o passo é entrar em estudo, não a régua inteira', proximoPasso(servico({ situacao: 'ideia', regua: {} })).texto === 'Ideia guardada. Pra começar, passe pra "Em estudo".' && !proximoPasso(servico({ situacao: 'ideia', regua: {} })).alerta
    && proximoPasso(servico({ situacao: 'estudo', regua: {} })).texto === 'Faltam 14 itens da régua. O próximo: O escritório pode vender este serviço.' && proximoPasso({ ...pronto, situacao: 'ideia' }).texto === 'A régua fechou: pode ir pro ar.');
  chk('pausado, encerrado e descartado dizem o motivo', proximoPasso(servico({ situacao: 'pausado', motivo: 'esperando a lei' })).texto === 'Pausado: esperando a lei' && proximoPasso(servico({ situacao: 'descartado' })).texto === 'Descartado.');
  const noAr = { ...pronto, situacao: 'no_ar', parar_em: '2027-01-31', parar_criterio: 'menos de 5 vendas, encerra' };
  chk('no ar, com a data de reavaliar', proximoPasso(noAr, { hoje: HOJE, vendas: [] }).texto === 'Reavaliar em 31/01/2027 (77 dias): menos de 5 vendas, encerra · até aqui, 0 vendas.' && !proximoPasso(noAr, { hoje: HOJE }).alerta,
    proximoPasso(noAr, { hoje: HOJE, vendas: [] }).texto);
  const aberto = proximoPasso({ ...noAr, regua: { ...noAr.regua, termos: { estado: 'pendente' }, dados: { estado: 'nao', nota: 'x' } } }, { hoje: HOJE });
  chk('no ar com item da régua em aberto: alerta', aberto.alerta && aberto.texto === 'No ar com 2 itens da régua em aberto. O próximo: Os termos aceitos antes de pagar e o arrependimento em 7 dias.', aberto.texto);
  chk('no ar sem data de reavaliar: alerta', proximoPasso({ ...noAr, parar_em: null }, { hoje: HOJE }).alerta && proximoPasso({ ...noAr, parar_em: null }, { hoje: HOJE }).texto.startsWith('Sem data de reavaliar'));
  chk('no ar com a data vencida: alerta', proximoPasso({ ...noAr, parar_em: '2026-11-15' }, { hoje: HOJE }).alerta);
  chk('no ar com a janela fechada: alerta', proximoPasso({ ...noAr, janela_ate: '2026-11-01' }, { hoje: HOJE }).texto === 'A janela fechou em 01/11/2026.');
  chk('o grátis no ar sem data não é cobrado', proximoPasso(servico({ modelo: 'gratis', preco: null, situacao: 'no_ar', regua: todos('ok') }), { hoje: HOJE }).texto === 'No ar.');
}

console.log('A janela de venda:');
chk('sem data', janelaDoServico(servico(), HOJE).estado === 'sem' && janelaDoServico(servico({ janela_ate: 'lixo' }), HOJE).estado === 'sem');
chk('aberta, com os dias que faltam', igual(janelaDoServico(servico({ janela_ate: '2026-12-31' }), HOJE), { estado: 'aberta', dias: 46, texto: 'Janela até 31/12/2026 (46 dias).' }));
chk('o último dia e o dia seguinte', janelaDoServico(servico({ janela_ate: HOJE }), HOJE).texto === 'Janela até 15/11/2026 (é hoje).' && janelaDoServico(servico({ janela_ate: '2026-11-14' }), HOJE).estado === 'fechada');

console.log('Os endereços:');
chk('http e https de verdade passam', linkSeguro('https://exemplo.com.br/a?b=1#c') === 'https://exemplo.com.br/a?b=1#c' && linkSeguro(' http://exemplo.com ') === 'http://exemplo.com' && linkDeFora('HTTPS://exemplo.com'));
chk('a tela do sistema passa (com pasta, consulta e âncora)', linkSeguro('mei.html') === 'mei.html' && linkSeguro('clientes/editar.html?id=abc-123') === 'clientes/editar.html?id=abc-123' && linkSeguro('fiscal-reforma.html#regra-X') === 'fiscal-reforma.html#regra-X' && !linkDeFora('mei.html'));
chk('javascript:, data:, // e outros esquemas: fora', ['javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'data:text/html,x', '//exemplo.com', 'ftp://exemplo.com', 'mailto:a@b.c', 'vbscript:x'].every(u => linkSeguro(u) === ''));
chk('voltar pasta, barra na frente, espaço, aspas e sinal de menor: fora', ['../segredo.html', '/mei.html', 'a b.html', 'mei.html"onclick="x', "mei.html'", '<x>.html', 'mei.htm', 'mei.html?x=<y>', 'pasta/../mei.html'].every(u => linkSeguro(u) === ''));
chk('endereço com usuário e senha, sem host ou longo demais: fora', linkSeguro('https://usuario:senha@exemplo.com') === '' && linkSeguro('https://') === '' && linkSeguro('https://exemplo.com/' + 'a'.repeat(600)) === '');
chk('vazio e nulo', linkSeguro('') === '' && linkSeguro(null) === '' && linkSeguro(undefined) === '');

console.log('Dinheiro, datas e o endereço curto:');
chk('1.234,56', fmtDinheiro(1234.56) === '1.234,56' && fmtDinheiro(97) === '97,00' && fmtDinheiro(null) === '0,00' && fmtDinheiro('97.5') === '97,50');
chk('ler o que a pessoa digita', lerDinheiro('97') === 97 && lerDinheiro('97,5') === 97.5 && lerDinheiro('1.234,56') === 1234.56 && lerDinheiro('R$ 1.234') === 1234 && lerDinheiro('97.50') === 97.5 && lerDinheiro(' 0 ') === 0 && lerDinheiro(12.345) === 12.35);
chk('ilegível, vazio e negativo: null', lerDinheiro('abc') === null && lerDinheiro('') === null && lerDinheiro(null) === null && lerDinheiro('-5') === null && lerDinheiro('1,2,3') === null && lerDinheiro(-1) === null && lerDinheiro('97,123') === null);
chk('o preço do cartão', textoDoPreco(servico()) === 'R$ 97,00' && textoDoPreco(servico({ preco: null })) === 'Preço a definir' && textoDoPreco(servico({ modelo: 'gratis', preco: null })) === 'Grátis');
chk('o dia em Brasília de um instante', diaEmBrasilia('2026-12-01T02:30:00Z') === '2026-11-30' && diaEmBrasilia('2026-12-01T03:00:00Z') === '2026-12-01' && diaEmBrasilia('2026-11-15T12:00:00-03:00') === '2026-11-15'
  && diaEmBrasilia('2026-11-15T23:10:11.123456+00:00') === '2026-11-15' && diaEmBrasilia(new Date('2026-11-15T10:00:00Z')) === '2026-11-15');
chk('o dia já pronto fica, o inválido é null', diaEmBrasilia('2026-11-15') === '2026-11-15' && diaEmBrasilia('2026-02-30') === null && diaEmBrasilia('lixo') === null && diaEmBrasilia(null) === null && diaEmBrasilia('') === null);
chk('dd/mm/aaaa, o mês e o rótulo do mês', fmtData('2026-12-01T02:30:00Z') === '30/11/2026' && fmtData(null) === '' && mesDe('2026-12-01T02:30:00Z') === '2026-11' && rotuloDoMes('2026-11') === 'nov/26' && rotuloDoMes('x') === '');
chk('o instante de um dia escolhido: hoje, agora; outro dia, o meio-dia de Brasília', instanteDoDia(HOJE, HOJE, new Date('2026-11-15T18:20:00Z')) === '2026-11-15T18:20:00.000Z' && instanteDoDia('2026-11-14', HOJE) === '2026-11-14T12:00:00-03:00'
  && diaEmBrasilia(instanteDoDia('2026-11-14', HOJE)) === '2026-11-14');
chk('o endereço curto sai do nome', slugDe('Cadastro de produtos 2027 (RS)') === 'cadastro-de-produtos-2027-rs' && slugDe('  Abertura de MEI!  ') === 'abertura-de-mei' && slugDe('Régua & Ação') === 'regua-acao' && slugDe('') === '');
chk('e nunca passa de 60 nem termina em hífen', slugDe('a'.repeat(59) + ' b c').length <= 60 && !slugDe('a'.repeat(59) + ' b c').endsWith('-'));
chk('o formato do endereço curto', slugValido('cadastro-2027') && slugValido('a') && !slugValido('Cadastro') && !slugValido('a--b') && !slugValido('-a') && !slugValido('a-') && !slugValido('a b') && !slugValido('') && !slugValido('a'.repeat(61)));

console.log('A ficha do serviço:');
{
  const r = conferirServico({ nome: '  Cadastro   de produtos  ', preco: '97,00', preco_obs: ' por loja ', modelo: 'pago', situacao: 'preparo', janela_ate: '2026-12-31', link_prototipo: 'https://exemplo.com/p',
    regua: { pode_vender: { estado: 'ok', nota: '' } }, ordem: '3', motivo: 'sobra' }, { novo: true });
  chk('a ficha boa passa, com o endereço curto tirado do nome', r.ok && r.valor.slug === 'cadastro-de-produtos' && r.valor.nome === 'Cadastro de produtos' && r.valor.preco === 97 && r.valor.preco_obs === 'por loja' && r.valor.ordem === 3, r);
  chk('o motivo só fica onde a situação pede', r.valor.motivo === null && r.valor.janela_ate === '2026-12-31' && r.valor.parar_em === null && r.valor.link_pagina === null);
  chk('sem nome e com endereço curto ruim', !conferirServico({ nome: ' ' }, { novo: true }).ok && 'nome' in conferirServico({ nome: ' ' }, { novo: true }).erros && 'slug' in conferirServico({ nome: 'X', slug: 'Com Espaço' }).erros);
  chk('editando, o endereço curto não é inventado', 'slug' in conferirServico({ nome: 'X' }).erros && conferirServico({ nome: 'X', slug: 'x' }).ok);
  chk('preço ilegível', 'preco' in conferirServico({ nome: 'X', slug: 'x', preco: 'noventa' }).erros && conferirServico({ nome: 'X', slug: 'x', preco: '' }).valor.preco === null);
  const g = conferirServico({ nome: 'X', slug: 'x', modelo: 'gratis', preco: '97', preco_obs: 'por mês' });
  chk('o grátis fica sem preço e sem o "como se cobra"', g.ok && g.valor.preco === null && g.valor.preco_obs === null && g.valor.modelo === 'gratis');
  chk('pausar, encerrar e descartar pedem o motivo', ['pausado', 'encerrado', 'descartado'].every(sit => 'motivo' in conferirServico({ nome: 'X', slug: 'x', situacao: sit }).erros)
    && conferirServico({ nome: 'X', slug: 'x', situacao: 'pausado', motivo: ' esperando ' }).valor.motivo === 'esperando');
  chk('endereço que não é seguro não grava', 'link_pagina' in conferirServico({ nome: 'X', slug: 'x', link_pagina: 'javascript:alert(1)' }).erros && 'link_prototipo' in conferirServico({ nome: 'X', slug: 'x', link_prototipo: 'exemplo.com' }).erros);
  chk('data inválida', 'janela_ate' in conferirServico({ nome: 'X', slug: 'x', janela_ate: '2026-02-30' }).erros && 'parar_em' in conferirServico({ nome: 'X', slug: 'x', parar_em: '31/12/2026' }).erros);
  chk('texto longo demais', 'resumo' in conferirServico({ nome: 'X', slug: 'x', resumo: 'a'.repeat(801) }).erros && 'nome' in conferirServico({ nome: 'a'.repeat(121), slug: 'x' }).erros);
  chk('o "não" e o "não se aplica" pedem o porquê na nota', 'regua.carteira' in conferirServico({ nome: 'X', slug: 'x', regua: { carteira: { estado: 'nao', nota: '' } } }).erros
    && 'regua.testado' in conferirServico({ nome: 'X', slug: 'x', regua: { testado: { estado: 'na', nota: ' ' } } }).erros
    && conferirServico({ nome: 'X', slug: 'x', regua: { testado: { estado: 'na', nota: 'sem regra' } } }).ok);
  chk('no grátis, item só da venda paga não pede nota', conferirServico({ nome: 'X', slug: 'x', modelo: 'gratis', regua: { pix: { estado: 'nao', nota: '' } } }).ok);
  const ar = conferirServico({ nome: 'X', slug: 'x', situacao: 'no_ar', preco: '97', regua: { pode_vender: { estado: 'ok', nota: '' } } });
  chk('no ar sem a régua fechada não passa, e diz o que falta', !ar.ok && ar.erros.situacao.startsWith('Ainda não pode ir pro ar. Falta: Pode cobrar por ele · ') && ar.erros.situacao.includes('Quem assina'), ar.erros);
  const ok = conferirServico({ nome: 'X', slug: 'x', situacao: 'no_ar', preco: '97', quem_assina: 'Escritório', link_pagina: 'https://exemplo.com', regua: todos('ok') });
  chk('no ar com tudo em dia passa', ok.ok && ok.valor.situacao === 'no_ar', ok.erros);
  chk('situação desconhecida vira ideia, ordem ruim vira zero', conferirServico({ nome: 'X', slug: 'x', situacao: 'voando', ordem: 'abc' }).valor.situacao === 'ideia' && conferirServico({ nome: 'X', slug: 'x', ordem: 'abc' }).valor.ordem === 0);
}

console.log('A venda digitada:');
{
  const servs = [servico({ situacao: 'no_ar', no_ar_desde: '2026-11-01T12:00:00Z' }), servico({ id: 's2', situacao: 'preparo' }), servico({ id: 's3', modelo: 'gratis', preco: null, situacao: 'no_ar' }),
    servico({ id: 's4', situacao: 'pausado', motivo: 'x', no_ar_desde: '2026-10-01T12:00:00Z' }), servico({ id: 's5', situacao: 'pausado', motivo: 'x' })];
  chk('vende o pago que está no ar ou que já esteve', igual(servs.map(aceitaVenda), [true, false, false, true, false]) && !aceitaVenda(null));
  const r = conferirVenda({ servico_id: 's1', comprador_nome: '  Loja   Exemplo ', comprador_documento: '11.222.333/0001-81', comprador_email: ' loja@exemplo.com.br ', comprador_whatsapp: '(51) 99999-8888', comprador_cidade: 'Três Coroas', comprador_uf: 'rs', valor: '97,00', observacao: ' ' }, { servicos: servs });
  chk('a venda boa passa: documento sem pontuação, WhatsApp com o 55, UF maiúscula', r.ok && igual(r.valor, { servico_id: 's1', comprador_nome: 'Loja Exemplo', comprador_documento: CNPJ, comprador_email: 'loja@exemplo.com.br', comprador_whatsapp: '5551999998888',
    comprador_cidade: 'Três Coroas', comprador_uf: 'RS', valor: 97, observacao: null }), r);
  chk('CPF vale, e o documento é opcional', conferirVenda({ servico_id: 's1', comprador_nome: 'Fulano', comprador_documento: '529.982.247-25', valor: '50' }).valor.comprador_documento === CPF && conferirVenda({ servico_id: 's1', comprador_nome: 'Fulano', valor: '50' }).ok);
  chk('CPF e CNPJ com dígito errado, e documento ilegível', ['529.982.247-26', '11.222.333/0001-82', 'abc', '123'].every(d => 'comprador_documento' in conferirVenda({ servico_id: 's1', comprador_nome: 'F', comprador_documento: d, valor: '1' }).erros));
  chk('o dígito do CPF', cpfValido(CPF) && cpfValido('529.982.247-25') && !cpfValido('11111111111') && !cpfValido('52998224724') && !cpfValido('') && !cpfValido(null));
  chk('sem serviço, serviço que não existe e serviço que não está no ar', 'servico_id' in conferirVenda({ comprador_nome: 'F', valor: '1' }, { servicos: servs }).erros && 'servico_id' in conferirVenda({ servico_id: 'zz', comprador_nome: 'F', valor: '1' }, { servicos: servs }).erros
    && 'servico_id' in conferirVenda({ servico_id: 's2', comprador_nome: 'F', valor: '1' }, { servicos: servs }).erros && 'servico_id' in conferirVenda({ servico_id: 's3', comprador_nome: 'F', valor: '1' }, { servicos: servs }).erros);
  chk('sem nome, sem valor, e-mail e WhatsApp ruins, UF que não existe', igual(Object.keys(conferirVenda({ servico_id: 's1', comprador_nome: ' ', valor: '', comprador_email: 'sem-arroba', comprador_whatsapp: '9999', comprador_uf: 'XX' }).erros).sort(),
    ['comprador_email', 'comprador_nome', 'comprador_uf', 'comprador_whatsapp', 'valor']));
  chk('valor zero vale (cortesia), negativo não', conferirVenda({ servico_id: 's1', comprador_nome: 'F', valor: '0' }).ok && 'valor' in conferirVenda({ servico_id: 's1', comprador_nome: 'F', valor: '-1' }).erros);
  chk('WhatsApp já com o 55 fica', conferirVenda({ servico_id: 's1', comprador_nome: 'F', valor: '1', comprador_whatsapp: '+55 51 3546-1385' }).valor.comprador_whatsapp === '555135461385');
}

console.log('O que falta em cada venda:');
chk('aguardando: confirmar o pagamento', igual(pendenciasDaVenda(venda()), [{ chave: 'pagamento', texto: 'Confirmar o pagamento' }]));
chk('paga: entregar e emitir a NFS-e', igual(pendenciasDaVenda(venda({ pagamento: 'pago' })).map(p => p.chave), ['entrega', 'nfse']));
chk('paga e entregue: só a nota; com a nota: nada', igual(pendenciasDaVenda(venda({ pagamento: 'pago', entregue_em: '2026-11-11T12:00:00Z' })).map(p => p.chave), ['nfse'])
  && pendenciasDaVenda(venda({ pagamento: 'pago', entregue_em: '2026-11-11T12:00:00Z', nfse_numero: '123' })).length === 0);
chk('cortesia (valor zero) não tem nota', igual(pendenciasDaVenda(venda({ pagamento: 'pago', valor: 0 })).map(p => p.chave), ['entrega']));
chk('devolvida e cancelada: nada', pendenciasDaVenda(venda({ pagamento: 'devolvido' })).length === 0 && pendenciasDaVenda(venda({ pagamento: 'cancelado' })).length === 0 && pendenciasDaVenda(null).length === 0);

console.log('O arrependimento (CDC, art. 49):');
{
  const paga = venda({ pagamento: 'pago', pago_em: '2026-11-10T15:00:00Z', entregue_em: '2026-11-10T16:00:00Z' });
  chk('7 dias da compra, quando a entrega foi no mesmo dia', arrependimentoAte(paga) === '2026-11-17');
  chk('dentro até o 7º dia, fora no 8º', dentroDoArrependimento(paga, '2026-11-17') && !dentroDoArrependimento(paga, '2026-11-18') && textoDoArrependimento(paga, '2026-11-15') === 'Dentro do prazo de arrependimento até 17/11/2026.' && textoDoArrependimento(paga, '2026-11-18') === '');
  const depois = venda({ pagamento: 'pago', pago_em: '2026-11-10T15:00:00Z', entregue_em: '2026-11-14T15:00:00Z' });
  chk('entrega depois da compra: os 7 dias contam do recebimento', arrependimentoAte(depois) === '2026-11-21' && dentroDoArrependimento(depois, '2026-11-21'));
  const semEntrega = venda({ pagamento: 'pago', pago_em: '2026-10-01T15:00:00Z' });
  chk('sem entrega, segue dentro (o prazo nem começou do recebimento)', dentroDoArrependimento(semEntrega, HOJE) && textoDoArrependimento(semEntrega, HOJE) === 'Arrependimento: os 7 dias contam da entrega.');
  chk('o aceite dos termos vale como o dia da compra', arrependimentoAte(venda({ termos_aceitos_em: '2026-11-08T23:00:00-03:00', pago_em: '2026-11-10T15:00:00Z' })) === '2026-11-15');
  chk('o dia é o de Brasília', arrependimentoAte(venda({ pagamento: 'pago', pago_em: '2026-11-11T01:00:00Z' })) === '2026-11-17');
  chk('aguardando, devolvida e cancelada não têm prazo correndo', !dentroDoArrependimento(venda(), HOJE) && !dentroDoArrependimento(venda({ pagamento: 'devolvido', pago_em: '2026-11-14T15:00:00Z' }), HOJE) && textoDoArrependimento(venda({ pagamento: 'cancelado' }), HOJE) === '');
}

const SERVS = [servico({ id: 'a', slug: 'a', nome: 'Alfa', situacao: 'no_ar', ordem: 2, regua: todos('ok'), parar_em: '2027-01-31' }), servico({ id: 'b', slug: 'b', nome: 'Beta', situacao: 'preparo', ordem: 1 }), servico({ id: 'c', slug: 'c', nome: 'Árvore', situacao: 'ideia' }),
  servico({ id: 'd', slug: 'd', nome: 'Delta', situacao: 'descartado', motivo: 'não pode' }), servico({ id: 'e', slug: 'e', nome: 'Eco', situacao: 'estudo' }), servico({ id: 'f', slug: 'f', nome: 'Abacate', situacao: 'ideia' }),
  servico({ id: 'g', slug: 'g', nome: 'Gama', situacao: 'pausado', motivo: 'x' })];
const VENDAS = [
  venda({ id: 'v1', numero: 1, servico_id: 'a', pagamento: 'pago', pago_em: '2026-10-05T15:00:00Z', valor: 97, entregue_em: '2026-10-05T16:00:00Z', nfse_numero: '10' }),
  venda({ id: 'v2', numero: 2, servico_id: 'a', pagamento: 'pago', pago_em: '2026-11-03T15:00:00Z', valor: 97.1 }),
  venda({ id: 'v3', numero: 3, servico_id: 'a', pagamento: 'pago', pago_em: '2026-11-04T15:00:00Z', valor: 0.2, entregue_em: '2026-11-04T16:00:00Z' }),
  venda({ id: 'v4', numero: 4, servico_id: 'a', pagamento: 'devolvido', pago_em: '2026-11-05T15:00:00Z', valor: 97 }),
  venda({ id: 'v5', numero: 5, servico_id: 'a', pagamento: 'aguardando', valor: 97 }),
  venda({ id: 'v6', numero: 6, servico_id: 'g', pagamento: 'pago', pago_em: '2026-12-01T02:00:00Z', valor: 50, entregue_em: '2026-12-01T02:10:00Z', nfse_numero: '11' }),
  venda({ id: 'v7', numero: 7, servico_id: 'g', pagamento: 'cancelado', valor: 50 })
];

console.log('As contas:');
{
  const c = contasPorServico(VENDAS);
  chk('por serviço: pagas, receita sem erro de centavo, aguardando, devolvidas, com pendência', igual(c.get('a'), { pagas: 3, aguardando: 1, devolvidas: 1, canceladas: 0, pendentes: 3, receita: 194.3 }), c.get('a'));
  chk('o outro serviço', igual(c.get('g'), { pagas: 1, aguardando: 0, devolvidas: 0, canceladas: 1, pendentes: 0, receita: 50 }) && !c.has('b'));
  const r = resumoDaVitrine(SERVS, VENDAS);
  chk('o retrato da vitrine', r.total === 7 && r.noAr === 1 && r.emPreparo === 1 && r.porSituacao.ideia === 2 && r.porSituacao.descartado === 1 && r.vendasPagas === 4 && r.receita === 244.3 && r.aguardando === 1 && r.comPendencia === 3 && r.selo === '1 no ar', r);
  chk('o selo do card: "N no ar" ou, sem nenhum, "N em preparo"', seloDoCard(SERVS) === '1 no ar' && seloDoCard(SERVS.filter(s => s.situacao !== 'no_ar')) === '1 em preparo' && seloDoCard([]) === '0 em preparo' && seloDoCard(null) === '0 em preparo');
  const secoes = secoesDaVitrine(SERVS);
  chk('as seções na ordem, a última recolhida', igual(secoes.map(s => s.id), ['no_ar', 'preparo', 'estudo', 'ideia', 'fora']) && igual(secoes.map(s => s.recolhida), [false, false, false, false, true]));
  chk('dentro da seção: pela ordem e depois pelo nome (com acento)', igual(secoes[3].itens.map(s => s.nome), ['Abacate', 'Árvore']) && igual(secoes[4].itens.map(s => s.nome), ['Delta', 'Gama']));
  chk('ordem menor vem primeiro', igual(secoesDaVitrine([servico({ nome: 'Z', situacao: 'ideia', ordem: 1 }), servico({ nome: 'A', situacao: 'ideia', ordem: 5 })])[3].itens.map(s => s.nome), ['Z', 'A']));
}

console.log('Os números por mês:');
{
  const n = numerosPorMes(SERVS, VENDAS, { hoje: HOJE });
  chk('os meses seguidos, do primeiro pagamento ao último (pelo dia de Brasília)', igual(n.meses, ['2026-10', '2026-11']), n.meses);
  const a = n.linhas.find(l => l.servico_id === 'a'), g = n.linhas.find(l => l.servico_id === 'g');
  chk('a venda paga às 23h de 30/11 em Brasília é de novembro', igual(g.porMes['2026-11'], { vendas: 1, receita: 50, devolvidas: 0 }) && igual(g.porMes['2026-10'], { vendas: 0, receita: 0, devolvidas: 0 }));
  chk('a devolvida não conta na venda nem na receita, só como devolvida', igual(a.porMes['2026-11'], { vendas: 2, receita: 97.3, devolvidas: 1 }) && igual(a.total, { vendas: 3, receita: 194.3, devolvidas: 1 }));
  chk('os totais de cada mês e o geral', igual(n.totais.porMes['2026-10'], { vendas: 1, receita: 97, devolvidas: 0 }) && igual(n.totais.porMes['2026-11'], { vendas: 3, receita: 147.3, devolvidas: 1 }) && igual(n.totais.total, { vendas: 4, receita: 244.3, devolvidas: 1 }), n.totais);
  chk('quem vendeu mais vem primeiro, com o nome do serviço', igual(n.linhas.map(l => l.nome), ['Alfa', 'Gama']) && n.antes === null);
  const corte = numerosPorMes(SERVS, VENDAS, { hoje: HOJE, maxMeses: 1 });
  chk('com o corte de meses, o de antes vai à parte', igual(corte.meses, ['2026-11']) && igual(corte.antes, { vendas: 1, receita: 97, devolvidas: 0 }) && corte.totais.total.vendas === 3);
  chk('o mês de hoje entra mesmo sem venda nele', igual(numerosPorMes(SERVS, [VENDAS[0]], { hoje: '2026-12-10' }).meses, ['2026-10', '2026-11', '2026-12']));
  chk('sem venda paga: vazio', igual(numerosPorMes(SERVS, [VENDAS[4], VENDAS[6]], { hoje: HOJE }), { meses: [], linhas: [], totais: { porMes: {}, total: { vendas: 0, receita: 0, devolvidas: 0 } }, antes: null }));
  chk('venda de serviço que saiu da lista não some', numerosPorMes([], [VENDAS[0]], { hoje: HOJE }).linhas[0].nome === 'Serviço fora da lista');
}

console.log('O teste de parar:');
{
  const alfa = SERVS[0];
  const t = testeDeParar(alfa, VENDAS, HOJE);
  chk('no prazo: a data, os dias, o critério e o que vendeu até aqui', t.estado === 'no_prazo' && t.dias === 77 && t.vendas === 3 && t.receita === 194.3 && t.texto === 'Reavaliar em 31/01/2027 (77 dias) · até aqui, 3 vendas, R$ 194,30.', t);
  const chegou = testeDeParar({ ...alfa, parar_em: '2026-11-15', parar_criterio: 'menos de 5, encerra' }, VENDAS, HOJE);
  chk('chegou a data: pede a decisão', chegou.estado === 'chegou' && chegou.texto === 'Chegou a data de reavaliar (15/11/2026): menos de 5, encerra · vendeu 3 vendas, R$ 194,30. Decida: segue, pausa ou encerra.', chegou.texto);
  chk('sem data: avisa', testeDeParar({ ...alfa, parar_em: null }, VENDAS, HOJE).estado === 'sem');
  chk('fora do ar não tem teste', testeDeParar(SERVS[1], VENDAS, HOJE).estado === 'fora' && testeDeParar(null, [], HOJE).estado === 'fora');
  chk('o grátis sem data fica de fora, com data é testado', testeDeParar({ ...alfa, modelo: 'gratis', parar_em: null }, [], HOJE).estado === 'fora' && testeDeParar({ ...alfa, modelo: 'gratis' }, [], HOJE).texto === 'Reavaliar em 31/01/2027 (77 dias).');
}

console.log('Por onde começar:');
{
  const g = guiaDoComeco(SERVS, VENDAS, HOJE);
  chk('as vendas com pendência primeiro, depois o que está em preparo e em estudo', igual(g.map(p => p.tipo), ['vendas', 'preparo', 'estudo']), g);
  chk('a frase das vendas conta cada pendência', g[0].texto === 'Vendas: 1 esperando o pagamento, 1 paga sem entrega, 2 pagas sem NFS-e.' && g[0].aba === 'vendas', g[0].texto);
  chk('o serviço em preparo com o que falta, levando à ficha', g[1].texto === 'Beta: Faltam 14 itens da régua. O próximo: O escritório pode vender este serviço.' && g[1].servico === 'b');
  const alerta = guiaDoComeco([{ ...SERVS[0], parar_em: null }], [], HOJE);
  chk('o serviço no ar que pede atenção vem na frente, como alerta', alerta[0].tipo === 'alerta' && alerta[0].texto.startsWith('Alfa: Sem data de reavaliar'));
  chk('só ideias: manda escolher uma', igual(guiaDoComeco([SERVS[2], SERVS[5]], [], HOJE), [{ tipo: 'vazio', texto: 'Nada em preparo. Escolha uma das 2 ideias e passe pra "Em estudo".' }]));
  chk('vitrine vazia: manda cadastrar a primeira ideia', guiaDoComeco([], [], HOJE)[0].texto === 'Comece cadastrando a primeira ideia em "+ Novo serviço".');
  chk('tudo no ar e em dia', guiaDoComeco([SERVS[0]], [], HOJE)[0].texto === 'Tudo em dia. Tem ideia nova? Cadastre em "+ Novo serviço".');
}

console.log('A tarefa das NFS-e:');
{
  const v = venda({ numero: 12, pagamento: 'pago', pago_em: '2026-11-15T15:00:00Z' }), s = { nome: 'Cadastro de produtos 2027 (RS)' };
  const linha = linhaDaNota(v, s);
  chk('a linha da venda', linha === '☐ Venda nº 12 · Cadastro de produtos 2027 (RS) · LOJA EXEMPLO LTDA (11.222.333/0001-81) · R$ 97,00 · paga em 15/11/2026', linha);
  chk('sem documento, e com o nome em mais de uma linha', linhaDaNota({ ...v, comprador_documento: null, comprador_nome: 'Fulano\n de  Tal' }, s) === '☐ Venda nº 12 · Cadastro de produtos 2027 (RS) · Fulano de Tal · R$ 97,00 · paga em 15/11/2026');
  chk('o título fixo e a descrição da tarefa nova', TITULO_TAREFA_NOTAS === 'Emitir as NFS-e dos serviços digitais' && descricaoDaTarefaNotas([linha]) === INTRO_TAREFA_NOTAS + '\n' + linha);
  const d1 = descricaoDaTarefaNotas([linha]);
  chk('a tarefa sabe se a venda já está nela (pelo número inteiro)', temVendaNaTarefa(d1, 12) && !temVendaNaTarefa(d1, 1) && !temVendaNaTarefa(d1, 120) && !temVendaNaTarefa('', 12) && !temVendaNaTarefa(null, 12));
  const outra = linhaDaNota({ ...v, numero: 13, comprador_nome: 'OUTRA LOJA' }, s);
  const j = juntarNaTarefaNotas(d1 + '\n\n', outra, 13);
  chk('a venda nova entra no fim, uma vez só', j.entrou && j.descricao === d1 + '\n' + outra && !juntarNaTarefaNotas(j.descricao, outra, 13).entrou && juntarNaTarefaNotas(j.descricao, outra, 13).descricao === j.descricao);
  chk('na descrição vazia, entra sozinha', igual(juntarNaTarefaNotas('', outra, 13), { descricao: outra, entrou: true }));
  const m = marcarNotaNaTarefa(j.descricao, 12, ' 2026/45 ');
  chk('a nota informada marca só a linha da venda, com o número da nota', m.marcou && m.descricao === INTRO_TAREFA_NOTAS + '\n' + '☑' + linha.slice(1) + ' · NFS-e 2026/45' + '\n' + outra, m.descricao);
  chk('marcar de novo não muda nada, e venda que não está na lista também não', !marcarNotaNaTarefa(m.descricao, 12, '9').marcou && !marcarNotaNaTarefa(m.descricao, 99, '9').marcou);
  const des = desmarcarNotaNaTarefa(m.descricao, 12);
  chk('o desfazer da nota devolve a linha como era', des.desmarcou && des.descricao === j.descricao && !desmarcarNotaNaTarefa(des.descricao, 12).desmarcou);
  const t = tirarDaTarefaNotas(j.descricao, 13);
  chk('o desfazer do pagamento tira a linha ainda aberta', t.tirou && t.descricao === d1 && t.sobram === 1);
  chk('a linha já marcada não sai', !tirarDaTarefaNotas(m.descricao, 12).tirou && tirarDaTarefaNotas(m.descricao, 12).sobram === 2);
  chk('tirando a única, não sobra nenhuma', igual(tirarDaTarefaNotas(d1, 12), { descricao: INTRO_TAREFA_NOTAS, tirou: true, sobram: 0 }));
  chk('o prazo é o próximo dia útil depois de hoje', prazoDaTarefaNotas('2026-11-12') === '2026-11-13' && prazoDaTarefaNotas('2026-11-13') === '2026-11-16' && prazoDaTarefaNotas('2026-11-15') === '2026-11-16');
  chk('pulando o feriado', prazoDaTarefaNotas('2026-12-24') === '2026-12-28' && prazoDaTarefaNotas('2026-12-31') === '2027-01-04');
}

console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
