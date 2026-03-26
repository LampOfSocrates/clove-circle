from pathlib import Path


resources_html = Path(r"D:\S\Code\2026\clove-circle\resources.html").read_text(encoding="utf-8")

assert "Biorefinery: PHA Biocomposite Production" in resources_html
assert '<a href="case-study-tea-lca.html" class="cc-case-card-link">' in resources_html
assert '<span class="btn cc-btn-outline mt-3">' in resources_html
assert "Launch Case Study" in resources_html

print("resources case study link test passed")
