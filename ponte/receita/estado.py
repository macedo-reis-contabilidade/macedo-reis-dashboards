"""O que a ponte da Receita lembra de uma rodada pra outra, em C:\\ponte-dominio\\receita\\:

    estado.json             o que já foi consultado e mandado: a última autorização de cada empresa, os meses
                            declarados no PGDAS, a declaração já lida de cada mês, a última data de novidade na
                            Caixa Postal e as mensagens já mandadas (pelo id), e a data da última consulta da
                            autorização, do PGDAS e da situação fiscal (o calendário "a partir do dia")
    chamadas-AAAA-MM.json   quantas chamadas ao Serpro no mês, por serviço — o teto_mes
    pdfs\\                   os PDFs da declaração e da situação fiscal (apagados depois de 30 dias)

Nada disso sai do PC nem entra no repositório.
"""
import datetime
import json
import os
import pathlib

DIAS_PDF = 30
MENSAGENS_POR_EMPRESA = 500   # as últimas, pra não crescer pra sempre


def pasta_receita(base):
    p = pathlib.Path(base) / 'receita'
    p.mkdir(parents=True, exist_ok=True)
    return p


def _ler_json(arq, padrao):
    try:
        return json.loads(arq.read_text(encoding='utf-8'))
    except (FileNotFoundError, json.JSONDecodeError, UnicodeDecodeError):
        return padrao


def _gravar_json(arq, dados):
    tmp = arq.with_suffix('.tmp')
    tmp.write_text(json.dumps(dados, ensure_ascii=False, indent=1), encoding='utf-8')
    os.replace(tmp, arq)


class Estado:
    VAZIO = {'autorizacao': {}, 'pgdas_meses': {}, 'pgdas_consultado': {}, 'declaracoes_lidas': {}, 'eventos': {},
             'mensagens': {}, 'situacao_fiscal': {}}

    def __init__(self, pasta, gravar=True):
        self.arq = pasta / 'estado.json'
        self.gravar_no_fim = gravar
        lido = _ler_json(self.arq, {})
        self.d = {k: dict(lido.get(k) or {}) for k in self.VAZIO}

    # — autorização
    def guardar_autorizacao(self, doc, bloco, hoje):
        self.d['autorizacao'][doc] = {'consultada_em': hoje.isoformat(), **bloco}

    # — a data da última consulta (o calendário "a partir do dia")
    def consultada_em(self, servico, doc):
        if servico == 'autorizacao':
            return (self.d['autorizacao'].get(doc) or {}).get('consultada_em')
        if servico == 'pgdas':
            return self.d['pgdas_consultado'].get(doc)
        if servico == 'situacao_fiscal':
            return self.d['situacao_fiscal'].get(doc)
        return None

    def marcar_consulta(self, servico, doc, hoje, situacao=None):
        """A consulta foi feita hoje (o Serpro respondeu, mesmo que com recusa, ou a autorização de hoje já disse que
        não há procuração): não roda de novo até o próximo dia marcado. Na autorização que não veio, a `situacao` diz o
        que lembrar ('sem' = a segunda-feira seguinte consulta de novo)."""
        if servico == 'autorizacao':
            antes = self.d['autorizacao'].get(doc) or {}
            self.d['autorizacao'][doc] = {**antes, 'consultada_em': hoje.isoformat(),
                                          **({'situacao': situacao} if situacao else {})}
        elif servico == 'pgdas':
            self.d['pgdas_consultado'][doc] = hoje.isoformat()
        elif servico == 'situacao_fiscal':
            self.d['situacao_fiscal'][doc] = hoje.isoformat()

    def sem_autorizacao(self, doc, hoje):
        """A última consulta disse sem procuração, ou vencida (ou ela venceu desde então)."""
        a = self.d['autorizacao'].get(doc) or {}
        ate = a.get('valida_ate')
        return a.get('situacao') in ('sem', 'vencida') or bool(ate and str(ate) < hoje.isoformat())

    # — PGDAS e a declaração de cada mês
    def meses_declarados(self, doc):
        return {m['competencia']: m.get('transmitida_em') for m in self.d['pgdas_meses'].get(doc, [])}

    def guardar_meses(self, doc, meses):
        atuais = {m['competencia']: m for m in self.d['pgdas_meses'].get(doc, [])}
        for m in meses:
            atuais[m['competencia']] = {'competencia': m['competencia'], 'transmitida_em': m.get('transmitida_em')}
        self.d['pgdas_meses'][doc] = sorted(atuais.values(), key=lambda m: m['competencia'])

    def declaracao_lida(self, doc, competencia):
        return self.d['declaracoes_lidas'].get(doc, {}).get(competencia)

    def declaracoes_lidas(self, doc):
        """{competência: a transmissão que foi lida}."""
        return dict(self.d['declaracoes_lidas'].get(doc, {}))

    def guardar_declaracao_lida(self, doc, competencia, transmitida_em):
        self.d['declaracoes_lidas'].setdefault(doc, {})[competencia] = transmitida_em

    # — Caixa Postal
    def ultimo_evento(self, doc):
        return self.d['eventos'].get(doc)

    def guardar_evento(self, doc, data):
        self.d['eventos'][doc] = data

    def conhece_mensagens(self, doc):
        """Já houve uma leitura da Caixa Postal desta empresa (a primeira só manda as dos últimos 90 dias)."""
        return doc in self.d['mensagens']

    def mensagens_mandadas(self, doc):
        """{id: lida} das mensagens já mandadas — 'antiga' = vista na primeira leitura e deixada no e-CAC."""
        bruto = self.d['mensagens'].get(doc, {})
        if isinstance(bruto, list):                    # o formato de antes: só os ids
            return {str(i): None for i in bruto}
        return {str(k): v for k, v in bruto.items()} if isinstance(bruto, dict) else {}

    def guardar_mensagens(self, doc, vistas):
        """vistas: [(id, lida | 'antiga')] — as últimas MENSAGENS_POR_EMPRESA, pra não crescer pra sempre."""
        atuais = self.mensagens_mandadas(doc)
        for i, lida in vistas:
            atuais.pop(i, None)
            atuais[i] = lida
        self.d['mensagens'][doc] = dict(list(atuais.items())[-MENSAGENS_POR_EMPRESA:])

    def gravar(self):
        if self.gravar_no_fim:
            _gravar_json(self.arq, self.d)


