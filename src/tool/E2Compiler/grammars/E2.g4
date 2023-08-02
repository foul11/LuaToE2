grammar E2;
// for antlr-4.13.0-complete.jar
// parser grammar E2;

// options { tokenVocab=E2Lexer; }

/* IN JavaScript */
// @lexer::members {
//    this.WHITESPACE = this.constructor.channelNames.push("WHITESPACE") - 1
//    this.COMMENT = this.constructor.channelNames.push("COMMENT") - 1
// }

root : directive* stmts EOF ;
dmtr       : (WS | BLOCK_COMMENT | COMMENT_OR_INCLUDE | pp)+ ;
// dmtrNoPP       : (WS)+ ;
directive  : dmtr? (DIRECTIVE | DIRECTIVE_VARS dmtr? (t_function_arg dmtr? | t_function_args_typed dmtr?)* dmtr) dmtr? ;
t_comma    : dmtr? C_comma dmtr? ;
t_const    : lexem_string | lexem_number | lexem_constant ;

lexem_string   : STRING ;
lexem_number   : NUMBER ;
lexem_constant : CONSTANT ;

// t_function_vararg : C_vararg dmtr? VAR dmtr? C_col dmtr? t_type ;
// t_function_args
//    : dmtr? C_lbkt
//       (
//          (
//             (     ((t_function_arg (t_comma t_function_arg)*)?)
//                | dmtr? C_lsbkt ((VAR (dmtr VAR)*)? C_rsbkt (dmtr? C_col dmtr? t_type)?) dmtr?
//             )
//             (t_comma
//                (     ((t_function_arg (t_comma t_function_arg)*)?)
//                   | dmtr? C_lsbkt ((VAR (dmtr VAR)*)? C_rsbkt (dmtr? C_col dmtr? t_type)?) dmtr?
//                )
//             )*
//             (t_comma t_function_vararg dmtr?)?
//          ) | (dmtr? t_function_vararg dmtr?) | dmtr?
//       )
//       C_rbkt dmtr?
//    ;

t_function_arg    : dmtr? VAR (dmtr? C_col dmtr? t_type)? dmtr? ;
t_function_vararg : dmtr? C_vararg dmtr? VAR dmtr? C_col dmtr? t_type dmtr? ;
t_function_args_typed : dmtr? C_lsbkt dmtr? ((VAR ((dmtr | dmtr? C_comma dmtr?) VAR)*)? dmtr? C_rsbkt (dmtr? C_col dmtr? t_type)?) dmtr? ;
t_function_args
   : dmtr? C_lbkt
      (
         (((t_function_arg | t_function_args_typed) (t_comma (t_function_arg | t_function_args_typed))*)? (t_comma t_function_vararg)?)
         | t_function_vararg
         | dmtr?
      )
      C_rbkt dmtr?
   ;

t_function
   :   KW_function dmtr
      (t_type dmtr)?
      (t_type dmtr? C_col dmtr?)?
      t_fun_name
      t_function_args
      t_block
   ;

t_return      : KW_return (
               dmtr expr1
               // dmtr VAR | dmtr? t_const | 
               // dmtr LITERAL { this.getCurrentToken().text != 'void' }?
               // dmtr a=LITERAL (
               //     { a.getText() != 'void' }? LITERAL
               // )
               | dmtr LITERAL
            )? ;
t_condition   : dmtr? C_lbkt  expr C_rbkt  dmtr? ;
t_block       : dmtr? C_lfbkt stmts C_rfbkt dmtr? ;
t_kv          : expr (C_equal expr)? ;
t_args        : C_lbkt ((t_kv (t_comma t_kv)*)? | dmtr?) C_rbkt ;
t_call        : t_fun_name t_args ;
t_call_method : C_col t_call t_call_method? ;
// t_call_string : t_var t_args dmtr? (C_lsbkt dmtr? t_type dmtr? C_rsbkt t_call_method?)? ;
t_index       : C_lsbkt expr (t_comma t_type dmtr?)? C_rsbkt ;

t_if     : KW_if t_condition t_block t_elseif? ;
t_elseif : KW_elseif t_condition t_block t_elseif? | t_else ;
t_else   : KW_else t_block ;

