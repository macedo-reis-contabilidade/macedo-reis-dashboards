"""py -3 -m ponte conferir | rodar [--falso] [--sem-enviar] [--saida arquivo.json] [--meses N]
   py -3 -m ponte receita conferir | rodar [--demonstracao | --falso] [--sem-enviar] [--saida arquivo.json]
                                           [--so servico,servico] [--empresas N]   (a ponte da Receita)
   py -3 -m ponte chave [--trocar]          (gera a chave da ponte no config.ini e mostra só a impressão digital)"""
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


def _servicos(texto):
    from .receita import SERVICOS
    lista = [s.strip() for s in texto.split(',') if s.strip()]
    errados = [s for s in lista if s not in SERVICOS]
    if not lista or errados:
        raise argparse.ArgumentTypeError('use um ou mais de: ' + ','.join(SERVICOS)
                                         + (f" (não conheço: {', '.join(errados)})" if errados else ''))
    return list(dict.fromkeys(lista))


def _empresas(texto):
    try:
        n = int(texto)
    except ValueError:
        raise argparse.ArgumentTypeError('tem que ser um número inteiro')
    if n < 1:
        raise argparse.ArgumentTypeError('tem que ser 1 ou mais')
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
    rec = sub.add_parser('receita', help='a ponte da Receita (Integra Contador do Serpro) — o LEIA-ME explica')
    rsub = rec.add_subparsers(dest='acao', required=True)
    rsub.add_parser('conferir', help='confere a [integra], o certificado, o token e o sistema — não grava nem manda nada')
    rr = rsub.add_parser('rodar', help='a rodada: pede as empresas ao sistema, consulta o Serpro, manda, registra')
    modo = rr.add_mutually_exclusive_group()
    modo.add_argument('--demonstracao', action='store_true',
                      help='usa o ambiente de demonstração do Serpro (respostas fixas, sem custo)')
    modo.add_argument('--falso', action='store_true', help='usa o Serpro de mentira dos testes (só manda pra endereço local)')
    rr.add_argument('--sem-enviar', action='store_true', help='não manda: mostra o resumo (e grava o pacote com --saida)')
    rr.add_argument('--saida', metavar='arquivo.json', help='grava o pacote neste arquivo (sem pasta = na pasta da ponte)')
    rr.add_argument('--so', type=_servicos, metavar='servico,servico',
                    help='roda só estes, agora, fora do calendário: autorizacao,pgdas,faturamento,caixa_postal,situacao_fiscal')
    rr.add_argument('--empresas', type=_empresas, metavar='N', help='só as N primeiras empresas da lista')
    ch = sub.add_parser('chave', help='gera a chave da ponte (x-chave) no config.ini e mostra só a impressão digital')
    ch.add_argument('--trocar', action='store_true', help='troca a chave que existe (pede confirmação)')
    args = p.parse_args(argv)

    if args.comando == 'chave':
        from .chave import chave
        return chave(trocar=args.trocar)

    if args.comando == 'receita':
        if args.acao == 'conferir':
            from .receita.conferir import conferir as conferir_receita
            return conferir_receita()
        from .receita.rodada import rodar as rodar_receita
        return rodar_receita(demonstracao=args.demonstracao, falso=args.falso, sem_enviar=args.sem_enviar,
                             saida=args.saida, so=args.so, empresas_max=args.empresas)
    if args.comando == 'conferir':
        from .conferir import conferir
        return conferir()
    from .rodada import rodar
    return rodar(falso=args.falso, sem_enviar=args.sem_enviar, saida=args.saida, meses=args.meses)


if __name__ == '__main__':
    sys.exit(main())
