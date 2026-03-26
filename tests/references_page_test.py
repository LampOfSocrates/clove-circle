from pathlib import Path


references_html = Path(r"D:\S\Code\2026\clove-circle\references.html").read_text(encoding="utf-8")

assert "<title>Clove Circle | References</title>" in references_html
assert 'id="refWordCloud"' in references_html
assert 'id="refSearch"' in references_html
assert 'id="refList"' in references_html
assert "125 peer-reviewed publications" in references_html
assert "Native H2 Pathways Enable Biocompatible Hydrogenation of Metabolic Alkenes in Bacteria" in references_html
assert 'href="resources.html"' in references_html

print("references page test passed")
