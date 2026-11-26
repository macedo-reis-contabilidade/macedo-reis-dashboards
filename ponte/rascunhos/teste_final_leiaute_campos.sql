-- teste_final_leiaute_campos.sql (rascunho da fila de 24/11/2026, a versão final do teste do fechamento; a ponte NÃO
-- lê): os campos de dois leiautes padrão do importador do Domínio que gravam lançamentos contábeis — o 30 (agrupado,
-- com separador) e, do 37 (hierárquico), só os registros que gravam na ctlancto — e, de cada campo, a coluna da
-- ctlancto que ele preenche. É configuração do importador, sem dado de empresa nenhuma. Os rótulos (NOME_CAMPO,
-- NOME_REGISTRO e NOME_COLUNA) saem com outro apelido: são o nome do campo do leiaute e da coluna da tabela, não de
-- pessoa (a trava do `dominio sql` recusa toda coluna que começa com "nome"). O comentário do campo não é lido.
-- Tabelas: bethadba.GEIMPORTADOR_LEIAUTES_REGISTROS (o registro: a ordem e o nível), ..._REGISTROS_CAMPOS (o campo: a
-- ordem, o tipo — C caractere, R decimal, N numérico, D data, H hora, G número grande —, o formato, as posições, as
-- casas decimais, se identifica o registro e o valor que o identifica, se é requerido), bethadba.GEIMPORTADOR_DEFINICAO_DADOS,
-- ..._DEFINICAO_DADOS_TABELAS (a tabela gravada) e ..._DEFINICAO_DADOS_TABELAS_COLUNAS (a coluna e de onde vem o valor:
-- I importado do campo, F fixo, V variável automática, entre outros).
WITH defs AS (
    SELECT DISTINCT d.CODI_DEFINICAO, d.CODI_LEIAUTE, d.CODI_REGISTRO, t.CODI_TABELA
      FROM bethadba.GEIMPORTADOR_DEFINICAO_DADOS d
      JOIN bethadba.GEIMPORTADOR_DEFINICAO_DADOS_TABELAS t ON t.CODI_DEFINICAO = d.CODI_DEFINICAO
     WHERE d.CODI_LEIAUTE IN (30, 37) AND UPPER(TRIM(t.TABELA)) LIKE '%CTLANCTO%'
),
mapa AS (
    SELECT c.CODI_LEIAUTE, c.CODI_REGISTRO, c.CODI_CAMPO, LIST(DISTINCT LOWER(TRIM(c.NOME_COLUNA)), ',') AS colunas
      FROM bethadba.GEIMPORTADOR_DEFINICAO_DADOS_TABELAS_COLUNAS c
      JOIN defs ON defs.CODI_DEFINICAO = c.CODI_DEFINICAO AND defs.CODI_TABELA = c.CODI_TABELA
     WHERE c.ORIGEM_COLUNA = 'I'
     GROUP BY c.CODI_LEIAUTE, c.CODI_REGISTRO, c.CODI_CAMPO
)
SELECT k.CODI_LEIAUTE AS leiaute, k.CODI_REGISTRO AS registro, TRIM(r.NOME_REGISTRO) AS registro_rotulo,
       r.NIVEL_REGISTRO AS nivel, r.ORDEM_REGISTRO AS ordem_registro, k.ORDEM AS ordem, TRIM(k.NOME_CAMPO) AS campo_rotulo,
       k.TIPO_CAMPO AS tipo, COALESCE(TRIM(k.FORMATO_CAMPO), '') AS formato, k.POS_INICIAL AS pos_ini,
       k.POS_FINAL AS pos_fim, k.DEC_INFO AS decimais, k.IDENT_CAMPO AS identifica, COALESCE(TRIM(k.VALOR_CAMPO), '') AS valor_identificador,
       COALESCE(k.REQUERIDO, '') AS requerido, COALESCE(m.colunas, '') AS grava_em
  FROM bethadba.GEIMPORTADOR_LEIAUTES_REGISTROS_CAMPOS k
  JOIN bethadba.GEIMPORTADOR_LEIAUTES_REGISTROS r ON r.CODI_LEIAUTE = k.CODI_LEIAUTE AND r.CODI_REGISTRO = k.CODI_REGISTRO
  LEFT JOIN mapa m ON m.CODI_LEIAUTE = k.CODI_LEIAUTE AND m.CODI_REGISTRO = k.CODI_REGISTRO AND m.CODI_CAMPO = k.CODI_CAMPO
 WHERE k.CODI_LEIAUTE = 30
    OR (k.CODI_LEIAUTE = 37 AND k.CODI_REGISTRO IN (SELECT defs.CODI_REGISTRO FROM defs WHERE defs.CODI_LEIAUTE = 37))
 ORDER BY k.CODI_LEIAUTE, r.ORDEM_REGISTRO, k.ORDEM
