# Fila do Claude Code de 30/09 — "hoje" no fuso de Brasília: dúvidas, achados e escolhas

> Ver `docs/FILA-CODE-2026-09-30.md`. Nada daqui impediu o trabalho. Na dúvida, ficou a opção que muda menos;
> a decisão final é do arquiteto.

## As 37 ocorrências — o que foi feito com cada uma

**35 trocadas · 2 ficaram como estavam.**

### Trocadas (28) — "hoje" ou "+N dias" calculados a partir de agora (o valor muda e passa a ser o certo)
| Onde | O quê |
|---|---|
| `agenda.html` — `fmtISO` | helper do resumo do dia, chamado com `new Date()` (hoje) e "amanhã": corrigido o helper — agora usa o `ymd()` que a página já tinha (dia local), sem import novo |
| `agenda.html` — radar | `hj` (hoje) e `em60` (+60 dias), também com o `ymd()` da página |
| `assets/js/nova-tarefa.js` — `ymd` | helper usado com `new Date()` (prazo padrão da tarefa nova, comparações "já passou?") e com datas ao meio-dia: corrigido o helper |
| `assets/js/relatorios-setor.js` — `HOJE` | "atrasada" nos relatórios dos setores |
| `assets/js/rotinas-setor.js` — `apagarFuturas` | "pendentes a partir de hoje" |
| `clientes/editar.html` (2) | data padrão do kit de boas-vindas |
| `comercial-carteira.html` (4) | inadimplente desde, saída, entrada (2) |
| `comercial-precificacao.html` (2) | transição criada pela proposta: `inicio` e `previsao_fim` (+90) |
| `comercial-transicao.html` (2) | helper `hojeISO` da página (corrigido o helper) e a data sugerida no prompt da entrada na carteira (agora usa o `hojeISO()` da página) |
| `comercial`, `contabil`, `dp`, `financeiro`, `fiscal`, `irpf`, `societario.html` (7) | selo "N hoje" dos hubs |
| `fiscal-reforma.html` (1) | quem saiu da carteira — usa o `hojeISO()` que a página já tinha (corrigido em `f33e5d9`), sem import novo |
| `fiscal-regularizacao.html` (2) | "hoje" do resumo e a data-base padrão do caso novo |
| `relatorios-vivos.html` (2) | `hojeStr` da planilha de empréstimos e do PDF (`hoje` é `new Date()`) |

### Trocadas (7) — datas já ancoradas: o valor em Brasília não muda, trocadas por uniformidade
| Onde | Por que o valor é o mesmo |
|---|---|
| `comercial-carteira.html` — `fimDe` (3: análise, PDF, Excel) | `new Date(a, m, 0)` é meia-noite **local** do último dia do mês; em UTC−3 isso é 03:00 UTC do mesmo dia |
| `comercial-precificacao.html` e `comercial-transicao.html` — prazo do kit (2) | `base` é `hoje + 'T12:00:00'` (meio-dia) + N dias |
| `comercial-transicao.html` — `previsao_fim` da transição nova | `inicio + 'T12:00:00'` + 90 dias |
| `societario-alvaras.html` — `addDias` | `iso + 'T12:00:00'` + N dias; agora lê com o `toYMD()` que a página já tinha, sem import novo. **Achado:** a função não é chamada em lugar nenhum (código morto desde que a tarefa de renovação passou a nascer no banco, 23/09) — ficou, porque apagar não era do item |

### Ficaram como estavam (2) — conta inteira em UTC, de propósito, e coerente
| Onde | Por que não troca |
|---|---|
| `fator-r.html` — `addMeses` | monta `new Date(Date.UTC(ano, mês + n, 1))` e lê com `toISOString()`: as duas pontas em UTC dão o 1º dia do mês certo em qualquer fuso. Trocar só a leitura por `dataLocal` daria **o dia anterior** em Brasília (meia-noite UTC = 21h do dia anterior) |
| `relatorios-vivos.html` — `parcelasDoMes` | `new Date(Date.UTC(a, m, 0))` + `toISOString()`: último dia do mês, mesma lógica — trocar só a leitura erraria o dia |

## Escolhas feitas no caminho (a que muda menos)
- **Import novo × helper da página.** A fila manda corrigir o helper próprio da página em vez de espalhar import. Três
  páginas já tinham um formatador de dia local e ficaram **sem import**: `fiscal-reforma.html` (`hojeISO()`),
  `agenda.html` (`ymd()`) e `societario-alvaras.html` (`toYMD()`). As outras 13 páginas e os 3 módulos de
  `assets/js/` não tinham nada equivalente e passaram a importar `hojeLocal` / `dataLocal` de `utils.js`.
