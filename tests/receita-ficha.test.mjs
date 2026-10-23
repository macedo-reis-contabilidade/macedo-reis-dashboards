// A Receita na ficha da empresa (assets/js/receita-ficha.js, 23/10/2026): o que a ponte da Receita consultou, em texto
// escapado, e nada quando ela ainda não consultou. Dados inventados. Rodar com: node tests/receita-ficha.test.mjs
import { htmlDaReceita, temDado, diaEmBrasilia } from '../assets/js/receita-ficha.js';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); };
const texto = h => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

console.log('Sem consulta:');
chk('sem dado nenhum, nada', htmlDaReceita(null) === '' && htmlDaReceita({ empresa: null, pgdas: [], mensagens: [] }) === '' && !temDado({}));

console.log('Com a consulta:');
const d = {
  empresa: { autorizacao: 'ativa', autorizacao_ate: '2027-03-31', autorizacao_em: '2026-10-21T02:30:00Z', pgdas_em: '2026-10-20T12:00:00Z',
    pendencias: [], situacao_fiscal_em: '2026-10-05' },
  pgdas: [{ competencia: '2026-08', transmitida_em: '2026-09-15T13:00:00Z', das_pago: true },
    { competencia: '2026-09', transmitida_em: null, das_pago: null, receita_mes: 1000.5, receita_12_meses: 120000 }],
  mensagens: [{ assunto: 'Aviso <b>importante</b> & "urgente"', enviada_em: '2026-10-20', origem: 'Município', lida: false }]
};
const h = htmlDaReceita(d), t = texto(h);
chk('a autorização com a data', t.includes('O escritório tem a autorização de acesso até 31/03/2027.'));
chk('sem pendência, com o dia do relatório', t.includes('Sem pendência na Receita e na PGFN (relatório de 05/10/2026).'));
chk('o PGDAS do mais recente pro mais antigo; sem transmissão em destaque', t.indexOf('09/2026: sem transmissão') < t.indexOf('08/2026: transmitido em 15/09/2026 · DAS pago'), t);
chk('o faturamento com centavos, em reais', t.includes('Receita bruta de 09/2026: R$ 1.000,50 · nos 12 meses anteriores: R$ 120.000,00'));
chk('o assunto escapado (sem virar HTML)', h.includes('Aviso &lt;b&gt;importante&lt;/b&gt; &amp; &quot;urgente&quot;') && !h.includes('<b>importante'));
chk('de onde veio e se foi lida', t.includes('(Município) · não lida'));
chk('a última consulta é o dia em Brasília (21/10 02h30 em UTC = 20/10)', t.includes('a última vez em 20/10/2026'), t);
const sem = texto(htmlDaReceita({ empresa: { autorizacao: 'sem' }, pgdas: [], mensagens: [] }));
chk('sem autorização: o que fazer', sem.includes('A Receita recusou a consulta') && sem.includes('Minhas Autorizações de Acesso'));
const pend = texto(htmlDaReceita({ empresa: { pendencias: [{ orgao: 'PGFN', titulo: 'Inscrição <x>' }], situacao_fiscal_em: '2026-10-05' } }));
chk('uma pendência, com o órgão', pend.includes('1 pendência (relatório de 05/10/2026): PGFN, Inscrição &lt;x&gt;.'), pend);
chk('o dia em Brasília de um carimbo', diaEmBrasilia('2026-10-24T02:59:00Z') === '2026-10-23' && diaEmBrasilia(null) === null && diaEmBrasilia('x') === null);

console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
