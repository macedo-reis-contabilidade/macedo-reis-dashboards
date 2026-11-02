-- contabil.sql: por empresa, os lançamentos contábeis com data no mês (bethadba.ctlancto, "Lancamentos Contabeis").
-- Conta cada linha de ctlancto (o lançamento numerado, nume_lan, com a conta a débito e a crédito) com data_lan
-- entre o primeiro e o último dia do mês; ultimo_lancamento = a maior data_lan do mês. Entram todas as origens
-- (o digitado, a integração da escrita fiscal, a folha, a apuração), menos o zeramento (orig_lan = 2), que o Domínio
-- gera no encerramento e cai sempre no último dia do período. O lançamento eliminado não fica aqui (vai pra ctbaklan).
-- A empresa sem lançamento no mês não tem linha.
SELECT l.codi_emp       AS codigo,
       COUNT(*)         AS lancamentos,
       MAX(l.data_lan)  AS ultimo_lancamento
FROM bethadba.ctlancto l
WHERE l.data_lan BETWEEN ? AND ?
  AND l.orig_lan <> 2
GROUP BY l.codi_emp
ORDER BY l.codi_emp
