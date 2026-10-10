#!/usr/bin/env bash
# Runs Manim Community through uv, with nothing installed globally.
#   manim.sh -qm scene.py Explainer      (same arguments as `manim`)
#
# pycairo has no macOS wheel, so it is built on first run and needs pkg-config plus the
# cairo library (brew install cairo). When pkg-config is missing, a copy
# is borrowed from PyPI (pkgconf) instead of asking for a system install.
set -euo pipefail

command -v uv >/dev/null || { echo "manim.sh: uv is required (https://docs.astral.sh/uv/)" >&2; exit 1; }

if ! command -v pkg-config >/dev/null && [ -z "${PKG_CONFIG:-}" ]; then
  PKG_CONFIG="$(uvx --from pkgconf python -c "import shutil;print(shutil.which('pkgconf'))")"
  export PKG_CONFIG
fi

if [ "$(uname)" = "Darwin" ] && command -v brew >/dev/null; then
  prefix="$(brew --prefix)"
  # zlib and friends ship with macOS; Homebrew keeps their .pc files per OS version
  sys="$prefix/Library/Homebrew/os/mac/pkgconfig/$(sw_vers -productVersion | cut -d. -f1)"
  export PKG_CONFIG_PATH="$prefix/lib/pkgconfig:$prefix/share/pkgconfig:$sys${PKG_CONFIG_PATH:+:$PKG_CONFIG_PATH}"
fi

exec uv run --python 3.12 --with manim manim "$@"
