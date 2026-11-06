# Fila do Claude Code — 06/11/2026 · instalar a ponte 0.3.2 (a consulta dos cruzamentos corrigida) · branch `fila-06-11-cruzamentos`

> **Para o Code do PC do escritório.** **Leia este arquivo inteiro antes de começar.** Faça os itens **inteiros, sem
> parar pra perguntar**: nenhum item precisa do Samuel na frente do PC. Ao terminar: o **Registro de progresso** (fim
> deste arquivo) preenchido, commit e `git push origin fila-06-11-cruzamentos`. **Nunca** push em `main` nem merge pra
> ela.

## O que é
- O seu rascunho da fila de 05/11 (`ponte/rascunhos/cruzamentos_v2.sql`, com as contagens em
  `docs/FILA-CODE-2026-11-05-DIFERENCAS-DUVIDAS.md`) virou o `ponte/consultas/cruzamentos.sql` da **ponte 0.3.2**, na
  `main`: o corpo é o do rascunho, sem mudança; só o cabeçalho foi trocado. As três correções que você recomendou:
  1. o grupo de resultado pela natureza (o plano com o 3 credor e o 4 devedor);
  2. a receita e a devolução da escrita fiscal pela empresa da nota (a `fili_lan`);
  3. a folha e os encargos pela competência da integração (a `fointegcontlanc`), com as janelas casadas.
- O pacote continua na versão 3 (as mesmas colunas e os mesmos dois parâmetros): a função do sistema e o banco não
  mudam. O que muda é o número: a receita e a folha lançadas de cada mês, que a tela do Controle das contabilidades
  compara com o faturamento e com a folha calculada.
- O resto da sua seção 5 (a F1 no `faturamento.sql`, a coluna do salário-família, as notas sem lançamento, a regra do
  mês vizinho) e as perguntas pra Adaini e pra Thalia (a seção 4) **não são desta fila**: estão com o Samuel.
- Esta fila **não escreve código**: confere no PC, instala a ponte nova e vê a rodada chegar ao sistema. Quem confere os
  números no sistema é o Claude da sessão do Samuel.

## Regras (as de sempre)
- **Dado de cliente não sai do PC — nem pra esta conversa.** No registro, só contagens do escritório inteiro e o
  tempo; nunca o valor, o nome ou o código de uma empresa.
- **A descrição das contas e o histórico dos lançamentos ficam no Domínio**: nunca mostre a descrição de uma conta de
  uma empresa nem o histórico de um lançamento.
- **Não abra o `C:\ponte-dominio\config.ini`** (nem Read, `type`, `cat` ou `Get-Content`). Pra saber como ficou:
  `py -3 -m ponte conferir` e o log do dia.
- **Não abra o arquivo do `--saida`** na conversa: ele tem os dados dos clientes. Só o script do item 2 lê, e ele
  imprime só contagens. No fim do item 2, apague o arquivo.
- **Repositório público**: nada de host, IP, porta, Engine, nome do banco, usuário, senha, nome de cliente, CNPJ, código
  de empresa ou valor.
- **Não mexa no código** (nem em `ponte/`, nem em `supabase/`, nem nos testes). Se um item falhar por causa do código,
  anote o erro (a mensagem, sem valores) e siga a regra do item: o conserto é do Claude da sessão do Samuel.
- Commits em pt-BR.

## 1. O teste
```
git fetch origin --prune
git checkout main
git pull
git checkout -b fila-06-11-cruzamentos
py -3 tests/ponte.test.py
```
O teste tem de terminar em "Tudo certo.". Se não terminar, **pare aqui**: registro e push.

## 2. A rodada sem enviar
Da pasta do repositório (o código novo, com o `config.ini` e a pasta de sempre):

1. `py -3 -m ponte rodar --sem-enviar --meses 14 --saida cruzamentos-conferencia.json` (o arquivo cai em
   `C:\ponte-dominio\`). Anote a hora do começo e do fim (o log do dia tem as duas) e a linha "lido: …".
2. **Se a linha "lido: …" tiver "faltou" com o `cruzamentos`**, anote o motivo (a mensagem, sem valores) e **pare
   aqui** (sem instalar): registro e push. Outro bloco no "faltou": anote e siga.
3. Só contagens do arquivo, num PowerShell (o script abaixo inteiro, do jeito que está: o `'@` do fim tem de ficar no
   começo da linha). São as mesmas regras das suas contagens da fila de 05/11 (a receita nos empresa-meses com
   faturamento e escrita fiscal no mês; a folha nos com as duas acima de zero; diferente = mais de R$ 1,00):

