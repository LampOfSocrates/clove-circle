from pathlib import Path


page_path = Path(r"D:\S\Code\2026\clove-circle\infographics\infographics.html")
assert page_path.exists(), "Expected infographics/infographics.html to exist"

html = page_path.read_text(encoding="utf-8")

assert "Research Figure Gallery" in html
assert "Figure metadata" in html

expected_pairs = [
    (
        "figures/life-cycle-assessment-of-diethyl-carbonate-(dec)-and-glycerol-carbonate-(gc)-coproduction-from-bioethanol-co2-and_figure_01.png",
        "figures/life-cycle-assessment-of-diethyl-carbonate-(dec)-and-glycerol-carbonate-(gc)-coproduction-from-bioethanol-co2-and_figure_01.json",
    ),
    (
        "figures/life-cycle-assessment-of-diethyl-carbonate-(dec)-and-glycerol-carbonate-(gc)-coproduction-from-bioethanol-co2-and_figure_06.png",
        "figures/life-cycle-assessment-of-diethyl-carbonate-(dec)-and-glycerol-carbonate-(gc)-coproduction-from-bioethanol-co2-and_figure_06.json",
    ),
    (
        "figures/Manuscript_RCR_accepted_figure_01.png",
        "figures/Manuscript_RCR_accepted_figure_01.json",
    ),
    (
        "figures/paper01_native_h2_pathways_figure_01.png",
        "figures/paper01_native_h2_pathways_figure_01.json",
    ),
]

for image_path, json_path in expected_pairs:
    assert image_path in html
    assert json_path in html

print("infographics page test passed")
