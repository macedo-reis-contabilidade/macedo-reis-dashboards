-- resultado.sql (versão 5 do pacote, 11/11/2026: o Comparativo tributário; escrita e conferida no Domínio pela fila de
-- 11/11, o rascunho comparativo_resultado.sql): por empresa, o resultado da contabilidade no mês antes do IRPJ e da CSLL
-- (o lucro que o Lucro Real tributa). Os dois parâmetros são o primeiro e o último dia do mês.
-- Tabelas: bethadba.ctlancto ("Lancamentos Contabeis": cdeb_lan e ccre_lan, as contas do plano da CODI_EMP_PLANO;
-- vlor_lan; data_lan; orig_lan, fora o 2, o zeramento), bethadba.ctcontas ("Contas Contabeis - Cadastro": clas_cta e
-- tipo_cta; a descrição, nome_cta, SÓ nos filtros — nunca sai daqui) e bethadba.ctnatureza_conta (a natureza do grupo 3
-- e do 4, como no cruzamentos.sql). A empresa é a do lançamento (codi_emp): o resultado é o da contabilidade dela.
-- As contas de resultado: as analíticas do grupo 3 (custos e despesas), do 4 (receitas) e do 5.1 (os custos do vendido),
-- pelo plano modelo do escritório; fora o 5.1.4 (a apuração do resultado, o destino do zeramento) e o 6 (compensação).
-- No plano em que a natureza diz o 3 credor e o 4 devedor (as receitas no 3), os mesmos grupos.
-- As contas do IRPJ e da CSLL, pela descrição (dentro do filtro): IRPJ, IMPOSTO DE RENDA, CSLL ou CONTRIBUIÇÃO SOCIAL,
-- fora as de pessoal (o 3.2.1 e o 3.2.2.01, onde a "contribuição social" é encargo). No escritório elas estão nas
-- deduções da receita (o 4.1.2.03, em 306 planos; o 3.1.2.03 no plano invertido) e na provisão (o 3.2.2.03, em 9
-- planos); de 10/2025 a 09/2026, só as das deduções tiveram lançamento (7 planos).
-- resultado_antes_ir: o crédito menos o débito do mês nas contas de resultado, sem as do IRPJ e da CSLL (positivo =
--   lucro, negativo = prejuízo).
-- irpj_csll_lancados: o débito do mês nas contas do IRPJ e da CSLL.
-- receitas_financeiras: o crédito do mês nas analíticas das receitas financeiras (o 4.1.3 do modelo; o 3.1.3 no plano
--   invertido).
-- lanc_resultado: quantos lançamentos do mês tocam uma conta de resultado (zero = a contabilidade do mês não foi feita).
-- Uma linha por empresa com lançamento em conta de resultado no mês.
WITH p AS (SELECT CAST(? AS DATE) AS ini, CAST(? AS DATE) AS fim),
gr AS (
    SELECT DISTINCT n3.codi_emp AS plano
      FROM bethadba.ctnatureza_conta n3
      JOIN bethadba.ctnatureza_conta n4 ON n4.codi_emp = n3.codi_emp AND TRIM(n4.clas_cta) = '4'
     WHERE TRIM(n3.clas_cta) = '3' AND n3.natureza = 'C' AND n4.natureza = 'D'
),
ca AS (
    SELECT c.codi_emp AS plano, c.codi_cta,
           CASE WHEN UPPER(c.nome_cta) LIKE '%IRPJ%' OR UPPER(c.nome_cta) LIKE '%IMPOSTO DE RENDA%'
                  OR UPPER(c.nome_cta) LIKE '%CSLL%' OR UPPER(c.nome_cta) LIKE '%CONTRIBUI__O SOCIAL%'
                THEN 1 ELSE 0 END AS ircs,
           CASE WHEN LEFT(TRIM(c.clas_cta), 3) = CASE WHEN gr.plano IS NULL THEN '413' ELSE '313' END
                THEN 1 ELSE 0 END AS financeira
      FROM bethadba.ctcontas c
      LEFT JOIN gr ON gr.plano = c.codi_emp
     WHERE c.tipo_cta = 'A'
       AND (LEFT(TRIM(c.clas_cta), 1) IN ('3', '4')
            OR (LEFT(TRIM(c.clas_cta), 2) = '51' AND LEFT(TRIM(c.clas_cta), 3) <> '514'))
       AND NOT (LEFT(TRIM(c.clas_cta), 3) = '321' OR LEFT(TRIM(c.clas_cta), 5) = '32201')
     UNION ALL
    SELECT c.codi_emp, c.codi_cta, 0, 0
      FROM bethadba.ctcontas c
     WHERE c.tipo_cta = 'A' AND (LEFT(TRIM(c.clas_cta), 3) = '321' OR LEFT(TRIM(c.clas_cta), 5) = '32201')
),
lm AS (
    SELECT l.codi_emp, l.CODI_EMP_PLANO AS plano, l.cdeb_lan, l.ccre_lan, l.vlor_lan AS vl
      FROM bethadba.ctlancto l, p
     WHERE l.data_lan BETWEEN p.ini AND p.fim AND l.orig_lan <> 2
),
r AS (
    SELECT lm.codi_emp,
           SUM(CASE WHEN kc.codi_cta IS NOT NULL AND kc.ircs = 0 THEN lm.vl ELSE 0 END)
         - SUM(CASE WHEN kd.codi_cta IS NOT NULL AND kd.ircs = 0 THEN lm.vl ELSE 0 END) AS res,
           SUM(CASE WHEN kd.ircs = 1 THEN lm.vl ELSE 0 END) AS ircs,
           SUM(CASE WHEN kc.financeira = 1 THEN lm.vl ELSE 0 END) AS fin,
           SUM(CASE WHEN kc.codi_cta IS NOT NULL OR kd.codi_cta IS NOT NULL THEN 1 ELSE 0 END) AS n
      FROM lm
      LEFT JOIN ca kc ON kc.plano = lm.plano AND kc.codi_cta = lm.ccre_lan
      LEFT JOIN ca kd ON kd.plano = lm.plano AND kd.codi_cta = lm.cdeb_lan
     GROUP BY lm.codi_emp
)
SELECT r.codi_emp AS codigo,
       CAST(r.res AS NUMERIC(15,2)) AS resultado_antes_ir,
       CAST(r.ircs AS NUMERIC(15,2)) AS irpj_csll_lancados,
       CAST(r.fin AS NUMERIC(15,2)) AS receitas_financeiras,
       r.n AS lanc_resultado
  FROM r
 WHERE r.n > 0
 ORDER BY r.codi_emp
