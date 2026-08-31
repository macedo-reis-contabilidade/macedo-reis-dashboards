# Macedo & Reis — Dashboards · Guia pro Claude Code

Sistema interno de gestão do escritório **Macedo & Reis Contabilidade** (Três Coroas/RS).
**Stack:** HTML + JS vanilla multi-página, Supabase (auth + dados), jsPDF pra documentos. **Sem framework, sem build, sem npm** — o que está no repo é o que vai pro ar.
**Deploy:** GitHub Pages, branch `main`, raiz. Build automático a cada push (~30s; cache Fastly — testar com `?nocache=1`).

## Regras de ouro
0. **Início de TODA sessão: rode `git pull` antes de qualquer coisa** — o arquiteto (Claude web) também empurra commits neste repo; trabalhar sem puxar gera conflito.
1. **Páginas são auto-contidas**: HTML + `<script type="module">` no próprio arquivo. CSS compartilhado em `assets/css/style.css`; o client Supabase vem de `assets/js/supabase.js`.
2. **Nunca inventar classe CSS** — conferir se existe no `style.css`; modais novos usam estilo inline (padrão da casa nos módulos recentes).
3. **Selects explícitos**: várias consultas listam colunas uma a uma. Coluna nova no banco **entra nos selects** que alimentam a tela, senão vira feature muda (bug clássico já vivido).
4. **`node --check`** em todo JS mexido (extrair os `<script type="module">` pra um .mjs temporário e checar). Zero `console.log` de debug esquecido.
5. Interface em **pt-BR**, tom direto. Datas `dd/mm/aaaa`; dinheiro `1.234,56`; datas por extenso "3 de Agosto de 2026".
6. **Migrations NÃO são feitas por aqui.** Se a tarefa pedir coluna/tabela nova: parar, implementar o resto, e **listar o SQL necessário no fim da resposta** pro Samuel aplicar via chat web (é o rito da casa). Nunca rodar DDL.
7. **Mudança visível ao usuário = card novo em `ajuda.html`** (seção de novidades, padrão `<div class="hp-item">` com `hp-q` "dd/mm · Título" e `hp-a` corpo; entra no topo da lista).
8. Commits em pt-BR, descrevendo o efeito pro usuário, não o mecanismo.
9. **Nunca commitar tokens/segredos.** O push usa a autenticação git do próprio Samuel.
10. **SEGURANÇA (incidente de 31/08/2026 — lei permanente):** toda tabela nova nasce com `ENABLE ROW LEVEL SECURITY` + policy `TO authenticated` (listar o SQL pro Samuel, regra 6). NUNCA policy para `anon`/`public` além do INSERT do forms público e do SELECT de `precificacao_questoes`. Toda Edge Function nova com `verify_jwt = true`. O cadastro de usuários é bloqueado por gatilho no banco (só `@macedoereis.com.br`) — não criar telas de cadastro/signup.

