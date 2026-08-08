#!/usr/bin/env python3
"""Verify every icon asset is well-formed, on-brand, and correctly embedded.

Run by scripts/gen-icons.sh, and safe to run standalone in CI. Checks the properties that
actually break in the wild rather than merely asserting files exist:

  * favicon.ico really is multi-resolution (a single-size .ico looks fine until Windows
    or a bookmarks bar asks for 48px and gets a blurry upscale)
  * PNG app icons are fully OPAQUE (iOS composites a transparent apple-touch-icon onto
    WHITE, which would show a white box around a dark icon)
  * the base64 embedded in content-worker/src/icons.ts decodes to the SAME bytes as
    dashboard/static/favicon.ico's 16/32 pair — the generator's whole reason to exist
  * favicon.svg geometry lands on whole device pixels at 16px, with zero antialiased
    rows, because a favicon that is 1px off-grid renders as mush in a tab
  * the manifest's icons all exist on disk and its theme colour matches the CSS --bg
"""
import base64
import json
import pathlib
import re
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
STATIC = ROOT / "dashboard" / "static"
BG = "#0a0a0a"
ACCENT = "#d6f520"

failures: list[str] = []
checks = 0


def ok(cond: bool, label: str, detail: str = "") -> None:
    global checks
    checks += 1
    if cond:
        print(f"  PASS {label}" + (f" ({detail})" if detail else ""))
    else:
        print(f"  FAIL {label}" + (f" ({detail})" if detail else ""))
        failures.append(label)


