"""`py -3 -m ponte entradas rodar` — a data de entrada das NF-e de compra de fora do RS das empresas da SEDIF/DeSTDA
(26/11/2026). Roda também no fim do `py -3 -m ponte rodar` (etapa()), no mesmo modo.

O caso da Thalia: a nota emitida em 30/09 que entrou na empresa em 01/10 a Domínio apura em outubro, e a Conferência
SEDIF/DeSTDA do sistema punha em setembro, pela emissão (o XML só traz a emissão). A ponte pede ao sistema a lista (os
códigos do Domínio das empresas da obrigação SEDIF/DeSTDA e a janela: o mês de hoje e os dois antes), lê de cada uma a
chave e a data de entrada (a do livro) das notas de fora do RS (ponte/consultas/entradas_fora.sql) e manda num pacote; o
sistema grava a data nas notas que já estão na base, e só o que mudou. Sem estado: a janela inteira todo dia.

Só a chave e a data saem do PC: nada da nota nem do fornecedor. A ponte confere cada chave de novo (o dígito
verificador, a NF-e modelo 55, a UF de fora do RS, o emitente que não é pessoa física) e a data (na janela, não antes
do mês da emissão). O contrato: supabase/functions/ponte/entradas.js e docs/FILA-CODE-2026-11-26-ENTRADAS.md.

    --sem-enviar   pede a lista, lê e conta; não manda
    --falso        a Domínio de mentira (o cenário do PONTE_ENTRADAS_FALSO, um JSON); manda só pra um sistema local

O log, por empresa e pelo código (nunca a chave, um CNPJ ou um nome): quantas notas, quantas ficaram de fora e por quê;
e o que o sistema respondeu (recebidas, achadas na base, com a data nova, recusadas com o campo e o erro, sem números).
Código de saída: 0 (foi, ou nada a mandar, ou --sem-enviar) · 1 (a lista não veio, a leitura ou o envio não foi: vai
na próxima rodada, que manda a janela inteira de novo) · 2 (configuração, chave recusada, pacote recusado).
"""
import datetime
import http.client
import json
import os
import pathlib
import re
import socket
import time
import traceback
import urllib.error
import urllib.request
import uuid

from . import VERSAO, config, envio
from .log import Registro

OK, TENTAR_DE_NOVO, NAO_ADIANTA = 0, 1, 2
LIMITE_NOTAS = 20000            # o da função (LIMITES_ENTRADAS.notas): mais que isso, outro pacote
LIMITE_EMPRESAS = 500
UF_RS = '43'
MOTIVOS = {
    'chave': 'com a chave inválida',
    'modelo': 'que não são NF-e (modelo 55)',
    'rs': 'do RS',
    'cpf': 'de emitente pessoa física',
    'data': 'com a data de entrada fora da janela ou antes da emissão',
    'repetida': 'repetidas',
}
_NUMEROS = re.compile(r'[0-9][0-9./-]{3,}[0-9]')


def _sem_numeros(texto):
    """O texto que veio de fora sem as sequências de 5 ou mais dígitos (um CNPJ, uma chave)."""
    return _NUMEROS.sub('…', texto)


def hoje_local():
    bruto = os.environ.get('PONTE_HOJE')          # pros testes
    if bruto:
        try:
            return datetime.date.fromisoformat(bruto)
        except ValueError:
            pass
    return datetime.date.today()


def agora():
    return datetime.datetime.now().astimezone().isoformat(timespec='seconds')


# ---------------------------------------------------------------- a chave e a data

def dv_da_chave(base43):
    """O dígito verificador da chave (módulo 11, pesos de 2 a 9 da direita pra esquerda; a letra vale o código - 48)."""
    soma, peso = 0, 2
    for c in reversed(base43):
        soma += (ord(c) - 48) * peso
        peso = 2 if peso == 9 else peso + 1
    r = soma % 11
    return 0 if r < 2 else 11 - r


def _cpf_valido(d):
    if not re.fullmatch(r'\d{11}', d) or len(set(d)) == 1:
        return False
    for n in (9, 10):
        r = sum(int(d[i]) * (n + 1 - i) for i in range(n)) * 10 % 11
        if (0 if r == 10 else r) != int(d[n]):
            return False
    return True


def _cnpj_valido(c):
    return (re.fullmatch(r'[0-9A-Z]{12}\d{2}', c) is not None and dv_da_chave(c[:12]) == int(c[12])
            and dv_da_chave(c[:13]) == int(c[13]))


def parece_cpf(cnpj):
    """O lugar do CNPJ na chave com o CPF do emitente pessoa física (000 + CPF) — e que não forma um CNPJ."""
    return isinstance(cnpj, str) and cnpj.startswith('000') and _cpf_valido(cnpj[3:]) and not _cnpj_valido(cnpj)