```
@'
import json
p = json.load(open(r'C:\ponte-dominio\cruzamentos-conferencia.json', encoding='utf-8'))
v = lambda l, c: l.get(c) or 0
folha = lambda l: v(l, 'salarios') + v(l, 'decimo_terceiro') + v(l, 'pro_labore_valor')
def conta(m):
    ls = [l for l in p['mensal'] if l['competencia'] == m]
    rec = sum(1 for l in ls if v(l, 'receita_bruta') > 0 and v(l, 'lanc_fiscal') > 0
              and abs(v(l, 'receita_bruta') - v(l, 'receita_lancada')) > 1)
    fol = sum(1 for l in ls if folha(l) > 0 and v(l, 'folha_lancada') > 0 and abs(folha(l) - v(l, 'folha_lancada')) > 1)
    return rec, fol
meses = [m for m in sorted({l['competencia'] for l in p['mensal']}) if '2025-10' <= m <= '2026-09']
tot = [0, 0]
for m in meses:
    r, f = conta(m)
    tot[0] += r
    tot[1] += f
    if m in ('2025-11', '2026-09'):
        print(m, '| receita diferente', r, '| folha diferente', f)
print('10/2025 a 09/2026 | receita diferente', tot[0], '| folha diferente', tot[1], '| meses', len(meses))
print('versao', p['versao'], '| faltou', [f['bloco'] for f in p.get('faltou') or []])
'@ | py -3 -
```

   Anote as quatro linhas. O esperado, pela sua tabela da fila de 05/11 (os números podem mudar um pouco com o que
   entrou no Domínio desde então): 11/2025, receita 16 e folha 12; 09/2026, receita 15 e folha 1; de 10/2025 a 09/2026,
   receita perto de 122 e folha perto de 61; a versão 3.
4. Apague o arquivo: `Remove-Item C:\ponte-dominio\cruzamentos-conferencia.json` e confira com
   `Test-Path C:\ponte-dominio\cruzamentos-conferencia.json` (tem de dar `False`).
5. **Pare aqui** (sem instalar), com o registro e o push, se a receita dos 12 meses passar de 136 ou a folha passar
   de 72 (as contagens de antes da correção, mais os 3 que você previu): a consulta estaria pior que a de hoje.

## 3. Instalar
Da pasta do repositório (como nas outras vezes: `powershell` como administrador, se ele pedir):
```
powershell -NoProfile -ExecutionPolicy Bypass -File ponte\instalar.ps1 -Hora 07:00
```
Anote a última linha que ele mostra. Ele copia a ponte nova pra `C:\ponte-dominio\app` e mantém o `config.ini`.
Confira que:
- `C:\ponte-dominio\app\ponte\__init__.py` tem `VERSAO = '0.3.2'`;
- a primeira linha de `C:\ponte-dominio\app\ponte\consultas\cruzamentos.sql` diz "corrigida em 06/11/2026";
- a tarefa "Ponte Domínio" segue às 07:00, com o "executar assim que possível" ligado.

## 4. A rodada de verdade
1. `Start-ScheduledTask -TaskName 'Ponte Domínio'` e espere ela terminar:
   `Get-ScheduledTaskInfo -TaskName 'Ponte Domínio' | Format-List LastRunTime, LastTaskResult` (o `LastTaskResult` 0 é
   sucesso; a rodada de 14 meses fica uns 40 segundos mais longa que a de hoje cedo — repita até o `LastRunTime` ser o
   de agora e o resultado sair).
2. No log do dia (`C:\ponte-dominio\logs\<hoje>.log`), anote a linha "lido: …", a do envio ("rodada …: foi (HTTP
   200)") e o tempo da rodada (do começo ao "foi"). A etapa das notas roda no fim, como todo dia: anote só a linha
   "mandada(s)" dela (com o estado de hoje cedo, ela manda só a nota nova ou que mudou — pode ser nenhuma).

## 5. Registro e push
O registro preenchido, `py -3 tests/ponte.test.py` verde, commit só deste arquivo e
`git push origin fila-06-11-cruzamentos`.

