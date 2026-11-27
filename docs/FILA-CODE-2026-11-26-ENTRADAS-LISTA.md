# Fila do Claude Code — 26/11/2026 (noite) · a lista das notas de fora do RS, a primeira vez · branch `fila-26-11-entradas-lista`

> **Para o Code do PC do escritório.** **Leia este arquivo inteiro antes de começar.** Faça os itens **inteiros, sem
> parar pra perguntar**: nenhum item precisa do Samuel na frente do PC. Ao terminar: o **Registro de progresso** (fim
> deste arquivo) preenchido, commit e `git push origin fila-26-11-entradas-lista`. **Nunca** push em `main` nem merge pra
> ela.

## O que é
- A função `ponte` passou a **guardar a lista** que a etapa das datas de entrada já manda todo dia (a chave e a data de
  entrada de cada NF-e de compra de fora do RS das empresas da SEDIF/DeSTDA): a Conferência SEDIF/DeSTDA mostra, por
  empresa e mês, as notas de fora do RS que a Domínio tem e não estão no sistema. **A ponte não muda**: é a mesma etapa,
  a mesma consulta e o mesmo pacote; o que mudou foi o que a função faz com ele.
- A rodada das 7h manda a lista sozinha. Esta fila só **adianta a primeira vez**, pra conferir hoje à noite, antes da
  Thalia usar a tela amanhã.
- **Nada de código muda aqui.**

## Regras (as de sempre)
- **Não abra o `C:\ponte-dominio\config.ini`** (nem Read, `type`, `cat` ou `Get-Content`).
- **Não rode nada entre 6h50 e 7h20, nem entre 8h20 e 9h00**: são as duas tarefas do dia. Se a hora chegar no meio,
  espere a tarefa acabar.
- **Não rode a ponte da Receita** (nem `receita rodar`, nem o `receita conferir`). Nem o `py -3 -m ponte rodar`: os
  totais rodam sozinhos às 7h. Nem o `sedif rodar`. Só o `entradas rodar` do item 2.
- **Repositório público**: nada de nome de cliente, CNPJ, chave de nota, código de empresa, número de nota, produto ou
  valor. No registro, **só os totais**. O log da etapa sai por empresa, pelo código: não copie essas linhas.
- **Não mexa no código.** Se o item falhar por causa do código, anote o erro (sem dado de cliente) e pare: o conserto é
  do Claude da sessão do Samuel.
- Commits em pt-BR.

## 1. A branch
```
git fetch origin --prune
git checkout main
git pull
git checkout -b fila-26-11-entradas-lista
```

## 2. A etapa das datas de entrada, uma vez
Da pasta da ponte instalada (leva uns 2 minutos):
```
cd C:\ponte-dominio\app
py -3 -m ponte entradas rodar
```
Anote o código de saída, a hora do começo e a do fim e, do log, só as linhas sem código de empresa: o total
(`entradas: N nota(s) de M empresa(s)`, com o "de fora: …", se tiver). Das linhas do pacote (o `entradas: pacote …`),
anote **a soma**: quantas o sistema recebeu, quantas achou na base, quantas ficaram com a data nova e quantas deixou de
fora — o esperado é **nenhuma**; se tiver, o motivo, sem números.

Se der erro no envio (o sistema fora, HTTP 5xx), anote e não repita.

## 3. Fim
Commit deste arquivo (o registro preenchido) e `git push origin fila-26-11-entradas-lista`.

## Registro de progresso
| Data | Item | O que aconteceu |
|---|---|---|
| 26/11/2026 | 1 | Feito às 22h38, pelo plantão das 22h38: `git fetch --prune`, `main` atualizada (em `d891844`), a branch `fila-26-11-entradas-lista`. A ponte instalada é a `0.7.0`. |
| 26/11/2026 | 2 | Da pasta da ponte instalada: `py -3 -m ponte entradas rodar`, código **0**, das **22h38m48s às 22h39m28s** (o maior tempo de uma empresa, 4,5 s; nenhuma com erro na leitura). `entradas: 35 empresa(s) da SEDIF/DeSTDA, de 01/09/2026 a 26/11/2026` · `entradas: 372 nota(s) de 25 empresa(s)` (sem "de fora"). O pacote: **1 de 1**, foi (HTTP 200); o sistema **recebeu 372**, **achou 303 na base** e **0 ficaram com a data nova**; **deixou de fora: nenhuma**. (Às 15h43, a mesma etapa achou 242 na base; as outras entraram com as notas da SEDIF/DeSTDA desta tarde, que já trouxeram a data de entrada.) |
| 26/11/2026 | 3 | Feito: este registro, o commit (só este arquivo) e `git push origin fila-26-11-entradas-lista`. |
