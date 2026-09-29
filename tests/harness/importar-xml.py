"""Teste do parser de notas (assets/js/importar-xml.js) — dentro do Chromium do harness, que tem DOMParser.

    python tests/harness/importar-xml.py

Antes este teste era `tests/importar-xml.test.mjs` e vivia pulado: o Node não tem DOMParser e o CLAUDE.md
não permite npm (o `linkedom` nunca vai estar instalado). Aqui ele roda de verdade, no mesmo navegador
que o `conferir.py` usa, com os mesmos XMLs inventados (repositório público — nada de nota de cliente).

Confere: NF-e autorizada (chave, emitente/destinatário, status, CFOP, valor, item), NF-e rejeitada,
evento de cancelamento (homologado e não homologado), NFS-e do padrão nacional, DPS solta, CT-e e
XML mal formado. Termina com código 1 se alguma checagem falhar.
Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, pathlib
sys.dont_write_bytecode = True
try: sys.stdout.reconfigure(encoding='utf-8')   # o ✓/✗ não passa no console padrão do Windows
except Exception: pass
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir, SITE

CHAVE = ('43260900000000000000550010000012345000012345'.ljust(44, '0'))[:44]
CHAVE_NFSE = '4321501' + '2' * 43

NFE = f'''<?xml version="1.0"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
<NFe><infNFe Id="NFe{CHAVE}" versao="4.00">
<ide><cUF>43</cUF><nNF>12345</nNF><serie>1</serie><dhEmi>2026-07-10T10:00:00-03:00</dhEmi><tpNF>1</tpNF><finNFe>1</finNFe></ide>
<emit><CNPJ>11111111000111</CNPJ><xNome>EMPRESA TESTE LTDA</xNome><enderEmit><UF>RS</UF><cMun>4321501</cMun></enderEmit><CRT>1</CRT></emit>
<dest><CNPJ>22222222000122</CNPJ><xNome>CLIENTE TESTE SA</xNome><enderDest><UF>SP</UF></enderDest></dest>
<det nItem="1"><prod><cProd>1</cProd><xProd>PECA</xProd><NCM>84129000</NCM><CFOP>6102</CFOP><uCom>UN</uCom><qCom>2</qCom><vUnCom>50.00</vUnCom><vProd>100.00</vProd></prod><imposto></imposto></det>
<total><ICMSTot><vProd>100.00</vProd><vNF>100.00</vNF></ICMSTot></total>
</infNFe></NFe>
<protNFe><infProt><chNFe>{CHAVE}</chNFe><cStat>100</cStat></infProt></protNFe></nfeProc>'''

EVENTO = f'''<procEventoNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><evento><infEvento><chNFe>{CHAVE}</chNFe><tpEvento>110111</tpEvento></infEvento></evento><retEvento><infEvento><cStat>135</cStat></infEvento></retEvento></procEventoNFe>'''

NFSE = f'''<?xml version="1.0"?><NFSe xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00"><infNFSe Id="NFS{CHAVE_NFSE}">
<xLocEmi>PAROBE</xLocEmi><nNFSe>500</nNFSe><dhProc>2026-08-05T09:00:00-03:00</dhProc>
<emit><CNPJ>11111111000111</CNPJ><xNome>EMPRESA TESTE LTDA</xNome><enderNac><UF>RS</UF></enderNac></emit>
<DPS><infDPS><dhEmi>2026-08-05T09:00:00-03:00</dhEmi><prest><CNPJ>11111111000111</CNPJ></prest><toma><CNPJ>22222222000122</CNPJ><xNome>CLIENTE TESTE SA</xNome><end><endNac><UF>SP</UF></endNac></end></toma>
<serv><xDescServ>MANUTENCAO</xDescServ></serv><valores><vServPrest><vServ>1500.00</vServ></vServPrest></valores></infDPS></DPS>
<valores><vLiq>1500.00</vLiq></valores></infNFSe></NFSe>'''

# mesma nota, agora com desconto incondicional (100) e condicional (50): a receita bruta cai só o
# incondicional. Faltava no teste antigo — sem desconto, trocar o sinal da conta não muda nada.
NFSE_DESC = NFSE.replace('<vServPrest><vServ>1500.00</vServ></vServPrest>',
                         '<vServPrest><vServ>1500.00</vServ></vServPrest><vDescIncond>100.00</vDescIncond><vDescCond>50.00</vDescCond>')

# as mesmas checagens do .mjs antigo, agora rodando no navegador
CHECAGENS = r'''
async (x) => {
  const { parseXml } = await import('/assets/js/importar-xml.js');
  const saida = [];
  const ok = (c, m) => saida.push({ ok: !!c, msg: m });
  const tit = t => saida.push({ titulo: t });

  tit('NF-e autorizada:');
  const r1 = parseXml(x.nfe, 'nfe.xml');
  ok(r1.kind === 'nfe', 'reconhece como NF-e');
  if (r1.kind === 'nfe') {
    ok(r1.doc.chave === x.chave, 'lê a chave de acesso');
    ok(r1.doc.emit_doc === '11111111000111' && r1.doc.dest_doc === '22222222000122', 'emitente e destinatário');
    ok(r1.doc.status === 'autorizada', 'status autorizada pelo cStat 100');
    ok(r1.doc.cfop_principal === '6102', 'CFOP principal');
    ok(Math.abs(r1.doc.valor_total - 100) < 0.005, 'valor total');
    ok(r1.itens.length === 1 && r1.itens[0].ncm === '84129000', 'um item com NCM');
  }

  tit('NF-e rejeitada:');
  const r2 = parseXml(x.nfe.replace('<cStat>100</cStat>', '<cStat>204</cStat>'), 'rej.xml');
  ok(r2.kind === 'ignorado' && /cStat 204/.test(r2.motivo), 'cStat 204 é ignorada, com o motivo');

  tit('Evento de cancelamento:');
  const r3 = parseXml(x.evento, 'ev.xml');
  ok(r3.kind === 'evento' && r3.cancel && r3.homologado && r3.chave === x.chave, 'cancelamento homologado (135) com a chave');
  const r3b = parseXml(x.evento.replace('<cStat>135</cStat>', '<cStat>573</cStat>'), 'ev2.xml');
  ok(r3b.kind === 'evento' && r3b.cancel && !r3b.homologado, 'evento sem homologação não cancela');

  tit('NFS-e padrão nacional:');
  const r4 = parseXml(x.nfse, 'nfse.xml');
  ok(r4.kind === 'nfse' && r4.lista.length === 1, 'reconhece a NFS-e nacional');
  if (r4.kind === 'nfse') {
    const d = r4.lista[0].doc;
    ok(d.modelo === 'nfse', 'modelo nfse');
    ok(d.emit_doc === '11111111000111' && d.dest_doc === '22222222000122', 'prestador e tomador');
    ok(Math.abs(d.valor_total - 1500) < 0.005, 'valor do serviço');
  }
  const r5 = parseXml(x.nfseDesc, 'nfse-desc.xml');
  if (r5.kind === 'nfse') {
    const d = r5.lista[0].doc;
    ok(Math.abs(d.valor_total - 1400) < 0.005, 'com desconto: a receita bruta desconta só o incondicional (1500 − 100)');
    ok(Math.abs(d.valor_desconto - 150) < 0.005, 'com desconto: o desconto registrado soma os dois (100 + 50)');
  } else ok(false, 'com desconto: reconhece a NFS-e');

  tit('Outros:');
  ok(parseXml('<DPS xmlns="http://www.sped.fazenda.gov.br/nfse"><infDPS></infDPS></DPS>', 'dps.xml').kind === 'ignorado', 'DPS solta é ignorada');
  ok(parseXml('<cteProc xmlns="http://www.portalfiscal.inf.br/cte"><CTe><infCte/></CTe></cteProc>', 'cte.xml').motivo === 'CT-e', 'CT-e é ignorado com o motivo');
  // no navegador o DOMParser gera <parsererror> e o parser lança
  let mal = null;
  try { mal = parseXml('<a><b></a>', 'x.xml'); } catch (e) { mal = { kind: 'erro', motivo: e.message }; }
  ok(mal.kind === 'erro' && /mal formado/.test(mal.motivo), 'XML mal formado vira erro "mal formado"');
  return saida;
}
'''

def main():
    from playwright.sync_api import sync_playwright
    montar_site()
    # página vazia só pra ter uma origem http e poder importar o módulo (fica só na cópia do harness)
    (SITE / '_parser.html').write_text('<!DOCTYPE html><meta charset="utf-8"><title>parser</title>', encoding='utf-8')
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    erros = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        p = b.new_page()
        p.on('pageerror', lambda e: erros.append(str(e)))
        p.goto(base + '_parser.html')
        linhas = p.evaluate(CHECAGENS, { 'nfe': NFE, 'evento': EVENTO, 'nfse': NFSE, 'nfseDesc': NFSE_DESC, 'chave': CHAVE })
        b.close()
    srv.shutdown()

    falhas = 0
    for l in linhas:
        if 'titulo' in l:
            print('\n' + l['titulo'])
        else:
            print(('  ✓ ' if l['ok'] else '  ✗ ') + l['msg'])
            if not l['ok']: falhas += 1
    for e in erros:
        print('  ✗ erro de JavaScript: ' + e); falhas += 1
    print(f'\n{falhas} FALHA(S)' if falhas else '\nTudo certo.')
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
