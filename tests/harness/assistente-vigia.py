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
  6. o cartão proposto pela função, embaixo da resposta (o vigia no Fiscal);
  7. resolver ali mesmo (16/10/2026): quem vai cuidar da obrigação (leva a tarefa aberta junto, como em Obrigações
     fiscais), da tarefa e da rotina, descartar a proposta parada, o boleto enviado ou pago — com "Desfazer", o aviso às
     telas abertas e, passados os 10 minutos, fora da lista, da saudação e dos recados até a conferência seguinte;
  8. a segunda leva: admissão registrada, rescisão concluída, a empresa da ficha sem vínculo (com a busca), o alvará
     renovado e o que é de ex-cliente (cobrança, obrigação), com o "nada voltou" quando mexeram depois;
  9. a terceira: vincular as obrigações do regime (as sugeridas marcadas), pôr na cobrança, o cadastro que segue a carteira;
  e sem erro de JavaScript.
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
# o 7: os achados que se resolvem no cartão (com o registro de onde se resolve: ref_tabela/ref_id) e as linhas deles — a
# obrigação usa o vínculo sem responsável do banco falso (c1 · o1, com a tarefa aberta t71 e a repassada à mão t72) e a
# proposta, a apresentada pp1
DIA = lambda n: (HOJE + datetime.timedelta(days=n)).isoformat()
EXTRA = {
    'achados': [
        A('11', 'obrigacao_sem_responsavel', 'COMÉRCIO MODELO ME: obrigação sem responsável', 'EFD TESTE MENSAL sem ninguém da equipe.', 'fiscal', 'Thalia', 'media',
          'fiscal-obrigacoes.html', cliente_id='c1', ref_tabela='clientes', ref_id='c1'),
        A('12', 'tarefa_responsavel', 'Tarefa com responsável fora da equipe: DCTF DE TESTE', 'Está com "Fulano".', 'fiscal', 'Thalia', 'baixa', 'fiscal-tarefas.html',
          ref_tabela='tarefas', ref_id='t91'),
        A('13', 'rotina_sem_responsavel', 'Rotina sem responsável: BACKUP DE TESTE', 'Rotina da Gestão.', 'gestao', 'Ambos', 'baixa', 'gestao-rotinas.html', ref_tabela='rotinas', ref_id='r9'),
        A('14', 'proposta_parada', 'Proposta de PADARIA FICTÍCIA LTDA parada', 'Está "apresentada" e sem mudança.', 'comercial', 'Samuel', 'baixa', 'comercial-precificacao.html',
          ref_tabela='precificacoes', ref_id='pp1'),
        A('15', 'boleto_parado', 'Boleto de OFICINA DE TESTE LTDA (09/2026) ainda a emitir', 'Vence amanhã.', 'financeiro', 'Samuel', 'media', 'financeiro-boletos.html',
          cliente_id=E2, ref_tabela='cobrancas_mensais', ref_id='cb9')],
    'tabelas': {
        'tarefas': [{'id': 't91', 'titulo': 'DCTF DE TESTE', 'setor': 'fiscal', 'responsavel': 'Fulano', 'prazo': DIA(3), 'status': 'pendente', 'prioridade': 'media', 'cliente_id': None,
                     'proposta_id': None, 'hora': None, 'transicao_id': None, 'posicao': 910, 'concluida_em': None, 'concluida_por': None}],
        'rotinas': [{'id': 'r9', 'titulo': 'BACKUP DE TESTE', 'setor': 'gestao', 'responsavel': None, 'ativo': True, 'periodicidade': 'semanal', 'dia_semana': 1,
                     'ultima_execucao': None, 'adiada_para': None}],
        'cobrancas_mensais': [{'id': 'cb9', 'cliente_id': E2, 'competencia': '2026-09', 'valor': 350, 'vencimento': DIA(1), 'status': 'a_emitir', 'canal': None, 'responsavel': 'Samuel'}]}}
