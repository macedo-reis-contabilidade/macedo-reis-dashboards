# Fila do Claude Code — 19/11/2026 · a ponte da Receita 0.4.0: a consulta de pagamentos (PAGTOWEB) · branch `fila-19-11-pagamentos`

> **Para o Code do PC do escritório.** **Leia este arquivo inteiro antes de começar.** Faça os itens **inteiros, sem
> parar pra perguntar**: nenhum item precisa do Samuel na frente do PC. Ao terminar: o **Registro de progresso** (fim
> deste arquivo) preenchido, commit e `git push origin fila-19-11-pagamentos`. **Nunca** push em `main` nem merge pra
> ela.

## O que é
- O "pode ligar" do Samuel (18/11/2026, 21h32): a ponte da Receita passa a consultar, uma vez por mês por empresa, as
  **guias pagas** (o DAS, o DARF) pelo Integra Contador, o `PAGTOWEB · PAGAMENTOS71`. Pra que serve: a importação da
  contabilidade (o pagamento no dia e no valor de verdade, com a multa e os juros) e a conferência do que foi pago.
- Na `main`, a **ponte da Receita 0.4.0** (`ponte/receita/servicos.py`, `pagamentos()`): a primeira consulta de cada
  empresa vai de 01/01/2025 até ontem; as seguintes, do fim da anterior menos 45 dias até ontem, no dia 25 (ou no
  próximo dia útil). A resposta vem em páginas de 100, **cada página é uma chamada** paga (conta no teto). A recusa
  desta consulta não mexe na autorização da empresa. Em produção, as guias de cada empresa ficam também numa cópia no
  PC, `C:\ponte-dominio\receita\pagamentos\<CNPJ>.json`. Tudo no `ponte/LEIA-ME.md` ("Os pagamentos").
- A função `ponte` do sistema e o banco (a tabela `receita_pagamentos`) já estão prontos: o Claude da sessão do Samuel
  publicou e conferiu.
- **O que ainda não se sabe:** o formato da resposta de verdade. A ponte foi escrita pela documentação do Serpro. Por
  isso esta fila confere na demonstração (sem custo), depois num piloto de 10 empresas em produção, e só então instala
  e lê o resto. A ordem importa: **sem o piloto bom, não instale** (a tarefa das 8h30 consultaria todas sozinha no dia
  seguinte, e cada recusa marca a empresa como consultada até o dia 25).
- Esta fila **não escreve código**. A única coisa que ela põe no repositório, além do registro, é a resposta crua da
  demonstração (o item 2.2), que é o exemplo público do Serpro.

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
- **Não mexa no código** (nem em `ponte/`, nem em `supabase/`, nem nos testes que já existem). A exceção é o arquivo
  novo do item 2.2. Se um item falhar por causa do código, anote o erro (a mensagem, sem CNPJ) e siga a regra do item:
  o conserto é do Claude da sessão do Samuel.
- Commits em pt-BR.

## 1. O teste
```
git fetch origin --prune
git checkout main
git pull
git checkout -b fila-19-11-pagamentos
py -3 tests/ponte-receita.test.py
py -3 tests/ponte.test.py
```
Os dois têm de terminar em "Tudo certo." (o da Receita tem o caso novo, o 14, "os pagamentos"). Anote também a
`VERSAO` da ponte instalada (`C:\ponte-dominio\app\ponte\receita\__init__.py`, deve ser `0.3.0`) e a da `main`
(`ponte/receita/__init__.py`, `0.4.0`). Se um teste não terminar em "Tudo certo.", **pare aqui**: registro e push.

## 2. A demonstração (sem custo, sem contrato)
Tudo da **pasta do repositório** (assim roda a 0.4.0 da `main`, sem instalar).

**2.1. A rodada de demonstração:**
```
py -3 -m ponte receita rodar --demonstracao --sem-enviar --so pagamentos --saida demo-pagamentos.json
```
O pacote vai pra `C:\ponte-dominio\demo-pagamentos.json` (nunca no repositório). Anote o código de saída
(`$LASTEXITCODE`) e, do log do dia (`C:\ponte-dominio\logs\AAAA-MM-DD.log`), as linhas da rodada (a do resumo,
"receita: …", e qualquer `[AVISO]` ou `[ERRO]`). Do pacote, a empresa de demonstração é a única: anote quantas guias o
bloco `pagamentos` tem e **a primeira guia inteira** (é o exemplo do Serpro, o CPF 99999999999: pode ir pro registro).
Se em vez do bloco ela estiver no `faltou`, anote o motivo e a linha do log.

