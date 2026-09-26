"""Render guide.html to PDF with headless Chromium and check that no page overflows."""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

HERE = Path(__file__).parent
SRC = HERE / "guide.html"
OUT = HERE / "Pinduoduo-s-1000-somoni.pdf"

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/opt/pw-browsers/chromium")
    page = browser.new_page()
    page.goto(SRC.resolve().as_uri())
    page.wait_for_load_state("networkidle")
    overflow = page.evaluate("""() => [...document.querySelectorAll('.page')].map((el, i) => {
        const foot = el.querySelector('.foot');
        const limit = foot ? foot.getBoundingClientRect().top : el.getBoundingClientRect().bottom;
        let maxBottom = 0;
        el.querySelectorAll('*').forEach(c => {
            if (c.closest('.foot') || c.classList.contains('zh-big')) return;
            maxBottom = Math.max(maxBottom, c.getBoundingClientRect().bottom);
        });
        return {page: i + 1, spare: Math.round(limit - maxBottom)};
    })""")
    for o in overflow:
        print(f"page {o['page']:2d}: spare {o['spare']}px")
    page.pdf(path=str(OUT), prefer_css_page_size=True, print_background=True)
    browser.close()

bad = [o for o in overflow if o["spare"] < 0]
print(f"wrote {OUT.name}; overflowing pages: {[o['page'] for o in bad] or 'none'}")
sys.exit(1 if bad else 0)
