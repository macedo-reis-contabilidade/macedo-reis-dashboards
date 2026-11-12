# Fila de 11/11/2026 · o Comparativo tributário pelas notas — o que se achou no Domínio

Escrito pelo Code do PC do escritório em 11/11/2026, na branch `fila-11-11-comparativo`. Os rascunhos estão em
`ponte/rascunhos/comparativo_*.sql`, que a ponte **não lê**: o contrato, a função e as tabelas do sistema não mudaram.
Os números são **do escritório inteiro** ou contagens; nenhum valor de empresa. O resultado de cada empresa (09/2026)
ficou só em `C:\ponte-dominio\comparativo_saidas.txt`, `_entradas`, `_servicos`, `_piscofins`, `_presumido` e
`_resultado` (fora do repositório). As conferências rodaram dentro de uma consulta que só conta (o rascunho e a
consulta da ponte juntos, as datas no lugar dos `?`): a linha de cada empresa não aparece aqui. Os tempos são do
rascunho sozinho, com `--mes 2026-09`; todos abaixo de 5 s.

**Um cuidado com as conferências "N de N".** A soma dos grupos contra o `faturamento.sql` (nos itens 1, 2, 3 e 4) usa
o mesmo corte (os mesmos segmentos, pelo mesmo acumulador) e grupos que repartem esses segmentos, com uma sobra
(`outras_saidas`, `serv_sem_item`, `pc_sem_cst`, `receita_irpj_outros`): ela sempre bate, e o que ela testa é só o
corte e que nada foi contado duas vezes (um segmento com mais de uma linha de imposto multiplicaria). O que diz algo do
dado é a composição da sobra e as contagens de cada grupo, abaixo. As conferências com a apuração (itens 3 e 4) e com
o zeramento (item 5) são de verdade.

Uma revisão independente dos rascunhos (cada achado conferido por outro revisor) achou o que está corrigido aqui: o
débito do PIS/Cofins e a base do IRPJ sem os serviços (a apuração separa saídas e serviços), a presunção e o anexo
pela vigência errada do acumulador, o início do trimestre e afirmações que não tinham sido medidas.

## 0. O que vale pra todos

### Os códigos dos impostos (`bethadba.geimposto`, só o código e a sigla)
1 ICMS · 2 IPI · 3 ISS · 4 PIS · 5 COFINS · 6 CSOC (a CSLL) · 7 IRPJ-LP (o IRPJ do Presumido) · 8 DIFALI · 9 SUBTRI
(o ICMS-ST) · 16 IRRF · 17 PIS-MP66 e 19 COFINS-N (o não cumulativo) · 18 ISS Ret · 44 SIMPLESN. Os impostos de cada
segmento ficam em `bethadba.efimpsai` ("Notas Fiscais de Saida - Impostos"), `bethadba.efimpent` (entradas) e
`bethadba.efimpser` (serviços), uma linha por segmento e imposto: `bcal_*` "Base de calculo", `aliq_*` "Aliquota",
`vlor_*` "Valor do imposto", `prbc_*` "Percentual da base de calculo". A apuração do mês fica na `bethadba.efsdoimp`
("Saldo dos Impostos"), uma linha por empresa, imposto, competência e periodicidade (`pdic_sim`: 6 mensal, 7 trimestral).

### O regime da empresa
O Domínio guarda o regime federal em `bethadba.EFPARAMETRO_VIGENCIA.RFED_PAR` ("Regime federal (1 / 2 / … / 9)", na
`VIGENCIA_PAR` mais recente), **sem dizer o que é cada código**. Pelas apurações do 3º trimestre de 2026:

| RFED_PAR | empresas | ativas | com o Simples (44) | com o IRPJ do Presumido (7) | com o PIS/Cofins não cumulativo (17, 19) | com o cumulativo (4, 5) | leitura |
|---|---:|---:|---:|---:|---:|---:|---|
| 1 | 2 | 2 | 0 | 0 | 2 | 0 | Lucro Real |
| 2 | 296 | 82 | 65 | 0 | 0 | 0 | Simples |
| 4 | 19 | 8 | 8 | 0 | 0 | 0 | Simples (outro código; a confirmar) |
| 5 | 35 | 10 | 0 | 7 | 1 | 8 | Lucro Presumido |
| 8 | 2 | 2 | 0 | 0 | 0 | 0 | ? (sem apuração federal) |
| 9 | 1 | 0 | 0 | 0 | 0 | 0 | ? |

