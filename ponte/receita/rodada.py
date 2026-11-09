"""`py -3 -m ponte receita rodar` — pede a lista de empresas ao sistema, consulta o Serpro no calendário (ou o --so),
monta o pacote e manda pelo mesmo envio (e os mesmos pendentes) da ponte do Domínio.

Código de saída (como o do Domínio):
    0  mandou (ou nada a mandar, ou --sem-enviar)
    1  não conseguiu (a lista de empresas não veio, ou o envio falhou e o pacote ficou em pendentes)
    2  configuração ou recusa — repetir do mesmo jeito não adianta

--demonstracao usa o ambiente de demonstração do Serpro (respostas fixas, sem custo) e --falso, o Serpro de mentira
(falso.py); os dois usam uma lista de empresas fixa, não contam no teto, não lembram nada no estado.json, não tocam
nos pendentes e só mandam pra um sistema de mentira (endereço local). O estado.json só é gravado quando o pacote foi
(ou ficou em pendentes) — assim nada lido se perde por um envio recusado.

O que não deu pra ler do PDF (a declaração, o relatório da situação fiscal) não vai no pacote: vai só o `faltou` com
`a_conferir` (24/10/2026). O estado.json guarda também o dia de cada consulta feita (o calendário "a partir do dia").

No fim da rodada de produção (09/11/2026), o PDF do relatório de situação fiscal vai pra pasta da empresa no Drive,
pela função do sistema (relatorios.py) — o desta rodada e os que ficaram das de antes; o que der errado ali fica pra
próxima e não muda o código de saída.

O procurador (03/11/2026, o Autentica Procurador): com o [integra] procurador_* preenchido, a autorização confere
também a procuração pro CPF dele; a empresa ativa por ela é consultada em nome dele (o autor de cada consulta), e o lote
de eventos da Caixa Postal sai um por autor. Sem o token dele nesta rodada, essas consultas vão pro `faltou` como erro
(o log diz uma vez) e voltam na próxima. A empresa que estava sem a procuração e passou a ter não espera o próximo dia
marcado: as consultas que ficaram de fora por isso entram na mesma rodada (no calendário; com o --so, vale o --so).
"""
import datetime
import json
import os
import pathlib
import re
import traceback

from .. import config, envio
from ..log import Registro
from . import VERSAO, calendario, demonstracao as demo_mod, estado as est_mod, pacote, relatorios, serpro, servicos, sistema

OK, TENTAR_DE_NOVO, NAO_ADIANTA = 0, 1, 2


def hoje_local():
    bruto = os.environ.get('PONTE_HOJE')          # pros testes do calendário
    if bruto:
        try:
            return datetime.date.fromisoformat(bruto)
        except ValueError:
            pass
    return datetime.date.today()


def agora():
    return datetime.datetime.now().astimezone().isoformat(timespec='seconds')


def _plano(hoje, e, est, so):
    s = set(so) if so else calendario.servicos_do_dia(hoje, e, est)
    if e.get('regime') != 'simples':
        s -= {'pgdas', 'faturamento'}
    return s


