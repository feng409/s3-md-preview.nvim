# Contributing

## Development Setup

```bash
git clone https://github.com/feng409/s3-md-preview.nvim.git
cd md-preview.nvim
npm ci
npm run build
npm test -- --run
```

## Testing

Run the full test suite:

```bash
npm test -- --run
```

Run type checking and the full local check target before opening a pull request:

```bash
npm run typecheck
make check
```

## Code Style

TypeScript is checked with `tsc` in strict mode. There is no formatter configured yet; keep edits consistent with the surrounding code.

```bash
npm run typecheck
```

## Pull Requests

- Use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages
- One feature or fix per pull request
- Include tests for new behavior or bug fixes
- Ensure `npm test -- --run`, `npm run typecheck`, `npm run build`, and relevant Neovim smoke tests pass locally

## Release Process

1. Bump the version in `package.json`
2. Tag the release: `git tag vX.Y.Z && git push origin vX.Y.Z`
3. CI builds the Node CLI package and attaches it to the GitHub release
