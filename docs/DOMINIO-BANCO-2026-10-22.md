# O banco do Domínio pelas fontes públicas — rascunho de 22/10/2026

Pesquisa só de leitura, em fontes públicas, feita enquanto a Domínio libera o acesso ao banco do Domínio Web
(chamado 4565919). **Nada aqui foi rodado num banco de verdade**: são rascunhos pra conferir com a documentação oficial
das tabelas, que vem na liberação. Nenhuma das fontes usa o Domínio Web (são bancos locais ou servidores de escritório):
a cópia D-1 pode ter diferenças.

Os exemplos usam setembro de 2026, com o intervalo meio-aberto (`>= '2026-09-01' AND < '2026-10-01'`). Na ponte
(`ponte/consultas/*.sql`), as datas viram parâmetros `?`.

Conferido à mão em 22/10/2026, por amostra: a versão do banco, o esquema e as colunas de `efsaidas`, `foempregados`,
`forescisoes`, `fobasesserv` e `ctlancto` na F3; as de `geempre` no `00-CADASTROS.ps1` da F3; `stat_emp = 'A'`,
`efservicos` e `VALOR_SERVICOS_SER` na F5; `cgce_emp` na F6.

## Fontes

| Cód. | Fonte | O que traz | Último commit |
|---|---|---|---|
| F1 | https://github.com/Ylaros/Dashboard-Balancetes-Power-BI (pasta `Código M` e `pbit/Dashboard PBI.pbit`) | Power Query: `geempre`, `ctlancto`, `ctcontas`; filtra `stat_emp = 'A'` e tira `orig_lan = 2` | 07/10/2025 |
| F2 | https://github.com/Ylaros/Scripts-SQL-Personalizados-Dominio-SQL-Anywhere/tree/main/Scripts | SQL do Gerador de Relatórios: saídas e entradas (`ddoc_*`), lançamentos, catálogo com `bethadba.autabelas` | 01/08/2025 |
| F2b | https://github.com/Ylaros/Automacao-Relatorio-Geral-de-Notas/tree/main/SQL%20Anywhere | `EFCUPOM_FISCAL_ELETRONICO` (CF-e SAT) | 14/07/2025 |
| F3 | https://github.com/salesgordo0022/imperialBi/blob/main/SCRIPTS/DOCUMENTACAO-TECNICA.md (e os `00-CADASTROS.ps1`, `01-FISCAL.ps1`, `02-FOLHA.ps1`, `03-CONTABIL.ps1` da mesma pasta) | Extração completa de um `contabil.db`: SQL Anywhere 17.0.11.7312, esquema `bethadba`, ~4.800 tabelas, cp1252 | 07/10/2026 |
| F4 | https://github.com/AlexCaladoIntegra/portal-integra-sinc/tree/main/app/data/queries (e `app/importacao/importadores/empresas.py`, `app/fiscal/impostos.py`) | 23 consultas comentadas: saídas, entradas, serviços, apuração, `ctlancto`, `ctparmto`, `geempre` | 06/10/2026 |
| F5 | https://github.com/Renata5207418/Consulta_Ebef/blob/master/database/db_conection.py | `geempre` (`stat_emp`, `njud_emp`), faturamento = saídas + serviços, quadro societário | 01/10/2026 |
| F6 | https://github.com/Renaolol/busca_nfse/blob/main/scripts/dominio_empresa_por_cnpj.py | `cgce_emp` ↔ `codi_emp`, CNPJ só com dígitos | 22/10/2026 |
| F7 | https://github.com/Fernandovini2607/conciliador/blob/main/parser_dominio.py | Particularidades do dialeto, `efentradas`, `ctcontas` | 21/10/2026 |
| F8 | https://github.com/uppiapp/dominio-rea-accounting/blob/master/dominio_fo_schema.json | 413 nomes de tabelas `fo*` (só os nomes; lista parcial) | 21/10/2026 |
| F9 | https://github.com/Lider-LSGP/OCORRENCIAS-MENSAIS/blob/main/core/afastamentos.py e `core/rescisoes.py` | Colunas dos relatórios de afastamentos e rescisões exportados do Domínio, códigos de motivo | 22/09/2026 |
| F10 | https://www.hugoventurini.com.br/post/conectando-o-power-bi-desktop-ou-o-excel-ao-banco-de-dados-sybase | Só a conexão ODBC (driver SQL Anywhere 17; o cliente 16 serve no ODBC) | 06/2023 |
| F11 | Manual da migração do gerenciador para SQL Anywhere 17 (Central de Soluções da Domínio, versão 10.3A-10) | A troca do Sybase pelo SQL Anywhere 17 | sem data |

