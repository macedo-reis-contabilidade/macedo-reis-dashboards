-- folha_valores.sql (RASCUNHO: a ponte não lê esta pasta): por empresa, a folha do mês em reais, somada (nunca por
-- pessoa). Os dois parâmetros são o primeiro e o último dia do mês. Tabelas: bethadba.fobasesserv ("Bases - Calculo",
-- um cálculo por pessoa, mês e tipo: 11 Mensal, 41 Adiantamento, 42 Complementar, 51 Adiantamento do 13º, 52 13º
-- salário, 60 e 61 Férias; sem simulação), bethadba.foempregados (a categoria eSocial, como no folha.sql),
-- bethadba.focalculosbases ("Calculos - Bases de calculos", as bases de cada cálculo, pelo I_CALCULOS; o nome da base
-- em bethadba.focadbases: 9 INSS Mensal, 10 INSS Férias, 11 INSS 13º, 15 FGTS Mensal, 16 FGTS Férias, 17 FGTS 13º),
-- bethadba.forescisoes ("Rescisao - Calculo"), bethadba.fofgtsfilial ("Valor de fgts por filial", o FGTS da guia do
-- mês) e bethadba.foguiainss ("Guia de INSS": empresa, acid_trab e terceiros da competência).
-- O cálculo em rateio por serviço aparece duas vezes na fobasesserv (o inteiro com rateio 0 e o pedaço com rateio 1,
-- com os mesmos valores): só o rateio 0. Os tipos 41 e 51 ficam de fora (o adiantamento é descontado no 11 e no 52),
-- e o 60 e o 61 também: as férias do mês já estão dentro do mensal (a base 10 do mensal é a parte das férias do mês).
-- salarios: os proventos dos empregados (categoria 101 a 111) no mensal e no complementar; já traz as férias do mês e
--   a rescisão (a rescisão normal é o próprio cálculo mensal do mês, e a complementar, o complementar).
-- ferias: dos salarios, as férias do mês (a base do INSS de férias, com o terço; sem o abono pecuniário).
-- rescisoes: dos salarios, os proventos das rescisões normais e complementares calculadas no mês.
-- decimo_terceiro: os proventos do 13º integral (tipo 52) dos empregados; o 13º da rescisão fica na rescisão.
-- pro_labore_valor: os proventos do mensal dos sócios e diretores (categoria 721 a 723).
-- base_inss e base_fgts: as bases 9, 10 e 11 e as 15, 16 e 17 dos cálculos dos empregados.
-- fgts: o total da guia do FGTS do mês (todas as filiais e tipos). inss_empresa, inss_rat e inss_terceiros: as guias
--   de INSS do mês (zero no Simples dos anexos I a III, que paga a CPP no DAS).
-- Entra a empresa com algum cálculo (mensal, complementar ou 13º) no mês.
WITH p AS (SELECT CAST(? AS DATE) AS ini, CAST(? AS DATE) AS fim),
calc AS (
    SELECT b.codi_emp, b.tipo_process AS tipo, b.I_CALCULOS, b.proventos,
           CASE WHEN COALESCE(e.CATEGORIA_ESOCIAL_EMPREGADO, e.CATEGORIA_ESOCIAL) BETWEEN 101 AND 111
                THEN 1 ELSE 0 END AS empregado,
           CASE WHEN COALESCE(e.CATEGORIA_ESOCIAL, e.CATEGORIA_ESOCIAL_EMPREGADO) IN (721, 722, 723)
                THEN 1 ELSE 0 END AS socio
      FROM bethadba.fobasesserv b
      JOIN bethadba.foempregados e ON e.codi_emp = b.codi_emp AND e.i_empregados = b.i_empregados, p
     WHERE b.competencia BETWEEN p.ini AND p.fim
       AND b.SIMULACAO = 0
       AND b.rateio = 0
       AND b.tipo_process IN (11, 42, 52)
),
bs AS (
    SELECT cb.I_CALCULOS,
           SUM(CASE WHEN cb.i_cadbases IN (9, 10, 11) THEN cb.base ELSE 0 END) AS b_inss,
           SUM(CASE WHEN cb.i_cadbases IN (15, 16, 17) THEN cb.base ELSE 0 END) AS b_fgts,
           SUM(CASE WHEN cb.i_cadbases = 10 THEN cb.base ELSE 0 END) AS b_ferias
      FROM bethadba.focalculosbases cb
     WHERE cb.i_cadbases IN (9, 10, 11, 15, 16, 17)
       AND cb.I_CALCULOS IN (SELECT c.I_CALCULOS FROM calc c WHERE c.empregado = 1)
     GROUP BY cb.I_CALCULOS
),
rs AS (
    SELECT r.I_CALCULOS, SUM(r.proventos) AS pr
      FROM bethadba.forescisoes r
     WHERE r.tipo IN (1, 2)
       AND r.I_CALCULOS IN (SELECT c.I_CALCULOS FROM calc c WHERE c.empregado = 1 AND c.tipo IN (11, 42))
     GROUP BY r.I_CALCULOS
),
fl AS (
    SELECT c.codi_emp,
           SUM(CASE WHEN c.empregado = 1 AND c.tipo IN (11, 42) THEN c.proventos ELSE 0 END) AS sal,
           SUM(CASE WHEN c.empregado = 1 AND c.tipo IN (11, 42) THEN COALESCE(bs.b_ferias, 0) ELSE 0 END) AS fer,
           SUM(CASE WHEN c.empregado = 1 THEN COALESCE(rs.pr, 0) ELSE 0 END) AS resc,
           SUM(CASE WHEN c.empregado = 1 AND c.tipo = 52 THEN c.proventos ELSE 0 END) AS dec13,
           SUM(CASE WHEN c.socio = 1 AND c.tipo = 11 THEN c.proventos ELSE 0 END) AS prolab,
           SUM(CASE WHEN c.empregado = 1 THEN COALESCE(bs.b_inss, 0) ELSE 0 END) AS b_inss,
           SUM(CASE WHEN c.empregado = 1 THEN COALESCE(bs.b_fgts, 0) ELSE 0 END) AS b_fgts
      FROM calc c
      LEFT JOIN bs ON bs.I_CALCULOS = c.I_CALCULOS
      LEFT JOIN rs ON rs.I_CALCULOS = c.I_CALCULOS
     GROUP BY c.codi_emp
),
fg AS (
    SELECT f.codi_emp, SUM(f.total_fgts) AS fgts
      FROM bethadba.fofgtsfilial f, p
     WHERE f.competencia BETWEEN p.ini AND p.fim
     GROUP BY f.codi_emp
),
gi AS (
    SELECT g.codi_emp, SUM(g.empresa) AS emp, SUM(g.acid_trab) AS rat, SUM(g.terceiros) AS terc
      FROM bethadba.foguiainss g, p
     WHERE g.competencia BETWEEN p.ini AND p.fim
     GROUP BY g.codi_emp
)
SELECT fl.codi_emp AS codigo,
       CAST(fl.sal AS NUMERIC(15,2)) AS salarios,
       CAST(fl.fer AS NUMERIC(15,2)) AS ferias,
       CAST(fl.resc AS NUMERIC(15,2)) AS rescisoes,
       CAST(fl.dec13 AS NUMERIC(15,2)) AS decimo_terceiro,
       CAST(fl.prolab AS NUMERIC(15,2)) AS pro_labore_valor,
       CAST(fl.b_inss AS NUMERIC(15,2)) AS base_inss,
       CAST(fl.b_fgts AS NUMERIC(15,2)) AS base_fgts,
       CAST(fg.fgts AS NUMERIC(15,2)) AS fgts,
       CAST(gi.emp AS NUMERIC(15,2)) AS inss_empresa,
       CAST(gi.rat AS NUMERIC(15,2)) AS inss_rat,
       CAST(gi.terc AS NUMERIC(15,2)) AS inss_terceiros
  FROM fl
  LEFT JOIN fg ON fg.codi_emp = fl.codi_emp
  LEFT JOIN gi ON gi.codi_emp = fl.codi_emp
 ORDER BY fl.codi_emp
