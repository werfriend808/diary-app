# Building and releasing

The app is built in the cloud with **EAS Build**, so no Mac, Xcode or Android Studio is needed.
`eas.json` has two profiles:

| Profile | Output | Use |
|---|---|---|
| `preview` | Android **.apk** (internal distribution) | Install directly on an Android phone; share a link with testers |
| `production` | Android .aab / iOS .ipa | Upload to Google Play / App Store. Build numbers are kept on EAS and incremented automatically (`appVersionSource: remote`, `autoIncrement`). |

App ids (permanent once published): `com.werfriend808.mydiary` for both Android (`android.package`)
and iOS (`ios.bundleIdentifier`) in `app.json`.

## Android APK (preview)

You need a free [Expo account](https://expo.dev/signup).

```bash
# once: log in and link this project to your Expo account (adds extra.eas.projectId to app.json)
npx eas-cli@latest login
npx eas-cli@latest init

# build the APK in the cloud (~10-20 min). The first build offers to generate an Android
# keystore — answer yes; EAS stores it for you.
npx eas-cli@latest build --platform android --profile preview
```

When it finishes, the CLI prints a link and a QR code. Open it on an Android phone to download
and install the APK (allow "install unknown apps" for your browser). The same link can go in the
GitHub release.

Commit the `app.json` change made by `eas init` (the project id) on its own.

## Store builds (later)

```bash
npx eas-cli@latest build --platform android --profile production   # .aab for Google Play
npx eas-cli@latest build --platform ios --profile production       # needs an Apple Developer account
npx eas-cli@latest submit --platform android
npx eas-cli@latest submit --platform ios
```

Before a store release: final app name, icon and splash screen; a published privacy policy
([draft](privacy-policy.md)); testing on real phones. New Google Play personal accounts must run a
closed test with at least 12 testers for 14 days first.

## Versioning and tagging a release

1. Update `version` in `app.json` and `package.json` (they stay equal) and add a section to
   `CHANGELOG.md`.
2. Merge to `main` with CI green.
3. Tag and publish:

   ```bash
   git checkout main && git pull
   git tag -a v1.0.0 -m "My Diary 1.0.0"
   git push origin v1.0.0
   ```

4. Create the GitHub release from the tag (notes from the changelog) and attach the APK link.

Backup file format versions are separate from app versions; see
[Backup format and versioning](../README.md#backup-format-and-versioning).
