# Fila de 04/11/2026 — o andamento das contabilidades no Domínio: o que se achou

> Escrito pelo Code do PC do escritório em 05/11/2026, na branch `fila-04-11-contabil`. Os rascunhos estão em
> `ponte/rascunhos/` (`contabil_andamento.sql`, `contabil_encerramento.sql`, `contabil_saldos.sql`,
> `contabil_cruzamentos.sql`), que a ponte **não lê**: o contrato, a função e as tabelas do sistema não mudaram.
> Os números são **do escritório inteiro** ou contagens. O resultado de cada empresa ficou só em arquivos de
> `C:\ponte-dominio\` (`contabil_*-AAAA-MM.txt`), fora do repositório. Nenhuma descrição de conta de empresa cliente,
> nenhum histórico e nenhum usuário foram mostrados: as descrições entraram só em filtros (`WHERE`) e contagens, e as
> únicas lidas são as dos grupos (as sintéticas) do plano modelo do escritório (abaixo).
> Os conjuntos: **"as 110 ativas"** = as empresas com o cadastro ativo no Domínio (`stat_emp` A, M, C ou B, como no
> `empresas.sql`) **e** os parâmetros da contabilidade (`bethadba.ctparmto`; as outras 9 ativas não têm contabilidade);
> **"as 97 com lançamento"** = as empresas (ativas ou não) com algum lançamento de 11/2025 a 10/2026; **"as 86"** = as
> ativas no cadastro com lançamento nesses 12 meses. Uma revisão independente (três leitores: privacidade, o SQL e o
> que a fila pediu) passou pelos rascunhos e por este arquivo antes do commit; o que ela achou já está corrigido aqui.

## 1. O plano de contas

### As tabelas (com a descrição do catálogo)
- `bethadba.ctcontas` ("Contas Contabeis - Cadastro"): `codi_emp` (a empresa dona do plano), `codi_cta` ("Codigo",
  o reduzido), `clas_cta` ("Classificacao", só os dígitos), `tipo_cta` ("Tipo (A=Analitico/S=Sintetico)") e, só em
  filtro, `nome_cta` ("Descricao": pode ter nome de sócio, cliente, fornecedor e número de conta bancária). **Não tem
  natureza, grau nem marca de tipo** (caixa, banco, receita, retificadora, transitória).
- `bethadba.ctlancto` ("Lancamentos Contabeis"): `cdeb_lan` ("Debito") e `ccre_lan` ("Credito"), o reduzido do plano da
  `CODI_EMP_PLANO` ("Empresa do plano de contas"); `vlor_lan` ("Valor"); `data_lan` ("Data"); `orig_lan` ("Origem");
  `dorig_lan` ("Data Original").
- `bethadba.ctnatureza_conta` ("NATUZA DAS CONTAS", 1.463 linhas): `codi_emp`, `clas_cta` (o começo da classificação) e
  `natureza` ("C=CREDORA/D=DEVEDORA"). Vale a linha de começo mais comprido. Nas 97 com lançamento: 1 devedora,
  2 credora, 3 devedora, 4 credora em 93 (algumas com o 5 e o 6, e o 23 ou 24 do patrimônio líquido, que em 2 empresas
  está como devedor); **em 3 o 3 é credor e o 4 devedor** (as receitas no 3 e as despesas no 4); 1 sem a tabela.
- O grau sai do tamanho da classificação, não da máscara: `ctparmto.masc_par` diz `9.9.99.999.999` em 95 das 97, mas o
  que está guardado é 1 / 11 / 111 / 11101 (as sintéticas) e 11101001 ou 1110100001 (as analíticas, 8 ou 10 dígitos —
  duas versões do mesmo plano).
- `bethadba.ctparmto` ("Parametros", 367 linhas): `ccxa_par` ("Conta caixa"), `zera_par` ("Conta destino" do
  zeramento), `codi_pad` ("Origem do Plano de Contas"). A tabela tem senhas e os dados dos signatários: as consultas
  listam as colunas uma a uma.

### Plano por empresa, a partir de um modelo
- **Cada empresa tem o seu plano**: o `codi_pad` está vazio nas 367, e nas 473.515 linhas de lançamento dos 12 meses
  (das 97) a `CODI_EMP_PLANO` é a própria empresa.
- **Os planos são cópia de um modelo do escritório**: a empresa de código 998 (o nome começa com "MODELO"; sem nota,
  folha nem lançamento; 246 grupos e 465 analíticas). Os 246 grupos dela estão em 50 ou mais das 97; 179 em 80 ou mais.
  Os grupos que os rascunhos usam (descrições do modelo): `11101` CAIXA · `11102` BANCOS CONTA MOVIMENTO · `11103`
  APLICAÇÕES FINANCEIRAS LIQUIDEZ IMEDIATA · `11301` BANCOS CONTA VINCULADA · `41101` RECEITA BRUTAS DE VENDAS E
  MERCADORIAS · `41102` RECEITA DE PRESTAÇÃO DE SERVIÇOS · `412` (-) DEDUÇÕES DA RECEITA BRUTA · `41201` (-)
  CANCELAMENTO E DEVOLUÇÕES · `32101` e `32201` DESPESAS COM PESSOAL · `31102` e `31301` MÃO-DE-OBRA DIRETA · `51401`
  APURAÇÃO DO RESULTADO DO EXERCÍCIO · `24301` LUCROS OU PREJUÍZOS ACUMULADOS. Os grupos retificadores do modelo começam
  todos com "(-)": `11202`, `11503`, `12102`, `12103`, `13107`, `13209` (depreciações), `13305` (amortizações), `21203`,
  `24102`, `31103`, `31105`, `412` e os três de baixo dele.
- O plano referencial da Receita (`CTCONTAS_SRF_REF`, a conta da empresa → o referencial, que é público) acharia tudo
  pelo mesmo código, mas **só 6 das 86 têm o vínculo** (provavelmente as que entregam a ECD): não serve de caminho.
  Serviu pra confirmar: nas 6, o caixa está no `11101`, os bancos no `11102`, e os itens 001, 003 e 004 dos grupos de
  pessoal vão pra remuneração de empregados, o 002 pra de dirigentes, o 006 pra previdência e o 007 pro FGTS.

### O caixa e os bancos: pela classificação
- O Domínio não marca a conta. Nas 97 com lançamento: as 97 contas com extrato importado (57 empresas) estão todas no
  `11102`, e as 69 empresas com a conta caixa no parâmetro (`ccxa_par`) a têm no `11101`. A lista de contas caixa
  (`ctcontacaixa`) tem uma conta por empresa e o tipo vazio: não marca banco.
- **Escolhido: a classificação** — caixa = as analíticas do `11101`, bancos = as do `11102`. Nas 110: 216 contas de
  caixa em 107 empresas, 923 de banco em 99, **as duas em 99**. Ficam de fora as aplicações (`11103`) e a conta
  vinculada (`11301`), e, do caixa, as 11 contas transitórias ou "a classificar" que algumas empresas têm dentro do
  `11101` (pela descrição, só no filtro).

### A receita, a folha, as transitórias e as retificadoras
- Receita bruta: as analíticas do `41101` e do `41102` (em 101 e 104 das 110); devolução, as do `41201` (97). A conta do
  acumulador da escrita fiscal (`EFACUMULADOR_VIGENCIA.CCRE_ACU` "Conta Credito" e `CDEB_ACU` "Conta Debito") bate
  menos (item 5).
- Salários, 13º, férias e pró-labore; INSS e FGTS: não há campo (a configuração da integração da folha tem só os itens
  dos encargos e dos líquidos; o salário vai pelos grupos de eventos). Ficou a descrição da conta, só em filtro e
  contagem: ela acha esses tipos quase sempre nos mesmos itens dos grupos de pessoal (001, 002, 004, 005, 006 e 007,
  em 53 a 69 das 97), com variantes (outros dois itens do `32201` em 66; dois itens de 10 dígitos em 52).
- Transitórias: o Domínio não marca. Com saldo, achadas: a apuração do resultado (`51401`, a conta destino do zeramento
  em 100 empresas — nas outras, o destino é o `24301` direto) e a conta com "transitória", "a classificar", "a
  identificar" ou "não identificado" na descrição (quase todas no `11101`). A palavra "trânsito" acharia uma despesa do
  `32204` (84 empresas), que não é transitória: fica de fora.
- Retificadoras: o Domínio não marca (a tabela de seleção de redutoras está vazia). **Regra do rascunho: a conta cuja
  descrição, ou a de um grupo acima dela, começa com "(" e tem "-" nos 5 primeiros caracteres** ("(-)", "( - )") — no
  modelo, todos os grupos retificadores começam assim (a depreciação acumulada de cada bem é analítica sem o "(-)",
  debaixo do `13209`, que tem). Pra ela, a natureza é a contrária da do grupo.

## 2. Até onde cada empresa está lançada (`contabil_andamento.sql`, 18,9 s com `--mes 2026-10`)

### As origens (`orig_lan`)
- O nome de cada código está em `bethadba.CTORIGEM_LANCAMENTO` (29 linhas, tabela de códigos do sistema). Os que o
  rascunho usa: 1 normal, 2 zeramento, 3 patrimônio, 4 a 11 e 21 a 29 a escrita fiscal, 13 a folha, 14 a 20 honorários.
- **A 39 é o extrato bancário importado**: 30.856 das 31.538 linhas dela (de 01 a 09/2026) estão em
  `CTEXTRATO_BANCARIO_LANCAMENTO_ITEM_LANCTO`; a normal, nenhuma. A 34 (12 linhas) e a 65 (4) não estão na lista.
- De 01 a 09/2026: saídas 286.481 linhas (61 empresas), entradas 35.488 (65), extrato 31.538 (19), serviços 3.094
  (37), normal 2.857 (37), folha 1.388 (58), apuração 393 (47), zeramento 188 (4), honorários 85 (10). **Quase tudo é
  integração**: o lançamento do contador (o normal e o extrato) é ~10%.
- A data em que o lançamento foi feito **não existe** (o registro de alterações e a auditoria do Domínio estão vazios).
  A `dorig_lan` se comporta como a data em que o lançamento entrou no Domínio: as 26.059 linhas de saídas de 10/2026
  entraram depois da data delas (a última em 04/11/2026), e em 02/11 (feriado) entraram 23.565 (fila de 29/10). Sem
  hora, e a integração gerada de novo troca a data. Vira o `incluido_ate`.

### A conciliação e o extrato
- As tabelas (todas no rascunho): `CTEXTRATO_BANCARIO_LANCAMENTO` ("Lançamento de extrato bancário": `CODI_EMP`,
  `I_LANCAMENTO`, `CODI_CTA` "Conta contábil do banco"), `_ITEM` ("… - lançamentos": `I_ITEM`, `DATA_ITEM` "Data"),
  `_ITEM_LANCTO` ("… - lançamentos contábeis": o `NUME_LAN` de cada linha do extrato) e `CTCONCILIACAO_BANCARIA`
  ("Conciliação bancária", 275.866 linhas: a linha do extrato com o lançamento e as marcas `CONCILIADO_DEB`/
  `CONCILIADO_CRE`, "Conciliado a débito/crédito (S/N)"). As marcas: S/N em 145.997 linhas, N/S em 128.709, S/S em
  1.155 e **nenhuma N/N** — toda linha da tabela é uma conciliação; o rascunho confere a marca mesmo assim.
- **A conciliação aqui é automática**: a linha do extrato contabilizada pela configuração ganha a conciliação em 22.484
  de 27.147 (de 01 a 09/2026); a lançada à mão a partir do extrato (3.709 linhas, 18 empresas), nenhuma. Das 19
  empresas com extrato em 2026: 4 com 90% ou mais conciliado, 8 com 50 a 90%, 7 com menos de 50%. As marcas da
  `ctlancto` quase não se usam (11 das 30.930 partidas do extrato nas contas de banco).
- O extrato de 2026 veio todo de importação; contabilizado, 99,7% (30.856 de 30.937 linhas).
- **O extrato diz mais que a conciliação**: até que dia foi importado e quantas linhas ainda estão sem lançamento. O
  rascunho traz os dois (`extrato_*` e `conciliad*`).
- Fica de fora o extrato da Contabilidade Digital (as tabelas `_ICEBERG`): só 1 empresa o usa.

### O rascunho
`codigo`, `banco_contas`, `banco_ate`, `banco_ultimo`, `banco_ultimo_geral`, `caixa_ate`, `caixa_contador_ate`,
`extrato_contas`, `extrato_ate`, `extrato_pendentes`, `conciliadas`, `conciliado_ate`, `lanc_normais`, `lanc_extrato`
(39), `lanc_fiscal` (4 a 7), `lanc_folha` (13), `lanc_apuracao` (10), `lanc_outros`, `incluido_ate`. A mais que o
pedido: `banco_ultimo_geral`, `caixa_contador_ate` e os três `extrato_*`. Fora o zeramento em tudo; nada depois do
fim do mês. O banco olha os 12 meses (a conta sem movimento neles fica de fora, como a fila pede); o caixa e o
`banco_ultimo_geral`, todo o tempo — por isso os 18,9 s.
- **O caixa recebe a integração**: das partidas no `11101` de 01 a 09/2026, 21.137 são de saídas (17 empresas), 7.999
  do extrato, 1.514 de entradas, 1.349 normais, 781 de serviços, 166 da folha e 85 de honorários. O último lançamento
  no caixa diz quando a integração das notas entrou, não o trabalho do contador: daí o `caixa_contador_ate` (o último
  que não veio de integração). No banco só entram o extrato, o normal e 1 de pagamento de guia.

### A distribuição (as 110 ativas, `--mes 2026-10`)
| | em 10/2026 | em 09/2026 | 06 a 08/2026 | antes de 06/2026 | sem |
|---|---|---|---|---|---|
| banco mais atrasado (`banco_ate`, 12 meses) | 0 | 3 | 8 | 29 | 70 |
| banco mais adiantado (`banco_ultimo`, 12 meses) | 0 | 6 | 7 | 27 | 70 |
| banco, de todo o tempo (`banco_ultimo_geral`) | 0 | 6 | 7 | 47 | 50 |
| caixa, qualquer origem (`caixa_ate`) | 14 | 18 | 16 | 41 | 21 |
| caixa, só o contador (`caixa_contador_ate`) | 0 | 6 | 10 | 66 | 28 |
| extrato importado (`extrato_ate`, 12 meses) | 0 | 4 | 8 | 16 | 82 |
| conciliado (`conciliado_ate`, 12 meses) | 0 | 4 | 8 | 15 | 83 |

- **70 das 110 não têm conta de banco com movimento nos 12 meses, e 50 nunca tiveram.** O último movimento de banco,
  de todo o tempo: 22 em 2026, 28 em 2025, 3 em 2024, 2 em 2023, 3 em 2022, 1 em 2021 e 1 em 2020. Ou seja: em 50 a
  contabilidade é só a integração (as notas e a folha), e em boa parte das outras 60 o banco anda com até um ano de
  atraso.
- Contas de banco com movimento nos 12 meses, por empresa: 0 em 70, 1 em 22, 2 em 11, 3 em 5, 4 em 2.
- Em 10/2026 (em 05/11): **a escrita fiscal integrada em 50 empresas, e a folha, o normal, o extrato e a apuração em
  nenhuma**. Em 09/2026: a escrita fiscal em 73, a folha em 24, o normal em 8, a apuração em 6 e o extrato em 5.
- O extrato: em 28 empresas nos 12 meses; com linha sem lançamento, 9 (95 linhas; 161 em 09/2026); com conta
  conciliada, 27.
- `incluido_ate` em 10/2026: 43 depois do mês (a integração feita em novembro), 7 dentro dele, 60 sem lançamento.

### Também no `ctparmto` (não entrou no rascunho)
- `FECHAMENTO_DATA` ("Data do fechamento"): em 68 das 110, de 12/2015 a 09/2026 (24 em 2025, 10 em 2024, 5 no
  primeiro semestre de 2026, 1 em 09/2026); e o período de trabalho (`dini_par`/`dfin_par`, com o `lant_par`, que não
  permite lançar fora dele em 57). Pode ser o "fechado até" que a Adaini marca no Domínio — **a conferir com ela**.

## 3. O encerramento do exercício (`contabil_encerramento.sql`, 4,2 s por ano)
- Não há registro de "zeramento feito": ele é o conjunto de lançamentos `orig_lan = 2`, sempre no último dia do período
  (2024: 48 de 48 em 31/12; 2025: 34 em 31/12 e 1 em 30/11). O rascunho: `codigo`, `zerado_em`, `zeramentos` (quantos
  dias de zeramento no ano: o trimestral tem 4), `zerado_incluido_em` (quando o último zeramento entrou no Domínio),
  `lancados_depois` (os lançamentos que entraram depois do zeramento **do período deles**) e `lancamentos_do_ano`.
- A periodicidade que o Domínio guarda (`CTPARMTO_DERE_VIGENCIA`) ficou de fora: as 363 empresas têm uma vigência só,
  de 01/10/2026, anual — a guia é nova e contradiz os anos de antes (4 empresas zeraram 4 vezes em 2024, 3 em 2025).
- Contagens (as 110 ativas):

| | 2024 | 2025 |
|---|---|---|
| com o zeramento | 48 | 35 |
| com lançamento no ano e sem o zeramento | 18 (13 com mais de 100 lançamentos) | 40 (31 com mais de 100) |
| sem lançamento no ano | 44 | 35 |
| zeramentos no ano: 1 / 2 / 3 / 4 | 41 / 3 / 0 / 4 | 30 / 1 / 1 / 3 |
| com lançamento do período entrado depois do zeramento | 4 empresas, 353 lançamentos | 6 empresas, 24.674 lançamentos |

- O zeramento de 2025 entrou no Domínio de 12/2025 a 10/2026 (15 em 03/2026). Os 24.674 de depois: 13.878 de entradas
  (2 empresas) e 10.366 de saídas (1), de 114 a 225 dias depois — a escrita fiscal gerada de novo depois do
  encerramento —, mais 300 do extrato, 41 da folha, 36 normais, 27 de serviços e 26 da apuração. O resultado dessas
  empresas pode estar diferente do que o zeramento levou ao patrimônio líquido.

## 4. Os saldos estranhos (`contabil_saldos.sql`, 7,4 s com `--mes 2026-10`)
- **O saldo não fica guardado** (a tabela de saldos por conta e dia está vazia; não há saldo de abertura): sai da soma
  de todos os lançamentos até o dia, com o zeramento.
- O rascunho usa os dois `?` do mês, como as outras consultas da ponte (a fila pedia um só, o último dia): só o último
  vale. `codigo`, `caixa_negativo`, `contra_natureza`, `sem_natureza` (a mais), `transitorias`, `transitorias_valor`
  (este fica só no arquivo). A transitória fica só na coluna dela (não entra no caixa nem no contra a natureza).
- Em 10/2026, nas 110 ativas (98 com alguma conta com saldo):
  - **caixa negativo: 10 empresas** (10 contas);
  - **conta contra a natureza: 64 empresas, 214 contas** — 183 contas comuns do lado contrário e 31 retificadoras do
    lado do grupo (a depreciação devedora, a dedução da receita credora…); 1 a 3 contas em 47 empresas, 4 a 10 em 14,
    mais de 10 em 3. Sem a regra das retificadoras, as do lado delas seriam mais 238;
  - **sem natureza: 66 contas em 14 empresas** (a classificação zerada, a compensação de algumas, a empresa sem a
    tabela): o contra a natureza não as mede;
  - **transitória com saldo: 3 empresas** (3 contas).
- As contra a natureza pelos 2 primeiros níveis:

| | natureza | comuns | retificadoras do lado do grupo | empresas | retificadoras do lado delas (fora) |
|---|---|---|---|---|---|
| 1.1 ativo circulante | D | 74 | 0 | 28 | 1 |
| 1.2 realizável a longo prazo | D | 0 | 0 | 0 | 8 |
| 1.3 ativo não circulante | D | 3 | 0 | 3 | 43 |
| 2.1 passivo circulante | C | 60 | 0 | 32 | 0 |
| 2.3 resultado de exercícios futuros | C | 2 | 2 | 3 | 1 |
| 2.4 patrimônio líquido | C | 3 | 1 | 4 | 22 |
| 2.4 patrimônio líquido (natureza do 24 devedora) | D | 4 | 5 | 2 | 0 |
| 3.1 custos | D / C | 4 / 0 | 13 / 0 | 17 / 0 | 42 / 5 |
| 3.2 despesas | D / C | 18 / 1 | 2 / 0 | 13 / 1 | 7 / 0 |
| 3.4 | D | 2 | 0 | 1 | 0 |
| 4.1 receitas operacionais | C | 4 | 8 | 6 | 109 |
| 4.3, 4.6 e 6.1 | C | 6, 1 e 1 | 0 | 1, 1 e 1 | 0 |

  No terceiro nível, as comuns do circulante: `111` disponível credor 20 contas (16 empresas: caixas e bancos
  negativos), `112` clientes credor 27 (2), `113` outros créditos credor 11 (9), `115` **estoque credor 16 (13)**;
  `211` 4 (4), `213` fornecedores devedor 16 (4), `214` tributos devedor 9 (7), `215` **obrigações trabalhistas
  devedor 27 (20)**, `216` 4 (4); `322` despesa credora 18 (12). As 5 do 2.4 devedor são das 2 empresas em que a
  natureza do patrimônio líquido está como devedora (a retificadora dele, invertida, sai credora): é a tabela de
  natureza delas que está estranha.

## 5. A receita e a folha lançadas (`contabil_cruzamentos.sql`, 1,4 s com `--mes 2026-10`)
- `receita_lancada` = o crédito no `41101`/`41102` menos o débito no `41201`; `folha_lancada` = o débito nas analíticas
  do grupo 3 de salários, 13º, férias e pró-labore, pela descrição (fora INSS, FGTS, previdência, salário-educação e
  provisão; o "13" só como "13…SAL", "13º ", "13° " ou "13O "); `encargos_lancados` = o débito nas analíticas do grupo 3
  de INSS, FGTS, previdência e salário-educação (fora a previdência privada e a provisão).
- A conferência dentro do Domínio (as 110 ativas, até R$ 1,00), contra a `receita_bruta` do `faturamento.sql` e o
  `salarios` + `decimo_terceiro` + `pro_labore_valor` do `folha_valores.sql`:

| | bate | não bate | o contábil sem | o fiscal / a folha sem | os dois sem |
|---|---|---|---|---|---|
| receita, 09/2026 | **53** | 12 | 11 | 0 | 34 |
| receita, 08/2026 | **60** | 11 | 4 | 0 | 35 |
| folha, 09/2026 | **23** | 1 | **56** | 0 | 30 |
| folha, 08/2026 | **21** | 2 | 53 | 0 | 34 |

- Os outros jeitos testados (09/2026): a receita pela conta dos acumuladores bate em 35 (31 não batem). A folha pelo
  código da conta (os itens 001, 002, 004 e 005 dos grupos de pessoal; o 003 ficou fora do teste) e pela origem 13
  fora os encargos: 23, como pela descrição.
- **"O contábil sem" a folha é a folha ainda não integrada**: em 09/2026 a folha estava na contabilidade de 24
  empresas; em 56 o Domínio tem a folha calculada e o contábil não.
- Os 12 que não batem na receita (09/2026): 6 com o contábil maior e 6 com o fiscal maior. **6 têm causa achada** (4
  deles dentro de 1%): nota de saída do mês ainda sem lançamento (3), a nota da filial lançada na matriz (a contabilidade
  centralizada, 1), a devolução no fiscal e não no contábil (1), a integração em outra conta do grupo 4 (1) e no grupo 3
  (o plano com as receitas no 3, 1) — uma empresa pode ter mais de uma. **6 ficam a conferir** (2 dentro de 1%, 4 acima).
  Receita creditada por nota de acumulador sem faturamento: nenhuma.
- A folha que não bate: em 09/2026, 1 com o contábil menor, dentro de 5%, sem outra causa achada (os proventos têm o
  que não é despesa, como o salário-família); em 08/2026, 2 com o contábil maior e lançamento de outra origem (não a
  folha) nas contas de folha — tirado ele, 1 bate.
- **Os encargos quase não aparecem**: a integração da folha de 09/2026 debitou salários no grupo 3 em 23 empresas e
  FGTS e INSS em só 4 (e as obrigações, `215`, em 25). Contra as guias do mês (FGTS + INSS da empresa, RAT e
  terceiros): bate em 6, não bate em 1, o contábil sem em 42. Nesse escritório a despesa de encargos não costuma ser
  contabilizada pela integração.

## O que o Claude da sessão do Samuel decide
1. **O caixa e os bancos pela classificação** (`11101`/`11102` do plano modelo), que o extrato e o parâmetro confirmam.
   O plano de outra estrutura sairia sem caixa e banco (das 110, 99 têm os dois).
2. **O extrato vale mais que a conciliação** (a conciliação é automática), e os dois andam juntos com o banco: em
   10/2026, o mais atrasado em 09/2026 em 3 pelo banco e em 4 pelo extrato, de 06 a 08/2026 em 8 e 8. O
   `caixa_contador_ate`, fora a integração, no lugar do `caixa_ate` — ou os dois.
3. **A régua de "feito até"**: 70 das 110 sem movimento de banco em 12 meses (50 nunca tiveram). Pra essas, o
   andamento é "a escrita fiscal e a folha integradas no mês": o `lanc_fiscal`, o `lanc_folha` e o cruzamento dizem mais
   que o banco.
4. **O `FECHAMENTO_DATA` do `ctparmto`**: se a Adaini confirma que é o "fechado até", ele entra no andamento.
5. **A regra das retificadoras** (a descrição com "(" e "-" no começo, na conta ou num grupo acima) e a das
   transitórias (a `51401` e a descrição) dependem do texto do plano: se a equipe renomear uma conta, ela muda de lado.
6. **A folha pela descrição da conta** (bate igual ao código e cobre as variantes do plano).
7. **As 3 empresas com as receitas no grupo 3** saem erradas no cruzamento; dá pra trocar o "4" e o "3" fixos pela
   natureza da `ctnatureza_conta` (o grupo de resultado credor). E as 2 com o patrimônio líquido devedor na tabela de
   natureza.
8. **A data em que alguém mexeu na contabilidade**: o Domínio guarda as sessões de cada usuário em cada empresa
   (`geloguser`, com data e hora). Diria o último dia de trabalho em cada contabilidade, mas é o uso do sistema por
   pessoa da equipe: não li, fica pra decidir (se sim, só contado por empresa, sem o usuário).
9. Os arquivos de `C:\ponte-dominio\` desta fila (o resultado por empresa e as consultas de conferência, `cruz-*.sql`,
   `saldos-*.sql`, `enc-*.sql`) ficaram lá; podem ser apagados.
