# Tema claro — etapa 2: converter as telas restantes (briefing pro Claude Code)

## Contexto
Desde 17/09/2026 o sistema tem tema claro (`assets/js/theme.js`, botão ☀️/🌙 no topo, `data-theme="light"` no `<html>`).
`assets/css/style.css` define os tokens e os valores claros. Telas convertidas por completo: index, agenda, clientes/index,
tarefas-engine (as sete de Tarefas), ajuda, tour. As demais ainda têm **cores fixas** no CSS local e ficam meio claras,
meio escuras no tema claro.

## O que fazer, tela a tela
1. Rodar `python3 tools/tema-claro/tokenize.py <tela.html>` — troca as cores fixas conhecidas pelos tokens (`var(--text)`,
   `var(--fill-1)`, `var(--line)`, `var(--ok)`, …). O script imprime o que **sobrou** sem mapa.
2. Pro que sobrou: decidir à mão. Regra: fundo de card → `--fill-1`/`--fill-2`; borda fina → `--line`; borda de controle →
   `--line-strong`; texto → `--text` / `--text-2` / `--text-muted` / `--text-dim`; estados → `--ok` / `--warn` / `--err`;
   fundo de modal → `--overlay`; popover → `--pop`. Tintas de marca `rgba(91,130,166,x)` e de estado `rgba(224,108,108,x)`
   etc. podem ficar — funcionam nos dois temas. Cores de setor em chips (JS inline) ficam: a regra
   `[data-theme=light] .setor-chip` já as escurece.
3. Conferir nos dois temas com o harness: `tests/harness/README.md`. Não precisa de login nem de Supabase.
4. Commitar em lotes de 5–8 telas. Mensagem: `Tema claro: <telas> convertidas de cores fixas para tokens`.
5. Ao fim de cada lote, acrescentar as telas ao card "Tema claro" na Ajuda (`ajuda.html`, seção Novidades, card de 17/09).

## Não fazer
- Não mexer em lógica JS, só em CSS e em cores inline de estilo.
- Não alterar `style.css` (os tokens já existem; se faltar um, avisar em vez de inventar).
- Não tocar nas cores dos gráficos de `relatorios-vivos.html` sem conferir os dois temas — são séries, não UI.

## Ordem sugerida (cores fixas por tela, medido em 21/09/2026)
| Tela | Cores fixas |
|---|---|
| fiscal-reforma.html | 133 |
| comercial-precificacao.html | 125 |
| comercial-reunioes.html | 116 |
| fiscal-analise.html | 111 |
| clientes/editar.html | 99 |
| dp-pareceres.html | 89 |
| comercial-carteira.html | 85 |
| fiscal-obrigacoes.html | 81 |
| dp-custo.html | 73 |
| relatorios-vivos.html | 72 |
| fiscal-regularizacao.html | 72 |
| contabil-dre.html | 72 |
| financeiro-faturaveis.html | 61 |
| financeiro-boletos.html | 59 |
| dp-convencoes.html | 55 |
| irpf-declaracoes.html | 53 |
| fiscal-xml.html | 52 |
| comercial-transicao.html | 51 |
| societario-alvaras.html | 45 |
| fator-r.html | 45 |
| financeiro-regras.html | 32 |
| societario-regras.html | 29 |
| fiscal-sugestoes.html | 29 |
| dp-sugestoes.html | 29 |
| contabil-sugestoes.html | 29 |
| gestao.html | 28 |
| fiscal-regras.html | 24 |
| dp-regras.html | 24 |
| contabil-regras.html | 24 |
| comercial-regras.html | 24 |
| proposta.html | 22 |
| societario-relatorios.html | 20 |
| irpf-relatorios.html | 20 |
| fiscal-relatorios.html | 20 |
| financeiro-relatorios.html | 20 |
| dp-relatorios.html | 20 |
| contabil-relatorios.html | 20 |
| comercial-relatorios.html | 20 |
| fiscal.html | 16 |
| dp.html | 16 |
| setores.html | 15 |
| clientes/novo.html | 15 |
| financeiro.html | 14 |
| comercial.html | 14 |
| societario.html | 11 |
| irpf.html | 11 |
| contabil.html | 11 |
| agenda.html | 11 |
| administracao.html | 10 |
| index.html | 5 |
| gestao-rotinas.html | 5 |
| clientes/clientes-tarefas.html | 5 |
| login.html | 3 |
| fiscal-clientes.html | 3 |
| financeiro-rotinas.html | 3 |
| editar.html | 3 |
| ajuda.html | 1 |
