// MOCK — dados inventados, só pro harness visual
// dia no fuso local, como as telas (hojeLocal/dataLocal): com toISOString (UTC), das 21h à meia-noite as tarefas
// inventadas "de hoje" nasciam com a data de amanhã e o harness mostrava outra coisa que de dia
const hoje = new Date(); const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const add = n => { const d = new Date(); d.setDate(d.getDate()+n); return ymd(d); };
const mesAtual = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0'); // o mês de referência padrão das telas
const T = (i, titulo, setor, resp, prazo, prio, extra={}) => ({ id:'t'+i, titulo, setor, responsavel:resp, prazo, status:'pendente', prioridade:prio, cliente_id:null, proposta_id:null, hora:null, transicao_id:null, posicao:i*10, clientes:extra.cli?{nome_principal:extra.cli, documento:'00000000000000'}:null, concluida_em:null, concluida_por:null, ...extra });
const DATA = {
  tarefas: [
    T(1,'Enviar guias do mês','fiscal','Thalia',add(0),'alta',{cli:'EMPRESA EXEMPLO LTDA',competencia:'2026-09'}),
    T(3,'Balancete do trimestre','contabil','Adaini',add(0),'baixa'),
    T(51,'RECADASTRAMENTO SEFAZ RS - GERAIS','fiscal','Samuel',add(13),'media',{cli:'EMPRESA EXEMPLO LTDA'}),
    T(52,'RECADASTRAMENTO SEFAZ RS - GERAIS','fiscal','Samuel',add(13),'media',{cli:'COMÉRCIO MODELO ME'}),
    T(53,'RECADASTRAMENTO SEFAZ RS - SIMPLES/MEI','fiscal','Samuel',add(13),'media',{cli:'LOJA DE TESTE LTDA'}),
    T(31,'Enviar contrato de prestação e carta de responsabilidade pro cliente novo assinar','societario','Samuel',add(0),'alta',{cli:'EMPRESA DE NOME BEM COMPRIDO PARA TESTAR O CORTE DO TEXTO LTDA',hora:'14:30'}),
    T(41,'Atualização de IE','fiscal','Samuel',null,'media',{cli:'COMÉRCIO MODELO ME'}),
    T(32,'Conferir boletos do dia','financeiro','Samuel',add(0),'media'),
    T(4,'Registro de marca','societario','Samuel',add(1),'media',{cli:'AGRO FICTÍCIA LTDA'}),
    T(9,'IRPF','irpf','Samuel',add(0),'media',{status:'concluida',concluida_em:new Date().toISOString(),concluida_por:'financeiro@macedoereis.com.br'}),
    T(10,'Renovar alvará','societario','Samuel',add(-3),'alta',{cli:'LOJA DE TESTE LTDA'}),
    T(11,'Cobrar honorários atrasados','financeiro','Samuel',add(-10),'alta'),
    T(14,'Fechamento contábil','contabil','Adaini',add(12),'media',{cli:'COMÉRCIO MODELO ME',competencia:'2026-08'}),
    // lote nas telas dos setores (tests/harness/lote-setores.py): um grupo fiscal com 3 e um societário com 2
    T(61,'Conferir notas de entrada','fiscal','Thalia',add(0),'media',{cli:'EMPRESA EXEMPLO LTDA'}),
    T(62,'Conferir notas de entrada','fiscal','Thalia',add(0),'media',{cli:'COMÉRCIO MODELO ME',status:'em_andamento'}),
    T(63,'Conferir notas de entrada','fiscal','Thalia',add(0),'media',{cli:'LOJA DE TESTE LTDA'}),
    T(64,'Alteração contratual','societario','Samuel',add(2),'media',{cli:'AGRO FICTÍCIA LTDA'}),
    T(65,'Alteração contratual','societario','Samuel',add(2),'media',{cli:'COMÉRCIO MODELO ME'}),
    // vínculo sem responsável em Obrigações fiscais (tests/harness/obrigacoes-responsavel.py): aberta sem dono,
    // aberta repassada à mão pra Adaini, e uma já concluída
    T(71,'EFD TESTE MENSAL','fiscal',null,add(5),'media',{cli:'COMÉRCIO MODELO ME',cliente_id:'c1',obrigacao_id:'o1'}),
    T(72,'EFD TESTE MENSAL','fiscal','Adaini',add(35),'media',{cli:'COMÉRCIO MODELO ME',cliente_id:'c1',obrigacao_id:'o1'}),
    T(73,'EFD TESTE MENSAL','fiscal',null,add(-25),'media',{cli:'COMÉRCIO MODELO ME',cliente_id:'c1',obrigacao_id:'o1',status:'concluida'}),
    // obrigação com o mês todo concluído (tests/harness/obrigacoes-mes-concluido.py): não pode sumir de Obrigações fiscais
    T(74,'PGDAS TESTE MENSAL','fiscal','Thalia',add(-10),'media',{cli:'EMPRESA EXEMPLO LTDA',cliente_id:'c2',obrigacao_id:'o3',status:'concluida',competencia:mesAtual,concluida_em:add(-9)+'T15:00:00Z'}),
    // tarefas das recorrências do Contábil (tests/harness/rotinas-excluir.py): desvincular tira as pendentes, de qualquer
    // data; a concluída e a em andamento ficam
    T(81,'EMISSÃO DE EXTRATOS (TESTE)','contabil','Adaini',add(-20),'media',{regra_id:'tr3',origem:'recorrente'}),
    T(82,'EMISSÃO DE EXTRATOS (TESTE)','contabil','Adaini',add(10),'media',{regra_id:'tr3',origem:'recorrente'}),
    T(83,'EMISSÃO DE EXTRATOS (TESTE)','contabil','Adaini',add(-50),'media',{regra_id:'tr3',origem:'recorrente',status:'concluida',concluida_em:add(-49)+'T15:00:00Z'}),
    T(84,'CONCILIAÇÃO BANCÁRIA (TESTE)','contabil','Adaini',add(-20),'media',{cli:'EMPRESA EXEMPLO LTDA',cliente_id:'c2',regra_id:'tr2',origem:'recorrente'}),
    T(85,'CONCILIAÇÃO BANCÁRIA (TESTE)','contabil','Adaini',add(-50),'media',{cli:'EMPRESA EXEMPLO LTDA',cliente_id:'c2',regra_id:'tr2',origem:'recorrente',status:'concluida',concluida_em:add(-49)+'T15:00:00Z'}),
    T(86,'CONCILIAÇÃO BANCÁRIA (TESTE)','contabil','Adaini',add(-3),'media',{cli:'EMPRESA EXEMPLO LTDA',cliente_id:'c2',regra_id:'tr2',origem:'recorrente',status:'em_andamento'}),
  ],
  rotinas: [
    { id:'r1', titulo:'Conferir e-mail', setor:'gestao', responsavel:'Samuel', ativo:true, periodicidade:'diaria', ultima_execucao:ymd(hoje), adiada_para:null },
    { id:'r3', titulo:'Financeiro escritório: diário', setor:'financeiro', responsavel:'Samuel', ativo:true, periodicidade:'diaria', ultima_execucao:null, adiada_para:null },
    { id:'r4', titulo:'Conciliação bancária', setor:'contabil', responsavel:'Adaini', ativo:true, periodicidade:'diaria', ultima_execucao:null, adiada_para:null },
  ],
  clientes: [{id:'c1',nome_principal:'COMÉRCIO MODELO ME',documento:'00000000000000',status:'ativo',regime:'simples'},{id:'c2',nome_principal:'EMPRESA EXEMPLO LTDA',documento:'11111111111111',status:'ativo',regime:'presumido'}],
  obrigacoes_fiscais: [
    { id:'o1', nome:'EFD TESTE MENSAL', periodicidade:'mensal', meses_vencimento:[], dia_prazo:10, gatilho_dias_antes:0, ativo:true, regimes_aplicaveis:['Simples Nacional'] },
    { id:'o2', nome:'DCTF TESTE MENSAL', periodicidade:'mensal', meses_vencimento:[], dia_prazo:15, gatilho_dias_antes:0, ativo:true, regimes_aplicaveis:['Simples Nacional'] },
    { id:'o3', nome:'PGDAS TESTE MENSAL', periodicidade:'mensal', meses_vencimento:[], dia_prazo:20, gatilho_dias_antes:0, ativo:true, regimes_aplicaveis:['Simples Nacional'] },
  ],
  cliente_obrigacoes: [
    { id:'v1', cliente_id:'c1', obrigacao_id:'o1', responsavel:null, dia_prazo_override:null, ativo:true, clientes:{ nome_principal:'COMÉRCIO MODELO ME' } },
    { id:'v2', cliente_id:'c2', obrigacao_id:'o1', responsavel:'Thalia', dia_prazo_override:null, ativo:true, clientes:{ nome_principal:'EMPRESA EXEMPLO LTDA' } },
    { id:'v3', cliente_id:'c3', obrigacao_id:'o1', responsavel:null, dia_prazo_override:null, ativo:false, clientes:{ nome_principal:'LOJA DE TESTE LTDA' } },
    { id:'v4', cliente_id:'c2', obrigacao_id:'o3', responsavel:'Thalia', dia_prazo_override:null, ativo:true, clientes:{ nome_principal:'EMPRESA EXEMPLO LTDA' } },
  ],
  alvaras:[], rt_casos:[], faturaveis:[], tarefa_historico:[], servicos_avulsos:[],
  // Carteira de clientes (tests/harness/carteira-analise.py): 10 municípios (mais de 8, pra provar que a Análise não corta
  // o município de 1 cliente só), um MEI com o "CPF" no fim do nome oficial e outro com a raiz do "CNPJ" na frente —
  // números inventados, como todo o resto
  carteira_info: [
    ['k1', 'ALFA COMÉRCIO DE TESTE LTDA', '10000000000101', 'Simples Nacional', 'Três Coroas', '2019-03-01', 'COMÉRCIO'],
    ['k2', 'BETA SERVIÇOS DE TESTE LTDA', '10000000000102', 'Lucro Presumido', 'Três Coroas', '2020-06-15', 'SERVIÇO'],
    ['k3', 'GAMA INDÚSTRIA DE TESTE LTDA', '10000000000103', 'Simples Nacional', 'Três Coroas', '2021-01-10', 'INDÚSTRIA'],
    ['k4', 'DELTA LOJA DE TESTE LTDA', '10000000000104', 'Simples Nacional', 'Igrejinha', '2022-02-01', 'COMÉRCIO'],
    ['k5', 'ÉPSILON OFICINA DE TESTE LTDA', '10000000000105', 'Simples Nacional', 'Igrejinha', '2023-04-01', 'SERVIÇO'],
    ['k6', 'FULANO DE TESTE 12345678901', '10000000000106', 'MEI', 'Gramado', '2024-05-01', 'SERVIÇO'],
    ['k7', '12.345.678 BELTRANA DE TESTE', '12345678000107', 'MEI', 'Canela', '2024-07-01', 'COMÉRCIO'],
    ['k8', 'ZETA MERCADO DE TESTE LTDA', '10000000000108', 'Lucro Real', 'Taquara', '2025-01-02', 'COMÉRCIO'],
    ['k9', 'ETA PADARIA DE TESTE LTDA', '10000000000109', 'Simples Nacional', 'Rolante', '2025-03-03', 'COMÉRCIO'],
    ['k10', 'TETA CONSERTOS DE TESTE LTDA', '10000000000110', 'Simples Nacional', 'Parobé', '2025-08-08', 'COMÉRCIO + SERVIÇO'],
    ['k11', 'IOTA CALÇADOS DE TESTE LTDA', '10000000000111', 'Simples Nacional', 'Nova Hartz', '2026-02-02', 'INDÚSTRIA'],
    ['k12', 'CAPA TRANSPORTES DE TESTE LTDA', '10000000000112', 'Lucro Presumido', 'Sapiranga', '2026-05-05', 'SERVIÇO'],
    ['k13', 'LAMBDA ASSOCIAÇÃO DE TESTE', '10000000000113', 'Imune', 'Esteio', '2018-12-01', 'ASSOCIAÇÃO'],
    ['k14', 'MI SAIU DE TESTE LTDA', '10000000000114', 'Simples Nacional', 'Três Coroas', '2018-12-01', 'COMÉRCIO', '2026-03-31', 'FECHOU'],
  ].map(([id, nome, doc, regime, cidade, entrada, segmento, saida, motivo]) => ({
    cliente_id: id, entrada, saida: saida || null, motivo_saida: motivo || null, segmento, sistemas: null, contato: null, ramo: null,
    inadimplente_desde: null,
    clientes: { id, nome_principal: nome, nome_fantasia: null, regime_tributario: regime, cidade, uf: 'RS', status: 'ativo', documento: doc, drive_folder_url: null },
  })),
  // Propostas → transição (tests/harness/proposta-transicao.py): uma apresentada, uma fechada sem transição e uma fechada com
  precificacoes: [
    { id:'pp1', cliente_nome:'PADARIA FICTÍCIA LTDA', contato:'51900000001', cliente_id:null, origem:'interna', status:'apresentada', respostas:{ A1:'PADARIA FICTÍCIA LTDA' }, resultado:null, honorario:650, taxa_unica:null, observacao:null, criado_por:'samuel@macedoereis.com.br', criado_em:add(-2)+'T12:00:00Z', atualizado_em:add(-2)+'T12:00:00Z' },
    { id:'pp2', cliente_nome:'OFICINA MODELO LTDA', contato:'51900000002', cliente_id:null, origem:'externa', status:'fechada', respostas:{ A1:'OFICINA MODELO LTDA' }, resultado:null, honorario:900, taxa_unica:450, observacao:null, criado_por:'Contato Teste', criado_em:add(-5)+'T12:00:00Z', atualizado_em:add(-1)+'T12:00:00Z' },
    { id:'pp3', cliente_nome:'CONFECÇÃO TESTE LTDA', contato:null, cliente_id:null, origem:'interna', status:'fechada', respostas:{ A1:'CONFECÇÃO TESTE LTDA' }, resultado:null, honorario:1200, taxa_unica:null, observacao:null, criado_por:'diego@macedoereis.com.br', criado_em:add(-20)+'T12:00:00Z', atualizado_em:add(-15)+'T12:00:00Z' },
  ],
  transicoes: [
    { id:'tx1', titulo:'CONFECÇÃO TESTE LTDA', tipo:'entrada', proposta_id:'pp3', padrinho:null, inicio:add(-15), previsao_fim:add(75), tera_funcionarios:null, contato:null, observacao:'Aberta a partir da proposta fechada.', status:'em_andamento', concluida_em:null, criado_em:add(-15)+'T12:00:00Z', transicao_empresas:[] },
  ],
  // Sugestões de melhoria por setor (assets/js/sugestoes-setor.js; teste em tests/harness/relatorios-sugestoes.py)
  sugestoes: [
    { id:'s1', setor:'contabil', titulo:'CONFERÊNCIA EM DUPLICIDADE (TESTE)', autor:'Adaini', status:'nova', created_at:add(-2)+'T09:00:00Z',
      melhoria:'Conferir o balancete uma vez só', como_atual:'Duas pessoas conferem o mesmo balancete', como_melhorar:'Dividir por competência', cenario_ideal:'Conferência automática', concluida_em:null, concluida_por:null },
    { id:'s2', setor:'contabil', titulo:'PASTA ÚNICA DE DOCUMENTOS (TESTE)', autor:null, status:'concluida', created_at:add(-40)+'T09:00:00Z',
      melhoria:'Uma pasta por empresa', como_atual:'Cada um guarda onde quer', como_melhorar:null, cenario_ideal:null, concluida_em:add(-5)+'T15:00:00Z', concluida_por:'financeiro@macedoereis.com.br' },
    { id:'s3', setor:'dp', titulo:'AVISO DE FÉRIAS COM 40 DIAS (TESTE)', autor:'Vitória', status:'nova', created_at:add(-1)+'T09:00:00Z',
      melhoria:'Avisar a empresa antes do prazo legal', como_atual:'Aviso sai junto com a folha', como_melhorar:'Tarefa recorrente 40 dias antes', cenario_ideal:null, concluida_em:null, concluida_por:null },
    { id:'s4', setor:'fiscal', titulo:'CONFERIR XML ANTES DE FECHAR (TESTE)', autor:'Thalia', status:'nova', created_at:add(-3)+'T09:00:00Z',
      melhoria:'Importar os XML no dia 5', como_atual:'Importação no fechamento', como_melhorar:null, cenario_ideal:'Nota conferida no mesmo dia', concluida_em:null, concluida_por:null },
  ],
  // Tarefas recorrentes por setor (assets/js/rotinas-setor.js; teste em tests/harness/rotinas-setor.py)
  rotinas_modelo: [
    { id:'rm1', setor:'dp', nome:'FOLHA DE PAGAMENTO (TESTE)', ativo:true },
    { id:'rm2', setor:'contabil', nome:'CONCILIAÇÃO BANCÁRIA (TESTE)', ativo:true },
    // uma por setor que virou página fina em 01/10 (teste em tests/harness/rotinas-tres-setores.py)
    { id:'rm3', setor:'fiscal', nome:'RECADASTRAMENTO ESTADUAL (TESTE)', ativo:true },
    { id:'rm4', setor:'comercial', nome:'LIGAÇÃO DE RELACIONAMENTO (TESTE)', ativo:true },
    { id:'rm5', setor:'societario', nome:'RENOVAÇÃO DE ALVARÁ (TESTE)', ativo:true },
  ],
  tarefas_recorrentes: [
    { id:'tr1', modelo_id:'rm1', setor:'dp', titulo:'FOLHA DE PAGAMENTO (TESTE)', cliente_id:'c1', clientes:{ nome_principal:'COMÉRCIO MODELO ME' }, periodicidade:'mensal', dia_vencimento:5, mes_vencimento:null, dia_util:true, responsavel:'Vitória', observacao:null, origem:'rotina', ativo:true },
    { id:'tr2', modelo_id:'rm2', setor:'contabil', titulo:'CONCILIAÇÃO BANCÁRIA (TESTE)', cliente_id:'c2', clientes:{ nome_principal:'EMPRESA EXEMPLO LTDA' }, periodicidade:'mensal', dia_vencimento:10, mes_vencimento:null, dia_util:true, responsavel:'Adaini', observacao:null, origem:'rotina', ativo:true },
    { id:'tr3', modelo_id:null, setor:'contabil', titulo:'EMISSÃO DE EXTRATOS (TESTE)', cliente_id:null, periodicidade:'mensal', dia_vencimento:5, mes_vencimento:null, dia_util:true, responsavel:'Adaini', observacao:null, origem:'manual', ativo:true },
  ],
};
// o teste de comportamento (tests/harness/lote-setores.py) lê o banco falso por aqui
window.__mockDb = DATA;
let seq = 1000;
// como no Supabase de verdade, cada resposta é uma CÓPIA: mexer no que a tela recebeu não altera o "banco"
const copia = v => (v == null ? v : structuredClone(v));
// atraso opcional por consulta (o lote-setores.py usa pra ver o progresso e as travas no meio de um lote)
const responder = out => (window.__mockDelay ? new Promise(r => setTimeout(() => r(out), window.__mockDelay)) : Promise.resolve(out));
// chaves únicas do banco de verdade que as telas tratam (erro 23505 = "duplicate key")
const UNICOS = { rotinas_modelo: [['setor', 'nome']] };
function q(table){
  const rows = DATA[table] || (DATA[table] = []);
  const self = { _head:false };
  const passa = r => (self._f||[]).every(([k,col,v,v2]) => { const x = r[col]; if (k==='in') return v.includes(x); if (k==='eq') return x===v; if (k==='neq') return x!==v; if (k==='is') return x==v; if (k==='not') return !(x==v2); if (x==null) return false; if (k==='lt') return x<v; if (k==='lte') return x<=v; if (k==='gt') return x>v; if (k==='gte') return x>=v; return true; });
  // executa a consulta montada: insert já feito, update/delete aplicados aqui (uma vez só)
  const executar = () => {
    if (self._out) return self._out;
    if (self._err) return (self._out = { data:null, error:self._err, count:0 });
    const data = self._ins || rows.filter(passa);
    if (self._patch) { data.forEach(r => Object.assign(r, self._patch)); console.log('MOCK UPDATE', table, data.length); emitir(table, 'UPDATE', data); }
    if (self._del) { data.forEach(r => rows.splice(rows.indexOf(r), 1)); console.log('MOCK DELETE', table, data.length); }
    return (self._out = { data: self._head ? null : copia(data), error:null, count: data.length });
  };
  const chain = new Proxy(self, { get(t, k){
    if (k==='then') return (res, rej) => responder(executar()).then(res, rej);
    if (k==='select') return (c, o) => { if (o && o.head) self._head = true; return chain; };
    if (k==='update') return (patch) => { self._patch = patch; return chain; };
    if (k==='delete') return () => { self._del = true; return chain; };
    if (k==='in') return (col, vals) => { (self._f ||= []).push(['in',col,vals]); return chain; };
    if (k==='insert') return (payload) => {
      const arr = (Array.isArray(payload)?payload:[payload]).map(r => ({ id: 'n'+(seq++), ...r }));
      // o que o banco de verdade preenche sozinho (o chat: quem e quando), o teste preenche aqui
      if (typeof window.__mockAntesDeInserir === 'function') arr.forEach(r => window.__mockAntesDeInserir(table, r));
      const dup = (UNICOS[table] || []).some(cols => arr.some(n => rows.some(r => cols.every(c => r[c] === n[c]))));
      if (dup) { self._err = { code:'23505', message:'duplicate key value violates unique constraint' }; return chain; }
      rows.push(...arr); self._ins = arr; console.log('MOCK INSERT', table, JSON.stringify(arr)); emitir(table, 'INSERT', arr); return chain;
    };
    // upsert (a geração do mês da tela Boletos): com ignoreDuplicates, quem já existe pela chave do onConflict fica como está;
    // sem ele, a linha que já existe é atualizada
    if (k==='upsert') return (payload, o = {}) => {
      const cols = String(o.onConflict || 'id').split(',').map(s => s.trim());
      const novos = [];
      (Array.isArray(payload)?payload:[payload]).forEach(n => {
        const ja = rows.find(r => cols.every(c => r[c] === n[c]));
        if (ja) { if (!o.ignoreDuplicates) Object.assign(ja, n); return; }
        novos.push({ id: 'n'+(seq++), ...n });
      });
      rows.push(...novos); self._ins = novos; console.log('MOCK UPSERT', table, novos.length); emitir(table, 'INSERT', novos); return chain;
    };
    if (['lt','lte','gt','gte','eq','neq','is','not'].includes(k)) return (col, v, v2) => { (self._f ||= []).push([k,col,v,v2]); return chain; };
    if (k==='single' || k==='maybeSingle') return () => { const out = executar(); return responder({ data: out.error ? null : ((out.data || [])[0] ?? null), error: out.error }); };
    return () => chain;
  }});
  return chain;
}
// o tempo real (o chat da equipe, assets/js/chat-equipe.js): os canais guardam quem escuta; o que o banco falso insere ou
// muda nas tabelas do chat chega aos canais, como no Supabase; o teste manda o que "outra pessoa" fez por
// window.__mockEmitir(tabela, evento, linha) e quem está online por window.__mockOnline(emails)
const CANAIS = [];
const TEMPO_REAL = ['chat_mensagens', 'chat_membros', 'chat_conversas'];
function emitir(tabela, evento, linhas) {
  if (!TEMPO_REAL.includes(tabela)) return;
  (Array.isArray(linhas) ? linhas : [linhas]).forEach(l => setTimeout(() => entregar(tabela, evento, copia(l)), 20));
}
function entregar(tabela, evento, linha) {
  CANAIS.forEach(c => c.ouvintes.filter(o => o.tipo === 'postgres_changes' && o.filtro.table === tabela && (o.filtro.event === '*' || o.filtro.event === evento)).forEach(o => {
    const f = /^(\w+)=eq\.(.*)$/.exec(o.filtro.filter || '');
    if (f && String(linha[f[1]]) !== f[2]) return;
    try { o.cb({ eventType: evento, new: linha, old: {} }); } catch (e) { console.error(e); }
  }));
}
window.__mockEmitir = (tabela, evento, linha) => entregar(tabela, evento, copia(linha));
window.__mockCanais = CANAIS;
let ONLINE = [];
window.__mockOnline = emails => { ONLINE = emails.slice(); CANAIS.forEach(c => c.ouvintes.filter(o => o.tipo === 'presence').forEach(o => o.cb({}))); };
function canal(nome, opcoes) {
  const c = { nome, opcoes, ouvintes: [], eu: null,
    on(tipo, filtro, cb) { c.ouvintes.push({ tipo, filtro: filtro || {}, cb }); return c; },
    subscribe(cb) { setTimeout(() => { if (cb) cb('SUBSCRIBED'); }, 10); return c; },
    async track(meta) { c.eu = (opcoes && opcoes.config && opcoes.config.presence && opcoes.config.presence.key) || 'eu'; setTimeout(() => c.ouvintes.filter(o => o.tipo === 'presence').forEach(o => o.cb({})), 10); return 'ok'; },
    presenceState() { const s = {}; [...ONLINE, ...(c.eu ? [c.eu] : [])].forEach(e => { s[e] = [{}]; }); return s; },
    async unsubscribe() { return 'ok'; } };
  CANAIS.push(c);
  return c;
}
// os arquivos (a pasta "chat" do Storage): guardados em window.__mockDb.__arquivos; o link assinado é um endereço falso
const ARQUIVOS = () => (DATA.__arquivos ||= {});
const storageFalso = { from: pasta => ({
  async upload(caminho, arquivo, op = {}) { if (ARQUIVOS()[pasta + '/' + caminho]) return { data: null, error: { message: 'The resource already exists' } };
    ARQUIVOS()[pasta + '/' + caminho] = { tamanho: arquivo && arquivo.size, tipo: op.contentType || null }; console.log('MOCK UPLOAD', pasta, caminho); return { data: { path: caminho }, error: null }; },
  async createSignedUrl(caminho, s, op = {}) { return { data: { signedUrl: 'https://arquivos.teste/' + pasta + '/' + encodeURI(caminho) + (op && op.download ? '?download=' + encodeURIComponent(op.download) : '') }, error: null }; },
  async createSignedUrls(caminhos) { return { data: caminhos.map(c => ({ path: c, signedUrl: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="#5B82A6"/></svg>'), error: null })), error: null }; },
  async remove(caminhos) { caminhos.forEach(c => delete ARQUIVOS()[pasta + '/' + c]); console.log('MOCK REMOVE', pasta, caminhos.length); return { data: [], error: null }; }
}) };
// rpc: quem responde é o teste, por window.__mockRpc(nome, args) (o admissoes.py usa pro link público); sem ele, lista vazia
// quem está logado: o Samuel (sócio); o teste troca por window.__mockEmail (o precificacao-carteira.py entra como a Thalia)
const EMAIL = () => (typeof window !== 'undefined' && window.__mockEmail) || 'financeiro@macedoereis.com.br';
// a sessão de verdade, só no teste que liga (o trocar-senha.py): sessionStorage "mock_auth" = { logado, email, meta, senhas,
// log } — passa de uma tela pra outra como a sessão do Supabase; entrar confere a senha, updateUser troca a senha e o
// user_metadata (null apaga a chave, como o Supabase) e recusa a senha igual; sair desliga. Sem ele, todo mundo logado
const AUTH_LIGADO = () => { try { return !!sessionStorage.getItem('mock_auth'); } catch (e) { return false; } };
const lerAuth = () => JSON.parse(sessionStorage.getItem('mock_auth'));
const gravarAuth = a => sessionStorage.setItem('mock_auth', JSON.stringify(a));
const quemAuth = a => ({ email: a.email, user_metadata: { ...(a.meta || {}) } });
const authFalso = {
  getUser: async () => { if (!AUTH_LIGADO()) return { data: { user: { email: EMAIL() } } }; const a = lerAuth(); return { data: { user: a.logado ? quemAuth(a) : null } }; },
  getSession: async () => { if (!AUTH_LIGADO()) return { data: { session: { user: { email: EMAIL() } } } }; const a = lerAuth(); return { data: { session: a.logado ? { user: quemAuth(a) } : null } }; },
  signInWithPassword: async ({ email, password }) => {
    const a = lerAuth(), e = String(email || '').toLowerCase();
    a.log.push(['entrar', e]);
    if (!a.senhas || a.senhas[e] !== password) { gravarAuth(a); return { data: { user: null, session: null }, error: { code: 'invalid_credentials', message: 'Invalid login credentials' } }; }
    a.logado = true; a.email = e; gravarAuth(a);
    return { data: { user: quemAuth(a), session: { user: quemAuth(a) } }, error: null };
  },
  updateUser: async (attrs = {}) => {
    const a = lerAuth();
    a.log.push(['atualizar', attrs]);
    if (!a.logado) { gravarAuth(a); return { data: { user: null }, error: { code: 'session_not_found', message: 'Auth session missing!' } }; }
    if (attrs.password != null) {
      if (a.senhas[a.email] === attrs.password) { gravarAuth(a); return { data: { user: null }, error: { code: 'same_password', message: 'New password should be different from the old password.' } }; }
      a.senhas[a.email] = attrs.password;
    }
    if (attrs.data) { a.meta = a.meta || {}; Object.entries(attrs.data).forEach(([k, v]) => { if (v === null) delete a.meta[k]; else a.meta[k] = v; }); }
    gravarAuth(a);
    return { data: { user: quemAuth(a) }, error: null };
  },
  signOut: async () => { if (AUTH_LIGADO()) { const a = lerAuth(); a.log.push(['sair']); a.logado = false; gravarAuth(a); } return { error: null }; }
};
export const supabase = { from: q, auth: authFalso,
  rpc: async (nome, args) => (typeof window.__mockRpc === 'function' ? window.__mockRpc(nome, args || {}) : { data: [], error:null }) };
supabase.todosClientes = async () => ({ data: DATA.clientes, error:null });
supabase.channel = canal;
supabase.removeChannel = async () => 'ok';
supabase.realtime = { setAuth: async () => {} };
supabase.storage = storageFalso;
// Edge Functions: quem responde é o teste, por window.__mockInvoke(nome, { body }) (o cadastro-socios.py usa pra
// devolver uma leitura de contrato inventada). Sem ele, a chamada volta com erro — o harness nunca chama função de verdade
supabase.functions = { invoke: async (nome, opts) => (typeof window.__mockInvoke === 'function'
  ? window.__mockInvoke(nome, opts || {})
  : { data: null, error: { message: 'função ' + nome + ' fora do harness' } }) };
// igual ao helper de verdade (assets/js/supabase.js): busca em lotes de mil até o fim
supabase.todasLinhas = async function (montar) { const tudo = []; for (let i = 0; ; i += 1000) { const { data, error } = await montar().range(i, i + 999); if (error) return { data: tudo, error }; tudo.push(...(data || [])); if (!data || data.length < 1000) return { data: tudo, error: null }; } };
export async function getCurrentUser(){ return AUTH_LIGADO() ? (await authFalso.getUser()).data.user : { email: EMAIL() }; }
export async function signOut(){}
// o assistente do escritório (assets/js/assistente-escritorio.js) mostra um recado do dia na primeira tela: nos testes de
// tela ele ficaria por cima dos cliques — aqui fica quieto, salvo no teste dele (window.__assistenteRecados = true)
(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return !window.__assistenteRecados && String(k).startsWith('mr_assistente_dia:') ? '1' : g.call(this, k); }; })();
