# Releasing the `cgt-visualiser` CLI

Releases are published to npm by `.github/workflows/publish-cli.yml` when a `cli-v<version>` tag is pushed. The workflow uses npm **trusted publishing**: GitHub Actions proves its identity to npm with OIDC, so no npm token is stored anywhere.

## One-time setup (first release only)

This was completed for 0.1.0 in October 2026. It is kept here in case the package ever has to be set up again.

Trusted publishing can only be configured for a package that already exists on npm, so the first release starts with a manual placeholder publish.

You need:
- an npm account with **two-factor authentication enabled** (required by `npm trust`);
- Node.js 22.14 or later, and npm 11.15.0 or later (`npm install -g npm@latest`; check with `npm -v`). Only `npm trust` needs npm 11; if you set up the trusted publisher on the website instead, an older npm is fine.

Run the npm commands below in a regular interactive terminal. If your 2FA uses a security key or passkey, npm prints an "Authenticate your account at" link and waits for you to confirm in the browser. If it uses an authenticator app, npm asks for a code. A non-interactive shell can do neither, so the command fails with `EOTP`.

### 1. Log in

```bash
npm login
```

### 2. Publish a placeholder so the package name exists

From any empty directory, not the repository:

```bash
mkdir cgt-visualiser-placeholder && cd cgt-visualiser-placeholder
cat > package.json <<'EOF'
{
  "name": "cgt-visualiser",
  "version": "0.0.0",
  "description": "Placeholder. Use cgt-visualiser 0.1.0 or later.",
  "license": "MIT"
}
EOF
npm publish --access public
```

npm asks you to confirm with 2FA (see above).

npm may also create a stub version called `0.0.0-stage` ("Temporary package placeholder for staged publishing"), and `0.0.0` itself can take a while to appear in `npm view cgt-visualiser versions`. Either way the package name now exists, which is all step 3 needs.

### 3. Trust this repository's publish workflow

```bash
npm trust github cgt-visualiser \
  --repo coffee-cpu/capital-gains-uk-101 \
  --file publish-cli.yml \
  --allow-publish
```

Check it was saved:

```bash
npm trust list cgt-visualiser
```

You can also do this on the website instead: open https://www.npmjs.com/package/cgt-visualiser → **Settings** → **Trusted Publisher** → **GitHub Actions**, and enter:

| Field | Value |
|---|---|
| Organization or user | `coffee-cpu` |
| Repository | `capital-gains-uk-101` |
| Workflow filename | `publish-cli.yml` |
| Environment name | *(leave empty)* |
| Allowed actions | allow `npm publish` |

The values are case-sensitive. npm doesn't check them when you save, so a mistake only shows up as a failed publish.

**A new trusted publisher must be used for a successful publish within 2 days**, or it expires. Go straight on to step 4.

### 4. Release 0.1.0 through the workflow

`packages/cli/package.json` already has version `0.1.0`. From an up-to-date `main`:

```bash
git checkout main && git pull
git tag cli-v0.1.0
git push origin cli-v0.1.0
```

Watch the **Publish CLI to npm** run in the repository's Actions tab. When it succeeds, npm reports "Your package is being processed and may take a few minutes to become available". For 0.1.0 it took about 90 seconds before `npm view cgt-visualiser@0.1.0 version` returned the version. After that, https://www.npmjs.com/package/cgt-visualiser shows 0.1.0 with a provenance badge. Check that it runs:

```bash
npx -y cgt-visualiser@latest --version   # prints 0.1.0
```

### 5. Retire the placeholder

```bash
npm deprecate cgt-visualiser@0.0.0 "Placeholder. Use 0.1.0 or later."
npm deprecate cgt-visualiser@0.0.0-stage "Placeholder. Use 0.1.0 or later."   # if npm created the stub
```

### 6. Optional: block token-based publishing

On https://www.npmjs.com/package/cgt-visualiser → **Settings** → **Publishing access**, choose **Require two-factor authentication and disallow tokens**, then **Update Package Settings**. Trusted publishing keeps working; only token-based publishing is blocked.

## Every later release

1. In a PR, bump `version` in `packages/cli/package.json` (for example `0.1.1`) and merge it.
2. Tag the merged commit on `main` with the same version:

   ```bash
   git checkout main && git pull
   git tag cli-v0.1.1
   git push origin cli-v0.1.1
   ```

The workflow fails before publishing if the tag doesn't match `packages/cli/package.json`.

If you change the JSON output in a breaking way, bump `SCHEMA_VERSION` in `packages/cli/src/report.ts`, update `public/agents.md`, and release a new major version.

The agent guide (`public/agents.md`), `public/llms.txt` and `index.html` use `cgt-visualiser@latest`, so a new release reaches agents straight away, including a new major version. They are protected from breaking changes by the `schemaVersion` check in the agent guide, not by the version range. Don't switch them to a range such as `@0`: npx caches each install under the exact spec it was given and keeps reusing a cached version that still satisfies the range, so someone who ran `@0` once would stay on that version indefinitely. `@latest` is checked against the registry on every run.

## Troubleshooting

- **`EOTP`: "This operation requires a one-time password":** the command ran somewhere npm couldn't prompt for 2FA (for example, a non-interactive shell). Run it in a regular terminal, or pass `--otp=<code>` if you use an authenticator app.
- **The workflow succeeded but `npm view` doesn't show the new version yet:** npm is still processing it. Wait a few minutes.
- **`npx cgt-visualiser@0` (or another range) runs an old version:** npx is reusing a cached install. Use `@latest` or an exact version, or clear the cache with `npx clear-npx-cache`.
- **The publish step fails with an authentication error (401, 403 or 404):** the trusted publisher fields don't exactly match. Check them with `npm trust list cgt-visualiser`. Also check the publisher hasn't expired: it expires if not used within 2 days of being created.
- **"Tag version does not match":** the tag and `packages/cli/package.json` disagree. Delete the tag (`git push --delete origin cli-vX.Y.Z` and `git tag -d cli-vX.Y.Z`), fix the version, and tag again.
- **"cannot publish over the previously published version":** that version is already on npm. Bump the version and tag again.

References: [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/), [`npm trust`](https://docs.npmjs.com/cli/v11/commands/npm-trust/).
