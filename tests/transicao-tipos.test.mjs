// Os tipos da transição (assets/js/transicao-tipos.js, 12/11/2026, pedido do Samuel: a saída com as categorias dela e uma
// cor por tipo): a contagem, as etapas da saída, o que ainda está ligado no escritório e a lista em seções. Dados
// inventados. Rodar com: node tests/transicao-tipos.test.mjs
import { TIPOS, DIAS_DO_AVISO, rotuloDoTipo, classeDoTipo, previsaoDoTipo, prazoDaTransicao, ETAPAS_SAIDA, etapaDaSaida, faseDaSaida,
  fasesDoTipo, encerramentoDaSaida, secoesDaLista, diasEntre, somarDias, juntar } from '../assets/js/transicao-tipos.js';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); };

console.log('Os tipos e as datas:');
chk('a entrada e o CNPJ novo, 90 dias; a saída, os 30 do aviso prévio', TIPOS.entrada.dias === 90 && TIPOS.cnpj_novo.dias === 90 && TIPOS.saida.dias === 30 && DIAS_DO_AVISO === 30);
chk('a previsão: o início mais os dias do tipo (a mesma conta de antes na entrada)', previsaoDoTipo('entrada', '2026-09-30') === '2026-12-29' && previsaoDoTipo('saida', '2026-11-01') === '2026-12-01'
  && previsaoDoTipo('cnpj_novo', '2026-10-01') === '2026-12-30', [previsaoDoTipo('entrada', '2026-09-30'), previsaoDoTipo('saida', '2026-11-01')]);
chk('tipo que não existe conta como entrada', previsaoDoTipo('outra coisa', '2026-01-01') === '2026-04-01' && classeDoTipo('xyz') === 'tipo-entrada');
chk('o rótulo e a classe da cor', rotuloDoTipo('saida') === 'Saída' && rotuloDoTipo('cnpj_novo') === 'CNPJ novo' && classeDoTipo('saida') === 'tipo-saida' && classeDoTipo('cnpj_novo') === 'tipo-cnpj_novo'
  && rotuloDoTipo('estranho') === 'estranho' && rotuloDoTipo(null) === 'Transição');
chk('dias entre datas e somar dias, na virada do ano e do horário de verão', diasEntre('2026-12-31', '2027-01-01') === 1 && diasEntre('2026-11-12', '2026-11-01') === -11
  && somarDias('2026-02-28', 1) === '2026-03-01' && somarDias('2028-02-28', 1) === '2028-02-29');
chk('juntar com vírgula e "e"', juntar(['a']) === 'a' && juntar(['a', 'b']) === 'a e b' && juntar(['a', 'b', 'c']) === 'a, b e c' && juntar([]) === '' && juntar(null) === '');

console.log('\nA contagem da entrada (dia X de 90):');
const ARSENAL = { tipo: 'entrada', inicio: '2026-07-28', previsao_fim: '2026-10-26', status: 'em_andamento' };
let p = prazoDaTransicao({ tipo: 'entrada', inicio: '2026-09-30', previsao_fim: '2026-12-29', status: 'em_andamento' }, '2026-11-12');
chk('no prazo: "dia 44 de 90", sem alerta', p.cartao === 'dia 44 de 90' && p.grande === 'Dia 44' && p.pequeno === 'de 90' && p.linha === 'previsão de conclusão: 29/12/2026' && !p.alerta, p);
p = prazoDaTransicao(ARSENAL, '2026-11-12');
chk('passou da previsão: o dia e quanto passou, com alerta', p.cartao === 'dia 108 de 90 · 17 dias além da previsão' && p.linha === 'a previsão era 26/10/2026 · passou 17 dias' && p.alerta && p.passou, p.cartao);
p = prazoDaTransicao({ ...ARSENAL, previsao_fim: '2026-11-11' }, '2026-11-12');
chk('um dia além: no singular', p.cartao.endsWith('· 1 dia além da previsão'), p.cartao);
p = prazoDaTransicao({ tipo: 'entrada', inicio: '2026-11-12', previsao_fim: null, status: 'em_andamento' }, '2026-11-12');
chk('sem previsão gravada: a do tipo (90 dias)', p.cartao === 'dia 1 de 90' && p.fim === '2027-02-10', p);
p = prazoDaTransicao({ tipo: 'entrada', inicio: '2026-11-20', previsao_fim: '2027-02-18', status: 'em_andamento' }, '2026-11-12');
chk('o início no futuro: dia 1', p.dia === 1 && p.cartao === 'dia 1 de 90', p.cartao);
p = prazoDaTransicao({ ...ARSENAL, status: 'concluida', concluida_em: '2026-11-05T14:00:00Z' }, '2026-11-12');
chk('concluída: a bandeira e o dia', p.concluida && p.cartao === '🏁 concluída em 05/11' && p.grande === '🏁' && p.linha === 'concluída em 05/11/2026' && !p.alerta && !p.passou, p);

