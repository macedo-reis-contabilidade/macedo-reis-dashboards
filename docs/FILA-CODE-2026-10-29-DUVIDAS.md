# Dúvidas da fila de 29/10/2026 — a ponte ligada ao banco do Domínio Web e as 4 consultas

Feita em 02/11/2026, depois que a conexão abriu com o usuário externo novo (o caminho até ela está na fila de 02/11).
Só o catálogo e contagens por empresa: nenhuma linha de pessoa passou pela conversa. As tabelas abaixo são só as que
as consultas usam, com a descrição que o catálogo dá; os números são do escritório inteiro, sem empresa.

## O catálogo e o banco

1. **Os acentos.** Vêm certos pela conexão: "Controle de atualização da tabela SELIC", "Catálogo". 270 das 71.311
   linhas do `dominio-tabelas.txt` vêm com o acento quebrado (no cadastro da empresa: "Origem da empresa 0: ContÃ¡bil
   1: Onvio") — o texto já está gravado assim no catálogo do próprio banco (as outras descrições da mesma
   conexão saem certas), não é a conversão da ponte. Não muda nada nas consultas.
2. **O banco é o de hoje.** Pela data de origem do registro (`dorig_sai`, `dorig_ent`, `dorig_lan`, que é a data em
   que a nota ou o lançamento entrou no Domínio), há 23.312 notas de saída, 5.286 de entrada e 23.565 lançamentos
   com data de 02/11 (feriado, sem nenhuma nota emitida no dia: é a integração e a importação rodando). A data não dá
   a hora: se o banco é o de agora ou o da atualização das 12h, ela não diz. O `dados_ate` e a hora da tarefa ficam
   com o Claude da sessão do Samuel.
3. **Não há tempo-limite por consulta** (o driver recusa, 6d0cc3b). As quatro consultas levaram de 1 a 3 s com
   `--mes 2026-09`, e a rodada de 2 meses, 18 s.

## `empresas.sql` — 1,4 s (a versão só de contagem; a inteira, pela rodada)

