#!/usr/bin/env python3
# Extrae los certificados X.509 del APK Signing Block (v2/v3) de un APK
# y imprime sus huellas SHA-1. Enfoque pragmático: localiza el bloque
# (magic "APK Sig Block 42" antes del Central Directory) y dentro extrae
# todos los blobs que parsean como certificado DER (SEQUENCE 30 82 ..).
# Compara contra el keystore debug commiteado
# (D6:D0:BB:2A:CA:31:D1:EC:A6:5C:98:06:73:DE:55:01:71:D5:EE:68).
import struct, sys, hashlib, subprocess, tempfile, os

def u32(b, o): return struct.unpack_from("<I", b, o)[0]
def u64(b, o): return struct.unpack_from("<Q", b, o)[0]

def bloque(ruta):
    data = open(ruta, "rb").read()
    eocd = data.rfind(b"PK\x05\x06")
    assert eocd != -1, "sin EOCD"
    cd_off = u32(data, eocd + 16)
    assert data[cd_off - 16:cd_off] == b"APK Sig Block 42", "sin signing block v2/v3"
    tam = u64(data, cd_off - 24)
    return data[cd_off - tam - 8:cd_off - 24]

def certificados(ruta):
    reg = bloque(ruta)
    hallados, i = [], 0
    while True:
        i = reg.find(b"\x30\x82", i)
        if i == -1 or i + 4 > len(reg):
            break
        largo = int.from_bytes(reg[i + 2:i + 4], "big") + 4
        if largo < 100 or i + largo > len(reg):
            i += 2
            continue
        cand = reg[i:i + largo]
        with tempfile.NamedTemporaryFile(suffix=".der", delete=False) as f:
            f.write(cand); tmp = f.name
        r = subprocess.run(
            ["openssl", "x509", "-inform", "DER", "-noout", "-subject", "-fingerprint", "-sha1"],
            input=cand, capture_output=True)
        r.stdout = r.stdout.decode("utf-8", "replace")
        os.unlink(tmp)
        if r.returncode == 0:
            hallados.append((largo, r.stdout.strip()))
            i += largo  # certificado válido: salta al final
        else:
            i += 2
    return hallados

if __name__ == "__main__":
    print("bloque de firma:", len(bloque(sys.argv[1])), "bytes")
    n = 0
    vistos = set()
    for largo, info in certificados(sys.argv[1]):
        if info in vistos:
            continue
        vistos.add(info)
        n += 1
        print(f"cert X.509 ({largo} bytes): {info}")
    if n == 0:
        print("sin certificados reconocidos")
