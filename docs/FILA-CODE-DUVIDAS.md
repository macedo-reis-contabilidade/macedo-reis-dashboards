# Fila do Claude Code de 29/09 — dúvidas, achados e escolhas

> Ver `docs/FILA-CODE-2026-09-29.md`. Nada daqui impediu o trabalho. Em cada caso ficou a opção mais próxima
> do que já existia no repositório; a decisão final é do arquiteto.
> Cada item foi feito na sua branch, então este arquivo nasce em cada uma com a seção do seu item.

## Item 3 — O teste do importador de XML volta a rodar

- **O corte de propósito que o item pede não foi pego de primeira.** Trocando o sinal em
  `valor_total: Math.max(0, vServ - descInc)` (linha 150 do `assets/js/importar-xml.js`), **o teste passou igual**:
  a NFS-e inventada não tinha desconto nenhum, então `1500 + 0` e `1500 − 0` dão o mesmo número. Era um furo de
  verdade — a conta de receita bruta da NFS-e (descontar só o incondicional) não tinha teste. Entrou uma segunda
  nota inventada, com desconto incondicional de 100 e condicional de 50, e duas checagens:
  `valor_total` = 1400 e `valor_desconto` = 150. **Aí sim o corte falha.** É a única diferença em relação ao `.mjs`
  antigo: o resto são as mesmas checagens, com os mesmos XMLs.
- **Onde o teste roda.** O `importar-xml.py` monta o site igual ao `conferir.py`, sobe o servidor, abre uma página
  vazia (`_parser.html`, criada só dentro de `.harness/site`) e faz `import('/assets/js/importar-xml.js')` no
  navegador. É o mesmo módulo que as telas usam, com o `DOMParser` de verdade — inclusive no XML mal formado, em
  que o navegador devolve `<parsererror>` e o parser lança "mal formado". O `.mjs` antigo foi apagado.
- **Acento no console do Windows.** Os testes escrevem ✓ e ✗, e o console padrão do Windows (cp1252) derrubava o
  teste na primeira linha (`UnicodeEncodeError`). O `rodar-tudo.py` roda os filhos com `PYTHONIOENCODING=utf-8` e
  `PYTHONUTF8=1`, então todos passam a rodar em qualquer console, inclusive os antigos, sem mexer neles.
- **Servidor do harness atendia uma requisição por vez** (`socketserver.TCPServer`): quando a tela pede vários
  módulos de uma vez, um voltava com `ERR_CONNECTION_REFUSED` e a tela ficava pela metade — **sem nenhum erro de
  JavaScript**, então a foto saía vazia e o teste não reclamava. Virou `ThreadingTCPServer`. É a mesma correção
  feita na branch do item 2 (arquivo e texto idênticos: juntar as duas branches não gera conflito aqui).
- **O `rodar-tudo.py` acha os testes sozinho** (`tests/*.test.mjs` + `tests/harness/*.py`, menos o `conferir.py`).
  Teste novo não precisa ser inscrito em lugar nenhum. A volta inteira leva cerca de 1 minuto e meio nesta máquina.

## Verificação de 30/09 (Claude Code) — item 3
- **O `rodar-tudo.py` não sai todo verde hoje à noite, e não é por causa do item 3.** O `tests/rt-analise.test.mjs` falha em 2
  checagens depois das 21h de Brasília, também no `main`: o `assets/js/rt-analise.js` calcula "hoje" em UTC
  (`new Date().toISOString().slice(0, 10)`), e às 21h de 30/09 em UTC já é 01/10 — a análise técnica da Reforma passa a dizer que
  a janela de setembro fechou, no último dia do prazo. Com o relógio fixado em 30/09 12:00 o teste passa inteiro. Correção sugerida
  (fora desta branch): data local no `rt-analise.js` e `hojeISO` fixo no teste. O padrão `toISOString().slice(0, 10)` aparece em
  ~40 lugares do repositório — vale revisar onde é usado como "hoje".
- **Quando os itens 1 e 2 forem publicados**, vale pôr na tabela do `tests/harness/README.md` os testes que eles trazem
  (`relatorios-sugestoes.py` e `janelas-esc.py`). O `rodar-tudo.py` já acha os dois sozinho.
