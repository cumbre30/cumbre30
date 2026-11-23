#!/usr/bin/env python3
# Lee versionCode/versionName del AndroidManifest binario (AXML) de un APK.
# Uso: python3 lee-manifiesto-apk.py <apk>
import struct, sys, zipfile

APK = sys.argv[1]
z = zipfile.ZipFile(APK)
data = z.read("AndroidManifest.xml")

def chunks(buf):
    off = 8  # salta RES_XML_TYPE (8 B de cabecera del documento)
    while off + 8 <= len(buf):
        ctype, hsz, csize = struct.unpack_from("<HHI", buf, off)
        if csize < 8 or off + csize > len(buf):
            break
        yield ctype, hsz, csize, off
        off += csize

# --- string pool (RES_STRING_POOL_TYPE 0x0001) ---
pool = []
for ctype, hsz, csize, off in chunks(data):
    if ctype != 0x0001:
        continue
    nstr = struct.unpack_from("<I", data, off + 8)[0]
    flags = struct.unpack_from("<I", data, off + 16)[0]
    start = struct.unpack_from("<I", data, off + 20)[0]
    utf8 = bool(flags & 0x100)
    offs = struct.unpack_from(f"<{nstr}I", data, off + hsz)
    base = off + start
    for o in offs:
        p = base + o
        if utf8:
            def ln8(q):
                n = data[q]
                if n & 0x80:
                    return ((n & 0x7F) << 8) | data[q + 1], 2
                return n, 1
            _, s1 = ln8(p)
            nb, s2 = ln8(p + s1)
            pool.append(data[p + s1 + s2: p + s1 + s2 + nb].decode("utf-8", "replace"))
        else:
            n = struct.unpack_from("<H", data, p)[0]
            if n & 0x8000:
                n = ((n & 0x7FFF) << 16) | struct.unpack_from("<H", data, p + 2)[0]
                p += 2
            pool.append(data[p + 2: p + 2 + n * 2].decode("utf-16-le", "replace"))
    break

# --- primer START_ELEMENT (0x0102) = <manifest> ---
vc = vn = None
for ctype, hsz, csize, off in chunks(data):
    if ctype != 0x0102:
        continue
    attr_start, attr_size, attr_count = struct.unpack_from("<HHH", data, off + 24)
    base = off + hsz + 20  # cabecera (16) + ns/name/astart/asize/acount (20)
    for i in range(attr_count):
        a = base + i * attr_size
        ns, name, raw, _, _, dtype, ddata = struct.unpack_from("<IIIHBBI", data, a)
        nom = pool[name] if name < len(pool) else "?"
        if nom == "versionCode":
            vc = ddata
        elif nom == "versionName":
            vn = pool[raw] if (raw != 0xFFFFFFFF and raw < len(pool)) else f"(typed 0x{dtype:02x}:{ddata})"
    break
print(f"versionCode: {vc}")
print(f"versionName: {vn}")

# --- version.json interno ---
for n in z.namelist():
    if n.endswith("version.json"):
        print(f"{n}: {z.read(n).decode().strip()[:160]}")
