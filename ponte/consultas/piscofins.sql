-- piscofins.sql (versão 5 do pacote, 11/11/2026: o Comparativo tributário; escrita e conferida no Domínio pela fila de
-- 11/11, o rascunho comparativo_piscofins.sql): por empresa, a venda do mês pela situação tributária (CST) do PIS e a
-- apuração do PIS e da Cofins. Os dois parâmetros são o primeiro e o último dia do mês.
-- Tabelas: bethadba.efsaidas e bethadba.efservicos (os segmentos de faturamento: o corte do faturamento.sql, IFAT_ACU =
-- 'S' na bethadba.EFACUMULADOR_VIGENCIA; fora a cancelada, denegada e inutilizada), bethadba.efmvspro ("Notas Fiscais de
-- Saida - Produtos", o item: cst_pis_msp "CST do PIS", cst_cofins_msp "CST do COFINS", VALOR_CONTABIL_MSP "Valor contabil
-- produto"), bethadba.EFSERVICOS_PIS_COFINS ("Notas Fiscais de Servico - PIS/COFINS": CST, VALOR_CONTABIL) e
-- bethadba.efsdoimp ("Saldo dos Impostos", a apuração do mês, pdic_sim 6 = mensal: codi_imp 4 PIS e 5 COFINS, do
-- cumulativo; 17 PIS-MP66 e 19 COFINS-N, do não cumulativo; bcal_sim "Base de calculo do imposto", vims_sim "Valor do
-- imposto de saidas", vimv_sim "Valor do imposto de servicos", vime_sim "Valor do imposto de entradas", sdev_sim "Saldo
-- a Recolher"). A apuração separa as saídas e os serviços (de 10/2024 a 09/2026, 48 linhas do 4 e do 5 com o serviço).
-- O CST está no ITEM da nota: o do segmento (CST_PISCOFINS_SAI) e o do acumulador (CODIGO_CST_PISCOFINS_SAIDA_ACU) estão
-- vazios em 09/2026. No Simples o item não tem o CST (o PIS e a Cofins vão no DAS; o monofásico do Simples sai da
-- apuração, no faturamento.sql): a venda do Simples cai toda em pc_sem_cst.
-- Os grupos, pelo CST do PIS do item (o da Cofins é igual em todos os itens de 09/2026 menos 1):
--   pc_tributada 01, 02 e 03 · pc_monofasica 04 · pc_st 05 · pc_aliquota_zero 06 · pc_isenta 07 · pc_sem_incidencia 08
--   · pc_suspensa 09 · pc_outras 49, 99 e o resto · pc_sem_cst: o valor do segmento que não está em item com CST (o
--   segmento sem item, o item sem CST e a diferença entre o segmento e os itens).
-- Da apuração: base_pis_cofins (a base do PIS, 4 ou 17), pis_apurado e cofins_apurada (o débito das saídas e dos
-- serviços),
-- creditos_pis_cofins (o crédito do não cumulativo, 17 e 19) e pis_cofins_a_recolher (o saldo a recolher dos quatro).
-- A soma dos grupos é a receita do faturamento.sql antes da devolução (receita_mercadorias + receita_servicos).
-- Pelo dominio sql, a trava do dado pessoal não mostra coluna com "pis" no nome: embrulhe numa contagem (pela ponte, a
-- trava não vale). Uma linha por empresa com faturamento ou apuração no mês.
WITH p AS (SELECT CAST(? AS DATE) AS ini, CAST(? AS DATE) AS fim),
v AS (
    SELECT a.CODI_EMP, a.CODI_ACU, a.IFAT_ACU
      FROM bethadba.EFACUMULADOR_VIGENCIA a, p
     WHERE a.VIGENCIA_ACU = (SELECT MAX(b.VIGENCIA_ACU) FROM bethadba.EFACUMULADOR_VIGENCIA b
                              WHERE b.CODI_EMP = a.CODI_EMP AND b.CODI_ACU = a.CODI_ACU AND b.VIGENCIA_ACU <= p.fim)
),
seg AS (
    SELECT 'S' AS lado, s.codi_emp, s.codi_sai AS codi, COALESCE(s.vcon_sai, 0) AS vl
      FROM bethadba.efsaidas s JOIN v ON v.CODI_EMP = s.codi_emp AND v.CODI_ACU = s.codi_acu, p
     WHERE s.dsai_sai BETWEEN p.ini AND p.fim
       AND COALESCE(s.situacao_sai, 0) NOT IN (2, 3, 4, 5)
       AND COALESCE(s.cancelada_sai, 'N') <> 'S'
       AND v.IFAT_ACU = 'S'
    UNION ALL
    SELECT 'V', r.codi_emp, r.codi_ser, COALESCE(r.vcon_ser, 0)
      FROM bethadba.efservicos r JOIN v ON v.CODI_EMP = r.codi_emp AND v.CODI_ACU = r.codi_acu, p
     WHERE r.dser_ser BETWEEN p.ini AND p.fim
       AND COALESCE(r.situacao_ser, 0) NOT IN (2, 3, 4, 5)
       AND COALESCE(r.cancelada_ser, 'N') <> 'S'
       AND v.IFAT_ACU = 'S'
),
it AS (
    SELECT 'S' AS lado, m.codi_emp, m.codi_sai AS codi, m.cst_pis_msp AS cst, COALESCE(m.VALOR_CONTABIL_MSP, 0) AS vl
      FROM bethadba.efmvspro m JOIN seg ON seg.lado = 'S' AND seg.codi_emp = m.codi_emp AND seg.codi = m.codi_sai
     WHERE COALESCE(m.cst_pis_msp, 0) <> 0
    UNION ALL
    SELECT 'V', x.CODI_EMP, x.CODI_SER, x.CST, COALESCE(x.VALOR_CONTABIL, 0)
      FROM bethadba.EFSERVICOS_PIS_COFINS x JOIN seg ON seg.lado = 'V' AND seg.codi_emp = x.CODI_EMP AND seg.codi = x.CODI_SER
     WHERE COALESCE(x.CST, 0) <> 0
),
cst AS (
    SELECT it.codi_emp,
           SUM(CASE WHEN it.cst IN (1, 2, 3) THEN it.vl ELSE 0 END) AS trib,
           SUM(CASE WHEN it.cst = 4 THEN it.vl ELSE 0 END) AS mono,
           SUM(CASE WHEN it.cst = 5 THEN it.vl ELSE 0 END) AS st,
           SUM(CASE WHEN it.cst = 6 THEN it.vl ELSE 0 END) AS zero,
           SUM(CASE WHEN it.cst = 7 THEN it.vl ELSE 0 END) AS isenta,
           SUM(CASE WHEN it.cst = 8 THEN it.vl ELSE 0 END) AS sem_inc,
           SUM(CASE WHEN it.cst = 9 THEN it.vl ELSE 0 END) AS susp,
           SUM(CASE WHEN it.cst NOT BETWEEN 1 AND 9 THEN it.vl ELSE 0 END) AS outras,
           SUM(it.vl) AS com_cst
      FROM it GROUP BY it.codi_emp
),
tot AS (SELECT seg.codi_emp, SUM(seg.vl) AS total FROM seg GROUP BY seg.codi_emp),
ap AS (
    SELECT s.codi_emp,
           SUM(CASE WHEN s.codi_imp IN (4, 17) THEN s.bcal_sim ELSE 0 END) AS base,
           SUM(CASE WHEN s.codi_imp IN (4, 17) THEN s.vims_sim + s.vimv_sim ELSE 0 END) AS deb_p,
           SUM(CASE WHEN s.codi_imp IN (5, 19) THEN s.vims_sim + s.vimv_sim ELSE 0 END) AS deb_c,
           SUM(CASE WHEN s.codi_imp IN (17, 19) THEN s.vime_sim ELSE 0 END) AS cred,
           SUM(s.sdev_sim) AS saldo
      FROM bethadba.efsdoimp s, p
     WHERE s.codi_imp IN (4, 5, 17, 19) AND s.pdic_sim = 6 AND s.data_sim BETWEEN p.ini AND p.fim
     GROUP BY s.codi_emp
),
emp AS (SELECT codi_emp FROM tot UNION SELECT codi_emp FROM ap)
SELECT emp.codi_emp AS codigo,
       CAST(COALESCE(cst.trib, 0) AS NUMERIC(15,2)) AS pc_tributada,
       CAST(COALESCE(cst.mono, 0) AS NUMERIC(15,2)) AS pc_monofasica,
       CAST(COALESCE(cst.st, 0) AS NUMERIC(15,2)) AS pc_st,
       CAST(COALESCE(cst.zero, 0) AS NUMERIC(15,2)) AS pc_aliquota_zero,
       CAST(COALESCE(cst.isenta, 0) AS NUMERIC(15,2)) AS pc_isenta,
       CAST(COALESCE(cst.sem_inc, 0) AS NUMERIC(15,2)) AS pc_sem_incidencia,
       CAST(COALESCE(cst.susp, 0) AS NUMERIC(15,2)) AS pc_suspensa,
       CAST(COALESCE(cst.outras, 0) AS NUMERIC(15,2)) AS pc_outras,
       CAST(COALESCE(tot.total, 0) - COALESCE(cst.com_cst, 0) AS NUMERIC(15,2)) AS pc_sem_cst,
       CAST(ap.base AS NUMERIC(15,2)) AS base_pis_cofins,
       CAST(ap.deb_p AS NUMERIC(15,2)) AS pis_apurado,
       CAST(ap.deb_c AS NUMERIC(15,2)) AS cofins_apurada,
       CAST(ap.cred AS NUMERIC(15,2)) AS creditos_pis_cofins,
       CAST(ap.saldo AS NUMERIC(15,2)) AS pis_cofins_a_recolher
  FROM emp
  LEFT JOIN tot ON tot.codi_emp = emp.codi_emp
  LEFT JOIN cst ON cst.codi_emp = emp.codi_emp
  LEFT JOIN ap ON ap.codi_emp = emp.codi_emp
 ORDER BY emp.codi_emp
