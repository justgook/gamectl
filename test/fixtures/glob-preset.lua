local presetPath = "examples/demo/ng/presets/glob.lua"

local function run(pattern, directories, stats)
  inputs = { pattern }
  outputs = {}
  host = {
    call = function(target, path)
      assert(target == "fs/fs::list" or target == "fs/fs::stat", "unexpected target: " .. tostring(target))
      if target == "fs/fs::list" then
        local entries = directories[path]
        assert(entries, "unexpected list path: " .. tostring(path))
        return entries
      end
      local stat = stats[path]
      assert(stat, "unexpected stat path: " .. tostring(path))
      if stat.error then error(stat.error) end
      return stat
    end,
  }

  local chunk = assert(loadfile(presetPath))
  chunk()
  return outputs[1]
end

local paths = run("anim/c11/run/*.png", {
  [""] = {
    { name = "anim", type = "symbolic-link" },
    { name = "assets", type = "directory" },
  },
  ["anim"] = { { name = "c11", type = "directory" } },
  ["anim/c11"] = { { name = "run", type = "directory" } },
  ["anim/c11/run"] = {
    { name = "0002.png", type = "regular-file" },
    { name = "notes.txt", type = "regular-file" },
    { name = "0001.png", type = "regular-file" },
  },
}, {
  ["anim"] = { type = "directory" },
})

assert(#paths == 2, "expected two PNG paths")
assert(paths[1] == "anim/c11/run/0001.png", "expected sorted first PNG path")
assert(paths[2] == "anim/c11/run/0002.png", "expected sorted second PNG path")

local ok, message = pcall(run, "broken/files/*.png", {
  [""] = { { name = "broken", type = "symbolic-link" } },
}, {
  ["broken"] = { error = "no-entry" },
})
assert(not ok, "expected an unresolved matched symlink to fail")
assert(tostring(message):find("failed to resolve symbolic link 'broken': no%-entry"), tostring(message))