def _data(v):
    if isinstance(v, datetime.datetime):
        return v.date()
    if isinstance(v, datetime.date):
        return v
    try:
        return datetime.date.fromisoformat(str(v or '').strip()[:10])
    except ValueError:
        return None


def nota(linha, ini, fim):
    """({chave, entrada}, None) ou (None, motivo) — a mesma conferência da função (entradas.js)."""
    chave = str(linha.get('chave') or '').strip().upper()
    if not re.fullmatch(r'\d{6}[0-9A-Z]{12}\d{26}', chave) or dv_da_chave(chave[:43]) != int(chave[43]):
        return None, 'chave'
    if chave[20:22] != '55':
        return None, 'modelo'
    if chave[:2] == UF_RS:
        return None, 'rs'
    if str(linha.get('emitente_tipo') or '') == '2' or parece_cpf(chave[6:20]):
        return None, 'cpf'
    entrada = _data(linha.get('entrada'))
    if entrada is None or entrada < ini or entrada > fim or f'{entrada:%y%m}' < chave[2:6]:
        return None, 'data'
    return {'chave': chave, 'entrada': entrada.isoformat()}, None


def pacotes(empresas, rodada):
    """[(codigo, [notas])] → os pacotes da função, cada um com até LIMITE_NOTAS notas e LIMITE_EMPRESAS empresas (a
    empresa com mais notas que isso vai em partes, uma por pacote)."""
    saida, atual, n = [], [], 0

    def fechar():
        nonlocal atual, n
        if atual:
            saida.append({'versao': 1, 'tipo': 'entradas', 'rodada': rodada, 'empresas': atual})
        atual, n = [], 0

    for codigo, notas in empresas:
        for i in range(0, len(notas), LIMITE_NOTAS):
            parte = notas[i:i + LIMITE_NOTAS]
            if n + len(parte) > LIMITE_NOTAS or len(atual) >= LIMITE_EMPRESAS or any(e['codigo'] == codigo for e in atual):
                fechar()
            atual.append({'codigo': codigo, 'notas': parte})
            n += len(parte)
    fechar()
    return saida


# ---------------------------------------------------------------- a Domínio

class FonteEntradasDominio:
    """A consulta entradas_fora.sql, pela mesma conexão ODBC da ponte."""

    def __init__(self, conexao, pasta_consultas=None, conectar=None):
        from .fonte_dominio import PASTA_CONSULTAS, abrir_odbc
        self._conexao = conexao
        self._arq = pathlib.Path(pasta_consultas or PASTA_CONSULTAS) / 'entradas_fora.sql'
        self._conectar = conectar or abrir_odbc
        self._con = None

    def linhas(self, codigo, ini, fim):
        from .fonte_dominio import a_conferir
        texto = self._arq.read_text(encoding='utf-8-sig')
        if a_conferir(texto) or not texto.strip():
            raise RuntimeError('a consulta entradas_fora.sql ainda está a conferir')
        if self._con is None:
            self._con = self._conectar(self._conexao)
        cur = self._con.cursor()
        try:
            cur.execute(texto, [codigo, ini, fim])
            nomes = [str(d[0]).lower() for d in (cur.description or ())]
            return [dict(zip(nomes, l)) for l in cur.fetchall()]
        finally:
            try:
                cur.close()
            except Exception:
                pass

    def fechar(self):
        if self._con is not None:
            try:
                self._con.close()
            except Exception:
                pass


class FonteEntradasFalsa:
    """A Domínio de mentira: {"empresas": {"901": [{"chave", "entrada", "emitente_tipo"?}]}} do arquivo do
    PONTE_ENTRADAS_FALSO (os testes montam um por caso); sem ele, uma empresa (901) sem nota. Devolve as linhas da
    janela, como a consulta — o resto a ponte confere."""

    def __init__(self):
        arq = os.environ.get('PONTE_ENTRADAS_FALSO')
        dados = json.loads(pathlib.Path(arq).read_text(encoding='utf-8')) if arq else {'empresas': {'901': []}}
        self._empresas = {int(k): v for k, v in (dados.get('empresas') or {}).items()}

    def linhas(self, codigo, ini, fim):
        saida = []
        for l in self._empresas.get(codigo, []):
            d = _data(l.get('entrada'))
            if d is not None and ini <= d <= fim:
                saida.append(dict(l))
        return saida

    def fechar(self):
        pass


# ---------------------------------------------------------------- o sistema

