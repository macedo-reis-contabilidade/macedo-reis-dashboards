# Fila do Claude Code — 27/11/2026 · eSocial: os dependentes sem CPF ou com CPF que não fecha · branch `fila-27-11-esocial-dependentes`

> **Para o Code do PC do escritório.** **Leia este arquivo inteiro antes de começar.** Faça os itens **inteiros, sem
> parar pra perguntar**: nenhum item precisa do Samuel na frente do PC. Ao terminar: o **Registro de progresso** (fim
> deste arquivo) preenchido, commit e `git push origin fila-27-11-esocial-dependentes`. **Nunca** push em `main` nem
> merge pra ela. **Esta fila vem depois da `docs/FILA-CODE-2026-11-27-SEDIF-SIMPLES.md`**: faça aquela primeiro.

## O que é
- Desde 23/11/2026 o eSocial confere na base da Receita o **CPF dos dependentes** informados na admissão, na alteração de
  cadastro e no pagamento (S-2200, S-2205, S-2300, S-1210 e outros; a Nota Técnica S-1.3 nº 07/2026, rev. 20/10/2026). A
  folha de novembro e o 13º são a primeira transmissão grande com a regra.
- O Samuel aprovou (27/11/2026) **contar, por empresa, os dependentes sem CPF ou com CPF que não fecha o dígito
  verificador**, pra Vitória saber onde olhar antes da folha. **Só a contagem**: nenhum nome, CPF ou data de nascimento
  passa pela tua conversa nem vai pro repositório.
- **Só leitura** na Domínio. **Nada de código da ponte muda**: o que se escreve aqui é um rascunho em `ponte/rascunhos/`,
  que a ponte não lê.

## Regras (as de sempre)
- **Não abra o `C:\ponte-dominio\config.ini`** (nem Read, `type`, `cat` ou `Get-Content`).
- **Não rode nada entre 6h50 e 7h20, nem entre 8h20 e 9h00.**
- **Não rode a ponte da Receita**, nem o `py -3 -m ponte rodar`.
- **Dado pessoal não passa pela tua conversa.** Pra achar as tabelas, só o catálogo (`py -3 -m ponte dominio tabelas
  --procurar …`) e consultas de contagem (`py -3 -m ponte dominio sql`, que só mostra contagem e soma por empresa). O
  rascunho do item 3 lê os CPFs **dentro do script** e escreve só contagens no console. **Nunca** abra, `type`, `cat` ou
  leia de outro jeito os arquivos que ele grava em `C:\ponte-dominio\esocial\` (são pra Vitória).
- **Repositório público**: nada de nome de cliente ou de pessoa, CNPJ, CPF, código de empresa ou de empregado. No
  registro, **só os totais**.
- Commits em pt-BR.

## 1. A branch
```
git fetch origin --prune
git checkout main
git pull
git checkout -b fila-27-11-esocial-dependentes
```

## 2. A tabela dos dependentes
Pelo catálogo (`py -3 -m ponte dominio tabelas --procurar dependente`, e o que mais precisar), ache na Domínio Folha:
- a tabela dos **dependentes dos empregados** (deve ser algo como `bethadba.fodependentes`) e as colunas: a empresa
  (`codi_emp`), o empregado (`i_empregados`), o dependente, o **CPF**, o tipo ou grau de parentesco e, se existir, a
  marca de que o dependente está **ativo** (a data de baixa, de fim, "excluído") e as marcas de IRRF, salário-família e
  plano de saúde;
- se o CPF fica guardado com a máscara ou só os dígitos, e se o dependente sem CPF fica nulo, vazio ou com zeros — por
  **contagem** (`dominio sql`), nunca vendo o valor.
Anote no registro as tabelas e as colunas que achou (o nome delas não é dado de cliente).

## 3. O rascunho `ponte/rascunhos/esocial_dependentes.py`
No molde do `ponte/rascunhos/sedif_contagem.py` (a mesma configuração, a conexão da ponte e o log): uma consulta SQL
(em `ponte/rascunhos/esocial_dependentes.sql`) e o script que conta.
- **As empresas e os empregados**: os **ativos no último dia de 10/2026**, como a `ponte/consultas/folha.sql` conta
  (empregado = categoria eSocial de 101 a 111; admitido até o dia, sem rescisão normal até ele; só a empresa ativa no
  Domínio ou com a folha mensal calculada no mês — sem esse corte, quem saiu do escritório conta). Some também os de
  **hoje** se a folha de novembro já estiver calculada em alguma empresa — o importante é quem vai na folha de novembro
  e no 13º. Se for mais simples, use o último dia de 11/2026 com as rescisões até hoje.
- **Os dependentes**: os desses empregados que estão ativos (sem a baixa, se a tabela tiver).
- **O CPF**: só os dígitos; **sem CPF** = nulo, vazio ou só zeros; **CPF que não fecha** = não tem 11 dígitos, todos os
  dígitos iguais, ou o dígito verificador (módulo 11, os dois) não bate. O CPF repetido no mesmo empregado (dois
  dependentes com o mesmo CPF) conta à parte, como **CPF repetido**.
- O script grava, **só no PC**, em `C:\ponte-dominio\esocial\` (crie a pasta):
  - `dependentes-por-empresa.csv` — uma linha por empresa com pendência: o código da empresa no Domínio, o nome dela,
    quantos empregados ativos, quantos dependentes, quantos sem CPF, quantos com CPF que não fecha, quantos repetidos;
  - `dependentes-por-empregado.csv` — uma linha por empregado com pendência: a empresa (código e nome), o nome do
    empregado e quantos dependentes dele estão sem CPF, com CPF que não fecha ou repetido. **Sem o nome do dependente e
    sem CPF nenhum**: a Vitória acha o dependente no cadastro do empregado, na Domínio.
  - Separador `;` e UTF-8 com BOM (abre direto no Excel).
- No console (o que tu vês), **só os totais somados**: quantas empresas lidas, com empregado, com pendência; quantos
  empregados ativos; quantos dependentes; quantos sem CPF, com CPF que não fecha e repetidos; e quantos empregados com
  pendência. **Nada por empresa.**
- Rode da pasta do repositório (`py -3 ponte\rascunhos\esocial_dependentes.py`) e anote os totais e o tempo.

## 4. Fim
Commit dos dois rascunhos (o `.py` e o `.sql`, que não têm dado nenhum) e deste arquivo (o registro preenchido), e
`git push origin fila-27-11-esocial-dependentes`.

## Registro de progresso
| Data | Item | O que aconteceu |
|---|---|---|
