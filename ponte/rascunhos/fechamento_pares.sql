-- fechamento_pares.sql (rascunho da fila de 11/11/2026, o fechamento automático das contabilidades; a ponte NÃO lê
-- esta pasta): por empresa, os lançamentos do período pelo par de grupos (o grupo da conta de débito e o da conta de
-- crédito), separados pela origem: o digitado (a 1, o lançamento do contador), a escrita fiscal (4 a 9, 11 e 21 a 29) e
-- a folha (13). Os dois parâmetros são o primeiro e o último dia do período (o estudo rodou mês a mês de 2025 e somou
-- no PC: as empresas contadas uma vez, os meses-empresa somados).
-- Tabelas: bethadba.ctlancto ("Lancamentos Contabeis": data_lan, orig_lan "Origem", origem_reg "Origem do registro",
-- cdeb_lan e ccre_lan, o reduzido do plano da CODI_EMP_PLANO, vlor_lan), bethadba.ctcontas ("Contas Contabeis -
-- Cadastro": clas_cta, a classificação só com os dígitos; a descrição não entra), bethadba.geempre (stat_emp: A, M, C
-- ou B = ativa) e bethadba.ctparmto.
-- As empresas: ativas no Domínio, com a ctparmto e algum lançamento no período.
-- O grupo: a classificação cortada no 4º nível do plano modelo, os 5 primeiros dígitos (o caixa é o 11101 e os bancos o
-- 11102). Em 2025 todas as contas lançadas têm a classificação de 8 a 11 dígitos, com o grupo de 5 (a máscara do
-- ctparmto diz outra coisa: o que vale é o que está guardado). Na partida múltipla (a perna com o outro lado zerado), o
-- outro lado é 'PM' (a conta que não está no cadastro, '-').
-- lancamentos: as linhas (cada perna da partida múltipla é uma); importados: as do digitado que entraram pelo
-- importador de lançamentos (origem_reg = 2, "Imp. Layout"); meses: em quantos meses do período o par apareceu na
-- empresa; valor: a soma das linhas.
-- Uma linha por empresa, origem e par.
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
    SELECT l.codi_emp, DATEFORMAT(l.data_lan, 'yyyy-mm') AS mes,
           CASE WHEN l.orig_lan = 1 THEN 'digitado' WHEN l.orig_lan = 13 THEN 'folha' ELSE 'fiscal' END AS origem,
           CASE WHEN l.orig_lan = 1 AND l.origem_reg = 2 THEN 1 ELSE 0 END AS imp,
           CASE WHEN l.cdeb_lan = 0 THEN 'PM' ELSE COALESCE(LEFT(TRIM(cd.clas_cta), 5), '-') END AS gd,
           CASE WHEN l.ccre_lan = 0 THEN 'PM' ELSE COALESCE(LEFT(TRIM(cc.clas_cta), 5), '-') END AS gc,
           l.vlor_lan
      FROM bethadba.ctlancto l
      JOIN emp ON emp.codi_emp = l.codi_emp
      LEFT JOIN bethadba.ctcontas cd ON cd.codi_emp = l.CODI_EMP_PLANO AND cd.codi_cta = l.cdeb_lan
      LEFT JOIN bethadba.ctcontas cc ON cc.codi_emp = l.CODI_EMP_PLANO AND cc.codi_cta = l.ccre_lan, p
     WHERE l.data_lan BETWEEN p.ini AND p.fim
       AND (l.orig_lan IN (1, 11, 13) OR l.orig_lan BETWEEN 4 AND 9 OR l.orig_lan BETWEEN 21 AND 29)
)
SELECT lm.codi_emp AS codigo, lm.origem, lm.gd AS grupo_debito, lm.gc AS grupo_credito,
       COUNT(*) AS lancamentos, SUM(lm.imp) AS importados, COUNT(DISTINCT lm.mes) AS meses,
       CAST(SUM(lm.vlor_lan) AS NUMERIC(15,2)) AS valor
  FROM lm
 GROUP BY lm.codi_emp, lm.origem, lm.gd, lm.gc
 ORDER BY lm.codi_emp, lm.origem, lm.gd, lm.gc
