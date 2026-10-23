# Fila de 22/10 (a ponte do Domínio) — dúvidas, achados e escolhas

> Ver `docs/FILA-CODE-2026-10-22.md`. Nada daqui impediu o trabalho. Em cada caso ficou a opção que **muda menos**;
> a decisão final é do Samuel e do Claude da sessão dele.

## Item 1 — o PC

- **O IP de saída confere** com o fixo do escritório. (O número não está em arquivo nenhum.)
- **A suspensão na tomada NÃO foi mudada por mim — falta o Samuel rodar uma linha.** Mudar a configuração de energia
  do Windows é mexer em configuração do sistema, e isso eu não faço: anotei o antes e deixo o comando.
  - Antes (plano "Equilibrado"): **na tomada, suspende depois de 30 min** (1800 s) e **hiberna: nunca**; na bateria,
    suspende em 15 min e hiberna nunca. A hibernação na tomada já está em "nunca"; falta só a suspensão.
  - Num prompt (não precisa de administrador), o Samuel roda:
    `powercfg /change standby-timeout-ac 0` (e, pra deixar explícito, `powercfg /change hibernate-timeout-ac 0`).
    Pra conferir: `powercfg /query SCHEME_CURRENT SUB_SLEEP` — as duas linhas "Correntes Alternadas" de
    "Suspender depois de" e "Hibernar após" têm que mostrar `0x00000000`. A tela pode continuar apagando.
- **Memória: se a cópia do banco vier pra ser instalada aqui, este PC não aguenta como está.** São 7,9 GB no total e
  0,7 GB livres no momento da medida, com os programas de sempre abertos (inclusive o navegador desta sessão). O
  servidor do banco, na configuração que a Domínio mostra, reserva 70% da memória pra cache — uns 5,5 GB, que este PC
  não tem sobrando. Se a resposta da Domínio for "instalada aí", vale perguntar se dá pra limitar o cache do servidor
  (o SQL Anywhere aceita um teto) ou pôr mais memória no PC. Se a cópia ficar no servidor deles, não importa. O disco
  tem 109,4 GB livres.
- **Drivers ODBC:** só os da Microsoft (Access, Excel, texto, dBase, Paradox, SQL Server, Oracle) — nenhum do SQL
  Anywhere. O Python é o 3.12.10 de **64 bits**, então o driver da Domínio tem que ser o de **64 bits** (a maioria dos
  drivers antigos desta máquina é de 32 e o Python não os enxerga).
- **Sem o Domínio instalado** (não existe `C:\Contabil`) e **sem serviço do SQL Anywhere**. O `pyodbc` ainda não está
  instalado (`py -3 -m pip install pyodbc` — o `conferir` lembra).

## Item 2 — escolhas que a fila não fixava

- **`fonte.py` é uma classe com as quatro funções** (`empresas`, `folha`, `fiscal`, `contabil`), e não quatro funções
  soltas: as duas fontes (`FonteFalsa` e `FonteDominio`) cumprem o mesmo contrato e a rodada não sabe qual está usando.
  A lista do que pode sair do PC (`CAMPOS_*`) mora ali também.
- **"Contando o atual" conta o mês de `dados_ate`** (ontem), e não o mês de hoje. Os dois só diferem no dia 1º: aí o
  "mês de hoje" ainda não tem dado nenhum na cópia, e a rodada mandaria um mês inteiro em branco e deixaria de mandar
  o mês que acabou de fechar.
- **`mensal` traz todas as empresas em todas as competências**, inclusive as inativas e as sem movimento (tudo `null`).
  É a leitura literal de "uma linha por empresa e competência"; o sistema filtra o que quiser.
- **`documento` sem pontuação mantém letra maiúscula**, além dos dígitos — por causa do CNPJ alfanumérico (julho/2026),
  que "só dígitos" estragaria. Pra CNPJ e CPF numéricos o resultado é igual ao "só dígitos".
- **`ativa`** aceita o que o banco devolver de jeito comum (verdadeiro/falso, 1/0, 'S'/'N', 'A'/'I'); o que não der pra
  entender sai `null`, nunca um palpite.