# o 8: a segunda leva — a admissão registrada, a rescisão concluída, a empresa da admissão sem vínculo (com a busca), o
# alvará renovado e o que segue ativo de quem saiu da carteira; e um achado com o registro de outra tabela (sem botão)
EXTRA2 = {
    'achados': [
        A('21', 'admissao_nao_registrada', 'Admissão de CICLANA DE TESTE (PADARIA DO TESTE LTDA) ainda não registrada', 'Começou a trabalhar e segue "em registro".', 'dp', 'Vitória', 'alta',
          'dp-admissoes.html?admissao=ad21', cliente_id=E1, ref_tabela='admissoes', ref_id='ad21'),
        A('22', 'admissao_sem_vinculo', 'Admissão de BELTRANA SEM EMPRESA sem empresa vinculada', 'A empresa digitou "OFICINA TESTE" e o nome não bateu com o cadastro.', 'dp', 'Vitória', 'media',
          'dp-admissoes.html?admissao=ad22', ref_tabela='admissoes', ref_id='ad22'),
        A('23', 'rescisao_pagamento', 'Rescisão de FULANO DE TESTE (OFICINA DE TESTE LTDA): pagamento chegando', 'Faltam 2 dias.', 'dp', 'Vitória', 'media',
          'dp-rescisoes.html?rescisao=rs23', cliente_id=E2, ref_tabela='rescisoes', ref_id='rs23'),
        A('24', 'alvara_vencendo', 'Alvará de funcionamento de PADARIA DO TESTE LTDA vence logo', 'Faltam 10 dias.', 'societario', 'Adaini', 'media', 'societario-alvaras.html',
          cliente_id=E1, ref_tabela='alvaras', ref_id='al24'),
        A('25', 'cobranca_ex_cliente', 'Cobrança ativa de ex-cliente: ANTIGA DE TESTE LTDA', 'Saiu da carteira e a cobrança segue ativa.', 'financeiro', 'Samuel', 'baixa',
          'financeiro-boletos.html', ref_tabela='cobrancas_config', ref_id='cc25'),
        A('26', 'obrigacao_ex_cliente', 'Obrigação ativa de ex-cliente: EFD TESTE MENSAL de ANTIGA DE TESTE LTDA', 'Saiu da carteira e a obrigação segue ativa.', 'fiscal', 'Thalia', 'media',
          'fiscal-obrigacoes.html', ref_tabela='cliente_obrigacoes', ref_id='v9'),
        A('27', 'alvara_vencendo', 'Alvará apontando pra outra tabela', 'Registro de outra tabela.', 'societario', 'Adaini', 'media', 'societario-alvaras.html',
          ref_tabela='clientes', ref_id='c1')],
    'tabelas': {
        'admissoes': [{'id': 'ad21', 'status': 'em_registro', 'cliente_id': E1, 'empresa_nome': 'PADARIA DO TESTE', 'funcionario_nome': 'CICLANA DE TESTE', 'registrada_em': None, 'registrada_por': None},
                      {'id': 'ad22', 'status': 'respondida', 'cliente_id': None, 'empresa_nome': 'OFICINA TESTE', 'funcionario_nome': 'BELTRANA SEM EMPRESA', 'registrada_em': None, 'registrada_por': None}],
        'rescisoes': [{'id': 'rs23', 'status': 'em_andamento', 'cliente_id': E2, 'funcionario_nome': 'FULANO DE TESTE', 'concluida_em': None, 'concluida_por': None}],
        'alvaras': [{'id': 'al24', 'status': 'vigente', 'vencimento': DIA(10), 'cliente_id': E1, 'tipo': 'Alvará de funcionamento'}],
        'cobrancas_config': [{'id': 'cc25', 'cliente_id': 'c9', 'ativo': True}],
        'cliente_obrigacoes': [{'id': 'v9', 'cliente_id': 'c9', 'obrigacao_id': 'o1', 'responsavel': 'Thalia', 'ativo': True}]}}
# o 9: a terceira leva — vincular as obrigações do regime (as sugeridas marcadas), pôr na cobrança, o cadastro que segue a
# carteira. Três empresas do Simples com obrigação (s41–s43) dão a conta da sugestão: o PGDAS de teste as três têm; o DEISS
# de Três Coroas é o da cidade da NOVA; a NFS-e de um cliente só fica nas outras
EXTRA3 = {
    'achados': [
        A('31', 'cliente_sem_obrigacao', 'NOVA DE TESTE LTDA sem nenhuma obrigação fiscal cadastrada', 'Cliente da carteira (Simples Nacional) sem obrigação ativa.', 'fiscal', 'Thalia', 'media',
          'fiscal-obrigacoes.html', cliente_id='k31', ref_tabela='clientes', ref_id='k31'),
        A('32', 'cliente_sem_cobranca', 'NOVA DE TESTE LTDA está na carteira e não tem cobrança', 'Nenhuma cobrança ativa na base de boletos.', 'financeiro', 'Samuel', 'media',
          'financeiro-boletos.html', cliente_id='k31', ref_tabela='clientes', ref_id='k31', so_socios=True),
        A('33', 'cadastro_desencontrado', 'ANTIGA DE TESTE LTDA saiu da carteira e o cadastro segue ativo', 'Saída em 31/05/2025 na carteira.', 'comercial', 'Samuel', 'baixa',
          'clientes/editar.html?id=k33', cliente_id='k33', ref_tabela='clientes', ref_id='k33')],
    'tabelas': {
        'clientes': [{'id': 'k31', 'nome_principal': 'NOVA DE TESTE LTDA', 'regime_tributario': 'Simples Nacional', 'cidade': 'Três Coroas', 'status': 'ativo', 'documento': '10000000000999'},
                     {'id': 'k33', 'nome_principal': 'ANTIGA DE TESTE LTDA', 'status': 'ativo', 'data_fim_cliente': None, 'documento': '10000000000888'},
                     *[{'id': s, 'nome_principal': 'SIMPLES ' + s, 'regime_tributario': 'Simples Nacional', 'status': 'ativo'} for s in ('s41', 's42', 's43')]],
        'obrigacoes_fiscais': [{'id': 'o41', 'nome': 'DEISS - TRES COROAS', 'periodicidade': 'mensal', 'regimes_aplicaveis': ['SIMPLES NACIONAL'], 'ativo': True},
                               {'id': 'o42', 'nome': 'PGDAS DE TESTE', 'periodicidade': 'mensal', 'regimes_aplicaveis': ['SIMPLES NACIONAL'], 'ativo': True},
                               {'id': 'o43', 'nome': 'NFS-E DE UM CLIENTE', 'periodicidade': 'mensal', 'regimes_aplicaveis': ['SIMPLES NACIONAL'], 'ativo': True}],
        'cliente_obrigacoes': [{'id': 'v4' + str(i), 'cliente_id': c, 'obrigacao_id': o, 'responsavel': 'Thalia', 'ativo': True}
                               for i, (c, o) in enumerate([('s41', 'o42'), ('s41', 'o41'), ('s42', 'o42'), ('s42', 'o43'), ('s43', 'o42')])],
        'precificacoes': [{'id': 'pp9', 'cliente_id': 'k31', 'cliente_nome': 'NOVA DE TESTE LTDA', 'status': 'fechada', 'honorario': 480, 'atualizado_em': DIA(-20) + 'T12:00:00Z'}],
        'carteira_info': [{'cliente_id': 'k33', 'entrada': '2025-01-01', 'saida': '2025-05-31'}]}}
