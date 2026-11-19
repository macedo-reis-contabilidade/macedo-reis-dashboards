# Fila do Claude Code — 19/11/2026 · a ponte da Receita 0.4.2: os pagamentos lidos de novo · branch `fila-19-11-pagamentos-3`

> **Para o Code do PC do escritório.** **Leia este arquivo inteiro antes de começar**, junto com o registro da fila
> anterior (`docs/FILA-CODE-2026-11-19-PAGAMENTOS-2.md`). Faça os itens **inteiros, sem parar pra perguntar**: nenhum
> item precisa do Samuel na frente do PC. Ao terminar: o **Registro de progresso** (fim deste arquivo) preenchido,
> commit e `git push origin fila-19-11-pagamentos-3`. **Nunca** push em `main` nem merge pra ela.

## O que é
- A primeira leitura dos pagamentos (a fila anterior, 10h25) chegou inteira ao sistema: 3.388 guias de 80 empresas.
- Na conferência, dois detalhes do formato da produção, que o exemplo da documentação não mostrava:
  1. o tipo da guia vem **sem o nome curto** (só a descrição longa, "DOCUMENTO DE ARRECADAÇÃO DO SIMPLES NACIONAL");
  2. a extensão da receita das partes (o "-01" do código do tributo) vem **como objeto**, com o código dentro, e a 0.4.1
     a gravou como texto (o código da parte ficou como "1082-{'codi").
- Na `main`, a **ponte da Receita 0.4.2**: o nome curto sai do código do tipo (4 DARF, 7 DJE, 8 DARF SIMPLES, 9 DAS,
  10 DAE) e a extensão, do objeto. E a janela que a 0.4.1 gravou no `estado.json` não conta mais: na próxima consulta,
  cada empresa é lida **de novo desde 01/01/2025, uma vez** (a marca `leitura: 2` no estado); as guias são as mesmas,
  e o sistema e a cópia no PC trocam cada uma pela nova, pelo número.
- A função `ponte` e o banco não mudaram.
- Custa umas 85 chamadas (uma por empresa autorizada e o termo do procurador). O mês está em 1.012 de 1.500.

