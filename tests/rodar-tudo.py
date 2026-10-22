"""Roda todos os testes do repositório e imprime um resumo.

    python tests/rodar-tudo.py               # 4 ao mesmo tempo (o padrão)
    python tests/rodar-tudo.py --paralelo 6  # quantos ao mesmo tempo
    python tests/rodar-tudo.py --um-por-vez  # um atrás do outro, como era antes de 19/10/2026

Pega sozinho:
  - todos os `tests/*.test.mjs` (com o node);
  - todos os `tests/*.test.py` (com o Python — ex.: o da ponte do Domínio, que não abre tela);
  - todos os testes de comportamento em `tests/harness/*.py` (o `conferir.py` fica de fora: é ferramenta
    de fotografar tela, não teste).
Teste novo não precisa ser inscrito em lugar nenhum — basta o arquivo estar na pasta.

Em paralelo, cada teste de tela monta a cópia do site numa pasta só dele (`.harness/site-<nome do teste>`, pela
variável HARNESS_SITE que o `conferir.py` lê), apagada no fim. Os da lista SOZINHOS rodam depois dos outros, um por
vez. A lista sai na ordem alfabética, como antes (cada linha aparece quando o teste e os de cima dele terminaram).

Sai com código 1 se algum falhar, e aí imprime a saída inteira do que falhou.
Pré-requisito dos testes de tela: pip install playwright e python -m playwright install chromium
"""
import json, os, pathlib, shutil, subprocess, sys, threading, time
from concurrent.futures import ThreadPoolExecutor

RAIZ = pathlib.Path(__file__).resolve().parents[1]
PARALELO_PADRAO = 4
# testes que só passam sem os outros rodando junto (anotar o porquê em docs/ ao pôr um aqui): rodam no fim, um por vez
SOZINHOS = []
# quanto cada teste levou da última vez: os mais demorados começam primeiro (o tempo total fica perto da soma ÷ N)
TEMPOS = RAIZ / '.harness' / 'tempos-dos-testes.json'

def alvos():
    mjs = sorted((RAIZ / 'tests').glob('*.test.mjs'))
    tpy = sorted((RAIZ / 'tests').glob('*.test.py'))
    py = sorted(p for p in (RAIZ / 'tests' / 'harness').glob('*.py') if p.name != 'conferir.py')
    return [(['node', str(f)], f) for f in mjs] + [([sys.executable, str(f)], f) for f in tpy + py]

def opcoes(args):
    if '--um-por-vez' in args: return 1
    if '--paralelo' in args:
        i = args.index('--paralelo')
        try: n = int(args[i + 1])
        except (IndexError, ValueError): sys.exit('uso: python tests/rodar-tudo.py [--paralelo N | --um-por-vez]')
        if n < 1: sys.exit('--paralelo precisa de um número a partir de 1')
        return n
    return PARALELO_PADRAO

def rodar(cmd, env):
    t0 = time.time()
    r = subprocess.run(cmd, cwd=str(RAIZ), env=env, capture_output=True, encoding='utf-8', errors='replace')
    return r.returncode == 0, (r.stdout or '') + (r.stderr or ''), time.time() - t0

def linha(nome, largura, bom, seg):
    return f'  {nome.ljust(largura)}  … ' + ('ok    ' if bom else 'FALHOU') + f'  ({seg:.0f}s)'

def um_por_vez(lista, env, largura):
    resultados = []
    for cmd, f in lista:
        nome = f.relative_to(RAIZ).as_posix()
        print(f'  {nome.ljust(largura)}  … ', end='', flush=True)
        bom, saida, seg = rodar(cmd, env)
        print(('ok    ' if bom else 'FALHOU') + f'  ({seg:.0f}s)')
        resultados.append((nome, bom, saida, seg))
    return resultados

def em_paralelo(lista, env, largura, n):
    nomes = [f.relative_to(RAIZ).as_posix() for _, f in lista]
    try: antes = json.loads(TEMPOS.read_text(encoding='utf-8'))
    except Exception: antes = {}
    prontos, trava = {}, threading.Lock()
    proximo = [0]

    def rodar_um(i):
        cmd, f = lista[i]
        e = env
        if f.suffix == '.py':
            site = RAIZ / '.harness' / f'site-{f.stem}'
            e = dict(env, HARNESS_SITE=str(site))
        try:
            bom, saida, seg = rodar(cmd, e)
        finally:
            if f.suffix == '.py': shutil.rmtree(site, ignore_errors=True)
        with trava:
            prontos[i] = (nomes[i], bom, saida, seg)
            # imprime na ordem alfabética: cada linha sai quando o teste e todos os de cima dele terminaram
            while proximo[0] in prontos:
                nome, b, _, s = prontos[proximo[0]]
                print(linha(nome, largura, b, s), flush=True)
                proximo[0] += 1

    juntos = [i for i, nome in enumerate(nomes) if nome not in SOZINHOS]
    juntos.sort(key=lambda i: -antes.get(nomes[i], 30))   # o mais demorado primeiro; teste novo conta como 30 s
    with ThreadPoolExecutor(max_workers=n) as ex:
        list(ex.map(rodar_um, juntos))
    for i, nome in enumerate(nomes):
        if nome in SOZINHOS: rodar_um(i)

    resultados = [prontos[i] for i in range(len(lista))]
    try:
        TEMPOS.parent.mkdir(parents=True, exist_ok=True)
        TEMPOS.write_text(json.dumps({r[0]: round(r[3], 1) for r in resultados}, indent=1), encoding='utf-8')
    except Exception: pass
    return resultados

def main():
    try: sys.stdout.reconfigure(encoding='utf-8')
    except Exception: pass
    n = opcoes(sys.argv[1:])
    # os testes escrevem ✓ e ✗; sem isto o console padrão do Windows (cp1252) derruba o teste no meio
    env = dict(os.environ, PYTHONIOENCODING='utf-8', PYTHONUTF8='1')

    lista = alvos()
    if not lista:
        print('nenhum teste encontrado'); return 1
    largura = max(len(f.relative_to(RAIZ).as_posix()) for _, f in lista)
    print(f'{len(lista)} testes\n')
    t0 = time.time()
    resultados = um_por_vez(lista, env, largura) if n == 1 else em_paralelo(lista, env, largura, n)
    total = time.time() - t0

    ruins = [x for x in resultados if not x[1]]
    for nome, _, saida, _ in ruins:
        print('\n' + '─' * 70 + f'\n{nome}\n' + '─' * 70)
        print(saida.rstrip())
    print(f'\nTempo: {total:.0f} s · ' + ('um por vez' if n == 1 else f'{n} ao mesmo tempo') + f' (somados: {sum(r[3] for r in resultados):.0f} s)')
    print(f'Resumo: {len(resultados)} testes · {len(resultados) - len(ruins)} ok · {len(ruins)} falharam')
    return 1 if ruins else 0

if __name__ == '__main__':
    sys.exit(main())
