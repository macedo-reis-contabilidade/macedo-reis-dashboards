# Fila do Claude Code — 09/11/2026 · instalar a ponte da Receita 0.3.0 (o relatório de situação fiscal no Drive) · branch `fila-09-11-relatorios`

> **Para o Code do PC do escritório.** **Leia este arquivo inteiro antes de começar.** Faça os itens **inteiros, sem
> parar pra perguntar**: nenhum item precisa do Samuel na frente do PC. Ao terminar: o **Registro de progresso** (fim
> deste arquivo) preenchido, commit e `git push origin fila-09-11-relatorios`. **Nunca** push em `main` nem merge pra
> ela.

## O que é
- Pedido da Thalia, com o ok do Samuel (09/11/2026): o PDF do relatório de situação fiscal (o SITFIS) que a ponte da
  Receita já baixa todo mês passa a ir pra pasta da empresa no Drive, em FISCAL › SITUAÇÃO FISCAL, e a ficha da empresa
  ganha o link "Abrir o relatório (PDF)". Sem botão e **sem nenhuma consulta a mais ao Serpro**.
- Na `main`, a **ponte da Receita 0.3.0** (`ponte/receita/relatorios.py`): no fim de cada rodada de produção, cada PDF
  `*-situacao-fiscal-*.pdf` de `C:\ponte-dominio\receita\pdfs` que ainda não foi vai pra função `ponte` do sistema, um
  por pedido, e ela o salva no Drive; o `C:\ponte-dominio\receita\relatorios.json` guarda o dia do último que foi de
  cada empresa. O comando novo `py -3 -m ponte receita relatorios` manda os que faltam **sem chamar o Serpro**.
- Os relatórios de 03 e 04/11 ainda estão no PC (os PDFs ficam 30 dias): eles vão hoje, pelo comando novo, sem custo.
- A função do sistema e o banco já estão prontos (o Claude da sessão do Samuel publicou e conferiu). Esta fila **não
  escreve código**: confere no PC, instala e manda os PDFs que estão lá. Quem confere a ficha e o Drive é a sessão do
  Samuel.

## Regras (as de sempre)
- **Dado de cliente não sai do PC — nem pra esta conversa.** No registro, só contagens do escritório inteiro e o
  tempo; nunca o nome, o CNPJ ou o código de uma empresa. O log do comando novo põe o CNPJ da empresa sem a pasta do
  Drive na linha do resumo: no registro, só **quantas**.
- **Não abra nenhum PDF** de `C:\ponte-dominio\receita\pdfs` (nem Read, nem o pypdf): são documentos dos clientes.
  Contar os arquivos pode.
- **Não abra o `C:\ponte-dominio\config.ini`** (nem Read, `type`, `cat` ou `Get-Content`). Pra saber como ficou:
  `py -3 -m ponte receita conferir` e o log do dia.
- **Repositório público**: nada de nome de cliente, CNPJ, código de empresa, valor, chave ou link do Drive.
- **Não mexa no código** (nem em `ponte/`, nem em `supabase/`, nem nos testes). Se um item falhar por causa do código,
  anote o erro (a mensagem, sem CNPJ) e siga a regra do item: o conserto é do Claude da sessão do Samuel.
- Commits em pt-BR.

## 1. O teste
```
git fetch origin --prune
git checkout main
git pull
git checkout -b fila-09-11-relatorios
py -3 tests/ponte-receita.test.py
py -3 tests/ponte.test.py
```
Os dois têm de terminar em "Tudo certo." (o da Receita tem o caso novo, o 13). Se um não terminar, **pare aqui**:
registro e push.

## 2. Instalar
Da pasta do repositório (como nas outras vezes: `powershell` como administrador, se ele pedir):
```
powershell -NoProfile -ExecutionPolicy Bypass -File ponte\instalar.ps1 -Hora 07:00
```
Anote a última linha que ele mostra. Ele copia a ponte nova pra `C:\ponte-dominio\app` (a das duas tarefas) e mantém
o `config.ini`. Confira que:
- `C:\ponte-dominio\app\ponte\receita\__init__.py` tem `VERSAO = '0.3.0'` e existe o
  `C:\ponte-dominio\app\ponte\receita\relatorios.py`;
- a tarefa "Ponte Domínio" segue às 07:00 e a "Ponte Receita" segue registrada, de segunda a sexta às 08:30
  (`Get-ScheduledTask -TaskName 'Ponte Receita' | Format-List State, Triggers`), as duas com o "executar assim que
  possível" ligado.

## 3. Os PDFs que estão no PC (só contar)
```
Get-ChildItem C:\ponte-dominio\receita\pdfs -Filter '*-situacao-fiscal-*.pdf' |
  Group-Object { $_.BaseName.Substring($_.BaseName.Length - 10) } | Sort-Object Name | Format-Table Name, Count
Test-Path C:\ponte-dominio\receita\relatorios.json
```
Anote quantos relatórios há de cada dia (o nome do grupo é o dia) e se o `relatorios.json` já existe (não deve).

## 4. Mandar
1. Da pasta do repositório: `py -3 -m ponte receita relatorios`. Anote o código de saída (`$LASTEXITCODE`), quanto
   tempo levou e, do log do dia (`C:\ponte-dominio\logs\AAAA-MM-DD.log`), a linha "relatórios de situação fiscal — …"
   **só com os números** (troque cada CNPJ por `[cnpj]`). Se a linha não aparecer, anote as linhas `[ERRO]` do comando,
   sem CNPJ, e **pare aqui**: registro e push.
2. Rode de novo: `py -3 -m ponte receita relatorios`. Tem de dizer "nenhum relatório de situação fiscal a mandar"
   (ou mandar só os "sem a pasta do Drive no cadastro", que voltam sempre) e sair com 0. Anote.
3. `(Get-Content C:\ponte-dominio\receita\relatorios.json -Raw | ConvertFrom-Json).PSObject.Properties | Measure-Object`
   — anote só o `Count` (quantas empresas já foram).

## 5. Fim
Commit só deste arquivo (o registro preenchido) e `git push origin fila-09-11-relatorios`. Quem confere as pastas no
Drive e o link na ficha é a sessão do Samuel.

## Registro de progresso
| Data | Item | O que aconteceu |
|---|---|---|
