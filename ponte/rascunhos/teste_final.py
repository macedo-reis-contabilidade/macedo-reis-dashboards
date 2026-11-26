r"""teste_final.py — rascunho da fila de 24/11/2026 (a versão final do arquivo do teste do fechamento). A ponte NÃO usa.

Lê, só no PC:
  - as saídas das consultas de hoje (ponte/rascunhos/teste_*.sql e teste_final_*.sql), em
    C:\ponte-dominio\fechamento\teste\final\saida (uma por consulta; o teste_dia.sql e o teste_final_lancados.sql, uma
    por mês), e as de 18/11, em C:\ponte-dominio\fechamento\teste\saida, pra dizer o que mudou no Domínio desde então;
  - o arquivo das guias pagas da empresa, pela consulta de pagamentos do Integra (C:\ponte-dominio\receita\pagamentos\
    <CNPJ>.json; o CNPJ sai do cadastro do Domínio, pelo teste_final_empresa.sql, e nunca aparece na tela).
Escreve, só no PC, em C:\ponte-dominio\fechamento\teste\:
  - arquivo-final.csv: o que sempre entra (o item 2 da fila);
  - se-nao-integrar-fornecedores.csv, se-nao-integrar-pro-labore.csv e se-nao-apurar-das.csv: o que só entra se o
    Domínio não lançar (o item 3), cada um pra um caminho só;
  - os mesmos no leiaute 37 do importador do Domínio (os registros 0000, 6000 e 6100), com -leiaute.txt no nome;
  - relatorio.html: o de 18/11 com a parte "A versão final" no começo.
Na tela, só contagens e proporções: nenhum valor em reais, código de conta, número de guia, CNPJ ou dia de pagamento.
Nada é importado nem gravado no Domínio: quem roda as rotinas, importa e confere é quem cuida da contabilidade.

Este arquivo fica no repositório, que é público: nele não há código de empresa, código reduzido de conta nem valor. Os
dias e as frações dos honorários abaixo são os do sistema do escritório (o Conta Azul), como a fila os deu; H, o
honorário mensal de 2025, sai dos lançamentos da empresa na hora de rodar.

    py -3 ponte/rascunhos/teste_final.py               (grava os arquivos e o relatório; na tela, só contagens)
    py -3 ponte/rascunhos/teste_final.py --estrutura   (só mostra o que vai em cada arquivo, sem valor nem dia: pra
                                                        quem revisa; não grava nada)

Pra rodar as consultas: o código da empresa (do empresa.txt) entra no lugar do marcador só no corpo da consulta, sem os
comentários, e da saída do `dominio sql` só vão pra tela a contagem e o tempo — o `dominio sql` repete na tela o começo
da consulta já com a troca feita, e o código da empresa não pode aparecer.
"""
import collections
import csv
import datetime as dt
import html
import json
import pathlib
import re
import sys
from decimal import Decimal
from fractions import Fraction

import teste_fechamento as tf

PASTA = tf.PASTA
SAIDA_18 = tf.SAIDA                                  # as saídas de 18/11
SAIDA_HOJE = PASTA / 'final' / 'saida'               # as de hoje
GUIAS = pathlib.Path(r'C:\ponte-dominio\receita\pagamentos')

JANELA = ('2025-11-01', '2026-10-31')                # os 12 meses abertos, pelo dia do pagamento
MESES = tf.meses(*tf.ABERTOS)                        # 2025-11 … 2026-10
PRIMEIRO = dt.date(2025, 11, 30)                     # o que é de mês fechado entra aqui (o primeiro mês aberto)
PERIODOS = tf.meses('2025-10', '2026-09')            # os períodos de apuração pagos nos 12 meses
GPS_2025 = ('2025-07', '2025-08')                    # as GPS de 2025 que faltou lançar (pagas, pelo Integra)
UM = Fraction(1)
DEZ_POR_CENTO = Fraction(11, 10)

# Os honorários, pelo Conta Azul do escritório (a fila, item 2.4): a provisão de cada mês, o pagamento (o dia em que a
# empresa pagou, o mês da provisão e a fração de H), o adicional, os serviços extras e a declaração de MEI (item 2.5).
PROVISAO = [(m, UM if m <= '2026-01' else DEZ_POR_CENTO) for m in MESES]
PAGAMENTOS = [('2025-11-11', '2025-10', UM), ('2025-12-04', '2025-11', UM), ('2026-01-14', '2025-12', UM),
              ('2026-02-18', '2026-01', UM), ('2026-03-09', '2026-02', DEZ_POR_CENTO),
              ('2026-04-10', '2026-03', DEZ_POR_CENTO), ('2026-05-12', '2026-04', DEZ_POR_CENTO),
              ('2026-06-10', '2026-05', DEZ_POR_CENTO), ('2026-07-09', '2026-06', DEZ_POR_CENTO),
              ('2026-08-06', '2026-07', DEZ_POR_CENTO), ('2026-09-10', '2026-08', DEZ_POR_CENTO),
              ('2026-10-13', '2026-09', DEZ_POR_CENTO)]
ADICIONAL = ('2025-11-11', UM)
EXTRAS = [('2026-07-07', Fraction(19, 11), 'conferir: no Conta Azul está no nome de outra pessoa junto com o da empresa'),
          ('2026-10-13', Fraction(1, 22), '')]
MEI = ('2026-03-09', Fraction(6, 11))

# Os códigos de receita do DARF da previdência pela DCTFWeb (as contribuições previdenciárias; o pró-labore, a 1082)
PREVIDENCIA = {'1082', '1099', '1138', '1141', '1162', '1170', '1176', '1181', '1186', '1191', '1196', '1200', '1213',
               '1646', '1656', '1708', '1733'}
CENTAVO = Decimal('0.01')


def reais(x):
    return Decimal(str(x)).quantize(CENTAVO)


def dia(s):
    return dt.date.fromisoformat(str(s)[:10])


def ref(m):
    return tf.mm_aaaa(m)


# --------------------------------------------------------------------------------------------- as saídas do PC

def ler_bruto(nome, pasta=None):
    """A saída do `dominio sql` como texto, campo a campo (sem converter: o documento tem zeros na frente)."""
    linhas = tf._texto((pasta or SAIDA_HOJE) / f'{nome}.txt').splitlines()
    cab = [c.strip() for c in linhas[0].split('|')]
    out, rodape = [], None
    for l in linhas[1:]:
        if ' linha(s) em ' in l and not l.startswith('dominio sql'):
            rodape = l
        elif not l.startswith('dominio sql'):
            v = [c.strip() for c in l.split('|')]
            if len(v) == len(cab):
                out.append(dict(zip(cab, v)))
    m = re.match(r'([\d.]+) linha', rodape or '')
    if not m or int(m.group(1).replace('.', '')) != len(out):
        raise SystemExit(f'A saída {nome} está incompleta ou cortada (rode a consulta de novo).')
    return out


def dados(pasta):
    tf.SAIDA = pasta
    return tf.Dados()


def lancados(d):
    """Os lançamentos de hoje, um a um (teste_final_lancados.sql), dos meses abertos e de 11/2026."""
    out = []
    for f in sorted(SAIDA_HOJE.glob('lancados_*.txt')):
        for r in tf.ler_saida(f.stem):
            out.append({'dia': dia(r['dia']), 'lote': r['lote'], 'origem': r['origem'], 'debito': r['debito'] or 0,
                        'credito': r['credito'] or 0, 'valor': reais(r['valor']), 'incluido': str(r['incluido'])})
    return out


def o_que_mudou(d18, d):
    """De 12/2024 a 11/2026, as linhas de 18/11 contra as de hoje pela chave inteira do teste_dia.sql (o dia, a
    origem, a origem do registro, as duas contas e o dia de inclusão), com a contagem e a soma: uma integração refeita
    com as mesmas somas, mas noutras contas ou noutro dia de inclusão, também aparece. Devolve, por mês e origem, as
    linhas de 18/11 e as de hoje, só onde alguma chave difere."""
    def por(dd):
        return {(r['dia'], r['origem'], r['origem_reg'], r['debito'], r['credito'], r['incluido']):
                (r['linhas'], reais(r['soma'])) for r in dd.dia}
    a, b = por(d18), por(d)
    mudou = {(k[0].strftime('%Y-%m'), k[1]) for k in set(a) | set(b) if a.get(k) != b.get(k)}
    out = []
    for m, o in sorted(mudou):
        n18 = sum(v[0] for k, v in a.items() if k[0].strftime('%Y-%m') == m and k[1] == o)
        nh = sum(v[0] for k, v in b.items() if k[0].strftime('%Y-%m') == m and k[1] == o)
        out.append((m, o, n18, nh))
    return out


