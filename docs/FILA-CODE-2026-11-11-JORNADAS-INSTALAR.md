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
