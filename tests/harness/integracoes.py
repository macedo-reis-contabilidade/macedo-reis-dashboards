"""
As Integrações (19/11/2026, pedido do Samuel): o card do Painel, a página com as duas integrações e as duas telas
(Domínio e Receita), cada uma com a lista das empresas de hoje da carteira e o perfil da empresa.
Sem login e sem banco: o mock do conferir.py, com o que as pontes gravam semeado só neste teste (empresas, números,
mensagens e guias inventados) e o relógio parado numa quinta-feira (19/11/2026, 18h40 de Brasília).
As regras têm teste próprio (tests/integracoes.test.mjs); aqui, as telas.

    python tests/harness/integracoes.py            # o teste
    python tests/harness/integracoes.py --fotos    # e as fotos das telas em .harness/fotos/integracoes-*.png

Confere:
  1. o Domínio: o alto (a última leitura, as empresas do Domínio, as da carteira ligadas), o que a integração faz (os
     cinco blocos e onde aparece; recolher fica guardado), os números do alto, a lista só com a carteira de hoje, o mês
     que abre (o último fechado) e a linha de uma empresa;
  2. o mês, o filtro, a busca e a ordem pelos títulos;
  3. o perfil no Domínio: o endereço com ?empresa=, o mês a mês (a mesma peça da ficha), o faturamento ao lado do PGDAS,
     a contabilidade, a jornada e os avisos do vigia; o anterior e a próxima; o Voltar da tela e o do navegador;
  4. o link direto do perfil, e a empresa que não está na carteira de hoje;
  5. a Receita: o alto (a última consulta, as consultas do mês, as com procuração e de quem ela é — a do CNPJ do
     escritório ou a do CPF do Diego), o calendário das consultas com a próxima de cada uma, os números do alto e a
     linha de uma empresa; os filtros; a parcela de parcelamento não tira o mês do "DAS sem pagamento", e a guia de
     vários meses tira os meses dela;
  6. o perfil na Receita: a procuração (e de quem ela é), a situação fiscal com o PDF no Drive, o PGDAS mês a mês com as
     guias do DAS (a de vários meses com a parte de cada mês; a parcela de parcelamento só nas guias pagas), a Caixa
     Postal e as guias pagas (o filtro por ano e por tipo, as somas, a guia aberta com a parte de cada tributo); a
     empresa fora da consulta e a sem procuração;
  7. o que vem de fora entra como texto (nome, assunto, pendência, tributo e aviso com <img onerror> não viram imagem);
  8. a página Integrações (os dois cards com o que cada uma traz e como está) e o card do Painel (em dia; com as
     pontes paradas, quantas);
  9. o celular (nada passa da largura da tela) e os dois temas;
e nenhum erro de JavaScript. Termina com código 1 se alguma checagem falhar.
Pré-requisito: pip install playwright e python -m playwright install chromium
"""
import sys, pathlib, json, re
sys.dont_write_bytecode = True
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from conferir import montar_site, servir, SITE

AGORA = '2026-11-19T18:40:00'      # quinta-feira; o último mês fechado é 09/2026
FOTOS = SITE.parent / 'fotos'
XSS = '<img src=x onerror="window.__xss=1">'
TOUR = "(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return String(k).startsWith('mr_tour_') ? 'ok' : g.call(this, k); }; })()"

def meses(de, ate):
    out, (a, m) = [], map(int, de.split('-'))
    while f'{a:04d}-{m:02d}' <= ate:
        out.append(f'{a:04d}-{m:02d}')
        a, m = (a + 1, 1) if m == 12 else (a, m + 1)
    return out
MESES = meses('2025-10', '2026-11')

def mensal(codigo, cliente, base, ate_contador=None, extra=None):
    """As 14 linhas de uma empresa no Domínio: os números de base, crescendo um pouco, e o contador lançando até um mês."""
    linhas = []
    for i, c in enumerate(MESES):
        l = {'codigo': codigo, 'cliente_id': cliente, 'competencia': c, 'atualizado_em': '2026-11-19T10:12:00Z',
             'admissoes': 0, 'desligamentos': 0, 'afastados': 0, 'valor_saidas': None, 'valor_entradas': None, 'ultimo_lancamento': None}
        for k, v in base.items(): l[k] = v
        l['lanc_normais'] = 6 if ate_contador and c <= ate_contador else 0
        l['lanc_extrato'] = 0
        l['lanc_fiscal'] = (base.get('notas_saida') or 0) + (base.get('notas_entrada') or 0)
        l['lanc_folha'] = 4 if (base.get('funcionarios_ativos') or 0) > 0 else 0
        l['lanc_apuracao'] = 0; l['lanc_outros'] = 0
        l['lancamentos'] = l['lanc_normais'] + l['lanc_fiscal'] + l['lanc_folha']
        if l['lancamentos']: l['ultimo_lancamento'] = c + '-28'
        if (extra or {}).get(c): l.update(extra[c])
        linhas.append(l)
    return linhas

ALFA = {'funcionarios_ativos': 12, 'pro_labore': 2, 'notas_saida': 38, 'notas_entrada': 12, 'valor_saidas': 91000.0, 'valor_entradas': 40100.0,
        'receita_bruta': 84211.5, 'receita_simples': 84211.5, 'rbt12': 912000.0, 'meses_rbt12': 12, 'compras': 38500.0, 'servicos_tomados': 1200.0,
        'salarios': 21400.0, 'rescisoes': 0, 'decimo_terceiro': 0, 'pro_labore_valor': 3242.0, 'fgts': 1712.0, 'inss_empresa': 0, 'inss_rat': 0, 'inss_terceiros': 0}
DOMINIO_MENSAL = (
    mensal(101, 'k1', ALFA, '2026-09', {'2026-10': {'funcionarios_ativos': 13, 'admissoes': 1, 'notas_saida': 41, 'receita_bruta': 90500.0, 'receita_simples': 90500.0},
                                         '2026-11': {'funcionarios_ativos': 13, 'notas_saida': 9, 'receita_bruta': 20100.0, 'receita_simples': None}})
    + mensal(102, 'k2', {'funcionarios_ativos': 0, 'pro_labore': 1, 'notas_saida': 5, 'notas_entrada': 0, 'receita_bruta': 30000.0, 'receita_simples': None}, '2025-12')
    + mensal(103, 'k3', {'funcionarios_ativos': 4, 'pro_labore': 1, 'notas_saida': 20, 'notas_entrada': 31, 'receita_bruta': 52000.0, 'receita_simples': 61000.0}, '2026-06')
    + mensal(203, 'k3', {'funcionarios_ativos': 1, 'pro_labore': 0, 'notas_saida': 3, 'notas_entrada': 0, 'receita_bruta': 9000.0, 'receita_simples': None})
    + mensal(104, 'k4', {'funcionarios_ativos': 0, 'pro_labore': 0, 'notas_saida': 0, 'notas_entrada': 0, 'receita_bruta': 0.0, 'receita_simples': 0.0})
    + mensal(105, 'k5', {'funcionarios_ativos': 2, 'pro_labore': 1, 'notas_saida': 11, 'notas_entrada': 4, 'receita_bruta': 18000.0, 'receita_simples': 18000.0}, '2026-10')
    + mensal(106, 'k6', {'funcionarios_ativos': None, 'pro_labore': None, 'notas_saida': 0, 'notas_entrada': 0, 'receita_bruta': 0.0, 'receita_simples': None})
    + mensal(108, 'k8', {'funcionarios_ativos': 25, 'pro_labore': 3, 'notas_saida': 410, 'notas_entrada': 95, 'receita_bruta': 400000.0, 'receita_simples': None}, '2026-08')
    + mensal(109, 'k9', {'funcionarios_ativos': 3, 'pro_labore': 2, 'notas_saida': 60, 'notas_entrada': 22, 'receita_bruta': 41000.0, 'receita_simples': 41000.0}, '2026-03')
    + mensal(110, 'k10', {'funcionarios_ativos': 0, 'pro_labore': 1, 'notas_saida': 7, 'notas_entrada': 2, 'receita_bruta': 9500.0, 'receita_simples': 9500.0})
    + mensal(111, 'k11', {'funcionarios_ativos': 8, 'pro_labore': 2, 'notas_saida': 33, 'notas_entrada': 40, 'receita_bruta': 120000.0, 'receita_simples': 120000.0}, '2026-09')
    + mensal(112, 'k12', {'funcionarios_ativos': 5, 'pro_labore': 1, 'notas_saida': 90, 'notas_entrada': 6, 'receita_bruta': 76000.0, 'receita_simples': None}, '2026-05')
    + mensal(113, 'k13', {'funcionarios_ativos': 1, 'pro_labore': 0, 'notas_saida': 0, 'notas_entrada': 3, 'receita_bruta': 0.0, 'receita_simples': None}, '2026-01')
    + mensal(115, 'k15', {'funcionarios_ativos': 0, 'pro_labore': 1, 'notas_saida': 2, 'notas_entrada': 1, 'receita_bruta': 4000.0, 'receita_simples': 4000.0}))