# --------------------------------------------------------------------------------------------- as guias do Integra

def tipo_da_guia(g):
    t = str(g.get('tipo_codigo') or '').strip()
    nome = str(g.get('tipo') or '').upper()
    codigos = {str(g.get('receita_codigo') or '')[:4]} | {str(p.get('receita_codigo') or '')[:4]
                                                          for p in g.get('partes') or []}
    textos = ' '.join([str(g.get('receita') or '')] + [str(p.get('receita') or '') for p in g.get('partes') or []]).upper()
    if t == '9' or nome == 'DAS':
        return 'das'
    if (t == '4' or nome == 'DARF') and (codigos & PREVIDENCIA or 'PREVID' in textos):
        return 'previdencia'
    return 'outra'


class Guia:
    def __init__(self, g):
        self.tipo = tipo_da_guia(g)
        self.pago = dia(g['arrecadado_em'])
        self.periodo = str(g.get('periodo_apuracao') or '')[:7]
        self.total = reais(g['valor_total'])
        self.multa = reais(g.get('multa') or 0)
        self.juros = reais(g.get('juros') or 0)
        self.principal = reais(g['principal']) if g.get('principal') is not None else \
            self.total - self.multa - self.juros
        self.fecha = abs(self.principal + self.multa + self.juros - self.total) <= CENTAVO

    @property
    def acrescimos(self):
        return self.multa + self.juros


def ler_guias():
    doc = ler_bruto('cnpj')[0]['documento']
    arq = GUIAS / f'{doc}.json'
    if not re.fullmatch(r'\d{14}', doc) or not arq.exists():
        return None
    return [Guia(g) for g in json.loads(arq.read_text(encoding='utf-8')).get('documentos') or []]


# --------------------------------------------------------------------------------------------- os lançamentos

class Lanc:
    """Um lançamento dos arquivos. Na partida múltipla, uma linha por perna, com o outro lado vazio e o mesmo lote."""

    def __init__(self, data, debito, credito, valor, historico, regra, fonte, conferir='', do_mes=None, lote=None):
        self.data, self.debito, self.credito = data, debito or '', credito or ''
        self.valor = reais(valor)
        self.historico, self.regra, self.fonte, self.conferir = historico, regra, fonte, conferir
        self.mes = data.strftime('%Y-%m')
        self.do_mes = do_mes or self.mes
        self.lote = lote


class Arquivo:
    def __init__(self, nome, quando):
        self.nome, self.quando, self.linhas, self._lote = nome, quando, [], 0

    def simples(self, *a, **k):
        self.linhas.append(Lanc(*a, **k))

    def multipla(self, data, debitos, credito, total, historico, regra, fonte, conferir='', do_mes=None):
        """Um crédito pra vários débitos (o tipo C do Domínio): debitos = [(conta, valor), …]."""
        self._lote += 1
        for c, v in debitos:
            self.linhas.append(Lanc(data, c, '', v, historico, regra, fonte, conferir, do_mes, self._lote))
        self.linhas.append(Lanc(data, '', credito, total, historico, regra, fonte, conferir, do_mes, self._lote))

    def ordenar(self):
        self.linhas.sort(key=lambda l: (l.data, l.lote or 0, l.credito != '', str(l.debito), str(l.credito)))

    def lotes(self):
        """Os lançamentos do arquivo: cada simples sozinho, cada partida múltipla junta."""
        out, vistos = [], {}
        for l in self.linhas:
            if l.lote is None:
                out.append([l])
            elif l.lote in vistos:
                vistos[l.lote].append(l)
            else:
                vistos[l.lote] = [l]
                out.append(vistos[l.lote])
        return out


def pagamento(arq, g, imposto, caixa, juros, historico, do_mes, decisao, data=None, regra='', separar=False):
    """O pagamento de uma guia: o principal contra o caixa; com multa e juros, a partida múltipla com o caixa, com a
    perna dos juros e da multa pelo que falta do principal ao total (o lote fecha por construção). A guia que não fecha
    (o principal, a multa e os juros não dão o total, ou o total passa do principal sem multa nem juros) e a guia com
    multa e juros sem a conta de juros não são geradas: vão pra `decisao`, com o tipo e o período. Devolve se gerou."""
    data = data or g.pago
    fonte = f'a consulta de pagamentos do Integra (pago em {tf.br(g.pago)})'
    qual = f'{"o DAS" if g.tipo == "das" else "o INSS"} de {ref(g.periodo)}'
    if not g.fecha or (not g.acrescimos and abs(g.total - g.principal) > CENTAVO):
        decisao.append(f'{qual}: o principal, a multa e os juros da guia não dão o total pago — não gerado')
        return False
    if not g.acrescimos:
        arq.simples(data, imposto, caixa, g.total, historico, regra, fonte, do_mes=do_mes)
        return True
    if not juros:
        decisao.append(f'{qual}: a guia tem multa e juros, e não há conta de juros e multas — não gerado')
        return False
    resto = g.total - g.principal
    if separar and g.multa and g.juros:
        deb = [(imposto, g.principal), (juros, g.multa), (juros, resto - g.multa)]
    else:
        deb = [(imposto, g.principal), (juros, resto)]
    arq.multipla(data, deb, caixa, g.total, historico, regra + ' (o principal, a multa e os juros)', fonte,
                 do_mes=do_mes)
    return True


# --------------------------------------------------------------------------------------------- a análise

