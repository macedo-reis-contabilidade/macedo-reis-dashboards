"""A NF-e do XML que a Domínio guarda, lida como o importador dos XMLs do sistema lê (assets/js/importar-xml.js, o
parseXml): a nota e os itens com os mesmos campos e as mesmas regras, pra o banco gravar como a importação grava. É o
que a ponte das notas de entrada da SEDIF/DeSTDA (ponte/sedif.py) manda. Só a biblioteca padrão.

    ler(bruto) -> {'chave', 'doc': {...}, 'itens': [{...}]}
                  Ilegivel quando não abre, não é uma NF-e, ou a Sefaz não autorizou (o importador ignora essa nota)

O XML mesmo nunca sai do PC: daqui sai só o que a tela usa (os campos da nf_documentos e da nf_itens). XML com DOCTYPE ou
ENTITY não é lido. O resultado é o do importador, campo a campo: tests/harness/sedif-nfe.py roda os mesmos XMLs nos
dois (o do sistema, no Chromium). Mudou a leitura lá, mude aqui (e o LEITOR, pra ponte mandar de novo o que já mandou).
"""
import math
import re
import xml.etree.ElementTree as ET

from .notas.xml import Ilegivel, abrir

LEITOR = '1'            # muda quando o que sai daqui muda: a ponte manda de novo as notas da janela

RX_CHAVE = re.compile(r'\d{6}[0-9A-Z]{12}\d{26}')
RX_CNPJ = re.compile(r'[0-9A-Z]{12}[0-9]{2}')
RX_DATA = re.compile(r'[0-9]{4}-[0-9]{2}-[0-9]{2}')
# o Number() do JavaScript, só pra decimal (o XML da NF-e não tem outro): sem o "_" que o float() do Python aceita
RX_NUMERO = re.compile(r'[+-]?(?:[0-9]+\.?[0-9]*|\.[0-9]+)(?:[eE][+-]?[0-9]+)?')
# os espaços que o trim() do JavaScript tira (o str.strip() do Python tira outros e deixa o ﻿)
ESPACOS = ' \t\n\x0b\x0c\r                 　﻿'
CANCELADA = ('101', '135', '151')
DENEGADA = ('110', '301', '302', '303')
AUTORIZADA = ('100', '150')


def _local(tag):
    return tag.rsplit('}', 1)[-1] if isinstance(tag, str) else ''


def _trim(s):
    return s.strip(ESPACOS)


def _primeiro(el, nome, com_ele=False):
    """O primeiro descendente com o nome, na ordem do documento (o getElementsByTagNameNS('*', nome)[0])."""
    if el is None:
        return None
    for c in el.iter():
        if (com_ele or c is not el) and _local(c.tag) == nome:
            return c
    return None


def _txt(el, nome):
    """O texto do primeiro descendente com o nome, sem os espaços das pontas; None sem ele (o txt() do importador)."""
    n = _primeiro(el, nome)
    return _trim(''.join(n.itertext())) if n is not None else None


def _filho(el, nome):
    if el is None:
        return None
    for c in el:
        if _local(c.tag) == nome:
            return c
    return None


def _dig(s):
    return re.sub(r'[^0-9]', '', s or '')


def _numero_js(t):
    """O Number() do JavaScript num texto já sem os espaços: o número, ou None (NaN e infinito)."""
    if t == '':
        return 0
    if not RX_NUMERO.fullmatch(t):
        return None
    x = float(t)
    if not math.isfinite(x):
        return None
    return int(x) if x.is_integer() and abs(x) < 2 ** 53 else x


def _num(v):
    """O num() do importador: o ausente e o que não é número viram 0."""
    x = _numero_js(_trim(v) if v is not None else '')
    return 0 if x is None else x


def _num_ou_nulo(v):
    """O numOuNulo() do importador: o ausente fica nulo (a alíquota do fornecedor do Simples, a base da ST)."""
    t = _trim(v) if v is not None else ''
    return None if t == '' else _numero_js(t)


