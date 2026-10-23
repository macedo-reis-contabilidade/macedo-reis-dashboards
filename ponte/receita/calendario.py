"""Quando cada consulta roda (a tarefa "Ponte Receita" roda de segunda a sexta; dia útil = segunda a sexta —
consultar num feriado não faz mal). O --so passa por cima de tudo isto.

    autorizacao      todas as empresas: no primeiro dia útil do mês, e na empresa que nunca foi consultada
    pgdas            Simples: no dia 21 (ou no próximo dia útil, se o 21 cair no fim de semana) e no último dia
                     útil do mês — este, só pra quem ainda não tinha o mês anterior; em janeiro, o ano anterior também
    faturamento      Simples: quando o pgdas mostra um mês declarado cuja declaração ainda não foi lida
                     (decidido depois do pgdas, em servicos.py)
    caixa_postal     todas: todo dia útil
    situacao_fiscal  todas: no dia 5 (ou no próximo dia útil)
"""
import calendar
import datetime


def dia_util(d):
    return d.weekday() < 5


def dia_ou_proximo_util(ano, mes, dia):
    d = datetime.date(ano, mes, dia)
    while not dia_util(d):
        d += datetime.timedelta(days=1)
    return d


def primeiro_dia_util(ano, mes):
    return dia_ou_proximo_util(ano, mes, 1)


def ultimo_dia_util(ano, mes):
    d = datetime.date(ano, mes, calendar.monthrange(ano, mes)[1])
    while not dia_util(d):
        d -= datetime.timedelta(days=1)
    return d


def mes_anterior(hoje):
    primeiro = hoje.replace(day=1)
    return (primeiro - datetime.timedelta(days=1)).strftime('%Y-%m')


def servicos_do_dia(hoje, empresa, estado):
    """O que roda hoje pra esta empresa (fora o faturamento, que depende do pgdas)."""
    if not dia_util(hoje):
        return set()
    doc, simples = empresa['documento'], empresa.get('regime') == 'simples'
    s = {'caixa_postal'}
    if hoje == primeiro_dia_util(hoje.year, hoje.month) or not estado.autorizacao_consultada(doc):
        s.add('autorizacao')
    if simples:
        if hoje == dia_ou_proximo_util(hoje.year, hoje.month, 21):
            s.add('pgdas')
        elif hoje == ultimo_dia_util(hoje.year, hoje.month) and mes_anterior(hoje) not in estado.meses_declarados(doc):
            s.add('pgdas')
    if hoje == dia_ou_proximo_util(hoje.year, hoje.month, 5):
        s.add('situacao_fiscal')
    return s


def anos_do_pgdas(hoje):
    """Os anos-calendário que o pgdas consulta: o atual e, em janeiro, o anterior também."""
    return [hoje.year - 1, hoje.year] if hoje.month == 1 else [hoje.year]
