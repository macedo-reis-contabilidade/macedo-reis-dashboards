// Os certificados digitais dos clientes (assets/js/certificados.js, 22/10/2026): quando avisar (a regra do vigia), a
// situação na lista, a mensagem e o número do WhatsApp. Dados inventados. Rodar com: node tests/certificados.test.mjs
import { diasEntre, somaDias, fmtData, situacao, etapaDoAviso, prazoEmPalavras, mensagemDoAviso, numeroWhats, ordenar, diaDoAviso } from '../assets/js/certificados.js';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); };

const HOJE = '2026-10-22';
const cert = (dias, o = {}) => ({ id: 'x', titular: 'PADARIA EXEMPLO', tipo: 'A1', validade: somaDias(HOJE, dias), acompanhar: true, avisado_em: null, ...o });
// o aviso de n dias antes do vencimento do certificado, ao meio-dia (o carimbo tem hora)
const avisado = (c, antes) => ({ ...c, avisado_em: somaDias(c.validade, -antes) + 'T12:00:00-03:00' });

console.log('As datas:');
chk('dias entre duas datas', diasEntre('2026-10-22', '2026-11-21') === 30 && diasEntre('2026-10-22', '2026-10-21') === -1 && diasEntre('2026-12-31', '2027-01-01') === 1);
chk('somar dias e dd/mm/aaaa', somaDias('2026-10-22', 30) === '2026-11-21' && somaDias('2026-03-01', -1) === '2026-02-28' && fmtData('2027-01-05') === '05/01/2027' && fmtData(null) === '—');
chk('o dia do aviso sai do carimbo com hora', diaDoAviso('2026-10-08T12:00:00-03:00') === '2026-10-08' && diaDoAviso(null) === null && diaDoAviso('lixo') === null);

console.log('A situação na lista:');
chk('vencido, a 30 dias, em dia', situacao(cert(-1), HOJE) === 'vencido' && situacao(cert(0), HOJE) === 'vence30' && situacao(cert(30), HOJE) === 'vence30' && situacao(cert(31), HOJE) === 'emdia');
chk('quem não acompanha mais fica parado, vencido ou não', situacao(cert(-5, { acompanhar: false }), HOJE) === 'parado' && situacao(cert(90, { acompanhar: false }), HOJE) === 'parado');

console.log('Quando avisar (a regra do vigia):');
chk('a mais de 30 dias, não', etapaDoAviso(cert(31), HOJE) === null);
chk('a 30 dias sem aviso: o primeiro aviso', etapaDoAviso(cert(30), HOJE) === '30' && etapaDoAviso(cert(8), HOJE) === '30');
chk('avisado na janela dos 30 dias, some até os 7', etapaDoAviso(avisado(cert(20), 30), HOJE) === null && etapaDoAviso(avisado(cert(8), 25), HOJE) === null);
chk('o aviso de antes da janela (o do vencimento anterior) não conta', etapaDoAviso(avisado(cert(20), 31), HOJE) === '30');
chk('a 7 dias, sem aviso depois dos 7: avisar de novo', etapaDoAviso(avisado(cert(7), 20), HOJE) === '7' && etapaDoAviso(cert(0), HOJE) === '7');
chk('avisado já nos últimos 7 dias, não', etapaDoAviso(avisado(cert(5), 7), HOJE) === null && etapaDoAviso(avisado(cert(1), 3), HOJE) === null);
chk('vencido há até 30 dias sem aviso depois do vencimento', etapaDoAviso(cert(-1), HOJE) === 'vencido' && etapaDoAviso(avisado(cert(-3), 2), HOJE) === 'vencido' && etapaDoAviso(cert(-30), HOJE) === 'vencido');
chk('avisado no dia do vencimento ou depois, não', etapaDoAviso(avisado(cert(-3), 0), HOJE) === null && etapaDoAviso(avisado(cert(-10), -2), HOJE) === null);
chk('vencido há mais de 30 dias, só a lista mostra', etapaDoAviso(cert(-31), HOJE) === null);
chk('quem não acompanha, nunca', etapaDoAviso(cert(5, { acompanhar: false }), HOJE) === null && etapaDoAviso(cert(-2, { acompanhar: false }), HOJE) === null);

console.log('Em palavras e a mensagem:');
chk('quanto falta', prazoEmPalavras(cert(0), HOJE) === 'vence hoje' && prazoEmPalavras(cert(1), HOJE) === 'vence amanhã' && prazoEmPalavras(cert(12), HOJE) === 'vence em 12 dias'
  && prazoEmPalavras(cert(-1), HOJE) === 'venceu ontem' && prazoEmPalavras(cert(-9), HOJE) === 'venceu há 9 dias');
const m = mensagemDoAviso(cert(25), HOJE);
chk('a mensagem: quem, o tipo, a data e quanto falta', m.includes('certificado digital A1 de PADARIA EXEMPLO vence em 16/11/2026, daqui a 25 dias') && m.includes('nos mande o novo') && m.startsWith('Olá!'), m);
chk('vence hoje e amanhã', mensagemDoAviso(cert(0), HOJE).includes('vence hoje (22/10/2026)') && mensagemDoAviso(cert(1), HOJE).includes('vence amanhã (23/10/2026)'));
const mv = mensagemDoAviso(cert(-4, { tipo: null }), HOJE);
chk('vencido: venceu em, sem o tipo quando não se sabe', mv.includes('O certificado digital de PADARIA EXEMPLO venceu em 18/10/2026') && mv.includes('Se já renovou'), mv);

console.log('O número do WhatsApp:');
chk('com DDD ganha o 55', numeroWhats('(51) 99876-5432') === '5551998765432' && numeroWhats('51 3546-1234') === '555135461234');
chk('com o 55 fica como está', numeroWhats('+55 51 99876-5432') === '5551998765432');
chk('curto ou longo demais, nada', numeroWhats('9876-5432') === null && numeroWhats('') === null && numeroWhats('12345678901234') === null);

console.log('A ordem:');
const lista = ordenar([cert(200, { id: 'a' }), cert(-90, { id: 'b' }), cert(20, { id: 'c' }), avisado(cert(10, { id: 'd' }), 25)], HOJE);
chk('quem precisa de aviso primeiro, depois a que vence antes', lista.map(c => c.id).join(',') === 'c,b,d,a', lista.map(c => c.id));

console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
