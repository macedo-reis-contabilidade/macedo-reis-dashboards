# Fila do Claude Code — 17/11/2026 · o teste do fechamento: os pontos a ajustar na contabilidade da empresa e o acerto de cada um · branch `fila-17-11-teste-acertos`

> **Para o Code do PC do escritório.** **Leia este arquivo inteiro antes de começar**, junto com o
> `docs/FILA-CODE-2026-11-17-TESTE.md` (a fila do teste: a empresa, as regras, a leitura do passado e o rascunho dos
> 12 meses abertos). **Esta fila vem depois daquela e usa os arquivos dela.** Se a `fila-17-11-teste` ainda não
> terminou, termine-a primeiro (registro e push) e siga nesta na mesma sentada.
> Faça os itens **inteiros, sem parar pra perguntar**: nenhum item precisa do Samuel na frente do PC. Na dúvida, a
> opção que **muda menos**, anotada em `docs/FILA-CODE-2026-11-17-TESTE-ACERTOS-DUVIDAS.md`. Ao terminar: o
> **Registro de progresso** (fim deste arquivo) preenchido, commit e `git push origin fila-17-11-teste-acertos`.
> **Nunca** push em `main` nem merge pra ela. **Esta fila não muda a ponte, não instala nada, não grava nada no
> Domínio e não importa nada**: ela lê, conta e deixa no PC a lista do que ajustar e o rascunho dos acertos.

## O que é
- A fila do teste lê como 2025 foi lançado e repete esse padrão nos meses abertos. O Samuel pediu mais (17/11/2026,
  20h59): além de ver o que foi feito, **apontar o que está torto na contabilidade da empresa** (saldo que não faz
  sentido, lançamento que falta, lançamento em dobro, conta errada) **e deixar o acerto pronto**, porque consertar
  agora, junto com o fechamento, é mais rápido.
- O resultado é pra quem cuida da contabilidade: ela confere ponto a ponto, decide e **ela** lança ou importa. Daqui
  não sai lançamento nenhum.

