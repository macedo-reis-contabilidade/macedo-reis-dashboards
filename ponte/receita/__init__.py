"""A ponte da Receita — o Integra Contador do Serpro, dentro da ponte do Domínio (23/10/2026).

Roda no mesmo PC, com a mesma pasta (C:\\ponte-dominio\\), o mesmo config.ini (seção [integra]), o mesmo log, os
mesmos pendentes e o mesmo envio pro sistema. Só CONSULTA: nada é transmitido à Receita.

    py -3 -m ponte receita conferir
    py -3 -m ponte receita rodar [--demonstracao | --falso] [--sem-enviar] [--saida arquivo.json]
                                 [--so autorizacao,pgdas,faturamento,caixa_postal,situacao_fiscal] [--empresas N]
    py -3 -m ponte receita relatorios

O que sai do PC: só os campos do contrato (pacote.py) — nunca o texto inteiro de uma mensagem ou dado de cliente além
do CNPJ — e, desde 09/11/2026 (pedido da Thalia com o ok do Samuel), o PDF do relatório de situação fiscal, que a
função do sistema salva na pasta da empresa no Drive (relatorios.py). O PDF da declaração do PGDAS fica no PC.
Leia ponte/LEIA-ME.md.
"""
VERSAO = '0.3.0'
SERVICOS = ('autorizacao', 'pgdas', 'faturamento', 'caixa_postal', 'situacao_fiscal')