class Final:
    def __init__(self):
        self.d18 = dados(SAIDA_18)
        self.d = dados(SAIDA_HOJE)          # daqui pra frente, as saídas de hoje
        import teste_acertos as ta          # depois de apontar o tf.SAIDA pras saídas de hoje
        self.a = ta.Analise(self.d).rodar()
        self.mudou = o_que_mudou(self.d18, self.d)
        self.lancados = lancados(self.d)
        self.guias = ler_guias()
        self.avisos, self.decisao, self.fora = [], [], []
        self.conferencia = {}

    # -- as contas: os pares que 2025 usava
    def contas(self):
        d = self.d
        pares = tf.pares_do_periodo(d, *tf.FECHADOS)
        par = {}
        for p in pares:          # do par mais frequente pro menos: vale o primeiro (o fixo, nos honorários)
            if p.eh_honorario():
                k = 'hon_' + p.honorario_papel()
                if p.fixo and k not in par:
                    par[k] = p
            elif p.grupos in (('21401', '11101'), ('21502', '11101')) and p.grupos not in par:
                par[p.grupos] = p
        self.p_das, self.p_inss = par.get(('21401', '11101')), par.get(('21502', '11101'))
        self.p_prov, self.p_pag = par.get('hon_provisao'), par.get('hon_pagamento')
        self.cx = self.p_das.par[1]
        self.imp = self.p_das.par[0]
        self.inss = self.p_inss.par[0]
        assert self.p_inss.par[1] == self.cx and self.p_pag.par[1] == self.cx, 'o caixa dos pares de 2025 não é um só'
        self.hon_desp, self.hon_pass = self.p_prov.par
        self.cli, self.forn = self.a.conta('11201'), self.a.conta('21301')
        self.pl = self.a.conta('21501', 'prolabore')
        # a conta de juros e multas: a das partidas múltiplas do contador em 2025
        lotes = collections.defaultdict(list)
        for r in d.contador:
            if tf.FECHADOS[0] <= r['mes'] <= tf.FECHADOS[1]:
                lotes[r['lote']].append(r)
        pm = [rs for rs in lotes.values() if rs[0]['tipo_lote'] == 'C']
        juros = [r['debito'] for rs in pm for r in rs if d.grupo(r['debito']) == '32205']
        self.juros = tf.moda(juros)
        self.pernas_juros = collections.Counter(sum(1 for r in rs if d.grupo(r['debito']) == '32205') for rs in pm)
        self.juros_de = 'a de 2025' if self.juros else None
        if not self.juros:   # sem ela, a do plano modelo (a primeira analítica do grupo com juros no nome)
            cand = [r for r in tf.ler_saida('plano') if str(r['grupo']) == '32205' and r['f_juros'] == 1]
            self.juros = cand[0]['reduzido'] if cand else None
            self.juros_de = 'a do plano' if self.juros else None
        # a apuração do DAS em 2025 (a provisão): o par da origem 10
        apur = [(r['debito'], r['credito']) for r in d.dia if r['origem'] == 10
                and tf.FECHADOS[0] <= r['mes'] <= tf.FECHADOS[1]]
        self.p_apur = tf.moda(apur)
        # a retirada do sócio: a conta de lucros distribuídos (ou de retirada) do plano
        # (só no ativo e no passivo: a "retirada" do nome de uma despesa — o pró-labore — não é retirada do sócio, e a
        # fila diz que a declaração de MEI não é despesa)
        plano = tf.ler_saida('plano')
        balanco = [r for r in plano if str(r['grupo'])[:1] in '12']
        dist = [r for r in balanco if r['f_distribuidos'] == 1 and r['f_a_distribuir'] == 0 and r['f_pagar'] == 0]
        ret = [r for r in balanco if r['f_retirada'] == 1 and r['f_a_distribuir'] == 0 and r['f_pagar'] == 0]
        cand = dist or ret
        self.retirada_na_despesa = sorted({str(r['grupo']) for r in plano if r['f_retirada'] == 1
                                           and str(r['grupo'])[:1] not in '12'})
        self.perto_da_retirada = sorted({str(r['grupo']) for r in balanco if r['f_lucro'] == 1 or r['f_dividendo'] == 1
                                         or r['f_socio'] == 1} - {'21401', '22301', '24203'})
        self.lucros = cand[0]['reduzido'] if cand else None
        self.lucros_como = (('lucros distribuídos' if dist else 'retirada de sócio') + f' ({len(cand)} no plano)') \
            if cand else None
        self.lucros_grupo = str(cand[0]['grupo']) if cand else None

    # -- item 1: as guias
    def guias_do_item1(self):
        g = self.guias
        jan = [x for x in g if JANELA[0] <= x.pago.isoformat() <= JANELA[1]]
        self.jan = jan
        self.das = sorted([x for x in jan if x.tipo == 'das'], key=lambda x: (x.pago, x.periodo))
        self.prev = sorted([x for x in jan if x.tipo == 'previdencia'], key=lambda x: (x.pago, x.periodo))
        self.outras = [x for x in jan if x.tipo == 'outra']
        self.gps25 = {p: sorted([x for x in g if x.tipo == 'previdencia' and x.periodo == p], key=lambda x: x.pago)
                      for p in GPS_2025}
        c = self.conferencia
        c['guias_no_arquivo'] = len(g)
        c['na_janela'] = collections.Counter(x.tipo for x in jan)
        c['das_periodos'] = collections.Counter(x.periodo for x in self.das)
        c['prev_periodos'] = collections.Counter(x.periodo for x in self.prev)
        c['com_acrescimo'] = sorted({(x.tipo, x.periodo) for x in jan if x.acrescimos})
        c['nao_fecha'] = sum(1 for x in jan if not x.fecha)
        esperado = {('das', p) for p in PERIODOS} | {('previdencia', p) for p in PERIODOS}
        tem = collections.Counter((x.tipo, x.periodo) for x in self.das + self.prev)
        c['faltam'] = sorted(esperado - set(tem))
        c['a_mais'] = sorted(k for k in tem if k not in esperado or tem[k] > 1)
        # 1.4: no Domínio, a provisão do DAS de 10/2025 e o INSS de cada período na folha integrada
        d = self.d
        c['apuracao_10_2025'] = any(r['mes'] == '2025-10' and r['origem'] == 10 and r['credito'] == self.imp
                                    for r in d.dia)
        inss_folha = {}
        for p in PERIODOS:
            rs = [r for r in d.dia if r['mes'] == p and r['origem'] == 13 and r['debito'] == self.pl
                  and r['credito'] == self.inss]
            v = sum((reais(r['soma']) for r in rs), Decimal(0))
            pagas = [x for x in self.prev if x.periodo == p]
            inss_folha[p] = (bool(rs), bool(pagas) and abs(v - sum(x.principal for x in pagas)) <= 1)
        c['inss_folha'] = inss_folha

    # -- H, o honorário mensal de 2025
    def honorario(self):
        base = reais(tf.honorario_base(self.p_prov))
        centavos = int(base * 100)
        fr = {f for _, f in PROVISAO} | {f for _, _, f in PAGAMENTOS} | {ADICIONAL[1], MEI[1]} | {f for _, f, _ in EXTRAS}
        self.h_fecha = all((centavos * f).denominator == 1 for f in fr)
        self.H = base
        prov10 = [reais(r['soma']) for r in self.d.dia if r['mes'] == '2025-10' and r['debito'] == self.hon_desp
                  and r['credito'] == self.hon_pass]
        self.prov_10_2025 = bool(prov10) and abs(prov10[0] - base) <= CENTAVO

    def de_h(self, f):
        """A fração f de H, em centavos exatos (só é chamada com o H que fecha: honorario())."""
        c = int(self.H * 100) * Fraction(f)
        assert c.denominator == 1, 'a fração de H não fecha em centavos'
        return (Decimal(c.numerator) / 100).quantize(CENTAVO)

    # -- item 2: o arquivo final
    def arquivo_final(self):
        a = Arquivo('arquivo-final.csv', 'sempre')
        separar = max(self.pernas_juros, default=1) > 1
        for g in self.das:
            pagamento(a, g, self.imp, self.cx, self.juros, f'PAGAMENTO DAS REF {ref(g.periodo)}', g.periodo,
                      self.decisao, regra='item 2.1: o pagamento do DAS no dia e no valor pagos', separar=separar)
        inss_folha = self.conferencia['inss_folha']
        for g in self.prev:
            if g.periodo in inss_folha and not inss_folha[g.periodo][1]:
                # o DARF não é só o INSS retido do pró-labore que a folha integrou: não cabe inteiro na conta dele
                self.decisao.append(f'o INSS de {ref(g.periodo)}: o principal do DARF não bate com o INSS retido que a '
                                    'folha integrou — não gerado')
                continue
            pagamento(a, g, self.inss, self.cx, self.juros, f'PAGAMENTO INSS REF {ref(g.periodo)}', g.periodo,
                      self.decisao, regra='item 2.2: o pagamento do INSS do pró-labore no dia e no valor pagos',
                      separar=separar)
        # 2.3: as GPS de 07 e 08/2025, em 30/11/2025 — só a guia que a prova no passado diz que falta no Domínio (a
        # que o contador já lançou em 2025, em qualquer dia, não entra de novo)
        self.gps25_estado = {}
        faltam = {id(g) for g, l, k in self.prova_linhas if g is not None and l is None}
        for p in GPS_2025:
            gs = self.gps25[p]
            if not gs:
                self.gps25_estado[p] = 'não achada no Integra'
                self.decisao.append(f'a GPS de {ref(p)}: a consulta de pagamentos não tem guia desse período')
                continue
            for g in gs:
                if g.pago.isoformat() >= JANELA[0]:
                    self.gps25_estado[p] = f'paga em {g.pago.strftime("%m/%Y")}, dentro dos 12 meses: já no item 2.2'
                    continue
                if id(g) not in faltam:
                    self.gps25_estado[p] = f'paga em {g.pago.strftime("%m/%Y")}, e o Domínio já tem o pagamento: não gerada'
                    self.decisao.append(f'a GPS de {ref(p)}: a prova no passado achou um lançamento dela em 2025 — não '
                                        'gerada; conferir')
                    continue
                self.gps25_estado[p] = f'paga em {g.pago.strftime("%m/%Y")}' + (', com multa e juros' if g.acrescimos
                                                                                 else ', sem multa nem juros') \
                    + ', e a prova diz que falta no Domínio'
                pagamento(a, g, self.inss, self.cx, self.juros, f'PAGAMENTO INSS REF {ref(p)} (PAGO EM {tf.br(g.pago)})',
                          p, self.decisao, data=PRIMEIRO,
                          regra='item 2.3: a GPS de 2025 paga e não lançada, no primeiro mês aberto', separar=separar)
        # 2.4: os honorários
        if self.h_fecha:
            for m, f in PROVISAO:
                a.simples(tf.data_no_mes(m, 30), self.hon_desp, self.hon_pass, self.de_h(f),
                          f'HONORARIOS CONTABEIS REF {ref(m)}', 'item 2.4: a provisão do honorário do mês, no dia 30 '
                          '(o último dia em fevereiro), como em 2025', 'o Conta Azul: ' + ('H' if f == UM else '1,1 H'))
            for x, m, f in PAGAMENTOS:
                a.simples(dia(x), self.hon_pass, self.cx, self.de_h(f), f'PAGAMENTO HONORARIOS CONTABEIS REF {ref(m)}',
                          'item 2.4: o pagamento, no dia e no valor pagos', 'o Conta Azul: ' + ('H' if f == UM else '1,1 H'),
                          do_mes=m)
            a.simples(dia(ADICIONAL[0]), self.hon_desp, self.cx, self.de_h(ADICIONAL[1]), 'HONORARIO ADICIONAL ANUAL 2025',
                      'item 2.4: o honorário adicional de 2025, na despesa de honorários contra o caixa',
                      'o Conta Azul: H', do_mes='2025-11')
            for x, f, conf in EXTRAS:
                a.simples(dia(x), self.hon_desp, self.cx, self.de_h(f), 'SERVICOS CONTABEIS EXTRAS',
                          'item 2.4: os serviços extras, na despesa de honorários contra o caixa',
                          f'o Conta Azul: {f.numerator}/{f.denominator} de H', conf)
            if self.lucros:
                a.simples(dia(MEI[0]), self.lucros, self.cx, self.de_h(MEI[1]), 'RETIRADA DE SOCIO REF 03/2026',
                          f'item 2.5: a declaração de MEI que a empresa pagou ao escritório, como retirada do sócio '
                          f'({self.lucros_como})', 'o Conta Azul: 6/11 de H')
            else:
                d = self.d
                self.decisao.append(
                    'a declaração de MEI paga ao escritório (09/03/2026), 6/11 de H, como retirada do sócio: o plano da '
                    'empresa não tem conta de lucros distribuídos nem de retirada de sócio no patrimônio — não gerada. '
                    'As contas que existem perto disso: ' + ', '.join(f'{g} {d.titulo(g)}' for g in self.perto_da_retirada)
                    + (('; e "retirada" só no nome de despesas (' + ', '.join(f'{g} {d.titulo(g)}' for g in
                       self.retirada_na_despesa) + '), que a fila diz que não é o caso') if self.retirada_na_despesa
                       else '') + '. Quem cuida da contabilidade escolhe a conta (ou cria a de lucros distribuídos).')
        else:
            self.avisos.append('o H de 2025 não fecha em centavos inteiros com as frações da fila: os honorários e a '
                               'declaração de MEI não foram gerados')
        # 2.6: o recebimento das vendas de 2026 (o ponto 3 de 18/11, sem a marca "conferir")
        for x in self.a.acertos:
            if x.ponto == 3:
                a.simples(x.data, x.debito, x.credito, x.valor, x.historico, 'item 2.6: o recebimento das vendas de '
                          '2026 no mês (o ponto 3 de 18/11)', x.fonte, do_mes=x.do_mes)
        a.ordenar()
        self.final = a

    # -- item 3: o que só entra se o Domínio não lançar
    def no_dominio(self, debito, credito, origens):
        """Os meses abertos em que o Domínio já tem o par, lançado pela integração (as origens)."""
        return sorted({r['mes'] for r in self.d.dia if r['mes'] in MESES and r['debito'] == debito
                       and r['credito'] == credito and r['origem'] in origens})

    def arquivos_se_nao(self):
        out = []
        # 3.1: o pagamento dos fornecedores (o ponto 4 de 18/11, com o prazo único do mês)
        f = Arquivo('se-nao-integrar-fornecedores.csv', 'se a integração das entradas não voltar a lançar o '
                    'pagamento dos fornecedores')
        ja = self.no_dominio(self.forn, self.cx, tf.FISCAL)
        for x in self.a.acertos:
            if x.ponto == 4 and x.mes not in ja:
                f.simples(x.data, x.debito, x.credito, x.valor, x.historico, 'item 3.1: o pagamento dos fornecedores, '
                          'no valor da compra do mês (o ponto 4 de 18/11)', x.fonte, do_mes=x.do_mes)
        f.ja = ja
        out.append(f)
        # 3.2: o pagamento do pró-labore (o ponto 7 de 18/11, o líquido da competência anterior)
        p = Arquivo('se-nao-integrar-pro-labore.csv', 'se a integração da folha não voltar a lançar o pagamento do '
                    'pró-labore')
        ja = self.no_dominio(self.pl, self.cx, {13})
        for x in self.a.acertos:
            if x.ponto == 7 and x.debito == self.pl and x.mes not in ja:
                p.simples(x.data, x.debito, x.credito, x.valor, x.historico, 'item 3.2: o pagamento do pró-labore, o '
                          'líquido da competência anterior (o ponto 7 de 18/11)', x.fonte, x.conferir, do_mes=x.do_mes)
        p.ja = ja
        out.append(p)
        # 3.3: a provisão do DAS de cada mês
        s = Arquivo('se-nao-apurar-das.csv', 'se a apuração dos 12 meses não for rodada no Domínio')
        deb, cre = self.p_apur
        ja = self.no_dominio(deb, cre, {10})
        self.das_sem_valor = []
        for m in MESES:
            if m in ja:
                continue
            v = self.d.valores.get(m, {}).get('imposto_44')
            fonte = f'o DAS que o Domínio apurou pra {ref(m)} (o imposto 44)'
            if not v:
                gs = [g for g in self.guias if g.tipo == 'das' and g.periodo == m]
                v = sum((g.principal for g in gs), Decimal(0)) or None
                fonte = f'o principal do DAS de {ref(m)} pelo Integra (sem a apuração no Domínio)'
            if not v:
                self.das_sem_valor.append(m)
                continue
            s.simples(tf.data_no_mes(m, 31), deb, cre, v, f'PROVISAO DAS REF {ref(m)}', 'item 3.3: a provisão do DAS '
                      'do mês, como a apuração lançava em 2025', fonte)
        s.ja = ja
        out.append(s)
        for x in out:
            x.ordenar()
        self.se_nao = out

    # -- item 4: a conferência
    def movimento(self, arquivos, extra=()):
        mov = collections.defaultdict(lambda: collections.defaultdict(Decimal))
        for arq in arquivos:
            for l in arq.linhas:
                if l.debito:
                    mov[l.data][l.debito] += l.valor
                if l.credito:
                    mov[l.data][l.credito] -= l.valor
        for data, c, v in extra:
            mov[data][c] += v
        return mov

    def saldos(self, mov):
        """O saldo no fim de cada mês aberto (o de hoje no Domínio mais os arquivos) e o menor saldo do caixa num dia."""
        S = self.d.saldos(tf.ABERTOS[1])
        base = {m: {c: reais(v) for c, v in S[m].items()} for m in MESES}
        dia_cx = collections.defaultdict(Decimal)          # o caixa de hoje, dia a dia, nos meses abertos
        for r in self.d.dia:
            if r['mes'] in MESES:
                if r['debito'] == self.cx:
                    dia_cx[r['dia']] += reais(r['soma'])
                if r['credito'] == self.cx:
                    dia_cx[r['dia']] -= reais(r['soma'])
        acum = collections.defaultdict(Decimal)
        out, menor = {}, None
        cx = reais(S[tf.mes_antes(MESES[0])].get(self.cx, 0))
        d0 = dt.date(2025, 11, 1)
        for i in range((dt.date(2026, 10, 31) - d0).days + 1):
            x = d0 + dt.timedelta(days=i)
            for c, v in mov.get(x, {}).items():
                acum[c] += v
            cx += dia_cx.get(x, Decimal(0)) + mov.get(x, {}).get(self.cx, Decimal(0))
            menor = cx if menor is None or cx < menor else menor
            m = x.strftime('%Y-%m')
            if x.day == tf.ultimo_dia(m):
                out[m] = {c: base[m].get(c, Decimal(0)) + acum.get(c, Decimal(0)) for c in set(base[m]) | set(acum)}
        return out, menor

    def simulacao(self):
        """O caso de tudo rodar no Domínio, com dias supostos: o pagamento do fornecedor no dia da compra (não é o
        jeito de 2025: em 2025 o pagamento integrado oscilava em volta da compra do mês, e o script mede quanto dele
        caiu num dia de compra), o do pró-labore no dia mais comum da folha em 2025 e a provisão do DAS no último dia do
        mês. No fim de cada mês dá os mesmos saldos do caso a; o que mostra a mais é o caixa num dia. Os meses em que o
        Domínio já lançou aquilo ficam de fora, como nos se-nao."""
        d = self.d
        ex = []
        ja_forn = set(self.se_nao[0].ja)
        for r in d.dia:
            if r['mes'] in MESES and r['mes'] not in ja_forn and r['origem'] in tf.FISCAL and r['debito'] \
                    and r['credito'] == self.forn and d.grupo(r['debito']) == '11501':
                ex += [(r['dia'], self.forn, reais(r['soma'])), (r['dia'], self.cx, -reais(r['soma']))]
        dias_pl = [r['dia'].day for r in d.dia if r['origem'] == 13 and r['debito'] == self.pl and r['credito'] == self.cx
                   and tf.FECHADOS[0] <= r['mes'] <= tf.FECHADOS[1]]
        self.dia_pl = tf.moda(dias_pl) or 5
        for x in self.se_nao[1].linhas:
            data = tf.data_no_mes(x.mes, self.dia_pl)
            ex += [(data, self.pl, x.valor), (data, self.cx, -x.valor)]
        for x in self.se_nao[2].linhas:
            ex += [(x.data, x.debito, x.valor), (x.data, x.credito, -x.valor)]
        # em 2025, quanto do pagamento dos fornecedores pela integração caiu num dia com compra
        pag = [(r['dia'], reais(r['soma'])) for r in d.dia if r['origem'] in tf.FISCAL and r['debito'] == self.forn
               and r['credito'] == self.cx and tf.FECHADOS[0] <= r['mes'] <= tf.FECHADOS[1]]
        com = {r['dia'] for r in d.dia if r['origem'] in tf.FISCAL and r['credito'] == self.forn}
        tot = sum((v for _, v in pag), Decimal(0))
        self.mesmo_dia_2025 = float(sum((v for x, v in pag if x in com), Decimal(0)) / tot) if tot else None
        return ex

    def em_aberto(self, saldos):
        """Por mês: quantas competências do DAS, do INSS e dos honorários estão em aberto (pela conta das guias, das
        provisões e dos pagamentos), e se o saldo da conta bate com elas."""
        d = self.d
        prov_das = {m: reais(v['imposto_44']) for m, v in d.valores.items() if v.get('imposto_44')}
        retido = {}
        for r in d.dia:
            if r['origem'] == 13 and r['debito'] == self.pl and r['credito'] == self.inss:
                retido[r['mes']] = retido.get(r['mes'], Decimal(0)) + reais(r['soma'])
        pago_das = collections.defaultdict(list)
        pago_inss = collections.defaultdict(list)
        for g in self.guias:
            if g.tipo == 'das':
                pago_das[g.periodo].append(g.pago)
            elif g.tipo == 'previdencia':
                pago_inss[g.periodo].append(g.pago)
        prov_hon = {m: (self.de_h(f) if self.h_fecha else None) for m, f in PROVISAO}
        out = {}
        for m in MESES:
            fim = dt.date.fromisoformat(m + f'-{tf.ultimo_dia(m):02d}')
            das = [c for c in prov_das if '2025-10' <= c <= m and not any(x <= fim for x in pago_das.get(c, []))]
            gps = [c for c in retido if '2025-10' <= c <= m and not any(x <= fim for x in pago_inss.get(c, []))]
            v_das = sum((prov_das[c] for c in das), Decimal(0))
            v_gps = sum((retido[c] for c in gps), Decimal(0))
            hon = -saldos[m].get(self.hon_pass, 0)
            out[m] = {'das': (len(das), abs(-saldos[m].get(self.imp, 0) - v_das) <= 1),
                      'inss': (len(gps), abs(-saldos[m].get(self.inss, 0) - v_gps) <= 1),
                      'hon': hon,
                      # o honorário a pagar no fim do mês é a provisão do próprio mês (paga no mês seguinte)
                      'hon_bate': prov_hon[m] is not None and abs(hon - prov_hon[m]) <= 1,
                      'cli': saldos[m].get(self.cli, 0), 'forn': -saldos[m].get(self.forn, 0),
                      'cx': saldos[m].get(self.cx, 0)}
        return out

    def conferir(self):
        a = self.a
        todos = [self.final] + self.se_nao
        self.saldo_a, self.menor_a = self.saldos(self.movimento(todos))
        sim = self.simulacao()
        self.saldo_b, self.menor_b = self.saldos(self.movimento([self.final], sim))
        self.saldo_so, self.menor_so = self.saldos(self.movimento([self.final]))
        self.saldo_hoje, self.menor_hoje = self.saldos({})
        self.aberto_a = self.em_aberto(self.saldo_a)
        self.aberto_b = self.em_aberto(self.saldo_b)
        self.vab, self.cab = a.vab, a.cab
        self.dobro_conferir()

    def prova_no_passado(self):
        """4.2: os pagamentos do DAS e da previdência de 01 a 10/2025 pelo Integra contra o que o contador lançou em
        2025: primeiro o mesmo dia e o mesmo valor; depois só o valor, com até um mês de diferença (o INSS do pró-labore
        tem o mesmo valor todo mês: sem o limite, uma guia casaria com o lançamento de outra competência). Roda antes
        do arquivo final: a GPS de 2025 só entra lá se a prova disser que falta no Domínio."""
        d = self.d
        lancs = [l for l in tf.lancamentos_do_contador(d, *tf.FECHADOS)
                 if (d.grupo(l.debito), d.grupo(l.credito)) in (('21401', '11101'), ('21502', '11101'))]
        total = {}
        for r in d.contador:
            if r['credito'] == self.cx and not r['debito']:
                total[r['lote']] = reais(r['soma'])
        gs = [g for g in self.guias if g.tipo in ('das', 'previdencia') and '2025-01-01' <= g.pago.isoformat() <= '2025-10-31']
        usados, prova = set(), collections.Counter()
        self.prova_linhas = []
        for passo in ('dia', 'valor'):
            for g in gs:
                if id(g) in usados:
                    continue
                conta = '21401' if g.tipo == 'das' else '21502'
                for i, l in enumerate(lancs):
                    if i in usados or d.grupo(l.debito) != conta:
                        continue
                    vale = abs(reais(l.valor) - g.principal) <= 1 or (l.pm and abs(total.get(l.lote, 0) - g.total) <= 1)
                    meses_entre = abs((l.dia.year - g.pago.year) * 12 + l.dia.month - g.pago.month)
                    if vale and (l.dia == g.pago if passo == 'dia' else meses_entre <= 1):
                        usados |= {i, id(g)}
                        prova['no dia' if l.dia == g.pago else 'só no valor'] += 1
                        self.prova_linhas.append((g, l, 'no dia' if l.dia == g.pago else 'só no valor'))
                        break
        for g in gs:
            if id(g) not in usados:
                prova['faltam'] += 1
                self.prova_linhas.append((g, None, 'falta no Domínio'))
        for i, l in enumerate(lancs):
            if i not in usados:
                prova['a mais'] += 1
                self.prova_linhas.append((None, l, 'no Domínio, sem guia'))
        self.prova = prova
        self.prova_guias = collections.Counter(g.tipo for g in gs)
        self.prova_faltam = sorted((g.tipo, g.periodo) for g, l, k in self.prova_linhas if g is not None and l is None)

    def dobro_conferir(self):
        """4.3: nada em dobro — o par, o dia e o valor de cada lançamento dos arquivos contra os de hoje no Domínio (os
        dos meses abertos: todo lançamento dos arquivos é de mês aberto; a GPS de 2025, datada de 30/11/2025, é
        protegida pela prova no passado, que só a deixa entrar quando falta no Domínio)."""
        todos = [self.final] + self.se_nao
        dom = collections.Counter((r['debito'] or 0, r['credito'] or 0, r['dia'], r['valor']) for r in self.lancados)
        self.dobro = {}
        for arq in todos:
            n = sum(1 for l in arq.linhas if dom.get((l.debito or 0, l.credito or 0, l.data, l.valor)))
            dentro = collections.Counter((l.debito, l.credito, l.data, l.valor, l.lote) for l in arq.linhas)
            self.dobro[arq.nome] = (n, sum(1 for k, v in dentro.items() if v > 1))
        entre = collections.Counter((l.debito, l.credito, l.data, l.valor) for arq in todos for l in arq.linhas
                                    if l.lote is None)
        self.dobro_entre = sum(1 for v in entre.values() if v > 1)

    # -- tudo
    def rodar(self):
        if self.guias is None:
            return False
        self.contas()
        self.guias_do_item1()
        self.honorario()
        self.prova_no_passado()
        self.arquivo_final()
        self.arquivos_se_nao()
        self.conferir()
        self.levar_avisos()
        datas = [l.data for arq in [self.final] + self.se_nao for l in arq.linhas]
        assert all(x >= dt.date(2025, 11, 1) for x in datas), 'lançamento em mês fechado'
        return True

    def levar_avisos(self):
        """O que só saía na tela do pedreiro vai também pra lista do relatório, que é o que quem cuida da contabilidade
        lê: as guias que faltam ou sobram contra os 24 esperados, as que não fecham, a provisão do DAS sem valor, o INSS
        da folha que não bate com a guia, o saldo que não bate com o que está em aberto."""
        c = self.conferencia
        for t, p in c['faltam']:
            self.avisos.append(f'falta a guia {"do DAS" if t == "das" else "do INSS"} de {ref(p)} na consulta de '
                               'pagamentos: o pagamento dela não está no arquivo final, e ela fica em aberto')
        for t, p in c['a_mais']:
            self.avisos.append(f'a guia {"do DAS" if t == "das" else "do INSS"} de {ref(p)} veio a mais ou repetida: '
                               'conferir')
        if c['nao_fecha']:
            self.avisos.append(f'{c["nao_fecha"]} guia(s) dos 12 meses em que o principal, a multa e os juros não dão '
                               'o total: não geradas (o "pede decisão")')
        for m in self.das_sem_valor:
            self.decisao.append(f'a provisão do DAS de {ref(m)}: sem o valor no Domínio nem no Integra — não gerada')
        for p, (tem, bate) in c['inss_folha'].items():
            if not tem:
                self.avisos.append(f'o INSS de {ref(p)} não está na folha integrada (a provisão)')
        for nome, ab in (('com os arquivos', self.aberto_a), ('com as rotinas', self.aberto_b)):
            for m, x in ab.items():
                ruins = [k for k, ok in (('o DAS', x['das'][1]), ('o INSS', x['inss'][1]), ('os honorários', x['hon_bate']))
                         if not ok]
                if ruins:
                    self.avisos.append(f'{ref(m)}, {nome}: o saldo de {" e ".join(ruins)} não bate com o que está em '
                                       'aberto')