## Regras
- **As da fila do teste valem todas**, sem exceção: a empresa sem nome e sem código no repositório (o código está no
  `C:\ponte-dominio\fechamento\teste\empresa.txt`); todo valor em reais, os códigos reduzidos, a saída das consultas,
  o relatório e os rascunhos **só no PC**, em `C:\ponte-dominio\fechamento\teste\`; a saída das consultas direto pra
  arquivo; o histórico dos lançamentos não é lido; a descrição das contas só dentro de filtro; não abrir o
  `C:\ponte-dominio\config.ini`; cada consulta em até 3 minutos, fora das 7h00 e das 8h30.
- **O que pode ir pra conversa, pro registro e pro DUVIDAS**: a estrutura de cada ponto. O grupo da conta (os 5
  primeiros dígitos, com o título do plano modelo), desde que mês, em quantos meses, se cresce ou fica parado, e o
  tamanho **em proporção** ("o saldo equivale a 4 meses de vendas", "0,9 das compras do período"). Sem valor em
  reais, sem código reduzido, sem código nem nome da empresa.
- **O acerto nunca cai em mês fechado.** O que está fechado é de 01 a 10/2025. O lançamento de acerto de um ponto que
  nasceu em mês fechado de 2025 é datado no primeiro mês aberto (30/11/2025), dizendo de que mês ele é. O de um
  ponto de mês aberto, no último dia do próprio mês. **Ponto que nasceu antes de 2025** (o ano de 2024 já foi
  zerado): não gere lançamento; descreva e marque "decisão de quem cuida da contabilidade".
- **Dois tipos de acerto, que não se misturam:**
  - o que se resolve **com lançamento** (a baixa que falta, a transferência entre contas, o estorno do que entrou em
    dobro): vai pro rascunho dos acertos (item 2);
  - o que se resolve **dentro do Domínio, por outro caminho** (rodar de novo a integração de um mês, trocar a conta
    que a integração usa, cadastrar a conta do banco, refazer a apuração): **não vira lançamento**. Vai pra lista "o
    que fazer no Domínio", com o mês e o que se espera ver depois.
- Código: crie e mexa **só** em `ponte/rascunhos/teste_acertos_*.sql`, em `ponte/rascunhos/teste_acertos.py` e nos
  dois arquivos desta fila. O código da empresa nas consultas é o marcador `{EMPRESA}`. **Não mexa** em
  `ponte/consultas/`, `ponte/*.py`, `supabase/`, nas telas nem nos testes.
- Commits em pt-BR.

## Antes de começar
```
git fetch origin --prune
git checkout fila-17-11-teste
git checkout -b fila-17-11-teste-acertos
py -3 tests/ponte.test.py
```
O ramo sai do `fila-17-11-teste` porque reaproveita os rascunhos e o script dele. O teste da ponte tem de terminar em
"Tudo certo.". Se não terminar, **pare aqui**: registro e push.

## 1. Os pontos a ajustar
De 12/2024 a 10/2026, com os saldos e os pares que a fila do teste já tirou (os itens 1.5, 1.6 e 1.7 dela). Pra cada
conferência abaixo: **sim ou não**, desde que mês, em quantos meses, o tamanho em proporção, a causa mais provável
(pelo par e pela origem do que falta ou sobra) e o tipo de acerto (lançamento, ou o que fazer no Domínio). Um ponto
só entra na lista quando os números mostram: sem achado, escreva "sem achado".

1. **A conta que fica contra a natureza todo mês** (a ponte vê uma, de 10/2025 a 10/2026): de qual grupo é, o que a
   deixa assim (qual par, de qual origem, entra sem a contrapartida de sempre) e o que a traria de volta.
2. **O caixa.** Em 2025 a venda entrava toda contra o caixa, e a empresa não tem banco na contabilidade. O saldo do
   caixa no fim de cada mês: sobe sem parar? Equivale a quantos meses de vendas no fim de 10/2025 e no fim de
   10/2026? O que sai do caixa em 2025 além do que o contador digitou (o pagamento de fornecedor, alguma retirada)?
   Caixa muito acima do que uma loja guarda é saída que não foi lançada: diga quais saídas faltam, pelo que os
   outros saldos mostram (os pontos 4, 6 e 9).
3. **Clientes.** Em 2026 a venda vai pra clientes. Existe alguma baixa (crédito em clientes) em 2026? O saldo no fim
   de 10/2026 é a soma das vendas do ano? Se não há baixa nenhuma, o acerto é a baixa mensal contra o caixa. Gere no
   rascunho, uma por mês, no valor da venda lançada no mês, marcada "conferir: o recebimento é no mês?".
4. **Fornecedores.** A compra entra contra fornecedores ou contra o caixa? Se contra fornecedores: há pagamento
   lançado? O saldo sobe sem parar, e equivale a quantos meses de compras? Sem pagamento nenhum, o acerto é a baixa
   mensal contra o caixa, no valor da compra do mês, marcada "conferir: o pagamento é no mês ou a prazo?".
5. **O estoque e o custo das mercadorias.** Nos meses abertos a compra não chega ao resultado, e em 10/2025 o
   resultado ficou muito negativo. Responda: a compra é lançada no estoque ou direto no custo? O custo de 2025
   entrou de uma vez só (em que mês) ou todo mês? Qual a razão entre o custo lançado e as compras de 01 a 10/2025, e
   entre o custo e as vendas do mesmo período? O saldo do estoque no fim de 10/2025 e de 10/2026 equivale a quantos
   meses de compras? Se o custo de 2025 foi de uma vez, o ponto é este: o resultado de cada mês sai errado o ano
   inteiro. O acerto, pros 12 meses abertos: um lançamento de custo por mês, pela **mesma razão custo ÷ vendas que
   2025 fechou** aplicada às vendas de cada mês, marcado "conferir: o custo é pelo inventário ou pela margem?". Diga
   também com quanto o estoque ficaria no fim de 10/2026 depois disso, em meses de compras: se ficar negativo ou
   acima de 6 meses, a razão não serve, e o ponto fica só descrito.
6. **O imposto do Simples.** Em 2025 a provisão do DAS veio pela apuração integrada ou digitada? Em quantos dos 10
   meses fechados existem as duas pontas (a provisão e o pagamento)? O saldo do imposto a recolher no fim de cada
   mês equivale a um DAS, a vários ou fica contra a natureza? Nos 12 meses abertos falta a provisão: se em 2025 ela
   vinha da apuração integrada, o acerto **não é lançamento**: é rodar a integração da apuração de cada mês (a lista
   "o que fazer no Domínio"). O pagamento já está no rascunho da fila do teste.
7. **O pró-labore.** A folha integra 3 lançamentos por mês até 11/2025 e 2 de 12/2025 em diante: qual deixou de
   vir? O saldo do pró-labore a pagar e o do INSS a recolher no fim de cada mês: zera, ou sobe sem parar? Se o
   pagamento do pró-labore nunca é lançado, o acerto é a baixa mensal contra o caixa, no valor líquido da folha do
   mês. A GPS paga já está no rascunho da fila do teste: confira que os dois juntos zeram o INSS a recolher.
8. **Os honorários contábeis.** A provisão e o pagamento existem nos 10 meses fechados? O saldo de honorários a pagar
   no fim de 10/2025 é zero, um mês ou mais? O honorário adicional do ano (pago em 11/11/2025) e os serviços avulsos
   que a empresa pagou ao escritório (em 05/2025 e 10/2025; depois, em 03/2026, 07/2026 e 10/2026) aparecem
   lançados? Não gere o que falta (o valor é do sistema do escritório, e quem confere é quem cuida da
   contabilidade): liste as datas.
9. **A retirada do sócio.** Há algum lançamento de distribuição de lucros ou de retirada, em 2025 ou antes? Com o
   caixa alto (o ponto 2) e nenhuma retirada lançada, o dinheiro saiu da empresa sem lançamento: **não gere
   lançamento** (é decisão de quem cuida da contabilidade com o sócio). Diga só quanto do saldo do caixa ficaria sem
   explicação depois dos acertos dos pontos 3, 4 e 7, em meses de vendas.
10. **O que entrou em dobro ou fora de lugar.** Pelos lançamentos da escrita fiscal de 2026 incluídos em 17/09,
    18/10 e 16/11/2026: algum mês tem a mesma nota lançada duas vezes (a mesma data, as mesmas contas e o mesmo
    valor, em dias de inclusão diferentes)? A contagem por mês. E as vendas de 11 e 12/2025: contra o caixa ou contra
    clientes? Se a mesma venda está nas duas contas, é dobro: o acerto é o que fazer no Domínio (excluir a
    integração repetida), não lançamento.
11. **O caixa depois de tudo.** Some ao saldo do caixa, mês a mês, o rascunho da fila do teste e os acertos desta: o
    caixa fica negativo em algum mês de 11/2025 a 10/2026? Em quais? Caixa negativo é erro que o controle do
    escritório acusa: se ficar, diga qual acerto resolve (a baixa de clientes do ponto 3, quase sempre) e a ordem de
    lançar.
12. **O que mais os saldos mostrarem.** Qualquer grupo do balanço com saldo parado desde antes de 2025, saldo contra
    a natureza em algum mês ou salto num mês só: liste, sem acerto.

## 2. O rascunho dos acertos
Um script, `ponte/rascunhos/teste_acertos.py`, lê as saídas do item 1 (os arquivos do PC) e escreve os dois arquivos
abaixo, sem mostrar valor na tela.

1. **`rascunho-acertos.csv`**, só no PC: as mesmas colunas do `rascunho-lancamentos.csv` da fila do teste e mais três
   no fim: `ponto` (o número do ponto do item 1), `do_mes` (o mês a que o acerto se refere) e `decisao` ("pronto pra
   conferir" ou "decisão de quem cuida da contabilidade"). Separado por `;`, data em dd/mm/aaaa, valor com vírgula,
   UTF-8 com BOM. O histórico: "ACERTO" e o que é, com "REF MM/AAAA".
2. **Nada de acerto que apague outro**: se dois pontos pedem a mesma baixa, ela entra uma vez só.
3. **A conferência do conjunto**: com o rascunho da fila do teste e os acertos lançados, como ficam no fim de 10/2026
   o caixa, clientes, fornecedores, o estoque, o imposto a recolher, o INSS a recolher, o pró-labore a pagar e os
   honorários a pagar (em proporção, no DUVIDAS; em reais, no relatório). E quais pontos continuam abertos.
4. **`relatorio.html`**, só no PC: acrescente **no começo** a parte "Pontos a ajustar", um bloco por ponto, do que
   pesa mais pro que pesa menos, em português simples: o que é, desde quando, de que tamanho, por que aconteceu, o
   acerto proposto (os lançamentos, ou o que fazer no Domínio) e o que depende de decisão. Depois, um quadro de uma
   página: "antes e depois dos acertos", com os saldos do item 2.3. O resto do relatório da fila do teste segue como
   está.

## 3. Registro, DUVIDAS e push
O `docs/FILA-CODE-2026-11-17-TESTE-ACERTOS-DUVIDAS.md` com, pra cada ponto do item 1: sim ou não, a estrutura (sem
valor, sem código) e o tipo de acerto; no fim, **o que você concluiria**: quais três pontos mais distorcem a
contabilidade desta empresa, o que se resolve só com lançamento, o que pede decisão, e o que disso tende a se repetir
nas outras empresas sem banco. O registro preenchido, `py -3 tests/ponte.test.py` verde, commit e `git push origin
fila-17-11-teste-acertos`. Cabe em 1 hora e meia: se passar de 2 horas e meia, entregue o item 1 inteiro e o que der
do 2, dizendo o que faltou.

## Registro de progresso
| Data | Item | Situação / observação |
|---|---|---|
| 18/11/2026 | Antes de começar | Feito às 14h22, na mesma sentada da fila do teste (terminada e enviada antes: `fila-17-11-teste`, commit `cc9f0f3`): `git fetch --prune`, a branch `fila-17-11-teste-acertos` a partir da `fila-17-11-teste`; `py -3 tests/ponte.test.py`: "Tudo certo.". |
| 18/11/2026 | 1 | Feito, os 12 pontos, com os arquivos da fila do teste e duas consultas novas, `ponte/rascunhos/teste_acertos_notas.sql` (1,5 s) e `teste_acertos_contas.sql` (3,4 s), a saída direto pra arquivo no PC. Com achado: 1 (o `21602` CONTAS A PAGAR do lado contrário da natureza desde antes de 2025), 2 (o caixa), 3 (clientes sem baixa), 4 (fornecedores sem pagamento desde 11/2025), 5 (o custo de 2025 de uma vez; o acerto pela razão deixaria o estoque com 6,07 meses de compras, acima de 6: só descrito), 6 (a provisão do DAS falta nos 12 meses abertos: rodar a apuração, não lançamento), 7 (o pagamento do pró-labore parou e a GPS não está no rascunho da fila do teste), 8 (o adicional e os avulsos não aparecem lançados), 9 (nenhuma retirada lançada; 1,89 mês de vendas no caixa sem explicação depois dos acertos) e 12 (a lista). Sem achado: 10 (nada em dobro: a contabilidade bate com as notas da escrita fiscal) e 11 (o caixa não fica negativo). A estrutura de cada um está no `docs/FILA-CODE-2026-11-17-TESTE-ACERTOS-DUVIDAS.md`, em proporção, sem valor e sem código. |
| 18/11/2026 | 2 | Feito: `ponte/rascunhos/teste_acertos.py` grava, só no PC, o `rascunho-acertos.csv` (47 acertos: 10 do ponto 3, 12 do ponto 4 e 25 do ponto 7; 45 "pronto pra conferir" e 2 "decisão de quem cuida da contabilidade", as GPS de 07 e 08/2025 sem pagamento lançado, em 30/11/2025) e o `relatorio.html` com a parte "Pontos a ajustar" e o quadro "antes e depois dos acertos" no começo. 16 itens na lista "o que fazer no Domínio" (a apuração dos 12 meses abertos, a linha das entradas de 11/2025 que não foi integrada e três integrações a conferir). A conferência do conjunto está no DUVIDAS (2.3). Nada foi lançado nem importado no Domínio. |
| 18/11/2026 | Revisão | Uma revisão independente (dois leitores, sem acesso aos dados do PC: a privacidade e o cumprimento da fila), como na fila do teste, com 15 achados, tratados. **Privacidade**: o saldo do pró-labore e o do INSS em "meses" divididos pelo valor de 2026 (e a parte do pró-labore nas saídas do caixa) davam, com o salário mínimo, a renda do sócio em reais — agora vão em quantidade de meses e de guias em aberto, e o pró-labore junto com as guias e os honorários; o "perto de 300 honorários" (o valor do contrato, por conta) saiu do DUVIDAS e do script. **A fila**: as GPS de 2025 sem pagamento são as de 07 e 08/2025, pelos juros (não 08 e 09, pela ordem); o contas a pagar separado em antes de 2025 e 2025, com o porquê de não gerar o de 2025; a frase do DAS (os meses sem pagamento e as competências pagas com juros) e as contagens saem dos dados; o ponto 3 com a causa; o saldo de fornecedores de 2025 explicado; as duas escolhas do ponto 7 anotadas; o ponto 9 com o período lido e a marca da retirada; o ponto 10 conferido também pela quantidade de linhas (achou uma linha das entradas de 11/2025 sem lançamento, que foi pra lista do Domínio); o ponto 12 com todos os saltos e o ponto que trata cada um; o quadro 2.3 sai do script (`--proporcoes`). Os números do item 1 acima são os de depois da revisão. |
| 18/11/2026 | 3 | Feito: o DUVIDAS, este registro, `py -3 tests/ponte.test.py` de novo às 14h34 ("Tudo certo."), o commit (os `ponte/rascunhos/teste_acertos*` e os dois arquivos desta fila) e `git push origin fila-17-11-teste-acertos`. Das 14h22 às 14h40, dentro da 1 hora e meia. |
| 18/11/2026 | Conferência (sessão do Samuel) | Lido e publicado na `main` em 18/11, depois da fila do teste: nada de valor em reais, do código nem do nome da empresa no que veio pro repositório (os saldos em proporção, o pró-labore e o INSS em quantidade). A leitura pro Samuel no Projeto, `contabil/contabilidade-em-dia.md`. |
