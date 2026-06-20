local M = {}

local config = require("md-preview.config")

local function plugin_dir()
  return vim.fn.fnamemodify(debug.getinfo(1, "S").source:sub(2), ":h:h:h")
end

local function osc52_copy(text)
  local ok, b64 = pcall(vim.base64.encode, text)
  if not ok then
    return
  end
  pcall(function()
    local tty = io.open("/dev/tty", "w")
    if tty then
      tty:write(("\027]52;c;%s\027\\"):format(b64))
      tty:flush()
      tty:close()
    end
  end)
end

function M.setup(opts)
  config.setup(opts)

  vim.api.nvim_create_user_command("Md", function()
    M.preview()
  end, { desc = "Preview markdown (auto-detect mode)" })

  vim.api.nvim_create_user_command("MdLocal", function()
    M.preview("local")
  end, { desc = "Preview markdown to local file" })

  vim.api.nvim_create_user_command("MdUpload", function()
    M.preview("s3")
  end, { desc = "Preview markdown via S3 upload" })
end

function M.resolve_bin()
  local opts = config.get()

  if opts.bin then
    return opts.bin
  end

  local dir = plugin_dir()
  local candidates = {
    dir .. "/bin/md-preview",
    dir .. "/target/release/md-preview",
  }

  for _, path in ipairs(candidates) do
    if vim.fn.executable(path) == 1 then
      return path
    end
  end

  local path_bin = vim.fn.exepath("md-preview")
  if path_bin ~= "" then
    return path_bin
  end

  return nil
end

function M.preview(mode)
  if vim.bo.filetype ~= "markdown" then
    vim.notify("Not a markdown buffer", vim.log.levels.WARN)
    return
  end

  local bin = M.resolve_bin()
  if not bin then
    vim.notify("md-preview binary not found", vim.log.levels.ERROR)
    return
  end

  local cfg = config.get()

  if not mode then
    if cfg.s3 and cfg.s3.bucket then
      mode = "s3"
    else
      mode = "local"
    end
  end

  if mode == "s3" then
    if not cfg.s3 or not cfg.s3.bucket then
      vim.notify("S3 is not configured", vim.log.levels.ERROR)
      return
    end
  end

  local lines = vim.api.nvim_buf_get_lines(0, 0, -1, false)
  local content = table.concat(lines, "\n")

  local title = vim.fn.expand("%:t"):gsub("%.md$", "")
  if title == "" then
    title = "preview"
  end

  local cmd = { bin, "--title", title }

  if mode == "local" then
    vim.list_extend(cmd, { "--output-dir", cfg.output_dir })
  elseif mode == "s3" then
    local s3 = cfg.s3
    vim.list_extend(cmd, {
      "--bucket", s3.bucket,
      "--endpoint", s3.endpoint,
      "--region", s3.region,
      "--key-prefix", s3.key_prefix or "md-preview/",
    })

    if s3.acl then
      vim.list_extend(cmd, { "--acl", s3.acl })
    end

    local creds = cfg.credentials
    if creds and creds.env_file then
      vim.list_extend(cmd, {
        "--env-file", vim.fn.expand(creds.env_file),
        "--id-key", creds.id_key,
        "--secret-key", creds.secret_key,
      })
    end
  end

  local job_env = nil
  if cfg.no_proxy then
    job_env = {}
    local proxy_keys = {
      HTTPS_PROXY = true,
      HTTP_PROXY = true,
      ALL_PROXY = true,
      https_proxy = true,
      http_proxy = true,
      all_proxy = true,
    }
    for k, v in pairs(vim.fn.environ()) do
      if proxy_keys[k] then
        job_env[k] = ""
      else
        job_env[k] = v
      end
    end
  end

  vim.notify("Rendering " .. title .. "...")

  local stdout_lines = {}
  local stderr_lines = {}

  local job_opts = {
    stdin = "pipe",
    stdout_buffered = true,
    stderr_buffered = true,
    on_stdout = function(_, data)
      if data then
        for _, line in ipairs(data) do
          if line ~= "" then
            table.insert(stdout_lines, line)
          end
        end
      end
    end,
    on_stderr = function(_, data)
      if data then
        for _, line in ipairs(data) do
          if line ~= "" then
            table.insert(stderr_lines, line)
          end
        end
      end
    end,
    on_exit = function(_, code)
      vim.schedule(function()
        if code == 0 then
          local output = nil
          for _, line in ipairs(stdout_lines) do
            if line:match("^https?://") or line:match("^/") then
              output = line
              break
            end
          end
          if not output and #stdout_lines > 0 then
            output = stdout_lines[#stdout_lines]
          end
          if output then
            vim.notify("Preview ready: " .. output, vim.log.levels.INFO)
            osc52_copy(output)
          else
            vim.notify("Preview completed but no output path found", vim.log.levels.WARN)
          end
        else
          local err = table.concat(stderr_lines, "\n")
          if err == "" then
            err = "md-preview exited with code " .. code
          end
          vim.notify("Preview failed: " .. err, vim.log.levels.ERROR)
        end
      end)
    end,
  }

  if job_env then
    job_opts.env = job_env
  end

  local job_id = vim.fn.jobstart(cmd, job_opts)
  if job_id <= 0 then
    vim.notify("Failed to start md-preview", vim.log.levels.ERROR)
    return
  end

  vim.fn.chansend(job_id, content)
  vim.fn.chanclose(job_id, "stdin")
end

return M
