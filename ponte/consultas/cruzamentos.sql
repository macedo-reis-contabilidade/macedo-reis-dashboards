-- cruzamentos.sql (versão 3 do pacote; corrigida em 06/11/2026, ponte 0.3.2, pelo que a fila de 05/11 achou no Domínio:
-- docs/FILA-CODE-2026-11-05-DIFERENCAS-DUVIDAS.md): por empresa, a receita e a folha lançadas no contábil no mês, pra
-- cruzar com o faturamento (consultas/faturamento.sql, a receita_bruta) e com a folha do próprio Domínio
-- (consultas/folha_valores.sql). Os dois parâmetros são o primeiro e o último dia do mês. Tabelas: bethadba.ctlancto
-- ("Lancamentos Contabeis": cdeb_lan, ccre_lan, vlor_lan, data_lan, orig_lan, fili_lan e nume_lan, com o plano da
-- CODI_EMP_PLANO), bethadba.ctcontas ("Contas Contabeis - Cadastro": clas_cta, tipo_cta e, só nos filtros, nome_cta — a
-- descrição nunca sai daqui), bethadba.ctnatureza_conta (a natureza C ou D de cada grupo do plano) e
-- bethadba.fointegcontlanc (o lançamento da folha integrada e a competência da folha dele). Todas as origens, fora o
-- zeramento (orig_lan 2).
-- receita_lancada: o crédito do mês nas analíticas da receita bruta (4.1.1.01, vendas, e 4.1.1.02, serviços, do plano
--   modelo do escritório) menos o débito nas de cancelamento e devolução (4.1.2.01).
-- folha_lancada: o débito nas analíticas de custo e despesa (o grupo 3) de salários e ordenados, 13º, férias e
--   pró-labore, pela descrição da conta (fora as de INSS, FGTS, previdência, salário-educação e provisão).
-- encargos_lancados: o débito nas analíticas do grupo 3 de INSS, FGTS, previdência e salário-educação (a despesa, não o
--   a recolher; fora a previdência privada e a provisão).
-- As três correções de 06/11 (contadas de 10/2025 a 09/2026, no escritório inteiro: dos 136 empresa-meses com a receita
-- diferente do faturamento, 14 deixam de diferir e nenhum passa a diferir; dos 69 com a folha diferente da calculada,
-- 11 deixam e 3 passam — a integração ligada a uma competência diferente da do cálculo que a contém):
-- 1. O grupo de resultado pela natureza: no plano em que a ctnatureza_conta diz o 3 credor e o 4 devedor, a receita é o
--    3.1.1.01 e o 3.1.1.02, a devolução o 3.1.2.01, e a folha e os encargos ficam no grupo 4. Os outros planos, como o
--    modelo.
-- 2. A receita e a devolução da escrita fiscal (origens 4 a 9, 11 e 21 a 29) contam na empresa da nota (a
--    ctlancto.fili_lan; vazia ou zero, no codi_emp): é a filial integrada no contábil da matriz. O resto, no codi_emp.
-- 3. A folha e os encargos pela competência da integração: o lançamento da folha (orig_lan 13) ligado na
--    fointegcontlanc conta na competência da folha (a menor, se houver mais de uma) quando o data_lan é de um mês antes
--    a dois depois dela; fora disso, e o lançamento sem a ligação e o das outras origens, no mês do data_lan. As janelas
--    casam (os lançamentos de M−1 a M+2 e as competências de M−2 a M+1, pelo primeiro dia do mês): cada lançamento conta
--    num mês só. O mês passa a depender dos lançamentos dos dois meses seguintes; a ponte relê 14 meses por dia, então
--    ele se acerta sozinho.
-- O que continua diferente é problema de verdade da contabilidade (a nota sem lançamento, a devolução fora da conta, a
-- nota cancelada depois de integrada, o lançamento manual): as causas, contadas, estão no DUVIDAS. De 3,8 a 4,8 s por
-- mês (antes, 1,6 s). Entra a empresa com alguma das três: a receita pelo mês do lançamento, a folha pela competência.
WITH p AS (SELECT CAST(? AS DATE) AS ini, CAST(? AS DATE) AS fim),
gr AS (
    SELECT DISTINCT n3.codi_emp AS plano
      FROM bethadba.ctnatureza_conta n3
      JOIN bethadba.ctnatureza_conta n4 ON n4.codi_emp = n3.codi_emp AND TRIM(n4.clas_cta) = '4'
     WHERE TRIM(n3.clas_cta) = '3' AND n3.natureza = 'C' AND n4.natureza = 'D'
),
ca AS (
    SELECT c.codi_emp AS plano, c.codi_cta,
           CASE WHEN gr.plano IS NULL AND LEFT(TRIM(c.clas_cta), 5) IN ('41101', '41102') THEN 1
                WHEN gr.plano IS NOT NULL AND LEFT(TRIM(c.clas_cta), 5) IN ('31101', '31102') THEN 1
                ELSE 0 END AS receita,
           CASE WHEN gr.plano IS NULL AND LEFT(TRIM(c.clas_cta), 5) = '41201' THEN 1
                WHEN gr.plano IS NOT NULL AND LEFT(TRIM(c.clas_cta), 5) = '31201' THEN 1
                ELSE 0 END AS devolucao,
           CASE WHEN LEFT(TRIM(c.clas_cta), 1) = CASE WHEN gr.plano IS NULL THEN '3' ELSE '4' END
                 AND (UPPER(c.nome_cta) LIKE '%SAL_RIO%' OR UPPER(c.nome_cta) LIKE '%ORDENADO%'
                      OR UPPER(c.nome_cta) LIKE '%PR_%LABORE%' OR UPPER(c.nome_cta) LIKE '%F_RIAS%'
                      OR UPPER(c.nome_cta) LIKE '%13%SAL%' OR UPPER(c.nome_cta) LIKE '%13º %'
                      OR UPPER(c.nome_cta) LIKE '%13° %' OR UPPER(c.nome_cta) LIKE '%13O %'
                      OR UPPER(c.nome_cta) LIKE '%D_CIMO%')
                 AND NOT (UPPER(c.nome_cta) LIKE '%INSS%' OR UPPER(c.nome_cta) LIKE '%FGTS%'
                          OR UPPER(c.nome_cta) LIKE '%PREVID%' OR UPPER(c.nome_cta) LIKE '%EDUCA%'
                          OR UPPER(c.nome_cta) LIKE '%PROVIS%')
                THEN 1 ELSE 0 END AS folha,
           CASE WHEN LEFT(TRIM(c.clas_cta), 1) = CASE WHEN gr.plano IS NULL THEN '3' ELSE '4' END
                 AND (UPPER(c.nome_cta) LIKE '%INSS%' OR UPPER(c.nome_cta) LIKE '%FGTS%'
                      OR UPPER(c.nome_cta) LIKE '%PREVID%' OR UPPER(c.nome_cta) LIKE '%SAL_RIO%EDUCA%')
                 AND NOT (UPPER(c.nome_cta) LIKE '%PRIVAD%' OR UPPER(c.nome_cta) LIKE '%PROVIS%')
                THEN 1 ELSE 0 END AS encargos
      FROM bethadba.ctcontas c
      LEFT JOIN gr ON gr.plano = c.codi_emp
     WHERE c.tipo_cta = 'A'
),
lm AS (
    SELECT CASE WHEN (l.orig_lan BETWEEN 4 AND 9 OR l.orig_lan = 11 OR l.orig_lan BETWEEN 21 AND 29)
                 AND l.fili_lan > 0
                THEN l.fili_lan ELSE l.codi_emp END AS codi_emp,
           l.CODI_EMP_PLANO AS plano, l.cdeb_lan, l.ccre_lan, l.vlor_lan AS vl
      FROM bethadba.ctlancto l, p
     WHERE l.data_lan BETWEEN p.ini AND p.fim AND l.orig_lan <> 2
),
rc AS (
    SELECT lm.codi_emp,
           SUM(CASE WHEN kc.receita = 1 THEN lm.vl ELSE 0 END)
         - SUM(CASE WHEN kd.devolucao = 1 THEN lm.vl ELSE 0 END) AS rec,
           MAX(CASE WHEN kc.receita = 1 OR kd.devolucao = 1 THEN 1 ELSE 0 END) AS tem
      FROM lm
      LEFT JOIN ca kc ON kc.plano = lm.plano AND kc.codi_cta = lm.ccre_lan
      LEFT JOIN ca kd ON kd.plano = lm.plano AND kd.codi_cta = lm.cdeb_lan
     GROUP BY lm.codi_emp
),
il AS (
    SELECT fi.codi_emp_cta, fi.nume_lanc, MIN(fi.competencia) AS comp
      FROM bethadba.fointegcontlanc fi, p
     WHERE fi.competencia >= DATEADD(month, -2, p.ini) AND fi.competencia < DATEADD(month, 2, p.ini)
     GROUP BY fi.codi_emp_cta, fi.nume_lanc
),
lf AS (
    SELECT l.codi_emp, l.CODI_EMP_PLANO AS plano, l.cdeb_lan, l.vlor_lan AS vl
      FROM bethadba.ctlancto l
      JOIN p ON l.data_lan >= DATEADD(month, -1, p.ini) AND l.data_lan < DATEADD(month, 3, p.ini)
      LEFT JOIN il ON l.orig_lan = 13 AND il.codi_emp_cta = l.codi_emp AND il.nume_lanc = l.nume_lan
     WHERE l.orig_lan <> 2
       AND COALESCE(il.comp, l.data_lan) BETWEEN p.ini AND p.fim
),
fo AS (
    SELECT lf.codi_emp,
           SUM(CASE WHEN kd.folha = 1 THEN lf.vl ELSE 0 END) AS fol,
           SUM(CASE WHEN kd.encargos = 1 THEN lf.vl ELSE 0 END) AS enc,
           MAX(CASE WHEN kd.folha = 1 OR kd.encargos = 1 THEN 1 ELSE 0 END) AS tem
      FROM lf
      JOIN ca kd ON kd.plano = lf.plano AND kd.codi_cta = lf.cdeb_lan
     GROUP BY lf.codi_emp
),
emp AS (
    SELECT rc.codi_emp FROM rc WHERE rc.tem = 1
    UNION
    SELECT fo.codi_emp FROM fo WHERE fo.tem = 1
)
SELECT emp.codi_emp AS codigo,
       CAST(COALESCE(rc.rec, 0) AS NUMERIC(15,2)) AS receita_lancada,
       CAST(COALESCE(fo.fol, 0) AS NUMERIC(15,2)) AS folha_lancada,
       CAST(COALESCE(fo.enc, 0) AS NUMERIC(15,2)) AS encargos_lancados
  FROM emp
  LEFT JOIN rc ON rc.codi_emp = emp.codi_emp
  LEFT JOIN fo ON fo.codi_emp = emp.codi_emp
 ORDER BY emp.codi_emp