def executar(cli, empresas, est, hoje, so, pasta, reg):
    """Faz as consultas. Devolve ({documento: {servico: bloco}}, faltou)."""
    dados, faltou = {}, []
    teto_avisado, fora_avisado, proc_avisado = [], [], []        # uma linha só no log, não uma por empresa

    def falta(doc, servico, f):
        faltou.append({'documento': doc, 'servico': servico, 'motivo': f.motivo})
        if f.motivo == 'teto':
            if not teto_avisado:
                teto_avisado.append(1)
                reg(f'receita: o teto de {cli.contador.teto} chamadas do mês chegou — o resto fica de fora '
                    f'(sobe o [integra] teto_mes se for o caso)', 'erro')
        elif f.motivo == 'erro' and getattr(f, 'procurador', False):
            if not proc_avisado:
                proc_avisado.append(1)
                reg(f'receita: {cli.procurador_erro or f.detalhe} — as consultas em nome do procurador ficam de fora '
                    f'nesta rodada (vão como erro e voltam na próxima)', 'erro')
        elif f.motivo == 'erro' and getattr(f, 'repetido', False):
            pass                                   # o serviço saiu da rodada: o log já disse, numa linha só
        elif f.motivo == 'erro' and not (cli.fora and fora_avisado):
            reg(f'receita: {servico} de {doc} não veio: {f.detalhe}', 'erro')
            if cli.fora:
                fora_avisado.append(1)
        elif f.motivo == 'a_conferir':
            reg(f'receita: {servico} de {doc} a conferir: {f.detalhe}', 'aviso')

    planos = {e['documento']: _plano(hoje, e, est, so) for e in empresas}
    producao = cli.ambiente == 'producao'

    # 1. a autorização primeiro: sem ela (em produção), as outras consultas nem são feitas
    negados, respondidas = set(), set()
    for e in empresas:
        doc = e['documento']
        if 'autorizacao' not in planos[doc]:
            continue
        sem_antes = est.sem_autorizacao(doc, hoje)
        try:
            bloco = servicos.autorizacao(cli, e, hoje)
            dados.setdefault(doc, {})['autorizacao'] = bloco
            est.guardar_autorizacao(doc, bloco, hoje)
            respondidas.add(doc)
            if bloco['situacao'] in ('sem', 'vencida') and producao:
                negados.add(doc)
            elif bloco['situacao'] == 'ativa' and sem_antes and producao:
                # estava sem e agora tem (o cliente autorizou, ou a procuração é pro CPF do procurador): o que ficou de
                # fora por falta da procuração não espera o próximo dia marcado — no calendário, entra hoje
                est.liberar_consultas(doc)
                if not so:
                    planos[doc] |= _plano(hoje, e, est, so) - {'autorizacao'}
        except servicos.Falta as f:
            falta(doc, 'autorizacao', f)
            if f.feita:
                # o Serpro respondeu: até o próximo dia marcado não pergunta de novo ('sem' = toda segunda pergunta)
                situacao = 'sem' if f.motivo == 'sem_autorizacao' else None
                if f.procurador and not est.conhece_autorizacao(doc):
                    # sem o procurador nesta rodada, a empresa de que o estado não lembra nada fica com a resposta do
                    # escritório (sem a procuração): fora das outras consultas, que a Receita negaria
                    situacao = 'sem'
                est.marcar_consulta('autorizacao', doc, hoje, situacao=situacao)
            if f.motivo == 'sem_autorizacao':
                negados.add(doc)
    # a empresa cuja última consulta da autorização disse sem (ou vencida) e que hoje não teve resposta também fica de
    # fora das outras consultas: a Receita negaria, e cada recusa é uma chamada paga (03/11/2026: sem isto, nos dias sem
    # a consulta da autorização, as 80 sem procuração entrariam no lote da Caixa Postal e na situação fiscal do dia 5).
    # Elas voltam na consulta da autorização (toda segunda e no primeiro dia útil do mês), como o LEIA-ME diz.
    if producao:
        for e in empresas:
            doc = e['documento']
            if doc not in respondidas and est.sem_autorizacao(doc, hoje):
                negados.add(doc)
    # o autor de cada consulta: o procurador, pra quem a procuração ativa é a pro CPF dele; o escritório, pras outras
    autores = {e['documento']: 'procurador' for e in empresas
               if e['documento'] not in negados and cli.tem_procurador() and est.via_procurador(e['documento'])}
    if autores:
        reg(f'receita: {len(autores)} empresa(s) consultada(s) em nome do procurador (a procuração delas é pro CPF dele)')

    # 2. por empresa: PGDAS, a declaração (faturamento) e a situação fiscal
    def mes_pendente(doc, plano):
        # o mês a ler sai do estado (todos os meses declarados já vistos), não só do pgdas de hoje — assim a declaração
        # que não veio (Serpro fora, teto, um --so pgdas sem o faturamento) é pedida na rodada seguinte, sem custo
        # nenhum quando não há o que ler; a tentada sem resposta boa só volta no dia do pgdas
        lista = [{'competencia': c, 'transmitida_em': t} for c, t in est.meses_declarados(doc).items()]
        return servicos.mes_a_ler(lista, est, doc, tentar_de_novo='pgdas' in plano)

    for e in empresas:
        doc, plano = e['documento'], planos[e['documento']]
        autor = autores.get(doc)
        # o faturamento não depende do dia: toda rodada do calendário confere se há declaração a ler (com o --so, só
        # quando ele pede o faturamento)
        quer_faturamento = e.get('regime') == 'simples' and ('faturamento' in plano if so else True)
        if doc in negados:
            for s in sorted(plano - {'autorizacao', 'caixa_postal', 'faturamento'}):
                faltou.append({'documento': doc, 'servico': s, 'motivo': 'sem_autorizacao'})
            # a autorização de hoje já disse que não há procuração: até o próximo dia marcado não volta
            for s in ('pgdas', 'situacao_fiscal'):
                if s in plano:
                    est.marcar_consulta(s, doc, hoje)
            mes = mes_pendente(doc, plano) if quer_faturamento else None
            if mes:
                faltou.append({'documento': doc, 'servico': 'faturamento', 'motivo': 'sem_autorizacao'})
                est.guardar_declaracao_tentada(doc, mes['competencia'], mes['transmitida_em'])
            continue
        if 'pgdas' in plano:
            try:
                bloco = servicos.pgdas(cli, e, hoje, autor=autor)
                dados.setdefault(doc, {})['pgdas'] = bloco
                est.guardar_meses(doc, bloco['meses'])
                est.marcar_consulta('pgdas', doc, hoje)
            except servicos.Falta as f:
                falta(doc, 'pgdas', f)
                if f.feita:
                    est.marcar_consulta('pgdas', doc, hoje)
        if quer_faturamento:
            mes = mes_pendente(doc, plano)
            if mes:
                try:
                    bloco, problema = servicos.faturamento(cli, e, mes, pasta, autor=autor)
                    if problema:
                        # o que não deu pra ler não vai: só o faltou com a_conferir (o PDF fica guardado)
                        falta(doc, 'faturamento', servicos.Falta('a_conferir', problema))
                        est.guardar_declaracao_tentada(doc, mes['competencia'], mes['transmitida_em'])
                    else:
                        dados.setdefault(doc, {})['faturamento'] = bloco
                        est.guardar_declaracao_lida(doc, mes['competencia'], mes['transmitida_em'])
                except servicos.Falta as f:
                    falta(doc, 'faturamento', f)
                    if f.feita:              # o Serpro respondeu (recusa, acesso negado): volta só no dia do pgdas
                        est.guardar_declaracao_tentada(doc, mes['competencia'], mes['transmitida_em'])
        if 'situacao_fiscal' in plano:
            try:
                bloco, problema, aviso = servicos.situacao_fiscal(cli, e, hoje, pasta, autor=autor)
                est.marcar_consulta('situacao_fiscal', doc, hoje)
                if problema:
                    falta(doc, 'situacao_fiscal', servicos.Falta('a_conferir', problema))
                else:
                    dados.setdefault(doc, {})['situacao_fiscal'] = bloco
                    if aviso:
                        reg(f'receita: situacao_fiscal de {doc}: {aviso}', 'aviso')
            except servicos.Falta as f:
                falta(doc, 'situacao_fiscal', f)
                if f.feita:
                    est.marcar_consulta('situacao_fiscal', doc, hoje)

    # 3. Caixa Postal: os eventos em lote e as mensagens só de quem teve novidade
    cp = [e for e in empresas if 'caixa_postal' in planos[e['documento']] and e['documento'] not in negados]
    cnpjs = [e for e in cp if len(e['documento']) == 14]
    if len(cnpjs) < len(cp):
        reg(f'receita: caixa postal — {len(cp) - len(cnpjs)} empresa(s) com CPF ficam de fora (o lote de eventos é de CNPJ)', 'aviso')
    for doc in sorted(negados):
        if 'caixa_postal' in planos[doc]:
            faltou.append({'documento': doc, 'servico': 'caixa_postal', 'motivo': 'sem_autorizacao'})
    if cnpjs:
        # um lote por autor: o do escritório e o do procurador (o serviço só responde de quem deu a procuração ao autor)
        eventos, falharam = {}, set()
        grupos = {}
        for e in cnpjs:
            grupos.setdefault(autores.get(e['documento']), []).append(e['documento'])
        for autor in sorted(grupos, key=lambda a: a or ''):
            try:
                eventos.update(servicos.eventos_caixa_postal(cli, grupos[autor], autor=autor))
            except servicos.Falta as f:
                for doc in grupos[autor]:
                    falta(doc, 'caixa_postal', f)
                falharam.update(grupos[autor])
        if len(grupos) > 1:
            reg('receita: caixa postal — os lotes: ' + ', '.join(
                f"{len(grupos[a])} em nome do {'procurador' if a else 'escritório'}"
                for a in sorted(grupos, key=lambda a: a or '')))
        cnpjs = [e for e in cnpjs if e['documento'] not in falharam]
        com_novidade = mensagens_novas = 0
        sumidas = []
        for e in cnpjs:
            doc = e['documento']
            v = eventos.get(doc)
            if v is None:
                # pedida no lote e não voltou na resposta: não some calada — vai pro faltou como erro
                sumidas.append(doc)
                faltou.append({'documento': doc, 'servico': 'caixa_postal', 'motivo': 'erro'})
                continue
            if v.lower() == 'x':
                falta(doc, 'caixa_postal', servicos.Falta('sem_autorizacao'))
                continue
            if not re.fullmatch(r'\d{6}', v):
                continue
            # o evento é só o dia da última novidade: a mensagem que chega no mesmo dia depois da leitura não muda o
            # dia — por isso o dia do evento igual (ou depois) ao da última leitura lê de novo; antes dela, não
            leitura = est.leitura_mensagens(doc)
            if v == est.ultimo_evento(doc) and leitura and f'20{v[:2]}-{v[2:4]}-{v[4:]}' < leitura:
                continue
            com_novidade += 1
            try:
                bloco, lembrar, _sobrou, _velhas = servicos.mensagens(cli, e, est, hoje, autor=autores.get(doc))
                dados.setdefault(doc, {})['caixa_postal'] = bloco
                est.guardar_mensagens(doc, lembrar)
                est.guardar_evento(doc, v)
                est.guardar_leitura_mensagens(doc, hoje)
                mensagens_novas += len(bloco['mensagens'])
            except servicos.Falta as f:
                falta(doc, 'caixa_postal', f)
        if sumidas:
            reg(f'receita: caixa postal — {len(sumidas)} empresa(s) pedida(s) no lote não voltaram na resposta do Serpro '
                f'(vão no faltou como erro): ' + ', '.join(sumidas[:10]) + (' …' if len(sumidas) > 10 else ''), 'aviso')
        reg(f'receita: caixa postal — {len(cnpjs)} empresa(s) no lote, {com_novidade} com novidade, '
            f'{mensagens_novas} mensagem(ns) nova(s)')
    return dados, faltou


