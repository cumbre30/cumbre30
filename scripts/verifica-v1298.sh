#!/usr/bin/env bash
# Verificación en vivo de v1.29.8: marcas simplificadas, sin columnas/rótulos de línea, modal sin botón web.
set -u
G=$(curl -s https://cumbregeo.cl/geo)
CO=$(curl -s https://cumbregeo.cl/geo/cumbreoutdoor)
CD=$(curl -s https://cumbregeo.cl/geo/cumbredocs)
cuenta() { echo "$1" | grep -cF -- "$2"; }

echo "== /geo =="
for t in "Línea CumbreOutdoor" "Línea CumbreDocs" "La línea Outdoor seguirá creciendo" ">Líneas</h4>" "OUTDOOR &amp; GEOSPATIAL" "DOCUMENTOS &amp; PRODUCTIVIDAD" ">CumbreOutdoor</h3>" ">CumbreDocs</h3>" ">CumbreOutdoor</a>" ">CumbreDocs</a>"; do
  echo "  $t → $(cuenta "$G" "$t")"
done
echo "  em-dash (—) → $(echo "$G" | grep -o '—' | wc -l)"

echo "== /geo/cumbreoutdoor =="
for t in "CumbreOutdoor · Línea" ">CumbreOutdoor</span>" "OUTDOOR &amp; GEOSPATIAL" ">CumbreOutdoor</h3>"; do
  echo "  $t → $(cuenta "$CO" "$t")"
done
echo "  em-dash (—) → $(echo "$CO" | grep -o '—' | wc -l)"

echo "== /geo/cumbredocs =="
for t in "CumbreDocs · Línea" ">CumbreDocs</span>" "DOCUMENTOS &amp; PRODUCTIVIDAD" ">CumbreDocs</h3>"; do
  echo "  $t → $(cuenta "$CD" "$t")"
done
echo "  em-dash (—) → $(echo "$CD" | grep -o '—' | wc -l)"

echo "== bundle cliente (modal RAPIQO) =="
rm -f /tmp/chunk-all.js
curl -s https://cumbregeo.cl/geo | grep -oE 'src="/_next/static/chunks/[^"]*\.js"' | sed 's/src="//;s/"//' | while read -r c; do
  curl -s "https://cumbregeo.cl$c" >> /tmp/chunk-all.js
done
echo "  bytes: $(wc -c < /tmp/chunk-all.js)"
echo "  'Abrir RAPIQO en el navegador' → $(grep -cF 'Abrir RAPIQO en el navegador' /tmp/chunk-all.js)"
echo "  'Web app: funciona en el navegador' → $(grep -cF 'Web app: funciona en el navegador' /tmp/chunk-all.js)"
echo "  em-dash (—) en bundle → $(grep -o '—' /tmp/chunk-all.js | wc -l)"
