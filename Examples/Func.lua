-- function da(A,B,C)
	-- return 1 + 2
-- end

aaa = 0

function da()
	aaa = aaa + 1
	print(aaa)
	return (aaa ~= 3) and (1 + da()) or 0
end

-- function da(A,B,C)
	-- return A + C
-- end

print(da())