-- teste_valores.sql (rascunho da fila de 17/11/2026, o teste do fechamento; a ponte NÃO lê): o que o Domínio apura na
-- empresa do teste, por competência, de 11/2024 a 10/2026 — o DAS (o saldo a recolher do imposto 44), os outros
-- impostos, o pró-labore bruto e o líquido dos sócios, a folha dos empregados, o FGTS e a GPS. É o
-- fechamento_valores.sql da fila de 11/11 (as tabelas, as colunas e as regras estão lá) com o filtro da empresa
-- ({EMPRESA}, o código do empresa.txt) e o período fixo. Só a soma da empresa, nunca por pessoa. A saída fica só no PC.
WITH p AS (SELECT CAST('2024-11-01' AS DATE) AS ini, CAST('2026-10-31' AS DATE) AS fim),
emp AS (SELECT {EMPRESA} AS codi_emp),
fo AS (
    SELECT b.codi_emp, DATEFORMAT(b.competencia, 'yyyy-mm') AS mes, b.tipo_process AS tipo,
           b.proventos AS bruto, b.proventos - b.descontos AS liquido,
           CASE WHEN COALESCE(e.CATEGORIA_ESOCIAL_EMPREGADO, e.CATEGORIA_ESOCIAL) BETWEEN 101 AND 111
                THEN 1 ELSE 0 END AS empregado,
           CASE WHEN COALESCE(e.CATEGORIA_ESOCIAL, e.CATEGORIA_ESOCIAL_EMPREGADO) IN (721, 722, 723)
                THEN 1 ELSE 0 END AS socio
      FROM bethadba.fobasesserv b
      JOIN bethadba.foempregados e ON e.codi_emp = b.codi_emp AND e.i_empregados = b.i_empregados, p
     WHERE b.competencia BETWEEN p.ini AND p.fim AND b.SIMULACAO = 0 AND b.rateio = 0
       AND b.tipo_process IN (11, 41, 42, 51, 52)
),
v AS (
    SELECT s.codi_emp, DATEFORMAT(s.data_sim, 'yyyy-mm') AS mes, 'imposto_' || CAST(s.codi_imp AS VARCHAR(5)) AS tipo,
           SUM(s.sdev_sim) AS valor
      FROM bethadba.efsdoimp s, p
     WHERE s.data_sim BETWEEN p.ini AND p.fim AND s.pdic_sim IN (6, 7)
     GROUP BY s.codi_emp, DATEFORMAT(s.data_sim, 'yyyy-mm'), s.codi_imp
    UNION ALL
    SELECT fo.codi_emp, fo.mes, 'liquido_folha', SUM(fo.liquido) FROM fo
     WHERE fo.tipo IN (11, 42) AND fo.empregado = 1 GROUP BY fo.codi_emp, fo.mes
    UNION ALL
    SELECT fo.codi_emp, fo.mes, 'liquido_socios', SUM(fo.liquido) FROM fo
     WHERE fo.tipo IN (11, 42) AND fo.socio = 1 GROUP BY fo.codi_emp, fo.mes
    UNION ALL
    SELECT fo.codi_emp, fo.mes, 'liquido_total', SUM(fo.liquido) FROM fo
     WHERE fo.tipo IN (11, 42) AND (fo.empregado = 1 OR fo.socio = 1) GROUP BY fo.codi_emp, fo.mes
    UNION ALL
    SELECT fo.codi_emp, fo.mes, 'bruto_folha', SUM(fo.bruto) FROM fo
     WHERE fo.tipo IN (11, 42) AND fo.empregado = 1 GROUP BY fo.codi_emp, fo.mes
    UNION ALL
    SELECT fo.codi_emp, fo.mes, 'bruto_socios', SUM(fo.bruto) FROM fo
     WHERE fo.tipo IN (11, 42) AND fo.socio = 1 GROUP BY fo.codi_emp, fo.mes
    UNION ALL
    SELECT fo.codi_emp, fo.mes, 'adiantamento', SUM(fo.liquido) FROM fo WHERE fo.tipo = 41 GROUP BY fo.codi_emp, fo.mes
    UNION ALL
    SELECT fo.codi_emp, fo.mes, 'decimo_terceiro', SUM(fo.liquido) FROM fo
     WHERE fo.tipo IN (51, 52) GROUP BY fo.codi_emp, fo.mes
    UNION ALL
    SELECT f.codi_emp, DATEFORMAT(f.competencia, 'yyyy-mm'), 'fgts', SUM(f.total_fgts)
      FROM bethadba.fofgtsfilial f, p WHERE f.competencia BETWEEN p.ini AND p.fim
     GROUP BY f.codi_emp, DATEFORMAT(f.competencia, 'yyyy-mm')
    UNION ALL
    SELECT g.codi_emp, DATEFORMAT(g.competencia, 'yyyy-mm'), 'inss', SUM(g.total_guia)
      FROM bethadba.foguiainss g, p WHERE g.competencia BETWEEN p.ini AND p.fim
     GROUP BY g.codi_emp, DATEFORMAT(g.competencia, 'yyyy-mm')
)
SELECT v.codi_emp AS codigo, v.mes AS competencia, v.tipo, CAST(v.valor AS NUMERIC(15,2)) AS valor
  FROM v JOIN emp ON emp.codi_emp = v.codi_emp
 WHERE v.valor > 0
 ORDER BY v.codi_emp, v.mes, v.tipo
