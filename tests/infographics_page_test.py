from pathlib import Path


page_path = Path(r"D:\S\Code\2026\clove-circle\infographics\infographics.html")
assert page_path.exists(), "Expected infographics/infographics.html to exist"

html = page_path.read_text(encoding="utf-8")

assert "<title>Clove Circle | Infographics</title>" in html
assert '<nav class="navbar navbar-expand-lg cc-navbar sticky-top" id="mainNav">' in html
assert '<div class="cc-page-header">' in html
assert 'id="case-studies-link"' in html
assert 'id="infographics-link"' in html
assert 'id="references-link"' in html
assert "Research Figure Gallery" in html
assert "Source paper" in html
assert "Figure metadata" in html
assert "Life Cycle Assessment of Diethyl Carbonate (DEC) and Glycerol Carbonate (GC) Coproduction from Bioethanol, CO2, and Glycerol" in html
assert "Multi-Objective Optimization of Bread Waste Valorization: A Framework for Integrated Food Waste Management" in html

expected_pairs = [
    (
        "figures/life-cycle-assessment-of-diethyl-carbonate-(dec)-and-glycerol-carbonate-(gc)-coproduction-from-bioethanol-co2-and_figure_01.png",
        "figures/life-cycle-assessment-of-diethyl-carbonate-(dec)-and-glycerol-carbonate-(gc)-coproduction-from-bioethanol-co2-and_figure_01.json",
    ),
    (
        "figures/Manuscript_RCR_accepted_figure_01.png",
        "figures/Manuscript_RCR_accepted_figure_01.json",
    ),
]

for image_path, json_path in expected_pairs:
    assert image_path in html
    assert json_path in html

assert html.count('class="ig-card"') == 2

print("infographics page test passed")
