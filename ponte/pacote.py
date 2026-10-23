"""Monta o pacote — o contrato com o sistema (versão 1).

    { "versao": 1,
      "rodada":   { id, inicio, fim, dados_ate, maquina, ponte },
      "empresas": [ { codigo, documento, nome, ativa } ],
      "mensal":   [ { codigo, competencia 'AAAA-MM', funcionarios_ativos, admissoes, desligamentos, afastados,
                      pro_labore, notas_saida, valor_saidas, notas_entrada, valor_entradas,
                      lancamentos, ultimo_lancamento } ],
      "faltou":   [ { bloco, motivo } ] }

Regras:
  - Só esses campos saem. O que a fonte devolver a mais é descartado aqui (a trava do dado pessoal).
  - `mensal`: uma linha por empresa e competência; campo que não veio sai null, nunca um 0 inventado.
  - Um bloco entra inteiro ou fica de fora inteiro: se a consulta está a conferir, deu erro, ou devolveu mais de uma
    linha pra mesma empresa no mês (sinal de que não veio contada), os campos dele ficam null em todas as linhas e
    o bloco vai pro `faltou`.
  - `dados_ate` é ontem (a cópia do Domínio é do dia anterior); as horas, com o fuso do PC.
"""
import datetime
import re
import socket
import uuid
from decimal import Decimal, InvalidOperation

from . import VERSAO
from .fonte import (BLOCOS, CAMPOS_DATA, CAMPOS_INTEIROS, CAMPOS_MES, CAMPOS_VALOR, ConsultaAConferir)

VERSAO_PACOTE = 1
ORDEM_MENSAL = ('codigo', 'competencia') + tuple(c for b in BLOCOS for c in CAMPOS_MES[b])


class SemEmpresas(Exception):
    """A consulta de empresas ainda está a conferir: sem ela, não há o que mandar."""


def agora():
    return datetime.datetime.now().astimezone().isoformat(timespec='seconds')


def ontem():
    return datetime.date.today() - datetime.timedelta(days=1)


def competencias(dados_ate, meses):
    """Os `meses` meses que terminam no mês de `dados_ate`, do mais velho pro mais novo ('AAAA-MM')."""
    ano, mes = dados_ate.year, dados_ate.month
    saida = []
    for _ in range(meses):
        saida.append(f'{ano:04d}-{mes:02d}')
        mes -= 1
        if mes == 0:
            ano, mes = ano - 1, 12
    return saida[::-1]


# ---------- conversões: o que não dá pra entender vira null (e conta como aviso) ----------

def _inteiro(v):
    if v is None or isinstance(v, bool):
        return None
    if isinstance(v, int):
        return v
    try:
        d = Decimal(str(v).strip())
    except (InvalidOperation, ValueError):
        return None
    if d != d.to_integral_value():
        return None
    return int(d)


def _valor(v):
    if v is None or isinstance(v, bool):
        return None
    try:
        d = Decimal(str(v).strip())
    except (InvalidOperation, ValueError):
        return None
    if not d.is_finite():
        return None
    return float(d.quantize(Decimal('0.01')))


def _data(v):
    if v is None:
        return None
    if isinstance(v, datetime.datetime):
        return v.date().isoformat()
    if isinstance(v, datetime.date):
        return v.isoformat()
    s = str(v).strip()[:10]
    try:
        return datetime.date.fromisoformat(s).isoformat()
    except ValueError:
        return None


def _documento(v):
    """Sem pontuação. Fica só dígito — e letra maiúscula, por causa do CNPJ alfanumérico (julho/2026)."""
    if v is None:
        return None
    s = re.sub(r'[^0-9A-Z]', '', str(v).upper())
    return s or None


_SIM = {'S', 'SIM', 'A', 'ATIVA', 'ATIVO', 'T', 'TRUE', 'Y', 'YES', '1'}
_NAO = {'N', 'NAO', 'NÃO', 'I', 'INATIVA', 'INATIVO', 'F', 'FALSE', '0'}


def _ativa(v):
    if isinstance(v, bool):
        return v
    if isinstance(v, (int, Decimal)):
        return v != 0
    if v is None:
        return None
    s = str(v).strip().upper()
    return True if s in _SIM else False if s in _NAO else None


def _converter(campo, v):
    if campo in CAMPOS_INTEIROS:
        return _inteiro(v)
    if campo in CAMPOS_VALOR:
        return _valor(v)
    if campo in CAMPOS_DATA:
        return _data(v)
    return None