- **Tabela:** `bethadba.geempre` ("Empresa - Cadastro", 474 linhas): `codi_emp` ("Codigo", a chave), `cgce_emp`
  (char(14), "CNPJ"), `tins_emp` ("Tipo da inscrição(1 - CNPJ/2 - CPF/3 - CEI/6 - CAEPF)"), `razao_emp` ("Razao
  Social"), `nome_emp` (char(40), "Nome") e `stat_emp` ("A - Ativa / I - Inativa / C - Em Constituicao / M - Ativo sem
  movimento / B - Em processo de baixa / E - Excluindo").
- **Regras:** `documento` = `cgce_emp` sem espaços — já guardado com os zeros da frente e só com dígitos (CNPJ com 14,
  CPF com 11, CEI com 12; conferido: nenhum com caractere que não seja dígito, nenhum vazio). `nome` = a razão social
  (vazia, o nome curto; não há nenhuma vazia hoje). `ativa`: A, M, C e B → 'A'; I e E → 'I'; outro valor → nulo.
  Hoje só existem A (119) e I (355).
- **Fica de fora:** nada. Matriz e filial são empresas separadas no Domínio.
- **A confirmar:** (a) se "em constituição" (C) e "em processo de baixa" (B) devem contar como ativas — hoje não há
  nenhuma; (b) 7 empresas são de CPF (1 ativa) e 9 de CEI (inativas): o documento sai como o Domínio guarda, como pede
  a fila; (c) um documento aparece em duas empresas, as duas inativas.

## `folha.sql` — 1,5 s

- **Tabelas:** `bethadba.foempregados` ("Empregados - Cadastro"): `codi_emp`, `i_empregados`, `admissao`,
  `emprego_ant` (o vínculo anterior: sucessão, transferência, reintegração, mudança de CPF), `data_transf`,
  `CATEGORIA_ESOCIAL_EMPREGADO` ("Categoria eSocial do Empregado."), `CATEGORIA_ESOCIAL` ("Código da categoria
  eSocial."); `bethadba.forescisoes` ("Rescisao - Calculo"): `demissao` ("Data Demissao"), `tipo` (1 normal, 2
  complementar), `CODIGO_AFASTAMENTO`, `MOTIVO_ESOCIAL` ("Motivo eSocial"); `bethadba.FOAFASTAMENTOS`: `DATA_REAL`
  (o início), `DATA_FIM` ("Data fim", o último dia afastado), `I_AFASTAMENTOS` (o tipo do afastamento);
  `bethadba.fobasesserv` ("Bases - Calculo"): `competencia`, `tipo_process` ("TIPO DE CALCULO"; 11 = Mensal),
  `simulacao`; e `bethadba.geempre.stat_emp`.
- **O que os dados mostraram (todos os cadastros):** os empregados estão com a categoria em
  `CATEGORIA_ESOCIAL_EMPREGADO` — 101 (2.919) e 104, doméstico (5); os contribuintes em `CATEGORIA_ESOCIAL` — 722
  (303), 701, autônomo (41), e 723 (27). Nenhum estagiário (901). A rescisão normal é uma por empregado (2.408). A
  `DATA_FIM` é o último dia afastado (4.740 dos 5.196 afastamentos com fim batem com os dias contando os dois
  extremos; 32 com a conta sem o último). A férias é o tipo 9 (todo afastamento ligado a um cálculo de férias é o 9).
- **Regras:** empregado = categoria de 101 a 111. `funcionarios_ativos` = admitido até o último dia (no cadastro que
  veio por sucessão ou transferência, a partir da `data_transf`) e sem rescisão normal com demissão até ele — quem é
  demitido no dia 30 já não conta. `admissoes` = admissão no mês, fora sucessão, transferência, reintegração e
  mudança de CPF (nenhuma desses nos últimos 12 meses). `desligamentos` = rescisão normal com demissão no mês, fora a
  transferência (código N1/N2 ou motivo eSocial 11 a 13; uma em 12 meses). `afastados` = dos ativos, os com
  afastamento no último dia, fora os tipos que não são afastamento: 1 Trabalhando (a volta ao trabalho também é uma
  linha da tabela — 534 dos ativos em 30/09 têm), 8 Demitido, 9 Férias, 23 Transferido, 52 Período anterior à
  admissão e 53 Licença remunerada férias. `pro_labore` = **calculado no mês**: os de categoria 721, 722 ou 723 com a
  folha Mensal (11) calculada, sem simulação (o 701, autônomo, fica de fora).
- **O corte das empresas** (não estava na fila): entra a empresa ativa no Domínio (A, M, C, B) e a que teve a folha
  Mensal calculada no mês. Em 30/09, **261 empregados sem rescisão estavam em 37 empresas inativas sem folha no mês**
  — quem saiu do escritório fica com os empregados sem rescisão no Domínio, e a regra da fila os contaria como ativos
  todo mês. Com o corte: 98 empresas, 290 ativos (as ativas com folha no mês têm 280; 3 ativas sem folha no mês, 9;
  1 inativa com folha, 1), 22 admissões, 19 desligamentos, 9 afastados, 90 sócios com pró-labore (a folha Mensal de
  09/2026 calculou 288 empregados de categoria 101). A empresa que ficar inativa depois continua com os números dos
  meses em que teve folha.
- **A confirmar com o DP (Vitória):** (a) o doméstico (104) conta como empregado; (b) o afastamento de um dia
  (atestado, ausência justificada) que caia no dia 30 conta como afastado, e a "Licença remunerada férias" (53) fica
  de fora com as férias; (c) as 3 empresas ativas com empregados e sem folha calculada em 09/2026 — se são de verdade
  ou cadastros esquecidos; (d) se o pró-labore deve ser o calculado (como está) ou o dos sócios ativos.

## `fiscal.sql` — 2,5 s

- **Tabelas:** `bethadba.efsaidas` ("Notas Fiscais de Saida"), `bethadba.efservicos` ("Notas Fiscais de Servico", o
  serviço prestado: o outro lado é o cliente) e `bethadba.efentradas` ("Notas Fiscais de Entrada", com a NFS-e
  tomada). Colunas: `codi_emp`; a data — `dsai_sai` ("Data de saida"), `dser_ser` ("Data do servico"), `dent_ent`
  ("Data de entrada"), as datas do livro (nenhuma nula em 09/2026; `dent_ent` igual à `DATA_ENTRADA` em todas); o
  valor — `vcon_sai`, `vcon_ser`, `vcon_ent` ("Valor contabil"); a nota — `codi_esp` ("Especie"), `seri_*` ("Serie"),
  `sub_serie_*` ("Sub Serie"), `nume_*` ("Documento"), `codi_cli` ("Cliente") / `codi_for` ("Fornecedor"); a
  situação — `situacao_*` (o catálogo diz "Codigo do modelo do documento fiscal", mas os valores são os do SPED) e
  `cancelada_sai`/`cancelada_ser` ("Nota cancelada (S/N)").
- **O que os dados mostraram (09/2026):** a nota com mais de um acumulador ou CFOP fica em várias linhas (o
  segmento): 33.678 linhas de saída são 27.115 notas; 5.368 de entrada, 5.041 notas; serviço, uma linha por nota. Os
  segmentos têm valores diferentes (só 63 de 6.472 notas com todos iguais): o valor contábil é a soma das linhas. A
  cancelada é a `situacao` 2 (133 saídas, 42 entradas, 4 serviços, todas com valor zero) — o `cancelada_sai` vem
  sempre N. Aparecem também a situação 9 (212 saídas, R$ 542 mil; 41 entradas) e a 6 (44 entradas, complementar).
- **Regras:** a contagem é de notas distintas (espécie, série, subsérie, número e cliente ou fornecedor) e o valor, a
  soma das linhas; fora as situações 2, 3, 4 e 5 (cancelada, cancelada extemporânea, denegada, inutilizada). Saída =
  mercadoria + serviço prestado; entrada = tudo da `efentradas`.
- **A confirmar com o fiscal (Thalia):** (a) o que é a situação 9 (entra como nota boa); (b) o valor contábil é o
  movimento todo — devolução, remessa, transferência, bonificação —, não o faturamento; (c) o cupom e a redução Z
  entram como as notas que o Domínio gera deles.

## `contabil.sql` — 1,1 s

- **Tabela:** `bethadba.ctlancto` ("Lancamentos Contabeis", 2.839.734 linhas): `codi_emp` ("Empresa"), `data_lan`
  ("Data"), `orig_lan` ("Origem": 1 Normal, 2 Zeramento, 4 a 7 a escrita fiscal, 10 a apuração, 13 a folha…),
  `codi_lote` e `nume_lan` (só pra conferir).
- **O que os dados mostraram (09/2026):** cada linha é um lançamento numerado, com a conta a débito e a crédito
  (31.129 linhas das saídas integradas em 30.401 lotes; quase sempre um lote por linha). O zeramento (2) cai todo no
  último dia (42 de 42 em 09/2026; 793 de 793 em 12/2025). A maior parte vem da integração: 31.129 das saídas, 3.263
  das entradas, 1.780 da origem 39, contra 117 do lançamento normal.
- **Regras:** `lancamentos` = as linhas com data no mês, fora o zeramento; `ultimo_lancamento` = a maior data do mês.
- **A confirmar com o contábil (Adaini):** (a) se o número que a equipe vê no Domínio é o de linhas ou o de lotes;
  (b) se a apuração (10) e as outras que caem no último dia ficam ou saem com o zeramento; (c) 4 empresas têm a
  contabilidade centralizada entre matriz e filiais (101 linhas de 09/2026 de outra filial no código da matriz): ali a
  filial aparece sem lançamento e a matriz com os dela; (d) há lançamentos com data no futuro (2088, 2202, 7024 — 7
  linhas digitadas erradas) que só pesariam no mês deles.

## A rodada e o teste

1. **`--meses 2` agora é outubro e novembro.** A fila (de 29/10) contava com setembro dentro dos 2 meses; em 02/11,
   a rodada de 2 meses lê 10/2026 e 11/2026. Rodei a pedida (`conferencia.json`) e outra de 3 meses
   (`conferencia-09.json`), as duas sem enviar, e a folha das 10 empresas é de 09/2026.
2. **`tests/ponte.test.py`: 2 falhas, esperadas.** A parte 3 ("pelo programa, com as consultas do repositório
   (todas a conferir): sai com 0 e nada é mandado" e "e avisa na tela e no log", linhas 446-447) supõe que as
   consultas do repositório ainda têm o `-- A CONFERIR`. Prontas, a rodada do teste tenta abrir o Domínio (no teste,
   sem o pyodbc) e sai com 1. É do teste, não da ponte nem das consultas; não mexi (nesta fila, só as consultas e os
   arquivos da fila). O resto, verde.
3. **`python tests/rodar-tudo.py`: 100 testes, 97 ok.** Os 3 que falharam: o `ponte.test.py` (o item 2), o
   `ponte-receita.test.py` (a parte 9 dele roda o `ponte.test.py`: a mesma causa) e o `tests/harness/reforma-chat.py`
   — "saudação do assistente do escritório, com o recado da Reforma e 3 perguntas de exemplo da Reforma", que falha
   também rodado sozinho. Esse não tem a ver com esta fila: a branch só difere da `main` nas consultas e nos arquivos
   das filas, e as telas do assistente e da Reforma mudaram na `main` (o Comparativo tributário).
