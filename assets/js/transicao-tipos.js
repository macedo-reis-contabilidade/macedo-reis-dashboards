// ============================================================
// MACEDO & REIS — Os tipos da transição (12/11/2026, pedido do Samuel: "quando for uma SAÍDA, categorias não fazem
// muito sentido, acho que tem que ficar um diferencial de cores nessa tela também"). Regra pura (sem banco e sem tela),
// pra comercial-transicao.html e pros testes (tests/transicao-tipos.test.mjs):
//  • cada tipo com o rótulo, o sentido (chegando ou saindo) e o prazo: a entrada e o CNPJ novo, 90 dias; a saída, os 30
//    dias do aviso prévio do contrato padrão (cláusula 18.1 do contrato do kit de boas-vindas, em clientes/editar.html);
//  • a contagem do cartão e do alto da ficha (`prazoDaTransicao`), pela previsão gravada: na entrada, "dia X de 90" e
//    quanto passou da previsão; na saída, quanto falta pro fim do aviso;
//  • as etapas da saída (`ETAPAS_SAIDA`, `etapaDaSaida`), no lugar dos setores: formalizar, entregar ao novo escritório e
//    encerrar no escritório — a fase gravada vale; sem ela (ou com uma fase da entrada), o título decide;
//  • o que ainda está ligado no escritório pras empresas que saem (`encerramentoDaSaida`): a carteira e o cadastro, a
//    cobrança, as obrigações fiscais, as tarefas recorrentes, as tarefas depois do fim do aviso, os alvarás e os
//    certificados — só leitura, cada um com a tela onde se desliga;
//  • a lista em seções (`secoesDaLista`): saindo, chegando e concluídas, a mais urgente primeiro.
// ============================================================

const DIA = 864e5;
const emUTC = d => {
  const p = String(d || '').slice(0, 10).split('-').map(Number);
  return p.length === 3 && p.every(Number.isFinite) ? Date.UTC(p[0], p[1] - 1, p[2]) : NaN;
};
/** Os dias de uma data (AAAA-MM-DD) até outra: positivo quando `ate` vem depois. */
export const diasEntre = (de, ate) => Math.round((emUTC(ate) - emUTC(de)) / DIA);
/** A data (AAAA-MM-DD) n dias depois. */
export const somarDias = (d, n) => new Date(emUTC(d) + n * DIA).toISOString().slice(0, 10);
/** dd/mm/aaaa. */
export const dataBR = d => { const p = String(d || '').slice(0, 10).split('-'); return p.length === 3 && p[0] ? p[2] + '/' + p[1] + '/' + p[0] : ''; };
const diaMes = d => dataBR(d).slice(0, 5);
const semAcento = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '');
const norm = s => semAcento(s).toLowerCase().replace(/\s+/g, ' ').trim();
const plural = (n, um, varios) => n + ' ' + (n === 1 ? um : varios);
/** "a", "a e b", "a, b e c". */
export const juntar = l => { const x = (l || []).filter(Boolean); return x.length < 2 ? (x[0] || '') : x.slice(0, -1).join(', ') + ' e ' + x[x.length - 1]; };
const reais = v => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const TIPOS = {
  entrada: { rotulo: 'Entrada', sentido: 'chegando', dias: 90 },
  cnpj_novo: { rotulo: 'CNPJ novo', sentido: 'chegando', dias: 90 },
  saida: { rotulo: 'Saída', sentido: 'saindo', dias: 30 },
};
/** O aviso prévio do contrato padrão (cláusula 18.1): 30 dias. */
export const DIAS_DO_AVISO = TIPOS.saida.dias;
export const rotuloDoTipo = tipo => (TIPOS[tipo] && TIPOS[tipo].rotulo) || String(tipo || 'Transição');
/** A classe da cor do tipo (o estilo fica na tela): tipo-entrada, tipo-cnpj_novo, tipo-saida. */
export const classeDoTipo = tipo => 'tipo-' + (TIPOS[tipo] ? tipo : 'entrada');
/** A previsão de quando a transição acaba: o início mais os dias do tipo. */
export const previsaoDoTipo = (tipo, inicio) => somarDias(inicio, (TIPOS[tipo] || TIPOS.entrada).dias);

/** A contagem da transição pra lista e pro alto da ficha. hoje = AAAA-MM-DD (o dia no fuso local).
 *  → { tipo, saida, inicio, fim, dia, total, faltam, passou, alerta, concluida, cartao, grande, pequeno, linha }:
 *  cartao = a linha do cartão da lista; grande e pequeno = o número do alto da ficha; linha = a frase embaixo dele. */
