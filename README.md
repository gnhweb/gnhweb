# Final Android + iPhone mobile cleanup patch

This patch is based on the current mobile changes and fixes the latest Vercel JSX build error in `NotificationsModal.tsx`.

Included:
- Fix malformed JSX that caused `Expected ">" but found "["` at NotificationsModal.tsx:374.
- Remove global `window.alert` override from mobile runtime; alerts remain semantically intact.
- Reduce image MutationObserver work: only inspect newly added DOM nodes instead of rescanning every image on every mutation.
- Keep hidden PIN input accessibility selector aligned with AppLockScreen (`data-gnh-pin-input`).
- Keep scroll-lock position restoration and iOS/Android vibration no-op behavior.
- Change notification permission request to explicit user action via an `알림 허용` button.
- Make notification close/delete actions touch-friendly (44px), remove hover-only delete behavior.
- Add safe-area-aware notification toast positioning and mobile-friendly text wrapping.

Excluded:
- PWA automatic reload policy.
- Chief account / setup logic.
- NVIDIA / NIM / meeting AI security logic.
- Game rules.

Important: This is a code patch. A production `vite build` must still be verified by Vercel after upload.
