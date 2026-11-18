-- teste_contas.sql (rascunho da fila de 17/11/2026, o teste do fechamento; a ponte NÃO lê): as contas do plano da
-- empresa do teste que têm algum lançamento dela, em qualquer data. {EMPRESA} é trocado na hora de rodar pelo código
-- do C:\ponte-dominio\fechamento\teste\empresa.txt. A saída fica só no PC.
-- Tabelas: bethadba.ctlancto (o plano é a CODI_EMP_PLANO do lançamento), bethadba.ctcontas ("Contas Contabeis -
-- Cadastro": codi_cta, o reduzido; clas_cta, a classificação; tipo_cta, A analítica e S sintética; a nome_cta só nos
-- filtros, nunca na saída) e bethadba.ctnatureza_conta (a natureza pelo começo mais comprido da classificação, como no
-- saldos.sql).
-- grupo: os 5 primeiros dígitos da classificação; natureza: D ou C; retificadora e transitoria: as regras do saldos.sql
-- (a descrição só no filtro).
WITH pl AS (SELECT DISTINCT l.CODI_EMP_PLANO AS plano FROM bethadba.ctlancto l WHERE l.codi_emp = {EMPRESA}),
us AS (
    SELECT DISTINCT l.CODI_EMP_PLANO AS plano, l.cdeb_lan AS cta FROM bethadba.ctlancto l WHERE l.codi_emp = {EMPRESA} AND l.cdeb_lan <> 0
    UNION
    SELECT DISTINCT l.CODI_EMP_PLANO, l.ccre_lan FROM bethadba.ctlancto l WHERE l.codi_emp = {EMPRESA} AND l.ccre_lan <> 0
)
SELECT c.codi_emp AS plano, c.codi_cta AS reduzido, TRIM(c.clas_cta) AS classificacao, LEFT(TRIM(c.clas_cta), 5) AS grupo,
       c.tipo_cta AS tipo,
       (SELECT FIRST n.natureza FROM bethadba.ctnatureza_conta n
         WHERE n.codi_emp = c.codi_emp AND TRIM(c.clas_cta) LIKE TRIM(n.clas_cta) || '%'
         ORDER BY LENGTH(TRIM(n.clas_cta)) DESC) AS natureza,
       CASE WHEN LEFT(LTRIM(c.nome_cta), 5) LIKE '(%-%'
              OR EXISTS (SELECT 1 FROM bethadba.ctcontas s
                          WHERE s.codi_emp = c.codi_emp AND s.tipo_cta = 'S'
                            AND TRIM(c.clas_cta) LIKE TRIM(s.clas_cta) || '%'
                            AND LEFT(LTRIM(s.nome_cta), 5) LIKE '(%-%')
            THEN 1 ELSE 0 END AS retificadora,
       CASE WHEN LEFT(TRIM(c.clas_cta), 5) = '51401'
              OR UPPER(c.nome_cta) LIKE '%TRANSIT_RI%' OR UPPER(c.nome_cta) LIKE '%_ CLASSIFICAR%'
              OR UPPER(c.nome_cta) LIKE '%_ IDENTIFICAR%' OR UPPER(c.nome_cta) LIKE '%N_O IDENTIFICAD%'
            THEN 1 ELSE 0 END AS transitoria,
       CASE WHEN UPPER(c.nome_cta) LIKE '%HONOR_RIO%' THEN 1 ELSE 0 END AS tem_honorario,
       CASE WHEN UPPER(c.nome_cta) LIKE '%PR_-LABORE%' OR UPPER(c.nome_cta) LIKE '%PRO LABORE%'
              OR UPPER(c.nome_cta) LIKE '%PR_ LABORE%' THEN 1 ELSE 0 END AS tem_prolabore,
       CASE WHEN UPPER(c.nome_cta) LIKE '%SIMPLES%' OR UPPER(c.nome_cta) LIKE '%DAS%' THEN 1 ELSE 0 END AS tem_simples,
       CASE WHEN UPPER(c.nome_cta) LIKE '%INSS%' OR UPPER(c.nome_cta) LIKE '%PREVID%' THEN 1 ELSE 0 END AS tem_inss,
       CASE WHEN UPPER(c.nome_cta) LIKE '%LUCRO%' THEN 1 ELSE 0 END AS tem_lucro
  FROM us JOIN bethadba.ctcontas c ON c.codi_emp = us.plano AND c.codi_cta = us.cta
 ORDER BY c.codi_emp, TRIM(c.clas_cta)
