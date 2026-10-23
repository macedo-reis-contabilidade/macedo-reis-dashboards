"""O envio pro sistema e os pacotes pendentes.

POST na url do [sistema], com os cabeçalhos apikey e Authorization (a chave pública do Supabase) e x-chave (o
segredo da ponte). Respostas:
    2xx                            foi
    4xx                            recusado: não repete (chave errada, pacote inválido — repetir não adianta)
    5xx, tempo esgotado, rede fora tenta de novo 3 vezes, esperando 10 s, 60 s e 5 min; se não for, falhou
    3xx, endereço que não dá pra usar  configuração: não repete e não mexe nos pendentes — redirecionamento NÃO é
                                   seguido (o urllib reenviaria a chave pro outro endereço, e como GET, sem o pacote)

Pacote que falhou vai pra pendentes\\ e é mandado antes, na rodada seguinte, do mais velho pro mais novo. Pendente
com mais de 30 dias é apagado com aviso (a rodada manda os últimos meses de novo de qualquer jeito).

As esperas e o tempo máximo de cada tentativa podem ser encurtados pelas variáveis PONTE_ESPERAS ("10,60,300") e
PONTE_TIMEOUT (60) — é pros testes.
"""
import datetime
import http.client
import json
import os
import pathlib
import re
import time
import urllib.error
import urllib.request

ESPERAS = (10, 60, 300)
TIMEOUT = 60
DIAS_PENDENTE = 30
FOI, RECUSADO, FALHOU, CONFIG = 'foi', 'recusado', 'falhou', 'configuracao'


def _esperas():
    bruto = os.environ.get('PONTE_ESPERAS')
    if not bruto:
        return ESPERAS
    try:
        return tuple(float(x) for x in bruto.split(','))
    except ValueError:
        return ESPERAS


def _timeout():
    try:
        return float(os.environ.get('PONTE_TIMEOUT') or TIMEOUT)
    except ValueError:
        return TIMEOUT


class _SemRedirecionar(urllib.request.HTTPRedirectHandler):
    """3xx não é seguido: volta como HTTPError e vira CONFIG (a url está errada)."""

    def redirect_request(self, *a, **k):
        return None


_ABRIR = urllib.request.build_opener(_SemRedirecionar())


class Envio:
    def __init__(self, url, chave_publica, chave_ponte, registro):
        self.url = url
        self.cabecalhos = {
            'apikey': chave_publica,
            'Authorization': f'Bearer {chave_publica}',
            'x-chave': chave_ponte,
            'Content-Type': 'application/json',
        }
        self.registro = registro
        self.ultimo_status = None

    def uma_vez(self, corpo):
        """Uma tentativa: (FOI | RECUSADO | FALHOU | CONFIG, status ou None, detalhe curto)."""
        try:
            req = urllib.request.Request(self.url, data=corpo, method='POST', headers=self.cabecalhos)
            with _ABRIR.open(req, timeout=_timeout()) as r:
                return FOI, r.status, ''
        except ValueError as e:
            # url ou cabeçalho que não dá pra mandar (a mensagem pode trazer a chave: só o tipo)
            return CONFIG, None, f'a configuração não deixa mandar ({type(e).__name__})'
        except urllib.error.HTTPError as e:
            try:
                detalhe = e.read(300).decode('utf-8', 'replace')
            except Exception:
                detalhe = ''
            detalhe = re.sub(r'\s+', ' ', detalhe).strip()
            if 300 <= e.code < 400:
                return CONFIG, e.code, 'o endereço redireciona pra outro lugar — confira a [sistema] url'
            if 400 <= e.code < 500:
                return RECUSADO, e.code, detalhe
            return FALHOU, e.code, detalhe
        except (urllib.error.URLError, http.client.HTTPException, OSError) as e:   # rede fora, tempo esgotado…
            razao = getattr(e, 'reason', e)
            return FALHOU, None, type(razao).__name__ if not isinstance(razao, str) else razao

    def mandar(self, corpo, rotulo):
        esperas = _esperas()
        for tentativa in range(len(esperas) + 1):
            resultado, status, detalhe = self.uma_vez(corpo)
            self.ultimo_status = status
            quem = f'{rotulo}: ' + (f'HTTP {status}' if status else 'sem resposta') + (f' — {detalhe}' if detalhe else '')
            if resultado == FOI:
                self.registro(f'{rotulo}: foi (HTTP {status})')
                return FOI
            if resultado == RECUSADO:
                self.registro(f'{quem} — o sistema recusou; não adianta repetir', 'erro')
                return RECUSADO
            if resultado == CONFIG:
                self.registro(f'{quem} — não adianta repetir até acertar o config.ini', 'erro')
                return CONFIG
            if tentativa < len(esperas):
                self.registro(f'{quem} — tento de novo em {esperas[tentativa]:g} s', 'aviso')
                time.sleep(esperas[tentativa])
            else:
                self.registro(f'{quem} — desisti depois de {len(esperas) + 1} tentativas', 'erro')
        return FALHOU


# ---------- pendentes ----------

def _nome(pacote):
    """AAAAMMDD-HHMMSS-<começo do id>.json — a ordem do nome é a ordem do tempo."""
    inicio = pacote['rodada']['inicio']
    compacto = re.sub(r'[^0-9]', '', inicio[:19])          # 2026-10-23T07:00:05 -> 20261023070005
    return f'{compacto[:8]}-{compacto[8:14]}-{pacote["rodada"]["id"][:8]}.json'


def guardar(pasta, pacote):
    pasta.mkdir(parents=True, exist_ok=True)
    destino = pasta / _nome(pacote)
    tmp = destino.with_suffix('.tmp')
    tmp.write_text(json.dumps(pacote, ensure_ascii=False), encoding='utf-8')
    os.replace(tmp, destino)
    return destino


def listar(pasta):
    if not pasta.is_dir():
        return []
    return sorted(pasta.glob('*.json'), key=lambda p: p.name)


def _idade_dias(arq):
    try:
        dia = datetime.datetime.strptime(arq.name[:8], '%Y%m%d').date()
    except ValueError:
        dia = datetime.date.fromtimestamp(arq.stat().st_mtime)
    return (datetime.date.today() - dia).days


def apagar_velhos(pasta, registro, dias=DIAS_PENDENTE):
    for arq in listar(pasta):
        idade = _idade_dias(arq)
        if idade > dias:
            arq.unlink()
            registro(f'pendente {arq.name} tinha {idade} dias e foi apagado sem ser mandado '
                     f'(mais de {dias}); os meses dele voltam nas próximas rodadas só se estiverem no --meses', 'aviso')
