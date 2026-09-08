local symbols = inputs[1]
if type(symbols) ~= "table" or type(symbols.entities) ~= "table" or type(symbols.words) ~= "table" then
	error("Station Bindings requires compiler symbols.entities and symbols.words")
end

local function require_id(group, name)
	local value = symbols[group][name]
	if type(value) ~= "number" or value < 0 or value > 0xffffffff or value ~= math.floor(value) then
		error("missing or invalid uint32 compiler symbol: " .. group .. "." .. name)
	end
	return value
end

-- Entity output names follow game/CONTRACT.md; lookup names are the compiler's
-- canonical lowercase metadata keys. Values are never authored numeric IDs.
outputs[1] = {
	{kind = "Entity", name = "PLAYER", value = require_id("entities", "player")},
	{kind = "Entity", name = "POWER_SWITCH", value = require_id("entities", "power_switch")},
	{kind = "Entity", name = "ACCESS_KEY", value = require_id("entities", "access_key")},
	{kind = "Entity", name = "EXIT", value = require_id("entities", "exit")},
	{kind = "Word", name = "powered", value = require_id("words", "powered")},
	{kind = "Word", name = "carrying_key", value = require_id("words", "carrying_key")},
	{kind = "Word", name = "locked", value = require_id("words", "locked")},
}