As contagens por regime abaixo usam essa leitura (1 Real, 2 e 4 Simples, 5 Presumido, o resto "outro"); 15 empresas
ativas não têm a vigência do parâmetro. A forma de tributação dos dados do SPED (`CTPARMTO_SPED_VIGENCIA.FORMA_TRIBUTACAO`)
não serve: 261 empresas do Simples estão lá como Lucro Real (o padrão da guia).

## 1. As vendas pelo CFOP, o ICMS e o IPI

### `comparativo_saidas.sql` (3,8 s, 56 empresas) e `comparativo_entradas.sql` (1,8 s, 57 empresas)
- `bethadba.efsaidas` ("Notas Fiscais de Saida"): `codi_nat` ("Natureza") é o CFOP de 4 dígitos — em 09/2026, 33.678
  segmentos de 56 empresas, de 5101 a 7949, nenhum fora de 5000 a 7999 —; `vcon_sai` ("Valor contabil"), `IPI_SAI`
  ("Valor IPI"), `ICMS_ST_SAI` ("Valor ICMS ST"). O corte é o do `faturamento.sql` (a vigência mais recente do
  acumulador e `IFAT_ACU = 'S'`; fora a cancelada, a denegada e a inutilizada).
- `bethadba.efentradas`: `codi_nat` (o CFOP), `IPI_ENT` ("Valor IPI"), `ICMS_ST_ENT` ("Valor ICMS ST"); os grupos do
  `compras.sql`.
- **O ICMS sai da linha 1 da tabela de impostos; o IPI e o ICMS-ST, do segmento.** Em 09/2026 as linhas 2 (IPI) e 9
  (SUBTRI) estão vazias: nas saídas, 0 segmentos (o campo do segmento tem o IPI em 4 e o ST em 2); nas entradas, 0 com
  o IPI na linha 2 e 1 com o ST na linha 9, contra 321 com o `IPI_ENT` e 259 com o `ICMS_ST_ENT`.
- Os grupos são os da fila. `outras_saidas` é o resto que o acumulador marca como faturamento.

### A conferência (09/2026)
- A soma dos grupos contra a mercadoria do `faturamento.sql` antes da devolução (`receita_mercadorias`): **56 de 56
  batem** até R$ 1,00. A soma de `saidas_no_estado`, `saidas_outro_estado` e `saidas_exterior` contra a mesma parte:
  **56 de 56.**

### As contagens (09/2026, as empresas ativas com nota de saída ou de entrada)
| | Simples | Presumido | Real |
|---|---:|---:|---:|
| ativas com movimento | 53 | 6 | 2 |
| `venda_producao` > 0 | 9 | 2 | 2 |
| `venda_revenda` | 36 | 4 | 2 |
| `venda_combustivel` | 1 | 0 | 0 |
| `industrializacao_encomenda` | 5 | 0 | 0 |
| `transporte` (e o 357) | 1 (1) | 0 | 0 |
| `energia_comunicacao` | 0 | 0 | 0 |
| `outras_saidas` | 2 | 0 | 0 |
| vendem pra fora do estado / pro exterior | 10 / 0 | 1 / 0 | 0 / 0 |
| `icms_saidas` > 0 | 0 | 6 | 2 |
| `icms_st_saidas` / `ipi_saidas` > 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| `icms_compras` > 0 | 13 | 5 | 2 |
| `ipi_compras` > 0 | 24 | 3 | 2 |
| `icms_despesas` > 0 | 4 | 0 | 0 |

- **O CT-e entra na `efsaidas`**, não na `efservicos`: em 09/2026, 147 segmentos da espécie 43 (o CT-e), de 1 empresa,
  com CFOP de transporte; na `efservicos`, nenhum. Nenhuma saída com 932 ou 933 em 09/2026.
