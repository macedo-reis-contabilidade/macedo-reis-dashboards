# Fila de 09/11/2026 · as jornadas (o fim da escala 6x1) — o que se achou no Domínio e as dúvidas

Conferido em 09/11/2026 no banco do Domínio Web (o de produção, ao vivo), pelo `py -3 -m ponte dominio sql` (só
contagens) e pela rodada sem enviar do item 4. **Só contagens do escritório inteiro**: nenhum nome, CPF, código de
empresa ou de funcionário, nenhum valor em reais.

"Ativo hoje" é a regra do `folha.sql` no dia 09/11/2026: categoria eSocial de 101 a 111, admitido até hoje, sem
rescisão normal com demissão até hoje, na empresa ativa no Domínio. **275 empregados, de 48 empresas.** (Com o corte
inteiro do `folha.sql`, que soma também a empresa com a folha do mês calculada, dá o mesmo: a folha de novembro ainda
não foi calculada.) As contagens são da tarde de 09/11, até a rodada das 16:52; às 17:20 os ativos já eram 274, nas
mesmas 48 empresas (a contagem do 2.1 e a consulta deram os dois 274): o banco é o de produção, e o DP lançou uma
mudança no meio da tarde.

## 1. As tabelas (o catálogo do item 2 da fila, conferido)

O catálogo bate com o da fila, com estes acréscimos:

- `bethadba.FOHORARIOS` também tem `HORA_ENTRADA` e `HORA_SAIDA` (time), `TIPO_INTERVALO` (0 não possui, 1 em horário
  variável, 2 em horário fixo, 3 variável noturno) e `SITUACAO`. O histórico fica em `bethadba.FOHORARIOS_ALTERACAO`
  (pela `VIGENCIA`): nos 1.135 horários, a alteração mais recente até hoje é igual ao `FOHORARIOS` (o tipo, a entrada, a
  saída, a duração e o intervalo) e nenhuma tem vigência futura — vale o `FOHORARIOS`.
- `bethadba.FOJORNADAS`: 555 jornadas, todas ativas (`SITUACAO` 1). `TIPO`: 163 padrão, 391 turno fixo, nenhuma turno
  variável, 1 especial/escala. `TIPO_ESCALA`: 402 não possui, 153 12x36, nenhuma 24x72 ou outras.
- As jornadas em uso pelos 275 ativos são **97** (22 do tipo padrão, 75 turno fixo; 92 sem escala e 5 marcadas 12x36).

## 2. As respostas do item 2

**2.1. Quantos ativos têm jornada.** Os 275 têm; nenhum sem jornada. Todas as jornadas em uso existem na `FOJORNADAS`.

**2.2. O `I_JORNADA` do cadastro contra a troca mais recente.** Os 275 têm troca até hoje (a `FOTROCAS_JORNADAS` guarda
também a jornada da admissão) e, nos 275, a troca mais recente é a do cadastro. Nenhuma troca com data futura. A
consulta usa a troca mais recente até hoje e, sem troca, o cadastro (o que vale num dia em que as duas forem
diferentes, como uma troca já gravada pra frente).

**2.3. O `FOJORNADAS_HORARIOS`.** Nas 555 jornadas:

| | todas | em uso |
|---|---:|---:|
| só o dia 1 (segunda a sexta), com ou sem o sábado e o domingo | 157 | 18 |
| só os dias 2 a 6, um por dia | 391 | 75 |
| as duas formas juntas | 6 | 4 |
| os dias 9 a 12 (escala) | 1 | 0 |

- A forma segue o `TIPO`: a jornada padrão usa o dia 1 e a de turno fixo, os dias 2 a 6 (com o 7 e o 8, o sábado e o
  domingo, nas duas). As 4 em uso com as duas formas juntas são todas de horário "marcador" (abaixo, 2.4): o dia 1 e
  a segunda, ou o dia 1 e os dias 2 a 8. A consulta usa a linha do próprio dia e o dia 1 só pros dias de 2 a 6 sem
  linha. Uma jornada em uso tem duas linhas na segunda (os minutos dos horários do dia somam; os dois são marcadores).
- O `SEQUENCIAL_DIA_SEMANA` está **vazio nas 3.211 linhas**: não dá pra ver como ele conta o ciclo da escala. A única
  jornada com os dias 9 a 12 (fora de uso, do tipo especial e marcada 12x36) tem duas linhas, o dia 9 e o 10 (o 1º e o
  2º dia) — um ciclo de 2 dias, como a 12x36. A consulta conta cada linha dos dias 9 a 12 como um dia do ciclo; sem
  jornada de escala em uso, a regra não pôde ser conferida com dado de verdade.
