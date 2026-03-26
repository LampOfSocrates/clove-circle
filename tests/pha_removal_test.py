from pathlib import Path


root = Path(r"D:\S\Code\2026\clove-circle")

for removed_path in [
    root / "case_studies" / "case-study-pha-biocomposite.html",
    root / "case_studies" / "case-study-pha-analytics.html",
    root / "case_studies" / "tea-lca.js",
    root / "tests" / "pha_analytics_case_study_test.py",
    root / "case_studies" / "sample-case-studies",
]:
    assert not removed_path.exists(), f"Expected {removed_path} to be removed"

for checked_file in [
    root / "resources.html",
    root / "case_studies" / "case-study-laterite-lca-tea.html",
    root / "docs" / "plans" / "ui-refresh.md",
]:
    text = checked_file.read_text(encoding="utf-8")
    assert "PHA Biocomposite" not in text
    assert "PHA biocomposite" not in text
    assert "case-study-pha-biocomposite" not in text
    assert "case-study-pha-analytics" not in text
    assert "tea-lca.js" not in text

print("pha removal test passed")
