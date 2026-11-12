# Fila de 11/11/2026 · o padrão dos lançamentos digitados — o que se achou no Domínio

Escrito pelo Code do PC do escritório em 12/11/2026, na branch `fila-11-11-fechamento`. Os rascunhos estão em
`ponte/rascunhos/fechamento_*.sql`, que a ponte **não lê**: nada mudou na ponte, no sistema nem no Domínio. Os números
são **do escritório inteiro** ou contagens; nenhum valor, nome, documento ou código de empresa. O resultado de cada
empresa ficou só em `C:\ponte-dominio\fechamento\` (fora do repositório): `tamanho_AAAA-MM.txt`, `pares_*`,
`repet_*`, `valores_*`, `casa_*`, `bancomes_2025-*`, `extrato_2025.txt` e `modelo_grupos.txt` (os títulos dos grupos do
modelo). As contas do escritório (medianas, faixas, classes, casamentos)
foram feitas no PC, lendo esses arquivos, e só o resultado delas vem pra cá.

**O achado que muda a leitura: a origem 1 não é só o que o contador digita.** Das 15.654 linhas da origem 1 de 2025,
**8.666 (55,4%) entraram pelo importador de lançamentos** — a `ctlancto.origem_reg` = 2, "Imp. Layout" na descrição
do catálogo —, em 19 empresas (17 delas começaram em 10/2025), e 8.665 delas têm uma conta de banco de um lado (o
desenho de um extrato do banco posto pelo importador; o arquivo importado não foi conferido). **Digitado à mão mesmo
(`origem_reg` = 0): 6.988 linhas.** O `origens.sql` da ponte conta as duas juntas no `lanc_normais`. Abaixo, cada item
tem a origem 1 inteira (o recorte da fila) e, onde muda a conclusão, só o digitado à mão.

Uma revisão independente (quatro lentes — a fila, o SQL, as afirmações sem medida e os números refeitos dos arquivos do
PC —, e a privacidade; cada achado conferido por outro revisor) confirmou 19 achados, tratados aqui: a régua da
repetição nas empresas de 1 ou 2 meses (fora da classificação agora), as 5 empresas com o plano de outra estrutura
(contadas e separadas), a soma da conclusão (16%, não 17%), a contagem do casamento pessoa a pessoa, o empate do PIS,
da Cofins e do ISS, e afirmações que não tinham sido medidas (os honorários, o extrato, os juros).

## 0. O recorte e o que vale pra todos

### As empresas
As ativas no Domínio (`geempre.stat_emp` A, M, C ou B, como no `empresas.sql`), com a contabilidade aberta lá
(`bethadba.ctparmto`) e algum lançamento em 2025: **75 empresas** (74 com algum lançamento da origem 1). Em 13 delas
o ano não tem os 12 meses com lançamento: 3 com 1 mês, 3 com 2, 1 com 4, 1 com 8, 2 com 9, 1 com 10 e 2 com 11
(uma destas sem lançamento da origem 1).

### As tabelas (com a descrição do catálogo)
- `bethadba.ctlancto` ("Lancamentos Contabeis"): `data_lan` ("Data"), `orig_lan` ("Origem"), **`origem_reg`
  ("Origem do registro 0 - Sistema, 1 - Imp. Tabelas, 2 - Imp. Layout, 3- Imp. Tabelas Concorrentes")**, `codi_lote`
  ("Lancamento em lote"), `cdeb_lan` e `ccre_lan` ("Debito"/"Credito", o reduzido do plano da `CODI_EMP_PLANO`),
  `vlor_lan` ("Valor"), `codi_his` ("Codigo Historico"), `chis_lan` ("Historico", só no filtro), `codi_pad`
  ("Lancamento padrao"), `nume_lan` ("Numero").
- `bethadba.ctcontas` ("Contas Contabeis - Cadastro"): `clas_cta` ("Classificacao"), `tipo_cta`
  ("Tipo (A=Analitico/S=Sintetico)"); a `nome_cta` ("Descricao") só no filtro (`LIKE`), e, da empresa 998, o título
  dos grupos (a exceção da fila).
- `bethadba.ctlanctolote` ("Lancamento em lote"): `tipo` ("Tipo (D=Um debito para varios creditos/C=Um credito para
  varios debitos/X=Um debito para um credito/V=Varios debitos para varios creditos)"), `codi_pad`, `GUID_LOTE`
  ("Identificador do lote importado via API").
- As da folha e da escrita fiscal, no item 4.

### O grupo da conta
A classificação guardada é só de dígitos, e o grupo de 4º nível do plano modelo é **os 5 primeiros** (o caixa
`11101`, os bancos `11102`), como as filas de 04/11 e 05/11 acharam. A `ctparmto.masc_par` diz `9.9.99.999.999` em 73
das 75, `9.9.9.99.9999` em 1 e `9.9.9.99.999.999` em 1, mas em todos os planos os grupos guardados têm 5 dígitos e as
analíticas lançadas em 2025, de 8 a 11: o corte nos 5 dígitos agrupa as 75. Em 10 planos alguma analítica lançada está
pendurada num grupo de 5 dígitos que o plano não tem (791 pernas, 2,7%), e 818 linhas digitadas (5,2%), em 30
empresas, tocam um grupo que não existe no plano modelo: nas tabelas, "(fora do plano modelo)". Nenhuma linha tem conta
fora do cadastro. Tempo: 29,6 s (a conferência das pernas) e 50,0 s (os 10 planos).

**Cinco empresas têm o plano de outra estrutura, e nelas o grupo pelos 5 dígitos não é o do modelo:**
- 4 têm lançamento digitado em grupos terminados em `00` que o modelo não tem (`21400`, `31100`, `43000`, `46000`,
  `34100`, `13500`…): 529 linhas digitadas nesses grupos; 3 delas não têm escrita fiscal nem folha integrada em 2025 (a
  contabilidade inteira é digitada);
- 1 tem o plano invertido da fila de 05/11 (a escrita fiscal credita o `31` e nunca o `41`).

As 5 somam 937 linhas digitadas (6,0%). A natureza dos grupos (`bethadba.ctnatureza_conta`, o caminho da fila de 05/11)
diz se o grupo é credor ou devedor, não qual grupo do modelo ele seria; por isso **elas ficaram dentro, sem
remapear** (a opção que muda menos), e os números abaixo dizem onde elas pesam: no perfil sem banco, 2 das 31 empresas
são delas, com 846 das 2.406 linhas (35,2%).

### A partida múltipla
A `ctlancto` guarda **uma linha por perna, com o outro lado zerado** (`cdeb_lan` ou `ccre_lan` = 0), e as pernas do
mesmo lançamento com o mesmo `codi_lote`. Todo lançamento tem lote, até o simples. Na origem 1 de 2025 (24,5 s):

| tipo do lote | lotes | linhas | como é |
|---|---:|---:|---|
| X (um débito pra um crédito) | 14.149 | 14.149 | uma linha com os dois lados |
| C (um crédito pra vários débitos) | 350 | 1.077 | o crédito numa perna, os débitos nas outras |
| D (um débito pra vários créditos) | 21 | 60 | o contrário |
| V (vários pra vários) | 61 | 368 | sem par por perna |

São 14.581 lançamentos e 15.654 linhas, **1.505 pernas (9,6%) com um lado zerado**. Contei cada perna como uma linha
(como a ponte) e, onde o par não está na linha, a perna vai pelo grupo dela e o outro lado é **"partida múltipla"**
(`PM` nos rascunhos). O valor de um mês (`valor_digitado` no item 1) é o debitado: na partida múltipla o lote entra uma
vez só. Nos lotes C e D, o lado de uma perna só tem uma conta, então o par de cada perna do outro lado existe — não foi
usado (a fila manda marcar "partida múltipla"), mas fica de caminho pro método.

### O tempo das consultas
O ano inteiro numa consulta só passou de 3 minutos (o `fechamento_tamanho.sql` com 2025 inteiro foi cortado em 200 s):
tudo rodou **mês a mês**, e os meses com mais de 500 linhas de saída, em lotes de empresas, somados no PC. Cada
rodada: o tamanho, de 3 a 54 s por mês; os pares, de 15 a 48 s por lote (o mês é calculado inteiro em cada lote); a
repetição, de 4 a 8 s; os valores e o casamento pessoa a pessoa, de 4 a 8 s. Tudo fora do horário das tarefas, de
22h30 de 11/11 a 0h30 de 12/11.

## 1. O tamanho do que se digita

### `fechamento_tamanho.sql`
Por empresa e mês: `digitados` (as linhas da origem 1), `importados` (delas, as do importador, `origem_reg` = 2),
`lotes`, `pernas_pm`, `valor_digitado`, `lanc_mes` (as linhas do mês de qualquer origem, fora o zeramento: o mês com
contabilidade), `banco_mes` e `digitados_banco` (com conta do `11102`) e `folha_mes` (a origem 13). Uma linha por
empresa e mês com algum lançamento.

### Os números (2025)
- **75 empresas, 815 meses-empresa com contabilidade, 715 com algum lançamento da origem 1**; 15.654 linhas no ano
  (14.581 lançamentos), **3,6% das 437.122 linhas do ano** (fora o zeramento). Delas, 8.666 importadas (19 empresas,
  47 meses-empresa) e **6.988 digitadas à mão**.
- Por mês-empresa:

| | meses-empresa | mediana | 3º quartil | percentil 90 |
|---|---:|---:|---:|---:|
| origem 1, os meses com alguma | 715 | 5 | 12 | 36 |
| origem 1, todos os meses com contabilidade (o zero conta) | 815 | 5 | 10 | 31 |
| só à mão, os meses com alguma | 710 | 5 | 10 | 21 |
| só à mão, todos os meses com contabilidade | 815 | 5 | 9 | 20 |

  (Os quartis pelo posto mais próximo; o maior mês-empresa passa de 500 linhas.)
- As empresas pela mediana mensal dela (os meses com contabilidade dela; o mês sem a origem 1 conta como zero):

| faixa | empresas | com banco | sem banco | com folha integrada | sem folha | — só à mão: empresas | com banco | sem banco |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| nenhum | 7 | 5 | 2 | 6 | 1 | 7 | 5 | 2 |
| de 1 a 10 | 54 | 27 | 27 | 48 | 6 | 55 | 28 | 27 |
| de 11 a 30 | 9 | 7 | 2 | 6 | 3 | 9 | 7 | 2 |
| de 31 a 100 | 4 | 3 | 1 | 3 | 1 | 4 | 3 | 1 |
| mais de 100 | 1 | 1 | 0 | 1 | 0 | 0 | 0 | 0 |
| **total** | **75** | **43** | **32** | **64** | **11** | **75** | **43** | **32** |

  "Com banco" = algum lançamento, de qualquer origem, em conta do `11102` em 2025; "com folha" = algum da origem 13.
  Os dois: 40 empresas com banco e folha, 3 com banco sem folha, 24 com folha sem banco, 8 sem os dois.
- Por mês, no escritório inteiro (à mão / importados): 01: 886 / 216 · 02: 570 / 209 · 03: 662 / 211 · 04: 697 /
  162 · 05: 584 / 173 · 06: 701 / 254 · 07: 432 / 243 · 08: 457 / 229 · 09: 508 / 237 · **10: 521 / 3.112 · 11: 423
  / 1.720 · 12: 547 / 1.900**. De janeiro a setembro, uma empresa só importava; em outubro, 18; em novembro, 11; em
  dezembro, 9. **O digitado à mão fica entre 420 e 890 por mês o ano todo; o salto do fim do ano é o importador.**

### O ritmo de 2026 (janeiro a outubro, o mesmo recorte de cada mês)
Origem 1 por mês (à mão / importados), e em quantas das empresas com contabilidade no mês: 01: 456 / 23 (29 de 65) ·
02: 346 / 7 (24 de 69) · 03: 396 / 0 (24 de 71) · 04: 262 / 0 (21 de 70) · 05: 225 / 0 (16 de 71) · 06: 343 / 0 (16
de 73) · 07: 395 / 0 (15 de 75) · 08: 357 / 0 (11 de 74) · 09: 151 / 0 (11 de 76) · 10: 1 / 0. Total de 2.962. O
número de empresas com lançamento digitado cai mês a mês (o porquê não foi medido aqui: a fila de 04/11 tem até onde
cada contabilidade está feita). Das 19 que importaram em 2025, 2 importaram em 2026, 6 têm o extrato (origem 39) em
2026 e 18 o tinham em 2025 (2,2 s).

## 2. Em que contas: os pares de grupos

### `fechamento_pares.sql`
Por empresa, origem (o digitado, a 1; a escrita fiscal, 4 a 9, 11 e 21 a 29; a folha, 13) e par de grupos (o débito, o
crédito; `PM` na partida múltipla): `lancamentos`, `importados`, `meses` e `valor`. As empresas contadas uma vez no
PC; os meses-empresa, somados.

### Os 40 pares com mais lançamentos (origem 1, 2025)
A coluna "à mão" é a parte digitada (o resto veio do importador). O título de cada grupo é o do plano modelo do
escritório (a empresa 998), como o Domínio guarda.

**Todas as empresas** (15.654 lançamentos, 74 empresas, 236 pares)

| # | débito | crédito | lançamentos | à mão | empresas | meses-empresa | parte | acumulada |
|---|---|---|---|---|---|---|---|---|
| 1 | `11102` BANCOS CONTA MOVIMENTO | `11101` CAIXA | 4.923 | 352 | 29 | 96 | 31,4% | 31,4% |
| 2 | `11101` CAIXA | `11102` BANCOS CONTA MOVIMENTO | 2.372 | 265 | 26 | 99 | 15,2% | 46,6% |
| 3 | `21301` FORNECEDORES | `11102` BANCOS CONTA MOVIMENTO | 691 | 71 | 9 | 30 | 4,4% | 51,0% |
| 4 | `32204` DESPESAS ADMINISTRATIVAS | `11102` BANCOS CONTA MOVIMENTO | 507 | 77 | 19 | 63 | 3,2% | 54,3% |
| 5 | `32204` DESPESAS ADMINISTRATIVAS | `21501` OBRIGAÇÕES COM O PESSOAL | 503 | 503 | 48 | 481 | 3,2% | 57,5% |
| 6 | `21502` OBRIGAÇÕES PREVIDÊNCIARIAS | `11101` CAIXA | 458 | 458 | 50 | 297 | 2,9% | 60,4% |
| 7 | `11102` BANCOS CONTA MOVIMENTO | `11201` DUPLICATAS A RECEBER | 395 | 327 | 4 | 15 | 2,5% | 62,9% |
| 8 | `21401` IMPOSTOS E CONTRIBUIÇÕES A RECOLHER | `11101` CAIXA | 390 | 390 | 45 | 303 | 2,5% | 65,4% |
| 9 | `21101` EMPRESTIMOS | `11102` BANCOS CONTA MOVIMENTO | 360 | 147 | 13 | 60 | 2,3% | 67,7% |
| 10 | partida múltipla | `11101` CAIXA | 292 | 292 | 38 | 159 | 1,9% | 69,6% |
| 11 | `32205` DESPESAS FINANCEIRAS | partida múltipla | 279 | 279 | 37 | 144 | 1,8% | 71,4% |
| 12 | `21501` OBRIGAÇÕES COM O PESSOAL | `11101` CAIXA | 271 | 270 | 45 | 257 | 1,7% | 73,1% |
| 13 | `32205` DESPESAS FINANCEIRAS | `11102` BANCOS CONTA MOVIMENTO | 231 | 75 | 17 | 51 | 1,5% | 74,6% |
| 14 | `32204` DESPESAS ADMINISTRATIVAS | `11101` CAIXA | 201 | 201 | 19 | 83 | 1,3% | 75,8% |
| 15 | `21301` FORNECEDORES | `11101` CAIXA | 182 | 182 | 22 | 66 | 1,2% | 77,0% |
| 16 | `11101` CAIXA | `31100` (fora do plano modelo) | 146 | 146 | 2 | 13 | 0,9% | 77,9% |
| 17 | `21401` IMPOSTOS E CONTRIBUIÇÕES A RECOLHER | partida múltipla | 133 | 133 | 31 | 90 | 0,8% | 78,8% |
| 18 | `32205` DESPESAS FINANCEIRAS | `21101` EMPRESTIMOS | 131 | 131 | 7 | 39 | 0,8% | 79,6% |
| 19 | `11101` CAIXA | `11101` CAIXA | 113 | 113 | 2 | 18 | 0,7% | 80,4% |
| 20 | `21502` OBRIGAÇÕES PREVIDÊNCIARIAS | partida múltipla | 99 | 99 | 34 | 82 | 0,6% | 81,0% |
| 21 | `11102` BANCOS CONTA MOVIMENTO | `11102` BANCOS CONTA MOVIMENTO | 98 | 3 | 2 | 14 | 0,6% | 81,6% |
| 22 | `11102` BANCOS CONTA MOVIMENTO | `11103` APLICAÇÕES FINANCEIRAS LIQUIDEZ IMEDIATA | 90 | 3 | 6 | 12 | 0,6% | 82,2% |
| 23 | `21501` OBRIGAÇÕES COM O PESSOAL | `11102` BANCOS CONTA MOVIMENTO | 89 | 33 | 14 | 59 | 0,6% | 82,8% |
| 24 | `43000` (fora do plano modelo) | `11101` CAIXA | 83 | 83 | 2 | 24 | 0,5% | 83,3% |
| 25 | partida múltipla | `11501` MERCADORIAS, PRODUTOS E INSUMOS | 83 | 83 | 1 | 12 | 0,5% | 83,8% |
| 26 | `21601` ADIANTAMENTOS A CLIENTES | partida múltipla | 81 | 81 | 10 | 59 | 0,5% | 84,3% |
| 27 | `11103` APLICAÇÕES FINANCEIRAS LIQUIDEZ IMEDIATA | `11102` BANCOS CONTA MOVIMENTO | 78 | 3 | 8 | 17 | 0,5% | 84,8% |
| 28 | `41204` (fora do plano modelo) | `11501` MERCADORIAS, PRODUTOS E INSUMOS | 77 | 77 | 15 | 74 | 0,5% | 85,3% |
| 29 | `11103` APLICAÇÕES FINANCEIRAS LIQUIDEZ IMEDIATA | `41301` JUROS E DESCONTOS | 70 | 70 | 7 | 22 | 0,4% | 85,8% |
| 30 | `21502` OBRIGAÇÕES PREVIDÊNCIARIAS | `11102` BANCOS CONTA MOVIMENTO | 66 | 25 | 13 | 49 | 0,4% | 86,2% |
| 31 | `41203` (-) IMPOSTOS SOBRE VENDAS E SERVIÇOS | `21401` IMPOSTOS E CONTRIBUIÇÕES A RECOLHER | 64 | 64 | 5 | 16 | 0,4% | 86,6% |
| 32 | partida múltipla | `11102` BANCOS CONTA MOVIMENTO | 64 | 31 | 11 | 40 | 0,4% | 87,0% |
| 33 | `32204` DESPESAS ADMINISTRATIVAS | `13209` (-) DEPRECIAÇÕES, AMORT. E EXAUS. ACUMUL | 61 | 61 | 4 | 37 | 0,4% | 87,4% |
| 34 | `11201` DUPLICATAS A RECEBER | `11101` CAIXA | 58 | 58 | 4 | 4 | 0,4% | 87,8% |
| 35 | `21401` IMPOSTOS E CONTRIBUIÇÕES A RECOLHER | `11102` BANCOS CONTA MOVIMENTO | 58 | 30 | 16 | 47 | 0,4% | 88,1% |
| 36 | `11101` CAIXA | partida múltipla | 57 | 57 | 6 | 17 | 0,4% | 88,5% |
| 37 | `11102` BANCOS CONTA MOVIMENTO | `21101` EMPRESTIMOS | 56 | 53 | 8 | 45 | 0,4% | 88,9% |
| 38 | `32205` DESPESAS FINANCEIRAS | `11103` APLICAÇÕES FINANCEIRAS LIQUIDEZ IMEDIATA | 56 | 56 | 2 | 5 | 0,4% | 89,2% |
| 39 | `32205` DESPESAS FINANCEIRAS | `21111` (fora do plano modelo) | 52 | 52 | 1 | 9 | 0,3% | 89,5% |
| 40 | `21401` IMPOSTOS E CONTRIBUIÇÕES A RECOLHER | `11305` ADIANTAMENTOS A FORNECEDORES | 50 | 50 | 1 | 10 | 0,3% | 89,9% |

Os 10 primeiros cobrem 69,6%; os 20, 81,0%; os 40, 89,9%.

**Só as empresas sem lançamento em conta de banco em 2025** (2.406 lançamentos, 31 empresas, 82 pares)

| # | débito | crédito | lançamentos | empresas | meses-empresa | parte | acumulada |
|---|---|---|---|---|---|---|---|
| 1 | `21502` OBRIGAÇÕES PREVIDÊNCIARIAS | `11101` CAIXA | 318 | 21 | 192 | 13,2% | 13,2% |
| 2 | `21401` IMPOSTOS E CONTRIBUIÇÕES A RECOLHER | `11101` CAIXA | 256 | 22 | 203 | 10,6% | 23,9% |
| 3 | `32204` DESPESAS ADMINISTRATIVAS | `21501` OBRIGAÇÕES COM O PESSOAL | 212 | 20 | 199 | 8,8% | 32,7% |
| 4 | `11101` CAIXA | `31100` (fora do plano modelo) | 146 | 2 | 13 | 6,1% | 38,7% |
| 5 | partida múltipla | `11101` CAIXA | 140 | 20 | 86 | 5,8% | 44,6% |
| 6 | `21501` OBRIGAÇÕES COM O PESSOAL | `11101` CAIXA | 139 | 18 | 133 | 5,8% | 50,3% |
| 7 | `11101` CAIXA | `11101` CAIXA | 113 | 2 | 18 | 4,7% | 55,0% |
| 8 | `32205` DESPESAS FINANCEIRAS | partida múltipla | 101 | 17 | 62 | 4,2% | 59,2% |
| 9 | `43000` (fora do plano modelo) | `11101` CAIXA | 83 | 2 | 24 | 3,4% | 62,7% |
| 10 | partida múltipla | `11501` MERCADORIAS, PRODUTOS E INSUMOS | 83 | 1 | 12 | 3,4% | 66,1% |
| 11 | `32204` DESPESAS ADMINISTRATIVAS | `11101` CAIXA | 77 | 7 | 41 | 3,2% | 69,3% |
| 12 | `21502` OBRIGAÇÕES PREVIDÊNCIARIAS | partida múltipla | 54 | 16 | 43 | 2,2% | 71,6% |
| 13 | `11101` CAIXA | partida múltipla | 53 | 2 | 13 | 2,2% | 73,8% |
| 14 | `21601` ADIANTAMENTOS A CLIENTES | partida múltipla | 47 | 5 | 30 | 2,0% | 75,7% |
| 15 | partida múltipla | `31100` (fora do plano modelo) | 45 | 1 | 12 | 1,9% | 77,6% |
| 16 | `21301` FORNECEDORES | `11101` CAIXA | 38 | 9 | 27 | 1,6% | 79,2% |
| 17 | `43000` (fora do plano modelo) | `21400` (fora do plano modelo) | 38 | 2 | 24 | 1,6% | 80,8% |
| 18 | `21400` (fora do plano modelo) | partida múltipla | 37 | 1 | 12 | 1,5% | 82,3% |
| 19 | `21400` (fora do plano modelo) | `11101` CAIXA | 36 | 2 | 24 | 1,5% | 83,8% |
| 20 | `21401` IMPOSTOS E CONTRIBUIÇÕES A RECOLHER | partida múltipla | 36 | 11 | 29 | 1,5% | 85,3% |
| 21 | `46000` (fora do plano modelo) | `11101` CAIXA | 28 | 1 | 12 | 1,2% | 86,5% |
| 22 | `11101` CAIXA | `11501` MERCADORIAS, PRODUTOS E INSUMOS | 27 | 1 | 12 | 1,1% | 87,6% |
| 23 | `11501` MERCADORIAS, PRODUTOS E INSUMOS | partida múltipla | 26 | 2 | 13 | 1,1% | 88,7% |
| 24 | `11501` MERCADORIAS, PRODUTOS E INSUMOS | `21400` (fora do plano modelo) | 24 | 1 | 12 | 1,0% | 89,7% |
| 25 | `43000` (fora do plano modelo) | partida múltipla | 24 | 1 | 12 | 1,0% | 90,6% |
| 26 | `41204` (fora do plano modelo) | `11501` MERCADORIAS, PRODUTOS E INSUMOS | 23 | 6 | 22 | 1,0% | 91,6% |
| 27 | `11101` CAIXA | `34100` (fora do plano modelo) | 20 | 1 | 11 | 0,8% | 92,4% |
| 28 | `31201` MÃO-DE-OBRA INDIRETA | `21501` OBRIGAÇÕES COM O PESSOAL | 13 | 1 | 8 | 0,5% | 93,0% |
| 29 | `11502` COMODATOS | `21400` (fora do plano modelo) | 12 | 1 | 12 | 0,5% | 93,5% |
| 30 | `31204` UTILIDADES E SERVIÇOS | `21501` OBRIGAÇÕES COM O PESSOAL | 12 | 1 | 12 | 0,5% | 94,0% |
| 31 | partida múltipla | `11502` COMODATOS | 12 | 1 | 12 | 0,5% | 94,5% |
| 32 | `31206` DEPRECIAÇÕES, AMORTIZAÇÕES E EXAUSTÕES | `13209` (-) DEPRECIAÇÕES, AMORT. E EXAUS. ACUMUL | 10 | 1 | 8 | 0,4% | 94,9% |
| 33 | `11306` ADIANTAMENTO A EMPREGADOS | `11101` CAIXA | 9 | 3 | 9 | 0,4% | 95,3% |
| 34 | `11101` CAIXA | `11201` DUPLICATAS A RECEBER | 7 | 2 | 2 | 0,3% | 95,6% |
| 35 | `43000` (fora do plano modelo) | `13500` (fora do plano modelo) | 7 | 1 | 7 | 0,3% | 95,8% |
| 36 | `21501` OBRIGAÇÕES COM O PESSOAL | `11306` ADIANTAMENTO A EMPREGADOS | 6 | 6 | 6 | 0,2% | 96,1% |
| 37 | `21501` OBRIGAÇÕES COM O PESSOAL | `21502` OBRIGAÇÕES PREVIDÊNCIARIAS | 5 | 3 | 5 | 0,2% | 96,3% |
| 38 | `21601` ADIANTAMENTOS A CLIENTES | `11101` CAIXA | 5 | 4 | 4 | 0,2% | 96,5% |
| 39 | partida múltipla | `21401` IMPOSTOS E CONTRIBUIÇÕES A RECOLHER | 5 | 1 | 1 | 0,2% | 96,7% |
| 40 | partida múltipla | `21601` ADIANTAMENTOS A CLIENTES | 5 | 3 | 4 | 0,2% | 96,9% |

Os 10 primeiros cobrem 66,1%; os 20, 85,3%; os 40, 96,9%.

**Só as empresas com banco** (13.248 lançamentos, 43 empresas, 203 pares)

| # | débito | crédito | lançamentos | à mão | empresas | meses-empresa | parte | acumulada |
|---|---|---|---|---|---|---|---|---|
| 1 | `11102` BANCOS CONTA MOVIMENTO | `11101` CAIXA | 4.923 | 352 | 29 | 96 | 37,2% | 37,2% |
| 2 | `11101` CAIXA | `11102` BANCOS CONTA MOVIMENTO | 2.372 | 265 | 26 | 99 | 17,9% | 55,1% |
| 3 | `21301` FORNECEDORES | `11102` BANCOS CONTA MOVIMENTO | 691 | 71 | 9 | 30 | 5,2% | 60,3% |
| 4 | `32204` DESPESAS ADMINISTRATIVAS | `11102` BANCOS CONTA MOVIMENTO | 507 | 77 | 19 | 63 | 3,8% | 64,1% |
| 5 | `11102` BANCOS CONTA MOVIMENTO | `11201` DUPLICATAS A RECEBER | 395 | 327 | 4 | 15 | 3,0% | 67,1% |
| 6 | `21101` EMPRESTIMOS | `11102` BANCOS CONTA MOVIMENTO | 360 | 147 | 13 | 60 | 2,7% | 69,8% |
| 7 | `32204` DESPESAS ADMINISTRATIVAS | `21501` OBRIGAÇÕES COM O PESSOAL | 291 | 291 | 28 | 282 | 2,2% | 72,0% |
| 8 | `32205` DESPESAS FINANCEIRAS | `11102` BANCOS CONTA MOVIMENTO | 231 | 75 | 17 | 51 | 1,7% | 73,7% |
| 9 | `32205` DESPESAS FINANCEIRAS | partida múltipla | 178 | 178 | 20 | 82 | 1,3% | 75,1% |
| 10 | partida múltipla | `11101` CAIXA | 152 | 152 | 18 | 73 | 1,1% | 76,2% |
| 11 | `21301` FORNECEDORES | `11101` CAIXA | 144 | 144 | 13 | 39 | 1,1% | 77,3% |
| 12 | `21502` OBRIGAÇÕES PREVIDÊNCIARIAS | `11101` CAIXA | 140 | 140 | 29 | 105 | 1,1% | 78,4% |
| 13 | `21401` IMPOSTOS E CONTRIBUIÇÕES A RECOLHER | `11101` CAIXA | 134 | 134 | 23 | 100 | 1,0% | 79,4% |
| 14 | `21501` OBRIGAÇÕES COM O PESSOAL | `11101` CAIXA | 132 | 131 | 27 | 124 | 1,0% | 80,4% |
| 15 | `32205` DESPESAS FINANCEIRAS | `21101` EMPRESTIMOS | 131 | 131 | 7 | 39 | 1,0% | 81,4% |
| 16 | `32204` DESPESAS ADMINISTRATIVAS | `11101` CAIXA | 124 | 124 | 12 | 42 | 0,9% | 82,3% |
| 17 | `11102` BANCOS CONTA MOVIMENTO | `11102` BANCOS CONTA MOVIMENTO | 98 | 3 | 2 | 14 | 0,7% | 83,1% |
| 18 | `21401` IMPOSTOS E CONTRIBUIÇÕES A RECOLHER | partida múltipla | 97 | 97 | 20 | 61 | 0,7% | 83,8% |
| 19 | `11102` BANCOS CONTA MOVIMENTO | `11103` APLICAÇÕES FINANCEIRAS LIQUIDEZ IMEDIATA | 90 | 3 | 6 | 12 | 0,7% | 84,5% |
| 20 | `21501` OBRIGAÇÕES COM O PESSOAL | `11102` BANCOS CONTA MOVIMENTO | 89 | 33 | 14 | 59 | 0,7% | 85,1% |
| 21 | `11103` APLICAÇÕES FINANCEIRAS LIQUIDEZ IMEDIATA | `11102` BANCOS CONTA MOVIMENTO | 78 | 3 | 8 | 17 | 0,6% | 85,7% |
| 22 | `11103` APLICAÇÕES FINANCEIRAS LIQUIDEZ IMEDIATA | `41301` JUROS E DESCONTOS | 70 | 70 | 7 | 22 | 0,5% | 86,3% |
| 23 | `21502` OBRIGAÇÕES PREVIDÊNCIARIAS | `11102` BANCOS CONTA MOVIMENTO | 66 | 25 | 13 | 49 | 0,5% | 86,8% |
| 24 | partida múltipla | `11102` BANCOS CONTA MOVIMENTO | 64 | 31 | 11 | 40 | 0,5% | 87,2% |
| 25 | `41203` (-) IMPOSTOS SOBRE VENDAS E SERVIÇOS | `21401` IMPOSTOS E CONTRIBUIÇÕES A RECOLHER | 63 | 63 | 4 | 15 | 0,5% | 87,7% |
| 26 | `32204` DESPESAS ADMINISTRATIVAS | `13209` (-) DEPRECIAÇÕES, AMORT. E EXAUS. ACUMUL | 61 | 61 | 4 | 37 | 0,5% | 88,2% |
| 27 | `21401` IMPOSTOS E CONTRIBUIÇÕES A RECOLHER | `11102` BANCOS CONTA MOVIMENTO | 58 | 30 | 16 | 47 | 0,4% | 88,6% |
| 28 | `11201` DUPLICATAS A RECEBER | `11101` CAIXA | 57 | 57 | 3 | 3 | 0,4% | 89,0% |
| 29 | `11102` BANCOS CONTA MOVIMENTO | `21101` EMPRESTIMOS | 56 | 53 | 8 | 45 | 0,4% | 89,5% |
| 30 | `32205` DESPESAS FINANCEIRAS | `11103` APLICAÇÕES FINANCEIRAS LIQUIDEZ IMEDIATA | 56 | 56 | 2 | 5 | 0,4% | 89,9% |
| 31 | `41204` (fora do plano modelo) | `11501` MERCADORIAS, PRODUTOS E INSUMOS | 54 | 54 | 9 | 52 | 0,4% | 90,3% |
| 32 | `32205` DESPESAS FINANCEIRAS | `21111` (fora do plano modelo) | 52 | 52 | 1 | 9 | 0,4% | 90,7% |
| 33 | `21401` IMPOSTOS E CONTRIBUIÇÕES A RECOLHER | `11305` ADIANTAMENTOS A FORNECEDORES | 50 | 50 | 1 | 10 | 0,4% | 91,1% |
| 34 | `11101` CAIXA | `21111` (fora do plano modelo) | 47 | 47 | 1 | 9 | 0,4% | 91,4% |
| 35 | `21502` OBRIGAÇÕES PREVIDÊNCIARIAS | partida múltipla | 45 | 45 | 18 | 39 | 0,3% | 91,8% |
| 36 | `11304` SÓCIOS, ADMINISTRADORES E PESSOAS LIGADA | `11102` BANCOS CONTA MOVIMENTO | 42 | 2 | 2 | 4 | 0,3% | 92,1% |
| 37 | `32205` DESPESAS FINANCEIRAS | `11201` DUPLICATAS A RECEBER | 41 | 41 | 2 | 2 | 0,3% | 92,4% |
| 38 | `21603` ENERGIA ELÉTRICA. AGÚA E TELEFONE A PAGA | partida múltipla | 39 | 39 | 1 | 11 | 0,3% | 92,7% |
| 39 | `11401` APLICAÇÕES FINANCEIRAS REND. PREFIXADOS | `41301` JUROS E DESCONTOS | 36 | 36 | 3 | 19 | 0,3% | 92,9% |
| 40 | `31206` DEPRECIAÇÕES, AMORTIZAÇÕES E EXAUSTÕES | `13209` (-) DEPRECIAÇÕES, AMORT. E EXAUS. ACUMUL | 36 | 36 | 2 | 24 | 0,3% | 93,2% |

Os 10 primeiros cobrem 76,2%; os 20, 85,1%; os 40, 93,2%.

**Só o digitado à mão (6.988 linhas, 229 pares)**: os 10 primeiros cobrem 47,8%; os 20, 64,9%; os 40, 81,0%. Os 10:
`32204`×`21501` 503 (48 empresas) · `21502`×`11101` 458 (50) · `21401`×`11101` 390 (45) · `11102`×`11101` 352 (19) ·
`11102`×`11201` 327 (2) · partida múltipla×`11101` 292 (38) · `32205`×partida múltipla 279 (37) · `21501`×`11101` 270
(45) · `11101`×`11102` 265 (21) · `32204`×`11101` 201 (19). Nas com banco, só à mão (4.582 linhas): 46,5% / 66,1% /
84,2%. Nas sem banco, nada foi importado (todo importado tem uma conta de banco): a tabela de cima é a delas.

**As sem banco, sem as 2 empresas de plano de outra estrutura** (a seção 0: elas têm 846 das 2.406 linhas do perfil,
35,2%, e 500 delas nos grupos terminados em `00`): 1.560 linhas, 29 empresas, 61 pares; **os 10 primeiros cobrem
87,1%; os 20, 95,1%; os 40, 98,7%**. Os 10: `21502`×`11101` 318 (21 empresas) · `21401`×`11101` 256 (22) ·
`32204`×`21501` 212 (20) · `21501`×`11101` 139 (18) · partida múltipla×`11101` 116 (19) · `32205`×partida múltipla
101 (17) · `32204`×`11101` 77 (7) · `21502`×partida múltipla 54 (16) · `21601`×partida múltipla 47 (5) ·
`21301`×`11101` 38 (9).

**O que o importador pôs (8.666 linhas, 19 empresas, 27 pares)**: `11102`×`11101` 4.571 (17 empresas) · `11101`×`11102`
2.107 (18) · `21301`×`11102` 620 (9) · `32204`×`11102` 430 (15) · `21101`×`11102` 213 (7) · `32205`×`11102` 156 (14)
· os 10 primeiros, 97,2%. 8.665 das 8.666 têm o banco de um lado, e 6.678 delas o caixa do outro.

### O que é cada par, pela descrição da conta (só no filtro)
A descrição das analíticas não sai; contei, dentro da consulta, quantas linhas têm uma palavra na descrição da conta de
débito e na de crédito (52,7 s). Nos pares maiores:
- `32204`×`21501` (503 linhas, 48 empresas): **os honorários contábeis, pelo nome das contas**. 493 linhas com
  HONORÁRIOS na descrição dos dois lados (nenhuma com DIRET, que seria o pró-labore; 10 com CONTAB na de débito); pela
  classificação, 449 linhas (44 empresas) são do item 015 do `32204` contra o item 004 do `21501`, e no
  plano modelo (pelo filtro) o 015 do `32204` é a analítica com HONORÁRIOS e CONTÁBEIS no nome e o 004 do `21501` a com
  HONORÁRIOS (o 001 é a de ordenados e o 002 a de pró-labore). Ao que tudo indica, o honorário do próprio escritório
  (não conferido). O pagamento: `21501` item 004 × caixa, 204 linhas em 34 empresas (pela classificação; pelo nome, 220
  em 36, logo abaixo).
- `21502`×`11101`: o INSS (247 linhas, 40 empresas) e o FGTS (193, 27) pagos pelo caixa.
- `21401`×`11101`: o Simples (SIMPLES ou DAS na descrição: 249 linhas, 37 empresas) e outros impostos (140, 27) pelo
  caixa.
- `21501`×`11101` à mão: os honorários (220 linhas, 36 empresas), salários (28, 16) e pró-labore (23, 11) pagos pelo
  caixa. A folha integrada já paga pelo caixa o item 001 (578 linhas, 38 empresas) e o 002 (497, 51).
- `32205`×partida múltipla: os juros (279 linhas, 37 empresas), num lote com outras pernas: dos 278 lotes, 139 pagam
  junto um imposto (`21401`) ou a previdência (`21502`), e 139 outra conta; o crédito é o caixa em 227 (1,9 s).
  `32205`×`11102`: as tarifas bancárias (205, 16).
- `32204`×`11102`: energia, água, telefone (160, 13) e outras despesas (345, 16).

### O caixa e o banco
| | linhas | com o caixa (`11101`) de um lado | com o banco (`11102`) de um lado | os dois | partida múltipla |
|---|---:|---:|---:|---:|---:|
| todas, origem 1 | 15.654 | 9.929 (63,4%) | 10.261 (65,5%) | 7.295 | 1.505 (9,6%) |
| todas, só à mão | 6.988 | 3.250 (46,5%) | 1.596 (22,8%) | — | 1.472 (21,1%) |
| sem banco (31 empresas) | 2.406 | 1.516 (63,0%) | 0 | 0 | 683 (28,4%) |
| com banco (43), origem 1 | 13.248 | 8.413 (63,5%) | 10.261 (77,5%) | 7.295 | 822 (6,2%) |
| com banco, só à mão | 4.582 | 1.734 (37,8%) | 1.596 (34,8%) | — | 789 (17,2%) |

### O que a integração já lança (2025)

**Escrita fiscal (origens 4 a 9, 11 e 21 a 29)** (343.112 lançamentos, 68 empresas, 76 pares)

| # | débito | crédito | lançamentos | empresas | meses-empresa | parte | acumulada |
|---|---|---|---|---|---|---|---|
| 1 | `11101` CAIXA | `41101` RECEITA BRUTAS DE VENDAS E MERCADORIAS | 238.963 | 37 | 396 | 69,6% | 69,6% |
| 2 | `11201` DUPLICATAS A RECEBER | `41101` RECEITA BRUTAS DE VENDAS E MERCADORIAS | 54.314 | 8 | 67 | 15,8% | 85,5% |
| 3 | `11501` MERCADORIAS, PRODUTOS E INSUMOS | `21301` FORNECEDORES | 19.847 | 39 | 374 | 5,8% | 91,3% |
| 4 | `32101` DEPESAS COM PESSOAL | `11101` CAIXA | 10.715 | 4 | 37 | 3,1% | 94,4% |
| 5 | `21301` FORNECEDORES | `11101` CAIXA | 5.066 | 23 | 163 | 1,5% | 95,9% |
| 6 | `11101` CAIXA | `41102` RECEITA DE PRESTAÇÃO DE SERVIÇOS | 2.508 | 22 | 201 | 0,7% | 96,6% |
| 7 | `11501` MERCADORIAS, PRODUTOS E INSUMOS | `11501` MERCADORIAS, PRODUTOS E INSUMOS | 1.555 | 8 | 53 | 0,5% | 97,0% |
| 8 | `11201` DUPLICATAS A RECEBER | `41102` RECEITA DE PRESTAÇÃO DE SERVIÇOS | 1.275 | 6 | 61 | 0,4% | 97,4% |
| 9 | `32204` DESPESAS ADMINISTRATIVAS | `21301` FORNECEDORES | 1.181 | 14 | 109 | 0,3% | 97,8% |
| 10 | `11501` MERCADORIAS, PRODUTOS E INSUMOS | `21101` EMPRESTIMOS | 1.118 | 4 | 39 | 0,3% | 98,1% |
| 11 | `32204` DESPESAS ADMINISTRATIVAS | `11101` CAIXA | 1.107 | 22 | 153 | 0,3% | 98,4% |
| 12 | `21101` EMPRESTIMOS | `11101` CAIXA | 1.071 | 2 | 10 | 0,3% | 98,7% |
| 13 | `11501` MERCADORIAS, PRODUTOS E INSUMOS | `31103` (-) DEDUÇÕES DOS CUSTOS | 816 | 15 | 129 | 0,2% | 99,0% |
| 14 | `11200` (fora do plano modelo) | `41101` RECEITA BRUTAS DE VENDAS E MERCADORIAS | 384 | 1 | 12 | 0,1% | 99,1% |
| 15 | `41203` (-) IMPOSTOS SOBRE VENDAS E SERVIÇOS | `21401` IMPOSTOS E CONTRIBUIÇÕES A RECOLHER | 308 | 2 | 18 | 0,1% | 99,2% |

Os 10 primeiros cobrem 98,1%; os 20, 99,5%; os 40, 99,9%.

**Folha (origem 13)** (5.816 lançamentos, 64 empresas, 39 pares)

| # | débito | crédito | lançamentos | empresas | meses-empresa | parte | acumulada |
|---|---|---|---|---|---|---|---|
| 1 | `32201` DESPESAS COM PESSOAL | `21501` OBRIGAÇÕES COM O PESSOAL | 1.389 | 61 | 627 | 23,9% | 23,9% |
| 2 | `21501` OBRIGAÇÕES COM O PESSOAL | `21502` OBRIGAÇÕES PREVIDÊNCIARIAS | 1.268 | 64 | 675 | 21,8% | 45,7% |
| 3 | `21501` OBRIGAÇÕES COM O PESSOAL | `11101` CAIXA | 1.088 | 57 | 554 | 18,7% | 64,4% |
| 4 | `32201` DESPESAS COM PESSOAL | `21502` OBRIGAÇÕES PREVIDÊNCIARIAS | 782 | 42 | 417 | 13,4% | 77,8% |
| 5 | `21501` OBRIGAÇÕES COM O PESSOAL | `21401` IMPOSTOS E CONTRIBUIÇÕES A RECOLHER | 363 | 37 | 247 | 6,2% | 84,1% |
| 6 | `21501` OBRIGAÇÕES COM O PESSOAL | `32201` DESPESAS COM PESSOAL | 208 | 26 | 153 | 3,6% | 87,7% |
| 7 | `31301` MÃO-DE-OBRA DIRETA | `21501` OBRIGAÇÕES COM O PESSOAL | 111 | 6 | 64 | 1,9% | 89,6% |
| 8 | `21501` OBRIGAÇÕES COM O PESSOAL | `11306` ADIANTAMENTO A EMPREGADOS | 105 | 15 | 85 | 1,8% | 91,4% |
| 9 | `11308` TRIBUTOS A RECUPERAR/COMPENSAR | `21501` OBRIGAÇÕES COM O PESSOAL | 70 | 11 | 64 | 1,2% | 92,6% |
| 10 | `21502` OBRIGAÇÕES PREVIDÊNCIARIAS | `11308` TRIBUTOS A RECUPERAR/COMPENSAR | 64 | 10 | 61 | 1,1% | 93,7% |
| 11 | `11306` ADIANTAMENTO A EMPREGADOS | `11101` CAIXA | 62 | 28 | 61 | 1,1% | 94,7% |
| 12 | `31201` MÃO-DE-OBRA INDIRETA | `21502` OBRIGAÇÕES PREVIDÊNCIARIAS | 50 | 1 | 12 | 0,9% | 95,6% |
| 13 | `21501` OBRIGAÇÕES COM O PESSOAL | `31301` MÃO-DE-OBRA DIRETA | 44 | 5 | 33 | 0,8% | 96,4% |
| 14 | `31301` MÃO-DE-OBRA DIRETA | `21502` OBRIGAÇÕES PREVIDÊNCIARIAS | 43 | 3 | 36 | 0,7% | 97,1% |
| 15 | `31201` MÃO-DE-OBRA INDIRETA | `21501` OBRIGAÇÕES COM O PESSOAL | 24 | 1 | 12 | 0,4% | 97,5% |

Os 10 primeiros cobrem 93,7%; os 20, 99,0%; os 40, 100,0%.

**A venda entra contra o caixa**: na escrita fiscal, `11101`×`41101` é 69,6% do que ela lança, em 37 empresas;
contra duplicatas a receber (a prazo), 15,8%, em 8. A compra entra contra fornecedores (`11501`×`21301`, 39 empresas)
e o pagamento do fornecedor também é integrado em parte (`21301`×`11101`, 23 empresas). **A folha entra a pagar e já
paga**: `32201`×`21501` (61 empresas) e `21501`×`11101`, o pagamento pelo caixa, em 57. Isso combina com o que mais se
movimenta à mão e pelo importador, o caixa contra o banco (a venda entra no caixa, e o banco é lançado contra ele), mas
o caminho do dinheiro não foi medido.

## 3. A repetição dentro de cada empresa

### `fechamento_repeticao.sql`
Por empresa e par de contas analíticas (o reduzido; a conta 0 é a partida múltipla): `meses`, `lancamentos`,
`importados`, `meses_um` (meses com um lançamento só), `valor`, `menor` e `maior`. Rodou mês a mês: os meses do par são
os arquivos em que ele aparece. **A régua**: fixo em 10 meses ou mais, frequente de 4 a 9, eventual até 3; na empresa
que não tem os 12 meses, proporcional aos meses com lançamento dela (fixo a partir de 10/12 deles, arredondado pra
cima; frequente a partir de 4/12). **As 6 empresas com menos de 3 meses** (3 com 1 mês, 3 com 2) **ficam fora da
classificação**: com 1 mês, a régua dá 1 e todo par vira fixo (18 pares de uma linha, todos "valor fixo"), e com 2 ela
não separa nada. Elas têm 50 linhas da origem 1 (0,3%); as contagens abaixo são das 68 que sobram (6 delas com 4 a 11
meses, pela régua proporcional).

### Os números (2025, as 68 empresas)
| | pares-empresa | linhas | parte | — só à mão: pares-empresa | linhas | parte |
|---|---:|---:|---:|---:|---:|---:|
| fixo | 187 | 4.976 | 31,9% | 179 | 2.837 | 40,9% |
| frequente | 276 | 3.800 | 24,4% | 232 | 2.107 | 30,4% |
| eventual | 1.393 | 6.828 | 43,8% | 1.226 | 1.986 | 28,7% |
| **total** | **1.856** | **15.604** | | **1.637** | **6.930** | |

(Na leitura só à mão ficam de fora 8 pares-mês em que o mesmo par tem linha importada e à mão no mesmo mês.)

As empresas pela parte do que digitam que está em pares fixos:

| | 80% ou mais | de 50% a 80% | menos de 50% |
|---|---:|---:|---:|
| todas (68) | 6 | 15 | 47 |
| sem banco (28) | 5 | 11 | 12 |
| com banco (40) | 1 | 4 | 35 |
| só à mão, todas | 6 | 18 | 44 |
| só à mão, sem banco | 5 | 11 | 12 |
| só à mão, com banco | 1 | 7 | 32 |

Pares fixos por empresa: **mediana 2, percentil 90 6** (14 empresas sem nenhum); nas sem banco, 3 e 5 (2 sem nenhum);
nas com banco, 1 e 6 (12 sem nenhum). **Pelo par de grupos** (a mesma régua, o par de grupos dentro de cada empresa, em
vez do par de analíticas), a parte fixa sobe: 37,8% da origem 1 e **46,9% do digitado à mão** (frequente 34,3%,
eventual 18,8%, das 6.938 linhas à mão das 68): parte do "eventual" de analítica é o mesmo par de grupos se repetindo
em outra analítica. O caixa contra o banco: 84 pares-empresa em 33 empresas, 7.295 linhas, só 8 deles fixos (10
frequentes, 66 eventuais); mediana de 5 linhas no mês do par. Só à mão: 57 pares-empresa, 617 linhas.

### Os 20 pares de grupos mais comuns entre os fixos (origem 1, as 68 empresas)
Pela quantidade de pares-empresa fixos; no empate, pelas linhas. A "parte" é das 4.976 linhas em pares fixos.

| # | débito | crédito | pares-empresa fixos | lançamentos | à mão | empresas | parte das linhas fixas | acumulada |
|---|---|---|---|---|---|---|---|---|
| 1 | `32204` DESPESAS ADMINISTRATIVAS | `21501` OBRIGAÇÕES COM O PESSOAL | 38 | 442 | 442 | 37 | 8,9% | 8,9% |
| 2 | `21502` OBRIGAÇÕES PREVIDÊNCIARIAS | `11101` CAIXA | 20 | 236 | 236 | 15 | 4,7% | 13,6% |
| 3 | `21401` IMPOSTOS E CONTRIBUIÇÕES A RECOLHER | `11101` CAIXA | 17 | 197 | 197 | 16 | 4,0% | 17,6% |
| 4 | `21501` OBRIGAÇÕES COM O PESSOAL | `11101` CAIXA | 11 | 126 | 126 | 11 | 2,5% | 20,1% |
| 5 | `32205` DESPESAS FINANCEIRAS | partida múltipla | 5 | 120 | 120 | 5 | 2,4% | 22,5% |
| 6 | `32204` DESPESAS ADMINISTRATIVAS | `13209` (-) DEPRECIAÇÕES, AMORT. E EXAUS. ACUMUL | 5 | 60 | 60 | 3 | 1,2% | 23,7% |
| 7 | `41203` (-) IMPOSTOS SOBRE VENDAS E SERVIÇOS | `21401` IMPOSTOS E CONTRIBUIÇÕES A RECOLHER | 5 | 60 | 60 | 1 | 1,2% | 24,9% |
| 8 | `11102` BANCOS CONTA MOVIMENTO | `11101` CAIXA | 4 | 1.163 | 56 | 3 | 23,4% | 48,3% |
| 9 | `11101` CAIXA | `11102` BANCOS CONTA MOVIMENTO | 4 | 1.044 | 113 | 3 | 21,0% | 69,3% |
| 10 | partida múltipla | `11101` CAIXA | 4 | 91 | 91 | 4 | 1,8% | 71,1% |
| 11 | `32205` DESPESAS FINANCEIRAS | `21101` EMPRESTIMOS | 4 | 68 | 68 | 2 | 1,4% | 72,5% |
| 12 | partida múltipla | `11501` MERCADORIAS, PRODUTOS E INSUMOS | 3 | 83 | 83 | 1 | 1,7% | 74,2% |
| 13 | `32204` DESPESAS ADMINISTRATIVAS | `11102` BANCOS CONTA MOVIMENTO | 3 | 78 | 39 | 2 | 1,6% | 75,7% |
| 14 | `32205` DESPESAS FINANCEIRAS | `11102` BANCOS CONTA MOVIMENTO | 3 | 73 | 48 | 2 | 1,5% | 77,2% |
| 15 | `43000` (fora do plano modelo) | `21400` (fora do plano modelo) | 3 | 38 | 38 | 2 | 0,8% | 78,0% |
| 16 | `21400` (fora do plano modelo) | partida múltipla | 3 | 37 | 37 | 1 | 0,7% | 78,7% |
| 17 | `21400` (fora do plano modelo) | `11101` CAIXA | 3 | 36 | 36 | 2 | 0,7% | 79,4% |
| 18 | `31206` DEPRECIAÇÕES, AMORTIZAÇÕES E EXAUSTÕES | `13209` (-) DEPRECIAÇÕES, AMORT. E EXAUS. ACUMUL | 3 | 36 | 36 | 2 | 0,7% | 80,1% |
| 19 | `43000` (fora do plano modelo) | `11101` CAIXA | 3 | 36 | 36 | 2 | 0,7% | 80,9% |
| 20 | `11101` CAIXA | `31100` (fora do plano modelo) | 2 | 144 | 144 | 1 | 2,9% | 83,8% |

## 4. De onde sai o valor

### Os pares fixos pelo valor
- **valor fixo**: um lançamento em cada mês, e o maior e o menor do ano diferem até 1%;
- **um por mês, valor que muda**; **vários por mês**: algum mês com mais de um.

| | pares-empresa | linhas | — só à mão: pares-empresa | linhas |
|---|---:|---:|---:|---:|
| valor fixo | 38 | 436 | 38 | 435 |
| um por mês, valor que muda | 85 | 974 | 84 | 959 |
| vários por mês | 64 | 3.566 | 57 | 1.443 |

Dos que mudam, 20 (229 linhas) têm só dois valores no ano: em 17 o valor troca uma vez só, na ordem dos meses (o
degrau de um reajuste), e em 3 vai e volta. Pelos 15 pares de grupos mais comuns entre os fixos (pares-empresa e,
entre parênteses, linhas; a ordem e o desempate, os da tabela de cima):

| # | débito | crédito | valor fixo | um por mês, valor que muda | vários por mês | empresas |
|---|---|---|---|---|---|---|
| 1 | `32204` DESPESAS ADMINISTRATIVAS | `21501` OBRIGAÇÕES COM O PESSOAL | 16 (180) | 12 (138) | 10 (124) | 37 |
| 2 | `21502` OBRIGAÇÕES PREVIDÊNCIARIAS | `11101` CAIXA | 0 (0) | 12 (131) | 8 (105) | 15 |
| 3 | `21401` IMPOSTOS E CONTRIBUIÇÕES A RECOLHER | `11101` CAIXA | 0 (0) | 17 (197) | 0 (0) | 16 |
| 4 | `21501` OBRIGAÇÕES COM O PESSOAL | `11101` CAIXA | 4 (46) | 7 (80) | 0 (0) | 11 |
| 5 | `32205` DESPESAS FINANCEIRAS | partida múltipla | 0 (0) | 0 (0) | 5 (120) | 5 |
| 6 | `32204` DESPESAS ADMINISTRATIVAS | `13209` (-) DEPRECIAÇÕES, AMORT. E EXAUS. ACUMUL | 5 (60) | 0 (0) | 0 (0) | 3 |
| 7 | `41203` (-) IMPOSTOS SOBRE VENDAS E SERVIÇOS | `21401` IMPOSTOS E CONTRIBUIÇÕES A RECOLHER | 0 (0) | 5 (60) | 0 (0) | 1 |
| 8 | `11102` BANCOS CONTA MOVIMENTO | `11101` CAIXA | 0 (0) | 1 (12) | 3 (1.151) | 3 |
| 9 | `11101` CAIXA | `11102` BANCOS CONTA MOVIMENTO | 0 (0) | 0 (0) | 4 (1.044) | 3 |
| 10 | partida múltipla | `11101` CAIXA | 0 (0) | 0 (0) | 4 (91) | 4 |
| 11 | `32205` DESPESAS FINANCEIRAS | `21101` EMPRESTIMOS | 0 (0) | 0 (0) | 4 (68) | 2 |
| 12 | partida múltipla | `11501` MERCADORIAS, PRODUTOS E INSUMOS | 0 (0) | 2 (24) | 1 (59) | 1 |
| 13 | `32204` DESPESAS ADMINISTRATIVAS | `11102` BANCOS CONTA MOVIMENTO | 0 (0) | 0 (0) | 3 (78) | 2 |
| 14 | `32205` DESPESAS FINANCEIRAS | `11102` BANCOS CONTA MOVIMENTO | 0 (0) | 1 (12) | 2 (61) | 2 |
| 15 | `43000` (fora do plano modelo) | `21400` (fora do plano modelo) | 0 (0) | 0 (0) | 3 (38) | 2 |

### O casamento com o que o Domínio apura
**`fechamento_valores.sql`**: por empresa e competência, o que o Domínio apura e um lançamento pode estar pagando, até
R$ 1,00, na competência do mês do lançamento ou na do anterior: o saldo a recolher de cada imposto
(`bethadba.efsdoimp`, "Saldo dos Impostos": `sdev_sim` "Saldo a Recolher", por `codi_imp` — o 44 é o DAS; `pdic_sim`
6 mensal e 7 trimestral), a soma dos impostos e o PIS mais a Cofins (no PC), o bruto e o líquido da folha e dos sócios
(`bethadba.fobasesserv`, "Bases - Calculo": `proventos` e `descontos`, pela categoria da `bethadba.foempregados`; sem
simulação e só o rateio 0, como no `folha_valores.sql`), o adiantamento e o 13º, a guia do FGTS
(`bethadba.fofgtsfilial.total_fgts`) e a GPS (`bethadba.foguiainss.total_guia`, "Total da guia(campo 11 da GPS)"). Só a
soma da empresa; de 12/2024 a 12/2025 (5 a 7 s por lote). **O par casa** quando bate em metade dos meses dele ou mais,
e em pelo menos 2; quando dois tipos batem no mesmo número de meses, os dois vão no rótulo (é o empate, não uma
escolha).

**`fechamento_casamento.sql`**: o mesmo, **pessoa a pessoa, dentro do Domínio** — quantas linhas digitadas têm o valor
do bruto ou do líquido de um cálculo de um sócio ou de um empregado (na competência do mês ou na anterior, até
R$ 1,00). O valor de cada pessoa não sai da consulta, só a contagem (4 a 8 s por lote).

Nos pares fixos (só à mão, as 68 empresas):

| | casou com | pares-empresa | linhas |
|---|---|---:|---:|
| um por mês, valor que muda (84) | o DAS do Simples do mês anterior | 14 | 160 |
| | a GPS do INSS do mês anterior | 8 | 87 |
| | a guia do FGTS do mês anterior | 4 | 44 |
| | o PIS, a Cofins ou o ISS do mesmo mês (uma empresa só: 1 par casa com o PIS; 2 casam nos 12 meses tanto com a Cofins quanto com o ISS, que nessa empresa têm o mesmo saldo a recolher) | 3 | 36 |
| | não casou com nada | 55 | 632 |
| vários por mês (57; a soma do mês) | a guia do FGTS do mês anterior | 4 | 55 |
| | a GPS do INSS do mês anterior | 4 | 50 |
| | não casou com nada | 49 | 1.338 |
| valor fixo (38) | o pró-labore bruto do mesmo mês (num deles, também o do anterior, de mesmo valor) | 3 | 32 |
| | a GPS do INSS (a do mês e a do anterior têm o mesmo valor) | 1 | 10 |
| | não casou com nada | 34 | 393 |

Na origem 1 inteira, os mesmos pares casam (o DAS com 161 linhas e a GPS de valor fixo com 11) e há a mais 1 par de
valor que muda e 7 de vários por mês, nenhum casando: 2.137 linhas a mais, quase todas do importador. Os outros
candidatos (o líquido da folha, o pró-labore líquido, o ICMS, o IRPJ, a CSLL, a soma dos impostos) não são o casamento
de par nenhum.

O que casou está onde se espera: o DAS no `21401`×`11101` (13 pares-empresa), a GPS e o FGTS no `21502`×`11101`.
**Pessoa a pessoa quase nada casa**: das 15.654 linhas, **181 (1,2%)**, em 139 pares-mês, têm o valor de uma pessoa (31
o bruto de um sócio, 22 o líquido, 32 o bruto de um empregado, 117 o líquido; uma linha pode casar com mais de um), e
nenhum par fixo muda de classe. **Os honorários (`32204`×`21501`, 38 pares-empresa em 37 empresas)**: 37 não casam com
nada do Domínio; 1, de valor fixo, bate com o pró-labore bruto do mesmo mês (nessa empresa o par é, provavelmente, o
pró-labore lançado no `32204`; não conferido). Os outros não são o pró-labore: 35 das 37 empresas (36 dos 38 pares) têm
o pró-labore calculado na folha, nenhum mês do par é o salário mínimo de 2025, e, nos meses com um lançamento só, 18
pares têm um valor só no ano, 9 dois, 8 três e 3 quatro ou mais (10 dos 38 têm algum mês com mais de um lançamento;
pelo total do mês: 16, 8, 8 e 6). Pela classificação (o item 2), são os honorários contábeis: ao que tudo indica, o
honorário do próprio escritório, com o valor na cobrança do sistema e não no Domínio (nada disso conferido aqui).

## 5. O histórico
- Dos 15.654 lançamentos da origem 1 de 2025, **2.364 (15,1%) têm código de histórico padrão** (`ctlancto.codi_his`):
  2.358 no cadastro da própria empresa, 6 com código sem cadastro. **13.290 (84,9%) só texto livre**; todos os 15.654
  têm texto (`chis_lan`). (28,5 s.)
- **O histórico padrão é cadastrado por empresa** (`bethadba.cthispad`, "Historicos Padroes - Cadastro", `codi_emp` na
  chave, `desc_his` "Descricao"; 54.159 linhas em 363 empresas). A "Origem dos Historicos" (`ctparmto.codi_emp_his`)
  está vazia nas 75, e **as 75 têm cadastro próprio** (mediana de 197 históricos; o modelo 998 tem 242). O código do
  modelo existe na maioria, mas o texto não é o do modelo em nenhuma das 75 (por código, o texto igual ao do modelo
  aparece em poucos: entre os 25 mais usados, em 3). Por isso, só o código e a contagem (5,5 s):

| código | lançamentos | empresas | | código | lançamentos | empresas |
|---:|---:|---:|---|---:|---:|---:|
| 120 | 272 | 33 | | 144 | 54 | 10 |
| 113 | 149 | 18 | | 171 | 52 | 6 |
| 118 | 109 | 15 | | 123 | 37 | 5 |
| 121 | 103 | 16 | | 170 | 37 | 11 |
| 143 | 92 | 9 | | 180 | 34 | 3 |
| 114 | 84 | 12 | | 187 | 34 | 1 |
| 141 | 81 | 8 | | 178 | 30 | 2 |
| 179 | 77 | 7 | | 21 | 29 | 13 |
| 151 | 58 | 9 | | 24 e 115 (empate) | 28 cada | 1 e 3 |
| 185 | 58 | 6 | | | | |
| 127 | 56 | 5 | | | | |

  Os 20 primeiros (com o empate) somam 1.502 das 2.364 linhas com código.

## 6. O que o Domínio já tem pra lançar sozinho

### Lançamento padrão, lote, modelo (o catálogo, `--procurar padrao`, `automatico`, `modelo`, `recorrente`, `lote`)
| tabela (descrição do catálogo) | o que importa | linhas | empresas |
|---|---|---:|---:|
| `ctlanctopadrao` ("Lancamentos Padroes em Lote - Cadastro") | `cdeb_pad`, `ccre_pad`, `chis_pad`, `tipo_pad`, `desc_pad` | 9.649 | 136 |
| `ctlanctopadrao_contas` ("Lancamentos Padroes em Lote - Contas") | `debito`, `credito`, `historico` por sequencial | 38 | 9 |
| `ctlanctolote` ("Lancamento em lote") com `codi_pad` | o lote feito por um padrão | 99.123 | 103 |
| `ctlanctolote` com `GUID_LOTE` ("…lote importado via API") | | 90 | 1 |
| `CTBAKLANCTOLOTE` ("Lançamento em lote eliminados") | | 5.657 | 128 |
| `CTEXTRATO_BANCARIO_CONFIGURACAO` ("Configuração para contabilizar extrato bancário") | `CODI_CTA_BANCO`, `PARTE_HISTORICO`, `CODI_CTA_CONTRA_PARTIDA`, `CODI_HIS`, `TIPO` (D soma, C subtrai, A ambos) | 4.103 | 70 |
| `CTEXTRATO_BANCARIO_CONFIGURACAO_ICEBERG` ("…Contabilidade Digital") | | 26 | 1 |
| `CTATENDIMENTO_LANCTO_CATALOGO` ("Catálogo de lancamentos - Domínio Atendimento") | de 2022 a 2023 | 142 | 1 |
| `ctparmto.DISTRIBUICAO_LUCRO_AUTOMATICO` ("N - NAO / S - SIM") | | 0 com S | 0 |

"Recorrente" e "automático" de lançamento não existem no catálogo. **O lançamento padrão não é usado desde 2012**: o
último lançamento com `codi_pad` é de 2012 (98 empresas tiveram algum), nenhum de 2023 a 2026, e nenhum lote com padrão
tem lançamento de 2023 em diante (7,7 s e 2,8 s).

### A importação
A `CTORIGEM_LANCAMENTO` (29 códigos: 1 Normal, 2 Zeramento, 3 Patrimônio, 4 Escrita, 5 Saídas EF, 6 Entradas EF, 7
Serviços EF, 8 Ajustes EF, 9 Acumuladores EF, 10 Apuração EF, 11 Pagamento Guia EF, 12 Cliente, 13 Folha Pagamento,
14 a 20 Honorários, 21 Reduções Z, 22 Recebimento ECF, 23 Crédito PIS/COFINS imobil., 24 Saldo estoque PIS e COFINS, 25
Ajuste PIS e COFINS, 26 a 28 Bilhetes de passagem, 29 Ajuste Estoque ST) **não tem origem de importado**: o
lançamento importado entra como Normal (a 1), e **o que marca a importação é a `ctlancto.origem_reg`** (2 = "Imp.
Layout"). Origens que aparecem na `ctlancto` e não estão na lista: 34, 39 (o extrato), 65, 66, 70 e 72. No Domínio
inteiro (2,5 s):

| | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|
| origem 1, importada (`origem_reg` = 2) | 1.739 (6 empresas) | 199 (2) | 9.435 (20) | 30 (2) |
| origem 1, digitada (`origem_reg` = 0) | 9.880 (71) | 11.347 (84) | 8.355 (93) | 3.025 (40) |
| origem 70, importada | 90 (1) | — | — | — |

Nenhuma outra origem tem `origem_reg` diferente de 0, e o 1 e o 3 não aparecem (de 2023 a 2026). **O escritório já usa
o importador de lançamentos**: pouco até 2024, e em 2025 em 20 empresas (19 no recorte); no recorte, 6.732 das 8.666
linhas importadas (77,7%) são do último trimestre, e 8.665 têm uma conta de banco.

**O importador e o extrato (a 39) nas 19 empresas** — por mês e por conta de banco, de 2025 (`bethadba.ctlancto` com
a classificação da conta, só as contagens; 1,3 a 1,5 s por mês): 11 tinham o extrato pela 39 antes do primeiro mês
importado e não o têm mais dali em diante; 6 têm os dois antes e depois; 1 só tem a 39 depois; 1 nunca teve a 39. Dos
meses-empresa com banco: 29 (15 empresas) só com o importador, 12 (5 empresas) com os dois em contas diferentes, **6 (2
empresas) com os dois na mesma conta** — 582 linhas importadas numa conta de banco que no mesmo mês também tem o
extrato pela 39 (pode ser lançamento em dobro ou partes diferentes do mês; não conferido) — e 133 só com a 39.

### O extrato pela configuração
`CTEXTRATO_BANCARIO_LANCAMENTO_ITEM_LANCTO` ("Lançamento de extrato bancário - lançamentos contábeis") marca cada
lançamento contábil que nasceu de uma linha do extrato com o `TIPO` ("Tipo de lançamento (0=Sistema/ 1=Manual)"); a
`CTEXTRATO_BANCARIO_LANCAMENTO_ITEM` marca a linha do extrato com a `ORIGEM` ("Origem (M=Manualmente/ I=Importação)").
No Domínio inteiro (1,9 s):

| ano | pela configuração (Sistema) | classificados à mão (Manual) | parte da configuração |
|---|---|---|---:|
| 2024 | 65.360 (40 empresas, 54 contas) | 7.433 (39, 51) | 89,8% |
| 2025 | 81.227 (49, 71) | 7.937 (46, 61) | **91,1%** |
| 2026 | 28.808 (21, 30) | 3.728 (20, 28) | 88,5% |

Todas as linhas do extrato são importadas (`ORIGEM` = I): nenhuma digitada na tela do extrato.

## 7. O que eu concluiria
1. **O tamanho é pequeno, e metade dele já é automático.** Em 2025 a origem 1 teve 15.654 linhas em 74 empresas, mas
   55% vieram do importador de lançamentos (em 19 empresas, 77,7% no último trimestre, quase tudo com uma conta de
   banco). O digitado à mão é **6.988 linhas no ano, uns 580 por mês no escritório, mediana de 5 por mês-empresa e
   percentil 90 de 20**; 62 das 75 empresas ficam com mediana de até 10.
2. **Um método de regras fixas, com o valor que o Domínio já tem, cobre pouco do digitado à mão: cerca de 12,5%.** Das
   6.930 linhas à mão das 68 empresas com 3 meses ou mais (os pares-mês mistos fora): 435 (6,3%) em pares fixos de valor
   fixo e 432 (6,2%) em pares fixos cujo valor é o que o Domínio apura (o DAS, a GPS e o FGTS da competência anterior;
   numa empresa, o PIS, a Cofins ou o ISS do mesmo mês). **Se o valor dos honorários vier da cobrança do sistema** (não
   conferido; são pares fixos, mas pelo total do mês só 16 dos 38 têm um valor só no ano), mais 262 linhas (3,8%):
   **cerca de 16% (1.129 das 6.930)**. O resto: pares fixos sem de onde tirar o valor (24,6%: 71% deles com vários
   lançamentos no mês), frequentes (30,4%) e eventuais (28,7%).
3. **Por empresa, o método serve em 13 das 68** (com os honorários, a conferir): nelas, os pares fixos com o valor
   conhecido são metade ou mais do que se digita à mão — **10 delas sem banco**; nenhuma das 5 de plano de outra
   estrutura. Sem os honorários, 9.
4. **Por onde começar: as empresas sem banco.** Sem as 2 de plano de outra estrutura (que têm 35% das linhas do perfil),
   o digitado das 29 cabe em poucos pares: **os 10 primeiros, 87%; os 20, 95%**, quase todos contra o caixa. Os quatro
   pares mais comuns: pagar o INSS e o FGTS (`21502`×`11101`, com a GPS e a guia do mês anterior), pagar o DAS
   (`21401`×`11101`, o DAS do mês anterior), provisionar e pagar os honorários (`32204`×`21501`, `21501`×`11101`);
   das 28 sem banco com 3 meses ou mais, 13 têm os quatro no ano, 17 três ou mais, e cada um aparece em 18 a 22
   delas. Junto deles, os juros (`32205`, em partida múltipla: em metade dos lotes, com o pagamento de um imposto ou da
   previdência). O histórico vai junto: 85% hoje é texto livre, e o código de histórico é de cada empresa (não há um
   cadastro comum pra usar).
5. **O volume grande é o banco, e lá o caminho não é a regra fixa, é o extrato.** O caixa contra o banco é 47% da
   origem 1, quase sempre "eventual" ou "vários por mês" (mediana de 5 linhas no mês do par). Onde o extrato é
   importado pelo Domínio (a origem 39), 91% dos lançamentos contábeis dele vêm marcados "Sistema" (no Domínio inteiro;
   a configuração tem 4.103 regras em 70 empresas). O importador de layout de 2025 tomou o lugar da 39 em 11 das 19
   empresas, no mês em que começou; em 2 empresas, os dois caem na mesma conta no mesmo mês (582 linhas, a conferir se é
   lançamento em dobro).
6. **O que o Domínio já tem pra lançar sozinho**: o lançamento padrão (cadastrado em 136 empresas, sem uso desde 2012),
   a configuração do extrato (usada) e o importador por layout (usado em 2025). Não há "lançamento recorrente". Como o
   método entraria (a fila: o importador do Domínio, com uma pessoa conferindo) segue em aberto.
7. **O que fica de fora do método**: os eventuais (o fornecedor, o empréstimo, o adiantamento); os de valor sem fonte no
   Domínio — os juros (em partida múltipla, com o crédito no caixa em 227 dos 278 lotes) e as tarifas bancárias (contra
   o banco, essas no extrato); a provisão dos honorários, enquanto o valor não for conferido na cobrança do sistema; o
   pró-labore e o salário pagos à mão, que pessoa a pessoa quase não casam com a folha (a folha integrada já paga a
   maior parte pelo caixa); e as 5 empresas de plano de outra estrutura (3 delas com a contabilidade inteira digitada),
   que pedem o mapa do plano delas antes de qualquer regra.

### O que o Samuel e o Diego decidem
- Se o primeiro método é o das empresas sem banco (os quatro pagamentos do mês e os honorários), com o valor do DAS, da
  GPS e do FGTS da competência anterior e o dos honorários vindo da cobrança do sistema — depois de conferir que o valor
  lançado é o cobrado.
- Se as 11 empresas que trocaram o extrato da 39 pelo importador de layout em 2025 voltam pra configuração do extrato do
  Domínio, e quem confere as 2 em que os dois caem na mesma conta no mesmo mês (582 linhas).
- O que fazer com as 5 empresas de plano de outra estrutura (o mapa do plano delas, ou ficam fora do método).
- Se vale contar o importado e o digitado à mão separados na ponte (o `origens.sql` conta os dois no `lanc_normais`; a
  coluna `origem_reg` diz qual é qual). Isso muda a ponte e pede o "vai".
