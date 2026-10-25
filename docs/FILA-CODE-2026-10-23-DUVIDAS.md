# Dúvidas da fila de 23/10/2026 — a ponte da Receita (Integra Contador)

Onde a fila deixou espaço, escolhi a opção que muda menos e segui. Cada item diz o que foi feito e onde mudar, se o
Samuel (ou o Claude da sessão dele) preferir outro caminho.

## Item 1 — o ambiente de demonstração

1. **A demonstração só aceita o corpo exato do cenário.** Qualquer outro corpo volta `status 400` com "Dados inválidos.
   Utilize o json no menu Cenário da documentação." (foi o que voltou nos primeiros pedidos de `MSGCONTRIBUINTE61` e
   `INNOVAMSG63`, 220 bytes). Os corpos de cada cenário saíram das cópias da documentação oficial que a biblioteca
   guarda em `doc/` e estão em `ponte/receita/demonstracao.py`. Por isso o `--demonstracao` manda, pra cada serviço,
   o corpo do cenário — qualquer que seja a empresa — e a lista de empresas da demonstração é fixa (uma, Simples). O
   `cnpj_escritorio` continua exigido em demonstração (a fila pede), mas não vai no pedido.
2. **Todos os 10 serviços responderam** (o registro tem o tempo, o tamanho e as mensagens). Nenhum foi montado à mão.
3. **O evento da Caixa Postal.** O cenário da demonstração usa o evento `E0301` (o da DCTFWeb); em produção a ponte
   pede o `E0601` (Caixa Postal, `TipoEvento.caixaPostal` da biblioteca). A demonstração não tem cenário com o E0601.
4. **Uma resposta da demonstração trazia um CNPJ formatado que não é dos exemplos** (`MSGDETALHAMENTO62`, no texto da
   mensagem). Troquei por `00.000.000/0000-00` na fixture — é a única mudança nas respostas guardadas. Um dos PDFs
   do PGDAS da demonstração traz um IP da rede do próprio Serpro (161.148.x.x, o da transmissão): ficou como veio.
5. **O certificado intermediário do Serpro.** O gateway não manda o intermediário dele (AC SERPRO AR46 OV TLS CA 2025,
   da GlobalSign) e o Python, sem ele, recusa a conexão (o Windows acha sozinho; o `curl` do Windows também, e por isso
   escondia o problema). Ele vai junto, em `ponte/receita/ac-serpro-2025.pem` (público), conferido contra a GlobalSign
   Root R46 que o Windows já tem — nunca desliguei a conferência. O LEIA-ME diz como trocar se o Serpro mudar.
6. **`MSGDETALHAMENTO62` e `INNOVAMSG63` ficaram só como fixtures.** A fila pede o texto inteiro da mensagem fora do
   pacote, e o "quem tem novidade" sai mais barato pelo lote de eventos (até 1.000 CNPJs por pedido) do que por um
   `INNOVAMSG63` por empresa.

## Item 2 — o módulo

7. **pgdas "no dia 21":** quando o 21 cai no fim de semana, roda no próximo dia útil (a tarefa não roda sábado e
   domingo; sem isso o mês ficaria sem consulta até o último dia útil).
8. **O "x" na matriz de eventos** é lido como "sem autorização" (a documentação mostra o `x` sem explicar; o exemplo
   da demonstração o traz junto de datas e vazios). Vai pro `faltou` como `sem_autorizacao`, sem pedir as mensagens.
9. **Caixa Postal de CPF fica de fora.** O lote de eventos de PJ é de CNPJ (o de pessoa física é outro serviço, tipo
   3). Se a lista do sistema trouxer CPF, o log diz quantos ficaram de fora.
10. **Só a primeira página da Caixa Postal.** A lista de mensagens vem por páginas; a ponte lê a primeira (as mais
    recentes, `statusLeitura` 0 = todas). Na primeira rodada, as mensagens mais antigas que a primeira página não vão;
    depois, um dia com mais mensagens novas que uma página perderia as de baixo — improvável, mas é o limite.
11. **`das_pago`:** `true` se algum DAS do mês foi pago, `false` se há DAS e nenhum pago, `null` sem DAS no mês.
12. **`pgdas.ano`:** o maior ano-calendário consultado (em janeiro vão os meses dos dois anos).
13. **Faturamento, um mês por rodada e por empresa** (o contrato tem um bloco `faturamento` só): na primeira vez, só o
    mês declarado mais recente — o ano pra trás não é lido um a um; depois, o mês que vier depois do último lido e a
    retificação de um mês já lido (a transmissão mudou), o mais novo primeiro. Declaração com o PDF ilegível não fica
    marcada como lida: a próxima rodada do pgdas tenta de novo.
