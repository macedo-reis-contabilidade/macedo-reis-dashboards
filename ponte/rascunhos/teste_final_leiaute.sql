-- teste_final_leiaute.sql (rascunho da fila de 24/11/2026, a versão final do teste do fechamento; a ponte NÃO lê): os
-- leiautes do importador do Domínio que gravam lançamentos contábeis (a definição de dados com a tabela ctlancto), com
-- o jeito do arquivo de cada um. É configuração do importador do escritório, sem dado de empresa nenhuma; a descrição e a
-- observação do leiaute não são lidas.
-- Tabelas: bethadba.GEIMPORTADOR_LEIAUTES (o leiaute: o separador de campos, a estrutura — H hierárquico, A agrupado —,
-- o separador decimal, o delimitador de texto, o tipo — T texto, X XML —, PADRAO, o padrão da Domínio Sistemas),
-- bethadba.GEIMPORTADOR_DEFINICAO_DADOS (a definição de dados, com o leiaute e o registro dele) e
-- bethadba.GEIMPORTADOR_DEFINICAO_DADOS_TABELAS (as tabelas que a definição grava).
SELECT l.CODI_LEIAUTE AS leiaute, COALESCE(TRIM(l.PADRAO), '') AS padrao_dominio, l.TIPO_ARQUIVO AS tipo_arquivo,
       l.ESTRUTURA_ARQUIVO AS estrutura, l.UTILIZA_SEPARADOR_CAMPOS AS usa_separador, l.SEPARADOR_CAMPOS AS separador,
       l.IGNORAR_PRIMEIRO_SEPARADOR_CAMPOS AS ignora_primeiro, l.UTILIZA_SEPARADOR_DECIMAL AS usa_decimal,
       l.SEPARADOR_DECIMAL AS separador_decimal, l.UTILIZA_DELIMITADOR_CARACTERES AS usa_delimitador,
       l.DELIMITADOR_CARACTERES AS delimitador, COUNT(DISTINCT d.CODI_DEFINICAO) AS definicoes,
       COUNT(DISTINCT d.CODI_REGISTRO) AS registros_usados,
       (SELECT COUNT(*) FROM bethadba.GEIMPORTADOR_LEIAUTES_REGISTROS r WHERE r.CODI_LEIAUTE = l.CODI_LEIAUTE) AS registros,
       (SELECT COUNT(*) FROM bethadba.GEIMPORTADOR_LEIAUTES_REGISTROS_CAMPOS k WHERE k.CODI_LEIAUTE = l.CODI_LEIAUTE) AS campos,
       (SELECT COUNT(*) FROM bethadba.GEIMPORTADOR_CONJUNTO_DADOS j WHERE j.CODI_LEIAUTE = l.CODI_LEIAUTE) AS conjuntos
  FROM bethadba.GEIMPORTADOR_DEFINICAO_DADOS d
  JOIN bethadba.GEIMPORTADOR_DEFINICAO_DADOS_TABELAS t ON t.CODI_DEFINICAO = d.CODI_DEFINICAO
  JOIN bethadba.GEIMPORTADOR_LEIAUTES l ON l.CODI_LEIAUTE = d.CODI_LEIAUTE
 WHERE UPPER(TRIM(t.TABELA)) LIKE '%CTLANCTO%'
 GROUP BY l.CODI_LEIAUTE, l.PADRAO, l.TIPO_ARQUIVO, l.ESTRUTURA_ARQUIVO, l.UTILIZA_SEPARADOR_CAMPOS, l.SEPARADOR_CAMPOS,
          l.IGNORAR_PRIMEIRO_SEPARADOR_CAMPOS, l.UTILIZA_SEPARADOR_DECIMAL, l.SEPARADOR_DECIMAL,
          l.UTILIZA_DELIMITADOR_CARACTERES, l.DELIMITADOR_CARACTERES
 ORDER BY l.CODI_LEIAUTE
