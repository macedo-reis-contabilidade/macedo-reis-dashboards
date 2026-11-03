"""O que cada consulta ao Serpro vira no pacote (o contrato em pacote.py).

    autorizacao      PROCURACOES · OBTERPROCURACAO41 — até quando o cliente autorizou o escritório (ou, sem essa, o
                     procurador: a procuração pro CPF dele, conferida em nome dele)
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

O autor (03/11/2026, o Autentica Procurador — procurador.py): cada consulta vai em nome do escritório (autor=None) ou
do procurador (autor='procurador': o CPF dele e o token do termo de autorização), conforme de quem é a procuração que
a empresa deu. Sem o token do procurador nesta rodada, a consulta em nome dele vira Falta('erro', procurador=True), sem
chamar o Serpro e sem contar como feita — volta na próxima rodada.
"""
import base64
import datetime
import json
import re

from . import calendario, estado as est_mod, pdf
from .serpro import ProcuradorIndisponivel, SerproFora

EVENTO_CAIXA_POSTAL = 'E0601'      # o E0301 do cenário de demonstração é o da DCTFWeb
LOTE_EVENTOS = 1000
MAX_MENSAGENS = 100                # por empresa num pacote (as mais recentes)
DIAS_PRIMEIRA = 90                 # na primeira leitura da empresa, só as enviadas nesses dias
MAX_PENDENCIAS = 100               # por empresa (o limite da função do sistema)
ORIGEM = {'1': 'Receita', '2': 'Estado', '3': 'Município'}
# a versão do SITFIS: a 1.0 foi desligada pela Receita (03/11/2026, na primeira rodada de produção: "[EntradaIncorreta-
# Sitfis-EI03] Requisição inválida. Versão Descontinuada."); a 2.0 é a da documentação do Serpro, com o mesmo pedido
# e a mesma resposta (protocoloRelatorio, tempoEspera, pdf)
VERSAO_SITFIS = '2.0'
# o ponteiro da página da lista de mensagens: a documentação do Serpro (e o cenário de demonstração) diz 14 dígitos, mas
# a produção recusa (03/11/2026, na rodada da Caixa Postal: "EntradaIncorreta-CAIXAPOSTAL-0C Erro de validação. | O
# campo ponteiroPagina deve conter somente dígitos e ter tamanho igual a 24"). Na página inicial ele não é usado: vão
# 24 zeros; se a Receita recusar o ponteiro de novo, a mesma consulta vai sem ele (a documentação diz que ele só é
# preciso na página não inicial), e assim segue até o fim da rodada
PONTEIRO_INICIAL = '0' * 24


class Falta(Exception):
    def __init__(self, motivo, detalhe='', feita=True, procurador=False):
        super().__init__(motivo)
        self.motivo = motivo
        self.detalhe = detalhe
        self.feita = feita              # o Serpro respondeu (a consulta conta como feita no calendário)
        self.procurador = procurador    # faltou o token do procurador (o log diz uma vez, não uma por empresa)


def consultar(cli, endpoint, sistema, servico, contribuinte, dados, versao='1.0', tipo=None, autor=None):
    if cli.contador.acabou():
        raise Falta('teto', 'o teto de chamadas do mês chegou', feita=False)
    try:
        return cli.chamar(endpoint, sistema, servico, contribuinte, dados, versao, tipo, autor=autor)
    except SerproFora as e:
        raise Falta('erro', str(e), feita=False)
    except ProcuradorIndisponivel as e:
        raise Falta('erro', f'sem o procurador nesta rodada: {e}', feita=False, procurador=True)


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

def _procuracao(cli, doc, outorgado, tipo_outorgado, hoje, autor=None):
    """A procuração da empresa pra um outorgado (o CNPJ do escritório, tipo '2', ou o CPF do procurador, tipo '1')."""
    r = consultar(cli, 'Consultar', 'PROCURACOES', 'OBTERPROCURACAO41', doc,
                  {'outorgante': doc, 'tipoOutorgante': _tipo_doc(doc), 'outorgado': outorgado,
                   'tipoOutorgado': tipo_outorgado}, versao='1', autor=autor)
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