def aviso(i, regra, cliente, titulo, grav='media', resp='Thalia', situacao='aberto'):
    return {'id': 'vg-' + str(i), 'chave': regra + ':' + cliente, 'regra': regra, 'titulo': titulo, 'detalhe': 'Detalhe inventado do aviso ' + str(i) + '.', 'setor': 'fiscal', 'responsavel': resp,
            'gravidade': grav, 'so_socios': False, 'cliente_id': cliente, 'ref_tabela': None, 'ref_id': None, 'link': 'clientes/editar.html?id=' + cliente, 'prazo': None, 'situacao': situacao}

def guia(cliente, n, tipo, pa, pago, **extra):
    g = {'cliente_id': cliente, 'numero_documento': n, 'tipo_codigo': {'DAS': '9', 'DARF': '4', 'DAE': '10'}[tipo], 'tipo': tipo, 'periodo_apuracao': pa, 'arrecadado_em': pago, 'vencimento': pago,
         'receita_codigo': '3333' if tipo == 'DAS' else '1410', 'receita': None, 'referencia': None, 'valor_total': 100.0, 'valor_principal': 100.0, 'valor_multa': 0, 'valor_juros': 0, 'saldo_total': 0, 'partes': []}
    g.update(extra); return g
SIMPLES = [{'receita_codigo': '1001', 'receita': 'IRPJ - Simples Nacional', 'periodo_apuracao': '2026-09-01', 'principal': 300.0, 'multa': 10.1, 'juros': 2.5, 'valor_total': 312.6},
           {'receita_codigo': '1002', 'receita': 'CSLL - Simples Nacional', 'periodo_apuracao': '2026-09-01', 'principal': 200.0, 'multa': 6.7, 'juros': 1.7, 'valor_total': 208.4},
           {'receita_codigo': '1006', 'receita': 'INSS - Simples Nacional', 'periodo_apuracao': '2026-09-01', 'principal': 700.0, 'multa': 23.6, 'juros': 5.8, 'valor_total': 729.4}]

def partes_de(mes, itens=SIMPLES):
    return [dict(x, periodo_apuracao=mes + '-01') for x in itens]

