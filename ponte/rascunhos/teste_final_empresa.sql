-- teste_final_empresa.sql (rascunho da fila de 24/11/2026, a versão final do teste do fechamento; a ponte NÃO lê): o
-- documento da empresa do teste no cadastro do Domínio, pra o teste_final.py achar o arquivo das guias pagas do
-- Integra (C:\ponte-dominio\receita\pagamentos\<CNPJ>.json). O código da empresa (do empresa.txt) entra no lugar do
-- marcador do corpo na hora de rodar, sem os comentários. A saída fica só no PC e não aparece na tela nem em lugar
-- nenhum fora dele.
-- Tabela: bethadba.geempre (cgce_emp, o documento, char(14); tins_emp, o tipo: 1 CNPJ — a regra do
-- ponte/consultas/empresas.sql).
SELECT NULLIF(TRIM(e.cgce_emp), '') AS documento, e.tins_emp AS tipo_documento
  FROM bethadba.geempre e
 WHERE e.codi_emp = {EMPRESA}
