-- cruzamentos_v2.sql (RASCUNHO: a ponte não lê esta pasta), da fila de 05/11/2026 (item 3): o consultas/cruzamentos.sql
-- com as correções que as contagens da fila justificam. As mesmas colunas (codigo, receita_lancada, folha_lancada,
-- encargos_lancados) e os mesmos dois parâmetros (o primeiro e o último dia do mês). Tabelas: as do cruzamentos.sql
-- (bethadba.ctlancto e bethadba.ctcontas, a descrição da conta só nos filtros) e mais bethadba.ctnatureza_conta
-- ("NATUZA DAS CONTAS": codi_emp, clas_cta, natureza C/D) e bethadba.fointegcontlanc ("Numero do lancamentos":
-- codi_emp_cta, a contabilidade, nume_lanc = ctlancto.nume_lan, competencia, a da folha integrada).
-- As contagens são de 10/2025 a 09/2026, do escritório inteiro, contra o faturamento.sql e o folha_valores.sql, com as
-- regras dos itens 1.1 e 2.1 da fila: a receita nos 815 empresa-meses com receita_bruta > 0 e lançamento da escrita
-- fiscal no mês (136 diferentes hoje), a folha nos 471 com as duas > 0 (69 diferentes hoje), diferente = mais de R$ 1,00.
-- 1. O grupo de resultado pela natureza (o item 7 da fila de 04/11), no lugar do "4" e do "3" fixos: no plano em que a
--    ctnatureza_conta diz o 3 credor e o 4 devedor (7 planos no Domínio, 3 com lançamento nos 12 meses), a receita é o
--    3.1.1.01 e o 3.1.1.02 (a integração das notas credita o espelho do 4.1.1.01 e do 4.1.1.02), a devolução o
--    3.1.2.01, e a folha e os encargos ficam no grupo 4. Os outros planos (o 4 credor, o 3 e o 4 devedores, sem a
--    tabela) ficam como hoje. Receita: 11 empresa-meses deixam de diferir (1 empresa, que tinha a receita lançada 0 em
--    todo mês), nenhum passa a diferir. Folha: 6 empresa-meses da mesma empresa saem de "a folha não entrou na
--    contabilidade" e batem.
-- 2. A receita e a devolução da escrita fiscal pela empresa da nota: o lançamento das origens da escrita fiscal (4 a 9,
--    11 e 21 a 29) conta na ctlancto.fili_lan ("Filial": a empresa da nota, que a integração grava, igual à da nota
--    ligada em todos os créditos integrados dos 12 meses), não no codi_emp (a fili_lan vazia ou zero fica no codi_emp). É a filial integrada no contábil da matriz
--    (a contabilidade centralizada): 3 empresa-meses deixam de diferir (1 matriz), nenhum passa. As 2 filiais ganham a
--    receita_lancada em 6 empresa-meses em que não têm escrita fiscal própria (o origens.sql conta pelo codi_emp), que a
--    tela não compara. O lançamento das outras origens fica no codi_emp (o manual na receita com outra filial, 3
--    lançamentos de 1 empresa nos 12 meses, não foi conferido: com ele também pela filial, as contagens dos empresa-meses
--    comparados são as mesmas). Se a centralização não for de propósito, ela continua aparecendo na filial, como a
--    escrita fiscal que não entrou na contabilidade.
-- 3. A folha e os encargos pela competência da integração: o lançamento da folha (orig_lan 13) ligado na
--    fointegcontlanc conta na competência da folha (a menor, se houver mais de uma), não no mês do data_lan, quando o
--    data_lan é de um mês antes a dois depois da competência; fora disso, no mês do data_lan. As duas janelas casam (os
--    lançamentos de M−1 a M+2 e as competências de M−2 a M+1, pelo primeiro dia do mês, sem o "último dia + N meses",
--    que perderia o dia 31): cada lançamento conta num mês só, e nenhum se perde (de 10/2025 a 09/2026, os 2.625
--    ligados estão todos de um mês antes a um depois). É a rescisão (tipo 4) paga no mês seguinte ao do cálculo e as
--    férias (tipo 3) integradas noutro mês. O lançamento sem a ligação e o das outras origens ficam no mês do data_lan.
--    11 empresa-meses deixam de
--    diferir (5 empresas), 3 passam a diferir (3 empresas: a integração ligada a uma competência diferente da do cálculo
--    que a contém), e 1 lançada sem cálculo no mês deixa de ser. O mês passa a depender dos lançamentos dos dois meses
--    seguintes (a ponte relê 14 meses por dia, então se acerta sozinho).
-- Com as três, ficam 122 dos 136 da receita e 58 dos 69 da folha, mais os 3 novos.
-- Ficou de fora:
-- - Do faturamento.sql, não daqui: a devolução de venda só com o acumulador de devolução e de faturamento, como a
--   apuração do Simples (18 deixariam de diferir, nenhum passaria). Do folha_valores.sql: o salário-família e o
--   salário-maternidade, que a integração manda pro INSS a recolher (13 e nenhum). Mudam outra consulta e o contrato.
-- - Da tela, não daqui: o mês que fecha com o vizinho, as férias e a rescisão que se compensam (10 e nenhum).
-- - Testadas e sem ganho: as outras analíticas do 4.1.1, o líquido (o débito na receita e o crédito na devolução) e a
--   devolução da origem 6 noutras contas do 4 (nenhum resolvido, nenhum quebrado), a integração das notas no 4.1.3 a 4.2
--   (nenhum e 2 de 1 empresa), a folha pelo código da conta, os itens 001 a 005 (nenhum e 11), o item 003 somado (nenhum
--   e 6), a folha sem a origem 1 (6 e 15), a folha pelo líquido (nenhum e 73), as férias pelo cálculo de férias (3 a 12
--   e 16 a 46), a competência da integração só na rescisão (8 e 2).
-- - De propósito: o que é problema de verdade da contabilidade continua aparecendo como diferença (a nota sem
--   lançamento, a folha não integrada, a devolução de compra a débito do 4.1.2.01, a nota cancelada depois de integrada,
--   o lançamento manual nas contas de receita e de folha).
-- O que fica, pela primeira causa das etapas. Na receita (os 122): a nota de faturamento sem lançamento (31), a
--   devolução (61: a de compra integrada a débito do 4.1.2.01 e a de venda sem lançamento ou integrada fora da receita,
--   18 delas saem com a mudança no faturamento.sql, acima), a nota de um mês lançada noutro (3), o lançamento manual na
--   receita (1) e 26 sem uma causa só (a nota cancelada depois de integrada, o valor integrado diferente do das notas, a
--   integração sem nota, as combinações). Na folha (os 58): o que não é despesa nos proventos, o salário-família e a
--   maternidade (16, e mais 7 combinados: a coluna nova do folha_valores.sql tira 13), as férias pagas num mês e gozadas
--   no outro e o adiantamento do 13º lançado como despesa em novembro (19: a regra do mês vizinho, na tela, pega parte),
--   o pró-labore no patrimônio ou do mês anterior (3), a folha recalculada depois de integrada (3), o lançamento manual
--   nas contas de folha (4), 1 combinado e 5 sem causa achada (4 deles a folha só com o pró-labore integrado).
-- Tempo: de 3,8 a 4,8 s por mês nos 12 meses (a de hoje, 1,6 s). A parte cara é a lista das contas com o filtro pela descrição, que a
-- receita e a folha leem cada uma (1,8 s só a receita), e os quatro meses de lançamentos da folha pela competência, com
-- a fointegcontlanc (2,1 s só a folha).
-- Entra a empresa com alguma das três: a receita e a devolução pelo mês do lançamento, a folha e os encargos pela
-- competência.
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
