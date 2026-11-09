# Fila do Claude Code — 09/11/2026 · a jornada dos funcionários (o fim da escala 6x1) e a versão 4 do pacote · branch `fila-09-11-jornadas`

> **Para o Code do PC do escritório.** **Leia este arquivo inteiro antes de começar.** Faça os itens **inteiros, sem
> parar pra perguntar**: nenhum item precisa do Samuel na frente do PC. Ao terminar: o **Registro de progresso** (fim
> deste arquivo) preenchido, commit e `git push origin fila-09-11-jornadas`. **Nunca** push em `main` nem merge pra
> ela. **Esta fila não instala a ponte**: a instalação vem noutra fila, depois da revisão.

## O que é
- A **Emenda Constitucional 141/2026** (publicada em 16/10/2026) acaba com a escala 6x1: a partir de **16/12/2026**, no
  máximo **42 horas por semana e 2 dias de repouso** semanal remunerado; a partir de **16/12/2027**, **40 horas**. O DP
  (a Vitória e o Diego) precisa saber, empresa por empresa da carteira, em que jornada cada grupo de funcionários
  trabalha hoje, pra combinar com cada empresa a jornada nova antes de 16/12. O sistema ganha a tela "Escala 6x1" no
  DP (comigo) e precisa da jornada que está no Domínio.
- **O Samuel decidiu (09/11): sai do PC somado por empresa e por jornada** — quantos funcionários em cada grupo, as
  horas e a soma dos salários do grupo. Nome, CPF, cargo e o salário de cada pessoa ficam no PC, como na folha.
- **Você escreve**: a consulta `ponte/consultas/jornadas.sql` (conferida no banco de verdade, só com contagens), o
  bloco `jornadas` na ponte (a foto do dia, como o `andamento`), o pacote na **versão 4**, a ponte **0.4.0** e os
  testes. O lado do sistema (a função `ponte`, o banco e a tela) é comigo, com o contrato da seção 3.

## Regras (as de sempre)
- **Dado de cliente não sai do PC — nem pra esta conversa.** No registro e no `-DUVIDAS`, só contagens do escritório
  inteiro e o tempo; nunca nome, CPF, salário, código de empresa ou de funcionário, nem valor em reais.
- **Não abra o `C:\ponte-dominio\config.ini`** (nem Read, `type`, `cat` ou `Get-Content`). Pra saber como ficou:
  `py -3 -m ponte conferir` e o log do dia.
- **Não abra o arquivo do `--saida`** na conversa: ele tem os dados dos clientes. Só o seu script de contagem lê, e ele
  imprime só contagens do escritório inteiro. No fim do item 4, apague o arquivo e o script.
- **Repositório público**: nada de host, IP, porta, Engine, nome do banco, usuário, senha, nome de cliente, CNPJ,
  código de empresa ou valor. O catálogo do Domínio (`C:\ponte-dominio\dominio-tabelas.txt`) não vai pro repositório:
  cite só as tabelas e as colunas que a consulta usa.
- **Pode mexer** em `ponte/` e em `tests/ponte.test.py` (é o trabalho desta fila). **Não mexa** em `supabase/`, nas
  telas nem nos outros testes.
- Commits em pt-BR.

## 1. O começo
```
git fetch origin --prune
git checkout main
git pull
git checkout -b fila-09-11-jornadas
py -3 tests/ponte.test.py
```
O teste tem de terminar em "Tudo certo.". Se não terminar, **pare aqui**: registro e push.

## 2. Onde a jornada mora no Domínio (só o catálogo e contagens)
O que eu achei no catálogo (confira; o `-- A CONFERIR` é você quem tira):
- `bethadba.foempregados`: `I_JORNADA` (a jornada de hoje), `horas_semana`, `horas_mes`, `horas_dia`,
  `HORAS_COMPENSADAS` (as horas compensadas no sábado), `FORMA_CALCULO` (1 por mês, 2 por semana, 3 por convocação),
  `TIPO_HORARIO` (1 submetido ao capítulo II da CLT, 2 externo, 3 cargo de gestão, 4 e 5 motorista, 6 teletrabalho,
  7 art. 443 § 3º, 8 ponto por exceção), `grau_instrucao`, `salario` e as categorias eSocial (as do `folha.sql`).