## Regras (as de sempre)
- **Dado de cliente não sai do PC — nem pra esta conversa.** No registro, só contagens do escritório inteiro, o tempo
  e o que o log diz com cada CNPJ trocado por `[cnpj]`. **Nunca** o número de uma guia, um valor, o nome, o CNPJ ou o
  código de uma empresa. A cópia das guias (`receita\pagamentos\`) **não se abre**: só se contam os arquivos e as guias
  (o item 3) e se procura o texto do item 3.4, sem mostrar a linha.
- **Não abra o `C:\ponte-dominio\config.ini`** (nem Read, `type`, `cat` ou `Get-Content`). Pra saber como ficou:
  `py -3 -m ponte receita conferir` e o log do dia.
- **Não rode nada entre 6h50 e 7h20, nem entre 8h20 e 9h00**: são as duas tarefas do dia (o Domínio às 7h00, a
  Receita às 8h30). Se a hora chegar no meio, espere a tarefa acabar.
- **Repositório público**: nada de nome de cliente, CNPJ, código de empresa, número de guia, valor, chave ou link.
- **Não mexa no código** (nem em `ponte/`, nem em `supabase/`, nem nos testes). Se um item falhar por causa do código,
  anote o erro (a mensagem, sem CNPJ) e siga a regra do item: o conserto é do Claude da sessão do Samuel.
- Commits em pt-BR.

## 1. O teste
```
git fetch origin --prune
git checkout main
git pull
git checkout -b fila-19-11-pagamentos-3
py -3 tests/ponte-receita.test.py
py -3 tests/ponte.test.py
```
Os dois têm de terminar em "Tudo certo.". Anote a `VERSAO` da ponte instalada
(`C:\ponte-dominio\app\ponte\receita\__init__.py`, deve ser `0.4.1`) e a da `main` (`ponte/receita/__init__.py`,
`0.4.2`). Se um teste não terminar em "Tudo certo.", **pare aqui**: registro e push.

## 2. Instalar
Da pasta do repositório (como na fila anterior):
```
powershell -NoProfile -ExecutionPolicy Bypass -File ponte\instalar.ps1 -Hora 07:00
```
Anote a última linha que ele mostra. Confira que `C:\ponte-dominio\app\ponte\receita\__init__.py` tem
`VERSAO = '0.4.2'` e que as duas tarefas seguem como na fila anterior (a "Ponte Domínio" todo dia às 07:00; a
"Ponte Receita" de segunda a sexta às 08:30; as duas com o "executar assim que possível" ligado).

## 3. A leitura de novo
1. O contador do mês antes: `C:\ponte-dominio\receita\chamadas-2026-11.json`; anote a soma de todos, o
   `PAGAMENTOS71`, o `CONTACONSDOCARRPG73` e o `ENVIOXMLASSINADO81`. Só os números.
2. Da cópia instalada (`C:\ponte-dominio\app`):
   ```
   py -3 -m ponte receita rodar --so pagamentos
   ```
   Anote o código de saída, quanto tempo levou e, do log, as linhas da rodada: a "receita: pagamentos — N empresa(s)
   consultada(s), X guia(s) na janela; a cópia no PC tem Y guia(s)", a do resumo ("receita: …", com o `faltou`), as do
   envio ("… foi (HTTP 200)", o que o sistema gravou e, se houver, "o sistema deixou de fora N bloco(s)") e qualquer
   `[AVISO]` ou `[ERRO]` — cada CNPJ trocado por `[cnpj]`. Se o teto do mês chegar, anote quantas ficaram de fora.
3. O contador depois (a soma, o `PAGAMENTOS71`, o `CONTACONSDOCARRPG73` e o `ENVIOXMLASSINADO81`).
4. A cópia no PC e o estado, só contando (sem abrir nenhum arquivo no editor nem mostrar o conteúdo):
   ```
   $arqs = Get-ChildItem C:\ponte-dominio\receita\pagamentos -Filter *.json
   $arqs.Count
   ($arqs | ForEach-Object { (Get-Content $_.FullName -Raw | ConvertFrom-Json).documentos.Count } | Measure-Object -Sum).Sum
   ($arqs | Select-String -SimpleMatch "{'codi" | Measure-Object).Count
   $e = Get-Content C:\ponte-dominio\receita\estado.json -Raw | ConvertFrom-Json
   ($e.pagamentos.PSObject.Properties | Where-Object { $_.Value.leitura -eq 2 } | Measure-Object).Count
   ```
   Anote os quatro números: quantas empresas na cópia, quantas guias no total, **quantas linhas ainda com o `{'codi`**
   (deve ser **0**) e quantas empresas com a `leitura` 2 no estado.

**Quando parar:** código de saída diferente de 0, alguma empresa no `faltou` dos pagamentos como `a_conferir` ou
`erro`, ou algum bloco deixado de fora pelo sistema. **Não rode de novo**: anote, registro e push. O `sem_autorizacao`
não para: anote quantas.

## 4. Fim
Commit deste arquivo (o registro preenchido) e `git push origin fila-19-11-pagamentos-3`. Quem confere o que chegou ao
banco é a sessão do Samuel.

## Registro de progresso
| Data | Item | O que aconteceu |
|---|---|---|
| 19/11/2026 | 1 | Feito às 11h20: `git fetch --prune`, `main` atualizada (em `ab9158f`), a branch `fila-19-11-pagamentos-3`. `py -3 tests/ponte-receita.test.py`: "Tudo certo."; `py -3 tests/ponte.test.py`: "Tudo certo." (às 11h22). A `VERSAO` da ponte instalada: `0.4.1`; a da `main`: `0.4.2`. |
| 19/11/2026 | 2 | Feito às 11h22: `powershell -NoProfile -ExecutionPolicy Bypass -File ponte\instalar.ps1 -Hora 07:00`, código 0, sem pedir o administrador. A última linha: `py -3 -m ponte rodar --sem-enviar` (do aviso padrão "Antes da primeira rodada: …"; antes dele, "Tarefa 'Ponte Domínio' registrada: todo dia às 07:00 (os últimos 14 meses), como DESKTOP-OB3NBFV\PC (sem guardar senha)."). Conferido: `VERSAO = '0.4.2'` na instalada; a "Ponte Domínio", `Ready`, todo dia às 07:00; a "Ponte Receita", `Ready`, de segunda a sexta (`DaysOfWeek` 62) às 08:30; as duas com o `StartWhenAvailable` ligado. |
| 19/11/2026 | 3.1 | O contador antes: a soma do mês, **1.012**; `PAGAMENTOS71` **90**; `CONTACONSDOCARRPG73` **0**; `ENVIOXMLASSINADO81` **17**. |
| 19/11/2026 | 3.2 | Rodado às 11h23, pela cópia instalada (`C:\ponte-dominio\app`, a 0.4.2): `py -3 -m ponte receita rodar --so pagamentos`. Código de saída **0**, **156 s**. O log: `11:23:12 receita: rodada da ponte 0.4.2 — produção, 19/11/2026 — só pagamentos` · `11:23:14 receita: 105 empresa(s) na lista` · `11:23:14 receita: com o procurador — a procuração pro CPF dele é conferida quando falta a do escritório, e essas empresas são consultadas em nome dele` · `11:23:14 receita: 59 empresa(s) consultada(s) em nome do procurador (a procuração delas é pro CPF dele)` · `11:25:16 receita: pagamentos — 84 empresa(s) consultada(s), 3388 guia(s) na janela; a cópia no PC tem 3388 guia(s)` · `11:25:16 receita: procurador — o termo de autorização foi aceito (o token valeu pra rodada)` · `11:25:16 receita: 84 empresa(s) com dado (pagamentos 84); 3388 guia(s) paga(s); faltou: sem_autorizacao 21` · `11:25:29 [AVISO] receita f963b42b: HTTP 500 — Não gravei agora. A ponte tenta de novo. — tento de novo em 10 s` · `11:25:47 receita f963b42b: foi (HTTP 200)` · `11:25:47 receita f963b42b: 84 empresa(s) gravada(s), 0 sem cadastro no sistema`. **Um aviso**: o primeiro envio voltou HTTP 500 do sistema ("Não gravei agora"), e a própria ponte mandou de novo 10 s depois, que foi (HTTP 200) — a conferir na sessão do Samuel o log da função `ponte` às 11h25 (um 500 com 3.388 guias pode ser o tempo da gravação). Nada `a_conferir` nem `erro`, nenhum bloco deixado de fora, e o teto do mês não chegou. **21 empresas `sem_autorizacao`** (não para). |
| 19/11/2026 | 3.3 | O contador depois: a soma, **1.097** (85 a mais, como a fila previa); `PAGAMENTOS71` **174** (84 a mais: uma por empresa, cada uma numa página só); `CONTACONSDOCARRPG73` **0**; `ENVIOXMLASSINADO81` **18** (o termo do procurador). |
| 19/11/2026 | 3.4 | A cópia no PC, só contando: **84** empresas e **3.388** guias no total; **0** linhas ainda com o `{'codi`. O estado: **84** empresas com a `leitura` 2. |
| 19/11/2026 | 4 | Feito: este registro, o commit (só este arquivo) e `git push origin fila-19-11-pagamentos-3`, às 11h30. |
