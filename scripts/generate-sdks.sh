#!/usr/bin/env bash
# ------------------------------------------------------------------
# generate-sdks.sh — auto-regenerate typed API clients from the live
# OpenAPI schema on every backend release.
#
# Runs `openapi-generator-cli` for Flutter (Dart), iOS (Swift 5) and
# Android (Kotlin) — everything a "standalone e-commerce mobile app"
# needs. Output lands under `clients/` at repo root.
#
# Wire this into CI (GitHub Actions / Vercel post-deploy) so the SDKs
# stay in lockstep with the backend — zero manual copy-paste of API
# shapes into mobile projects.
#
# Usage:
#   BACKEND_URL=https://api.centraders.com ./scripts/generate-sdks.sh
#   BACKEND_URL=http://localhost:8001      ./scripts/generate-sdks.sh
#
# Prereqs (dev machine or CI):
#   • Java 11+                 (openapi-generator runtime)
#   • npx                      (bundled with modern Node)
#
# openapi-generator-cli is pulled via npx at runtime, so nothing needs
# to be globally installed on developer laptops.
# ------------------------------------------------------------------
set -euo pipefail

BACKEND_URL="${BACKEND_URL:-http://localhost:8001}"
OUT_ROOT="$(cd "$(dirname "$0")/.." && pwd)/clients"
SCHEMA_TMP="$(mktemp).json"

echo "▶ Fetching OpenAPI schema from ${BACKEND_URL}/openapi.json"
curl -fsS "${BACKEND_URL}/openapi.json" -o "${SCHEMA_TMP}"
SCHEMA_BYTES=$(wc -c <"${SCHEMA_TMP}")
if [[ ${SCHEMA_BYTES} -lt 1000 ]]; then
  echo "✖ Schema is suspiciously small (${SCHEMA_BYTES} bytes) — aborting."
  exit 1
fi
echo "✓ Schema fetched (${SCHEMA_BYTES} bytes)"

mkdir -p "${OUT_ROOT}"

generate() {
  local generator="$1"     # e.g. dart, swift5, kotlin
  local out_dir="$2"       # e.g. clients/flutter
  local pkg_name="${3:-addrika_client}"

  echo "──────────────────────────────────────────────"
  echo "▶ Generating ${generator} SDK  →  ${out_dir}"
  echo "──────────────────────────────────────────────"
  rm -rf "${out_dir}"
  npx --yes @openapitools/openapi-generator-cli generate \
    -i "${SCHEMA_TMP}" \
    -g "${generator}" \
    -o "${out_dir}" \
    --additional-properties="packageName=${pkg_name},library=alamofire,useEsClient=true,pubName=${pkg_name},pubLibrary=${pkg_name}.api" \
    --skip-validate-spec
  echo "✓ ${generator} SDK ready"
}

generate dart   "${OUT_ROOT}/flutter"  addrika_api
generate swift5 "${OUT_ROOT}/ios"      AddrikaAPI
generate kotlin "${OUT_ROOT}/android"  com.addrika.api

# TypeScript client — useful for a shared web/mobile-web codebase.
generate typescript-axios "${OUT_ROOT}/web-ts" addrika-api

rm -f "${SCHEMA_TMP}"

cat <<EOF

✨ All SDKs regenerated.

  clients/
    flutter/      → Import as \`import 'package:addrika_api/api.dart';\`
    ios/          → Add via SwiftPM or CocoaPods
    android/      → Add as a Gradle module
    web-ts/       → \`npm i ./clients/web-ts\`

Every future backend change (\`git push\` → deploy) will re-run this
script and republish these SDKs automatically. Mobile teams pull the
new version and their typed models are already up to date.
EOF
