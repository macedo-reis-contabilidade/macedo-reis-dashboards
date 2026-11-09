"""O relatório de situação fiscal no Drive da empresa (09/11/2026, pedido da Thalia com o ok do Samuel: "se o sistema
salvar o PDF no drive e fornecer um link pro arquivo, não precisa ter um botão").

    py -3 -m ponte receita relatorios      manda agora os que faltam — sem consultar o Serpro: nenhuma chamada paga

O PDF do relatório de situação fiscal (o SITFIS) que a rodada guardou em receita\\pdfs vai pra função do sistema, um
por pedido; ela o salva na pasta da empresa no Drive (FISCAL › SITUAÇÃO FISCAL) e põe o link na ficha da empresa. Vai
só esse PDF, com o CNPJ e o dia — o da declaração do PGDAS, o texto das mensagens e o resto ficam no PC. A rodada de
produção manda no fim os que faltam; o relatorios.json guarda o dia do último que foi de cada empresa, e o que não foi
(a empresa sem a pasta do Drive no cadastro, o sistema ou o Drive fora) vai na rodada seguinte, enquanto o PDF estiver
no PC (30 dias). Só das empresas da lista que o sistema mandou. Uma falha aqui não muda o código de saída da rodada.

    {"versao": 1, "tipo": "receita", "relatorio": "situacao_fiscal", "documento", "emitido_em", "ambiente", "pdf"}
      → 200 {"gravado": true, "link"}            foi
      → 200 {"gravado": false, "motivo"}         não ficou no Drive (a empresa sem a pasta): vai de novo na próxima
      → 4xx                                      recusado: não vai de novo (o log diz o porquê)
      → 5xx, sem resposta                        o sistema ou o Drive fora: para aqui, o resto vai na próxima rodada
"""
import base64
import json
import re

from .. import config, envio
from ..log import Registro
from . import estado as est_mod, sistema

NOME = re.compile(r'^([0-9A-Z]{12}[0-9]{2})-situacao-fiscal-(\d{4}-\d{2}-\d{2})\.pdf$')
ARQUIVO = 'relatorios.json'
MAX_BYTES = 10 * 1024 * 1024        # o limite da função
TEMPO = 120                         # o prazo de cada envio, em segundos (a função sobe o PDF no Drive antes de responder)
MAX_POR_RODADA = 300

OK, TENTAR_DE_NOVO, NAO_ADIANTA = 0, 1, 2


def mandados(pasta):
    """{CNPJ: o dia do último relatório que foi pro Drive (ou que o sistema recusou)}."""
    d = est_mod._ler_json(pasta / ARQUIVO, {})
    return {str(k): str(v) for k, v in d.items()} if isinstance(d, dict) else {}


def _gravar(pasta, d):
    est_mod._gravar_json(pasta / ARQUIVO, d)


def a_mandar(pasta, docs, feitos):
    """[(CNPJ, dia, caminho)]: os PDFs do relatório de situação fiscal das empresas da lista que ainda não foram, do mais
    velho pro mais novo."""
    p = pasta / 'pdfs'
    if not p.is_dir():
        return []
    fila = []
    for arq in p.glob('*-situacao-fiscal-*.pdf'):
        m = NOME.match(arq.name)
        if not m or m.group(1) not in docs:
            continue
        doc, dia = m.group(1), m.group(2)
        if feitos.get(doc) and dia <= feitos[doc]:
            continue
        fila.append((dia, doc, arq))
    fila.sort()
    return [(doc, dia, arq) for dia, doc, arq in fila]


