# 기기 생체인증(Passkey) 수정

- WebAuthn 등록 시 `platform` authenticator + `userVerification: required` 사용
- `client-device` 힌트로 이 기기 인증기를 우선 요청
- Android/iOS/Windows의 지문·Face ID·Windows Hello 등 플랫폼 생체인증 사용
- 로그인/앱 잠금 해제도 동일한 패스키로 인증
- 웹사이트는 지문/얼굴 생체정보를 저장하지 않음