export function prazoDaTransicao(t, hoje) {
  const tipo = TIPOS[t && t.tipo] ? t.tipo : 'entrada';
  const saida = tipo === 'saida';
  const inicio = String((t && t.inicio) || hoje).slice(0, 10);
  const fim = t && t.previsao_fim ? String(t.previsao_fim).slice(0, 10) : previsaoDoTipo(tipo, inicio);
  const dia = Math.max(1, diasEntre(inicio, hoje) + 1);
  const total = Math.max(1, diasEntre(inicio, fim));
  const faltam = diasEntre(hoje, fim);
  const base = { tipo, saida, inicio, fim, dia, total, faltam, passou: faltam < 0, alerta: false, concluida: false };
  if (t && t.status === 'concluida') {
    const em = String(t.concluida_em || '').slice(0, 10);
    return { ...base, passou: false, concluida: true, cartao: '🏁 concluída' + (em ? ' em ' + diaMes(em) : ''), grande: '🏁', pequeno: '',
      linha: em ? 'concluída em ' + dataBR(em) : 'concluída' };
  }
  if (saida) {
    if (faltam > 0) return { ...base, cartao: 'aviso até ' + diaMes(fim) + ' · ' + (faltam === 1 ? 'falta 1 dia' : 'faltam ' + faltam + ' dias'),
      grande: faltam === 1 ? 'Falta 1 dia' : 'Faltam ' + faltam + ' dias', pequeno: '', linha: 'pro fim do aviso, em ' + dataBR(fim) };
    if (faltam === 0) return { ...base, alerta: true, cartao: 'o aviso termina hoje', grande: 'Termina hoje', pequeno: '', linha: 'o fim do aviso é hoje, ' + dataBR(fim) };
    return { ...base, alerta: true, cartao: 'o aviso terminou em ' + diaMes(fim), grande: 'Aviso terminou', pequeno: '',
      linha: 'em ' + dataBR(fim) + ', há ' + plural(-faltam, 'dia', 'dias') };
  }
  if (faltam >= 0) return { ...base, cartao: 'dia ' + dia + ' de ' + total, grande: 'Dia ' + Math.min(dia, 999), pequeno: 'de ' + total,
    linha: 'previsão de conclusão: ' + dataBR(fim) };
  return { ...base, alerta: true, cartao: 'dia ' + dia + ' de ' + total + ' · ' + plural(-faltam, 'dia', 'dias') + ' além da previsão',
    grande: 'Dia ' + Math.min(dia, 999), pequeno: 'de ' + total, linha: 'a previsão era ' + dataBR(fim) + ' · passou ' + plural(-faltam, 'dia', 'dias') };
}

/** As etapas da saída, na ordem em que acontecem. setor = o setor da tarefa nova criada pelo "+ tarefa" da etapa. */
export const ETAPAS_SAIDA = [
  { chave: 'formalizar', rotulo: 'Formalizar a saída', dica: 'O aviso, o distrato e quem recebe os documentos.', setor: 'societario' },
  { chave: 'entregar', rotulo: 'Entregar ao novo escritório', dica: 'Os documentos e os acessos que cada setor manda.', setor: 'societario' },
  { chave: 'encerrar', rotulo: 'Encerrar no escritório', dica: 'O que ainda está ligado aqui pra estas empresas.', setor: 'financeiro' },
];
/** As fases das tarefas da entrada e do CNPJ novo (o que a tela sugere no campo Fase). */
export const FASES_CHEGADA = ['Fechamento e boas-vindas', 'Documentos e escritório anterior', 'Cadastros e sistemas', 'Primeiras entregas', 'Acompanhamento'];
/** As fases que a tela sugere no campo Fase de cada tipo. */
export const fasesDoTipo = tipo => tipo === 'saida' ? ETAPAS_SAIDA.map(e => e.rotulo) : FASES_CHEGADA;

/** Em que etapa da saída a tarefa fica: a fase gravada, quando é uma das etapas; senão, o título. */
export function etapaDaSaida(tarefa) {
  const fase = norm(tarefa && tarefa.fase);
  const porFase = ETAPAS_SAIDA.find(e => norm(e.rotulo) === fase);
  if (porFase) return porFase.chave;
  const titulo = norm(tarefa && tarefa.titulo);
  if (/\bdistrato\b|aviso previo|contrato de prestacao|quem recebe|comunicar a saida/.test(titulo)) return 'formalizar';
  if (/^(encerrar|desligar|desativar|cancelar|inativar|revogar)\b|\bcobranca\b|\bboletos?\b|conta azul|\bcarteira\b|procuracao/.test(titulo)) return 'encerrar';
  return 'entregar';
}
/** A fase gravada na tarefa da saída: o rótulo da etapa dela. */
export const faseDaSaida = tarefa => ETAPAS_SAIDA.find(e => e.chave === etapaDaSaida(tarefa)).rotulo;

