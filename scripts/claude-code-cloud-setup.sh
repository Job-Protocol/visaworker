#!/usr/bin/env bash
# Claude Code Cloud setup script for VisaWorker.
# Paste this into the "Setup script" field when creating a Claude Code
# environment. It installs Bun, project dependencies, and verifies that the
# non-secret environment variables are present.
#
# Secrets (SUPABASE_SERVICE_ROLE_KEY, BYOK_ENCRYPTION_KEY, DEMO_RESET_SECRET,
# and any managed AI keys) must be configured separately via Claude Code's
# secret store — do NOT paste them here.

set -euo pipefail

echo "→ Setting up VisaWorker in Claude Code cloud..."

# 1. Install Bun via npm (avoids curl|bash blocks in restricted sandboxes).
if ! command -v bun &>/dev/null; then
  echo "→ Installing Bun via npm..."
  if npm install -g bun; then
    echo "✓ Bun installed globally"
  else
    echo "⚠ Global npm install failed; trying user-local install..."
    mkdir -p "$HOME/.local/bin"
    npm install -g --prefix "$HOME/.local" bun
    export PATH="$HOME/.local/bin:$PATH"
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bashrc"
    echo "✓ Bun installed to ~/.local/bin"
  fi
else
  echo "✓ Bun already available: $(command -v bun)"
fi

# Ensure bun is on PATH for this session.
export PATH="$(dirname "$(command -v bun)"):$PATH"

# 2. Provide safe defaults for required non-secret environment variables.
# Claude Code sometimes does not expose the environment-variables box to the
# setup-script shell. These values are publishable project config, not secrets.
: "${VITE_SUPABASE_URL:=https://wnplsizvzylyfddjhxll.supabase.co}"
: "${VITE_SUPABASE_PROJECT_ID:=wnplsizvzylyfddjhxll}"
: "${VITE_SUPABASE_PUBLISHABLE_KEY:=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InducGxzaXp2enlseWZkZGpoeGxsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MDE5MDIsImV4cCI6MjA5ODQ3NzkwMn0.kYdazPnW2HlxDF0F_oWHTXLna0AJ7Q0m9DIJarHkSIQ}"
: "${SUPABASE_URL:=$VITE_SUPABASE_URL}"
: "${SUPABASE_PUBLISHABLE_KEY:=$VITE_SUPABASE_PUBLISHABLE_KEY}"

export VITE_SUPABASE_URL
export VITE_SUPABASE_PROJECT_ID
export VITE_SUPABASE_PUBLISHABLE_KEY
export SUPABASE_URL
export SUPABASE_PUBLISHABLE_KEY

# 3. Verify required non-secret environment variables.
REQUIRED_VARS=(
  VITE_SUPABASE_URL
  VITE_SUPABASE_PROJECT_ID
  VITE_SUPABASE_PUBLISHABLE_KEY
  SUPABASE_URL
  SUPABASE_PUBLISHABLE_KEY
)

MISSING=0
for var in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    echo "✗ Missing env var: $var"
    MISSING=1
  fi
done

if [[ $MISSING -eq 1 ]]; then
  echo
  echo "── Diagnostics ──"
  echo "Shell: $SHELL / $0 / BASH_VERSION=${BASH_VERSION:-none}"
  echo "VITE_/SUPABASE_ vars visible to this script:"
  env | grep -E '^(VITE_|SUPABASE_|NODE_ENV)' | sed 's/=.*/=<set>/' || echo "  (none)"
  echo
  echo "If the list above is empty, Claude Code is not injecting your"
  echo "Environment variables box into the setup script's shell. Confirm"
  echo "you clicked 'Save changes' AND started a NEW session (existing"
  echo "sessions keep the old env). If vars are listed but one is still"
  echo "reported missing, check for typos or stray spaces in that line."
  exit 1
fi

# 4. Locate the project root (directory containing package.json) and cd into it.
#    Claude Code's setup script runs from $HOME by default, not the repo.
find_project_root() {
  # Prefer the script's own directory's parent (scripts/ lives at repo root).
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  if [[ -f "$script_dir/../package.json" ]]; then
    (cd "$script_dir/.." && pwd)
    return
  fi
  # Fallback: search common Claude Code checkout locations.
  for candidate in \
    "$PWD" \
    "$HOME/project" \
    "$HOME/workspace" \
    "$HOME/repo" \
    /workspace \
    /repo; do
    if [[ -f "$candidate/package.json" ]]; then
      echo "$candidate"
      return
    fi
  done
  # Last resort: shallow search under $HOME.
  find "$HOME" -maxdepth 3 -name package.json -not -path '*/node_modules/*' -print -quit 2>/dev/null | xargs -r dirname
}

PROJECT_ROOT="$(find_project_root)"
if [[ -z "$PROJECT_ROOT" || ! -f "$PROJECT_ROOT/package.json" ]]; then
  echo "✗ Could not locate package.json. Run this script from the repo root."
  exit 1
fi
echo "→ Project root: $PROJECT_ROOT"
cd "$PROJECT_ROOT"

# 5. Install project dependencies.
echo "→ Installing project dependencies (this may take a minute)..."
bun install

# 5. Verify the app builds.
echo "→ Build check..."
bun run build

echo
echo "✓ VisaWorker is ready."
echo
echo "To start the dev server, run:"
echo "  bun run dev"
echo
echo "The app will be available on port 8080."
echo
echo "If you need secrets for full functionality (service role, BYOK key, etc.),"
echo "set them via Claude Code's secret store, not in this script."
