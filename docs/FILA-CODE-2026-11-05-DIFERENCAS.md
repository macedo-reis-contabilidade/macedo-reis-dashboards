# Fila do Claude Code — 05/11/2026 · por que a receita e a folha lançadas não batem · branch `fila-05-11-diferencas`

> **Para o Code do PC do escritório.** **Leia este arquivo inteiro antes de começar**, junto com a seção 5 e o item 7
> de "O que o Claude da sessão do Samuel decide" do `docs/FILA-CODE-2026-11-04-CONTABIL-DUVIDAS.md` (o que você achou na
> receita e na folha lançadas) e com `ponte/consultas/cruzamentos.sql`. Faça os itens **inteiros, sem parar pra
> perguntar**: nenhum item precisa do Samuel na frente do PC. Na dúvida, a opção que **muda menos**, anotada em
> `docs/FILA-CODE-2026-11-05-DIFERENCAS-DUVIDAS.md`. Ao terminar: o **Registro de progresso** (fim deste arquivo)
> preenchido, commit e `git push origin fila-05-11-diferencas`. **Nunca** push em `main` nem merge pra ela.

## O que é
- Desde a versão 3 da ponte (instalada hoje), a tela Controle das contabilidades compara mês a mês a receita lançada no
  contábil (`receita_lancada`, do `cruzamentos.sql`) com o faturamento (`receita_bruta`, do `faturamento.sql`), e a folha
  lançada (`folha_lancada`) com a folha calculada (`salarios` + `decimo_terceiro` + `pro_labore_valor`, do
  `folha_valores.sql`). Quando a Adaini marcou o mês como feito e eles não batem (mais de R$ 1,00), o mês ganha o aviso
  "conferir", e a empresa entra no cartão "O Domínio discorda".
- Na primeira leitura, só nos meses marcados como feitos de 10/2025 a 10/2026: a receita não bate em 18 empresas e a
  folha em 13, **quase tudo em 10 a 12/2025**; em 2026, quase nada. Na folha, metade dos meses lançou a mais e metade a
  menos, e a mediana é 0,5% acima; o 13º e as férias pela provisão não explicam (conferido no sistema).
- Esta fila descobre **por quê**, pra que a regra só aponte o que é problema de verdade, e deixa um rascunho do
  `cruzamentos.sql` corrigido. Ela **só descobre e escreve rascunhos**: o contrato do pacote, a função e a tela não mudam
  aqui (quem decide é o Claude da sessão do Samuel, depois de revisar).

## Regras (as da fila de 04/11, que valem todas)
- **Dado pessoal não sai do Domínio — nem pra esta conversa.** Só o catálogo (`dominio tabelas`) e contagens e somas
  por empresa (`dominio sql` com `COUNT`, `SUM`, `MIN`, `MAX` e `GROUP BY`). Nunca nome, CPF, PIS, salário de uma
  pessoa, nascimento, endereço, telefone ou e-mail de ninguém, nem `SELECT *` de tabela de pessoas ou de lançamentos.
- **A descrição das contas e o histórico dos lançamentos ficam no Domínio**: nunca mostre a descrição de uma conta de
  uma empresa nem o histórico de um lançamento. Use a classificação, o tipo, a natureza e as contagens (a descrição só
  em filtro, como no `cruzamentos.sql`, e a do plano modelo, a empresa 998, só dos grupos).
