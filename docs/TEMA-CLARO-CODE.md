# Tema claro — briefing para o Claude Code (autossuficiente)

> **Leia este arquivo inteiro antes de começar.** Ele é a sua memória deste trabalho: quem pegar a tarefa numa
> sessão nova começa pelo **Registro de progresso** no fim, marca o que fez e escreve onde parou.

## 1. O que é este projeto
Dashboard interno do escritório de contabilidade **Macedo & Reis** (Três Coroas/RS). São páginas **HTML estáticas**
com JavaScript em módulos ES, publicadas pelo **GitHub Pages** a partir da branch `main`. Os dados vêm do **Supabase**
(`assets/js/supabase.js`). Não há build: o arquivo que está no repositório é o que vai pro ar.

- O repositório é **público**: nunca coloque dado de cliente (nome, CNPJ, valores) em arquivo, teste ou commit.
- Quem publica é o Claude web (o "arquiteto"), depois de revisar. **Você trabalha numa branch e não publica.**
- Vocabulário do sistema: "escritório" (nunca "firma").

## 2. Como o tema funciona
- `assets/js/theme.js` (injetado em todas as telas pelo `assets/js/auth-guard.js`) guarda a escolha em
  `localStorage['mr_tema']` (`'claro'` ou `'escuro'`) e, no claro, põe `data-theme="light"` no `<html>`.
  O botão ☀️/🌙 no topo alterna.
- `assets/css/style.css` define **tokens** (variáveis CSS) com o valor escuro no `:root` e o claro em
  `[data-theme="light"]`. Os principais:
  - texto: `--text` (principal), `--text-2` (secundário), `--text-muted` (apagado), `--text-dim` (mais apagado)
  - superfícies: `--bg` (fundo da página), `--surface` (cartões), `--surface-2` (campos, listas), `--surface-hover`
  - preenchimentos translúcidos: `--fill-1` (leve), `--fill-2`, `--fill-3` (mais forte)
  - bordas: `--line` (fina), `--line-strong` (de controle/campo)
  - estados: `--ok`, `--warn`, `--err`  ·  marca: `--brand-primary`, `--brand-light`, `--brand-pale`
  - destaque: `--accent` (o ciano `#52B4C6` de títulos de bloco e totais — criado em 29/09)
  - camadas: `--overlay` (fundo de modal), `--pop` (popover/menu)
- As telas **já convertidas** (Painel central, Agenda, Clientes, telas de Tarefas, Ajuda) usam só tokens.
- As **outras** têm cor fixa (`#141A22`, `rgba(255,255,255,.08)`, `color:#E6EBF2`…) no `<style>` da página ou em
  `style="..."` — no tema claro elas ficam meio escuras: fundo preto em select, texto branco que some, etc.

## 3. A tarefa
Converter as cores fixas em tokens, **tela a tela, na ordem da tabela da seção 7**, até cada tela ficar certa nos
dois temas.

### Passo a passo por tela
1. Foto do **antes**: `python tests/harness/conferir.py <tela>.html` (salva em `.harness/fotos/escuro-*.png` e `claro-*.png`).
2. Conversão automática: `python tools/tema-claro/tokenize.py <tela>.html` — troca as cores conhecidas e lista as que sobraram.
3. As que sobraram, decida à mão com esta regra:
   - fundo de cartão/caixa → `var(--surface)` ou `var(--fill-1)`; campo, select, lista → `var(--surface-2)`
   - borda fina → `var(--line)`; borda de campo/botão → `var(--line-strong)`
   - texto → `var(--text)`, `var(--text-2)`, `var(--text-muted)` ou `var(--text-dim)`, pela hierarquia visual
   - sucesso/alerta/erro → `var(--ok)` / `var(--warn)` / `var(--err)`
   - fundo de modal → `var(--overlay)`; menu/popover → `var(--pop)`
   - **pode ficar como está**: tintas de marca/estado translúcidas (ex.: `rgba(91,130,166,.15)`,
     `rgba(224,108,108,.12)`) — funcionam nos dois temas; cores das **séries de gráfico**; chips de setor.
