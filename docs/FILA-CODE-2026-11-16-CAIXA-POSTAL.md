# Fila do Claude Code — 16/11/2026 · o teste da Caixa Postal: ler a mensagem pela API conta como abrir no e-CAC? · branch `fila-16-11-caixa-postal`

> **Para o Code do PC do escritório.** **Leia este arquivo inteiro antes de começar.** Faça os itens **inteiros, sem
> parar pra perguntar**: nenhum item precisa do Samuel na frente do PC. Ao terminar: o **Registro de progresso** (fim
> deste arquivo) preenchido, commit e `git push origin fila-16-11-caixa-postal`. **Nunca** push em `main` nem merge pra
> ela.

## O que é
- Decisão do Samuel (16/11/2026, o item 6 das sugestões das pontes): a ponte da Receita vai passar a ler o texto das
  mensagens da Caixa Postal que pedem ação (intimação, termo, notificação, malha, exclusão, auto de infração). Antes de
  ligar isso, falta saber uma coisa: **ler a mensagem pela API (o `CAIXAPOSTAL · MSGDETALHAMENTO62`) marca a mensagem
  como lida no e-CAC?** Se marcar, a leitura pela API pode contar como a consulta do contribuinte, e o prazo de uma
  intimação começaria no dia da leitura, e não 15 dias depois da entrega (Decreto 70.235/1972, art. 23, § 2º, III).
- O teste é feito numa mensagem **só informativa**: "Como se proteger de fraudes bancárias", que a Receita mandou a
  várias empresas e que não pede nada. **Nunca** numa intimação nem em mensagem que peça ação.
- A resposta do detalhamento tem campos de quem leu e quando (`dataLeitura`, `horaLeitura`, `dataCiencia`,
  `dataAcessoExterno`, `horaAcessoExterno`, `tipoUsuario`, `papelUsuario`, `codigoAplicacao`; veja
  `tests/fixtures/receita/CAIXAPOSTAL-MSGDETALHAMENTO62.json`), e a lista (`MSGCONTRIBUINTE61`) tem o
  `indicadorLeitura`. O teste compara o antes e o depois.
- São no máximo 11 chamadas ao Serpro (até 8 listas pra achar a mensagem, 2 detalhamentos e 1 lista no fim), contadas
  no teto do mês como as da rodada.
- Esta fila **não muda o código da ponte**: o teste é um script descartável, fora do repositório, que usa a ponte
  instalada.

## Regras (as de sempre)
- **Dado de cliente não sai do PC — nem pra esta conversa.** O script não escreve na tela nem no log o CNPJ, o nome da
  empresa, o número da mensagem (`isn`), o texto (`corpoModelo`, `variaveis`, `valorParametroAssunto`) nem os campos
  que identificam quem leu (`niUsuario`, `numeroSerieCertificadoDigital`, `emissorCertificadoDigital`,
  `codigoAcesso`): desses quatro, só "preenchido" ou "vazio". No registro, só o que o script mostrar.
- **Só a mensagem informativa.** O script só detalha uma mensagem cujo assunto seja exatamente "Como se proteger de
  fraudes bancárias". Se não achar nenhuma não lida nas candidatas, **não detalhe outra**: anote e vá pro fim (registro
  e push).
- **Não abra o `C:\ponte-dominio\config.ini`** (nem Read, `type`, `cat` ou `Get-Content`). O script carrega a
  configuração pelo `config.carregar()` da ponte, como a rodada faz, e não mostra nenhum valor dela.
- **Não grave o estado da ponte** (`Estado(..., gravar=False)`). A rodada das 8h30 segue como sempre e, se a mensagem
  passar a constar como lida, ela mesma manda isso ao sistema.
- **Não mexa no código** (nem em `ponte/`, nem em `supabase/`, nem nos testes). O script fica em
  `C:\ponte-dominio\testes\caixa-postal.py`, fora do repositório.
- **Repositório público**: nada de nome de cliente, CNPJ, código de empresa, número de mensagem, chave ou link.
- Commits em pt-BR.

## 1. O começo
```
git fetch origin --prune
git checkout main
git pull
git checkout -b fila-16-11-caixa-postal
py -3 tests/ponte-receita.test.py
```
Tem de terminar em "Tudo certo.". Se não terminar, **pare aqui**: registro e push. Anote também a `VERSAO` da ponte
instalada (`C:\ponte-dominio\app\ponte\receita\__init__.py`) e a da `main` (`ponte/receita/__init__.py`). Se forem
diferentes, siga com a instalada e anote.

