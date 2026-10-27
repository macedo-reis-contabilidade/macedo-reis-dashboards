"""A conversa com a função do sistema (a `ponte`, a mesma das duas pontes): a lista de empresas, o envio do pacote e o
que a função responde.

    {"versao": 1, "ping": true}                           → 200 {"ok": true, "ponte": "ok"}
    {"versao": 1, "tipo": "receita", "pedir": "empresas"} → 200 {"empresas": [{"documento", "regime"}]}
    o pacote                                              → 200 {"ok": true, "gravado": true|false, "empresas": N,
                                                                 "sem_cadastro": N, "recusadas": [{documento, campo, erro}]}
    a chave da ponte não cadastrada no sistema            → 503 {"erro": "A chave da ponte ainda não foi cadastrada no sistema."}
    a chave errada                                        → 401 {"erro": "Chave da ponte recusada."}
    o pacote fora do contrato no que é da rodada          → 422 {"erro": "..."}

O envio é o do Domínio (ponte/envio.py: os cabeçalhos, as novas tentativas, os pendentes), com três diferenças:
o `erro` da resposta vai pro log como veio (no lugar do corpo cru); o 503 da chave não cadastrada não é tentado de
novo (não é o sistema fora: até a impressão digital ser cadastrada a resposta é a mesma) — o pacote fica em
pendentes; e as `recusadas` do 200 vão pro log — o CNPJ, o campo e o erro, nunca o valor —, sem reenviar o bloco (o
mesmo dado voltaria fora).
"""
import http.client
import json
import os
import re
import time
import urllib.error
import urllib.request

from .. import envio

SEM_CHAVE = 'A chave da ponte ainda não foi cadastrada no sistema.'
RECUSADA = 'Chave da ponte recusada.'
MAX_RECUSADAS_NO_LOG = 30
REGIMES = ('simples', 'mei', 'presumido', 'real')


def erro_da_resposta(bruto):
    """O `erro` do corpo JSON da função (uma linha, até 300 caracteres) — ou o corpo cru, se não for o JSON dela."""
    try:
        texto = bruto.decode('utf-8', 'replace') if isinstance(bruto, bytes) else str(bruto or '')
    except Exception:
        return ''
    try:
        obj = json.loads(texto)
        if isinstance(obj, dict) and obj.get('erro'):
            texto = str(obj['erro'])
    except (ValueError, TypeError):
        pass
    return re.sub(r'\s+', ' ', texto).strip()[:300]


def sem_chave(status, detalhe):
    return status == 503 and detalhe == SEM_CHAVE


def _curto(campo, n=120):
    """'empresas[3].caixa_postal.mensagens[2].enviada_em' → 'caixa_postal.mensagens[2].enviada_em'."""
    return re.sub(r'^empresas\[\d+\]\.', '', re.sub(r'\s+', ' ', str(campo or ''))).strip()[:n]


