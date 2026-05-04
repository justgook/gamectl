if ctx == nil or ctx.activeView == nil or ctx.activeView.id == nil or ctx.activeView.id == '' then
  error('save-active-view requires ctx.activeView.id')
end

-- Do not call the view plugin directly from Lua here. Lua runs on the worker
-- thread; view save methods may call back into worker plugins such as sql/fs,
-- which would deadlock the synchronous host.call bridge. Return a command for
-- ui.keys to dispatch asynchronously on the main thread after Lua exits.
output = {
  call = { ctx.activeView.id, 'save', '{}' },
}
