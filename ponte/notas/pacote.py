"""As notas de uma empresa no contrato da função `ponte` (supabase/functions/ponte/notas.js, o validarPacoteNotas) e a
divisão em pacotes de até 200 notas e 4 MB.

Cada nota sai do XML guardado na Domínio, quando ele existe, abre e é desta nota (o Id do infNFe com a chave e o cStat
100 ou 150) — `origem: "xml"`, com os itens dele e o CFOP de entrada da Domínio, pelo número do item —, senão das linhas
da Domínio (`origem: "dominio"`). Só vão os itens de compra (`CFOPS_DE_COMPRA`, o mesmo conjunto do notas.js); o
código do produto no cadastro do cliente não vai. O que fica de fora volta com o motivo (a rodada conta, sem dizer
qual nota). Antes de ir, cada nota é conferida aqui com as regras do validarPacoteNotas que dependem só dela — o que
passaria recusado fica de fora, com o campo, e não vai.
"""
import datetime
import hashlib
import json
import re
from decimal import Decimal, InvalidOperation

from . import xml as nfe

CFOPS_DE_COMPRA = frozenset(p + f for f in ('101', '102', '111', '113', '116', '117', '118', '120', '121', '122', '126',
                                           '128', '401', '403', '406', '407', '551', '556') for p in '123')
LIMITE_NOTAS = 200
LIMITE_BYTES = 4 * 1024 * 1024
LIMITE_ITENS = 990
UFS = frozenset('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO EX'.split())
TOLERANCIA = Decimal('0.01')

# por que a nota não vai (o log diz quantas, nunca qual)
MOTIVOS = {
    'chave': 'chave inválida',
    'emitente_pf': 'emitente pessoa física',
    'destinatario': 'destinatário diferente',
    'sem_itens': 'sem itens na Domínio e sem o XML',
    'finalidade': 'XML com finalidade diferente de normal (complementar, ajuste, devolução)',
    'cfop_incerto': 'CFOP da nota incerto',
    'sem_compra': 'sem item de compra',
    'item_incompleto': 'item sem descrição ou sem quantidade',
    'itens_demais': f'mais de {LIMITE_ITENS} itens',
    'fora_do_contrato': 'fora do contrato',
}
# o que aconteceu com o XML (a nota segue pela Domínio)
AVISOS_XML = {
    'xml_ilegivel': 'XML ilegível',
    'xml_sem_autorizacao': 'XML sem a autorização',
    'xml_de_outra_nota': 'XML de outra nota',
}
# o que aconteceu com um item do XML (a nota segue pelo XML)
AVISOS_ITENS = {
    'item_sem_par': 'item(ns) do XML sem o mesmo item na Domínio (foi o CFOP da nota)',
}
# o CPF que o MEI antigo tem no nome empresarial ("FULANO DE TAL 12345678900"): não sai do PC (a comparação usa o CNPJ)
_CPF_NO_NOME = re.compile(r'(?<![0-9])[0-9]{3}\.?[0-9]{3}\.?[0-9]{3}-?[0-9]{2}(?![0-9])')


class Fora(Exception):
    def __init__(self, motivo, campo=None):
        super().__init__(motivo)
        self.motivo = motivo
        self.campo = campo


def dv_da_chave(base43):
    soma, peso = 0, 2
    for c in reversed(base43):
        soma += (ord(c) - 48) * peso
        peso = 2 if peso == 9 else peso + 1
    r = soma % 11
    return 0 if r < 2 else 11 - r


def chave_valida(ch):
    return (isinstance(ch, str) and re.fullmatch(r'\d{6}[0-9A-Z]{12}\d{26}', ch) is not None
            and dv_da_chave(ch[:43]) == int(ch[43]))


def _cpf_valido(d):
    if not re.fullmatch(r'\d{11}', d) or len(set(d)) == 1:
        return False
    for n in (9, 10):
        r = sum(int(d[i]) * (n + 1 - i) for i in range(n)) * 10 % 11
        if (0 if r == 10 else r) != int(d[n]):
            return False
    return True


def _cnpj_valido(c):
    return (re.fullmatch(r'[0-9A-Z]{12}\d{2}', c) is not None and dv_da_chave(c[:12]) == int(c[12])
            and dv_da_chave(c[:13]) == int(c[13]))


