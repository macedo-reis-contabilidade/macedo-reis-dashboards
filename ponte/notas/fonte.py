"""As notas da Domínio de verdade: as três consultas de ponte/consultas/, pela mesma conexão ODBC da ponte.

    notas_empresa.sql   ? = o código da empresa                    -> documento (o cgce_emp da geempre)
    notas_itens.sql     ? = o código, o primeiro e o último dia    -> uma linha por item (a nota sem itens, numa linha
                                                                      com as colunas do item em branco)
    notas_xml.sql       ? = o código, o primeiro e o último dia    -> chave, conteudo (o XML guardado)

A Domínio de mentira (falso.py) cumpre o mesmo contrato. Consulta que ainda tem "-- A CONFERIR" não roda.
"""
import pathlib

from ..fonte_dominio import MARCA, PASTA_CONSULTAS, a_conferir, abrir_odbc


class ConsultaFaltando(Exception):
    """A consulta não está na pasta, ou ainda está a conferir."""


class FonteNotasDominio:
    def __init__(self, conexao, pasta_consultas=None, conectar=None):
        self._conexao = conexao
        self._pasta = pathlib.Path(pasta_consultas) if pasta_consultas else PASTA_CONSULTAS
        self._conectar = conectar or abrir_odbc
        self._con = None

    def _sql(self, nome):
        arq = self._pasta / f'{nome}.sql'
        if not arq.is_file():
            raise ConsultaFaltando(nome)
        texto = arq.read_text(encoding='utf-8-sig')
        if a_conferir(texto) or not texto.strip():
            raise ConsultaFaltando(f'{nome} ({MARCA.strip("- ").lower()})')
        return texto

    def _consultar(self, nome, parametros):
        sql = self._sql(nome)
        if self._con is None:
            self._con = self._conectar(self._conexao)
        cur = self._con.cursor()
        try:
            cur.execute(sql, list(parametros))
            nomes = [str(d[0]).lower() for d in (cur.description or ())]
            return [dict(zip(nomes, linha)) for linha in cur.fetchall()]
        finally:
            try:
                cur.close()
            except Exception:
                pass

    def documento(self, codigo):
        linhas = self._consultar('notas_empresa', (codigo,))
        return linhas[0].get('documento') if linhas else None

    def linhas(self, codigo, ini, fim):
        return self._consultar('notas_itens', (codigo, ini, fim))

    def xmls(self, codigo, ini, fim):
        """{chave: o conteúdo como veio (bytes)}."""
        saida = {}
        for l in self._consultar('notas_xml', (codigo, ini, fim)):
            chave = str(l.get('chave') or '').strip().upper()
            if chave and l.get('conteudo') is not None:
                saida[chave] = bytes(l['conteudo'])
        return saida

    def fechar(self):
        if self._con is not None:
            try:
                self._con.close()
            finally:
                self._con = None
