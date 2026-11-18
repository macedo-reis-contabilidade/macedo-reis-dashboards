-- teste_acertos_notas.sql (rascunho da fila de 17/11/2026, os acertos do teste do fechamento; a ponte NÃO lê): as notas
-- de entrada e de saída da empresa do teste na escrita fiscal, por mês, de 12/2024 a 10/2026 — pra comparar com o que a
-- integração lançou na contabilidade (o ponto 10: nota em dobro). Tabelas e regras do ponte/consultas/fiscal.sql:
-- bethadba.efentradas e bethadba.efsaidas (a nota pela espécie, série, subsérie, número e o fornecedor ou o cliente;
-- fora a cancelada, a denegada e a inutilizada; o valor contábil). linhas: as linhas da tabela (a nota em várias linhas,
-- os segmentos, conta uma vez em notas); com_varias: as notas com mais de uma linha. Só a contagem e a soma.
-- {EMPRESA}: o código do empresa.txt. A saída fica só no PC.
WITH e AS (
    SELECT DATEFORMAT(x.dent_ent, 'yyyy-mm') AS mes,
           STRING(x.codi_esp, '|', x.seri_ent, '|', x.sub_serie_ent, '|', x.nume_ent, '|', x.codi_for) AS chave,
           COALESCE(x.vcon_ent, 0) AS v
      FROM bethadba.efentradas x
     WHERE x.codi_emp = {EMPRESA} AND x.dent_ent BETWEEN CAST('2024-12-01' AS DATE) AND CAST('2026-10-31' AS DATE)
       AND COALESCE(x.situacao_ent, 0) NOT IN (2, 3, 4, 5)
),
s AS (
    SELECT DATEFORMAT(x.dsai_sai, 'yyyy-mm') AS mes,
           STRING(x.codi_esp, '|', x.seri_sai, '|', x.sub_serie_sai, '|', x.nume_sai, '|', x.codi_cli) AS chave,
           COALESCE(x.vcon_sai, 0) AS v
      FROM bethadba.efsaidas x
     WHERE x.codi_emp = {EMPRESA} AND x.dsai_sai BETWEEN CAST('2024-12-01' AS DATE) AND CAST('2026-10-31' AS DATE)
       AND COALESCE(x.situacao_sai, 0) NOT IN (2, 3, 4, 5) AND COALESCE(x.cancelada_sai, 'N') <> 'S'
),
ek AS (SELECT mes, chave, COUNT(*) AS n, SUM(v) AS v FROM e GROUP BY mes, chave),
sk AS (SELECT mes, chave, COUNT(*) AS n, SUM(v) AS v FROM s GROUP BY mes, chave)
SELECT 'entrada' AS tipo, mes, COUNT(*) AS notas, SUM(n) AS linhas, SUM(CASE WHEN n > 1 THEN 1 ELSE 0 END) AS com_varias,
       CAST(SUM(v) AS NUMERIC(15,2)) AS soma
  FROM ek GROUP BY mes
UNION ALL
SELECT 'saida', mes, COUNT(*), SUM(n), SUM(CASE WHEN n > 1 THEN 1 ELSE 0 END), CAST(SUM(v) AS NUMERIC(15,2))
  FROM sk GROUP BY mes
 ORDER BY 1, 2
