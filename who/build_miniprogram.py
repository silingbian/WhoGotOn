#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 assets/animals/catalog.js 与动物素材转换为微信小程序内置清单。

- SVG 素材复制到主包 assets/animals/（体积小，共约 40KB）
- WebP 素材按体积均衡拆分为两个分包 pkg-a / pkg-b（小程序单个分包 ≤ 2MB）
- 生成 weixin-miniprogram/utils/catalog.js（含完整绝对路径）
- 复制舞台底图 bus-stop-empty.png 到主包 assets/

运行：python3 build_miniprogram.py
"""
import json
import os
import shutil

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "assets", "animals")
OUT = os.path.join(ROOT, "weixin-miniprogram")

PKG_DIRS = {
    "pkg-a": os.path.join(OUT, "pkg-a", "animals"),
    "pkg-b": os.path.join(OUT, "pkg-b", "animals"),
}
SVG_DIR = os.path.join(OUT, "assets", "animals")


def main():
    with open(os.path.join(SRC, "catalog.js"), encoding="utf-8") as f:
        text = f.read()
    catalog = json.loads(text[text.index("[") : text.rindex("]") + 1])

    missing = [c["src"] for c in catalog if not os.path.exists(os.path.join(SRC, c["src"]))]
    if missing:
        print("警告：以下素材文件不存在，已跳过：", missing)
        catalog = [c for c in catalog if c["src"] not in missing]

    for d in [SVG_DIR, *PKG_DIRS.values()]:
        os.makedirs(d, exist_ok=True)

    # 贪心分配：webp 按体积降序放入当前累计体积较小的分包
    totals = {"pkg-a": 0, "pkg-b": 0}
    webps = sorted(
        (c for c in catalog if c["src"].lower().endswith(".webp")),
        key=lambda c: -os.path.getsize(os.path.join(SRC, c["src"])),
    )
    assigned = {}
    for c in webps:
        pkg = "pkg-a" if totals["pkg-a"] <= totals["pkg-b"] else "pkg-b"
        assigned[c["src"]] = pkg
        totals[pkg] += os.path.getsize(os.path.join(SRC, c["src"]))

    new_catalog = []
    for c in catalog:
        src = c["src"]
        if src.lower().endswith(".webp"):
            pkg = assigned[src]
            shutil.copy2(os.path.join(SRC, src), os.path.join(PKG_DIRS[pkg], src))
            new_catalog.append({"id": c["id"], "name": c["name"], "src": "/%s/animals/%s" % (pkg, src)})
        else:
            shutil.copy2(os.path.join(SRC, src), os.path.join(SVG_DIR, src))
            new_catalog.append({"id": c["id"], "name": c["name"], "src": "/assets/animals/%s" % src})

    shutil.copy2(
        os.path.join(ROOT, "assets", "bus-stop-empty.png"),
        os.path.join(OUT, "assets", "bus-stop-empty.png"),
    )

    out_path = os.path.join(OUT, "utils", "catalog.js")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    body = "/* 由 build_miniprogram.py 自动生成，请勿手改；更新动物清单后重新运行脚本即可。 */\n"
    body += "const ANIMAL_CATALOG = " + json.dumps(new_catalog, ensure_ascii=False, indent=2) + ";\n"
    body += "module.exports = { ANIMAL_CATALOG };\n"
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(body)

    svg_count = sum(1 for c in new_catalog if c["src"].startswith("/assets/"))
    print("共 %d 只动物：SVG %d 个（主包），WebP %d 个（分包）。" % (len(new_catalog), svg_count, len(new_catalog) - svg_count))
    for pkg in ("pkg-a", "pkg-b"):
        print("%s: %.2f MB" % (pkg, totals[pkg] / 1024 / 1024))


if __name__ == "__main__":
    main()