def mandar_com_pendentes(env, pac, corpo, base, reg):
    """O mesmo envio da ponte do Domínio: primeiro os pendentes, do mais velho pro mais novo; depois o desta rodada.
    Devolve (código de saída, o pacote foi ou ficou guardado)."""
    pasta_pend = base / 'pendentes'
    envio.apagar_velhos(pasta_pend, reg)
    codigo = OK
    for arq in envio.listar(pasta_pend):
        r = env.mandar(arq.read_bytes(), f'pendente {arq.name}')
        if r == envio.FOI:
            arq.unlink()
            continue
        if r == envio.CONFIG:
            reg('paro aqui — os pendentes ficam guardados pra quando o config.ini for acertado', 'erro')
            return NAO_ADIANTA, False
        if r == envio.RECUSADO:
            if env.ultimo_status in (401, 403):
                reg('a chave foi recusada: paro aqui — os pendentes ficam guardados pra quando a chave for corrigida', 'erro')
                return NAO_ADIANTA, False
            arq.unlink()
            reg(f'pendente {arq.name} recusado pelo sistema e apagado (repetir não adianta)', 'erro')
            codigo = NAO_ADIANTA
            continue
        guardado = envio.guardar(pasta_pend, pac)
        porque = 'o sistema ainda não tem a chave da ponte' if env.chave_nao_cadastrada else 'o sistema não respondeu'
        reg(f'{porque}: a rodada da Receita ficou guardada em pendentes\\{guardado.name}', 'erro')
        return TENTAR_DE_NOVO, True
    r = env.mandar(corpo, f'receita {pac["rodada"]["id"][:8]}')
    if r == envio.FOI:
        return codigo, True
    if r in (envio.RECUSADO, envio.CONFIG):
        return NAO_ADIANTA, False
    guardado = envio.guardar(pasta_pend, pac)
    reg(f'guardei em pendentes\\{guardado.name} pra mandar na próxima rodada', 'erro')
    return TENTAR_DE_NOVO, True


