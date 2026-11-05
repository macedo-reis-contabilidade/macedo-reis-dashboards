-- contabil_saldos.sql (RASCUNHO: a ponte não lê esta pasta): por empresa, os saldos estranhos do balancete no último
-- dia do mês. Os dois parâmetros são o primeiro e o último dia do mês, como nas outras consultas da ponte — só o
-- último é usado. Tabelas: bethadba.ctlancto ("Lancamentos Contabeis": cdeb_lan, ccre_lan, vlor_lan, data_lan, com o
-- plano da CODI_EMP_PLANO), bethadba.ctcontas ("Contas Contabeis - Cadastro": clas_cta, tipo_cta e, só nos filtros,
-- nome_cta — a descrição nunca sai daqui) e bethadba.ctnatureza_conta ("NATUZA DAS CONTAS": a natureza C/D pelo começo
-- da classificação, por empresa — 1 devedora, 2 credora, 3 devedora, 4 credora, na maioria; vale a de começo mais
-- comprido).
-- O saldo não fica guardado no Domínio (a CTLANCTO_SALDO está vazia): sai da soma de todos os lançamentos até o dia,
-- com o zeramento (é ele que zera as contas de resultado no fim do exercício). Saldo = débitos − créditos.
-- As transitórias: a apuração do resultado (as analíticas do 5.1.4.01, que o zeramento zera) e a conta com
--   "transitória", "a classificar", "a identificar" ou "não identificado" na descrição. Elas ficam só na coluna delas.
-- As retificadoras: a conta cuja descrição, ou a de um grupo acima dela, começa com "(" e tem "-" nos 5 primeiros
--   caracteres ("(-)", "( - )"). O Domínio não as marca; no plano modelo do escritório, todos os grupos retificadores
--   começam assim. Pra elas a natureza é a contrária da do grupo (a depreciação acumulada é credora no ativo).
-- caixa_negativo: as contas de caixa (as analíticas do 1.1.1.01, fora as transitórias) com saldo credor.
-- contra_natureza: as analíticas com saldo do lado contrário da natureza (na retificadora, do lado do grupo), fora as
--   transitórias e a de natureza desconhecida.
-- sem_natureza: as analíticas com saldo que nenhuma linha da ctnatureza_conta alcança (a empresa sem a tabela, ou um
--   grupo fora dela) — o contra_natureza não as mede.
-- transitorias e transitorias_valor: as transitórias com saldo e a soma do saldo delas em valor absoluto (só na saída
--   desta consulta, nunca no repositório).
-- Entra a empresa com alguma conta analítica com saldo no dia.
WITH p AS (SELECT CAST(? AS DATE) AS ini, CAST(? AS DATE) AS fim),
mv AS (
    SELECT l.codi_emp, l.CODI_EMP_PLANO AS plano, l.cdeb_lan AS cta, l.vlor_lan AS v
      FROM bethadba.ctlancto l, p WHERE l.data_lan <= p.fim
    UNION ALL
    SELECT l.codi_emp, l.CODI_EMP_PLANO, l.ccre_lan, -l.vlor_lan
      FROM bethadba.ctlancto l, p WHERE l.data_lan <= p.fim
),
sd AS (
    SELECT codi_emp, plano, cta, SUM(v) AS saldo FROM mv GROUP BY codi_emp, plano, cta HAVING SUM(v) <> 0
),
ct AS (
    SELECT sd.codi_emp, sd.saldo, TRIM(c.clas_cta) AS clas,
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
                THEN 1 ELSE 0 END AS transitoria
      FROM sd JOIN bethadba.ctcontas c ON c.codi_emp = sd.plano AND c.codi_cta = sd.cta
     WHERE c.tipo_cta = 'A'
),
cl AS (
    SELECT ct.*,
           CASE WHEN ct.natureza IS NULL THEN NULL
                WHEN ct.retificadora = 0 THEN ct.natureza
                WHEN ct.natureza = 'D' THEN 'C' ELSE 'D' END AS lado
      FROM ct
)
SELECT cl.codi_emp AS codigo,
       SUM(CASE WHEN LEFT(cl.clas, 5) = '11101' AND cl.transitoria = 0 AND cl.saldo < 0 THEN 1 ELSE 0 END) AS caixa_negativo,
       SUM(CASE WHEN cl.transitoria = 0 AND ((cl.lado = 'D' AND cl.saldo < 0) OR (cl.lado = 'C' AND cl.saldo > 0))
                THEN 1 ELSE 0 END) AS contra_natureza,
       SUM(CASE WHEN cl.transitoria = 0 AND cl.natureza IS NULL THEN 1 ELSE 0 END) AS sem_natureza,
       SUM(cl.transitoria) AS transitorias,
       CAST(SUM(CASE WHEN cl.transitoria = 1 THEN ABS(cl.saldo) ELSE 0 END) AS NUMERIC(15,2)) AS transitorias_valor
  FROM cl
 GROUP BY cl.codi_emp
 ORDER BY cl.codi_emp
