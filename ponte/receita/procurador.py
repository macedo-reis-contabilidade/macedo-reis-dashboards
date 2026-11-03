"""O Autentica Procurador do Integra Contador: as consultas em nome do procurador dos clientes (o CPF do contador).

Na primeira rodada de produção (03/11/2026), 80 das 105 empresas responderam "Não possui procuração ativa" pro CNPJ do
escritório: a maioria dos clientes deu a procuração do e-CAC pro CPF do Diego. O Integra deixa o contrato do escritório
consultar em nome desse procurador com um TERMO DE AUTORIZAÇÃO (um XML) assinado com o e-CPF dele: o serviço
AUTENTICAPROCURADOR · ENVIOXMLASSINADO81 devolve um token, que vale até a meia-noite do dia seguinte (Brasília), e cada
consulta em nome dele vai com o autorPedidoDados = o CPF e o cabeçalho autenticar_procurador_token. A procuração do
cliente pro CPF se confere com o autor = o próprio procurador ("Procurador deve ser o mesmo do autor do pedido").

O termo é o modelo da documentação do Serpro, com os textos fixos, assinado no padrão XMLDSig (o da NF-e e do eSocial):
enveloped, C14N 1.0, RSA-SHA256, digest SHA-256, o certificado em KeyInfo/X509Data e o namespace declarado na própria
<Signature>. Com o A1 (o .pfx), a ponte assina sozinha a cada rodada, com a vigência de um ano (ou até o certificado
vencer, o que vier antes). Só com o cryptography — nada de lxml no PC.

O XML vai já na forma canônica (sem espaço entre as tags, os atributos em ordem, as tags vazias abertas e fechadas):
assim o que o Serpro canoniza pra conferir o DigestValue é exatamente o que foi assinado. O mesmo termo mandado de novo
no mesmo dia (o conferir e a rodada) sai igual byte a byte — a assinatura RSA do PKCS#1 v1.5 não tem sorteio —, e o
Serpro responde 304 com o token no ETag.

Nada daqui vai pro log, pro pacote ou pro repositório: o termo e o token ficam na memória da rodada.
"""
import base64
import datetime
import email.utils
import hashlib
import json
import re

SISTEMA = 'AUTENTICAPROCURADOR'
SERVICO = 'ENVIOXMLASSINADO81'

# os textos fixos do modelo do Serpro (Dados de Domínio do Autentica Procurador), letra por letra
TERMO = ('Autorizo a empresa CONTRATANTE, identificada neste termo de autorização como DESTINATÁRIO, a executar as '
         'requisições dos serviços web disponibilizados pela API INTEGRA CONTADOR, onde terei o papel de AUTOR PEDIDO DE '
         'DADOS no corpo da mensagem enviada na requisição do serviço web. Esse termo de autorização está assinado '
         'digitalmente com o certificado digital do PROCURADOR ou OUTORGADO DO CONTRIBUINTE responsável, identificado '
         'como AUTOR DO PEDIDO DE DADOS.')
AVISO_LEGAL = ('O acesso a estas informações foi autorizado pelo próprio PROCURADOR ou OUTORGADO DO CONTRIBUINTE, '
               'responsável pela informação, via assinatura digital. É dever do destinatário da autorização e consumidor '
               'deste acesso observar a adoção de base legal para o tratamento dos dados recebidos conforme artigos 7º '
               'ou 11º da LGPD (Lei n.º 13.709, de 14 de agosto de 2018), aos direitos do titular dos dados (art. 9º, 17 '
               'e 18, da LGPD) e aos princípios que norteiam todos os tratamentos de dados no Brasil (art. 6º, da LGPD).')
FINALIDADE = ('A finalidade única e exclusiva desse TERMO DE AUTORIZAÇÃO, é garantir que o CONTRATANTE apresente a API '
              'INTEGRA CONTADOR esse consentimento do PROCURADOR ou OUTORGADO DO CONTRIBUINTE assinado digitalmente, para '
              'que possa realizar as requisições dos serviços web da API INTEGRA CONTADOR em nome do AUTOR PEDIDO DE '
              'DADOS (PROCURADOR ou OUTORGADO DO CONTRIBUINTE).')

DS = 'http://www.w3.org/2000/09/xmldsig#'
C14N = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
RSA_SHA256 = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256'
SHA256 = 'http://www.w3.org/2001/04/xmlenc#sha256'
ENVELOPED = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature'
DIAS_VIGENCIA = 365
BRASILIA = datetime.timezone(datetime.timedelta(hours=-3))


class ErroTermo(Exception):
    """O termo não pôde ser montado (o certificado de outro CPF, vencido, sem a chave junto)."""


