mod css;
#[cfg(feature = "s3")]
mod env;
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

    /// S3 ACL (e.g. public-read)
    #[cfg(feature = "s3")]
    #[arg(long)]
    acl: Option<String>,

    /// AWS access key ID
    #[cfg(feature = "s3")]
    #[arg(long)]
    access_key_id: Option<String>,

    /// AWS secret access key
    #[cfg(feature = "s3")]
    #[arg(long)]
    secret_access_key: Option<String>,

    /// Dotenv file for credentials
    #[cfg(feature = "s3")]
    #[arg(long)]
    env_file: Option<String>,

    /// Env var name for access key ID in --env-file
    #[cfg(feature = "s3")]
    #[arg(long, default_value = "AWS_ACCESS_KEY_ID")]
    id_key: String,

    /// Env var name for secret access key in --env-file
    #[cfg(feature = "s3")]
    #[arg(long, default_value = "AWS_SECRET_ACCESS_KEY")]
    secret_key: String,
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
        let key = format!("{}{}.html", cli.key_prefix, cli.title);
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

    if let Some(path) = &cli.env_file {
        return env::parse_env_file(path, &cli.id_key, &cli.secret_key);
    }

    use s3::creds::Credentials;
    let creds = Credentials::from_env().context("missing AWS credentials in environment")?;
    let id = creds.access_key.context("AWS_ACCESS_KEY_ID not set")?;
    let secret = creds.secret_key.context("AWS_SECRET_ACCESS_KEY not set")?;
    Ok((id, secret))
}
