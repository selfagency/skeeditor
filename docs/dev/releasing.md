# Releasing skeeditor

This guide provides a complete, step-by-step release process for:

- Chrome Web Store (Chrome)
- Firefox Add-ons (AMO)
- Microsoft Edge Add-ons
- Apple App Store (Safari extension via Xcode wrapper app)

> This repository builds browser targets with WXT to `dist/chrome`, `dist/firefox`, and `dist/safari`.

---

## 1) Release prerequisites

Before touching any store dashboard:

1. Ensure you are on `main` and up to date.
2. Confirm CI is green for your release commit.
3. Bump version (single source of truth in `package.json`).
4. Run local quality checks:

```sh
task lint
task typecheck
task test
task test:e2e:chromium:devnet
```

1. Build distributables:

```sh
task build:chrome
task build:firefox
task build:safari
```

1. Validate Firefox package shape:

```sh
task webext:lint:firefox
```

1. Verify required public URLs are live:
   - Privacy policy
   - Support URL / issue tracker
   - Homepage (optional but recommended)

---

## 2) Prepare store artifacts

Most stores expect a ZIP/XPI package with `manifest.json` at archive root.

Create release artifacts from build outputs:

```sh
mkdir -p release-artifacts

# Chrome
cd dist/chrome && zip -r ../../release-artifacts/skeeditor-chrome.zip . && cd -

# Firefox (AMO accepts ZIP or XPI upload)
cd dist/firefox && zip -r ../../release-artifacts/skeeditor-firefox.zip . && cd -

# Edge (same package style as Chrome)
cp release-artifacts/skeeditor-chrome.zip release-artifacts/skeeditor-edge.zip
```

Safari uses the Xcode/App Store flow (no direct “upload extension zip” path).

---

## 3) Chrome Web Store release

1. Open Chrome Web Store Developer Dashboard.
2. Select existing listing (or create a new one once).
3. Upload `release-artifacts/skeeditor-chrome.zip`.
4. Complete/update listing metadata:
   - Description
   - Category
   - Screenshots and promo assets
   - Privacy policy URL
5. Complete data use disclosures accurately.
6. Submit for review.
7. Publish (immediate or staged rollout).

### Chrome checklist

- [ ] ZIP uploads successfully
- [ ] Permissions are justified in listing copy
- [ ] Privacy and support URLs are valid
- [ ] Published version matches `package.json`

---

## 4) Firefox Add-ons (AMO) release

1. Open AMO Developer Hub.
2. Select existing add-on.
3. Upload `release-artifacts/skeeditor-firefox.zip`.
4. Confirm metadata and policy fields:
   - Summary / description
   - Privacy policy
   - Permission rationale
5. Submit for review and signing.

### Firefox checklist

- [ ] `browser_specific_settings.gecko.id` is stable
- [ ] Upload passes AMO validation
- [ ] Any warnings are reviewed and accepted or resolved
- [ ] Signed version is published to the correct channel

---

## 5) Microsoft Edge Add-ons release

1. Open Microsoft Partner Center → Edge Add-ons.
2. Select existing product.
3. Upload `release-artifacts/skeeditor-edge.zip`.
4. Update metadata (can mirror Chrome listing copy).
5. Confirm privacy/compliance fields.
6. Submit and publish.

### Edge checklist

- [ ] Package upload succeeds
- [ ] Listing metadata matches current release
- [ ] Privacy disclosures complete
- [ ] Published version matches Chrome release number

---

## 6) Apple App Store release (Safari extension)

Safari extensions are distributed via a signed app bundle submitted through App Store Connect.

Because you have a paid Apple Developer account, you can complete signing and distribution.

### 6.1 Build and convert

```sh
task build:safari
```

If your workflow uses a converter script, run it next (example):

```sh
scripts/build-safari.sh
```

Or run the converter directly (example shape):