- **Um bloco entra inteiro ou fica de fora inteiro.** Além do "consulta a conferir" que a fila pede, vão pro `faltou`:
  consulta que **deu erro** no banco (`erro na consulta`, a mensagem vai pro log sem a senha) e consulta que devolveu
  **mais de uma linha pra mesma empresa no mês** — sinal de que ela não veio contada (ex.: uma linha por funcionário).
  Assim um erro numa consulta não derruba a rodada, e uma consulta mal escrita não manda número parcial.
- **Códigos de saída nos casos que a fila não cita:**
  - configuração faltando ou incompleta → **2** (repetir do mesmo jeito não adianta);
  - não conseguiu nem ler o Domínio (conexão caiu na consulta de empresas) → **1**, sem pendente — não há pacote pra
    guardar; a próxima rodada lê de novo;
  - sem a consulta de empresas → **0**, e **nem os pendentes** são mandados (leitura literal de "a rodada não manda
    nada"; na prática, enquanto a consulta de empresas não existir, não há pendente nenhum).
- **Pendente recusado:**
  - 401/403 (chave errada) num pendente → para ali, **todos os pendentes ficam** (vão servir quando a chave for
    corrigida), a rodada do dia não é guardada (a regra do 4xx) e sai com 2;
  - outro 4xx num pendente (pacote inválido) → aquele pendente é **apagado** (repetir não adianta), a rodada do dia
    segue e, no fim, sai com **2** mesmo que ela tenha ido — pra alguém olhar o log.
- **`--falso` só manda pra endereço local** (localhost/127.0.0.1) **e não toca nos pendentes** (desde 23/10, achado da
  revisão): não manda os pendentes de verdade pro sistema de mentira nem guarda pacote de empresa inventada na fila que
  a rodada de verdade manda — falhou, sai com 1 sem guardar. Não estava na fila: é a trava pra empresa inventada nunca
  chegar no sistema de verdade por um `rodar --falso` esquecido no PC de produção. `--falso --sem-enviar` roda sem
  config nenhum. Por isso os testes de pendente rodam a rodada de verdade dentro do processo, com a fonte do Domínio
  trocada pela de mentira (`rodar_dentro` no `tests/ponte.test.py`).
- **`conferir` sai com 0** quando a configuração está completa e com 1 quando falta alguma coisa nela (a conexão e o
  ping só informam). Campo copiado do modelo e não trocado aparece como **"ainda é o do exemplo"**.
- **A conexão abre com `readonly=True`** (além de `autocommit`, e 15 s pra conectar). Se o driver do SQL Anywhere não
  aceitar o modo só-leitura, o `conferir` mostra o erro; aí é só tirar o `readonly` em `fonte_dominio.py` — a cópia já
  é só de leitura do lado da Domínio.
- **O `instalar.ps1` está gravado em UTF-8 com BOM.** O PowerShell 5.1 lê `.ps1` sem BOM como ANSI e estragaria o nome
  da tarefa "Ponte Domínio" e as mensagens. A sintaxe foi conferida com o comando da fila.
- **O `instalar.ps1` cria o `config.ini` a partir do modelo quando ele não existe** (com os valores de exemplo, que o
  `conferir` acusa) — a fila só falava do `icacls`. Eu não criei o arquivo: ele só nasce quando o Samuel rodar o
  instalador.
- **`ponte/.gitignore` com `__pycache__/`** — rodar a ponte direto do repositório (`py -3 -m ponte conferir`) cria essa
  pasta; os testes não criam (rodam sem gravar bytecode).
- **`rodar-tudo.py`:** só passou a achar os `tests/*.test.py`. Em paralelo, ele ainda dá a esses testes a variável
  `HARNESS_SITE` e apaga uma `.harness/site-ponte.test` que nunca existe — inofensivo; não mexi pra mudar o mínimo.
- **O `tests/harness/README.md` lista os testes e não cita o da ponte** — a fila não deixava mexer nele. Sugestão de
  linha, pra quem publicar: "`tests/ponte.test.py` (fora do harness, sem tela) — a ponte do Domínio: o pacote do
  Domínio de mentira, a trava do dado pessoal, consultas a conferir, envio com novas tentativas e pendentes, cabeçalhos,
  segredo que nunca aparece e o `conferir`".

## A revisão adversarial (23/10)

Cinco revisores (fidelidade à fila, vazamento, envio e pendentes, ODBC, instalador e testes) e, pra cada achado,
verificadores que tentaram derrubá-lo: **31 achados, 14 confirmados (9 defeitos distintos), 17 derrubados**. Os 9 foram
corrigidos, e cada correção tem checagem no `tests/ponte.test.py` que falha se ela for desfeita (conferido desfazendo
uma por uma):

1. **O `instalar.ps1` rodado da cópia instalada apagava a ponte** — `Remove-Item` da pasta de onde ele mesmo copiava; a
   tarefa ficava sem o módulo e falhava muda, todo dia. Agora ele se recusa quando a origem é a cópia em
   `C:\ponte-dominio\app` (conferido em 6 caminhos, inclusive com maiúscula e barra no fim). O LEIA-ME diz pra rodar o do
   repositório.
2. **`--saida` com caminho solto gravava o pacote na pasta de onde se roda** — rodado do repositório, que é público, o
   arquivo com nome e CNPJ dos clientes nascia lá dentro, sem `.gitignore`. Agora o caminho solto vai pra
   `C:\ponte-dominio\` (ou `PONTE_PASTA`), e o LEIA-ME avisa que o arquivo tem dado de cliente.
3. **URL sem `https://`, com acento ou com `http://` fora do endereço local** derrubava a rodada com traceback (e o
   `http://` mandaria a chave sem criptografia). Agora é "inválido (o porquê)" no `conferir` e o `rodar` para com 2.
