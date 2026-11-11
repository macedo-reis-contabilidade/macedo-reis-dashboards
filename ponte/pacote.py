"""Monta o pacote — o contrato com o sistema (versão 4, desde 09/11/2026).

    { "versao": 4,
      "rodada":   { id, inicio, fim, dados_ate, maquina, ponte },
      "empresas": [ { codigo, documento, nome, ativa } ],
      "mensal":   [ { codigo, competencia 'AAAA-MM', funcionarios_ativos, admissoes, desligamentos, afastados,
                      pro_labore, notas_saida, valor_saidas, notas_entrada, valor_entradas,
                      lancamentos, ultimo_lancamento,
                      + faturamento: receita_bruta, receita_mercadorias, receita_servicos, devolucoes,
                        receita_simples, receita_simples_propria, receita_st, receita_monofasica, receita_exportacao,
                        receita_anexo_1 … receita_anexo_5, rbt12, meses_rbt12
                      + compras: compras, compras_st, servicos_tomados, ativo_e_consumo, devolucoes_de_venda,
                        outras_entradas
                      + folha_valores: salarios, ferias, rescisoes, decimo_terceiro, pro_labore_valor, base_inss,
                        base_fgts, fgts, inss_empresa, inss_rat, inss_terceiros
                      + origens: lanc_normais, lanc_extrato, lanc_fiscal, lanc_folha, lanc_apuracao, lanc_outros,
                        incluido_ate
                      + cruzamentos: receita_lancada, folha_lancada, encargos_lancados
                      + saldos: caixa_negativo, contra_natureza, sem_natureza, transitorias, transitorias_valor } ],
      "andamento":    [ { codigo, banco_contas, banco_ate, banco_ultimo, banco_ultimo_geral, caixa_ate,
                          caixa_contador_ate, extrato_contas, extrato_ate, extrato_pendentes, conciliadas,
                          conciliado_ate, fechamento_em } ],                 (a foto do dia)
      "encerramento": [ { codigo, ano, zerado_em, zeramentos, zerado_incluido_em, lancados_depois,
                          lancamentos_do_ano } ],                            (os dois anos antes do de hoje)
      "jornadas":     [ { codigo, jornada, tipo, tipo_escala, semana, min_semana, min_maior_dia, ciclo_dias,
                          ciclo_trabalho, horas_semana, horas_mes, forma, controle, categoria, unidade, empregados,
                          afastados, compensa_sabado, superior, superior_teto, salarios } ],
                                                     (a foto do dia: uma linha por empresa e grupo de empregados)
      "faltou":   [ { bloco, motivo } ] }

A versão 1 (até 04/11/2026) não tinha o faturamento, as compras e a folha em reais; a 2 (05/11/2026), o andamento das
contabilidades (origens, cruzamentos, saldos, andamento e encerramento); a 3 (05/11/2026), as jornadas (o fim da escala
6x1, 09/11/2026). A versão diz ao sistema quais blocos foram lidos: o que uma versão antiga não tem, ele não mexe no
que já tinha.

Regras:
  - Só esses campos saem. O que a fonte devolver a mais é descartado aqui (a trava do dado pessoal).
  - `mensal`: uma linha por empresa e competência; campo que não veio sai null, nunca um 0 inventado.
  - Um bloco entra inteiro ou fica de fora inteiro: se a consulta está a conferir, deu erro, ou devolveu mais de uma
    linha pra mesma empresa no mês (sinal de que não veio contada), os campos dele ficam null em todas as linhas e
    o bloco vai pro `faltou`. No `andamento`, no `encerramento` e nas `jornadas`, o mesmo: a lista sai vazia e o
    bloco vai pro `faltou` (o sistema não mexe no que tinha deles).
  - `jornadas`: uma linha por empresa e grupo (codigo, jornada, horas_semana, horas_mes, forma, controle, categoria,
    unidade); dois com o mesmo grupo = não veio contada (o bloco fica de fora); o grupo sem empregado não vai. A
    `semana` são sete caracteres (T, C, F ou -, de segunda a domingo); outra coisa vira null. O nome, o CPF, o cargo e
    o salário de cada pessoa nunca saem: só os campos do contrato, somados.
  - `dados_ate` é o dia da rodada: o banco do Domínio Web é o de produção, ao vivo (02/11/2026 — o plano era uma
    cópia do dia anterior, e a ponte usava ontem); as horas, com o fuso do PC.
"""
import datetime
import re
import socket
import uuid
from decimal import Decimal, InvalidOperation