- As **5 jornadas em uso marcadas 12x36** (`TIPO_ESCALA` 1) têm horário de semana (dias 1 a 8), não de escala: 20
  empregados, 19 na semana de 5 dias com o sábado compensado e 1 na 6x1. A marcação de 12x36 não confere com o
  horário: a `semana` sai do horário, e a escala só quando a jornada tem os dias 9 a 12.

**2.4. O `FOHORARIOS`: a duração já desconta o intervalo?** Sim. Nos horários das jornadas em uso (198):

| | horários | a duração (`DURACAO_JORNADA_MINUTOS`) |
|---|---:|---|
| trabalhados com intervalo fixo | 94 | 75 = saída − entrada − os intervalos do `FOHORARIOS_INTERVALOS`; 19 menores que essa conta (1 em 4 minutos, 5 em 8, 8 em 12, 3 em 15, 2 em 54) |
| trabalhados sem intervalo | 29 | 23 = saída − entrada; 6 com 1 minuto e a entrada igual à saída |
| compensados | 30 | todos com 0 ou 1 minuto |
| folgas | 45 | todos com 0 ou 1 minuto |

- Nenhum horário trabalhado com intervalo tem a duração igual à saída − entrada (sem descontar): a duração é a do
  eSocial, sem o intervalo. Nenhum horário tem a duração nula; 15 (compensados e folgas) não têm a hora.
- **O horário "marcador"**: o trabalhado com 1 minuto e a entrada igual à saída não diz a hora. Nas jornadas em uso, 6
  horários assim, em jornadas de **29 empregados** (25 com os 7 dias trabalhados e 4 com 6 dias e um sem horário). A
  consulta não inventa a hora: o dia fica `T`, sem os minutos, e o `min_semana` e o `min_maior_dia` saem null. O
  horário de verdade dessas pessoas não está no Domínio.
- No escritório inteiro (747 horários trabalhados): 631 batem com a conta, 14 são marcadores e 102 diferem — 95 de 3 a
  54 minutos a menos que a conta e 7, fora de uso, com diferença maior (de 60 minutos a mais a 384 a menos, digitação
  ou o intervalo fora do cadastro).

**2.5. O `grau_instrucao`** (os 275 ativos):

| código | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| empregados | 5 | 2 | 47 | 40 | 46 | 122 | 8 | 5 |

O catálogo não tem a tabela dos códigos ("Grau instrucao"). Pela tabela do eSocial (que o S-2200 usa), o 9 é o
**superior completo** e o 10 a 12 vêm acima dele (a pós-graduação, o mestrado e o doutorado); a distribuição confere
(o 7, médio completo, é o mais comum). Nenhum ativo com 1, 10, 11 ou 12. `superior` = 9 ou mais: **5 empregados**.

**2.6. A unidade do salário.** Não há coluna com a unidade do eSocial (o `undSalFixo`): a busca no catálogo por
unidade, salário fixo, mensalista, horista… não achou. Quem diz é a **`foempregados.categoria`** ("Categoria"; os
parâmetros da folha — `foparmto`, `FOVIGENCIA_UNIDADE_CALCULO` — falam da unidade de cálculo dos mensalistas,
semanalistas, tarefeiros, diaristas e comissionados). Ela só tem 3 códigos nos 3.295 cadastros, conferidos contra o
salário-hora do último cálculo mensal da folha (`fobasesserv.SALARIO_HORA`):

| categoria | cadastros | o salário do cadastro | unidade no pacote |
|---|---:|---|---|
| 1 | 1.498 | = o salário-hora × as horas do mês em 1.334 (nenhum igual ao salário-hora) | 5 (mês) |
| 5 | 1.793 | = o salário-hora em 1.703 | 1 (hora) |
| 7 | 4 | o cálculo da folha não tem salário-hora (0) e o salário fica na faixa de um valor por hora | null (não identificada) |

Nos ativos: **142 por mês, 129 por hora e 4 sem a unidade** (os 4 da categoria 7, todos ativos).

**2.7. As `horas_semana` do contrato** (os 275 ativos): 44 h, **234**; 42 h, 2; 40 h, 4; 36 h, 3; 30 h, 1; as outras,
31 (17,5 a 43 h: 17,5, 18, 19,5 ×2, 20, 21,25 ×3, 22 ×2, 25 ×3, 27, 27,5, 28, 32, 37 ×5, 37,5 ×2, 39 ×4, 41, 41,25 e
43). As `horas_mes` são sempre as horas da semana × 5.

