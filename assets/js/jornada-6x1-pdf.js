// =====================================================================
// MACEDO & REIS — O relatório do fim da escala 6x1 pra empresa (dp-jornada.html, 09/11/2026), em PDF.
// Puro: recebe o construtor do jsPDF (window.jspdf.jsPDF) e os dados da ficha. O que vai: a lei, o retrato de hoje,
// o que muda em cada data, as saídas com o custo estimado, as escalas que cabem (21/11/2026, jornada-escalas.js: a
// folga de cada um e quantos ficam em cada dia), a escolha combinada e os próximos passos. A observação interna do
// plano nunca entra (a regra da casa: anotação interna não sai em PDF).
// A fonte padrão do jsPDF não tem o travessão nem alguns símbolos: o texto passa pelo limpar().
// =====================================================================
import { EMENDA, DECISAO_STF, DECRETO, PORTARIA, DATA_42, DATA_40, ETAPAS, padraoDoGrupo, diagnostico, simular, fmtNum, fmtReais } from './jornada-6x1.js';
import { DIAS, escalasDaEmpresa, garantias } from './jornada-escalas.js';

const dataBr = iso => iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '';
export const limpar = t => String(t == null ? '' : t)
  .replace(/[—–]/g, '-').replace(/…/g, '...').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

export function relatorioJornadaPdf(J, { empresa, grupos, opcoes = {}, etapa = 'e42', plano = {}, hoje, dadosAte = null }) {
  const doc = new J({ unit: 'mm', format: 'a4' });
  const M = 18, L = 210 - 2 * M;
  let y = M;
  const quebra = h => { if (y + h > 297 - M) { doc.addPage(); y = M; } };
  const texto = (t, { tam = 10, negrito = false, cor = [30, 30, 30], recuo = 0, depois = 1.5 } = {}) => {
    doc.setFont('helvetica', negrito ? 'bold' : 'normal'); doc.setFontSize(tam); doc.setTextColor(...cor);
    const linhas = doc.splitTextToSize(limpar(t), L - recuo);
    const alt = tam * 0.42;
    for (const l of linhas) { quebra(alt); doc.text(l, M + recuo, y); y += alt; }
    y += depois;
  };
  const titulo = t => { y += 3; quebra(10); texto(t, { tam: 12.5, negrito: true, cor: [20, 45, 80], depois: 2 }); };
  const item = (t, base) => { texto('- ' + t, { recuo: 2 }); if (base) texto(base, { tam: 8.5, cor: [110, 110, 110], recuo: 5, depois: 2 }); };

  texto('Fim da escala 6x1: o plano da ' + (empresa.nome || 'empresa'), { tam: 16, negrito: true, cor: [20, 45, 80], depois: 2 });
  if (empresa.fantasia && empresa.fantasia !== empresa.nome) texto(empresa.fantasia, { tam: 10.5, cor: [80, 80, 80] });
  texto('Preparado pela Macedo & Reis Contabilidade em ' + dataBr(hoje) + '.', { tam: 9.5, cor: [90, 90, 90], depois: 3 });

  titulo('O que diz a lei');
  item('Emenda Constitucional ' + EMENDA.numero + ', publicada em ' + dataBr(EMENDA.publicada) + '.');
  item('A partir de ' + dataBr(DATA_42) + ': no máximo 42 horas por semana e 2 dias de folga remunerada por semana, um de preferência no domingo. A escala 6x1 acaba.', 'EC 141, art. 6º, I; Constituição, art. 7º, XV');
  item('A partir de ' + dataBr(DATA_40) + ': no máximo 40 horas por semana. O limite de 8 horas por dia continua.', 'EC 141, art. 6º, II; Constituição, art. 7º, XIII');
  item('Sem reduzir o salário, nem de forma proporcional. Quem já trabalha 40 horas ou menos não tem redução, mas ganha as 2 folgas.', 'EC 141, arts. 2º e 4º');
  item('O valor da hora: o salário do mês dividido por 210 nas 42 horas e por 200 nas 40 horas (antes, 220). Se a convenção, o acordo ou o contrato já usam um divisor menor, ele continua: vale o mais favorável ao empregado.', 'Decreto ' + DECRETO.numero + ', art. 5º');
  item('Na 12x36, se a média do mês passar do limite da semana, a empresa compensa as horas ou paga hora extra, como a convenção ou o acordo coletivo disser. No turno ininterrupto de revezamento, 6 horas por dia, salvo convenção ou acordo.', 'Decreto ' + DECRETO.numero + ', arts. 2º e 3º; Portaria MTE ' + PORTARIA.numero + ', arts. 7º e 8º');
  item('Quem recebe por hora, dia, tarefa, peça ou comissão: o valor da unidade é ajustado pra manter a remuneração do mês, pela média dos 12 meses antes de ' + dataBr(DATA_42) + '. A hora extra habitual reflete nos 2 dias de repouso em 1/6 do valor dela na semana.', 'Portaria MTE ' + PORTARIA.numero + ', art. 10, §§ 4º e 5º, e art. 11, § 7º');
  item('Com convenção ou acordo coletivo, o regime compensatório pode dar os 2 repousos na média do mês (9 no mês de 30 ou 31 dias), com pelo menos 1 a cada 6 dias seguidos de trabalho. O domingo de folga, de preferência, pelo menos 1 vez a cada 4 semanas (no comércio, 1 a cada 3).', 'Portaria MTE ' + PORTARIA.numero + ', art. 4º, §§ 3º e 4º, e art. 5º, §§ 4º e 5º');
  item('O banco de horas juntado até ' + dataBr('2026-12-15') + ' é compensado ou pago como o acordo que o criou disser; as horas a partir de ' + dataBr(DATA_42) + ' seguem os limites novos. A fiscalização faz a dupla visita nos primeiros 90 dias de cada etapa.', 'Portaria MTE ' + PORTARIA.numero + ', art. 13, § 5º, e art. 17');
  if (DECISAO_STF.vale) {
    item('Até ' + dataBr(DATA_40) + ', a convenção ou o acordo coletivo pode passar das 8 horas por dia pra distribuir as 42 horas. Sem convenção ou acordo até ' + dataBr('2026-12-15') + ', o STF admitiu as 42 horas em 5 dias de até 8h24, sem hora extra nos 24 minutos, até ' + dataBr(DECISAO_STF.ate) + '.', 'EC 141, art. 7º; STF, ' + DECISAO_STF.processo + ', ' + dataBr(DECISAO_STF.data) + ', item I');
    item('As folgas: o STF tirou as travas semanal e mensal; a convenção ou o acordo define como os 2 dias de repouso por semana são tirados.', 'Constituição, art. 7º, § 2º; STF, ' + DECISAO_STF.processo + ', item IV');
    item('Em ' + dataBr(DATA_42) + ', as cláusulas da convenção sobre jornada e folga que forem contra a emenda deixam de valer; as outras seguem até o fim da convenção, e há 90 dias, até ' + dataBr(DECISAO_STF.revisao) + ', pra rever as contrapartidas na negociação.', 'EC 141, art. 3º; STF, ' + DECISAO_STF.processo + ', item II');
    item('A decisão do STF é do relator, em medida cautelar, e vale já pra todos, mas ainda vai a referendo do Plenário: pode ser revista.');
  } else {
    item('Passar das 8 horas por dia (por exemplo, 8h24 de segunda a sexta pra fechar 42 horas) só com convenção ou acordo coletivo, até ' + dataBr(DATA_40) + '. A convenção também pode fazer a média de 2 folgas no mês, com pelo menos 1 por semana.', 'EC 141, art. 7º; Constituição, art. 7º, § 2º');
    item('Em ' + dataBr(DATA_42) + ', as cláusulas da convenção sobre jornada e folga que forem contra a emenda deixam de valer.', 'EC 141, art. 3º');
  }

  titulo('Como a empresa está hoje');
  // as turmas do Domínio cujos dias o escritório informou (o Domínio não os tinha): a empresa vê de onde veio cada coisa
  const informadas = dadosAte ? grupos.filter(g => { const p = padraoDoGrupo(g); return p.informado && !p.manual; }).length : 0;
  texto(dadosAte ? 'Pelo Domínio, em ' + dataBr(dadosAte) + (informadas ? '; os dias de ' + informadas + (informadas === 1 ? ' turma' : ' turmas') + ', pelo que a empresa informou' : '') + '.'
    : 'Pelo que a empresa informou.', { tam: 9, cor: [90, 90, 90] });
  const cols = [['Jornada', 70], ['Pessoas', 25], ['Horas no contrato', 40], ['Dias por semana', 39]];
  quebra(8);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(60, 60, 60);
  let x = M; for (const [c, w] of cols) { doc.text(c, x, y); x += w; } y += 2;
  doc.setDrawColor(200, 200, 200); doc.line(M, y, M + L, y); y += 4.5;
  doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 30, 30);
  for (const g of grupos) {
    const p = padraoDoGrupo(g);
    quebra(6); x = M;
    const vals = [p.rotulo, String(g.empregados), fmtNum(p.horas) + ' h', p.dias != null ? fmtNum(p.dias) : '-'];
    vals.forEach((v, i) => { doc.text(limpar(v), x, y); x += cols[i][1]; });
    y += 5;
  }
  y += 1;

  for (const id of ['e42', 'e40']) {
    titulo('O que precisa mudar até ' + dataBr(ETAPAS[id].desde));
    let algum = false;
    for (const g of grupos) {
      const d = diagnostico(g, id, { cct: !!opcoes.cct });
      // o aviso que é só do escritório (o cadastro da jornada no Domínio) não vai pra empresa
      const itens = d.itens.filter(i => !i.ok && !i.interno);
      if (!itens.length) continue;
      algum = true;
      texto(d.padrao.rotulo + ' (' + g.empregados + ' ' + (Number(g.empregados) === 1 ? 'pessoa' : 'pessoas') + ')', { negrito: true, tam: 10 });
      for (const i of itens) item(i.texto, i.base);
    }
    if (!algum) texto('Nada a mudar nesta data.', { cor: [90, 90, 90] });
  }

  const s = simular(grupos, etapa, opcoes);
  titulo('As saídas e o custo estimado por mês, a partir de ' + dataBr(ETAPAS[etapa].desde));
  item('Contratar: ' + s.contratar.pessoas + ' ' + (s.contratar.pessoas === 1 ? 'pessoa' : 'pessoas') + (s.contratar.mes != null ? ', R$ ' + fmtReais(s.contratar.mes) + ' por mês (R$ ' + fmtReais(s.porPessoa) + ' cada, com 13º, férias e encargos).' : '.'));
  item('Hora extra: ' + fmtNum(s.horaExtra.horasMes) + ' horas por mês' + (s.horaExtra.mes != null ? ', R$ ' + fmtReais(s.horaExtra.mes) + ' por mês.' : '.') + ' Hora extra todo mês passa a integrar o salário: serve pra transição, não como regra.');
  item('Reduzir: ' + fmtNum(s.reduzir.horasSemana) + ' horas por semana a menos' + (s.reduzir.presenca ? ' e ' + fmtNum(s.reduzir.presenca) + ' dia(s)-pessoa a menos' : '') + ', sem custo a mais, absorvidas no horário de funcionamento ou na distribuição dos turnos.');
  texto('Como foi calculado: salário de referência R$ ' + (s.salario != null ? fmtReais(s.salario) : '-') + '; ' + s.encargos.rotulo + '; a hora extra com 50%, o divisor ' + ETAPAS[etapa].divisor + ', o reflexo de 1/6 nos 2 repousos, 13º, férias e encargos. Não inclui vale-transporte, alimentação e os benefícios da convenção.', { tam: 8.5, cor: [110, 110, 110], depois: 2 });

  // as escalas que cabem na data do simulador: pra cada turma que muda, as opções em grade (quem folga em cada dia e
  // quantos ficam, contra hoje). A grade só usa texto e linha: "folga" no dia de folga, vazio no dia de trabalho.
  const turmas = escalasDaEmpresa(grupos, etapa, { cct: !!opcoes.cct });
  const comOpcoes = turmas.some(t => t.escalas.opcoes.length);
  if (turmas.length) {
    const gente = n => n + ' ' + (Number(n) === 1 ? 'pessoa' : 'pessoas');
    const nota = (n, recuo) => { texto(n.texto, { tam: 9.5, recuo, depois: n.base ? 0.6 : 1.5 }); if (n.base) texto(n.base, { tam: 8.5, cor: [110, 110, 110], recuo: recuo + 3 }); };
    const C0 = 42, CD = 16, ALT = 4.3;   // a primeira coluna, a de cada dia e a altura da linha, em mm
    // a altura de uma opção até o fim da grade (o título, o horário e as linhas), pra ela não começar no pé da página
    const linhasDaGrade = o => o.semGrade ? 0 : 1 + (o.ciclo > 1 ? o.ciclo : 0) + o.ciclo * (o.turmas.length + 1) + (o.cobertura.hoje ? 1 : 0);
    const altura = o => Math.min(16 + linhasDaGrade(o) * ALT, 150);
    const grade = (o, recuo) => {
      const x0 = M + recuo;
      const linha = (rotulo, celulas, { negrito = false, cor = [30, 30, 30] } = {}) => {
        quebra(ALT);
        doc.setFont('helvetica', negrito ? 'bold' : 'normal'); doc.setFontSize(8.5); doc.setTextColor(...cor);
        if (rotulo) doc.text(limpar(rotulo), x0, y);
        celulas.forEach((c, d) => { if (c !== '') doc.text(limpar(String(c)), x0 + C0 + d * CD, y); });
        y += ALT;
      };
      const noDia = new Set(o.cobertura.dias.map(x => x.dia));
      const numeros = vals => vals.map((v, d) => noDia.has(d) ? v : '-');
      linha('', DIAS.map(d => d.charAt(0).toUpperCase() + d.slice(1)), { negrito: true, cor: [90, 90, 90] });
      doc.setDrawColor(200, 200, 200); doc.line(x0, y - ALT + 1.4, x0 + C0 + 7 * CD - 4, y - ALT + 1.4);
      y += 1;
      for (let w = 0; w < o.ciclo; w++) {
        if (o.ciclo > 1) { if (w) y += 0.8; linha('Semana ' + (w + 1), [], { negrito: true, cor: [90, 90, 90] }); }
        for (const t of o.turmas) linha(t.nome + (t.nome.startsWith('Turma') ? ' (' + gente(t.pessoas) + ')' : ''), t.trabalha[w].map(x => x ? '' : 'folga'));
        linha('Ficam', numeros(o.cobertura.nova[w]), { negrito: true });
      }
      if (o.cobertura.hoje) linha('Hoje', numeros(o.cobertura.hoje), { cor: [110, 110, 110] });
      y += 1.2;
    };
    titulo('As escalas que cabem a partir de ' + dataBr(ETAPAS[etapa].desde));
    texto('Pra cada turma que precisa mudar, as escalas que cabem na lei: quem folga em cada dia e quantos ficam, contra hoje. São pontos de partida: a empresa escolhe pelo movimento de cada dia e pelos horários. As pessoas aparecem como turmas (Turma A, Pessoa 1): quem entra em cada uma, a empresa decide.', { tam: 9, cor: [90, 90, 90], depois: 2.5 });
    const gerais = new Map();
    for (const { escalas: e } of turmas) {
      for (const n of e.notas) gerais.set(n.texto, n);
      y += 1; quebra(e.opcoes.length ? Math.min(18 + altura(e.opcoes[0]), 180) : 16);   // o nome da turma vai junto com a primeira opção
      texto(e.rotulo + ' (' + gente(e.pessoas) + ')' + (e.hoje && !e.hoje.suposto ? ': hoje, ' + e.hoje.texto + (e.hoje.informado && dadosAte ? ' (pelo que a empresa informou)' : '') : ''), { negrito: true, tam: 10.5 });
      if (!e.opcoes.length) { texto(e.motivo, { recuo: 2, depois: 2.5 }); continue; }
      // o que as opções exigem: uma vez só, quando é o mesmo em todas
      const juntas = e.opcoes.length > 1 && new Set(e.opcoes.map(o => o.exige.texto)).size === 1;
      if (juntas) nota({ texto: e.opcoes[0].exige.texto + ' Vale pras ' + e.opcoes.length + ' opções.', base: e.opcoes[0].exige.base }, 2);
      e.opcoes.forEach((o, i) => {
        quebra(altura(o));   // a opção começa junto com a grade dela
        texto('Opção ' + (i + 1) + ': ' + o.titulo, { negrito: true, tam: 10, recuo: 2, depois: 0.8 });
        texto(o.horario.charAt(0).toUpperCase() + o.horario.slice(1) + ', ' + fmtNum(o.horasSemana) + ' horas por semana.', { recuo: 5, depois: 1.8 });
        if (!o.semGrade) { grade(o, 5); texto(garantias(o), { tam: 9, cor: [90, 90, 90], recuo: 5, depois: 1.2 }); }
        if (!juntas) nota(o.exige, 5);
        for (const n of o.notas) nota(n, 5);
        y += 1.5;
      });
    }
    y += 1;
    for (const n of gerais.values()) nota(n, 0);
  }

  if (plano && plano.escolha) {
    titulo('O que foi combinado');
    texto(plano.escolha);
  }

  titulo('Os próximos passos');
  item('Definir a escala nova de cada grupo' + (comOpcoes ? ' (as opções acima são o ponto de partida)' : '') + ' e assinar o aditivo de jornada com cada funcionário antes de ' + dataBr(DATA_42) + '.');
  item('Ajustar o horário no Domínio e mandar a alteração do contrato ao eSocial (o escritório faz).');
  item('Rever o acordo de compensação e o banco de horas pelo limite novo.');
  item('Conferir a convenção da categoria: o que ela diz de jornada e folga, e se permite passar das 8 horas por dia.');
  item('Avisar os funcionários da escala nova.');

  y += 2;
  texto('Pontos ainda em aberto: a escala 12x36 a partir de ' + dataBr(DATA_40) + ' (depende de lei ou de negociação coletiva) e a lei complementar de transição pras micro e pequenas empresas (EC 141, art. 5º), que ainda não existe (o STF deu ao Congresso 180 dias, em 12/11/2026, pras duas). Este relatório é uma estimativa com os dados disponíveis; a decisão é da empresa.', { tam: 8.5, cor: [110, 110, 110] });
  return doc;
}
