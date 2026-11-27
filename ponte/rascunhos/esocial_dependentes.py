r"""Rascunho (27/11/2026), fora da ponte: os dependentes dos empregados ativos sem CPF ou com CPF que não fecha, por
empresa — desde 23/11/2026 o eSocial confere na base da Receita o CPF dos dependentes informados (a Nota Técnica S-1.3
nº 07/2026, rev. 20/10/2026), e a folha de novembro e o 13º são a primeira transmissão grande com a regra.

Só lê, pela conexão da ponte (o config.ini, sem abri-lo aqui): roda a esocial_dependentes.sql (nesta pasta) e conta.
  - sem CPF: o CPF nulo, vazio ou só com zeros;
  - CPF que não fecha: sem 11 dígitos, com os 11 dígitos iguais ou com o dígito verificador (os dois, módulo 11) errado;
  - CPF repetido: o mesmo CPF em dois dependentes ou mais do mesmo empregado (contam todos os que repetem; o
    dependente com o CPF que não fecha e repetido conta nos dois).
Grava, só no PC, em C:\ponte-dominio\esocial\ (pra Vitória; não se abrem nesta conversa):
  - dependentes-por-empresa.csv: uma linha por empresa com pendência — o código no Domínio, o nome, quantos empregados
    ativos, quantos dependentes, quantos sem CPF, com CPF que não fecha e repetidos;
  - dependentes-por-empregado.csv: uma linha por empregado com pendência — a empresa (o código e o nome), o nome do
    empregado e quantos dependentes dele estão sem CPF, com CPF que não fecha e repetidos. Sem o nome do dependente e sem
    CPF nenhum: a Vitória acha o dependente no cadastro do empregado, na Domínio.
  Separador ; e UTF-8 com BOM (abre direto no Excel).
Na tela e no log, só os totais somados de todas as empresas. Nada por empresa.

    py -3 ponte\rascunhos\esocial_dependentes.py
"""
import collections
import csv
import datetime as dt
import pathlib
import re
import sys
import time

AQUI = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI.parents[1]))

from ponte import config  # noqa: E402
from ponte.log import Registro  # noqa: E402
from ponte.notas.fonte import FonteNotasDominio  # noqa: E402

SAIDA = pathlib.Path(r'C:\ponte-dominio\esocial')
OUTUBRO = (dt.date(2026, 10, 1), dt.date(2026, 10, 31))
NOVEMBRO = dt.date(2026, 11, 1)


def situacao(cpf):
    """'sem', 'nao_fecha' ou 'ok' — e os dígitos."""
    d = re.sub(r'\D', '', str(cpf or ''))
    if not d or set(d) == {'0'}:
        return 'sem', d
    if len(d) != 11 or len(set(d)) == 1:
        return 'nao_fecha', d
    for n in (9, 10):
        s = sum(int(d[i]) * (n + 1 - i) for i in range(n))
        if (s * 10) % 11 % 10 != int(d[n]):
            return 'nao_fecha', d
    return 'ok', d


def contar(linhas):
    """As contagens por empresa e por empregado (no PC) e os totais (pra tela)."""
    empresas = {}
    empregados = collections.defaultdict(list)            # (empresa, empregado) -> [(situação, dígitos, irrf, salfam)]
    nomes = {}
    for l in linhas:
        emp = l['empresa']
        empresas.setdefault(emp, str(l.get('empresa_nome') or '').strip())
        if l.get('empregado') is None:
            continue
        k = (emp, l['empregado'])
        nomes[k] = str(l.get('empregado_nome') or '').strip()
        empregados.setdefault(k, [])
        if l.get('dependente') is not None:
            sit, dig = situacao(l.get('cpf'))
            empregados[k].append((sit, dig, int(l.get('irrf_vale') or 0), int(l.get('salfam_vale') or 0)))
    por_empresa = collections.defaultdict(lambda: collections.Counter())
    por_empregado = {}
    tot = collections.Counter()
    for k, deps in empregados.items():
        emp = k[0]
        repete = collections.Counter(d for s, d, *_ in deps if s != 'sem')
        c = collections.Counter()
        for s, d, irrf, salfam in deps:
            c['dependentes'] += 1
            pend = False
            if s == 'sem':
                c['sem'] += 1
                pend = True
            elif s == 'nao_fecha':
                c['nao_fecha'] += 1
                pend = True
            if s != 'sem' and repete[d] > 1:
                c['repetido'] += 1
                pend = True
            if pend:
                c['pendentes'] += 1
                c['pendentes_valendo'] += 1 if (irrf or salfam) else 0
        por_empresa[emp]['empregados'] += 1
        for x in ('dependentes', 'sem', 'nao_fecha', 'repetido', 'pendentes', 'pendentes_valendo'):
            por_empresa[emp][x] += c[x]
        if c['pendentes']:
            por_empregado[k] = c
    tot['empresas_lidas'] = len(empresas)
    tot['empresas_com_empregado'] = len(por_empresa)
    tot['empresas_com_pendencia'] = sum(1 for c in por_empresa.values() if c['pendentes'])
    for c in por_empresa.values():
        for x in ('empregados', 'dependentes', 'sem', 'nao_fecha', 'repetido', 'pendentes', 'pendentes_valendo'):
            tot[x] += c[x]
    tot['empregados_com_pendencia'] = len(por_empregado)
    return empresas, por_empresa, por_empregado, nomes, tot


