"""O Domínio de mentira: quatro empresas inventadas, pra testar a ponte sem o Domínio (`rodar --falso`).

Os CNPJs têm o dígito verificador errado de propósito (não batem com empresa de verdade) e os nomes levam
"(INVENTADA)". Os números passam pelos casos que a ponte tem que tratar:
    101  ativa, com tudo — e a folha devolve também nome e salário de funcionário, como uma consulta mal escrita
         devolveria: a ponte tem que jogar fora (o valor das saídas vem em Decimal, como o ODBC entrega)
    102  sem funcionário (0 de verdade, não em branco) e sem nota nos meses ímpares
    103  inativa e sem nada no mês: tudo em branco no pacote
    104  documento com pontuação (sai sem) e sem contabilidade lançada
"""
import calendar
import datetime
from decimal import Decimal

from .fonte import Fonte

EMPRESAS = (
    {'codigo': 101, 'documento': '11.222.333/0001-00', 'nome': 'PADARIA EXEMPLO LTDA (INVENTADA)', 'ativa': True},
    {'codigo': 102, 'documento': '22333444000100', 'nome': 'COMÉRCIO MODELO ME (INVENTADA)', 'ativa': True},
    {'codigo': 103, 'documento': '33444555000100', 'nome': 'TRANSPORTES FICTÍCIOS LTDA (INVENTADA)', 'ativa': False},
    {'codigo': 104, 'documento': '44.555.666/0001-00', 'nome': 'SERVIÇOS INVENTADOS LTDA (INVENTADA)', 'ativa': True},
)


def _ano_mes(mes):
    ano, m = mes.split('-')
    return int(ano), int(m)


class FonteFalsa(Fonte):
    def empresas(self):
        return [dict(e) for e in EMPRESAS]

    def folha(self, mes):
        _, m = _ano_mes(mes)
        return [
            {'codigo': 101, 'funcionarios_ativos': 4 + m % 3, 'admissoes': m % 2, 'desligamentos': 0,
             'afastados': 1 if m == 7 else 0, 'pro_labore': 2,
             # o que uma consulta mal escrita devolveria — não pode sair deste PC
             'nome_funcionario': 'FULANO DE TAL (INVENTADO)', 'salario_base': Decimal('1234.56')},
            {'codigo': 102, 'funcionarios_ativos': 0, 'admissoes': 0, 'desligamentos': 0, 'afastados': 0,
             'pro_labore': 1},
            {'codigo': 104, 'funcionarios_ativos': 2, 'admissoes': 0, 'desligamentos': 1 if m == 9 else 0,
             'afastados': 0, 'pro_labore': 1},
        ]

    def fiscal(self, mes):
        _, m = _ano_mes(mes)
        linhas = [
            {'codigo': 101, 'notas_saida': 300 + m, 'valor_saidas': Decimal('84211.50') + m,
             'notas_entrada': 40 + m, 'valor_entradas': Decimal('51003.10')},
            {'codigo': 104, 'notas_saida': 12, 'valor_saidas': 18000, 'notas_entrada': 3, 'valor_entradas': 950.25},
        ]
        if m % 2 == 0:   # 102 só tem nota nos meses pares
            linhas.append({'codigo': 102, 'notas_saida': 25, 'valor_saidas': 7300.4, 'notas_entrada': 8,
                           'valor_entradas': 2100})
        return linhas

    def contabil(self, mes):
        ano, m = _ano_mes(mes)
        ontem = datetime.date.today() - datetime.timedelta(days=1)
        fim = min(datetime.date(ano, m, calendar.monthrange(ano, m)[1]), ontem)
        return [
            {'codigo': 101, 'lancamentos': 120 + m, 'ultimo_lancamento': fim},
            {'codigo': 102, 'lancamentos': 35, 'ultimo_lancamento': datetime.datetime(fim.year, fim.month, 1, 9, 30)},
        ]