console.log('\nA contagem da saída (o fim do aviso):');
const JGS = { tipo: 'saida', inicio: '2026-11-01', previsao_fim: '2026-12-01', status: 'em_andamento' };
p = prazoDaTransicao(JGS, '2026-11-12');
chk('faltam 19 dias pro fim do aviso', p.saida && p.cartao === 'aviso até 01/12 · faltam 19 dias' && p.grande === 'Faltam 19 dias' && p.pequeno === '' && p.linha === 'pro fim do aviso, em 01/12/2026' && !p.alerta, p);
p = prazoDaTransicao(JGS, '2026-11-30');
chk('falta 1 dia, no singular', p.cartao === 'aviso até 01/12 · falta 1 dia' && p.grande === 'Falta 1 dia', p.cartao);
p = prazoDaTransicao(JGS, '2026-12-01');
chk('termina hoje, com alerta', p.cartao === 'o aviso termina hoje' && p.grande === 'Termina hoje' && p.alerta, p);
p = prazoDaTransicao(JGS, '2026-12-04');
chk('terminou: há quantos dias, com alerta', p.cartao === 'o aviso terminou em 01/12' && p.grande === 'Aviso terminou' && p.linha === 'em 01/12/2026, há 3 dias' && p.alerta && p.passou, p);
p = prazoDaTransicao({ tipo: 'saida', inicio: '2026-11-01', previsao_fim: null, status: 'em_andamento' }, '2026-11-12');
chk('sem previsão gravada: os 30 dias do aviso', p.fim === '2026-12-01' && p.total === 30, p);
p = prazoDaTransicao({ ...JGS, previsao_fim: '2027-01-30' }, '2026-11-12');
chk('a previsão gravada vale (a que a ficha mudou no Editar)', p.fim === '2027-01-30' && p.cartao === 'aviso até 30/01 · faltam 79 dias', p.cartao);

console.log('\nAs etapas da saída:');
chk('três etapas, na ordem, cada uma com o setor da tarefa nova', ETAPAS_SAIDA.map(e => e.chave).join(',') === 'formalizar,entregar,encerrar' && ETAPAS_SAIDA.every(e => e.rotulo && e.dica && e.setor));
chk('as fases sugeridas: as etapas na saída, as de sempre na chegada', fasesDoTipo('saida').join('|') === 'Formalizar a saída|Entregar ao novo escritório|Encerrar no escritório'
  && fasesDoTipo('entrada').includes('Documentos e escritório anterior') && fasesDoTipo('cnpj_novo').length === 5);
