"""O Domínio de mentira: quatro empresas inventadas, pra testar a ponte sem o Domínio (`rodar --falso`).

Os CNPJs têm o dígito verificador errado de propósito (não batem com empresa de verdade) e os nomes levam
"(INVENTADA)". Os números passam pelos casos que a ponte tem que tratar:
    101  ativa, com tudo — e a folha devolve também nome e salário de funcionário, como uma consulta mal escrita
         devolveria: a ponte tem que jogar fora (o valor das saídas vem em Decimal, como o ODBC entrega)
    102  sem funcionário (0 de verdade, não em branco) e sem nota nos meses ímpares
    103  inativa e sem nada no mês: tudo em branco no pacote
    104  documento com pontuação (sai sem) e sem contabilidade lançada
Desde a versão 3 (05/11/2026), o andamento das contabilidades: a 101 com dois bancos, extrato e o zeramento, a 102 sem
banco há anos, com o caixa negativo, uma transitória com saldo e o pró-labore fora da contabilidade; a 103 só na foto,
sem nada. Os campos a mais que uma consulta mal escrita traria (o usuário que lançou, o nome da conta e o do banco) têm
que ficar no PC.
Desde a versão 4 (09/11/2026), as jornadas (a foto do dia): a 101 com uma 6x1 de 44 horas, uma 5x2 com o sábado
compensado e uma 12x36 de horista (os três grupos somam os funcionários ativos dela no mês de hoje), e a 104 com um
grupo sem jornada no Domínio. A 6x1 traz também o nome e o CPF de uma pessoa, que não podem sair do PC.
Desde a versão 5 (11/11/2026), o que o Comparativo tributário apura pelas notas e pela contabilidade: a 101 (do Simples,
comércio) com a revenda pelo CFOP, o ICMS das compras, a venda toda sem CST de PIS/Cofins e sem presunção (o acumulador
do Simples não tem) e o lucro do mês; a 102 com a revenda nos meses pares e prejuízo nos ímpares (o resultado negativo);
a 104 (do Presumido, serviços) com o ISS, a venda tributada de PIS/Cofins com a apuração, a presunção de 32% com a
apuração do trimestre — e sem resultado, que ela não tem contabilidade. O cliente da nota, o sócio e o nome da conta
que uma consulta mal escrita traria ficam no PC.
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

    # desde a versão 3 do pacote (05/11/2026): o andamento das contabilidades
    def origens(self, mes):
        ano, m = _ano_mes(mes)
        ontem = datetime.date.today() - datetime.timedelta(days=1)
        fim = datetime.date(ano, m, calendar.monthrange(ano, m)[1])
        return [
            {'codigo': 101, 'lanc_normais': 4, 'lanc_extrato': 25, 'lanc_fiscal': 340 + m, 'lanc_folha': 15,
             'lanc_apuracao': 3, 'lanc_outros': 1, 'incluido_ate': min(fim + datetime.timedelta(days=5), ontem),
             # o que uma consulta mal escrita devolveria — não pode sair deste PC
             'usuario': 'FULANO (INVENTADO)'},
            {'codigo': 102, 'lanc_normais': 1, 'lanc_extrato': 0, 'lanc_fiscal': 30 if m % 2 == 0 else 0, 'lanc_folha': 0,
             'lanc_apuracao': 0, 'lanc_outros': 0,
             'incluido_ate': datetime.datetime(min(fim, ontem).year, min(fim, ontem).month, min(fim, ontem).day, 18, 5)},
        ]

    def cruzamentos(self, mes):
        _, m = _ano_mes(mes)
        linhas = [
            # 101: a receita e a folha lançadas batem com o faturamento e a folha
            {'codigo': 101, 'receita_lancada': Decimal('80000.00') + m,
             'folha_lancada': Decimal('20800.00') + m + (Decimal('12500.00') if m == 12 else 0),
             'encargos_lancados': Decimal('1128.00')},
        ]
        if m % 2 == 0:   # 102: a receita lançada; o pró-labore (1518) ficou fora da contabilidade
            linhas.append({'codigo': 102, 'receita_lancada': 7300.4, 'folha_lancada': 0, 'encargos_lancados': 0})
        return linhas

    def saldos(self, mes):
        return [
            {'codigo': 101, 'caixa_negativo': 0, 'contra_natureza': 2, 'sem_natureza': 0, 'transitorias': 0,
             'transitorias_valor': 0,
             # o que uma consulta mal escrita devolveria — não pode sair deste PC
             'nome_conta': 'EMPRESTIMO DO SOCIO FULANO (INVENTADO)'},
            {'codigo': 102, 'caixa_negativo': 1, 'contra_natureza': 0, 'sem_natureza': 1, 'transitorias': 1,
             'transitorias_valor': Decimal('350.75')},
        ]

    # desde a versão 5 do pacote (11/11/2026): o que o Comparativo tributário apura pelas notas e pela contabilidade
    def saidas_cfop(self, mes):
        _, m = _ano_mes(mes)
        zeros = {'venda_producao': 0, 'venda_combustivel': 0, 'industrializacao_encomenda': 0, 'transporte': 0,
                 'transporte_357': 0, 'energia_comunicacao': 0, 'outras_saidas': 0, 'saidas_exterior': 0,
                 'base_icms_saidas': 0, 'icms_saidas': 0, 'icms_st_saidas': 0, 'ipi_saidas': 0}
        linhas = [
            # 101: a revenda (a soma dos grupos é a receita de mercadoria antes da devolução), parte pra fora do estado
            {'codigo': 101, **zeros, 'venda_revenda': Decimal('80500.00') + m, 'saidas_no_estado': Decimal('70500.00') + m,
             'saidas_outro_estado': Decimal('10000.00'),
             # o que uma consulta mal escrita devolveria — não pode sair deste PC
             'cliente': 'CLIENTE DA NOTA (INVENTADO)'},
        ]
        if m % 2 == 0:   # 102 só tem nota nos meses pares
            linhas.append({'codigo': 102, **zeros, 'venda_revenda': 7300.4, 'saidas_no_estado': 7300.4,
                           'saidas_outro_estado': 0})
        return linhas                                                   # a 104 só presta serviço: sem linha aqui

    def entradas_icms(self, mes):
        _, m = _ano_mes(mes)
        linhas = [
            {'codigo': 101, 'base_icms_compras': Decimal('45000.00') + m, 'icms_compras': Decimal('5400.00'),
             'ipi_compras': Decimal('112.35'), 'icms_despesas': Decimal('216.00')},
            {'codigo': 104, 'base_icms_compras': 0, 'icms_compras': 0, 'ipi_compras': 0, 'icms_despesas': 0},
        ]
        if m % 2 == 0:
            linhas.append({'codigo': 102, 'base_icms_compras': 2100, 'icms_compras': 252, 'ipi_compras': 0,
                           'icms_despesas': 0})
        return linhas

    def servicos_iss(self, mes):
        # só a 104 presta serviço: o ISS de 3%, uma parte retida pelo tomador
        return [{'codigo': 104, 'serv_anexo_iv': 0, 'base_iss': 18000, 'iss_devido': 540, 'iss_retido': Decimal('180.00')}]

    def piscofins(self, mes):
        _, m = _ano_mes(mes)
        zeros = {'pc_tributada': 0, 'pc_monofasica': 0, 'pc_st': 0, 'pc_aliquota_zero': 0, 'pc_isenta': 0,
                 'pc_sem_incidencia': 0, 'pc_suspensa': 0, 'pc_outras': 0, 'pc_sem_cst': 0}
        sem_apuracao = {'base_pis_cofins': None, 'pis_apurado': None, 'cofins_apurada': None,
                        'creditos_pis_cofins': None, 'pis_cofins_a_recolher': None}
        linhas = [
            # 101, do Simples: o item não tem o CST (a venda toda em pc_sem_cst) e não há apuração
            {'codigo': 101, **zeros, 'pc_sem_cst': Decimal('80500.00') + m, **sem_apuracao},
            # 104, do Presumido: a venda tributada, com a apuração do cumulativo (0,65% e 3%)
            {'codigo': 104, **zeros, 'pc_tributada': 18000, 'base_pis_cofins': 18000, 'pis_apurado': 117,
             'cofins_apurada': 540, 'creditos_pis_cofins': 0, 'pis_cofins_a_recolher': 657},
        ]
        if m % 2 == 0:
            linhas.append({'codigo': 102, **zeros, 'pc_sem_cst': 7300.4, **sem_apuracao})
        return linhas

    def presumido(self, mes):
        _, m = _ano_mes(mes)
        zeros = {'receita_irpj_1_6': 0, 'receita_irpj_8': 0, 'receita_irpj_16': 0, 'receita_irpj_32': 0,
                 'receita_irpj_outros': 0, 'receita_csll_12': 0, 'receita_csll_32': 0, 'receita_csll_outros': 0}
        sem_apuracao = {'apuracao_trimestral': None, 'demais_receitas': None, 'base_irpj': None, 'irpj_apurado': None,
                        'base_csll': None, 'csll_apurada': None}
        linhas = [
            # 101, do Simples: o acumulador não tem a presunção (a receita, com a devolução negativa, em "outros")
            {'codigo': 101, **zeros, 'receita_irpj_outros': Decimal('80000.00') + m,
             'receita_csll_outros': Decimal('80000.00') + m, **sem_apuracao},
            # 104, do Presumido: serviço a 32%, com a apuração do trimestre (3 × 18.000 × 32%; 15% e 9% da base)
            {'codigo': 104, **zeros, 'receita_irpj_32': 18000, 'receita_csll_32': 18000, 'apuracao_trimestral': 1,
             'demais_receitas': 0, 'base_irpj': 17280, 'irpj_apurado': 2592, 'base_csll': 17280,
             'csll_apurada': Decimal('1555.20'),
             # o que uma consulta mal escrita devolveria — não pode sair deste PC
             'socio': 'SICRANO (INVENTADO)'},
        ]
        if m % 2 == 0:
            linhas.append({'codigo': 102, **zeros, 'receita_irpj_outros': 7300.4, 'receita_csll_outros': 7300.4,
                           **sem_apuracao})
        return linhas

    def resultado(self, mes):
        _, m = _ano_mes(mes)
        return [
            # 101: lucro todo mês
            {'codigo': 101, 'resultado_antes_ir': Decimal('9200.00') + m, 'irpj_csll_lancados': 0,
             'receitas_financeiras': Decimal('35.40'), 'lanc_resultado': 380 + m,
             # o que uma consulta mal escrita devolveria — não pode sair deste PC
             'conta': 'LUCROS DISTRIBUIDOS AO BELTRANO (INVENTADO)'},
            # 102: lucro nos meses com venda e prejuízo nos outros (o resultado negativo)
            {'codigo': 102, 'resultado_antes_ir': Decimal('1800.40') if m % 2 == 0 else Decimal('-420.15'),
             'irpj_csll_lancados': 0, 'receitas_financeiras': 0, 'lanc_resultado': 9},
        ]                                                               # a 104 não tem contabilidade: sem linha

    def andamento(self, mes):
        ano, m = _ano_mes(mes)
        ini = datetime.date(ano, m, 1)
        ontem = datetime.date.today() - datetime.timedelta(days=1)
        return [
            {'codigo': 101, 'banco_contas': 2, 'banco_ate': ini - datetime.timedelta(days=40),
             'banco_ultimo': ini - datetime.timedelta(days=5), 'banco_ultimo_geral': ini - datetime.timedelta(days=5),
             'caixa_ate': ontem, 'caixa_contador_ate': ini - datetime.timedelta(days=20), 'extrato_contas': 1,
             'extrato_ate': ini - datetime.timedelta(days=5), 'extrato_pendentes': 4, 'conciliadas': 1,
             'conciliado_ate': ini - datetime.timedelta(days=40), 'fechamento_em': datetime.date(ano - 1, 12, 31),
             # o que uma consulta mal escrita devolveria — não pode sair deste PC
             'nome_banco': 'BANCO DO FULANO AG 0001 CC 12345 (INVENTADO)'},
            {'codigo': 102, 'banco_contas': 0, 'banco_ate': None, 'banco_ultimo': None,
             'banco_ultimo_geral': datetime.date(ano - 2, 6, 30), 'caixa_ate': ontem, 'caixa_contador_ate': None,
             'extrato_contas': 0, 'extrato_ate': None, 'extrato_pendentes': 0, 'conciliadas': 0, 'conciliado_ate': None,
             'fechamento_em': None},
            {'codigo': 103, 'banco_contas': 0, 'banco_ate': None, 'banco_ultimo': None, 'banco_ultimo_geral': None,
             'caixa_ate': None, 'caixa_contador_ate': None, 'extrato_contas': 0, 'extrato_ate': None,
             'extrato_pendentes': 0, 'conciliadas': 0, 'conciliado_ate': None, 'fechamento_em': None},
        ]

    def encerramento(self, ano):
        ontem = datetime.date.today() - datetime.timedelta(days=1)
        return [
            {'codigo': 101, 'zerado_em': datetime.date(ano, 12, 31), 'zeramentos': 1,
             'zerado_incluido_em': min(datetime.date(ano + 1, 3, 10), ontem), 'lancados_depois': 12,
             'lancamentos_do_ano': 4300},
            {'codigo': 102, 'zerado_em': None, 'zeramentos': 0, 'zerado_incluido_em': None, 'lancados_depois': None,
             'lancamentos_do_ano': 420},
        ]

    # desde a versão 4 do pacote (09/11/2026): a jornada dos funcionários, por empresa e grupo
    def jornadas(self, hoje, teto):
        m = hoje.month
        return [
            # 101: a 6x1 de 44 horas (folga no domingo), mensalistas
            {'codigo': 101, 'jornada': 1, 'tipo': 2, 'tipo_escala': 0, 'semana': 'TTTTTTF', 'min_semana': 2640,
             'min_maior_dia': 440, 'ciclo_dias': None, 'ciclo_trabalho': None, 'horas_semana': Decimal('44.00'),
             'horas_mes': Decimal('220.00'), 'forma': 1, 'controle': 1, 'categoria': 101, 'unidade': 5,
             'empregados': 2 + m % 3, 'afastados': 1, 'compensa_sabado': 0, 'superior': 0, 'superior_teto': 0,
             'salarios': Decimal('2000.00') * (2 + m % 3),
             # o que uma consulta mal escrita devolveria — não pode sair deste PC
             'nome': 'FULANO DE TAL (INVENTADO)', 'cpf': '000.000.000-00'},
            # 101: a 5x2 com o sábado compensado (8h48 de segunda a sexta)
            {'codigo': 101, 'jornada': 2, 'tipo': 1, 'tipo_escala': 0, 'semana': 'TTTTTCF', 'min_semana': 2640,
             'min_maior_dia': 528, 'ciclo_dias': None, 'ciclo_trabalho': None, 'horas_semana': 44,
             'horas_mes': 220, 'forma': 1, 'controle': 1, 'categoria': 101, 'unidade': 5, 'empregados': 1,
             'afastados': 0, 'compensa_sabado': 1, 'superior': 1, 'superior_teto': 1, 'salarios': Decimal('25000.00')},
            # 101: a 12x36 de um horista (o ciclo de 2 dias: 12 horas e 36 de folga)
            {'codigo': 101, 'jornada': 3, 'tipo': 4, 'tipo_escala': 1, 'semana': None, 'min_semana': 2520,
             'min_maior_dia': 720, 'ciclo_dias': 2, 'ciclo_trabalho': 1, 'horas_semana': Decimal('36.00'),
             'horas_mes': Decimal('180.00'), 'forma': 1, 'controle': 1, 'categoria': 101, 'unidade': 1,
             'empregados': 1, 'afastados': 0, 'compensa_sabado': 0, 'superior': 0, 'superior_teto': 0,
             'salarios': Decimal('9.75')},
            # 104: dois empregados sem jornada no Domínio
            {'codigo': 104, 'jornada': None, 'tipo': None, 'tipo_escala': None, 'semana': None, 'min_semana': None,
             'min_maior_dia': None, 'ciclo_dias': None, 'ciclo_trabalho': None, 'horas_semana': 44, 'horas_mes': 220,
             'forma': 1, 'controle': 1, 'categoria': 101, 'unidade': 5, 'empregados': 2, 'afastados': 0,
             'compensa_sabado': 0, 'superior': 0, 'superior_teto': 0, 'salarios': 4600},
        ]