4. Foto do **depois** com o mesmo comando e compare:
   - **claro**: nenhum fundo escuro sobrando, todo texto legível, bordas visíveis, selects e campos claros;
   - **escuro**: igual ao antes (a conversão não pode mudar o tema escuro).
5. A tela dá "Erros de JavaScript: nenhum" no fim do comando.

### O que NÃO fazer
- Não altere lógica em JavaScript — só CSS e atributos `style`. Cor montada dentro de template JS (ex.: `'color:#E06C6C'`
  numa string) pode ser trocada pelo token, sem mexer em mais nada da linha.
- Não altere `assets/css/style.css`. Se faltar um token, anote em `docs/TEMA-CLARO-DUVIDAS.md` e siga.
- Não crie arquivo novo fora dos citados aqui, não mude nome de classe, não reorganize código.
- Não suba a pasta `.harness/` (já está no `.gitignore`).

## 4. Preparação (uma vez por máquina)
```
git clone https://github.com/macedo-reis-contabilidade/macedo-reis-dashboards
cd macedo-reis-dashboards
pip install playwright
python -m playwright install chromium
```
No Windows, use `python` (ou `py`) no lugar de `python3`. Os dois scripts leem e gravam em UTF-8 — os acentos ficam intactos.

## 5. Git
- Antes de **cada** lote: `git fetch origin && git checkout tema-claro && git pull origin tema-claro`. O arquiteto publica cada lote revisado e já deixa a branch `tema-claro` atualizada com o `main` (tokens novos, decisões). Leia as **Decisões do arquiteto** no fim de `docs/TEMA-CLARO-DUVIDAS.md` antes de continuar.
- **Um commit por lote de 5 a 8 telas**, mensagem: `Tema claro: <tela1>, <tela2>, ... convertidas para tokens`.
- Envie: `git push origin tema-claro`. **Nunca** faça push em `main` nem merge — o Claude web revisa e publica.
- Se o push pedir credencial e não houver, deixe os commits locais e avise o Samuel.

## 6. Dúvidas
Não pare o trabalho por dúvida: anote em `docs/TEMA-CLARO-DUVIDAS.md` (tela, trecho, o que não soube decidir)
e vá para a próxima tela.

## 7. Telas, na ordem (cores fixas contadas em 29/09/2026)
| # | Tela | Cores fixas | Feita |
|---|---|---|---|
| 1 | `fiscal-reforma.html` | 135 | ✅ |
| 2 | `comercial-precificacao.html` | 125 | ✅ |
| 3 | `comercial-reunioes.html` | 116 | ✅ |
| 4 | `fiscal-analise.html` | 111 | ✅ |
| 5 | `clientes/editar.html` | 99 | ✅ |
| 6 | `dp-pareceres.html` | 89 | ✅ |
| 7 | `comercial-carteira.html` | 85 | ✅ |
| 8 | `fiscal-obrigacoes.html` | 81 | ✅ |
| 9 | `dp-custo.html` | 73 | ✅ |
| 10 | `relatorios-vivos.html` | 72 | ✅ |
| 11 | `fiscal-regularizacao.html` | 72 | ✅ |
| 12 | `contabil-dre.html` | 72 | ✅ |
| 13 | `financeiro-faturaveis.html` | 61 | ✅ |
| 14 | `financeiro-boletos.html` | 59 | ✅ |
| 15 | `dp-convencoes.html` | 55 | ✅ |
| 16 | `irpf-declaracoes.html` | 53 | ✅ |
| 17 | `fiscal-xml.html` | 52 | ✅ |
| 18 | `comercial-transicao.html` | 51 | ✅ |
| 19 | `societario-alvaras.html` | 45 | ✅ |
| 20 | `fator-r.html` | 45 | ✅ |
| 21 | `financeiro-regras.html` | 32 | ✅ |
| 22 | `societario-regras.html` | 29 | ✅ |
| 23 | `fiscal-sugestoes.html` | 29 | ✅ |
| 24 | `dp-sugestoes.html` | 29 | ✅ |
| 25 | `contabil-sugestoes.html` | 29 | ⬜ |
| 26 | `gestao.html` | 28 | ⬜ |
| 27 | `fiscal-regras.html` | 24 | ⬜ |
| 28 | `contabil-regras.html` | 24 | ⬜ |
| 29 | `comercial-regras.html` | 24 | ⬜ |
| 30 | `proposta.html` | 22 | ⬜ |
| 31 | `societario-relatorios.html` | 20 | ⬜ |
| 32 | `irpf-relatorios.html` | 20 | ⬜ |
| 33 | `fiscal-relatorios.html` | 20 | ⬜ |
| 34 | `financeiro-relatorios.html` | 20 | ⬜ |
| 35 | `dp-relatorios.html` | 20 | ⬜ |
| 36 | `contabil-relatorios.html` | 20 | ⬜ |
| 37 | `comercial-relatorios.html` | 20 | ⬜ |
| 38 | `fiscal.html` | 16 | ⬜ |
| 39 | `dp.html` | 16 | ⬜ |
| 40 | `setores.html` | 15 | ⬜ |
| 41 | `clientes/novo.html` | 15 | ⬜ |
| 42 | `financeiro.html` | 14 | ⬜ |
| 43 | `comercial.html` | 14 | ⬜ |
| 44 | `societario.html` | 11 | ⬜ |
| 45 | `irpf.html` | 11 | ⬜ |
| 46 | `contabil.html` | 11 | ⬜ |
| 47 | `administracao.html` | 10 | ⬜ |
| 48 | `gestao-rotinas.html` | 5 | ⬜ |
| 49 | `clientes/clientes-tarefas.html` | 5 | ⬜ |
| 50 | `login.html` | 3 | ⬜ |
| 51 | `fiscal-clientes.html` | 3 | ⬜ |
| 52 | `financeiro-rotinas.html` | 3 | ⬜ |
| 53 | `editar.html` | 3 | ⬜ |

