"""Teste da senha de quem entra (login.html + assets/js/auth-guard.js + assets/js/senha.js, 21/10/2026): a conta nova
nasce com uma senha provisória e a marca user_metadata.trocar_senha; no primeiro acesso a tela de entrar pede a senha nova
antes de qualquer outra tela (e o auth-guard manda de volta pra lá quem tentar abrir uma tela antes de trocar); e qualquer
um troca a sua clicando no próprio nome, no alto da tela. A sessão do Supabase entra como dublê (o sessionStorage
"mock_auth" do supabase.mock.js: entrar confere a senha, updateUser troca a senha e a marca, sair desliga). Conta inventada.

    python tests/harness/trocar-senha.py

Confere:
  1. o erro do login em português; no primeiro acesso, depois de entrar, a tela "Crie a sua senha" (sem pedir de novo a
     provisória), as regras (8 caracteres, as duas iguais, diferente da provisória) e, salva, a marca apagada e o painel;
  2. com a marca, abrir uma tela manda pra senha nova (pedindo a provisória, que é conferida) e, salva, de volta à tela;
  3. "Sair" no primeiro acesso encerra a sessão (só neste navegador, scope local) e volta pro entrar;
  4. o nome no alto da tela (clique e teclado) abre o "Trocar a senha", que confere a atual e volta pra tela de onde veio;
     "Voltar" volta sem trocar; e a tela de entrar com sessão e sem marca segue direto pro painel;
  5. a tela que perde o login com ela aberta (o auth-guard ouvindo a sessão, 21/10/2026): a sessão renovada da mesma
     pessoa não muda nada; o "Sair" da própria tela fica com ele; a sessão encerrada de fora leva pro entrar com "A sessão
     terminou" e, entrando, de volta à tela; outra pessoa que entra neste navegador recarrega a tela;
  e sem erro de JavaScript.
Termina com código 1 se alguma checagem falhar.
Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, json, pathlib
sys.dont_write_bytecode = True
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir

NOVA_EMAIL = 'atendimento@macedoereis.com.br'
PROVISORIA = 'Provisoria-2026'
TOUR = "(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()"
def auth(estado):
    # só na primeira carga da aba: depois a "sessão" segue no sessionStorage, de tela em tela
    return "(() => { if (!sessionStorage.getItem('mock_auth')) sessionStorage.setItem('mock_auth', %s); })()" % json.dumps(json.dumps(estado))

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1

def main():
    from playwright.sync_api import sync_playwright
    montar_site()
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        erros = []
        def pagina(estado):
            p = b.new_page(viewport={'width': 1280, 'height': 860})
            p.on('pageerror', lambda e: erros.append(str(e)))
            p.add_init_script(TOUR); p.add_init_script(auth(estado))
            return p
        estado = lambda p: p.evaluate("() => JSON.parse(sessionStorage.getItem('mock_auth'))")
        erro = lambda p: p.inner_text('#formError').strip()
        visivel = lambda p, sel: p.evaluate('s => { const e = document.querySelector(s); return !!e && !e.closest("[hidden]") && getComputedStyle(e).display !== "none"; }', sel)

        # 1) o primeiro acesso: entrar com a provisória e criar a senha
        p = pagina({'logado': False, 'email': None, 'meta': {'trocar_senha': True}, 'senhas': {NOVA_EMAIL: PROVISORIA}, 'log': []})
        p.goto(base + 'login.html'); p.wait_for_selector('#btnLogin')
        p.fill('#email', NOVA_EMAIL); p.fill('#password', 'errada'); p.click('#btnLogin')
        p.wait_for_function("() => document.getElementById('formError').textContent.trim() !== ''", timeout=5000)
        ok(erro(p) == 'E-mail ou senha não conferem.', f'o erro do login em português ({erro(p)!r})')
        p.fill('#password', PROVISORIA); p.click('#btnLogin')
        p.wait_for_selector('#blocoSenha:not([hidden])', timeout=5000)
        ok(p.inner_text('#loginSub') == 'Crie a sua senha' and not visivel(p, '#senhaAtual') and visivel(p, '#senhaNova')
           and NOVA_EMAIL in p.inner_text('#senhaTexto') and p.inner_text('#btnSenhaVoltar') == 'Sair' and p.evaluate('() => document.activeElement.id') == 'senhaNova',
           f'entrou com a provisória: "Crie a sua senha", sem pedir de novo a provisória, o foco na senha nova ({p.inner_text("#loginSub")!r})')
        def tentar(nova, repete, esperado):
            p.fill('#senhaNova', nova); p.fill('#senhaRepete', repete); p.click('#btnSenha')
            p.wait_for_function("e => document.getElementById('formError').textContent.trim() === e", arg=esperado, timeout=5000)
            return True
        ok(tentar('curta1', 'curta1', 'A senha nova precisa ter pelo menos 8 caracteres.')
           and tentar('cafe com leite 1', 'cafe com leite 2', 'As duas senhas novas não conferem.')
           and tentar(PROVISORIA, PROVISORIA, 'A senha nova precisa ser diferente da provisória.')
           and not any(x[0] == 'atualizar' for x in estado(p)['log']),
           'as regras barram antes de ir ao servidor: 8 caracteres, as duas iguais, diferente da provisória')
        p.fill('#senhaNova', 'cafe com leite 2026'); p.fill('#senhaRepete', 'cafe com leite 2026'); p.press('#senhaRepete', 'Enter')
        p.wait_for_url('**/index.html', timeout=8000); p.wait_for_selector('.topbar .user-chip[role="link"]', timeout=8000)
        e = estado(p)
        trocas = [x for x in e['log'] if x[0] == 'atualizar']
        ok(e['senhas'][NOVA_EMAIL] == 'cafe com leite 2026' and 'trocar_senha' not in e['meta'] and len(trocas) == 1
           and trocas[0][1] == {'password': 'cafe com leite 2026', 'data': {'trocar_senha': None}},
           f'salva: a senha nova e a marca apagada, numa chamada só, e o painel abre ({trocas})')

        # 2) com a marca, qualquer tela manda pra senha nova (pedindo a provisória) e volta pra ela
        p2 = pagina({'logado': True, 'email': NOVA_EMAIL, 'meta': {'trocar_senha': True}, 'senhas': {NOVA_EMAIL: PROVISORIA}, 'log': []})
        p2.goto(base + 'agenda.html'); p2.wait_for_selector('#blocoSenha:not([hidden])', timeout=8000)
        ok('login.html' in p2.url and 'redirect=%2Fagenda.html' in p2.url and visivel(p2, '#senhaAtual')
           and p2.inner_text('#rotuloAtual') == 'Senha provisória (a que você recebeu)' and p2.evaluate('() => document.activeElement.id') == 'senhaAtual',
           f'abrir a Agenda com a senha provisória leva pra senha nova, pedindo a provisória ({p2.url})')
        p2.fill('#senhaAtual', 'outra coisa'); p2.fill('#senhaNova', 'minha senha nova 1'); p2.fill('#senhaRepete', 'minha senha nova 1'); p2.click('#btnSenha')
        p2.wait_for_function("() => document.getElementById('formError').textContent.trim() !== ''", timeout=5000)
        ok(erro(p2) == 'A senha provisória não confere.' and estado(p2)['senhas'][NOVA_EMAIL] == PROVISORIA, f'a provisória errada não troca nada ({erro(p2)!r})')
        p2.fill('#senhaAtual', PROVISORIA); p2.click('#btnSenha')
        p2.wait_for_url('**/agenda.html', timeout=8000)
        e2 = estado(p2)
        ok(e2['senhas'][NOVA_EMAIL] == 'minha senha nova 1' and 'trocar_senha' not in e2['meta'] and [x[0] for x in e2['log']] == ['entrar', 'entrar', 'atualizar'],
           f'a provisória certa: confere entrando de novo (a errada não passou disso), troca e volta pra Agenda ({[x[0] for x in e2["log"]]})')

        # 3) "Sair" no primeiro acesso
        p3 = pagina({'logado': False, 'email': None, 'meta': {'trocar_senha': True}, 'senhas': {NOVA_EMAIL: PROVISORIA}, 'log': []})
        p3.goto(base + 'login.html'); p3.wait_for_selector('#btnLogin')
        p3.fill('#email', NOVA_EMAIL); p3.fill('#password', PROVISORIA); p3.click('#btnLogin')
        p3.wait_for_selector('#blocoSenha:not([hidden])', timeout=5000)
        p3.click('#btnSenhaVoltar'); p3.wait_for_selector('#blocoEntrar:not([hidden])', timeout=5000)
        ok(estado(p3)['logado'] is False and p3.inner_text('#loginSub') == 'Dashboards internos' and p3.input_value('#password') == '',
           '"Sair" no primeiro acesso encerra a sessão e volta pro entrar, sem a senha digitada')
        ok(['sair', 'local'] in estado(p3)['log'], f'"Sair" encerra só neste navegador, não nos outros computadores ({estado(p3)["log"]})')

        # 4) trocar a própria senha pelo nome no alto da tela
        SAM = 'financeiro@macedoereis.com.br'
        p4 = pagina({'logado': True, 'email': SAM, 'meta': {}, 'senhas': {SAM: 'senha antiga 1'}, 'log': []})
        p4.goto(base + 'login.html'); p4.wait_for_url('**/index.html', timeout=8000)
        ok(True, 'a tela de entrar com sessão e sem a marca segue direto pro painel')
        p4.goto(base + 'fiscal.html'); p4.wait_for_selector('.topbar .user-chip[role="link"]', timeout=8000)
        chip = '.topbar .user-chip'
        ok(p4.get_attribute(chip, 'title') == 'Trocar minha senha' and p4.get_attribute(chip, 'tabindex') == '0'
           and p4.evaluate('s => getComputedStyle(document.querySelector(s)).cursor', chip) == 'pointer',
           'o nome no alto: link com dica "Trocar minha senha", alcançável pelo Tab')
        p4.click(chip); p4.wait_for_selector('#blocoSenha:not([hidden])', timeout=8000)
        ok('trocar=1' in p4.url and 'redirect=%2Ffiscal.html' in p4.url and p4.inner_text('#loginSub') == 'Trocar a senha'
           and p4.inner_text('#rotuloAtual') == 'Senha atual' and p4.inner_text('#btnSenhaVoltar') == 'Voltar',
           f'o clique abre "Trocar a senha", pedindo a atual, com "Voltar" ({p4.url})')
        p4.click('#btnSenhaVoltar'); p4.wait_for_url('**/fiscal.html', timeout=8000)
        ok(estado(p4)['senhas'][SAM] == 'senha antiga 1', '"Voltar" volta pra tela sem trocar nada')
        p4.wait_for_selector(chip + '[role="link"]', timeout=8000)
        p4.focus(chip); p4.keyboard.press('Enter'); p4.wait_for_selector('#blocoSenha:not([hidden])', timeout=8000)
        p4.fill('#senhaAtual', 'nao e essa'); p4.fill('#senhaNova', 'senha nova 2026'); p4.fill('#senhaRepete', 'senha nova 2026'); p4.click('#btnSenha')
        p4.wait_for_function("() => document.getElementById('formError').textContent.trim() !== ''", timeout=5000)
        ok(erro(p4) == 'A senha atual não confere.', f'pelo teclado também; a atual errada não troca ({erro(p4)!r})')
        p4.fill('#senhaAtual', 'senha antiga 1'); p4.click('#btnSenha'); p4.wait_for_url('**/fiscal.html', timeout=8000)
        ok(estado(p4)['senhas'][SAM] == 'senha nova 2026', 'a atual certa: troca e volta pra tela de onde veio')

        # 5) a tela que perde o login com ela aberta (o Sair em outra aba, a sessão encerrada em outro lugar)
        p4.wait_for_selector(chip + '[role="link"]', timeout=8000)
        p4.evaluate('window.__marca = 1')
        p4.evaluate("() => window.__mockAuthEvento('TOKEN_REFRESHED', { user: { email: '%s' } })" % SAM)
        p4.wait_for_timeout(400)
        ok(p4.evaluate('window.__marca') == 1 and p4.url.endswith('/fiscal.html'), 'a sessão renovada da mesma pessoa: a tela segue')
        p4.evaluate('window.__mrSaindo = true')
        p4.evaluate("() => window.__mockAuthEvento('SIGNED_OUT', null)")
        p4.wait_for_timeout(400)
        ok(p4.evaluate('window.__marca') == 1 and p4.url.endswith('/fiscal.html'), 'o "Sair" da própria tela: o guarda não se mete (quem leva pro entrar é o Sair)')
        p4.evaluate('window.__mrSaindo = false')
        with p4.expect_navigation(timeout=8000):
            p4.evaluate("""() => { const a = JSON.parse(sessionStorage.getItem('mock_auth')); a.logado = false; sessionStorage.setItem('mock_auth', JSON.stringify(a));
                                   window.__mockAuthEvento('SIGNED_OUT', null); }""")
        p4.wait_for_selector('#btnLogin', timeout=8000)
        ok('login.html' in p4.url and 'saiu=1' in p4.url and 'redirect=%2Ffiscal.html' in p4.url and p4.inner_text('#loginSub') == 'A sessão terminou. Entre de novo.',
           f'a sessão terminou com a tela aberta: volta pro entrar, dizendo o porquê ({p4.url}, {p4.inner_text("#loginSub")!r})')
        p4.fill('#email', SAM); p4.fill('#password', 'senha nova 2026'); p4.click('#btnLogin'); p4.wait_for_url('**/fiscal.html', timeout=8000)
        ok(True, 'entrou de novo: volta pra tela onde estava')
        p4.wait_for_selector(chip + '[role="link"]', timeout=8000)
        with p4.expect_navigation(timeout=8000):
            p4.evaluate("() => window.__mockAuthEvento('SIGNED_IN', { user: { email: 'fiscal@macedoereis.com.br' } })")
        ok(True, 'outra pessoa entrou neste navegador (em outra aba): a tela recarrega')

        ok(not erros, f'sem erro de JavaScript ({erros[:2]})')
        b.close()
    srv.shutdown()
    print('\n' + ('Tudo certo.' if not falhas else f'{falhas} falha(s).'))
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
