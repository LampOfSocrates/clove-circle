from pathlib import Path


root = Path(__file__).resolve().parents[1]


pha_standalone = (root / "standalone" / "PHA-from-lignocellulose-lca-tea.html").read_text(encoding="utf-8")
laterite_standalone = (root / "standalone" / "laterite-lca-tea.html").read_text(encoding="utf-8")


shared_css = (root / "css" / "case-study-format.css").read_text(encoding="utf-8")

# The shell keeps its dark card and its light-on-dark copy; the readable-copy
# rules went with the wrapper pages that were the only thing using them.
assert ".cc-case-study-shell" in shared_css
assert "rgba(255, 255, 255, 0.72)" in shared_css
assert ".cc-readable-copy" not in shared_css

# The wrapper pages were deleted; resources.html is the only page that frames
# a dashboard, so it is the one that has to load the shared shell styling.
resources_html = (root / "resources.html").read_text(encoding="utf-8")
assert "css/case-study-format.css" in resources_html
assert "cc-case-study-shell" in resources_html


assert "html{font-size:15px}" in pha_standalone
assert ".hdr-sub{font-size:12px;color:#94a3b8" in pha_standalone
assert ".muted{color:#94a3b8}" in pha_standalone
assert "th{font-size:11px;color:#94a3b8" in pha_standalone


assert "body{background:var(--bg);color:var(--text);font-family:var(--font-sans);font-size:15px" in laterite_standalone
assert "--text2:#b7c4d9; --text3:#8ea0b8;" in laterite_standalone
assert ".htxt p{font-size:12px;color:var(--text2)" in laterite_standalone
assert ".dt th{background:var(--bg3);color:var(--text2);font-family:var(--font-mono);font-size:11px" in laterite_standalone


print("case study typography test passed")
