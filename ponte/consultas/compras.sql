-- compras.sql: por empresa, as entradas do mês separadas pelo CFOP. Os dois
-- parâmetros são o primeiro e o último dia do mês. Tabela: bethadba.efentradas ("Notas Fiscais de Entrada", uma linha
-- por segmento da nota; codi_nat "Natureza" = o CFOP de 4 dígitos, vcon_ent "Valor contabil", dent_ent a data de
-- entrada, a do livro, como o fiscal.sql). Fica de fora a cancelada, denegada ou inutilizada (situacao 2 a 5).
-- Pelo CFOP e não pelo acumulador: o acumulador das entradas não diz se é compra pra revenda, imobilizado ou uso e
-- consumo (só as marcas de devolução, de frete e de serviço terceirizado); o CFOP diz. Os três dígitos finais:
-- compras = 101, 102, 111, 113, 116 a 118, 120 a 122, 124 a 126, 128 (revenda, industrialização, consignação,
-- entrega futura, venda à ordem, industrialização por outra empresa), 401 e 403 (as mesmas com ST) e 651 e 652
-- (combustível pra industrialização ou revenda); compras_st = 401 e 403 (já dentro de compras).
-- servicos_tomados = 250 a 257 (energia), 300 a 306 (comunicação), 350 a 360 (transporte, o CT-e do frete) e 930 a 933
-- (o serviço tomado do ISS e o crédito do transporte); ativo_e_consumo = 406, 407 e 551 a 557 (imobilizado e uso e
-- consumo); devolucoes_de_venda = 201 a 209, 410, 411 e 660 a 662; outras_entradas = o resto (remessa, retorno,
-- transferência, bonificação, a nota de entrada que a própria empresa emite pra devolver ou retornar).
-- A empresa sem nota de entrada no mês não tem linha.
WITH p AS (SELECT CAST(? AS DATE) AS ini, CAST(? AS DATE) AS fim),
e AS (
    SELECT e.codi_emp AS codigo, MOD(e.codi_nat, 1000) AS c, COALESCE(e.vcon_ent, 0) AS v
      FROM bethadba.efentradas e, p
     WHERE e.dent_ent BETWEEN p.ini AND p.fim
       AND COALESCE(e.situacao_ent, 0) NOT IN (2, 3, 4, 5)
)
SELECT e.codigo AS codigo,
       CAST(SUM(CASE WHEN e.c IN (101, 102, 111, 113, 116, 117, 118, 120, 121, 122, 124, 125, 126, 128,
                                   401, 403, 651, 652) THEN e.v ELSE 0 END) AS NUMERIC(15,2)) AS compras,
       CAST(SUM(CASE WHEN e.c IN (401, 403) THEN e.v ELSE 0 END) AS NUMERIC(15,2)) AS compras_st,
       CAST(SUM(CASE WHEN e.c BETWEEN 250 AND 257 OR e.c BETWEEN 300 AND 306 OR e.c BETWEEN 350 AND 360
                          OR e.c BETWEEN 930 AND 933 THEN e.v ELSE 0 END) AS NUMERIC(15,2)) AS servicos_tomados,
       CAST(SUM(CASE WHEN e.c IN (406, 407) OR e.c BETWEEN 551 AND 557 THEN e.v ELSE 0 END) AS NUMERIC(15,2)) AS ativo_e_consumo,
       CAST(SUM(CASE WHEN e.c BETWEEN 201 AND 209 OR e.c IN (410, 411) OR e.c BETWEEN 660 AND 662
                     THEN e.v ELSE 0 END) AS NUMERIC(15,2)) AS devolucoes_de_venda,
       CAST(SUM(CASE WHEN e.c IN (101, 102, 111, 113, 116, 117, 118, 120, 121, 122, 124, 125, 126, 128,
                                   401, 403, 651, 652)
                       OR e.c BETWEEN 250 AND 257 OR e.c BETWEEN 300 AND 306 OR e.c BETWEEN 350 AND 360
                       OR e.c BETWEEN 930 AND 933 OR e.c IN (406, 407) OR e.c BETWEEN 551 AND 557
                       OR e.c BETWEEN 201 AND 209 OR e.c IN (410, 411) OR e.c BETWEEN 660 AND 662
                     THEN 0 ELSE e.v END) AS NUMERIC(15,2)) AS outras_entradas
  FROM e
 GROUP BY e.codigo
 ORDER BY e.codigo
