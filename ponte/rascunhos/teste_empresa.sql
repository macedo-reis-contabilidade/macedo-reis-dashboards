-- teste_empresa.sql (rascunho da fila de 17/11/2026, o teste do fechamento; a ponte NÃO lê): acha a empresa do teste
-- pelas marcas que a ponte leu em 17/11/2026, só com contagens. Sai o código (no PC, nunca no repositório).
-- As marcas: ativa no Domínio (geempre.stat_emp A, M, C ou B, como no empresas.sql); em 2024, 5.555 lançamentos fora o
-- zeramento e o último zeramento incluído no Domínio em 17/12/2025; em 2025, nenhum zeramento e 12.254 lançamentos ou
-- mais fora ele (em 18/11/2026 eram 12.255: entrou uma linha de 2025 depois da leitura da ponte; por isso o 2024, que
-- está zerado, é o filtro de partida) (a maior dorig_lan das linhas dele, como no encerramento.sql); nenhum lançamento em conta de banco
-- (1.1.1.02) de 12/2025 a 11/2026 e o último lançamento no caixa (1.1.1.01) que não veio de integração em 15/10/2025
-- (as regras do andamento.sql). Tabelas: bethadba.geempre, bethadba.ctlancto, bethadba.ctcontas.
WITH a24 AS (
    SELECT l.codi_emp, SUM(CASE WHEN l.orig_lan = 2 THEN 0 ELSE 1 END) AS n
      FROM bethadba.ctlancto l
     WHERE l.data_lan BETWEEN CAST('2024-01-01' AS DATE) AND CAST('2024-12-31' AS DATE)
     GROUP BY l.codi_emp
    HAVING SUM(CASE WHEN l.orig_lan = 2 THEN 0 ELSE 1 END) = 5555
),
a25 AS (
    SELECT l.codi_emp, SUM(CASE WHEN l.orig_lan = 2 THEN 0 ELSE 1 END) AS n,
           SUM(CASE WHEN l.orig_lan = 2 THEN 1 ELSE 0 END) AS zer
      FROM bethadba.ctlancto l JOIN a24 ON a24.codi_emp = l.codi_emp
     WHERE l.data_lan BETWEEN CAST('2025-01-01' AS DATE) AND CAST('2025-12-31' AS DATE)
     GROUP BY l.codi_emp
),
z24 AS (
    SELECT l.codi_emp, l.data_lan AS dia, MAX(l.dorig_lan) AS incl
      FROM bethadba.ctlancto l JOIN a25 ON a25.codi_emp = l.codi_emp
     WHERE l.data_lan BETWEEN CAST('2024-01-01' AS DATE) AND CAST('2024-12-31' AS DATE) AND l.orig_lan = 2
     GROUP BY l.codi_emp, l.data_lan
),
zu AS (
    SELECT z.codi_emp, z.incl FROM z24 z
     WHERE z.dia = (SELECT MAX(z2.dia) FROM z24 z2 WHERE z2.codi_emp = z.codi_emp)
),
cta AS (
    SELECT c.codi_emp AS plano, c.codi_cta, LEFT(TRIM(c.clas_cta), 5) AS grupo
      FROM bethadba.ctcontas c
     WHERE c.tipo_cta = 'A' AND LEFT(TRIM(c.clas_cta), 5) IN ('11101', '11102')
),
mov AS (
    SELECT l.codi_emp, cta.grupo, l.data_lan, l.orig_lan
      FROM bethadba.ctlancto l JOIN a25 ON a25.codi_emp = l.codi_emp
      JOIN cta ON cta.plano = l.CODI_EMP_PLANO AND (cta.codi_cta = l.cdeb_lan OR cta.codi_cta = l.ccre_lan)
     WHERE l.orig_lan <> 2
),
cx AS (
    SELECT codi_emp,
           SUM(CASE WHEN grupo = '11102' AND data_lan >= CAST('2025-12-01' AS DATE) THEN 1 ELSE 0 END) AS banco_12m,
           MAX(CASE WHEN grupo = '11101' AND orig_lan NOT IN (3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18, 19,
                    20, 21, 22, 23, 24, 25, 26, 27, 28, 29) THEN data_lan END) AS contador
      FROM mov GROUP BY codi_emp
)
SELECT e.codi_emp AS codigo, e.stat_emp AS situacao, a24.n AS n24, a25.n AS n25, a25.zer AS zer25,
       zu.incl AS zer24_incl, COALESCE(cx.banco_12m, 0) AS banco_12m, cx.contador AS caixa_contador_ate
  FROM a24 JOIN a25 ON a25.codi_emp = a24.codi_emp
  JOIN bethadba.geempre e ON e.codi_emp = a24.codi_emp
  LEFT JOIN zu ON zu.codi_emp = a24.codi_emp
  LEFT JOIN cx ON cx.codi_emp = a24.codi_emp
 WHERE e.stat_emp IN ('A', 'M', 'C', 'B') AND a25.zer = 0 AND a25.n >= 12254
   AND zu.incl = CAST('2025-12-17' AS DATE) AND COALESCE(cx.banco_12m, 0) = 0
   AND cx.contador = CAST('2025-10-15' AS DATE)
 ORDER BY e.codi_emp
