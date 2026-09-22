// MOCK — dados inventados, só pro harness visual
const hoje = new Date(); const ymd = d => d.toISOString().slice(0,10);
const add = n => { const d = new Date(); d.setDate(d.getDate()+n); return ymd(d); };
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
  ],
  rotinas: [
    { id:'r1', titulo:'Conferir e-mail', setor:'gestao', responsavel:'Samuel', ativo:true, periodicidade:'diaria', ultima_execucao:ymd(hoje), adiada_para:null },
    { id:'r3', titulo:'Financeiro escritório: diário', setor:'financeiro', responsavel:'Samuel', ativo:true, periodicidade:'diaria', ultima_execucao:null, adiada_para:null },
    { id:'r4', titulo:'Conciliação bancária', setor:'contabil', responsavel:'Adaini', ativo:true, periodicidade:'diaria', ultima_execucao:null, adiada_para:null },
  ],
  clientes: [{id:'c1',nome_principal:'COMÉRCIO MODELO ME',documento:'00000000000000',status:'ativo',regime:'simples'},{id:'c2',nome_principal:'EMPRESA EXEMPLO LTDA',documento:'11111111111111',status:'ativo',regime:'presumido'}],
  alvaras:[], transicoes:[], precificacoes:[], carteira_info:[], rt_casos:[], faturaveis:[], tarefa_historico:[], tarefas_recorrentes:[], servicos_avulsos:[],
};
let seq = 1000;
function q(table){
  const rows = DATA[table] || (DATA[table] = []);
  const self = { _head:false };
  const chain = new Proxy(self, { get(t, k){
    if (k==='then') return (res, rej) => { let data = self._ins || rows.filter(r => (self._f||[]).every(([k,col,v,v2]) => { const x = r[col]; if (k==='in') return v.includes(x); if (k==='eq') return x===v; if (k==='neq') return x!==v; if (k==='is') return x==v; if (k==='not') return !(x==v2); if (x==null) return false; if (k==='lt') return x<v; if (k==='lte') return x<=v; if (k==='gt') return x>v; if (k==='gte') return x>=v; return true; })); if (self._patch) { data.forEach(r => Object.assign(r, self._patch)); console.log('MOCK UPDATE', table, data.length); } const out = { data: self._head ? null : data, error:null, count: data.length }; return Promise.resolve(out).then(res, rej); };
    if (k==='select') return (c, o) => { if (o && o.head) self._head = true; return chain; };
    if (k==='update') return (patch) => { self._patch = patch; return chain; };
    if (k==='in') return (col, vals) => { (self._f ||= []).push(['in',col,vals]); return chain; };
    if (k==='insert') return (payload) => { const arr = (Array.isArray(payload)?payload:[payload]).map(r => ({ id: 'n'+(seq++), ...r })); rows.push(...arr); self._ins = arr; console.log('MOCK INSERT', table, JSON.stringify(arr)); return chain; };
    if (['lt','lte','gt','gte','eq','neq','is','not'].includes(k)) return (col, v, v2) => { (self._f ||= []).push([k,col,v,v2]); return chain; };
    if (k==='single' || k==='maybeSingle') return () => Promise.resolve({ data: (self._ins||rows)[0]||null, error:null });
    return () => chain;
  }});
  return chain;
}
export const supabase = { from: q, auth: { getUser: async () => ({ data: { user: { email:'financeiro@macedoereis.com.br' } } }), getSession: async () => ({ data: { session: { user: { email:'financeiro@macedoereis.com.br' } } } }) }, rpc: async () => ({ data: [], error:null }) };
supabase.todosClientes = async () => ({ data: DATA.clientes, error:null });
export async function getCurrentUser(){ return { email:'financeiro@macedoereis.com.br' }; }
export async function signOut(){}
