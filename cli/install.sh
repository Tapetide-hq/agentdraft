#!/bin/sh
# agentdraft CLI installer.
#
#   curl -fsSL https://agentdraft.tapetide.com/install.sh | sh
#   curl -fsSL https://raw.githubusercontent.com/Tapetide-hq/agentdraft/main/cli/install.sh | sh
#
# Env overrides:
#   AGENTDRAFT_INSTALL_DIR   install location (default: ~/.local/bin)
#   AGENTDRAFT_VERSION       specific tag, e.g. v0.1.0 (default: latest release)
#
# Anything piped into a shell deserves scrutiny, so this script: pins the repo, resolves
# the release over HTTPS, VERIFIES the SHA-256 against the published checksums.txt before
# installing, and never writes outside the install dir.
set -eu

REPO="Tapetide-hq/agentdraft"
BIN="agentdraft"
INSTALL_DIR="${AGENTDRAFT_INSTALL_DIR:-$HOME/.local/bin}"

info() { printf '  %s\n' "$1"; }
die() { printf 'error: %s\n' "$1" >&2; exit 1; }

command -v curl >/dev/null 2>&1 || die "curl is required"
command -v tar >/dev/null 2>&1 || die "tar is required"

os=$(uname -s | tr '[:upper:]' '[:lower:]')
arch=$(uname -m)
case "$arch" in
  x86_64 | amd64) arch="amd64" ;;
  aarch64 | arm64) arch="arm64" ;;
  *) die "unsupported architecture: $arch" ;;
esac
case "$os" in
  linux | darwin) ;;
  *) die "unsupported OS: $os (download the .zip from the releases page on Windows)" ;;
esac

printf 'Installing %s for %s/%s\n' "$BIN" "$os" "$arch"

# Resolve the version.
if [ -n "${AGENTDRAFT_VERSION:-}" ]; then
  tag="$AGENTDRAFT_VERSION"
else
  info "resolving latest release..."
  tag=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" \
    | grep '"tag_name"' | head -1 | cut -d'"' -f4)
fi
[ -n "$tag" ] || die "could not resolve a release. Build from source:
  go install github.com/$REPO/cli@latest"
version="${tag#v}"

asset="${BIN}_${version}_${os}_${arch}.tar.gz"
base="https://github.com/$REPO/releases/download/$tag"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT INT TERM

info "downloading $asset"
curl -fsSL "$base/$asset" -o "$tmp/$asset" \
  || die "download failed: $base/$asset"

# Integrity check. A curl|sh installer that skips this is trusting the transport alone.
if curl -fsSL "$base/checksums.txt" -o "$tmp/checksums.txt" 2>/dev/null; then
  expected=$(grep " $asset\$" "$tmp/checksums.txt" | awk '{print $1}')
  if [ -n "$expected" ]; then
    if command -v sha256sum >/dev/null 2>&1; then
      actual=$(sha256sum "$tmp/$asset" | awk '{print $1}')
    elif command -v shasum >/dev/null 2>&1; then
      actual=$(shasum -a 256 "$tmp/$asset" | awk '{print $1}')
    else
      actual=""
    fi
    if [ -n "$actual" ]; then
      [ "$actual" = "$expected" ] || die "checksum MISMATCH for $asset
  expected $expected
  actual   $actual
Refusing to install."
      info "checksum verified"
    else
      info "warning: no sha256 tool found; skipping checksum verification"
    fi
  else
    info "warning: $asset not listed in checksums.txt; skipping verification"
  fi
else
  info "warning: checksums.txt unavailable; skipping verification"
fi

tar -xzf "$tmp/$asset" -C "$tmp" || die "failed to extract $asset"
[ -f "$tmp/$BIN" ] || die "archive did not contain the $BIN binary"

mkdir -p "$INSTALL_DIR"
mv "$tmp/$BIN" "$INSTALL_DIR/$BIN"
chmod +x "$INSTALL_DIR/$BIN"

printf '\nInstalled %s %s to %s\n' "$BIN" "$version" "$INSTALL_DIR/$BIN"

case ":$PATH:" in
  *":$INSTALL_DIR:"*) ;;
  *)
    printf '\n%s is not on your PATH. Add it:\n  export PATH="%s:$PATH"\n' \
      "$INSTALL_DIR" "$INSTALL_DIR"
    ;;
esac

printf '\nNext:\n  %s auth set ad_your_key\n  %s upload plan.md\n' "$BIN" "$BIN"