from . import VERSAO
from .fonte import (ANOS_ENCERRAMENTO, BLOCOS, CAMPOS_ANDAMENTO, CAMPOS_DATA, CAMPOS_ENCERRAMENTO, CAMPOS_INTEIROS,
                    CAMPOS_JORNADAS, CAMPOS_MES, CAMPOS_SO_GRUPO_GRANDE, GRUPO_MINIMO_JORNADA, CAMPOS_NUMERO, CAMPOS_SEMANA, CAMPOS_VALOR, GRUPO_JORNADAS,
                    ConsultaAConferir, teto_art8)

VERSAO_PACOTE = 4
ORDEM_MENSAL = ('codigo', 'competencia') + tuple(c for b in BLOCOS for c in CAMPOS_MES[b])


class SemEmpresas(Exception):
    """A consulta de empresas ainda está a conferir: sem ela, não há o que mandar."""


def agora():
    return datetime.datetime.now().astimezone().isoformat(timespec='seconds')


def hoje():
    return datetime.date.today()


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


_SEMANA = re.compile(r'[TCF-]{7}')


def _semana(v):
    """Os sete dias, de segunda a domingo: T trabalhado, C compensado, F folga, - sem horário. Outra coisa: null."""
    if v is None:
        return None
    s = str(v).strip().upper()
    return s if _SEMANA.fullmatch(s) else None


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
    if campo in CAMPOS_VALOR or campo in CAMPOS_NUMERO:
        return _valor(v)
    if campo in CAMPOS_SEMANA:
        return _semana(v)
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


def _ordem(v):
    return (v is None, v if v is not None else 0)


def _ler_lista(fonte, bloco, chamadas, campos, codigos, registro, grupo=None):
    """Um bloco que não é do mês (a foto do dia, o encerramento, as jornadas): `chamadas` é a lista de (argumentos,
    extra) — os argumentos vão pra fonte e o extra (ex.: {'ano': 2025}) entra em cada linha. Sem `grupo`, uma linha por
    empresa (e extra); com `grupo` (os campos que fazem a chave, já convertidos), uma por grupo, e o grupo sem
    empregado fica de fora. Devolve (linhas, motivo): com motivo, o bloco fica de fora inteiro."""
    linhas, vistas = [], set()
    sem_empresa = estranhos = vazios = 0
    try:
        for args, extra in chamadas:
            for bruta in getattr(fonte, bloco)(*args):
                linha = _minusculas(bruta)
                codigo = _inteiro(linha.get('codigo'))
                if codigo not in codigos:
                    sem_empresa += 1
                    continue
                saida = {'codigo': codigo, **extra}
                for c in campos:
                    v = linha.get(c)
                    saida[c] = _converter(c, v)
                    if saida[c] is None and v is not None:
                        estranhos += 1
                if grupo and not (saida.get('empregados') or 0) > 0:
                    vazios += 1
                    continue
                chave = tuple(saida[c] for c in grupo) if grupo else (codigo,) + tuple(extra.values())
                if chave in vistas:
                    return [], ('mais de uma linha por grupo (a consulta não veio contada)' if grupo
                                else 'mais de uma linha por empresa (a consulta não veio contada)')
                vistas.add(chave)
                linhas.append(saida)
    except ConsultaAConferir:
        return [], 'consulta a conferir'
    except Exception as e:   # erro do banco/driver: o bloco fica de fora, o resto segue
        registro(f'bloco {bloco}: a consulta deu erro ({type(e).__name__}: {e})', 'erro')
        return [], 'erro na consulta'
    if sem_empresa:
        registro(f'bloco {bloco}: {sem_empresa} linha(s) de empresa que não está na lista de empresas ficaram de fora', 'aviso')
    if estranhos:
        registro(f'bloco {bloco}: {estranhos} valor(es) que não deu pra entender foram em branco (null)', 'aviso')
    if vazios:
        registro(f'bloco {bloco}: {vazios} grupo(s) sem empregado ficaram de fora', 'aviso')
    if grupo:
        linhas.sort(key=lambda l: tuple(_ordem(l[c]) for c in grupo))
    else:
        linhas.sort(key=lambda l: (l.get('ano', 0), l['codigo']))
    return linhas, None


