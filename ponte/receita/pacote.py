"""O pacote da Receita — o contrato com o sistema (versão 1, "tipo": "receita"; o do Domínio não tem tipo).

    { "versao": 1, "tipo": "receita",
      "rodada": { id, inicio, fim, maquina, ponte, ambiente, chamadas_mes },
      "empresas": [ { documento, autorizacao?, pgdas?, faturamento?, caixa_postal?, situacao_fiscal?, pagamentos? } ],
      "faltou": [ { documento, servico, motivo } ],
      "vias": [ { documento, via } ] }

Bloco que não está na empresa = não consultado nesta rodada (nunca um "vazio" inventado). O que a ponte não conseguiu
ler do PDF não vai (24/10/2026): o faturamento sem os dois valores e a situação fiscal sem a lista de pendências ficam
fora do pacote — vai só o `faltou` com `a_conferir` (no sistema, a lista nula virava "sem pendência" e o faturamento
nulo apagava o do mês). No pacote, só os campos daqui — a mesma trava do Domínio: o que vier a mais é descartado antes
de montar (o PDF e o texto inteiro de uma mensagem nunca vão nele). O PDF do relatório de situação fiscal vai à parte,
um por pedido, pra pasta da empresa no Drive (relatorios.py, 09/11/2026).

Os pagamentos (19/11/2026): { de, ate, documentos: [ { numero, tipo_codigo, tipo, periodo_apuracao, arrecadado_em,
vencimento, receita_codigo, receita, referencia, valor_total, principal, multa, juros, saldo, partes: [ { receita_codigo,
receita, periodo_apuracao, vencimento, valor_total, principal, multa, juros } ] } ] } — a janela consultada e as guias
pagas nela (a lista vazia = nada pago na janela). A conferência do sistema: BLOCOS.pagamentos em
supabase/functions/ponte/receita.js.

De quem é a procuração (19/11/2026, a 0.4.4): `vias` é a lista do que o estado.json lembra de cada empresa da rodada
que tem procuração — "escritorio" (a do CNPJ do escritório) ou "procurador" (a do CPF do procurador, em nome de quem a
ponte consulta a empresa). Vai em toda rodada que manda pacote, sem consulta nenhuma ao Serpro: sai do que a última
consulta da autorização de cada empresa já disse. O sistema grava só isso (a coluna autorizacao_via) e só de quem ele
tem com a procuração; a empresa sem procuração não entra na lista, e sem nenhuma a lista não vai.
"""
import socket
import uuid

from . import VERSAO, SERVICOS

MOTIVOS = ('sem_autorizacao', 'teto', 'erro', 'a_conferir')
SITUACOES = ('ativa', 'vencida', 'sem')
VIAS = ('escritorio', 'procurador')
ORIGENS = ('Receita', 'Estado', 'Município')
ORGAOS = ('Receita', 'PGFN')
CAMPOS_GUIA = ('numero', 'tipo_codigo', 'tipo', 'periodo_apuracao', 'arrecadado_em', 'vencimento', 'receita_codigo',
               'receita', 'referencia', 'valor_total', 'principal', 'multa', 'juros', 'saldo')
CAMPOS_PARTE = ('receita_codigo', 'receita', 'periodo_apuracao', 'vencimento', 'valor_total', 'principal', 'multa', 'juros')
NUMEROS = ('valor_total', 'principal', 'multa', 'juros', 'saldo')


def _texto(v, n=300):
    return str(v)[:n] if v is not None and str(v) != '' else None


def _num(v):
    if v is None or isinstance(v, bool):
        return None
    try:
        return round(float(v), 2)
    except (TypeError, ValueError):
        return None


def _bool(v):
    return v if isinstance(v, bool) else None


def _so(v, permitidos):
    return v if v in permitidos else None


