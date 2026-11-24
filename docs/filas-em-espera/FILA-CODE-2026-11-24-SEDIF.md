# Fila do Claude Code — 24/11/2026 · a Conferência SEDIF/DeSTDA sem o ZIP: o ICMS de cada item das notas de entrada de fora do RS, na Domínio e no XML · branch `fila-24-11-sedif`

> **Para o Code do PC do escritório.** **Leia este arquivo inteiro antes de começar**, junto com o
> `docs/FILA-CODE-2026-11-03-NOTAS-DUVIDAS.md` e o `docs/FILA-CODE-2026-11-03-XML-DUVIDAS.md` (os itens das notas de
> entrada na `efmvepro`, o cadastro de produtos, o fornecedor e o XML guardado na Domínio) e com o
> `ponte/consultas/notas_itens.sql`, o `ponte/consultas/notas_xml.sql` e o `ponte/notas/` (a leitura das notas que já
> roda todo dia pras notas de compra das empresas autorizadas).
> Faça os itens **inteiros, sem parar pra perguntar**: nenhum item precisa do Samuel na frente do PC. Na dúvida, a
> opção que **muda menos**, anotada em `docs/FILA-CODE-2026-11-24-SEDIF-DUVIDAS.md`. Ao terminar: o **Registro de
> progresso** (fim deste arquivo) preenchido, commit e `git push origin fila-24-11-sedif`. **Nunca** push em `main` nem
> merge pra ela. **Esta fila não muda a ponte nem instala nada**: só descobre, conta e escreve um rascunho.

## O que é
- A **Conferência SEDIF/DeSTDA** (Fiscal, desde 27/10) calcula, nas notas de entrada do mês das empresas da obrigação,
  o diferencial de alíquota (os itens de fora do RS com o ICMS destacado a 4%: a base × (17% − 4%)) e o ICMS-ST da
  ração pet (o NCM 2309, vinda de SC, BA, GO, RN, RO ou SP: a base × 17% − o ICMS destacado). Hoje a Thalia exporta da
  Domínio o ZIP com os XMLs de entrada do mês e solta na tela.
- O passo seguinte, que o Samuel escolheu e liberou: **as notas chegarem pela ponte, sem o ZIP**. A leitura dos itens
  já existe (é a das notas de compra), mas ela não traz o ICMS de cada item (a base, a alíquota e o valor), que é o que
  a conferência usa, nem as entradas que não são compra.
- Esta fila descobre **onde a Domínio guarda o ICMS de cada item**, **se ele bate com o XML**, **até quando o XML fica
  guardado** e **quanto é por mês**, e escreve o rascunho da consulta. O contrato do envio, a função do sistema e o
  que entra no banco **não mudam aqui**: são do Claude da sessão do Samuel, depois de revisar.
- **As notas são dado do cliente** (o fornecedor, o produto, o valor). Aqui elas **não saem do PC**: na conversa, no
  registro e no DUVIDAS, só contagens do escritório inteiro.

## Regras (as das filas de 03/11, que valem todas)
- **O conteúdo das notas e do XML nunca aparece**: nem na conversa, nem no log, nem em arquivo do repositório. O que é
  nota a nota ou item a item fica num script e num arquivo **fora do repositório**: o script em
  `C:\ponte-dominio\sedif_teste.py` e o que ele gravar em `C:\ponte-dominio\sedif_*.txt` (ou `.csv`), **que você não
  abre aqui**. Na tela, o script mostra **só contagens** ("812 itens com a base igual"). Nunca imprima um trecho, uma
  tag com valor, uma chave, um CNPJ, um fornecedor, um produto ou um valor — nem de uma nota só, nem pra conferir.
- O script abre a conexão **pela própria ponte** (`from ponte import config, dominio` e a função de conexão que o
  `dominio sql` usa), sem ler o `config.ini` na conversa, e lê o XML com o leitor da ponte (`ponte/notas/xml.py`) ou
  com a mesma regra dele.
- **Não abra o `C:\ponte-dominio\config.ini`** (nem Read, `type`, `cat` ou `Get-Content`).
- **Repositório público**: nada de host, IP, porta, Engine, nome do banco, usuário, senha, nome de cliente, CNPJ, código
  de empresa ou valor de uma empresa. Das tabelas do Domínio, só as que o rascunho usa (o nome, as colunas usadas e a
  descrição do catálogo) — **nunca o catálogo inteiro**.
