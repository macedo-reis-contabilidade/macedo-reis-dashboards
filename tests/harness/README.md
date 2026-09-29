# Harness visual (sem login, sem Supabase)

Um comando só, em Windows, Mac ou Linux:

```
python tests/harness/conferir.py fiscal-reforma.html comercial-precificacao.html
```

Fotografa cada tela nos temas escuro e claro em `.harness/fotos/` e lista os erros de JavaScript.
Usa `supabase.mock.js` (dados inventados — nada de cliente) no lugar do Supabase real.
Pré-requisito, uma vez: `pip install playwright` e `python -m playwright install chromium`.
Detalhes do trabalho de tema: `docs/TEMA-CLARO-CODE.md`.
