# Fila do Claude Code de 29/09 — dúvidas, achados e escolhas

> Ver `docs/FILA-CODE-2026-09-29.md`. Nada daqui impediu o trabalho. Em cada caso ficou a opção mais próxima
> do que já existia no repositório; a decisão final é do arquiteto.

## Achado que vale pros 4 itens

- **Os testes do harness quebram no console padrão do Windows.** `python tests/harness/rotinas-setor.py` morre com
  `UnicodeEncodeError: 'charmap' codec can't encode character '✓'` antes da primeira checagem — o console do
  Windows abre em cp1252 e o ✓/✗ não passa. Não é erro do teste: o mesmo arquivo passa inteiro com
  `PYTHONIOENCODING=utf-8`. Fica assim:
  - o teste novo (`tests/harness/relatorios-sugestoes.py`) abre com `sys.stdout.reconfigure(encoding='utf-8')`,
    então roda em qualquer console;
  - os três antigos (`lote-setores.py`, `obrigacoes-responsavel.py`, `rotinas-setor.py`) continuam como estão —
    mexer neles não era do item 1. **Sugestão:** a mesma linha em cada um, ou deixar o `tests/rodar-tudo.py`
    (item 3) forçar UTF-8 nos testes que ele chama.

## Item 1 — Relatórios e Sugestões num módulo só

- **O que virou configuração.** Relatórios: `setor`, `nomeSetor`, `hub`, `rotuloVazio` (e `tituloImpressao`, que por
  padrão é o `nomeSetor` — hoje nenhum setor precisa dele). Sugestões: `setor`, `nomeSetor`, `hub`.
- **`rotuloVazio` é só o nome solto do setor** ('comercial', 'contábil', 'DP', 'financeiro', 'fiscal', 'IRPF',
  'societário'), porque as duas frases da lista vazia têm moldura fixa: "Nada registrado ainda **no** X" e
  "Conforme as tarefas **do** X forem concluídas". Assim cada texto continua letra por letra como estava.
- **Dados inventados novos no mock** (`tests/harness/supabase.mock.js`): a tabela `sugestoes` não existia — entraram
  4 sugestões de contábil/DP/fiscal (uma delas concluída, pra fotografar a seção recolhida). Também entrou
  `competencia` em duas tarefas que já existiam ('Enviar guias do mês' e 'Fechamento contábil'), senão o filtro de
  competência das telas de Relatórios nasceria vazio e ninguém veria se ele funciona.
- **As fotos "antes" foram tiradas com o mock já mudado** (páginas ainda as antigas), pra comparação pixel a pixel
  medir só a troca das telas pelo módulo, e não os dados de teste.
- **Sugestões de melhoria só existe em 3 setores** (contábil, DP, fiscal). Não criei as telas que faltam nem mexi nos
  hubs: não era do item. Com o módulo pronto, cada uma é uma página fina de 30 linhas.

## Verificação de 30/09 (Claude Code) — achado fora da fila
- **`assets/js/rt-analise.js` calcula "hoje" em UTC** (`new Date().toISOString().slice(0, 10)`, linha ~123). Em Brasília (UTC−3),
  depois das 21h o "hoje" já é o dia seguinte. Em 30/09/2026 — último dia da opção IBS/CBS — quem gerar a análise técnica da
  Reforma depois das 21h recebe "a janela de setembro/2026 já fechou", com o prazo ainda aberto. É por isso que
  `tests/rt-analise.test.mjs` falha em 2 checagens hoje à noite (também no `main`, fora desta branch): o teste não passa
  `hojeISO` e depende do relógio. Correção sugerida: data local (`toLocaleDateString('sv-SE')` ou montar `AAAA-MM-DD` com
  `getFullYear/getMonth/getDate`) e, no teste, passar `hojeISO` fixo. O mesmo padrão `toISOString().slice(0, 10)` aparece em ~40
  lugares do repositório — vale uma revisão à parte de onde ele é usado como "hoje".

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