DADOS = {
    'dominio_empresas': [{'codigo': 101, 'cliente_id': 'k1', 'ativa': True}, {'codigo': 102, 'cliente_id': 'k2', 'ativa': True}, {'codigo': 103, 'cliente_id': 'k3', 'ativa': True},
                         {'codigo': 203, 'cliente_id': 'k3', 'ativa': False}, {'codigo': 104, 'cliente_id': 'k4', 'ativa': True}, {'codigo': 105, 'cliente_id': 'k5', 'ativa': True},
                         {'codigo': 106, 'cliente_id': 'k6', 'ativa': False}, {'codigo': 108, 'cliente_id': 'k8', 'ativa': True}, {'codigo': 109, 'cliente_id': 'k9', 'ativa': True},
                         {'codigo': 110, 'cliente_id': 'k10', 'ativa': True}, {'codigo': 111, 'cliente_id': 'k11', 'ativa': True}, {'codigo': 112, 'cliente_id': 'k12', 'ativa': True},
                         {'codigo': 113, 'cliente_id': 'k13', 'ativa': True}, {'codigo': 115, 'cliente_id': 'k15', 'ativa': True}, {'codigo': 114, 'cliente_id': 'k14', 'ativa': True}],
    'dominio_mensal': DOMINIO_MENSAL,
    'dominio_rodadas': [{'id': 'rd-1', 'inicio': '2026-11-19T10:00:05Z', 'fim': '2026-11-19T10:12:30Z', 'dados_ate': '2026-11-19', 'ponte': '0.5.0', 'empresas': 474, 'ligadas': 235, 'linhas': 3402, 'faltou': [], 'recebida_em': '2026-11-19T10:12:39Z'},
                        {'id': 'rd-0', 'inicio': '2026-11-18T10:00:05Z', 'fim': '2026-11-18T10:11:30Z', 'dados_ate': '2026-11-18', 'ponte': '0.5.0', 'empresas': 473, 'ligadas': 234, 'linhas': 3390, 'faltou': [], 'recebida_em': '2026-11-18T10:11:40Z'}],
    'dominio_andamento': [{'codigo': 101, 'cliente_id': 'k1', 'banco_contas': 2, 'banco_ate': '2026-08-31', 'banco_ultimo': '2026-09-30', 'banco_ultimo_geral': '2026-09-30', 'caixa_ate': '2026-10-31',
                           'caixa_contador_ate': '2026-09-30', 'extrato_contas': 1, 'extrato_ate': '2026-09-30', 'extrato_pendentes': 4, 'conciliadas': 1, 'conciliado_ate': '2026-08-31', 'fechamento_em': '2025-12-31', 'dados_ate': '2026-11-19'}],
    'dominio_encerramento': [{'codigo': 101, 'cliente_id': 'k1', 'ano': 2025, 'zerado_em': '2025-12-31', 'zeramentos': 1, 'zerado_incluido_em': '2026-03-10', 'lancados_depois': 2, 'lancamentos_do_ano': 1800},
                             {'codigo': 101, 'cliente_id': 'k1', 'ano': 2024, 'zerado_em': None, 'zeramentos': 0, 'zerado_incluido_em': None, 'lancados_depois': 0, 'lancamentos_do_ano': 950}],
    'dominio_jornadas': [{'cliente_id': 'k1', 'jornada': 'COMERCIAL 44H ' + XSS, 'tipo': 1, 'tipo_escala': None, 'semana': 'TTTTTT-', 'min_semana': 2640, 'min_maior_dia': 480, 'ciclo_dias': None, 'ciclo_trabalho': None,
                          'horas_semana': 44, 'empregados': 9, 'afastados': 1, 'dados_ate': '2026-11-19'},
                         {'cliente_id': 'k1', 'jornada': 'ADMINISTRATIVO', 'tipo': 1, 'tipo_escala': None, 'semana': 'TTTTTF-', 'min_semana': 2400, 'min_maior_dia': 480, 'ciclo_dias': None, 'ciclo_trabalho': None,
                          'horas_semana': 40, 'empregados': 3, 'afastados': 0, 'dados_ate': '2026-11-19'}],
    'contabil_empresas': [{'cliente_id': 'k1', 'faz': True}],
    'receita_rodadas': [{'id': 'rr-2', 'inicio': '2026-11-19T11:30:00Z', 'fim': '2026-11-19T11:35:40Z', 'ponte': '0.4.3', 'ambiente': 'producao', 'chamadas_mes': 1097, 'empresas': 84, 'sem_cadastro': 0, 'recebida_em': '2026-11-19T11:36:02Z'},
                        {'id': 'rr-1', 'inicio': '2026-11-18T11:30:00Z', 'fim': '2026-11-18T11:33:00Z', 'ponte': '0.4.1', 'ambiente': 'producao', 'chamadas_mes': 1012, 'empresas': 84, 'sem_cadastro': 0, 'recebida_em': '2026-11-18T11:33:20Z'}],
    'receita_empresas': [
        {'cliente_id': 'k1', 'autorizacao': 'ativa', 'autorizacao_ate': '2027-03-31', 'autorizacao_via': 'procurador', 'autorizacao_em': '2026-11-02T11:31:00Z', 'pgdas_em': '2026-11-03T11:32:00Z', 'situacao_fiscal_em': '2026-11-05',
         'situacao_fiscal_pdf_em': '2026-11-05', 'situacao_fiscal_pdf_url': 'https://drive.google.com/file/d/ARQteste00001/view',
         'pendencias': [{'orgao': 'Receita', 'titulo': 'Pendência - Débito (SIEF) ' + XSS}, {'orgao': 'PGFN', 'titulo': 'Inscrição em Dívida Ativa'}],
         'pagamentos_desde': '2025-01-01', 'pagamentos_ate': '2026-11-18', 'pagamentos_em': '2026-11-19T14:25:00Z'},
        {'cliente_id': 'k2', 'autorizacao': 'sem', 'autorizacao_ate': None, 'autorizacao_em': '2026-11-16T11:31:00Z', 'pendencias': None, 'situacao_fiscal_em': None, 'pagamentos_ate': None},
        {'cliente_id': 'k3', 'autorizacao': 'ativa', 'autorizacao_ate': '2026-12-01', 'autorizacao_via': 'escritorio', 'autorizacao_em': '2026-11-02T11:31:00Z', 'pgdas_em': '2026-11-03T11:32:00Z', 'pendencias': [], 'situacao_fiscal_em': '2026-11-05',
         'pagamentos_desde': '2025-01-01', 'pagamentos_ate': '2026-11-18'},
        {'cliente_id': 'k4', 'autorizacao': 'ativa', 'autorizacao_ate': '2028-01-15', 'autorizacao_via': 'procurador', 'pendencias': [], 'situacao_fiscal_em': '2026-11-05', 'pagamentos_desde': '2025-01-01', 'pagamentos_ate': '2026-11-18'},
        {'cliente_id': 'k5', 'autorizacao': 'ativa', 'autorizacao_ate': '2026-11-10', 'autorizacao_via': 'procurador', 'autorizacao_em': '2026-11-02T11:31:00Z', 'pgdas_em': '2026-11-03T11:32:00Z', 'pendencias': [],
         'situacao_fiscal_em': '2026-11-05', 'pagamentos_desde': '2025-01-01', 'pagamentos_ate': '2026-11-18'},
        {'cliente_id': 'k6', 'autorizacao': 'sem', 'autorizacao_ate': None, 'pendencias': None, 'situacao_fiscal_em': None, 'pagamentos_ate': None},
        {'cliente_id': 'k8', 'autorizacao': 'ativa', 'autorizacao_ate': '2027-08-20', 'autorizacao_via': 'escritorio', 'pendencias': [{'orgao': 'Receita', 'titulo': 'Omissão de DCTFWeb'}], 'situacao_fiscal_em': '2026-11-05',
         'pagamentos_desde': '2025-01-01', 'pagamentos_ate': '2026-11-18'},
        {'cliente_id': 'k9', 'autorizacao': 'ativa', 'autorizacao_ate': '2027-05-02', 'autorizacao_via': 'procurador', 'pendencias': [], 'situacao_fiscal_em': '2026-11-05', 'pagamentos_desde': '2025-01-01', 'pagamentos_ate': '2026-11-18'},
        {'cliente_id': 'k10', 'autorizacao': 'ativa', 'autorizacao_ate': None, 'autorizacao_via': None, 'pendencias': None, 'situacao_fiscal_em': None, 'pagamentos_ate': None},
        {'cliente_id': 'k11', 'autorizacao': 'ativa', 'autorizacao_ate': '2027-09-09', 'autorizacao_via': 'procurador', 'pendencias': [], 'situacao_fiscal_em': '2026-11-05', 'pagamentos_desde': '2025-01-01', 'pagamentos_ate': '2026-11-18'},
        {'cliente_id': 'k12', 'autorizacao': 'ativa', 'autorizacao_ate': '2027-02-11', 'autorizacao_via': 'escritorio', 'pendencias': [], 'situacao_fiscal_em': '2026-11-05', 'pagamentos_desde': '2025-01-01', 'pagamentos_ate': '2026-11-18'},
        {'cliente_id': 'k15', 'autorizacao': 'ativa', 'autorizacao_ate': '2027-06-30', 'autorizacao_via': 'procurador', 'pendencias': [], 'situacao_fiscal_em': '2026-11-05', 'pagamentos_desde': '2025-01-01', 'pagamentos_ate': '2026-11-18'}],
    'receita_pgdas': [
        {'cliente_id': 'k1', 'competencia': '2026-06', 'transmitida_em': '2026-07-15T13:00:00Z', 'das_pago': False, 'receita_mes': None, 'receita_12_meses': None},
        {'cliente_id': 'k1', 'competencia': '2026-08', 'transmitida_em': '2026-09-15T13:00:00Z', 'das_pago': True, 'receita_mes': None, 'receita_12_meses': None},
        {'cliente_id': 'k1', 'competencia': '2026-09', 'transmitida_em': '2026-10-18T13:02:00Z', 'das_pago': False, 'receita_mes': 84211.5, 'receita_12_meses': 912000.0},
        {'cliente_id': 'k3', 'competencia': '2026-09', 'transmitida_em': '2026-10-19T13:02:00Z', 'das_pago': True, 'receita_mes': 60500.0, 'receita_12_meses': 700000.0},
        {'cliente_id': 'k5', 'competencia': '2026-07', 'transmitida_em': '2026-08-17T13:02:00Z', 'das_pago': False, 'receita_mes': None, 'receita_12_meses': None},
        {'cliente_id': 'k5', 'competencia': '2026-08', 'transmitida_em': '2026-09-16T13:02:00Z', 'das_pago': False, 'receita_mes': None, 'receita_12_meses': None},
        {'cliente_id': 'k5', 'competencia': '2026-09', 'transmitida_em': '2026-10-19T13:02:00Z', 'das_pago': False, 'receita_mes': 18000.0, 'receita_12_meses': 210000.0}],
    'receita_mensagens': [
        {'cliente_id': 'k1', 'id_receita': 'm1', 'assunto': 'Termo de Exclusão do Simples Nacional', 'enviada_em': '2026-10-20', 'origem': 'Estado', 'lida': False, 'recebida_em': '2026-10-21T12:00:00Z'},
        {'cliente_id': 'k1', 'id_receita': 'm2', 'assunto': 'Assunto de fora ' + XSS, 'enviada_em': '2026-11-10', 'origem': 'Receita', 'lida': False, 'recebida_em': '2026-11-11T12:00:00Z'},
        {'cliente_id': 'k1', 'id_receita': 'm3', 'assunto': 'Declaração recepcionada', 'enviada_em': '2026-10-19', 'origem': 'Receita', 'lida': True, 'recebida_em': '2026-10-20T12:00:00Z'},
        {'cliente_id': 'k1', 'id_receita': 'm4', 'assunto': 'Antiga e não lida', 'enviada_em': '2026-06-01', 'origem': 'Receita', 'lida': False, 'recebida_em': '2026-06-02T12:00:00Z'},
        {'cliente_id': 'k3', 'id_receita': 'm5', 'assunto': 'Parcelamento concedido', 'enviada_em': '2026-11-01', 'origem': 'Receita', 'lida': True, 'recebida_em': '2026-11-02T12:00:00Z'}],
    'receita_pagamentos': [
        guia('k1', '07202600000001', 'DAS', '2026-08-01', '2026-09-21', valor_total=1180.0, valor_principal=1180.0, partes=partes_de('2026-08', SIMPLES[:2])),
        guia('k1', '07202600000002', 'DAS', '2026-09-01', '2026-11-12', vencimento='2026-10-20', valor_total=1250.4, valor_principal=1200.0, valor_multa=40.4, valor_juros=10.0, partes=SIMPLES),
        guia('k1', '07202600000003', 'DAS', '2026-07-31', '2026-08-25', referencia='1234567', receita_codigo='1734', valor_total=310.0, valor_principal=310.0,
             partes=[{'receita_codigo': '1469', 'receita': 'R D Ativa - IRPJ - Simples Nacional', 'principal': 310.0, 'multa': 0, 'juros': 0, 'valor_total': 310.0}]),
        guia('k1', '07202600000004', 'DARF', '2026-09-30', '2026-10-20', valor_total=800.0, valor_principal=800.0, saldo_total=800.0,
             partes=[{'receita_codigo': '1082-1', 'receita': 'Contribuição previdenciária descontada de segurados', 'principal': 500.0, 'multa': 0, 'juros': 0, 'valor_total': 500.0},
                     {'receita_codigo': '561-7', 'receita': 'IRRF - Rendimento do Trabalho Assalariado ' + XSS, 'principal': 300.0, 'multa': 0, 'juros': 0, 'valor_total': 300.0}]),
        guia('k1', '07202500000005', 'DARF', '2025-10-31', '2025-11-10', valor_total=640.0, valor_principal=640.0),
        guia('k1', '07202600000006', 'DAE', '2026-09-30', '2026-10-07', valor_total=95.5, valor_principal=95.5),
        guia('k3', '07202600000007', 'DAS', '2026-09-01', '2026-10-20', valor_total=2100.0, valor_principal=2100.0),
        guia('k14', '07202600000008', 'DAS', '2026-02-01', '2026-03-20'),
        # a parcela de um parcelamento (como a Receita manda): o período no último dia do mês, o vencimento dentro dele e,
        # nas partes, os meses antigos — não é o DAS de setembro, que segue sem pagar
        guia('k5', '07202600000021', 'DAS', '2026-09-30', '2026-09-25', vencimento='2026-09-30', valor_total=583.66, valor_principal=437.58, valor_multa=87.51, valor_juros=58.57,
             partes=[{'receita_codigo': '1001', 'receita': 'IRPJ - Simples Nacional', 'periodo_apuracao': '2024-03-01', 'principal': 200.0, 'multa': 40.0, 'juros': 30.0, 'valor_total': 270.0},
                     {'receita_codigo': '1006', 'receita': 'INSS - Simples Nacional', 'periodo_apuracao': '2024-04-01', 'principal': 237.58, 'multa': 47.51, 'juros': 28.57, 'valor_total': 313.66}]),
        # uma guia só pagando julho e agosto, depois da consulta do PGDAS: cada parte diz o mês dela
        guia('k5', '07202600000022', 'DAS', '2026-08-01', '2026-10-30', vencimento='2026-09-21', valor_total=640.3, valor_principal=600.0, valor_multa=30.2, valor_juros=10.1,
             partes=[{'receita_codigo': '1001', 'receita': 'IRPJ - Simples Nacional', 'periodo_apuracao': '2026-07-01', 'principal': 300.0, 'multa': 15.1, 'juros': 5.0, 'valor_total': 320.1},
                     {'receita_codigo': '1001', 'receita': 'IRPJ - Simples Nacional', 'periodo_apuracao': '2026-08-01', 'principal': 300.0, 'multa': 15.1, 'juros': 5.1, 'valor_total': 320.2}])],
    'vigia_achados': [
        aviso(1, 'dominio_pgdas_diferente', 'k1', 'Faturamento do Domínio diferente do PGDAS em 08/2026', grav='alta'),
        aviso(2, 'receita_pendencia', 'k1', 'Receita: débito e dívida ativa ' + XSS),
        aviso(3, 'dominio_notas_paradas', 'k4', 'Notas de saída paradas desde 09/2026'),
        aviso(4, 'receita_das_nao_pago', 'k5', 'DAS sem pagar: 1 mês (09/26)', grav='alta'),
        aviso(5, 'dominio_contabil_parada', 'k9', 'Contabilidade parada', situacao='resolvido'),
        aviso(6, 'alvara_vencido', 'k1', 'Alvará vencido', resp='Adaini')],
}
# a empresa com o nome que parece HTML (o cadastro vem de fora: a leitura de documentos, o formulário da proposta)
EXTRA_CARTEIRA = {'cliente_id': 'k15', 'entrada': '2026-06-01', 'saida': None, 'clientes': {'id': 'k15', 'nome_principal': XSS + ' NOME DE FORA LTDA', 'nome_fantasia': None,
                  'regime_tributario': 'Simples Nacional', 'cidade': 'Gramado', 'uf': 'RS', 'status': 'ativo', 'documento': '10000000000115', 'tipo_pessoa': 'PJ'}}
