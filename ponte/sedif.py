"""`py -3 -m ponte sedif rodar` — as notas de entrada das empresas da SEDIF/DeSTDA, da Domínio pro sistema (26/11/2026).
Roda também no fim do `py -3 -m ponte rodar` (etapa()), no mesmo modo, depois das datas de entrada.

O pedido da Thalia: a Conferência SEDIF/DeSTDA do sistema precisava dos XMLs de entrada do mês, que ela exportava da
Domínio e soltava na tela (a do Cleiton, 1.222 notas num mês). A ponte pede ao sistema a lista (a mesma das datas de
entrada: os códigos do Domínio das empresas da obrigação SEDIF/DeSTDA e a janela, o mês de hoje e os dois antes), lê de
cada empresa as NF-e de compra da janela, pela data de entrada (ponte/consultas/sedif_lista.sql: a chave, a data, o tipo
do fornecedor e se a Domínio ainda guarda o XML), busca o XML só das que ainda não mandou (notas_xml.sql), lê cada uma
como o importador dos XMLs do sistema lê (ponte/nfe.py) e manda, empresa por empresa, em pacotes de até 200 notas. O
sistema grava como a importação grava: a nota nova com os itens e a data de entrada da Domínio; a que já estava na base
ganha a data e os itens do XML (a base e a alíquota do ICMS de quem importou antes de 27/10/2026).

O XML não sai do PC: vai o que a tela usa (a nota e os itens). A nota de fornecedor pessoa física não vai, como nas datas
de entrada. A nota sem o XML na Domínio (a digitada, ou a de quando a Domínio já apagou o XML) não vai: o log conta.

O que já foi: C:\\ponte-dominio\\sedif\\estado.json — a chave e a data de entrada de cada nota mandada (com a versão do
leitor, nfe.LEITOR), nada mais; e, das que o XML não deixou mandar (rejeitada pela Sefaz, ilegível, de outra nota, de
emitente com CPF), também o porquê, pra não buscar o XML delas todo dia. A nota vai (ou é lida) de novo quando a data de
entrada muda na Domínio, quando o leitor muda, ou com o --tudo. A empresa que sai da lista e a nota que sai da janela
somem do estado.

    --sem-enviar   pede a lista, lê e conta (o XML das que iriam também é lido e conferido); não manda nem grava o estado
    --falso        a Domínio de mentira (o cenário do PONTE_SEDIF_FALSO, um JSON); manda só pra um sistema local
    --tudo         manda de novo as notas da janela, mesmo as que já foram (o estado não conta)

O log, por empresa e pelo código (nunca a chave, um CNPJ, um nome ou um valor): as notas da janela, as já mandadas, as
que vão, as sem o XML na Domínio e as de fora por motivo; e o que o sistema respondeu (recebidas, novas na base, as que já
estavam, os itens completados, as datas novas, as recusadas sem números). O contrato: supabase/functions/ponte/sedif.js e
docs/FILA-CODE-2026-11-26-NOTAS-SEDIF.md.
Código de saída: 0 (foi, ou nada a mandar, ou --sem-enviar) · 1 (a lista não veio, a leitura ou o envio de alguma
empresa não foi: vai na próxima rodada) · 2 (configuração, chave recusada, pacote recusado).
"""
import datetime
import json
import os
import pathlib
import re
import socket
import time
import traceback
import uuid

from . import VERSAO, config, envio, nfe
from .entradas import MOTIVOS as MOTIVOS_DA_CHAVE, _data, _sem_numeros, agora, hoje_local, nota as conferir_nota, \
    pedir_empresas
from .log import Registro
from .notas.xml import Ilegivel

OK, TENTAR_DE_NOVO, NAO_ADIANTA = 0, 1, 2
LIMITE_NOTAS = 200                  # o da função (LIMITES_SEDIF.notas)
LIMITE_BYTES = 4 * 1024 * 1024      # cada pacote; a função recebe até 16 MB
MOTIVOS = {
    **MOTIVOS_DA_CHAVE,
    'sem_xml': 'sem o XML na Domínio',
    'xml_nao_veio': 'com o XML que não veio da Domínio',
    'ilegivel': 'com o XML ilegível',
    'nao_autorizada': 'não autorizadas pela Sefaz',
    'outra_chave': 'com o XML de outra nota',
}


