#!/usr/bin/env bash
# Emülatör/cihaz hazır → expo run:android (native dev build; Android’de bildirimler için gerekli, Expo Go değil)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="${1:-courier-app}"

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator"

if [[ ! -d "$ANDROID_HOME" ]]; then
  echo "Android SDK bulunamadı: $ANDROID_HOME"
  exit 1
fi

has_device() {
  adb devices 2>/dev/null | grep -E '^[[:alnum:].:-]+[[:space:]]+device$' -q
}

if ! has_device; then
  AVD="${ANDROID_AVD:-$(emulator -list-avds 2>/dev/null | head -n1 || true)}"
  if [[ -z "$AVD" ]]; then
    echo "Cihaz veya AVD yok. Emülatörü açın veya USB ile telefon bağlayın."
    exit 1
  fi
  echo "Emülatör başlatılıyor: $AVD"
  "$ANDROID_HOME/emulator/emulator" -avd "$AVD" >/tmp/teslimatjet-emulator.log 2>&1 &
  adb wait-for-device
  for _ in $(seq 1 90); do
    if [[ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]]; then
      break
    fi
    sleep 2
  done
  sleep 4
fi

cd "$ROOT/$APP_DIR"
exec npx expo run:android "${@:2}"
