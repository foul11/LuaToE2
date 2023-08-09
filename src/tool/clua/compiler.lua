#!/bin/env lua

-- local argv = { ... }
-- local argc = select('#', ...)
local parser = require('dumbparser')
local F = string.format

-- if argc < 1 then
	-- return print([[Help:
    -- ./compiler.lua [filein] [fileout]
-- ]])
-- end


-- local out = argv[2] or 'out.txt'
-- local file = io.open(argv[1], 'r')
-- local code = file:read('*a')

-- file:close()

local _LUA_TYPES = {
	USERDATA = 1,
	FUNCTION = 2,
	BOOLEAN  = 3,
	STRING   = 4,
	NUMBER   = 5,
	THREAD   = 6,
	TABLE    = 7,
	NIL      = 8,
}

local _CLUA_INST = {
	EXT_CALL    = 1 , -- statments
	CALL        = 2 ,
	DECLARATION = 3 ,
	ASSIGMENT   = 4 ,
	CONTINUE    = 5 , -- GLUA
	BREAK       = 6 ,
	RETURN      = 7 ,
	LABEL       = 8 ,
	GOTO        = 9 ,
	BLOCK       = 10,
	IF          = 11,
	FOR         = 12,
	WHILE       = 13,
	REPEAT      = 14,
	
	IDENTIFIER  = 15, -- expression
	VARARG      = 16,
	LITERAL     = 17,
	TABLE       = 18,
	LOOKUP      = 19,
	UNARY       = 20,
	BINARY      = 21,
	FUNCTION    = 22,
	
	CTX         = 23, -- for internal
}

local _CLUA_BINARY = {
	["+"]   = 1 , --#ADD     +
	["-"]   = 2 , --#SUB     -
	["*"]   = 3 , --#MUL     *
	["/"]   = 4 , --#DIV     /
	["^"]   = 5 , --#	     ^  - skip
	["//"]  = 6 , --#	     // - skip
	["%"]   = 7 , --#MOD     %
	["&"]   = 8 , --#	     &  - skip
	["~"]   = 9 , --#	     ~  - skip
	["|"]   = 10, --#	     |  - skip
	[">>"]  = 11, --#	     >> - skip
	["<<"]  = 12, --#	     << - skip
	[".."]  = 13, --#CNC     ..
	["<"]   = 14, --#LS      <
	[">"]   = 15, --#GR      >
	["<="]  = 16, --#EQLS    <=
	[">="]  = 17, --#EQGR    >=
	["=="]  = 18, --#EQ      ==
	["~="]  = 19, --#NEQ     ~=
	["and"] = 20, --#AND     and
	["or"]  = 21, --#OR      or
}

local _CLUA_UNARY = {
	['-']   = 1, --#NEG    -
	['not'] = 2, --#NOT    not
	['!']   = 2, --#NOT    ! - glua
	['#']   = 3, --#SHP    #
	['~']   = 4, --#       ~ - skip
}

local code = io.read('*a')

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

local buff = table.insert

local function _compileE2_Expressions(ast)
	local Ret = {}
	local Type = ast.type
	
	buff(Ret, F('table("_Type" = %s, ', _CLUA_INST[Type:upper()]))
		if Type == 'literal' then
			if isnumber(ast.value) then
				buff(Ret, F('1 = '))
				buff(Ret, F('%s', _LUA_TYPES[type(ast.value):upper()]))
				buff(Ret, F(', 2 = '))
				buff(Ret, ast.value)
			elseif isstring(ast.value) then
				buff(Ret, F('1 = '))
				buff(Ret, F('%s', _LUA_TYPES[type(ast.value):upper()]))
				buff(Ret, F(', 2 = '))
				buff(Ret, F("%q", ast.value))
			elseif isboolean(ast.value) then
				buff(Ret, F('1 = '))
				buff(Ret, F('%s', _LUA_TYPES[type(ast.value):upper()]))
				buff(Ret, F(', 2 = '))
				buff(Ret, ast.value and '1' or '0')
			elseif isnil(ast.value) then
				buff(Ret, F('1 = '))
				buff(Ret, F('%s', _LUA_TYPES[type(ast.value):upper()]))
			end
		elseif Type == 'identifier' then
			buff(Ret, F('1 = '))
			buff(Ret, F("%q", ast.name))
		elseif Type == 'binary' then
			buff(Ret, '1 = ')
			buff(Ret, _CLUA_BINARY[ast.operator])
			buff(Ret, ', 2 = ')
			buff(Ret, _compileE2_Expressions(ast.left))
			buff(Ret, ', 3 = ')
			buff(Ret, _compileE2_Expressions(ast.right))
		elseif Type == 'unary' then
			buff(Ret, '1 = ')
			buff(Ret, _CLUA_UNARY[ast.operator])
			buff(Ret, ', 2 = ')
			buff(Ret, _compileE2_Expressions(ast.expression))
		end
	buff(Ret, ')')
	
	return table.concat(Ret, '')
end

local function _compileE2_Statements(ast)
	local Ret = {}
	local Type = ast.type
	
	buff(Ret, F('table("_Type" = %s, ', _CLUA_INST[Type:upper()]))
		if Type == 'block' then
			local Count = #ast.statements
			
			for k,v in ipairs(ast.statements) do
				buff(Ret, F('%s = ', k))
				buff(Ret, _compileE2_Statements(v))
				
				if k ~= Count then
					buff(Ret, ', ')
				end
			end
		elseif Type == 'call' then
			buff(Ret, '1 = ')
			buff(Ret, _compileE2_Expressions(ast.callee))
			buff(Ret, ', 2 = table(')
				local Count = #ast.arguments
				
				for k,v in ipairs(ast.arguments) do
					buff(Ret, F('%s = ', k))
					buff(Ret, _compileE2_Expressions(v))
					
					if k ~= Count then
						buff(Ret, ', ')
					end
				end
			buff(Ret, ')')
		end
	buff(Ret, ')')
	
	return table.concat(Ret, '')
end

local function compileE2(ast)
	return [[
@name clua_compiler_output
@persist [Instace Ctx]:table

#include "lua/clua"

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

-- local file = io.open(out, 'w')
-- if not file then
	-- return print('failed open to write ', out)
-- end

-- file:write(compileE2(ast))
-- file:close()

parser.printTree(ast)

io.write(compileE2(ast))


-- print(code)