-- fechamento_tamanho.sql (rascunho da fila de 11/11/2026, o fechamento automático das contabilidades; a ponte NÃO lê
-- esta pasta): por empresa e mês, quantos lançamentos o contador digitou e quanto eles movimentaram. Os dois parâmetros
-- são o primeiro e o último dia do período (o estudo rodou mês a mês, de 01 a 12/2025 e de 01 a 10/2026: o ano
-- inteiro numa consulta só passou de 3 minutos).
-- Tabelas: bethadba.ctlancto ("Lancamentos Contabeis": data_lan, orig_lan "Origem", origem_reg "Origem do registro",
-- codi_lote,
-- cdeb_lan e ccre_lan, o reduzido do plano da CODI_EMP_PLANO, vlor_lan), bethadba.ctcontas ("Contas Contabeis -
-- Cadastro": clas_cta, só os dígitos — os bancos são as analíticas do 11102 do plano modelo, como no andamento.sql),
-- bethadba.geempre (stat_emp: A, M, C ou B = ativa, como no empresas.sql) e bethadba.ctparmto (a contabilidade aberta).
-- As empresas: ativas no Domínio, com a ctparmto e algum lançamento no período (qualquer origem).
-- digitados: as linhas da origem 1 (o lanc_normais do origens.sql, o lançamento do contador). A partida múltipla é uma
-- linha por perna, com o outro lado zerado (cdeb_lan ou ccre_lan = 0), e as pernas do mesmo lançamento têm o mesmo
-- codi_lote; cada perna conta como uma linha, como na ponte. lotes: os codi_lote distintos (os lançamentos). pernas_pm:
-- as linhas com um lado zerado. valor_digitado: o valor debitado (a linha com conta de débito: na partida múltipla o
-- valor do lote entra uma vez só).
-- importados: das digitadas, as que entraram pelo importador de lançamentos (origem_reg = 2, "Imp. Layout" na descrição
-- do catálogo: a origem 1 não separa o que o contador digitou do que ele importou de um arquivo).
-- lanc_mes: as linhas do mês de qualquer origem, fora o zeramento (o mês em que a empresa tem contabilidade).
-- banco_mes e digitados_banco: as linhas (de qualquer origem; só as digitadas) com conta do 11102 em um dos lados.
-- folha_mes: as linhas da origem 13 (a folha integrada).
-- Uma linha por empresa e mês com algum lançamento fora o zeramento.
WITH p AS (SELECT CAST(? AS DATE) AS ini, CAST(? AS DATE) AS fim),
emp AS (
    SELECT g.codi_emp
      FROM bethadba.geempre g, p
     WHERE UPPER(TRIM(g.stat_emp)) IN ('A', 'M', 'C', 'B')
       AND EXISTS (SELECT 1 FROM bethadba.ctparmto c WHERE c.codi_emp = g.codi_emp)
       AND EXISTS (SELECT 1 FROM bethadba.ctlancto x
                    WHERE x.codi_emp = g.codi_emp AND x.data_lan BETWEEN p.ini AND p.fim)
),
bco AS (
    SELECT c.codi_emp AS plano, c.codi_cta
      FROM bethadba.ctcontas c
     WHERE c.tipo_cta = 'A' AND LEFT(TRIM(c.clas_cta), 5) = '11102'
),
lm AS (
    SELECT l.codi_emp, DATEFORMAT(l.data_lan, 'yyyy-mm') AS mes, l.orig_lan, l.origem_reg, l.codi_lote, l.cdeb_lan,
           l.ccre_lan, l.vlor_lan,
           CASE WHEN kd.codi_cta IS NOT NULL OR kc.codi_cta IS NOT NULL THEN 1 ELSE 0 END AS banco
      FROM bethadba.ctlancto l
      JOIN emp ON emp.codi_emp = l.codi_emp
      LEFT JOIN bco kd ON kd.plano = l.CODI_EMP_PLANO AND kd.codi_cta = l.cdeb_lan
      LEFT JOIN bco kc ON kc.plano = l.CODI_EMP_PLANO AND kc.codi_cta = l.ccre_lan, p
     WHERE l.data_lan BETWEEN p.ini AND p.fim AND l.orig_lan <> 2
)
SELECT lm.codi_emp AS codigo, lm.mes AS competencia,
       SUM(CASE WHEN lm.orig_lan = 1 THEN 1 ELSE 0 END) AS digitados,
       SUM(CASE WHEN lm.orig_lan = 1 AND lm.origem_reg = 2 THEN 1 ELSE 0 END) AS importados,
       COUNT(DISTINCT CASE WHEN lm.orig_lan = 1 THEN lm.codi_lote END) AS lotes,
       SUM(CASE WHEN lm.orig_lan = 1 AND (lm.cdeb_lan = 0 OR lm.ccre_lan = 0) THEN 1 ELSE 0 END) AS pernas_pm,
       CAST(SUM(CASE WHEN lm.orig_lan = 1 AND lm.cdeb_lan <> 0 THEN lm.vlor_lan ELSE 0 END) AS NUMERIC(15,2))
            AS valor_digitado,
       COUNT(*) AS lanc_mes,
       SUM(lm.banco) AS banco_mes,
       SUM(CASE WHEN lm.orig_lan = 1 THEN lm.banco ELSE 0 END) AS digitados_banco,
       SUM(CASE WHEN lm.orig_lan = 13 THEN 1 ELSE 0 END) AS folha_mes
  FROM lm
 GROUP BY lm.codi_emp, lm.mes
 ORDER BY lm.codi_emp, lm.mes
