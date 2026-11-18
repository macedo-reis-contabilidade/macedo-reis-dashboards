# Fila do Claude Code — 17/11/2026 · o teste do fechamento: a leitura do passado de uma empresa e o rascunho dos lançamentos que faltam · branch `fila-17-11-teste`

> **Para o Code do PC do escritório.** **Leia este arquivo inteiro antes de começar**, junto com o
> `docs/FILA-CODE-2026-11-11-FECHAMENTO-DUVIDAS.md` (as tabelas, o grupo da conta, a partida múltipla, o `origem_reg`,
> o DAS e as guias, e os cinco rascunhos `ponte/rascunhos/fechamento_*.sql`, que esta fila reaproveita).
> Faça os itens **inteiros, sem parar pra perguntar**: nenhum item precisa do Samuel na frente do PC. Na dúvida, a
> opção que **muda menos**, anotada em `docs/FILA-CODE-2026-11-17-TESTE-DUVIDAS.md`. Ao terminar: o **Registro de
> progresso** (fim deste arquivo) preenchido, commit e `git push origin fila-17-11-teste`. **Nunca** push em `main` nem
> merge pra ela. **Esta fila não muda a ponte, não instala nada, não grava nada no Domínio e não importa nada**: ela
> lê, conta e deixa no PC um relatório e um rascunho pra quem cuida da contabilidade conferir.

## O que é
- O estudo de 11/11 olhou o escritório inteiro. Agora é **uma empresa só**: a primeira do teste, escolhida pelo Samuel
  com quem cuida da contabilidade (17/11/2026). A meta é pôr essa contabilidade em dia e ver o que funciona, pra
  repetir nas outras do mesmo jeito.
- O caminho combinado pra cada empresa: até quando está fechado, o que quem cuida da contabilidade sabe dela e **a
  leitura do passado dela no Domínio**. Esta fila é a leitura, e o rascunho que sai dela.
- O que entra no Domínio, e quando, é decisão de quem cuida da contabilidade: ela confere o rascunho e **ela** importa,
  pelo importador do próprio Domínio. Daqui não sai lançamento nenhum.

## A empresa (sem nome e sem código no repositório)
- É a única empresa ativa no Domínio com estas marcas, do que a ponte leu em 17/11/2026:
  1. pelo `ponte/consultas/encerramento.sql`: o ano de 2024 com 5.555 lançamentos (`lancamentos_do_ano`) e o zeramento
     de 2024 incluído no Domínio em 17/12/2025 (`zerado_incluido_em`); o ano de 2025 sem zeramento, com 12.254
     lançamentos;
  2. pelo `ponte/consultas/andamento.sql`: nenhuma conta de banco com lançamento (`banco_contas` = 0) e o último
     lançamento do contador no caixa em 15/10/2025 (`caixa_contador_ate`).
- Ache o código com consultas de contagem. **Tem de dar exatamente uma empresa**: com nenhuma ou mais de uma, pare,
  anote no registro e vá pro fim (registro e push).
- O código fica só no PC: grave em `C:\ponte-dominio\fechamento\teste\empresa.txt` (crie a pasta). **Não escreva o
  código nem o nome dela** no registro, no DUVIDAS, nos rascunhos, no commit nem em nome de arquivo do repositório.

## O que já se sabe dela
De quem cuida da contabilidade (17/11):
- está fechada até 10/2025;
- não há conta de banco conhecida na contabilidade;
- em 2025 as notas de venda entravam contra o caixa (a conta de código reduzido 5), e em 2026 as vendas entram na
  conta clientes (o reduzido 14);
- "as notas fiscais até 12/2025 foram importadas".

Do que a ponte já manda ao sistema:
- os meses abertos são 12, de 11/2025 a 10/2026. Em todos, a escrita fiscal e a folha já estão na contabilidade: a
  receita lançada bate com o faturamento, e a folha lançada, com a calculada. Não há empregado, só o pró-labore de um
  sócio;
