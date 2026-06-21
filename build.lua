local function plugin_dir()
  return vim.fn.fnamemodify(debug.getinfo(1, "S").source:sub(2), ":h")
end

local function run(cmd)
  print("[md-preview] " .. cmd)
  local out = vim.fn.system(cmd)
  if vim.v.shell_error ~= 0 then
    vim.api.nvim_err_writeln(out)
    return false, out
  end
  return true, out
end

local function require_executable(name)
  if vim.fn.executable(name) ~= 1 then
    vim.api.nvim_err_writeln("[md-preview] Required executable not found: " .. name)
    return false
  end
  return true
end

local function node_major()
  local out = vim.fn.system("node --version")
  return tonumber(out:match("v(%d+)"))
end

local function build_node_cli()
  local dir = plugin_dir()
  if not require_executable("node") or not require_executable("npm") then
    return false
  end

  local major = node_major()
  if not major or major < 20 then
    vim.api.nvim_err_writeln("[md-preview] Node.js >= 20 is required")
    return false
  end

  local package_lock = dir .. "/package-lock.json"
  local install_cmd = vim.fn.filereadable(package_lock) == 1 and "npm ci" or "npm install"

  local ok = run(string.format('cd "%s" && %s', dir, install_cmd))
  if not ok then
    return false
  end

  ok = run(string.format('cd "%s" && npm run build', dir))
  if not ok then
    return false
  end

  local bin = dir .. "/bin/md-preview"
  if vim.fn.executable(bin) ~= 1 then
    vim.api.nvim_err_writeln("[md-preview] Built CLI is not executable: " .. bin)
    return false
  end

  print("[md-preview] Installed Node CLI to " .. bin)
  return true
end

if not build_node_cli() then
  os.exit(1)
end
