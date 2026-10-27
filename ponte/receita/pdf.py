"""O que a ponte lê dos PDFs do Serpro (pelo texto, com o pypdf). O PDF fica em C:\\ponte-dominio\\receita\\pdfs\\ e
nunca sai do PC; do texto sai só:

    da declaração do PGDAS-D   a receita bruta do mês (RPA) e a dos 12 meses anteriores (RBT12), com os centavos —
                               a coluna Total (mercado interno + externo)
    do relatório de situação   se há pendência e, se houver, o título de cada uma e de qual órgão (Receita ou PGFN);
    fiscal                     "Não foram detectadas pendências" = lista vazia

Não achou o que procurava no texto: None — quem chama põe o bloco no faltou com 'a_conferir' e o PDF fica guardado pra
quem for ajustar a leitura. Nunca um número inventado.
"""
import io
import re
from decimal import Decimal, InvalidOperation

_VALOR = r'(\d{1,3}(?:\.\d{3})*,\d{2})'
# "Receita Bruta do PA (RPA) - Competência   20.000,00   0,00   20.000,00" (mercado interno, externo, total)
_RPA = re.compile(r'\(RPA\)\s*-\s*\w+\s+' + _VALOR + r'\s+' + _VALOR + r'\s+' + _VALOR)
# "... doze meses anteriores ao PA (RBT12)   12.000,00   0,00   12.000,00" — e não o (RBT12p), o proporcionalizado
_RBT12 = re.compile(r'\(RBT12\)\s+' + _VALOR + r'\s+' + _VALOR + r'\s+' + _VALOR)
_SEM_PENDENCIA = re.compile(r'N[ãa]o\s+foram\s+detectadas\s+pend[êe]ncias', re.I)
_PENDENCIA = re.compile(r'^\s*((?:Pend[êe]ncia\s*[-–]|Omiss[ãa]o\s+de\s)[^\n]*?)\s*$', re.I | re.M)
_SECAO_RECEITA = re.compile(r'Diagn[óo]stico\s+Fiscal\s+na\s+Receita\s+Federal(?!\s+e\s+Procuradoria)', re.I)
_SECAO_PGFN = re.compile(r'Diagn[óo]stico\s+Fiscal\s+na\s+Procuradoria', re.I)


def texto(conteudo):
    """O texto de todas as páginas; None se o pypdf não conseguir ler."""
    try:
        from pypdf import PdfReader
    except ImportError:
        raise RuntimeError('falta o pypdf — instale com: py -3 -m pip install cryptography pypdf')
    import logging
    logging.getLogger('pypdf').setLevel(logging.ERROR)   # os avisos dele sobre PDF torto não são da conta da tela
    try:
        leitor = PdfReader(io.BytesIO(conteudo))
        return '\n'.join((p.extract_text() or '') for p in leitor.pages)
    except Exception:
        return None


def _valor(txt):
    try:
        return float(Decimal(txt.replace('.', '').replace(',', '.')).quantize(Decimal('0.01')))
    except (InvalidOperation, ValueError):
        return None


def ler_declaracao(txt):
    """(receita do mês, receita dos 12 meses) — cada um None se não achou."""
    if not txt:
        return None, None
    rpa = _RPA.search(txt)
    rbt12 = _RBT12.search(txt)
    return (_valor(rpa.group(3)) if rpa else None), (_valor(rbt12.group(3)) if rbt12 else None)


def ler_situacao(txt):
    """[{orgao, titulo}] — [] sem pendência; None se o texto não diz nem uma coisa nem outra."""
    if not txt:
        return None
    if _SEM_PENDENCIA.search(txt) and not _PENDENCIA.search(txt):
        return []
    pendencias, vistas = [], set()
    secoes = sorted([(m.start(), 'Receita') for m in _SECAO_RECEITA.finditer(txt)] +
                    [(m.start(), 'PGFN') for m in _SECAO_PGFN.finditer(txt)])
    for m in _PENDENCIA.finditer(txt):
        titulo = re.sub(r'\s+', ' ', m.group(1)).strip()
        antes = [o for pos, o in secoes if pos < m.start()]
        orgao = antes[-1] if antes else ('PGFN' if re.search(r'SIDA|Inscri[çc][ãa]o', titulo, re.I) else 'Receita')
        if (orgao, titulo) not in vistas:
            vistas.add((orgao, titulo))
            pendencias.append({'orgao': orgao, 'titulo': titulo})
    return pendencias or None
