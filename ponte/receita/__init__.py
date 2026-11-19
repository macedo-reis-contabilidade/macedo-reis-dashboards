"""A ponte da Receita — o Integra Contador do Serpro, dentro da ponte do Domínio (23/10/2026).

Roda no mesmo PC, com a mesma pasta (C:\\ponte-dominio\\), o mesmo config.ini (seção [integra]), o mesmo log, os
mesmos pendentes e o mesmo envio pro sistema. Só CONSULTA: nada é transmitido à Receita.

    py -3 -m ponte receita conferir
    py -3 -m ponte receita rodar [--demonstracao | --falso] [--sem-enviar] [--saida arquivo.json]
                                 [--so autorizacao,pgdas,faturamento,caixa_postal,situacao_fiscal,pagamentos]
                                 [--empresas N]
    py -3 -m ponte receita relatorios

O que sai do PC: só os campos do contrato (pacote.py) — nunca o texto inteiro de uma mensagem ou dado de cliente além
do CNPJ — e, desde 09/11/2026 (pedido da Thalia com o ok do Samuel), o PDF do relatório de situação fiscal, que a
função do sistema salva na pasta da empresa no Drive (relatorios.py). O PDF da declaração do PGDAS fica no PC.
Leia ponte/LEIA-ME.md.
"""
VERSAO = '0.4.4'
# de quem é a procuração (19/11/2026, 0.4.4): todo pacote leva a lista `vias` — a procuração de cada empresa é a do CNPJ
# do escritório ou a do CPF do procurador —, tirada do estado.json, sem consulta nenhuma ao Serpro
# pagamentos (19/11/2026, 0.4.0): as guias pagas (PAGTOWEB · PAGAMENTOS71), uma vez por mês por empresa; na 0.4.1
# (o mesmo dia), o cenário da demonstração que o trial aceita, o tipo da guia como a documentação mostra e a contagem
# da Receita conferindo a resposta que veio em páginas
SERVICOS = ('autorizacao', 'pgdas', 'faturamento', 'caixa_postal', 'situacao_fiscal', 'pagamentos')