// as tarefas da primeira saída (o kit de saída, com as fases da entrada que vinham dele, e três editadas pra "Primeiras entregas")
const T = (titulo, fase) => ({ titulo, fase });
const casos = [
  [T('Distrato de prestação de serviços', 'Primeiras entregas'), 'formalizar'],
  [T('Distrato de prestação de serviços', 'Fechamento e boas-vindas'), 'formalizar'],
  [T('Contratos sociais — enviar', 'Primeiras entregas'), 'entregar'],
  [T('Certificado digital e senha (se A1) — enviar', 'Primeiras entregas'), 'entregar'],
  [T('Balancete — enviar', 'Documentos e escritório anterior'), 'entregar'],
  [T('Documentos e acessos pro novo escritório', 'Documentos e escritório anterior'), 'entregar'],
  [T('Confirmar se a empresa tem funcionários', null), 'entregar'],
  [T('Alvarás de localização e sanitário (se houver) — enviar', null), 'entregar'],
  [T('Recibos ou lista de parcelamentos existentes/ativos — enviar', null), 'entregar'],
  [T('Encerrar o contrato no Conta Azul', null), 'encerrar'],
  [T('Desligar as obrigações fiscais', null), 'encerrar'],
  [T('Comunicar a saída ao cliente por escrito', null), 'formalizar'],
  [T('Aviso prévio: confirmar a data', null), 'formalizar'],
];
const errados = casos.filter(([t, e]) => etapaDaSaida(t) !== e).map(([t, e]) => t.titulo + ' → ' + etapaDaSaida(t) + ' (esperava ' + e + ')');
chk('sem a fase da saída, o título decide (as tarefas da primeira saída nos lugares certos)', !errados.length, errados);
chk('a fase gravada vale mais que o título', etapaDaSaida(T('Balancete — enviar', 'Encerrar no escritório')) === 'encerrar'
  && etapaDaSaida(T('Distrato de prestação de serviços', '  entregar ao NOVO escritorio ')) === 'entregar', etapaDaSaida(T('Distrato', '  entregar ao NOVO escritorio ')));
chk('a fase que o kit grava na saída é o rótulo da etapa', faseDaSaida(T('Distrato de prestação de serviços', 'Fechamento e boas-vindas')) === 'Formalizar a saída'
  && faseDaSaida(T('Razão — enviar', 'Documentos e escritório anterior')) === 'Entregar ao novo escritório');
chk('sem título nem fase: entregar', etapaDaSaida({}) === 'entregar' && etapaDaSaida(null) === 'entregar');

console.log('\nO que ainda está ligado no escritório (Encerrar no escritório):');
const EMP = [{ id: 'c1', nome: 'EMPRESA UM LTDA' }, { id: 'c2', nome: 'EMPRESA DOIS ME' }];
const tudoLigado = {
  empresas: EMP, fim: '2026-12-01', transicaoId: 'tr1',
  carteira: [{ cliente_id: 'c1', saida: null }, { cliente_id: 'c2', saida: null }],
  clientes: [{ id: 'c1', status: 'ativo' }, { id: 'c2', status: 'ativo' }],
  cobrancas: [{ cliente_id: 'c1', ativo: true, valor_base: 1007.25 }, { cliente_id: 'c2', ativo: true, valor_base: 450.5 }, { cliente_id: 'c9', ativo: true, valor_base: 99 }],
  obrigacoes: [{ cliente_id: 'c1', ativo: true, nome: 'DCTFWeb' }, { cliente_id: 'c1', ativo: true, nome: 'EFD-Contribuições' }, { cliente_id: 'c2', ativo: true, nome: 'DCTFWeb' }],
  recorrentes: [{ cliente_id: 'c1', ativo: true, setor: 'dp', titulo: 'Folha de pagamento' }, { cliente_id: 'c2', ativo: true, setor: 'dp', titulo: 'Pró-labore' },
    { cliente_id: 'c1', ativo: true, setor: 'contabil', titulo: 'Conciliação bancária', data_fim: '2026-11-30' }],
  tarefas: [{ cliente_id: 'c1', status: 'pendente', prazo: '2026-12-20', titulo: 'DCTFWeb de novembro' }, { cliente_id: 'c1', status: 'pendente', prazo: '2026-11-20', titulo: 'DAS de outubro' },
    { cliente_id: 'c2', status: 'concluida', prazo: '2026-12-22', titulo: 'Feita' }, { cliente_id: 'c1', status: 'pendente', prazo: '2026-12-15', titulo: 'Da transição', transicao_id: 'tr1' }],
  alvaras: [{ cliente_id: 'c1', tipo: 'Alvará de Funcionamento', vencimento: '2027-03-01' }],
  certificados: [{ cliente_id: 'c2', acompanhar: true, titular: 'EMPRESA DOIS ME', validade: '2027-05-10' }],
};
let it = encerramentoDaSaida(tudoLigado);
const de = c => it.find(i => i.chave === c) || {};
chk('as sete coisas, na ordem de desligar', it.map(i => i.chave).join(',') === 'carteira,cobranca,obrigacoes,recorrentes,tarefas,alvaras,certificados', it.map(i => i.chave));
chk('tudo ligado', it.every(i => i.ligado === true), it.filter(i => i.ligado !== true).map(i => i.chave));
chk('a carteira: sem a data de saída, e o porquê de registrar depois do último boleto', de('carteira').texto.startsWith('Sem a data de saída na Carteira.') && /depois de gerar o boleto do último mês/.test(de('carteira').texto)
  && de('carteira').link === 'comercial-carteira.html', de('carteira').texto);
