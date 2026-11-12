"""O que a ponte lê do Domínio: dezenove funções, cada uma devolve uma lista de dicionários.

    empresas()     -> codigo (o código da empresa no Domínio, número), documento (sem pontuação), nome, ativa
    folha(mes)     -> por empresa: codigo, funcionarios_ativos, admissoes, desligamentos, afastados,
                      pro_labore (quantos sócios com pró-labore no mês)
    fiscal(mes)    -> por empresa: codigo, notas_saida, valor_saidas, notas_entrada, valor_entradas
    contabil(mes)  -> por empresa: codigo, lancamentos, ultimo_lancamento (data)
    faturamento(mes)   -> por empresa (desde a versão 2 do pacote, 05/11/2026): codigo, a receita bruta do mês pelos
                      acumuladores (receita_bruta, receita_mercadorias, receita_servicos, devolucoes) e, de quem
                      apura o Simples, a apuração (receita_simples, receita_simples_propria, receita_st,
                      receita_monofasica, receita_exportacao, receita_anexo_1 a 5, rbt12, meses_rbt12)
    compras(mes)       -> por empresa: codigo, as entradas do mês pelo CFOP (compras, compras_st, servicos_tomados,
                      ativo_e_consumo, devolucoes_de_venda, outras_entradas)
    folha_valores(mes) -> por empresa: codigo, a folha do mês em reais, SOMADA (salarios, ferias, rescisoes,
                      decimo_terceiro, pro_labore_valor, base_inss, base_fgts, fgts, inss_empresa, inss_rat,
                      inss_terceiros) — nunca por pessoa
    origens(mes)       -> por empresa (desde a versão 3 do pacote, 05/11/2026): codigo, os lançamentos contábeis do mês
                      por origem (lanc_normais, lanc_extrato, lanc_fiscal, lanc_folha, lanc_apuracao, lanc_outros) e
                      incluido_ate (o dia em que o último entrou no Domínio)
    cruzamentos(mes)   -> por empresa: codigo, receita_lancada, folha_lancada, encargos_lancados (o que o contábil
                      lançou no mês, pra cruzar com o faturamento e a folha)
    saldos(mes)        -> por empresa: codigo, os saldos estranhos no último dia do mês (caixa_negativo,
                      contra_natureza, sem_natureza, transitorias, transitorias_valor)
    saidas_cfop(mes)   -> por empresa (desde a versão 5 do pacote, 11/11/2026: o que o Comparativo tributário apura pelas
                      notas e pela contabilidade): codigo, as vendas do mês pelo CFOP (venda_producao, venda_revenda,
                      venda_combustivel, industrializacao_encomenda, transporte, transporte_357, energia_comunicacao,
                      outras_saidas), pra onde foram (saidas_no_estado, saidas_outro_estado, saidas_exterior) e o ICMS,
                      o ICMS-ST e o IPI destacados (base_icms_saidas, icms_saidas, icms_st_saidas, ipi_saidas)
    entradas_icms(mes) -> por empresa: codigo, o ICMS e o IPI das compras (base_icms_compras, icms_compras, ipi_compras)
                      e o ICMS das despesas com nota (icms_despesas)
    servicos_iss(mes)  -> por empresa: codigo, o serviço com o acumulador no Anexo IV do Simples (serv_anexo_iv) e o ISS
                      das notas (base_iss, iss_devido, iss_retido)
    piscofins(mes)     -> por empresa: codigo, a venda pela situação tributária do PIS/Cofins do item (pc_tributada,
                      pc_monofasica, pc_st, pc_aliquota_zero, pc_isenta, pc_sem_incidencia, pc_suspensa, pc_outras,
                      pc_sem_cst) e a apuração do mês (base_pis_cofins, pis_apurado, cofins_apurada,
                      creditos_pis_cofins, pis_cofins_a_recolher)
    presumido(mes)     -> por empresa: codigo, a receita pelo percentual de presunção do acumulador (receita_irpj_1_6,
                      _8, _16, _32 e _outros; receita_csll_12, _32 e _outros) e a apuração do IRPJ e da CSLL que o
                      Domínio fez (apuracao_trimestral — 1 ou 0 —, demais_receitas, base_irpj, irpj_apurado, base_csll,
                      csll_apurada)
    resultado(mes)     -> por empresa: codigo, o resultado da contabilidade no mês antes do IRPJ e da CSLL
                      (resultado_antes_ir, negativo = prejuízo), o IRPJ e a CSLL lançados (irpj_csll_lancados), as
                      receitas financeiras e quantos lançamentos tocam conta de resultado (lanc_resultado)
    andamento(mes)     -> a foto do dia (uma vez por rodada, com o mês de hoje), por empresa: codigo, até onde o banco,
                      o extrato e o caixa estão lançados e a data do fechamento (CAMPOS_ANDAMENTO)
    encerramento(ano)  -> por empresa, no ano: codigo, o zeramento (CAMPOS_ENCERRAMENTO); a ponte lê os dois anos
                      antes do de hoje
    jornadas(hoje, teto) -> a foto do dia (desde a versão 4 do pacote, 09/11/2026: o fim da escala 6x1), uma linha por
                      empresa e GRUPO de empregados — o grupo é (codigo, jornada, horas_semana, horas_mes, forma,
                      controle, categoria, unidade) —, com a jornada (a semana, os minutos, o ciclo da escala) e quantos
                      empregados, afastados, com o sábado compensado e com o superior completo, e a soma dos salários do
                      grupo (CAMPOS_JORNADAS); `teto` é o salário do art. 8º da EC 141 do ano (teto_art8)

`mes` é a competência, 'AAAA-MM'; `ano`, o ano (número); `hoje`, a data da rodada. Uma linha por empresa no mês — já contado. Empresa sem
linha no mês fica com os campos daquele bloco em branco (null) no pacote: a ponte nunca inventa um 0.

Duas fontes cumprem este contrato: fonte_falsa.FonteFalsa (o Domínio de mentira, pros testes e pro --falso) e
fonte_dominio.FonteDominio (o de verdade, por ODBC).

CAMPOS_* é a lista do que pode sair deste PC. O que a fonte devolver além disso (nome de funcionário, CPF,
salário…) é descartado pelo pacote.py antes de montar o pacote — é a trava de que dado pessoal não sai daqui.
"""
from decimal import Decimal

