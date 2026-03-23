#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/db-sync-for-team.sh local
#   ./scripts/db-sync-for-team.sh docker
#
# This script syncs database schema and seed data after recent DB changes.
# WARNING: db push with --accept-data-loss can drop/alter columns.

MODE="${1:-local}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT_DIR"

echo "[1/6] Install deps (if needed)"
npm install

echo "[2/6] Generate Prisma client"
npx prisma generate

echo "[3/6] Sync schema to database"
npx prisma db push --accept-data-loss

echo "[4/6] Seed deterministic data (30 rows core tables)"
npm run seed

echo "[5/6] Compile check"
npm run lint

if [[ "$MODE" == "docker" ]]; then
  echo "[6/6] Regenerate Prisma in backend container and restart (port 3001 stack)"
  cd "$ROOT_DIR/.."
  docker compose exec backend sh -lc "cd /app && npx prisma generate"
  docker compose restart backend
  echo "[info] Backend restarted. Wait a few seconds, then re-run smoke tests on port 3001."
else
  echo "[6/6] Local mode complete"
fi

echo "Done. Quick verification SQL:"
echo "SELECT (SELECT COUNT(*)::int FROM users) AS users_total,"
echo "       (SELECT COUNT(*)::int FROM locations) AS locations_total,"
echo "       (SELECT COUNT(*)::int FROM shifts) AS shifts_total,"
echo "       (SELECT COUNT(*)::int FROM shifts WHERE location_id IS NULL) AS shifts_null_location_total;"
