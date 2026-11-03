# Fila do Claude Code — 03/11/2026 · o XML guardado na Domínio e o IPI do item · branch `fila-notas-xml`

> **Para o Code do PC do escritório.** **Leia este arquivo inteiro antes de começar**, junto com o
> `docs/FILA-CODE-2026-11-03-NOTAS-DUVIDAS.md` (o que a fila das notas de entrada achou — esta parte dela). **Faça esta
> fila antes da `docs/FILA-CODE-2026-11-03.md`.** Faça os itens **inteiros, sem parar pra perguntar**. Na dúvida, a opção
> que **muda menos**, anotada em `docs/FILA-CODE-2026-11-03-XML-DUVIDAS.md`. Ao terminar: o **Registro de progresso**
> preenchido, commit e `git push origin fila-notas-xml`. **Nunca** push em `main` nem merge pra ela.

## O que é
- A fila das notas de entrada achou o XML compactado na `EFATENDIMENTO_NFE_XML_V2.CONTEUDO_XML` e o IPI da nota que
  não aparece nos itens em 16 das 50 notas da empresa 65 em 09/2026. Antes de o sistema fechar o contrato do envio,
  falta saber três coisas: **como descompactar o XML**, **se a descrição e o EAN do cadastro de produtos são os do XML**
  e **onde fica o IPI do item**.
- Pra isso, esta fila **lê o conteúdo do XML, mas só em código**: o Python descompacta e conta. Nada do conteúdo
  aparece na conversa, no log ou no repositório.
- Só a **empresa de código 65** (a do primeiro teste, a mesma da fila anterior) e só **09/2026**.

