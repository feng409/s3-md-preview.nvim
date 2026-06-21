# Contributing

## Development Setup

```bash
git clone https://github.com/feng409/s3-md-preview.nvim.git
cd md-preview.nvim
cargo build
cargo test
```

## Testing

Run the full test suite:

```bash
cargo test
```

Snapshot tests use [insta](https://github.com/mitsuhiko/insta). After intentional output changes:

```bash
cargo insta review
```

## Code Style

Format and lint before submitting:

```bash
cargo fmt
cargo clippy -- -D warnings
```

## Pull Requests

- Use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages
- One feature or fix per pull request
- Include tests for new behavior or bug fixes
- Ensure `cargo fmt --check`, `cargo clippy -- -D warnings`, and `cargo test` pass locally

## Release Process

1. Bump the version in `Cargo.toml`
2. Tag the release: `git tag vX.Y.Z && git push origin vX.Y.Z`
3. CI builds release binaries for all supported targets and attaches them to the GitHub release
