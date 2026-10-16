// Teste da análise técnica da Reforma: o texto certo pro perfil certo (varejo PF, prestador B2B) e o empate técnico.
// Rodar com: node tests/rt-analise.test.mjs — casos sintéticos, sem dado de cliente.
import fs from 'fs';
import { simular } from '../assets/js/rt-motor.js';
import { gerarAnalise } from '../assets/js/rt-analise.js';
const page = fs.readFileSync(new URL('../fiscal-reforma.html', import.meta.url), 'utf8');
const i = page.indexOf('    function montarDadosAnalise('); const j = page.indexOf("\n    $('dGerar').onclick");
const src = page.slice(i, j);
import { perfilAtividade, cnaeMaisCompleto, ramoComReducao, ramoComZero, reducaoServicoPorCnae, conferirRbt12, CREDITO_FORNECEDOR_SIMPLES } from '../assets/js/dominio-relatorios.js';
import { RT_PRAZO, janelaAberta as janelaAbertaEm } from '../assets/js/rt-prazos.js';
import { avaliarConfianca, inferirProcedencia, decisaoDe, ROT_DECISAO } from '../assets/js/rt-confianca.js';
// o escapeHtml da página (fiscal-reforma.html), o mesmo: o nome do maior cliente vem das notas e entra na análise como texto
const escapeHtml = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const montarDadosAnalise = new Function('simular', 'ANO_XML', 'location', 'perfilAtividade', 'cnaeMaisCompleto', 'ramoComReducao', 'ramoComZero', 'reducaoServicoPorCnae', 'conferirRbt12', 'RT_PRAZO', 'janelaAbertaEm', 'CREDITO_FORNECEDOR_SIMPLES', 'avaliarConfianca', 'inferirProcedencia', 'decisaoDe', 'ROT_DECISAO', 'escapeHtml', src + '\nreturn montarDadosAnalise;')(simular, 2026, { href: 'http://x/' }, perfilAtividade, cnaeMaisCompleto, ramoComReducao, ramoComZero, reducaoServicoPorCnae, conferirRbt12, RT_PRAZO, janelaAbertaEm, CREDITO_FORNECEDOR_SIMPLES, avaliarConfianca, inferirProcedencia, decisaoDe, ROT_DECISAO, escapeHtml);
// data fixa dentro da janela (até 30/10/2026, Res. CGSN 194/2026): o teste não pode depender do relógio de quem roda
// (os casos que testam a janela fechada fixam globalThis.__HOJE_ISO__ antes de chamar)
// proc: a procedência gravada com a simulação (13/10/2026); sem ela a análise deduz do resumo do Domínio (simulação antiga)
function caso(nome, ent, dom, xml, cnae, hojeISO = globalThis.__HOJE_ISO__ || '2026-09-29', proc = null) {
  const sim = simular(ent);
  const antes = globalThis.__HOJE_ISO__;
  globalThis.__HOJE_ISO__ = hojeISO;
  const d = montarDadosAnalise({ id: 1, cnae_base: cnae || null }, { nome_principal: nome, documento: '00000000000000' }, ent, sim, dom, xml, proc);
  if (antes === undefined) delete globalThis.__HOJE_ISO__; else globalThis.__HOJE_ISO__ = antes;
  d.hojeISO = hojeISO;
  const html = gerarAnalise(d);
  const txt = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  return { sim, d, txt, args: [nome, ent, dom, xml, cnae] };
}
// 1) Varejo PF em empate técnico: 2,6% PJ pelas saídas XLS, sem XML, alíquota do PGDAS com 8,5% do DAS excluído.
//    Compras em 79,5% da receita (eram 83,29%, depois 82%): com a exclusão aplicada uma vez só (02/10/2026) e o ICMS do
//    DAS fora da base do débito por fora (12/10/2026) a vantagem de por fora passava do limiar e o caso deixava de ser
//    empate — o teste é do texto do empate, não desses números
let falhas = 0;
const chk = (rot, ok) => { if (!ok) falhas++; console.log((ok ? '  ✓ ' : '  ✗ ') + rot); };
// procedência de um caso todo medido: 8 meses de faturamento, entradas e saídas (CNPJ e regime dos clientes consultado) e,
// desde 14/10/2026, o imposto embutido nas compras medido nas notas de compra
const M8 = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'];
const PROC_MEDIDO = { receita: { fonte: 'faturamento', meses: M8 }, rbt12: { fonte: 'pgdas', meses: ['2026-08'] }, anexo: { fonte: 'pgdas', meses: ['2026-08'] },
  pctMerc: { fonte: 'entradas', meses: M8, mesesFaturamento: 8, regimeFornecedores: true }, pctDesp: { fonte: 'entradas', meses: M8, mesesFaturamento: 8, regimeFornecedores: true },
  pctPJ: { fonte: 'saidas', meses: M8, porDocumento: true, regimeConsultado: true }, mix: { fonte: 'padrao' }, pctEmb: { fonte: 'notas', meses: M8, notas: 120 } };
const vn = caso('VAREJO TESTE', { anexo:'I', rbt12:2484930.98, receita:205256.49, mixCheia:100, pctComprasMercadorias:79.5, pctComprasDespesas:2.35, pctImpostoEmbutido:0, pctExcluidoST:8.5, partilha:15.5, cbs:9.3, ibs:0.1, pctPJ:2.6, aliqEfetivaInformada:9.87 },
  { faturamento: { total: 1642051.92, servicos: 0, saidas: 1642051.92 }, periodoRotulo: 'jan/26–ago/26', pgdas: { competencia: '2026-08', dasTotal: 22003.93, cbsNoDas: 3718, aliquotaEfetiva: 9.87 }, vendas: { total: 1642051.92, mercadorias: 1642051.92, servicos: 0, st: 0, pctPJ: 2.6, pj: 42693, pf: 60000, consumidor: 1539358, nPJ: 31, fonte: 'acompanhamento de saídas (Domínio), PJ pelo CNPJ do cliente' } }, null, '4789-0/04', undefined, PROC_MEDIDO);
