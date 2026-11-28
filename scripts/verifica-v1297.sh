#!/usr/bin/env bash
# Verificación en vivo de v1.29.7: encabezado, hero y guión largo de comentarios.
set -u
G=$(curl -s https://cumbregeo.cl/geo)
cuenta() { echo "$1" | grep -cF -- "$2"; }

echo "== Encabezado y hero /geo =="
for t in '>Inicio</a>' '>Nosotros</a>' '>Contacto</a>' '>Soluciones</a>' '>CumbreDocs</a>' '>CumbreOutdoor</a>' "Explorar soluciones" "01-ride.jpg" "ride en vivo" "ventana-pie"; do
  echo "  $t → $(cuenta "$G" "$t")"
done
echo "  em-dash (—) → $(echo "$G" | grep -o '—' | wc -l)"

echo "== Texto del chunk JS (estado vacío de comentarios, client-side) =="
curl -s https://cumbregeo.cl/geo | grep -oE 'src="/_next/static/chunks/[^"]*\.js"' | sed 's/src="//;s/"//' > /tmp/chunks.txt
: > /tmp/chunk-hits.txt
while read -r c; do
  curl -s "https://cumbregeo.cl$c" >> /tmp/chunk-all.js 2>/dev/null
done < /tmp/chunks.txt
echo "  bytes descargados: $(wc -c < /tmp/chunk-all.js)"
echo "  'Aún no hay evaluaciones —' → $(grep -cF 'Aún no hay evaluaciones —' /tmp/chunk-all.js)"
echo "  'Aún no hay evaluaciones: sé la primera' → $(grep -cF 'Aún no hay evaluaciones: sé la primera' /tmp/chunk-all.js)"
echo "  otros '—' en chunks → $(grep -o '—' /tmp/chunk-all.js | wc -l)"
