# GNHWeb Android native biometric wrapper

이 폴더는 기존 `https://gnhweb.vercel.app/` 웹앱을 그대로 보여주면서, **웹 페이지가 열리기 전에 Android의 시스템 생체인증(BiometricPrompt)을 먼저 수행하는 별도 Android 앱**입니다.

## 동작

`앱 실행 → Android 지문/Face ID → 성공 → GNHWeb 웹앱`

앱이 백그라운드로 갔다가 다시 foreground로 돌아오면 다시 생체인증을 요구합니다.

웹앱이 기존에 가지고 있던 PIN/패스키 잠금 화면은 이 네이티브 앱 안에서는 표시하지 않도록 `GNHWebAndroid/` User-Agent를 감지해 우회합니다.

## Android Studio에서 열기

Android Studio 최신 안정 버전에서 이 폴더(`android-native`)를 **Open**하세요.

필요 조건:
- JDK 17
- Android SDK 37
- Gradle 9.3.1
- Android Gradle Plugin 9.1.1

프로젝트 Sync 후 `app` 실행 구성으로 연결된 Android 기기에 설치하면 됩니다.

## APK 빌드

Android Studio에서:

`Build → Build APK(s)`

생성되는 APK를 휴대폰에 설치하면 됩니다.

## 중요

이 앱은 웹앱을 WebView로 열기 때문에 기존 웹앱의 Supabase 로그인 세션/기능은 별도의 WebView 저장소를 사용합니다. 처음 설치한 앱에서는 웹사이트에 한 번 로그인해야 할 수 있습니다.

이 네이티브 앱에서는 웹 Push가 브라우저/PWA와 동일하게 동작하지 않을 수 있으므로, **시스템 푸시까지 네이티브 앱에서 완전히 통합하려면 다음 단계에서 FCM 기반으로 붙이는 것이 적절합니다.**
