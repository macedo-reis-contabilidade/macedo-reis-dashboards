"""Entrar e chamar o Serpro (Integra Contador).

Token (produção): POST https://autenticacao.sapi.serpro.gov.br/authenticate, com Basic(consumer_key:consumer_secret),
role-type: TERCEIROS e grant_type=client_credentials, e o certificado do escritório na conexão (TLS mútuo). Volta
access_token, jwt_token e expires_in; renova a 80% do tempo e uma vez a cada 401 — 401 de novo é configuração (sai 2).

O certificado: o cryptography abre o .pfx; o certificado e a chave vão pra arquivos temporários na pasta da ponte, a chave
CIFRADA com uma senha aleatória; o ssl carrega e os dois arquivos são apagados na hora (também se der erro). A chave
nunca vai aberta pro disco.

Chamar: POST <gateway>/<Consultar|Emitir|Apoiar|Monitorar> com Bearer e jwt_token. A resposta traz status, mensagens
([{codigo, texto}]) e dados (JSON em texto). Acesso negado (403 ou mensagem AcessoNegado) = o cliente não autorizou o
escritório; 429, 5xx, tempo esgotado ou rede fora = tenta de novo 3 vezes (10 s, 60 s e 5 min — PONTE_ESPERAS); outra
recusa = erro, com a mensagem. Redirecionamento não é seguido. Uma chamada por vez, com 1 s entre elas
(PONTE_RECEITA_INTERVALO). O teto do mês é contado em estado.Contador.

O gateway do Serpro não manda o certificado intermediário dele (AC SERPRO AR46 OV TLS CA 2025, da GlobalSign): o
Windows o acha sozinho, o Python não. Ele vai junto, em ac-serpro-2025.pem (público; emitido pela GlobalSign Root R46,
que o Windows já tem). Se o Serpro trocar de intermediário, o conferir avisa e o LEIA-ME diz como trocar o arquivo.

Pros testes, PONTE_SERPRO_TOKEN_URL e PONTE_SERPRO_GATEWAY trocam os endereços — só pra endereço local.
"""
import base64
import http.client
import json
import os
import pathlib
import re
import secrets
import ssl
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

from .. import config
from . import demonstracao

URL_TOKEN = 'https://autenticacao.sapi.serpro.gov.br/authenticate'
GATEWAY_PRODUCAO = 'https://gateway.apiserpro.serpro.gov.br/integra-contador/v1/'
CADEIA = pathlib.Path(__file__).with_name('ac-serpro-2025.pem')
ESPERAS = (10, 60, 300)
TIMEOUT = 60


class ErroConfig(Exception):
    """A chave, o certificado ou o endereço não deixam continuar — repetir não adianta (sai com 2)."""


class SerproFora(Exception):
    """O Serpro não respondeu depois das novas tentativas."""


class Resposta:
    def __init__(self, http_status, corpo, cabecalhos):
        self.http_status = http_status
        self.cabecalhos = cabecalhos or {}
        self.corpo = corpo if isinstance(corpo, dict) else {}
        try:
            self.status = int(self.corpo.get('status', http_status))
        except (TypeError, ValueError):
            self.status = http_status
        self.mensagens = [m for m in (self.corpo.get('mensagens') or []) if isinstance(m, dict)]
        self.dados_texto = self.corpo.get('dados')

    def dados(self):
        """O 'dados' lido como JSON (None se vazio ou ilegível)."""
        d = self.dados_texto
        if d is None or d == '':
            return None
        if not isinstance(d, str):
            return d
        try:
            return json.loads(d)
        except json.JSONDecodeError:
            return None

    def codigos(self):
        return ' '.join(str(m.get('codigo', '')) for m in self.mensagens)

    def resumo(self):
        """As mensagens do Serpro em uma linha (código e texto, sem dado de cliente além do que o Serpro escreve)."""
        partes = [f"{m.get('codigo', '')} {m.get('texto', '')}".strip() for m in self.mensagens]
        return re.sub(r'\s+', ' ', '; '.join(p for p in partes if p))[:300]

    def _tipos(self):
        """O tipo de cada mensagem: '[Erro-PGDASD-...]' → 'erro', 'Sucesso-PROCURACOES' → 'sucesso', 'ERRO' → 'erro'."""
        return [re.sub(r'^\[', '', str(m.get('codigo', ''))).split('-')[0].split(']')[0].lower() for m in self.mensagens]

    def acesso_negado(self):
        return self.status == 403 or self.http_status == 403 or 'acessonegado' in self._tipos()

    def ok(self):
        ruins = {'erro', 'entradaincorreta', 'entrataincorreta', 'acessonegado'}
        return 200 <= self.status < 300 and not any(t in ruins for t in self._tipos())