- O Simples não destaca o ICMS nas vendas (vai no DAS), mas o Domínio grava o ICMS das compras dele (13 empresas):
  ele não é crédito.

### O que o Claude da sessão do Samuel decide
1. O x.933 é "prestação de serviço tributado pelo ISSQN" na tabela de CFOP, não transporte; a fila pôs no
   `transporte` e o rascunho seguiu. Nenhum em 09/2026; se aparecer, tirar dali muda pouco.
2. O `icms_compras` do Simples não é crédito: o contrato manda e o Comparativo só usa no regime normal, ou o rascunho
   zera no Simples.
3. Se o `icms_st_saidas` e o `ipi_saidas` entram (zero em 09/2026 em todas as ativas).

## 2. Os serviços pelo item da lista e o ISS

### `comparativo_servicos.sql` (1,6 s, 28 empresas)
- `bethadba.efservicos` ("Notas Fiscais de Servico"): `vcon_ser`, `dser_ser`, `cfps_ser` ("Codigo fiscal da prestacao
  de servicos"); `bethadba.efimpser` (o ISS: linha 3, e o ISS retido: linha 18); `bethadba.EFACUMULADOR_VIGENCIA_IMPOSTOS`
  (`SIMPLESN_ANEXO_IAC` "Simples Nacional - Anexo").
- **O item da lista da LC 116 não existe no Domínio do escritório.** A nota de serviço não tem a coluna; o "Código do
  Serviço conforme LC nº 116/03" do acumulador (`DF_CODIGO_SERVICO_CONFORME_LC_116_03` e `_CODIGO`) está vazio nos
  acumuladores dos 226 segmentos de serviço de 09/2026; a marca dos subitens 7.02 e 7.05 do acumulador do Simples
  (`SIMPLESN_SERVICOS_702_705`) não está ligada em nenhum dos usados de 10/2025 a 09/2026; os itens das notas de serviço
  (`bethadba.EFMVVPRO`, com o produto e o código do serviço dele) têm 100 linhas no banco inteiro; e a configuração do
  importador da NFS-e Nacional tem 1 linha de item de serviço. Por isso **os grupos `serv_construcao`, `serv_saude`,
  `serv_transporte`, `serv_locacao` e `serv_outros` ficaram de fora**, e `serv_sem_item` é todo o serviço.
- **O que existe:** o `cfps_ser`, em 60 dos 226 segmentos de 09/2026. De 10/2025 a 09/2026 há só 5 códigos: 9202 (527
  segmentos, 6 empresas), 9201 (416, 4), 9101 (98, 3), 9203 (89, 5) e 3 (13, 1). É o código fiscal da prestação, não o
  item. E o anexo do Simples no acumulador, que vai em `serv_anexo_iv` (o anexo IV tem a obra, a limpeza, a vigilância
  e a advocacia): de 10/2025 a 09/2026, os segmentos de serviço estão no anexo III (3.408 segmentos, 33 empresas), no IV
  (89, 3) e sem anexo (325, 1).
- **O ISS quase não está na nota.** Em 09/2026, 1 dos 222 segmentos (fora os cancelados) tem a linha do ISS. De 10/2025
  a 09/2026, 323 segmentos de 3 empresas: 211 com o ISS (3) e 112 com o retido (18), **nenhum com os dois** — o
  `iss_devido` já é o que a empresa paga, sem o retido. Das 211 linhas do ISS, 208 têm alíquota (2% em 204, 3% em 3,
  outra em 1) e 3 vêm com zero; das 112 do retido, 103 têm alíquota e 9 vêm com zero. A apuração do ISS na `efsdoimp` (3) em 09/2026: 4 empresas com a linha, nenhuma com valor; o ISS
  retido (18), 14.
- **Nenhuma empresa do Presumido tem nota de serviço em 09/2026** (0 de 10); as 28 com serviço são do Simples, com o
  ISS no DAS.

### A conferência (09/2026)
A soma (`serv_sem_item`) contra a parte de serviço do `faturamento.sql`: **28 de 28 batem.** Todas do Simples e
ativas; 2 com `serv_anexo_iv`; 1 com base do ISS (a alíquota fora das faixas de 2% a 5%).

### O que o Claude da sessão do Samuel decide
1. **De onde vem o item da lista.** No Domínio, não há. O XML da NFS-e tem o item (o código de tributação nacional e
   o NBS); o sistema já importa NFS-e pra Reforma (`nf_documentos` e `nf_itens`). O caminho mais curto é o sistema
   classificar pelo XML que ele mesmo importa, não pela ponte.
2. Se o `serv_anexo_iv` entra no contrato como pista (não é o item).
3. O ISS do Presumido e do Real: em 09/2026 eles não têm serviço; quando tiverem, a linha 3 da `efimpser` traz.

## 3. O PIS/Cofins pela situação tributária

### `comparativo_piscofins.sql` (3,8 s, 77 empresas)
- **O CST está no item da nota**: `bethadba.efmvspro` ("Notas Fiscais de Saida - Produtos": `cst_pis_msp` "CST do PIS",
  `cst_cofins_msp` "CST do COFINS", `VALOR_CONTABIL_MSP` "Valor contabil produto"); no serviço,
  `bethadba.EFSERVICOS_PIS_COFINS` (`CST`, `VALOR_CONTABIL`). O CST do segmento (`CST_PISCOFINS_SAI`) e o do acumulador
  (`CODIGO_CST_PISCOFINS_SAIDA_ACU`) estão vazios em todos os segmentos de faturamento de 09/2026.
- Em 09/2026: no Presumido, 154 segmentos de 6 empresas, 110 com todos os itens com CST e 44 sem item (vão pra
  `pc_sem_cst`); no Real, 4.826 segmentos de 2 empresas, todos com os itens com CST; no Simples, 27.952 segmentos de
  48 empresas, 19.438 com itens, **nenhum com o CST** (o PIS e a Cofins vão no DAS). Em todos os itens de 09/2026 o
  CST da Cofins é o do PIS, menos 1 (no Real).
- `pc_sem_cst` é o valor do segmento que não está em item com CST (o segmento sem item, o item sem CST e a diferença
  entre o segmento e os itens); em 09/2026 nunca ficou negativo. **Por dentro**, segmento a segmento (sem compensar
  um com outro), nas empresas do Presumido e do Real: 44 dos 154 segmentos do Presumido não têm item com CST, e 3
  (de 1 empresa) têm os itens diferentes do segmento em mais de R$ 1,00; no Real, nenhum dos dois.
- A apuração (`efsdoimp`, mensal): no Presumido, o 4 e o 5 — `bcal_sim` (a base), `vims_sim` e `vimv_sim` (o débito das
  saídas e o dos serviços: a apuração separa os dois, e de 10/2024 a 09/2026 há 48 linhas do 4 e do 5 com o serviço),
  `sdev_sim` (o saldo); no Real, o 17 e o 19, com `vime_sim` (o crédito das entradas). No Real, o débito menos o
  crédito não dá o saldo (há outros ajustes no meio), e a base da COFINS-N vem vazia: `base_pis_cofins` é a base do
  PIS.
- **A trava do `dominio sql`** não mostra coluna com "pis" no nome (`pis_apurado`, `base_pis_cofins`…): pra rodar o
  rascunho por ele, embrulhe numa consulta que troca os nomes, como aqui. Pela ponte (a `FonteDominio`), a trava não
  vale.

### A conferência (09/2026)
A soma dos grupos contra a receita do `faturamento.sql` antes da devolução (mercadoria + serviço): **77 de 77 batem.**

### As contagens (09/2026, as empresas ativas com faturamento ou apuração)
| | Simples | Presumido | Real |
|---|---:|---:|---:|
| empresas | 68 | 7 | 2 |
| `pc_tributada` > 0 | 0 | 5 | 2 |
| `pc_monofasica` / `pc_st` | 0 / 0 | 0 / 0 | 1 / 1 |
| `pc_aliquota_zero` | 0 | 1 | 2 |
| `pc_isenta` / `pc_sem_incidencia` / `pc_suspensa` | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 1 / 1 |
| `pc_outras` | 0 | 2 | 0 |
| `pc_sem_cst` em mais de 5% da receita | 68 | 1 | 0 |
| com a apuração no mês / com saldo a recolher | 0 / 0 | 7 / 4 | 2 / 1 |

### O que o Claude da sessão do Samuel decide
1. No Simples, o CST não existe: o monofásico e o ST continuam saindo da apuração do DAS (o `receita_monofasica` e o
   `receita_st` do `faturamento.sql`). O `comparativo_piscofins` serve ao Presumido e ao Real.
2. No Presumido, a nota sem os produtos lançados (44 segmentos) e a de itens que não somam o segmento (3) ficam em
   `pc_sem_cst`. Se o contrato quiser separar as duas, é uma coluna a mais.

## 4. A apuração do IRPJ e da CSLL do Presumido

### `comparativo_presumido.sql` (3,5 s, 77 empresas)
- **A presunção está no acumulador**: `bethadba.EFACUMULADOR_VIGENCIA_IMPOSTOS.ALBC_IAC` ("Aliquota da Base de
  Calculo") do imposto 7 (o IRPJ) e do 6 (a CSLL), **na mesma vigência do acumulador** que o corte usa: os impostos são
  o retrato de cada vigência (3.524 dos 3.837 acumuladores de faturamento vigentes em 09/2026 têm as linhas na própria
  vigência; 27 têm o IRPJ só numa vigência anterior, e pegariam a presunção velha se ela fosse lida por imposto). No 3º
  trimestre de 2026, nas empresas do Presumido com nota: 8 e 12 em 6 empresas, 32 e 32 em 1. Nenhuma empresa do
  Simples (72) nem do Real (2) tem receita com presunção: vai toda em `receita_irpj_outros`. A receita por percentual sai
  daí: o rascunho soma o segmento de faturamento pela presunção do acumulador dele, com a devolução negativa.
- **A apuração não separa o percentual.** No `efsdoimp` (o 7 e o 6): `vcos_sim` e `vcov_sim` "Valor contabil de
  saidas/servicos" (a receita), `bcas_sim` e `bcav_sim` "Base de calculo de saidas/servicos" (a receita vezes a
  presunção), `bcal_sim` "Base de calculo do imposto", `srec_sim` "Saldo a recolher antes das deduções" e `sdev_sim` (o
  saldo). As outras colunas (as "Valor disponível") vêm vazias. No 3º trimestre não há serviço no Presumido, mas de
  10/2024 a 09/2026 há 29 linhas do 7 e do 6 com o serviço. No 3º trimestre, em todas as linhas com receita, a
  `bcas_sim` é 8% (IRPJ) ou 12% (CSLL) da `vcos_sim`; a `bcal_sim` é igual à `bcas_sim` (nenhuma receita que entra
  inteira); e o `srec_sim` é 15% (IRPJ) ou 9% (CSLL) da base.
- **O 32% não foi conferido com uma apuração**: das 7 empresas do Presumido com nota no 3º trimestre, a de 32% é a
  única sem a apuração do IRPJ (a 7ª apuração é da empresa sem nota). Todas as apurações conferidas são de 8% e 12%.
- **Mensal e trimestral misturados.** 4 empresas do Presumido têm a linha mensal (`pdic_sim` 6) e 3 a trimestral (7,
  gravada no último mês do trimestre). O rascunho devolve a do mês e, na trimestral, a do trimestre do mês, com
  `apuracao_trimestral` = 1 (coluna que a fila não pedia: sem ela, não dá pra saber de que período é a apuração).
- `demais_receitas` = `bcal_sim − bcas_sim − bcav_sim`; zero em todas as linhas do trimestre.
- **Fica de fora: o `adicional_irpj`.** Ele não está na linha do IRPJ: de 10/2024 a 09/2026, nas 7 linhas trimestrais
  com a base acima de R$ 60 mil (e na 1 mensal acima de R$ 20 mil), o `srec_sim` ficou em 15% da base e os outros
  acréscimos e débitos (`oacr_sim`, `outd_sim`) vêm zerados. O parâmetro tem "Calcular adicional do IRPJ mensalmente"
  (`EFPARAMETRO_VIGENCIA.CALCULAR_ADICIONAL_IRPJ_MENSALMENTE_PAR`), mas onde o Domínio guarda o valor não se achou.

### As contagens (3º trimestre de 2026)
- O Domínio diz (o `RFED_PAR`, item 0) **10 empresas ativas do Lucro Presumido e 2 do Lucro Real**. Das 10 do
  Presumido, 8 têm faturamento ou apuração no trimestre e **7 têm a apuração do IRPJ** (3 por trimestre).
- A receita pela presunção do acumulador: **toda em 8%, 4 empresas; toda em 32%, 1; nas duas, nenhuma; 1,6% ou 16%,
  nenhuma**; com o "outros" (a devolução, cujo acumulador não tem a presunção, e entra negativa), 2.
- A soma das receitas por percentual contra a receita bruta do `faturamento.sql` do trimestre: **bate em 7 de 8**; a
  8ª tem a apuração trimestral e nenhuma nota no trimestre (as duas somas zero ou nulas).
- A presunção do acumulador vezes a receita contra a base do IRPJ da apuração: **a mesma em 5 de 7** (em 4, até
  R$ 1,00; na 5ª, a menos de 0,0002%). Na que tem devolução, a base é a presunção vezes a receita **sem** tirar a
  devolução (o acumulador da devolução não tem a presunção): o Domínio não tirou a devolução da base do IRPJ dela.
- **As 2 que não batem.** Uma é **a matriz que apura com as filiais**: a receita da apuração dela fica bem acima da
  das notas dela e é igual à soma das notas das 3 empresas da mesma raiz de CNPJ — como no Simples. As 2 filiais dela
  têm a linha do IRPJ com a base de cada uma e a receita (`vcos_sim`) zerada. A outra (a trimestral sem nota no
  trimestre) tem a base sem a receita e é de uma raiz em que outra empresa tem a receita na apuração: parece uma
  filial, mas sem nota no trimestre a base dela não sai das notas — fica a conferir no Domínio.

### O que o Claude da sessão do Samuel decide
1. A presunção do Comparativo pela do acumulador (o que o escritório aplica nota a nota), e a apuração do Domínio só
   pra conferir — a apuração não separa o percentual. O 32% ainda não foi visto numa apuração.
2. **A matriz e as filiais.** A apuração do IRPJ e da CSLL é da pessoa jurídica (a raiz do CNPJ): a linha da matriz
   tem a receita e a base de todas, e a da filial repete a base dela, sem a receita. Somar as linhas das empresas da
   mesma raiz conta a filial duas vezes; o Comparativo deve olhar a raiz e ficar com a linha da matriz.
3. A mistura mensal/trimestral: o contrato leva o `apuracao_trimestral`, ou só a soma do trimestre.
4. A devolução sem a presunção no acumulador: no Domínio ela não sai da base do IRPJ; o Comparativo segue o Domínio ou
   a lei (a receita bruta menos as devoluções).

## 5. O resultado da contabilidade (a DRE)

### `comparativo_resultado.sql` (4,1 s, 74 empresas)
- `bethadba.ctlancto`, `bethadba.ctcontas` (a classificação; a descrição só no filtro) e `bethadba.ctnatureza_conta`
  (o plano em que o 3 é credor e o 4 devedor), como no `cruzamentos.sql`. Fora o zeramento (`orig_lan` 2). A empresa
  é a do lançamento (`codi_emp`).
- **As contas de resultado**, pelo plano modelo do escritório (a empresa modelo, sem movimento — só os grupos dela foram
  lidos): o 3 (custos e despesas), o 4 (receitas) e o 5.1 (os custos dos produtos, dos serviços e das mercadorias
  vendidos — no modelo, o custo do vendido fica no grupo 5, "Contas de apuração"); fora o 5.1.4 (a apuração do resultado
  do exercício, o destino do zeramento) e o 6 (compensação). O 4.1.3 são as receitas financeiras (o 3.1.3 no plano
  invertido).
- **As contas do IRPJ e da CSLL**, pela descrição dentro do filtro (IRPJ, IMPOSTO DE RENDA, CSLL, CONTRIBUIÇÃO SOCIAL),
  fora as de pessoal (o 3.2.1 e o 3.2.2.01). Nos planos de verdade:

| onde | IRPJ: planos com a conta / usando nos 12 meses | CSLL |
|---|---:|---:|
| 4.1.2.03 (as deduções da receita) | 306 / 6 | 306 / 6 |
| 3.1.2.03 (o mesmo, no plano invertido) | 2 / 1 | 2 / 1 |
| 3.2.2.03 (a provisão) | 9 / 0 | 6 / 0 |
| 4.1.2.04 | 7 / 0 | 7 / 0 |

  O escritório lança o IRPJ e a CSLL do Presumido como dedução da receita, não como provisão. A "contribuição social"
  do 3.2.1.01 (1 plano, sem uso) é encargo de pessoal e ficou fora.

### A conferência (o zeramento de 2025)
A soma de `resultado_antes_ir − irpj_csll_lancados` dos 12 meses de 2025 contra o valor do zeramento do ano (o débito
menos o crédito do zeramento nas contas de resultado), até R$ 1,00, nas empresas com lançamento em conta de resultado
em 2025:

| | ativas | inativas |
|---|---:|---:|
| bate (sem lançamento depois do zeramento) | 29 | 11 |
| bate (com lançamento entrado depois do zeramento) | 2 | 1 |
| não bate (todas com lançamento entrado depois) | 4 | 0 |
| sem zeramento em 2025 | 36 | 8 |

- **Onde não bate**: nas 4, entraram lançamentos do ano depois do zeramento. Refeita a conta só com o que entrou até o
  zeramento, 1 das 4 passa a bater. O que entrou depois, nas contas de resultado das 4: a escrita fiscal (as origens 5
  e 6, 20.979 lançamentos; 7 e 10, 55), a folha (13, 21), o extrato (39, 12) e o normal (1, 7). Nas outras 3, parte do
  que o zeramento zerou foi apagado e lançado de novo (a escrita fiscal integrada outra vez): o banco não guarda o que
  foi apagado, e a conta não se refaz.

### As contagens (10/2025 a 09/2026, as empresas ativas)
| mês | 10/25 | 11/25 | 12/25 | 01/26 | 02/26 | 03/26 | 04/26 | 05/26 | 06/26 | 07/26 | 08/26 | 09/26 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| com `lanc_resultado` > 0 | 67 | 68 | 68 | 64 | 69 | 71 | 69 | 70 | 72 | 71 | 73 | 73 |

- Com lançamento em conta de resultado em algum mês, 84; **nos 12 meses, 51.**
- Plano sem nenhuma conta de IRPJ ou CSLL (não dá pra separar): **3** das 84.

### O que o Claude da sessão do Samuel decide
1. O 5.1 (o custo do vendido) entra no resultado, como no modelo: confirmar com a Adaini que nenhuma empresa usa o 5
   pra outra coisa.
2. O IRPJ e a CSLL pela descrição da conta (o escritório usa as deduções, não a provisão). Nos 3 planos sem a conta, o
   `irpj_csll_lancados` sai zero.
3. O resultado é o da empresa do lançamento (a matriz, que tem a contabilidade); o `cruzamentos.sql` conta a receita
   na filial da nota. Pro Lucro Real, que é da pessoa jurídica inteira, vale a matriz.
4. O mês com `lanc_resultado` zero é a contabilidade não feita: o Comparativo não deve ler esse mês como lucro zero.

## 6. O que fica pesado
Nada: o rascunho mais demorado leva 4,1 s por mês. Os seis juntos, ~20 s por mês; numa rodada de 14 meses, uns 5
minutos a mais. A conferência de um ano inteiro de lançamentos (o zeramento) levou 11 s.
