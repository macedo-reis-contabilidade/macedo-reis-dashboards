-- teste_eliminados.sql (rascunho da fila de 17/11/2026, o teste do fechamento; a ponte NÃO lê): os lançamentos da
-- empresa do teste que foram eliminados do Domínio e ficaram guardados na bethadba.ctbaklan ("Lancamentos
-- Eliminados"), juntos por mês, origem, contas e dia de inclusão original (DORIG_LAN). Só a contagem e a soma: o
-- histórico (chis_lan), o usuário (codi_usu) e os CPFs não são lidos. {EMPRESA}: o código do empresa.txt.
SELECT DATEFORMAT(b.data_lan, 'yyyy-mm') AS mes, b.orig_lan AS origem, b.cdeb_lan AS debito, b.ccre_lan AS credito,
       b.DORIG_LAN AS incluido, COUNT(*) AS linhas, CAST(SUM(b.vlor_lan) AS NUMERIC(15,2)) AS soma
  FROM bethadba.ctbaklan b
 WHERE b.codi_emp = {EMPRESA}
 GROUP BY DATEFORMAT(b.data_lan, 'yyyy-mm'), b.orig_lan, b.cdeb_lan, b.ccre_lan, b.DORIG_LAN
 ORDER BY 1, 2, 3, 4, 5
