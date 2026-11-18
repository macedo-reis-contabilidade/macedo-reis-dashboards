r"""teste_acertos.py — rascunho da fila de 17/11/2026 (os acertos do teste do fechamento). A ponte NÃO usa.

Lê, como o teste_fechamento.py, as saídas das consultas gravadas no PC (C:\ponte-dominio\fechamento\teste\saida, mais a
do teste_acertos_notas.sql) e escreve, só no PC, em C:\ponte-dominio\fechamento\teste\:
  - rascunho-acertos.csv: os lançamentos de acerto, com as colunas do rascunho-lancamentos.csv e mais ponto, do_mes e
    decisao;
  - relatorio.html: o da fila do teste, com a parte "Pontos a ajustar" e o quadro "antes e depois dos acertos" no
    começo.
Na tela, só contagens. Nada é importado nem gravado no Domínio: quem confere, decide e lança é quem cuida da
contabilidade. Este arquivo fica no repositório (público): não há nele código de empresa, de conta nem valor.

    py -3 ponte/rascunhos/teste_acertos.py
"""
import collections
import datetime as dt
import sys

import teste_fechamento as tf

PRIMEIRO_ABERTO = '2025-11'          # o acerto de um ponto de mês fechado de 2025 cai aqui (30/11/2025)
LIMITE_ESTOQUE_MESES = 6             # o ponto 5: acima disso (ou negativo), a razão do custo não serve
PRONTO = 'pronto pra conferir'
DECISAO = 'decisão de quem cuida da contabilidade'
# os serviços avulsos que a empresa pagou ao escritório, pelo sistema do escritório (a fila, ponto 8)
AVULSOS = ['05/2025', '10/2025', '03/2026', '07/2026', '10/2026']


class Acerto(tf.Linha):
    def __init__(self, ponto, do_mes, decisao, **kw):
        super().__init__(**kw)
        self.ponto, self.do_mes, self.decisao = ponto, do_mes, decisao


def ultimo(m):
    return tf.data_no_mes(m, 31)


def pelo(quem):
    """'o contador' → 'pelo contador', 'a folha' → 'pela folha'."""
    if quem.startswith('o '):
        return 'pelo ' + quem[2:]
    if quem.startswith('a '):
        return 'pela ' + quem[2:]
    return 'por ' + quem


def frac(x):
    return f'{x:.2f}'.replace('.', ',')


