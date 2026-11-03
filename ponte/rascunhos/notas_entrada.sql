-- notas_entrada.sql (RASCUNHO: a ponte não lê esta pasta): uma linha por item das NF-e de compra de uma empresa num
-- período, pela data de entrada (dent_ent, a do livro, como o fiscal.sql). Os três ? são o código da empresa no
-- Domínio, o primeiro e o último dia. Tabelas: bethadba.efentradas ("Notas Fiscais de Entrada", uma linha por segmento
-- da nota), bethadba.efespecies ("Especies - Cadastro", o modelo), bethadba.efmvepro ("Notas Fiscais de Entrada -
-- Produtos", os itens, ligados ao segmento por codi_emp + codi_ent), bethadba.efprodutos ("Produtos - Cadastro", o
-- produto do cadastro da empresa: a descrição, o NCM e o código de barras), bethadba.effornece ("Fornecedores -
-- Cadastro", o emitente), bethadba.geempre ("Empresa - Cadastro", o destinatário) e o de-para da importação,
-- bethadba.EFPRODUTOS_IMPORTACAO_ENTRADAS + EFPRODUTOS_IMPORTACAO_ENTRADAS_PRODUTOS (o código do produto do
-- fornecedor, quando há um só pra aquele produto e fornecedor).
-- Entra: modelo 55, emitida por terceiro (emitente_ent T). Fica de fora: a cancelada, denegada e inutilizada (situacao
-- 2 a 5), a nota de entrada emitida pela própria empresa (emitente_ent P) e a nota sem itens (lançada só com valores).
-- A descrição é a do cadastro de produtos da empresa (o item não tem descrição própria: DESCRICAO_COMPLEMENTAR_MEP
-- vazia) e o EAN, o código de barras do cadastro. Os totais da nota somam os segmentos.
-- Sem coluna na Domínio: o vNF do XML (o total da nota sai do valor contábil, vcon_ent) e a descrição do item do jeito
-- que o fornecedor escreveu (xProd), se for diferente da do cadastro.
SELECT TRIM(e.chave_nfe_ent) AS chave,
       s.codigo_modelo AS modelo,
       e.nume_ent AS numero,
       TRIM(e.seri_ent) AS serie,
       e.ddoc_ent AS emissao,
       e.dent_ent AS entrada,
       NULLIF(TRIM(f.cgce_for), '') AS emitente_cnpj,
       TRIM(f.nome_for) AS emitente_nome,
       f.sigl_est AS emitente_uf,
       NULLIF(TRIM(g.cgce_emp), '') AS destinatario_cnpj,
       t.produtos AS nota_produtos,
       t.desconto AS nota_desconto,
       t.frete AS nota_frete,
       t.ipi AS nota_ipi,
       t.icms_st AS nota_icms_st,
       t.total AS nota_total,
       COALESCE(m.SEQUENCIAL_ITEM_MEP, m.nume_mep) AS item,
       TRIM(m.codi_pdi) AS produto_empresa,
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
  JOIN bethadba.efespecies s ON s.codi_esp = e.codi_esp
  JOIN bethadba.efmvepro m ON m.codi_emp = e.codi_emp AND m.codi_ent = e.codi_ent
  JOIN bethadba.effornece f ON f.codi_emp = e.codi_emp AND f.codi_for = e.codi_for
  JOIN bethadba.geempre g ON g.codi_emp = e.codi_emp
  LEFT JOIN bethadba.efprodutos pr ON pr.codi_emp = m.codi_emp AND pr.codi_pdi = m.codi_pdi
  JOIN (SELECT x.codi_emp, x.chave_nfe_ent,
               SUM(COALESCE(x.vprod_ent, 0)) AS produtos,
               SUM(x.VALOR_DESCONTO_ENT) AS desconto,
               SUM(COALESCE(x.vfre_ent, 0)) AS frete,
               SUM(x.IPI_ENT) AS ipi,
               SUM(x.ICMS_ST_ENT) AS icms_st,
               SUM(COALESCE(x.vcon_ent, 0)) AS total
          FROM bethadba.efentradas x
         WHERE COALESCE(x.situacao_ent, 0) NOT IN (2, 3, 4, 5)
           AND x.emitente_ent = 'T'
           AND LENGTH(TRIM(x.chave_nfe_ent)) = 44
         GROUP BY x.codi_emp, x.chave_nfe_ent) t
    ON t.codi_emp = e.codi_emp AND t.chave_nfe_ent = e.chave_nfe_ent
 WHERE e.codi_emp = ?
   AND e.dent_ent BETWEEN ? AND ?
   AND COALESCE(e.situacao_ent, 0) NOT IN (2, 3, 4, 5)
   AND s.codigo_modelo = '55'
   AND e.emitente_ent = 'T'
 ORDER BY e.dent_ent, e.chave_nfe_ent, item
