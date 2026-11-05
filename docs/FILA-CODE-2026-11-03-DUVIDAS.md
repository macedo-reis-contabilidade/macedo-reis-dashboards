# Fila de 03/11/2026 — o faturamento, as compras e a folha em reais: o que se achou

> Escrito pelo Code do PC do escritório em 04/11/2026, na branch `fila-03-11`. Os rascunhos estão em
> `ponte/rascunhos/` (`faturamento.sql`, `compras.sql`, `folha_valores.sql`), que a ponte **não lê**: o contrato, a
> função e as tabelas do sistema não mudaram. Os números são **do escritório inteiro** ou contagens. Valor de uma
> empresa não aparece: quando um grupo tem menos de 3 empresas, fica só a contagem.
> Os tempos são com `--mes 2026-09`, o rascunho inteiro rodando dentro de uma consulta que só conta (o `dominio sql`
> mostra as linhas, e a linha de cada empresa não pode aparecer aqui).

## 1. A rodada das 7h

- `Get-ScheduledTaskInfo 'Ponte Domínio'`: `LastRunTime 04/11/2026 09:06:06`, `LastTaskResult 0`,
  `NextRunTime 05/11/2026 07:00:00`.
- O log: `rodada da ponte 0.2.0: 14 mes(es), dados até 04/11/2026` ·
  `lido: 474 empresa(s) (119 ativa(s)), 6636 linha(s) mensal(is) de 2025-10 a 2026-11` ·
  `rodada b59c7f57: foi (HTTP 200)`.
- A tarefa rodou às 9h06, não às 7h. O PC ficou suspenso de 03/11 16h41 a 04/11 09h03 (Kernel-Power 42 e 187, e o
  Power-Troubleshooter 1 da volta). A tarefa tem "executar assim que possível" (`StartWhenAvailable`) e não tem
  "acordar o computador" (`WakeToRun`), então rodou quando o PC voltou. A Ponte Receita, das 8h30, também rodou às 9h06.
  **Nada foi mudado.** Fica pro Samuel decidir: ligar o "acordar o computador" nas duas tarefas, ou não deixar o PC
  suspender na tomada.

## 2. O faturamento (`ponte/rascunhos/faturamento.sql`, 4,2 s)

### As tabelas e as colunas (com a descrição do catálogo)
- `bethadba.EFACUMULADOR_VIGENCIA` ("Acumuladores - Cadastro"): `CODI_EMP`, `CODI_ACU`, `VIGENCIA_ACU` ("Vigencia"),
  `IFAT_ACU` ("Incide sobre Faturamento (S/N)"), `IREC_ACU` ("Incide sobre Receita Bruta (S/N)"), `IDEV_ACU`
  ("Incide sobre Devolucao (S/N)"). Vale a vigência mais recente até o fim do mês.
- `bethadba.EFACUMULADOR_VIGENCIA_IMPOSTOS` ("Acumuladores - Cadastro - Impostos", só na conferência):
  `SIMPLESN_ANEXO_IAC`, `SIMPLESN_SECAO_IAC`, `SIMPLESN_TABELA_IAC` ("Simples Nacional - Anexo/Secao/Tabela") e
  `SIMPLESN_ICMS_IAC`, `SIMPLESN_PIS_IAC`, `SIMPLESN_COFINS_IAC` ("SIMPLES NACIONAL - SITUACAO ICMS/PIS/COFINS").
- `bethadba.efsaidas` / `bethadba.efservicos` / `bethadba.efentradas`: `codi_acu` ("Acumulador"), `dsai_sai`
  ("Data de saida"), `dser_ser` ("Data do servico"), `dent_ent` ("Data de entrada"), `vcon_sai`/`vcon_ser`/`vcon_ent`
  ("Valor contabil"), `situacao_*` (2 a 5 = cancelada, denegada, inutilizada, como no `fiscal.sql`) e
  `cancelada_sai`/`cancelada_ser`.