- Código no repositório: **só** `ponte/rascunhos/sedif_notas.sql` e os dois arquivos desta fila. **Não mexa** em
  `ponte/consultas/`, `ponte/*.py`, `ponte/notas/`, `supabase/`, nas telas nem nos testes.
- **Não rode** o `instalar.ps1`, o `ponte rodar`, o `ponte notas rodar` (ele manda as notas pro destino autorizado) nem
  a ponte da Receita. Não mexa nas tarefas do Agendador nem nas opções de energia do PC.
- **Não rode nada entre 6h50 e 7h20, nem entre 8h20 e 9h00**: são as duas tarefas do dia.
- **Consulta pesada**: até 60 segundos cada. Passou, anote o tempo e a parte cara, e proponha no DUVIDAS o caminho mais
  leve.
- Commits em pt-BR.

## Antes de começar
1. Esta fila vem **depois** da `docs/FILA-CODE-2026-11-24-FISCAL.md`: se o ramo dela (`fila-24-11-fiscal`) ainda não
   existe em origin, faça ela antes.
2. Precisa da conexão com o Domínio: `py -3 -m ponte conferir` uma vez, da pasta `C:\ponte-dominio\app`, como na fila
   do DP (abriu, siga; não abriu pela rede, pare sem criar o ramo, e o plantão tenta de novo na hora seguinte; por
   usuário ou senha, não tente de novo, crie o ramo, anote e faça o push). No registro, sem a linha do IP e sem a
   mensagem do driver (só os códigos).
3. Então:
```
git fetch origin --prune
git checkout main
git pull
git checkout -b fila-24-11-sedif
py -3 tests/ponte.test.py
py -3 tests/ponte-notas.test.py
```
Os dois têm de terminar em "Tudo certo.". Se não terminarem, **pare aqui**: registro e push.

O recorte de todos os itens: as **notas de entrada de 10/2026** (pela data de entrada, como o `notas_itens.sql`), de
**fornecedor de fora do RS** (o estado do fornecedor), modelo 55, emitidas por terceiro, fora a cancelada, a denegada
e a inutilizada, **de todas as empresas ativas** (a lista da obrigação fica no sistema: aqui vale o escritório
inteiro). Onde um item pedir o regime, a leitura do `RFED_PAR` do `docs/FILA-CODE-2026-11-11-COMPARATIVO-DUVIDAS.md`
(2 e 4, Simples).

## 1. Onde a Domínio guarda o ICMS de cada item
1. Na `bethadba.efmvepro`, as colunas da **base**, da **alíquota** e do **valor do ICMS** do item (o catálogo dela:
   `--procurar "base de calculo"`, `--procurar aliquota`, `--procurar icms`). A base e o valor do ICMS-ST do item a fila
   de 03/11 já achou (`bicmsst_mep`, `valor_subtri_mep`).
2. Se o item não tiver, o **segmento** tem: a linha 1 (ICMS) da `bethadba.efimpent` (`bcal_*`, `aliq_*`, `vlor_*`).
   Veja se cada segmento tem uma alíquota só (em quantas notas de fora do RS os itens a 4% e os de outra alíquota caem
   no mesmo segmento, se der pra saber).
3. **Contagens** no recorte: quantas notas, itens e empresas; quantos itens com a base, a alíquota e o valor do ICMS
   preenchidos; quantos itens a 4%, a 7%, a 12% e de outra alíquota; quantos com o ICMS-ST preenchido; e os mesmos
   números só das empresas do Simples.

## 2. A Domínio e o XML, item a item
No script, nas notas do recorte que têm o XML guardado, junte os itens da Domínio com os `det` do XML da mesma nota
(pela chave e pelo número do item, como o `montar_nota` de `ponte/notas/pacote.py` faz) e conte:
1. em quantos itens a **base**, a **alíquota** e o **valor do ICMS** são iguais (até R$ 0,01; a alíquota exata) e em
   quantos diferem, com o tipo da diferença (a Domínio sem o valor, a base reduzida, o arredondamento);
