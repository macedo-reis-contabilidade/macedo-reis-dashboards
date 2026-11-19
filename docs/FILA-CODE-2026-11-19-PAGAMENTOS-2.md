# Fila do Claude Code — 19/11/2026 · a ponte da Receita 0.4.1: a consulta de pagamentos, de novo · branch `fila-19-11-pagamentos-2`

> **Para o Code do PC do escritório.** **Leia este arquivo inteiro antes de começar**, junto com o registro da fila de
> hoje cedo (`docs/FILA-CODE-2026-11-19-PAGAMENTOS.md`). Faça os itens **inteiros, sem parar pra perguntar**: nenhum
> item precisa do Samuel na frente do PC. Ao terminar: o **Registro de progresso** (fim deste arquivo) preenchido,
> commit e `git push origin fila-19-11-pagamentos-2`. **Nunca** push em `main` nem merge pra ela.

## O que é
- A fila de hoje cedo parou na demonstração, como mandava: o ambiente de demonstração do Serpro recusou o pedido
  ("Dados inválidos. Utilize o json no menu Cenário da documentação."), com e sem a `versaoSistema`.
- O porquê, na documentação do Serpro (a cópia da biblioteca pública, `bk.cursor/rules/pagtoweb.mdc`): o cenário dos
  pagamentos tem dois corpos na mesma página. O "Body", que a ponte mandou, tem o CPF de exemplo no autor e no
  contribuinte; o do "Curl" tem o **CNPJ de exemplo nos três** (o contratante, o autor e o contribuinte). Os outros
  serviços que a ponte já usa na demonstração respondem com o CNPJ.
- Na `main`, a **ponte da Receita 0.4.1**, com três acertos:
  1. o cenário da demonstração é o do "Curl" (`ponte/receita/demonstracao.py`), e a contagem dos pagamentos
     (`CONTACONSDOCARRPG73`) ganhou o dela;
  2. o tipo da guia é lido como o exemplo de retorno da documentação mostra: o código (`"4"`) e o nome curto (`"DARF"`);
  3. a resposta que vier em mais de uma página é conferida pela contagem da Receita (mais uma chamada, só nessas
     empresas): a documentação não diz se o `primeiroDaPagina` é a posição da guia ou o número da página, e a que não
     fechar não vai.
- O resto é a fila de hoje cedo, de novo: a demonstração (sem custo), o piloto de 10 empresas e, com o piloto bom, a
  instalação e a primeira leitura de todas. A função `ponte` e o banco não mudaram (já estão no ar desde as 9h20).
- **Sem o piloto bom, não instale** (a tarefa das 8h30 consultaria todas sozinha na rodada seguinte, e cada recusa
  marca a empresa como consultada até o dia 25). Amanhã, 20/11, é feriado: a rodada das 8h30 não consulta nada.

