"""A conversa da ponte das notas com a função `ponte` do sistema: a lista das empresas autorizadas e o envio de cada
pacote (os cabeçalhos, as tentativas e o "sem seguir redirecionamento" do ponte/envio.py, SEM os pendentes: o que não
foi vai na próxima rodada pelo estado).

    {"versao": 1, "tipo": "notas", "pedir": "autorizadas"} → 200 {"empresas": [{codigo, documento, desde, pronta}]}
    o pacote de uma empresa → 200 {"ok": true, "notas": N, "mandadas": N, "itens_fora": N, "recusadas": [{chave, campo, erro}]}
                              403 a empresa não está autorizada · 422 o pacote fora do contrato (não repete)
                              503 "O destino das notas ainda não foi configurado no sistema." (não repete; para a rodada)
                              502 o destino não recebeu agora, outros 5xx, tempo esgotado, rede fora (as tentativas)
                              401 e o 503 da chave da ponte: como no ponte/envio.py
"""
import datetime
import http.client
import json
import os
import re
import time
import urllib.error
import urllib.request

from .. import envio
from ..receita.sistema import EnvioReceita, erro_da_resposta, sem_chave

SEM_DESTINO = 'O destino das notas ainda não foi configurado no sistema.'


class _SemRedirecionar(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


_ABRIR = urllib.request.build_opener(_SemRedirecionar())


def _data(v):
    try:
        return datetime.date.fromisoformat(str(v or '')[:10])
    except ValueError:
        return None


def pedir_autorizadas(cfg, reg):
    """([{codigo, documento, desde (date), pronta}], None) — ou (None, status HTTP ou None), com o porquê no log."""
    chave = cfg.valor('sistema', 'chave_publica')
    cab = {'apikey': chave, 'Authorization': f'Bearer {chave}', 'x-chave': cfg.valor('sistema', 'chave_ponte'),
           'Content-Type': 'application/json'}
    corpo = json.dumps({'versao': 1, 'tipo': 'notas', 'pedir': 'autorizadas'}).encode('utf-8')
    try:
        req = urllib.request.Request(cfg.valor('sistema', 'url'), data=corpo, method='POST', headers=cab)
        with _ABRIR.open(req, timeout=float(os.environ.get('PONTE_TIMEOUT') or 60)) as r:
            resposta = json.loads(r.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        try:
            detalhe = erro_da_resposta(e.read(2000))
        except Exception:
            detalhe = ''
        reg(f'notas: o sistema não deu a lista das empresas autorizadas (HTTP {e.code}'
            + (f' — {detalhe}' if detalhe else '') + ')', 'erro')
        return None, e.code
    except (urllib.error.URLError, http.client.HTTPException, OSError, ValueError) as e:
        reg(f'notas: o sistema não deu a lista das empresas autorizadas ({type(getattr(e, "reason", e)).__name__})', 'erro')
        return None, None
    lista, vistos, fora = [], set(), 0
    for e in (resposta.get('empresas') if isinstance(resposta, dict) else None) or []:
        if not isinstance(e, dict):
            fora += 1
            continue
        codigo = e.get('codigo')
        doc = re.sub(r'[^0-9A-Z]', '', str(e.get('documento') or '').upper())
        desde = _data(e.get('desde'))
        if not isinstance(codigo, int) or isinstance(codigo, bool) or codigo < 1 or len(doc) not in (11, 14) \
                or desde is None or codigo in vistos:
            fora += 1
            continue
        vistos.add(codigo)
        lista.append({'codigo': codigo, 'documento': doc, 'desde': desde, 'pronta': e.get('pronta') is True})
    if fora:
        reg(f'notas: {fora} empresa(s) da lista fora do formato ou repetida(s) ficaram de fora', 'aviso')
    return lista, None


class EnvioNotas(EnvioReceita):
    """O envio da Receita (a resposta lida, o 503 da chave sem insistir), sem insistir também no 503 do destino não
    configurado; a resposta fica em `ultima_resposta` pra rodada anotar (nada dela vai pro log aqui)."""

    def __init__(self, *a, **k):
        super().__init__(*a, **k)
        self.sem_destino = False

    def anotar_resposta(self, rotulo):
        pass

    def mandar(self, corpo, rotulo):
        esperas = envio._esperas()
        for tentativa in range(len(esperas) + 1):
            resultado, status, detalhe = self.uma_vez(corpo)
            self.ultimo_status = status
            quem = f'{rotulo}: ' + (f'HTTP {status}' if status else 'sem resposta') + (f' — {detalhe}' if detalhe else '')
            if resultado == envio.FOI:
                self.registro(f'{rotulo}: foi (HTTP {status})')
                return envio.FOI
            if resultado == envio.RECUSADO:
                extra = ' — confira a [sistema] chave_ponte (py -3 -m ponte chave mostra a impressão digital)' \
                    if status == 401 else ''
                self.registro(f'{quem} — não repito{extra}', 'erro')
                return envio.RECUSADO
            if resultado == envio.CONFIG:
                self.registro(f'{quem} — não adianta repetir até acertar o config.ini', 'erro')
                return envio.CONFIG
            if status == 503 and detalhe == SEM_DESTINO:
                self.sem_destino = True
                self.registro(f'{quem} — as notas param nesta rodada; nada fica como mandado', 'erro')
                return envio.FALHOU
            if sem_chave(status, detalhe):
                self.chave_nao_cadastrada = True
                self.registro(f'{quem} — mande a impressão digital da chave (py -3 -m ponte chave mostra) pro Claude da '
                              f'sessão do Samuel; até lá o sistema não recebe nada', 'erro')
                return envio.FALHOU
            if tentativa < len(esperas):
                self.registro(f'{quem} — tento de novo em {esperas[tentativa]:g} s', 'aviso')
                time.sleep(esperas[tentativa])
            else:
                self.registro(f'{quem} — desisti depois de {len(esperas) + 1} tentativas; vai na próxima rodada', 'erro')
        return envio.FALHOU
