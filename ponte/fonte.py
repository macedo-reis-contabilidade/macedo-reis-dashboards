"""O que a ponte lê do Domínio: sete funções, cada uma devolve uma lista de dicionários.

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

`mes` é a competência, 'AAAA-MM'. Uma linha por empresa no mês — já contado. Empresa sem linha no mês fica com
os campos daquele bloco em branco (null) no pacote: a ponte nunca inventa um 0.

Duas fontes cumprem este contrato: fonte_falsa.FonteFalsa (o Domínio de mentira, pros testes e pro --falso) e
fonte_dominio.FonteDominio (o de verdade, por ODBC).

CAMPOS_* é a lista do que pode sair deste PC. O que a fonte devolver além disso (nome de funcionário, CPF,
salário…) é descartado pelo pacote.py antes de montar o pacote — é a trava de que dado pessoal não sai daqui.
"""

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
}
BLOCOS = tuple(CAMPOS_MES)   # a ordem em que a rodada lê: folha, fiscal, contabil, faturamento, compras, folha_valores

CAMPOS_INTEIROS = {'funcionarios_ativos', 'admissoes', 'desligamentos', 'afastados', 'pro_labore',
                   'notas_saida', 'notas_entrada', 'lancamentos', 'meses_rbt12'}
CAMPOS_VALOR = {'valor_saidas', 'valor_entradas'} | {
    c for b in ('faturamento', 'compras', 'folha_valores') for c in CAMPOS_MES[b] if c != 'meses_rbt12'}
CAMPOS_DATA = {'ultimo_lancamento'}


class ConsultaAConferir(Exception):
    """A consulta deste bloco ainda não foi escrita (o .sql ainda tem a linha '-- A CONFERIR')."""

    def __init__(self, bloco):
        super().__init__(bloco)
        self.bloco = bloco


class Fonte:
    """O contrato. Cada fonte implementa as sete funções; fechar() solta o que estiver aberto."""

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

    def fechar(self):
        pass
