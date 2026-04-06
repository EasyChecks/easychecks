#!/usr/bin/env bash
set -euo pipefail

echo "[migrate:render] Resolving known rolled-back states (if any)..."
prisma migrate resolve --rolled-back add_soft_delete_to_late_request >/dev/null 2>&1 || true
prisma migrate resolve --rolled-back add_soft_delete_to_leave_request >/dev/null 2>&1 || true

echo "[migrate:render] Running prisma migrate deploy..."
set +e
DEPLOY_OUTPUT="$(prisma migrate deploy 2>&1)"
DEPLOY_STATUS=$?
set -e
printf '%s\n' "$DEPLOY_OUTPUT"

if [ "$DEPLOY_STATUS" -eq 0 ]; then
  echo "[migrate:render] Migration deploy completed."
  exit 0
fi

if printf '%s' "$DEPLOY_OUTPUT" | grep -Fq 'Migration name: add_soft_delete_to_late_request' \
  && printf '%s' "$DEPLOY_OUTPUT" | grep -Fq 'column "deleted_at" of relation "late_requests" already exists'; then
  echo "[migrate:render] Recovering add_soft_delete_to_late_request by marking as applied..."
  prisma migrate resolve --applied add_soft_delete_to_late_request || true
  prisma migrate deploy
  exit 0
fi

if printf '%s' "$DEPLOY_OUTPUT" | grep -Fq 'Migration name: add_soft_delete_to_leave_request' \
  && printf '%s' "$DEPLOY_OUTPUT" | grep -Fq 'column "deleted_at" of relation "leave_requests" already exists'; then
  echo "[migrate:render] Recovering add_soft_delete_to_leave_request by marking as applied..."
  prisma migrate resolve --applied add_soft_delete_to_leave_request || true
  prisma migrate deploy
  exit 0
fi

echo "[migrate:render] Migration failed with an unknown error."
exit "$DEPLOY_STATUS"