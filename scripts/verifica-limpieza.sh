#!/usr/bin/env bash
# Verificación en vivo de la limpieza v1.29.6 (cumbregeo.cl).
set -u
G=$(curl -s https://cumbregeo.cl/geo)
CO=$(curl -s https://cumbregeo.cl/geo/cumbreoutdoor)
CD=$(curl -s https://cumbregeo.cl/geo/cumbredocs)

cuenta() { echo "$1" | grep -cF -- "$2"; }

echo "== /geo (tarjeta RAPIQO + footer) =="
for t in "Licencia PRO de pago único" "Contacto y legal" "Política de privacidad" "Términos y condiciones" '>Cumbre30</a>' '>RAPIQO</a>' '>CumbreOutdoor</a>' '>CumbreDocs</a>' '<h4>Contacto</h4>' '>Formulario de contacto</a>'; do
  echo "  $t → $(cuenta "$G" "$t")"
done
echo "  em-dash (—) en /geo → $(echo "$G" | grep -o '—' | wc -l)"

echo "== /geo/cumbreoutdoor =="
for t in "Gratis, sin publicidad" "Probar demo" "Ver planes Pro" "Ver detalles y descarga" "Ciclocomputador digital"; do
  echo "  $t → $(cuenta "$CO" "$t")"
done
echo "  em-dash (—) → $(echo "$CO" | grep -o '—' | wc -l)"

echo "== /geo/cumbredocs =="
for t in "La versión web ya está disponible" "Abrir RAPIQO ↗" "Licencia PRO · MercadoPago" "Una herramienta web para procesar"; do
  echo "  $t → $(cuenta "$CD" "$t")"
done
echo "  em-dash (—) → $(echo "$CD" | grep -o '—' | wc -l)"

echo "== API comentarios sigue viva =="
curl -s "https://cumbregeo.cl/api/comentarios?producto=rapiqo"
echo
