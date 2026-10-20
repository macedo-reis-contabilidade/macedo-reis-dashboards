// ============================================================
// MACEDO & REIS — Feed de notícias: a carteira, pra IA e pra ligar a notícia aos clientes (20/10/2026)
// perfilDaCarteira(clientes) → o retrato da carteira em texto (quantos por regime, cidade, CNAE, obrigação, folha), sem
// nome de cliente: é o que a IA lê pra dizer QUEM a notícia alcança — em critérios (regime, CNAE, cidade, obrigação,
// natureza, com funcionários, com pró-labore). clientesDosCriterios(criterios, clientes) → os ids dos clientes que batem,
// pelo banco, não pela IA (ela não vê nomes e não inventa cliente). Puro — testes em tests/noticias.test.mjs.
// ============================================================

export const semAcento = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
export const digitos = s => String(s == null ? '' : s).replace(/\D/g, '');
const lista = v => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]).map(x => String(x == null ? '' : x).trim()).filter(Boolean);

// o CNAE "4754-7/01 - Comércio varejista de móveis" → { codigo: '4754701', rotulo: '4754-7/01 Comércio varejista de móveis' }
export function cnaeDe(txt) {
  const t = String(txt || '').trim();
  const d = digitos(t.split(/\s[-–]\s/)[0]).slice(0, 7);
  if (d.length < 2) return null;
  const desc = t.includes(' - ') ? t.slice(t.indexOf(' - ') + 3).trim() : t.includes(' – ') ? t.slice(t.indexOf(' – ') + 3).trim() : '';
  const cod = d.length === 7 ? d.slice(0, 4) + '-' + d[4] + '/' + d.slice(5) : d;
  return { codigo: d, rotulo: (cod + (desc ? ' ' + desc : '')).slice(0, 160) };
}

// montarClientes({ clientes, obrigacoes, rotinasDp }) → a carteira no formato da busca:
//   clientes: [{ id, nome_principal, regime_tributario, cidade, uf, cnae_principal, cnaes_secundarios, natureza_juridica, tipo_pessoa }]
//   obrigacoes: [{ cliente_id, nome }] (as vinculadas, ativas) · rotinasDp: [{ cliente_id, nome }] (as tarefas recorrentes do DP)
const FOLHA = /\b13\s*[º°O]?\b|13º|DECIMO|FOLHA|ADIANTAMENTO SALARIAL|FERIAS|ADMISS/;
const PROLABORE = /PRO.?LABORE/;
export function montarClientes({ clientes = [], obrigacoes = [], rotinasDp = [] } = {}) {
  const porCli = (rows) => { const m = new Map(); rows.forEach(r => { const a = m.get(r.cliente_id) || []; a.push(r.nome); m.set(r.cliente_id, a); }); return m; };
  const mObr = porCli(obrigacoes), mDp = porCli(rotinasDp);
  return clientes.map(c => {
    const cnaes = [cnaeDe(c.cnae_principal), ...lista(c.cnaes_secundarios).map(cnaeDe)].filter(Boolean);
    const dp = (mDp.get(c.id) || []).map(semAcento);
    return {
      id: c.id, nome: c.nome_principal || '', regime: c.regime_tributario || '', cidade: c.cidade || '', uf: c.uf || '',
      natureza: c.natureza_juridica || '', tipo: c.tipo_pessoa || '',
      cnaePrincipal: cnaes.length && cnaeDe(c.cnae_principal) ? cnaes[0] : null,
      cnaes, obrigacoes: (mObr.get(c.id) || []).map(semAcento),
      funcionarios: dp.some(n => FOLHA.test(n)), prolabore: dp.some(n => PROLABORE.test(n))
    };
  });
}