14. **Sem procuração não se consulta o resto.** Em produção, a procuração `sem` ou `vencida` (ou a consulta dela com
    acesso negado) põe as outras consultas daquela empresa no `faltou` como `sem_autorizacao`, sem chamar — economiza
    chamada. Isso vale só no dia em que a procuração foi consultada (1º dia útil do mês); nos outros dias a consulta
    é feita e o Serpro responde o acesso negado, que vira o mesmo `sem_autorizacao`.
15. **O que conta no teto:** toda resposta HTTP do gateway (também as 4xx e 5xx que são tentadas de novo — na dúvida
    sobre o que o Serpro cobra, contar a mais). O pedido de token não conta (não é consulta). Demonstração e `--falso`
    não contam.
16. **O cabeçalho `X-Request-Tag`** (opcional na biblioteca) não é mandado.
17. **O Serpro fora no meio da rodada:** depois das 4 tentativas, o que faltou vai como `erro` sem chamar mais nada e o
    que foi lido é mandado; a saída é 0 se o envio foi (o código de saída é do envio, como no Domínio), com o erro no log.
18. **Quando o `estado.json` é gravado:** só quando o pacote foi ou ficou em pendentes, e nunca em `--sem-enviar`,
    demonstração ou `--falso`. Pacote em pendentes conta como mandado (as mensagens não voltam); se esse pendente for
    depois recusado pelo sistema (4xx) e apagado, o que estava nele se perde — o mesmo que acontece com o Domínio.
19. **Os pendentes são os mesmos do Domínio** (a fila pede): a rodada do Domínio manda os da Receita e vice-versa —
    o sistema separa pelo `tipo`. A lógica dos pendentes foi copiada de `ponte/rodada.py` pra `ponte/receita/rodada.py`
    porque a fila não deixa mexer no do Domínio; vale juntar as duas numa função do `envio.py` quando puder.
20. **`rodada.ambiente`** vale `producao`, `demonstracao` ou `falso` (o do `--falso`, que só vai pra sistema de mentira).
21. **A tarefa com `ambiente = demonstracao`:** a demonstração só manda pra endereço local, então a tarefa sai com 2
    todo dia até o `ambiente` virar `producao` — o `instalar.ps1 -Receita` avisa. Escolhi não mudar o `ambiente`
    sozinho: ligar é depois da conferência das 5 empresas no e-CAC.
22. **O conferir em produção pede um token de verdade** (a fila pede "ok" ou o erro) e abre uma conexão TLS com o
    gateway (sem pedido nenhum) pra saber se o certificado do Serpro ainda confere.
23. **O caminho do `.pfx` é tratado como segredo** (a fila põe o `certificado` entre os quatro): some do log como `***`.
24. **`ambiente` e `teto_mes` iguais ao exemplo** não são "ainda é o do exemplo" (são valores de verdade) — a única
    exceção nova em `config.py`, só na `[integra]`.
25. **O CNPJ do escritório:** em produção precisa do dígito verificador certo (vale o CNPJ com letras); o do exemplo é
    o `99999999999999` dos cenários do Serpro, com o dígito errado de propósito — serve só na demonstração.
26. **O `--falso`** usa as respostas de `tests/fixtures/receita/`, então só roda da pasta do repositório (a cópia
    instalada não leva os testes).

## Item 3 — o instalador

27. **O `-Hora` vale pras duas tarefas** (com `-Receita`, o padrão é 08:30). O `-Receita` não muda o `ambiente` e não
    instala o `cryptography`/`pypdf` (só avisa se faltarem). O `.pfx` fora de `C:\ponte-dominio` gera um aviso (lá
    dentro, só o usuário, o SISTEMA e os administradores leem).
28. **Não rodei o `instalar.ps1`.** A sintaxe foi conferida pelo analisador do PowerShell, e as funções que leem e
    gravam o `config.ini` foram testadas à parte, extraídas do script (sem registrar tarefa).

# Dúvidas da fila de 24/10/2026 — terminar a ponte da Receita

## Item 1 — o resto do item 4

29. **O `config.ini` é mexido como texto** pelo `py -3 -m ponte chave`: só a linha do `chave_ponte` (e as linhas de
    continuação dela, se o valor estava partido) é trocada; os comentários, a ordem, o BOM e as quebras de linha ficam,
    e o arquivo é reescrito no lugar (as permissões dele, só do usuário, ficam). Sem o campo, ele entra logo depois de
    `[sistema]`; sem a seção, ela é acrescentada no fim. A chave inválida (com acento, em duas linhas) sem `--trocar`
    sai com 2 pedindo o `--trocar`. A impressão digital vai também pro log (não é segredo).
