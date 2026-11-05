# Dúvidas da fila de 03/11/2026 — as notas de entrada das empresas autorizadas, pela ponte

Feita em 04/11/2026. O módulo está em `ponte/notas/` (`xml.py`, `fonte.py`, `pacote.py`, `estado.py`, `sistema.py`,
`rodada.py`, `falso.py`), as consultas em `ponte/consultas/notas_itens.sql`, `notas_xml.sql` e `notas_empresa.sql`, o
teste em `tests/ponte-notas.test.py`. Nada foi mandado: o primeiro envio é da sessão do Samuel, depois da revisão. A
cópia instalada em `C:\ponte-dominio\app` ficou como estava. Nenhuma chave, CNPJ, fornecedor, produto ou valor passou
pela conversa: o `--saida` foi conferido no node por um script que imprime só contagens.

## O que se achou fazendo

1. **O CFOP de entrada da nota é a `codi_nat` da `efentradas`** ("Natureza"): em 09/2026, os 2.605 segmentos das
   NF-e de fornecedor estão entre 1000 e 3999 (o `cfopdet_ent` vem vazio e o `CFOP_SAI_ENT` também). O CFOP do item é
   igual ao do segmento em 10.944 dos 12.336 itens. A nota sem itens na Domínio usa a `codi_nat` quando a nota tem uma
   só (`nota_cfops` = 1); com mais de uma, fica de fora ("CFOP da nota incerto").
2. **`xml` é palavra reservada no SQL Anywhere**: a coluna do XML se chama `conteudo` no `notas_xml.sql`.
3. **A consulta do XML é a lenta**: uns 20 s por mês que tem XML (46 notas na empresa do teste). Medido: sem trazer o
   conteúdo (só o `LENGTH`), 8 s — a ligação com o catálogo; trazendo, mais uns 12 s, ~0,27 s por XML (o ODBC traz o
   conteúdo de um em um). Filtrar o catálogo pela empresa, pela data de emissão, passar a empresa como parâmetro direto
   ou pedir o XML compactado pelo banco (`COMPRESS`, que o Python abre com gzip ou zlib) não mudou o tempo. Fiquei com
   a consulta simples. Na rodada de todo dia (o mês de hoje e os três de antes), dá mais ou menos um minuto por empresa;
   no domingo e na primeira vez (a janela inteira), uns 3 minutos.

## O que decidi sem perguntar (a opção que muda menos)

1. **O número do item da Domínio repetido ou em branco**: a nota que sai da Domínio é renumerada de 1 a N, na ordem dos
   segmentos e do sequencial (o validarPacoteNotas recusa número repetido). Em 09/2026, o escritório inteiro tinha 2
   itens com o `SEQUENCIAL_ITEM_MEP` repetido. A do XML sempre vai com o `nItem`.
2. **O item sem descrição ou sem quantidade**: a nota inteira fica de fora ("item sem descrição ou sem quantidade"; 1 na
   empresa do teste), em vez de tirar só o item (a nota iria com um total que não bate com os itens).
3. **O que o validarPacoteNotas recusaria** (a data, a UF, um valor negativo, o número do item) a ponte confere antes e
   deixa a nota de fora com o campo ("fora do contrato: campo") — assim a nota não vai pra voltar recusada.
4. **O emitente pessoa física** sai pelo `cgce_for` com 11 dígitos, pelo `tins_for` 2 (a inscrição CPF do
   cadastro do fornecedor), pelo `emit/CPF` do XML e, sem o documento na Domínio, pela chave com o 000 + CPF (a mesma
   regra do `pareceCpf` da função).
5. **O `--falso`** usa a Domínio de mentira, mas a lista vem do sistema (o de verdade só pra contar; mandar, só pra
   endereço local). O cenário dele vem do arquivo da `PONTE_NOTAS_FALSO` (os testes) ou do padrão do `falso.py`.
6. **A versão** no `rodada.ponte` do pacote das notas é a do módulo, `0.1.0` (`ponte/notas/__init__.py`).
7. **A lista que vem com empresa fora do formato** (o código, o documento de 11 ou 14, a data de `desde`) deixa a
   empresa de fora, com a contagem no log.

## O teste no PC (a empresa do teste, `--sem-enviar --tudo`)

- A lista: 1 empresa autorizada, 1 pronta; o documento confere com o da Domínio.
- De 01/10/2025 a 04/11/2026: **533 notas lidas, 73 com o XML** (43 de 09/2026 e 30 de 10/2026; os meses de antes não
  têm XML), 464 no pacote. Por mês: 10/2025 53, 11/2025 61, 12/2025 30, 01/2026 47, 02/2026 35, 03/2026 33, 04/2026 39,
  05/2026 51, 06/2026 36, 07/2026 34, 08/2026 29, 09/2026 50, 10/2026 35, 11/2026 0.
- De fora: **68 sem item de compra** — as bonificações (pela `codi_nat` das notas da empresa nos últimos 12 meses: 54
  notas com 1910, 13 com 2910 e 1 com 2911) — e **1 com item sem descrição ou quantidade**. Ficaram na ponte 9 itens que
  não são de compra, de notas que foram.
- Os 3 pacotes do `--saida` pelo `validarPacoteNotas` de verdade: **464 notas aceitas (73 do XML, 391 da Domínio,
  11.710 itens), 0 recusadas, 0 itens fora**.
- O tempo: 175 s de consultas pros 14 meses (a rodada inteira, 183 s).

## Os testes

- `py -3 tests/ponte.test.py`, `py -3 tests/ponte-notas.test.py` e `node tests/ponte-funcao.test.mjs`: "Tudo certo.".
- `python tests/rodar-tudo.py`: 100 de 103. O `tests/harness/comparativo.py` e o `tests/harness/lote-setores.py` caíram
  por tempo esgotado no navegador com os quatro ao mesmo tempo; um por vez, os dois passam (esta fila não mexeu em
  tela). O `tests/ponte-receita.test.py` falha numa conferência só, a "e o arquivo é o mesmo da main": ela trava
  qualquer mudança no `tests/ponte.test.py` num ramo de fila — e esta fila pede pra mudar ele (as consultas novas e o
  sistema de mentira, que agora responde a lista das notas vazia). Na `main`, depois da revisão, ela volta a passar.
  Não mexi no teste da Receita.

## O que o Claude da sessão do Samuel decide

1. **O primeiro envio**: a empresa do teste está pronta; a rodada sem `--sem-enviar` manda os 3 pacotes (464 notas).
   Antes, a cópia instalada em `C:\ponte-dominio\app` precisa ser atualizada (o `instalar.ps1`), e a etapa das notas
   passa a rodar sozinha no fim da tarefa das 7h.
2. **O combustível**: na empresa do teste, 3 notas com CFOP 2653 (compra de combustível por consumidor final) — o
   `CFOPS_DE_COMPRA` da função não tem o 1653/2653/3653; se o destino quiser, entra na lista dos dois lados.
3. **As bonificações** (1910/2910) ficam de fora por regra do contrato; são 13% das notas da empresa do teste.
4. **O tempo do XML** (item 3 de cima): com mais empresas autorizadas, a rodada cresce uns 40 s por empresa por dia.
   Se pesar, o caminho é ler o XML só dos dois meses que a Domínio guarda (hoje a janela de todo dia é de quatro).
5. **A tarefa das 7h** rodou hoje às 9h06 porque o PC estava suspenso (a investigação de 04/11, à parte desta fila):
   com o XML guardado só uns dois meses, uma manhã perdida não perde nota, mas um PC suspenso por semanas perderia o XML
   das notas mais antigas (elas iriam pela Domínio).
