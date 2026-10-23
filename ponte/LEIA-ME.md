# Ponte do Domínio

Programa que roda **no PC do escritório** (ligado o tempo todo). Todo dia, num horário marcado, lê a cópia do banco
do Domínio (por ODBC, só leitura — a Domínio atualiza a cópia uma vez por dia, com os dados até o dia anterior),
soma **por empresa e por mês** e manda **só os totais** pro sistema.

**O que não sai deste PC:** nome, CPF e salário de funcionário, ou qualquer coisa além dos campos do contrato
(`ponte/fonte.py` e `ponte/pacote.py`). As consultas já devolvem contado; o que vier a mais é jogado fora antes de
montar o pacote. A senha do banco e as chaves nunca vão pra tela nem pro log.

## Montar o PC

1. **Python 3.11 ou mais novo**, com o lançador `py` (`py -0p` lista os instalados e os bits).
2. **pyodbc:** `py -3 -m pip install pyodbc`.
3. **O driver ODBC da Domínio** (SQL Anywhere), com **os mesmos bits do Python** — o `pyodbc` só enxerga driver
   do mesmo tamanho. O `conferir` mostra os dois.
4. **A configuração:** copie `ponte\config.exemplo.ini` pra `C:\ponte-dominio\config.ini` e preencha (a string de
   conexão que a Domínio passar, o endereço da função do sistema — sempre `https://` — e as duas chaves, cada valor
   numa linha só). Esse arquivo **nunca** entra no repositório. O `instalar.ps1` cria a partir do modelo, se ainda não existir, e o deixa legível só pelo seu usuário.

## Testar

Na pasta que tem a `ponte\` (a do repositório ou `C:\ponte-dominio\app`):

```
py -3 -m ponte conferir                         # não grava nem manda nada: Python, configuração, IP, drivers, conexão, sistema
py -3 -m ponte rodar --sem-enviar               # lê o Domínio e mostra o resumo, sem mandar
py -3 -m ponte rodar --sem-enviar --saida p.json   # e grava o pacote em C:\ponte-dominio\p.json pra olhar
py -3 -m ponte rodar --falso --sem-enviar       # o mesmo, com o Domínio de mentira (empresas inventadas)
```

`--meses N` muda quantos meses a rodada manda, contando o atual (padrão 3; até 24, pra carga inicial). O
`--falso` só manda pra um sistema de mentira (endereço local) — nunca empresa inventada pro sistema de verdade.

Código de saída do `rodar`: **0** mandou (ou não tinha o que mandar); **1** não conseguiu e guardou pra mandar na
próxima; **2** o sistema recusou ou a configuração não deixa rodar (repetir do mesmo jeito não adianta).

## Instalar a tarefa (todo dia, sozinha)

Num PowerShell **como administrador**, na pasta do repositório:

```
powershell -NoProfile -ExecutionPolicy Bypass -File ponte\instalar.ps1 -Hora 07:00
powershell -NoProfile -ExecutionPolicy Bypass -File ponte\instalar.ps1 -Remover
```

A tarefa "Ponte Domínio" roda a **cópia instalada** em `C:\ponte-dominio\app\ponte` — nunca a pasta do repositório,
que muda de branch. Pra atualizar a ponte, rode o `instalar.ps1` de novo — **o da pasta do repositório** (o da cópia
instalada se recusa: apagaria a própria pasta antes de copiá-la). O horário certo depende de quando a cópia da Domínio
atualiza. A pasta `C:\ponte-dominio` fica só pro seu usuário, o sistema e os administradores; o `config.ini`, só pro
seu usuário.

## Onde ficam as coisas

- `C:\ponte-dominio\config.ini` — a configuração.
- `C:\ponte-dominio\logs\` — um arquivo por dia (`AAAA-MM-DD.log`); os de mais de 60 dias são apagados sozinhos.
- `C:\ponte-dominio\pendentes\` — pacote que não foi (sistema fora, sem internet). A rodada seguinte manda antes,
  do mais velho pro mais novo, e apaga cada um que foi; pendente com mais de 30 dias é apagado com aviso no log.

## Quando chegar a documentação da Domínio

As consultas ficam em `ponte\consultas\` (`empresas.sql`, `folha.sql`, `fiscal.sql`, `contabil.sql`). Enquanto a
consulta tiver a linha `-- A CONFERIR`, ela não roda: o bloco vai pro `faltou` do pacote, e sem a de empresas a
rodada não manda nada. O que cada uma recebe e devolve está no começo de `ponte\fonte_dominio.py` (folha, fiscal e
contábil recebem o primeiro e o último dia do mês, nessa ordem, e devolvem **uma linha por empresa, já contada**).

1. Escreva os `.sql` e tire a linha `-- A CONFERIR`.
2. `py -3 -m ponte rodar --sem-enviar --saida conferencia.json` — o arquivo cai em `C:\ponte-dominio\` (o `--saida`
   sem pasta vai sempre pra lá) porque tem **nome e CNPJ dos clientes**: nunca o copie pra dentro do repositório, que
   é público.
3. **Confira 10 empresas à mão contra o Domínio** — funcionários, admissões, notas, valores, lançamentos — antes
   de ligar o envio. É o portão da fase 2 do plano: sem isso, não liga.
