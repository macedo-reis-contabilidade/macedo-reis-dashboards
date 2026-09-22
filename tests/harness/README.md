# Harness visual (sem login, sem Supabase)

Renderiza qualquer tela com dados **inventados** pra conferir layout e temas. Nada aqui é dado de cliente.

```bash
# 1) cópia da tela + assets numa pasta de trabalho, com o mock no lugar do supabase.js
rm -rf /tmp/h && mkdir -p /tmp/h/assets/js /tmp/h/assets/css /tmp/h/clientes
cp *.html /tmp/h/ && cp clientes/*.html /tmp/h/clientes/ && cp assets/js/*.js /tmp/h/assets/js/ && cp assets/css/style.css /tmp/h/assets/css/
cp tests/harness/supabase.mock.js /tmp/h/assets/js/supabase.js   # SEMPRE por último: sobrescreve o real

# 2) servir e fotografar (Playwright for Python: pip install playwright && playwright install chromium)
cd /tmp/h && python3 -m http.server 8765 &
python3 tests/harness/screenshot-temas.py          # gera escuro-<tela>.png e claro-<tela>.png pras telas listadas no script
```

- O tour de estreia se desliga sozinho no script (`localStorage['mr_tour_<chave>::<email>'] = 'ok'`).
- O mock responde a `select/eq/neq/is/lt/lte/gt/gte/in/insert/update/single` com filtros de verdade; `or/ilike/order/limit`
  são ignorados (devolve tudo). Pra uma tela que precise de mais tabelas, acrescente linhas em `DATA` no mock.
- Não copie `assets/` do repositório por cima da pasta de trabalho depois do passo 1 sem repetir a última linha:
  isso devolve o `supabase.js` real e a tela tenta logar.
