# Fila do Claude Code — 24/11/2026 · os prazos do DP no Domínio: as férias que vencem, a experiência que termina, o afastamento que passa de 15 dias e o eSocial recusado · branch `fila-24-11-dp`

> **Para o Code do PC do escritório.** **Leia este arquivo inteiro antes de começar**, junto com o
> `docs/FILA-CODE-2026-10-29-DUVIDAS.md` (as tabelas da folha: a `foempregados`, a `forescisoes` e a `FOAFASTAMENTOS`,
> com os tipos de afastamento) e o `docs/FILA-CODE-2026-11-09-JORNADAS-DUVIDAS.md` (o "ativo hoje" e os afastados no
> dia, como o `jornadas.sql` conta).
> Faça os itens **inteiros, sem parar pra perguntar**: nenhum item precisa do Samuel na frente do PC. Na dúvida, a
> opção que **muda menos**, anotada em `docs/FILA-CODE-2026-11-24-DP-DUVIDAS.md`. Ao terminar: o **Registro de
> progresso** (fim deste arquivo) preenchido, commit e `git push origin fila-24-11-dp`. **Nunca** push em
> `main` nem merge pra ela. **Esta fila não muda a ponte nem instala nada**: só descobre e escreve rascunhos.

## O que é
- Em 16/11 o Samuel aprovou as leituras novas do Domínio pro DP ("os avisos de prazo do DP são bons", com o DP na
  frente do fiscal): o vigia da Vitória avisar **antes do prazo**, por empresa, sem ninguém abrir o Domínio empresa por
  empresa. São quatro:
  1. **as férias que vencem**: quem tem o período concessivo (os 12 meses depois do período aquisitivo, CLT, art.
     134) terminando nos próximos 60 dias sem as férias marcadas, e quem já passou dele (as férias em dobro, art. 137);
  2. **o contrato de experiência que termina** nos próximos 10 dias (passado o fim sem rescisão, o contrato vira por
     prazo indeterminado; CLT, arts. 445 e 451);
  3. **o afastamento por doença ou acidente que passa de 15 dias**: do 16º dia em diante quem paga é o INSS (Lei
     8.213/1991, art. 60, § 3º), e o pedido do benefício tem de ir;
  4. **o evento do eSocial recusado**: com ele pendente, a folha do mês não fecha na DCTFWeb.
- **Só contagem por empresa**: quantos, nunca quem. Quem é, a Vitória vê no Domínio.
- Esta fila só descobre e escreve rascunhos, numa pasta que a ponte **não lê** (`ponte/rascunhos/`). O contrato do
  pacote (a versão 6), as colunas no banco e a regra do vigia **não mudam aqui**: são do Claude da sessão do Samuel,
  depois de revisar, com o "vai" dele.

## Regras (as de 04/11, que valem todas)
- **Dado pessoal não sai do Domínio — nem pra esta conversa.** Você só lê o **catálogo** (`dominio tabelas`) e
  **contagens por empresa** (`dominio sql` com `COUNT`, `SUM`, `MIN`, `MAX` e `GROUP BY`). **Nunca** selecione nome,
  CPF, PIS, data de nascimento, salário, endereço, telefone ou e-mail de funcionário, nem o código do empregado
  (`i_empregados`) na saída, nem `SELECT *` de tabela de pessoas, de férias, de afastamentos ou de eventos.
- **O conteúdo do evento do eSocial fica no Domínio** (o XML tem os dados da pessoa): só o tipo do evento (S-1200,
  S-2200…) e a situação, em contagens.
