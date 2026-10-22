"""py -3 -m ponte conferir | rodar [--falso] [--sem-enviar] [--saida arquivo.json] [--meses N]"""
import argparse
import sys

if sys.version_info < (3, 11):
    sys.exit('A ponte do Domínio pede o Python 3.11 ou mais novo (py -0p mostra os instalados).')

from . import VERSAO, config
from .log import saida_tolerante


def _meses(texto):
    try:
        n = int(texto)
    except ValueError:
        raise argparse.ArgumentTypeError('tem que ser um número inteiro')
    if not 1 <= n <= config.MESES_MAX:
        raise argparse.ArgumentTypeError(f'de 1 a {config.MESES_MAX}')
    return n


def main(argv=None):
    saida_tolerante()
    p = argparse.ArgumentParser(prog='py -3 -m ponte', description=f'Ponte do Domínio {VERSAO}')
    sub = p.add_subparsers(dest='comando', required=True)
    sub.add_parser('conferir', help='confere o PC, a configuração, a conexão e o sistema — não grava nem manda nada')
    r = sub.add_parser('rodar', help='a rodada: lê o Domínio, monta o pacote, manda, registra')
    r.add_argument('--falso', action='store_true', help='lê do Domínio de mentira (empresas inventadas)')
    r.add_argument('--sem-enviar', action='store_true', help='não manda: mostra o resumo (e grava o pacote com --saida)')
    r.add_argument('--saida', metavar='arquivo.json', help='grava o pacote neste arquivo')
    r.add_argument('--meses', type=_meses, metavar='N',
                   help=f'quantos meses, contando o atual (padrão: o do config.ini, ou {config.MESES_PADRAO}; até {config.MESES_MAX})')
    args = p.parse_args(argv)

    if args.comando == 'conferir':
        from .conferir import conferir
        return conferir()
    from .rodada import rodar
    return rodar(falso=args.falso, sem_enviar=args.sem_enviar, saida=args.saida, meses=args.meses)


if __name__ == '__main__':
    sys.exit(main())
