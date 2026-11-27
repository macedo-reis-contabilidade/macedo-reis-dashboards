-- esocial_dependentes.sql (rascunho da fila de 27/11/2026, os dependentes sem CPF ou com CPF que não fecha; a ponte
-- NÃO lê): os empregados ativos e os dependentes deles, pra o esocial_dependentes.py contar. Uma linha por empresa sem
-- empregado ativo, por empregado ativo sem dependente e por dependente. A saída é lida só pelo script, que guarda o
-- nome e o CPF só no PC e mostra só os totais: esta consulta nunca roda pelo `dominio sql`.
-- Os quatro parâmetros: o primeiro e o último dia de 10/2026, o primeiro dia de 11/2026 e hoje.
-- Os empregados ativos, como a ponte/consultas/folha.sql conta: empregado = categoria eSocial de 101 a 111; admitido até
-- o dia (no cadastro que veio por sucessão ou transferência, a partir da data_transf); sem rescisão normal (tipo 1) com
-- demissão até ele. No último dia de 10/2026, nas empresas ativas no Domínio (stat_emp A, M, C ou B) ou com a folha
-- mensal (tipo_process 11) calculada em 10/2026; e, nas empresas com a folha mensal de 11/2026 já calculada, também os
-- ativos hoje (quem vai na folha de novembro e no 13º).
-- Os dependentes: bethadba.fofilhos ("Empregados - Cadastro - Dependentes"): a tabela não tem data de baixa, e todos
-- estão marcados pra ir pro eSocial (CONSIDERAR_ENVIAR_ESOCIAL = 1, nenhum com PROCESSAR_EXCLUSAO_ESOCIAL): contam
-- todos. O CPF (char(11), só os dígitos). irrf_vale e salfam_vale: se o dependente ainda conta pro IRRF (dependente S, sem
-- a data de fim marcada ou com ela a partir de hoje) ou pro salário-família (filho S, idem).
WITH p AS (SELECT CAST(? AS DATE) AS ini10, CAST(? AS DATE) AS fim10, CAST(? AS DATE) AS ini11, CAST(? AS DATE) AS hoje),
calc10 AS (
    SELECT DISTINCT b.codi_emp FROM bethadba.fobasesserv b, p
     WHERE b.competencia BETWEEN p.ini10 AND p.fim10 AND b.tipo_process = 11 AND b.simulacao = 0
),
calc11 AS (
    SELECT DISTINCT b.codi_emp FROM bethadba.fobasesserv b, p
     WHERE b.competencia BETWEEN p.ini11 AND p.hoje AND b.tipo_process = 11 AND b.simulacao = 0
),
ativas AS (
    SELECT g.codi_emp FROM bethadba.geempre g WHERE UPPER(TRIM(g.stat_emp)) IN ('A', 'M', 'C', 'B')
    UNION
    SELECT c.codi_emp FROM calc10 c
),
empresas AS (
    SELECT a.codi_emp FROM ativas a
    UNION
    SELECT c.codi_emp FROM calc11 c
),
emp AS (
    SELECT e.codi_emp, e.i_empregados, e.nome,
           CASE WHEN e.emprego_ant IN (2, 3, 4) AND e.data_transf > e.admissao
                THEN e.data_transf ELSE e.admissao END AS inicio
      FROM bethadba.foempregados e
     WHERE COALESCE(e.CATEGORIA_ESOCIAL_EMPREGADO, e.CATEGORIA_ESOCIAL) BETWEEN 101 AND 111
       AND e.codi_emp IN (SELECT x.codi_emp FROM empresas x)
),
ativos AS (
    SELECT x.codi_emp, x.i_empregados, x.nome FROM emp x, p
     WHERE x.codi_emp IN (SELECT a.codi_emp FROM ativas a) AND x.inicio <= p.fim10
       AND NOT EXISTS (SELECT 1 FROM bethadba.forescisoes r
                        WHERE r.codi_emp = x.codi_emp AND r.i_empregados = x.i_empregados
                          AND r.tipo = 1 AND r.demissao <= p.fim10)
    UNION
    SELECT x.codi_emp, x.i_empregados, x.nome FROM emp x, p
     WHERE x.codi_emp IN (SELECT c.codi_emp FROM calc11 c) AND x.inicio <= p.hoje
       AND NOT EXISTS (SELECT 1 FROM bethadba.forescisoes r
                        WHERE r.codi_emp = x.codi_emp AND r.i_empregados = x.i_empregados
                          AND r.tipo = 1 AND r.demissao <= p.hoje)
)
SELECT m.codi_emp AS empresa, TRIM(g.nome_emp) AS empresa_nome, a.i_empregados AS empregado,
       TRIM(a.nome) AS empregado_nome, f.i_filhos AS dependente, f.CPF AS cpf,
       CASE WHEN f.dependente = 'S' AND (COALESCE(f.DEPEND_IRRF_FIM_DETERMINADO, 'N') <> 'S'
                                         OR f.DEPEND_IRRF_FIM >= p.hoje) THEN 1 ELSE 0 END AS irrf_vale,
       CASE WHEN f.filho = 'S' AND (COALESCE(f.SAL_FAM_FIM_DETERMINADO, 'N') <> 'S'
                                    OR f.SAL_FAM_FIM >= p.hoje) THEN 1 ELSE 0 END AS salfam_vale
  FROM empresas m
  CROSS JOIN p
  JOIN bethadba.geempre g ON g.codi_emp = m.codi_emp
  LEFT JOIN ativos a ON a.codi_emp = m.codi_emp
  LEFT JOIN bethadba.fofilhos f ON f.codi_emp = a.codi_emp AND f.i_empregados = a.i_empregados
 ORDER BY m.codi_emp, a.i_empregados, f.i_filhos
