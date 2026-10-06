# Testes (sem login, sem Supabase, sem npm)

Pré-requisito, uma vez: `pip install playwright` e `python -m playwright install chromium`.

## Antes de entregar, rode tudo

```
python tests/rodar-tudo.py
```

Roda sozinho todos os `tests/*.test.mjs` (no node) e todos os testes de comportamento em
`tests/harness/*.py` (no Chromium), e imprime um resumo `teste → ok/falhou`. Sai com código 1 se algum falhar,
e aí mostra a saída inteira do que quebrou. Teste novo não precisa ser inscrito em lugar nenhum: basta o
arquivo estar na pasta. O `conferir.py` fica de fora — é ferramenta, não teste.

## Fotografar telas (ferramenta)

```
python tests/harness/conferir.py fiscal-reforma.html comercial-precificacao.html
```

Fotografa cada tela nos temas escuro e claro em `.harness/fotos/` e lista os erros de JavaScript.
Serve pra conferir à vista e pra provar que uma mudança não mexeu no visual (fotografe antes e depois e
compare pixel a pixel). Detalhes do trabalho de tema: `docs/TEMA-CLARO-CODE.md`.

## O banco falso

`supabase.mock.js` entra no lugar de `assets/js/supabase.js` na cópia do site (`.harness/site`, fora do git).
Os dados são todos inventados — **nada de cliente**, que este repositório é público. Dá pra acrescentar dados
inventados quando um teste precisar; os testes leem o banco falso por `window.__mockDb`.

## O que cada teste cobre

