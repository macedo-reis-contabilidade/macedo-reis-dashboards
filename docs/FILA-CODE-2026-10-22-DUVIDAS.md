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
- **`--falso` só manda pra endereço local** (localhost/127.0.0.1). Não estava na fila: é a trava pra empresa inventada
  nunca chegar no sistema de verdade por um `rodar --falso` esquecido no PC de produção. `--falso --sem-enviar` roda
  sem config nenhum.
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

## O `rodar-tudo.py` não ficou todo verde — por 3 testes que esta branch não toca

`python tests/rodar-tudo.py` → **75 testes · 72 ok · 3 falharam**. O `tests/ponte.test.py` passou. Os três que falham
falham também rodando sozinhos, e nenhum arquivo deles (nem o que eles leem) foi mexido aqui — a fila não deixa:

- **`tests/extract-document.test.mjs` e `tests/noticias.test.mjs`** — erro de caminho no Windows:
  `ENOENT: no such file or directory, open 'C:\C:\Users\…\supabase\functions\…'`. Os dois montam a raiz com
  `new URL('../', import.meta.url).pathname`, que no Windows dá `/C:/Users/…`; o `readFileSync` transforma isso em
  `C:\C:\…`. Passam no Linux, por isso ninguém viu. Correção de uma linha em cada:
  `import { fileURLToPath } from 'node:url'` e `const raiz = fileURLToPath(new URL('../', import.meta.url));`.
- **`tests/harness/transicao-pedido.py`**, checagem 3 ("a mensagem foi pra área de transferência"): lê a área de
  transferência de verdade do Windows (`navigator.clipboard.readText()`), que neste PC não volta com o texto copiado
  (o resto do teste passa, inclusive o "Mensagem copiada."). Depende da máquina; no PC do Samuel pode passar.

## O que a ponte ainda não sabe (depende da Domínio)

- O nome exato do driver (o exemplo usa `SQL Anywhere 17`), o servidor, o usuário e a senha — e se a cópia fica no
  servidor deles (aí entra o `Host=endereço:porta`) ou aqui.
- As tabelas. As quatro consultas estão com `-- A CONFERIR`; o que cada uma recebe e devolve está no começo de
  `ponte/fonte_dominio.py` e no `LEIA-ME.md`.
- A hora em que a cópia atualiza — é dela que sai o `-Hora` da tarefa.
