-- notas_entrada_xml.sql (RASCUNHO: a ponte não lê esta pasta): a chave e o XML guardado de cada NF-e de compra de uma
-- empresa num período, com o mesmo filtro do notas_entrada.sql (modelo 55, emitida por terceiro, fora a cancelada,
-- denegada e inutilizada, pela data de entrada). Os três ? são o código da empresa, o primeiro e o último dia.
-- Tabelas: bethadba.efentradas e bethadba.efespecies (as notas), bethadba.EFATENDIMENTO_NFE_CATALOGO ("Catálogo de
-- Notas - Domínio Atendimento": a chave, a empresa, TIPO 1 = entrada, XML_EXCLUIDO) e
-- bethadba.EFATENDIMENTO_NFE_XML_V2 ("XML DAS NFES - COMPRIMIDO": CONTEUDO_XML, long binary, ligado por I_CATALOGO).
-- O XML vem COMPACTADO, como a Domínio guarda (o formato não foi conferido: a fila só deixou COUNT e LENGTH no
-- conteúdo). A Domínio apaga o XML depois de uns dois meses (XML_EXCLUIDO = 1, sem linha na XML_V2): a nota mais
-- antiga não vem.
SELECT n.chave,
       x.CONTEUDO_XML AS xml_compactado
  FROM (SELECT DISTINCT e.codi_emp, TRIM(e.chave_nfe_ent) AS chave
          FROM bethadba.efentradas e
          JOIN bethadba.efespecies s ON s.codi_esp = e.codi_esp
         WHERE e.codi_emp = ?
           AND e.dent_ent BETWEEN ? AND ?
           AND COALESCE(e.situacao_ent, 0) NOT IN (2, 3, 4, 5)
           AND s.codigo_modelo = '55'
           AND e.emitente_ent = 'T') n
  JOIN bethadba.EFATENDIMENTO_NFE_CATALOGO c
    ON c.CODI_EMP = n.codi_emp AND TRIM(c.CHAVE) = n.chave AND c.TIPO = 1 AND c.XML_EXCLUIDO = 0
  JOIN bethadba.EFATENDIMENTO_NFE_XML_V2 x ON x.I_CATALOGO = c.I_CATALOGO
 ORDER BY n.chave
