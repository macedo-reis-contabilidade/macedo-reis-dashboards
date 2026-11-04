"""O leitor do XML da NF-e guardado na Domínio (o `nfeProc`), só com a biblioteca padrão.

O XML vem da EFATENDIMENTO_NFE_XML_V2 como texto UTF-8, sem compactar (a fila do XML, 03/11/2026); o que não começar
por "<" é tentado com zlib, gzip e deflate antes de desistir. Daqui sai só o que o contrato usa (a chave, a
autorização, a finalidade, o emitente, o destinatário, os totais e os itens) — o XML mesmo nunca vai pro pacote nem
pro log. XML com DOCTYPE ou ENTITY não é lido (não há motivo pra uma NF-e ter, e é o caminho dos ataques de entidade).
"""
import gzip
import zlib
import xml.etree.ElementTree as ET
from decimal import Decimal, InvalidOperation

AUTORIZADA = ('100', '150')          # autorizado o uso (150: fora do prazo)


class Ilegivel(Exception):
    """O XML não abriu (nem como texto, nem descompactado) ou não é uma NF-e que dê pra ler."""


def abrir(bruto):
    """Os bytes do XML: como veio, se começar por "<"; senão zlib, gzip ou deflate. Nada abriu: Ilegivel."""
    if bruto is None:
        raise Ilegivel('sem conteúdo')
    if isinstance(bruto, str):
        bruto = bruto.encode('utf-8')
    b = bytes(bruto)
    if b.lstrip(b'\xef\xbb\xbf \r\n\t').startswith(b'<'):
        return b
    for abrir_um in (zlib.decompress, gzip.decompress, lambda x: zlib.decompress(x, -15)):
        try:
            aberto = abrir_um(b)
        except Exception:
            continue
        if aberto.lstrip(b'\xef\xbb\xbf \r\n\t').startswith(b'<'):
            return aberto
    raise Ilegivel('não abriu')


def _local(tag):
    return tag.rsplit('}', 1)[-1]


def _filho(el, nome):
    if el is None:
        return None
    for c in el:
        if _local(c.tag) == nome:
            return c
    return None


def _achar(el, nome):
    if el is None:
        return None
    for c in el.iter():
        if _local(c.tag) == nome:
            return c
    return None


def _texto(el, nome):
    c = _filho(el, nome)
    return c.text.strip() if c is not None and c.text and c.text.strip() else None


def _numero(v):
    if v is None:
        return None
    try:
        d = Decimal(str(v).strip())
    except (InvalidOperation, ValueError):
        return None
    return d if d.is_finite() else None


def _doc(el):
    """(CNPJ, CPF) do emit ou do dest."""
    return _texto(el, 'CNPJ'), _texto(el, 'CPF')


def ler(bruto):
    """O que a ponte usa da NF-e: {chave, cstat, fin, emissao, emit_cnpj, emit_cpf, emit_nome, emit_uf, dest_cnpj,
    dest_cpf, totais, itens}. Os números saem em Decimal. Ilegivel quando não abre ou não é uma NF-e."""
    b = abrir(bruto)
    cabeca = b[:4096].upper()
    if b'<!DOCTYPE' in cabeca or b'<!ENTITY' in b.upper():
        raise Ilegivel('tem DOCTYPE ou ENTITY')
    try:
        raiz = ET.fromstring(b)
    except ET.ParseError:
        raise Ilegivel('não é XML')
    inf = _achar(raiz, 'infNFe')
    if inf is None:
        raise Ilegivel('sem o infNFe')
    chave = (inf.get('Id') or '').strip().upper()
    if chave.startswith('NFE'):
        chave = chave[3:]
    prot = _achar(raiz, 'infProt')
    ide = _filho(inf, 'ide')
    emit = _filho(inf, 'emit')
    dest = _filho(inf, 'dest')
    emit_cnpj, emit_cpf = _doc(emit)
    dest_cnpj, dest_cpf = _doc(dest)
    dh = _texto(ide, 'dhEmi') or _texto(ide, 'dEmi') or ''
    tot = _achar(_filho(inf, 'total'), 'ICMSTot')
    totais = {k: _numero(_texto(tot, x)) for k, x in (('produtos', 'vProd'), ('desconto', 'vDesc'), ('frete', 'vFrete'),
                                                     ('ipi', 'vIPI'), ('icms_st', 'vST'), ('total', 'vNF'))}
    itens = []
    for det in (c for c in inf if _local(c.tag) == 'det'):
        prod = _filho(det, 'prod')
        imposto = _filho(det, 'imposto')
        ipi = _achar(_filho(imposto, 'IPI'), 'vIPI')
        st = _achar(_filho(imposto, 'ICMS'), 'vICMSST')
        try:
            n = int((det.get('nItem') or '').strip())
        except ValueError:
            n = None
        itens.append({
            'n': n,
            'codigo': _texto(prod, 'cProd'),
            'ean': _texto(prod, 'cEAN'),
            'descricao': _texto(prod, 'xProd'),
            'ncm': _texto(prod, 'NCM'),
            'unidade': _texto(prod, 'uCom'),
            'quantidade': _numero(_texto(prod, 'qCom')),
            'valor_unitario': _numero(_texto(prod, 'vUnCom')),
            'valor_total': _numero(_texto(prod, 'vProd')),
            'desconto': _numero(_texto(prod, 'vDesc')),
            'ipi': _numero(ipi.text) if ipi is not None and ipi.text else None,
            'icms_st': _numero(st.text) if st is not None and st.text else None,
            'ean_trib': _texto(prod, 'cEANTrib'),
            'unidade_trib': _texto(prod, 'uTrib'),
            'quantidade_trib': _numero(_texto(prod, 'qTrib')),
            'valor_unitario_trib': _numero(_texto(prod, 'vUnTrib')),
        })
    return {
        'chave': chave,
        'cstat': _texto(prot, 'cStat'),
        'fin': _texto(ide, 'finNFe'),
        'emissao': dh[:10] if len(dh) >= 10 else None,
        'emit_cnpj': emit_cnpj, 'emit_cpf': emit_cpf,
        'emit_nome': _texto(emit, 'xNome'),
        'emit_uf': _texto(_filho(emit, 'enderEmit'), 'UF'),
        'dest_cnpj': dest_cnpj, 'dest_cpf': dest_cpf,
        'totais': totais,
        'itens': itens,
    }