- nenhum lançamento do contador (a origem 1) desde 15/10/2025. Em 10/2025, 8 do contador e 1 da apuração;
- o último lançamento de cada mês de 01 a 08/2026 foi incluído no Domínio em 17/09/2026; o de 09/2026, em 18/10; o de
  10/2026, em 16/11;
- nos meses abertos, o resultado do mês é praticamente a receita menos o pró-labore: as compras não chegam ao
  resultado. Em 10/2025, o resultado do mês ficou muito negativo;
- uma conta com o saldo contra a natureza em todo fim de mês, de 10/2025 a 10/2026.

## Regras
- **As de 11/11 valem todas**: dado pessoal não sai do Domínio; a descrição das contas e o histórico só dentro do
  filtro; não abrir o `C:\ponte-dominio\config.ini` (nem Read, `type`, `cat` ou `Get-Content`); o repositório é
  público; cada consulta em até 3 minutos, fora do horário das tarefas (7h00 e 8h30); sem `instalar.ps1` e sem `ponte
  rodar` sem `--sem-enviar`.
- **O que fica só no PC**, em `C:\ponte-dominio\fechamento\teste\`: o código da empresa, os códigos reduzidos e a
  classificação inteira das contas dela, todo valor em reais, a saída de cada consulta, o relatório e o rascunho. Mande
  a saída das consultas direto pra arquivo: os valores dela não passam pela conversa.
- **O que pode ir pra conversa, pro registro e pro DUVIDAS, só desta empresa**: a estrutura. Os pares pelo **grupo**
  (os 5 primeiros dígitos da classificação, com o título do plano modelo, a empresa 998), a origem, em quantos meses o
  par apareceu, quantos lançamentos, o dia do mês em que costuma cair e de onde sai o valor ("o DAS da competência
  anterior", "valor fixo", "não casou"). Sem valor em reais, sem código reduzido, sem código nem nome da empresa.
- **O histórico dos lançamentos dela não é lido** (pode ter nome). Só o código do histórico padrão e a contagem.
- Código: crie e mexa **só** em `ponte/rascunhos/teste_*.sql`, em `ponte/rascunhos/teste_fechamento.py` e nos dois
  arquivos desta fila. Nas consultas do repositório, o código da empresa é o marcador `{EMPRESA}`, trocado na hora de
  rodar pelo que está no `empresa.txt`. **Não mexa** em `ponte/consultas/`, `ponte/*.py`, `supabase/`, nas telas nem
  nos testes.
- Commits em pt-BR.

## Antes de começar
```
git fetch origin --prune
git checkout main
git pull
git checkout -b fila-17-11-teste
py -3 tests/ponte.test.py
```
O teste da ponte tem de terminar em "Tudo certo.". Se não terminar, **pare aqui**: registro e push.

## 1. A leitura do passado
Tudo desta empresa, mês a mês. Reaproveite os rascunhos de 11/11 com o filtro da empresa. O que está fechado é de
01/2025 a 10/2025; o que está aberto, de 11/2025 a 10/2026.

1. **Os lançamentos por origem**, de 01/2025 a 10/2026: quantos e a soma, por mês e origem, com a origem 1 separada em
   digitada (`origem_reg` = 0) e importada (`origem_reg` = 2).
2. **O que o contador lançou** (a origem 1), de 01 a 10/2025: por data, conta de débito, conta de crédito e lote, a
   contagem e a soma (é o lançamento, sem ler a linha). No PC, com os códigos e os valores. Na conversa e no DUVIDAS,
   por par de grupos: em quantos dos 10 meses, quantos lançamentos, o dia do mês (o mais comum e a faixa), se é um por
   mês ou vários, se usa código de histórico padrão (e se é sempre o mesmo) e se é partida múltipla.
3. **De onde sai o valor** de cada par de contas que aparece em 8 dos 10 meses ou mais (o "fixo" desta empresa), até
   R$ 1,00, na competência do mês ou na anterior, pelo caminho do `fechamento_valores.sql`: o DAS (`efsdoimp`, o
   imposto 44), a GPS (`foguiainss.total_guia`), o pró-labore bruto e o líquido, valor fixo no período (o maior e o
   menor diferem até 1%), ou nada.
4. **Os honorários contábeis**: os pares `32204`×`21501` (a provisão) e `21501`×`11101` (o pagamento), se existirem
   nela. Pelo sistema do escritório, em 2025 a empresa pagou o honorário nestes dias: 14/01, 10/02, 18/03, 10/04,
   19/05, 06/06, 08/07, 08/08, 09/09 e 14/10. Confira, com sim ou não por mês: o pagamento lançado cai nesse dia? A
   provisão cai em que dia, e de qual mês ela é? O valor é um só de fevereiro a outubro, e o de janeiro é menor?
5. **O que a integração lança**, de 01/2025 a 10/2026, por mês e par de grupos: a escrita fiscal (as origens 4 a 9,
   11 e 21 a 29), a folha (a 13) e a apuração (a 10). Responda no DUVIDAS:
   - a venda entra contra o caixa ou contra clientes, mês a mês? Em que mês muda?
   - quando os lançamentos da escrita fiscal de cada mês de 2026 foram incluídos no Domínio (a contagem por mês e dia
     de inclusão)? Os que entraram em 17/09, 18/10 e 16/11/2026 foram contra o caixa ou contra clientes?
   - a compra entra contra fornecedores ou contra o caixa? O pagamento do fornecedor é integrado?
   - o pró-labore: quais lançamentos a folha integra em cada mês (a provisão, o INSS retido, o pagamento) e por que
     são 3 por mês até 11/2025 e 2 de 12/2025 em diante;
   - a apuração: em quais meses de 2025 ela existe e o que lança (a provisão do DAS?). Confirme que nos meses abertos
     ela não existe.
6. **Os saldos no fim de cada mês**, de 12/2024 a 10/2026: por conta, no PC; por grupo, a estrutura no DUVIDAS (sobe,
   desce, zera, fica parado, vira contra a natureza). O que interessa: o caixa, clientes, os estoques, fornecedores,
   os impostos a recolher, as obrigações previdenciárias, as obrigações com o pessoal e o resultado do mês. E de qual
   grupo é a conta que fica contra a natureza todo mês.
7. **O custo das mercadorias**: de 01/2025 a 10/2026, quais lançamentos mexem nos estoques (`11501`) e nas contas de
   custo (o grupo 3.1), por mês, origem e par de grupos. Em 10/2025, qual lançamento deixou o resultado tão negativo:
   de que par, de que origem, um só ou vários, em que dia? Sem o valor: diga só a razão dele sobre as compras de 01 a
   10/2025 (por exemplo, "0,9 das compras do período").
8. **As guias**, de 11/2024 a 10/2026, só no PC: o DAS e a GPS de cada competência. No DUVIDAS, em quantos meses
   existem.

## 2. O rascunho dos 12 meses abertos (11/2025 a 10/2026)
O rascunho repete **o padrão da própria empresa** em 2025, com o valor de cada mês. Um script,
`ponte/rascunhos/teste_fechamento.py`, lê as saídas do item 1 (os arquivos do PC) e escreve o rascunho e o relatório,
sem mostrar valor na tela.

1. **O que entra**: cada par do item 1.3 (em 8 dos 10 meses ou mais) cujo valor tem fonte.
   - O que casa com o DAS ou com a GPS: o valor da competência anterior de cada mês aberto (o item 1.8). Pela Receita,
     o DAS de 01 a 09/2026 consta pago e a empresa não tinha pendência em 03/11/2026: gere o pagamento de todas as
     competências, de 10/2025 a 09/2026.
   - O de valor fixo: o mesmo valor.
   - Os honorários (o item 1.4): o valor de 2025 (o de fevereiro a outubro) vale pros pagamentos de 11/2025 a
     02/2026; de 03/2026 em diante, 10% a mais. Os dias em que a empresa pagou, pelo sistema do escritório:
     11/11/2025, 04/12/2025, 14/01/2026, 18/02/2026, 09/03/2026, 10/04/2026, 12/05/2026, 10/06/2026, 09/07/2026,
     06/08/2026, 10/09/2026 e 13/10/2026. Use esses dias se em 2025 o pagamento era lançado no dia de verdade (o item
     1.4); senão, o dia que 2025 usava. A provisão, como em 2025. Marque toda linha de honorário com "conferir o
     valor".
   - Em 11/11/2025 a empresa pagou também o honorário adicional do ano, do mesmo valor do mensal. Não gere: ponha na
     lista do que ficou de fora.
2. **A data**: o dia que o par usava em 2025 (o mais comum). Os honorários, como acima.
3. **O histórico**: se o par usava sempre o mesmo código de histórico padrão, o código e o complemento "REF MM/AAAA".
   Senão, um texto do script: "PAGAMENTO DAS REF MM/AAAA", "PAGAMENTO INSS REF MM/AAAA", "HONORARIOS CONTABEIS REF
   MM/AAAA", "PAGAMENTO HONORARIOS CONTABEIS REF MM/AAAA".
4. **A partida múltipla de 2025** (por exemplo, a guia paga com juros): o rascunho gera só o principal, num lançamento
   simples.
5. **O que NÃO entra** (vai pra lista do relatório, com o que 2025 mostra de cada um): o custo das mercadorias e
   qualquer lançamento de estoque; juros, multas e tarifas; o que apareceu em menos de 8 dos 10 meses; a provisão do
   DAS, se em 2025 ela veio pela apuração integrada e não digitada (diga quais meses abertos estão sem ela); o
   recebimento das vendas que em 2026 foram pra clientes; nada de banco.
6. **A prova no passado**: rode o mesmo script pros 10 meses fechados de 2025, como se estivessem abertos, e compare
   com o que foi lançado de verdade: quantos lançamentos do contador o rascunho acertaria (o par, o valor até R$ 1,00
   e o dia), quantos geraria a mais e quantos faltariam. No DUVIDAS, as contagens; no relatório, linha a linha.
7. **Os arquivos, só no PC** (`C:\ponte-dominio\fechamento\teste\`):
   - `rascunho-lancamentos.csv`: uma linha por lançamento, separado por `;`, a data em dd/mm/aaaa, o valor com
     vírgula, em UTF-8 com BOM, com as colunas
     `mes;data;conta_debito;conta_credito;valor;codigo_historico;historico;regra;fonte_do_valor;conferir`;
   - `relatorio.html`: pra abrir no navegador, em português simples, sem palavra de programa. Nesta ordem: (a) como
     2025 foi lançado (cada par, com o código reduzido das duas contas e o título do grupo, mês a mês); (b) o que a
     integração já lança; (c) os saldos no fim de cada mês; (d) o rascunho dos 12 meses, mês a mês; (e) a prova no
     passado; (f) o que ficou de fora e por quê; (g) as dúvidas pra quem cuida da contabilidade.
   - Nada disso vai pro repositório, e nada é importado.

## 3. Registro, DUVIDAS e push
O `docs/FILA-CODE-2026-11-17-TESTE-DUVIDAS.md` com, pra cada item: as tabelas e as colunas usadas, a regra de cada
conta, o tempo de cada consulta, a estrutura (sem valor, sem código) e, no fim, **o que você concluiria**: que parte
do que o contador lançou em 2025 o rascunho reproduz, o que os 12 meses abertos ainda pedem depois dele e as dúvidas
pra quem cuida da contabilidade. O registro preenchido, `py -3 tests/ponte.test.py` verde, commit e `git push origin
fila-17-11-teste`. A fila cabe em umas 2 horas: se passar de 3, entregue o item 1 inteiro e o que der do 2, dizendo o
que faltou.

## Registro de progresso
| Data | Item | Situação / observação |
|---|---|---|
| 18/11/2026 | Antes de começar | Feito às 13h44: `git fetch --prune`, `main` atualizada, a branch `fila-17-11-teste`; `py -3 tests/ponte.test.py`: "Tudo certo.". |
| 18/11/2026 | A empresa | Achada pelas marcas (`ponte/rascunhos/teste_empresa.sql`): **exatamente uma**. O código ficou só em `C:\ponte-dominio\fechamento\teste\empresa.txt`. Uma marca mudou desde a leitura da ponte: 2025 tem 12.255 lançamentos (um do contador, com data de 02/01/2025, incluído em 17/11/2026), por isso a consulta parte de 2024, que está zerado. Também em 17/11/2026 a escrita fiscal de 01 a 10/2026 foi integrada de novo (o DUVIDAS, seção 0). |
| 18/11/2026 | 1 | Feito, de 1.1 a 1.8: as consultas `teste_contas`, `teste_contador`, `teste_dia` (uma por mês, de 12/2024 a 11/2026), `teste_saldo_inicial`, `teste_valores` e `teste_eliminados`, todas de 0,3 a 2,6 s, das 13h44 às 14h00, com a saída direto pra arquivo em `C:\ponte-dominio\fechamento\teste\saida\`. A estrutura de cada item está no `docs/FILA-CODE-2026-11-17-TESTE-DUVIDAS.md`, sem valor, sem código reduzido e sem o código da empresa. Em resumo: 51 linhas do contador em 2025, todas digitadas, todas de 01 a 10/2025; os honorários (a provisão e o pagamento) nos 10 meses, o DAS em 8, o INSS em 7, e três eventuais; a venda contra o caixa até 12/2025 e contra clientes de 01/2026 em diante; o pagamento dos fornecedores e o do pró-labore pararam de vir pela integração (em 11/2025 e 12/2025); a apuração (a provisão do DAS) não existe nos meses abertos; o `21602` CONTAS A PAGAR do lado contrário da natureza desde antes de 12/2024; o custo de 2025 lançado de uma vez em 31/10/2025, 0,94 das compras de 01 a 10/2025. |
| 18/11/2026 | 2 | Feito: `ponte/rascunhos/teste_fechamento.py` grava, só no PC, o `rascunho-lancamentos.csv` (36 lançamentos, 3 por mês: o pagamento do DAS da competência anterior, a provisão e o pagamento dos honorários, com o reajuste de 10% nos pagamentos de 03/2026 em diante e "conferir o valor") e o `relatorio.html` (das partes a a g). A prova no passado: dos 41 lançamentos do contador de 2025, 22 acertados no par, no valor e no dia, 5 no par e no valor noutro dia, 1 com o valor de outra competência, 2 a mais e 13 faltando (o INSS, os DAS com juros, o custo, um lançamento de 05/2025 e o acerto de 02/01/2025). Nada foi importado nem lançado no Domínio. |
| 18/11/2026 | Revisão | Uma revisão independente (três leitores, sem acesso aos dados do PC: a privacidade, o cumprimento da fila, a lógica do script) apontou 15 achados. Tratados: o DUVIDAS não diz mais a causa do valor da GPS (com o salário mínimo, ela daria a renda do sócio), o CSV sai sem o ponto de milhar, o resultado de 12/2024 entrou, a conclusão sobre o dia fixo vale só pros honorários, e o script ganhou as proteções (para com a saída cortada; o par fixo de estoque, custo ou juros não entra; o casamento só no mês ou no anterior; o histórico pelo que casou; o pagamento dos honorários sem a provisão lançada usa o de 2025 e avisa). O que o revisor da lógica supôs da provisão de 10/2025 não vale aqui (ela está lançada): a proteção ficou assim mesmo. |
| 18/11/2026 | 3 | Feito: o DUVIDAS, este registro, `py -3 tests/ponte.test.py` de novo às 14h17 ("Tudo certo."), o commit (os `ponte/rascunhos/teste_*` e os dois arquivos desta fila) e `git push origin fila-17-11-teste`. Cabe no tempo: das 13h44 às 14h20. |
| 18/11/2026 | Conferência (sessão do Samuel) | Lido e publicado na `main` em 18/11, antes da fila dos acertos (os rascunhos `ponte/rascunhos/teste_*` e o -DUVIDAS): nada de valor em reais, do código nem do nome da empresa no que veio pro repositório. A leitura pro Samuel e as dúvidas pra quem cuida da contabilidade no Projeto, `contabil/contabilidade-em-dia.md`. |