## Regras (as de sempre)
- **Dado de cliente não sai do PC — nem pra esta conversa.** No registro, só contagens do escritório inteiro, o tempo
  e o que o log diz com cada CNPJ trocado por `[cnpj]`. **Nunca** o número de uma guia, um valor, o nome, o CNPJ ou o
  código de uma empresa. A cópia das guias (`receita\pagamentos\`) **não se abre**: só se contam os arquivos e as guias
  (o item 5).
- **Não abra o `C:\ponte-dominio\config.ini`** (nem Read, `type`, `cat` ou `Get-Content`). Pra saber como ficou:
  `py -3 -m ponte receita conferir` e o log do dia.
- **Não rode nada entre 6h50 e 7h20, nem entre 8h20 e 9h00**: são as duas tarefas do dia (o Domínio às 7h00, a
  Receita às 8h30). Se a hora chegar no meio, espere a tarefa acabar.
- **Repositório público**: nada de nome de cliente, CNPJ, código de empresa, número de guia, valor, chave ou link.
  A exceção é a resposta da demonstração do item 2.2, que é o exemplo público do Serpro.
- **Não mexa no código** (nem em `ponte/`, nem em `supabase/`, nem nos testes). A exceção são os arquivos novos do
  item 2.2, numa pasta nova (`tests/fixtures/receita-demonstracao/`, **não** a `tests/fixtures/receita/`: todo arquivo
  de lá precisa de um cenário da demonstração, e o teste falha). Se um item falhar por causa do código, anote o erro (a
  mensagem, sem CNPJ) e siga a regra do item: o conserto é do Claude da sessão do Samuel.
- Commits em pt-BR.

## 1. O teste
```
git fetch origin --prune
git checkout main
git pull
git checkout -b fila-19-11-pagamentos-2
py -3 tests/ponte-receita.test.py
py -3 tests/ponte.test.py
```
Os dois têm de terminar em "Tudo certo.". Anote também a `VERSAO` da ponte instalada
(`C:\ponte-dominio\app\ponte\receita\__init__.py`, deve ser `0.3.0`) e a da `main` (`ponte/receita/__init__.py`,
`0.4.1`). Se um teste não terminar em "Tudo certo.", **pare aqui**: registro e push.

## 2. A demonstração (sem custo, sem contrato)
Tudo da **pasta do repositório** (assim roda a 0.4.1 da `main`, sem instalar).

**2.1. A rodada de demonstração:**
```
py -3 -m ponte receita rodar --demonstracao --sem-enviar --so pagamentos --saida demo-pagamentos.json
```
O pacote vai pra `C:\ponte-dominio\demo-pagamentos.json` (nunca no repositório). Anote o código de saída
(`$LASTEXITCODE`) e, do log do dia, as linhas da rodada (a do resumo, "receita: …", e qualquer `[AVISO]` ou
`[ERRO]`). Do pacote, a empresa de demonstração é a única: anote quantas guias o bloco `pagamentos` tem e **a primeira
guia inteira** (é o exemplo do Serpro: pode ir pro registro). Se em vez do bloco ela estiver no `faltou`, anote o
motivo e a linha do log.

**2.2. As respostas cruas:** o script de hoje cedo, `C:\ponte-dominio\testes\pagamentos-demo.py`, com duas mudanças:
1. grava a resposta do `PAGAMENTOS71` em `tests\fixtures\receita-demonstracao\PAGTOWEB-PAGAMENTOS71.json` (crie a
   pasta, na pasta do repositório), no mesmo formato de hoje cedo: `{"http_status": …, "corpo": …}`, indentado, UTF-8;
2. chama também a contagem, `cli.chamar('Consultar', 'PAGTOWEB', 'CONTACONSDOCARRPG73', '99999999999999', {})` (na
   demonstração o corpo é o do cenário), e grava a resposta dela em
   `tests\fixtures\receita-demonstracao\PAGTOWEB-CONTACONSDOCARRPG73.json`, do mesmo jeito.

Rode uma vez e anote, de cada uma, o `http_status`, o `status` do corpo, as `mensagens` e, no `dados`, quantos
documentos vieram (no `PAGAMENTOS71`) ou o número (na contagem). Antes do commit, confira que os dois arquivos só têm o
exemplo do Serpro (os números 99999999999 e 99999999999999, e as guias de exemplo) e nenhum token: se tiverem
qualquer outra coisa, não ponha no commit e anote. **Não tente outro corpo**: se a demonstração recusar de novo,
anote e siga a regra do 2.3.

**2.3. Quando parar:** se o 2.1 deixou a demonstração no `faltou`, ou se a primeira guia do pacote veio com
`tipo_codigo`, `tipo`, `receita_codigo`, `periodo_apuracao` ou `vencimento` em `null` e a resposta crua (2.2) tem esse
dado na guia (com outro nome ou outro formato), **pare aqui**: registro e push. O `null` que já vem `null` na resposta
crua (no exemplo da documentação, o `valorMulta`, o `valorJuros`, a `extensaoReceita`) não para.

## 3. O piloto em produção (10 empresas)
Da pasta do repositório (ainda a 0.4.1 da `main`, sem instalar):
1. O contador do mês antes: `C:\ponte-dominio\receita\chamadas-2026-11.json` tem as chamadas do mês por serviço;
   anote a soma de todos, o `PAGAMENTOS71` e o `CONTACONSDOCARRPG73` (zero, se não houver). Só os números.
2. ```
   py -3 -m ponte receita rodar --so pagamentos --empresas 10
   ```
   Anote o código de saída, quanto tempo levou e, do log, as linhas da rodada: a "receita: pagamentos — N empresa(s)
   consultada(s), X guia(s) na janela; a cópia no PC tem Y guia(s)", a do resumo ("receita: …", com o `faltou`), as do
   envio ("… foi (HTTP 200)", o que o sistema gravou e, se houver, "o sistema deixou de fora N bloco(s)") e qualquer
   `[AVISO]` ou `[ERRO]` — cada CNPJ trocado por `[cnpj]`.
3. O contador depois (a soma, o `PAGAMENTOS71` e o `CONTACONSDOCARRPG73`).

**Quando parar:** código de saída diferente de 0, alguma empresa no `faltou` dos pagamentos como `a_conferir` ou
`erro`, algum bloco deixado de fora pelo sistema ("o sistema deixou de fora…"), ou nenhuma empresa consultada (as 10
primeiras sem autorização: nesse caso rode de novo com `--empresas 25` e siga a mesma regra). Parou: **não instale**,
registro e push. O `sem_autorizacao` não para (o cliente pode ter dado a procuração sem o serviço de pagamentos):
anote quantas.

## 4. Instalar
Só com o piloto bom. Da pasta do repositório (como nas outras vezes: `powershell` como administrador, se ele pedir):
```
powershell -NoProfile -ExecutionPolicy Bypass -File ponte\instalar.ps1 -Hora 07:00
```
Anote a última linha que ele mostra. Confira que:
- `C:\ponte-dominio\app\ponte\receita\__init__.py` tem `VERSAO = '0.4.1'`;
- a tarefa "Ponte Domínio" segue às 07:00 e a "Ponte Receita" segue registrada, de segunda a sexta às 08:30
  (`Get-ScheduledTask -TaskName 'Ponte Receita' | Format-List State, Triggers`), as duas com o "executar assim que
  possível" ligado.

## 5. A primeira leitura (todas as empresas)
1. ```
   py -3 -m ponte receita rodar --so pagamentos
   ```
   (As 10 do piloto vão de novo, cada uma numa página só: são umas 10 chamadas a mais, de propósito — assim a rodada é
   uma só e o sistema recebe todas juntas.) Anote o mesmo que no 3.2. Se o teto do mês chegar (a linha "o teto de 1500
   chamadas do mês chegou"), anote quantas ficaram de fora: elas voltam sozinhas na próxima rodada com chamadas livres.
2. O contador depois (a soma, o `PAGAMENTOS71` e o `CONTACONSDOCARRPG73`).
3. A cópia no PC, só contando (sem abrir nenhum arquivo no editor nem mostrar o conteúdo):
   ```
   $arqs = Get-ChildItem C:\ponte-dominio\receita\pagamentos -Filter *.json
   $arqs.Count
   ($arqs | ForEach-Object { (Get-Content $_.FullName -Raw | ConvertFrom-Json).documentos.Count } | Measure-Object -Sum).Sum
   ```
   Anote os dois números (quantas empresas e quantas guias no total).
4. Do estado, só contando: `$e = Get-Content C:\ponte-dominio\receita\estado.json -Raw | ConvertFrom-Json` e
   `($e.pagamentos.PSObject.Properties | Measure-Object).Count` (quantas empresas já têm a consulta) e
   `($e.pagamentos.PSObject.Properties | Where-Object { $_.Value.ate } | Measure-Object).Count` (quantas com a janela
   gravada). Anote os dois.

## 6. Fim
Commit deste arquivo (o registro preenchido) e, se o 2.2 rodou, dos dois arquivos de
`tests/fixtures/receita-demonstracao/`; `git push origin fila-19-11-pagamentos-2`. Quem confere o que chegou ao banco
(as guias de cada empresa, a janela, o que veio recusado) é a sessão do Samuel.

## Registro de progresso
| Data | Item | O que aconteceu |
|---|---|---|
