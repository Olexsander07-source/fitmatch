# FitGoIn for iPhone (iOS first)

This project uses the existing FitGoIn codebase at https://fitgoin.com. **Current release priority is iPhone only.** Android remains deferred; do not spend time on Android releases until requested.

## Available now: Home Screen app

1. Open https://fitgoin.com using **Safari on iPhone**.
2. Tap **Share** -> **Add to Home Screen**.
3. Leave **Open as Web App** enabled and select Add.

This is a Home Screen web app, not yet a native App Store release. The enhanced PWA manifest, icon and offline screen require a verified production deployment (use `npm run deploy` following root `AGENTS.md`).

## Build the native iOS app

The existing Capacitor 8 setup at `mobile/capacitor.config.json` packages the website's built static assets while preserving the original Supabase service, accounts, AI trainer and coach search. No app-specific credentials belong in the source.

Requirements: **macOS, Xcode 26+, Node 22+, CocoaPods**.

```bash
# From repo root
npm ci
npm run check
npm run build
cd mobile
npm install
npx cap add ios
npx cap sync ios
npx cap open ios
```

Open `mobile/ios/App/App.xcworkspace`, select the App scheme, configure your personal/team signing and bundle ID, and test on physical iPhone. *Don't check in Apple certificates or provisioning profiles.* In a macOS GitHub runner, `.github/workflows/ios-preview.yml` compiles an **unsigned simulator-only** build to validate Xcode compatibility. Its artifact **cannot be installed on a real iPhone**, and is not an IPA for distribution.

## TestFlight and App Store blockers

- Enrol in Apple Developer Program and confirm App Store Connect access. Obtain proper signing credentials and provisioning only through the account owner.
- Test Apple iPhone native WebView login, logout, email verification and password reset; allow valid HTTPS auth callbacks and/or securely configure Universal Links. Do not change redirects blindly.
- Test camera, microphone, messaging, voice/video calls, AI conversations, match, coach bookings, translations, and reconnect flows on a *physical* iPhone, not merely the simulator. Declare meaningful camera/microphone usage reasons in `Info.plist` before a signed build.
- Audit policies for subscriptions, digital goods, privacy, consent, account deletion and App Review minimum functionality: a thin website wrapper may be rejected.
- Prepare iPhone screenshots, native app icon, privacy declarations, release metadata and signed upload. Use TestFlight first, then submit for Apple review.

Until the real iPhone app is signed and tested, the simplest usable version is the Safari Home Screen app.

**Do not deploy the site directly from this branch.** Leave Cloudflare production unchanged; after verified merge, follow `AGENTS.md` safe deployment instructions.

