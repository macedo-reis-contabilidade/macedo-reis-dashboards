# Fila do Claude Code — 24/11/2026 · o fiscal no Domínio: o imposto apurado de cada mês, as retenções e as guias que o Domínio gera · branch `fila-24-11-fiscal`

> **Para o Code do PC do escritório.** **Leia este arquivo inteiro antes de começar**, junto com o
> `docs/FILA-CODE-2026-11-11-COMPARATIVO-DUVIDAS.md` (os códigos dos impostos da `geimposto`, as tabelas de impostos de
> cada segmento — a `efimpsai`, a `efimpent` e a `efimpser` —, a apuração na `efsdoimp` e o regime da empresa pelo
> `RFED_PAR`) e a seção "O casamento com o que o Domínio apura" do `docs/FILA-CODE-2026-11-11-FECHAMENTO-DUVIDAS.md`
> (o saldo a recolher `sdev_sim`, a GPS da `foguiainss` e a guia do FGTS da `fofgtsfilial`).
> Faça os itens **inteiros, sem parar pra perguntar**: nenhum item precisa do Samuel na frente do PC. Na dúvida, a
> opção que **muda menos**, anotada em `docs/FILA-CODE-2026-11-24-FISCAL-DUVIDAS.md`. Ao terminar: o **Registro de
> progresso** (fim deste arquivo) preenchido, commit e `git push origin fila-24-11-fiscal`. **Nunca** push em `main`
> nem merge pra ela. **Esta fila não muda a ponte nem instala nada**: só descobre e escreve rascunhos.

## O que é
- Em 16/11 o Samuel aprovou as leituras novas do Domínio pro fiscal, depois das do DP (a fila
  `docs/FILA-CODE-2026-11-24-DP.md`): **o imposto apurado no Domínio aparece na tarefa de cada obrigação** (a GIA, a
  EFD, o ICMS-ST, o DEISS, o PGDAS: "apurado no Domínio: R$ X a recolher"), **a tarefa da EFD-Reinf diz se o mês teve
  retenção**, o Comparativo tributário usa o imposto de verdade do Presumido e do Real, e **a mesma leitura descobre se
  o Domínio guarda as guias que gera** (é o que decide se a guia do mês pode chegar sozinha ao sistema, um passo que
  vem depois).
- **Sai do PC só soma e contagem por empresa e por mês**, como tudo o que a ponte manda. Nenhuma nota, nenhum cliente
  ou fornecedor da empresa, nenhuma guia (nem o código de barras, nem a linha digitável, nem o PDF).
- Esta fila só descobre e escreve rascunhos, numa pasta que a ponte **não lê** (`ponte/rascunhos/`). O contrato do
  pacote, as colunas no banco e o que aparece nas tarefas **não mudam aqui**: são do Claude da sessão do Samuel, depois
  de revisar, com o "vai" dele.

## Regras (as de 04/11, que valem todas)
- **Dado pessoal não sai do Domínio — nem pra esta conversa.** Você só lê o **catálogo** (`dominio tabelas`) e
  **contagens e somas por empresa** (`dominio sql` com `COUNT`, `SUM`, `MIN`, `MAX` e `GROUP BY`). **Nunca** selecione
  nome, CPF, CNPJ, endereço, telefone ou e-mail de cliente, de fornecedor, de sócio ou de funcionário, nem `SELECT *`
  de tabela de notas, de itens, de pessoas, de impostos ou de guias.
- **A guia fica no Domínio**: o código de barras, a linha digitável e o PDF nunca saem na tela, no registro ou num
  arquivo. Pra saber se existem, conte as linhas com a coluna preenchida (`COUNT(coluna)`, ou o tamanho com
  `LENGTH`/`DATALENGTH`), sem ler o conteúdo.
