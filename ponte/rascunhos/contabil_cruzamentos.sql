-- contabil_cruzamentos.sql (RASCUNHO: a ponte não lê esta pasta): por empresa, a receita e a folha lançadas no contábil
-- no mês, pra cruzar com o faturamento (consultas/faturamento.sql, a receita_bruta) e com a folha do próprio Domínio
-- (consultas/folha_valores.sql). Os dois parâmetros são o primeiro e o último dia do mês. Tabelas: bethadba.ctlancto
-- ("Lancamentos Contabeis": cdeb_lan, ccre_lan, vlor_lan, data_lan, com o plano da CODI_EMP_PLANO) e bethadba.ctcontas
-- ("Contas Contabeis - Cadastro": clas_cta, tipo_cta e, só nos filtros, nome_cta — a descrição nunca sai daqui).
-- Todas as origens, fora o zeramento (orig_lan 2).
-- receita_lancada: o crédito do mês nas analíticas da receita bruta (4.1.1.01, vendas, e 4.1.1.02, serviços, do plano
--   modelo do escritório) menos o débito nas de cancelamento e devolução (4.1.2.01). Contra a receita_bruta do
--   faturamento.sql, em 09/2026: bate em 53 das 65 empresas com as duas (até R$ 1,00); pela conta dos acumuladores
--   (CCRE_ACU dos de faturamento e CDEB_ACU dos de devolução), em 35.
-- folha_lancada: o débito do mês nas analíticas de custo e despesa (o grupo 3) de salários e ordenados, 13º, férias e
--   pró-labore, pela descrição da conta (fora as de INSS, FGTS, previdência, salário-educação e provisão). Contra o
--   salarios + decimo_terceiro + pro_labore_valor do folha_valores.sql, em 09/2026: bate em 23 das 24 empresas com as
--   duas. Pelo código da conta (os itens 001, 002, 004 e 005 dos grupos de pessoal do plano modelo) e pela origem da
--   folha (13), também 23.
-- encargos_lancados: o débito do mês nas analíticas do grupo 3 de INSS, FGTS, previdência e salário-educação (a
--   despesa, não o a recolher; fora a previdência privada e a provisão).
-- O plano em que as receitas ficam no grupo 3 e as despesas no 4 (3 empresas: a natureza 3 credora e 4 devedora) sai
-- errado aqui. Entra a empresa com alguma das três.
WITH p AS (SELECT CAST(? AS DATE) AS ini, CAST(? AS DATE) AS fim),
ca AS (
    SELECT c.codi_emp AS plano, c.codi_cta,
           CASE WHEN LEFT(TRIM(c.clas_cta), 5) IN ('41101', '41102') THEN 1 ELSE 0 END AS receita,
           CASE WHEN LEFT(TRIM(c.clas_cta), 5) = '41201' THEN 1 ELSE 0 END AS devolucao,
           CASE WHEN LEFT(TRIM(c.clas_cta), 1) = '3'
                 AND (UPPER(c.nome_cta) LIKE '%SAL_RIO%' OR UPPER(c.nome_cta) LIKE '%ORDENADO%'
                      OR UPPER(c.nome_cta) LIKE '%PR_%LABORE%' OR UPPER(c.nome_cta) LIKE '%F_RIAS%'
                      OR UPPER(c.nome_cta) LIKE '%13%SAL%' OR UPPER(c.nome_cta) LIKE '%13º %'
                      OR UPPER(c.nome_cta) LIKE '%13° %' OR UPPER(c.nome_cta) LIKE '%13O %'
                      OR UPPER(c.nome_cta) LIKE '%D_CIMO%')
                 AND NOT (UPPER(c.nome_cta) LIKE '%INSS%' OR UPPER(c.nome_cta) LIKE '%FGTS%'
                          OR UPPER(c.nome_cta) LIKE '%PREVID%' OR UPPER(c.nome_cta) LIKE '%EDUCA%'
                          OR UPPER(c.nome_cta) LIKE '%PROVIS%')
                THEN 1 ELSE 0 END AS folha,
           CASE WHEN LEFT(TRIM(c.clas_cta), 1) = '3'
                 AND (UPPER(c.nome_cta) LIKE '%INSS%' OR UPPER(c.nome_cta) LIKE '%FGTS%'
                      OR UPPER(c.nome_cta) LIKE '%PREVID%' OR UPPER(c.nome_cta) LIKE '%SAL_RIO%EDUCA%')
                 AND NOT (UPPER(c.nome_cta) LIKE '%PRIVAD%' OR UPPER(c.nome_cta) LIKE '%PROVIS%')
                THEN 1 ELSE 0 END AS encargos
      FROM bethadba.ctcontas c
     WHERE c.tipo_cta = 'A'
),
lm AS (
    SELECT l.codi_emp, l.CODI_EMP_PLANO AS plano, l.cdeb_lan, l.ccre_lan, l.vlor_lan AS vl
      FROM bethadba.ctlancto l, p
     WHERE l.data_lan BETWEEN p.ini AND p.fim AND l.orig_lan <> 2
),
s AS (
    SELECT lm.codi_emp,
           SUM(CASE WHEN kc.receita = 1 THEN lm.vl ELSE 0 END)
         - SUM(CASE WHEN kd.devolucao = 1 THEN lm.vl ELSE 0 END) AS rec,
           SUM(CASE WHEN kd.folha = 1 THEN lm.vl ELSE 0 END) AS fol,
           SUM(CASE WHEN kd.encargos = 1 THEN lm.vl ELSE 0 END) AS enc,
           MAX(CASE WHEN kc.receita = 1 OR kd.devolucao = 1 OR kd.folha = 1 OR kd.encargos = 1 THEN 1 ELSE 0 END) AS tem
      FROM lm
      LEFT JOIN ca kc ON kc.plano = lm.plano AND kc.codi_cta = lm.ccre_lan
      LEFT JOIN ca kd ON kd.plano = lm.plano AND kd.codi_cta = lm.cdeb_lan
     GROUP BY lm.codi_emp
)
SELECT s.codi_emp AS codigo,
       CAST(s.rec AS NUMERIC(15,2)) AS receita_lancada,
       CAST(s.fol AS NUMERIC(15,2)) AS folha_lancada,
       CAST(s.enc AS NUMERIC(15,2)) AS encargos_lancados
  FROM s
 WHERE s.tem = 1
 ORDER BY s.codi_emp
