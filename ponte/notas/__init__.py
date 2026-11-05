"""As notas de entrada das empresas autorizadas — a exceção ao "só os totais saem do PC" (03/11/2026).

Alguns clientes autorizaram o escritório a mandar as notas de compra deles (as NF-e de entrada) a um projeto de fora,
que compara preços. O sistema diz quais (a lista de `compartilhamentos`, pela função `ponte`); a ponte lê da Domínio
só essas, nota a nota, com os itens — os do XML guardado na Domínio, enquanto ela guarda (uns dois meses), senão os da
Domínio — e manda pro sistema, que confere de novo e entrega ao destino. Só NF-e de compra (modelo 55, de fornecedor),
só os itens com CFOP de compra, nunca dado de funcionário. O XML é lido só em código e nunca sai do PC.

    py -3 -m ponte notas rodar [--sem-enviar] [--saida arquivo.json] [--falso] [--tudo] [--empresa CODIGO]

e no fim do `py -3 -m ponte rodar` (a tarefa das 7h), no mesmo modo. O contrato: docs/FILA-CODE-2026-11-03-NOTAS-PONTE.md
e supabase/functions/ponte/notas.js. Leia ponte/LEIA-ME.md.
"""
VERSAO = '0.1.0'
