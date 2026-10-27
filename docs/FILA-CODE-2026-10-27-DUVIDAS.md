# Dúvidas da fila de 27/10/2026 — a ponte da Receita pronta neste PC

1. **`tests/harness/agenda-seu-dia.py` no `rodar-tudo`.** Falhou uma vez no conjunto (4 testes ao mesmo tempo),
   esperando o `#sdProximos .sd-dia` ficar visível; rodado sozinho logo em seguida, passou inteiro. Contei como os
   outros testes de tela que esgotam a espera com a máquina carregada: 85 de 85, com ele rodado à parte. Nada de código
   mexido.
2. **A demonstração sem mensagens.** A rodada de demonstração trouxe a Caixa Postal com 0 mensagens: as do cenário do
   Serpro são de 2022, e a primeira leitura de uma empresa só manda as dos últimos 90 dias (a regra do item 4 da fila de
   23/10). O bloco `caixa_postal` foi, vazio, e o `validarPacote` aceitou. Não é erro.
3. **Um 429 do Serpro** na demonstração (o limite de pedidos do ambiente de teste): a ponte esperou 10 s e foi na
   segunda tentativa, como deve.
