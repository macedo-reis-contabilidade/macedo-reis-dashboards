// ============================================================
// MACEDO & REIS — Assistente do escritório: as ferramentas que o modelo chama (só leem; mudar, só propondo)
// buscar_empresa e ver_empresa (o cadastro e tudo o que o sistema tem da empresa), consultar (qualquer tabela da lista
// abaixo, com filtros, contagem, totais e agrupamento), agenda (tarefas e rotinas de uma pessoa, com a regra da agenda —
// assets/js/rotinas-dia.js) e perguntar_reforma (a pergunta vai pro chat da Reforma, que responde com a base dele).
// As propostas (propor_concluir_tarefas, propor_alterar_tarefas — prazo, responsável e prioridade, desde 16/10/2026 —,
// propor_marcar_pago, propor_criar_tarefa, propor_revisao_atrasadas, propor_ver_vigia, o cartão do vigia, e, desde
// 19/10/2026, propor_enviar_mensagem, a mensagem no chat da equipe; desde 20/10/2026, a mensagem no histórico das tarefas —
// junto da conclusão e da mudança, ou sozinha, propor_registrar_historico) não gravam nada: separam o que identifica a mudança
// (ids, a pessoa, os campos da tarefa nova, quem recebe a mensagem e o texto) e o servidor manda junto com a resposta; a
// tela mostra o cartão e quem grava é ela, com o login da pessoa, depois que ela confirma (assets/js/assistente-acoes.js
// + assets/js/tarefas-acoes.js — a mensagem, assets/js/chat-equipe.js —, a mesma regra das telas). Uma proposta por
// pergunta (a mensagem com arquivo toma o lugar do cartão dos arquivos que a buscou).
// O vigia do sistema (vigia_achados) entra na lista e no ver_empresa: o que o banco achou de desencontrado ou parado.
// Desde 20/10/2026, o feed de notícias (noticias, com a fonte pelo nome e as empresas que cada uma alcança pelo nome) e a
// revisão do honorário dos clientes (revisoes_honorario, só dos sócios) também — e as duas no ver_empresa.
// Lista branca: só as tabelas e colunas daqui são lidas. Ficam fora a senha/credencial do cadastro, o RG e o nascimento
// das pessoas físicas do cadastro (o CPF e o endereço do cadastro entram: são o dado de trabalho do IRPF), os documentos
// pessoais dos sócios (CPF, RG, endereço, nascimento), as respostas dos formulários de admissão e rescisão, as
// configurações do escritório e o histórico dos chats. O banco lê com o login de quem pergunta: as regras de acesso
// do banco valem (o financeiro do escritório, Conta Azul, só pros sócios). Puras: o servidor injeta o banco, o contexto
// e a Reforma — testes em tests/assistente-funcao.test.mjs.
// ============================================================

import { rotinaDoDia, rotinaFeita, ymd } from '../../../assets/js/rotinas-dia.js';
import { EQUIPE, NOME_POR_EMAIL } from '../../../assets/js/equipe.js';
import { ficaDeFora, mudancaDe, proximasNascemCom, PRIORIDADES, limparMensagem } from '../../../assets/js/tarefas-acoes.js';
import { rotuloDaRegra } from '../../../assets/js/vigia.js';
import { ROTULO_SETOR, ROTULO_RELEVANCIA } from '../../../assets/js/noticias.js';
import { pastaDaUrl, filtrarArquivos } from './drive.js';

