"""O ambiente de demonstração do Serpro (o "trial" do Integra Contador): sem certificado, sem custo, com um token
público e respostas fixas — mas ele só aceita, de cada serviço, o pedido exato do cenário da documentação ("Dados
inválidos. Utilize o json no menu Cenário da documentação."). Por isso, em demonstração, a ponte manda pra cada serviço
o corpo do cenário dele, com os números de exemplo do Serpro, e põe a resposta na empresa de demonstração.

Os corpos vêm da cópia da documentação oficial que a biblioteca pública MarlonSantosDev/serpro_integra_contador_api
guarda em bk.cursor/rules/ (conferidos no trial em 23/10/2026: os 10 responderam). O token é o público do trial, o
mesmo da biblioteca (lib/src/core/auth/auth_service.dart) — não é segredo nem do escritório.
"""

TOKEN = '06aef429-a981-3ec5-a1f8-71d38d86481e'
GATEWAY = 'https://gateway.apiserpro.serpro.gov.br/integra-contador-trial/v1/'

# a empresa de demonstração: um dos CNPJs de exemplo que o cenário dos eventos devolve com novidade
EMPRESAS = [{'documento': '11111111111111', 'regime': 'simples'}]

CENARIOS = {'OBTERPROCURACAO41': {'contratante': {'numero': '99999999999999', 'tipo': 2},
                       'autorPedidoDados': {'numero': '99999999999999', 'tipo': 2},
                       'contribuinte': {'numero': '99999999999', 'tipo': 1},
                       'pedidoDados': {'idSistema': 'PROCURACOES',
                                       'idServico': 'OBTERPROCURACAO41',
                                       'versaoSistema': '1',
                                       'dados': '{ "outorgante":"99999999999999", "tipoOutorgante": "2", '
                                                '"outorgado":"99999999999", "tipoOutorgado":"1" }'}},
 'CONSDECLARACAO13': {'contratante': {'numero': '00000000000000', 'tipo': 2},
                      'autorPedidoDados': {'numero': '00000000000000', 'tipo': 2},
                      'contribuinte': {'numero': '00000000000000', 'tipo': 2},
                      'pedidoDados': {'idSistema': 'PGDASD',
                                      'idServico': 'CONSDECLARACAO13',
                                      'versaoSistema': '1.0',
                                      'dados': '{ "anoCalendario": "2018" }'}},
 'CONSULTIMADECREC14': {'contratante': {'numero': '00000000000000', 'tipo': 2},
                        'autorPedidoDados': {'numero': '00000000000000', 'tipo': 2},
                        'contribuinte': {'numero': '00000000000000', 'tipo': 2},
                        'pedidoDados': {'idSistema': 'PGDASD',
                                        'idServico': 'CONSULTIMADECREC14',
                                        'versaoSistema': '1.0',
                                        'dados': '{ "periodoApuracao": "201801" }'}},
 'SOLICEVENTOSPJ132': {'contratante': {'numero': '99999999999999', 'tipo': 2},
                       'autorPedidoDados': {'numero': '99999999999999', 'tipo': 2},
                       'contribuinte': {'numero': '00000000000000,11111111111111,22222222222222,33333333333333',
                                        'tipo': 4},
                       'pedidoDados': {'idSistema': 'EVENTOSATUALIZACAO',
                                       'idServico': 'SOLICEVENTOSPJ132',
                                       'versaoSistema': '1.0',
                                       'dados': '{"evento": "E0301"}'}},
 'OBTEREVENTOSPJ134': {'contratante': {'numero': '99999999999999', 'tipo': 2},
                       'autorPedidoDados': {'numero': '99999999999999', 'tipo': 2},
                       'contribuinte': {'numero': '', 'tipo': 4},
                       'pedidoDados': {'idSistema': 'EVENTOSATUALIZACAO',
                                       'idServico': 'OBTEREVENTOSPJ134',
                                       'versaoSistema': '1.0',
                                       'dados': '{"protocolo":"q90n3455-fa91-419c-c0ad-a4ms50215acl", '
                                                '"evento":"E0301"}'}},
 'MSGCONTRIBUINTE61': {'contratante': {'numero': '99999999999999', 'tipo': 2},
                       'autorPedidoDados': {'numero': '99999999999999', 'tipo': 2},
                       'contribuinte': {'numero': '99999999999999', 'tipo': 2},
                       'pedidoDados': {'idSistema': 'CAIXAPOSTAL',
                                       'idServico': 'MSGCONTRIBUINTE61',
                                       'versaoSistema': '1.0',
                                       'dados': '{"statusLeitura":"0","indicadorPagina":"0","ponteiroPagina":"00000000000000"}'}},
 'MSGDETALHAMENTO62': {'contratante': {'numero': '00000000000000', 'tipo': 2},
                       'autorPedidoDados': {'numero': '00000000000000', 'tipo': 2},
                       'contribuinte': {'numero': '00000000000000', 'tipo': 2},
                       'pedidoDados': {'idSistema': 'CAIXAPOSTAL',
                                       'idServico': 'MSGDETALHAMENTO62',
                                       'versaoSistema': '1.0',
                                       'dados': '{"isn":"0000082838"}'}},
 'INNOVAMSG63': {'contratante': {'numero': '00000000000000', 'tipo': 2},
                 'autorPedidoDados': {'numero': '00000000000000', 'tipo': 2},
                 'contribuinte': {'numero': '99999999999', 'tipo': 1},
                 'pedidoDados': {'idSistema': 'CAIXAPOSTAL',
                                 'idServico': 'INNOVAMSG63',
                                 'versaoSistema': '1.0',
                                 'dados': ''}},
 'SOLICITARPROTOCOLO91': {'contratante': {'numero': '00000000000000', 'tipo': 2},
                          'autorPedidoDados': {'numero': '00000000000000', 'tipo': 2},
                          'contribuinte': {'numero': '99999999999', 'tipo': 1},
                          'pedidoDados': {'idSistema': 'SITFIS',
                                          'idServico': 'SOLICITARPROTOCOLO91',
                                          'versaoSistema': '1.0',
                                          'dados': ''}},
 'RELATORIOSITFIS92': {'contratante': {'numero': '00000000000000', 'tipo': 2},
                       'autorPedidoDados': {'numero': '00000000000000', 'tipo': 2},
                       'contribuinte': {'numero': '99999999999', 'tipo': 1},
                       'pedidoDados': {'idSistema': 'SITFIS',
                                       'idServico': 'RELATORIOSITFIS92',
                                       'versaoSistema': '1.0',
                                       'dados': '{ "protocoloRelatorio": '
                                                '"+S7N6c04XNZUVzmxWT7SzpkZA4xeDQC9Z2T2GBJ5usn8LyouyWXbsy6mKsLy7/EImRkDjF4NAL25KiSXOLjnzAaZu/FC+G1pYOtTMYqokKYYr/yZ6aqUiCuWPfujDQ2/udwgU+Dyh56GSe28B5Ev25jDnzpvVJPhiebO5hpy1YESP5gnEhaP3bocCiZZrYG26F8avRRBJhRTsfv3Rvop+bxvYJZsVym270eO8oZTDIr3OJj==" '
                                                '}'}}}


def corpo(id_servico):
    """O pedido do cenário do serviço, ou None se o trial não tem cenário pra ele."""
    import copy
    c = CENARIOS.get(id_servico)
    return copy.deepcopy(c) if c else None
