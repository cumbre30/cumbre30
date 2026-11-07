#!/usr/bin/env python3
# ============================================================
# Genera download/descargar-codigo-cumbre30.html: página auto-
# contenida con el zip del código embebido en base64. Al abrirla
# en un navegador, el botón reconstruye el zip y lo descarga.
# El panel de descargas del chat no muestra archivos .zip, pero
# los .html sí, así que el zip viaja dentro de la página.
# ============================================================

import base64
import hashlib
import pathlib
import sys

ROOT = pathlib.Path("/home/z/my-project")
ZIP_PATH = ROOT / "download" / "cumbre30-codigo-code28.zip"
OUT_PATH = ROOT / "download" / "descargar-codigo-cumbre30-code28.html"

TEMPLATE = r"""<!DOCTYPE html>
<html lang="es-CL">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Descargar código Cumbre30 — cumbre30-codigo-code28.zip</title>
<style>
  :root { --espresso:#241A11; --cream:#F2EAD9; --green:#35B85F; --copper:#8A6A4F; }
  * { box-sizing: border-box; }
  body {
    margin: 0; font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: var(--cream); color: var(--espresso); min-height: 100vh;
    display: flex; align-items: center; justify-content: center; padding: 24px;
  }
  .card {
    background: #fff; max-width: 560px; width: 100%; border-radius: 20px;
    padding: 32px; box-shadow: 0 10px 40px rgba(36,26,17,.15);
  }
  .brand { font-weight: 900; letter-spacing: .12em; font-size: 13px; color: var(--copper); }
  h1 { margin: 6px 0 4px; font-size: 26px; line-height: 1.2; }
  h1 span { color: var(--green); }
  .meta { color: #6b5d4d; font-size: 14px; margin-bottom: 20px; }
  button {
    width: 100%; padding: 16px 20px; font-size: 17px; font-weight: 700;
    color: #fff; background: var(--green); border: 0; border-radius: 14px;
    cursor: pointer; transition: transform .06s ease, filter .15s ease;
  }
  button:hover { filter: brightness(1.05); }
  button:active { transform: scale(.99); }
  button:disabled { background: #b8d8c3; cursor: wait; }
  .ok { color: var(--green); font-weight: 700; margin-top: 12px; text-align: center; min-height: 20px; }
  ol { margin: 22px 0 8px; padding-left: 22px; font-size: 14.5px; line-height: 1.55; }
  ol li { margin-bottom: 10px; }
  code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  pre {
    background: var(--espresso); color: var(--cream); border-radius: 12px;
    padding: 14px 16px; font-size: 12.5px; overflow-x: auto; line-height: 1.6;
  }
  .nota { font-size: 12.5px; color: #8a7a66; margin-top: 18px; border-top: 1px solid #eee2cf; padding-top: 12px; }
</style>
</head>
<body>
<div class="card">
  <div class="brand">CUMBRE&nbsp;GEO</div>
  <h1>Código del proyecto <span>Cumbre30</span></h1>
  <p class="meta">cumbre30-codigo-code28.zip · v1.8.2 (build 28) · página /geo + botón APK Google Drive · ACTUALIZADO 08-11</p>

  <button id="dl">⬇ Descargar cumbre30-codigo-code28.zip</button>
  <div class="ok" id="msg"></div>

  <ol>
    <li>Presiona el botón de arriba: se descarga <b>cumbre30-codigo-code28.zip</b> a tu carpeta de Descargas (el zip viene embebido dentro de esta página, no necesita internet).</li>
    <li>Descomprime el zip en una carpeta <b>nueva</b> (no la mezcles con la carpeta vieja del despliegue anterior).</li>
    <li>Abre una terminal <b>dentro de esa carpeta</b> y vuelve a desplegar en Vercel (el proyecto ya existe; te va a preguntar a qué proyecto enlazar la primera vez):</li>
  </ol>
  <pre>npx vercel login      (solo si te lo pide)
npx vercel link       (elige tu proyecto existente)
npx vercel --prod</pre>
  <p class="nota">Al terminar, abre <b>cumbregeo.cl</b> con Ctrl+F5: debe entrar a la página /geo con el diseño nuevo.
  Las variables de entorno ya quedaron configuradas en el proyecto de Vercel, no se tocan de nuevo.
  Guía completa: <b>DEPLOY.md</b> (viene dentro del zip).
  Sha256 del zip para verificar: <code>__SHA__</code></p>
</div>

<script>
var B64 = "__B64__";
document.getElementById("dl").addEventListener("click", function () {
  var btn = this, msg = document.getElementById("msg");
  try {
    btn.disabled = true; msg.textContent = "Preparando archivo…";
    setTimeout(function () {
      var bin = atob(B64), n = bin.length, bytes = new Uint8Array(n);
      for (var i = 0; i < n; i++) bytes[i] = bin.charCodeAt(i);
      var blob = new Blob([bytes], { type: "application/zip" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url; a.download = "cumbre30-codigo-code28.zip";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      msg.textContent = "✓ Descargado: cumbre30-codigo-code28.zip (" + (n / 1048576).toFixed(1) + " MB)";
      btn.disabled = false;
    }, 30);
  } catch (e) {
    msg.textContent = "Error: " + e.message;
    btn.disabled = false;
  }
});
</script>
</body>
</html>
"""

def main() -> None:
    raw = ZIP_PATH.read_bytes()
    sha = hashlib.sha256(raw).hexdigest()
    b64 = base64.b64encode(raw).decode("ascii")
    html = TEMPLATE.replace("__SHA__", sha).replace("__B64__", b64)
    OUT_PATH.write_text(html, encoding="utf-8")

    # Verificación de ida y vuelta: lo que decodificará el navegador
    # debe ser byte a byte idéntico al zip original.
    back = base64.b64decode(html.split('var B64 = "')[1].split('";')[0])
    assert hashlib.sha256(back).hexdigest() == sha, "roundtrip mismatch"
    print(f"zip      : {len(raw)/1048576:.2f} MB  sha256 {sha[:16]}…")
    print(f"html     : {OUT_PATH}  ({OUT_PATH.stat().st_size/1048576:.2f} MB)")
    print("roundtrip: OK (el base64 reconstruye el zip idéntico)")

if __name__ == "__main__":
    sys.exit(main())
