# Fila do Claude Code — 01/10/2026 · pedreiro do escritório (1 item) · branch `recorrentes-tres-setores`

> **Leia este arquivo inteiro antes de começar**, junto com o `CLAUDE.md`. Faça o item **inteiro, sem parar pra
> perguntar**. Se aparecer dúvida, escolha a opção que **muda menos**, anote em
> `docs/FILA-CODE-2026-10-01-ESCRITORIO-DUVIDAS.md` e siga. Ao terminar: commit(s), `git push origin recorrentes-tres-setores`
> e o **Registro de progresso** (fim deste arquivo) preenchido. **Nunca** faça push em `main` nem merge — o arquiteto
> (Claude web) revisa e publica.

## Regras
- Antes de começar: `git fetch origin && git checkout main && git pull`, depois `git checkout -b recorrentes-tres-setores`.
- **Não mexa no banco** (nada de DDL, nada de gravar dado real). Repositório **público**: dado de teste é sempre inventado.
- **Não mexa no módulo** `assets/js/rotinas-setor.js` nem nas telas do DP, do Contábil e do Financeiro — elas já estão
  prontas e o DP tem 142 regras em uso.
- Mexa só no que o item pede. Achou outro problema: anote no arquivo de dúvidas e siga.
- Antes de entregar: `python tests/rodar-tudo.py` todo verde e `node --check` em todo JS mexido (inclusive os
  `<script type="module">` das páginas).
- **COM card na Ajuda** (regra 7 do `CLAUDE.md`).

## O que é
Fiscal, Comercial e Societário ainda têm a versão antiga da tela de Tarefas recorrentes (`fiscal-regras.html`,
`comercial-regras.html`, `societario-regras.html` — ~310 linhas cada, cópias da lógica, sem card no hub). DP, Contábil
e Financeiro já usam o **módulo único** `assets/js/rotinas-setor.js`, por páginas finas. Regra do Samuel (29/09): os
setores seguem a mesma lógica. **Não há nenhuma regra cadastrada nesses três setores** (conferido no banco em 01/10):
não há nada pra migrar, é só trocar a tela.

## O que fazer
1. Troque as 3 páginas por páginas finas iguais a `contabil-regras.html` / `financeiro-regras.html`, **mantendo os nomes
   dos arquivos**:

   | arquivo | `setor` | `nomeSetor` | `hub` | `equipe` (ordem da lista de responsável) |
   |---|---|---|---|---|
   | `fiscal-regras.html` | `'fiscal'` | `'Fiscal'` | `'fiscal.html'` | `['Thalia', 'Adaini', 'Vitória', 'Samuel', 'Diego', 'Edna']` |
   | `comercial-regras.html` | `'comercial'` | `'Comercial'` | `'comercial.html'` | `['Samuel', 'Diego', 'Thalia', 'Vitória', 'Adaini', 'Edna']` |
   | `societario-regras.html` | `'societario'` | `'Societário'` | `'societario.html'` | `['Adaini', 'Samuel', 'Thalia', 'Vitória', 'Diego', 'Edna']` |

   A ordem da equipe segue quem mais recebe tarefas de cada setor hoje. `<title>` no padrão das páginas finas
   (ex.: `Tarefas recorrentes · Fiscal — Macedo & Reis`).
2. Card **Tarefas recorrentes** no hub de cada um (`fiscal.html`, `comercial.html`, `societario.html`), copiado do
   `contabil.html`: o `<a href="contabil-regras.html" class="dashboard-card">…</a>`, a regra de cor do ícone
   (`a[href="…-regras.html"] .dashboard-card-icon { background: rgba(63,176,122,.16); color:#3FB07A; }`) e a página na
   lista do `setBadge(h, '—')`. Ponha junto dos outros cards de tarefas/rotinas do hub (anote onde pôs).
   - **No Fiscal o texto do card muda**, pra não confundir com Obrigações: *"Rotinas do setor que não são obrigação
     fiscal: vincule várias empresas de uma vez, cada uma com sua data e periodicidade. As obrigações continuam em
     Obrigações."*
   - Comercial e Societário: o mesmo texto do card do Contábil.
3. `CLAUDE.md`, Mapa das páginas: a linha das Tarefas recorrentes passa a listar os seis setores e perde o trecho
   "`fiscal-`, `comercial-` e `societario-regras.html` ainda são a versão antiga, sem card no hub".
4. Card na Ajuda, no topo das Novidades: **"01/10 · Tarefas recorrentes também no Fiscal, no Comercial e no
   Societário"** — corpo curto: o card novo em cada hub, a mesma tela do DP, do Contábil e do Financeiro; no Fiscal, as
   obrigações continuam em Obrigações (ali ficam as outras rotinas do setor).

## Como provar
- Teste novo `tests/harness/rotinas-tres-setores.py`, no molde do `tests/harness/rotinas-setor.py`. Pras 3 telas: carrega
  sem erro de JavaScript; o caminho aponta pro hub certo; não mostra rotina de outro setor; "+ Rotina" grava no setor
  certo; vincular uma empresa grava em `tarefas_recorrentes` com o setor certo e o responsável escolhido; a lista de
  responsável começa por quem a tabela acima diz; o hub tem o card apontando pra página (e, no Fiscal, o texto que fala
  de Obrigações). Pode acrescentar dados inventados no mock (uma rotina de cada setor).
- Fotos (`python tests/harness/conferir.py …`) das 3 telas e dos 3 hubs nos dois temas, sem erro de JavaScript.
- `python tests/rodar-tudo.py`: tudo verde (o teste novo é achado sozinho).

## Registro de progresso
| Data | Item | Branch / commits | Situação / observação |
|---|---|---|---|
| — | — | — | (ninguém começou ainda) |