30. **O `--trocar` só troca com "s"** (qualquer outra coisa, ou nada, mantém a chave e sai com 1).
31. **O `instalar.ps1 -Receita` roda o `ponte chave` só com o `chave_ponte` vazio ou ainda o do exemplo**, da pasta
    instalada (`C:\ponte-dominio\app`), e é o próprio comando que mostra a impressão e o recado; com a chave já
    gravada, só diz que ela existe (o `receita conferir` mostra a impressão). Não rodei o instalador (o analisador do
    PowerShell confere a sintaxe).
32. **O 503 da chave não cadastrada não é tentado de novo** (não é o sistema fora: a resposta é a mesma até a impressão
    ser cadastrada): o pacote fica em pendentes e a rodada sai com 1, com a mensagem como veio e o recado. Sem a lista de
    empresas: o 503 sai com 1, como antes; o **401/403 (chave recusada) sai com 2** — a fila de 23/10 dizia "sem a lista,
    sai com 1", mas chave errada é configuração (repetir não adianta). O `receita conferir` mostra a mensagem do 503 e
    do 401 como veio, sem mudar o código de saída dele (como o do Domínio, o ping não conta).
33. **As `recusadas`** vão pro log, até 30 linhas (depois, "e mais N"), com o CNPJ, o campo (sem o `empresas[i].` da
    frente) e o erro da função — o valor nunca (a função não o devolve). O bloco recusado não é reenviado porque o
    estado já o trata como mandado (as mensagens marcadas, a declaração lida, a consulta do dia feita). O log diz também
    o `"gravado": false` (demonstração, `--falso`) e quantas empresas o sistema gravou.
34. **O sistema de mentira dos testes chama o `validarPacote` de verdade no node, um processo por pacote** (~0,1 s
    cada; o teste confere 66 pacotes). A resposta imita a do `servidor.js` (a chave pela impressão, o ping, a lista, o
    422 da rodada, o 200 com as recusadas e o `"gravado": false` fora da produção). As recusadas "de propósito" do
    teste do log entram por fora do validador (a ponte nunca manda bloco fora do contrato).

## Item 2 — o que a revisão de 24/10 achou

35. **2.1 — o bloco não lido sai do pacote em dois lugares:** na rodada (o `faltou` com `a_conferir`, sem o bloco) e no
    `pacote.montar` (o faturamento sem os dois valores e a situação fiscal sem a lista são descartados — a trava, como a
    do resto do contrato). A situação fiscal ilegível conta como consulta feita no calendário (o Serpro respondeu; ler
    de novo no dia seguinte traria o mesmo PDF e custaria 2 chamadas por dia) — o PDF fica guardado pra ajustar a
    leitura. A declaração ilegível continua não marcada como lida (a próxima rodada do PGDAS tenta de novo).
36. **2.2 — o que é "feita":** a consulta que o Serpro respondeu — com dado, com o PDF ilegível, com recusa ou com
    acesso negado — e a que a autorização de hoje já barrou (sem procuração). Não é feita: o teto, o Serpro fora, o
    relatório que não ficou pronto — essas voltam na próxima rodada. Assim o custo é o de antes (uma chamada por dia
    marcado), e a empresa sem procuração não gasta chamada todo dia.
37. **2.2 — a empresa nunca consultada roda logo** (a primeira rodada da instalação e a empresa nova na carteira): o
    literal da fila ("ainda não foi feita desde o dia marcado"). Na instalação, a primeira rodada faz a carga inteira
    — umas 470 chamadas com as 105 empresas de hoje (105 procurações, 74 PGDAS, até 74 declarações, 210 da situação
    fiscal, o lote da Caixa Postal e as mensagens de quem teve novidade), dentro do teto de 1.500. Esperar o primeiro
    dia marcado deixaria a empresa nova até um mês sem consulta.
38. **2.2 — as marcas do mês passado valem até a deste mês:** a situação fiscal (o dia 5 passado), o PGDAS (a consulta e
    o último dia útil do mês passado) e a autorização (o primeiro dia útil do mês passado, só antes do deste). O PC
    desligado do dia marcado até o fim do mês consulta no começo do mês seguinte — e de novo no dia marcado desse mês.
39. **2.2 — a procuração com acesso negado (403)** passou a ficar no estado como `sem`, com a data: não é perguntada de
    novo todo dia útil (antes, sem registro nenhum, ela contava como "nunca consultada" e voltava todo dia) e entra na
    segunda-feira, como a sem procuração.
40. **2.2 — a autorização que volta ativa no meio do mês** não refaz na mesma semana o PGDAS e a situação fiscal que
    a procuração tinha barrado (contam como feitos até o próximo dia marcado) — como era antes. Se quiserem, dá pra
    apagar a marca deles quando a autorização passa de `sem` a `ativa`.
