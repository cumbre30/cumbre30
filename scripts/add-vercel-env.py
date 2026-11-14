#!/usr/bin/env python3
"""Agrega las variables VAPID_* al proyecto cumbre30 en Vercel.

Las claves vienen de /tmp/vapid.json (generadas con web-push). Los
valores nunca se imprimen; solo se confirma el código HTTP de cada
creación. El token se lee de /tmp/vtk.
"""
import json
import sys
import urllib.request

TOKEN = open("/tmp/vtk").read().strip()
KEYS = json.load(open("/tmp/vapid.json"))
SUBJECT = "mailto:contacto.cumbre30@gmail.com"

VARS = [
    ("VAPID_PUBLIC_KEY", KEYS["publicKey"]),
    ("VAPID_PRIVATE_KEY", KEYS["privateKey"]),
    ("VAPID_SUBJECT", SUBJECT),
]

TARGETS = ["production", "preview", "development"]

for key, value in VARS:
    body = json.dumps({
        "key": key,
        "value": value,
        "type": "encrypted",
        "target": TARGETS,
    }).encode()
    req = urllib.request.Request(
        "https://api.vercel.com/v10/projects/cumbre30/env",
        data=body,
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req) as r:
        print(key, "→ HTTP", r.status)
