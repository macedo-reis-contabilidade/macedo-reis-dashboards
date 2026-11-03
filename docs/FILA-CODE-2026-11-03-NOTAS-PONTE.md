# Fila do Claude Code — 03/11/2026 · as notas de entrada das empresas autorizadas, pela ponte · branch `fila-notas-ponte`

> **Para o Code do PC do escritório.** **Leia este arquivo inteiro antes de começar**, junto com o que as duas filas das
> notas acharam: `docs/FILA-CODE-2026-11-03-NOTAS-DUVIDAS.md` e `docs/FILA-CODE-2026-11-03-XML-DUVIDAS.md`. **Faça esta
> fila antes da `docs/FILA-CODE-2026-11-03.md`.** Faça os itens **inteiros, sem parar pra perguntar**. Na dúvida, a opção
> que **muda menos**, anotada em `docs/FILA-CODE-2026-11-03-NOTAS-PONTE-DUVIDAS.md`. Ao terminar: o **Registro de
> progresso** preenchido, commit e `git push origin fila-notas-ponte`. **Nunca** push em `main` nem merge pra ela.

## O que é
- Alguns clientes autorizaram o escritório a mandar as notas de compra deles (as NF-e de entrada) a um projeto de fora,
  que compara preços. A autorização fica no sistema (a tabela `compartilhamentos`, que só os sócios veem). Esta fila põe
  na ponte o módulo que lê da Domínio as notas **só dessas empresas**, nota a nota, com os itens e, enquanto a Domínio
  guarda, o XML — e manda pro sistema, que confere tudo de novo e entrega ao destino.
- É a exceção ao "só os totais saem do PC" (`ponte/fonte.py`), e só nestas condições: só as empresas que a função `ponte`
  disser que estão autorizadas, só NF-e de compra (modelo 55, de fornecedor), nunca dado de funcionário.
- **O lado do sistema já está pronto** (na `main`): `supabase/functions/ponte/notas.js` (o `validarPacoteNotas`, que
  confere o pacote campo a campo — o contrato abaixo é o dele) e o `servidor.js` (a lista e o envio ao destino). O destino
  ainda não existe: até ele ser configurado, a lista vem com `pronta: false` e o pacote recebe 503 — é o normal agora.

## Regras (as das filas de 29/10 e de 03/11, que valem todas, mais estas)
- O módulo lê dado de cliente (os itens e o XML) **só em código**. **Nunca** apareça na conversa, no log ou em arquivo do
  repositório uma chave, um CNPJ, um nome de fornecedor, um produto, um valor ou um trecho do XML — nem de uma nota só,
  nem pra conferir. O log diz só contagens.
- Os testes só com dados inventados: os CNPJs com o dígito verificador errado de propósito, como nos outros testes; as
  chaves montadas no teste com o dígito verificador certo (a função confere o da chave); XML montado no teste. Nenhum
  XML real no repositório.
