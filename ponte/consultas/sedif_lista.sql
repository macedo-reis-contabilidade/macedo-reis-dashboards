-- sedif_lista.sql: as NF-e de compra de UMA empresa numa janela, uma linha por nota e sem o XML — a ponte das notas de
-- entrada da SEDIF/DeSTDA (ponte/sedif.py, 26/11/2026) escolhe por aqui as que ainda não mandou e só busca o XML delas
-- (notas_xml.sql, o mesmo filtro). Os três parâmetros são o código da empresa no Domínio, o primeiro e o último dia, pela
-- data de entrada (dent_ent, a do livro).
-- As regras do notas_itens.sql e do entradas_fora.sql: modelo 55 (efespecies), emitida por terceiro (emitente_ent T), com
-- a chave de 44, fora a cancelada, a denegada e a inutilizada (situacao 2 a 5); a nota em vários segmentos é uma só (a
-- menor data de entrada deles). De todos os estados: a do RS também (a conferência sabe por ela quem teve nota de entrada
-- no mês). O fornecedor pessoa física (tins_for 2, o CPF) vem com o tipo, e a ponte deixa a nota de fora.
-- tem_xml: 1 quando o "Catálogo de Notas - Domínio Atendimento" ainda tem o XML da nota (EFATENDIMENTO_NFE_CATALOGO, TIPO
-- 1 = entrada, XML_EXCLUIDO 0, filtrado pela empresa antes de ligar pela chave, como no notas_xml.sql); a Domínio apaga o
-- XML uns dois meses depois. Só a chave, a data, o tipo e o 0/1: nada da nota nem do fornecedor sai daqui.
WITH p AS (SELECT CAST(? AS INTEGER) AS emp, CAST(? AS DATE) AS ini, CAST(? AS DATE) AS fim),
n AS (
    SELECT TRIM(e.chave_nfe_ent) AS chave,
           MIN(e.dent_ent) AS entrada,
           MAX(COALESCE(f.tins_for, 0)) AS emitente_tipo
      FROM bethadba.efentradas e
      JOIN p ON e.codi_emp = p.emp
      JOIN bethadba.efespecies s ON s.codi_esp = e.codi_esp
      JOIN bethadba.effornece f ON f.codi_emp = e.codi_emp AND f.codi_for = e.codi_for
     WHERE e.dent_ent BETWEEN p.ini AND p.fim
       AND COALESCE(e.situacao_ent, 0) NOT IN (2, 3, 4, 5)
       AND s.codigo_modelo = '55'
       AND e.emitente_ent = 'T'
       AND LENGTH(TRIM(e.chave_nfe_ent)) = 44
     GROUP BY TRIM(e.chave_nfe_ent)
),
c AS (
    SELECT DISTINCT TRIM(c.CHAVE) AS chave
      FROM bethadba.EFATENDIMENTO_NFE_CATALOGO c
      JOIN p ON c.CODI_EMP = p.emp
     WHERE c.TIPO = 1
       AND c.XML_EXCLUIDO = 0
)
SELECT n.chave AS chave,
       n.entrada AS entrada,
       n.emitente_tipo AS emitente_tipo,
       CASE WHEN c.chave IS NULL THEN 0 ELSE 1 END AS tem_xml
  FROM n
  LEFT JOIN c ON c.chave = n.chave
 ORDER BY 2, 1
