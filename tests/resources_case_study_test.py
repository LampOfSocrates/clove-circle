from pathlib import Path


resources_html = Path(r"D:\S\Code\2026\clove-circle\resources.html").read_text(encoding="utf-8")

assert "Biorefinery: PHA Biocomposite Production" in resources_html
assert 'href="case-study-tea-lca.html"' in resources_html
assert "Launch Case Study" in resources_html
assert '<span class="btn cc-btn-outline mt-3 pe-none" style="opacity:0.6;">' not in resources_html

print("resources case study link test passed")
