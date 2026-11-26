-- teste_final_lancados.sql (rascunho da fila de 24/11/2026, a versão final do teste do fechamento; a ponte NÃO lê): os
-- lançamentos da empresa do teste num mês, um a um, pra conferir que nada dos arquivos entra em dobro (o item 4.3 da
-- fila): tudo o que não é da escrita fiscal, e da escrita fiscal só o que sai do caixa (o pagamento de fornecedor pela
-- integração das entradas). Os dois parâmetros são o primeiro e o último dia do mês (--mes AAAA-MM). O código da
-- empresa (do empresa.txt) entra no lugar do marcador do corpo na hora de rodar, sem os comentários. A saída fica só no
-- PC.
-- Tabelas: bethadba.ctlancto (data_lan; codi_lote; orig_lan, a origem — 4 a 9, 11 e 21 a 29 a escrita fiscal —;
-- origem_reg; cdeb_lan e ccre_lan, os reduzidos, 0 no lado vazio da partida múltipla; dorig_lan, o dia em que entrou no
-- Domínio; vlor_lan) e bethadba.ctcontas (o caixa pelo grupo 11101 da classificação). O histórico não é lido.
WITH p AS (SELECT CAST(? AS DATE) AS ini, CAST(? AS DATE) AS fim)
SELECT l.data_lan AS dia, l.codi_lote AS lote, l.orig_lan AS origem, l.origem_reg, l.cdeb_lan AS debito,
       l.ccre_lan AS credito, l.dorig_lan AS incluido, CAST(l.vlor_lan AS NUMERIC(15,2)) AS valor
  FROM bethadba.ctlancto l, p
 WHERE l.codi_emp = {EMPRESA} AND l.data_lan BETWEEN p.ini AND p.fim
   AND (l.orig_lan NOT IN (4, 5, 6, 7, 8, 9, 11, 21, 22, 23, 24, 25, 26, 27, 28, 29)
        OR l.ccre_lan IN (SELECT c.codi_cta FROM bethadba.ctcontas c
                           WHERE c.codi_emp = l.CODI_EMP_PLANO AND LEFT(TRIM(c.clas_cta), 5) = '11101'))
 ORDER BY l.data_lan, l.codi_lote, l.cdeb_lan, l.ccre_lan
