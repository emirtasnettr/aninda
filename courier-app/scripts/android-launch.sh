#!/usr/bin/env bash
# Yüklü Teslimatjet Kurye uygulamasını emülatörde açar (derleme sonrası takılı kaldıysa).
set -euo pipefail

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$PATH:$ANDROID_HOME/platform-tools"

PACKAGE="com.anonymous.teslimatjetcourier"

if [[ ! -x "$ANDROID_HOME/platform-tools/adb" ]]; then
  echo "adb bulunamadı: $ANDROID_HOME/platform-tools"
  exit 1
fi

if ! adb devices 2>/dev/null | grep -E $'^[[:alnum:].:-]+[[:space:]]+device$' -q; then
  echo "Bağlı cihaz yok. Önce emülatörü aç ve 'adb devices' ile kontrol et."
  exit 1
fi

if ! adb shell pm list packages 2>/dev/null | grep -q "^package:${PACKAGE}$"; then
  echo "Uygulama yüklü değil: $PACKAGE"
  echo "Önce: cd courier-app && npm run android   (veya npm run android:up)"
  exit 1
fi

echo "Uygulama başlatılıyor: $PACKAGE"
adb shell monkey -p "$PACKAGE" -c android.intent.category.LAUNCHER 1 >/dev/null
echo "Tamam. Metro çalışmıyorsa ayrı terminalde: npx expo start"