# --------------------------------------------------------------------------------------------- os arquivos

COLUNAS = ['mes', 'data', 'conta_debito', 'conta_credito', 'valor', 'codigo_historico', 'historico', 'regra',
           'fonte_do_valor', 'conferir', 'do_mes', 'lote']


def escrever_csv(caminho, arq):
    """As colunas dos rascunhos de 18/11 e mais lote (a partida múltipla); ;, dd/mm/aaaa, vírgula decimal sem o ponto
    de milhar, UTF-8 com BOM."""
    with open(caminho, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f, delimiter=';', quoting=csv.QUOTE_MINIMAL)
        w.writerow(COLUNAS)
        for l in arq.linhas:
            w.writerow([tf.mm_aaaa(l.mes), tf.br(l.data), l.debito, l.credito, f'{l.valor:.2f}'.replace('.', ','), '',
                        l.historico, l.regra, l.fonte, l.conferir, tf.mm_aaaa(l.do_mes), l.lote or ''])


def escrever_leiaute(caminho, arq, documento):
    """O leiaute 37 do importador do Domínio (IMP_LEI_037, hierárquico, separado por |): |0000|inscrição da empresa|,
    e cada lançamento num |6000|tipo|||| (X um débito pra um crédito, C um crédito pra vários débitos) com as
    |6100|data|débito|crédito|valor|código do histórico|histórico|usuário|filial| dele; o valor com vírgula decimal."""
    linhas = [f'|0000|{documento}|']
    for grupo in arq.lotes():
        linhas.append(f'|6000|{"C" if len(grupo) > 1 else "X"}||||')
        for l in grupo:
            linhas.append(f'|6100|{tf.br(l.data)}|{l.debito}|{l.credito}|{l.valor:.2f}'.replace('.', ',')
                          + f'||{l.historico}|||')
    texto = '\r\n'.join(linhas) + '\r\n'
    caminho.write_bytes(texto.encode('cp1252'))


