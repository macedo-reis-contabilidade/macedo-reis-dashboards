-- comparativo_presumido.sql (rascunho da fila de 11/11/2026, o Comparativo tributário; a ponte NÃO lê esta pasta): por
-- empresa, a receita do mês pelo percentual de presunção do IRPJ e da CSLL e a apuração que o próprio Domínio fez. Os
-- dois parâmetros são o primeiro e o último dia do mês.
-- Tabelas: bethadba.efsaidas, bethadba.efservicos e bethadba.efentradas (o corte do faturamento.sql: os segmentos com
-- acumulador de faturamento e, com sinal trocado, as entradas com acumulador de devolução; fora a cancelada, denegada e
-- inutilizada), bethadba.EFACUMULADOR_VIGENCIA_IMPOSTOS ("Acumuladores - Cadastro - Impostos": ALBC_IAC "Aliquota da Base
-- de Calculo" do CODI_IMP 7, IRPJ-LP, e do 6, CSOC, na MESMA vigência do acumulador que o corte usa — os impostos são o
-- retrato de cada vigência: 3.524 dos 3.837 acumuladores de faturamento vigentes em 09/2026 têm as linhas na própria
-- vigência — é a presunção: 8 ou 32 no IRPJ, 12 ou 32 na CSLL) e bethadba.efsdoimp ("Saldo dos Impostos": codi_imp 7 e
-- 6; vcos_sim e vcov_sim "Valor contabil de saidas/servicos", bcas_sim e bcav_sim "Base de calculo de saidas/servicos" =
-- a receita vezes a presunção, bcal_sim "Base de calculo do imposto", srec_sim "SALDO A RECOLHER ANTES DAS DEDUCOES" =
-- 15% (IRPJ) ou 9% (CSLL) da base, pdic_sim 6 mensal ou 7 trimestral).
-- A RECEITA POR PERCENTUAL SAI DO ACUMULADOR, NÃO DA APURAÇÃO: a apuração guarda uma receita e uma base só (a soma de
-- todos os percentuais). receita_irpj_1_6, _8, _16 e _32: os segmentos cujo acumulador tem essa presunção no IRPJ;
-- receita_irpj_outros: o resto (outro percentual, ou o acumulador sem o IRPJ; no 3º trimestre de 2026, toda a receita
-- das 72 empresas do Simples e das 2 do Real). receita_csll_12, _32 e receita_csll_outros, pela presunção da CSLL. A
-- devolução entra negativa, pelo acumulador dela.
-- A apuração: a do mês (pdic_sim 6) e, quando a empresa apura por trimestre (pdic_sim 7, gravada no último mês dele), a
-- do trimestre a que o mês pertence — os quatro campos da apuração vêm do trimestre inteiro, e apuracao_trimestral = 1.
-- Em 07 a 09/2026, 4 empresas do Presumido têm a linha mensal e 3 a trimestral. A apuração é da pessoa jurídica: a
-- linha da MATRIZ tem a receita e a base de todas as empresas da mesma raiz de CNPJ (conferido em 07 a 09/2026), e a da
-- filial repete a base dela, com a receita (vcos_sim) zerada — somar as linhas da raiz conta a filial duas vezes. A
-- receita por percentual, aqui, é a das notas da própria empresa.
-- demais_receitas: a base do imposto menos as bases das saídas e dos serviços (bcal_sim − bcas_sim − bcav_sim, as
-- receitas que entram inteiras na base); zero em todas as linhas de 07 a 09/2026. base_irpj e irpj_apurado: bcal_sim e
-- srec_sim do 7; base_csll e csll_apurada, do 6.
-- Fica de fora: o adicional do IRPJ. Ele não está na linha do 7: de 10/2024 a 09/2026, nas 7 linhas trimestrais com a
-- base acima de R$ 60 mil (e na 1 mensal acima de R$ 20 mil), o srec_sim ficou em 15% e os outros acréscimos e débitos
-- (oacr_sim, outd_sim) vêm zerados. Onde o Domínio guarda o adicional, não se achou.
-- Uma linha por empresa com faturamento ou apuração no mês.
WITH p AS (SELECT CAST(? AS DATE) AS ini, CAST(? AS DATE) AS fim),
q AS (
    SELECT p.ini, p.fim, YMD(YEAR(p.fim), MONTH(p.fim) - MOD(MONTH(p.fim) - 1, 3), 1) AS qi,
           DATEADD(day, -1, DATEADD(month, 3, YMD(YEAR(p.fim), MONTH(p.fim) - MOD(MONTH(p.fim) - 1, 3), 1))) AS qf
      FROM p
),
v AS (
    SELECT a.CODI_EMP, a.CODI_ACU, a.VIGENCIA_ACU, a.IFAT_ACU, a.IDEV_ACU
      FROM bethadba.EFACUMULADOR_VIGENCIA a, p
     WHERE a.VIGENCIA_ACU = (SELECT MAX(b.VIGENCIA_ACU) FROM bethadba.EFACUMULADOR_VIGENCIA b
                              WHERE b.CODI_EMP = a.CODI_EMP AND b.CODI_ACU = a.CODI_ACU AND b.VIGENCIA_ACU <= p.fim)
),
pr AS (
    SELECT v.CODI_EMP, v.CODI_ACU,
           MAX(CASE WHEN a.CODI_IMP = 7 THEN a.ALBC_IAC END) AS ir,
           MAX(CASE WHEN a.CODI_IMP = 6 THEN a.ALBC_IAC END) AS cs
      FROM v JOIN bethadba.EFACUMULADOR_VIGENCIA_IMPOSTOS a
             ON a.CODI_EMP = v.CODI_EMP AND a.CODI_ACU = v.CODI_ACU AND a.VIGENCIA_ACU = v.VIGENCIA_ACU
     WHERE a.CODI_IMP IN (6, 7)
     GROUP BY v.CODI_EMP, v.CODI_ACU
),
seg AS (
    SELECT s.codi_emp, s.codi_acu, COALESCE(s.vcon_sai, 0) AS vl
      FROM bethadba.efsaidas s JOIN v ON v.CODI_EMP = s.codi_emp AND v.CODI_ACU = s.codi_acu, p
     WHERE s.dsai_sai BETWEEN p.ini AND p.fim AND COALESCE(s.situacao_sai, 0) NOT IN (2, 3, 4, 5)
       AND COALESCE(s.cancelada_sai, 'N') <> 'S' AND v.IFAT_ACU = 'S'
    UNION ALL
    SELECT r.codi_emp, r.codi_acu, COALESCE(r.vcon_ser, 0)
      FROM bethadba.efservicos r JOIN v ON v.CODI_EMP = r.codi_emp AND v.CODI_ACU = r.codi_acu, p
     WHERE r.dser_ser BETWEEN p.ini AND p.fim AND COALESCE(r.situacao_ser, 0) NOT IN (2, 3, 4, 5)
       AND COALESCE(r.cancelada_ser, 'N') <> 'S' AND v.IFAT_ACU = 'S'
    UNION ALL
    SELECT e.codi_emp, e.codi_acu, -COALESCE(e.vcon_ent, 0)
      FROM bethadba.efentradas e JOIN v ON v.CODI_EMP = e.codi_emp AND v.CODI_ACU = e.codi_acu, p
     WHERE e.dent_ent BETWEEN p.ini AND p.fim AND COALESCE(e.situacao_ent, 0) NOT IN (2, 3, 4, 5) AND v.IDEV_ACU = 'S'
),
rec AS (
    SELECT seg.codi_emp,
           SUM(CASE WHEN pr.ir = 1.6 THEN seg.vl ELSE 0 END) AS ir1,
           SUM(CASE WHEN pr.ir = 8 THEN seg.vl ELSE 0 END) AS ir8,
           SUM(CASE WHEN pr.ir = 16 THEN seg.vl ELSE 0 END) AS ir16,
           SUM(CASE WHEN pr.ir = 32 THEN seg.vl ELSE 0 END) AS ir32,
           SUM(CASE WHEN COALESCE(pr.ir, 0) NOT IN (1.6, 8, 16, 32) THEN seg.vl ELSE 0 END) AS iro,
           SUM(CASE WHEN pr.cs = 12 THEN seg.vl ELSE 0 END) AS cs12,
           SUM(CASE WHEN pr.cs = 32 THEN seg.vl ELSE 0 END) AS cs32,
           SUM(CASE WHEN COALESCE(pr.cs, 0) NOT IN (12, 32) THEN seg.vl ELSE 0 END) AS cso
      FROM seg LEFT JOIN pr ON pr.CODI_EMP = seg.codi_emp AND pr.CODI_ACU = seg.codi_acu
     GROUP BY seg.codi_emp
),
ap AS (
    SELECT s.codi_emp,
           MAX(CASE WHEN s.pdic_sim = 7 THEN 1 ELSE 0 END) AS tri,
           SUM(CASE WHEN s.codi_imp = 7 THEN s.bcal_sim - s.bcas_sim - s.bcav_sim ELSE 0 END) AS demais,
           SUM(CASE WHEN s.codi_imp = 7 THEN s.bcal_sim ELSE 0 END) AS bir,
           SUM(CASE WHEN s.codi_imp = 7 THEN s.srec_sim ELSE 0 END) AS ir,
           SUM(CASE WHEN s.codi_imp = 6 THEN s.bcal_sim ELSE 0 END) AS bcs,
           SUM(CASE WHEN s.codi_imp = 6 THEN s.srec_sim ELSE 0 END) AS cs
      FROM bethadba.efsdoimp s, q
     WHERE s.codi_imp IN (6, 7)
       AND ((s.pdic_sim = 6 AND s.data_sim BETWEEN q.ini AND q.fim) OR (s.pdic_sim = 7 AND s.data_sim BETWEEN q.qi AND q.qf))
     GROUP BY s.codi_emp
),
emp AS (SELECT codi_emp FROM rec UNION SELECT codi_emp FROM ap)
SELECT emp.codi_emp AS codigo,
       CAST(COALESCE(rec.ir1, 0) AS NUMERIC(15,2)) AS receita_irpj_1_6,
       CAST(COALESCE(rec.ir8, 0) AS NUMERIC(15,2)) AS receita_irpj_8,
       CAST(COALESCE(rec.ir16, 0) AS NUMERIC(15,2)) AS receita_irpj_16,
       CAST(COALESCE(rec.ir32, 0) AS NUMERIC(15,2)) AS receita_irpj_32,
       CAST(COALESCE(rec.iro, 0) AS NUMERIC(15,2)) AS receita_irpj_outros,
       CAST(COALESCE(rec.cs12, 0) AS NUMERIC(15,2)) AS receita_csll_12,
       CAST(COALESCE(rec.cs32, 0) AS NUMERIC(15,2)) AS receita_csll_32,
       CAST(COALESCE(rec.cso, 0) AS NUMERIC(15,2)) AS receita_csll_outros,
       ap.tri AS apuracao_trimestral,
       CAST(ap.demais AS NUMERIC(15,2)) AS demais_receitas,
       CAST(ap.bir AS NUMERIC(15,2)) AS base_irpj,
       CAST(ap.ir AS NUMERIC(15,2)) AS irpj_apurado,
       CAST(ap.bcs AS NUMERIC(15,2)) AS base_csll,
       CAST(ap.cs AS NUMERIC(15,2)) AS csll_apurada
  FROM emp
  LEFT JOIN rec ON rec.codi_emp = emp.codi_emp
  LEFT JOIN ap ON ap.codi_emp = emp.codi_emp
 ORDER BY emp.codi_emp
