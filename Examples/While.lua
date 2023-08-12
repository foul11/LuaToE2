a = 1

while a ~= 4 do -- 1,2,3
	print(a)
	a = a + 1
end

a = 1

while a == 1 do -- 1
	print(a)
	a = a + 1
end

a = 1

while false do
	print(a)
	a = a + 1
end

while true do
	print("while true") -- execute
	
	if true then
		break
	end
	
	print("No while true") -- not execute
end