#!/usr/bin/env bash
set -euo pipefail

DOTNET_ROOT_DIR="${DOTNET_ROOT:-$HOME/.dotnet}"
INSTALL_SCRIPT="/tmp/dotnet-install.sh"
REQUIRED_MAJOR="10"

if command -v dotnet >/dev/null 2>&1; then
  INSTALLED_MAJOR="$(dotnet --version | cut -d'.' -f1)"
  if [[ "$INSTALLED_MAJOR" == "$REQUIRED_MAJOR" ]]; then
    echo "dotnet SDK $(dotnet --version) already available in PATH."
    exit 0
  fi
fi

if [[ -x "$DOTNET_ROOT_DIR/dotnet" ]]; then
  INSTALLED_MAJOR="$("$DOTNET_ROOT_DIR/dotnet" --version | cut -d'.' -f1)"
  if [[ "$INSTALLED_MAJOR" == "$REQUIRED_MAJOR" ]]; then
    echo "dotnet SDK $("$DOTNET_ROOT_DIR/dotnet" --version) already installed at $DOTNET_ROOT_DIR."
    echo "Add it to PATH with: export PATH=\"$DOTNET_ROOT_DIR:\$PATH\""
    exit 0
  fi
fi

echo "Installing .NET SDK channel ${REQUIRED_MAJOR}.0 to ${DOTNET_ROOT_DIR} ..."
curl -fsSL https://dot.net/v1/dotnet-install.sh -o "$INSTALL_SCRIPT"
bash "$INSTALL_SCRIPT" --channel "${REQUIRED_MAJOR}.0" --install-dir "$DOTNET_ROOT_DIR"

echo "Installation finished. Add dotnet to your PATH for this shell:"
echo "  export PATH=\"$DOTNET_ROOT_DIR:\$PATH\""
echo "Then verify with: dotnet --info"