def _empresa(bruta):
    codigo = _inteiro(bruta.get('codigo'))
    if codigo is None:
        return None
    nome = bruta.get('nome')
    return {
        'codigo': codigo,
        'documento': _documento(bruta.get('documento')),
        'nome': str(nome).strip() if nome is not None and str(nome).strip() else None,
        'ativa': _ativa(bruta.get('ativa')),
    }


def _minusculas(linha):
    return {str(k).lower(): v for k, v in linha.items()}


# ---------- a montagem ----------

def ler(fonte, comps, registro):
    """Lê a fonte e devolve (empresas, mensal, faltou). Levanta SemEmpresas se a consulta de empresas não existe."""
    try:
        brutas = fonte.empresas()
    except ConsultaAConferir:
        raise SemEmpresas()

    empresas, vistas, descartadas = [], set(), 0
    for b in brutas:
        e = _empresa(_minusculas(b))
        if e is None or e['codigo'] in vistas:
            descartadas += 1
            continue
        vistas.add(e['codigo'])
        empresas.append(e)
    if descartadas:
        registro(f'{descartadas} linha(s) de empresas sem código numérico ou com código repetido ficaram de fora', 'aviso')
    empresas.sort(key=lambda e: e['codigo'])

    mensal = {}
    for comp in comps:
        for e in empresas:
            linha = {'codigo': e['codigo'], 'competencia': comp}
            linha.update({c: None for c in ORDEM_MENSAL[2:]})
            mensal[(e['codigo'], comp)] = linha

    faltou = []
    for bloco in BLOCOS:
        campos = CAMPOS_MES[bloco]
        recebido = {}            # (codigo, comp) -> valores convertidos deste bloco
        motivo = None
        sem_empresa = estranhos = 0
        try:
            for comp in comps:
                for bruta in getattr(fonte, bloco)(comp):
                    linha = _minusculas(bruta)
                    codigo = _inteiro(linha.get('codigo'))
                    if (codigo, comp) not in mensal:
                        sem_empresa += 1
                        continue
                    if (codigo, comp) in recebido:
                        motivo = 'mais de uma linha por empresa no mês (a consulta não veio contada)'
                        break
                    valores = {}
                    for c in campos:
                        if c in linha:
                            valores[c] = _converter(c, linha[c])
                            if valores[c] is None and linha[c] is not None:
                                estranhos += 1
                    recebido[(codigo, comp)] = valores
                if motivo:
                    break
        except ConsultaAConferir:
            motivo = 'consulta a conferir'
        except Exception as e:   # erro do banco/driver: o bloco fica de fora, o resto segue
            motivo = 'erro na consulta'
            registro(f'bloco {bloco}: a consulta deu erro ({type(e).__name__}: {e})', 'erro')

        if motivo:
            faltou.append({'bloco': bloco, 'motivo': motivo})
            if motivo != 'consulta a conferir':
                registro(f'bloco {bloco} ficou de fora: {motivo}', 'aviso')
            continue
        for chave, valores in recebido.items():
            mensal[chave].update(valores)
        if sem_empresa:
            registro(f'bloco {bloco}: {sem_empresa} linha(s) de empresa que não está na lista de empresas ficaram de fora', 'aviso')
        if estranhos:
            registro(f'bloco {bloco}: {estranhos} valor(es) que não deu pra entender foram em branco (null)', 'aviso')

    ordenadas = sorted(mensal.values(), key=lambda l: (l['competencia'], l['codigo']))
    return empresas, [{c: l[c] for c in ORDEM_MENSAL} for l in ordenadas], faltou


def montar(fonte, meses, registro, inicio=None, dados_ate=None):
    """O pacote inteiro, pronto pra virar JSON."""
    inicio = inicio or agora()
    dados_ate = dados_ate or ontem()
    comps = competencias(dados_ate, meses)
    empresas, mensal, faltou = ler(fonte, comps, registro)
    return {
        'versao': VERSAO_PACOTE,
        'rodada': {
            'id': str(uuid.uuid4()),
            'inicio': inicio,
            'fim': agora(),
            'dados_ate': dados_ate.isoformat(),
            'maquina': socket.gethostname(),
            'ponte': VERSAO,
        },
        'empresas': empresas,
        'mensal': mensal,
        'faltou': faltou,
    }


def resumo(pacote):
    emp = pacote['empresas']
    comps = sorted({l['competencia'] for l in pacote['mensal']})
    texto = (f"{len(emp)} empresa(s) ({sum(1 for e in emp if e['ativa'])} ativa(s)), "
             f"{len(pacote['mensal'])} linha(s) mensal(is)")
    if comps:
        texto += f' de {comps[0]} a {comps[-1]}'
    if pacote['faltou']:
        texto += '; faltou: ' + ', '.join(f"{f['bloco']} ({f['motivo']})" for f in pacote['faltou'])
    return texto
