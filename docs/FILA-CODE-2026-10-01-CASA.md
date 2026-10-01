# Fila do Claude Code — 01/10/2026 · pedreiro home office (1 item) · branch `sugestoes-quatro-setores`

> **Leia este arquivo inteiro antes de começar**, junto com o `CLAUDE.md`. Faça o item **inteiro, sem parar pra
> perguntar**: o Samuel pode estar dormindo e não vai autorizar nada no meio. Se aparecer dúvida, escolha a opção que
> **muda menos**, anote em `docs/FILA-CODE-2026-10-01-CASA-DUVIDAS.md` e siga. Ao terminar: commit(s),
> `git push origin sugestoes-quatro-setores` e o **Registro de progresso** (fim deste arquivo) preenchido. **Nunca** faça
> push em `main` nem merge — o arquiteto (Claude web) revisa e publica.

## Regras
- Antes de começar: `git fetch origin && git checkout main && git pull`, depois `git checkout -b sugestoes-quatro-setores`.
- **Não mexa no banco** (nada de DDL, nada de gravar dado real). Repositório **público**: dado de teste é sempre inventado.
- **Não mexa no módulo** `assets/js/sugestoes-setor.js` nem nas telas de Sugestões que já existem.
- Mexa só no que o item pede. Achou outro problema: anote no arquivo de dúvidas e siga.
- Se a branch `recorrentes-tres-setores` (do pedreiro do escritório) ainda não estiver no `main`, siga normalmente: os
  dois mexem nos hubs do Comercial e do Societário, e os conflitos o arquiteto resolve na publicação.
- Antes de entregar: `python tests/rodar-tudo.py` todo verde e `node --check` em todo JS mexido (inclusive os
  `<script type="module">` das páginas).
- **COM card na Ajuda** (regra 7 do `CLAUDE.md`).

## O que é
**Sugestões de melhoria** existe em 3 setores (`contabil-sugestoes.html`, `dp-sugestoes.html`, `fiscal-sugestoes.html`),
todas páginas finas do **módulo único** `assets/js/sugestoes-setor.js` (`initSugestoesSetor({ setor, nomeSetor, hub })`).
Faltam Comercial, Financeiro, Societário e IRPF. Regra do Samuel: os setores seguem a mesma lógica. A tabela `sugestoes`
não restringe o setor (sem CHECK, conferido em 01/10) — nada a fazer no banco.

## O que fazer
1. Quatro páginas novas, cópias de `contabil-sugestoes.html` trocando só a configuração:

   | arquivo | `setor` | `nomeSetor` | `hub` |
   |---|---|---|---|
   | `comercial-sugestoes.html` | `'comercial'` | `'Comercial'` | `'comercial.html'` |
   | `financeiro-sugestoes.html` | `'financeiro'` | `'Financeiro'` | `'financeiro.html'` |
   | `societario-sugestoes.html` | `'societario'` | `'Societário'` | `'societario.html'` |
   | `irpf-sugestoes.html` | `'irpf'` | `'IRPF'` | `'irpf.html'` |

   Confira o `nomeSetor` e o `<title>` usados nos `*-relatorios.html` desses setores e use o mesmo nome.
2. Card **Sugestões de melhoria** nos 4 hubs (`comercial.html`, `financeiro.html`, `societario.html`, `irpf.html`),
   copiado do `contabil.html`: o `<a href="contabil-sugestoes.html" class="dashboard-card">…</a>`, a regra de cor do
   ícone (`rgba(164,143,224,.16)` / `#A48FE0`) e a página na lista do `setBadge(h, '—')`. Ponha no mesmo lugar relativo
   em que ele fica no hub do Contábil (anote onde pôs).
3. `CLAUDE.md`, Mapa das páginas: a linha dos `*-sugestoes.html` passa a dizer os sete setores.
4. Card na Ajuda, no topo das Novidades: **"dd/mm · Sugestões de melhoria em todos os setores"** (dd/mm = o dia em
   que você fizer) — corpo curto: o card novo em cada hub, a mesma tela que o Contábil, o DP e o Fiscal já tinham.

## Como provar
- `tests/harness/relatorios-sugestoes.py`: inclua as 4 telas novas nas checagens que já existem (mostra o nome do setor,
  só as sugestões do setor, gravar uma sugestão grava com o setor certo) e confira que cada hub tem o card. Acrescente
  sugestões inventadas desses setores no mock.
- Fotos (`python tests/harness/conferir.py …`) das 4 telas e dos 4 hubs nos dois temas, sem erro de JavaScript.
- `python tests/rodar-tudo.py`: tudo verde.

## Registro de progresso
| Data | Item | Branch / commits | Situação / observação |
|---|---|---|---|
| — | — | — | (ninguém começou ainda) |
