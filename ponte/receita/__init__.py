"""A ponte da Receita — o Integra Contador do Serpro, dentro da ponte do Domínio (23/10/2026).

Roda no mesmo PC, com a mesma pasta (C:\\ponte-dominio\\), o mesmo config.ini (seção [integra]), o mesmo log, os
mesmos pendentes e o mesmo envio pro sistema. Só CONSULTA: nada é transmitido à Receita.

    py -3 -m ponte receita conferir
    py -3 -m ponte receita rodar [--demonstracao | --falso] [--sem-enviar] [--saida arquivo.json]
                                 [--so autorizacao,pgdas,faturamento,caixa_postal,situacao_fiscal] [--empresas N]

O que sai do PC: só os campos do contrato (pacote.py) — nunca o PDF, o texto inteiro de uma mensagem ou dado de
cliente além do CNPJ. Leia ponte/LEIA-ME.md.
"""
VERSAO = '0.2.0'
SERVICOS = ('autorizacao', 'pgdas', 'faturamento', 'caixa_postal', 'situacao_fiscal')