chk('a cobrança: as bases das duas, sem a de outra empresa, e o lembrete do Conta Azul', de('cobranca').texto.includes('EMPRESA UM LTDA, R$ 1.007,25; EMPRESA DOIS ME, R$ 450,50') && !de('cobranca').texto.includes('99,00')
  && de('cobranca').texto.includes('Conta Azul'), de('cobranca').texto);
chk('as obrigações: quantas, de quem e quais, sem repetir o nome', de('obrigacoes').texto.startsWith('3 obrigações ligadas (EMPRESA UM LTDA e EMPRESA DOIS ME): DCTFWeb e EFD-Contribuições.'), de('obrigacoes').texto);
chk('as recorrentes: a que termina antes do fim do aviso fica de fora, e o link vai pro setor com mais', de('recorrentes').texto.startsWith('2 tarefas recorrentes ativas') && de('recorrentes').texto.includes('DP: Folha de pagamento e Pró-labore')
  && !de('recorrentes').texto.includes('Conciliação') && de('recorrentes').link === 'dp-tarefas.html?aba=recorrentes' && de('recorrentes').rotuloLink === 'Abrir as recorrentes do DP', de('recorrentes'));
chk('as tarefas: só as abertas, com prazo depois do fim do aviso e fora desta transição', de('tarefas').texto.startsWith('1 tarefa aberta com prazo depois de 01/12/2026: DCTFWeb de novembro (20/12/2026).'), de('tarefas').texto);
chk('os alvarás e os certificados', de('alvaras').texto.startsWith('1 alvará no controle (EMPRESA UM LTDA): Alvará de Funcionamento, vence 01/03/2027.')
  && de('certificados').texto.startsWith('1 certificado acompanhado: EMPRESA DOIS ME, vence 10/05/2027.'), [de('alvaras').texto, de('certificados').texto]);

const nadaLigado = { ...tudoLigado, carteira: [{ cliente_id: 'c1', saida: '2026-12-01' }, { cliente_id: 'c2', saida: '2026-12-01' }], clientes: [{ id: 'c1', status: 'inativo' }, { id: 'c2', status: 'inativo' }],
  cobrancas: [{ cliente_id: 'c1', ativo: false, valor_base: 1007.25 }], obrigacoes: [], recorrentes: [], tarefas: [], alvaras: [], certificados: [{ cliente_id: 'c2', acompanhar: false }] };
it = encerramentoDaSaida(nadaLigado);
chk('nada ligado: cada uma diz que está desligada', it.every(i => i.ligado === false) && de('carteira').texto === 'Saída registrada na Carteira em 01/12/2026, e inativa no cadastro.'
  && de('cobranca').texto.startsWith('Nenhuma base de boletos ativa.') && de('obrigacoes').texto === 'Nenhuma obrigação fiscal ligada.', it.map(i => i.ligado + ' ' + i.texto));
it = encerramentoDaSaida({ ...nadaLigado, clientes: [{ id: 'c1', status: 'ativo' }, { id: 'c2', status: 'inativo' }] });
chk('a saída na Carteira, mas ativa no cadastro: o link é o cadastro dela', de('carteira').ligado === true && de('carteira').texto.includes('mas EMPRESA UM LTDA segue ativa no cadastro')
  && de('carteira').link === 'clientes/editar.html?id=c1', de('carteira'));
