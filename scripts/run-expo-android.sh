#!/usr/bin/env bash
# Expo Android: ANDROID_HOME ayarlar, gerekirse AVD başlatır, sonra expo start --android çalıştırır.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="${1:-courier-app}"

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator"

if [[ ! -d "$ANDROID_HOME" ]]; then
  echo "Android SDK bulunamadı: $ANDROID_HOME"
  echo "Android Studio ile SDK kurun veya ANDROID_HOME ortam değişkenini ayarlayın."
  exit 1
fi

has_device() {
  adb devices 2>/dev/null | grep -E '^[[:alnum:].:-]+[[:space:]]+device$' -q
}

if ! has_device; then
  AVD="${ANDROID_AVD:-}"
  if [[ -z "$AVD" ]]; then
    AVD="$(emulator -list-avds 2>/dev/null | head -n1 || true)"
  fi
  if [[ -z "$AVD" ]]; then
    echo "Bağlı cihaz yok ve kurulu AVD de yok."
    echo "Android Studio → Device Manager ile sanal cihaz oluşturup bir kez başlatın."
    exit 1
  fi
  echo "Emülatör başlatılıyor: $AVD (ilk açılış 1–2 dk sürebilir)"
  "$ANDROID_HOME/emulator/emulator" -avd "$AVD" >/tmp/teslimatjet-emulator.log 2>&1 &
  echo "ADB bağlantısı bekleniyor…"
  adb wait-for-device
  echo "Sistem açılışı bekleniyor…"
  for _ in $(seq 1 90); do
    if [[ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]]; then
      break
    fi
    sleep 2
  done
  sleep 4
fi

if ! has_device; then
  echo "Hâlâ Android cihaz görünmüyor. 'adb devices' çıktısını kontrol edin."
  exit 1
fi

cd "$ROOT/$APP_DIR"
exec npx expo start --android "${@:2}"