# --------------------------------------------------------------------------------------------- o relatório

def esc(x):
    return html.escape(str(x))


def br_reais(v):
    return tf.dinheiro(float(v))


def secao_html(f):
    d = f.d
    h = ['<!-- versao-final:inicio -->', '<h2>A versão final</h2>',
         f'<p class="nota">Gerada em {dt.datetime.now().strftime("%d/%m/%Y %H:%M")} pelo teste_final.py, com o que o '
         'Domínio tinha nesse dia e com a consulta de pagamentos do Integra. Só no PC do escritório. Nada foi importado '
         'nem lançado no Domínio. O resto deste relatório (os pontos a ajustar e as partes de a a g) é o de 18/11.</p>',
         '<p class="ponto"><b>Não importe os rascunhos de 18/11</b> (<code>rascunho-lancamentos.csv</code> e '
         '<code>rascunho-acertos.csv</code>, na mesma pasta): ficaram só como referência. Os arquivos abaixo tomam o '
         'lugar deles, e importar os dois lançaria o DAS, a GPS e os honorários em dobro.</p>']
    # o que vai em cada arquivo
    h.append('<h3>Os arquivos</h3><ul>')
    for arq in [f.final] + f.se_nao:
        h.append(f'<li><b>{esc(arq.nome)}</b> ({esc(arq.quando)}): {len(arq.lotes())} lançamentos'
                 + (f', {sum(1 for g in arq.lotes() if len(g) > 1)} em partida múltipla' if any(len(g) > 1 for g in arq.lotes()) else '')
                 + (f'. Fora dele, os meses em que o Domínio já lançou: {esc(", ".join(ref(m) for m in arq.ja))}'
                    if getattr(arq, 'ja', None) else '') + '. Também no leiaute do importador: '
                 + f'<code>{esc(arq.nome.replace(".csv", "-leiaute.txt"))}</code>.</li>')
    h.append('</ul>')
    # a ordem
    marcadas = [(arq.nome, l) for arq in [f.final] + f.se_nao for l in arq.linhas if l.conferir]
    por_arq = collections.Counter(n for n, _ in marcadas)
    lista = ''.join(f'<li><code>{esc(n)}</code>: {esc(tf.br(l.data))}, {esc(l.historico)} — {esc(l.conferir)}</li>'
                    for n, l in marcadas if por_arq[n] <= 3)
    lista += ''.join(f'<li><code>{esc(n)}</code>: as {k} linhas — {esc(next(l.conferir for m, l in marcadas if m == n))}'
                     '</li>' for n, k in por_arq.items() if k > 3)
    h.append('<h3>A ordem pra quem cuida da contabilidade</h3><ol>'
             '<li>No Domínio: rodar a apuração dos 12 meses (a provisão do DAS de 11/2025 a 10/2026) e as integrações que '
             'pararam — o pagamento do pró-labore pela folha e o pagamento dos fornecedores pelas entradas (e integrar '
             'de novo as entradas de 11/2025, a linha que faltava em 18/11).</li>'
             '<li><b>Depois do passo 1, pedir que o teste_final.py rode de novo</b> (as consultas do Domínio e o script, '
             'pelo pedreiro): os arquivos <code>se-nao-…</code> saem sem os meses que o Domínio passou a lançar, e a '
             'compra de 11/2025 sai com a linha integrada de novo. Os arquivos desta rodada valem pro Domínio de hoje. '
             'Se não der pra rodar de novo: tirar de cada <code>se-nao-…</code> os meses (a coluna <code>mes</code>) em '
             'que o Domínio lançou aquilo.</li>'
             '<li>Resolver as linhas marcadas "conferir" antes de importar (a marca fica no .csv e neste relatório, não '
             'vai no arquivo do leiaute nem no histórico):<ul>' + (lista or '<li>nenhuma</li>') + '</ul>'
             'O serviço extra que no Conta Azul está no nome de outra pessoa: se não for da empresa, tirar a linha do '
             'arquivo antes de importar.</li>'
             '<li>No importador do Domínio, escolher o leiaute 37 (<code>IMP_LEI_037</code>, os registros 0000, 6000 e '
             '6100) e conferir na tela que é o que o escritório usa e que ele não pede outro registro. É o mais provável '
             '(tem débito, crédito e partida múltipla), sem confirmação.</li>'
             '<li>Importar o <code>arquivo-final-leiaute.txt</code> (o mesmo do <code>arquivo-final.csv</code>). Os '
             'históricos vão em texto, sem o código do histórico padrão que 2025 usava: dá pra trocar pelo código, se '
             'preferir.</li>'
             '<li>Importar <b>só</b> os arquivos <code>se-nao-…</code> do que o Domínio não lançou no passo 1: cada coisa '
             'entra por um caminho só, senão entra em dobro.</li>'
             '<li>Conferir os saldos no fim de cada mês com o quadro abaixo.</li></ol>')
    # as guias
    c = f.conferencia
    h.append('<h3>As guias pagas, pela consulta do Integra</h3>')
    linhas = []
    for g in sorted(f.das + f.prev, key=lambda g: (g.tipo, g.periodo, g.pago)):
        linhas.append([esc('DAS' if g.tipo == 'das' else 'INSS (DARF da previdência)'), esc(ref(g.periodo)),
                       esc(tf.br(g.pago)), br_reais(g.principal), br_reais(g.multa), br_reais(g.juros), br_reais(g.total)])
    h.append(tf.tabela(['guia', 'período', 'pago em', 'principal', 'multa', 'juros', 'total'], linhas))
    for p in GPS_2025:
        for g in f.gps25[p]:
            h.append(f'<p>A GPS de {esc(ref(p))}: paga em {esc(tf.br(g.pago))}, principal {br_reais(g.principal)}, multa '
                     f'{br_reais(g.multa)}, juros {br_reais(g.juros)}.</p>')
    if f.outras:
        h.append('<p>Outras guias pagas nos 12 meses (fora do arquivo): ' + esc(', '.join(
            f'{g.tipo} de {ref(g.periodo)} em {tf.br(g.pago)}' for g in f.outras)) + '</p>')
    # os arquivos, linha a linha
    for arq in [f.final] + f.se_nao:
        h.append(f'<h3>{esc(arq.nome)}</h3>')
        h.append(tf.tabela(['data', 'débito', 'crédito', 'valor', 'histórico', 'do mês', 'lote', 'regra', 'conferir'],
                           [[esc(tf.br(l.data)), esc(d.nome_conta(l.debito) if l.debito else ''),
                             esc(d.nome_conta(l.credito) if l.credito else ''), br_reais(l.valor), esc(l.historico),
                             esc(ref(l.do_mes)), esc(l.lote or ''), esc(l.regra), esc(l.conferir)] for l in arq.linhas]))
    # os saldos
    h.append('<h3>Os saldos no fim de cada mês</h3><p>Hoje no Domínio; com o <code>arquivo-final.csv</code> e os três '
             'arquivos <code>se-nao-…</code> (o caso de nada rodar no Domínio); e com o arquivo final e as rotinas '
             'rodadas no Domínio, simuladas com dias supostos: o pagamento do fornecedor no dia da compra (não é o jeito '
             f'de 2025: em 2025 só {frac(f.mesmo_dia_2025 or 0)} do pagamento integrado caiu num dia de compra), o do '
             f'pró-labore no dia {f.dia_pl} (o mais comum da folha em 2025) e a provisão do DAS no último dia. No fim de '
             'cada mês o segundo caso dá os mesmos saldos do primeiro: o que ele mostra a mais é só o caixa num dia. Em '
             'vermelho, o saldo do lado contrário da natureza.</p>')
    contas = [('o caixa', f.cx), ('clientes', f.cli), ('fornecedores', f.forn), ('o DAS a recolher', f.imp),
              ('o INSS a recolher', f.inss), ('o pró-labore a pagar', f.pl), ('os honorários a pagar', f.hon_pass)]
    for titulo, S in (('hoje no Domínio', f.saldo_hoje), ('com os arquivos (nada roda no Domínio)', f.saldo_a),
                      ('com o arquivo final e as rotinas no Domínio', f.saldo_b)):
        linhas = []
        for nome, c0 in contas:
            cel = []
            for m in MESES:
                x = S[m].get(c0, Decimal(0))
                n = d.lado(c0)
                contra = (n == 'D' and x < -CENTAVO) or (n == 'C' and x > CENTAVO)
                cel.append(f'<span class="{"contra" if contra else ""}">{br_reais(x)}</span>')
            linhas.append([esc(nome), esc(d.nome_conta(c0))] + cel)
        h.append(f'<p><b>{esc(titulo)}</b></p>' + tf.tabela(['', 'conta'] + [ref(m) for m in MESES], linhas))
    # a prova e o dobro
    h.append('<h3>A prova no passado (01 a 10/2025)</h3><p>Os pagamentos do DAS e da previdência pelo Integra contra '
             'o que o contador lançou em 2025.</p>')
    h.append(tf.tabela(['resultado', 'guia', 'período', 'pago em', 'principal', 'total', 'lançado em', 'valor lançado'],
                       [[esc(k), esc(g.tipo if g else ''), esc(ref(g.periodo) if g else ''), esc(tf.br(g.pago) if g else ''),
                         br_reais(g.principal) if g else '', br_reais(g.total) if g else '', esc(tf.br(l.dia) if l else ''),
                         br_reais(l.valor) if l else ''] for g, l, k in f.prova_linhas]))
    h.append('<p>Nada em dobro: ' + esc('; '.join(f'{k}: {v[0]} igual a um lançamento que já está no Domínio'
                                                  for k, v in f.dobro.items())) + '.</p>')
    # o que pede decisão e o que ficou de fora
    h.append('<h3>O que pede decisão e o que ficou de fora</h3><ul>')
    for x in f.decisao:
        h.append(f'<li><b>Pede decisão:</b> {esc(x)}</li>')
    for x in f.avisos:
        h.append(f'<li><b>Aviso:</b> {esc(x)}</li>')
    for x in FORA:
        h.append(f'<li>{esc(x)}</li>')
    h.append('</ul>')
    if f.mudou:
        h.append('<h3>O que mudou no Domínio desde 18/11</h3>' + tf.tabela(
            ['mês', 'origem', 'linhas em 18/11', 'linhas hoje'],
            [[esc(ref(m)), esc(o), esc(a), esc(b)] for m, o, a, b in f.mudou]))
    h.append('<!-- versao-final:fim -->')
    return '\n'.join(h)


