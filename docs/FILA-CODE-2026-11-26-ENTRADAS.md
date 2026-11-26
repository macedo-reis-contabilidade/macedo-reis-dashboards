# Fila do Claude Code — 26/11/2026 · a ponte 0.6.0 (a data de entrada das notas de fora do RS) · branch `fila-26-11-entradas`

> **Para o Code do PC do escritório.** **Leia este arquivo inteiro antes de começar.** Faça os itens **inteiros, sem
> parar pra perguntar**: nenhum item precisa do Samuel na frente do PC. Ao terminar: o **Registro de progresso** (fim
> deste arquivo) preenchido, commit e `git push origin fila-26-11-entradas`. **Nunca** push em `main` nem merge pra
> ela.

## O que é
- A Thalia achou uma nota que a Domínio apurou na SEDIF/DeSTDA de outubro e a Conferência SEDIF/DeSTDA do sistema punha
  em setembro: emitida em 30/09, ela **entrou na empresa em 01/10**. A Domínio põe a nota no mês da entrada (a data do
  livro, `dent_ent`); o sistema, pelo XML, só sabia a emissão.
- O sistema já guarda a data de entrada de cada nota (`nf_documentos.data_entrada`) e a conferência já usa: até agora, a
  Thalia marca à mão. **A ponte 0.6.0** (na `main`) passa a trazer a da Domínio, sozinha: no fim da tarefa das 7h, depois
  das notas, pede ao sistema as empresas da SEDIF/DeSTDA (pelo código do Domínio) e a janela (o mês de hoje e os dois
  antes), lê de cada uma **só a chave e a data de entrada** das NF-e de compra de fora do RS
  (`ponte/consultas/entradas_fora.sql`) e manda. O sistema grava a data nas notas que já estão na base, e só o que mudou.
  Nada da nota nem do fornecedor sai do PC. O código: `ponte/entradas.py`; o LEIA-ME, a seção "A data de entrada das
  notas de fora do RS".
- A função `ponte` do sistema já recebe (publicada hoje). Esta fila confere a consulta no Domínio, instala a 0.6.0 e roda
  uma vez.

## Regras (as de sempre)
- **Não abra o `C:\ponte-dominio\config.ini`** (nem Read, `type`, `cat` ou `Get-Content`).
- **Não rode nada entre 6h50 e 7h20, nem entre 8h20 e 9h00**: são as duas tarefas do dia. Se a hora chegar no meio,
  espere a tarefa acabar.
- **Não rode a ponte da Receita** (nem `receita rodar`, nem o `receita conferir`). Nem o `py -3 -m ponte rodar`: os
  totais rodam sozinhos às 7h. Só os testes, o `entradas rodar` dos itens 2 e 4 e o instalador.
- **Repositório público**: nada de nome de cliente, CNPJ, chave de nota, código de empresa, número de nota ou valor. No
  registro, **só os totais** (o log das entradas sai por empresa, pelo código: não copie essas linhas).
- **Não mexa no código.** Se um item falhar por causa do código ou da consulta, anote o erro (sem dado de cliente) e
  pare: o conserto é do Claude da sessão do Samuel.
- Commits em pt-BR.

## 1. Os testes
```
git fetch origin --prune
git checkout main
git pull
git checkout -b fila-26-11-entradas
py -3 tests/ponte-entradas.test.py
py -3 tests/ponte.test.py
py -3 tests/ponte-notas.test.py
```
Os três têm de terminar em "Tudo certo.". Anote a `VERSAO` da ponte instalada (`C:\ponte-dominio\app\ponte\__init__.py`:
`0.6.0` se a fila de 19/11 já instalou a `main` de agora, que leva as duas pontes; senão, `0.5.0`) e a da `main`
(`0.6.0`). Se um teste não terminar em "Tudo certo.", **pare aqui**: registro e push.

## 2. A consulta no Domínio, sem mandar nada
Da pasta do repositório (o código da `main`, com o `config.ini` de sempre):
```
py -3 -m ponte entradas rodar --sem-enviar
```
Ele pede a lista ao sistema, roda a `entradas_fora.sql` em cada empresa e só conta. Anote:
- a linha `entradas: N empresa(s) da SEDIF/DeSTDA, de dd/mm/aaaa a dd/mm/aaaa`;
- a linha do total, `entradas: N nota(s) de M empresa(s)` (com o "de fora: …", se tiver);
- o maior tempo de uma empresa (o "em X s" das linhas por empresa — só o número, sem o código) e quantas empresas deram
  erro na leitura (`a leitura da Domínio deu erro`; o tipo do erro, se houver).

