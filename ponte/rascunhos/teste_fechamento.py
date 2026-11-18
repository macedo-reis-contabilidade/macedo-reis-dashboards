r"""teste_fechamento.py — rascunho da fila de 17/11/2026 (o teste do fechamento numa empresa). A ponte NÃO usa.

Lê as saídas das consultas ponte/rascunhos/teste_*.sql, gravadas no PC em C:\ponte-dominio\fechamento\teste\saida
(uma por consulta; o teste_dia.sql, uma por mês: dia_AAAA-MM.txt), e escreve, só no PC, em
C:\ponte-dominio\fechamento\teste\:
  - rascunho-lancamentos.csv: os lançamentos dos 12 meses abertos, no padrão que a própria empresa usou em 2025;
  - relatorio.html: como 2025 foi lançado, o que a integração já lança, os saldos, o rascunho, a prova no passado, o
    que ficou de fora e as dúvidas pra quem cuida da contabilidade.
Na tela, só contagens. Nada é importado nem gravado no Domínio: quem confere e importa é quem cuida da contabilidade.

Este arquivo fica no repositório, que é público: nele não há código de empresa, código reduzido de conta nem valor. O
que é desta empresa sai dos arquivos do PC na hora de rodar. As datas e o reajuste dos honorários abaixo são os do
sistema do escritório, como a fila os deu.

    py -3 ponte/rascunhos/teste_fechamento.py

O teste_acertos.py (a fila seguinte) importa este módulo.
"""
import collections
import csv
import datetime as dt
import html
import pathlib
import re
import statistics
import sys

PASTA = pathlib.Path(r'C:\ponte-dominio\fechamento\teste')
SAIDA = PASTA / 'saida'
MODELO_GRUPOS = pathlib.Path(r'C:\ponte-dominio\fechamento\modelo_grupos.txt')

FECHADOS = ('2025-01', '2025-10')      # o que está fechado (a contabilidade feita)
ABERTOS = ('2025-11', '2026-10')       # o que o rascunho preenche
REGUA_FIXO = 8                          # o par entra quando aparece em 8 dos 10 meses fechados ou mais
TOLERANCIA = 1.00                       # o casamento do valor, até R$ 1,00

# Os honorários, pelo sistema do escritório (a fila de 17/11/2026, itens 1.4 e 2.1)
HONORARIO_PAGO_2025 = ['2025-01-14', '2025-02-10', '2025-03-18', '2025-04-10', '2025-05-19', '2025-06-06',
                       '2025-07-08', '2025-08-08', '2025-09-09', '2025-10-14']
HONORARIO_PAGO_ABERTOS = ['2025-11-11', '2025-12-04', '2026-01-14', '2026-02-18', '2026-03-09', '2026-04-10',
                          '2026-05-12', '2026-06-10', '2026-07-09', '2026-08-06', '2026-09-10', '2026-10-13']
HONORARIO_REAJUSTE_PAGAMENTO_DESDE = '2026-03'   # os pagamentos de 03/2026 em diante, 10% a mais
HONORARIO_REAJUSTE = 1.10
HONORARIO_ADICIONAL_PAGO = '2025-11-11'          # o adicional do ano: não é gerado, vai pra lista do que ficou de fora

FISCAL = set(range(4, 10)) | {11} | set(range(21, 30))
NOME_ORIGEM = {1: 'o contador', 2: 'o zeramento', 10: 'a apuração da escrita fiscal', 13: 'a folha', 39: 'o extrato'}


# ------------------------------------------------------------------------------------------------ leitura dos arquivos

def _texto(caminho):
    b = pathlib.Path(caminho).read_bytes()
    try:
        return b.decode('utf-8')
    except UnicodeDecodeError:
        return b.decode('cp1252', errors='replace')


def _valor(x):
    if re.fullmatch(r'-?\d+', x):
        return int(x)
    if re.fullmatch(r'-?\d+\.\d+', x):
        return float(x)
    return x


def ler_saida(nome):
    """A saída do `dominio sql` (o cabeçalho, as linhas com ' | ', o rodapé) como lista de dicionários."""
    linhas = _texto(SAIDA / f'{nome}.txt').splitlines()
    if not linhas:
        return []
    cab = [c.strip() for c in linhas[0].split('|')]
    out = []
    rodape = None
    for l in linhas[1:]:
        if ' linha(s) em ' in l and not l.startswith('dominio sql'):
            rodape = l
            continue
        if l.startswith('dominio sql'):
            continue
        v = [c.strip() for c in l.split('|')]
        if len(v) == len(cab):
            out.append({c: _valor(x) for c, x in zip(cab, v)})
    m = re.match(r'([\d.]+) linha', rodape or '')
    if not m or 'e mais' in rodape or int(m.group(1).replace('.', '')) != len(out):
        raise SystemExit(f'A saída {nome} está incompleta ou cortada (rode a consulta de novo, com --linhas maior).')
    return out


def meses(de, ate):
    a, m = map(int, de.split('-'))
    A, M = map(int, ate.split('-'))
    r = []
    while (a, m) <= (A, M):
        r.append(f'{a}-{m:02d}')
        a, m = (a + 1, 1) if m == 12 else (a, m + 1)
    return r


def mes_antes(m, n=1):
    a, mm = map(int, m.split('-'))
    for _ in range(n):
        a, mm = (a - 1, 12) if mm == 1 else (a, mm - 1)
    return f'{a}-{mm:02d}'


def ultimo_dia(m):
    a, mm = map(int, m.split('-'))
    prox = dt.date(a + (mm == 12), 1 if mm == 12 else mm + 1, 1)
    return (prox - dt.timedelta(days=1)).day


