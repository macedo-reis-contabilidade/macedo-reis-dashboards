-- fechamento_repeticao.sql (rascunho da fila de 11/11/2026, o fechamento automático das contabilidades; a ponte NÃO
-- lê esta pasta): por empresa, cada par de contas analíticas dos lançamentos digitados (a conta de débito e a de
-- crédito, pelo código reduzido), com em quantos meses do período ele apareceu, quantos lançamentos teve e os valores.
-- Os dois parâmetros são o primeiro e o último dia do período (o estudo rodou mês a mês de 2025 e juntou no PC: os
-- meses do par são os arquivos em que ele aparece, e o valor de cada mês é o que diz de onde ele sai).
-- Tabelas: bethadba.ctlancto ("Lancamentos Contabeis": data_lan, orig_lan "Origem" = 1, o lançamento do contador,
-- origem_reg "Origem do registro",
-- cdeb_lan e ccre_lan "Debito"/"Credito", o reduzido do plano da CODI_EMP_PLANO, vlor_lan "Valor"),
-- bethadba.ctcontas (clas_cta, pra o grupo: os 5 primeiros dígitos, o 4º nível do plano modelo; a descrição não entra),
-- bethadba.geempre (stat_emp: A, M, C ou B = ativa) e bethadba.ctparmto.
-- Na partida múltipla, a perna tem o outro lado zerado: a conta 0 (grupo 'PM') é "partida múltipla".
-- meses: em quantos meses o par apareceu; lancamentos: as linhas; importados: as que entraram pelo importador de
-- lançamentos (origem_reg = 2, "Imp. Layout"); meses_um: os meses com um lançamento só do par;
-- valor, menor e maior: a soma, o menor e o maior valor das linhas.
-- Uma linha por empresa e par de contas.
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
    SELECT l.codi_emp, DATEFORMAT(l.data_lan, 'yyyy-mm') AS mes, l.cdeb_lan, l.ccre_lan, l.vlor_lan,
           CASE WHEN l.origem_reg = 2 THEN 1 ELSE 0 END AS imp,
           CASE WHEN l.cdeb_lan = 0 THEN 'PM' ELSE COALESCE(LEFT(TRIM(cd.clas_cta), 5), '-') END AS gd,
           CASE WHEN l.ccre_lan = 0 THEN 'PM' ELSE COALESCE(LEFT(TRIM(cc.clas_cta), 5), '-') END AS gc
      FROM bethadba.ctlancto l
      JOIN emp ON emp.codi_emp = l.codi_emp
      LEFT JOIN bethadba.ctcontas cd ON cd.codi_emp = l.CODI_EMP_PLANO AND cd.codi_cta = l.cdeb_lan
      LEFT JOIN bethadba.ctcontas cc ON cc.codi_emp = l.CODI_EMP_PLANO AND cc.codi_cta = l.ccre_lan, p
     WHERE l.data_lan BETWEEN p.ini AND p.fim AND l.orig_lan = 1
),
pm AS (
    SELECT lm.codi_emp, lm.cdeb_lan, lm.ccre_lan, lm.gd, lm.gc, lm.mes, COUNT(*) AS n, SUM(lm.imp) AS ni,
           SUM(lm.vlor_lan) AS v,
           MIN(lm.vlor_lan) AS vmin, MAX(lm.vlor_lan) AS vmax
      FROM lm
     GROUP BY lm.codi_emp, lm.cdeb_lan, lm.ccre_lan, lm.gd, lm.gc, lm.mes
)
SELECT pm.codi_emp AS codigo, pm.cdeb_lan AS conta_debito, pm.ccre_lan AS conta_credito, pm.gd AS grupo_debito,
       pm.gc AS grupo_credito, COUNT(*) AS meses, SUM(pm.n) AS lancamentos, SUM(pm.ni) AS importados,
       SUM(CASE WHEN pm.n = 1 THEN 1 ELSE 0 END) AS meses_um,
       CAST(SUM(pm.v) AS NUMERIC(15,2)) AS valor, CAST(MIN(pm.vmin) AS NUMERIC(15,2)) AS menor,
       CAST(MAX(pm.vmax) AS NUMERIC(15,2)) AS maior
  FROM pm
 GROUP BY pm.codi_emp, pm.cdeb_lan, pm.ccre_lan, pm.gd, pm.gc
 ORDER BY pm.codi_emp, pm.cdeb_lan, pm.ccre_lan
