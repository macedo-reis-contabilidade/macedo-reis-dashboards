// MOCK — dados inventados, só pro harness visual
const hoje = new Date(); const ymd = d => d.toISOString().slice(0,10);
const add = n => { const d = new Date(); d.setDate(d.getDate()+n); return ymd(d); };
const mesAtual = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0'); // o mês de referência padrão das telas
const T = (i, titulo, setor, resp, prazo, prio, extra={}) => ({ id:'t'+i, titulo, setor, responsavel:resp, prazo, status:'pendente', prioridade:prio, cliente_id:null, proposta_id:null, hora:null, transicao_id:null, posicao:i*10, clientes:extra.cli?{nome_principal:extra.cli, documento:'00000000000000'}:null, concluida_em:null, concluida_por:null, ...extra });
const DATA = {
  tarefas: [
    T(1,'Enviar guias do mês','fiscal','Thalia',add(0),'alta',{cli:'EMPRESA EXEMPLO LTDA'}),
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
    T(14,'Fechamento contábil','contabil','Adaini',add(12),'media',{cli:'COMÉRCIO MODELO ME'}),
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
  alvaras:[], carteira_info:[], rt_casos:[], faturaveis:[], tarefa_historico:[], servicos_avulsos:[],
  // Propostas → transição (tests/harness/proposta-transicao.py): uma apresentada, uma fechada sem transição e uma fechada com
  precificacoes: [
    { id:'pp1', cliente_nome:'PADARIA FICTÍCIA LTDA', contato:'51900000001', cliente_id:null, origem:'interna', status:'apresentada', respostas:{ A1:'PADARIA FICTÍCIA LTDA' }, resultado:null, honorario:650, taxa_unica:null, observacao:null, criado_por:'samuel@macedoereis.com.br', criado_em:add(-2)+'T12:00:00Z', atualizado_em:add(-2)+'T12:00:00Z' },
    { id:'pp2', cliente_nome:'OFICINA MODELO LTDA', contato:'51900000002', cliente_id:null, origem:'externa', status:'fechada', respostas:{ A1:'OFICINA MODELO LTDA' }, resultado:null, honorario:900, taxa_unica:450, observacao:null, criado_por:'Contato Teste', criado_em:add(-5)+'T12:00:00Z', atualizado_em:add(-1)+'T12:00:00Z' },
    { id:'pp3', cliente_nome:'CONFECÇÃO TESTE LTDA', contato:null, cliente_id:null, origem:'interna', status:'fechada', respostas:{ A1:'CONFECÇÃO TESTE LTDA' }, resultado:null, honorario:1200, taxa_unica:null, observacao:null, criado_por:'diego@macedoereis.com.br', criado_em:add(-20)+'T12:00:00Z', atualizado_em:add(-15)+'T12:00:00Z' },
  ],
  transicoes: [
    { id:'tx1', titulo:'CONFECÇÃO TESTE LTDA', tipo:'entrada', proposta_id:'pp3', padrinho:null, inicio:add(-15), previsao_fim:add(75), tera_funcionarios:null, contato:null, observacao:'Aberta a partir da proposta fechada.', status:'em_andamento', concluida_em:null, criado_em:add(-15)+'T12:00:00Z', transicao_empresas:[] },
  ],
  // Tarefas recorrentes por setor (assets/js/rotinas-setor.js; teste em tests/harness/rotinas-setor.py)
  rotinas_modelo: [
    { id:'rm1', setor:'dp', nome:'FOLHA DE PAGAMENTO (TESTE)', ativo:true },
    { id:'rm2', setor:'contabil', nome:'CONCILIAÇÃO BANCÁRIA (TESTE)', ativo:true },
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
function q(table){
  const rows = DATA[table] || (DATA[table] = []);
  const self = { _head:false };
  const chain = new Proxy(self, { get(t, k){
    if (k==='then') return (res, rej) => { let data = self._ins || rows.filter(r => (self._f||[]).every(([k,col,v,v2]) => { const x = r[col]; if (k==='in') return v.includes(x); if (k==='eq') return x===v; if (k==='neq') return x!==v; if (k==='is') return x==v; if (k==='not') return !(x==v2); if (x==null) return false; if (k==='lt') return x<v; if (k==='lte') return x<=v; if (k==='gt') return x>v; if (k==='gte') return x>=v; return true; })); if (self._patch) { data.forEach(r => Object.assign(r, self._patch)); console.log('MOCK UPDATE', table, data.length); } const out = { data: self._head ? null : copia(data), error:null, count: data.length }; return responder(out).then(res, rej); };
    if (k==='select') return (c, o) => { if (o && o.head) self._head = true; return chain; };
    if (k==='update') return (patch) => { self._patch = patch; return chain; };
    if (k==='in') return (col, vals) => { (self._f ||= []).push(['in',col,vals]); return chain; };
    if (k==='insert') return (payload) => { const arr = (Array.isArray(payload)?payload:[payload]).map(r => ({ id: 'n'+(seq++), ...r })); rows.push(...arr); self._ins = arr; console.log('MOCK INSERT', table, JSON.stringify(arr)); return chain; };
    if (['lt','lte','gt','gte','eq','neq','is','not'].includes(k)) return (col, v, v2) => { (self._f ||= []).push([k,col,v,v2]); return chain; };
    if (k==='single' || k==='maybeSingle') return () => responder({ data: copia((self._ins||rows)[0]||null), error:null });
    return () => chain;
  }});
  return chain;
}
export const supabase = { from: q, auth: { getUser: async () => ({ data: { user: { email:'financeiro@macedoereis.com.br' } } }), getSession: async () => ({ data: { session: { user: { email:'financeiro@macedoereis.com.br' } } } }) }, rpc: async () => ({ data: [], error:null }) };
supabase.todosClientes = async () => ({ data: DATA.clientes, error:null });
// igual ao helper de verdade (assets/js/supabase.js): busca em lotes de mil até o fim
supabase.todasLinhas = async function (montar) { const tudo = []; for (let i = 0; ; i += 1000) { const { data, error } = await montar().range(i, i + 999); if (error) return { data: tudo, error }; tudo.push(...(data || [])); if (!data || data.length < 1000) return { data: tudo, error: null }; } };
export async function getCurrentUser(){ return { email:'financeiro@macedoereis.com.br' }; }
export async function signOut(){}
