# Fila do Claude Code — 11/11/2026 · o Comparativo tributário: as vendas pelo CFOP, os serviços pelo item, o PIS/Cofins pela situação tributária, a apuração do Presumido e o resultado da contabilidade · branch `fila-11-11-comparativo`

> **Para o Code do PC do escritório.** **Leia este arquivo inteiro antes de começar**, junto com o
> `docs/FILA-CODE-2026-11-03-DUVIDAS.md` (o faturamento, as compras e a folha em reais: os acumuladores de faturamento,
> a `efsaidas`, a `efservicos`, a `efentradas` e a `efsdoimp`) e o `docs/FILA-CODE-2026-11-04-CONTABIL-DUVIDAS.md` com o
> `docs/FILA-CODE-2026-11-05-DIFERENCAS-DUVIDAS.md` (o plano de contas de cada empresa, a natureza dos grupos de
> resultado e as origens da `ctlancto`).
> Faça os itens **inteiros, sem parar pra perguntar**: nenhum item precisa do Samuel na frente do PC. Na dúvida, a
> opção que **muda menos**, anotada em `docs/FILA-CODE-2026-11-11-COMPARATIVO-DUVIDAS.md`. Ao terminar: o **Registro de
> progresso** (fim deste arquivo) preenchido, commit e `git push origin fila-11-11-comparativo`. **Nunca** push em
> `main` nem merge pra ela. **Esta fila não muda a ponte nem instala nada**: só descobre e escreve rascunhos.

