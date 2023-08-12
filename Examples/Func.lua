function da(A,B,C)
	return 1 + 2
end

print(da(1,2,3)) -- 3

function da(depth)
	depth = depth + 1
	return (depth ~= 5) and (1 + da(depth)) or 1
end

print(da(1,2,3)) -- 4

function da(A,B,C)
	return A + C
end

print(da(1,2,3)) -- 4
