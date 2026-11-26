-- teste_final_plano.sql (rascunho da fila de 24/11/2026, a versão final do teste do fechamento; a ponte NÃO lê): as
-- analíticas do plano da empresa do teste que podem receber a retirada do sócio (lucros distribuídos, retirada,
-- dividendos, conta de sócio) e os juros e as multas, com ou sem lançamento — com marcas tiradas da descrição só dentro
-- do filtro (LIKE, 0 ou 1): a descrição da conta nunca sai. O código da empresa (do empresa.txt) entra no lugar do
-- marcador do corpo na hora de rodar, sem os comentários. A saída fica só no PC.
-- Tabelas: bethadba.ctcontas (codi_cta, o reduzido; clas_cta, a classificação; tipo_cta, A analítica; a nome_cta só nos
-- filtros) e bethadba.ctlancto (o plano é a CODI_EMP_PLANO).
SELECT c.codi_cta AS reduzido, TRIM(c.clas_cta) AS classificacao, LEFT(TRIM(c.clas_cta), 5) AS grupo,
  CASE WHEN UPPER(c.nome_cta) LIKE '%LUCRO%' AND UPPER(c.nome_cta) LIKE '%DISTRIBU_DO%' THEN 1 ELSE 0 END AS f_distribuidos,
  CASE WHEN UPPER(c.nome_cta) LIKE '%A DISTRIBUIR%' THEN 1 ELSE 0 END AS f_a_distribuir,
  CASE WHEN UPPER(c.nome_cta) LIKE '%RETIRAD%' THEN 1 ELSE 0 END AS f_retirada,
  CASE WHEN UPPER(c.nome_cta) LIKE '%DIVIDEND%' THEN 1 ELSE 0 END AS f_dividendo,
  CASE WHEN UPPER(c.nome_cta) LIKE '%S_CIO%' THEN 1 ELSE 0 END AS f_socio,
  CASE WHEN UPPER(c.nome_cta) LIKE '%LUCRO%' THEN 1 ELSE 0 END AS f_lucro,
  CASE WHEN UPPER(c.nome_cta) LIKE '%ACUMULAD%' THEN 1 ELSE 0 END AS f_acumulado,
  CASE WHEN UPPER(c.nome_cta) LIKE '%JURO%' THEN 1 ELSE 0 END AS f_juros,
  CASE WHEN UPPER(c.nome_cta) LIKE '%MULTA%' THEN 1 ELSE 0 END AS f_multa,
  CASE WHEN UPPER(c.nome_cta) LIKE '%PAGAR%' THEN 1 ELSE 0 END AS f_pagar
  FROM bethadba.ctcontas c
 WHERE c.codi_emp = (SELECT FIRST l.CODI_EMP_PLANO FROM bethadba.ctlancto l WHERE l.codi_emp = {EMPRESA})
   AND c.tipo_cta = 'A'
   AND (UPPER(c.nome_cta) LIKE '%LUCRO%' OR UPPER(c.nome_cta) LIKE '%RETIRAD%' OR UPPER(c.nome_cta) LIKE '%DIVIDEND%'
        OR UPPER(c.nome_cta) LIKE '%S_CIO%' OR UPPER(c.nome_cta) LIKE '%JURO%' OR UPPER(c.nome_cta) LIKE '%MULTA%'
        OR LEFT(TRIM(c.clas_cta), 5) = '32205')
 ORDER BY TRIM(c.clas_cta)
