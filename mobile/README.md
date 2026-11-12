# FitGoIn mobile application (Android / iOS)

This is a **non-destructive Capacitor wrapper** around the existing FitGoIn source. Do not reimplement authentication, AI trainer, MATCH or bookings. The web bundle is built by the root `scripts/build.mjs`.

## Launch now on iPhone / Android (PWA)

Open https://fitgoin.com in Safari (iOS) or Chrome (Android), use Share / Add to Home Screen. This requires the PWA branch to be merged and safely deployed via the existing `npm run deploy` workflow to get the new icons and offline page. Current site may already offer a basic home-screen shortcut.

## Build native projects later

Requires Node.js 22+ and an online terminal. Android: Android Studio + SDK. iOS: macOS + Xcode 26+ (or approved cloud Mac build) and an Apple developer account for distribution.

```bash
# from repository root
npm ci
npm run check
npm run build

cd mobile
npm install
npx cap add android
npx cap add ios         # only on macOS
npm run sync
npx cap open android    # use Android Studio to build/test
npx cap open ios        # use Xcode on macOS to build/test
```

Configuration: `mobile/capacitor.config.json`. The `webDir` points at `../.deploy`, produced by the original FitGoIn build. **Do not use a remote `server.url` for production**.

## Release checklist / blockers

1. Test signup/login/logout, email confirmation, password reset and deep-linking on physical devices. Supabase email/OAuth callbacks may currently return to https://fitgoin.com rather than a bundled native app; configure verified Universal/App Links or a safe in-app handoff before store submission.
2. Test camera, microphone, audio/video calls, media upload, notifications, payment entitlements, translated chats, coach MATCH, privacy settings and offline/reconnect behaviour. WebRTC and web permissions may differ inside WKWebView/Android WebView.
3. Configure platform-specific privacy/permission descriptions, Android manifest permissions and iOS Info.plist usage texts only after device testing; do not silently request permissions.
4. Check Apple App Review 4.2 (minimum functionality): a thin website-only wrapper may not be accepted. Add meaningful native capabilities, reliable app navigation and polish.
5. Register store identities and signing: Google Play Console and Apple Developer Program; build and sign AAB/IPA, provide screenshots, privacy declarations, account deletion, review accounts and comply with store billing rules.
6. Never commit Supabase service-role keys, OpenAI keys, API secrets or signing credentials into this repo or app. The website's public config may be bundled.

Do not deploy this branch directly or replace the existing production Cloudflare Worker. Merge verified changes and use the repo's safe-deploy procedure.
