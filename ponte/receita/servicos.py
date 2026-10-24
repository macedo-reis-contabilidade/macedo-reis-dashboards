"""O que cada consulta ao Serpro vira no pacote (o contrato em pacote.py).

    autorizacao      PROCURACOES · OBTERPROCURACAO41 — até quando o cliente autorizou o escritório
    pgdas            PGDASD · CONSDECLARACAO13 — cada mês declarado no ano, quando, e se o DAS foi pago
    faturamento      PGDASD · CONSULTIMADECREC14 — a última declaração de um mês: do PDF, a receita do mês (RPA) e a
                     dos 12 meses (RBT12)
    caixa_postal     EVENTOSATUALIZACAO · SOLICEVENTOSPJ132 + OBTEREVENTOSPJ134 (o evento E0601, Caixa Postal, em lote
                     de até 1.000 CNPJs) e, só de quem teve novidade, CAIXAPOSTAL · MSGCONTRIBUINTE61
    situacao_fiscal  SITFIS · SOLICITARPROTOCOLO91 (Apoiar) + RELATORIOSITFIS92 (Emitir) — do PDF, as pendências

Toda consulta passa por consultar(): o teto do mês, o Serpro fora do ar, o acesso negado (= o cliente não autorizou)
e a recusa viram Falta, que a rodada põe no `faltou` com o motivo (sem_autorizacao, teto, erro, a_conferir). A Falta
diz também se a consulta foi FEITA (o Serpro respondeu, mesmo que recusando — no calendário "a partir do dia", ela só
volta no próximo dia marcado) ou não (o teto, o Serpro fora, o relatório que não ficou pronto — tenta na próxima rodada).
"""
import base64
import datetime
import re

from . import calendario, estado as est_mod, pdf
from .serpro import SerproFora

EVENTO_CAIXA_POSTAL = 'E0601'      # o E0301 do cenário de demonstração é o da DCTFWeb
LOTE_EVENTOS = 1000
MAX_MENSAGENS = 100                # por empresa num pacote (as mais recentes)
DIAS_PRIMEIRA = 90                 # na primeira leitura da empresa, só as enviadas nesses dias
MAX_PENDENCIAS = 100               # por empresa (o limite da função do sistema)
ORIGEM = {'1': 'Receita', '2': 'Estado', '3': 'Município'}


class Falta(Exception):
    def __init__(self, motivo, detalhe='', feita=True):
        super().__init__(motivo)
        self.motivo = motivo
        self.detalhe = detalhe
        self.feita = feita              # o Serpro respondeu (a consulta conta como feita no calendário)


def consultar(cli, endpoint, sistema, servico, contribuinte, dados, versao='1.0', tipo=None):
    if cli.contador.acabou():
        raise Falta('teto', 'o teto de chamadas do mês chegou', feita=False)
    try:
        return cli.chamar(endpoint, sistema, servico, contribuinte, dados, versao, tipo)
    except SerproFora as e:
        raise Falta('erro', str(e), feita=False)


def _conferir_resposta(r):
    if r.acesso_negado():
        raise Falta('sem_autorizacao', r.resumo())
    if not r.ok():
        raise Falta('erro', r.resumo() or f'HTTP {r.http_status}')


def _data8(valor):
    """'20221231' → '2022-12-31' (None se não for uma data)."""
    s = re.sub(r'\D', '', str(valor or ''))[:8]
    try:
        return datetime.datetime.strptime(s, '%Y%m%d').date().isoformat()
    except ValueError:
        return None


def _hora14(valor):
    """'20220331152512' → '2022-03-31T15:25:12-03:00' (a hora do Serpro é a de Brasília)."""
    s = re.sub(r'\D', '', str(valor or ''))[:14]
    try:
        return datetime.datetime.strptime(s, '%Y%m%d%H%M%S').isoformat() + '-03:00'
    except ValueError:
        return None


def _tipo_doc(doc):
    return '1' if len(doc) == 11 else '2'


# ---------------------------------------------------------------- autorização

