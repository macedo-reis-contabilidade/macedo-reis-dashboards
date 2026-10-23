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