def rodar(demonstracao=False, falso=False, sem_enviar=False, saida=None, so=None, empresas_max=None):
    base = config.pasta()
    cfg = config.carregar()
    reg = Registro(base / 'logs', segredos=cfg.segredos())
    reg.limpar_antigos()
    hoje = hoje_local()
    inicio = agora()

    if demonstracao and falso:
        reg('receita: use --demonstracao ou --falso, não os dois', 'erro')
        return NAO_ADIANTA
    ambiente = 'falso' if falso else ('demonstracao' if demonstracao else cfg.ambiente_integra())
    if ambiente not in ('falso', 'demonstracao', 'producao'):
        reg('receita: o [integra] ambiente tem que ser demonstracao ou producao', 'erro')
        return NAO_ADIANTA
    precisa = []
    if ambiente == 'producao':
        precisa += list(cfg.campos_integra(ambiente))
    if ambiente == 'producao' or not sem_enviar:
        precisa += [c for c in config.CAMPOS_SISTEMA if c not in precisa]
    usa_config = bool(precisa) or ambiente == 'demonstracao'
    if usa_config and not cfg.existe:
        reg(f'receita: não achei {cfg.arquivo} — copie o ponte/config.exemplo.ini pra lá e preencha', 'erro')
        return NAO_ADIANTA
    if usa_config and cfg.erro_leitura:
        reg(f'receita: não consegui ler {cfg.arquivo} ({cfg.erro_leitura}) — confira o formato com o config.exemplo.ini', 'erro')
        return NAO_ADIANTA
    falta = cfg.falta(precisa)
    if ambiente == 'demonstracao' and cfg.situacao('integra', 'cnpj_escritorio') not in ('preenchido', 'ainda é o do exemplo'):
        # na demonstração vale o CNPJ do exemplo (o Serpro só responde os cenários dele)
        falta.append(f"integra.cnpj_escritorio ({cfg.situacao('integra', 'cnpj_escritorio')})")
    if falta:
        reg('receita: a configuração não deixa rodar; falta: ' + ', '.join(falta), 'erro')
        return NAO_ADIANTA
    if ambiente == 'producao' and not config.documento_valido(re.sub(r'[./\s-]', '', cfg.valor('integra', 'cnpj_escritorio'))):
        reg('receita: o [integra] cnpj_escritorio está com o dígito verificador errado', 'erro')
        return NAO_ADIANTA
    if ambiente != 'producao' and not sem_enviar and not config.endereco_local(cfg.valor('sistema', 'url')):
        reg('receita: --demonstracao e --falso só mandam pra um sistema de mentira (endereço local); use --sem-enviar', 'erro')
        return NAO_ADIANTA
    if so is None and not calendario.dia_util(hoje):
        reg('receita: fim de semana — nenhuma consulta marcada pra hoje')
        return OK
    teto, problema = cfg.teto()
    if problema:
        reg(problema, 'aviso')

    pasta = est_mod.pasta_receita(base)
    est_mod.apagar_pdfs_velhos(pasta, reg)
    real = ambiente == 'producao'
    est = est_mod.Estado(pasta, gravar=real and not sem_enviar)
    cont = est_mod.Contador(pasta, hoje, teto, contar=real)
    rotulo = {'producao': 'produção', 'demonstracao': 'ambiente de demonstração do Serpro',
              'falso': 'Serpro de mentira'}[ambiente]
    reg(f'receita: rodada da ponte {VERSAO} — {rotulo}, {hoje:%d/%m/%Y}'
        + (f" — só {', '.join(so)}" if so else '') + (' — sem enviar' if sem_enviar else ''))

    srv_falso = None
    try:
        if falso:
            from .falso import ServidorFalso, EMPRESAS
            srv_falso = ServidorFalso()
            empresas = [dict(e) for e in EMPRESAS]
        elif ambiente == 'demonstracao':
            empresas = [dict(e) for e in demo_mod.EMPRESAS]
        else:
            empresas, status = sistema.pedir_empresas(cfg, reg)
            if empresas is None:
                return NAO_ADIANTA if status in (401, 403) else TENTAR_DE_NOVO
        if empresas_max:
            empresas = empresas[:empresas_max]
        reg(f'receita: {len(empresas)} empresa(s) na lista')
        procurador = None
        if ambiente == 'producao':
            procurador, problema_proc = cfg.procurador()
            if problema_proc:
                reg(f'receita: {problema_proc} — a rodada segue sem ele (a empresa com a procuração só pro CPF dele '
                    f'fica sem autorização)', 'erro')
        cli = serpro.Cliente(
            ambiente, cfg.valor('integra', 'cnpj_escritorio'), reg, cont, pasta / 'tmp',
            consumer_key=cfg.valor('integra', 'consumer_key'), consumer_secret=cfg.valor('integra', 'consumer_secret'),
            certificado=cfg.valor('integra', 'certificado'), senha_certificado=cfg.valor('integra', 'senha_certificado'),
            url_token=srv_falso.url_token if srv_falso else None, url_gateway=srv_falso.url_gateway if srv_falso else None,
            procurador=procurador, hoje=hoje)
        est.com_procurador = cli.tem_procurador()
        if cli.tem_procurador():
            reg('receita: com o procurador — a procuração pro CPF dele é conferida quando falta a do escritório, e '
                'essas empresas são consultadas em nome dele')
        dados, faltou = executar(cli, empresas, est, hoje, so, pasta, reg)
        if cli.procurador_com_token():
            reg('receita: procurador — o termo de autorização foi aceito (o token valeu pra rodada)')
        if cli.fora:
            reg('receita: o Serpro parou de responder no meio da rodada — o que faltou vai como erro', 'erro')
    except serpro.ErroConfig as e:
        reg(f'receita: {e}', 'erro')
        return NAO_ADIANTA
    except FileNotFoundError as e:
        reg(f'receita: {e}', 'erro')
        return NAO_ADIANTA
    except Exception as e:
        reg(f'receita: a rodada parou: {type(e).__name__}: {e}', 'erro')
        reg(traceback.format_exc().rstrip(), 'erro')
        return TENTAR_DE_NOVO
    finally:
        if srv_falso:
            srv_falso.fechar()

    pac = pacote.montar(dados, faltou, inicio, agora(), ambiente, cont.total())
    reg('receita: ' + pacote.resumo(pac))
    if saida:
        destino = pathlib.Path(saida)
        if not destino.is_absolute():
            destino = base / destino            # nunca na pasta de onde se roda (o repositório é público)
        destino.parent.mkdir(parents=True, exist_ok=True)
        destino.write_bytes(json.dumps(pac, ensure_ascii=False, indent=1).encode('utf-8'))
        reg(f'receita: pacote gravado em {destino}')
    if sem_enviar:
        reg('receita: nada a mandar' if not pac['empresas'] and not pac['faltou'] else 'receita: --sem-enviar: nada foi mandado')
        return OK
    if not pac['empresas'] and not pac['faltou']:
        reg('receita: nada a mandar')
        codigo = OK
    else:
        corpo = json.dumps(pac, ensure_ascii=False).encode('utf-8')
        env = sistema.EnvioReceita(cfg.valor('sistema', 'url'), cfg.valor('sistema', 'chave_publica'),
                                   cfg.valor('sistema', 'chave_ponte'), reg)
        if not real:
            # demonstração e --falso não tocam nos pendentes de verdade (nem mandam os relatórios pro Drive)
            r = env.mandar(corpo, f'receita {pac["rodada"]["id"][:8]} ({rotulo})')
            if r == envio.FOI:
                return OK
            if r == envio.FALHOU:
                reg('receita: em demonstração e no --falso nada é guardado em pendentes', 'aviso')
                return TENTAR_DE_NOVO
            return NAO_ADIANTA
        codigo, foi_ou_guardou = mandar_com_pendentes(env, pac, corpo, base, reg)
        if foi_ou_guardou:
            est.gravar()
    if real:
        # o PDF do relatório de situação fiscal na pasta da empresa no Drive (09/11/2026): os que faltam, desta rodada e
        # das de antes; o que der errado aqui fica pra próxima e não muda o código de saída
        try:
            relatorios.mandar(cfg, pasta, empresas, reg)
        except Exception as e:
            reg(f'receita: os relatórios de situação fiscal pararam: {type(e).__name__}: {e} — vão na próxima rodada', 'erro')
    return codigo