- **Imposto, retenção e guia de uma empresa ficam fora da conversa e do repositório**: o que é por empresa vai pra
  arquivos em `C:\ponte-dominio\` (fora do repositório), com a saída do `dominio sql` redirecionada
  (`> C:\ponte-dominio\fiscal_apuracoes.txt`, e assim por diante). No registro e no DUVIDAS, só o **escritório
  inteiro** e **contagens** ("em 41 empresas o DAS apurado bate"). Grupo com menos de 3 empresas, só a contagem.
- **Não abra o `C:\ponte-dominio\config.ini`** (nem Read, `type`, `cat` ou `Get-Content`).
- **Repositório público**: nada de host, IP, porta, Engine, nome do banco, usuário, senha, nome de cliente, CNPJ, código
  de empresa ou valor de uma empresa. Das tabelas do Domínio, só as que os rascunhos usam (o nome, as colunas usadas e a
  descrição do catálogo) — **nunca o catálogo inteiro** (é a documentação da Thomson Reuters).
- Código: crie e mexa **só** em `ponte/rascunhos/fiscal_*.sql` e nos dois arquivos desta fila. **Não mexa** em
  `ponte/consultas/`, `ponte/*.py`, `supabase/`, nas telas nem nos testes. Se um comando da ponte falhar por causa do
  código, não conserte: anote o erro (a mensagem, sem valores) e siga.
- **Não rode** o `instalar.ps1` nem o `ponte rodar`, e não rode a ponte da Receita. Não mexa nas tarefas do Agendador
  nem nas opções de energia do PC.
- **Não rode nada entre 6h50 e 7h20, nem entre 8h20 e 9h00**: são as duas tarefas do dia.
- **Consulta pesada**: cada rascunho tem de rodar em até 60 segundos com `--mes 2026-10`. Passou, anote o tempo e a
  parte cara, e proponha no DUVIDAS o caminho mais leve.
- Cada rascunho começa com o comentário curto de sempre: as tabelas, o que conta e o que fica de fora. Os dois `?` são
  sempre o primeiro e o último dia do mês (o `--mes`). **Uma linha por empresa, já somada**; coluna que o Domínio não
  tem fica de fora, anotada.
- Commits em pt-BR.

## Antes de começar
1. Esta fila vem **depois** da `docs/FILA-CODE-2026-11-24-DP.md`: se o ramo dela (`fila-24-11-dp`) ainda não existe em
   origin, faça ela antes.
2. Precisa da conexão com o Domínio: `py -3 -m ponte conferir` uma vez, da pasta `C:\ponte-dominio\app`, como na fila
   do DP (abriu, siga; não abriu pela rede, pare sem criar o ramo, e o plantão tenta de novo na hora seguinte; por
   usuário ou senha, não tente de novo, crie o ramo, anote e faça o push). No registro, sem a linha do IP e sem a
   mensagem do driver (só os códigos).
3. Então:
```
git fetch origin --prune
git checkout main
git pull
git checkout -b fila-24-11-fiscal
py -3 tests/ponte.test.py
```
O teste da ponte tem de terminar em "Tudo certo.". Se não terminar, **pare aqui**: registro e push.

## 1. O imposto apurado de cada mês
O objetivo: por empresa e mês, **o que o Domínio apurou a recolher** de cada imposto, e **quando** (a prova que a
tarefa da obrigação vai mostrar: "apurado no Domínio em dd/mm: R$ X").
1. **Onde está**: a `bethadba.efsdoimp` ("Saldo dos Impostos", uma linha por empresa, imposto, competência e
   periodicidade: `pdic_sim` 6 mensal e 7 trimestral), com o `sdev_sim` ("Saldo a Recolher"). Ache também: a coluna da
   competência, o débito, o crédito, o saldo credor que passa pro mês seguinte e, se houver, **o dia em que a apuração
   foi feita** (uma data de inclusão ou de alteração da linha — `--procurar "saldo dos impostos"`, `--procurar
   apuracao`, `--procurar "data da apuracao"`) e alguma marca de guia gerada ou de pagamento.
2. **O rascunho** `ponte/rascunhos/fiscal_apuracoes.sql`, por empresa, do mês (pelos códigos da `geimposto` que a fila
   de 11/11 listou):
   - `apur_das` (44); `apur_icms` (1); `apur_icms_st` (9); `apur_difal` (8); `apur_iss` (3); `apur_iss_retido` (18);
     `apur_pis` (4 e 17); `apur_cofins` (5 e 19); `apur_irpj` (7); `apur_csll` (6); `apur_irrf` (16);
   - `apurado_em`: o dia mais recente em que alguma apuração da empresa no mês foi feita (se o Domínio guardar; senão,
     fica de fora, anotado);
   - o IRPJ e a CSLL trimestrais só no último mês do trimestre (diga no comentário como achou o trimestre).
   Saldo a recolher zero com a apuração feita é zero; sem a linha da apuração, a coluna fica nula (o Domínio não
   apurou). Diga no comentário qual dos dois cada caso é.
3. **A conferência dentro do Domínio** (só a contagem por resultado), em 10/2026: (a) o PIS e a Cofins do Presumido
   contra o `pis_apurado` e a `cofins_apurada` do `piscofins.sql` (a versão 5), até R$ 1,00; (b) o DAS (44) contra o
   valor do DAS da apuração do Simples do Domínio (a tabela que o `faturamento.sql` usa pra a alíquota efetiva, se ela
   tiver o valor), até R$ 1,00; (c) quantas empresas ativas têm alguma apuração no mês, por regime (a leitura do
   `RFED_PAR` da fila de 11/11).
4. **Contagens do escritório inteiro**, em 09 e 10/2026: quantas empresas com cada imposto apurado (e com saldo a
   recolher maior que zero), por regime; e, se houver o `apurado_em`, em que dia do mês seguinte as apurações costumam
   ser feitas (a contagem por semana).

## 2. As retenções
O objetivo: por empresa e mês, **se houve retenção** nas notas de serviço (tomadas e prestadas) e de quanto: é o que diz
se a EFD-Reinf do mês tem movimento (o INSS retido, nos eventos R-2010 e R-2020; o IR e o PIS, a Cofins e a CSLL
retidos, nos R-4010 e R-4020) e o que o DARF da retenção tem de pagar.
1. **Onde está**: as retenções de cada segmento nas tabelas de impostos (a `efimpent` nas notas tomadas e a `efimpser`
   nas prestadas; os códigos da `geimposto` do IRRF 16, do ISS retido 18 e os do PIS, da Cofins, da CSLL e do INSS
   retidos — ache os códigos), ou em colunas do próprio segmento (`--procurar retido`, `--procurar retencao`,
   `--procurar "inss retido"`, `--procurar csrf`, `--procurar reinf`).
2. **O rascunho** `ponte/rascunhos/fiscal_retencoes.sql`, por empresa, do mês:
   - nas tomadas: `ret_tomadas_notas` (quantas notas com alguma retenção), `ret_irrf_tomadas`, `ret_csrf_tomadas` (o
     PIS, a Cofins e a CSLL juntos), `ret_inss_tomadas` e `ret_iss_tomadas`;
   - nas prestadas: `ret_prestadas_notas`, `ret_irrf_prestadas`, `ret_csrf_prestadas`, `ret_inss_prestadas` e
     `ret_iss_prestadas`.
3. **A conferência dentro do Domínio** (só a contagem): o IRRF (16) e o ISS retido (18) das notas contra os mesmos
   impostos na `efsdoimp` do mês, empresa por empresa, até R$ 1,00. E, se o Domínio guardar a EFD-Reinf (os eventos ou
   o fechamento do mês — `--procurar reinf`), em quantas empresas a Reinf do mês existe e se ela tem movimento quando
   há retenção nas notas.
4. **Contagens do escritório inteiro**, em 09 e 10/2026: quantas empresas com retenção, por tipo e por regime.

## 3. As guias que o Domínio gera
O objetivo: saber **se o banco guarda a guia que a pessoa gera no Domínio** (a do ICMS, o DARF, a GPS ou a da
DCTFWeb, a do FGTS, a do ISS, o DAS se o Domínio gerar) e **o que guarda** (o PDF, o código de barras ou a linha
digitável, o valor, o vencimento, o dia em que foi gerada). Se guardar, a guia pode um dia chegar sozinha ao sistema,
pro "Enviar guia" que já existe (é outra decisão, do Samuel, e outra fila).
1. **Onde está**: `--procurar guia`, `--procurar "codigo de barras"`, `--procurar "linha digitavel"`, `--procurar
   darf`, `--procurar "documento de arrecadacao"`, `--procurar gnre`, `--procurar "data de vencimento"`; e as colunas
   `long binary` (o PDF) das tabelas que aparecerem. A GPS (`bethadba.foguiainss.total_guia`) e a guia do FGTS
   (`bethadba.fofgtsfilial.total_fgts`) a fila de 11/11 já achou: veja se elas têm o código de barras e o vencimento.
2. **O rascunho** `ponte/rascunhos/fiscal_guias.sql`, por empresa e tipo de guia, do mês (pela competência da guia):
   `guias` (quantas), `guias_com_codigo` (com o código de barras ou a linha digitável preenchidos), `guias_com_pdf`
   (com o PDF preenchido), `guias_valor` (a soma), `guias_vencimento` (o vencimento mais cedo) e `guias_geradas_em` (o
   dia mais recente em que uma foi gerada, se o Domínio guardar). **Nunca** o conteúdo do código, da linha ou do PDF.
3. **A conferência** (só a contagem): o valor das guias de cada tipo contra o saldo a recolher do item 1 do mesmo
   imposto e mês, até R$ 1,00 (a guia é a apuração que foi pra pagar?).
4. **Contagens do escritório inteiro**, em 09 e 10/2026, por tipo de guia: em quantas empresas existe, quantas com o
   código de barras, quantas com o PDF; e, se o Domínio guardar o PDF, o tamanho médio (pra saber o peso de mandar).

## 4. Revisão, registro, DUVIDAS e push
1. **Uma revisão independente** dos rascunhos e do DUVIDAS (o SQL, a privacidade e as contas), como nas filas de
   11/11: cada achado conferido por outro revisor antes de mudar.
2. O `docs/FILA-CODE-2026-11-24-FISCAL-DUVIDAS.md` com, pra cada rascunho: as tabelas e as colunas usadas (com a
   descrição do catálogo), a regra de cada coluna e o que ficou de fora, o tempo com `--mes 2026-10`, os números da
   conferência (só do escritório inteiro e contagens) e o que o Claude da sessão do Samuel tem de decidir (onde o
   Domínio não tem o dado, onde há dois caminhos, o que ficaria pesado todo dia, o que a Thalia precisa confirmar).
3. O resultado por empresa fica só em `C:\ponte-dominio\fiscal_*.txt`, nunca no repositório.
4. O registro preenchido, `py -3 tests/ponte.test.py` verde, commit e `git push origin fila-24-11-fiscal`.

## Registro de progresso
| Data | Item | Situação / observação |
|---|---|---|
| | Antes | |
| | 1 | |
| | 2 | |
| | 3 | |
| | 4 | |