def autorizacao(cli, empresa, hoje):
    """A procuração da empresa pro escritório (o CNPJ) e, sem ela ativa e com o procurador configurado, a pro CPF do
    procurador — conferida em nome dele (só o próprio procurador vê as procurações que recebeu). Vale a ativa (a do
    escritório primeiro); senão a vencida mais recente; senão "sem". A que vem do CPF leva via 'procurador': o estado
    guarda, e as outras consultas da empresa vão em nome dele (o pacote não leva o via)."""
    doc = empresa['documento']
    negado = None
    try:
        escritorio = _procuracao(cli, doc, cli.cnpj, '2', hoje)
    except Falta as f:
        if f.motivo != 'sem_autorizacao' or not cli.tem_procurador():
            raise
        negado, escritorio = f, None                              # o acesso negado pro escritório: o CPF ainda pode ter
    if not cli.tem_procurador() or (escritorio and escritorio['situacao'] == 'ativa'):
        return escritorio
    try:
        pelo_cpf = _procuracao(cli, doc, cli.procurador_cpf, '1', hoje, autor='procurador')
    except Falta as f:
        if f.motivo == 'sem_autorizacao':
            # o acesso negado em nome do procurador não diz que a empresa não tem a procuração (o token não valeu):
            # a autorização dela fica sem resposta nesta rodada
            raise Falta('erro', 'a procuração pro CPF do procurador não pôde ser conferida: '
                        + (f.detalhe or 'acesso negado'), feita=f.feita)
        if f.procurador:
            # sem o token do procurador nesta rodada (o e-CPF vencido ou de outro CPF, a senha errada, o termo recusado):
            # a parte do escritório já foi respondida — a autorização conta como feita e volta no próximo dia marcado,
            # com o estado como estava. Sem isso, enquanto o procurador não fosse acertado, a consulta do escritório se
            # repetiria em toda rodada, uma chamada paga por empresa (80 por dia), e o teto do mês acabaria
            raise Falta('erro', f.detalhe, feita=True, procurador=True)
        raise
    pelo_cpf = dict(pelo_cpf, via='procurador')
    if pelo_cpf['situacao'] == 'ativa':
        return pelo_cpf
    vencidas = [b for b in (escritorio, pelo_cpf) if b and b['situacao'] == 'vencida']
    if vencidas:
        return max(vencidas, key=lambda b: b['valida_ate'] or '')
    if escritorio is None:
        raise negado
    return escritorio


# ---------------------------------------------------------------- PGDAS-D

def pgdas(cli, empresa, hoje, autor=None):
    doc = empresa['documento']
    meses, anos = {}, []
    for ano in calendario.anos_do_pgdas(hoje):
        r = consultar(cli, 'Consultar', 'PGDASD', 'CONSDECLARACAO13', doc, {'anoCalendario': str(ano)}, autor=autor)
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


def mes_a_ler(meses, estado, doc, tentar_de_novo=False):
    """O mês cuja declaração ler agora (um por rodada):
      1. o MAIS ANTIGO dos que vieram depois do último lido — nenhum mês fica pra trás quando o de antes não veio;
      2. senão, o mais novo dos já lidos que foram retificados (a transmissão mudou);
      3. senão, e só no dia do pgdas (tentar_de_novo), o mais novo dos tentados sem resposta boa (o PDF ilegível, a recusa):
         eles não são pedidos todo dia — custaria uma chamada por dia com a mesma resposta.
    Na primeira vez (nada lido), só o mês mais recente — o ano pra trás não é lido um a um."""
    lidas, tentadas = estado.declaracoes_lidas(doc), estado.declaracoes_tentadas(doc)
    comp = lambda m: m['competencia']                                                     # noqa: E731
    com = [m for m in meses if m.get('transmitida_em') and lidas.get(m['competencia']) != m['transmitida_em']]
    novas = [m for m in com if tentadas.get(m['competencia']) != m['transmitida_em']]
    if not lidas:
        # a primeira vez: o mais recente (o tentado sem resposta boa espera o dia do pgdas — não lê o de antes no lugar)
        if com:
            m = max(com, key=comp)
            if tentar_de_novo or tentadas.get(m['competencia']) != m['transmitida_em']:
                return m
        return None
    else:
        ultimo = max(lidas)
        depois = [m for m in novas if m['competencia'] > ultimo and m['competencia'] not in lidas]
        if depois:
            return min(depois, key=comp)
        retificadas = [m for m in novas if m['competencia'] in lidas]
        if retificadas:
            return max(retificadas, key=comp)
    if tentar_de_novo:
        de_novo = [m for m in com if tentadas.get(m['competencia']) == m['transmitida_em']]
        if de_novo:
            return max(de_novo, key=comp)
    return None