def autorizacao(cli, empresa, hoje):
    doc = empresa['documento']
    r = consultar(cli, 'Consultar', 'PROCURACOES', 'OBTERPROCURACAO41', doc,
                  {'outorgante': doc, 'tipoOutorgante': _tipo_doc(doc), 'outorgado': cli.cnpj, 'tipoOutorgado': '2'},
                  versao='1')
    if '40400' in r.codigos():                                  # "Não possui procuração ativa."
        return {'situacao': 'sem', 'valida_ate': None}
    _conferir_resposta(r)
    lista = r.dados()
    datas = [_data8(p.get('dtexpiracao')) for p in (lista if isinstance(lista, list) else []) if isinstance(p, dict)]
    datas = [d for d in datas if d]
    if not datas:
        return {'situacao': 'sem', 'valida_ate': None}
    valida_ate = max(datas)
    return {'situacao': 'ativa' if valida_ate >= hoje.isoformat() else 'vencida', 'valida_ate': valida_ate}


# ---------------------------------------------------------------- PGDAS-D

def pgdas(cli, empresa, hoje):
    doc = empresa['documento']
    meses, anos = {}, []
    for ano in calendario.anos_do_pgdas(hoje):
        r = consultar(cli, 'Consultar', 'PGDASD', 'CONSDECLARACAO13', doc, {'anoCalendario': str(ano)})
        _conferir_resposta(r)
        d = r.dados() or {}
        if not isinstance(d, dict):
            continue
        try:
            anos.append(int(d.get('anocalendario') or ano))
        except (TypeError, ValueError):
            anos.append(ano)
        for p in d.get('periodos') or []:
            if not isinstance(p, dict):
                continue
            pa = re.sub(r'\D', '', str(p.get('periodoApuracao') or ''))
            if len(pa) != 6:
                continue
            ops = [o for o in (p.get('operacoes') or []) if isinstance(o, dict)]
            decl = [o['indiceDeclaracao'] for o in ops if isinstance(o.get('indiceDeclaracao'), dict)]
            das = [o['indiceDas'] for o in ops if isinstance(o.get('indiceDas'), dict)]
            if not decl:
                continue
            transmitida = max((_hora14(x.get('dataHoraTransmissao')) or '' for x in decl), default='') or None
            meses[f'{pa[:4]}-{pa[4:]}'] = {
                'competencia': f'{pa[:4]}-{pa[4:]}',
                'transmitida_em': transmitida,
                'das_pago': None if not das else any(x.get('dasPago') is True for x in das),
            }
    return {'ano': max(anos) if anos else hoje.year, 'meses': [meses[k] for k in sorted(meses)]}


def mes_a_ler(meses, estado, doc):
    """O mês cuja declaração ler agora: o mais novo entre os que vieram depois do último lido e os já lidos que foram
    retificados (a transmissão mudou). Na primeira vez, só o mês mais recente — o ano pra trás não é lido um a um."""
    lidas = estado.declaracoes_lidas(doc)
    ultimo = max(lidas) if lidas else None
    pendentes = [m for m in meses if m.get('transmitida_em') and lidas.get(m['competencia']) != m['transmitida_em']
                 and (ultimo is None or m['competencia'] in lidas or m['competencia'] > ultimo)]
    return max(pendentes, key=lambda m: m['competencia']) if pendentes else None


def faturamento(cli, empresa, mes, pasta):
    doc = empresa['documento']
    r = consultar(cli, 'Consultar', 'PGDASD', 'CONSULTIMADECREC14', doc,
                  {'periodoApuracao': mes['competencia'].replace('-', '')})
    _conferir_resposta(r)
    d = r.dados() or {}
    pdf_b64 = (d.get('declaracao') or {}).get('pdf') if isinstance(d, dict) else None
    bloco = {'competencia': mes['competencia'], 'receita_mes': None, 'receita_12_meses': None}
    if not pdf_b64:
        return bloco, 'a resposta não trouxe o PDF da declaração'
    try:
        conteudo = base64.b64decode(pdf_b64)
    except (ValueError, TypeError):
        return bloco, 'o PDF da declaração veio estragado'
    guardado = est_mod.guardar_pdf(pasta, f"{doc}-declaracao-{mes['competencia']}.pdf", conteudo)
    rpa, rbt12 = pdf.ler_declaracao(pdf.texto(conteudo))
    bloco['receita_mes'], bloco['receita_12_meses'] = rpa, rbt12
    if rpa is None or rbt12 is None:
        return bloco, f'não achei a receita no texto do PDF (guardado em {guardado.name})'
    return bloco, None