def mandar(cfg, pasta, empresas, reg, ambiente='producao'):
    """Manda os que faltam. Devolve {'foram', 'sem_pasta', 'recusados', 'parou'} (pros testes e pro log)."""
    feitos = mandados(pasta)
    fila = a_mandar(pasta, {e['documento'] for e in empresas}, feitos)
    res = {'foram': 0, 'sem_pasta': [], 'recusados': 0, 'parou': False}
    if not fila:
        return res
    env = sistema.EnvioReceita(cfg.valor('sistema', 'url'), cfg.valor('sistema', 'chave_publica'),
                               cfg.valor('sistema', 'chave_ponte'), reg)
    env.tempo = TEMPO
    for doc, dia, arq in fila[:MAX_POR_RODADA]:
        try:
            conteudo = arq.read_bytes()
        except OSError as e:
            reg(f'receita: não consegui ler o relatório {arq.name} ({type(e).__name__}) — tento de novo na próxima', 'aviso')
            continue
        if not conteudo.startswith(b'%PDF-') or len(conteudo) > MAX_BYTES:
            # o Serpro mandou outra coisa (ou grande demais): fica no PC, e não vai de novo
            reg(f'receita: o relatório {arq.name} não é um PDF que dê pra mandar — fica só no PC', 'aviso')
            feitos[doc] = dia
            _gravar(pasta, feitos)
            continue
        corpo = json.dumps({'versao': 1, 'tipo': 'receita', 'relatorio': 'situacao_fiscal', 'documento': doc,
                            'emitido_em': dia, 'ambiente': ambiente,
                            'pdf': base64.b64encode(conteudo).decode('ascii')}).encode('utf-8')
        resultado, status, detalhe = env.uma_vez(corpo)
        if resultado == envio.FOI:
            r = env.ultima_resposta if isinstance(env.ultima_resposta, dict) else {}
            if r.get('gravado') is True:
                res['foram'] += 1
                feitos[doc] = dia
                _gravar(pasta, feitos)
            else:
                res['sem_pasta'].append(doc)
            continue
        if resultado == envio.RECUSADO and status not in (401, 403):
            res['recusados'] += 1
            reg(f'receita: o relatório de {doc} ({dia}) foi recusado pelo sistema (HTTP {status}'
                + (f' — {detalhe}' if detalhe else '') + ') — não vai de novo', 'erro')
            feitos[doc] = dia
            _gravar(pasta, feitos)
            continue
        res['parou'] = True
        if resultado == envio.RECUSADO:
            porque = 'a chave foi recusada — confira a [sistema] chave_ponte (py -3 -m ponte chave mostra a impressão digital)'
        elif sistema.sem_chave(status, detalhe):
            porque = 'o sistema ainda não tem a chave da ponte'
        elif resultado == envio.CONFIG:
            porque = detalhe or 'a configuração não deixa mandar'
        else:
            porque = (f'HTTP {status}' if status else 'sem resposta') + (f' — {detalhe}' if detalhe else '')
        reg(f'receita: o relatório de {doc} ({dia}) não foi ({porque}) — os relatórios que faltam vão na próxima rodada', 'erro')
        break
    partes = [f"{res['foram']} no Drive"]
    if res['sem_pasta']:
        partes.append(f"{len(res['sem_pasta'])} sem a pasta do Drive no cadastro ({', '.join(res['sem_pasta'][:10])}"
                      + (' …' if len(res['sem_pasta']) > 10 else '') + ') — vão de novo na próxima rodada')
    if res['recusados']:
        partes.append(f"{res['recusados']} recusado(s)")
    reg('receita: relatórios de situação fiscal — ' + ', '.join(partes),
        'aviso' if res['sem_pasta'] or res['recusados'] or res['parou'] else 'info')
    return res


def rodar():
    """`py -3 -m ponte receita relatorios`: pede a lista de empresas ao sistema e manda os relatórios que faltam."""
    base = config.pasta()
    cfg = config.carregar()
    reg = Registro(base / 'logs', segredos=cfg.segredos())
    if not cfg.existe or cfg.erro_leitura:
        reg(f'receita: não consegui ler {cfg.arquivo} — confira o formato com o config.exemplo.ini', 'erro')
        return NAO_ADIANTA
    falta = cfg.falta(list(config.CAMPOS_SISTEMA))
    if falta:
        reg('receita: a configuração não deixa mandar; falta: ' + ', '.join(falta), 'erro')
        return NAO_ADIANTA
    if cfg.ambiente_integra() != 'producao':
        reg('receita: os relatórios só vão pro Drive na produção (o [integra] ambiente)', 'erro')
        return NAO_ADIANTA
    empresas, status = sistema.pedir_empresas(cfg, reg)
    if empresas is None:
        return NAO_ADIANTA if status in (401, 403) else TENTAR_DE_NOVO
    pasta = est_mod.pasta_receita(base)
    est_mod.apagar_pdfs_velhos(pasta, reg)
    fila = a_mandar(pasta, {e['documento'] for e in empresas}, mandados(pasta))
    if not fila:
        reg('receita: nenhum relatório de situação fiscal a mandar pro Drive')
        return OK
    res = mandar(cfg, pasta, empresas, reg)
    return TENTAR_DE_NOVO if res['parou'] else OK
