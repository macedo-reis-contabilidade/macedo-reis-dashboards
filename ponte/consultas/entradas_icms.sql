-- entradas_icms.sql (versão 5 do pacote, 11/11/2026: o Comparativo tributário; escrita e conferida no Domínio pela fila
-- de 11/11, o rascunho comparativo_entradas.sql): por empresa, o ICMS e o IPI das entradas do mês. Os dois parâmetros
-- são o primeiro e o último dia do mês.
-- Tabelas: bethadba.efentradas ("Notas Fiscais de Entrada", uma linha por segmento: codi_nat "Natureza" = o CFOP;
-- IPI_ENT "Valor IPI"; dent_ent a data de entrada, como o compras.sql) e bethadba.efimpent ("Notas Fiscais de Entrada -
-- Impostos": codi_imp 1 = ICMS; bcal_ien "Base de calculo", vlor_ien "Valor do imposto"). Fora a cancelada, denegada ou
-- inutilizada.
-- Os mesmos grupos do compras.sql, pelos três dígitos finais do CFOP:
--   base_icms_compras, icms_compras e ipi_compras: sobre os segmentos de compras (101, 102, 111, 113, 116 a 118, 120 a
--   122, 124 a 126, 128, 401, 403, 651 e 652). icms_compras é o ICMS destacado na nota que o Domínio escriturou (o
--   crédito de quem está no regime normal; no Simples, o Domínio grava o ICMS da entrada também, e ele não é crédito).
--   icms_despesas: o ICMS sobre os segmentos de servicos_tomados (250 a 257, 300 a 306, 350 a 360 e 930 a 933) e de
--   ativo_e_consumo (406, 407 e 551 a 557).
-- O IPI sai do segmento (IPI_ENT): a linha 2 (IPI) da efimpent está vazia em 09/2026 (0 segmentos), e o campo do
-- segmento tem o valor (321 segmentos). Uma linha por empresa com nota de entrada no mês.
WITH p AS (SELECT CAST(? AS DATE) AS ini, CAST(? AS DATE) AS fim),
seg AS (
    SELECT e.codi_emp, e.codi_ent, MOD(e.codi_nat, 1000) AS c, COALESCE(e.IPI_ENT, 0) AS ipi
      FROM bethadba.efentradas e, p
     WHERE e.dent_ent BETWEEN p.ini AND p.fim
       AND COALESCE(e.situacao_ent, 0) NOT IN (2, 3, 4, 5)
),
icms AS (
    SELECT seg.codi_emp, seg.codi_ent, SUM(i.bcal_ien) AS base, SUM(i.vlor_ien) AS valor
      FROM seg JOIN bethadba.efimpent i ON i.codi_emp = seg.codi_emp AND i.codi_ent = seg.codi_ent AND i.codi_imp = 1
     GROUP BY seg.codi_emp, seg.codi_ent
),
g AS (
    SELECT seg.codi_emp, seg.ipi, COALESCE(icms.base, 0) AS base, COALESCE(icms.valor, 0) AS valor,
           CASE WHEN seg.c IN (101, 102, 111, 113, 116, 117, 118, 120, 121, 122, 124, 125, 126, 128, 401, 403, 651, 652)
                THEN 'C'
                WHEN seg.c BETWEEN 250 AND 257 OR seg.c BETWEEN 300 AND 306 OR seg.c BETWEEN 350 AND 360
                  OR seg.c BETWEEN 930 AND 933 OR seg.c IN (406, 407) OR seg.c BETWEEN 551 AND 557
                THEN 'D' ELSE 'O' END AS grupo
      FROM seg LEFT JOIN icms ON icms.codi_emp = seg.codi_emp AND icms.codi_ent = seg.codi_ent
)
SELECT g.codi_emp AS codigo,
       CAST(SUM(CASE WHEN g.grupo = 'C' THEN g.base ELSE 0 END) AS NUMERIC(15,2)) AS base_icms_compras,
       CAST(SUM(CASE WHEN g.grupo = 'C' THEN g.valor ELSE 0 END) AS NUMERIC(15,2)) AS icms_compras,
       CAST(SUM(CASE WHEN g.grupo = 'C' THEN g.ipi ELSE 0 END) AS NUMERIC(15,2)) AS ipi_compras,
       CAST(SUM(CASE WHEN g.grupo = 'D' THEN g.valor ELSE 0 END) AS NUMERIC(15,2)) AS icms_despesas
  FROM g
 GROUP BY g.codi_emp
 ORDER BY g.codi_emp