t_switch       : KW_switch t_condition t_switch_block ;
t_switch_block : dmtr? C_lfbkt t_case_block+ C_rfbkt dmtr? ;
t_case_block   : dmtr? ((KW_case expr | KW_default) t_comma)+ stmts ;

t_while    : KW_while t_condition t_block ;
t_do_while : KW_do t_block KW_while t_condition ;
t_for
   :   KW_for dmtr?
      C_lbkt
      dmtr? VAR dmtr?
      (C_equal expr)
      (t_comma expr)
      (t_comma expr)?
      C_rbkt
      t_block
   ;
t_foreach
   :   KW_foreach dmtr?
      C_lbkt
      dmtr? VAR dmtr?
      (C_col dmtr? t_type)?
      (t_comma VAR dmtr? C_col dmtr? t_type dmtr?)
      C_equal
      expr
      C_rbkt
      t_block
   ;

t_try   : KW_try t_block KW_catch dmtr? C_lbkt dmtr? VAR dmtr? C_rbkt t_block ;
t_event : KW_event dmtr t_fun_name t_function_args t_block ;

// t_var : expr ;
// t_var // analog expr, to avoid complaining about recursion
//    : (VAR)
//    | (VAR (C_inc) | VAR (C_dec))
//    | (t_const | C_tilt VAR | C_delta VAR | C_inputs VAR)
//    | (C_lbkt dmtr? t_var? dmtr? C_rbkt | t_call)
//    | t_var (t_call_method | t_index)
//    | (C_plus | C_minus | C_not) t_var
//    ;
t_lassign : KW_local? t_assign ;
t_assign
   :   expr
      (C_equal | C_plus_eq | C_minus_eq | C_mul_eq | C_div_eq)
      (expr | t_assign)
   ;
   
t_fun_name : LITERAL ;
   
t_type
   : 
   LITERAL
   // LITERAL { this.getCurrentToken().text != 'void'       }?
   // | LITERAL { this.getCurrentToken().text != 'angle'      }?
   // | LITERAL { this.getCurrentToken().text != 'array'      }?
   // | LITERAL { this.getCurrentToken().text != 'bone'       }?
   // | LITERAL { this.getCurrentToken().text != 'complex'    }?
   // | LITERAL { this.getCurrentToken().text != 'effect'     }?
   // | LITERAL { this.getCurrentToken().text != 'entity'     }?
   // | LITERAL { this.getCurrentToken().text != 'matrix'     }?
   // | LITERAL { this.getCurrentToken().text != 'matrix2'    }?
   // | LITERAL { this.getCurrentToken().text != 'matrix4'    }?
   // | LITERAL { this.getCurrentToken().text != 'number'     }?
   // | LITERAL { this.getCurrentToken().text != 'quaternion' }?
   // | LITERAL { this.getCurrentToken().text != 'ranger'     }?
   // | LITERAL { this.getCurrentToken().text != 'string'     }?
   // | LITERAL { this.getCurrentToken().text != 'table'      }?
   // | LITERAL { this.getCurrentToken().text != 'vector'     }?
   // | LITERAL { this.getCurrentToken().text != 'vector2'    }?
   // | LITERAL { this.getCurrentToken().text != 'vector4'    }?
   // | LITERAL { this.getCurrentToken().text != 'wirelink'   }?
   ;


stmts
   : dmtr? (stmt1 ((dmtr | t_comma)? stmt1)*)? dmtr?
   ;
expr
   : dmtr? expr1 dmtr?
   ;
   
pp
   : PP_IFDEF
   // | COMMENT_OR_INCLUDE //PP_include
   | PP_ifdef | PP_ifndef
   | PP_endif
   ;
   
// Stmt6 : (Var ('++' | '--'))? Stmt7;
// Stmt7 : (Var ('+=' | '-=' | '*=' | '/='))? Stmt8;

t_incdec
   : VAR (C_inc | C_dec)
   ;

stmt1
   : expr1
   | t_lassign
   | t_if
   | t_switch
   | t_while
   | t_do_while
   | t_for
   | t_foreach
   | t_try
   | t_event
   | t_function
   | KW_break
   | KW_continue
   | t_return
   | t_incdec
   | dmtr // pp, in order not to write a handler for comments in statements
   ;
