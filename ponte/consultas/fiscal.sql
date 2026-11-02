-- fiscal.sql: por empresa, as notas com data no mês e a soma do valor contábil. Saídas = bethadba.efsaidas
-- ("Notas Fiscais de Saida", pela dsai_sai, a data da apuração) + bethadba.efservicos ("Notas Fiscais de Servico",
-- o serviço prestado, pela dser_ser); entradas = bethadba.efentradas ("Notas Fiscais de Entrada", pela dent_ent),
-- que já traz o serviço tomado. A nota com mais de um acumulador ou CFOP fica em várias linhas (os segmentos, cada
-- um com a sua parte do valor): o valor soma as linhas e a contagem é de notas distintas (espécie, série, subsérie,
-- número e cliente ou fornecedor). Fica de fora a nota cancelada, denegada ou inutilizada (situacao 2, 3, 4 e 5,
-- os códigos do SPED; o campo cancelada vem sempre N, e a cancelada já vem com valor zero).
-- A empresa sem nota no mês não tem linha.
WITH p AS (SELECT CAST(? AS DATE) AS ini, CAST(? AS DATE) AS fim),
mov AS (
    SELECT s.codi_emp AS codigo,
           COUNT(DISTINCT STRING(s.codi_esp, '|', s.seri_sai, '|', s.sub_serie_sai, '|', s.nume_sai, '|', s.codi_cli)) AS ns,
           SUM(COALESCE(s.vcon_sai, 0)) AS vs,
           0 AS ne,
           CAST(0 AS NUMERIC(15,2)) AS ve
      FROM bethadba.efsaidas s, p
     WHERE s.dsai_sai BETWEEN p.ini AND p.fim
       AND COALESCE(s.situacao_sai, 0) NOT IN (2, 3, 4, 5)
       AND COALESCE(s.cancelada_sai, 'N') <> 'S'
     GROUP BY s.codi_emp
    UNION ALL
    SELECT v.codi_emp,
           COUNT(DISTINCT STRING(v.codi_esp, '|', v.seri_ser, '|', v.sub_serie_ser, '|', v.nume_ser, '|', v.codi_cli)),
           SUM(COALESCE(v.vcon_ser, 0)),
           0,
           0
      FROM bethadba.efservicos v, p
     WHERE v.dser_ser BETWEEN p.ini AND p.fim
       AND COALESCE(v.situacao_ser, 0) NOT IN (2, 3, 4, 5)
       AND COALESCE(v.cancelada_ser, 'N') <> 'S'
     GROUP BY v.codi_emp
    UNION ALL
    SELECT e.codi_emp,
           0,
           0,
           COUNT(DISTINCT STRING(e.codi_esp, '|', e.seri_ent, '|', e.sub_serie_ent, '|', e.nume_ent, '|', e.codi_for)),
           SUM(COALESCE(e.vcon_ent, 0))
      FROM bethadba.efentradas e, p
     WHERE e.dent_ent BETWEEN p.ini AND p.fim
       AND COALESCE(e.situacao_ent, 0) NOT IN (2, 3, 4, 5)
     GROUP BY e.codi_emp
)
SELECT codigo,
       SUM(ns) AS notas_saida,
       SUM(vs) AS valor_saidas,
       SUM(ne) AS notas_entrada,
       SUM(ve) AS valor_entradas
  FROM mov
 GROUP BY codigo
 ORDER BY codigo
