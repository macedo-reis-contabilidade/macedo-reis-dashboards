"""`py -3 -m ponte chave [--trocar]` — a chave da ponte (o segredo do cabeçalho x-chave) nasce aqui no PC.

Gera a chave (secrets.token_urlsafe(32), só ASCII) e grava no [sistema] chave_ponte do config.ini só se o campo estiver
vazio ou ainda for o do exemplo; com --trocar, troca a que existe depois de confirmar com "s". Mostra só a IMPRESSÃO
DIGITAL: o SHA-256 dos bytes UTF-8 da chave, em hexadecimal minúsculo (64 caracteres) — o que o sistema guarda
(configuracoes_escritorio.ponte_chave_sha256) e confere em cada pacote. A impressão não é segredo; a chave nunca
aparece: nem na tela, nem no log, nem no pacote.

O config.ini é mexido como texto, só na linha do chave_ponte: os comentários, a ordem, o BOM, as quebras de linha e as
permissões do arquivo (legível só pelo usuário) ficam como estavam.

Código de saída: 0 gerou (ou a chave já existia e só mostrei a impressão); 1 o --trocar não foi confirmado; 2 não há
config.ini, ele não abre, ou a chave dele está inválida (use --trocar).
"""
import hashlib
import re
import secrets

from . import config
from .log import Registro

RECADO = 'Mande esta impressão pro Claude da sessão do Samuel (ela não é segredo).'
OK, NAO_TROCOU, NAO_ADIANTA = 0, 1, 2


def impressao(chave):
    """O SHA-256 dos bytes UTF-8 da chave, em hexadecimal minúsculo — o que vai pro sistema."""
    return hashlib.sha256(chave.encode('utf-8')).hexdigest()


def gravar_campo(arquivo, secao, campo, valor):
    """Troca (ou acrescenta) `campo = valor` na seção, mexendo só nessa linha (e nas linhas de continuação dela)."""
    bruto = arquivo.read_bytes()
    bom = bruto.startswith(b'\xef\xbb\xbf')
    texto = bruto[3:].decode('utf-8') if bom else bruto.decode('utf-8')
    nl = '\r\n' if '\r\n' in texto else '\n'
    linhas = texto.replace('\r\n', '\n').split('\n')
    final = linhas[-1] == ''
    if final:
        linhas.pop()
    nova = f'{campo} = {valor}'
    cabecalho = re.compile(r'^\s*\[(.+?)\]\s*$')
    inicio = next((i for i, lin in enumerate(linhas)
                   if (m := cabecalho.match(lin)) and m.group(1).strip().lower() == secao.lower()), None)
    if inicio is None:
        linhas += ['', f'[{secao}]', nova]
    else:
        j, achou = inicio + 1, False
        while j < len(linhas) and not cabecalho.match(linhas[j]):
            m = re.match(r'^([^\s=:;#\[][^=:]*?)\s*[=:]', linhas[j])
            if m and m.group(1).strip().lower() == campo.lower():
                fim = j + 1
                # o valor colado em duas linhas (continuação indentada) sai junto
                while fim < len(linhas) and linhas[fim].strip() and linhas[fim][:1] in (' ', '\t'):
                    fim += 1
                linhas[j:fim] = [nova]
                achou = True
                break
            j += 1
        if not achou:
            linhas.insert(inicio + 1, nova)
    saida = nl.join(linhas) + (nl if final else '')
    # write_bytes reescreve o mesmo arquivo: as permissões dele (só o usuário) ficam
    arquivo.write_bytes((b'\xef\xbb\xbf' if bom else b'') + saida.encode('utf-8'))


def chave(trocar=False, perguntar=input):
    base = config.pasta()
    cfg = config.carregar()
    tela = Registro(None, segredos=cfg.segredos())
    if not cfg.existe:
        tela(f'Não achei {cfg.arquivo} — copie o ponte/config.exemplo.ini pra lá (o instalar.ps1 cria) e rode de novo.')
        return NAO_ADIANTA
    if cfg.erro_leitura:
        tela(f'Não consegui ler {cfg.arquivo} ({cfg.erro_leitura}) — confira o formato com o config.exemplo.ini.')
        return NAO_ADIANTA
    situacao = cfg.situacao('sistema', 'chave_ponte')
    atual = cfg.valor('sistema', 'chave_ponte')
    if situacao == 'preenchido' and not trocar:
        tela('A chave da ponte já existe no config.ini — não mudei nada (pra gerar outra: py -3 -m ponte chave --trocar).')
        tela(f'Impressão digital: {impressao(atual)}')
        return OK
    if situacao not in ('falta', 'ainda é o do exemplo', 'preenchido') and not trocar:
        tela(f'A [sistema] chave_ponte do config.ini está {situacao}: gere outra com py -3 -m ponte chave --trocar.')
        return NAO_ADIANTA
    if trocar and situacao not in ('falta', 'ainda é o do exemplo'):
        try:
            resposta = perguntar('Trocar a chave da ponte? A de agora para de valer: o sistema recusa a ponte até a '
                                 'impressão nova ser cadastrada lá. Digite s pra trocar: ')
        except EOFError:
            resposta = ''
        if (resposta or '').strip().lower() != 's':
            tela('Não troquei: a chave continua a mesma.')
            return NAO_TROCOU

    nova = secrets.token_urlsafe(32)
    reg = Registro(base / 'logs', segredos=cfg.segredos() + [nova])
    gravar_campo(cfg.arquivo, 'sistema', 'chave_ponte', nova)
    if config.carregar().valor('sistema', 'chave_ponte') != nova:
        reg(f'não consegui gravar a chave da ponte em {cfg.arquivo} — confira o arquivo (nada foi mandado)', 'erro')
        return NAO_ADIANTA
    marca = impressao(nova)
    nova = None
    reg(f"chave da ponte {'trocada' if situacao == 'preenchido' else 'gerada'} e gravada em {cfg.arquivo} "
        f'(o valor não aparece); impressão digital {marca}')
    tela('')
    tela(f'Impressão digital: {marca}')
    tela(RECADO)
    return OK
