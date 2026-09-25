# Releasing Forge

Installed copies of Forge update themselves from
[github.com/martex-dev/forge-releases](https://github.com/martex-dev/forge-releases), a public
repo that holds **only** installers. The source repo stays private (ADR-023).

## One-time setup (Marto)

The release workflow needs permission to publish to the releases repo. The default
`GITHUB_TOKEN` can't write to another repository, so:

1. GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** →
   Generate new token.
    - Repository access: **Only select repositories** → `martex-dev/forge-releases`.
    - Permissions: **Contents: Read and write** (nothing else).
    - Expiration: your choice; renew it when it expires.
2. In the **forge** repo: Settings → Secrets and variables → Actions → New repository secret →
   name `RELEASES_TOKEN`, value: the token.

Never paste the token anywhere else (chat, code, `.env`).

## Cutting a release

```powershell
npm version minor   # or patch; bumps package.json and creates the tag v0.X.0
git push --follow-tags
```

The **Release** workflow (`.github/workflows/release.yml`) checks the tag matches
`package.json`, runs typecheck and tests, builds the app and the PyInstaller sidecar, and
publishes `Forge-Setup-<version>.exe` + `latest.yml` to the releases repo.

## What users (you) see

- About a minute after launch, then every 6 hours: a background check (Settings → General →
  Updates can turn this off, or run **Check now**).
- A newer version downloads in the background (status bar shows %). When it's ready, the inbox
  says so and the status bar shows **Restart to update**. Otherwise it installs on the next quit.
- The installer is unsigned: Windows SmartScreen may ask the first time ("More info" → "Run
  anyway").

## Building locally

```powershell
npm run dist                 # app + sidecar + installer in release/ (no publishing)
npx playwright test e2e/packaged.spec.ts   # proves the installed layout works
```
