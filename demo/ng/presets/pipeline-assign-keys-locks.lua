-- Assign Keys & Locks - Pipeline Step 3
-- Calls keylock plugin to assign keys and locks for progression
-- Inputs: src, keysQuery, keyChance, lockChance, maxKeysPerLock
-- Outputs: src (success), error (failure)

local src = inputs[1]
if src == nil or src == "" then
	src = "progression.tree.json"
end
local keysQuery = inputs[2]
if keysQuery == nil or keysQuery == "" then
	keysQuery = "SELECT name FROM keys ORDER BY RANDOM() LIMIT 15"
end
local keyChance = inputs[3]
if keyChance == nil or keyChance == "" then
	keyChance = "0.5"
end
local lockChance = inputs[4]
if lockChance == nil or lockChance == "" then
	lockChance = "0.7"
end
local maxKeysPerLock = inputs[5]
if maxKeysPerLock == nil or maxKeysPerLock == "" then
	maxKeysPerLock = "2"
end

local payload = {
	src = src,
	keysQuery = keysQuery,
	keyChance = tonumber(keyChance) or 0.5,
	lockChance = tonumber(lockChance) or 0.7,
	maxKeysPerLock = tonumber(maxKeysPerLock) or 2,
}

local resultText = host.awaitCall("keylock", "gen", json.encode(payload))
local ok, response = pcall(json.decode, resultText)
if not ok then
	outputs[1] = ""
	outputs[2] = "Failed to parse plugin response: " .. (resultText:sub(1, 100))
	return
end

if response.success then
	outputs[1] = src -- Return the tree source path
	outputs[2] = "" -- No error
else
	outputs[1] = "" -- No source path on error
	outputs[2] = response.error or "Unknown error"
end

