# Fila do Claude Code — 19/11/2026 · a ponte da Receita 0.4.3, só instalar · branch `fila-19-11-pagamentos-4`

> **Para o Code do PC do escritório.** **Leia este arquivo inteiro antes de começar.** Faça os itens **inteiros, sem
> parar pra perguntar**: nenhum item precisa do Samuel na frente do PC. Ao terminar: o **Registro de progresso** (fim
> deste arquivo) preenchido, commit e `git push origin fila-19-11-pagamentos-4`. **Nunca** push em `main` nem merge pra
> ela.

## O que é
- A releitura da fila anterior chegou inteira ao sistema, com o código de cada tributo certo.
- Faltou um detalhe: a produção põe a descrição longa ("DOCUMENTO DE ARRECADAÇÃO DO SIMPLES NACIONAL") no campo que
  a documentação mostra como o nome curto, e o tipo da guia seguiu longo. A **ponte da Receita 0.4.3** (na `main`) tira
  o nome curto do código do tipo (DARF, DAS, DAE…). No banco as guias já foram acertadas; **não há nada a ler de novo**.
- Esta fila só instala a 0.4.3, pra próxima consulta de pagamentos (dia 25) já gravar o nome curto. **Nenhuma consulta
  ao Serpro.**

## Regras (as de sempre)
- **Não abra o `C:\ponte-dominio\config.ini`** (nem Read, `type`, `cat` ou `Get-Content`).
- **Não rode nada entre 6h50 e 7h20, nem entre 8h20 e 9h00**: são as duas tarefas do dia. Se a hora chegar no meio,
  espere a tarefa acabar.
- **Não rode a ponte** (nem `rodar`, nem `--so`): só os testes e o instalador.
- **Repositório público**: nada de nome de cliente, CNPJ, código de empresa, número de guia, valor, chave ou link.
- **Não mexa no código.** Se um item falhar por causa do código, anote o erro e pare: o conserto é do Claude da sessão
  do Samuel.
- Commits em pt-BR.

## 1. O teste
```
git fetch origin --prune
git checkout main
git pull
git checkout -b fila-19-11-pagamentos-4
py -3 tests/ponte-receita.test.py
py -3 tests/ponte.test.py
```
Os dois têm de terminar em "Tudo certo.". Anote a `VERSAO` da ponte instalada
(`C:\ponte-dominio\app\ponte\receita\__init__.py`, deve ser `0.4.2`) e a da `main` (`0.4.3`). Se um teste não terminar
em "Tudo certo.", **pare aqui**: registro e push.

## 2. Instalar
Da pasta do repositório:
```
powershell -NoProfile -ExecutionPolicy Bypass -File ponte\instalar.ps1 -Hora 07:00
```
Anote a última linha. Confira que `C:\ponte-dominio\app\ponte\receita\__init__.py` tem `VERSAO = '0.4.3'` e que as duas
tarefas seguem como antes (a "Ponte Domínio" todo dia às 07:00; a "Ponte Receita" de segunda a sexta às 08:30; as duas
com o "executar assim que possível" ligado).

## 3. Fim
Commit deste arquivo (o registro preenchido) e `git push origin fila-19-11-pagamentos-4`.

## Registro de progresso
| Data | Item | O que aconteceu |
|---|---|---|
| 19/11/2026 | 1 | Feito às 12h20: `git fetch --prune`, `main` atualizada (em `7cb6323`), a branch `fila-19-11-pagamentos-4`. `py -3 tests/ponte-receita.test.py`: "Tudo certo."; `py -3 tests/ponte.test.py`: "Tudo certo." (às 12h23). A `VERSAO` da ponte instalada: `0.4.2`; a da `main`: `0.4.3`. |
| 19/11/2026 | 2 | Feito às 12h23: `powershell -NoProfile -ExecutionPolicy Bypass -File ponte\instalar.ps1 -Hora 07:00`, código 0, sem pedir o administrador. A última linha: `py -3 -m ponte rodar --sem-enviar` (do aviso padrão "Antes da primeira rodada: …"; antes dele, "Tarefa 'Ponte Domínio' registrada: todo dia às 07:00 (os últimos 14 meses), como DESKTOP-OB3NBFV\PC (sem guardar senha)."). Conferido: `VERSAO = '0.4.3'` na instalada; a "Ponte Domínio", `Ready`, todo dia às 07:00; a "Ponte Receita", `Ready`, de segunda a sexta (`DaysOfWeek` 62) às 08:30; as duas com o `StartWhenAvailable` ligado. A ponte não foi rodada e não houve nenhuma consulta ao Serpro. |
| 19/11/2026 | 3 | Feito: este registro, o commit (só este arquivo) e `git push origin fila-19-11-pagamentos-4`, às 12h25. |
| 19/11/2026 | Conferência (sessão do Samuel) | O registro conferido: a 0.4.3 instalada, as duas tarefas como antes, nenhuma consulta ao Serpro. A próxima consulta de pagamentos é a do dia 25, já com o nome curto do tipo. |
