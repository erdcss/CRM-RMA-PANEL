#!/usr/bin/env bash
set -euo pipefail

# Independent of expo.dev / EAS: Expo SDK -> local prebuild -> Gradle.
# Run from repo root or from any working directory.
cd "$(dirname "$0")/.."
mode="$1"
if [[ "$mode" != "smoke" && "$mode" != "release" ]]; then
  echo "Usage: native-android-ci.sh smoke|release" >&2
  exit 2
fi

export B2B_ANDROID_BUILD=1
export EXPO_PUBLIC_B2B_AD_TRACKING=0
export EXPO_PUBLIC_API_URL=https://b2b.ecalisgan.com
export REQUIRE_B2B_CUSTOM_NOTIFICATION_SOUND=1
export CI=1

node -e 'const a=require("./app.json").expo; if(a.android.package!=="com.caliskangroup.rma"||a.android.versionCode<27)throw Error("Wrong Android package or versionCode");'
node scripts/create-scan-beep.cjs
node scripts/prepare-native-release.cjs
npm run sync:branding
npm run typecheck
node scripts/eas-branding-preinstall.cjs
npx expo prebuild --platform android --no-install --clean
node scripts/check-google-play-location.cjs
node scripts/check-google-play-portrait.cjs

aapt_path="$(find "$ANDROID_HOME/build-tools" -type f -name aapt | sort -V | tail -n 1)"
if [[ -z "$aapt_path" || ! -x "$aapt_path" ]]; then
  echo "Android SDK aapt executable not available." >&2
  exit 1
fi

check_apk() {
  local apk="$1"
  test -s "$apk"
  local package_info
  package_info="$("$aapt_path" dump badging "$apk" | grep '^package:' | head -1)"
  echo "$package_info"
  local badging
  badging="$("$aapt_path" dump badging "$apk")"
  # aapt outputs the optional feature as:
  # "uses-feature-not-required: name='android.hardware.screen.portrait'".
  # Match tokens on the SAME line without requiring column zero; Android
  # tooling may prefix whitespace. Fail closed if the optional entry is absent.
  if ! awk 'index($0, "uses-feature-not-required:") && index($0, "android.hardware.screen.portrait") { found=1 } END { exit !found }' <<< "$badging"; then
    echo "Google Play portrait hardware requirement is not optional in compiled APK." >&2
    grep -E 'uses-feature|uses-implied-feature' <<< "$badging" >&2 || true
    exit 1
  fi
  if ! grep -Fq "name='com.caliskangroup.rma'" <<< "$package_info"; then
    echo "Wrong Android applicationId" >&2
    exit 1
  fi
  local permissions
  permissions="$("$aapt_path" dump permissions "$apk")"
  for forbidden in \
    'com.google.android.gms.permission.AD_ID' \
    'android.permission.ACCESS_ADSERVICES_AD_ID' \
    'android.permission.ACCESS_BACKGROUND_LOCATION' \
    'android.permission.ACCESS_COARSE_LOCATION' \
    'android.permission.ACCESS_FINE_LOCATION'; do
    if grep -Fq "$forbidden" <<< "$permissions"; then
      echo "Forbidden permission in compiled APK: $forbidden" >&2
      exit 1
    fi
  done
  echo "Checked compiled APK: no advertising ID or location permissions."
}

if [[ "$mode" == "smoke" ]]; then
  # This is a DEBUG smoke-test artifact, not a standalone store APK.
  (cd android && ./gradlew :app:assembleDebug --no-daemon --stacktrace)
  check_apk android/app/build/outputs/apk/debug/app-debug.apk
  echo "Independent Android smoke build succeeded. Debug APK requires a development server."
  exit 0
fi

# RELEASE: fail closed, never sign an app update with a new/random keystore.
if [[ -z "$B2B_ANDROID_KEYSTORE_BASE64" ||
      -z "$B2B_ANDROID_KEYSTORE_PASSWORD" ||
      -z "$B2B_ANDROID_KEY_ALIAS" ||
      -z "$B2B_ANDROID_KEY_PASSWORD" ]]; then
  echo "Existing B2B Android upload-key secrets are missing. No release will be built." >&2
  exit 1
fi

mkdir -p "$RUNNER_TEMP/b2b-upload"
chmod 700 "$RUNNER_TEMP/b2b-upload"
export B2B_ANDROID_KEYSTORE_PATH="$RUNNER_TEMP/b2b-upload/upload.jks"
printf '%s' "$B2B_ANDROID_KEYSTORE_BASE64" | base64 --decode > "$B2B_ANDROID_KEYSTORE_PATH"
chmod 600 "$B2B_ANDROID_KEYSTORE_PATH"

# New replacement upload certificate generated on 2026-11-19.
# Play Console says this certificate becomes effective on 2026-11-21 11:45.
# The Play Console upload-key fingerprint MUST be rechecked after activation.
# A mismatched key must never silently replace the authorized upload key.
expected="9B49A12AD060804BA23692C78C153CADCB38F07B3D1959FEB1BFF0DDA2E772D0"
keytool -exportcert \
  -keystore "$B2B_ANDROID_KEYSTORE_PATH" \
  -alias "$B2B_ANDROID_KEY_ALIAS" \
  -storepass:env B2B_ANDROID_KEYSTORE_PASSWORD \
  -file "$RUNNER_TEMP/b2b-upload/upload-cert.der" >/dev/null
observed="$(openssl x509 -inform DER -in "$RUNNER_TEMP/b2b-upload/upload-cert.der" -noout -fingerprint -sha256 | cut -d= -f2 | tr -d ':' | tr '[:lower:]' '[:upper:]')"
if [[ "$observed" != "$expected" ]]; then
  echo "Android upload certificate mismatch. Refusing to sign a Play update." >&2
  echo "Expected: $expected" >&2
  echo "Found:    $observed" >&2
  exit 1
fi
node scripts/configure-local-android-signing.cjs
(cd android && ./gradlew :app:assembleRelease :app:bundleRelease --no-daemon --stacktrace)
apk=android/app/build/outputs/apk/release/app-release.apk
bundle=android/app/build/outputs/bundle/release/app-release.aab
check_apk "$apk"
test -s "$bundle"
jarsigner -verify "$bundle" >/dev/null
bundle_fingerprint="$(keytool -printcert -jarfile "$bundle" | grep 'SHA256:' | head -n 1 | sed 's/.*SHA256: *//' | tr -d ': ' | tr '[:lower:]' '[:upper:]')"
if [[ "$bundle_fingerprint" != "$expected" ]]; then
  echo "AAB signing certificate mismatch." >&2
  exit 1
fi
echo "Store-signed standalone APK and AAB created with replacement upload certificate."
