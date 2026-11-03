# Fila do Claude Code — 03/11/2026 · as notas de entrada, nota a nota · branch `fila-notas-entrada`

> **Para o Code do PC do escritório.** **Leia este arquivo inteiro antes de começar**, junto com o
> `docs/FILA-CODE-2026-10-29-DUVIDAS.md` (as tabelas das notas que a ponte já lê). **Faça esta fila antes da
> `docs/FILA-CODE-2026-11-03.md`** (esta é curta). Faça os itens **inteiros, sem parar pra perguntar**: nenhum precisa do
> Samuel na frente do PC. Na dúvida, a opção que **muda menos**, anotada em `docs/FILA-CODE-2026-11-03-NOTAS-DUVIDAS.md`.
> Ao terminar: o **Registro de progresso** (fim deste arquivo) preenchido, commit e `git push origin fila-notas-entrada`.
> **Nunca** push em `main` nem merge pra ela.

## O que é
- Alguns clientes autorizaram o uso das notas de **compra (entrada)** deles numa comparação de preços. O Samuel quer que
  essas notas saiam da Domínio **sozinhas**, sem ninguém exportar XML: a ponte lê da Domínio, manda pro sistema do
  escritório, e o sistema entrega só as notas dos clientes autorizados.
- Hoje a ponte lê só os totais das notas por empresa e mês (`ponte/consultas/fiscal.sql`). Pra comparar preço, o outro
  lado precisa de **cada nota com os itens** (o produto, a quantidade, o valor unitário) e, de preferência, do **XML
  original** (`nfeProc`), que traz o código de barras (EAN).
- Esta fila **só descobre e escreve rascunhos**: onde a Domínio guarda os itens das notas de entrada e o XML, e uma
  consulta de rascunho, numa pasta que a ponte **não lê** (`ponte/rascunhos/`). O contrato do pacote, a função do
  sistema e as tabelas do banco **não mudam aqui** — quem decide e liga é o Claude da sessão do Samuel, depois de revisar.