// ---------- a lista branca: tabela → colunas lidas, as que vêm sem pedir, o que é cada coisa ----------
// notas: o que o modelo precisa saber da coluna (valores possíveis, unidade); enums: colunas de tipo enumerado no banco
// (só aceitam =, != e "em"); pk: a ordem estável pra paginar; socios: só os sócios leem (a regra é do banco); arrays:
// colunas de lista (=/contem = a lista tem o valor; "em" = tem algum deles); empresas: a coluna de lista de empresas, que
// sai com quantas e os nomes; fonte: o fonte_id sai como o nome da fonte do feed
export const TABELAS = {
  clientes: { rotulo: 'o cadastro das empresas',
    desc: 'Cadastro ("Base mestre"): empresas (PJ) e pessoas físicas (PF), inclusive quem já saiu. Quem é cliente hoje: carteira_info.',
    cols: ['id', 'nome_principal', 'nome_fantasia', 'documento', 'tipo_pessoa', 'regime_tributario', 'porte_empresa', 'status', 'cnae_principal', 'cnaes_secundarios',
      'natureza_juridica', 'data_abertura', 'capital_social', 'inscricao_estadual', 'inscricao_municipal', 'email_principal', 'telefone_principal', 'cep', 'logradouro',
      'numero', 'complemento', 'bairro', 'cidade', 'uf', 'data_inicio_cliente', 'data_fim_cliente', 'observacoes', 'drive_folder_url', 'created_at', 'updated_at'],
    padrao: ['id', 'nome_principal', 'nome_fantasia', 'documento', 'tipo_pessoa', 'regime_tributario', 'status', 'cidade', 'uf'],
    enums: ['tipo_pessoa', 'regime_tributario', 'porte_empresa', 'status'],
    notas: { documento: 'CNPJ ou CPF, só números', tipo_pessoa: 'PF | PJ', regime_tributario: 'Simples Nacional | MEI | Lucro Presumido | Lucro Real | Isento | Imune',
      porte_empresa: 'ME | EPP | MEI | Demais', status: 'ativo | inativo | em_transicao' } },
  carteira_info: { rotulo: 'a carteira', pk: 'cliente_id',
    desc: 'A carteira de clientes (os atendidos pelo escritório): cliente hoje = entrada preenchida e saída vazia (ou no futuro).',
    cols: ['cliente_id', 'entrada', 'saida', 'motivo_saida', 'segmento', 'sistemas', 'contab_digital', 'contato', 'ramo', 'observacao', 'inadimplente_desde', 'atualizado_em'],
    padrao: ['cliente_id', 'entrada', 'saida', 'segmento', 'ramo', 'inadimplente_desde'],
    notas: { inadimplente_desde: 'preenchido = inadimplente desde a data', segmento: 'COMÉRCIO | SERVIÇO | INDÚSTRIA | COMÉRCIO + SERVIÇO | INDÚSTRIA + SERVIÇO | PESSOA FÍSICA | ASSOCIAÇÃO' } },
  carteira_pendentes: { rotulo: 'as entradas na carteira sem cadastro',
    desc: 'Empresas que entraram na carteira e ainda não têm cadastro.', cols: ['id', 'empresa', 'entrada', 'segmento', 'sistemas', 'contato', 'ramo', 'criado_em'],
    padrao: ['empresa', 'entrada', 'segmento', 'ramo'] },
  socios: { rotulo: 'os sócios',
    desc: 'Sócios das empresas (sem CPF, RG, endereço e nascimento — esses não são lidos).',
    cols: ['id', 'cliente_id', 'nome', 'participacao_percentual', 'qualificacao', 'eh_administrador', 'telefone', 'email', 'estado_civil', 'nacionalidade', 'profissao'],
    padrao: ['cliente_id', 'nome', 'participacao_percentual', 'qualificacao', 'eh_administrador'] },
  contatos: { rotulo: 'os contatos', desc: 'Contatos das empresas.', cols: ['id', 'cliente_id', 'nome', 'papel', 'telefone', 'email', 'eh_principal'],
    padrao: ['cliente_id', 'nome', 'papel', 'telefone', 'email', 'eh_principal'] },
  servicos_contratados: { rotulo: 'os serviços contratados', desc: 'Setores que atendem cada empresa.',
    cols: ['cliente_id', 'setor', 'responsavel_escritorio', 'data_inicio', 'data_fim', 'ativo'], padrao: ['cliente_id', 'setor', 'responsavel_escritorio', 'ativo'], enums: ['setor'],
    notas: { setor: 'contabil | departamento_pessoal | fiscal | financeiro | comercial | societario | irpf' } },
  tarefas: { rotulo: 'as tarefas',
    desc: 'Tarefas de todos os setores (a agenda). Atrasada = prazo antes de hoje e status diferente de concluida.',
    cols: ['id', 'cliente_id', 'setor', 'titulo', 'descricao', 'responsavel', 'prazo', 'hora', 'status', 'prioridade', 'origem', 'tipo', 'competencia', 'competencia_fiscal',
      'fase', 'situacao', 'concluida_em', 'concluida_por', 'created_at', 'obrigacao_id', 'transicao_id', 'proposta_id', 'alvara_id', 'admissao_id', 'rescisao_id', 'faturavel'],
    padrao: ['id', 'cliente_id', 'setor', 'titulo', 'responsavel', 'prazo', 'status', 'prioridade'],
    notas: { status: 'pendente | em_andamento | aguardando | concluida', prioridade: 'alta | media | baixa', setor: 'dp | fiscal | contabil | financeiro | comercial | societario | irpf | gestao | clientes | geral',
      responsavel: 'nome da pessoa, gravado com maiúsculas diferentes; "Ambos" = Samuel e Diego', concluida_por: 'e-mail de quem concluiu',
      origem: 'avulsa | recorrente | transicao | admissao | rescisao | reuniao | alvara | processo | faturamento | proposta_externa', fase: 'fase da transição de cliente' } },
  tarefa_historico: { rotulo: 'o histórico das tarefas', desc: 'O que aconteceu em cada tarefa.', cols: ['tarefa_id', 'descricao', 'autor', 'created_at'],
    padrao: ['tarefa_id', 'descricao', 'autor', 'created_at'] },
  tarefas_recorrentes: { rotulo: 'as tarefas recorrentes', desc: 'Regras que geram tarefas todo mês ou ano, por empresa (Tarefas recorrentes de cada setor).',
    cols: ['id', 'cliente_id', 'setor', 'titulo', 'descricao', 'periodicidade', 'dia_vencimento', 'mes_vencimento', 'dia_util', 'responsavel', 'fundamento', 'origem', 'ativo', 'data_fim', 'observacao'],
    padrao: ['cliente_id', 'setor', 'titulo', 'periodicidade', 'dia_vencimento', 'responsavel', 'ativo'], notas: { periodicidade: 'mensal | anual' } },
  rotinas: { rotulo: 'as rotinas do escritório', desc: 'Rotinas internas (agenda): diária, semanal, mensal ou anual; ultima_execucao = última vez feita.',
    cols: ['id', 'setor', 'titulo', 'descricao', 'responsavel', 'periodicidade', 'dia_semana', 'dia_mes', 'dia_anual', 'dia_util', 'ultima_execucao', 'ultima_por', 'adiada_para', 'ativo'],
    padrao: ['setor', 'titulo', 'responsavel', 'periodicidade', 'ultima_execucao', 'ativo'] },
  cobrancas_config: { rotulo: 'a base de cobrança', desc: 'Quem é cobrado (honorários): valor base, dia do vencimento, canal.',
    cols: ['id', 'cliente_id', 'valor_base', 'dia_vencimento', 'canal', 'contato_envio', 'destino', 'responsavel', 'ativo', 'observacao_fixa'],
    padrao: ['cliente_id', 'valor_base', 'dia_vencimento', 'canal', 'ativo'] },
  cobrancas_mensais: { rotulo: 'os boletos', desc: 'Boletos de honorários do mês (tela Boletos).',
    cols: ['id', 'cliente_id', 'competencia', 'valor', 'vencimento', 'canal', 'contato_envio', 'destino', 'responsavel', 'observacao', 'status', 'itens_extras'],
    padrao: ['cliente_id', 'competencia', 'valor', 'vencimento', 'status', 'canal'],
    notas: { competencia: "'AAAA-MM'", status: 'a_emitir | emitido | enviado | pago | cancelado (pago = recebido; a_emitir, emitido e enviado = em aberto)' } },
  faturaveis: { rotulo: 'os faturáveis', desc: 'Serviços extras a cobrar no boleto (tela Faturáveis).',
    cols: ['id', 'cliente_id', 'setor', 'descricao', 'valor', 'executado_por', 'executado_em', 'destino', 'status', 'competencia_boleto', 'referencia', 'obs'],
    padrao: ['cliente_id', 'setor', 'descricao', 'valor', 'executado_em', 'status'], notas: { status: 'a_faturar | lancado' } },
  servicos_avulsos: { rotulo: 'a tabela de serviços avulsos', desc: 'Serviços avulsos e o valor padrão.', cols: ['id', 'nome', 'valor_padrao', 'setor', 'ativo'], padrao: ['nome', 'valor_padrao', 'setor', 'ativo'] },
  obrigacoes_fiscais: { rotulo: 'as obrigações fiscais', desc: 'Catálogo das obrigações (periodicidade, dia do prazo, regimes).',
    cols: ['id', 'nome', 'periodicidade', 'meses_vencimento', 'dia_prazo', 'gatilho_dias_antes', 'competencia_offset_meses', 'regimes_aplicaveis', 'cnaes_aplicaveis', 'ativo'],
    padrao: ['id', 'nome', 'periodicidade', 'dia_prazo', 'regimes_aplicaveis', 'ativo'], notas: { periodicidade: 'mensal | trimestral | quadrimestral | anual' } },
  cliente_obrigacoes: { rotulo: 'as obrigações por empresa', desc: 'Que obrigação cada empresa tem e quem cuida (as tarefas do mês saem daqui: tarefas.obrigacao_id).',
    cols: ['id', 'cliente_id', 'obrigacao_id', 'responsavel', 'dia_prazo_override', 'observacao', 'ativo'], padrao: ['cliente_id', 'obrigacao_id', 'responsavel', 'ativo'] },
  guias_arquivadas: { rotulo: 'as guias arquivadas', desc: 'Guias das obrigações salvas no Drive e enviadas.',
    cols: ['id', 'cliente_id', 'obrigacao_id', 'competencia', 'nome_arquivo', 'drive_file_url', 'subido_por', 'criado_em', 'enviado_em', 'enviado_por', 'enviado_para'],
    padrao: ['cliente_id', 'obrigacao_id', 'competencia', 'nome_arquivo', 'enviado_em'] },
  alvaras: { rotulo: 'os alvarás', desc: 'Alvarás das empresas e o vencimento (tela Alvarás).',
    cols: ['id', 'cliente_id', 'tipo', 'numero', 'orgao', 'cidade', 'responsavel', 'vencimento', 'status', 'recorrencia', 'observacoes', 'concluido_em', 'concluido_por', 'link_drive'],
    padrao: ['cliente_id', 'tipo', 'vencimento', 'status', 'responsavel'], notas: { status: 'vigente | a_confirmar' } },
  alvara_historico: { rotulo: 'o histórico dos alvarás', desc: 'O que aconteceu em cada alvará.', cols: ['alvara_id', 'descricao', 'autor', 'created_at'], padrao: ['alvara_id', 'descricao', 'autor', 'created_at'] },
  // os certificados digitais dos clientes (Societário › Certificados digitais, 22/10/2026): o escritório só avisa o cliente
  certificados_digitais: { rotulo: 'os certificados digitais dos clientes',
    desc: 'Os certificados digitais A1 e A3 dos clientes e a validade (tela Certificados digitais, no Societário). O escritório não emite nem agenda o certificado: só avisa o cliente antes de vencer (a 30 dias e, se não renovou, a 7), e quem avisa é a Deize. Renovado = a validade nova no lugar da antiga.',
    cols: ['id', 'cliente_id', 'titular', 'tipo', 'certificadora', 'validade', 'acompanhar', 'avisado_em', 'avisado_por', 'observacao', 'atualizado_em'],
    padrao: ['cliente_id', 'titular', 'tipo', 'certificadora', 'validade', 'avisado_em', 'avisado_por'],
    notas: { tipo: 'A1 (arquivo) | A3 (cartão ou token) | vazio = não informado', titular: 'o nome no certificado (empresa ou pessoa)', cliente_id: 'vazio = sem empresa vinculada',
      certificadora: 'quem emitiu o certificado. Desde 22/10/2026 a tela a exige no certificado novo e no Renovado · vazia = não informada: os que vieram da planilha de controle, que não tinha a coluna (deles, a tela só pede a certificadora no Renovado · editar outro campo não exige)',
      acompanhar: 'false = não acompanha mais (fica fora dos avisos)', avisado_em: 'a última vez que o cliente foi avisado (vazio = ainda não, neste vencimento)' } },
  // a Receita pela ponte (Integra Contador, 23/10/2026): o que a ponte do PC do escritório consulta na Receita, por empresa.
  // Só consulta: nada é transmitido. Vazio = a ponte ainda não consultou (ela começa depois de instalada no PC do escritório).
  receita_empresas: { rotulo: 'a situação das empresas na Receita',
    desc: 'O que a ponte da Receita (Integra Contador, do PC do escritório) consultou de cada empresa: se o escritório tem a autorização de acesso da empresa na Receita (sem ela, nada se consulta), quando o PGDAS foi consultado e as pendências do relatório de situação fiscal (Receita e PGFN). Uma linha por empresa; sem linha = ainda não consultada.',
    cols: ['cliente_id', 'autorizacao', 'autorizacao_ate', 'autorizacao_em', 'pgdas_em', 'pendencias', 'situacao_fiscal_em', 'atualizado_em'],
    padrao: ['cliente_id', 'autorizacao', 'autorizacao_ate', 'pendencias', 'situacao_fiscal_em'],
    notas: { autorizacao: 'ativa | vencida | sem (a Receita recusou: o cliente não autorizou o escritório)', autorizacao_ate: 'até quando a autorização vale',
      pendencias: 'lista [{orgao, titulo}] do relatório de situação fiscal · vazia = sem pendência · vazio = nunca consultada', situacao_fiscal_em: 'o dia do relatório de situação fiscal',
      pgdas_em: 'a última consulta do PGDAS desta empresa' } },
  receita_pgdas: { rotulo: 'o PGDAS das empresas segundo a Receita',
    desc: 'O PGDAS de cada empresa do Simples por mês, segundo a Receita (pela ponte): quando a declaração foi transmitida, se o DAS foi pago e, lido da declaração, a receita do mês e a dos 12 meses anteriores (o RBT12, que é o faturamento usado na revisão do honorário). Mês sem linha = não aparece na Receita (ou ainda não consultado: veja receita_empresas.pgdas_em).',
    cols: ['cliente_id', 'competencia', 'transmitida_em', 'das_pago', 'receita_mes', 'receita_12_meses', 'consultado_em', 'faturamento_em'],
    padrao: ['cliente_id', 'competencia', 'transmitida_em', 'das_pago', 'receita_mes', 'receita_12_meses'],
    notas: { competencia: 'AAAA-MM, o mês da declaração (o período de apuração)', das_pago: 'true pago · false não pago · vazio = sem DAS do mês',
      receita_12_meses: 'a receita bruta dos 12 meses anteriores ao mês (RBT12), da declaração', receita_mes: 'a receita bruta do mês, da declaração' } },
  receita_mensagens: { rotulo: 'as mensagens da Caixa Postal da Receita',
    desc: 'As mensagens da Caixa Postal do e-CAC de cada empresa (pela ponte): só o assunto, a data, de onde veio (Receita, Estado ou Município — a exclusão do Simples vem do Estado ou do Município) e se foi lida. O texto fica no e-CAC.',
    cols: ['cliente_id', 'assunto', 'enviada_em', 'origem', 'lida', 'recebida_em'],
    padrao: ['cliente_id', 'assunto', 'enviada_em', 'origem', 'lida'],
    notas: { recebida_em: 'quando o sistema recebeu da ponte', lida: 'se a mensagem já foi aberta no e-CAC' } },
  receita_rodadas: { rotulo: 'as rodadas da ponte da Receita',
    desc: 'Cada vez que a ponte da Receita (no PC do escritório) mandou o que consultou: quando, quantas chamadas no mês (o Integra é pago por chamada), quantas empresas, os CNPJs que não bateram com o cadastro e o que faltou (sem autorização, teto de chamadas, erro, a conferir).',
    cols: ['inicio', 'fim', 'maquina', 'ambiente', 'chamadas_mes', 'empresas', 'sem_cadastro', 'faltou', 'recebida_em'],
    padrao: ['recebida_em', 'chamadas_mes', 'empresas', 'sem_cadastro', 'faltou'],
    notas: { faltou: 'lista [{documento, servico, motivo}] · motivo: sem_autorizacao | teto | erro | a_conferir' } },
  admissoes: { rotulo: 'as admissões', desc: 'Admissões de funcionários que as empresas mandam pelo link (tela Admissões). As respostas do formulário não são lidas.',
    cols: ['id', 'cliente_id', 'empresa_nome', 'contato_nome', 'origem', 'funcionario_nome', 'data_inicio', 'responsavel', 'status', 'documentos', 'drive_pasta_url', 'observacoes',
      'respondida_em', 'registrada_em', 'registrada_por', 'criado_em', 'atualizado_em'],
    padrao: ['cliente_id', 'empresa_nome', 'funcionario_nome', 'data_inicio', 'status', 'responsavel', 'criado_em'],
    notas: { status: 'respondida (= recebida, a registrar) | em_registro | registrada | cancelada', cliente_id: 'vazio = não vinculada a um cadastro', documentos: 'lista dos documentos e se chegaram' } },
  rescisoes: { rotulo: 'as rescisões', desc: 'Rescisões que as empresas mandam pelo link (tela Rescisões), com as datas calculadas.',
    cols: ['id', 'cliente_id', 'empresa_nome', 'contato_nome', 'origem', 'funcionario_nome', 'tipo', 'aviso', 'desconta_aviso', 'data_base', 'inicio_aviso', 'ultimo_dia', 'data_acerto',
      'data_admissao', 'prazo_experiencia', 'iniciativa', 'responsavel', 'status', 'observacoes', 'concluida_em', 'concluida_por', 'criado_em'],
    padrao: ['cliente_id', 'empresa_nome', 'funcionario_nome', 'tipo', 'ultimo_dia', 'data_acerto', 'status', 'responsavel'],
    notas: { tipo: 'pedido (de demissão) | dispensa (pela empresa) | experiencia', aviso: 'trabalhado | indenizado | imediato', data_acerto: 'pagamento até (já em dia útil)',
      status: 'recebida (a calcular) | em_andamento | concluida | cancelada', iniciativa: 'empresa | empregado (na experiência)' } },
  convencoes: { rotulo: 'as convenções coletivas', desc: 'Convenções coletivas cadastradas (tela Convenções).',
    cols: ['id', 'categoria', 'sindicato_laboral', 'sindicato_patronal', 'numero_registro_mte', 'abrangencia', 'vigencia_inicio', 'vigencia_fim', 'data_base', 'reajuste_percentual', 'beneficios', 'observacoes'],
    padrao: ['id', 'categoria', 'abrangencia', 'vigencia_inicio', 'vigencia_fim', 'reajuste_percentual'] },
  convencao_pisos: { rotulo: 'os pisos das convenções', desc: 'Piso salarial por função em cada convenção.', cols: ['id', 'convencao_id', 'funcao', 'piso_salarial', 'jornada', 'observacoes'],
    padrao: ['convencao_id', 'funcao', 'piso_salarial', 'jornada'] },
  documentos_dp: { rotulo: 'os pareceres do DP', desc: 'Pareceres e informativos do DP (tela Pareceres).', cols: ['id', 'tipo', 'titulo', 'cliente', 'assunto', 'contexto', 'conteudo', 'created_by', 'created_at'],
    padrao: ['id', 'tipo', 'titulo', 'cliente', 'assunto', 'created_at'] },
  irpf_declaracoes: { rotulo: 'as declarações de IRPF', desc: 'Declarações de IRPF por ano (pelo nome da pessoa, sem cadastro).',
    cols: ['id', 'ano', 'nome', 'canal', 'data_contato', 'situacao', 'data_entrega', 'valor', 'cobranca', 'obs'], padrao: ['ano', 'nome', 'situacao', 'data_entrega', 'valor', 'cobranca'],
    notas: { situacao: 'a_contatar | em_andamento | entregue | ja_fez | nao_declara | desvinculado', cobranca: 'a_cobrar | pago | lancado_ca | isento | nao_cobrar' } },
  precificacoes: { rotulo: 'as propostas de honorários', desc: 'Precificações e propostas (tela Precificação).',
    cols: ['id', 'cliente_nome', 'contato', 'cliente_id', 'origem', 'status', 'honorario', 'taxa_unica', 'observacao', 'criado_por', 'criado_em', 'atualizado_em'],
    padrao: ['cliente_nome', 'status', 'honorario', 'taxa_unica', 'criado_em'], notas: { status: 'recebida | calculada | apresentada | fechada | descartada', honorario: 'mensal (R$)' } },
  precificacao_obrigacoes: { rotulo: 'o catálogo de obrigações da precificação', desc: 'Obrigações por regime com a multa por atraso.',
    cols: ['id', 'nome', 'descricao', 'periodicidade', 'regimes', 'multa_tipo', 'multa_valor', 'multa_max', 'multa_obs', 'ativo'], padrao: ['nome', 'periodicidade', 'regimes', 'multa_tipo', 'multa_valor'] },
  transicoes: { rotulo: 'as transições de cliente', desc: 'Entrada de cliente novo ou CNPJ novo (tela Transição; as tarefas do kit têm transicao_id).',
    cols: ['id', 'titulo', 'tipo', 'padrinho', 'inicio', 'previsao_fim', 'tera_funcionarios', 'contato', 'observacao', 'status', 'concluida_em', 'criado_em'],
    padrao: ['id', 'titulo', 'tipo', 'padrinho', 'inicio', 'previsao_fim', 'status'], notas: { tipo: 'entrada | saida | cnpj_novo', status: 'em_andamento | concluida' } },
  transicao_empresas: { rotulo: 'as empresas das transições', pk: 'transicao_id,cliente_id', desc: 'Empresas de cada transição.', cols: ['transicao_id', 'cliente_id'], padrao: ['transicao_id', 'cliente_id'] },
  reunioes: { rotulo: 'as reuniões', desc: 'Reuniões com clientes (tela Reuniões).', cols: ['id', 'cliente_id', 'data_reuniao', 'hora', 'titulo', 'status', 'participante', 'observacoes', 'introducao'],
    padrao: ['id', 'cliente_id', 'data_reuniao', 'hora', 'titulo', 'status'], notas: { status: 'em_preparacao | agendada | realizada' } },
  reuniao_pautas: { rotulo: 'as pautas das reuniões', desc: 'Pautas por setor e o que foi discutido (ata).',
    cols: ['reuniao_id', 'setor', 'titulo', 'descricao', 'discussao', 'ordem', 'minutos', 'imprescindivel', 'apresentadores'], padrao: ['reuniao_id', 'setor', 'titulo', 'discussao'] },
  regularizacoes: { rotulo: 'as regularizações', desc: 'Regularização de débitos (tela Regularizações).',
    cols: ['id', 'cliente_id', 'campanha', 'data_base', 'prazo_final', 'status', 'total_debitos', 'entrada_prevista', 'obs_geral', 'contexto', 'proximos_passos'],
    padrao: ['id', 'cliente_id', 'campanha', 'status', 'total_debitos', 'prazo_final'], notas: { status: 'apresentado | parcelado | regularizado | sem_acordo' } },
  regularizacao_debitos: { rotulo: 'os débitos das regularizações', desc: 'Débitos de cada regularização.',
    cols: ['regularizacao_id', 'orgao', 'descricao', 'valor', 'condicao', 'situacao', 'status', 'obs'], padrao: ['regularizacao_id', 'orgao', 'descricao', 'valor', 'situacao'] },
  regularizacao_servicos: { rotulo: 'os serviços das regularizações', desc: 'Serviços propostos em cada regularização.',
    cols: ['regularizacao_id', 'descricao', 'valor', 'condicao', 'alternativo'], padrao: ['regularizacao_id', 'descricao', 'valor'] },
  rt_casos: { rotulo: 'os casos da Reforma', desc: 'Casos da campanha da Reforma (só o resumo; os detalhes e a simulação: perguntar_reforma).',
    cols: ['id', 'cliente_id', 'cnae_base', 'segmento', 'triagem', 'score', 'perfil_validado', 'decisao', 'status', 'fundamento', 'comunicado_em', 'ciencia_cliente', 'prazo_opcao',
      'sim_custo_dentro', 'sim_custo_fora', 'obs', 'atualizado_em'],
    padrao: ['cliente_id', 'triagem', 'decisao', 'status', 'comunicado_em'],
    notas: { decisao: 'pendente | por_dentro | por_fora', status: 'triado | validado | simulado | decidido | comunicado | opcao_registrada' } },
  nf_documentos: { rotulo: 'as notas fiscais importadas', desc: 'Notas importadas (XML) por empresa.',
    cols: ['id', 'cliente_id', 'modelo', 'numero', 'data_emissao', 'tipo', 'natureza_operacao', 'emit_nome', 'emit_doc', 'dest_nome', 'dest_doc', 'valor_total', 'cfop_principal', 'status'],
    padrao: ['cliente_id', 'modelo', 'data_emissao', 'tipo', 'emit_nome', 'dest_nome', 'valor_total'] },
  dre_simples: { rotulo: 'os DREs', desc: 'DRE dos clientes (tela DRE do cliente).', cols: ['id', 'cliente_id', 'periodo', 'valores', 'observacao', 'insights', 'criado_em'],
    padrao: ['cliente_id', 'periodo', 'criado_em'] },
  fiscal_analises: { rotulo: 'as análises fiscais', desc: 'Análises fiscais por empresa.',
    cols: ['id', 'cliente_id', 'analise', 'confianca_geral', 'requer_revisao', 'revisado', 'revisado_por', 'revisado_em', 'observacoes_revisao', 'created_at'],
    padrao: ['cliente_id', 'confianca_geral', 'requer_revisao', 'revisado', 'created_at'] },
  fr_empresas: { rotulo: 'as empresas do Fator R', desc: 'Empresas acompanhadas no Fator R.', cols: ['id', 'cliente_id', 'nome', 'documento', 'inicio_atividade', 'ativo', 'observacoes'],
    padrao: ['id', 'cliente_id', 'nome', 'ativo'] },
  fr_lancamentos: { rotulo: 'os lançamentos do Fator R', desc: 'Receita e folha por mês (Fator R).',
    cols: ['id', 'empresa_id', 'competencia', 'receita', 'folha_salarios', 'prolabore', 'inss_patronal', 'fgts', 'folha_outros', 'obs'], padrao: ['empresa_id', 'competencia', 'receita', 'folha_salarios', 'prolabore'] },
  cnpj_regime: { rotulo: 'as consultas de regime por CNPJ', pk: 'cnpj', desc: 'Situação no Simples/MEI consultada por CNPJ.', cols: ['cnpj', 'razao', 'simples', 'mei', 'situacao', 'fonte', 'consultado_em'],
    padrao: ['cnpj', 'razao', 'simples', 'mei', 'situacao', 'consultado_em'] },
  sugestoes: { rotulo: 'as sugestões de melhoria', desc: 'Sugestões de melhoria dos setores.',
    cols: ['id', 'setor', 'titulo', 'autor', 'melhoria', 'como_atual', 'como_melhorar', 'cenario_ideal', 'status', 'created_at', 'concluida_em'], padrao: ['setor', 'titulo', 'autor', 'status', 'created_at'] },
  mei_planos: { rotulo: 'os planos de MEI', desc: 'Planos de MEI da precificação.', cols: ['id', 'nome', 'slogan', 'valor_mensal', 'ativo'], padrao: ['nome', 'valor_mensal', 'ativo'] },
  // o vigia do sistema (15/10/2026): o banco roda as regras de hora em hora e guarda aqui o que achou. O
  // achado de "cliente sem cobrança" usa o Conta Azul: só os sócios leem (a regra é do banco; sem login — a avaliação —,
  // o filtro fixo tira)
  vigia_achados: { rotulo: 'o que o vigia achou', fixoNaoSocio: 'so_socios=eq.false',
    notaNaoSocio: 'Pra quem não é sócio, os achados só dos sócios (o cliente da carteira sem cobrança, que usa o financeiro do escritório) não entram nesta leitura: desses, não diga que não há nenhum — diga que só os sócios veem.',
    desc: 'O vigia do sistema: regras que rodam de hora em hora e acham o que ficou pra trás ou desencontrado (admissão sem registro, rescisão com pagamento chegando, alvará vencido, certificado digital do cliente vencendo sem aviso, boleto parado, cliente da carteira sem cobrança ou sem obrigação fiscal, reajuste aceito na Precificação que não entrou no boleto ou no Conta Azul, obrigação, tarefa ou rotina sem responsável, a obrigação que as outras empresas do mesmo regime têm e esta tem desligada, a obrigação ligada que ficou sem a tarefa do mês, o prazo que uma notícia do feed traz chegando, proposta parada, cadastro desencontrado da carteira e, pela ponte da Receita (Integra Contador), a empresa que não autorizou o escritório, o PGDAS não transmitido depois do prazo, mensagem nova na Caixa Postal do e-CAC e pendência na situação fiscal...). Cada achado diz quem cuida e a tela onde se resolve. Arrumou na tela, ele some sozinho na rodada seguinte (resolvido); ignorado = alguém marcou que não é problema. O que precisa de atenção agora: situacao = aberto.',
    cols: ['id', 'regra', 'titulo', 'detalhe', 'setor', 'responsavel', 'gravidade', 'cliente_id', 'link', 'prazo', 'situacao', 'primeiro_visto', 'ultimo_visto', 'resolvido_em', 'ignorado_em', 'ignorado_por', 'motivo_ignorado'],
    padrao: ['regra', 'titulo', 'detalhe', 'responsavel', 'gravidade', 'situacao', 'primeiro_visto'],
    notas: { situacao: 'aberto (a conferir) | resolvido | ignorado', gravidade: 'alta (urgente) | media | baixa', responsavel: 'quem cuida; "Ambos" = Samuel e Diego',
      link: 'a tela onde se resolve', primeiro_visto: 'quando o vigia achou', ignorado_por: 'e-mail de quem ignorou',
      regra: 'admissao_nao_registrada | admissao_sem_vinculo | rescisao_pagamento | rescisao_sem_vinculo | alvara_vencendo | certificado_vencendo | cliente_sem_cobranca | boletos_nao_gerados | boleto_parado | cobranca_ex_cliente | faturavel_parado | reajuste_nao_aplicado | cadastro_desencontrado | carteira_sem_cadastro | proposta_parada | transicao_atrasada | cliente_sem_obrigacao | obrigacao_sem_responsavel | obrigacao_ex_cliente | obrigacao_desligada | obrigacao_sem_tarefa | reforma_prazo | noticia_prazo | tarefa_responsavel | tarefa_repetida | tarefa_ex_cliente | recorrente_ex_cliente | rotina_sem_responsavel | receita_sem_autorizacao | receita_autorizacao_vencendo | receita_pgdas_atrasado | receita_mensagem | receita_pendencia | ponte_parada' } },
  // o feed de notícias (20/10/2026): de hora em hora a função noticias lê as fontes e a IA diz se interessa, a importância,
  // os setores, o resumo, por que importa, o que fazer e quais clientes da carteira a notícia alcança (pelo cadastro)
  noticias: { rotulo: 'as notícias do feed', arrays: ['setores', 'clientes'], empresas: 'clientes', fonte: true,
    desc: 'O feed de notícias (tela Notícias e a aba Notícias do balão): de hora em hora o sistema lê as fontes (Receita Federal, PGFN, Fazenda, MTE e eSocial, Receita Estadual e Sefaz RS, JucisRS, STF, imprensa contábil, CFC e CRCRS) e a IA lê cada notícia: se interessa ao escritório, a importância, os setores, o resumo, por que importa, o que fazer, o prazo (quando a notícia traz um) e quais clientes da carteira ela alcança. As que valem: situacao = triada. A mesma notícia de outras fontes fica no grupo da principal: grupo vazio = a principal (use pra não contar duas vezes).',
    cols: ['id', 'titulo', 'url', 'fonte_id', 'publicada_em', 'coletada_em', 'triada_em', 'situacao', 'relevancia', 'setores', 'resumo', 'por_que', 'acao', 'prazo', 'prazo_o_que', 'clientes', 'grupo'],
    padrao: ['titulo', 'fonte_id', 'publicada_em', 'relevancia', 'setores', 'resumo', 'acao', 'prazo', 'prazo_o_que', 'clientes'],
    notas: { situacao: 'triada (a IA leu e interessa) | descartada (não interessa ao escritório) | nova | triando | erro', relevancia: 'alta (Importante) | media (Vale saber) | baixa (Pouco efeito)',
      setores: 'lista (dp | fiscal | contabil | societario | irpf): "=" ou "contem" acha quem tem o setor', clientes: 'lista das empresas da carteira que a notícia alcança: "contem" e o id da empresa acha as dela; sai com quantas e os nomes',
      fonte_id: 'sai como o nome da fonte', grupo: 'vazio = a principal; preenchido = a mesma notícia de outra fonte (o id da principal)', url: 'o link da notícia', publicada_em: 'quando a fonte publicou (sem data, vale coletada_em)', acao: 'o que fazer, na leitura da IA',
      prazo: 'a data em que quem a notícia alcança tem de agir, na leitura da IA (vazio = sem prazo); a dez dias ou menos, o vigia avisa o setor', prazo_o_que: 'o que vence nesse prazo' } },
  noticias_fontes: { rotulo: 'as fontes do feed', desc: 'De onde as notícias do feed vêm, e como foi a última coleta de cada uma.',
    cols: ['id', 'nome', 'tipo', 'site', 'ativo', 'ultima_coleta', 'ultimo_ok', 'ultimo_erro', 'itens_ultima'], padrao: ['nome', 'tipo', 'ativo', 'ultima_coleta', 'ultimo_erro'],
    notas: { tipo: 'oficial | tribunal | imprensa | classe', ultimo_erro: 'o erro da última coleta (vazio = foi bem)' } },
  // a revisão do honorário dos clientes da carteira (Precificação › Carteira, 19/10/2026): só os sócios leem (a regra é do
  // banco); as respostas do questionário e o cálculo do motor ficam de fora
  revisoes_honorario: { rotulo: 'as revisões de honorário', socios: true,
    desc: 'A revisão do honorário dos clientes da carteira (Precificação › Carteira): o motor de preço com o que o sistema sabe e as respostas conferidas, o honorário de hoje e o sugerido, a situação (estudo → reajuste proposto → aceito ou mantido) e, no aceito, o valor combinado e o mês em que ele começa. Vale a mais recente de cada empresa. Só os sócios leem.',
    cols: ['id', 'cliente_id', 'status', 'honorario_atual', 'fonte_atual', 'honorario_sugerido', 'honorario_novo', 'vigencia', 'observacao', 'criado_por', 'criado_em', 'atualizado_em', 'aplicado_em', 'aplicado_por'],
    padrao: ['cliente_id', 'status', 'honorario_atual', 'honorario_sugerido', 'honorario_novo', 'vigencia', 'atualizado_em', 'aplicado_em'],
    notas: { status: 'estudo | proposto (reajuste proposto) | aceito | mantido', honorario_atual: 'o de hoje quando revisou (R$/mês)', fonte_atual: 'boletos | conta_azul | informado',
      honorario_sugerido: 'o do motor na revisão (R$/mês)', honorario_novo: 'o combinado (no aceito) ou o proposto (R$/mês)', vigencia: "'AAAA-MM': o mês em que o valor novo começa",
      aplicado_em: 'quando o valor novo entrou no boleto (vazio no aceito = ainda não entrou)', criado_por: 'e-mail de quem revisou' } },
  ca_parcelas: { rotulo: 'o financeiro do escritório', socios: true,
    desc: 'Contas a receber e a pagar do próprio escritório (Conta Azul). Só os sócios leem.',
    cols: ['id', 'natureza', 'descricao', 'data_vencimento', 'data_competencia', 'data_pagamento', 'mes_pagamento', 'status', 'status_traduzido', 'total', 'pago', 'nao_pago', 'fornecedor_cliente_nome', 'categorias'],
    padrao: ['natureza', 'descricao', 'data_vencimento', 'data_pagamento', 'status_traduzido', 'total', 'pago', 'nao_pago', 'fornecedor_cliente_nome'],
    notas: { natureza: 'receita | despesa (minúsculo)', categorias: 'lista das categorias do Conta Azul' } },
  ca_categorias: { rotulo: 'as categorias do Conta Azul', socios: true, desc: 'Categorias do financeiro do escritório. Só os sócios leem.', cols: ['id', 'nome', 'tipo', 'id_pai', 'ativo'], padrao: ['nome', 'tipo', 'ativo'] }
};

