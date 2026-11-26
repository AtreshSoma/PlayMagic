#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Downloads MediaPipe Tasks Vision (library, WebAssembly runtime and the hand
# + face models) into wonderland/vendor/mediapipe/ so the portal runs with
# no network access at all. The portal automatically prefers these files.
#
#   bash wonderland/scripts/vendor-mediapipe.sh
# ---------------------------------------------------------------------------
set -euo pipefail

VERSION="0.10.14"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$HERE/../vendor/mediapipe"
CDN="https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}"
MODELS="https://storage.googleapis.com/mediapipe-models"

mkdir -p "$OUT/wasm"
fetch() { echo "  ↓ $2"; curl -fsSL --retry 2 "$1" -o "$OUT/$2"; }

echo "Vendoring MediaPipe Tasks Vision ${VERSION} into ${OUT}"
fetch "$CDN/vision_bundle.mjs" "vision_bundle.mjs"
for f in vision_wasm_internal.js vision_wasm_internal.wasm vision_wasm_nosimd_internal.js vision_wasm_nosimd_internal.wasm; do
  fetch "$CDN/wasm/$f" "wasm/$f"
done
fetch "$MODELS/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task" "hand_landmarker.task"
fetch "$MODELS/face_landmarker/face_landmarker/float16/1/face_landmarker.task" "face_landmarker.task"
echo "Done. Reload the portal: it now loads everything from ./vendor/mediapipe/."