def so_digitos(texto):
    return re.sub(r'\D', '', str(texto or ''))


def _attr(valor):
    """O valor de um atributo no C14N 1.0: o &, o <, a aspa e as quebras escapados (o > fica)."""
    return (str(valor).replace('&', '&amp;').replace('<', '&lt;').replace('"', '&quot;')
            .replace('\t', '&#x9;').replace('\n', '&#xA;').replace('\r', '&#xD;'))


def _vazio(nome, atributos):
    """Um elemento sem conteúdo no C14N 1.0: os atributos em ordem alfabética, aberto e fechado (sem o />)."""
    a = ''.join(f' {k}="{_attr(v)}"' for k, v in sorted(atributos.items()))
    return f'<{nome}{a}></{nome}>'


def termo_canonico(contratante, contratante_nome, autor, autor_nome, assinatura, vigencia):
    """O termo sem a assinatura, na forma canônica — é ele que entra no DigestValue. O CNPJ do escritório fica com as
    letras (o CNPJ alfanumérico de julho/2026); o CPF, só com os números."""
    contratante, autor = re.sub(r'[^0-9A-Za-z]', '', str(contratante or '')).upper(), so_digitos(autor)
    dados = ''.join([
        _vazio('sistema', {'id': 'API Integra Contador'}),
        _vazio('termo', {'texto': TERMO}),
        _vazio('avisoLegal', {'texto': AVISO_LEGAL}),
        _vazio('finalidade', {'texto': FINALIDADE}),
        _vazio('dataAssinatura', {'data': assinatura.strftime('%Y%m%d')}),
        _vazio('vigencia', {'data': vigencia.strftime('%Y%m%d')}),
        _vazio('destinatario', {'numero': contratante, 'nome': contratante_nome, 'tipo': 'PJ',
                                'papel': 'contratante'}),
        _vazio('assinadoPor', {'numero': autor, 'nome': autor_nome, 'tipo': 'PF' if len(autor) == 11 else 'PJ',
                               'papel': 'autor pedido de dados'}),
    ])
    return f'<termoDeAutorizacao><dados>{dados}</dados></termoDeAutorizacao>'


def signed_info(digest_b64, com_namespace):
    """O <SignedInfo>: com o namespace é a forma canônica (o que se assina — no C14N 1.0 o namespace herdado da
    <Signature> aparece nele); sem, é como ele vai dentro da <Signature>."""
    ns = f' xmlns="{DS}"' if com_namespace else ''
    return (f'<SignedInfo{ns}>'
            f'<CanonicalizationMethod Algorithm="{C14N}"></CanonicalizationMethod>'
            f'<SignatureMethod Algorithm="{RSA_SHA256}"></SignatureMethod>'
            f'<Reference URI="">'
            f'<Transforms><Transform Algorithm="{ENVELOPED}"></Transform>'
            f'<Transform Algorithm="{C14N}"></Transform></Transforms>'
            f'<DigestMethod Algorithm="{SHA256}"></DigestMethod>'
            f'<DigestValue>{digest_b64}</DigestValue>'
            f'</Reference></SignedInfo>')


def assinar(canonico, chave, certificado_der):
    """O termo inteiro (com a declaração XML) com a <Signature> enveloped no fim do elemento raiz."""
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.asymmetric import padding
    digest = base64.b64encode(hashlib.sha256(canonico.encode('utf-8')).digest()).decode('ascii')
    valor = chave.sign(signed_info(digest, True).encode('utf-8'), padding.PKCS1v15(), hashes.SHA256())
    assinatura = (f'<Signature xmlns="{DS}">{signed_info(digest, False)}'
                  f'<SignatureValue>{base64.b64encode(valor).decode("ascii")}</SignatureValue>'
                  f'<KeyInfo><X509Data><X509Certificate>{base64.b64encode(certificado_der).decode("ascii")}'
                  f'</X509Certificate></X509Data></KeyInfo></Signature>')
    fim = '</termoDeAutorizacao>'
    return '<?xml version="1.0" encoding="UTF-8"?>' + canonico[:-len(fim)] + assinatura + fim


def nome_e_documento(cert):
    """Do certificado ICP-Brasil: o nome e o CPF ou CNPJ do titular — o CN é "NOME:NUMERO" (sem o número no CN, só o
    nome, e o número vazio). O CNPJ pode ter letras (o alfanumérico de julho/2026)."""
    from cryptography.x509.oid import NameOID
    nomes = cert.subject.get_attributes_for_oid(NameOID.COMMON_NAME)
    cn = str(nomes[0].value).strip() if nomes else ''
    m = re.match(r'^(.*?)\s*:\s*(\d{11}|[0-9A-Z]{12}\d{2})$', cn)
    return (m.group(1).strip(), m.group(2)) if m else (cn, '')