# ---------------------------------------------------------------- o estado

class Estado:
    """{"versao": 1, "empresas": {"<código>": {"<chave>": "AAAA-MM-DD|<leitor>"}},
        "fora": {"<código>": {"<chave>": "AAAA-MM-DD|<leitor>|<motivo>"}}} — só isso de cada nota."""

    def __init__(self, pasta, gravar=True):
        self.arquivo = pasta / 'estado.json'
        self.pode_gravar = gravar
        self.dados = {'versao': 1, 'empresas': {}}
        self.problema = None
        try:
            lido = json.loads(self.arquivo.read_text(encoding='utf-8'))
            if isinstance(lido, dict) and isinstance(lido.get('empresas'), dict):
                self.dados = lido
            else:
                self.problema = 'o arquivo não tem o formato esperado'
        except FileNotFoundError:
            pass
        except (ValueError, UnicodeDecodeError):
            self.problema = 'o arquivo está ilegível'
        except OSError as e:
            self.problema = f'o arquivo não abriu ({type(e).__name__})'

    @staticmethod
    def _marca(entrada):
        return f'{entrada}|{nfe.LEITOR}'

    def vai(self, codigo, chave, entrada, tudo=False):
        return tudo or self.dados['empresas'].get(str(codigo), {}).get(chave) != self._marca(entrada)

    def ficou_fora(self, codigo, chave, entrada, tudo=False):
        """O porquê de a nota já ter ficado de fora pelo XML (com a mesma data e o mesmo leitor), ou None."""
        if tudo:
            return None
        v = str((self.dados.get('fora') or {}).get(str(codigo), {}).get(chave) or '')
        marca = self._marca(entrada) + '|'
        return (v[len(marca):] or None) if v.startswith(marca) else None

    def marcar_fora(self, codigo, chave, entrada, motivo):
        self.dados.setdefault('fora', {}).setdefault(str(codigo), {})[chave] = f'{self._marca(entrada)}|{motivo}'

    def marcar(self, codigo, notas):
        e = self.dados['empresas'].setdefault(str(codigo), {})
        for n in notas:
            e[n['chave']] = self._marca(n['entrada'])

    def podar(self, codigos, ini):
        """A empresa que saiu da lista e a nota que saiu da janela (a data antes do começo) somem."""
        manter = {str(c) for c in codigos}
        for grupo in (self.dados['empresas'], self.dados.setdefault('fora', {})):
            for c in [c for c in grupo if c not in manter]:
                del grupo[c]
            for notas in grupo.values():
                for ch in [ch for ch, v in notas.items() if str(v)[:10] < ini.isoformat()]:
                    del notas[ch]

    def gravar(self):
        if not self.pode_gravar:
            return
        self.arquivo.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.arquivo.with_suffix('.tmp')
        tmp.write_text(json.dumps(self.dados, ensure_ascii=False), encoding='utf-8')
        os.replace(tmp, self.arquivo)


# ---------------------------------------------------------------- a Domínio

def _fonte_dominio(conexao):
    from .notas.fonte import FonteNotasDominio

    class FonteSedifDominio(FonteNotasDominio):
        """A lista (sedif_lista.sql) e o XML guardado (notas_xml.sql, o da ponte das notas), pela conexão da ponte."""

        def lista(self, codigo, ini, fim):
            return self._consultar('sedif_lista', (codigo, ini, fim))

    return FonteSedifDominio(conexao)