SEMEAR = """
(() => {
  const EXTRA = %s, CARTEIRA = %s;
  let db;
  Object.defineProperty(window, '__mockDb', { configurable: true, get() { return db; }, set(v) {
    db = v;
    Object.keys(EXTRA).forEach(k => { v[k] = EXTRA[k].map(x => ({ ...x })); });
    v.carteira_info = (v.carteira_info || []).concat([CARTEIRA]);
    v.carteira_info.forEach(k => { if (k.clientes && !k.clientes.tipo_pessoa) k.clientes.tipo_pessoa = 'PJ'; });
  } });
})();
""" % (json.dumps(DADOS, ensure_ascii=False), json.dumps(EXTRA_CARTEIRA, ensure_ascii=False))

falhas = 0
def ok(cond, msg):
    global falhas
    print(('  ✓ ' if cond else '  ✗ ') + msg)
    if not cond: falhas += 1

LISTA = """() => [...document.querySelectorAll('#igCorpo tr[data-id]')].map(tr => ({ id: tr.dataset.id, nome: tr.querySelector('.ig-nome').textContent,
  celulas: [...tr.children].map(td => td.innerText.replace(/\\s+/g, ' ').trim()) }))"""
FOCOS = "() => Object.fromEntries([...document.querySelectorAll('#igFocos .ig-foco')].map(b => [b.dataset.foco, [b.querySelector('.ig-foco-num').textContent, b.querySelector('.ig-foco-lbl').textContent, b.getAttribute('aria-pressed')]]))"
SOBRA = "() => document.documentElement.scrollWidth - document.documentElement.clientWidth"

