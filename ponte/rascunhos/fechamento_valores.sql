-- fechamento_valores.sql (rascunho da fila de 11/11/2026, o fechamento automático das contabilidades; a ponte NÃO lê
-- esta pasta): por empresa e competência, os valores que o Domínio já apura e que um lançamento digitado pode estar
-- pagando — os impostos a recolher da escrita fiscal e os totais da folha e das guias. É com eles que o estudo casa o
-- valor de cada mês dos pares que se repetem (até R$ 1,00, no mês do lançamento ou no anterior). Os dois parâmetros são
-- o primeiro e o último dia do período (o estudo rodou de 12/2024 a 12/2025, mês a mês).
-- Tabelas: bethadba.efsdoimp ("Saldo dos Impostos": codi_imp, o código da bethadba.geimposto — 1 ICMS, 2 IPI, 3 ISS, 4
-- PIS, 5 COFINS, 6 CSOC, 7 IRPJ-LP, 17 PIS-MP66, 19 COFINS-N, 44 SIMPLESN, o DAS —; data_sim "Competencia"; pdic_sim
-- "Periodicidade", 6 mensal e 7 trimestral; sdev_sim "Saldo a Recolher"), bethadba.fobasesserv ("Bases - Calculo", um
-- cálculo por pessoa: proventos, descontos, tipo_process 11 mensal, 41 adiantamento, 42 complementar, 51 adiantamento
-- do 13º, 52 13º; sem simulação e só o rateio 0, como no folha_valores.sql), bethadba.foempregados (a categoria
-- eSocial:
-- 101 a 111 empregado, 721 a 723 sócio ou diretor), bethadba.fofgtsfilial ("Valor de fgts por filial": total_fgts) e
-- bethadba.foguiainss ("Guia de INSS": total_guia, "Total da guia(campo 11 da GPS)").
-- Os tipos: imposto_<código> (o saldo a recolher do imposto, só o maior que zero; o trimestral na competência do fim do
-- trimestre); liquido_folha (os proventos menos os descontos do mensal e do complementar dos empregados),
-- liquido_socios
-- (o mesmo, dos sócios: o pró-labore líquido), liquido_total (os dois), bruto_folha e bruto_socios (só os proventos: o
-- que a provisão lança, antes dos descontos), adiantamento (o líquido do tipo 41),
-- decimo_terceiro (o líquido do 51 e do 52), fgts (a guia do mês, todas as filiais e tipos) e inss (a GPS do mês).
-- As empresas: as ativas no Domínio (stat_emp A, M, C ou B) com a contabilidade aberta lá (a bethadba.ctparmto).
-- Nunca por pessoa: só a soma da empresa. Uma linha por empresa, competência e tipo, só com o valor maior que zero.
WITH p AS (SELECT CAST(? AS DATE) AS ini, CAST(? AS DATE) AS fim),
emp AS (
    SELECT g.codi_emp
      FROM bethadba.geempre g
     WHERE UPPER(TRIM(g.stat_emp)) IN ('A', 'M', 'C', 'B')
       AND EXISTS (SELECT 1 FROM bethadba.ctparmto c WHERE c.codi_emp = g.codi_emp)
),
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
