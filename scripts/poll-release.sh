#!/bin/bash
# Monitorea el run de build-apk.yml (tag v1.13.3) hasta que concluya,
# y al terminar verifica el Release y sus assets.
# El token llega por env (GH_TOKEN); NUNCA se escribe a disco.
RUN_ID=44352499040
REPO=cumbre30/cumbre30
OUT=/home/z/my-project/scripts/release-poll.log
: > "$OUT"
for i in $(seq 1 45); do
  R=$(curl -s --max-time 20 -H "Authorization: Bearer $GH_TOKEN" "https://api.github.com/repos/$REPO/actions/runs/$RUN_ID")
  S=$(printf '%s' "$R" | grep -oE '"status": *"[a-z_]+"' | head -1 | cut -d'"' -f4)
  C=$(printf '%s' "$R" | grep -oE '"conclusion": *"[a-z_]+"|null' | head -1)
  echo "$(date +%H:%M:%S) intento $i: status=$S conclusion=$C" >> "$OUT"
  if [ "$S" = "completed" ]; then
    if [ "$C" = "success" ]; then
      sleep 5
      curl -s --max-time 20 -H "Authorization: Bearer $GH_TOKEN" \
        "https://api.github.com/repos/$REPO/releases/tags/v1.13.3" > /home/z/my-project/scripts/.release.json
      echo "=== RELEASE v1.13.3 ===" >> "$OUT"
      grep -oE '"tag_name": *"[^"]*"|"name": *"Cumbre30[^"]*"|"html_url": *"[^"]*releases/tag[^"]*"' \
        /home/z/my-project/scripts/.release.json | head -4 >> "$OUT"
      echo "=== ASSETS ===" >> "$OUT"
      grep -oE '"name": *"cumbre30[^"]*"|"size": *[0-9]+' \
        /home/z/my-project/scripts/.release.json | head -8 >> "$OUT"
      echo "POLL_DONE_OK" >> "$OUT"
    else
      echo "CI FALLO: conclusion=$C" >> "$OUT"
      curl -s --max-time 20 -H "Authorization: Bearer $GH_TOKEN" \
        "https://api.github.com/repos/$REPO/actions/runs/$RUN_ID/jobs" \
        | grep -oE '"name": *"[^"]*"|"conclusion": *"[a-z_]*"' | head -24 >> "$OUT"
      echo "POLL_DONE_FAIL" >> "$OUT"
    fi
    exit 0
  fi
  sleep 60
done
echo "POLL_TIMEOUT_45min" >> "$OUT"