- **O que é por empresa fica fora da conversa e do repositório**: vai pra arquivos em `C:\ponte-dominio\` (fora do
  repositório), com a saída do `dominio sql` redirecionada (`> C:\ponte-dominio\prazos_dp_ferias.txt`, e assim por
  diante). No registro e no DUVIDAS, só o **escritório inteiro** e **contagens** ("em 12 empresas, 19 férias vencem em
  60 dias").
- **Não abra o `C:\ponte-dominio\config.ini`** (nem Read, `type`, `cat` ou `Get-Content`).
- **Repositório público**: nada de host, IP, porta, Engine, nome do banco, usuário, senha, nome de cliente, CNPJ, código
  de empresa ou valor de uma empresa. Das tabelas do Domínio, só as que os rascunhos usam (o nome, as colunas usadas e a
  descrição do catálogo) — **nunca o catálogo inteiro** (é a documentação da Thomson Reuters).
- Código: crie e mexa **só** em `ponte/rascunhos/dp_*.sql` e nos dois arquivos desta fila. **Não mexa** em
  `ponte/consultas/`, `ponte/*.py`, `supabase/`, nas telas nem nos testes. Se um comando da ponte falhar por causa do
  código, não conserte: anote o erro (a mensagem, sem valores) e siga.
- **Não rode** o `instalar.ps1` nem o `ponte rodar`, e não rode a ponte da Receita. Não mexa nas tarefas do Agendador
  nem nas opções de energia do PC.
- **Não rode nada entre 6h50 e 7h20, nem entre 8h20 e 9h00**: são as duas tarefas do dia.
- **Consulta pesada**: cada rascunho tem de rodar em até 60 segundos. Passou, anote o tempo e a parte cara, e proponha
  no DUVIDAS o caminho mais leve.
- Cada rascunho começa com o comentário curto de sempre: as tabelas, o que conta e o que fica de fora. **Um `?` só: o
  dia da leitura** (date), como o `jornadas.sql`: é a foto do dia, uma vez por rodada. Pra testar (o `dominio sql` só
  passa o mês, com o `--mes`), rode uma cópia em `C:\ponte-dominio\` com a data entre aspas no lugar do `?` (o dia de
  hoje) e anote o dia usado. **Uma linha por empresa, já somada**, só das empresas com algum número maior que zero (a
  ponte põe o 0 nas outras). Coluna que o Domínio não tem fica de fora, anotada.
- **Os ativos e o corte das empresas são os do `jornadas.sql`**: empregado (categoria eSocial de 101 a 111), admitido
  até o dia e sem rescisão normal até o dia, na empresa ativa no Domínio ou com a folha do mês calculada.
- Commits em pt-BR.

## Antes de começar
1. Esta fila vem **depois** da `docs/FILA-CODE-2026-11-19-PROCURACAO.md` (a ponte da Receita 0.4.4, só instalar): se
   o ramo dela (`fila-19-11-procuracao`) ainda não existe em origin, faça ela antes.
2. Precisa da conexão com o Domínio. O escritório mudou de endereço, e a primeira rodada do endereço novo (24/11, das
   16h53 às 17h13) conectou e mandou as 474 empresas. Rode `py -3 -m ponte conferir` uma vez, da pasta
   `C:\ponte-dominio\app` (é uma tentativa de login, como a rodada):
   - abriu: siga;
   - não abriu pela rede (o servidor não respondeu: `08001`, `-100`, tempo esgotado): **pare sem criar o ramo desta
     fila** e sem escrever nada. Ela fica pendente e o plantão tenta de novo na hora seguinte;
   - não abriu por usuário ou senha (`28000`, `-103`): **não tente de novo** (o usuário bloqueado por tentativas
     responde com o mesmo erro). Crie o ramo, anote no registro e faça o push.
   No registro, sem a linha do IP e sem a mensagem do driver (só os códigos).
3. Então:
```
git fetch origin --prune
git checkout main
git pull
git checkout -b fila-24-11-dp
py -3 tests/ponte.test.py
```
O teste da ponte tem de terminar em "Tudo certo.". Se não terminar, **pare aqui**: registro e push.

## 1. As férias que vencem
O objetivo: por empresa, quantos empregados ativos têm o fim do período concessivo nos próximos 60 dias **sem as
férias daquele período marcadas nem gozadas**, e quantos já passaram do fim do concessivo sem elas.
1. **Onde está**: o período aquisitivo de cada empregado (o início, o fim e a situação: aberto, gozado, perdido) e as
   férias calculadas ou programadas — `--procurar "periodo aquisitivo"`, `--procurar aquisitivo`, `--procurar
   concessivo`, `--procurar ferias`, `--procurar "programacao de ferias"`, `--procurar "aviso de ferias"`. A fila de
   29/10 achou que as férias também aparecem como afastamento do tipo 9 na `FOAFASTAMENTOS` (o gozo, com o início e o
   fim). Se o Domínio guarda o fim do concessivo (a data limite), use; senão, o fim do aquisitivo mais 12 meses. Anote
   qual.
   - **Marcadas** = a programação ou o aviso de férias com o início antes do fim do concessivo; **gozadas** = o
     cálculo de férias (ou o afastamento 9) daquele período. Férias em partes (CLT, art. 134, § 1º): conta como
     faltando enquanto sobrar saldo de dias do período.
   - O período perdido (CLT, arts. 130 e 133) fica de fora, se o Domínio marcar.
2. **O rascunho** `ponte/rascunhos/dp_ferias.sql`, por empresa:
   - `ferias_vencem_60`: ativos com o fim do concessivo do dia até o dia mais 60, sem férias marcadas nem gozadas
     que cubram o saldo do período;
   - `ferias_vencem_30`: os mesmos, com o fim do concessivo em até 30 dias (já contados nos 60);
   - `ferias_vencidas`: ativos com o fim do concessivo antes do dia, sem as férias do período (as em dobro);
   - `ferias_marcadas_60`: com o fim do concessivo nos 60 dias e as férias já marcadas (o que está em ordem: pra
     conferência);
   - `ferias_proximo_fim`: o menor fim de concessivo entre os que faltam (uma data: o dia do aviso).
3. **A conferência dentro do Domínio** (só a contagem por resultado): (a) quantos ativos com mais de um ano de casa
   não têm nenhum período aquisitivo completo; (b) quantos ativos têm dois períodos aquisitivos completos ou mais sem
   férias (o acúmulo); (c) as férias gozadas nos últimos 12 meses contra os meses com férias da `fobasesserv` (o
   cálculo 60 e 61 que a fila de 03/11 achou): quantas empresas batem.
4. **Contagens do escritório inteiro**: quantas empresas e quantos empregados em cada coluna; e o
   `ferias_proximo_fim` por mês (dez/26, jan/27, fev/27…), em quantas empresas.

## 2. O contrato de experiência que termina
O objetivo: por empresa, quantos empregados em contrato de experiência têm o fim do período em vigor (o primeiro ou a
prorrogação) nos próximos 10 dias, e quantos passaram do fim sem rescisão.
1. **Onde está**: o tipo do contrato (experiência, prazo determinado, indeterminado) e as datas do fim do primeiro
   período e da prorrogação, no cadastro do empregado ou numa tabela do contrato — `--procurar experiencia`,
   `--procurar prorrogacao`, `--procurar "prazo determinado"`, `--procurar "tipo de contrato"`, `--procurar
   "vencimento do contrato"`.
2. **O rascunho** `ponte/rascunhos/dp_experiencia.sql`, por empresa:
   - `experiencia_10_dias`: ativos em experiência com o fim do período em vigor do dia até o dia mais 10;
   - `experiencia_prorrogavel`: dentro deles, os que estão no primeiro período e ainda podem ser prorrogados (a soma
     dos dois não passa de 90 dias, CLT, art. 445, parágrafo único);
   - `experiencia_vencida`: ativos em experiência com o fim do último período antes do dia, sem rescisão (o contrato
     que segue depois do fim vira por prazo indeterminado: o cadastro do Domínio ficou pra trás);
   - `experiencia_ativos`: quantos ativos estão em experiência (pra conferência).
3. **A conferência dentro do Domínio** (só a contagem): (a) os ativos em experiência admitidos há mais de 90 dias;
   (b) os cadastros com o primeiro período e a prorrogação somando mais de 90 dias.
4. **Contagens do escritório inteiro**: quantos em experiência, em quantas empresas; e os prazos mais usados (30 + 60,
   45 + 45, 90 e os outros), só a contagem de cada um.

## 3. O afastamento que passa de 15 dias
O objetivo: por empresa, quantos empregados estão afastados por doença ou acidente, com o afastamento aberto no dia,
e em que ponto dos 15 dias que a empresa paga.
1. **Onde está**: a `bethadba.FOAFASTAMENTOS` (o `DATA_REAL`, o `DATA_FIM` e o tipo em `I_AFASTAMENTOS`, com a
   descrição em `FOAFASTAMENTOS_TIPOS`), que o `folha.sql` já usa. Ache **os tipos de doença e de acidente** (o código
   e o nome do tipo vão pro DUVIDAS: são a tabela do Domínio, não dado de pessoa). Fora os tipos que a fila de 29/10
   já deixou de fora (1 Trabalhando, 8 Demitido, 9 Férias, 23 Transferido, 52, 53).
   - Aberto no dia = o `DATA_REAL` até o dia e o `DATA_FIM` vazio ou depois do dia.
   - O afastamento que volta pela mesma doença dentro de 60 dias soma com o anterior (Decreto 3.048/1999, art. 75,
     §§ 3º e 4º, a conferir): veja se o Domínio liga um ao outro. Se não ligar, conte cada um sozinho e anote.
2. **O rascunho** `ponte/rascunhos/dp_afastamentos.sql`, por empresa:
   - `afast_10_a_15`: abertos no dia, dos tipos de doença e de acidente, com o início de 10 a 15 dias antes (o 16º dia
     chega em até 6 dias);
   - `afast_16_a_45`: os mesmos, com o início de 16 a 45 dias antes (o INSS já paga, e o pedido do benefício já devia
     ter ido);
   - `afast_longos`: os mesmos, com o início há mais de 45 dias (pra conferência: os que já estão no INSS);
   - `afast_outros`: os abertos dos outros tipos (a licença-maternidade, o serviço militar…), só a contagem.
3. **A conferência**: a soma dos quatro contra o `afastados` do `jornadas.sql` no mesmo dia (a mesma regra dos
   abertos), empresa por empresa: quantas batem.
4. **Contagens do escritório inteiro**: os abertos por tipo (o código e o nome do tipo) e por faixa de dias (até 15,
   16 a 45, 46 a 180, mais de 180).

## 4. O evento do eSocial recusado
O objetivo: por empresa, quantos eventos do eSocial que o Domínio mandou voltaram com erro e seguem sem um envio
aceito depois.
1. **Onde está**: os eventos mandados ao eSocial (o tipo, a competência ou o dia, a situação do envio: aceito,
   rejeitado, pendente, o recibo) — `--procurar esocial`, `--procurar evento`, `--procurar recibo`, `--procurar lote`,
   `--procurar retorno`. Pode ser que o Domínio guarde isso fora deste banco (no módulo do eSocial): diga se achou.
2. **O rascunho** `ponte/rascunhos/dp_esocial.sql` (se o Domínio guardar), por empresa:
   - `esocial_recusados`: eventos com a última situação de erro ou rejeitado e sem um envio aceito depois, do mês do
     dia e do mês anterior;
   - `esocial_pendentes`: gerados e sem retorno há mais de 2 dias;
   - `esocial_aceitos`: os aceitos no mês (pra conferência);
   - `esocial_ultimo_aceito`: o dia do último envio aceito (uma data).
3. **A conferência**: as empresas com a folha do mês anterior calculada (a `fobasesserv`) contra as que têm o
   fechamento dela (o S-1299) aceito: quantas têm os dois e quantas só a folha.
4. **Contagens do escritório inteiro**: os tipos de evento recusados mais comuns (só o código do evento e a contagem)
   e em quantas empresas.

## 5. Revisão, registro, DUVIDAS e push
1. **Uma revisão independente** dos rascunhos e do DUVIDAS (o SQL, a privacidade e as contas), como nas filas de
   11/11: cada achado conferido por outro revisor antes de mudar.
2. O `docs/FILA-CODE-2026-11-24-DP-DUVIDAS.md` com, pra cada rascunho: as tabelas e as colunas usadas (com a
   descrição do catálogo), a regra de cada coluna e o que ficou de fora, o tempo, os números da conferência (só do
   escritório inteiro e contagens) e o que o Claude da sessão do Samuel tem de decidir (onde o Domínio não tem o dado,
   onde há dois caminhos, o que a Vitória precisa confirmar).
3. O resultado por empresa fica só em `C:\ponte-dominio\prazos_dp_*.txt`, nunca no repositório.
4. O registro preenchido, `py -3 tests/ponte.test.py` verde, commit e `git push origin fila-24-11-dp`.

## Registro de progresso
| Data | Item | Situação / observação |
|---|---|---|
| | Antes | |
| | 1 | |
| | 2 | |
| | 3 | |
| | 4 | |
| | 5 | |
