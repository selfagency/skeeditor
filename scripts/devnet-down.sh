#!/usr/bin/env bash
# scripts/devnet-down.sh — Stop and remove the atproto-devnet stack.
#
# Usage:
#   ./scripts/devnet-down.sh          # stop + remove volumes
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "${SCRIPT_DIR}")"
DEVNET_DIR="${PROJECT_ROOT}/devnet"

if [[ ! -f "${DEVNET_DIR}/docker-compose.yml" ]]; then
  echo "WARNING: devnet submodule not found, nothing to stop." >&2
  exit 0
fi

echo "Stopping devnet stack..."
docker compose \
  -f "${DEVNET_DIR}/docker-compose.yml" \
  -f "${DEVNET_DIR}/docker-compose.test.yml" \
  --project-directory "${DEVNET_DIR}" \
  down -v --remove-orphans

echo "devnet stack removed."
