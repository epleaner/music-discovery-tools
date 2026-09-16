#!/bin/bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../.."
pnpm install --frozen-lockfile --ignore-scripts --prod=false
pnpm --filter @soundscape/types build
pnpm --filter @soundscape/utils build
pnpm --filter @soundscape/server build
