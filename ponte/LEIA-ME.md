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
   conexão que a Domínio passar, o endereço da função do sistema — sempre `https://`, a função `ponte`, a mesma das
   duas pontes: `https://exemplo.supabase.co/functions/v1/ponte` no exemplo, com o endereço do projeto no lugar do
   `exemplo` — e a chave pública, cada valor numa linha só). Esse arquivo **nunca** entra no repositório. O
   `instalar.ps1` cria a partir do modelo, se ainda não existir, e o deixa legível só pelo seu usuário.
5. **A chave da ponte nasce aqui:** `py -3 -m ponte chave` gera a chave (o segredo que vai no cabeçalho `x-chave`),
   grava no `chave_ponte` do `config.ini` — só se ele estiver vazio ou ainda for o do exemplo — e mostra só a
   **impressão digital** (o SHA-256 dela, 64 letras e números). **Mande a impressão pro Claude da sessão do Samuel**:
   ela não é segredo, e é o que o sistema guarda e confere. A chave mesmo nunca sai do PC (nem tela, nem log, nem
   pacote). `py -3 -m ponte chave --trocar` troca a que existe (pede um "s"; a antiga para de valer até a impressão
   nova ser cadastrada). Até a impressão ser cadastrada, o sistema responde **503** "A chave da ponte ainda não foi
   cadastrada no sistema."; com a chave errada, **401** "Chave da ponte recusada." — o `receita conferir` mostra a
   mensagem como veio.

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

---

# Ponte da Receita (Integra Contador)

