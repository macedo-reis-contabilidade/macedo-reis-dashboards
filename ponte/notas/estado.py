"""O que a ponte das notas lembra entre as rodadas: C:\\ponte-dominio\\notas\\estado.json (fora do repositório).

    {"versao": 1, "empresas": {"<código>": {"documento": "...", "notas": {"<chave>": {"entrada": "AAAA-MM-DD",
        "impressao": "<sha-256>", "origem": "xml" | "dominio", "mandada_em": "<data e hora>"}}}}}

Nada da nota além disso (o contrato da fila: a chave, a data de entrada, a impressão digital, o origem e quando foi).
A nota vai quando é nova ou a impressão mudou; a mandada do XML não vai de novo pela Domínio (quando a Domínio apaga o
XML, a nota passaria a sair dela, e o destino fica com a do XML de qualquer jeito); a empresa que sai da lista some.
O arquivo só é gravado fora do --sem-enviar, depois de cada pacote que foi (as recusadas contam como mandadas).
"""
import json
import os


class Estado:
    def __init__(self, pasta, gravar=True):
        self.pasta = pasta
        self.arquivo = pasta / 'estado.json'
        self.pode_gravar = gravar
        self.dados = {'versao': 1, 'empresas': {}}
        try:
            lido = json.loads(self.arquivo.read_text(encoding='utf-8'))
            if isinstance(lido, dict) and isinstance(lido.get('empresas'), dict):
                self.dados = lido
        except (FileNotFoundError, ValueError, UnicodeDecodeError):
            pass

    def _empresa(self, codigo):
        return self.dados['empresas'].get(str(codigo))

    def conhece(self, codigo, documento):
        e = self._empresa(codigo)
        return bool(e) and e.get('documento') == documento

    def nota(self, codigo, chave):
        e = self._empresa(codigo)
        return (e or {}).get('notas', {}).get(chave)

    def vai(self, codigo, chave, impressao, origem):
        """(vai, por que não): a nota nova ou que mudou vai; a mandada do XML não volta pela Domínio."""
        antes = self.nota(codigo, chave)
        if antes is None:
            return True, None
        if antes.get('origem') == 'xml' and origem == 'dominio':
            return False, 'ja_foi_com_xml'
        if antes.get('impressao') == impressao:
            return False, 'igual'
        return True, None

    def marcar(self, codigo, documento, notas, quando):
        """notas: [(chave, entrada, impressao, origem)] — as do pacote que foi."""
        e = self.dados['empresas'].setdefault(str(codigo), {'documento': documento, 'notas': {}})
        if e.get('documento') != documento:
            e['documento'], e['notas'] = documento, {}
        for chave, entrada, imp, origem in notas:
            e['notas'][chave] = {'entrada': entrada, 'impressao': imp, 'origem': origem, 'mandada_em': quando}

    def esquecer_documento_outro(self, codigo, documento):
        e = self._empresa(codigo)
        if e and e.get('documento') != documento:
            del self.dados['empresas'][str(codigo)]

    def manter_so(self, codigos):
        """A empresa que saiu da lista some do estado. Devolve quantas saíram."""
        fora = [c for c in self.dados['empresas'] if c not in {str(x) for x in codigos}]
        for c in fora:
            del self.dados['empresas'][c]
        return len(fora)

    def gravar(self):
        if not self.pode_gravar:
            return
        self.pasta.mkdir(parents=True, exist_ok=True)
        tmp = self.arquivo.with_suffix('.tmp')
        tmp.write_text(json.dumps(self.dados, ensure_ascii=False), encoding='utf-8')
        os.replace(tmp, self.arquivo)