// expr1
//    : (VAR)
//    | (VAR (C_inc) | VAR (C_dec))
//    | (t_const | C_tilt VAR | C_delta VAR | C_inputs VAR)
//    | (C_lbkt dmtr? expr1? dmtr? C_rbkt | t_call)
//    | expr1 (t_call_method | t_index)
//    | t_call_string
//    | (C_plus | C_minus | C_not) expr1
//    | expr1 dmtr? ((C_pow)                                            dmtr? expr1)+
//    | expr1 dmtr? ((C_mul    | C_div | C_mod)                         dmtr? expr1)+
//    | expr1 dmtr? ((C_plus   | C_minus)                               dmtr? expr1)+
//    | expr1 dmtr? ((C_lshift | C_rshift)                              dmtr? expr1)+
//    | expr1 dmtr? ((C_less   | C_greater | C_less_eq | C_greater_eq)  dmtr? expr1)+
//    | expr1 dmtr? ((C_eq_eq  | C_not_eq)                              dmtr? expr1)+
//    | expr1 dmtr? ((C_bxor)                                           dmtr? expr1)+
//    | expr1 dmtr? ((C_band)                                           dmtr? expr1)+
//    | expr1 dmtr? ((C_bor)                                            dmtr? expr1)+
//    | expr1 dmtr? ((C_and)                                            dmtr? expr1)+
//    | expr1 dmtr? ((C_or)                                             dmtr? expr1)+
//    | expr1 dmtr? ((C_quest dmtr? expr1 dmtr? C_col dmtr? expr1) | (C_quest C_col dmtr? expr1))
//    | t_assign
//    ;

// expr1  : (VAR ~(C_equal | C_plus_eq | C_minus_eq | C_mul_eq | C_div_eq) | ~VAR .) dmtr? expr2 ;
t_call_str_part : t_args dmtr? (C_lsbkt dmtr? t_type dmtr? C_rsbkt t_call_method?)? ;

expr1  : expr2 ;
expr2  : expr3  (dmtr? ((C_quest dmtr? expr1 dmtr? C_col dmtr? expr1) | (C_quest C_col dmtr? expr1)))? ;
expr3  : expr4  (dmtr? (C_or)                                             dmtr? expr4 )* ;
expr4  : expr5  (dmtr? (C_and)                                            dmtr? expr5 )* ;
expr5  : expr6  (dmtr? (C_bor)                                            dmtr? expr6 )* ;
expr6  : expr7  (dmtr? (C_band)                                           dmtr? expr7 )* ;
expr7  : expr8  (dmtr? (C_bxor)                                           dmtr? expr8 )* ;
expr8  : expr9  (dmtr? (C_eq_eq  | C_not_eq)                              dmtr? expr9 )* ;
expr9  : expr10 (dmtr? (C_less   | C_greater | C_less_eq | C_greater_eq)  dmtr? expr10)* ;
expr10 : expr11 (dmtr? (C_lshift | C_rshift)                              dmtr? expr11)* ;
expr11 : expr12 (dmtr? (C_plus   | C_minus)                               dmtr? expr12)* ;
expr12 : expr13 (dmtr? (C_mul    | C_div | C_mod)                         dmtr? expr13)* ;
expr13 : expr14 (dmtr? (C_pow)                                            dmtr? expr14)* ;
expr14 : C_not expr14 | (C_plus | C_minus)? expr15;
expr15
   : expr16
         ( t_call_method
         | t_index
         | t_call_str_part
      )*
   ;
expr16 : C_lbkt dmtr? expr1 dmtr? C_rbkt | t_call | expr17 ;
expr17 : t_const | C_tilt VAR | C_delta VAR | C_inputs VAR | expr18 ;
// expr18 : (VAR ~(C_inc | C_dec) | ~VAR .) dmtr? expr19;
expr18 : expr19 ;
expr19 : VAR;

