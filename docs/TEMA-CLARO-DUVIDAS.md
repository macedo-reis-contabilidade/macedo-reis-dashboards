# Tema claro — dúvidas e pendências

> Anotadas durante a conversão (ver `docs/TEMA-CLARO-CODE.md`, seção 6). Nada daqui parou o trabalho:
> em cada caso ficou a opção que não quebra nenhum dos dois temas, e a decisão fica pro arquiteto.

## Tokens que faltam (afetam mais de uma tela)
- **Ciano de destaque `#52B4C6`**: não existe token dessa família, então a cor ficou fixa. No claro dá só 2,1–2,4:1, legível mas fraco.
  - `comercial-precificacao.html`: títulos "Cálculo ao vivo" e "Obrigações do regime", totais em R$, `.pr-bloco h2`, `.par-grupo h3`, `.mei-preco`, chip MEI na tabela de propostas e h3 do modal de obrigações.
  - `clientes/editar.html`: h3 "Kit de boas-vindas" e cabeçalho do comparativo "Documento anexado / Receita Federal × cadastro".
  - A `agenda.html`, que já foi convertida, também mantém esse ciano.
  - Sugestão: um token de acento, por exemplo `--accent`, com `#52B4C6` no escuro e um ciano escuro (~`#1C7A8A`) no claro. As tintas `rgba(82,180,198,.15/.22/.35)` podem continuar.
- **Laranja `#E8A15C` / `#E0A06C`**: não existe token laranja.
  - Onde é texto de alerta, virou `--warn` (âmbar), e no escuro fica um pouco mais amarelado. Casos: `fiscal-reforma.html` (KPI "1 dia", chip "Simular", prazo da opção na ficha) e `fiscal-analise.html` ("Risco:").
  - Onde é só faixa decorativa, ficou fixo: `comercial-reunioes.html`, `.pauta-item.impresc` (border-left de 3px).
  - Se quiserem o laranja exato, falta um token (ex.: `--warn-2`).
- **Alerta com pouco contraste no claro**: o `--warn` claro (`#A56E12`) dá 3,7:1 no KPI "1 dia" de `fiscal-reforma.html`. Passa como texto grande em negrito, mas não há um token de alerta mais escuro.

## Por tela
### fiscal-reforma.html
- L28 `.rg-status` (select): ficou `--surface`, que é o mais próximo de `#141A22` no escuro. A regra de campo pede `--surface-2`. Confirmar.
- L70 `.rt-grid input/select` e L94 `.rg-obs`: fundo `--fill-1` e borda `--fill-3`, como o tokenize pôs, o que mantém o escuro idêntico. Pela regra seriam `--surface-2` / `--line-strong`, que mudariam o escuro.
- L105 `.dom-chip.warn { border-color }`: a chip não tem `border-style`, então essa borda nunca aparece. É regra morta no original. Troquei por `--warn`, sem efeito visual.

### comercial-precificacao.html
- L1582 `#tpConfirmar`: texto `#0B1017` sobre o botão `--ok` sólido (7:1 no escuro, 4,6:1 no claro). Não existe token de "texto sobre cor sólida". Se o padrão da casa for texto branco sobre botão sólido, precisa de decisão.

### comercial-reunioes.html
- O CLAUDE.md diz que o módulo Reuniões está aprovado e congelado. Converti porque a tela está na tabela da seção 7. Só mudou valor de cor; a lógica ficou intacta. Confirmar que isso conta como pedido explícito.

### fiscal-analise.html
- L750 `.fa-sev-alta .fa-alerta-sev` e L761 `.fa-prio-media` (`#F0E4BC`): viraram `--warn`, porque o rótulo carrega severidade, igual aos chips `.fa-c-media`. A alternativa `--text` mudaria menos o escuro.
- L741 `.fa-risco` (`#E0A06C`): virou `--warn`. O PDF desta mesma tela mostra o risco em vermelho (`#b3261e`). Se "Risco:" deve ser vermelho, o token certo é `--err`.

## Ferramentas e coisas fora desta tarefa
- `python tests/harness/conferir.py clientes/editar.html` fotografa a **listagem**. Sem `?id=`, o editor redireciona pra `clientes/index.html` (L1118), e no Windows o `?` não pode ir no nome do arquivo da foto. O editor foi conferido com `?id=c1`.
- O `conferir.py` só pula os tours `agenda_v1`, `reforma_v1` e `clientes_v1`. `comercial-precificacao` (`precificacao_v2`), `fiscal-obrigacoes` (`obrigacoes_v1`) e `comercial-carteira` (`carteira_v2`, `carteira_analise_v1`) saem na foto com o tour por cima.
- Botão "?" do tour (`a.mrt-help`, de `assets/js/tour.js`): rosa com ~2,4:1 no claro. Vem do `tour.js`, que fica fora desta tarefa.

---
## Decisões do arquiteto — 29/09/2026 (lote 1 revisado e publicado)
- **Ciano `#52B4C6`** → novo token **`--accent`** (escuro `#52B4C6`, claro `#1C7A8A`). Já trocado nas telas do lote 1 e na Agenda; o `tokenize.py` passa a converter sozinho. Tintas `rgba(82,180,198,…)` ficam.
- **`--warn` no claro** escurecido para `#8A5A0A` (~5:1) — resolve o "1 dia" e todo texto de alerta.
- **Laranja `#E8A15C`/`#E0A06C`**: onde virou `--warn`, aceito; faixa decorativa fica fixa. Sem token novo.
- **`.rg-status`, `.rt-grid input/select`, `.rg-obs`**: ficam como estão (escuro idêntico vale mais que a regra).
- **`#tpConfirmar`** (texto escuro sobre verde sólido): fica.
- **Reuniões**: converter cor está liberado; o "congelado" vale para lógica e layout.
- **`.fa-risco`**: fica `--warn` (a tela era laranja; o PDF é outro contexto).
- **Botão "?" do tour** corrigido no `tour.js` pelo arquiteto.
- **Harness**: `conferir.py` agora desliga todos os tours e aceita `"tela.html?id=..."` (nome da foto sem `?`).