// colunas com nome de pessoa: o banco grava "SAMUEL", "Samuel", "Vitoria", "Vitória"... — "=" compara sem maiúscula e sem
// acento (no ilike, a letra acentuada vira "_": Vit_ria pega Vitoria, Vitória e VITÓRIA)
const PESSOA = new Set(['responsavel', 'executado_por', 'concluido_por', 'criado_por', 'autor', 'padrinho', 'ultima_por', 'registrada_por', 'subido_por', 'enviado_por',
  'revisado_por', 'responsavel_escritorio', 'created_by']);
export const padraoPessoa = nome => String(nome == null ? '' : nome).replace(/[*%]/g, '').replace(/[^\x00-\x7F]/g, '_');
// colunas de data e hora (timestamptz): a data sozinha vale o dia inteiro no fuso de Brasília
const MOMENTO = /(_em|_at)$/;
export const OPS = ['=', '!=', '>', '>=', '<', '<=', 'contem', 'comeca_com', 'em', 'vazio', 'preenchido'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const MAX_FILTROS = 12, MAX_EM = 200, MAX_SAIDA = 12000;
const COM_EMPRESA = t => TABELAS[t].cols.includes('cliente_id');

// ---------- as definições que o modelo lê ----------
export const DEFINICOES = [
  { name: 'buscar_empresa',
    description: 'Procura empresas (ou pessoas físicas) no cadastro pelo nome, nome fantasia ou CNPJ/CPF, sem diferenciar acento e maiúscula. Devolve id, nome, fantasia, documento, regime, cidade, situação no cadastro e na carteira.',
    input_schema: { type: 'object', properties: { termo: { type: 'string', description: 'nome, parte do nome ou CNPJ/CPF' },
      limite: { type: 'integer', minimum: 1, maximum: 15, description: 'quantas (padrão 8)' } }, required: ['termo'] } },
  { name: 'ver_empresa',
    description: 'Tudo o que o sistema tem de uma empresa num lugar só: cadastro, carteira, sócios, contatos, serviços contratados, honorários (base e últimos boletos), tarefas abertas, tarefas recorrentes, obrigações, alvarás, admissões e rescisões, Reforma (situação do caso), reuniões, transições, regularizações, propostas, faturáveis, DRE, Fator R, o que o vigia achou dela, as notícias do feed que a alcançam (30 dias) e, pros sócios, a revisão do honorário. Sem "empresa", usa a empresa aberta na tela.',
    input_schema: { type: 'object', properties: { empresa: { type: 'string', description: 'id, nome ou CNPJ; vazio = a empresa aberta na tela' } } } },
  { name: 'agenda',
    description: 'A agenda de uma pessoa da equipe (ou de todos) num dia ou período: as tarefas não concluídas com prazo no período, as atrasadas (prazo antes de hoje) e as rotinas do escritório que caem no período (com a regra da agenda: dia útil, adiamento, fim de semana sem rotina). Sem "pessoa", é a agenda de quem pergunta.',
    input_schema: { type: 'object', properties: {
      pessoa: { type: 'string', description: 'nome da pessoa da equipe, ou "todos"; vazio = quem pergunta' },
      de: { type: 'string', description: 'AAAA-MM-DD (padrão: hoje)' }, ate: { type: 'string', description: 'AAAA-MM-DD (padrão: o mesmo dia de "de"); até 31 dias' },
      setor: { type: 'string', description: 'opcional: só um setor (dp, fiscal, contabil, financeiro, comercial, societario, irpf, gestao, clientes, geral)' },
      atrasadas: { type: 'boolean', description: 'incluir as atrasadas (prazo antes de hoje); padrão: sim' } } } },
  { name: 'consultar',
    description: 'Lê uma tabela do sistema (só leitura), com filtros, ordem, contagem, totais e agrupamento — as tabelas e colunas estão no dicionário de dados. Linhas com cliente_id já vêm com o nome da empresa; dados do cadastro da empresa entram como "empresa.<coluna>" (em colunas e em agrupar). A primeira linha da saída diz o total que bate com os filtros e, se não coube tudo, de onde seguir (a_partir_de). Para contar ou somar, use agrupar/somar: contam todas as linhas que batem, não só as mostradas.',
    input_schema: { type: 'object', properties: {
      tabela: { type: 'string', enum: Object.keys(TABELAS) },
      colunas: { type: 'array', items: { type: 'string' }, description: 'opcional: as colunas (padrão: as principais da tabela); "empresa.<coluna do cadastro>" traz o dado da empresa (ex.: empresa.regime_tributario)' },
      filtros: { type: 'array', description: 'condições, todas valem juntas (até ' + MAX_FILTROS + '); != também pega o vazio', items: { type: 'object', properties: {
        coluna: { type: 'string' }, op: { type: 'string', enum: OPS },
        valor: { description: 'texto, número ou booleano; lista para "em" (até ' + MAX_EM + '); nada para "vazio"/"preenchido". Datas AAAA-MM-DD (em data e hora, vale o dia em Brasília).' } }, required: ['coluna', 'op'] } },
      ordem: { type: 'array', items: { type: 'object', properties: { coluna: { type: 'string' }, desc: { type: 'boolean' } }, required: ['coluna'] } },
      limite: { type: 'integer', minimum: 1, maximum: 200, description: 'linhas (padrão 50)' },
      a_partir_de: { type: 'integer', minimum: 0, description: 'pular as primeiras linhas (a saída diz de onde seguir)' },
      carteira: { type: 'boolean', description: 'só em carteira_info: só os clientes da carteira hoje (entrada preenchida e sem saída, ou saída no futuro)' },
      agrupar: { type: 'string', description: 'opcional: conta (e soma) por valor desta coluna — ou de "empresa.<coluna>" —, em todas as linhas que batem com os filtros' },
      somar: { type: 'array', items: { type: 'string' }, description: 'opcional: colunas numéricas a somar em todas as linhas que batem com os filtros' } }, required: ['tabela'] } },
  { name: 'perguntar_reforma',
    description: 'Pergunta ao assistente da Reforma Tributária, que responde com a base do escritório (Base legal, materiais, casos da campanha e o simulador), com as fontes. Use para tudo da Reforma (IBS/CBS, opção por dentro × por fora em 2027, resultado e simulação dos casos da campanha) e da reforma da renda (Lei 15.270: IR até R$ 5 mil, retenção de 10% sobre lucros e dividendos, tributação mínima, lucros apurados até 2025). Uma vez por pergunta: junte tudo o que precisa saber dela numa pergunta só, que faça sentido sozinha (ele não vê esta conversa). Chame sozinha na rodada e sem procurar a empresa antes (ele acha pelo nome): assim a resposta dele, com as fontes, vai direto pro usuário. Com a ficha da Reforma aberta na tela, ele já sabe qual é a empresa.',
    input_schema: { type: 'object', properties: {
      pergunta: { type: 'string', description: 'a pergunta completa (a do usuário, completada com o que faltar: nome da empresa, período)' },
      devolver_direto: { type: 'boolean', description: 'padrão sim: a resposta dele vai direto pro usuário. Não, quando você ainda precisa cruzar com outros dados do sistema' } },
      required: ['pergunta'] } },
  { name: 'buscar_arquivos',
    description: 'Busca os arquivos de uma empresa: na pasta dela no Google Drive (com as subpastas — FISCAL, CONTÁBIL, DEPARTAMENTO PESSOAL, PROCESSOS, ALVARÁS, CERTIFICADO DIGITAL, DOC SÓCIO…; sem as notas em XML) e nas guias que o sistema arquivou (tela Obrigações fiscais). Devolve o nome, a pasta e a data de cada um, e a tela mostra o cartão com os links pra abrir. Use quando pedirem um arquivo, documento, guia, contrato, alvará, certificado, comprovante ou "o que tem no Drive" de uma empresa. Sem termo: os mais recentes. Só lê a lista: não abre o conteúdo dos arquivos.',
    input_schema: { type: 'object', properties: {
      empresa: { type: 'string', description: 'id, nome ou CNPJ (sem: a empresa aberta na tela)' },
      termo: { type: 'string', description: 'palavras do nome do arquivo ou da pasta, sem o nome da empresa (ex.: "contrato social", "alvará", "DAS setembro 2026"); sem: os mais recentes' } } } },
  // as propostas: nada muda aqui — a tela mostra o cartão, a pessoa confirma (e pode desfazer)
  { name: 'propor_concluir_tarefas',
    description: 'Prepara a conclusão de tarefas pra pessoa confirmar na tela — nada é concluído aqui: a tela mostra a lista (ela pode desmarcar alguma) com o botão "Concluir" e, depois, o "Desfazer". Só quando a pessoa pedir pra concluir ou marcar como feita(s). Diga quais: ids (de consultar), ou empresa, pessoa e/ou parte do título — prazo, setor e "atrasadas" afinam. Só tarefas abertas; até 300. Pediu pra deixar escrito no histórico o que foi feito ("conclui e anota que…"): mensagem — vai no histórico de cada uma, junto com a conclusão (a pessoa confere e edita no cartão).',
    input_schema: { type: 'object', properties: {
      ids: { type: 'array', items: { type: 'string' }, description: 'ids das tarefas (de consultar)' },
      empresa: { type: 'string', description: 'id, nome ou CNPJ da empresa' },
      pessoa: { type: 'string', description: 'o responsável (alguém da equipe)' },
      titulo: { type: 'string', description: 'parte do título (ex.: "EFD CONTRIBUIÇÕES")' },
      setor: { type: 'string', description: 'dp, fiscal, contabil, financeiro, comercial, societario, irpf, gestao, clientes ou geral' },
      prazo_de: { type: 'string', description: 'AAAA-MM-DD' }, prazo_ate: { type: 'string', description: 'AAAA-MM-DD' },
      atrasadas: { type: 'boolean', description: 'só as com prazo antes de hoje' },
      mensagem: { type: 'string', description: 'opcional, só quando a pessoa pedir: o que ela quer deixar escrito no histórico de cada uma (o que foi feito, como, quando), nas palavras dela, curto' } } } },
  { name: 'propor_alterar_tarefas',
    description: 'Prepara a mudança de prazo, de responsável e/ou de prioridade de tarefas pra pessoa confirmar na tela — nada muda aqui: a tela mostra cada tarefa com o antes e o depois (ela pode desmarcar alguma), o botão pra confirmar e, depois, o "Desfazer". Só quando a pessoa pedir pra remarcar, adiar, antecipar, passar pra outra pessoa ou mudar a prioridade. Diga quais — ids (de consultar), ou empresa, pessoa (o responsável de agora) e/ou parte do título; prazo, setor e "atrasadas" afinam — e o que muda: novo_prazo, novo_responsavel e/ou nova_prioridade. Só tarefas abertas; até 300. Nas de admissão, rescisão e alvará, o prazo e o responsável vêm da ficha de origem e não mudam por aqui (a prioridade, sim). Pediu pra deixar escrito no histórico o porquê ou o que aconteceu: mensagem — vai no histórico de cada uma, junto com a mudança.',
    input_schema: { type: 'object', properties: {
      ids: { type: 'array', items: { type: 'string' }, description: 'ids das tarefas (de consultar)' },
      empresa: { type: 'string', description: 'id, nome ou CNPJ da empresa' },
      pessoa: { type: 'string', description: 'o responsável de agora (alguém da equipe)' },
      titulo: { type: 'string', description: 'parte do título (ex.: "EFD CONTRIBUIÇÕES")' },
      setor: { type: 'string', description: 'dp, fiscal, contabil, financeiro, comercial, societario, irpf, gestao, clientes ou geral' },
      prazo_de: { type: 'string', description: 'o prazo de agora, a partir de (AAAA-MM-DD)' }, prazo_ate: { type: 'string', description: 'o prazo de agora, até (AAAA-MM-DD)' },
      atrasadas: { type: 'boolean', description: 'só as com prazo antes de hoje' },
      novo_prazo: { type: 'string', description: 'AAAA-MM-DD, pelo dia do contexto ("hoje", "amanhã", "sexta")' },
      novo_responsavel: { type: 'string', description: 'alguém da equipe, ou "Ambos" (Samuel e Diego)' },
      nova_prioridade: { type: 'string', enum: ['alta', 'media', 'baixa'], description: '"urgente" é alta' },
      mensagem: { type: 'string', description: 'opcional, só quando a pessoa pedir: o que ela quer deixar escrito no histórico de cada uma, nas palavras dela, curto' } } } },
  { name: 'propor_registrar_historico',
    description: 'Prepara uma mensagem no histórico de tarefas, sem concluir nem mudar nada nelas (o "Registrar andamento" da Agenda), pra pessoa conferir na tela — nada é gravado aqui: a tela mostra a mensagem (dá pra editar) e as tarefas (ela pode desmarcar alguma), com o botão "Registrar" e, depois, o "Desfazer". Só quando a pessoa pedir pra registrar, anotar ou escrever algo no histórico de tarefas que já existem (o que aconteceu, o que está esperando). Pra concluir junto: propor_concluir_tarefas com a mensagem; pra remarcar ou passar junto: propor_alterar_tarefas com a mensagem; pra uma tarefa nova: propor_criar_tarefa. Diga quais — ids (de consultar), ou empresa, pessoa e/ou parte do título; prazo, setor e "atrasadas" afinam — e a mensagem. Só tarefas abertas; até 300.',
    input_schema: { type: 'object', properties: {
      ids: { type: 'array', items: { type: 'string' }, description: 'ids das tarefas (de consultar)' },
      empresa: { type: 'string', description: 'id, nome ou CNPJ da empresa' },
      pessoa: { type: 'string', description: 'o responsável (alguém da equipe)' },
      titulo: { type: 'string', description: 'parte do título (ex.: "PGDAS")' },
      setor: { type: 'string', description: 'dp, fiscal, contabil, financeiro, comercial, societario, irpf, gestao, clientes ou geral' },
      prazo_de: { type: 'string', description: 'AAAA-MM-DD' }, prazo_ate: { type: 'string', description: 'AAAA-MM-DD' },
      atrasadas: { type: 'boolean', description: 'só as com prazo antes de hoje' },
      mensagem: { type: 'string', description: 'o que vai no histórico de cada uma, nas palavras da pessoa, curto' } }, required: ['mensagem'] } },
  { name: 'propor_marcar_pago',
    description: 'Prepara boletos de honorários pra pessoa marcar como pagos na tela — nada muda aqui: a tela mostra os boletos com o botão "Marcar como pago" e, depois, o "Desfazer". Só quando a pessoa disser que foram pagos. Diga quais: a empresa (uma ou várias) e a competência, ou os ids. Só os em aberto (a emitir, emitido, enviado); até 100.',
    input_schema: { type: 'object', properties: {
      empresas: { type: 'array', items: { type: 'string' }, description: 'id, nome ou CNPJ de cada empresa' },
      competencia: { type: 'string', description: "'AAAA-MM'" },
      ids: { type: 'array', items: { type: 'string' }, description: 'ids dos boletos (de consultar)' } } } },
  { name: 'propor_criar_tarefa',
    description: 'Prepara uma tarefa nova pra pessoa conferir e criar na tela — nada é criado aqui: a tela mostra a tarefa já preenchida (título, responsável, prazo, prioridade, setor) com o botão "Criar tarefa". Só quando a pessoa pedir pra criar, anotar ou lembrar de fazer algo.',
    input_schema: { type: 'object', properties: {
      titulo: { type: 'string', description: 'o que precisa ser feito' },
      responsavel: { type: 'string', description: 'alguém da equipe (sem: ninguém ainda)' },
      prazo: { type: 'string', description: 'AAAA-MM-DD (sem: hoje)' },
      setor: { type: 'string', description: 'clientes, dp, fiscal, contabil, societario, financeiro, comercial, irpf, gestao ou geral' },
      prioridade: { type: 'string', enum: ['alta', 'media', 'baixa'] },
      empresa: { type: 'string', description: 'id, nome ou CNPJ, se a tarefa é de uma empresa' },
      descricao: { type: 'string' } }, required: ['titulo'] } },
  { name: 'propor_enviar_mensagem',
    description: 'Prepara uma mensagem no chat da equipe (a aba Equipe do balão) pra pessoa conferir e enviar — nada é enviado aqui: a tela mostra a mensagem (dá pra editar) com o botão "Enviar" e, depois, o "Desfazer" (apaga a mensagem; quem já leu, leu). Só quando a pessoa pedir pra mandar, avisar, perguntar ou passar algo a alguém da equipe ou a um grupo do chat. A mensagem sai em nome de quem pede: escreva como ela escreveria — na primeira pessoa, curta e direta, sem assinatura. Pra mandar arquivo da empresa, chame buscar_arquivos antes e diga os arquivos pelo nome, como vieram na lista: a mensagem leva o link do Drive (o arquivo fica lá).',
    input_schema: { type: 'object', properties: {
      para: { type: 'array', items: { type: 'string' }, description: 'quem recebe: pessoas da equipe (cada uma na conversa a dois), "Escritório" (o grupo de todos) ou o nome de outro grupo do chat; até 6' },
      texto: { type: 'string', description: 'a mensagem, como a pessoa escreveria' },
      arquivos: { type: 'array', items: { type: 'string' }, description: 'opcional: os nomes dos arquivos que buscar_arquivos trouxe nesta pergunta (até 10)' } },
      required: ['para', 'texto'] } },
  { name: 'propor_revisao_atrasadas',
    description: 'Mostra na tela a revisão das tarefas atrasadas de alguém: grupo por grupo, a tela pergunta o que já foi feito e conclui o que a pessoa marcar (com "Desfazer"). Use quando pedirem pra passar as atrasadas a limpo — e, quando perguntarem das atrasadas de alguém da equipe, chame junto com a resposta: o cartão é a oferta (só mostra a pergunta; nada muda sem a pessoa).',
    input_schema: { type: 'object', properties: { pessoa: { type: 'string', description: 'alguém da equipe (sem: quem pergunta)' } } } },
  { name: 'propor_ver_vigia',
    description: 'Mostra na tela o cartão do vigia: o que ele achou, por grupo, cada achado com "Abrir" (a tela onde se resolve) e "Ignorar" — e, no que se resolve com um clique, o botão ali mesmo, com "Desfazer": o responsável que falta (obrigação sem responsável, que leva as tarefas abertas junto; tarefa e rotina sem responsável), descartar a proposta parada, marcar o boleto parado como enviado ou pago, marcar a admissão como registrada e a rescisão como concluída, vincular a empresa da admissão ou da rescisão sem vínculo (com a busca do cadastro), renovar o alvará (com a data nova), parar a cobrança e desativar a obrigação de ex-cliente, vincular as obrigações do regime ao cliente sem obrigação, pôr na cobrança o cliente sem cobrança e acertar o cadastro que não bate com a carteira. Use quando perguntarem o que o vigia achou, o que está desencontrado, esquecido ou pedindo atenção no sistema (de alguém, de um setor ou de todos), ou pedirem pra resolver um desses achados — chame junto com a resposta: o cartão é a oferta (só mostra; nada muda sem a pessoa).',
    input_schema: { type: 'object', properties: {
      pessoa: { type: 'string', description: 'alguém da equipe, ou "todos" (sem: quem pergunta)' },
      setor: { type: 'string', description: 'opcional: só um setor (dp, fiscal, contabil, financeiro, comercial, societario, irpf, gestao, clientes, geral)' } } } }
];

// ---------- formatação ----------
const fin = v => v != null && v !== '' && Number.isFinite(+v);
export const brl = v => fin(v) ? (+v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';
export const dataBR = iso => iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—';
// data e hora (timestamptz) → o dia em Brasília (UTC−3, sem horário de verão)
export const diaDoMomento = iso => { const d = new Date(iso || ''); return !iso || isNaN(d) ? '—' : dataBR(new Date(d.getTime() - 3 * 3600e3).toISOString()); };
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const corte = (s, n) => { const t = String(s); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
export function valorCurto(v, n = 280) {
  if (v == null || v === '') return '—';
  if (typeof v === 'object') return corte(JSON.stringify(v), 400);
  return corte(String(v).replace(/\s+/g, ' ').trim(), n);
}
export const normalizarBusca = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// só endereço do Google Drive ou Docs, https, sem usuário e porta (o mesmo filtro da tela: linkDoDrive, em assets/js/chat-equipe.js)
export function linkDrive(l) {
  try { const u = new URL(String(l || '')); return u.protocol === 'https:' && ['drive.google.com', 'docs.google.com'].includes(u.hostname) && !u.username && !u.password && !u.port ? u.href : null; }
  catch (e) { return null; }
}
const fmtDoc = d => { const x = String(d || '').replace(/\D/g, ''); return x.length === 14 ? x.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  : x.length === 11 ? x.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4') : (d || '—'); };
const maisDias = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const diaSeguinte = iso => maisDias(iso, 1);
const inicioBR = iso => iso + 'T00:00:00-03:00';
// a situação como a equipe fala (o banco grava em_transicao, a_emitir...)
const SITUACAO = { em_transicao: 'em transição', a_emitir: 'a emitir', em_andamento: 'em andamento', em_registro: 'em registro', concluida: 'concluída',
  em_preparacao: 'em preparação', opcao_registrada: 'opção registrada', por_dentro: 'por dentro', por_fora: 'por fora', a_confirmar: 'a confirmar', sem_acordo: 'sem acordo',
  aguardando_empresa: 'aguardando a empresa', a_faturar: 'a faturar', lancado: 'lançado', cnpj_novo: 'CNPJ novo', experiencia: 'experiência', media: 'média' };
export const situacao = v => (v == null || v === '' ? '—' : SITUACAO[v] || String(v).replace(/_/g, ' '));
// contagem por grupo ({ id, rotulo } de cada linha), do maior pro menor; topo: os n primeiros e "outras"
function contarPor(lista, chave) {
  const m = new Map();
  lista.forEach(x => { const k = chave(x); const g = m.get(k.id) || { id: k.id, rotulo: k.rotulo, n: 0 }; g.n++; m.set(k.id, g); });
  return [...m.values()].sort((a, b) => b.n - a.n || String(a.rotulo).localeCompare(String(b.rotulo), 'pt-BR'));
}
const topo = (grupos, n) => grupos.slice(0, n).map(g => g.rotulo + ' ' + g.n).join(' · ') + (grupos.length > n ? ' · outras ' + grupos.slice(n).reduce((s, g) => s + g.n, 0) : '');
// o nome da equipe pelo nome digitado (sem maiúscula e sem acento); "ambos" é Samuel e Diego
const equipePorNome = n => EQUIPE.find(x => normalizarBusca(x) === normalizarBusca(n)) || null;
function rotuloPessoa(v) {
  const n = normalizarBusca(v).trim();
  if (!n) return '(sem responsável)';
  if (n === 'ambos') return 'Ambos (Samuel e Diego)';
  return equipePorNome(n) || String(v).trim();
}

// ---------- montagem da consulta (PostgREST) ----------
const enc = v => encodeURIComponent(String(v));
const semCuringa = v => String(v).replace(/[*%]/g, '');
const aspas = v => '"' + String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
function valorDe(v) { if (typeof v === 'boolean') return v ? 'true' : 'false'; if (v == null) return 'null'; return String(v); }
// valor dentro de uma árvore (and/or): booleano solto, o resto entre aspas
const naArvore = v => (typeof v === 'boolean' ? valorDe(v) : aspas(valorDe(v)));

// um filtro da ferramenta → { params: os pedaços da URL, arvore: o pedaço do "and=(...)" (o != que também pega o vazio) }
export function montarFiltro(t, f) {
  const T = TABELAS[t];
  if (!f || typeof f !== 'object') throw new Error('filtro inválido');
  const c = String(f.coluna || '');
  if (!T.cols.includes(c)) throw new Error('a coluna "' + c + '" não é lida em ' + t + ' (colunas: ' + T.cols.join(', ') + ')');
  const op = String(f.op || '');
  const enumCol = (T.enums || []).includes(c);
  const v = f.valor;
  if (enumCol && ['contem', 'comeca_com', '>', '>=', '<', '<='].includes(op)) throw new Error('a coluna "' + c + '" só aceita =, != ou "em"');
  if (['=', '!=', '>', '>=', '<', '<=', 'contem', 'comeca_com'].includes(op) && (v == null || typeof v === 'object')) throw new Error('o filtro "' + op + '" em ' + c + ' precisa de um valor');
  // coluna de lista (os setores e as empresas de uma notícia): "=" e "contem" = a lista tem o valor; "em" = tem algum
  // deles; vazio = a lista vazia
  if ((T.arrays || []).includes(c)) {
    const lista = xs => enc('{' + xs.map(x => aspas(valorDe(x))).join(',') + '}');
    if (op === '=' || op === 'contem') return { params: [c + '=cs.' + lista([v])], arvore: null };
    if (op === '!=') return { params: [c + '=not.cs.' + lista([v])], arvore: null };
    if (op === 'em') {
      const xs = (Array.isArray(v) ? v : [v]).filter(x => x != null && typeof x !== 'object');
      if (!xs.length) throw new Error('o filtro "em" em ' + c + ' precisa de uma lista de valores');
      if (xs.length > MAX_EM) throw new Error('lista longa demais no "em" de ' + c + ' (' + xs.length + ' valores; até ' + MAX_EM + ')');
      return { params: [c + '=ov.' + lista(xs)], arvore: null };
    }
    if (op === 'vazio') return { params: [c + '=eq.' + enc('{}')], arvore: null };
    if (op === 'preenchido') return { params: [c + '=neq.' + enc('{}')], arvore: null };
    throw new Error('a coluna "' + c + '" é uma lista: só aceita =, contem, !=, em, vazio e preenchido');
  }
  const pessoa = typeof v === 'string' && PESSOA.has(c);
  // data sozinha numa coluna de data e hora: o dia inteiro em Brasília
  if (MOMENTO.test(c) && typeof v === 'string' && DATA.test(v) && ['=', '!=', '>', '>=', '<', '<='].includes(op)) {
    const ini = inicioBR(v), fim = inicioBR(diaSeguinte(v));
    if (op === '=') return { params: [c + '=gte.' + enc(ini), c + '=lt.' + enc(fim)], arvore: null };
    if (op === '!=') return { params: [], arvore: 'or(' + c + '.lt.' + aspas(ini) + ',' + c + '.gte.' + aspas(fim) + ',' + c + '.is.null)' };
    if (op === '>') return { params: [c + '=gte.' + enc(fim)], arvore: null };
    if (op === '>=') return { params: [c + '=gte.' + enc(ini)], arvore: null };
    if (op === '<') return { params: [c + '=lt.' + enc(ini)], arvore: null };
    return { params: [c + '=lt.' + enc(fim)], arvore: null };
  }
  const um = p => ({ params: [p], arvore: null });
  switch (op) {
    case '=': return um(pessoa ? c + '=ilike.' + enc(padraoPessoa(v)) : c + '=eq.' + enc(valorDe(v)));
    // diferente: o vazio também entra (no banco, "diferente" deixaria de fora quem não tem valor)
    case '!=': return { params: [], arvore: 'or(' + (pessoa ? c + '.not.ilike.' + aspas(padraoPessoa(v)) : c + '.neq.' + naArvore(v)) + ',' + c + '.is.null)' };
    case '>': return um(c + '=gt.' + enc(valorDe(v)));
    case '>=': return um(c + '=gte.' + enc(valorDe(v)));
    case '<': return um(c + '=lt.' + enc(valorDe(v)));
    case '<=': return um(c + '=lte.' + enc(valorDe(v)));
    case 'contem': return um(c + '=ilike.' + enc('*' + semCuringa(v) + '*'));
    case 'comeca_com': return um(c + '=ilike.' + enc(semCuringa(v) + '*'));
    case 'em': {
      const lista = (Array.isArray(v) ? v : [v]).filter(x => x != null && typeof x !== 'object');
      if (!lista.length) throw new Error('o filtro "em" em ' + c + ' precisa de uma lista de valores');
      if (lista.length > MAX_EM) throw new Error('lista longa demais no "em" de ' + c + ' (' + lista.length + ' valores; até ' + MAX_EM + '): use outro filtro' + (c === 'cliente_id' || c === 'id' ? ' — pros clientes da carteira, consulte carteira_info com carteira: true e "empresa.<coluna>"' : ''));
      return um(c + '=in.' + enc('(' + lista.map(x => typeof x === 'string' ? aspas(x) : valorDe(x)).join(',') + ')'));
    }
    case 'vazio': return um(c + '=is.null');
    case 'preenchido': return um(c + '=not.is.null');
    default: throw new Error('operação "' + op + '" não existe (use: ' + OPS.join(', ') + ')');
  }
}
// o filtro do responsável nas tarefas: sem maiúscula e sem acento; Samuel e Diego levam junto o "Ambos"
export const filtroPessoa = nome => (['samuel', 'diego'].includes(normalizarBusca(nome))
  ? 'or=' + enc('(responsavel.ilike.' + padraoPessoa(nome) + ',responsavel.ilike.ambos)') : 'responsavel=ilike.' + enc(padraoPessoa(nome)));
// no vigia, os sócios levam também o que é da Edna (que não tem login) e o que não tem dono — como no cartão (assets/js/vigia.js)
export const filtroPessoaVigia = nome => (['samuel', 'diego'].includes(normalizarBusca(nome))
  ? 'or=' + enc('(responsavel.ilike.' + padraoPessoa(nome) + ',responsavel.ilike.ambos,responsavel.ilike.edna,responsavel.is.null)') : 'responsavel=ilike.' + enc(padraoPessoa(nome)));
// o filtro em texto de URL (o != vira "and=(...)")
export function filtroUrl(t, f) {
  const r = montarFiltro(t, f);
  return r.arvore ? 'and=' + enc('(' + r.arvore + ')') : r.params.join('&');
}

// "empresa.<coluna>": um dado do cadastro da empresa da linha (a tabela precisa ter cliente_id)
function colunaDaEmpresa(t, c) {
  const m = /^empresa\.([a-z_]+)$/.exec(String(c));
  if (!m) return null;
  if (!COM_EMPRESA(t)) throw new Error('"' + c + '": ' + t + ' não tem empresa (cliente_id)');
  if (!TABELAS.clientes.cols.includes(m[1])) throw new Error('"' + c + '": a coluna ' + m[1] + ' não é lida no cadastro (colunas: ' + TABELAS.clientes.cols.join(', ') + ')');
  return m[1];
}

// a consulta inteira (sem limite e posição: quem chama põe)
export function montarConsulta(e, { hoje = null } = {}) {
  const t = String(e.tabela || '');
  const T = TABELAS[t];
  if (!T) throw new Error('a tabela "' + t + '" não é lida (tabelas: ' + Object.keys(TABELAS).join(', ') + ')');
  const pedidas = Array.isArray(e.colunas) && e.colunas.length ? [...new Set(e.colunas.map(String))] : T.padrao;
  const extras = [], colunas = [];
  pedidas.forEach(c => { const x = colunaDaEmpresa(t, c); if (x) extras.push(x); else colunas.push(c); });
  const fora = colunas.filter(c => !T.cols.includes(c));
  if (fora.length) throw new Error('coluna(s) que não são lidas em ' + t + ': ' + fora.join(', ') + ' (colunas: ' + T.cols.join(', ') + ')');
  if (extras.length && !colunas.includes('cliente_id')) colunas.push('cliente_id');
  if (!colunas.length) colunas.push(...T.padrao);
  const brutos = Array.isArray(e.filtros) ? e.filtros : [];
  if (brutos.length > MAX_FILTROS) throw new Error('filtros demais (' + brutos.length + '; até ' + MAX_FILTROS + ')');
  const filtros = [], arvore = [];
  brutos.forEach(f => { const r = montarFiltro(t, f); filtros.push(...r.params); if (r.arvore) arvore.push(r.arvore); });
  if (e.carteira) {
    if (t !== 'carteira_info') throw new Error('"carteira" só vale em carteira_info (o dado do cadastro vem como "empresa.<coluna>")');
    if (!hoje) throw new Error('sem a data de hoje');
    filtros.push('entrada=not.is.null', 'or=' + enc('(saida.is.null,saida.gt.' + hoje + ')'));
  }
  const ordem = (Array.isArray(e.ordem) ? e.ordem : []).slice(0, 3).map(o => {
    const c = String((o && o.coluna) || '');
    if (!T.cols.includes(c)) throw new Error('não dá pra ordenar por "' + c + '" em ' + t);
    return c + (o.desc ? '.desc' : '.asc') + '.nullslast';
  });
  return { t, T, colunas, extras, filtros, arvore, ordem };
}

// ---------- as ferramentas ----------
// banco.ler(caminho, { contar }) → { linhas, total } (o servidor faz a chamada com o login de quem pergunta)
// contexto: { cliente_id, caso_id, pagina }; usuario: { email, nome, socio }; hoje: 'AAAA-MM-DD' (Brasília)
// perguntarReforma(pergunta) → { texto, cortada } (erro com a frase pro usuário); deveFinalizar(): o tempo da pergunta
// está acabando (a resposta da Reforma vai direto, sem outra rodada)
export function criarFerramentas({ banco, contexto = {}, usuario = {}, hoje, perguntarReforma, deveFinalizar = () => false, aoPropor = () => {}, drive = null }) {
  const ler = (caminho, op) => banco.ler(caminho, op);

  // o cadastro das empresas dos ids (o nome sempre; as outras colunas, quando pedidas)
  async function cadastroDe(ids, cols = []) {
    const lista = [...new Set(ids.filter(x => UUID.test(String(x))))];
    const sel = [...new Set(['id', 'nome_principal', ...cols])].join(',');
    const mapa = new Map();
    for (let i = 0; i < lista.length; i += 80) {
      const { linhas } = await ler('clientes?select=' + sel + '&id=in.(' + lista.slice(i, i + 80).join(',') + ')');
      linhas.forEach(c => mapa.set(c.id, c));
    }
    return mapa;
  }
  async function comEmpresa(linhas, extras = []) {
    if (!linhas.some(l => l && l.cliente_id)) return linhas;
    const mapa = await cadastroDe(linhas.map(l => l.cliente_id), extras);
    return linhas.map(l => {
      if (!l || !('cliente_id' in l)) return l;
      const o = {};
      Object.entries(l).forEach(([k, v]) => {
        o[k] = v;
        if (k !== 'cliente_id') return;
        const c = v ? mapa.get(v) : null;
        o.empresa = v ? (c ? c.nome_principal : '(cadastro não encontrado)') : '(sem vínculo)';
        extras.forEach(x => { o['empresa.' + x] = c ? c[x] : null; });
      });
      return o;
    });
  }
  const linhaTexto = l => Object.entries(l).map(([k, v]) => k + ': ' + valorCurto(v)).join(' · ');
  // a fonte da notícia pelo nome (no lugar do fonte_id) e a lista de empresas (as que a notícia alcança) com quantas e os
  // nomes — sem isso, a saída seria uma fila de ids
  const MAX_NOMES = 8, MAX_NOTICIAS_EMPRESA = 10;
  const PESO_RELEVANCIA = { alta: 0, media: 1, baixa: 2 };
  async function comNomes(T, linhas) {
    let out = linhas;
    if (T.fonte && out.some(l => l && l.fonte_id)) {
      const ids = [...new Set(out.map(l => l && l.fonte_id).filter(x => UUID.test(String(x))))];
      const { linhas: fs } = ids.length ? await ler('noticias_fontes?select=id,nome&id=in.(' + ids.join(',') + ')') : { linhas: [] };
      const nomes = new Map(fs.map(f => [f.id, f.nome]));
      out = out.map(l => { if (!l || !('fonte_id' in l)) return l; const o = {}; Object.entries(l).forEach(([k, v]) => { if (k === 'fonte_id') o.fonte = nomes.get(v) || '—'; else o[k] = v; }); return o; });
    }
    const c = T.empresas;
    if (c && out.some(l => l && Array.isArray(l[c]) && l[c].length)) {
      const cad = await cadastroDe(out.flatMap(l => (l && Array.isArray(l[c]) ? l[c] : [])));
      out = out.map(l => (!l || !Array.isArray(l[c]) ? l : { ...l, [c]: !l[c].length ? 'nenhuma' : l[c].length + ' — ' + l[c].slice(0, MAX_NOMES).map(id => (cad.get(id) || {}).nome_principal || '(cadastro não encontrado)').join(', ')
        + (l[c].length > MAX_NOMES ? ' e mais ' + (l[c].length - MAX_NOMES) : '') }));
    }
    return out;
  }

  // a empresa pelo id, nome ou CNPJ (uma só; várias → lista pra escolher)
  async function acharEmpresa(termo) {
    const t = String(termo || '').trim();
    if (!t) {
      if (contexto.cliente_id) return { id: contexto.cliente_id };
      if (contexto.caso_id) {
        const { linhas } = await ler('rt_casos?select=cliente_id&id=eq.' + contexto.caso_id);
        if (linhas[0] && linhas[0].cliente_id) return { id: linhas[0].cliente_id };
      }
      return { erro: 'Nenhuma empresa aberta na tela: diga o nome da empresa.' };
    }
    if (UUID.test(t)) return { id: t };
    const achadas = await procurar(t, 10);
    if (!achadas.length) return { erro: 'Nenhuma empresa no cadastro com "' + t + '".' };
    if (achadas.length === 1) return { id: achadas[0].id };
    const nt = normalizarBusca(t).replace(/[^a-z0-9]/g, '');
    const exatas = achadas.filter(c => [c.nome_principal, c.nome_fantasia].some(n => n && normalizarBusca(n).replace(/[^a-z0-9]/g, '') === nt));
    if (exatas.length === 1) return { id: exatas[0].id };
    return { erro: 'Mais de uma empresa com "' + t + '":\n' + achadas.map(c => '- ' + c.nome_principal + (c.nome_fantasia ? ' (' + c.nome_fantasia + ')' : '') + ' · ' + fmtDoc(c.documento) + ' · id ' + c.id).join('\n') + '\nDiga qual (pelo id).' };
  }

  // a busca no nome_busca (minúsculas, sem acento e sem espaço: nome + fantasia + documento). Duas leituras: quem começa
  // com o termo e quem tem cada palavra — e a ordem põe a exata primeiro
  const PALAVRAS_FORA = new Set(['ltda', 'me', 'epp', 'eireli', 'sa', 'cia', 'e', 'de', 'da', 'do', 'dos', 'das', 'slu', 'mei']);
  async function procurar(termo, limite) {
    const n = normalizarBusca(termo);
    const nt = n.replace(/[^a-z0-9]/g, '');
    const digitos = n.replace(/\D/g, '');
    const sel = 'clientes?select=id,nome_principal,nome_fantasia,documento,tipo_pessoa,regime_tributario,status,cidade,uf&';
    let filtro;
    const soNumero = digitos.length >= 5 && digitos.length >= nt.length - 1;
    if (soNumero) filtro = 'nome_busca=ilike.' + enc('*' + digitos + '*');
    else {
      const ws = n.replace(/[^a-z0-9]+/g, ' ').split(' ').filter(w => w.length >= 2 && !PALAVRAS_FORA.has(w)).slice(0, 5);
      if (!ws.length) return [];
      filtro = ws.length === 1 ? 'nome_busca=ilike.' + enc('*' + ws[0] + '*') : 'and=' + enc('(' + ws.map(w => 'nome_busca.ilike.*' + w + '*').join(',') + ')');
    }
    const [comeco, todas] = await Promise.all([
      soNumero || nt.length < 2 ? Promise.resolve({ linhas: [] }) : ler(sel + 'nome_busca=ilike.' + enc(nt + '*') + '&limit=50'),
      ler(sel + filtro + '&limit=300')
    ]);
    const porId = new Map();
    [...comeco.linhas, ...todas.linhas].forEach(c => porId.set(c.id, c));
    const nota = c => { const nomes = [c.nome_principal, c.nome_fantasia].filter(Boolean).map(x => normalizarBusca(x).replace(/[^a-z0-9]/g, ''));
      return (nomes.some(x => x === nt) ? 0 : nomes.some(x => x.startsWith(nt)) ? 1 : 2) * 2 + (c.status === 'ativo' ? 0 : 1); };
    return [...porId.values()].sort((a, b) => nota(a) - nota(b) || String(a.nome_principal).localeCompare(String(b.nome_principal), 'pt-BR')).slice(0, limite);
  }

  async function buscar_empresa(e) {
    const termo = String(e.termo || '').trim();
    if (!termo) return 'Diga o nome ou o CNPJ.';
    const achadas = await procurar(termo, Math.max(1, Math.min(15, +e.limite || 8)));
    if (!achadas.length) return 'Nenhuma empresa no cadastro com "' + termo + '".';
    const { linhas: cart } = await ler('carteira_info?select=cliente_id,entrada,saida,inadimplente_desde&cliente_id=in.(' + achadas.map(c => c.id).join(',') + ')');
    const porId = new Map(cart.map(c => [c.cliente_id, c]));
    return achadas.length + ' encontrada(s):\n' + achadas.map(c => {
      const k = porId.get(c.id);
      const carteira = !k ? 'fora da carteira' : k.saida && String(k.saida).slice(0, 10) <= hoje ? 'saiu da carteira em ' + dataBR(k.saida)
        : 'na carteira desde ' + dataBR(k.entrada) + (k.saida ? ' (saída marcada pra ' + dataBR(k.saida) + ')' : '') + (k.inadimplente_desde ? ', inadimplente desde ' + dataBR(k.inadimplente_desde) : '');
      return '- ' + c.nome_principal + (c.nome_fantasia && c.nome_fantasia !== c.nome_principal ? ' (' + c.nome_fantasia + ')' : '') + ' · ' + c.tipo_pessoa + ' ' + fmtDoc(c.documento)
        + ' · ' + (c.regime_tributario || 'regime não cadastrado') + ' · ' + [c.cidade, c.uf].filter(Boolean).join('/') + ' · cadastro ' + c.status + ' · ' + carteira + ' · id ' + c.id;
    }).join('\n');
  }

  async function ver_empresa(e) {
    const a = await acharEmpresa(e.empresa);
    if (a.erro) return a.erro;
    const id = a.id;
    const q = (caminho, op) => ler(caminho, op).then(r => r, err => ({ erro: (err && err.message) || 'erro' }));
    const desde30 = inicioBR(maisDias(hoje, -30));
    const [cad, cart, soc, cont, serv, cobC, cobM, tar, rec, obr, alv, cert, adm, res, rt, reu, trE, reg, prec, fat, dre, fr, vig, nots, rev, rcE, rcP, rcM] = await Promise.all([
      q('clientes?select=' + TABELAS.clientes.cols.join(',') + '&id=eq.' + id),
      q('carteira_info?select=entrada,saida,motivo_saida,segmento,sistemas,contab_digital,contato,ramo,observacao,inadimplente_desde&cliente_id=eq.' + id),
      q('socios?select=nome,qualificacao,participacao_percentual,eh_administrador,telefone,email&cliente_id=eq.' + id + '&order=participacao_percentual.desc.nullslast'),
      q('contatos?select=nome,papel,telefone,email,eh_principal&cliente_id=eq.' + id),
      q('servicos_contratados?select=setor,responsavel_escritorio,data_inicio,data_fim,ativo&cliente_id=eq.' + id),
      q('cobrancas_config?select=valor_base,dia_vencimento,canal,contato_envio,destino,responsavel,ativo,observacao_fixa&cliente_id=eq.' + id),
      q('cobrancas_mensais?select=competencia,valor,vencimento,status,canal&cliente_id=eq.' + id + '&order=competencia.desc&limit=6'),
      q('tarefas?select=setor,titulo,responsavel,prazo,status,prioridade&cliente_id=eq.' + id + '&status=neq.concluida&order=prazo.asc.nullslast,id.asc&limit=500', { contar: true }),
      q('tarefas_recorrentes?select=setor,titulo,periodicidade,dia_vencimento,mes_vencimento,responsavel&cliente_id=eq.' + id + '&ativo=eq.true&order=setor.asc,id.asc&limit=40', { contar: true }),
      q('cliente_obrigacoes?select=obrigacao_id,responsavel,dia_prazo_override&cliente_id=eq.' + id + '&ativo=eq.true'),
      q('alvaras?select=tipo,numero,vencimento,status,responsavel&cliente_id=eq.' + id + '&order=vencimento.asc.nullslast'),
      q('certificados_digitais?select=titular,tipo,certificadora,validade,acompanhar,avisado_em&cliente_id=eq.' + id + '&order=validade.asc'),
      q('admissoes?select=funcionario_nome,data_inicio,status,responsavel,criado_em&cliente_id=eq.' + id + '&order=criado_em.desc&limit=5', { contar: true }),
      q('rescisoes?select=funcionario_nome,tipo,ultimo_dia,data_acerto,status,responsavel&cliente_id=eq.' + id + '&order=criado_em.desc&limit=5', { contar: true }),
      q('rt_casos?select=id,triagem,decisao,status,comunicado_em,sim_custo_dentro&cliente_id=eq.' + id),
      q('reunioes?select=data_reuniao,hora,titulo,status&cliente_id=eq.' + id + '&order=data_reuniao.desc&limit=4'),
      q('transicao_empresas?select=transicao_id&cliente_id=eq.' + id),
      q('regularizacoes?select=campanha,status,total_debitos,prazo_final&cliente_id=eq.' + id),
      q('precificacoes?select=status,honorario,taxa_unica,criado_em&cliente_id=eq.' + id + '&order=criado_em.desc&limit=3'),
      q('faturaveis?select=descricao,valor,executado_em&cliente_id=eq.' + id + '&status=eq.a_faturar'),
      q('dre_simples?select=periodo,criado_em&cliente_id=eq.' + id + '&order=criado_em.desc&limit=3'),
      q('fr_empresas?select=nome,ativo&cliente_id=eq.' + id),
      q('vigia_achados?select=titulo,detalhe,responsavel,gravidade&cliente_id=eq.' + id + '&situacao=eq.aberto' + (usuario.socio ? '' : '&' + TABELAS.vigia_achados.fixoNaoSocio) + '&limit=20'),
      // as notícias do feed que a alcançam (as principais, dos últimos 30 dias; a ordem é feita aqui)
      q('noticias?select=titulo,publicada_em,coletada_em,relevancia,setores,acao,prazo,prazo_o_que,clientes&situacao=eq.triada&grupo=is.null&clientes=cs.' + enc('{' + id + '}')
        + '&coletada_em=gte.' + enc(desde30) + '&order=coletada_em.desc&limit=60', { contar: true }),
      // a revisão do honorário (Precificação › Carteira): só os sócios
      usuario.socio ? q('revisoes_honorario?select=status,honorario_atual,fonte_atual,honorario_sugerido,honorario_novo,vigencia,criado_em,atualizado_em,aplicado_em&cliente_id=eq.' + id + '&order=atualizado_em.desc.nullslast&limit=1')
        : Promise.resolve({ linhas: [] }),
      // a Receita pela ponte (Integra Contador): a autorização, a situação fiscal, o PGDAS e a Caixa Postal
      q('receita_empresas?select=autorizacao,autorizacao_ate,autorizacao_em,pgdas_em,pendencias,situacao_fiscal_em&cliente_id=eq.' + id),
      q('receita_pgdas?select=competencia,transmitida_em,das_pago,receita_mes,receita_12_meses&cliente_id=eq.' + id + '&order=competencia.desc&limit=6'),
      q('receita_mensagens?select=assunto,enviada_em,origem,lida&cliente_id=eq.' + id + '&order=enviada_em.desc.nullslast,recebida_em.desc&limit=5')
    ]);
    if (cad.erro) throw new Error(cad.erro);
    const c = cad.linhas[0];
    if (!c) return 'Nenhuma empresa no cadastro com o id ' + id + '.';
    const partes = [];
    const sec = (titulo, r, fn, vazio = 'nada') => {
      if (r.erro) { partes.push(titulo + ': não consegui ler.'); return; }
      partes.push(titulo + ': ' + (r.linhas.length ? fn(r.linhas, r.total) : vazio));
    };
    partes.push('EMPRESA: ' + c.nome_principal + (c.nome_fantasia ? ' (fantasia: ' + c.nome_fantasia + ')' : '') + ' · id ' + c.id);
    partes.push('Cadastro: ' + c.tipo_pessoa + ' ' + fmtDoc(c.documento) + ' · regime ' + (c.regime_tributario || 'não cadastrado') + (c.porte_empresa ? ' · porte ' + c.porte_empresa : '')
      + ' · situação no cadastro: ' + situacao(c.status) + (c.cnae_principal ? ' · CNAE ' + c.cnae_principal : '') + (Array.isArray(c.cnaes_secundarios) && c.cnaes_secundarios.length ? ' (+' + c.cnaes_secundarios.length + ' secundários)' : '')
      + (c.natureza_juridica ? ' · ' + c.natureza_juridica : '') + (c.data_abertura ? ' · aberta em ' + dataBR(c.data_abertura) : '') + (fin(c.capital_social) ? ' · capital ' + brl(c.capital_social) : '')
      + (c.inscricao_estadual ? ' · IE ' + c.inscricao_estadual : '') + (c.inscricao_municipal ? ' · IM ' + c.inscricao_municipal : ''));
    partes.push('Endereço e contato: ' + [c.logradouro && (c.logradouro + (c.numero ? ', ' + c.numero : '') + (c.complemento ? ' ' + c.complemento : '')), c.bairro, [c.cidade, c.uf].filter(Boolean).join('/'), c.cep].filter(Boolean).join(' · ')
      + (c.email_principal ? ' · ' + c.email_principal : '') + (c.telefone_principal ? ' · ' + c.telefone_principal : '') + (c.drive_folder_url ? ' · pasta no Drive: ' + c.drive_folder_url : ''));
    if (c.data_inicio_cliente || c.data_fim_cliente) partes.push('Cliente (cadastro): desde ' + dataBR(c.data_inicio_cliente) + (c.data_fim_cliente ? ' até ' + dataBR(c.data_fim_cliente) : ''));
    if (c.observacoes) partes.push('Observações do cadastro: ' + valorCurto(c.observacoes, 500));
    sec('Carteira', cart, ([k]) => (k.saida && String(k.saida).slice(0, 10) <= hoje ? 'SAIU em ' + dataBR(k.saida) + (k.motivo_saida ? ' (' + valorCurto(k.motivo_saida, 120) + ')' : '') : 'cliente desde ' + dataBR(k.entrada) + (k.saida ? ', saída marcada pra ' + dataBR(k.saida) : ''))
      + (k.inadimplente_desde ? ' · INADIMPLENTE desde ' + dataBR(k.inadimplente_desde) : '') + (k.segmento ? ' · ' + k.segmento : '') + (k.ramo ? ' · ramo: ' + k.ramo : '')
      + (k.sistemas ? ' · sistemas: ' + k.sistemas : '') + (k.contab_digital ? ' · contabilidade digital' : '') + (k.contato ? ' · contato: ' + k.contato : '') + (k.observacao ? ' · obs.: ' + valorCurto(k.observacao, 200) : ''), 'fora da carteira');
    sec('Sócios', soc, ls => ls.map(s => s.nome + (fin(s.participacao_percentual) ? ' ' + (+s.participacao_percentual).toLocaleString('pt-BR') + '%' : '') + (s.qualificacao ? ' (' + s.qualificacao + ')' : '')
      + (s.eh_administrador ? ', administrador' : '') + (s.telefone ? ', ' + s.telefone : '') + (s.email ? ', ' + s.email : '')).join(' · '), 'nenhum cadastrado');
    sec('Contatos', cont, ls => ls.map(k => k.nome + (k.papel ? ' (' + k.papel + ')' : '') + (k.telefone ? ', ' + k.telefone : '') + (k.email ? ', ' + k.email : '') + (k.eh_principal ? ' — principal' : '')).join(' · '), 'nenhum');
    sec('Serviços contratados', serv, ls => ls.map(s => s.setor + (s.responsavel_escritorio ? ' (' + s.responsavel_escritorio + ')' : '') + (s.ativo === false || s.data_fim ? ' — encerrado' + (s.data_fim ? ' em ' + dataBR(s.data_fim) : '') : '')).join(' · '), 'nenhum registrado');
    sec('Honorários (base de cobrança)', cobC, ls => ls.map(b => brl(b.valor_base) + ' · vence dia ' + (b.dia_vencimento || '—') + ' · ' + (b.canal || '—') + (b.ativo === false ? ' · PARADA (não é mais cobrada)' : '')
      + (b.responsavel ? ' · ' + b.responsavel : '') + (b.observacao_fixa ? ' · ' + valorCurto(b.observacao_fixa, 120) : '')).join(' | '), 'sem cobrança cadastrada');
    sec('Últimos boletos', cobM, ls => ls.map(b => b.competencia + ': ' + brl(b.valor) + ', vence ' + dataBR(b.vencimento) + ', ' + situacao(b.status)).join(' · '));
    // as tarefas abertas: as contas de todas (atrasadas, da semana, por setor e pessoa) e as primeiras por prazo
    sec('Tarefas abertas', tar, (ls, total) => {
      const n = Math.max(total || 0, ls.length), semana = maisDias(hoje, 7);
      const atr = ls.filter(t => t.prazo && String(t.prazo) < hoje).length, sem = ls.filter(t => !t.prazo).length;
      const proximas = ls.filter(t => t.prazo && String(t.prazo) >= hoje && String(t.prazo) <= semana).length;
      const porSetor = contarPor(ls, t => { const p = rotuloPessoa(t.responsavel); return { id: t.setor + '|' + p, rotulo: (t.setor || '—') + (p.startsWith('(') ? ' ' + p : ' (' + p + ')') }; });
      return n + (ls.length < n ? ' (as contas são das ' + ls.length + ' primeiras por prazo)' : '') + ' — atrasadas ' + atr + ' · vencem de hoje a ' + dataBR(semana) + ': ' + proximas
        + ' · depois: ' + (ls.length - atr - proximas - sem) + (sem ? ' · sem prazo: ' + sem : '') + ' · por setor: ' + topo(porSetor, 8)
        + '\n  as primeiras por prazo: ' + ls.slice(0, 20).map(t => dataBR(t.prazo) + (t.prazo && String(t.prazo) < hoje ? ' (ATRASADA)' : '') + ' · ' + t.setor + ' · ' + valorCurto(t.titulo, 90)
          + ' · ' + (t.responsavel || 'sem responsável') + ' · ' + situacao(t.status) + (t.prioridade ? ' · ' + situacao(t.prioridade) : '')).join(' | ') + (n > 20 ? ' | … mais ' + (n - 20) + ' (as contas acima incluem todas)' : '');
    }, 'nenhuma');
    sec('Tarefas recorrentes', rec, (ls, total) => (total || ls.length) + ' — ' + ls.map(r => r.setor + ': ' + valorCurto(r.titulo, 60) + ' (' + r.periodicidade + (r.dia_vencimento ? ', dia ' + r.dia_vencimento : '') + ')').join(' · '), 'nenhuma');
    if (obr.erro) partes.push('Obrigações: não consegui ler.');
    else if (!obr.linhas.length) partes.push('Obrigações: nenhuma vinculada.');
    else {
      const ids = [...new Set(obr.linhas.map(o => o.obrigacao_id).filter(Boolean))];
      const { linhas: cat } = ids.length ? await q('obrigacoes_fiscais?select=id,nome,periodicidade,dia_prazo&id=in.(' + ids.join(',') + ')').then(r => r.erro ? { linhas: [] } : r) : { linhas: [] };
      const nomes = new Map(cat.map(o => [o.id, o]));
      partes.push('Obrigações: ' + obr.linhas.map(o => { const x = nomes.get(o.obrigacao_id) || {}; return (x.nome || 'obrigação') + ' (' + (x.periodicidade || '—') + ', dia ' + (o.dia_prazo_override || x.dia_prazo || '—') + (o.responsavel ? ', ' + o.responsavel : '') + ')'; }).join(' · '));
    }
    sec('Alvarás', alv, ls => ls.map(x => x.tipo + (x.numero ? ' nº ' + x.numero : '') + ', vence ' + dataBR(x.vencimento) + (x.vencimento && String(x.vencimento) < hoje ? ' (VENCIDO)' : '') + ', ' + situacao(x.status)).join(' · '), 'nenhum');
    sec('Certificados digitais', cert, ls => ls.map(x => (x.tipo ? x.tipo + ' ' : '') + 'de ' + x.titular + (x.certificadora ? ' (certificadora ' + x.certificadora + ')' : '') + ', vence ' + dataBR(x.validade)
      + (x.validade && String(x.validade) < hoje ? ' (VENCIDO)' : '') + (x.acompanhar === false ? ', não acompanha mais' : '')
      + (x.avisado_em ? ', cliente avisado em ' + diaDoMomento(x.avisado_em) : '')).join(' · '), 'nenhum cadastrado');
    // a Receita pela ponte: sem linha nenhuma, a ponte ainda não consultou esta empresa
    if (!rcE.erro && !rcP.erro && !rcM.erro && (rcE.linhas.length || rcP.linhas.length || rcM.linhas.length)) {
      const r = rcE.linhas[0] || {};
      const pend = Array.isArray(r.pendencias) ? r.pendencias : null;
      const pedacos = [];
      if (r.autorizacao) pedacos.push('autorização do escritório: ' + (r.autorizacao === 'ativa' ? 'ativa' + (r.autorizacao_ate ? ' até ' + dataBR(r.autorizacao_ate) : '') : r.autorizacao === 'vencida' ? 'VENCIDA' : 'NÃO TEM (a Receita recusou a consulta)'));
      if (pend) pedacos.push('situação fiscal de ' + dataBR(r.situacao_fiscal_em) + ': ' + (pend.length ? pend.map(x => (x.orgao || 'Receita') + ', ' + x.titulo).join(' · ') : 'sem pendência'));
      if (rcP.linhas.length) pedacos.push('PGDAS: ' + rcP.linhas.map(p => p.competencia + (p.transmitida_em ? ' transmitido em ' + diaDoMomento(p.transmitida_em) : ' sem transmissão')
        + (p.das_pago === true ? ', DAS pago' : p.das_pago === false ? ', DAS NÃO pago' : '') + (fin(p.receita_12_meses) ? ', receita do mês ' + brl(p.receita_mes) + ' e dos 12 meses ' + brl(p.receita_12_meses) : '')).join(' · '));
      if (rcM.linhas.length) pedacos.push('Caixa Postal: ' + rcM.linhas.map(m => valorCurto(m.assunto, 90) + (m.enviada_em ? ' (' + dataBR(m.enviada_em) + ')' : '') + (m.origem && m.origem !== 'Receita' ? ' [' + m.origem + ']' : '') + (m.lida ? '' : ', não lida')).join(' · '));
      partes.push('Receita (pela ponte do Integra Contador, só consulta): ' + (pedacos.join(' | ') || 'consultada, sem dado') + (r.pgdas_em ? ' — PGDAS consultado em ' + diaDoMomento(r.pgdas_em) : ''));
    }
    sec('Admissões', adm, (ls, total) => (total || ls.length) + ' — ' + ls.map(x => x.funcionario_nome + ' (início ' + dataBR(x.data_inicio) + ', ' + (x.status === 'respondida' ? 'recebida, a registrar' : situacao(x.status)) + ')').join(' · '), 'nenhuma');
    sec('Rescisões', res, (ls, total) => (total || ls.length) + ' — ' + ls.map(x => x.funcionario_nome + ' (' + situacao(x.tipo) + ', último dia ' + dataBR(x.ultimo_dia) + ', pagar até ' + dataBR(x.data_acerto) + ', '
      + (x.status === 'recebida' ? 'recebida, a calcular' : situacao(x.status)) + ')').join(' · '), 'nenhuma');
    // da Reforma, só a situação: o resultado da simulação (com a confiança e o porquê) quem diz é o assistente da Reforma
    sec('Reforma Tributária', rt, ls => ls.map(x => 'caso ' + situacao(x.status) + ', decisão gravada: ' + situacao(x.decisao) + (x.triagem ? ', triagem ' + situacao(x.triagem) : '') + (x.comunicado_em ? ', comunicado em ' + dataBR(x.comunicado_em) : '')
      + (fin(x.sim_custo_dentro) ? ', já simulado' : ', sem simulação')).join(' · ') + ' — o resultado da simulação e o porquê: perguntar_reforma', 'não está na campanha');
    sec('Reuniões', reu, ls => ls.map(x => dataBR(x.data_reuniao) + (x.hora ? ' ' + String(x.hora).slice(0, 5) : '') + ' · ' + valorCurto(x.titulo, 70) + ' · ' + situacao(x.status)).join(' | '), 'nenhuma');
    if (!trE.erro && trE.linhas.length) {
      const { linhas: trs = [] } = await q('transicoes?select=titulo,tipo,status,inicio,previsao_fim,padrinho&id=in.(' + trE.linhas.map(x => x.transicao_id).filter(Boolean).join(',') + ')');
      if (trs.length) partes.push('Transições: ' + trs.map(x => valorCurto(x.titulo, 60) + ' (' + situacao(x.tipo) + ', ' + situacao(x.status) + ', início ' + dataBR(x.inicio) + (x.previsao_fim ? ', previsão ' + dataBR(x.previsao_fim) : '') + (x.padrinho ? ', padrinho ' + x.padrinho : '') + ')').join(' · '));
    }
    if (!reg.erro && reg.linhas.length) partes.push('Regularizações: ' + reg.linhas.map(x => (x.campanha || 'regularização') + ' (' + situacao(x.status) + ', débitos ' + brl(x.total_debitos) + (x.prazo_final ? ', prazo ' + dataBR(x.prazo_final) : '') + ')').join(' · '));
    if (!prec.erro && prec.linhas.length) partes.push('Propostas de honorários: ' + prec.linhas.map(x => situacao(x.status) + ' em ' + dataBR(x.criado_em) + ' (' + brl(x.honorario) + '/mês' + (fin(x.taxa_unica) && +x.taxa_unica ? ' + ' + brl(x.taxa_unica) + ' de taxa' : '') + ')').join(' · '));
    if (!fat.erro && fat.linhas.length) partes.push('Faturáveis a cobrar: ' + fat.linhas.map(x => valorCurto(x.descricao, 60) + ' ' + brl(x.valor) + ' (' + dataBR(x.executado_em) + ')').join(' · '));
    if (!dre.erro && dre.linhas.length) partes.push('DRE: ' + dre.linhas.map(x => x.periodo).join(', '));
    if (!fr.erro && fr.linhas.length) partes.push('Fator R: acompanhada' + (fr.linhas.some(x => x.ativo === false) ? ' (inativa)' : ''));
    // o que o vigia achou dela e ainda está aberto (desencontro, coisa parada)
    if (!vig.erro && vig.linhas.length) partes.push('O vigia (a conferir): ' + vig.linhas.map(x => valorCurto(x.titulo, 140) + (x.gravidade === 'alta' ? ' (URGENTE)' : '')
      + (x.detalhe ? ' — ' + valorCurto(x.detalhe, 180) : '') + ' · com ' + (x.responsavel || '—')).join(' | '));
    // o feed: as notícias que a IA disse que a alcançam (pelo cadastro: regime, atividade, cidade, obrigações, folha) — as
    // importantes primeiro e, dentro da importância, as que alcançam menos empresas (as específicas dela) antes das gerais
    if (!nots.erro && nots.linhas.length) {
      const qtd = x => (Array.isArray(x.clientes) ? x.clientes.length : 0), quando = x => String(x.publicada_em || x.coletada_em || '');
      const ord = [...nots.linhas].sort((a, b) => (PESO_RELEVANCIA[a.relevancia] ?? 2) - (PESO_RELEVANCIA[b.relevancia] ?? 2) || qtd(a) - qtd(b) || quando(b).localeCompare(quando(a)));
      const total = Math.max(nots.total || 0, nots.linhas.length), mostra = ord.slice(0, MAX_NOTICIAS_EMPRESA);
      partes.push('Notícias do feed que a alcançam (30 dias: ' + total + (total > mostra.length ? '; aqui as ' + mostra.length + ' primeiras' : '')
        + '; as importantes primeiro e, nelas, as que alcançam poucas empresas — as específicas dela — antes das gerais): '
        + mostra.map(x => diaDoMomento(x.publicada_em || x.coletada_em) + ' · ' + (ROTULO_RELEVANCIA[x.relevancia] || 'Pouco efeito')
          + ((x.setores || []).length ? ' · ' + x.setores.map(k => ROTULO_SETOR[k] || k).join(' e ') : '') + ' · ' + valorCurto(x.titulo, 140)
          + ' (alcança ' + (qtd(x) === 1 ? 'só ela' : qtd(x) + ' empresas') + ')' + (x.acao ? ' — o que fazer: ' + valorCurto(x.acao, 160) : '')
          + (x.prazo ? ' · prazo ' + dataBR(x.prazo) + (x.prazo_o_que ? ' (' + valorCurto(x.prazo_o_que, 120) + ')' : '') : '')).join(' | '));
    } else if (!nots.erro) partes.push('Notícias do feed que a alcançam (30 dias): nenhuma.');
    // a revisão do honorário (só os sócios veem)
    if (usuario.socio && !rev.erro && rev.linhas.length) {
      const r = rev.linhas[0];
      partes.push('Revisão do honorário (Precificação › Carteira): ' + (r.status === 'proposto' ? 'reajuste proposto' : situacao(r.status)) + ' em ' + diaDoMomento(r.atualizado_em || r.criado_em)
        + (fin(r.honorario_atual) ? ' · hoje ' + brl(r.honorario_atual) + (r.fonte_atual === 'conta_azul' ? ' (Conta Azul)' : '') : '') + (fin(r.honorario_sugerido) ? ' · motor ' + brl(r.honorario_sugerido) : '')
        + (fin(r.honorario_novo) ? ' · ' + (r.status === 'aceito' ? 'combinado ' : 'proposto ') + brl(r.honorario_novo) + (r.vigencia ? ' a partir de ' + String(r.vigencia).slice(5, 7) + '/' + String(r.vigencia).slice(0, 4) : '') : '')
        + (r.status === 'aceito' ? (r.aplicado_em ? ' · já no boleto desde ' + diaDoMomento(r.aplicado_em) : ' · ainda não entrou no boleto') : ''));
    }
    return partes.join('\n');
  }

  // pra quem não é sócio, a leitura com o filtro fixo (o vigia sem os achados só dos sócios) leva a nota: o que ficou de
  // fora não é "nenhum"
  async function consultar(e) {
    const r = await consultarTabela(e);
    const T = TABELAS[e && e.tabela];
    return T && T.fixoNaoSocio && T.notaNaoSocio && !usuario.socio && typeof r === 'string' && !r.startsWith('Sem acesso') ? r + '\n' + T.notaNaoSocio : r;
  }
  async function consultarTabela(e) {
    const m = montarConsulta(e || {}, { hoje });
    const { t, T } = m;
    if (T.socios && !usuario.socio) return 'Sem acesso: ' + T.rotulo + ' só os sócios veem.';
    const params = [...(T.fixoNaoSocio && !usuario.socio ? [T.fixoNaoSocio] : []), ...m.filtros, ...(m.arvore.length ? ['and=' + enc('(' + m.arvore.join(',') + ')')] : [])];
    const base = t + '?' + (params.length ? params.join('&') + '&' : '');
    const pk = (T.pk || 'id').split(',');
    const agruparEmpresa = e.agrupar ? colunaDaEmpresa(t, e.agrupar) : null;
    const agrupar = e.agrupar && !agruparEmpresa ? String(e.agrupar) : null;
    const somar = Array.isArray(e.somar) ? [...new Set(e.somar.map(String))].slice(0, 6) : [];
    if (agrupar && !T.cols.includes(agrupar)) throw new Error('não dá pra agrupar por "' + agrupar + '" em ' + t);
    const somaFora = somar.filter(c => !T.cols.includes(c));
    if (somaFora.length) throw new Error('coluna(s) que não são lidas em ' + t + ': ' + somaFora.join(', '));
    if (agrupar || agruparEmpresa || somar.length) {
      // todas as linhas que batem com os filtros (só as colunas da conta), em páginas de 1000, até 20 mil
      const cols = [...new Set([agrupar, agruparEmpresa ? 'cliente_id' : null, ...somar].filter(Boolean))];
      const linhas = [];
      for (let p = 0; p < 20; p++) {
        const r = await ler(base + 'select=' + cols.join(',') + '&order=' + pk.map(x => x + '.asc').join(',') + '&limit=1000&offset=' + p * 1000);
        linhas.push(...r.linhas);
        if (r.linhas.length < 1000) break;
        if (p === 19) return 'Linhas demais pra contar (mais de 20 mil): use filtros.';
      }
      const cad = agruparEmpresa ? await cadastroDe(linhas.map(l => l.cliente_id), [agruparEmpresa]) : null;
      const chaveDe = l => {
        if (agruparEmpresa) { const c = l.cliente_id ? cad.get(l.cliente_id) : null; const v = c ? c[agruparEmpresa] : null; return v == null || v === '' ? '(vazio)' : String(v); }
        const v = l[agrupar];
        if (PESSOA.has(agrupar)) return rotuloPessoa(v);   // "SAMUEL" e "Samuel" no mesmo grupo
        return v == null || v === '' ? '(vazio)' : typeof v === 'object' ? JSON.stringify(v) : String(v);
      };
      const grupos = new Map(); const tot = Object.fromEntries(somar.map(c => [c, 0]));
      linhas.forEach(l => {
        somar.forEach(c => { if (fin(l[c])) tot[c] += +l[c]; });
        if (agrupar || agruparEmpresa) {
          const k = chaveDe(l);
          const g = grupos.get(k) || { n: 0, s: Object.fromEntries(somar.map(c => [c, 0])) };
          g.n++; somar.forEach(c => { if (fin(l[c])) g.s[c] += +l[c]; });
          grupos.set(k, g);
        }
      });
      const r2 = v => Math.round(v * 100) / 100;
      let txt = T.rotulo + ' — ' + linhas.length + ' linha(s) com esses filtros' + (somar.length ? ' · total: ' + somar.map(c => c + ' = ' + r2(tot[c])).join(', ') : '');
      if (agrupar || agruparEmpresa) {
        const rotulos = agrupar === 'cliente_id' ? await cadastroDe([...grupos.keys()]) : new Map();
        const lista = [...grupos.entries()].sort((a, b) => b[1].n - a[1].n);
        txt += '\nPor ' + (agruparEmpresa ? 'empresa.' + agruparEmpresa : agrupar) + ' (' + lista.length + ' valor(es)):\n' + lista.slice(0, 60).map(([k, g]) => '- ' + (rotulos.get(k) ? rotulos.get(k).nome_principal + ' (' + k + ')' : k) + ': ' + g.n
          + (somar.length ? ' · ' + somar.map(c => c + ' ' + r2(g.s[c])).join(', ') : '')).join('\n') + (lista.length > 60 ? '\n… mais ' + (lista.length - 60) + ' valores' : '');
      }
      return txt;
    }
    const limite = Math.max(1, Math.min(200, Math.round(+e.limite || 50)));
    const inicio = Math.max(0, Math.round(+e.a_partir_de || 0));
    // a ordem pedida e, no fim, a chave da tabela: a página seguinte não pula nem repete linha
    const ord = [...m.ordem, ...pk.filter(x => !m.ordem.some(o => o.startsWith(x + '.'))).map(x => x + '.asc')].join(',');
    const { linhas, total } = await ler(base + 'select=' + m.colunas.join(',') + '&order=' + ord + '&limit=' + limite + '&offset=' + inicio, { contar: true });
    const tot = total == null ? inicio + linhas.length : total;
    if (!linhas.length) return T.rotulo + ' — nenhuma linha com esses filtros' + (inicio ? ' a partir da ' + (inicio + 1) + 'ª' : '') + ' (total: ' + tot + ').';
    const com = await comNomes(T, await comEmpresa(linhas, m.extras));
    // a saída tem tamanho: entram as linhas que cabem, e a primeira linha diz de onde seguir
    const corpo = []; let tam = 0;
    for (const l of com) { const s = '- ' + linhaTexto(l); if (corpo.length && tam + s.length > MAX_SAIDA) break; corpo.push(s); tam += s.length + 1; }
    const fim = inicio + corpo.length;
    return T.rotulo + ' — ' + tot + ' linha(s) com esses filtros; mostrando ' + (inicio + 1) + '–' + fim + (fim < tot ? ' (as seguintes: a_partir_de ' + fim + ')' : '') + ':\n' + corpo.join('\n');
  }

  // ---------- agenda ----------
  async function agenda(e) {
    const de = DATA.test(String(e.de || '')) ? String(e.de) : hoje;
    const ate = DATA.test(String(e.ate || '')) ? String(e.ate) : de;
    if (ate < de) return 'O fim ("ate") é antes do começo ("de").';
    const d0 = new Date(de + 'T00:00:00'), d1 = new Date(ate + 'T00:00:00');
    if ((d1 - d0) / 864e5 > 31) return 'Período longo demais: até 31 dias.';
    // o nome vai dentro de um filtro do banco: só letras, espaço, hífen e apóstrofo; da equipe, o nome dela
    const pedido = String(e.pessoa || '').replace(/[^\p{L} '-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 40);
    const todos = normalizarBusca(pedido) === 'todos';
    const nome = todos ? null : equipePorNome(pedido || usuario.nome || '') || pedido || usuario.nome || '';
    if (!todos && !nome) return 'Diga de quem é a agenda (ou "todos").';
    const foraDaEquipe = !todos && !equipePorNome(nome);
    const ehSocio = !todos && ['samuel', 'diego'].includes(normalizarBusca(nome));
    const filtroResp = todos ? '' : '&' + filtroPessoa(nome);
    const setor = e.setor ? '&setor=eq.' + enc(String(e.setor).toLowerCase()) : '';
    const comAtrasadas = e.atrasadas !== false;
    // atrasada é o que venceu antes de hoje (num período futuro, o que vence antes dele e depois de hoje não é atraso)
    const corteAtraso = de < hoje ? de : hoje;
    const cols = 'select=id,cliente_id,setor,titulo,responsavel,prazo,hora,status,prioridade';
    // as atrasadas: todas (até 5 mil), pro resumo contar tudo — a lista mostra só as primeiras
    async function atrasadasTodas() {
      const base = 'tarefas?' + cols + '&status=neq.concluida&prazo=lt.' + corteAtraso + filtroResp + setor + '&order=prazo.asc,id.asc&limit=1000';
      const p1 = await ler(base + '&offset=0', { contar: true });
      const ls = [...p1.linhas];
      const total = p1.total == null ? ls.length : p1.total;
      for (let p = 1; p < 5 && ls.length < Math.min(total, 5000); p++) {
        const r = await ler(base + '&offset=' + p * 1000);
        if (!r.linhas.length) break;
        ls.push(...r.linhas);
      }
      return { linhas: ls, total: Math.max(total, ls.length) };
    }
    const [noPeriodo, atrasadas, rotinas] = await Promise.all([
      ler('tarefas?' + cols + '&status=neq.concluida&prazo=gte.' + de + '&prazo=lte.' + ate + filtroResp + setor + '&order=prazo.asc,hora.asc.nullslast,id.asc&limit=400', { contar: true }),
      comAtrasadas ? atrasadasTodas() : Promise.resolve({ linhas: [], total: 0 }),
      ler('rotinas?select=id,setor,titulo,descricao,responsavel,periodicidade,dia_semana,dia_mes,dia_anual,dia_util,ultima_execucao,adiada_para&ativo=eq.true' + setor)
    ]);
    const [periodo, atras] = await Promise.all([comEmpresa(noPeriodo.linhas), comEmpresa(atrasadas.linhas)]);
    const PRIO = { alta: 0, media: 1, 'média': 1, baixa: 2 };
    const tarefaTxt = t => '  - ' + (t.hora ? String(t.hora).slice(0, 5) + ' · ' : '') + valorCurto(t.titulo, 110) + (t.empresa && t.cliente_id ? ' · ' + t.empresa : '') + ' · ' + t.setor
      + (todos ? ' · ' + (t.responsavel || 'sem responsável') : '') + ' · ' + situacao(t.status) + (t.prioridade ? ' · prioridade ' + situacao(t.prioridade) : '');
    const daPessoa = r => todos || (r.responsavel && (normalizarBusca(r.responsavel) === normalizarBusca(nome) || (ehSocio && normalizarBusca(r.responsavel) === 'ambos')));
    const linhas = [];
    linhas.push('Agenda de ' + (todos ? 'todos' : nome + (foraDaEquipe ? ' (nome fora da equipe atual: ' + EQUIPE.join(', ') + ')' : '')) + (de === ate ? ' em ' + DIAS[d0.getDay()] + ', ' + dataBR(de) : ' de ' + dataBR(de) + ' a ' + dataBR(ate)) + (e.setor ? ' (setor ' + e.setor + ')' : '') + ':');
    if (comAtrasadas) {
      const total = atrasadas.total;
      linhas.push('Atrasadas (prazo antes de ' + dataBR(corteAtraso) + '): ' + total);
      // muitas: o resumo de todas (por mês do prazo, tarefa, empresa, setor e pessoa), pra não tirar conclusão de uma amostra
      if (atras.length > 10) {
        const meses = contarPor(atras, t => ({ id: String(t.prazo).slice(0, 7), rotulo: String(t.prazo).slice(5, 7) + '/' + String(t.prazo).slice(0, 4) })).sort((a, b) => a.id.localeCompare(b.id));
        const porTarefa = contarPor(atras, t => ({ id: normalizarBusca(t.titulo).replace(/\s+/g, ' ').trim(), rotulo: valorCurto(t.titulo, 60) }));
        const porEmpresa = contarPor(atras, t => ({ id: t.cliente_id || '-', rotulo: t.cliente_id ? t.empresa : 'sem empresa' }));
        linhas.push('  resumo de ' + (atras.length < total ? 'as ' + atras.length + ' primeiras por prazo' : 'todas') + ':');
        linhas.push('  · por mês do prazo: ' + meses.map(g => g.rotulo + ' ' + g.n).join(' · '));
        linhas.push('  · por tarefa: ' + topo(porTarefa, 10));
        linhas.push('  · por empresa: ' + topo(porEmpresa, 10));
        linhas.push('  · por situação: ' + topo(contarPor(atras, t => ({ id: t.status || '—', rotulo: situacao(t.status) })), 6));
        const porSetor = contarPor(atras, t => ({ id: t.setor || '—', rotulo: t.setor || '—' }));
        if (porSetor.length > 1) linhas.push('  · por setor: ' + topo(porSetor, 10));
        if (todos) linhas.push('  · por pessoa: ' + topo(contarPor(atras, t => { const p = rotuloPessoa(t.responsavel); return { id: p, rotulo: p }; }), 10));
      }
      const mostrar = atras.slice().sort((a, b) => (PRIO[a.prioridade] ?? 3) - (PRIO[b.prioridade] ?? 3) || String(a.prazo).localeCompare(String(b.prazo))).slice(0, 25);
      if (total > mostrar.length) linhas.push('  as ' + mostrar.length + ' primeiras (prioridade alta antes, depois o prazo mais antigo):');
      mostrar.forEach(t => linhas.push(tarefaTxt(t).replace('  - ', '  - prazo ' + dataBR(t.prazo) + ' · ')));
      if (total > mostrar.length) linhas.push('  … mais ' + (total - mostrar.length) + ' atrasadas (no resumo acima)');
    }
    for (let d = new Date(d0); d <= d1; d.setDate(d.getDate() + 1)) {
      const s = ymd(d);
      const doDia = periodo.filter(t => String(t.prazo).slice(0, 10) === s).sort((a, b) => (PRIO[a.prioridade] ?? 3) - (PRIO[b.prioridade] ?? 3) || String(a.hora || '99').localeCompare(String(b.hora || '99')));
      const rots = rotinas.linhas.filter(r => daPessoa(r) && rotinaDoDia(r, d));
      if (!doDia.length && !rots.length && de !== ate) continue;
      linhas.push(DIAS[d.getDay()] + ', ' + dataBR(s) + (s === hoje ? ' (hoje)' : '') + ': ' + doDia.length + ' tarefa(s)' + (rots.length ? ', ' + rots.length + ' rotina(s)' : ''));
      doDia.forEach(t => linhas.push(tarefaTxt(t)));
      rots.forEach(r => linhas.push('  - rotina: ' + valorCurto(r.titulo || r.descricao, 90) + ' · ' + (r.setor || '—') + (todos && r.responsavel ? ' · ' + r.responsavel : '') + ' · ' + (rotinaFeita(r, d) ? 'feita' : 'a fazer')
        + (r.adiada_para === s ? ' (adiada pra este dia)' : '')));
    }
    // a saída tem tamanho: o aviso do corte vai em cima, onde não é cortado
    const avisos = [];
    if ((noPeriodo.total || 0) > noPeriodo.linhas.length) avisos.push('o período tem ' + noPeriodo.total + ' tarefas e vieram ' + noPeriodo.linhas.length);
    let saida = [], tam = 0, cortadas = 0;
    for (const l of linhas) { if (tam + l.length > MAX_SAIDA) { cortadas++; continue; } saida.push(l); tam += l.length + 1; }
    if (cortadas) avisos.push(cortadas + ' linha(s) não couberam');
    if (avisos.length) saida.splice(1, 0, '(Lista incompleta: ' + avisos.join('; ') + ' — use um período menor, uma pessoa ou um setor.)');
    return saida.join('\n');
  }

  // a Reforma responde uma vez por pergunta (cada pergunta lá conta no limite do dia dela)
  let reformaUsada = false;
  async function perguntar_reforma(e) {
    const pergunta = String(e.pergunta || '').trim();
    if (!pergunta) return 'Escreva a pergunta pra Reforma.';
    if (!perguntarReforma) return 'O assistente da Reforma não está disponível agora.';
    if (reformaUsada) return 'A Reforma já respondeu nesta pergunta: use a resposta que veio (uma consulta à Reforma por pergunta).';
    reformaUsada = true;
    const r = await perguntarReforma(pergunta.slice(0, 2000));
    // pra cruzar com outros dados, volta como texto — salvo se o tempo da pergunta está acabando: aí vai direto. Pedida
    // junto com outra ferramenta, também volta como texto (o comoTexto): nos dois casos, com o recado de manter as fontes
    // e a última linha, "Base da resposta" (de onde veio: o curso ou fontes de fora — quem escreve é a função da Reforma)
    const comoTexto = 'Resposta do assistente da Reforma — ao usar, mantenha as fontes dele entre colchetes exatamente como vieram ([regra CODIGO], [CODIGO, onde]): na tela elas viram links.'
      + ' Mantenha também a última linha dele ("Base da resposta: …") como veio, no fim da sua resposta.\n' + r.texto;
    if (e.devolver_direto === false && !deveFinalizar()) return comoTexto;
    return { final: true, texto: r.texto, cortada: !!r.cortada, comoTexto };
  }

  // ---------- as propostas de ação: nada muda aqui — a tela mostra o cartão e a pessoa confirma (e pode desfazer) ----------
  // A proposta leva só o que identifica (ids, a pessoa, os campos da tarefa nova); a tela lê de novo o que vai mostrar.
  // Uma por pergunta
  let proposta = null;
  const jaProposto = () => (proposta ? 'Já há uma proposta nesta pergunta (uma por pergunta): diga na resposta o que a tela vai mostrar.' : null);
  const registrar = a => { proposta = a; try { aoPropor(a); } catch (e) { /* quem chama não guardou */ } };
  const idsDe = v => (Array.isArray(v) ? v : v == null ? [] : [v]).map(String).filter(x => UUID.test(x));
  const plural = (n, um, varios) => n + ' ' + (n === 1 ? um : varios);

  // as tarefas abertas que a pessoa disse: ids, ou empresa, pessoa (o responsável de agora) e/ou parte do título; prazo,
  // setor e "atrasadas" afinam. → { linhas, total } ou { erro }
  async function tarefasDoPedido(e, colunas) {
    const f = ['status=neq.concluida'];
    let criterio = false;
    const ids = idsDe(e.ids);
    if (Array.isArray(e.ids) && e.ids.length && !ids.length) return { erro: 'Esses ids não são de tarefas (use os de consultar).' };
    if (ids.length) { if (ids.length > 300) return { erro: 'Até 300 tarefas por vez.' }; f.push('id=in.(' + ids.join(',') + ')'); criterio = true; }
    if (e.empresa && String(e.empresa).trim()) { const a = await acharEmpresa(e.empresa); if (a.erro) return { erro: a.erro }; f.push('cliente_id=eq.' + a.id); criterio = true; }
    if (e.pessoa && String(e.pessoa).trim()) {
      const nome = equipePorNome(String(e.pessoa));
      if (!nome) return { erro: 'Pessoa fora da equipe (' + EQUIPE.join(', ') + ').' };
      f.push(filtroPessoa(nome)); criterio = true;
    }
    if (e.titulo && String(e.titulo).trim()) { f.push('titulo=ilike.' + enc('*' + semCuringa(String(e.titulo).trim().slice(0, 120)) + '*')); criterio = true; }
    if (!criterio) return { erro: 'Diga quais tarefas: ids, empresa, pessoa ou parte do título (prazo, setor e "atrasadas" afinam).' };
    if (e.setor) f.push('setor=eq.' + enc(String(e.setor).toLowerCase()));
    if (DATA.test(String(e.prazo_de || ''))) f.push('prazo=gte.' + e.prazo_de);
    if (DATA.test(String(e.prazo_ate || ''))) f.push('prazo=lte.' + e.prazo_ate);
    if (e.atrasadas === true) f.push('prazo=lt.' + hoje);
    const { linhas, total } = await ler('tarefas?select=' + colunas + '&' + f.join('&') + '&order=prazo.asc.nullslast,id.asc&limit=300', { contar: true });
    return { linhas, total: total || 0 };
  }

  // a lista das tarefas da proposta, pro modelo (as 12 primeiras)
  const listaTarefas = com => com.slice(0, 12).map(t => '- ' + valorCurto(t.titulo, 80) + (t.cliente_id ? ' · ' + t.empresa : '') + ' · prazo ' + dataBR(t.prazo) + ' · ' + (t.responsavel || 'sem responsável')).join('\n')
    + (com.length > 12 ? '\n… e mais ' + (com.length - 12) : '');
  // a mensagem no histórico (20/10/2026): a da pessoa, numa linha, até 1000 caracteres (a regra da tela, limparMensagem)
  const comMsg = (acao, m) => (m ? { ...acao, mensagem: m } : acao);
  const avisoMsg = m => (m ? '\nCom a mensagem no histórico de cada uma (a pessoa confere e edita no cartão): “' + m + '”' : '');

  async function propor_concluir_tarefas(e) {
    const ja = jaProposto(); if (ja) return ja;
    const sel = await tarefasDoPedido(e, 'id,cliente_id,titulo,responsavel,prazo');
    if (sel.erro) return sel.erro;
    const { linhas, total } = sel;
    if (!linhas.length) return 'Nenhuma tarefa aberta com esses critérios — nada foi proposto.';
    if (total > 300) return 'São ' + total + ' tarefas abertas com esses critérios: afine (prazo, empresa, título) até 300 — nada foi proposto.';
    const m = limparMensagem(e.mensagem);
    registrar(comMsg({ tipo: 'concluir_tarefas', ids: linhas.map(t => String(t.id)) }, m));
    const com = await comEmpresa(linhas);
    return 'Proposta pronta: a tela mostra ' + plural(linhas.length, 'tarefa', 'tarefas') + ' com o botão "Concluir" (a pessoa confirma e pode desmarcar alguma). Nada foi concluído ainda.\n'
      + listaTarefas(com) + avisoMsg(m) + '\nNa resposta: uma frase dizendo o que será concluído quando ela confirmar' + (m ? ', com a mensagem no histórico' : '') + ' (não diga que já foi).';
  }

  // só a mensagem no histórico, sem concluir nem mudar nada (o "Registrar andamento" da Agenda)
  async function propor_registrar_historico(e) {
    const ja = jaProposto(); if (ja) return ja;
    const m = limparMensagem(e.mensagem);
    if (!m) return 'Diga a mensagem que vai no histórico (o que a pessoa pediu pra registrar) — nada foi proposto.';
    const sel = await tarefasDoPedido(e, 'id,cliente_id,titulo,responsavel,prazo');
    if (sel.erro) return sel.erro;
    const { linhas, total } = sel;
    if (!linhas.length) return 'Nenhuma tarefa aberta com esses critérios — nada foi proposto.';
    if (total > 300) return 'São ' + total + ' tarefas abertas com esses critérios: afine (prazo, empresa, título) até 300 — nada foi proposto.';
    registrar({ tipo: 'registrar_historico', ids: linhas.map(t => String(t.id)), mensagem: m });
    const com = await comEmpresa(linhas);
    return 'Proposta pronta: a tela mostra a mensagem (dá pra editar) e ' + plural(linhas.length, 'tarefa', 'tarefas') + ' com o botão "Registrar" (a pessoa confirma e pode desmarcar alguma). Nada foi gravado ainda, e nenhuma tarefa muda.\n'
      + 'A mensagem: “' + m + '”\n' + listaTarefas(com) + '\nNa resposta: uma frase dizendo o que vai pro histórico quando ela confirmar (não diga que já foi).';
  }

  // remarcar, passar pra outra pessoa, mudar a prioridade: a mesma regra da tela (assets/js/tarefas-acoes.js) separa o que
  // muda em cada uma; as de admissão, rescisão e alvará ficam de fora do prazo e do responsável (o banco refaz os dois a
  // partir da ficha de origem; só a prioridade muda nelas)
  async function propor_alterar_tarefas(e) {
    const ja = jaProposto(); if (ja) return ja;
    const mudar = {};
    const np = e.novo_prazo != null ? String(e.novo_prazo).trim() : '';
    if (np) {
      const d = new Date(np + 'T12:00:00Z');
      if (!DATA.test(np) || isNaN(d) || d.toISOString().slice(0, 10) !== np) return 'O novo prazo vai em AAAA-MM-DD (uma data que existe).';
      mudar.prazo = np;
    }
    const nr = e.novo_responsavel != null ? String(e.novo_responsavel).trim() : '';
    if (nr) {
      const n = normalizarBusca(nr) === 'ambos' ? 'Ambos' : equipePorNome(nr);
      if (!n) return 'Novo responsável fora da equipe (' + EQUIPE.join(', ') + ', ou Ambos — Samuel e Diego).';
      mudar.responsavel = n;
    }
    const npr = e.nova_prioridade != null ? normalizarBusca(String(e.nova_prioridade)).trim() : '';
    if (npr) {
      const p = npr === 'urgente' ? 'alta' : npr;
      if (!PRIORIDADES.includes(p)) return 'A prioridade é alta, media ou baixa.';
      mudar.prioridade = p;
    }
    if (!Object.keys(mudar).length) return 'Diga o que muda: novo_prazo (AAAA-MM-DD), novo_responsavel e/ou nova_prioridade.';
    const sel = await tarefasDoPedido(e, 'id,cliente_id,titulo,responsavel,prazo,prioridade,origem,obrigacao_id,admissao_id,rescisao_id,alvara_id');
    if (sel.erro) return sel.erro;
    const { linhas, total } = sel;
    if (!linhas.length) return 'Nenhuma tarefa aberta com esses critérios — nada foi proposto.';
    if (total > 300) return 'São ' + total + ' tarefas abertas com esses critérios: afine (prazo, empresa, título) até 300 — nada foi proposto.';
    const daFicha = linhas.filter(t => ficaDeFora(t, mudar));
    const mudam = linhas.filter(t => !ficaDeFora(t, mudar) && mudancaDe(t, mudar));
    const iguais = linhas.length - daFicha.length - mudam.length;
    const telas = [...new Set(daFicha.map(t => ficaDeFora(t, mudar).tela))];
    const fora = daFicha.length ? plural(daFicha.length, 'tarefa', 'tarefas') + ' de ' + [...new Set(daFicha.map(t => ficaDeFora(t, mudar).nome))].join(', ')
      + (daFicha.length === 1 ? ' fica' : ' ficam') + ' de fora: o prazo e o responsável vêm da ficha de origem — muda na tela ' + telas.join(', ') + '.' : '';
    const ja2 = iguais ? plural(iguais, 'tarefa já está', 'tarefas já estão') + ' assim.' : '';
    if (!mudam.length) return [fora, ja2, 'Nada foi proposto.'].filter(Boolean).join(' ');
    const msgH = limparMensagem(e.mensagem);
    registrar(comMsg({ tipo: 'alterar_tarefas', ids: mudam.map(t => String(t.id)), mudar }, msgH));
    const com = await comEmpresa(mudam);
    const PRIO = { alta: 'alta', media: 'média', baixa: 'baixa' };
    const comoFica = t => { const d = mudancaDe(t, mudar) || {};
      return ['prazo' in d ? 'prazo ' + (t.prazo ? dataBR(t.prazo) : 'sem prazo') + ' → ' + dataBR(d.prazo) : null, 'responsavel' in d ? (t.responsavel || 'sem responsável') + ' → ' + d.responsavel : null,
        'prioridade' in d ? 'prioridade ' + (PRIO[t.prioridade] || t.prioridade || '—') + ' → ' + PRIO[d.prioridade] : null].filter(Boolean).join(' · '); };
    // o "amanhã" de sexta cai no sábado: a resposta avisa (a tela também mostra o dia da semana)
    const dsem = mudar.prazo ? new Date(mudar.prazo + 'T12:00:00Z').getUTCDay() : null;
    const fds = dsem === 6 ? 'sábado' : dsem === 0 ? 'domingo' : null;
    // o responsável novo nas que nascem de obrigação ou de tarefa recorrente: a próxima vem com o de lá
    const px = proximasNascemCom(mudam, mudar);
    const proximas = [px.obrigacao ? px.obrigacao + (px.obrigacao === 1 ? ' vem' : ' vêm') + ' de obrigação fiscal: a próxima nasce com o responsável da obrigação — pra ficar com ' + mudar.responsavel + ' de vez, troque na tela Obrigações fiscais (lá a troca leva as abertas junto)' : null,
      px.recorrente ? px.recorrente + (px.recorrente === 1 ? ' vem' : ' vêm') + ' de tarefa recorrente: a próxima nasce com o responsável de lá — pra ficar de vez, troque em Tarefas recorrentes do setor' : null].filter(Boolean);
    return 'Proposta pronta: a tela mostra ' + plural(mudam.length, 'tarefa', 'tarefas') + ' com o antes e o depois e o botão pra confirmar (a pessoa pode desmarcar alguma; depois, "Desfazer"). Nada mudou ainda.\n'
      + com.slice(0, 12).map(t => '- ' + valorCurto(t.titulo, 80) + (t.cliente_id ? ' · ' + t.empresa : '') + ' · ' + comoFica(t)).join('\n')
      + (mudam.length > 12 ? '\n… e mais ' + (mudam.length - 12) : '') + (ja2 ? '\n' + ja2 : '') + (fora ? '\n' + fora : '') + avisoMsg(msgH)
      + (fds ? '\nAtenção: o novo prazo (' + dataBR(mudar.prazo) + ') cai num ' + fds + ' — diga isso na resposta.' : '')
      + (proximas.length ? '\nDas que mudam, ' + proximas.join('; ') + '. Diga isso numa frase na resposta.' : '')
      + '\nNa resposta: uma frase dizendo o que muda quando ela confirmar (não diga que já mudou)' + (fora ? ' e o que fica de fora' : '') + '.';
  }

  async function propor_marcar_pago(e) {
    const ja = jaProposto(); if (ja) return ja;
    const f = ['status=in.(a_emitir,emitido,enviado)'];
    let criterio = false;
    const ids = idsDe(e.ids);
    if (Array.isArray(e.ids) && e.ids.length && !ids.length) return 'Esses ids não são de boletos (use os de consultar).';
    if (ids.length) { if (ids.length > 100) return 'Até 100 boletos por vez.'; f.push('id=in.(' + ids.join(',') + ')'); criterio = true; }
    const nomes = (Array.isArray(e.empresas) ? e.empresas : e.empresas ? [e.empresas] : []).map(String).filter(s => s.trim()).slice(0, 20);
    if (nomes.length) {
      const cli = [];
      for (const n of nomes) { const a = await acharEmpresa(n); if (a.erro) return a.erro; cli.push(a.id); }
      f.push('cliente_id=in.(' + [...new Set(cli)].join(',') + ')'); criterio = true;
    }
    if (!criterio) return 'Diga quais boletos: a empresa (uma ou várias) e a competência, ou os ids.';
    if (e.competencia) { if (!/^\d{4}-\d{2}$/.test(String(e.competencia))) return "A competência vai em 'AAAA-MM'."; f.push('competencia=eq.' + e.competencia); }
    const { linhas, total } = await ler('cobrancas_mensais?select=id,cliente_id,competencia,valor,vencimento,status&' + f.join('&') + '&order=competencia.desc,id.asc&limit=100', { contar: true });
    if (!linhas.length) return 'Nenhum boleto em aberto (a emitir, emitido ou enviado) com esses critérios — nada foi proposto.';
    if ((total || 0) > 100) return 'São ' + total + ' boletos em aberto com esses critérios: afine (empresa, competência) até 100 — nada foi proposto.';
    registrar({ tipo: 'marcar_pago', ids: linhas.map(b => String(b.id)) });
    const com = await comEmpresa(linhas);
    return 'Proposta pronta: a tela mostra ' + plural(linhas.length, 'boleto', 'boletos') + ' com o botão "Marcar como pago" (a pessoa confirma e pode desmarcar algum). Nada mudou ainda.\n'
      + com.map(b => '- ' + b.empresa + ' · ' + b.competencia + ' · ' + brl(b.valor) + ' · vence ' + dataBR(b.vencimento) + ' · ' + situacao(b.status)).join('\n')
      + '\nNa resposta: uma frase dizendo o que será marcado como pago quando ela confirmar (não diga que já foi).';
  }

  const SETORES_TAREFA = ['clientes', 'dp', 'fiscal', 'contabil', 'societario', 'financeiro', 'comercial', 'irpf', 'gestao', 'geral'];
  async function propor_criar_tarefa(e) {
    const ja = jaProposto(); if (ja) return ja;
    const titulo = String(e.titulo || '').replace(/\s+/g, ' ').trim().slice(0, 200);
    if (!titulo) return 'Diga o que precisa ser feito (o título da tarefa).';
    let responsavel = null;
    if (e.responsavel && String(e.responsavel).trim()) { responsavel = equipePorNome(String(e.responsavel)); if (!responsavel) return 'Responsável fora da equipe (' + EQUIPE.join(', ') + ').'; }
    let prazo = null;
    if (e.prazo) { const p = String(e.prazo); if (!DATA.test(p) || isNaN(new Date(p + 'T12:00:00Z'))) return 'O prazo vai em AAAA-MM-DD.'; prazo = p; }
    const setor = e.setor ? String(e.setor).toLowerCase() : 'geral';
    if (!SETORES_TAREFA.includes(setor)) return 'Setor: ' + SETORES_TAREFA.join(', ') + '.';
    const prioridade = ['alta', 'media', 'baixa'].includes(e.prioridade) ? e.prioridade : 'media';
    let empresa = null;
    if (e.empresa && String(e.empresa).trim()) {
      const a = await acharEmpresa(e.empresa);
      if (a.erro) return a.erro;
      const { linhas } = await ler('clientes?select=id,nome_principal&id=eq.' + a.id);
      if (!linhas[0]) return 'Nenhuma empresa no cadastro com o id ' + a.id + '.';
      empresa = { id: String(linhas[0].id), nome: linhas[0].nome_principal };
    }
    const descricao = e.descricao && String(e.descricao).trim() ? String(e.descricao).trim().slice(0, 1000) : null;
    registrar({ tipo: 'criar_tarefa', tarefa: { titulo, responsavel, prazo, setor, prioridade, descricao, empresa } });
    return 'Proposta pronta: a tela mostra a tarefa já preenchida (' + titulo + (responsavel ? ' · ' + responsavel : ' · sem responsável') + ' · prazo ' + (prazo ? dataBR(prazo) : 'hoje') + ' · ' + setor
      + (empresa ? ' · ' + empresa.nome : '') + ') com o botão "Criar tarefa": a pessoa confere, ajusta se quiser e cria. Nada foi criado ainda. Na resposta: uma frase (não diga que já foi criada).';
  }

  // ---------- a mensagem no chat da equipe: a tela mostra (dá pra editar) e a pessoa envia, em nome dela ----------
  // Quem recebe: alguém da equipe com login (a conversa a dois, que a tela abre se não existe), o grupo de todos
  // ("Escritório") ou outro grupo pelo nome — a tela procura entre os grupos de quem pede: aqui o chat não é lido. Os
  // arquivos: só os que buscar_arquivos trouxe nesta pergunta, pelo nome; vai o link do Drive (o arquivo fica lá)
  const EMAIL_DE = new Map(Object.entries(NOME_POR_EMAIL).map(([e, n]) => [normalizarBusca(n), e]));
  const GRUPO_TODOS = new Set(['escritorio', 'o escritorio', 'grupo do escritorio', 'grupo escritorio', 'todos', 'todo mundo', 'a equipe', 'equipe', 'pessoal', 'geral']);
  const SOCIOS_TXT = new Set(['ambos', 'os socios', 'socios', 'os dois socios']);
  async function propor_enviar_mensagem(e) {
    const ja = proposta && proposta.tipo !== 'arquivos' ? jaProposto() : null; if (ja) return ja;
    const pedidos = (Array.isArray(e.para) ? e.para : e.para ? [e.para] : []).map(x => String(x).replace(/\s+/g, ' ').trim()).filter(Boolean);
    if (!pedidos.length) return 'Diga pra quem vai a mensagem: alguém da equipe, "Escritório" (o grupo de todos) ou o nome de um grupo do chat.';
    if (pedidos.length > 6) return 'Até 6 destinos por mensagem.';
    const eu = String(usuario.email || '').toLowerCase();
    const para = [], chaves = new Set();
    const pessoa = (email, nome) => { if (email === eu) return 'A mensagem é sua: não dá pra mandar pra você mesmo.'; if (!chaves.has(email)) { chaves.add(email); para.push({ email, nome }); } return null; };
    for (const p of pedidos) {
      const n = normalizarBusca(p).trim();
      if (GRUPO_TODOS.has(n)) { if (!chaves.has('g:escritorio')) { chaves.add('g:escritorio'); para.push({ grupo: 'escritorio', nome: 'Escritório' }); } continue; }
      if (SOCIOS_TXT.has(n)) { ['Samuel', 'Diego'].forEach(s => { const em = EMAIL_DE.get(normalizarBusca(s)); if (em && em !== eu) pessoa(em, s); }); continue; }
      const nome = equipePorNome(p);
      if (nome) {
        const email = EMAIL_DE.get(normalizarBusca(nome));
        if (!email) return nome + ' não tem login no sistema: não está no chat. Diga isso na resposta (dá pra deixar uma tarefa pra ela).';
        const erro = pessoa(email, nome); if (erro) return erro;
        continue;
      }
      // outro grupo, pelo nome (sem o "grupo" da frente): a tela procura entre os de quem pede
      const g = p.replace(/^(o\s+)?grupo\s+(d[oa]s?\s+)?/i, '').trim().slice(0, 80);
      if (!g) return 'Diga o nome do grupo.';
      if (!chaves.has('g:' + normalizarBusca(g))) { chaves.add('g:' + normalizarBusca(g)); para.push({ grupo: g, nome: g }); }
    }
    if (!para.length) return 'Não sobrou ninguém pra receber (a mensagem é sua: não vai pra você mesmo).';
    const texto = String(e.texto || '').replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').trim().slice(0, 4000);
    if (!texto) return 'Escreva a mensagem (como a pessoa escreveria).';
    const nomes = (Array.isArray(e.arquivos) ? e.arquivos : e.arquivos ? [e.arquivos] : []).map(x => String(x).trim()).filter(Boolean);
    if (nomes.length > 10) return 'Até 10 arquivos por mensagem.';
    const arquivos = [];
    for (const nome of nomes) {
      if (!vistosNoDrive.size) return 'Pra mandar arquivo, chame buscar_arquivos antes (a mensagem leva o link do Drive) — nada foi proposto.';
      const k = normalizarBusca(nome).trim();
      let lista = vistosNoDrive.get(k);
      if (!lista) { const parecidos = [...vistosNoDrive.keys()].filter(x => x.includes(k) || k.includes(x)); if (parecidos.length === 1) lista = vistosNoDrive.get(parecidos[0]); }
      if (!lista) return 'O arquivo "' + nome.slice(0, 120) + '" não veio nas buscas desta pergunta (vieram: ' + [...new Set([...vistosNoDrive.values()].map(l => l[0].nome))].slice(0, 12).join('; ')
        + '). Use o nome exatamente como veio — nada foi proposto.';
      const x = lista.find(i => linkDrive(i.link));
      if (!x) return 'O arquivo "' + lista[0].nome + '" não tem link do Drive: não dá pra mandar por aqui — nada foi proposto.';
      if (!arquivos.some(a => a.link === linkDrive(x.link))) arquivos.push({ nome: String(x.nome).slice(0, 200), link: linkDrive(x.link), pasta: String(x.pasta || '').slice(0, 300) });
    }
    registrar({ tipo: 'enviar_mensagem', para, texto, ...(arquivos.length ? { arquivos } : {}) });
    const quem = para.map(d => d.grupo ? 'o grupo ' + d.nome : d.nome);
    return 'Proposta pronta: a tela mostra a mensagem pra ' + (quem.length > 1 ? quem.slice(0, -1).join(', ') + ' e ' + quem[quem.length - 1] : quem[0])
      + (arquivos.length ? ', com o link do Drive de ' + plural(arquivos.length, 'arquivo', 'arquivos') + ' (' + arquivos.map(a => a.nome).join('; ') + ')' : '')
      + ', com o botão "Enviar": a pessoa confere, pode editar e envia em nome dela. Nada foi enviado ainda.'
      + (para.some(d => d.grupo && d.grupo !== 'escritorio') ? ' O grupo a tela procura entre os grupos dela no chat.' : '')
      + '\nNa resposta: uma frase dizendo que a mensagem está pronta pra ela conferir e enviar (não diga que já foi; não repita o texto da mensagem).';
  }

  async function propor_revisao_atrasadas(e) {
    const ja = jaProposto(); if (ja) return ja;
    const pedida = e.pessoa && String(e.pessoa).trim() ? String(e.pessoa) : null;
    const nome = pedida ? equipePorNome(pedida) : usuario.nome ? equipePorNome(usuario.nome) : null;
    if (!nome) return pedida ? 'Pessoa fora da equipe (' + EQUIPE.join(', ') + ').' : 'Diga de quem são as atrasadas (alguém da equipe).';
    const { total } = await ler('tarefas?select=id&status=neq.concluida&prazo=lt.' + hoje + '&' + filtroPessoa(nome) + '&limit=1', { contar: true });
    if (!total) return nome + ' não tem tarefa atrasada — nada a revisar.';
    registrar({ tipo: 'revisar_atrasadas', pessoa: nome });
    return 'Proposta pronta: a tela mostra a revisão das ' + plural(total, 'atrasada', 'atrasadas') + ' de ' + nome + ' — grupo por grupo, a pessoa marca o que já foi feito. Nada muda sem ela. Na resposta: uma frase convidando.';
  }

  // o cartão do vigia: de alguém (sem: quem pergunta), de todos, de um setor — a tela lê de novo, com o login da pessoa
  const SETORES_VIGIA = ['dp', 'fiscal', 'contabil', 'financeiro', 'comercial', 'societario', 'irpf', 'gestao', 'clientes', 'geral'];
  async function propor_ver_vigia(e) {
    const ja = jaProposto(); if (ja) return ja;
    const pedida = e.pessoa && String(e.pessoa).trim() ? String(e.pessoa).trim() : null;
    const todos = !!pedida && normalizarBusca(pedida) === 'todos';
    const nome = todos ? null : pedida ? equipePorNome(pedida) : usuario.nome ? equipePorNome(usuario.nome) : null;
    if (pedida && !todos && !nome) return 'Pessoa fora da equipe (' + EQUIPE.join(', ') + ').';
    const setor = e.setor ? String(e.setor).toLowerCase() : null;
    if (setor && !SETORES_VIGIA.includes(setor)) return 'Setor: ' + SETORES_VIGIA.join(', ') + '.';
    const f = ['situacao=eq.aberto', ...(usuario.socio ? [] : [TABELAS.vigia_achados.fixoNaoSocio]), ...(setor ? ['setor=eq.' + enc(setor)] : []), ...(nome ? [filtroPessoaVigia(nome)] : [])];
    const { linhas, total } = await ler('vigia_achados?select=regra&' + f.join('&') + '&limit=1000', { contar: true });
    const de = (nome ? ' de ' + nome : '') + (setor ? ' no setor ' + setor : '');
    const nota = usuario.socio ? '' : ' ' + TABELAS.vigia_achados.notaNaoSocio;
    if (!total) return 'O vigia não tem nada aberto' + de + ' — nada a mostrar.' + nota;
    registrar({ tipo: 'vigia', ver: nome ? 'meus' : 'todos', ...(nome ? { pessoa: nome } : {}), ...(setor ? { setor } : {}) });
    // os grupos do cartão (o nome de cada regra, como a tela mostra): a resposta fala do que não leu pelo grupo, sem supor
    const porRegra = new Map();
    (linhas || []).forEach(l => porRegra.set(l.regra, (porRegra.get(l.regra) || 0) + 1));
    const grupos = [...porRegra].map(([r, n]) => [rotuloDaRegra(r), n]).sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0], 'pt-BR')).map(([r, n]) => r + ': ' + n).join(' · ');
    return 'Proposta pronta: a tela mostra o cartão do vigia com ' + plural(total, 'achado aberto', 'achados abertos') + de + (grupos ? ' (' + grupos + ')' : '') + ' — por grupo, cada um com "Abrir" (a tela onde se resolve) e "Ignorar"; no responsável que falta, na proposta e no boleto parados, na admissão a registrar, na rescisão com o pagamento chegando, na ficha sem empresa vinculada, no alvará vencendo, no que é de ex-cliente (cobrança, obrigação), no cliente sem obrigação ou sem cobrança e no cadastro desencontrado, também o botão que resolve ali. Nada muda sem a pessoa. Na resposta: o resumo do que mais pesa e uma frase convidando a abrir o cartão; do que você não leu, diga só o grupo (acima), sem supor de que empresa ou pessoa é.' + nota;
  }

  // ---------- os arquivos da empresa: a pasta dela no Drive e as guias arquivadas ----------
  // A pasta é só a que o cadastro aponta (drive_folder_url): nada de procurar a pasta pelo nome (casaria com a de outro
  // cliente). O cartão "arquivos" mostra os links; aqui volta a lista pro modelo, sem link. Procurar de novo na mesma
  // pergunta não lê o Drive outra vez (a pasta fica guardada) e troca o cartão — salvo quando o de antes era melhor: a
  // busca com palavras que achou algo vale mais que "os mais recentes", que vale mais que a busca que não achou nada
  const arvores = new Map();
  let pesoCartao = -1, termoCartao = null;
  // os arquivos que as buscas desta pergunta mostraram ao modelo (pelo nome sem acento): a mensagem do chat leva o link deles
  const vistosNoDrive = new Map();
  const diaBR = iso => { const d = new Date(iso); return iso && !isNaN(d) ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d) : '—'; };
  const horaBR = iso => { const d = new Date(iso); return iso && !isNaN(d) ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d).replace(':', 'h') : ''; };
  async function buscar_arquivos(e) {
    const ja = proposta && proposta.tipo !== 'arquivos' ? jaProposto() : null; if (ja) return ja;
    const a = await acharEmpresa(e.empresa);
    if (a.erro) return a.erro;
    const { linhas } = await ler('clientes?select=id,nome_principal,nome_fantasia,drive_folder_url&id=eq.' + a.id);
    const c = linhas[0];
    if (!c) return 'Empresa não encontrada no cadastro.';
    const termo = String(e.termo || '').trim().slice(0, 120);
    const raiz = pastaDaUrl(c.drive_folder_url);
    const avisos = [];
    // as guias que o sistema arquivou ficam na pasta do setor fiscal, fora da pasta da empresa: vêm do banco
    let guias = [];
    try {
      const { linhas: gs } = await ler('guias_arquivadas?select=nome_arquivo,competencia,drive_file_url,criado_em,obrigacao_id&cliente_id=eq.' + a.id + '&order=criado_em.desc&limit=200');
      const obr = [...new Set(gs.map(g => g.obrigacao_id).filter(x => UUID.test(String(x))))];
      const nomes = new Map();
      if (obr.length) (await ler('obrigacoes_fiscais?select=id,nome&id=in.(' + obr.join(',') + ')')).linhas.forEach(o => nomes.set(o.id, o.nome));
      guias = gs.map(g => ({ nome: String(g.nome_arquivo || 'guia'), pasta: 'Guias arquivadas / ' + (nomes.get(g.obrigacao_id) || 'obrigação') + (g.competencia ? ' / ' + g.competencia : ''),
        modificado: g.criado_em || null, tamanho: null, link: g.drive_file_url || null, tipo: 'guia' }));
    } catch (err) { avisos.push('As guias arquivadas não vieram (' + ((err && err.message) || 'erro') + ').'); }
    let doDrive = [];
    if (!raiz) avisos.push('A empresa não tem a pasta do Drive no cadastro: crie ou vincule no cadastro da empresa (Base mestre).');
    else if (!drive || !drive.configurado()) avisos.push('O acesso ao Drive não está configurado no assistente.');
    else {
      try {
        if (!arvores.has(raiz)) arvores.set(raiz, drive.arvore(raiz));
        const arv = await arvores.get(raiz).catch(err => { arvores.delete(raiz); throw err; });
        doDrive = arv.arquivos;
        if (arv.cortada) avisos.push('A pasta é grande: olhei ' + arv.pastas + ' subpastas e ' + arv.arquivos.length + ' arquivos (sem as notas em XML).');
      } catch (err) { avisos.push('Não consegui ler o Drive agora (' + ((err && err.message) || 'erro') + ').'); }
    }
    const { achados, total } = filtrarArquivos([...doDrive, ...guias], termo, { limite: 20 });
    if (!raiz && !guias.length) return avisos.join(' ');
    achados.forEach(x => { const k = normalizarBusca(x.nome).trim(); if (!k) return; if (!vistosNoDrive.has(k)) vistosNoDrive.set(k, []); vistosNoDrive.get(k).push(x); });
    const fantasia = c.nome_fantasia && normalizarBusca(c.nome_fantasia) !== normalizarBusca(c.nome_principal) ? String(c.nome_fantasia) : null;
    const peso = termo ? (total ? 2 : 0) : 1;
    const ficaOutro = peso < pesoCartao;
    if (!ficaOutro) { pesoCartao = peso; termoCartao = termo || null; }
    if (!ficaOutro) registrar({ tipo: 'arquivos', empresa: String(c.nome_principal || ''), ...(fantasia ? { fantasia } : {}), cliente_id: String(c.id), pasta: raiz ? String(c.drive_folder_url) : null, termo: termo || null, total,
      itens: achados.map(x => ({ nome: x.nome, pasta: x.pasta || '', modificado: x.modificado || null, tamanho: x.tamanho == null ? null : x.tamanho, link: x.link || null, tipo: x.tipo || null })) });
    const de = 'Arquivos de ' + c.nome_principal + (fantasia ? ' (' + fantasia + ')' : '') + (termo ? ' com "' + termo + '"' : ' (os mais recentes)');
    // o mesmo nome mais de uma vez (a guia enviada de novo, uma cópia): com a hora, pra dizer qual é a mais recente
    const vezes = new Map();
    achados.forEach(x => { const k = normalizarBusca(x.nome); vezes.set(k, (vezes.get(k) || 0) + 1); });
    const lista = achados.map(x => '- ' + x.nome + ' · ' + (x.pasta || 'pasta da empresa') + ' · ' + diaBR(x.modificado)
      + (vezes.get(normalizarBusca(x.nome)) > 1 && horaBR(x.modificado) ? ', ' + horaBR(x.modificado) : '')).join('\n');
    return de + ': ' + (total ? plural(total, 'achado', 'achados') + (total > achados.length ? ', aqui os ' + achados.length + ' primeiros' : '') + '.\n' + lista : 'nada encontrado.')
      + (avisos.length ? '\n' + avisos.join(' ') : '')
      + (!ficaOutro ? '\nA tela mostra o cartão com os links pra abrir (e o link da pasta da empresa).'
        : peso === 0 ? '\nEsta busca não achou nada: o cartão da tela continua com a anterior (' + (termoCartao ? '"' + termoCartao + '"' : 'os mais recentes') + ').'
        : '\nO cartão da tela continua com a busca anterior ("' + termoCartao + '"), que achou o que foi pedido: os links dela é que aparecem.')
      + ' Na resposta: o que achou — o nome, a pasta e a data do que mais interessa —, sem colar link e sem inventar arquivo; nada encontrado, diga e sugira outras palavras.';
  }

  return { buscar_empresa, ver_empresa, agenda, consultar, perguntar_reforma, buscar_arquivos, propor_concluir_tarefas, propor_alterar_tarefas, propor_registrar_historico,
    propor_marcar_pago, propor_criar_tarefa, propor_enviar_mensagem, propor_revisao_atrasadas, propor_ver_vigia };
}

// a etapa que aparece no "digitando…" da tela
export function descreverEtapa(nome, e = {}) {
  const x = e && typeof e === 'object' ? e : {};
  const s = (v, n) => String(v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : v).slice(0, n);
  if (nome === 'buscar_empresa') return 'Procurando "' + s(x.termo, 60) + '" no cadastro';
  if (nome === 'ver_empresa') return 'Abrindo ' + (x.empresa && !UUID.test(String(x.empresa)) ? s(x.empresa, 60) : 'a empresa');
  if (nome === 'agenda') return 'Olhando a agenda' + (x.pessoa ? ' de ' + s(x.pessoa, 30) : '');
  if (nome === 'consultar') { const T = TABELAS[x.tabela]; return 'Consultando ' + (T ? T.rotulo : s(x.tabela, 40)); }
  if (nome === 'perguntar_reforma') return 'Perguntando à base da Reforma';
  if (nome === 'buscar_arquivos') return 'Procurando no Drive' + (x.empresa && !UUID.test(String(x.empresa)) ? ' de ' + s(x.empresa, 60) : ' da empresa');
  if (nome === 'propor_concluir_tarefas') return 'Separando as tarefas pra você confirmar';
  if (nome === 'propor_alterar_tarefas') return 'Separando o que muda pra você confirmar';
  if (nome === 'propor_registrar_historico') return 'Preparando a mensagem pro histórico';
  if (nome === 'propor_marcar_pago') return 'Separando os boletos pra você confirmar';
  if (nome === 'propor_criar_tarefa') return 'Preparando a tarefa pra você conferir';
  if (nome === 'propor_enviar_mensagem') return 'Escrevendo a mensagem pra você conferir';
  if (nome === 'propor_revisao_atrasadas') return 'Preparando a revisão das atrasadas';
  if (nome === 'propor_ver_vigia') return 'Separando o que o vigia achou';
  return s(nome, 40);
}