def faturamento(cli, empresa, mes, pasta, autor=None):
    doc = empresa['documento']
    r = consultar(cli, 'Consultar', 'PGDASD', 'CONSULTIMADECREC14', doc,
                  {'periodoApuracao': mes['competencia'].replace('-', '')}, autor=autor)
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

def _json_fundo(valor, camadas=3):
    """O 'dados' é um JSON dentro de um texto — às vezes em mais de uma camada (o texto com o texto do JSON dentro):
    desembrulha até achar o que não é texto, ou até o texto não ser JSON."""
    for _ in range(camadas):
        if not isinstance(valor, str):
            break
        try:
            valor = json.loads(valor)
        except ValueError:
            break
    return valor


def _numero(valor, padrao):
    try:
        n = int(float(valor))
        return n if n >= 0 else padrao
    except (TypeError, ValueError):
        return padrao


def _protocolo(r):
    """O pedido de eventos devolve {"protocolo", "TempoEsperaMedioEmMs", "TempoLimiteEmMin"} no 'dados' — que pode vir
    em mais de uma camada de texto, com a chave em outra caixa, ou (no próprio exemplo do Serpro) sem a chave de fechar:
    lê o objeto e, não dando, os dois campos pelo texto, sem as barras do escape."""
    d = _json_fundo(r.dados_texto)
    if isinstance(d, dict):
        campos = {str(k).lower(): v for k, v in d.items()}
        if campos.get('protocolo'):
            return str(campos['protocolo']), _numero(campos.get('tempoesperamedioemms'), 1000)
    txt = d if isinstance(d, str) else (r.dados_texto if isinstance(r.dados_texto, str) else '')
    txt = txt.replace('\\"', '"')
    p = re.search(r'"protocolo"\s*:\s*"([^"]+)"', txt, re.I)
    t = re.search(r'"TempoEsperaMedioEmMs"\s*:\s*"?(\d+)', txt, re.I)
    return (p.group(1) if p else None), (int(t.group(1)) if t else 1000)


def _forma(valor):
    """Como o 'dados' veio, sem o conteúdo (pro log quando falta o que se esperava): vazio, as chaves do objeto, o
    tamanho da lista ou do texto. As chaves são nomes de campo do Serpro, não dado de cliente."""
    v = _json_fundo(valor)
    if v is None or v == '':
        return 'dados vazio'
    if isinstance(v, dict):
        return 'dados com as chaves ' + ', '.join(sorted(str(k) for k in v))[:150]
    if isinstance(v, list):
        return f'dados com uma lista de {len(v)} item(ns)'
    return f'dados em texto de {len(str(v))} caractere(s)'