def parece_cpf(cnpj):
    """O lugar do CNPJ na chave com o CPF do emitente pessoa física (000 + CPF) — e que não forma um CNPJ."""
    return isinstance(cnpj, str) and cnpj.startswith('000') and _cpf_valido(cnpj[3:]) and not _cnpj_valido(cnpj)


def documento(v):
    return re.sub(r'[^0-9A-Z]', '', str(v or '').upper())


def gtin(v):
    s = str(v or '').strip()
    return s if re.fullmatch(r'\d{8}|\d{12,14}', s) else None


def _dec(v):
    if v is None or isinstance(v, bool):
        return None
    if isinstance(v, Decimal):
        return v if v.is_finite() else None
    try:
        d = Decimal(str(v).strip())
    except (InvalidOperation, ValueError):
        return None
    return d if d.is_finite() else None


def _num(v):
    d = _dec(v)
    return None if d is None else float(d)


def _data(v):
    if v is None:
        return None
    if isinstance(v, datetime.datetime):
        return v.date().isoformat()
    if isinstance(v, datetime.date):
        return v.isoformat()
    s = str(v).strip()[:10]
    try:
        return datetime.date.fromisoformat(s).isoformat()
    except ValueError:
        return None


def _texto(v):
    s = re.sub(r'\s+', ' ', str(v)).strip() if v is not None else ''
    return s or None


def _nome_sem_cpf(v):
    s = _texto(v)
    return _texto(_CPF_NO_NOME.sub(' ', s)) if s else None


def _cfop(v):
    d = _dec(v)
    if d is None or d != d.to_integral_value():
        return None
    s = str(int(d))
    return s if re.fullmatch(r'[123]\d{3}', s) else None


def montar_nota(linhas, xml_bruto, doc_empresa):
    """(nota, motivo, avisos, itens_fora): a nota no contrato, ou nota None com o motivo. `linhas` são as do
    notas_itens.sql da mesma chave (as dos segmentos da nota); `avisos`, o que houve com o XML."""
    avisos = []
    try:
        nota, fora = _montar(linhas, xml_bruto, doc_empresa, avisos)
        return nota, None, avisos, fora
    except Fora as f:
        return None, f, avisos, 0


