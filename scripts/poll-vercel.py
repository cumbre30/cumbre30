#!/usr/bin/env python3
"""Monitorea el deploy de producción de cumbre30 en Vercel hasta que
READY o ERROR. Uso: poll-vercel.py <sha_prefijo> [max_segundos]"""
import json
import sys
import time
import urllib.request

TOKEN = open("/tmp/vtk").read().strip()
TEAM = "team_Byn2cr5Hs58buT28qNxchfGW"
SHA = sys.argv[1] if len(sys.argv) > 1 else "9268ab4"
MAX = int(sys.argv[2]) if len(sys.argv) > 2 else 540
URL = f"https://api.vercel.com/v6/deployments?teamId={TEAM}&target=production&limit=6"


def dame():
    req = urllib.request.Request(URL, headers={"Authorization": f"Bearer {TOKEN}"})
    with urllib.request.urlopen(req) as r:
        return json.load(r).get("deployments", [])


vistos = {}
inicio = time.time()
while time.time() - inicio < MAX:
    for d in dame():
        if not isinstance(d, dict) or "uid" not in d:
            print("entrada inesperada:", str(d)[:200], flush=True)
            continue
        did = d["uid"]
        meta = d.get("meta") or {}
        sha = (meta.get("githubCommitSha") or "")[:7]
        if sha != SHA:
            continue
        estado = f"{d.get('state')}/{d.get('readyState')}"
        if vistos.get(did) != estado:
            vistos[did] = estado
            print(f"[{time.strftime('%H:%M:%S')}] {did} → {estado}", flush=True)
        if d.get("readyState") in ("READY", "ERROR"):
            print("URL:", d.get("url"), "| estado final:", d.get("readyState"))
            sys.exit(0 if d.get("readyState") == "READY" else 2)
    time.sleep(20)
print("tiempo agotado; estados:", vistos)
sys.exit(3)
