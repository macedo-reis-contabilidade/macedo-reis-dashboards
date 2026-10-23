"""O que a ponte lê do Domínio: quatro funções, cada uma devolve uma lista de dicionários.

    empresas()     -> codigo (o código da empresa no Domínio, número), documento (sem pontuação), nome, ativa
    folha(mes)     -> por empresa: codigo, funcionarios_ativos, admissoes, desligamentos, afastados,
                      pro_labore (quantos sócios com pró-labore no mês)
    fiscal(mes)    -> por empresa: codigo, notas_saida, valor_saidas, notas_entrada, valor_entradas
    contabil(mes)  -> por empresa: codigo, lancamentos, ultimo_lancamento (data)

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
}
BLOCOS = tuple(CAMPOS_MES)   # a ordem em que a rodada lê: folha, fiscal, contabil

CAMPOS_INTEIROS = {'funcionarios_ativos', 'admissoes', 'desligamentos', 'afastados', 'pro_labore',
                   'notas_saida', 'notas_entrada', 'lancamentos'}
CAMPOS_VALOR = {'valor_saidas', 'valor_entradas'}
CAMPOS_DATA = {'ultimo_lancamento'}


class ConsultaAConferir(Exception):
    """A consulta deste bloco ainda não foi escrita (o .sql ainda tem a linha '-- A CONFERIR')."""

    def __init__(self, bloco):
        super().__init__(bloco)
        self.bloco = bloco


class Fonte:
    """O contrato. Cada fonte implementa as quatro funções; fechar() solta o que estiver aberto."""

    def empresas(self):
        raise NotImplementedError

    def folha(self, mes):
        raise NotImplementedError

    def fiscal(self, mes):
        raise NotImplementedError

    def contabil(self, mes):
        raise NotImplementedError

    def fechar(self):
        pass