| Teste | Cobre |
|---|---|
| `agenda-lateral.py` | a lateral da Agenda em telas largas: sem Atalhos, Radar à direita e a Agenda usando a largura até ele, sem encostar |
| `data-local.py` | o "hoje" no fuso de Brasília (`hojeLocal`/`dataLocal` do `assets/js/utils.js`): às 22h30 de 30/09, quando o UTC já é 01/10, seis telas gravam e comparam 30/09 |
| `importar-xml.py` | o parser de notas (`assets/js/importar-xml.js`): NF-e, evento de cancelamento, NFS-e nacional, descontos, CNPJ alfanumérico na chave e nos documentos, XML mal formado. Roda no navegador porque o Node não tem `DOMParser` |
| `lote-setores.py` | concluir e registrar andamento em lote nas telas de tarefas dos setores |
| `obrigacoes-responsavel.py` | responsável obrigatório no vínculo de obrigação fiscal |
| `rotinas-setor.py` | o módulo único de tarefas recorrentes por setor (`assets/js/rotinas-setor.js`) |
| `rotinas-excluir.py` | excluir rotina nas Tarefas recorrentes só depois de desvincular as empresas (`assets/js/rotinas-setor.js`) |
| `rotinas-tres-setores.py` | as Tarefas recorrentes do Fiscal, do Comercial e do Societário (páginas finas do módulo): cada tela com o seu setor, a equipe na ordem certa e o card no hub |
| `obrigacoes-mes-concluido.py` | Obrigações fiscais: obrigação com o mês todo concluído não some do filtro "Pendentes do mês" |
| `proposta-transicao.py` | Precificação: proposta fechada pergunta pela transição (aba Propostas) |
| `relatorios-sugestoes.py` | os módulos únicos de Relatórios e Sugestões de melhoria (`assets/js/relatorios-setor.js`, `assets/js/sugestoes-setor.js`): cada tela mostra o seu setor e só os seus dados |
| `carteira-analise.py` | Carteira de clientes: a Análise mostra todos os municípios (antes cortava nos 8 maiores), o MEI aparece sem o CPF do nome oficial na lista, no PDF e no Excel, e o CNPJ sai formatado no Excel (jsPDF e SheetJS entram como dublês — o teste não depende do CDN) |
| `cadastro-socios.py` | Novo cliente pelo contrato social (`clientes/novo.html`): os sócios são gravados com RG, nascimento, estado civil, nacionalidade, profissão e endereço residencial (antes só nome, CPF e participação, e o kit de boas-vindas nascia pedindo esses dados); o aviso da leitura diz o que faltou de cada sócio; data em dd/mm/aaaa vira aaaa-mm-dd e data impossível ou participação ilegível ficam vazias em vez de derrubar a gravação; CNPJ alfanumérico é mascarado com letras, validado e gravado com elas. A leitura do contrato (Edge Function) entra como dublê, por `window.__mockInvoke` |
| `reforma-situacao.py` | Reforma Tributária (`fiscal-reforma.html`): depois de gravada a simulação, a lista e a ficha mostram o resultado da conta (por dentro, por fora, empate) no lugar da triagem por CNAE, que fica no título do chip; o filtro usa o mesmo valor que aparece; o simulador usa a CBS de 2027 (referência − 0,1 ponto), sobe o DAS por dentro com o fim do monofásico e mostra o resultado sem o crédito de estoque; "Refazer simulações" recalcula as gravadas, troca o fundamento automático antigo, deixa de fora (com o motivo) as que não dá pra recalcular e não regrava o que já está atualizado. Os casos inventados entram no banco falso por uma armadilha em `window.__mockDb`, só nesta página |
| `admissoes.py` | módulo Admissões do DP (`dp-admissoes.html`) e o link único que a empresa preenche (`admissao.html`), na lógica do forms da precificação: a primeira abertura grava o formulário do PDF; a caixa do link copia e abre o WhatsApp; contagem por situação, empresa cujo nome não bateu "não vinculada" e vínculo pela busca, respostas da empresa sempre como texto (nunca HTML), quem enviou, pasta e arquivos do Drive, documentos recebidos e situação mudada pela lista; editor do formulário (quem recebe na agenda obrigatório, e-mail, pergunta nova, pergunta sem texto barrada) e prévia; no link, só empresa e quem preenche (sem CNPJ nem WhatsApp), anexos e e-mail nas listas de documentos, obrigatórios barrados, envio com empresa/contato, respostas e anexos (abertos no Drive e mandados em partes de 2 MB), "Enviar outro funcionário", e os avisos de anexo que não sobe, formulário indisponível e muitos envios. A Edge Function `admissao-link` entra como dublê, por `window.__mockInvoke` |
| `rescisoes.py` | módulo Rescisões do DP (`dp-rescisoes.html`) e o link único que a empresa preenche (`rescisao.html`), na lógica das admissões: a primeira abertura grava os textos do formulário; a caixa do link copia e abre o WhatsApp; contagem por situação, "venceu" no pagamento vencido, empresa cujo nome não bateu "não vinculada", o caso na lista, respostas da empresa sempre como texto (nunca HTML), datas da ficha pela mesma conta do link, caso mudado na ficha regravando as datas, vínculo pela busca e situação pela lista; aba dos textos (quem recebe obrigatório) e prévia; a tarefa da agenda levando pra ficha; no link, os "se" (pedido de demissão → cumpre o aviso ou desligamento imediato; demissão pela empresa → data da comunicação e aviso; contrato de experiência → quem quer encerrar, admissão, prazo e último dia, com o fim do período, a indenização do art. 479 quando a empresa encerra antes, a do art. 480 com a pergunta do desconto quando o funcionário sai antes e o aviso de "passou de 90 dias"), as datas na hora com o 10º dia antecipado em domingo/feriado, prazo vencido avisado, obrigatórios barrados, envio só do ramo respondido, mensagem final com a data do pagamento e "Enviar outra rescisão". A Edge Function `rescisao-link` entra como dublê, por `window.__mockInvoke`. A conta das datas tem teste próprio em `tests/rescisao-datas.test.mjs`, e `tests/rescisao-link.test.mjs` confere que a regra da empresa pelo nome é a mesma do `admissao-link` |
| `janelas-esc.py` | janelas por cima da barra do topo em tela baixa e Esc fechando a janela aberta (`assets/js/janelas.js`) |