console.log('Varejo PF:'); chk('veredito MANTENHA/empate', vn.sim.veredito.tipo === 'MANTENHA' && vn.sim.veredito.empate);
// 13/10/2026: ramo com redução (pet shop) sem as notas de venda — metade das vendas com −60% tira o caso do empate: o mix
// não foi medido, então não há conclusão
chk('mix não medido que tira do empate: SEM CONCLUSÃO', vn.d.semConclusao && vn.d.confianca.decisivos.some(i => i.chave === 'mix') && /SEM CONCLUSÃO — FALTAM DADOS/.test(vn.txt) && /Sem recomendação por enquanto/.test(vn.txt));
chk('sem conclusão: diz o que falta (as notas de venda)', vn.d.confianca.faltam.some(f => /notas de venda/.test(f)) && /Para concluir, precisamos de:/.test(vn.txt));
chk('sem conclusão: a conta aparece como provisória, sem lado recomendado', /conta provisória/.test(vn.txt) && !/✓ recomendado/.test(vn.txt));
// a seção 4 também não recomenda (antes marcava o lado "por dentro", escrevia "recomendado (empate técnico)" e "não vale trocar")
chk('sem conclusão: a seção 4 não marca lado nem diz "recomendado"', !/class="ret win"/.test(gerarAnalise(vn.d)) && !/recomendado \(empate técnico\)/.test(vn.txt) && !/Com essa margem, não vale trocar a apuração/.test(vn.txt) && /nenhum dos dois caminhos está recomendado/.test(vn.txt));
chk('sem conclusão: a seção 6 diz que o mix muda (o mesmo critério da seção 7)', /Sim — com redução nas vendas o resultado muda/.test(vn.txt) && /Sem conclusão: mix das vendas \(não medido\)/.test(vn.d.sensibilidadeNota));
// a mesma simulação gravada antes de 13/10/2026 (sem a procedência): o mix 100% cheio pode ter vindo das notas — não ficou
// registrado; fica a confirmar, e diz isso
const vnL = caso(...vn.args);
const mixL = vnL.d.confianca.itens.find(i => i.chave === 'mix');
chk('simulação antiga: mix de origem não registrada, a confirmar (não "sem conclusão")', !vnL.d.semConclusao && mixL.nivel === 'media' && /Simulação anterior — origem não registrada/.test(vnL.txt) && /TENDÊNCIA — A CONFIRMAR/.test(vnL.txt));
// o relatório do cliente não fala da ficha nem da "simulação anterior": é "levantamento anterior do escritório"
const vnLc = gerarAnalise(vnL.d, { versao: 'cliente' }).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
chk('relatório do cliente da simulação antiga: sem "Simulação anterior", "ficha" nem "não ficou registrado"', !/Simulação anterior|na ficha|não ficou registrad/i.test(vnLc) && /levantamento anterior do escritório/i.test(vnLc));
// sem conclusão em empate: a conta provisória diz por que daria "manter" mesmo com por fora mais barato
chk('sem conclusão em empate: diz que a diferença é pequena demais (empate técnico)', /por fora sairia R\$ [\d.]+ mais barato no semestre, diferença pequena demais pra justificar a troca — empate técnico/.test(vn.txt));
// as notas que estão na base hoje, mas que a simulação não usou: o mix continua "não medido" na seção 6 e nas regras
const vnX = caso('VAREJO TESTE', vn.args[1], vn.args[2], { nNotas: 5000, pctPJ: 2.6, periodoRotulo: 'jan–ago/2026' }, '4789-0/04', undefined, PROC_MEDIDO);
const sMixX = vnX.d.sensibilidade.find(x => x.nome === 'Mix das vendas');
chk('notas na base que a simulação não usou: seção 6, regras e seção 7 dizem "não medido"', /^não medido/.test(sMixX.hoje) && /^Sim/.test(sMixX.muda) && vnX.d.fontes.some(f => /a simulação não usou as 5000 notas da base/.test(f.origem)) && vnX.d.semConclusao);
// mix 100% cheio digitado à mão, ramo com redução, empate: nada de "mesmo com metade das vendas com desconto, não muda"
const vnD = caso('VAREJO TESTE', vn.args[1], vn.args[2], null, '4789-0/04', undefined, { ...PROC_MEDIDO, mix: { fonte: 'manual' } });
const mixD = vnD.d.confianca.itens.find(i => i.chave === 'mix');
chk('mix digitado tudo cheio num ramo com redução: testado (média), a confirmar — sem a frase "a recomendação não muda"', mixD.nivel === 'media' && mixD.muda && !vnD.d.observacoes.some(o => /a recomendação não muda/.test(o)) && /informado na ficha/.test(vnD.d.sensibilidade.find(x => x.nome === 'Mix das vendas').hoje));
const vnF = caso('VAREJO TESTE', vn.args[1], vn.args[2], null, '4754-7/01', undefined, PROC_MEDIDO);
chk('varejo de ramo sem redução, tudo medido: confiança firme', vnF.d.confianca.conclusao === 'firme' && !vnF.d.semConclusao);
chk('recomendação de empate', /empate técnico, não formalizar/i.test(vnF.txt));
chk('seção 2 pelo Domínio (pessoa física)', /pessoa física ou consumidor não identificado/.test(vn.txt));
chk('sem "hora técnica"', !/hora técnica/.test(vn.txt));
chk('sem ISS retido', !/ISS retido/.test(vn.txt));
chk('sem "Serviço não consta"', !/Serviço não consta/.test(vn.txt));
chk('sem "multiplicar o crédito"', !/multiplicar o crédito/.test(vn.txt));
chk('sem repasse que inverte', !/A variável que inverte/.test(vn.txt));
chk('pergunta de fornecedores', /fornecedores/.test(vn.txt));
chk('mix a conferir', /assumido integralmente cheio/.test(vn.txt) && /Sem as notas de venda, tudo foi considerado sem desconto/.test(vn.txt));
// 2) Prestador B2B (regra antiga preservada)
const pb = caso('SERVIÇOS TESTE', { anexo:'III', rbt12:1200000, receita:100000, mixCheia:100, pctComprasMercadorias:5, pctComprasDespesas:5, pctImpostoEmbutido:0, pctExcluidoST:0, partilha:15.5, cbs:9.3, ibs:0.1, pctPJ:95 },
  { faturamento: { total: 800000, servicos: 800000, saidas: 0 }, periodoRotulo: 'jan/26–ago/26' }, null);
console.log('Prestador B2B:'); chk('veredito ' + pb.sim.veredito.tipo, true);
chk('repasse ainda é a variável', /A variável que inverte|repasse/i.test(pb.txt));
chk('hora técnica presente', /hora técnica/.test(pb.txt));
chk('ISS presente', /ISS retido/.test(pb.txt));
// 4) Varejo com entradas acima da receita (caso "compras = vendas"): tendência a confirmar, sem contradição.
//    Imposto embutido de 5% nas compras (era 0): com o ICMS do DAS fora da base do débito (12/10/2026), sem embutido o
//    crédito 20% menor já não invertia — o teste é do revisor, que precisa de um caso que inverte
const vr = caso('MOVEIS TESTE', { anexo:'I', rbt12:1133527.31, receita:59311.38, mixCheia:100, pctComprasMercadorias:100, pctComprasDespesas:4, pctImpostoEmbutido:5, pctExcluidoST:0, partilha:15.5, cbs:9.3, ibs:0.1, pctPJ:2.2, aliqEfetivaInformada:8.72 },
  { faturamento: { total: 474491.04, servicos: 0, saidas: 474491.04 }, periodoRotulo: 'jan/26–ago/26', vendas: { total: 482844.13, mercadorias: 482844.13, servicos: 0, st: 0, pctPJ: 2.2, pj: 10622, pf: 0, consumidor: 472222, nPJ: 5, fonte: 'acompanhamento de saídas (Domínio), PJ pelo CNPJ do cliente' } }, null);
console.log('Varejo com compras ≥ vendas:'); chk('veredito OPTE (' + vr.sim.veredito.tipo + ')', vr.sim.veredito.tipo === 'OPTE');
chk('recomendação vira "tendência — a confirmar"', /Tendência: .*a confirmar/.test(vr.txt));
chk('alerta de compras × vendas', /compra quase o mesmo/.test(vr.txt));
chk('aponta o que inverte (crédito 20% menor)', /crédito das entradas 20% menor/.test(vr.txt));
chk('sem "Nenhuma incerteza técnica isolada derruba"', !/Nenhuma incerteza técnica isolada derruba/.test(vr.txt));
chk('seção 10 sem "nenhum deles inverte"', !/nenhum deles inverte/.test(vr.txt));
chk('linha "Base creditável" marca que muda', /Sim — com outro crédito de entrada o resultado muda/.test(vr.txt));
chk('alerta diz o resultado novo ("passa a ser"), não "se inverte"', /o resultado passa a ser “manter dentro do DAS”/.test(vr.txt) && !/o resultado se inverte/.test(vr.txt));
chk('dica do cancelamento de 03/11 a 20/12', /cancelá-la de 03\/11 a 20\/12\/2026/.test(vr.txt));
// 01/10/2026: pela Res. CGSN 194/2026 a janela vai até 30/10 — a análise não pode dizer que fechou (dizia, até 02/10)
const vrO = caso(...vr.args, '2026-10-01');
chk('01/10: janela ainda aberta, prazo 30/10/2026', /formalizada até 30\/10\/2026/.test(vrO.txt) && !/fechou/.test(vrO.txt));
// o mesmo varejo gerado depois da janela (31/10/2026): o prazo vira "fechou" e some a dica de cancelar
const vrF = caso(...vr.args, '2026-10-31');
chk('janela fechada: prazo diz que fechou em 30/10', /fechou em 30\/10\/2026/.test(vrF.txt));
chk('janela fechada: sem a dica de cancelar de 03/11 a 20/12', !/cancelá-la de 03\/11 a 20\/12\/2026/.test(vrF.txt));
// 5) caso limpo continua firme (prestador B2B sem alertas) — com tudo medido, inclusive o regime dos clientes
const pbM = caso(...pb.args, undefined, { ...PROC_MEDIDO, mix: { fonte: 'padrao' } });
chk('caso sem dado suspeito não vira "a confirmar" (' + pbM.d.alertas.length + ' alerta)', pbM.d.aConfirmar === false && !/Tendência:/.test(pbM.txt) && pbM.d.confianca.conclusao === 'firme');
// o % de PJ digitado na ficha (sem relatório): confiança média — se a faixa plausível muda o resultado, a confirmar
chk('% de PJ de simulação antiga que muda o resultado: a confirmar, origem não registrada', pb.d.confianca.conclusao === 'a_confirmar' && pb.d.alertas.some(a => /^Vendas a clientes que aproveitam o crédito/.test(a.texto) && /Simulação anterior — origem não registrada/.test(a.texto) && a.muda) && !pb.d.semConclusao);
const pbD = caso(...pb.args, undefined, { ...PROC_MEDIDO, pctPJ: { fonte: 'manual' } });
chk('% de PJ digitado que muda o resultado: a confirmar, "Informado, sem relatório"', pbD.d.confianca.conclusao === 'a_confirmar' && pbD.d.alertas.some(a => /^Vendas a clientes que aproveitam o crédito/.test(a.texto) && /Informado, sem relatório/.test(a.texto) && a.muda));
// a nota da seção 6 e a das pendências também dizem que o % de PJ muda o resultado (antes: "nenhuma incerteza isolada derruba")
chk('nota da seção 6 e das pendências: o número a confirmar entra', /^Atenção: o resultado muda com vendas a clientes que aproveitam o crédito \(confiança média\)/.test(pbD.d.sensibilidadeNota) && /^Em ordem de valor\. Podem inverter a recomendação/.test(pbD.d.pendenciasNota));
// o único número fraco já está nos alertas: o bloco "Com que segurança" não pode dizer que tudo é confiança alta
chk('"Com que segurança" não diz "confiança alta" quando há número a confirmar acima', !/os números da empresa vêm de relatórios do período inteiro \(confiança alta\)/.test(pbD.txt) && /fora os números acima/.test(pbD.txt));
// medido nas saídas, sem a consulta do regime dos clientes: os do Simples não aproveitam o crédito — a faixa desce
const pbR = caso(...pb.args, undefined, { ...PROC_MEDIDO, pctPJ: { fonte: 'saidas', meses: M8, porDocumento: true, regimeConsultado: false } });
chk('sem o regime dos clientes consultado: a confirmar, e diz que os do Simples não aproveitam', pbR.d.confianca.conclusao === 'a_confirmar' && pbR.d.alertas.some(a => /as do Simples não aproveitam o crédito/.test(a.texto)));