F1, F2 e F2b são do mesmo autor: contam como uma fonte. F4 copia o projeto "portal-integra", do mesmo autor: uma.

**Confiança:** alta = duas ou mais fontes independentes usando do mesmo jeito; média = uma fonte; baixa = deduzido.

## 0. O comum

- **Banco:** SQL Anywhere 17, esquema `bethadba`, texto em windows-1252 (alta: F3, F4; F5 e F7 usam o driver "SQL
  Anywhere 17").
- **Dialeto:** parâmetros com `?`, `TOP n`, `CURRENT DATE`, `DATEADD`, `ISNULL`, `LIST()`; não há `DATE_TRUNC` (F4,
  F5, F6, F7). CHAR tem largura fixa: `RTRIM` (F4). `DISTINCT` com `ORDER BY` exige os aliases do SELECT, senão erro
  -854 (F7).
- **Desempenho:** agregar no servidor. A F3 mediu ~60 linhas por minuto lendo linha a linha pelo ODBC; consulta que
  devolve uma linha por empresa não tem esse problema.
- **O dicionário dentro do banco:** `bethadba.autabelas` descreve as tabelas (F2, média). É a primeira consulta quando o
  acesso chegar:

```sql
-- 0. Conferir tabelas e colunas antes do resto
SELECT t.table_name, ta.descricao AS apelido, c.column_name
FROM systable t
JOIN syscolumn c ON c.table_id = t.table_id
LEFT JOIN bethadba.autabelas ta ON ta.table_id = t.table_id
WHERE user_name(t.creator) = 'bethadba'
  AND t.table_type = 'BASE'
  AND t.table_name IN ('geempre','efsdoimp','geimposto','foempregados','forescisoes',
                       'foafastamentos','fobasesserv','efsaidas','efentradas',
                       'efservicos','ctlancto','ctparmto')
ORDER BY t.table_name, c.column_id;
```

## 1. Empresas

| Tabela.coluna | Significado | Confiança | Fontes |
|---|---|---|---|
| `geempre.codi_emp` | Código da empresa; a chave em todas as tabelas | alta | F1, F3, F4, F5, F6 |
| `geempre.cgce_emp` | CNPJ ou CPF (11 dígitos = pessoa física); nas bases vistas, só dígitos | alta | F3, F4, F5, F6 |
| `geempre.razao_emp` | Razão social; vazia em cadastro antigo → `nome_emp` | alta | F1, F3, F4 |
| `geempre.nome_emp` | Nome da empresa (a F5 usa como razão social) | alta (existe) / média (sentido) | F3, F4, F5 |
| `fantasia_emp`, `apel_emp` | Fantasia e apelido | média | F4 |
| `geempre.stat_emp` | `'A'` ativa, `'I'` inativa; a F5 cita `'B'`, sem dizer o que é | alta (A/I) / média (B) | F1, F3, F4, F5 |
| `dina_emp`, `dcad_emp` | Provavelmente data de inatividade e de cadastro | baixa | F3 |
| `simples_emp` | Marca de Simples (`'1'` ou `'S'` = sim, sem confirmar) | baixa | F3 |
| `ucxa_emp`, `ufol_emp`, `uefi_emp`, `ucta_emp`… | Marcas de "usa o módulo" (só `ucxa_emp`, livro caixa, confirmada) | baixa | F3 |
| `njud_emp` → `genatjuridica.codigo/descricao` | Natureza jurídica (2127 = SCP) | média | F5 |
| Matriz e filial | Cada CNPJ é um `codi_emp`; sem vínculo entre eles — agrupar pela raiz de 8 dígitos | alta | F4, F5 |
| `efsdoimp` (`codi_emp`, `codi_imp`, `data_sim` = competência, `pdic_sim`, `sdev_sim` = a recolher, `bcal_sim`) | Apuração por imposto e competência | alta | F3, F4 |
| `codi_imp` | 44 Simples, 64 MEI, 4/5/6/7 PIS/COFINS/CSLL/IRPJ do Presumido, 17/19 PIS/COFINS não cumulativos, 183 IBS, 184 CBS | média | F4 (a F3 confirma o Simples como `SIMPLESN`) |
| `geimposto` (`codi_emp`, `codi_imp`, `sigl_imp`, `nome_imp`, `codi_sis`) | Impostos da empresa; `codi_sis` 5 = Escrita Fiscal, 6 = Lalur, 12 = Folha | alta (5) / média (resto) | F3, F4 |
| View `EFIMPOSTO` (`CODI_EMP`, `CODI_IMP`, `NOME_IMP`) | Impostos na última vigência, só do fiscal | média | F4 |
| **Regime tributário** | Não há coluna nem tabela achada: deduzir pelos impostos | baixa | — |

```sql
-- 1a. Cadastro
SELECT e.codi_emp,
       REPLACE(REPLACE(REPLACE(RTRIM(e.cgce_emp),'.',''),'/',''),'-','') AS cnpj_cpf,
       RTRIM(COALESCE(NULLIF(RTRIM(e.razao_emp),''), e.nome_emp))        AS razao_social,
       CASE WHEN e.stat_emp = 'A' THEN 1 ELSE 0 END                      AS ativa
FROM bethadba.geempre e
ORDER BY e.codi_emp;

-- 1b. Regime deduzido pelo que a empresa apurou no mês (BAIXA)
SELECT d.codi_emp,
       MAX(CASE WHEN d.codi_imp = 64 THEN 1 ELSE 0 END)          AS apura_mei,
       MAX(CASE WHEN d.codi_imp = 44 THEN 1 ELSE 0 END)          AS apura_simples,
       MAX(CASE WHEN d.codi_imp IN (4,5,6,7) THEN 1 ELSE 0 END)  AS apura_presumido,
       MAX(CASE WHEN d.codi_imp IN (17,19) THEN 1 ELSE 0 END)    AS apura_nao_cumulativo
FROM bethadba.efsdoimp d
WHERE d.data_sim >= '2026-09-01' AND d.data_sim < '2026-10-01'
GROUP BY d.codi_emp;
```

`stat_emp = 'A'` é o cadastro do Domínio, não a carteira do escritório: a ponte manda o `ativa` como informação e o
sistema casa as empresas pelo CNPJ com o cadastro de lá. O regime o sistema já tem no cadastro; a dedução serve só pra
conferir.

## 2. Folha (DP) — só contagens

| Tabela.coluna | Significado | Confiança | Fontes |
|---|---|---|---|
| `foempregados.codi_emp` + `i_empregados` | Chave do empregado (o código se repete entre empresas) | alta | F3, F9 (e F8) |
| `foempregados.admissao` | Data de admissão | média | F3 |
| `foempregados.categoria`, `vinculo` | Existem; sentido não documentado (ver se sócios estão aqui) | média / baixa | F3 |
| `forescisoes.demissao` | Desligamento; complemento de rescisão repete a linha → a menor data por empregado | média | F3, F9 |
| `forescisoes.motivo` | Código sem tabela de descrição: 12/22 fim de contrato, 10/11 experiência antecipada, 5/6/27 transferência, 8/13/14/40/41/42 morte | média | F3, F9 |
| `fobasesserv` (`codi_emp`, `i_empregados`, `competencia`, `dias_servico`, `proventos`) | Bases do cálculo mensal; cada empregado aparece duas vezes na competência, uma com `dias_servico = 0` | média | F3 |
| `foafastamentos` (`data_real`, `data_fim`, `i_afastamentos`) | Afastamentos (colunas vistas num relatório, não no banco) | baixa | F8, F9 |
| Pró-labore | Não achado; candidatos `FOCONTRBASES` (F3, sem colunas) e `focontrrpa` (F8, RPA) | baixa | F3, F8 |

```sql
-- 2a. Ativos no fim do mês, admissões e desligamentos
SELECT e.codi_emp,
       SUM(CASE WHEN e.admissao < '2026-10-01'
                 AND (r.demissao IS NULL OR r.demissao >= '2026-10-01') THEN 1 ELSE 0 END) AS ativos_fim_mes,
       SUM(CASE WHEN e.admissao >= '2026-09-01' AND e.admissao < '2026-10-01' THEN 1 ELSE 0 END) AS admissoes_mes,
       SUM(CASE WHEN r.demissao >= '2026-09-01' AND r.demissao < '2026-10-01' THEN 1 ELSE 0 END) AS desligamentos_mes
FROM bethadba.foempregados e
LEFT JOIN (SELECT codi_emp, i_empregados, MIN(demissao) AS demissao
           FROM bethadba.forescisoes
           GROUP BY codi_emp, i_empregados) r
       ON r.codi_emp = e.codi_emp AND r.i_empregados = e.i_empregados
GROUP BY e.codi_emp;
-- A decidir: transferência (motivo 5/6/27) conta como desligamento?

-- 2b. Afastados no último dia do mês (BAIXA: colunas deduzidas)
SELECT a.codi_emp, COUNT(DISTINCT a.i_empregados) AS afastados_fim_mes
FROM bethadba.foafastamentos a
WHERE a.data_real <= '2026-09-30'
  AND (a.data_fim IS NULL OR a.data_fim >= '2026-09-30')
  AND NOT EXISTS (SELECT 1 FROM bethadba.forescisoes r
                  WHERE r.codi_emp = a.codi_emp AND r.i_empregados = a.i_empregados
                    AND r.demissao <= '2026-09-30')
GROUP BY a.codi_emp;
-- A F9 mostra atestado de até 15 dias também como afastamento.

-- 2c. Pró-labore: achar onde está (catálogo, sem dado pessoal)
SELECT t.table_name, ta.descricao
FROM systable t LEFT JOIN bethadba.autabelas ta ON ta.table_id = t.table_id
WHERE user_name(t.creator) = 'bethadba' AND t.table_type = 'BASE'
  AND (t.table_name LIKE 'focontr%' OR ta.descricao LIKE '%ontribu%' OR ta.descricao LIKE '%labore%');

-- 2d. Conferência: quantos tiveram folha calculada no mês
SELECT codi_emp, COUNT(DISTINCT i_empregados) AS com_folha_calculada
FROM bethadba.fobasesserv
WHERE competencia >= '2026-09-01' AND competencia < '2026-10-01' AND dias_servico > 0
GROUP BY codi_emp;
```

## 3. Fiscal

| Tabela.coluna | Significado | Confiança | Fontes |
|---|---|---|---|
| `efsaidas.codi_emp` + `codi_sai` | Chave da nota de saída | alta | F2, F4 |
| `efsaidas.dsai_sai` | Data de saída (a do mês) | alta | F3, F4 |
| `efsaidas.vcon_sai` | Valor contábil — o que o Domínio mostra como faturamento (`vprod_sai` = só produtos) | alta | F2, F3, F4, F5 |
| `efsaidas.situacao_sai` | 0 = regular (a F3 filtra `= 0`), 2 = cancelada (F4) | alta (coluna) / média (valores) | F2, F3, F4 |
| `efsaidas.cancelada_sai` | `'S'` = cancelada; independente da situação — usar as duas | alta | F3, F4 |
| `efsaidas.codi_nat` + `versao_nat` | CFOP (`versao_nat = 2` = 4 dígitos, `efnatureza`); `codi_acu` acumulador, `codi_esp` espécie | média | F4 |
| `efentradas.codi_ent`, `vcon_ent`, `dent_ent`, `ddoc_ent` | Chave, valor contábil, data de entrada (a da escrituração) e do documento | alta / média | F2, F3, F4, F7 |
| `efentradas.situacao_ent` | 2 = cancelada (não há "cancelada") | média | F4 |
| NFS-e tomada | Em `efentradas`, espécie de modelo 03 | média | F4 |
| `efservicos` (`dser_ser`, `vcon_ser`, `VALOR_SERVICOS_SER`, `situacao_ser`, `cancelada_ser`) | Serviços prestados, tabela à parte, sem CFOP e sem ISS | alta (tabela, valor) / média (resto) | F4, F5 |
| `EFCUPOM_FISCAL_ELETRONICO` (`DATA_CFE`, `VALOR_TOTAL_CFE`, `SITUACAO`) | CF-e SAT | média | F2b |

```sql
-- 3a. Saídas no mês
SELECT s.codi_emp, COUNT(*) AS notas_saida,
       SUM(CASE WHEN s.cancelada_sai = 'S' OR s.situacao_sai = 2 THEN 0 ELSE ISNULL(s.vcon_sai,0) END) AS valor_saidas
FROM bethadba.efsaidas s
WHERE s.dsai_sai >= '2026-09-01' AND s.dsai_sai < '2026-10-01'
GROUP BY s.codi_emp;

-- 3b. Entradas no mês (dent_ent; ddoc_ent se o critério for a emissão)
SELECT e.codi_emp, COUNT(*) AS notas_entrada,
       SUM(CASE WHEN e.situacao_ent = 2 THEN 0 ELSE ISNULL(e.vcon_ent,0) END) AS valor_entradas
FROM bethadba.efentradas e
WHERE e.dent_ent >= '2026-09-01' AND e.dent_ent < '2026-10-01'
GROUP BY e.codi_emp;

-- 3c. Faturamento do mês = saídas válidas + serviços válidos
SELECT g.codi_emp,
       ISNULL(sa.valor,0) AS fat_mercadorias,
       ISNULL(se.valor,0) AS fat_servicos,
       ISNULL(sa.valor,0) + ISNULL(se.valor,0) AS faturamento_bruto
FROM bethadba.geempre g
LEFT JOIN (SELECT codi_emp, SUM(vcon_sai) AS valor FROM bethadba.efsaidas
           WHERE dsai_sai >= '2026-09-01' AND dsai_sai < '2026-10-01'
             AND ISNULL(cancelada_sai,'N') <> 'S' AND ISNULL(situacao_sai,0) <> 2
           GROUP BY codi_emp) sa ON sa.codi_emp = g.codi_emp
LEFT JOIN (SELECT codi_emp, SUM(VALOR_SERVICOS_SER) AS valor FROM bethadba.efservicos
           WHERE dser_ser >= '2026-09-01' AND dser_ser < '2026-10-01'
             AND ISNULL(cancelada_ser,'N') <> 'S' AND ISNULL(situacao_ser,0) <> 2
           GROUP BY codi_emp) se ON se.codi_emp = g.codi_emp;

-- 3d. Calibrar com o relatório de faturamento do Domínio: o mesmo valor aberto por CFOP, numa empresa
SELECT s.codi_nat AS cfop, s.versao_nat, COUNT(*) AS notas, SUM(s.vcon_sai) AS valor
FROM bethadba.efsaidas s
WHERE s.codi_emp = ? AND s.dsai_sai >= '2026-09-01' AND s.dsai_sai < '2026-10-01'
  AND ISNULL(s.cancelada_sai,'N') <> 'S' AND ISNULL(s.situacao_sai,0) <> 2
GROUP BY s.codi_nat, s.versao_nat
ORDER BY valor DESC;
```

**O faturamento:** somar saídas e serviços é alta (F4 e F5 somam as duas). Divergências: a F5 não tira as canceladas
(a F4 mediu que a cancelada vale R$ 0,00 — muda a contagem, não o valor); a F3 usa só `situacao_sai = 0`, o que pode
tirar complementares e extemporâneas (dedução, baixa). A soma inclui CFOP que não é receita (remessa, devolução de
compra, transferência): a regra "compõe faturamento" do Domínio não foi achada — calibrar com a 3d contra o relatório
do próprio Domínio. No varejo, falta saber se o CF-e SAT também está em `efsaidas`. No Simples, dá pra comparar com
`efsdoimp.bcal_sim` do código 44 (baixa).

## 4. Contábil

| Tabela.coluna | Significado | Confiança | Fontes |
|---|---|---|---|
| `ctlancto.codi_emp` | Empresa; início da chave primária (filtro rápido) | alta | F1, F3, F4 |
| `ctlancto.data_lan`, `vlor_lan` | Data contábil e valor | alta | F1, F3, F4 |
| `ctlancto.cdeb_lan`, `ccre_lan` | Débito e crédito na mesma linha; conta 0 = sem conta naquele lado | alta / média (o 0) | F1, F3, F4 |
| `ctlancto.orig_lan` | Origem; 2 = encerramento (zeramento); 31 valores, os outros sem documentação | alta (o 2) | F1, F4 |
| `ctlancto.nume_lan`, `codi_lote`, `chis_lan`, `codi_usu` | Nº, lote, histórico, operador | alta | F2, F3, F4 |
| Datas digitadas erradas (anos 1979, 8320) | Filtrar o intervalo | média | F3 |
| `ctparmto.fechamento_data` | 1º dia do último mês fechado (2026-05-01 = 05/2026 fechado); pode ser nulo | média | F4 |

```sql
-- 4a. Último lançamento e lançamentos no mês
SELECT l.codi_emp,
       MAX(CASE WHEN ISNULL(l.orig_lan,0) <> 2 THEN l.data_lan END)               AS ultimo_lancamento,
       SUM(CASE WHEN l.data_lan >= '2026-09-01' AND l.data_lan < '2026-10-01'
                 AND ISNULL(l.orig_lan,0) <> 2 THEN 1 ELSE 0 END)                 AS lancamentos_mes,
       COUNT(DISTINCT CASE WHEN l.data_lan >= '2026-09-01' AND l.data_lan < '2026-10-01'
                           THEN l.codi_lote END)                                  AS lotes_mes
FROM bethadba.ctlancto l
WHERE l.data_lan >= '2000-01-01' AND l.data_lan <= CURRENT DATE
GROUP BY l.codi_emp;

-- 4b. Último mês fechado
SELECT p.codi_emp, MAX(p.fechamento_data) AS fechamento_data
FROM bethadba.ctparmto p
GROUP BY p.codi_emp;
```

O encerramento fica fora do "último lançamento": o zeramento é datado em 31/12 e faria a contabilidade parecer em dia.
Lançamento com várias contrapartidas usa a conta 0 num dos lados — por isso linhas e lotes; conferir qual bate com a
contagem da tela do Domínio.

## Diferenças entre versões e bases

1. Data da nota de saída: `dsai_sai` (F3, F4), `ddoc_sai` (F2) ou `DATA_SAIDA` (F5).
2. Data do serviço: `dser_ser` (F4) ou `DATA_SERVICO` (F5) — os nomes longos da F5 seguem o padrão das colunas novas
   (`VALOR_SERVICOS_SER`); conferir na consulta 0.
3. Razão social: `RAZA_EMP` ou `RAZAO_EMP` conforme a versão (F7, sem mostrar onde); F1, F3 e F4 usam `razao_emp`.
4. UF da empresa: `esta_emp` (F3) ou `uf_emp` (F6).
5. CNAE: `cnae_emp` (double, quase vazio); o certo é `i_cnae20`, CHAR(15) (F3).
6. Usuários: `geusuarios` vazia; quem tem é `GESECUSUARIOS` (F3).
7. O Domínio trocou o Sybase pelo SQL Anywhere 17 (F11); o cliente 16 ainda serve no ODBC (F10).
8. Apuração extemporânea: `EFSDOIMP_ESTADUAL_<UF>`, uma tabela por estado (F4).
9. O `CONEXAO_ODBC.md` da F1 lista `eflancam`, `efempresas` e `efbalancete`, que o próprio código do autor não usa:
   descartados.
10. Domínio Web: nenhuma fonte usa. Não dá pra saber daqui se a cópia D-1 tem o mesmo esquema.

## O que não foi achado

- Dicionário oficial público das tabelas.
- Onde está o regime tributário (coluna ou tabela).
- Onde ficam os sócios e o pró-labore.
- As colunas reais de `foafastamentos`.
- O sentido de `stat_emp 'B'`, `dina_emp`, `simples_emp`, `tins_emp`, `categoria`, `vinculo`; os outros valores de
  `orig_lan` e `situacao_sai`; a data de digitação do lançamento (só a contábil).
- A marca "compõe faturamento" do acumulador (`EFACUMULADOR_VIGENCIA` só tem `LANCAR_SOMENTE_SAIDA`, `_SERVICO`,
  `_CFE`, `_REDUCAO_Z` — F2) e a tabela da Redução Z.

**Pra abrir com o login do escritório** (a pesquisa não conseguiu): na Central de Soluções da Domínio, as soluções
3227 (usuário externo), 7 (relação de empregados ativos no Gerador de Relatórios), 7082 e 6465 (relatórios da Folha),
6773 (faturamento), 10237 e 6464 — `https://suporte.dominioatendimento.com/central/faces/solucao.html?codigo=<número>`.

## Quando o acesso chegar

1. Rodar a consulta 0 e comparar com as tabelas acima.
2. Conferir na documentação o regime, o pró-labore e os afastamentos.
3. Escrever os `ponte/consultas/*.sql` com os nomes confirmados, rodar a ponte com `--sem-enviar` e conferir 10
   empresas à mão contra o Domínio (o portão da fase 2 do plano).
