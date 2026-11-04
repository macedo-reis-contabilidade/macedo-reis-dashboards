-- notas_xml.sql: o XML guardado de cada NF-e de compra de UMA empresa num período (a ponte das notas, ponte/notas/), com
-- o mesmo filtro do notas_itens.sql (modelo 55, emitida por terceiro, fora a cancelada, denegada e inutilizada, pela
-- data de entrada). Os três parâmetros são o código da empresa no Domínio, o primeiro e o último dia.
-- Tabelas: bethadba.efentradas e bethadba.efespecies (as notas), bethadba.EFATENDIMENTO_NFE_CATALOGO ("Catálogo de
-- Notas - Domínio Atendimento": a chave, a empresa, TIPO 1 = entrada, XML_EXCLUIDO) e
-- bethadba.EFATENDIMENTO_NFE_XML_V2 (CONTEUDO_XML, ligado por I_CATALOGO). O catálogo é filtrado pela empresa antes de
-- ligar pela chave (a fila do XML mediu 14 s em 46 notas ligando o catálogo inteiro).
-- O XML é o texto do nfeProc, em UTF-8, SEM compactar, apesar do "COMPRIMIDO" da tabela (a fila do XML, 03/11/2026: as
-- 46 da empresa do teste abriram como texto; a ponte tenta zlib e gzip no que não começar por "<"). Ele só é lido em
-- código, pra tirar os itens — o XML nunca sai do PC. A Domínio apaga o XML uns dois meses depois (XML_EXCLUIDO = 1):
-- a nota mais antiga não vem aqui.
WITH p AS (SELECT CAST(? AS INTEGER) AS emp, CAST(? AS DATE) AS ini, CAST(? AS DATE) AS fim),
n AS (
    SELECT DISTINCT TRIM(e.chave_nfe_ent) AS chave
      FROM bethadba.efentradas e
      JOIN p ON e.codi_emp = p.emp
      JOIN bethadba.efespecies s ON s.codi_esp = e.codi_esp
     WHERE e.dent_ent BETWEEN p.ini AND p.fim
       AND COALESCE(e.situacao_ent, 0) NOT IN (2, 3, 4, 5)
       AND s.codigo_modelo = '55'
       AND e.emitente_ent = 'T'
       AND LENGTH(TRIM(e.chave_nfe_ent)) = 44
),
c AS (
    SELECT TRIM(c.CHAVE) AS chave, c.I_CATALOGO
      FROM bethadba.EFATENDIMENTO_NFE_CATALOGO c
      JOIN p ON c.CODI_EMP = p.emp
     WHERE c.TIPO = 1
       AND c.XML_EXCLUIDO = 0
)
SELECT n.chave AS chave,
       x.CONTEUDO_XML AS conteudo
  FROM n
  JOIN c ON c.chave = n.chave
  JOIN bethadba.EFATENDIMENTO_NFE_XML_V2 x ON x.I_CATALOGO = c.I_CATALOGO
 ORDER BY n.chave
