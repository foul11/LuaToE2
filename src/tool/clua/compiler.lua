#!/bin/env lua

local out = 'out.txt'
local argv = { ... }
local argc = select('#', ...)
local parser = require('dumbparser')
local F = string.format

if argc < 1 then
	return print([[Help:
    ./compiler.lua [filename]
]])
end


local file = io.open(argv[1], 'r')
local code = file:read('*a')

file:close()

local ast = parser.parse(code)

local function isnumber(val)
	return type(val) == "number"
end

local function isstring(val)
	return type(val) == "string"
end

local function isboolean(val)
	return type(val) == "boolean"
end

local function isnil(val)
	return type(val) == "nil"
end

local function _compileE2_Expressions(ast)
	local Ret = {}
	local Type = ast.type
	
	table.insert(Ret, F('table("_Type" = "%s", ', Type))
		if Type == 'literal' then
			if isnumber(ast.value) then
				table.insert(Ret, '1 = ')
				table.insert(Ret, F('%q', type(ast.value)))
				table.insert(Ret, ', 2 = ')
				table.insert(Ret, ast.value)
			elseif isstring(ast.value) then
				table.insert(Ret, '1 = ')
				table.insert(Ret, F('%q', type(ast.value)))
				table.insert(Ret, ', 2 = ')
				table.insert(Ret, F("%q", ast.value))
			elseif isboolean(ast.value) then
				table.insert(Ret, '1 = ')
				table.insert(Ret, F('%q', type(ast.value)))
				table.insert(Ret, ', 2 = ')
				table.insert(Ret, ast.value and '1' or '0')
			elseif isnil(ast.value) then
				table.insert(Ret, '1 = ')
				table.insert(Ret, F('%s', type(ast.value)))
			end
		elseif Type == 'identifier' then
			table.insert(Ret, '1 = ')
			table.insert(Ret, F("%q", ast.name))
		end
	table.insert(Ret, ')')
	
	return table.concat(Ret, '')
end

local function _compileE2_Statements(ast)
	local Ret = {}
	local Type = ast.type
	
	table.insert(Ret, F('table("_Type" = "%s", ', Type))
		if Type == 'block' then
			local Count = #ast.statements
			
			for k,v in ipairs(ast.statements) do
				table.insert(Ret, F('%s = ', k))
				table.insert(Ret, _compileE2_Statements(v))
				
				if k ~= Count then
					table.insert(Ret, ', ')
				end
			end
		elseif Type == 'call' then
			table.insert(Ret, '1 = ')
			table.insert(Ret, _compileE2_Expressions(ast.callee))
			table.insert(Ret, ', 2 = table(')
				local Count = #ast.arguments
				
				for k,v in ipairs(ast.arguments) do
					table.insert(Ret, F('%s = ', k))
					table.insert(Ret, _compileE2_Expressions(v))
					
					if k ~= Count then
						table.insert(Ret, ', ')
					end
				end
			table.insert(Ret, ')')
		end
	table.insert(Ret, ')')
	
	return table.concat(Ret, '')
end

local function compileE2(ast)
	return [[
@name clua_compile_output
@persist [Instace Ctx]:table

#include "lua/clua"
#include "lua/clua_env"

if(first()){
    local Code = ]] .. _compileE2_Statements(ast) .. [[ 
    Instace = cluaInstance()
    Func = Instace:cluaToFunc(Code)
    Ctx = Func:cluaCreateFuncContext()
    
    runOnTick(1)
}

if(tickClk()){
    if(Ctx:cluaContextExecute(80)){
        runOnTick(0)
    }
}
]]
end

parser.updateReferences(ast, false)

local file = io.open(out, 'w')
if not file then
	return print('failed open to write ', out)
end

file:write(compileE2(ast))
file:close()

parser.printTree(ast)


-- print(code)