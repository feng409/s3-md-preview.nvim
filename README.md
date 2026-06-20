# md-preview.nvim

Render markdown to self-contained HTML with mermaid diagrams and syntax highlighting. Neovim plugin backed by a Rust binary.

## Features

- Self-contained HTML output (no CDN dependencies at view time)
- GitHub Flavored Markdown (tables, task lists, strikethrough)
- 23 Mermaid diagram types rendered server-side
- 100+ programming languages with syntax highlighting
- Local file output or S3-compatible upload
- Dark/light theme auto-detection via `prefers-color-scheme`
- Single static binary with zero runtime dependencies

## Requirements

- Neovim >= 0.10
- Rust toolchain (for building from source) or a pre-built binary

## Installation

Using [lazy.nvim](https://github.com/folke/lazy.nvim):

```lua
{
  "chemf/md-preview.nvim",
  build = "nvim -l build.lua",
  config = function()
    require("md-preview").setup({
      -- Minimal: local preview only
      output_dir = vim.fn.stdpath("cache") .. "/md-preview",
    })
  end,
}
```

Full configuration with S3 upload:

```lua
{
  "chemf/md-preview.nvim",
  build = "nvim -l build.lua",
  config = function()
    require("md-preview").setup({
      output_dir = vim.fn.stdpath("cache") .. "/md-preview",
      s3 = {
        bucket = "my-bucket",
        endpoint = "https://s3.amazonaws.com",
        region = "us-east-1",
        key_prefix = "md-preview/",
        acl = "public-read",
      },
      credentials = {
        env_file = "~/.config/md-preview/.env",
        id_key = "AWS_ACCESS_KEY_ID",
        secret_key = "AWS_SECRET_ACCESS_KEY",
      },
      no_proxy = true,
    })
  end,
}
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `bin` | `string?` | `nil` | Path to the `md-preview` binary. Auto-detected when unset. |
| `output_dir` | `string` | `stdpath("cache") .. "/md-preview"` | Directory for local HTML output. |
| `s3` | `table?` | `nil` | S3 upload settings. When set, `:Md` uses upload mode by default. |
| `s3.bucket` | `string` | — | S3 bucket name. |
| `s3.endpoint` | `string` | — | S3-compatible endpoint URL. |
| `s3.region` | `string` | — | AWS region. |
| `s3.key_prefix` | `string?` | `"md-preview/"` | Key prefix for uploaded objects. |
| `s3.acl` | `string?` | `nil` | Object ACL (e.g. `"public-read"`). |
| `credentials` | `table?` | `nil` | Credential source for S3 uploads. |
| `credentials.env_file` | `string` | — | Path to a dotenv file with access keys. |
| `credentials.id_key` | `string` | — | Environment variable name for the access key ID. |
| `credentials.secret_key` | `string` | — | Environment variable name for the secret access key. |
| `no_proxy` | `boolean` | `true` | Clear proxy environment variables before running the binary. |

## Usage

Open a markdown buffer and run one of:

| Command | Description |
|---------|-------------|
| `:Md` | Preview the current buffer. Uses S3 upload when `s3` is configured, otherwise writes locally. |
| `:MdLocal` | Always write HTML to `output_dir`. |
| `:MdUpload` | Always upload to S3 (requires `s3` configuration). |

On success, the output path or URL is shown in a notification and copied to the clipboard via OSC 52 (works over SSH).

Run `:checkhealth md-preview` to verify the binary, S3 credentials, and output directory.

## CLI

The `md-preview` binary can be used standalone:

```bash
# Render stdin to a local HTML file
echo "# test" | md-preview --title test

# Specify output directory
echo "# test" | md-preview --title test --output-dir /tmp/previews

# Upload to S3
echo "# test" | md-preview --title test \
  --bucket my-bucket \
  --endpoint https://s3.amazonaws.com \
  --region us-east-1 \
  --env-file ~/.config/md-preview/.env \
  --id-key AWS_ACCESS_KEY_ID \
  --secret-key AWS_SECRET_ACCESS_KEY
```

## License

MIT
