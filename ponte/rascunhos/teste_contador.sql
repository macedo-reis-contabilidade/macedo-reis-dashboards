-- teste_contador.sql (rascunho da fila de 17/11/2026, o teste do fechamento; a ponte NÃO lê): o que o contador lançou
-- (a origem 1) na empresa do teste, de 01/2025 a 10/2026, lançamento a lançamento — sem ler a linha: o dia, as contas,
-- o lote e o tipo dele, o código do histórico padrão (o texto não é lido), a origem do registro e o dia de inclusão,
-- com a contagem e a soma. {EMPRESA}: o código do empresa.txt. A saída fica só no PC.
-- Tabelas: bethadba.ctlancto e bethadba.ctlanctolote ("Lancamento em lote": tipo X um débito pra um crédito, C um
-- crédito pra vários débitos, D um débito pra vários créditos, V vários pra vários).
SELECT l.data_lan AS dia, l.codi_lote AS lote, t.tipo AS tipo_lote, l.cdeb_lan AS debito, l.ccre_lan AS credito,
       COALESCE(l.codi_his, 0) AS cod_historico, l.origem_reg, l.dorig_lan AS incluido,
       COUNT(*) AS linhas, CAST(SUM(l.vlor_lan) AS NUMERIC(15,2)) AS soma
  FROM bethadba.ctlancto l
  LEFT JOIN bethadba.ctlanctolote t ON t.codi_emp = l.codi_emp AND t.codi_lote = l.codi_lote
 WHERE l.codi_emp = {EMPRESA} AND l.orig_lan = 1
   AND l.data_lan BETWEEN CAST('2025-01-01' AS DATE) AND CAST('2026-10-31' AS DATE)
 GROUP BY l.data_lan, l.codi_lote, t.tipo, l.cdeb_lan, l.ccre_lan, COALESCE(l.codi_his, 0), l.origem_reg, l.dorig_lan
 ORDER BY l.data_lan, l.codi_lote, l.cdeb_lan, l.ccre_lan
