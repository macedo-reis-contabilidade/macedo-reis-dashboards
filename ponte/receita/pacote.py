"""O pacote da Receita — o contrato com o sistema (versão 1, "tipo": "receita"; o do Domínio não tem tipo).

    { "versao": 1, "tipo": "receita",
      "rodada": { id, inicio, fim, maquina, ponte, ambiente, chamadas_mes },
      "empresas": [ { documento, autorizacao?, pgdas?, faturamento?, caixa_postal?, situacao_fiscal? } ],
      "faltou": [ { documento, servico, motivo } ] }

Bloco que não está na empresa = não consultado nesta rodada (nunca um "vazio" inventado). Só os campos daqui saem do
PC — a mesma trava do Domínio: o que vier a mais é descartado antes de montar (o PDF e o texto inteiro de uma
mensagem nunca saem).
"""
import socket
import uuid

from . import VERSAO, SERVICOS

MOTIVOS = ('sem_autorizacao', 'teto', 'erro', 'a_conferir')
SITUACOES = ('ativa', 'vencida', 'sem')
ORIGENS = ('Receita', 'Estado', 'Município')
ORGAOS = ('Receita', 'PGFN')


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
        return {'competencia': _texto(b.get('competencia'), 7), 'receita_mes': _num(b.get('receita_mes')),
                'receita_12_meses': _num(b.get('receita_12_meses'))}
    if servico == 'caixa_postal':
        return {'mensagens': [{'id': _texto(m.get('id'), 40), 'assunto': _texto(m.get('assunto')),
                               'enviada_em': _texto(m.get('enviada_em'), 10), 'origem': _so(m.get('origem'), ORIGENS),
                               'lida': _bool(m.get('lida'))}
                              for m in (b.get('mensagens') or []) if isinstance(m, dict)]}
    if servico == 'situacao_fiscal':
        p = b.get('pendencias')
        pend = None if p is None else [{'orgao': _so(x.get('orgao'), ORGAOS), 'titulo': _texto(x.get('titulo'), 200)}
                                        for x in p if isinstance(x, dict)]
        return {'consultada_em': _texto(b.get('consultada_em'), 10), 'pendencias': pend}
    return None


def montar(empresas, faltou, inicio, fim, ambiente, chamadas_mes):
    """empresas: {documento: {servico: bloco}}; faltou: [{documento, servico, motivo}]."""
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
    return {
        'versao': 1,
        'tipo': 'receita',
        'rodada': {'id': str(uuid.uuid4()), 'inicio': inicio, 'fim': fim, 'maquina': socket.gethostname(),
                   'ponte': VERSAO, 'ambiente': ambiente, 'chamadas_mes': int(chamadas_mes)},
        'empresas': lista,
        'faltou': [{'documento': str(f['documento']), 'servico': f['servico'], 'motivo': f['motivo']}
                   for f in faltou if f.get('motivo') in MOTIVOS and f.get('servico') in SERVICOS],
    }


def resumo(pac):
    contas = {s: sum(1 for e in pac['empresas'] if s in e) for s in SERVICOS}
    msgs = sum(len(e['caixa_postal']['mensagens']) for e in pac['empresas'] if 'caixa_postal' in e)
    partes = [f'{s} {n}' for s, n in contas.items() if n]
    texto = f"{len(pac['empresas'])} empresa(s) com dado" + (f" ({', '.join(partes)})" if partes else '')
    if msgs:
        texto += f'; {msgs} mensagem(ns) nova(s) na Caixa Postal'
    if pac['faltou']:
        por = {}
        for f in pac['faltou']:
            por[f['motivo']] = por.get(f['motivo'], 0) + 1
        texto += '; faltou: ' + ', '.join(f'{m} {n}' for m, n in sorted(por.items()))
    return texto