it = encerramentoDaSaida({ ...tudoLigado, carteira: [{ cliente_id: 'c1', saida: '2026-12-01' }] });
chk('só uma das duas com a saída: diz qual falta', de('carteira').texto.startsWith('Sem a data de saída na Carteira: EMPRESA DOIS ME.'), de('carteira').texto);
it = encerramentoDaSaida({ ...tudoLigado, empresas: [EMP[0]] });
chk('uma empresa só: sem o nome dela em cada linha', de('cobranca').texto.startsWith('Base de boletos ativa: R$ 1.007,25.') && de('obrigacoes').texto.startsWith('2 obrigações ligadas: DCTFWeb e EFD-Contribuições.'), [de('cobranca').texto, de('obrigacoes').texto]);
it = encerramentoDaSaida({ ...tudoLigado, cobrancas: null, obrigacoes: null });
chk('a lista que não deu pra ler: "não conferi", e nunca "nada ligado"', de('cobranca').ligado === null && de('obrigacoes').ligado === null && /Não deu pra conferir/.test(de('cobranca').texto)
  && de('carteira').ligado === true, [de('cobranca'), de('obrigacoes')]);
chk('sem empresa vinculada: nada a mostrar', encerramentoDaSaida({ ...tudoLigado, empresas: [] }).length === 0 && encerramentoDaSaida(null).length === 0);
it = encerramentoDaSaida({ ...tudoLigado, fim: null });
chk('sem o fim do aviso: a linha das tarefas pede a data', de('tarefas').ligado === false && de('tarefas').texto.startsWith('Sem a data do fim do aviso'), de('tarefas'));
const muitas = { ...tudoLigado, empresas: [EMP[0]], obrigacoes: 'ABCDEFGH'.split('').map(l => ({ cliente_id: 'c1', ativo: true, nome: 'OBR ' + l })),
  tarefas: [1, 2, 3, 4, 5].map(n => ({ cliente_id: 'c1', status: 'pendente', prazo: '2026-12-1' + n, titulo: 'T' + n })) };
it = encerramentoDaSaida(muitas);
chk('muitas: os primeiros e "e mais N"', de('obrigacoes').texto.includes('OBR F e mais 2.') && de('tarefas').texto.includes('T1 (11/12/2026), T2 (12/12/2026) e T3 (13/12/2026) e mais 2.'), [de('obrigacoes').texto, de('tarefas').texto]);

console.log('\nA lista em seções:');
const LISTA = [
  { id: 'a', titulo: 'ENTRADA NO PRAZO', tipo: 'entrada', inicio: '2026-09-30', previsao_fim: '2026-12-29', status: 'em_andamento' },
  { id: 'b', titulo: 'ENTRADA ATRASADA', tipo: 'entrada', inicio: '2026-07-28', previsao_fim: '2026-10-26', status: 'em_andamento' },
  { id: 'c', titulo: 'CNPJ NOVO', tipo: 'cnpj_novo', inicio: '2026-09-01', previsao_fim: '2026-11-30', status: 'em_andamento' },
  { id: 'd', titulo: 'SAÍDA', tipo: 'saida', inicio: '2026-11-01', previsao_fim: '2026-12-01', status: 'em_andamento' },
  { id: 'e', titulo: 'CONCLUÍDA ANTIGA', tipo: 'entrada', inicio: '2026-05-01', previsao_fim: '2026-07-30', status: 'concluida', concluida_em: '2026-07-20T10:00:00Z' },
  { id: 'f', titulo: 'SAÍDA CONCLUÍDA', tipo: 'saida', inicio: '2026-09-01', previsao_fim: '2026-10-01', status: 'concluida', concluida_em: '2026-10-02T10:00:00Z' },
];
const sec = secoesDaLista(LISTA, '2026-11-12');
chk('saindo, chegando e concluídas, nessa ordem', sec.map(x => x.chave).join(',') === 'saindo,chegando,concluidas', sec.map(x => x.chave));
chk('saindo: só as saídas em andamento', sec[0].itens.map(x => x.id).join() === 'd');
chk('chegando: a entrada e o CNPJ novo, a mais urgente primeiro', sec[1].itens.map(x => x.id).join() === 'b,c,a', sec[1].itens.map(x => x.id));
chk('concluídas: a mais recente primeiro, de qualquer tipo', sec[2].itens.map(x => x.id).join() === 'f,e');
chk('seção vazia fica de fora', secoesDaLista(LISTA.filter(x => x.tipo !== 'saida'), '2026-11-12').map(x => x.chave).join() === 'chegando,concluidas' && secoesDaLista([], '2026-11-12').length === 0);

console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
