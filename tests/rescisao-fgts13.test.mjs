// O aviso do FGTS do 13º na ficha da rescisão (assets/js/rescisao-fgts13.js, 27/11/2026: a Nota Orientativa FGTS
// Digital nº 13/2026). Rodar com: node tests/rescisao-fgts13.test.mjs
import { fgts13NaRescisao, NOTA_FGTS13 } from '../assets/js/rescisao-fgts13.js';

let falhas = 0;
const chk = (nome, cond, extra) => { if (!cond) falhas++; console.log((cond ? '  ✓ ' : '  ✗ ') + nome + (!cond && extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); };

console.log('Quando o aviso vale:');
const dez = fgts13NaRescisao({ ultimo_dia: '2026-12-03', data_acerto: '2026-12-11', status: 'recebida' });
chk('o fim do contrato em dezembro: o FGTS do 13º vai junto, com a data do pagamento',
  dez && dez.mes === 'dezembro' && dez.pagamento === '2026-12-11' && /até 11\/12\/2026/.test(dez.linhas[0]) && /não em 20\/01/.test(dez.linhas[0]), dez);
chk('em dezembro, também a rubrica do 13º adiantado (FGTS 11, não 12) e a nota', dez.linhas.length === 3 && /FGTS 11 \(mensal\), não a 12 \(13º\)/.test(dez.linhas[1])
  && dez.linhas[2] === NOTA_FGTS13 + '.');
const dez31 = fgts13NaRescisao({ ultimo_dia: '2026-12-31', data_acerto: '2027-01-08', status: 'em_andamento' });
chk('o fim em 31/12, com o pagamento em janeiro: vale (o FGTS do 13º vai com a rescisão)', dez31 && dez31.mes === 'dezembro' && /até 08\/01\/2027/.test(dez31.linhas[0]), dez31);
const jan = fgts13NaRescisao({ ultimo_dia: '2027-01-08', data_acerto: '2027-01-18', status: 'recebida' });
chk('o fim em janeiro com o pagamento até 20/01: vale, sem a linha da 1ª parcela', jan && jan.mes === 'janeiro' && jan.linhas.length === 2 && /rescisão de janeiro/.test(jan.linhas[0]), jan);
chk('o pagamento em 20/01 ainda vale', !!fgts13NaRescisao({ ultimo_dia: '2027-01-10', data_acerto: '2027-01-20' }));
chk('o pagamento depois de 20/01 não', fgts13NaRescisao({ ultimo_dia: '2027-01-12', data_acerto: '2027-01-21' }) === null);
chk('janeiro sem a data do pagamento: não diz', fgts13NaRescisao({ ultimo_dia: '2027-01-05', data_acerto: null }) === null);
chk('dezembro sem a data do pagamento: vale, sem a data', (() => { const x = fgts13NaRescisao({ ultimo_dia: '2026-12-10' }); return x && x.pagamento === null && !/até /.test(x.linhas[0]); })());
chk('novembro e fevereiro, não', fgts13NaRescisao({ ultimo_dia: '2026-11-30', data_acerto: '2026-12-10' }) === null && fgts13NaRescisao({ ultimo_dia: '2027-02-02', data_acerto: '2027-02-12' }) === null);
chk('a cancelada, não', fgts13NaRescisao({ ultimo_dia: '2026-12-03', data_acerto: '2026-12-11', status: 'cancelada' }) === null);
chk('sem o último dia ou sem nada, não', fgts13NaRescisao({ data_acerto: '2026-12-11' }) === null && fgts13NaRescisao(null) === null && fgts13NaRescisao({ ultimo_dia: 'lixo' }) === null);

console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
