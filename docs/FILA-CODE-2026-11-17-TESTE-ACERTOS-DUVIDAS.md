# Fila de 17/11/2026 · os acertos do teste do fechamento — o que se achou no Domínio

Escrito pelo Code do PC do escritório em 18/11/2026, na branch `fila-17-11-teste-acertos` (que sai da
`fila-17-11-teste`). O script é o `ponte/rascunhos/teste_acertos.py`, que importa o `teste_fechamento.py` da fila do
teste e lê os mesmos arquivos do PC, mais duas consultas novas: `teste_acertos_notas.sql` (as notas de entrada e de
saída da escrita fiscal, por mês, pra comparar com o que a integração lançou) e `teste_acertos_contas.sql` (as marcas da
descrição das contas, só dentro do filtro). A ponte não lê nada disso; nada mudou na ponte, no sistema nem no Domínio, e
nada foi lançado nem importado.

Aqui vai só a **estrutura**: o grupo da conta (os 5 primeiros dígitos, com o título do plano modelo), desde que mês, em
quantos meses e o tamanho **em proporção**. As medidas: o saldo **em meses de vendas** (a venda média do mês de 01 a
10/2025, pros saldos de 2025, e a de 11/2025 a 10/2026, pros de 10/2026 — a dos meses abertos é 1,09 vez a de 2025) ou
**em meses de compras** (o mesmo, com as compras: a dos meses abertos é 1,44 vez a de 2025), ou em guias (o DAS). O
pró-labore e o INSS vão **em quantidade** de meses e de guias em aberto, nunca divididos por um valor: a razão entre o
valor de um ano e o do outro diria, com o salário mínimo, o pró-labore do sócio em reais. Pelo mesmo motivo, a parte do
pró-labore nas saídas do caixa vai junto com as guias e os honorários. O valor de cada acerto, os códigos reduzidos e o relatório ficaram só em
`C:\ponte-dominio\fechamento\teste\` (`rascunho-acertos.csv` e `relatorio.html`, com a parte "Pontos a ajustar" no
começo).

As consultas novas: `teste_acertos_notas.sql`, 1,5 s; `teste_acertos_contas.sql`, 3,4 s (às 14h05 e às 14h25 de
18/11/2026).

## 1. Os pontos a ajustar

### 1. A conta contra a natureza todo mês — **sim**
- **Qual**: `21602` CONTAS A PAGAR. **Devedora em todos os 24 meses lidos**, de 11/2024 a 10/2026, e já no fim de
  11/2024 (1,03 mês de vendas de 2025). No fim de 10/2026, 2,12 meses de vendas de 2025.
- **O que a deixa assim**: de 12/2024 a 10/2025 ela foi debitada em 7 meses (12/2024, 01 a 05/2025 e 10/2025), sempre
  pelas **notas de entrada da escrita fiscal** (a origem 6), contra o `11101` CAIXA, e **não foi creditada em nenhum
  mês**. São notas de entrada inteiras: com elas, o que foi lançado das entradas em cada um desses meses bate com o valor
  das notas da escrita fiscal. O acumulador dessas notas lança a nota contra contas a pagar e o caixa, em vez de uma
  despesa. Nos meses abertos, parada (as entradas de 11/2025 em diante vão todas pra fornecedores).
- **Em partes**: o saldo do fim de 12/2024 (o que vem de antes de 2025) é 1,28 mês de vendas de 2025, e os débitos de 01
  a 10/2025, 0,85.
- **O que a traria de volta**: levar essas notas pra despesa certa e, pra frente, no Domínio, conferir o acumulador
  delas. **Sem lançamento**: o de antes de 2025 porque 2024 está zerado; o de 2025, que nasceu em meses fechados e iria
  em 30/11/2025, porque a despesa de cada nota só quem cuida da contabilidade sabe (a opção que muda menos). "Decisão de
  quem cuida da contabilidade".
- **Tipo**: o que fazer no Domínio (o acumulador) e decisão (o saldo).

### 2. O caixa — **sim**
- **O saldo no fim de cada mês**: devedor em todos. De 12/2024 a 04/2025, fica perto do mesmo nível; em 05/2025 cai de
  uma vez; de 06 a 10/2025 sobe devagar; em 11 e 12/2025 sobe (as vendas ainda contra o caixa); de 01 a 10/2026, **parado**
  (10 dos 12 meses abertos sem nenhum lançamento nele). **Não sobe sem parar**: em 2025 ele sobe pouco, porque a venda
  entra e o pagamento dos fornecedores sai pela integração.
- **Quanto equivale**: no fim de 10/2025, **1,63 mês de vendas**; no fim de 10/2026, **4,71 meses** de vendas.
- **O que sai do caixa em 2025**, em parte das vendas de 01 a 10/2025: um lançamento do contador em `32204` DESPESAS
  ADMINISTRATIVAS, numa conta de **despesas diversas** (pelo filtro do nome), em 05/2025: **0,61** — sozinho, 6,13 meses
  de vendas de uma vez —; o pagamento dos fornecedores pela integração das entradas: **0,59**; contas a pagar pelas
  entradas (o ponto 1): 0,08; o pró-labore, as guias e os honorários, juntos: 0,11.
- **As saídas que faltam**, pelos outros saldos: o pagamento dos fornecedores (ponto 4), o do pró-labore e a GPS (ponto
  7), o DAS e os honorários (o rascunho da fila do teste). E, depois de todos eles, o que sobra (o ponto 9).
- **Tipo**: lançamento (pelos pontos 3, 4 e 7); o resto, decisão (ponto 9).

### 3. Clientes — **sim**
- As vendas de **01 a 10/2026** entram em `11201` DUPLICATAS A RECEBER e **não há nenhum crédito em clientes** no
  período. O saldo no fim de 10/2026 é **exatamente a soma das vendas do ano** (1,00 dela): 8,75 meses de vendas.
- **A causa mais provável**: em 2026 a venda passou a entrar em clientes (a escrita fiscal de 2026 foi integrada de
  novo, inteira, contra clientes, em 17/11/2026) e o recebimento não é lançado; sem banco, ele iria pro caixa.
- **Acerto** (lançamento, "pronto pra conferir"): a baixa mensal contra o caixa, 10 lançamentos (01 a 10/2026), no
  último dia de cada mês, no valor da venda lançada em clientes no mês, marcada "conferir: o recebimento é no mês?".

### 4. Fornecedores — **sim**
- A compra entra **contra fornecedores** (`11501` × `21301`, as notas de entrada, todos os meses). Em 2025 o pagamento
  vinha pela **integração das entradas** (`21301` × caixa, a origem 6), nos 10 meses, perto do valor da compra do mês (de
  0,58 a 1,32 dela). **De 11/2025 em diante, nenhum pagamento**.
- O saldo sobe todo mês nos meses abertos: no fim de 10/2025, 1,15 mês de compras (de 2025); no fim de 10/2026, **12,80
  meses de compras**. As compras dos meses abertos são maiores que as de 2025 (1,44 vez por mês) e batem com as notas da
  escrita fiscal (o ponto 10): não é dobro.
- **Acerto** (lançamento, "pronto pra conferir"): a baixa mensal contra o caixa, 12 lançamentos (11/2025 a 10/2026), no
  último dia do mês, no valor da compra do mês, marcada "conferir: o pagamento é no mês ou a prazo?". E, no Domínio:
  conferir por que a integração das entradas parou de lançar o pagamento em 11/2025.
- **Fica sem acerto**: o saldo do fim de 10/2025 (no fim de 10/2026, 0,80 mês de compras). São as compras de 10/2025 que
  a integração ainda não tinha pago (em 10/2025 o pagamento foi 0,66 da compra); em 2025 o pagamento oscila em volta da
  compra do mês, e se ele é no mês ou a prazo é justamente a pergunta do acerto acima. A opção que muda menos: não gerar,
  e anotar.

### 5. O estoque e o custo das mercadorias — **sim, só descrito**
- **A compra é lançada no estoque** (`11501`), e o custo sai do estoque **de uma vez**, pelo contador: em 2025, **um
  lançamento só, em 31/10/2025** (`41204` × `11501`; o de 2024 foi em 31/12/2024). Não há conta de custo no grupo 3.1.
- **As razões**: o custo de 2025 vale **0,94 das compras** de 01 a 10/2025 e **0,61 das vendas** do mesmo período.
- **O estoque**: no fim de 10/2025, 3,59 meses de compras (de 2025); no fim de 10/2026, **14,58 meses** de compras.
  Sem o custo, o resultado de cada mês aberto sai sem ele, e o de outubro, quando ele entra, muito negativo: **o
  resultado de cada mês sai errado o ano inteiro**.
- **O acerto pela razão não serve**: com o custo de cada mês aberto a 0,61 das vendas, o estoque ficaria, no fim de
  10/2026, com **6,07 meses de compras** — acima de 6 (as compras dos meses abertos cresceram muito mais que as vendas).
  Pela regra da fila, **o ponto fica só descrito**, sem lançamento: o custo dos meses abertos pede o inventário (o
  estoque contado) ou outra razão, "decisão de quem cuida da contabilidade".
- **Tipo**: decisão.

### 6. O imposto do Simples — **sim**
- Em 2025 a provisão do DAS veio pela **apuração integrada** (a origem 10, `41203` × `21401`), nos 10 meses, e não foi
  digitada. **As duas pontas existem em 8 dos 10 meses** (a provisão nos 10, o pagamento em 8): em 06 e 08/2025 nenhum
  DAS foi pago, e os das competências 05, 07 e 08/2025 foram pagos depois, com juros.
- **O saldo do imposto a recolher** no fim de cada mês de 2025: **um DAS** (o do próprio mês, provisionado e ainda não
  pago) em 7 meses, **mais de um** em 06, 08 e 09/2025 (os pagos com atraso). **Nunca contra a natureza.**
- **Nos 12 meses abertos falta a provisão**: o saldo fica parado no DAS de 10/2025, e o pagamento do DAS do rascunho da
  fila do teste o deixaria do lado contrário da natureza (10,6 DAS devedor no fim de 10/2026).
- **Acerto**: **não é lançamento** — rodar a integração da apuração de cada um dos 12 meses abertos (a lista "o que
  fazer no Domínio"). O que se espera ver depois: a provisão do DAS de cada mês, do valor do DAS da competência; com ela,
  o saldo do fim de 10/2026 é um DAS, o de 10/2026. O pagamento já está no rascunho da fila do teste.

### 7. O pró-labore — **sim**
- **Qual deixou de vir**: o **pagamento** do pró-labore pelo caixa (`21501` × caixa, a origem 13). A folha integra a
  provisão e o INSS retido em todos os meses; o pagamento, até 11/2025 (os 12, de 12/2024 a 11/2025, numa integração
  só, em 28/11/2025).
- **Os saldos, em quantidade**: o pró-labore a pagar tem **1 mês em aberto** no fim de 10/2025 (o de 10/2025, pago no
  começo do mês seguinte) e **12** no fim de 10/2026 (11/2025 a 10/2026): **sobe sem parar**. O INSS a recolher tem **3
  GPS em aberto** no fim de 10/2025 (as de 07, 08 e 10/2025) e **15** no fim de 10/2026: **sobe sem parar**. As GPS de
  2025: 8 pagamentos em 7 meses pras 11 competências de 12/2024 a 10/2025; os sem juros pagam a competência anterior, e os
  dois de julho, com juros, as de 05 e 06/2025 (pela data e pelos juros). Ficam sem pagamento as de 07 e 08/2025 (a de
  10/2025 se paga em 11/2025).
- **A GPS não está no rascunho da fila do teste** (ela foi paga em 7 dos 10 meses de 2025, abaixo da régua dos 8).
  Por isso o pagamento dela entrou aqui.
- **Acertos** (lançamento): a baixa mensal do pró-labore contra o caixa, 11 lançamentos (12/2025 a 10/2026), no valor
  líquido da folha da competência anterior, "pronto pra conferir"; o pagamento da GPS da competência anterior, 12
  lançamentos (11/2025 a 10/2026), "pronto pra conferir"; e as **2 GPS de 2025 sem pagamento lançado** (07 e 08/2025),
  em 30/11/2025, o primeiro mês aberto, dizendo de que mês são, "decisão de quem cuida da contabilidade" (a guia pode não
  ter sido paga). E, no Domínio: conferir a integração do pagamento da folha, que parou.
- **Duas escolhas**, as que seguem o que a empresa fazia em 2025: o pró-labore pela competência anterior (a fila fala no
  "líquido da folha do mês"; a outra leitura só muda o mês a que cada baixa se refere, não o saldo do fim) e a GPS gerada
  aqui, porque a fila do teste a deixou de fora (a outra: não gerar e só avisar que a premissa da fila não vale).
- **Os dois juntos zeram o INSS?** Sim: depois dos acertos, o INSS a recolher no fim de 10/2026 tem **1 GPS em aberto**
  (a de 10/2026, que se paga em 11/2026), e o pró-labore a pagar, **1 mês** (o de 10/2026). Sem as 2 GPS de 2025,
  ficariam 3.

### 8. Os honorários contábeis — **sim, sem lançamento**
- A provisão e o pagamento **existem nos 10 meses fechados**. O saldo de honorários a pagar no fim de 10/2025 é **um
  mês** (a provisão de 10/2025, que o rascunho da fila do teste paga em 11/2025).
- **Não aparecem lançados**: o honorário adicional do ano, pago em **11/11/2025**, e os serviços avulsos pagos ao
  escritório em **05/2025, 10/2025, 03/2026, 07/2026 e 10/2026**: nesses meses as contas dos honorários só têm a provisão
  e o pagamento de sempre, e nos meses abertos não há lançamento do contador. (O lançamento do contador noutra despesa
  administrativa, em 05/2025, é o das despesas diversas do ponto 2, muito maior que um honorário: não é um avulso.)
- **Sem acerto**, como a fila manda: o valor é o do sistema do escritório. As datas ficaram no relatório.
- **Tipo**: decisão.

### 9. A retirada do sócio — **sim (não há)**
- **Nenhum lançamento de distribuição de lucros ou de retirada** de 12/2024 a 10/2026 (o que foi lido): nenhum débito em
  `24301` LUCROS OU PREJUÍZOS ACUMULADOS fora o zeramento, e nenhuma conta com retirada ou distribuição no nome (pelo
  filtro). Em 2025, o que tirou dinheiro do caixa sem ser um pagamento conhecido foi o
  lançamento de 05/2025 em despesas diversas (ponto 2).
- **Depois dos acertos dos pontos 3, 4 e 7** (e do rascunho da fila do teste), o caixa no fim de 10/2026 fica com
  **1,89 mês de vendas sem explicação**: é o que uma retirada não lançada, ou outra saída, explicaria.
- **Sem lançamento**: decisão de quem cuida da contabilidade com o sócio.

### 10. O que entrou em dobro ou fora de lugar — **sem achado de dobro**
- A escrita fiscal de 01 a 10/2026 tem **um dia de inclusão só, 17/11/2026**: foi integrada de novo, inteira. As
  inclusões de 17/09, 18/10 e 16/11/2026 que a ponte leu não existem mais, e o Domínio não guardou as linhas eliminadas
  (a fila do teste, item 1.5). Com um dia de inclusão só, não há a mesma nota em dias de inclusão diferentes.
- **A contabilidade bate com as notas da escrita fiscal** em todos os meses abertos, no valor (o lançado dividido pelo
  valor das notas: 1,00 em todos, nas entradas — com tudo o que elas lançam, o estoque contra fornecedores, as deduções
  dos custos e as receitas diversas — e nas saídas) e **na quantidade de linhas** (as notas e os segmentos): a mesma da
  escrita fiscal em todos os meses e nas duas pontas. A contagem: **0 meses com dobro**.
- **Fora de lugar, uma coisa pequena**: em 11/2025, uma linha das notas de entrada da escrita fiscal não tem lançamento
  na contabilidade (0,3% do valor das entradas do mês). Vai pra lista "o que fazer no Domínio": integrar de novo as
  entradas de 11/2025.
- **As vendas de 11 e 12/2025**: contra o caixa, nenhuma contra clientes. Sem dobro.

### 11. O caixa depois de tudo — **sem achado**
- Com o rascunho da fila do teste e os acertos acima, mês a mês de 11/2025 a 10/2026: **o caixa não fica negativo em
  nenhum mês**. No fim de 10/2026, 1,89 mês de vendas (o ponto 9). A ordem de lançar não muda o resultado.

### 12. O que mais os saldos mostram — **sim, só a lista**
Os saltos num mês só (o passo do mês acima de 3 vezes o passo médio da conta e de meio mês de vendas), com o ponto que
trata cada um:
- `11101` CAIXA: 05/2025 (o lançamento de despesas diversas, 5,61 meses de vendas no saldo), 11 e 12/2025 (as vendas
  ainda contra o caixa) — o ponto 2.
- `11201` DUPLICATAS A RECEBER: 01/2026 (a venda passa pra clientes) — o ponto 3.
- `11501` MERCADORIAS: 10/2025 (o custo do ano) — o ponto 5.
- `21301` FORNECEDORES: 12/2025 (a maior compra dos meses abertos, sem pagamento) — o ponto 4.
- `21502` OBRIGAÇÕES PREVIDÊNCIARIAS: 12/2024 e 01/2025 (5,13 e 5,14 meses de vendas): o lançamento de 30/12/2024 contra o
  INSS e o acerto dele, de 02/01/2025, incluído em 17/11/2026, numa conta de **ajustes de exercícios anteriores** (pelo
  filtro do nome) em `24301` LUCROS OU PREJUÍZOS ACUMULADOS. Um desfaz o outro.
- `24301` LUCROS OU PREJUÍZOS ACUMULADOS: 12/2024 (o zeramento de 2024) e 01/2025 (o acerto acima).
- `24101` (fora do plano modelo, o capital): parado desde antes de 2025 (normal).
- Saldo do lado contrário da natureza em algum mês: só o `21602` (o ponto 1).

## 2. O rascunho dos acertos
`ponte/rascunhos/teste_acertos.py` grava o `rascunho-acertos.csv` (as colunas do `rascunho-lancamentos.csv` e mais
`ponto`, `do_mes` e `decisao`; `;`, dd/mm/aaaa, vírgula decimal sem o ponto de milhar, UTF-8 com BOM; o histórico
"ACERTO … REF MM/AAAA") e o `relatorio.html` (a parte "Pontos a ajustar", do que pesa mais pro que pesa menos, e o
quadro "antes e depois dos acertos", antes do relatório da fila do teste). Na tela, só contagens.

**47 lançamentos de acerto**: o ponto 3 (10), o ponto 4 (12) e o ponto 7 (25: 11 do pró-labore, 12 da GPS dos meses
abertos e as 2 GPS de 2025, as de 07 e 08/2025). 45 "pronto pra conferir" e 2 "decisão de quem cuida da contabilidade". Nenhum cai em mês
fechado: os de 2025 vão pro primeiro mês aberto (30/11/2025), dizendo de que mês são. Um acerto pedido por dois pontos
entra uma vez só (a chave: as contas, o mês a que se refere e o valor). **16 itens na lista "o que fazer no Domínio"**:
rodar a apuração dos 12 meses abertos, integrar de novo as entradas de 11/2025 (a linha que falta), conferir o
acumulador das entradas que debitam contas a pagar, conferir o acumulador das entradas (o pagamento dos fornecedores
parou) e conferir a integração do pagamento da folha. O quadro abaixo sai do próprio script
(`py -3 ponte/rascunhos/teste_acertos.py --proporcoes`, que mostra só as proporções e as quantidades).

### 2.3 A conferência do conjunto (o fim de 10/2026)
| | antes (hoje no Domínio) | depois do rascunho e dos acertos |
|---|---|---|
| o caixa | 4,71 meses de vendas | 1,89 mês de vendas |
| clientes | 8,75 meses de vendas | zero |
| fornecedores | 12,80 meses de compras | 0,80 mês de compras (o que vinha de 2025) |
| o estoque | 14,58 meses de compras | 14,58 meses de compras (o custo é o ponto 5) |
| o imposto a recolher | o DAS de 10/2025 (0,69 do de 10/2026) | 10,57 DAS **do lado contrário da natureza** sem a apuração; **1 DAS** (o de 10/2026) depois de rodar a apuração dos 12 meses |
| o INSS a recolher | 15 GPS em aberto | 1 GPS em aberto (a de 10/2026) |
| o pró-labore a pagar | 12 meses em aberto | 1 mês em aberto (o de 10/2026) |
| os honorários a pagar | um honorário (o de 10/2025) | um honorário (o de 10/2026) |

**Continuam abertos**: o ponto 1 (contas a pagar do lado contrário da natureza), o ponto 5 (o custo e o estoque), o
ponto 6 até a apuração ser rodada, o ponto 8 (o adicional e os avulsos), o ponto 9 (o caixa sem explicação), as 2 GPS de
2025 (decisão) e o que vinha de 2025 em fornecedores.

## 3. O que eu concluiria
1. **Os três pontos que mais distorcem a contabilidade desta empresa**:
   - **o custo das mercadorias** (ponto 5): ele entra uma vez por ano, e o estoque está em 14,58 meses de compras. O
     resultado de cada mês sai sem o custo, e o do mês em que ele entra, muito negativo. A razão de 2025 não resolve os
     meses abertos (as compras cresceram 44% e as vendas, 9%): é o inventário;
   - **os fornecedores sem pagamento** (ponto 4): 12,80 meses de compras em aberto, desde que a integração das entradas
     parou de lançar o pagamento, em 11/2025;
   - **clientes sem recebimento** (ponto 3): a venda de 2026 inteira em clientes (8,75 meses de vendas), com o caixa
     parado o ano todo.
2. **O que se resolve só com lançamento**: o recebimento de clientes, o pagamento dos fornecedores, o do pró-labore e a
   GPS (os 45 acertos "pronto pra conferir"), mais o DAS e os honorários do rascunho da fila do teste. Lançados, eles
   zeram clientes, o INSS e o pró-labore no que é de cada mês, e o caixa não fica negativo em mês nenhum.
3. **O que se resolve no Domínio, sem lançamento**: a provisão do DAS (rodar a apuração dos 12 meses abertos), a linha
   das entradas de 11/2025 que não foi integrada e, pra frente, a integração do pagamento dos fornecedores e do
   pró-labore, que pararam, e o acumulador que lança notas de entrada contra contas a pagar.
4. **O que pede decisão**: o custo das mercadorias (o inventário), o saldo de contas a pagar (o de antes de 2025 e o de
   2025, que pede a despesa de cada nota), as 2 GPS de 2025 sem pagamento lançado, o honorário adicional e os avulsos (o valor do sistema do escritório) e o caixa que
   sobra sem explicação (1,89 mês de vendas), com o sócio.
5. **O que tende a se repetir nas outras empresas sem banco**, pelo que esta mostra e pelo estudo de 11/11: o caixa
   recebe tudo, então **toda saída que a integração não lança vira caixa parado ou subindo** — o pagamento dos
   fornecedores e o do pró-labore, quando a integração deixa de fazer; a **venda a prazo sem baixa** de clientes, quando a
   venda passa pra clientes; a **provisão do DAS pela apuração**, que alguém tem de rodar todo mês; e o **custo das
   mercadorias de uma vez no fim do ano**, que deixa o resultado mensal errado (o par `41204` × `11501` aparece em 15
   empresas no estudo de 11/11). O retrato vale antes de olhar outra: o padrão de cada empresa sai da leitura dela.
