# Registrar andamento (e observação ao concluir) em lote nas telas de tarefas dos setores — briefing para o Claude Code

> **Leia este arquivo inteiro antes de começar.** Ele é autossuficiente: você não precisa de nenhum contexto anterior.
> Leia também o `CLAUDE.md` da raiz do repositório.

## 1. Contexto
Dashboard interno do escritório **Macedo & Reis**: páginas HTML estáticas + JavaScript (módulos ES), publicadas pelo
GitHub Pages a partir da `main`; dados no Supabase (`assets/js/supabase.js`). Repositório **público**: nada de dado de
cliente em arquivo, teste ou commit. Quem publica é o Claude web (o "arquiteto"), depois de revisar — **você trabalha numa
branch e não publica**. Vocabulário: "escritório", nunca "firma".

## 2. O que existe hoje
**Agenda (`agenda.html`) — a referência.** Nas listas de busca e de foco, cada tarefa aberta tem uma caixa de seleção e há uma
barra de lote com dois botões: **"Registrar andamento"** e **"Concluir N selecionadas"**. Os dois abrem uma janela
(`#loOverlay`, função `abrirLote(modo, ids)`, ~linha 640) com uma caixa de texto:
- **Concluir**: observação **opcional**; conclui todas e grava no histórico de cada uma
  `'Tarefa concluída em lote pela Agenda (N tarefas). ' + obs`.
- **Registrar andamento**: texto **obrigatório**; **não muda o status**; grava no histórico de cada uma
  `obs + ' (registrado em lote pela Agenda, N tarefas)'`.

**Telas dos setores — o que vai mudar.** Estas 9 telas usam o mesmo motor, `assets/js/tarefas-engine.js` (`initTarefas`):
`fiscal-tarefas.html`, `contabil-tarefas.html`, `dp-tarefas.html`, `financeiro-tarefas.html`, `comercial-tarefas.html`,
`societario-tarefas.html`, `irpf-tarefas.html`, `gestao-rotinas.html`, `clientes/clientes-tarefas.html`.
No motor, seção `CONCLUIR EM LOTE` (~linha 748): cada grupo tem caixas `input[data-sel]` e uma barra `[data-lote]` montada por
`ligarLote(det)`, com **só** "Concluir N" + "Limpar seleção" + o aviso "O lote não gera cobrança à parte…". O botão chama
`concluirLote(det, ids, barra)`, que pede um `confirm()` do navegador e conclui uma a uma — com cuidados que **devem ser mantidos**:
`.neq('status','concluida')` (não sobrescreve quem outra pessoa concluiu), `_avisarDependentes`, travas de tela enquanto roda,
contagem "Concluindo i de N…", e o resumo final (feitas / falhas / sem histórico / já estavam concluídas).

## 3. O que fazer
Trazer para as telas dos setores o mesmo comportamento da Agenda, **só editando `assets/js/tarefas-engine.js`**:
1. Na barra de lote de cada grupo, ao lado de "Concluir N", um botão **"Registrar andamento"** (`btn btn-ghost btn-sm`).
2. Os dois botões abrem **uma janela criada pelo próprio motor** (uma vez, por JavaScript — não edite as 9 páginas), no lugar do `confirm()`:
   - título: "Concluir N tarefas" / "Registrar andamento em N tarefas" (use `rotuloItens(n)`: nas telas em que o item é
     "processo", o gênero muda — `C.item` e `C.itemPluralFem`);
   - rótulo da caixa: "Observação (opcional) — vai pro histórico de cada uma" / "O que aconteceu — vai pro histórico de cada uma";
   - botões: "Cancelar" e "Concluir N" / "Registrar em N"; clicar fora ou em Cancelar fecha sem gravar nada;
   - andamento com texto vazio: não grava e avisa ("Escreve o que aconteceu — é isso que vai pro histórico.").
3. **Concluir**: exatamente o fluxo atual de `concluirLote` (todos os cuidados da seção 2), trocando só o texto do histórico
   para `C.historicoConcluida + (obs ? ' ' + obs : '')`.
4. **Registrar andamento**: para cada tarefa, `insert` em `tarefa_historico` com
   `{ tarefa_id, descricao: obs + ' (registrado em lote, ' + rotuloItens(n) + ')', autor: usuarioEmail }` — **sem mudar status**.
   Mesmas travas de tela e progresso ("Registrando i de N…"); resumo no mesmo estilo (`.fa-lote-resumo`):
   "✓ Andamento registrado em N tarefas." ou a lista do que falhou. Depois, limpe a seleção e recarregue (`carregarTarefas()`).
5. Visual: só tokens de cor (`var(--text)`, `var(--surface)`, `var(--line)`, `var(--overlay)`…), certo nos temas escuro e claro.
   Para a janela, reaproveite o estilo de modal que a tela já tem (o motor injeta CSS no começo do arquivo — siga o mesmo padrão).

### O que NÃO fazer
- Não mexa em outros arquivos além de `assets/js/tarefas-engine.js` e dos de teste citados na seção 4.
- Não mude o aviso "O lote não gera cobrança à parte…", a regra de faturável, nem a conclusão individual (detalhe da tarefa).
- Não mude banco, tabelas ou colunas (`tarefas`, `tarefa_historico` já têm tudo).
- Não "melhore" outras partes do motor.

## 4. Teste
Preparação (uma vez): `pip install playwright` e `python -m playwright install chromium`.
- **Visual**: `python tests/harness/conferir.py fiscal-tarefas.html dp-tarefas.html societario-tarefas.html` — fotos nos dois
  temas em `.harness/fotos/`, e "Erros de JavaScript: nenhum" no fim. O mock (`tests/harness/supabase.mock.js`) tem tarefas inventadas.
- **Comportamento**: crie `tests/harness/lote-setores.py` (Playwright), no mesmo esquema do `conferir.py` (monta o site com o
  mock e sobe um servidor local), que abre `fiscal-tarefas.html` e verifica:
  1. marcar 2 tarefas de um grupo → aparecem os dois botões na barra;
  2. "Registrar andamento" com texto → 2 linhas novas em `tarefa_historico` com o texto, e o status das 2 **não** muda;
  3. "Registrar andamento" com texto vazio → nada gravado;
  4. "Concluir" com observação → as 2 ficam `concluida` e o histórico traz `'Tarefa concluída. ' + observação`;
  5. "Cancelar" → nada gravado.
  Para ler o banco falso no teste, exponha-o no mock (`window.__mockDb = db` em `supabase.mock.js`) — permitido, é arquivo de teste.
  Se precisar de mais tarefas no mock, invente (nunca dado real).
- Rode também `node --check assets/js/tarefas-engine.js`.

## 5. Git
- `git fetch origin && git checkout main && git pull`, depois `git checkout -b lote-andamento-setores`.
- Commits pequenos e com mensagem clara; no fim, `git push origin lote-andamento-setores`.
- **Nunca** faça push em `main` nem merge. Se o push pedir credencial e não houver, deixe os commits locais e avise o Samuel.

## 6. Ao terminar
Mostre ao Samuel: as fotos claro/escuro da barra de lote e da janela, e a saída do `lote-setores.py`. Dúvidas que não
impedem o trabalho: anote em `docs/LOTE-ANDAMENTO-DUVIDAS.md` e siga.

## 7. Registro de progresso
| Data | O que foi feito | Commit | Onde parou / observação |
|---|---|---|---|
| — | — | — | (ninguém começou ainda) |
