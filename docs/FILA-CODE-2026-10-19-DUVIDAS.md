# Fila do Claude Code de 19/10 (faxina) — dúvidas, achados e escolhas

> Ver `docs/FILA-CODE-2026-10-19.md`. Nada daqui impediu o trabalho. Na dúvida, ficou a opção que muda menos;
> a decisão final é de quem revisa.

## 1. Análise fiscal — a janela "Gerar tarefas recorrentes"
- **As regras vão num insert só** (uma chamada com a lista), no lugar de um insert por regra dentro do laço. Com o
  insert de tarefa fora do laço, não sobrava motivo pra gravar uma por uma — e assim, se o banco recusar, nenhuma regra
  fica gravada pela metade.
- **A periodicidade da análise é lida sem maiúscula e sem espaço** (`'Trimestral '` vale como `'trimestral'`). Antes
  era comparada como veio; a análise costuma mandar em minúsculas, mas o aviso da trimestral/bimestral não pode depender
  disso. A função `analise-fiscal` não está no repositório pra conferir o formato.
- **O Mês começa vazio**, mesmo quando o prazo da análise diz o mês ("até 31 de março"). Preencher sozinho pelo texto
  mudaria mais do que o item pede (e o teste pede justamente a anual sem mês). Fica a ideia, se quiserem.
- **Dia vazio continua gravando `dia_vencimento` nulo**, como antes (a fila só pediu o mês obrigatório), e 0 ou 45
  também passam (o `min`/`max` do campo não barra sem formulário). O módulo das Tarefas recorrentes recusa salvar sem o dia
  ("Informe o dia (1 a 31)") e mostra "dia ?" pra regra sem ele. Se o `gerar_tarefas_recorrentes` não gera sem o dia,
  vale pôr na janela a mesma trava do mês — não pus porque a fila não pediu e a análise às vezes não traz o dia
  ("último dia útil"), o que obrigaria a pessoa a digitar.
- **`dia_util` não é mandado** (como antes): vale o padrão da coluna no banco.
- **O recado conta o `criadas` do gerador**, que é tudo o que ele criou naquela chamada, de qualquer empresa. A revisão
  achou um caso concreto: a "Nova tarefa recorrente" das telas de tarefas dos setores (`tarefas-engine.js`) grava a regra
  sem chamar o gerador ("nascem de madrugada"); se a Thalia gravar na Análise à tarde, o recado conta a tarefa daquela
  regra como se fosse desta empresa. A fila pediu esse número; ficou assim. Se quiserem o número exato: gravar com
  `.insert(regras).select('id')` e, depois do gerador, contar as tarefas com `regra_id` nesses ids. Quando ele cria tantas
  quantas ou mais que as regras, o fim do recado vira "as próximas nascem perto do vencimento" (em vez de "as outras").
- **Se o gerador der erro**, as regras já estão gravadas: o recado diz quantas e que as tarefas nascem sozinhas (o
  pg_cron diário), com o erro entre parênteses.
- **Revisão (duas lentes, com verificação):** confirmou e eu corrigi (commit `f2824c5`) o duplo clique no "Criar
  tarefas recorrentes", que gravava as regras em dobro e chamava o gerador duas vezes (o botão agora trava enquanto
  grava, como no `rotinas-setor.js` e no `nova-tarefa.js`), e a linha marcada sem o nome, que sumia calada (agora avisa
  e não grava nada). O teste cobre os dois e falha sem a correção (6 regras, gerador chamado 2 vezes).
- **Abrir a janela de novo e confirmar outra vez duplica as regras** (já era assim antes): ela não confere as regras
  ativas da empresa com o mesmo título. Não mexi — seria uma leitura a mais e um aviso novo, fora do item. Se quiserem:
  ler `tarefas_recorrentes` (cliente, setor fiscal, ativas) e deixar de fora, com aviso, o título que já existe. O vigia
  já acusa "tarefas repetidas" quando as tarefas nascem.
- **Responsável**: a lista é o `EQUIPE` de `assets/js/equipe.js`, com a Edna (que não tem login) — como os outros
  selects de responsável.
- **O mock responde `rpc` por `window.__mockRpc` pra tudo**, inclusive o chat do balão (`chat_preparar`, `chat_resumo`…):
  o teste novo só responde o gerador e devolve a lista vazia de sempre pros outros.

## 3. Os cards de Transição e Regularizações
- **Regularizações em aberto = `.neq('status','regularizado').neq('status','sem_acordo')`**, no lugar de
  `.not('status','in','("regularizado","sem_acordo")')`. No banco dá o mesmo (o PostgREST junta os dois filtros com "e";
  status vazio fica de fora nos dois jeitos), mas o banco falso do harness não entende o `not … in` (deixa passar tudo)
  e o teste não conseguiria distinguir. **Achado:** pelo mesmo motivo, o selo da Precificação no harness conta as
  propostas fechadas também ("3 em aberto" nas fotos, com 1 aberta de verdade) — só no banco falso; não mexi (o selo da
  Precificação está em outra obra, e mudar o mock mexeria em outros testes).
- Nenhum dos dois cards estava na lista do `'—'`.

## 4. Os testes em paralelo
- **`HARNESS_SITE` só dentro de `.harness/`**: o `montar_site()` apaga a pasta inteira antes de copiar o site; uma
  variável errada (o repositório, a pasta do usuário) apagaria tudo. Fora de `.harness/`, ele para com o recado.
- **`--um-por-vez` é exatamente o de antes** (sem `HARNESS_SITE`, na `.harness/site`). `--paralelo 1` é o mesmo.
- **Os mais demorados começam primeiro**, pelo tempo da última vez (`.harness/tempos-dos-testes.json`, fora do git;
  teste novo conta como 30 s). Sem isso, um teste de 60 s que caísse no fim esticaria o tempo total.
- **A linha `Tempo:`** entra logo antes do `Resumo:`, que continua sendo a última linha, igual.
- **A lista `SOZINHOS` ficou vazia**: nas 3 rodadas seguidas em paralelo (4 ao mesmo tempo, na máquina de 4 núcleos),
  os 57 testes passaram todas as vezes — 289 s, 234 s e 222 s (a primeira sem os tempos guardados; as outras já começando
  pelos mais demorados). Nenhum teste precisou trocar espera fixa por esperar a condição.
- **Tempo de cada teste sobe em paralelo** (a soma foi de 785 s um por vez pra 886–1093 s com 4 juntos — a máquina
  fica dividida), mas o total cai pra menos de um terço. O padrão é 4 porque a máquina tem 4 núcleos; com mais
  (`--paralelo 6`) não testei — com a máquina mais ocupada, as esperas fixas curtas dos testes de tela é que apertam.
