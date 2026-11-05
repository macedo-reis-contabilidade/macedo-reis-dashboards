-- contabil_andamento.sql (RASCUNHO: a ponte não lê esta pasta): por empresa, até onde a contabilidade está lançada no
-- fim do mês. Os dois parâmetros são o primeiro e o último dia do mês. Tabelas: bethadba.ctlancto ("Lancamentos
-- Contabeis": data_lan, cdeb_lan e ccre_lan, as contas reduzidas do plano da CODI_EMP_PLANO, orig_lan, dorig_lan
-- "Data Original"), bethadba.ctcontas ("Contas Contabeis - Cadastro": clas_cta, tipo_cta e, só no filtro, nome_cta),
-- bethadba.ctparmto ("Parametros", uma linha por empresa com contabilidade) e o extrato:
-- bethadba.CTEXTRATO_BANCARIO_LANCAMENTO ("Lançamento de extrato bancário": CODI_CTA "Conta contábil do banco"), _ITEM
-- ("… - lançamentos": DATA_ITEM "Data", cada linha do extrato), _ITEM_LANCTO ("… - lançamentos contábeis": o lançamento
-- de cada linha) e bethadba.CTCONCILIACAO_BANCARIA ("Conciliação bancária": a linha do extrato com o lançamento e as
-- marcas CONCILIADO_DEB/CONCILIADO_CRE).
-- O caixa e os bancos pela classificação do plano (o plano modelo do escritório, que as empresas copiam): as analíticas
-- do 1.1.1.01 (CAIXA) e do 1.1.1.02 (BANCOS CONTA MOVIMENTO), fora a conta transitória ou "a classificar" que algumas
-- empresas têm dentro do caixa (pela descrição, só no filtro). As contas do extrato estão todas no 1.1.1.02 e a conta
-- caixa dos parâmetros (ccxa_par), no 1.1.1.01. Ficam de fora as aplicações (1.1.1.03) e a conta vinculada (1.1.3.01).
-- Fora o zeramento (orig_lan 2) em tudo; nada depois do último dia do mês.
-- banco_contas: as contas de banco com movimento nos 12 meses que terminam no mês (a sem movimento neles é a encerrada e
--   fica de fora); banco_ate: o último lançamento da mais atrasada delas; banco_ultimo: o da mais adiantada;
--   banco_ultimo_geral: o último lançamento em conta de banco de todo o tempo (separa o banco parado há mais de um ano
--   de quem nunca teve).
-- caixa_ate: o último lançamento no caixa (qualquer origem, de todo o tempo); caixa_contador_ate: o último que não veio
--   de integração (fora a escrita fiscal 4 a 11 e 21 a 29, a folha 13, o patrimônio 3 e os honorários 14 a 20) — o caixa
--   recebe a integração das notas à vista, que entra sozinha.
-- extrato_contas: as contas de banco com extrato nos 12 meses (importado ou digitado; em 2026 todo importado);
--   extrato_ate: o último dia do extrato da mais atrasada; extrato_pendentes: as linhas do extrato até o fim do mês (nos
--   12 meses) ainda sem lançamento. O extrato da Contabilidade Digital (as tabelas _ICEBERG) fica de fora.
-- conciliadas e conciliado_ate: as contas com linha do extrato conciliada nos 12 meses e o último dia conciliado da mais
--   atrasada. A conciliação nasce sozinha quando o extrato é contabilizado pela configuração (o lançamento feito à mão a
--   partir do extrato não ganha), então ela diz menos que o extrato.
-- lanc_*: as linhas do mês por origem — lanc_normais (1), lanc_extrato (39, o extrato importado: 98% delas estão no
--   _ITEM_LANCTO), lanc_fiscal (4 a 7), lanc_folha (13), lanc_apuracao (10) e lanc_outros (o resto, fora o zeramento).
-- incluido_ate: a maior dorig_lan dos lançamentos do mês (a data em que o lançamento entrou no Domínio; a hora não
--   existe). A ctlancto não guarda a data de alteração.
-- Entra a empresa com contabilidade (ctparmto) que tem lançamento no mês, movimento no caixa ou no banco até o mês, ou
-- extrato nos 12 meses.
WITH p AS (SELECT CAST(? AS DATE) AS ini, CAST(? AS DATE) AS fim),
j AS (SELECT p.ini, p.fim, DATEADD(month, -11, p.ini) AS de FROM p),
cta AS (
    SELECT c.codi_emp AS plano, c.codi_cta,
           CASE WHEN LEFT(TRIM(c.clas_cta), 5) = '11101' THEN 'C' ELSE 'B' END AS tipo
      FROM bethadba.ctcontas c
     WHERE c.tipo_cta = 'A' AND LEFT(TRIM(c.clas_cta), 5) IN ('11101', '11102')
       AND NOT (UPPER(c.nome_cta) LIKE '%TRANSIT_RI%' OR UPPER(c.nome_cta) LIKE '%_ CLASSIFICAR%'
                OR UPPER(c.nome_cta) LIKE '%_ IDENTIFICAR%' OR UPPER(c.nome_cta) LIKE '%N_O IDENTIFICAD%')
),
mov AS (
    SELECT l.codi_emp, cta.tipo, cta.codi_cta, l.data_lan, l.orig_lan
      FROM bethadba.ctlancto l JOIN cta ON cta.plano = l.CODI_EMP_PLANO AND cta.codi_cta = l.cdeb_lan, j
     WHERE l.data_lan <= j.fim AND l.orig_lan <> 2
    UNION ALL
    SELECT l.codi_emp, cta.tipo, cta.codi_cta, l.data_lan, l.orig_lan
      FROM bethadba.ctlancto l JOIN cta ON cta.plano = l.CODI_EMP_PLANO AND cta.codi_cta = l.ccre_lan, j
     WHERE l.data_lan <= j.fim AND l.orig_lan <> 2
),
porconta AS (
    SELECT mov.codi_emp, mov.codi_cta, MAX(mov.data_lan) AS ult_conta
      FROM mov, j WHERE mov.tipo = 'B' AND mov.data_lan >= j.de GROUP BY mov.codi_emp, mov.codi_cta
),
bancos AS (
    SELECT codi_emp, COUNT(*) AS n, MIN(ult_conta) AS ate, MAX(ult_conta) AS ultimo FROM porconta GROUP BY codi_emp
),
bgeral AS (
    SELECT codi_emp, MAX(data_lan) AS ult_geral FROM mov WHERE tipo = 'B' GROUP BY codi_emp
),
caixa AS (
    SELECT codi_emp, MAX(data_lan) AS ate,
           MAX(CASE WHEN orig_lan NOT IN (3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18, 19, 20,
                                          21, 22, 23, 24, 25, 26, 27, 28, 29) THEN data_lan END) AS contador
      FROM mov WHERE tipo = 'C' GROUP BY codi_emp
),
it AS (
    SELECT e.CODI_EMP AS codi_emp, e.CODI_CTA AS conta, i.DATA_ITEM AS dia,
           CASE WHEN EXISTS (SELECT 1 FROM bethadba.CTEXTRATO_BANCARIO_LANCAMENTO_ITEM_LANCTO x
                              WHERE x.CODI_EMP = i.CODI_EMP AND x.I_LANCAMENTO = i.I_LANCAMENTO AND x.I_ITEM = i.I_ITEM)
                THEN 1 ELSE 0 END AS lancado,
           CASE WHEN EXISTS (SELECT 1 FROM bethadba.CTCONCILIACAO_BANCARIA k
                              WHERE k.CODI_EMP = i.CODI_EMP AND k.I_LANCAMENTO = i.I_LANCAMENTO AND k.I_ITEM = i.I_ITEM
                                AND (k.CONCILIADO_DEB = 'S' OR k.CONCILIADO_CRE = 'S'))
                THEN 1 ELSE 0 END AS conciliado
      FROM bethadba.CTEXTRATO_BANCARIO_LANCAMENTO e
      JOIN bethadba.CTEXTRATO_BANCARIO_LANCAMENTO_ITEM i ON i.CODI_EMP = e.CODI_EMP AND i.I_LANCAMENTO = e.I_LANCAMENTO, j
     WHERE i.DATA_ITEM BETWEEN j.de AND j.fim
),
itconta AS (
    SELECT codi_emp, conta, MAX(dia) AS ult_item, SUM(1 - lancado) AS sem_lanc,
           MAX(CASE WHEN conciliado = 1 THEN dia END) AS ult_conc
      FROM it GROUP BY codi_emp, conta
),
extrato AS (
    SELECT codi_emp, COUNT(*) AS n, MIN(ult_item) AS ate, SUM(sem_lanc) AS pendentes,
           COUNT(ult_conc) AS conciliadas, MIN(ult_conc) AS conciliado_ate
      FROM itconta GROUP BY codi_emp
),
mes AS (
    SELECT l.codi_emp,
           SUM(CASE WHEN l.orig_lan = 1 THEN 1 ELSE 0 END) AS normais,
           SUM(CASE WHEN l.orig_lan = 39 THEN 1 ELSE 0 END) AS extrato,
           SUM(CASE WHEN l.orig_lan BETWEEN 4 AND 7 THEN 1 ELSE 0 END) AS fiscal,
           SUM(CASE WHEN l.orig_lan = 13 THEN 1 ELSE 0 END) AS folha,
           SUM(CASE WHEN l.orig_lan = 10 THEN 1 ELSE 0 END) AS apuracao,
           SUM(CASE WHEN l.orig_lan NOT IN (1, 39, 4, 5, 6, 7, 13, 10) THEN 1 ELSE 0 END) AS outros,
           MAX(l.dorig_lan) AS incluido
      FROM bethadba.ctlancto l, j
     WHERE l.data_lan BETWEEN j.ini AND j.fim AND l.orig_lan <> 2
     GROUP BY l.codi_emp
),
emp AS (
    SELECT codi_emp FROM bgeral UNION SELECT codi_emp FROM caixa
    UNION SELECT codi_emp FROM extrato UNION SELECT codi_emp FROM mes
)
SELECT emp.codi_emp AS codigo,
       COALESCE(bancos.n, 0) AS banco_contas,
       bancos.ate AS banco_ate,
       bancos.ultimo AS banco_ultimo,
       bgeral.ult_geral AS banco_ultimo_geral,
       caixa.ate AS caixa_ate,
       caixa.contador AS caixa_contador_ate,
       COALESCE(extrato.n, 0) AS extrato_contas,
       extrato.ate AS extrato_ate,
       COALESCE(extrato.pendentes, 0) AS extrato_pendentes,
       COALESCE(extrato.conciliadas, 0) AS conciliadas,
       extrato.conciliado_ate AS conciliado_ate,
       COALESCE(mes.normais, 0) AS lanc_normais,
       COALESCE(mes.extrato, 0) AS lanc_extrato,
       COALESCE(mes.fiscal, 0) AS lanc_fiscal,
       COALESCE(mes.folha, 0) AS lanc_folha,
       COALESCE(mes.apuracao, 0) AS lanc_apuracao,
       COALESCE(mes.outros, 0) AS lanc_outros,
       mes.incluido AS incluido_ate
  FROM emp
  JOIN bethadba.ctparmto par ON par.codi_emp = emp.codi_emp
  LEFT JOIN bancos ON bancos.codi_emp = emp.codi_emp
  LEFT JOIN bgeral ON bgeral.codi_emp = emp.codi_emp
  LEFT JOIN caixa ON caixa.codi_emp = emp.codi_emp
  LEFT JOIN extrato ON extrato.codi_emp = emp.codi_emp
  LEFT JOIN mes ON mes.codi_emp = emp.codi_emp
 ORDER BY emp.codi_emp
