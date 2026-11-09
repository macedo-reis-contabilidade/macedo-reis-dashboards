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

console.log('O PDF do relatório de situação fiscal no Drive (09/11/2026):');
const URL_PDF = 'https://drive.google.com/file/d/ARQ_teste-0001/view';
const comPdf = (empresa) => htmlDaReceita({ empresa: { pendencias: [], situacao_fiscal_em: '2026-11-03', situacao_fiscal_pdf_em: '2026-11-03', situacao_fiscal_pdf_url: URL_PDF, ...empresa } });
let hp = comPdf({});
chk('o do mesmo dia das pendências: "Abrir o relatório (PDF)", numa aba nova, sem o opener',
  hp.includes('<a href="' + URL_PDF + '" target="_blank" rel="noopener noreferrer">Abrir o relatório (PDF)</a>') && texto(hp).includes('(relatório de 03/11/2026). Abrir o relatório (PDF)'), hp);
chk('o rodapé diz onde ele fica no Drive', texto(hp).includes('fica na pasta da empresa no Drive, em FISCAL › SITUAÇÃO FISCAL'));
hp = texto(comPdf({ situacao_fiscal_pdf_em: '2026-10-05' }));
chk('um PDF de antes do relatório lido: com o dia dele', hp.includes('(relatório de 03/11/2026). Abrir o relatório de 05/10/2026 (PDF)'), hp);
hp = texto(comPdf({ situacao_fiscal_em: '2026-10-05', pendencias: [{ orgao: 'Receita', titulo: 'Débito' }] }));
chk('um PDF mais novo, que a ponte não conseguiu ler: as pendências de antes e o aviso pra conferir no PDF',
  hp.includes('1 pendência (relatório de 05/10/2026): Receita, Débito. O relatório de 03/11/2026 a ponte não conseguiu ler: abra o PDF pra conferir as pendências.'), hp);
hp = texto(comPdf({ pendencias: null, situacao_fiscal_em: null }));
chk('nenhum relatório lido, mas o PDF no Drive: a linha da situação fiscal com o PDF', hp.includes('Situação fiscal O relatório de 03/11/2026 a ponte não conseguiu ler: abra o PDF pra conferir as pendências.'), hp);
const torto = comPdf({ situacao_fiscal_pdf_url: 'javascript:alert(1)' }) + comPdf({ situacao_fiscal_pdf_url: 'https://drive.google.com.exemplo.com/file/d/ARQ_teste-0001/view' })
  + comPdf({ situacao_fiscal_pdf_url: 'https://drive.google.com/file/d/ARQ"><img src=x>/view' });
chk('endereço que não é o de um arquivo do Drive não vira link (nem aparece)', !/<a /.test(torto) && !torto.includes('javascript') && !torto.includes('exemplo.com') && !torto.includes('<img'), torto);
chk('sem o PDF, a linha fica como era', texto(htmlDaReceita({ empresa: { pendencias: [], situacao_fiscal_em: '2026-11-03' } })).includes('(relatório de 03/11/2026). ')
  && !htmlDaReceita({ empresa: { pendencias: [], situacao_fiscal_em: '2026-11-03' } }).includes('<a '));

console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
