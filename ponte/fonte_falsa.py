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

    # desde a versão 2 do pacote (05/11/2026)
    def faturamento(self, mes):
        _, m = _ano_mes(mes)
        linhas = [
            # 101: do Simples, comércio com ST, apurando com uma filial (a receita do Simples é maior que a própria)
            {'codigo': 101, 'receita_bruta': Decimal('80000.00') + m, 'receita_mercadorias': Decimal('80500.00') + m,
             'receita_servicos': 0, 'devolucoes': Decimal('500.00'), 'receita_simples': Decimal('92000.00') + m,
             'receita_simples_propria': Decimal('80000.00') + m, 'receita_st': Decimal('30000.00'),
             'receita_monofasica': 0, 'receita_exportacao': 0, 'receita_anexo_1': Decimal('92000.00') + m,
             'receita_anexo_2': 0, 'receita_anexo_3': 0, 'receita_anexo_4': 0, 'receita_anexo_5': 0,
             'rbt12': Decimal('1020000.00'), 'meses_rbt12': 12,
             # o que uma consulta mal escrita devolveria — não pode sair deste PC
             'maior_cliente': 'FULANO COMPRADOR (INVENTADO)'},
            # 104: do Presumido — sem a apuração do Simples (as colunas dela em branco)
            {'codigo': 104, 'receita_bruta': 18000, 'receita_mercadorias': 0, 'receita_servicos': 18000,
             'devolucoes': 0, 'receita_simples': None, 'receita_simples_propria': None, 'receita_st': None,
             'receita_monofasica': None, 'receita_exportacao': None, 'receita_anexo_1': None,
             'receita_anexo_2': None, 'receita_anexo_3': None, 'receita_anexo_4': None, 'receita_anexo_5': None,
             'rbt12': None, 'meses_rbt12': None},
        ]
        if m % 2 == 0:   # 102 só tem nota nos meses pares; do Simples, no primeiro ano (o RBT12 proporcional)
            linhas.append({'codigo': 102, 'receita_bruta': 7300.4, 'receita_mercadorias': 7300.4, 'receita_servicos': 0,
                           'devolucoes': 0, 'receita_simples': 7300.4, 'receita_simples_propria': 7300.4,
                           'receita_st': 0, 'receita_monofasica': 7300.4, 'receita_exportacao': 0,
                           'receita_anexo_1': 7300.4, 'receita_anexo_2': 0, 'receita_anexo_3': 0,
                           'receita_anexo_4': 0, 'receita_anexo_5': 0, 'rbt12': 52000, 'meses_rbt12': 7})
        return linhas

    def compras(self, mes):
        _, m = _ano_mes(mes)
        linhas = [
            {'codigo': 101, 'compras': Decimal('45000.00') + m, 'compras_st': Decimal('15000.00'),
             'servicos_tomados': Decimal('1200.00'), 'ativo_e_consumo': Decimal('300.00'), 'devolucoes_de_venda': 500,
             'outras_entradas': Decimal('4003.10'), 'fornecedor': 'FORNECEDOR (INVENTADO)'},
            {'codigo': 104, 'compras': 0, 'compras_st': 0, 'servicos_tomados': 950.25, 'ativo_e_consumo': 0,
             'devolucoes_de_venda': 0, 'outras_entradas': 0},
        ]
        if m % 2 == 0:
            linhas.append({'codigo': 102, 'compras': 2100, 'compras_st': 0, 'servicos_tomados': 0, 'ativo_e_consumo': 0,
                           'devolucoes_de_venda': 0, 'outras_entradas': 0})
        return linhas

    def folha_valores(self, mes):
        _, m = _ano_mes(mes)
        return [
            {'codigo': 101, 'salarios': Decimal('14800.00') + m, 'ferias': Decimal('1800.00') if m == 7 else 0,
             'rescisoes': 0, 'decimo_terceiro': Decimal('12500.00') if m == 12 else 0,
             'pro_labore_valor': Decimal('6000.00'), 'base_inss': Decimal('14100.00'), 'base_fgts': Decimal('14100.00'),
             'fgts': Decimal('1128.00'), 'inss_empresa': 0, 'inss_rat': 0, 'inss_terceiros': 0,
             # o que uma consulta mal escrita devolveria — não pode sair deste PC
             'nome_funcionario': 'FULANO DE TAL (INVENTADO)', 'salario_base': Decimal('1234.56')},
            {'codigo': 102, 'salarios': 0, 'ferias': 0, 'rescisoes': 0, 'decimo_terceiro': 0,
             'pro_labore_valor': 1518, 'base_inss': 0, 'base_fgts': 0, 'fgts': None, 'inss_empresa': None,
             'inss_rat': None, 'inss_terceiros': None},
            {'codigo': 104, 'salarios': 4600, 'ferias': 0, 'rescisoes': 2300 if m == 9 else 0, 'decimo_terceiro': 0,
             'pro_labore_valor': 3000, 'base_inss': 4400, 'base_fgts': 4400, 'fgts': 352,
             'inss_empresa': 880, 'inss_rat': 88, 'inss_terceiros': 255.2},
        ]
