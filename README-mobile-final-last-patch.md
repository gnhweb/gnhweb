# Android + iPhone final mobile patch

Overwrite these files in the repository root:
- src/main.tsx
- src/mobile-final.css
- src/mobile-runtime.ts
- src/components/feature/AppLockScreen.tsx

Changes:
- Adds a dedicated mobile CSS layer for narrow forms, dynamic-height dialogs, touch targets, text wrapping and mobile scrolling.
- Avoids automatic PIN focus on coarse-pointer devices to reduce iOS/Android viewport jumps.
- Replaces full-DOM image rescans with IntersectionObserver + targeted MutationObserver handling.
- Preserves scroll-lock restoration and existing keyboard handling.
- Does not change PWA auto-refresh, chief-account logic, NVIDIA/NIM, meeting-AI security, or game business rules.

This is a code-level patch; real-device testing is not claimed.