// Expr1 : ((Var '=') | (Var '+=') | (Var '-=') | (Var '*=') | (Var '/=')) Expr2;
// Expr2 : Expr3 (('?' Expr1 ':' Expr1) | ('?:' Expr1))?;
// Expr3 : Expr4 ('|' Expr4)*;
// Expr4 : Expr5 ('&' Expr5)*;
// Expr5 : Expr6 ('||' Expr6)*;
// Expr6 : Expr7 ('&&' Expr7)*;
// Expr7 : Expr8 ('^^' Expr8)*;
// Expr8 : Expr9 (('==' | '!=') Expr9)*;
// Expr9 : Expr10 (('>' | '<' | '>=' | '<=') Expr10)*;
// Expr10 : Expr11 (('<<' | '>>') Expr11)*;
// Expr11 : Expr12 (('+' | '-') Expr12)*;
// Expr12 : Expr13 (('*' | '/' | '%') Expr13)*;
// Expr13 : Expr14 ('^' Expr14)*;
// Expr14 : ('+' | '-' | '!') Expr15;
// Expr15 : Expr16 (MethodCallExpr | TableIndexExpr)*
// Expr16 : '(' Expr1 ')' | FunctionCallExpr | Expr17;
// Expr17 : Number | String | '~' Var | '$' Var | '->' Var | Expr18;
// Expr18 : ((Var '++') | (Var '--')) Expr19;
// Expr19 : Var;


// Expr1 ← !(Var "=") !(Var "+=") !(Var "-=") !(Var "*=") !(Var "/=") Expr2
// Expr2 ← Expr3 (("?" Expr1 ":" Expr1) / ("?:" Expr1))?
// Expr3 ← Expr4 ("|" Expr4)*
// Expr4 ← Expr5 ("&" Expr5)*
// Expr5 ← Expr6 ("||" Expr6)*
// Expr6 ← Expr7 ("&&" Expr7)*
// Expr7 ← Expr8 ("^^" Expr8)*
// Expr8 ← Expr9 (("==" / "!=") Expr9)*
// Expr9 ← Expr10 ((">" / "<" / ">=" / "<=") Expr10)*
// Expr10 ← Expr11 (("<<" / ">>") Expr11)*
// Expr11 ← Expr12 (("+" / "-") Expr12)*
// Expr12 ← Expr13 (("*" / "/" / "%") Expr13)*
// Expr13 ← Expr14 ("^" Expr14)*
// Expr14 ← ("+" / "-" / "!") Expr15
// Expr15 ← Expr16 (MethodCallExpr / TableIndexExpr)*
// Expr16 ← "(" Expr1 ")" / FunctionCallExpr / Expr17
// Expr17 ← Number / String / "~" Var / "$" Var / "->" Var / Expr18
// Expr18 ← !(Var "++") !(Var "--") Expr19
// Expr19 ← Var



// ------ LEXER RULES ------ //

C_inc : '++' ;
C_dec : '--' ;
C_plus_eq : '+=' ;
C_minus_eq : '-=' ;
C_mul_eq : '*=' ;
C_div_eq : '/=' ;
C_inputs : '->' ;
C_lshift : '<<' ;
C_rshift : '>>' ;
C_not_eq : '!=' ;
C_less_eq : '<=' ;
C_greater_eq : '>=' ;
C_eq_eq : '==' ;
C_band : '&&' ;
C_bor : '||' ;
C_bxor : '^^' ;

C_lbkt : '(' ;
C_rbkt : ')' ;

C_lsbkt : '[' ;
C_rsbkt : ']' ;

C_lfbkt : '{' ;
C_rfbkt : '}' ;

C_quest : '?' ;
C_col : ':' ;
C_comma : ',' ;
C_equal : '=' ;

C_plus : '+' ;
C_minus : '-' ;
C_mul : '*' ;
C_div : '/' ;
C_less : '<' ;
C_greater : '>' ;
C_or : '|' ;
C_and : '&' ;
C_pow : '^' ;
C_delta : '$' ;
C_directive : '@' ;
C_mod : '%' ;
C_not : '!' ;
C_tilt : '~' ;
C_vararg : '...' ;


KW_function : 'function';
KW_local : 'local';
KW_event : 'event';
KW_try : 'try';
KW_catch : 'catch';

KW_if : 'if';
KW_else : 'else';
KW_elseif : 'elseif';
KW_switch : 'switch';

KW_for : 'for';
KW_do : 'do';
KW_while : 'while';
KW_foreach : 'foreach';

