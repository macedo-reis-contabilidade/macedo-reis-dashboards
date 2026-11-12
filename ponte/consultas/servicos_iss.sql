-- servicos_iss.sql (versão 5 do pacote, 11/11/2026: o Comparativo tributário; escrita e conferida no Domínio pela fila
-- de 11/11, o rascunho comparativo_servicos.sql): por empresa, o ISS das notas de serviço do mês e a parte do serviço
-- no Anexo IV do Simples. Os dois parâmetros são o primeiro e o último dia do mês.
-- Tabelas: bethadba.efservicos ("Notas Fiscais de Servico", uma linha por segmento: vcon_ser "Valor contabil", dser_ser
-- "Data do servico"), bethadba.efimpser ("Notas Fiscais de Servico - Impostos": codi_imp 3 = ISS e 18 = ISS Ret na
-- bethadba.geimposto; bcal_ise "Base de calculo", vlor_ise "Valor do imposto"), bethadba.EFACUMULADOR_VIGENCIA (o corte do
-- faturamento.sql: IFAT_ACU = 'S') e bethadba.EFACUMULADOR_VIGENCIA_IMPOSTOS (SIMPLESN_ANEXO_IAC "Simples Nacional -
-- Anexo", na linha do imposto 44, o Simples, da mesma vigência do acumulador). Fora a nota cancelada, denegada ou
-- inutilizada.
-- O ITEM DA LISTA DA LC 116 NÃO EXISTE NO DOMÍNIO DO ESCRITÓRIO: a nota de serviço não tem a coluna, o "Código do
-- Serviço conforme LC nº 116/03" do acumulador (DF_CODIGO_SERVICO_CONFORME_LC_116_03_CODIGO) está vazio em todos, a marca
-- dos subitens 7.02 e 7.05 do acumulador do Simples (SIMPLESN_SERVICOS_702_705) não está ligada em nenhum, e os itens das
-- notas de serviço (bethadba.EFMVVPRO, com o produto e o código do serviço dele) têm 100 linhas no banco inteiro. Por
-- isso o serviço não sai separado pelo item (construção, saúde, transporte, locação): o total dele é o
-- receita_servicos do faturamento.sql. O cfps_ser ("Codigo fiscal da prestacao de servicos") existe em parte das notas,
-- mas é o código fiscal da prestação (5 códigos no escritório de 10/2025 a 09/2026), não o item.
-- serv_anexo_iv: a parte do serviço com o acumulador do Simples no anexo IV (onde ficam a obra, a limpeza, a vigilância
-- e a advocacia) — uma pista, não o item.
-- base_iss e iss_devido: a linha 3 (ISS) da efimpser; iss_retido: a linha 18 (ISS Ret). No Simples o ISS vai no DAS e a
-- nota não tem a linha (em 09/2026, 1 dos 222 segmentos a tem).
-- O total do serviço não sai daqui (o rascunho o trazia como serv_sem_item): é o receita_servicos do faturamento.sql,
-- sobre os mesmos segmentos. Uma linha por empresa com segmento de serviço de faturamento no mês.
WITH p AS (SELECT CAST(? AS DATE) AS ini, CAST(? AS DATE) AS fim),
v AS (
    SELECT a.CODI_EMP, a.CODI_ACU, a.VIGENCIA_ACU, a.IFAT_ACU
      FROM bethadba.EFACUMULADOR_VIGENCIA a, p
     WHERE a.VIGENCIA_ACU = (SELECT MAX(b.VIGENCIA_ACU) FROM bethadba.EFACUMULADOR_VIGENCIA b
                              WHERE b.CODI_EMP = a.CODI_EMP AND b.CODI_ACU = a.CODI_ACU AND b.VIGENCIA_ACU <= p.fim)
),
vi AS (
    SELECT v.CODI_EMP, v.CODI_ACU, MAX(a.SIMPLESN_ANEXO_IAC) AS anexo
      FROM v JOIN bethadba.EFACUMULADOR_VIGENCIA_IMPOSTOS a
             ON a.CODI_EMP = v.CODI_EMP AND a.CODI_ACU = v.CODI_ACU AND a.VIGENCIA_ACU = v.VIGENCIA_ACU
     WHERE a.CODI_IMP = 44
     GROUP BY v.CODI_EMP, v.CODI_ACU
),
seg AS (
    SELECT r.codi_emp, r.codi_ser, r.codi_acu, COALESCE(r.vcon_ser, 0) AS vl
      FROM bethadba.efservicos r JOIN v ON v.CODI_EMP = r.codi_emp AND v.CODI_ACU = r.codi_acu, p
     WHERE r.dser_ser BETWEEN p.ini AND p.fim
       AND COALESCE(r.situacao_ser, 0) NOT IN (2, 3, 4, 5)
       AND COALESCE(r.cancelada_ser, 'N') <> 'S'
       AND v.IFAT_ACU = 'S'
),
iss AS (
    SELECT seg.codi_emp, seg.codi_ser,
           SUM(CASE WHEN i.codi_imp = 3 THEN i.bcal_ise ELSE 0 END) AS base,
           SUM(CASE WHEN i.codi_imp = 3 THEN i.vlor_ise ELSE 0 END) AS devido,
           SUM(CASE WHEN i.codi_imp = 18 THEN i.vlor_ise ELSE 0 END) AS retido
      FROM seg JOIN bethadba.efimpser i ON i.codi_emp = seg.codi_emp AND i.codi_ser = seg.codi_ser AND i.codi_imp IN (3, 18)
     GROUP BY seg.codi_emp, seg.codi_ser
)
SELECT seg.codi_emp AS codigo,
       CAST(SUM(CASE WHEN vi.anexo = 4 THEN seg.vl ELSE 0 END) AS NUMERIC(15,2)) AS serv_anexo_iv,
       CAST(SUM(COALESCE(iss.base, 0)) AS NUMERIC(15,2)) AS base_iss,
       CAST(SUM(COALESCE(iss.devido, 0)) AS NUMERIC(15,2)) AS iss_devido,
       CAST(SUM(COALESCE(iss.retido, 0)) AS NUMERIC(15,2)) AS iss_retido
  FROM seg
  LEFT JOIN vi ON vi.CODI_EMP = seg.codi_emp AND vi.CODI_ACU = seg.codi_acu
  LEFT JOIN iss ON iss.codi_emp = seg.codi_emp AND iss.codi_ser = seg.codi_ser
 GROUP BY seg.codi_emp
 ORDER BY seg.codi_emp
