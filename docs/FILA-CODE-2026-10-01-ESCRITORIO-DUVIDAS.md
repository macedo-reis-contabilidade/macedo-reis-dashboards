# Fila do escritório de 01/10 — dúvidas, achados e escolhas

> Ver `docs/FILA-CODE-2026-10-01-ESCRITORIO.md`. Nada daqui impediu o trabalho. Em cada caso ficou **a opção que
> muda menos**, como a fila mandou; a decisão final é do arquiteto.

## Escolhas que a fila não fixava

- **Onde entrou o card.** Nos três hubs, logo **depois do card "Tarefas"** — é a posição que ele tem no
  `contabil.html`, que a fila deu como modelo. No Fiscal isso o deixa antes do Fator R; no Comercial, antes de
  Relatórios; no Societário, antes de Alvarás.
- **A sub-barra de abas do Societário sumiu.** A tela antiga `societario-regras.html` era a única das três com uma
  `.fa-subnav` própria (abas Tarefas / Tarefas recorrentes / Relatórios / Alvarás) e com o CSS dela no próprio arquivo.
  O módulo único não tem essa barra — o DP, o Contábil e o Financeiro também não têm. Manter as abas exigiria mexer no
  `assets/js/rotinas-setor.js` (ele monta o conteúdo com `innerHTML` na raiz, o que apagaria qualquer coisa posta
  antes), e a fila proíbe tocar no módulo. Ficou sem a barra, igual às outras cinco telas. A navegação não se perdeu: o
  caminho no topo leva ao hub, e o hub tem o card de cada módulo.
- **O verde do ícone ficou repetido em dois hubs.** A fila mandou copiar a regra de cor do `contabil.html`
  (`rgba(63,176,122,.16); color:#3FB07A`). No Fiscal esse verde já é o do card **Obrigações**, no Societário é o do
  card **Alvarás**, e no Comercial o card **Transição de clientes** usa um verde vizinho (`#7FBF8E`) — nos três hubs
  ficam dois ícones esverdeados (os desenhos são diferentes, e o texto do card do Fiscal explica a diferença).
  Mantive como a fila mandou, que é o que muda menos; trocar a cor é uma linha, se o arquiteto preferir.
- **O `<title>` mudou de formato.** Era `Fiscal — Tarefas recorrentes — Macedo & Reis`; passou a
  `Tarefas recorrentes · Fiscal — Macedo & Reis`, que é o padrão das páginas finas (`dp-regras.html`,
  `contabil-regras.html`) e o que a fila pediu.

## Achados anotados no caminho (fora do que o item pede)

> Levantados por uma revisão adversarial da própria branch (5 revisores por dimensão + verificadores que tentaram
> derrubar cada achado): 24 achados brutos, 8 confirmados. Os que sobraram estão aqui. **Nenhum deles foi corrigido
> nesta branch**, exceto o do `.gitignore` — ver a última seção.

### 1. Fiscal: a Análise fiscal ainda cria regra bimestral e trimestral, que a tela nova não sabe guardar

**É a única consequência real da troca, e é só no Fiscal.** `fiscal-analise.html` (linha 431) oferece cinco
periodicidades — `['mensal','bimestral','trimestral','semestral','anual']` — e grava direto em `tarefas_recorrentes`
com `setor:'fiscal'` e `origem:'analise'` (linhas 478–485). A tela antiga `fiscal-regras.html` aceitava as cinco no
próprio modal (linha 75 da versão em `main`). **O módulo único só conhece três**: `mensal`, `semestral` e `anual`
(`assets/js/rotinas-setor.js` linha 114).

O que acontece hoje, na prática:
- uma regra trimestral vinda da Análise **aparece** na lista, com o aviso
  `trimestral (fora do padrão — edite pra mensal, semestral ou anual)` (linha 184 do módulo) — ou seja, nada some;