class Analise:
    def __init__(self, d):
        self.d = d
        self.M25 = tf.meses(*tf.FECHADOS)
        self.MA = tf.meses(*tf.ABERTOS)
        self.S = d.saldos(tf.ABERTOS[1])
        self.pares = tf.pares_do_periodo(d, *tf.FECHADOS)
        self.rascunho, _ = tf.rascunho_abertos(d, self.pares)
        self.v25 = sum(d.vendas(m) for m in self.M25) / len(self.M25)
        self.vab = sum(d.vendas(m) for m in self.MA) / len(self.MA)
        self.c25 = sum(d.compras(m) for m in self.M25) / len(self.M25)
        self.cab = sum(d.compras(m) for m in self.MA) / len(self.MA)
        self.marcas = {}         # o que a descrição da conta diz, pelo filtro (teste_acertos_contas.sql)
        if (tf.SAIDA / 'acertos_contas.txt').exists():
            for r in tf.ler_saida('acertos_contas'):
                self.marcas[r['reduzido']] = {k[2:] for k, v in r.items() if k.startswith('f_') and v == 1}
        self.acertos = []
        self.dominio = []        # (ponto, mês, o que fazer, o que se espera ver)
        self.pontos = []

    # -- as contas da empresa pelo grupo (e, no 21501, pelo nome, no filtro)
    def conta(self, g, qual=None):
        cs = [c for c in sorted(self.d.contas, key=lambda x: self.d.contas[x]['classificacao']) if self.d.grupo(c) == g]
        if qual == 'honorario':
            cs = [c for c in cs if self.d.contas[c].get('tem_honorario')]
        elif qual == 'prolabore':
            cs = [c for c in cs if self.d.contas[c].get('tem_prolabore')]
        return cs[0] if cs else None

    def saldo(self, c, m):
        return self.S.get(m, {}).get(c, 0.0) if c else 0.0

    def mov(self, c, meses, orig=None, lado='d'):
        t = 0.0
        for r in self.d.dia:
            if r['mes'] in meses and r['origem'] != 2 and (orig is None or r['origem'] in orig):
                if lado == 'd' and r['debito'] == c:
                    t += r['soma']
                if lado == 'c' and r['credito'] == c:
                    t += r['soma']
        return t

    def meses_com(self, c, meses, orig=None, lado='d'):
        return [m for m in meses if self.mov(c, [m], orig, lado) > 0.005]

    def add(self, ponto, do_mes, decisao, mes, data, debito, credito, valor, historico, regra, fonte, conferir):
        if valor is None or valor <= 0.005:
            return
        chave = (debito, credito, do_mes, round(valor, 2))
        if any((a.debito, a.credito, a.do_mes, a.valor) == chave for a in self.acertos):
            return               # o mesmo acerto pedido por dois pontos entra uma vez só
        self.acertos.append(Acerto(ponto, do_mes, decisao, mes=mes, data=data, debito=debito, credito=credito,
                                   valor=valor, cod=0, historico=historico, regra=regra, fonte=fonte,
                                   conferir=conferir))

    def ponto(self, n, titulo, achado, peso, texto, acerto, decide=''):
        self.pontos.append({'n': n, 'titulo': titulo, 'achado': achado, 'peso': peso, 'texto': texto,
                            'acerto': acerto, 'decide': decide})

    # ------------------------------------------------------------------------------------------------ os pontos
    def rodar(self):
        d = self.d
        cx = self.conta('11101')
        cli = self.conta('11201')
        est = self.conta('11501')
        forn = self.conta('21301')
        imp = self.conta('21401')
        pl = self.conta('21501', 'prolabore')
        hon = self.conta('21501', 'honorario')
        inss = self.conta('21502')
        todos = ['2024-12'] + self.M25 + self.MA
        M = ['2024-11'] + todos

        # 1. a conta contra a natureza todo mês
        contra = {}
        for c in d.contas:
            n = d.lado(c)
            ms = [m for m in M if (n == 'D' and self.saldo(c, m) < -0.005) or (n == 'C' and self.saldo(c, m) > 0.005)]
            if ms:
                contra[c] = ms
        sempre = [c for c, ms in contra.items() if len(ms) == len(M)]
        if sempre:
            c = sempre[0]
            g = d.grupo(c)
            deb = self.meses_com(c, todos, lado='d')
            cre = self.meses_com(c, todos, lado='c')
            origs = sorted({tf.NOME_ORIGEM.get(r['origem'], 'a escrita fiscal' if r['origem'] in tf.FISCAL else
                                                f'a origem {r["origem"]}') for r in d.dia if r['debito'] == c})
            contra_g = sorted({d.grupo(r['credito']) for r in d.dia if r['debito'] == c})
            antes25 = abs(self.saldo(c, '2024-12'))
            deb25 = self.mov(c, self.M25, lado='d')
            self.ponto(1, f'A conta {g} ({d.titulo(g)}) do lado contrário da natureza em todos os meses', True,
                       abs(self.saldo(c, tf.ABERTOS[1])) / self.v25,
                       f'Está devedora desde antes de 12/2024 (já no fim de 11/2024, {frac(abs(self.saldo(c, "2024-11")) / self.v25)} '
                       f'mês de vendas de 2025) e fica assim nos {len(M)} meses lidos. De 12/2024 a 10/2025 ela foi '
                       f'debitada em {len(deb)} meses ({", ".join(tf.mm_aaaa(m) for m in deb)}), '
                       f'{" e ".join(pelo(o) for o in origs)}, contra '
                       f'{", ".join(g2 + " " + d.titulo(g2) for g2 in contra_g)}, e '
                       + ('não foi creditada em nenhum' if not cre else f'creditada só em {len(cre)}') + '. São notas de '
                       'entrada inteiras (com elas, o lançado de cada mês bate com o valor das notas da escrita fiscal): '
                       'o acumulador delas lança a nota contra contas a pagar e o caixa, em vez de uma despesa. Em '
                       f'partes: o saldo do fim de 12/2024 (o que vem de antes de 2025) é {frac(antes25 / self.v25)} mês de '
                       f'vendas de 2025, e os débitos de 01 a 10/2025 somam {frac(deb25 / self.v25)}. No fim de 10/2026 o '
                       f'saldo equivale a {frac(abs(self.saldo(c, tf.ABERTOS[1])) / self.v25)} meses de vendas de 2025; '
                       'nos meses abertos ela fica parada.',
                       'O de antes de 2025 não vira lançamento (2024 está zerado). O de 2025 nasceu em meses fechados e '
                       'iria em 30/11/2025, mas não foi gerado: o acerto é levar essas notas pra despesa certa, e qual é a '
                       'despesa de cada nota só quem cuida da contabilidade sabe (a opção que muda menos). Pra frente, no '
                       'Domínio: conferir o acumulador dessas notas de entrada.', DECISAO)
            self.dominio.append((1, '2025', f'conferir o acumulador das notas de entrada que debitam a conta {g}',
                                 'a nota na despesa e a conta sem saldo devedor'))

        # 2. o caixa
        cx25 = self.saldo(cx, tf.FECHADOS[1]) / self.v25
        cx26 = self.saldo(cx, tf.ABERTOS[1]) / self.vab
        parado = [m for m in self.MA if abs(self.mov(cx, [m], lado='d')) + abs(self.mov(cx, [m], lado='c')) < 0.005]
        sai = collections.Counter()
        for r in d.dia:
            if r['mes'] in self.M25 and r['credito'] == cx and r['origem'] != 2:
                quem = tf.NOME_ORIGEM.get(r['origem'], 'a escrita fiscal' if r['origem'] in tf.FISCAL else '?')
                sai[(quem, d.grupo(r['debito']))] += r['soma']
        tot25 = self.v25 * len(self.M25)
        grandes = sorted((r for r in d.dia if r['mes'] in self.M25 and r['origem'] == 1 and r['credito'] == cx
                          and d.grupo(r['debito'])[:1] == '3'), key=lambda r: -r['soma'])
        if grandes:
            g0 = grandes[0]
            tipo = 'de despesas diversas' if 'divers' in self.marcas.get(g0['debito'], set()) else 'de despesa'
            maior = (f'A maior é um lançamento só do contador, em {tf.mm_aaaa(g0["mes"])}, numa conta {tipo} '
                     f'({d.grupo(g0["debito"])} {d.titulo(d.grupo(g0["debito"]))}), que tirou do caixa '
                     f'{frac(g0["soma"] / self.v25)} meses de vendas de uma vez; ')
        else:
            maior = ''
        juntos = sum(v for k, v in sai.items() if k[1] in ('21501', '21401', '21502', 'PM'))
        soltos = [(k, v) for k, v in sai.most_common() if k[1] not in ('21501', '21401', '21502', 'PM')]
        saidas = '; '.join(f'{k[1]} {d.titulo(k[1])} {pelo(k[0])}: {frac(v / tot25)}' for k, v in soltos)
        if juntos:   # juntos de propósito: a parte do pró-labore sozinha daria a escala das vendas em reais
            saidas += f'; o pró-labore, as guias e os honorários, juntos: {frac(juntos / tot25)}'
        self.ponto(2, 'O caixa', True, cx26,
                   f'Sem banco, o caixa recebe a venda de 2025 inteira. No fim de 10/2025 ele equivale a {frac(cx25)} mês '
                   f'de vendas (de 2025) e, no fim de 10/2026, a {frac(cx26)} meses (das vendas dos meses abertos): sobe '
                   f'em 11 e 12/2025 (a venda ainda contra o caixa) e fica parado em {len(parado)} dos 12 meses abertos '
                   '(nada entra nem sai). As saídas do caixa em 2025, em parte das vendas do ano: ' + saidas + '. '
                   + maior + 'depois dela, a maior é o pagamento dos fornecedores pela integração das entradas, que '
                   'parou em 10/2025. As saídas que faltam nos meses abertos: os fornecedores (ponto 4), '
                   'o pró-labore e a GPS (ponto 7), o DAS e os honorários (o rascunho da fila do teste).',
                   'Pelos acertos dos pontos 3, 4 e 7 e pelo rascunho da fila do teste (o ponto 11 mostra o caixa '
                   'depois deles).', '')

        # 3. clientes
        vend_cli = {m: sum(r['soma'] for r in d.dia if r['mes'] == m and r['debito'] == cli and r['origem'] in tf.FISCAL)
                    for m in self.MA}
        baixa = self.mov(cli, self.MA, lado='c')
        meses_cli = [m for m in self.MA if vend_cli[m] > 0.005]
        if meses_cli and baixa < 0.005:
            soma = sum(vend_cli.values())
            self.ponto(3, 'Clientes sem nenhuma baixa', True, self.saldo(cli, tf.ABERTOS[1]) / self.vab,
                       f'As vendas de {tf.mm_aaaa(meses_cli[0])} a {tf.mm_aaaa(meses_cli[-1])} entram em clientes e não '
                       f'há nenhum crédito em clientes no período. O saldo no fim de 10/2026 é a soma das vendas do ano '
                       f'({frac(self.saldo(cli, tf.ABERTOS[1]) / soma if soma else 0)} dela) e equivale a '
                       f'{frac(self.saldo(cli, tf.ABERTOS[1]) / self.vab)} meses de vendas. A causa mais provável: em '
                       '2026 a venda passou a entrar em clientes (a escrita fiscal de 2026 foi integrada de novo, inteira, '
                       'contra clientes) e o recebimento não é lançado; sem banco, ele iria pro caixa.',
                       f'A baixa mensal contra o caixa, uma por mês ({len(meses_cli)} lançamentos), no valor da venda '
                       'lançada no mês.')
            for m in meses_cli:
                self.add(3, m, PRONTO, m, ultimo(m), cx, cli, vend_cli[m], f'ACERTO RECEBIMENTO DE CLIENTES REF '
                         f'{tf.mm_aaaa(m)}', 'ponto 3: a baixa de clientes', f'a venda lançada em clientes em '
                         f'{tf.mm_aaaa(m)}', 'conferir: o recebimento é no mês?')
        else:
            self.ponto(3, 'Clientes', False, 0, 'sem achado', '')

        # 4. fornecedores
        pag25 = self.meses_com(forn, self.M25, lado='d')
        pag_ab = self.mov(forn, self.MA, lado='d')
        comp_ab = {m: d.compras(m) for m in self.MA}
        razoes = [self.mov(forn, [m], lado='d') / d.compras(m) for m in self.M25 if d.compras(m)]
        if pag_ab < 0.005 and any(comp_ab.values()):
            self.ponto(4, 'Fornecedores sem pagamento desde 11/2025', True,
                       -self.saldo(forn, tf.ABERTOS[1]) / self.vab,
                       f'A compra entra contra fornecedores. Em 2025 o pagamento vinha pela integração das entradas, em '
                       f'{len(pag25)} dos 10 meses, perto do valor da compra do mês (de {frac(min(razoes))} a '
                       f'{frac(max(razoes))} dela); de 11/2025 em diante, nenhum pagamento. O saldo sobe todo mês: no '
                       f'fim de 10/2025 equivalia a {frac(-self.saldo(forn, tf.FECHADOS[1]) / self.c25)} mês de compras '
                       f'(de 2025) e, no fim de 10/2026, a {frac(-self.saldo(forn, tf.ABERTOS[1]) / self.cab)} meses (das '
                       'compras dos meses abertos). As compras dos meses abertos são maiores que as de 2025 (a média do '
                       f'mês, {frac(self.cab / self.c25)} vezes a de 2025) e batem com as notas de entrada da escrita '
                       'fiscal (o ponto 10).',
                       f'A baixa mensal contra o caixa, no valor da compra do mês ({sum(1 for v in comp_ab.values() if v)}'
                       ' lançamentos). No Domínio: conferir por que a integração das entradas parou de lançar o '
                       'pagamento em 11/2025. O saldo do fim de 10/2025 (as compras de 10/2025 que a integração ainda não '
                       f'tinha pago: em 10/2025 o pagamento foi {frac(razoes[-1])} da compra) não ganhou acerto: em 2025 '
                       'o pagamento oscila em volta da compra do mês, e se ele é no mês ou a prazo é a pergunta do acerto '
                       'acima.')
            for m in self.MA:
                self.add(4, m, PRONTO, m, ultimo(m), forn, cx, comp_ab[m], f'ACERTO PAGAMENTO DE FORNECEDORES REF '
                         f'{tf.mm_aaaa(m)}', 'ponto 4: a baixa de fornecedores', f'as compras de {tf.mm_aaaa(m)} '
                         '(estoque contra fornecedores)', 'conferir: o pagamento é no mês ou a prazo?')
            self.dominio.append((4, '11/2025 a 10/2026', 'conferir o acumulador das notas de entrada (o pagamento à '
                                 'vista deixou de ser integrado em 11/2025)', 'o pagamento do fornecedor pela '
                                 'integração, sem precisar do acerto à mão'))
        else:
            self.ponto(4, 'Fornecedores', False, 0, 'sem achado', '')

        # 5. o estoque e o custo
        cmv = [r for r in d.dia if r['origem'] == 1 and d.grupo(r['credito']) == '11501'
               and d.grupo(r['debito'])[:1] in '34']
        cmv25 = [r for r in cmv if r['mes'] in self.M25]
        comp25 = self.c25 * len(self.M25)
        vend25 = self.v25 * len(self.M25)
        if cmv25:
            custo = sum(r['soma'] for r in cmv25)
            raz_v = custo / vend25
            raz_c = custo / comp25
            conta_custo = cmv25[0]['debito']
            depois = self.saldo(est, tf.ABERTOS[1]) - sum(raz_v * d.vendas(m) for m in self.MA)
            em_meses = depois / self.cab
            serve = 0 < em_meses <= LIMITE_ESTOQUE_MESES
            texto = (f'A compra é lançada no estoque (estoque contra fornecedores) e o custo sai do estoque pelo '
                     f'contador, de uma vez: em 2025, um lançamento só, em {tf.br(cmv25[0]["dia"])}'
                     + ''.join(f' (o de {r["dia"].year} foi em {tf.br(r["dia"])})' for r in cmv if r['mes'] < self.M25[0])
                     + f'. O custo de 2025 vale {frac(raz_c)} das compras de 01 a 10/2025 e {frac(raz_v)} '
                     f'das vendas do mesmo período. O estoque no fim de 10/2025 equivale a '
                     f'{frac(self.saldo(est, tf.FECHADOS[1]) / self.c25)} meses de compras (de 2025) e, no fim de '
                     f'10/2026, a {frac(self.saldo(est, tf.ABERTOS[1]) / self.cab)} meses (das compras dos meses '
                     'abertos): sem o custo, o resultado de cada mês aberto sai sem o custo das mercadorias, e o de '
                     'outubro, quando o custo entra, sai muito negativo. Com o custo de cada mês aberto pela mesma razão '
                     f'de 2025 ({frac(raz_v)} das vendas), o estoque ficaria, no fim de 10/2026, com '
                     f'{frac(em_meses)} meses de compras')
            if serve:
                texto += ': a razão serve.'
                for m in self.MA:
                    self.add(5, m, PRONTO, m, ultimo(m), conta_custo, est, raz_v * d.vendas(m),
                             f'ACERTO CUSTO DAS MERCADORIAS VENDIDAS REF {tf.mm_aaaa(m)}', 'ponto 5: o custo pela '
                             f'razão de 2025 ({frac(raz_v)} das vendas)', f'as vendas de {tf.mm_aaaa(m)}',
                             'conferir: o custo é pelo inventário ou pela margem?')
                ac = f'Um lançamento de custo por mês ({len(self.MA)}), pela razão de 2025.'
            else:
                texto += (f' — acima de {LIMITE_ESTOQUE_MESES}, a razão não serve (as compras dos meses abertos são '
                          f'{frac(self.cab / self.c25)} vezes as de 2025 por mês, e as vendas, '
                          f'{frac(self.vab / self.v25)} vezes): o ponto fica só descrito.')
                ac = ('Nenhum lançamento: o custo dos meses abertos pede o inventário (o estoque contado), ou outra '
                      'razão, de quem cuida da contabilidade.')
            self.ponto(5, 'O estoque e o custo das mercadorias', True, self.saldo(est, tf.ABERTOS[1]) / self.vab,
                       texto, ac, '' if serve else DECISAO)
        else:
            self.ponto(5, 'O estoque e o custo das mercadorias', False, 0, 'sem achado', '')

        # 6. o imposto do Simples
        prov = self.meses_com(imp, self.M25, orig={10}, lado='c')
        lanc25 = tf.lancamentos_do_contador(d, *tf.FECHADOS)
        pago = sorted({l.mes for l in lanc25 if d.grupo(l.debito) == '21401'})
        das = {m: d.valores.get(m, {}).get('imposto_44') for m in todos}
        com_juros = []
        for l in lanc25:
            if d.grupo(l.debito) == '21401' and l.pm and '32205' in l.outras:
                for k in (1, 2, 3):
                    c0 = tf.mes_antes(l.mes, k)
                    if das.get(c0) and abs(das[c0] - l.valor) <= tf.TOLERANCIA:
                        com_juros.append(c0)
                        break
        sem_pag = [m for m in self.M25 if m not in pago]
        razao = {m: -self.saldo(imp, m) / das[m] for m in self.M25 if das.get(m)}
        prov_ab = self.meses_com(imp, self.MA, orig={10}, lado='c')
        sem_ab = [m for m in self.MA if m not in prov_ab]
        varios = [m for m, x in razao.items() if x > 1.05]
        self.ponto(6, 'O imposto do Simples sem a provisão nos meses abertos', bool(sem_ab),
                   len(sem_ab) * (sum(v for v in das.values() if v) / max(1, sum(1 for v in das.values() if v))) / self.vab,
                   f'Em 2025 a provisão do DAS veio pela apuração integrada da escrita fiscal (a origem 10), em '
                   f'{len(prov)} dos 10 meses, e não foi digitada. As duas pontas (a provisão e o pagamento) existem em '
                   f'{len(set(prov) & set(pago))} dos 10 meses: em {", ".join(tf.mm_aaaa(m) for m in sem_pag) or "nenhum"} '
                   'nenhum DAS foi pago' + (f', e os das competências {", ".join(tf.mm_aaaa(m) for m in sorted(com_juros))} '
                                            'foram pagos depois, com juros' if com_juros else '') + '. O imposto a '
                   'recolher, no fim de cada mês de 2025, equivale ao DAS do mês (provisionado e ainda não pago), e a '
                   f'mais de um em {len(varios)} meses ({", ".join(tf.mm_aaaa(m) for m in varios)}); '
                   + ('nunca fica contra a natureza' if all(x >= -0.005 for x in razao.values()) else
                      'fica contra a natureza em algum mês') + f'. Nos 12 meses abertos falta a provisão em {len(sem_ab)}: '
                   'o saldo fica parado no DAS de 10/2025, e o pagamento do DAS do rascunho da fila do teste o deixaria '
                   'do lado contrário da natureza.',
                   'Não é lançamento: rodar a integração da apuração de cada mês aberto no Domínio. O pagamento já está '
                   'no rascunho da fila do teste.')
        for m in sem_ab:
            self.dominio.append((6, tf.mm_aaaa(m), 'rodar a integração da apuração (o DAS) do mês',
                                 'a provisão do DAS do mês no imposto a recolher (o valor do DAS da competência)'))

        # 7. o pró-labore e o INSS (em quantidade de meses e de guias, nunca dividido pelo valor: a razão entre o valor
        # de um ano e o do outro diria o pró-labore em reais)
        pag_folha = [m for m in todos if any(r['mes'] == m and r['origem'] == 13 and r['debito'] == pl
                                             and r['credito'] == cx for r in d.dia)]
        faltam = [m for m in self.MA if m > pag_folha[-1]] if pag_folha else self.MA
        liq = {m: d.valores.get(m, {}).get('liquido_socios') for m in todos}
        gps = {m: d.valores.get(m, {}).get('inss') for m in todos}
        prov_pl = [m for m in todos if any(r['mes'] == m and r['origem'] == 13 and r['credito'] == pl
                                           and d.grupo(r['debito'])[:1] == '3' for r in d.dia)]
        retido = [m for m in todos if any(r['mes'] == m and r['origem'] == 13 and r['debito'] == pl
                                          and r['credito'] == inss for r in d.dia)]
        pagos_pl = {tf.mes_antes(m): m for m in pag_folha}             # o pagamento do mês paga a competência anterior
        # a GPS paga em 2025: a sem juros é a da competência anterior; a com juros, a mais antiga que faltava antes dela
        gl = [l for l in tf.lancamentos_do_contador(d, *tf.FECHADOS) if l.debito == inss and l.credito == cx]
        pagas = {tf.mes_antes(l.mes): l.mes for l in gl if not (l.pm and '32205' in l.outras)}
        for l in sorted((l for l in gl if l.pm and '32205' in l.outras), key=lambda l: l.dia):
            livres = [c0 for c0 in retido if c0 not in pagas and c0 <= tf.mes_antes(l.mes)]
            if livres:
                pagas[livres[0]] = l.mes
        def em_aberto(lista, pagos, ate):
            """as competências até `ate` sem pagamento até `ate` (pagos: competência → mês do pagamento)"""
            return [c0 for c0 in lista if c0 <= ate and (c0 not in pagos or pagos[c0] > ate)]
        pl_10_25 = em_aberto(prov_pl, pagos_pl, tf.FECHADOS[1])
        pl_10_26 = em_aberto(prov_pl, pagos_pl, tf.ABERTOS[1])
        gps_10_25 = em_aberto(retido, pagas, tf.FECHADOS[1])
        gps_10_26 = em_aberto(retido, pagas, tf.ABERTOS[1])
        sem_pag_25 = [c0 for c0 in gps_10_25 if c0 < tf.FECHADOS[1]]
        self.em_aberto = {   # o 2.3 em quantidade: antes e depois dos acertos
            'prolabore': (len(pl_10_26), len(em_aberto(prov_pl, {**pagos_pl, **{tf.mes_antes(m): m for m in faltam}},
                                                     tf.ABERTOS[1]))),
            'inss': (len(gps_10_26), len(em_aberto(retido, {**pagas, **{tf.mes_antes(m): m for m in self.MA},
                                                            **{c0: PRIMEIRO_ABERTO for c0 in sem_pag_25}},
                                                   tf.ABERTOS[1])) if not any(l.debito == inss for l in self.rascunho)
                     else None)}
        meses_gps = sorted({l.mes for l in gl})
        gps_no_rascunho = any(l.debito == inss for l in self.rascunho)
        self.ponto(7, 'O pró-labore e o INSS sem pagamento', True,
                   (-self.saldo(pl, tf.ABERTOS[1]) - self.saldo(inss, tf.ABERTOS[1])) / self.vab,
                   f'A folha integra 3 lançamentos por mês até {tf.mm_aaaa(pag_folha[-1])} (a provisão, o INSS retido e o '
                   f'pagamento pelo caixa) e 2 de {tf.mm_aaaa(faltam[0])} em diante: deixou de vir o pagamento do '
                   f'pró-labore. Em aberto no pró-labore a pagar: {len(pl_10_25)} mês no fim de 10/2025 (o de 10/2025, '
                   f'que se paga no começo de 11/2025) e {len(pl_10_26)} meses no fim de 10/2026 '
                   f'({tf.mm_aaaa(pl_10_26[0])} a {tf.mm_aaaa(pl_10_26[-1])}): sobe sem parar. No INSS a recolher: '
                   f'{len(gps_10_25)} GPS no fim de 10/2025 ({", ".join(tf.mm_aaaa(c0) for c0 in gps_10_25)}; a GPS foi '
                   f'paga {len(gl)} vezes em 2025, em {len(meses_gps)} meses, pras {len([c0 for c0 in retido if c0 <= tf.FECHADOS[1]])} '
                   f'competências de {tf.mm_aaaa(retido[0])} a 10/2025 — as pagas com juros são, pela data, as de antes) e '
                   f'{len(gps_10_26)} no fim de 10/2026: sobe sem parar. A GPS '
                   + ('está' if gps_no_rascunho else 'não está') + ' no rascunho da fila do teste'
                   + ('' if gps_no_rascunho else f' (foi paga em {len(meses_gps)} dos 10 meses de 2025, abaixo da régua '
                                                 f'dos {tf.REGUA_FIXO})') + '.',
                   f'A baixa mensal do pró-labore contra o caixa, no valor líquido da folha da competência anterior, em '
                   f'{len(faltam)} meses; '
                   + ('' if gps_no_rascunho else 'o pagamento da GPS da competência anterior em cada mês aberto; e as '
                      f'GPS de 2025 sem pagamento lançado ({", ".join(tf.mm_aaaa(c0) for c0 in sem_pag_25)}), em '
                      '30/11/2025, como decisão. ')
                   + 'Duas escolhas, a que segue o que a empresa fazia em 2025: o pró-labore pela competência anterior '
                   '(a outra: o líquido da folha do próprio mês, que só muda o mês a que cada baixa se refere), e a GPS '
                   'aqui, porque a fila do teste a deixou de fora (a outra: não gerar e só avisar). No Domínio: conferir '
                   'a integração do pagamento da folha, que parou.')
        for m in faltam:
            ant = tf.mes_antes(m)
            self.add(7, ant, PRONTO, m, ultimo(m), pl, cx, liq.get(ant), f'ACERTO PAGAMENTO PRO-LABORE REF '
                     f'{tf.mm_aaaa(ant)}', 'ponto 7: o pagamento do pró-labore', f'o pró-labore líquido da folha de '
                     f'{tf.mm_aaaa(ant)}', 'conferir: o dia do pagamento')
        if not gps_no_rascunho:
            for m in self.MA:
                ant = tf.mes_antes(m)
                self.add(7, ant, PRONTO, m, ultimo(m), inss, cx, gps.get(ant), f'ACERTO PAGAMENTO INSS REF '
                         f'{tf.mm_aaaa(ant)}', 'ponto 7: o pagamento da GPS', f'a GPS da competência {tf.mm_aaaa(ant)}',
                         'conferir: a guia foi paga no mês?')
            for c0 in sem_pag_25:
                self.add(7, c0, DECISAO, PRIMEIRO_ABERTO, ultimo(PRIMEIRO_ABERTO), inss, cx, gps.get(c0),
                         f'ACERTO PAGAMENTO INSS REF {tf.mm_aaaa(c0)}', 'ponto 7: a GPS de 2025 sem pagamento lançado '
                         '(no primeiro mês aberto)', f'a GPS da competência {tf.mm_aaaa(c0)}',
                         'conferir: esta guia foi paga? (pela data e pelos juros dos pagamentos de 2025, é uma das que '
                         'ficaram)')
        self.dominio.append((7, f'{tf.mm_aaaa(faltam[0])} a {tf.mm_aaaa(faltam[-1])}', 'conferir a integração do '
                             'pagamento da folha (o pró-labore)', 'o pagamento do pró-labore pelo caixa, todo mês'))

        # 8. os honorários
        p_prov = [r for r in d.dia if r['mes'] in self.M25 and r['credito'] == hon and r['origem'] == 1]
        p_pag = [r for r in d.dia if r['mes'] in self.M25 and r['debito'] == hon and r['origem'] == 1]
        um = p_prov[-1]['soma'] if p_prov else 1
        meses_av = [x[3:] + '-' + x[:2] for x in AVULSOS] + [tf.HONORARIO_ADICIONAL_PAGO[:7]]
        extras = [r for r in d.dia if r['mes'] in meses_av and r['origem'] == 1 and hon in (r['debito'], r['credito'])]
        a_mais = len(extras) - sum(1 for m in meses_av for _ in (0, 1) if m <= tf.FECHADOS[1])   # 1 provisão + 1 pagamento
        outra_desp = [r for r in d.dia if r['mes'] in meses_av and r['origem'] == 1 and d.grupo(r['debito']) == '32204'
                      and not d.honorario(r['debito'])]
        texto8 = (f'A provisão e o pagamento existem nos 10 meses fechados ({len({r["mes"] for r in p_prov})} e '
                  f'{len({r["mes"] for r in p_pag})}). O saldo de honorários a pagar no fim de 10/2025 é '
                  f'{frac(-self.saldo(hon, tf.FECHADOS[1]) / um)} mês (a provisão de 10/2025, que o rascunho da fila do '
                  'teste paga em 11/2025). ')
        if a_mais <= 0:
            texto8 += (f'Não aparecem lançados: o honorário adicional do ano, pago em '
                       f'{tf.br(dt.date.fromisoformat(tf.HONORARIO_ADICIONAL_PAGO))}, e os serviços avulsos pagos ao '
                       f'escritório em {", ".join(AVULSOS)} — nesses meses as contas dos honorários só têm a provisão e o '
                       'pagamento de sempre' + (', e nos meses abertos não há lançamento do contador' if True else '') + '.')
            if outra_desp:
                texto8 += (' O lançamento do contador noutra despesa administrativa num desses meses (o de despesas '
                           'diversas do ponto 2) é muito maior que um honorário: não é um avulso.')
        else:
            texto8 += f'Nos meses do adicional e dos avulsos há {a_mais} lançamento(s) a mais nas contas dos honorários: conferir.'
        self.ponto(8, 'Os honorários contábeis', True, 0.001, texto8,
                   'Nenhum lançamento: o valor é o do sistema do escritório, e quem confere é quem cuida da '
                   'contabilidade. As datas pra lançar: ' + tf.br(dt.date.fromisoformat(tf.HONORARIO_ADICIONAL_PAGO))
                   + ' (o adicional) e os meses ' + ', '.join(AVULSOS) + ' (os avulsos).', DECISAO)

        # 9. a retirada do sócio (o caixa depois dos acertos sai do ponto 11; calculado aqui antes)
        self.depois = self.saldos_depois()
        cx_depois = self.depois[tf.ABERTOS[1]].get(cx, 0) / self.vab
        debito_lucros = [r for r in d.dia if d.grupo(r['debito']) == '24301' and r['origem'] != 2]
        contas_ret = [c for c, ms in self.marcas.items() if 'retirada' in ms]
        na_retirada = [r for r in d.dia if r['debito'] in contas_ret or r['credito'] in contas_ret]
        houve = bool(debito_lucros or na_retirada)
        self.ponto(9, 'A retirada do sócio', True, 0,
                   ('Nenhum lançamento de distribuição de lucros ou de retirada de 12/2024 a 10/2026 (o que foi lido): '
                    'nenhum débito em lucros acumulados fora o zeramento, e nenhuma conta com retirada ou distribuição '
                    'no nome, pelo filtro. ' if not houve else
                    f'Há {len(debito_lucros) + len(na_retirada)} lançamento(s) em lucros acumulados (fora o zeramento) ou '
                    'em conta de retirada: conferir. ')
                   + 'Em 2025, o que tirou dinheiro do caixa sem ser um pagamento conhecido foi o lançamento de 05/2025 '
                   'em despesas diversas (ponto 2). Depois dos acertos dos pontos 3, 4 e 7 (e do rascunho da fila do '
                   f'teste), o caixa no fim de 10/2026 fica com {frac(cx_depois)} meses de vendas sem explicação: é o '
                   'que uma retirada não lançada (ou outra saída) explicaria.',
                   'Nenhum lançamento: é decisão de quem cuida da contabilidade com o sócio.', DECISAO)

        # 10. em dobro ou fora de lugar
        notas = {(r['tipo'], r['mes']): r for r in tf.ler_saida('acertos_notas')} if (tf.SAIDA / 'acertos_notas.txt').exists() else {}
        datas_incl = sorted({r['incluido'] for r in d.dia if r['origem'] in tf.FISCAL and r['mes'] >= '2026-01'})
        v_caixa_25 = [m for m in ('2025-11', '2025-12') if any(r['mes'] == m and r['origem'] in tf.FISCAL and
                                                              r['debito'] == cx for r in d.dia)]
        v_cli_25 = [m for m in ('2025-11', '2025-12') if any(r['mes'] == m and r['origem'] in tf.FISCAL and
                                                            r['debito'] == cli for r in d.dia)]
        bate, linhas_dif = [], []
        for m in self.MA:
            e = notas.get(('entrada', m))
            s = notas.get(('saida', m))
            ent = [r for r in d.dia if r['mes'] == m and r['origem'] == 6
                   and not (d.grupo(r['debito']) == '21301' and d.grupo(r['credito']) == '11101')]
            sai_ = [r for r in d.dia if r['mes'] == m and r['origem'] == 5]
            if e and float(e['soma']):
                bate.append(sum(r['soma'] for r in ent) / float(e['soma']))
                if sum(r['linhas'] for r in ent) != e['linhas']:
                    linhas_dif.append((m, 'entradas', sum(r['linhas'] for r in ent) - e['linhas']))
            if s and float(s['soma']):
                bate.append(sum(r['soma'] for r in sai_ if d.grupo(r['credito']) == '41101') / float(s['soma']))
                if sum(r['linhas'] for r in sai_) != s['linhas']:
                    linhas_dif.append((m, 'saídas', sum(r['linhas'] for r in sai_) - s['linhas']))
        dobro = [x for x in bate if x > 1.001] + [x for x in linhas_dif if x[2] > 0]
        for m, q, n in linhas_dif:
            if n < 0:
                self.dominio.append((10, tf.mm_aaaa(m), f'integrar de novo as notas de {q} do mês ({-n} linha da escrita '
                                     'fiscal sem lançamento na contabilidade)', 'a mesma quantidade de linhas da escrita '
                                     'fiscal'))
        um_dia = len(datas_incl) == 1
        self.ponto(10, 'Em dobro ou fora de lugar', bool(dobro) or bool(set(v_caixa_25) & set(v_cli_25)), 0,
                   f'A escrita fiscal de 01 a 10/2026 tem {len(datas_incl)} dia(s) de inclusão '
                   f'({", ".join(tf.br(dt.date.fromisoformat(x)) for x in datas_incl)})'
                   + (': foi integrada de novo, inteira, e as inclusões de antes não existem mais; não há a mesma nota em '
                      'dias de inclusão diferentes. ' if um_dia else '. ')
                   + 'Nos meses abertos, o que a contabilidade lançou das notas, contra o valor das notas da escrita '
                   + (f'fiscal: {frac(min(bate))} em todos' if bate and frac(min(bate)) == frac(max(bate)) else
                      f'fiscal: de {frac(min(bate)) if bate else "-"} a {frac(max(bate)) if bate else "-"}') + '; e a quantidade de '
                   'linhas (as notas e os segmentos) é a mesma da escrita fiscal'
                   + ('' if not linhas_dif else ', fora ' + '; '.join(
                       f'{tf.mm_aaaa(m)} nas {q} ({"+" if n > 0 else ""}{n} linha)' for m, q, n in linhas_dif))
                   + f'. {"Nenhuma nota lançada duas vezes" if not dobro else "Há mês com mais linhas ou valor que as notas: conferir"}. '
                   'As vendas de 11 e 12/2025: '
                   f'contra o caixa ({", ".join(tf.mm_aaaa(m) for m in v_caixa_25) or "nenhuma"}), '
                   + ('nenhuma contra clientes: sem dobro.' if not v_cli_25 else 'também contra clientes: conferir.'), '')

        # 11 e 2.3: o caixa e os saldos depois de tudo (self.depois, do ponto 9)
        neg = [m for m in self.MA if self.depois[m].get(cx, 0) < -0.005]
        self.ponto(11, 'O caixa depois de tudo', bool(neg), 0,
                   f'Com o rascunho da fila do teste e os acertos acima, lançados mês a mês: o caixa fica negativo em '
                   f'{len(neg)} mês(es)' + (f' ({", ".join(tf.mm_aaaa(m) for m in neg)})' if neg else '') +
                   f'. No fim de 10/2026 ele equivale a {frac(self.depois[tf.ABERTOS[1]].get(cx, 0) / self.vab)} meses '
                   'de vendas.' + (' A baixa de clientes (ponto 3) é o que segura o caixa: lançar primeiro o recebimento '
                                   'de clientes de cada mês, depois os pagamentos.' if neg else ''),
                   'A ordem de lançar: o recebimento de clientes, depois os pagamentos do mês.' if neg else '')

        # 12. o que mais os saldos mostram
        trata = {'11101': 2, '11201': 3, '21301': 4, '11501': 5, '21401': 6, '21502': 7, '21602': 1}
        itens = []
        for c in sorted(d.contas, key=lambda x: d.contas[x]['classificacao']):
            g = d.grupo(c)
            if g[:1] not in '12':
                continue
            seq = [self.saldo(c, m) for m in M]
            mudou = [m for i, m in enumerate(M[1:], 1) if abs(seq[i] - seq[i - 1]) > 0.005]
            if abs(seq[0]) > 0.005 and not mudou:
                itens.append(f'{g} {d.titulo(g)}: parado desde antes de 2025')
            media = sum(abs(seq[i] - seq[i - 1]) for i in range(1, len(M))) / (len(M) - 1)
            for i in range(1, len(M)):
                passo = abs(seq[i] - seq[i - 1])
                if passo > 3 * media and passo > 0.5 * self.v25:
                    causa = collections.Counter()
                    for r in d.dia:
                        if r['mes'] == M[i] and c in (r['debito'], r['credito']):
                            causa[tf.NOME_ORIGEM.get(r['origem'], 'a escrita fiscal' if r['origem'] in tf.FISCAL else
                                                     f'a origem {r["origem"]}')] += r['soma']
                    quem = causa.most_common(1)[0][0] if causa else '?'
                    itens.append(f'{g} {d.titulo(g)}: salto em {tf.mm_aaaa(M[i])} ({frac(passo / self.v25)} mês de '
                                 f'vendas, {pelo(quem)}' + (f'; o ponto {trata[g]}' if g in trata else '') + ')')
        so_contra = [c for c in d.contas if d.grupo(c)[:1] in '12' and any(
            (d.lado(c) == 'D' and self.saldo(c, m) < -0.005) or (d.lado(c) == 'C' and self.saldo(c, m) > 0.005) for m in M)]
        itens.append('saldo do lado contrário da natureza em algum mês: ' + (', '.join(
            f'{d.grupo(c)} {d.titulo(d.grupo(c))}' for c in so_contra) or 'nenhum') + ' (o ponto 1)')
        self.ponto(12, 'O que mais os saldos mostram', bool(itens), 0, '; '.join(itens) or 'sem achado',
                   'Nenhum lançamento: só a lista.')
        return self

    def saldos_depois(self):
        """Os saldos com o rascunho da fila do teste e os acertos, mês a mês."""
        out = {}
        extra = collections.defaultdict(lambda: collections.defaultdict(float))
        for l in list(self.rascunho) + list(self.acertos):
            extra[l.mes][l.debito] += l.valor
            extra[l.mes][l.credito] -= l.valor
        acum = collections.defaultdict(float)
        for m in self.MA:
            for c, v in extra[m].items():
                acum[c] += v
            out[m] = {c: self.saldo(c, m) + acum.get(c, 0.0) for c in set(self.S[m]) | set(acum)}
        return out