FORA = [
    'O custo das mercadorias: o estoque vem da empresa, em 31/12 (decidido em 18/11).',
    'O caixa que sobra sem explicação: com o cliente, em janeiro.',
    'O contas a pagar do lado contrário da natureza (desde antes de 2025): depois, com o fiscal.',
    'O pagamento do honorário de 10/2026 (a provisão está no arquivo final) e o honorário adicional de 2026: pagos em '
    '11/11/2026, entram no fechamento de 11/2026.',
    'Os serviços avulsos de 05/2025 e 10/2025 que a fila de 18/11 listava: não estão na tabela da fila de 24/11 e '
    'não foram gerados.',
]


def gravar_relatorio(f):
    arq = PASTA / 'relatorio.html'
    corpo = arq.read_text(encoding='utf-8')
    corpo = re.sub(r'<!-- versao-final:inicio -->.*?<!-- versao-final:fim -->\n?', '', corpo, flags=re.S)
    m = re.search(r'<h1>.*?</h1>\s*<p class="nota">.*?</p>', corpo, flags=re.S)
    if not m:
        raise SystemExit('O relatorio.html de 18/11 não tem o cabeçalho esperado.')
    corpo = corpo[:m.end()] + '\n' + secao_html(f) + '\n' + corpo[m.end():]
    arq.write_text(corpo, encoding='utf-8')


