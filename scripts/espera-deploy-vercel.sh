#!/bin/bash
# Espera a que el deployment de producción más reciente de Vercel llegue a READY (o ERROR). No imprime tokens.
set -u
VK=$(cat /home/z/my-project/.secrets/vk)
PRJ=prj_0iIvRNosz7n5aFgvh7WXQoOwEO5e
BASE="https://api.vercel.com/v6/deployments?projectId=$PRJ&target=production&limit=3"
for i in $(seq 1 20); do
  RESP=$(curl -s -H "Authorization: Bearer $VK" "$BASE")
  echo "$RESP" | python3 -c "
import sys, json
d = json.load(sys.stdin)
ds = d.get('deployments', [])
if not ds:
    print('sin deployments')
else:
    for x in ds[:3]:
        print(x.get('uid'), x.get('state'), x.get('readyState'), 'sha=' + (x.get('meta', {}).get('githubCommitSha') or '')[:7])
" > /tmp/deploy_status.txt
  DPL=$(head -1 /tmp/deploy_status.txt | awk '{print $1}')
  ESTADO=$(head -1 /tmp/deploy_status.txt | awk '{print $3}')
  echo "[$i] $(head -1 /tmp/deploy_status.txt)"
  if [ "$ESTADO" = "READY" ] || [ "$ESTADO" = "ERROR" ] || [ "$ESTADO" = "CANCELED" ]; then
    echo "$DPL" > /tmp/dpl_id.txt
    break
  fi
  sleep 40
done
tail -3 /tmp/deploy_status.txt
