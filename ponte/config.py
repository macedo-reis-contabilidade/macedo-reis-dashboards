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
# a ponte da Receita (Integra Contador do Serpro) — 23/10/2026
CAMPOS_INTEGRA = (('integra', 'ambiente'), ('integra', 'consumer_key'), ('integra', 'consumer_secret'),
                  ('integra', 'certificado'), ('integra', 'senha_certificado'), ('integra', 'cnpj_escritorio'))
SEGREDOS_INTEGRA = ('consumer_key', 'consumer_secret', 'certificado', 'senha_certificado')
# o ambiente e o teto do exemplo são valores de verdade: igual ao exemplo não é "ainda é o do exemplo"
VALEM_COMO_NO_EXEMPLO = (('integra', 'ambiente'), ('integra', 'teto_mes'))
TETO_PADRAO = 1500
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
        if ex and v == ex and (secao, campo) not in VALEM_COMO_NO_EXEMPLO:
            return 'ainda é o do exemplo'
        if secao == 'sistema' and campo == 'url':
            problema = problema_da_url(v)
            if problema:
                return f'inválido ({problema})'
        if secao == 'sistema' and campo.startswith('chave') and not v.isascii():
            return 'inválido (tem acento ou caractere fora do padrão)'
        if secao == 'integra':
            problema = problema_da_integra(campo, v)
            if problema:
                return f'inválido ({problema})'
        return 'preenchido'

    def ambiente_integra(self):
        """'demonstracao' ou 'producao' — o que estiver no config.ini (em branco = demonstração)."""
        return self.valor('integra', 'ambiente').lower() or 'demonstracao'

    def campos_integra(self, ambiente):
        """O que a [integra] precisa ter: em demonstração, só o CNPJ do escritório; em produção, tudo."""
        if ambiente == 'demonstracao':
            return (('integra', 'cnpj_escritorio'),)
        return CAMPOS_INTEGRA

    def teto(self):
        """(teto de chamadas no mês, problema)."""
        bruto = self.valor('integra', 'teto_mes')
        if not bruto:
            return TETO_PADRAO, None
        try:
            n = int(bruto)
        except ValueError:
            return TETO_PADRAO, f'[integra] teto_mes não é um número inteiro; usei {TETO_PADRAO}'
        if n < 1:
            return TETO_PADRAO, f'[integra] teto_mes tem que ser maior que zero; usei {TETO_PADRAO}'
        return n, None

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
        lista += [self.valor('integra', c) for c in SEGREDOS_INTEGRA]
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


def documento_valido(doc):
    """CNPJ de 14 posições (as 12 primeiras podem ter letra — o CNPJ alfanumérico de julho/2026) com os dois
    dígitos verificadores certos, ou CPF de 11 dígitos com os dele."""
    doc = (doc or '').upper()
    if re.fullmatch(r'[0-9A-Z]{12}[0-9]{2}', doc):
        valores = [ord(c) - 48 for c in doc]
        for n in (12, 13):
            pesos = list(range(n - 7, 1, -1)) + list(range(9, 1, -1))
            resto = sum(v * p for v, p in zip(valores[:n], pesos)) % 11
            if valores[n] != (0 if resto < 2 else 11 - resto):
                return False
        return True
    if re.fullmatch(r'[0-9]{11}', doc):
        nums = [int(c) for c in doc]
        for n in (9, 10):
            resto = sum(v * p for v, p in zip(nums[:n], range(n + 1, 1, -1))) * 10 % 11
            if nums[n] != (0 if resto == 10 else resto):
                return False
        return True
    return False


def problema_da_integra(campo, v):
    if campo == 'ambiente' and v.lower() not in ('demonstracao', 'producao'):
        return 'tem que ser demonstracao ou producao'
    if campo == 'cnpj_escritorio':
        doc = re.sub(r'[./\s-]', '', v).upper()
        if not re.fullmatch(r'[0-9A-Z]{12}[0-9]{2}', doc):
            return 'tem que ter os 14 caracteres do CNPJ'
    if campo == 'certificado' and not pathlib.Path(v).is_file():
        return 'o arquivo .pfx não está nesse caminho'
    if campo in ('consumer_key', 'consumer_secret') and not v.isascii():
        return 'tem acento ou caractere fora do padrão'
    return None


def carregar():
    return Config(pasta() / 'config.ini')
