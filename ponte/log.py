"""O registro da ponte: uma linha por acontecimento, na tela e em logs\\AAAA-MM-DD.log (um arquivo por dia).

Tudo passa por ocultar() antes de sair: a string de conexão, a senha do banco e as chaves viram "***".
Só segredo de 8 ou mais caracteres é trocado como trecho do texto: um curto (a senha "2026" do certificado) trocaria
também cada "2026" das datas do log. O curto nunca é escrito — a senha do certificado só serve pra abrir o .pfx, e a do
banco, dentro da conexão, sai pelo "PWD=***".
Os logs de mais de 60 dias são apagados no começo de cada rodada.
"""
import datetime
import re
import sys

DIAS_LOG = 60
MINIMO_TRECHO = 8      # segredo mais curto que isto não é procurado no meio do texto (apagaria datas e números)
_SENHA_NA_CONEXAO = re.compile(r'(?i)\b(pwd|password)\s*=\s*[^;]*')
# a ponte da Receita: o token do Serpro e a chave dele (Basic) que uma mensagem de erro repetir
_CREDENCIAL_HTTP = re.compile(r'(?i)\b(bearer|basic)\s+[A-Za-z0-9._~+/=-]{8,}')
_TOKEN_EM_JSON = re.compile(r'(?i)("?(?:access_token|jwt_token|refresh_token)"?\s*[:=]\s*"?)[A-Za-z0-9._~+/=-]{8,}')


def ocultar(texto, segredos=()):
    texto = str(texto)
    # do mais comprido pro mais curto: a conexão inteira antes da senha que está dentro dela
    for s in sorted({s for s in segredos if s and len(s) >= MINIMO_TRECHO}, key=len, reverse=True):
        texto = texto.replace(s, '***')
    texto = _CREDENCIAL_HTTP.sub(r'\1 ***', texto)
    texto = _TOKEN_EM_JSON.sub(r'\1***', texto)
    return _SENHA_NA_CONEXAO.sub(r'\1=***', texto)


class Registro:
    def __init__(self, pasta_logs=None, segredos=()):
        self.pasta = pasta_logs
        self.segredos = list(segredos)
        if self.pasta is not None:
            self.pasta.mkdir(parents=True, exist_ok=True)

    def __call__(self, mensagem, nivel='info'):
        agora = datetime.datetime.now()
        linha = ocultar(mensagem, self.segredos)
        marca = '' if nivel == 'info' else f'[{nivel.upper()}] '
        print(f'{marca}{linha}', flush=True)
        if self.pasta is not None:
            arq = self.pasta / f'{agora:%Y-%m-%d}.log'
            with open(arq, 'a', encoding='utf-8') as f:
                f.write(f'{agora:%H:%M:%S} {marca}{linha}\n')

    def tela(self, mensagem):
        """Só na tela, nunca no arquivo (ex.: o IP de saída)."""
        print(ocultar(mensagem, self.segredos), flush=True)

    def limpar_antigos(self, dias=DIAS_LOG):
        if self.pasta is None:
            return
        limite = datetime.date.today() - datetime.timedelta(days=dias)
        for arq in self.pasta.glob('*.log'):
            try:
                dia = datetime.date.fromisoformat(arq.stem)
            except ValueError:
                continue   # arquivo que não é nosso: fica
            if dia < limite:
                try:
                    arq.unlink()
                except OSError as e:
                    self(f'não consegui apagar o log antigo {arq.name}: {type(e).__name__}', 'aviso')


def saida_tolerante():
    """A tela do Windows pode não ter todos os caracteres: troca o que não couber em vez de cair."""
    for f in (sys.stdout, sys.stderr):
        try:
            f.reconfigure(errors='replace')
        except (AttributeError, ValueError):
            pass
