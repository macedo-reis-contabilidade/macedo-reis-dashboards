"""Onde a ponte guarda o que é de verdade (fora do repositório) e a leitura do config.ini.

A pasta é C:\\ponte-dominio\\ (ou a da variável PONTE_PASTA — os testes usam uma temporária):
    config.ini   a conexão do Domínio, o endereço do sistema e as chaves — legível só pelo usuário
    logs\\        um arquivo por dia; os de mais de 60 dias são apagados
    pendentes\\   os pacotes que não foram, pra mandar na próxima rodada

Nada daqui mostra valor de campo: quem pergunta recebe "preenchido", "falta", "ainda é o do exemplo" ou
"inválido (o porquê)" — a url tem que ser https:// (http só pra endereço local, nos testes).
"""
import configparser
import os
import pathlib
import re
import urllib.parse

CAMPOS = (
    ('dominio', 'conexao'),
    ('sistema', 'url'),
    ('sistema', 'chave_publica'),
    ('sistema', 'chave_ponte'),
)
CAMPOS_DOMINIO = (('dominio', 'conexao'),)
CAMPOS_SISTEMA = (('sistema', 'url'), ('sistema', 'chave_publica'), ('sistema', 'chave_ponte'))
MESES_PADRAO = 3
MESES_MAX = 24
EXEMPLO = pathlib.Path(__file__).with_name('config.exemplo.ini')


def pasta():
    """A pasta de trabalho de verdade: PONTE_PASTA, ou C:\\ponte-dominio (no Linux, ~/ponte-dominio)."""
    p = os.environ.get('PONTE_PASTA')
    if p:
        return pathlib.Path(p)
    if os.name == 'nt':
        return pathlib.Path(r'C:\ponte-dominio')
    return pathlib.Path.home() / 'ponte-dominio'


def _ler(arquivo):
    cp = configparser.ConfigParser(interpolation=None)   # a string de conexão pode ter "%"
    # utf-8-sig: o Bloco de Notas às vezes grava com BOM
    cp.read_string(arquivo.read_text(encoding='utf-8-sig'))
    return cp


class Config:
    def __init__(self, arquivo):
        self.arquivo = arquivo
        self.existe = arquivo.is_file()
        self.erro_leitura = None
        self._cp = configparser.ConfigParser(interpolation=None)
        self._exemplo = configparser.ConfigParser(interpolation=None)
        if self.existe:
            try:
                self._cp = _ler(arquivo)
            except (configparser.Error, UnicodeDecodeError) as e:
                # a mensagem do configparser pode citar a linha (e a linha pode ter a senha): só o tipo do erro
                self.erro_leitura = type(e).__name__
        if EXEMPLO.is_file():
            try:
                self._exemplo = _ler(EXEMPLO)
            except (configparser.Error, UnicodeDecodeError):
                pass

    def valor(self, secao, campo):
        return (self._cp.get(secao, campo, fallback='') or '').strip()

    def situacao(self, secao, campo):
        """'preenchido', 'falta', 'ainda é o do exemplo' ou 'inválido (…)' — nunca o valor."""
        v = self.valor(secao, campo)
        if not v:
            return 'falta'
        if any(ord(c) < 32 for c in v):
            # a chave colada em duas linhas: o configparser junta as duas, e o envio cairia mostrando o valor
            return 'inválido (tem quebra de linha — o valor tem que estar numa linha só)'
        ex = (self._exemplo.get(secao, campo, fallback='') or '').strip()
        if ex and v == ex:
            return 'ainda é o do exemplo'
        if secao == 'sistema' and campo == 'url':
            problema = problema_da_url(v)
            if problema:
                return f'inválido ({problema})'
        if secao == 'sistema' and campo.startswith('chave') and not v.isascii():
            return 'inválido (tem acento ou caractere fora do padrão)'
        return 'preenchido'

    def falta(self, campos=CAMPOS):
        """Os campos que não dá pra usar, como 'secao.campo (situação)'."""
        return [f'{s}.{c} ({self.situacao(s, c)})' for s, c in campos if self.situacao(s, c) != 'preenchido']

    def meses(self):
        """(meses, problema): o [rodada] meses, ou o padrão; problema é None quando está tudo certo."""
        bruto = self.valor('rodada', 'meses')
        if not bruto:
            return MESES_PADRAO, None
        try:
            n = int(bruto)
        except ValueError:
            return MESES_PADRAO, f'[rodada] meses não é um número inteiro; usei {MESES_PADRAO}'
        if not 1 <= n <= MESES_MAX:
            return MESES_PADRAO, f'[rodada] meses tem que ser de 1 a {MESES_MAX}; usei {MESES_PADRAO}'
        return n, None

    def segredos(self):
        """O que nunca pode aparecer na tela, no log nem no pacote."""
        conexao = self.valor('dominio', 'conexao')
        lista = [conexao, self.valor('sistema', 'chave_ponte'), self.valor('sistema', 'chave_publica')]
        for m in re.finditer(r'(?i)\b(?:pwd|password)\s*=\s*([^;]*)', conexao):
            lista.append(m.group(1).strip().strip('{}'))
        return [s for s in lista if s]


def endereco_local(url):
    try:
        host = (urllib.parse.urlsplit(url).hostname or '').lower()
    except ValueError:
        return False
    return host in ('localhost', '127.0.0.1', '::1')


def problema_da_url(url):
    """None quando dá pra mandar; senão, o problema (sem repetir o endereço)."""
    if not url.isascii() or any(c.isspace() for c in url):
        return 'tem acento ou espaço'
    try:
        partes = urllib.parse.urlsplit(url)
        partes.port                       # porta que não é número levanta aqui
    except ValueError:
        return 'não é um endereço'
    if partes.scheme not in ('http', 'https') or not partes.hostname:
        return 'tem que começar com https://'
    if partes.scheme != 'https' and not endereco_local(url):
        return 'tem que ser https:// — a chave da ponte não pode ir sem criptografia'
    return None


def carregar():
    return Config(pasta() / 'config.ini')
