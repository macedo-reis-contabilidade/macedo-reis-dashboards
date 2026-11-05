"""A Domínio de mentira das notas: empresas, notas e XMLs inventados, pro `--falso` e pros testes.

O cenário vem do arquivo JSON da variável PONTE_NOTAS_FALSO (os testes montam um por caso) ou, sem ela, do padrão
daqui — uma empresa (901) com algumas notas. Os CNPJs têm o dígito verificador errado de propósito (não são de
ninguém); as chaves são montadas com o dígito verificador certo (a função confere o dela).

    {"empresas": {"901": {"documento": "11222333000100", "notas": [
        {"chave", "entrada", "emissao", "emitente_doc", "emitente_tipo", "emitente_nome", "emitente_uf",
         "totais": {produtos, desconto, frete, ipi, icms_st, total}, "cfops": [1102],
         "itens": [{item, produto_fornecedor, descricao, ean, ncm, cfop, unidade, quantidade, valor_unitario,
                    valor_total, desconto, ipi, icms_st}],
         "xml": "<nfeProc…>" ou null, "xml_zlib": false}]}}}
"""
import datetime
import json
import os
import zlib
from decimal import Decimal

from .pacote import dv_da_chave

DOC_PADRAO = '11222333000100'
FORNECEDOR_PADRAO = '99888777000199'   # o dígito verificador errado de propósito: não bate com empresa de verdade


def chave(cnpj_emitente, numero, serie=1, uf='42', aamm='2609', modelo='55', codigo='12345678'):
    """A chave de 44 com o dígito verificador certo (o CNPJ como vier: inventado, com o DV errado, tanto faz)."""
    base = f'{uf}{aamm}{cnpj_emitente}{modelo}{serie:03d}{numero:09d}1{codigo}'
    return base + str(dv_da_chave(base))


def xml_nfe(ch, itens, dest=DOC_PADRAO, emit_cnpj=None, emit_cpf=None, emit_nome='FORNECEDOR INVENTADO LTDA',
            emit_uf='SC', fin='1', cstat='100', dh='2026-09-15T10:00:00-03:00', totais=None, id_=None):
    """Um nfeProc inventado, no formato da NF-e 4.00 (só o que a ponte lê, e mais um pouco pra parecer o de verdade)."""
    emit_doc = f'<CPF>{emit_cpf}</CPF>' if emit_cpf else f'<CNPJ>{emit_cnpj or ch[6:20]}</CNPJ>'
    dets = []
    for it in itens:
        ipi = (f'<IPI><cEnq>999</cEnq><IPITrib><CST>50</CST><vBC>{it["valor_total"]}</vBC><pIPI>5.00</pIPI>'
               f'<vIPI>{it["ipi"]}</vIPI></IPITrib></IPI>') if it.get('ipi') else ''
        st = f'<vBCST>0</vBCST><pICMSST>0</pICMSST><vICMSST>{it["icms_st"]}</vICMSST>' if it.get('icms_st') else ''
        desc = f'<vDesc>{it["desconto"]}</vDesc>' if it.get('desconto') else ''
        dets.append(
            f'<det nItem="{it["n"]}"><prod><cProd>{it["codigo"]}</cProd><cEAN>{it.get("ean") or "SEM GTIN"}</cEAN>'
            f'<xProd>{it["descricao"]}</xProd><NCM>{it.get("ncm") or "00000000"}</NCM><CFOP>5102</CFOP>'
            f'<uCom>{it.get("unidade") or "UN"}</uCom><qCom>{it["quantidade"]}</qCom><vUnCom>{it["valor_unitario"]}</vUnCom>'
            f'<vProd>{it["valor_total"]}</vProd><cEANTrib>{it.get("ean_trib") or "SEM GTIN"}</cEANTrib>'
            f'<uTrib>{it.get("unidade_trib") or it.get("unidade") or "UN"}</uTrib>'
            f'<qTrib>{it.get("quantidade_trib") or it["quantidade"]}</qTrib>'
            f'<vUnTrib>{it.get("valor_unitario_trib") or it["valor_unitario"]}</vUnTrib>{desc}<indTot>1</indTot></prod>'
            f'<imposto><ICMS><ICMS10><orig>0</orig><CST>10</CST>{st}</ICMS10></ICMS>{ipi}</imposto></det>')
    t = totais or {}
    soma = sum(Decimal(str(i['valor_total'])) for i in itens)
    tot = (f'<total><ICMSTot><vProd>{t.get("produtos", soma)}</vProd><vST>{t.get("icms_st", 0)}</vST>'
           f'<vFrete>{t.get("frete", 0)}</vFrete><vDesc>{t.get("desconto", 0)}</vDesc><vIPI>{t.get("ipi", 0)}</vIPI>'
           f'<vNF>{t.get("total", soma)}</vNF></ICMSTot></total>')
    dest_doc = f'<CPF>{dest}</CPF>' if len(dest) == 11 else f'<CNPJ>{dest}</CNPJ>'
    return (f'<?xml version="1.0" encoding="UTF-8"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">'
            f'<NFe><infNFe Id="NFe{id_ or ch}" versao="4.00"><ide><mod>55</mod><serie>{int(ch[22:25])}</serie>'
            f'<nNF>{int(ch[25:34])}</nNF><dhEmi>{dh}</dhEmi><finNFe>{fin}</finNFe></ide>'
            f'<emit>{emit_doc}<xNome>{emit_nome}</xNome><enderEmit><UF>{emit_uf}</UF></enderEmit></emit>'
            f'<dest>{dest_doc}<xNome>EMPRESA INVENTADA</xNome></dest>{"".join(dets)}{tot}</infNFe></NFe>'
            f'<protNFe versao="4.00"><infProt><chNFe>{ch}</chNFe><cStat>{cstat}</cStat></infProt></protNFe></nfeProc>')


