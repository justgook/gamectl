# GAMS Tauri release notes

## Current productization baseline

- Product name: `GAMS`
- Bundle identifier: `com.github.kkgams.gams`
- Version source: `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`
- Primary icon/logo source: `brand/icon.svg`

## Icon workflow

After changing the primary icon source, regenerate ignored/generated platform icons and the browser favicon:

```sh
make app-icons
make app-check
```

## Release build commands

```sh
make app-build-release
make app-bundle-release
```

The root Makefile writes Tauri/Cargo output under `build.nosync/app/target` by default. Generated platform icons are written under `build.nosync/app/icons` and should not be committed.

## Still needed before public release

- Decide signing/notarization strategy for macOS/Windows/Linux packages.
- Confirm versioning policy and release artifact naming.
- Replace any remaining placeholder CLI descriptions/subcommands before announcing as stable.
