-- empresas.sql: todas as empresas do Domínio (bethadba.geempre, "Empresa - Cadastro"), uma linha por empresa.
-- documento = cgce_emp sem espaços: char(14) com o tipo em tins_emp (1 CNPJ, 14 dígitos; 2 CPF, 11; 3 CEI, 12;
-- 6 CAEPF), já guardado com os zeros da frente. nome = a razão social (razao_emp; vazia, o nome curto, nome_emp).
-- ativa = stat_emp: A (ativa), M (ativo sem movimento), C (em constituição) e B (em processo de baixa) viram 'A';
-- I (inativa) e E (excluindo) viram 'I'; outro valor fica nulo. Nada fica de fora: matriz e filial são empresas
-- separadas no Domínio, cada uma com o seu código e o seu documento.
SELECT e.codi_emp AS codigo,
       NULLIF(TRIM(e.cgce_emp), '') AS documento,
       COALESCE(NULLIF(TRIM(e.razao_emp), ''), TRIM(e.nome_emp)) AS nome,
       CASE WHEN UPPER(TRIM(e.stat_emp)) IN ('A', 'M', 'C', 'B') THEN 'A'
            WHEN UPPER(TRIM(e.stat_emp)) IN ('I', 'E') THEN 'I'
       END AS ativa
FROM bethadba.geempre e
ORDER BY e.codi_emp