## Regras (as das filas de 29/10 e de 03/11, que valem todas)
- **O conteúdo do XML nunca aparece**: nem na conversa, nem no log, nem em arquivo do repositório. O script descompacta
  e mostra **só contagens** ("46 descompactaram com zlib", "44 têm o protNFe", "38 itens com o xProd igual"). Nunca
  imprima um trecho, uma tag com valor, uma chave, um CNPJ, um produto ou um valor — nem de uma nota só, nem pra
  conferir. Se precisar guardar algo pra olhar depois, o lugar é `C:\ponte-dominio\` e **não abra aqui**.
- O script fica **fora do repositório**: `C:\ponte-dominio\xml_teste.py` (ele lê dados de cliente). Pro repositório vai
  só o que se aprendeu (no DUVIDAS) e, no item 3, o rascunho SQL atualizado.
- **Não abra o `C:\ponte-dominio\config.ini`** (nem Read, `type`, `cat` ou `Get-Content`). O script abre a conexão pela
  própria ponte (`from ponte import config, dominio` e a função de conexão que o `dominio sql` usa), sem ler o arquivo
  na conversa.
- Código no repositório: **só** em `ponte/rascunhos/*.sql` e nos dois arquivos desta fila. **Não mexa** em
  `ponte/consultas/`, `ponte/*.py`, `supabase/` nem nos testes.
- **Não rode** o `instalar.ps1` e **não rode** o `ponte rodar` sem `--sem-enviar`. Não mexa nas tarefas do Agendador.
- Commits em pt-BR.

## Antes de começar
```
git fetch origin --prune
git checkout main
git pull
git checkout -b fila-notas-xml
py -3 tests/ponte.test.py
```
O teste da ponte tem de terminar em "Tudo certo.".

## 1. Descompactar o XML
Com o `ponte/rascunhos/notas_entrada_xml.sql` (a empresa 65, de 01/09/2026 a 30/09/2026 — as 46 notas com XML):
1. **No banco**: o SQL Anywhere tem o `DECOMPRESS`. Conte quantos `LENGTH(DECOMPRESS(x.CONTEUDO_XML))` dão certo, com e
   sem o algoritmo (`'zip'`, `'gzip'`), e o menor e o maior tamanho descompactado. Erro: anote a mensagem (sem valores).
2. **No Python** (o `C:\ponte-dominio\xml_teste.py`): leia o `xml_compactado` das 46 e tente, nesta ordem, `zlib`,
   `gzip`, deflate cru (`zlib.decompress(b, -15)`), `zipfile` e o texto puro (UTF-8). Conte quantos cada um abre.
3. Nos que abriram, conte (só contagens):
   - quantos começam pelo `nfeProc` e quantos pela `NFe` sozinha;
   - quantos têm o `protNFe` com o `cStat` 100;
   - quantos têm a chave do `infNFe` (o `Id` sem o "NFe" da frente) igual à chave da nota na Domínio;
   - quantos têm `finNFe` 1;
   - o total de itens (`det`) e quantos itens têm o `cEAN` preenchido e diferente de "SEM GTIN".
4. Anote qual caminho descompacta (o do banco ou o do Python, com qual algoritmo) e o tamanho médio do XML aberto.

## 2. A descrição e o EAN do cadastro × os do XML
Juntando, no script, os itens do `ponte/rascunhos/notas_entrada.sql` (a empresa 65, 09/2026) com os `det` do XML da
mesma nota (pela chave e pelo número do item — se o número não bater, pela ordem), conte:
1. quantos itens o XML e a Domínio têm, nota a nota, e em quantas notas o número de itens é igual;
2. em quantos itens a `descricao` do cadastro é igual ao `xProd` do XML (sem maiúscula, sem acento e sem espaço
   sobrando), em quantos o `xProd` começa pela descrição do cadastro e em quantos é diferente;
3. em quantos o `ean` do cadastro é igual ao `cEAN` do XML, em quantos é igual ao `cEANTrib` e em quantos é diferente;
4. em quantos o `produto_fornecedor` (o de-para) é igual ao `cProd` do XML;
5. em quantos o NCM do cadastro é igual ao `NCM` do XML;
6. em quantos a quantidade e o valor unitário da Domínio são iguais aos do XML (`qCom`, `vUnCom`), com tolerância de
   R$ 0,01.

## 3. O IPI do item
Nas 16 notas da empresa 65 em 09/2026 com IPI na nota e o `vipi_mep` zerado nos itens:
1. Pelo catálogo, as colunas da `efmvepro` que falam de IPI (`--procurar ipi`, só a `efmvepro`), e em quantas dessas 16
   notas a soma de cada coluna nos itens bate com o IPI da nota (até R$ 0,01). Teste também `vlor_mep − vpro_mep`.
2. No XML das mesmas notas (as que tiverem), em quantas a soma do `vIPI` dos itens bate com o IPI da nota.
3. Se uma coluna bater: atualize o `ponte/rascunhos/notas_entrada.sql` pra trazer o IPI do item por ela (com o
   comentário do porquê) e rode o teste de contagem da fila anterior de novo (os mesmos 1.293 itens, 50 notas). Se
   nenhuma bater, não mude o rascunho e anote.

## 4. Registro, DUVIDAS e push
O `docs/FILA-CODE-2026-11-03-XML-DUVIDAS.md` com: o caminho que descompacta, as contagens dos itens 1 a 3 (só números)
e o que o Claude da sessão do Samuel tem de decidir. O registro preenchido, `py -3 tests/ponte.test.py` verde, commit e
`git push origin fila-notas-xml`. O `C:\ponte-dominio\xml_teste.py` fica no PC (não vai pro repositório).

## Registro de progresso
| Data | Item | Situação / observação |
|---|---|---|
| 03/11/2026 | Antes de começar | `main` em 6b824a4; branch `fila-notas-xml`; `py -3 tests/ponte.test.py`: "Tudo certo.". Script em `C:\ponte-dominio\xml_teste.py` (fora do repositório), só contagens na tela. |
| 03/11/2026 | 1 · Descompactar o XML | Feito. O `CONTEUDO_XML` é o XML em texto UTF-8, **sem compactar**: no Python, texto puro abre as 46 (zlib, gzip, deflate e zipfile, 0); no banco, o `DECOMPRESS` dá "Input data is corrupt (-960)" nas 46, com e sem algoritmo. As 46: `nfeProc`, `cStat` 100, a chave igual à da Domínio, `finNFe` 1; 1.263 itens, 1.086 com `cEAN`; média de 38 KB. |
| 03/11/2026 | 2 · Cadastro × XML | Feito. 1.263 itens dos dois lados, pareados pelo número do item nas 46 notas. Descrição igual ao `xProd` em 1.127 (20 cortadas, 116 diferentes); EAN igual ao `cEAN` em 1.024 (38 diferentes, 200 sem EAN no cadastro); de-para igual ao `cProd` em 976 (188 diferentes, 99 sem); NCM igual em 1.241 (22 diferentes); quantidade e valor unitário iguais em todos. |
| 03/11/2026 | 3 · O IPI do item | Feito. Nas 16 notas, nenhuma coluna da `efmvepro` bate (as 6 testadas, 0 de 16); o `vIPI` do XML bate nas 15 que têm XML; os 419 itens com `vIPI` no XML estão zerados na Domínio. Rascunho **não mudou**. |
| 03/11/2026 | 4 · Push | DUVIDAS escrito; `py -3 tests/ponte.test.py` verde; commit e push em `fila-notas-xml`. O script ficou no PC. |
