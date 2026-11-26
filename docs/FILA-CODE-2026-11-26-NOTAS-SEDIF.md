# Fila do Claude Code — 26/11/2026 · a ponte 0.7.0 (as notas de entrada da SEDIF/DeSTDA, com os itens) · branch `fila-26-11-notas-sedif`

> **Para o Code do PC do escritório.** **Leia este arquivo inteiro antes de começar.** Faça os itens **inteiros, sem
> parar pra perguntar**: nenhum item precisa do Samuel na frente do PC. Ao terminar: o **Registro de progresso** (fim
> deste arquivo) preenchido, commit e `git push origin fila-26-11-notas-sedif`. **Nunca** push em `main` nem merge pra
> ela.

## O que é
- A Thalia faz a Conferência SEDIF/DeSTDA no sistema com os XMLs de entrada do mês, que ela **exporta da Domínio** e
  solta na tela — a de uma empresa tinha 1.222 notas num mês, e a exportação demorou. O pedido dela: a ponte buscar as
  notas de entrada direto da Domínio (o "Vai" do Samuel, 26/11/2026, 15h35).
- **A ponte 0.7.0** (na `main`) faz isso, no fim da tarefa das 7h, depois das datas de entrada (a 0.6.0): pede ao
  sistema a mesma lista (as empresas da SEDIF/DeSTDA, pelo código do Domínio, e a janela — o mês de hoje e os dois
  antes), lê de cada empresa as NF-e de compra da janela, de todos os estados, pela data de entrada
  (`ponte/consultas/sedif_lista.sql`: a chave, a data, o tipo do fornecedor e se o catálogo da Domínio Atendimento ainda
  tem o XML), busca o XML **só das que ainda não foram** (`notas_xml.sql`, a mesma da ponte das notas), lê cada uma
  como o importador dos XMLs do sistema lê (`ponte/nfe.py`) e manda, empresa por empresa, em pacotes de até 200 notas.
  **O XML não sai do PC**: vai a nota e os itens (o fornecedor, os totais e, de cada item, o NCM, o CFOP, os valores, a
  base, a alíquota e o valor do ICMS, a ST, o IPI, o PIS e a Cofins). A nota de fornecedor pessoa física não vai. O que
  já foi fica em `C:\ponte-dominio\sedif\estado.json` (só a chave e a data de entrada de cada nota).
- O sistema já recebe (a função `ponte` e o banco, publicados hoje) e grava como a importação dos XMLs grava. Esta
  fila confere a consulta no Domínio, instala a 0.7.0 e manda a primeira vez. **A conferência com as notas que a Thalia
  já importou pelos XMLs é do Claude da sessão do Samuel, no banco**: aqui, só os totais.
- O código: `ponte/sedif.py` e `ponte/nfe.py`; o LEIA-ME, a seção "As notas de entrada da SEDIF/DeSTDA, com os itens".

## Regras (as de sempre)
- **Não abra o `C:\ponte-dominio\config.ini`** (nem Read, `type`, `cat` ou `Get-Content`).
- **Não rode nada entre 6h50 e 7h20, nem entre 8h20 e 9h00**: são as duas tarefas do dia. Se a hora chegar no meio,
  espere a tarefa acabar.
- **Não rode a ponte da Receita** (nem `receita rodar`, nem o `receita conferir`). Nem o `py -3 -m ponte rodar`: os
  totais rodam sozinhos às 7h. Só os testes, o `sedif rodar` dos itens 2 e 4 e o instalador.
- **Repositório público**: nada de nome de cliente, CNPJ, chave de nota, código de empresa, número de nota, produto ou
  valor. No registro, **só os totais** (o log das notas sai por empresa, pelo código: não copie essas linhas). Se for
  preciso olhar algo no Domínio com o `dominio sql`, **não escreva aqui a consulta com o código da empresa** — nem no
  registro, nem no commit: o código é dado de cliente.
- **Não mexa no código.** Se um item falhar por causa do código ou da consulta, anote o erro (sem dado de cliente) e
  pare: o conserto é do Claude da sessão do Samuel.
- Commits em pt-BR.

## 1. Os testes
```
git fetch origin --prune
git checkout main
git pull
git checkout -b fila-26-11-notas-sedif
py -3 tests/ponte-sedif.test.py
py -3 tests/ponte-entradas.test.py
py -3 tests/ponte.test.py
py -3 tests/ponte-notas.test.py
```
Os quatro têm de terminar em "Tudo certo.". Anote a `VERSAO` da ponte instalada (`C:\ponte-dominio\app\ponte\__init__.py`:
`0.6.0`) e a da `main` (`0.7.0`). Se um teste não terminar em "Tudo certo.", **pare aqui**: registro e push.

## 2. A consulta no Domínio, sem mandar nada
Da pasta do repositório (o código da `main`, com o `config.ini` de sempre):
```
py -3 -m ponte sedif rodar --sem-enviar
```
Ele pede a lista ao sistema, roda a `sedif_lista.sql` em cada empresa, busca o XML das notas que iriam (todas, nesta
primeira vez: o estado ainda não existe), lê e confere cada uma — e não manda nada nem grava o estado. Pode levar
alguns minutos (o XML de três meses de notas). Anote:
- a hora do começo e a do fim;
- a linha `sedif: N empresa(s) da SEDIF/DeSTDA, de dd/mm/aaaa a dd/mm/aaaa`;
- a linha do total, `sedif: N nota(s) iriam de M empresa(s)`, **com o "de fora: …" inteiro** (é por ela que se sabe
  quantas notas não têm o XML na Domínio — "sem o XML na Domínio" — e quantas ficaram de fora por outro motivo);
