"""
A janela "Gerar tarefas recorrentes" da Análise fiscal (fiscal-analise.html, 19/10/2026) — sem login e sem banco (o mock
do conferir.py; a análise inventada entra por uma armadilha em window.__mockDb, e o gerador do banco é respondido por
window.__mockRpc, só neste teste).

    python tests/harness/analise-recorrentes.py

Uma análise de 4 obrigações (mensal, trimestral, semestral, anual). Confere:
  1. o que vem marcado: a mensal, a semestral e a anual; a trimestral desmarcada, em "mensal", com o aviso na linha
     ("trimestral: cadastre em Obrigações fiscais, que aceita os meses certos"); a periodicidade só oferece mensal,
     semestral e anual; o campo Mês aparece só na semestral e na anual (e na mensal que vira anual);
  2. o Responsável é a lista da equipe, já em Thalia, com "sem responsável";
  3. gravar com a anual sem mês avisa qual falta e não grava nada (nem chama o gerador); linha marcada sem o nome
     da tarefa, o mesmo;
  4. com o mês, num duplo clique com o banco lento: as 3 regras gravadas uma vez só, com mes_vencimento certo
     (mensal sem mês, semestral janeiro, anual março), origem 'analise', setor fiscal e o responsável escolhido;
     nenhuma tarefa inserida pela tela; o gerador do banco chamado uma vez, com p_hoje = hoje; o recado diz quantas
     regras e quantas tarefas;
e nenhum erro de JavaScript. Fotos da janela em .harness/fotos/analise-recorrentes-<tema>.png.
Termina com código 1 se alguma checagem falhar. Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, json, pathlib
sys.dont_write_bytecode = True
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir, FOTOS

OBRIGACOES = [
    {'obrigacao': 'PGDAS-D (TESTE)', 'esfera': 'federal', 'periodicidade': 'mensal', 'prazo': 'até o dia 20 do mês seguinte', 'confianca': 'alta'},
    {'obrigacao': 'EFD-REINF TRIMESTRAL (TESTE)', 'esfera': 'federal', 'periodicidade': 'trimestral', 'prazo': 'dia 15 do mês seguinte ao trimestre', 'confianca': 'media'},
    {'obrigacao': 'RELATÓRIO SEMESTRAL (TESTE)', 'esfera': 'estadual', 'periodicidade': 'semestral', 'prazo': 'dia 10', 'confianca': 'media'},
    {'obrigacao': 'DEFIS (TESTE)', 'esfera': 'federal', 'periodicidade': 'anual', 'prazo': 'até 31 de março', 'confianca': 'alta'},
]
SEMEAR = """
(() => {
  const OBRS = %s;
  window.__rpcs = [];
  // só o gerador é deste teste; o resto (o chat do balão) recebe a lista vazia de sempre
  window.__mockRpc = (nome, args) => { if (nome !== 'gerar_tarefas_recorrentes') return { data: [], error: null };
    window.__rpcs.push({ nome, args }); return { data: [{ criadas: 1, regras: 3 }], error: null }; };
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v;
    v.fiscal_analises = [{ id: 'fa1', cliente_id: 'c1', created_at: '2026-10-19T12:00:00Z', requer_revisao: false, revisado: true,
      analise: { meta: { confianca_geral: 'alta' }, enquadramento: { regime: 'Simples Nacional' }, tributos: {}, obrigacoes_acessorias: OBRS } }];
  } });
})();
""" % json.dumps(OBRIGACOES, ensure_ascii=False)

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1

def abrir(b, base, tema, erros, dialogos):
    p = b.new_page(viewport={'width': 1400, 'height': 900})
    p.on('pageerror', lambda e: erros.append(f'{tema}: {e}'))
    def trata(d):
        dialogos.append(d.message); d.accept()
    p.on('dialog', trata)
    p.add_init_script(f"localStorage.setItem('mr_tema', '{tema}'); (() => {{ const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) {{ return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }}; }})()")
    p.add_init_script(SEMEAR)
    p.goto(base + 'fiscal-analise.html?id=c1')
    p.wait_for_selector('#btnRecorrentes', timeout=10000)
    p.click('#btnRecorrentes')
    p.wait_for_selector('#recOverlay.is-open .rec-item', timeout=5000)
    return p

def linha(p, i):
    return p.evaluate("""i => {
      const q = s => document.querySelector(s + '[data-i="' + i + '"]');
      const item = q('.rec-inc').closest('.rec-item'), aviso = item.querySelector('.rec-aviso');
      return { marcada: q('.rec-inc').checked, periodo: q('.rec-periodo').value, opcoes: [...q('.rec-periodo').options].map(o => o.value),
               dia: q('.rec-dia').value, mesVisivel: getComputedStyle(q('.rec-mes')).visibility === 'visible', mes: q('.rec-mes').value,
               aviso: aviso ? aviso.textContent.trim() : '' };
    }""", i)

def main():
    from playwright.sync_api import sync_playwright
    montar_site(); FOTOS.mkdir(parents=True, exist_ok=True)
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    erros = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()

        dialogos = []
        p = abrir(b, base, 'escuro', erros, dialogos)
        print('1. O que vem marcado')
        ok(p.locator('#recLista .rec-item').count() == 4, '1. as 4 obrigações da análise na janela')
        men, tri, sem, anu = (linha(p, i) for i in range(4))
        ok(men['opcoes'] == ['mensal', 'semestral', 'anual'], f'1. a periodicidade oferece só mensal, semestral e anual ({men["opcoes"]})')
        ok(men['marcada'] and men['periodo'] == 'mensal' and not men['mesVisivel'] and men['dia'] == '20', f'1. a mensal marcada, dia 20, sem o campo Mês ({men})')
        ok(not tri['marcada'] and tri['periodo'] == 'mensal', f'1. a trimestral desmarcada e em "mensal" ({tri})')
        ok(tri['aviso'] == 'trimestral: cadastre em Obrigações fiscais, que aceita os meses certos', f'1. o aviso na linha da trimestral ({tri["aviso"]!r})')
        ok(sem['marcada'] and sem['periodo'] == 'semestral' and sem['mesVisivel'] and sem['mes'] == '', f'1. a semestral marcada, com o campo Mês vazio ({sem})')
        ok(anu['marcada'] and anu['periodo'] == 'anual' and anu['mesVisivel'] and anu['mes'] == '' and anu['dia'] == '31', f'1. a anual marcada, dia 31, com o campo Mês vazio ({anu})')
        ok(not men['aviso'] and not sem['aviso'] and not anu['aviso'], '1. só a trimestral tem aviso')
        ok('Mês' in p.text_content('.rec-head'), '1. "Mês" no cabeçalho das colunas')
        p.select_option('.rec-periodo[data-i="0"]', 'anual')
        ok(linha(p, 0)['mesVisivel'], '1. trocar a mensal pra anual mostra o campo Mês')
        p.select_option('.rec-periodo[data-i="0"]', 'mensal')
        ok(not linha(p, 0)['mesVisivel'], '1. e voltar pra mensal esconde')

        print('2. O responsável')
        opcoes = p.evaluate("() => [...document.querySelectorAll('#recResp option')].map(o => [o.value, o.textContent])")
        ok(p.input_value('#recResp') == 'Thalia', f'2. já vem em Thalia ({p.input_value("#recResp")!r})')
        ok([o[0] for o in opcoes] == ['Thalia', 'Vitória', 'Adaini', 'Samuel', 'Diego', 'Edna', ''] and opcoes[-1][1] == 'sem responsável',
           f'2. a equipe e "sem responsável" ({opcoes})')
        p.wait_for_timeout(200)
        p.screenshot(path=str(FOTOS / 'analise-recorrentes-escuro.png'))

        print('3. A anual sem mês')
        regras_antes = p.evaluate("() => window.__mockDb.tarefas_recorrentes.length")
        tarefas_antes = p.evaluate("() => window.__mockDb.tarefas.length")
        p.select_option('.rec-mes[data-i="2"]', '1')
        p.click('#recSalvar'); p.wait_for_timeout(500)
        ok(any('Escolha o mês de' in d and 'DEFIS (TESTE) (anual)' in d and 'Nada foi gravado' in d for d in dialogos), f'3. avisa qual falta ({dialogos[-1:]!r})')
        ok(p.evaluate("() => window.__mockDb.tarefas_recorrentes.length") == regras_antes, '3. nenhuma regra gravada')
        ok(p.evaluate("() => window.__rpcs.length") == 0, '3. o gerador não foi chamado')
        ok(p.locator('#recOverlay.is-open').count() == 1, '3. a janela continua aberta')
        p.fill('.rec-titulo[data-i="0"]', '  ')
        p.click('#recSalvar'); p.wait_for_timeout(400)
        ok('sem o nome da tarefa' in (dialogos[-1] if dialogos else '') and p.evaluate("() => window.__mockDb.tarefas_recorrentes.length") == regras_antes,
           f'3. linha marcada sem nome: avisa e não grava nada ({dialogos[-1:]!r})')
        p.fill('.rec-titulo[data-i="0"]', 'PGDAS-D (TESTE)')

        print('4. Gravar com o mês')
        p.select_option('.rec-mes[data-i="3"]', '3')
        p.select_option('#recResp', 'Adaini')
        dialogos.clear()
        p.evaluate("() => { window.__mockDelay = 300; }")   # o banco lento: o segundo clique chega com a gravação no meio
        p.dblclick('#recSalvar')
        p.wait_for_function("() => !document.querySelector('#recOverlay.is-open')", timeout=5000); p.wait_for_timeout(300)
        novas = p.evaluate("n => window.__mockDb.tarefas_recorrentes.slice(n)", regras_antes)
        por = {r['titulo']: r for r in novas}
        ok(len(novas) == 3 and set(por) == {'PGDAS-D (TESTE)', 'RELATÓRIO SEMESTRAL (TESTE)', 'DEFIS (TESTE)'}, f'4. as 3 regras marcadas, uma vez só (duplo clique), sem a trimestral ({[r["titulo"] for r in novas]})')
        ok(por.get('PGDAS-D (TESTE)', {}).get('periodicidade') == 'mensal' and por.get('PGDAS-D (TESTE)', {}).get('mes_vencimento') is None
           and por.get('PGDAS-D (TESTE)', {}).get('dia_vencimento') == 20, '4. a mensal: dia 20, mes_vencimento vazio')
        ok(por.get('RELATÓRIO SEMESTRAL (TESTE)', {}).get('periodicidade') == 'semestral' and por.get('RELATÓRIO SEMESTRAL (TESTE)', {}).get('mes_vencimento') == 1,
           '4. a semestral: mes_vencimento 1 (janeiro; o banco faz julho)')
        ok(por.get('DEFIS (TESTE)', {}).get('periodicidade') == 'anual' and por.get('DEFIS (TESTE)', {}).get('mes_vencimento') == 3
           and por.get('DEFIS (TESTE)', {}).get('dia_vencimento') == 31, '4. a anual: dia 31, mes_vencimento 3 (março)')
        ok(all(r.get('origem') == 'analise' and r.get('setor') == 'fiscal' and r.get('cliente_id') == 'c1' and r.get('responsavel') == 'Adaini' and r.get('ativo') is True for r in novas),
           "4. todas com origem 'analise', setor fiscal, a empresa e o responsável escolhido (Adaini)")
        ok(p.evaluate("() => window.__mockDb.tarefas.length") == tarefas_antes, '4. nenhuma tarefa inserida pela tela')
        rpcs = p.evaluate("() => window.__rpcs")
        hoje = p.evaluate("() => new Date().toLocaleDateString('sv-SE')")
        ok(len(rpcs) == 1 and rpcs[0]['nome'] == 'gerar_tarefas_recorrentes' and rpcs[0]['args'] == {'p_hoje': hoje},
           f'4. o gerador do banco chamado uma vez, com p_hoje = {hoje} ({rpcs})')
        ok(dialogos == ['3 regras criadas em Tarefas recorrentes do Fiscal; 1 tarefa já está na agenda, as outras nascem perto do vencimento.'],
           f'4. o recado do fim ({dialogos!r})')
        p.close()

        # a janela no tema claro, só pra foto
        p = abrir(b, base, 'claro', erros, [])
        p.wait_for_timeout(200)
        p.screenshot(path=str(FOTOS / 'analise-recorrentes-claro.png'))
        p.close()

        b.close()
    srv.shutdown()
    for e in erros: print('  ✗ erro de JavaScript:', e)
    print(f'\n{falhas + len(erros)} falha(s).' if falhas or erros else '\nTudo certo.')
    sys.exit(1 if falhas or erros else 0)

if __name__ == '__main__':
    main()
