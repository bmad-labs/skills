# Mobile Application — Functional Validation Guide

## Scope

This guide covers validation for mobile applications built with React Native, Flutter, native
Android (Kotlin/Java), or native iOS (Swift/Objective-C). The native-first principle applies:
use locally installed SDKs when available, fall back to Docker containers if not. iOS requires
macOS natively.

## Native Tool Validation (Primary)

### Check Tool Availability

```bash
command -v flutter && echo "Flutter: available"
command -v npx && npx react-native --version 2>/dev/null && echo "React Native: available"
command -v gradle && echo "Gradle: available"
command -v xcrun && echo "Xcode tools: available (macOS)"
command -v adb && echo "Android Debug Bridge: available"
command -v emulator && echo "Android Emulator: available"
```

### Step 1: Install Dependencies

| Framework | Command |
|-----------|---------|
| React Native | `npm ci` or `yarn install` |
| Flutter | `flutter pub get` |
| Native Android | `./gradlew dependencies` |
| Native iOS | `pod install` (in ios/ directory) |

### Step 2: Build

| Framework | Android | iOS (macOS only) |
|-----------|---------|-------------------|
| React Native | `npx react-native build-android --mode=debug` | `npx react-native build-ios --mode=Debug` |
| Flutter | `flutter build apk --debug` | `flutter build ios --debug --no-codesign` |
| Native Android | `./gradlew assembleDebug` | N/A |
| Native iOS | N/A | `xcodebuild -workspace *.xcworkspace -scheme <scheme> -sdk iphonesimulator build` |

### Step 3: Run Tests

| Framework | Command |
|-----------|---------|
| React Native | `npm test` (Jest) |
| Flutter | `flutter test` |
| Native Android | `./gradlew test` |
| Native iOS | `xcodebuild test -workspace *.xcworkspace -scheme <scheme> -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 15'` |

### Step 4: Emulator/Simulator Testing (if available)

**Android Emulator:**
```bash
# List available AVDs
emulator -list-avds

# Launch emulator (headless)
emulator -avd <avd_name> -no-window -no-audio &
adb wait-for-device

# Install and launch app
adb install app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n <package>/<activity>
```

**iOS Simulator (macOS only):**
```bash
# List available simulators
xcrun simctl list devices available

# Boot simulator
xcrun simctl boot <device_id>

# Install and launch
xcrun simctl install <device_id> <app_path>
xcrun simctl launch <device_id> <bundle_id>
```

### Step 5: Automation Testing (if available)

| Tool | Check | Run |
|------|-------|-----|
| Detox | `npx detox --version` | `npx detox test -c <config>` |
| Maestro | `command -v maestro` | `maestro test <flow.yaml>` |
| Appium | `command -v appium` | `appium &` then run test suite |

## Docker Fallback (Android — if native SDK not installed)

### React Native Android in Docker

```bash
docker run --rm -v "$(pwd)":/app -w /app reactnativecommunity/react-native-android:latest \
  bash -c "npm ci && npx react-native build-android --mode=debug"
```

### Flutter Android in Docker

```bash
docker run --rm -v "$(pwd)":/app -w /app cirrusci/flutter:latest \
  bash -c "flutter pub get && flutter build apk --debug"
```

### Native Android in Docker

```bash
docker run --rm -v "$(pwd)":/app -w /app thyrlian/android-sdk:latest \
  bash -c "cd /app && ./gradlew assembleDebug"
```

## Validation Priority

1. **Native build + tests** → full validation with locally installed SDKs
2. **Docker build** (Android) → fallback if native SDK not installed
3. **Emulator testing** → runtime verification (optional)
4. **Automation testing** → E2E verification (optional)

## Missing Tool Suggestions

```
SUGGESTION: For mobile validation:
  Android (native — preferred):
    - Android Studio: https://developer.android.com/studio
  Android (Docker fallback):
    - Docker Desktop: docker run reactnativecommunity/react-native-android ...
  iOS (macOS only):
    - Xcode: Install from App Store
  Testing:
    - Maestro: https://maestro.mobile.dev/ (simplest mobile automation)
    - Detox: npm install --save-dev detox
```

## Report Template

```
VALIDATION: [PASS|PARTIAL|FAIL]
- Method: [Docker|Native]
- Android build: [OK|FAILED|SKIPPED]
- iOS build: [OK|FAILED|SKIPPED|N/A (not macOS)]
- Tests: [OK|SKIPPED|FAILED]
- Emulator: [OK|SKIPPED] (device: <name>)
- Automation: [OK|SKIPPED]
- Missing tools: [list if any]
```
