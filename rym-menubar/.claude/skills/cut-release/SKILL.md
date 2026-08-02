---
name: cut-release
description: Use when publishing a versioned release of RYM MenuBar — tagging a vX.Y.Z, cutting a permanent downloadable build, or deciding whether a change warrants a release vs. just landing on main.
---

# Cut a RYM MenuBar release

## Overview

Releases are driven by the `.github/workflows/release.yml` GitHub Action:

- **Every push to `main`** → rebuilds the universal `.app` and overwrites the rolling
  **`latest`** prerelease. This is automatic — you never do anything for it.
- **Pushing a `vX.Y.Z` git tag** → cuts a **permanent, numbered release** with its own
  zip asset. This is the only thing you do by hand.

So "cut a release" = push a version tag. Everything else (build, universal binary, zip,
upload) happens in CI.

## When to cut a version tag

Cut a `vX.Y.Z` tag when you want a **stable, citable build** people can download and stay
on — not for every change.

| Situation | Action |
|---|---|
| Routine commit / WIP / docs | Just push to `main` — `latest` updates itself. Don't tag. |
| A user-facing feature is complete and verified | Cut a tag. |
| A bug fix you want users to be able to pin to | Cut a tag. |
| You told someone "download vX" | Cut a tag. |
| Mid-feature, tests not green | Do **not** tag. Land on main first. |

**Versioning (semver):**
- **patch** (`v1.2.3` → `v1.2.4`) — bug fixes, no behavior change.
- **minor** (`v1.2.x` → `v1.3.0`) — new feature, backward compatible (e.g. a new menu source).
- **major** (`v1.x` → `v2.0.0`) — a breaking change to how the app is used/configured.

First release is `v1.0.0`.

## Steps

1. **Make sure `main` is green and pushed.** The tag should point at a commit CI already
   built successfully as `latest`.
   ```bash
   git switch main && git pull
   git log --oneline -1            # confirm this is the commit you want to release
   gh run list --workflow release.yml --limit 1   # confirm the latest main run succeeded
   ```

2. **Pick the next version** by looking at existing tags:
   ```bash
   git tag --list 'v*' --sort=-v:refname | head
   ```

3. **Tag and push the tag** (annotated, with a one-line summary):
   ```bash
   git tag -a v1.2.0 -m "v1.2.0 — <what's new in one line>"
   git push origin v1.2.0
   ```

4. **Watch the release build** (it's the same workflow, triggered by the tag):
   ```bash
   gh run watch "$(gh run list --workflow release.yml --limit 1 --json databaseId -q '.[0].databaseId')" --exit-status
   ```

5. **Verify the release and its asset exist:**
   ```bash
   gh api repos/epleaner/rym-menubar/releases/tags/v1.2.0 \
     --jq '"tag: \(.tag_name)  prerelease: \(.prerelease)", (.assets[] | "asset: \(.name)  \(.size) bytes")'
   ```
   Expect `prerelease: false` and a `RYM-MenuBar.zip` asset.

## Notes / gotchas

- **The repo is private**, so release downloads are only visible to people with repo
  access. To let anyone download, make it public first:
  `gh repo edit epleaner/rym-menubar --visibility public --accept-visibility-change-consequences`.
- The `.app` is **ad-hoc signed, not notarized** — downloaders hit Gatekeeper once and
  must right-click → Open (or `xattr -dr com.apple.quarantine`). This is expected; it's
  documented in the README and release notes.
- **Don't reuse or move a published `vX.Y.Z` tag.** Versions are immutable — if a release
  is broken, cut the next patch (`v1.2.1`), don't re-point the old tag.
- You don't need a local universal build to release; CI builds it (universal needs full
  Xcode, which the runner has — `UNIVERSAL=1 ./build-app.sh` fails on Command Line Tools
  only).

## Common mistakes

- **Tagging a commit that isn't on `main` / isn't pushed** → CI builds the wrong thing.
  Always tag a pushed, green `main` commit.
- **Lightweight tag instead of annotated** → use `git tag -a … -m …`, not `git tag v1.2.0`.
- **Expecting a release for a plain push** → plain pushes only update `latest`; permanent
  releases require a `v*` tag.
