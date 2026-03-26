from pathlib import Path


resources_html = Path(r"D:\S\Code\2026\clove-circle\resources.html").read_text(encoding="utf-8")

assert "Biorefinery: PHA Biocomposite Production" not in resources_html
assert "Laterite NHM Processing" not in resources_html
assert 'href="case_studies/case-study-laterite-lca-tea.html"' not in resources_html
assert "Laterite to Metal Extraction" in resources_html
assert 'href="case_studies/original-laterite-lca-tea.html"' in resources_html
assert "More Case Studies in Preparation" in resources_html
assert 'href="index.html#contact"' in resources_html
assert "PHA Analytics Case Study" not in resources_html
assert 'href="infographics/infographics.html"' in resources_html
assert 'href="references.html"' in resources_html
assert 'id="infographics-link"' in resources_html
assert "Open Original" in resources_html
assert 'id="refList"' not in resources_html
assert 'id="refSearch"' not in resources_html
assert "Browse Our Full References Library" not in resources_html
assert "<span class=\"cc-eyebrow\">Publications</span>" not in resources_html
assert '<footer class="cc-footer">' not in resources_html

print("resources case study link test passed")
