"""Teste do leitor da NF-e da ponte (ponte/nfe.py, 26/11/2026): os mesmos XMLs no leitor do PC e no importador do
sistema (assets/js/importar-xml.js, o parseXml, dentro do Chromium do harness, que tem DOMParser) — a nota e os itens
têm de sair iguais, campo a campo, pra nota que a ponte manda ser a que a importação dos XMLs gravaria.

    python tests/harness/sedif-nfe.py

Os XMLs são inventados (repositório público — nada de nota de cliente). Confere: a compra de fora do RS com o ICMS a 4%,
o ICMS10 com a ST, o fornecedor do Simples sem a alíquota, o IPI, o PIS e a Cofins; o CNPJ com letras; o destinatário
com CPF e o estrangeiro; a nota sem o destinatário, sem os totais e sem o protocolo; o nItem que falta; o dEmi da versão
antiga; os números com espaço e com casas; o texto com espaço nas pontas; o item principal pelo maior valor (o empate
fica com o primeiro); a cancelada e a denegada pelo protocolo; e o que o importador não grava como NF-e (a rejeitada pela
Sefaz, o evento, o CT-e, o MDF-e e a NFS-e), que o leitor do PC também não lê.
Termina com código 1 se alguma checagem falhar. Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import pathlib
import sys

sys.dont_write_bytecode = True
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass
AQUI = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
sys.path.insert(0, str(AQUI.parents[1]))
from conferir import montar_site, servir, SITE  # noqa: E402
from ponte import nfe  # noqa: E402
from ponte.notas.xml import Ilegivel  # noqa: E402


def chave(uf, aamm, cnpj, numero, modelo='55'):
    base = f'{uf}{aamm}{cnpj}{modelo}001{numero:09d}1{numero:08d}'
    soma, peso = 0, 2
    for c in reversed(base):
        soma += (ord(c) - 48) * peso
        peso = 2 if peso == 9 else peso + 1
    r = soma % 11
    return base + str(0 if r < 2 else 11 - r)


FORN = '33333333000133'
EMPRESA = '22222222000122'
CNPJ_ALFA = '12ABC34501DE35'


def nfe_xml(ch, corpo_ide='', emit=None, dest=None, dets='', total=None, prot='100', ns=True):
    emit = emit if emit is not None else (f'<emit><CNPJ>{FORN}</CNPJ><xNome>FORNECEDOR TESTE SA</xNome>'
                                          f'<enderEmit><xMun>JOINVILLE</xMun><UF>SC</UF></enderEmit><IE>123</IE><CRT>3</CRT></emit>')
    dest = dest if dest is not None else (f'<dest><CNPJ>{EMPRESA}</CNPJ><xNome>CLIENTE TESTE LTDA</xNome>'
                                          f'<enderDest><xMun>TRES COROAS</xMun><UF>RS</UF></enderDest><indIEDest>1</indIEDest>'
                                          f'<IE>456</IE></dest>')
    total = total if total is not None else ('<total><ICMSTot><vBC>1500.00</vBC><vICMS>100.00</vICMS><vBCST>700.00</vBCST>'
                                             '<vST>59.00</vST><vProd>1520.00</vProd><vFrete>10.00</vFrete><vDesc>5.00</vDesc>'
                                             '<vIPI>7.50</vIPI><vPIS>9.88</vPIS><vCOFINS>45.60</vCOFINS><vNF>1591.50</vNF>'
                                             '</ICMSTot></total>')
    ide = corpo_ide or ('<ide><cUF>42</cUF><natOp>VENDA DE MERCADORIA</natOp><mod>55</mod><serie>1</serie><nNF>777</nNF>'
                        '<dhEmi>2026-09-30T23:50:00-03:00</dhEmi><tpNF>1</tpNF><finNFe>1</finNFe></ide>')
    xmlns = ' xmlns="http://www.portalfiscal.inf.br/nfe"' if ns else ''
    protocolo = f'<protNFe><infProt><chNFe>{ch}</chNFe><cStat>{prot}</cStat></infProt></protNFe>' if prot else ''
    return (f'<?xml version="1.0" encoding="UTF-8"?><nfeProc{xmlns} versao="4.00"><NFe><infNFe Id="NFe{ch}" versao="4.00">'
            f'{ide}{emit}{dest}{dets}{total}</infNFe></NFe>{protocolo}</nfeProc>')


DETS = (
    '<det nItem="1"><prod><cProd> 1 </cProd><cEAN>SEM GTIN</cEAN><xProd>  SECADOR  DE CABELO </xProd><NCM>8516.31.00</NCM>'
    '<CFOP>6102</CFOP><uCom>UN</uCom><qCom> 10.0000 </qCom><vUnCom>100.0000000000</vUnCom><vProd>1000.00</vProd>'
    '<vDesc>5.00</vDesc></prod>'
    '<imposto><ICMS><ICMS00><orig>1</orig><CST>00</CST><modBC>3</modBC><vBC>1000.00</vBC><pICMS>4.0000</pICMS>'
    '<vICMS>40.00</vICMS></ICMS00></ICMS><IPI><cEnq>999</cEnq><IPITrib><CST>50</CST><vBC>1000.00</vBC><pIPI>0.75</pIPI>'
    '<vIPI>7.50</vIPI></IPITrib></IPI><PIS><PISAliq><CST>01</CST><vBC>1000.00</vBC><pPIS>0.65</pPIS><vPIS>6.50</vPIS>'
    '</PISAliq></PIS><COFINS><COFINSAliq><CST>01</CST><vBC>1000.00</vBC><pCOFINS>3.00</pCOFINS><vCOFINS>30.00</vCOFINS>'
    '</COFINSAliq></COFINS></imposto></det>'
    '<det nItem="2"><prod><cProd>2</cProd><xProd>RACAO CAES</xProd><NCM>23091000</NCM><CEST>17.011.00</CEST>'
    '<CFOP>6403</CFOP><uCom>SC</uCom><qCom>5</qCom><vUnCom>100.00</vUnCom><vProd>500.00</vProd></prod>'
    '<imposto><ICMS><ICMS10><orig>0</orig><CST>10</CST><modBC>3</modBC><vBC>500.00</vBC><pICMS>12.00</pICMS>'
    '<vICMS>60.00</vICMS><modBCST>4</modBCST><pMVAST>40.00</pMVAST><vBCST>700.00</vBCST><pICMSST>17.00</pICMSST>'
    '<vICMSST>59.00</vICMSST></ICMS10></ICMS><PIS><PISNT><CST>06</CST></PISNT></PIS><COFINS><COFINSNT><CST>06</CST>'
    '</COFINSNT></COFINS></imposto></det>'
    '<det nItem="3"><prod><cProd>3</cProd><xProd>CAIXA</xProd><NCM>48191000</NCM><CFOP>6102</CFOP><uCom>UN</uCom>'
    '<qCom>1</qCom><vUnCom>20.00</vUnCom><vProd>20.00</vProd></prod>'
    '<imposto><ICMS><ICMSSN102><orig>0</orig><CSOSN>102</CSOSN></ICMSSN102></ICMS><PIS><PISOutr><CST>99</CST>'
    '<vBC>20.00</vBC><pPIS>16.90</pPIS><vPIS>3.38</vPIS></PISOutr></PIS><COFINS><COFINSOutr><CST>99</CST><vBC>20.00</vBC>'
    '<pCOFINS>78.00</pCOFINS><vCOFINS>15.60</vCOFINS></COFINSOutr></COFINS></imposto></det>'
)
CH_SC = chave('42', '2609', FORN, 777)
CH_ALFA = chave('35', '2610', CNPJ_ALFA, 778)
CH_2 = chave('41', '2610', FORN, 779)

CASOS = {
    # a compra de SC: o ICMS a 4%, a ST e o Simples, o IPI, o PIS e a Cofins, os números com espaço e casas
    'compra de SC': nfe_xml(CH_SC, dets=DETS),
    # o CNPJ com letras no emitente e na chave, sem o namespace, e o empate no maior valor (fica o primeiro)
    'CNPJ com letras': nfe_xml(CH_ALFA, ns=False, emit=f'<emit><CNPJ>{CNPJ_ALFA[:2]}.{CNPJ_ALFA[2:5]}.{CNPJ_ALFA[5:8]}/'
                               f'{CNPJ_ALFA[8:12]}-{CNPJ_ALFA[12:]}</CNPJ><xNome>ALFA</xNome><enderEmit><UF>SP</UF>'
                               f'</enderEmit><CRT>1</CRT></emit>',
                               dets='<det nItem="1"><prod><cProd>A</cProd><xProd>X</xProd><CFOP>6102</CFOP><qCom>1</qCom>'
                                    '<vUnCom>50</vUnCom><vProd>50</vProd></prod><imposto/></det>'
                                    '<det nItem="2"><prod><cProd>B</cProd><xProd>Y</xProd><CFOP>6403</CFOP><qCom>1</qCom>'
                                    '<vUnCom>50</vUnCom><vProd>50.00</vProd></prod><imposto/></det>'),
    # o destinatário com CPF, o nItem que falta, o dEmi da versão antiga, sem o protocolo e sem os totais
    'versão antiga': nfe_xml(CH_2, corpo_ide='<ide><mod>55</mod><serie>2</serie><nNF>12</nNF><dEmi>2026-10-01</dEmi>'
                                             '<tpNF>1</tpNF></ide>',
                             dest='<dest><CPF>529.982.247-25</CPF><xNome> FULANO </xNome><enderDest><UF>RS</UF>'
                                  '</enderDest></dest>',
                             dets='<det><prod><cProd>9</cProd><xProd>Z</xProd><NCM>01</NCM><qCom></qCom>'
                                  '<vProd>abc</vProd></prod></det><det nItem="7"><prod><xProd>W</xProd><vProd>3</vProd>'
                                  '</prod></det>',
                             total='', prot=''),
    # o estrangeiro e a nota sem o destinatário
    'estrangeiro': nfe_xml(CH_2, dest='<dest><idEstrangeiro>AB123</idEstrangeiro><xNome>FOREIGN</xNome></dest>', dets=DETS),
    'sem destinatário': nfe_xml(CH_2, dest='', dets=DETS),
    # a cancelada e a denegada pelo protocolo
    'cancelada': nfe_xml(CH_SC, dets=DETS, prot='101'),
    'denegada': nfe_xml(CH_SC, dets=DETS, prot='110'),
}
FORA = {
    'rejeitada pela Sefaz': nfe_xml(CH_SC, dets=DETS, prot='204'),
    'evento': f'<procEventoNFe xmlns="http://www.portalfiscal.inf.br/nfe"><evento><infEvento><chNFe>{CH_SC}</chNFe>'
              '<tpEvento>110111</tpEvento></infEvento></evento><retEvento><infEvento><cStat>135</cStat></infEvento>'
              '</retEvento></procEventoNFe>',
    'CT-e': f'<cteProc xmlns="http://www.portalfiscal.inf.br/cte"><CTe><infCte Id="CTe{CH_SC}"><infCTeNorm><infDoc>'
            f'<infNFe><chave>{CH_SC}</chave></infNFe></infDoc></infCTeNorm></infCte></CTe></cteProc>',
    'MDF-e': f'<mdfeProc xmlns="http://www.portalfiscal.inf.br/mdfe"><MDFe><infMDFe Id="MDFe{CH_SC}"><infDoc>'
             f'<infMunDescarga><infNFe><chNFe>{CH_SC}</chNFe></infNFe></infMunDescarga></infDoc></infMDFe></MDFe></mdfeProc>',
    'NFS-e': '<NFSe xmlns="http://www.sped.fazenda.gov.br/nfse"><infNFSe Id="NFS' + '4' * 50 + '"><nNFSe>1</nNFSe>'
             '</infNFSe></NFSe>',
    'chave inválida': nfe_xml(CH_SC[:40] + 'ABCD', dets=DETS),
}

NO_NAVEGADOR = r'''
async (x) => {
  const { parseXml } = await import('/assets/js/importar-xml.js');
  const saida = {};
  for (const [nome, xml] of Object.entries(x)) {
    try { saida[nome] = parseXml(xml, 'teste.xml'); } catch (e) { saida[nome] = { kind: 'erro', motivo: e.message }; }
  }
  return saida;
}
'''

falhas = 0


def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond:
        falhas += 1


def iguais(a, b):
    """O mesmo valor nos dois lados: None com None, número com número (1 e 1.0 são o mesmo), texto com texto."""
    if a is None or b is None:
        return a is None and b is None
    if isinstance(a, bool) or isinstance(b, bool):
        return a is b
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return a == b
    return a == b


def diferencas(js, py):
    out = []
    for k in sorted(set(js) | set(py)):
        if k not in js or k not in py:
            out.append(f'{k}: só de um lado')
        elif not iguais(js[k], py[k]):
            out.append(f'{k}: {js[k]!r} × {py[k]!r}')
    return out


def main():
    from playwright.sync_api import sync_playwright
    montar_site()
    (SITE / '_parser.html').write_text('<!DOCTYPE html><meta charset="utf-8"><title>parser</title>', encoding='utf-8')
    srv, porta = servir()
    erros = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        p = b.new_page()
        p.on('pageerror', lambda e: erros.append(str(e)))
        p.goto(f'http://127.0.0.1:{porta}/_parser.html')
        js = p.evaluate(NO_NAVEGADOR, {**CASOS, **FORA})
        b.close()
    srv.shutdown()

    print('As notas que o importador grava saem iguais do leitor do PC:')
    for nome, xml in CASOS.items():
        r = js[nome]
        try:
            py = nfe.ler(xml.encode('utf-8'))
        except Ilegivel as e:
            ok(False, f'{nome}: o leitor do PC não leu ({e})')
            continue
        if r.get('kind') != 'nfe':
            ok(False, f'{nome}: o importador não leu como NF-e ({r.get("kind")}: {r.get("motivo")})')
            continue
        doc_js = {k: v for k, v in r['doc'].items() if k not in ('chave', 'xml_nome')}
        dd = diferencas(doc_js, py['doc'])
        ok(py['chave'] == r['doc']['chave'] and not dd, f'{nome}: a chave e a nota' + (f' — {"; ".join(dd)}' if dd else ''))
        di = [] if len(r['itens']) == len(py['itens']) else [f'{len(r["itens"])} × {len(py["itens"])} itens']
        for a, c in zip(r['itens'], py['itens']):
            di += [f'item {a.get("n_item")}: {d}' for d in diferencas(a, c)]
        ok(not di, f'{nome}: os {len(py["itens"])} itens, campo a campo' + (f' — {"; ".join(di[:6])}' if di else ''))

    print('\nO que o importador não grava como NF-e o leitor do PC também não lê:')
    for nome, xml in FORA.items():
        r = js[nome]
        try:
            nfe.ler(xml.encode('utf-8'))
            lido = True
        except Ilegivel:
            lido = False
        ok(r.get('kind') != 'nfe' and not lido, f'{nome}: o importador "{r.get("kind")}", o leitor do PC não leu')

    print('\nO que a conferência usa, no caso da compra de SC:')
    py = nfe.ler(CASOS['compra de SC'].encode('utf-8'))
    a, s, c = py['itens']
    ok(a['icms_aliquota'] == 4 and a['icms_base'] == 1000 and a['icms_valor'] == 40 and a['ipi_valor'] == 7.5,
       'o item a 4%: a alíquota, a base, o ICMS e o IPI')
    ok(s['icms_st_base'] == 700 and s['icms_st_valor'] == 59 and s['cest'] == '1701100', 'o item com ST: a base, o valor e o CEST')
    ok(c['icms_aliquota'] is None and c['icms_base'] is None and c['csosn'] == '102', 'o fornecedor do Simples: sem a alíquota (nulo)')
    ok(py['doc']['emit_uf'] == 'SC' and py['doc']['dest_doc'] == EMPRESA and py['doc']['data_emissao'] == '2026-09-30'
       and py['doc']['cfop_principal'] == '6102', 'o emitente, o destinatário, a emissão no dia do XML e o CFOP principal')
    ok(nfe.LEITOR == '1', 'a versão do leitor (muda quando o que sai daqui muda: a ponte manda de novo)')
    for e in erros:
        ok(False, 'erro de JavaScript: ' + e)
    print(f'\n{falhas} FALHA(S)' if falhas else '\nTudo certo.')
    sys.exit(1 if falhas else 0)


if __name__ == '__main__':
    main()
