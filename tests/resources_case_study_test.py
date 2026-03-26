from pathlib import Path


resources_html = Path(r"D:\S\Code\2026\clove-circle\resources.html").read_text(encoding="utf-8")

assert "Biorefinery: PHA Biocomposite Production" in resources_html
assert 'href="case_studies/case-study-pha-biocomposite.html"' in resources_html
assert "Laterite NHM Processing" in resources_html
assert 'href="case_studies/case-study-laterite-lca-tea.html"' in resources_html
assert 'href="references.html"' in resources_html
assert "Launch Case Study" in resources_html
assert "Open Case Study" in resources_html
assert 'id="refList"' not in resources_html
assert 'id="refSearch"' not in resources_html

print("resources case study link test passed")
