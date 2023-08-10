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

local function quote(str)
	return F('%q', str)
end

local buff = table.insert
-- local buffNl = function(ret) end -- inline
local buffNl  = function(ret, depth) buff(ret, '\n') buff(ret, ('      '):rep(depth))  end -- pretty
local buffCom = function(ret, msg)   buff(ret, F(' #[ %s ]#', msg))                    end -- comment

local _compileE2_Expressions
local function _compileE2_call_part(ast, depth)
	local Ret = {}
	
	buff(Ret, '1 = ')
	buff(Ret, _compileE2_Expressions(ast.callee, depth))
	buff(Ret, ',')
	buffNl(Ret, depth)
	
	do
		local Count = #ast.arguments
		local depth = depth + 1
		
		buff(Ret, '2 = table(')
			buffNl(Ret, depth)
			
			for k,v in ipairs(ast.arguments) do
				buff(Ret, k)
				buff(Ret, ' = ')
				buff(Ret, _compileE2_Expressions(v, depth))
				
				if k ~= Count then
					buff(Ret, ',')
					buffNl(Ret, depth - 1)
				end
			end
		buffNl(Ret, depth - 1)
		buff(Ret, ')')
	end
	
	if #Ret == 0 then
		error('parsed 0 call')
	end
	
	return table.concat(Ret, '')
end

function _compileE2_Expressions(ast, depth)
	local Ret = {}
	local Type = ast.type
	local depth = (depth or 0) + 1
	
	buff(Ret, 'table(')
	buffNl(Ret, depth)
	
	buff(Ret, '"_Type" = ')
	buff(Ret, _CLUA_INST[Type:upper()])
	buff(Ret, ',')
	buffCom(Ret, Type:upper())
	buffNl(Ret, depth)
		if Type == 'literal' then
			if isnumber(ast.value) then
				buff(Ret, '1 = ')
				buff(Ret, _LUA_TYPES[type(ast.value):upper()])
				buff(Ret, ',')
				buffNl(Ret, depth)
				
				buff(Ret, '2 = ')
				buff(Ret, ast.value)
			elseif isstring(ast.value) then
				buff(Ret, '1 = ')
				buff(Ret, _LUA_TYPES[type(ast.value):upper()])
				buff(Ret, ',')
				buffNl(Ret, depth)
				
				buff(Ret, '2 = ')
				buff(Ret, quote(ast.value))
			elseif isboolean(ast.value) then
				buff(Ret, '1 = ')
				buff(Ret, _LUA_TYPES[type(ast.value):upper()])
				buff(Ret, ',')
				buffNl(Ret, depth)
				
				buff(Ret, '2 = ')
				buff(Ret, ast.value and '1' or '0')
			elseif isnil(ast.value) then
				buff(Ret, '1 = ')
				buff(Ret, _LUA_TYPES[type(ast.value):upper()])
			end
		elseif Type == 'identifier' then
			buff(Ret, '1 = ')
			buff(Ret, quote(ast.name))
		elseif Type == 'call' then
			buff(Ret, _compileE2_call_part(ast, depth))
		elseif Type == 'binary' then
			buff(Ret, '1 = ')
			buff(Ret, _CLUA_BINARY[ast.operator])
			buff(Ret, ',')
			buffNl(Ret, depth)
			
			buff(Ret, '2 = ')
			buff(Ret, _compileE2_Expressions(ast.left, depth))
			buff(Ret, ',')
			buffNl(Ret, depth)
			
			buff(Ret, '3 = ')
			buff(Ret, _compileE2_Expressions(ast.right, depth))
		elseif Type == 'unary' then
			buff(Ret, '1 = ')
			buff(Ret, _CLUA_UNARY[ast.operator])
			buff(Ret, ',')
			buffNl(Ret, depth)
			
			buff(Ret, '2 = ')
			buff(Ret, _compileE2_Expressions(ast.expression, depth))
		elseif Type == 'table' then
			local Count = #ast.fields
			local depth = depth + 1
			
			buff(Ret, '1 = table(')
			buffNl(Ret, depth)
			for k,v in ipairs(ast.fields) do
				local depth = depth + 1
				
				buff(Ret, k)
				buff(Ret, ' = table(')
					buffNl(Ret, depth)
					
					if v.key and not v.generatedKey then
						buff(Ret, '1 = ')
						buff(Ret, _compileE2_Expressions(v.key, depth))
						buff(Ret, ',')
						buffNl(Ret, depth)
					end
					
					buff(Ret, '2 = ')
					buff(Ret, _compileE2_Expressions(v.value, depth))
					buff(Ret, ',')
					buffNl(Ret, depth)
					
					buff(Ret, '3 = ')
					buff(Ret, v.generatedKey and '1' or '0')
				buffNl(Ret, depth - 1)
				buff(Ret, ')')
				
				if k ~= Count then
					buff(Ret, ',')
					buffNl(Ret, depth - 1)
				end
			end
			buffNl(Ret, depth - 1)
			buff(Ret, ')')
		elseif Type == 'lookup' then
			buff(Ret, '1 = ')
			buff(Ret, _compileE2_Expressions(ast.object, depth))
			buff(Ret, ',')
			buffNl(Ret, depth)
			
			buff(Ret, '2 = ')
			buff(Ret, _compileE2_Expressions(ast.member, depth))
		end
	buffNl(Ret, depth - 1)
	buff(Ret, ')')
	
	if #Ret == 0 then
		error('parsed 0 expr')
	end
	
	return table.concat(Ret, '')
end

local function _compileE2_Statements(ast, depth)
	local Ret = {}
	local Type = ast.type
	local depth = (depth or 0) + 1
	
	buff(Ret, 'table(')
	buffNl(Ret, depth)
	
	buff(Ret, '"_Type" = ')
	buff(Ret, _CLUA_INST[Type:upper()])
	buff(Ret, ',')
	buffCom(Ret, Type:upper())
	buffNl(Ret, depth)
		if Type == 'block' then
			local Count = #ast.statements
			
			for k,v in ipairs(ast.statements) do
				buff(Ret, k)
				buff(Ret, ' = ')
				buff(Ret, _compileE2_Statements(v, depth))
				
				if k ~= Count then
					buff(Ret, ',')
					buffNl(Ret, depth)
				end
			end
		elseif Type == 'call' then
			buff(Ret, _compileE2_call_part(ast, depth))
		end
	buffNl(Ret, depth - 1)
	buff(Ret, ')')
	
	if #Ret == 0 then
		error('parsed 0 stmt')
	end
	
	return table.concat(Ret, '')
end

local function compileE2(ast)
	return [[
@name clua_compiler_output
@persist [Instace Ctx]:table

#include "lua/clua"

if(first()){
    local Code = ]] .. _compileE2_Statements(ast, 1) .. '\n' .. [[
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

io.stdout:write(compileE2(ast))


-- print(code)