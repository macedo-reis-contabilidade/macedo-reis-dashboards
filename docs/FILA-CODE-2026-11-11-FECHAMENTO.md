# Fila do Claude Code — 11/11/2026 · o padrão dos lançamentos digitados: o estudo pro fechamento automático das contabilidades · branch `fila-11-11-fechamento`

> **Para o Code do PC do escritório.** **Leia este arquivo inteiro antes de começar**, junto com o
> `docs/FILA-CODE-2026-11-04-CONTABIL-DUVIDAS.md`, o `docs/FILA-CODE-2026-11-05-DIFERENCAS-DUVIDAS.md` (o plano de
> contas de cada empresa, copiado do plano modelo, a classificação do caixa e dos bancos, as origens da `ctlancto` e o
> que o `origens.sql` conta como lançamento do contador) e o `docs/FILA-CODE-2026-11-11-COMPARATIVO-DUVIDAS.md` (as
> contas de resultado pelo plano modelo, a apuração dos impostos na `efsdoimp` e o regime da empresa).
> Faça os itens **inteiros, sem parar pra perguntar**: nenhum item precisa do Samuel na frente do PC. Na dúvida, a
> opção que **muda menos**, anotada em `docs/FILA-CODE-2026-11-11-FECHAMENTO-DUVIDAS.md`. Ao terminar: o **Registro de
> progresso** (fim deste arquivo) preenchido, commit e `git push origin fila-11-11-fechamento`. **Nunca** push em
> `main` nem merge pra ela. **Esta fila não muda a ponte, não instala nada e não grava nada no Domínio**: só lê,
> conta e escreve rascunhos.

## O que é
- O Samuel pôs na pauta (11/11/2026) **uma forma automática de fechar as contabilidades**: a empresa pequena repete
  o mesmo padrão todo mês, e o que hoje é digitado pode sair de um método (a lista de lançamentos de cada perfil de
  empresa, com o valor que o Domínio já apura).
- O que o sistema já sabe, pela ponte (os meses dados como feitos, de 10/2025 em diante): 82% dos lançamentos vêm da
  escrita fiscal, 13% do extrato importado e **só 4% são digitados pelo contador**; o mês típico de uma empresa fecha
  com **6 lançamentos digitados**. O que a ponte não diz é **quais são esses lançamentos**: ela conta por origem, não
  por conta.
- Esta fila responde a isso, com o ano de 2025 (que a maior parte das empresas já tem fechado): **o que se digita, em
  que contas, com que repetição e de onde sai o valor**. É o que o Diego e o Samuel precisam pra desenhar o método
  (a lista de lançamentos do mês de cada perfil de empresa).
- **Nada é lançado e nada muda no Domínio.** O acesso é o de sempre, só leitura. Como os lançamentos do método
  entrariam (o importador do próprio Domínio, com uma pessoa conferindo) é decisão de depois.
- **Sai do PC só o escritório inteiro e contagens.** O que é de uma empresa (os pares de contas dela, os valores)
  fica em arquivos no PC.

## Regras (as de 04/11, que valem todas)
- **Dado pessoal não sai do Domínio — nem pra esta conversa.** Você só lê o **catálogo** (`dominio tabelas`) e
  **contagens e somas** (`dominio sql` com `COUNT`, `SUM`, `MIN`, `MAX` e `GROUP BY`). **Nunca** selecione nome, CPF,
  CNPJ, endereço, telefone ou e-mail de cliente, de fornecedor, de sócio ou de funcionário, nem `SELECT *` de tabela
  de lançamentos, de contas ou de pessoas.
- **A descrição das contas analíticas e o histórico dos lançamentos ficam no Domínio.** A conta analítica tem o nome
  do sócio, do banco, do fornecedor; o complemento do histórico diz quem recebeu. Pra agrupar, use o **código**: a
  classificação da conta (`clas_cta`), o código reduzido, o código do histórico padrão. A descrição só entra
  **dentro do filtro** da consulta (um `LIKE`), nunca na saída.
  - **A exceção, só neste estudo**: o nome dos **grupos** (as contas sintéticas, até o 4º nível da classificação) **do
    plano modelo do escritório** (a empresa 998) pode ir pro DUVIDAS, pra dizer o que é cada par ("1.1.1.01 CAIXA").
    São títulos genéricos de plano de contas. Se algum trouxer nome de pessoa, de banco ou de empresa, vai só o código.
    Das contas das empresas, nunca o nome: quando a classificação da empresa não existe no plano modelo, vai o código
    e "fora do plano modelo".
  - O mesmo pro **histórico padrão**: a descrição só do cadastro da empresa 998 (o texto do modelo, sem complemento);
    se for por empresa, só o código e a contagem.