## 2. O script
Escreva `C:\ponte-dominio\testes\caixa-postal.py` (crie a pasta). Ele:
1. Põe `C:\ponte-dominio\app` no começo do `sys.path` e importa da ponte instalada: `from ponte import config`,
   `from ponte.log import Registro` e `from ponte.receita import serpro, servicos, estado as est_mod`.
2. Monta o cliente de produção **do jeito que `rodar()` monta** (`ponte/receita/rodada.py`, de `base = config.pasta()`
   até `cli = serpro.Cliente(...)`): o `Registro` com os segredos, o `Contador` com o teto (`cfg.teto()`) contando as
   chamadas, o ambiente `producao` e **sem o procurador** (`procurador=None`).
3. Lê o estado com `est_mod.Estado(est_mod.pasta_receita(base), gravar=False)` e escolhe as empresas candidatas: as que
   têm alguma mensagem lembrada como não lida (`est.mensagens_mandadas(doc)` com algum valor `False`), com a
   autorização `ativa` (`est.d['autorizacao']`) e que **não** vão pelo procurador (`not est.via_procurador(doc)`). No
   máximo 8.
4. Em cada candidata, até achar: chama a lista (`servicos.consultar(cli, 'Consultar', 'CAIXAPOSTAL',
   'MSGCONTRIBUINTE61', doc, pedido)`, com o mesmo pedido que `servicos.mensagens` usa: `statusLeitura` '0',
   `indicadorPagina` '0' e o `ponteiroPagina` de `servicos.PONTEIRO_INICIAL`) e procura uma mensagem com o
   `assuntoModelo`, sem os espaços das pontas, **igual** a "Como se proteger de fraudes bancárias" e o
   `indicadorLeitura` diferente de '1'. Achou, para de procurar.
5. **Antes:** mostra, dessa mensagem na lista, o `indicadorLeitura`, a `dataLeitura`, a `horaLeitura`, a `dataCiencia`
   e a `relevancia`.
6. **Detalhamento 1:** chama o `MSGDETALHAMENTO62` com `{'isn': <o isn achado>}` (o mesmo contribuinte) e mostra a
   `dataLeitura`, a `horaLeitura`, a `dataCiencia`, a `dataAcessoExterno`, a `horaAcessoExterno`, o
   `tipoAutenticacaoUsuario`, o `tipoUsuario`, o `papelUsuario`, o `codigoAplicacao` e o `enquadramento`. Do `niUsuario`,
   do `numeroSerieCertificadoDigital`, do `emissorCertificadoDigital` e do `codigoAcesso`, só se estão preenchidos.
   **Nunca** o `corpoModelo`, as `variaveis` nem o `valorParametroAssunto`. Mostra também os nomes dos campos da
   resposta (só os nomes).
7. **Depois:** chama a lista de novo e mostra, dessa mesma mensagem, os campos do passo 5.
8. **Detalhamento 2:** chama o `MSGDETALHAMENTO62` de novo e mostra os campos do passo 6.
9. No fim, mostra quantas chamadas fez e o status de cada uma.

Resposta que não seja 200, a `Falta` da ponte (o teto, o Serpro fora) ou qualquer erro: o script mostra o status e a
mensagem do Serpro (sem CNPJ) e para.

## 3. Rodar
Da pasta do repositório: `py -3 C:\ponte-dominio\testes\caixa-postal.py`. Anote no registro, campo por campo:
- o **antes** e o **depois** da lista (as datas e as horas como vierem, sem o CNPJ e sem o `isn`);
- o que o detalhamento 1 e o 2 mostraram, e o que mudou de um pro outro;
- os nomes dos campos da resposta do detalhamento;
- quantas empresas foram olhadas até achar a mensagem e quantas chamadas foram feitas.

## 4. Fim
Commit só deste arquivo (o registro preenchido) e `git push origin fila-16-11-caixa-postal`. Quem lê o resultado e
decide como a ponte vai ler o texto das mensagens é a sessão do Samuel.

## Registro de progresso
| Data | Item | O que aconteceu |
|---|---|---|
