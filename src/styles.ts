export const MARKDOWN_CSS = String.raw`
:root {
  color-scheme: light dark;
  --bg: #ffffff;
  --fg: #24292f;
  --muted: #57606a;
  --border: #d0d7de;
  --code-bg: #f6f8fa;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0d1117;
    --fg: #c9d1d9;
    --muted: #8b949e;
    --border: #30363d;
    --code-bg: #161b22;
  }
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.markdown-body {
  box-sizing: border-box;
  max-width: 980px;
  margin: 0 auto;
  padding: 2rem;
}

.markdown-body img,
.markdown-body svg {
  max-width: 100%;
}

.markdown-body table {
  border-collapse: collapse;
  width: max-content;
  max-width: 100%;
  overflow: auto;
}

.markdown-body th,
.markdown-body td {
  border: 1px solid var(--border);
  padding: 0.35rem 0.75rem;
}

.markdown-body blockquote {
  color: var(--muted);
  border-left: 0.25rem solid var(--border);
  margin: 1rem 0;
  padding: 0 1rem;
}

.markdown-body :not(pre) > code {
  background: var(--code-bg);
  border-radius: 0.25rem;
  padding: 0.15rem 0.3rem;
}

.markdown-body pre {
  overflow-x: auto;
  border-radius: 0.5rem;
  padding: 1rem;
}

.markdown-body pre.mermaid {
  margin: 1.5rem 0;
  overflow-x: auto;
  text-align: center;
  background: none;
  border: none;
}
`;
