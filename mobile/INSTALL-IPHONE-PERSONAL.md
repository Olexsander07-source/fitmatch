# Personal iPhone installation — FitGoIn (free, no App Store)

The iPhone app is a native Capacitor package of the **existing FitGoIn website**, using the same Supabase backend. It is for **personal testing only**, not an App Store/TestFlight release. The `mobile/ios-personal-ipa.yml` GitHub Actions job builds an **unsigned device IPA** (not the simulator-only .app).

## Download the build

- In GitHub: **Actions → FitGoIn personal iPhone IPA (unsigned)** → latest green run → **Artifacts** → `FitGoIn-iPhone-unsigned-IPA`.
- Inside the archive is `FitGoIn-iPhone-unsigned.ipa`. The archive is available for 7 days.
- **Unsigned means the .ipa cannot install by tapping it on the iPhone.** Sign using your own free Apple Account on a computer.

## Windows or Mac: Sideloadly (no paid developer account)

1. Download Sideloadly from https://sideloadly.io/ (third-party software; read its privacy terms).
2. On Windows, install the Apple device support dependencies indicated by Sideloadly.
3. Connect your iPhone via USB, unlock it, and tap **Trust This Computer**.
4. Open Sideloadly and select `FitGoIn-iPhone-unsigned.ipa`. Enter your Apple Account **in Sideloadly, not in GitHub/ChatGPT** and handle Apple 2FA locally.
5. Select your connected device, then start installation. If necessary, enable **Developer Mode** under Settings → Privacy & Security and trust your own developer certificate under Settings → General → VPN & Device Management. Device may need restart.
6. Run FitGoIn and test real login, AI Trainer, MATCH, profile, messages and calls. Report device-specific failures; web-origin and email callback flows may behave differently in a WebView.
7. Free Apple signing usually expires after **7 days**. Refresh through the same tool and Apple Account. Do not erase the installed app between refreshes if you want to preserve local settings.

See official Apple free Personal Team rules: https://developer.apple.com/help/account/basics/about-your-developer-account and Sideloadly documentation: https://sideloadly.io/faq.html.

## If no computer is available

You **cannot** install this unsigned IPA just by opening it on the iPhone. Use the Safari Home Screen web app: open https://fitgoin.com in Safari → Share → Add to Home Screen. That gives you FitGoIn as an icon now, without sideloading.

## Safety and scope

- No app publishing, paid Developer Program, TestFlight, or third-party developer certificates required for personal sideloading.
- The GitHub repository is public, so the build files are not a secret/private distribution channel, but no personal signing certificates or user data are included in the IPA.
- Do **not** provide Apple Account password or 2FA codes to ChatGPT. Use a reputable installer locally and understand the risks of third-party signing apps.
- Signing is done **locally on your computer**, not in GitHub Actions.
- Camera/microphone/photos descriptions are set in the generated iOS Info.plist for honest permission requests.
- Native build success does **not** confirm login, network/API calls, OAuth callbacks, microphone, video calls, or purchases work on a real iPhone.
- Do not deploy or replace the production site; GitHub Actions only builds the installer.
