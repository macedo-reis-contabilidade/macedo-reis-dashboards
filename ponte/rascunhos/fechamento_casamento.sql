-- fechamento_casamento.sql (rascunho da fila de 11/11/2026, o fechamento automático das contabilidades; a ponte NÃO
-- lê esta pasta): por empresa e par de contas dos lançamentos digitados, quantas linhas têm o valor de UMA pessoa da
-- folha (o bruto ou o líquido de um sócio, de um empregado), até R$ 1,00, na competência do mês do lançamento ou na do
-- anterior. É o casamento do fechamento_valores.sql (que fica na soma da empresa) feito pessoa a pessoa — DENTRO do
-- Domínio: o valor de cada pessoa não sai da consulta, só a contagem das linhas que casaram. Os dois parâmetros são o
-- primeiro e o último dia do período (o estudo rodou mês a mês de 2025).
-- Tabelas: bethadba.ctlancto (orig_lan = 1, o lançamento do contador; nume_lan, cdeb_lan, ccre_lan, vlor_lan,
-- data_lan), bethadba.fobasesserv ("Bases - Calculo", um cálculo por pessoa: proventos, descontos; tipo_process 11
-- mensal, 41 adiantamento, 42 complementar, 51 adiantamento do 13º, 52 13º; sem simulação e só o rateio 0, como no
-- folha_valores.sql), bethadba.foempregados (a categoria eSocial: 101 a 111 empregado, 721 a 723 sócio ou diretor),
-- bethadba.geempre e bethadba.ctparmto (as empresas: ativas, com a contabilidade aberta e algum lançamento no período).
-- linhas: as linhas digitadas do par; socio_bruto, socio_liquido, empregado_bruto, empregado_liquido: quantas delas têm
-- o valor do bruto (os proventos) ou do líquido (os proventos menos os descontos) de um cálculo de um sócio ou de um
-- empregado da empresa, de qualquer um dos tipos; uma linha pode casar com mais de um. alguma: as linhas que casam com
-- pelo menos um dos quatro.
-- Uma linha por empresa e par de contas (a conta 0 é a partida múltipla, como no fechamento_repeticao.sql).
WITH p AS (SELECT CAST(? AS DATE) AS ini, CAST(? AS DATE) AS fim),
emp AS (
    SELECT g.codi_emp
      FROM bethadba.geempre g, p
     WHERE UPPER(TRIM(g.stat_emp)) IN ('A', 'M', 'C', 'B')
       AND EXISTS (SELECT 1 FROM bethadba.ctparmto c WHERE c.codi_emp = g.codi_emp)
       AND EXISTS (SELECT 1 FROM bethadba.ctlancto x
                    WHERE x.codi_emp = g.codi_emp AND x.data_lan BETWEEN p.ini AND p.fim)
),
lm AS (
    SELECT l.codi_emp, l.nume_lan, l.cdeb_lan, l.ccre_lan, l.vlor_lan,
           YMD(YEAR(l.data_lan), MONTH(l.data_lan), 1) AS m0,
           DATEADD(month, -1, YMD(YEAR(l.data_lan), MONTH(l.data_lan), 1)) AS m1
      FROM bethadba.ctlancto l JOIN emp ON emp.codi_emp = l.codi_emp, p
     WHERE l.data_lan BETWEEN p.ini AND p.fim AND l.orig_lan = 1
),
fo AS (
    SELECT b.codi_emp, YMD(YEAR(b.competencia), MONTH(b.competencia), 1) AS comp,
           b.proventos AS bruto, b.proventos - b.descontos AS liquido,
           CASE WHEN COALESCE(e.CATEGORIA_ESOCIAL_EMPREGADO, e.CATEGORIA_ESOCIAL) BETWEEN 101 AND 111
                THEN 1 ELSE 0 END AS empregado,
           CASE WHEN COALESCE(e.CATEGORIA_ESOCIAL, e.CATEGORIA_ESOCIAL_EMPREGADO) IN (721, 722, 723)
                THEN 1 ELSE 0 END AS socio
      FROM bethadba.fobasesserv b
      JOIN bethadba.foempregados e ON e.codi_emp = b.codi_emp AND e.i_empregados = b.i_empregados, p
     WHERE b.competencia BETWEEN DATEADD(month, -1, p.ini) AND p.fim AND b.SIMULACAO = 0 AND b.rateio = 0
       AND b.tipo_process IN (11, 41, 42, 51, 52)
),
ca AS (
    SELECT lm.codi_emp, lm.nume_lan,
           MAX(CASE WHEN fo.socio = 1 AND ABS(fo.bruto - lm.vlor_lan) <= 1 THEN 1 ELSE 0 END) AS sb,
           MAX(CASE WHEN fo.socio = 1 AND ABS(fo.liquido - lm.vlor_lan) <= 1 THEN 1 ELSE 0 END) AS sl,
           MAX(CASE WHEN fo.empregado = 1 AND ABS(fo.bruto - lm.vlor_lan) <= 1 THEN 1 ELSE 0 END) AS eb,
           MAX(CASE WHEN fo.empregado = 1 AND ABS(fo.liquido - lm.vlor_lan) <= 1 THEN 1 ELSE 0 END) AS el
      FROM lm
      JOIN fo ON fo.codi_emp = lm.codi_emp AND (fo.comp = lm.m0 OR fo.comp = lm.m1)
             AND (ABS(fo.bruto - lm.vlor_lan) <= 1 OR ABS(fo.liquido - lm.vlor_lan) <= 1)
     GROUP BY lm.codi_emp, lm.nume_lan
)
SELECT lm.codi_emp AS codigo, lm.cdeb_lan AS conta_debito, lm.ccre_lan AS conta_credito, COUNT(*) AS linhas,
       SUM(COALESCE(ca.sb, 0)) AS socio_bruto, SUM(COALESCE(ca.sl, 0)) AS socio_liquido,
       SUM(COALESCE(ca.eb, 0)) AS empregado_bruto, SUM(COALESCE(ca.el, 0)) AS empregado_liquido,
       SUM(CASE WHEN COALESCE(ca.sb, 0) + COALESCE(ca.sl, 0) + COALESCE(ca.eb, 0) + COALESCE(ca.el, 0) > 0
                THEN 1 ELSE 0 END) AS alguma
  FROM lm
  LEFT JOIN ca ON ca.codi_emp = lm.codi_emp AND ca.nume_lan = lm.nume_lan
 GROUP BY lm.codi_emp, lm.cdeb_lan, lm.ccre_lan
 ORDER BY lm.codi_emp, lm.cdeb_lan, lm.ccre_lan
