// ============================================================
// MACEDO & REIS - Edge Function: extract-document
// Recebe documentos em base64 e usa Claude API para extrair
// dados estruturados.
//   - modo "cadastro" (padrão): dados cadastrais de cliente
//   - modo "alvara": dados de controle de alvará/licença
//   - modo "convencao": dados de convenção coletiva (cabeçalho + pisos)
//   - modo "fator_r": série mensal de folha/faturamento/DAS p/ Fator R
// v28 (15/09/2026, Claude web via MCP): socios[] passa a trazer os dados
// pessoais da qualificação do sócio no contrato (RG com órgão expedidor,
// nascimento, estado civil, nacionalidade, profissão, endereço residencial)
// — o kit de boas-vindas e a carta de responsabilidade precisam deles; e o
// titular de empresário individual entra em socios (100%, Titular, admin).
// v29 (21/10/2026, Claude Code, pedido do Samuel — a leitura da alteração da Ind
// Perin pôs como sócio quem tinha vendido todas as cotas no próprio ato): no
// modo cadastro, "socios" é o quadro DEPOIS do ato (a consolidação; sem ela, a
// redistribuição ou as cessões), o preâmbulo só dá os dados pessoais, e quem saiu
// vai em "socios_retirantes" (nome, cpf, motivo) — e a função tira de "socios"
// quem está em "socios_retirantes" e avisa quando as participações não somam 100.
// Aceita também documento em texto (media_type text/plain).
// O código fica no repositório (supabase/functions/extract-document/servidor.ts e quadro.js).
// ============================================================


// v29: a conferência do quadro de sócios depois da leitura (o modelo pode errar; a regra não)
import { conferirQuadro } from "./quadro.js";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `Você é um assistente especializado em extração de dados cadastrais de clientes para um escritório de contabilidade brasileiro.

Sua tarefa é analisar os documentos fornecidos (que podem ser: contrato social, requerimento de empresário, cartão CNPJ, comprovante de inscrição estadual/municipal, RG, CPF, comprovante de endereço, alterações contratuais, etc) e extrair dados cadastrais estruturados.

Retorne APENAS um JSON válido, sem markdown, sem code blocks, sem nenhum texto antes ou depois, no formato exato a seguir:

{
  "tipo_pessoa": "PJ" | "PF" | null,
  "nome_principal": string | null,
  "nome_fantasia": string | null,
  "documento": string | null,
  "email_principal": string | null,
  "telefone_principal": string | null,
  "cep": string | null,
  "logradouro": string | null,
  "numero": string | null,
  "complemento": string | null,
  "bairro": string | null,
  "cidade": string | null,
  "uf": string | null,
  "inscricao_estadual": string | null,
  "inscricao_municipal": string | null,
  "regime_tributario": string | null,
  "cnae_principal": string | null,
  "cnaes_secundarios": string[] | null,
  "data_abertura": string | null,
  "capital_social": number | null,
  "natureza_juridica": string | null,
  "porte_empresa": string | null,
  "rg": string | null,
  "data_nascimento": string | null,
  "profissao": string | null,
  "estado_civil": string | null,
  "nacionalidade": string | null,
  "socios": [
    {
      "nome": string,
      "cpf": string | null,
      "participacao_percentual": number | null,
      "qualificacao": string | null,
      "eh_administrador": boolean,
      "rg": string | null,
      "data_nascimento": string | null,
      "estado_civil": string | null,
      "nacionalidade": string | null,
      "profissao": string | null,
      "endereco_residencial": string | null
    }
  ] | null,
  "socios_retirantes": [
    {
      "nome": string,
      "cpf": string | null,
      "motivo": string | null
    }
  ] | null,
  "confianca": "alta" | "media" | "baixa",
  "observacoes_extracao": string | null
}

REGRAS DE FORMATAÇÃO:
1. "documento" (CNPJ ou CPF): apenas dígitos, sem máscara. Ex: "12345678000190" ou "12345678901"
2. "cep": apenas dígitos. Ex: "95380000"
3. "telefone_principal": apenas dígitos. Ex: "51999998888"
4. Datas: formato ISO YYYY-MM-DD. Ex: "1985-07-15"
5. "uf": sigla de 2 letras maiúsculas. Ex: "RS"
6. "tipo_pessoa": "PJ" se CNPJ (14 dígitos), "PF" se CPF (11 dígitos)
7. "capital_social": número decimal sem formatação. Ex: 100000.00
8. "participacao_percentual": número decimal de 0 a 100. Ex: 50.00
9. "regime_tributario": um destes valores exatos: "Simples Nacional", "Lucro Presumido", "Lucro Real", "MEI", "Imune", "Isento"
10. "porte_empresa": um destes valores exatos: "MEI", "ME", "EPP", "Demais"
11. "cnae_principal": no formato "0000-0/00". Se vier sem barra, mantenha o formato natural do documento
12. Se um campo não estiver claro nos documentos, use null
13. "confianca": "alta" se documentos legíveis e completos, "media" se parcialmente legíveis, "baixa" se difíceis de ler
14. "observacoes_extracao": notas sobre o que não foi possível extrair, qualidade dos documentos, ou avisos importantes (ou null se tudo OK)
15. Nos sócios: "rg" com o órgão expedidor quando constar (ex: "8044796012 SSP-RS"); "data_nascimento" em ISO; "estado_civil" como no documento (ex: "Solteiro", "Casado"); "nacionalidade" como no documento (ex: "Brasileira"); "profissao" como no documento; "endereco_residencial" em texto corrido: logradouro, número, complemento, bairro, cidade - UF, CEP (ex: "Rua Eduardo Willrich, 562, Casa, Centro, Três Coroas - RS, CEP 95660-000")

REGRAS DE INTERPRETAÇÃO:
- QUADRO DE SÓCIOS (a regra mais importante): "socios" são SOMENTE as pessoas que ficam sócias DEPOIS do ato do documento — o quadro que vale a partir dele. Em ALTERAÇÃO CONTRATUAL, o preâmbulo qualifica quem era sócio ANTES da alteração (e quem está entrando): NUNCA copie o preâmbulo como quadro de sócios. Tire o quadro, nesta ordem: (1) da cláusula do capital social na CONSOLIDAÇÃO ("Consolidação contratual", "consolida-se o contrato", "passa a ter a seguinte redação") — a tabela ou lista de quotas por sócio; (2) sem consolidação, da cláusula que redistribui o capital depois da alteração; (3) sem nenhuma das duas, do quadro anterior ajustado pelas cessões, vendas, transferências, retiradas, exclusões, admissões e aumentos ou reduções de capital das cláusulas
- "participacao_percentual": quotas do sócio dividido pelo total de quotas DEPOIS do ato, vezes 100 (ex.: 100.000 de 100.000 quotas = 100). As participações devem somar 100 — se não somarem, explique em observacoes_extracao e use confianca "media" ou "baixa"
- "socios_retirantes": quem DEIXOU de ser sócio no próprio ato — vendeu, cedeu ou transferiu TODAS as suas quotas, retirou-se, foi excluído ou faleceu —, com nome, CPF e "motivo" curto (ex.: "vendeu todas as cotas a FULANO DE TAL", "retirou-se da sociedade"). Essa pessoa NUNCA entra em "socios", mesmo que apareça qualificada no preâmbulo e assine o documento. Quem vendeu só PARTE das quotas continua em "socios", com a participação nova. Sem ninguém saindo, use null
- Dados pessoais de cada sócio (nacionalidade, estado civil, nascimento, RG e órgão expedidor, profissão, endereço residencial): leia da qualificação dele onde ela estiver — normalmente o preâmbulo ("FULANO, nacionalidade BRASILEIRA, Casado, nascido em ..., CPF ..., identidade ..., residente e domiciliado na ...") ou a cláusula que admite o sócio novo — e não confunda o endereço RESIDENCIAL do sócio com o endereço da SEDE da empresa
- Em alteração contratual, TODOS os dados da empresa (nome, sede, capital social, objeto, administração) são os que valem DEPOIS do ato: prefira a consolidação, quando houver
- Contrato social de constituição (sem alteração): os sócios são os do contrato, com as quotas da cláusula do capital
- Empresário individual (requerimento/instrumento de inscrição de empresário): o titular entra em "socios" com participacao_percentual 100, qualificacao "Titular" e eh_administrador true, com os mesmos dados pessoais
- "eh_administrador": true se o sócio é o administrador DEPOIS do ato (a cláusula da administração na consolidação, ou a que nomeia ou destitui o administrador na alteração; no contrato de constituição, quem é nomeado administrador ou assina como Sócio/Administrador). Quem foi destituído ou saiu da sociedade não é administrador
- Cartão CNPJ: extrair regime, CNAEs, data de abertura, porte, natureza jurídica
- RG/CPF de pessoa física: extrair nome, RG, CPF, data nascimento, naturalidade
- Comprovante de endereço: priorizar este pro endereço

IMPORTANTE: Retorne APENAS o JSON puro, sem markdown, sem \`\`\`json, sem explicação. Apenas o objeto JSON.`;

