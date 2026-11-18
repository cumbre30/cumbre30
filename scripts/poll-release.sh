#!/bin/bash
# Monitorea un run de build-apk.yml (tag dado como $1, ej: v1.13.4) hasta
# que concluya, y al terminar verifica el Release y sus assets.
# El token llega por env (GH_TOKEN); NUNCA se escribe a disco.
REF="${1:-v1.13.3}"
REPO=cumbre30/cumbre30
OUT=/home/z/my-project/scripts/release-poll.log
: > "$OUT"
RUN_ID=""
for i in $(seq 1 20); do
  RUN_ID=$(curl -s --max-time 20 -H "Authorization: Bearer $GH_TOKEN" \
    "https://api.github.com/repos/$REPO/actions/runs?per_page=15" \
    | python3 -c "
import json, sys
d = json.load(sys.stdin)
for r in d.get('workflow_runs', []):
    if r.get('head_branch') == '$REF' and r.get('name') == 'Build APK Cumbre30':
        print(r['id']); break
")
  [ -n "$RUN_ID" ] && break
  sleep 10
done
if [ -z "$RUN_ID" ]; then echo "POLL_ERROR: no encontré el run para $REF" >> "$OUT"; exit 1; fi
echo "monitorizando run $RUN_ID (ref $REF)" >> "$OUT"
for i in $(seq 1 45); do
  R=$(curl -s --max-time 20 -H "Authorization: Bearer $GH_TOKEN" "https://api.github.com/repos/$REPO/actions/runs/$RUN_ID")
  S=$(printf '%s' "$R" | grep -oE '"status": *"[a-z_]+"' | head -1 | cut -d'"' -f4)
  C=$(printf '%s' "$R" | grep -oE '"conclusion": *"[a-z_]+"' | head -1 | cut -d'"' -f4)
  echo "$(date +%H:%M:%S) intento $i: status=$S conclusion=$C" >> "$OUT"
  if [ "$S" = "completed" ]; then
    sleep 8
    curl -s --max-time 20 -H "Authorization: Bearer $GH_TOKEN" \
      "https://api.github.com/repos/$REPO/releases/tags/$REF" > /home/z/my-project/scripts/.release.json
    echo "=== RELEASE $REF ===" >> "$OUT"
    grep -oE '"tag_name": *"[^"]*"|"html_url": *"[^"]*releases/tag[^"]*"' \
      /home/z/my-project/scripts/.release.json | head -3 >> "$OUT"
    echo "=== ASSETS ===" >> "$OUT"
    grep -oE '"name": *"cumbre30[^"]*"|"size": *[0-9]+' \
      /home/z/my-project/scripts/.release.json | head -8 >> "$OUT"
    if [ "$C" = "success" ] && grep -q "cumbre30-latest" /home/z/my-project/scripts/.release.json; then
      echo "POLL_DONE_OK" >> "$OUT"
    else
      echo "POLL_DONE_FAIL (conclusion=$C)" >> "$OUT"
      curl -s --max-time 20 -H "Authorization: Bearer $GH_TOKEN" \
        "https://api.github.com/repos/$REPO/actions/runs/$RUN_ID/jobs" \
        | grep -oE '"name": *"[^"]*"|"conclusion": *"[a-z_]*"' | head -24 >> "$OUT"
    fi
    exit 0
  fi
  sleep 60
done
echo "POLL_TIMEOUT_45min" >> "$OUT"
