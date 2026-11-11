#!/usr/bin/env bash
# Instala un JDK completo (Temurin 21) en $HOME/jdk — el java del sistema
# es solo JRE (sin javac) y Gradle necesita compilador. No persiste entre
# sesiones (solo git persiste): correr de nuevo tras un reciclaje.
#   Uso: bash scripts/jdk-setup.sh  →  exporta JAVA_HOME al final
set -e
JDK_DIR=$HOME/jdk

if [ -x "$JDK_DIR/bin/javac" ]; then
  echo "JDK ya instalado en $JDK_DIR"
else
  echo "Descargando Temurin JDK 21..."
  curl -sL -o /tmp/jdk21.tar.gz \
    "https://api.adoptium.net/v3/binary/latest/21/ga/linux/x64/jdk/hotspot/normal/eclipse?project=jdk"
  mkdir -p "$JDK_DIR"
  tar -xzf /tmp/jdk21.tar.gz -C "$JDK_DIR" --strip-components=1
  rm -f /tmp/jdk21.tar.gz
fi
"$JDK_DIR/bin/javac" -version
echo "Usa: JAVA_HOME=$JDK_DIR ./gradlew ..."