const SYSTEM_PROMPT_ALVARA = `Você é um assistente especializado em ler alvarás e licenças de empresas para um escritório de contabilidade brasileiro (Rio Grande do Sul).

Sua tarefa é analisar o(s) documento(s) fornecido(s) — alvarás/licenças com prazo de validade, como Alvará Sanitário (Vigilância Sanitária), Alvará do Corpo de Bombeiros (no RS chamado APPCI/PPCI/PSPCI; em outros estados AVCB/CLCB), Alvará de Localização, Alvará de Funcionamento, Licença Ambiental, etc — e extrair os dados de controle.

Retorne APENAS um JSON válido, sem markdown, sem code blocks, sem nenhum texto antes ou depois, no formato exato a seguir:

{
  "tipo": string | null,
  "numero": string | null,
  "orgao": string | null,
  "vencimento": string | null,
  "municipio": string | null,
  "empresa": string | null,
  "confianca": "alta" | "media" | "baixa",
  "observacoes_extracao": string | null
}

REGRAS:
1. "tipo": classifique no valor EXATO mais próximo desta lista (copie a string idêntica, com acentos e parênteses):
   - "Alvará de Funcionamento"
   - "Alvará de Localização"
   - "Alvará Sanitário (Vigilância Sanitária)"
   - "Alvará do Corpo de Bombeiros (AVCB)"
   - "Licença Ambiental"
   - "Alvará de Publicidade"
   - "Inscrição Municipal"
   Mapeamentos importantes: APPCI, PPCI, PSPCI, CLCB, "prevenção e proteção contra incêndios" → "Alvará do Corpo de Bombeiros (AVCB)". Vigilância Sanitária / sanitário → "Alvará Sanitário (Vigilância Sanitária)". Se NENHUM valor da lista servir, devolva o nome do documento como aparece (texto livre).
2. "numero": o número do PRÓPRIO alvará (geralmente no título/cabeçalho, ex.: "APPCI Nº 3684" → "3684"). Se houver número de processo/protocolo separado (ex.: PSPCI), NÃO use esse; prefira o número do alvará. Mantenha só o número.
3. "vencimento": data de validade/vencimento no formato ISO YYYY-MM-DD. Procure por "validade", "válido até", "vencimento", "vigência até". Ex.: "O presente Alvará tem validade 15/08/2029" → "2029-08-15". Se o documento não tiver validade (permanente), use null e registre isso em observacoes_extracao.
4. "orgao": órgão emissor por extenso. Ex.: "Corpo de Bombeiros de Taquara (CBMRS)", "Prefeitura Municipal de Três Coroas", "Vigilância Sanitária Municipal".
5. "municipio": cidade do estabelecimento/órgão emissor.
6. "empresa": razão social ou nome do estabelecimento exatamente como consta no documento (serve para localizar o cliente no cadastro).
7. "confianca": "alta" se documento legível e completo, "media" se parcialmente legível, "baixa" se difícil de ler.
8. "observacoes_extracao": avisos relevantes (ex.: validade não encontrada, documento ilegível, mais de um alvará no mesmo arquivo) ou null se tudo OK.
9. Se algum campo não estiver claro, use null. NÃO invente datas nem números.

IMPORTANTE: Retorne APENAS o JSON puro, sem markdown, sem \`\`\`json, sem explicação. Apenas o objeto JSON.`;

