function main()
	if ctx.key ~= nil and ctx.key.inTextInput then
		return {
			call = { "ui.keys.blurActiveElement" },
		}
	end

	local popup = host.call("ui.popup.isOpen", {})
	if popup.count > 0 then
		return {
			call = { "ui.popup.closeTop", { ok = false, cancelled = true, reason = "escape" } },
		}
	end

	if ctx.activeView == nil or ctx.activeView.id == nil or ctx.activeView.id == "" then
		error("escape shortcut requires ctx.activeView.id when no popup is open")
	end

	return {
		call = { "activeView.clearSelection" },
	}
end
