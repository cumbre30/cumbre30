#!/usr/bin/env bash
# Monitorea la corrida de Actions del tag v1.19.0 y, al terminar,
# verifica el Release y sus assets. Sale 0 solo con build success
# y APK v1.19.0 + latest presentes en el Release.
set -u
REPO="cumbre30/cumbre30"
RUN_URL_BASE="https://api.github.com/repos/$REPO/actions/runs?per_page=5"
REL_URL="https://api.github.com/repos/$REPO/releases/tags/v1.19.0"
TK=$(cat /tmp/ghk 2>/dev/null)
AUTH="Authorization: Bearer $TK"
DEADLINE=$(( $(date +%s) + 540 )) # 9 min por invocación

while [ "$(date +%s)" -lt "$DEADLINE" ]; do
  RUNS=$(curl -s -H "$AUTH" "$RUN_URL_BASE")
  LINE=$(printf '%s' "$RUNS" | python3 -c "
import json, sys
d = json.load(sys.stdin)
for r in d.get('workflow_runs', []):
    if r.get('head_branch') == 'v1.19.0':
        print(f\"{r['id']}|{r['status']}|{r.get('conclusion')}\")
        break
")
  ID=$(printf '%s' "$LINE" | cut -d'|' -f1)
  ST=$(printf '%s' "$LINE" | cut -d'|' -f2)
  CC=$(printf '%s' "$LINE" | cut -d'|' -f3)
  echo "[$(date +%H:%M:%S)] run $ID → $ST / ${CC:-pendiente}"
  if [ "$ST" = "completed" ]; then
    if [ "$CC" != "success" ]; then
      echo "BUILD FALLÓ ($CC). Logs del último step:"
      curl -s -H "$AUTH" "https://api.github.com/repos/$REPO/actions/runs/$ID/jobs" | python3 -c "
import json, sys
d = json.load(sys.stdin)
for j in d.get('jobs', []):
    print('job:', j['name'], '→', j.get('conclusion'))
    for s in j.get('steps', []):
        if s.get('conclusion') not in ('success', 'skipped', None):
            print('  ✗ step:', s['name'], '→', s.get('conclusion'))
"
      exit 1
    fi
    echo "BUILD SUCCESS — verificando Release v1.19.0…"
    REL=$(curl -s -H "$AUTH" "$REL_URL")
    printf '%s' "$REL" | python3 -c "
import json, sys
d = json.load(sys.stdin)
print('release:', d.get('name'), '| draft:', d.get('draft'), '| published:', d.get('published_at'))
for a in d.get('assets', []):
    print(f\"  asset: {a['name']} · {a['size']/1048576:.1f} MB · descargas {a['download_count']}\")
names = [a['name'] for a in d.get('assets', [])]
ok = 'cumbre30-v1.19.0-code79.apk' in names and 'cumbre30-latest.apk' in names
print('ASSETS OK' if ok else 'ASSETS INCOMPLETOS')
sys.exit(0 if ok else 1)
"
    exit $?
  fi
  sleep 60
done
echo "AÚN EN PROGRESO al agotar esta invocación"
exit 2
