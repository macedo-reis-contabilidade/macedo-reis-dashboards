-- folha.sql: por empresa, a folha do mês. Tabelas: bethadba.foempregados ("Empregados - Cadastro", empregados e
-- contribuintes), bethadba.forescisoes ("Rescisao - Calculo"), bethadba.FOAFASTAMENTOS (os afastamentos, com
-- o tipo em FOAFASTAMENTOS_TIPOS) e bethadba.fobasesserv ("Bases - Calculo", os cálculos da folha).
-- Empregado = categoria eSocial de 101 a 111 (CATEGORIA_ESOCIAL_EMPREGADO): fora o contribuinte (7xx) e o estagiário.
-- funcionarios_ativos: admitido até o último dia (no cadastro que veio por sucessão ou transferência, a partir da
--   data_transf) e sem rescisão normal (tipo 1) com demissão até ele.
-- admissoes: admissão no mês, fora sucessão, transferência, reintegração e mudança de CPF (emprego_ant 2 a 6).
-- desligamentos: rescisão normal com demissão no mês, fora a transferência (código N1 ou N2, motivo eSocial 11 a 13).
-- afastados: dos ativos, quem está afastado no último dia (começou até ele, data fim nula ou a partir dele), fora
--   os tipos que não são afastamento: 1 Trabalhando, 8 Demitido, 9 Férias, 23 Transferido, 52 Período anterior à
--   admissão e 53 Licença remunerada férias.
-- pro_labore: os sócios e diretores (categoria 721, 722 ou 723) com a folha mensal (tipo_process 11) calculada no mês.
-- Entra a empresa ativa no Domínio (stat_emp A, M, C ou B) e a que teve a folha mensal calculada no mês: a que saiu
-- do escritório fica com os empregados sem rescisão no Domínio e, sem esse corte, contaria como se eles seguissem lá.
WITH p AS (SELECT CAST(? AS DATE) AS ini, CAST(? AS DATE) AS fim),
calc AS (
    SELECT b.codi_emp, b.i_empregados
      FROM bethadba.fobasesserv b, p
     WHERE b.competencia BETWEEN p.ini AND p.fim
       AND b.tipo_process = 11
       AND b.simulacao = 0
     GROUP BY b.codi_emp, b.i_empregados
),
empresas AS (
    SELECT g.codi_emp FROM bethadba.geempre g WHERE UPPER(TRIM(g.stat_emp)) IN ('A', 'M', 'C', 'B')
    UNION
    SELECT c.codi_emp FROM calc c
),
emp AS (
    SELECT e.codi_emp,
           p.fim,
           CASE WHEN COALESCE(e.CATEGORIA_ESOCIAL_EMPREGADO, e.CATEGORIA_ESOCIAL) BETWEEN 101 AND 111
                THEN 1 ELSE 0 END AS empregado,
           CASE WHEN COALESCE(e.CATEGORIA_ESOCIAL, e.CATEGORIA_ESOCIAL_EMPREGADO) IN (721, 722, 723)
                THEN 1 ELSE 0 END AS socio,
           CASE WHEN e.emprego_ant IN (2, 3, 4) AND e.data_transf > e.admissao
                THEN e.data_transf ELSE e.admissao END AS inicio,
           CASE WHEN e.admissao BETWEEN p.ini AND p.fim AND COALESCE(e.emprego_ant, 1) NOT IN (2, 3, 4, 5, 6)
                THEN 1 ELSE 0 END AS admitido,
           CASE WHEN EXISTS (SELECT 1 FROM bethadba.forescisoes r
                              WHERE r.codi_emp = e.codi_emp AND r.i_empregados = e.i_empregados
                                AND r.tipo = 1 AND r.demissao <= p.fim)
                THEN 1 ELSE 0 END AS saiu,
           CASE WHEN EXISTS (SELECT 1 FROM bethadba.forescisoes r
                              WHERE r.codi_emp = e.codi_emp AND r.i_empregados = e.i_empregados
                                AND r.tipo = 1 AND r.demissao BETWEEN p.ini AND p.fim
                                AND COALESCE(TRIM(r.CODIGO_AFASTAMENTO), '') NOT IN ('N1', 'N2')
                                AND COALESCE(r.MOTIVO_ESOCIAL, 0) NOT IN (11, 12, 13))
                THEN 1 ELSE 0 END AS desligado,
           CASE WHEN EXISTS (SELECT 1 FROM bethadba.FOAFASTAMENTOS a
                              WHERE a.CODI_EMP = e.codi_emp AND a.I_EMPREGADOS = e.i_empregados
                                AND a.DATA_REAL <= p.fim
                                AND (a.DATA_FIM IS NULL OR a.DATA_FIM >= p.fim)
                                AND a.I_AFASTAMENTOS NOT IN (1, 8, 9, 23, 52, 53))
                THEN 1 ELSE 0 END AS afastado,
           CASE WHEN EXISTS (SELECT 1 FROM calc c WHERE c.codi_emp = e.codi_emp AND c.i_empregados = e.i_empregados)
                THEN 1 ELSE 0 END AS calculado
      FROM bethadba.foempregados e, p
     WHERE e.codi_emp IN (SELECT x.codi_emp FROM empresas x)
)
SELECT codi_emp AS codigo,
       SUM(CASE WHEN empregado = 1 AND inicio <= fim AND saiu = 0 THEN 1 ELSE 0 END) AS funcionarios_ativos,
       SUM(CASE WHEN empregado = 1 THEN admitido ELSE 0 END) AS admissoes,
       SUM(CASE WHEN empregado = 1 THEN desligado ELSE 0 END) AS desligamentos,
       SUM(CASE WHEN empregado = 1 AND inicio <= fim AND saiu = 0 THEN afastado ELSE 0 END) AS afastados,
       SUM(CASE WHEN socio = 1 THEN calculado ELSE 0 END) AS pro_labore
  FROM emp
 GROUP BY codi_emp
 ORDER BY codi_emp
