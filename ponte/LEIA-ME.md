# Ponte do Domínio

Programa que roda **no PC do escritório** (ligado o tempo todo). Todo dia, num horário marcado, lê o banco do
Domínio Web (por ODBC, só leitura — o de produção, ao vivo: o plano esperava uma cópia do dia anterior, e em
02/11/2026 o banco mostrou as notas e os lançamentos do próprio dia), soma **por empresa e por mês** e manda **só os
totais** pro sistema.

**O que não sai deste PC:** nome, CPF e salário de funcionário, ou qualquer coisa além dos campos do contrato
(`ponte/fonte.py` e `ponte/pacote.py`). As consultas já devolvem contado; o que vier a mais é jogado fora antes de
montar o pacote. A folha em reais (desde a versão 2 do pacote, 05/11/2026) sai **somada por empresa e mês**, nunca
por pessoa. A senha do banco e as chaves nunca vão pra tela nem pro log.

## Montar o PC

1. **Python 3.11 ou mais novo**, com o lançador `py` (`py -0p` lista os instalados e os bits).
2. **pyodbc:** `py -3 -m pip install pyodbc`.
3. **O driver ODBC do banco do Domínio: o SQL Anywhere 17**, com **os mesmos bits do Python** — o `pyodbc` só enxerga
   driver do mesmo tamanho; o `conferir` mostra os dois. É o "client" da SAP, de graça:
   `https://d5d4ifzqzkhwt.cloudfront.net/sqla17client/SQLA17_Windows_Client.exe` (antes de abrir, confira que o
   arquivo é assinado pela SAP: `Get-AuthenticodeSignature arquivo.exe`). O instalador pede o administrador; a opção
   "Typical" põe os drivers de 32 e de 64 bits. O nome que aparece no `conferir` é `SQL Anywhere 17`.
4. **A configuração:** copie `ponte\config.exemplo.ini` pra `C:\ponte-dominio\config.ini` e preencha o endereço da
   função do sistema — sempre `https://`, a função `ponte`, a mesma das duas pontes:
   `https://exemplo.supabase.co/functions/v1/ponte` no exemplo, com o endereço do projeto no lugar do `exemplo` — e a
   chave pública, cada valor numa linha só. Esse arquivo **nunca** entra no repositório. O `instalar.ps1` cria a
   partir do modelo, se ainda não existir, e o deixa legível só pelo seu usuário. A conexão com o Domínio não se
   digita no arquivo: é o `py -3 -m ponte dominio conexao` (abaixo, "A ligação com o Domínio Web").
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

O `conferir` testa a conexão com o Domínio (é uma tentativa de login, como a janela do `dominio conexao`) e termina em
"Tudo certo na configuração." só quando ela abriu ou não deu pra testar; com a conexão recusada, diz que ela não abriu
e sai com 1.

Código de saída do `rodar`: **0** mandou (ou não tinha o que mandar); **1** não conseguiu e guardou pra mandar na
próxima; **2** o sistema recusou ou a configuração não deixa rodar (repetir do mesmo jeito não adianta).

## Instalar a tarefa (todo dia, sozinha)

Num PowerShell **como administrador**, na pasta do repositório:

```
powershell -NoProfile -ExecutionPolicy Bypass -File ponte\instalar.ps1 -Hora 07:00
powershell -NoProfile -ExecutionPolicy Bypass -File ponte\instalar.ps1 -Remover
```

A tarefa "Ponte Domínio" roda `py -3 -m ponte rodar --meses 14` (o mês de hoje, o passado e os 12 de antes, que a
precificação usa — lidos de novo todo dia, pra nota e lançamento que entram atrasados chegarem ao sistema) na **cópia
instalada** em `C:\ponte-dominio\app\ponte` — nunca a pasta do repositório,
que muda de branch. Pra atualizar a ponte, rode o `instalar.ps1` de novo — **o da pasta do repositório** (o da cópia
instalada se recusa: apagaria a própria pasta antes de copiá-la). Com o banco ao vivo, o horário não depende de cópia:
às 07:00 o dia anterior já está inteiro (o `dados_ate` do pacote é o dia da rodada). A pasta `C:\ponte-dominio` fica só pro seu usuário, o sistema e os administradores; o `config.ini`, só pro
seu usuário.

## Onde ficam as coisas

