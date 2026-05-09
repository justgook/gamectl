local popup = json.decode(host.call('ui.popup', 'isOpen', '{}'))
if popup == nil or popup.count == nil then
  error('escape shortcut requires ui.popup.isOpen count')
end

if popup.count > 0 then
  output = {
    call = { 'ui.popup', 'closeTop', '{"ok":false,"cancelled":true,"reason":"escape"}' },
  }
  return
end

if ctx.key ~= nil and ctx.key.inTextInput then
  output = nil
  return
end

if ctx.activeView == nil or ctx.activeView.id == nil or ctx.activeView.id == '' then
  error('escape shortcut requires ctx.activeView.id when no popup is open')
end

output = {
  call = { ctx.activeView.id, 'clearSelection', '{}' },
}
