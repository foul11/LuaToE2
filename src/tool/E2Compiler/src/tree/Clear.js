import { Mutex } from 'async-mutex';
import MultiClass from '../MultiClass.js';
import util from 'node:util';
import path from 'node:path';
import { Stream } from 'node:stream';
import { readAll } from '../Helpers.js';

function capitalize(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

/** @return {any} */
function ThrowNotEnoughArgsOfToken(...args){
    throw new NotEnoughArgsOfToken(...args);
}

export class Token {
    /**
     * @typedef {{
     *  annotations?: Annotation[],
     *  ops?: number,
     *  totalOps?: number,
     *  DontCallConstructor?: boolean,
     *  PostFix?: string,
     * }} TokenOptions
     **/
    
    /** @param {TokenOptions} options */
    constructor(options = {}) {
        if (!options.DontCallConstructor)
            this.multiConstructor(options);
    }
    
    /** @param {TokenOptions} options */
    multiConstructor(options = {}) {
        /** @type {Annotation[]} */
        this.annotations = options.annotations ?? [];
        /** @type {number} */
        this.ops = options.ops ?? this.setDefaultOps(this, options);
        /** @type {number} */
        this.totalOps = (options.totalOps ?? this.setDefaultTotalOps(options)) + this.ops;
        /** @type {string} */
        this.PostFix = options.PostFix ?? null;
    }
    
    /** @return {number} */
    setDefaultOps(node, options = {}) {
        switch(node.constructor) {
            case Root:       return 0   ;
            case Call:       return 20  ;
            case StringCall: return 30  ;
            case Literal:    return 0.5 ;
            case Var:        return 1   ;
            case Func:       return options?.parameters[options?.parameters?.length - 1] instanceof VarArg ? 80 : 40 ;
            default:   return 0  ;
        }
    }
    
    /** @return {number} */
    setDefaultTotalOps(start, maxDepth = 5) {
        if (maxDepth == 0) throw new MaxLookupDepthOfToken()
        let total = 0;
        
        for(let node of Object.values(start)) {
            if (!node) continue;
            switch(true) {
                case node instanceof Reference:                                                         break;
                case node instanceof Func:                                                              break;
                case node instanceof Token:     total += (node.totalOps ?? 0);                          break;
                case node instanceof Array:     total += this.setDefaultTotalOps(node, maxDepth - 1);   break;
            }
        }
        
        return total;
    }
    
    recalculateTotalOps(depth = 1, start = this) {
        let count = 0;
        
        if (depth == 0) return;
        depth--;
        
        for(let node of Object.values(start)) {
            if (!node) continue;
            switch(true) {
                case node instanceof Reference: break;
                case node instanceof Token:
                    this.recalculateTotalOps(depth, node);
                    count += (node.totalOps ?? 0);
                    break;
                    
                case node instanceof Array:
                    for(let vnode of node) {
                        this.recalculateTotalOps(depth, node);
                        count += (vnode.totalOps ?? 0);
                    }
                    break;
            }
        }
        
        start.totalOps = count + start.ops;
        
        return;
    }
}

export class Reference extends Token {
    /** @param {Token} ref */
    constructor(ref = null) {
        super();
        
        /** @type {Token} */
        this.value = ref;
    }
}

export class Statement extends Token {}
export class Expression extends Token {
    /**
     * @typedef {TokenOptions & {
     *  return?: Type,
     * }} ExpressionOptions
     */
    
    /**
     * @param {ExpressionOptions} options
     */
    constructor(options) {
        options.DontCallConstructor = true;
        super(options);
        
        this.multiConstructor(options);
    }
    
    /**
     * @param {ExpressionOptions} options
     */
    multiConstructor(options = {}) {
        super.multiConstructor(options);
        
        
        /** @type {Type} */
        this.return = options.return ?? ThrowNotEnoughArgsOfToken();
        this.recalculateAnno();
    }
    
    recalculateAnno() {
        if (this.annotations) {
            for (let anno of this.annotations) {
                if (anno.name == 'type') {
                    this.return = new Type(anno.value.type);
                    break;
                }
            }
        }
    }
}
export class Delimiter extends Token {
    /**
     * @param {TokenOptions & {
    *  origin?: any,
    * }} options
    **/
   
    constructor(options = {}) {
        super(options);
        
       /** @type {any} */
       this.origin = options.origin;
    }
}
export class PreProcessor extends Delimiter {
    /**
     * @param {TokenOptions & {
     *  value?: string,
     *  origin?: any,
     * }} options
     **/
   
   constructor(options = {}) {
       super(options);
       
       /** @type {string} */
       this.value = options.value ?? '';
   }
}

export class WhiteSpace extends Delimiter {}
export class Comment extends Delimiter {
    /**
     * @param {TokenOptions & {
     *  comment?: string,
     *  origin?: any,
     * }} options
     **/
    
    constructor(options = {}){
        super(options);
        
        /** @type {string} */
        this.comment = options.comment ?? '';
    }
}
export class CommentBlock extends Comment {}
export class Annotation extends Comment {
    /**
     * @param {TokenOptions & {
     *  name?: string,
     *  value?: any,
     * }} options
     **/
    
    constructor(options = {}){
        super(options);
        
        /** @type {string} */
        this.name = options.name;
        /** @type {any} */
        this.value = options.value;
    }
}

export class PPinclude extends PreProcessor {
    /**
     * @param {TokenOptions & {
     *  value?: string,
     *  origin?: any,
     * }} options
     **/
    
    constructor(options = {}) {
        super(options);
        
        /** @type {string} */
        this.import = (options.value.match(/\s*#include\s*"(.+)"\s*/)?.[1] ?? '');
        /** @type {string} */
        this.path = `${this.import}.txt`;
    }
}
export class PPifdef extends PreProcessor {}
export class PPifndef extends PPifdef {}
export class PPelse extends PreProcessor {}
export class PPendif extends PreProcessor {}

export class Lexem extends Token {
    /**
     * @param {{
     *  text: string,
     *  type?: number,
     *  line?: number,
     * }} node
     **/
    
    constructor(node = { text: '', type: 0, line: 0 }) {
        super();
        
        /** @type {string} */
        this.text = node.text ?? '';
        /** @type {number} */
        this.type = node.type ?? 0;
        /** @type {number} */
        this.line = node.line ?? 0;
    }
}

export class LexemValue extends Lexem {
    /**
     * @param {{
     *  value?: any,
     * }} value
     */
    
    constructor(value) {
        super();
        
        /** @type {any} */
        this.value = value.value;
    }
}

export class LexemElse extends LexemValue {}
export class LexemElseIf extends LexemValue {}
export class LexemArgs extends LexemValue {}
export class LexemCondition extends LexemValue {}
export class LexemFuncArgs extends LexemValue {}
export class LexemFuncName extends LexemValue {}
export class LexemConst extends LexemValue {}
export class LexemCallStr extends LexemValue {}

export class LexemConstant extends LexemConst {}
export class LexemNumber extends LexemConst {}
export class LexemString extends LexemConst {}

export class LexemComment extends Lexem {}
export class LexemText extends Lexem {}
export class LexemEOF extends Lexem {}

export class LexemVarArg extends Lexem {}
export class LexemInputs extends Lexem {}
export class LexemComma extends Lexem {}
export class LexemColon extends Lexem {}
export class LexemQuest extends Lexem {}
export class LexemDelta extends Lexem {}
export class LexemTilt extends Lexem {}

export class LexemKeyword extends Lexem {}
export class LexemBkt extends Lexem {}

export class LexemOp extends Lexem {}
export class LexemAss extends LexemOp {}
export class LexemOpLogic extends LexemOp {}
export class LexemComp extends LexemOpLogic {}
export class LexemOpBit extends LexemOp {}
export class LexemOpMath extends LexemOp {}
export class LexemOpIncDec extends LexemOp {}

export class Root extends Token {
    /**
     * @param {TokenOptions & {
     *  directives?: Directive[],
     *  block?: Block,
     * }} options
     **/
    
    constructor(options = {}) {
        super(options);
        
        /** @type {Directive[]} */
        this.directives = options.directives ?? [];
        /** @type {Block} */
        this.block = options.block ?? ThrowNotEnoughArgsOfToken();
    }
}

export class Directive extends Token {
    /**
     * @param {TokenOptions & {
     *  name?: string,
     *  value?: Expression[] | string,
     * }} options
     **/
    
    constructor(options = {}) {
        super(options);
        
        /** @type {string} */
        this.name = options.name ?? '';
        /** @type {Expression[] | string} */
        this.value = options.value;
    }
}

export class Block extends Token {
    /**
     * @param {TokenOptions & {
     *  statements?: Statement[],
     * }} options
     **/
    
    constructor(options = {}) {
        super(options);
        
        /** @type {Statement[]} */
        this.statements = options.statements ?? [];
    }
}

export class Include extends Statement {
    /**
     * @param {TokenOptions & {
    *  pref?: string,
    *  path?: string,
    *  body?: Root,
    * }} options
    **/
   
   constructor(options = {}) {
       super(options);
       
       /** @type {string} */
       this.pref = options.pref ?? ThrowNotEnoughArgsOfToken();
       /** @type {string} */
       this.path = options.path ?? ThrowNotEnoughArgsOfToken();
       /** @type {Root} */
       this.body = options.body ?? ThrowNotEnoughArgsOfToken();
   }
}

export class Func extends Statement {
    /**
     * @param {TokenOptions & {
     *  name?: string,
     *  returnType?: Type,
     *  thisType?: Type,
     *  parameters?: (Var | VarArg)[],
     *  body?: Block,
     *  inline?: boolean,
     *  source?: any,
     * }} options
     **/
    
    constructor(options = {}) {
        super(options);
        
        /** @type {string} */
        this.name = options.name ?? '';
        /** @type {Type} */
        this.returnType = options.returnType ?? new Type('void');
        /** @type {Type} */
        this.thisType = options.thisType ?? new Type('void');
        /** @type {(Var | VarArg)[]} */
        this.parameters = options.parameters ?? [];
        /** @type {Block} */
        this.body = options.body ?? ThrowNotEnoughArgsOfToken();
        /** @type {boolean} */
        this.inline = options.inline ?? false;
        /** @type {any} */
        this.source = options.source ?? {};
    }
}

export class Assignment extends Statement {
    /**
     * @param {TokenOptions & {
     *  local?: boolean,
     *  target?: Expression,
     *  assop?: string,
     *  value?: Expression,
     *  return?: Type,
     * }} options
     **/
    
    constructor(options = {}) {
        super(options);
        
        /** @type {boolean} */
        this.local = options.local ?? ThrowNotEnoughArgsOfToken();
        /** @type {Expression} */
        this.target = options.target ?? ThrowNotEnoughArgsOfToken();
        /** @type {string} */
        this.assop = options.assop ?? ThrowNotEnoughArgsOfToken();
        /** @type {Expression} */
        this.value = options.value ?? ThrowNotEnoughArgsOfToken();
        /** @type {Type} */
        this.return = options.return ?? ThrowNotEnoughArgsOfToken();
    }
}

export class Var extends Expression {
    /**
     * @param {ExpressionOptions & {
     *  name?: string,
     *  type?: Type,
     *  declareLocal?: boolean,
     *  declaration?: Reference,
     *  return?: Type,
     * }} options
     **/
    
    constructor(options = {}) {
        options.return = options.type;
        super(options);
        
        /** @type {string} */
        this.name = (options.name && capitalize(options.name)) ?? ThrowNotEnoughArgsOfToken();
        /** @type {Type} */
        this.type = options.type ?? ThrowNotEnoughArgsOfToken();
        /** @type {boolean} */
        this.declareLocal = options.declareLocal ?? ThrowNotEnoughArgsOfToken();
        /** @type {Reference} */
        this.declaration = options.declaration ?? new Reference();
    }
}

export class VarArg extends Expression {
    /**
     * @param {ExpressionOptions & {
     *  var?: Var,
     *  declaration?: Reference,
     * }} options
     **/
    
    constructor(options = {}) {
        options.return = options.var.return;
        super(options);
        
        /** @type {Var} */
        this.var = options.var ?? ThrowNotEnoughArgsOfToken();
        /** @type {Reference} */
        this.declaration = options.declaration ?? new Reference();
    }
}

export class KV extends Expression {
    /**
     * @param {ExpressionOptions & {
     *  key?: Expression,
     *  value?: Expression,
     * }} options
     **/
    
    constructor(options = {}) {
        options.return = options.value.return;
        super(options);
        
        /** @type {Expression?} */
        this.key = options.key ?? null;
        /** @type {Expression} */
        this.value = options.value ?? ThrowNotEnoughArgsOfToken();
    }
}

export class Literal extends Expression {
    /**
     * @param {ExpressionOptions & {
     *  value?: string | number | boolean,
     * }} options
     **/
    
    constructor(options = {}) {
        super(options);
        
        /** @type {string | number | boolean} */
        this.value = options.value ?? ThrowNotEnoughArgsOfToken();
    }
}

export class Lookup extends Expression {
    /**
     * @param {ExpressionOptions & {
     *  object?: Expression,
     *  member?: Index,
     * }} options
     **/
    
    constructor(options = {}) {
        options.return = options?.member?.type;
        super(options);
        
        /** @type {Expression} */
        this.object = options.object ?? ThrowNotEnoughArgsOfToken();
        /** @type {Index} */
        this.member = options.member ?? ThrowNotEnoughArgsOfToken();
    }
}

export class Index extends Expression {
    /**
     * @param {ExpressionOptions & {
     *  value?: Expression,
     *  type?: Type,
     * }} options
     **/
    
    constructor(options = {}) {
        options.return = options.type;
        super(options);
        
        /** @type {Expression} */
        this.value = options.value ?? ThrowNotEnoughArgsOfToken();
        /** @type {Type} */
        this.type = options.type ?? null;
    }
}

export class Unary extends Expression {
    /**
     * @param {ExpressionOptions & {
     *  operator?: string,
     *  expression?: Expression,
     * }} options
     **/
    
    constructor(options = {}) {
        super(options);
        
        /** @type {string} */
        this.operator = options.operator ?? ThrowNotEnoughArgsOfToken();
        /** @type {Expression} */
        this.expression = options.expression ?? ThrowNotEnoughArgsOfToken();
    }
}

export class Binary extends Expression {
    /**
     * @param {ExpressionOptions & {
     *  operator?: string,
     *  left?: Expression,
     *  right?: Expression,
     * }} options
     **/
    
    constructor(options = {}) {
        super(options);
        
        /** @type {string} */
        this.operator = options.operator ?? ThrowNotEnoughArgsOfToken();
        /** @type {Expression} */
        this.left = options.left ?? ThrowNotEnoughArgsOfToken();
        /** @type {Expression} */
        this.right = options.right ?? ThrowNotEnoughArgsOfToken();
    }
}

export class Ternary extends Expression {
    /**
     * @param {ExpressionOptions & {
     *  condition?: Expression,
     *  yes?: Expression,
     *  no?: Expression,
     * }} options
     **/
    
    constructor(options = {}) {
        options.return = options.no.return;
        super(options);
        
        /** @type {string} */
        this.condition = options.condition ?? ThrowNotEnoughArgsOfToken();
        /** @type {Expression} */
        this.yes = options.yes ?? null;
        /** @type {Expression} */
        this.no = options.no ?? ThrowNotEnoughArgsOfToken();
    }
}

export class Call extends MultiClass(Expression, Statement) {
    /**
     * @param {ExpressionOptions & {
     *  callee?: string,
     *  arguments?: Expression[],
     *  method?: boolean,
     *  parent?: Reference,
     *  return?: Type,
     *  ref?: Reference,
     * }} options
     **/
    
    constructor(options = {}) {
        super(options);
        this.multiConstructor(options);
        
        /** @type {string?} */
        this.callee = options.callee ?? ThrowNotEnoughArgsOfToken();
        /** @type {Expression[]} */
        this.arguments = options.arguments ?? [];
        /** @type {boolean} */
        this.method = options.method ?? ThrowNotEnoughArgsOfToken();
        /** @type {Reference} */
        this.parent = options.parent ?? new Reference();
        /** @type {Reference} */
        this.ref = options.ref ?? null;
    }
}

export class StringCall extends MultiClass(Expression, Statement) {
    /**
     * @param {ExpressionOptions & {
     *  callee?: Expression,
     *  arguments?: Expression[],
     *  return?: Type,
     * }} options
     **/
    
    constructor(options = {}) {
        super(options);
        this.multiConstructor(options);
        
        /** @type {Expression} */
        this.callee = options.callee ?? ThrowNotEnoughArgsOfToken();
        /** @type {Expression[]} */
        this.arguments = options.arguments ?? [];
        // /** @type {Type} */
        // this.returnType = options.returnType ?? new Type('void');
    }
}

export class Break extends Statement {}
export class Continue extends Statement {}
export class Return extends Statement {
    /**
     * @param {TokenOptions & {
     *  value?: Expression,
     * }} options
     **/
    
    constructor(options = {}) {
        super(options);
        
        /** @type {Expression?} */
        this.value = options.value ?? null;
    }
}

export class If extends Statement {
    /**
     * @param {TokenOptions & {
     *  condition?: Expression,
     *  bodyTrue?: Block,
     *  bodyFalse?: Block | null,
     * }} options
     **/
    
    constructor(options = {}) {
        super(options);
        
        /** @type {Expression} */
        this.condition = options.condition ?? ThrowNotEnoughArgsOfToken();
        /** @type {Block} */
        this.bodyTrue = options.bodyTrue ?? ThrowNotEnoughArgsOfToken();
        /** @type {Block | null} */
        this.bodyFalse = options.bodyFalse ?? null;
    }
}

export class SwitchToken extends Statement {}

export class SwitchDefault extends SwitchToken {}
export class SwitchCase extends SwitchToken {
    /**
     * @param {TokenOptions & {
     *  switch?: Expression,
     * }} options
     **/
    
    constructor(options = {}) {
        super(options);
        
        /** @type {Expression} */
        this.switch = options.switch ?? ThrowNotEnoughArgsOfToken();
    }
}

export class SwitchBlock extends Token {
    /**
     * @param {TokenOptions & {
     *  statements?: (Block | SwitchToken)[],
     * }} options
     **/
    
    constructor(options = {}) {
        super(options);
        
        /** @type {(Block | SwitchToken)[]} */
        this.statements = options.statements ?? [];
    }
}

export class Switch extends Statement {
    /**
     * @param {TokenOptions & {
     *  switch?: Expression,
     *  body?: SwitchBlock,
     * }} options
     **/
    
    constructor(options = {}) {
        super(options);
        
        /** @type {Expression} */
        this.switch = options.switch ?? ThrowNotEnoughArgsOfToken();
        /** @type {SwitchBlock} */
        this.body = options.body ?? new SwitchBlock();
    }
}

export class While extends Statement {
    /**
     * @param {TokenOptions & {
     *  condition?: Expression,
     *  body?: Block,
     * }} options
     **/
    
    constructor(options = {}) {
        super(options);
        
        /** @type {Expression} */
        this.condition = options.condition ?? ThrowNotEnoughArgsOfToken();
        /** @type {Block} */
        this.body = options.body ?? ThrowNotEnoughArgsOfToken();
    }
}

export class DoWhile extends While {}

export class For extends Statement {
    /**
     * @param {TokenOptions & {
     *  condition?: Expression,
     *  name?: Var,
     *  values?: Expression[],
     *  body?: Block,
     * }} options
     **/
    
    constructor(options = {}) {
        super(options);
        
        /** @type {Expression} */
        this.condition = options.condition ?? ThrowNotEnoughArgsOfToken();
        /** @type {Var} */
        this.name = options.name ?? ThrowNotEnoughArgsOfToken();
        /** @type {Expression[]} */
        this.values = options.values ?? [];
        /** @type {Block} */
        this.body = options.body ?? ThrowNotEnoughArgsOfToken();
    }
}

export class Foreach extends Statement {
    /**
     * @param {TokenOptions & {
     *  key?: Var,
     *  value?: Var,
     *  array?: Expression,
     *  body?: Block,
     * }} options
     **/
    
    constructor(options = {}) {
        super(options);
        
        /** @type {Var} */
        this.key = options.key ?? ThrowNotEnoughArgsOfToken();
        /** @type {Var} */
        this.value = options.value ?? ThrowNotEnoughArgsOfToken();
        /** @type {Expression} */
        this.array = options.array ?? ThrowNotEnoughArgsOfToken();
        /** @type {Block} */
        this.body = options.body ?? ThrowNotEnoughArgsOfToken();
    }
}

export class Try extends Statement {
    /**
     * @param {TokenOptions & {
     *  body?: Block,
     *  catchVar?: Var,
     *  catch?: Block,
     * }} options
     **/
    
    constructor(options = {}) {
        super(options);
        
        /** @type {Block} */
        this.body = options.body ?? ThrowNotEnoughArgsOfToken();
        /** @type {Var} */
        this.catchVar = options.catchVar ?? ThrowNotEnoughArgsOfToken();
        /** @type {Block} */
        this.catch = options.catch ?? ThrowNotEnoughArgsOfToken();
    }
}

export class Event extends Statement {
    /**
     * @param {TokenOptions & {
     *  name?: string,
     *  parameters?: Var[],
     *  body?: Block,
     * }} options
     **/
    
    constructor(options = {}) {
        super(options);
        
        /** @type {string} */
        this.name = options.name ?? '';
        /** @type {Var[]} */
        this.parameters = options.parameters ?? [];
        /** @type {Block} */
        this.body = options.body ?? ThrowNotEnoughArgsOfToken();
    }
}

export class Type extends Token {
    /** @type {Object<string,Type>} */
    static map = {};
    
    /** @param {string} type */
    constructor(type, tag, inherit = null){
        super();
        
        type = type.toLowerCase();
        
        if (type == 'normal') { // fallback
            type = 'number';
        }
        
        if (Type.map[type]) {
            return Type.map[type];
        } else { Type.map[type] = this; }
        
        /** @type {string} */
        this.type = type;
        
        if (tag === undefined) {
            throw new TypeTagErrorToken(type);
        }
        
        /** @type {string} */
        this.tag = tag;
        /** @type {Type} */
        this.inherit = inherit;
        
        switch (type) {
            case 'number': this.default = new Reference(new Literal({ value: 0, return: this }));  break;
            case 'string': this.default = new Reference(new Literal({ value: "", return: this })); break;
            case 'table':  this.default = new Reference(/** @type {any} */ (new Call({ callee: 'table', method: false, return: this }))); break;
            case 'array':  this.default = new Reference(/** @type {any} */ (new Call({ callee: 'array', method: false, return: this }))); break;
            default: this.default = null; break;
        }
    }
}

export class TreeError extends Error {}
export class UnexpectedToken extends TreeError {
    constructor(obj){
        super(`found unexpected token: ${obj.constructor.name} \n${util.inspect(obj)}`);
    }
}
export class MaxLookupDepthOfToken extends TreeError {}
export class NotEnoughArgsOfToken extends TreeError {}
export class ReturnNotAllowedHere extends TreeError {}
export class DifferentReturnType extends TreeError {}
export class TypeTagErrorToken extends TreeError {}
export class IncompatibleTypes extends TreeError {}
export class NoSuchFunction extends TreeError {}
export class NoSuchOperator extends TreeError {}
export class NoSuchFile extends TreeError {}

const VerboseRegExp = (function init_once () {
    const cleanupregexp = /(?<!\\)[\[\]]|\s+|\/\/[^\r\n]*(?:\r?\n|$)/g
    return function first_parameter (pattern) {
        return function second_parameter (flags) {
            flags = flags.raw[0].trim()
            let in_characterclass = false
            const compressed = pattern.raw[0].replace(
                cleanupregexp,
                function on_each_match (match) {
                    switch (match) {
                        case '[': in_characterclass = true; return match
                        case ']': in_characterclass = false; return match
                        default: return in_characterclass ? match : ''
                    }
                }
            )
            return flags ? new RegExp(compressed, flags) : new RegExp(compressed)
        }
    }
})();

export class Scope {
    static OTHER_TO_OPNAME = {
        '=': 'ass', '++': 'inc', '--': 'dec',
        '-': 'neg', '$':  'dlt', '!':  'not',
        '~': 'trg' ,'->': 'iwc',
    };
    static BINARY_TO_OPNAME = {
         '+': 'add',   '-': 'sub',   '*': 'mul',  '/': 'div',
         '%': 'mod',   '^': 'exp',   '==': 'eq', '!=': 'neq',
        '>=': 'geq',  '<=': 'leq',   '<': 'gth',  '>': 'lth',
        '&&': 'band', '||': 'bor',   '^^': 'bxor',
        '<<': 'bshl', '>>': 'bshr',  '&': 'and', '|': 'or',
        
    };
    
    /**
     * @typedef {import('./E2Data.js').default} E2Data
     * @param {E2Data} e2data
     */
    
    constructor(e2data, parser = null){
        /** @type {Object<string, Var>} */
        this.global = {};
        /** @type {Object<string, Var>[]} */
        this.locals = [
            {},
        ];
        this.plocal = 0;
        this.assDisable = 0;
        this.funcRetTypeDisable = 0;
        this.isPreProcess = 0;
        
        this.flag_isMethod = 0;
        this.flag_expsMethodNoPush = 0;
        this.exps_stack = [[]];
        this.pexps_stack = 0;
        
        this.unicVar = 0;
        this.funcDeclareDisableVars = [];
        
        this.directives = [];
        this.assigment = [];
        this.addPostfix = null;
        // this.directOutput = false;
        this.includes = [];
        this.lateStmt = [];
        this.assignLocal = false;
        this.annotations = [];
        this.returnType = [];
        this.disablect = false; // disable custom type check
        this.prestmt = [];
        
        this.includeCache = {};
        this.includePreCache = {};
        this.includeCycle = {};
        this.includepref = '';
        
        this.customFunc = {};
        
        this.forceinline = false;
        
        this.parser = parser;
        this.parserMutex = new Mutex();
        
        /* CONF */
        this.disabledCheckType = false;
        this.oneByOneInclude = false;
        /* CONF */
        
        /** @type {E2Data} */
        this.e2data = e2data;
        
        /** @type {Type} */
        this.default = e2data.default;
        /** @type {Type} */
        this.void = e2data.void;
        /** @type {Type} */
        this.number = e2data.types['number'];
        /** @type {Type} */
        this.string = e2data.types['string'];
        /** @type {Type} */
        this.array = e2data.types['array'];
        /** @type {Type} */
        this.table = e2data.types['table'];
    }
    
    disableCheckType() {
        this.disabledCheckType = true;
    }
    
    push() {
        this.locals.push({});
        this.plocal++;
    }
    
    pop() {
        if (this.plocal == 0)
            throw Error('Scope pop zero stack')
        
        let ret = this.locals.pop();
        this.plocal--;
        return ret;
    }
    
    exps() {
        return this.exps_stack[this.pexps_stack];
    }
    
    expsPush(arr = []) {
        this.exps_stack.push(arr);
        this.pexps_stack++;
    }
    
    expsPop() {
        if (this.pexps_stack == 0)
            throw Error('exps_stack pop zero stack')
        
        this.exps_stack.pop();
        this.pexps_stack--;
    }
    
    /**
     * @param {Type} type
     * @param {boolean} isLocal
     */
    assigmentPush(type, isLocal) {
        this.assigment.push({
            type: type,
            local: isLocal,
            used: false,
        });
    }
    
    assigmentPop() {
        this.assigment.pop();
    }
    
    /** @param {Block} blk */
    includePush(blk) {
        this.includes.push(blk);
    }
    
    /** @return {Root} */
    includePop() {
        return this.includes.pop();
    }
    
    /** @param {Token} token */
    lateStmtPush(token) {
        this.lateStmt.push(token);
    }
    
    /** @return {Token[]} */
    lateStmtPopAll() {
        let ret = this.lateStmt;
        this.lateStmt = [];
        
        return ret;
    }
    
    assDisablePush() {
        this.assDisable++
    }
    
    assDisablePop() {
        if (this.assDisable == 0)
            throw Error('AssDisable pop zero stack')
            
        this.assDisable--
    }
    
    annotationsPush(node) {
        this.annotations.push(node);
    }
    
    annotationsPushAll(nodes) {
        for (let node of nodes) {
            this.annotations.push(node);
        }
    }
    
    annotationsPop() {
        let ret = this.annotations;
        this.annotations = [];
        return ret;
    }
    
    returnTypePush(type) {
        this.returnType.push(type);
    }
    
    returnTypePop() {
        this.returnType.pop();
    }
    
    typeGetRoot(type) {
        while (type.inherit) {
            type = type.inherit;
        }
        
        return type;
    }
    
    returnTypeGet() {
        let len = this.returnType.length;
        
        if (!len)
            throw new ReturnNotAllowedHere();
        
        return this.returnType[len - 1];
    }
    
    /**
     * @param {string} name
     * @param {Expression[]}  args
     * @param {Type?}  method
     * @return {{
     *  return?: Type,
     *  cost?: number,
     *  ref?: Reference,
     * }}
     */
    
    getFunction(name, args, method = null) {
        // if (this.funcRetTypeDisable)
        //     return {
        //         return: this.void,
        //         cost: 0,
        //     };
        
        let sParam = this.paramToString(args, method);
        let sParamCust = this.paramToString(args, method, true);
        let func = this.e2data.functions[`${name}(${sParam})`];
        if (func) return func;
        
        func = this.customFunc[`${name}(${sParamCust})`];
        if (func) return func;
        
        for(let i = sParamCust.length; i >= 0; i--) {
            let sig = `${name}(${sParamCust.substring(0,i)}`;
            
            func = this.customFunc[`${sig}..r)`];
            if (func) return func;
            
            func = this.customFunc[`${sig}..t)`];
            if (func) return func;
        }
        
        for(let i = sParam.length; i >= 0; i--) {
            func = this.e2data.functions[`${name}(${sParam.substring(0,i)}...)`];
            if (func) return func;
        }
        
        throw new NoSuchFunction(`${name}(${sParamCust})`);
    }
    
    getOP(name, args, noThrow = false) {
        let sParam = this.paramToString(args);
        let func = this.e2data.functions[`op:${name}(${sParam})`];
        if (func) return func;
        
        if (noThrow) {
            return null;
        }
        
        throw new NoSuchOperator(`${name}(${sParam})`);
    }
    
    applyOP(exp, name) {
        let op = this.getOP(name, [exp]);
        
        exp.ops = exp.ops ?? op.ops;
        exp.return = op.return;
        
        return exp
    }
    
    funcRetTypeDisablePush() {
        this.funcRetTypeDisable++;
    }
    
    funcRetTypeDisablePop() {
        if (this.funcRetTypeDisable == 0)
            throw Error('funcRetTypeDisable pop zero stack')
            
        this.funcRetTypeDisable--;
    }
    
    funcDeclareDisablePush(vari) {
        this.funcDeclareDisableVars.push(vari);
    }
    
    funcDeclareDisablePop() {
        this.funcDeclareDisableVars.pop();
    }
    
    funcDeclareDisableIs() {
        if (!this.funcDeclareDisableVars.length) {
            return false;
        }
        
        return this.funcDeclareDisableVars[this.funcDeclareDisableVars.length - 1];
    }
    
    /**
     * @param {Expression[]} args
     * @param {Type?} thisType
     */
    paramToString(args, thisType = null, customTypes = false) {
        let sparam = thisType ? ((customTypes ? thisType : this.typeGetRoot(thisType)).tag + ':') : '';
        
        for(let param of args) {
            switch(true) {
                case param instanceof VarArg:     sparam += `..${(customTypes ? param.return : this.typeGetRoot(param.return)).tag}`; break;
                case param instanceof Expression:
                case param instanceof Assignment: sparam += (customTypes ? param.return : this.typeGetRoot(param.return)).tag;        break;
                case typeof param == 'string':    sparam += param;                   break;
                default: new UnexpectedToken(param); break;
            }
        }
        
        return sparam;
    }
    
    // {
    //  *  parameters: (Var | VarArg)[],
    //  *  returnType: Type,
    //  *  thisType: Type,
    //  *  name: string,
    //  *  ops: number,
    //  * }
    
    /**
     * @param {Func} func
     */
    declareCustomFunction(func) {
        if (!this.funcDeclareDisableIs()) {
            let sparam = this.paramToString(func.parameters, func.thisType == this.void ? null : func.thisType, true);
            
            this.customFunc[`${func.name}(${sparam})`] = {
                return: func.returnType,
                ops: func.ops,
                ref: new Reference(func),
            };
        }
        
        return func
    }
    
    /**
     * @param {string} name
     * @return {{
     *  type: Type,
     *  declareLocal: boolean,
     * }}
     */
    getVarParm(name) {
        if (this.assigment.length && !this.assDisable) {
            let assObj = this.assigment[this.assigment.length - 1];
            
            if (assObj.used) {
                throw Error('Assigment getType more than once');
            } else { assObj.used = true; }
            
            return {
                type: assObj.type,
                declareLocal: assObj.local,
            };
        }
        
        for(let i = this.plocal; i >= 0; i--){
            let lscope = this.locals[i];
            
            if (lscope[name])
                return {
                    type: lscope[name].type,
                    declareLocal: lscope[name].declareLocal,
                };
        }
        
        if (this.global[name])
            return {
                type: this.global[name].type,
                declareLocal: this.global[name].declareLocal,
            };
            
        throw Error(`Variable ${name} is not defined`);
    }
    
    /**
     * @param {Var} variable
     * @return {Var}
     */
    setVar(variable) {
        if (!this.assigment.length || this.assDisable) {
            return variable;
        }
        
        return this.setVarForce(variable);
    }
    
    /**
     * @param {Type} type 
     * @return {Var}
     */
    genVar(type) {
        return new Var({
            name: `Gen_${this.unicVar++}`,
            type: type,
            declareLocal: false,
        });
    }
    
    getTrue() {
        return new Var({
            name: `ALWAYS_TRUE`,
            type: this.number,
            declareLocal: false,
        });
    }
    
    checkType(lvar, invar) {
        if (!lvar) return false;
        
        return lvar.type != invar.type && !this.disabledCheckType;
    }
    
    /**
     * @param {Var} variable
     * @return {Var}
     */
    setVarForce(variable) {
        if (variable.declareLocal) {
            let lscope = this.locals[this.plocal];
            
            if (this.checkType(lscope[variable.name], variable)) {
                throw new IncompatibleTypes(`Var ${variable.name} [${lscope[variable.name].return.type}] cannot be assigned value of [${variable.return.type}]`);
            }
            
            lscope[variable.name] = variable;
        } else {
            for(let i = this.plocal; i >= 0; i--){
                let lscope = this.locals[i];
                
                if (lscope[variable.name]) {
                    if (this.checkType(lscope[variable.name], variable)) {
                        throw new IncompatibleTypes(`Var ${variable.name} [${lscope[variable.name].return.type}] cannot be assigned value of [${variable.return.type}]`);
                    }
                    
                    return variable;
                }
            }
            
            if (this.checkType(this.global[variable.name], variable)) {
                throw new IncompatibleTypes(`Var ${variable.name} [${this.global[variable.name].return.type}] cannot be assigned value of [${variable.return.type}]`);
            }
            
            this.global[variable.name] = variable;
        }
        
        return variable;
    }
    
    preProcessorPush() {
        this.isPreProcess++;
    }
    
    preProcessorPop() {
        if (this.isPreProcess == 0)
            throw Error('preProcessor pop zero stack')
            
        this.isPreProcess--;
    }
    
    isPreProcessor() {
        return this.isPreProcess != 0;
    }
    
    // /** @param {Directive} node */
    // pushDirective(node) {
    //     this.directives.push(node);
    // }
    
    /**
     * @param {string} input 
     * @param {boolean?} raw 
     */
    
    async IncludePreCache(input, raw = false) {
        let fpath;
        
        if (raw) {
            fpath = 'stdin';
        } else {
            fpath = input;
            input = input.toLowerCase();
        }
        
        if (!this.parser) throw Error('ParserNotFound');
        
        if (this.includeCycle[input]) {
            throw Error('CycleInclude');
        }
        
        if (this.includePreCache[input]) {
            return this.includePreCache[input];
        }
        
        // // console.log('include: ', origPath);
        
        this.includePreCache[input] = (async () => {
            let release;
            
            if (this.oneByOneInclude) {
                release = await this.parserMutex.acquire();
            }
            
            try {
                return preProccess(await (raw ? this.parser.parseCode(input) : this.parser.parseFile(fpath)), this);
            } catch(e) {
                if (e.code == 'ENOENT') {
                    throw new NoSuchFile(fpath);
                } else throw e;
            } finally {
                if (release)
                    release();
            }
        })();
        
        return this.includePreCache[input];
    }
    
    /**
     * @param {string} fpath 
     */
    
    async IncludeToBlock(fpath) {
        fpath = fpath.toLowerCase();
        
        if (!this.parser) throw Error('ParserNotFound');
        
        if (this.includeCycle[fpath]) {
            throw Error('CycleInclude');
        }
        
        if (this.includeCache[fpath]) {
            return this.includeCache[fpath];
        }
        
        // // console.log('process: ', fpath);
        
        this.includeCache[fpath] = (async () => {
            for (let node of travel([await this.includePreCache[fpath]], this)) {
                if (node instanceof Promise) {
                    this.includeCycle[fpath] = true;
                    this.includePush(await node);
                    this.includeCycle[fpath] = false;
                }
                
                if (node instanceof Root) {
                    return node;
                }
            }
        })();
        
        return this.includeCache[fpath];
    }
    
    async BlockFromRaw(code) {
        if (!this.parser) throw Error('ParserNotFound');
        
        for (let node of travel([await preProccess(await this.parser.parseCode(code), this)], this)) {
            if (node instanceof Promise) {
                this.includePush(await node);
            }
            
            if (node instanceof Root) {
                return node.block;
            }
        }
    }
    
    // eslint-disable-next-line no-unused-vars
    EnteredNode(node) {
        // if (this.addPostfix && (node instanceof Statement)) {
        //     node.PostFix = this.addPostfix;
        //     this.addPostfix = null;
        // }
    }
    
    // eslint-disable-next-line no-unused-vars
    LeaveNode(node) {
        // if (this.addPostfix && (node instanceof Statement)) {
        //     node.PostFix = this.addPostfix;
        //     this.addPostfix = null;
        // }
    }
    
    /**
     * @param {Comment} node
     */
    *processAnnotation(node) {
        if (this.isPreProcessor()) {
            return yield node;
        }
        
        let content = node.comment;
        
        if (!this.annoRegex) {
            this.annoRegex =  VerboseRegExp`
                (?:
                    (?:#.+(?:\n|$))
                    | (?<full>
                        @(?:
                              (?<name_1 > inline      )
                            | (?<name_12> noinline    )
                            | (?<name_21> forceinline )
                            | (?<name_2 > debug       )
                            | (?<name_15> pretty      )
                            | (?<name_19> nopretty    )
                            | (?<name_16> printops    )
                            | (?<name_17> disablect   )                             // check types
                            | (?<name_18> enablect    )                             // check types
                            | (?<name_3 > include     ) \s* "(?<path_1 >[^"]+?)"
                            | (?<name_20> includepref ) \s+  (?<pref_1> \S+)
                            | (?<name_4 > type        ) \s+  (?<type_1> \S+)
                            | (?<name_13> typedef     ) \s+  (?<type_3> \S+)     \s+ (?<tdef_1> \S+)
                            | (?<name_5 > return      ) \s+  (?<type_2> \S+)
                            | (?<name_14> this        ) \s+  (?<type_4> \S+)
                            | (?<name_6 > define      ) \s+  (?<arg1_1> \S+)     \s+ (?<arg2_1>  .+)
                            | (?<name_7 > ifdef       ) \s+  (?<arg1_2>  .+)
                            | (?<name_8 > ifndef      ) \s+  (?<arg1_3>  .+)
                            | (?<name_9 > compiler    ) \s+  (?<arg1_4> \S+)     \s+ (?<arg2_2>  .+)
                            | (?<name_10> error       ) \s+  (?<msg _1>  .+)
                            | (?<name_11> warn        ) \s+  (?<msg _2>  .+)
                            | (?<wname_1> \S*         )
                        )
                    )
                )
            ` `img`;
        }
        
        // for notepad++:
        // let words = ['inline' ...]
        // let out = '';
        // for (let word of words) {
        //     out += `@${word.toLowerCase()} @${word.toUpperCase()} @${word.toUpperCase()[0] + word.toLowerCase().slice(1)}\n`
        // }
        // console.log(out);
        
        for (let matched of content.matchAll(this.annoRegex)) {
            let cap = {};
            
            for (let group in matched.groups) {
                if (matched.groups[group] !== undefined)
                    cap[group.match(/^(.+?)(?:_\d+)?$/)[1]] = matched.groups[group];
            }
            
            if (!cap.full)
                continue;
            
            if (cap.wname) {
                console.warn(`undefined Annotation: ${cap.full}`);
                continue;
            }
            
            if (!cap.name)
                continue;
            
            let anno = null;
            let name = cap.name.toLowerCase();
            let saveAnnos;
            
            switch (name) {
                case 'inline':
                case 'noinline':
                case 'debug':
                case 'pretty':
                case 'nopretty':
                case 'printops':
                    anno = new Annotation({ name: name });
                    break;
                    
                case 'forceinline':
                    this.forceinline = true;
                    break;
                    
                case 'includepref':
                    this.includepref = cap.pref;
                    break;
                
                case 'disablect':
                    this.disablect = true;
                    break;
                    
                case 'enablect':
                    this.disablect = false;
                    break;
                
                case 'include':
                    anno = new Annotation({ name: name, value: { path: cap.path } });
                    break;
                
                case 'type':
                case 'return':
                case 'this':
                    if (!this.disablect)
                        anno = new Annotation({ name: name, value: { type: cap.type } });
                    break;
                
                case 'define':
                    saveAnnos = this.annotationsPop();
                    yield this.BlockFromRaw(cap.arg2);
                    this.annotationsPushAll(saveAnnos);
                    anno = new Annotation({ name: name, value: { name: cap.arg1, arg: cap.arg2, code: this.includePop().block } });
                    break;
                
                case 'ifdef':
                case 'ifndef':
                    saveAnnos = this.annotationsPop();
                    yield this.BlockFromRaw(cap.arg1);
                    this.annotationsPushAll(saveAnnos);
                    anno = new Annotation({ name: name, value: { arg: cap.arg1, code: this.includePop().block } });
                    break;
                
                case 'compiler':
                    anno = new Annotation({ name: name, value: { name: cap.arg1, arg: cap.arg2 } });
                    break;
                    
                case 'error':
                case 'warn':
                    anno = new Annotation({ name: name, value: { msg: cap.msg } });
                    break;
                    
                case 'typedef':
                    new Type(cap.tdef, `#${cap.tdef}`, new Type(cap.type));
                    break;
                    
                default: throw new Error(`Not registred annotation: ${name}`);
            }
            
            if (anno)
                this.annotationsPush(anno);
        }
        
        // for (let anno of node.comment.matchAll(/@(\w+)/g)) {
        //     this.annotationsPush(new Annotation({ value: anno[1] }));
        // }
        
        yield node;
    }
}

/**
 * @param {any} node 
 * @param {Scope} scope 
 * @param {number} depth 
 */
function *travel(node, scope, depth = 0) {
    depth++;
    
    for(let child of node){
        if (child.text && child.type) {
            if (child.type == -1) {
                yield new LexemEOF(child);
                continue;
            }
            
            if (child.text.match(/^[\s]+$/)) {
                yield new WhiteSpace(child);
                continue;
            }
            
            if (child.text[0] == '#') {
                yield new LexemComment(child);
                continue;
            }
            
            // if (scope.directOutput) {
            //     yield new LexemText(child);
            //     continue;
            // }
            
            switch(child.text) {
                case ':': yield new LexemColon(child); break;
                case ',': yield new LexemComma(child); break;
                case '~': yield new LexemTilt(child); break;
                case '$': yield new LexemDelta(child); break;
                case '?': yield new LexemQuest(child); break;
                case '->': yield new LexemInputs(child); break;
                case '...': yield new LexemVarArg(child); break;
                
                case '++': case '--':
                    yield new LexemOpIncDec(child);
                    break;
                
                case '+': case '-':
                case '*': case '/':
                case '%': case '^':
                    yield new LexemOpMath(child);
                    break;
                    
                case '+=': case '-=':
                case '*=': case '/=':
                case '=':
                    yield new LexemAss(child);
                    break;
                    
                case '<' : case '>' :
                case '<=': case '>=':
                case '==': case '!=':
                    yield new LexemComp(child);
                    break;
                
                case '&': case '|':
                case '!':
                    yield new LexemOpLogic(child);
                    break;
                    
                case '&&': case '||':
                case '^^':
                case '<<': case '>>':
                    yield new LexemOpBit(child);
                    break;
                    
                case '(': case ')':
                case '[': case ']':
                case '{': case '}':
                    yield new LexemBkt(child);
                    break;
                
                case 'function':
                case 'local':
                case 'event':
                case 'try':
                case 'catch':
                    
                case 'if':
                case 'else':
                case 'elseif':
                case 'switch':
                    
                case 'foreach':
                case 'while':
                case 'for':
                case 'do':
                    
                case 'continue':
                case 'return':
                case 'default':
                case 'break':
                case 'case':
                    yield new LexemKeyword(child);
                    break;
                
                default: yield new LexemText(child); break;
            }
            
            continue;
        }
        
        let [ type ] = Object.keys(child);
        let childNodes = child[type];
        
        let block = null;
        
        switch(type) {
            case 'root':
                if (scope.isPreProcessor()) {
                    throw Error('This is not allowed');
                }
                
                let directives = []
                
                for (let node of travel(childNodes, scope, depth)){
                    scope.EnteredNode(node);
                    switch(true) {
                        case node instanceof Directive: directives.push(node);       break;
                        case node instanceof Block:     block = node;                break;
                        case node instanceof LexemEOF:                               break;
                        case node instanceof PreProcessor: scope.lateStmtPush(node); break;
                        case node instanceof Delimiter:                              break;
                        case node instanceof Promise:   yield node;                  break;
                        default: throw new UnexpectedToken(node);
                    }
                    scope.LeaveNode(node);
                }
                
                yield new Root({ directives, block });
                break;
                
            case 'directive':
                // if (!scope.isPreProcessor()) {
                //     throw Error('This is preProccess instuction');
                // }
                
                let name;
                let value;
                let vars = [];
                
                scope.push();
                for (let node of travel(childNodes, scope, depth)){
                    scope.EnteredNode(node);
                    switch(true) {
                        case node instanceof LexemText:
                            [, name, value] = node.text.match(/@([\S]+)(?:\s+([^\r\n]+))?/);
                            break;
                            
                        case node instanceof Var:          vars.push(node);          break;
                        case node instanceof Delimiter:    yield node;               break;
                        case node instanceof Promise:      yield node;               break;
                        default: throw new UnexpectedToken(node);
                    }
                    scope.LeaveNode(node);
                }
                let lscope = scope.pop();
                
                for (let [, node] of Object.entries(lscope)) {
                    node.declareLocal = false;
                    scope.setVarForce(node);
                }
                
                yield new Directive({ name, value: vars.length ? vars : value });
                break;
                
            case 't_comma':
                for (let node of travel(childNodes, scope, depth)){
                    scope.EnteredNode(node);
                    switch(true) {
                        case node instanceof LexemComma: yield node; break;
                        case node instanceof Delimiter:  yield node; break;
                        case node instanceof Promise:    yield node; break;
                        default: throw new UnexpectedToken(node);
                    }
                    scope.LeaveNode(node);
                }
                break;
                
            case 't_block':
                for (let node of travel(childNodes, scope, depth)){
                    scope.EnteredNode(node);
                    switch(true) {
                        case node instanceof LexemBkt:              break;
                        case node instanceof Block:     yield node; break;
                        case node instanceof Delimiter: yield node; break;
                        case node instanceof Promise:   yield node; break;
                        default: throw new UnexpectedToken(node);
                    }
                    scope.LeaveNode(node);
                }
                break;
                
            case 't_function':
                let useThis = false;
                let types = [];
                let funcName = null;
                let args = null;
                
                function findThisType(childNodes){
                    for (let [index, node] of childNodes.entries()){
                        if (node.type && node.text == ':'){
                            for (let node of travel([childNodes[index - 1]], scope, depth)){
                                switch (true) {
                                    case node instanceof Type: return node;
                                    default: throw new UnexpectedToken(node);
                                }
                            }
                        }
                    }
                    
                    return null;
                }
                
                /** @return {any} */
                function findAnnos(annos) {
                    let ret = null;
                    let ths = null;
                    let inline = false;
                    
                    if (annos) {
                        for (let anno of annos) {
                            if (anno.name == 'return') {
                                ret = new Type(anno.value.type);
                            }
                            if (anno.name == 'this') {
                                ths = new Type(anno.value.type);
                            }
                            if (anno.name == 'inline') {
                                inline = true;
                            }
                        }
                    }
                    
                    return [ ret, ths, inline ];
                }
                
                let _thisType = findThisType(childNodes);
                
                scope.push();
                if (_thisType) {
                    scope.setVarForce(new Var({
                        name: 'This',
                        type: _thisType,
                        declareLocal: true,
                    }));
                }
                
                let returnType = scope.void;
                let thisType = null;
                
                let t_function_annotation = scope.annotationsPop();
                let [ _nRet, _nThs, _inline ] = findAnnos(t_function_annotation);
                
                for (let node of travel(childNodes, scope, depth)){
                    scope.EnteredNode(node);
                    switch(true) {
                        case node instanceof LexemKeyword:                          break;
                        case node instanceof LexemFuncName:
                            funcName = node.value;
                            break;
                        case node instanceof LexemColon:    useThis = true;         break;
                        case node instanceof LexemFuncArgs:
                            args = node.value;
                            
                            if (types.length == 2){
                                returnType = types[0];
                                thisType = types[1];
                            } else if (types.length == 1 && !useThis) {
                                returnType = types[0];
                            } else if (types.length == 1 && useThis) {
                                thisType = types[0];
                            }
                            
                            if (returnType) {
                                scope.returnTypePush(returnType);
                            }
                            
                            if (_nRet && returnType)
                                returnType = _nRet;
                            
                            if (_nThs && thisType)
                                thisType = _nThs;
                            
                            scope.declareCustomFunction(/** @type {Func} */ ({
                                name: funcName,
                                parameters: args,
                                returnType,
                                thisType,
                                ops: args[args?.length - 1] instanceof VarArg ? 80 : 40,
                                inline: _inline || scope.forceinline,
                            }));
                            break;
                        case node instanceof Type:
                            types.push(node);
                            break;
                        case node instanceof Block:         block = node;           break;
                        // case node instanceof Annotation:    annotations.push(node); break;
                        case node instanceof Delimiter:     yield node;             break;
                        case node instanceof Promise:       yield node;             break;
                        default: throw new UnexpectedToken(node);
                    }
                    scope.LeaveNode(node);
                }
                if (returnType)
                    scope.returnTypePop();
                scope.pop();
                
                yield scope.declareCustomFunction(new Func({
                    annotations: t_function_annotation,
                    name: funcName,
                    body: block,
                    parameters: args,
                    returnType,
                    thisType,
                    inline: _inline || scope.forceinline,
                    source: node,
                }));
                break;
            
            case 't_fun_name':
                for (let node of travel(childNodes, scope, depth)){
                    scope.EnteredNode(node);
                    switch(true) {
                        case node instanceof LexemText: yield new LexemFuncName({ value: node.text }); break;
                        case node instanceof Delimiter: yield node;                                    break;
                        case node instanceof Promise:   yield node;                                    break;
                        default: throw new UnexpectedToken(node);
                    }
                    scope.LeaveNode(node);
                }
                break;
                
            case 't_function_args':
                let func_args = [];
                
                for (let node of travel(childNodes, scope, depth)){
                    scope.EnteredNode(node);
                    switch(true) {
                        case node instanceof LexemBkt:                        break;
                        case node instanceof LexemComma:                      break;
                        case node instanceof VarArg:
                        case node instanceof Var:       func_args.push(node); break;
                        case node instanceof Delimiter: yield node;           break;
                        case node instanceof Promise:   yield node;           break;
                        default: throw new UnexpectedToken(node);
                    }
                    scope.LeaveNode(node);
                }
                
                yield new LexemFuncArgs({ value: func_args });
                break;
                
            case 't_function_vararg':
                let vararg_name = null;
                let vararg_type = null;
                
                for (let node of travel(childNodes, scope, depth)){
                    scope.EnteredNode(node);
                    switch(true) {
                        case node instanceof LexemVarArg:                          break;
                        case node instanceof LexemText:   vararg_name = node.text; break;
                        case node instanceof LexemColon:                           break;
                        case node instanceof Type:        vararg_type = node;      break;
                        case node instanceof Delimiter:   yield node;              break;
                        case node instanceof Promise:     yield node;              break;
                        default: throw new UnexpectedToken(node);
                    }
                    scope.LeaveNode(node);
                }
                
                yield new VarArg({
                    var: scope.setVarForce(new Var({
                        annotations: scope.annotationsPop(),
                        name: vararg_name,
                        type: vararg_type,
                        declareLocal: true,
                    })),
                });
                break;
                
            case 't_function_arg':
                let arg_name = null;
                let arg_type = null;
                
                for (let node of travel(childNodes, scope, depth)){
                    scope.EnteredNode(node);
                    switch(true) {
                        case node instanceof LexemText:   arg_name = node.text; break;
                        case node instanceof LexemColon:                        break;
                        case node instanceof Type:        arg_type = node;      break;
                        case node instanceof Delimiter:   yield node;           break;
                        case node instanceof Promise:     yield node;           break;
                        default: throw new UnexpectedToken(node);
                    }
                    scope.LeaveNode(node);
                }
                
                yield scope.setVarForce(new Var({
                    annotations: scope.annotationsPop(),
                    name: arg_name,
                    type: arg_type ?? scope.default,
                    declareLocal: true,
                }));
                break;
                
            case 't_function_args_typed':
                let args_typed_vars = [];
                let args_typed_vars_t = null;
                
                let args_typed_vars_ganno = scope.annotationsPop();
                
                for (let node of travel(childNodes, scope, depth)){
                    scope.EnteredNode(node);
                    switch(true) {
                        case node instanceof LexemText:
                            args_typed_vars.push([ node.text, scope.annotationsPop()]); break;
                        case node instanceof LexemComma:                                break;
                        case node instanceof LexemColon:                                break;
                        case node instanceof LexemBkt:                                  break;
                        case node instanceof Type:       args_typed_vars_t = node;      break;
                        case node instanceof Delimiter:  yield node;                    break;
                        case node instanceof Promise:    yield node;                    break;
                        default: throw new UnexpectedToken(node);
                    }
                    scope.LeaveNode(node);
                }
                
                for(let [ name, anno ] of args_typed_vars){
                    yield scope.setVarForce(new Var({
                        annotations: args_typed_vars_ganno.concat(anno),
                        name, type:
                        args_typed_vars_t ?? scope.default,
                        declareLocal: true,
                    }));
                }
                break;
                
            case 't_return':
                let t_return = null;
                
                for (let node of travel(childNodes, scope, depth)){
                    scope.EnteredNode(node);
                    switch(true) {
                        case node instanceof LexemText:
                            if (node.text == 'void')
                                continue;
                            
                            throw new UnexpectedToken(node);
                        case node instanceof LexemKeyword:                                    break;
                        case node instanceof Expression:   t_return = node;                   break;
                        case node instanceof Delimiter:    yield node;                        break;
                        case node instanceof Promise:      yield node;                        break;
                        default: throw new UnexpectedToken(node);
                    }
                    scope.LeaveNode(node);
                }
                
                let neededReturnType = scope.returnTypeGet();
                
                if (neededReturnType != t_return.return) {
                    throw new DifferentReturnType(`${neededReturnType.type} type is different from ${t_return.return.type}`);
                }
                
                if (!scope.funcDeclareDisableIs()) {
                    yield new Return({
                        annotations: scope.annotationsPop(),
                        value: t_return,
                    });
                } else {
                    yield new Assignment({
                        annotations: scope.annotationsPop(),
                        value: t_return,
                        assop: '=',
                        target: scope.funcDeclareDisableIs(),
                        return: t_return.return,
                        local: false,
                    });
                }
                break;
                
            case 't_condition':
                for (let node of travel(childNodes, scope, depth)){
                    scope.EnteredNode(node);
                    switch(true) {
                        case node instanceof LexemBkt:                                              break;
                        case node instanceof Expression: yield new LexemCondition({ value: node }); break;
                        case node instanceof Delimiter:  yield node;                                break;
                        case node instanceof Promise:    yield node;                                break;
                        default: throw new UnexpectedToken(node);
                    }
                    scope.LeaveNode(node);
                }
                break;
                
            case 't_kv':
                let t_kv = [];
                
                for (let node of travel(childNodes, scope, depth)){
                    scope.EnteredNode(node);
                    switch(true) {
                        case node instanceof LexemAss:                    break;
                        case node instanceof Expression: t_kv.push(node); break;
                        case node instanceof Delimiter:  yield node;      break;
                        case node instanceof Promise:    yield node;      break;
                        default: throw new UnexpectedToken(node);
                    }
                    scope.LeaveNode(node);
                }
                
                if (t_kv.length == 2) {
                    yield new KV({ key: t_kv[0], value: t_kv[1] });
                } else {
                    yield t_kv[0];
                }
                
                break;
                
            case 't_args':
                let t_args = [];
                
                for (let node of travel(childNodes, scope, depth)){
                    scope.EnteredNode(node);
                    switch(true) {
                        case node instanceof LexemBkt:                      break;
                        case node instanceof LexemComma:                    break;
                        case node instanceof Expression: t_args.push(node); break;
                        case node instanceof Delimiter:  yield node;        break;
                        case node instanceof Promise:    yield node;        break;
                        default: throw new UnexpectedToken(node);
                    }
                    scope.LeaveNode(node);
                }
                
                yield new LexemArgs({ value: t_args });
                break;
                
            case 't_index':
                let t_index_exp = null;
                let t_index_type = null;
                let t_index_ops = 0;
                
                scope.assDisablePush();
                for (let node of travel(childNodes, scope, depth)){
                    scope.EnteredNode(node);
                    switch(true) {
                        case node instanceof LexemBkt:                        break;
                        case node instanceof LexemComma:                      break;
                        case node instanceof Expression: t_index_exp  = node; break;
                        case node instanceof Type:       t_index_type = node; break;
                        case node instanceof Delimiter:  yield node;          break;
                        case node instanceof Promise:    yield node;          break;
                        default: throw new UnexpectedToken(node);
                    }
                    scope.LeaveNode(node);
                }
                scope.assDisablePop();
                
                if (!t_index_type) {
                    let op = scope.getOP('idx', [scope.exps()[scope.exps().length - 1], t_index_exp]);
                    
                    t_index_type = op.return;
                    t_index_ops = op.ops;
                } else {
                    let op = scope.getOP('idx', [new Expression({ return: t_index_type }), '=', scope.exps()[scope.exps().length - 1], t_index_exp]);
                    
                    t_index_ops = op.ops;
                }
                
                yield new Index({ value: t_index_exp, type: t_index_type, ops: t_index_ops });
                break;
                
            case 't_call':
                let callee = null;
                let t_call_args = null;
                
                for (let node of travel(childNodes, scope, depth)){
                    scope.EnteredNode(node);
                    switch(true) {
                        case node instanceof LexemFuncName: callee = node.value;      break;
                        case node instanceof LexemArgs:     t_call_args = node.value; break;
                        case node instanceof Delimiter:     yield node;               break;
                        case node instanceof Promise:       yield node;               break;
                        default: throw new UnexpectedToken(node);
                    }
                    scope.LeaveNode(node);
                }
                
                if (scope.flag_isMethod == depth) {
                    scope.funcRetTypeDisablePush();
                }
                
                // if (scope.exps().length) {
                //     t_call_args.unshift(scope.exps()[0]);
                // }
                
                yield new Call({
                    annotations: scope.annotationsPop(),
                    callee,
                    arguments: t_call_args,
                    method: false,
                    ...scope.getFunction(callee, t_call_args, scope.exps().length ? scope.exps()[scope.exps().length - 1].return : null),
                });
                
                if (scope.flag_isMethod == depth) {
                    scope.funcRetTypeDisablePop();
                    scope.flag_isMethod = 0;
                }
                break;
                
            case 't_call_method':
                let t_call_method_callee = null;
                let t_call_method_method = null;
                // let t_call_backlink = [];
                
                scope.flag_isMethod = depth + 1;
                // if (scope.flag_expsMethodNoPush != depth) {
                //     scope.expsPush(t_call_backlink);
                // }
                scope.expsPush(scope.exps().slice());
                for (let node of travel(childNodes, scope, depth)){
                    scope.EnteredNode(node);
                    switch(true) {
                        case node instanceof LexemColon:                     break;
                        case node instanceof Call:
                            if (node.method) {
                                t_call_method_method = node;
                            } else {
                                t_call_method_callee = node;
                                // t_call_backlink.push(node);
                            }
                            scope.exps().push(node);
                            break;
                        case node instanceof Delimiter: yield node;          break;
                        case node instanceof Promise:   yield node;          break;
                        default: throw new UnexpectedToken(node);
                    }
                    scope.LeaveNode(node);
                }
                scope.expsPop();
                // if (scope.flag_expsMethodNoPush != depth) {
                //     scope.expsPop();
                //     scope.flag_expsMethodNoPush = 0;
                // }
                
                t_call_method_callee.method = true;
                
                if (t_call_method_method) {
                    // let parm = scope.getFunction(
                    //     t_call_method_method.parent.value.callee,
                    //     t_call_method_method.parent.value.arguments,
                    //     t_call_method_callee.return,
                    // );
                    t_call_method_method.parent.value.arguments.unshift(
                        /** @type {any} */ (t_call_method_callee)
                    );
                    t_call_method_method.parent.value = t_call_method_callee;
                    // Object.assign(t_call_method_method, parm);
                    
                    t_call_method_method.recalculateTotalOps(-1);
                    
                    yield t_call_method_method;
                } else {
                    t_call_method_callee.parent.value = t_call_method_callee;
                    
                    yield t_call_method_callee;
                }
                break;
                
            case 't_if':
                let t_if_condition = null;
                let t_if_block_true = null;
                let t_if_block_false = null;
                let t_if_anno = scope.annotationsPop();
                
                for (let node of travel(childNodes, scope, depth)){
                    scope.EnteredNode(node);
                    switch(true) {
                        case node instanceof LexemKeyword:                                  break;
                        case node instanceof LexemCondition: t_if_condition = node.value;   break;
                        case node instanceof LexemElseIf:    t_if_block_false = node.value; break;
                        case node instanceof LexemElse:      t_if_block_false = node.value; break;
                        case node instanceof Block:          t_if_block_true = node;        break;
                        case node instanceof Delimiter:      yield node;                    break;
                        case node instanceof Promise:        yield node;                    break;
                        default: throw new UnexpectedToken(node);
                    }
                    scope.LeaveNode(node);
                }
                
                scope.applyOP(t_if_condition, 'is');
                
                yield new If({
                    annotations: t_if_anno,
                    condition: t_if_condition,
                    bodyTrue: t_if_block_true,
                    bodyFalse: t_if_block_false,
                    ...scope.getOP('if', [t_if_condition]),
                });
                break;
                
            case 't_elseif':
                let t_elseif_condition = null;
                let t_elseif_block_true = null;
                let t_elseif_block_false = null;
                let t_elseif_anno = scope.annotationsPop();
                
                for (let node of travel(childNodes, scope, depth)){
                    scope.EnteredNode(node);
                    switch(true) {
                        case node instanceof LexemKeyword:                                      break;
                        case node instanceof LexemCondition: t_elseif_condition   = node.value; break;
                        case node instanceof LexemElseIf:    t_elseif_block_false = node.value; break;
                        case node instanceof LexemElse:      t_elseif_block_false = node.value; break;
                        case node instanceof Block:          t_elseif_block_true  = node;       break;
                        case node instanceof Delimiter:      yield node;                        break;
                        case node instanceof Promise:        yield node;                        break;
                        default: throw new UnexpectedToken(node);
                    }
                    scope.LeaveNode(node);
                }
                if (t_elseif_block_true) {
                    yield new LexemElseIf({
                        value: new Block({
                            statements: [
                                new If({
                                    annotations: t_elseif_anno,
                                    condition: t_elseif_condition,
                                    bodyTrue: t_elseif_block_true,
                                    bodyFalse: t_elseif_block_false,
                                }),
                            ],
                            ...scope.getOP('seq', [])
                        }),
                    });
                } else {
                    yield new LexemElse({ value: t_elseif_block_false });
                }
                break;
                
            case 't_else':
                for (let node of travel(childNodes, scope, depth)){
                    scope.EnteredNode(node);
                    switch(true) {
                        case node instanceof LexemKeyword:                                       break;
                        case node instanceof Block:        yield new LexemElse({ value: node }); break;
                        case node instanceof Delimiter:    yield node;                           break;
                        case node instanceof Promise:      yield node;                           break;
                        default: throw new UnexpectedToken(node);
                    }
                    scope.LeaveNode(node);
                }
                break;
                
            case 't_switch':
                let t_switch_condition = null;
                let t_switch_block = null;
                let t_switch_anno = scope.annotationsPop();
                
                for (let node of travel(childNodes, scope, depth)){
                    scope.EnteredNode(node);
                    switch(true) {
                        case node instanceof LexemKeyword:                                    break;
                        case node instanceof SwitchBlock:    t_switch_block     = node;       break;
                        case node instanceof LexemCondition: t_switch_condition = node.value; break;
                        case node instanceof Delimiter:    yield node;                        break;
                        case node instanceof Promise:      yield node;                        break;
                        default: throw new UnexpectedToken(node);
                    }
                    scope.LeaveNode(node);
                }
                
                yield new Switch({
                    annotations: t_switch_anno,
                    switch: t_switch_condition,
                    body: t_switch_block,
                });
                break;
                
            case 't_switch_block':
                let t_switch_statements = [];
                
                for (let node of travel(childNodes, scope, depth)){
                    scope.EnteredNode(node);
                    switch(true) {
                        case node instanceof LexemBkt:                                     break;
                        case node instanceof SwitchToken:  t_switch_statements.push(node); break;
                        case node instanceof Block:        t_switch_statements.push(node); break;
                        case node instanceof Delimiter:    yield node;                     break;
                        case node instanceof Promise:      yield node;                     break;
                        default: throw new UnexpectedToken(node);
                    }
                    scope.LeaveNode(node);
                }
                
                yield new SwitchBlock({
                    statements: t_switch_statements,
                });
                break;
                
            case 't_case_block':
                let t_case_block_anno = scope.annotationsPop();
                
                for (let node of travel(childNodes, scope, depth)){
                    scope.EnteredNode(node);
                    switch(true) {
                        case node instanceof LexemKeyword:
                            if (node.text == 'default') {
                                yield new SwitchDefault({ annotations: t_case_block_anno });
                            }
                            break;
                        case node instanceof LexemComma:                                            break;
                        case node instanceof Expression:
                            yield new SwitchCase({ annotations: t_case_block_anno, switch: node }); break;
                        case node instanceof Block:      yield node;                                break;
                        case node instanceof Delimiter:  yield node;                                break;
                        case node instanceof Promise:    yield node;                                break;
                        default: throw new UnexpectedToken(node);
                    }
                    scope.LeaveNode(node);
                }
                break;
                
            case 't_while':
                let t_while_condition = null;
                let t_while_block = null;
                let t_while_anno = scope.annotationsPop();
                
                for (let node of travel(childNodes, scope, depth)){
                    scope.EnteredNode(node);
                    switch(true) {
                        case node instanceof LexemKeyword:                                   break;
                        case node instanceof LexemCondition: t_while_condition = node.value; break;
                        case node instanceof Block:          t_while_block = node;           break;
                        case node instanceof Delimiter:      yield node;                     break;
                        case node instanceof Promise:        yield node;                     break;
                        default: throw new UnexpectedToken(node);
                    }
                    scope.LeaveNode(node);
                }
                
                yield new While({
                    annotations: t_while_anno,
                    condition: t_while_condition,
                    body: t_while_block,
                    ...scope.getOP('whl', []),
                })
                break;
                
            case 't_do_while':
                let t_do_while_condition = null;
                let t_do_while_block = null;
                let t_do_while_anno = scope.annotationsPop();
                
                for (let node of travel(childNodes, scope, depth)){
                    scope.EnteredNode(node);
                    switch(true) {
                        case node instanceof LexemKeyword:                                      break;
                        case node instanceof LexemCondition: t_do_while_condition = node.value; break;
                        case node instanceof Block:          t_do_while_block = node;           break;
                        case node instanceof Delimiter:      yield node;                        break;
                        case node instanceof Promise:        yield node;                        break;
                        default: throw new UnexpectedToken(node);
                    }
                    scope.LeaveNode(node);
                }
                
                yield new DoWhile({
                    annotations: t_do_while_anno,
                    condition: t_do_while_condition,
                    body: t_do_while_block,
                    ...scope.getOP('whl', []),
                })
                break;
                
            case 't_for':
                let t_for_var = null;
                let t_for_exps = [];
                let t_for_block = null;
                let t_for_anno = scope.annotationsPop();
                
                scope.push();
                for (let node of travel(childNodes, scope, depth)){
                    scope.EnteredNode(node);
                    switch(true) {
                        case node instanceof LexemKeyword:                      break;
                        case node instanceof LexemComma:                        break;
                        case node instanceof LexemBkt:                          break;
                        case node instanceof LexemAss:                          break;
                        case node instanceof LexemText:
                            t_for_var = scope.setVarForce(new Var({
                                name: node.text,
                                type: scope.number,
                                declareLocal: true,
                            }));
                            break;
                        case node instanceof Expression: t_for_exps.push(node); break;
                        case node instanceof Block:      t_for_block = node;    break;
                        case node instanceof Delimiter:  yield node;            break;
                        case node instanceof Promise:    yield node;            break;
                        default: throw new UnexpectedToken(node);
                    }
                    scope.LeaveNode(node);
                }
                scope.pop();
                
                yield new For({
                    annotations: t_for_anno,
                    name: t_for_var,
                    condition: t_for_exps[0],
                    values: t_for_exps.slice(1),
                    body: t_for_block,
                    ...scope.getOP('for', []),
                })
                break;
                
            case 't_foreach':
                let t_foreach_exp = null;
                let t_foreach_vars_name = [];
                let t_foreach_vars_type = [];
                let t_foreach_block = null;
                
                let t_foreach_key = null;
                let t_foreach_value = null;
                let t_foreach_anno = scope.annotationsPop();
                
                scope.push();
                for (let node of travel(childNodes, scope, depth)){
                    scope.EnteredNode(node);
                    switch(true) {
                        case node instanceof LexemKeyword:                                    break;
                        case node instanceof LexemBkt:                                        break;
                        case node instanceof LexemAss:                                        break;
                        case node instanceof LexemComma:                                      break;
                        case node instanceof LexemColon:                                      break;
                        case node instanceof LexemText:  t_foreach_vars_name.push(node.text); break;
                        case node instanceof Type:       t_foreach_vars_type.push(node);      break;
                        case node instanceof Expression:
                            t_foreach_exp = node;
                            
                            if (t_foreach_vars_type.length == 2) {
                                t_foreach_key = scope.setVarForce(new Var({
                                    name: t_foreach_vars_name[0],
                                    type: t_foreach_vars_type[0],
                                    declareLocal: true,
                                }));
                                t_foreach_value = scope.setVarForce(new Var({
                                    name: t_foreach_vars_name[1],
                                    type: t_foreach_vars_type[1],
                                    declareLocal: true,
                                }));
                            } else if (t_foreach_vars_type.length == 1) { // find key type
                                let t_foreach_val_type_exp = new Expression({ return: t_foreach_vars_type[0] });
                                let t_foreach_key_type = null;
                                
                                if (scope.getOP('fea', [ 's', t_foreach_val_type_exp, t_foreach_exp ], true) != null) {
                                    t_foreach_key_type = scope.string;
                                } else if (scope.getOP('fea', [ 'n', t_foreach_val_type_exp, t_foreach_exp ], true) != null) {
                                    t_foreach_key_type = scope.number;
                                } else {
                                    throw new NoSuchOperator(`fea([unknown]${t_foreach_val_type_exp.return.tag})${t_foreach_exp.return.tag})`);
                                }
                                
                                t_foreach_key = scope.setVarForce(new Var({
                                    name: t_foreach_vars_name[0],
                                    type: t_foreach_key_type,
                                    declareLocal: true,
                                }));
                                t_foreach_value = scope.setVarForce(new Var({
                                    name: t_foreach_vars_name[1],
                                    type: t_foreach_vars_type[0],
                                    declareLocal: true,
                                }));
                            } else { throw new NotEnoughArgsOfToken(); }
                            break;
                        case node instanceof Block:      t_foreach_block = node;              break;
                        case node instanceof Delimiter:  yield node;                          break;
                        case node instanceof Promise:    yield node;                          break;
                        default: throw new UnexpectedToken(node);
                    }
                    scope.LeaveNode(node);
                }
                scope.pop();
                
                yield new Foreach({
                    annotations: t_foreach_anno,
                    key: t_foreach_key,
                    value: t_foreach_value,
                    array: t_foreach_exp,
                    body: t_foreach_block,
                    ...scope.getOP('fea', [t_foreach_key, t_foreach_value, t_foreach_exp]),
                })
                break;
                
            case 't_try':
                let t_try_block = [];
                let t_try_var = null;
                let t_try_anno = scope.annotationsPop();
                
                scope.push();
                for (let node of travel(childNodes, scope, depth)){
                    scope.EnteredNode(node);
                    switch(true) {
                        case node instanceof LexemKeyword:                            break;
                        case node instanceof LexemBkt:                                break;
                        case node instanceof LexemText:
                            t_try_var = scope.setVarForce(new Var({
                                name: node.text,
                                declareLocal: true,
                                type: scope.string,
                            }));
                            break;
                        case node instanceof Block:        t_try_block.push(node);    break;
                        // case node instanceof Annotation:   annotations.push(node);    break;
                        case node instanceof Delimiter:    yield node;                break;
                        case node instanceof Promise:      yield node;                break;
                        default: throw new UnexpectedToken(node);
                    }
                    scope.LeaveNode(node);
                }
                scope.pop();
                
                yield new Try({
                    annotations: t_try_anno,
                    body: t_try_block[0],
                    catch: t_try_block[1],
                    catchVar: t_try_var,
                    ...scope.getOP('try', []),
                });
                break;
                
            case 't_event':
                let t_event_name = null;
                let t_event_args = null;
                let t_event_anno = scope.annotationsPop();
                
                scope.push();
                for (let node of travel(childNodes, scope, depth)){
                    scope.EnteredNode(node);
                    switch(true) {
                        case node instanceof LexemKeyword:                             break;
                        case node instanceof LexemFuncName: t_event_name = node.value; break;
                        case node instanceof LexemFuncArgs: t_event_args = node.value; break;
                        case node instanceof Block:         block = node;              break;
                        // case node instanceof Annotation:    annotations.push(node);    break;
                        case node instanceof Delimiter:     yield node;                break;
                        case node instanceof Promise:       yield node;                break;
                        default: throw new UnexpectedToken(node);
                    }
                    scope.LeaveNode(node);
                }
                scope.pop();
                
                yield new Event({
                    annotations: t_event_anno,
                    body: block,
                    name: t_event_name,
                    parameters: t_event_args,
                });
                break;
                
            case 't_lassign':
                let t_lassign_local = childNodes[0] && childNodes[0].text == 'local';
                let t_lassign_last = scope.assignLocal;
                
                scope.assignLocal = t_lassign_local;
                for (let node of travel(childNodes.slice().reverse(), scope, depth)){
                    scope.EnteredNode(node);
                    switch(true) {
                        case node instanceof LexemKeyword:            break;
                        case node instanceof Assignment:  yield node; break;
                        case node instanceof Delimiter:   yield node; break;
                        case node instanceof Promise:     yield node; break;
                        default: throw new UnexpectedToken(node);
                    }
                    scope.LeaveNode(node);
                }
                scope.assignLocal = t_lassign_last;
                break;
                
            case 't_assign':
                let t_assign_op = null;
                let t_assign = [];
                // let t_assign_local = childNodes[0] && childNodes[0].text == 'local';
                let t_assign_late = [];
                let t_assign_anno = scope.annotationsPop();
                
                for (let node of travel(childNodes.slice().reverse(), scope, depth)){
                    scope.EnteredNode(node);
                    switch(true) {
                        case node instanceof LexemKeyword:                        break;
                        case node instanceof LexemAss:
                            t_assign_op = node.text;
                            
                            if (t_assign_op.length != 1)
                                scope.assigmentPop();
                            break;
                        case node instanceof Expression:
                            if (!t_assign.length)
                                scope.assigmentPush(node.return, scope.assignLocal /* t_assign_local */);
                                
                            t_assign.push(node);
                            break;
                        case node instanceof Assignment:
                            if (!t_assign.length) {
                                scope.assigmentPush(node.target.return, scope.assignLocal /* t_assign_local */);
                                t_assign.push(node.target);
                            }
                            
                            yield node;
                            break;
                        case node instanceof Delimiter:  t_assign_late.push(node); break;
                        case node instanceof Promise:    t_assign_late.push(node); break;
                        default: throw new UnexpectedToken(node);
                    }
                    scope.LeaveNode(node);
                }
                
                if (t_assign_op.length == 1){
                    scope.assigmentPop();
                } else {
                    let op = t_assign_op.slice(0, t_assign_op.length - 1);
                    
                    t_assign[0] = new Binary({
                        left: t_assign[1],
                        operator: op,
                        right: t_assign[0],
                        ...scope.getOP(Scope.BINARY_TO_OPNAME[op], [t_assign[1], t_assign[0]]),
                    });
                }
                
                let isLocal = scope.assignLocal;
                
                for (let late of t_assign_late) {
                    yield late;
                }
                
                yield new Assignment({
                    local: isLocal,
                    annotations: t_assign_anno,
                    target: t_assign[1],
                    assop: t_assign_op,
                    value: t_assign[0],
                    return: t_assign[1].return,
                    ...scope.getOP('ass', [t_assign[1]]),
                });
                break;
                
            case 'stmts':
                let stmts = [];
                /** @type {any} */
                let late = [];
                // function pushCommentIsPrevToken(str) {
                //     let stmt = stmts[stmts.length - 1];
                    
                //     if (stmt.value !== undefined) {
                //         stmt.value += str;
                //     }
                // }
                
                scope.prestmt.push(stmts);
                
                function *include(node) {
                    let annos = scope.annotationsPop();
                    yield scope.IncludeToBlock(node.path); // await Promise, throw level [after root], in Scope.includePop - tree include [root -> block]
                    
                    stmts.push(
                        new Include({
                            pref: scope.includepref,
                            annotations: annos,
                            path: node.import,
                            body: scope.includePop(),
                            ...scope.getOP('include', []),
                        }),
                    );
                    
                    if (late.length) { stmts = stmts.concat(late); late = []; }
                }
                
                scope.push();
                for (let node of scope.lateStmtPopAll()) { // include from directive, hack, latter init
                    scope.EnteredNode(node);
                    switch(true) {
                        case node instanceof PPinclude:
                            yield* include(node);
                            break;
                        case node instanceof PreProcessor:
                            stmts.push(node);
                            if (late.length) { stmts = stmts.concat(late); late = []; }
                            break;
                        default: throw new UnexpectedToken(node);
                    }
                    scope.LeaveNode(node);
                }
                
                for (let node of travel(childNodes, scope, depth)){
                    scope.EnteredNode(node);
                    switch(true) {
                        case node instanceof PPinclude:
                            yield* include(node);
                            break;
                            
                        case node instanceof LexemKeyword:
                            if (node.text == 'break')
                                stmts.push(new Break({ ...scope.getOP('brk', []) }));
                                
                            else if (node.text == 'continue')
                                stmts.push(new Continue({ ...scope.getOP('cnt', []) }));
                            
                            if (late.length) { stmts = stmts.concat(late); late = []; }
                            break;
                        
                        case node instanceof Expression:
                        case node instanceof Statement:
                            stmts.push(node);
                            
                            if (late.length) { stmts = stmts.concat(late); late = []; }
                            break;
                            
                        case node instanceof PreProcessor:
                            // stmts.push(node);
                            // scope.addPostfix = node.value;
                            // if (node instanceof PPifdef || node instanceof PPifndef) {
                            //     scope.directOutput = true;
                            // } else if (node instanceof PPendif) {
                            //     scope.directOutput = false;
                            // }
                            
                            if (node instanceof PPendif) {
                                late.push(node);
                            } else stmts.push(node);
                            break;
                        
                        // case node instanceof LexemText:
                            // if (scope.directOutput) {
                            //     pushCommentIsPrevToken(node.text);
                            // } else throw new UnexpectedToken(node);
                            // break;
                        
                        // case node instanceof LexemComment:
                        //     let content = /** @type {string} */ (node.text);
                            
                        //     if (content.substring(0,2) == '#[') {
                        //         stmts.push(new CommentBlock({ comment: content }));
                        //     } else if (content.substring(0,8) == '#include') {
                        //         stmts.push(new PPinclude({ value: content }));
                        //     } else if (content.substring(0,6) == '#ifdef') {
                        //         stmts.push(new PPifdef({ value: content }));
                        //     } else if (content.substring(0,7) == '#ifndef') {
                        //         stmts.push(new PPifndef({ value: content }));
                        //     } else if (content.substring(0,5) == '#else') {
                        //         stmts.push(new PPelse({ value: content }));
                        //     } else if (content.substring(0,6) == '#endif') {
                        //         stmts.push(new PPendif({ value: content }));
                        //     } else {
                        //         stmts.push(new Comment({ comment: content }));
                        //     }
                            
                            // if (scope.directOutput) {
                            //     pushCommentIsPrevToken(node.comment);
                            // } else yield node;
                            // break;
                        
                        case node instanceof Delimiter:
                            // if (scope.directOutput) {
                            //     pushCommentIsPrevToken(node.text);
                            // } else
                            yield node;
                            break;
                        case node instanceof LexemComma:             break;
                        case node instanceof Promise:    yield node; break;
                        default: throw new UnexpectedToken(node);
                    }
                    scope.LeaveNode(node);
                }
                scope.pop();
                
                if (late.length) { stmts = stmts.concat(late); late = []; }
                
                scope.prestmt.pop();
                yield new Block({ statements: stmts, ...scope.getOP('seq', []) });
                break;
                
            case 'expr':
                for (let node of travel(childNodes, scope, depth)){
                    scope.EnteredNode(node);
                    switch(true) {
                        case node instanceof Expression: yield node; break;
                        case node instanceof Assignment: yield node; break;
                        case node instanceof Delimiter:  yield node; break;
                        case node instanceof Promise:    yield node; break;
                        default: throw new UnexpectedToken(node);
                    }
                    scope.LeaveNode(node);
                }
                break;
                
            case 'dmtr':
                function toToken(node) {
                    return {
                        text: node.text,
                        line: node.line,
                        type: node.type,
                    }
                }
                
                for (let node of travel(childNodes, scope, depth)){
                    scope.EnteredNode(node);
                    switch(true) {
                        case node instanceof WhiteSpace:   break;
                        case node instanceof LexemComment:
                            let content = /** @type {string} */ (node.text);
                            
                            if (content.substring(0,2) == '#[') {
                                yield* scope.processAnnotation(
                                    new CommentBlock({ comment: content.slice(2).slice(0, -2), origin: toToken(node) })
                                );
                            } else if (content.substring(0,8) == '#include') {
                                yield new PPinclude({ value: content, origin: toToken(node) });
                            } else if (content.substring(0,6) == '#ifdef') {
                                yield new PPifdef({ value: content, origin: toToken(node) });
                            } else if (content.substring(0,7) == '#ifndef') {
                                yield new PPifndef({ value: content, origin: toToken(node) });
                            } else if (content.substring(0,5) == '#else') {
                                yield new PPelse({ value: content, origin: toToken(node) });
                            } else if (content.substring(0,6) == '#endif') {
                                yield new PPendif({ value: content, origin: toToken(node) });
                            } else {
                                yield* scope.processAnnotation(
                                    new Comment({ comment: content.slice(1), origin: toToken(node) })
                                );
                            }
                            break;
                        case node instanceof Promise:    yield node; break;
                        default: throw new UnexpectedToken(node);
                    }
                    scope.LeaveNode(node);
                }
                break;
                
            case 'pp':
            case 'stmt1':
                for (let node of travel(childNodes, scope, depth)){
                    scope.EnteredNode(node);
                    yield node;
                    scope.LeaveNode(node);
                }
                break;
                
            case 'lexem_string':
                for (let node of travel(childNodes, scope, depth)){
                    scope.EnteredNode(node);
                    switch(true) {
                        case node instanceof LexemText:
                            yield new LexemString({ value: node.text.substring(1, node.text.length - 1) });
                            break;
                        case node instanceof Promise:    yield node; break;
                        default: throw new UnexpectedToken(node);
                    }
                    scope.LeaveNode(node);
                }
                break;
                
            case 'lexem_number':
                for (let node of travel(childNodes, scope, depth)){
                    scope.EnteredNode(node);
                    switch(true) {
                        case node instanceof LexemText:
                            yield new LexemNumber({ value: node.text });
                            break;
                        case node instanceof Promise:    yield node; break;
                        default: throw new UnexpectedToken(node);
                    }
                    scope.LeaveNode(node);
                }
                break;
                
            case 'lexem_constant':
                for (let node of travel(childNodes, scope, depth)){
                    scope.EnteredNode(node);
                    switch(true) {
                        case node instanceof LexemText:
                            yield new LexemConstant({ value: node.text });
                            break;
                        case node instanceof Promise:    yield node; break;
                        default: throw new UnexpectedToken(node);
                    }
                    scope.LeaveNode(node);
                }
                break;
                
            case 't_const':
                for (let node of travel(childNodes, scope, depth)){
                    scope.EnteredNode(node);
                    switch(true) {
                        case node instanceof LexemString:
                        case node instanceof LexemNumber:
                        case node instanceof LexemConstant:
                            yield node;
                            break;
                        case node instanceof Promise:    yield node; break;
                        default: throw new UnexpectedToken(node);
                    }
                    scope.LeaveNode(node);
                }
                break
                
            case 't_type':
                for (let node of travel(childNodes, scope, depth)){
                    scope.EnteredNode(node);
                    switch(true) {
                        case node instanceof LexemText: yield new Type(node.text); break;
                        case node instanceof Promise:   yield node;                break;
                        default: throw new UnexpectedToken(node);
                    }
                    scope.LeaveNode(node);
                }
                break;
                
            case 't_incdec':
                let t_incdec_var = null;
                let t_incdec_op = null;
                let t_incdec_anno = scope.annotationsPop();
                
                for (let node of travel(childNodes.slice().reverse(), scope, depth)){
                    scope.EnteredNode(node);
                    switch(true) {
                        case node instanceof LexemText:
                            t_incdec_var = scope.setVar(new Var({
                                name: node.text,
                                ...scope.getVarParm(node.text),
                            }));
                            break;
                        case node instanceof LexemOpIncDec: t_incdec_op = node; break;
                        case node instanceof Delimiter:     yield node; break;
                        case node instanceof Promise:       yield node; break;
                        default: throw new UnexpectedToken(node);
                    }
                    scope.LeaveNode(node);
                }
                
                yield new Unary({
                    annotations: t_incdec_anno,
                    expression: t_incdec_var,
                    operator: t_incdec_op.text,
                    ...scope.getOP(Scope.OTHER_TO_OPNAME[t_incdec_op.text], [t_incdec_var])
                });
                break;
            
            case 't_call_str_part':
                let t_call_method_str_args = null;
                let t_call_method_str_type = null;
                let t_call_method_str_method = null;
                
                scope.expsPush(scope.exps().slice());
                for (let node of travel(childNodes, scope, depth)){
                    scope.EnteredNode(node);
                    switch(true) {
                        case node instanceof LexemBkt:                                       break;
                        case node instanceof Call:      t_call_method_str_method = node;     break;
                        case node instanceof Type:
                            t_call_method_str_type = node;
                            scope.exps().push(new Expression({ return: node }));
                            break;
                        case node instanceof LexemArgs: t_call_method_str_args = node.value; break;
                        case node instanceof Delimiter: yield node;                          break;
                        default: throw new UnexpectedToken(node);
                    }
                    scope.LeaveNode(node);
                }
                scope.expsPop();
                
                yield new LexemCallStr({
                    value: [
                        t_call_method_str_args,
                        t_call_method_str_type,
                        t_call_method_str_method,
                    ]
                });
                break;
                
            case 'expr1':
            case 'expr2':
            case 'expr3':
            case 'expr4':
            case 'expr5':
            case 'expr6':
            case 'expr7':
            case 'expr8':
            case 'expr9':
            case 'expr10':
            case 'expr11':
            case 'expr12':
            case 'expr13':
            case 'expr14':
            case 'expr15':
            case 'expr16':
            case 'expr17':
            case 'expr18':
            case 'expr19':
                let exps = [];
                let isVarGet = childNodes.length != 1; //hack, broken after change grammar
                let expr_anno = scope.annotationsPop();
                
                // scope.flag_expsMethodNoPush = depth;
                scope.expsPush(exps);
                if (isVarGet) scope.assDisablePush();
                for (let node of travel(childNodes, scope, depth)){
                    scope.EnteredNode(node);
                    switch(true) {
                        case node instanceof LexemText:
                            exps.push(scope.setVar(new Var({
                                annotations: expr_anno,
                                name: node.text,
                                ...scope.getVarParm(node.text),
                            })));
                            break;
                        
                        case node instanceof LexemAss: throw new UnexpectedToken(node);
                            
                        case node instanceof LexemOp:
                        case node instanceof LexemConst:
                        case node instanceof LexemColon:
                        case node instanceof LexemQuest:
                        
                        case node instanceof Expression:
                        
                        case node instanceof LexemTilt:
                        case node instanceof LexemDelta:
                        case node instanceof LexemInputs:
                            
                        case node instanceof LexemCallStr:
                            exps.push(node);
                            break;
                        
                        // case node instanceof Assignment: yield node; break;
                        case node instanceof Delimiter:  yield node; break;
                        case node instanceof LexemBkt:
                            scope.annotationsPushAll(expr_anno);
                            expr_anno = [];
                            break;
                        
                        case node instanceof Promise:    yield node; break;
                        
                        default: throw new UnexpectedToken(node);
                    }
                    scope.LeaveNode(node);
                }
                if (isVarGet) scope.assDisablePop();
                scope.expsPop();
                
                function is_len(len) {
                    return exps.length == len;
                }
                
                function is_inst(insts) {
                    for(let [index, inst] of insts.entries()) {
                        if (inst) {
                            if (!(exps[index] instanceof inst)){
                                return false;
                            }
                        }
                    }
                    
                    return true;
                }
                
                function is_lex(index, text) {
                    if (exps[index] && exps[index].text == text) {
                        return true;
                    }
                    
                    return false;
                }
                
                function gtext(index) {
                    return exps[index].text;
                }
                
                /** @param {Call} node  */
                function inlineCall(node) {
                    // TODO: force inline for methods, return должен выходить из функции, сейчас он просто возращает значение
                    // TODO: раскрытие рекурсивных функций
                    if (node.ref == null)
                        throw new Error('Not inline internal functions');
                    
                    let stmts = scope.prestmt[scope.prestmt.length - 1];
                    // node.ref.value.source;
                    let sourceFunc = /** @type {Func} */ (node.ref.value);
                    /** @type {Func} */
                    let funcCopy = null;
                    
                    let retVar = scope.genVar(sourceFunc.returnType);
                    let lastAssDisable = scope.assDisable;
                    
                    scope.assDisable = 0;
                    scope.funcDeclareDisablePush(retVar);
                    for (const node of travel(sourceFunc.source, scope, depth))
                        if (node instanceof Func)
                            funcCopy = node;
                    scope.funcDeclareDisablePop();
                    scope.assDisable = lastAssDisable;
                    
                    if (retVar.type.default == null)
                        throw new Error('default for this type is not found');
                    
                    stmts.push(new Assignment({
                        target: retVar,
                        assop: '=',
                        local: true,
                        value: /** @type {Expression} */ (retVar.type.default.value),
                        return: retVar.return,
                    }));
                    
                    let asses = [];
                    
                    if (funcCopy.thisType != scope.void) {
                        asses.push(new Assignment({
                            target: new Var({
                                name: 'This',
                                type: funcCopy.thisType,
                                declareLocal: true
                            }),
                            assop: '=',
                            local: true,
                            value: node.arguments[0],
                            return: node.arguments[0].return,
                        }));
                    }
                    
                    let args = node.arguments.slice(node.method ? 1 : 0);
                    
                    for (let i = 0; i < args.length; i++) {
                        asses.push(new Assignment({
                            target: funcCopy.parameters[i],
                            assop: '=',
                            local: true,
                            value: args[i],
                            return: args[i].return,
                        }));
                    }
                    
                    stmts.push(new If({
                        condition: scope.getTrue(),
                        bodyTrue: new Block({
                            statements: [
                                ...asses,
                                new If({
                                    condition: scope.getTrue(),
                                    bodyTrue: funcCopy.body,
                                }),
                            ],
                        })
                    }));
                    
                    return retVar;
                }
                
                switch(true) {
                    case is_len(1) && is_inst([Var]):
                    case is_len(1) && is_inst([Call]):
                    // case is_len(1) && is_inst([StringCall]):
                    // case is_len(1) && is_inst([Assignment]):
                        if (is_inst([Call])) {
                            let findInlineAnno = expr_anno.find((val) => val.name == 'inline');
                            let findNoInlineAnno = expr_anno.find((val) => val.name == 'noinline');
                            
                            if (!findNoInlineAnno && (findInlineAnno || (exps[0].ref && exps[0].ref.value.inline))) {
                                exps[0] = inlineCall(exps[0]);
                            }
                        }
                        
                        exps[0].annotations = exps[0].annotations.concat(expr_anno);
                        exps[0].recalculateAnno();
                        yield exps[0]; break;
                        
                    // case is_len(2) && is_inst([Var, LexemOpIncDec]):
                    //     yield new Unary({
                    //         expression: exps[0],
                    //         operator: gtext(1),
                    //         ...scope.getOP(Scope.OTHER_TO_OPNAME[gtext(1)], [exps[0]])
                    //     });
                    //     break;
                    
                    case is_len(1) && is_inst([LexemConst]):
                        let literal_node = exps[0];
                        
                        yield new Literal({
                            annotations: expr_anno,
                            value: literal_node.value,
                            return: (literal_node instanceof LexemNumber || literal_node instanceof LexemConstant) ? scope.number :
                                        (literal_node instanceof LexemString ? scope.string : scope.default),
                        });
                        break;
                    
                    case is_len(2) && is_inst([LexemOpLogic, Expression]) && is_lex(0, '!'):
                        scope.applyOP(exps[1], 'is');
                        
                        yield new Unary({
                            annotations: expr_anno,
                            expression: exps[1],
                            operator: gtext(0),
                            ...scope.getOP(Scope.OTHER_TO_OPNAME[gtext(0)], [exps[1]]),
                        });
                        break;
                    
                    case is_len(2) && is_inst([LexemDelta, Expression]):
                        yield new Unary({
                            annotations: expr_anno,
                            expression: exps[1],
                            operator: gtext(0),
                            return: exps[1].return,
                        });
                        break;
                        
                    case is_len(2) && (is_inst([LexemTilt]) || is_inst([LexemInputs])) && is_inst([,Expression]):
                        yield new Unary({
                            annotations: expr_anno,
                            expression: exps[1],
                            operator: gtext(0),
                            ...scope.getOP(Scope.OTHER_TO_OPNAME[gtext(0)], []),
                        });
                        break;
                        
                    case is_len(2) && is_inst([LexemOpMath, Expression]) && is_lex(0, '-'):
                        if (exps[1] instanceof Literal) {
                            exps[1].value = `-${exps[1].value}`;
                            yield exps[1];
                        } else {
                            yield new Unary({
                                annotations: expr_anno,
                                expression: exps[1],
                                operator: gtext(0),
                                ...scope.getOP(Scope.OTHER_TO_OPNAME[gtext(0)], [exps[1]]),
                            });
                        }
                        break;
                        
                    case is_len(2) && is_inst([LexemOpMath, Expression]) && is_lex(0, '+'):
                        yield new Unary({
                            annotations: expr_anno,
                            expression: exps[1],
                            operator: gtext(0),
                            return: exps[1].return,
                        });
                        break;
                        
                    case is_len(1) && is_inst([Expression]):
                        exps[0].annotations = exps[0].annotations.concat(expr_anno);
                        exps[0].recalculateAnno();
                        yield exps[0];
                        break;
                        
                    // case is_len(0): break; // наверное их быть не должно, посмотрим
                    case is_len(5) && is_inst([Expression, LexemQuest, Expression, LexemColon, Expression]):
                        yield new Ternary({
                            condition: scope.applyOP(scope.applyOP(exps[0], 'is'), 'cnd'),
                            yes: exps[2],
                            no: exps[4],
                        });
                        break;
                        
                    case is_len(4) && is_inst([Expression, LexemQuest, LexemColon, Expression]):
                        yield new Ternary({ condition: exps[0], no: exps[3] });
                        break;
                        
                    case is_inst([Expression, LexemOpLogic]) && (is_lex(1, '&') || is_lex(1, '|')):
                        for (let i = 0; i < exps.length; i+=2) {
                            scope.applyOP(exps[i], 'is');
                        }
                        // not break
                    case is_inst([Expression, LexemOp]):
                        let second = exps[exps.length - 1];
                        
                        if (exps.length >= 5) {
                            for (let i = exps.length - 2; i > 2; i-=2) {
                                let op = gtext(i);
                                let first = exps[i - 1];
                                
                                second = new Binary({
                                    annotations: expr_anno,
                                    left: first,
                                    operator: op,
                                    right: second,
                                    ...scope.getOP(Scope.BINARY_TO_OPNAME[op], [first, second])
                                });
                                
                                if (exps[i] instanceof LexemOpLogic) {
                                    scope.applyOP(second, 'is');
                                }
                            }
                        }
                        
                        yield new Binary({
                            annotations: expr_anno,
                            left: exps[0],
                            operator: gtext(1),
                            right: second,
                            ...scope.getOP(Scope.BINARY_TO_OPNAME[gtext(1)], [exps[0], second]),
                        });
                        break;
                    
                    //String call
                    case exps.length >= 2 && is_inst([Expression]):
                        for (let i = 1; i < exps.length; i++) {
                            if (!(exps[i] instanceof LexemCallStr) &&
                                !(exps[i] instanceof Call && exps[i].method) &&
                                !(exps[i] instanceof Index) ) {
                                    throw new UnexpectedToken(exps);
                                }
                        }
                        
                        let first = exps[0];
                        
                        for (let i = 1; i < exps.length; i++) {
                            switch(true) {
                                case exps[i] instanceof LexemCallStr:
                                    let t_call_method_str_callee = first;
                                    let t_call_method_str_args = exps[i].value[0];
                                    let t_call_method_str_type = exps[i].value[1];
                                    let t_call_method_str_method = exps[i].value[2];
                                    
                                    let t_call_string = new StringCall({
                                        ...scope.getOP('stringcall', []),
                                        callee: t_call_method_str_callee,
                                        return: t_call_method_str_type ?? scope.void,
                                        arguments: t_call_method_str_args,
                                    });
                                    
                                    if (t_call_method_str_method) {
                                        t_call_method_str_method.arguments.unshift(
                                            /** @type {any} */ (t_call_string)
                                        );
                                        
                                        t_call_method_str_method.recalculateTotalOps(-1);
                                        
                                        first = t_call_method_str_method;
                                    } else {
                                        first = t_call_string;
                                    }
                                    break;
                                
                                case exps[i] instanceof Call: // call method
                                    // let parm = scope.getFunction(
                                    //     exps[1].parent.value.callee,
                                    //     exps[1].parent.value.arguments,
                                    //     exps[1].return,
                                    // );
                                    
                                    exps[i].parent.value.arguments.unshift(
                                        /** @type {any} */ (first)
                                    );
                                    
                                    // Object.assign(exps[1], parm);
                                    
                                    exps[i].parent = null;
                                    exps[i].recalculateTotalOps(-1);
                                    
                                    let findInlineAnno = expr_anno.find((val) => val.name == 'inline');
                                    let findNoInlineAnno = expr_anno.find((val) => val.name == 'noinline');
                                    
                                    if (!findNoInlineAnno && (findInlineAnno || (exps[i].ref && exps[i].ref.value.inline))) {
                                        first = inlineCall(exps[i]);
                                    } else first = exps[i];
                                    break;
                                    
                                case exps[i] instanceof Index:
                                    first = new Lookup({ object: first, member: exps[i] });
                                    break;
                            }
                        }
                        
                        first.annotations = first.annotations.concat(expr_anno);
                        first.recalculateAnno();
                        yield first;
                        break;
                    
                    default: throw new UnexpectedToken(exps);
                }
                break;
            
            default: throw new UnexpectedToken(child);
        }
    }
}

async function preProccess(node, scope) {
    let promises = [];
    
    function _preProccess(node, scope) {
        if (node.type && node.text)
            return node;
        
        let [ type ] = Object.keys(node);
        let currchlds = node[type];
        
        if (type == 'dmtr') {
            for (let i = 0; i < currchlds.length; i++) {
                let node = currchlds[i];
                
                if (!node.type || !node.text)
                    continue;
                
                let content = node.text;
                if (content.substring(0,8) == '#include') {
                    let ppinc = new PPinclude({ value: content });
                    
                    promises.push(scope.IncludePreCache(ppinc.path));
                }
            }
        }
        
        // if (type == 'directive') {
        //     let dmtrs = [];
            
        //     for (let dnode of travel([node], scope)){
        //         if (dnode instanceof Delimiter) {
        //             dmtrs.push(dnode.origin);
        //             continue;
        //         }
                
        //         if (dnode instanceof Directive) {
        //             scope.pushDirective(dnode);
        //             continue;
        //         }
                
        //         throw new UnexpectedToken(dnode);
        //     }
            
        //     if (!dmtrs.length) {
        //         return;
        //     }
            
        //     return {
        //         '#dmtr': dmtrs,
        //     }
        // }
        
        if (/expr\d{1,2}/.test(type) && currchlds.length == 1) {
            let [ ntype ] = Object.keys(currchlds[0]);
            
            if (/expr\d{1,2}/.test(ntype)) {
                return _preProccess(currchlds[0], scope);
            }
        }
        
        for (let i = 0; i < currchlds.length; i++) {
            let child = currchlds[i];
            let repeat = false;
            
            do {
                let ret = _preProccess(child, scope);
                repeat = false;
                
                if (ret) {
                    [ type ] = Object.keys(ret);
                    
                    if (type[0] == '#') {
                        repeat = true;
                        ret[type.slice(1)] = ret[type];
                        delete ret[type];
                        child = ret;
                        
                        continue;
                    }
                    
                    currchlds[i] = ret;
                } else {
                    currchlds.splice(i--, 1);
                }
            } while(repeat)
        }
        
        return node;
    }
    
    scope.preProcessorPush();
        let ret = _preProccess(node, scope);
        await Promise.all(promises);
    scope.preProcessorPop();
    
    return ret;
}

/*
    # -- comment for annotation
    @inline [include / function] (inline code)
    @include "[^"]+" [Statments only (incude to before stmt in current block)] (include from file, parse and include)
    @type \S+ [Expression / Assigment / Var / VarArg] (set type, type check included)
    @return \S+ [Func] (set return type function)
    @debug [Statments] (add statment in debug mode, and remove in product)
    @define \S+ .+ [any] (add in define and if finded literal of this name create Define (expr) class push eval (in clear time) expression in value)
    @ifdef \S+ [Statments] (check define, and if defined not removed statment)
    @ifndef \S+ look @ifdef
    @error \S+ [any] (error if executed)
    @warn \S+ [any] (warn if executed)
    @typedef \S+ \S+
    @compiler \S+ .+ [any] (set compiler option for this token and children)
    @pretty
    @nopretty
    @printops
*/

/**
 * @param {string | NodeJS.ReadStream} input
 * @param {E2Data} e2data
 * @param {any} parser
 * @return {Promise<Include>}
 */
export default async function(input, e2data, parser) {
    let scope = new Scope(e2data, parser);
    let raw = false;
    
    if (input instanceof Stream) {
        input = await readAll(input);
        raw = true;
    }
    
    await scope.IncludePreCache(input, raw);
    
    return new Include({
        pref: scope.includepref,
        path: path.parse(input).name,
        body: await scope.IncludeToBlock(input),
    });
};