class _SemRedirecionar(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


def contexto_tls():
    ctx = ssl.create_default_context()
    if CADEIA.is_file():
        ctx.load_verify_locations(cafile=str(CADEIA))
    return ctx


def _abrir(pfx_caminho, senha):
    try:
        from cryptography.hazmat.primitives.serialization import pkcs12
    except ImportError:
        raise ErroConfig('falta o cryptography — instale com: py -3 -m pip install cryptography pypdf')
    try:
        dados = pathlib.Path(pfx_caminho).read_bytes()
    except OSError as e:
        raise ErroConfig(f'não consegui abrir o certificado ({type(e).__name__})')
    try:
        return pkcs12.load_key_and_certificates(dados, senha.encode('utf-8') if senha else None)
    except (ValueError, TypeError):
        raise ErroConfig('o certificado não abriu: a senha está errada ou o arquivo não é um .pfx')


def ler_certificado(pfx_caminho, senha):
    """(titular, válido até) do certificado do escritório — pro conferir."""
    from cryptography.x509.oid import NameOID
    _, cert, _ = _abrir(pfx_caminho, senha)
    if cert is None:
        raise ErroConfig('o .pfx não tem certificado dentro')
    nomes = cert.subject.get_attributes_for_oid(NameOID.COMMON_NAME)
    titular = nomes[0].value if nomes else cert.subject.rfc4514_string()
    return titular, cert.not_valid_after_utc


def contexto_com_certificado(pfx_caminho, senha, pasta_tmp):
    """O SSLContext com o certificado do escritório (TLS mútuo) — os arquivos temporários somem na hora."""
    from cryptography.hazmat.primitives import serialization
    chave, cert, extras = _abrir(pfx_caminho, senha)
    if chave is None or cert is None:
        raise ErroConfig('o .pfx não tem a chave e o certificado juntos')
    senha_tmp = secrets.token_urlsafe(32)
    pem_cert = cert.public_bytes(serialization.Encoding.PEM) + b''.join(
        c.public_bytes(serialization.Encoding.PEM) for c in (extras or []))
    pem_chave = chave.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                    serialization.BestAvailableEncryption(senha_tmp.encode()))
    pasta_tmp = pathlib.Path(pasta_tmp)
    pasta_tmp.mkdir(parents=True, exist_ok=True)
    caminhos = []
    ctx = contexto_tls()
    try:
        for prefixo, conteudo in (('cert-', pem_cert), ('chave-', pem_chave)):
            fd, cam = tempfile.mkstemp(prefix=prefixo, suffix='.pem', dir=str(pasta_tmp))
            caminhos.append(cam)
            with os.fdopen(fd, 'wb') as f:
                f.write(conteudo)
        ctx.load_cert_chain(caminhos[0], caminhos[1], password=senha_tmp)
    except ssl.SSLError as e:
        raise ErroConfig(f'o ssl não aceitou o certificado ({type(e).__name__})')
    finally:
        for cam in caminhos:
            try:
                os.remove(cam)
            except FileNotFoundError:
                pass
    return ctx


def _certificado_nao_confere(e):
    """O certificado do Serpro que o Python não reconhece não é o Serpro fora: é configuração (o intermediário mudou) —
    tentar de novo não adianta e a rodada sai com 2, com o recado de como trocar o ac-serpro-2025.pem."""
    razao = getattr(e, 'reason', e)
    if isinstance(razao, ssl.SSLCertVerificationError):
        porque = razao.verify_message or 'a cadeia não confere'
        raise ErroConfig(f'o Python não reconheceu o certificado do Serpro ({porque}) — o intermediário dele pode ter '
                         f'mudado: o LEIA-ME diz como trocar o ac-serpro-2025.pem')


def _esperas():
    bruto = os.environ.get('PONTE_ESPERAS')
    if not bruto:
        return ESPERAS
    try:
        return tuple(float(x) for x in bruto.split(','))
    except ValueError:
        return ESPERAS


def _float_env(nome, padrao):
    try:
        return float(os.environ.get(nome) or padrao)
    except ValueError:
        return padrao


def _url_de_teste(nome):
    """PONTE_SERPRO_TOKEN_URL / PONTE_SERPRO_GATEWAY — aceitos só pra endereço local (os testes)."""
    url = os.environ.get(nome)
    return url if url and config.endereco_local(url) else None


def gateway_de(ambiente):
    """O endereço do gateway: o da demonstração ou o de produção (nos testes, PONTE_SERPRO_GATEWAY — só local)."""
    url = _url_de_teste('PONTE_SERPRO_GATEWAY') or (demonstracao.GATEWAY if ambiente == 'demonstracao' else GATEWAY_PRODUCAO)
    return url if url.endswith('/') else url + '/'