def _montar(linhas, xml_bruto, doc_empresa, avisos):
    primeira = linhas[0]
    chave = str(primeira.get('chave') or '').strip().upper()
    if not chave_valida(chave) or chave[20:22] != '55':
        raise Fora('chave')
    doc_for = documento(primeira.get('emitente_doc'))
    tipo = _dec(primeira.get('emitente_tipo'))
    cnpj_chave = chave[6:20]
    if len(doc_for) == 11 or (tipo is not None and tipo == 2) or (not doc_for and parece_cpf(cnpj_chave)):
        raise Fora('emitente_pf')
    entradas = sorted(d for d in (_data(l.get('entrada')) for l in linhas) if d)
    entrada = entradas[0] if entradas else None
    emissao_dom = next((d for d in (_data(l.get('emissao')) for l in linhas) if d), None)
    com_item = [l for l in linhas if l.get('item_seq') is not None]
    cfops_nota = _dec(primeira.get('nota_cfops'))
    cfop_nota = _cfop(primeira.get('nota_cfop')) if cfops_nota == 1 else None

    x = None
    if xml_bruto is not None:
        try:
            x = nfe.ler(xml_bruto)
        except nfe.Ilegivel:
            avisos.append('xml_ilegivel')
            x = None
        if x is not None and x['chave'] != chave:
            avisos.append('xml_de_outra_nota')
            x = None
        elif x is not None and x['cstat'] not in nfe.AUTORIZADA:
            avisos.append('xml_sem_autorizacao')
            x = None

    if x is not None:
        if x['emit_cpf'] and not x['emit_cnpj']:
            raise Fora('emitente_pf')
        if x['fin'] != '1':
            raise Fora('finalidade')
        if documento(x['dest_cnpj'] or x['dest_cpf']) != doc_empresa:
            raise Fora('destinatario')
        # o CFOP de cada item do XML vem do mesmo item na Domínio: o do mesmo número, se a quantidade e o valor batem;
        # senão, o único com a mesma quantidade e o mesmo valor; senão, o CFOP da nota (quando ela tem um só). O número
        # sozinho não basta: a Domínio pode numerar em outra ordem, e o brinde iria como compra (a revisão de 05/11/2026)
        dom = []
        for l in com_item:
            n = _dec(l.get('item'))
            dom.append((int(n) if n is not None and n == n.to_integral_value() else None, _cfop(l.get('cfop')),
                        _dec(l.get('quantidade')), _dec(l.get('valor_total'))))
        por_numero = {}
        for n, c, q, v in dom:
            if n is not None and c:
                por_numero.setdefault(n, (c, q, v))

        def bate(a, b):
            return a is not None and b is not None and abs(a - b) <= TOLERANCIA

        itens = []
        for it in x['itens']:
            par = por_numero.get(it['n'])
            if par and bate(par[1], it['quantidade']) and bate(par[2], it['valor_total']):
                cfop = par[0]
            else:
                iguais = {c for _, c, q, v in dom if c and bate(q, it['quantidade']) and bate(v, it['valor_total'])}
                cfop = iguais.pop() if len(iguais) == 1 else None
                if not cfop:
                    if not cfop_nota:
                        raise Fora('cfop_incerto')
                    cfop = cfop_nota
                    avisos.append('item_sem_par')
            itens.append({
                'n': it['n'], 'codigo': _texto(it['codigo']), 'ean': gtin(it['ean']), 'descricao': _texto(it['descricao']),
                'ncm': _texto(it['ncm']), 'cfop': cfop, 'unidade': _texto(it['unidade']),
                'quantidade': _num(it['quantidade']), 'valor_unitario': _num(it['valor_unitario']),
                'valor_total': _num(it['valor_total']), 'desconto': _num(it['desconto']) or 0.0,
                'ipi': _num(it['ipi']) or 0.0, 'icms_st': _num(it['icms_st']) or 0.0,
                'ean_trib': gtin(it['ean_trib']), 'unidade_trib': _texto(it['unidade_trib']),
                'quantidade_trib': _num(it['quantidade_trib']), 'valor_unitario_trib': _num(it['valor_unitario_trib']),
            })
        t = x['totais']
        totais = {k: _num(t[k]) for k in ('produtos', 'desconto', 'frete', 'ipi', 'icms_st', 'total')}
        if totais['total'] is None:
            totais['total'] = _num(primeira.get('nota_total'))
        emitente = {'cnpj': cnpj_chave, 'nome': _nome_sem_cpf(x['emit_nome']) or _nome_sem_cpf(primeira.get('emitente_nome')),
                    'uf': (x['emit_uf'] or primeira.get('emitente_uf') or '').strip().upper()}
        emissao = _data(x['emissao']) or emissao_dom
        origem = 'xml'
    else:
        if not com_item:
            raise Fora('sem_itens')
        numeros = [_dec(l.get('item')) for l in com_item]
        unicos = all(n is not None and n == n.to_integral_value() and 1 <= n <= LIMITE_ITENS for n in numeros) \
            and len({int(n) for n in numeros}) == len(numeros)
        soma_ipi = sum((_dec(l.get('ipi')) or Decimal(0)) for l in com_item)
        nota_ipi = _dec(primeira.get('nota_ipi')) or Decimal(0)
        ipi_bate = abs(soma_ipi - nota_ipi) <= TOLERANCIA
        itens = []
        for i, l in enumerate(com_item):
            cfop = _cfop(l.get('cfop')) or cfop_nota
            if not cfop:
                raise Fora('cfop_incerto')
            itens.append({
                'n': int(numeros[i]) if unicos else i + 1,
                'codigo': _texto(l.get('produto_fornecedor')), 'ean': gtin(l.get('ean')), 'descricao': _texto(l.get('descricao')),
                'ncm': _texto(l.get('ncm')), 'cfop': cfop, 'unidade': _texto(l.get('unidade')),
                'quantidade': _num(l.get('quantidade')), 'valor_unitario': _num(l.get('valor_unitario')),
                'valor_total': _num(l.get('valor_total')), 'desconto': _num(l.get('desconto')),
                'ipi': _num(l.get('ipi')) if ipi_bate else None, 'icms_st': _num(l.get('icms_st')),
                'ean_trib': None, 'unidade_trib': None, 'quantidade_trib': None, 'valor_unitario_trib': None,
            })
        totais = {'produtos': _num(primeira.get('nota_produtos')), 'desconto': _num(primeira.get('nota_desconto')),
                  'frete': _num(primeira.get('nota_frete')), 'ipi': _num(primeira.get('nota_ipi')),
                  'icms_st': _num(primeira.get('nota_icms_st')), 'total': _num(primeira.get('nota_total'))}
        emitente = {'cnpj': cnpj_chave, 'nome': _nome_sem_cpf(primeira.get('emitente_nome')),
                    'uf': str(primeira.get('emitente_uf') or '').strip().upper()}
        emissao = emissao_dom
        origem = 'dominio'

    # as conferências só nos itens que vão: o brinde sem descrição não derruba a nota (a revisão de 05/11/2026)
    compra = [it for it in itens if it['cfop'] in CFOPS_DE_COMPRA]
    if not compra:
        raise Fora('sem_compra')
    if len(compra) > LIMITE_ITENS:
        raise Fora('itens_demais')
    if any(not it['descricao'] or not (it['quantidade'] or 0) > 0 for it in compra):
        raise Fora('item_incompleto')
    nota = {
        'chave': chave, 'modelo': '55', 'numero': str(int(chave[25:34])), 'serie': str(int(chave[22:25])),
        'emissao': emissao, 'entrada': entrada,
        'emitente': emitente, 'destinatario': {'cnpj': doc_empresa},
        'totais': totais, 'origem': origem, 'itens': compra,
    }
    campo = problema(nota)
    if campo:
        raise Fora('fora_do_contrato', campo)
    return nota, len(itens) - len(compra)