def data_no_mes(m, dia):
    a, mm = map(int, m.split('-'))
    return dt.date(a, mm, min(dia, ultimo_dia(m)))


def br(d):
    return d.strftime('%d/%m/%Y')


def dinheiro(v):
    s = f'{abs(v):,.2f}'.replace(',', '_').replace('.', ',').replace('_', '.')
    return ('-' if v < 0 else '') + s


def mm_aaaa(m):
    return f'{m[5:]}/{m[:4]}'


class Dados:
    """Tudo o que as consultas trouxeram da empresa, no PC."""

    def __init__(self):
        self.titulos = {}
        if MODELO_GRUPOS.exists():
            for l in _texto(MODELO_GRUPOS).splitlines()[1:]:
                p = [c.strip() for c in l.split('|')]
                if len(p) == 3:
                    self.titulos[p[0]] = p[2]
        self.contas = {}
        for c in ler_saida('contas'):
            c['grupo'] = str(c['grupo'])
            c['classificacao'] = str(c['classificacao'])
            self.contas[c['reduzido']] = c
        self.dia = []
        for f in sorted(SAIDA.glob('dia_*.txt')):
            for r in ler_saida(f.stem):
                r['debito'], r['credito'] = r['debito'] or 0, r['credito'] or 0
                r['dia'] = dt.date.fromisoformat(str(r['dia']))
                r['incluido'] = str(r['incluido'])
                r['mes'] = r['dia'].strftime('%Y-%m')
                r['soma'] = float(r['soma'])
                self.dia.append(r)
        self.contador = []
        for r in ler_saida('contador'):
            r['debito'], r['credito'] = r['debito'] or 0, r['credito'] or 0
            r['dia'] = dt.date.fromisoformat(str(r['dia']))
            r['mes'] = r['dia'].strftime('%Y-%m')
            r['soma'] = float(r['soma'])
            r['incluido'] = str(r['incluido'])
            self.contador.append(r)
        self.valores = collections.defaultdict(dict)
        for r in ler_saida('valores'):
            self.valores[str(r['competencia'])][r['tipo']] = float(r['valor'])
        self.saldo_inicial = {r['reduzido']: float(r['saldo']) for r in ler_saida('saldo_inicial')}

    # -- as contas
    def grupo(self, cta):
        if not cta:
            return 'PM'
        return self.contas[cta]['grupo'] if cta in self.contas else '?'

    def titulo(self, g):
        if g == 'PM':
            return 'partida múltipla'
        return self.titulos.get(g, '(fora do plano modelo)')

    def nome_conta(self, cta):
        """O reduzido e o título do grupo (só no PC)."""
        if not cta:
            return 'partida múltipla'
        return f'{cta} · {self.grupo(cta)} {self.titulo(self.grupo(cta))}'

    def lado(self, cta):
        c = self.contas.get(cta)
        if not c or not c.get('natureza'):
            return None
        n = c['natureza']
        if c.get('retificadora'):
            n = 'C' if n == 'D' else 'D'
        return n

    def honorario(self, cta):
        return bool(self.contas.get(cta, {}).get('tem_honorario'))

    # -- os números de cada mês
    def vendas(self, m):
        return sum(r['soma'] for r in self.dia
                   if r['mes'] == m and r['origem'] in FISCAL and self.grupo(r['credito']) == '41101')

    def compras(self, m):
        return sum(r['soma'] for r in self.dia if r['mes'] == m and r['origem'] in FISCAL
                   and self.grupo(r['debito']) == '11501' and self.grupo(r['credito']) == '21301')

    def saldos(self, ate):
        """O saldo de cada conta (débito − crédito) no fim de cada mês, de 11/2024 até `ate`, com o zeramento."""
        s = dict(self.saldo_inicial)
        out = {'2024-11': dict(s)}
        mov = collections.defaultdict(lambda: collections.defaultdict(float))
        for r in self.dia:
            if r['debito']:
                mov[r['mes']][r['debito']] += r['soma']
            if r['credito']:
                mov[r['mes']][r['credito']] -= r['soma']
        for m in meses('2024-12', ate):
            for c, v in mov[m].items():
                s[c] = s.get(c, 0.0) + v
            out[m] = dict(s)
        return out

    def de_resultado(self, cta):
        g = self.grupo(cta)
        return bool(cta) and (g[:1] in '34' or (g[:2] == '51' and g[:3] != '514'))

    def resultado(self, m):
        """O resultado do mês: créditos menos débitos nas contas de resultado (os grupos 3, 4 e 5.1, fora o 5.1.4, como
        no comparativo_resultado.sql), fora o zeramento."""
        t = 0.0
        for r in self.dia:
            if r['mes'] != m or r['origem'] == 2:
                continue
            if self.de_resultado(r['credito']):
                t += r['soma']
            if self.de_resultado(r['debito']):
                t -= r['soma']
        return t


# ---------------------------------------------------------------------------------- o que o contador lançou em 2025

class Lanc:
    """Um lançamento do contador. Na partida múltipla, o principal num lançamento simples: a perna de conta de balanço
    do lado de várias pernas contra a conta do lado de uma perna só; o resto (os juros) fica em `outras`."""

    def __init__(self, dia, debito, credito, valor, cod, lote, pm=False, outras=(), incluido=''):
        self.dia, self.debito, self.credito, self.valor, self.cod = dia, debito, credito, valor, cod
        self.lote, self.pm, self.outras, self.incluido = lote, pm, tuple(outras), incluido
        self.mes = dia.strftime('%Y-%m')

    @property
    def par(self):
        return (self.debito, self.credito)


