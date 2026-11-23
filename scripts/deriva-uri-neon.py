#!/usr/bin/env python3
# Deriva el URI de conexión de Neon vía API v2 (console.neon.tech) usando la
# clave org-scoped de .env.neon + el org_id de .env.neon.org (o argv[1]).
# El URI se guarda en .env.neon.uri (chmod 600) y JAMÁS se imprime.
#   GET /api/v2/projects?org_id=…            → proyecto (uno)
#   GET /api/v2/projects/{id}/branches       → rama main
#   GET /api/v2/projects/{id}/connection_uris?branch_id=… → URI
# Uso: python3 scripts/deriva-uri-neon.py [org_id]
import json, os, sys, urllib.request
from pathlib import Path

BASE = Path("/home/z/my-project")
KEY = (BASE / ".env.neon").read_text().strip()
org = sys.argv[1] if len(sys.argv) > 1 else ""
if not org and (BASE / ".env.neon.org").exists():
    org = (BASE / ".env.neon.org").read_text().strip()
if not org:
    sys.exit("falta el org_id: pasar por argv o escribirlo en .env.neon.org")

def api(path):
    req = urllib.request.Request(
        f"https://console.neon.tech/api/v2{path}",
        headers={"Authorization": f"Bearer {KEY}"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

projects = api(f"/projects?org_id={org}").get("projects", [])
if len(projects) != 1:
    sys.exit(f"esperaba 1 proyecto en la org, hay {len(projects)}: " +
             ", ".join(p["id"] + "|" + p["name"] for p in projects))
pid = projects[0]["id"]
branches = api(f"/projects/{pid}/branches").get("branches", [])
main = next((b for b in branches if b.get("primary")), branches[0] if branches else None)
if not main:
    sys.exit("sin ramas")
dbs = api(f"/projects/{pid}/branches/{main['id']}/databases").get("databases", [])
dbname = dbs[0]["name"] if dbs else "neondb"
roles = api(f"/projects/{pid}/branches/{main['id']}/roles").get("roles", [])
role = next((x["name"] for x in roles if x.get("name") != " NO_PASSWORD"), roles[0]["name"] if roles else "neondb_owner")
r = api(f"/projects/{pid}/connection_uri?branch_id={main['id']}&database_name={dbname}&role_name={role}")
uri = r.get("uri") or r.get("connection_uri") or ""
if not uri:
    sys.exit("sin connection_uri")
out = BASE / ".env.neon.uri"
out.write_text(uri + "\n")
os.chmod(out, 0o600)
print(f"URI guardado en .env.neon.uri · largo {len(uri)} · host {'-pooler' if '-pooler' in uri else 'directo'} · sslmode param: {'sslmode' in uri} · (no se imprime)")
