#!/usr/bin/env bash
# Buat kunci tanda tangan rilis sendiri (lebih aman daripada kunci debug) + keystore.properties.
# Pakai:  bash scripts/create_release_keystore.sh
# CATATAN: mengganti kunci berarti aplikasi lama di HP harus di-uninstall sekali lalu pasang ulang.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
JKS="$ROOT/android-native/depotpro-release.jks"
PROPS="$ROOT/android-native/keystore.properties"
[ -f "$JKS" ] && { echo "Sudah ada: $JKS (tidak ditimpa)"; exit 1; }

read -r -s -p "Buat password keystore (min. 8 karakter): " PASS; echo
read -r -s -p "Ulangi password: " PASS2; echo
[ "$PASS" = "$PASS2" ] || { echo "Password tidak sama"; exit 1; }
[ "${#PASS}" -ge 8 ] || { echo "Password terlalu pendek"; exit 1; }

keytool -genkeypair -keystore "$JKS" -alias depotpro -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass "$PASS" -keypass "$PASS" -dname "CN=DepotPro, O=DepotPro, C=ID"

cat > "$PROPS" <<PROP
storeFile=depotpro-release.jks
storePassword=$PASS
keyAlias=depotpro
keyPassword=$PASS
PROP
chmod 600 "$PROPS" "$JKS"

echo "Selesai. Dibuat:"
echo "  $JKS"
echo "  $PROPS"
echo "Langkah berikut: jalankan  bash scripts/backup_keystore.sh  untuk mencadangkannya."
