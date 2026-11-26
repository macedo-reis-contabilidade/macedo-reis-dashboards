# Fila do Claude Code — 19/11/2026 · a ponte da Receita 0.4.4 (de quem é a procuração), só instalar · branch `fila-19-11-procuracao`

> **Para o Code do PC do escritório.** **Leia este arquivo inteiro antes de começar.** Faça os itens **inteiros, sem
> parar pra perguntar**: nenhum item precisa do Samuel na frente do PC. Ao terminar: o **Registro de progresso** (fim
> deste arquivo) preenchido, commit e `git push origin fila-19-11-procuracao`. **Nunca** push em `main` nem merge pra
> ela.

## O que é
- O Samuel pediu que a tela **Integrações › Receita** mostre de quem é a procuração de cada empresa: a do CNPJ do
  escritório ou a do CPF do procurador. Isso só o PC sabe (o `via` do `estado.json`); o pacote não levava.
- A **ponte da Receita 0.4.4** (na `main`) passa a mandar, em todo pacote, a lista `vias`: de cada empresa que o
  `estado.json` conhece com procuração, `escritorio` ou `procurador`. Vai a palavra, nunca o CPF. Sai do que o estado já
  lembra: **nenhuma consulta a mais ao Serpro**.
- O sistema já está pronto pra receber (a coluna no banco e a função). Esta fila **só instala** a 0.4.4: a próxima
  rodada da tarefa "Ponte Receita" (de segunda a sexta às 8h30) manda a lista sozinha, e o Claude da sessão do Samuel
  confere no banco.

## Regras (as de sempre)
- **Não abra o `C:\ponte-dominio\config.ini`** (nem Read, `type`, `cat` ou `Get-Content`).
- **Não rode nada entre 6h50 e 7h20, nem entre 8h20 e 9h00**: são as duas tarefas do dia. Se a hora chegar no meio,
  espere a tarefa acabar.
- **Não rode a ponte**: nem `rodar`, nem `--so`, nem o `conferir` da Receita (ele manda o termo do procurador ao
  Serpro). Só os testes, o instalador e a contagem do item 3. O teto de consultas de novembro está perto do fim.
- **Não abra o `C:\ponte-dominio\receita\estado.json` na tela** (ele tem o CNPJ dos clientes): só o comando do item 3,
  que imprime contagens.
- **Repositório público**: nada de nome de cliente, CNPJ, CPF, código de empresa, número de guia, valor, chave ou link.
- **Não mexa no código.** Se um item falhar por causa do código, anote o erro e pare: o conserto é do Claude da sessão
  do Samuel.
- Commits em pt-BR.

## 1. O teste
```
git fetch origin --prune
git checkout main
git pull
git checkout -b fila-19-11-procuracao
py -3 tests/ponte-receita.test.py
py -3 tests/ponte.test.py
```
Os dois têm de terminar em "Tudo certo.". Anote a `VERSAO` da ponte instalada
(`C:\ponte-dominio\app\ponte\receita\__init__.py`, deve ser `0.4.3`) e a da `main` (`0.4.4`). Se um teste não terminar
em "Tudo certo.", **pare aqui**: registro e push.

## 2. Instalar
Da pasta do repositório:
```
powershell -NoProfile -ExecutionPolicy Bypass -File ponte\instalar.ps1 -Hora 07:00
```
Anote a última linha. Confira que `C:\ponte-dominio\app\ponte\receita\__init__.py` tem `VERSAO = '0.4.4'` e que as duas
tarefas seguem como antes (a "Ponte Domínio" todo dia às 07:00; a "Ponte Receita" de segunda a sexta às 08:30; as duas
com o "executar assim que possível" ligado).

## 3. A contagem (só números)
O que a lista vai levar na próxima rodada, contado do `estado.json` sem mostrar nenhuma empresa:
```
py -3 -c "import json, collections, pathlib; d = json.loads(pathlib.Path(r'C:\ponte-dominio\receita\estado.json').read_text(encoding='utf-8')); print(dict(collections.Counter((a.get('situacao') or 'sem situacao') + (' pelo procurador' if a.get('via') == 'procurador' else '') for a in (d.get('autorizacao') or {}).values())))"
```
Anote a linha que sair (por exemplo `{'ativa': 25, 'ativa pelo procurador': 59, 'sem': 21}`): são só contagens. Se o
comando der erro, anote o erro (sem o conteúdo do arquivo) e siga.

## 4. Fim
Commit deste arquivo (o registro preenchido) e `git push origin fila-19-11-procuracao`.

## Registro de progresso
| Data | Item | O que aconteceu |
|---|---|---|
| 26/11/2026 | 1 | Feito às 14h31 (a fila ficou parada de 19 a 26/11: o plantão contava como preenchidas as linhas que só têm o número do item, e não a viu): `git fetch --prune`, `main` atualizada (em `c697ee3`), a branch `fila-19-11-procuracao`. `py -3 tests/ponte-receita.test.py`: "Tudo certo." (239 s); `py -3 tests/ponte.test.py`: "Tudo certo." (57 s), às 14h36. A `VERSAO` da ponte da Receita instalada: `0.4.3`; a da `main`: `0.4.4`. A `main` de agora leva também a ponte do Domínio `0.6.0` (a instalada era a `0.5.0`), da fila de 26/11. |
| 26/11/2026 | 2 | Feito às 14h36: `powershell -NoProfile -ExecutionPolicy Bypass -File ponte\instalar.ps1 -Hora 07:00`, código 0, sem pedir o administrador. A última linha: `py -3 -m ponte rodar --sem-enviar` (do aviso padrão "Antes da primeira rodada: …"; antes dele, "Tarefa 'Ponte Domínio' registrada: todo dia às 07:00 (os últimos 14 meses), como DESKTOP-OB3NBFV\PC (sem guardar senha)."). Conferido: `VERSAO = '0.4.4'` na Receita instalada e `VERSAO = '0.6.0'` na ponte instalada; a "Ponte Domínio", `Ready`, todo dia às 07:00; a "Ponte Receita", `Ready`, de segunda a sexta (`DaysOfWeek` 62) às 08:30; as duas com o `StartWhenAvailable` ligado. A ponte não foi rodada e não houve nenhuma consulta ao Serpro. |
| 26/11/2026 | 3 | O comando da fila, código 0: `{'ativa pelo procurador': 59, 'ativa': 25, 'sem': 21}`. |
| 26/11/2026 | 4 | Feito: este registro, o commit (só este arquivo) e `git push origin fila-19-11-procuracao`, às 14h38. |
