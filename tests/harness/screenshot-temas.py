from playwright.sync_api import sync_playwright
import sys
pages = sys.argv[1:] or ['agenda.html','index.html','clientes/index.html','contabil-tarefas.html']
with sync_playwright() as pw:
    b = pw.chromium.launch()
    for tema in ('escuro','claro'):
        p = b.new_page(viewport={'width':1600,'height':900})
        p.on('pageerror', lambda e: print('PAGEERR', tema, e))
        p.goto('http://localhost:8765/agenda.html'); p.evaluate(f"() => {{ localStorage.setItem('mr_tour_agenda_v1::financeiro@macedoereis.com.br','ok'); localStorage.setItem('mr_tema','{tema}'); }}")
        for pg in pages:
            p.goto('http://localhost:8765/'+pg); p.wait_for_timeout(1200)
            p.screenshot(path=f"{tema}-{pg.replace('/','_')}.png", full_page=True)
        print(tema, 'btn:', p.evaluate("() => document.querySelector('.tema-btn')?.textContent"), 'theme attr:', p.evaluate("() => document.documentElement.getAttribute('data-theme')"))
        p.close()
    b.close()