class FonteSedifFalsa:
    """A Domínio de mentira: {"empresas": {"901": [{"chave", "entrada", "emitente_tipo"?, "tem_xml"?, "xml"?}]}} do
    arquivo do PONTE_SEDIF_FALSO (os testes montam um por caso); sem ele, nenhuma empresa com nota. As consultas que
    a ponte fez vão pro arquivo do PONTE_SEDIF_CHAMADAS, se houver (o teste confere que o XML só é buscado quando falta)."""

    def __init__(self):
        arq = os.environ.get('PONTE_SEDIF_FALSO')
        dados = json.loads(pathlib.Path(arq).read_text(encoding='utf-8')) if arq else {'empresas': {}}
        self._empresas = {int(k): v for k, v in (dados.get('empresas') or {}).items()}
        self._chamadas = os.environ.get('PONTE_SEDIF_CHAMADAS')

    def _anotar(self, *chamada):
        if self._chamadas:
            with open(self._chamadas, 'a', encoding='utf-8') as f:
                f.write(json.dumps([str(x) for x in chamada]) + '\n')

    def _da_janela(self, codigo, ini, fim):
        for l in self._empresas.get(codigo, []):
            d = _data(l.get('entrada'))
            if d is not None and ini <= d <= fim:
                yield l

    def lista(self, codigo, ini, fim):
        self._anotar('lista', codigo, ini, fim)
        return [{'chave': l.get('chave'), 'entrada': l.get('entrada'), 'emitente_tipo': l.get('emitente_tipo', 1),
                 'tem_xml': l.get('tem_xml', 1 if l.get('xml') else 0)} for l in self._da_janela(codigo, ini, fim)]

    def xmls(self, codigo, ini, fim):
        self._anotar('xmls', codigo, ini, fim)
        return {str(l['chave']).strip().upper(): l['xml'].encode('utf-8') for l in self._da_janela(codigo, ini, fim)
                if l.get('xml')}

    def fechar(self):
        pass


# ---------------------------------------------------------------- a leitura de uma empresa

def _tem_xml(linha):
    try:
        return int(linha.get('tem_xml') or 0) == 1
    except (TypeError, ValueError):
        return False


def trechos(notas):
    """[(primeiro, último)] — por mês da data de entrada, da primeira à última das notas que vão (o XML só delas)."""
    por_mes = {}
    for n in notas:
        d = datetime.date.fromisoformat(n['entrada'])
        a, b = por_mes.get((d.year, d.month), (d, d))
        por_mes[(d.year, d.month)] = (min(a, d), max(b, d))
    return [por_mes[k] for k in sorted(por_mes)]


def ler_empresa(fonte, codigo, ini, fim, est, tudo=False):
    """As notas que vão: ([{chave, entrada, doc, itens}], {'janela', 'ja', 'fora': {motivo: n}})."""
    resumo = {'janela': 0, 'ja': 0, 'fora': {}}

    def fora(motivo):
        resumo['fora'][motivo] = resumo['fora'].get(motivo, 0) + 1

    vao, vistas = [], set()
    for linha in fonte.lista(codigo, ini, fim):
        resumo['janela'] += 1
        n, motivo = conferir_nota(linha, ini, fim, so_de_fora=False)
        if n is not None and n['chave'] in vistas:
            n, motivo = None, 'repetida'
        if n is None:
            fora(motivo)
            continue
        vistas.add(n['chave'])
        if not est.vai(codigo, n['chave'], n['entrada'], tudo):
            resumo['ja'] += 1
            continue
        motivo = est.ficou_fora(codigo, n['chave'], n['entrada'], tudo)
        if motivo:
            fora(motivo)
            continue
        if not _tem_xml(linha):
            fora('sem_xml')
            continue
        vao.append(n)
    notas = []
    for a, b in trechos(vao):
        xmls = fonte.xmls(codigo, a, b)
        for n in vao:
            if not a.isoformat() <= n['entrada'] <= b.isoformat():
                continue
            bruto = xmls.get(n['chave'])
            if bruto is None:
                fora('xml_nao_veio')
                continue
            try:
                lida = nfe.ler(bruto)
            except Ilegivel as e:
                lida, motivo = None, 'nao_autorizada' if 'Sefaz' in str(e) else 'ilegivel'
            else:
                motivo = 'outra_chave' if lida['chave'] != n['chave'] else \
                    'cpf' if len(lida['doc']['emit_doc'] or '') == 11 else None
            if motivo:
                # o XML não muda: a nota não é lida de novo até a data de entrada ou o leitor mudar
                fora(motivo)
                est.marcar_fora(codigo, n['chave'], n['entrada'], motivo)
                continue
            notas.append({'chave': n['chave'], 'entrada': n['entrada'], 'doc': lida['doc'], 'itens': lida['itens']})
    return notas, resumo


def _corpo(pacote):
    return json.dumps(pacote, ensure_ascii=False, separators=(',', ':')).encode('utf-8')


