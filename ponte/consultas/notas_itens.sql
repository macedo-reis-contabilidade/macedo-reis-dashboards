-- notas_itens.sql: as NF-e de compra de UMA empresa num período, uma linha por item (a ponte das notas, ponte/notas/).
-- Os três parâmetros são o código da empresa no Domínio, o primeiro e o último dia, pela data de entrada (dent_ent, a do livro).
-- Tabelas: bethadba.efentradas ("Notas Fiscais de Entrada", uma linha por segmento da nota — cada segmento com o seu
-- codi_ent e a sua natureza, codi_nat, que é o CFOP da entrada), bethadba.efespecies (o modelo), bethadba.efmvepro
-- ("Notas Fiscais de Entrada - Produtos", os itens, ligados ao segmento por codi_emp + codi_ent), bethadba.efprodutos
-- (o cadastro de produtos da empresa: a descrição, o NCM e o código de barras), bethadba.effornece (o emitente) e o de-para
-- da importação, EFPRODUTOS_IMPORTACAO_ENTRADAS + _PRODUTOS (o código do produto do fornecedor, quando é um só).
-- Entra: modelo 55, emitida por terceiro (emitente_ent T), com a chave de 44. Fica de fora: a cancelada, denegada e
-- inutilizada (situacao 2 a 5) e a de entrada emitida pela própria empresa (emitente_ent P). A nota sem itens na Domínio
-- vem numa linha só, com as colunas do item em branco (o LEFT JOIN): a ponte usa o XML dela, se houver.
-- Os totais e os CFOPs da nota somam os segmentos dela (nota_cfops: quantos CFOPs; nota_cfop: o menor). O emitente
-- pessoa física sai na ponte (emitente_doc com 11 dígitos, emitente_tipo 2). A descrição e o EAN são os do cadastro de
-- produtos, não os da nota (a fila do XML, 03/11/2026: 9% das descrições já não são as do XML).
WITH p AS (SELECT CAST(? AS INTEGER) AS emp, CAST(? AS DATE) AS ini, CAST(? AS DATE) AS fim),
t AS (
    SELECT x.codi_emp, x.chave_nfe_ent,
           SUM(COALESCE(x.vprod_ent, 0)) AS produtos,
           SUM(COALESCE(x.VALOR_DESCONTO_ENT, 0)) AS desconto,
           SUM(COALESCE(x.vfre_ent, 0)) AS frete,
           SUM(COALESCE(x.IPI_ENT, 0)) AS ipi,
           SUM(COALESCE(x.ICMS_ST_ENT, 0)) AS icms_st,
           SUM(COALESCE(x.vcon_ent, 0)) AS total,
           COUNT(DISTINCT x.codi_nat) AS cfops,
           MIN(x.codi_nat) AS cfop
      FROM bethadba.efentradas x, p
     WHERE x.codi_emp = p.emp
       AND COALESCE(x.situacao_ent, 0) NOT IN (2, 3, 4, 5)
       AND x.emitente_ent = 'T'
       AND LENGTH(TRIM(x.chave_nfe_ent)) = 44
     GROUP BY x.codi_emp, x.chave_nfe_ent
)
SELECT TRIM(e.chave_nfe_ent) AS chave,
       e.codi_ent AS segmento,
       e.ddoc_ent AS emissao,
       e.dent_ent AS entrada,
       NULLIF(TRIM(f.cgce_for), '') AS emitente_doc,
       f.tins_for AS emitente_tipo,
       TRIM(f.nome_for) AS emitente_nome,
       f.sigl_est AS emitente_uf,
       t.produtos AS nota_produtos,
       t.desconto AS nota_desconto,
       t.frete AS nota_frete,
       t.ipi AS nota_ipi,
       t.icms_st AS nota_icms_st,
       t.total AS nota_total,
       t.cfops AS nota_cfops,
       t.cfop AS nota_cfop,
       m.SEQUENCIAL_ITEM_MEP AS item,
       m.nume_mep AS item_seq,
       (SELECT CASE WHEN COUNT(DISTINCT b.CODI_PDI_IMPORTACAO) = 1 THEN MIN(TRIM(b.CODI_PDI_IMPORTACAO)) END
          FROM bethadba.EFPRODUTOS_IMPORTACAO_ENTRADAS a
          JOIN bethadba.EFPRODUTOS_IMPORTACAO_ENTRADAS_PRODUTOS b
            ON b.CODI_EMP = a.CODI_EMP AND b.CODI_PDI = a.CODI_PDI AND b.SEQUENCIAL = a.SEQUENCIAL
         WHERE a.CODI_EMP = m.codi_emp AND a.CODI_PDI = m.codi_pdi AND a.CODI_FOR = e.codi_for) AS produto_fornecedor,
       TRIM(pr.desc_pdi) AS descricao,
       CASE WHEN COALESCE(TRIM(pr.codigo_barras_pdi), '') NOT IN ('', 'SEM GTIN') THEN TRIM(pr.codigo_barras_pdi)
            WHEN COALESCE(TRIM(pr.ean_pdi), '') NOT IN ('', 'SEM GTIN') THEN TRIM(pr.ean_pdi)
       END AS ean,
       NULLIF(TRIM(pr.cncm_pdi), '') AS ncm,
       m.cfop_mep AS cfop,
       NULLIF(TRIM(m.UNIDADE), '') AS unidade,
       m.qtde_mep AS quantidade,
       m.valor_unit_mep AS valor_unitario,
       m.vpro_mep AS valor_total,
       m.vdes_mep AS desconto,
       m.vipi_mep AS ipi,
       m.valor_subtri_mep AS icms_st
  FROM bethadba.efentradas e
  JOIN p ON e.codi_emp = p.emp
  JOIN bethadba.efespecies s ON s.codi_esp = e.codi_esp
  JOIN bethadba.effornece f ON f.codi_emp = e.codi_emp AND f.codi_for = e.codi_for
  JOIN t ON t.codi_emp = e.codi_emp AND t.chave_nfe_ent = e.chave_nfe_ent
  LEFT JOIN bethadba.efmvepro m ON m.codi_emp = e.codi_emp AND m.codi_ent = e.codi_ent
  LEFT JOIN bethadba.efprodutos pr ON pr.codi_emp = m.codi_emp AND pr.codi_pdi = m.codi_pdi
 WHERE e.dent_ent BETWEEN p.ini AND p.fim
   AND COALESCE(e.situacao_ent, 0) NOT IN (2, 3, 4, 5)
   AND s.codigo_modelo = '55'
   AND e.emitente_ent = 'T'
   AND LENGTH(TRIM(e.chave_nfe_ent)) = 44
 ORDER BY e.dent_ent, e.chave_nfe_ent, e.codi_ent, m.nume_mep