class _SemRedirecionar(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


_ABRIR = urllib.request.build_opener(_SemRedirecionar())


def pedir_empresas(cfg, reg):
    """(([codigo], ini, fim), None) — ou (None, status HTTP ou None), com o porquê no log."""
    from .receita.sistema import erro_da_resposta
    chave = cfg.valor('sistema', 'chave_publica')
    cab = {'apikey': chave, 'Authorization': f'Bearer {chave}', 'x-chave': cfg.valor('sistema', 'chave_ponte'),
           'Content-Type': 'application/json'}
    corpo = json.dumps({'versao': 1, 'tipo': 'entradas', 'pedir': 'empresas'}).encode('utf-8')
    try:
        req = urllib.request.Request(cfg.valor('sistema', 'url'), data=corpo, method='POST', headers=cab)
        with _ABRIR.open(req, timeout=float(os.environ.get('PONTE_TIMEOUT') or 60)) as r:
            resposta = json.loads(r.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        try:
            detalhe = erro_da_resposta(e.read(2000))
        except Exception:
            detalhe = ''
        reg(f'entradas: o sistema não deu a lista das empresas (HTTP {e.code}' + (f' — {detalhe}' if detalhe else '') + ')', 'erro')
        return None, e.code
    except (urllib.error.URLError, http.client.HTTPException, OSError, ValueError) as e:
        reg(f'entradas: o sistema não deu a lista das empresas ({type(getattr(e, "reason", e)).__name__})', 'erro')
        return None, None
    if not isinstance(resposta, dict):
        reg('entradas: a lista das empresas veio fora do formato', 'erro')
        return None, None
    ini, fim = _data(resposta.get('desde')), _data(resposta.get('ate'))
    if ini is None or fim is None or ini > fim:
        reg('entradas: a janela da lista veio fora do formato', 'erro')
        return None, None
    codigos, fora = [], 0
    for e in resposta.get('empresas') or []:
        codigo = e.get('codigo') if isinstance(e, dict) else None
        if not isinstance(codigo, int) or isinstance(codigo, bool) or codigo < 1 or codigo in codigos:
            fora += 1
            continue
        codigos.append(codigo)
    if fora:
        reg(f'entradas: {fora} empresa(s) da lista fora do formato ou repetida(s) ficaram de fora', 'aviso')
    return (codigos, ini, min(fim, hoje_local())), None


def _anotar(reg, rotulo, resp):
    """O que a função respondeu: os números, e as recusadas sem as sequências de números (a chave, um CNPJ)."""
    if not isinstance(resp, dict):
        return
    numeros = {k: resp.get(k) for k in ('recebidas', 'achadas', 'atualizadas')}
    if all(isinstance(v, int) and not isinstance(v, bool) for v in numeros.values()):
        reg(f'{rotulo}: {numeros["recebidas"]} recebida(s), {numeros["achadas"]} achada(s) na base, '
            f'{numeros["atualizadas"]} com a data nova')
    rec = [x for x in (resp.get('recusadas') or []) if isinstance(x, dict)]
    total = resp.get('total_recusadas')
    total = total if isinstance(total, int) and not isinstance(total, bool) and total >= len(rec) else len(rec)
    if total:
        reg(f'{rotulo}: o sistema deixou de fora {total} (não mando de novo do mesmo jeito: o mesmo dado voltaria fora)', 'aviso')
    for x in rec[:30]:
        campo = _sem_numeros(re.sub(r'\s+', ' ', str(x.get('campo') or '')))[:120]
        erro = _sem_numeros(re.sub(r'\s+', ' ', str(x.get('erro') or '')))[:200]
        reg(f'{rotulo}: recusada — {campo}: {erro}', 'aviso')


# ---------------------------------------------------------------- a rodada

def rodar(sem_enviar=False, falso=False, etapa=False, registro=None):
    base = config.pasta()
    cfg = config.carregar()
    reg = registro or Registro(base / 'logs', segredos=cfg.segredos())

    precisa = list(config.CAMPOS_SISTEMA) + ([] if falso else list(config.CAMPOS_DOMINIO))
    if not cfg.existe or cfg.erro_leitura or cfg.falta(precisa):
        falta = cfg.falta(precisa) if cfg.existe and not cfg.erro_leitura else ['config.ini']
        if etapa:
            reg('entradas: a etapa das datas de entrada não roda (falta no config.ini: ' + ', '.join(falta) + ')')
            return OK
        reg('entradas: a configuração não deixa rodar; falta: ' + ', '.join(falta), 'erro')
        return NAO_ADIANTA
    pode_mandar = not sem_enviar
    if falso and pode_mandar and not config.endereco_local(cfg.valor('sistema', 'url')):
        if etapa:
            reg('entradas: com a Domínio de mentira, as datas só vão pra um sistema de mentira (endereço local): só conto')
            pode_mandar = False
        else:
            reg('entradas: --falso só manda pra um sistema de mentira (endereço local); use --falso --sem-enviar', 'erro')
            return NAO_ADIANTA

    reg(f'entradas: rodada {VERSAO}, {hoje_local():%d/%m/%Y}' + (' — Domínio de mentira' if falso else '')
        + ('' if pode_mandar else ' — sem enviar'))
    lista, status = pedir_empresas(cfg, reg)
    if lista is None:
        return NAO_ADIANTA if status in (401, 403) else TENTAR_DE_NOVO
    codigos, ini, fim = lista
    if not codigos:
        reg('entradas: nenhuma empresa da SEDIF/DeSTDA ligada ao Domínio — nada a fazer')
        return OK
    reg(f'entradas: {len(codigos)} empresa(s) da SEDIF/DeSTDA, de {ini:%d/%m/%Y} a {fim:%d/%m/%Y}')

    fonte = FonteEntradasFalsa() if falso else FonteEntradasDominio(cfg.valor('dominio', 'conexao'))
    codigo, empresas, fora, total = OK, [], {}, 0
    try:
        for cod in codigos:
            t0 = time.monotonic()
            try:
                linhas = fonte.linhas(cod, ini, fim)
            except Exception as e:
                reg(f'entradas {cod}: a leitura da Domínio deu erro ({type(e).__name__})', 'erro')
                codigo = max(codigo, TENTAR_DE_NOVO)
                continue
            notas, vistas, fora_emp = [], set(), {}
            for l in linhas:
                n, motivo = nota(l, ini, fim)
                if n is not None and n['chave'] in vistas:
                    n, motivo = None, 'repetida'
                if n is None:
                    fora_emp[motivo] = fora_emp.get(motivo, 0) + 1
                    continue
                vistas.add(n['chave'])
                notas.append(n)
            for k, v in fora_emp.items():
                fora[k] = fora.get(k, 0) + v
            reg(f'entradas {cod}: {len(notas)} nota(s) de fora do RS em {time.monotonic() - t0:.1f} s'
                + ('; de fora: ' + ', '.join(f'{v} {MOTIVOS[k]}' for k, v in sorted(fora_emp.items())) if fora_emp else ''))
            if notas:
                empresas.append((cod, notas))
                total += len(notas)
    except Exception as e:
        onde = traceback.extract_tb(e.__traceback__)[-1]
        reg(f'entradas: a rodada parou: {type(e).__name__} em {pathlib.Path(onde.filename).name}:{onde.lineno}', 'erro')
        return TENTAR_DE_NOVO
    finally:
        try:
            fonte.fechar()
        except Exception:
            pass
    reg(f'entradas: {total} nota(s) de {len(empresas)} empresa(s)'
        + ('; de fora: ' + ', '.join(f'{v} {MOTIVOS[k]}' for k, v in sorted(fora.items())) if fora else ''))
    if not pode_mandar:
        reg('entradas: sem enviar — nada foi mandado')
        return codigo
    if not empresas:
        return codigo

    from .notas.sistema import EnvioNotas
    env = EnvioNotas(cfg.valor('sistema', 'url'), cfg.valor('sistema', 'chave_publica'), cfg.valor('sistema', 'chave_ponte'), reg)
    rodada = {'id': str(uuid.uuid4()), 'inicio': agora(), 'maquina': socket.gethostname()[:60], 'ponte': VERSAO}
    lote = pacotes(empresas, rodada)
    for k, pac in enumerate(lote, 1):
        rotulo = f'entradas: pacote {k} de {len(lote)} ({sum(len(e["notas"]) for e in pac["empresas"])} nota(s))'
        r = env.mandar(json.dumps(pac, ensure_ascii=False, separators=(',', ':')).encode('utf-8'), rotulo)
        if r == envio.FOI:
            _anotar(reg, rotulo, env.ultima_resposta)
            continue
        if r in (envio.RECUSADO, envio.CONFIG):
            return NAO_ADIANTA
        return TENTAR_DE_NOVO               # o sistema fora, a chave não cadastrada: a próxima rodada manda tudo de novo
    return codigo


def etapa(falso=False, sem_enviar=False, registro=None):
    """A etapa das datas de entrada no fim do `py -3 -m ponte rodar`: um erro aqui vai pro log e não muda a rodada dos
    totais."""
    try:
        rodar(sem_enviar=sem_enviar, falso=falso, etapa=True, registro=registro)
    except Exception as e:
        if registro is not None:
            registro(f'entradas: a etapa das datas de entrada parou ({type(e).__name__}) — a rodada dos totais segue como foi', 'erro')