- **`societario-alvaras.html` — `addDias` morto:** trocado (é uma das 37), não apagado.

- **Edge Function `supabase/functions/ca-sync/index.ts`** (a fila manda não mexer em Edge Function):
  - linhas 34 e 339: já descontam 3 horas (fuso de São Paulo) de propósito — certas;
  - linhas 39–40 (`mesStr`) e 182: conta inteira em UTC e coerente (`Date.UTC(...)` / `new Date(x + 'T00:00:00Z')` +
    `setUTCDate`, lidos com `toISOString`) — certas, mesma lógica do `fator-r.html`;
  - **linha 316** (sem `toISOString`, por isso fora da busca): o "mês atual" da passada incremental de pagamentos sai de
    `agora.getUTCMonth()`. No último dia do mês, das 21h à meia-noite de Brasília, ela cobre [mês atual, mês seguinte]
    em vez de [mês anterior, mês atual]. O mês corrente continua coberto, então o efeito é pequeno; se quiser acertar,
    tirar o mês de `spIso(agora)` (a mesma hora de São Paulo da linha 34).
- **`assets/js/rotinas-setor.js` — `apagarFuturas` + `gerar_tarefas_recorrentes()`:** ao alterar regras, a tela apaga as
  pendentes com prazo a partir de **hoje (agora local)** e chama a função do banco pra recriá-las. Se essa função usar
  `CURRENT_DATE`/`now()` em UTC pra decidir "de hoje em diante", entre 21h e meia-noite ela começaria em amanhã e a
  tarefa de hoje, já apagada, não voltaria. Antes da troca a tela também apagava a partir de "amanhã" (UTC) nesse
  horário, então as duas pontas batiam por acaso. **Vale o arquiteto conferir no banco** se a função usa o fuso de
  São Paulo (`(now() AT TIME ZONE 'America/Sao_Paulo')::date`).
- **SQL / funções do banco:** não há SQL no repositório pra conferir `CURRENT_DATE` (o banco não está aqui).
- **O próprio banco falso do harness calcula as datas em UTC** (`tests/harness/supabase.mock.js`, `ymd` usado pelo
  `add(n)`). De noite, as tarefas inventadas "de hoje" ficam com a data do dia seguinte. Por isso o teste novo injeta as
  dele com data explícita. Efeito colateral visível só no harness: rodando o `conferir.py` entre 21h e meia-noite,
  agora a agenda mostra as tarefas "de hoje" do mock como AMANHÃ e os selos "N hoje" dos hubs somem — é o mock que
  gravou 01/10, a tela está certa (com o `ymd` do mock em data local, as 18 telas saem iguais às das 14h). Trocar o
  mock mexeria nas datas de todos os outros testes e está fora da busca das 37 — não mexi. Se for trocar: formatar com
  `getFullYear/getMonth/getDate`, igual ao `dataLocal`.
- **`assets/js/dominio-relatorios.js:447`** usa `getUTCDate()` pra data serial do Excel — está certo (é conta em UTC, não "hoje").

## Como foi provado
- `tests/harness/data-local.py` (novo): navegador em `America/Sao_Paulo`, relógio parado em 30/09/2026 22:30, 6 telas:
  Precificação (transição pela proposta: início, previsão e kit), Transição (nova: início, previsão e kit), Agenda (+ Tarefa),
  Carteira (+ Adicionar), hub do Fiscal (selo "N hoje") e Relatórios do Fiscal (tarefa de hoje não é "Atrasada").
  **Passa no código novo; no código antigo do `main` falha 11 vezes, nas 6 telas** — todas com 2026-10-01.
- `python tests/rodar-tudo.py`: 14 testes, 14 ok.
- Revisão de regressão (antes = `main`, depois = branch; 18 telas — as 16 páginas mexidas, `fiscal-relatorios.html` e
  `dp-regras.html` —, relógio parado em America/Sao_Paulo, mock do harness):
  - às **14:00**: o texto das 18 telas é idêntico antes e depois, a 1400 e a 1920px, e não há erro de JavaScript;
  - às **22:30**: só mudam data, "hoje" e contagem de vencimento, como esperado;
  - os campos de data padrão (agenda, carteira, regularização, transição e kit do editor de cliente) passam de
    2026-10-01 para 2026-09-30.
- `node --check` nos 4 `.js` mexidos e nos 16 `<script type="module">` das páginas (extraídos pra `.mjs`): sem erro.
