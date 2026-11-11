# Fila do Claude Code — 11/11/2026 · instalar a ponte 0.4.1 (as jornadas da escala 6x1) · branch `fila-11-11-jornadas`

> **Para o Code do PC do escritório.** **Leia este arquivo inteiro antes de começar.** Faça os itens **inteiros, sem
> parar pra perguntar**: nenhum item precisa do Samuel na frente do PC. Ao terminar: o **Registro de progresso** (fim
> deste arquivo) preenchido, commit e `git push origin fila-11-11-jornadas`. **Nunca** push em `main` nem merge pra
> ela.

## O que é
- A consulta das jornadas (`ponte/consultas/jornadas.sql`, a fila de 09/11) entrou na `main` como a ponte 0.4.0, mas
  ficou sem instalar até o Samuel decidir o grupo de uma pessoa só (62 dos 99 grupos têm 1 empregado: ali a soma dos
  salários é o salário daquela pessoa).
- A decisão (11/11/2026): **o grupo com menos de 3 empregados vai sem o salário, os afastados e o superior** (vão em
  branco, `null`; a jornada, as horas e quantos empregados vão). Está na `main` como a **ponte 0.4.1**
  (`GRUPO_MINIMO_JORNADA` e `CAMPOS_SO_GRUPO_GRANDE` em `ponte/fonte.py`, o corte em `ponte/pacote.py`, o teste em
  `tests/ponte.test.py`). A função do sistema e o banco já aceitam a versão 4 do pacote desde 09/11.
- Esta fila **não escreve código**: testa, instala e roda a ponte uma vez, pra as jornadas chegarem hoje ao sistema
  (a tela Escala 6x1 do DP). Quem confere no banco é a sessão do Samuel.

## Regras (as de sempre)
- **Dado de cliente não sai do PC — nem pra esta conversa.** No registro, só contagens do escritório inteiro e o
  tempo; nunca o nome, o CNPJ, o código de uma empresa ou um salário.
- **Não abra o `C:\ponte-dominio\config.ini`** (nem Read, `type`, `cat` ou `Get-Content`).
- **Repositório público**: nada de nome de cliente, CNPJ, código de empresa, valor ou chave.
- **Não mexa no código** (nem em `ponte/`, nem em `supabase/`, nem nos testes). Se um item falhar por causa do código,
  anote o erro (a mensagem, sem dado de cliente) e pare: o conserto é do Claude da sessão do Samuel.
- Commits em pt-BR.

## 1. O teste
```
git fetch origin --prune
git checkout main
git pull
git checkout -b fila-11-11-jornadas
py -3 tests/ponte.test.py
py -3 tests/ponte-receita.test.py
```
Os dois têm de terminar em "Tudo certo." (o da ponte com as linhas novas do "grupo de 1 empregado"). Se um não
terminar, **pare aqui**: registro e push.

## 2. Instalar
Da pasta do repositório (como nas outras vezes: `powershell` como administrador, se ele pedir):
```
powershell -NoProfile -ExecutionPolicy Bypass -File ponte\instalar.ps1 -Hora 07:00
```
Anote a última linha que ele mostra. Confira que:
- `C:\ponte-dominio\app\ponte\__init__.py` tem `VERSAO = '0.4.1'` e o
  `C:\ponte-dominio\app\ponte\consultas\jornadas.sql` existe;
- a tarefa "Ponte Domínio" segue às 07:00 e a "Ponte Receita" segue registrada, de segunda a sexta às 08:30, as duas
  com o "executar assim que possível" ligado.

## 3. Rodar uma vez
1. `py -3 -m ponte rodar --meses 14` **da cópia instalada** (a da tarefa): `cd C:\ponte-dominio\app` antes. Anote o
   código de saída (`$LASTEXITCODE`), quanto tempo levou e, do log do dia (`C:\ponte-dominio\logs\AAAA-MM-DD.log`), a
   linha "lido: …" (com "as jornadas de N empresa(s) (N grupo(s), N empregado(s))"), a linha "jornadas: N grupo(s) com
   menos de 3 empregados foram sem o salário…" e a resposta da função (HTTP e, se vier, o `jornadas_erro`). Só
   números.
2. Se aparecer `[ERRO]` ou o bloco jornadas no `faltou`, anote a mensagem (sem dado de cliente) e siga pro item 4.

## 4. Fim
Commit só deste arquivo (o registro preenchido) e `git push origin fila-11-11-jornadas`. Quem confere as jornadas no
banco e a tela Escala 6x1 é a sessão do Samuel.

## Registro de progresso
| Data | Item | O que aconteceu |
|---|---|---|
| 11/11/2026 | 1 | Feito. `git fetch --prune`, `main` atualizada (a ponte 0.4.1), a branch `fila-11-11-jornadas`; `py -3 tests/ponte.test.py` (com as linhas novas do grupo de 1 empregado: "com menos de 3 empregados, os dois em branco" e "o grupo de 1 empregado … sem o salário, os afastados e o superior") e `py -3 tests/ponte-receita.test.py`: os dois "Tudo certo.". |
| 11/11/2026 | 2 | Feito. `instalar.ps1 -Hora 07:00` saiu com 0; a última linha: "py -3 -m ponte rodar --sem-enviar" (antes, a tarefa "Ponte Domínio" registrada todo dia às 07:00, os últimos 14 meses, como [o usuário do PC], sem guardar senha). Conferido: `C:\ponte-dominio\app\ponte\__init__.py` com `VERSAO = '0.4.1'` e o `consultas\jornadas.sql` lá; a "Ponte Domínio" `Ready`, às 07:00, todo dia; a "Ponte Receita" `Ready`, às 08:30, de segunda a sexta (`DaysOfWeek` 62); as duas com o "executar assim que possível" ligado. |
| 11/11/2026 | 3 | Feito, da cópia instalada (`C:\ponte-dominio\app`). `py -3 -m ponte rodar --meses 14` saiu com 0, em 9 min 18 s (09:31:30 a 09:40:48): os totais e o envio em 8 min 16 s, o resto é a etapa das notas. "lido: 474 empresa(s) (119 ativa(s)), 6636 linha(s) mensal(is) de 2025-10 a 2026-11; o andamento de 367 empresa(s); o encerramento de 2024 e 2025; as jornadas de 48 empresa(s) (99 grupo(s), 273 empregado(s))". "jornadas: 80 grupo(s) com menos de 3 empregados foram sem o salário, os afastados e o superior (ficam no PC)". A função: "rodada …: foi (HTTP 200)" — na resposta 200 a ponte só registra o HTTP, não o corpo, então o `jornadas_erro` (se vier) não aparece no log: fica pra conferência no banco. Nenhum `[ERRO]`, nenhum bloco no `faltou`, nada em pendentes. A etapa das notas da empresa autorizada: nada novo a mandar. |
| 11/11/2026 | 4 | Commit só deste arquivo e push da `fila-11-11-jornadas`. Quem confere as jornadas no banco (os 99 grupos, os 80 sem o salário) e a tela Escala 6x1 é a sessão do Samuel. |
| 11/11/2026 | Conferência (sessão do Samuel) | Conferido no banco às 10h20: `dominio_jornadas` com 99 grupos de 48 empresas (46 ligadas ao cadastro), 273 empregados, a foto de 11/11; os 80 grupos de menos de 3 sem o salário, os afastados e o superior (0 com valor); a rodada da 0.4.1 (12h39 UTC) com as 474 empresas e nada no `faltou`. Publicado na `main`. |
