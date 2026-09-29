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

## Lote 2 (#6–#11) — dúvidas novas, 28/09/2026
### Global (`style.css`, fora desta tarefa)
- **`.btn-primary` no claro**: o texto herda o `--text` escuro (`#1B2430`) sobre o `--brand-primary` claro (`#4A739A`), uns 3:1. Afeta todas as telas.
  Exemplos: "+ Novo caso", "Gerar documento", "Gerar relatório para o cliente", "Salvar proposta", "+ Adicionar à carteira".
  Sugestão: `.btn-primary` com texto `#fff` nos dois temas.
- **`--ok` no claro** (`#1E8E5A`): dá 3,2–3,8:1 em números verdes.
  - `dp-custo` (multiplicador e "Líquido a receber");
  - `relatorios-vivos` (valores positivos);
  - `comercial-carteira` (aba Análise).
  Passa como texto grande em negrito, mas a célula de 15px fica abaixo de 4,5:1. Sugestão: escurecer o `--ok` do claro, como foi feito com o `--warn`.

### Tokens que faltam
- **Estado "selecionado"**: em `comercial-carteira`, `.seg button.is-on` usa a tinta `rgba(197,216,232,.18)`, que quase some no claro. O botão ativo (Carteira/Análise) só se distingue pela cor do texto. O `.seg` da `comercial-precificacao` (tinta ciano) tem o mesmo efeito.
- **Rosa `#F472B6`**: em `relatorios-vivos`, `.fim-tag.pl29` (contrato que termina em 2029 ou depois) dá ~2,5:1 no claro. A cor ficou fixa porque não há token rosa. As faixas e tintas rosa translúcidas funcionam nos dois temas.
- **Terracota `#D0715A`**: em `comercial-carteira`, o texto do filtro "só inadimplentes" virou `--err`. A tinta e a faixa de 3px da linha inadimplente (template JS, L316) ficaram fixas, então no claro o rótulo e a faixa ficam em tons um pouco diferentes. Para uniformizar, dá pra trocar a faixa por `var(--err)`, o que muda levemente o escuro.

### Por tela
- **comercial-carteira** L459 `toastDrive` (`el.style.cssText`): `#111A26` virou `--surface` (igual ao `.fa-modal`) e a borda `.16` virou `--fill-3`. `--pop` e `--line-strong` seriam as alternativas.
- **comercial-carteira** `#8FC0F0` (chip "em transição" e botão "Criar pré-cadastro", que só aparecem com dados) virou `--brand-light`. No escuro muda de `(143,192,240)` pra `(138,174,200)`.
- **relatorios-vivos** `.fim-tag.pl26` `#4ADE80` virou `--ok`, e `.fim-tag.pl28` `#FACC15` virou `--warn`. São cores de categoria (ano de término), mas a legenda dá leitura de estado ("verde", "âmbar"), e sem a troca o texto fica ~1,5:1 no claro. Se preferirem tratar como série de gráfico, basta voltar os dois valores.
- **relatorios-vivos** `#E08FA8`, que nesta página é a cor de negativo/erro, virou `--err` (no escuro fica mais vermelho). Em outras telas a mesma cor é o setor IRPF.
- **relatorios-vivos** L16 `.saude-erro .saude-dot`: o ponto virou `--err`, mas o brilho continua `rgba(224,143,168,.6)` (rosa), uma tinta translúcida permitida. Os irmãos `.saude-ok`/`.saude-alerta` já tinham a mesma diferença desde o tokenize.

## Lote 3 (#12–#17) — dúvidas novas, 28/09/2026
- **contabil-dre** L12/L33/L36/L40: a borda dos campos (`.dre-sel`, `.dre-txt`, `.dre-in`, `.dre-obs`, `.dre-nome:hover`) era `#2A313C` e virou `var(--border)`.
  - É o primeiro uso de `--border` numa tela; o briefing chama esse token de legado.
  - No escuro é `#2A323D`, idêntico ao original, e é o mesmo token do `.input`/`.select` global do `style.css`. No claro vira `#D5DBE5`, bem visível.
  - `--line-strong` ou `--fill-3` mudariam o escuro. Confirmar se vale.
- **contabil-dre** L44 `.dre-add` ("+ adicionar linha"): `#6E8FB0` virou `--brand-primary` (escuro `(110,143,176)` → `(91,130,166)`). Fixo, ficaria ~3,4:1 no claro.
- **financeiro-boletos** L63 e **irpf-declaracoes**, spinner `.spin`: o `#fff` do arco virou `--text`, e o anel `rgba(255,255,255,.3)` virou `--line-strong`.
  - O spinner também aparece no `#msg`, sobre o fundo da página, e branco fixo sumiria ali no claro.
  - No escuro muda pouco (`#fff` → `#E8ECF2`, `.30` → `.22`). Se o escuro 100% idêntico valer mais, é só voltar as duas cores.