## Registro de progresso
| Data | Item | Situação / observação |
|---|---|---|
| 06/11/2026 | 1 | Feito. `git fetch --prune`, `main` atualizada, a branch `fila-06-11-cruzamentos`; `py -3 tests/ponte.test.py`: "Tudo certo.". Conferido também: o corpo do `ponte/consultas/cruzamentos.sql` da `main` (do `WITH` ao fim) é idêntico ao do `ponte/rascunhos/cruzamentos_v2.sql` da fila de 05/11, e `ponte/__init__.py` diz `VERSAO = '0.3.2'`. |
| 06/11/2026 | 2.1 | Feito, da pasta do repositório (a saída da tela num arquivo fora do repositório, apagado depois). Começo 11:08:44 ("rodada da ponte 0.3.2: 14 mes(es), dados até 06/11/2026 — sem enviar"), "lido" às 11:16:23, o pacote gravado às 11:16:24 (7 min 40 s). A linha: "lido: 474 empresa(s) (119 ativa(s)), 6636 linha(s) mensal(is) de 2025-10 a 2026-11; o andamento de 367 empresa(s); o encerramento de 2024 e 2025". A etapa das notas rodou no fim, sem enviar (0 novas ou mudadas). |
| 06/11/2026 | 2.2 | Nenhum "faltou" na linha "lido" (nem o `cruzamentos`, nem outro bloco). |
| 06/11/2026 | 2.3 | Feito. `2025-11 \| receita diferente 16 \| folha diferente 12` · `2026-09 \| receita diferente 15 \| folha diferente 1` · `10/2025 a 09/2026 \| receita diferente 122 \| folha diferente 61 \| meses 12` · `versao 3 \| faltou []`. Exatamente os números da tabela da fila de 05/11 (antes da correção: 136 e 69). |
| 06/11/2026 | 2.4 | Feito. `cruzamentos-conferencia.json` apagado; `Test-Path` deu `False`. |
| 06/11/2026 | 2.5 | Nenhuma condição de parada: a receita dos 12 meses em 122 (≤ 136) e a folha em 61 (≤ 72). |
| 06/11/2026 | 3 | Feito. `instalar.ps1 -Hora 07:00` saiu com 0, as 4 linhas de sempre (a tarefa registrada todo dia às 07:00, os últimos 14 meses, como [o usuário do PC], sem guardar senha; e o lembrete do `conferir`); a última: "py -3 -m ponte rodar --sem-enviar". Conferido: `C:\ponte-dominio\app\ponte\__init__.py` com `VERSAO = '0.3.2'`; a primeira linha do `app\ponte\consultas\cruzamentos.sql` instalado diz "corrigida em 06/11/2026, ponte 0.3.2"; a tarefa "Ponte Domínio" `Ready`, às 07:00, com o "executar assim que possível" ligado. |
| 06/11/2026 | 4.1 | Feito. `Start-ScheduledTask` às 11:18; terminou com `LastRunTime` 06/11/2026 11:18:18 e `LastTaskResult` 0 (a próxima, amanhã às 07:00). |
| 06/11/2026 | 4.2 | Feito. O log: "rodada da ponte 0.3.2: 14 mes(es), dados até 06/11/2026" às 11:18:17; "lido: 474 empresa(s) (119 ativa(s)), 6636 linha(s) mensal(is) de 2025-10 a 2026-11; o andamento de 367 empresa(s); o encerramento de 2024 e 2025" às 11:25:59; "rodada 1e7fff04: foi (HTTP 200)" às 11:26:10. Tempo, do começo ao "foi": 7 min 53 s. (A rodada de hoje cedo, ainda a 0.3.0, levou 11 min 34 s, das 10:01:22 ao "foi" das 10:12:56, mas ao mesmo tempo que a leitura das notas da fila de 06/11 na Domínio: os dois tempos não se comparam.) As notas, no fim: a empresa do teste de 01/08/2026 a 06/11/2026, 114 lidas, 72 com XML, **0 novas ou mudadas**, 101 já mandadas sem mudança (13 sem item de compra), consultas em 62,2 s. Sem nada novo, a etapa não manda e **não escreve a linha "mandada(s)"** (`ponte/notas/rodada.py`: a empresa sem nota nova é pulada). |
| 06/11/2026 | 5 | Feito. `py -3 tests/ponte.test.py` verde, commit só deste arquivo, push da `fila-06-11-cruzamentos`. Quem confere os números no sistema (a receita e a folha lançadas da rodada `1e7fff04`) é a sessão do Samuel. |