def eventos_caixa_postal(cli, docs, autor=None):
    """{cnpj: 'AAMMDD' (data da última novidade, até 60 dias) | '' (nenhuma) | 'x' (sem autorização)} — em lote, todos
    do mesmo autor (o pedido e a resposta do lote vão com ele: o serviço só responde de quem deu a procuração a ele)."""
    resultado = {}
    for i in range(0, len(docs), LOTE_EVENTOS):
        lote = docs[i:i + LOTE_EVENTOS]
        r = consultar(cli, 'Monitorar', 'EVENTOSATUALIZACAO', 'SOLICEVENTOSPJ132', ','.join(lote),
                      {'evento': EVENTO_CAIXA_POSTAL}, tipo=4, autor=autor)
        _conferir_resposta(r)
        protocolo, espera = _protocolo(r)
        if not protocolo:
            raise Falta('erro', f'o pedido de eventos não devolveu o protocolo (HTTP {r.http_status}; '
                                f'{r.resumo() or "sem mensagem"}; {_forma(r.dados_texto)})')
        cli.esperar(espera)
        r2 = consultar(cli, 'Monitorar', 'EVENTOSATUALIZACAO', 'OBTEREVENTOSPJ134', '',
                       {'protocolo': protocolo, 'evento': EVENTO_CAIXA_POSTAL}, tipo=4, autor=autor)
        _conferir_resposta(r2)
        for linha in r2.dados() or []:
            if isinstance(linha, list) and len(linha) >= 2:
                # o CNPJ alfanumérico (desde julho/2026) volta com as letras: só a pontuação sai
                resultado[re.sub(r'[^0-9A-Za-z]', '', str(linha[0])).upper()] = str(linha[1] or '').strip()
    return resultado


def _origem(m):
    o = ORIGEM.get(str(m.get('tipoOrigem') or '').strip())
    if o:
        return o
    descricao = str(m.get('descricaoOrigem') or '').upper()
    return 'Receita' if 'RECEITA' in descricao else None


def mensagens(cli, empresa, estado, hoje, autor=None):
    """As mensagens a mandar (o bloco) e o que lembrar delas ([(id, lida | 'antiga')]).

    Vai: a que nunca foi mandada e a mandada como não lida que agora aparece lida (o sistema atualiza o "lida" e o
    aviso some). Na primeira leitura da empresa, só as enviadas nos últimos DIAS_PRIMEIRA dias — as antigas ficam no
    e-CAC e são lembradas como 'antiga', pra não irem depois. No máximo MAX_MENSAGENS (as mais recentes) por pacote."""
    doc = empresa['documento']
    pedido = {'statusLeitura': '0', 'indicadorPagina': '0'}
    if not getattr(cli, 'caixa_sem_ponteiro', False):
        r = consultar(cli, 'Consultar', 'CAIXAPOSTAL', 'MSGCONTRIBUINTE61', doc,
                      dict(pedido, ponteiroPagina=PONTEIRO_INICIAL), autor=autor)
        if r.ok() or r.acesso_negado() or 'ponteiropagina' not in (r.resumo() or '').lower():
            pedido = None
        else:
            cli.caixa_sem_ponteiro = True
            cli.registro(f'receita: a lista da Caixa Postal recusou o ponteiro da página ({r.resumo()}) — vai sem ele',
                         'aviso')
    if pedido is not None:
        r = consultar(cli, 'Consultar', 'CAIXAPOSTAL', 'MSGCONTRIBUINTE61', doc, pedido, autor=autor)
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


def situacao_fiscal(cli, empresa, hoje, pasta, tentativas=6, autor=None):
    """(bloco, problema, aviso): problema = o PDF não deu pra ler (o bloco não vai, fica a_conferir); aviso = a lista
    foi lida mas cortada no limite (o bloco vai)."""
    doc = empresa['documento']
    r = consultar(cli, 'Apoiar', 'SITFIS', 'SOLICITARPROTOCOLO91', doc, '', versao=VERSAO_SITFIS, autor=autor)
    _conferir_resposta(r)
    d = r.dados() or {}
    protocolo = d.get('protocoloRelatorio') if isinstance(d, dict) else None
    espera = (d.get('tempoEspera') if isinstance(d, dict) else None) or 4000
    if not protocolo:
        raise Falta('erro', f'o pedido do relatório não devolveu o protocolo (HTTP {r.http_status}; '
                            f'{r.resumo() or "sem mensagem"}; {_forma(r.dados_texto)})')
    pdf_b64 = None
    for _ in range(tentativas):
        cli.esperar(espera)
        r2 = consultar(cli, 'Emitir', 'SITFIS', 'RELATORIOSITFIS92', doc, {'protocoloRelatorio': protocolo},
                       versao=VERSAO_SITFIS, autor=autor)
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