- `bethadba.FOTROCAS_JORNADAS`: as trocas de jornada de cada empregado (`DATA_TROCA`, `I_JORNADA`).
- `bethadba.FOJORNADAS`: `TIPO` (1 padrão, 2 turno fixo, 3 turno variável, 4 especial/escala), `TIPO_ESCALA`
  (0 não possui, 1 12x36, 2 24x72, 3 outras), `SITUACAO`.
- `bethadba.FOJORNADAS_HORARIOS`: `DIA_SEMANA` (1 segunda a sexta, 2 segunda … 7 sábado, 8 domingo, 9 a 11 o 1º ao
  3º dia, 12 escala), `SEQUENCIAL_DIA_SEMANA` (a ordem do dia na escala) e `I_HORARIO`.
- `bethadba.FOHORARIOS`: `TIPO` (1 trabalhado, 2 compensado, 3 folga), `HORA_ENTRADA`, `HORA_SAIDA`,
  `DURACAO_JORNADA_MINUTOS`, `DURACAO_INTERVALO_MINUTOS`, `TIPO_INTERVALO`; e `bethadba.FOHORARIOS_INTERVALOS`.
- **A unidade do salário** (por hora, dia, semana ou mês — o `undSalFixo` do eSocial): não achei. Procure
  (`py -3 -m ponte dominio tabelas --procurar`). Sem ela, o salário do horista e o do mensalista se misturam na soma.

Responda no `docs/FILA-CODE-2026-11-09-JORNADAS-DUVIDAS.md`, só com contagens do escritório inteiro:
1. Quantos empregados ativos hoje (a regra do `folha.sql`: categoria 101 a 111, admitido, sem rescisão normal, na
   empresa ativa no Domínio) têm jornada (o `I_JORNADA` ou a troca mais recente até hoje) e quantos não têm.
2. Quantos têm o `I_JORNADA` do cadastro diferente da troca mais recente até hoje (qual vale).
3. No `FOJORNADAS_HORARIOS`: quantas jornadas usam o dia 1 (segunda a sexta), quantas usam 2 a 6, quantas as duas
   formas juntas, quantas usam 9 a 12, e como o `SEQUENCIAL_DIA_SEMANA` conta o ciclo da escala.
4. No `FOHORARIOS`: se o `DURACAO_JORNADA_MINUTOS` já desconta o intervalo (compare, em contagem, com saída − entrada
   − intervalo) e quantos horários trabalhados não têm duração.
5. O `grau_instrucao`: a contagem por código e qual é o superior completo (e os acima dele).
6. A unidade do salário: onde está e a contagem por unidade.
7. Quantos empregados por `horas_semana` (44, 42, 40, 36, 30 e as outras).

## 3. O contrato: o bloco `jornadas` (versão 4 do pacote)
A **foto do dia**, como o `andamento`: uma lista fora do mês, lida uma vez por rodada (o dia de hoje). Uma linha por
empresa e grupo; **o grupo** é `(codigo, jornada, horas_semana, horas_mes, forma, controle, categoria, unidade)`.

| Campo | Tipo | O que é |
|---|---|---|
| `codigo` | inteiro | a empresa no Domínio |
| `jornada` | inteiro ou null | o `I_JORNADA` do grupo; null = sem jornada no Domínio |
| `tipo` | inteiro ou null | `FOJORNADAS.TIPO` |
| `tipo_escala` | inteiro ou null | `FOJORNADAS.TIPO_ESCALA` |
| `semana` | texto de 7 ou null | segunda a domingo: `T` trabalhado, `C` compensado, `F` folga, `-` sem horário; o dia 1 vale pra segunda a sexta; null na jornada de escala (dias 9 a 12) |
| `min_semana` | inteiro ou null | os minutos trabalhados na semana, sem o intervalo; na escala, a média do ciclo (7 × os minutos trabalhados no ciclo ÷ os dias do ciclo, arredondado) |
| `min_maior_dia` | inteiro ou null | o dia trabalhado mais longo, sem o intervalo |
| `ciclo_dias` | inteiro ou null | na escala, os dias do ciclo |
| `ciclo_trabalho` | inteiro ou null | na escala, os dias trabalhados no ciclo |
| `horas_semana` | número | `foempregados.horas_semana` (o contrato) |
| `horas_mes` | número | `foempregados.horas_mes` |
| `forma` | inteiro ou null | `FORMA_CALCULO` |
| `controle` | inteiro ou null | `TIPO_HORARIO` |
| `categoria` | inteiro | a categoria eSocial do empregado (101 a 111) |
| `unidade` | inteiro ou null | a unidade do salário, no código do eSocial (1 hora, 2 dia, 3 semana, 4 quinzena, 5 mês, 6 tarefa, 7 não se aplica); null se o Domínio não tiver |
| `empregados` | inteiro | quantos ativos hoje no grupo |
| `afastados` | inteiro | deles, quantos afastados hoje (a regra do `folha.sql`) |
| `compensa_sabado` | inteiro | deles, quantos com `HORAS_COMPENSADAS` > 0 |
| `superior` | inteiro | deles, quantos com o superior completo ou mais |
| `superior_teto` | inteiro | deles, quantos com o superior completo **e** o salário a partir do 2º parâmetro (o art. 8º da EC 141: 2,5 × o teto do RGPS; em 2026, 2,5 × R$ 8.475,55 = R$ 21.188,88) |
| `salarios` | dinheiro | a soma do `salario` do grupo |