def main(fotos=False):
    from playwright.sync_api import sync_playwright
    montar_site()
    srv, porta = servir(); base = f'http://127.0.0.1:{porta}/'
    erros = []
    if fotos: FOTOS.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        def contexto(largura=1440, altura=1000, relogio=AGORA, tema=None, semear=SEMEAR):
            cx = b.new_context(viewport={'width': largura, 'height': altura}, timezone_id='America/Sao_Paulo')
            p = cx.new_page()
            p.clock.set_fixed_time(relogio)
            p.on('pageerror', lambda e: erros.append(str(e)))
            p.add_init_script(TOUR); p.add_init_script(semear)
            if tema: p.add_init_script("try { localStorage.setItem('mr_tema', '%s'); } catch (e) {}" % tema)
            return p
        def foto(p, nome):
            if fotos:
                p.evaluate('() => window.scrollTo(0, 0)'); p.wait_for_timeout(350); p.screenshot(path=str(FOTOS / ('integracoes-' + nome + '.png')), full_page=True)
        def lista_pronta(p):
            p.wait_for_selector('#igCorpo tr[data-id]', timeout=10000)
            p.wait_for_function("() => !document.querySelector('#igHoje [data-estado=\"lendo\"]')", timeout=10000)

        # ------------------------------------------------------------------ o Domínio
        print('1. O Domínio: o alto, o que a integração faz e a lista')
        p = contexto()
        p.goto(base + 'integracao-dominio.html'); lista_pronta(p)
        hoje = p.inner_text('#igHoje')
        ok('Lida hoje às 07h12' in hoje and 'Dados até 19/11' in hoje, f'a última leitura, pela hora de Brasília ({hoje.splitlines()[0]})')
        ok('474 empresas no Domínio' in hoje and '235 ligadas ao cadastro' in hoje, 'quantas empresas o Domínio tem e quantas estão ligadas ao cadastro')
        ok('13 de 14 da carteira ligadas' in hoje and '1 empresa da carteira sem ligação' in hoje, 'quantas da carteira estão ligadas')
        ok(p.get_attribute('#igHoje .ig-tile', 'data-estado') == 'ok', 'a ponte em dia')
        sobre = p.inner_text('#igSobre')
        ok(p.locator('#igSobre .ig-cartao').count() == 5 and all(x in sobre for x in ['Folha', 'Notas e faturamento', 'Impostos das notas', 'Contabilidade', 'Jornada']), 'o que lê: os cinco blocos')
        ok('todo dia às 7h' in sobre and 'últimos 14 meses' in sobre and 'nenhum dado de funcionário sai do Domínio' in sobre, 'quando roda e o que não sai do Domínio')
        chips = p.evaluate("() => [...document.querySelectorAll('#igSobre .ig-chip')].map(c => [c.textContent, c.getAttribute('href')])")
        ok(['Controle das contabilidades', 'contabil-controle.html'] in chips and ['Escala 6x1', 'dp-jornada.html'] in chips and ['Assistente', None] in chips, f'onde aparece no sistema, com o link de cada tela ({len(chips)})')
        linhas = p.evaluate(LISTA)
        ok(len(linhas) == 14 and not any(l['id'] == 'k14' for l in linhas), f'só a carteira de hoje: 14 empresas, sem a que saiu em março ({len(linhas)})')
        ok([l['nome'] for l in linhas][:3] == [XSS + ' NOME DE FORA LTDA', '12.345.678 BELTRANA DE TESTE', 'ALFA COMÉRCIO DE TESTE LTDA'] or linhas[0]['nome'].startswith('<img'), f'pelo nome ({[l["nome"][:18] for l in linhas][:3]})')
        ok(p.input_value('#igMes') == '2026-09', f'abre no último mês fechado ({p.input_value("#igMes")})')
        opcoes = p.evaluate("() => [...document.querySelectorAll('#igMes option')].map(o => o.textContent)")
        ok(opcoes[:3] == ['11/2026 · em fechamento', '10/2026 · em fechamento', '09/2026'] and len(opcoes) == 14, f'os 14 meses, com o de hoje e o passado em fechamento ({opcoes[:3]})')
        alfa = next(l for l in linhas if l['id'] == 'k1')
        ok(alfa['celulas'][1:] == ['12', 'R$ 84.211,50', '38 · 12', '09/2026'], f'a linha da empresa: funcionários, faturamento, notas e até onde o contador lançou ({alfa["celulas"][1:]})')
        ok('Simples Nacional · cód. 101' in alfa['celulas'][0] and '1 aviso do vigia' in alfa['celulas'][0], f'o regime, o código do Domínio e o aviso do vigia da integração ({alfa["celulas"][0]})')
        gama = next(l for l in linhas if l['id'] == 'k3')
        ok('cód. 103 e 203' in gama['celulas'][0] and gama['celulas'][1] == '4' and 'no Simples: R$ 61.000,00' in gama['celulas'][2], f'dois códigos: o maior de cada número, e a apuração do Simples quando é outra ({gama["celulas"][:3]})')
        mei = next(l for l in linhas if l['id'] == 'k6'); solta = next(l for l in linhas if l['id'] == 'k7')
        ok('(inativa no Domínio)' in mei['celulas'][0] and mei['celulas'][1] == '—', 'a inativa no Domínio, com o traço no que o Domínio não disse')
        ok('sem ligação com o Domínio' in solta['celulas'][0] and solta['celulas'][1:] == ['—', '—', '—', '—'], 'a sem ligação: tudo com o traço')
        focos = p.evaluate(FOCOS)
        ok({k: v[0] for k, v in focos.items()} == {'todas': '14', 'funcionarios': '8', 'sem_movimento': '1', 'avisos': '2', 'sem_ligacao': '2'}, f'os números do alto ({ {k: v[0] for k, v in focos.items()} })')
        ok(focos['sem_movimento'][1] == 'Sem movimento em 09/2026' and focos['todas'][2] == 'true', 'o foco do mês diz o mês, e "Todas" vem marcado')
        ok(p.inner_text('#igConta') == '14 empresas da carteira', 'a contagem da lista')
        foto(p, 'dominio-lista')

        print('2. O mês, o filtro, a busca e a ordem')
        p.select_option('#igMes', '2026-10')
        alfa = next(l for l in p.evaluate(LISTA) if l['id'] == 'k1')
        ok(alfa['celulas'][1:] == ['13', 'R$ 90.500,00', '41 · 12', '09/2026'], f'outro mês, outros números; o contador segue o mesmo ({alfa["celulas"][1:]})')
        ok(p.evaluate(FOCOS)['sem_movimento'][1] == 'Sem movimento em 10/2026', 'e o foco acompanha o mês')
        p.select_option('#igMes', '2026-09')
        p.click('#igFocos [data-foco="funcionarios"]')
        linhas = p.evaluate(LISTA)
        ok(len(linhas) == 8 and all(int(l['celulas'][1]) > 0 for l in linhas) and p.inner_text('#igConta') == '8 de 14 empresas', f'o filtro "Com funcionários" ({len(linhas)})')
        p.click('#igCab [data-ordem="funcionarios"]')
        linhas = p.evaluate(LISTA)
        ok([l['celulas'][1] for l in linhas] == ['25', '12', '8', '5', '4', '3', '2', '1'] and p.get_attribute('#igCab th[data-col="funcionarios"]', 'aria-sort') == 'descending', f'ordem pelos funcionários, do maior pro menor ({[l["celulas"][1] for l in linhas]})')
        p.click('#igCab [data-ordem="funcionarios"]')
        ok([l['celulas'][1] for l in p.evaluate(LISTA)][0] == '1' and p.get_attribute('#igCab th[data-col="funcionarios"]', 'aria-sort') == 'ascending' and p.get_attribute('#igCab th[data-col="nome"]', 'aria-sort') == 'none', 'o segundo clique inverte')
        p.click('#igFocos [data-foco="todas"]'); p.click('#igCab [data-ordem="contador"]')
        linhas = p.evaluate(LISTA)
        ok([l['celulas'][4] for l in linhas][:3] == ['12/2025', '01/2026', '03/2026'] and linhas[-1]['celulas'][4] == '—', f'pelo contador: quem está mais atrás primeiro, e os sem lançamento no fim ({[l["celulas"][4] for l in linhas][:4]})')
        p.fill('#igBusca', '108')
        ok([l['id'] for l in p.evaluate(LISTA)] == ['k8'], 'a busca pelo código do Domínio')
        p.fill('#igBusca', 'padaria')
        ok([l['id'] for l in p.evaluate(LISTA)] == ['k9'], 'e pelo nome')
        p.fill('#igBusca', 'não existe')
        ok(p.is_hidden('#igTabWrap') and p.inner_text('#igVazio') == 'Nenhuma empresa com "não existe" neste filtro.', 'sem resultado, a tela diz')
        p.fill('#igBusca', ''); p.click('#igCab [data-ordem="nome"]')
        p.click('#igSobre > summary'); p.wait_for_function("() => localStorage.getItem('mr_integ_sobre') === '0'", timeout=4000)
        p.reload(); lista_pronta(p)
        ok(not p.evaluate("() => document.getElementById('igSobre').open"), 'o "O que esta integração faz" recolhido fica recolhido ao voltar')
        p.click('#igSobre > summary')

        print('3. O perfil no Domínio')
        p.click('#igFocos [data-foco="funcionarios"]')
        p.click('#igCorpo tr[data-id="k1"] td:nth-child(3)')
        p.wait_for_selector('#igPerfil .ig-sec', timeout=10000)
        ok('empresa=k1' in p.url and p.is_hidden('#igGeral'), f'clicar na linha abre o perfil, com a empresa no endereço ({p.url.split("/")[-1]})')
        t = p.inner_text('#igPerfil')
        ok('ALFA COMÉRCIO DE TESTE LTDA' in t and 'Simples Nacional · 10.000.000/0001-01 · Três Coroas/RS' in t, 'o nome, o regime, o CNPJ e a cidade')
        ok('1 de 8' in t and p.is_disabled('#igAnt') and not p.is_disabled('#igProx'), 'a posição na lista filtrada, com o anterior e a próxima')
        ok(p.locator('#igPerfil table.dm-qtd tbody tr').count() == 6 and p.locator('#igPerfil table.dm-valor tbody tr').count() == 6 and 'Empresa no Domínio: código 101' in t, 'o mês a mês dos 6 meses, a mesma peça da ficha da empresa')
        ok('RBT12 de' in t and 'R$ 912.000,00' in t and 'em fechamento' in t, 'em reais, com o RBT12 e os meses em fechamento')
        conf = p.evaluate("() => { const s = [...document.querySelectorAll('#igPerfil .ig-sec')].find(x => x.querySelector('h3').textContent.startsWith('Faturamento')); return s ? s.innerText.replace(/\\s+/g, ' ') : null; }")
        ok(conf and '09/2026 R$ 84.211,50 apuração do Simples R$ 84.211,50 igual' in conf, f'o faturamento do Domínio ao lado do declarado no PGDAS ({(conf or "")[:120]})')
        ok('Banco: 2 contas com movimento nos últimos 12 meses, lançadas até 31/08/2026 (a mais atrasada) e 30/09/2026 (a mais adiantada).' in t and '2025: zerado em 31/12/2025' in t and '4 linhas ainda sem lançamento' in t,
           'a contabilidade no Domínio: o banco, o extrato e o zeramento')
        ok('6 digitados' in t and p.locator('#igPerfil a[href="contabil-controle.html?empresa=k1"]').count() == 1, 'os lançamentos por origem e o link do Controle das contabilidades')
        jor = p.evaluate("() => { const s = [...document.querySelectorAll('#igPerfil .ig-sec')].find(x => x.querySelector('h3').textContent.startsWith('Jornada')); return s ? s.innerText.replace(/\\s+/g, ' ') : null; }")
        ok(jor and '6x1 44h 9 1 afastado' in jor and '40h 3' in jor and p.locator('#igPerfil a[href="dp-jornada.html?empresa=k1"]').count() == 1, f'a jornada por grupo, com o link da Escala 6x1 ({(jor or "")[:140]})')
        av = p.inner_text('#igPerfil .ig-sec-avisos')
        ok('Faturamento do Domínio diferente do PGDAS em 08/2026' in av and 'Urgente · com Thalia' in av and 'Alvará' not in av and 'Receita: débito' not in av, 'os avisos do vigia desta integração (não os da Receita nem os de outro assunto)')
        ok(p.get_attribute('#igPerfil .ig-perfil-links a >> nth=0', 'href') == 'clientes/editar.html?id=k1' and p.get_attribute('#igPerfil .ig-perfil-links a >> nth=1', 'href') == 'integracao-receita.html?empresa=k1', 'os links da ficha da empresa e da mesma empresa na Receita')
        foto(p, 'dominio-perfil')
        p.click('#igProx'); p.wait_for_function("() => document.querySelector('#igPerfil h2') && document.querySelector('#igPerfil h2').textContent.startsWith('CAPA')", timeout=8000)
        ok('empresa=k12' in p.url and '2 de 8' in p.inner_text('#igPerfil .ig-nav'), 'a próxima: a seguinte da lista filtrada')
        ok('Sem a jornada' not in p.inner_text('#igPerfil') and p.locator('#igPerfil .ig-sec-avisos').count() == 0 and not any('Jornada' in h for h in p.locator('#igPerfil .ig-sec h3').all_inner_texts()), 'a empresa sem aviso e sem jornada: sem as duas seções')
        p.click('#igVoltar'); p.wait_for_selector('#igGeral:not([hidden])')
        ok('empresa=' not in p.url and len(p.evaluate(LISTA)) == 8 and p.evaluate(FOCOS)['funcionarios'][2] == 'true', 'o Voltar devolve a lista, com o filtro como estava')
        p.click('#igCorpo tr[data-id="k8"] .ig-nome'); p.wait_for_selector('#igPerfil .ig-sec')
        p.go_back(); p.wait_for_selector('#igGeral:not([hidden])')
        ok('empresa=' not in p.url and p.is_hidden('#igPerfil'), 'o Voltar do navegador também')
        p.go_forward(); p.wait_for_selector('#igPerfil .ig-sec')
        ok('empresa=k8' in p.url and p.inner_text('#igPerfil h2').startswith('ZETA'), 'e o Avançar reabre o perfil')

        print('4. O link direto do perfil')
        p.goto(base + 'integracao-dominio.html?empresa=k7'); p.wait_for_selector('#igPerfil .ig-sec')
        ok('Sem ligação com o Domínio' in p.inner_text('#igPerfil') and p.locator('#igPerfil table').count() == 0, 'a empresa sem ligação: o porquê e o que conferir')
        p.click('#igVoltar'); p.wait_for_selector('#igGeral:not([hidden])')
        ok('empresa=' not in p.url and len(p.evaluate(LISTA)) == 14, 'aberta pelo link, o Voltar mostra a lista inteira')
        p.goto(base + 'integracao-dominio.html?empresa=k14'); p.wait_for_selector('#igPerfil .ig-sec')
        ok('Empresa fora da carteira de hoje' in p.inner_text('#igPerfil'), 'a empresa que saiu da carteira: o módulo diz que mostra só a carteira de hoje')
        p.goto(base + 'integracao-dominio.html?empresa=k15'); p.wait_for_selector('#igPerfil .ig-sec')
        ok(p.inner_text('#igPerfil h2') == XSS + ' NOME DE FORA LTDA' and p.locator('#igPerfil img').count() == 0, 'o nome que parece HTML aparece como texto no perfil')
        p.close()

        # ------------------------------------------------------------------ a Receita
        print('5. A Receita: o alto, o calendário das consultas e a lista')
        p = contexto()
        p.goto(base + 'integracao-receita.html'); lista_pronta(p)
        hoje = p.inner_text('#igHoje')
        ok('Consultada hoje às 08h36' in hoje and 'De segunda a sexta às 8h30' in hoje, f'a última consulta ({hoje.splitlines()[0]})')
        ok('1.097 de 1.500 consultas em novembro' in hoje and p.get_attribute('#igHoje .ig-barra', 'aria-label') == '73% do teto do mês', 'as consultas pagas do mês contra o teto')
        ok('9 de 13 com procuração' in hoje and '3 sem procuração ou com ela vencida' in hoje and '1 fora da consulta' in hoje, f'quantas têm procuração ({hoje.splitlines()[-2:]})')
        ok('3 pro CNPJ do escritório e 5 pro CPF do Diego (1 a ponte ainda não disse)' in hoje, f'e de quem ela é: a do CNPJ do escritório ou a do CPF do Diego ({hoje.splitlines()[-1:]})')
        prox = p.evaluate("() => Object.fromEntries([...document.querySelectorAll('#igSobre .ig-cartao')].map(i => [i.querySelector('h4').textContent, i.querySelector('.ig-prox b').textContent]))")
        ok(prox == {'Procuração': '01/12', 'PGDAS': '24/11', 'Caixa Postal': 'hoje', 'Situação fiscal': '07/12', 'Pagamentos': '25/11'}, f'as cinco consultas, com a próxima de cada uma ({prox})')
        ok('teto de 1.500 por mês' in p.inner_text('#igSobre') and 'Só do Simples' in p.inner_text('#igSobre'), 'o que cada consulta traz e o teto')
        linhas = p.evaluate(LISTA)
        alfa = next(l for l in linhas if l['id'] == 'k1')
        ok(alfa['celulas'][1:] == ['ativa até 31/03/2027 pro CPF do Diego', '2 pendências', 'declarado até 09/2026 DAS sem pagamento: 1 mês', '2 não lidas', '5 última em 12/11'], f'a linha da empresa ({alfa["celulas"][1:]})')
        ok('1 aviso do vigia' in alfa['celulas'][0], 'o aviso do vigia desta integração')
        por = {l['id']: l['celulas'] for l in linhas}
        ok(por['k2'][1] == 'sem procuração' and por['k2'][2] == '—' and por['k2'][5] == '—', 'a sem procuração: o que não foi consultado fica com o traço')
        ok(por['k3'][1] == 'vence em 12 dias pro CNPJ do escritório' and por['k5'][1] == 'vencida em 10/11/2026 pro CPF do Diego' and por['k10'][1] == 'ativa',
           f"vencendo, vencida e ativa sem data, com de quem é a procuração (a que a ponte ainda não disse fica sem) ({por['k3'][1]} · {por['k5'][1]} · {por['k10'][1]})")
        ok(por['k5'][3] == 'declarado até 09/2026 DAS sem pagamento: 1 mês' and p.get_attribute('#igCorpo tr[data-id="k5"] td:nth-child(4) small', 'title') == '09/2026',
           f"a parcela de parcelamento paga em setembro não tira setembro do DAS sem pagamento, e a guia de dois meses tira julho e agosto ({por['k5'][3]})")
        ok(por['k7'][1] == 'ainda não consultada' and por['k13'][1] == 'fora da consulta' and por['k8'][3] == '—', 'a que ainda não foi consultada, a de fora da consulta e o PGDAS só do Simples')
        ok(por['k3'][2] == 'sem pendência' and por['k3'][4] == 'tudo lido' and por['k4'][4] == 'sem mensagem' and por['k3'][5].startswith('1 última em 20/10'), f'sem pendência, tudo lido, sem mensagem e as guias ({por["k3"][2:]})')
        focos = p.evaluate(FOCOS)
        ok({k: v[0] for k, v in focos.items()} == {'todas': '14', 'pendencias': '2', 'das': '2', 'mensagens': '1', 'sem_procuracao': '4', 'fora': '1'}, f'os números do alto ({ {k: v[0] for k, v in focos.items()} })')
        p.click('#igFocos [data-foco="sem_procuracao"]'); p.click('#igCab [data-ordem="procuracao"]')
        ok([l['id'] for l in p.evaluate(LISTA)] == ['k5', 'k3', 'k2', 'k6'], f'sem procuração ou vencida, quem precisa de atenção primeiro ({[l["id"] for l in p.evaluate(LISTA)]})')
        p.click('#igFocos [data-foco="fora"]')
        ok([l['id'] for l in p.evaluate(LISTA)] == ['k13'] and 'Regime Imune' in (p.get_attribute('#igCorpo tr[data-id="k13"] td:nth-child(2) span', 'title') or ''), 'fora da consulta, com o porquê')
        p.click('#igFocos [data-foco="todas"]'); p.click('#igCab [data-ordem="nome"]')
        foto(p, 'receita-lista')

        print('6. O perfil na Receita')
        p.click('#igCorpo tr[data-id="k1"] .ig-nome'); p.wait_for_selector('#igPerfil #igGuias', timeout=10000)
        t = p.inner_text('#igPerfil')
        ok('Ativa até 31/03/2027.' in t and 'Conferida em 02/11/2026.' in t and 'É a procuração pro CPF do Diego: a ponte consulta esta empresa em nome dele.' in t,
           'a procuração, com de quem ela é e o dia em que foi conferida')
        ok('2 pendências' in t and 'PGFN: Inscrição em Dívida Ativa' in t and 'relatório de 05/11/2026' in t, 'a situação fiscal, com as pendências')
        lk = p.locator('#igPerfil a', has_text='Abrir o relatório (PDF)')
        ok(lk.count() == 1 and lk.get_attribute('href') == 'https://drive.google.com/file/d/ARQteste00001/view' and lk.get_attribute('target') == '_blank' and 'noopener' in (lk.get_attribute('rel') or ''), 'o PDF do relatório no Drive, numa aba nova')
        pg = p.evaluate("() => { const s = [...document.querySelectorAll('#igPerfil .ig-sec')].find(x => x.querySelector('h3').textContent.startsWith('PGDAS')); return [...s.querySelectorAll('tbody tr')].map(tr => tr.innerText.replace(/\\s+/g, ' ').trim()); }")
        ok(len(pg) == 4 and pg[0].startswith('09/2026 transmitida em 18/10/2026 sem pagar na consulta pago em 12/11/2026: R$ 1.250,40 R$ 84.211,50 R$ 912.000,00'), f'o mês com o DAS sem pagar na consulta e a guia paga depois ({pg[0]})')
        ok(pg[1].startswith('08/2026 transmitida em 15/09/2026 pago pago em 21/09/2026: R$ 1.180,00') and pg[2].startswith('07/2026 sem declaração na Receita') and pg[3].startswith('06/2026 transmitida em 15/07/2026 sem pagamento'),
           f'o mês pago com o dia e o valor, o mês sem declaração e o sem pagamento ({pg[1:]})')
        cx = p.evaluate("() => [...document.querySelectorAll('#igPerfil .ig-msg')].map(m => m.innerText.replace(/\\s+/g, ' ').trim())")
        ok(len(cx) == 4 and cx[0].startswith('10/11/2026 Assunto de fora') and cx[0].endswith('não lida') and cx[1] == '20/10/2026 Termo de Exclusão do Simples Nacional (Estado) não lida' and cx[2] == '19/10/2026 Declaração recepcionada',
           f'a Caixa Postal, a mais recente primeiro ({cx[:2]})')
        g = p.inner_text('#igGuias')
        ok('de 01/01/2025 a 18/11/2026' in g and '6 guias · R$ 4.275,90 pagos · R$ 50,40 de multa e juros · 1 depois do vencimento' in g.replace('\n', ' '), f'as guias pagas: o período consultado e as somas ({g.splitlines()[:6]})')
        guias = p.evaluate("() => [...document.querySelectorAll('#igGuias tr.ig-guia')].map(tr => tr.innerText.replace(/\\s+/g, ' ').trim())")
        ok(len(guias) == 6 and guias[0].startswith('12/11/2026 DAS 3333 Simples Nacional: IRPJ, CSLL, INSS') and '09/2026 20/10/2026 paga 23 dias depois R$ 1.200,00 R$ 50,40 R$ 1.250,40' in guias[0], f'a guia paga com atraso: o que pagou, os dias, a multa e os juros ({guias[0]})')
        p.click('#igGuias [data-guias="tipo"][data-v="DAS"]')
        ok(p.locator('#igGuias tr.ig-guia').count() == 3 and '3 guias · R$ 2.740,40 pagos' in p.inner_text('#igGuias .ig-total') and p.get_attribute('#igGuias [data-guias="tipo"][data-v="DAS"]', 'aria-pressed') == 'true', 'o filtro por tipo refaz a lista e as somas')
        p.click('#igGuias [data-guias="tipo"][data-v="todas"]'); p.click('#igGuias [data-guias="ano"][data-v="2025"]')
        ok(p.locator('#igGuias tr.ig-guia').count() == 1 and '1 guia · R$ 640,00 pagos' in p.inner_text('#igGuias .ig-total'), 'e o filtro por ano')
        p.click('#igGuias [data-guias="ano"][data-v="todos"]')
        p.click('#igGuias tr.ig-guia[data-guia="07202600000002"] .ig-abre')
        partes = p.inner_text('#igGuias tr.ig-partes').replace('\n', ' ')
        ok(p.get_attribute('#igGuias tr.ig-guia[data-guia="07202600000002"] .ig-abre', 'aria-expanded') == 'true' and '1001 IRPJ - Simples Nacional' in partes and 'R$ 312,60' in partes and 'Documento 07202600000002' in partes, 'a guia aberta: a parte de cada tributo, com o principal, a multa e os juros')
        ok(p.evaluate("() => document.activeElement && document.activeElement.classList.contains('ig-abre')"), 'e o foco fica na guia')
        p.click('#igGuias tr.ig-guia[data-guia="07202600000004"]')
        ok(p.locator('#igGuias tr.ig-partes').count() == 2 and 'saldo informado pela Receita: R$ 800,00' in p.inner_text('#igGuias'), 'duas guias abertas ao mesmo tempo, e o saldo que a Receita informa')
        p.click('#igGuias tr.ig-guia[data-guia="07202600000002"] .ig-abre')
        ok(p.locator('#igGuias tr.ig-partes').count() == 1, 'clicar de novo recolhe')
        av = p.inner_text('#igPerfil .ig-sec-avisos')
        ok('Receita: débito e dívida ativa' in av and 'Faturamento do Domínio' not in av, 'os avisos do vigia da Receita')
        foto(p, 'receita-perfil')
        # a parcela de parcelamento e a guia de vários meses, no perfil
        p.goto(base + 'integracao-receita.html?empresa=k5'); p.wait_for_selector('#igPerfil #igGuias', timeout=10000)
        t = p.inner_text('#igPerfil')
        ok('Venceu em 10/11/2026.' in t and 'Era a procuração pro CPF do Diego.' in t and 'em nome dele' not in t, 'a procuração vencida diz de quem era')
        pg = p.evaluate("() => { const s = [...document.querySelectorAll('#igPerfil .ig-sec')].find(x => x.querySelector('h3').textContent.startsWith('PGDAS')); return [...s.querySelectorAll('tbody tr')].map(tr => tr.innerText.replace(/\\s+/g, ' ').trim()); }")
        ok(len(pg) == 3 and pg[0].startswith('09/2026 transmitida em 19/10/2026 sem pagamento') and 'pago em' not in pg[0], f'setembro segue sem pagamento: a parcela paga em setembro não é o DAS do mês ({pg[0]})')
        ok(pg[1].startswith('08/2026 transmitida em 16/09/2026 sem pagar na consulta pago em 30/10/2026: R$ 320,20 (numa guia de 2 meses)')
           and pg[2].startswith('07/2026 transmitida em 17/08/2026 sem pagar na consulta pago em 30/10/2026: R$ 320,10 (numa guia de 2 meses)'), f'a guia de dois meses aparece nos dois, com a parte de cada um ({pg[1:]})')
        ok('a parcela paga não é o DAS do mês' in t, 'a nota do PGDAS explica a parcela')
        guias = p.evaluate("() => [...document.querySelectorAll('#igGuias tr.ig-guia')].map(tr => tr.innerText.replace(/\\s+/g, ' ').trim())")
        ok(len(guias) == 2 and guias[0].startswith('30/10/2026 DAS 3333 IRPJ - Simples Nacional') and '08/2026 e mais 1 mês 21/09/2026' in guias[0] and 'parcela de parcelamento' not in guias[0],
           f'a guia de vários meses diz quantos meses pagou ({guias[0]})')
        ok(guias[1].startswith('25/09/2026 DAS 3333 parcela de parcelamento Simples Nacional: IRPJ, INSS') and '09/2026 30/09/2026' in guias[1], f'a parcela de parcelamento vem marcada nas guias pagas ({guias[1]})')
        ok(p.get_attribute('#igGuias tr.ig-guia[data-guia="07202600000022"] td:nth-child(3) small', 'title') == 'A mesma guia pagou 07/2026, 08/2026'
           and 'não o DAS daquele mês' in (p.get_attribute('#igGuias tr.ig-guia[data-guia="07202600000021"] .ig-etiqueta', 'title') or ''), 'os meses da guia e o porquê da parcela ficam na dica')
        foto(p, 'receita-perfil-parcelamento')
        p.goto(base + 'integracao-receita.html?empresa=k10'); p.wait_for_selector('#igPerfil #igGuias', timeout=10000)
        ok('A ponte ainda não disse se ela é a do CNPJ do escritório ou a do CPF do Diego' in p.inner_text('#igPerfil'), 'a que a ponte ainda não disse de quem é a procuração')
        p.goto(base + 'integracao-receita.html?empresa=k3'); p.wait_for_selector('#igPerfil #igGuias', timeout=10000)
        ok('É a procuração pro CNPJ do escritório.' in p.inner_text('#igPerfil'), 'e a do CNPJ do escritório')
        p.goto(base + 'integracao-receita.html?empresa=k13'); p.wait_for_selector('#igPerfil .ig-sec')
        t = p.inner_text('#igPerfil')
        ok('Fora da consulta' in t and 'Regime Imune: a ponte consulta as empresas do Simples, do MEI, do Presumido e do Real.' in t and p.locator('#igGuias').count() == 0, 'a empresa fora da consulta: o porquê, e mais nada')
        p.goto(base + 'integracao-receita.html?empresa=k2'); p.wait_for_selector('#igPerfil #igGuias')
        t = p.inner_text('#igPerfil')
        ok('Sem procuração: a Receita recusou a consulta.' in t and 'Minhas Autorizações de Acesso' in t and 'Sem a procuração, a ponte não consegue consultar os pagamentos' in t
           and 'procuração pro C' not in t and 'ainda não disse' not in t, 'a sem procuração: o que pedir ao cliente, e nada de quem é')
        ok(not any(h.startswith('PGDAS') for h in p.locator('#igPerfil .ig-sec h3').all_inner_texts()), 'a do Presumido não tem a seção do PGDAS')
        p.goto(base + 'integracao-receita.html?empresa=k7'); p.wait_for_selector('#igPerfil .ig-sec')
        ok('Ainda não consultada' in p.inner_text('#igPerfil'), 'a que entra na próxima rodada')

        print('7. O que vem de fora entra como texto')
        for tela, emp in (('integracao-dominio.html', 'k1'), ('integracao-receita.html', 'k1')):
            p.goto(base + tela + '?empresa=' + emp); p.wait_for_selector('#igPerfil .ig-sec')
            if 'receita' in tela: p.click('#igGuias tr.ig-guia[data-guia="07202600000004"] .ig-abre')
            ok(p.locator('#igPerfil img').count() == 0 and '<img src=x onerror=' in p.inner_text('#igPerfil'), f'{tela}: no perfil, o <img onerror> aparece como texto')
            p.click('#igVoltar'); p.wait_for_selector('#igGeral:not([hidden])')
            ok(p.locator('#igRaiz img').count() == 0 and '<img src=x onerror=' in p.inner_text('#igCorpo'), f'{tela}: na lista também')
        ok(p.evaluate('() => window.__xss === undefined'), 'e nenhum código rodou')
        p.close()

        # ------------------------------------------------------------------ a página e o card do Painel
        print('8. A página Integrações e o card do Painel')
        p = contexto()
        p.goto(base + 'integracoes.html')
        p.wait_for_function("() => !document.querySelector('.card-status.st-load') && document.getElementById('domLigadas').textContent !== '…'", timeout=10000)
        cards = p.evaluate("() => [...document.querySelectorAll('.dashboard-card')].map(c => ({ href: c.getAttribute('href'), titulo: c.querySelector('h3').textContent, traz: [...c.querySelectorAll('.ih-traz li')].map(l => l.textContent), fatos: c.querySelector('.ih-fatos').innerText.replace(/\\s+/g, ' '), selo: c.querySelector('.card-status').textContent, classe: c.querySelector('.card-status').className, cor: c.style.getPropertyValue('--cor') }))")
        ok([c['href'] for c in cards] == ['integracao-dominio.html', 'integracao-receita.html'] and len(cards[0]['traz']) == 5 and len(cards[1]['traz']) == 5, 'os dois cards, cada um com o que traz')
        ok('Última leitura hoje às 07h12' in cards[0]['fatos'] and 'Empresas da carteira ligadas 13 de 14' in cards[0]['fatos'] and cards[0]['selo'] == 'Em dia' and 'st-clear' in cards[0]['classe'], f'o Domínio: a última leitura, as ligadas e em dia ({cards[0]["fatos"]})')
        ok('Última consulta hoje às 08h36' in cards[1]['fatos'] and 'Empresas com procuração 9 de 13' in cards[1]['fatos'] and 'Consultas pagas no mês 1.097 de 1.500' in cards[1]['fatos'] and cards[1]['selo'] == 'Em dia', f'a Receita: a última consulta, as com procuração e as consultas do mês ({cards[1]["fatos"]})')
        ok(all(c['cor'] for c in cards) and cards[0]['cor'] != cards[1]['cor'], 'cada card com a cor do próprio ícone')
        foto(p, 'pagina')
        p.goto(base + 'index.html')
        p.wait_for_function("() => { const s = document.querySelector('a.dashboard-card[href=\"integracoes.html\"] .card-status'); return s && !s.classList.contains('st-load'); }", timeout=10000)
        selo = p.evaluate("() => { const s = document.querySelector('a.dashboard-card[href=\"integracoes.html\"] .card-status'); return [s.textContent.trim(), s.className]; }")
        ok(selo == ['Em dia', 'badge card-status st-clear'], f'no Painel, o card Integrações em dia ({selo})')
        foto(p, 'painel')
        p.close()
        p = contexto(relogio='2026-11-24T15:00:00')     # 5 dias depois, sem nenhuma rodada nova
        p.goto(base + 'index.html')
        p.wait_for_function("() => { const s = document.querySelector('a.dashboard-card[href=\"integracoes.html\"] .card-status'); return s && !s.classList.contains('st-load'); }", timeout=10000)
        p.wait_for_timeout(300)
        selo = p.evaluate("() => { const s = document.querySelector('a.dashboard-card[href=\"integracoes.html\"] .card-status'); return [s.textContent.trim(), s.className, s.querySelector('b') ? s.querySelector('b').textContent : null]; }")
        ok(selo == ['2 atrasadas', 'badge card-status st-open', '2'], f'com as duas pontes sem rodar: "2 atrasadas", com o número na frente ({selo})')
        p.goto(base + 'integracoes.html')
        p.wait_for_function("() => !document.querySelector('.card-status.st-load')", timeout=10000)
        ok(p.evaluate("() => [...document.querySelectorAll('.card-status')].map(s => s.textContent)") == ['Parada', 'Parada'], 'e na página, cada uma como parada')
        p.goto(base + 'integracao-receita.html'); lista_pronta(p)
        ok(p.get_attribute('#igHoje .ig-tile', 'data-estado') == 'parada' and 'Parada desde 19/11' in p.inner_text('#igHoje') and 'Sem consulta em novembro' not in p.inner_text('#igHoje'), 'e na tela, "Parada desde 19/11"')
        p.close()

        print('9. O celular e os dois temas')
        for tela in ('integracao-dominio.html', 'integracao-receita.html', 'integracoes.html', 'integracao-dominio.html?empresa=k1', 'integracao-receita.html?empresa=k1'):
            p = contexto(largura=390, altura=844)
            p.goto(base + tela)
            p.wait_for_selector('#igPerfil .ig-sec' if 'empresa=' in tela else ('#igCorpo tr[data-id]' if 'integracao-' in tela else '.ih-fatos'), timeout=10000)
            p.wait_for_timeout(400)
            sobra = p.evaluate(SOBRA)
            ok(sobra <= 1, f'{tela} no celular: nada passa da largura da tela ({sobra} px)')
            foto(p, 'celular-' + re.sub(r'[^a-z0-9]+', '-', tela.replace('.html', '')))
            p.close()
        for tela, nome in (('integracao-dominio.html', 'dominio-lista'), ('integracao-receita.html?empresa=k1', 'receita-perfil'), ('integracoes.html', 'pagina'), ('index.html', 'painel')):
            p = contexto(tema='claro')
            p.goto(base + tela)
            p.wait_for_selector('#igPerfil #igGuias' if 'empresa=' in tela else ('#igCorpo tr[data-id]' if 'integracao-' in tela else '.dashboard-card'), timeout=10000)
            p.wait_for_timeout(900)
            ok(p.evaluate("() => document.documentElement.dataset.theme") == 'light', f'{tela} no tema claro')
            foto(p, 'claro-' + nome)
            p.close()

        ok(not erros, f'nenhum erro de JavaScript ({erros[:3]})')
        b.close()
    srv.shutdown()
    print('\n' + (f'{falhas} falha(s).' if falhas else 'Tudo certo.'))
    return 1 if falhas else 0

if __name__ == '__main__':
    sys.exit(main(fotos='--fotos' in sys.argv))
