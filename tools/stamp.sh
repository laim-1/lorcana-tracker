#!/bin/sh
# Stamp a new build version into index.html and version.json (run before each commit).
cd "$(dirname "$0")/.." && V=$(date -u +%Y%m%d%H%M%S)
sed "s/__V__/$V/g" index.html.tmpl > index.html && printf '{"version":"%s"}\n' "$V" > version.json && echo "$V"
