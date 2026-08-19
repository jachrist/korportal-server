#!/usr/bin/env bash
#
# deploy.sh — henter siste kode og oppdaterer frontend + API på serveren.
#
# Kjøres på serveren (manuelt eller av GitHub Actions via SSH). Idempotent:
# henter siste `main`, kopierer statiske filer og API-koden på plass, kjører
# `npm install` kun når dependencies har endret seg, og restarter tjenesten.
#
# Kopierer BEVISST ikke: .env, data/, uploads/ eller js/env.js — de er
# server-spesifikke og skal ikke overskrives av repoet.
#
# Miljøvariabler (med fornuftige standarder):
#   REPO_DIR       repo-klone på serveren     (default /opt/korportal/src)
#   FRONTEND_DIR   mål for statiske filer      (default /opt/korportal/frontend)
#   API_DIR        mål for API-koden           (default /opt/korportal/api-new)
#   DEPLOY_BRANCH  branch som deployes          (default main)
#   SERVICE        systemd-tjeneste             (default korportal)
#
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/korportal/src}"
FRONTEND_DIR="${FRONTEND_DIR:-/opt/korportal/frontend}"
API_DIR="${API_DIR:-/opt/korportal/api-new}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
SERVICE="${SERVICE:-korportal}"

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

# systemctl krever root; bruk sudo hvis vi ikke allerede er det.
if [ "$(id -u)" -eq 0 ]; then SUDO=""; else SUDO="sudo -n"; fi

log "Henter siste $DEPLOY_BRANCH i $REPO_DIR"
cd "$REPO_DIR"
PREV="$(git rev-parse HEAD 2>/dev/null || echo none)"
git fetch --prune origin "$DEPLOY_BRANCH"
git reset --hard "origin/$DEPLOY_BRANCH"
NEW="$(git rev-parse HEAD)"
log "Deployer $NEW"

log "Kopierer frontend → $FRONTEND_DIR"
# cp (uten --delete) beholder server-filer som js/env.js
cp -r js css assets manifest.json sw.js "$FRONTEND_DIR"/
cp -r ./*.html "$FRONTEND_DIR"/

log "Kopierer API → $API_DIR"
cp -r api-new/routes api-new/lib api-new/jobs "$API_DIR"/
cp api-new/server.js api-new/package.json "$API_DIR"/

# Kjør npm install kun når package.json faktisk endret seg (eller ved første deploy).
if [ "$PREV" = "none" ] || ! git diff --quiet "$PREV" "$NEW" -- api-new/package.json; then
  log "package.json endret — kjører npm install --omit=dev"
  ( cd "$API_DIR" && npm install --omit=dev )
else
  log "package.json uendret — hopper over npm install"
fi

log "Restarter $SERVICE"
$SUDO systemctl restart "$SERVICE"

log "Ferdig. Status:"
$SUDO systemctl --no-pager --lines=0 status "$SERVICE" || true
