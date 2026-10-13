#!/usr/bin/env bash
# Salin kunci tanda tangan aplikasi ke folder cadangan + tampilkan sidik jarinya.
# Pakai:  bash scripts/backup_keystore.sh [berkas_keystore] [folder_tujuan]
# Tanpa argumen: memakai ~/.android/debug.keystore atau android-native/depotpro-release.jks bila ada.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${1:-}"
if [ -z "$SRC" ]; then
  if [ -f "$ROOT/android-native/depotpro-release.jks" ]; then SRC="$ROOT/android-native/depotpro-release.jks"
  else SRC="$HOME/.android/debug.keystore"; fi
fi
DEST="${2:-$HOME/Documents/DepotPro-keystore-backup}"

[ -f "$SRC" ] || { echo "Keystore tidak ditemukan: $SRC"; exit 1; }
mkdir -p "$DEST"
STAMP="$(date +%Y%m%d-%H%M%S)"
cp "$SRC" "$DEST/$(basename "$SRC").$STAMP"
[ -f "$ROOT/android-native/keystore.properties" ] && cp "$ROOT/android-native/keystore.properties" "$DEST/keystore.properties.$STAMP"
chmod 600 "$DEST"/* 2>/dev/null || true

echo "Tersalin ke: $DEST"
echo "Sidik jari (catat/simpan di password manager):"
if [ "$(basename "$SRC")" = "debug.keystore" ]; then
  keytool -list -v -keystore "$SRC" -alias androiddebugkey -storepass android 2>/dev/null | grep -E "SHA1|SHA256" || true
else
  keytool -list -v -keystore "$SRC" 2>/dev/null | grep -E "Alias name|SHA1|SHA256" || true
fi
echo
echo "PENTING: simpan juga salinan di tempat kedua (flashdisk / penyimpanan awan terenkripsi)."
echo "JANGAN commit berkas keystore atau keystore.properties ke Git."