- Os parâmetros: `? = hoje` (date) e `? = o salário do art. 8º` (numeric). O valor do ano fica numa constante da ponte
  (`{2026: 21188.88}`; ano sem valor usa o mais recente, com aviso no log).
- A `semana` e os minutos podem sair do SQL ou do Python (`fonte_dominio.py`), como for mais simples; o que sai no
  pacote é o contrato acima. Só a empresa ativa no Domínio (o corte do `folha.sql`). O grupo com 0 empregados não vai.
- O pacote: `"versao": 4`, a lista `jornadas` ao lado do `andamento` e do `encerramento`. Não leu (consulta a
  conferir, erro): a lista vai vazia e o `faltou` ganha `{"bloco": "jornadas", "motivo": …}`. Os outros blocos não
  mudam. O campo fora do contrato que a fonte devolver é descartado (a trava de sempre).
- `ponte/__init__.py`: `VERSAO = '0.4.0'`. O `LEIA-ME.md`: o bloco novo, em poucas linhas.
- Os testes (`tests/ponte.test.py`): a fonte falsa com jornadas (uma 6x1 de 44 h, uma 5x2 com o sábado compensado,
  uma 12x36 e um grupo sem jornada), o pacote na versão 4, o descarte de um `nome` e de um `cpf` que a fonte
  devolver, e o `faltou` quando a consulta não roda.

