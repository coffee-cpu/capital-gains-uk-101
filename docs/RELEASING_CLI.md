# Releasing the `cgt-visualiser` CLI

Releases are published to npm by `.github/workflows/publish-cli.yml` when a `cli-v<version>` tag is pushed. The workflow uses npm **trusted publishing**: GitHub Actions proves its identity to npm with OIDC, so no npm token is stored anywhere.

## One-time setup (first release only)

Trusted publishing can only be configured for a package that already exists on npm, so the first release starts with a manual placeholder publish.

You need:
- an npm account with **two-factor authentication enabled** (required by `npm trust`);
- Node.js 22.14 or later, and npm 11.15.0 or later (`npm install -g npm@latest`; check with `npm -v`).

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

npm asks for a one-time password from your authenticator app.

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

Watch the **Publish CLI to npm** run in the repository's Actions tab. When it succeeds, https://www.npmjs.com/package/cgt-visualiser shows 0.1.0 with a provenance badge. Check that it runs:

```bash
npx -y cgt-visualiser@0 --version   # prints 0.1.0
```

### 5. Retire the placeholder

```bash
npm deprecate cgt-visualiser@0.0.0 "Placeholder. Use 0.1.0 or later."
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

If you change the JSON output in a breaking way, bump `SCHEMA_VERSION` in `packages/cli/src/report.ts`, update `public/agents.md`, and release a new major version. The agent guide pins `cgt-visualiser@0`.

## Troubleshooting

- **The publish step fails with an authentication error (401, 403 or 404):** the trusted publisher fields don't exactly match. Check them with `npm trust list cgt-visualiser`. Also check the publisher hasn't expired: it expires if not used within 2 days of being created.
- **"Tag version does not match":** the tag and `packages/cli/package.json` disagree. Delete the tag (`git push --delete origin cli-vX.Y.Z` and `git tag -d cli-vX.Y.Z`), fix the version, and tag again.
- **"cannot publish over the previously published version":** that version is already on npm. Bump the version and tag again.

References: [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/), [`npm trust`](https://docs.npmjs.com/cli/v11/commands/npm-trust/).
