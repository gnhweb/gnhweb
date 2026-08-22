# Android + iPhone 추가 모바일 패치

이번 패치는 기존 모바일 수정본 위에 추가로 적용하는 보강 패치입니다.

- 모바일 `grid-cols-2` 폼을 1열로 전환(가로 스크롤 영역은 예외)
- 모바일 `whitespace-nowrap` 폭 밀림 완화(버튼/탭/가로 스크롤은 유지)
- 남아 있는 `vh` 기반 max-height 모달을 dynamic viewport 기준으로 보강
- 모달 내부 iOS/Android 관성 스크롤 및 overscroll 보강
- 바리새인 게임 하단 HUD safe-area 보강

PWA 자동 새로고침 정책은 수정하지 않습니다.
실제 iPhone/Android 실기기 테스트는 수행하지 않았습니다.