KW_default : 'default';
KW_case : 'case';
KW_break : 'break';
KW_continue : 'continue';
KW_return : 'return';

PP_IFDEF
   :  (PP_ifdef | PP_ifndef) (PP_IFDEF .*? PP_endif | .)*? (PP_else | PP_endif)
   ;

// PP_include : '#include' .*? ["] ~["]* ["]; //~["]* ["] ~["]* ["] WS?;
// PP_include : '#include' ~["]+? ["] ~["]+? ["] ;
// PP_include : '#include' ~[\r\n]* ;
// PP_include : COMMENT_OR_INCLUDE ;
PP_ifdef : '#ifdef' ~[\r\n]*;
PP_ifndef : '#ifndef' ~[\r\n]*;
PP_else : '#else' ~[\r\n]*;
PP_endif : '#endif' ~[\r\n]*;

// CONST
//    : STRING | NUMBER | CONSTANT
//    ;
   
// TYPE
//    : 'void' | 'number' | 'string' | 'table' | 'entity'
//    ;

// BLOCK_COMMENT: BLOCK_COMMENT_START BLOCK_COMMENT_CONTENT BLOCK_COMMENT_END ;

// BLOCK_COMMENT_START
//    : '#[' -> pushMode(multiline_comment)
//    ;
// keyIF : {input.LT(1).getText().equals("if")}? ID ;


COMMENT_OR_INCLUDE
   : ('#include' ~["]+? ["] ~["]+? ["] | '#' [\r\n]+ | '#' ~'[' .*? ([\r\n]+ | EOF))
   ;

BLOCK_COMMENT
   : '#[' .*? (']#' | EOF)
   ;

// COMMENT
   // :
   // COMMENT_OR_INCLUDE
   // '#' ~'[' .*? ([\r\n]+? | EOF)  // { this._channel = this.COMMENT; }
   // ;

DIRECTIVE_VARS
   // : '@' .*? ([\r\n]+ | EOF)
   : '@' ('persist' | 'outputs' | 'inputs' | ('trigger' (WS ('all' | 'none'))?))
   ;
   
DIRECTIVE
   : '@' ('name' | 'model' | 'strict' | 'autoupdate') .*? ([\r\n]+ | EOF)
   ;

WS
   : ([ \t\r\n]+ | EOF) // { this._channel = this.WHITESPACE; }
   ;

STRING
   : '"' (ESC | SAFECODEPOINT)* '"'
   ;
   
fragment ESC
   : '\\' . // (["\\/bfnrt])
   ;

