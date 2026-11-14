#!/usr/bin/env bash
# Baut die Android-App (Trusted Web Activity) mit Bubblewrap in einem Wegwerf-Container.
# Ergebnis: /app/storage/app/travian-ally-tool.apk im App-Container (Download unter /account/notifications).
#
# Aufruf auf dem Server (im Projektordner):  ./scripts/build-apk.sh
#   Erster Lauf: erzeugt den Signaturschlüssel unter ./twa/keystore/ – SICHERN (Backup)! Jede neue Version
#   muss mit genau diesem Schlüssel signiert werden, sonst lässt sich die App nicht aktualisieren.
#   Danach den ausgegebenen SHA-256 als TWA_SHA256 in .env eintragen und neu deployen (assetlinks.json).
# Jeder weitere Lauf erhöht automatisch den Versionscode (twa/version-code).
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; [ -f .env ] && . ./.env; set +a

HOST="$(echo "${APP_URL:?APP_URL fehlt in .env}" | sed -E 's#^https?://##; s#/.*$##')"
PACKAGE="${TWA_PACKAGE:-de.ryfe.allytool}"
mkdir -p twa/keystore

if [ ! -f twa/keystore/passwords.env ]; then
  umask 077
  echo "KS_PASS=$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 24)" > twa/keystore/passwords.env
fi
. twa/keystore/passwords.env

CODE=$(( $(cat twa/version-code 2>/dev/null || echo 0) + 1 ))
echo "$CODE" > twa/version-code
NAME="1.0.$CODE"

sed -e "s#__HOST__#$HOST#g" -e "s#__PACKAGE__#$PACKAGE#g" -e "s#__VERSION_NAME__#$NAME#g" -e "s#__VERSION_CODE__#$CODE#g" \
  twa/twa-manifest.template.json > twa/twa-manifest.json

docker run --rm -v "$PWD/twa:/work" -e KS_PASS="$KS_PASS" eclipse-temurin:17-jdk bash -euo pipefail -c '
  apt-get update -qq && apt-get install -y -qq curl unzip >/dev/null
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null && apt-get install -y -qq nodejs >/dev/null
  export ANDROID_HOME=/opt/android
  mkdir -p $ANDROID_HOME/cmdline-tools && cd /tmp
  curl -fsSLo tools.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
  unzip -q tools.zip && mv cmdline-tools $ANDROID_HOME/cmdline-tools/latest
  yes | $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --licenses >/dev/null
  $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0" >/dev/null
  npm i -g @bubblewrap/cli >/dev/null
  mkdir -p ~/.bubblewrap && echo "{\"jdkPath\":\"$JAVA_HOME\",\"androidSdkPath\":\"$ANDROID_HOME\"}" > ~/.bubblewrap/config.json
  if [ ! -f /work/keystore/ally-tool.keystore ]; then
    keytool -genkeypair -keystore /work/keystore/ally-tool.keystore -alias ally-tool -keyalg RSA -keysize 2048 -validity 9125 \
      -storepass "$KS_PASS" -keypass "$KS_PASS" -dname "CN=Humans Ally Tool"
  fi
  mkdir -p /tmp/proj && cp /work/twa-manifest.json /tmp/proj/ && cd /tmp/proj
  bubblewrap update --skipVersionUpgrade --manifest=/tmp/proj/twa-manifest.json >/dev/null || true
  BUBBLEWRAP_KEYSTORE_PASSWORD="$KS_PASS" BUBBLEWRAP_KEY_PASSWORD="$KS_PASS" bubblewrap build --skipPwaValidation
  cp app-release-signed.apk /work/app-release-signed.apk
  echo; echo "SHA-256 (für TWA_SHA256 in .env):"
  keytool -list -v -keystore /work/keystore/ally-tool.keystore -alias ally-tool -storepass "$KS_PASS" | grep "SHA256:" | sed "s/.*SHA256: //"
'
# In das Storage-Volume des App-Containers kopieren (STORAGE_DIR im Container = /app/storage)
docker compose exec -T app mkdir -p /app/storage/app
docker compose cp twa/app-release-signed.apk app:/app/storage/app/travian-ally-tool.apk
echo "Fertig: APK Version $NAME (Code $CODE) liegt im Tool unter /account/notifications zum Download."
