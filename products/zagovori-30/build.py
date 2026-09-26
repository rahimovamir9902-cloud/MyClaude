"""Render guide.html into the sellable PDF and check that no page overflows.

Usage:
    pip install playwright pypdf
    python build.py [--chromium /path/to/chrome]
"""
import argparse
import pathlib
import sys

from playwright.sync_api import sync_playwright
from pypdf import PdfReader

HERE = pathlib.Path(__file__).resolve().parent
SRC = HERE / "guide.html"
OUT = HERE / "Zagovori-po-angliyski-za-30-dney.pdf"
EXPECTED_PAGES = 15

# For every .page, report content that runs into the footer zone or past the right edge.
OVERFLOW_CHECK = """
() => {
  const mm = 96 / 25.4;
  const problems = [];
  document.querySelectorAll('.page').forEach((page, i) => {
    const p = page.getBoundingClientRect();
    const limit = p.bottom - 14 * mm;            // footer sits in the last ~14mm
    page.querySelectorAll('*').forEach(el => {
      if (el.closest('.foot') || el.closest('.stats')) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      if (r.bottom > limit + 0.5 || r.right > p.right + 0.5) {
        problems.push(`page ${i + 1}: <${el.tagName.toLowerCase()} class="${el.className}"> ` +
          `bottom=${((r.bottom - p.top) / mm).toFixed(1)}mm right=${((r.right - p.left) / mm).toFixed(1)}mm`);
      }
    });
  });
  return problems;
}
"""


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--chromium", help="path to a Chromium binary (optional)")
    args = ap.parse_args()

    with sync_playwright() as pw:
        launch = {"executable_path": args.chromium} if args.chromium else {}
        browser = pw.chromium.launch(**launch)
        page = browser.new_page()
        page.goto(SRC.as_uri(), wait_until="networkidle")
        page.evaluate("document.fonts.ready")
        page.emulate_media(media="print")

        problems = page.evaluate(OVERFLOW_CHECK)
        page.pdf(path=str(OUT), prefer_css_page_size=True, print_background=True)
        browser.close()

    pages = len(PdfReader(OUT).pages)
    print(f"wrote {OUT.name}: {pages} pages")
    for line in problems[:40]:
        print("OVERFLOW", line)
    if problems or pages != EXPECTED_PAGES:
        print(f"FAILED: {len(problems)} overflowing elements, {pages}/{EXPECTED_PAGES} pages")
        return 1
    print("OK: layout fits")
    return 0


if __name__ == "__main__":
    sys.exit(main())