- **Valor de uma empresa fica fora da conversa e do repositório**: o que é por empresa vai pra arquivos em
  `C:\ponte-dominio\` (fora do repositório); aqui, só o escritório inteiro e contagens ("em 9 das 14 empresas, a
  diferença é a devolução"). Grupo com menos de 3 empresas, só a contagem.
- **Não abra o `C:\ponte-dominio\config.ini`** (nem Read, `type`, `cat` ou `Get-Content`).
- **Repositório público**: nada de host, IP, porta, Engine, nome do banco, usuário, senha, nome de cliente, CNPJ ou
  valor de uma empresa.
- Código: crie e mexa **só** em `ponte/rascunhos/cruzamentos_v2.sql` e nos dois arquivos desta fila. **Não mexa** em
  `ponte/consultas/`, `ponte/*.py`, `supabase/` nem nos testes. Não rode o `instalar.ps1`, nem o `ponte rodar` sem
  `--sem-enviar`; não mexa nas tarefas do Agendador.
- Cada consulta em até 60 segundos com `--mes`. Passou, anote o tempo e a parte cara.
- Commits em pt-BR.

## 1. A receita
1. Os empresa-meses de **10/2025 a 09/2026** com `receita_bruta` > 0, algum lançamento da escrita fiscal no mês (a
   `orig_lan` de 4 a 9, 11 e 21 a 29) e a `receita_lancada` diferente em mais de R$ 1,00. Conte quantos são, de quantas
   empresas, quantos em 2025 e quantos em 2026, e quantos com o contábil maior e com o fiscal maior.
2. Pra cada um, a primeira destas causas que explica a diferença (até R$ 1,00), e conte quantos cada uma explica — as
   cinco da fila de 04/11 e mais:
   a. a nota de saída do mês ainda sem lançamento (a integração do mês incompleta);
   b. a filial lançada na matriz (a contabilidade centralizada): a receita da filial no contábil da matriz;
   c. a devolução no fiscal e não no contábil, ou noutra conta;
   d. a integração em outra conta de receita (fora do `41101`/`41102`): a diferença some somando todas as analíticas de
      receita do grupo de resultado credor da empresa;
   e. o plano com as receitas no grupo 3 (a natureza 3 credora e 4 devedora);
   f. o mês: a diferença some comparando o trimestre, ou a nota de um mês lançada noutro (a `data_lan` fora do mês da
      nota);
   g. o lançamento manual (a origem 1) nas contas de receita do mês, somando ou tirando;
   h. o resto, sem causa achada.
3. **Por que 10 a 12/2025 e quase nada em 2026**: veja se mudou alguma coisa entre os dois períodos — o plano de contas
   (as contas de receita criadas ou trocadas), os acumuladores e a conta deles (`EFACUMULADOR_VIGENCIA`), a integração
   refeita (a `dorig_lan` dos lançamentos de 2025 depois do zeramento de 2025) ou o encerramento. Diga o que achou,
   contado.

## 2. A folha
1. Os empresa-meses de 10/2025 a 09/2026 com a folha calculada > 0 e a `folha_lancada` > 0, diferentes em mais de
   R$ 1,00. Mesma contagem do item 1.1.
2. A primeira causa de cada um:
   a. verbas fora do filtro pela descrição (horas extras, adicionais, comissões, gratificações, DSR, ajuda de custo,
      salário-família): a diferença some somando o débito do mês em todas as analíticas dos grupos de pessoal do grupo 3
      (os itens 001 a 005 dos grupos de pessoal, pelo código);
   b. o que não é despesa nos proventos (o salário-família, que a empresa compensa na guia);
   c. a rescisão em conta própria (indenizações, aviso prévio indenizado) fora do filtro;
   d. o pró-labore fora do grupo 3 (no patrimônio líquido, como retirada) ou noutro mês;
   e. a folha de um mês lançada no seguinte (ou a do 13º, em dezembro e janeiro);
   f. a folha recalculada depois de integrada: a integração (a `orig_lan` 13) com outro total que o cálculo final —
      se o Domínio guarda a data do cálculo da folha, compare com a `dorig_lan` da integração;
   g. o lançamento de outra origem nas contas de folha (o caso de 08/2026 da fila de 04/11);
   h. o resto.
3. Diga se as diferenças de 2025 têm uma causa comum.

## 3. O rascunho do cruzamento
Em `ponte/rascunhos/cruzamentos_v2.sql`, o `cruzamentos.sql` com as correções que as contagens dos itens 1 e 2
justificam — no mínimo, o grupo de resultado pela natureza (`ctnatureza_conta`), no lugar do "4" e do "3" fixos (o item
7 de 04/11) —, as mesmas colunas e os mesmos parâmetros. Rode com `--mes 2025-11` e `--mes 2026-09` e conte, contra a
consulta de hoje, quantos empresa-meses deixam de diferir e quantos ficam. No DUVIDAS, o que ficou de fora e por quê, e
o que só a Adaini sabe (o que fazer com a filial na matriz, por exemplo).

## 4. Registro e push
O registro preenchido, `py -3 tests/ponte.test.py` verde, commit (só os arquivos desta fila e o rascunho) e
`git push origin fila-05-11-diferencas`. Os arquivos de `C:\ponte-dominio\` desta fila podem ficar lá.

## Registro de progresso
| Data | Item | Situação / observação |
|---|---|---|
| 05/11/2026 | base | Feito. O pacote da ponte 0.3.0 com `--sem-enviar` nos 14 meses, gravado sem nome nem documento em `C:\ponte-dominio\dif\` (o com os nomes, apagado). Todas as empresas e todos os meses, não só os marcados como feitos. Uma conferência à parte refez as contagens e as causas por outro caminho e não achou dado sensível nos resultados. |
| 05/11/2026 | 1.1 | Feito. 815 empresa-meses com receita e escrita fiscal; 136 diferentes (39 empresas): 47 em 2025 e 89 em 2026, 48 com o contábil maior e 88 com o fiscal maior. |
| 05/11/2026 | 1.2 | Feito. A primeira causa: a nota sem lançamento 31, a filial na matriz 3, a devolução 61 (33 a devolução de compra a débito do `41201`; 28 o `41201` sem nada, 18 deles a devolução com acumulador sem a marca de faturamento), outra conta de receita 0, o plano invertido 11, o mês 3, o manual 1, o resto 26 — todos com causa: a nota cancelada depois de integrada 11, o valor integrado diferente 5, a integração sem nota 1 e 9 combinações. |
| 05/11/2026 | 1.3 | Feito. O que mudou foi a integração: a de 01 a 07/2026 gerada de novo em 09/2026 (42 empresas com todos esses meses), que integrou as notas sem lançamento só de 2026; 2025 ficou com a primeira (os serviços de 6 empresas sem integração em 15 meses). Tirando os meses com nota sem lançamento, a taxa é a mesma (15%, 12%, 13%). O plano, os acumuladores, os parâmetros e o encerramento não explicam (contado no DUVIDAS). O "quase nada em 2026" deve ser o recorte dos feitos: a contagem nos meses marcados fica pra sessão do Samuel, no banco. |
| 05/11/2026 | 2.1 | Feito. 471 empresa-meses com as duas folhas; 69 diferentes (29 empresas): 33 em 2025 e 36 em 2026, 29 com o contábil maior e 40 com a calculada maior. |
| 05/11/2026 | 2.2 | Feito. Verbas fora do filtro 0, o salário-família e a maternidade 16, a rescisão em conta própria 0, o pró-labore 3, o mês (as férias, o 13º, a rescisão) 30, a folha recalculada 3, o manual 4, o resto 13 (8 combinadas, 5 sem causa de 2 empresas: o mensal integrado a menos). |
| 05/11/2026 | 2.3 | Feito. Não há uma causa, há o fim do ano: as férias coletivas pagas em dezembro, o adiantamento do 13º de novembro e a rescisão paga no mês seguinte; a regra da integração não mudou entre os períodos. |
| 05/11/2026 | 3 | Feito. `ponte/rascunhos/cruzamentos_v2.sql`: o grupo pela natureza, a receita fiscal pela empresa da nota e a folha pela competência da integração (as janelas casadas depois da etapa, sem mudar nenhum número de hoje), as mesmas colunas e parâmetros, 3,8 a 4,8 s por mês. Contra a de hoje: 11/2025, receita 17 → 1 sai, 16 ficam; folha 13 → 1 sai, 12 ficam; 09/2026, receita 17 → 2 saem, 15 ficam; folha 1 → fica. Nos 12 meses, receita 136 → 14 saem, 122 ficam, 0 passam; folha 69 → 11 saem, 58 ficam, 3 passam. O que ficou de fora e o que só a equipe sabe, no DUVIDAS. |
| 05/11/2026 | 4 | Feito. `py -3 tests/ponte.test.py` verde, commit só com os dois arquivos da fila e o rascunho, push da `fila-05-11-diferencas`. |