- `bethadba.efsdoimp_simples_nacional` ("Saldo dos Impostos - Detalhamento do Simples Nacional"): `codi_emp`,
  `codi_imp` ("Imposto"; 44 = SIMPLESN no `bethadba.geimposto`), `data_sim` ("Competencia"), `filial` ("Codigo da
  filial"), `anexo`, `secao`, `tabela`, `basen` ("Base de calculo"), `aicms`, `apis`, `acofins` ("Aliquota do
  ICMS/PIS/COFINS", a partilha da linha), `TIPO_RECEITA` ("1- Mercado Interno / 2- Exportação"); na conferência,
  `faixa` ("Faixa de enquadramento") e `ALIQUOTA_EFETIVA_CALCULADA` ("Alíquota Efetiva Calculada").
- `bethadba.efsimples_nacional_receita_bruta_anterior` ("Simples Nacional - Valores da Receita Bruta dos periodos
  anteriores"): `codi_emp`, `periodo`, `valor` ("Valor de receita bruta").
- Só na conferência do Presumido e do Real: `bethadba.efsdoimp` ("Saldo dos Impostos": `bcal_sim` "Base de calculo do
  imposto", `vcos_sim` e `vcov_sim` "Valor contabil de saidas/servicos").

### Os acumuladores (vigentes em 09/2026, do escritório inteiro)
| faturamento | receita bruta | devolução | acumuladores | empresas | usados em 09/2026 |
|---|---|---|---|---|---|
| N | N | N | 7.328 | 334 | 222 |
| S | S | N | 3.300 | 338 | 124 |
| S | S | S | 510 | 220 | 3 |
| N | N | S | 266 | 133 | 15 |
| S | N | N | 27 | 24 | 1 |
| N | S | N | 6 | 6 | 0 |

(Nenhum vigente marca transferência de crédito.) O acumulador do Simples diz o anexo, a seção e a tabela do PGDAS e a
situação de cada tributo; nos usados de 10/2025 a 09/2026: anexo I seção 1 com o ICMS na situação 0 (55), R (6) e
I (1); anexo I seção 2 com o ICMS 5 (25, 3 deles também com o PIS e a Cofins 6); anexo I seção 2 tabela 4 com o ICMS
5 e o PIS e a Cofins 6 (3); tabela 7 com só o PIS e a Cofins 6 (2); anexo II seção 2 tabela 9 com o ICMS 5 (6).
O significado dos códigos 5, 6, R e I não está no catálogo: pela partilha zerada (abaixo), 5 = ST e 6 = monofásico.

### A regra e a conferência dentro do Domínio
- **A receita bruta = notas de saída e de serviço com acumulador de faturamento (`IFAT_ACU = 'S'`) menos as entradas
  com acumulador de devolução (`IDEV_ACU = 'S'`).** Contra a base da apuração do Simples de 09/2026, até R$ 1,00, por
  empresa: faturamento menos devolução, 70 de 71; receita bruta (`IREC`) menos devolução, 69; faturamento sem tirar a
  devolução, 67; receita bruta sem tirar, 66. O `IFAT` é o que bate.
- **O anexo 0 é o total dos anexos 1 a 5.** A primeira soma usou todas as linhas e deu quase o dobro.
- **A empresa que não batia apura com as filiais.** A apuração fica na matriz, com uma linha por estabelecimento
  (`filial` = o código do estabelecimento no Domínio), e as notas da filial estão no código dela. Por linha de
  estabelecimento, batem as 77 linhas: as 71 da própria empresa e as 6 de filial (em 4 matrizes; 5 delas com base
  zero). No rascunho, `receita_simples` soma os estabelecimentos (como o PGDAS) e `receita_simples_propria` é a linha
  do próprio código: **71 de 71 batem com a `receita_bruta`**, e 1 empresa tem as duas diferentes (a que tem filial com
  movimento).
- **A devolução** das notas (`IDEV`) é a mesma da apuração (`VALOR_DEVOLUCAO_VENDA`): 16.839,34 no escritório.
- Os totais de 09/2026: a `receita_bruta` de 82 empresas (todos os regimes) soma 5.209.505,87; a apuração do Simples
  (71 empresas), 4.518.453,89; as devoluções, 18.039,34. O valor contábil das saídas e dos serviços, que a ponte manda
  hoje, soma 8.882.095,89: **o faturamento é perto de 59% do valor contábil.**
- **O RBT12 não fica gravado.** O rascunho calcula, mês a mês nos 12 meses antes: a receita anterior informada, se tem,
  senão a apuração (anexo 0, todos os estabelecimentos). Com menos de 12 meses, a média vezes 12. Conferido com a
  alíquota efetiva que o Domínio gravou (RBT12 = parcela a deduzir ÷ (nominal − efetiva), nas linhas da 2ª à 6ª faixa,
  as únicas em que dá pra inverter): das 41 empresas conferíveis, **40 batem até R$ 5,00** com a soma dos 12 meses, e
  a outra, com menos de 12 meses, bate pela média vezes 12. Com a apuração antes da receita anterior, batem 38. Só com
  a apuração, batem 36. Das 71, 66 têm os 12 meses e 5 têm menos (`meses_rbt12`).
- **A receita com ST, a monofásica e a de exportação, pela partilha zerada na linha da apuração.** De 10/2025 a
  09/2026, linhas com base:

| anexo · seção · tabela | empresas | linhas | ICMS zerado | ISS zerado | PIS e Cofins zerados | leitura |
|---|---|---|---|---|---|---|
| I · 1 · 1 | 52 | 434 | 11 | 434 | 0 | revenda sem ST (os 11: o ICMS isento, provável Simples Gaúcho) |
| I · 2 · 1 | 24 | 191 | 191 | 191 | 16 | revenda com ST (os 16: ST e monofásico) |
| I · 2 · 4 | 3 | 16 | 16 | 16 | 16 | ST e monofásico |
| I · 2 · 7 | 3 | 17 | 0 | 17 | 17 | monofásico sem ST |
| II · 1 · 1 | 5 | 38 | 0 | 38 | 0 | indústria sem ST |
| II · 2 · 9 | 6 | 67 | 67 | 67 | 0 | indústria com ST |
| III · 3 · 1 e 3 · 2 | 9 e 19 | 75 e 140 | todas | 0 | 0 | serviço (o ISS no DAS) |
| III · 4 · 1 e 4 · 2 | 2 e 8 | 2 e 33 | todas | todas | 0 | serviço sem o ISS no DAS (retido ou fora) |
| III · 7 · 1 e V · 1 · 4 | 1 e 2 | 10 e 14 | todas | todas | todas | exportação (tipo de receita 2) |
| IV (4 combinações) | 1 cada | 45 | todas | parte | 0 | a CPP zerada em todas (fora do DAS) |
| III · 5 · 1, III · 6 · 1, III · 9 · 1 e 9 · 2, V · 1 · 1 | 1 ou 2 cada | 64 | parte | parte | 0 | outros serviços (a III · 5 · 1, com o ICMS e sem o ISS, é transporte) |

  Em 09/2026, 22 empresas com receita com ST, 6 com monofásica e 2 com exportação.
- **Presumido e Real** (de 07 a 09/2026, `bethadba.efsdoimp`): não há uma tabela com a receita bruta. O PIS (4) e a
  Cofins (5): 21 linhas de 8 empresas; o valor contábil das saídas da linha bate com o faturamento dos acumuladores em
  17; a base, com o faturamento menos a devolução em 6 (7 têm base zero, e o resto sai com as exclusões, como o ICMS
  da base). O IRPJ (7): a base é 8% do faturamento menos a devolução em 8 de 13 linhas; a CSLL (6): 12% em 8 de 13. Ou
  seja, a `receita_bruta` do rascunho é a receita sobre a qual o Presumido aplica a presunção.

### O que fica de fora
- O RBT12 pronto (é calculado) e a receita do Presumido e do Real numa tabela própria.
- A filial que não apura: no código dela, a `receita_bruta` tem as notas dela e as colunas do Simples vêm nulas. A
  apuração dela está na matriz.

### O que o Claude da sessão do Samuel decide
1. Qual receita vai pro contrato: a `receita_bruta` (todas as empresas, pelos acumuladores) e, no Simples, a
   `receita_simples` (a do PGDAS, com as filiais). O rascunho manda as duas.
2. Se a receita com ST, a monofásica e a de exportação entram do jeito do rascunho, pela partilha zerada. Pra
   confirmar, dá pra comparar com o PGDAS de uma empresa, que separa "com substituição tributária" e "tributação
   monofásica" (o caso da Reforma tem o PGDAS lido).
3. Se a divisão por anexo (`receita_anexo_1` a `_5`) entra. Ela não estava pedida, e diz ao Comparativo se é comércio,
   indústria ou serviço.
4. O RBT12 proporcional vale pra empresa no primeiro ano. Com mês faltando por outro motivo, ele sairia proporcional
   também. O `meses_rbt12` diz quantos meses entraram, e só 1 das 5 empresas com menos de 12 meses deu pra conferir
   (as outras estão na 1ª faixa).

## 3. As compras (`ponte/rascunhos/compras.sql`, 3,0 s)

### Pelo CFOP, não pelo acumulador
O acumulador das entradas não diz se a entrada é compra pra revenda, imobilizado ou uso e consumo. Ele tem a marca de
devolução (`IDEV_ACU`), as do frete (`FRETE_ACU`, `NATUREZA_FRETE_ACU`), a de serviço terceirizado (`SERVTERC_ACU`), o
CST do PIS e da Cofins da entrada e uma marca de entrada de mercadoria pro Simples de um decreto estadual
(`SIMPLESN_ENTRADAS_ACU`), mas nenhuma que separe. O CFOP separa. Na `bethadba.efentradas`, a coluna `codi_nat`
("Natureza") é o CFOP de 4 dígitos (na fila das notas: 2.605 de 2.605 segmentos de 09/2026 entre 1000 e 3999).

As entradas de 09/2026 por grupo do CFOP (os três primeiros dígitos), no escritório:

| grupo | o que é | empresas | linhas | valor contábil |
|---|---|---|---|---|
| 1.90x | outras entradas (remessa, retorno) | 7 | 147 | 2.752.365,83 |
| 1.10x | compra pra industrialização ou revenda | 45 | 1.385 | 1.488.474,10 |
| 1.40x | compra com ST | 28 | 572 | 728.682,81 |
| 2.10x | compra de fora do estado | 24 | 188 | 502.247,43 |
| 1.91x | remessa e retorno | 27 | 161 | 176.984,45 |
| 2.91x | remessa e retorno, de fora do estado | 10 | 36 | 117.169,92 |
| 1.65x | combustível | 16 | 165 | 67.267,06 |
| 1.55x | imobilizado e uso e consumo | 11 | 43 | 53.621,92 |
| 1.12x | venda à ordem e industrialização por outra | 3 | 3 | 40.496,16 |
| 2.35x | transporte (CT-e), de fora do estado | 13 | 1.230 | 29.998,12 |
| 1.93x | serviço tomado | 4 | 14 | 25.189,63 |
| 2.40x | compra com ST, de fora do estado | 8 | 12 | 20.213,96 |
| 1.35x | transporte (CT-e) | 13 | 427 | 19.545,92 |
| 2.55x | imobilizado e uso e consumo, de fora | 4 | 8 | 9.102,65 |
| 1.94x | outras | 10 | 26 | 3.911,98 |
| 1.92x, 2.94x, 2.20x, 1.20x, 1.11x, 2.93x | — | 1 ou 2 cada | 36, 818, 45, 7, 1, 2 | (menos de 3 empresas) |

### A regra (os três dígitos finais do CFOP)
- `compras` = 101, 102, 111, 113, 116 a 118, 120 a 122, 124 a 126, 128, 401, 403, 651 e 652 (revenda,
  industrialização, consignação, entrega futura, venda à ordem, industrialização por outra empresa, as mesmas com ST e
  o combustível pra revenda ou industrialização). `compras_st` = 401 e 403, já dentro de `compras`.
- `servicos_tomados` = 250 a 257 (energia), 300 a 306 (comunicação), 350 a 360 (transporte, o CT-e do frete) e 930 a
  933 (o serviço do ISS).
- `ativo_e_consumo` = 406, 407 e 551 a 557. Não estava pedida: fica pro crédito da Reforma, que dá crédito no uso e
  consumo.
- `devolucoes_de_venda` = 201 a 209, 410, 411 e 660 a 662. `outras_entradas` = o resto.

### A conferência (09/2026)
- 56 empresas com entrada. `compras` em 48 (2.797.830,28), das quais com ST em 30 (748.474,77); serviços tomados em 21
  (79.195,05); ativo e consumo em 15 (63.146,57); devoluções de venda em 3 (16.839,34); outras em 41 (3.525.007,51).
  As colunas somam o valor contábil das entradas do escritório (6.482.018,75).
- A devolução pelo CFOP bate com a do acumulador (`IDEV_ACU`) em 55 de 56 empresas. Na outra, o acumulador marca como
  devolução uma entrada com CFOP de outro grupo.

### A empresa de código 326 em 09/2026 (só contagens)
| espécie | modelo | emitente | grupo do CFOP | notas |
|---|---|---|---|---|
| 43 CT-e | 57 | terceiro | 2.35x | 950 |
| 36 NF-e | 55 | a própria empresa | 2.94x | 816 |
| 43 CT-e | 57 | terceiro | 1.35x | 323 |
| 36 NF-e | 55 | a própria empresa | 2.20x | 44 |
| 36 NF-e | 55 | terceiro | 2.10x | 17 |
| 36 NF-e | 55 | terceiro | 2.55x | 5 |
| 36 NF-e | 55 | a própria empresa | 1.20x | 4 |
| 36 NF-e | 55 | a própria empresa | 1.94x | 4 |
| 36 NF-e | 55 | terceiro | 1.10x | 3 |
| 36 NF-e | 55 | terceiro | 1.91x | 1 |

As 2.167 do Domínio são 1.273 CT-e de frete (a empresa é a tomadora), 868 NF-e de entrada emitidas pela própria
empresa e 26 NF-e de fornecedor. As 899 do sistema ficam perto das 868 + 26 = 894: o importador dos XML conta como
entrada a NF-e de entrada que a empresa emite (tpNF 0) e não importa CT-e. As 5 que sobram (nota cancelada, ou de
outro mês pela data de emissão) ficam pra conferir no sistema. Compra mesmo, em 09/2026, são só as 3 de 1.10x e as
17 de 2.10x.

## 4. A folha em reais (`ponte/rascunhos/folha_valores.sql`, 4,6 s)

### Os tipos de cálculo e o rateio
- `bethadba.fobasesserv` ("Bases - Calculo"): `codi_emp`, `i_empregados`, `competencia` ("Competencia"),
  `tipo_process` ("TIPO DE CALCULO"), `proventos` ("Proventos"), `descontos`, `rateio` ("Rateio"), `SIMULACAO`
  ("Simulação de cálculo. (0=Não/1=Sim)"), `I_CALCULOS` ("Código sequencial de calculos").
- Os códigos, pelas descrições de outras tabelas do catálogo: 11 Mensal, 41 Adiantamento, 42 Complementar, 51
  Adiantamento 13º salário, 52 13º salário, 61 Férias, 70 Participação de lucros. O 60 não tem descrição, e todos os
  60 e 61 de 09/2026 são de quem estava de férias no mês. De 10/2025 a 09/2026 há 3.956 cálculos 11, 882 do 41, 21 do
  42, 197 do 51, 186 do 52 e 454 de 60 e 61.
- **O rateio repete o cálculo.** No 11 e no 42, cada pessoa tem duas linhas (rateio 0, o cálculo inteiro, e rateio 1,
  o pedaço do serviço), com os mesmos valores. `bethadba.FOBASESSERV_CALCULOS_RATEIO_SERVICO` liga o inteiro aos
  pedaços. Os tipos 41, 51 e 52 só têm o rateio 0. No 60, o rateio 0 é as férias inteiras e o 1 e o 2 são a parte de
  cada mês; o 61 repete o 1 e o 2 do 60. O rascunho lê só o rateio 0, e a primeira soma, sem esse corte, deu o dobro.
  A consulta pela tabela do rateio leva 4 minutos (sem índice no `I_CALCULOS_RELACIONADO`), por isso o rascunho usa o
  `rateio = 0` e não ela.
- **As férias do mês já estão no mensal.** Dos 454 meses com parte de férias (61), 173 têm o mensal na mesma
  competência. Em 172 deles, o mensal tem a base do INSS de férias (10), e em 157 ela é igual à parte do mês. Em 173,
  os proventos do mensal são maiores que a parte, e em 116 são iguais às bases 9 + 10. Por isso o rascunho não soma o
  60 nem o 61: `ferias` é a base 10 do mensal, já dentro de `salarios`. Os outros 281 meses de férias não têm mensal na
  mesma competência do 61. Não muda o rascunho, que não lê o 61, mas fica pra conferir.
- **A rescisão é o mensal.** `bethadba.forescisoes` ("Rescisao - Calculo": `demissao`, `proventos` "Provento",
  `tipo` "1=Normal/2=Complementar/3=Parcial/4=Simulação", `I_CALCULOS`): das 164 rescisões normais de 10/2025 a
  09/2026, 157 têm o `I_CALCULOS` de um cálculo 11 do mesmo mês com os mesmos proventos, e as 20 complementares são
  cálculos 42. `rescisoes` fica dentro de `salarios`. As 7 normais sem cálculo na folha ficam de fora.
- **O 13º é o 52.** Em 12/2025, 186 cálculos 52, 183 de quem teve o adiantamento (51) no ano: em 183 de 183, os
  descontos do 52 cobrem o adiantamento. Os proventos do 52 são o 13º inteiro, e o 51 não se soma.

### As bases e os encargos
- `bethadba.focalculosbases` ("Calculos - Bases de calculos": `I_CALCULOS`, `i_cadbases` "Base de Calculo", `base`
  "Valor da base de calculo", `valor` "Valor"), com o nome em `bethadba.focadbases` (`descricao`): 9 INSS Mensal, 10
  INSS Férias, 11 INSS 13o., 15 FGTS Mensal, 16 FGTS Férias, 17 FGTS 13o. Há também as do INSS da empresa (-6 a -11,
  "Inss empresa - mensal/férias - Valor de inss/terceiros/acid. de trab"; -86 e -87, "sem desoneração"), a do
  pró-labore (-20) e a da multa do FGTS na rescisão (-18).
- Os encargos saem das guias do mês, que são o total pago por filial e tipo: `bethadba.foguiainss` ("Guia de INSS":
  `competencia`, `empresa` "Valor inss empresa", `acid_trab` "Valor RAT", `terceiros` "Valor de terceiros do mes") e
  `bethadba.fofgtsfilial` ("Valor de fgts por filial": `competencia`, `total_fgts` "Total de fgts do mes").
- O empregado e o sócio pela categoria do `bethadba.foempregados` (`CATEGORIA_ESOCIAL_EMPREGADO`, `CATEGORIA_ESOCIAL`),
  como no `folha.sql`.

### A conferência (só o escritório inteiro)
| | 09/2026 | 12/2025 |
|---|---|---|
| empresas com cálculo (11, 42 ou 52) | 86 | 82 |
| com empregados / com pró-labore | 48 / 76 | 47 / 71 |
| com férias / rescisão / 13º | 7 / 11 / 0 | 28 / 7 / 44 |
| com a guia do FGTS · bate com 8% da base até R$ 1 · a guia menor · a guia maior | 47 · 39 · 8 · 0 | 44 · 41 · 3 · 0 |
| base do INSS dentro dos proventos (salários + 13º) · igual | 48 · 16 | 47 · 14 |
| base do FGTS igual à do INSS | 43 | 2 |
| com a guia do INSS · com INSS da empresa | 84 · 14 | 82 · 12 |
| proventos dos empregados (`salarios`) | 736.939,38 | 556.335,40 |
| dos quais férias · rescisões | 13.516,54 · 67.332,19 | 174.353,50 · 75.275,66 |
| 13º | — | 334.007,19 |
| pró-labore | 206.346,17 | 177.544,50 |
| base do INSS · base do FGTS | 659.043,59 · 663.777,15 | 812.472,13 · 639.564,13 |
| FGTS das guias | 51.697,15 | 49.851,21 |
| INSS da empresa · RAT · terceiros | 23.975,70 · 1.801,86 · 3.503,65 | 12.815,27 · 701,63 · (menos de 3) |

- A guia do FGTS menor que 8% da base é provavelmente o aprendiz, que recolhe 2%. Não há a guia maior.
- A base do INSS é menor que os proventos na maioria das empresas: os proventos trazem o que não incide (o
  salário-família, o aviso indenizado…).
- Em 12/2025, a base do FGTS fica abaixo da do INSS: o INSS do 13º vai todo na competência de dezembro, e o FGTS da 1ª
  parcela já foi na competência dela (provável).
- Só 14 empresas têm o INSS da empresa na guia: as outras são do Simples dos anexos I a III, que pagam a CPP no DAS.

### O que fica de fora
- O adiantamento salarial (41) e o do 13º (51), já descontados no 11 e no 52. A participação nos lucros (70) e o
  autônomo (RPA, `bethadba.focontrrpa`, com 1 linha).
- A CPRB de quem está na desoneração. Ela é paga sobre a receita, não sai na guia do INSS, e as tabelas do INSS sobre a
  receita bruta (`EFSDOIMP_INSS_RB_*`) têm 13 linhas.
- O INSS descontado do empregado (não é custo da empresa) e a base do INSS do pró-labore.
- As 7 rescisões sem cálculo na folha.

### O que o Claude da sessão do Samuel decide
1. `salarios` já traz as férias e as rescisões do mês, como o próprio Domínio. Pra o Fator R e o Comparativo, a folha
   é `salarios + decimo_terceiro + pro_labore_valor` e os encargos. As duas colunas "das quais" são informativas. Se o
   contrato preferir as partes separadas, é só tirar `ferias` e `rescisoes` de `salarios`.
2. O FGTS e o INSS pelas guias (o que foi pago) ou pelas bases (o calculado por pessoa). O rascunho usa as guias.
3. Um cuidado: a trava do `dominio sql` não mostra coluna com nome que começa por "salar". Pra rodar o rascunho por
   ele, embrulhe numa contagem, como aqui. Pela ponte (a `FonteDominio`), a trava não vale.
