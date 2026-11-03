# Dúvidas da fila de 03/11/2026 — o XML guardado na Domínio e o IPI do item

Feita em 03/11/2026, só com a **empresa de código 65** e só **09/2026**, no banco do Domínio Web de hoje. O conteúdo do
XML foi lido só em código, pelo script `C:\ponte-dominio\xml_teste.py` (fora do repositório): ele abre a conexão pela
própria ponte (`dominio._abrir_da_config`), roda os dois rascunhos de `ponte/rascunhos/` com os três `?` como
parâmetros, abre e compara tudo em memória e imprime só contagens. Nenhum trecho do XML, chave, CNPJ, produto ou valor
passou pela conversa, pelo log ou por arquivo. O script levou 109 s (a leitura dos 46 XMLs, 14 s; a dos itens, 6 s).

## 1. Descompactar o XML

- **No banco** (`DECOMPRESS` do SQL Anywhere, nota a nota): **0 de 46** com `DECOMPRESS(x.CONTEUDO_XML)`, 0 com
  `'zip'` e 0 com `'gzip'` — as 46 com "Decompression error: Input data is corrupt (-960)".
- **No Python**, cada um tentado à parte: zlib 0, gzip 0, deflate cru 0, zipfile 0, **texto puro (UTF-8) 46**.
- **O caminho**: o `CONTEUDO_XML` da `EFATENDIMENTO_NFE_XML_V2` é o **XML em texto, sem compactar**, apesar do
  "COMPRIMIDO" da descrição da tabela. É por isso que o banco recusa o `DECOMPRESS` (não há o que descompactar) e que o
  `LENGTH` da fila anterior (de 7.119 a 212.231 bytes na empresa 65) é o tamanho do próprio XML. As 46 viraram XML
  válido. Tamanho aberto: de 7.119 a 212.231 bytes, **média 38.261**.
- **O que tem dentro** (as 46): raiz `nfeProc` em 46 (nenhuma com a `NFe` sozinha), `protNFe` com `cStat` 100 em 46, a
  chave do `infNFe` igual à da Domínio em 46, `finNFe` 1 em 46; 1.263 itens (`det`), 1.086 com o `cEAN` preenchido e
  diferente de "SEM GTIN".

## 2. A descrição e o EAN do cadastro × os do XML

As 46 notas com XML, juntadas com os itens do `notas_entrada.sql` (a empresa 65, 09/2026: 1.293 itens em 50 notas):

| | Quantos |
|---|---|
| Itens na Domínio / no XML (nas 46 notas) | 1.263 / 1.263 — as 46 com o mesmo número de itens |
| Pareados pelo número do item (`SEQUENCIAL_ITEM_MEP` = `nItem`) | 46 notas (nenhuma pela ordem) |
| Descrição do cadastro = `xProd` (sem maiúscula, acento e espaço sobrando) | 1.127 |
| — o `xProd` começa pela descrição do cadastro (cortada) | 20 |
| — diferente | 116 |
| EAN do cadastro = `cEAN` / = `cEANTrib` / diferente | 1.024 / 1 / 38 |
| — cadastro sem EAN | 200 (no XML, 177 itens com o `cEAN` vazio ou "SEM GTIN") |
| Código do fornecedor do de-para = `cProd` / diferente / sem de-para | 976 / 188 / 99 |
| Código do produto da empresa = `cProd` | 715 |
| NCM do cadastro = `NCM` do XML / diferente | 1.241 / 22 |
| Quantidade = `qCom` / valor unitário = `vUnCom` (até R$ 0,01) | 1.263 / 1.263 (nenhum diferente) |

Ou seja: **a quantidade e o valor unitário da Domínio são os da nota** (todos); **a descrição, o EAN, o código do
fornecedor e o NCM nem sempre** — o cadastro de produtos nasce do XML, mas 9% das descrições, 4% dos EANs, 16% dos
códigos do de-para e 2% dos NCMs já não são os da nota (o cadastro foi editado, ou o mesmo produto do cadastro recebeu
outro produto do fornecedor depois). E o XML tem EAN em 1.086 itens; o cadastro, em 1.063.