const SYSTEM_PROMPT_CONVENCAO = `Você é um assistente especializado em ler Convenções Coletivas de Trabalho (CCT) e Acordos Coletivos brasileiros para um escritório de contabilidade (Rio Grande do Sul).

Sua tarefa é analisar o documento da convenção e extrair o cabeçalho e, principalmente, a TABELA DE PISOS SALARIAIS por função/cargo.

Retorne APENAS um JSON válido, sem markdown, sem blocos de código, sem nenhum texto antes ou depois, no formato exato:

{
  "categoria": string | null,
  "sindicato_laboral": string | null,
  "sindicato_patronal": string | null,
  "numero_registro_mte": string | null,
  "abrangencia": string | null,
  "vigencia_inicio": string | null,
  "vigencia_fim": string | null,
  "data_base": string | null,
  "reajuste_percentual": number | null,
  "beneficios": string | null,
  "pisos": [
    {
      "funcao": string,
      "piso_salarial": number | null,
      "jornada": string | null,
      "observacoes": string | null
    }
  ],
  "confianca": "alta" | "media" | "baixa",
  "observacoes_extracao": string | null
}

REGRAS DE FORMATAÇÃO:
1. Datas em ISO YYYY-MM-DD. Ex.: vigência "01/05/2025 a 30/04/2026" vira vigencia_inicio "2025-05-01" e vigencia_fim "2026-04-30".
2. "data_base": apenas o mês da data-base, por extenso. Ex.: "Maio".
3. "reajuste_percentual": número decimal, ponto como separador, sem o símbolo de porcentagem. Ex.: "reajuste de 5,5%" vira 5.5.
4. "piso_salarial": número decimal em reais, ponto como separador decimal, sem "R$" e sem separador de milhar. Ex.: "R$ 1.650,00" vira 1650.00.
5. Se um campo não constar, use null. NÃO invente valores, datas nem números.

REGRAS DE INTERPRETAÇÃO:
6. "categoria": rótulo curto que identifique a categoria/setor e o estado, com base nos sindicatos. Ex.: "Indústria Gráfica - RS", "Comércio Varejista - RS".
7. "sindicato_laboral": sindicato dos empregados (trabalhadores). "sindicato_patronal": sindicato patronal (empregadores).
8. "numero_registro_mte": número de registro da convenção no MTE / Sistema Mediador (ex.: "MR012345/2025" ou "RS000123/2025"), se constar.
9. "abrangencia": base territorial / municípios abrangidos pela convenção.
10. "beneficios": resumo curto e objetivo dos principais benefícios (vale-alimentação/refeição e valores, vale-transporte, PLR, adicionais, plano de saúde, etc.), em texto corrido.
11. PISOS é o mais importante: localize a cláusula de pisos (geralmente "Salário Normativo", "Piso Salarial", "Salário de Ingresso" ou "Admissão", ou tabela em anexo) e extraia TODAS as funções/cargos com seus respectivos pisos.
    - Uma linha por função. Use o nome da função EXATAMENTE como aparece na convenção.
    - "jornada": se o piso estiver vinculado a uma jornada específica (ex.: "44 horas semanais", "220 horas mensais"), registre; senão null.
    - "observacoes": condição que afete aquele piso (ex.: "nos primeiros 90 dias", "após 90 dias", "para empresas com até X empregados"); senão null.
    - Se a convenção tiver um piso único geral, devolva uma linha com funcao "Piso da categoria".
12. "confianca": "alta" se o documento estiver legível e a tabela de pisos clara; "media" se parcialmente legível; "baixa" se difícil de ler ou se os pisos não estiverem claros.
13. "observacoes_extracao": avisos relevantes (ex.: pisos não localizados, documento ilegível, tabela truncada, mais de uma categoria no mesmo arquivo) ou null se tudo OK.

IMPORTANTE: Retorne APENAS o objeto JSON puro, sem markdown e sem explicação.`;