- **O que é de uma empresa fica fora da conversa e do repositório**: os pares de contas de cada empresa, os valores e
  as contagens por empresa vão pra arquivos em `C:\ponte-dominio\fechamento\` (fora do repositório), pelo `dominio
  sql` com a saída num arquivo de lá. No registro e no DUVIDAS, só o **escritório inteiro** e **contagens** ("em 31
  empresas, 80% ou mais do que se digita se repete todo mês"). Grupo com menos de 3 empresas, só a contagem, sem
  valor.
- **Não abra o `C:\ponte-dominio\config.ini`** (nem Read, `type`, `cat` ou `Get-Content`): a senha do banco e a chave
  da ponte estão nele. Pra saber como ficou: `py -3 -m ponte conferir` e o log do dia.
- **Repositório público**: nada de host, IP, porta, Engine, nome do banco, usuário, senha, nome de cliente, CNPJ,
  código de empresa ou valor de uma empresa. Das tabelas do Domínio, só as que os rascunhos usam (o nome, as colunas
  usadas e a descrição do catálogo) — **nunca o catálogo inteiro** (é a documentação da Thomson Reuters).
- Código: crie e mexa **só** em `ponte/rascunhos/fechamento_*.sql` e nos dois arquivos desta fila. **Não mexa** em
  `ponte/consultas/`, `ponte/*.py`, `supabase/`, nas telas nem nos testes. Se um comando da ponte falhar por causa do
  código, não conserte: anote o erro (a mensagem, sem valores) e siga.
- **Não rode** o `instalar.ps1` e **não rode** o `ponte rodar` sem `--sem-enviar`. Não mexa nas tarefas do Agendador
  nem nas opções de energia do PC.
- **Consulta pesada**: o estudo lê um ano inteiro da `ctlancto`. Cada consulta tem de rodar em até 3 minutos; se
  passar, quebre por trimestre ou por faixa de empresas e some no PC. Rode fora do horário das tarefas (7h00 e 8h30).
  Anote o tempo de cada uma.
- Cada rascunho começa com o comentário curto de sempre: as tabelas, o que conta e o que fica de fora.
- Commits em pt-BR.

## Antes de começar
```
git fetch origin --prune
git checkout main
git pull
git checkout -b fila-11-11-fechamento
py -3 tests/ponte.test.py
```
O teste da ponte tem de terminar em "Tudo certo.". Se não terminar, **pare aqui**: registro e push.

## O recorte (vale pra todos os itens)
- **O ano de 2025**, de janeiro a dezembro, pela data do lançamento.
- **As empresas**: as ativas no Domínio com a contabilidade aberta lá (a `ctparmto`) e pelo menos um lançamento em
  2025.
- **Lançamento digitado**: a origem 1 (`orig_lan = 1`, o `lanc_normais` do `ponte/consultas/origens.sql`: o
  lançamento do contador). Fora o zeramento (`orig_lan = 2`), a escrita fiscal, a folha, o extrato importado, a
  apuração e as outras integrações.
- **O grupo da conta**: a classificação (`clas_cta`) cortada no 4º nível do plano modelo (o caixa é o `1.1.1.01`, os
  bancos o `1.1.1.02`). Se a máscara do plano de alguma empresa for outra, use o caminho que a fila de 05/11 achou
  (a natureza dos grupos) e anote quantas empresas ficaram de fora.
- **A partida múltipla** (um débito pra vários créditos, ou o contrário): diga no DUVIDAS como a `ctlancto` guarda
  (uma linha por perna, com o outro lado zerado? um número de lote?) e como você contou. Se o par não existe na
  linha, conte a perna pelo grupo dela e marque "partida múltipla" do outro lado.

## 1. O tamanho do que se digita
O objetivo: saber quanto se digita por mês em cada empresa, no ano inteiro.
1. **O rascunho** `ponte/rascunhos/fechamento_tamanho.sql`: por empresa e mês de 2025, quantos lançamentos digitados
   e a soma dos valores. O resultado por empresa vai pro arquivo do PC.
2. **Contagens do escritório inteiro** (no DUVIDAS):
   - quantas empresas, quantos meses-empresa com lançamento digitado e o total do ano;
   - a mediana, o 3º quartil e o percentil 90 de lançamentos digitados por mês-empresa;
   - quantas empresas em cada faixa da mediana mensal dela: nenhum, de 1 a 10, de 11 a 30, de 31 a 100, mais de 100;
   - as mesmas faixas separando as empresas **com** e **sem** lançamento em conta de banco (`1.1.1.02`) em 2025, e
     **com** e **sem** folha integrada em 2025;
   - de janeiro a outubro de 2026, só o total de digitados por mês no escritório inteiro (pra ver o ritmo do ano).

## 2. Em que contas: os pares de grupos
O objetivo: dizer **o que** se digita. Quase tudo deve cair em poucos pares (pagar o imposto, pagar a folha, pagar o
fornecedor, o pró-labore, a distribuição de lucros).
1. **O rascunho** `ponte/rascunhos/fechamento_pares.sql`: os lançamentos digitados de 2025 pelo par (grupo da conta
   de débito, grupo da conta de crédito): quantos lançamentos, em quantas empresas, em quantos meses-empresa e a soma
   dos valores.
2. **No DUVIDAS, do escritório inteiro**: os **40 pares com mais lançamentos**, cada um com os dois códigos de grupo,
   o nome dos dois grupos **no plano modelo** (a exceção das regras), os lançamentos, as empresas e a parte do total,
   com a parte acumulada (os 10 primeiros cobrem quanto? os 20? os 40?). O valor somado fica de fora do DUVIDAS.
3. A mesma lista **só das empresas sem lançamento em conta de banco em 2025** (o perfil mais simples: é por onde o
   método deve começar), e **só das com banco**.
4. Quantos lançamentos digitados têm o **caixa** (`1.1.1.01`) de um lado, e quantos têm **banco** (`1.1.1.02`) de um
   lado: no total e nos dois perfis.
5. **O que a integração já lança** (pra saber o que sobra pra digitar): os mesmos pares de grupos, no escritório
   inteiro, dos lançamentos de 2025 da **escrita fiscal** (as origens 4 a 9, 11 e 21 a 29) e da **folha** (a 13): os 15
   maiores de cada uma, com os lançamentos e as empresas. É o que diz se a venda e a compra entram contra o caixa (à
   vista) ou contra clientes e fornecedores (a prazo, e aí a baixa é que se digita), e se a folha entra já paga ou a
   pagar.

## 3. A repetição dentro de cada empresa
O objetivo: medir o "mantém-se o mesmo padrão sempre". Um par de contas **analíticas** que aparece quase todo mês
numa empresa é lançamento que o método pode gerar.
1. **O rascunho** `ponte/rascunhos/fechamento_repeticao.sql`: por empresa, cada par (conta de débito, conta de
   crédito, as duas pelo código reduzido) com o número de meses de 2025 em que apareceu e quantos lançamentos teve. O
   resultado fica só no PC.
2. As classes do par, pela empresa: **fixo** (em 10 meses ou mais), **frequente** (de 4 a 9) e **eventual** (até 3).
   Empresa que entrou no meio do ano: a régua é proporcional aos meses com algum lançamento dela (diga quantas são).
3. **Contagens do escritório inteiro** (no DUVIDAS):
   - dos lançamentos digitados do ano, quantos estão em par fixo, em frequente e em eventual;
   - quantas empresas têm 80% ou mais dos digitados em pares fixos; de 50% a 80%; menos de 50%; e as mesmas três
     faixas nos dois perfis (sem banco e com banco);
   - quantos pares fixos uma empresa tem: a mediana e o percentil 90;
   - dos pares fixos, a que grupos pertencem (os 20 pares de grupos mais comuns entre os fixos, como no item 2).

## 4. De onde sai o valor
O objetivo: pra cada lançamento que se repete, saber se o valor é sempre o mesmo, ou se é um número que o Domínio já
tem. É o que diz se o método consegue calcular sozinho.
1. Nos **pares fixos** do item 3, por empresa:
   - **valor fixo**: um lançamento por mês, e o maior e o menor do ano diferem até 1%;
   - **um por mês, valor que muda**;
   - **vários por mês**.
   No DUVIDAS: quantos pares-empresa e quantos lançamentos em cada um dos três, no total e por par de grupos (os 15
   pares de grupos mais comuns).
2. Nos "um por mês, valor que muda", **tente casar o valor do mês** com o que o Domínio apura, até R$ 1,00, no mês do
   lançamento ou no anterior:
   - o imposto apurado na escrita fiscal (o DAS do Simples; o ICMS, o PIS, a Cofins, o IRPJ e a CSLL a recolher: a
     `efsdoimp` e a apuração do Simples, como nas filas de 03/11 e de 11/11);
   - o líquido da folha, o pró-labore, o FGTS e o INSS das guias (as tabelas da fila de 03/11).
   No DUVIDAS, só contagens: "em N pares-empresa o valor do mês é o imposto apurado do mês anterior", "em N é o
   líquido da folha", "em N não casou com nada".
3. Se o item 2 não couber no tempo, escreva o caminho (as tabelas e a junção) e faça só pros pares cujo grupo é o de
   impostos a recolher e o de salários a pagar (pela classificação do plano modelo).

## 5. O histórico
1. Dos lançamentos digitados de 2025: quantos têm **código de histórico padrão** e quantos só texto livre (ache a
   coluna no catálogo: `--procurar historico`).
2. Os 20 códigos de histórico padrão mais usados no escritório inteiro, com a contagem e a descrição **do cadastro do
   plano modelo** (a exceção das regras). Se o histórico padrão for cadastrado por empresa, só o código e a contagem,
   e quantas empresas têm cadastro próprio.

## 6. O que o Domínio já tem pra lançar sozinho
1. No catálogo (`dominio tabelas --procurar`): tabelas de **lançamento padrão**, **lançamento automático**, **modelo
   de lançamento**, **lançamentos recorrentes** ou parecidas (tente `padrao`, `automatico`, `modelo`, `recorrente`,
   `lote`). Pra cada uma que existir: o nome, a descrição do catálogo, as colunas que importam e **quantas empresas
   têm linha** nela (só a contagem).
2. **A importação**: existe origem de lançamento **importado** (por arquivo, pelo "Importador") na `ctlancto`? O nome
   de cada origem está na `bethadba.CTORIGEM_LANCAMENTO` (é o catálogo do Domínio: o código e o nome da origem podem
   ir pro DUVIDAS). Quantos lançamentos de cada ano (2023 a 2026) têm essa origem e em quantas empresas. É o que diz
   se o escritório já usou o importador de lançamentos alguma vez.
3. **O extrato pela configuração** (a fila de 04/11 achou o extrato importado em 28 empresas): das contas de banco
   com extrato importado em 2025, quantos lançamentos do extrato nasceram **pela configuração** (a regra que lança
   sozinha) e quantos foram classificados à mão, se o Domínio marca a diferença. Só a contagem do escritório inteiro.

## 7. Registro, DUVIDAS e push
O `docs/FILA-CODE-2026-11-11-FECHAMENTO-DUVIDAS.md` com, pra cada item: as tabelas e as colunas usadas (com a
descrição do catálogo), a regra de cada conta, o tempo de cada consulta, os números (só do escritório inteiro e
contagens) e, no fim, **o que você concluiria**: que parte do que se digita um método de regras fixas cobre, em
quantas empresas, e o que fica de fora. O registro preenchido, `py -3 tests/ponte.test.py` verde, commit e `git push
origin fila-11-11-fechamento`. O resultado por empresa fica só em `C:\ponte-dominio\fechamento\`, nunca no
repositório.

## Registro de progresso
| Data | Item | Situação / observação |
|---|---|---|
| 11/11/2026 | Antes | Feito. `git fetch --prune`, `main` atualizada, a branch `fila-11-11-fechamento`; `py -3 tests/ponte.test.py`: "Tudo certo.". |
| 12/11/2026 | O recorte | Feito: 75 empresas (ativas, com a `ctparmto` e lançamento em 2025; 74 com a origem 1). O grupo é a classificação cortada em 5 dígitos (a máscara do `ctparmto` diz outra coisa; o guardado é o que vale). A partida múltipla é uma linha por perna, com o outro lado zerado, e o mesmo `codi_lote` (90% das linhas são lotes X, de uma linha); contei a perna e marquei "partida múltipla" do outro lado. **Achado: 8.666 das 15.654 linhas da origem 1 de 2025 entraram pelo importador de lançamentos (`origem_reg` = 2, "Imp. Layout"), em 19 empresas, quase todas a partir de 10/2025; digitado à mão: 6.988.** Cada item tem as duas leituras. 5 empresas com o plano de outra estrutura (grupos terminados em 00 fora do modelo; 1 com o plano invertido): ficaram dentro, contadas e marcadas. |
| 12/11/2026 | 1 | Feito: `ponte/rascunhos/fechamento_tamanho.sql`, mês a mês (o ano numa consulta passou de 3 min; de 3 a 54 s por mês), o resultado por empresa em `C:\ponte-dominio\fechamento\`. Mediana de 5 linhas por mês-empresa (3º quartil 12, p90 36; só à mão, 10 e 21); 54 das 75 empresas com mediana de 1 a 10; as faixas com e sem banco e folha, e o ritmo de 2026, no `-DUVIDAS`. |
| 12/11/2026 | 2 | Feito: `fechamento_pares.sql` (de 15 a 48 s por lote). Os 40 pares com os títulos do plano modelo, nas três listas, e os 15 da escrita fiscal e da folha. Os 10 primeiros cobrem 69,6% (à mão, 47,8%; nas sem banco, 66,1%, e 87,1% sem as 2 de plano de outra estrutura). O caixa contra o banco é 46,6% da origem 1, quase todo do importador. A venda entra contra o caixa; a folha entra a pagar e já paga. |
| 12/11/2026 | 3 | Feito: `fechamento_repeticao.sql` (de 4 a 8 s por lote). Sem as 6 empresas de 1 ou 2 meses (a régua não separa nada nelas): fixo 31,9% das linhas (à mão, 40,9%), frequente 24,4%, eventual 43,8%; 6 das 68 empresas com 80% ou mais em pares fixos (5 delas sem banco); pares fixos por empresa, mediana 2 e p90 6. |
| 12/11/2026 | 4 | Feito: `fechamento_valores.sql` e `fechamento_casamento.sql` (o casamento pessoa a pessoa feito dentro do Domínio: só a contagem sai). Dos pares fixos de valor que muda, casam o DAS (14 pares-empresa), a GPS (8) e o FGTS (4) da competência anterior; pessoa a pessoa, 181 das 15.654 linhas. O maior par fixo, a provisão dos honorários contábeis (pelo nome das contas, em 37 empresas), não casa com nada do Domínio. |
| 12/11/2026 | 5 | Feito: 2.364 lançamentos (15,1%) com código de histórico padrão, 13.290 só texto; o histórico é cadastrado por empresa (as 75 com cadastro próprio, nenhuma igual ao modelo): só o código e a contagem dos 20 mais usados. |
| 12/11/2026 | 6 | Feito: o lançamento padrão (`ctlanctopadrao`, 136 empresas) não é usado desde 2012; não há lançamento recorrente nem automático no catálogo. A `CTORIGEM_LANCAMENTO` não tem origem de importado: quem marca é a `ctlancto.origem_reg` (2023: 1.739 linhas em 6 empresas; 2024: 199 em 2; 2025: 9.435 em 20; 2026: 30 em 2). O extrato pela configuração: 91,1% dos lançamentos do extrato de 2025 marcados "Sistema". Das 19 que importaram em 2025, 11 trocaram a 39 pelo importador; em 2 empresas os dois caem na mesma conta no mesmo mês (582 linhas, a conferir). |
| 12/11/2026 | Revisão | Uma revisão independente (a privacidade, a fila, o SQL, as afirmações e os números refeitos, cada achado conferido por outro revisor) confirmou 19 achados, todos tratados: as empresas de 1 ou 2 meses saíram da classificação; as 5 de plano de outra estrutura, contadas e separadas; a cobertura da conclusão é 16,3% (não 17%); o casamento pessoa a pessoa ganhou a coluna exata (`alguma`) e rodou de novo; o empate do PIS, da Cofins e do ISS vai no rótulo; as afirmações sobre os honorários, o extrato e os juros, medidas ou ditas como leitura. A lente de privacidade não achou nada. |
| 12/11/2026 | 7 | Feito: o `docs/FILA-CODE-2026-11-11-FECHAMENTO-DUVIDAS.md` (com o que eu concluiria: um método de regras fixas, com o valor que o Domínio apura, cobre ~12,5% do digitado à mão, ~16% com os honorários se o valor vier da cobrança do sistema; serve em 13 das 68 empresas, 10 delas sem banco; o volume grande é o banco, que é caminho do extrato), este registro, `py -3 tests/ponte.test.py` verde, o commit e o push. O resultado por empresa ficou só em `C:\ponte-dominio\fechamento\`. Nada foi instalado nem lançado no Domínio. |
