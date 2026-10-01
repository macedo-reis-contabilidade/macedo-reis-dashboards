# Fila do Claude Code de 29/09 — dúvidas, achados e escolhas

> Ver `docs/FILA-CODE-2026-09-29.md`. Nada daqui impediu o trabalho. Em cada caso ficou a opção mais próxima
> do que já existia no repositório; a decisão final é do arquiteto.
> Cada item foi feito na sua branch, então este arquivo nasce em cada uma com a seção do seu item.

## Item 2 — Janelas por cima da barra do topo + Esc fecha

### A camada
- **Deu certo o caminho preferido**: tirar o `main` da regra `main, .app-shell, .login-shell { position: relative; z-index: 1; }`
  do `style.css`. Prova: 21 telas fotografadas nos dois temas antes e depois — **0 pixels diferentes nas 42**.
  Nenhum `position:absolute` do sistema dependia do `main` como referência (todos têm um pai posicionado mais
  perto: `.dashboard-card`, `.tl-item`, `.sw`, `.pr-moeda`…), e nenhum `<main>` do sistema está fora do `.app-shell`,
  que continua com o `z-index: 1` e segura tudo acima do fundo do `body`.
- **A janela das tarefas recorrentes (`#rvOv`) já ficava por cima** — o `rotinas-setor.js` a pendura no `body`,
  fora do `main`. Quem estava por baixo eram as janelas montadas dentro do `main`, as do
  `assets/js/tarefas-engine.js` à frente (detalhe, lote, adiar, nova tarefa).

### Os formatos de janela que existem, e o que ficou coberto
O `janelas.js` não vai por lista de nomes: ele acha, na hora do Esc, a camada `position:fixed` **visível que cobre
a tela** e está mais por cima, e clica no fechar dela mesma. Então formato novo entra sozinho — só precisa ter um
× ou um "Cancelar"/"Fechar" dentro.

| Formato | Onde | Situação |
|---|---|---|
| `.fa-modal-overlay` + `is-open` | `tarefas-engine.js` e 18 telas | **testado** (lote e detalhe, em `fiscal-tarefas.html`) |
| `#ntOverlay` + `is-open` | Nova tarefa (`nova-tarefa.js`) | **testado** (pela Agenda) |
| `#rvOv` + `on` | Tarefas recorrentes (`rotinas-setor.js`) | **testado** (`dp-regras.html`) |
| `.imp-overlay` + `is-open` | `clientes/index.html` (importar, Drive, Receita) | **testado** |
| `.ov` + `open` | `financeiro-boletos.html`, `irpf-declaracoes.html`, `comercial-transicao.html` | **testado** (boletos) |
| `.vo-overlay` | `clientes/editar.html`, `clientes/novo.html` | coberto pela regra (tem "Fechar") |
| `.rg-ov` | `fiscal-reforma.html`, `fiscal-regularizacao.html` | coberto pela regra (tem "Fechar") |
| `style="display:none;position:fixed;inset:0"` solto | `agenda.html` (`#loOverlay`, `#raOverlay`), `clientes/editar.html` (`#ovKit`), `comercial-precificacao.html` (`#modalObrig`, `#ovObsInterna`, `#ovTransProp`), `comercial-reunioes.html` (`#ovDiscussao`) | coberto pela regra (× ou "Cancelar"/"Fechar") |
| `.mrt-block` (fundo do tour) | `assets/js/tour.js` | **de fora de propósito**: não tem fechar dentro, então o Esc não mexe. O tour já tem o Esc dele. |

- **Um detalhe de rótulo:** o `#modalObrig` da Precificação fecha por um botão escrito "✕ Fechar". Por isso o
  `janelas.js` normaliza o rótulo (tira o ×/✕) antes de comparar com "fechar"/"cancelar".
- **Janela sem fechar próprio não é tocada.** É de propósito: o Esc clica no botão da tela pra que cada uma faça
  a limpeza dela (esvaziar caixa, soltar o que estava em edição). Esconder na marra deixaria sujeira.
- **Sem janela aberta o Esc não faz nada** — testado. As edições em linha que já usavam Esc continuam iguais
  (o `obrigacoes-responsavel.py` passa inteiro com o `janelas.js` carregado na tela).

### Achado no caminho (fora do que o item pede, mas atrapalhava a prova)
- **O servidor do harness atendia uma requisição por vez** (`socketserver.TCPServer` no `conferir.py`). Quando a tela
  pede vários módulos de uma vez, um deles voltava com `ERR_CONNECTION_REFUSED` e a tela ficava pela metade —
  **sem nenhum erro de JavaScript**, então as fotos saíam vazias e a comparação "antes × depois" passava do mesmo
  jeito. Aconteceu de verdade aqui, com o `assets/js/nova-tarefa.js` em `fiscal-tarefas.html`. Virou
  `ThreadingTCPServer`. Vale pra todos os testes do harness, e é o tipo de coisa que faz um teste mentir.
- **Os testes do harness quebram no console padrão do Windows** (`UnicodeEncodeError` no ✓, cp1252). Os dois testes
  novos desta fila abrem com `sys.stdout.reconfigure(encoding='utf-8')`; os três antigos continuam como estão.
  O `tests/rodar-tudo.py` (item 3) resolve isso pra todos.

## Verificação de 30/09 (Claude Code) — item 2
- **O que ainda passa por cima da barra do topo, e é de propósito ou inofensivo.** Sem o `z-index` no `main`, tudo que está
  dentro dele com `z-index` ≥ 10 passa a competir com a `.topbar` (sticky, `z-index:10`). Levantamento completo:
  - janelas de tela cheia (`position:fixed; inset:0`) — o objetivo do item;
  - `.rt-massa` da Reforma (barra flutuante no rodapé, `z-index:70`) e o aviso do Drive na Carteira (canto inferior) — longe do topo;
  - `.xm-res` em `fiscal-xml.html` (lista de sugestões, `position:absolute; z-index:20`): **se a página estiver rolada com a lista
    aberta, ela passa por cima da barra do topo** (antes ficava por baixo). Efeito pequeno; se incomodar, `z-index` abaixo de 10 nela;
  - `.fr-tour-hi` (tour próprio do Fator R): o escurecimento do tour agora cobre também a barra do topo — coerente com o tour global.
  Nenhum `z-index` negativo no repositório, então nada some atrás do fundo.
- **Fotos rolada:** a prova do item foi feita também com a página rolada 600px (onde o conteúdo passa sob a barra), nas 66 telas:
  0 pixels.
