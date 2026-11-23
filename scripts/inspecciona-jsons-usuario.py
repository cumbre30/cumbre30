#!/usr/bin/env python3
"""Inspecciona los 3 JSON subidos por el usuario (datos no confiables: solo lectura)."""
import json, sys, collections

BASE = "/home/z/my-project/upload/"
FILES = ["gemini-code-1795398810085-1.json",
         "gemini-code-1795398798495-2.json",
         "gemini-code-1795398851222-3.json"]

def walk_keys(obj, prefix="", depth=0):
    """Describe la estructura: tipos y claves hasta profundidad 3."""
    if depth > 3:
        return
    if isinstance(obj, dict):
        for k, v in obj.items():
            t = type(v).__name__
            ln = len(v) if isinstance(v, (list, dict, str)) else ""
            print(f"{'  '*depth}{prefix}{k}: {t} {ln}")
            if isinstance(v, (dict,)) or (isinstance(v, list) and v and isinstance(v[0], dict)):
                walk_keys(v, "", depth+1)
    elif isinstance(obj, list):
        print(f"{'  '*depth}[list len={len(obj)}]")
        if obj:
            walk_keys(obj[0], "item[0].", depth+1)

for fn in FILES:
    path = BASE + fn
    print("=" * 70)
    print("FILE:", fn)
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        # el -2 y -3 son "Unicode text", puede que tengan basura previa
        with open(path, "r", encoding="utf-8") as f:
            head = f.read(400)
        print("  JSON parse error:", e)
        print("  HEAD:", repr(head))
        continue
    print("  top-level type:", type(data).__name__)
    if isinstance(data, list):
        print("  length:", len(data))
        walk_keys(data[0], "item[0].", 1)
        print("  --- primeros 2 items ---")
        for it in data[:2]:
            print(json.dumps(it, ensure_ascii=False, indent=1)[:1200])
    elif isinstance(data, dict):
        walk_keys(data, "", 1)
        print("  --- muestra ---")
        print(json.dumps(data, ensure_ascii=False, indent=1)[:1200])
    print()