def vencimento(cert):
    """O dia (em Brasília) em que o certificado vence."""
    return cert.not_valid_after_utc.astimezone(BRASILIA).date()


def termo_assinado(chave, cert, cpf, contratante, contratante_nome, hoje):
    """(o termo assinado, a vigência) com o A1 do procurador. Confere que o certificado é do CPF configurado — senão
    o Serpro recusaria com "NI do procurador diferente do NI do certificado" — e que não venceu."""
    from cryptography.hazmat.primitives import serialization
    if chave is None or cert is None:
        raise ErroTermo('o .pfx do procurador não tem a chave e o certificado juntos')
    nome, numero = nome_e_documento(cert)
    if numero and numero != so_digitos(cpf):
        raise ErroTermo('o e-CPF do procurador é de outro CPF (confira o procurador_cpf e o .pfx)')
    vence = vencimento(cert)
    if vence < hoje:
        raise ErroTermo(f'o e-CPF do procurador venceu em {vence.strftime("%d/%m/%Y")}')
    if not contratante_nome:
        raise ErroTermo('o certificado do escritório não tem o nome (o CN)')
    vigencia = min(hoje + datetime.timedelta(days=DIAS_VIGENCIA), vence)
    canonico = termo_canonico(contratante, contratante_nome, cpf, nome or 'PROCURADOR', hoje, vigencia)
    return assinar(canonico, chave, cert.public_bytes(serialization.Encoding.DER)), vigencia


# ---------------------------------------------------------------- a resposta do ENVIOXMLASSINADO81

def _cabecalho(cabecalhos, nome):
    for k, v in (cabecalhos or {}).items():
        if str(k).lower() == nome:
            return str(v)
    return ''


def _objeto(valor, camadas=3):
    """O 'dados' é um JSON dentro de um texto (às vezes em mais de uma camada)."""
    for _ in range(camadas):
        if not isinstance(valor, str):
            break
        try:
            valor = json.loads(valor)
        except ValueError:
            break
    return valor if isinstance(valor, dict) else {}


def _token_do_etag(cabecalhos):
    """O ETag do 304: "autenticar_procurador_token:ab87df0b-…" (com as aspas; fraco, W/"…", também)."""
    etag = _cabecalho(cabecalhos, 'etag').strip()
    if etag.startswith('W/'):
        etag = etag[2:]
    m = re.match(r'^"?\s*autenticar_procurador_token\s*:\s*([^"\s]+)\s*"?$', etag, re.I)
    return m.group(1) if m else None


def _expira_do_expires(cabecalhos):
    """O Expires do 304, no formato do HTTP (em GMT): "Sat, 15 Oct 2022 00:00:01 GMT"."""
    bruto = _cabecalho(cabecalhos, 'expires')
    try:
        d = email.utils.parsedate_to_datetime(bruto) if bruto else None
    except (TypeError, ValueError, IndexError):
        return None
    if d is not None and d.tzinfo is None:
        d = d.replace(tzinfo=datetime.timezone.utc)
    return d


def _expira_do_dados(texto):
    """A data_hora_expiracao do 200: 'aaaa-MM-ddTHH:mm:ss', a hora de Brasília."""
    s = str(texto or '').strip()[:19]
    try:
        return datetime.datetime.strptime(s, '%Y-%m-%dT%H:%M:%S').replace(tzinfo=BRASILIA)
    except ValueError:
        return None


def token_da_resposta(r):
    """(token, expira_em) da resposta do ENVIOXMLASSINADO81 — r é a Resposta do serpro.py. O 200 traz no 'dados' o
    autenticar_procurador_token e a data_hora_expiracao; o 304 (o mesmo termo de novo, ainda válido) vem sem corpo: o
    token no ETag e a expiração no Expires. Sem token (a recusa): (None, None)."""
    if r.http_status == 304 or r.status == 304:
        token = _token_do_etag(r.cabecalhos)
        return (token, _expira_do_expires(r.cabecalhos)) if token else (None, None)
    if not r.ok():
        return None, None
    campos = {str(k).lower(): v for k, v in _objeto(r.dados_texto).items()}
    token = campos.get('autenticar_procurador_token')
    if isinstance(token, str) and token.strip():
        return token.strip(), _expira_do_dados(campos.get('data_hora_expiracao'))
    token = _token_do_etag(r.cabecalhos)
    return (token, _expira_do_expires(r.cabecalhos)) if token else (None, None)
