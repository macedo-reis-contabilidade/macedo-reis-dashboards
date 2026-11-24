# Fila do Claude Code — 24/11/2026 · o teste do fechamento: a versão final do arquivo pra importar, com o DAS e o INSS no dia e no valor pagos e os honorários pelo Conta Azul · branch `fila-24-11-teste-final`

> **Para o Code do PC do escritório.** **Leia este arquivo inteiro antes de começar**, junto com o
> `docs/FILA-CODE-2026-11-17-TESTE.md` e o `docs/FILA-CODE-2026-11-17-TESTE-ACERTOS.md` (a empresa do teste, as regras,
> a leitura do passado, o rascunho dos 12 meses e os acertos) e os dois `-DUVIDAS.md` delas. **Esta fila usa os
> arquivos que elas deixaram no PC**, em `C:\ponte-dominio\fechamento\teste\`, e os scripts delas
> (`ponte/rascunhos/teste_fechamento.py` e `teste_acertos.py`).
> Faça os itens **inteiros, sem parar pra perguntar**: nenhum item precisa do Samuel na frente do PC. Na dúvida, a
> opção que **muda menos**, anotada em `docs/FILA-CODE-2026-11-24-TESTE-FINAL-DUVIDAS.md`. Ao terminar: o **Registro de
> progresso** (fim deste arquivo) preenchido, commit e `git push origin fila-24-11-teste-final`. **Nunca** push em
> `main` nem merge pra ela. **Esta fila não muda a ponte, não instala nada, não grava nada no Domínio e não importa
> nada**: ela deixa no PC os arquivos que a Adaini confere e importa.

## O que é
- O teste voltou em 18/11 com o rascunho dos 12 meses abertos (11/2025 a 10/2026) e os acertos. No mesmo dia o Samuel
  decidiu o jeito de fechar 2026: **as integrações das notas e da folha no próprio Domínio, e o que o Domínio não lança
  sozinho num arquivo, importado de uma vez**. Ficou decidido:
  - o pagamento do DAS e do INSS do pró-labore **no dia e no valor pagos**, pela consulta de pagamentos do Integra
    (no PC desde 19/11, em `C:\ponte-dominio\receita\pagamentos\`);
  - os honorários **pelo dia e pelo valor do Conta Azul** (a tabela do item 2.4). O honorário adicional é honorário, e
    os serviços extras são despesa da empresa;
  - a declaração de MEI que a empresa pagou ao escritório foi da esposa do sócio: **retirada do sócio**, não despesa;
  - a venda de 2026 recebida no mês;
  - os fornecedores com um prazo só;
  - as GPS de 07 e 08/2025 **foram pagas** (a consulta de pagamentos mostra o dia e o valor): entram como acerto;
  - 2026 sem banco: fecha pelo caixa.
- **Antes de importar, a Adaini roda no Domínio** a apuração dos 12 meses (a provisão do DAS) e as integrações que
  pararam (o pagamento do pró-labore pela folha; o dos fornecedores pelas entradas). Cada coisa tem de entrar por **um
  caminho só**, senão entra em dobro. Por isso os arquivos saem em duas partes: o que **sempre** entra (item 2) e o que
  só entra **se o Domínio não lançar** (item 3).
- Ficam de fora, como decidido: o custo das mercadorias (o estoque vem da empresa, em 31/12), o caixa que sobra (com o
  cliente, em janeiro) e o contas a pagar do lado contrário da natureza (depois, com o fiscal).

## Regras
- **As da fila do teste e da dos acertos valem todas**, sem exceção: a empresa sem nome e sem código no repositório (o
  código está no `C:\ponte-dominio\fechamento\teste\empresa.txt`); todo valor em reais, os códigos reduzidos, a saída
  das consultas, o relatório e os arquivos **só no PC**, em `C:\ponte-dominio\fechamento\teste\`; a saída das
  consultas direto pra arquivo; o histórico dos lançamentos não é lido; a descrição das contas só dentro de filtro;
  não abrir o `C:\ponte-dominio\config.ini`; cada consulta em até 3 minutos.
- **O arquivo das guias do Integra também fica no PC e não aparece na tela**: o script lê e mostra só contagens (o
  número da guia, o CNPJ e os valores nunca saem na conversa, no registro ou no DUVIDAS).
- **O que pode ir pra conversa, pro registro e pro DUVIDAS**: a estrutura. Quantos lançamentos de cada tipo, em que
  meses, sim ou não, e o tamanho **em proporção**. Sem valor em reais, sem código reduzido, sem código nem nome da
  empresa.
- **Nunca em mês fechado** (01 a 10/2025): o que é de mês fechado entra em **30/11/2025**, dizendo no histórico de que
  mês é.
- Código: crie e mexa **só** em `ponte/rascunhos/teste_final.py`, em `ponte/rascunhos/teste_final_*.sql` (se precisar
  de consulta nova; o código da empresa é o marcador `{EMPRESA}`) e nos dois arquivos desta fila. **Não mexa** em
  `ponte/consultas/`, `ponte/*.py`, `ponte/receita/`, `supabase/`, nas telas nem nos testes.
- **Não rode** a ponte (nem a do Domínio nem a da Receita, nem o `conferir` da Receita) e não rode o `instalar.ps1`.
  Não grave nada no Domínio.
- **Não rode nada entre 6h50 e 7h20, nem entre 8h20 e 9h00**: são as duas tarefas do dia.
- Commits em pt-BR.

## Antes de começar
1. Esta fila vem **depois** da `docs/FILA-CODE-2026-11-19-PROCURACAO.md` (a ponte da Receita 0.4.4, só instalar): se
   o ramo dela (`fila-19-11-procuracao`) ainda não existe em origin, faça ela antes.
2. Precisa da conexão com o Domínio. O escritório mudou de endereço, e a primeira rodada do endereço novo (24/11, das
   16h53 às 17h13) conectou. Rode `py -3 -m ponte conferir` uma vez, da pasta `C:\ponte-dominio\app` (é uma tentativa
   de login, como a rodada):
   - abriu: siga;
   - não abriu pela rede (o servidor não respondeu: `08001`, `-100`, tempo esgotado): **pare sem criar o ramo desta
     fila** e sem escrever nada. Ela fica pendente e o plantão tenta de novo na hora seguinte;
   - não abriu por usuário ou senha (`28000`, `-103`): **não tente de novo**. Crie o ramo, anote e faça o push.
   No registro, sem a linha do IP e sem a mensagem do driver (só os códigos).
3. Então:
```
git fetch origin --prune
git checkout main
git pull
git checkout -b fila-24-11-teste-final
py -3 tests/ponte.test.py
```
O teste da ponte tem de terminar em "Tudo certo.". Se não terminar, **pare aqui**: registro e push. Sem os arquivos
de 18/11 em `C:\ponte-dominio\fechamento\teste\` (o `empresa.txt`, os rascunhos e as saídas das consultas), também.

## 1. As guias pagas, pela consulta do Integra
1. O arquivo das guias da empresa em `C:\ponte-dominio\receita\pagamentos\`: o do CNPJ dela (o CNPJ sai do cadastro do
   Domínio pelo código do `empresa.txt`, dentro do script). Sem o arquivo: **pare aqui**, registro e push.
2. As guias com o dia do pagamento de **01/11/2025 a 31/10/2026**. Pelo que o sistema mostra, são 24: os DAS dos
   períodos de apuração de 10/2025 a 09/2026 e os DARF da previdência dos mesmos períodos (o INSS do pró-labore, pela
   DCTFWeb); os dois do período 08/2026 foram pagos com atraso, com multa e juros. Confira as contagens (por tipo, por
   período, com e sem multa e juros) e anote as diferenças.
3. As da previdência dos períodos **07/2025 e 08/2025** (as GPS que faltaram lançar em 2025): o dia, o principal, a
   multa e os juros de cada uma.
4. No Domínio, confira: o DAS do período 10/2025 está provisionado (a apuração de 10/2025 existe); o INSS de cada
   período está na folha integrada (a provisão). Sim ou não por período.

## 2. O que sempre entra (`arquivo-final.csv`)
1. **O pagamento do DAS**: cada DAS do item 1.2, **no dia do pagamento**. O principal no par que 2025 usava (o imposto a
   recolher contra o caixa); a multa e os juros, se houver, na conta de juros e multas que a empresa usou em 2025 (sem
   ela, a do plano modelo), numa partida múltipla com o caixa. O histórico: "PAGAMENTO DAS REF MM/AAAA" (o período).
2. **O pagamento do INSS do pró-labore**: cada DARF da previdência do item 1.2, do mesmo jeito (o principal contra o INSS
   a recolher, o par de 2025; a multa e os juros à parte). O histórico: "PAGAMENTO INSS REF MM/AAAA".
3. **As GPS de 07 e 08/2025**: em 30/11/2025, do mesmo jeito, com o histórico "PAGAMENTO INSS REF 07/2025 (PAGO EM
   DD/MM/AAAA)" e o de 08/2025.
4. **Os honorários.** **H** é o honorário mensal de 2025 (o de fevereiro a outubro), o mesmo que o rascunho de 18/11
   usou. Pelo Conta Azul:
   - **a provisão** de cada mês de 11/2025 a 10/2026, no dia que 2025 usava (o dia 30; em fevereiro, o último dia), no
     valor do honorário do mês: **H** de 11/2025 a 01/2026 e **1,1 H** de 02/2026 a 10/2026. (O boleto de 01/2026 era
     de 1,1 H, e a empresa pagou H: o escritório deu a diferença. O honorário daquele mês é H.)
   - **o pagamento**, no dia em que a empresa pagou, no valor pago:

     | Dia do pagamento | Do honorário de | Valor |
     |---|---|---|
     | 11/11/2025 | 10/2025 (a provisão de 2025) | H |
     | 04/12/2025 | 11/2025 | H |
     | 14/01/2026 | 12/2025 | H |
     | 18/02/2026 | 01/2026 | H |
     | 09/03/2026 | 02/2026 | 1,1 H |
     | 10/04/2026 | 03/2026 | 1,1 H |
     | 12/05/2026 | 04/2026 | 1,1 H |
     | 10/06/2026 | 05/2026 | 1,1 H |
     | 09/07/2026 | 06/2026 | 1,1 H |
     | 06/08/2026 | 07/2026 | 1,1 H |
     | 10/09/2026 | 08/2026 | 1,1 H |
     | 13/10/2026 | 09/2026 | 1,1 H |

     O honorário de 10/2026 foi pago em 11/11/2026, fora dos 12 meses: fica a provisão, sem o pagamento.
   - **o honorário adicional de 2025**: em 11/11/2025, **H**, na despesa de honorários contra o caixa (como em 2025, sem
     provisão). O de 2026 foi pago em 11/11/2026: entra no fechamento de 11/2026, não aqui.
   - **os serviços extras**, na despesa de honorários contra o caixa: em 07/07/2026, **19/11 de H**, marcado "conferir:
     no Conta Azul está no nome de outra pessoa junto com o da empresa"; em 13/10/2026, **1/22 de H**.
   - **Confira que cada valor fecha em centavos inteiros** (com o H de 2025, H, 1,1 H, 19/11 de H e 1/22 de H dão
     valores redondos). Se não fechar, o H não é o que esta fila supõe: não gere os honorários, anote e siga.
   - Os históricos, como o rascunho: "HONORARIOS CONTABEIS REF MM/AAAA", "PAGAMENTO HONORARIOS CONTABEIS REF MM/AAAA",
     "HONORARIO ADICIONAL ANUAL 2025" e "SERVICOS CONTABEIS EXTRAS".
5. **A declaração de MEI que a empresa pagou ao escritório**: em 09/03/2026, **6/11 de H**, como **retirada do sócio**
   contra o caixa, na conta de lucros distribuídos (ou de retirada de sócio) do plano da empresa. Sem essa conta no
   plano: não gere; ponha na lista "pede decisão".
6. **O recebimento das vendas de 2026**: o acerto do ponto 3 de 18/11 (clientes contra o caixa, no último dia de cada
   mês de 01 a 10/2026, no valor da venda lançada em clientes no mês), sem a marca "conferir".
7. **O que sai do rascunho de 18/11**: o pagamento do DAS do rascunho dos 12 meses e o da GPS dos acertos (os do item
   2.1 a 2.3 tomam o lugar deles) e as marcas "conferir o valor" dos honorários.

## 3. O que só entra se o Domínio não lançar
Um arquivo por coisa, cada um dizendo no nome quando usar. **Só um caminho pra cada**: se a Adaini rodar a rotina no
Domínio, o arquivo dela não entra.
1. `se-nao-integrar-fornecedores.csv` — **o pagamento dos fornecedores**, se a integração das entradas não voltar a
   lançar: o acerto do ponto 4 de 18/11, com o prazo único do mês (no último dia de cada mês de 11/2025 a 10/2026, no
   valor da compra do mês).
2. `se-nao-integrar-pro-labore.csv` — **o pagamento do pró-labore**, se a integração da folha não voltar a lançar: o
   acerto de 18/11 (o líquido da competência anterior).
3. `se-nao-apurar-das.csv` — **a provisão do DAS**, se a apuração dos 12 meses não for rodada: cada mês de 11/2025 a
   10/2026, no último dia, no valor que o Domínio apurou pro período (`efsdoimp`, o imposto 44); sem a apuração do
   período no Domínio, o principal do DAS daquele período pelo Integra.

## 4. A conferência
1. **Os saldos no fim de cada mês**, de 11/2025 a 10/2026, com o `arquivo-final.csv` e: (a) os três arquivos do item 3
   juntos (o caso de nada rodar no Domínio); (b) sem eles (o caso de tudo rodar, simulado pelo que a integração
   lançava em 2025, se der; senão, só o caso a). No DUVIDAS, em proporção: o caixa (não pode ficar negativo em mês
   nenhum), o DAS e o INSS a recolher (zeram, menos o último período), os honorários a pagar (zeram, menos o de
   10/2026), clientes (zera) e fornecedores.
2. **A prova no passado**, de novo: os pagamentos do DAS e da previdência de 01 a 10/2025 pelo Integra contra os que
   o contador lançou em 2025 (o dia e o valor): quantos batem no dia, quantos só no valor e quantos faltam.
3. **Nada em dobro**: nenhum lançamento dos arquivos igual (o par, o dia e o valor) a um que já está no Domínio.

## 5. O formato
- Os arquivos no jeito dos rascunhos de 18/11 (as mesmas colunas, `;`, dd/mm/aaaa, vírgula decimal sem o ponto de
  milhar, UTF-8 com BOM).
- **O leiaute do importador**: procure no catálogo onde o Domínio guarda os leiautes de importação (`--procurar
  leiaute`, `--procurar layout`, `--procurar importacao`). Se achar o que o escritório usa (o "Imp. Layout" dos
  lançamentos importados em 2025), anote no DUVIDAS a estrutura dele (os campos, a ordem, o separador, o jeito da
  data e do valor — nada da empresa) e grave também cada arquivo nele, com `-leiaute` no nome. Se não achar, anote:
  a Adaini confere o leiaute na tela do importador.

## 6. O relatório
O `relatorio.html` ganha, no começo, a parte **"A versão final"**: o que vai em cada arquivo e quantos lançamentos; a
ordem pra Adaini (rodar a apuração e as integrações no Domínio; importar o `arquivo-final.csv`; importar só os arquivos
do item 3 do que o Domínio não lançou; conferir); os saldos do item 4 (o antes e o depois); e a lista do que pede
decisão e do que ficou de fora (o custo, o caixa que sobra, o contas a pagar do lado contrário, o adicional de 2026).

## 7. Revisão, registro, DUVIDAS e push
1. **Uma revisão independente** do script, dos arquivos (pela estrutura, sem abrir valor na conversa) e do DUVIDAS (a
   privacidade, o cumprimento da fila e a lógica), como nas filas de 18/11: cada achado conferido por outro revisor
   antes de mudar.
2. O `docs/FILA-CODE-2026-11-24-TESTE-FINAL-DUVIDAS.md` com: o que entrou em cada arquivo (as contagens), a prova, os
   saldos em proporção, o leiaute (se achou) e o que pede decisão.
3. Os arquivos, o relatório e o que o script gravou ficam só em `C:\ponte-dominio\fechamento\teste\`, nunca no
   repositório.
4. O registro preenchido, `py -3 tests/ponte.test.py` verde, commit e `git push origin fila-24-11-teste-final`.

## Registro de progresso
| Data | Item | Situação / observação |
|---|---|---|
| | Antes | |
| | 1 | |
| | 2 | |
| | 3 | |
| | 4 | |
| | 5 | |
| | 6 | |
| | 7 | |
