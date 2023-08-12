-- ltime = SysTime()
-- i = 0

-- while true do
	-- if i == 50 then
		-- break
	-- end
	
	-- i = i + 1
-- end

-- print(SysTime() - ltime)


function da(depth)
	depth = depth + 1
	return (depth ~= 5) and (1 + da(depth)) or 1
end


print(da(0))
