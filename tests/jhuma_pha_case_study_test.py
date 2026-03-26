from pathlib import Path


case_study_path = Path(r"D:\S\Code\2026\clove-circle\case_studies\case-study-jhuma-pha-original.html")

assert case_study_path.exists(), "PHA wrapper case study page should exist"

case_study_html = case_study_path.read_text(encoding="utf-8")

assert "Clove Circle | PHA from Lignocellulose" in case_study_html
assert 'href="../resources.html"' in case_study_html
assert 'src="../jhuma_data/PHA-from-lignocellulose-lca-tea.html"' in case_study_html
assert 'href="../jhuma_data/PHA-from-lignocellulose-lca-tea.html"' in case_study_html
assert "cc-page-header" in case_study_html

print("jhuma PHA case study test passed")
