"""Roda todos os testes do repositório e imprime um resumo.

    python tests/rodar-tudo.py

Pega sozinho:
  - todos os `tests/*.test.mjs` (com o node);
  - todos os testes de comportamento em `tests/harness/*.py` (o `conferir.py` fica de fora: é ferramenta
    de fotografar tela, não teste).
Teste novo não precisa ser inscrito em lugar nenhum — basta o arquivo estar na pasta.

Sai com código 1 se algum falhar, e aí imprime a saída inteira do que falhou.
Pré-requisito dos testes de tela: pip install playwright e python -m playwright install chromium
"""
import os, pathlib, subprocess, sys, time

RAIZ = pathlib.Path(__file__).resolve().parents[1]

def alvos():
    mjs = sorted((RAIZ / 'tests').glob('*.test.mjs'))
    py = sorted(p for p in (RAIZ / 'tests' / 'harness').glob('*.py') if p.name != 'conferir.py')
    return [(['node', str(f)], f) for f in mjs] + [([sys.executable, str(f)], f) for f in py]

def main():
    try: sys.stdout.reconfigure(encoding='utf-8')
    except Exception: pass
    # os testes escrevem ✓ e ✗; sem isto o console padrão do Windows (cp1252) derruba o teste no meio
    env = dict(os.environ, PYTHONIOENCODING='utf-8', PYTHONUTF8='1')

    lista = alvos()
    if not lista:
        print('nenhum teste encontrado'); return 1
    largura = max(len(f.relative_to(RAIZ).as_posix()) for _, f in lista)
    resultados = []
    print(f'{len(lista)} testes\n')
    for cmd, f in lista:
        nome = f.relative_to(RAIZ).as_posix()
        print(f'  {nome.ljust(largura)}  … ', end='', flush=True)
        t0 = time.time()
        r = subprocess.run(cmd, cwd=str(RAIZ), env=env, capture_output=True,
                           encoding='utf-8', errors='replace')
        seg = time.time() - t0
        bom = r.returncode == 0
        print(('ok    ' if bom else 'FALHOU') + f'  ({seg:.0f}s)')
        resultados.append((nome, bom, (r.stdout or '') + (r.stderr or '')))

    ruins = [x for x in resultados if not x[1]]
    for nome, _, saida in ruins:
        print('\n' + '─' * 70 + f'\n{nome}\n' + '─' * 70)
        print(saida.rstrip())
    print(f'\nResumo: {len(resultados)} testes · {len(resultados) - len(ruins)} ok · {len(ruins)} falharam')
    return 1 if ruins else 0

if __name__ == '__main__':
    sys.exit(main())