def pacotes(codigo, notas, rodada):
    """Os pacotes de uma empresa: até LIMITE_NOTAS notas e LIMITE_BYTES cada."""
    saida, atual, tam = [], [], 0
    for n in notas:
        t = len(_corpo(n)) + 1
        if atual and (len(atual) >= LIMITE_NOTAS or tam + t > LIMITE_BYTES - 4096):
            saida.append(atual)
            atual, tam = [], 0
        atual.append(n)
        tam += t
    if atual:
        saida.append(atual)
    return [{'versao': 1, 'tipo': 'sedif', 'rodada': rodada, 'empresa': {'codigo': codigo}, 'notas': p} for p in saida]


def _texto_fora(fora):
    return ', '.join(f'{v} {MOTIVOS.get(k, k)}' for k, v in sorted(fora.items(), key=lambda x: (-x[1], x[0])))


def _anotar(reg, rotulo, resp):
    """O que a função respondeu: os números, e as recusadas sem as sequências de números (a chave, um CNPJ)."""
    if not isinstance(resp, dict):
        return
    nomes = ('recebidas', 'novas', 'ja_na_base', 'itens_completados', 'datas')
    n = {k: resp.get(k) for k in nomes}
    if all(isinstance(v, int) and not isinstance(v, bool) for v in n.values()):
        reg(f'{rotulo}: {n["recebidas"]} recebida(s), {n["novas"]} nova(s) na base, {n["ja_na_base"]} já estavam '
            f'({n["itens_completados"]} item(ns) completado(s), {n["datas"]} com a data de entrada nova)')
    rec = [x for x in (resp.get('recusadas') or []) if isinstance(x, dict)]
    total = resp.get('total_recusadas')
    total = total if isinstance(total, int) and not isinstance(total, bool) and total >= len(rec) else len(rec)
    if total:
        reg(f'{rotulo}: o sistema deixou de fora {total} (não mando de novo do mesmo jeito: voltaria fora)', 'aviso')
    for x in rec[:30]:
        campo = _sem_numeros(re.sub(r'\s+', ' ', str(x.get('campo') or '')))[:120]
        erro = _sem_numeros(re.sub(r'\s+', ' ', str(x.get('erro') or '')))[:200]
        reg(f'{rotulo}: recusada — {campo}: {erro}', 'aviso')


# ---------------------------------------------------------------- a rodada

