"""Quando cada consulta roda (a tarefa "Ponte Receita" roda de segunda a sexta; dia útil = segunda a sexta —
consultar num feriado não faz mal). O --so passa por cima de tudo isto.

A PARTIR DO DIA (24/10/2026): cada consulta tem os seus dias marcados, e roda no dia marcado ou na primeira rodada
depois dele, quando aquela consulta daquela empresa ainda não foi feita desde o dia marcado (o estado.json guarda a
data de cada uma). Com o PC desligado o dia inteiro, a consulta do mês não fica pra trás: roda no dia seguinte. A
empresa que nunca foi consultada roda na primeira rodada.

    autorizacao      todas as empresas: o primeiro dia útil do mês e, pras que estavam sem a autorização (sem ou
                     vencida), a segunda-feira de cada semana — o cliente autoriza e o escritório vê na mesma semana
    pgdas            Simples: o primeiro dia útil DEPOIS do prazo do mês anterior e o último dia útil do mês — este,
                     só pra quem ainda tinha algum mês sem declaração; em janeiro, o ano anterior também. O prazo é o
                     dia 20 ou, sem expediente, o primeiro dia útil depois; aqui o dia útil é segunda a sexta SEM
                     FERIADO (feriados_do_ano, a lista de assets/js/rescisao-datas.js portada — o teste compara as duas).
                     Depois do prazo, e não no dia dele: o vigia do sistema avisa "PGDAS não transmitido" quando a
                     consulta é depois do prazo e o mês não aparece — no próprio dia, de manhã, seria aviso falso pra
                     quem transmite naquele dia
    faturamento      Simples: quando o pgdas mostra um mês declarado cuja declaração ainda não foi lida
                     (decidido depois do pgdas, em servicos.py)
    caixa_postal     todas: todo dia útil
    situacao_fiscal  todas: o dia 5 (ou o próximo dia útil)
"""
import calendar
import datetime

UM_DIA = datetime.timedelta(days=1)
PRAZO_PGDAS = 20


def dia_util(d):
    return d.weekday() < 5


def dia_ou_proximo_util(ano, mes, dia):
    d = datetime.date(ano, mes, dia)
    while not dia_util(d):
        d += UM_DIA
    return d


def primeiro_dia_util(ano, mes):
    return dia_ou_proximo_util(ano, mes, 1)


def ultimo_dia_util(ano, mes):
    d = datetime.date(ano, mes, calendar.monthrange(ano, mes)[1])
    while not dia_util(d):
        d -= UM_DIA
    return d


def mes_anterior(hoje):
    primeiro = hoje.replace(day=1)
    return (primeiro - UM_DIA).strftime('%Y-%m')


# ---------------------------------------------------------------- feriados (os de assets/js/rescisao-datas.js)