- **irpf-declaracoes** e **financeiro-boletos** (mesmo template `table.bo`): o hover de linha `rgba(255,255,255,.02)` virou `--fill-1`, e não o `--fill-2` da decisão de hover, que triplicaria o hover no escuro. Confirmar se a regra valia só pra hovers originais de .04–.06.
- **financeiro-faturaveis**, **financeiro-boletos** e **irpf-declaracoes**: o cabeçalho fixo `th { position:sticky; background:#11171f }` virou `var(--surface)` nas três, do mesmo jeito.

## Lote 4 (#18–#24) — dúvidas novas, 28/09/2026
### Global
- **`--text-dim` no claro** (`#8A94A6`): dá 2,4–2,9:1 em texto pequeno e até em botão de ação.
  - É o token de valor escuro mais próximo de `#6B7385`/`#6E7787`, por isso o escuro não muda.
  - Casos: `comercial-transicao` ("dia X de 90", "N de M tarefas") e `fiscal-sugestoes`/`dp-sugestoes` (botão "Excluir" `.sg-del` e data `.sg-done-meta`; o mesmo CSS vale pra `contabil-sugestoes`).
  - Sugestão: um `--text-dim` claro um pouco mais escuro no `style.css`, ou `--text-muted` nesses pontos (o que clareia o escuro).

### fator-r.html
- **Rosa `#F472B6`**: em L29 `.fr-longe` (degrau "Anexo V") e nos cards "No Anexo V"/"Viram de anexo", ficou fixo porque falta token rosa (mesma pendência do `.fim-tag.pl29` de `relatorios-vivos`). No claro dá ~2,6:1. A alternativa é `--err`, que deixaria o escuro vermelho.
- L60 `.fr-erro` (rosa, só em mensagens de erro): virou `--err`, porque a tela já usa vermelho em erros equivalentes.
- L27 `.fr-fio` (`#FACC15`) e L28 `.fr-perto` (`#FB923C`) viraram os dois `--warn`. Agora os degraus vizinhos "III no fio" e "V — quase III" só se distinguem pela tinta de fundo e pelo rótulo. Um token laranja (`--warn-2`) manteria o degrau.
- L56 `.fr-conflito`: o contorno `rgba(250,204,21,.55)` (tinta de estado, ficou) quase some no claro (~1,3:1). A divergência continua sinalizada pelo texto em `--warn` logo abaixo.
- L23 `.fr-tour-hi` (tour próprio da ficha): o escurecimento `rgba(0,0,0,.55)` ficou fixo. O tour global usa `var(--overlay)`. Padronizar mudaria o escuro.
- L24 `.fr-tour-balao`: `#16202b` virou `--surface`, igual ao balão do `tour.js`.

### comercial-transicao.html
- L59, fundo dos campos: `rgba(255,255,255,.05)` virou `--fill-2`. O `--surface-2` deu diferença no escuro (19 campos).
- `#C6A75A` ("aguardando terceiro") virou `--warn`, e `#D08770` ("atrasada", botão Excluir, mensagem de erro) virou `--err`. O gradiente `#3A5878` das barras virou `--brand-dark`, que tem o mesmo valor no escuro.