# ---------------------------------------------------------------- Caixa Postal

def _protocolo(r):
    """O pedido de eventos devolve {"protocolo", "TempoEsperaMedioEmMs"} — e o próprio exemplo do Serpro vem sem a chave
    de fechar; por isso, se o JSON não fecha, lê os dois campos pelo texto."""
    d = r.dados()
    if isinstance(d, dict) and d.get('protocolo'):
        return str(d['protocolo']), d.get('TempoEsperaMedioEmMs') or 1000
    txt = r.dados_texto if isinstance(r.dados_texto, str) else ''
    p = re.search(r'"protocolo"\s*:\s*"([^"]+)"', txt)
    t = re.search(r'"TempoEsperaMedioEmMs"\s*:\s*(\d+)', txt)
    return (p.group(1) if p else None), (int(t.group(1)) if t else 1000)


def eventos_caixa_postal(cli, docs):
    """{cnpj: 'AAMMDD' (data da última novidade, até 60 dias) | '' (nenhuma) | 'x' (sem autorização)} — em lote."""
    resultado = {}
    for i in range(0, len(docs), LOTE_EVENTOS):
        lote = docs[i:i + LOTE_EVENTOS]
        r = consultar(cli, 'Monitorar', 'EVENTOSATUALIZACAO', 'SOLICEVENTOSPJ132', ','.join(lote),
                      {'evento': EVENTO_CAIXA_POSTAL}, tipo=4)
        _conferir_resposta(r)
        protocolo, espera = _protocolo(r)
        if not protocolo:
            raise Falta('erro', 'o pedido de eventos não devolveu o protocolo')
        cli.esperar(espera)
        r2 = consultar(cli, 'Monitorar', 'EVENTOSATUALIZACAO', 'OBTEREVENTOSPJ134', '',
                       {'protocolo': protocolo, 'evento': EVENTO_CAIXA_POSTAL}, tipo=4)
        _conferir_resposta(r2)
        for linha in r2.dados() or []:
            if isinstance(linha, list) and len(linha) >= 2:
                resultado[re.sub(r'\D', '', str(linha[0]))] = str(linha[1] or '').strip()
    return resultado


def _origem(m):
    o = ORIGEM.get(str(m.get('tipoOrigem') or '').strip())
    if o:
        return o
    descricao = str(m.get('descricaoOrigem') or '').upper()
    return 'Receita' if 'RECEITA' in descricao else None


def mensagens(cli, empresa, estado, hoje):
    """As mensagens a mandar (o bloco) e o que lembrar delas ([(id, lida | 'antiga')]).

    Vai: a que nunca foi mandada e a mandada como não lida que agora aparece lida (o sistema atualiza o "lida" e o
    aviso some). Na primeira leitura da empresa, só as enviadas nos últimos DIAS_PRIMEIRA dias — as antigas ficam no
    e-CAC e são lembradas como 'antiga', pra não irem depois. No máximo MAX_MENSAGENS (as mais recentes) por pacote."""
    doc = empresa['documento']
    r = consultar(cli, 'Consultar', 'CAIXAPOSTAL', 'MSGCONTRIBUINTE61', doc,
                  {'statusLeitura': '0', 'indicadorPagina': '0', 'ponteiroPagina': '00000000000000'})
    _conferir_resposta(r)
    d = r.dados() or {}
    conteudo = d.get('conteudo') if isinstance(d, dict) else None
    lista = (conteudo[0].get('listaMensagens') if conteudo and isinstance(conteudo[0], dict) else None) or []
    ja = estado.mensagens_mandadas(doc)
    primeira = not estado.conhece_mensagens(doc)
    desde = (hoje - datetime.timedelta(days=DIAS_PRIMEIRA)).isoformat()
    candidatas, lembrar = [], []
    for m in lista:
        if not isinstance(m, dict):
            continue
        isn = re.sub(r'\s+', '', str(m.get('isn') or ''))[:80]
        if not isn:
            continue
        lida = str(m.get('indicadorLeitura') or '').strip() == '1'
        enviada = _data8(m.get('dataEnvio'))
        antes = ja.get(isn, 'nova')
        if antes == 'antiga' or (antes != 'nova' and not (antes is False and lida)):
            continue                                   # já mandada (e o "lida" não mudou pra lida), ou deixada antiga
        if primeira and (not enviada or enviada < desde):
            lembrar.append((isn, 'antiga'))
            continue
        assunto = str(m.get('assuntoModelo') or '').replace('++VARIAVEL++', str(m.get('valorParametroAssunto') or ''))
        assunto = re.sub(r'\s+', ' ', assunto).strip()[:300] or '(sem assunto)'
        candidatas.append({'id': isn, 'assunto': assunto, 'enviada_em': enviada, 'origem': _origem(m), 'lida': lida})
    candidatas.sort(key=lambda x: x['enviada_em'] or '', reverse=True)
    vao = candidatas[:MAX_MENSAGENS]
    lembrar += [(x['id'], x['lida']) for x in vao]
    return {'mensagens': vao}, lembrar, len(candidatas) - len(vao), sum(1 for _, v in lembrar if v == 'antiga')


