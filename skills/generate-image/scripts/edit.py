#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.9"
# dependencies = ["pillow>=10", "numpy", "smartcrop", "vtracer"]
# ///
"""Post-process generated images: split, adjust, crop, pad, trim, convert, icons,
comparison sheets, palettes, SVG tracing, PDF export, and background removal.

Run it with `uv run edit.py …` — uv resolves and caches the dependencies on first
use, so nothing is installed globally. Plain `python3 edit.py …` also works for the
commands whose libraries are already present.

    edit.py info a.png
    edit.py split a.png --rows 2 --cols 2
    edit.py adjust a.png --contrast 1.3 --saturation 1.2
    edit.py crop a.png --aspect 16:9 --gravity center
    edit.py resize a.png --width 1280
    edit.py trim a.png
    edit.py pad a.png --aspect 16:9 --color "#ffffff"
    edit.py convert a.png --format webp --quality 85
    edit.py icon-set a.png --sizes 16,32,64,128,256,512
    edit.py sheet a.png b.png --labels "nano banana,gpt image"
    edit.py smart-crop a.png --aspect 16:9
    edit.py palette a.png --count 6
    edit.py trace a.png --out logo.svg
    edit.py pdf a.png b.png --out contact.pdf
    edit.py bg-remove a.png
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from typing import List, Optional, Tuple

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFont

# ---------------------------------------------------------------- helpers


def fail(msg: str) -> "None":
    print(f"error: {msg}", file=sys.stderr)
    raise SystemExit(1)


def load(path: str) -> Image.Image:
    if not os.path.isfile(path):
        fail(f"no such file: {path}")
    try:
        return Image.open(path)
    except Exception as e:  # unreadable or not an image
        fail(f"cannot open {path}: {e}")


def out_path(src: str, suffix: str, explicit: Optional[str] = None, ext: Optional[str] = None) -> str:
    if explicit:
        return explicit
    stem, src_ext = os.path.splitext(src)
    return f"{stem}-{suffix}{ext or src_ext}"


def save(img: Image.Image, path: str, quality: Optional[int] = None) -> str:
    ext = os.path.splitext(path)[1].lower()
    params = {}
    if ext in (".jpg", ".jpeg"):
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        params["quality"] = quality or 92
    elif ext == ".webp":
        params["quality"] = quality or 90
    elif ext == ".png" and quality:
        params["compress_level"] = max(0, min(9, 9 - quality // 12))
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    img.save(path, **params)
    print(path)
    return path


def parse_ratio(text: str) -> float:
    try:
        w, h = text.replace("x", ":").split(":")
        return float(w) / float(h)
    except Exception:
        fail(f"bad aspect ratio {text!r} (use 16:9)")


def parse_color(text: str) -> str:
    return text if text.startswith("#") or text.isalpha() else f"#{text}"


# ---------------------------------------------------------------- commands


def cmd_info(a: argparse.Namespace) -> None:
    for path in a.files:
        img = load(path)
        kb = os.path.getsize(path) // 1024
        print(f"{path}: {img.width}x{img.height} {img.format} {img.mode} {kb} KB")


def cmd_split(a: argparse.Namespace) -> None:
    img = load(a.file)
    rows, cols = a.rows, a.cols
    if rows < 1 or cols < 1:
        fail("--rows and --cols must be >= 1")
    tile_w, tile_h = img.width // cols, img.height // rows
    outdir = a.out or os.path.dirname(a.file) or "."
    stem = os.path.splitext(os.path.basename(a.file))[0]
    ext = os.path.splitext(a.file)[1] or ".png"
    for r in range(rows):
        for c in range(cols):
            box = (c * tile_w, r * tile_h, (c + 1) * tile_w, (r + 1) * tile_h)
            save(img.crop(box), os.path.join(outdir, f"{stem}-r{r + 1}c{c + 1}{ext}"))


def cmd_adjust(a: argparse.Namespace) -> None:
    img = load(a.file)
    if img.mode == "P":
        img = img.convert("RGBA")
    applied = []
    for name, factor, enhancer in (
        ("contrast", a.contrast, ImageEnhance.Contrast),
        ("brightness", a.brightness, ImageEnhance.Brightness),
        ("saturation", a.saturation, ImageEnhance.Color),
        ("sharpness", a.sharpness, ImageEnhance.Sharpness),
    ):
        if factor is not None:
            img = enhancer(img).enhance(factor)
            applied.append(name)
    if a.grayscale:
        img = img.convert("L").convert(load(a.file).mode if load(a.file).mode != "P" else "RGB")
        applied.append("grayscale")
    if not applied:
        fail("nothing to do (pass --contrast, --brightness, --saturation, --sharpness or --grayscale)")
    save(img, out_path(a.file, "-".join(applied), a.out), a.quality)


def cmd_resize(a: argparse.Namespace) -> None:
    img = load(a.file)
    if a.scale:
        w, h = int(img.width * a.scale), int(img.height * a.scale)
    elif a.width and a.height:
        w, h = a.width, a.height
        if a.fit == "cover":
            from PIL import ImageOps

            img = ImageOps.fit(img, (w, h), Image.LANCZOS)
            save(img, out_path(a.file, f"{w}x{h}", a.out), a.quality)
            return
        if a.fit == "contain":
            img.thumbnail((w, h), Image.LANCZOS)
            save(img, out_path(a.file, f"{w}x{h}", a.out), a.quality)
            return
    elif a.width:
        w = a.width
        h = int(img.height * (a.width / img.width))
    elif a.height:
        h = a.height
        w = int(img.width * (a.height / img.height))
    else:
        fail("pass --width, --height or --scale")
    save(img.resize((w, h), Image.LANCZOS), out_path(a.file, f"{w}x{h}", a.out), a.quality)


def cmd_crop(a: argparse.Namespace) -> None:
    img = load(a.file)
    if a.box:
        try:
            x, y, w, h = (int(v) for v in a.box.split(","))
        except Exception:
            fail("--box must be x,y,width,height")
        box = (x, y, x + w, y + h)
        label = "crop"
    elif a.aspect:
        target = parse_ratio(a.aspect)
        current = img.width / img.height
        if current > target:  # too wide -> trim sides
            w = int(img.height * target)
            h = img.height
        else:  # too tall -> trim top/bottom
            w = img.width
            h = int(img.width / target)
        if a.gravity == "top":
            x, y = (img.width - w) // 2, 0
        elif a.gravity == "bottom":
            x, y = (img.width - w) // 2, img.height - h
        elif a.gravity == "left":
            x, y = 0, (img.height - h) // 2
        elif a.gravity == "right":
            x, y = img.width - w, (img.height - h) // 2
        else:
            x, y = (img.width - w) // 2, (img.height - h) // 2
        box = (x, y, x + w, y + h)
        label = a.aspect.replace(":", "x")
    else:
        fail("pass --box or --aspect")
    save(img.crop(box), out_path(a.file, label, a.out), a.quality)


def cmd_trim(a: argparse.Namespace) -> None:
    """Remove a uniform border (white background, transparent padding)."""
    img = load(a.file)
    if img.mode == "RGBA":
        alpha = img.split()[-1]
        bbox = alpha.getbbox()
    else:
        rgb = img.convert("RGB")
        bg = Image.new("RGB", rgb.size, rgb.getpixel((0, 0)))
        diff = ImageChops.difference(rgb, bg)
        if a.tolerance:
            diff = diff.point(lambda p: 255 if p > a.tolerance else 0)
        bbox = diff.getbbox()
    if not bbox:
        fail("image is a single uniform color, nothing to trim")
    save(img.crop(bbox), out_path(a.file, "trim", a.out), a.quality)


def cmd_pad(a: argparse.Namespace) -> None:
    """Letterbox to an aspect ratio without cropping."""
    img = load(a.file)
    target = parse_ratio(a.aspect)
    current = img.width / img.height
    if current > target:
        w, h = img.width, int(img.width / target)
    else:
        w, h = int(img.height * target), img.height
    mode = "RGBA" if (img.mode == "RGBA" or a.color == "transparent") else "RGB"
    bg = (0, 0, 0, 0) if a.color == "transparent" else parse_color(a.color)
    canvas = Image.new(mode, (w, h), bg)
    canvas.paste(img, ((w - img.width) // 2, (h - img.height) // 2), img if img.mode == "RGBA" else None)
    save(canvas, out_path(a.file, a.aspect.replace(":", "x") + "-pad", a.out), a.quality)


def cmd_convert(a: argparse.Namespace) -> None:
    img = load(a.file)
    ext = "." + a.format.lower().replace("jpeg", "jpg")
    save(img, out_path(a.file, "conv", a.out, ext=ext), a.quality)


def cmd_icon_set(a: argparse.Namespace) -> None:
    img = load(a.file)
    sizes = [int(s) for s in a.sizes.split(",")]
    outdir = a.out or os.path.join(os.path.dirname(a.file) or ".", "icons")
    stem = os.path.splitext(os.path.basename(a.file))[0]
    for s in sizes:
        square = img.copy()
        if square.width != square.height:  # center-crop to square first
            side = min(square.width, square.height)
            left, top = (square.width - side) // 2, (square.height - side) // 2
            square = square.crop((left, top, left + side, top + side))
        save(square.resize((s, s), Image.LANCZOS), os.path.join(outdir, f"{stem}-{s}.png"))


def cmd_sheet(a: argparse.Namespace) -> None:
    """Tile several images side by side with labels — for comparing models."""
    if len(a.files) < 2:
        fail("sheet needs at least 2 images")
    labels = (a.labels.split(",") if a.labels else
              [os.path.splitext(os.path.basename(f))[0][-28:] for f in a.files])
    images = [load(f).convert("RGB") for f in a.files]
    cols = a.cols or len(images)
    rows = (len(images) + cols - 1) // cols
    cell = a.cell
    bar = 28
    sheet = Image.new("RGB", (cols * cell, rows * (cell + bar)), "#ffffff")
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 16)
    except Exception:
        font = ImageFont.load_default()
    for i, img in enumerate(images):
        img = img.copy()
        img.thumbnail((cell, cell), Image.LANCZOS)
        r, c = divmod(i, cols)
        x = c * cell + (cell - img.width) // 2
        y = r * (cell + bar) + bar + (cell - img.height) // 2
        sheet.paste(img, (x, y))
        label = labels[i] if i < len(labels) else ""
        draw.text((c * cell + 6, r * (cell + bar) + 6), label, fill="#111111", font=font)
    save(sheet, a.out or "comparison-sheet.png", a.quality)


def cmd_smart_crop(a: argparse.Namespace) -> None:
    """Crop to an aspect ratio around the most interesting region, not the centre."""
    try:
        import smartcrop
    except ImportError:
        fail("smartcrop is missing — run this command with `uv run edit.py` instead of python3")
    img = load(a.file).convert("RGB")
    target = parse_ratio(a.aspect)
    if img.width / img.height > target:
        w, h = int(img.height * target), img.height
    else:
        w, h = img.width, int(img.width / target)
    result = smartcrop.SmartCrop().crop(img, w, h)
    box = result["top_crop"]
    crop = load(a.file).crop((box["x"], box["y"], box["x"] + box["width"], box["y"] + box["height"]))
    if (crop.width, crop.height) != (w, h):
        crop = crop.resize((w, h), Image.LANCZOS)
    save(crop, out_path(a.file, a.aspect.replace(":", "x") + "-smart", a.out), a.quality)


def cmd_palette(a: argparse.Namespace) -> None:
    """Report the dominant colors as hex — for building a design system around an image."""
    img = load(a.file).convert("RGB")
    small = img.copy()
    small.thumbnail((200, 200))
    quant = small.quantize(colors=a.count, method=Image.MEDIANCUT)
    palette = quant.getpalette() or []
    counts = sorted(quant.getcolors() or [], reverse=True)
    total = sum(c for c, _ in counts) or 1
    swatches = []
    for count, idx in counts[: a.count]:
        r, g, b = palette[idx * 3: idx * 3 + 3]
        swatches.append((f"#{r:02x}{g:02x}{b:02x}", 100 * count / total))
        print(f"#{r:02x}{g:02x}{b:02x}  {100 * count / total:5.1f}%")
    if a.out:
        strip = Image.new("RGB", (120 * len(swatches), 120), "#ffffff")
        for i, (hexcode, _) in enumerate(swatches):
            strip.paste(Image.new("RGB", (120, 120), hexcode), (i * 120, 0))
        save(strip, a.out)


def cmd_trace(a: argparse.Namespace) -> None:
    """Raster -> SVG. Turns a generated logo or icon into something scalable."""
    try:
        import vtracer
    except ImportError:
        fail("vtracer is missing — run this command with `uv run edit.py` instead of python3")
    dst = out_path(a.file, "trace", a.out, ext=".svg")
    parent = os.path.dirname(dst)
    if parent:
        os.makedirs(parent, exist_ok=True)
    vtracer.convert_image_to_svg_py(a.file, dst, colormode=a.colormode, filter_speckle=a.speckle)
    print(dst)


def cmd_pdf(a: argparse.Namespace) -> None:
    """Combine images into one PDF — a deliverable to send someone."""
    pages = []
    for path in a.files:
        img = load(path)
        pages.append(img.convert("RGB"))
    dst = a.out or "images.pdf"
    pages[0].save(dst, "PDF", resolution=a.dpi, save_all=True, append_images=pages[1:])
    print(dst)


def cmd_bg_remove(a: argparse.Namespace) -> None:
    """Background removal via rembg, run through uv so nothing is installed globally."""
    dst = out_path(a.file, "nobg", a.out, ext=".png")
    runner = shutil.which("uvx") or shutil.which("uv")
    spec = f"rembg[{a.backend},cli]"  # the cli extra provides the `rembg` command
    try:
        import rembg  # noqa: F401
        cmd = [sys.executable, "-m", "rembg", "i", a.file, dst]
    except ImportError:
        if not runner:
            fail(f"rembg is not installed and uv is not available — install uv, or pip install '{spec}'")
        cmd = ([runner, "--from", spec, "rembg"] if runner.endswith("uvx")
               else [runner, "tool", "run", "--from", spec, "rembg"]) + ["i", a.file, dst]
    print(f"running: {' '.join(cmd[:4])} … (first run downloads the model, ~1-2 min)", file=sys.stderr)
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0 or not os.path.exists(dst):
        fail(f"rembg failed: {(proc.stderr or proc.stdout).strip()[:400]}")
    print(dst)


# ---------------------------------------------------------------- cli


def main() -> None:
    p = argparse.ArgumentParser(prog="edit.py", description="Post-process generated images.")
    sub = p.add_subparsers(dest="command", required=True)

    def common(sp, multi=False):
        sp.add_argument("files" if multi else "file", nargs="+" if multi else None)
        sp.add_argument("--out", help="output file or directory")
        sp.add_argument("--quality", type=int, help="1-100 for jpg/webp")
        return sp

    common(sub.add_parser("info", help="dimensions, format, file size"), multi=True).set_defaults(fn=cmd_info)

    sp = common(sub.add_parser("split", help="cut into a grid of tiles"))
    sp.add_argument("--rows", type=int, default=2)
    sp.add_argument("--cols", type=int, default=2)
    sp.set_defaults(fn=cmd_split)

    sp = common(sub.add_parser("adjust", help="contrast, brightness, saturation, sharpness"))
    sp.add_argument("--contrast", type=float, help="1.0 = unchanged, 1.3 = punchier")
    sp.add_argument("--brightness", type=float)
    sp.add_argument("--saturation", type=float, help="0 = grayscale, 1.5 = vivid")
    sp.add_argument("--sharpness", type=float)
    sp.add_argument("--grayscale", action="store_true")
    sp.set_defaults(fn=cmd_adjust)

    sp = common(sub.add_parser("resize", help="scale to width/height/factor"))
    sp.add_argument("--width", type=int)
    sp.add_argument("--height", type=int)
    sp.add_argument("--scale", type=float, help="2 = double size")
    sp.add_argument("--fit", choices=["cover", "contain", "stretch"], default="stretch")
    sp.set_defaults(fn=cmd_resize)

    sp = common(sub.add_parser("crop", help="crop to a box or an aspect ratio"))
    sp.add_argument("--box", help="x,y,width,height")
    sp.add_argument("--aspect", help="16:9")
    sp.add_argument("--gravity", choices=["center", "top", "bottom", "left", "right"], default="center")
    sp.set_defaults(fn=cmd_crop)

    sp = common(sub.add_parser("trim", help="remove uniform/transparent borders"))
    sp.add_argument("--tolerance", type=int, default=10)
    sp.set_defaults(fn=cmd_trim)

    sp = common(sub.add_parser("pad", help="letterbox to an aspect ratio"))
    sp.add_argument("--aspect", required=True)
    sp.add_argument("--color", default="#ffffff", help="hex or 'transparent'")
    sp.set_defaults(fn=cmd_pad)

    sp = common(sub.add_parser("convert", help="change file format"))
    sp.add_argument("--format", required=True, choices=["png", "jpg", "jpeg", "webp"])
    sp.set_defaults(fn=cmd_convert)

    sp = common(sub.add_parser("icon-set", help="square icons at several sizes"))
    sp.add_argument("--sizes", default="16,32,64,128,256,512")
    sp.set_defaults(fn=cmd_icon_set)

    sp = common(sub.add_parser("sheet", help="labelled comparison sheet"), multi=True)
    sp.add_argument("--labels", help="comma-separated, one per image")
    sp.add_argument("--cols", type=int)
    sp.add_argument("--cell", type=int, default=512)
    sp.set_defaults(fn=cmd_sheet)

    sp = common(sub.add_parser("smart-crop", help="content-aware crop to an aspect ratio"))
    sp.add_argument("--aspect", required=True)
    sp.set_defaults(fn=cmd_smart_crop)

    sp = common(sub.add_parser("palette", help="dominant colors as hex"))
    sp.add_argument("--count", type=int, default=6)
    sp.set_defaults(fn=cmd_palette)

    sp = common(sub.add_parser("trace", help="raster -> SVG (logos, icons)"))
    sp.add_argument("--colormode", choices=["color", "binary"], default="color")
    sp.add_argument("--speckle", type=int, default=4, help="higher removes more noise")
    sp.set_defaults(fn=cmd_trace)

    sp = common(sub.add_parser("pdf", help="combine images into one PDF"), multi=True)
    sp.add_argument("--dpi", type=int, default=150)
    sp.set_defaults(fn=cmd_pdf)

    sp = common(sub.add_parser("bg-remove", help="cut out the subject (rembg)"))
    sp.add_argument("--backend", choices=["cpu", "gpu"], default="cpu")
    sp.set_defaults(fn=cmd_bg_remove)

    args = p.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
