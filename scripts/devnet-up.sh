#!/usr/bin/env bash
# scripts/devnet-up.sh — Start the atproto-devnet stack for local/CI E2E testing.
#
# Usage:
#   ./scripts/devnet-up.sh           # start and wait for healthy
#   DEVNET_TIMEOUT=120 ./scripts/devnet-up.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "${SCRIPT_DIR}")"
DEVNET_DIR="${PROJECT_ROOT}/devnet"
DATA_DIR="${DEVNET_DIR}/data"

if [[ ! -f "${DEVNET_DIR}/docker-compose.yml" ]]; then
  echo "ERROR: devnet submodule not initialised." >&2
  echo "  Run: git submodule update --init devnet" >&2
  exit 1
fi

# Create data dir (world-writable so the init container can write it as root)
mkdir -p "${DATA_DIR}"
chmod 777 "${DATA_DIR}"

# Copy .env.example → .env only if .env doesn't already exist
if [[ ! -f "${DEVNET_DIR}/.env" ]]; then
  if [[ -f "${DEVNET_DIR}/.env.example" ]]; then
    cp "${DEVNET_DIR}/.env.example" "${DEVNET_DIR}/.env"
    echo "Copied .env.example → devnet/.env"
  fi
fi

TIMEOUT="${DEVNET_TIMEOUT:-60}"

echo "Starting devnet stack (timeout: ${TIMEOUT}s)..."
docker compose \
  -f "${DEVNET_DIR}/docker-compose.yml" \
  -f "${DEVNET_DIR}/docker-compose.test.yml" \
  --project-directory "${DEVNET_DIR}" \
  up -d --wait --wait-timeout "${TIMEOUT}"

echo "devnet stack is healthy."
echo "PDS: http://localhost:${DEVNET_PDS_PORT:-3000}"
echo "Accounts written to: ${DATA_DIR}/accounts.env"
