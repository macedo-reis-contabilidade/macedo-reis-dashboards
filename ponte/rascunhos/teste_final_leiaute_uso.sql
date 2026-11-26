-- teste_final_leiaute_uso.sql (rascunho da fila de 24/11/2026, a versão final do teste do fechamento; a ponte NÃO lê):
-- como entraram, no escritório inteiro, os lançamentos importados por leiaute em 2025 (origem_reg = 2, o "Imp. Layout")
-- — só contagens: quantos, de quantas empresas, quantos em lote e de que tipo de lote, quantos com conta dos dois lados
-- e quantos com o código de histórico — pra dizer qual leiaute do importador o escritório usa: o 37 (lote, débito e
-- crédito, registros 6000 e 6100) ou o 30 (extrato: uma conta só, sem lote).
-- Tabelas: bethadba.ctlancto e bethadba.ctlanctolote (tipo X, C, D, V). Nenhum valor nem empresa sai.
SELECT COALESCE(t.tipo, '-') AS tipo_lote, COUNT(*) AS linhas, COUNT(DISTINCT l.codi_emp) AS empresas,
       SUM(CASE WHEN l.cdeb_lan <> 0 AND l.ccre_lan <> 0 THEN 1 ELSE 0 END) AS dois_lados,
       SUM(CASE WHEN COALESCE(l.codi_his, 0) <> 0 THEN 1 ELSE 0 END) AS com_cod_historico,
       COUNT(DISTINCT STRING(l.codi_emp, '|', l.codi_lote)) AS lotes
  FROM bethadba.ctlancto l
  LEFT JOIN bethadba.ctlanctolote t ON t.codi_emp = l.codi_emp AND t.codi_lote = l.codi_lote
 WHERE l.origem_reg = 2 AND l.data_lan BETWEEN CAST('2025-01-01' AS DATE) AND CAST('2025-12-31' AS DATE)
 GROUP BY COALESCE(t.tipo, '-')
 ORDER BY 1