## Regras (as de 29/10 e de 03/11, que valem todas)
- **Você só lê o catálogo** (`dominio tabelas`) **e contagens** (`dominio sql` com `COUNT`, `SUM`, `MIN`, `MAX`, `LENGTH`
  e `GROUP BY`). **Nunca** traga pra esta conversa uma linha de nota: fornecedor, CNPJ, produto, descrição, valor,
  quantidade ou o XML — nem de uma nota só, nem pra "ver como é". O que precisar ver de verdade fica em arquivo em
  `C:\ponte-dominio\` (fora do repositório) e **não é aberto aqui**: aqui, só contagens e os nomes das colunas.
- **Repositório público**: nada de host, IP, porta, Engine, nome do banco, usuário, senha, nome de cliente, CNPJ, nome de
  fornecedor, produto ou valor. Das tabelas da Domínio, só as que os rascunhos usam (o nome, as colunas usadas e a
  descrição do catálogo) — **nunca o catálogo inteiro** (é a documentação da Thomson Reuters).
- **Não abra o `C:\ponte-dominio\config.ini`** (nem Read, `type`, `cat` ou `Get-Content`).
- Código: crie e mexa **só** em `ponte/rascunhos/*.sql` e nos dois arquivos desta fila. **Não mexa** em
  `ponte/consultas/`, `ponte/*.py`, `supabase/` nem nos testes. Comando da ponte que falhar por causa do código: não
  conserte, anote o erro (a mensagem, sem valores) e siga.
- **Não rode** o `instalar.ps1` e **não rode** o `ponte rodar` sem `--sem-enviar`. Não mexa nas tarefas do Agendador.
- Commits em pt-BR.

## Antes de começar
```
git fetch origin --prune
git checkout main
git pull
git checkout -b fila-notas-entrada
py -3 tests/ponte.test.py
```
O teste da ponte tem de terminar em "Tudo certo.".

## 1. As tabelas
Com `dominio tabelas --procurar …` (`item`, `produto`, `xml`, `chave`, `nfe`, `gtin`, `ean`, `barras`, `fornecedor`,
`unidade`), ache e anote no DUVIDAS (o nome, as colunas usadas e a descrição do catálogo de cada uma):
1. **Os itens das notas de entrada**: a tabela, como ela se liga a uma nota da `bethadba.efentradas` (as colunas que
   identificam a nota) e as colunas de: o produto (o código e a descrição), NCM, CFOP, unidade, quantidade, valor
   unitário, valor total, desconto, IPI e ICMS-ST.
2. **O produto**: o item guarda o código e a descrição **do fornecedor** (os do XML, `cProd` e `xProd`) ou os do
   **cadastro de produtos da empresa** (o de-para da importação)? Tem o código do fornecedor guardado em algum lugar?
   E o **EAN** (GTIN, código de barras): no item, no cadastro do produto, nos dois ou em nenhum?
3. **A chave de acesso** da NF-e (44 dígitos) na nota de entrada: a coluna.
4. **O XML original**: a Domínio guarda o XML da NF-e de entrada no banco? A tabela, a coluna e o tipo dela (texto,
   binário, compactado, um caminho de arquivo). **Nunca leia o conteúdo**: só `COUNT` e `LENGTH`.
5. **O emitente**: o fornecedor da nota (o `codi_for` da `efentradas`) — a tabela do cadastro e as colunas do CNPJ, do
   nome e da UF (só os nomes das colunas).
6. Como a Domínio marca a NF-e modelo 55, a nota cancelada (as situações 2 a 5 que a ponte já tira) e a nota de
   entrada **emitida pela própria empresa** (a que não é compra de fornecedor).

## 2. As contagens
Só contagens, sem valor nem nome, no `dominio sql` (com a saída na tela, porque é só número):
1. **O escritório inteiro, 09/2026**: as notas de entrada (como a ponte conta), as de modelo 55, as com a chave de 44
   dígitos, as com o XML guardado, os itens, os itens com NCM, os itens com EAN (preenchido e diferente de
   "SEM GTIN") e, se o item e o cadastro do produto têm cada um a sua descrição, quantos itens têm as duas iguais.
2. **A empresa de código 65, de 01/10/2025 a 30/09/2026**: as mesmas contagens, mês a mês (o sistema diz que a Domínio
   tem 545 notas de entrada dela nesse período, pela consulta de hoje).
3. O tamanho do XML (se houver): `MIN`, `MAX` e `AVG` de `LENGTH` no escritório inteiro em 09/2026.

## 3. Os rascunhos
Em `ponte/rascunhos/` (a ponte não lê), com o comentário curto no começo (as tabelas, o que entra e o que fica de fora)
e três `?`: o código da empresa, o primeiro e o último dia do período.
1. `notas_entrada.sql`: **uma linha por item** das notas de entrada da empresa no período — da nota: a chave, o modelo,
   o número, a série, a data de emissão e a de entrada, o CNPJ, o nome e a UF do emitente, o CNPJ da empresa (o
   destinatário) e os totais (produtos, desconto, frete, IPI, ICMS-ST, total); do item: o número, o código e a
   descrição (as do fornecedor, se a Domínio guardar), o EAN, NCM, CFOP, unidade, quantidade, valor unitário, valor
   total, desconto, IPI e ICMS-ST. Só modelo 55, sem as canceladas e sem as emitidas pela própria empresa. Coluna que a
   Domínio não tem: fora, e anote.
2. `notas_entrada_xml.sql` (só se a Domínio guardar o XML): a chave e o XML de cada nota de entrada da empresa no
   período, com o mesmo filtro.
3. **O teste de cada rascunho**: ponha o rascunho dentro de um `SELECT COUNT(*), COUNT(DISTINCT <a chave>), …
   FROM (<rascunho>) x`, com a empresa 65 e 09/2026 no lugar dos `?`, e mostre só as contagens (quantas linhas, quantas
   notas, quantas com EAN). As contagens têm de bater com as do item 2. Anote também o tempo.

## 4. Registro, DUVIDAS e push
O `docs/FILA-CODE-2026-11-03-NOTAS-DUVIDAS.md` com: as tabelas e as colunas (com a descrição do catálogo), as respostas
das perguntas do item 1 (sobretudo: a descrição é a do fornecedor? tem o EAN? tem o XML?), as contagens do item 2 e o
que o Claude da sessão do Samuel tem de decidir. O registro preenchido, `py -3 tests/ponte.test.py` verde, commit e
`git push origin fila-notas-entrada`.

## Registro de progresso
| Data | Item | Situação / observação |
|---|---|---|
| | 1 · As tabelas | |
| | 2 · As contagens | |
| | 3 · Os rascunhos | |
| | 4 · Push | |