## Mapa das páginas
- `index.html` — painel central por setor.
- `agenda.html` — agenda unificada: tarefas do dia (modal = editor universal: título, empresa com busca, hora, drag pra ordenar **dentro da faixa de prioridade** — prioridade é soberana), rotinas do dia (check, adiar via clique no card, renomear com autosave, recorrência com conceito de **dia útil**), tarefa rápida com modo 🔁 que cria rotina.
- `clientes/` — `index.html` (listagem "Base mestre"), **`editar.html` (o editor REAL usado pela listagem)**: cadastro, sócios (com RG/endereço/estado civil etc.), credenciais, Registrar processo, **kit de boas-vindas** (3 PDFs jsPDF: contrato, carta, autorização — assinaturas lado a lado com folga GOV.br), `novo.html` (cadastro com extração de documento).
- `editar.html` (RAIZ) — apenas um **redirect** pro editor oficial (preserva `?id=`). A unificação foi concluída em 05/08/2026.
- `comercial-precificacao.html` — questionário (~61 perguntas em `precificacao_questoes`), motor `calcular()` com parâmetros por grupo/chave, camaleão MEI (A4='MEI' esconde bloco D + lista SOME_MEI), orçamento e estudo em jsPDF, **anotações internas `respostas._obs_interna` que NUNCA saem em PDF**, aba MEI própria.
- `comercial-carteira.html` — carteira mensal (`carteira_info`: entrada/saída/segmento/sistemas/contato/ramo/**inadimplente_desde**), marcador 💰/⚠ com destaque vermelho, filtro só-inadimplentes, aba Análise.
- `comercial-reunioes.html` — pautas por setor, **modo ata ao vivo** (`reuniao_pautas.discussao`, autosave 800ms), PDF que vira ata, sincronia com tarefa (`reunioes.tarefa_id`, `hora`). Módulo aprovado — não mexer sem pedido explícito.
- `comercial-transicao.html` — transições entrada/saída/CNPJ novo, kit de tarefas por tipo (`transicao_kit`), sala de guerra (dia X de 90, raias por setor), vínculo N:N `transicao_empresas`, deep-link `?transicao=`.
- `financeiro-boletos.html` — grade mensal (`cobrancas_mensais`), base `cobrancas_config` (decide **quem** é cobrado), **geração copia a última competência** (valores/canais/dia vivos) com fallback da base pra empresa nova, **pula quem tem saída na carteira**, ✕ pergunta "só este mês ou parar de vez".
- Demais `financeiro-*`, `contabil-*`, `dp-*`, `societario*`, `gestao*` — módulos por setor (rotinas, tarefas, controles próprios).
- `ajuda.html` — manual + novidades (manter atualizado, regra 7).

## Banco (Supabase) — tabelas centrais
> ⚠ Resumo de memória: **sempre conferir colunas reais** antes de query nova (o Samuel confere via chat web se precisar).

- `clientes` — nome_principal, nome_fantasia, documento, tipo_pessoa, regime_tributario, endereço completo, cidade/uf, status, drive_folder_id/url.
- `socios` — cliente_id, nome, cpf, participacao_percentual, qualificacao, eh_administrador, telefone, email, rg, endereco_residencial, estado_civil, nacionalidade, profissao, data_nascimento.
- `tarefas` — setor, titulo, descricao, cliente_id, responsavel, prazo, prioridade, status, hora, posicao, transicao_id, proposta_id, origem, concluida_em/por.
- `rotinas` — setor, titulo, periodicidade (diaria/semanal/mensal/anual), dia_semana, dia_mes, dia_anual "MM-DD", **dia_util**, ultima_execucao, adiada_para, ativo, ordem.
- `precificacoes` — cliente_nome, contato, status (aberta/fechada/perdida…), honorario, taxa_unica, respostas (jsonb, inclui `_obs_interna` e campos `*_orcamento`), resultado.
- `precificacao_questoes` / `precificacao_parametros` (grupo, chave, valor, ordem) / `precificacao_obrigacoes`.
- `reunioes` (+hora, tarefa_id) / `reuniao_pautas` (+discussao).
- `transicoes` / `transicao_empresas` / `transicao_kit`.
- `carteira_info` — cliente_id, entrada, saida, segmento, sistemas, contato, ramo, inadimplente_desde.
- `cobrancas_config` — cliente_id, valor_base, dia_vencimento, canal, contato_envio, destino, responsavel, **ativo**.
- `cobrancas_mensais` — cliente_id, competencia 'YYYY-MM', valor, vencimento, canal, contato_envio, destino, responsavel, observacao, status (a_emitir/emitido/enviado/pago), itens_extras.

## Equipe (selects de responsável)
Thalia, Vitória, Adaini, Samuel, Diego, Edna.

## Decisões vigentes (não reabrir sem pedir ao Samuel)
- **Drive é manual** — sem upload automático além do "Registrar processo" existente.
- **Editor de clientes é um só**: `clientes/editar.html` (a raiz redireciona). Sócios editam ali os dados documentais completos (RG, endereço etc.) que o kit consome.
- **Kit de boas-vindas sai em PDF** (jsPDF); os `.docx` em `assets/modelos/` são acervo, fora do fluxo.
- **Prioridade das tarefas é soberana**; drag reordena só dentro da mesma faixa.
- Conteúdo interno (`_obs_interna`, anotações) **nunca** vai pra PDF nenhum.
- Módulo Reuniões está aprovado e congelado ("não vamos mais mexer").
