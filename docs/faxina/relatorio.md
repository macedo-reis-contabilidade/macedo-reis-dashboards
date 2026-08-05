# Faxina técnica — varredura de referências mortas (04/08/2026)

Auditoria completa das 58 páginas HTML + 4 JS compartilhados do sistema, atrás de:
funções nunca chamadas, `getElementById` de ids inexistentes, listeners órfãos,
referências obsoletas (ex.: questão E3 na precificação), CSS morto e `console.log` esquecido.

## Método

- **Sintaxe**: todos os 63 blocos `<script>` inline + os 4 arquivos de `assets/js/` passaram
  por parse estrito com **acorn** (equivalente ao `node --check`; a máquina não tem Node —
  recomendação: `winget install OpenJS.NodeJS.LTS`). **Zero erros, antes e depois das mudanças.**
- **Análise**: pré-filtro determinístico (ids referenciados × declarados; funções × contagem de
  referências) + 18 agentes de análise cobrindo todas as páginas.
- **Verificação adversarial**: cada achado passou por um verificador independente instruído a
  REFUTÁ-LO (procurando uso via `onclick` em template string, `window.*`, ids montados
  dinamicamente, uso cruzado entre páginas). **100 achados → 99 confirmados, 0 refutados,
  1 incerto.** Um crítico de completude fez a passada final (páginas órfãs, irmãs esquecidas).
- Detalhes: [achados-verificados.json](achados-verificados.json) (os 100, com veredito e
  evidência) e [critica-completude.md](critica-completude.md).

## O que estava limpo

- **console.log / debugger / alert de debug: zero** no repo (só `console.error/warn`
  legítimos em `catch`).
- Nenhum arquivo de `assets/js/` órfão; nenhum `<a href>` quebrado além dos `../` do
  `editar.html` raiz (ver pendências).

## Correções aplicadas (19 commits)

Só o que era comprovadamente seguro; módulo Reuniões (congelado) não foi tocado.

| Commit | Tema |
|---|---|
| `b189258` | Precificação: motor não consulta mais a questão E3 (desativada; grupo p14 vazio no banco — multiplicador era sempre 1, sem efeito em nenhum registro) |
| `1714a18` | Precificação: função `meiPreset` morta + CSS `.badge-hoje` sem uso |
| `80543ee` | utils.js: 6 helpers que nenhuma página importa |
| `92a5cce` | Tarefas por setor: `statusCls` morta (6 páginas) + CSS órfão do template |
| `b06c7a9` | `GESTAO_ADMINS` copiada sem uso (index, setores, administracao) |
| `36693eb` | Hubs: referência a card de regras inexistente + parâmetro morto no fiscal |
| `271702f` | Agenda: CSS do carrossel antigo, `PRIO_LABEL`, `resumoTimer`, listener vazio |
| `1af39d8` | Editor de clientes: `ASS2_LINHA`/`ASS2_SUB` (resquício dos .docx) |
| `f306e80` | Editor legado (raiz): listener duplicado no tipo de processo |
| `fc74683` | Cadastro novo: mensagem de sucesso que nunca aparecia |
| `4f8680a` | Carteira: parâmetro morto em `barras()`, zebra do PDF sem efeito, CSS morto |
| `dbe13b8` | Boletos: marcador `_new` write-only + CSS de abas |
| `0f54de9` | Análise fiscal: simplifica `operacoes` (coluna inexistente; comportamento idêntico) |
| `c8e02fe` | Alvarás: CSS de abas e pills sem uso |
| `a65558f` | Agenda: histórico registra 'Aguardando terceiro'/'Bloqueada' (antes 'undefined') |
| `94b4ef7` | CSS morto em massa: 146 linhas em 22 páginas |
| `a260146` | Avatar do topo: inicial do usuário em todas as páginas (11 corrigidas) |
| `7c6bb47` | Ajuda: card de novidades + avatar + CSS morto |
| `bb5e0e8` | Relatórios: estado vazio cita o setor da própria página (dizia 'fiscal' em todos) |

## Pendências (achadas e NÃO corrigidas — decisão do Samuel)

1. **🐛 Bug real — cadastro novo** (`clientes/novo.html` ~l.606): insert de sócios manda
   `participacao`/`admin`, mas as colunas são `participacao_percentual`/`eh_administrador` —
   **o sócio não salva** no fluxo de cadastro novo, e o `error` do insert não é capturado.
2. **Páginas órfãs**: `fiscal-regras.html`, `financeiro-regras.html` e `societario-regras.html`
   não têm nenhum link de entrada (só por URL digitada). Relacionado: `gerarTarefasDoMes`
   existe em `fiscal-tarefas.html` mas o botão `#btnGerarMes` que as 5 irmãs têm não está lá.
3. **`editar.html` raiz** usa caminhos `../` (única página da raiz assim) — funciona porque o
   site é servido na raiz do domínio, quebraria em subcaminho. Normalizar na obra de unificação.
   Também: `SUGESTOES` sem a chave `'TRANSFORMAÇÃO'` (o editor oficial tem).
4. **Ctrl+P imprime em branco** em `dp-custo.html` e `dp-pareceres.html`: `@media print`
   aponta pra `#reportArea` nunca populado (feature abandonada; o PDF real sai via popup).
5. **Boletos**: competência inicial hardcoded `value="2026-05"`; `itens_extras` gravado sem UI.
6. **Análise fiscal**: payload consulta `cnaes`/`porte`/`faturamento_12m`, colunas inexistentes
   (reais: `cnae_principal`, `cnaes_secundarios`, `porte_empresa`) — o agente recebe `null`.
7. Menores: badge de transição no hub comercial fica no spinner; badge `origem==='analise'`
   inalcançável nas 6 páginas de regras; empty-state do societário-tarefas cita botão
   inexistente; `TITULOS.p14` sobrou na precificação; classe `chip` inexistente na agenda;
   `docStatus` vazio no cadastro novo; subnav das regras aponta "Tarefas" pro hub.
8. **Módulo Reuniões (congelado)**: 3 achados registrados (`setorLabel`, `usuarioEmail`,
   CSS `fa-subnav`) — de propósito, nada foi tocado.

**Migrations: nenhuma necessária.**
