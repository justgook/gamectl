if ctx == nil or ctx.activeView == nil or ctx.activeView.id == nil or ctx.activeView.id == '' then
  error('save-active-view requires ctx.activeView.id')
end

host.call(ctx.activeView.id, 'save', '{}')
