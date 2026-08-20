# Garimpo de alvarás no Drive

Varre as pastas das 82 empresas da carteira (ANEXO A embutido no script) em
`CLIENTES ATIVOS` do Google Drive montado em `G:\`, interpreta os documentos de
alvará via API Anthropic (`claude-sonnet-4-20250514`) e gera artefatos locais
para revisão humana. **Nada é gravado no Supabase nem no Drive** — `G:\` é
somente leitura; a única escrita é local (CSV/SQL/log/cache, ignorados pelo git).

## Uso

```powershell
# 1) só o matching empresa→pasta (sem API):
python garimpo.py --dry-run

# 2) garimpo completo (exportar a chave antes; nunca commitar):
$env:ANTHROPIC_API_KEY = '<chave>'
python garimpo.py

# depuração de uma empresa específica:
python garimpo.py --empresa "PIZZARIA ARSENAL"
```

## Saídas (locais, no .gitignore)

- `revisao.csv` — uma linha por documento/ocorrência, separador `;`, UTF-8 BOM
  (abre direto no Excel). `decisao` ∈ `CADASTRAR` / `REVISAR` / `IGNORADO`;
  toda exclusão tem motivo em `flags`+`resumo` (rastreabilidade total).
- `inserts.sql` — só as linhas `CADASTRAR`, na CTE validada no piloto
  (insert em `alvaras` + tarefas de renovação para os com vencimento).
  `link_drive` sai `NULL` de propósito: o Claude web resolve as URLs via MCP na
  execução, usando o `caminho_local` do CSV como chave.
- `resumo.txt` — totais, flags, custo estimado da API e duração.
- `cache.json` — resultado por SHA-256 do arquivo; rerodar não repete chamadas.

## Regras principais

- Pastas `ANTIGOS`/`VENCIDOS` ignoradas; `requerimento/protocolo/boleto/taxa/guia`
  descartados por nome; máx. 8 candidatos por empresa (acima: `muitos_arquivos`).
- Dedup por (empresa, tipo): fica o de validade mais recente (permanente conta
  como mais recente); os demais viram `versao_antiga`.
- `cnpj_divergente`, `vencido`, `tipo_nao_canonico`, `ja_cadastrado`,
  `atualizacao_possivel` → ver briefing; nada é decidido silenciosamente.
- Empresas `FEITA` no ANEXO A são puladas por inteiro.

## Notas de implementação

- Raiz resolvida dinamicamente: `banco de informacoes` → `clientes ativos`
  direto **ou** um nível abaixo (na prática: `ARQUIVO DIGITAL - CLIENTES`).
- Leitura de arquivo com timeout de 60s + 1 retry (Drive em modo streaming).
- API: 1 requisição por vez; backoff 15/30/60s em 429/529/500/503.
- Sem dependências fora da stdlib (a chamada HTTP usa `urllib`).
- `cidade` do insert: a extraída do documento, com fallback pra cidade do cadastro.
