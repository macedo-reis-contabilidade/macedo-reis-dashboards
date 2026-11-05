# Fila de 05/11/2026 · por que a receita e a folha lançadas não batem · achados, dúvidas e o que a sessão do Samuel decide

> Do Code do PC do escritório, branch `fila-05-11-diferencas`. Só contagens do escritório inteiro: o que é por empresa
> ficou em `C:\ponte-dominio\dif\` (fora do repositório), e grupo com menos de 3 empresas aparece só com a contagem.

## Como foi feito
- **A base** é o pacote da ponte 0.3.0 rodado com `--sem-enviar` nos 14 meses (os mesmos números que o sistema compara),
  gravado sem nome nem documento em `C:\ponte-dominio\dif\` (`empresas.csv`, `mensal.csv`, `receita-difere.csv`,
  `folha-difere.csv`); o pacote com os nomes foi apagado depois.
- As causas foram procuradas no Domínio, só com contagens e somas por empresa e mês (as consultas e as saídas em
  `C:\ponte-dominio\dif\receita\`, `folha\`, `mudou\`, `rascunho\` e `conferencia\`). A consulta mais cara foi a
  decomposição da receita (11,7 a 16,0 s por mês: a vigência dos acumuladores, com o MAX correlacionado, lida 5 vezes);
  as outras ficaram de 0,3 a 8,7 s. Nenhuma passou de 60 s.
- **Uma conferência à parte** refez por outro caminho as contagens dos itens 1.1 e 2.1, as causas principais e o
  rascunho, e procurou dado sensível nos resultados (não achou). O que ela corrigiu nas frases das etapas está aqui já
  corrigido (no fim, "O que a conferência acertou").
- **O recorte**: aqui entram **todas as empresas e todos os meses** de 10/2025 a 09/2026, não só os meses que a Adaini
  marcou como feitos (o sistema só avisa nesses). Por isso 2026 aparece bem mais que o "quase nada" da primeira leitura
  (item 1.3).

## 1. A receita

### 1.1 A contagem
- **815 empresa-meses** com `receita_bruta` > 0 e lançamento da escrita fiscal no mês (a `orig_lan` de 4 a 9, 11 e 21 a
  29); **136 diferentes** em mais de R$ 1,00, de **39 empresas**: **47 em 2025** (10 a 12) e **89 em 2026** (01 a 09);
  **48 com o contábil maior** e **88 com o fiscal maior**.
- Por mês: 10/25 15 · 11/25 17 · 12/25 15 · 01/26 6 · 02/26 10 · 03/26 10 · 04/26 9 · 05/26 7 · 06/26 9 · 07/26 10 ·
  08/26 11 · 09/26 17.
- Pela taxa, que é o que compara os períodos (2025 tem 3 meses, 2026 tem 9): 23% em 10–12/2025 (47 de 203), 13% em
  01–06/2026 (51 de 403) e 18% em 07–09/2026 (38 de 209; 09/2026, o mês mais recente, ainda integrando).
- Ressalvas: 20 dos 136 não têm linha no cruzamento (a receita lançada nula conta como 0, "o contábil sem"); sem eles,
  seriam 116. A regra é estável no limite: 136 com R$ 0,50 e com R$ 1,01, 135 com R$ 5,00.

### 1.2 A primeira causa de cada um

| | Causa | Casos | Empresas | 2025 | 2026 | Lado |
|---|---|---|---|---|---|---|
| a | A nota de saída ou de serviço do mês, com acumulador de faturamento, sem lançamento contábil | 31 | 16 | 18 | 13 | o fiscal maior em todos |
| b | A filial lançada na matriz (a contabilidade centralizada) | 3 | 1 | 0 | 3 | o contábil maior |
| c | A devolução: no fiscal e não no contábil, ou noutra conta (e o contrário) | 61 | 15 | 17 | 44 | 33 o fiscal maior, 28 o contábil maior |
| d | A integração noutra conta de receita, fora do `41101`/`41102` | 0 | — | — | — | — |
| e | O plano com as receitas no grupo 3 (o 3 credor e o 4 devedor) | 11 | 1 | 3 | 8 | o fiscal maior |
| f | O mês: a nota de um mês lançada noutro | 3 | 2 | 1 | 2 | 2 o contábil maior, 1 o fiscal |
| g | O lançamento manual (a origem 1) nas contas de receita | 1 | 1 | 0 | 1 | o contábil maior |
| h | O resto (nenhuma de a a g sozinha) — todos com causa, abaixo | 26 | 15 | 8 | 18 | 14 o contábil maior, 12 o fiscal |
| | **Total** | **136** | **39** | **47** | **89** | 48 / 88 |

- **a. A nota sem lançamento (31, 16 empresas).** A nota do mês que o `faturamento.sql` conta (o acumulador de
  faturamento, fora a situação 2 a 5 e a cancelada) sem nenhum lançamento ligado (`efsaidas_lancto`/`efservicos_lancto`,
  com o lançamento conferido na `ctlancto`); fecha quando a receita lançada mais as notas sem lançamento dá a receita
  bruta (até R$ 1,00). Em 18 dos 31 as saídas do mês inteiro estão sem integração (a receita lançada é 0): 12 em 2025, de
  6 empresas, e 6 em 2026. Somados: 3.177 das 15.578 notas do mês sem lançamento, e a diferença é 58,1% da receita deles.
  Nenhuma ligação órfã (nenhum lançamento apagado depois de integrado) e nenhuma nota com o lançamento noutra empresa; a
  apuração do Simples bate com o fiscal nos 31. **É problema de verdade.**
- **b. A filial na matriz (3, 1 empresa, só em 2026).** Uma matriz integra no contábil dela as notas de 2 filiais
  (a `ctlancto.fili_lan` é a empresa da nota em 100% dos créditos integrados dos 12 meses); somar as notas pela empresa
  da nota fecha os 3. As filiais não têm escrita fiscal própria e ficam fora da população. Se a centralização é de
  propósito, só a Adaini sabe.
- **c. A devolução (61, 15 empresas).** Dois padrões opostos, nos dois períodos (só o "trocar a devolução do contábil
  pela do fiscal" fechou casos):
  - **O fiscal maior (33, 8 empresas): a devolução de compra lançada como devolução de venda.** Em 31 casos, de 7
    empresas, são 65 notas de saída de devolução de compra (naturezas 5.2xx, 5.4xx, 5.9xx e 6.2xx, acumulador de
    devolução sem faturamento) integradas a débito do `41201` e a crédito do estoque (`412` > `115`); 1 caso é uma
    entrada sem acumulador de devolução lançada no `41201`, e 1 é misto. O débito no `41201` é a diferença inteira nos 33
    (98,7% dele vem das saídas contra o estoque), e nenhum dos 679 que batem tem esse débito. A apuração do Simples bate
    com o fiscal em 27 de 27 (os outros 6 não apuram). **A DRE deduz da receita o que não é venda: é problema de verdade**,
    que se corrige no acumulador da saída de devolução (o débito deveria ir pra fornecedores), não no cruzamento.
  - **O contábil maior (28, 7 empresas): o `41201` sem nada no mês.** Em 18 deles (6 empresas), as entradas de
    devolução (naturezas 1.2xx e 2.2xx) têm o acumulador de devolução **sem** a marca de faturamento: a apuração do
    Simples e o contábil não as descontam, só o `faturamento.sql` desconta (ele olha só o `IDEV_ACU`). Contar a devolução
    só com as duas marcas (`IDEV_ACU` e `IFAT_ACU`, como a apuração do Simples) fecha os 18 e não quebra nenhum (a "F1",
    abaixo): a `receita_bruta` passa a ser igual à apuração do Simples (a linha própria) em 880 de 880 empresa-meses com
    apuração, contra 864 hoje. Os outros 10: a devolução de venda com acumulador de faturamento **sem lançamento** em 6
    e integrada **fora da receita** em 4 (contra fornecedores ou estoque).
  - A diferença somada dos 61 é 2,70% da receita bruta deles; 37 ficam dentro de 1%.
- **d. Outra conta de receita (0).** Somar as outras analíticas do `411` não muda nenhum empresa-mês; somar a integração
  das notas no `413` a `42` quebra 2 que batem (1 empresa) sem resolver nenhum. O "crédito noutra conta" contado na fila
  de 04/11 era só a presença, não a causa.
- **e. O plano invertido (11, 1 empresa).** Pela `ctnatureza_conta`, 7 planos no Domínio têm o 3 credor e o 4 devedor
  (3 com lançamento nos 12 meses); nesse plano a integração credita o `31101`/`31102`, o espelho do `41101`/`41102`. É a
  mesma empresa nos 11 meses com receita (a receita lançada é 0 em todos); com o grupo pela natureza, fecha em todos.
- **f. O mês (3, 2 empresas).** Pela ligação, a nota de um mês lançada noutro (ou a devolução do mês lançada noutro)
  fecha os 3; o trimestre e o mês vizinho fecham 2 deles.
- **g. O manual (1, de 2026).** O crédito manual (origem 1) na receita fecha; outras origens (extrato, patrimônio,
  honorários) na receita não aparecem em nenhum caso. O que é o manual, só a Adaini sabe.
- **h. O resto (26, 15 empresas).** A decomposição da diferença por origem e pela nota ligada achou três causas novas,
  e com elas **nenhum dos 136 fica sem causa**:
  - **i. A nota cancelada, denegada ou inutilizada depois de integrada, com o crédito ainda na receita**: 11 sozinha, e
    17 ao todo com as combinações, de 10 empresas (8 em 10–12/2025 e 9 em 06–09/2026). A integração não foi refeita
    depois do cancelamento: **problema de verdade**.
  - **j. O valor integrado diferente do valor das notas do mês** (a nota alterada depois de integrada, ou parte do valor
    — IPI, ST — integrada fora do grupo 4): 5, de 4 empresas, todos de 2026. A conferir.
  - **k. O lançamento da integração na receita sem nota ligada** (a nota excluída ou importada de novo depois de
    integrada): 1, de 2026.
  - Os outros 9 fecham só combinando: a+c 3, a+i 2, c+i 2, f+i 1, a+c+i 1 (3 em 2025 e 6 em 2026).
  - A diferença somada dos 26 é 8,74% da receita bruta deles; 9 ficam dentro de 1%. A apuração do Simples bate com o
    fiscal em 21 (os outros 5 não apuram).
- Nenhum caso é fechado por duas causas de a a g ao mesmo tempo: cada um dos 110 explicados tem uma só.

### 1.3 Por que 10 a 12/2025 (e o "quase nada em 2026")
**O que mudou entre os dois períodos foi a integração, não o plano nem os acumuladores.**
- **A integração de 2026 foi gerada de novo em 09/2026, e a de 2025 não.** Pela `dorig_lan` das saídas e dos serviços
  (origens 5 e 7): de 87 empresas com integração dessas notas nos 12 meses, 44 têm algum mês de 01 a 07/2026 entrado
  inteiro em 09/2026, e 42 têm todos esses meses assim (34 começando exatamente em 01/2026); de 10–12/2025, só 6
  empresa-meses entraram em 09/2026. Os dias que mais aparecem na última integração de 01–06/2026: 17/09, 01/09, 16/09 e
  15/09. Em 10–12/2025 diferem 30% dos meses das empresas refeitas, contra 15% das outras; em 01–06/2026, o contrário: 7%
  contra 21%. A `ctbaklan` (os lançamentos eliminados) não registra a regeneração.
- **Essa regeneração integrou as notas que tinham ficado sem lançamento, mas só de 2026.** Em 10–12/2025, 22 dos 203
  meses (11%) têm nota de faturamento sem lançamento; 20 deles diferem, e em 18 (10 empresas) essas notas são a própria
  diferença (59% da receita deles). Em 01–06/2026, só 4 dos 403 (pelo valor; 6 outros têm só nota de valor zero). Em 2025
  o buraco está sobretudo nos **serviços**: em 15 meses de 6 empresas nenhum serviço do mês foi integrado (a origem 7 não
  existe no mês), embora em 10 deles as saídas ou as entradas tenham sido; em 2026 essas 6 empresas têm os serviços
  integrados, e a maior parte entrou em 09/2026. Nas saídas, 3 empresas têm o mês inteiro sem lançamento em 2025. Em 17
  dos 20 meses de 2025, a nota já existia quando a integração do mês rodou.
- **Tirando os meses com nota sem lançamento, a taxa é a mesma nos três períodos**: 15% em 10–12/2025 (27 de 181), 12% em
  01–06/2026 (47 de 393) e 13% em 07–09/2026 (25 de 196). Juntas, a nota sem lançamento (a) e a cancelada depois de
  integrada (i) dão 8,7 casos por mês em 2025 e 2,8 em 2026. O resto é configuração e se repete todo mês nas mesmas
  empresas (a devolução de compra no `41201`, 3,7 por mês em 2025 e 2,4 em 2026; a devolução fora da receita, 2,0 e 1,4;
  o plano invertido, 1 por mês nos dois): **52 dos 89 casos de 2026 são da devolução (c) ou do plano invertido (e)**.
- **O que não mudou ou não explica**, contado:
  - O plano de contas: nas 24 empresas que diferem em 2025, nenhuma `41101`/`41102` foi criada ou inativada desde
    10/2025. Conta de receita criada ou inativada desde então só aparece em 6 empresas, com 13 dos 89 casos de 2026.
  - Os acumuladores: a onda de vigências de 01/2026 (199 vigências em 57 empresas: a conta débito trocada em 117, a
    crédito em 47, a marca de faturamento em 1) é quase toda em acumulador que não é de faturamento, e aparece também em
    34 das 50 empresas que nunca diferem. Em acumulador de faturamento, a conta crédito trocada de ou para o
    `41101`/`41102` (ou a marca de faturamento trocada) aparece em 7 empresas, com 4 dos 47 e 18 dos 89 casos, e explica
    no máximo 1 dos 47 (o único acumulador trocado usado em 10–12/2025). Das notas sem lançamento de 2025, 95% são de
    acumulador com vigência nova em 2026, mas a conta crédito delas não mudou (é o `41101`/`41102` nas duas).
    Na devolução, 6 empresas tiraram a conta débito do `41201` em 01–02/2026, sem devolução nos meses que diferem.
  - Os parâmetros da integração (`EFPARAMETRO_VIGENCIA`, `EFPARAMETRO`, `ctparmto`): as empresas elegíveis estão com a
    integração analítica por nota e "gera lançamentos" em 2025 e hoje; nenhum campo mudou. O fechamento não separa (só 4
    dos 20 meses de 2025 com nota sem lançamento têm o fechamento ou o período de trabalho travado depois do mês).
  - O encerramento: o zeramento de 2025 não explica nenhum caso. A diferença de 2025 é até mais comum na empresa **sem** o
    zeramento de 2025 (28 dos 47, 30% dos meses dela) do que na zerada (19 dos 47, 17%); os zeramentos de 2025 entraram
    de 02 a 09/2026, antes da regeneração, que não voltou a 2025 em nenhuma empresa. Lançamentos de 10–12/2025 entrados
    depois do zeramento: 8 empresa-meses de 3 empresas, que só acompanham 3 dos 47.
- **Por que a regeneração começou em 01/2026**, a hipótese é aplicar as vigências novas dos acumuladores de 01/2026 (pela
  contagem da etapa, a maior parte das empresas refeitas tem vigência nova em 01/2026, contra metade das não refeitas).
  Só a Adaini confirma.
- **O "quase nada em 2026" da primeira leitura** deve vir de quais meses estavam marcados como feitos: aqui, em todos os
  meses, 2026 tem 89 casos, e o que se repete todo mês (c e e) também está em 2026. Este PC não lê o `contabil_meses`;
  a contagem dos casos nos meses marcados é da sessão do Samuel, no banco (o `dominio_mensal` tem os mesmos números).
- **O pico de 09/2026** é a integração do mês ainda em andamento: 8 dos 17 casos têm nota sem lançamento, e parte delas
  entrou no Domínio em 10/2026.

## 2. A folha

### 2.1 A contagem
- **471 empresa-meses** com a folha calculada (`salarios` + `decimo_terceiro` + `pro_labore_valor`) > 0 e a
  `folha_lancada` > 0; **69 diferentes** em mais de R$ 1,00, de **29 empresas**: **33 em 2025** e **36 em 2026**; **29
  com o contábil maior** e **40 com a calculada maior**.
- Por mês: 10/25 9 · 11/25 13 · 12/25 11 · 01/26 12 · 02/26 2 · 03/26 5 · 04/26 4 · 05/26 2 · 06/26 3 · 07/26 5 ·
  08/26 2 · 09/26 1. Pela taxa: 19,7% de 10/2025 a 01/2026 (45 de 228) e 9,9% de 02 a 09/2026 (24 de 243).
- Durante a fila, uma empresa teve a folha integrada no Domínio (por quem trabalha nele): 11 empresa-meses dela saíram de
  "a folha não entrou" e batem. O universo hoje é 482; nenhum dos 69 muda.

### 2.2 A primeira causa de cada um

| | Causa | Casos | Empresas | 2025 | 2026 |
|---|---|---|---|---|---|
| a | Verbas fora do filtro pela descrição (os itens 001 a 005 dos grupos de pessoal) | 0 | — | — | — |
| b | O que não é despesa nos proventos: o salário-família (e o salário-maternidade) | 16 | 7 | 5 | 11 |
| c | A rescisão em conta própria fora do filtro | 0 | — | — | — |
| d | O pró-labore fora do grupo 3 (no patrimônio) ou noutro mês | 3 | 2 | 2 | 1 |
| e | A folha de um mês lançada noutro (as férias, a rescisão, o 13º) | 30 | 14 | 15 | 15 |
| f | A folha recalculada depois de integrada | 3 | 1 | 0 | 3 |
| g | O lançamento de outra origem nas contas de folha | 4 | 4 | 3 | 1 |
| h | O resto (nenhuma sozinha) | 13 | 7 | 8 | 5 |
| | **Total** | **69** | **29** | **33** | **36** |

- **a. Verbas fora do filtro (0).** Nenhum dos 69 tem débito no item 003 (as verbas: horas extras, adicionais,
  gratificações, comissões) nem noutro item de 001 a 005 fora do filtro; a integração manda 93,6% dos proventos do
  escritório pra contas do filtro (em 11/2025). No escritório, somar os itens 001 a 005 quebraria 6 que batem (num plano, o item 003
  recebe o INSS patronal da integração) e trocar a descrição pelo código quebraria 11, sem resolver nenhum.
- **b. O salário-família e a maternidade (16, 7 empresas).** Estão nos proventos (a `fobasesserv`, o evento de natureza
  1409), mas a integração os manda pro patrimônio (o INSS a recolher: a empresa compensa na guia), não pra despesa. Todos
  com a calculada maior: 11 só o salário-família, 2 com a maternidade, 3 com outros proventos que a configuração manda pro
  patrimônio. A diferença é 3,0% da folha deles; são os 3 dos 69 que estão dentro de 1%. Corre o ano todo. Uma coluna do
  salário-família e da maternidade no `folha_valores.sql` fecha 13 e não quebra nenhum (nenhum dos que batem tem
  salário-família nem maternidade).
- **c. A rescisão em conta própria (0).** Nenhum débito no item 008 (indenizações) nem em conta de indenização, aviso ou
  rescisão nos 69: a rescisão é integrada à parte (o tipo 4 da `fointegcontlanc`) nas contas de salários, dentro do
  filtro. O que acontece com ela é o mês em que é lançada (e).
- **d. O pró-labore (3, 2 empresas).** Em 2, a configuração da integração manda o pró-labore pra uma conta do patrimônio
  (retirada), não pra despesa; em 1, o pró-labore do mês anterior.
- **e. O mês (30, 14 empresas).** A integração lança no mês do pagamento; o `folha_valores.sql`, na competência:
  - as férias: 15 (12 empresas; 13 deles em 12/2025 e 01/2026 — as coletivas pagas em dezembro, que a integração lança no
    mês do pagamento e a folha calculada no mês do gozo);
  - o adiantamento do 13º lançado como despesa em 11/2025: 5 (5 empresas; a integração o estorna em dezembro com um
    crédito nas mesmas contas, que o cruzamento não soma — a conferência confirmou só em parte: o crédito de dezembro
    é igual ao excesso de novembro em 2 e fica dentro de 5% em mais 2, então este subtipo fica a conferir);
  - a integração de outra competência (a rescisão do mês anterior lançada neste): 6 (5 empresas);
  - a rescisão do mês lançada no seguinte: 3 (3 empresas);
  - a folha inteira do mês seguinte: 1.
  - O contábil maior em 17 e a calculada maior em 13; a diferença é 21,5% da folha deles. Mais 7 combinados com b ou d.
    Não há regra única pras férias: pôr as do mês seguinte no lugar das do mês fecha 10 dos 30, mas quebra 46.
- **f. A folha recalculada (3, 1 empresa, e 5 ao todo, todos de 2026).** O cálculo (`fobasesserv.DATA_HORA_CALCULO`) é
  de depois da integração (a maior `dorig_lan` da origem 13 do mês) e a diferença cabe nos proventos desses cálculos.
  Só "compatível": o Domínio não guarda o total de antes do recálculo. No escritório, com a integração no mesmo dia do
  cálculo, 140 de 140 batem; com o cálculo depois, 11 (6 batem, 5 diferem).
- **g. Outra origem (4, 4 empresas).** Todo lançamento de outra origem nas contas de folha é o manual (a origem 1): no
  escritório, 28 empresa-meses de 20 empresas com débito manual e 6 só com crédito. Nos 4, o manual quase dobra a folha
  (196,6% dela): ou é lançamento em dobro com a integração, ou correção. Tirar a origem 1 do cruzamento quebraria 15 que
  batem (há empresas com a folha lançada à mão).
- **h. O resto (13, 7 empresas).** 8 fecham combinando duas causas: b+e 6 (4 empresas), d+e 1, b+g 1. Sobram **5, de 2
  empresas**, sem causa: em todos, o mensal (o tipo 1) integrado a menos que o calculado. 4 são de uma empresa em que a
  integração lançou só o pró-labore dos sócios e não a parte dos empregados, de 10/2025 a 01/2026 (a configuração aponta
  pras contas certas; sem recálculo, filial, outro serviço, cálculo implantado ou folha integrada noutra empresa); 1 é de
  outra, com o contábil acima.
- Testadas e sem efeito: a filial integrada na matriz (nenhuma folha integrada noutra empresa de 10/2025 a 09/2026),
  outras categorias (estagiário, autônomo), o sócio noutro tipo de cálculo, outros itens dos grupos de pessoal, evento sem
  configuração na integração (1,9% dos proventos do escritório em 11/2025, 7 empresas, nenhuma dos 69).

### 2.3 As diferenças de 2025 têm uma causa comum?
**Não uma causa, mas um calendário comum: o fim do ano.** Dos 45 casos de 10/2025 a 01/2026, a causa e é a primeira em 22
(as férias coletivas pagas em dezembro 13, o adiantamento do 13º de novembro 5, a rescisão ou a integração de outra
competência 4), mais 7 combinados com b ou d; b 6, g 3, d 2 e os 5 sem causa (4 da empresa com só o pró-labore
integrado). De 02 a 09/2026 (24): b 10, e 8 (a rescisão ou outra competência 5, as férias 2, o mês 1), f 3, d 1, g 1, b+g
1. **Nada mudou na integração entre os períodos**: a mesma regra da integração mensal (o mensal − as férias − o
salário-família − a rescisão + o pró-labore + o 13º) bate em 197 de 224 empresa-meses de 10/2025 a 01/2026 e em 233 de
243 de 02 a 09/2026 (a diferença é o adiantamento do 13º de novembro), com os mesmos tipos de integração, nenhuma folha
integrada noutra empresa e nenhum recálculo depois da integração em 2025 (os 5 são de 2026). O salário-família corre o
ano todo (5 em 2025 e 11 em 2026).

## 3. O rascunho (`ponte/rascunhos/cruzamentos_v2.sql`)
As mesmas colunas (`codigo`, `receita_lancada`, `folha_lancada`, `encargos_lancados`) e os mesmos dois parâmetros; a
descrição da conta só nos filtros, como hoje. Três correções:
1. **O grupo de resultado pela natureza** (`ctnatureza_conta`, o item 7 de 04/11): no plano com o 3 credor e o 4 devedor,
   a receita é o `31101`/`31102`, a devolução o `31201`, e a folha e os encargos ficam no grupo 4; os outros planos (o 4
   credor, os dois devedores, sem a tabela) ficam como hoje.
2. **A receita e a devolução da escrita fiscal pela empresa da nota** (a `ctlancto.fili_lan`, nas origens 4 a 9, 11 e 21
   a 29; vazia ou zero, fica no `codi_emp`); as outras origens, a folha e os encargos seguem no `codi_emp`.
3. **A folha e os encargos pela competência da integração**: o lançamento da folha (origem 13) ligado na
   `fointegcontlanc` conta na competência dela quando o `data_lan` é de um mês antes a dois depois; fora disso, e o sem
   ligação e o das outras origens, no mês do `data_lan`.

Depois da etapa do rascunho, acertei duas coisas na correção 3 que não mudam nenhum número de hoje: as janelas agora
casam (os lançamentos de M−1 a M+2 e as competências de M−2 a M+1, pelo primeiro dia do mês), então cada lançamento
conta num mês só e nenhum se perde — na versão da etapa, um lançamento a 2 meses antes ou a 3 depois da competência não
entraria em mês nenhum, e o "último dia + 2 meses" perdia o dia 31 (o 31/01 pra competência de novembro); hoje os 2.625
lançamentos ligados estão todos de um mês antes a um depois, por isso nada mudou. Rodada de novo nos 12 meses, a versão
corrigida dá os mesmos valores da etapa em 854 de 854 empresa-meses.

**Contra a consulta de hoje, rodadas as duas na mesma hora:**

| Mês | Bloco | Diferiam hoje | Deixam de diferir | Ficam | Passam a diferir |
|---|---|---|---|---|---|
| 11/2025 | receita | 17 | 1 (o plano invertido) | 16 | 0 |
| 11/2025 | folha | 13 | 1 (a competência da integração) | 12 | 0 |
| 09/2026 | receita | 17 | 2 (o plano invertido e a matriz) | 15 | 0 |
| 09/2026 | folha | 1 | 0 | 1 | 0 |
| 12 meses | receita | 136 | 14 (2 empresas) | 122 | 0 |
| 12 meses | folha | 69 | 11 (5 empresas: 4 em 2025, 7 em 2026) | 58 | 3 (3 empresas) |

- Em 11/2025, também 1 "a folha não entrou" vira "bate" (o plano invertido, pelo grupo 4). Nos 12 meses, 6 empresa-meses
  do plano invertido entram no universo da folha e batem.
- Em 09/2026 a competência da integração ainda não muda nada: a folha de 10/2026 não foi integrada, e a rescisão de 09
  paga em 10 só aparece quando outubro entrar. O mês passa a depender dos lançamentos dos dois meses seguintes (a ponte
  relê 14 meses por dia, então se acerta sozinho).
- Os 3 que passam a diferir na folha são a integração ligada a uma competência diferente da do cálculo que a contém (1 de
  férias, tipo 3, e 2 de rescisão, tipo 4). Só a rescisão pela competência dá 8 e 2; fiquei com todos os tipos (11 e 3).
- As 2 filiais da correção 2 ganham a receita lançada em 6 empresa-meses em que não têm escrita fiscal própria (o
  `origens.sql` conta pelo `codi_emp`), que a tela não compara.
- A receita lançada muda em 20 empresa-meses de 4 empresas (o plano invertido, a matriz e as 2 filiais); a folha lançada
  em 26 empresa-meses de 11 empresas; os encargos, em 21 de 10 (a tela não os compara).
- Tempo: de 3,8 a 4,8 s por mês (a de hoje, 1,6 s). A parte cara é a lista das contas com o filtro pela descrição, que a
  receita e a folha leem cada uma, e os quatro meses de lançamentos da folha com a `fointegcontlanc`.

### O que ficou de fora do rascunho, e por quê
- **Muda outra consulta e o contrato** (não é do cruzamento):
  - **F1, no `faturamento.sql`**: a devolução de venda só com o acumulador de devolução **e** de faturamento, como a
    apuração do Simples. Fecha 18 (6 empresas) e não quebra nenhum; a `receita_bruta` fica igual à apuração do Simples
    em 880 de 880 (hoje, 864). Mas ela sobe onde há essas entradas (os 18, ao menos) em todo uso (a Carteira, o
    Comparativo, o assistente). A alternativa sem mexer no faturamento: a tela comparar a receita lançada com a
    `receita_simples_propria` quando ela existe (fecha 16, não quebra nenhum).
  - **No `folha_valores.sql`**, uma coluna do salário-família e do salário-maternidade (a soma de `val_sal_fam` e
    `salario_maternidade` dos mesmos cálculos), e a tela compara a folha lançada com a calculada menos ela: fecha 13, não
    quebra nenhum. O `salarios` não muda (a Precificação e o Comparativo usam). É coluna nova no pacote (versão 4).
  - Colunas opcionais pra tela dizer o porquê: as **notas sem lançamento** do mês (quantas e quanto; a consulta pronta e
    conferida nota a nota em `C:\ponte-dominio\dif\mudou\sug_notas_sem_lancamento.sql`, 1,8 a 2,0 s — "N notas do mês
    sem lançamento contábil" no lugar de um "conferir" genérico, nos 31 da causa a), a **folha manual** (o débito de
    origem 1 nas contas de folha) e o **débito no `41201` das saídas de devolução** ("devolução de compra lançada como
    devolução de venda").
- **É regra da tela**: o mês que fecha com o vizinho (M com M−1 ou M+1, até R$ 1,00) fecha 10 e não quebra nenhum, mas
  esconde um erro de um mês compensado por outro no vizinho. Com a coluna do salário-família, 25 (0 quebras); com ela e a
  competência da integração, 33 (2 quebras).
- **Testado e sem ganho** (resolvidos e quebrados): as outras analíticas do `411`, o líquido da receita e a devolução da
  origem 6 noutras contas do 4 (0 e 0); a integração no `413` a `42` (0 e 2, de 1 empresa); a folha pelo código, os
  itens 001 a 005 (0 e 11); o item 003 somado (0 e 6); a folha sem a origem 1 (6 e 15); a folha pelo líquido (0 e 73: a
  integração credita as contas de folha em 108 empresa-meses, como o estorno do adiantamento do 13º); as férias pelo
  cálculo de férias (3 a 12 e 16 a 46, conforme a variante); a correção 2 em todas as origens (as mesmas contagens, mas
  muda mais — o manual com outra filial, 3 lançamentos de 1 empresa, não foi conferido).
- **O `origens.sql`**: se a centralização da matriz for de propósito, o aviso "a escrita fiscal não entrou" nas 2 filiais
  é falso — não é desta fila.
- **De propósito, continuam como diferença** (problema de verdade da contabilidade):
  - receita (os 122): a nota sem lançamento 31; a devolução 61 (a de compra a débito do `41201` e a de venda sem
    lançamento ou fora da receita; 18 delas saem com a F1); a nota de outro mês 3; o manual 1; e 26 do resto (a nota
    cancelada depois de integrada, o valor integrado diferente, a integração sem nota, as combinações);
  - folha (os 58, mais os 3 novos): o salário-família e a maternidade 16 (mais 7 combinados; a coluna nova tira 13); as
    férias e o adiantamento do 13º (a regra do mês vizinho pega parte); o pró-labore no patrimônio ou do mês anterior 3; a
    folha recalculada 3; o manual 4; e os 5 sem causa (4 deles com só o pró-labore integrado).

## 4. O que só a equipe sabe
**A Adaini:**
- Se a contabilidade centralizada da matriz (as notas de 2 filiais integradas no contábil dela) é de propósito. A
  correção 2 compara cada empresa só com as suas notas: se for de propósito, o aviso "a escrita fiscal não entrou" nas
  filiais é falso; se não for, ele segue aparecendo nelas.
- O crédito manual na receita (1 caso) e os 3 lançamentos manuais na receita da matriz com outra filial.
- A conta certa dos acumuladores da saída de devolução de compra (7 empresas, que debitam o `41201`) e da devolução de
  venda integrada fora da receita.
- Se os serviços de 10–12/2025 das 6 empresas sem nenhum serviço integrado ficaram de fora de propósito (contabilizados de
  outro jeito) ou falta integrar; se 10–12/2025 ainda pode ser integrado ou gerado de novo (8 dos 20 meses com nota sem
  lançamento são de 4 empresas com o zeramento de 2025: gerar de novo muda o resultado já levado ao patrimônio e pede o
  zeramento refeito; em 4 deles o período de trabalho ou o fechamento já passou do mês; e se a ECD e a ECF de 2025 já
  foram entregues).
- Por que a regeneração de 09/2026 começou em 01/2026 (a hipótese: aplicar as vigências novas dos acumuladores).
- As notas canceladas depois de integradas (17 casos, 10 empresas): integrar de novo.
- Se são de propósito: o pró-labore integrado no patrimônio (2 empresa-meses), o adiantamento do 13º como despesa em
  novembro (5 empresas; outras 18 com adiantamento batem em novembro) e os lançamentos manuais nas contas de folha (4 a
  6), que ou são em dobro com a integração ou são correção.
- As 3 folhas que a competência da integração passa a apontar (1 de férias e 2 de rescisão).

**A Adaini com o DP:** o que houve na empresa em que só o pró-labore foi integrado, de 10/2025 a 01/2026 (a configuração
aponta pras contas certas, e a causa não aparece no banco).

**A Thalia:** as entradas de devolução (naturezas 1.2xx e 2.2xx) com o acumulador de devolução sem a marca de
faturamento (18 casos da F1, 6 empresas). Nem o Simples nem o contábil as descontam: se forem devoluções de venda de
verdade, o erro está no acumulador e o DAS sai a mais; se não forem, a F1 está certa.

## 5. O que a sessão do Samuel decide
1. **A correção 1 (o grupo pela natureza)**: fecha 11 da receita e põe 6 da folha no universo, todos batendo, sem quebrar
   nenhum. Recomendo.
2. **A correção 3 (a folha pela competência da integração)**: 11 deixam de diferir e 3 passam (ligações diferentes da do
   cálculo). Recomendo; as janelas estão casadas.
3. **A correção 2 (a receita pela empresa da nota)**: fecha 3, não quebra nenhum e não esconde nada (a filial sem escrita
   fiscal própria não é comparada). Pode entrar já ou esperar a Adaini dizer se a centralização é de propósito.
4. **A F1 no `faturamento.sql`** (ou a comparação com a `receita_simples_propria`), depois da Thalia.
5. **A coluna do salário-família e da maternidade** no `folha_valores.sql` (versão 4 do pacote, o contrato e a função
   juntos).
6. **As notas sem lançamento** como coluna do cruzamento (versão 4): não fecham nada — é problema de verdade —, mas dão o
   porquê de 31 casos.
7. **A regra do mês vizinho** na tela, ou não (esconde erro compensado).
8. **Contar, no banco, quais dos 136 e dos 69 caem nos meses marcados como feitos** (`contabil_meses` × `dominio_mensal`),
   pra fechar o "quase tudo em 2025" da primeira leitura.

## O que a conferência acertou nas frases das etapas
- Na causa f da receita, o trimestre e o mês vizinho fecham 2 dos 3 casos (a etapa dizia nenhum); as contagens não mudam.
- Na devolução do lado do contábil maior, depois da F1 ficam 6 sem lançamento e 4 fora da receita (a etapa dizia 9 e 4,
  contando 3 que a F1 tira).
- A F1 nos 880 empresa-meses com apuração do Simples (864 hoje, 880 com ela); a etapa contava só os 796 da decomposição.
- Na nota sem lançamento de 01–06/2026, 4 dos 403 pelo valor (a etapa dizia 10, contando notas de valor zero).
- A regeneração de 09/2026 recontada pela `ctlancto` (44 empresas com algum mês de 2026 entrado inteiro em 09/2026, 42
  com todos, 34 desde 01/2026); as contagens da etapa (42 de 78, 31 desde 01/2026) usavam outra definição. O fenômeno e o
  sentido se mantêm.
- O adiantamento do 13º de novembro se confirma só em parte (acima, na causa e da folha).
- O risco da janela da correção 3 (o lançamento fora da janela que não entraria em mês nenhum) foi corrigido no rascunho.