**Mais.** Nos 275: `FORMA_CALCULO` 1 (por mês), `TIPO_HORARIO` 1 (capítulo II da CLT) e a categoria eSocial 101, todos;
`HORAS_COMPENSADAS` zero em todos — **o `compensa_sabado` sai 0 em todos os grupos, embora 177 tenham o sábado
compensado na jornada** (o `C` no sábado da `semana`): no Domínio do escritório, a compensação está na jornada, não
no cadastro do empregado. As horas do contrato também têm histórico, na `bethadba.FOTROCAS_HORAS` (`DATA_TROCA`,
`CAMPO` 1 a 4: horas do dia, da semana, do mês e compensadas): nos ativos, todos têm troca, nenhuma com data futura,
e as `horas_semana` e as `horas_mes` do cadastro são as da troca mais recente até hoje em todos — a consulta lê as do
cadastro.

## 3. A rodada sem enviar (item 4)

`py -3 -m ponte rodar --sem-enviar --meses 1 --saida jornadas-conferencia.json`, com a ponte 0.4.0 do repositório (a
instalada não mudou): saiu com 0. Os totais em 60 s (16:51:18 a 16:52:18) e a rodada inteira em 2 min 2 s, com a etapa
das notas (sem enviar). A consulta das jornadas, sozinha, de 2,3 a 3,0 s. A linha do log:

> lido: 474 empresa(s) (119 ativa(s)), 474 linha(s) mensal(is) de 2026-11 a 2026-11; o andamento de 367 empresa(s); o
> encerramento de 2024 e 2025; as jornadas de 48 empresa(s) (99 grupo(s), 275 empregado(s))

As jornadas não ficaram no `faltou` (vazio). As contagens (o script fora do repositório, só do escritório inteiro):

- **48 empresas, 99 grupos, 275 empregados**, em 97 jornadas.
- Por padrão da `semana` (empregados / grupos):

| padrão | empregados | grupos |
|---|---:|---:|
| 5 dias trabalhados com o sábado compensado (5 T e C) | 177 | 38 |
| 6x1 (6 T e 1 F) | 58 | 38 |
| 7 dias trabalhados (os marcadores, 25, e 2 de verdade) | 27 | 17 |
| 6 T e um dia sem horário (marcadores) | 4 | 2 |
| 5x2 (5 T e 2 F) | 3 | 1 |
| outros (4 T, 2 C e 1 F · 3 T, 3 C e 1 F · 4 T e 3 F) | 6 | 3 |
| escala 12x36, 24x72 ou outras (pelos dias 9 a 12) | 0 | 0 |
| sem jornada | 0 | 0 |

  Marcadas 12x36 no Domínio com horário de semana: 20 (dentro das linhas de cima).
- Por `min_semana`: **acima de 42 h, 207**; acima de 40 h até 42 h, 5; acima de 30 h até 40 h, 17; até 30 h, 17; sem
  os minutos (os marcadores), 29. Exatamente 44 h, 173; 42 h, 1; 40 h, 3. A jornada bate com as horas do contrato (até
  15 minutos) em 201 dos 246 com os minutos; 43 abaixo do contrato e 2 acima. O dia mais longo passa de 8h48 em 140 e
  de 10 h em nenhum.
- **Trabalham no domingo: 68.** Com 2 dias de folga ou compensados na semana: 186.
- `superior_teto` maior que zero: **nenhum** (0 grupos; com o superior completo, 5). Afastados hoje: 7.
- **A soma dos `empregados` (275) bate com a soma dos `funcionarios_ativos` do mês de hoje no mesmo arquivo (275)**, empresa
  por empresa (nenhuma diferente).
- O arquivo e o script foram apagados (`Test-Path` `False` nos dois).

## 4. O que fica pra sessão do Samuel decidir (ou o DP confirmar)

0. **O grupo de uma pessoa só — antes de instalar.** Dos 99 grupos, **62 têm 1 empregado** (62 pessoas, de 275); 16
   têm 2, 7 têm 3, e os outros 14 têm de 4 a 63. No grupo de 1, a `salarios` é o salário daquela pessoa, e o
   `afastados` e o `superior` dizem se ela está afastada (2 grupos de 1) e se tem o superior completo (1) — com a
   empresa, a jornada e as horas do contrato, numa empresa pequena dá pra saber quem é. A fila diz que o salário de
   cada pessoa fica no PC; o contrato da seção 3 manda a soma do grupo, qualquer que seja o tamanho. A ponte segue o
   contrato (o pacote 4 ainda não sai do PC: a ponte 0.4.0 não foi instalada e a função recusa a versão 4). Caminhos:
   mandar null no grupo com menos de 3 empregados — e aí não só a `salarios`: o `afastados` (o afastamento pode ser
   doença, acidente ou maternidade), o `superior` e o `superior_teto` também são da pessoa —; ou juntar os grupos
   pequenos da empresa num só; ou deixar como está, se a tela precisa do número. Duas ressalvas pra pesar: o mesmo
   pacote leva, por empresa e mês, os `funcionarios_ativos`, os `afastados` e a folha em reais, e o grupo escondido sai
   pela diferença com os grupos que aparecem; e a empresa de 1 empregado já manda, desde a versão 1, o afastado e a
   folha dela (a da pessoa) no bloco do mês. A mudança é de poucas linhas na consulta (ou no `pacote.py`) e um caso no
   teste.
