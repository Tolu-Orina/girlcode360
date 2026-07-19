# PWA / bottom-tab QA notes (Phase 7.9)

## Install

- Chrome Android: `beforeinstallprompt` banner in AppShell.
- iOS Safari: no BIP — instruct Share → Add to Home Screen (document in Account help later).

## Offline shell

- Service worker precaches app shell via `vite-plugin-pwa`.
- Cycle writes queue in IndexedDB outbox; sync when API returns.

## Bottom tabs

| Device | Check |
| --- | --- |
| iOS Safari standalone | 5 tabs visible, 48px targets, safe-area inset |
| Android Chrome PWA | Same; Install banner dismiss persists |
| Desktop | Top nav; bottom bar hidden via CSS |
