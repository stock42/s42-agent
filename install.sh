#!/usr/bin/env bash
set -euo pipefail

version="${S42_AGENT_VERSION:-0.1.0}"
install_dir="${S42_AGENT_INSTALL_DIR:-$HOME/.local/bin}"
from_dir=""
modify_path=true

usage() {
  cat <<'HELP'
Install S42 Agent on Linux or macOS (x64 / ARM64).
  --version VERSION       Release version (default: 0.1.0)
  --install-dir DIRECTORY Binary destination (default: ~/.local/bin)
  --from-dir DIRECTORY    Install from local release files instead of GitHub
  --no-modify-path        Do not update the shell profile
  --help                  Show this help
HELP
}

while (($#)); do
  case "$1" in
    --version|--install-dir|--from-dir)
      if (($# < 2)); then echo "Missing value for $1" >&2; exit 1; fi
      case "$1" in
        --version) version="${2#v}" ;;
        --install-dir) install_dir="$2" ;;
        --from-dir) from_dir="$2" ;;
      esac
      shift 2 ;;
    --no-modify-path) modify_path=false; shift ;;
    --help|-h) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[A-Za-z0-9.-]+)?$ ]]; then
  echo "Invalid release version: $version" >&2; exit 1
fi
case "$(uname -s)" in
  Linux) platform=linux ;;
  Darwin) platform=darwin ;;
  *) echo "Use install.ps1 on Windows. Supported Unix systems: Linux and macOS." >&2; exit 1 ;;
esac
case "$(uname -m)" in
  x86_64|amd64) arch=x64 ;;
  aarch64|arm64) arch=arm64 ;;
  *) echo "Unsupported architecture: $(uname -m)" >&2; exit 1 ;;
esac
if command -v sha256sum >/dev/null 2>&1; then
  checksum_command=sha256sum
elif command -v shasum >/dev/null 2>&1; then
  checksum_command=shasum
else
  echo "SHA-256 requires sha256sum (Linux) or shasum (macOS)." >&2; exit 1
fi

asset="s42-agent-$version-$platform-$arch"
release_base="${S42_AGENT_RELEASE_BASE:-https://github.com/stock42/s42-agent/releases/download/v$version}"
temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT
if [[ -n "$from_dir" ]]; then
  cp "$from_dir/SHASUMS256.txt" "$temp_dir/SHASUMS256.txt"
  cp "$from_dir/$asset" "$temp_dir/$asset"
else
  command -v curl >/dev/null 2>&1 || { echo "Install curl first." >&2; exit 1; }
  echo "Downloading S42 Agent $version ($platform/$arch)..."
  if ! curl -fSL "$release_base/SHASUMS256.txt" -o "$temp_dir/SHASUMS256.txt" ||
     ! curl -fSL "$release_base/$asset" -o "$temp_dir/$asset"; then
    echo "Release download failed. Publish the release assets or use --from-dir ./dist." >&2
    exit 1
  fi
fi
expected="$(awk -v name="$asset" '$2 == name { print $1 }' "$temp_dir/SHASUMS256.txt")"
if [[ ! "$expected" =~ ^[a-fA-F0-9]{64}$ ]]; then
  echo "Missing or invalid checksum for $asset" >&2; exit 1
fi
if [[ "$checksum_command" == sha256sum ]]; then
  actual="$(sha256sum "$temp_dir/$asset" | awk '{ print $1 }')"
else
  actual="$(shasum -a 256 "$temp_dir/$asset" | awk '{ print $1 }')"
fi
if [[ "$actual" != "$expected" ]]; then
  echo "SHA-256 mismatch: $asset" >&2; exit 1
fi
chmod 755 "$temp_dir/$asset"
installed_version="$("$temp_dir/$asset" --version)"
if [[ "$installed_version" != "$version" ]]; then
  echo "Unexpected binary version: $installed_version (expected $version)" >&2; exit 1
fi
mkdir -p "$install_dir"
cp "$temp_dir/$asset" "$install_dir/.s42-agent-new-$$"
mv -f "$install_dir/.s42-agent-new-$$" "$install_dir/s42-agent"

if [[ "$modify_path" == true ]]; then
  profile_shell="${SHELL:-/bin/bash}"
  case "${profile_shell##*/}" in
    zsh) profile="$HOME/.zshrc" ;;
    bash)
      if [[ "$platform" == darwin ]]; then
        profile="$HOME/.bash_profile"
      else
        profile="$HOME/.bashrc"
      fi ;;
    fish) profile="$HOME/.config/fish/conf.d/s42-agent.fish" ;;
    *) profile="$HOME/.profile" ;;
  esac
  if [[ "${profile_shell##*/}" == fish ]]; then
    printf -v path_entry 'fish_add_path %q' "$install_dir"
  else
    printf -v path_entry 'export PATH=%q:"$PATH"' "$install_dir"
  fi
  mkdir -p "$(dirname "$profile")"
  touch "$profile"
  if ! grep -Fqx "$path_entry" "$profile"; then
    printf '\n# S42 Agent\n%s\n' "$path_entry" >> "$profile"
  fi
  echo "PATH configured in $profile. Open a new terminal and run: s42-agent"
else
  echo "Run: $install_dir/s42-agent"
fi
echo "Installed S42 Agent $version at $install_dir/s42-agent"