CAMPOS_EMPRESA = ('codigo', 'documento', 'nome', 'ativa')

CAMPOS_MES = {
    'folha': ('funcionarios_ativos', 'admissoes', 'desligamentos', 'afastados', 'pro_labore'),
    'fiscal': ('notas_saida', 'valor_saidas', 'notas_entrada', 'valor_entradas'),
    'contabil': ('lancamentos', 'ultimo_lancamento'),
    # desde a versão 2 do pacote (05/11/2026): as consultas que a fila de 03/11 escreveu e conferiu no Domínio
    'faturamento': ('receita_bruta', 'receita_mercadorias', 'receita_servicos', 'devolucoes',
                    'receita_simples', 'receita_simples_propria', 'receita_st', 'receita_monofasica',
                    'receita_exportacao', 'receita_anexo_1', 'receita_anexo_2', 'receita_anexo_3',
                    'receita_anexo_4', 'receita_anexo_5', 'rbt12', 'meses_rbt12'),
    'compras': ('compras', 'compras_st', 'servicos_tomados', 'ativo_e_consumo', 'devolucoes_de_venda',
                'outras_entradas'),
    'folha_valores': ('salarios', 'ferias', 'rescisoes', 'decimo_terceiro', 'pro_labore_valor', 'base_inss',
                      'base_fgts', 'fgts', 'inss_empresa', 'inss_rat', 'inss_terceiros'),
    # desde a versão 3 (05/11/2026): o andamento das contabilidades, que a fila de 04/11 descobriu e conferiu no Domínio
    'origens': ('lanc_normais', 'lanc_extrato', 'lanc_fiscal', 'lanc_folha', 'lanc_apuracao', 'lanc_outros',
                'incluido_ate'),
    'cruzamentos': ('receita_lancada', 'folha_lancada', 'encargos_lancados'),
    'saldos': ('caixa_negativo', 'contra_natureza', 'sem_natureza', 'transitorias', 'transitorias_valor'),
    # desde a versão 5 (11/11/2026): o que o Comparativo tributário apura pelas notas e pela contabilidade — as consultas
    # que a fila de 11/11 escreveu e conferiu no Domínio (os rascunhos comparativo_*.sql, promovidos)
    'saidas_cfop': ('venda_producao', 'venda_revenda', 'venda_combustivel', 'industrializacao_encomenda', 'transporte',
                    'transporte_357', 'energia_comunicacao', 'outras_saidas', 'saidas_no_estado', 'saidas_outro_estado',
                    'saidas_exterior', 'base_icms_saidas', 'icms_saidas', 'icms_st_saidas', 'ipi_saidas'),
    'entradas_icms': ('base_icms_compras', 'icms_compras', 'ipi_compras', 'icms_despesas'),
    'servicos_iss': ('serv_anexo_iv', 'base_iss', 'iss_devido', 'iss_retido'),
    'piscofins': ('pc_tributada', 'pc_monofasica', 'pc_st', 'pc_aliquota_zero', 'pc_isenta', 'pc_sem_incidencia',
                  'pc_suspensa', 'pc_outras', 'pc_sem_cst', 'base_pis_cofins', 'pis_apurado', 'cofins_apurada',
                  'creditos_pis_cofins', 'pis_cofins_a_recolher'),
    'presumido': ('receita_irpj_1_6', 'receita_irpj_8', 'receita_irpj_16', 'receita_irpj_32', 'receita_irpj_outros',
                  'receita_csll_12', 'receita_csll_32', 'receita_csll_outros', 'apuracao_trimestral', 'demais_receitas',
                  'base_irpj', 'irpj_apurado', 'base_csll', 'csll_apurada'),
    'resultado': ('resultado_antes_ir', 'irpj_csll_lancados', 'receitas_financeiras', 'lanc_resultado'),
}
BLOCOS = tuple(CAMPOS_MES)   # a ordem em que a rodada lê: folha, fiscal, contabil, faturamento, compras, folha_valores…
BLOCOS_V5 = ('saidas_cfop', 'entradas_icms', 'servicos_iss', 'piscofins', 'presumido', 'resultado')

