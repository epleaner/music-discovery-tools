#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"

has_mode=false
for arg in "$@"; do
  case "$arg" in
    --sync-now|--dry-run|--sample)
      has_mode=true
      break
      ;;
  esac
done

if [ "$#" -eq 0 ] || [ "$has_mode" = false ]; then
  set -- --sync-now "$@"
fi

pnpm --filter @soundscape/ingest start -- "$@"