class Contador:
    """As chamadas ao Serpro no mês, por serviço. Demonstração e --falso não contam (contar=False)."""

    def __init__(self, pasta, hoje, teto, contar=True):
        self.arq = pasta / f'chamadas-{hoje:%Y-%m}.json'
        self.teto = teto
        self.contar = contar
        self.d = _ler_json(self.arq, {}) if contar else {}

    def total(self):
        return sum(int(v) for v in self.d.values() if isinstance(v, int))

    def acabou(self):
        return self.contar and self.total() >= self.teto

    def somar(self, servico):
        if not self.contar:
            return
        self.d[servico] = int(self.d.get(servico, 0)) + 1
        _gravar_json(self.arq, self.d)


def pasta_pdfs(pasta):
    p = pasta / 'pdfs'
    p.mkdir(parents=True, exist_ok=True)
    return p


def guardar_pdf(pasta, nome, conteudo):
    destino = pasta_pdfs(pasta) / nome
    destino.write_bytes(conteudo)
    return destino


def apagar_pdfs_velhos(pasta, registro, dias=DIAS_PDF):
    p = pasta / 'pdfs'
    if not p.is_dir():
        return
    limite = datetime.datetime.now().timestamp() - dias * 86400
    apagados = 0
    for arq in p.glob('*.pdf'):
        try:
            if arq.stat().st_mtime < limite:
                arq.unlink()
                apagados += 1
        except OSError as e:
            registro(f'receita: não consegui apagar o PDF antigo {arq.name}: {type(e).__name__}', 'aviso')
    if apagados:
        registro(f'receita: {apagados} PDF(s) de mais de {dias} dias apagado(s)')
