# Fila de 24/11/2026 · a versão final do arquivo do teste do fechamento — o que se achou

Escrito pelo Code do PC do escritório em 26/11/2026, na branch `fila-24-11-teste-final`. O script é o
`ponte/rascunhos/teste_final.py`, que importa o `teste_fechamento.py` e o `teste_acertos.py` das filas de 17/11 e lê,
só no PC, as consultas de hoje (`ponte/rascunhos/teste_*.sql` e as novas `teste_final_*.sql`) e o arquivo das guias
pagas da empresa pela consulta de pagamentos do Integra. A ponte não lê nada disso; nada mudou na ponte, no sistema nem
no Domínio, e nada foi importado. Aqui vai só a **estrutura**: contagens, meses, sim ou não e proporções. O valor de
cada lançamento, os códigos reduzidos, o CNPJ, o número e o dia de cada guia, os arquivos e o relatório ficaram só em
`C:\ponte-dominio\fechamento\teste\`.

## 0. Antes de começar e as consultas
- A fila de 19/11 da procuração (`fila-19-11-procuracao`) foi feita antes, na mesma sentada.
- A conexão com o Domínio abriu (o `py -3 -m ponte conferir`, da pasta da ponte instalada). Rodou duas vezes: a
  segunda só pra ler a linha da conexão, que a primeira tinha escondido junto com as linhas do IP. As duas abriram.
- **As consultas foram rodadas de novo hoje** (26/11, das 14h45 às 14h50), numa pasta à parte (`final\saida`), e as de
  18/11 ficaram como estavam. **Nada mudou no Domínio desde 18/11**: de 12/2024 a 11/2026, as mesmas linhas pela chave
  inteira do `teste_dia.sql` (o dia, a origem, a origem do registro, as duas contas e o dia em que entrou no Domínio),
  com a mesma contagem e a mesma soma — então nem uma integração refeita noutras contas, como a de 17/11, passaria. Nos
  meses abertos, nenhum lançamento novo do contador, nenhuma apuração e nenhuma integração nova.
- As consultas novas (todas de 0,4 a 3,0 s):

| consulta | o que traz |
|---|---|
| `teste_final_empresa.sql` | o documento da empresa no cadastro do Domínio (`geempre.cgce_emp`), só pra achar o arquivo das guias; não sai do PC |
| `teste_final_plano.sql` | as analíticas do plano que podem receber a retirada do sócio e os juros e as multas, com marcas da descrição só dentro do filtro |
| `teste_final_lancados.sql` | os lançamentos de cada mês aberto (e de 11/2026), um a um, pra conferir o dobro (tudo que não é da escrita fiscal, e da escrita fiscal só o que sai do caixa) |
| `teste_final_leiaute.sql`, `teste_final_leiaute_campos.sql`, `teste_final_leiaute_empresa.sql` | os leiautes do importador que gravam lançamentos, os campos e o registro que identifica a empresa (configuração do importador, sem empresa) |
| `teste_final_leiaute_uso.sql` | como entraram os lançamentos importados por leiaute em 2025, no escritório inteiro (só contagens) |

## 1. As guias pagas, pela consulta do Integra
1. **O arquivo da empresa existe** (achado pelo CNPJ do cadastro do Domínio, dentro do script): 46 guias, de 01/2025
   em diante.
2. **De 01/11/2025 a 31/10/2026: 24 guias, como a fila disse** — 12 DAS (os períodos de 10/2025 a 09/2026, um por
   período) e 12 DARF da previdência (os mesmos períodos, um por período). As duas do período 08/2026 têm multa e juros;
   as outras 22, não. Em todas, o principal mais a multa e os juros dá o total pago. **Nenhuma diferença** contra a
   fila: nenhuma falta, nenhuma a mais, nenhuma outra guia paga nesses 12 meses.
3. **As da previdência de 07 e 08/2025**: a de 07/2025 foi paga em 09/2025 e a de 08/2025 em 10/2025, as duas com multa
   e juros (o dia, o principal, a multa e os juros de cada uma estão no relatório).
4. **No Domínio**: a provisão do DAS de 10/2025 **existe** (a apuração de 10/2025). O INSS de cada período de 10/2025 a
   09/2026 **está na folha integrada** (a provisão do INSS retido do pró-labore): **sim nos 12**, e nos 12 com o mesmo
   valor do principal da guia.

## 2. O que sempre entra (`arquivo-final.csv`)
**63 lançamentos (71 linhas)**, de 11/2025 a 10/2026, nenhum em mês fechado:

| o que | quantos | o par (pelo grupo) | o dia |
|---|---:|---|---|
| 2.1 o pagamento do DAS | 12 (1 em partida múltipla) | `21401` IMPOSTOS A RECOLHER × `11101` CAIXA | o dia do pagamento |
| 2.2 o pagamento do INSS do pró-labore | 12 (1 em partida múltipla) | `21502` OBRIGAÇÕES PREVIDENCIÁRIAS × `11101` CAIXA | o dia do pagamento |
| 2.3 as GPS de 07 e 08/2025 | 2 (as 2 em partida múltipla) | o mesmo | 30/11/2025, com "(PAGO EM dd/mm/aaaa)" no histórico |
| 2.4 a provisão dos honorários | 12 | `32204` DESPESAS ADMINISTRATIVAS × `21501` (a dos honorários) | o dia 30 (28/02 em fevereiro) |
| 2.4 o pagamento dos honorários | 12 | `21501` (a dos honorários) × `11101` CAIXA | os dias da tabela da fila |
| 2.4 o honorário adicional de 2025 | 1 | `32204` (a dos honorários) × `11101` CAIXA | 11/11/2025 |
| 2.4 os serviços extras | 2 (um com o "conferir" da fila) | o mesmo | 07/07 e 13/10/2026 |
| 2.6 o recebimento das vendas de 2026 | 10 | `11101` CAIXA × `11201` DUPLICATAS A RECEBER | o último dia de cada mês de 01 a 10/2026 |

- **A partida múltipla** (as 4 guias com multa e juros): o principal na conta do imposto, a multa e os juros **numa
  perna só**, na conta de juros e multas que a empresa usou em 2025 (`32205` DESPESAS FINANCEIRAS), e o total contra o
  caixa — como os 5 lotes de 2025, que têm cada um uma perna de juros. O histórico é o mesmo nas três pernas. A perna
  dos juros é o total menos o principal, então o lote fecha por construção (conferido nos 4). A guia em que o
  principal, a multa e os juros não dão o total, ou com multa e juros e sem a conta de juros, não é gerada: vai pro
  "pede decisão" (nenhuma, hoje).
- **As GPS de 07 e 08/2025 (2.3)** entram só porque a prova no passado (4.2) diz que elas faltam no Domínio: a guia de
  2025 que o contador já lançou, em qualquer dia, não entra de novo (vai pro "pede decisão"). As duas que faltam são
  exatamente as de 07 e 08/2025.
- **O INSS de cada período (2.2)** entra só onde o principal do DARF bate com o INSS retido que a folha integrou (os 12):
  o DARF que tivesse mais que o retido (a parte patronal, noutra empresa) não caberia inteiro na conta do retido.
- **H fecha**: com o H de 2025, H, 1,1 H, 19/11 de H, 1/22 de H e 6/11 de H dão centavos inteiros. A provisão de
  10/2025 lançada em 2025 é H, e é ela que o pagamento de 11/11/2025 paga.
- **Os históricos** são os textos da fila ("PAGAMENTO DAS REF MM/AAAA", "HONORARIOS CONTABEIS REF MM/AAAA" etc.), sem o
  código do histórico padrão que o contador usava em 2025 nesses pares (a coluna `codigo_historico` vai vazia). A fila
  se contradiz aqui: diz "como o rascunho", e o rascunho de 18/11 usava o código de 2025 com o complemento "REF
  MM/AAAA"; mas ela escreve o texto de cada histórico, no 2.1, no 2.2, no 2.3 e no 2.4. Ficaram os textos, a leitura
  literal; o relatório diz que dá pra trocar pelo código no importador. O recebimento de clientes segue com o texto de
  18/11, "ACERTO RECEBIMENTO DE CLIENTES REF MM/AAAA" (a opção que muda menos; a palavra ACERTO pode sair na
  conferência).
- **Não entrou: a declaração de MEI (2.5).** O plano da empresa **não tem conta de lucros distribuídos nem de retirada de
  sócio** no patrimônio. As duas analíticas com "retirada" no nome são **despesas** (grupos `31102` MÃO-DE-OBRA DIRETA e
  `32201` DESPESAS COM PESSOAL, pelo jeito o pró-labore), e a fila decidiu que não é despesa. Perto disso, o plano tem
  `24301` LUCROS OU PREJUÍZOS ACUMULADOS, `21701` DIVIDENDOS e `11304` SÓCIOS, ADMINISTRADORES E PESSOAS LIGADAS. Foi pra
  lista "pede decisão", como a fila manda.
- **Sai do rascunho de 18/11** (2.7): o pagamento do DAS do `rascunho-lancamentos.csv` e o da GPS do
  `rascunho-acertos.csv` (os do 2.1 a 2.3 tomam o lugar deles) e as marcas "conferir o valor" dos honorários. Os dois
  rascunhos de 18/11 continuam na pasta, só como referência; o relatório diz, no começo, pra não importá-los.

## 3. O que só entra se o Domínio não lançar
| arquivo | quantos | o que é |
|---|---:|---|
| `se-nao-integrar-fornecedores.csv` | 12 | `21301` FORNECEDORES × caixa, no último dia de cada mês de 11/2025 a 10/2026, no valor da compra do mês, sem a marca de 18/11 (os fornecedores com um prazo só) |
| `se-nao-integrar-pro-labore.csv` | 11 | `21501` (o pró-labore) × caixa, de 12/2025 a 10/2026, o líquido da competência anterior, com a marca de 18/11 "conferir: o dia do pagamento". O de 11/2025 a folha já integrou |
| `se-nao-apurar-das.csv` | 12 | `41203` (-) IMPOSTOS SOBRE VENDAS × `21401`, o par da apuração de 2025, no último dia de cada mês de 11/2025 a 10/2026, no valor que o Domínio apurou (o imposto 44): tinha a apuração em todos os 12 períodos, e o Integra não foi preciso |

Cada arquivo deixa de fora o mês em que o Domínio já lançou aquilo pela rotina (hoje, só o pagamento do pró-labore de
11/2025).

## 4. A conferência
### 4.1 Os saldos no fim de cada mês, de 11/2025 a 10/2026
| | (a) o arquivo final e os três `se-nao-…` (nada roda no Domínio) | (b) o arquivo final e as rotinas no Domínio |
|---|---|---|
| o caixa | nunca negativo, nem num dia; no fim de 10/2026, 1,83 mês de vendas (hoje, 4,71) | o mesmo |
| o DAS a recolher | 1 DAS em aberto em todo fim de mês (o do próprio mês) | o mesmo |
| o INSS a recolher | 1 guia em aberto em todo fim de mês (a do próprio mês) | o mesmo |
| os honorários a pagar | 1 honorário em todo fim de mês (o do próprio mês; no fim de 10/2026, o de 10/2026) | o mesmo |
| clientes | zero em todo fim de mês | o mesmo |
| fornecedores | 0,80 mês de compras em todo fim de mês: o que vinha de 2025 (18/11, ponto 4) | o mesmo |

- Em cada mês, o saldo do DAS e do INSS **bate**, até R$ 1,00, com a soma do que está em aberto, e o dos honorários,
  até R$ 1,00, com a provisão do próprio mês (12 de 12, nos dois casos).
- **O caso (b) foi simulado com dias supostos**: a provisão do DAS no último dia (como a apuração em 2025), o pagamento
  do pró-labore no dia 6 (o mais comum da folha em 2025) e o pagamento dos fornecedores no dia da compra. Esse último
  não é o jeito de 2025: só 0,11 do pagamento integrado em 2025 caiu num dia de compra (no mês, ele oscilava em volta
  da compra) — "se der" da fila: pelo jeito de 2025 não deu. Por isso o (b) dá, no fim de cada mês, os mesmos saldos do
  (a), e o que ele mostra a mais é só que o caixa também não fica negativo num dia com esses dias. O relatório diz isso
  do mesmo jeito.
- **O arquivo final sozinho**, sem a apuração no Domínio e sem o `se-nao-apurar-das.csv`, deixa o DAS a recolher do lado
  contrário da natureza (o pagamento sem a provisão): é por isso que a ordem começa pela apuração.
- Depois de tudo, o caixa fica com **1,83 mês de vendas** sem explicação (em 18/11, com o que se tinha, 1,89): é o caixa
  que sobra, com o cliente, em janeiro.

### 4.2 A prova no passado (01 a 10/2025)
Os pagamentos do DAS e da previdência pelo Integra (20 guias: 10 DAS e 10 da previdência, pagas de 01 a 10/2025) contra
os que o contador lançou em 2025 (18: 10 do DAS e 8 do INSS, a partida múltipla pelo principal ou pelo total):

| | quantos |
|---|---:|
| batem no dia e no valor | 18 |
| só no valor (outro dia) | 0 |
| faltam no Domínio | 2 (as GPS de 07 e 08/2025: o 2.3) |
| no Domínio sem guia | 0 |

**O contador lançava o DAS e a GPS no dia e no valor pagos**: o dia variava de 9 a 21 porque é o dia do pagamento. O
método do arquivo final (o dia e o valor do Integra) é o mesmo que ele fazia à mão. O casamento vai primeiro pelo mesmo
dia e o mesmo valor; depois, só pelo valor, com até um mês de diferença (o INSS do pró-labore tem o mesmo valor todo
mês: sem o limite, uma guia casaria com o lançamento de outra competência). Os 18 casaram no primeiro passo.

### 4.3 Nada em dobro
Nenhum lançamento dos quatro arquivos é igual (o par, o dia e o valor) a um que já está no Domínio, nenhum se repete
dentro do arquivo e nenhum se repete entre os arquivos. A comparação é com os lançamentos dos meses abertos (todo
lançamento dos arquivos é de mês aberto); pras GPS de 2025, datadas de 30/11/2025, o que protege contra o dobro é a
prova do 4.2, que só as deixa entrar quando faltam no Domínio.

## 5. O formato e o leiaute do importador
- Os quatro arquivos `.csv` têm as colunas dos rascunhos de 18/11 e mais `do_mes` (o mês a que o lançamento se refere,
  como nos acertos) e `lote` (o número da partida múltipla; vazio no lançamento simples). Os rascunhos de 18/11 não
  tinham partida múltipla. `;`, dd/mm/aaaa, vírgula decimal sem o ponto de milhar, UTF-8 com BOM.
- **O leiaute: achado, o mais provável, sem confirmação.** O importador do Domínio (`bethadba.GEIMPORTADOR_LEIAUTES`,
  com os registros e os campos) tem 13 leiautes que gravam lançamentos contábeis (a definição de dados com a tabela
  `ctlancto`), todos padrões da Domínio (`IMP_LEI_…`); nenhum foi criado pelo escritório. Nada no banco liga o
  lançamento importado ao leiaute que o trouxe. O mais provável é o **37** (`IMP_LEI_037`): é o que tem a conta a débito,
  a conta a crédito e o lote com o tipo (o registro 6000), e os 9.435 lançamentos importados por leiaute em 2025
  (`origem_reg` = 2, de 20 empresas) incluem 33 em lotes do tipo C (partida múltipla, em 7 delas), além de 9.402 do tipo
  X (nas 20). Isso não prova: todo lançamento da `ctlancto` tem lote, até o digitado, e só os campos importados de dois
  dos 13 leiautes foram lidos. O outro candidato lido, o 30 (`IMP_LEI_030`), é de extrato (a data, o documento, o
  histórico, o valor e o tipo; a conta do banco não vem do arquivo). **Quem cuida da contabilidade confere na tela do
  importador** (o passo da ordem, no relatório); até lá vale o caminho "se não achar" da fila.
- **A estrutura do 37** (só o que os arquivos usam): arquivo texto, hierárquico, campos separados por `|`, a linha
  começa com o separador (o primeiro é ignorado), vírgula decimal, sem delimitador de texto.
  - `|0000|inscrição da empresa|` — a identificação da empresa (o conjunto de dados do 37 identifica a empresa por este
    registro: a inscrição é o CNPJ);
  - `|6000|tipo|código do lançamento padrão|localizador|RTT do FCONT|` — abre o lote: o tipo X (um débito pra um
    crédito) ou C (um crédito pra vários débitos), o resto vazio;
  - `|6100|data|conta a débito|conta a crédito|valor|código do histórico|histórico|usuário|filial|` — cada lançamento
    do lote: a data em dd/mm/aaaa, as contas pelo código reduzido (vazia do lado que não tem, na partida múltipla), o
    valor com vírgula, o código do histórico vazio, o histórico em texto, o usuário e a filial vazios.
- Cada `.csv` foi gravado também nesse leiaute (`…-leiaute.txt`): sem BOM, em ANSI (os históricos só têm letras sem
  acento), uma linha por registro, com o fim de linha do Windows. O `arquivo-final-leiaute.txt` tem 63 lotes (59 X e 4 C)
  e 71 registros 6100.
- **Uma observação sobre a leitura do leiaute**: a trava do `dominio sql` recusa toda coluna que começa com "nome", e o
  rótulo do campo, do registro e da coluna do importador estão em colunas assim (`NOME_CAMPO`, `NOME_REGISTRO`,
  `NOME_COLUNA`). Foram lidos com outro apelido — o caminho que a própria trava sugere e que as filas de 03/11 e 11/11
  já usaram —, porque são configuração do importador, sem pessoa nem empresa (a descrição e a observação do leiaute e o
  comentário dos campos não foram lidos). Nunca numa coluna de pessoa, de empresa ou de conta.
- **O arquivo no leiaute não leva a marca "conferir"** (nem deve: no histórico, ela ficaria no livro da empresa pra
  sempre). As linhas marcadas estão no `.csv` e no relatório, e a ordem do relatório manda resolvê-las antes de
  importar: o serviço extra de 07/07/2026 (no Conta Azul, no nome de outra pessoa junto com o da empresa) e o dia dos
  pagamentos do `se-nao-integrar-pro-labore`.

## 6. O relatório
O `relatorio.html` ganhou, no começo, a parte "A versão final" (o aviso pra não importar os rascunhos de 18/11; o que
vai em cada arquivo e quantos; a ordem; as guias; cada arquivo linha a linha; os saldos de hoje e dos casos a e b; a
prova; o dobro; o que pede decisão e o que ficou de fora). O resto é o de 18/11 (uma cópia dele ficou em
`final\relatorio-de-18-11.html`).

## 7. O que pede decisão e o que ficou de fora
**Pede decisão**
1. **A declaração de MEI paga ao escritório (09/03/2026, 6/11 de H)**: sem conta de lucros distribuídos nem de retirada
   de sócio no plano. Quem cuida da contabilidade escolhe a conta (ou cria a de lucros distribuídos) e lança.

**Ficou de fora, como a fila decidiu**: o custo das mercadorias (o estoque vem da empresa, em 31/12), o caixa que sobra
(com o cliente, em janeiro), o contas a pagar do lado contrário da natureza (depois, com o fiscal), o **pagamento** do
honorário de 10/2026 (a provisão está no arquivo final) e o adicional de 2026 (pagos em 11/11/2026: o fechamento de
11/2026).

**Também de fora**: os serviços avulsos de 05/2025 e 10/2025 que a fila de 18/11 listava não estão na tabela desta
fila e não foram gerados.

**A ordem pra quem cuida da contabilidade** (no relatório, com a lista das linhas marcadas): (1) no Domínio, rodar a
apuração dos 12 meses e as integrações que pararam (o pagamento do pró-labore pela folha, o dos fornecedores pelas
entradas, e integrar de novo as entradas de 11/2025); (2) **pedir que o `teste_final.py` rode de novo** (as consultas e
o script, pelo pedreiro), porque os `se-nao-…` foram montados com o Domínio de antes do passo 1: a rotina que voltar só
em parte dos meses deixaria um arquivo inteiro em dobro nesses meses, e a compra de 11/2025 cresce com a linha
integrada de novo (sem rodar de novo: tirar de cada `se-nao-…` os meses em que o Domínio lançou aquilo); (3) resolver
as linhas marcadas "conferir"; (4) escolher o leiaute 37 no importador e conferir que é o que o escritório usa; (5)
importar o `arquivo-final-leiaute.txt`; (6) importar só os `se-nao-…` do que o Domínio não lançou; (7) conferir os
saldos com o quadro do relatório.

## 8. A revisão e o eco do `dominio sql`
- **A revisão independente** (item 7.1): três leitores — a privacidade, o cumprimento da fila e a lógica do script —
  sem acesso aos dados do PC (leram só o repositório e a estrutura dos arquivos, sem valor), e cada achado conferido por
  um segundo revisor antes de mudar. O que mudou por ela está nas seções acima (o lote que fecha por construção; a GPS
  de 2025 pela prova; o INSS pela folha; o par dos honorários pelo mais frequente; a prova pelo valor com até um mês;
  a comparação com 18/11 pela chave inteira; os avisos da tela no relatório; os honorários conferidos até R$ 1,00; o
  leiaute como "mais provável"; a ordem com o script rodado de novo e as linhas marcadas; o texto do caso b e o do
  honorário de 10/2026).
- **O eco**: o `dominio sql` mostra na tela o começo da consulta (uns 500 caracteres) já com o código da empresa no
  lugar do marcador (`ponte/dominio.py`, na linha do registro da consulta), e os comentários vão junto. Foi assim que o
  código apareceu uma vez na conversa (o registro, "Antes"). A regra que o executor desta fila passou a seguir: trocar o
  marcador só no corpo, sem os comentários, e nunca levar pra conversa a linha que começa com "dominio sql:", só a
  contagem e o tempo. As três consultas novas têm o comentário sem o marcador; as de 18/11 ainda o têm. **Sugestão pra
  quem escreve as filas**: pôr essa regra nas Regras das próximas, ou uma fila da ponte que mande o eco da consulta só
  pro arquivo de log, sem imprimir.
- **A estrutura mostrada à revisão** tinha, no histórico das duas GPS de 2025 ("(PAGO EM dd/mm/aaaa)"), o dia do
  pagamento delas: o comando que escondia o dia escondia o da coluna da data, não o de dentro do texto. Não foi pro
  repositório; foi refeita pelo próprio script (`--estrutura`, que esconde toda data).