class Cliente:
    def __init__(self, ambiente, cnpj_escritorio, registro, contador, pasta_tmp, consumer_key='', consumer_secret='',
                 certificado='', senha_certificado='', url_token=None, url_gateway=None):
        self.ambiente = ambiente                       # 'producao', 'demonstracao' ou 'falso'
        self.cnpj = re.sub(r'[./\s-]', '', cnpj_escritorio or '').upper()
        self.registro = registro
        self.contador = contador
        self.pasta_tmp = pasta_tmp
        self._key, self._secret = consumer_key, consumer_secret
        self._pfx, self._senha = certificado, senha_certificado
        self.url_token = url_token or _url_de_teste('PONTE_SERPRO_TOKEN_URL') or URL_TOKEN
        self.gateway = url_gateway or gateway_de(ambiente)
        self._ctx_cert = None
        self._token = None
        self._renovar_em = 0.0
        self._ultima = 0.0
        self.fora = False                              # o Serpro parou de responder nesta rodada
        self._abridor_gateway = self._abridor(self.gateway, None)

    # ---------- conexão
    def _abridor(self, url, ctx):
        handlers = [_SemRedirecionar()]
        if url.startswith('https://'):
            handlers.append(urllib.request.HTTPSHandler(context=ctx or contexto_tls()))
        return urllib.request.build_opener(*handlers)

    def _segredo(self, valor):
        if valor and valor not in self.registro.segredos:
            self.registro.segredos.append(valor)

    # ---------- token
    def token(self, forcar=False):
        if self.ambiente == 'demonstracao':
            return demonstracao.TOKEN, demonstracao.TOKEN
        if self._token and not forcar and time.monotonic() < self._renovar_em:
            return self._token
        basic = base64.b64encode(f'{self._key}:{self._secret}'.encode('utf-8')).decode('ascii')
        self._segredo(basic)
        if self.url_token.startswith('https://') and self._ctx_cert is None:
            self._ctx_cert = contexto_com_certificado(self._pfx, self._senha, self.pasta_tmp)
        abridor = self._abridor(self.url_token, self._ctx_cert)
        corpo = urllib.parse.urlencode({'grant_type': 'client_credentials'}).encode()
        cab = {'Authorization': f'Basic {basic}', 'role-type': 'TERCEIROS',
               'content-type': 'application/x-www-form-urlencoded'}
        esperas = _esperas()
        for tentativa in range(len(esperas) + 1):
            try:
                req = urllib.request.Request(self.url_token, data=corpo, method='POST', headers=cab)
                with abridor.open(req, timeout=_float_env('PONTE_TIMEOUT', TIMEOUT)) as r:
                    resposta = json.loads(r.read().decode('utf-8'))
                break
            except urllib.error.HTTPError as e:
                if e.code in (429,) or e.code >= 500:
                    motivo = f'HTTP {e.code}'
                else:
                    raise ErroConfig(f'o Serpro recusou a entrada (HTTP {e.code}) — confira a consumer_key, a '
                                     f'consumer_secret e o certificado do escritório')
            except (ValueError, json.JSONDecodeError) as e:
                raise ErroConfig(f'a resposta do token não veio no formato esperado ({type(e).__name__})')
            except (urllib.error.URLError, http.client.HTTPException, OSError) as e:
                _certificado_nao_confere(e)
                motivo = type(getattr(e, 'reason', e)).__name__
            if tentativa < len(esperas):
                self.registro(f'receita: o token não veio ({motivo}) — tento de novo em {esperas[tentativa]:g} s', 'aviso')
                time.sleep(esperas[tentativa])
            else:
                self.fora = True
                raise SerproFora(f'a entrada no Serpro não respondeu ({motivo})')
        access, jwt = resposta.get('access_token'), resposta.get('jwt_token')
        if not access or not jwt:
            raise ErroConfig('o Serpro não devolveu o token')
        self._segredo(access)
        self._segredo(jwt)
        try:
            validade = float(resposta.get('expires_in') or 3000)
        except (TypeError, ValueError):
            validade = 3000.0
        self._token = (access, jwt)
        self._renovar_em = time.monotonic() + 0.8 * validade
        return self._token

    # ---------- chamar
    def _devagar(self):
        intervalo = _float_env('PONTE_RECEITA_INTERVALO', 1.0)
        falta = self._ultima + intervalo - time.monotonic()
        if falta > 0:
            time.sleep(falta)
        self._ultima = time.monotonic()

    def corpo(self, sistema, servico, contribuinte, dados, versao='1.0', tipo=None):
        """tipo do contribuinte: 1 CPF, 2 CNPJ (pelo tamanho, se não vier); 4 = lista de CNPJs (o lote de eventos)."""
        if self.ambiente == 'demonstracao':
            c = demonstracao.corpo(servico)
            if c is None:
                raise ErroConfig(f'o ambiente de demonstração não tem cenário pro serviço {servico}')
            return c
        contrib = re.sub(r'[./\s-]', '', contribuinte or '')
        return {'contratante': {'numero': self.cnpj, 'tipo': 2},
                'autorPedidoDados': {'numero': self.cnpj, 'tipo': 2},
                'contribuinte': {'numero': contrib, 'tipo': tipo or (1 if len(contrib) == 11 else 2)},
                'pedidoDados': {'idSistema': sistema, 'idServico': servico, 'versaoSistema': versao,
                                'dados': dados if isinstance(dados, str) else json.dumps(dados, ensure_ascii=False)}}

    def chamar(self, endpoint, sistema, servico, contribuinte, dados, versao='1.0', tipo=None):
        """Uma consulta ao Serpro, com as novas tentativas. Devolve Resposta; levanta SerproFora ou ErroConfig."""
        if self.fora:
            raise SerproFora('o Serpro já não respondia nesta rodada')
        corpo = self.corpo(sistema, servico, contribuinte, dados, versao, tipo)
        bruto = json.dumps(corpo, ensure_ascii=False).encode('utf-8')
        esperas = _esperas()
        renovado = False
        tentativa = 0
        while True:
            self._devagar()
            access, jwt = self.token()
            cab = {'Authorization': f'Bearer {access}', 'jwt_token': jwt, 'Content-Type': 'application/json'}
            motivo = None
            try:
                req = urllib.request.Request(self.gateway + endpoint, data=bruto, method='POST', headers=cab)
                with self._abridor_gateway.open(req, timeout=_float_env('PONTE_TIMEOUT', TIMEOUT)) as r:
                    status, texto, cabecalhos = r.status, r.read(), dict(r.headers)
            except urllib.error.HTTPError as e:
                status, cabecalhos = e.code, dict(e.headers or {})
                try:
                    texto = e.read()
                except Exception:
                    texto = b''
            except ValueError as e:
                raise ErroConfig(f'o pedido ao Serpro não pôde ser montado ({type(e).__name__})')
            except (urllib.error.URLError, http.client.HTTPException, OSError) as e:
                _certificado_nao_confere(e)
                status, texto, cabecalhos = None, b'', {}
                motivo = type(getattr(e, 'reason', e)).__name__
            if status is not None:
                self.contador.somar(servico)
            if status == 401:
                if renovado:
                    raise ErroConfig('o Serpro recusou o token duas vezes seguidas (HTTP 401) — confira o contrato e '
                                     'as chaves do Integra Contador')
                renovado = True
                self.token(forcar=True)
                continue
            if status is not None and 300 <= status < 400:
                raise ErroConfig(f'o Serpro redirecionou o pedido (HTTP {status}) — o endereço do gateway mudou?')
            if status is not None and status != 429 and status < 500:
                try:
                    corpo_resp = json.loads(texto.decode('utf-8')) if texto else {}
                except (UnicodeDecodeError, json.JSONDecodeError):
                    corpo_resp = {}
                return Resposta(status, corpo_resp, cabecalhos)
            motivo = motivo or f'HTTP {status}'
            if tentativa < len(esperas):
                self.registro(f'receita: {servico} sem resposta ({motivo}) — tento de novo em {esperas[tentativa]:g} s', 'aviso')
                time.sleep(esperas[tentativa])
                tentativa += 1
                continue
            self.fora = True
            raise SerproFora(f'{servico}: o Serpro não respondeu depois de {len(esperas) + 1} tentativas ({motivo})')

    def esperar(self, ms):
        """A espera que o Serpro pede (tempoEspera) — com teto em PONTE_RECEITA_ESPERA_MAX segundos."""
        try:
            seg = max(0.0, float(ms) / 1000.0)
        except (TypeError, ValueError):
            seg = 5.0
        time.sleep(min(seg, _float_env('PONTE_RECEITA_ESPERA_MAX', 120.0)))


def conferir_tls(url, timeout=15):
    """Só abre e fecha uma conexão TLS com o servidor do url (nenhum pedido é feito): None quando o certificado dele
    confere com a cadeia que a ponte usa, senão o porquê. Pro conferir."""
    import socket
    u = urllib.parse.urlsplit(url)
    if u.scheme != 'https' or not u.hostname:
        return None
    try:
        with socket.create_connection((u.hostname, u.port or 443), timeout=timeout) as s:
            with contexto_tls().wrap_socket(s, server_hostname=u.hostname):
                return None
    except ssl.SSLCertVerificationError as e:
        return (f'o Python não reconheceu o certificado do Serpro ({e.verify_message}) — o intermediário dele pode ter '
                f'mudado: o LEIA-ME diz como trocar o ac-serpro-2025.pem')
    except (OSError, ssl.SSLError) as e:
        return f'não consegui conectar ({type(e).__name__} — sem internet?)'