# os blocos que não são do mês (versão 3): a foto do dia, uma vez por rodada, e o encerramento de cada ano
CAMPOS_ANDAMENTO = ('banco_contas', 'banco_ate', 'banco_ultimo', 'banco_ultimo_geral', 'caixa_ate', 'caixa_contador_ate',
                    'extrato_contas', 'extrato_ate', 'extrato_pendentes', 'conciliadas', 'conciliado_ate', 'fechamento_em')
CAMPOS_ENCERRAMENTO = ('zerado_em', 'zeramentos', 'zerado_incluido_em', 'lancados_depois', 'lancamentos_do_ano')
# a versão 4 (09/11/2026): a jornada dos funcionários, somada por empresa e por grupo — nunca por pessoa
CAMPOS_JORNADAS = ('jornada', 'tipo', 'tipo_escala', 'semana', 'min_semana', 'min_maior_dia', 'ciclo_dias',
                   'ciclo_trabalho', 'horas_semana', 'horas_mes', 'forma', 'controle', 'categoria', 'unidade',
                   'empregados', 'afastados', 'compensa_sabado', 'superior', 'superior_teto', 'salarios')
GRUPO_JORNADAS = ('codigo', 'jornada', 'horas_semana', 'horas_mes', 'forma', 'controle', 'categoria', 'unidade')
# o grupo com menos de 3 empregados (11/11/2026, decisão do Samuel): sem a soma dos salários, os afastados e o superior,
# que num grupo de uma ou duas pessoas dizem de quem é — vão null (o sistema usa a média da empresa)
GRUPO_MINIMO_JORNADA = 3
CAMPOS_SO_GRUPO_GRANDE = ('salarios', 'afastados', 'superior', 'superior_teto')
BLOCOS_FOTO = ('andamento', 'encerramento', 'jornadas')
ANOS_ENCERRAMENTO = 2   # os dois anos antes do de hoje