// as telas onde se desliga cada coisa (as Tarefas recorrentes ficam na aba Recorrentes das Tarefas de cada setor)
const NOME_SETOR = { societario: 'Societário', fiscal: 'Fiscal', dp: 'DP', contabil: 'Contábil', financeiro: 'Financeiro', comercial: 'Comercial', irpf: 'IRPF' };
const nomeDoSetor = s => NOME_SETOR[s] || String(s || 'sem setor');

/** O que ainda está ligado no escritório pras empresas que saem, na ordem de desligar. Recebe o que a tela leu do banco
 *  (a lista null = não deu pra ler): { empresas: [{ id, nome }], carteira: [{ cliente_id, saida, motivo_saida }],
 *  clientes: [{ id, status }], cobrancas: [{ cliente_id, ativo, valor_base }], obrigacoes: [{ cliente_id, ativo, nome }],
 *  recorrentes: [{ cliente_id, ativo, setor, titulo, data_fim }], tarefas: [{ cliente_id, status, prazo, titulo, transicao_id }],
 *  alvaras: [{ cliente_id, tipo, vencimento }], certificados: [{ cliente_id, acompanhar, titular, validade }],
 *  fim (o fim do aviso, AAAA-MM-DD), transicaoId }.
 *  → [{ chave, rotulo, ligado: true | false | null (não deu pra conferir), texto, link, rotuloLink }]. */
