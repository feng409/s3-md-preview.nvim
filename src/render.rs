use crate::css::{HIGHLIGHT_CSS, MARKDOWN_CSS};
use anyhow::{Context, Result};
use comrak::nodes::{NodeHtmlBlock, NodeValue};
use comrak::{format_html, parse_document, Arena, ExtensionOptions, Options, RenderOptions};
use syntect::html::{ClassStyle, ClassedHTMLGenerator};
use syntect::parsing::SyntaxSet;
use syntect::util::LinesWithEndings;

/// Render markdown source into a self-contained HTML document.
pub fn render_markdown(markdown: &str, title: &str) -> Result<String> {
    let options = Options {
        extension: ExtensionOptions {
            strikethrough: true,
            table: true,
            autolink: true,
            tasklist: true,
            tagfilter: true,
            ..Default::default()
        },
        render: RenderOptions {
            unsafe_: true,
            ..Default::default()
        },
        ..Default::default()
    };

    let arena = Arena::new();
    let root = parse_document(&arena, markdown, &options);

    let ss = SyntaxSet::load_defaults_newlines();

    for node in root.descendants() {
        let mut data = node.data.borrow_mut();
        let NodeValue::CodeBlock(ref mut cb) = data.value else {
            continue;
        };

        let info = cb.info.trim();
        if info == "mermaid" {
            if let Ok(svg) = mermaid_rs_renderer::render(&cb.literal) {
                data.value = NodeValue::HtmlBlock(NodeHtmlBlock {
                    block_type: 6,
                    literal: format!("<div class=\"mermaid-diagram\">{svg}</div>\n"),
                });
            }
            continue;
        }

        let lang = info.split_whitespace().next().unwrap_or("");
        if lang.is_empty() {
            continue;
        }

        let Some(syntax) = ss
            .find_syntax_by_extension(lang)
            .or_else(|| ss.find_syntax_by_token(lang))
        else {
            continue;
        };

        let highlighted = highlight_code(&ss, syntax, &cb.literal)?;
        data.value = NodeValue::HtmlBlock(NodeHtmlBlock {
            block_type: 6,
            literal: format!("<pre><code class=\"language-{lang}\">{highlighted}</code></pre>\n"),
        });
    }

    let mut body_html = Vec::new();
    format_html(root, &options, &mut body_html).context("failed to format HTML")?;
    let body_html = String::from_utf8(body_html).context("HTML output was not valid UTF-8")?;

    Ok(wrap_html_document(title, &body_html))
}

fn highlight_code(
    ss: &SyntaxSet,
    syntax: &syntect::parsing::SyntaxReference,
    code: &str,
) -> Result<String> {
    let mut generator = ClassedHTMLGenerator::new_with_class_style(syntax, ss, ClassStyle::Spaced);
    for line in LinesWithEndings::from(code) {
        generator
            .parse_html_for_line_which_includes_newline(line)
            .context("failed to highlight code")?;
    }
    Ok(generator.finalize())
}

fn wrap_html_document(title: &str, body_html: &str) -> String {
    format!(
        r#"<!DOCTYPE html>
<html lang="en" data-color-mode="auto">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<style>
{MARKDOWN_CSS}
{HIGHLIGHT_CSS}
</style>
</head>
<body>
<article class="markdown-body">
{body_html}</article>
</body>
</html>
"#
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn renders_basic_markdown() {
        let html = render_markdown("# Hello\n\nWorld", "test").unwrap();
        assert!(html.contains("<h1>Hello</h1>"));
        assert!(html.contains("<p>World</p>"));
        assert!(html.contains("markdown-body"));
    }

    #[test]
    fn renders_mermaid_diagram() {
        let md = "```mermaid\nflowchart TD\n    A --> B\n```";
        let html = render_markdown(md, "test").unwrap();
        assert!(html.contains("mermaid-diagram"));
        assert!(html.contains("<svg"));
    }

    #[test]
    fn highlights_rust_code() {
        let md = "```rust\nfn main() {}\n```";
        let html = render_markdown(md, "test").unwrap();
        assert!(html.contains("language-rust"));
        assert!(html.contains("<span"));
    }
}
