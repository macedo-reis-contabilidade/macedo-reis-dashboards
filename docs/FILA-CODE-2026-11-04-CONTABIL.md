# Fila do Claude Code — 04/11/2026 · o andamento das contabilidades no Domínio · branch `fila-04-11-contabil`

> **Para o Code do PC do escritório.** **Leia este arquivo inteiro antes de começar**, junto com o
> `docs/FILA-CODE-2026-10-29-DUVIDAS.md` (a consulta `contabil` e a `bethadba.ctlancto`, com as origens) e o
> `docs/FILA-CODE-2026-11-03-DUVIDAS.md` (o faturamento, as compras e a folha em reais). As consultas de lá que o
> item 5 usa já estão na `main`, em `ponte/consultas/faturamento.sql` e `ponte/consultas/folha_valores.sql` (a versão
> 2 da ponte, que a fila de 05/11, feita antes desta, instalou).
> Faça os itens **inteiros, sem parar pra perguntar**: nenhum item precisa do Samuel na frente do PC. Na dúvida, a
> opção que **muda menos**, anotada em `docs/FILA-CODE-2026-11-04-CONTABIL-DUVIDAS.md`. Ao terminar: o **Registro de
> progresso** (fim deste arquivo) preenchido, commit e `git push origin fila-04-11-contabil`. **Nunca** push em `main`
> nem merge pra ela.

## O que é
- Desde 04/11 a planilha de controle da Adaini está no sistema (Contábil › Controle das contabilidades): cada empresa,
  mês a mês, como feita, em andamento, sem movimento ou a fazer — **marcado à mão por ela**, que é quem diz que o mês
  está fechado. Não é rotina mensal: ela atualiza conforme faz.
- O que o sistema quer do Domínio, **pra ajudar a Adaini, sem trocar a marcação dela**:
  - **até onde cada empresa está lançada** — o último lançamento em cada conta de banco e no caixa, e a conciliação
    bancária, se o Domínio guarda;
  - **se a integração da escrita fiscal e a da folha foram feitas** no mês (a origem dos lançamentos);
  - **o encerramento do exercício** (o zeramento) de cada ano;
  - **os saldos estranhos do balancete** no fim do mês: o caixa negativo, a conta com saldo contra a natureza e a
    conta transitória ou "a classificar" com saldo;
  - **a receita e a folha lançadas no contábil**, pra cruzar com o faturamento e a folha do próprio Domínio (as
    consultas `faturamento.sql` e `folha_valores.sql` da fila de 03/11, hoje em `ponte/consultas/`).
- Esta fila **só descobre e escreve rascunhos**, numa pasta que a ponte **não lê** (`ponte/rascunhos/`). O contrato
  do pacote, a função do sistema e as tabelas do banco **não mudam aqui**: quem decide o contrato novo e liga no
  sistema é o Claude da sessão do Samuel, depois de revisar. A conferência com a marcação da Adaini é dele, no sistema,
  quando os números chegarem lá.

## Regras (as de 03/11, que valem todas, mais as do plano de contas)
- **Dado pessoal não sai do Domínio — nem pra esta conversa.** Você só lê o **catálogo** (`dominio tabelas`) e
  **contagens e somas por empresa** (`dominio sql` com `COUNT`, `SUM`, `MIN`, `MAX` e `GROUP BY`). **Nunca** selecione
  nome, CPF, PIS, RG, salário de uma pessoa, nascimento, endereço, telefone ou e-mail de funcionário, de sócio, de
  cliente ou de fornecedor, nem `SELECT *` de tabela de pessoas ou de lançamentos.
- **A descrição das contas e o histórico dos lançamentos também ficam no Domínio.** O plano de contas de uma empresa
  tem conta com o nome do sócio (o pró-labore, o empréstimo de sócio), do cliente, do fornecedor e o número da conta
  bancária; o histórico do lançamento tem o nome de quem pagou e de quem recebeu. **Nunca** mostre a descrição de uma
  conta de uma empresa nem o histórico de um lançamento. Pra entender o plano, use a classificação (o "1.1.1.02"), o
  tipo e a natureza, e as contagens; descrição, só a de um plano padrão do escritório que não seja de uma empresa
  cliente, se existir, e só dos grupos (as sintéticas).