- `C:\ponte-dominio\config.ini` — a configuração.
- `C:\ponte-dominio\logs\` — um arquivo por dia (`AAAA-MM-DD.log`); os de mais de 60 dias são apagados sozinhos.
- `C:\ponte-dominio\pendentes\` — pacote que não foi (sistema fora, sem internet). A rodada seguinte manda antes,
  do mais velho pro mais novo, e apaga cada um que foi; pendente com mais de 30 dias é apagado com aviso no log.
- `C:\ponte-dominio\notas\estado.json` — o que a ponte das notas já mandou (abaixo, "As notas de compra").

## A ligação com o Domínio Web (29/10/2026)

A Domínio liberou o banco do Domínio Web pro **IP fixo do escritório** (de outro lugar não conecta) e mandou, no
chamado, onde ele fica: **Host, Porta, Engine** (o nome do servidor) **e Banco**. O usuário é o **externo**, criado no
próprio Domínio com um usuário GERENTE: *Controle › Permissões › Usuários › Novo › Tipo de acesso: Externo* — só de
leitura. A senha dele não passa por chat: é digitada só na janela do `dominio conexao`.

```
py -3 -m ponte dominio conexao --esperar     # numa janela que aceita digitação (abaixo): pergunta, grava e testa
py -3 -m ponte dominio tabelas               # o catálogo: C:\ponte-dominio\dominio-tabelas.txt
py -3 -m ponte dominio tabelas --procurar "nota saida"     # as tabelas e colunas com essas palavras no nome ou na descrição
py -3 -m ponte dominio sql "SELECT stat_emp, COUNT(*) AS quantas FROM bethadba.geempre GROUP BY stat_emp"
py -3 -m ponte dominio sql --arquivo ponte\consultas\folha.sql --mes 2026-09
```

- **`conexao`** pergunta o host (pode colar "endereço:porta" de uma vez), a porta, o Engine, o Banco, o usuário e a
  senha (duas vezes, um `*` por letra: o Backspace apaga, colar com o botão direito ou o Ctrl+V vale); monta a conexão com o driver `SQL Anywhere` que o Python enxerga e grava só a
  linha `conexao` da `[dominio]` do `config.ini`; testa na hora (a versão do servidor e quantas tabelas o usuário vê) e
  anota no log o resultado — **nunca os valores**. A senha: letras, números e símbolos comuns, sem `;` `{` `}`, aspas
  ou acento (quebram a conexão). Antes de testar, a janela mostra como é a senha digitada — "12 caracteres: 2 letras
  maiúsculas, 6 letras minúsculas e 4 números", nunca ela — pra conferir com a do Domínio: a senha do banco diferencia maiúscula de
  minúscula, e com o Caps Lock trocado elas aparecem invertidas ali; `n` digita de novo, Enter testa. Só pergunta numa
  janela que aceita digitação; pelo terminal do pedreiro, ele abre uma pro Samuel: `Start-Process py -ArgumentList
  '-3','-m','ponte','dominio','conexao','--esperar' -WorkingDirectory <a pasta do repositório> -Wait`. Rodado de novo
  com a conexão gravada, Enter só testa; `s` troca — e aí o Enter mantém o host, a porta, o Engine, o Banco e o usuário
  gravados (aparecem entre colchetes; a senha é sempre perguntada): trocar só o usuário e a senha não pede de novo os
  dados do chamado (02/11/2026). Na conferência da senha, só Enter (testa) ou `n` (digita de novo): o que se digita ali
  aparece na tela.
- **Usuário ou senha recusados** (`Invalid user ID or password`, -103 — o caso de 30/10 a 02/11/2026): o servidor e o
  banco do chamado estão certos (senão o erro seria "server not found" ou "database not found"); o que não bateu foi o
  par usuário + senha naquele banco, e o -103 não diz o porquê. **Cada teste é uma tentativa de login** — o `conferir`,
  o `dominio conexao` e o `dominio tabelas` —, e o usuário bloqueado por tentativas erradas responde com o mesmo erro,
  até com a senha certa: um teste por vez, nunca seguidos. Usuário ou senha novos no Domínio podem levar até o horário
  seguinte de atualização do banco (quem integra com o Domínio Web fala em 10h, 12h, 16h e 19h, ou 24 horas): teste
  com folga depois dele. Persistindo: um usuário externo novo (não herda bloqueio), com uma senha simples de digitar, e
  o chamado da Domínio — só eles veem no servidor se o usuário existe naquele banco e se está bloqueado. O campo de senha
  do Domínio mostra sempre a mesma quantidade de asteriscos, qualquer que seja o tamanho da senha: não serve pra
  conferir a senha. No caso de 29/10 a 02/11, o artigo de suporte da Domínio fala da conexão direta com o usuário
  externo no Domínio **instalado**; no Domínio Web, se o usuário criado na tela chega ao banco liberado pro IP do
  escritório é a pergunta do chamado.
- **`tabelas`** lê **só o catálogo** do banco (as tabelas `SYS`): os nomes das tabelas e das colunas, o tipo, a descrição
  que o banco guarda e quantas linhas cada tabela tem — **nenhuma linha das tabelas do Domínio**. É o "Busca Tabelas"
  do Domínio, sem precisar dele nem do Java. O arquivo fica na pasta da ponte, nunca no repositório (é a documentação
  da Thomson Reuters).
- **`sql`** roda **uma** consulta só de leitura (SELECT ou WITH) e mostra até 50 linhas (`--linhas` até 500), com o
  tempo que levou; `--mes AAAA-MM` passa o primeiro e o último dia do mês nos dois `?`, como a rodada. **Só contagem e
  soma por empresa**: nome, CPF, salário, endereço e contato de funcionário não saem do Domínio, nem pra tela. A trava
  (pra engano): resultado com coluna de nome, documento pessoal, salário, nascimento, endereço ou contato não é
  mostrado — as linhas nem são lidas. O nome das empresas sai pelo `rodar --sem-enviar --saida`.
- O texto (o nome da empresa, as descrições) vem do driver já convertido (UTF-16), com os acentos certos; o driver
  que não aceitar a conexão em modo só leitura é aberto sem ele (o usuário externo já é só de leitura), e o que não
  aceitar o tempo-limite de 10 minutos por consulta (`TEMPO_CONSULTA`) também — o do SQL Anywhere 17 recusa os dois
  ("Driver not capable", HYC00, visto em 02/11/2026, com o login já feito), e aí o limite é o da tarefa do Agendador.

## Escrever as consultas

**As quatro estão prontas desde 02/11/2026** (a fila de 29/10; as tabelas, as regras, os números de conferência e o
que a equipe confirma estão em `docs/FILA-CODE-2026-10-29-DUVIDAS.md`). Cada uma roda em 1 a 3 segundos. Duas regras
que não estavam no plano: a nota com mais de um acumulador ou CFOP fica em várias linhas no Domínio (os segmentos, cada
um com a sua parte do valor) — conta uma vez e soma as linhas —; e a folha só entra pra empresa ativa no Domínio ou
com a folha mensal calculada no mês (sem o corte, 261 empregados sem rescisão, de 37 empresas que saíram do
escritório, contariam como ativos todo mês). O `valor_saidas` é o valor contábil de tudo que saiu (devolução, remessa,
transferência, bonificação), não o faturamento. Mudou uma consulta: `py -3 tests/ponte.test.py` confere que ela
segue com o comentário no começo, as colunas do contrato e os parâmetros.

**O faturamento, as compras e a folha em reais** (a versão 2 do pacote, 05/11/2026): `faturamento.sql`,
`compras.sql` e `folha_valores.sql`, as que a fila de 03/11 escreveu e conferiu dentro do próprio Domínio (as tabelas,
as regras e os números do escritório inteiro em `docs/FILA-CODE-2026-11-03-DUVIDAS.md`; 3 a 5 segundos cada). O
faturamento é a receita bruta pelos acumuladores de faturamento menos a devolução (bateu com a apuração do Simples em
71 de 71 empresas, pela linha de cada estabelecimento) e, de quem apura o Simples, a apuração com as filiais, o RBT12
(calculado: a receita anterior informada, senão a apuração; com menos de 12 meses, a média vezes 12), a parte com ST,
a monofásica, a exportação e cada anexo; as compras, pelo CFOP; a folha em reais, os proventos (só o rateio 0: o
rateio por serviço repete o cálculo), o 13º, o pró-labore, as bases e as guias do FGTS e do INSS. A versão 2 diz ao
sistema que esses três blocos foram lidos; a versão 1 (a ponte antiga) não mexe neles lá.

**O andamento das contabilidades** (a versão 3 do pacote, 05/11/2026, ponte 0.3.0): as consultas que a fila de 04/11
escreveu e conferiu no Domínio (o plano de contas, as origens, o extrato e os números do escritório inteiro em
`docs/FILA-CODE-2026-11-04-CONTABIL-DUVIDAS.md`). Por mês: `origens.sql` (os lançamentos por origem — o do contador, o
extrato importado, a escrita fiscal, a folha, a apuração — e o dia em que o último entrou), `cruzamentos.sql` (a
receita, a folha e os encargos lançados, pra cruzar com o faturamento e a folha) e `saldos.sql` (o caixa negativo, as
contas contra a natureza e as transitórias com saldo no último dia do mês; 7 segundos por mês, a parte cara). Uma vez
por rodada: `andamento.sql` (a foto do dia: até onde o banco, o extrato e o caixa estão lançados e a data do
fechamento dos parâmetros; uns 19 segundos) e `encerramento.sql` (o zeramento de cada um dos dois anos antes do de
hoje). O caixa e os bancos saem pela classificação do plano modelo (1.1.1.01 e 1.1.1.02); a descrição das contas só
entra em filtro, nunca sai. A rodada de 14 meses fica uns 3 minutos mais longa.

**Os cruzamentos corrigidos** (06/11/2026, ponte 0.3.2; o pacote segue na versão 3): o `cruzamentos.sql` passou a
seguir o que a fila de 05/11 achou no Domínio (as causas contadas em
`docs/FILA-CODE-2026-11-05-DIFERENCAS-DUVIDAS.md`). No plano em que a receita fica no grupo 3 e a despesa no 4 (pela
natureza dos grupos), a receita, a devolução, a folha e os encargos saem dos grupos certos; a receita da escrita fiscal
conta na empresa da nota (a filial integrada no contábil da matriz); e a folha integrada conta na competência dela (a
rescisão paga no mês seguinte, as férias integradas noutro mês). De 10/2025 a 09/2026, dos 136 meses-empresa com a
receita lançada diferente do faturamento, 14 deixam de diferir; dos 69 com a folha lançada diferente da calculada, 11
deixam e 3 passam. O que continua diferente é problema da contabilidade (a nota sem lançamento, a devolução fora da
conta, o lançamento manual). De 3,8 a 4,8 segundos por mês (antes, 1,6): a rodada de 14 meses fica uns 40 segundos
mais longa.

As consultas ficam em `ponte\consultas\` (`empresas.sql`, `folha.sql`, `fiscal.sql`, `contabil.sql`,
`faturamento.sql`, `compras.sql`, `folha_valores.sql`, `origens.sql`, `cruzamentos.sql`, `saldos.sql`, `andamento.sql`,
`encerramento.sql`). Enquanto a
consulta tiver a linha `-- A CONFERIR`, ela não roda: o bloco vai pro `faltou` do pacote, e sem a de empresas a
rodada não manda nada. O que cada uma recebe e devolve está no começo de `ponte\fonte_dominio.py` (as do mês recebem
o primeiro e o último dia do mês, nessa ordem, e devolvem **uma linha por empresa, já contada**; o `andamento.sql`, os
do mês de hoje; o `encerramento.sql`, o 1º de janeiro e o 31 de dezembro do ano).

1. Ache as tabelas com o `dominio tabelas` e entenda os dados com o `dominio sql` (contagens, mínimos e máximos de
   datas, os valores de um campo de situação com `GROUP BY`).
2. Escreva os `.sql` e tire a linha `-- A CONFERIR`. O documento (CNPJ/CPF) sai como texto, com os zeros da frente:
   guardado como número no banco, `CAST(... AS VARCHAR(20))` e os zeros de volta.
3. `py -3 -m ponte rodar --sem-enviar --saida conferencia.json` — o arquivo cai em `C:\ponte-dominio\` (o `--saida`
   sem pasta vai sempre pra lá) porque tem **nome e CNPJ dos clientes**: nunca o copie pra dentro do repositório, que
   é público.
4. **A conferência é pelo sistema** (decisão do Samuel, 02/11/2026: sem conferência à mão): o que o Domínio diz é
   cruzado com o que o sistema já sabe por outro caminho, e só o que não bate vai pra uma pessoa. A função `ponte`
   grava os totais do Domínio desde 02/11/2026 (`dominio_empresas`, `dominio_mensal`, `dominio_rodadas`).

## As notas de compra das empresas autorizadas (03/11/2026)

A exceção ao "só os totais saem do PC" (`ponte\notas\`, a fila `docs/FILA-CODE-2026-11-03-NOTAS-PONTE.md`). Alguns
clientes autorizaram o escritório a mandar as notas de compra deles a um projeto de fora, que compara preços. **O que
sai**, só destas condições: só as empresas que a função `ponte` diz que estão autorizadas (a lista,
`{"tipo": "notas", "pedir": "autorizadas"}`), só NF-e de compra (modelo 55, emitida por fornecedor, fora a cancelada,
denegada e inutilizada), só os itens com CFOP de compra (o `CFOPS_DE_COMPRA` de `supabase/functions/ponte/notas.js`,
que o teste confere igual ao da ponte), nunca dado de funcionário. Fica de fora a nota de emitente pessoa física, a de
outro destinatário, a do XML com finalidade que não é a normal, a sem item de compra e a do CFOP incerto. O código do
produto no cadastro do cliente não vai.

**De onde sai cada nota**: do XML guardado na Domínio (`EFATENDIMENTO_NFE_XML_V2`, o texto do `nfeProc`, sem
compactar), quando ele existe, abre e é desta nota (a chave do `infNFe` e o `cStat` 100 ou 150) — os itens dele, com o
CFOP de entrada do mesmo item na Domínio —; senão, das linhas da Domínio (`efmvepro`, com a descrição e o código
de barras do cadastro de produtos, e o IPI do item só quando a soma bate com o da nota). **O XML é lido só em código e
nunca sai do PC**: no pacote vão só os campos do contrato. A Domínio apaga o XML uns dois meses depois — por isso a
rodada é diária.

**O mesmo item na Domínio** (a revisão de 05/11/2026): o do mesmo número, se a quantidade e o valor batem; senão, o
único com a mesma quantidade e o mesmo valor; senão, o CFOP da nota, quando ela tem um só (o log conta o item sem
par); senão, a nota fica de fora ("CFOP da nota incerto"). Pelo número sozinho, a Domínio numerada em outra ordem
mandaria o brinde como compra. As conferências do item (sem descrição ou quantidade) olham só os itens de compra, e o
nome do fornecedor sai sem o CPF que o MEI antigo tem no nome.

**Quando**: no fim do `py -3 -m ponte rodar` (a tarefa das 7h), no mesmo modo (`--sem-enviar`, `--falso`) — um erro
nela vai pro log e não muda o que a rodada dos totais fez nem o código de saída dela —, ou sozinha:

    py -3 -m ponte notas rodar [--sem-enviar] [--saida arquivo.json] [--falso] [--tudo] [--empresa CODIGO]

- `--sem-enviar` pede a lista, lê e conta (todas as autorizadas, também as que não estão prontas) e não manda nem grava
  o estado; sem ele, só as `pronta` (o destino delas configurado no sistema);
- `--saida` grava os pacotes em `C:\ponte-dominio\` (sem pasta, lá) — **tem dado de cliente: não abra na conversa e
  nunca copie pro repositório**;
- `--tudo` lê desde a data da autorização; sem ele, na primeira vez da empresa e aos domingos também, e nos outros dias
  do dia 1º do mês de três meses atrás até hoje (a nota que entra atrasada e o XML, que a Domínio guarda uns dois meses);
- `--empresa` só a empresa daquele código do Domínio, se estiver na lista; `--falso` a Domínio de mentira (só manda pra
  um sistema de mentira, endereço local).

A empresa só é lida se o documento do cadastro do sistema for o `cgce_emp` dela na Domínio (`notas_empresa.sql`). As
consultas: `notas_itens.sql` (uma linha por item) e `notas_xml.sql` (o XML), as duas com o código da empresa e o
período. Na empresa do teste, 14 meses levaram uns 3 minutos (o XML de um mês, uns 20 s: o catálogo das notas e o
conteúdo de cada XML, que o ODBC traz um por um).

**O estado** fica em `C:\ponte-dominio\notas\estado.json`: por empresa, o documento e, por nota, a data de entrada, a
impressão digital (o SHA-256 da nota, com o XML), de onde ela saiu e quando foi. Vai só a nota nova ou que mudou; a que
foi do XML não vai de novo pela Domínio (o destino fica com a do XML); a empresa que sai da lista some do estado.

**As respostas** do sistema (um pacote de cada vez, até 200 notas e 4 MB): 200 — as notas ficam como mandadas, as
recusadas também (o log diz o campo e o erro, nunca a chave) e só vão de novo se mudarem; 403 (a empresa não está
autorizada) e 422 (fora do contrato) — não repete, as outras empresas seguem; 503 "O destino das notas ainda não foi
configurado no sistema." — para as notas nesta rodada, nada fica como mandado; 502 e o resto do 5xx, tempo esgotado e
rede fora — as tentativas de sempre e, não indo, vai na próxima rodada (as notas não usam os pendentes); 401 e o 503 da
chave — como nos totais. O `conferir` mostra quantas empresas o sistema tem autorizadas e quantas prontas. O log de
cada empresa sai pelo código, só com números.

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
| A procuração do cliente pro escritório (ou, sem ela, pro CPF do procurador — abaixo, "O procurador") | `autorizacao`: `ativa`, `vencida` ou `sem`, e até quando | o primeiro dia útil do mês e, pra quem estava sem (ou vencida), toda segunda-feira — o cliente autoriza e o escritório vê na mesma semana: a empresa que passou a ter a procuração tem o PGDAS, a declaração e a situação fiscal consultados na mesma rodada, sem esperar o próximo dia marcado deles |
| As declarações do PGDAS-D do ano | `pgdas`: cada mês declarado, quando, e se o DAS foi pago | Simples: o primeiro dia útil **depois** do prazo do mês anterior (o prazo é o dia 20 ou, sem expediente, o próximo dia útil — com os feriados nacionais, o 20/09, o Carnaval, a Sexta-feira Santa e o Corpus Christi) e, só pra quem ainda tem mês sem declaração, o último dia útil do mês; em janeiro, o ano anterior também. Ex.: 10/2026 — prazo segunda, 23/11 (o 20/11 é feriado) → consulta terça, 24/11. No próprio dia do prazo não consulta: o vigia do sistema avisaria "PGDAS não transmitido" pra quem transmite naquele dia |
| A última declaração de um mês (o PDF) | `faturamento`: a receita do mês (RPA) e a dos 12 meses (RBT12), com os centavos | Simples: toda rodada confere, sem custo, se há declaração a ler — o mês novo (ou retificado) que o PGDAS mostrou; uma por rodada, a mais antiga primeiro (nenhum mês fica pra trás quando o de antes não veio); na primeira vez, só a do mês mais recente. A que o Serpro respondeu sem a receita (o PDF ilegível, a recusa) volta só no dia do PGDAS |
| A Caixa Postal | `caixa_postal`: id, assunto, data, origem (Receita, Estado, Município) e se foi lida | todo dia útil: o "quem teve novidade" em lote (até 1.000 CNPJs por pedido, o CNPJ com letras também) e as mensagens só de quem teve — o evento é só o dia da última novidade, então no dia seguinte a uma leitura, com o mesmo dia, lê de novo uma vez (a mensagem que chegou depois da rodada); as 100 mais recentes por empresa; na primeira leitura de uma empresa, só as dos últimos 90 dias (as antigas ficam no e-CAC); a já mandada não vai de novo, salvo a mandada como não lida que depois aparece lida |
| A situação fiscal (o relatório em PDF) | `situacao_fiscal`: o título de cada pendência e o órgão (Receita ou PGFN); sem pendência = lista vazia | o dia 5 (ou o próximo dia útil); a feita até 7 dias antes vale por ele (03/11/2026: a empresa consultada no dia 3 não repete no dia 5) |

Sem procuração (ou vencida), as outras consultas da empresa nem são feitas: vão pro `faltou` como `sem_autorizacao` — também nos dias em que a autorização dela não é consultada (o `estado.json` lembra a última resposta; cada recusa seria uma chamada paga), até a próxima consulta da autorização.

**A primeira rodada de produção (03/11/2026)** ensinou quatro coisas: a situação fiscal só aceita a versão **2.0** do SITFIS (a 1.0 a Receita desligou: "Versão Descontinuada"); o pedido de eventos da Caixa Postal pode devolver o protocolo em outro formato, e quando não devolve o log diz o HTTP, a mensagem do Serpro e como veio o `dados`; a lista das mensagens só aceita o `ponteiroPagina` com **24 dígitos** (a documentação e a demonstração dizem 14) — vão 24 zeros na página inicial e, se a Receita recusar o ponteiro de novo, a consulta vai sem ele, com um aviso no log; e 80 das 105 empresas não têm procuração pro CNPJ do escritório — a maioria dos clientes deu a procuração pro CPF do Diego, e a consulta em nome dele é o **Autentica Procurador** do Integra (o termo de autorização assinado com o e-CPF dele), que entrou na ponte no mesmo dia (abaixo, "O procurador"). E, na primeira rodada com o procurador, o relatório da situação fiscal de uma empresa deu HTTP 500 quatro vezes e a ponte tratou isso como o Serpro fora, parando a rodada inteira: desde então o **500** (o erro interno de um pedido) tem duas novas tentativas (10 s e 60 s) e fica só naquele pedido, que volta na próxima rodada; o mesmo serviço com 500 em **3 pedidos seguidos** tira o sistema dele (o SITFIS, o PGDASD…) da rodada, com uma linha só no log, e as outras consultas seguem. O 429, o 502, o 503, o 504 e a rede fora continuam parando a rodada depois das três novas tentativas.
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

**O relatório de situação fiscal no Drive (09/11/2026, pedido da Thalia com o ok do Samuel):** no fim de cada rodada de
produção, o PDF do relatório de situação fiscal de cada empresa (o que a rodada guardou em `receita\pdfs`, desta e das
de antes) vai pra função do sistema, **um por pedido**, só com o CNPJ, o dia e o PDF (`ponte\receita\relatorios.py`);
a função o salva na pasta da empresa no Drive (a que o cadastro aponta), em **FISCAL › SITUAÇÃO FISCAL**, e a ficha da
empresa ganha o link "Abrir o relatório (PDF)" — sem botão, sem nenhuma consulta a mais ao Serpro. Cada PDF vai uma
vez (`relatorios.json`); a empresa sem a pasta do Drive no cadastro e o sistema (ou o Drive) fora ficam pra rodada
seguinte, enquanto o PDF estiver no PC (30 dias); o recusado (4xx) não vai de novo; o sistema fora para no primeiro e o
resto espera; nada disso muda o código de saída da rodada. `py -3 -m ponte receita relatorios` manda agora os que
faltam, sem o Serpro (nenhuma chamada paga). O `--falso`, a demonstração e o `--sem-enviar` não mandam relatório.

**O que sai do PC:** no pacote, só os campos do contrato (`ponte\receita\pacote.py`); o que vier a mais do Serpro é
jogado fora antes de montar o pacote. À parte, só o PDF do relatório de situação fiscal, pro Drive da empresa (acima).
**Não sai:** o PDF da declaração do PGDAS, o texto das mensagens, as chaves, a senha do certificado, os tokens. No log, das mensagens só quantas — nunca o assunto. Do procurador, nada vai pro sistema: o
termo e o token ficam na memória da rodada, o CPF, o caminho do e-CPF e a senha viram `***` no log, e o pacote não diz
por qual procuração a empresa foi consultada (o `via` fica só no `estado.json`).

## O procurador (as procurações pro CPF do contador)

Na primeira rodada, 80 das 105 empresas não tinham procuração pro CNPJ do escritório: os clientes deram a procuração
do e-CAC pro **CPF do Diego**. O Integra consulta em nome dele com o **Autentica Procurador**: um *termo de
autorização* (um XML do modelo do Serpro) assinado com o e-CPF dele, que o serviço `AUTENTICAPROCURADOR ·
ENVIOXMLASSINADO81` troca por um token; cada consulta em nome dele vai com o `autorPedidoDados` = o CPF e o cabeçalho
`autenticar_procurador_token`. Com o **e-CPF A1** (o `.pfx` — o do Diego é A1, e o ok dele veio em 03/11/2026), a
ponte assina o termo sozinha a cada rodada (XMLDSig: enveloped, C14N 1.0, RSA-SHA256, só com o `cryptography`), com
um ano de vigência — ou até o e-CPF vencer, o que vier antes. O token vale até a meia-noite do dia seguinte e fica só na
memória: um termo por rodada. O mesmo termo de novo no mesmo dia (o `conferir` e depois a rodada) volta 304, com o
token no ETag.

- **A autorização:** primeiro a procuração pro escritório, como sempre; faltando ela (sem, vencida ou acesso negado),
  a pro CPF do procurador, conferida **em nome dele** (só o próprio procurador vê as procurações que recebeu). Vale a
  ativa; senão a vencida mais recente; senão `sem`. A empresa ativa pela procuração pro CPF tem o PGDAS, a declaração,
  a situação fiscal e a Caixa Postal consultados em nome dele, e o lote de eventos da Caixa Postal sai um por autor (o
  do escritório e o do procurador). O `estado.json` lembra de quem é a procuração (`via: procurador`); o pacote não leva
  isso — o sistema vê só `ativa`.
- **Sem o token nesta rodada** (o e-CPF de outro CPF, vencido, a senha errada — aí o termo nem sai do PC —, ou o Serpro
  recusando o termo, inclusive com o 500 que traz mensagem, que não é o Serpro fora): o termo é tentado uma vez só, o
  log diz o porquê **uma vez**, e as consultas em nome do procurador vão pro `faltou` como `erro` sem chamar a Receita
  — e voltam na próxima rodada. As do escritório seguem. A autorização, não: a parte do escritório já foi respondida,
  então ela conta como feita, com o estado como estava (a empresa de que o estado não lembrava nada fica `sem`), e
  volta no próximo dia marcado — senão, até alguém acertar o procurador, cada rodada repetiria a consulta do escritório
  de todas, uma chamada paga por empresa.
- **Desligado** (os três campos em branco, o padrão): a ponte faz como antes. Tirado do `config.ini` depois de usado, a
  empresa autorizada só pro CPF fica de fora das consultas (a Receita negaria em nome do escritório) até a segunda
  seguinte, quando a autorização dela é consultada de novo. Pela metade (um campo sem os outros): a rodada segue sem
  ele, com o aviso no log, e o `conferir` aponta o que falta.

**Montar:**

1. O e-CPF A1 do procurador (o `.pfx` do Diego) **dentro de `C:\ponte-dominio\`** (só o seu usuário, o sistema e os
   administradores leem essa pasta) — nunca no repositório.
2. Num PowerShell **como administrador**, na pasta do repositório:
   `powershell -NoProfile -ExecutionPolicy Bypass -File ponte\instalar.ps1 -Receita -Procurador` — ele pergunta o
   **CPF do procurador** (só números; o dígito verificador é conferido), o **caminho do `.pfx`** (tem de existir) e a
   **senha do e-CPF** (sem aparecer na tela). Pra colar a senha, **o botão direito do mouse — nunca o Ctrl+V**: ali o
   Ctrl+V entra como um caractere (um asterisco só = não colou nada). Ele pergunta sempre (é o mesmo caminho pra trocar
   o e-CPF quando o Diego renovar); com valor no `config.ini`, o Enter mantém o que está lá. Grava só esses três
   campos, lendo o `config.ini` de novo na hora de gravar.
3. `py -3 -m ponte receita conferir` — os três campos "preenchido", a linha **"Procurador:"** com o nome do titular
   ("o e-CPF é do procurador_cpf e vence em N dias") e **"Token do procurador: ok"** (o `conferir` manda o termo
   assinado ao Serpro — não tem dado de cliente — e mais nada).
4. A rodada: `py -3 -m ponte receita rodar --so autorizacao` consulta a autorização de todas (a do escritório e,
   faltando, a do CPF). Depois, `py -3 -m ponte receita rodar` (o calendário) consulta o PGDAS, a declaração e a
   situação fiscal das que passaram a ter a procuração — e só delas, sem repetir as que já foram consultadas no dia.

Os campos (`[integra]`, opcionais, em branco = desligado): `procurador_cpf`, `procurador_certificado` (o caminho do
`.pfx`) e `procurador_senha` — segredos como as chaves: nunca em chat, tela, log ou repositório.

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
py -3 -m ponte receita relatorios                                 # os PDFs da situação fiscal que faltam, pro Drive (sem o Serpro)
```

