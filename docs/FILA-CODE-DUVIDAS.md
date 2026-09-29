# Fila do Claude Code de 29/09 — dúvidas, achados e escolhas

> Ver `docs/FILA-CODE-2026-09-29.md`. Nada daqui impediu o trabalho. Em cada caso ficou a opção mais próxima
> do que já existia no repositório; a decisão final é do arquiteto.

## Achado que vale pros 4 itens

- **Os testes do harness quebram no console padrão do Windows.** `python tests/harness/rotinas-setor.py` morre com
  `UnicodeEncodeError: 'charmap' codec can't encode character '✓'` antes da primeira checagem — o console do
  Windows abre em cp1252 e o ✓/✗ não passa. Não é erro do teste: o mesmo arquivo passa inteiro com
  `PYTHONIOENCODING=utf-8`. Fica assim:
  - o teste novo (`tests/harness/relatorios-sugestoes.py`) abre com `sys.stdout.reconfigure(encoding='utf-8')`,
    então roda em qualquer console;
  - os três antigos (`lote-setores.py`, `obrigacoes-responsavel.py`, `rotinas-setor.py`) continuam como estão —
    mexer neles não era do item 1. **Sugestão:** a mesma linha em cada um, ou deixar o `tests/rodar-tudo.py`
    (item 3) forçar UTF-8 nos testes que ele chama.

## Item 1 — Relatórios e Sugestões num módulo só

- **O que virou configuração.** Relatórios: `setor`, `nomeSetor`, `hub`, `rotuloVazio` (e `tituloImpressao`, que por
  padrão é o `nomeSetor` — hoje nenhum setor precisa dele). Sugestões: `setor`, `nomeSetor`, `hub`.
- **`rotuloVazio` é só o nome solto do setor** ('comercial', 'contábil', 'DP', 'financeiro', 'fiscal', 'IRPF',
  'societário'), porque as duas frases da lista vazia têm moldura fixa: "Nada registrado ainda **no** X" e
  "Conforme as tarefas **do** X forem concluídas". Assim cada texto continua letra por letra como estava.
- **Dados inventados novos no mock** (`tests/harness/supabase.mock.js`): a tabela `sugestoes` não existia — entraram
  4 sugestões de contábil/DP/fiscal (uma delas concluída, pra fotografar a seção recolhida). Também entrou
  `competencia` em duas tarefas que já existiam ('Enviar guias do mês' e 'Fechamento contábil'), senão o filtro de
  competência das telas de Relatórios nasceria vazio e ninguém veria se ele funciona.
- **As fotos "antes" foram tiradas com o mock já mudado** (páginas ainda as antigas), pra comparação pixel a pixel
  medir só a troca das telas pelo módulo, e não os dados de teste.
- **Sugestões de melhoria só existe em 3 setores** (contábil, DP, fiscal). Não criei as telas que faltam nem mexi nos
  hubs: não era do item. Com o módulo pronto, cada uma é uma página fina de 30 linhas.