def lancamentos_do_contador(d, de, ate):
    lotes = collections.defaultdict(list)
    for r in d.contador:
        if de <= r['mes'] <= ate:
            lotes[r['lote']].append(r)
    out = []
    for lote, rs in lotes.items():
        tipo = rs[0]['tipo_lote']
        cods = {r['cod_historico'] for r in rs if r['cod_historico']}
        cod = cods.pop() if len(cods) == 1 else 0
        if tipo == 'X' or len(rs) == 1:
            for r in rs:
                out.append(Lanc(r['dia'], r['debito'], r['credito'], r['soma'], r['cod_historico'] or cod, lote,
                                incluido=r['incluido']))
            continue
        # partida múltipla: o lado de uma perna só e as pernas do outro lado
        um_credito = [r for r in rs if not r['debito'] and r['credito']]
        um_debito = [r for r in rs if r['debito'] and not r['credito']]
        if tipo == 'C' and len(um_credito) == 1:
            unica, varias, lado_unico = um_credito[0], um_debito, 'credito'
        elif tipo == 'D' and len(um_debito) == 1:
            unica, varias, lado_unico = um_debito[0], um_credito, 'debito'
        else:   # vários pra vários: fica como veio, perna a perna
            for r in rs:
                out.append(Lanc(r['dia'], r['debito'], r['credito'], r['soma'], r['cod_historico'] or cod, lote,
                                pm=True, incluido=r['incluido']))
            continue
        conta_varias = 'debito' if lado_unico == 'credito' else 'credito'
        balanco = [r for r in varias if d.grupo(r[conta_varias])[:1] in '12']
        principal = max(balanco or varias, key=lambda r: r['soma'])
        outras = [d.grupo(r[conta_varias]) for r in varias if r is not principal]
        deb = principal['debito'] if lado_unico == 'credito' else unica['debito']
        cre = unica['credito'] if lado_unico == 'credito' else principal['credito']
        out.append(Lanc(unica['dia'], deb, cre, principal['soma'], cod, lote, pm=True, outras=outras,
                        incluido=unica['incluido']))
    out.sort(key=lambda l: (l.dia, l.debito, l.credito))
    return out


def casamentos(d, l, ate2=False):
    """Com o que do Domínio o valor do lançamento bate, até R$ 1,00: o DAS, a GPS, o pró-labore bruto ou o líquido,
    na competência do mês, na anterior ou duas antes (a guia paga com atraso)."""
    tipos = {'imposto_44': 'o DAS', 'inss': 'a GPS', 'bruto_socios': 'o pró-labore bruto',
             'liquido_socios': 'o pró-labore líquido'}
    achou = []
    for n, onde in ((0, 'do mês'), (1, 'da competência anterior'), (2, 'de duas competências antes'))[:3 if ate2 else 2]:
        comp = mes_antes(l.mes, n)
        for t, rot in tipos.items():
            v = d.valores.get(comp, {}).get(t)
            if v and abs(v - l.valor) <= TOLERANCIA:
                achou.append((t, n, f'{rot} {onde}'))
    return achou


def moda(xs):
    c = collections.Counter(xs)
    if not c:
        return None
    mx = max(c.values())
    return min(x for x, k in c.items() if k == mx)