- O **`conferir`** mostra se o `cryptography` e o `pypdf` estão instalados, cada campo da `[integra]` ("preenchido",
  "falta", "ainda é o do exemplo" ou "inválido" — nunca o valor), a **impressão digital da chave da ponte**, o
  **titular do certificado e quantos dias faltam pra vencer** (vencido ou a menos de 30 dias, em destaque), se o
  certificado do Serpro confere, o token (em produção, pede um e diz "ok" ou o erro; em demonstração,
  "demonstração"), o procurador (os três campos, o titular e a validade do e-CPF, se ele é do `procurador_cpf` e, em
  produção, o "Token do procurador") e o ping do sistema, com a mensagem da função como veio (o 503 e o 401 da chave).
- O **`--demonstracao`** usa o ambiente de demonstração do Serpro: respostas fixas de exemplo, sem certificado, sem
  contrato e sem custo — só o `cnpj_escritorio` é exigido (o do exemplo serve). Não conta no teto, não lembra nada no
  `estado.json` e só manda pra um sistema de mentira (use `--sem-enviar`).
- `--so servico,servico` roda esses agora, fora do calendário; `--empresas N`, só as N primeiras da lista;
  `--saida arquivo.json` grava o pacote (sem pasta, em `C:\ponte-dominio\` — **tem CNPJ e dado dos clientes**: nunca
  dentro do repositório).
- Código de saída, como o do Domínio: **0** mandou (ou nada a mandar); **1** não conseguiu (a lista de empresas não
  veio, ou o envio falhou e o pacote ficou em pendentes); **2** configuração ou recusa (repetir não adianta).

## O primeiro uso (com o contrato)

**Decisão do Samuel (28/10/2026): liga direto na carteira toda e confere depois, pelo sistema** — sem a conferência
prévia de 5 empresas no e-CAC; o e-CAC, só onde o cruzamento do sistema não bater.

1. `powershell -NoProfile -ExecutionPolicy Bypass -File ponte\instalar.ps1 -Receita` (como administrador, na pasta
   do repositório): as chaves, o caminho do `.pfx`, a senha dele e o CNPJ do escritório são digitados na janela; ele
   registra a tarefa **"Ponte Receita"**, de segunda a sexta às 08:30 (`-Hora` muda; `-Remover -Receita` tira só
   ela). Com o `chave_ponte` ainda vazio (ou o do exemplo), roda o `py -3 -m ponte chave` no fim e mostra a impressão
   digital: mande-a pro Claude da sessão do Samuel. Ele lê o `config.ini` de novo só na hora de gravar e troca só os
   campos respondidos: a janela pode esperar horas sem desfazer o que mudou no arquivo nesse meio tempo (02/11/2026).
2. O `ambiente = producao` no `config.ini` — só essa linha, pelo `gravar_campo` da ponte (o arquivo não se abre).
3. `py -3 -m ponte receita conferir` — tudo "preenchido", o certificado em dia e "Token: ok".
4. A primeira rodada, mandando pro sistema: `py -3 -m ponte receita rodar` (alguns minutos). O Claude da sessão do
   Samuel cruza o que veio com o que o sistema já sabe — o PGDAS com as tarefas da Agenda, o faturamento com a ficha da
   Reforma, as autorizações, a Caixa Postal, as pendências — e aponta só o que não bate.

## Onde ficam as coisas

- `C:\ponte-dominio\receita\estado.json` — o que já foi consultado e mandado: a última procuração de cada empresa (e se
  ela é pro CPF do procurador, `via: procurador`), os meses declarados, a declaração já lida de cada mês, a última
  novidade da Caixa Postal, as mensagens já mandadas e o dia da última consulta da procuração, do PGDAS e da situação
  fiscal (o "a partir do dia").
  Só é gravado quando o pacote foi (ou ficou em pendentes) — um envio recusado não perde nada.
- `C:\ponte-dominio\receita\chamadas-AAAA-MM.json` — as chamadas ao Serpro no mês, por serviço (o teto).
- `C:\ponte-dominio\receita\pdfs\` — os PDFs da declaração e da situação fiscal, apagados depois de 30 dias. Nunca no
  repositório, nunca no pacote; o da situação fiscal vai também pra pasta da empresa no Drive (acima).
- `C:\ponte-dominio\receita\relatorios.json` — o dia do último relatório de situação fiscal de cada empresa que foi
  pro Drive (o que está lá não vai de novo).
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
