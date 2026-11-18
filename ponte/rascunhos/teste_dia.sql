-- teste_dia.sql (rascunho da fila de 17/11/2026, o teste do fechamento; a ponte NÃO lê): todos os lançamentos da
-- empresa do teste num mês, juntos por dia, origem, origem do registro, conta de débito, conta de crédito e dia de
-- inclusão no Domínio. Os dois parâmetros são o primeiro e o último dia do mês (--mes AAAA-MM). {EMPRESA}: o código do
-- empresa.txt. A saída fica só no PC.
-- Tabela: bethadba.ctlancto (data_lan; orig_lan, a origem da CTORIGEM_LANCAMENTO — 1 normal, 2 zeramento, 4 a 9, 11 e 21
-- a 29 a escrita fiscal, 10 a apuração, 13 a folha, 39 o extrato —; origem_reg 0 sistema e 2 "Imp. Layout"; cdeb_lan
-- e ccre_lan, os reduzidos, 0 no lado vazio da partida múltipla; dorig_lan, o dia em que entrou no Domínio; vlor_lan).
-- O histórico não é lido.
WITH p AS (SELECT CAST(? AS DATE) AS ini, CAST(? AS DATE) AS fim)
SELECT l.data_lan AS dia, l.orig_lan AS origem, l.origem_reg, l.cdeb_lan AS debito, l.ccre_lan AS credito,
       l.dorig_lan AS incluido, COUNT(*) AS linhas, COUNT(DISTINCT l.codi_lote) AS lotes,
       CAST(SUM(l.vlor_lan) AS NUMERIC(15,2)) AS soma
  FROM bethadba.ctlancto l, p
 WHERE l.codi_emp = {EMPRESA} AND l.data_lan BETWEEN p.ini AND p.fim
 GROUP BY l.data_lan, l.orig_lan, l.origem_reg, l.cdeb_lan, l.ccre_lan, l.dorig_lan
 ORDER BY l.data_lan, l.orig_lan, l.cdeb_lan, l.ccre_lan, l.dorig_lan
