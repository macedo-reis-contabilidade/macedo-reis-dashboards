-- teste_saldo_inicial.sql (rascunho da fila de 17/11/2026, o teste do fechamento; a ponte NÃO lê): o saldo de cada conta
-- da empresa do teste no fim de 11/2024 (débitos menos créditos de todos os lançamentos até 30/11/2024, com o
-- zeramento, como no saldos.sql). Os meses seguintes saem do teste_dia.sql, somados no PC. {EMPRESA}: o código do
-- empresa.txt. A saída fica só no PC. Tabela: bethadba.ctlancto.
WITH mv AS (
    SELECT l.cdeb_lan AS cta, l.vlor_lan AS v FROM bethadba.ctlancto l
     WHERE l.codi_emp = {EMPRESA} AND l.data_lan <= CAST('2024-11-30' AS DATE) AND l.cdeb_lan <> 0
    UNION ALL
    SELECT l.ccre_lan, -l.vlor_lan FROM bethadba.ctlancto l
     WHERE l.codi_emp = {EMPRESA} AND l.data_lan <= CAST('2024-11-30' AS DATE) AND l.ccre_lan <> 0
)
SELECT mv.cta AS reduzido, CAST(SUM(mv.v) AS NUMERIC(15,2)) AS saldo, COUNT(*) AS pernas
  FROM mv GROUP BY mv.cta ORDER BY mv.cta