- mas quem seguir esse recado e abrir a edição vê a janela já abrir com **Mensal** selecionado, sem avisar que mudou
  (linha 295: `['mensal','semestral','anual'].includes(...) ? ... : 'mensal'`); salvando, a periodicidade original
  se perde em silêncio.

Não corrigi porque **as duas saídas estão fora do item**: mexer no módulo (a fila proíbe) ou mexer na
`fiscal-analise.html` (não é do item). Caminhos pro arquiteto decidir, do que muda menos pro que muda mais:
(a) tirar bimestral/trimestral da Análise fiscal, que é quem está fora do padrão da casa;
(b) o módulo manter a periodicidade de fora do padrão quando ela já existe, em vez de cair pra Mensal;
(c) o módulo passar a aceitar as cinco.

### 2. Fiscal: regra vinda da Análise aparece como "criada pela Nova tarefa"

Mesma raiz. O módulo chama de **avulsa** toda `tarefas_recorrentes` sem `modelo_id` e escreve fixo
`· criada pela Nova tarefa` (linha 175), sem olhar o campo `origem`. A tela antiga do Fiscal marcava essas com o selo
**`da análise`** (linha 167 da versão em `main`). Então, no Fiscal, o rótulo agora mente: a equipe aprova uma análise,
vai conferir em Tarefas recorrentes e lê que a regra foi criada pela Nova tarefa. Risco: alguém achar que é duplicidade
e excluir uma regra legítima. A correção é no módulo (ler `origem`), que a fila congelou.

> Isto corrige o que esta mesma página dizia antes: não é verdade que "o módulo já sabe lidar, não some nada". Ele
> lida, mas perde o rastro de origem e pode trocar a periodicidade na primeira edição.

### 3. Dois cards de hub ficam para sempre com a bolinha cinza de "carregando"

Anterior à branch, mas está nas linhas que este item editou. `comercial.html` tem um card com
`data-mod="comercial-transicao.html"` e `fiscal.html` um com `data-mod="fiscal-regularizacao.html"`, e nenhuma dessas
duas páginas aparece em chamada de `setBadge` — nem nas listas do `setBadge(h, '—')` que este item mexeu. Resultado: o
rodapé desses dois cards fica no `·` cinza da classe `st-load` enquanto os vizinhos já mostram o número, parecendo que
travou. Dá pra ver em `.harness/fotos/tres-setores-hub-fiscal-escuro.png`, no card Regularizações. A correção é
acrescentar as duas páginas às listas — duas palavras —, mas é mexer no que o item não pede.

### 4. `comercial-sugestoes.html` e `societario-sugestoes.html` não existem

Por isso os hubs do Comercial e do Societário não têm o card de Sugestões de melhoria (o Fiscal tem). É o assunto da
fila "de casa" do mesmo dia — não mexi.

## A única coisa fora do item que eu corrigi, e por quê

**`pente-fino-insumo.csv` (raiz) tem nome, CNPJ e CPF de 107 clientes reais, e nada o impedia de ser commitado.**
O arquivo é a **entrada** do `scripts/pente-fino` (o caminho está fixo em `pente-fino.py`, linha 26, então ele sempre
reaparece na raiz). Todas as **saídas** dos dois scripts já estão protegidas — `scripts/pente-fino/.gitignore` e
`scripts/garimpo-alvaras/.gitignore` listam uma a uma, com o comentário "dados de clientes, NUNCA commitar". Só a
entrada tinha ficado de fora, e o `.gitignore` da raiz só tinha `.harness/`.

Nada vazou: o arquivo nunca foi commitado e não está em nenhum histórico. Mas bastava um `git add -A` numa sessão
futura pra publicar CPF e CNPJ de clientes num repositório **público**, de onde não sai mais. Acrescentei **uma linha**
ao `.gitignore` da raiz, no mesmo padrão e com o mesmo comentário dos outros dois. É regra 9 do `CLAUDE.md` e lei
permanente da casa; achei que valia mais do que a regra de "mexa só no que o item pede". **Se o arquiteto discordar,
é só apagar a linha.**
