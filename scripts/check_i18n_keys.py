import re, glob

# keys defined in i18n.ts
src = open("src/lib/i18n.ts", encoding="utf-8").read()
defined = set(re.findall(r'^\s*"([^"]+)":\s*\[', src, re.M))

used = set()
files = glob.glob("src/**/*.ts*", recursive=True)
for f in files:
    if f.endswith("i18n.ts"):
        continue
    s = open(f, encoding="utf-8").read()
    used |= set(re.findall(r'\bt\(\s*"([^"]+)"', s))
    # template keys built at runtime (mapa.capa*) come from MENUS_CAPAS values
    used |= set(re.findall(r'"\s*titulo:\s*"(mapa\.[^"]+)"', s))
    used |= set(re.findall(r'sub:\s*"(mapa\.[^"]+)"', s))
    used |= set(re.findall(r'label:\s*"(pf\.[^"]+)"', s))

missing = sorted(used - defined)
unused = sorted(defined - used)
print("defined:", len(defined))
print("used:", len(used))
print("MISSING (used but not defined):", missing)
print("unused count:", len(unused))
print("unused:", unused)