- **Saldo, receita e folha de uma empresa ficam fora da conversa e do repositório**: o que é por empresa vai pra
  arquivos em `C:\ponte-dominio\` (fora do repositório), pelo `dominio sql` com a saída num arquivo de lá; aqui, só o
  escritório inteiro e contagens ("em 41 empresas as duas contas batem"). Grupo com menos de 3 empresas, só a
  contagem.
- **Não abra o `C:\ponte-dominio\config.ini`** (nem Read, `type`, `cat` ou `Get-Content`): a senha do banco e a chave
  da ponte estão nele. Pra saber como ficou: `py -3 -m ponte conferir` e o log do dia.
- **Repositório público**: nada de host, IP, porta, Engine, nome do banco, usuário, senha, nome de cliente, CNPJ ou
  valor de uma empresa. Das tabelas do Domínio, só as que os rascunhos usam (o nome, as colunas usadas e a descrição do
  catálogo) — **nunca o catálogo inteiro** (é a documentação da Thomson Reuters).
- Código: crie e mexa **só** em `ponte/rascunhos/contabil_*.sql` e nos dois arquivos desta fila. **Não mexa** em
  `ponte/consultas/`, `ponte/*.py`, `supabase/` nem nos testes. Se um comando da ponte falhar por causa do código, não
  conserte: anote o erro (a mensagem, sem valores) e siga.
- **Não rode** o `instalar.ps1` e **não rode** o `ponte rodar` sem `--sem-enviar` (quem manda pro sistema é a tarefa das
  7h). Não mexa nas tarefas do Agendador nem nas opções de energia do PC.
- **Consulta pesada**: cada rascunho tem de rodar em até 60 segundos com `--mes 2026-10`. Passou, anote o tempo e a
  parte cara, e proponha no DUVIDAS o caminho mais leve (um saldo que o Domínio já guarda, só os 13 meses, só as
  contas de banco e caixa…).
- Commits em pt-BR.

## Antes de começar
```
git fetch origin --prune
git checkout main
git pull
git checkout -b fila-04-11-contabil
py -3 tests/ponte.test.py
```
O teste da ponte tem de terminar em "Tudo certo.".

## 1. O plano de contas
O objetivo: saber, em cada empresa, quais contas são **o caixa, os bancos, a receita bruta, os salários e o
pró-labore com os encargos, as transitórias**, e a **natureza** de cada uma (devedora ou credora).
1. **O cadastro das contas** (`dominio tabelas --procurar "plano de contas"`, `--procurar conta`,
   `--procurar classificacao`, `--procurar reduzido`, `--procurar natureza`, `--procurar analitica`): a tabela, a
   chave (a empresa e o código reduzido, que é o que a `ctlancto` usa a débito e a crédito — ache as duas colunas da
   conta na `ctlancto`), a classificação, o tipo (sintética ou analítica), a natureza, o grau e a data de inativação.
2. **Plano por empresa ou plano padrão**: as empresas têm cada uma o seu plano, ou usam um plano do escritório
   (`--procurar "plano padrao"`, ou o código do plano na empresa)? Quantas empresas por plano, e quantas com plano
   próprio.
3. **O caixa e os bancos**: se o Domínio marca a conta (um tipo "disponível", "conta bancária", o vínculo com o banco
   ou com a conciliação — `--procurar banco`, `--procurar caixa`, `--procurar disponivel`, `--procurar
   "conta corrente"`) ou se só a classificação diz (o grupo das disponibilidades do ativo circulante). Anote qual
   caminho e por quê, com contagens do escritório inteiro (quantas contas analíticas por tipo; em quantas empresas
   ativas o caminho acha pelo menos um caixa e um banco).
4. **A receita bruta, a folha e as transitórias**, pelo mesmo jeito (o campo, se houver; senão a classificação): as
   contas de receita bruta de vendas e de serviços e a de devolução de vendas; as de salários e ordenados, 13º,
   férias, pró-labore, INSS e FGTS; e as transitórias ou "a classificar" (`--procurar transitoria`, `--procurar
   classificar`). A **retificadora** (depreciação e amortização acumuladas, provisões, que têm o saldo do lado
   contrário do grupo): ache como o Domínio marca, pro item 4 não chamar de estranho o que não é.

## 2. Até onde cada empresa está lançada
1. **O último lançamento** em cada conta de banco e no caixa (a data, na `bethadba.ctlancto`, fora o zeramento —
   `orig_lan = 2`, como no `contabil.sql`), até o último dia do mês da consulta. Por empresa: quantas contas de banco
   tiveram movimento nos 12 meses antes (`banco_contas`), a data do último lançamento da conta de banco **mais
   atrasada** entre elas (`banco_ate`), a da mais adiantada (`banco_ultimo`) e a do caixa (`caixa_ate`). A conta de
   banco sem movimento nos 12 meses fica de fora (é a conta encerrada).
2. **A conciliação bancária**: se o Domínio guarda a conciliação (`--procurar concilia`, `--procurar extrato`,
   `--procurar ofx`, `--procurar "saldo do banco"`), até que dia cada conta foi conciliada — é o sinal mais forte de
   "feita até". Por empresa: `conciliado_ate` (a data mais atrasada entre as contas que conciliam) e `conciliadas`
   (quantas contas conciliam).
3. **A origem dos lançamentos** (`orig_lan`, já sabido: 1 normal, 2 zeramento, 4 a 7 a escrita fiscal, 10 a apuração,
   13 a folha; ache no catálogo o que é cada uma das outras — a 39 apareceu com 1.780 linhas em 09/2026 — e se há uma
   do extrato importado): por empresa e mês, quantos lançamentos de cada grupo de origem. Se a `ctlancto` guarda **o
   dia em que o lançamento foi feito** (a data de inclusão ou de digitação, diferente da `data_lan`), anote a coluna:
   o maior dia de inclusão dos lançamentos de um mês diz quando a contabilidade daquele mês foi mexida pela última
   vez. **Não selecione o usuário** que lançou (é o login de uma pessoa da equipe): só contagens.
4. **O rascunho** `ponte/rascunhos/contabil_andamento.sql` (`?` = primeiro dia, `?` = último dia do mês; uma linha
   por empresa, já somada), com as colunas que existirem de verdade: `codigo`, `banco_contas`, `banco_ate`,
   `banco_ultimo`, `caixa_ate`, `conciliadas`, `conciliado_ate`, `lanc_normais`, `lanc_extrato` (se o extrato
   importado tiver origem própria), `lanc_fiscal` (4 a 7), `lanc_folha` (13), `lanc_apuracao` (10), `lanc_outros` e
   `incluido_ate` (o maior dia de inclusão dos lançamentos do mês, se houver). Coluna que o Domínio não tem: fora, e
   anote. Comece com o comentário curto: as tabelas, o que conta e o que fica de fora.
5. **A distribuição do escritório inteiro**, com `--mes 2026-10` (só contagens): em quantas empresas ativas a conta de
   banco mais atrasada está em 10/2026, em 09/2026, de 06 a 08/2026, antes de 06/2026 e sem conta de banco com
   movimento; o mesmo pro caixa e pra conciliação. E em quantas o mês de 10/2026 tem lançamento da escrita fiscal e da
   folha.

## 3. O encerramento do exercício
1. Por empresa e ano, **o zeramento** (`orig_lan = 2`): o dia dele em 2024 e em 2025 e, se a `ctlancto` guarda o dia de
   inclusão, quantos lançamentos do ano entraram **depois** do zeramento (o ano foi mexido depois de encerrado, e o
   zeramento ficou velho).
2. **O rascunho** `ponte/rascunhos/contabil_encerramento.sql` (`?` = o primeiro e `?` = o último dia do ano):
   `codigo`, `zerado_em` e `lancados_depois` (se der).
3. Contagens do escritório inteiro: quantas empresas ativas têm o zeramento de 2025 e quantas não; quantas têm
   lançamento de 2025 entrado depois do zeramento.

## 4. Os saldos estranhos no fim do mês
O objetivo: **o que a Adaini olharia no balancete antes de fechar o mês**, contado pelo sistema.
1. **Como sai o saldo**: se o Domínio guarda o saldo das contas por mês (`--procurar saldo`, `--procurar
   "saldo inicial"`, `--procurar abertura`) ou se ele sai da soma dos lançamentos desde o início. Anote qual e o tempo.
2. Por empresa, no último dia do mês:
   - `caixa_negativo`: quantas contas de caixa com saldo credor (o caixa não pode ficar negativo);
   - `contra_natureza`: quantas contas analíticas com saldo do lado contrário da natureza, **fora as retificadoras**
     (item 1.4);
   - `transitorias`: quantas contas transitórias ou "a classificar" com saldo diferente de zero, e `transitorias_valor`
     (a soma do saldo delas, em valor absoluto — fica só no arquivo de `C:\ponte-dominio\`, nunca aqui).
3. **O rascunho** `ponte/rascunhos/contabil_saldos.sql` (`?` = o último dia do mês): `codigo`, `caixa_negativo`,
   `contra_natureza`, `transitorias`, `transitorias_valor`.
4. Contagens do escritório inteiro em 10/2026: quantas empresas ativas com caixa negativo, com conta contra a natureza
   e com transitória com saldo; e, das contas contra a natureza, a contagem pelos 2 primeiros níveis da classificação
   (quantas no ativo circulante, no passivo circulante…), pra se ver se a regra das retificadoras pegou tudo.

## 5. A receita e a folha lançadas
O objetivo: **o contábil bater com o fiscal e com a folha do próprio Domínio** — o sinal de que a integração entrou
inteira no mês.
1. Por empresa e mês:
   - `receita_lancada`: o crédito do mês nas contas de receita bruta, menos o débito na de devolução de vendas;
   - `folha_lancada`: o débito do mês nas contas de salários e ordenados, 13º, férias e pró-labore;
   - `encargos_lancados`: o débito do mês nas de INSS e FGTS da empresa.
2. **A conferência dentro do Domínio**, com `--mes 2026-09`, as duas somas na mesma consulta e um `CASE` que diz
   "bate"/"não bate"/"o contábil sem"/"o fiscal sem" (mostre só a contagem por resultado):
   - a `receita_lancada` contra a `receita_bruta` do `ponte/consultas/faturamento.sql`, até R$ 1,00;
   - a `folha_lancada` contra a soma dos proventos e do pró-labore do `ponte/consultas/folha_valores.sql`, até R$ 1,00.
   Onde não bate, procure o porquê pela origem dos lançamentos e pelas contas (só contagens e somas do escritório
   inteiro) e anote no DUVIDAS.
3. **O rascunho** `ponte/rascunhos/contabil_cruzamentos.sql` (os mesmos `?` do mês): `codigo`, `receita_lancada`,
   `folha_lancada`, `encargos_lancados`.

## 6. Registro, DUVIDAS e push
O `docs/FILA-CODE-2026-11-04-CONTABIL-DUVIDAS.md` com, pra cada rascunho: as tabelas e as colunas usadas (com a
descrição do catálogo), a regra de cada coluna e o que ficou de fora, o tempo com `--mes 2026-10`, os números da
conferência (só do escritório inteiro e contagens) e o que o Claude da sessão do Samuel tem de decidir (o caminho do
caixa e dos bancos, se a conciliação existe e vale mais que o último lançamento, a regra das retificadoras…). O
registro preenchido, `py -3 tests/ponte.test.py` verde, commit e `git push origin fila-04-11-contabil`.

## Registro de progresso
| Data | Item | Situação / observação |
|---|---|---|
| | 1 · O plano de contas | |
| | 2 · Até onde cada empresa está lançada | |
| | 3 · O encerramento do exercício | |
| | 4 · Os saldos estranhos | |
| | 5 · A receita e a folha lançadas | |
| | 6 · Push | |