Módulo da mesma ponte (`ponte\receita\`), no mesmo PC, com a mesma pasta, o mesmo `config.ini` (seção `[integra]`),
o mesmo log, os mesmos pendentes e o mesmo envio pro sistema. Fala com o **Integra Contador do Serpro**, a API da
Receita: o que hoje se olha logado no e-CAC, sem tela. **Só consulta** — nada é transmitido à Receita.

A lista de empresas vem do sistema (`{"versao": 1, "tipo": "receita", "pedir": "empresas"}` → documento e regime de
cada uma). Sem ela, a rodada não consulta nada e sai com 1 (com a chave recusada, 2).

## O que ela consulta, e quando

Cada consulta tem os seus **dias marcados** e roda **a partir do dia**: no dia marcado ou na primeira rodada depois
dele, se aquela consulta daquela empresa ainda não foi feita desde o dia marcado (o `estado.json` guarda o dia de cada
uma). Com o PC desligado o dia inteiro, a consulta do mês não fica pra trás — roda no dia seguinte. A empresa nunca
consultada (a primeira rodada, a empresa nova na carteira) roda logo. Consulta "feita" é a que o Serpro respondeu,
mesmo que recusando; o teto e o Serpro fora deixam pra próxima rodada.

| Consulta | No pacote | Dias marcados (a tarefa roda de segunda a sexta) |
|---|---|---|
| A procuração do cliente pro escritório | `autorizacao`: `ativa`, `vencida` ou `sem`, e até quando | o primeiro dia útil do mês e, pra quem estava sem (ou vencida), toda segunda-feira — o cliente autoriza e o escritório vê na mesma semana |
| As declarações do PGDAS-D do ano | `pgdas`: cada mês declarado, quando, e se o DAS foi pago | Simples: o primeiro dia útil **depois** do prazo do mês anterior (o prazo é o dia 20 ou, sem expediente, o próximo dia útil — com os feriados nacionais, o 20/09, o Carnaval, a Sexta-feira Santa e o Corpus Christi) e, só pra quem ainda tem mês sem declaração, o último dia útil do mês; em janeiro, o ano anterior também. Ex.: 10/2026 — prazo segunda, 23/11 (o 20/11 é feriado) → consulta terça, 24/11. No próprio dia do prazo não consulta: o vigia do sistema avisaria "PGDAS não transmitido" pra quem transmite naquele dia |
| A última declaração de um mês (o PDF) | `faturamento`: a receita do mês (RPA) e a dos 12 meses (RBT12), com os centavos | Simples: toda rodada confere, sem custo, se há declaração a ler — o mês novo (ou retificado) que o PGDAS mostrou; uma por rodada, a mais antiga primeiro (nenhum mês fica pra trás quando o de antes não veio); na primeira vez, só a do mês mais recente. A que o Serpro respondeu sem a receita (o PDF ilegível, a recusa) volta só no dia do PGDAS |
| A Caixa Postal | `caixa_postal`: id, assunto, data, origem (Receita, Estado, Município) e se foi lida | todo dia útil: o "quem teve novidade" em lote (até 1.000 CNPJs por pedido, o CNPJ com letras também) e as mensagens só de quem teve — o evento é só o dia da última novidade, então no dia seguinte a uma leitura, com o mesmo dia, lê de novo uma vez (a mensagem que chegou depois da rodada); as 100 mais recentes por empresa; na primeira leitura de uma empresa, só as dos últimos 90 dias (as antigas ficam no e-CAC); a já mandada não vai de novo, salvo a mandada como não lida que depois aparece lida |
| A situação fiscal (o relatório em PDF) | `situacao_fiscal`: o título de cada pendência e o órgão (Receita ou PGFN); sem pendência = lista vazia | o dia 5 (ou o próximo dia útil) |

Sem procuração (ou vencida), as outras consultas da empresa nem são feitas: vão pro `faltou` como `sem_autorizacao`.
O `faltou` diz também o que parou no `teto`, o que deu `erro` e o que ficou `a_conferir` — o PDF que a ponte não
conseguiu ler: o bloco **não vai** no pacote (nada de `null` que no sistema viraria "sem pendência" ou apagaria o
faturamento do mês; nunca um número inventado), só o `faltou`, e o PDF fica guardado. A lista de pendências maior que
100 vai cortada nas 100 primeiras, com o aviso no log.

**O que o sistema responde:** `"gravado": true` (do ambiente de demonstração e do `--falso`, `false`: nada gravado),
quantas empresas e as `recusadas` — o bloco de uma empresa que saiu do contrato fica de fora sozinho (o resto é
gravado) e volta na lista; a ponte anota no log o CNPJ, o campo e o erro (nunca o valor) e **não reenvia** aquele bloco
(o mesmo dado voltaria fora). O pacote inteiro só é recusado (422) pelo que é da rodada (versão, tipo, a rodada, as
listas grandes demais). O 503 da chave não cadastrada não é tentado de novo: o pacote fica em pendentes até a
impressão digital ser cadastrada.

**O que sai do PC:** só os campos do contrato (`ponte\receita\pacote.py`); o que vier a mais do Serpro é jogado fora
antes de montar o pacote. **Não sai:** o PDF (nem em base64), o texto das mensagens, as chaves, a senha do
certificado, os tokens. No log, das mensagens só quantas — nunca o assunto.

## Montar

1. **As bibliotecas:** `py -3 -m pip install cryptography pypdf` (o certificado e o texto dos PDFs).
2. **O contrato do Integra Contador** (Loja do Serpro): a `consumer_key` e a `consumer_secret` ficam na Área do
   Cliente. Cada cliente autoriza o escritório no e-CAC (procuração eletrônica pro CNPJ do escritório).
3. **O certificado A1 do escritório** (`.pfx`, o mesmo do e-CAC): guarde dentro de `C:\ponte-dominio\` (só o seu
   usuário, o sistema e os administradores leem essa pasta).
4. **A `[integra]` do `config.ini`:** o `instalar.ps1 -Receita` pergunta o que falta numa janela — as chaves e a
   senha sem aparecer na tela, o caminho do `.pfx` em texto — e grava direto no `config.ini`. **Nada disso passa por
   chat, e-mail, tela ou log.** O `ambiente` fica `demonstracao` até a conferência das 5 empresas (abaixo); o
   `teto_mes` (padrão 1.500) é o máximo de chamadas ao Serpro no mês — chegou, a rodada para e o resto vai pro
   `faltou` como `teto` (o contrato cobra por consulta).

## Testar

```
py -3 -m ponte chave                                              # gera a chave da ponte e mostra a impressão digital
py -3 -m ponte receita conferir                                   # não grava nem manda nada
py -3 -m ponte receita rodar --demonstracao --sem-enviar --so autorizacao,pgdas,faturamento,caixa_postal,situacao_fiscal --saida demo.json
py -3 -m ponte receita rodar --falso --sem-enviar                 # o Serpro de mentira dos testes (da pasta do repositório)
```

- O **`conferir`** mostra se o `cryptography` e o `pypdf` estão instalados, cada campo da `[integra]` ("preenchido",
  "falta", "ainda é o do exemplo" ou "inválido" — nunca o valor), a **impressão digital da chave da ponte**, o
  **titular do certificado e quantos dias faltam pra vencer** (vencido ou a menos de 30 dias, em destaque), se o
  certificado do Serpro confere, o token (em produção, pede um e diz "ok" ou o erro; em demonstração,
  "demonstração") e o ping do sistema, com a mensagem da função como veio (o 503 e o 401 da chave).
- O **`--demonstracao`** usa o ambiente de demonstração do Serpro: respostas fixas de exemplo, sem certificado, sem
  contrato e sem custo — só o `cnpj_escritorio` é exigido (o do exemplo serve). Não conta no teto, não lembra nada no
  `estado.json` e só manda pra um sistema de mentira (use `--sem-enviar`).
- `--so servico,servico` roda esses agora, fora do calendário; `--empresas N`, só as N primeiras da lista;
  `--saida arquivo.json` grava o pacote (sem pasta, em `C:\ponte-dominio\` — **tem CNPJ e dado dos clientes**: nunca
  dentro do repositório).
- Código de saída, como o do Domínio: **0** mandou (ou nada a mandar); **1** não conseguiu (a lista de empresas não
  veio, ou o envio falhou e o pacote ficou em pendentes); **2** configuração ou recusa (repetir não adianta).

## O primeiro uso (com o contrato)

1. `py -3 -m ponte receita conferir` — tudo "preenchido", o certificado em dia e "Token: ok".
2. Com o `ambiente = producao` no `config.ini`:
   `py -3 -m ponte receita rodar --so autorizacao,pgdas,faturamento,situacao_fiscal --empresas 5 --sem-enviar --saida conferencia.json`
3. **O Samuel confere as 5 empresas no e-CAC** (procuração, meses declarados, DAS pago, a receita do mês e dos 12
   meses, as pendências) contra o `C:\ponte-dominio\conferencia.json`. Sem isso, não liga.
4. Liga: `powershell -NoProfile -ExecutionPolicy Bypass -File ponte\instalar.ps1 -Receita` (como administrador) —
   a tarefa **"Ponte Receita"**, de segunda a sexta às 08:30 (`-Hora` muda). `-Remover -Receita` tira só ela. Com o
   `chave_ponte` ainda vazio (ou o do exemplo), ele roda o `py -3 -m ponte chave` no fim e mostra a impressão digital:
   mande-a pro Claude da sessão do Samuel.

## Onde ficam as coisas

- `C:\ponte-dominio\receita\estado.json` — o que já foi consultado e mandado: a última procuração de cada empresa, os
  meses declarados, a declaração já lida de cada mês, a última novidade da Caixa Postal, as mensagens já mandadas e o
  dia da última consulta da procuração, do PGDAS e da situação fiscal (o "a partir do dia").
  Só é gravado quando o pacote foi (ou ficou em pendentes) — um envio recusado não perde nada.
- `C:\ponte-dominio\receita\chamadas-AAAA-MM.json` — as chamadas ao Serpro no mês, por serviço (o teto).
- `C:\ponte-dominio\receita\pdfs\` — os PDFs da declaração e da situação fiscal, apagados depois de 30 dias. Nunca no
  repositório, nunca no pacote.
- Os logs e os pendentes são os mesmos da ponte do Domínio.

## O certificado do Serpro

O servidor do Serpro não manda o certificado intermediário dele; o Windows acha sozinho, o Python não. Ele vai junto,
em `ponte\receita\ac-serpro-2025.pem` (público, emitido pela GlobalSign). Se o `conferir` disser que **o Python não
reconheceu o certificado do Serpro**, o Serpro trocou de intermediário: no navegador, abra
`https://gateway.apiserpro.serpro.gov.br`, veja o certificado (cadeado › Detalhes) e baixe o da autoridade
intermediária (o endereço "Emissor da AC" do certificado do servidor); converta pra PEM
(`certutil -encode intermediario.crt novo.pem`), troque o conteúdo do `ac-serpro-2025.pem` por ele e rode o
`instalar.ps1` de novo. Nunca desligue a conferência do certificado. Na rodada, o certificado que não confere não é
tratado como o Serpro fora: ela para na hora com o código 2 e o log diz o mesmo recado (sem isso, ela mandaria todo dia
um pacote só de "erro" e sairia com 0).