Se a leitura der erro em todas as empresas (a consulta não roda no SQL Anywhere), **pare aqui**: anote o tipo do erro e a
mensagem do driver **sem** nada de cliente, registro e push. O código de saída esperado é 0.

## 3. Instalar
Da pasta do repositório:
```
powershell -NoProfile -ExecutionPolicy Bypass -File ponte\instalar.ps1 -Hora 07:00
```
Anote a última linha. Confira que `C:\ponte-dominio\app\ponte\__init__.py` tem `VERSAO = '0.6.0'`, que
`C:\ponte-dominio\app\ponte\consultas\entradas_fora.sql` existe e que as duas tarefas seguem como antes (a "Ponte
Domínio" todo dia às 07:00; a "Ponte Receita" de segunda a sexta às 08:30; as duas com o "executar assim que possível"
ligado).

## 4. A primeira vez, mandando
Da pasta da ponte instalada:
```
cd C:\ponte-dominio\app
py -3 -m ponte entradas rodar
```
Anote o código de saída e, do log, só as linhas sem código de empresa: o total (`entradas: N nota(s) de M empresa(s)`) e
a resposta do sistema (`entradas: pacote 1 de 1 (N nota(s)): N recebida(s), A achada(s) na base, B com a data nova` e,
se tiver, `o sistema deixou de fora N`). "Achadas na base" são as que a Thalia já importou pelos XMLs; as outras ganham a
data quando forem importadas, na rodada seguinte. Se a tarefa das 7h já rodou com a `0.6.0` instalada, as datas já foram
nela: "com a data nova" pode vir zero, e está certo. A partir de amanhã isso roda sozinho, no fim da tarefa das 7h.

## 5. Fim
Commit deste arquivo (o registro preenchido) e `git push origin fila-26-11-entradas`.

## Registro de progresso
| Data | Item | O que aconteceu |
|---|---|---|
| 26/11/2026 | 1 | Feito às 15h41, na mesma sentada das filas de 19/11 (a procuração) e de 24/11 (o teste final): `git fetch --prune`, `main` atualizada (em `6028d94`, já com a fila de 19/11), a branch `fila-26-11-entradas`. `py -3 tests/ponte-entradas.test.py`: "Tudo certo." (10 s); `py -3 tests/ponte.test.py`: "Tudo certo." (57 s); `py -3 tests/ponte-notas.test.py`: "Tudo certo." (16 s). A `VERSAO` da ponte instalada: **`0.6.0`** (a fila de 19/11 instalou a `main` de agora, às 14h36); a da `main`: `0.6.0`. |
| 26/11/2026 | 2 | Feito às 15h42, da pasta do repositório: `py -3 -m ponte entradas rodar --sem-enviar`, código 0. `entradas: 35 empresa(s) da SEDIF/DeSTDA, de 01/09/2026 a 26/11/2026` · `entradas: 372 nota(s) de 25 empresa(s)` · o maior tempo de uma empresa: **4,7 s** · **nenhuma** empresa com erro na leitura. A consulta roda no SQL Anywhere. |
| 26/11/2026 | 3 | Feito às 15h42: `powershell -NoProfile -ExecutionPolicy Bypass -File ponte\instalar.ps1 -Hora 07:00`, código 0, sem pedir o administrador. A última linha: `py -3 -m ponte rodar --sem-enviar` (do aviso padrão "Antes da primeira rodada: …"; antes dele, "Tarefa 'Ponte Domínio' registrada: todo dia às 07:00 (os últimos 14 meses), como DESKTOP-OB3NBFV\PC (sem guardar senha)."). Conferido: `VERSAO = '0.6.0'` na instalada; `C:\ponte-dominio\app\ponte\consultas\entradas_fora.sql` existe; a "Ponte Domínio", `Ready`, todo dia às 07:00; a "Ponte Receita", `Ready`, de segunda a sexta (`DaysOfWeek` 62) às 08:30; as duas com o `StartWhenAvailable` ligado. |
| 26/11/2026 | 4 | Feito às 15h43, da pasta da ponte instalada: `py -3 -m ponte entradas rodar`, código **0**. `entradas: 372 nota(s) de 25 empresa(s)` · `entradas: pacote 1 de 1 (372 nota(s)): foi (HTTP 200)` · `entradas: pacote 1 de 1 (372 nota(s)): 372 recebida(s), 242 achada(s) na base, 242 com a data nova`. Nada deixado de fora pelo sistema. Nenhuma empresa com erro na leitura (o maior tempo, 3,9 s). As linhas por empresa (com o código) não foram copiadas. |
| 26/11/2026 | 5 | Feito: este registro, o commit (só este arquivo) e `git push origin fila-26-11-entradas`, às 15h45. |
