# Fila do Claude Code de 29/09 — dúvidas, achados e escolhas

> Ver `docs/FILA-CODE-2026-09-29.md`. Nada daqui impediu o trabalho. Em cada caso ficou a opção mais próxima
> do que já existia no repositório; a decisão final é do arquiteto.
> Cada item foi feito na sua branch, então este arquivo nasce em cada uma com a seção do seu item.

## Item 4 — Login seguindo o tema

- **Nada precisou de conserto no claro.** As classes `.login-*` já estavam todas em token, como o item previa.
  Conferidas três telas: o login em repouso, com o aviso de erro aberto (`.form-error`, que usa `var(--danger)`
  sobre um vermelho de 10% — legível no branco) e com o botão travado em "Entrando…". Nenhum ajuste de cor.
- **O escuro ficou igual ao de antes**: 0 pixels diferentes. O claro muda inteiro, que é o objetivo.
- **O `--sem-sessao`** acrescenta ao fim da cópia do mock (dentro de `.harness/site`, fora do git) o suficiente pra
  ninguém estar logado: `supabase.auth.getUser`, `supabase.auth.getSession` e `getCurrentUser` passam a responder
  vazio. Com ele, o `conferir.py` também para de passar pelo `index.html` antes de fotografar (sem sessão, o
  `auth-guard` manda pro login): o tema vai direto pelo navegador, num `add_init_script`.
- **Cuidado ao usar o `--sem-sessao` em outras telas:** qualquer tela com `auth-guard` vai tentar redirecionar pro
  login e a foto sai do jeito que der. A opção é pro `login.html`.
- **Não mexi no `tests/harness/README.md`** de propósito: o item 3 reescreve esse arquivo inteiro na branch dele, e
  as duas mudanças brigariam à toa. A opção já está documentada no cabeçalho do próprio `conferir.py`
  (`python tests/harness/conferir.py --sem-sessao login.html`).
- **O botão ☀️/🌙 não aparece no login**, como o item diz — o `theme.js` só injeta o botão quando existe uma
  `.topbar`, e o login não tem. A cor é aplicada do mesmo jeito, antes de a tela aparecer.
