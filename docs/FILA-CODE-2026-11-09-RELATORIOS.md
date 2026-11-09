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
   O que esperar: o sistema conferiu em teste (09/11, sem gravar nada) as 87 empresas com o relatório — 85 têm a pasta
   do Drive e vão; 2 não têm a pasta no cadastro e voltam em toda rodada até alguém pôr a pasta. Número muito
   diferente disso (muitas "sem a pasta", ou recusas): anote só os números e siga.
3. `(Get-Content C:\ponte-dominio\receita\relatorios.json -Raw | ConvertFrom-Json).PSObject.Properties | Measure-Object`
   — anote só o `Count` (quantas empresas já foram).

## 5. Fim
Commit só deste arquivo (o registro preenchido) e `git push origin fila-09-11-relatorios`. Quem confere as pastas no
Drive e o link na ficha é a sessão do Samuel.

## Registro de progresso
| Data | Item | O que aconteceu |
|---|---|---|
| 09/11/2026 | 1 | Feito. `git fetch --prune`, `main` atualizada, a branch `fila-09-11-relatorios`; `py -3 tests/ponte-receita.test.py` (com o caso 13, "o relatório de situação fiscal no Drive") e `py -3 tests/ponte.test.py`: os dois "Tudo certo.". |
| 09/11/2026 | 2 | Feito. `instalar.ps1 -Hora 07:00` saiu com 0, as 4 linhas de sempre (a tarefa "Ponte Domínio" registrada todo dia às 07:00, os últimos 14 meses, como [o usuário do PC], sem guardar senha; e o lembrete do `conferir`); a última: "py -3 -m ponte rodar --sem-enviar". Conferido: `C:\ponte-dominio\app\ponte\receita\__init__.py` com `VERSAO = '0.3.0'` e o `relatorios.py` lá; a "Ponte Domínio" `Ready`, às 07:00; a "Ponte Receita" `Ready`, às 08:30, de segunda a sexta (`DaysOfWeek` 62); as duas com o "executar assim que possível" ligado. |
| 09/11/2026 | 3 | Feito, só contando. Os `*-situacao-fiscal-*.pdf` no PC: 27/10/2026, 1; 03/11/2026, 86; 04/11/2026, 1 (88 arquivos). O `relatorios.json` não existia (`False`). Nenhum PDF foi aberto. |
| 09/11/2026 | 4.1 | Feito, da pasta do repositório (a saída da tela num arquivo fora do repositório, apagado depois). Saiu com 0, em 4 min 58 s (11:55:16 a 12:00:14). A linha do log: "[AVISO] receita: relatórios de situação fiscal — 85 no Drive, 2 sem a pasta do Drive no cadastro ([cnpj], [cnpj]) — vão de novo na próxima rodada". Nenhuma recusa, nenhum `[ERRO]`. Os números batem com o teste do sistema (85 com a pasta, 2 sem). Contado pelo nome dos arquivos (sem abrir nenhum): os 88 PDFs são de 88 empresas diferentes, nenhuma com dois. Foram tratados 87 (85 + 2); o que sobra não entrou na fila porque o documento dele não está na lista de empresas que o sistema manda (a regra do `a_mandar`). O de 27/10/2026 (o dia da demonstração do Serpro) não foi pro Drive; pelas contagens não dá pra dizer se ele é esse que sobra ou um dos 2 sem a pasta. O de 04/11 foi. |
| 09/11/2026 | 4.2 | Feito. Rodado de novo: saiu com 0, em 2 s; "[AVISO] receita: relatórios de situação fiscal — 0 no Drive, 2 sem a pasta do Drive no cadastro ([cnpj], [cnpj]) — vão de novo na próxima rodada": nada mandado de novo, só os 2 sem a pasta, que voltam em toda rodada até a pasta entrar no cadastro. |
| 09/11/2026 | 4.3 | Feito. `relatorios.json`: `Count` 85 (as empresas que já foram). |
| 09/11/2026 | 5 | Commit só deste arquivo e push da `fila-09-11-relatorios`. Quem confere as pastas no Drive, o link na ficha e as 2 empresas sem a pasta no cadastro é a sessão do Samuel. |
| 09/11/2026 | Conferência (sessão do Samuel) | No banco: 85 empresas com o link do PDF, todos no formato de arquivo do Drive e com 85 arquivos diferentes; nas 85, o PDF é do mesmo dia das pendências lidas, então a ficha mostra "Abrir o relatório (PDF)" em todas. Na função, 91 pedidos entre 11:55 e 12:00, todos 200. As 2 sem o PDF são as 2 sem a pasta do Drive no cadastro, e o relatório delas é de 03/11: o que sobrou fora da fila é o de 27/10, da demonstração do Serpro (não é empresa da carteira), e ele sai do PC sozinho, com os 30 dias. Fila encerrada. |
