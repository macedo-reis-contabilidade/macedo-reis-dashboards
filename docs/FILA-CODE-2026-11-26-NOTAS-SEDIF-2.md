# Fila do Claude Code — 26/11/2026 (noite) · as notas de entrada da SEDIF/DeSTDA: o que faltou na primeira leva · branch `fila-26-11-notas-sedif-2`

> **Para o Code do PC do escritório.** **Leia este arquivo inteiro antes de começar.** Faça os itens **inteiros, sem
> parar pra perguntar**: nenhum item precisa do Samuel na frente do PC. Ao terminar: o **Registro de progresso** (fim
> deste arquivo) preenchido, commit e `git push origin fila-26-11-notas-sedif-2`. **Nunca** push em `main` nem merge pra
> ela.

## O que é
- A primeira leva da ponte 0.7.0 (a fila `docs/FILA-CODE-2026-11-26-NOTAS-SEDIF.md`, feita às 17h55) mandou 1.712
  notas; o sistema recebeu 1.690 e deixou de fora 22: **14 NF-e avulsas** (a série 890, que o Fisco emite pro vendedor
  sem emissor próprio: a chave leva o CNPJ do Fisco, e o XML, o vendedor) e **8 notas de débito** (a finalidade 6, da
  Reforma). A função `ponte` passou a aceitar as duas (publicada nesta noite). A ponte não manda de novo o que o sistema
  recusou, então elas só vão com o `--tudo` (o item 3).
- Ficaram de fora também **1.230 notas sem o XML** no Catálogo de Notas da Domínio Atendimento e 22 de fornecedor
  pessoa física. Pra conferência da Thalia, o que pesa são as notas **de fora do RS** (o DIFAL e o ICMS-ST na entrada):
  o item 2 conta, por mês, quantas de fora e quantas do RS ficaram sem o XML, sem nada de cliente.
- **Nada de código muda aqui.** O item 2 roda um rascunho que só conta (`ponte/rascunhos/sedif_contagem.py`, fora da
  ponte); o item 3 roda a ponte instalada com o `--tudo`.

## Regras (as de sempre)
- **Não abra o `C:\ponte-dominio\config.ini`** (nem Read, `type`, `cat` ou `Get-Content`).
- **Não rode nada entre 6h50 e 7h20, nem entre 8h20 e 9h00**: são as duas tarefas do dia. Se a hora chegar no meio,
  espere a tarefa acabar.
- **Não rode a ponte da Receita** (nem `receita rodar`, nem o `receita conferir`). Nem o `py -3 -m ponte rodar`: os
  totais rodam sozinhos às 7h. Só o teste, o rascunho do item 2 e o `sedif rodar --tudo` do item 3.
- **Repositório público**: nada de nome de cliente, CNPJ, chave de nota, código de empresa, número de nota, produto ou
  valor. No registro, **só os totais**. O rascunho do item 2 já escreve só as contagens somadas; o log da ponte sai por
  empresa, pelo código: não copie essas linhas.
- **Não mexa no código.** Se um item falhar por causa do código, anote o erro (sem dado de cliente) e pare: o conserto
  é do Claude da sessão do Samuel.
- Commits em pt-BR.

## 1. O teste
```
git fetch origin --prune
git checkout main
git pull
git checkout -b fila-26-11-notas-sedif-2
py -3 tests/ponte-sedif.test.py
```
Tem de terminar em "Tudo certo.". Se não terminar, **pare aqui**: registro e push.

## 2. Quantas notas ficaram sem o XML, por mês (só conta)
Da pasta do repositório:
```
py -3 ponte\rascunhos\sedif_contagem.py
```
Ele pede ao sistema a lista (as empresas da SEDIF/DeSTDA e a janela), roda a `sedif_lista.sql` de cada empresa e
escreve uma tabela: o mês da data de entrada, RS ou fora, o grupo (com o XML, sem o XML, pessoa física), quantas notas
e de quantas empresas. **Copie a tabela inteira pro registro** (é só contagem somada) e anote o código de saída (0; 1
quando alguma empresa deu erro na leitura — anote quantas, sem o código).

## 3. As 22 que o sistema recusou, de novo
Da pasta da ponte instalada (pode levar uns 15 minutos: vai a janela inteira de novo, e o sistema grava só o que
mudou):
```
cd C:\ponte-dominio\app
py -3 -m ponte sedif rodar --tudo
```
Anote o código de saída, a hora do começo e a do fim e, do log, só as linhas sem código de empresa: o total
(`sedif: N nota(s) mandada(s) de M empresa(s)`, com o "de fora: …"). Das linhas dos pacotes (essas têm o código: não
copie), anote só a **soma**: quantos pacotes foram, quantas notas o sistema recebeu, quantas eram novas na base,
quantas já estavam, quantos itens foram completados, quantas datas de entrada ficaram novas e quantas o sistema deixou
de fora — o esperado agora é **nenhuma**; se tiver, o motivo, sem números.

Se der erro no envio (o sistema fora, HTTP 5xx), anote e não repita.

## 4. Fim
Commit deste arquivo (o registro preenchido) e `git push origin fila-26-11-notas-sedif-2`.

## Registro de progresso
| Data | Item | O que aconteceu |
|---|---|---|
