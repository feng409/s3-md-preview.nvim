mod css;
mod output;
mod render;

use anyhow::{Context, Result};
use clap::Parser;
use std::io::{self, Read};

/// Render markdown to self-contained HTML
#[derive(Parser)]
#[command(name = "md-preview", about = "Render markdown to self-contained HTML")]
struct Cli {
    /// Title for the output HTML (also used as filename)
    #[arg(long, default_value = "preview")]
    title: String,

    /// Directory for local file output
    #[arg(long, env = "MD_PREVIEW_OUTPUT_DIR")]
    output_dir: Option<String>,

    /// S3 bucket name
    #[cfg(feature = "s3")]
    #[arg(long, env = "MD_PREVIEW_BUCKET")]
    bucket: Option<String>,

    /// S3-compatible endpoint URL
    #[cfg(feature = "s3")]
    #[arg(long, env = "MD_PREVIEW_ENDPOINT")]
    endpoint: Option<String>,

    /// S3 region
    #[cfg(feature = "s3")]
    #[arg(long, env = "MD_PREVIEW_REGION", default_value = "us-east-1")]
    region: String,

    /// Object key prefix for S3 uploads
    #[cfg(feature = "s3")]
    #[arg(long, default_value = "md-preview/")]
    key_prefix: String,

    /// Explicit S3 object key (overrides --key-prefix + --title)
    #[cfg(feature = "s3")]
    #[arg(long)]
    key: Option<String>,

    /// Custom domain for public URL (e.g. static.example.com)
    #[cfg(feature = "s3")]
    #[arg(long, env = "MD_PREVIEW_CUSTOM_DOMAIN")]
    custom_domain: Option<String>,

    /// S3 ACL (e.g. public-read)
    #[cfg(feature = "s3")]
    #[arg(long)]
    acl: Option<String>,

    /// AWS access key ID
    #[cfg(feature = "s3")]
    #[arg(long, env = "MD_PREVIEW_ACCESS_KEY")]
    access_key_id: Option<String>,

    /// AWS secret access key
    #[cfg(feature = "s3")]
    #[arg(long, env = "MD_PREVIEW_SECRET_KEY")]
    secret_access_key: Option<String>,
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    let mut markdown = String::new();
    io::stdin()
        .read_to_string(&mut markdown)
        .context("failed to read markdown from stdin")?;

    let html = render::render_markdown(&markdown, &cli.title)?;

    #[cfg(feature = "s3")]
    if let Some(bucket) = &cli.bucket {
        let endpoint = cli
            .endpoint
            .as_deref()
            .context("--endpoint is required when --bucket is set")?;
        let (access_key_id, secret_access_key) = resolve_credentials(&cli)?;
        let key = cli
            .key
            .unwrap_or_else(|| format!("{}{}.html", cli.key_prefix, cli.title));
        let rt = tokio::runtime::Runtime::new().context("failed to start async runtime")?;
        let url = rt.block_on(output::upload_s3(
            &html,
            endpoint,
            bucket,
            &cli.region,
            &key,
            &access_key_id,
            &secret_access_key,
            cli.acl.as_deref(),
            cli.custom_domain.as_deref(),
        ))?;
        println!("{url}");
        return Ok(());
    }

    let output_dir = cli.output_dir.unwrap_or_else(default_output_dir);
    let path = output::write_local(&html, &output_dir, &cli.title)?;
    println!("{path}");
    Ok(())
}

fn default_output_dir() -> String {
    let tmp = std::env::var("TMPDIR").unwrap_or_else(|_| "/tmp".to_string());
    format!("{tmp}/md-preview")
}

#[cfg(feature = "s3")]
fn resolve_credentials(cli: &Cli) -> Result<(String, String)> {
    if let (Some(id), Some(secret)) = (&cli.access_key_id, &cli.secret_access_key) {
        return Ok((id.clone(), secret.clone()));
    }

    use s3::creds::Credentials;
    let creds = Credentials::from_env().context(
        "missing credentials: set --access-key-id/--secret-access-key, \
         or MD_PREVIEW_ACCESS_KEY/MD_PREVIEW_SECRET_KEY, \
         or AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY",
    )?;
    let id = creds.access_key.context("access key ID not found")?;
    let secret = creds.secret_key.context("secret access key not found")?;
    Ok((id, secret))
}