const SYSTEM_PROMPT_FATOR_R = `Você é um assistente especializado em ler relatórios contábeis e fiscais brasileiros (sistema Domínio/Thomson Reuters, PGDAS-D e similares) para alimentar o cálculo do Fator R do Simples Nacional em um escritório de contabilidade.

Você pode receber UM OU MAIS documentos na mesma solicitação — o procedimento padrão do escritório envia TRÊS juntos: (a) extrato/resumo de FOLHA DE PAGAMENTO por competência (rubricas abertas: salários, pró-labore, FGTS, 13º); (b) relatório de FATURAMENTO/receita bruta por competência; (c) relatório "SIMPLES NACIONAL - ANEXO" da Domínio ou extrato/declaração do PGDAS-D (receitas, folha oficial e INSS/CPP). Consolide TUDO numa única resposta, respeitando a HIERARQUIA DE FONTES (regra J). Cada documento pode cobrir um ou vários meses.

Extraia as séries mensais e retorne APENAS um JSON válido, sem markdown, sem code blocks, sem nenhum texto antes ou depois, no formato exato:

{
  "tipo": "folha" | "faturamento" | "simples" | "misto" | "desconhecido",
  "empresa": string | null,
  "meses": [
    {
      "competencia": "YYYY-MM",
      "receita": number | null,
      "folha_salarios": number | null,
      "prolabore": number | null,
      "inss_patronal": number | null,
      "fgts": number | null,
      "folha_outros": number | null
    }
  ],
  "meses_caixa": [
    {
      "competencia": "YYYY-MM",
      "folha_salarios": number | null,
      "prolabore": number | null,
      "inss_patronal": number | null,
      "fgts": number | null,
      "folha_outros": number | null
    }
  ] | null,
  "confianca": "alta" | "media" | "baixa",
  "avisos": string[] | null
}

DIFERENÇA ENTRE AS DUAS LISTAS (essencial):
- "meses": valores rotulados pela COMPETÊNCIA DE REFERÊNCIA (o mês/PA a que o valor se refere). O sistema aplica depois o ajuste de regime de caixa (folha e encargos da competência M são pagos em M+1). É o caso de QUASE TUDO: extrato de folha da Domínio por competência; receitas por competência; CPP da repartição do DAS na competência do PA; e TODAS as tabelas do PGDAS ("Receitas Brutas Anteriores", "Folha de Salários Anteriores") e do relatório "Simples Nacional - Anexo" da Domínio ("Valor da Folha", "INSS/CPP") — essas tabelas são rotuladas pela competência/PA, NÃO pelo mês de pagamento.
- "meses_caixa": SOMENTE valores que o documento expressa explicitamente pelo mês do PAGAMENTO efetivo — ex.: relatório de guias pagas com data de pagamento, GPS quitada, comprovante de recolhimento. Entram direto no mês indicado, sem deslocamento. Na dúvida, use "meses".
Nunca coloque o mesmo valor nas duas listas.

REGRAS PARA DOCUMENTOS DO SIMPLES:
A. "Receita Bruta do PA (RPA) - Competência" → receita do PA, em "meses".
B. Seção "Receitas Brutas Anteriores" do PGDAS → receita mensal em "meses", SOMANDO Mercado Interno + Mercado Externo do mesmo mês.
C. Seção "Folha de Salários Anteriores" do PGDAS → "folha_salarios" em "meses", SEM decompor — o valor de cada mês é a folha informada POR COMPETÊNCIA (remuneração do mês + CPP do PA do mês); o sistema desloca para o mês do pagamento. Registre em avisos que é a folha oficial do PGDAS. Sujeita à hierarquia da regra J.
D. INSS/CPP da repartição do débito do PA → "inss_patronal" em "meses", na competência do PA. NÃO lance os demais tributos do DAS (IRPJ, CSLL, PIS, COFINS, ICMS, IPI, ISS) em nenhum campo. Se não houver repartição por tributo (só o total do DAS), NÃO estime a CPP: deixe null e avise.
E. NUNCA use valores ACUMULADOS ou linhas de "Total" como valor mensal: RBT12, RBT12p, RBA, RBAA, totais de 12 meses, limites e sublimites NÃO são receita mensal.
F. Extrato, declaração e recibo do MESMO PA repetem os mesmos números: registre cada valor UMA única vez (consolidar ≠ somar em dobro).
G. Se o documento indicar que o DAS não foi pago ou foi pago em atraso, registre em avisos.
H. RELATÓRIO "SIMPLES NACIONAL - ANEXO" DA DOMÍNIO (título com período, tabela "Receita Bruta Acumulada" por mês e tabela "Valor da Folha nos últimos 12 meses" com colunas Valor da Folha e INSS/CPP) — as duas tabelas são rotuladas pela COMPETÊNCIA/PA:
   (i) receitas mensais → "receita" em "meses", SOMANDO as colunas de receita do mesmo mês (ex.: "exceto exportação" + "exportação");
   (ii) "Valor da Folha" de cada mês → "folha_salarios" em "meses" — EXCETO quando houver extrato de folha por competência na mesma solicitação (regra J: nesse caso, ignore o Valor da Folha);
   (iii) "INSS/CPP" de cada mês → "inss_patronal" em "meses", na competência do PA — é a CPP apurada sobre a receita DAQUELE PA (paga no DAS do mês seguinte; o deslocamento é do sistema), NÃO confundir com a retenção de 11% do sócio; aproveite-a SEMPRE, mesmo quando o Valor da Folha for ignorado.
   Ignore as linhas de Total.
I. Se receber, na MESMA solicitação, o PGDAS e o relatório da Domínio cobrindo o MESMO período: use APENAS UMA fonte para folha/CPP — prefira a DECOMPOSTA da Domínio (Valor da Folha + INSS/CPP) e NÃO lance também a folha oficial total do PGDAS, senão o valor duplica. Registre a escolha em avisos. As receitas idênticas das duas fontes registram-se uma vez só.
J. HIERARQUIA DE FONTES (quando vários documentos da mesma empresa chegam juntos, cada informação sai de UMA única fonte):
   - FOLHA (salários, pró-labore, FGTS, 13º): a melhor fonte é o extrato/resumo de folha por competência (rubricas abertas) → "meses". Quando ele estiver presente, NÃO lance o "Valor da Folha" do relatório Simples Nacional - Anexo nem a "Folha de Salários Anteriores" do PGDAS para os mesmos meses — são o MESMO dinheiro em forma de total e duplicariam a folha. Sem extrato de folha, use o "Valor da Folha" do relatório da Domínio (em "meses"); em último caso, a folha oficial do PGDAS (em "meses").
   - CPP: a coluna "INSS/CPP" do relatório Simples Nacional - Anexo é a melhor fonte (mensal, por competência do PA) → sempre aproveite-a em "meses". Sem ela, use a CPP da repartição do DAS do PA (regra D).
   - RECEITA: relatório de faturamento, receitas do relatório da Domínio e seção 2.2 do PGDAS trazem os mesmos valores — registre cada mês UMA vez. Se divergirem entre si, registre a divergência em avisos (pode indicar necessidade de retificação).
   Sempre registre em avisos quais fontes foram usadas e quais foram ignoradas por duplicidade.

REGRAS DE MAPEAMENTO (Fator R — Res. CGSN 140/2018, art. 26; folha pelo regime de caixa):
1. "receita": receita bruta auferida na competência (faturamento/vendas/serviços). Só preencha quando o documento trouxer receita.
2. "folha_salarios": remunerações BRUTAS pagas a empregados e trabalhadores avulsos (salários, férias, horas extras, adicionais, comissões). Sempre o valor BRUTO, nunca o líquido.
3. "prolabore": retiradas de pró-labore dos sócios, pelo valor BRUTO (antes da retenção de INSS do sócio).
4. "inss_patronal": SOMENTE a CPP/INSS patronal efetivamente devida/recolhida pela empresa (regras D, H e J acima; GPS patronal; empresa do Anexo IV; CPP claramente destacada como patronal). NÃO somar a parte retida do empregado. ATENÇÃO — folha de pró-labore de empresa do Simples Nacional: rubrica de INSS com valor igual ou próximo a 11% do pró-labore (mesmo que se chame "INSS Empregador", "INSS pró-labore" ou "INSS retido") é a contribuição RETIDA do sócio contribuinte individual — ela JÁ ESTÁ dentro do pró-labore bruto e NÃO deve ser lançada em inss_patronal: deixe null e registre a decisão em "avisos". Empresa do Simples fora do Anexo IV não recolhe patronal em guia separada (a CPP fica dentro do DAS e não aparece no extrato da folha).
5. "fgts": depósitos de FGTS efetivamente recolhidos.
6. "folha_outros": autônomos/contribuintes individuais (RPA) e outras remunerações do trabalho pagas a pessoa física.
7. NÃO incluir: distribuição de lucros, aluguéis, reembolsos de despesas, benefícios descontados (VT/VA), demais tributos do DAS.
8. Se o relatório trouxer apenas um TOTAL de folha sem abertura por rubrica, coloque o total em "folha_salarios" e registre o fato em "avisos".
9. Valores em reais, número decimal com ponto (ex.: 15340.75), sem R$ e sem separador de milhar. Some rubricas da mesma natureza dentro do mesmo mês. Quando o documento trouxer "valor informado" e "valor calculado" para a mesma rubrica, use o VALOR CALCULADO e registre em "avisos".
10. "competencia": o mês/ano EXATAMENTE como consta no documento, formato YYYY-MM. NUNCA desloque a competência para o mês de pagamento — o ajuste de regime de caixa é SEMPRE do sistema, fora daqui. Meses sem nenhum valor: omita. Campos sem valor no mês: null (não zero).
11. 13º SALÁRIO: se houver folha de 13º (competência "13", "13/AAAA" ou "décimo terceiro"), lance os valores em "folha_outros" na competência de DEZEMBRO do ano correspondente (AAAA-12) e registre em "avisos".
12. Se o MESMO mês aparecer em mais de um documento com valores de natureza diferente (ex.: receita num PDF e folha noutro), consolide na MESMA entrada do mês da lista correspondente.
13. "empresa": razão social como consta no cabeçalho. Se os documentos forem de empresas DIFERENTES, registre isso em "avisos".
14. Havendo ambiguidade (rubrica incerta, página ilegível), explique em "avisos". NÃO invente valores. NÃO replique um valor de cabeçalho/rodapé para vários meses: só registre valor em um mês se o documento mostrar aquele valor NAQUELE mês.
15. "confianca": "alta" se legível e sem ambiguidades; "media" se parcial; "baixa" se difícil de ler.

IMPORTANTE: Retorne APENAS o objeto JSON puro, sem markdown, sem \`\`\`json, sem explicação.`;