**2.2. A resposta crua:** um script descartável, fora do repositório, `C:\ponte-dominio\testes\pagamentos-demo.py`
(crie a pasta), que:
1. põe a pasta do repositório no começo do `sys.path` e importa `datetime`, `json`, `from ponte import config`,
   `from ponte.log import Registro` e `from ponte.receita import serpro, estado as est_mod`;
2. monta o cliente da demonstração **do jeito que `rodar()` monta** (`ponte/receita/rodada.py`): `base =
   config.pasta()`, `cfg = config.carregar()`, `reg = Registro(base / 'logs', segredos=cfg.segredos())`, `pasta =
   est_mod.pasta_receita(base)`, `cont = est_mod.Contador(pasta, datetime.date.today(), 1500, contar=False)` e `cli =
   serpro.Cliente('demonstracao', cfg.valor('integra', 'cnpj_escritorio'), reg, cont, pasta / 'tmp')`;
3. chama `r = cli.chamar('Consultar', 'PAGTOWEB', 'PAGAMENTOS71', '99999999999', {})` — na demonstração o corpo do
   pedido é o do cenário do Serpro (`ponte/receita/demonstracao.py`, `CENARIOS['PAGAMENTOS71']`), não o que se passa;
4. grava `{"http_status": r.http_status, "corpo": r.corpo}` (indentado, UTF-8) em
   `tests\fixtures\receita\PAGTOWEB-PAGAMENTOS71-demonstracao.json`, **na pasta do repositório**.

Rode e anote o `http_status`, as `mensagens` e quantos documentos vieram no `dados`. Antes do commit, confira que o
arquivo só tem o exemplo do Serpro (os números 99999999999 e 99999999999999, e as guias de exemplo) e nenhum token:
se tiver qualquer outra coisa, não ponha no commit e anote.
- Se a demonstração recusar o pedido (HTTP 400 ou mensagem de erro): rode o script **uma vez** com
  `demonstracao.CENARIOS['PAGAMENTOS71']['pedidoDados']['versaoSistema'] = '1.0'` antes da chamada (`from
  ponte.receita import demonstracao`; muda só a cópia na memória do script, não o arquivo) e grave a resposta no mesmo
  arquivo. Anote as duas.

**2.3. Quando parar:** se o 2.1 deixou a demonstração no `faltou`, ou se a primeira guia do pacote veio com
`tipo_codigo`, `receita_codigo`, `periodo_apuracao` ou `vencimento` em `null` e a resposta crua (2.2) tem esse dado na
guia (com outro nome), **pare aqui**: registro e push. A ponte não entendeu o formato, e o conserto é da sessão do
Samuel antes de qualquer chamada paga.

## 3. O piloto em produção (10 empresas)
Da pasta do repositório (ainda a 0.4.0 da `main`, sem instalar):
1. O contador do mês antes: `C:\ponte-dominio\receita\chamadas-2026-11.json` tem as chamadas do mês por serviço;
   anote a soma de todos e o `PAGAMENTOS71` (zero, se não houver). Só os números.
2. ```
   py -3 -m ponte receita rodar --so pagamentos --empresas 10
   ```
   Anote o código de saída, quanto tempo levou e, do log, as linhas da rodada: a "receita: pagamentos — N empresa(s)
   consultada(s), X guia(s) na janela; a cópia no PC tem Y guia(s)", a do resumo ("receita: …", com o `faltou`), as do
   envio ("… foi (HTTP 200)", o que o sistema gravou e, se houver, "o sistema deixou de fora N bloco(s)") e qualquer
   `[AVISO]` ou `[ERRO]` — cada CNPJ trocado por `[cnpj]`.
3. O contador depois (a soma e o `PAGAMENTOS71`).

**Quando parar:** código de saída diferente de 0, alguma empresa no `faltou` dos pagamentos como `a_conferir` ou
`erro`, algum bloco deixado de fora pelo sistema ("o sistema deixou de fora…"), ou nenhuma empresa consultada (as 10 primeiras sem autorização: nesse
caso rode de novo com `--empresas 25` e siga a mesma regra). Parou: **não instale**, registro e push. O `sem_autorizacao`
não para (o cliente pode ter dado a procuração sem o serviço de pagamentos): anote quantas.

## 4. Instalar
Só com o piloto bom. Da pasta do repositório (como nas outras vezes: `powershell` como administrador, se ele pedir):
```
powershell -NoProfile -ExecutionPolicy Bypass -File ponte\instalar.ps1 -Hora 07:00
```
Anote a última linha que ele mostra. Confira que:
- `C:\ponte-dominio\app\ponte\receita\__init__.py` tem `VERSAO = '0.4.0'`;
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
2. O contador depois (a soma e o `PAGAMENTOS71`).
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
Commit deste arquivo (o registro preenchido) e, se o 2.2 rodou, do `tests/fixtures/receita/PAGTOWEB-PAGAMENTOS71-demonstracao.json`;
`git push origin fila-19-11-pagamentos`. Quem confere o que chegou ao banco (as guias de cada empresa, a janela, o que
veio recusado) é a sessão do Samuel.