def rodar(sem_enviar=False, falso=False, tudo=False, etapa=False, registro=None):
    base = config.pasta()
    cfg = config.carregar()
    reg = registro or Registro(base / 'logs', segredos=cfg.segredos())

    precisa = list(config.CAMPOS_SISTEMA) + ([] if falso else list(config.CAMPOS_DOMINIO))
    if not cfg.existe or cfg.erro_leitura or cfg.falta(precisa):
        falta = cfg.falta(precisa) if cfg.existe and not cfg.erro_leitura else ['config.ini']
        if etapa:
            reg('sedif: a etapa das notas de entrada não roda (falta no config.ini: ' + ', '.join(falta) + ')')
            return OK
        reg('sedif: a configuração não deixa rodar; falta: ' + ', '.join(falta), 'erro')
        return NAO_ADIANTA
    pode_mandar = not sem_enviar
    if falso and pode_mandar and not config.endereco_local(cfg.valor('sistema', 'url')):
        if etapa:
            reg('sedif: com a Domínio de mentira, as notas só vão pra um sistema de mentira (endereço local): só conto')
            pode_mandar = False
        else:
            reg('sedif: --falso só manda pra um sistema de mentira (endereço local); use --falso --sem-enviar', 'erro')
            return NAO_ADIANTA

    reg(f'sedif: rodada {VERSAO}, {hoje_local():%d/%m/%Y}' + (' — Domínio de mentira' if falso else '')
        + ('' if pode_mandar else ' — sem enviar') + (' — a janela inteira de novo (--tudo)' if tudo else ''))
    lista, status = pedir_empresas(cfg, reg, rotulo='sedif')
    if lista is None:
        return NAO_ADIANTA if status in (401, 403) else TENTAR_DE_NOVO
    codigos, ini, fim = lista
    if not codigos:
        reg('sedif: nenhuma empresa da SEDIF/DeSTDA ligada ao Domínio — nada a fazer')
        return OK
    reg(f'sedif: {len(codigos)} empresa(s) da SEDIF/DeSTDA, de {ini:%d/%m/%Y} a {fim:%d/%m/%Y}')

    est = Estado(base / 'sedif', gravar=pode_mandar)
    if est.problema:
        reg(f'sedif: o estado das notas mandadas não abriu ({est.problema}): as notas da janela vão de novo', 'aviso')
    est.podar(codigos, ini)
    fonte = FonteSedifFalsa() if falso else _fonte_dominio(cfg.valor('dominio', 'conexao'))
    env = None
    if pode_mandar:
        from .notas.sistema import EnvioNotas
        env = EnvioNotas(cfg.valor('sistema', 'url'), cfg.valor('sistema', 'chave_publica'),
                         cfg.valor('sistema', 'chave_ponte'), reg)
    rodada = {'id': str(uuid.uuid4()), 'inicio': agora(), 'maquina': socket.gethostname()[:60], 'ponte': VERSAO}
    codigo, mandadas, com_notas, fora_total = OK, 0, 0, {}
    try:
        for cod in codigos:
            t0 = time.monotonic()
            try:
                notas, resumo = ler_empresa(fonte, cod, ini, fim, est, tudo)
            except Exception as e:
                reg(f'sedif {cod}: a leitura da Domínio deu erro ({type(e).__name__})', 'erro')
                codigo = max(codigo, TENTAR_DE_NOVO)
                continue
            for k, v in resumo['fora'].items():
                fora_total[k] = fora_total.get(k, 0) + v
            reg(f'sedif {cod}: {resumo["janela"]} nota(s) na janela, {resumo["ja"]} já mandada(s), {len(notas)} vão'
                + (f'; de fora: {_texto_fora(resumo["fora"])}' if resumo['fora'] else '')
                + f' ({time.monotonic() - t0:.1f} s)')
            if not notas or not pode_mandar:
                if notas:
                    com_notas += 1
                    mandadas += len(notas)
                continue
            com_notas += 1
            lote = pacotes(cod, notas, rodada)
            for k, pac in enumerate(lote, 1):
                rotulo = f'sedif {cod}: pacote {k} de {len(lote)} ({len(pac["notas"])} nota(s))'
                r = env.mandar(_corpo(pac), rotulo)
                if r == envio.FOI:
                    est.marcar(cod, pac['notas'])
                    est.gravar()
                    mandadas += len(pac['notas'])
                    _anotar(reg, rotulo, env.ultima_resposta)
                    continue
                if r == envio.RECUSADO and env.ultimo_status not in (401, 403):
                    # o pacote fora do contrato: o resto desta empresa espera a próxima rodada; as outras seguem
                    codigo = max(codigo, NAO_ADIANTA)
                    break
                if r in (envio.RECUSADO, envio.CONFIG):
                    return NAO_ADIANTA
                return max(codigo, TENTAR_DE_NOVO)     # o sistema fora: o resto vai na próxima rodada
    except Exception as e:
        onde = traceback.extract_tb(e.__traceback__)[-1]
        reg(f'sedif: a rodada parou: {type(e).__name__} em {pathlib.Path(onde.filename).name}:{onde.lineno}', 'erro')
        return TENTAR_DE_NOVO
    finally:
        try:
            fonte.fechar()
        except Exception:
            pass
        try:
            est.gravar()
        except OSError as e:
            reg(f'sedif: o estado das notas mandadas não foi gravado ({type(e).__name__})', 'erro')
    reg(f'sedif: {mandadas} nota(s) ' + ('mandada(s)' if pode_mandar else 'iriam') + f' de {com_notas} empresa(s)'
        + (f'; de fora: {_texto_fora(fora_total)}' if fora_total else ''))
    if not pode_mandar:
        reg('sedif: sem enviar — nada foi mandado')
    return codigo


def etapa(falso=False, sem_enviar=False, registro=None):
    """A etapa das notas de entrada no fim do `py -3 -m ponte rodar`: um erro aqui vai pro log e não muda a rodada dos
    totais."""
    try:
        rodar(sem_enviar=sem_enviar, falso=falso, etapa=True, registro=registro)
    except Exception as e:
        if registro is not None:
            registro(f'sedif: a etapa das notas de entrada parou ({type(e).__name__}) — a rodada dos totais segue como foi',
                     'erro')
