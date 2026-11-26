-- teste_final_leiaute_empresa.sql (rascunho da fila de 24/11/2026, a versão final do teste do fechamento; a ponte NÃO
-- lê): os conjuntos de dados do leiaute 37 do importador (se o arquivo identifica a empresa, e por qual registro) e os
-- campos desse registro. Configuração do importador, sem dado de empresa nenhuma; os rótulos com outro apelido (a trava
-- recusa coluna que começa com "nome"). Tabelas: bethadba.GEIMPORTADOR_CONJUNTO_DADOS, ..._LEIAUTES_REGISTROS e
-- ..._LEIAUTES_REGISTROS_CAMPOS.
SELECT j.CODI_CONJUNTO AS conjunto, j.IDENTIFICAR_EMPRESA AS identifica_empresa, j.CODI_REGISTRO AS registro_empresa,
       COALESCE(TRIM(j.PADRAO), '') AS padrao_dominio, TRIM(r.NOME_REGISTRO) AS registro_rotulo, k.ORDEM AS ordem,
       TRIM(k.NOME_CAMPO) AS campo_rotulo, k.TIPO_CAMPO AS tipo, COALESCE(TRIM(k.FORMATO_CAMPO), '') AS formato,
       k.IDENT_CAMPO AS identifica, COALESCE(TRIM(k.VALOR_CAMPO), '') AS valor_identificador
  FROM bethadba.GEIMPORTADOR_CONJUNTO_DADOS j
  LEFT JOIN bethadba.GEIMPORTADOR_LEIAUTES_REGISTROS r ON r.CODI_LEIAUTE = j.CODI_LEIAUTE AND r.CODI_REGISTRO = j.CODI_REGISTRO
  LEFT JOIN bethadba.GEIMPORTADOR_LEIAUTES_REGISTROS_CAMPOS k ON k.CODI_LEIAUTE = j.CODI_LEIAUTE AND k.CODI_REGISTRO = j.CODI_REGISTRO
 WHERE j.CODI_LEIAUTE = 37
 ORDER BY j.CODI_CONJUNTO, k.ORDEM