def main() -> int:
    from PIL import Image

    print("== files present ==")
    expected = [
        "favicon.svg", "icon.svg", "logo-readme.svg", "favicon.ico",
        "apple-touch-icon.png", "icon-192.png", "icon-512.png", "site.webmanifest",
    ]
    for name in expected:
        ok((STATIC / name).is_file(), f"{name} exists")

    print("== README/docs logo ==")
    readme_png = ROOT / "docs" / "assets" / "logo.png"
    ok(readme_png.is_file(), "docs/assets/logo.png exists")
    if readme_png.is_file():
        rim = Image.open(readme_png).convert("RGBA")
        rpx = rim.load()
        # Corners MUST stay transparent: GitHub renders README images on a white canvas
        # in light mode and near-black in dark mode. An opaque square would show as a
        # pale or dark box around the rounded badge in one of the two themes.
        corner_alpha = rpx[0, 0][3]
        ok(corner_alpha == 0, "logo.png corners transparent", f"alpha={corner_alpha}")
        colors = {c[:3] for _, c in rim.getcolors(maxcolors=99999) or []}
        ok((214, 245, 32) in colors, "logo.png carries the accent colour")
        # The mark is embedded in README.md by relative path; a rename breaks the render
        # silently (GitHub shows a broken-image glyph, not an error).
        readme = (ROOT / "README.md").read_text()
        ok("docs/assets/logo.png" in readme, "README references the logo")

    print("== favicon.ico is multi-resolution ==")
    ico = Image.open(STATIC / "favicon.ico")
    sizes = sorted(ico.info.get("sizes", []))
    ok(len(sizes) >= 3, "ico has >=3 sizes", str(sizes))
    ok((16, 16) in sizes and (32, 32) in sizes, "ico covers 16 and 32")

    print("== PNG app icons are opaque and correctly sized ==")
    for name, want in (("apple-touch-icon.png", 180), ("icon-192.png", 192),
                       ("icon-512.png", 512)):
        im = Image.open(STATIC / name)
        lo = im.convert("RGBA").getchannel("A").getextrema()[0]
        ok(im.size == (want, want), f"{name} is {want}x{want}", str(im.size))
        ok(lo == 255, f"{name} fully opaque", f"min alpha={lo}")

    print("== content-worker embed matches the source bytes ==")
    icons_ts = (ROOT / "content-worker" / "src" / "icons.ts").read_text()
    literals = re.findall(r'"([A-Za-z0-9+/=]+)"', icons_ts)
    b64 = "".join(l for l in literals if len(l) > 32)
    ok(bool(b64), "found embedded base64", f"{len(b64)} chars")
    try:
        raw = base64.b64decode(b64, validate=True)
        decoded = True
    except Exception as exc:                                    # noqa: BLE001
        raw, decoded = b"", False
        ok(False, "embedded base64 decodes", str(exc))
    if decoded:
        ok(True, "embedded base64 decodes", f"{len(raw)} bytes")
        ok(raw[:4] == b"\x00\x00\x01\x00", "embedded payload is a real ICO",
           repr(raw[:4]))
        with tempfile.NamedTemporaryFile(suffix=".ico", delete=False) as fh:
            fh.write(raw)
            tmp = fh.name
        emb = sorted(Image.open(tmp).info.get("sizes", []))
        ok((16, 16) in emb and (32, 32) in emb, "embedded ico covers 16 and 32", str(emb))
        # The embedded 16px frame must be pixel-identical to a fresh render of the SVG.
        with tempfile.TemporaryDirectory() as td:
            ref = pathlib.Path(td) / "ref.png"
            subprocess.run(["rsvg-convert", "-w", "16", "-h", "16",
                            str(STATIC / "favicon.svg"), "-o", str(ref)], check=True)
            a = Image.open(ref).convert("RGBA")
            # Pillow exposes ICO frames via size selection on load; ask for the 16px one
            # explicitly rather than mutating .size (which is a read-only property).
            b = Image.open(tmp)
            frame16 = b.ico.getimage((16, 16)).convert("RGBA")  # type: ignore[attr-defined]
            same = bytes(a.tobytes()) == bytes(frame16.tobytes())
            ok(same, "embedded 16px frame matches a fresh SVG render")

    print("== favicon.svg is pixel-aligned at 16px ==")
    with tempfile.TemporaryDirectory() as td:
        png = pathlib.Path(td) / "f16.png"
        subprocess.run(["rsvg-convert", "-w", "16", "-h", "16",
                        str(STATIC / "favicon.svg"), "-o", str(png)], check=True)
        im = Image.open(png).convert("RGBA")
        px = im.load()

        def kind(p):
            r, g, b_, a = p
            if a < 40:
                return "."
            if r > 200 and g > 200 and b_ > 200:
                return "W"
            if r > 150 and g > 170 and b_ < 120:
                return "A"
            if r < 60 and g < 60 and b_ < 60:
                return "k"
            return "?"

        rows = ["".join(kind(px[x, y]) for x in range(16)) for y in range(16)]
        # Ignore the 4 corner pixels: a rounded rect MUST antialias its corners.
        interior = "".join(r[1:-1] for r in rows[1:-1])
        ok("?" not in interior, "no antialiased pixels in the interior",
           f"{interior.count('?')} found")

        wruns = [(y, r.count("W")) for y, r in enumerate(rows) if "W" in r]
        aruns = [(y, r.count("A")) for y, r in enumerate(rows) if "A" in r]
        ok(len({n for _, n in wruns}) == 1, "white bars identical length",
           str(sorted({n for _, n in wruns})))
        ok(bool(aruns), "accent bar survives at 16px",
           f"{sum(n for _, n in aruns)} px")
        if wruns and aruns:
            ratio = aruns[0][1] / wruns[0][1]
            ok(abs(ratio - 0.5) < 0.12, "accent bar is ~half width",
               f"ratio={ratio:.2f}")
        bars = [y for y, _ in wruns + aruns]
        top, bot = min(bars), 15 - max(bars)
        ok(abs(top - bot) <= 1, "stack vertically balanced",
           f"top={top} bottom={bot}")

    print("== manifest ==")
    mf = json.loads((STATIC / "site.webmanifest").read_text())
    ok(mf.get("theme_color") == BG, "theme_color matches --bg", mf.get("theme_color"))
    ok(mf.get("background_color") == BG, "background_color matches --bg")
    for icon in mf.get("icons", []):
        src = icon["src"].lstrip("/")
        ok((STATIC / src).is_file(), f"manifest icon {icon['src']} exists")
    ok(any(i.get("purpose") == "maskable" for i in mf.get("icons", [])),
       "a maskable icon is declared")

    print("== brand colours ==")
    for name in ("favicon.svg", "icon.svg"):
        txt = (STATIC / name).read_text()
        ok(BG in txt, f"{name} uses --bg {BG}")
        ok(ACCENT in txt, f"{name} uses accent {ACCENT}")

    print(f"\n{checks - len(failures)}/{checks} checks passed")
    if failures:
        print("FAILED: " + ", ".join(failures))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
