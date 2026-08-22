# Android + iPhone single final mobile patch

Based on the currently available GitHub `main` mobile code plus the latest mobile patch files from this session.

Includes:
- Mobile viewport/safe-area/scroll containment improvements
- Small touch target handling
- Mobile PIN autofocus guard
- Targeted image lazy-loading observer instead of full DOM rescans
- Scroll-lock restoration
- Notification mobile touch buttons and explicit permission behavior
- Fix for the previously observed NotificationsModal JSX build error

Does not change:
- PWA auto-reload policy
- Chief account logic
- NVIDIA/NIM/security code
- Meeting AI security
- Game business rules

Run `npm run build` in Vercel after applying. This patch is not presented as real-device validation.