const SYSTEM_PROMPT_CONSULTA = `Você é um assistente trabalhista de um escritório de contabilidade (Rio Grande do Sul). Você recebe a TABELA DE PISOS de uma convenção coletiva (função e piso) e a DESCRIÇÃO de uma função/atividade informada por um cliente. Sua tarefa é indicar em qual(is) função(ões) da tabela a descrição melhor se enquadra, informar o piso e, se houver salário pretendido, dizer se ele atende ao piso.

Use SOMENTE as funções da tabela fornecida. Não invente funções nem valores. Se a descrição abranger mais de uma função (ex.: produção e atendimento), aponte as candidatas e explique. Se nada se encaixar bem, diga isso e indique a função mais próxima com aderência baixa.

Retorne APENAS um JSON válido, sem markdown, sem blocos de código, sem nenhum texto antes ou depois, no formato exato:

{
  "sugestoes": [
    {
      "funcao": string,
      "piso_salarial": number | null,
      "aderencia": "alta" | "media" | "baixa",
      "justificativa": string
    }
  ],
  "salario_informado": number | null,
  "veredito_salario": string | null,
  "observacoes": string | null
}

REGRAS:
1. "funcao": copie o nome EXATAMENTE como está na tabela.
2. "piso_salarial": o piso daquela função (mesmo número da tabela) ou null.
3. "aderencia": quão bem a descrição corresponde àquela função (alta, media ou baixa).
4. Ordene "sugestoes" da maior para a menor aderência (no máximo 4).
5. "salario_informado": repita o salário pretendido recebido, ou null se não houver.
6. "veredito_salario": havendo salário e ao menos uma função de aderência alta, compare o salário com o piso dessa função e responda "Acima do piso", "No piso" ou "Abaixo do piso (mínimo R$ X,XX)". Se houver mais de uma candidata forte, use como referência o MAIOR piso entre elas e explique. Sem salário informado, use null.
7. "observacoes": alertas úteis ao contador — descrição ambígua entre funções, piso que varia por jornada ou tempo de casa, e ATENÇÃO à vigência caso o contexto indique convenção vencida. null se não houver nada a observar.
8. Lembre que o enquadramento é uma SUGESTÃO; a decisão final é do contador.

IMPORTANTE: Retorne APENAS o objeto JSON puro, sem markdown e sem explicação fora do JSON.`;

const SYSTEM_PROMPT_DOCUMENTO = `Você é um assistente trabalhista de um escritório de contabilidade do Rio Grande do Sul (Brasil). Sua função é redigir documentos profissionais para clientes do Departamento Pessoal, sobre direito do trabalho, CLT e rotinas trabalhistas. O escritório vai revisar e assinar o documento.

Você recebe o TIPO de documento e o ASSUNTO/pergunta. Produza:
- INFORMATIVO: texto didático e acessível, para orientar a empresa cliente (e, quando fizer sentido, seus colaboradores). Linguagem clara, sem juridiquês excessivo, mas correta.
- PARECER: posição técnica do escritório sobre uma questão específica, com estrutura mais formal (assunto/consulta, fundamentação legal, análise e conclusão).

REGRAS OBRIGATÓRIAS:
1. Use a ferramenta de busca para confirmar a legislação VIGENTE (CLT, leis, súmulas e orientações jurisprudenciais do TST) e CHEQUE se os dispositivos citados continuam em vigor. Nunca cite artigo, súmula ou lei revogada ou desatualizada.
2. Fundamente com a norma e o artigo (ex.: artigo da CLT, súmula do TST), de forma objetiva e com as suas próprias palavras. NÃO copie trechos literais de sites ou de terceiros e NÃO inclua links ou URLs no corpo do documento.
3. Seja preciso e honesto sobre o que é regra clara e o que é controvertido. Se um ponto depende de convenção coletiva, de jurisprudência variável ou de interpretação, diga isso expressamente, em vez de afirmar como certo.
4. Não invente números, prazos ou limites. Se a CLT não fixa um limite (por exemplo, número de atestados médicos por ano), explique isso em vez de inventar um número.
5. Estrutura:
   - Comece SEMPRE com uma linha de título em markdown: # Título do documento
   - Desenvolva em seções com subtítulos (##), adequadas ao tipo.
   - INFORMATIVO: contexto, explicação fundamentada, orientação prática e observações.
   - PARECER: assunto/consulta, fundamentação legal, análise, conclusão e ressalvas.
   - Encerre com uma ressalva de que é orientação técnica, sujeita às particularidades do caso concreto, à convenção coletiva aplicável e à legislação vigente na data.
6. Escreva em português do Brasil, em markdown limpo (títulos com #, listas com -, negrito com **). Evite tabelas, salvo quando ajudarem muito.

IMPORTANTE: Responda APENAS com o documento em markdown, começando pela linha do título (#) e seguindo direto para as seções de conteúdo. NÃO inclua cabeçalho de identificação (Cliente, Assunto, Data, "Elaborado por", remetente ou destinatário) nem linha separadora (---) no início: a identificação do escritório e a data são inseridas automaticamente pelo sistema. Não escreva saudação, introdução sua nem comentários fora do documento.`;

