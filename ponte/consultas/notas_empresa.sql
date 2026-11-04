-- notas_empresa.sql: o documento da empresa no Domínio (bethadba.geempre, "Empresa - Cadastro", cgce_emp), pra ponte das
-- notas conferir que o código que o sistema mandou é mesmo a empresa autorizada (o documento do cadastro do sistema).
-- O parâmetro é o código da empresa no Domínio. Uma linha (ou nenhuma, código que não existe).
SELECT NULLIF(TRIM(g.cgce_emp), '') AS documento
  FROM bethadba.geempre g
 WHERE g.codi_emp = ?
