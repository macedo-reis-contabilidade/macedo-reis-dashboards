"""O que a ponte lê do Domínio: treze funções, cada uma devolve uma lista de dicionários.

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
}
BLOCOS = tuple(CAMPOS_MES)   # a ordem em que a rodada lê: folha, fiscal, contabil, faturamento, compras, folha_valores…

# os blocos que não são do mês (versão 3): a foto do dia, uma vez por rodada, e o encerramento de cada ano
CAMPOS_ANDAMENTO = ('banco_contas', 'banco_ate', 'banco_ultimo', 'banco_ultimo_geral', 'caixa_ate', 'caixa_contador_ate',
                    'extrato_contas', 'extrato_ate', 'extrato_pendentes', 'conciliadas', 'conciliado_ate', 'fechamento_em')
CAMPOS_ENCERRAMENTO = ('zerado_em', 'zeramentos', 'zerado_incluido_em', 'lancados_depois', 'lancamentos_do_ano')
# a versão 4 (09/11/2026): a jornada dos funcionários, somada por empresa e por grupo — nunca por pessoa
CAMPOS_JORNADAS = ('jornada', 'tipo', 'tipo_escala', 'semana', 'min_semana', 'min_maior_dia', 'ciclo_dias',
                   'ciclo_trabalho', 'horas_semana', 'horas_mes', 'forma', 'controle', 'categoria', 'unidade',
                   'empregados', 'afastados', 'compensa_sabado', 'superior', 'superior_teto', 'salarios')
GRUPO_JORNADAS = ('codigo', 'jornada', 'horas_semana', 'horas_mes', 'forma', 'controle', 'categoria', 'unidade')
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
                   'superior_teto'}
CAMPOS_VALOR = {'valor_saidas', 'valor_entradas', 'receita_lancada', 'folha_lancada', 'encargos_lancados',
                'transitorias_valor'} | {
    c for b in ('faturamento', 'compras', 'folha_valores') for c in CAMPOS_MES[b] if c != 'meses_rbt12'}
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
    """O contrato. Cada fonte implementa as treze funções; fechar() solta o que estiver aberto."""

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

    def andamento(self, mes):
        raise NotImplementedError

    def encerramento(self, ano):
        raise NotImplementedError

    def jornadas(self, hoje, teto):
        raise NotImplementedError

    def fechar(self):
        pass