def pascoa(ano):
    """Domingo de Páscoa (Meeus/Jones/Butcher, calendário gregoriano) — o mesmo cálculo do JavaScript."""
    a, b, c = ano % 19, ano // 100, ano % 100
    d, e = b // 4, b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = c // 4, c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    x = h + l - 7 * m + 114
    return datetime.date(ano, x // 31, x % 31 + 1)


FIXOS = (('01-01', 'Confraternização Universal'), ('04-21', 'Tiradentes'), ('05-01', 'Dia do Trabalho'),
         ('09-07', 'Independência do Brasil'), ('09-20', 'Revolução Farroupilha'), ('10-12', 'Nossa Senhora Aparecida'),
         ('11-02', 'Finados'), ('11-15', 'Proclamação da República'), ('11-20', 'Dia da Consciência Negra'),
         ('12-25', 'Natal'))
_POR_ANO = {}


def feriados_do_ano(ano):
    """{data: nome}: os nacionais (o 20/11 a partir de 2024), o 20/09 do RS, o Carnaval (segunda e terça), a
    Sexta-feira Santa e o Corpus Christi. Municipal não entra."""
    if ano not in _POR_ANO:
        m = {datetime.date(ano, int(d[:2]), int(d[3:])): n for d, n in FIXOS if d != '11-20' or ano >= 2024}
        p = pascoa(ano)
        m[p - 48 * UM_DIA] = 'Carnaval'
        m[p - 47 * UM_DIA] = 'Carnaval'
        m[p - 2 * UM_DIA] = 'Sexta-feira Santa'
        m[p + 60 * UM_DIA] = 'Corpus Christi'
        _POR_ANO[ano] = m
    return _POR_ANO[ano]


def feriado(d):
    return feriados_do_ano(d.year).get(d)


def util(d):
    """Dia útil do PGDAS: segunda a sexta, sem feriado."""
    return dia_util(d) and not feriado(d)


def util_ou_proximo(d):
    while not util(d):
        d += UM_DIA
    return d


def proximo_util(d):
    """O primeiro dia útil DEPOIS de d."""
    return util_ou_proximo(d + UM_DIA)


def ultimo_util(ano, mes):
    d = datetime.date(ano, mes, calendar.monthrange(ano, mes)[1])
    while not util(d):
        d -= UM_DIA
    return d


def _seguinte(competencia):
    ano, mes = int(competencia[:4]), int(competencia[5:7])
    return (ano + 1, 1) if mes == 12 else (ano, mes + 1)


def prazo_pgdas(competencia):
    """O prazo da declaração de 'AAAA-MM': o dia 20 do mês seguinte ou, sem expediente, o primeiro dia útil depois."""
    ano, mes = _seguinte(competencia)
    return util_ou_proximo(datetime.date(ano, mes, PRAZO_PGDAS))


def consulta_pgdas(competencia):
    """O dia em que a ponte consulta o PGDAS daquela competência: o primeiro dia útil depois do prazo."""
    return proximo_util(prazo_pgdas(competencia))


def ultima_competencia_consultada(hoje):
    """A competência mais recente cujo dia de consulta já chegou (consulta_pgdas ≤ hoje). Não é a do prazo vencido: no
    dia útil entre o prazo e a consulta (ex.: Tiradentes, quando o prazo de março cai na terça 20/04), a competência
    ainda não foi consultada e não pode contar como "mês sem declaração"."""
    c = mes_anterior(hoje)
    while consulta_pgdas(c) > hoje:
        c = mes_anterior(datetime.date(int(c[:4]), int(c[5:7]), 1))
    return c


def _competencias(de, ate):
    saida, c = [], de
    while c <= ate:
        saida.append(c)
        ano, mes = _seguinte(c)
        c = f'{ano:04d}-{mes:02d}'
    return saida


def falta_declaracao(hoje, declarados):
    """Algum mês já vencido, dos anos que o pgdas consulta, sem declaração? Conta a partir do primeiro mês declarado
    nesses anos (a empresa que abriu no meio do ano não fica "devendo" os meses de antes); sem nenhum declarado, sim."""
    anos = anos_do_pgdas(hoje)
    ate = ultima_competencia_consultada(hoje)
    nos_anos = sorted(c for c in declarados if int(c[:4]) in anos)
    if not nos_anos:
        return True
    return any(c not in declarados for c in _competencias(nos_anos[0], ate))


# ---------------------------------------------------------------- os dias marcados ("a partir do dia")

def _mes_antes(ano, mes):
    return (ano - 1, 12) if mes == 1 else (ano, mes - 1)


def segunda_da_semana(d):
    return d - d.weekday() * UM_DIA


def _ultima(marcas, hoje):
    passadas = [m for m in marcas if m is not None and m <= hoje]
    return max(passadas) if passadas else None


def marca_autorizacao(hoje, sem_autorizacao):
    """O último dia marcado da autorização até hoje: o primeiro dia útil do mês (o deste ou, antes dele, o do mês
    passado) e, pra quem estava sem a autorização, a segunda-feira da semana."""
    ano, mes = _mes_antes(hoje.year, hoje.month)
    marcas = [primeiro_dia_util(hoje.year, hoje.month), primeiro_dia_util(ano, mes)]
    if sem_autorizacao:
        marcas.append(segunda_da_semana(hoje))
    return _ultima(marcas, hoje)


def marca_pgdas(hoje, declarados):
    """O último dia marcado do pgdas até hoje: o primeiro dia útil depois do prazo (o deste mês ou o do mês passado) e,
    pra quem ainda tem mês sem declaração, o último dia útil do mês (o deste ou o do mês passado)."""
    ano, mes = _mes_antes(hoje.year, hoje.month)
    marcas = [consulta_pgdas(mes_anterior(hoje)), consulta_pgdas(mes_anterior(datetime.date(ano, mes, 1)))]
    if falta_declaracao(hoje, declarados):
        marcas += [ultimo_util(hoje.year, hoje.month), ultimo_util(ano, mes)]
    return _ultima(marcas, hoje)


def marca_situacao(hoje):
    """O último dia marcado da situação fiscal até hoje: o dia 5 (ou o próximo dia útil) deste mês ou do passado."""
    ano, mes = _mes_antes(hoje.year, hoje.month)
    return _ultima([dia_ou_proximo_util(hoje.year, hoje.month, 5), dia_ou_proximo_util(ano, mes, 5)], hoje)


def pendente(consultada_em, marca):
    """A consulta ainda não foi feita desde o dia marcado (nunca feita = pendente)."""
    return marca is not None and (not consultada_em or str(consultada_em) < marca.isoformat())


def servicos_do_dia(hoje, empresa, estado):
    """O que roda hoje pra esta empresa (fora o faturamento, que depende do pgdas): cada consulta cujo último dia
    marcado já chegou e que ainda não foi feita desde ele."""
    if not dia_util(hoje):
        return set()
    doc, simples = empresa['documento'], empresa.get('regime') == 'simples'
    s = {'caixa_postal'}
    if pendente(estado.consultada_em('autorizacao', doc), marca_autorizacao(hoje, estado.sem_autorizacao(doc, hoje))):
        s.add('autorizacao')
    if simples and pendente(estado.consultada_em('pgdas', doc), marca_pgdas(hoje, estado.meses_declarados(doc))):
        s.add('pgdas')
    if pendente(estado.consultada_em('situacao_fiscal', doc), marca_situacao(hoje)):
        s.add('situacao_fiscal')
    return s


def anos_do_pgdas(hoje):
    """Os anos-calendário que o pgdas consulta: o atual e o da competência mais recente cuja consulta já chegou — em
    janeiro e em fevereiro antes da consulta de janeiro, o anterior também (a consulta de dezembro perdida em janeiro,
    recuperada no começo de fevereiro, ainda vê dezembro)."""
    return sorted({hoje.year, int(ultima_competencia_consultada(hoje)[:4])})
