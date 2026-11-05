-- contabil_encerramento.sql (RASCUNHO: a ponte não lê esta pasta): por empresa, o encerramento do exercício (o
-- zeramento) num ano. Os dois parâmetros são o primeiro e o último dia do ano. Tabela: bethadba.ctlancto
-- ("Lancamentos Contabeis": orig_lan 2 = "Zeramento", data_lan, dorig_lan "Data Original", a data em que o lançamento
-- entrou no Domínio).
-- zerado_em: o último dia com zeramento no ano (o Domínio põe o zeramento no último dia do período encerrado);
-- zeramentos: em quantos dias do ano houve zeramento (1 no anual, 4 no trimestral);
-- zerado_incluido_em: o dia em que o último zeramento (o de zerado_em) entrou no Domínio — a maior dorig_lan das linhas
--   dele;
-- lancados_depois: quantos lançamentos do ano (fora o zeramento) entraram no Domínio depois do zeramento do período
--   deles — o primeiro zeramento do ano com data igual ou depois da do lançamento; o período ficou mexido depois de
--   encerrado, e o zeramento, velho. O lançamento com data depois do último zeramento do ano (de período ainda não
--   encerrado) não conta. A dorig_lan não tem hora: o que entrou no mesmo dia do zeramento não conta. Sem zeramento no
--   ano, null.
-- lancamentos_do_ano: as linhas do ano, fora o zeramento.
-- A periodicidade do encerramento (CTPARMTO_DERE_VIGENCIA.ENCERRAMENTO_CONTABIL) fica de fora: as 363 empresas têm uma
-- vigência só, de 01/10/2026, Anual — a guia é nova e não diz os anos de antes (em 2024, 4 empresas zeraram 4 vezes).
-- Entra a empresa com lançamento no ano (zeramento ou outro).
WITH p AS (SELECT CAST(? AS DATE) AS ini, CAST(? AS DATE) AS fim),
zd AS (
    SELECT l.codi_emp, l.data_lan AS dia, MAX(l.dorig_lan) AS incl
      FROM bethadba.ctlancto l, p
     WHERE l.data_lan BETWEEN p.ini AND p.fim AND l.orig_lan = 2
     GROUP BY l.codi_emp, l.data_lan
),
z AS (
    SELECT zd.codi_emp, MAX(zd.dia) AS ult_zer, COUNT(*) AS n_zer FROM zd GROUP BY zd.codi_emp
),
zu AS (
    SELECT z.codi_emp, z.ult_zer, z.n_zer, zd.incl FROM z JOIN zd ON zd.codi_emp = z.codi_emp AND zd.dia = z.ult_zer
),
zp AS (
    SELECT zd.codi_emp, zd.dia, zd.incl,
           COALESCE((SELECT MAX(z2.dia) FROM zd z2 WHERE z2.codi_emp = zd.codi_emp AND z2.dia < zd.dia),
                    DATEADD(day, -1, p.ini)) AS anterior
      FROM zd, p
),
a AS (
    SELECT l.codi_emp, COUNT(*) AS n_lanc
      FROM bethadba.ctlancto l, p
     WHERE l.data_lan BETWEEN p.ini AND p.fim AND l.orig_lan <> 2
     GROUP BY l.codi_emp
),
d AS (
    SELECT l.codi_emp, COUNT(*) AS n_depois
      FROM bethadba.ctlancto l
      JOIN zp ON zp.codi_emp = l.codi_emp AND l.data_lan > zp.anterior AND l.data_lan <= zp.dia, p
     WHERE l.data_lan BETWEEN p.ini AND p.fim AND l.orig_lan <> 2 AND l.dorig_lan > zp.incl
     GROUP BY l.codi_emp
),
emp AS (SELECT codi_emp FROM z UNION SELECT codi_emp FROM a)
SELECT emp.codi_emp AS codigo,
       zu.ult_zer AS zerado_em,
       COALESCE(zu.n_zer, 0) AS zeramentos,
       zu.incl AS zerado_incluido_em,
       CASE WHEN zu.codi_emp IS NULL THEN NULL ELSE COALESCE(d.n_depois, 0) END AS lancados_depois,
       COALESCE(a.n_lanc, 0) AS lancamentos_do_ano
  FROM emp
  LEFT JOIN zu ON zu.codi_emp = emp.codi_emp
  LEFT JOIN a ON a.codi_emp = emp.codi_emp
  LEFT JOIN d ON d.codi_emp = emp.codi_emp
 ORDER BY emp.codi_emp