## 8. Registro de progresso
Ao fim de cada sessão, acrescente uma linha: data, telas feitas (marque ✅ na tabela acima), commit, onde parou.

| Data | Telas feitas | Commit | Onde parou / observação |
|---|---|---|---|
| 28/09/2026 | #1–#5: fiscal-reforma, comercial-precificacao, comercial-reunioes, fiscal-analise, clientes/editar | `2414ec9` (lote 1) | Lote 1 feito: diff só de cor, escuro igual ao antes, claro sem fundo escuro; HTML de impressão/janela nova e cores concatenadas em JS ficaram fixos. Próximo: #6 `dp-pareceres.html` (lote 2 = #6–#11). Dúvidas em `docs/TEMA-CLARO-DUVIDAS.md`. |
| 28/09/2026 | #6–#11: dp-pareceres, comercial-carteira, fiscal-obrigacoes, dp-custo, relatorios-vivos, fiscal-regularizacao | `6f3e996` (lote 2) | Lote 2 feito, mesmos critérios do lote 1. Próximo: #12 `contabil-dre.html` (lote 3 = #12–#17). Novas dúvidas (btn-primary e --ok no claro, token de selecionado, rosa/terracota) em `docs/TEMA-CLARO-DUVIDAS.md`. |
| 28/09/2026 | #12–#17: contabil-dre, financeiro-faturaveis, financeiro-boletos, dp-convencoes, irpf-declaracoes, fiscal-xml | `9c0416f` (lote 3) | Lote 3 feito sobre a revisão do arquiteto (--accent, --warn novo). Próximo: #18 `comercial-transicao.html` (lote 4 = #18–#24). Dúvidas do lote 3 em `docs/TEMA-CLARO-DUVIDAS.md`. |
| 28/09/2026 | #18–#24: comercial-transicao, societario-alvaras, fator-r, financeiro-regras, societario-regras, fiscal-sugestoes, dp-sugestoes | este commit (lote 4) | Lote 4 feito. Telas de mesmo template (regras, sugestões) espelham a primeira convertida: societario-regras = financeiro-regras, dp-sugestoes = fiscal-sugestoes, linha a linha. Próximo: #25 `contabil-sugestoes.html` (lote 5 = #25–#32). |
