-- faturamento.sql (RASCUNHO: a ponte não lê esta pasta): por empresa, a receita bruta do mês como o próprio Domínio
-- a conta pra apurar os impostos. Os dois parâmetros são o primeiro e o último dia do mês.
-- Tabelas: bethadba.EFACUMULADOR_VIGENCIA ("Acumuladores - Cadastro", a vigência mais recente até o fim do mês:
-- IFAT_ACU "Incide sobre Faturamento", IDEV_ACU "Incide sobre Devolucao"), bethadba.efsaidas e bethadba.efservicos
-- (as notas de saída e de serviço, pelo codi_acu de cada segmento, nas datas do fiscal.sql), bethadba.efentradas
-- (a devolução de venda: o segmento de entrada com acumulador de devolução), bethadba.efsdoimp_simples_nacional
-- ("Saldo dos Impostos - Detalhamento do Simples Nacional", codi_imp 44: a apuração do mês) e
-- bethadba.efsimples_nacional_receita_bruta_anterior ("Valores da Receita Bruta dos periodos anteriores", a receita
-- informada dos meses de antes do Domínio apurar).
-- receita_bruta = notas de saída e de serviço com acumulador de faturamento, menos as entradas com acumulador de
-- devolução; é a base do Simples (bate em 71 de 71 empresas em 09/2026, contada a linha de cada estabelecimento) e a
-- receita sobre a qual o Presumido aplica a presunção do IRPJ e da CSLL. Fica de fora a nota cancelada, denegada ou
-- inutilizada (situacao 2 a 5), a remessa, a transferência e o que mais o acumulador marca como não faturamento.
-- A apuração do Simples fica na empresa que apura (a matriz), com uma linha por estabelecimento (filial = o código do
-- estabelecimento no Domínio): receita_simples soma todos, como no PGDAS; receita_simples_propria, só a linha do
-- próprio código (a que bate com a receita_bruta dele). O anexo 0 é o total dos anexos 1 a 5.
-- receita_st, receita_monofasica e receita_exportacao: pelas alíquotas da partilha zeradas na linha da apuração
-- (anexos I e II, seção 2, ICMS zerado = revenda ou industrialização com ST; PIS e Cofins zerados = monofásico; tipo de
-- receita 2 = exportação). A receita com ST e monofásico entra nas duas.
-- rbt12: os 12 meses antes do mês, cada um pela receita anterior informada, se tem, senão pela apuração (anexo 0, todos
-- os estabelecimentos); com menos de 12 meses (o primeiro ano), a média dos meses vezes 12. Só na empresa que apura.
-- Sem coluna no Domínio: o RBT12 pronto (é calculado aqui) e a receita do Presumido e do Real numa tabela própria
-- (a efsdoimp guarda a base, que no PIS e na Cofins já vem sem as exclusões). A empresa sem nota e sem apuração no mês
-- não tem linha.
WITH p AS (SELECT CAST(? AS DATE) AS ini, CAST(? AS DATE) AS fim),
v AS (
    SELECT a.CODI_EMP, a.CODI_ACU, a.IFAT_ACU, a.IDEV_ACU
      FROM bethadba.EFACUMULADOR_VIGENCIA a, p
     WHERE a.VIGENCIA_ACU = (SELECT MAX(b.VIGENCIA_ACU) FROM bethadba.EFACUMULADOR_VIGENCIA b
                              WHERE b.CODI_EMP = a.CODI_EMP AND b.CODI_ACU = a.CODI_ACU AND b.VIGENCIA_ACU <= p.fim)
),
notas AS (
    SELECT s.codi_emp AS codigo, SUM(COALESCE(s.vcon_sai, 0)) AS merc,
           CAST(0 AS NUMERIC(15,2)) AS serv, CAST(0 AS NUMERIC(15,2)) AS dev
      FROM bethadba.efsaidas s JOIN v ON v.CODI_EMP = s.codi_emp AND v.CODI_ACU = s.codi_acu, p
     WHERE s.dsai_sai BETWEEN p.ini AND p.fim
       AND COALESCE(s.situacao_sai, 0) NOT IN (2, 3, 4, 5)
       AND COALESCE(s.cancelada_sai, 'N') <> 'S'
       AND v.IFAT_ACU = 'S'
     GROUP BY s.codi_emp
    UNION ALL
    SELECT r.codi_emp, 0, SUM(COALESCE(r.vcon_ser, 0)), 0
      FROM bethadba.efservicos r JOIN v ON v.CODI_EMP = r.codi_emp AND v.CODI_ACU = r.codi_acu, p
     WHERE r.dser_ser BETWEEN p.ini AND p.fim
       AND COALESCE(r.situacao_ser, 0) NOT IN (2, 3, 4, 5)
       AND COALESCE(r.cancelada_ser, 'N') <> 'S'
       AND v.IFAT_ACU = 'S'
     GROUP BY r.codi_emp
    UNION ALL
    SELECT e.codi_emp, 0, 0, SUM(COALESCE(e.vcon_ent, 0))
      FROM bethadba.efentradas e JOIN v ON v.CODI_EMP = e.codi_emp AND v.CODI_ACU = e.codi_acu, p
     WHERE e.dent_ent BETWEEN p.ini AND p.fim
       AND COALESCE(e.situacao_ent, 0) NOT IN (2, 3, 4, 5)
       AND v.IDEV_ACU = 'S'
     GROUP BY e.codi_emp
),
nf AS (
    SELECT codigo, SUM(merc) AS merc, SUM(serv) AS serv, SUM(dev) AS dev FROM notas GROUP BY codigo
),
sn AS (
    SELECT s.codi_emp AS codigo,
           SUM(CASE WHEN s.anexo = 0 THEN s.basen ELSE 0 END) AS total,
           SUM(CASE WHEN s.anexo = 0 AND s.filial = s.codi_emp THEN s.basen ELSE 0 END) AS propria,
           SUM(CASE WHEN s.anexo IN (1, 2) AND s.secao = 2 AND s.aicms = 0 AND s.TIPO_RECEITA = 1
                    THEN s.basen ELSE 0 END) AS st,
           SUM(CASE WHEN s.anexo IN (1, 2) AND s.apis = 0 AND s.acofins = 0 AND s.TIPO_RECEITA = 1
                    THEN s.basen ELSE 0 END) AS mono,
           SUM(CASE WHEN s.anexo > 0 AND s.TIPO_RECEITA = 2 THEN s.basen ELSE 0 END) AS exportacao,
           SUM(CASE WHEN s.anexo = 1 THEN s.basen ELSE 0 END) AS a1,
           SUM(CASE WHEN s.anexo = 2 THEN s.basen ELSE 0 END) AS a2,
           SUM(CASE WHEN s.anexo = 3 THEN s.basen ELSE 0 END) AS a3,
           SUM(CASE WHEN s.anexo = 4 THEN s.basen ELSE 0 END) AS a4,
           SUM(CASE WHEN s.anexo = 5 THEN s.basen ELSE 0 END) AS a5
      FROM bethadba.efsdoimp_simples_nacional s, p
     WHERE s.codi_imp = 44 AND s.data_sim BETWEEN p.ini AND p.fim
     GROUP BY s.codi_emp
),
ap12 AS (
    SELECT s.codi_emp, DATEFORMAT(s.data_sim, 'yyyy-mm') AS mes, SUM(s.basen) AS v
      FROM bethadba.efsdoimp_simples_nacional s, p
     WHERE s.codi_imp = 44 AND s.anexo = 0
       AND s.data_sim BETWEEN DATEADD(month, -12, p.ini) AND DATEADD(day, -1, p.ini)
     GROUP BY s.codi_emp, DATEFORMAT(s.data_sim, 'yyyy-mm')
),
an12 AS (
    SELECT a.codi_emp, DATEFORMAT(a.periodo, 'yyyy-mm') AS mes, SUM(a.valor) AS v
      FROM bethadba.efsimples_nacional_receita_bruta_anterior a, p
     WHERE a.periodo BETWEEN DATEADD(month, -12, p.ini) AND DATEADD(day, -1, p.ini)
     GROUP BY a.codi_emp, DATEFORMAT(a.periodo, 'yyyy-mm')
),
m12 AS (
    SELECT codi_emp, mes FROM ap12 UNION SELECT codi_emp, mes FROM an12
),
r12 AS (
    SELECT m12.codi_emp AS codigo, COUNT(*) AS meses, SUM(COALESCE(an12.v, ap12.v)) AS soma
      FROM m12 LEFT JOIN ap12 ON ap12.codi_emp = m12.codi_emp AND ap12.mes = m12.mes
               LEFT JOIN an12 ON an12.codi_emp = m12.codi_emp AND an12.mes = m12.mes
     GROUP BY m12.codi_emp
),
emp AS (
    SELECT codigo FROM nf UNION SELECT codigo FROM sn
)
SELECT emp.codigo AS codigo,
       CAST(COALESCE(nf.merc, 0) + COALESCE(nf.serv, 0) - COALESCE(nf.dev, 0) AS NUMERIC(15,2)) AS receita_bruta,
       CAST(COALESCE(nf.merc, 0) AS NUMERIC(15,2)) AS receita_mercadorias,
       CAST(COALESCE(nf.serv, 0) AS NUMERIC(15,2)) AS receita_servicos,
       CAST(COALESCE(nf.dev, 0) AS NUMERIC(15,2)) AS devolucoes,
       CAST(sn.total AS NUMERIC(15,2)) AS receita_simples,
       CAST(sn.propria AS NUMERIC(15,2)) AS receita_simples_propria,
       CAST(sn.st AS NUMERIC(15,2)) AS receita_st,
       CAST(sn.mono AS NUMERIC(15,2)) AS receita_monofasica,
       CAST(sn.exportacao AS NUMERIC(15,2)) AS receita_exportacao,
       CAST(sn.a1 AS NUMERIC(15,2)) AS receita_anexo_1,
       CAST(sn.a2 AS NUMERIC(15,2)) AS receita_anexo_2,
       CAST(sn.a3 AS NUMERIC(15,2)) AS receita_anexo_3,
       CAST(sn.a4 AS NUMERIC(15,2)) AS receita_anexo_4,
       CAST(sn.a5 AS NUMERIC(15,2)) AS receita_anexo_5,
       CAST(CASE WHEN sn.codigo IS NULL OR COALESCE(r12.meses, 0) = 0 THEN NULL
                 WHEN r12.meses >= 12 THEN r12.soma
                 ELSE r12.soma * 12 / r12.meses END AS NUMERIC(15,2)) AS rbt12,
       CASE WHEN sn.codigo IS NULL THEN NULL ELSE COALESCE(r12.meses, 0) END AS meses_rbt12
  FROM emp
  LEFT JOIN nf ON nf.codigo = emp.codigo
  LEFT JOIN sn ON sn.codigo = emp.codigo
  LEFT JOIN r12 ON r12.codigo = emp.codigo
 ORDER BY emp.codigo