def html_pontos(a):
    d = a.d
    h = ['<h2>Pontos a ajustar</h2>',
         '<p>Do que pesa mais pro que pesa menos. Cada ponto: o que é, desde quando, de que tamanho (em meses de vendas '
         'ou de compras), por que aconteceu, o acerto proposto e o que depende de decisão. Os lançamentos de acerto '
         'estão no <code>rascunho-acertos.csv</code>; nada foi lançado nem importado.</p>']
    for p in sorted([p for p in a.pontos if p['achado']], key=lambda p: -p['peso']) + \
            [p for p in a.pontos if not p['achado']]:
        ls = [x for x in a.acertos if x.ponto == p['n']]
        h.append(f'<div class="ponto"><h3>Ponto {p["n"]}. {tf.esc(p["titulo"])}</h3>'
                 f'<p>{tf.esc(p["texto"])}</p>' + (f'<p><b>O acerto:</b> {tf.esc(p["acerto"])}</p>' if p['acerto'] else '')
                 + (f'<p><b>Depende de:</b> {tf.esc(p["decide"])}</p>' if p['decide'] else ''))
        if ls:
            h.append(tf.tabela(['data', 'débito', 'crédito', 'valor', 'histórico', 'do mês', 'decisão'],
                               [[tf.esc(tf.br(x.data)), tf.esc(d.nome_conta(x.debito)), tf.esc(d.nome_conta(x.credito)),
                                 tf.dinheiro(x.valor), tf.esc(x.historico), tf.esc(tf.mm_aaaa(x.do_mes)),
                                 tf.esc(x.decisao)] for x in ls]))
        dm = [x for x in a.dominio if x[0] == p['n']]
        if dm:
            h.append('<p><b>No Domínio:</b></p><ul>' + ''.join(
                f'<li>{tf.esc(x[1])}: {tf.esc(x[2])} — depois, {tf.esc(x[3])}</li>' for x in dm) + '</ul>')
        h.append('</div>')
    # o quadro antes e depois
    contas = [('o caixa', a.conta('11101')), ('clientes', a.conta('11201')), ('fornecedores', a.conta('21301')),
              ('o estoque', a.conta('11501')), ('o imposto a recolher', a.conta('21401')),
              ('o INSS a recolher', a.conta('21502')), ('o pró-labore a pagar', a.conta('21501', 'prolabore')),
              ('os honorários a pagar', a.conta('21501', 'honorario'))]
    fim = tf.ABERTOS[1]
    h.append('<h2>Antes e depois dos acertos (o fim de 10/2026)</h2>'
             '<p>"Antes": como está no Domínio hoje. "Depois": com o rascunho da fila do teste e os acertos lançados. O '
             'imposto a recolher "depois" ainda não tem a provisão do DAS dos meses abertos (é rodar a apuração no '
             'Domínio, o ponto 6): a última coluna mostra como ele fica com ela.</p>')
    linhas = []
    das_ab = sum(d.valores.get(m, {}).get('imposto_44', 0) for m in a.MA)
    for nome, c in contas:
        antes = a.saldo(c, fim)
        depois = a.depois[fim].get(c, 0.0)
        com_ap = depois - das_ab if nome == 'o imposto a recolher' else depois
        linhas.append([tf.esc(nome), tf.esc(d.nome_conta(c)), tf.dinheiro(antes), tf.dinheiro(depois),
                       tf.dinheiro(com_ap)])
    h.append(tf.tabela(['', 'conta', 'antes', 'depois', 'depois, com a apuração'], linhas))
    return '\n'.join(h)


