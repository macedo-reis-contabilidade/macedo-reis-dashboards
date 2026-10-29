"""O Domínio de verdade: a cópia do banco (SQL Anywhere) por ODBC, só leitura.

Cada bloco tem a sua consulta num arquivo em ponte/consultas/ — empresas.sql, folha.sql, fiscal.sql, contabil.sql.
Consulta que ainda tem a linha "-- A CONFERIR" não roda: o bloco fica de fora da rodada (vai pro `faltou` do
pacote) e o resto segue. Sem a de empresas, a rodada não manda nada.

O que cada consulta recebe e devolve (o contrato está em fonte.py):
    empresas.sql   sem parâmetro                      -> codigo, documento, nome, ativa
    folha.sql      ? = primeiro dia do mês (date),    -> codigo + os campos do bloco, UMA linha por empresa
    fiscal.sql     ? = último dia do mês (date),         (já contado: COUNT/SUM com GROUP BY da empresa)
    contabil.sql   nessa ordem
Se a consulta precisar das datas mais de uma vez, use um WITH no começo que as receba uma vez só.
Os nomes das colunas do resultado têm que ser os do contrato (use AS); maiúscula ou minúscula tanto faz.

O pyodbc só é importado na hora de abrir a conexão — sem ele (nos testes, no Linux), tudo o mais funciona, e uma
rodada em que todas as consultas ainda estão "A CONFERIR" nem tenta conectar.
"""
import calendar
import datetime
import pathlib

from .fonte import Fonte, ConsultaAConferir

MARCA = '-- A CONFERIR'
PASTA_CONSULTAS = pathlib.Path(__file__).with_name('consultas')
TEMPO_CONEXAO = 15    # segundos pra abrir a conexão
TEMPO_CONSULTA = 600  # segundos por consulta: uma presa não segura a tarefa até as 2 horas do Agendador
# o que o driver responde quando não aceita pôr a conexão em só leitura (atributo que ele não conhece)
SO_LEITURA_RECUSADA = ('HYC00', 'HY092', 'HY024')


def a_conferir(texto):
    return any(linha.strip().upper().startswith(MARCA) for linha in texto.splitlines())


def limites_do_mes(mes):
    ano, m = (int(x) for x in mes.split('-'))
    return datetime.date(ano, m, 1), datetime.date(ano, m, calendar.monthrange(ano, m)[1])


def abrir_odbc(conexao):
    import pyodbc   # aqui dentro de propósito: os testes rodam sem o pyodbc
    try:
        con = pyodbc.connect(conexao, autocommit=True, readonly=True, timeout=TEMPO_CONEXAO)
    except pyodbc.Error as e:
        if not (e.args and str(e.args[0]) in SO_LEITURA_RECUSADA):
            raise
        # o driver não aceita o modo só leitura na conexão: o usuário externo do Domínio já é só de leitura
        con = pyodbc.connect(conexao, autocommit=True, timeout=TEMPO_CONEXAO)
    # o texto (o nome da empresa, a descrição da tabela) vem do driver já em UTF-16, com os acentos certos, qualquer
    # que seja a página de código do banco e a do Windows (29/10/2026: o risco do acento, da fila de 22/10)
    con.setdecoding(pyodbc.SQL_CHAR, encoding='utf-16le', ctype=pyodbc.SQL_WCHAR)
    con.timeout = TEMPO_CONSULTA
    try:
        con.cursor().close()     # o pyodbc aplica o tempo-limite ao criar o cursor: é aqui que um driver recusaria
    except pyodbc.Error:
        con.timeout = 0          # sem tempo-limite por consulta: fica o do Agendador
    return con


class FonteDominio(Fonte):
    def __init__(self, conexao, pasta_consultas=None, conectar=None):
        self._conexao = conexao
        self._pasta = pathlib.Path(pasta_consultas) if pasta_consultas else PASTA_CONSULTAS
        self._conectar = conectar or abrir_odbc   # os testes passam uma conexão de mentira
        self._con = None

    def _sql(self, bloco):
        arq = self._pasta / f'{bloco}.sql'
        if not arq.is_file():
            raise ConsultaAConferir(bloco)
        texto = arq.read_text(encoding='utf-8-sig')
        if a_conferir(texto) or not texto.strip():
            raise ConsultaAConferir(bloco)
        return texto

    def _abrir(self):
        if self._con is None:
            self._con = self._conectar(self._conexao)
        return self._con

    def _consultar(self, bloco, parametros=()):
        sql = self._sql(bloco)              # antes de conectar: consulta a conferir nem abre a conexão
        cur = self._abrir().cursor()
        try:
            if parametros:
                cur.execute(sql, list(parametros))
            else:
                cur.execute(sql)
            nomes = [str(d[0]).lower() for d in (cur.description or ())]
            return [dict(zip(nomes, linha)) for linha in cur.fetchall()]
        finally:
            try:
                cur.close()
            except Exception:
                pass

    def empresas(self):
        return self._consultar('empresas')

    def folha(self, mes):
        return self._consultar('folha', limites_do_mes(mes))

    def fiscal(self, mes):
        return self._consultar('fiscal', limites_do_mes(mes))

    def contabil(self, mes):
        return self._consultar('contabil', limites_do_mes(mes))

    def fechar(self):
        if self._con is not None:
            try:
                self._con.close()
            finally:
                self._con = None
