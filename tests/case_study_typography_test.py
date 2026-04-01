from pathlib import Path


root = Path(r"D:\S\Code\2026\clove-circle")


laterite_wrapper = (root / "case_studies" / "wrapper-laterite-lca-tea.html").read_text(encoding="utf-8")
pha_wrapper = (root / "case_studies" / "wrapper-pha-lca-tea.html").read_text(encoding="utf-8")
pha_standalone = (root / "standalone" / "PHA-from-lignocellulose-lca-tea.html").read_text(encoding="utf-8")
laterite_standalone = (root / "standalone" / "laterite-lca-tea.html").read_text(encoding="utf-8")


for wrapper_html in (laterite_wrapper, pha_wrapper):
    assert ".cc-readable-copy" in wrapper_html
    assert "font-size: 18px;" in wrapper_html
    assert "color: rgba(255, 255, 255, 0.9);" in wrapper_html


assert "html{font-size:15px}" in pha_standalone
assert ".hdr-sub{font-size:12px;color:#94a3b8" in pha_standalone
assert ".muted{color:#94a3b8}" in pha_standalone
assert "th{font-size:11px;color:#94a3b8" in pha_standalone


assert "body{background:var(--bg);color:var(--text);font-family:var(--font-sans);font-size:15px" in laterite_standalone
assert "--text2:#b7c4d9; --text3:#8ea0b8;" in laterite_standalone
assert ".htxt p{font-size:12px;color:var(--text2)" in laterite_standalone
assert ".dt th{background:var(--bg3);color:var(--text2);font-family:var(--font-mono);font-size:11px" in laterite_standalone


print("case study typography test passed")
