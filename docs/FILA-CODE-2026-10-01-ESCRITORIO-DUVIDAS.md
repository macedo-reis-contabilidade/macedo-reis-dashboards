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

- **Nada a migrar, confirmado pelo lado do código.** As três telas antigas gravavam direto em `tarefas_recorrentes`
  (sem `modelo_id`), enquanto o módulo trabalha com `rotinas_modelo` + `tarefas_recorrentes`. Se um dia aparecer um
  registro antigo nesses três setores, ele vai cair na lista como rotina **avulsa** ("criada pela Nova tarefa"), com a
  opção *transformar em rotina* — ou seja, o módulo já sabe lidar, não some nada. A fila diz que hoje não há nenhum.
- **`comercial-sugestoes.html` e `societario-sugestoes.html` não existem**, então os hubs do Comercial e do Societário
  não têm o card de Sugestões de melhoria (o Fiscal tem). É o assunto da fila "de casa" do mesmo dia — não mexi.