// resumo no topo, em linguagem simples, coerente com a recomendação
chk('resumo: empate diz "Manter como está"', /EMPATE TÉCNICO Manter como está/.test(vnF.txt.replace(/·/g, '')) || /Manter como está/.test(vnF.txt));
chk('resumo: confiança dos números no resumo, e a seção 7 com fonte, período, nível e motivo', /Com que segurança:/.test(vnF.txt) && /De onde vem cada número — e quanto dá pra confiar/.test(vnF.txt) && /Por que não é verdade absoluta/.test(vnF.txt) && /jan\/26–ago\/26, 8 meses/.test(vnF.txt));
chk('resumo: compras ≥ vendas vira "TENDÊNCIA — A CONFIRMAR"', /TENDÊNCIA — A CONFIRMAR/.test(vr.txt));
chk('sem a conta errada de média × 12 contra o RBT12', !/× 12|no ano\) é/.test(vr.txt));

// 6) Restaurante sem notas: mix não medido vira "dado que faltou", com a direção do erro
const rs = caso('HAMBURGUERIA TESTE', { anexo:'I', rbt12:872624.42, receita:72478.81, mixCheia:100, pctComprasMercadorias:49.5, pctComprasDespesas:0, pctImpostoEmbutido:0, pctExcluidoST:3.4, partilha:15.5, cbs:9.3, ibs:0.1, pctPJ:2.4, aliqEfetivaInformada:7.85 },
  { faturamento: { total: 579830, servicos: 0, saidas: 579830 }, periodoRotulo: 'jan/26–ago/26' }, null, '5611-2/01');
console.log('Restaurante sem notas:');
chk('veredito segue MANTENHA', rs.sim.veredito.tipo === 'MANTENHA');
chk('aponta o desconto de 40% que faltou medir, em linguagem simples', /a comida paga o imposto novo com desconto de 40%/.test(rs.txt) && /Para um cálculo mais preciso/.test(rs.txt));
chk('diz que a recomendação não muda', /a recomendação não muda/.test(rs.txt));
{ const perg = rs.txt.slice(rs.txt.indexOf('O que levantar'), rs.txt.indexOf('O que falta para fechar'));
  chk('lancheria: perguntas de restaurante, sem cesta básica nem insumos agropecuários', /iFood/.test(perg) && !/cesta básica|insumos agropecuários|linhas de produto/.test(perg)); }

// 7) Transportadora de carga (CT-e nas saídas, CNAE 4930, Anexo III): nada de mix, redução ou "produtos"
const tr = caso('TRANSPORTES TESTE', { anexo:'III', rbt12:410549.94, receita:35875.03, mixCheia:100, pctComprasMercadorias:1.3, pctComprasDespesas:2.2, pctImpostoEmbutido:0, pctExcluidoST:10.2, partilha:16.6, cbs:9.3, ibs:0.1, pctPJ:99.5, aliqEfetivaInformada:8.26 },
  { faturamento: { total: 287000.22, servicos: 0, saidas: 287000.22 }, periodoRotulo: 'jan/26–ago/26', entradas: { grupos: [] }, vendas: { total: 287003.22, pctPJ: 99.5, pj: 285523, pf: 1480, consumidor: 0, nPJ: 109, fonte: 'acompanhamento de saídas (Domínio), PJ pelo CNPJ do cliente' } }, null, '4930-2/02');
console.log('Transporte de cargas:');
chk('perfil = transporte de cargas', tr.d.perfil.tipo === 'transporte' && !tr.d.perfil.vendeMercadoria);
chk('sem aviso de notas de venda', !/Não usamos as notas fiscais de venda/.test(tr.txt));
chk('sem "insumos agropecuários, cesta básica"', !/cesta básica/.test(tr.txt));
chk('faturamento rotulado como fretes (CT-e)', /fretes \(CT-e\)/.test(tr.txt));
chk('fonte da alíquota: frete rodoviário sem redução na LC 214', /Transporte rodoviário de cargas não tem redução na LC 214/.test(tr.txt));
chk('fonte da alíquota: a redução do aéreo regional também vale para carga (art. 287)', /aéreo regional, de passageiros ou de carga/.test(tr.txt) && /art\. 287/.test(tr.txt));
chk('pergunta sobre o frete, não sobre hora técnica', /Como o frete é cobrado/.test(tr.txt) && !/hora técnica/.test(tr.txt));
chk('sem ISS retido (frete é ICMS)', !/ISS retido/.test(tr.txt));
chk('resumo não diz "não compensa" quando o crédito dos clientes supera o custo', !/não compensa o custo/.test(tr.txt) && /conversa comercial/.test(tr.txt));

// 8) Janela e B2B com crédito dos clientes maior que o custo: registrar agora, decidir até 20/12 — nunca "conversar até 30/10"
globalThis.__HOJE_ISO__ = '2026-09-28';
const b2b = caso('TRANSPORTES TESTE', { anexo:'III', rbt12:410549.94, receita:35875.03, mixCheia:100, pctComprasMercadorias:1.3, pctComprasDespesas:2.2, pctImpostoEmbutido:0, pctExcluidoST:10.2, partilha:16.6, cbs:9.3, ibs:0.1, pctPJ:99.5, aliqEfetivaInformada:8.26 },
  { faturamento: { total: 287000.22, servicos: 0, saidas: 287000.22 }, periodoRotulo: 'jan/26–ago/26', entradas: { grupos: [] }, vendas: { total: 287003.22, pctPJ: 99.5, pj: 285523, pf: 1480, consumidor: 0, nPJ: 109 } }, null, '4930-2/02');
console.log('Janela aberta, crédito dos clientes > custo:');
chk('decisão: registrar até 30/10 e decidir até 20/12', /Registrar a opção até 30\/10 — e decidir até 20\/12/.test(b2b.txt));
chk('nada de "conversa ... antes de 30/10"', !/antes de 30\/10/.test(b2b.txt));
globalThis.__HOJE_ISO__ = '2026-10-31';
const b2bOut = caso('TRANSPORTES TESTE', { anexo:'III', rbt12:410549.94, receita:35875.03, mixCheia:100, pctComprasMercadorias:1.3, pctComprasDespesas:2.2, pctImpostoEmbutido:0, pctExcluidoST:10.2, partilha:16.6, cbs:9.3, ibs:0.1, pctPJ:99.5, aliqEfetivaInformada:8.26 },
  { faturamento: { total: 287000.22, servicos: 0, saidas: 287000.22 }, periodoRotulo: 'jan/26–ago/26', entradas: { grupos: [] }, vendas: { total: 287003.22, pctPJ: 99.5, pj: 285523, pf: 1480, consumidor: 0, nPJ: 109 } }, null, '4930-2/02');
console.log('Janela fechada (31/10):');
chk('prazo diz que fechou em 30/10 e aponta março/2027', /fechou em 30\/10\/2026/.test(b2bOut.txt) && /março\/2027/.test(b2bOut.txt));
chk('decisão: manter por ora e reavaliar em março/2027', /Manter por ora — e reavaliar em março\/2027/.test(b2bOut.txt));
chk('sem "formalizar até 30/10"', !/formalizar a opção até 30\/10|formalizar até 30\/10|até 30\/10\/2026;/.test(b2bOut.txt.replace(/\s+/g, ' ')) && !/Registrar a opção até 30\/10/.test(b2bOut.txt));
delete globalThis.__HOJE_ISO__;

// 3) Drogaria Guerra (referência)
const g = simular({ anexo:'I', rbt12:1800000, receita:150000, mixCheia:20, mixRed60:70, mixRed30:0, mixZero:10, pctComprasMercadorias:60, pctComprasDespesas:5.33, pctImpostoEmbutido:18, pctExcluidoST:33.5, partilha:15.5, cbs:9.3, ibs:0, pctPJ:10, creditoEstoqueMes:1541.67 });
console.log('Referência:'); chk('Guerra continua OPTE (' + g.veredito.tipo + ')', g.veredito.tipo === 'OPTE');

