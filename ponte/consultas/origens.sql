-- origens.sql (versão 3 do pacote, 05/11/2026): por empresa, os lançamentos contábeis do mês por origem e o dia em que o
-- último deles entrou no Domínio. Os dois parâmetros são o primeiro e o último dia do mês. Escrita a partir do rascunho
-- contabil_andamento.sql da fila de 04/11 (o bloco "mes"), com a escrita fiscal inteira (a fila contava só a 4 a 7).
-- Tabela: bethadba.ctlancto ("Lancamentos Contabeis": data_lan, orig_lan "Origem" — o nome de cada código está em
-- bethadba.CTORIGEM_LANCAMENTO —, dorig_lan "Data Original").
-- lanc_normais: a origem 1 (o lançamento do contador); lanc_extrato: a 39 (o extrato bancário importado); lanc_fiscal: a
-- escrita fiscal (4 a 9, 11 e 21 a 29: as saídas, as entradas, os serviços), sem a apuração; lanc_folha: a 13;
-- lanc_apuracao: a 10; lanc_outros: o resto (o patrimônio, os honorários). O zeramento (2) não conta em nada.
-- incluido_ate: a maior dorig_lan dos lançamentos do mês — o dia em que o último entrou no Domínio (sem hora; a
-- integração gerada de novo troca a data). A ctlancto não guarda a data de alteração.
-- A empresa sem lançamento no mês não tem linha.
WITH p AS (SELECT CAST(? AS DATE) AS ini, CAST(? AS DATE) AS fim)
SELECT l.codi_emp AS codigo,
       SUM(CASE WHEN l.orig_lan = 1 THEN 1 ELSE 0 END) AS lanc_normais,
       SUM(CASE WHEN l.orig_lan = 39 THEN 1 ELSE 0 END) AS lanc_extrato,
       SUM(CASE WHEN l.orig_lan BETWEEN 4 AND 9 OR l.orig_lan = 11 OR l.orig_lan BETWEEN 21 AND 29
                THEN 1 ELSE 0 END) AS lanc_fiscal,
       SUM(CASE WHEN l.orig_lan = 13 THEN 1 ELSE 0 END) AS lanc_folha,
       SUM(CASE WHEN l.orig_lan = 10 THEN 1 ELSE 0 END) AS lanc_apuracao,
       SUM(CASE WHEN l.orig_lan IN (1, 10, 11, 13, 39) OR l.orig_lan BETWEEN 4 AND 9 OR l.orig_lan BETWEEN 21 AND 29
                THEN 0 ELSE 1 END) AS lanc_outros,
       MAX(l.dorig_lan) AS incluido_ate
  FROM bethadba.ctlancto l, p
 WHERE l.data_lan BETWEEN p.ini AND p.fim AND l.orig_lan <> 2
 GROUP BY l.codi_emp
 ORDER BY l.codi_emp