1. **A categoria 7** (4 empregados ativos): o Domínio não tem salário-hora no cálculo dela e o catálogo não diz o que é.
   A unidade sai null. O DP sabe dizer o que é (diarista, tarefeiro, comissionado?) — com o código, a ponte passa a
   mandar a unidade.
2. **O sábado compensado**: o `compensa_sabado` (o `HORAS_COMPENSADAS` do cadastro) é zero em todo o escritório; quem diz
   é o `C` da `semana` (177 empregados). A tela deve olhar a `semana`.
3. **O `superior_teto` do horista**: a consulta compara o salário do mês — o do horista é o salário × as horas do mês.
   A fila dizia "o salário"; ficou assim porque o art. 8º fala do salário mensal (hoje não muda nada: 0 em todos).
4. **A marcação 12x36 com horário de semana** (20 empregados): a `semana` vale; o `tipo_escala` vai como o Domínio diz.
   Pode ser cadastro a acertar no Domínio.
5. **Os marcadores** (29 empregados): o horário de verdade não está no Domínio; o DP precisa perguntar à empresa (ou
   acertar o horário no Domínio).
6. **A duração menor que a conta** em 19 horários em uso (4 a 54 minutos a menos): a consulta usa a duração do Domínio
   (a que vai pro eSocial). Se a tela quiser a conta pela entrada, a saída e o intervalo, é outra coluna.
7. **O tamanho do trabalho**: 207 dos 275 passam de 42 h por semana e 68 trabalham no domingo.
8. **O lado do sistema**: a função `ponte` hoje recusa a versão 4. A ponte 0.4.0 só pode ser instalada depois que a
   função aceitar o pacote 4 (a instalação é outra fila, como a fila diz). **E o `tests/ponte-funcao.test.mjs` fica
   vermelho neste ramo** (1 falha: "o pacote da ponte do PC (a versão 4 …) passa inteiro" — o `validarPacoteDominio`
   responde "versão desconhecida (esta função lê a 1, a 2 e a 3)"); na `main` ele passa. Ele monta o pacote com o
   `pacote.py` de verdade, e a fila proibia mexer em `supabase/` e nos outros testes: o ramo só pode ir pra `main`
   junto com o lado do sistema (a função lendo a versão 4, com o bloco `jornadas`, e a conferência da linha 365 do
   teste esperando a versão 4 e as jornadas). O `python tests/rodar-tudo.py` neste ramo: 119 testes, 117 ok, em 7 min
   40 s; os 2 que falham são deste ramo: o `ponte-funcao.test.mjs` (acima) e o `ponte-receita.test.py`, só na
   conferência "o tests/ponte.test.py … é o mesmo da main" (a trava das filas da Receita, que não deviam mexer no teste
   do Domínio; esta mexe, como manda, e na `main` essa conferência não roda) — o próprio `tests/ponte.test.py`, que ele
   roda, passa.

## 5. A revisão

Uma revisão independente do ramo (a consulta, o pacote, os testes e a privacidade, cada achado conferido por outro
revisor) confirmou quatro defeitos, consertados antes do commit:

- a consulta mandava o `min_maior_dia` do maior dia conhecido quando um dia trabalhado era marcador (e o `min_semana`
  saía null); agora os dois saem null juntos (na semana e na escala). Conferido de novo no Domínio: 99 grupos, os
  mesmos 29 empregados sem os minutos;
- o teste não pegaria a chave do grupo encolhida (só empresa e jornada): ganhou um caso com a mesma jornada em seis
  grupos, cada um com um campo do grupo diferente;
- o teste não pegaria o tipo, a forma, o controle, a categoria e o `superior_teto` saindo null: a 6x1 e a linha do
  banco de mentira são conferidas campo a campo, e a 5x2 falsa tem o `superior_teto` 1;
- o teste do ano sem o salário do art. 8º fixava 2026 e quebraria quando o valor de 2027 entrasse: agora usa o ano
  mais recente da tabela.

E o `ponte-funcao.test.mjs` (o item 8 acima). Ficaram de fora, como não defeitos: as horas e o horário com data futura
(conferido: nenhum), a regra do ciclo da escala (sem escala em uso pra conferir) e o grupo de uma pessoa só (o item 0,
decisão do Samuel).