// 4) Correções de 03/10/2026 (base do curso): crédito de estoque, fornecedor do Simples, bar e restaurante, notas em 2027
const ga = caso('DROGARIA TESTE', { anexo:'I', rbt12:1800000, receita:150000, mixCheia:20, mixRed60:70, mixRed30:0, mixZero:10, pctComprasMercadorias:60, pctComprasDespesas:5.33, pctImpostoEmbutido:18, pctExcluidoST:49, pctReceitaMonofasica:100, partilha:15.5, cbs:9.2, ibs:0.1, pctPJ:10, creditoEstoqueMes:1541.67 }, null, null, '4771-7/01');
console.log('Crédito de estoque (art. 381, provável, não garantido):');
chk('sem o estoque a conclusão inverte → alerta', ga.d.alertas.some(a => /crédito de estoque/.test(a.texto)));
chk('recomendação vira tendência a confirmar', /Tendência/.test(ga.d.recomendacao.titulo) || /TENDÊNCIA/.test(ga.txt));
chk('linha de sensibilidade do estoque', ga.d.sensibilidade.some(x => /estoque/.test(x.nome) && /^Sim/.test(x.muda)));
chk('DAS de 2027 acima do de hoje, com a explicação do monofásico', /exclusão do PIS\/COFINS monofásico acaba em 2027/.test(ga.txt));
chk('alíquota: referência menos 0,1 ponto (ADCT)', /menos 0,1 ponto, como manda o ADCT/.test(ga.txt));
chk('linha de sensibilidade do preço final mantido', ga.d.sensibilidade.some(x => /Preço final igual/.test(x.nome)));
const fs1 = caso('VAREJO SEM CONSULTA', { anexo:'I', rbt12:1200000, receita:100000, mixCheia:100, pctComprasMercadorias:89, pctComprasDespesas:1, pctImpostoEmbutido:0, pctExcluidoST:0, partilha:15.5, cbs:9.2, ibs:0.1, pctPJ:3, aliqEfetivaInformada:8.86 }, null, null, '4754-7/01');
console.log('Fornecedor do Simples (regime não consultado):');
chk('veredito OPTE (' + fs1.sim.veredito.tipo + ')', fs1.sim.veredito.tipo === 'OPTE');
const alF = fs1.d.alertas.find(a => /regime dos fornecedores não foi consultado/.test(a.texto));
chk('alerta com o limite de compras do Simples e a base legal', !!alF && /se \d+% ou mais das compras/.test(alF.texto) && /LC 123, art\. 23, §1º-A/.test(alF.texto));
chk('o teste de 20% não repete "fornecedores do Simples"', !fs1.d.alertas.some(a => /20% menor \(fornecedores do Simples/.test(a.texto)));
// Imersão (14/10/2026): o imposto embutido nas compras — o crédito é sobre o valor das notas sem o ICMS, o ICMS-ST e o IPI
console.log('Imposto embutido nas compras:');
const embFs1 = fs1.d.confianca.itens.find(it => it.chave === 'embutido');
chk('simulação antiga com o campo em 0: o imposto embutido não foi medido e decide — sem conclusão', !!embFs1 && embFs1.nivel === 'nao_medido' && fs1.d.confianca.decisivos.includes(embFs1) && fs1.d.confianca.conclusao === 'sem_conclusao');
chk('a tabela da seção 1 diz que não foi medido e o que a conta considerou', /Imposto embutido nas compras \(fora do crédito\) não medido sem as notas de compra — a conta considerou 0,0%: crédito sobre o valor cheio das notas/.test(fs1.txt));
chk('a recomendação pede as notas de compra em XML', /Para concluir, falta:.*as notas de compra \(XML de entrada\) dos fornecedores do regime normal/.test(fs1.txt));
const fs1Cli = gerarAnalise({ ...fs1.d, hojeISO: fs1.d.hojeISO }, { versao: 'cliente' }).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
chk('o relatório do cliente pede as notas de compra (os XML), sem artigo de lei no item', /as notas de compra \(os arquivos XML das notas fiscais de entrada\)/.test(fs1Cli) && /Sem as suas notas de compra, a conta considerou que todo o valor das compras gera crédito/.test(fs1Cli) && !/regime normal/.test(fs1Cli));
// o mesmo varejo com o % medido em dois meses de notas: média, e a faixa muda o resultado — a confirmar; o cliente lê a fonte
// dele ("suas notas fiscais de compra"), sem "XML" nem "regime normal"
// (com 3% medido a conta ainda dá "optar por fora"; com 7%, o teto da faixa, vira empate técnico)
const fs2Ent = { ...fs1.args[1], pctImpostoEmbutido: 3 };
const fs2b = caso(fs1.args[0], fs2Ent, fs1.args[2], fs1.args[3], fs1.args[4], undefined, { ...PROC_MEDIDO, pctEmb: { fonte: 'notas', meses: ['2026-07', '2026-08'], notas: 6 } });
const embFs2 = fs2b.d.confianca.itens.find(it => it.chave === 'embutido');
chk('medido em dois meses e a faixa muda o resultado: a confirmar', !!embFs2 && embFs2.nivel === 'media' && fs2b.d.confianca.aConfirmar.includes(embFs2) && fs2b.d.confianca.conclusao === 'a_confirmar');
const fs2Cli = gerarAnalise({ ...fs2b.d }, { versao: 'cliente' }).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
chk('o alerta do cliente usa a fonte do cliente: "Suas notas fiscais de compra", sem "XML" nem "regime normal"', /Imposto embutido nas compras — 3,0% do valor das notas de compra \(Suas notas fiscais de compra, jul\/26–ago\/26, 2 meses; confiança média\)/.test(fs2Cli) && !/regime normal|\(XML\)/.test(fs2Cli));
chk('o alerta do regime dos fornecedores, na versão do cliente, sai sem artigo de lei', /Não consultamos o regime dos seus fornecedores/.test(fs2Cli) && !/art\. 47, §9º|art\. 23, §1º-A/.test(fs2Cli));
chk('medido nas notas de compra: a tabela mostra o % e a fonte', /Imposto embutido nas compras \(fora do crédito\) 0,0% do valor das notas Notas fiscais de compra \(XML\), fornecedores do regime normal/.test(vn.txt));
chk('fontes: o crédito das compras sobre o valor sem o imposto embutido (LC 214, art. 12, §2º, II e V)', vn.d.fontes.some(f => /^Crédito das compras sobre o valor sem o imposto embutido \(0,0% tirado/.test(f.o_que) && /art\. 12, §2º, II e V/.test(f.origem) && /a confirmar na orientação normativa/.test(f.origem) && !f.ressalva));
chk('fontes: com o % não medido, a linha da lei avisa', fs1.d.fontes.some(f => /^Crédito das compras sobre o valor sem o imposto embutido/.test(f.o_que) && f.ressalva === '— o % não foi medido (tabela acima)'));
const rest = caso('RESTAURANTE TESTE', { anexo:'I', rbt12:1200000, receita:100000, mixCheia:20, mixRed40:80, pctComprasMercadorias:40, pctComprasDespesas:0, pctImpostoEmbutido:0, pctExcluidoST:10, partilha:15.5, cbs:9.2, ibs:0.1, pctPJ:5 },
  null, { pctPJ: 5, nNotas: 900, periodoRotulo: 'jan–ago/2026', cobertura: 100, clientes: [] }, '5611-2/01');
console.log('Bar e restaurante (art. 276):');
chk('ponto central: bebida em lata/garrafa e alcoólica geram crédito', /bebida em lata ou garrafa e a alcoólica/.test(rest.txt));
chk('sem "adquirente de alimentação e bebidas não pode"', !/adquirente de alimentação e bebidas não pode/.test(rest.txt));
chk('crédito do cliente só da parte cheia', Math.abs(rest.sim.semestre.creditoClienteFora - 6 * rest.sim.mes.debitoCreditavel) < 0.01 && rest.sim.mes.debitoCreditavel < rest.sim.mes.debitoFora);
// Módulo 06 (13/10/2026): refeição fornecida a empresas por contrato pode ficar fora do regime de bares (art. 273, a conferir)
chk('pergunta de venda a PJ avisa da refeição por contrato (art. 273)', /fornecimento de refeições a empresas por contrato/.test(rest.txt) && /CNAE 5620-1\/01/.test(rest.txt) && /art\. 273, a conferir/.test(rest.txt));
chk('fonte do mix de 40% traz a mesma ressalva', rest.d.fontes.some(f => /Mix de alíquotas/.test(f.o_que) && /art\. 273, a conferir/.test(f.ressalva || '')));
console.log('Notas no padrão IBS/CBS em 2027:');
chk('manter também avisa das notas a partir de 01/01/2027', /Mantendo, não é preciso fazer nada quanto à opção/.test(rest.txt) && /Ato Conjunto RFB\/CGIBS nº 4\/2026/.test(rest.txt));

// 9) Módulo Simuladores do curso (12/10/2026): indústria no Anexo I em 2027, "opte, se o comercial confirmar", margem da
//    decisão, ICMS/ISS do DAS fora da base e crédito das despesas por tipo — casos sintéticos com os números dos exercícios
const ind = caso('INDÚSTRIA TESTE', { anexo:'II', rbt12:2400000, receita:200000, mixCheia:100, pctComprasMercadorias:60, pctComprasDespesas:5, pctImpostoEmbutido:18, pctExcluidoST:0, partilha:14, cbs:9.2, ibs:0.1, pctPJ:85 },
  { faturamento: { total: 1600000, servicos: 0, saidas: 1600000 }, periodoRotulo: 'jan/26–ago/26' }, null, '1531-9/01');
console.log('Indústria (PGDAS no Anexo II) — opte, se o comercial confirmar:');
chk('motor: OPTE_SE no Anexo I de 2027', ind.sim.veredito.tipo === 'OPTE_SE' && ind.sim.fatores.anexo2027 === 'I');
chk('análise marca o resultado condicional', ind.d.condicional === true);
chk('resumo: registrar até 30/10 e decidir até 20/12', /Registrar a opção até 30\/10 — e decidir até 20\/12/.test(ind.txt));
chk('resumo: selo "se o comercial confirmar" (ou tendência a confirmar)', /SE O COMERCIAL CONFIRMAR|TENDÊNCIA — A CONFIRMAR/.test(ind.txt));
chk('recomendação cita a carteira de virada e a margem', /pelo menos 32,2% das vendas/.test(ind.txt) && /margem da decisão de 163,7%/.test(ind.txt));
chk('seção 5: pelo lado da carteira, com folga', /Pelo lado da carteira/.test(ind.txt) && /com folga/.test(ind.txt));
chk('seção 4: a indústria vai ao Anexo I em 2027', /Em 2027 a indústria é tributada no Anexo I/.test(ind.txt));
chk('fontes: anexo de 2027 pela LC 123, art. 18, §5º', ind.d.fontes.some(f => /Anexo de 2027 \(I, no lugar do II/.test(f.o_que) && /art\. 18, §5º/.test(f.origem)));
chk('fontes e sensibilidade: ICMS do DAS fora da base', ind.d.fontes.some(f => /ICMS do DAS fora da base/.test(f.o_que)) && ind.d.sensibilidade.some(x => /ICMS do DAS fora da base/.test(x.nome)));
chk('seção 4: a base do débito sem o ICMS do DAS', /base sem o ICMS do DAS/.test(ind.txt));
const con = caso('CONSULTORIA TESTE', { anexo:'V', rbt12:900000, receita:75000, mixCheia:100, pctComprasMercadorias:0, pctComprasDespesas:13.3333, pctImpostoEmbutido:5, pctExcluidoST:0, partilha:19.15, cbs:9.2, ibs:0.1, pctPJ:70 },
  { faturamento: { total: 600000, servicos: 600000, saidas: 0 }, periodoRotulo: 'jan/26–ago/26' }, null, '7020-4/00');
console.log('Consultoria — não opte, decisão apertada:');
chk('motor: MANTENHA com margem apertada', con.sim.veredito.tipo === 'MANTENHA' && con.sim.veredito.apertada);
chk('resumo avisa a margem apertada', /A margem é apertada: com 78,1% ou mais das vendas/.test(con.txt));
chk('ISS do DAS fora da base nas fontes', con.d.fontes.some(f => /ISS do DAS fora da base/.test(f.o_que)));
chk('o motivo aritmético diz que o crédito é sobre o valor das notas sem o imposto embutido (5%)', /o crédito é sobre o valor das notas sem o imposto embutido \(5,0%\)/.test(con.txt));
const ctb = caso('CONTABILIDADE TESTE', { anexo:'III', rbt12:1800000, receita:150000, mixRed30:100, pctComprasMercadorias:0, pctComprasDespesas:8, pctImpostoEmbutido:5, pctExcluidoST:32.5, partilha:16.6, cbs:9.2, ibs:0.1, pctPJ:45, issFixo:true, pctDespesasComCredito:70 },
  null, null, '6920-6/01');
console.log('Contabilidade — ISS fixo e crédito das despesas:');
chk('ISS fixo: nada sai da base e a fonte diz por quê', ctb.sim.mes.exclusaoBase === 0 && ctb.d.fontes.some(f => /ISS fixo por profissional/.test(f.o_que)));
chk('crédito das despesas informado nas fontes', ctb.d.fontes.some(f => /Crédito das despesas \(70,0% do cheio\)/.test(f.o_que)));
chk('fonte do crédito das despesas lembra o aluguel (−70%) e VR, VA e plano de saúde (débito do fornecedor)', ctb.d.fontes.some(f => /Crédito das despesas/.test(f.o_que) && /aluguel de imóvel \(−70%, art\. 261/.test(f.origem) && /VR, VA e plano de saúde/.test(f.origem)));
chk('sem linha de base cheia quando nada foi excluído', !ctb.d.sensibilidade.some(x => /fora da base do débito/.test(x.nome)));

// 10) Refeições para empresas (CNAE 5620-1/01, 13/10/2026): cliente empresa por contrato, nunca os textos de restaurante; o
//     enquadramento no regime de bares (LC 214, art. 273, a conferir) muda o resultado e a análise mostra os dois lados
const domCoz = { faturamento: { total: 800000, servicos: 0, saidas: 800000 }, periodoRotulo: 'jan/26–ago/26',
  pctPJDeduzido: 'deduzido: CNAE 5620-1/01, refeições preparadas preponderantemente para empresas — confirme a carteira e o regime dos clientes (empresa do Simples não aproveita o crédito)' };
const entCoz = { anexo:'I', rbt12:1200000, receita:100000, pctComprasMercadorias:40, pctComprasDespesas:0, pctImpostoEmbutido:0, pctExcluidoST:0, partilha:15.5, cbs:9.2, ibs:0.1, pctPJ:90, pctComprasComCredito:50 };
// 13/10/2026: com o % de PJ deduzido pelo CNAE, a cozinha fica SEM CONCLUSÃO (com 30% de clientes que creditam, vira
// "manter"); os testes do art. 273 usam as saídas medidas (CNPJ dos clientes e regime consultado)
const cozDed = caso('COZINHA EMPRESAS TESTE', { ...entCoz, mixCheia:100, mixRed40:0 }, domCoz, null, '5620-1/01');
const PROC_COZ = { ...PROC_MEDIDO, pctMerc: { fonte: 'manual' }, pctDesp: { fonte: 'manual' }, pctCred: { fonte: 'manual' } };
const cozFora = caso('COZINHA EMPRESAS TESTE', { ...entCoz, mixCheia:100, mixRed40:0 }, domCoz, null, '5620-1/01', undefined, PROC_COZ);
const cozDentro = caso('COZINHA EMPRESAS TESTE', { ...entCoz, mixCheia:10, mixRed40:90 }, domCoz, null, '5620-1/01', undefined, PROC_COZ);
console.log('Refeições para empresas (CNAE 5620-1/01):');
chk('PJ deduzido pelo CNAE que muda o resultado: SEM CONCLUSÃO', cozDed.d.semConclusao && cozDed.d.confianca.decisivos.some(i => i.chave === 'pj' && i.selo === 'deduzido'));
chk('sem conclusão: o pedido dos dados vem antes das perguntas e a pendência que decide, no topo', /Pra concluir a análise, precisamos de/.test(cozDed.d.perguntas[0]) && /deduzido, não medido/.test(cozDed.d.pendencias[0].o_que) && cozDed.d.pendencias[0].peso === 'decisivo');
chk('sem conclusão: a nota da sensibilidade diz por quê', /^Sem conclusão: vendas a clientes que aproveitam o crédito/.test(cozDed.d.sensibilidadeNota));
chk('perfil: refeições para empresas, não "bar e restaurante"', cozFora.d.perfil.refeicaoEmpresas && cozFora.d.perfil.rotulo === 'refeições para empresas' && /refeições para empresas/.test(cozFora.txt));
chk('o motor muda com o enquadramento: fora do regime "opte, se", dentro MANTENHA', cozFora.sim.veredito.tipo === 'OPTE_SE' && cozDentro.sim.veredito.tipo === 'MANTENHA');
chk('B2B: nada de consumidor final nem dos textos de restaurante, mesmo com o mix de 40%', !cozFora.d.consumidor && !cozDentro.d.consumidor && ![cozFora.txt, cozDentro.txt].some(t => /iFood|Em restaurante|bebida em lata ou garrafa e bebida alcoólica\?/.test(t)));
chk('pergunta do contrato de refeição, com o art. 273', /contratos de refeição/.test(cozFora.txt) && cozFora.d.perguntas[0].includes('art. 273'));
chk('sensibilidade: o enquadramento do art. 273, que muda o resultado', cozFora.d.sensibilidade.some(x => /Enquadramento da refeição por contrato/.test(x.nome) && /^Sim/.test(x.muda) && /no regime de bares/.test(x.efeito)));
chk('fora do regime: alerta de que no regime de bares o resultado vira "manter"', cozFora.d.alertas.some(a => /fora do regime de bares/.test(a.texto) && /passa a ser “manter dentro do DAS”/.test(a.texto) && /art\. 273/.test(a.conferir)));
chk('dentro do regime: alerta de que fora dele o resultado vira "opte, se"', cozDentro.d.alertas.some(a => /no regime de bares \(−40%/.test(a.texto) && /passa a ser “opte, se o comercial confirmar”/.test(a.texto)));
chk('pendência decisiva em primeiro lugar', cozFora.d.pendencias[0].o_que === 'Enquadramento da refeição por contrato (LC 214, art. 273)' && cozFora.d.pendencias[0].peso === 'decisivo');
chk('a nota da sensibilidade diz que o enquadramento inverte a conclusão (não "só o repasse")', /enquadramento da refeição por contrato/.test(cozFora.d.sensibilidadeNota) && !/Só o repasse derruba/.test(cozFora.d.sensibilidadeNota));
chk('fonte do mix: cheia "a conferir" pelo art. 273 (fora) e 40% também "a conferir" (dentro)', cozFora.d.fontes.some(f => /Mix de alíquotas \(integralmente cheia\)/.test(f.o_que) && f.rotulo === 'a conferir' && /art\. 273/.test(f.origem)) && cozDentro.d.fontes.some(f => /com redução de 40%/.test(f.o_que) && f.rotulo === 'a conferir'));
chk('sem o teste de "metade das vendas com −60%" nem o aviso de produtos do ramo', !cozFora.d.sensibilidade.some(x => /redução de 60%/.test(x.efeito || '')) && !cozFora.d.observacoes.some(o => /ração, adubo/.test(o)));
chk('% de PJ deduzido pra cima: pede aviso se a venda for a consumidor ou a empresas do Simples', cozFora.d.observacoes.some(o => /refeições preparadas preponderantemente para empresas/.test(o) && /consumidor final ou a empresas do Simples/.test(o)));
chk('restaurante comum (5611) continua com os textos de restaurante', !rest.d.perfil.refeicaoEmpresas && rest.d.consumidor && /fornecimento de refeições a empresas por contrato/.test(rest.txt));
const cozXml = caso('COZINHA EMPRESAS TESTE', { ...entCoz, mixCheia:10, mixRed40:90 }, null,
  { pctPJ: 90, nNotas: 400, periodoRotulo: 'jan–ago/2026', cobertura: 100, nClientes: 6, totalVendas: 800000, top20: 100,
    clientes: [{ nome: 'CALÇADOS EXEMPLO S.A.', uf: 'RS', valor: 300000, pct: 37.5, cnpjs: 1 }, { nome: 'FÁBRICA EXEMPLO LTDA', uf: 'RS', valor: 200000, pct: 25, cnpjs: 1 }] }, '5620-1/01');
chk('com notas e mix de 40%: a seção de clientes é a de venda a empresas, não a de "ninguém credita"', /por que isso decide a conta/.test(cozXml.txt) && !/fecha a porta também para o cliente pessoa jurídica/.test(cozXml.txt) && !/Apurar por fora não devolve crédito relevante a ninguém/i.test(cozXml.txt));
chk('o mix de 40% aparece como regime de bares a conferir (art. 273)', /refeição no regime de bares, LC 214 art\. 275 — enquadramento a conferir no art\. 273/.test(cozXml.txt));
const cozHtml = caso('COZINHA EMPRESAS TESTE', { ...entCoz, mixCheia:10, mixRed40:90 }, null,
  { pctPJ: 90, nNotas: 400, periodoRotulo: 'jan–ago/2026', cobertura: 100, nClientes: 6, totalVendas: 800000, top20: 100,
    clientes: [{ nome: '<img src=x onerror="alert(1)">CALÇADOS EXEMPLO S.A.', uf: 'RS', valor: 300000, pct: 37.5, cnpjs: 1 }] }, '5620-1/01');
const htmlCoz = gerarAnalise(cozHtml.d);
chk('o nome do maior cliente (das notas) entra na análise como texto, nunca como marcação', htmlCoz.includes('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;CALÇADOS EXEMPLO S.A. representa') && !htmlCoz.includes('<img src=x'));

// "MUDA O RESULTADO" É UM CRITÉRIO SÓ (13/10/2026): a recomendação muda de lado — o critério da confiança (seção 7). Antes
// a seção 6 e os alertas olhavam o sinal da diferença e o mesmo documento dizia "muda" e "não muda" da mesma variável
console.log('Seção 6, alertas e seção 7 com o mesmo critério:');
{
  const M12 = ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
  const base0 = { anexo: 'I', rbt12: 600000, receita: 50000, mixCheia: 100, mixRed60: 0, mixRed40: 0, mixRed30: 0, mixZero: 0,
    pctComprasMercadorias: 0, pctComprasDespesas: 0, pctImpostoEmbutido: 0, pctExcluidoST: 0, partilha: 15.5, cbs: 9.2, ibs: 0.1, pctPJ: 5 };
  // o % de compras em que por dentro sai uns R$ 300 mais barato no semestre (perto da virada)
  const alvo = (ent0, dif) => { let lo = 0, hi = 100; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (simular({ ...ent0, pctComprasMercadorias: m }).semestre.diferenca > dif) lo = m; else hi = m; } return { ...ent0, pctComprasMercadorias: Math.round(hi * 100) / 100 }; };
  const procPg = { receita: { fonte: 'pgdas', meses: ['2026-09'] }, rbt12: { fonte: 'pgdas', meses: ['2026-09'] }, anexo: { fonte: 'pgdas', meses: ['2026-09'] },
    pctMerc: { fonte: 'entradas', meses: M12, mesesFaturamento: 0, regimeFornecedores: true }, pctDesp: { fonte: 'entradas', meses: M12, mesesFaturamento: 0, regimeFornecedores: true },
    pctPJ: { fonte: 'saidas', meses: M12, porDocumento: true, regimeConsultado: true }, mix: { fonte: 'notas', meses: M12 } };
  const domPg = { pgdas: { competencia: '2026-09', dasTotal: 3000, cbsNoDas: 465, aliquotaEfetiva: 6 } };
  // (a) "opte, se" (por fora custa R$ 300 a mais) com a receita de um mês só (PGDAS): com outra receita vira "manter"
  const a = caso('COMÉRCIO TESTE', alvo(base0, 300), domPg, null, '4744-0/99', undefined, procPg);
  const sensRec = a.d.sensibilidade.find(x => x.nome === 'Receita mensal');
  const itRec = a.d.confianca.itens.find(i => i.chave === 'receita');
  chk('"opte, se" com receita de um mês: seção 6 e seção 7 dizem que a receita muda o resultado (' + a.sim.veredito.tipo + ')', a.sim.veredito.tipo === 'OPTE_SE' && itRec.muda && /^Sim/.test(sensRec.muda) && a.d.semConclusao);
  // (b) "manter" com por dentro R$ 80 mais barato: com a CBS de 8,7% fica R$ 100 mais barato por fora — ainda empate, ainda
  //     "manter". Antes o alerta dizia "o resultado se inverte"
  const b = caso('COMÉRCIO TESTE', alvo({ ...base0, pctPJ: 0 }, 80), domPg, null, '4744-0/99', undefined, { ...procPg, receita: { fonte: 'faturamento', meses: M12 } });
  const sensCbs = b.d.sensibilidade.find(x => x.nome === 'Alíquota final da CBS');
  chk('"manter" perto da virada: CBS de 8,7% não vira alerta nem "Sim" na seção 6, como na seção 7', b.sim.veredito.tipo === 'MANTENHA' && !b.d.alertas.some(x => /CBS de referência de 8,8%/.test(x.texto)) && /^Não/.test(sensCbs.muda) && !b.d.confianca.itens.find(i => i.chave === 'cbs').muda);
}

// 11) Carteira que perde crédito e compras medidas pelo NCM (13/10/2026): por fora, a venda com alíquota zero não dá crédito
//     a quem compra (e a alimentação preparada no regime de bares também não) — o resumo diz quanto a carteira perde, nunca
//     "passam a aproveitar R$ 0"; e o que não credita nas compras não é só cesta básica
console.log('Carteira que perde crédito e compras pelo NCM:');
{
  const PROC_NCM = { ...PROC_MEDIDO, mix: { fonte: 'notas', meses: M8 }, pctCred: { fonte: 'notas', meses: M8 } };
  const domB2B = { faturamento: { total: 800000, servicos: 0, saidas: 800000 }, periodoRotulo: 'jan/26–ago/26', pgdas: { competencia: '2026-08', dasTotal: 9000, cbsNoDas: 1395, aliquotaEfetiva: 9 },
    entradas: { grupos: [{ rotulo: 'Compra para comercialização', grupo: 'mercadoria', credita: 'mercadoria', incluido: true, valor: 320000, notas: 400 }] }, periodoEntradas: 'jan/26–ago/26 (8 meses)',
    vendas: { total: 800000, mercadorias: 800000, servicos: 0, st: 0, pctPJ: 95, pj: 760000, pf: 40000, consumidor: 0, nPJ: 40, fonte: 'acompanhamento de saídas (Domínio), PJ pelo CNPJ do cliente' },
    clientesRegime: { regularPct: 100 } };
  // atacado B2B com 40% das vendas em alíquota zero e 30% a −60%; 45% das compras creditam (pelo NCM); fornecedores consultados
  const entAt = { anexo:'I', rbt12:1200000, receita:100000, mixCheia:30, mixRed60:30, mixZero:40, pctComprasMercadorias:40, pctComprasDespesas:0, pctImpostoEmbutido:0, pctExcluidoST:0, partilha:15.5, cbs:9.2, ibs:0.1, pctPJ:95, aliqEfetivaInformada:9, pctComprasComCredito:45 };
  const atF = caso('ATACADO TESTE', entAt, { ...domB2B, fornecedoresRegime: { simplesPct: 30, cobertura: 80, fator: 0.74, maiores: [{ nome: 'FORNECEDOR EXEMPLO LTDA', valor: 50000 }] } }, null, '4639-7/01', undefined, PROC_NCM);
  chk('atacado: "opte, se" sem conclusão pendente (' + atF.sim.veredito.tipo + ')', atF.sim.veredito.tipo === 'OPTE_SE' && !atF.d.semConclusao);
  chk('seção 4: o que não credita é alíquota zero (cesta básica, hortifrúti) ou a parte sem imposto dos itens com redução — não "o resto é cesta básica"',
    /e só 45,0% dessas compras carregam IBS\/CBS pra creditar — o resto é produto com alíquota zero \(cesta básica, hortifrúti\) ou a parte sem imposto dos itens com redução de 60% ou 30% \(medido pelo NCM das notas de entrada\)/.test(atF.txt) && !/o resto é cesta básica, alíquota zero/.test(atF.txt));
  chk('seção 4: fornecedores consultados — o crédito menor do Simples já está descontado no % de compras', /; e o crédito menor de fornecedor do Simples \(30,0% das compras consultadas\) já está descontado nesse % de compras\. O regime regular favorece/.test(atF.txt));
  const atS = caso('ATACADO TESTE', entAt, domB2B, null, '4639-7/01', undefined, PROC_NCM);
  chk('seção 4: sem a consulta dos fornecedores, nada sobre fornecedor do Simples nessa frase', /\(medido pelo NCM das notas de entrada\)\. O regime regular favorece/.test(atS.txt) && !/já está descontado nesse % de compras/.test(atS.txt));
  // hortifrúti B2B (100% alíquota zero): por fora sai mais barato, mas os clientes perdem o crédito que tinham por dentro
  const entHf = { anexo:'I', rbt12:1200000, receita:100000, mixZero:100, pctComprasMercadorias:40, pctComprasDespesas:0, pctImpostoEmbutido:0, pctExcluidoST:0, partilha:15.5, cbs:9.2, ibs:0.1, pctPJ:95, aliqEfetivaInformada:9 };
  const hf = caso('HORTIFRUTI TESTE', entHf, domB2B, null, '4633-8/01', undefined, { ...PROC_MEDIDO, mix: { fonte: 'notas', meses: M8 } });
  chk('hortifrúti: OPTE firme (' + hf.sim.veredito.tipo + ')', hf.sim.veredito.tipo === 'OPTE' && !hf.d.semConclusao && hf.d.recomendacao.decisao === 'optar');
  chk('resumo: "os clientes empresa perdem crédito: aproveitariam R$ 0 por fora, contra R$ 7.952 por dentro — venda com alíquota zero…"',
    /Mas os clientes empresa perdem crédito: aproveitariam R\$ 0 por fora, contra R\$ 7\.952 por dentro — venda com alíquota zero não dá crédito a quem compra\./.test(hf.txt) && !/passam a aproveitar R\$ 0 de crédito/.test(hf.txt));
  chk('motor: a frase do veredito também diz a perda', /Mas a carteira PJ perde crédito/.test(hf.sim.veredito.frase));
  // refeições para empresas no regime de bares (90% a −40%): MANTENHA, e os clientes ainda perderiam crédito (art. 276)
  const entRb = { anexo:'I', rbt12:1200000, receita:100000, mixCheia:10, mixRed40:90, pctComprasMercadorias:40, pctComprasDespesas:0, pctImpostoEmbutido:0, pctExcluidoST:0, partilha:15.5, cbs:9.2, ibs:0.1, pctPJ:90, pctComprasComCredito:50 };
  const rb = caso('COZINHA TESTE', entRb, domB2B, null, '5620-1/01', undefined, { ...PROC_MEDIDO, pctMerc: { fonte: 'manual' }, pctDesp: { fonte: 'manual' }, pctCred: { fonte: 'manual' } });
  chk('cozinha no regime de bares: MANTENHA com a carteira perdendo (' + rb.sim.veredito.tipo + ')', rb.sim.veredito.tipo === 'MANTENHA' && rb.sim.semestre.aproveitadoFora < rb.sim.semestre.aproveitadoDentro);
  chk('resumo: "ainda perderiam crédito: aproveitariam R$ X por fora, contra R$ Y por dentro — a alimentação preparada… (art. 276)", sem "(R$ 0) não cobre"',
    /E os seus clientes empresa ainda perderiam crédito: aproveitariam R\$ [\d.]+ por fora, contra R\$ [\d.]+ por dentro — a alimentação preparada \(regime de bares e restaurantes\) não dá crédito a quem compra \(LC 214, art\. 276\)\./.test(rb.txt) && !/aproveitariam \(R\$ 0\) não cobre/.test(rb.txt));
}

// 12) Serviço com redução e transporte de passageiros (13/10/2026, Módulo 07): o enquadramento a conferir na seção 6, nas
//     regras, nas perguntas, nas pendências e nos alertas — nunca "serviço não consta dos anexos" pra profissão do art. 127,
//     nunca "transporte de cargas" pra fretamento
console.log('Serviço com redução e transporte de passageiros (Módulo 07):');
{
  const domServ = { faturamento: { total: 800000, servicos: 800000, saidas: 0 }, periodoRotulo: 'jan/26–ago/26' };
  // escritório de contabilidade, 80% de clientes PJ: com o −30% da sociedade, "opte, se"
  const entCt = { anexo:'III', rbt12:1200000, receita:100000, mixCheia:100, pctComprasMercadorias:0, pctComprasDespesas:10, pctImpostoEmbutido:0, pctExcluidoST:0, partilha:15.6, cbs:9.2, ibs:0.1, pctPJ:80 };
  const ct = caso('CONTABILIDADE TESTE', entCt, domServ, null, '6920-6/01', undefined, PROC_MEDIDO);
  chk('contabilidade sem os requisitos conferidos: SEM CONCLUSÃO pelo mix', ct.d.semConclusao && ct.d.confianca.decisivos.some(i => i.chave === 'mix') && /Sem recomendação por enquanto/.test(ct.txt));
  chk('regras: nunca "Serviço não consta dos anexos" — o mix do serviço, a conferir, com os cinco requisitos', !/Serviço não consta dos anexos/.test(ct.txt) && ct.d.fontes.some(f => /^Mix de alíquotas do serviço/.test(f.o_que) && f.rotulo === 'a conferir' && /cinco requisitos/.test(f.origem)));
  const sCt = ct.d.sensibilidade.find(x => /Requisitos da redução de 30%/.test(x.nome));
  chk('seção 6 (vende a empresas): a linha dos requisitos, com o efeito e "Sim"', sCt && /−30%/.test(sCt.efeito) && /^Sim — o enquadramento muda o resultado/.test(sCt.muda));
  chk('perguntas: "pra concluir" e logo depois os cinco requisitos', /^Pra concluir a análise, precisamos de: <b>o contrato social e o registro dos sócios no conselho profissional/.test(ct.d.perguntas[0]) && /cinco requisitos do art\. 127/.test(ct.d.perguntas[1]));
  chk('pendências: a do mix sobe da confiança (decisiva) e não se repete', ct.d.pendencias[0].peso === 'decisivo' && /^Mix de alíquotas/.test(ct.d.pendencias[0].o_que) && !ct.d.pendencias.some(p => /Requisitos da redução/.test(p.o_que)));
  // com 20% de clientes PJ o −30% não muda nada: observação pro cliente e pendência de peso médio
  const ct2 = caso('CONTABILIDADE TESTE', { ...entCt, pctPJ: 20 }, domServ, null, '6920-6/01', undefined, PROC_MEDIDO);
  chk('quando não muda: observação ("testamos os enquadramentos possíveis") e pendência média, sem SEM CONCLUSÃO',
    !ct2.d.semConclusao && ct2.d.observacoes.some(o => /profissão regulamentada pode ter redução de 30%.*Testamos os enquadramentos possíveis e a recomendação não muda/.test(o)) && ct2.d.pendencias.some(p => /Requisitos da redução de 30%/.test(p.o_que) && p.peso === 'médio'));
  // clínica a consumidor: o −60% do Anexo III vira "optar por fora" — premissa da lei: tendência a confirmar, com alerta
  const cl = caso('CLÍNICA TESTE', { ...entCt, pctComprasDespesas: 20, pctPJ: 5 }, domServ, null, '8630-5/03', undefined, PROC_MEDIDO);
  chk('clínica: premissa da lei — tendência a confirmar, não "sem conclusão"', !cl.d.semConclusao && /TENDÊNCIA — A CONFIRMAR/.test(cl.txt) && cl.d.alertas.some(a => /Serviço de saúde humana: a simulação considera tudo à alíquota cheia\. Com toda a receita com −60%/.test(a.texto)));
  chk('clínica: pendência decisiva da lista de serviços, a pergunta da relação dos serviços e a nota da seção 6',
    /lista de redução de 60% \(Anexo III da LC 214\)/.test(cl.d.pendencias[0].o_que) && cl.d.pendencias[0].peso === 'decisivo' && /^Quais <b>serviços<\/b>/.test(cl.d.perguntas[0]) && /enquadramento do serviço na lista do Anexo III/.test(cl.d.sensibilidadeNota));
  const clCli = gerarAnalise(cl.d, { versao: 'cliente' }).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  chk('clínica, relatório do cliente: o alerta nas palavras do cliente (sem "a simulação considera")', /Serviço de saúde humana pode ter redução de 60% por fora, conforme a lista da lei/.test(clCli));
  // ônibus urbano que fatura com NFS-e (o exemplo da leitura do Módulo 07): isento, a conta vira "optar por fora"
  const entOn = { anexo:'III', rbt12:1800000, receita:150000, mixCheia:100, pctComprasMercadorias:0, pctComprasDespesas:35, pctImpostoEmbutido:0, pctExcluidoST:0, partilha:16.6, cbs:9.2, ibs:0.1, pctPJ:0 };
  const on = caso('ÔNIBUS TESTE', entOn, domServ, null, '4921-3/01', undefined, PROC_MEDIDO);
  const sOn = on.d.sensibilidade.find(x => x.nome === 'Mix das vendas');
  chk('ônibus: SEM CONCLUSÃO, e a seção 6 mostra o −40% e a isenção', on.d.semConclusao && /−40%.*economia de R\$\s2\.309.*isenção.*economia de R\$\s20\.946/.test(sOn.efeito));
  chk('ônibus: a regra do transporte de passageiros a conferir (art. 157, com o semiurbano) e a pergunta da linha regular',
    on.d.fontes.some(f => /^Alíquota do transporte de passageiros/.test(f.o_que) && /semiurbano/.test(f.origem) && f.rotulo === 'a conferir') && on.d.perguntas.some(p => /linha regular sob autorização, permissão ou concessão/.test(p)));
  const onI = caso('ÔNIBUS TESTE', { ...entOn, mixCheia: 0, mixZero: 100, pctDespesasComCredito: 0 }, domServ, null, '4921-3/01', undefined, { ...PROC_MEDIDO, mix: { fonte: 'manual' } });
  chk('isenção informada: "isento pelo art. 157" e o crédito das despesas zerado pela isenção (CF, art. 156-A, §7º)',
    onI.d.fontes.some(f => /isento pelo art\. 157/.test(f.o_que)) && onI.d.fontes.some(f => /^Crédito das despesas/.test(f.o_que) && /156-A, §7º/.test(f.origem)) && /TENDÊNCIA — A CONFIRMAR/.test(onI.txt));
  // fretamento: alíquota cheia pela lei — nunca "transporte de cargas", "frete" ou "embarcador"
  const fr = caso('FRETAMENTO TESTE', { ...entOn, pctPJ: 60 }, null, null, '4929-9/01', undefined, PROC_MEDIDO);
  chk('fretamento municipal: alíquota cheia pela lei, sem texto de carga', fr.d.fontes.some(f => /Fretamento dentro do município, táxi e transporte escolar/.test(f.origem) && f.rotulo === 'alta (norma)') && !/cargas|embarcador/.test(fr.txt) && fr.d.perguntas.some(p => /passagem ou o fretamento/.test(p)));
  // fretamento entre cidades que fatura com NFS-e: o −40% do art. 286 é questão da lei — muda o resultado: tendência a confirmar
  const fi = caso('FRETAMENTO TESTE', { ...entOn, pctComprasDespesas: 50 }, domServ, null, '4929-9/02', undefined, PROC_MEDIDO);
  chk('fretamento entre cidades: o −40% vira o resultado — alerta, pendência decisiva e tendência a confirmar (não "sem conclusão")',
    !fi.d.semConclusao && /TENDÊNCIA — A CONFIRMAR/.test(fi.txt) && fi.d.alertas.some(a => /^Fretamento entre cidades: a simulação considera tudo à alíquota cheia\./.test(a.texto)) && /art\. 286/.test(fi.d.pendencias[0].o_que) && fi.d.pendencias[0].peso === 'decisivo');
  // o mesmo fretamento vendendo a empresas, com as saídas todas em nota de serviço: o perfil sai "serviço" pelas saídas
  const domNfse = { ...domServ, vendas: { total: 800000, mercadorias: 0, servicos: 800000, st: 0, pctPJ: 60, natureza: { servico: 800000 }, fonte: 'acompanhamento de serviços (Domínio), PJ pelo CNPJ do cliente' } };
  const fb = caso('FRETAMENTO TESTE', { ...entOn, pctComprasDespesas: 50, pctPJ: 60 }, domNfse, null, '4929-9/02', undefined, PROC_MEDIDO);
  chk('fretamento com NFS-e vendendo a empresas: a pergunta é da passagem ou do fretamento, nunca "hora técnica"; a atividade é transporte de passageiros',
    fb.d.perfil.tipo === 'servico' && fb.d.perguntas.some(p => /passagem ou o fretamento/.test(p)) && !fb.d.perguntas.some(p => /hora técnica/.test(p)) && fb.d.perfil.rotulo === 'transporte de passageiros (fretamento, táxi ou escolar)'
    && fb.d.fontes.some(f => /^Alíquota do transporte de passageiros/.test(f.o_que) && /art\. 286/.test(f.origem)) && !/Serviço não consta dos anexos/.test(fb.txt));
  // academia em que só o −60% (aula na lista da lei) vira: premissa — alerta com a NBS da educação desportiva
  const ac = caso('ACADEMIA TESTE', { ...entCt, pctComprasDespesas: 20, pctPJ: 5 }, domServ, null, '9313-1/00', undefined, PROC_MEDIDO);
  chk('academia: só o −60% vira — tendência a confirmar, com o alerta da educação desportiva', !ac.d.semConclusao && ac.d.alertas.some(a => /^Academia: .*educação desportiva da NBS 1\.2205\.12\.00/.test(a.texto)) && /educação desportiva/.test(ac.d.sensibilidadeNota));
  // a versão do cliente: o alerta da clínica sem "Anexo III" e sem artigo
  chk('clínica, relatório do cliente: "desconto de 60% em toda a receita (se o serviço estiver na lista da lei)", sem anexo nem artigo', /Com desconto de 60% em toda a receita \(se o serviço estiver na lista da lei\), o resultado passa a ser/.test(clCli) && !/Anexo III/.test(clCli.slice(clCli.indexOf('Serviço de saúde humana pode ter'), clCli.indexOf('Serviço de saúde humana pode ter') + 400)));
  const frB2c = caso('FRETAMENTO TESTE', entOn, null, null, '4929-9/01', undefined, PROC_MEDIDO);
  // minimercado sem as notas em que nem a divisão com alíquota zero muda: a observação fala da cesta básica, não de "metade"
  const mm = caso('MERCADO TESTE', { anexo:'I', rbt12:900000, receita:75000, mixCheia:100, pctComprasMercadorias:55, pctComprasDespesas:3, pctImpostoEmbutido:0, pctExcluidoST:10, partilha:15.5, cbs:9.2, ibs:0.1, pctPJ:2 }, null, null, '4712-1/00', undefined, PROC_MEDIDO);
  chk('minimercado: testa as duas divisões e, sem mudar, a observação fala de cesta básica e hortifrúti', !mm.d.semConclusao && mm.d.confianca.itens.find(i => i.chave === 'mix').resultados.length === 2
    && mm.d.observacoes.some(o => /No mercado, a cesta básica, o hortifrúti e os ovos não pagam o imposto novo/.test(o)) && !mm.d.observacoes.some(o => /Mesmo com metade das vendas com desconto/.test(o)));
  chk('fretamento a consumidor: a seção 6 não testa "metade com redução de 60%"', /sem faixa a testar/.test(frB2c.d.sensibilidade.find(x => x.nome === 'Mix das vendas').efeito) && !/metade com redução de 60%/.test(frB2c.txt));
}

console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