class _SemRedirecionar(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


_ABRIR = urllib.request.build_opener(_SemRedirecionar())


class EnvioReceita(envio.Envio):
    """O envio do Domínio, lendo a resposta da função (o `erro`, as `recusadas`, o `gravado`)."""

    def __init__(self, *a, **k):
        super().__init__(*a, **k)
        self.ultima_resposta = None
        self.chave_nao_cadastrada = False

    def uma_vez(self, corpo):
        self.ultima_resposta = None
        try:
            req = urllib.request.Request(self.url, data=corpo, method='POST', headers=self.cabecalhos)
            with _ABRIR.open(req, timeout=envio._timeout()) as r:
                status, bruto = r.status, r.read(1024 * 1024)
            try:
                obj = json.loads(bruto.decode('utf-8'))
                self.ultima_resposta = obj if isinstance(obj, dict) else None
            except (ValueError, UnicodeDecodeError):
                self.ultima_resposta = None
            return envio.FOI, status, ''
        except ValueError as e:
            return envio.CONFIG, None, f'a configuração não deixa mandar ({type(e).__name__})'
        except urllib.error.HTTPError as e:
            try:
                detalhe = erro_da_resposta(e.read(2000))
            except Exception:
                detalhe = ''
            if 300 <= e.code < 400:
                return envio.CONFIG, e.code, 'o endereço redireciona pra outro lugar — confira a [sistema] url'
            if 400 <= e.code < 500:
                return envio.RECUSADO, e.code, detalhe
            return envio.FALHOU, e.code, detalhe
        except (urllib.error.URLError, http.client.HTTPException, OSError) as e:
            razao = getattr(e, 'reason', e)
            return envio.FALHOU, None, type(razao).__name__ if not isinstance(razao, str) else razao

    def mandar(self, corpo, rotulo):
        """O mandar do Domínio, sem insistir no 503 da chave não cadastrada e anotando o que a função respondeu."""
        esperas = envio._esperas()
        for tentativa in range(len(esperas) + 1):
            resultado, status, detalhe = self.uma_vez(corpo)
            self.ultimo_status = status
            quem = f'{rotulo}: ' + (f'HTTP {status}' if status else 'sem resposta') + (f' — {detalhe}' if detalhe else '')
            if resultado == envio.FOI:
                self.registro(f'{rotulo}: foi (HTTP {status})')
                self.anotar_resposta(rotulo)
                return envio.FOI
            if resultado == envio.RECUSADO:
                extra = ' — confira a [sistema] chave_ponte (py -3 -m ponte chave mostra a impressão digital)' \
                    if status in (401, 403) else ''
                self.registro(f'{quem} — o sistema recusou; não adianta repetir{extra}', 'erro')
                return envio.RECUSADO
            if resultado == envio.CONFIG:
                self.registro(f'{quem} — não adianta repetir até acertar o config.ini', 'erro')
                return envio.CONFIG
            if sem_chave(status, detalhe):
                self.chave_nao_cadastrada = True
                self.registro(f'{quem} — mande a impressão digital da chave (py -3 -m ponte chave mostra) pro Claude da '
                              f'sessão do Samuel; até lá o sistema não recebe nada', 'erro')
                return envio.FALHOU
            if tentativa < len(esperas):
                self.registro(f'{quem} — tento de novo em {esperas[tentativa]:g} s', 'aviso')
                time.sleep(esperas[tentativa])
            else:
                self.registro(f'{quem} — desisti depois de {len(esperas) + 1} tentativas', 'erro')
        return envio.FALHOU

    def anotar_resposta(self, rotulo):
        r = self.ultima_resposta
        if not isinstance(r, dict):
            return
        if r.get('gravado') is False:
            self.registro(f'{rotulo}: o sistema recebeu e não gravou ({r.get("motivo") or "ambiente que não é o de produção"})')
        partes = []
        for chave, nome in (('empresas', 'empresa(s) gravada(s)'), ('sem_cadastro', 'sem cadastro no sistema')):
            if isinstance(r.get(chave), int) and not isinstance(r.get(chave), bool):
                partes.append(f'{r[chave]} {nome}')
        if partes and r.get('gravado') is not False:
            self.registro(f'{rotulo}: ' + ', '.join(partes))
        recusadas = [x for x in (r.get('recusadas') or []) if isinstance(x, dict)]
        if not recusadas:
            return
        self.registro(f'{rotulo}: o sistema deixou de fora {len(recusadas)} bloco(s) fora do contrato (o resto foi '
                      f'gravado); não reenvio — o mesmo dado voltaria fora', 'aviso')
        for x in recusadas[:MAX_RECUSADAS_NO_LOG]:
            doc = re.sub(r'[^0-9A-Za-z]', '', str(x.get('documento') or ''))[:14] or 'sem documento'
            erro = re.sub(r'\s+', ' ', str(x.get('erro') or '')).strip()[:200]
            self.registro(f'  {doc}: {_curto(x.get("campo"))} — {erro}', 'aviso')
        if len(recusadas) > MAX_RECUSADAS_NO_LOG:
            self.registro(f'  e mais {len(recusadas) - MAX_RECUSADAS_NO_LOG}', 'aviso')


def pedir_empresas(cfg, reg):
    """A lista de empresas vem do sistema: ([{documento, regime}], None) — ou (None, status HTTP ou None), com o
    porquê no log."""
    url = cfg.valor('sistema', 'url')
    chave = cfg.valor('sistema', 'chave_publica')
    cab = {'apikey': chave, 'Authorization': f'Bearer {chave}', 'x-chave': cfg.valor('sistema', 'chave_ponte'),
           'Content-Type': 'application/json'}
    corpo = json.dumps({'versao': 1, 'tipo': 'receita', 'pedir': 'empresas'}).encode('utf-8')
    try:
        req = urllib.request.Request(url, data=corpo, method='POST', headers=cab)
        with _ABRIR.open(req, timeout=float(os.environ.get('PONTE_TIMEOUT') or 60)) as r:
            resposta = json.loads(r.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        try:
            detalhe = erro_da_resposta(e.read(2000))
        except Exception:
            detalhe = ''
        if e.code == 404:
            extra = ' — a função do sistema ainda não foi publicada'
        elif sem_chave(e.code, detalhe):
            extra = ' — mande a impressão digital da chave (py -3 -m ponte chave mostra) pro Claude da sessão do Samuel'
        elif e.code in (401, 403):
            extra = ' — confira a [sistema] chave_ponte (py -3 -m ponte chave mostra a impressão digital)'
        else:
            extra = ''
        reg(f'receita: o sistema não deu a lista de empresas (HTTP {e.code}' + (f' — {detalhe}' if detalhe else '')
            + f'){extra}', 'erro')
        return None, e.code
    except (urllib.error.URLError, http.client.HTTPException, OSError, ValueError) as e:
        reg(f'receita: o sistema não deu a lista de empresas ({type(getattr(e, "reason", e)).__name__})', 'erro')
        return None, None
    lista, vistos, fora = [], set(), 0
    for e in (resposta.get('empresas') if isinstance(resposta, dict) else None) or []:
        doc = re.sub(r'[./\s-]', '', str(e.get('documento') if isinstance(e, dict) else '')).upper()
        if not re.fullmatch(r'[0-9]{11}|[0-9A-Z]{12}[0-9]{2}', doc) or doc in vistos:
            fora += 1
            continue
        vistos.add(doc)
        regime = str(e.get('regime') or '').lower()
        lista.append({'documento': doc, 'regime': regime if regime in REGIMES else None})
    if fora:
        reg(f'receita: {fora} empresa(s) da lista sem documento válido ou repetida(s) ficaram de fora', 'aviso')
    return lista, None
