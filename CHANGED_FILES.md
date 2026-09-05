# Android/iPhone additional mobile fixes

Changed files only. Existing PWA behavior, NotificationsModal.tsx, AppLockScreen.tsx,
chief-account security, NVIDIA/NIM security, meeting AI security, and game business logic
were intentionally not changed.

- src/components/feature/MeetingIdeasModal.tsx
  - Mobile-safe dynamic viewport modal height
  - Explicit button types
  - Better mobile modal scrolling
- src/components/feature/ClubPasswordModal.tsx
  - Safe-area/dynamic viewport modal sizing
- src/pages/clubs/community/page.tsx
  - Photo remove button changed to type="button"
  - Accessible delete label
  - Larger mobile photo controls
  - Larger mobile photo upload target
- src/pages/bibleQuiz/components/LeaderboardModal.tsx
  - Mobile-safe dynamic viewport modal height
- src/pages/senior/connection/page.tsx
  - Mobile-safe dynamic viewport editor modal
- src/mobile-runtime.css
  - Mobile safe-area/viewport modal rules
  - 44px minimum touch target for small icon buttons
  - Improved tap behavior

- src/pages/biblePickEnhanced/page.tsx
  - Align enhanced Bible Pick with the active bible-pick-v2 response contract
  - Remove stale answer-field validation and use recommendation