def _padrao():
    """Uma empresa com três notas de setembro: uma com o XML, uma sem, e uma só de bonificação."""
    def item(n, cfop, total='100.00'):
        return {'item': n, 'produto_fornecedor': f'COD-{n}', 'descricao': f'PRODUTO INVENTADO {n}', 'ean': '7890000000017',
                'ncm': '73181500', 'cfop': cfop, 'unidade': 'UN', 'quantidade': '10', 'valor_unitario': '10.00',
                'valor_total': total, 'desconto': '0', 'ipi': '0', 'icms_st': '0'}

    notas = []
    for numero, cfops, com_xml in ((101, [1102, 1102], True), (102, [1102], False), (103, [1910], False)):
        ch = chave(FORNECEDOR_PADRAO, numero)
        itens = [item(i + 1, c) for i, c in enumerate(cfops)]
        xml = None
        if com_xml:
            xml = xml_nfe(ch, [{'n': i['item'], 'codigo': i['produto_fornecedor'], 'descricao': i['descricao'],
                                'quantidade': '10', 'valor_unitario': '10.00', 'valor_total': i['valor_total'],
                                'ean': i['ean']} for i in itens])
        notas.append({'chave': ch, 'entrada': '2026-09-16', 'emissao': '2026-09-15', 'emitente_doc': FORNECEDOR_PADRAO,
                      'emitente_tipo': 1, 'emitente_nome': 'FORNECEDOR INVENTADO LTDA', 'emitente_uf': 'SC',
                      'totais': {'produtos': str(100 * len(itens)), 'desconto': '0', 'frete': '0', 'ipi': '0',
                                 'icms_st': '0', 'total': str(100 * len(itens))},
                      'cfops': sorted(set(cfops)), 'itens': itens, 'xml': xml})
    return {'empresas': {'901': {'documento': DOC_PADRAO, 'notas': notas}}}


def _dec(v):
    return None if v is None else Decimal(str(v))


class FonteNotasFalsa:
    def __init__(self, cenario=None):
        if cenario is None:
            arq = os.environ.get('PONTE_NOTAS_FALSO')
            cenario = json.loads(open(arq, encoding='utf-8').read()) if arq else _padrao()
        self.cenario = cenario
        self.consultas = []                     # (consulta, código) — pros testes

    def _notas(self, codigo, ini, fim):
        e = self.cenario.get('empresas', {}).get(str(codigo)) or {}
        for n in e.get('notas', []):
            d = datetime.date.fromisoformat(n['entrada'])
            if ini <= d <= fim:
                yield n

    def documento(self, codigo):
        self.consultas.append(('documento', codigo))
        e = self.cenario.get('empresas', {}).get(str(codigo))
        return e.get('documento') if e else None

    def linhas(self, codigo, ini, fim):
        self.consultas.append(('linhas', codigo))
        saida = []
        for n in self._notas(codigo, ini, fim):
            t = n.get('totais') or {}
            cfops = n.get('cfops') or []
            cab = {'chave': n['chave'], 'segmento': 1, 'emissao': datetime.date.fromisoformat(n['emissao']),
                   'entrada': datetime.date.fromisoformat(n['entrada']), 'emitente_doc': n.get('emitente_doc'),
                   'emitente_tipo': n.get('emitente_tipo'), 'emitente_nome': n.get('emitente_nome'),
                   'emitente_uf': n.get('emitente_uf'),
                   'nota_produtos': _dec(t.get('produtos')), 'nota_desconto': _dec(t.get('desconto')),
                   'nota_frete': _dec(t.get('frete')), 'nota_ipi': _dec(t.get('ipi')),
                   'nota_icms_st': _dec(t.get('icms_st')), 'nota_total': _dec(t.get('total')),
                   'nota_cfops': len(cfops), 'nota_cfop': min(cfops) if cfops else None}
            itens = n.get('itens') or []
            if not itens:
                saida.append(dict(cab, item=None, item_seq=None))
                continue
            for i, it in enumerate(itens):
                linha = dict(cab, item=it.get('item'), item_seq=i + 1)
                for k in ('produto_fornecedor', 'descricao', 'ean', 'ncm', 'cfop', 'unidade'):
                    linha[k] = it.get(k)
                for k in ('quantidade', 'valor_unitario', 'valor_total', 'desconto', 'ipi', 'icms_st'):
                    linha[k] = _dec(it.get(k))
                saida.append(linha)
        return saida

    def xmls(self, codigo, ini, fim):
        self.consultas.append(('xmls', codigo))
        saida = {}
        for n in self._notas(codigo, ini, fim):
            if n.get('xml'):
                b = n['xml'].encode('utf-8')
                saida[n['chave']] = zlib.compress(b) if n.get('xml_zlib') else b
        return saida

    def fechar(self):
        pass
