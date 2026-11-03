# Dúvidas da fila de 03/11/2026 — as notas de entrada, nota a nota

Feita em 03/11/2026, no banco do Domínio Web de hoje (ao vivo). Só o catálogo e contagens: nenhuma linha de nota, de
fornecedor ou de produto passou pela conversa, e o conteúdo do XML não foi lido (só `COUNT` e `LENGTH`). As tabelas
abaixo são só as que os rascunhos usam, com a descrição do catálogo. Os rascunhos estão em `ponte/rascunhos/`, que a
ponte não lê.

## As tabelas e as colunas

- **`bethadba.efentradas`** ("Notas Fiscais de Entrada", uma linha por segmento da nota — a nota com mais de um
  acumulador ou CFOP fica em várias linhas, cada uma com o seu `codi_ent`): `codi_emp` ("Empresa"), `codi_ent`
  ("Codigo"), `codi_for` ("Fornecedor"), `codi_esp` ("Especie"), `nume_ent` ("Documento"), `seri_ent` ("Serie"),
  `sub_serie_ent` ("Sub Serie"), `dent_ent` ("Data de entrada"), `ddoc_ent` ("Data de emissao"), `emitente_ent`
  ("Emitente da Nota Fiscal ( P-Proprio / T-Terceiro )"), `situacao_ent` (o catálogo diz "Codigo do modelo do documento
  fiscal"; os valores são os do SPED, como no `fiscal.sql`), `chave_nfe_ent` (char(44), "Chave da nota fiscal
  eletrônica"), `vprod_ent` ("Valor produtos"), `VALOR_DESCONTO_ENT` ("Valor do desconto"), `vfre_ent` ("Valor do
  frete"), `IPI_ENT` ("Valor IPI"), `ICMS_ST_ENT` ("Valor ICMS ST") e `vcon_ent` ("Valor contabil").
- **`bethadba.efespecies`** ("Especies - Cadastro"): `codi_esp` ("Codigo") e `codigo_modelo` (char(2), "Codigo do
  modelo"; `mode_esp`, "Modelo do documento fiscal", também existe).
- **`bethadba.efmvepro`** ("Notas Fiscais de Entrada - Produtos", os itens — 598 mil linhas): a chave é `codi_emp` +
  `codi_ent` + `nume_mep` ("Sequencial"); o item liga ao **segmento** da nota por `codi_emp` + `codi_ent`.
  Colunas usadas: `codi_pdi` (char(14), "Produto" — o código do cadastro de produtos da empresa),
  `SEQUENCIAL_ITEM_MEP` ("Sequencial Item"), `cfop_mep` ("CFOP"), `UNIDADE` (char(6), "Unidade comercializada"),
  `qtde_mep` ("Quantidade"), `valor_unit_mep` ("Valor unitario"), `vpro_mep` ("Valor do Produto"), `vdes_mep` ("Valor
  do Desconto"), `vipi_mep` ("Valor do IPI") e `valor_subtri_mep` ("Valor da SUBTRI"). Existem também `vlor_mep`
  ("Valor total (Base calculo + Valor IPI)"), `bicmsst_mep` ("Base do ICMS para Substituicao Tributaria"),
  `vfre_mep` ("Valor do frete"), `CODIGO_CEST` e `DESCRICAO_COMPLEMENTAR_MEP` ("Descrição complementar"). **O item não
  tem NCM nem descrição própria**: os dois vêm do cadastro do produto.
- **`bethadba.efprodutos`** ("Produtos - Cadastro", por empresa): `codi_emp`, `codi_pdi` ("Codigo"), `desc_pdi`
  (char(255), "Descricao"), `cncm_pdi` (char(8), "Nomenclatura Comum do Mercosul"), `codigo_barras_pdi` (char(16),
  "Codigo de barras") e `ean_pdi` (varchar(14), "Codigo EAN/Codigo de Barras - SE" — o de Sergipe, vazio aqui).
- **`bethadba.EFPRODUTOS_IMPORTACAO_ENTRADAS`** ("Tabela de relacionamento de importação de produtos - Entradas -
  Fornecedores": `CODI_EMP`, `CODI_PDI`, `SEQUENCIAL`, `CODI_FOR`) + **`EFPRODUTOS_IMPORTACAO_ENTRADAS_PRODUTOS`**
  ("… - Fornecedores - Produtos": `CODI_EMP`, `CODI_PDI`, `SEQUENCIAL`, `CODI_PDI_IMPORTACAO`, char(60), "Produto
  importação") — o **de-para da importação**: o produto da empresa, o fornecedor e o código do produto do fornecedor.
- **`bethadba.effornece`** ("Fornecedores - Cadastro", por empresa): `codi_emp`, `codi_for` ("Codigo"), `cgce_for`
  (char(14), "CNPJ"), `nome_for` (char(150), "Razao social") e `sigl_est` (char(2), "Estado").
- **`bethadba.geempre`** ("Empresa - Cadastro"): `codi_emp` e `cgce_emp` ("CNPJ"), o destinatário.
- **`bethadba.EFATENDIMENTO_NFE_CATALOGO`** ("Catálogo de Notas - Domínio Atendimento", 1,79 milhão de linhas):
  `I_CATALOGO` ("Código do catálogo"), `CODI_EMP` ("Empresa"), `CHAVE` (varchar(256), "Chave"), `TIPO` ("Tipo da nota
  (1=Entrada/2=Saída/3=Cancelamento/4=Serviço/5=Outros)"), `TIPO_NOTA` (1 = NFe), `EMISSAO`, `BAIXADO`,
  `DATA_BAIXADO` e `XML_EXCLUIDO` ("Exclusão do XML (0=Não excluído/1=Excluído)"). `URL_XML_NOTA` vem vazia.
- **`bethadba.EFATENDIMENTO_NFE_XML_V2`** ("XML DAS NFES - COMPRIMIDO", 60 mil linhas): `I_CATALOGO` e
  `CONTEUDO_XML` (long binary). As outras três (`EFATENDIMENTO_NFE_XML`, `…_COMPLEMENTO`, `…_COMPLEMENTO_V2`) estão
  vazias.

## As perguntas do item 1

1. **Os itens** estão na `efmvepro`, ligados ao segmento da nota (`codi_emp` + `codi_ent`); a nota inteira é o
   conjunto dos segmentos com a mesma chave. Colunas: acima. NCM, só no cadastro do produto.
2. **O produto do item é o do cadastro da empresa** (`codi_pdi` → `efprodutos`): a descrição é a do cadastro
   (`desc_pdi`) — o item não tem a sua (`DESCRICAO_COMPLEMENTAR_MEP` vazia em todos os itens contados). O **código do
   fornecedor** fica no de-para da importação (`CODI_PDI_IMPORTACAO`), pelo produto e o fornecedor da nota. O que os
   números dizem (09/2026, o escritório inteiro): 92% dos itens têm o de-para com o fornecedor da nota, e em 73% o
   código do produto da empresa **é** o código do fornecedor; dos 9.348 produtos dos itens, só 1 vem de mais de um
   fornecedor. Ou seja: o cadastro de produtos parece nascer da importação do XML, um produto por produto de
   fornecedor — e a descrição, a do XML no dia em que o produto foi criado. **Isso não foi conferido** (seria comparar
   com o `xProd` do XML, e esta fila não deixou ler o conteúdo); se alguém editou o cadastro depois, a descrição é a
   editada. O **EAN** está no cadastro do produto (`codigo_barras_pdi`, 69% dos itens; o `ean_pdi` é o de Sergipe, vazio
   em todos), não no item. Se é o `cEAN` ou o `cEANTrib` do XML, não dá pra saber sem o XML.
3. **A chave de acesso**: `efentradas.chave_nfe_ent` (char(44)). Toda NF-e (modelo 55), CT-e (57) e NFC-e (65) de
   entrada de 09/2026 tem a chave com 44 dígitos.
4. **O XML original**: sim, na `EFATENDIMENTO_NFE_XML_V2.CONTEUDO_XML` (long binary, **compactado** — o catálogo diz
   "COMPRIMIDO"; o formato não foi conferido), ligado à nota pela `EFATENDIMENTO_NFE_CATALOGO` (`CODI_EMP` + `CHAVE`,
   `TIPO` 1). **A Domínio apaga o XML depois de uns dois meses**: pela emissão, de 06/2025 (o começo da contagem) a
   06/2026 todo o catálogo está com `XML_EXCLUIDO` = 1 e sem linha na XML_V2; 07/2026 tem 18 XMLs, 08/2026, 355,
   09/2026, 28.467 de 32.678, e 10/2026 e 11/2026, todos. Quantos dias exatamente, a contagem não diz.
5. **O emitente**: `efentradas.codi_for` → `effornece` (`cgce_for`, `nome_for`, `sigl_est`), por empresa.
6. **As marcas**: a NF-e modelo 55 é a espécie com `efespecies.codigo_modelo` = '55'; a cancelada, denegada e
   inutilizada, a `situacao_ent` 2 a 5 (a mesma regra do `fiscal.sql`); a nota emitida pela própria empresa,
   `emitente_ent` = 'P' (877 NF-e de 09/2026; nenhuma da empresa 65).

## As contagens do item 2

**O escritório inteiro, entradas de 09/2026** (pela `dent_ent`, como a ponte conta; 1,7 a 5 s cada):

| | Quantas |
|---|---|
| Notas de entrada (como a ponte conta) | 5.000 |
| — modelo 55 | 3.169 (2.292 de terceiros + 877 próprias) |
| — modelo 57 (CT-e) / 65 (NFC-e) / outras | 1.657 / 158 / 16 |
| NF-e de terceiros com a chave de 44 dígitos | 2.292 (todas) |
| — no catálogo de notas | 2.273 |
| — com o XML guardado | 1.889 |
| — com itens | 2.105 (187 sem itens: lançadas só com valores) |
| Itens dessas notas | 12.336 |
| — com NCM (do cadastro) | 12.336 |
| — com EAN (código de barras do cadastro, sem o "SEM GTIN") | 8.571 |
| — com descrição própria no item | 0 (só a do cadastro; "iguais" não se aplica) |
| — com o de-para pro fornecedor da nota | 11.354 (11.344 com um código só; 10 com mais de um) |
| — com unidade / valor unitário / CFOP | 12.336 / 12.335 / 12.336 |

**A empresa de código 65, 01/10/2025 a 30/09/2026** (4,2 s):

| Mês | Notas (como a ponte) | NF-e 55 | de terceiros | chave 44 | com XML | com itens | itens | itens com NCM | itens com EAN |
|---|---|---|---|---|---|---|---|---|---|
| 10/2025 | 58 | 53 | 53 | 53 | 0 | 53 | 1.330 | 1.330 | 1.191 |
| 11/2025 | 65 | 61 | 61 | 61 | 0 | 61 | 1.407 | 1.407 | 1.223 |
| 12/2025 | 34 | 30 | 30 | 30 | 0 | 30 | 651 | 651 | 592 |
| 01/2026 | 52 | 47 | 47 | 47 | 0 | 47 | 912 | 912 | 766 |
| 02/2026 | 39 | 35 | 35 | 35 | 0 | 35 | 653 | 653 | 531 |
| 03/2026 | 35 | 33 | 33 | 33 | 0 | 33 | 719 | 719 | 574 |
| 04/2026 | 45 | 39 | 39 | 39 | 0 | 39 | 1.232 | 1.232 | 1.067 |
| 05/2026 | 56 | 51 | 51 | 51 | 0 | 51 | 1.094 | 1.094 | 920 |
| 06/2026 | 39 | 36 | 36 | 36 | 0 | 36 | 566 | 566 | 537 |
| 07/2026 | 37 | 34 | 34 | 34 | 0 | 34 | 584 | 584 | 502 |
| 08/2026 | 30 | 29 | 29 | 29 | 0 | 29 | 711 | 711 | 684 |
| 09/2026 | 55 | 50 | 50 | 50 | 46 | 50 | 1.293 | 1.293 | 1.093 |
| **Total** | **545** | **498** | **498** | **498** | **46** | **498** | **11.152** | **11.152** | **9.680** |

As 545 batem com o que o sistema tem. As outras 47 notas são de outros modelos (CT-e e afins). Nenhum item com
descrição própria.

**O tamanho do XML** (as 1.889 NF-e de terceiros de 09/2026 com XML, o escritório inteiro; `LENGTH` do compactado):
menor 6.846 bytes, maior 212.231, média 14.884, total 28,1 MB; um XML por nota (nenhuma com mais de um).

## Os rascunhos (item 3)

- **`ponte/rascunhos/notas_entrada.sql`** — uma linha por item, com a nota (a chave, o modelo, o número, a série, a
  emissão, a entrada, o CNPJ, o nome e a UF do emitente, o CNPJ do destinatário e os totais, somados dos segmentos) e
  o item (o número — `SEQUENCIAL_ITEM_MEP`, senão o sequencial da tabela —, o código da empresa, o código do
  fornecedor pelo de-para quando há um só, a descrição e o EAN do cadastro, NCM, CFOP, unidade, quantidade, valor
  unitário, valor total, desconto, IPI e ICMS-ST). Fora da Domínio: o `vNF` do XML (o total da nota é o valor
  contábil) e a descrição do jeito que o fornecedor escreveu, se for outra. **Teste** (empresa 65, 09/2026, 1,7 s):
  1.293 linhas, 50 notas, 1.093 com EAN, 1.293 com NCM, 1.192 com o código do fornecedor, 1.293 com o CNPJ do
  emitente, 6 UFs — bate com o item 2. **Os totais** (1,2 s): nas 50 notas, os produtos, o desconto e o ICMS-ST da nota
  batem com a soma dos itens; **o IPI não bate em 16**: a nota tem IPI e os itens vêm com o `vipi_mep` zerado (em
  nenhuma é o contrário). O IPI do item pode estar noutra coluna (`outras_ipi_mep`, `vlor_mep`) — não conferido.
- **`ponte/rascunhos/notas_entrada_xml.sql`** — a chave e o XML compactado de cada NF-e, com o mesmo filtro (e o
  catálogo com `TIPO` 1 e `XML_EXCLUIDO` 0). **Teste** (empresa 65, 09/2026, 1,3 s): 46 linhas, 46 notas, de 7.119 a
  212.231 bytes — bate com o item 2.

## O que o Claude da sessão do Samuel decide

1. **O XML só existe por uns dois meses.** Se a comparação precisa do XML (o `cEAN` e o `xProd` como o fornecedor
   escreveu), a ponte tem de lê-lo enquanto ele está lá (a rodada diária pega o mês de hoje e o passado). O histórico
   de antes de ~08/2026 só sai pelos itens (`efmvepro` + o cadastro de produtos), sem o XML.
2. **O formato do XML compactado** não foi conferido (esta fila só deixou `COUNT` e `LENGTH` no conteúdo). Pra
   descompactar há dois caminhos: no banco (o `DECOMPRESS` do SQL Anywhere, devolvendo o texto) ou no Python, com um
   XML gravado em `C:\ponte-dominio\` pra descobrir o formato sem abrir na conversa. Qualquer um precisa de uma fila
   que deixe ler o conteúdo.
3. **A descrição e o EAN são do cadastro de produtos da empresa**, não da nota. Os números sugerem que o cadastro nasce
   da importação do XML (um produto por produto de fornecedor, o código da empresa igual ao do fornecedor em 73% dos
   itens), mas a descrição pode ter sido editada depois, e o NCM é o de hoje no cadastro (não o da nota). Pra comparar
   preço entre clientes, o EAN (69% dos itens do escritório; 87% na empresa 65) é a ponte entre os produtos.
4. **As notas sem itens**: 187 das 2.292 NF-e de terceiros de 09/2026 foram lançadas só com valores; delas, só o XML
   (enquanto existir) traz os produtos.
5. **O IPI do item**: em 16 das 50 notas da empresa 65 o IPI está na nota e não nos itens.
6. **O volume**: 12.336 itens e 28 MB de XML compactado por mês no escritório inteiro; pros clientes autorizados,
   uma fração. O contrato do pacote, a função e as tabelas do banco não mudaram nesta fila.
7. **A data da nota**: os rascunhos usam a data de entrada (`dent_ent`, a do livro e a do `fiscal.sql`); a de emissão
   (`ddoc_ent`) vai junto.
