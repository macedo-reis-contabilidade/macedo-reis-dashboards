# Lote nas telas dos setores — dúvidas e decisões

> Ver `docs/LOTE-ANDAMENTO-SETORES-CODE.md` (seção 6). Nada daqui impediu o trabalho. Em cada caso ficou a opção
> mais próxima da Agenda e do briefing; a decisão final é do arquiteto.

## Fora do escopo (o briefing limita os arquivos)
- **Card de novidade na `ajuda.html`** (regra 7 do CLAUDE.md): não foi feito, porque o briefing só permite mexer em
  `assets/js/tarefas-engine.js` e nos arquivos de teste. Fica para quem publicar.
- **A topbar fica por cima de todas as janelas do motor**, inclusive da nova.
  - `main`/`.app-shell` têm `z-index:1` e a `.topbar` tem `z-index:10` no `style.css`.
  - Por isso os botões "Sair" e tema continuam clicáveis com a janela aberta.
  - Em tela baixa (celular deitado), a topbar cobre o título e o ×. O detalhe da tarefa (`#detOverlay`) já tinha o mesmo problema.
  - Corrigir vale para todas as janelas do motor, e não só para a nova.
- **Exceção no meio do laço** (erro lançado, não `{ error }`): a barra fica travada em "Concluindo/Registrando i de N…".
  - Isso já acontecia no `concluirLote` original.
  - Com o supabase-js real, erro de rede volta como `{ error }`, que é tratado.
- **Foco preso na janela / tecla Esc:** nenhuma janela do motor prende o foco nem fecha com Esc. A nova segue o mesmo padrão.

## Escolhas que o briefing não fixava
- **Gênero no rótulo da caixa:** nas telas em que o item é "processo" (`societario-tarefas.html`), o rótulo diz "vai pro histórico de **cada um**". O título e o resumo já mudavam pelo `rotuloItens`.
- **Aviso de andamento vazio:** aparece dentro da própria janela (texto em `--err` embaixo da caixa), e não num `alert()` como na Agenda. Assim a janela do navegador não volta, e a pessoa não perde o que escreveu.
- **A janela tem também o ×**, como as outras janelas do motor. Cancelar, × e clique fora fecham sem gravar.
- **Clique fora:** só fecha se o clique também começou fora. Assim, arrastar a seleção do texto até o fundo não fecha a janela. O segundo clique de um duplo clique no botão da barra também não fecha.
- **Exemplo na caixa:** no andamento, usa o `andamentoPlaceholder` da tela. No concluir, usa um exemplo neutro ("Ex.: Feito e cliente avisado pelo WhatsApp."), porque os de andamento falam em "aguardando…".
- **Posição do botão:** "Registrar andamento" (`btn btn-ghost btn-sm`) fica logo depois de "Concluir N". A borda dele usa `--line-strong` só dentro da barra (`.fa-lote .btn-ghost`), porque no claro a borda padrão do `.btn-ghost` sumia sobre o fundo da barra.

## Ajustes no fluxo de concluir (os cuidados da seção 2 continuam todos)
- **A trava de tela e o `loteRodando` só saem depois do `carregarTarefas()`.**
  - Antes, eles saíam logo depois do laço.
  - Com o botão novo, o vizinho da mesma barra voltava a ficar clicável antes da recarga. Dava para começar outro lote sobre uma barra que ia ser descartada.
  - Vale para os dois fluxos.
- Os botões da barra são lidos antes de travar e, se a barra foi esvaziada por trás da janela, o lote não começa. Antes, o erro deixava o `loteRodando` preso até recarregar a página.
- Ao confirmar, a janela confere se a barra do grupo ainda existe. Se a lista foi redesenhada com a janela aberta, ela avisa ("A seleção mudou…") em vez de gravar às cegas.

## Harness
- O `supabase.mock.js` passou a devolver **cópias**, como o Supabase de verdade. Antes ele devolvia os próprios objetos do "banco", e mudar só a memória da tela parecia gravado.
- Ganhou `window.__mockDb` (leitura pelo teste) e `window.__mockDelay` (atraso opcional por consulta, usado pra ver o progresso e as travas).
- As tarefas inventadas t61–t65 ("Conferir notas de entrada", fiscal; "Alteração contratual", societário) aparecem também nas fotos de outras telas (Agenda, painel).
- O `lote-setores.py` foi conferido por mutação: 10 defeitos plantados no motor, um por vez, e o teste falhou em todos. Os defeitos:
  - andamento mudando status ou gravando uma linha só;
  - texto vazio gravando;
  - concluir só na memória;
  - sem `.neq`;
  - `confirm()` de volta;
  - observação fora do histórico;
  - trava saindo antes da recarga;
  - andamento sem travas;
  - clique fora no duplo clique.

---
## Decisões do arquiteto — 29/09/2026 (revisado e publicado)
Revisão: escopo respeitado (só motor, mock, teste e docs); LF e UTF-8 intactos; `lote-setores.py` rodado do zero (95 ok, 0 falhas);
verificação independente do arquiteto nos dois temas (andamento grava nas selecionadas sem mudar status; concluir leva a
observação; nenhum `alert/confirm`; nenhum erro de JavaScript).
- Todas as escolhas da seção "Escolhas que o briefing não fixava" e os ajustes no fluxo de concluir: **aceitos**.
- **Card na Ajuda**: feito pelo arquiteto.
- **Topbar por cima das janelas do motor**: problema antigo, vale para todas as janelas — fica registrado, sem correção agora.
- **Exceção lançada no meio do laço** e **Esc/foco**: ficam como estão (mesmo padrão das outras janelas).
- **t61–t65 nas fotos de outras telas**: aceito (dados inventados, só no mock).
