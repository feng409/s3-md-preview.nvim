local M = {}

M.defaults = {
  bin = nil,
  output_dir = vim.fn.stdpath("cache") .. "/md-preview",
  s3 = nil,
  no_proxy = true,
}

function M.setup(opts)
  M.options = vim.tbl_deep_extend("force", {}, M.defaults, opts or {})
  if not M.options.s3 and vim.env.MD_PREVIEW_BUCKET then
    M.options.s3 = {}
  end
end

function M.get()
  return M.options or M.defaults
end

return M