export function encerramentoDaSaida(d) {
  const emp = (d && d.empresas) || [];
  if (!emp.length) return [];
  const ids = new Set(emp.map(e => e.id));
  const daqui = l => (l || []).filter(x => x && ids.has(x.cliente_id));
  const nome = id => (emp.find(e => e.id === id) || {}).nome || 'empresa';
  const varias = emp.length > 1;
  const quem = lista => varias ? ' (' + juntar([...new Set(lista.map(x => nome(x.cliente_id)))]) + ')' : '';
  const fim = d.fim ? String(d.fim).slice(0, 10) : '';
  const naoLeu = (chave, rotulo, link, rotuloLink) => ({ chave, rotulo, ligado: null, texto: 'Não deu pra conferir agora: abra a tela e confira.', link, rotuloLink });
  const itens = [];

  // 1. a carteira e o cadastro: a geração dos boletos pula quem já tem data de saída, então a saída entra depois do
  //    boleto do último mês (pela cláusula 18.3, o cliente paga até o fim do aviso)
  if (!d.carteira || !d.clientes) itens.push(naoLeu('carteira', 'Carteira e cadastro', 'comercial-carteira.html', 'Abrir a Carteira'));
  else {
    const saidaDe = id => ((d.carteira.find(c => c.cliente_id === id) || {}).saida || null);
    const semSaida = emp.filter(e => !saidaDe(e.id));
    const ativas = emp.filter(e => ['ativo', 'em_transicao'].includes(String((d.clientes.find(c => c.id === e.id) || {}).status || '')));
    if (semSaida.length) itens.push({ chave: 'carteira', rotulo: 'Carteira e cadastro', ligado: true,
      texto: 'Sem a data de saída na Carteira' + (varias && semSaida.length < emp.length ? ': ' + juntar(semSaida.map(e => e.nome)) : '') + '. Registre lá só depois de gerar o boleto do último mês: a geração dos boletos pula quem já tem data de saída. Ao registrar, a Carteira oferece inativar no cadastro.',
      link: 'comercial-carteira.html', rotuloLink: 'Abrir a Carteira' });
    else {
      const datas = juntar([...new Set(emp.map(e => dataBR(saidaDe(e.id))))]);
      if (ativas.length) itens.push({ chave: 'carteira', rotulo: 'Carteira e cadastro', ligado: true,
        texto: 'Saída registrada na Carteira em ' + datas + ', mas ' + (varias ? juntar(ativas.map(e => e.nome)) + ' segue' : 'segue') + ' ativa no cadastro: tarefas, alvarás e campanhas ainda contam com ela.',
        link: 'clientes/editar.html?id=' + encodeURIComponent(ativas[0].id), rotuloLink: 'Abrir o cadastro' });
      else itens.push({ chave: 'carteira', rotulo: 'Carteira e cadastro', ligado: false, texto: 'Saída registrada na Carteira em ' + datas + ', e inativa no cadastro.', link: 'comercial-carteira.html', rotuloLink: 'Abrir a Carteira' });
    }
  }

  // 2. a cobrança: a base de boletos (e o lembrete do Conta Azul, que a tela não lê)
  const CA = ' Quem paga pelo Conta Azul: encerre lá o contrato da mensalidade (Vendas › Contratos).';
  if (!d.cobrancas) itens.push(naoLeu('cobranca', 'Cobrança', 'financeiro-boletos.html', 'Abrir Boletos'));
  else {
    const ativas = daqui(d.cobrancas).filter(c => c.ativo);
    itens.push({ chave: 'cobranca', rotulo: 'Cobrança', ligado: ativas.length > 0,
      texto: (ativas.length ? 'Base de boletos ativa: ' + ativas.map(c => (varias ? nome(c.cliente_id) + ', ' : '') + reais(c.valor_base)).join('; ') + '. Desligue depois do boleto do último mês.'
        : 'Nenhuma base de boletos ativa.') + CA,
      link: 'financeiro-boletos.html', rotuloLink: 'Abrir Boletos' });
  }

  // 3. as obrigações fiscais ligadas: a tarefa do mês segue nascendo
  if (!d.obrigacoes) itens.push(naoLeu('obrigacoes', 'Obrigações fiscais', 'fiscal-obrigacoes.html', 'Abrir Obrigações fiscais'));
  else {
    const ligadas = daqui(d.obrigacoes).filter(o => o.ativo !== false);
    const nomes = [...new Set(ligadas.map(o => o.nome || 'obrigação'))];
    itens.push({ chave: 'obrigacoes', rotulo: 'Obrigações fiscais', ligado: ligadas.length > 0,
      texto: ligadas.length ? plural(ligadas.length, 'obrigação ligada', 'obrigações ligadas') + quem(ligadas) + ': ' + juntar(nomes.slice(0, 6)) + (nomes.length > 6 ? ' e mais ' + (nomes.length - 6) : '')
        + '. Desligue depois do último mês feito aqui: ligada, a tarefa do mês segue nascendo.' : 'Nenhuma obrigação fiscal ligada.',
      link: 'fiscal-obrigacoes.html', rotuloLink: 'Abrir Obrigações fiscais' });
  }

  // 4. as tarefas recorrentes ativas (sem a data de fim até o fim do aviso)
  if (!d.recorrentes) itens.push(naoLeu('recorrentes', 'Tarefas recorrentes', 'agenda.html', 'Abrir a Agenda'));
  else {
    const ativas = daqui(d.recorrentes).filter(r => r.ativo !== false && !(r.data_fim && fim && String(r.data_fim).slice(0, 10) <= fim));
    const porSetor = new Map();
    ativas.forEach(r => { const s = r.setor || ''; if (!porSetor.has(s)) porSetor.set(s, []); porSetor.get(s).push(r.titulo || 'sem título'); });
    const setores = [...porSetor.entries()].sort((a, b) => b[1].length - a[1].length);
    const principal = setores.length ? setores[0][0] : '';
    itens.push({ chave: 'recorrentes', rotulo: 'Tarefas recorrentes', ligado: ativas.length > 0,
      texto: ativas.length ? plural(ativas.length, 'tarefa recorrente ativa', 'tarefas recorrentes ativas') + quem(ativas) + ' (' + setores.map(([s, l]) => nomeDoSetor(s) + ': ' + juntar([...new Set(l)].slice(0, 4))).join('; ')
        + '). Ponha a data de fim no último mês, ou desative: ativa, a tarefa segue nascendo.' : 'Nenhuma tarefa recorrente ativa.',
      link: principal && NOME_SETOR[principal] ? principal + '-tarefas.html?aba=recorrentes' : 'agenda.html',
      rotuloLink: principal && NOME_SETOR[principal] ? 'Abrir as recorrentes do ' + nomeDoSetor(principal) : 'Abrir a Agenda' });
  }

  // 5. as tarefas abertas com prazo depois do fim do aviso (fora as desta transição)
  if (!d.tarefas) itens.push(naoLeu('tarefas', 'Tarefas depois do fim do aviso', 'agenda.html', 'Abrir a Agenda'));
  else {
    const depois = daqui(d.tarefas).filter(t => t.status !== 'concluida' && t.transicao_id !== d.transicaoId && fim && t.prazo && String(t.prazo).slice(0, 10) > fim)
      .sort((a, b) => String(a.prazo).localeCompare(String(b.prazo)));
    const titulos = depois.slice(0, 3).map(t => (t.titulo || 'sem título') + ' (' + dataBR(t.prazo) + ')');
    itens.push({ chave: 'tarefas', rotulo: 'Tarefas depois do fim do aviso', ligado: depois.length > 0,
      texto: !fim ? 'Sem a data do fim do aviso: ponha no ✎ Editar.'
        : depois.length ? plural(depois.length, 'tarefa aberta', 'tarefas abertas') + ' com prazo depois de ' + dataBR(fim) + ': ' + juntar(titulos) + (depois.length > 3 ? ' e mais ' + (depois.length - 3) : '') + '. Se o escritório não vai fazer, conclua ou exclua.'
        : 'Nenhuma tarefa aberta com prazo depois de ' + dataBR(fim) + '.',
      link: 'agenda.html', rotuloLink: 'Abrir a Agenda' });
  }

  // 6. os alvarás no controle: as tarefas de renovação seguem nascendo
  if (!d.alvaras) itens.push(naoLeu('alvaras', 'Alvarás', 'societario-alvaras.html', 'Abrir Alvarás'));
  else {
    const al = daqui(d.alvaras);
    itens.push({ chave: 'alvaras', rotulo: 'Alvarás', ligado: al.length > 0,
      texto: al.length ? plural(al.length, 'alvará', 'alvarás') + ' no controle' + quem(al) + ': ' + juntar(al.slice(0, 4).map(a => (a.tipo || 'Alvará') + (a.vencimento ? ', vence ' + dataBR(a.vencimento) : '')))
        + (al.length > 4 ? ' e mais ' + (al.length - 4) : '') + '. A tarefa de renovação segue nascendo: exclua os que o escritório deixa de acompanhar.' : 'Nenhum alvará no controle.',
      link: 'societario-alvaras.html', rotuloLink: 'Abrir Alvarás' });
  }

  // 7. os certificados digitais acompanhados: o aviso de vencimento segue indo pro cliente
  if (!d.certificados) itens.push(naoLeu('certificados', 'Certificados digitais', 'societario-certificados.html', 'Abrir Certificados'));
  else {
    const ce = daqui(d.certificados).filter(c => c.acompanhar !== false);
    itens.push({ chave: 'certificados', rotulo: 'Certificados digitais', ligado: ce.length > 0,
      texto: ce.length ? plural(ce.length, 'certificado acompanhado', 'certificados acompanhados') + ': ' + juntar(ce.slice(0, 4).map(c => (c.titular || 'sem titular') + (c.validade ? ', vence ' + dataBR(c.validade) : '')))
        + (ce.length > 4 ? ' e mais ' + (ce.length - 4) : '') + '. O aviso de vencimento segue indo pro cliente: desmarque "Acompanhar este certificado".' : 'Nenhum certificado digital acompanhado.',
      link: 'societario-certificados.html', rotuloLink: 'Abrir Certificados' });
  }
  return itens;
}

/** A lista em seções, a mais urgente primeiro (a previsão mais perto, ou a que já passou): saindo, chegando e
 *  concluídas (a concluída mais recente primeiro). Seção sem nenhuma fica de fora. */
export function secoesDaLista(transicoes, hoje) {
  const lista = transicoes || [];
  const ativas = lista.filter(t => t.status !== 'concluida');
  const fim = t => prazoDaTransicao(t, hoje).fim;
  const porFim = (a, b) => fim(a).localeCompare(fim(b)) || String(a.titulo || '').localeCompare(String(b.titulo || ''), 'pt-BR');
  return [
    { chave: 'saindo', rotulo: 'Saindo', dica: 'vão pra outro escritório', itens: ativas.filter(t => t.tipo === 'saida').sort(porFim) },
    { chave: 'chegando', rotulo: 'Chegando', dica: 'entradas de outro escritório e CNPJs novos', itens: ativas.filter(t => t.tipo !== 'saida').sort(porFim) },
    { chave: 'concluidas', rotulo: 'Concluídas', dica: '', itens: lista.filter(t => t.status === 'concluida').sort((a, b) => String(b.concluida_em || '').localeCompare(String(a.concluida_em || ''))) },
  ].filter(s => s.itens.length);
}
