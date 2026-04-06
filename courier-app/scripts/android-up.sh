#!/usr/bin/env bash
# Emülatör yoksa ilk AVD'yi başlatır, adb görünene kadar bekler, sonra expo run:android çalıştırır.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator"

if [[ ! -x "$ANDROID_HOME/platform-tools/adb" ]]; then
  echo "adb bulunamadı: $ANDROID_HOME/platform-tools"
  echo "Android Studio → Settings → Android SDK → konumu kontrol et; gerekirse:"
  echo "  export ANDROID_HOME=\"/doğru/sdk/yolu\""
  exit 1
fi

has_device() {
  adb devices 2>/dev/null | grep -E $'^[[:alnum:].:-]+[[:space:]]+device$' -q
}

if has_device; then
  echo "Android cihaz/emülatör zaten bağlı."
else
  FIRST_AVD="$(emulator -list-avds 2>/dev/null | head -1 | tr -d '\r')"
  if [[ -z "$FIRST_AVD" ]]; then
    echo "Kayıtlı AVD yok. Android Studio → Device Manager → Create device."
    exit 1
  fi
  echo "Emülatör başlatılıyor: $FIRST_AVD"
  emulator -avd "$FIRST_AVD" &
  echo "adb bağlantısı bekleniyor..."
  adb wait-for-device
  echo "Android boot bitene kadar bekleniyor (en fazla ~2 dk)..."
  for _ in $(seq 1 60); do
    if [[ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]]; then
      break
    fi
    sleep 2
  done
  sleep 2
fi

cd "$ROOT"
echo ""
echo ">>> Gradle ilk seferde 5–10 dk sürebilir; bitene kadar bekle."
echo ">>> Bittikten sonra uygulama kendiliğinden açılmazsa: npm run android:launch"
echo ""
exec npm run android