fragment SAFECODEPOINT
   : ~ ["\\\u0000-\u001F]
   | [\r\n]
   ;

NUMBER
   : INT ('.' [0-9] +)? EXP?
   | '0x' HEX+
   | '0b' BIN+
   ;
   
fragment HEX
   : [0-9a-fA-F]
   ;

fragment BIN
   : [0-1]
   ;
   
fragment INT
   : '0' | [1-9] [0-9]*
   ;

fragment EXP
   : [Ee] [+\-]? [0-9]+
   ;

INDEX
   : STRING | NUMBER
   ;

LITERAL
   : [a-z][A-Za-z0-9_]*
   ;
   
VAR
   : ([A-Z][A-Za-z0-9_]* | '_')
   ;
   
CONSTANT
   : ([_][A-Za-z0-9_]+)
   ;

// mode multiline_comment;

// BLOCK_COMMENT_END : ']#' -> popMode;
// BLOCK_COMMENT_CONTENT : .+ ;






// Stmts : Stmt1 ((',' | ' ') Stmt1)* EOF;

// Stmt1 : ('if' Cond Block IfElseIf)? Stmt2;
// Stmt2 : ('while' Cond Block)? Stmt3;
// Stmt3 : ('for' '(' Var '=' Expr1 ',' Expr1 (',' Expr1)? ')' Block)? Stmt4;
// Stmt4 : ('foreach' '(' Var ',' Var ':' Fun '=' Expr1 ')' Block)? Stmt5;
// Stmt5 : ('break' | 'continue')? Stmt6;
// Stmt6 : (Var ('++' | '--'))? Stmt7;
// Stmt7 : (Var ('+=' | '-=' | '*=' | '/='))? Stmt8;
// Stmt8 : 'local'? (Var ('[' Index ('=' Stmt8)? | '=' Stmt8))? Stmt9;
// Stmt9 : ('switch' '(' Expr1 ')' '{' SwitchBlock)? Stmt10;
// Stmt10 : (FunctionStmt | ReturnStmt)? Stmt11;
// Stmt11 : ('#include' String)? Stmt12;
// Stmt12 : ('try' Block 'catch' '(' Var ')' Block)? Stmt13;
// Stmt13 : ('do' Block 'while' Cond)? Expr1;
// Stmt14 : ('event' Fun '(' FunctionArgs Block);

// FunctionStmt : 'function' FunctionHead '(' FunctionArgs Block;
// FunctionHead : (Type Type ':' Fun | Type ':' Fun | Type Fun | Fun);
// FunctionArgs : (FunctionArg (',' FunctionArg)*)? ')';
// FunctionArg : Var (':' Type)?;

// ReturnStmt : 'return' ('void' | '}' | Expr1);
// IfElseIf : 'elseif' Cond Block IfElseIf | IfElse;
// IfElse : 'else' Block;
// Cond : '(' Expr1 ')';
// Block : '{' (Stmt1 ((',' | ' ') Stmt1)*)? '}';
// SwitchBlock : (('case' Expr1 | 'default') CaseBlock)* '}';
// CaseBlock : (Stmt1 ((',' | ' ') Stmt1)*)? ('case' | 'default' | '}');

// Expr1 : ((Var '=') | (Var '+=') | (Var '-=') | (Var '*=') | (Var '/=')) Expr2;
// Expr2 : Expr3 (('?' Expr1 ':' Expr1) | ('?:' Expr1))?;
// Expr3 : Expr4 ('|' Expr4)*;
// Expr4 : Expr5 ('&' Expr5)*;
// Expr5 : Expr6 ('||' Expr6)*;
// Expr6 : Expr7 ('&&' Expr7)*;
// Expr7 : Expr8 ('^^' Expr8)*;
// Expr8 : Expr9 (('==' | '!=') Expr9)*;
// Expr9 : Expr10 (('>' | '<' | '>=' | '<=') Expr10)*;
// Expr10 : Expr11 (('<<' | '>>') Expr11)*;
// Expr11 : Expr12 (('+' | '-') Expr12)*;
// Expr12 : Expr13 (('*' | '/' | '%') Expr13)*;
// Expr13 : Expr14 ('^' Expr14)*;
// Expr14 : ('+' | '-' | '!') Expr15;
// Expr15 : Expr16 (MethodCallExpr | TableIndexExpr)?;
// Expr16 : '(' Expr1 ')' | FunctionCallExpr | Expr17;
// Expr17 : Number | String | '~' Var | '$' Var | '->' Var | Expr18;
// Expr18 : ((Var '++') | (Var '--')) Expr19;
// Expr19 : Var;

// MethodCallExpr : ':' Fun '(' (Expr1 (',' Expr1)*)? ')';
// TableIndexExpr : '[' Expr1 (',' Type)? ']';

// FunctionCallExpr : Fun '(' KeyValueList? ')';
// KeyValueList : (KeyValue (',' KeyValue))+;
// KeyValue : Expr1 ('=' Expr1)?;




// Index : (String | Number);

// String : '"' (ESC | SAFECODEPOINT)* '"';
// fragment ESC
//    : '\\' (["\\/bfnrt] | UNICODE)
//    ;

// fragment UNICODE
//    : 'u' HEX HEX HEX HEX
//    ;

// fragment HEX
//    : [0-9a-fA-F]
//    ;

// fragment SAFECODEPOINT
//    : ~ ["\\\u0000-\u001F]
//    ;


// Number : '-'? INT ('.' [0-9] +)? EXP?;
// fragment INT
//    : '0' | [1-9] [0-9]*
//    ;

// fragment EXP
//    : [Ee] [+\-]? [0-9]+
//    ;

// Fun : [a-z][A-Za-z0-9_]*;
// Var : [A-Z][A-Za-z0-9_]*;
// Type : ('void' | 'number' | 'string' | 'table');