def problema(nota):
    """O primeiro campo que o validarPacoteNotas recusaria nesta nota (as regras que dependem só dela), ou None."""
    for k in ('emissao', 'entrada'):
        d = nota.get(k)
        if not d or d < '2000-01-01':
            return k
    if nota['emitente']['uf'] not in UFS:
        return 'emitente.uf'
    if parece_cpf(nota['emitente']['cnpj']):
        return 'emitente.cnpj'
    for k, v in nota['totais'].items():
        if (v is None and k == 'total') or (v is not None and not 0 <= v <= 1e13):
            return f'totais.{k}'
    vistos = set()
    for it in nota['itens']:
        if not isinstance(it['n'], int) or not 1 <= it['n'] <= LIMITE_ITENS or it['n'] in vistos:
            return 'itens.n'
        vistos.add(it['n'])
        if it['valor_total'] is None:
            return 'itens.valor_total'
        for k in ('quantidade', 'valor_unitario', 'quantidade_trib', 'valor_unitario_trib'):
            v = it[k]
            if (v is None and k in ('quantidade', 'valor_unitario')) or (v is not None and not 0 <= v <= 1e11):
                return f'itens.{k}'
        for k in ('valor_total', 'desconto', 'ipi', 'icms_st'):
            v = it[k]
            if v is not None and not 0 <= v <= 1e13:
                return f'itens.{k}'
    return None


def impressao(nota, xml_bruto=None):
    """A impressão digital da nota: o SHA-256 do JSON dela, com o XML (o que muda num muda a impressão)."""
    h = hashlib.sha256(json.dumps(nota, sort_keys=True, ensure_ascii=False).encode('utf-8'))
    h.update(b'\0')
    if xml_bruto is not None:
        h.update(bytes(xml_bruto) if not isinstance(xml_bruto, str) else xml_bruto.encode('utf-8'))
    return h.hexdigest()


def dividir(notas, empresa, rodada):
    """Os pacotes da empresa: até 200 notas e até 4 MB cada (o JSON inteiro). A nota que sozinha passa de 4 MB volta
    em `grandes` (não vai)."""
    base = len(json.dumps({'versao': 1, 'tipo': 'notas', 'rodada': rodada, 'empresa': empresa, 'notas': []},
                          ensure_ascii=False).encode('utf-8'))
    pacotes, atual, tamanho, grandes = [], [], base, []
    for n in notas:
        t = len(json.dumps(n, ensure_ascii=False).encode('utf-8')) + 1
        if base + t > LIMITE_BYTES:
            grandes.append(n)
            continue
        if atual and (len(atual) >= LIMITE_NOTAS or tamanho + t > LIMITE_BYTES):
            pacotes.append(atual)
            atual, tamanho = [], base
        atual.append(n)
        tamanho += t
    if atual:
        pacotes.append(atual)
    return [{'versao': 1, 'tipo': 'notas', 'rodada': rodada, 'empresa': empresa, 'notas': p} for p in pacotes], grandes
