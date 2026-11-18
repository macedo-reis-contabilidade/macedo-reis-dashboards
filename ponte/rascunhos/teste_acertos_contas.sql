-- teste_acertos_contas.sql (rascunho da fila de 17/11/2026, os acertos do teste do fechamento; a ponte NÃO lê): as
-- analíticas de alguns grupos do plano da empresa do teste, com marcas tiradas da descrição só dentro do filtro (LIKE,
-- 0 ou 1): a descrição da conta nunca sai. Serve pra dizer o que é a conta (despesas diversas, ajustes de exercícios
-- anteriores, bonificação) sem ler o nome. {EMPRESA}: o código do empresa.txt. Tabelas: bethadba.ctcontas e
-- bethadba.ctlancto (o plano é a CODI_EMP_PLANO). A saída fica só no PC.
SELECT c.codi_cta AS reduzido, LEFT(TRIM(c.clas_cta), 5) AS grupo,
  CASE WHEN UPPER(c.nome_cta) LIKE '%DIVERS%' THEN 1 ELSE 0 END AS f_divers,
  CASE WHEN UPPER(c.nome_cta) LIKE '%OUTRA%' OR UPPER(c.nome_cta) LIKE '%GERA%' THEN 1 ELSE 0 END AS f_outras,
  CASE WHEN UPPER(c.nome_cta) LIKE '%ALUG%' THEN 1 ELSE 0 END AS f_aluguel,
  CASE WHEN UPPER(c.nome_cta) LIKE '%ENERG%' OR UPPER(c.nome_cta) LIKE '%LUZ%' THEN 1 ELSE 0 END AS f_energia,
  CASE WHEN UPPER(c.nome_cta) LIKE '%TELEF%' OR UPPER(c.nome_cta) LIKE '%INTERNET%' THEN 1 ELSE 0 END AS f_tel,
  CASE WHEN UPPER(c.nome_cta) LIKE '%_GUA%' THEN 1 ELSE 0 END AS f_agua,
  CASE WHEN UPPER(c.nome_cta) LIKE '%CUSTO%' OR UPPER(c.nome_cta) LIKE '%CMV%' THEN 1 ELSE 0 END AS f_custo,
  CASE WHEN UPPER(c.nome_cta) LIKE '%MERCADOR%' THEN 1 ELSE 0 END AS f_mercadoria,
  CASE WHEN UPPER(c.nome_cta) LIKE '%RETIRAD%' OR UPPER(c.nome_cta) LIKE '%DISTRIBU%' THEN 1 ELSE 0 END AS f_retirada,
  CASE WHEN UPPER(c.nome_cta) LIKE '%AJUSTE%' OR UPPER(c.nome_cta) LIKE '%PERDA%' THEN 1 ELSE 0 END AS f_ajuste,
  CASE WHEN UPPER(c.nome_cta) LIKE '%SERVI%' THEN 1 ELSE 0 END AS f_servico,
  CASE WHEN UPPER(c.nome_cta) LIKE '%CONTAB%' THEN 1 ELSE 0 END AS f_contab,
  CASE WHEN UPPER(c.nome_cta) LIKE '%IMPOST%' OR UPPER(c.nome_cta) LIKE '%TRIBUT%' THEN 1 ELSE 0 END AS f_imposto,
  CASE WHEN UPPER(c.nome_cta) LIKE '%PAGAR%' THEN 1 ELSE 0 END AS f_pagar,
  CASE WHEN UPPER(c.nome_cta) LIKE '%ACUMULAD%' THEN 1 ELSE 0 END AS f_acumulado,
  CASE WHEN UPPER(c.nome_cta) LIKE '%EXERC%' THEN 1 ELSE 0 END AS f_exercicio,
  CASE WHEN UPPER(c.nome_cta) LIKE '%BONIF%' THEN 1 ELSE 0 END AS f_bonif
  FROM bethadba.ctcontas c
 WHERE c.codi_emp = (SELECT FIRST l.CODI_EMP_PLANO FROM bethadba.ctlancto l WHERE l.codi_emp = {EMPRESA})
   AND c.tipo_cta = 'A' AND LEFT(TRIM(c.clas_cta), 5) IN ('32204', '21602', '41204', '24301', '41501', '31103', '41201', '32205')
 ORDER BY c.codi_cta
