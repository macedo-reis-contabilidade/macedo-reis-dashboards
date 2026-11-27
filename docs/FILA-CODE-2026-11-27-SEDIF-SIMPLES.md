# Fila do Claude Code — 27/11/2026 · SEDIF/DeSTDA com as empresas do Simples todas, a primeira leitura · branch `fila-27-11-sedif-simples`

> **Para o Code do PC do escritório.** **Leia este arquivo inteiro antes de começar.** Faça os itens **inteiros, sem
> parar pra perguntar**: nenhum item precisa do Samuel na frente do PC. Ao terminar: o **Registro de progresso** (fim
> deste arquivo) preenchido, commit e `git push origin fila-27-11-sedif-simples`. **Nunca** push em `main` nem merge pra
> ela.

## O que é
- A Conferência SEDIF/DeSTDA passou a conferir **todas as empresas do Simples Nacional da carteira**, e não só as 35 da
  obrigação (pedido da Thalia). A função `ponte` já devolve a lista nova à ponte: no pedido das empresas
  (`{tipo: 'entradas', pedir: 'empresas'}`) vêm agora umas **76** (as 35 e mais 41 do Simples).
- **A ponte não muda**: as duas etapas (`entradas` e `sedif`) leem as empresas que a função manda. A rodada das 7h de
  amanhã já leria as novas sozinha. Esta fila só **adianta a primeira vez**, pra Thalia usar hoje.
- **Nada de código muda aqui.**

## Regras (as de sempre)
- **Não abra o `C:\ponte-dominio\config.ini`** (nem Read, `type`, `cat` ou `Get-Content`).
- **Não rode nada entre 6h50 e 7h20, nem entre 8h20 e 9h00**: são as duas tarefas do dia. Se a hora chegar no meio,
  espere a tarefa acabar.
- **Não rode a ponte da Receita** (nem `receita rodar`, nem o `receita conferir`). Nem o `py -3 -m ponte rodar`: os
  totais rodam sozinhos às 7h. Só as duas etapas dos itens 2 e 3.
- **Repositório público**: nada de nome de cliente, CNPJ, chave de nota, código de empresa, número de nota, produto ou
  valor. No registro, **só os totais**. O log das etapas sai por empresa, pelo código: não copie essas linhas.
- **Não mexa no código.** Se um item falhar por causa do código, anote o erro (sem dado de cliente) e pare: o conserto é
  do Claude da sessão do Samuel.
- Commits em pt-BR.

## 1. A branch
```
git fetch origin --prune
git checkout main
git pull
git checkout -b fila-27-11-sedif-simples
```

## 2. A etapa das datas de entrada (a lista da Domínio), uma vez
Da pasta da ponte instalada (uns 2 a 4 minutos):
```
cd C:\ponte-dominio\app
py -3 -m ponte entradas rodar
```
Anote o código de saída, a hora do começo e a do fim e, do log, só as linhas sem código de empresa: quantas empresas
(`entradas: N empresa(s) da SEDIF/DeSTDA, …` — o esperado é perto de **76**), o total de notas e de empresas com nota, e o
"de fora", se tiver. Do pacote (o `entradas: pacote …`), **a soma**: quantas o sistema recebeu, achou na base, ficaram com
a data nova e deixou de fora (o esperado é **nenhuma**; se tiver, o motivo, sem números).

## 3. A etapa das notas de entrada, uma vez
Da mesma pasta (pode levar de 15 minutos a uma hora: as 41 empresas novas vêm com as notas da janela inteira):
```
py -3 -m ponte sedif rodar
```
Anote o código de saída, a hora do começo e a do fim e, do log, **só os totais**: quantas empresas, quantas notas foram,
quantas o sistema recebeu, quantas novas, quantas já estavam na base, e as de fora por motivo (sem o XML no Catálogo de
Notas, fornecedor pessoa física, XML ilegível, recusadas pelo sistema). Se o sistema recusar o pacote de uma empresa
(422), anote **quantas** e o motivo, sem o código.

Se der erro no envio (o sistema fora, HTTP 5xx), anote e não repita.

## 4. Fim
Commit deste arquivo (o registro preenchido) e `git push origin fila-27-11-sedif-simples`.

## Registro de progresso
| Data | Item | O que aconteceu |
|---|---|---|
| 27/11/2026 | 1 | Feito às 09h38, pelo plantão das 09h38 (as duas filas de 27/11 entraram no mesmo commit; esta primeiro, como a do eSocial pede): `git fetch --prune`, `main` atualizada (em `4f3ff92`), a branch `fila-27-11-sedif-simples`. A ponte instalada é a `0.7.0`. |
| 27/11/2026 | 2 | Da pasta da ponte instalada: `py -3 -m ponte entradas rodar`, código **0**, das **09h39m07s às 09h40m17s** (o maior tempo de uma empresa, 5,2 s; nenhuma com erro na leitura). `entradas: 76 empresa(s) da SEDIF/DeSTDA, de 01/09/2026 a 27/11/2026` · `entradas: 388 nota(s) de 31 empresa(s)` (sem "de fora"). O pacote: **1 de 1**, foi (HTTP 200); o sistema **recebeu 388**, **achou 303 na base**, **0 com a data nova**; **deixou de fora: nenhuma**. |
| 27/11/2026 | 3 | Da mesma pasta: `py -3 -m ponte sedif rodar`, código **0**, das **09h40m27s às 09h49m39s** (o maior tempo de uma empresa, 55,7 s; nenhuma com erro na leitura). `sedif: 76 empresa(s) da SEDIF/DeSTDA, de 01/09/2026 a 27/11/2026` · `sedif: 836 nota(s) mandada(s) de 23 empresa(s); de fora: 1595 sem o XML na Domínio, 30 de emitente pessoa física` (o "de fora" é da janela inteira das 76; as notas já mandadas das 35 de antes não vão de novo). A soma dos pacotes: **23 pacotes**, todos foram (HTTP 200); o sistema **recebeu 836**, **836 novas** na base, **0 já estavam**, 0 itens completados, 0 datas novas. Nenhum XML ilegível, **nenhuma recusada pelo sistema**, nenhum pacote recusado (422), nenhum erro de envio. |
| 27/11/2026 | 4 | Feito: este registro, o commit (só este arquivo) e `git push origin fila-27-11-sedif-simples`. |