# ---------------------------------------------------------------- situação fiscal

def _espera_do_etag(cabecalhos):
    for k, v in (cabecalhos or {}).items():
        if k.lower() == 'etag':
            m = re.search(r'tempoEspera\s*:\s*(\d+)', str(v))
            if m:
                return int(m.group(1))
    return None


def situacao_fiscal(cli, empresa, hoje, pasta, tentativas=6):
    """(bloco, problema, aviso): problema = o PDF não deu pra ler (o bloco não vai, fica a_conferir); aviso = a lista
    foi lida mas cortada no limite (o bloco vai)."""
    doc = empresa['documento']
    r = consultar(cli, 'Apoiar', 'SITFIS', 'SOLICITARPROTOCOLO91', doc, '')
    _conferir_resposta(r)
    d = r.dados() or {}
    protocolo = d.get('protocoloRelatorio') if isinstance(d, dict) else None
    espera = (d.get('tempoEspera') if isinstance(d, dict) else None) or 4000
    if not protocolo:
        raise Falta('erro', 'o pedido do relatório não devolveu o protocolo')
    pdf_b64 = None
    for _ in range(tentativas):
        cli.esperar(espera)
        r2 = consultar(cli, 'Emitir', 'SITFIS', 'RELATORIOSITFIS92', doc, {'protocoloRelatorio': protocolo})
        if r2.http_status == 204 or r2.status == 204:          # ainda processando: a espera nova vem no ETag
            espera = _espera_do_etag(r2.cabecalhos) or espera
            continue
        if r2.http_status == 202 or r2.status == 202:          # pedido antes da hora: espera de novo
            d2 = r2.dados()
            espera = (d2.get('tempoEspera') if isinstance(d2, dict) else None) or espera
            continue
        _conferir_resposta(r2)
        d2 = r2.dados() or {}
        pdf_b64 = d2.get('pdf') if isinstance(d2, dict) else None
        break
    else:
        raise Falta('erro', 'o relatório de situação fiscal não ficou pronto a tempo', feita=False)
    bloco = {'consultada_em': hoje.isoformat(), 'pendencias': None}
    if not pdf_b64:
        return bloco, 'a resposta não trouxe o PDF do relatório', None
    try:
        conteudo = base64.b64decode(pdf_b64)
    except (ValueError, TypeError):
        return bloco, 'o PDF do relatório veio estragado', None
    guardado = est_mod.guardar_pdf(pasta, f'{doc}-situacao-fiscal-{hoje.isoformat()}.pdf', conteudo)
    bloco['pendencias'] = pdf.ler_situacao(pdf.texto(conteudo))
    if bloco['pendencias'] is None:
        return bloco, f'não consegui ler as pendências no texto do PDF (guardado em {guardado.name})', None
    if len(bloco['pendencias']) > MAX_PENDENCIAS:
        # a lista foi lida: vai, cortada no limite da função do sistema — só o aviso no log
        n = len(bloco['pendencias'])
        bloco['pendencias'] = bloco['pendencias'][:MAX_PENDENCIAS]
        return bloco, None, f'{n} pendências no relatório: vão as {MAX_PENDENCIAS} primeiras (o PDF ficou em {guardado.name})'
    return bloco, None, None