# --------------------------------------------------------------------------------------------- a tela

def frac(x, base=1):
    """x ÷ base, com duas casas e vírgula (a proporção, pra tela)."""
    return f'{float(x) / float(base):.2f}'.replace('.', ',')


def estrutura(f):
    """--estrutura: o que vai em cada arquivo, linha a linha, sem nada da empresa — o mês, as contas pelo grupo de 5
    dígitos, o histórico, a regra, a marca, o mês a que se refere e o lote; nenhum valor, nenhum dia (nem o que vai
    dentro do histórico, como o "(PAGO EM …)" das GPS de 2025). É o que se mostra a quem revisa. Não grava nada."""
    d = f.d
    sem_dia = lambda s: re.sub(r'\b\d{2}/\d{2}/\d{4}\b', 'dd/mm/aaaa', str(s))
    for arq in [f.final] + f.se_nao:
        print(f'== {arq.nome}: {len(arq.lotes())} lançamentos, {len(arq.linhas)} linhas · colunas: {";".join(COLUNAS)}')
        for l in arq.linhas:
            print('  ', ref(l.mes), '|', d.grupo(l.debito) if l.debito else '-', '|', d.grupo(l.credito) if l.credito else '-',
                  '| valor # |', sem_dia(l.historico), '|', sem_dia(l.regra), '|', sem_dia(l.conferir), '| do mês',
                  ref(l.do_mes), '| lote', l.lote or '-')


