#!/usr/bin/env python3
"""Bundle the game into ONE html file (models embedded as base64).

  python3 tools/build_single_file.py            -> dist/lumen-reach.html (a full document)
  python3 tools/build_single_file.py --fragment -> dist/lumen-reach.fragment.html
        (no <html>/<head>/<body> wrapper; for hosts that add their own, like Claude artifacts)

Useful when you want to share or host the game as a single file.
"""
import base64, json, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
idx = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
head = idx[idx.index("<head>") + 6: idx.index("</head>")]
fonts = "\n".join(l for l in head.splitlines() if "fonts.g" in l)
body = idx[idx.index("<body>") + 6: idx.index("</body>")]
scripts = re.findall(r'<script src="([^"]+)"></script>', body)
markup = re.sub(r'<script src="[^"]+"></script>\s*', "", body).strip()
css = open(os.path.join(ROOT, "css/style.css"), encoding="utf-8").read()
models = os.path.join(ROOT, "assets/models")
emb = {f[:-4]: base64.b64encode(open(os.path.join(models, f), "rb").read()).decode() for f in sorted(os.listdir(models)) if f.endswith(".glb")}
js = "".join("<script>\n" + open(os.path.join(ROOT, s), encoding="utf-8").read() + "\n</script>\n" for s in scripts)
inner = f'<title>Lumen Reach</title>\n{fonts}\n<style>\n{css}\n</style>\n{markup}\n<script>window.LR_EMBED={json.dumps(emb)};</script>\n{js}'
os.makedirs(os.path.join(ROOT, "dist"), exist_ok=True)
if "--fragment" in sys.argv:
    out = os.path.join(ROOT, "dist/lumen-reach.fragment.html"); open(out, "w", encoding="utf-8").write(inner)
else:
    out = os.path.join(ROOT, "dist/lumen-reach.html")
    open(out, "w", encoding="utf-8").write('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover">\n</head>\n<body>\n' + inner + "</body>\n</html>\n")
print("wrote", out, f"{os.path.getsize(out) / 1e6:.1f} MB")
