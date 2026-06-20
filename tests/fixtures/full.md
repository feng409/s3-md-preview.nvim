# Full Feature Test

A document exercising **all** rendering features.

## Table

| Feature    | Status |
|------------|--------|
| Markdown   | OK     |
| Mermaid    | OK     |
| Highlight  | OK     |

## Code

```rust
struct Config {
    bucket: String,
    region: String,
}
```

## Mermaid

```mermaid
flowchart LR
    A[Markdown] --> B[HTML]
    B --> C[Upload]
```

## Blockquote

> Important note here.

## Task List

- [x] Render markdown
- [x] Highlight code
- [x] Render mermaid
- [ ] Upload to S3

---

*End of test document.*
