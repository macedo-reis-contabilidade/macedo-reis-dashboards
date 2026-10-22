"""Ponte do Domínio — roda no PC do escritório, que fica ligado o tempo todo.

Todo dia, num horário marcado, lê a cópia do banco do Domínio (por ODBC, só leitura), soma por empresa e por mês e
manda só os totais pro sistema. Nome, CPF e salário de funcionário nunca saem deste PC: as consultas já devolvem
contado, e o que vier além dos campos do contrato é descartado antes de montar o pacote.

    py -3 -m ponte conferir
    py -3 -m ponte rodar [--falso] [--sem-enviar] [--saida arquivo.json] [--meses N]

Leia ponte/LEIA-ME.md.
"""
VERSAO = '0.1.0'