2. quantos itens estão **a 4% no XML** (o `pICMS`) e quantos desses a Domínio também tem a 4%;
3. quantos itens do XML vêm pelo **Simples do fornecedor** (o grupo `ICMSSN`, sem o ICMS destacado) e o que a Domínio
   tem neles;
4. em quantos o **ICMS-ST** (`vBCST` e `vICMSST`) bate;
5. em quantos o **NCM** e a **descrição** do cadastro de produtos são os do XML (o `NCM` e o `xProd`).

## 3. Até quando o XML fica guardado
1. Das notas de fora do RS de **09/2026** e de **10/2026**, quantas têm o XML guardado hoje
   (`EFATENDIMENTO_NFE_CATALOGO` com o `EFATENDIMENTO_NFE_XML_V2`, fora o `XML_EXCLUIDO`), por mês.
2. O mês mais antigo com XML guardado, e em quantas empresas.
3. Se der pra saber pelo catálogo, quanto tempo depois da emissão o XML é apagado (a contagem por mês de emissão das
   notas com o `XML_EXCLUIDO` marcado). A DeSTDA do mês vence no dia 20 do mês seguinte: a leitura tem de pegar o XML
   antes de ele sumir.

## 4. A ração pet
No recorte, os itens com o NCM começando por 2309 (pelo cadastro de produtos e pelo XML), de fornecedor de SC, BA, GO,
RN, RO ou SP: quantos itens, notas e empresas; quantos com o NCM 2309.10.00 pelo cadastro e pelo XML; em quantos o NCM
do cadastro é outro que o do XML.

## 5. Quanto é por mês
Em 09/2026 e em 10/2026: quantas notas e itens de fora do RS, no escritório inteiro e só nas empresas do Simples; e o
tamanho de um mês no jeito das notas da ponte (os bytes do JSON de `montar_nota` por item, vezes os itens): pra saber
quantos pacotes de até 4 MB um mês daria.

## 6. O rascunho
`ponte/rascunhos/sedif_notas.sql`: as notas de entrada de **uma** empresa num período, de fornecedor de fora do RS,
uma linha por item, **no jeito do `ponte/consultas/notas_itens.sql`** (os mesmos três parâmetros: o código da empresa,
o primeiro e o último dia, pela data de entrada), com:
- **as colunas do ICMS do item** que o item 1 achou (a base, a alíquota e o valor; e a base e o valor do ICMS-ST),
  ou, se só o segmento tiver, as do segmento;
- **sem o corte do CFOP de compra** (a conferência quer todas as entradas de fora do RS: a de uso e consumo e a de
  ativo também);
- o comentário curto de sempre no começo (as tabelas, o que entra e o que fica de fora).
Teste com uma empresa do Simples que tenha notas de fora do RS em 10/2026 (a de mais notas), com a saída num arquivo
de `C:\ponte-dominio\` e, na tela, só quantas linhas e o tempo. O código da empresa não vai pro repositório.

## 7. Revisão, registro, DUVIDAS e push
1. **Uma revisão independente** do rascunho, do script e do DUVIDAS (o SQL, a privacidade e as contas), como nas filas
   de 11/11: cada achado conferido por outro revisor antes de mudar.
2. O `docs/FILA-CODE-2026-11-24-SEDIF-DUVIDAS.md` com: as tabelas e as colunas usadas (com a descrição do catálogo),
   onde fica o ICMS do item, os números de cada item (só do escritório inteiro e contagens), o tempo, e o que o Claude
   da sessão do Samuel tem de decidir (o ICMS pelo item ou pelo segmento; pelo XML ou pela Domínio quando os dois
   existem; o que fazer com a nota sem XML; o tamanho do envio).
3. O script e o que ele gravou ficam só em `C:\ponte-dominio\`, nunca no repositório.
4. O registro preenchido, `py -3 tests/ponte.test.py` verde, commit e `git push origin fila-24-11-sedif`.

## Registro de progresso
| Data | Item | Situação / observação |
|---|---|---|
| | Antes | |
| | 1 | |
| | 2 | |
| | 3 | |
| | 4 | |
| | 5 | |
| | 6 | |
| | 7 | |