## 4. A rodada sem enviar e as contagens
1. `py -3 -m ponte rodar --sem-enviar --meses 1 --saida jornadas-conferencia.json` (o arquivo cai em
   `C:\ponte-dominio\`). Anote o tempo (o log do dia) e a linha "lido: …". Se o `jornadas` ficar no "faltou", anote o
   motivo (sem valores), corrija e rode de novo.
2. Um script seu, em `C:\ponte-dominio\` (fora do repositório), que lê o arquivo e imprime **só** contagens do
   escritório inteiro:
   - as empresas com jornadas, os grupos e os empregados;
   - os empregados por padrão da `semana`: 6 `T` e 1 `F` (a 6x1), 5 `T` e 2 `F`, 5 `T` com `C` (o sábado
     compensado), as escalas 12x36, 24x72 e outras, e os sem jornada;
   - os empregados por `min_semana`: acima de 42 h, de 40 a 42 h, até 40 h e até 30 h;
   - os empregados que trabalham no domingo (`T` no 7º dia) e os com `superior_teto` maior que zero;
   - a soma dos `empregados` contra a soma dos `funcionarios_ativos` do mês de hoje no mesmo arquivo (têm de bater, ou
     diga quantos faltam e por quê).
3. Apague o arquivo e o script (`Test-Path` dando `False` pros dois).

## 5. O registro e o push
O `-DUVIDAS` com as respostas do item 2 e as contagens do item 4, o registro preenchido, `py -3 tests/ponte.test.py`
verde, os commits e `git push origin fila-09-11-jornadas`. **Não instale a ponte.**

## Registro de progresso
| Data | Item | Situação / observação |
|---|---|---|
| 09/11/2026 | 1 | Feito. `git fetch --prune`, `main` atualizada, a branch `fila-09-11-jornadas`; `py -3 tests/ponte.test.py`: "Tudo certo." (antes de qualquer mudança). |
| 09/11/2026 | 2 | Feito, só com o catálogo e contagens do escritório inteiro (`dominio sql`). As 7 respostas em `docs/FILA-CODE-2026-11-09-JORNADAS-DUVIDAS.md`, seção 2: os 275 ativos (de 48 empresas) têm jornada, e a troca mais recente é a do cadastro em todos; a forma dos dias segue o tipo da jornada (o dia 1 na padrão, os dias 2 a 6 no turno fixo; 4 em uso com as duas, todas de horário marcador); o `SEQUENCIAL_DIA_SEMANA` vazio nas 3.211 linhas e nenhuma escala (dias 9 a 12) em uso; a duração já desconta o intervalo (75 de 94 batem; nenhuma igual à conta sem o intervalo); o superior completo é o 9 (5 ativos); **a unidade do salário é a `foempregados.categoria`** (1 = mês, 5 = hora, conferidas contra o salário-hora do cálculo da folha; a 7, de 4 ativos, fica null); 234 com 44 h. Achados: o `HORAS_COMPENSADAS` é zero em todos (a compensação está no `C` da jornada, 177), 20 com a jornada marcada 12x36 e horário de semana, e 29 em jornadas de horário marcador (sem a hora no Domínio). |
| 09/11/2026 | 3 | Feito. `ponte/consultas/jornadas.sql` (conferida no Domínio de verdade por cópias que só contam: uns 2 a 3 s), o bloco `jornadas` (a foto do dia, ao lado do `andamento`: `fonte.py` com o `CAMPOS_JORNADAS`, o `GRUPO_JORNADAS` e o `TETO_ART8` {2026: 21.188,88}, com o aviso no log no ano sem valor; `fonte_dominio.py`; `fonte_falsa.py` com a 6x1 de 44 h, a 5x2 com o sábado compensado, a 12x36 e o grupo sem jornada, e um nome e um CPF a descartar), o pacote na **versão 4** (`pacote.py`: a trava por grupo, o grupo sem empregado fora, a semana validada, o `faltou`), a ponte **0.4.0**, o `LEIA-ME.md` e os testes (`tests/ponte.test.py`). Uma revisão independente (quatro frentes, cada achado conferido por outro revisor) achou quatro defeitos, consertados: o `min_maior_dia` com horário marcador agora sai null junto com o `min_semana`, e o teste ganhou a chave do grupo inteira, os campos conferidos um a um e o ano do art. 8º sem data fixa (seção 5 do `-DUVIDAS`). `py -3 tests/ponte.test.py`: "Tudo certo." |
| 09/11/2026 | 4 | Feito. `py -3 -m ponte rodar --sem-enviar --meses 1 --saida jornadas-conferencia.json` (a ponte do repositório; a instalada não mudou): saiu com 0; os totais em 60 s (16:51:18 a 16:52:18), a rodada com a etapa das notas em 2 min 2 s. "lido: 474 empresa(s) (119 ativa(s)), 474 linha(s) mensal(is) de 2026-11 a 2026-11; o andamento de 367 empresa(s); o encerramento de 2024 e 2025; as jornadas de 48 empresa(s) (99 grupo(s), 275 empregado(s))"; o `faltou` vazio. As contagens (o script fora do repositório) na seção 3 do `-DUVIDAS`: 177 com o sábado compensado, 58 na 6x1, 27 com os 7 dias, nenhuma escala de verdade nem sem jornada; **207 acima de 42 h**, 5 de 40 a 42 h; 68 trabalham no domingo; `superior_teto` em nenhum; **a soma dos empregados (275) bate com a dos `funcionarios_ativos` do mês (275)**, empresa por empresa. O arquivo e o script apagados (`Test-Path` `False` nos dois). |
| 09/11/2026 | 5 | Feito: o `-DUVIDAS`, este registro, `py -3 tests/ponte.test.py` verde, os commits e o push da `fila-09-11-jornadas`. **A ponte não foi instalada.** Pra sessão do Samuel (seção 4 do `-DUVIDAS`): **62 dos 99 grupos têm 1 empregado** — ali a `salarios`, o `afastados` e o `superior` são da pessoa (decidir antes de instalar); e o ramo só pode ir pra `main` junto com o lado do sistema: o `tests/ponte-funcao.test.mjs` falha com a versão 4 (a função lê a 1, a 2 e a 3), e o `rodar-tudo.py` dá 117 de 119 (a outra é a trava do `ponte-receita.test.py` que confere que o `tests/ponte.test.py` é o da `main`). |
