lexer grammar E2Lexer;

/* NOT USED */

/* IN JavaScript */
// @lexer::members {
//    this.WHITESPACE = this.constructor.channelNames.push("WHITESPACE") - 1
//    this.COMMENT = this.constructor.channelNames.push("COMMENT") - 1
// }

channels {
    CH_WHITESPACE,
    CH_COMMENT
}



// ------ LEXER RULES ------ //

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
   :  (PP_ifdef | PP_ifndef) .*? (PP_else)
   ;

PP_include : '#include' ~[\r\n]*;
PP_ifdef : '#ifdef' ~[\r\n]*;
PP_ifndef : '#ifndef' ~[\r\n]*;
PP_else : '#else' ~[\r\n]*;
PP_endif : '#endif' ~[\r\n]*;

CONST
   : STRING | NUMBER
   ;
   
// TYPE
//    : 'void' | 'number' | 'string' | 'table' | 'entity'
//    ;

// BLOCK_COMMENT: COMMENT_START BLOCK_COMMENT_START BLOCK_COMMENT_CONTENT BLOCK_COMMENT_END ;
// COMMENT : COMMENT_START COMMENT_END;

// BLOCK_COMMENT_START
//    : '#[' -> pushMode(multiline_comment)
//    ;

BLOCK_COMMENT
   : '#[' .*? ']#'
   ;
   
COMMENT
   : '#' .*? [\r\n]+ // { this._channel = this.COMMENT; }
   ;

COMMENT_START : '#' -> pushMode(comment_mode);

DIRECTIVE
   : '@' .*? [\r\n]+
   ;

WS
   : [ \t\r\n]+ // { this._channel = this.WHITESPACE; }
   ;

STRING
   : '"' (ESC | SAFECODEPOINT)* '"'
   ;
   
fragment ESC
   : '\\' (["\\/bfnrt])
   ;

fragment SAFECODEPOINT
   : ~ ["\\\u0000-\u001F]
   | [\r\n]
   ;

NUMBER
   : INT ('.' [0-9] +)? EXP?
   | '0x' HEX+
   ;
   
fragment HEX
   : [0-9a-fA-F]
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
   : [A-Z][A-Za-z0-9_]*
   ;


mode comment_mode;

BLOCK_COMMENT_START : '[' -> pushMode(multicomment_mode);
COMMENT_END : ~[\r\n]+ -> popMode;

mode multicomment_mode;

BLOCK_COMMENT_END : ']#' -> popMode;
BLOCK_COMMENT_CONTENT : .+? ;