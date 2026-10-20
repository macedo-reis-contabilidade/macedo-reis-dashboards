"""Precificação › Carteira (19/10/2026): a revisão do honorário dos clientes da casa (comercial-precificacao.html, a aba
Carteira, só dos sócios; assets/js/precificacao-carteira.js e o motor em assets/js/precificacao-motor.js) e o reajuste
aceito entrando no boleto (financeiro-boletos.html). Sem login e sem banco: o mock do conferir.py (quem está na tela é o
Samuel, sócio), com os dados semeados por uma armadilha em window.__mockDb — empresas, parâmetros e valores inventados.

    python tests/harness/precificacao-carteira.py

Confere:
  1. a aba Carteira: o resumo (clientes, hoje, quem paga menos que o piso), a ordem (o mais abaixo do piso primeiro), o
     honorário de hoje pelo boleto, pelo Conta Azul (o nome do cliente) e sem cobrança, o piso com a diferença, o MEI e as
     tarefas; o ex-cliente fora; os filtros;
  2. revisar: o questionário já preenchido (com a etiqueta de onde veio cada resposta), o que falta responder, o painel
     comparando com o de hoje; responder tira da lista do que falta; mudar a resposta do sistema tira a etiqueta;
  3. salvar a revisão: grava em revisoes_honorario (situação "estudo", o motor, o de hoje e de onde veio), nada em
     Propostas; volta à carteira com a revisão na linha;
  4. a situação: reajuste proposto; aceito com o valor e o mês — o boleto a emitir do mês troca na hora (e a base), a
     revisão fica aplicada e a linha diz "no boleto";
  5. o aceito pra um mês ainda não gerado: a tela Boletos, ao gerar o mês, põe o valor combinado no lugar do copiado e
     marca a revisão como aplicada;
  6. o MEI: a revisão na aba MEI (os dados do cadastro, o plano comparado com o de hoje), gravada com o plano;
  7. "Nova" sai da revisão (o botão volta a ser de proposta);
e nenhum erro de JavaScript. Termina com código 1 se alguma checagem falhar.
Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, json, pathlib, datetime
sys.dont_write_bytecode = True
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir

HOJE = datetime.date.today()
COMP = HOJE.strftime('%Y-%m')
def mais_meses(comp, n):
    a, m = map(int, comp.split('-')); t = a * 12 + (m - 1) + n
    return f'{t // 12:04d}-{t % 12 + 1:02d}'
ANT, PROX = mais_meses(COMP, -1), mais_meses(COMP, 1)
MES_BR = lambda c: c[5:7] + '/' + c[:4]
D = lambda n: (HOJE + datetime.timedelta(days=n)).isoformat()

def Q(id, bloco, tipo, pergunta, opcoes=None, ordem=0):
    return {'id': id, 'bloco': bloco, 'tipo': tipo, 'pergunta': pergunta, 'opcoes': opcoes, 'ajuda': '', 'externa': False, 'ativo': True, 'ordem': ordem}
A, B, C, DD, E = 'A. DADOS GERAIS', 'B. VOLUME', 'C. FOLHA', 'D. OBRIGAÇÕES', 'E. QUALIDADE'
QUESTOES = [Q('A1', A, 'texto', 'Nome da empresa / cliente', ordem=1), Q('A1B', A, 'texto', 'CNPJ', ordem=2), Q('A2M', A, 'numero', 'Faturamento mensal médio (R$)', ordem=3),
    Q('A4', A, 'select', 'Tipo societário', ['MEI', 'EI', 'SLU', 'LTDA', 'S/A', 'Associação', 'Outro'], 4), Q('A5', A, 'numero', 'Número de sócios', ordem=5),
    Q('A6', A, 'texto', 'Município-sede', ordem=6), Q('A10', A, 'select', 'Regime tributário', ['Simples Nacional', 'Lucro Presumido', 'Lucro Real', 'Imune/Isenta (associação)'], 7),
    Q('A11', A, 'texto', 'Setor de atividade / CNAE principal', ordem=8), Q('A11B', A, 'sim_nao', 'Atividade sujeita ao Fator R?', ordem=9),
    Q('A12', A, 'sim_nao', 'Migração de outro escritório contábil?', ordem=10), Q('A12B', A, 'numero', 'Qual valor de honorários contábeis paga atualmente? (R$/mês)', ordem=11),
    Q('A13', A, 'select', 'Situação da escrituração anterior', ['Em dia', 'Desorganizada/inexistente', 'Não se aplica', 'Não sei'], 12),
    Q('B3', B, 'select', 'Quem emite as notas fiscais', ['Nossa empresa', 'O escritório contábil'], 13),
    Q('B8', B, 'select', 'Sistema ERP', ['Não possui', 'Possui sem integração contábil', 'Possui integrado à contabilidade'], 14),
    Q('C1', C, 'numero', 'Funcionários registrados (ativos)', ordem=15), Q('D6', DD, 'sim_nao', 'EFD-Reinf aplicável?', ordem=16),
    Q('D12', DD, 'numero', 'Número de parcelamentos de impostos ativos', ordem=17), Q('D13', DD, 'sim_nao', 'Setor de risco fiscal elevado?', ordem=18),
    Q('D14', DD, 'sim_nao', 'DeSTDA aplicável?', ordem=19), Q('E2', E, 'select', 'Qualidade da organização dos documentos recebidos', ['Ótima', 'Boa', 'Regular', 'Ruim'], 20)]
PARAMS = [['p01_x', '0', 80, 0, 1], ['p01_x', '200000', 160, 200000, 2], ['p02_x', 'Simples Nacional', 1, None, 1], ['p02_x', 'Lucro Presumido', 1.5, None, 2],
    ['p03_x', 'Valor por sócio adicional (além do 1º)', 30, None, 1], ['p04_x', 'Adicional - escritório emite as notas fiscais', 90, None, 1],
    ['p07_x', 'Não possui', 200, None, 1], ['p07_x', 'Possui sem integração contábil', 60, None, 2], ['p07_x', 'Possui integrado à contabilidade', -20, None, 3],
    ['p08_x', 'Valor por funcionário registrado', 12, None, 1], ['p11_x', 'eSocial/EFD-Reinf', 30, None, 1], ['p11_x', 'Reforma Tributária (transição/apuração dual)', 120, None, 2],
    ['p11_x', 'Valor por parcelamento ativo', 20, None, 3], ['p12_x', 'Multiplicador - setor sem risco elevado (Não)', 1, None, 1], ['p16_x', 'Arredondar honorário final para múltiplo de (R$)', 10, None, 1]]
PARAMS = [{'id': 'pp' + str(i), 'grupo': g, 'chave': k, 'valor': v, 'limite_inferior': li, 'ordem': o} for i, (g, k, v, li, o) in enumerate(PARAMS)]
OBRIG_PREC = [{'id': 'efd_reinf', 'nome': 'EFD-Reinf', 'periodicidade': 'mensal', 'regimes': ['Simples Nacional', 'Lucro Presumido'], 'questao_id': 'D6', 'multa_tipo': 'fixa', 'multa_valor': 0, 'ativo': True, 'ordem': 1},
    {'id': 'destda', 'nome': 'DeSTDA', 'periodicidade': 'mensal', 'regimes': ['Simples Nacional'], 'questao_id': 'D14', 'multa_tipo': 'fixa', 'multa_valor': 0, 'ativo': True, 'ordem': 2}]
CA, CB, CC, CD, CF, CX = ('cart-a', 'cart-b', 'cart-c', 'cart-d', 'cart-f', 'cart-x')
CLIENTES = [
    {'id': CA, 'nome_principal': 'PADARIA DO TESTE LTDA', 'nome_fantasia': 'PADARIA TESTE', 'documento': '10000000000191', 'tipo_pessoa': 'PJ', 'regime_tributario': 'Simples Nacional', 'status': 'ativo',
     'natureza_juridica': 'Sociedade Empresária Limitada', 'cnae_principal': '1091-1/02', 'cidade': 'Cidade Teste', 'uf': 'RS', 'logradouro': 'Rua A', 'numero': '10', 'bairro': 'Centro', 'cep': '95000-000'},
    {'id': CB, 'nome_principal': 'OFICINA DE TESTE LTDA', 'nome_fantasia': None, 'documento': '10000000000272', 'tipo_pessoa': 'PJ', 'regime_tributario': 'Lucro Presumido', 'status': 'ativo',
     'natureza_juridica': '2062', 'cnae_principal': '4520-0/01', 'cidade': 'Cidade Teste', 'uf': 'RS'},
    {'id': CC, 'nome_principal': 'FULANO DE TESTE 12345678901', 'nome_fantasia': 'CHAVEIRO TESTE', 'documento': '10000000000353', 'tipo_pessoa': 'PJ', 'regime_tributario': 'MEI', 'status': 'ativo',
     'natureza_juridica': 'Empresário (Individual)', 'cnae_principal': '9529-1/02', 'cidade': 'Cidade Teste', 'uf': 'RS', 'logradouro': 'Rua B', 'numero': '5', 'bairro': 'Vila', 'telefone_principal': '51900000000'},
    {'id': CD, 'nome_principal': 'SEM COBRANÇA TESTE LTDA', 'nome_fantasia': None, 'documento': '10000000000434', 'tipo_pessoa': 'PJ', 'regime_tributario': 'Simples Nacional', 'status': 'ativo', 'cidade': 'Cidade Teste', 'uf': 'RS'},
    {'id': CF, 'nome_principal': 'MERCADO DE TESTE LTDA', 'nome_fantasia': None, 'documento': '10000000000515', 'tipo_pessoa': 'PJ', 'regime_tributario': 'Simples Nacional', 'status': 'ativo', 'cidade': 'Cidade Teste', 'uf': 'RS'},
    {'id': CX, 'nome_principal': 'EX-CLIENTE TESTE LTDA', 'nome_fantasia': None, 'documento': '10000000000604', 'tipo_pessoa': 'PJ', 'regime_tributario': 'Simples Nacional', 'status': 'inativo', 'cidade': 'Cidade Teste', 'uf': 'RS'}]
CARTEIRA = [{'cliente_id': CA, 'entrada': '2020-01-10', 'saida': None, 'segmento': 'COMÉRCIO', 'sistemas': 'EMISSOR SEFAZ', 'ramo': 'PADARIA'},
    {'cliente_id': CB, 'entrada': '2021-02-01', 'saida': None, 'segmento': 'SERVIÇO', 'sistemas': 'SISTEMA DE TESTE', 'ramo': 'OFICINA'},
    {'cliente_id': CC, 'entrada': '2023-05-01', 'saida': None, 'segmento': 'SERVIÇO', 'sistemas': '-', 'ramo': 'CHAVEIRO'},
    {'cliente_id': CD, 'entrada': '2024-01-01', 'saida': None, 'segmento': 'COMÉRCIO', 'sistemas': '-', 'ramo': 'LOJA'},
    {'cliente_id': CF, 'entrada': '2022-03-01', 'saida': None, 'segmento': 'COMÉRCIO', 'sistemas': 'SISTEMA DE TESTE', 'ramo': 'MERCADO'},
    {'cliente_id': CX, 'entrada': '2019-01-01', 'saida': '2025-12-31', 'segmento': 'COMÉRCIO', 'sistemas': '-', 'ramo': 'LOJA'}]
OBRIG = [{'id': 'of1', 'nome': 'EFD REINF - MENSAL', 'ativo': True}, {'id': 'of2', 'nome': 'SEDIF/DESTDA - SIMPLES NACIONAL', 'ativo': True},
    {'id': 'of3', 'nome': 'EMISSÃO DA GUIA DE PARCELAMENTO - SIMPLES NACIONAL', 'ativo': True}, {'id': 'of4', 'nome': 'NFS-E FULANO DE TESTE', 'ativo': True}, {'id': 'of5', 'nome': 'PGDAS', 'ativo': True}]
VINCULOS = [{'id': 'vx' + str(i), 'cliente_id': CA, 'obrigacao_id': o, 'ativo': True} for i, o in enumerate(['of1', 'of2', 'of3', 'of4', 'of5'])] + [{'id': 'vxf', 'cliente_id': CF, 'obrigacao_id': 'of5', 'ativo': True}]
BOLETO = lambda i, cli, comp, valor, status: {'id': i, 'cliente_id': cli, 'competencia': comp, 'valor': valor, 'vencimento': D(10), 'status': status, 'canal': 'whatsapp', 'contato_envio': '', 'destino': '', 'responsavel': '', 'observacao': '', 'itens_extras': []}
# o mês de hoje primeiro: o banco falso ignora a ordem, e a geração copia a primeira competência anterior que ele devolve
COBRANCAS = [BOLETO('bx2', CA, COMP, 300, 'a_emitir'), BOLETO('bx3', CC, COMP, 100, 'enviado'), BOLETO('bx4', CF, COMP, 400, 'a_emitir'), BOLETO('bx1', CA, ANT, 300, 'pago')]
CONFIG = [{'id': 'cfa', 'cliente_id': CA, 'valor_base': 300, 'dia_vencimento': 10, 'canal': 'whatsapp', 'contato_envio': '', 'destino': '', 'responsavel': '', 'ativo': True},
    {'id': 'cfc', 'cliente_id': CC, 'valor_base': 100, 'dia_vencimento': 10, 'canal': 'whatsapp', 'contato_envio': '', 'destino': '', 'responsavel': '', 'ativo': True},
    {'id': 'cff', 'cliente_id': CF, 'valor_base': 400, 'dia_vencimento': 10, 'canal': 'whatsapp', 'contato_envio': '', 'destino': '', 'responsavel': '', 'ativo': True}]
PARCELAS = [{'id': 'ca1', 'natureza': 'receita', 'fornecedor_cliente_nome': 'Oficina de Teste', 'total': 900, 'data_vencimento': D(-20), 'categorias': [{'nome': 'HONORÁRIOS MENSAIS'}]},
    {'id': 'ca2', 'natureza': 'receita', 'fornecedor_cliente_nome': 'Oficina de Teste', 'total': 250, 'data_vencimento': D(-10), 'categorias': [{'nome': 'SERVIÇOS EXTRAS'}]}]
TAREFAS = [{'id': 'tx' + str(i), 'cliente_id': CA, 'origem': 'avulsa' if i < 2 else 'recorrente', 'titulo': 'TAREFA TESTE', 'status': 'concluida', 'setor': 'fiscal', 'responsavel': 'Thalia',
    'prazo': D(-5), 'created_at': (datetime.datetime.now() - datetime.timedelta(days=10)).isoformat()} for i in range(5)]
REVISOES = [{'id': 'rv-f', 'cliente_id': CF, 'respostas': {'A1': 'MERCADO DE TESTE LTDA', 'A10': 'Simples Nacional', 'A12B': 400}, 'resultado': None, 'honorario_sugerido': 520, 'honorario_atual': 400,
    'fonte_atual': 'boletos', 'honorario_novo': None, 'vigencia': None, 'status': 'proposto', 'criado_por': 'financeiro@macedoereis.com.br', 'criado_em': D(-3) + 'T12:00:00Z',
    'atualizado_em': D(-3) + 'T12:00:00Z', 'aplicado_em': None, 'aplicado_por': None}]
MEI_PLANOS = [{'id': 'mp1', 'nome': 'MEI ESSENCIAL (TESTE)', 'slogan': 'o básico', 'valor_mensal': 120, 'ativo': True, 'ordem': 1}]
MEI_SERV = [{'id': 'ms1', 'nome': 'DAS mensal', 'grupo': 'mensal', 'valor_avulso': 30, 'tipo': None, 'ativo': True, 'ordem': 1}]
SEMEAR = """
(() => {
  const X = %s;
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v;
    v.precificacao_questoes = X.QUESTOES; v.precificacao_parametros = X.PARAMS; v.precificacao_obrigacoes = X.OBRIG_PREC;
    v.mei_planos = X.MEI_PLANOS; v.mei_servicos = X.MEI_SERV; v.mei_plano_servicos = [{ plano_id: 'mp1', servico_id: 'ms1' }];
    v.clientes.push(...X.CLIENTES); v.carteira_info = X.CARTEIRA; v.obrigacoes_fiscais = X.OBRIG; v.cliente_obrigacoes = X.VINCULOS;
    v.cobrancas_mensais = X.COBRANCAS; v.cobrancas_config = X.CONFIG; v.ca_parcelas = X.PARCELAS; v.tarefas = X.TAREFAS; v.revisoes_honorario = X.REVISOES;
    v.socios = [{ id: 's1', cliente_id: '%s', nome: 'SOCIO UM' }, { id: 's2', cliente_id: '%s', nome: 'SOCIO DOIS' }];
    v.fr_empresas = []; v.regularizacoes = [{ id: 'rg1', cliente_id: '%s', status: 'parcelado' }];
    v.rt_casos = [{ id: 'rt1', cliente_id: '%s', receita_mensal: 25000, rbt12: 300000, decisao: 'por_fora' }];
    v.precificacoes = [];
    // a tela Boletos abre num banco novo (o falso não guarda entre as páginas): com a marca, ele já vem como a Carteira
    // deixou — a revisão do mercado aceita pro mês que vem e o boleto da padaria com o valor novo
    if (localStorage.getItem('__semente_boletos') === '1') {
      Object.assign(v.revisoes_honorario.find(x => x.id === 'rv-f'), { status: 'aceito', honorario_novo: 480, vigencia: '%s' });
      v.cobrancas_mensais.find(b => b.id === 'bx2').valor = 640;
    }
  } });
})();
""" % (json.dumps({'QUESTOES': QUESTOES, 'PARAMS': PARAMS, 'OBRIG_PREC': OBRIG_PREC, 'MEI_PLANOS': MEI_PLANOS, 'MEI_SERV': MEI_SERV, 'CLIENTES': CLIENTES, 'CARTEIRA': CARTEIRA,
      'OBRIG': OBRIG, 'VINCULOS': VINCULOS, 'COBRANCAS': COBRANCAS, 'CONFIG': CONFIG, 'PARCELAS': PARCELAS, 'TAREFAS': TAREFAS, 'REVISOES': REVISOES}, ensure_ascii=False), CA, CA, CA, CA, PROX)
TOUR = "(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()"

def brl(v):
    return 'R$ ' + format(v, ',.0f').replace(',', '.')

def espera(p, js, ms=5000):
    try:
        p.wait_for_function(js, timeout=ms); return True
    except Exception:
        return False

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
        p = b.new_page(viewport={'width': 1400, 'height': 950})
        p.on('pageerror', lambda e: erros.append(str(e)))
        p.add_init_script(TOUR); p.add_init_script(SEMEAR)
        db = lambda expr: p.evaluate('() => ' + expr)
        linha = lambda cli: f'#ctLista tr[data-cli="{cli}"]'
        txt = lambda sel: p.inner_text(sel).replace('\xa0', ' ')

        print('1. A aba Carteira')
        p.goto(base + 'comercial-precificacao.html'); p.wait_for_selector('#prQuestionario .pr-q', timeout=8000)
        ok(p.is_visible('#segCarteira'), 'o sócio vê a aba Carteira')
        p.click('#segCarteira'); p.wait_for_selector(linha(CA), timeout=8000)
        resumo = txt('#ctResumo')
        ok('5 clientes na carteira' in resumo and 'R$ 1.700/mês' in resumo and '(4 com valor)' in resumo and '1 de 5 revisado' in resumo, f'o resumo: os clientes de hoje (o ex-cliente fora), a soma de hoje e os revisados ({resumo!r})')
        # quem paga menos que o motor: a padaria pelo piso (650 − 300) e o mercado pela revisão dele (520 − 400), não pelo piso
        ok('2 pagam menos que o motor · +R$ 470/mês até ele (R$ 120 nos revisados)' in resumo, f'o que falta até o motor: o piso de quem não foi revisado, a revisão de quem foi ({resumo!r})')
        ordem = p.eval_on_selector_all('#ctLista tr', 'trs => trs.map(t => t.dataset.cli)')
        ok(ordem[0] == CA and ordem[-1] == CD and CX not in ordem, f'o mais abaixo do piso primeiro; quem não tem como comparar no fim ({ordem})')
        la = txt(linha(CA))
        ok('R$ 300' in la and 'boleto de ' + MES_BR(COMP) in la and 'Simples' in la and 'PADARIA TESTE' in la, f'hoje pelo boleto da última competência ({la!r})')
        # piso da padaria: base 160 (300 mil/ano) + ERP 200 + Reinf 30 + parcelamento 20 + Reforma por fora 120 + notas pelo escritório 90 + sócio 30 = 650
        ok('R$ 650' in la and '+117%' in la, f'o piso do motor com a diferença ({la!r})')
        ok('2 avulsas' in la, 'as tarefas dos últimos 90 dias, com as avulsas')
        lb = txt(linha(CB))
        ok('R$ 900' in lb and 'Conta Azul' in lb, f'sem boleto, o honorário do Conta Azul pelo nome do cliente (sem os extras) ({lb!r})')
        lc, ld = txt(linha(CC)), txt(linha(CD))
        ok('plano MEI' in lc and 'R$ 100' in lc, f'o MEI: hoje pelo boleto, o plano na aba MEI ({lc!r})')
        ok('sem cobrança no sistema' in ld and 'Revisar' in ld, f'sem cobrança nenhuma ({ld!r})')
        lf = txt(linha(CF))
        ok('R$ 520' in lf and '+30%' in lf and 'revisado em' in lf and 'piso' not in lf and p.input_value(linha(CF) + ' select[data-sit]') == 'proposto' and 'Abrir a revisão' in lf,
           f'revisado: a coluna do motor mostra a revisão (não o piso), com a situação ({lf!r})')
        ok('piso, só com o sistema' in la and p.inner_text('#ctLista').count('Revisar') >= 3, 'quem não foi revisado: o piso e o "Revisar"')
        p.check('#ctAbaixo')
        so = p.eval_on_selector_all('#ctLista tr', 'trs => trs.map(t => t.dataset.cli)')
        ok(so == [CA, CF], f'filtro: só quem paga menos que o motor — o mercado entra pela revisão ({so})')
        p.uncheck('#ctAbaixo'); p.fill('#ctBusca', 'oficina')
        so = p.eval_on_selector_all('#ctLista tr', 'trs => trs.map(t => t.dataset.cli)')
        ok(so == [CB], f'a busca pelo nome ({so})')
        p.fill('#ctBusca', '')

        print('2. Revisar')
        p.click(linha(CA) + ' [data-abrir]'); p.wait_for_selector('#prQuestionario .pr-cart-banner', timeout=5000)
        ban = txt('#prQuestionario .pr-cart-banner')
        ok('Revisão de honorário · PADARIA DO TESTE LTDA · hoje R$ 300/mês' in ban, f'o aviso em cima: quem e o de hoje ({ban[:120]!r})')
        val = lambda q: p.input_value(f'#prQuestionario [data-q="{q}"]')
        chip = lambda q: p.eval_on_selector(f'#prQuestionario .pr-q[data-qid="{q}"]', 'd => { const c = d.querySelector(".pr-chip-sis"); return c && !c.hidden ? c.textContent : null; }')
        ok(val('A10') == 'Simples Nacional' and chip('A10') == 'cadastro' and val('A2M') == '25000' and chip('A2M') == 'Reforma' and val('A12B') == '300' and chip('A12B') == 'boleto',
           f'preenchido, com a etiqueta de onde veio (regime: {chip("A10")}, faturamento: {chip("A2M")}, hoje: {chip("A12B")})')
        ok(val('D6') == 'Sim' and val('D14') == 'Sim' and val('D12') == '1' and chip('D6') == 'obrigações' and val('B3') == 'O escritório contábil' and val('B8') == 'Não possui' and chip('B8') == 'carteira'
           and val('A5') == '2' and chip('A5') == 'sócios', 'as obrigações vinculadas, quem emite as notas, o sistema da carteira e os sócios')
        faltam = txt('#prCartFaltam')
        ok('Funcionários registrados' in faltam and 'Qualidade da organização dos documentos recebidos' in faltam and 'Regime' not in faltam, f'o que falta responder (que mexe no preço) ({faltam!r})')
        comp = txt('#prCartComp')
        ok('Hoje R$ 300 → motor R$ 650' in comp and '+117%' in comp and p.is_hidden('#prOrc'), f'o painel compara com o de hoje; o orçamento pro cliente sai de cena ({comp!r})')
        ok(p.is_hidden('#prSalvar') and p.is_hidden('#prSalvarNova') and 'A revisão grava sozinha' in txt('#prSalvoMsg') and db('window.__mockDb.revisoes_honorario.length') == 1,
           f'sem o botão de salvar: a revisão grava sozinha — e abrir não grava nada ({txt("#prSalvoMsg")!r})')
        p.fill('#prQuestionario [data-q="C1"]', '4'); p.wait_for_timeout(150)
        ok('Funcionários registrados' not in txt('#prCartFaltam') and 'R$ 700' in txt('#prCartComp'), 'responder tira da lista do que falta e o motor sobe')
        p.select_option('#prQuestionario [data-q="B8"]', 'Possui integrado à contabilidade'); p.wait_for_timeout(150)
        ok(chip('B8') is None, 'mudar a resposta que veio do sistema tira a etiqueta')
        motor = p.inner_text('#prTotal').replace('\xa0', ' ')

        print('3. A revisão grava sozinha')
        n_prop = db('window.__mockDb.precificacoes.length')
        ok(espera(p, "() => document.getElementById('prSalvoMsg').textContent.includes('Gravada às')"), f'um instante depois da mudança, "Gravada às…" ({txt("#prSalvoMsg")!r})')
        rv = db(f"window.__mockDb.revisoes_honorario.find(r => r.cliente_id === '{CA}')")
        ok(rv and rv['status'] == 'estudo' and rv['honorario_atual'] == 300 and rv['fonte_atual'] == 'boletos' and rv['criado_por'] == 'financeiro@macedoereis.com.br'
           and 'R$ ' + format(rv['honorario_sugerido'], ',.0f').replace(',', '.') == motor and rv['respostas']['C1'] == '4', f'gravou a revisão: estudo, o motor ({motor}), o de hoje e de onde veio ({ {k: (rv or {}).get(k) for k in ("status", "honorario_sugerido", "honorario_atual", "fonte_atual")} })')
        ok(db('window.__mockDb.precificacoes.length') == n_prop and rv['respostas'].get('B8') == 'Possui integrado à contabilidade', 'nada em Propostas; a resposta mudada foi junto')
        p.fill('#prObsOrc', 'conversar com o cliente')
        ok(espera(p, f"() => {{ const rs = window.__mockDb.revisoes_honorario.filter(r => r.cliente_id === '{CA}'); return rs.length === 1 && rs[0].respostas.obs_orcamento === 'conversar com o cliente'; }}"),
           'a mudança seguinte atualiza a mesma revisão (uma só)')
        p.fill('#prObsOrc', 'conversar com o cliente amanhã')
        p.click('#prQuestionario [data-cart="sair"]'); p.wait_for_selector(linha(CA) + ' select[data-sit]', timeout=8000)
        ok(db(f"window.__mockDb.revisoes_honorario.find(r => r.cliente_id === '{CA}').respostas.obs_orcamento") == 'conversar com o cliente amanhã',
           '"Voltar à carteira" logo depois de mudar: grava antes de sair')
        la = txt(linha(CA))
        ok(motor in la and 'revisado em' in la and 'piso, só com o sistema' not in la and p.input_value(linha(CA) + ' select[data-sit]') == 'estudo',
           f'de volta à carteira: a linha mostra a revisão no lugar do piso, em estudo ({la!r})')
        m = int(motor.replace('R$ ', '').replace('.', ''))
        resumo = txt('#ctResumo')
        ok('2 de 5 revisados' in resumo and f'+{brl(m - 300 + 120)}/mês até ele ({brl(m - 300 + 120)} nos revisados)' in resumo,
           f'o resumo acompanha a revisão: a padaria entra pelo motor revisado ({motor}), não mais pelo piso ({resumo!r})')

        print('4. A situação: proposto e aceito (o boleto a emitir do mês troca na hora)')
        p.select_option(linha(CA) + ' select[data-sit]', 'proposto'); p.wait_for_timeout(300)
        ok(db(f"window.__mockDb.revisoes_honorario.find(r => r.cliente_id === '{CA}').status") == 'proposto', 'reajuste proposto: gravado')
        p.select_option(linha(CA) + ' select[data-sit]', 'aceito'); p.wait_for_selector('#ovAceite[style*="flex"]', timeout=3000)
        meses = p.eval_on_selector_all('#acMes option', 'os => os.map(o => [o.value, o.disabled])')
        ok(meses[0] == [COMP, False] and p.input_value('#acMes') == PROX and len(meses) == 13, f'o aceite: o mês de hoje (boleto a emitir) e os seguintes, o próximo marcado ({meses[:3]})')
        ok(p.input_value(linha(CA) + ' select[data-sit]') == 'proposto', 'enquanto o aceite não é confirmado, a situação fica como estava')
        p.fill('#acValor', '640'); p.select_option('#acMes', COMP)
        p.click('#acConfirmar'); p.wait_for_function("() => document.getElementById('acMsg').textContent.startsWith('✓')", timeout=5000)
        msg = txt('#acMsg')
        rv = db(f"window.__mockDb.revisoes_honorario.find(r => r.cliente_id === '{CA}')")
        bol = db("window.__mockDb.cobrancas_mensais.find(b => b.id === 'bx2')")
        cfg = db("window.__mockDb.cobrancas_config.find(c => c.id === 'cfa')")
        ok(rv['status'] == 'aceito' and rv['honorario_novo'] == 640 and rv['vigencia'] == COMP and rv['aplicado_em'] and rv['aplicado_por'] == 'financeiro@macedoereis.com.br',
           f'aceito: o valor, o mês e a revisão aplicada ({ {k: rv.get(k) for k in ("status", "honorario_novo", "vigencia", "aplicado_por")} })')
        ok(bol['valor'] == 640 and cfg['valor_base'] == 640 and db("window.__mockDb.cobrancas_mensais.find(b => b.id === 'bx1').valor") == 300,
           'o boleto a emitir do mês já está com o valor novo, a base também; o mês passado (pago) não muda')
        ok('já está com o valor novo' in msg, f'o aviso diz ({msg!r})')
        p.click('#acCancelar'); p.wait_for_timeout(150)
        la = txt(linha(CA))
        ok('Aceito · no boleto' in la and 'combinado, a partir de ' + MES_BR(COMP) in la and la.count('R$ 640') == 2, f'a linha diz que entrou no boleto, e o de hoje já é o novo ({la!r})')
        resumo = txt('#ctResumo')
        ok('R$ 2.040/mês' in resumo and '1 reajuste aceito · +R$ 340/mês' in resumo and '1 paga menos que o motor · +R$ 120/mês' in resumo,
           f'o resumo: o de hoje com o boleto novo, o reajuste aceito, e a padaria sai do que falta ({resumo!r})')
        p.click(linha(CA) + ' [data-abrir]'); p.wait_for_selector('#prQuestionario .pr-cart-banner', timeout=5000)
        ok('está como Aceito' in txt('#prSalvoMsg') and 'começa uma revisão nova' in txt('#prSalvoMsg'), f'reabrir a aceita avisa ({txt("#prSalvoMsg")!r})')
        p.fill('#prObsOrc', 'rever no ano que vem')
        ok(espera(p, f"() => window.__mockDb.revisoes_honorario.filter(r => r.cliente_id === '{CA}').length === 2"), 'mudar a aceita começa uma revisão nova')
        rs = db(f"window.__mockDb.revisoes_honorario.filter(r => r.cliente_id === '{CA}').map(r => [r.status, r.honorario_novo, r.respostas.obs_orcamento])")
        ok(['aceito', 640, 'conversar com o cliente amanhã'] in rs and ['estudo', None, 'rever no ano que vem'] in rs, f'a aceita fica como estava ({rs})')
        p.click('#prQuestionario [data-cart="sair"]'); p.wait_for_selector(linha(CA) + ' select[data-sit]', timeout=8000)
        lb = linha(CB)
        p.click(lb + ' [data-abrir]'); p.wait_for_selector('#prQuestionario .pr-cart-banner', timeout=5000)
        ok(chip('A12B') == 'Conta Azul' and val('A12B') == '900', 'na revisão de quem paga pelo Conta Azul, o de hoje vem de lá')
        p.fill('#prQuestionario [data-q="C1"]', '2')
        ok(espera(p, "() => document.getElementById('prSalvoMsg').textContent.includes('Gravada às')"), 'respondeu: gravou')
        p.click('#prQuestionario [data-cart="sair"]'); p.wait_for_selector(lb + ' select[data-sit]', timeout=8000)
        p.select_option(lb + ' select[data-sit]', 'aceito'); p.wait_for_selector('#ovAceite[style*="flex"]', timeout=3000)
        ok('não está na base de boletos (é pelo Conta Azul)' in txt('#acComo'), 'quem paga pelo Conta Azul: o aceite avisa que a troca é lá')
        p.click('#acCancelar'); p.wait_for_timeout(150)

        print('5. O aceito pra um mês ainda não gerado entra na geração da tela Boletos')
        lf = linha(CF)
        p.select_option(lf + ' select[data-sit]', 'aceito'); p.wait_for_selector('#ovAceite[style*="flex"]', timeout=3000)
        p.fill('#acValor', '480')
        p.click('#acConfirmar'); p.wait_for_function("() => document.getElementById('acMsg').textContent.startsWith('✓')", timeout=5000)
        rf = db("window.__mockDb.revisoes_honorario.find(r => r.id === 'rv-f')")
        ok(rf['status'] == 'aceito' and rf['vigencia'] == PROX and not rf['aplicado_em'] and db("window.__mockDb.cobrancas_mensais.find(b => b.id === 'bx4').valor") == 400
           and 'entra quando ' + MES_BR(PROX) + ' for gerado' in txt('#acMsg'), 'pro mês seguinte (não gerado): nada troca agora, e o aviso diz quando entra')
        p.click('#acCancelar')
        p.evaluate("localStorage.setItem('__semente_boletos', '1')")
        p.goto(base + 'financeiro-boletos.html'); p.wait_for_selector('#comp', timeout=6000); p.wait_for_timeout(500)
        p.fill('#comp', PROX); p.dispatch_event('#comp', 'change'); p.wait_for_timeout(500)
        p.click('#btnGerar'); p.wait_for_timeout(1500)
        novos = db(f"window.__mockDb.cobrancas_mensais.filter(b => b.competencia === '{PROX}').map(b => [b.cliente_id, b.valor])")
        nf = dict((c, v) for c, v in novos)
        rf = db("window.__mockDb.revisoes_honorario.find(r => r.id === 'rv-f')")
        ok(nf.get(CF) == 480 and nf.get(CA) == 640 and nf.get(CC) == 100, f'gerar o mês: o combinado entra no lugar do copiado; os outros copiam ({nf})')
        ok(rf['aplicado_em'] and db("window.__mockDb.cobrancas_config.find(c => c.id === 'cff').valor_base") == 480, 'a revisão fica aplicada e a base acompanha')
        ok('1 com o reajuste combinado na Carteira' in p.inner_text('body'), 'o recado da geração conta o reajuste')

        print('6. O MEI')
        p.evaluate("localStorage.removeItem('__semente_boletos')")
        p.goto(base + 'comercial-precificacao.html'); p.wait_for_selector('#prQuestionario .pr-q', timeout=8000)
        p.click('#segCarteira'); p.wait_for_selector(linha(CC), timeout=8000)
        p.click(linha(CC) + ' [data-abrir]'); p.wait_for_selector('#vMei #meiCartBanner:not([hidden])', timeout=5000)
        ok('FULANO DE TESTE 12345678901' in txt('#meiCartBanner') and p.input_value('#meiCliente') == 'FULANO DE TESTE 12345678901' and p.input_value('#meiCnpj') == '10.000.000/0003-53'
           and p.is_hidden('#meiOrc') and p.is_hidden('#meiSalvar') and 'grava sozinha' in txt('#meiSalvoMsg'), 'a revisão na aba MEI, com os dados do cadastro, sem o orçamento e sem o botão de salvar')
        p.click('#meiCards [data-base="mp1"]'); p.wait_for_timeout(200)
        ok('Hoje R$ 100 → plano R$ 120' in txt('#meiCartComp'), 'o plano comparado com o de hoje')
        ok(espera(p, "() => document.getElementById('meiSalvoMsg').textContent.includes('Gravada às')"), f'escolher o plano grava a revisão ({txt("#meiSalvoMsg")!r})')
        rm = db(f"window.__mockDb.revisoes_honorario.find(r => r.cliente_id === '{CC}')")
        ok(rm and rm['respostas']['_tipo'] == 'mei' and rm['honorario_sugerido'] == 120 and rm['honorario_atual'] == 100 and db('window.__mockDb.precificacoes.length') == 0,
           'gravou a revisão do MEI com o plano, fora das Propostas')
        p.click('#meiCartBanner [data-cart="sair"]'); p.wait_for_selector(linha(CC) + ' select[data-sit]', timeout=8000)
        lc = txt(linha(CC))
        ok('R$ 120' in lc and '+20%' in lc and 'plano MEI, revisado em' in lc, f'de volta à carteira: o MEI com o plano revisado ({lc!r})')

        print('7. "Nova" sai da revisão')
        p.click('#prSeg button[data-v="form"]'); p.click('#prLimpar'); p.wait_for_timeout(150)
        ok(p.is_visible('#prSalvar') and p.inner_text('#prSalvar') == 'Salvar proposta' and not p.query_selector('#prQuestionario .pr-cart-banner') and p.is_hidden('#prCartComp') and p.is_visible('#prOrc'),
           'o formulário volta a ser de proposta')

        print('8. O link direto e quem não é sócio')
        for email, socio in (('financeiro@macedoereis.com.br', True), ('fiscal@macedoereis.com.br', False)):
            q = b.new_page(viewport={'width': 1400, 'height': 950})
            q.on('pageerror', lambda e: erros.append(str(e)))
            q.add_init_script("window.__mockEmail = '%s'" % email); q.add_init_script(TOUR); q.add_init_script(SEMEAR)
            q.goto(base + 'comercial-precificacao.html?aba=carteira'); q.wait_for_selector('#prQuestionario .pr-q', state='attached', timeout=8000)
            if socio:
                q.wait_for_selector(linha(CA), timeout=8000)
                ok(q.is_visible('#vCarteira'), 'o sócio com ?aba=carteira cai direto na Carteira')
            else:
                q.wait_for_timeout(400)
                ok(q.is_hidden('#segCarteira') and q.is_hidden('#vCarteira') and not q.query_selector(linha(CA)), 'quem não é sócio não vê a aba, nem pelo ?aba=carteira')
            q.close()
        b.close()
    srv.shutdown()
    for e in erros: print('  ✗ erro de JavaScript:', e)
    print(f'\n{falhas + len(erros)} falha(s).' if falhas or erros else '\nTudo certo.')
    sys.exit(1 if falhas or erros else 0)

if __name__ == '__main__':
    main()