def _inteiro(v):
    """O Number(txt(...)) dos campos inteiros (tpNF, finNFe, CRT, indIEDest): None sem o campo."""
    return None if v is None else _numero_js(v)


def doc_xml(s):
    """O normalizarDocumento do sistema: o CNPJ com letras fica com elas; o resto, só os dígitos."""
    t = re.sub(r'[\s.\-/]', '', str(s if s is not None else '').upper())
    return t if RX_CNPJ.fullmatch(t) else _dig(t)


def ler(bruto):
    b = abrir(bruto)
    if b'<!DOCTYPE' in b[:4096].upper() or b'<!ENTITY' in b.upper():
        raise Ilegivel('tem DOCTYPE ou ENTITY')
    try:
        raiz = ET.fromstring(b)
    except ET.ParseError:
        raise Ilegivel('não é XML')
    rl = _local(raiz.tag)
    if rl in ('procEventoNFe', 'evento', 'retEnvEvento', 'pedRegEvento'):
        raise Ilegivel('é um evento')
    if rl == 'DPS' or any(_primeiro(raiz, n, True) is not None for n in ('infNFSe', 'InfNfse', 'infNfse', 'infDPS')):
        raise Ilegivel('é uma NFS-e')
    if re.search('cte', rl, re.I) or _primeiro(raiz, 'infCte', True) is not None:
        raise Ilegivel('é um CT-e')
    if re.search('mdfe', rl, re.I) or _primeiro(raiz, 'infMDFe', True) is not None:
        raise Ilegivel('é um MDF-e')
    inf = _primeiro(raiz, 'infNFe', True)
    if inf is None:
        raise Ilegivel('não é NF-e')
    chave = re.sub(r'^NFe', '', str(inf.get('Id') or ''), flags=re.I)
    chave = re.sub(r'[^0-9A-Z]', '', chave.upper())
    if not RX_CHAVE.fullmatch(chave):
        raise Ilegivel('chave de acesso inválida')
    ide, emit, dest = _filho(inf, 'ide'), _filho(inf, 'emit'), _filho(inf, 'dest')
    tot = _primeiro(_filho(inf, 'total'), 'ICMSTot')
    dh = _txt(ide, 'dhEmi') or _txt(ide, 'dEmi') or ''
    data = dh[:10]
    if not RX_DATA.fullmatch(data):
        raise Ilegivel('data de emissão ausente')
    # o protocolo: 100/150 autorizada; 101/135/151 cancelada; 110/301/302/303 denegada; outro cStat é rejeição (a nota não
    # existe na Sefaz) e não vai. Sem o protNFe, autorizada (o XML sem o protocolo), como no importador.
    prot = _primeiro(raiz, 'protNFe', True)
    cstat = _txt(prot, 'cStat')
    status = 'autorizada'
    if prot is not None and cstat:
        if cstat in CANCELADA:
            status = 'cancelada'
        elif cstat in DENEGADA:
            status = 'denegada'
        elif cstat not in AUTORIZADA:
            raise Ilegivel('a Sefaz não autorizou')
    ender_emit, ender_dest = _filho(emit, 'enderEmit'), _filho(dest, 'enderDest')
    dest_tipo, dest_doc = 'PF', None
    if dest is not None:
        if _txt(dest, 'CNPJ'):
            dest_tipo, dest_doc = 'PJ', doc_xml(_txt(dest, 'CNPJ'))
        elif _txt(dest, 'CPF'):
            dest_tipo, dest_doc = 'PF', doc_xml(_txt(dest, 'CPF'))
        elif _txt(dest, 'idEstrangeiro') is not None:
            dest_tipo, dest_doc = 'EX', _txt(dest, 'idEstrangeiro') or None
    itens = []
    for det in (c for c in inf.iter() if c is not inf and _local(c.tag) == 'det'):
        prod, imp = _filho(det, 'prod'), _filho(det, 'imposto')
        icms, pis = _primeiro(imp, 'ICMS'), _primeiro(imp, 'PIS')
        cofins, ipi = _primeiro(imp, 'COFINS'), _primeiro(imp, 'IPI')
        n = _numero_js(_trim(det.get('nItem') or ''))
        itens.append({
            'n_item': n if isinstance(n, int) and n else len(itens) + 1,
            'codigo': _txt(prod, 'cProd'), 'descricao': _txt(prod, 'xProd'),
            'ncm': _dig(_txt(prod, 'NCM')) or None, 'cest': _dig(_txt(prod, 'CEST')) or None,
            'cfop': _dig(_txt(prod, 'CFOP')) or None, 'unidade': _txt(prod, 'uCom'),
            'quantidade': _num(_txt(prod, 'qCom')), 'valor_unitario': _num(_txt(prod, 'vUnCom')),
            'valor_total': _num(_txt(prod, 'vProd')), 'desconto': _num(_txt(prod, 'vDesc')),
            'icms_origem': _txt(icms, 'orig'), 'icms_cst': _txt(icms, 'CST'), 'csosn': _txt(icms, 'CSOSN'),
            'pis_cst': _txt(pis, 'CST'), 'cofins_cst': _txt(cofins, 'CST'),
            'icms_valor': _num(_txt(icms, 'vICMS')), 'icms_st_valor': _num(_txt(icms, 'vICMSST')),
            'ipi_valor': _num(_txt(ipi, 'vIPI')), 'pis_valor': _num(_txt(pis, 'vPIS')),
            'cofins_valor': _num(_txt(cofins, 'vCOFINS')),
            'icms_base': _num_ou_nulo(_txt(icms, 'vBC')), 'icms_aliquota': _num_ou_nulo(_txt(icms, 'pICMS')),
            'icms_st_base': _num_ou_nulo(_txt(icms, 'vBCST')),
        })
    principal = None
    for i in itens:
        if principal is None or i['valor_total'] > principal['valor_total']:
            principal = i
    doc = {
        'modelo': _txt(ide, 'mod') or '55', 'serie': _txt(ide, 'serie'), 'numero': _txt(ide, 'nNF'), 'data_emissao': data,
        'tp_nf': _inteiro(_txt(ide, 'tpNF')), 'finalidade': _inteiro(_txt(ide, 'finNFe')),
        'natureza_operacao': _txt(ide, 'natOp'),
        'emit_doc': doc_xml(_txt(emit, 'CNPJ') or _txt(emit, 'CPF')) or None, 'emit_nome': _txt(emit, 'xNome'),
        'emit_uf': _txt(ender_emit, 'UF'), 'emit_municipio': _txt(ender_emit, 'xMun'),
        'emit_ie': _txt(emit, 'IE'), 'emit_crt': _inteiro(_txt(emit, 'CRT')),
        'dest_doc': dest_doc, 'dest_tipo': dest_tipo, 'dest_nome': _txt(dest, 'xNome'), 'dest_uf': _txt(ender_dest, 'UF'),
        'dest_municipio': _txt(ender_dest, 'xMun'), 'dest_ie': _txt(dest, 'IE'),
        'dest_ind_ie': _inteiro(_txt(dest, 'indIEDest')),
        'valor_total': _num(_txt(tot, 'vNF')), 'valor_produtos': _num(_txt(tot, 'vProd')),
        'valor_desconto': _num(_txt(tot, 'vDesc')), 'valor_frete': _num(_txt(tot, 'vFrete')),
        'icms': _num(_txt(tot, 'vICMS')), 'icms_st': _num(_txt(tot, 'vST')), 'ipi': _num(_txt(tot, 'vIPI')),
        'pis': _num(_txt(tot, 'vPIS')), 'cofins': _num(_txt(tot, 'vCOFINS')),
        'cfop_principal': principal['cfop'] if principal else None, 'status': status,
    }
    return {'chave': chave, 'doc': doc, 'itens': itens}