def resumo_proporcoes(a):
    """O 2.3 em proporção (pro DUVIDAS): o saldo no fim de 10/2026 em meses de vendas (ou de compras, ou de guias)."""
    d = a.d
    fim = tf.ABERTOS[1]
    das_ab = sum(d.valores.get(m, {}).get('imposto_44', 0) for m in a.MA)
    out = {}
    for nome, c, base, un in [('caixa', a.conta('11101'), a.vab, 'meses de vendas'),
                              ('clientes', a.conta('11201'), a.vab, 'meses de vendas'),
                              ('fornecedores', a.conta('21301'), a.cab, 'meses de compras'),
                              ('estoque', a.conta('11501'), a.cab, 'meses de compras'),
                              ]:
        out[nome] = (a.saldo(c, fim) / base, a.depois[fim].get(c, 0) / base, un)
    out['prolabore (meses em aberto)'] = a.em_aberto['prolabore']
    out['inss (GPS em aberto)'] = a.em_aberto['inss']
    c = a.conta('21401')
    das_m = d.valores.get(fim, {}).get('imposto_44') or 1
    out['imposto'] = (a.saldo(c, fim) / das_m, a.depois[fim].get(c, 0) / das_m, (a.depois[fim].get(c, 0) - das_ab) / das_m)
    c = a.conta('21501', 'honorario')
    hon = [r['soma'] for r in d.dia if r['credito'] == c and r['origem'] == 1]
    out['honorarios'] = (a.saldo(c, fim) / (hon[-1] if hon else 1), a.depois[fim].get(c, 0) / (hon[-1] * tf.HONORARIO_REAJUSTE if hon else 1))
    return out