class Par:
    """Um par de contas (débito, crédito) do contador nos meses fechados."""

    def __init__(self, d, par, lancs, n_meses):
        self.d, self.par, self.lancs = d, par, lancs
        self.meses = sorted({l.mes for l in lancs})
        self.n_meses_periodo = n_meses
        self.dias = [l.dia.day for l in lancs]
        self.dia_comum = moda(self.dias)
        self.um_por_mes = all(c == 1 for c in collections.Counter(l.mes for l in lancs).values())
        cods = [l.cod for l in lancs]
        self.cod = cods[0] if cods and cods[0] and all(c == cods[0] for c in cods) else 0
        self.pm = sum(1 for l in lancs if l.pm)
        self.fonte, self.fonte_tipo, self.fonte_desloc = self._fonte()

    @property
    def fixo(self):
        return len(self.meses) >= REGUA_FIXO

    @property
    def grupos(self):
        return self.d.grupo(self.par[0]), self.d.grupo(self.par[1])

    def eh_honorario(self):
        g = self.grupos
        return (self.d.honorario(self.par[0]) or self.d.honorario(self.par[1])) and g in (
            ('32204', '21501'), ('21501', '11101'))

    def honorario_papel(self):
        return 'provisao' if self.grupos == ('32204', '21501') else 'pagamento'

    def fonte_honorario(self, provisao):
        """O pagamento é a provisão do mês anterior? (em quantos dos lançamentos)"""
        if not provisao:
            return None
        ok = 0
        for l in self.lancs:
            ant = mes_antes(l.mes)
            vs = [r['soma'] for r in self.d.dia if r['mes'] == ant and r['debito'] == provisao.par[0]
                  and r['credito'] == provisao.par[1]]
            ok += bool(vs) and abs(vs[0] - l.valor) <= TOLERANCIA
        return ok

    def _fonte(self):
        """De onde sai o valor: o que do Domínio casa em metade dos lançamentos ou mais (e em 2 pelo menos), o valor
        fixo (o maior e o menor diferem até 1%), ou nada."""
        n = len(self.lancs)
        cont = collections.Counter()
        desloc = collections.defaultdict(collections.Counter)
        for l in self.lancs:
            vistos = set()
            for t, k, _ in casamentos(self.d, l):
                if t not in vistos:
                    cont[t] += 1
                    vistos.add(t)
                desloc[t][k] += 1
        if cont:
            t, k = cont.most_common(1)[0]
            if k >= max(2, (n + 1) // 2):
                empate = [x for x, y in cont.items() if y == k and x != t]
                # a competência que mais bate (no empate, a anterior, que é como a guia se paga)
                nd = 1 if desloc[t][1] >= desloc[t][0] else 0
                rotulos = {'imposto_44': 'o DAS', 'inss': 'a GPS', 'bruto_socios': 'o pró-labore bruto',
                           'liquido_socios': 'o pró-labore líquido'}
                texto = rotulos[t] + (' da competência anterior' if nd == 1 else ' do mês')
                if empate:
                    texto += ' (empata com ' + ', '.join(rotulos[x] for x in empate) + ')'
                return texto, t, nd
        vs = [l.valor for l in self.lancs]
        if len(vs) >= 2 and self.um_por_mes and min(vs) > 0 and max(vs) / min(vs) <= 1.01:
            return 'valor fixo', 'fixo', 0
        return 'não casou', None, 0


def pares_do_periodo(d, de, ate):
    lancs = lancamentos_do_contador(d, de, ate)
    por = collections.defaultdict(list)
    for l in lancs:
        por[l.par].append(l)
    n = len(meses(de, ate))
    return [Par(d, p, ls, n) for p, ls in sorted(por.items(), key=lambda x: (-len({l.mes for l in x[1]}), x[0]))]


# ------------------------------------------------------------------------------------------------------ o rascunho

class Linha:
    def __init__(self, mes, data, debito, credito, valor, cod, historico, regra, fonte, conferir=''):
        self.mes, self.data, self.debito, self.credito, self.valor = mes, data, debito, credito, round(valor, 2)
        self.cod, self.historico, self.regra, self.fonte, self.conferir = cod, historico, regra, fonte, conferir


HISTORICOS = {
    ('21401', '11101'): 'PAGAMENTO DAS REF {ref}',
    ('21502', '11101'): 'PAGAMENTO INSS REF {ref}',
    ('32204', '21501'): 'HONORARIOS CONTABEIS REF {ref}',
    ('21501', '11101'): 'PAGAMENTO HONORARIOS CONTABEIS REF {ref}',
}


POR_FONTE = {'imposto_44': 'PAGAMENTO DAS REF {ref}', 'inss': 'PAGAMENTO INSS REF {ref}'}


def historico_de(p, ref):
    if p.cod:
        return p.cod, f'REF {mm_aaaa(ref)}'
    modelo = POR_FONTE.get(p.fonte_tipo) or HISTORICOS.get(p.grupos, 'REF {ref}')
    return 0, modelo.format(ref=mm_aaaa(ref))


def gerar(d, pares, alvo, provisao_antes=None, pagos_no_dia=None, reajuste=None):
    """O rascunho dos meses `alvo` (lista de AAAA-MM) pelos pares fixos.
    provisao_antes: o valor da provisão dos honorários do mês antes do primeiro (o que já está lançado).
    pagos_no_dia: os dias em que a empresa pagou o honorário, por mês (pra quando 2025 lançava no dia de verdade).
    reajuste: (AAAA-MM do primeiro pagamento reajustado, fator)."""
    linhas, fora = [], []
    fixos = [p for p in pares if p.fixo]
    honor = {p.honorario_papel(): p for p in fixos if p.eh_honorario()}
    for p in fixos:
        if p.eh_honorario():
            continue
        if set(p.grupos) & {'11501', '41204', '32205'} or any(g[:2] == '31' for g in p.grupos):
            fora.append((p, 'estoque, custo das mercadorias ou juros: fica de fora do rascunho (item 2.5)'))
            continue
        if p.fonte_tipo is None:
            fora.append((p, 'aparece em 8 dos 10 meses ou mais, mas o valor não casou com nada do Domínio'))
            continue
        for m in alvo:
            data = data_no_mes(m, p.dia_comum)
            if p.fonte_tipo == 'fixo':
                valor = p.lancs[-1].valor
                ref = m
                fonte = 'valor fixo de 2025'
            else:
                ref = mes_antes(m, p.fonte_desloc)
                valor = d.valores.get(ref, {}).get(p.fonte_tipo)
                if not valor:
                    fora.append((p, f'sem o valor no Domínio pra competência {mm_aaaa(ref)}'))
                    continue
                fonte = p.fonte.split(' (empata')[0].replace('da competência anterior', f'da competência {mm_aaaa(ref)}') \
                    .replace('do mês', f'da competência {mm_aaaa(ref)}')
            cod, hist = historico_de(p, ref)
            linhas.append(Linha(m, data, p.par[0], p.par[1], valor, cod, hist, f'par fixo de 2025 ({len(p.meses)} de '
                                f'{p.n_meses_periodo} meses)', fonte))
    if honor:
        hl, avisos = gerar_honorarios(d, honor, alvo, provisao_antes, pagos_no_dia, reajuste)
        linhas += hl
        fora += avisos
    linhas.sort(key=lambda l: (l.data, l.debito, l.credito))
    return linhas, fora


def honorario_base(p):
    """O valor de 2025: o mais comum entre as provisões (o de fevereiro a outubro)."""
    return moda([round(l.valor, 2) for l in p.lancs if l.mes >= '2025-02'] or [round(l.valor, 2) for l in p.lancs])


def lancou_no_dia_de_verdade(p_pag):
    reais = {dt.date.fromisoformat(x) for x in HONORARIO_PAGO_2025}
    acertos = sum(1 for l in p_pag.lancs if l.dia in reais)
    return acertos >= max(1, round(0.8 * len(p_pag.lancs))), acertos


def gerar_honorarios(d, honor, alvo, provisao_antes, pagos_no_dia, reajuste):
    """Devolve (linhas, avisos): os avisos vão pra lista do que ficou de fora."""
    linhas, avisos = [], []
    prov, pag = honor.get('provisao'), honor.get('pagamento')
    base = honorario_base(prov) if prov else (honorario_base(pag) if pag else None)
    if base is None:
        return linhas, avisos
    valor_prov = {}
    for m in alvo:
        fator = 1.0
        if reajuste and mes_antes(reajuste[0]) <= m:   # a provisão do mês antes do primeiro pagamento reajustado
            fator = reajuste[1]
        valor_prov[m] = round(base * fator, 2)
    if prov:
        for m in alvo:
            cod, hist = historico_de(prov, m)
            linhas.append(Linha(m, data_no_mes(m, prov.dia_comum), prov.par[0], prov.par[1], valor_prov[m], cod, hist,
                                f'honorários: a provisão, como em 2025 ({len(prov.meses)} de {prov.n_meses_periodo} '
                                f'meses)', 'o honorário do mês (o valor de 2025' +
                                (', com o reajuste' if valor_prov[m] != base else '') + ')', 'conferir o valor'))
    if pag:
        no_dia, _ = lancou_no_dia_de_verdade(pag)
        if prov and (pag.fonte_honorario(prov) or 0) < 0.8 * len(pag.lancs):
            avisos.append((pag, 'o pagamento dos honorários de 2025 não é a provisão do mês anterior: não gerado'))
            return linhas, avisos
        for m in alvo:
            ant = mes_antes(m)
            valor = valor_prov.get(ant, provisao_antes if ant == mes_antes(alvo[0]) else None)
            if valor is None:
                valor = base     # a provisão do mês anterior não está lançada: o valor de 2025
                avisos.append((pag, f'a provisão dos honorários de {mm_aaaa(ant)} não está lançada: o pagamento de '
                                    f'{mm_aaaa(m)} saiu com o valor de 2025'))
            data = data_no_mes(m, pag.dia_comum)
            if no_dia and pagos_no_dia and m in pagos_no_dia:
                data = pagos_no_dia[m]
            cod, hist = historico_de(pag, ant)
            linhas.append(Linha(m, data, pag.par[0], pag.par[1], valor, cod, hist,
                                f'honorários: o pagamento, como em 2025 ({len(pag.meses)} de {pag.n_meses_periodo} '
                                f'meses)', f'a provisão de {mm_aaaa(ant)}', 'conferir o valor'))
    return linhas, avisos


def provisao_lancada(d, p_prov, m):
    """A provisão dos honorários já lançada num mês (a de 10/2025, paga em 11/2025), se houver."""
    if not p_prov:
        return None
    vs = [r['soma'] for r in d.dia if r['mes'] == m and r['debito'] == p_prov.par[0] and r['credito'] == p_prov.par[1]]
    return vs[0] if vs else None


def rascunho_abertos(d, pares):
    alvo = meses(*ABERTOS)
    honor = {p.honorario_papel(): p for p in pares if p.fixo and p.eh_honorario()}
    antes = provisao_lancada(d, honor.get('provisao'), mes_antes(alvo[0]))
    pagos = {x[:7]: dt.date.fromisoformat(x) for x in HONORARIO_PAGO_ABERTOS}
    return gerar(d, pares, alvo, antes, pagos, (HONORARIO_REAJUSTE_PAGAMENTO_DESDE, HONORARIO_REAJUSTE))


def prova_no_passado(d, pares):
    """O mesmo script nos 10 meses fechados, como se estivessem abertos, contra o que o contador lançou."""
    alvo = meses(*FECHADOS)
    honor = {p.honorario_papel(): p for p in pares if p.fixo and p.eh_honorario()}
    antes = provisao_lancada(d, honor.get('provisao'), mes_antes(alvo[0]))
    pagos = {x[:7]: dt.date.fromisoformat(x) for x in HONORARIO_PAGO_2025}
    gerado, _ = gerar(d, pares, alvo, antes, pagos, None)
    real = lancamentos_do_contador(d, *FECHADOS)
    usados = set()
    resultado = []
    for g in gerado:
        cand = [i for i, l in enumerate(real) if i not in usados and l.par == (g.debito, g.credito) and l.mes == g.mes
                and abs(l.valor - g.valor) <= TOLERANCIA]
        exato = [i for i in cand if real[i].dia == g.data]
        if exato:
            usados.add(exato[0])
            resultado.append(('acerta', g, real[exato[0]]))
        elif cand:
            usados.add(cand[0])
            resultado.append(('acerta sem o dia', g, real[cand[0]]))
        else:
            mesmo_par = [i for i, l in enumerate(real) if i not in usados and l.par == (g.debito, g.credito)
                         and l.mes == g.mes]
            if mesmo_par:
                usados.add(mesmo_par[0])
                resultado.append(('par certo, valor diferente', g, real[mesmo_par[0]]))
            else:
                resultado.append(('a mais', g, None))
    for i, l in enumerate(real):
        if i not in usados:
            resultado.append(('faltaria', None, l))
    return resultado


# ------------------------------------------------------------------------------------------- o que ficou de fora

def ficou_de_fora(d, pares, fora_gerar):
    itens = []
    vistos = set()
    for p, motivo in fora_gerar:
        if (p.par, motivo) not in vistos:
            vistos.add((p.par, motivo))
            itens.append((d.nome_conta(p.par[0]) + ' × ' + d.nome_conta(p.par[1]), motivo))
    for p in pares:
        if p.fixo:
            continue
        g = p.grupos
        if '32205' in g:
            porque = 'juros e multas: o valor não tem fonte no Domínio'
        elif g[0] in ('41204',) or '11501' in g:
            porque = 'custo das mercadorias ou estoque: fica com quem cuida da contabilidade'
        else:
            porque = 'apareceu em menos de 8 dos 10 meses fechados'
        jeito = (f'{len(p.meses)} de {p.n_meses_periodo} meses ({", ".join(mm_aaaa(m) for m in p.meses)}), '
                 f'{len(p.lancs)} lançamento(s), dia {p.dia_comum}' + (f', {p.pm} em partida múltipla' if p.pm else '')
                 + (f'; casa com {p.fonte}' if p.fonte_tipo else ''))
        itens.append((d.nome_conta(p.par[0]) + ' × ' + d.nome_conta(p.par[1]), f'{porque} — em 2025: {jeito}'))
    juros = [l for l in lancamentos_do_contador(d, *FECHADOS) if l.pm and '32205' in l.outras]
    if juros:
        itens.append(('juros e multas junto da guia (partida múltipla)',
                      f'{len(juros)} lote(s) em 2025 ({", ".join(sorted({mm_aaaa(l.mes) for l in juros}))}): o rascunho '
                      'gera só o principal; os juros, não'))
    # a provisão do DAS
    apur = sorted({r['mes'] for r in d.dia if r['origem'] == 10 and FECHADOS[0] <= r['mes'] <= FECHADOS[1]})
    apur_ab = sorted({r['mes'] for r in d.dia if r['origem'] == 10 and ABERTOS[0] <= r['mes'] <= ABERTOS[1]})
    if apur:
        sem = [m for m in meses(*ABERTOS) if m not in apur_ab]
        itens.append(('a provisão do DAS',
                      f'em 2025 veio pela apuração integrada da escrita fiscal (a origem 10) em {len(apur)} dos 10 '
                      f'meses, não digitada; os meses abertos sem ela: {", ".join(mm_aaaa(m) for m in sem) or "nenhum"} '
                      '— é rodar a apuração no Domínio, não lançamento'))
    # o pagamento do pró-labore pela folha
    pag_folha = sorted({r['mes'] for r in d.dia if r['origem'] == 13 and d.grupo(r['debito']) == '21501'
                        and d.grupo(r['credito']) == '11101'})
    if pag_folha:
        sem = [m for m in meses(*ABERTOS) if m not in pag_folha]
        itens.append(('o pagamento do pró-labore', f'a folha integrava o pagamento até {mm_aaaa(pag_folha[-1])}; '
                      f'sem ele nos meses abertos: {", ".join(mm_aaaa(m) for m in sem)} — fica pra quem cuida da '
                      'contabilidade (a integração da folha, ou a baixa à mão)'))
    # o recebimento das vendas que foram pra clientes
    cli = sorted({r['mes'] for r in d.dia if r['origem'] in FISCAL and d.grupo(r['debito']) == '11201'})
    if cli:
        itens.append(('o recebimento das vendas', f'as vendas de {mm_aaaa(cli[0])} a {mm_aaaa(cli[-1])} entram em '
                      'clientes e não há baixa: o rascunho não gera o recebimento'))
    itens.append(('o honorário adicional do ano', f'pago em {br(dt.date.fromisoformat(HONORARIO_ADICIONAL_PAGO))}, '
                  'do mesmo valor do mensal, pelo sistema do escritório: não gerado (conferir com quem cuida da '
                  'contabilidade se entra e como)'))
    itens.append(('banco', 'a empresa não tem conta de banco na contabilidade: nada de banco no rascunho'))
    return itens


# --------------------------------------------------------------------------------------------- os arquivos do PC

def escrever_csv(caminho, linhas, extras=()):
    """separado por ;, a data dd/mm/aaaa, o valor com vírgula, UTF-8 com BOM."""
    cab = ['mes', 'data', 'conta_debito', 'conta_credito', 'valor', 'codigo_historico', 'historico', 'regra',
           'fonte_do_valor', 'conferir'] + [e[0] for e in extras]
    with open(caminho, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f, delimiter=';', quoting=csv.QUOTE_MINIMAL)
        w.writerow(cab)
        for l in linhas:
            w.writerow([mm_aaaa(l.mes), br(l.data), l.debito, l.credito, f'{l.valor:.2f}'.replace('.', ','),
                        l.cod or '', l.historico,
                        l.regra, l.fonte, l.conferir] + [getattr(l, e[1], '') for e in extras])


def esc(x):
    return html.escape(str(x))


def tabela(cab, linhas, classe=''):
    h = [f'<table class="{classe}"><thead><tr>' + ''.join(f'<th>{esc(c)}</th>' for c in cab) + '</tr></thead><tbody>']
    for l in linhas:
        h.append('<tr>' + ''.join(f'<td>{c}</td>' for c in l) + '</tr>')
    h.append('</tbody></table>')
    return '\n'.join(h)


CSS = """
body{font-family:Segoe UI,Arial,sans-serif;margin:24px;color:#1b2430;background:#fff;max-width:1200px}
h1{font-size:22px} h2{font-size:18px;margin-top:32px;border-bottom:2px solid #d9dee5;padding-bottom:4px}
h3{font-size:15px;margin-top:20px} p,li{line-height:1.5}
table{border-collapse:collapse;margin:8px 0 16px;font-size:13px}
th,td{border:1px solid #d9dee5;padding:4px 8px;text-align:left;vertical-align:top}
th{background:#f2f4f7} td.n{text-align:right;white-space:nowrap}
.contra{background:#fde8e8} .zero{color:#8a94a3} .ok{background:#e8f6ec} .mais{background:#fff4dc}
.nota{color:#5b6573;font-size:13px} .ponto{border:1px solid #d9dee5;border-radius:6px;padding:8px 14px;margin:12px 0}
"""


def secoes_html(d):
    """As partes (a) a (g) do relatório. Devolve (html, resumo): o resumo é só contagens, pra tela e pro DUVIDAS."""
    pares = pares_do_periodo(d, *FECHADOS)
    rasc, fora_gerar = rascunho_abertos(d, pares)
    prova = prova_no_passado(d, pares)
    fora = ficou_de_fora(d, pares, fora_gerar)
    M25 = meses(*FECHADOS)
    partes = []

    # (a) como 2025 foi lançado
    a = ['<h2>(a) Como 2025 foi lançado (o que o contador digitou, de 01 a 10/2025)</h2>',
         '<p>Cada par de contas, com o código reduzido das duas e o título do grupo no plano modelo do escritório. Na '
         'partida múltipla (a guia paga com juros, num lote), o par é a guia contra o caixa; os juros vão à parte. Um '
         'par "fixo" aparece em 8 dos 10 meses ou mais.</p>']
    linhas = []
    prov = next((p for p in pares if p.fixo and p.eh_honorario() and p.honorario_papel() == 'provisao'), None)
    for p in pares:
        fonte = p.fonte
        if p.eh_honorario() and p.honorario_papel() == 'pagamento':
            k = p.fonte_honorario(prov)
            if k is not None:
                fonte = f'a provisão do mês anterior (em {k} dos {len(p.lancs)})'
        elif p.eh_honorario() and p.fonte_tipo == 'fixo':
            fonte = 'valor fixo (o honorário do mês)'
        porm = []
        for m in M25:
            ls = [l for l in p.lancs if l.mes == m]
            porm.append('<br>'.join(f'{l.dia.day:02d}: {dinheiro(l.valor)}' + (' (lote com juros)' if l.pm else '')
                                    for l in ls) or '<span class="zero">—</span>')
        linhas.append([esc(d.nome_conta(p.par[0])), esc(d.nome_conta(p.par[1])), f'{len(p.meses)}', 'sim' if p.fixo
                       else 'não', esc(f'{p.dia_comum} (de {min(p.dias)} a {max(p.dias)})'),
                       esc(p.cod or 'texto livre'), esc(fonte)] + porm)
    a.append(tabela(['débito', 'crédito', 'meses', 'fixo', 'dia', 'histórico padrão', 'de onde sai o valor']
                    + [mm_aaaa(m) for m in M25], linhas))
    partes.append('\n'.join(a))

    # (b) o que a integração já lança
    b = ['<h2>(b) O que a integração já lança</h2>',
         '<p>Quantos lançamentos por mês, por origem e par de contas (a escrita fiscal, a folha e a apuração). A data '
         'de inclusão no Domínio de cada mês vai na última coluna.</p>']
    Mb = meses('2025-01', ABERTOS[1])
    cont = collections.defaultdict(collections.Counter)
    incl = collections.defaultdict(set)
    for r in d.dia:
        if r['origem'] in (1, 2) or r['mes'] < Mb[0]:
            continue
        k = (NOME_ORIGEM.get(r['origem'], 'a escrita fiscal' if r['origem'] in FISCAL else f'origem {r["origem"]}'),
             r['debito'], r['credito'])
        cont[k][r['mes']] += r['linhas']
        incl[k].add(r['incluido'])
    linhas = []
    for k in sorted(cont, key=lambda k: (k[0], d.grupo(k[1]), d.grupo(k[2]))):
        linhas.append([esc(k[0]), esc(d.nome_conta(k[1])), esc(d.nome_conta(k[2]))] +
                      [str(cont[k][m] or '') for m in Mb] +
                      [esc(', '.join(br(dt.date.fromisoformat(x)) for x in sorted(incl[k])))])
    b.append(tabela(['de onde', 'débito', 'crédito'] + [mm_aaaa(m) for m in Mb] + ['incluído em'], linhas))
    partes.append('\n'.join(b))

    # (c) os saldos
    c = ['<h2>(c) Os saldos no fim de cada mês</h2>',
         '<p>Débito menos crédito de cada conta, com o zeramento. Em vermelho, o saldo do lado contrário da natureza da '
         'conta. O resultado do mês: as receitas menos os custos e as despesas (os grupos 3 e 4), fora o zeramento.</p>']
    Mc = ['2024-11'] + meses('2024-12', ABERTOS[1])
    S = d.saldos(ABERTOS[1])
    linhas = []
    for cta in sorted(d.contas, key=lambda x: d.contas[x]['classificacao']):
        seq = [S[m].get(cta, 0.0) for m in Mc]
        if all(abs(x) < 0.005 for x in seq):
            continue
        cel = []
        for x in seq:
            n = d.lado(cta)
            contra = (n == 'D' and x < -0.005) or (n == 'C' and x > 0.005)
            cel.append(f'<span class="{"contra" if contra else ""}">{dinheiro(x)}</span>')
        linhas.append([esc(d.nome_conta(cta)), esc(d.lado(cta) or '?')] + cel)
    linhas.append(['<b>resultado do mês</b>', ''] + [dinheiro(d.resultado(m)) if m >= '2024-12' else '' for m in Mc])
    c.append(tabela(['conta', 'natureza'] + [mm_aaaa(m) for m in Mc], linhas))
    partes.append('\n'.join(c))

    # (d) o rascunho
    dd = ['<h2>(d) O rascunho dos 12 meses abertos (11/2025 a 10/2026)</h2>',
          '<p>O padrão da própria empresa em 2025, com o valor de cada mês. Está também no arquivo '
          '<code>rascunho-lancamentos.csv</code>, na mesma pasta. <b>Nada disso foi importado</b>: quem confere e '
          'importa é quem cuida da contabilidade.</p>']
    linhas = [[esc(mm_aaaa(l.mes)), esc(br(l.data)), esc(d.nome_conta(l.debito)), esc(d.nome_conta(l.credito)),
               f'{dinheiro(l.valor)}', esc(l.cod or ''), esc(l.historico), esc(l.fonte), esc(l.conferir)] for l in rasc]
    dd.append(tabela(['mês', 'data', 'débito', 'crédito', 'valor', 'cód. hist.', 'histórico', 'de onde sai o valor',
                      'conferir'], linhas))
    partes.append('\n'.join(dd))

    # (e) a prova no passado
    e = ['<h2>(e) A prova no passado (01 a 10/2025)</h2>',
         '<p>O mesmo script rodado nos 10 meses fechados, como se estivessem abertos, contra o que o contador lançou. '
         '"Acerta": o par, o valor até R$ 1,00 e o dia. A prova é dentro da própria amostra (o padrão sai desses mesmos '
         'meses): mostra o que o método reproduz, não o que ele adivinharia num ano novo.</p>']
    cnt = collections.Counter(x[0] for x in prova)
    e.append('<p>' + ' · '.join(f'{esc(k)}: {v}' for k, v in sorted(cnt.items())) + '</p>')
    linhas = []
    for k, g, r in prova:
        linhas.append([esc(k), esc(br(g.data)) if g else '', esc(d.nome_conta(g.debito) + ' × ' + d.nome_conta(g.credito))
                       if g else '', dinheiro(g.valor) if g else '', esc(br(r.dia)) if r else '',
                       esc(d.nome_conta(r.debito) + ' × ' + d.nome_conta(r.credito)) if r else '',
                       dinheiro(r.valor) if r else ''])
    e.append(tabela(['resultado', 'rascunho: data', 'rascunho: par', 'rascunho: valor', 'lançado: data',
                     'lançado: par', 'lançado: valor'], linhas))
    partes.append('\n'.join(e))

    # (f) o que ficou de fora
    f = ['<h2>(f) O que ficou de fora e por quê</h2><ul>']
    f += [f'<li><b>{esc(a_)}</b>: {esc(b_)}</li>' for a_, b_ in fora]
    f.append('</ul>')
    partes.append('\n'.join(f))

    resumo = {
        'pares': len(pares), 'fixos': sum(1 for p in pares if p.fixo), 'rascunho': len(rasc),
        'prova': dict(cnt), 'fora': len(fora),
    }
    return partes, resumo, pares, rasc, prova, fora


DUVIDAS_CONTABILIDADE = [
    'O pagamento dos honorários é lançado sempre no dia 10, e a provisão no dia 30 (28 em fevereiro); a empresa pagou '
    'em outros dias. O rascunho segue o dia 10 de 2025: vale trocar pelo dia em que a empresa pagou?',
    'A guia do INSS (a GPS) foi paga em 7 dos 10 meses de 2025 (em julho, duas): pela regra dos 8 meses ela ficou fora do '
    'rascunho. Os meses sem pagamento são guia em atraso, ou pagamento que não foi lançado?',
    'A provisão do DAS vinha da apuração da escrita fiscal; nos 12 meses abertos ela não foi rodada. Roda-se a apuração '
    'de cada mês antes de importar o pagamento do DAS (senão o imposto a recolher fica do lado contrário da natureza)?',
    'A folha integrava o pagamento do pró-labore pelo caixa até 11/2025; de 12/2025 em diante, só a provisão e o INSS. '
    'Mudou alguma coisa na integração da folha, ou o pagamento passou a ser lançado de outro jeito?',
    'O custo das mercadorias de 2025 entrou de uma vez, no fim de 10/2025. Nos meses abertos, ele entra mês a mês ou no '
    'fim do ano?',
    'As vendas de 2026 estão em clientes e não há recebimento lançado. Elas foram recebidas no mês (à vista)?',
    'O honorário adicional do ano (pago em 11/11/2025) e os serviços avulsos pagos ao escritório entram como honorário '
    'ou noutra conta?',
    'A escrita fiscal de 01 a 10/2026 foi integrada de novo em 17/11/2026, já contra clientes. O que estava antes (as '
    'inclusões de 17/09, 18/10 e 16/11/2026) era contra o caixa? O Domínio não guardou as linhas que saíram.',
]


def montar_relatorio(d, antes=''):
    partes, resumo, pares, rasc, prova, fora = secoes_html(d)
    g = ['<h2>(g) As dúvidas pra quem cuida da contabilidade</h2><ol>'] + \
        [f'<li>{esc(x)}</li>' for x in DUVIDAS_CONTABILIDADE] + ['</ol>']
    corpo = (f'<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Teste do fechamento</title>'
             f'<style>{CSS}</style></head><body><h1>O teste do fechamento: a empresa do teste</h1>'
             f'<p class="nota">Gerado em {dt.datetime.now().strftime("%d/%m/%Y %H:%M")} pelo teste_fechamento.py, com o '
             'que o Domínio tinha no dia. Só no PC do escritório. Nada foi importado nem lançado no Domínio.</p>'
             + antes + '\n'.join(partes) + '\n'.join(g) + '</body></html>')
    return corpo, resumo, pares, rasc, prova, fora


def main():
    if not (PASTA / 'empresa.txt').exists() or not (SAIDA / 'contas.txt').exists():
        print('Faltam as saídas das consultas em', SAIDA)
        return 2
    d = Dados()
    corpo, resumo, pares, rasc, prova, fora = montar_relatorio(d)
    escrever_csv(PASTA / 'rascunho-lancamentos.csv', rasc)
    (PASTA / 'relatorio.html').write_text(corpo, encoding='utf-8')
    print(f'pares de 2025: {resumo["pares"]} ({resumo["fixos"]} fixos) · rascunho: {resumo["rascunho"]} lançamentos · '
          f'prova no passado: {resumo["prova"]} · fora: {resumo["fora"]} itens')
    print('gravados: rascunho-lancamentos.csv e relatorio.html em', PASTA)
    return 0


if __name__ == '__main__':
    sys.exit(main())