def gravar(empresas, por_empresa, por_empregado, nomes):
    SAIDA.mkdir(parents=True, exist_ok=True)
    with open(SAIDA / 'dependentes-por-empresa.csv', 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f, delimiter=';')
        w.writerow(['codigo_empresa', 'empresa', 'empregados_ativos', 'dependentes', 'sem_cpf', 'cpf_nao_fecha',
                    'cpf_repetido'])
        for emp in sorted(por_empresa, key=lambda e: (-por_empresa[e]['pendentes'], empresas[e])):
            c = por_empresa[emp]
            if c['pendentes']:
                w.writerow([emp, empresas[emp], c['empregados'], c['dependentes'], c['sem'], c['nao_fecha'],
                            c['repetido']])
    with open(SAIDA / 'dependentes-por-empregado.csv', 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f, delimiter=';')
        w.writerow(['codigo_empresa', 'empresa', 'empregado', 'sem_cpf', 'cpf_nao_fecha', 'cpf_repetido'])
        for k in sorted(por_empregado, key=lambda k: (empresas[k[0]], nomes[k])):
            c = por_empregado[k]
            w.writerow([k[0], empresas[k[0]], nomes[k], c['sem'], c['nao_fecha'], c['repetido']])


def main():
    cfg = config.carregar()
    if not cfg.existe or cfg.erro_leitura or cfg.falta(list(config.CAMPOS_DOMINIO)):
        print('a configuração da ponte não deixa rodar (o config.ini)')
        return 2
    reg = Registro(config.pasta() / 'logs', segredos=cfg.segredos())
    t0 = time.monotonic()
    hoje = dt.date.today()
    fonte = FonteNotasDominio(cfg.valor('dominio', 'conexao'), pasta_consultas=AQUI)
    try:
        linhas = fonte._consultar('esocial_dependentes', (OUTUBRO[0], OUTUBRO[1], NOVEMBRO, hoje))
    except Exception as e:
        reg(f'esocial: a leitura da Domínio deu erro ({type(e).__name__})', 'erro')
        return 1
    finally:
        fonte.fechar()
    empresas, por_empresa, por_empregado, nomes, t = contar(linhas)
    gravar(empresas, por_empresa, por_empregado, nomes)
    reg(f'esocial: os dependentes dos empregados ativos (31/10/2026 e, com a folha de 11/2026 calculada, hoje) — '
        f'{t["empresas_lidas"]} empresa(s) lida(s), {t["empresas_com_empregado"]} com empregado ativo, '
        f'{t["empresas_com_pendencia"]} com pendência; {t["empregados"]} empregado(s) ativo(s), {t["dependentes"]} '
        f'dependente(s): {t["sem"]} sem CPF, {t["nao_fecha"]} com CPF que não fecha, {t["repetido"]} com CPF repetido; '
        f'{t["empregados_com_pendencia"]} empregado(s) com pendência ({t["pendentes"]} dependente(s) com pendência, '
        f'{t["pendentes_valendo"]} deles ainda contando pro IRRF ou o salário-família) · {time.monotonic() - t0:.1f} s')
    reg(f'esocial: gravados em {SAIDA}: dependentes-por-empresa.csv e dependentes-por-empregado.csv')
    return 0


if __name__ == '__main__':
    sys.exit(main())
