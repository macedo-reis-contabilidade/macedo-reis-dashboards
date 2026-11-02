"""
O Domínio na ficha da empresa (02/11/2026) — sem login e sem banco (o mock do conferir.py, com os números da ponte do
Domínio semeados só neste teste; números inventados, os meses contados a partir de hoje).

    python tests/harness/dominio-ficha.py

Confere:
  1. a empresa ligada ao Domínio: a seção "Domínio" aparece com o código, a tabela dos últimos meses (os empregados, o que
     mudou na folha, os sócios com pró-labore, as notas com o valor contábil, os lançamentos), o mês de hoje e o passado
     marcados "em fechamento", e o rodapé (de onde veio e que o valor não é o faturamento);
  2. o que vem do banco entra como texto (o código com <img onerror> não vira imagem nem roda código);
  3. a empresa que não está no Domínio: sem a seção;
e nenhum erro de JavaScript. Tira a foto da seção em .harness/dominio-ficha.png, pra conferir o visual.
Termina com código 1 se alguma checagem falhar. Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, pathlib, json, datetime
sys.dont_write_bytecode = True
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir, SITE

def mes_antes(n):
    h = datetime.date.today()
    m = h.month - 1 - n
    return f'{h.year + m // 12:04d}-{m % 12 + 1:02d}'

def linha(comp, **x):
    d = {'codigo': 41, 'cliente_id': 'c1', 'competencia': comp, 'funcionarios_ativos': 6, 'admissoes': 1, 'desligamentos': 0, 'afastados': 0, 'pro_labore': 2,
         'notas_saida': 120, 'valor_saidas': 300000, 'notas_entrada': 80, 'valor_entradas': 150000.5, 'lancamentos': 250,
         'ultimo_lancamento': comp + '-28', 'atualizado_em': datetime.date.today().isoformat() + 'T10:05:00Z'}
    d.update(x)
    return d

HOJE, PASSADO, ANTES = mes_antes(0), mes_antes(1), mes_antes(2)
DADOS = {
    'dominio_empresas': [{'codigo': 41, 'cliente_id': 'c1', 'nome': 'COMÉRCIO MODELO ME', 'ativa': True},
                         {'codigo': 99, 'cliente_id': 'c2', 'nome': 'X', 'ativa': None}],
    'dominio_mensal': [
        linha(HOJE, admissoes=0, notas_saida=0, valor_saidas=0, notas_entrada=0, valor_entradas=0, lancamentos=0, ultimo_lancamento=None),
        linha(PASSADO),
        linha(ANTES, admissoes=0, desligamentos=1, afastados=1, pro_labore=1),
        linha(mes_antes(8))],
}
SEMEAR = """
(() => {
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v;
    const extra = %s;
    Object.keys(extra).forEach(k => { v[k] = (v[k] || []).concat(extra[k]); });
    (v.clientes || []).forEach(c => { c.tipo_pessoa = 'PJ'; c.regime_tributario = c.regime_tributario || 'Simples Nacional'; });
  } });
})();
"""
TOUR = "(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()"

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1

def br(comp): return comp[5:7] + '/' + comp[:4]

def main():
    from playwright.sync_api import sync_playwright
    montar_site()
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    erros = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        cx = b.new_context(viewport={'width': 1400, 'height': 1000}, timezone_id='America/Sao_Paulo')
        p = cx.new_page()
        p.on('pageerror', lambda e: erros.append(str(e)))
        p.add_init_script(TOUR); p.add_init_script(SEMEAR % json.dumps(DADOS))

        print('1. A empresa ligada ao Domínio')
        p.goto(base + 'clientes/editar.html?id=c1')
        p.wait_for_selector('#sectionDominio:not([hidden])', timeout=8000)
        t = p.inner_text('#dominioConteudo')
        linhas = p.locator('#dominioConteudo tbody tr')
        ok('Empresa no Domínio: código 41' in t, 'o código da empresa no Domínio')
        ok(linhas.count() == 3 and br(HOJE) in linhas.nth(0).inner_text() and br(PASSADO) in linhas.nth(1).inner_text() and br(ANTES) in linhas.nth(2).inner_text(),
           f'os meses do mais recente pro mais antigo, só os da janela ({linhas.count()} linhas)')
        ok('em fechamento' in linhas.nth(0).inner_text() and 'em fechamento' in linhas.nth(1).inner_text() and 'em fechamento' not in linhas.nth(2).inner_text(),
           'o mês de hoje e o passado marcados em fechamento')
        l1 = ' '.join(linhas.nth(1).inner_text().split())
        ok('6 +1 adm.' in l1 and '120 R$ 300.000,00' in l1 and '80 R$ 150.000,50' in l1 and '250 até 28/' in l1, f'a folha, as notas com o valor e os lançamentos ({l1})')
        l2 = ' '.join(linhas.nth(2).inner_text().split())
        ok('−1 desl. · 1 afast.' in l2, f'o desligamento e o afastado do mês ({l2})')
        ok('nenhum dado de funcionário sai do Domínio' in t and 'não o faturamento' in t, 'o rodapé: de onde veio e que o valor não é o faturamento')
        ok(p.locator('#sectionDominio').evaluate('s => { const r = s.getBoundingClientRect(); return r.width > 0 && r.height > 0; }'), 'a seção na tela')
        p.locator('#sectionDominio').screenshot(path=str(SITE.parent / 'dominio-ficha.png'))

        print('2. O que vem do banco entra como texto')
        p2 = cx.new_page()
        p2.on('pageerror', lambda e: erros.append(str(e)))
        ruim = json.loads(json.dumps(DADOS)); ruim['dominio_empresas'][0]['codigo'] = '<img src=x onerror="window.__xss=1">'
        p2.add_init_script(TOUR); p2.add_init_script(SEMEAR % json.dumps(ruim))
        p2.goto(base + 'clientes/editar.html?id=c1')
        p2.wait_for_selector('#sectionDominio:not([hidden])', timeout=8000)
        ok(p2.locator('#dominioConteudo img').count() == 0 and '<img src=x onerror=' in p2.inner_text('#dominioConteudo'), 'o código com <img onerror> aparece como texto')
        ok(p2.evaluate('() => window.__xss === undefined'), 'e não roda código')
        p2.close()

        print('3. A empresa que não está no Domínio')
        p.goto(base + 'clientes/editar.html?id=c2')
        p.wait_for_function("() => document.getElementById('sectionPJ') && !document.getElementById('sectionPJ').hidden", timeout=8000)
        p.wait_for_timeout(600)
        ok(not p.is_hidden('#sectionDominio') and 'Sem movimento no Domínio' in p.inner_text('#dominioConteudo'), 'ligada sem movimento: a seção diz que não há movimento')
        sem = json.loads(json.dumps(DADOS)); sem['dominio_empresas'] = sem['dominio_empresas'][:1]
        p3 = cx.new_page(); p3.on('pageerror', lambda e: erros.append(str(e)))
        p3.add_init_script(TOUR); p3.add_init_script(SEMEAR % json.dumps(sem))
        p3.goto(base + 'clientes/editar.html?id=c2')
        p3.wait_for_function("() => document.getElementById('sectionPJ') && !document.getElementById('sectionPJ').hidden", timeout=8000)
        p3.wait_for_timeout(600)
        ok(p3.is_hidden('#sectionDominio'), 'fora do Domínio: sem a seção')
        p3.close()

        ok(not erros, f'nenhum erro de JavaScript ({erros[:3]})')
        b.close()
    srv.shutdown()
    print('\n' + (f'{falhas} falha(s).' if falhas else 'Tudo certo.'))
    return 1 if falhas else 0

if __name__ == '__main__':
    sys.exit(main())
