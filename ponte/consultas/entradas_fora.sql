-- entradas_fora.sql: a data de entrada (a do livro, dent_ent) de cada NF-e de compra de fora do RS de UMA empresa numa
-- janela — pra Conferência SEDIF/DeSTDA do sistema pôr a nota no mês em que ela entrou na empresa, como a Domínio apura
-- (26/11/2026, o caso da Thalia: a nota emitida em 30/09 que entrou em 01/10). A ponte das datas de entrada
-- (ponte/entradas.py) roda esta consulta só pras empresas da obrigação SEDIF/DeSTDA, que o sistema manda.
-- Os três parâmetros são o código da empresa no Domínio, o primeiro e o último dia, pela data de entrada.
-- Uma linha por nota (a nota em vários segmentos é uma só: a menor data de entrada deles). Só a chave e a data: nada da
-- nota nem do fornecedor sai daqui, e a ponte confere a chave de novo (o dígito verificador, o modelo, a UF, o CPF).
-- As mesmas regras do notas_itens.sql: modelo 55 (efespecies), emitida por terceiro (emitente_ent T), com a chave de 44,
-- fora a cancelada, a denegada e a inutilizada (situacao 2 a 5); e mais: de fora do RS (a UF do emitente são os dois
-- primeiros dígitos da chave; o RS é 43) e sem o fornecedor pessoa física (tins_for 2, o CPF).
WITH p AS (SELECT CAST(? AS INTEGER) AS emp, CAST(? AS DATE) AS ini, CAST(? AS DATE) AS fim)
SELECT TRIM(e.chave_nfe_ent) AS chave,
       MIN(e.dent_ent) AS entrada
  FROM bethadba.efentradas e
  JOIN p ON e.codi_emp = p.emp
  JOIN bethadba.efespecies s ON s.codi_esp = e.codi_esp
  JOIN bethadba.effornece f ON f.codi_emp = e.codi_emp AND f.codi_for = e.codi_for
 WHERE e.dent_ent BETWEEN p.ini AND p.fim
   AND COALESCE(e.situacao_ent, 0) NOT IN (2, 3, 4, 5)
   AND s.codigo_modelo = '55'
   AND e.emitente_ent = 'T'
   AND LENGTH(TRIM(e.chave_nfe_ent)) = 44
   AND LEFT(TRIM(e.chave_nfe_ent), 2) <> '43'
   AND COALESCE(f.tins_for, 0) <> 2
 GROUP BY TRIM(e.chave_nfe_ent)
 ORDER BY 2, 1
