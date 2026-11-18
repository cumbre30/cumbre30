#!/usr/bin/env python3
# Búsqueda web compacta para la auditoría: python3 buscar.py "consulta" [n]
import json, subprocess, sys

q = sys.argv[1]
n = sys.argv[2] if len(sys.argv) > 2 else "6"
r = subprocess.run(
    ["z-ai", "function", "-n", "web_search", "-a",
     json.dumps({"query": q, "num": int(n)})],
    capture_output=True, text=True, timeout=90,
)
out = r.stdout
start = out.find("[")
if start < 0:
    print("SIN_RESULTADOS:", out[:300]); sys.exit(0)
try:
    data, _ = json.JSONDecoder().raw_decode(out[start:])
except Exception as e:
    print("PARSE_ERR", e, out[:300]); sys.exit(0)
for x in data:
    print(f"- {x.get('name','')[:95]} | {x.get('host_name','')} | {x.get('date','')}")
    print(f"  {x.get('url','')[:120]}")
    print(f"  {x.get('snippet','')[:280]}")
