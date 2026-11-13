#!/usr/bin/env python3
"""Conectividad de nodos clave: extremos de Zorzal, La S y el path sin nombre."""
import json, math

raw = json.load(open("/home/z/my-project/public/red-ciclista.json", encoding="utf-8"))
nodes, edges, classes, names = raw["nodes"], raw["edges"], raw["classes"], raw["names"]

for nid in (27890, 27891, 27100, 27101, 27914, 27913, 27109, 27110):
    print(f"=== nodo {nid} ({nodes[nid][0]:.6f},{nodes[nid][1]:.6f}) ===")
    for a, b, ci, ni, _c in edges:
        if a == nid or b == nid:
            o = b if a == nid else a
            print(f"  {'→' if a == nid else '←'} {o}  {classes[ci]:9s} {names[ni] or '(sin nombre)'}  ({nodes[o][0]:.6f},{nodes[o][1]:.6f})")
    print()
