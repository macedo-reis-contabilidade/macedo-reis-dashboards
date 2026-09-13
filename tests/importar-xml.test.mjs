// Teste do parser de notas (assets/js/importar-xml.js).
// Rodar com: node tests/importar-xml.test.mjs
//
// O parser usa DOMParser, que o Node não tem. Se o pacote `linkedom` estiver
// instalado, o teste roda com ele; senão, é pulado sem falhar.
// XMLs abaixo são inventados e mínimos — este repositório é público.

let DP = globalThis.DOMParser;
if (!DP) { try { ({ DOMParser: DP } = await import('linkedom')); } catch (e) { console.log('pulado: instale linkedom para rodar este teste (npm i linkedom)'); process.exit(0); } }
globalThis.DOMParser = DP;

const { parseXml } = await import('../assets/js/importar-xml.js');

let falhas = 0;
const ok = (c, m) => { if (!c) { falhas++; console.error('  ✗ ' + m); } else console.log('  ✓ ' + m); };

const chave = '43260900000000000000550010000012345000012345'.padEnd(44, '0').slice(0, 44);
const nfe = `<?xml version="1.0"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
<NFe><infNFe Id="NFe${chave}" versao="4.00">
<ide><cUF>43</cUF><nNF>12345</nNF><serie>1</serie><dhEmi>2026-07-10T10:00:00-03:00</dhEmi><tpNF>1</tpNF><finNFe>1</finNFe></ide>
<emit><CNPJ>11111111000111</CNPJ><xNome>EMPRESA TESTE LTDA</xNome><enderEmit><UF>RS</UF><cMun>4321501</cMun></enderEmit><CRT>1</CRT></emit>
<dest><CNPJ>22222222000122</CNPJ><xNome>CLIENTE TESTE SA</xNome><enderDest><UF>SP</UF></enderDest></dest>
<det nItem="1"><prod><cProd>1</cProd><xProd>PECA</xProd><NCM>84129000</NCM><CFOP>6102</CFOP><uCom>UN</uCom><qCom>2</qCom><vUnCom>50.00</vUnCom><vProd>100.00</vProd></prod><imposto></imposto></det>
<total><ICMSTot><vProd>100.00</vProd><vNF>100.00</vNF></ICMSTot></total>
</infNFe></NFe>
<protNFe><infProt><chNFe>${chave}</chNFe><cStat>100</cStat></infProt></protNFe></nfeProc>`;

console.log('NF-e autorizada:');
const r1 = parseXml(nfe, 'nfe.xml');
ok(r1.kind === 'nfe', 'reconhece como NF-e');
if (r1.kind === 'nfe') {
  ok(r1.doc.chave === chave, 'lê a chave de acesso');
  ok(r1.doc.emit_doc === '11111111000111' && r1.doc.dest_doc === '22222222000122', 'emitente e destinatário');
  ok(r1.doc.status === 'autorizada', 'status autorizada pelo cStat 100');
  ok(r1.doc.cfop_principal === '6102', 'CFOP principal');
  ok(Math.abs(r1.doc.valor_total - 100) < 0.005, 'valor total');
  ok(r1.itens.length === 1 && r1.itens[0].ncm === '84129000', 'um item com NCM');
}

console.log('\nNF-e rejeitada:');
const r2 = parseXml(nfe.replace('<cStat>100</cStat>', '<cStat>204</cStat>'), 'rej.xml');
ok(r2.kind === 'ignorado' && /cStat 204/.test(r2.motivo), 'cStat 204 é ignorada, com o motivo');

console.log('\nEvento de cancelamento:');
const evento = `<procEventoNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><evento><infEvento><chNFe>${chave}</chNFe><tpEvento>110111</tpEvento></infEvento></evento><retEvento><infEvento><cStat>135</cStat></infEvento></retEvento></procEventoNFe>`;
const r3 = parseXml(evento, 'ev.xml');
ok(r3.kind === 'evento' && r3.cancel && r3.homologado && r3.chave === chave, 'cancelamento homologado (135) com a chave');
const r3b = parseXml(evento.replace('<cStat>135</cStat>', '<cStat>573</cStat>'), 'ev2.xml');
ok(r3b.kind === 'evento' && r3b.cancel && !r3b.homologado, 'evento sem homologação não cancela');

console.log('\nNFS-e padrão nacional:');
const chNfse = '4321501' + '2'.repeat(43);
const nfse = `<?xml version="1.0"?><NFSe xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00"><infNFSe Id="NFS${chNfse}">
<xLocEmi>PAROBE</xLocEmi><nNFSe>500</nNFSe><dhProc>2026-08-05T09:00:00-03:00</dhProc>
<emit><CNPJ>11111111000111</CNPJ><xNome>EMPRESA TESTE LTDA</xNome><enderNac><UF>RS</UF></enderNac></emit>
<DPS><infDPS><dhEmi>2026-08-05T09:00:00-03:00</dhEmi><prest><CNPJ>11111111000111</CNPJ></prest><toma><CNPJ>22222222000122</CNPJ><xNome>CLIENTE TESTE SA</xNome><end><endNac><UF>SP</UF></endNac></end></toma>
<serv><xDescServ>MANUTENCAO</xDescServ></serv><valores><vServPrest><vServ>1500.00</vServ></vServPrest></valores></infDPS></DPS>
<valores><vLiq>1500.00</vLiq></valores></infNFSe></NFSe>`;
const r4 = parseXml(nfse, 'nfse.xml');
ok(r4.kind === 'nfse' && r4.lista.length === 1, 'reconhece a NFS-e nacional');
if (r4.kind === 'nfse') {
  const d = r4.lista[0].doc;
  ok(d.modelo === 'nfse', 'modelo nfse');
  ok(d.emit_doc === '11111111000111' && d.dest_doc === '22222222000122', 'prestador e tomador');
  ok(Math.abs(d.valor_total - 1500) < 0.005, 'valor do serviço');
}

console.log('\nOutros:');
ok(parseXml('<DPS xmlns="http://www.sped.fazenda.gov.br/nfse"><infDPS></infDPS></DPS>', 'dps.xml').kind === 'ignorado', 'DPS solta é ignorada');
ok(parseXml('<cteProc xmlns="http://www.portalfiscal.inf.br/cte"><CTe><infCte/></CTe></cteProc>', 'cte.xml').motivo === 'CT-e', 'CT-e é ignorado com o motivo');
// no navegador o DOMParser gera <parsererror> e o parser lança; o linkedom é tolerante e o
// XML cai em "não reconhecido". Nos dois casos a nota não entra — é isso que importa.
let saida = null; try { saida = parseXml('<a><b></a>', 'x.xml'); } catch (e) { saida = { kind: 'erro', motivo: e.message }; }
ok(saida.kind === 'erro' ? /mal formado/.test(saida.motivo) : saida.kind === 'ignorado', 'XML mal formado não vira nota (erro ou ignorado)');

console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
