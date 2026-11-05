#!/usr/bin/env bash
# ============================================================
# Restaura el entorno de compilación Android de Cumbre30 después
# de un reciclaje del sandbox (JDK y SDK viven fuera de git).
# Idempotente: salta lo que ya está instalado.
#
# Uso:  bash scripts/setup-android-env.sh
# Build posterior (desde android/):
#   JAVA_HOME=$PWD/../tools/jdk ./gradlew assembleDebug --no-daemon \
#     --init-script ../scripts/gradle-mirror-init.gradle
# ============================================================
set -e
cd /home/z/my-project
mkdir -p tools

# --- JDK Temurin 21 (el JRE del sistema no trae javac) ---
if [ -x tools/jdk/bin/javac ]; then
  echo "JDK ya presente: $(tools/jdk/bin/javac -version 2>&1)"
else
  echo "Descargando JDK Temurin 21..."
  curl -sSL -o /tmp/jdk21.tar.gz \
    "https://api.adoptium.net/v3/binary/latest/21/ga/linux/x64/jdk/hotspot/normal/eclipse"
  tar -xzf /tmp/jdk21.tar.gz -C tools
  rm -rf tools/jdk && mv tools/jdk-21* tools/jdk
  tools/jdk/bin/javac -version && echo "JDK_OK"
fi

# --- Android SDK (platform 36 + build-tools) ---
if [ -d tools/android-sdk/platforms/android-36 ] && [ -d tools/android-sdk/build-tools ]; then
  echo "SDK ya presente: $(ls tools/android-sdk/build-tools | tr '\n' ' ')"
else
  echo "Descargando cmdline-tools..."
  curl -sSL -o /tmp/cmdline-tools.zip \
    "https://dl.google.com/android/repository/commandlinetools-linux-13114758_latest.zip"
  mkdir -p tools/android-sdk/cmdline-tools
  if which unzip >/dev/null; then
    unzip -q /tmp/cmdline-tools.zip -d tools/android-sdk/cmdline-tools
  else
    python3 -c "import zipfile; zipfile.ZipFile('/tmp/cmdline-tools.zip').extractall('tools/android-sdk/cmdline-tools')"
    chmod -R u+x tools/android-sdk/cmdline-tools
  fi
  rm -rf tools/android-sdk/cmdline-tools/latest
  mv tools/android-sdk/cmdline-tools/cmdline-tools tools/android-sdk/cmdline-tools/latest
  export JAVA_HOME=$PWD/tools/jdk
  yes | tools/android-sdk/cmdline-tools/latest/bin/sdkmanager \
    --sdk_root=$PWD/tools/android-sdk --licenses > /dev/null
  yes | tools/android-sdk/cmdline-tools/latest/bin/sdkmanager \
    --sdk_root=$PWD/tools/android-sdk "platform-tools" "platforms;android-36" "build-tools;36.0.0"
fi

# --- local.properties para gradle ---
echo "sdk.dir=/home/z/my-project/tools/android-sdk" > android/local.properties

echo "ENTORNO_LISTO — compilar con:"
echo "  cd android && JAVA_HOME=$PWD/tools/jdk ./gradlew assembleDebug --no-daemon \\"
echo "    --init-script ../scripts/gradle-mirror-init.gradle"