- o maior tempo de uma empresa (o "(X s)" no fim das linhas por empresa — só o número, sem o código) e quantas empresas
  deram erro na leitura (`a leitura da Domínio deu erro`; o tipo do erro, se houver).

Se a leitura der erro em todas as empresas (a consulta não roda no SQL Anywhere), **pare aqui**: anote o tipo do erro e a
mensagem do driver **sem** nada de cliente, registro e push. O código de saída esperado é 0.

## 3. Instalar
Da pasta do repositório:
```
powershell -NoProfile -ExecutionPolicy Bypass -File ponte\instalar.ps1 -Hora 07:00
```
Anote a última linha. Confira que `C:\ponte-dominio\app\ponte\__init__.py` tem `VERSAO = '0.7.0'`, que
`C:\ponte-dominio\app\ponte\consultas\sedif_lista.sql` e `C:\ponte-dominio\app\ponte\nfe.py` existem e que as duas
tarefas seguem como antes (a "Ponte Domínio" todo dia às 07:00; a "Ponte Receita" de segunda a sexta às 08:30; as duas
com o "executar assim que possível" ligado).

## 4. A primeira vez, mandando
Da pasta da ponte instalada (de novo, pode levar alguns minutos):
```
cd C:\ponte-dominio\app
py -3 -m ponte sedif rodar
```
Anote o código de saída, a hora do começo e a do fim e, do log, só as linhas sem código de empresa: o total
(`sedif: N nota(s) mandada(s) de M empresa(s)`, com o "de fora: …"). Das linhas dos pacotes (essas têm o código: não
copie), anote só a **soma**: quantos pacotes foram, quantas notas o sistema recebeu, quantas eram novas na base, quantas
já estavam, quantos itens foram completados, quantas datas de entrada ficaram novas e, se tiver, quantas o sistema
deixou de fora (e o motivo, sem números). "Já estavam" são as que a Thalia importou pelos XMLs. Se a tarefa das 7h de
amanhã rodar antes deste item, as notas já terão ido nela: aí "vão" vem zero, e está certo.

Se der erro no envio (o sistema fora, HTTP 5xx), anote e não repita: o que não foi vai sozinho na tarefa das 7h.

## 5. Fim
Commit deste arquivo (o registro preenchido) e `git push origin fila-26-11-notas-sedif`.

## Registro de progresso
| Data | Item | O que aconteceu |
|---|---|---|
| 26/11/2026 | 1 | Feito às 17h38, pelo plantão das 17h38: `git fetch --prune`, `main` atualizada (em `3e4f30b`), a branch `fila-26-11-notas-sedif`. `py -3 tests/ponte-sedif.test.py`: "Tudo certo." (7 s); `py -3 tests/ponte-entradas.test.py`: "Tudo certo." (7 s); `py -3 tests/ponte.test.py`: "Tudo certo." (62 s); `py -3 tests/ponte-notas.test.py`: "Tudo certo." (14 s). A `VERSAO` da ponte instalada: `0.6.0`; a da `main`: `0.7.0`. |
| 26/11/2026 | 2 | Da pasta do repositório: `py -3 -m ponte sedif rodar --sem-enviar`, código **0**, das **17h40m43s às 17h55m04s**. `sedif: 35 empresa(s) da SEDIF/DeSTDA, de 01/09/2026 a 26/11/2026` · `sedif: 1712 nota(s) iriam de 30 empresa(s); de fora: 1230 sem o XML na Domínio, 22 de emitente pessoa física`. O maior tempo de uma empresa: **88,2 s**. **Nenhuma** empresa com erro na leitura: a consulta roda no SQL Anywhere. As linhas por empresa (com o código) não foram copiadas. |
| 26/11/2026 | 3 | Feito às 17h55: `powershell -NoProfile -ExecutionPolicy Bypass -File ponte\instalar.ps1 -Hora 07:00`, código 0, sem pedir o administrador. A última linha: `py -3 -m ponte rodar --sem-enviar` (do aviso padrão "Antes da primeira rodada: …"; antes dele, "Tarefa 'Ponte Domínio' registrada: todo dia às 07:00 (os últimos 14 meses), como DESKTOP-OB3NBFV\PC (sem guardar senha)."). Conferido: `VERSAO = '0.7.0'` na instalada; `C:\ponte-dominio\app\ponte\consultas\sedif_lista.sql` e `C:\ponte-dominio\app\ponte\nfe.py` existem; a "Ponte Domínio", `Ready`, todo dia às 07:00; a "Ponte Receita", `Ready`, de segunda a sexta (`DaysOfWeek` 62) às 08:30; as duas com o `StartWhenAvailable` ligado. |
| 26/11/2026 | 4 | Da pasta da ponte instalada: `py -3 -m ponte sedif rodar`, código **0**, das **17h55m29s às 18h10m12s** (o maior tempo de uma empresa, 112,2 s; nenhuma com erro na leitura). `sedif: 1712 nota(s) mandada(s) de 30 empresa(s); de fora: 1230 sem o XML na Domínio, 22 de emitente pessoa física`. A soma das linhas dos pacotes: **31 pacotes**, todos foram (HTTP 200); o sistema **recebeu 1.690**, **296 novas** na base, **1.394 já estavam** (as que a Thalia importou pelos XMLs), **0 itens completados**, **1.236 com a data de entrada nova**. **O sistema deixou de fora 22** (1.690 + 22 = as 1.712): 8 por `notas[].doc.finalidade: fora dos valores possíveis` e 14 por `notas[].doc.emit_doc: o emitente do XML não é o da chave` — a ponte não manda essas de novo do mesmo jeito; a conferir na sessão do Samuel. Nenhum erro de envio. |
| 26/11/2026 | 5 | Feito: este registro, o commit (só este arquivo) e `git push origin fila-26-11-notas-sedif`, às 18h11. |
