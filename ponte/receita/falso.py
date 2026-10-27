"""O Serpro de mentira do `receita rodar --falso`: um servidor HTTP aqui mesmo (127.0.0.1, porta livre) que responde
a entrada (token) e o gateway com as respostas do ambiente de demonstração guardadas em tests/fixtures/receita/ — por
isso o --falso só roda da pasta do repositório. A lista de empresas também é de mentira (CNPJs com o dígito errado).

O pedido de eventos devolve, pra os CNPJs pedidos, a novidade de hoje no primeiro e nenhuma nos outros — pra a Caixa
Postal ter o que ler. As mensagens da demonstração são de 2022: a primeira leitura de uma empresa só manda as dos
últimos 90 dias, então aqui elas vêm com datas recentes (a mais nova hoje, uma por dia pra trás, na mesma ordem).
"""
import datetime
import http.server
import json
import os
import pathlib
import threading

FIXTURES = pathlib.Path(__file__).resolve().parents[2] / 'tests' / 'fixtures' / 'receita'
EMPRESAS = [
    {'documento': '11222333000100', 'regime': 'simples'},
    {'documento': '22333444000100', 'regime': 'presumido'},
    {'documento': '33444555000100', 'regime': 'mei'},
]


def _hoje():
    try:
        return datetime.date.fromisoformat(os.environ.get('PONTE_HOJE') or '')
    except ValueError:
        return datetime.date.today()


def mensagens_recentes(resposta, ate):
    """A resposta do MSGCONTRIBUINTE61 com as datas trocadas: a mensagem mais nova em `ate`, as outras um dia pra
    trás cada, na mesma ordem (a mais nova da demonstração continua a mais nova)."""
    d = json.loads(resposta['dados'])
    lista = d['conteudo'][0]['listaMensagens']
    ordem = sorted(range(len(lista)), key=lambda i: (lista[i].get('dataEnvio') or '', -i), reverse=True)
    for pos, i in enumerate(ordem):
        lista[i]['dataEnvio'] = (ate - datetime.timedelta(days=pos)).strftime('%Y%m%d')
    return dict(resposta, dados=json.dumps(d, ensure_ascii=False))


class ServidorFalso:
    def __init__(self):
        if not FIXTURES.is_dir():
            raise FileNotFoundError('o --falso usa as respostas de tests/fixtures/receita/ — rode da pasta do repositório')
        dono = self
        self.ultimo_lote = []

        class H(http.server.BaseHTTPRequestHandler):
            def log_message(self, *a):
                pass

            def _json(self, codigo, obj):
                corpo = json.dumps(obj, ensure_ascii=False).encode('utf-8')
                self.send_response(codigo)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(corpo)))
                self.end_headers()
                self.wfile.write(corpo)

            def do_POST(self):
                n = int(self.headers.get('Content-Length') or 0)
                bruto = self.rfile.read(n)
                if self.path.rstrip('/').endswith('/authenticate'):
                    return self._json(200, {'access_token': 'token-de-mentira', 'jwt_token': 'jwt-de-mentira',
                                            'expires_in': 3000})
                try:
                    pedido = json.loads(bruto.decode('utf-8'))
                    pd = pedido['pedidoDados']
                except (ValueError, KeyError, TypeError):
                    return self._json(400, {'status': 400, 'mensagens': [{'codigo': 'ERRO', 'texto': 'pedido inválido'}]})
                servico = pd.get('idServico')
                if servico == 'SOLICEVENTOSPJ132':
                    dono.ultimo_lote = str(pedido.get('contribuinte', {}).get('numero', '')).split(',')
                if servico == 'OBTEREVENTOSPJ134':
                    hoje = datetime.date.today().strftime('%y%m%d')
                    matriz = [[d, hoje if i == 0 else ''] for i, d in enumerate(dono.ultimo_lote) if d]
                    return self._json(200, {'status': 200, 'mensagens': [{'codigo': '[Sucesso-EVENTOSATUALIZACAO]',
                                                                          'texto': 'ok'}], 'dados': json.dumps(matriz)})
                arq = FIXTURES / f"{pd.get('idSistema')}-{servico}.json"
                if not arq.is_file():
                    return self._json(404, {'status': 404, 'mensagens': [{'codigo': 'ERRO', 'texto': 'serviço sem resposta guardada'}]})
                if servico == 'MSGCONTRIBUINTE61':
                    return self._json(200, mensagens_recentes(json.loads(arq.read_text(encoding='utf-8')), _hoje()))
                corpo = arq.read_bytes()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Content-Length', str(len(corpo)))
                self.end_headers()
                self.wfile.write(corpo)

        self.srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), H)
        self.srv.daemon_threads = True
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()
        base = f'http://127.0.0.1:{self.srv.server_address[1]}'
        self.url_token = base + '/authenticate'
        self.url_gateway = base + '/integra-contador/v1/'

    def fechar(self):
        self.srv.shutdown()
        self.srv.server_close()
