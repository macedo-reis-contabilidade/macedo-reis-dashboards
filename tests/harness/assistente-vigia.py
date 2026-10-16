"""Teste do vigia do sistema no assistente do escritório (assets/js/vigia.js + o cartão "vigia" de assistente-acoes.js,
15/10/2026): o banco acha o que ficou pra trás ou desencontrado (vigia_achados, as regras rodam no próprio banco) e o
assistente mostra — na saudação do dia (quanto é de quem entrou, quantos urgentes), no recado de cada tela (o que é dali;
no hub do setor, o setor; na ficha da empresa, o que é dela) e no cartão, por grupo, com "Abrir" (a tela onde se resolve) e
"Ignorar" (com "Desfazer"; a aba "Ignorados" traz de volta). A função "assistente" entra como dublê, por
window.__mockInvoke (devolve o cartão do vigia como proposta); a função e as contas puras têm testes próprios
(tests/assistente-funcao.test.mjs e tests/vigia.test.mjs).
Sem login e sem banco: mesmo mock do conferir.py (quem está na tela é o Samuel, financeiro@, sócio); os achados
(inventados) entram por uma armadilha em window.__mockDb.

    python tests/harness/assistente-vigia.py

Confere:
  1. a saudação do dia diz quanto o vigia achou pra quem entrou (dos sócios, com "Ambos"), com os urgentes, e o botão
     "Ver o que o vigia achou" ao lado do "Revisar as atrasadas";
  2. o cartão: os grupos (o urgente primeiro), cada achado com o porquê, "Abrir" com o endereço da tela e "Ignorar"; a
     última olhada fica guardada (os "novos" da próxima saudação);
  3. ignorar tira da lista (no banco, só a situação) com "Desfazer"; desfazer volta;
  4. as abas: de todos (com de quem é cada um), os ignorados (quem ignorou e "Voltar a mostrar");
  5. o recado da tela (Admissões: os dois dali), "Ver quais" com o recorte e "Ver tudo"; o hub do DP; a ficha da empresa
     (o que é dela, depois do recado do resumo);
  6. o cartão proposto pela função, embaixo da resposta (o vigia no Fiscal); e sem erro de JavaScript.
Termina com código 1 se alguma checagem falhar.
Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, json, re, pathlib, datetime
sys.dont_write_bytecode = True
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir

HOJE = datetime.date.today()
AGORA = datetime.datetime.now(datetime.timezone.utc)
ISO = lambda dt: dt.strftime('%Y-%m-%dT%H:%M:%S+00:00')
E1, E2 = '9a1b2c3d-0000-4000-8000-0000000000f1', '9a1b2c3d-0000-4000-8000-0000000000f2'
CLIENTES = [{'id': E1, 'nome_principal': 'PADARIA DO TESTE LTDA', 'nome_fantasia': None, 'documento': '10000000000272', 'status': 'ativo', 'tipo_pessoa': 'PJ'},
            {'id': E2, 'nome_principal': 'OFICINA DE TESTE LTDA', 'nome_fantasia': None, 'documento': '10000000000353', 'status': 'ativo', 'tipo_pessoa': 'PJ'}]
def A(i, regra, titulo, detalhe, setor, resp, grav, link, **extra):
    a = {'id': 'vg-' + i, 'chave': regra + ':' + i, 'regra': regra, 'titulo': titulo, 'detalhe': detalhe, 'setor': setor, 'responsavel': resp, 'gravidade': grav,
         'so_socios': False, 'cliente_id': None, 'link': link, 'prazo': None, 'situacao': 'aberto', 'primeiro_visto': ISO(AGORA - datetime.timedelta(days=2)),
         'ultimo_visto': ISO(AGORA - datetime.timedelta(minutes=20)), 'ignorado_em': None, 'ignorado_por': None}
    a.update(extra); return a
ACHADOS = [
    A('1', 'admissao_nao_registrada', 'Admissão de FULANA DE TESTE (PADARIA DO TESTE LTDA) ainda não registrada', 'Começou a trabalhar e no sistema a admissão segue "recebida — a registrar".',
      'dp', 'Vitória', 'alta', 'dp-admissoes.html?admissao=ad-1', cliente_id=E1),
    A('2', 'admissao_sem_vinculo', 'Admissão de BELTRANO DE TESTE sem empresa vinculada', 'A empresa digitou "PADARIA TESTE" e o nome não bateu com o cadastro.', 'dp', 'Vitória', 'media', 'dp-admissoes.html?admissao=ad-2'),
    A('3', 'boleto_parado', 'Boleto de PADARIA DO TESTE LTDA (09/2026) ainda a emitir', 'Venceu e segue "a emitir" na grade.', 'financeiro', 'Samuel', 'alta', 'financeiro-boletos.html', cliente_id=E1),
    A('4', 'cliente_sem_cobranca', 'OFICINA DE TESTE LTDA está na carteira e não tem cobrança', 'Nenhuma cobrança ativa na base de boletos.', 'financeiro', 'Samuel', 'media', 'financeiro-boletos.html', cliente_id=E2, so_socios=True),
    A('5', 'reforma_prazo', 'Opção do IBS/CBS por fora: faltam 15 dias e 3 casos estão sem decisão', 'Prazo 30/10.', 'fiscal', 'Ambos', 'media', 'fiscal-reforma.html'),
    A('6', 'tarefa_responsavel', 'Tarefa sem responsável: GIA DE TESTE', 'setor Fiscal', 'fiscal', 'Thalia', 'baixa', 'fiscal-tarefas.html'),
    A('7', 'cliente_sem_obrigacao', 'PADARIA DO TESTE LTDA sem nenhuma obrigação fiscal cadastrada', 'Cliente da carteira sem obrigação ativa.', 'fiscal', 'Thalia', 'media', 'fiscal-obrigacoes.html', cliente_id=E1),
    A('8', 'proposta_parada', 'Proposta de CLIENTE DE TESTE parada sem resposta', 'Está "apresentada" e sem mudança.', 'comercial', 'Samuel', 'baixa', 'comercial-precificacao.html',
      situacao='ignorado', ignorado_por='diego@macedoereis.com.br', ignorado_em=ISO(AGORA - datetime.timedelta(days=1))),
    A('9', 'alvara_vencendo', 'Alvará de PADARIA DO TESTE LTDA venceu', 'Já renovado.', 'societario', 'Adaini', 'alta', 'societario-alvaras.html', situacao='resolvido', cliente_id=E1)]
ACOES = {'O que o vigia achou no fiscal?': {'tipo': 'vigia', 'ver': 'todos', 'setor': 'fiscal'}}
SEMEAR = """
(() => {
  const CLIENTES = %s, ACHADOS = %s, ACOES = %s;
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v; v.clientes.push(...CLIENTES); v.vigia_achados = ACHADOS; v.assistente_chat = []; v.admissoes = [];
  } });
  window.__chamadas = [];
  window.__mockInvoke = async (nome, opts) => {
    window.__chamadas.push({ nome, body: JSON.parse(JSON.stringify(opts.body || {})) });
    const ev = o => 'data: ' + JSON.stringify(o) + '\\n\\n';
    const acao = ACOES[opts.body.pergunta] || null;
    return { data: ev({ tipo: 'resposta', texto: 'O vigia achou 3 coisas no Fiscal.', ...(acao ? { acao } : {}) }), error: null };
  };
})();
""" % tuple(json.dumps(x, ensure_ascii=False) for x in (CLIENTES, ACHADOS, ACOES))
TOUR = "(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()"

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
        p = b.new_page(viewport={'width': 1400, 'height': 900})
        p.on('pageerror', lambda e: erros.append(str(e)))
        p.add_init_script(TOUR); p.add_init_script(SEMEAR); p.add_init_script('window.__assistenteRecados = true')
        achado = lambda i: p.evaluate('id => window.__mockDb.vigia_achados.find(a => a.id === id)', i)
        card = '.as-cartao-vigia'
        tit = lambda: p.inner_text(card + ' .as-cartao-tit')
        item = lambda trecho: card + ' li.as-vigia-item:has-text("' + trecho + '")'
        def limpar_dias(manter_saudacao=True):
            p.evaluate("m => { for (const k of Object.keys(localStorage)) if (k.startsWith('mr_assistente_dia:') && !(m && k.endsWith(':saudacao'))) localStorage.removeItem(k); }", manter_saudacao)

        # 1) a saudação do dia
        p.goto(base + 'index.html'); p.wait_for_selector('.as-lancador', timeout=5000)
        limpar_dias(False); p.evaluate("() => localStorage.removeItem('mr_vigia_visto:financeiro@macedoereis.com.br')")
        p.reload(); p.wait_for_selector('.as-recado:not([hidden])', timeout=6000)
        sauda = p.inner_text('.as-recado-txt')
        botoes = p.eval_on_selector_all('.as-recado .as-chip-acao', 'bs => bs.map(b => b.textContent)')
        ok('O vigia achou 3 coisas pra você conferir (1 urgente).' in sauda and botoes == ['Revisar as atrasadas', 'Ver o que o vigia achou'],
           f'a saudação diz o que o vigia achou pra quem entrou (do sócio, com "Ambos"), com o botão ({sauda[-70:]!r}, {botoes})')

        # 2) o cartão
        p.click('.as-recado .as-chip-acao:has-text("Ver o que o vigia achou")')
        p.wait_for_selector(card + ' .as-vigia-grupo', timeout=6000)
        grupos = p.eval_on_selector_all(card + ' .as-vigia-grupo > summary', 'ss => ss.map(s => s.textContent)')
        ok(tit() == 'O que o vigia achou pra você: 3' and 'O que o vigia achou pra você conferir:' in p.inner_text('.as-lista .as-msg.ia:last-child'),
           f'o cartão abre na conversa, com a conta de quem entrou ({tit()!r})')
        ok(grupos == ['Boletos parados · 1urgente', 'Clientes sem cobrança · 1', 'Prazo da opção da Reforma · 1'] and p.evaluate("() => [...document.querySelectorAll('.as-cartao-vigia details')].every(d => d.open)"),
           f'os grupos, o urgente primeiro, abertos (poucos achados) ({grupos})')
        href = p.get_attribute(item('Boleto de PADARIA') + ' a', 'href')
        ok(href == base + 'financeiro-boletos.html' and 'Venceu e segue "a emitir" na grade.' in p.inner_text(item('Boleto de PADARIA')) and p.is_visible(item('Boleto de PADARIA') + ' .as-tag'),
           f'cada achado com o porquê, "Abrir" (a tela onde se resolve) e a marca de urgente ({href})')
        ok(bool(p.evaluate("() => localStorage.getItem('mr_vigia_visto:financeiro@macedoereis.com.br')")) and 'Conferido ' in p.inner_text(card),
           'a última olhada fica guardada; o cartão diz quando o vigia conferiu')

        # 3) ignorar e desfazer
        p.click(item('Opção do IBS/CBS') + ' button:has-text("Ignorar")')
        p.wait_for_selector(item('Opção do IBS/CBS') + ' button:has-text("Desfazer")', timeout=5000)
        ok(achado('vg-5')['situacao'] == 'ignorado' and tit() == 'O que o vigia achou pra você: 2' and 'Ignorado.' in p.inner_text(item('Opção do IBS/CBS')),
           'ignorar: no banco, só a situação; o achado fica na lista com "Desfazer" e a conta baixa')
        p.click(item('Opção do IBS/CBS') + ' button:has-text("Desfazer")')
        p.wait_for_selector(item('Opção do IBS/CBS') + ' button:has-text("Ignorar")', timeout=5000)
        ok(achado('vg-5')['situacao'] == 'aberto' and tit() == 'O que o vigia achou pra você: 3', 'desfazer: volta pra lista')

        # 4) as abas
        p.click(card + ' .as-vigia-abas button:has-text("De todos")')
        p.wait_for_function("() => document.querySelector('.as-cartao-vigia .as-cartao-tit').textContent === 'O que o vigia achou: 7'", timeout=5000)
        ok('Com Vitória.' in p.inner_text(item('Admissão de FULANA')) and p.get_attribute(card + ' .as-vigia-abas button:has-text("De todos")', 'aria-pressed') == 'true',
           'de todos: os 7 abertos, com de quem é cada um (o resolvido não aparece)')
        p.click(card + ' .as-vigia-abas button:has-text("Ignorados")')
        p.wait_for_selector(item('Proposta de CLIENTE') + ' button:has-text("Voltar a mostrar")', timeout=5000)
        ontem = (HOJE - datetime.timedelta(days=1)).strftime('%d/%m/%Y')
        ok('Ignorado por Diego em ' + ontem + '.' in p.inner_text(item('Proposta de CLIENTE')), f'os ignorados: quem ignorou e quando ({p.inner_text(item("Proposta de CLIENTE"))[-60:]!r})')
        p.click(item('Proposta de CLIENTE') + ' button:has-text("Voltar a mostrar")')
        p.wait_for_function("() => document.querySelector('.as-cartao-vigia').innerText.includes('Nada ignorado.')", timeout=5000)
        ok(achado('vg-8')['situacao'] == 'aberto', '"Voltar a mostrar": o achado volta a aberto')
        # (o banco falso nasce de novo a cada página: o achado volta a ignorado)
        p.reload(); p.wait_for_selector('.as-painel:not([hidden]) ' + item('Proposta de CLIENTE'), timeout=6000)
        ok(p.get_attribute(card + ' .as-vigia-abas button:has-text("Ignorados")', 'aria-pressed') == 'true' and tit() == 'Ignorados: 1',
           f'recarregou: o cartão volta na aba em que estava, lendo o banco de novo ({tit()!r})')
        p.click('.as-acao[data-a="fechar"]'); p.wait_for_timeout(150)

        # 5) o recado da tela, o hub do setor e a ficha da empresa
        limpar_dias()
        p.goto(base + 'dp-admissoes.html'); p.wait_for_selector('.as-recado:not([hidden])', timeout=6000)
        rec = p.inner_text('.as-recado-txt')
        ok('O vigia achou 2 coisas pra conferir nesta tela (1 urgente).' in rec and p.inner_text('.as-recado .as-chip-acao') == 'Ver quais', f'o recado da tela: o que o vigia achou ali ({rec!r})')
        p.click('.as-recado .as-chip-acao'); p.wait_for_selector('.as-lista .as-msg.ia:last-child ' + card + ' .as-vigia-grupo', timeout=6000)
        ultimo = '.as-lista .as-msg.ia:last-child ' + card
        ok(p.inner_text(ultimo + ' .as-cartao-tit') == 'O que o vigia achou nesta tela: 2', f'"Ver quais": o cartão com o recorte da tela ({p.inner_text(ultimo + " .as-cartao-tit")!r})')
        p.click(ultimo + ' button:has-text("Ver tudo")')
        p.wait_for_function("u => document.querySelector(u + ' .as-cartao-tit').textContent === 'O que o vigia achou: 7'", arg=ultimo, timeout=5000)
        ok(True, '"Ver tudo" tira o recorte (os 7 abertos)')
        p.click('.as-acao[data-a="fechar"]'); p.wait_for_timeout(150)
        p.goto(base + 'dp.html'); p.wait_for_selector('.as-recado:not([hidden])', timeout=6000)
        ok('O vigia achou 2 coisas pra conferir no DP (1 urgente).' in p.inner_text('.as-recado-txt'), f'no hub do setor, o setor todo ({p.inner_text(".as-recado-txt")!r})')
        p.click('.as-recado-x')
        p.goto(base + 'clientes/editar.html?id=' + E1); p.wait_for_selector('.as-lancador', timeout=6000)
        achou, fim = None, datetime.datetime.now() + datetime.timedelta(seconds=25)
        while datetime.datetime.now() < fim and not achou:
            if p.is_visible('.as-recado'):
                t = p.inner_text('.as-recado-txt')
                if 'desta empresa' in t: achou = t; break
                p.click('.as-recado-x')   # o recado do resumo da empresa vem antes; o do vigia espera e tenta de novo
            p.wait_for_timeout(400)
        ok(achou is not None and 'O vigia achou 3 coisas pra conferir desta empresa (2 urgentes).' in achou, f'na ficha da empresa, o que é dela (o resolvido não conta) ({achou!r})')

        # 6) o cartão proposto pela função
        p.click('.as-lancador'); p.wait_for_timeout(200)
        p.fill('.as-entrada textarea', 'O que o vigia achou no fiscal?'); p.press('.as-entrada textarea', 'Enter')
        p.wait_for_selector('.as-lista .as-msg.ia:last-child ' + card + ' .as-vigia-grupo', timeout=6000)
        ok(p.inner_text('.as-lista .as-msg.ia:last-child ' + card + ' .as-cartao-tit') == 'O que o vigia achou no Fiscal: 3', 'a proposta da função: o cartão embaixo da resposta, com o recorte do setor')

        ok(not erros, f'sem erro de JavaScript ({erros[:2]})')
        b.close()
    srv.shutdown()
    print('\n' + ('Tudo certo.' if not falhas else f'{falhas} falha(s).'))
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
