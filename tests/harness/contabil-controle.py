"""Teste do controle das contabilidades (04/11/2026, pedido do Samuel com a planilha da Adaini): a tela
contabil-controle.html com o banco falso (dados inventados) e o relógio parado em 04/11/2026. As regras puras têm teste
próprio em tests/contabil-controle.test.mjs.

    python tests/harness/contabil-controle.py

Confere:
  1. a grade: os focos do alto, a linha de cada empresa (os meses feitos com o dia, a fazer, fora, em andamento), o
     "feita até" e o "a fazer" em faixas, as dicas do Domínio (o sem movimento que tem nota lá; o mês sem nada lá), a
     marca da pendência no mês, o nome que veio de fora como texto e a lista de quem está na carteira e fora do controle
     (sem o MEI);
  2. o mês: "feita até aqui" grava os meses abertos com o dia, o aviso tem o Desfazer, que volta tudo; "sem movimento"
     grava sem o dia; "voltar pra a fazer" apaga a linha; Esc fecha e o foco volta pra célula;
  3. a ficha da empresa: o resumo, a pendência (o texto de fora como texto), o mês a mês com o Domínio e o PGDAS, as
     tarefas abertas do Contábil; a pendência nova (vazia barra), resolver, a observação que grava sozinha;
  4. o aviso de quem saiu da carteira encerra o controle no mês da saída; incluir quem estava fora do controle;
  5. o ano de 2025, a busca, ?empresa= e ?ano=; o card no hub do Contábil, com as pendências;
  6. o tour: começa sozinho na primeira visita, anda pelos passos, abre as opções de um mês e a ficha de uma empresa (o
     assistente fica sabendo dela) e fecha tudo no Esc e no Concluir, sem gravar nada; o Enter não aperta o botão da tela;
     a visita seguinte não começa de novo, o ? revê, ?tour=1 força, e pelo link de uma ficha ele não começa;
  7. o andamento das contabilidades no Domínio (a versão 3 da ponte, 05/11/2026): o mês feito em que o Domínio discorda
     (a folha fora da contabilidade, o banco parado antes do mês) ganha a dica forte, a linha ganha o aviso e o foco
     "O Domínio discorda" as acha; o mês mostra as origens dos lançamentos e o que mais o Domínio diz; a ficha mostra "No
     Domínio" (o banco, o extrato, o caixa, o fechamento e o zeramento) e o mês a mês com a escrita fiscal, a folha, a
     receita e o fim do mês.
Termina com código 1 se alguma checagem falhar.
Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, json, pathlib
sys.dont_write_bytecode = True
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir, FOTOS

def meses(a, b):
    out, y, m = [], int(a[:4]), int(a[5:])
    while f'{y}-{m:02d}' <= b:
        out.append(f'{y}-{m:02d}'); m += 1
        if m > 12: y, m = y + 1, 1
    return out

CLIENTES = [
    {'id': 'c-a', 'nome_principal': 'PADARIA EXEMPLO LTDA', 'nome_fantasia': 'PADARIA EXEMPLO', 'regime_tributario': 'Simples Nacional', 'status': 'ativo', 'tipo_pessoa': 'PJ'},
    {'id': 'c-b', 'nome_principal': 'COMERCIO MODELO LTDA', 'nome_fantasia': None, 'regime_tributario': 'Lucro Presumido', 'status': 'ativo', 'tipo_pessoa': 'PJ'},
    {'id': 'c-c', 'nome_principal': 'ASSOCIACAO DE TESTE', 'nome_fantasia': None, 'regime_tributario': 'Imune', 'status': 'ativo', 'tipo_pessoa': 'PJ'},
    {'id': 'c-d', 'nome_principal': 'LOJA QUE SAIU LTDA', 'nome_fantasia': None, 'regime_tributario': 'Simples Nacional', 'status': 'inativo', 'tipo_pessoa': 'PJ'},
    {'id': 'c-e', 'nome_principal': 'FILIAL DE TESTE LTDA', 'nome_fantasia': None, 'regime_tributario': 'Lucro Presumido', 'status': 'ativo', 'tipo_pessoa': 'PJ'},
    {'id': 'c-f', 'nome_principal': 'NOVA NA CARTEIRA LTDA', 'nome_fantasia': None, 'regime_tributario': 'Simples Nacional', 'status': 'ativo', 'tipo_pessoa': 'PJ'},
    {'id': 'c-g', 'nome_principal': 'FULANO DE TESTE 12345678901', 'nome_fantasia': None, 'regime_tributario': 'MEI', 'status': 'ativo', 'tipo_pessoa': 'PJ'},
    {'id': 'c-h', 'nome_principal': 'EMPRESA <img src=x onerror="window.__xss=1"> LTDA', 'nome_fantasia': None, 'regime_tributario': 'Simples Nacional', 'status': 'ativo', 'tipo_pessoa': 'PJ'},
    {'id': 'c-i', 'nome_principal': 'MOVEIS FILIAL DOIS LTDA', 'nome_fantasia': None, 'regime_tributario': 'Lucro Presumido', 'status': 'ativo', 'tipo_pessoa': 'PJ'},
    {'id': 'c-j', 'nome_principal': 'PESSOA FISICA DE TESTE', 'nome_fantasia': None, 'regime_tributario': None, 'status': 'ativo', 'tipo_pessoa': 'PF'},
]
EMPRESAS = [
    {'cliente_id': 'c-a', 'faz': True, 'motivo': None, 'inicio': '2025-01', 'fim': None, 'responsavel': 'Adaini', 'observacao': None},
    {'cliente_id': 'c-b', 'faz': True, 'motivo': None, 'inicio': '2025-01', 'fim': None, 'responsavel': 'Adaini', 'observacao': 'Até o mês 05/2026 tudo ok.'},
    {'cliente_id': 'c-c', 'faz': True, 'motivo': None, 'inicio': '2026-03', 'fim': None, 'responsavel': 'Adaini', 'observacao': None},
    {'cliente_id': 'c-d', 'faz': True, 'motivo': None, 'inicio': '2025-01', 'fim': None, 'responsavel': 'Adaini', 'observacao': None},
    {'cliente_id': 'c-e', 'faz': False, 'motivo': 'Centralizada na matriz', 'inicio': '2025-01', 'fim': None, 'responsavel': 'Adaini', 'observacao': None},
    {'cliente_id': 'c-h', 'faz': True, 'motivo': None, 'inicio': '2025-01', 'fim': None, 'responsavel': 'Adaini', 'observacao': None},
]
MESES = ([{'cliente_id': 'c-a', 'competencia': c, 'situacao': 'feita', 'feita_em': '2026-01-31', 'por': 'planilha'} for c in meses('2025-01', '2025-12')]
         + [{'cliente_id': 'c-a', 'competencia': c, 'situacao': 'feita', 'feita_em': '2026-10-23', 'por': 'contabil@macedoereis.com.br'} for c in meses('2026-01', '2026-09')]
         + [{'cliente_id': 'c-b', 'competencia': '2025-01', 'situacao': 'feita', 'feita_em': '2026-01-31', 'por': 'planilha'}]
         + [{'cliente_id': 'c-b', 'competencia': c, 'situacao': 'feita', 'feita_em': '2026-08-18', 'por': 'planilha'} for c in meses('2026-01', '2026-06')]
         + [{'cliente_id': 'c-b', 'competencia': '2026-07', 'situacao': 'sem_movimento', 'feita_em': None, 'por': 'planilha'}]
         + [{'cliente_id': 'c-d', 'competencia': c, 'situacao': 'feita', 'feita_em': '2026-01-31', 'por': 'planilha'} for c in meses('2025-01', '2025-12')]
         + [{'cliente_id': 'c-h', 'competencia': c, 'situacao': 'andamento', 'feita_em': '2026-07-24', 'por': 'planilha'} for c in meses('2025-01', '2025-12')])
PENDENCIAS = [
    {'id': 'p1', 'cliente_id': 'c-a', 'competencia': '2026-10', 'texto': 'Extratos do banco de outubro <b>x</b>', 'aguardando': 'cliente', 'desde': '2026-10-15', 'resolvida_em': None, 'resolvida_por': None, 'criado_por': 'planilha', 'criado_em': '2026-11-04T10:00:00Z'},
    {'id': 'p2', 'cliente_id': 'c-b', 'competencia': None, 'texto': 'Dúvidas com o Diego', 'aguardando': 'diego', 'desde': '2026-08-04', 'resolvida_em': '2026-09-01T10:00:00Z', 'resolvida_por': 'contabil@macedoereis.com.br', 'criado_por': 'planilha', 'criado_em': '2026-08-04T10:00:00Z'},
]
CARTEIRA = [
    {'cliente_id': 'c-a', 'entrada': '2020-01-01', 'saida': None}, {'cliente_id': 'c-b', 'entrada': '2020-01-01', 'saida': None},
    {'cliente_id': 'c-c', 'entrada': '2026-03-01', 'saida': None}, {'cliente_id': 'c-d', 'entrada': '2020-01-01', 'saida': '2026-05-08'},
    {'cliente_id': 'c-e', 'entrada': '2020-01-01', 'saida': None}, {'cliente_id': 'c-f', 'entrada': '2026-08-01', 'saida': None},
    {'cliente_id': 'c-g', 'entrada': '2020-01-01', 'saida': None}, {'cliente_id': 'c-h', 'entrada': '2020-01-01', 'saida': None},
    {'cliente_id': 'c-i', 'entrada': '2026-03-01', 'saida': None}, {'cliente_id': 'c-j', 'entrada': '2020-01-01', 'saida': None},
]
DOM_EMP = [{'codigo': 101, 'cliente_id': 'c-a', 'ativa': True}, {'codigo': 102, 'cliente_id': 'c-b', 'ativa': True}, {'codigo': 103, 'cliente_id': 'c-c', 'ativa': True},
           {'codigo': 104, 'cliente_id': 'c-d', 'ativa': False}, {'codigo': 108, 'cliente_id': 'c-h', 'ativa': True}]
z = {'lancamentos': 0, 'notas_saida': 0, 'valor_saidas': 0, 'notas_entrada': 0, 'valor_entradas': 0, 'funcionarios_ativos': 0, 'pro_labore': 0, 'ultimo_lancamento': None}
# a versão 3 da ponte (o andamento das contabilidades): a c-a em 08/2026, marcada feita, com a folha fora da contabilidade
V3 = {'receita_bruta': 5000, 'salarios': 4000, 'decimo_terceiro': 0, 'pro_labore_valor': 1518, 'lanc_normais': 2, 'lanc_extrato': 10, 'lanc_fiscal': 40,
      'lanc_folha': 0, 'lanc_apuracao': 1, 'lanc_outros': 0, 'incluido_ate': '2026-09-05', 'receita_lancada': 5000, 'folha_lancada': 0, 'encargos_lancados': 0,
      'caixa_negativo': 0, 'contra_natureza': 2, 'sem_natureza': 0, 'transitorias': 0, 'transitorias_valor': 0}
DOM_MES = [
    {'codigo': 101, 'cliente_id': 'c-a', 'competencia': '2026-10', **z, 'lancamentos': 150, 'notas_saida': 12, 'valor_saidas': 23456.78, 'funcionarios_ativos': 3, 'pro_labore': 1, 'ultimo_lancamento': '2026-10-30'},
    {'codigo': 101, 'cliente_id': 'c-a', 'competencia': '2026-08', **z, 'lancamentos': 53, 'notas_saida': 10, 'valor_saidas': 5000, 'funcionarios_ativos': 2, 'pro_labore': 1, 'ultimo_lancamento': '2026-08-31', **V3},
    {'codigo': 102, 'cliente_id': 'c-b', 'competencia': '2026-07', **z, 'lancamentos': 20, 'notas_saida': 5, 'valor_saidas': 900},
    {'codigo': 103, 'cliente_id': 'c-c', 'competencia': '2026-08', **z},
]
PGDAS = [{'cliente_id': 'c-a', 'competencia': '2026-09', 'receita_mes': 45000, 'das_pago': True, 'transmitida_em': '2026-10-15'}]
# a foto do dia: a c-a com o banco em dia até setembro; a c-b com o banco parado em abril (os feitos de maio e junho discordam)
DOM_AND = [{'codigo': 101, 'cliente_id': 'c-a', 'banco_contas': 1, 'banco_ate': '2026-09-30', 'banco_ultimo': '2026-09-30', 'banco_ultimo_geral': '2026-09-30',
            'caixa_ate': '2026-10-31', 'caixa_contador_ate': '2026-09-20', 'extrato_contas': 1, 'extrato_ate': '2026-09-30', 'extrato_pendentes': 2, 'conciliadas': 1,
            'conciliado_ate': '2026-09-30', 'fechamento_em': '2025-12-31', 'dados_ate': '2026-11-04'},
           {'codigo': 102, 'cliente_id': 'c-b', 'banco_contas': 1, 'banco_ate': '2026-04-30', 'banco_ultimo': '2026-04-30', 'banco_ultimo_geral': '2026-04-30',
            'caixa_ate': None, 'caixa_contador_ate': None, 'extrato_contas': 0, 'extrato_ate': None, 'extrato_pendentes': 0, 'conciliadas': 0, 'conciliado_ate': None,
            'fechamento_em': None, 'dados_ate': '2026-11-04'}]
DOM_ENC = [{'codigo': 101, 'cliente_id': 'c-a', 'ano': 2025, 'zerado_em': '2025-12-31', 'zeramentos': 1, 'zerado_incluido_em': '2026-03-10', 'lancados_depois': 12, 'lancamentos_do_ano': 1500},
           {'codigo': 101, 'cliente_id': 'c-a', 'ano': 2024, 'zerado_em': None, 'zeramentos': 0, 'zerado_incluido_em': None, 'lancados_depois': None, 'lancamentos_do_ano': 900}]
TAREFAS = [{'id': 't-cont-1', 'setor': 'contabil', 'cliente_id': 'c-a', 'titulo': 'Balancete', 'prazo': '2026-11-10', 'responsavel': 'Adaini', 'status': 'pendente'},
           {'id': 't-cont-2', 'setor': 'contabil', 'cliente_id': 'c-a', 'titulo': 'Já feita', 'prazo': '2026-10-10', 'responsavel': 'Adaini', 'status': 'concluida'},
           {'id': 't-dp-1', 'setor': 'dp', 'cliente_id': 'c-a', 'titulo': 'Folha', 'prazo': '2026-11-06', 'responsavel': 'Vitória', 'status': 'pendente'}]

SEMEAR = """
(() => { const T = %s; let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) { db = v;
    v.clientes = T.clientes; v.contabil_empresas = T.empresas; v.contabil_meses = T.meses; v.contabil_pendencias = T.pendencias;
    v.carteira_info = T.carteira; v.dominio_empresas = T.domEmp; v.dominio_mensal = T.domMes; v.receita_pgdas = T.pgdas; v.tarefas = T.tarefas;
    v.dominio_andamento = T.domAnd; v.dominio_encerramento = T.domEnc; } });
})();
""" % json.dumps({'clientes': CLIENTES, 'empresas': EMPRESAS, 'meses': MESES, 'pendencias': PENDENCIAS, 'carteira': CARTEIRA, 'domEmp': DOM_EMP,
                  'domMes': DOM_MES, 'pgdas': PGDAS, 'tarefas': TAREFAS, 'domAnd': DOM_AND, 'domEnc': DOM_ENC}, ensure_ascii=False)
TOUR = "(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()"

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1

def nova(b, base, erros, caminho, rotulo, largura=1500, ctx=None, tour_visto=True):
    p = (ctx or b).new_page(viewport={'width': largura, 'height': 950})
    p.on('pageerror', lambda e: erros.append(f'{rotulo}: {e}'))
    p.clock.set_fixed_time('2026-11-04T12:00:00')
    if tour_visto: p.add_init_script(TOUR)
    p.add_init_script(SEMEAR)
    p.goto(base + caminho)
    return p

def tour_tit(p): return p.inner_text('.mrt-box h4') if p.locator('.mrt-box').count() else ''
def tour_prox(p):
    p.click('.mrt-box [data-a="prox"]'); p.wait_for_timeout(350)
def chave_tour(p): return p.evaluate("() => Object.keys(localStorage).filter(k => k.startsWith('mr_tour_contabil_controle_v1')).map(k => localStorage.getItem(k)).join(',')")
def dentro(p, a, b):
    """o retângulo do holofote do tour cobre o elemento"""
    return p.evaluate("""([a, b]) => { const s = document.querySelector(a).getBoundingClientRect(), e = document.querySelector(b).getBoundingClientRect();
      return e.width > 0 && s.left <= e.left + 1 && s.top <= e.top + 1 && s.right >= e.right - 1 && s.bottom >= e.bottom - 1; }""", [a, b])

def cel(p, cid, c): return p.locator(f'button.cc-c[data-id="{cid}"][data-c="{c}"]')
def classes(p, cid, c): return cel(p, cid, c).get_attribute('class') or ''
def db(p, tabela): return p.evaluate(f"() => JSON.parse(JSON.stringify(window.__mockDb.{tabela}))")
def foco(p, k): return p.inner_text(f'[data-foco="{k}"] .fc-num')

def main():
    from playwright.sync_api import sync_playwright
    montar_site(); FOTOS.mkdir(parents=True, exist_ok=True)
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    erros = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()

        print('1. A grade')
        p = nova(b, base, erros, 'contabil-controle.html', 'grade')
        p.wait_for_selector('table.cc-grade', timeout=8000)
        ok([foco(p, k) for k in ('todas', 'em_dia', 'ano_passado', 'pendencia', 'saindo', 'nao_faz')] == ['5', '0', '2', '1', '0', '1'],
           'os focos: 5 empresas, nenhuma em dia, 2 com o ano passado aberto, 1 com pendência, nenhuma saindo, 1 que não fazemos')
        ok(p.locator('.cc-grade tbody tr').count() == 5 and p.locator('[data-ano="2026"].is-on').count() == 1, 'a grade de 2026 com as 5 empresas do controle')
        ok(all('is-feita' in classes(p, 'c-a', c) for c in meses('2026-01', '2026-09')) and cel(p, 'c-a', '2026-09').inner_text() == '23/10',
           'os meses feitos mostram o dia em que foram feitos')
        ok('is-afazer' in classes(p, 'c-a', '2026-10') and cel(p, 'c-a', '2026-10').locator('.cc-pend').count() == 1 and 'is-agora' in classes(p, 'c-a', '2026-11')
           and cel(p, 'c-a', '2026-12').is_disabled(), 'outubro a fazer, com a marca da pendência; novembro correndo; dezembro ainda não chegou')
        linha_a = p.locator('tr', has=p.locator('[data-emp="c-a"]')).inner_text()
        ok('09/2026' in linha_a and '1 mês' in linha_a and '10/2026' in linha_a and 'PADARIA EXEMPLO' in linha_a and 'Domínio 101' in linha_a and '1 pendência' in linha_a,
           f'a linha: feita até 09/2026, a fazer 1 mês (10/2026), o código do Domínio e a pendência ({linha_a[:160]!r})')
        linha_b = p.locator('tr', has=p.locator('[data-emp="c-b"]')).inner_text()
        ok('01/2025' in linha_b and '02/2025 a 12/2025' in linha_b and '08/2026 a 10/2026' in linha_b, f'o buraco: feita até 01/2025, a fazer em faixas ({linha_b[:200]!r})')
        ok(cel(p, 'c-b', '2026-07').locator('.cc-dica:not(.is-leve)').count() == 1 and 'Domínio tem 20 lançamentos, 5 notas de saída' in (cel(p, 'c-b', '2026-07').get_attribute('title') or ''),
           'o sem movimento que tem nota no Domínio ganha a dica de conferir')
        ok(cel(p, 'c-c', '2026-08').locator('.cc-dica.is-leve').count() == 1 and all('is-fora' in classes(p, 'c-c', c) for c in ('2026-01', '2026-02')),
           'o mês sem nada no Domínio sugere sem movimento; antes do início do controle, fora')
        ok(p.evaluate('window.__xss') is None and 'EMPRESA <img src=x onerror="window.__xss=1"> LTDA' in p.inner_text('.cc-grade'), 'o nome que veio de fora aparece como texto')
        ok(p.locator('tr', has=p.locator('[data-emp="c-d"]')).locator('.cc-chip', has_text='Saiu da carteira').count() == 1
           and 'Inativa no Domínio' in p.locator('tr', has=p.locator('[data-emp="c-d"]')).inner_text(), 'quem saiu da carteira e está inativa no Domínio ganha os avisos na linha')
        ok(p.is_visible('#fora') and '2 empresas da carteira não estão' in p.inner_text('#foraTit') and p.is_hidden('#foraLista'), 'a carteira fora do controle: sem o MEI e a pessoa física, fechada')
        ok('Nenhum mês feito ainda em novembro' in p.inner_text('#progresso'), 'o que foi feito no mês: nada ainda')
        p.screenshot(path=str(FOTOS / 'contabil-controle.png'), full_page=False)

        print('2. O mês')
        cel(p, 'c-c', '2026-10').click(); p.wait_for_selector('#pop:not([hidden])', timeout=3000)
        pop = p.inner_text('#pop')
        ok('Outubro de 2026' in pop and 'ASSOCIACAO DE TESTE' in pop and 'Feita até aqui (8 meses)' in pop and '03/2026 a 10/2026' in pop, f'o mês a fazer: feita até aqui, com quantos meses e quais ({pop[:200]!r})')
        p.click('[data-pa="feita-ate"]'); p.wait_for_selector('#pop[hidden]', state='attached', timeout=3000)
        linhas = [m for m in db(p, 'contabil_meses') if m['cliente_id'] == 'c-c']
        ok(len(linhas) == 8 and all(m['situacao'] == 'feita' and m['feita_em'] == '2026-11-04' for m in linhas) and sorted(m['competencia'] for m in linhas) == meses('2026-03', '2026-10'),
           'feita até aqui grava os 8 meses abertos, com o dia de hoje')
        ok('8 meses' in p.inner_text('#toast') and p.is_visible('#toastDesfazer') and foco(p, 'em_dia') == '1' and 'Em dia até 10/2026' in p.locator('tr', has=p.locator('[data-emp="c-c"]')).inner_text(),
           'o aviso com o Desfazer; a empresa fica em dia')
        ok('Em novembro: 8 meses feitos em 1 empresa' in p.inner_text('#progresso'), 'o que foi feito no mês acompanha')
        p.click('#toastDesfazer'); p.wait_for_function("() => document.querySelector('#toastTxt').innerText.startsWith('Desfeito')", timeout=3000)
        ok(not [m for m in db(p, 'contabil_meses') if m['cliente_id'] == 'c-c'] and foco(p, 'em_dia') == '0' and p.is_hidden('#toastDesfazer'), 'o Desfazer volta tudo como estava (e o aviso fica sem o botão)')
        cel(p, 'c-c', '2026-08').click(); p.wait_for_selector('#pop:not([hidden])', timeout=3000)
        ok('sem movimento?' in p.inner_text('#pop'), 'o mês sem nada no Domínio: a dica aparece no mês')
        p.click('[data-pa="sem_movimento"]'); p.wait_for_timeout(300)
        m = [x for x in db(p, 'contabil_meses') if x['cliente_id'] == 'c-c' and x['competencia'] == '2026-08']
        ok(len(m) == 1 and m[0]['situacao'] == 'sem_movimento' and m[0]['feita_em'] is None and 'is-sem_movimento' in classes(p, 'c-c', '2026-08'), 'sem movimento grava sem o dia')
        cel(p, 'c-a', '2026-09').click(); p.wait_for_selector('#pop:not([hidden])', timeout=3000)
        ok('Feita em 23/10/2026' in p.inner_text('#pop') and 'No Domínio' not in p.inner_text('#pop'), 'o mês feito: o dia e quem fez')
        p.click('[data-pa="limpar"]'); p.wait_for_timeout(300)
        ok(not [x for x in db(p, 'contabil_meses') if x['cliente_id'] == 'c-a' and x['competencia'] == '2026-09'] and 'is-afazer' in classes(p, 'c-a', '2026-09'), 'voltar pra a fazer apaga a linha')
        p.click('#toastDesfazer'); p.wait_for_timeout(300)
        ok([x for x in db(p, 'contabil_meses') if x['cliente_id'] == 'c-a' and x['competencia'] == '2026-09'][0]['feita_em'] == '2026-10-23', 'e o Desfazer devolve o dia de antes')
        cel(p, 'c-a', '2026-10').click(); p.wait_for_selector('#pop:not([hidden])', timeout=3000)
        ok('150 lançamentos, 12 notas de saída, 3 funcionários, 1 pró-labore' in p.inner_text('#pop') and 'Extratos do banco de outubro <b>x</b>' in p.inner_text('#pop'), 'o mês: o Domínio e a pendência do mês, como texto')
        p.keyboard.press('Escape'); p.wait_for_timeout(150)
        ok(p.is_hidden('#pop') and p.evaluate("() => document.activeElement && document.activeElement.dataset.c") == '2026-10', 'Esc fecha e o foco volta pra célula')

        print('3. A ficha da empresa')
        p.click('[data-emp="c-a"]'); p.wait_for_selector('#ovEmp.is-open', timeout=3000)
        p.wait_for_function("() => document.querySelector('#eMeses').innerText.includes('45.000,00')", timeout=3000)
        f = p.inner_text('#ovEmp')
        ok('Feita até 09/2026' in f and 'A fazer: 1 mês (10/2026)' in f, 'o resumo: feita até e o que falta')
        ok('Extratos do banco de outubro <b>x</b>' in f and 'Esperando o cliente, desde 15/10/2026 (há 20 dias), de 10/2026' in f, 'a pendência, como texto, com quem e desde quando')
        ok('R$ 23.456,78' in f and 'R$ 45.000,00' in f and p.get_attribute('#eTarefas a', 'href') == 'agenda.html?tarefa=t-cont-1' and p.locator('#eTarefas li').count() == 1,
           'o mês a mês com o Domínio e o PGDAS; só a tarefa aberta do Contábil')
        ok(p.get_attribute('#eSub a', 'href') == 'clientes/editar.html?id=c-a' and p.is_hidden('#eMotivoBox') and p.is_checked('#eFaz'), 'o link da ficha da empresa; quem faz, sem o campo do motivo')
        p.screenshot(path=str(FOTOS / 'contabil-controle-ficha.png'))
        p.click('#pAdd'); p.wait_for_timeout(150)
        ok('Escreva o que falta' in p.inner_text('#pErro'), 'a pendência vazia barra')
        p.fill('#pTexto', 'Extrato da aplicação'); p.select_option('#pAguardando', 'diego'); p.fill('#pMes', '2026-09')
        p.click('#pAdd'); p.wait_for_timeout(300)
        nv = [x for x in db(p, 'contabil_pendencias') if x['texto'] == 'Extrato da aplicação']
        ok(len(nv) == 1 and nv[0]['aguardando'] == 'diego' and nv[0]['competencia'] == '2026-09' and nv[0]['desde'] == '2026-11-04' and nv[0]['cliente_id'] == 'c-a',
           'a pendência nova grava o texto, de quem se espera, desde hoje e o mês')
        ok(p.locator('#ePend .cc-pend-item').count() == 2 and foco(p, 'pendencia') == '1', 'a lista acompanha')
        p.click('#ePend [data-resolver="p1"]'); p.wait_for_timeout(300)
        ok(db(p, 'contabil_pendencias')[0]['resolvida_em'] and p.locator('#ePend .cc-pend-item').count() == 1 and '1 resolvida' in p.inner_text('#eResolvidasTit'), 'resolver: grava quando e vai pras resolvidas')
        p.fill('#eObs', 'Conferir o caixa de março.'); p.wait_for_timeout(1100)
        ok([e for e in db(p, 'contabil_empresas') if e['cliente_id'] == 'c-a'][0]['observacao'] == 'Conferir o caixa de março.' and 'Gravada' in p.inner_text('#eObsStatus'), 'a observação grava sozinha')
        p.keyboard.press('Escape'); p.wait_for_timeout(200)
        ok(not p.is_visible('#ovEmp'), 'Esc fecha a ficha')

        print('4. Quem saiu e quem estava fora do controle')
        p.click('[data-emp="c-d"]'); p.wait_for_selector('#ovEmp.is-open', timeout=3000)
        ok('Saiu da carteira em 08/05/2026' in p.inner_text('#eAvisos'), 'o aviso de quem saiu da carteira')
        p.click('[data-encerrar="2026-05"]'); p.wait_for_timeout(300)
        ok([e for e in db(p, 'contabil_empresas') if e['cliente_id'] == 'c-d'][0]['fim'] == '2026-05' and 'Controle salvo' in p.inner_text('#eCtlStatus'), 'encerrar no mês da saída grava o fim')
        p.click('#eClose'); p.wait_for_timeout(150)
        ok('is-fora' in classes(p, 'c-d', '2026-06') and 'is-afazer' in classes(p, 'c-d', '2026-05') and foco(p, 'saindo') == '1', 'depois do fim, fora; a empresa fica em "saindo ou baixadas"')
        p.click('#foraAbrir')
        ok(p.is_visible('#foraLista') and p.is_hidden('[data-form="c-i"]') and 'Incluir a partir de 08/2026' in p.inner_text('#foraLista'), 'a lista abre, com o mês da entrada; o motivo só aparece no "não fazemos"')
        p.click('[data-naofaz="c-i"]'); p.wait_for_timeout(100)
        ok(p.is_visible('[data-form="c-i"]'), '"não fazemos" pede o motivo')
        p.fill('[data-form="c-i"] input', 'Centralizada na matriz'); p.click('[data-form="c-i"] button'); p.wait_for_timeout(300)
        nv = [e for e in db(p, 'contabil_empresas') if e['cliente_id'] == 'c-i']
        ok(len(nv) == 1 and nv[0]['faz'] is False and nv[0]['motivo'] == 'Centralizada na matriz' and foco(p, 'nao_faz') == '2' and p.is_visible('#foraLista'), 'grava como "não fazemos", com o motivo; a lista segue aberta')
        p.click('[data-incluir="c-f"]'); p.wait_for_timeout(300)
        nv = [e for e in db(p, 'contabil_empresas') if e['cliente_id'] == 'c-f']
        ok(len(nv) == 1 and nv[0]['inicio'] == '2026-08' and nv[0]['faz'] is True and p.is_hidden('#fora') and foco(p, 'todas') == '6', 'incluir quem estava fora: a partir do mês da entrada; a lista some')
        p.click('[data-foco="nao_faz"]'); p.wait_for_timeout(150)
        ok(p.locator('.cc-grade tbody tr').count() == 2 and 'Centralizada na matriz' in p.inner_text('.cc-grade'), 'não fazemos: o motivo na linha')
        p.close()

        print('5. O ano, a busca, os endereços e o hub')
        p = nova(b, base, erros, 'contabil-controle.html?ano=2025&empresa=c-b', 'endereco')
        p.wait_for_selector('#ovEmp.is-open', timeout=8000)
        ok('COMERCIO MODELO LTDA' in p.inner_text('#eTitulo') and '1 resolvida' in p.inner_text('#eResolvidasTit') and p.input_value('#eObs') == 'Até o mês 05/2026 tudo ok.', '?empresa= abre a ficha, com a resolvida e a observação')
        p.click('#eClose')
        ok(p.locator('[data-ano="2025"].is-on').count() == 1 and all('is-andamento' in classes(p, 'c-h', c) for c in meses('2025-01', '2025-12')) and cel(p, 'c-h', '2025-03').inner_text() == '24/07',
           '?ano=2025 abre em 2025: em andamento com o dia')
        p.fill('#busca', 'padaría'); p.wait_for_timeout(150)
        ok(p.locator('.cc-grade tbody tr').count() == 1, 'a busca sem acento')
        p.fill('#busca', '108'); p.wait_for_timeout(150)
        ok(p.locator('.cc-grade tbody tr').count() == 1 and p.locator('[data-emp="c-h"]').count() == 1, 'a busca pelo código do Domínio')
        p.close()
        p = nova(b, base, erros, 'contabil-controle.html', 'celular', largura=390)
        p.wait_for_selector('table.cc-grade', timeout=8000)
        ok(p.evaluate('() => document.documentElement.scrollWidth <= window.innerWidth + 1'), 'no celular, a página não rola de lado (só a grade)')
        p.screenshot(path=str(FOTOS / 'contabil-controle-celular.png'))
        p.close()
        p = nova(b, base, erros, 'contabil.html', 'hub')
        p.wait_for_function("() => { const e = document.querySelector('[data-mod=\"contabil-controle.html\"]'); return e && !e.classList.contains('st-load'); }", timeout=6000)
        card = p.locator('a.dashboard-card[href="contabil-controle.html"]')
        ok(card.count() == 1 and 'Controle das contabilidades' in card.inner_text() and '1 pendência' in card.inner_text().lower(), f'o card no hub do Contábil, com as pendências ({card.inner_text() if card.count() else ""!r})')
        p.close()

        print('6. O tour')
        p = nova(b, base, erros, 'contabil-controle.html', 'tour', tour_visto=False)
        p.wait_for_selector('.mrt-box', timeout=8000)
        antes_db = {t: db(p, t) for t in ('contabil_meses', 'contabil_pendencias', 'contabil_empresas')}
        # o passo do assistente conta quando o balão já está na tela: a página espera até 6 s por ele; num computador
        # ocupado (os testes 4 ao mesmo tempo, 05/11/2026) ele pode chegar depois, e a conta sobe no passo seguinte —
        # os 14 inteiros são conferidos no "Rever o tour", adiante
        ok(tour_tit(p) == 'As empresas, por situação' and p.inner_text('.mrt-passo') in ('1 de 14', '1 de 13') and dentro(p, '.mrt-spot', '#focos'),
           f'na primeira visita, o tour começa sozinho, nos cartões do alto ({p.inner_text(".mrt-passo")!r})')
        titulos = [tour_tit(p)]
        while tour_tit(p) != 'As opções do mês' and len(titulos) < 20:
            tour_prox(p); titulos.append(tour_tit(p))
        ok(titulos == ['As empresas, por situação', 'Da carteira, fora do controle', 'Busca, ano e ordem', 'As cores dos meses', 'Cada linha é uma empresa',
                       'Clique num mês pra marcar', 'As opções do mês'], f'os passos da grade, na ordem ({titulos})')
        ok(p.is_visible('#pop') and 'Feita até aqui (2 meses)' in p.inner_text('#pop') and 'ASSOCIACAO DE TESTE' in p.inner_text('#pop') and dentro(p, '.mrt-spot', '#pop'),
           'o tour abre as opções de um mês com mais de um mês aberto, com o feita até aqui')
        p.screenshot(path=str(FOTOS / 'contabil-controle-tour.png'))
        p.focus('[data-pa="feita-ate"]'); p.keyboard.press('Enter'); p.wait_for_timeout(350)
        ok(tour_tit(p) == 'Feita até e a fazer' and p.is_hidden('#pop') and db(p, 'contabil_meses') == antes_db['contabil_meses'],
           'o Enter anda o tour e não aperta o botão do mês que estava com o foco: nada gravado')
        tour_prox(p)
        ok(tour_tit(p) == 'A ficha da empresa' and p.is_visible('#ovEmp') and 'PADARIA EXEMPLO' in p.inner_text('#eTitulo') and dentro(p, '.mrt-spot', '#eResumo'),
           'o tour abre a ficha de uma empresa com pendência aberta')
        ok(p.get_attribute('.as-ctx', 'hidden') is None and (p.text_content('.as-ctx b') or '') == 'PADARIA EXEMPLO' and 'empresa aberta' in (p.text_content('.as-ctx-rot') or ''),
           'com a ficha aberta, o assistente sabe a empresa ("esta empresa")')
        tour_prox(p)
        ok(tour_tit(p) == 'O que falta pra fechar' and dentro(p, '.mrt-spot', 'section[aria-labelledby="pendTit"]'), 'as pendências, com o holofote na seção')
        p.screenshot(path=str(FOTOS / 'contabil-controle-tour-ficha.png'))
        p.keyboard.press('Escape'); p.wait_for_timeout(300)
        ok(p.locator('.mrt-box').count() == 0 and not p.is_visible('#ovEmp') and p.is_hidden('#pop') and chave_tour(p) == 'pulado' and p.get_attribute('.as-ctx', 'hidden') is not None,
           'Esc fecha o tour e a ficha que ele abriu (o assistente esquece a empresa); fica marcado como visto')
        ok(all(db(p, t) == antes_db[t] for t in antes_db), 'o tour não gravou nada')
        p.reload(); p.wait_for_selector('table.cc-grade', timeout=8000); p.wait_for_timeout(3500)
        ok(p.locator('.mrt-box').count() == 0, 'na visita seguinte ele não começa sozinho')
        p.click('.mrt-help'); p.click('.mrt-menu [data-a="rever"]'); p.wait_for_selector('.mrt-box', timeout=3000)
        n, ult = 0, ''
        while p.locator('.mrt-box').count() and n < 20:
            ult = tour_tit(p); tour_prox(p); n += 1
        ok(n == 14 and ult == 'Pra ver de novo' and chave_tour(p) == 'ok' and not p.is_visible('#ovEmp') and p.is_hidden('#pop'),
           f'o ? revê o tour inteiro até o Concluir, e fecha o que abriu ({n} passos, o último: {ult!r})')
        p.close()
        p = nova(b, base, erros, 'contabil-controle.html?empresa=c-b', 'tour-ficha', tour_visto=False)
        p.wait_for_selector('#ovEmp.is-open', timeout=8000); p.wait_for_timeout(3500)
        ok(p.locator('.mrt-box').count() == 0, 'aberta pelo link de uma ficha, o tour não começa por cima dela')
        p.close()
        p = nova(b, base, erros, 'contabil-controle.html?tour=1', 'tour-forca')
        p.wait_for_selector('.mrt-box', timeout=8000)
        ok(tour_tit(p) == 'As empresas, por situação', '?tour=1 começa o tour mesmo já visto')
        p.click('.mrt-box [data-a="pular"]'); p.wait_for_timeout(200)
        ok(p.locator('.mrt-box').count() == 0, 'Pular fecha')
        p.close()

        print('7. O andamento das contabilidades no Domínio')
        p = nova(b, base, erros, 'contabil-controle.html', 'andamento')
        p.wait_for_selector('table.cc-grade', timeout=8000)
        ok(foco(p, 'discorda') == '2', 'o foco "O Domínio discorda": a c-a (a folha de agosto) e a c-b (o banco parado e o sem movimento com lançamento)')
        t_ago = cel(p, 'c-a', '2026-08').get_attribute('title') or ''
        ok(cel(p, 'c-a', '2026-08').locator('.cc-dica:not(.is-leve)').count() == 1 and 'Marcado como feito, mas no Domínio a folha (R$ 5.518,00) não entrou na contabilidade.' in t_ago,
           f'o mês feito com a folha fora da contabilidade ganha a dica forte ({t_ago[:160]!r})')
        t_jun = cel(p, 'c-b', '2026-06').get_attribute('title') or ''
        ok('o banco não tem lançamento neste mês (o último é de 30/04/2026)' in t_jun and cel(p, 'c-b', '2026-04').locator('.cc-dica').count() == 0,
           'o mês feito depois do banco parado ganha a dica; o mês do último lançamento, não')
        ok(p.locator('tr', has=p.locator('[data-emp="c-a"]')).locator('.cc-chip-dom').inner_text() == 'O Domínio discorda: 1 mês'
           and p.locator('tr', has=p.locator('[data-emp="c-b"]')).locator('.cc-chip-dom').inner_text() == 'O Domínio discorda: 3 meses',
           'a linha avisa em quantos meses a marcação e o Domínio discordam')
        p.click('[data-foco="discorda"]'); p.wait_for_timeout(150)
        ok(p.locator('.cc-grade tbody tr').count() == 2, 'o foco mostra só as duas')
        cel(p, 'c-a', '2026-08').click(); p.wait_for_selector('#pop:not([hidden])', timeout=3000)
        pop = p.inner_text('#pop')
        ok('Desses lançamentos: 40 da escrita fiscal, 10 do extrato importado, 2 digitados, 1 da apuração.' in pop and 'O último entrou no Domínio em 05/09/2026.' in pop
           and 'Marcado como feito, mas no Domínio a folha (R$ 5.518,00)' in pop and 'Também no Domínio: 2 contas com saldo contra a natureza no fim do mês.' in pop,
           f'o mês: as origens dos lançamentos, o dia em que entraram, o que discorda e o que mais o Domínio diz ({pop[:300]!r})')
        p.keyboard.press('Escape'); p.wait_for_timeout(150)
        p.click('[data-emp="c-a"]'); p.wait_for_selector('#ovEmp.is-open', timeout=3000)
        p.wait_for_function("() => document.querySelector('#eMeses').innerText.includes('45.000,00')", timeout=3000)
        dom = p.inner_text('#eDominioBox')
        ok(p.is_visible('#eDominioBox') and 'A marcação e o Domínio não batem em 08/2026' in dom and 'Banco: 1 conta com movimento nos últimos 12 meses, lançada até 30/09/2026.' in dom
           and 'Extrato importado até 30/09/2026, com 2 linhas ainda sem lançamento.' in dom and 'Caixa lançado pelo contador até 20/09/2026 (com a integração das notas, até 31/10/2026).' in dom
           and 'Data do fechamento nos parâmetros do Domínio: 31/12/2025.' in dom and '2025: zerado em 31/12/2025, feito em 10/03/2026; 12 lançamentos entraram depois do zeramento.' in dom
           and '2024: sem o zeramento (900 lançamentos no ano).' in dom and 'Pela ponte do Domínio, com os dados de 04/11/2026.' in dom, f'a ficha: "No Domínio" ({dom[:500]!r})')
        ago = p.locator('#eMeses tbody tr', has=p.locator('th', has_text='08/2026')).inner_text()
        ok('não entrou' in ago and '40' in ago and 'bate' in ago and '2 contra a natureza' in ago and 'R$ 5.000,00' in ago,
           f'o mês a mês: a escrita fiscal entrou, a folha não, a receita bate, o fim do mês e o valor das notas ({ago!r})')
        p.screenshot(path=str(FOTOS / 'contabil-controle-dominio.png'))
        p.close()
        p = nova(b, base, erros, 'contabil-controle.html?empresa=c-c', 'sem-andamento')
        p.wait_for_selector('#ovEmp.is-open', timeout=8000)
        ok(p.is_hidden('#eDominioBox'), 'sem a foto do Domínio (a ponte ainda sem a versão 3), a ficha não mostra "No Domínio"')
        p.close()
        b.close()
    srv.shutdown()
    ok(not erros, 'nenhum erro de JavaScript' + (': ' + '; '.join(erros[:3]) if erros else ''))
    print('\nResultado:', 'TUDO OK' if not falhas else f'{falhas} FALHA(S)')
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