const SYSTEM_PROMPT_REVISAO = `Você é um revisor técnico sênior de um escritório de contabilidade (Rio Grande do Sul), especialista em direito do trabalho. Recebe um documento (informativo ou parecer) já redigido e deve REVISÁ-LO criticamente antes de ir ao cliente. Você NÃO reescreve o documento; apenas aponta problemas e pontos a verificar.

Use a ferramenta de busca para conferir se a legislação citada (artigos da CLT, leis, súmulas e OJs do TST) realmente existe e está EM VIGOR. Sinalize como severidade "alta" qualquer citação errada, revogada, desatualizada ou inexistente.

Avalie também:
- Precisão: afirmações apresentadas como certeza que, na verdade, são controversas, dependem de convenção coletiva ou de jurisprudência variável.
- Lacunas: ressalvas ou informações importantes que faltam.
- Clareza: trechos confusos, ambíguos ou com tom inadequado ao destinatário.

Retorne APENAS um JSON válido, sem markdown e sem texto fora dele, no formato exato:
{
  "veredito": "uma frase curta: pode enviar / revisar os pontos abaixo / recomendo refazer",
  "itens": [
    { "severidade": "alta|media|baixa", "categoria": "Citação legal|Precisão|Lacuna|Clareza|Outro", "observacao": "o que está errado ou a verificar, citando o trecho", "sugestao": "como corrigir, curto" }
  ]
}

REGRAS:
1. Seja específico e cite o trecho problemático em "observacao".
2. Severidade "alta" para erros de fundamentação legal; "media" para imprecisões e lacunas relevantes; "baixa" para clareza e estilo.
3. Se o documento estiver correto, retorne "itens": [] e um "veredito" positivo (lembrando que a conferência final é humana).
4. Não invente problemas nem reescreva o documento.

IMPORTANTE: Responda APENAS com o objeto JSON, sem markdown e sem comentários fora dele.`;

const SYSTEM_PROMPT_CORRECAO = `Você é um redator trabalhista de um escritório de contabilidade (Rio Grande do Sul). Recebe um DOCUMENTO já redigido e uma REVISÃO crítica com apontamentos, e deve produzir uma VERSÃO CORRIGIDA do documento que atenda aos apontamentos.

Aplique as correções indicadas na revisão:
- Corrija citações erradas, desatualizadas ou inexistentes. Use a ferramenta de busca para confirmar a legislação vigente e os dispositivos corretos.
- Inclua as ressalvas, súmulas ou informações apontadas como faltantes.
- Ajuste afirmações exageradas ou apresentadas como certeza quando forem controversas.
- Melhore a clareza onde indicado.
- Mantenha o que já estava correto. Preserve o tipo (informativo ou parecer), a estrutura e o nível de linguagem do documento original.

Regras de formatação (iguais às do documento original):
- Comece SEMPRE com o título em markdown: # Título
- NÃO inclua cabeçalho de identificação (Cliente, Assunto, Data, "Elaborado por", remetente/destinatário) nem linha separadora (---) no início.
- Fundamente com a norma e o artigo, em suas próprias palavras, sem copiar trechos literais e sem URLs.
- markdown limpo (## seções, - listas, ** negrito).

IMPORTANTE: Responda APENAS com o documento corrigido em markdown, começando pela linha do título (#). Não comente as mudanças, não inclua cabeçalho nem texto fora do documento.`;

interface DocumentInput {
  media_type: string;
  data: string;
  filename?: string;
}

// Quem chama (24/10/2026): só quem entrou no sistema com e-mail do escritório — ou o próprio servidor, com a chave de
// servidor. O verify_jwt sozinho deixa passar a chave anônima, que é pública (está nas páginas e no repositório): sem
// esta conferência, qualquer um na internet chamaria esta função. A mesma em todas as funções internas — o teste
// tests/funcoes-login.test.mjs confere.
async function quemChama(req: Request): Promise<string | null> {
  const m = /^Bearer\s+(\S+)/i.exec(req.headers.get("authorization") || "");
  const jwt = m ? m[1] : "";
  if (!jwt) return null;
  const servidor = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (servidor && jwt === servidor) return "servidor";
  try {
    const r = await fetch((Deno.env.get("SUPABASE_URL") || "") + "/auth/v1/user", {
      headers: { apikey: Deno.env.get("SUPABASE_ANON_KEY") || servidor, Authorization: "Bearer " + jwt },
    });
    if (!r.ok) return null;
    const u = await r.json().catch(() => null);
    const email = String((u && u.email) || "").toLowerCase();
    return email.endsWith("@macedoereis.com.br") ? email : null;
  } catch (_e) {
    return null;
  }
}

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
  };
}