## Registro de progresso
| Data | Item | O que aconteceu |
|---|---|---|
| 19/11/2026 | 1 | Feito às 9h22: `git fetch --prune`, `main` atualizada (em `602808d`), a branch `fila-19-11-pagamentos`. `py -3 tests/ponte-receita.test.py`: "Tudo certo." (com o caso 14, "os pagamentos"); `py -3 tests/ponte.test.py`: "Tudo certo.". A `VERSAO` da ponte instalada (`C:\ponte-dominio\app\ponte\receita\__init__.py`): `0.3.0`; a da `main`: `0.4.0`. |
| 19/11/2026 | 2.1 | Rodado às 9h26, da pasta do repositório: `py -3 -m ponte receita rodar --demonstracao --sem-enviar --so pagamentos --saida demo-pagamentos.json`. Código de saída **0**, 1 s. O pacote foi pra `C:\ponte-dominio\demo-pagamentos.json` com **`empresas` vazio** e a empresa de demonstração no **`faltou`**, `servico: pagamentos`, `motivo: erro`. As linhas do log: `09:26:03 receita: rodada da ponte 0.4.0 — ambiente de demonstração do Serpro, 19/11/2026 — só pagamentos — sem enviar` · `09:26:03 receita: 1 empresa(s) na lista` · `09:26:04 [ERRO] receita: pagamentos de [cnpj] não veio: ERRO Dados inválidos. Utilize o json no menu Cenário da documentação.` · `09:26:04 receita: 0 empresa(s) com dado; faltou: erro 1` · `09:26:04 receita: pacote gravado em C:\ponte-dominio\demo-pagamentos.json` · `09:26:04 receita: --sem-enviar: nada foi mandado`. Nenhuma guia, nenhum `[AVISO]`. |
| 19/11/2026 | 2.2 | Feito: o script `C:\ponte-dominio\testes\pagamentos-demo.py` (fora do repositório), que monta o cliente da demonstração como no `rodar()` e chama `cli.chamar('Consultar', 'PAGTOWEB', 'PAGAMENTOS71', '99999999999', {})`. **1ª chamada** (o cenário como está no `demonstracao.py`, que não tem a `versaoSistema` no `pedidoDados`): `http_status` **200**, e no corpo `status` **400**, `dados` **null** (0 documentos), `contratante`, `autorPedidoDados`, `contribuinte` e `pedidoDados` null, e a mensagem `ERRO` — "Dados inválidos. Utilize o json no menu Cenário da documentação.". **2ª chamada**, uma vez só, como a fila manda, com `versaoSistema = '1.0'` posto no cenário só na memória do script: **a mesma resposta**, idêntica byte a byte. Gravada em `tests/fixtures/receita/PAGTOWEB-PAGAMENTOS71-demonstracao.json`: só a recusa do Serpro, sem token e sem nenhum número (nem os de exemplo, porque o trial não devolveu dado nenhum). |
| 19/11/2026 | 2.3 | **Parado aqui, pela regra do item**: a demonstração ficou no `faltou`. A ponte não chegou a receber guia, então o formato da resposta de verdade continua sem conferência. O que a recusa sugere (a conferir pela sessão do Samuel, com a documentação): o trial devolve "Dados inválidos" quando o corpo não é exatamente o do "Cenário" da documentação, e o cenário do `PAGAMENTOS71` no `ponte/receita/demonstracao.py` é o que o próprio arquivo diz que "ainda não foi conferido no trial" — além da `versaoSistema`, que não fez diferença, podem estar diferentes o `dados` (as datas de 2019, o `primeiroDaPagina` e o `tamanhoDaPagina`), o autor (`tipo` 1, CPF, enquanto os outros cenários usam o CNPJ) ou o `idSistema` e o `idServico`. A busca na internet não achou o exemplo público, e a página do catálogo de serviços do Serpro respondeu com erro 500 às 9h27. Não houve mais nenhuma chamada. |
| 19/11/2026 | 3 a 5 | **Não feitos**, pela regra do 2.3: sem o piloto em produção, sem instalar (a ponte instalada segue na `0.3.0` e a tarefa das 8h30 de amanhã não consulta os pagamentos) e sem a primeira leitura. Nenhuma chamada paga: o contador do mês não mudou por esta fila (as chamadas da demonstração não contam). |
| 19/11/2026 | 6 | Feito: este registro, o commit (este arquivo e o `tests/fixtures/receita/PAGTOWEB-PAGAMENTOS71-demonstracao.json`) e `git push origin fila-19-11-pagamentos`, às 9h30. |