- O `--saida` grava em `C:\ponte-dominio\` (sem pasta = lá), nunca no repositório — e **você não abre o arquivo**: ele
  tem os dados dos clientes.
- **Não abra o `C:\ponte-dominio\config.ini`** (nem Read, `type`, `cat` ou `Get-Content`). **Não rode** o `instalar.ps1`,
  não mexa nas tarefas do Agendador, e **não rode** o `ponte rodar` nem o `ponte notas rodar` sem `--sem-enviar`.
- Commits em pt-BR.

## Antes de começar
```
git fetch origin --prune
git checkout main
git pull
git checkout -b fila-notas-ponte
py -3 tests/ponte.test.py
node tests/ponte-funcao.test.mjs
```
Os dois têm de terminar em "Tudo certo.".

## 1. O contrato (o lado do sistema já confere)

### 1.1 A lista
O POST é o dos outros pacotes (os cabeçalhos e a chave do `ponte/envio.py`):

`{"versao": 1, "tipo": "notas", "pedir": "autorizadas"}` → 200
`{"empresas": [{"codigo": 901, "documento": "11222333000100", "desde": "2025-10-01", "pronta": false}]}`

- `codigo`: o da empresa no Domínio (uma empresa pode vir com dois códigos — o mesmo documento);
- `documento`: o CNPJ do cadastro do sistema. A ponte confere que é o `cgce_emp` da `geempre` daquele código; se não for,
  **não lê a empresa** (conta "documento diferente" no log, sem o valor);
- `desde`: a nota mais antiga que pode ir, pela data de entrada;
- `pronta`: o destino dela já está configurado. A rodada lê só as prontas; o `--sem-enviar` lê todas (é pra contar).

Lista vazia: nada a fazer, nem abre a conexão com a Domínio.

### 1.2 O pacote: uma empresa por pacote, até 200 notas e até 4 MB (o JSON inteiro)
```json
{
  "versao": 1, "tipo": "notas",
  "rodada": { "id": "<uuid da rodada>", "inicio": "2026-11-04T07:05:00-03:00", "maquina": "<o nome do PC>", "ponte": "<VERSAO>" },
  "empresa": { "codigo": 901, "documento": "11222333000100" },
  "notas": [{
    "chave": "<44 caracteres>", "modelo": "55", "numero": "1234", "serie": "1",
    "emissao": "2026-09-15", "entrada": "2026-09-16",
    "emitente": { "cnpj": "<o da chave>", "nome": "FORNECEDOR EXEMPLO LTDA", "uf": "SC" },
    "destinatario": { "cnpj": "11222333000100" },
    "totais": { "produtos": 1000.00, "desconto": 0, "frete": 50.00, "ipi": 52.50, "icms_st": 0, "total": 1102.50 },
    "origem": "dominio",
    "itens": [{
      "n": 1, "codigo": "ABC-10", "codigo_produto": "123", "ean": "7890000000000", "descricao": "PARAFUSO SEXTAVADO 1/4 X 2",
      "ncm": "73181500", "cfop": "1102", "unidade": "CX", "quantidade": 10, "valor_unitario": 100.00,
      "valor_total": 1000.00, "desconto": 0, "ipi": null, "icms_st": 0
    }],
    "xml": null
  }]
}
```
Campo a campo (o que estiver fora disso numa nota faz a nota voltar em `recusadas`; o que for do pacote, 422):
- `chave`: 44 caracteres, com o dígito verificador; o modelo da chave (posições 21 e 22) é 55; `numero` e `serie` são os
  da chave (posições 26 a 34 e 23 a 25), sem os zeros da frente.
- `emissao`: a data do documento (`ddoc_ent`; com o XML, a data do `dhEmi`, no fuso da nota). `entrada`: a data de
  entrada na Domínio (`dent_ent`), sempre.
- `emitente.cnpj`: **sempre o da chave** (posições 7 a 20). `nome` e `uf`: com o XML, do `emit`; sem, da `effornece`.
- `destinatario.cnpj`: o documento da empresa. A nota cujo `dest` no XML é outro não vai (conte "destinatário diferente").
- `totais`: com o XML, do `ICMSTot` (`vProd`, `vDesc`, `vFrete`, `vIPI`, `vST`, `vNF`); sem, as somas dos segmentos da
  Domínio (as do rascunho). Em reais, com centavos; o `total` é obrigatório.
- `origem`: `"xml"` quando o XML existe, abre e é desta nota (o `Id` do `infNFe` com a chave e o `cStat` 100 ou 150 no
  `protNFe`) — aí `xml` leva o conteúdo; senão `"dominio"`, com `xml` nulo.
- `itens` com `origem: "xml"`: um por `det`, do XML — `n` = `nItem`, `codigo` = `cProd`, `ean` = `cEAN` (se não for um
  GTIN, o `cEANTrib`; senão nulo), `descricao` = `xProd`, `ncm` = `NCM`, `unidade` = `uCom`, `quantidade` = `qCom`,
  `valor_unitario` = `vUnCom`, `valor_total` = `vProd`, `desconto` = `vDesc` (0 sem ele), `ipi` = o `vIPI` do item (0 sem
  ele), `icms_st` = o `vICMSST` do item (0 sem ele). O `codigo_produto` e o `cfop` vêm da Domínio, do item de mesmo número
  (`SEQUENCIAL_ITEM_MEP` = `nItem`, como a fila do XML pareou); sem o item na Domínio, nulos.
- `itens` com `origem: "dominio"`: os do rascunho `notas_entrada.sql`, com o `ipi` de cada item **nulo** quando a soma
  dos `vipi_mep` da nota não bate (até R$ 0,01) com o IPI dela — nunca o 0 que a Domínio não disse; quando bate, o valor.
- `cfop`: o da entrada, como a nota foi lançada (1, 2 ou 3 na frente). O do fornecedor fica no XML.
- `ean`: só dígitos, 8, 12, 13 ou 14; "SEM GTIN" e o resto vão nulos.
- `xml`: o `CONTEUDO_XML` como veio, em base64 (é o texto UTF-8 do `nfeProc`, sem compactar, como a fila do XML viu).
  Se ele não começar por `<`, tente zlib e gzip antes de desistir; não abriu = a nota vai pela Domínio e conta "XML
  ilegível".
- Fica de fora, e conta por motivo: o emitente pessoa física (o `cgce_for` com 11 dígitos, ou o `emit/CPF` no XML); o
  destinatário diferente; a nota sem itens na Domínio e sem o XML; a nota cujo XML tem `finNFe` diferente de 1
  (complementar, ajuste, devolução). O XML sem o `cStat` 100 ou 150 não serve: a nota vai pela Domínio (conte "XML sem a
  autorização").

### 1.3 As respostas
- **200** `{"ok": true, "notas": N, "mandadas": N, "recusadas": [{"chave", "campo", "erro"}]}`: as notas do pacote ficam
  como mandadas — as recusadas também, e só vão de novo se mudarem. O log: quantas recusadas e os campos e erros, nunca
  a chave.
- **403** (a empresa não está autorizada) e **422** (o pacote fora do contrato): não repete; o log diz o erro.
- **503** "O destino das notas ainda não foi configurado no sistema.": para as notas nesta rodada, sem tentar de novo, e
  nada fica como mandado.
- **502** (o destino não recebeu agora), os outros 5xx, tempo esgotado e rede fora: as tentativas do `ponte/envio.py`;
  não foi, nada fica como mandado e vai na próxima rodada.
- **401** e o 503 da chave da ponte: como no `ponte/envio.py`.

## 2. O que ler, e quando
- **A janela**: na primeira vez de uma empresa (sem ela no estado) e aos domingos, de `desde` até hoje; nos outros dias,
  do dia 1º do mês de três meses atrás até hoje — a nota que entra atrasada na Domínio e o XML, que ela guarda uns dois
  meses —, nunca antes de `desde`. Mês a mês, pela data de entrada.
- **O estado**, em `C:\ponte-dominio\notas\estado.json` (fora do repositório): por código, o documento e, por chave, a
  data de entrada, a impressão digital da nota (o SHA-256 do JSON dela, com o XML) e quando foi mandada. Manda só a nota
  nova ou que mudou. A empresa que sai da lista some do estado. O estado não guarda nada da nota além disso.
- **As consultas**: os dois rascunhos de `ponte/rascunhos/` viram `ponte/consultas/notas_itens.sql` e
  `ponte/consultas/notas_xml.sql`, com o comentário do começo atualizado (o XML é texto; o emitente CPF sai na ponte). A
  do XML liga o catálogo pela chave filtrando antes pela empresa (a fila do XML mediu 14 s em 46 notas). E a do
  documento da empresa (o `cgce_emp` da `geempre` pelo código), que pode ser pequena, à parte. Meça o tempo de um mês da
  empresa do teste e anote.

## 3. O módulo
- `ponte/notas/`, como a `ponte/receita/`: `xml.py` (o leitor do `nfeProc`, com a biblioteca padrão), `pacote.py` (as
  notas pelo contrato, divididas em pacotes de até 200 notas e 4 MB), `estado.py`, `rodada.py` (a lista, a janela, as
  consultas, os pacotes, o envio, o estado e o log) e `falso.py` (uma Domínio de mentira com notas e XMLs inventados,
  pro `--falso` e pros testes).
- O envio reusa o `ponte/envio.py` (os cabeçalhos, as tentativas, sem seguir redirecionamento), **sem os pendentes**: o
  que não foi vai na próxima rodada pelo estado.
- O comando: `py -3 -m ponte notas rodar [--sem-enviar] [--saida arquivo.json] [--falso] [--tudo] [--empresa CODIGO]`
  (`--tudo`: a janela inteira, de `desde`; `--empresa`: só esta, se estiver na lista; `--sem-enviar`: pede a lista, lê e
  conta, e não manda nem grava o estado).
- No fim do `py -3 -m ponte rodar` (a tarefa das 7h), a etapa das notas roda sozinha, no mesmo modo (`--sem-enviar`,
  `--falso`). Um erro nela vai pro log e não muda o que a rodada dos totais fez nem o código de saída dela.
- O `conferir` ganha uma linha: quantas empresas autorizadas o sistema mostra e quantas prontas (só os números).
- O log de cada empresa, pelo código (nunca o nome): as notas lidas, com XML, novas ou mudadas, mandadas, recusadas e as
  de fora por motivo, e o tempo das consultas.

## 4. Os testes
`tests/ponte-notas.test.py` (o `rodar-tudo.py` pega), com a Domínio de mentira e um sistema de mentira, como o
`tests/ponte-receita.test.py`, e **todo pacote passando pelo `validarPacoteNotas` de verdade, no node, sem nenhuma
recusa**:
- só as empresas da lista, só as prontas (no `--sem-enviar`, todas), e só com o documento igual ao da `geempre`;
- os itens do XML (o `cEANTrib` quando o `cEAN` é "SEM GTIN", o IPI e o ICMS-ST do item), com o `codigo_produto` e o
  `cfop` da Domínio;
- sem o XML: `origem` "dominio", o IPI do item nulo quando não bate com o da nota, e o valor quando bate;
- a nota sem itens na Domínio vai com o XML, e sem ele, não;
- de fora: o emitente CPF, o destinatário diferente, o `finNFe` 4; o XML ilegível e o sem a autorização vão pela Domínio;
- o XML compactado com zlib abre;
- a divisão em pacotes (200 notas, 4 MB);
- o estado: a segunda rodada não manda de novo; a nota que mudou vai; a recusada não vai de novo; a empresa que sai da
  lista some do estado;
- as respostas: o 503 do destino para sem marcar; o 502 não marca e vai na próxima; o 403 não repete;
- a janela: na primeira vez e no domingo, de `desde`; nos outros dias, três meses;
- nada de chave, CNPJ, nome de fornecedor, produto ou valor no log (o teste lê o log inteiro).

E o `tests/ponte.test.py` confere as consultas novas como confere as outras (o comentário do começo, as colunas e os
parâmetros).

## 5. No PC, com a empresa do teste
- `py -3 -m ponte notas rodar --sem-enviar --tudo` e anote no registro só os números do log: as notas de cada mês,
  quantas com o XML, quantas de fora por motivo, as recusadas que o `validarPacoteNotas` daria (rode o pacote do
  `--saida` por ele no node, num script que imprime só quantas e, de cada uma, o campo e o erro — **nunca a chave**, e
  sem abrir o arquivo na conversa) e o tempo.
- Não mande nada (o destino ainda não existe).

## 6. LEIA-ME, DUVIDAS e push
- O `ponte/LEIA-ME.md` ganha a seção das notas: o que sai, de quem, quando, onde fica o estado, os comandos e as
  respostas.
- O `docs/FILA-CODE-2026-11-03-NOTAS-PONTE-DUVIDAS.md` com o que ficou em dúvida e o que o Claude da sessão do Samuel
  decide.
- O registro preenchido, `py -3 tests/ponte.test.py`, `py -3 tests/ponte-notas.test.py` e `node tests/ponte-funcao.test.mjs`
  verdes, commit e `git push origin fila-notas-ponte`. A cópia instalada em `C:\ponte-dominio\app` fica como está: ela é
  atualizada depois, quando o destino existir.

## Registro de progresso
| Data | Item | Situação / observação |
|---|---|---|
| | 1 · O contrato | |
| | 2 · O que ler, e quando | |
| | 3 · O módulo | |
| | 4 · Os testes | |
| | 5 · No PC, com a empresa do teste | |
| | 6 · LEIA-ME, DUVIDAS e push | |