41. **2.3 — a PWD curta do banco do Domínio também deixa de ser procurada no meio do texto.** Ela continua escondida
    onde aparece hoje: dentro da conexão inteira (longa) e no `PWD=...` de uma mensagem de erro (o padrão do log). Se um
    erro do driver repetisse a senha solta, sem o `PWD=`, ela apareceria — o que a fila aceita ("o mais curto nunca é
    escrito").
42. **O id da mensagem ia cortado em 40 caracteres** no pacote (a função aceita 80, e o estado guardava 80): passou a 80.
43. **O LEIA-ME** trazia o calendário de antes do item 4 ("dia 21", a autorização sem a segunda-feira, a Caixa Postal sem
    os limites): atualizado junto com a chave, o endereço e as respostas da função.

## Item 3 — a revisão adversarial do ramo

44. **A revisão** (4 lentes — segredos, o contrato com a função, o calendário e o estado, robustez — e cada achado
    verificado por quem tentou refutá-lo, reproduzindo com os servidores de mentira) trouxe 18 achados: **6 confirmados,
    todos corrigidos** no commit `ac422f1`, com teste que falha no código de antes:
    - a declaração que não veio (Serpro fora, teto) ou que ficou de fora num `--so pgdas` nunca mais era lida (o
      faturamento só rodava no dia do PGDAS e o mês mais novo passava na frente);
    - a consulta de dezembro recuperada no começo de fevereiro pedia só o ano novo (dezembro sumia);
    - o "mês sem declaração" dava sim em todo começo de fevereiro e no feriado entre o prazo e a consulta (o Tiradentes,
      quando o prazo de março cai na terça) — um PGDAS a mais pra todas as empresas do Simples;
    - o CNPJ com letras perdia as letras na volta do lote de eventos (a Caixa Postal dele nunca era lida, calada);
    - a mensagem que chega no mesmo dia depois da leitura não era lida nos dias seguintes (o evento é só o dia);
    - o certificado do Serpro que não confere virava "Serpro fora": a rodada saía com 0 todo dia, mandando um pacote só
      de erro — agora para com 2 e o recado de trocar o `ac-serpro-2025.pem`.
45. **O faturamento passou a ser conferido em toda rodada** (sem custo quando não há o que ler): o mês a ler sai do
    estado (todos os meses declarados já vistos), um por rodada, **o mais antigo depois do último lido primeiro** — muda
    o "o mais novo primeiro" do item 13: com mais de um mês pendente (a empresa que transmite vários de uma vez), eles
    entram um por dia útil, sem pular nenhum. A retificação vem depois dos meses novos. A declaração que o Serpro
    respondeu sem a receita (o PDF ilegível, a recusa, o acesso negado) fica no estado como "tentada" e só volta no dia
    do PGDAS (pedir todo dia custaria uma chamada por dia com a mesma resposta); na primeira vez de uma empresa, se a do
    mês mais recente foi tentada, a ponte espera o dia do PGDAS em vez de ler a do mês de antes no lugar.
46. **A Caixa Postal lê de novo, uma vez, no dia seguinte à leitura** quando o dia do evento continua o mesmo — no
    máximo uma chamada a mais por empresa por dia de novidade. A empresa pedida no lote que não volta na resposta do
    Serpro vai pro `faltou` como `erro` (o aviso no log lista até 10).
47. **Refutados, só anotados** (não mexi):
    - num dia sem nada novo nas empresas todas, o `nada a mandar` sai antes dos pendentes: o pendente espera a próxima
      rodada com dado (atraso, não perda — com 105 empresas, quase todo dia tem algo);
    - o `--falso` monta o Basic com a consumer key e a secret do `config.ini` pro Serpro de mentira local (`127.0.0.1`):
      não sai do PC, salvo um proxy configurado no Windows;
    - cabeçalho de seção com comentário no fim da linha (`[sistema] ; …`) não é reconhecido pelo `chave.py` (nem pelo
      `Ler-Ini` do `instalar.ps1`): ele acrescenta outra `[sistema]` e o `config.ini` deixa de abrir — só acontece com
      comentário escrito à mão ali (o exemplo põe comentário em linha própria);
    - a impressão digital é o SHA-256 simples (sem sal) — uma chave fraca digitada à mão poderia ser adivinhada por ela;
      a gerada pelo `chave.py` tem 256 bits, e o contrato pede o SHA-256 simples;
    - o pacote recusado (422) não grava o estado e as consultas do dia se refazem — a função não recusa nada que a
      ponte monte (os 66 pacotes do teste passam no `validarPacote` de verdade).
