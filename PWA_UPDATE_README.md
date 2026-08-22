# PWA installed-app auto-update patch

Changed:
- src/pwa.ts

Behavior:
- Checks for a new Service Worker immediately.
- Checks every 5 minutes while the app is open.
- Rechecks when the installed PWA/browser returns to foreground, focus, pageshow, or online.
- When the new Service Worker takes control, reloads once so the new JS/CSS is visible.
- A completely closed app cannot execute JavaScript; the next launch/foreground transition performs the immediate update check.

This assumes the existing VitePWA configuration remains:
- registerType: "autoUpdate"
- skipWaiting: true
- clientsClaim: true
- injectRegister: false
