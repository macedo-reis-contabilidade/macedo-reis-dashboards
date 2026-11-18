# Fila de 17/11/2026 · o teste do fechamento numa empresa — o que se achou no Domínio

Escrito pelo Code do PC do escritório em 18/11/2026, na branch `fila-17-11-teste`. As consultas estão em
`ponte/rascunhos/teste_*.sql` e o script em `ponte/rascunhos/teste_fechamento.py`, que a ponte **não lê**: nada mudou
na ponte, no sistema nem no Domínio, e nada foi importado. Aqui vai só a **estrutura**: os pares pelo grupo (os 5
primeiros dígitos da classificação, com o título do plano modelo, a empresa 998), as origens, os meses, as contagens, os
dias e as proporções. Sem valor em reais, sem código reduzido e sem o código ou o nome da empresa. O código da empresa,
a saída de cada consulta, o relatório (`relatorio.html`) e o rascunho (`rascunho-lancamentos.csv`) ficaram só em
`C:\ponte-dominio\fechamento\teste\`.

## 0. A empresa e as consultas

### Como ela foi achada (`teste_empresa.sql`)
Pelas marcas da fila, só com contagens: ativa no Domínio (`geempre.stat_emp`), 5.555 lançamentos em 2024 fora o
zeramento, o último zeramento de 2024 incluído em 17/12/2025, nenhum zeramento em 2025, nenhum lançamento em conta de
banco (`11102`) de 12/2025 a 11/2026 e o último lançamento no caixa (`11101`) que não veio de integração em 15/10/2025
(a regra do `andamento.sql`). **Deu exatamente uma empresa.** O código está em
`C:\ponte-dominio\fechamento\teste\empresa.txt`.

**Uma marca mudou desde a leitura da ponte**: 2025 tinha 12.254 lançamentos em 17/11 e tem 12.255 hoje. O que entrou é
um lançamento do contador com data de 02/01/2025, incluído no Domínio em 17/11/2026 (depois da leitura da ponte das 7h):
`21502` OBRIGAÇÕES PREVIDÊNCIARIAS × `24301` LUCROS OU PREJUÍZOS ACUMULADOS, do mesmo valor de um lançamento de
30/12/2024 (`32204` DESPESAS ADMINISTRATIVAS × `21502`, incluído em 17/12/2025) — ao que tudo indica, o acerto de um
lançamento de 2024 feito contra o INSS, levado a lucros acumulados porque 2024 está zerado. Por isso a consulta parte do
ano de 2024 (zerado, não muda) e pede "12.254 ou mais" em 2025.

**O que mais mudou em 17/11/2026**: toda a escrita fiscal de 01 a 10/2026 foi integrada de novo nesse dia (todas as
linhas dela têm a inclusão em 17/11/2026), já com a venda contra clientes. As inclusões de 17/09, 18/10 e 16/11 que a
ponte viu foram trocadas por essa (item 1.5).

### As tabelas e as colunas
- `bethadba.ctlancto` ("Lancamentos Contabeis"): `data_lan`, `orig_lan`, `origem_reg`, `cdeb_lan`, `ccre_lan`
  (0 no lado vazio da partida múltipla), `vlor_lan`, `codi_lote`, `codi_his` (só o código; o `chis_lan` não é lido),
  `dorig_lan` (o dia em que entrou no Domínio), `CODI_EMP_PLANO`.
- `bethadba.ctlanctolote` ("Lancamento em lote"): `tipo` (X, C, D, V).
- `bethadba.ctcontas` ("Contas Contabeis - Cadastro"): `codi_cta`, `clas_cta`, `tipo_cta`; a `nome_cta` só nos filtros
  (`LIKE`: a transitória, a retificadora, e 0 ou 1 pra honorário, pró-labore, Simples, INSS e lucro).
- `bethadba.ctnatureza_conta`: a natureza pelo começo mais comprido da classificação (o `saldos.sql`).
- `bethadba.ctbaklan` ("Lancamentos Eliminados"): os lançamentos apagados (só a contagem; o histórico, o usuário e os
  CPFs não são lidos).
- O que o Domínio apura, pelo `fechamento_valores.sql` de 11/11 com o filtro da empresa (`teste_valores.sql`):
  `bethadba.efsdoimp` (o DAS, o imposto 44), `bethadba.fobasesserv` e `bethadba.foempregados` (o pró-labore bruto e o
  líquido dos sócios, só a soma), `bethadba.foguiainss` (a GPS) e `bethadba.fofgtsfilial` (o FGTS; não há).

### As consultas (todas fora do horário das tarefas, das 13h44 às 14h00 de 18/11/2026)
| consulta | o que traz | tempo |
|---|---|---|
| `teste_empresa.sql` | a empresa (o código, no PC) | 2,6 s |
| `teste_contas.sql` | as 23 contas do plano com lançamento dela (o reduzido, a classificação, o tipo, a natureza, as marcas do filtro) | 2,5 s |
| `teste_contador.sql` | a origem 1 de 01/2025 a 10/2026, por dia, lote, tipo do lote, contas, código do histórico, origem do registro e inclusão | 2,0 s |
| `teste_dia.sql` | tudo do mês, por dia, origem, origem do registro, contas e inclusão (uma por mês, de 12/2024 a 11/2026) | 0,4 a 2,3 s por mês |
| `teste_saldo_inicial.sql` | o saldo de cada conta no fim de 11/2024 | 1,0 s |
| `teste_valores.sql` | o DAS, a GPS e o pró-labore de 11/2024 a 10/2026 | 1,3 s |
| `teste_eliminados.sql` | os lançamentos eliminados guardados | 0,3 s |

Os rascunhos de 11/11 rodam o escritório inteiro em lotes; pra uma empresa só, consultas mais simples deram o mesmo, e o
`teste_valores.sql` é o `fechamento_valores.sql` com o filtro.

### O plano da empresa
Um plano só, 23 contas analíticas com lançamento, todas com 8 dígitos (duas com 10). **Nenhuma conta de banco**. Os
grupos: `11101` CAIXA, `11201` DUPLICATAS A RECEBER (clientes), `11501` MERCADORIAS, PRODUTOS E INSUMOS, `21301`
FORNECEDORES, `21401` IMPOSTOS E CONTRIBUIÇÕES A RECOLHER, `21501` OBRIGAÇÕES COM O PESSOAL (duas: a do pró-labore e a
dos honorários, pelo filtro do nome), `21502` OBRIGAÇÕES PREVIDÊNCIARIAS, `21602` CONTAS A PAGAR, `24101` (fora do plano
modelo: o capital), `24301` LUCROS OU PREJUÍZOS ACUMULADOS (três), `31103` (-) DEDUÇÕES DOS CUSTOS, `32201` DESPESAS COM
PESSOAL, `32204` DESPESAS ADMINISTRATIVAS (duas: a dos honorários e outra), `32205` DESPESAS FINANCEIRAS, `41101`
RECEITA BRUTAS DE VENDAS E MERCADORIAS, `41201` (-) CANCELAMENTO E DEVOLUÇÕES, `41203` (-) IMPOSTOS SOBRE VENDAS E
SERVIÇOS, `41204` (fora do plano modelo, 10 dígitos: o custo das mercadorias, item 1.7) e `41501` RECEITAS DIVERSAS.
**Não há conta de custo no grupo 3.1** além da retificadora `31103`: o custo das mercadorias é lançado no `41204`.

## 1. A leitura do passado

### 1.1 Os lançamentos por origem
Quantos, por mês (a soma de cada um ficou no PC). A origem 1 é toda digitada (`origem_reg` = 0): **nada veio do
importador**. Não há extrato (39) nem outra origem.

| mês | contador (1) | escrita fiscal, saídas (5) | escrita fiscal, entradas (6) | apuração (10) | folha (13) | zeramento (2) |
|---|---:|---:|---:|---:|---:|---:|
| 01/2025 | 5 | 1.062 | 16 | 1 | 3 | |
| 02/2025 | 4 | 838 | 19 | 1 | 3 | |
| 03/2025 | 4 | 810 | 11 | 1 | 3 | |
| 04/2025 | 4 | 981 | 11 | 1 | 3 | |
| 05/2025 | 5 | 1.197 | 15 | 1 | 3 | |
| 06/2025 | 2 | 786 | 21 | 1 | 3 | |
| 07/2025 | 12 | 865 | 8 | 1 | 3 | |
| 08/2025 | 2 | 1.122 | 15 | 1 | 3 | |
| 09/2025 | 5 | 682 | 15 | 1 | 3 | |
| 10/2025 | 8 | 743 | 36 | 1 | 3 | |
| 11/2025 | | 1.415 | 17 | | 3 | |
| 12/2025 | | 1.446 | 28 | | 2 | |
| 01/2026 | | 1.124 | 12 | | 2 | |
| 02/2026 | | 608 | 10 | | 2 | |
| 03/2026 | | 1.030 | 19 | | 2 | |
| 04/2026 | | 856 | 19 | | 2 | |
| 05/2026 | | 683 | 13 | | 2 | |
| 06/2026 | | 475 | 12 | | 2 | |
| 07/2026 | | 811 | 17 | | 2 | |
| 08/2026 | | 676 | 18 | | 2 | |
| 09/2026 | | 678 | 11 | | 2 | |
| 10/2026 | | 892 | 17 | | 2 | |

(12/2024, de referência: 10 do contador, 1.148 da escrita fiscal, 1 da apuração, 3 da folha e o zeramento de 2024, 9
linhas.) São 51 linhas do contador em 2025, todas de 01 a 10/2025, e nenhuma de 11/2025 a 10/2026.

### 1.2 O que o contador lançou (01 a 10/2025)
51 linhas em 41 lotes: 36 lotes simples (X) e 5 de partida múltipla (C, um crédito no caixa pra vários débitos: a guia
e os juros). Pelo par, com a partida múltipla contada pelo principal (a guia contra o caixa; os juros à parte):

| débito | crédito | meses (de 10) | lançamentos | dia (o mais comum, a faixa) | um por mês | histórico padrão | partida múltipla |
|---|---|---:|---:|---|---|---|---:|
| `21501` OBRIGAÇÕES COM O PESSOAL (a dos honorários) | `11101` CAIXA | 10 | 10 | 10 (sempre) | sim | sim, sempre o mesmo | 0 |
| `32204` DESPESAS ADMINISTRATIVAS (a dos honorários) | `21501` OBRIGAÇÕES COM O PESSOAL (a dos honorários) | 10 | 10 | 30 (28 em fevereiro) | sim | sim, sempre o mesmo | 0 |
| `21401` IMPOSTOS E CONTRIBUIÇÕES A RECOLHER | `11101` CAIXA | 8 (01 a 05, 07, 09, 10) | 10 | 14 (de 9 a 21) | não (07 e 10 com dois) | sim, sempre o mesmo | 3 |
| `21502` OBRIGAÇÕES PREVIDÊNCIARIAS | `11101` CAIXA | 7 (01 a 05, 07, 10) | 8 | 15 (de 9 a 21) | não (07 com dois) | sim, sempre o mesmo | 2 |
| `21502` OBRIGAÇÕES PREVIDÊNCIARIAS | `24301` LUCROS OU PREJUÍZOS ACUMULADOS | 1 (01) | 1 | 2 | sim | não (texto livre) | 0 |
| `32204` DESPESAS ADMINISTRATIVAS (a outra) | `11101` CAIXA | 1 (05) | 1 | 30 | sim | não (texto livre) | 0 |
| `41204` (fora do plano modelo: o custo das mercadorias) | `11501` MERCADORIAS, PRODUTOS E INSUMOS | 1 (10) | 1 | 31 | sim | sim | 0 |

Os 5 lotes de partida múltipla: o DAS com juros (`21401` + `32205` × caixa) em 09/07, 09/09 e 14/10; o INSS com juros
(`21502` + `32205` × caixa) em 09/07 e 21/07. Os juros (`32205`) aparecem só neles, em 3 meses. As 51 linhas entraram no
Domínio em quatro dias: 28/11/2025 (1), 01/12/2025 (48), 17/12/2025 (1) e 17/11/2026 (a de 02/01/2025) — a
contabilidade de 2025 foi feita de uma vez, em novembro e dezembro de 2025, não mês a mês.

### 1.3 De onde sai o valor (os pares em 8 dos 10 meses ou mais)
- `21401` × caixa (o DAS): **o DAS da competência anterior** (`efsdoimp`, o imposto 44), até R$ 1,00, em 7 dos 10
  lançamentos (a regra olha o mês e o anterior); os outros 3, os com juros, batem com o DAS de duas competências antes,
  pago com atraso. Somando os
  10, foram pagos os DAS das competências 12/2024 a 09/2025, todas.
- `32204` × `21501` (a provisão dos honorários): **valor fixo** (o mesmo nos 10 meses).
- `21501` × caixa (o pagamento dos honorários): **a provisão do mês anterior**, nos 10 (o de janeiro paga a provisão de
  12/2024).
- Fora da régua: `21502` × caixa (o INSS) casa com **a GPS da competência anterior** nos 8 lançamentos (a GPS de 2025
  tem o mesmo valor todo mês), mas aparece em 7 meses e ficou fora do rascunho pela regra dos 8.
  Nenhum par casa com o pró-labore bruto ou o líquido.

### 1.4 Os honorários contábeis
Os dois pares existem, nos 10 meses: a provisão (`32204` × `21501`, as analíticas com HONORÁRIO no nome) e o pagamento
(`21501` × caixa).
- **O pagamento cai no dia de verdade?** Não: é lançado **sempre no dia 10**. Bate com o dia em que a empresa pagou em 2
  dos 10 meses (10/02 e 10/04: coincidência); nos outros 8 (14/01, 18/03, 19/05, 06/06, 08/07, 08/08, 09/09, 14/10),
  não.
- **A provisão**: no dia 30 de cada mês (28 em fevereiro), do **próprio mês**; o pagamento do dia 10 paga a do mês
  anterior. No fim de 10/2025 sobra a provisão de 10/2025 (um honorário), que ninguém pagou porque os meses abertos não
  têm lançamento do contador.
- **O valor**: a provisão tem um valor só nos 10 meses, **janeiro incluído**. O que é menor é o **pagamento de janeiro**:
  é o da provisão de 12/2024, 9,1% abaixo (o valor de 2025 é 10% acima do de 2024). Em 2025 o reajuste entrou na provisão
  de janeiro (o primeiro pagamento reajustado foi o de fevereiro); em 2026, pelo sistema do escritório, o primeiro
  pagamento reajustado é o de março.

### 1.5 O que a integração lança (01/2025 a 10/2026)
| de onde | débito | crédito | meses |
|---|---|---|---|
| escrita fiscal, saídas | `11101` CAIXA | `41101` RECEITA | 01/2025 a 12/2025 |
| escrita fiscal, saídas | `11201` DUPLICATAS A RECEBER | `41101` RECEITA | 01/2026 a 10/2026 |
| escrita fiscal, saídas | `41201` (-) CANCELAMENTO E DEVOLUÇÕES | `11501` MERCADORIAS | 10/2026 (1) |
| escrita fiscal, entradas | `11501` MERCADORIAS | `21301` FORNECEDORES | todos |
| escrita fiscal, entradas | `11501` MERCADORIAS | `31103` (-) DEDUÇÕES DOS CUSTOS | 6 meses de 02/2025 a 12/2025 |
| escrita fiscal, entradas | `11501` MERCADORIAS | `41501` RECEITAS DIVERSAS | 8 meses de 2026 |
| escrita fiscal, entradas | `21301` FORNECEDORES | `11101` CAIXA | 01/2025 a 10/2025 |
| escrita fiscal, entradas | `21602` CONTAS A PAGAR | `11101` CAIXA | 6 meses de 01/2025 a 10/2025 |
| apuração | `41203` (-) IMPOSTOS SOBRE VENDAS | `21401` IMPOSTOS A RECOLHER | 01/2025 a 10/2025 |
| folha | `32201` DESPESAS COM PESSOAL | `21501` (o pró-labore) | todos |
| folha | `21501` (o pró-labore) | `21502` OBRIGAÇÕES PREVIDÊNCIARIAS | todos |
| folha | `21501` (o pró-labore) | `11101` CAIXA | 01/2025 a 11/2025 |

- **A venda**: contra o caixa de 01/2025 a **12/2025** (11 e 12/2025 também), contra clientes de **01/2026** em diante.
  Muda em 01/2026.
- **A escrita fiscal de 2026 no Domínio**: as 7.981 linhas de 01 a 10/2026 (as saídas e as entradas) têm todas a inclusão
  em **17/11/2026** — foi integrada de novo nesse dia, inteira, contra clientes. As inclusões de 17/09, 18/10 e 16/11/2026
  que a ponte leu não existem mais: foram trocadas pela de 17/11, e o Domínio não guardou as linhas eliminadas (a
  `ctbaklan` não tem nada desta empresa). **Contra o que elas estavam não dá mais pra saber pelo Domínio.** As de 2025
  entraram mês a mês, no mês seguinte (a de 11/2025 em 09/12/2025, a de 12/2025 em 02/01/2026).
- **A compra**: contra fornecedores, todo mês. **O pagamento do fornecedor é integrado** (`21301` × caixa, pelas
  entradas) de 01 a 10/2025, e **de 11/2025 em diante não vem mais**: os fornecedores só sobem nos meses abertos.
- **O pró-labore**: a folha integra a provisão (`32201` × `21501`, o bruto dos sócios do mês, até R$ 1,00, em todos os
  meses), o INSS retido (`21501` × `21502`, a GPS do mês, que é o bruto menos o líquido) e, até 11/2025, o pagamento
  pelo caixa (`21501` × caixa, nos dias 5 a 7, o líquido da competência anterior — por isso o de janeiro é menor: o
  valor do pró-labore mudou na virada do ano). **São 3 por mês até 11/2025 e 2 de 12/2025 em diante porque o pagamento deixou de vir**: os 12
  pagamentos de 12/2024 a 11/2025 entraram todos no mesmo dia (28/11/2025), numa integração só, e as folhas de
  12/2025 em diante entraram mês a mês (no mês seguinte, entre os dias 8 e 16) só com a provisão e o INSS. O porquê não
  está nos números: é a integração do pagamento da folha, que rodou uma vez e não rodou mais (a conferir no Domínio).
- **A apuração**: existe nos 10 meses de 2025 (e em 12/2024), no último dia do mês, um lançamento por mês: a provisão do
  DAS (`41203` × `21401`), do valor do DAS da competência (até R$ 1,00, nos 11). **Nos 12 meses abertos ela não existe.**

### 1.6 Os saldos no fim de cada mês (12/2024 a 10/2026)
Débito menos crédito de cada conta, com o zeramento (o valor ficou no PC). Pelo grupo:
- `11101` CAIXA: devedor em todos os meses. Desce em 2025 (um lançamento só, em 05/2025, de `32204` × caixa, tira dele
  quase todo o saldo), sobe em 11 e 12/2025 (as vendas ainda contra o caixa) e **fica parado de 01 a
  10/2026**: nada entra nem sai.
- `11201` DUPLICATAS A RECEBER: zero até 12/2025, **sobe todo mês em 2026** (as vendas, sem baixa nenhuma).
- `11501` MERCADORIAS: sobe o ano todo; em 10/2025 desce de uma vez (o custo, item 1.7); nos meses abertos, só sobe.
- `21301` FORNECEDORES: credor em todos os meses; sobe devagar em 2025 e **sobe todo mês nos meses abertos** (a compra
  entra e o pagamento não).
- `21401` IMPOSTOS A RECOLHER: credor. No fim de cada mês de 2025, o DAS do próprio mês (provisionado e ainda não
  pago); em 06, 08 e 09/2025, mais de um (o DAS pago com atraso). **Parado nos meses abertos**, no DAS de 10/2025 (nem a
  provisão nem o pagamento).
- `21501` OBRIGAÇÕES COM O PESSOAL: a do pró-labore, parada em 2025 e **subindo todo mês de 12/2025 em diante** (o
  pagamento parou); a dos honorários, parada (um honorário, o de 10/2025).
- `21502` OBRIGAÇÕES PREVIDÊNCIARIAS: em 12/2024 fica muito credor (o lançamento de 30/12/2024, item 0), volta em 01/2025
  (o acerto de 17/11/2026) e **sobe todo mês nos meses abertos** (o INSS retido entra e a GPS não é paga).
- `21602` CONTAS A PAGAR: **contra a natureza (devedora) em todos os meses, desde antes de 12/2024**. É a conta que a
  ponte vê do lado errado: as entradas pagam por ela (`21602` × caixa, a origem 6) e nada a credita. Parada nos meses
  abertos.
- `24101` (o capital) e `24301` LUCROS ACUMULADOS: parados (o zeramento de 2024 em 12/2024 e o acerto de 02/01/2025).
- O resultado do mês (as contas de resultado, fora o zeramento): a maior parte da venda do mês em todos os meses, fora
  três muito negativos: 12/2024 (o custo de 2024 e o lançamento de 30/12/2024), 05/2025 (o lançamento de `32204` × caixa)
  e 10/2025 (o custo do ano).

### 1.7 O custo das mercadorias
- **Nos estoques (`11501`)** entram as compras (`11501` × `21301`, as entradas, todos os meses), o que as entradas
  creditam nas deduções dos custos (`11501` × `31103`, 6 meses de 2025) e, em 2026, contra receitas diversas (`11501` ×
  `41501`, 8 meses). Sai: uma devolução em 10/2026 (`41201` × `11501`, as saídas) e **o custo, lançado pelo contador
  duas vezes**: em 31/12/2024 (o de 2024) e em **31/10/2025** (`41204` × `11501`, um lançamento só, incluído em
  01/12/2025).
- **Em 10/2025** o resultado ficou muito negativo por esse lançamento: um só, da origem 1, no dia 31. Ele vale **0,94
  das compras de 01 a 10/2025** e 0,61 das vendas do mesmo período (as compras de 01 a 10/2025 foram 0,65 das vendas).
  Ou seja: é o custo dos 10 meses de uma vez, no último dia do último mês fechado.
- **No grupo 3.1** só há a retificadora `31103` (as entradas creditam ali), sem conta de custo: o custo vai no `41204`.

### 1.8 As guias
O DAS e a GPS existem em **todas as 24 competências** de 11/2024 a 10/2026 (no PC, o valor de cada uma). Não há guia de
FGTS (sem empregado).

## 2. O rascunho dos 12 meses abertos
`ponte/rascunhos/teste_fechamento.py` lê os arquivos do PC e grava o `rascunho-lancamentos.csv` (as colunas da fila,
UTF-8 com BOM, `;`, data dd/mm/aaaa, valor com vírgula e sem o ponto de milhar) e o `relatorio.html` (das partes a a g).
Na tela, só contagens. Ele para, sem gravar nada, se uma saída do PC estiver cortada (o rodapé do `dominio sql` não bate
com as linhas). Os pares de estoque, de custo e de juros não entram no rascunho nem quando são fixos (item 2.5); e, se o
pagamento dos honorários de 2025 não fosse a provisão do mês anterior (em 8 dos 10, pelo menos), ele não seria gerado.

### O que entrou: 36 lançamentos, 3 por mês
| par | regra | o dia | o valor | o histórico |
|---|---|---|---|---|
| `21401` × caixa (o pagamento do DAS) | fixo de 2025 (8 de 10 meses) | 14 (o mais comum de 2025) | o DAS da competência anterior: as de 10/2025 a 09/2026 | o código de 2025 + "REF MM/AAAA" da competência |
| `32204` × `21501` (a provisão dos honorários) | honorários | 30 (28 em fevereiro), como em 2025 | o de 2025 de 11/2025 a 01/2026; 10% a mais de 02/2026 em diante | o código de 2025 + "REF MM/AAAA" do mês |
| `21501` × caixa (o pagamento dos honorários) | honorários | 10, como em 2025 (o pagamento não era lançado no dia de verdade) | a provisão do mês anterior: o de 2025 de 11/2025 a 02/2026; 10% a mais de 03/2026 em diante | o código de 2025 + "REF MM/AAAA" do mês da provisão |

Toda linha de honorário vai marcada "conferir o valor". O pagamento de 11/2025 paga a provisão de 10/2025, que já está
lançada.

### O que não entrou (a lista do relatório, com o que 2025 mostra de cada um)
- O INSS (`21502` × caixa): 7 dos 10 meses (os meses 06, 08 e 09 sem pagamento, e julho com dois), casa com a GPS.
- Os juros e as multas (`32205`, em 5 lotes de partida múltipla); o rascunho gera só o principal.
- O custo das mercadorias (`41204` × `11501`) e todo lançamento de estoque.
- O lançamento de `32204` × caixa de 05/2025 e o acerto de `21502` × lucros acumulados de 02/01/2025 (um mês cada).
- **A provisão do DAS**: em 2025 veio pela apuração integrada (a origem 10), não digitada. Os 12 meses abertos estão sem
  ela — é rodar a apuração no Domínio, não lançamento. Sem ela, o pagamento do DAS do rascunho deixa o `21401` do lado
  contrário da natureza.
- O pagamento do pró-labore (a folha o integrava até 11/2025; os meses de 12/2025 a 10/2026 estão sem ele).
- O recebimento das vendas que em 2026 foram pra clientes.
- O honorário adicional do ano, pago em 11/11/2025.
- Nada de banco.

### A prova no passado (01 a 10/2025)
O mesmo script nos 10 meses fechados, como se estivessem abertos (a prova é dentro da própria amostra: o padrão sai
desses meses), contra os 41 lançamentos do contador (a partida múltipla pelo principal):

| | quantos |
|---|---:|
| acerta (o par, o valor até R$ 1,00 e o dia) | 22 |
| acerta o par e o valor, noutro dia | 5 |
| o par certo, o valor de outra competência | 1 |
| geraria a mais | 2 |
| faltariam | 13 |

- **Os honorários: 20 de 20** (a provisão e o pagamento, os 10 meses, no dia e no valor).
- **O DAS**: 2 no dia (14/01 e 14/10), 5 no valor em outro dia (o dia de pagar o DAS varia de 9 a 21), 1 de outra
  competência (em 09/2025 a empresa pagou o DAS de 07, com juros; o rascunho, o de 08), e 2 a mais (06 e 08/2025, meses
  em que a empresa não pagou o DAS; ela pagou depois, com juros).
- **Faltariam 13**: os 8 pagamentos do INSS, os 2 DAS pagos com juros que se somam aos do mês (07 e 10/2025), o custo de
  10/2025, o lançamento de 05/2025 e o acerto de 02/01/2025.

## 3. O que eu concluiria
1. **O que o contador lançou em 2025 cabe em três coisas mensais e três eventuais.** Dos 41 lançamentos de 01 a
   10/2025, 20 são os honorários (a provisão e o pagamento) e 10 o DAS; 8 são o INSS e 3 eventuais (o custo do ano, um
   lançamento contra o caixa em 05/2025 e o acerto de 2024). **O rascunho reproduz 27 dos 41 no par e no valor (66%),
   22 deles também no dia**: todos os honorários e 7 dos 10 DAS. Com o INSS na regra (7 meses, a GPS da competência
   anterior, que em 2025 é a mesma todo mês), o mesmo jeito do DAS acertaria mais 7 no par e no valor, e geraria 3 a
   mais.
2. **A contabilidade de 2025 foi feita de uma vez**, em novembro e dezembro de 2025 (48 das 51 linhas do contador
   entraram em 01/12/2025), e o pagamento do pró-labore pela folha também (todos em 28/11/2025). Os honorários têm o dia
   fixo (o pagamento no 10, a provisão no 30), não o do pagamento; o DAS e o INSS variam de 9 a 21 (por isso o DAS do
   rascunho, no dia 14, acerta o dia em 2 dos 10).
3. **O que os 12 meses abertos ainda pedem depois do rascunho**, pelos números: a provisão do DAS (rodar a apuração de
   cada mês), o INSS pago (a GPS), o pagamento do pró-labore (a integração da folha), o pagamento dos fornecedores (que
   a integração das entradas fazia até 10/2025 e não faz mais), o recebimento de clientes (as vendas de 2026), o custo
   das mercadorias e o que fazer com o caixa parado e o `21602` CONTAS A PAGAR do lado contrário da natureza desde antes
   de 2025. A fila seguinte (`fila-17-11-teste-acertos`) mede cada um.
4. **O que mudou ontem**: em 17/11/2026, quem cuida da contabilidade integrou de novo a escrita fiscal de 2026 inteira
   (contra clientes) e lançou o acerto do INSS de 2024 em lucros acumulados (com data de 02/01/2025, num mês fechado).
   A leitura da ponte de 17/11 é de antes disso.

### As dúvidas pra quem cuida da contabilidade (também no relatório)
1. O pagamento dos honorários é lançado sempre no dia 10, e a empresa pagou em outros dias. O rascunho segue o dia 10:
   vale trocar pelo dia em que a empresa pagou (o sistema do escritório tem os dias)?
2. A GPS foi paga em 7 dos 10 meses de 2025 (em julho, duas). Os meses sem pagamento são guia em atraso, ou pagamento
   que não foi lançado? Ela entra no método como o DAS?
3. Roda-se a apuração de cada mês aberto antes de importar o pagamento do DAS?
4. A folha integrava o pagamento do pró-labore até 11/2025 e parou: mudou a integração da folha?
5. O custo das mercadorias entra mês a mês, ou de uma vez no fim do ano, como em 2025?
6. As vendas de 2026 em clientes foram recebidas no mês?
7. O honorário adicional do ano e os serviços avulsos pagos ao escritório entram como honorário ou noutra conta?
8. As saídas da escrita fiscal de 2026 foram integradas de novo em 17/11/2026: o que estava antes (nas inclusões de
   17/09, 18/10 e 16/11) era contra o caixa? (O Domínio não guardou as linhas eliminadas.)
