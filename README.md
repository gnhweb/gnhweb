# Android + iPhone mobile patch (PWA auto-refresh excluded)

덮어쓰기 대상:
- src/main.tsx
- src/mobile-runtime.ts
- src/mobile-runtime.css
- src/components/feature/AppLockScreen.tsx

적용한 범위:
- scroll-lock 해제 시 원래 스크롤 위치 복원
- PIN 숨김 input의 물리 키보드 접근성 개선
- 모바일 alert를 비차단 toast로 보이게 개선
- 화면 아래쪽 이미지 lazy-loading/decoding 보강
- iOS 미지원 vibrate를 무해한 no-op으로 처리
- 상단 toast/modal safe-area 대응
- overflow 스크롤의 iOS 관성 스크롤 보강
- 외부 CDN preconnect/dns-prefetch 보강

제외:
- PWA 자동 새로고침 정책
- 부장계정
- NVIDIA/NIM/회의 AI 보안
- 게임 규칙/게임플레이 로직

주의: 이 패치는 실제 iPhone/Android 실기기 테스트 완료본이 아니라 코드 기준 보강 패치입니다.