## 3. O IPI do item

- **As colunas de IPI da `efmvepro`** (`dominio tabelas --procurar "efmvepro ipi"`): `vlor_mep` ("Valor total (Base
  calculo + Valor IPI)"), `vipi_mep` ("Valor do IPI"), `isentas_ipi_mep` ("Valor de isentas IPI"), `outras_ipi_mep`
  ("Valor de outras IPI"), `UNIDADE_MEDIDA_VALOR_IMPOSTO_IPI` ("Unidade de Medida Valor do Imposto IPI"); e, sem valor,
  `aliq_ipi_mep`, `enquadramento_ipi_mep`, `CODIGO_IMPOSTO_IPI`, `UNIDADE_MEDIDA_QUANTIDADE_TRIBUTADA_IPI`,
  `UNIDADE_MEDIDA_VALOR_POR_UNIDADE_IPI`, `I_RECOLHIMENTO_IPI` e `CODIGO_RECOLHIMENTO_IPI`.
- **Nas 16 notas** com IPI na nota e o `vipi_mep` zerado nos itens, a soma nos itens bate com o IPI da nota (até
  R$ 0,01) em: `vipi_mep` **0**, `isentas_ipi_mep` **0**, `outras_ipi_mep` **0**, `UNIDADE_MEDIDA_VALOR_IMPOSTO_IPI` **0**,
  `vlor_mep − vpro_mep` **0** e `vlor_mep − bcal_mep` **0**. Nas outras 34 notas, sem IPI, as colunas batem porque tudo
  é zero.
- **No XML**: 15 das 16 têm XML, e **a soma do `vIPI` dos itens bate com o IPI da nota nas 15**. Nos 1.263 itens com XML,
  419 têm `vIPI` — e os 419 estão com o IPI zerado na Domínio.
- **Nenhuma coluna da Domínio traz o IPI do item** nesta empresa: ele fica só na nota (`IPI_ENT`). O rascunho
  `notas_entrada.sql` **não mudou** (a fila manda não mudar quando nenhuma coluna bate); o IPI do item segue saindo do
  `vipi_mep`, que aqui vem zerado.

## O que o Claude da sessão do Samuel decide

1. **O XML é texto**: a ponte lê o `CONTEUDO_XML` como está (UTF-8), sem descompactar. Visto só na empresa 65 em
   09/2026; se aparecer um que não começa por `<`, vale tentar zlib/gzip antes de desistir — e anotar.
2. **De onde tirar cada coisa** pra comparar preço: a quantidade e o valor unitário batem nas duas fontes; a descrição,
   o EAN, o código do fornecedor, o NCM e o IPI do item, só o XML garante. Enquanto o XML existe (uns dois meses), ele é
   a fonte; depois, só a Domínio, com as diferenças da tabela do item 2 e sem o IPI do item.
3. **O IPI do item nas notas sem XML**: só o da nota. Ratear pelo valor dos itens é uma escolha (não é o que a nota
   diz), ou deixar o item sem IPI e a nota com o total.
4. **O tamanho**: média de 38 KB por XML aberto na empresa 65 (no escritório, a fila anterior mediu 14,9 KB de média
   em 09/2026 — é o mesmo número, sem compactação). Ler 46 XMLs levou 14 s: o catálogo é ligado pela `TRIM(c.CHAVE)`,
   sem índice; pra muitas empresas, vale filtrar o catálogo pela empresa e pela emissão antes.
5. **Fora do escopo desta fila** (só a empresa 65, só 09/2026): se em outras empresas — a indústria, com crédito de
   IPI — o `vipi_mep` vem preenchido; e se há XML guardado compactado de verdade em algum lugar.