def main():
    if not (PASTA / 'empresa.txt').exists() or not (SAIDA_HOJE / 'contas.txt').exists():
        print('Faltam as saídas das consultas de hoje em', SAIDA_HOJE)
        return 2
    f = Final()
    if not f.rodar():
        print('Sem o arquivo das guias da empresa na pasta dos pagamentos do Integra: nada foi gravado.')
        return 3
    if '--estrutura' in sys.argv:
        estrutura(f)
        return 0
    documento = ler_bruto('cnpj')[0]['documento']
    for arq in [f.final] + f.se_nao:
        escrever_csv(PASTA / arq.nome, arq)
        escrever_leiaute(PASTA / arq.nome.replace('.csv', '-leiaute.txt'), arq, documento)
    gravar_relatorio(f)
    c = f.conferencia
    print(f'o que mudou no Domínio desde 18/11 (mês e origem com outras linhas ou outra soma): {len(f.mudou)}'
          + (' — ' + ', '.join(f'{ref(m)} origem {o}: {a}→{b} linhas' for m, o, a, b in f.mudou) if f.mudou else ''))
    print(f'guias no arquivo do Integra: {c["guias_no_arquivo"]} · nos 12 meses: {dict(c["na_janela"])} · '
          'principal + multa + juros = total: ' + ('sim' if not c['nao_fecha'] else f'não em {c["nao_fecha"]}'))
    print('  DAS por período:', ' '.join(f'{ref(p)}×{n}' for p, n in sorted(c['das_periodos'].items())))
    print('  previdência por período:', ' '.join(f'{ref(p)}×{n}' for p, n in sorted(c['prev_periodos'].items())))
    print('  com multa e juros:', ', '.join(f'{t} {ref(p)}' for t, p in c['com_acrescimo']) or 'nenhuma')
    print('  faltam, dos 24 esperados:', ', '.join(f'{t} {ref(p)}' for t, p in c['faltam']) or 'nenhuma',
          '· a mais ou repetidas:', ', '.join(f'{t} {ref(p)}' for t, p in c['a_mais']) or 'nenhuma')
    print('  as GPS de 2025:', '; '.join(f'{ref(p)}: {v}' for p, v in f.gps25_estado.items()))
    print(f'  no Domínio: a provisão do DAS de 10/2025 {"existe" if c["apuracao_10_2025"] else "NÃO existe"} · o INSS na '
          f'folha integrada: em {sum(1 for v in c["inss_folha"].values() if v[0])} dos {len(PERIODOS)} períodos (sem: '
          f'{", ".join(ref(p) for p, v in c["inss_folha"].items() if not v[0]) or "nenhum"}), com o valor da guia em '
          f'{sum(1 for v in c["inss_folha"].values() if v[1])}')
    print(f'H: {"fecha em centavos inteiros com 1,1 H, 19/11, 1/22 e 6/11" if f.h_fecha else "NÃO fecha"} · a provisão de '
          f'10/2025 lançada é H: {"sim" if f.prov_10_2025 else "não"} · a conta da retirada: '
          f'{f.lucros_como or "nenhuma"}' + (f', grupo {f.lucros_grupo}' if f.lucros_grupo else '')
          + f' · a de juros e multas: {f.juros_de or "nenhuma"} (pernas de juros por lote em 2025: {dict(f.pernas_juros)})')
    for arq in [f.final] + f.se_nao:
        por = collections.Counter(l.regra.split(':')[0] for l in arq.linhas if l.credito or l.lote is None)
        print(f'{arq.nome}: {len(arq.lotes())} lançamentos ({len(arq.linhas)} linhas, '
              f'{sum(1 for g in arq.lotes() if len(g) > 1)} partidas múltiplas) · {dict(por)}'
              + (f' · fora (o Domínio já tem): {", ".join(ref(m) for m in arq.ja)}' if getattr(arq, 'ja', None) else ''))
    if f.das_sem_valor:
        print('  provisão do DAS sem valor (nem o Domínio nem o Integra):', ', '.join(ref(m) for m in f.das_sem_valor))
    for nome, S, ab, menor in (('a (os arquivos, nada roda)', f.saldo_a, f.aberto_a, f.menor_a),
                               ('b (as rotinas no Domínio)', f.saldo_b, f.aberto_b, f.menor_b)):
        cxneg = [m for m in MESES if ab[m]['cx'] < 0]
        print(f'saldos, caso {nome}: o caixa negativo no fim de {len(cxneg)} mês(es), no dia mais baixo '
              f'{"negativo" if menor < 0 else "positivo"}; no fim de 10/2026 {frac(ab["2026-10"]["cx"], f.vab)} meses de '
              f'vendas (hoje {frac(f.saldo_hoje["2026-10"].get(f.cx, 0), f.vab)})')
        print('  DAS em aberto por mês:', ' '.join(f'{ab[m]["das"][0]}{"" if ab[m]["das"][1] else "!"}' for m in MESES),
              '· INSS em aberto:', ' '.join(f'{ab[m]["inss"][0]}{"" if ab[m]["inss"][1] else "!"}' for m in MESES))
        hon = [ab[m]['hon'] for m in MESES]
        print(f'  honorários a pagar (batem com a provisão do mês até R$ 1,00 em {sum(1 for m in MESES if ab[m]["hon_bate"])} '
              'de 12), em honorários:', ' '.join(frac(x, f.H) for x in hon),
              '· clientes no fim do mês, em meses de vendas:', ' '.join(frac(ab[m]['cli'], f.vab) for m in MESES))
        print('  fornecedores, em meses de compras:', ' '.join(frac(ab[m]['forn'], f.cab) for m in MESES))
    so = f.em_aberto(f.saldo_so)
    print('só o arquivo final, sem o Domínio rodar nem os se-nao: o DAS a recolher no fim de 10/2026',
          'do lado contrário' if f.saldo_so['2026-10'].get(f.imp, 0) > 0 else 'do lado certo',
          f'· o caixa no dia mais baixo {"negativo" if f.menor_so < 0 else "positivo"}')
    print(f'em 2025, o pagamento dos fornecedores pela integração num dia com compra: '
          f'{frac(f.mesmo_dia_2025) if f.mesmo_dia_2025 is not None else "-"} do valor · o dia do pró-labore: {f.dia_pl}')
    print(f'prova no passado (01 a 10/2025): guias {dict(f.prova_guias)} · {dict(f.prova)} · as que faltam: '
          + (', '.join(f'{t} {ref(p)}' for t, p in f.prova_faltam) or 'nenhuma')
          + f' · são as GPS de 2025 da fila: {"sim" if f.prova_faltam == [("previdencia", p) for p in GPS_2025] else "não"}')
    print('em dobro com o Domínio de hoje:', {k: v[0] for k, v in f.dobro.items()}, '· repetidos dentro do arquivo:',
          {k: v[1] for k, v in f.dobro.items()}, f'· iguais entre os arquivos: {f.dobro_entre}')
    print('pede decisão:', len(f.decisao), '· avisos:', len(f.avisos))
    print('gravados em', PASTA, ': os 4 csv, os 4 -leiaute.txt e o relatorio.html (a parte "A versão final" no começo)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