function contar(itens) {
  const m = new Map();
  itens.forEach(x => { if (x) m.set(x, (m.get(x) || 0) + 1); });
  return [...m.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), 'pt-BR'));
}
// o retrato da carteira em texto (vai no prompt da triagem, com cache)
export function perfilDaCarteira(cs) {
  const n = cs.length;
  const linhas = [`Carteira de hoje: ${n} clientes (empresas e MEIs atendidos pelo escritório).`];
  linhas.push('Por regime tributário: ' + contar(cs.map(c => c.regime || 'sem regime')).map(([k, v]) => `${k} ${v}`).join(' · ') + '.');
  const cid = contar(cs.map(c => (c.cidade ? c.cidade + (c.uf ? '/' + c.uf : '') : 'sem cidade')));
  linhas.push('Por cidade: ' + cid.map(([k, v]) => `${k} ${v}`).join(' · ') + '.');
  linhas.push('Por natureza jurídica: ' + contar(cs.map(c => c.natureza || 'não informada')).map(([k, v]) => `${k} ${v}`).join(' · ') + '.');
  linhas.push(`Folha: ${cs.filter(c => c.funcionarios).length} clientes com funcionários registrados (o escritório faz a folha, o 13º e o eSocial); ${cs.filter(c => c.prolabore).length} com pró-labore dos sócios.`);
  const principal = contar(cs.map(c => c.cnaePrincipal && c.cnaePrincipal.rotulo));
  const todos = new Map();
  cs.forEach(c => c.cnaes.forEach(x => todos.set(x.rotulo, (todos.get(x.rotulo) || 0) + 1)));
  linhas.push('Atividades (CNAE principal, com quantos clientes):');
  principal.forEach(([k, v]) => linhas.push(`- ${k}: ${v}`));
  const sec = [...todos.entries()].filter(([k]) => !principal.some(([p]) => p === k)).sort((a, b) => b[1] - a[1]);
  if (sec.length) {
    linhas.push('Outras atividades que aparecem como CNAE secundário (com quantos clientes):');
    sec.forEach(([k, v]) => linhas.push(`- ${k}: ${v}`));
  }
  linhas.push('Obrigações que o escritório cumpre pelos clientes (nome no sistema, com quantos clientes):');
  contar(cs.flatMap(c => [...new Set(c.obrigacoes)])).forEach(([k, v]) => linhas.push(`- ${k}: ${v}`));
  return linhas.join('\n');
}

// os critérios da IA → os clientes: dentro de cada lista vale qualquer um; entre as listas, todas (E).
// { todos, regimes, cnaes (prefixos de 2 a 7 dígitos, do principal ou secundário), cidades, obrigacoes (trecho do nome),
//   naturezas (trecho), com_funcionarios, com_prolabore }. Sem nenhum critério e sem "todos": ninguém (notícia geral)
export function clientesDosCriterios(c, clientes) {
  if (!c || typeof c !== 'object') return [];
  const regimes = lista(c.regimes).map(semAcento);
  const cnaes = lista(c.cnaes).map(digitos).filter(x => x.length >= 2);
  const cidades = lista(c.cidades).map(x => semAcento(x.split('/')[0]));
  const obrig = lista(c.obrigacoes).map(semAcento).filter(x => x.length >= 3);
  const nats = lista(c.naturezas).map(semAcento).filter(x => x.length >= 3);
  const func = c.com_funcionarios === true, pro = c.com_prolabore === true;
  const algum = regimes.length || cnaes.length || cidades.length || obrig.length || nats.length || func || pro;
  if (!algum && c.todos !== true) return [];
  return clientes.filter(k =>
    (!regimes.length || regimes.includes(semAcento(k.regime))) &&
    (!cnaes.length || k.cnaes.some(x => cnaes.some(p => x.codigo.startsWith(p)))) &&
    (!cidades.length || cidades.includes(semAcento(k.cidade))) &&
    (!obrig.length || k.obrigacoes.some(o => obrig.some(t => o.includes(t)))) &&
    (!nats.length || nats.some(t => semAcento(k.natureza).includes(t))) &&
    (!func || k.funcionarios) && (!pro || k.prolabore)
  ).map(k => k.id);
}