def limpar_bloco(servico, b):
    if not isinstance(b, dict):
        return None
    if servico == 'autorizacao':
        return {'situacao': _so(b.get('situacao'), SITUACOES), 'valida_ate': _texto(b.get('valida_ate'), 10)}
    if servico == 'pgdas':
        meses = [{'competencia': _texto(m.get('competencia'), 7), 'transmitida_em': _texto(m.get('transmitida_em'), 25),
                  'das_pago': _bool(m.get('das_pago'))} for m in (b.get('meses') or []) if isinstance(m, dict)]
        ano = b.get('ano')
        return {'ano': ano if isinstance(ano, int) and not isinstance(ano, bool) else None, 'meses': meses}
    if servico == 'faturamento':
        mes, doze = _num(b.get('receita_mes')), _num(b.get('receita_12_meses'))
        if mes is None or doze is None:
            return None                       # não lido: fica fora (o faltou diz a_conferir)
        return {'competencia': _texto(b.get('competencia'), 7), 'receita_mes': mes, 'receita_12_meses': doze}
    if servico == 'caixa_postal':
        return {'mensagens': [{'id': _texto(m.get('id'), 80), 'assunto': _texto(m.get('assunto')),
                               'enviada_em': _texto(m.get('enviada_em'), 10), 'origem': _so(m.get('origem'), ORIGENS),
                               'lida': _bool(m.get('lida'))}
                              for m in (b.get('mensagens') or []) if isinstance(m, dict)]}
    if servico == 'situacao_fiscal':
        p = b.get('pendencias')
        if not isinstance(p, list):
            return None                       # não lida: fica fora (o faltou diz a_conferir)
        pend = [{'orgao': _so(x.get('orgao'), ORGAOS), 'titulo': _texto(x.get('titulo'), 200)}
                for x in p if isinstance(x, dict)]
        return {'consultada_em': _texto(b.get('consultada_em'), 10), 'pendencias': pend}
    if servico == 'pagamentos':
        de, ate = _texto(b.get('de'), 10), _texto(b.get('ate'), 10)
        if not de or not ate or not isinstance(b.get('documentos'), list):
            return None
        guias = []
        for g in b['documentos']:
            if not isinstance(g, dict):
                continue
            guia = {k: (_num(g.get(k)) if k in NUMEROS else _texto(g.get(k), 120)) for k in CAMPOS_GUIA}
            guia['partes'] = [{k: (_num(x.get(k)) if k in NUMEROS else _texto(x.get(k), 120)) for k in CAMPOS_PARTE}
                              for x in (g.get('partes') or []) if isinstance(x, dict)]
            guias.append(guia)
        return {'de': de, 'ate': ate, 'documentos': guias}
    return None


def montar(empresas, faltou, inicio, fim, ambiente, chamadas_mes, vias=None):
    """empresas: {documento: {servico: bloco}}; faltou: [{documento, servico, motivo}]; vias: {documento: 'escritorio' |
    'procurador'} (de quem é a procuração de cada empresa, pelo estado)."""
    lista = []
    for doc in sorted(empresas):
        e = {'documento': str(doc)}
        for servico in SERVICOS:
            if servico in empresas[doc]:
                limpo = limpar_bloco(servico, empresas[doc][servico])
                if limpo is not None:
                    e[servico] = limpo
        if len(e) > 1:
            lista.append(e)
    pac = {
        'versao': 1,
        'tipo': 'receita',
        'rodada': {'id': str(uuid.uuid4()), 'inicio': inicio, 'fim': fim, 'maquina': socket.gethostname(),
                   'ponte': VERSAO, 'ambiente': ambiente, 'chamadas_mes': int(chamadas_mes)},
        'empresas': lista,
        'faltou': [{'documento': str(f['documento']), 'servico': f['servico'], 'motivo': f['motivo']}
                   for f in faltou if f.get('motivo') in MOTIVOS and f.get('servico') in SERVICOS],
    }
    de_quem = [{'documento': str(doc), 'via': via} for doc, via in sorted((vias or {}).items()) if via in VIAS]
    if de_quem:
        pac['vias'] = de_quem
    return pac


def resumo(pac):
    contas = {s: sum(1 for e in pac['empresas'] if s in e) for s in SERVICOS}
    msgs = sum(len(e['caixa_postal']['mensagens']) for e in pac['empresas'] if 'caixa_postal' in e)
    guias = sum(len(e['pagamentos']['documentos']) for e in pac['empresas'] if 'pagamentos' in e)
    partes = [f'{s} {n}' for s, n in contas.items() if n]
    texto = f"{len(pac['empresas'])} empresa(s) com dado" + (f" ({', '.join(partes)})" if partes else '')
    if msgs:
        texto += f'; {msgs} mensagem(ns) nova(s) na Caixa Postal'
    if contas.get('pagamentos'):
        texto += f'; {guias} guia(s) paga(s)'
    if pac['faltou']:
        por = {}
        for f in pac['faltou']:
            por[f['motivo']] = por.get(f['motivo'], 0) + 1
        texto += '; faltou: ' + ', '.join(f'{m} {n}' for m, n in sorted(por.items()))
    vias = pac.get('vias') or []
    if vias:
        do_procurador = sum(1 for v in vias if v['via'] == 'procurador')
        texto += (f'; a procuração de {len(vias)} empresa(s): {len(vias) - do_procurador} pro CNPJ do escritório e '
                  f'{do_procurador} pro CPF do procurador')
    return texto
