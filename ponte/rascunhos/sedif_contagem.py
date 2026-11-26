"""Rascunho (26/11/2026), fora da ponte: quantas NF-e de compra das empresas da SEDIF/DeSTDA a Domínio tem na janela,
por mês da data de entrada, do RS ou de fora, e se o Catálogo de Notas da Domínio Atendimento ainda tem o XML de cada uma
(as que a ponte 0.7.0 não manda por falta dele) ou se o fornecedor é pessoa física (as que ela deixa de fora).

Só lê: pede ao sistema a mesma lista da ponte (as empresas e a janela) e roda a sedif_lista.sql de cada empresa, pela
conexão da ponte. Escreve só as contagens somadas de todas as empresas — o mês, RS ou fora, o grupo, quantas notas e de
quantas empresas —, nunca o código, a chave, um CNPJ ou um nome. Da pasta do repositório ou da ponte instalada:

    py -3 ponte\\rascunhos\\sedif_contagem.py
"""
import collections
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2]))

from ponte import config, sedif  # noqa: E402
from ponte.entradas import _data, pedir_empresas  # noqa: E402
from ponte.log import Registro  # noqa: E402


def grupo(linha):
    try:
        pf = int(linha.get('emitente_tipo') or 0) == 2
    except (TypeError, ValueError):
        pf = False
    if pf:
        return 'pessoa física'
    return 'com o XML' if sedif._tem_xml(linha) else 'sem o XML'


def main():
    cfg = config.carregar()
    if not cfg.existe or cfg.erro_leitura or cfg.falta(list(config.CAMPOS_SISTEMA) + list(config.CAMPOS_DOMINIO)):
        print('a configuração da ponte não deixa rodar (o config.ini)')
        return 2
    reg = Registro(config.pasta() / 'logs', segredos=cfg.segredos())
    lista, status = pedir_empresas(cfg, reg, rotulo='sedif-contagem')
    if lista is None:
        print('o sistema não deu a lista das empresas' + (f' (HTTP {status})' if status else ''))
        return 1
    codigos, ini, fim = lista
    print(f'{len(codigos)} empresa(s), de {ini:%d/%m/%Y} a {fim:%d/%m/%Y}')
    notas = collections.Counter()
    empresas = collections.defaultdict(set)
    erros = 0
    fonte = sedif._fonte_dominio(cfg.valor('dominio', 'conexao'))
    try:
        for cod in codigos:
            try:
                linhas = fonte.lista(cod, ini, fim)
            except Exception as e:
                erros += 1
                print(f'uma empresa deu erro na leitura ({type(e).__name__})')
                continue
            vistas = set()
            for l in linhas:
                chave = str(l.get('chave') or '').strip().upper()
                d = _data(l.get('entrada'))
                if len(chave) != 44 or d is None or chave in vistas:
                    continue
                vistas.add(chave)
                k = (f'{d:%Y-%m}', 'RS' if chave[:2] == '43' else 'fora', grupo(l))
                notas[k] += 1
                empresas[k].add(cod)
    finally:
        fonte.fechar()
    print('mês | RS ou fora | grupo | notas | empresas')
    for k in sorted(notas):
        print(f'{k[0]} | {k[1]} | {k[2]} | {notas[k]} | {len(empresas[k])}')
    if erros:
        print(f'{erros} empresa(s) com erro na leitura')
    return 0 if not erros else 1


if __name__ == '__main__':
    sys.exit(main())