## O que é
- O **Comparativo tributário** (Fiscal) calcula quanto a empresa paga no Lucro Presumido, no Lucro Real e no Simples,
  com os números que a ponte já manda (a receita de mercadoria e de serviço, as compras, a folha). Em 11/11 o Samuel
  usou a tela com a primeira empresa do Presumido e pediu: o que o sistema manda a equipe conferir, ele mesmo deve
  apurar, **pelas notas que o Domínio já tem** ("como temos acesso nas notas fiscais pela ponte da domínio, não ficaria
  mais fácil para o próprio sistema apurar essa informação? nota a nota?").
- Com as somas de hoje, o sistema já diz sozinho se a receita é venda de mercadoria ou serviço (é o que faz a
  presunção do Presumido na maioria das empresas). **O que as somas de hoje não dizem**, e a tela ainda pede pra
  conferir ou digitar:
  1. as vendas **pelo CFOP**: a produção própria, a revenda, o combustível, o transporte, a venda pra fora do estado
     e pro exterior, com o **ICMS destacado** nas saídas e creditado nas entradas (hoje a conta usa 17% nas vendas e
     12% de crédito, "padrão: confira") e o **IPI**;
  2. os serviços **pelo item da lista** (a obra, a saúde, o transporte, a locação), com o **ISS** (hoje, 3%, "padrão:
     confira");
  3. o PIS/Cofins das vendas **pela situação tributária**: a tributada, a monofásica, a de alíquota zero, a isenta
     (hoje a tela pergunta quanto da venda tem alíquota zero) e a apuração do mês;
  4. **a apuração do IRPJ e da CSLL do Presumido que o próprio Domínio faz**: a receita por percentual de presunção
     (1,6%, 8%, 16%, 32%) e o imposto apurado, que é a resposta direta do "qual presunção o escritório aplica hoje";
  5. **o resultado da contabilidade** (a DRE antes do IRPJ e da CSLL), por mês: é o número que decide entre o
     Presumido e o Real, e hoje a equipe digita.
- Esta fila **só descobre e escreve rascunhos**, numa pasta que a ponte **não lê** (`ponte/rascunhos/`). O contrato do
  pacote, a função do sistema e as tabelas do banco **não mudam aqui**: quem decide o contrato novo (a versão 5) e
  liga no sistema é o Claude da sessão do Samuel, depois de revisar, com o "vai" dele.
- **Sai do PC só soma por empresa e por mês**, como tudo o que a ponte manda. Nenhuma nota, nenhum item, nenhum
  cliente ou fornecedor da empresa, nenhum nome de conta.

## Regras (as de 04/11, que valem todas)
- **Dado pessoal não sai do Domínio — nem pra esta conversa.** Você só lê o **catálogo** (`dominio tabelas`) e
  **contagens e somas por empresa** (`dominio sql` com `COUNT`, `SUM`, `MIN`, `MAX` e `GROUP BY`). **Nunca** selecione
  nome, CPF, CNPJ, endereço, telefone ou e-mail de cliente, de fornecedor, de sócio ou de funcionário, nem `SELECT *`
  de tabela de notas, de itens, de pessoas ou de lançamentos.
- **A descrição das contas, dos produtos e dos serviços e o histórico dos lançamentos também ficam no Domínio.** A
  conta tem o nome do sócio e do banco; o produto e o serviço dizem o que a empresa vende e pra quem. Pra separar os
  grupos, use o **código** (o CFOP, a situação tributária, o item da lista de serviços, a classificação da conta) e
  contagens; a descrição só entra **dentro do filtro** da consulta (um `LIKE`), nunca na saída.
- **Receita, imposto, resultado e saldo de uma empresa ficam fora da conversa e do repositório**: o que é por empresa
  vai pra arquivos em `C:\ponte-dominio\` (fora do repositório), pelo `dominio sql` com a saída num arquivo de lá; no
  registro e no DUVIDAS, só o **escritório inteiro** e **contagens** ("em 58 empresas a soma bate"). Grupo com menos
  de 3 empresas, só a contagem.
- **Não abra o `C:\ponte-dominio\config.ini`** (nem Read, `type`, `cat` ou `Get-Content`): a senha do banco e a chave
  da ponte estão nele. Pra saber como ficou: `py -3 -m ponte conferir` e o log do dia.
- **Repositório público**: nada de host, IP, porta, Engine, nome do banco, usuário, senha, nome de cliente, CNPJ,
  código de empresa ou valor de uma empresa. Das tabelas do Domínio, só as que os rascunhos usam (o nome, as colunas
  usadas e a descrição do catálogo) — **nunca o catálogo inteiro** (é a documentação da Thomson Reuters).
- Código: crie e mexa **só** em `ponte/rascunhos/comparativo_*.sql` e nos dois arquivos desta fila. **Não mexa** em
  `ponte/consultas/`, `ponte/*.py`, `supabase/`, nas telas nem nos testes. Se um comando da ponte falhar por causa do
  código, não conserte: anote o erro (a mensagem, sem valores) e siga.
- **Não rode** o `instalar.ps1` e **não rode** o `ponte rodar` sem `--sem-enviar` (quem manda pro sistema é a tarefa
  das 7h). Não mexa nas tarefas do Agendador nem nas opções de energia do PC.
- **Consulta pesada**: cada rascunho tem de rodar em até 60 segundos com `--mes 2026-09`. Passou, anote o tempo e a
  parte cara, e proponha no DUVIDAS o caminho mais leve.
- Cada rascunho começa com o comentário curto de sempre: as tabelas, o que conta e o que fica de fora. Os dois `?` são
  sempre o primeiro e o último dia do mês (o `--mes`); no item 4, se a apuração for trimestral, a consulta acha o
  trimestre a que o mês pertence e devolve a apuração dele (diga isso no comentário). **Uma linha por empresa, já
  somada**; coluna que o Domínio não tem fica de fora, anotada.
- Commits em pt-BR.

## Antes de começar
```
git fetch origin --prune
git checkout main
git pull
git checkout -b fila-11-11-comparativo
py -3 tests/ponte.test.py
```
O teste da ponte tem de terminar em "Tudo certo.". Se não terminar, **pare aqui**: registro e push.

## 1. As vendas pelo CFOP, o ICMS e o IPI
O objetivo: o sistema dizer sozinho **o que a empresa vende** (produção ou revenda, combustível, transporte) e **quanto
de ICMS** sai nas vendas e entra nas compras.
1. **Onde está**: o CFOP de cada segmento da nota de saída na `bethadba.efsaidas` (o `codi_nat`, como na
   `efentradas`? confira no catálogo) e onde ficam a base e o valor do ICMS, do ICMS-ST e do IPI de cada segmento de
   saída e de entrada (na própria linha, ou numa tabela de impostos do segmento — `--procurar "impostos das saidas"`,
   `--procurar "impostos das entradas"`, `--procurar icms`, `--procurar ipi`).
2. **O rascunho** `ponte/rascunhos/comparativo_saidas.sql`. Só os segmentos de saída **com acumulador de faturamento**
   (o mesmo corte do `faturamento.sql`: a vigência mais recente do acumulador e `IFAT_ACU = 'S'`; fora a cancelada, a
   denegada e a inutilizada), pelo valor contábil. Os grupos, pelos três dígitos finais do CFOP:
   - `venda_producao`: 101, 103, 105, 107, 109, 111, 113, 116, 118, 122, 401 e 402;
   - `venda_revenda`: 102, 104, 106, 108, 110, 112, 114, 115, 117, 119, 120, 123, 403, 404 e 405;
   - `venda_combustivel`: 651 a 656;
   - `industrializacao_encomenda`: 124 e 125;
   - `transporte`: 351 a 360, 932 e 933 (e `transporte_357`, só o 357, dentro dele: a prestação a não contribuinte,
     que é onde costuma estar o transporte de passageiros);
   - `energia_comunicacao`: 251 a 258 e 301 a 307;
   - `outras_saidas`: o resto que o acumulador marca como faturamento.
   E, sobre os mesmos segmentos: `saidas_no_estado` (CFOP começando em 5), `saidas_outro_estado` (em 6) e
   `saidas_exterior` (em 7); `base_icms_saidas`, `icms_saidas`, `icms_st_saidas` (o ST retido nas vendas, se houver) e
   `ipi_saidas`.
3. **As entradas**, no mesmo rascunho ou em `ponte/rascunhos/comparativo_entradas.sql` (o que ficar mais leve): sobre
   os segmentos que o `compras.sql` conta como `compras` (os mesmos CFOPs), `base_icms_compras`, `icms_compras` (o
   ICMS destacado, que é o crédito de quem está no regime normal) e `ipi_compras`; e, sobre os de `servicos_tomados` e
   `ativo_e_consumo`, `icms_despesas`.
4. **A conferência dentro do Domínio**, com `--mes 2026-09` (mostre só a contagem por resultado): a soma dos grupos do
   item 2 contra a parte de mercadoria do `faturamento.sql` antes da devolução, empresa por empresa, até R$ 1,00
   ("bate" / "não bate"); e a soma de `saidas_no_estado`, `saidas_outro_estado` e `saidas_exterior` contra a mesma
   parte.
5. **Contagens do escritório inteiro** em 09/2026, só das empresas ativas: quantas têm cada grupo maior que zero;
   quantas têm `icms_saidas` maior que zero e quantas têm `icms_compras`; quantas vendem pra fora do estado; quantas
   têm `ipi_saidas`. E a pergunta do transporte: o conhecimento de transporte (CT-e) entra na `efsaidas` ou na
   `efservicos`? (contagem de empresas com o grupo `transporte` em cada uma.)

## 2. Os serviços pelo item da lista e o ISS
O objetivo: separar **a obra, a saúde, o transporte municipal e a locação** do serviço comum (a presunção do Presumido
muda) e saber **o ISS que a empresa paga**.
1. **Onde está**: na `bethadba.efservicos`, a coluna do item da lista de serviços da LC 116 (ou o código de serviço do
   município, ou o código de tributação — `--procurar "lista de servicos"`, `--procurar "codigo de servico"`,
   `--procurar "item da lista"`), a base, a alíquota e o valor do ISS, e o ISS retido pelo tomador.
2. **O rascunho** `ponte/rascunhos/comparativo_servicos.sql`. Só os segmentos de serviço com acumulador de
   faturamento (o corte do `faturamento.sql`). Os grupos, pelo item da lista (os dois primeiros números):
   - `serv_construcao`: 7.02, 7.04 e 7.05;
   - `serv_saude`: o item 4 inteiro;
   - `serv_transporte`: o item 16 inteiro;
   - `serv_locacao`: o item 3 inteiro;
   - `serv_outros`: o resto, e `serv_sem_item` (o serviço sem o item no Domínio).
   E `base_iss`, `iss_devido` (o ISS do mês que a empresa paga, sem o retido) e `iss_retido`.
3. **A conferência**, com `--mes 2026-09`: a soma dos grupos contra a parte de serviço do `faturamento.sql`, empresa
   por empresa (só a contagem por resultado).
4. **Contagens do escritório inteiro** em 09/2026: quantas empresas ativas em cada grupo; quantas com `serv_sem_item`;
   em quantas o ISS devido dividido pela base dá 2%, 2,5%, 3%, 4%, 5% e outro (a contagem por faixa); se o item da
   lista não existir no Domínio, o que existe (o código do município?) e a contagem dos 10 códigos mais usados, **só o
   código**, sem a descrição.

## 3. O PIS/Cofins pela situação tributária
O objetivo: o sistema saber **quanto da venda paga PIS/Cofins** (a tela hoje pergunta a parte com alíquota zero e a
monofásica) e conferir a conta dele com a apuração do Domínio.
1. **Onde está**: a situação tributária (CST) do PIS e da Cofins das saídas e dos serviços — no segmento da nota, no
   item (`--procurar "situacao tributaria"`, `--procurar cst`, `--procurar "pis"`, `--procurar cofins`), ou no
   acumulador. E a apuração do mês na `bethadba.efsdoimp` (os códigos do PIS e da Cofins: a base, o débito, os
   créditos do não cumulativo e o saldo a recolher).
2. **O rascunho** `ponte/rascunhos/comparativo_piscofins.sql`. Sobre as saídas e os serviços com acumulador de
   faturamento, pelo CST do PIS (se o da Cofins diferir em alguma linha, conte quantas):
   - `pc_tributada`: 01, 02 e 03;
   - `pc_monofasica`: 04;
   - `pc_st`: 05;
   - `pc_aliquota_zero`: 06;
   - `pc_isenta`: 07; `pc_sem_incidencia`: 08; `pc_suspensa`: 09;
   - `pc_outras`: 49, 99 e o resto, e `pc_sem_cst` (a linha sem a situação).
   E, da apuração do mês: `base_pis_cofins`, `pis_apurado`, `cofins_apurada`, `creditos_pis_cofins` (o não
   cumulativo) e `pis_cofins_a_recolher`.
3. **A conferência**, com `--mes 2026-09`: a soma dos grupos contra a receita bruta do `faturamento.sql` antes da
   devolução, empresa por empresa (só a contagem por resultado).
4. **Contagens do escritório inteiro** em 09/2026, separadas pelo regime que o Domínio diz da empresa (Simples,
   Presumido, Real — ache o campo do regime na vigência da empresa): quantas empresas ativas têm cada grupo maior que
   zero; quantas têm `pc_sem_cst` em mais de 5% da receita; nas do Presumido e do Real, em quantas a apuração existe
   no mês.

## 4. A apuração do IRPJ e da CSLL do Presumido
O objetivo: ler **a presunção que o próprio Domínio aplica** na apuração de cada empresa do Lucro Presumido, em vez de
o sistema deduzir.
1. **Onde está**: como o Domínio guarda a apuração do IRPJ e da CSLL do Lucro Presumido (`--procurar "lucro
   presumido"`, `--procurar presuncao`, `--procurar irpj`, `--procurar csll`, `--procurar "base de calculo"`): na
   `efsdoimp` (os códigos do IRPJ e da CSLL), se é por mês ou por trimestre, e se a receita vem separada por
   percentual de presunção (pelo acumulador? por uma tabela de detalhamento, como a `efsdoimp_simples_nacional`?).
2. **O rascunho** `ponte/rascunhos/comparativo_presumido.sql`, com o que existir de verdade:
   - a receita por percentual de presunção do IRPJ: `receita_irpj_1_6`, `receita_irpj_8`, `receita_irpj_16`,
     `receita_irpj_32` e `receita_irpj_outros`;
   - a da CSLL: `receita_csll_12`, `receita_csll_32` e `receita_csll_outros`;
   - `demais_receitas` (as receitas financeiras e os ganhos, que entram inteiros na base);
   - `base_irpj`, `irpj_apurado`, `adicional_irpj`, `base_csll` e `csll_apurada`.
   Se o Domínio não guarda a receita por percentual, o que ele guarda (só a base e o imposto?) e de onde o percentual
   sai (o cadastro do acumulador?): escreva o rascunho com o que há e explique no DUVIDAS.
3. **Contagens do escritório inteiro**, no 3º trimestre de 2026: quantas empresas ativas o Domínio diz do Lucro
   Presumido e do Lucro Real; em quantas do Presumido a apuração do IRPJ existe; em quantas a receita está toda em 8%,
   toda em 32%, nas duas, e em quantas aparece 1,6% ou 16%; em quantas a soma das receitas por percentual bate com a
   receita bruta do `faturamento.sql` do trimestre (até R$ 1,00).

## 5. O resultado da contabilidade (a DRE)
O objetivo: o **resultado antes do IRPJ e da CSLL** de cada mês, que é o lucro que o Lucro Real tributa. Hoje a equipe
abre a DRE no Domínio Contabilidade e digita.
1. **Como sai**: pela `bethadba.ctlancto`, o crédito menos o débito do mês nas contas analíticas **de resultado**
   (as receitas, os custos e as despesas), fora o zeramento (`orig_lan = 2`). As contas de resultado, pelo caminho que
   a fila de 04/11 e a de 05/11 acharam (a classificação e a natureza dos grupos de resultado no plano de cada
   empresa). **Fora** as contas da provisão do IRPJ e da CSLL (pela classificação, se o plano as separa; senão pelo
   filtro da descrição **dentro** da consulta: `IRPJ`, `IMPOSTO DE RENDA`, `CSLL`, `CONTRIBUICAO SOCIAL`): elas vão
   numa coluna à parte.
2. **O rascunho** `ponte/rascunhos/comparativo_resultado.sql`:
   - `resultado_antes_ir`: o crédito menos o débito do mês nas contas de resultado, sem as do IRPJ e da CSLL
     (positivo = lucro, negativo = prejuízo);
   - `irpj_csll_lancados`: o débito do mês nas contas do IRPJ e da CSLL;
   - `receitas_financeiras`: o crédito do mês nas contas de receita financeira (pelo grupo, ou pelo filtro da
     descrição dentro da consulta);
   - `lanc_resultado`: quantos lançamentos do mês entraram na conta (zero = a contabilidade do mês não foi feita).
3. **A conferência dentro do Domínio**: nas empresas com o zeramento de 2025 (o `encerramento.sql`), a soma do
   `resultado_antes_ir` e do `irpj_csll_lancados` dos 12 meses de 2025 contra o valor do zeramento do ano, empresa
   por empresa, até R$ 1,00 (só a contagem: "bate" / "não bate" / "sem zeramento"). Onde não bate, procure o porquê
   pelas origens e pelos grupos (só contagens) e anote.
4. **Contagens do escritório inteiro**: de 10/2025 a 09/2026, em quantas empresas ativas o `lanc_resultado` é maior
   que zero em cada mês; em quantas os 12 meses têm lançamento; em quantas o plano não deixa separar as contas do IRPJ
   e da CSLL.

## 6. Registro, DUVIDAS e push
O `docs/FILA-CODE-2026-11-11-COMPARATIVO-DUVIDAS.md` com, pra cada rascunho: as tabelas e as colunas usadas (com a
descrição do catálogo), a regra de cada coluna e o que ficou de fora, o tempo com `--mes 2026-09`, os números da
conferência (só do escritório inteiro e contagens) e o que o Claude da sessão do Samuel tem de decidir (onde o Domínio
não tem o dado, onde há dois caminhos, o que ficaria pesado todo dia). O registro preenchido, `py -3
tests/ponte.test.py` verde, commit e `git push origin fila-11-11-comparativo`. O resultado por empresa fica só em
`C:\ponte-dominio\comparativo_*.txt`, nunca no repositório.

## Registro de progresso
| Data | Item | Situação / observação |
|---|---|---|