def ler_fotos(fonte, dados_ate, codigos, registro):
    """A foto do dia (o mês de hoje), o encerramento dos ANOS_ENCERRAMENTO anos antes do de hoje e as jornadas de hoje.
    Devolve (andamento, encerramento, jornadas, faltou)."""
    faltou = []
    mes = f'{dados_ate.year:04d}-{dados_ate.month:02d}'
    andamento, motivo = _ler_lista(fonte, 'andamento', [((mes,), {})], CAMPOS_ANDAMENTO, codigos, registro)
    if motivo:
        faltou.append({'bloco': 'andamento', 'motivo': motivo})
        if motivo != 'consulta a conferir':
            registro(f'bloco andamento ficou de fora: {motivo}', 'aviso')
    anos = [dados_ate.year - n for n in range(ANOS_ENCERRAMENTO, 0, -1)]
    encerramento, motivo = _ler_lista(fonte, 'encerramento', [((a,), {'ano': a}) for a in anos], CAMPOS_ENCERRAMENTO,
                                      codigos, registro)
    if motivo:
        faltou.append({'bloco': 'encerramento', 'motivo': motivo})
        if motivo != 'consulta a conferir':
            registro(f'bloco encerramento ficou de fora: {motivo}', 'aviso')
    # a versão 4 (09/11/2026): as jornadas de hoje, com o salário do art. 8º da EC 141 do ano
    teto, ano_teto = teto_art8(dados_ate.year)
    if ano_teto != dados_ate.year:
        registro(f'jornadas: o salário do art. 8º da EC 141 de {dados_ate.year} não está na ponte (TETO_ART8, em '
                 f'ponte/fonte.py) — usei o de {ano_teto}; ponha o do ano', 'aviso')
    jornadas, motivo = _ler_lista(fonte, 'jornadas', [((dados_ate, teto), {})], CAMPOS_JORNADAS, codigos, registro,
                                  grupo=GRUPO_JORNADAS)
    if motivo:
        faltou.append({'bloco': 'jornadas', 'motivo': motivo})
        if motivo != 'consulta a conferir':
            registro(f'bloco jornadas ficou de fora: {motivo}', 'aviso')
    # o grupo pequeno (11/11/2026, decisão do Samuel): com menos de GRUPO_MINIMO_JORNADA empregados, a soma dos salários,
    # os afastados e os com o superior completo são os de uma ou duas pessoas — saem em branco (null) e ficam no PC
    pequenos = 0
    for l in jornadas:
        if (l.get('empregados') or 0) < GRUPO_MINIMO_JORNADA:
            pequenos += 1
            for c in CAMPOS_SO_GRUPO_GRANDE:
                l[c] = None
    if pequenos:
        registro(f'jornadas: {pequenos} grupo(s) com menos de {GRUPO_MINIMO_JORNADA} empregados foram sem o salário, '
                 f'os afastados e o superior (ficam no PC)')
    return andamento, encerramento, jornadas, faltou


def montar(fonte, meses, registro, inicio=None, dados_ate=None):
    """O pacote inteiro, pronto pra virar JSON."""
    inicio = inicio or agora()
    dados_ate = dados_ate or hoje()
    comps = competencias(dados_ate, meses)
    empresas, mensal, faltou = ler(fonte, comps, registro)
    andamento, encerramento, jornadas, faltou_fotos = ler_fotos(fonte, dados_ate, {e['codigo'] for e in empresas},
                                                                registro)
    faltou = faltou + faltou_fotos
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
        'andamento': andamento,
        'encerramento': encerramento,
        'jornadas': jornadas,
        'faltou': faltou,
    }


def resumo(pacote):
    emp = pacote['empresas']
    comps = sorted({l['competencia'] for l in pacote['mensal']})
    texto = (f"{len(emp)} empresa(s) ({sum(1 for e in emp if e['ativa'])} ativa(s)), "
             f"{len(pacote['mensal'])} linha(s) mensal(is)")
    if comps:
        texto += f' de {comps[0]} a {comps[-1]}'
    if pacote.get('andamento'):
        texto += f"; o andamento de {len(pacote['andamento'])} empresa(s)"
    anos = sorted({l['ano'] for l in pacote.get('encerramento') or []})
    if anos:
        texto += f"; o encerramento de {' e '.join(str(a) for a in anos)}"
    jor = pacote.get('jornadas') or []
    if jor:
        texto += (f"; as jornadas de {len({l['codigo'] for l in jor})} empresa(s) ({len(jor)} grupo(s), "
                  f"{sum(l['empregados'] for l in jor)} empregado(s))")
    if pacote['faltou']:
        texto += '; faltou: ' + ', '.join(f"{f['bloco']} ({f['motivo']})" for f in pacote['faltou'])
    return texto