```sh
xcrun safari-web-extension-converter dist/safari \
  --project-location ./safari-xcode \
  --app-name skeeditor \
  --bundle-identifier dev.selfagency.skeeditor \
  --swift
```

### 6.2 Configure in Xcode

1. Open generated Xcode project/workspace.
2. Set Team for all targets (app + extension).
3. Set version and build numbers.
4. Ensure signing certificates/profiles are valid.
5. Archive (`Product` → `Archive`).
6. Upload to App Store Connect.

### 6.3 App Store Connect submission

1. Open uploaded build in App Store Connect.
2. Fill app metadata, screenshots, categories.
3. Complete privacy nutrition labels.
4. Add release notes (“What’s New”).
5. Submit for review.

### Apple checklist

- [ ] Extension target included in app bundle
- [ ] Signing valid for app + extension
- [ ] Build processed in App Store Connect
- [ ] Privacy labels and export compliance completed
- [ ] Version/build match repository release

---

## 7) Recommended release order

To reduce risk and rollback complexity:

1. Chrome Web Store
2. Microsoft Edge Add-ons
3. Firefox AMO
4. Apple App Store

This order gives quick feedback from Chromium stores first, then Mozilla review, then the longer Apple review path.

---

## 8) Post-release verification

After all stores are live:

1. Install from each store in a clean profile.
2. Verify popup opens and auth flow starts.
3. Verify edit button appears on own posts.
4. Verify edit save succeeds.
5. Verify no new critical errors in console/logs.

Optional release note template:

- Version: `x.y.z`
- Date: `YYYY-MM-DD`
- Highlights: Item 1; Item 2; Item 3

---

## 9) Troubleshooting quick references

- Chrome upload errors: validate ZIP root contains `manifest.json`.
- AMO warnings: run `task webext:lint:firefox` locally first.
- Edge import mismatch: re-upload fresh Chrome ZIP.
- Apple signing failures: re-check Team, bundle IDs, and provisioning profiles in Xcode.

---

## 10) Scripted release automation

This repository includes a release script at `scripts/release.mjs` and a manual GitHub Actions workflow at `.github/workflows/release.yml`.

### Local scripted commands

```sh
# Full dry-run (quality gates + build + package, no store publish)
task release:dry-run

# Faster dry-run (skip tests)
task release:prepare

# Publish mode (requires secrets in environment)
task release:publish
```

Generated artifacts go to `release-artifacts/` and include:

- Chrome ZIP
- Firefox ZIP
- Edge ZIP (copied from Chrome ZIP)
- `release-manifest.json` with file checksums

### Release script flags

```sh
node scripts/release.mjs [options]

--dry-run
--publish-chrome
--publish-firefox
--publish-edge
--skip-checks
--skip-tests
--skip-safari
--artifacts-dir <path>
--version <x.y.z>
```

### Required environment variables for publish

- Chrome publish (`--publish-chrome`)
  - `CHROME_EXTENSION_ID`
  - `CHROME_CLIENT_ID`
  - `CHROME_CLIENT_SECRET`
  - `CHROME_REFRESH_TOKEN`
- Firefox publish (`--publish-firefox`)
  - `FIREFOX_API_KEY`
  - `FIREFOX_API_SECRET`
- Edge publish (`--publish-edge`)
  - `EDGE_PUBLISH_COMMAND` (custom command run by the workflow/script)
  - `EDGE_PACKAGE_PATH` is injected automatically when command runs

### GitHub Actions workflow

Use Actions → **Release** → **Run workflow** with inputs:

- `dry_run`
- `publish_chrome`
- `publish_firefox`
- `publish_edge`
- `skip_checks`
- `skip_tests`
- `skip_safari`

The workflow always uploads `release-artifacts` as a run artifact.

### CI coverage for release automation

The main CI workflow now includes a **Release automation smoke test** job that runs:

```sh
task release:smoke
```

This verifies packaging and artifact generation on every PR/push without publishing to any store.
