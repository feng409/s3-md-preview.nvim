local M = {}

local function plugin_dir()
  return vim.fn.fnamemodify(debug.getinfo(1, "S").source:sub(2), ":h:h:h")
end

local function plugin_version()
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

local function parse_version(output)
  if not output or output == "" then
    return nil
  end
  return output:match("(%d+%.%d+%.%d+)") or output:match("^%s*(%S+)%s*$")
end

local function run_version(bin)
  local lines = {}
  local job_id = vim.fn.jobstart({ bin, "--version" }, {
    stdout_buffered = true,
    stderr_buffered = true,
    on_stdout = function(_, data)
      if data then
        vim.list_extend(lines, data)
      end
    end,
  })
  if job_id <= 0 then
    return nil
  end
  vim.fn.jobwait({ job_id }, 5000)
  return parse_version(table.concat(lines, ""))
end

local function dir_writable(path)
  if vim.fn.isdirectory(path) ~= 1 then
    local ok = pcall(vim.fn.mkdir, path, "p")
    if not ok then
      return false
    end
  end
  local test = path .. "/.write_test"
  local fh = io.open(test, "w")
  if not fh then
    return false
  end
  fh:close()
  os.remove(test)
  return true
end

function M.check()
  vim.health.start("md-preview")

  local init = require("md-preview.init")
  local config = require("md-preview.config").get()
  local bin = init.resolve_bin()

  if not bin then
    vim.health.error("md-preview binary not found")
  elseif vim.fn.executable(bin) ~= 1 then
    vim.health.error("Binary is not executable: " .. bin)
  else
    vim.health.ok("Binary found: " .. bin)

    local bin_ver = run_version(bin)
    if not bin_ver then
      vim.health.warn("Could not determine binary version")
    else
      local plug_ver = plugin_version()
      if plug_ver and bin_ver ~= plug_ver then
        vim.health.warn("Binary version " .. bin_ver .. " does not match plugin version " .. plug_ver)
      else
        vim.health.ok("Binary version: " .. bin_ver)
      end
    end
  end

  if config.s3 and config.s3.bucket then
    vim.health.start("S3 configuration")

    local creds = config.credentials
    if creds and creds.env_file then
      local env_path = vim.fn.expand(creds.env_file)
      if vim.fn.filereadable(env_path) ~= 1 then
        vim.health.error("Credentials env file not readable: " .. env_path)
      else
        vim.health.ok("Credentials env file readable: " .. env_path)
      end
    else
      vim.health.warn("No credentials.env_file configured for S3")
    end
  end

  vim.health.start("Local output")

  local out_dir = config.output_dir
  if dir_writable(out_dir) then
    vim.health.ok("Output directory writable: " .. out_dir)
  else
    vim.health.error("Output directory not writable: " .. out_dir)
  end
end

return M