// o atendimento: o index.ts (o que é implantado) importa daqui, no commit fixado, e passa pro Deno.serve
export async function atender(req: Request): Promise<Response> {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors(origin) });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: cors(origin) },
    );
  }
  if (!(await quemChama(req))) {
    return new Response(JSON.stringify({ error: "Entre no sistema pra usar esta função." }), { status: 401, headers: cors(origin) });
  }

  try {
    const body = await req.json();
    const documents: DocumentInput[] = body?.documents;
    // modo de extração: "cadastro" (padrão), "alvara", "convencao" ou "fator_r"
    const modosValidos = ["cadastro", "alvara", "convencao", "fator_r", "consulta", "documento", "revisao", "correcao"];
    const modo = modosValidos.includes(body?.modo) ? body.modo : "cadastro";

    // ----- modo "consulta": raciocínio sobre a tabela de pisos (sem documento) -----
    if (modo === "consulta") {
      const pergunta = typeof body?.pergunta === "string" ? body.pergunta.trim() : "";
      const salario = typeof body?.salario === "number" ? body.salario : null;
      const pisos = Array.isArray(body?.pisos) ? body.pisos : [];
      const ctx = body?.convencao || {};
      if (!pergunta || pisos.length === 0) {
        return new Response(
          JSON.stringify({ error: "Para consulta, envie 'pergunta' e 'pisos'." }),
          { status: 400, headers: cors(origin) },
        );
      }
      const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: "ANTHROPIC_API_KEY não configurada nos secrets." }),
          { status: 500, headers: cors(origin) },
        );
      }
      const userText =
        "CONTEXTO DA CONVENÇÃO:\n" + JSON.stringify(ctx) +
        "\n\nTABELA DE PISOS (funcao, piso_salarial, jornada, observacoes):\n" + JSON.stringify(pisos) +
        "\n\nDESCRIÇÃO INFORMADA PELO CLIENTE:\n" + pergunta +
        "\n\nSALÁRIO PRETENDIDO: " + (salario != null ? salario : "não informado") +
        "\n\nResponda APENAS com o JSON conforme as instruções do sistema.";
      const rc = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 1500,
          system: SYSTEM_PROMPT_CONSULTA,
          messages: [{ role: "user", content: userText }],
        }),
      });
      if (!rc.ok) {
        const errText = await rc.text();
        console.error("Claude API error (consulta):", rc.status, errText);
        return new Response(
          JSON.stringify({ error: "Erro na chamada à Claude API", status: rc.status, details: errText.substring(0, 500) }),
          { status: 502, headers: cors(origin) },
        );
      }
      const cd = await rc.json();
      const txt = cd.content?.[0]?.text || "";
      let parsedC;
      try {
        const cleaned = txt.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
        parsedC = JSON.parse(cleaned);
      } catch (_e) {
        return new Response(
          JSON.stringify({ error: "Resposta da Claude (consulta) não pôde ser interpretada como JSON.", raw: txt.substring(0, 1000) }),
          { status: 500, headers: cors(origin) },
        );
      }
      return new Response(
        JSON.stringify({ data: parsedC, modo: "consulta", usage: cd.usage }),
        { headers: cors(origin) },
      );
    }

    // ----- modo "documento": gera informativo/parecer com web search -----
    if (modo === "documento") {
      const tipo = (body?.tipo === "parecer") ? "parecer" : "informativo";
      const assunto = typeof body?.assunto === "string" ? body.assunto.trim() : "";
      const cliente = typeof body?.cliente === "string" ? body.cliente.trim() : "";
      const contexto = typeof body?.contexto === "string" ? body.contexto.trim() : "";
      const instrucoes = typeof body?.instrucoes === "string" ? body.instrucoes.trim() : "";
      if (!assunto) {
        return new Response(
          JSON.stringify({ error: "Para gerar documento, envie 'assunto'." }),
          { status: 400, headers: cors(origin) },
        );
      }
      const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: "ANTHROPIC_API_KEY não configurada nos secrets." }),
          { status: 500, headers: cors(origin) },
        );
      }
      const userText =
        "TIPO DE DOCUMENTO: " + tipo +
        "\n\nASSUNTO / PERGUNTA DO CLIENTE:\n" + assunto +
        (cliente ? "\n\nCLIENTE: " + cliente : "") +
        (contexto ? "\n\nCONTEXTO ADICIONAL:\n" + contexto : "") +
        (instrucoes ? "\n\nORIENTAÇÕES DE REDAÇÃO (siga à risca quanto a tom, nível de linguagem e profundidade):\n" + instrucoes : "") +
        "\n\nGere o documento em português, em markdown, começando pela linha do título (# Título). Pesquise a legislação vigente para fundamentar e confira se os dispositivos citados estão em vigor.";
      const rd = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 4096,
          system: SYSTEM_PROMPT_DOCUMENTO,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages: [{ role: "user", content: userText }],
        }),
      });
      if (!rd.ok) {
        const errText = await rd.text();
        console.error("Claude API error (documento):", rd.status, errText);
        return new Response(
          JSON.stringify({ error: "Erro na chamada à Claude API", status: rd.status, details: errText.substring(0, 500) }),
          { status: 502, headers: cors(origin) },
        );
      }
      const dd = await rd.json();
      let md = (dd.content || []).filter((b) => b && b.type === "text").map((b) => b.text).join("\n").trim();
      md = md.replace(/^```(?:markdown|md)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
      if (!md) {
        return new Response(
          JSON.stringify({ error: "A geração não retornou texto." }),
          { status: 502, headers: cors(origin) },
        );
      }
      return new Response(
        JSON.stringify({ data: { markdown: md, tipo }, modo: "documento", usage: dd.usage }),
        { headers: cors(origin) },
      );
    }

    // ----- modo "revisao": revisão crítica do documento com web search -----
    if (modo === "revisao") {
      const conteudo = typeof body?.conteudo === "string" ? body.conteudo.trim() : "";
      const tituloRev = typeof body?.titulo === "string" ? body.titulo.trim() : "";
      const tipoRev = (body?.tipo === "parecer") ? "parecer" : "informativo";
      if (!conteudo) {
        return new Response(
          JSON.stringify({ error: "Para revisar, envie 'conteudo'." }),
          { status: 400, headers: cors(origin) },
        );
      }
      const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: "ANTHROPIC_API_KEY não configurada nos secrets." }),
          { status: 500, headers: cors(origin) },
        );
      }
      const userText =
        "TIPO DE DOCUMENTO: " + tipoRev +
        (tituloRev ? "\n\nTÍTULO: " + tituloRev : "") +
        "\n\nDOCUMENTO A REVISAR:\n" + conteudo +
        "\n\nRevise criticamente e responda APENAS com o JSON conforme as instruções do sistema.";
      const rr = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 8192,
          system: SYSTEM_PROMPT_REVISAO,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages: [{ role: "user", content: userText }],
        }),
      });
      if (!rr.ok) {
        const errText = await rr.text();
        console.error("Claude API error (revisao):", rr.status, errText);
        return new Response(
          JSON.stringify({ error: "Erro na chamada à Claude API", status: rr.status, details: errText.substring(0, 500) }),
          { status: 502, headers: cors(origin) },
        );
      }
      const rj = await rr.json();
      const reviewText = (rj.content || []).filter((b) => b && b.type === "text").map((b) => b.text).join("\n").trim();
      if (!reviewText) {
        return new Response(
          JSON.stringify({ error: "A revisão não retornou texto." }),
          { status: 502, headers: cors(origin) },
        );
      }
      return new Response(
        JSON.stringify({ data: { review: reviewText }, modo: "revisao", usage: rj.usage }),
        { headers: cors(origin) },
      );
    }

    // ----- modo "correcao": reescreve o documento aplicando a revisão -----
    if (modo === "correcao") {
      const conteudo = typeof body?.conteudo === "string" ? body.conteudo.trim() : "";
      const revisao = typeof body?.revisao === "string" ? body.revisao.trim() : "";
      const tituloCorr = typeof body?.titulo === "string" ? body.titulo.trim() : "";
      const instrucoesCorr = typeof body?.instrucoes === "string" ? body.instrucoes.trim() : "";
      const tipoCorr = (body?.tipo === "parecer") ? "parecer" : "informativo";
      if (!conteudo || !revisao) {
        return new Response(
          JSON.stringify({ error: "Para corrigir, envie 'conteudo' e 'revisao'." }),
          { status: 400, headers: cors(origin) },
        );
      }
      const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: "ANTHROPIC_API_KEY não configurada nos secrets." }),
          { status: 500, headers: cors(origin) },
        );
      }
      const userText =
        "TIPO DE DOCUMENTO: " + tipoCorr +
        (tituloCorr ? "\n\nTÍTULO ATUAL: " + tituloCorr : "") +
        "\n\nDOCUMENTO ATUAL:\n" + conteudo +
        "\n\nREVISÃO (apontamentos a corrigir):\n" + revisao +
        (instrucoesCorr ? "\n\nORIENTAÇÕES DE REDAÇÃO (mantenha):\n" + instrucoesCorr : "") +
        "\n\nReescreva o documento corrigido em markdown, começando pelo título (#), aplicando os apontamentos e mantendo o que já estava correto.";
      const rk = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 4096,
          system: SYSTEM_PROMPT_CORRECAO,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages: [{ role: "user", content: userText }],
        }),
      });
      if (!rk.ok) {
        const errText = await rk.text();
        console.error("Claude API error (correcao):", rk.status, errText);
        return new Response(
          JSON.stringify({ error: "Erro na chamada à Claude API", status: rk.status, details: errText.substring(0, 500) }),
          { status: 502, headers: cors(origin) },
        );
      }
      const dk = await rk.json();
      let mdk = (dk.content || []).filter((b) => b && b.type === "text").map((b) => b.text).join("\n").trim();
      mdk = mdk.replace(/^```(?:markdown|md)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
      if (!mdk) {
        return new Response(
          JSON.stringify({ error: "A correção não retornou texto." }),
          { status: 502, headers: cors(origin) },
        );
      }
      return new Response(
        JSON.stringify({ data: { markdown: mdk, tipo: tipoCorr }, modo: "correcao", usage: dk.usage }),
        { headers: cors(origin) },
      );
    }

    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return new Response(
        JSON.stringify({ error: "Forneça pelo menos um documento no campo 'documents'." }),
        { status: 400, headers: cors(origin) },
      );
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY não configurada nos secrets." }),
        { status: 500, headers: cors(origin) },
      );
    }

    // Monta os content blocks para a Claude API
    const contentBlocks: any[] = documents.map((doc) => {
      if (doc.media_type === "text/plain") {
        return { type: "document", source: { type: "text", media_type: "text/plain", data: doc.data } };
      }
      if (doc.media_type === "application/pdf") {
        return {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: doc.data,
          },
        };
      }
      return {
        type: "image",
        source: {
          type: "base64",
          media_type: doc.media_type,
          data: doc.data,
        },
      };
    });

    const txtCadastro = "Analise os documentos acima e extraia os dados cadastrais conforme as instruções do sistema — inclusive os dados pessoais de cada sócio ou titular (RG com órgão expedidor, nascimento, estado civil, nacionalidade, profissão e endereço residencial). Os sócios são o quadro DEPOIS do ato (numa alteração, o da consolidação ou o que resulta das cessões); quem saiu da sociedade no ato vai em socios_retirantes, nunca em socios. Retorne APENAS o JSON, sem markdown nem comentários.";
    const txtAlvara = "Analise o(s) documento(s) de alvará/licença acima e extraia os campos conforme as instruções do sistema. Retorne APENAS o JSON, sem markdown nem comentários.";
    const txtConvencao = "Analise a convenção coletiva acima e extraia o cabeçalho e TODOS os pisos por função, conforme as instruções do sistema. Retorne APENAS o JSON, sem markdown nem comentários.";
    const txtFatorR = "Analise o(s) documento(s) acima (extrato da folha, relatório de faturamento e/ou apuração do Simples — pode haver mais de um) e extraia as séries mensais conforme as instruções do sistema: aplique a hierarquia de fontes para folha, CPP e receita (cada informação sai de uma única fonte) e mantenha cada valor na COMPETÊNCIA exatamente como consta nos documentos (as tabelas do PGDAS e do relatório da Domínio são por competência/PA — o deslocamento para o mês de pagamento é feito pelo sistema; use meses_caixa apenas para documentos que informem explicitamente a data de pagamento). Retorne APENAS o JSON, sem markdown nem comentários.";
    contentBlocks.push({
      type: "text",
      text: modo === "alvara" ? txtAlvara : (modo === "convencao" ? txtConvencao : (modo === "fator_r" ? txtFatorR : txtCadastro)),
    });

    const claudeRes = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: modo === "convencao" || modo === "fator_r" ? 8192 : 4096,
        system: modo === "alvara" ? SYSTEM_PROMPT_ALVARA : (modo === "convencao" ? SYSTEM_PROMPT_CONVENCAO : (modo === "fator_r" ? SYSTEM_PROMPT_FATOR_R : SYSTEM_PROMPT)),
        messages: [{ role: "user", content: contentBlocks }],
      }),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      console.error("Claude API error:", claudeRes.status, errText);
      return new Response(
        JSON.stringify({
          error: "Erro na chamada à Claude API",
          status: claudeRes.status,
          details: errText.substring(0, 500),
        }),
        { status: 502, headers: cors(origin) },
      );
    }

    const claudeData = await claudeRes.json();
    const text: string = claudeData.content?.[0]?.text || "";

    // Parse robusto: remove possíveis code blocks markdown
    let parsed;
    try {
      const cleaned = text
        .replace(/^```(?:json)?\s*\n?/i, "")
        .replace(/\n?```\s*$/i, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error("Failed to parse Claude response:", text.substring(0, 500));
      return new Response(
        JSON.stringify({
          error: "Resposta da Claude não pôde ser interpretada como JSON.",
          raw: text.substring(0, 1000),
        }),
        { status: 500, headers: cors(origin) },
      );
    }

    if (modo === "cadastro") conferirQuadro(parsed);

    return new Response(
      JSON.stringify({
        data: parsed,
        modo: modo,
        usage: claudeData.usage,
      }),
      { headers: cors(origin) },
    );
  } catch (e: any) {
    console.error("Internal error:", e);
    return new Response(
      JSON.stringify({
        error: "Erro interno na função",
        message: e?.message || String(e),
      }),
      { headers: cors(origin) },
    );
  }
}
