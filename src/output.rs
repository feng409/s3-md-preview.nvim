use anyhow::{Context, Result};
use std::fs;
use std::path::PathBuf;

/// Write HTML to a local file and return its path.
pub fn write_local(html: &str, output_dir: &str, title: &str) -> Result<String> {
    fs::create_dir_all(output_dir)
        .with_context(|| format!("failed to create output directory: {output_dir}"))?;
    let path = PathBuf::from(output_dir).join(format!("{title}.html"));
    fs::write(&path, html).with_context(|| format!("failed to write {}", path.display()))?;
    Ok(path.to_string_lossy().into_owned())
}

/// Upload HTML to S3-compatible storage and return the public URL.
#[cfg(feature = "s3")]
#[allow(clippy::too_many_arguments)]
pub async fn upload_s3(
    html: &str,
    endpoint: &str,
    bucket_name: &str,
    region: &str,
    key: &str,
    access_key_id: &str,
    secret_access_key: &str,
    acl: Option<&str>,
) -> Result<String> {
    use s3::bucket::Bucket;
    use s3::creds::Credentials;
    use s3::region::Region;

    let credentials = Credentials {
        access_key: Some(access_key_id.to_string()),
        secret_key: Some(secret_access_key.to_string()),
        security_token: None,
        session_token: None,
        expiration: None,
    };

    let region = Region::Custom {
        region: region.to_string(),
        endpoint: endpoint.to_string(),
    };

    let mut bucket = Bucket::new(bucket_name, region, credentials)?;

    if acl == Some("public-read") {
        bucket.add_header("x-amz-acl", "public-read");
    }
    bucket
        .put_object_with_content_type(key, html.as_bytes(), "text/html; charset=utf-8")
        .await
        .context("S3 upload failed")?;

    Ok(public_url(endpoint, bucket_name, key))
}

/// Build the public object URL from endpoint, bucket, and key.
#[cfg(feature = "s3")]
fn public_url(endpoint: &str, bucket_name: &str, key: &str) -> String {
    let host = endpoint
        .trim_start_matches("https://")
        .trim_start_matches("http://")
        .trim_end_matches('/');
    let key = key.trim_start_matches('/');
    format!("https://{bucket_name}.{host}/{key}")
}
