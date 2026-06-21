local function plugin_dir()
  return vim.fn.fnamemodify(debug.getinfo(1, "S").source:sub(2), ":h")
end

local function uname()
  if vim.uv and vim.uv.os_uname then
    return vim.uv.os_uname()
  end
  return vim.loop.os_uname()
end

local function rust_target()
  local info = uname()
  local sys = info.sysname:lower()
  local machine = info.machine:lower()

  if sys == "linux" then
    if machine == "x86_64" or machine == "amd64" then
      return "x86_64-unknown-linux-gnu"
    end
    if machine == "aarch64" or machine == "arm64" then
      return "aarch64-unknown-linux-gnu"
    end
  elseif sys == "darwin" then
    if machine == "x86_64" or machine == "amd64" then
      return "x86_64-apple-darwin"
    end
    if machine == "arm64" or machine == "aarch64" then
      return "aarch64-apple-darwin"
    end
  end

  return nil
end

local function read_version()
  local cargo = plugin_dir() .. "/Cargo.toml"
  if vim.fn.filereadable(cargo) ~= 1 then
    return nil
  end
  for _, line in ipairs(vim.fn.readfile(cargo)) do
    local ver = line:match('^version = "(.+)"$')
    if ver then
      return ver
    end
  end
  return nil
end

local function run(cmd)
  print("[md-preview] " .. cmd)
  local out = vim.fn.system(cmd)
  if vim.v.shell_error ~= 0 then
    return false, out
  end
  return true, out
end

local function ensure_bin_dir()
  local bin_dir = plugin_dir() .. "/bin"
  if vim.fn.isdirectory(bin_dir) ~= 1 then
    vim.fn.mkdir(bin_dir, "p")
  end
  return bin_dir
end

local function download_binary(target, version)
  local bin_dir = ensure_bin_dir()
  local dest = bin_dir .. "/md-preview"
  local url = string.format(
    "https://github.com/feng409/s3-md-preview.nvim/releases/download/v%s/md-preview-%s.tar.gz",
    version,
    target
  )
  local tmp = vim.fn.tempname() .. ".tar.gz"

  print("[md-preview] Downloading pre-built binary for " .. target)
  local ok = run(string.format('curl -fsSL -o "%s" "%s"', tmp, url))
  if not ok then
    os.remove(tmp)
    return false
  end

  ok = run(string.format('tar xzf "%s" -C "%s"', tmp, bin_dir))
  os.remove(tmp)
  if not ok then
    return false
  end

  if vim.fn.filereadable(dest) ~= 1 then
    print("[md-preview] Binary not found after extraction")
    return false
  end

  run(string.format('chmod +x "%s"', dest))
  print("[md-preview] Installed pre-built binary to " .. dest)
  return true
end

local function build_from_source()
  local dir = plugin_dir()
  print("[md-preview] Building from source with cargo in " .. dir)
  local ok = run(string.format('cargo build --release --manifest-path "%s/Cargo.toml"', dir))
  if not ok then
    vim.api.nvim_err_writeln("[md-preview] cargo build failed")
    return false
  end

  local bin_dir = ensure_bin_dir()
  local src = plugin_dir() .. "/target/release/md-preview"
  local dest = bin_dir .. "/md-preview"

  if vim.fn.filereadable(src) ~= 1 then
    vim.api.nvim_err_writeln("[md-preview] Built binary not found at " .. src)
    return false
  end

  ok = run(string.format('cp "%s" "%s"', src, dest))
  if not ok then
    return false
  end

  run(string.format('chmod +x "%s"', dest))
  print("[md-preview] Installed binary to " .. dest)
  return true
end

local target = rust_target()
local version = read_version()

if not target then
  print("[md-preview] Unsupported platform, falling back to cargo build")
  if not build_from_source() then
    os.exit(1)
  end
  return
end

print("[md-preview] Platform: " .. target)

if version and download_binary(target, version) then
  return
end

print("[md-preview] Pre-built binary unavailable, building from source")
if not build_from_source() then
  os.exit(1)
end