4. **Chave colada em duas linhas** (o configparser junta a linha recuada): o envio caía mostrando a chave inteira na
   tela. Agora o campo sai "inválido (tem quebra de linha…)", sem o valor.
5. **Redirecionamento era seguido**: num 301/302/303 o urllib repetia o pedido como GET, sem o pacote, levando a chave
   da ponte pro outro endereço, e contava como "foi". Agora 3xx não é seguido: é erro de configuração ("confira a
   url"), não repete e os pendentes ficam.
6. **`--falso` usava a fila de pendentes de produção** (item acima).
7. **A pasta `C:\ponte-dominio` herdaria de `C:\` o "Usuários autenticados: Modificar"** — qualquer conta do Windows
   poderia trocar o código que a tarefa roda (e, por ele, ler o `config.ini`) ou ler os pendentes. Agora o instalador
   tira a herança e deixa só o usuário, o SISTEMA e os administradores; o `config.ini` continua só do usuário.
8. **O teste do segredo não pegava a ocultação desligada** — nenhuma rodada do teste fazia um segredo chegar ao
   registro. Agora o `Registro` de verdade, com os segredos que ele tira do `config.ini`, recebe todos de propósito.
9. **O teste conferia o tipo dos valores e não o número**, e comparava os campos do pacote com as listas da própria
   ponte. Agora confere os valores (com os centavos, cada um no seu campo) e o contrato da fila escrito no teste.

Erro de configuração no envio (url, cabeçalho, redirecionamento) virou um resultado próprio, `CONFIG`: como a chave
recusada, não repete, não apaga pendente e sai com 2.

Derrubados por serem a regra da fila ou escolha já anotada aqui: o `pyodbc` importado dentro do `conferir` (pra listar
os drivers, como a fila pede — o motivo da regra é os testes rodarem sem ele, e rodam), o 404 num pendente que o apaga
(é o "outro 4xx" acima), a fila parada por um pendente que sempre falha (a regra da 2.4 ao pé da letra), duas rodadas
ao mesmo tempo (a fila não pede trava; a tarefa tem `MultipleInstances IgnoreNew`), a consulta de empresas sem linha
(a fila só para quando a consulta não existe), as variações da linha `-- A CONFERIR` (a ponte é quem a escreve) e o
teste perto da meia-noite. Dois viraram teste mesmo assim: a ordem dos pendentes (mais velho primeiro) agora é
conferida.

**Quatro derrubados ficam pra conferir quando o driver e as consultas chegarem** — não são defeito do código de hoje,
mas dependem do que a Domínio entregar:
- **acento no texto que o driver devolve** (nome de empresa): não deu pra reproduzir sem o driver; se vier quebrado, é
  acertar a codificação na conexão (`setdecoding` do pyodbc);
- **CNPJ guardado como número no banco** perde o zero da frente (e um `float` ganharia `.0`): na consulta, trazer o
  documento como texto (`CAST(... AS VARCHAR)`), com os zeros;
- **coluna com o apelido errado na consulta** (`qtd_notas` em vez de `notas_saida`) sai `null` sem ir pro `faltou` — é o
  "campo que não veio sai null" da fila; quem pega é a conferência das 10 empresas à mão (o portão da fase 2);
- **consulta sem tempo-limite**: o `timeout` de 15 s é só pra conectar; uma consulta presa fica até o Agendador matar a
  tarefa (2 h). Se acontecer, vale pôr o tempo-limite da consulta na conexão.

## O `rodar-tudo.py` não ficou todo verde — por testes que esta branch não toca

**23/10, com a main mesclada** (que trouxe a correção dos dois testes do caminho no Windows, abaixo): duas rodadas.
- Antes das correções da revisão: **80 testes · 78 ok · 2 falharam** — `transicao-pedido.py` (a área de transferência,
  abaixo) e `reforma-chat.py`.
- Depois: **80 testes · 77 ok · 3 falharam** — `transicao-pedido.py`, `analise-recorrentes.py` e `texto-de-fora.py`.

O `tests/ponte.test.py` passou nas duas (100 checagens). Fora o da área de transferência, os que falharam mudam de uma
rodada pra outra e **passam rodando sozinhos** (`reforma-chat.py` 60 checagens, `analise-recorrentes.py` 28,
`texto-de-fora.py` 35): em paralelo, com 4 navegadores ao mesmo tempo, eles esgotam a espera de um elemento da tela
(`wait_for_selector` de 6 a 10 s). Este PC tem 7,9 GB de memória e pouca livre. Nenhum deles toca na ponte nem em
arquivo que ela mexa. Sugestão pra quem cuida dos testes: subir essas esperas ou pôr os três na lista `SOZINHOS` do
`rodar-tudo.py`.

**22/10, antes da main de hoje:** `python tests/rodar-tudo.py` → **75 testes · 72 ok · 3 falharam**. Os três
falhavam também rodando sozinhos, e nenhum arquivo deles foi mexido aqui:

- **`tests/extract-document.test.mjs` e `tests/noticias.test.mjs`** — erro de caminho no Windows:
  `ENOENT: no such file or directory, open 'C:\C:\Users\…\supabase\functions\…'`. Os dois montam a raiz com
  `new URL('../', import.meta.url).pathname`, que no Windows dá `/C:/Users/…`; o `readFileSync` transforma isso em
  `C:\C:\…`. Passam no Linux, por isso ninguém viu. Correção de uma linha em cada:
  `import { fileURLToPath } from 'node:url'` e `const raiz = fileURLToPath(new URL('../', import.meta.url));`.
  **Corrigido na main em 23/10** (veio com o merge; os dois passam).
- **`tests/harness/transicao-pedido.py`**, checagem 3 ("a mensagem foi pra área de transferência"): lê a área de
  transferência de verdade do Windows (`navigator.clipboard.readText()`), que neste PC não volta com o texto copiado
  (o resto do teste passa, inclusive o "Mensagem copiada."). Depende da máquina; no PC do Samuel pode passar.

## O que a ponte ainda não sabe (depende da Domínio)

- O nome exato do driver (o exemplo usa `SQL Anywhere 17`), o servidor, o usuário e a senha — e se a cópia fica no
  servidor deles (aí entra o `Host=endereço:porta`) ou aqui.
- As tabelas. As quatro consultas estão com `-- A CONFERIR`; o que cada uma recebe e devolve está no começo de
  `ponte/fonte_dominio.py` e no `LEIA-ME.md`.
- A hora em que a cópia atualiza — é dela que sai o `-Hora` da tarefa.
