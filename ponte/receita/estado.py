"""O que a ponte da Receita lembra de uma rodada pra outra, em C:\\ponte-dominio\\receita\\:

    estado.json             o que já foi consultado e mandado: a última autorização de cada empresa (com o via
                            'procurador' quando a procuração é pro CPF do procurador), os meses declarados no PGDAS,
                            a declaração já lida de cada mês, a última data de novidade na Caixa Postal e as
                            mensagens já mandadas (pelo id), e a data da última consulta da autorização, do PGDAS e
                            da situação fiscal (o calendário "a partir do dia")
    chamadas-AAAA-MM.json   quantas chamadas ao Serpro no mês, por serviço — o teto_mes
    pdfs\\                   os PDFs da declaração e da situação fiscal (apagados depois de 30 dias)
    relatorios.json         o dia do último relatório de situação fiscal de cada empresa que foi pro Drive
                            (relatorios.py, 09/11/2026)

Nada disso entra no repositório. Do PC, sai só o PDF do relatório de situação fiscal, pra pasta da empresa no Drive
(relatorios.py); o resto fica aqui.
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
    VAZIO = {'autorizacao': {}, 'pgdas_meses': {}, 'pgdas_consultado': {}, 'declaracoes_lidas': {},
             'declaracoes_tentadas': {}, 'eventos': {}, 'mensagens_lidas_em': {}, 'mensagens': {}, 'situacao_fiscal': {}}

    def __init__(self, pasta, gravar=True):
        self.arq = pasta / 'estado.json'
        self.gravar_no_fim = gravar
        lido = _ler_json(self.arq, {})
        self.d = {k: dict(lido.get(k) or {}) for k in self.VAZIO}
        # a rodada tem o procurador (a rodada diz): sem ele, a empresa autorizada só pro CPF dele está sem autorização
        self.com_procurador = False

    # — autorização
    def guardar_autorizacao(self, doc, bloco, hoje):
        self.d['autorizacao'][doc] = {'consultada_em': hoje.isoformat(), **bloco}

    def via_procurador(self, doc):
        """A última consulta disse ativa pela procuração pro CPF do procurador: as consultas vão em nome dele."""
        a = self.d['autorizacao'].get(doc) or {}
        return a.get('via') == 'procurador' and a.get('situacao') == 'ativa'

    def liberar_consultas(self, doc):
        """A empresa que estava sem a procuração e agora tem: o PGDAS e a situação fiscal marcados como feitos enquanto
        ela estava sem (sem chamar o Serpro) voltam a contar como não feitos, e a declaração tentada sem a procuração,
        como não tentada — assim elas rodam já, e não só no próximo dia marcado."""
        self.d['pgdas_consultado'].pop(doc, None)
        self.d['situacao_fiscal'].pop(doc, None)
        self.d['declaracoes_tentadas'].pop(doc, None)

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
            antes = dict(self.d['autorizacao'].get(doc) or {})
            if situacao:
                antes.pop('via', None)          # a situação nova não é mais a da procuração pro procurador
            self.d['autorizacao'][doc] = {**antes, 'consultada_em': hoje.isoformat(),
                                          **({'situacao': situacao} if situacao else {})}
        elif servico == 'pgdas':
            self.d['pgdas_consultado'][doc] = hoje.isoformat()
        elif servico == 'situacao_fiscal':
            self.d['situacao_fiscal'][doc] = hoje.isoformat()

    def conhece_autorizacao(self, doc):
        """Alguma consulta da autorização já disse a situação da empresa (ativa, vencida ou sem)."""
        return bool((self.d['autorizacao'].get(doc) or {}).get('situacao'))

    def sem_autorizacao(self, doc, hoje):
        """A última consulta disse sem procuração, ou vencida (ou ela venceu desde então) — ou disse ativa só pro CPF do
        procurador e a rodada não tem o procurador (tirado do config.ini): a Receita negaria em nome do escritório."""
        a = self.d['autorizacao'].get(doc) or {}
        ate = a.get('valida_ate')
        if a.get('via') == 'procurador' and not self.com_procurador:
            return True
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
        self.d['declaracoes_tentadas'].get(doc, {}).pop(competencia, None)

    def declaracoes_tentadas(self, doc):
        """{competência: a transmissão} das declarações que o Serpro respondeu sem dar a receita (o PDF ilegível, a
        recusa, o acesso negado): não são pedidas todo dia — voltam só no dia do pgdas."""
        return dict(self.d['declaracoes_tentadas'].get(doc, {}))

    def guardar_declaracao_tentada(self, doc, competencia, transmitida_em):
        self.d['declaracoes_tentadas'].setdefault(doc, {})[competencia] = transmitida_em

    # — Caixa Postal
    def ultimo_evento(self, doc):
        return self.d['eventos'].get(doc)

    def guardar_evento(self, doc, data):
        self.d['eventos'][doc] = data

    def leitura_mensagens(self, doc):
        """O dia da última leitura das mensagens da empresa ('AAAA-MM-DD')."""
        return self.d['mensagens_lidas_em'].get(doc)

    def guardar_leitura_mensagens(self, doc, hoje):
        self.d['mensagens_lidas_em'][doc] = hoje.isoformat()

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
