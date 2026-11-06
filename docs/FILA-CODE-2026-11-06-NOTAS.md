# Fila do Claude Code — 06/11/2026 · instalar a ponte 0.3.1 (as notas de compra) e o primeiro envio pra Tambasa · branch `fila-06-11-notas`

> **Para o Code do PC do escritório.** **Leia este arquivo inteiro antes de começar**, junto com a seção "As notas de
> compra das empresas autorizadas" do `ponte/LEIA-ME.md`. Faça os itens **inteiros, sem parar pra perguntar**: nenhum
> item precisa do Samuel na frente do PC. Ao terminar: o **Registro de progresso** (fim deste arquivo) preenchido,
> commit e `git push origin fila-06-11-notas`. **Nunca** push em `main` nem merge pra ela.

## O que é
- O módulo das notas de compra (`ponte\notas\`, a sua fila de 03/11, `docs/FILA-CODE-2026-11-03-NOTAS-PONTE.md`) foi
  revisado em 05/11/2026 e está na `main`, na **ponte 0.3.1** (a versão 3 do pacote dos totais, igual, mais as notas).
  O que a revisão mudou:
  - o CFOP de cada item do XML vem **do mesmo item na Domínio**: o do mesmo número, se a quantidade e o valor batem;
    senão, o único com a mesma quantidade e o mesmo valor; senão, o CFOP da nota, quando ela tem um só (o log conta o
    item sem par); senão, a nota fica de fora ("CFOP da nota incerto"). Pelo número sozinho, a Domínio numerada em outra
    ordem mandaria o brinde como compra;
  - as conferências do item (sem descrição ou sem quantidade) olham só os itens de compra: o brinde sem descrição não
    derruba mais a nota;
  - o nome do fornecedor sai sem o CPF que o MEI antigo tem no nome;
  - a recusa que o destino escreve vai pro log sem as sequências de números.
- **O Samuel liberou o primeiro envio** em 05/11/2026 ("Pode mandar assim"): a empresa do teste, com as notas desde a
  data da autorização (01/10/2025). Ficam de fora, como o contrato já faz: **as bonificações** (CFOP 1910, 2910 e 2911,
  68 notas no seu teste de 04/11) e **as 3 notas de combustível de uso próprio** (CFOP 2653, que não está no
  `CFOPS_DE_COMPRA`). Não mude nada disso.
- Depois desta fila, a etapa das notas roda sozinha no fim da tarefa "Ponte Domínio" (a das 7h, que roda quando o PC
  liga): todo dia, o mês de hoje e os três de antes; aos domingos, a janela inteira. Só vai a nota nova ou que mudou.
- Esta fila **não escreve código**: confere, instala, manda e registra. Quem confere no sistema o que chegou (a tabela
  `compartilhamentos_envios`) é o Claude da sessão do Samuel.

## Regras (as de sempre, mais as das notas)
- **Dado de cliente não sai do PC — nem pra esta conversa.** Nunca apareça na conversa, no registro ou em arquivo do
  repositório uma chave, um CNPJ, um nome de fornecedor, um produto, um valor, um trecho do XML **nem o código da
  empresa no Domínio**: no registro, "a empresa do teste" e só contagens e tempos.
- **Não abra o `C:\ponte-dominio\config.ini`** (nem Read, `type`, `cat` ou `Get-Content`). Pra saber como ficou:
  `py -3 -m ponte conferir` e o log do dia.
- **Não abra o arquivo do `--saida`** na conversa: ele tem os dados dos clientes. Só o script do item 2 lê, e ele
  imprime só contagens. No fim do item 2, apague o arquivo.
- **Repositório público**: nada de host, IP, porta, Engine, nome do banco, usuário, senha, nome de cliente, CNPJ, código
  de empresa ou valor.
- **Não mexa no código** (nem em `ponte/`, nem em `supabase/`, nem nos testes). Se um item falhar por causa do código,
  anote o erro (a mensagem, sem valores) e siga a regra do item: o conserto é do Claude da sessão do Samuel.
- **Um envio só.** Fora o comando do item 4, não rode nada que mande notas (nem o `ponte notas rodar` sem
  `--sem-enviar`, nem o `Start-ScheduledTask`), e não rode o item 4 de novo se ele já mandou.
- Commits em pt-BR.

## 1. O teste
```
git fetch origin --prune
git checkout main
git pull
git checkout -b fila-06-11-notas
py -3 tests/ponte.test.py
py -3 tests/ponte-notas.test.py
node tests/ponte-funcao.test.mjs
```
Os três têm de terminar em "Tudo certo.". Se um não terminar, **pare aqui**: registro e push.

## 2. A conferência sem enviar
Da pasta do repositório (o código novo, com o `config.ini` e a pasta de sempre):

1. `py -3 -m ponte notas rodar --sem-enviar --tudo --saida notas-conferencia.json` (o arquivo cai em
   `C:\ponte-dominio\`). Anote do log do dia (`C:\ponte-dominio\logs\<hoje>.log`, só as linhas que começam por
   `notas`): quantas empresas autorizadas e quantas prontas; as notas lidas, com XML, novas ou mudadas e as de fora por
   motivo; a linha "por mês"; as linhas "pela Domínio" e a dos itens sem par, se aparecerem; e o tempo (do "rodada" ao
   "pacote(s) gravado(s)"). **Sem o código da empresa.**
2. Os pacotes pelo `validarPacoteNotas` de verdade, num PowerShell, da pasta do repositório (o script abaixo inteiro, do
   jeito que está: o `'@` do fim tem de ficar no começo da linha). Ele imprime só contagens:

```
@'
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const { validarPacoteNotas, CFOPS_DE_COMPRA } = await import(pathToFileURL('supabase/functions/ponte/notas.js').href);
const { pacotes } = JSON.parse(readFileSync('C:/ponte-dominio/notas-conferencia.json', 'utf8'));
const c = { pacotes: pacotes.length, notas: 0, aceitas: 0, xml: 0, dominio: 0, itens: 0, itensFora: 0, combustivel: 0, bonificacao: 0 };
const motivos = {};
for (const p of pacotes) {
  for (const n of p.notas) {
    c.notas++;
    if (n.origem === 'xml') c.xml++; else c.dominio++;
    c.itens += n.itens.length;
    for (const it of n.itens) {
      const cf = String(it.cfop || '');
      if (cf.endsWith('653')) c.combustivel++;
      if (/^[123]91[01]$/.test(cf)) c.bonificacao++;
    }
  }
  const r = validarPacoteNotas(p);
  if (!r.ok) { const k = 'o pacote — ' + r.campo + ': ' + r.erro; motivos[k] = (motivos[k] || 0) + 1; continue; }
  c.aceitas += r.pacote.notas.length;
  c.itensFora += r.itensFora;
  for (const x of r.recusadas) { const k = x.campo.replace(/\[\d+\]/g, '[]') + ': ' + x.erro; motivos[k] = (motivos[k] || 0) + 1; }
}
console.log(JSON.stringify(c));
console.log('recusadas por motivo:', JSON.stringify(motivos));
console.log('CFOPS_DE_COMPRA tem o 653?', [...CFOPS_DE_COMPRA].some(x => x.endsWith('653')));
'@ | node --input-type=module -
```

   Anote as três linhas. O esperado: `combustivel` 0 e `bonificacao` 0 (os itens dessas notas não vão), `itensFora` 0,
   nenhuma recusada e as `aceitas` iguais às `notas` — perto das 464 do seu teste de 04/11, mais as que entraram na
   Domínio desde então.
3. Apague o arquivo: `Remove-Item C:\ponte-dominio\notas-conferencia.json` e confira com
   `Test-Path C:\ponte-dominio\notas-conferencia.json` (tem de dar `False`).
4. **Pare aqui** (sem instalar e sem mandar), com o registro e o push, se: a lista não tiver a empresa do teste pronta;
   houver alguma recusada, `combustivel` ou `bonificacao` acima de 0, ou `itensFora` acima de 0; ou a leitura der erro.

## 3. Instalar
Da pasta do repositório (como nas outras vezes: `powershell` como administrador, se ele pedir):
```
powershell -NoProfile -ExecutionPolicy Bypass -File ponte\instalar.ps1 -Hora 07:00
```
Anote a última linha que ele mostra. Ele copia a ponte nova pra `C:\ponte-dominio\app` e mantém o `config.ini`.
Confira que:
- `C:\ponte-dominio\app\ponte\__init__.py` tem `VERSAO = '0.3.1'`;
- `C:\ponte-dominio\app\ponte\notas\` existe (com o `rodada.py`, o `pacote.py` e o `xml.py`);
- `C:\ponte-dominio\app\ponte\consultas\` tem o `notas_empresa.sql`, o `notas_itens.sql` e o `notas_xml.sql`;
- a tarefa "Ponte Domínio" segue às 07:00, com o "executar assim que possível" ligado
  (`Get-ScheduledTask -TaskName 'Ponte Domínio' | Format-List State` e o `Get-ScheduledTaskInfo` de sempre).

## 4. O primeiro envio
Da pasta instalada (a que a tarefa roda), **uma vez só**:
```
cd C:\ponte-dominio\app
py -3 -m ponte notas rodar
```
É a primeira vez da empresa (sem ela no estado): a ponte lê a janela inteira, desde a autorização, e manda um pacote de
cada vez (até 200 notas). No log do dia, anote só: a linha "rodada …", a das notas lidas, cada "pacote K de N", as
"recusada" (o campo e o erro, que já saem sem números), a "mandada(s) em … pacote(s)" e o tempo. Confira que
`C:\ponte-dominio\notas\estado.json` existe (`Test-Path`, sem abrir o arquivo).

O que fazer com a resposta:
- **Foi** (a linha "mandada(s)"): siga pro item 5.
- **503 "O destino das notas ainda não foi configurado no sistema."**, **502** ("O destino das notas não recebeu
  agora"), outro 5xx, tempo esgotado ou rede fora: nada fica como mandado; **não repita** — anote a linha e siga pro
  item 5. Quem decide o que fazer é a sessão do Samuel (a tarefa das 7h tentaria de novo sozinha no dia seguinte).
- **403** (a empresa não está autorizada), **422** (fora do contrato) ou **401**: anote a linha e siga pro item 5.

## 5. A tarefa de amanhã
Não rode a tarefa agora. Anote no registro que, a partir da próxima rodada da "Ponte Domínio", a etapa das notas roda
no fim dela e manda só a nota nova ou que mudou (com o estado de hoje, a de amanhã não manda de novo as de hoje).

## 6. Registro e push
O registro preenchido, `py -3 tests/ponte-notas.test.py` verde, commit só deste arquivo e
`git push origin fila-06-11-notas`.

## Registro de progresso
| Data | Item | Situação / observação |
|---|---|---|
| 06/11/2026 | 1 | Feito. `git fetch --prune`, `main` atualizada, a branch `fila-06-11-notas`; `py -3 tests/ponte.test.py`, `py -3 tests/ponte-notas.test.py` e `node tests/ponte-funcao.test.mjs`: os três "Tudo certo.". |
| 06/11/2026 | 2.1 | Feito, da pasta do repositório, com `--sem-enviar --tudo --saida` (a saída da tela num arquivo fora do repositório, apagado depois). O log: "notas: rodada 0.1.0, 06/11/2026 — sem enviar — a janela inteira" (0.1.0 é a versão do módulo das notas, `ponte/notas/__init__.py`; a ponte é a 0.3.1); 1 empresa autorizada, 1 pronta; a empresa do teste de 01/10/2025 a 06/11/2026: 533 lidas, 72 com XML, 464 novas ou mudadas, consultas em 171,4 s; por mês: 10/25 53, 11/25 61, 12/25 30, 01/26 47, 02/26 35, 03/26 33, 04/26 39, 05/26 51, 06/26 36, 07/26 34, 08/26 29, 09/26 50 (42 com XML), 10/26 35 (30 com XML), 11/26 0; de fora: 68 sem item de compra e 1 item sem descrição ou sem quantidade; 9 itens que não são de compra ficaram na ponte. Sem a linha "pela Domínio" e sem a dos itens sem par. 3 pacotes gravados. Tempo, do "rodada" ao "pacote(s) gravado(s)": 2 min 58 s. |
| 06/11/2026 | 2.2 | Feito. `{"pacotes":3,"notas":464,"aceitas":464,"xml":72,"dominio":392,"itens":11710,"itensFora":0,"combustivel":0,"bonificacao":0}` · `recusadas por motivo: {}` · `CFOPS_DE_COMPRA tem o 653? false`. Como o esperado: as aceitas iguais às notas (o mesmo número, 464, do teste de 04/11), sem recusada, combustível, bonificação nem item fora. |
| 06/11/2026 | 2.3 | Feito. `notas-conferencia.json` apagado; `Test-Path` deu `False`. |
| 06/11/2026 | 2.4 | Nenhuma condição de parada: a empresa do teste pronta, nenhuma recusada, `combustivel`, `bonificacao` e `itensFora` em 0, a leitura sem erro. |
| 06/11/2026 | 3 | Feito. `instalar.ps1 -Hora 07:00` saiu com 0; a última linha: "Tarefa 'Ponte Domínio' registrada: todo dia às 07:00 (os últimos 14 meses), como [o usuário do PC] (sem guardar senha)." (e o lembrete de sempre do `conferir`). Conferido: `C:\ponte-dominio\app\ponte\__init__.py` com `VERSAO = '0.3.1'`; `app\ponte\notas\` com o `rodada.py`, o `pacote.py` e o `xml.py` (e o `estado.py`, `falso.py`, `fonte.py`, `sistema.py`); `app\ponte\consultas\` com o `notas_empresa.sql`, o `notas_itens.sql` e o `notas_xml.sql`; a tarefa "Ponte Domínio" `Ready`, às 07:00, com o "executar assim que possível" ligado; a última execução hoje às 10:00 (o PC ligado), resultado 0, a próxima amanhã às 07:00. |
| 06/11/2026 | 4 | Feito, uma vez só, de `C:\ponte-dominio\app` (a saída da tela num arquivo fora do repositório, apagado depois). O log: "notas: rodada 0.1.0, 06/11/2026"; 1 autorizada, 1 pronta; a empresa do teste de 01/10/2025 a 06/11/2026: 533 lidas, 72 com XML, 464 novas ou mudadas, consultas em 170,0 s (o mesmo por mês e os mesmos de fora do item 2.1); "pacote 1 de 3 (200 notas): foi (HTTP 200)", "pacote 2 de 3 (200 notas): foi (HTTP 200)", "pacote 3 de 3 (64 notas): foi (HTTP 200)"; nenhuma "recusada"; "464 mandada(s) em 3 pacote(s)". Tempo: 3 min 3 s (o envio dos 3 pacotes, 6 s). `C:\ponte-dominio\notas\estado.json` existe (antes, não existia; não foi aberto). |
| 06/11/2026 | 5 | A tarefa não foi rodada agora. A partir da próxima rodada da "Ponte Domínio" (amanhã às 07:00, ou assim que o PC ligar), a etapa das notas roda no fim dela e manda só a nota nova ou que mudou: com o estado de hoje, a de amanhã não manda de novo as 464 de hoje. Nos dias de semana, ela lê do dia 1º do mês de três meses atrás até hoje; aos domingos, a janela inteira. Quem confere no sistema o que chegou (`compartilhamentos_envios`) é a sessão do Samuel. |
| 06/11/2026 | 6 | Feito. `py -3 tests/ponte-notas.test.py` verde, commit só deste arquivo, push da `fila-06-11-notas`. |