## Lote 5 (#25–#32) — dúvidas novas, 29/09/2026
- **proposta.html (#30) — não se aplica.** É o questionário público do cliente, sem login.
  - Não carrega `style.css` nem `theme.js`, então nenhum token existe nela e o botão de tema nem aparece. Ela já é clara por desenho.
  - Converter quebra a página: o `tokenize.py` deixa o cabeçalho sem gradiente e a borda de foco escura (testado numa cópia). Ficou sem nenhuma troca.
  - Sugestão: tirar da contagem e excluir de qualquer rodada do `tokenize.py` em lote.
  - À parte, sem relação com o tema: o `.rodape` (`#9aa4b2` sobre `#EEF2F6`) dá 2,2:1. É do design original.
- **gestao.html** L102: o `stroke="#8AAEC8"` do SVG em `bloquearAcesso` ficou fixo (regra de atributo SVG). O `.gz-status` (select) virou `--surface-2`.

## Lote 6 (#33–#40) — dúvidas novas, 29/09/2026
- **Páginas de setor** (`fiscal`, `dp` e as do lote 7), `a[href=...] .dashboard-card-icon { color: ... }`: todas as cores de ícone de módulo ficaram fixas, inclusive as que o `tokenize.py` converteria sozinho (`#8AAEC8`, `#3FB07A`, `#E3B341`).
  - São a cor de cada módulo, sem sentido de estado.
  - O `style.css` já escurece o `.dashboard-card-icon` no claro (`filter: brightness(.62) saturate(1.35)`). Com token, o filtro escureceria duas vezes esses três e eles destoariam dos outros.
  - Confirmar se vale como padrão para todas as páginas de setor.
- **`.card-status.st-load`** (selo "carregando"): em `fiscal`, `dp` e `setores`, o fundo `rgba(255,255,255,.05)` virou `--fill-2`, pela decisão ".05 de fundo → `--fill-2`". O `index.html`, convertido antes, usa `--line` na mesma regra: `.08` contra `.06` no escuro. Pode ser alinhado depois, se quiserem o mesmo token em todas as telas-hub.
- **Relatórios** (`*-relatorios`): o bloco `@media print` (25 cores) ficou todo fixo. Resta só o contraste do `--ok` no claro (`#statOk`, 3,5:1), que já está registrado como pendência global.

## Lote 8 (#48–#53) — dúvidas novas, 29/09/2026
- **login.html — o login não troca de tema.**
  - Carrega o `style.css`, mas não o `auth-guard.js`/`theme.js`, então nunca recebe `data-theme="light"` e fica sempre escuro, mesmo com `mr_tema='claro'`. O `style.css` também não tem `prefers-color-scheme`.
  - As classes `.login-*` já usam token no `style.css` e funcionariam no claro (testado forçando o tema).
  - As 3 cores fixas da tela são o gradiente do logo (`stop-color` em SVG), que ficam.
  - Fazer o login seguir o tema exige carregar o `theme.js` ali, uma mudança de estrutura fora desta tarefa.
  - Obs.: o harness não fotografa o login, porque o mock tem sessão e ele redireciona pro `index.html`.
- **financeiro-rotinas.html e editar.html (raiz) — não se aplica.** São páginas de redirecionamento sem `style.css`. O aviso "Redirecionando…" fica com o escuro fixo (`#0D1117`/`#D7DEE8`) e pode dar um flash escuro rápido no tema claro. Se incomodar, precisa de uma decisão global sobre essas páginas.
- **gestao-rotinas** e **clientes/clientes-tarefas**: a lista vem do `assets/js/tarefas-engine.js`. No claro, o check sólido de "feita" (3,8:1) e a pill "Diária" (3,3:1) caem na pendência global do `--ok`.

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

---
## Decisões do arquiteto — 30/09/2026 (lotes 2 a 8 revisados e publicados)
Revisão: só cor mudou nas 44 telas; UTF-8 e fim de linha intactos; nenhum erro de JavaScript; escuro idêntico em 37 telas e,
nas outras 7, só onde as dúvidas abaixo previam; no claro, nenhuma tela com área escura (máx. 0,4% — texto).
- **`.btn-primary` no claro**: texto branco (regra no `style.css`). Feito.
- **`--ok` no claro** → `#157347` e **`--text-dim` no claro** → `#6E788A` (contraste ≥ 4,5:1). Feito.
- **Tokens novos**: `--rose` (`#F472B6` / claro `#B42F73`), `--orange` (`#FB923C` / claro `#B45309`), `--sel` (fundo de opção selecionada).
  Aplicados: `fator-r` (`.fr-longe`, cards "No Anexo V"/"Viram de anexo" → `--rose`; `.fr-perto` → `--orange`, o degrau volta a ter cor própria),
  `relatorios-vivos` (`.fim-tag.pl29` → `--rose`), `comercial-carteira` (`.seg .is-on` → `--sel`), `comercial-precificacao` (`.seg .is-on` com tinta própria no claro).
- **Aceitas como ele fez**: `--border` nos campos do DRE; spinner com `--text`/`--line-strong`; hover `.02` → `--fill-1`; `th` fixo → `--surface`;
  `#8FC0F0` → `--brand-light`; `pl26/pl28` → `--ok`/`--warn`; `#E08FA8` → `--err` em relatorios-vivos; ícones de módulo fixos nas páginas de setor;
  `@media print` fixo; faixa terracota da inadimplência fixa; `.fr-tour-hi` fixo.
- **Não se aplica** (confirmado): `proposta.html` (página pública, clara por desenho — fora de qualquer `tokenize.py` em lote), `login.html`,
  `financeiro-rotinas.html` e `editar.html` da raiz (redirecionamentos).
- **Fica para depois, se o Samuel quiser**: login seguindo o tema (exige carregar o `theme.js` na tela de login).

**Tarefa do tema claro: concluída.**
