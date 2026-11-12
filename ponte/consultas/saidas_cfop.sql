-- saidas_cfop.sql (versão 5 do pacote, 11/11/2026: o Comparativo tributário; escrita e conferida no Domínio pela fila de
-- 11/11, o rascunho comparativo_saidas.sql): por empresa, as vendas do mês pelo CFOP, o ICMS destacado, o ICMS-ST e o
-- IPI. Os dois parâmetros são o primeiro e o último dia do mês.
-- Tabelas: bethadba.efsaidas ("Notas Fiscais de Saida", uma linha por segmento: codi_nat "Natureza" = o CFOP de 4
-- dígitos, 5101 a 7949 em 09/2026; vcon_sai "Valor contabil"; IPI_SAI "Valor IPI"; ICMS_ST_SAI "Valor ICMS ST"),
-- bethadba.efimpsai ("Notas Fiscais de Saida - Impostos": codi_imp 1 = ICMS na bethadba.geimposto; bcal_isa "Base de
-- calculo", vlor_isa "Valor do imposto") e bethadba.EFACUMULADOR_VIGENCIA (o corte do faturamento.sql: a vigência mais
-- recente do acumulador até o fim do mês e IFAT_ACU = 'S'). Fora a nota cancelada, denegada ou inutilizada.
-- O IPI e o ICMS-ST saem do segmento: as linhas 2 (IPI) e 9 (SUBTRI) da efimpsai estão vazias em 09/2026 (0 segmentos
-- de saída), e o campo do segmento tem o valor.
-- Os grupos, pelos três dígitos finais do CFOP (o valor contábil):
--   venda_producao 101, 103, 105, 107, 109, 111, 113, 116, 118, 122, 401 e 402 · venda_revenda 102, 104, 106, 108,
--   110, 112, 114, 115, 117, 119, 120, 123, 403, 404 e 405 · venda_combustivel 651 a 656 ·
--   industrializacao_encomenda 124 e 125 · transporte 351 a 360, 932 e 933 (transporte_357, só o 357, já dentro dele)
--   · energia_comunicacao 251 a 258 e 301 a 307 · outras_saidas, o resto que o acumulador marca como faturamento.
-- saidas_no_estado, saidas_outro_estado e saidas_exterior: o primeiro dígito do CFOP (5, 6 e 7), sobre os mesmos
-- segmentos. base_icms_saidas e icms_saidas: a linha 1 da efimpsai (no Simples, quase sempre zero: o ICMS vai no DAS).
-- A soma dos grupos é a parte de mercadoria do faturamento.sql antes da devolução (receita_mercadorias), e a das três
-- colunas do estado também. O CT-e (espécie 43) entra aqui, não na efservicos.
-- Uma linha por empresa com segmento de faturamento no mês.
WITH p AS (SELECT CAST(? AS DATE) AS ini, CAST(? AS DATE) AS fim),
v AS (
    SELECT a.CODI_EMP, a.CODI_ACU, a.IFAT_ACU
      FROM bethadba.EFACUMULADOR_VIGENCIA a, p
     WHERE a.VIGENCIA_ACU = (SELECT MAX(b.VIGENCIA_ACU) FROM bethadba.EFACUMULADOR_VIGENCIA b
                              WHERE b.CODI_EMP = a.CODI_EMP AND b.CODI_ACU = a.CODI_ACU AND b.VIGENCIA_ACU <= p.fim)
),
seg AS (
    SELECT s.codi_emp, s.codi_sai, s.codi_nat AS cfop, MOD(s.codi_nat, 1000) AS c, COALESCE(s.vcon_sai, 0) AS vl,
           COALESCE(s.IPI_SAI, 0) AS ipi, COALESCE(s.ICMS_ST_SAI, 0) AS st
      FROM bethadba.efsaidas s JOIN v ON v.CODI_EMP = s.codi_emp AND v.CODI_ACU = s.codi_acu, p
     WHERE s.dsai_sai BETWEEN p.ini AND p.fim
       AND COALESCE(s.situacao_sai, 0) NOT IN (2, 3, 4, 5)
       AND COALESCE(s.cancelada_sai, 'N') <> 'S'
       AND v.IFAT_ACU = 'S'
),
icms AS (
    SELECT seg.codi_emp, seg.codi_sai, SUM(i.bcal_isa) AS base, SUM(i.vlor_isa) AS valor
      FROM seg JOIN bethadba.efimpsai i ON i.codi_emp = seg.codi_emp AND i.codi_sai = seg.codi_sai AND i.codi_imp = 1
     GROUP BY seg.codi_emp, seg.codi_sai
)
SELECT seg.codi_emp AS codigo,
       CAST(SUM(CASE WHEN seg.c IN (101, 103, 105, 107, 109, 111, 113, 116, 118, 122, 401, 402) THEN seg.vl ELSE 0 END)
            AS NUMERIC(15,2)) AS venda_producao,
       CAST(SUM(CASE WHEN seg.c IN (102, 104, 106, 108, 110, 112, 114, 115, 117, 119, 120, 123, 403, 404, 405)
                THEN seg.vl ELSE 0 END) AS NUMERIC(15,2)) AS venda_revenda,
       CAST(SUM(CASE WHEN seg.c BETWEEN 651 AND 656 THEN seg.vl ELSE 0 END) AS NUMERIC(15,2)) AS venda_combustivel,
       CAST(SUM(CASE WHEN seg.c IN (124, 125) THEN seg.vl ELSE 0 END) AS NUMERIC(15,2)) AS industrializacao_encomenda,
       CAST(SUM(CASE WHEN seg.c BETWEEN 351 AND 360 OR seg.c IN (932, 933) THEN seg.vl ELSE 0 END)
            AS NUMERIC(15,2)) AS transporte,
       CAST(SUM(CASE WHEN seg.c = 357 THEN seg.vl ELSE 0 END) AS NUMERIC(15,2)) AS transporte_357,
       CAST(SUM(CASE WHEN seg.c BETWEEN 251 AND 258 OR seg.c BETWEEN 301 AND 307 THEN seg.vl ELSE 0 END)
            AS NUMERIC(15,2)) AS energia_comunicacao,
       CAST(SUM(CASE WHEN seg.c IN (101, 103, 105, 107, 109, 111, 113, 116, 118, 122, 401, 402,
                                    102, 104, 106, 108, 110, 112, 114, 115, 117, 119, 120, 123, 403, 404, 405, 124, 125)
                       OR seg.c BETWEEN 651 AND 656 OR seg.c BETWEEN 351 AND 360 OR seg.c IN (932, 933)
                       OR seg.c BETWEEN 251 AND 258 OR seg.c BETWEEN 301 AND 307
                THEN 0 ELSE seg.vl END) AS NUMERIC(15,2)) AS outras_saidas,
       CAST(SUM(CASE WHEN seg.cfop BETWEEN 5000 AND 5999 THEN seg.vl ELSE 0 END) AS NUMERIC(15,2)) AS saidas_no_estado,
       CAST(SUM(CASE WHEN seg.cfop BETWEEN 6000 AND 6999 THEN seg.vl ELSE 0 END) AS NUMERIC(15,2)) AS saidas_outro_estado,
       CAST(SUM(CASE WHEN seg.cfop BETWEEN 7000 AND 7999 THEN seg.vl ELSE 0 END) AS NUMERIC(15,2)) AS saidas_exterior,
       CAST(SUM(COALESCE(icms.base, 0)) AS NUMERIC(15,2)) AS base_icms_saidas,
       CAST(SUM(COALESCE(icms.valor, 0)) AS NUMERIC(15,2)) AS icms_saidas,
       CAST(SUM(seg.st) AS NUMERIC(15,2)) AS icms_st_saidas,
       CAST(SUM(seg.ipi) AS NUMERIC(15,2)) AS ipi_saidas
  FROM seg
  LEFT JOIN icms ON icms.codi_emp = seg.codi_emp AND icms.codi_sai = seg.codi_sai
 GROUP BY seg.codi_emp
 ORDER BY seg.codi_emp