ACOES = {'O que o vigia achou no fiscal?': {'tipo': 'vigia', 'ver': 'todos', 'setor': 'fiscal'}, 'O que dá pra resolver do vigia?': {'tipo': 'vigia', 'ver': 'todos'}}
SEMEAR = """
(() => {
  const CLIENTES = %s, ACHADOS = %s, ACOES = %s;
  const X = window.__vigiaExtra || {};
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v; v.clientes.push(...CLIENTES); v.vigia_achados = ACHADOS.concat(X.achados || []); v.assistente_chat = []; v.admissoes = [];
    Object.entries(X.tabelas || {}).forEach(([t, linhas]) => { v[t] = (v[t] || []).concat(linhas); });
  } });
  // o que o cartão avisa às telas abertas
  window.__eventos = [];
  ['mr:tarefas-mudaram', 'mr:boletos-mudaram'].forEach(n => window.addEventListener(n, e => window.__eventos.push([n, e.detail])));
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

        # 7) resolver ali mesmo (outra página: os achados com o registro de onde se resolvem e as linhas deles)
        p2 = b.new_page(viewport={'width': 1400, 'height': 900})
        p2.on('pageerror', lambda e: erros.append(str(e)))
        p2.add_init_script(TOUR); p2.add_init_script('window.__vigiaExtra = ' + json.dumps(EXTRA, ensure_ascii=False)); p2.add_init_script(SEMEAR)
        linha = lambda t, i: p2.evaluate('([t, i]) => window.__mockDb[t].find(x => x.id === i)', [t, i])
        historico = lambda: p2.evaluate("() => window.__mockDb.tarefa_historico.map(h => h.tarefa_id + ': ' + h.descricao)")
        guardados = lambda: p2.evaluate("() => Object.keys(JSON.parse(localStorage.getItem('mr_vigia_resolvidos:financeiro@macedoereis.com.br') || '{}'))")
        it2 = lambda trecho: card + ' li.as-vigia-item:has-text("' + trecho + '")'
        tit2 = lambda: p2.inner_text(card + ' .as-cartao-tit')
        abrir_grupos = lambda: p2.evaluate("() => document.querySelectorAll('.as-cartao-vigia details').forEach(d => { d.open = true; })")
        def clicar_e_esperar(trecho, botao, depois):
            p2.click(it2(trecho) + ' button:has-text("' + botao + '")')
            p2.wait_for_selector(it2(trecho) + ' button:has-text("' + depois + '")', timeout=5000)
        p2.goto(base + 'index.html'); p2.wait_for_selector('.as-lancador', timeout=5000)
        p2.click('.as-lancador'); p2.wait_for_timeout(200)
        p2.fill('.as-entrada textarea', 'O que dá pra resolver do vigia?'); p2.press('.as-entrada textarea', 'Enter')
        p2.wait_for_selector(card + ' .as-vigia-grupo', timeout=6000); abrir_grupos(); p2.wait_for_timeout(100)
        sel_obr = it2('COMÉRCIO MODELO ME: obrigação') + ' .as-vigia-resolver select'
        nomes = p2.eval_on_selector(sel_obr, 's => [...s.options].map(o => o.value)')
        boleto = p2.eval_on_selector_all(it2('Boleto de OFICINA') + ' .as-vigia-resolver button', 'bs => bs.map(b => b.textContent)')
        ok(tit2() == 'O que o vigia achou: 12' and p2.input_value(sel_obr) == 'Thalia' and 'Ambos' not in nomes and p2.input_value(it2('BACKUP DE TESTE') + ' .as-vigia-resolver select') == 'Ambos'
           and p2.is_visible(it2('Proposta de PADARIA') + ' button:has-text("Descartar proposta")') and boleto == ['Marcar como enviado', 'Marcar como pago']
           and not p2.query_selector(it2('Boleto de PADARIA') + ' .as-vigia-resolver') and not p2.query_selector(it2('GIA DE TESTE') + ' .as-vigia-resolver'),
           f'os botões: quem vai cuidar (com o dono do setor já escolhido; na obrigação, sem "Ambos"), descartar a proposta, o boleto enviado ou pago; achado sem o registro, sem botão ({tit2()!r}, {nomes}, {boleto})')

        clicar_e_esperar('COMÉRCIO MODELO ME: obrigação', 'Definir responsável', 'Desfazer')
        ok(linha('cliente_obrigacoes', 'v1')['responsavel'] == 'Thalia' and linha('tarefas', 't71')['responsavel'] == 'Thalia' and linha('tarefas', 't72')['responsavel'] == 'Adaini'
           and historico() == ['t71: Responsável definido pela obrigação: Thalia — pelo assistente do escritório (vigia).']
           and '✓ 1 obrigação passada pra Thalia (e 1 tarefa aberta).' in p2.inner_text(it2('COMÉRCIO MODELO ME: obrigação')) and tit2() == 'O que o vigia achou: 11' and guardados() == ['vg-11'],
           f'obrigação: o vínculo e a tarefa aberta dele vão pra Thalia (a repassada à mão fica), com o histórico; o achado fica resolvido, com "Desfazer", e a conta baixa ({tit2()!r}, {historico()})')
        clicar_e_esperar('COMÉRCIO MODELO ME: obrigação', 'Desfazer', 'Definir responsável')
        ok(linha('cliente_obrigacoes', 'v1')['responsavel'] is None and linha('tarefas', 't71')['responsavel'] is None and tit2() == 'O que o vigia achou: 12' and guardados() == [],
           'desfazer: o vínculo e a tarefa voltam a sem ninguém, e o achado volta pra lista')

        p2.select_option(it2('DCTF DE TESTE') + ' .as-vigia-resolver select', 'Vitória')
        clicar_e_esperar('DCTF DE TESTE', 'Definir responsável', 'Desfazer')
        ok(linha('tarefas', 't91')['responsavel'] == 'Vitória' and '✓ Tarefa passada pra Vitória.' in p2.inner_text(it2('DCTF DE TESTE'))
           and 't91: Responsável alterado de Fulano para Vitória — pelo assistente do escritório (vigia).' in historico(),
           'tarefa: com quem foi escolhido (a regra do "passar" do assistente, com o histórico)')
        clicar_e_esperar('BACKUP DE TESTE', 'Definir responsável', 'Desfazer')
        ok(linha('rotinas', 'r9')['responsavel'] == 'Ambos' and '✓ Rotina passada pra Ambos.' in p2.inner_text(it2('BACKUP DE TESTE')), 'rotina: com quem o vigia sugeriu ("Ambos")')

        data_pp1 = linha('precificacoes', 'pp1')['atualizado_em']
        clicar_e_esperar('Proposta de PADARIA', 'Descartar proposta', 'Desfazer')
        ok(linha('precificacoes', 'pp1')['status'] == 'descartada' and '✓ Proposta descartada.' in p2.inner_text(it2('Proposta de PADARIA')), 'proposta: descartada, como no seletor da Precificação')
        clicar_e_esperar('Proposta de PADARIA', 'Desfazer', 'Descartar proposta')
        ok(linha('precificacoes', 'pp1')['status'] == 'apresentada' and linha('precificacoes', 'pp1')['atualizado_em'] == data_pp1,
           'desfazer: volta a "apresentada" com a mesma data (pro vigia, parada desde o mesmo dia)')

        clicar_e_esperar('Boleto de OFICINA', 'Marcar como enviado', 'Desfazer')
        eventos = p2.evaluate('() => window.__eventos')
        ok(linha('cobrancas_mensais', 'cb9')['status'] == 'enviado' and ['mr:boletos-mudaram', {'mudancas': [{'id': 'cb9', 'status': 'enviado'}]}] in eventos
           and any(e[0] == 'mr:tarefas-mudaram' for e in eventos) and tit2() == 'O que o vigia achou: 9',
           f'boleto: enviado; as telas abertas ficam sabendo (a grade de boletos, a Agenda) ({tit2()!r})')
        # a conferência de hora em hora roda dentro dos 10 minutos e tira o achado do banco: o "Desfazer" continua no cartão
        p2.evaluate("() => { window.__mockDb.vigia_achados.find(a => a.id === 'vg-15').situacao = 'resolvido'; }")
        p2.click(card + ' .as-vigia-abas button:has-text("De todos")'); p2.wait_for_timeout(500); abrir_grupos(); p2.wait_for_timeout(100)
        ok(p2.is_visible(it2('Boleto de OFICINA') + ' button:has-text("Desfazer")') and tit2() == 'O que o vigia achou: 9',
           f'a conferência rodou dentro dos 10 minutos: o resolvido continua no cartão, com o "Desfazer" ({tit2()!r})')
        p2.click(it2('Boleto de OFICINA') + ' button:has-text("Desfazer")')
        p2.wait_for_selector(it2('Desfeito. O vigia já tinha conferido'), timeout=5000)
        ok(linha('cobrancas_mensais', 'cb9')['status'] == 'a_emitir' and 'vg-15' not in guardados(),
           'desfazer depois da conferência: o boleto volta a "a emitir" e o cartão diz que o achado volta na conferência seguinte')

        # (o banco falso nasce de novo a cada página: o boleto volta aberto, como na conferência seguinte)
        p2.reload(); p2.wait_for_selector('.as-painel:not([hidden]) ' + card + ' .as-vigia-grupo', timeout=6000); abrir_grupos(); p2.wait_for_timeout(100)
        ok(p2.is_visible(it2('DCTF DE TESTE') + ' button:has-text("Desfazer")') and tit2() == 'O que o vigia achou: 10', f'recarregou: os resolvidos voltam com o "Desfazer" ({tit2()!r})')
        # passados os 10 minutos do "Desfazer" (a hora de cada um, na conversa guardada, vai 11 minutos pra trás)
        p2.evaluate("""() => { const k = 'mr_assistente:escritorio', j = JSON.parse(sessionStorage.getItem(k)), antes = new Date(Date.now() - 11 * 60e3).toISOString();
          j.msgs.forEach(m => { if (m.acao && m.acao.resolvidos) Object.values(m.acao.resolvidos).forEach(x => { x.em = antes; }); });
          sessionStorage.setItem(k, JSON.stringify(j)); }""")
        p2.reload(); p2.wait_for_selector('.as-painel:not([hidden]) ' + card + ' .as-vigia-grupo', timeout=6000); abrir_grupos(); p2.wait_for_timeout(100)
        ok(not p2.query_selector(it2('DCTF DE TESTE')) and not p2.query_selector(it2('BACKUP DE TESTE')) and p2.is_visible(it2('Boleto de OFICINA') + ' button:has-text("Marcar como enviado")')
           and tit2() == 'O que o vigia achou: 10', f'passados os 10 minutos: os resolvidos saem da lista até a conferência seguinte (o desfeito, não) ({tit2()!r})')
        p2.click('.as-acao[data-a="fechar"]'); p2.wait_for_timeout(150)
        p2.add_init_script('window.__assistenteRecados = true')
        p2.goto(base + 'index.html'); p2.wait_for_selector('.as-recado:not([hidden])', timeout=6000)
        sauda2 = p2.inner_text('.as-recado-txt')
        ok('O vigia achou 5 coisas pra você conferir (1 urgente).' in sauda2, f'a saudação do dia também não conta o resolvido (a rotina; o boleto foi desfeito) ({sauda2[-70:]!r})')

        # 8) a segunda leva (outra página: os achados e as linhas deles)
        p3 = b.new_page(viewport={'width': 1400, 'height': 900})
        p3.on('pageerror', lambda e: erros.append(str(e)))
        p3.add_init_script(TOUR); p3.add_init_script('window.__vigiaExtra = ' + json.dumps(EXTRA2, ensure_ascii=False)); p3.add_init_script(SEMEAR)
        l3 = lambda t, i: p3.evaluate('([t, i]) => window.__mockDb[t].find(x => x.id === i)', [t, i])
        it3 = lambda trecho: card + ' li.as-vigia-item:has-text("' + trecho + '")'
        tit3 = lambda: p3.inner_text(card + ' .as-cartao-tit')
        abrir3 = lambda: p3.evaluate("() => document.querySelectorAll('.as-cartao-vigia details').forEach(d => { d.open = true; })")
        def clicar3(trecho, botao, depois):
            p3.click(it3(trecho) + ' button:has-text("' + botao + '")')
            p3.wait_for_selector(it3(trecho) + ' button:has-text("' + depois + '")', timeout=5000)
        p3.goto(base + 'index.html'); p3.wait_for_selector('.as-lancador', timeout=5000)
        p3.click('.as-lancador'); p3.wait_for_timeout(200)
        p3.fill('.as-entrada textarea', 'O que dá pra resolver do vigia?'); p3.press('.as-entrada textarea', 'Enter')
        p3.wait_for_selector(card + ' .as-vigia-grupo', timeout=6000); abrir3(); p3.wait_for_timeout(100)
        rot = lambda trecho: p3.eval_on_selector_all(it3(trecho) + ' .as-vigia-resolver button', 'bs => bs.map(b => b.textContent)')
        ok(tit3() == 'O que o vigia achou: 14' and rot('CICLANA') == ['Marcar como registrada'] and rot('FULANO DE TESTE') == ['Marcar como concluída']
           and rot('BELTRANA') == ['Vincular a empresa'] and rot('Alvará de funcionamento') == ['Renovar'] and p3.is_disabled(it3('Alvará de funcionamento') + ' button:has-text("Renovar")')
           and rot('Cobrança ativa de ex-cliente') == ['Parar a cobrança'] and rot('EFD TESTE MENSAL de ANTIGA') == ['Desativar a obrigação']
           and not p3.query_selector(it3('Alvará apontando pra outra tabela') + ' .as-vigia-resolver'),
           f'os botões da segunda leva; o achado que aponta pra outra tabela fica sem botão ({tit3()!r})')

        clicar3('CICLANA', 'Marcar como registrada', 'Desfazer')
        ad21 = l3('admissoes', 'ad21')
        ok(ad21['status'] == 'registrada' and ad21['registrada_por'] == 'financeiro@macedoereis.com.br' and bool(ad21['registrada_em'])
           and any(e[0] == 'mr:tarefas-mudaram' for e in p3.evaluate('() => window.__eventos'))
           and '✓ Admissão registrada (e a tarefa dela, concluída).' in p3.inner_text(it3('CICLANA')), 'admissão: registrada, com quando e quem (como o seletor da tela); a Agenda fica sabendo')
        clicar3('CICLANA', 'Desfazer', 'Marcar como registrada')
        ad21 = l3('admissoes', 'ad21')
        ok(ad21['status'] == 'em_registro' and ad21['registrada_por'] is None and ad21['registrada_em'] is None, 'desfazer: volta a "em registro", sem o quando e o quem')
        clicar3('FULANO DE TESTE', 'Marcar como concluída', 'Desfazer')
        ok(l3('rescisoes', 'rs23')['status'] == 'concluida' and l3('rescisoes', 'rs23')['concluida_por'] == 'financeiro@macedoereis.com.br', 'rescisão: concluída, com quando e quem')

        p3.click(it3('BELTRANA') + ' button:has-text("Vincular a empresa")')
        p3.wait_for_selector(it3('BELTRANA') + ' .as-vigia-empresa:has-text("OFICINA DE TESTE LTDA")', timeout=5000)
        busca = p3.input_value(it3('BELTRANA') + ' .as-vigia-busca input')
        p3.click(it3('BELTRANA') + ' .as-vigia-empresa:has-text("OFICINA DE TESTE LTDA")')
        p3.wait_for_selector(it3('BELTRANA') + ' button:has-text("Desfazer")', timeout=5000)
        ok(busca == 'OFICINA TESTE' and l3('admissoes', 'ad22')['cliente_id'] == E2 and '✓ Vinculada a OFICINA DE TESTE LTDA.' in p3.inner_text(it3('BELTRANA')),
           f'vínculo: a busca começa pelo nome que a empresa digitou; escolher a empresa vincula ({busca!r})')

        data_al = it3('Alvará de funcionamento') + ' input[type=date]'
        p3.fill(data_al, DIA(0)); p3.click(it3('Alvará de funcionamento') + ' button:has-text("Renovar")')
        p3.wait_for_selector(it3('Alvará de funcionamento') + ' .as-cartao-erro', timeout=5000)
        ok('depois de hoje' in p3.inner_text(it3('Alvará de funcionamento') + ' .as-cartao-erro') and p3.is_visible(it3('Alvará de funcionamento') + ' button:has-text("Renovar")')
           and l3('alvaras', 'al24')['vencimento'] == DIA(10), 'alvará: a data de hoje não renova — o erro aparece e o botão volta')
        p3.fill(data_al, DIA(20)); clicar3('Alvará de funcionamento', 'Renovar', 'Desfazer')
        guardados3 = p3.evaluate("() => Object.keys(JSON.parse(localStorage.getItem('mr_vigia_resolvidos:financeiro@macedoereis.com.br') || '{}'))")
        ok(l3('alvaras', 'al24')['vencimento'] == DIA(20) and 'o vigia continua avisando' in p3.inner_text(it3('Alvará de funcionamento')) and 'vg-24' not in guardados3,
           'alvará renovado por pouco tempo (vence em até 30 dias): o vigia continua avisando, e ele não sai desta máquina')
        clicar3('Alvará de funcionamento', 'Desfazer', 'Renovar')
        p3.fill(data_al, DIA(400)); clicar3('Alvará de funcionamento', 'Renovar', 'Desfazer')
        hist_al = p3.evaluate("() => window.__mockDb.alvara_historico.map(h => h.descricao)")
        dbr = lambda n: (HOJE + datetime.timedelta(days=n)).strftime('%d/%m/%Y')
        ok(l3('alvaras', 'al24')['vencimento'] == DIA(400) and l3('alvaras', 'al24')['status'] == 'vigente' and len(hist_al) == 3
           and hist_al[-1] == 'Renovado: vencimento ' + dbr(10) + ' → ' + dbr(400) + ' — pelo assistente do escritório (vigia).'
           and '✓ Renovado até ' + dbr(400) + '.' in p3.inner_text(it3('Alvará de funcionamento')),
           f'alvará: renovado, vigente, com a linha na linha do tempo (como o "Renovar" da tela) ({hist_al})')

        clicar3('Cobrança ativa de ex-cliente', 'Parar a cobrança', 'Desfazer')
        ok(l3('cobrancas_config', 'cc25')['ativo'] is False, 'ex-cliente: a cobrança sai da base de boletos')
        clicar3('EFD TESTE MENSAL de ANTIGA', 'Desativar a obrigação', 'Desfazer')
        ok(l3('cliente_obrigacoes', 'v9')['ativo'] is False, 'ex-cliente: a obrigação desativa')
        clicar3('EFD TESTE MENSAL de ANTIGA', 'Desfazer', 'Desativar a obrigação')
        ok(l3('cliente_obrigacoes', 'v9')['ativo'] is True, 'desfazer: a obrigação volta ativa')
        # alguém reativou a cobrança na tela de Boletos: o "Desfazer" daqui não tem o que voltar
        p3.evaluate("() => { const c = window.__mockDb.cobrancas_config.find(x => x.id === 'cc25'); c.ativo = true; }")
        p3.click(it3('Cobrança ativa de ex-cliente') + ' button:has-text("Desfazer")')
        p3.wait_for_selector(it3('Nada voltou'), timeout=5000)
        ok(l3('cobrancas_config', 'cc25')['ativo'] is True, 'desfazer depois de mexerem na tela: "nada voltou", sem gravar por cima')
        p3.click(card + ' .as-vigia-abas button:has-text("De todos")'); p3.wait_for_timeout(500); abrir3(); p3.wait_for_timeout(100)
        ok(tit3() == 'O que o vigia achou: 10' and p3.is_visible(it3('CICLANA') + ' button:has-text("Marcar como registrada")'),
           f'a conta: os resolvidos saem; os desfeitos voltam com o botão ({tit3()!r})')

        # 9) a terceira leva: vincular obrigações, pôr na cobrança, o cadastro que segue a carteira
        p4 = b.new_page(viewport={'width': 1400, 'height': 900})
        p4.on('pageerror', lambda e: erros.append(str(e)))
        p4.add_init_script(TOUR); p4.add_init_script('window.__vigiaExtra = ' + json.dumps(EXTRA3, ensure_ascii=False)); p4.add_init_script(SEMEAR)
        l4 = lambda t, i: p4.evaluate('([t, i]) => window.__mockDb[t].find(x => x.id === i)', [t, i])
        it4 = lambda trecho: card + ' li.as-vigia-item:has-text("' + trecho + '")'
        abrir4 = lambda: p4.evaluate("() => document.querySelectorAll('.as-cartao-vigia details.as-vigia-grupo').forEach(d => { d.open = true; })")
        vinc = lambda: p4.evaluate("() => window.__mockDb.cliente_obrigacoes.filter(v => v.cliente_id === 'k31').map(v => v.obrigacao_id + ':' + v.responsavel + ':' + v.ativo).sort()")
        p4.goto(base + 'index.html'); p4.wait_for_selector('.as-lancador', timeout=5000)
        p4.click('.as-lancador'); p4.wait_for_timeout(200)
        p4.fill('.as-entrada textarea', 'O que dá pra resolver do vigia?'); p4.press('.as-entrada textarea', 'Enter')
        p4.wait_for_selector(card + ' .as-vigia-grupo', timeout=6000); abrir4(); p4.wait_for_timeout(100)
        rot4 = lambda trecho: p4.eval_on_selector_all(it4(trecho) + ' .as-vigia-resolver button', 'bs => bs.map(b => b.textContent)')
        ok(rot4('sem nenhuma obrigação') == ['Vincular obrigações'] and rot4('não tem cobrança') == ['Pôr na cobrança'] and rot4('ANTIGA DE TESTE') == ['Marcar o cadastro como inativo'],
           'os botões da terceira leva: vincular obrigações, pôr na cobrança, o cadastro como inativo (saiu da carteira)')

        p4.click(it4('sem nenhuma obrigação') + ' button:has-text("Vincular obrigações")')
        p4.wait_for_selector(it4('sem nenhuma obrigação') + ' .as-vigia-busca .as-cartao-lista', timeout=5000)
        marcadas = p4.eval_on_selector_all(it4('sem nenhuma obrigação') + ' .as-vigia-busca input[type=checkbox]:checked', 'cs => cs.map(c => c.closest("label").querySelector("b").textContent).sort()')
        outras = p4.eval_on_selector_all(it4('sem nenhuma obrigação') + ' .as-vigia-outras input[type=checkbox]', 'cs => cs.map(c => c.closest("label").querySelector("b").textContent + (c.checked ? "*" : "")).sort()')
        botao_v = p4.inner_text(it4('sem nenhuma obrigação') + ' .as-vigia-busca button.as-botao-pri')
        ok(marcadas == ['DEISS - TRES COROAS', 'PGDAS DE TESTE'] and 'NFS-E DE UM CLIENTE' in outras and all(not x.endswith('*') for x in outras)
           and p4.input_value(it4('sem nenhuma obrigação') + ' .as-vigia-busca select') == 'Thalia' and botao_v == 'Vincular as 2 marcadas',
           f'vincular obrigações: as do regime, com as sugeridas marcadas (a que as empresas do Simples têm e o DEISS da cidade); as outras sem marcar ({marcadas}, {outras}, {botao_v!r})')
        p4.click(it4('sem nenhuma obrigação') + ' .as-vigia-busca button.as-botao-pri')
        p4.wait_for_selector(it4('sem nenhuma obrigação') + ' button:has-text("Desfazer")', timeout=5000)
        ok(vinc() == ['o41:Thalia:true', 'o42:Thalia:true'] and '✓ 2 obrigações vinculadas, com Thalia.' in p4.inner_text(it4('sem nenhuma obrigação')),
           f'vincular: as marcadas entram com quem cuida, como o "Vincular" da tela ({vinc()})')
        p4.click(it4('sem nenhuma obrigação') + ' button:has-text("Desfazer")')
        p4.wait_for_selector(it4('sem nenhuma obrigação') + ' button:has-text("Vincular obrigações")', timeout=5000)
        ok(vinc() == [], 'desfazer: os vínculos novos saem (ainda sem tarefa)')

        p4.click(it4('não tem cobrança') + ' button:has-text("Pôr na cobrança")')
        p4.wait_for_selector(it4('não tem cobrança') + ' input.as-vigia-valor', timeout=5000)
        valor_sug = p4.input_value(it4('não tem cobrança') + ' input.as-vigia-valor')
        p4.fill(it4('não tem cobrança') + ' input.as-vigia-dia', '15')
        p4.click(it4('não tem cobrança') + ' .as-vigia-resolver button.as-botao-pri')
        p4.wait_for_selector(it4('não tem cobrança') + ' button:has-text("Desfazer")', timeout=5000)
        cfg = p4.evaluate("() => window.__mockDb.cobrancas_config.find(c => c.cliente_id === 'k31')")
        txt_cob = p4.inner_text(it4('não tem cobrança')).replace('\xa0', ' ')
        ok(valor_sug == '480' and cfg and cfg['valor_base'] == 480 and cfg['dia_vencimento'] == 15 and cfg['ativo'] is True and cfg['canal'] == 'whatsapp'
           and 'R$ 480,00, vencimento dia 15' in txt_cob, f'pôr na cobrança: o valor sugerido pela proposta fechada, o dia escolhido, na base de boletos ({valor_sug!r}, {cfg})')

        p4.click(it4('ANTIGA DE TESTE') + ' button:has-text("Marcar o cadastro como inativo")')
        p4.wait_for_selector(it4('ANTIGA DE TESTE') + ' button:has-text("Desfazer")', timeout=5000)
        k33 = l4('clientes', 'k33')
        ok(k33['status'] == 'inativo' and k33['data_fim_cliente'] == '2025-05-31' and '✓ Cadastro marcado como inativo (fim como cliente: 31/05/2025).' in p4.inner_text(it4('ANTIGA DE TESTE')),
           f'o cadastro segue a carteira: inativo, com o fim como cliente na data da saída ({k33})')
        p4.click(it4('ANTIGA DE TESTE') + ' button:has-text("Desfazer")')
        p4.wait_for_selector(it4('ANTIGA DE TESTE') + ' button:has-text("Marcar o cadastro como inativo")', timeout=5000)
        k33 = l4('clientes', 'k33')
        ok(k33['status'] == 'ativo' and k33['data_fim_cliente'] is None, 'desfazer: o cadastro volta como estava')

        ok(not erros, f'sem erro de JavaScript ({erros[:2]})')
        b.close()
    srv.shutdown()
    print('\n' + ('Tudo certo.' if not falhas else f'{falhas} falha(s).'))
    sys.exit(1 if falhas else 0)

if __name__ == '__main__':
    main()