# o 2º parâmetro do art. 8º da EC 141/2026: 2,5 × o teto do RGPS do ano (em 2026, 2,5 × R$ 8.475,55). Ano novo: ponha o
# valor do ano (com o teto da portaria do INSS); sem ele, a ponte usa o do ano mais recente e avisa no log
TETO_ART8 = {2026: Decimal('21188.88')}


def teto_art8(ano):
    """(o valor, o ano de onde ele veio): o do próprio ano ou, sem ele, o do ano mais recente da lista."""
    if ano in TETO_ART8:
        return TETO_ART8[ano], ano
    usado = max(TETO_ART8)
    return TETO_ART8[usado], usado

CAMPOS_INTEIROS = {'funcionarios_ativos', 'admissoes', 'desligamentos', 'afastados', 'pro_labore',
                   'notas_saida', 'notas_entrada', 'lancamentos', 'meses_rbt12',
                   'lanc_normais', 'lanc_extrato', 'lanc_fiscal', 'lanc_folha', 'lanc_apuracao', 'lanc_outros',
                   'caixa_negativo', 'contra_natureza', 'sem_natureza', 'transitorias',
                   'banco_contas', 'extrato_contas', 'extrato_pendentes', 'conciliadas',
                   'zeramentos', 'lancados_depois', 'lancamentos_do_ano',
                   'jornada', 'tipo', 'tipo_escala', 'min_semana', 'min_maior_dia', 'ciclo_dias', 'ciclo_trabalho',
                   'forma', 'controle', 'categoria', 'unidade', 'empregados', 'compensa_sabado', 'superior',
                   'superior_teto',
                   # a versão 5: a apuração por trimestre (1) ou por mês (0) e os lançamentos em conta de resultado
                   'apuracao_trimestral', 'lanc_resultado'}
CAMPOS_VALOR = {'valor_saidas', 'valor_entradas', 'receita_lancada', 'folha_lancada', 'encargos_lancados',
                'transitorias_valor'} | {
    c for b in ('faturamento', 'compras', 'folha_valores') + BLOCOS_V5 for c in CAMPOS_MES[b]
    if c not in ('meses_rbt12', 'apuracao_trimestral', 'lanc_resultado')}
CAMPOS_NUMERO = {'horas_semana', 'horas_mes'}   # horas, com até duas casas (não é dinheiro)
CAMPOS_SEMANA = {'semana'}                      # sete caracteres: T, C, F ou -
CAMPOS_DATA = {'ultimo_lancamento', 'incluido_ate', 'banco_ate', 'banco_ultimo', 'banco_ultimo_geral', 'caixa_ate',
               'caixa_contador_ate', 'extrato_ate', 'conciliado_ate', 'fechamento_em', 'zerado_em',
               'zerado_incluido_em'}


class ConsultaAConferir(Exception):
    """A consulta deste bloco ainda não foi escrita (o .sql ainda tem a linha '-- A CONFERIR')."""

    def __init__(self, bloco):
        super().__init__(bloco)
        self.bloco = bloco


class Fonte:
    """O contrato. Cada fonte implementa as dezenove funções; fechar() solta o que estiver aberto."""

    def empresas(self):
        raise NotImplementedError

    def folha(self, mes):
        raise NotImplementedError

    def fiscal(self, mes):
        raise NotImplementedError

    def contabil(self, mes):
        raise NotImplementedError

    def faturamento(self, mes):
        raise NotImplementedError

    def compras(self, mes):
        raise NotImplementedError

    def folha_valores(self, mes):
        raise NotImplementedError

    def origens(self, mes):
        raise NotImplementedError

    def cruzamentos(self, mes):
        raise NotImplementedError

    def saldos(self, mes):
        raise NotImplementedError

    def saidas_cfop(self, mes):
        raise NotImplementedError

    def entradas_icms(self, mes):
        raise NotImplementedError

    def servicos_iss(self, mes):
        raise NotImplementedError

    def piscofins(self, mes):
        raise NotImplementedError

    def presumido(self, mes):
        raise NotImplementedError

    def resultado(self, mes):
        raise NotImplementedError

    def andamento(self, mes):
        raise NotImplementedError

    def encerramento(self, ano):
        raise NotImplementedError

    def jornadas(self, hoje, teto):
        raise NotImplementedError

    def fechar(self):
        pass