def main():
    if not (tf.SAIDA / 'contas.txt').exists():
        print('Faltam as saídas das consultas em', tf.SAIDA)
        return 2
    d = tf.Dados()
    a = Analise(d).rodar()
    tf.escrever_csv(tf.PASTA / 'rascunho-acertos.csv', sorted(a.acertos, key=lambda x: (x.data, x.ponto)),
                    extras=[('ponto', 'ponto'), ('do_mes', 'do_mes_txt'), ('decisao', 'decisao')])
    corpo, *_ = tf.montar_relatorio(d, antes=html_pontos(a))
    (tf.PASTA / 'relatorio.html').write_text(corpo, encoding='utf-8')
    por = collections.Counter(x.ponto for x in a.acertos)
    print(f'pontos com achado: {sum(1 for p in a.pontos if p["achado"])} de {len(a.pontos)} · acertos: {len(a.acertos)} '
          f'({dict(sorted(por.items()))}) · no Domínio: {len(a.dominio)}')
    print('gravados: rascunho-acertos.csv e relatorio.html em', tf.PASTA)
    if '--proporcoes' in sys.argv:   # o 2.3 do DUVIDAS: só proporções e quantidades, nunca o valor
        for k, v in resumo_proporcoes(a).items():
            print(' ', k, tuple(round(x, 2) if isinstance(x, float) else x for x in v))
    return 0


# o mês do acerto no formato do CSV
Acerto.do_mes_txt = property(lambda self: tf.mm_aaaa(self.do_mes))

if __name__ == '__main__':
    sys.exit(main())
