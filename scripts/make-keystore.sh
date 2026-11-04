#!/usr/bin/env bash
# Creates YOUR permanent signing key (keep it safe – you need the same key for every future update).
# Requires Java (keytool). Run once, then add the printed values as GitHub repository secrets.
set -euo pipefail
OUT=${1:-english-mastery-release.keystore}
read -rsp "Choose a keystore password (min 8 chars): " PASS; echo
keytool -genkeypair -v -keystore "$OUT" -alias em -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass "$PASS" -keypass "$PASS" -dname "CN=English Mastery, O=Personal, C=IN"
echo
echo "Add these GitHub secrets (Settings → Secrets and variables → Actions):"
echo "  EM_KEYSTORE_BASE64 = (contents of ${OUT}.b64, created now)"
echo "  EM_KEYSTORE_PASSWORD = the password you chose"
echo "  EM_KEY_ALIAS = em"
echo "  EM_KEY_PASSWORD = the password you chose"
base64 -w0 "$OUT" > "$OUT.b64" 2>/dev/null || base64 "$OUT" > "$OUT.b64"
echo "Never commit the .keystore or .b64 file."
