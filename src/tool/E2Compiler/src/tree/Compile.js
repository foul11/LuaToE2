import { Annotation, Assignment, Binary, Block, Break, Call, Continue, Directive, DoWhile, Expression, For, Foreach, Func, If, Index, KV, Literal, Lookup, Return, Root, Statement, StringCall, Switch, SwitchBlock, SwitchCase, SwitchDefault, SwitchToken, Ternary, Try, Type, Unary, Var, VarArg, While, Event, PreProcessor, Include } from "./Clear.js";
import util from 'node:util';

/* eslint no-unused-vars: 0 */

export class CompileError extends Error {}
export class UnexpectedNode extends CompileError {
    constructor(obj){
        super(`found unexpected node: ${obj.constructor.name} \n${util.inspect(obj)}`);
    }
}

/**
 * @typedef {{
 *  beautifier?: boolean,
 * }} Options
 */
class Scope {
    /**
     * @typedef {import('./LoadData.js').E2Data} E2Data
     * @param {Options} options
     * @param {E2Data} e2data
     */
    constructor(options, e2data) {
        this.beautifier = options.beautifier ?? false;
        this.buffer = [[]];
        
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
    
    /** @param {string} str */
    pushBuffer(str) {
        this.buffer[this.buffer.length - 1].push(str);
    }
    
    pushBufferStack() {
        this.buffer.push([]);
    }
    
    /** @param {(Var | VarArg)[]} args */
    pushBufferTypedArgs(args) {
        /** @type {Var[][]} */
        let clusters = [];
        /** @type {Type} */
        let last_type = null;
        /** @type {VarArg} */
        let VarArg = null;
        
        for (let arg of args) {
            if (arg instanceof Var) {
                if (last_type != arg.type || !last_type) {
                    clusters.push([]);
                }
                
                clusters[clusters.length - 1].push(arg);
            } else {
                VarArg = arg;
            }
        }
        
        let firstArg = true;
        
        for (let aarg of clusters) {
            if (firstArg) {
                firstArg = false;
            } else this.pushBuffer(',');
            
            if (aarg.length == 0) {
                break;
            } else if (aarg.length == 1) {
                let variable = aarg[0];
                
                this.pushBuffer(variable.name);
                this.pushBufferType(variable.type);
            } else {
                let firstArgCluster = true;
                let firstVariable = aarg[0];
                
                for (let variable of aarg) {
                    if (firstArgCluster) {
                        firstArgCluster = false;
                    } else this.pushBuffer(' ');
                    
                    this.pushBuffer(variable.name);
                }
                
                this.pushBufferType(firstVariable.type);
            }
        }
        
        if (VarArg) {
            if (firstArg) {
                firstArg = false;
            } else this.pushBuffer(',');
            
            this.pushBuffer('...');
            this.pushBuffer(VarArg.var.name);
            this.pushBufferType(VarArg.var.type);
        }
    }
    
    /** @param {Type} type */
    pushBufferType(type) {
        if (type != this.void && type != this.default) {
            this.pushBuffer(':');
            this.pushBuffer(type.type);
        }
    }
    
    bufferToString() {
        return this.buffer.pop().join('');
    }
    
    /** @param {Annotation[]} annotations */
    AnnotationEnter(node, annotations) {
        
    }
    
    /** @param {Annotation[]} annotations */
    AnnotationLeave(node, annotations) {
        
    }
    
    IterateEnter(node) {
        // if (node.PostFix) {
        //     this.pushBuffer(node.PostFix);
        // }
    }
    
    IterateLeave(node) {
        // if (node.PostFix) {
        //     this.pushBuffer(node.PostFix);
        // }
    }
}


/** @param {Root} node @param {Scope} scope */
function *it_Root(node, scope) {
    for (let value of Iterate(node.directives, scope))
        scope.pushBuffer(value);
        
    for (let value of Iterate(node.block, scope))
        scope.pushBuffer(value);
}

// /** @param {Type} node @param {Scope} scope  */
// function *it_Type(node, scope) {
//     yield node.type;
// }

/** @param {Directive} node @param {Scope} scope  */
function *it_Directive(node, scope) {
    scope.pushBufferStack();
        scope.pushBuffer('@');
        scope.pushBuffer(node.name);
        
        if (node.value instanceof Array) {
            for (let value of Iterate(node.value, scope)){
                scope.pushBuffer(' ');
                scope.pushBuffer(value);
            }
        } else {
            scope.pushBuffer(' ');
            scope.pushBuffer(node.value);
        }
        
        scope.pushBuffer('\n');
    yield scope.bufferToString();
}

/** @param {PreProcessor} node @param {Scope} scope  */
function *it_PreProcessor(node, scope) {
    scope.pushBufferStack();
        scope.pushBuffer(node.value);
        scope.pushBuffer('\n');
    yield scope.bufferToString();
}

/** @param {Block} node @param {Scope} scope  */
function *it_Block(node, scope) {
    scope.pushBufferStack();
        let firstStmt = true;
        
        for (let value of Iterate(node.statements, scope)) {
            if (firstStmt) {
                firstStmt = false;
            } else scope.pushBuffer(' ');
            
            scope.pushBuffer(value);
        }
    yield scope.bufferToString();
}

/** @param {Include} node @param {Scope} scope  */
function *it_Include(node, scope) {
    scope.pushBufferStack();
        scope.pushBuffer('#include "');
            scope.pushBuffer(node.path);
        scope.pushBuffer('"');
    yield scope.bufferToString();
}

/** @param {Call} node @param {Scope} scope  */
function *it_Call(node, scope) {
    scope.pushBufferStack();
        let args = node.arguments;
        let arg0 = args[0];
        
        if (node.method) {
            args = args.slice(1);
            
            scope.pushBuffer('(');
                for (let value of Iterate(arg0, scope))
                    scope.pushBuffer(value);
            scope.pushBuffer('):');
        }
        
        scope.pushBuffer(node.callee);
        scope.pushBuffer('(');
            let firstArg = true;
            
            for (let value of Iterate(args, scope)) {
                if (firstArg) {
                    firstArg = false;
                } else scope.pushBuffer(',');
                
                scope.pushBuffer(value);
            }
        scope.pushBuffer(')');
        
    yield scope.bufferToString();
}

/** @param {StringCall} node @param {Scope} scope  */
function *it_StringCall(node, scope) {
    scope.pushBufferStack();
        scope.pushBuffer('(');
        
        for (let value of Iterate(node.callee, scope))
            scope.pushBuffer(value);
        
        scope.pushBuffer(')');
        scope.pushBuffer('(');
        
        let firstArg = true;
        
        for (let value of Iterate(node.arguments, scope)){
            if (firstArg) {
                firstArg = false;
            } else scope.pushBuffer(',');
            
            scope.pushBuffer(value);
        }
        
        scope.pushBuffer(')');
        
        if (node.return != scope.void) {
            scope.pushBuffer('[');
                scope.pushBuffer(node.return.type);
            scope.pushBuffer(']');
        }
    yield scope.bufferToString();
}

// /** @param {Statement} node @param {Scope} scope  */
// function *it_Statement(node, scope) {
    
// }

/** @param {Func} node @param {Scope} scope  */
function *it_Func(node, scope) {
    scope.pushBufferStack();
        scope.pushBuffer('function ');
        
        if (node.returnType == scope.void) {
            scope.pushBuffer('void');
        } else scope.pushBuffer(node.returnType.type);
        
        scope.pushBuffer(' ');
        
        if (node.thisType != scope.void) {
            scope.pushBuffer(node.thisType.type);
            scope.pushBuffer(':');
        }
        
        scope.pushBuffer(node.name);
        scope.pushBuffer('(');
            scope.pushBufferTypedArgs(node.parameters);
        scope.pushBuffer(')');
        
        scope.pushBuffer('{');
            for (let value of Iterate(node.body, scope))
                scope.pushBuffer(value);
        scope.pushBuffer('}');
    yield scope.bufferToString();
}

/** @param {Assignment} node @param {Scope} scope  */
function *it_Assignment(node, scope) {
    scope.pushBufferStack();
        if (node.local)
            scope.pushBuffer('local ');
        
        for (let value of Iterate(node.target, scope))
            scope.pushBuffer(value);
        
        scope.pushBuffer(node.assop);
        
        for (let value of Iterate(node.value, scope))
            scope.pushBuffer(value);
    yield scope.bufferToString();
}

/** @param {Break} node @param {Scope} scope  */
function *it_Break(node, scope) {
    yield 'break ';
}

/** @param {Continue} node @param {Scope} scope  */
function *it_Continue(node, scope) {
    yield 'continue ';
}

/** @param {Return} node @param {Scope} scope  */
function *it_Return(node, scope) {
    scope.pushBufferStack();
        scope.pushBuffer('return');
        scope.pushBuffer(' ');
        
        for (let value of Iterate(node.value, scope))
            scope.pushBuffer(value);
    yield scope.bufferToString();
}

/** @param {If} node @param {Scope} scope  */
function *it_If(node, scope) {
    scope.pushBufferStack();
        scope.pushBuffer('if');
        scope.pushBuffer('(');
            for (let value of Iterate(node.condition, scope))
                scope.pushBuffer(value);
        scope.pushBuffer(')');
        
        scope.pushBuffer('{');
            for (let value of Iterate(node.bodyTrue, scope))
                scope.pushBuffer(value);
        scope.pushBuffer('}');
        
        if (node.bodyFalse) {
            scope.pushBuffer('else');
            
            scope.pushBuffer('{');
                for (let value of Iterate(node.bodyFalse, scope))
                    scope.pushBuffer(value);
            scope.pushBuffer('}');
        }
    yield scope.bufferToString();
}

/** @param {Switch} node @param {Scope} scope  */
function *it_Switch(node, scope) {
    scope.pushBufferStack();
        scope.pushBuffer('switch');
        scope.pushBuffer('(');
        for (let value of Iterate(node.switch, scope))
            scope.pushBuffer(value);
        scope.pushBuffer(')');
        
        scope.pushBuffer('{');
            for (let value of Iterate(node.body, scope))
                scope.pushBuffer(value);
        scope.pushBuffer('}');
        
    yield scope.bufferToString();
}

/** @param {SwitchBlock} node @param {Scope} scope  */
function *it_SwitchBlock(node, scope) {
    scope.pushBufferStack();
        for (let value of Iterate(node.statements, scope))
            scope.pushBuffer(value);
    yield scope.bufferToString();
}

// /** @param {SwitchToken} node @param {Scope} scope  */
// function *it_SwitchToken(node, scope) {
// }

/** @param {SwitchDefault} node @param {Scope} scope  */
function *it_SwitchDefault(node, scope) {
    yield 'default,';
}

/** @param {SwitchCase} node @param {Scope} scope  */
function *it_SwitchCase(node, scope) {
    scope.pushBufferStack();
        scope.pushBuffer('case ');
            for (let value of Iterate(node.switch, scope))
                scope.pushBuffer(value);
        scope.pushBuffer(',');
    yield scope.bufferToString();
}

/** @param {While} node @param {Scope} scope  */
function *it_While(node, scope) {
    scope.pushBufferStack();
        scope.pushBuffer('while');
        scope.pushBuffer('(');
            for (let value of Iterate(node.condition, scope))
                scope.pushBuffer(value);
        scope.pushBuffer(')');
        
        scope.pushBuffer('{');
            for (let value of Iterate(node.body, scope))
                scope.pushBuffer(value);
        scope.pushBuffer('}');
    yield scope.bufferToString();
}

/** @param {DoWhile} node @param {Scope} scope  */
function *it_DoWhile(node, scope) {
    scope.pushBufferStack();
        scope.pushBuffer('do');
        
        scope.pushBuffer('{');
            for (let value of Iterate(node.body, scope))
                scope.pushBuffer(value);
        scope.pushBuffer('}');
        
        scope.pushBuffer('while');
        scope.pushBuffer('(');
            for (let value of Iterate(node.condition, scope))
                scope.pushBuffer(value);
        scope.pushBuffer(')');
    yield scope.bufferToString();
}

/** @param {For} node @param {Scope} scope  */
function *it_For(node, scope) {
    scope.pushBufferStack();
        scope.pushBuffer('for');
        scope.pushBuffer('(');
            scope.pushBuffer(node.name.name);
            scope.pushBuffer('=');
                for (let value of Iterate(node.condition, scope))
                    scope.pushBuffer(value);
            scope.pushBuffer(',');
                for (let value of Iterate(node.values[0], scope))
                scope.pushBuffer(value);
                
            if (node.values[1]) {
                scope.pushBuffer(',');
                for (let value of Iterate(node.values[1], scope))
                    scope.pushBuffer(value);
            }
        scope.pushBuffer(')');
        
        scope.pushBuffer('{');
            for (let value of Iterate(node.body, scope))
                scope.pushBuffer(value);
        scope.pushBuffer('}');
    yield scope.bufferToString();
}

/** @param {Foreach} node @param {Scope} scope  */
function *it_Foreach(node, scope) {
    scope.pushBufferStack();
        scope.pushBuffer('foreach');
        scope.pushBuffer('(');
            scope.pushBuffer(node.key.name);
            scope.pushBuffer(':');
            scope.pushBuffer(node.key.type.type);
            scope.pushBuffer(',');
            
            scope.pushBuffer(node.value.name);
            scope.pushBuffer(':');
            scope.pushBuffer(node.value.type.type);
            scope.pushBuffer('=');
            
            for (let value of Iterate(node.array, scope))
                scope.pushBuffer(value);
        scope.pushBuffer(')');
        
        scope.pushBuffer('{');
            for (let value of Iterate(node.body, scope))
                scope.pushBuffer(value);
        scope.pushBuffer('}');
    yield scope.bufferToString();
}

/** @param {Try} node @param {Scope} scope  */
function *it_Try(node, scope) {
    scope.pushBufferStack();
        scope.pushBuffer('try');
        scope.pushBuffer('{');
            for (let value of Iterate(node.body, scope))
                scope.pushBuffer(value);
        scope.pushBuffer('}');
        
        scope.pushBuffer('catch');
        scope.pushBuffer('(');
            for (let value of Iterate(node.catchVar, scope))
                scope.pushBuffer(value);
        scope.pushBuffer(')');
        
        scope.pushBuffer('{');
            for (let value of Iterate(node.body, scope))
                scope.pushBuffer(value);
        scope.pushBuffer('}');
    yield scope.bufferToString();
}

/** @param {Event} node @param {Scope} scope  */
function *it_Event(node, scope) {
    scope.pushBufferStack();
        scope.pushBuffer('event ');
        
        scope.pushBuffer(node.name);
        scope.pushBuffer('(');
            scope.pushBufferTypedArgs(node.parameters);
        scope.pushBuffer(')');
        
        scope.pushBuffer('{');
            for (let value of Iterate(node.body, scope))
                scope.pushBuffer(value);
        scope.pushBuffer('}');
    yield scope.bufferToString();
}

// /** @param {Expression} node @param {Scope} scope  */
// function *it_Expression(node, scope) {
    
// }

/** @param {Var} node @param {Scope} scope  */
function *it_Var(node, scope) {
    yield node.name;
}

// /** @param {VarArg} node @param {Scope} scope  */
// function *it_VarArg(node, scope) {}

/** @param {KV} node @param {Scope} scope  */
function *it_KV(node, scope) {
    scope.pushBufferStack();
        if (node.key) {
            for (let value of Iterate(node.key, scope))
                scope.pushBuffer(value);
            
            scope.pushBuffer('=');
        }
        
        for (let value of Iterate(node.value, scope))
            scope.pushBuffer(value);
    yield scope.bufferToString();
}

/** @param {Literal} node @param {Scope} scope  */
function *it_Literal(node, scope) {
    scope.pushBufferStack();
        if (node.return == scope.string) {
            scope.pushBuffer('"');
            scope.pushBuffer(node.value.toString());
            scope.pushBuffer('"');
        } else {
            scope.pushBuffer(node.value.toString());
        }
    yield scope.bufferToString();
}

/** @param {Lookup} node @param {Scope} scope  */
function *it_Lookup(node, scope) {
    scope.pushBufferStack();
        for (let value of Iterate(node.object, scope))
            scope.pushBuffer(value);
        for (let value of Iterate(node.member, scope))
            scope.pushBuffer(value);
    yield scope.bufferToString();
}

/** @param {Index} node @param {Scope} scope  */
function *it_Index(node, scope) {
    scope.pushBufferStack();
        scope.pushBuffer('[');
            for (let value of Iterate(node.value, scope))
                scope.pushBuffer(value);
            
            if (node.type) {
                scope.pushBuffer(',');
                scope.pushBuffer(node.type.type);
            }
        scope.pushBuffer(']');
    yield scope.bufferToString();
}

/** @param {Unary} node @param {Scope} scope  */
function *it_Unary(node, scope) {
    scope.pushBufferStack();
        if (node.operator != '--' && node.operator != '++')
            scope.pushBuffer(node.operator);
            
        for (let value of Iterate(node.expression, scope))
            scope.pushBuffer(value);
        
        if (node.operator == '--' || node.operator == '++')
            scope.pushBuffer(node.operator);
    yield scope.bufferToString();
}

/** @param {Binary} node @param {Scope} scope  */
function *it_Binary(node, scope) {
    scope.pushBufferStack();
        for (let value of Iterate(node.left, scope))
            scope.pushBuffer(value);
        
        scope.pushBuffer(node.operator);
        
        for (let value of Iterate(node.right, scope))
            scope.pushBuffer(value);
    yield scope.bufferToString();
}

/** @param {Ternary} node @param {Scope} scope  */
function *it_Ternary(node, scope) {
    scope.pushBufferStack();
        for (let value of Iterate(node.condition, scope))
            scope.pushBuffer(value);
        
        scope.pushBuffer(' ?');
        
        if (node.yes) {
            scope.pushBuffer(' ');
                for (let value of Iterate(node.yes, scope))
                    scope.pushBuffer(value);
            scope.pushBuffer(' ');
        }
        
        scope.pushBuffer(': ');
        
        for (let value of Iterate(node.no, scope))
            scope.pushBuffer(value);
    yield scope.bufferToString();
}



function *Iterate(node, scope) {
    scope.IterateEnter(node);
    
    if (node instanceof PreProcessor) {
        for (let value of it_PreProcessor(node, scope))
            yield value;
        
        return;
    }
    
    switch (node.constructor) {
        case Root:          for (let value of it_Root(node, scope)) yield value;           break;
        // case Type:          for (let value of it_Type(node, scope)) yield value;           break;
        case Directive:     for (let value of it_Directive(node, scope)) yield value;      break;
        case Include:       for (let value of it_Include(node, scope)) yield value;        break;
        case Block:         for (let value of it_Block(node, scope)) yield value;          break;
        case Call:          for (let value of it_Call(node, scope)) yield value;           break;
        case StringCall:    for (let value of it_StringCall(node, scope)) yield value;     break;
        case Func:          for (let value of it_Func(node, scope)) yield value;           break;
        case Assignment:    for (let value of it_Assignment(node, scope)) yield value;     break;
        case Break:         for (let value of it_Break(node, scope)) yield value;          break;
        case Continue:      for (let value of it_Continue(node, scope)) yield value;       break;
        case Return:        for (let value of it_Return(node, scope)) yield value;         break;
        case If:            for (let value of it_If(node, scope)) yield value;             break;
        case Switch:        for (let value of it_Switch(node, scope)) yield value;         break;
        case SwitchBlock:   for (let value of it_SwitchBlock(node, scope)) yield value;    break;
        case SwitchDefault: for (let value of it_SwitchDefault(node, scope)) yield value;  break;
        case SwitchCase:    for (let value of it_SwitchCase(node, scope)) yield value;     break;
        case While:         for (let value of it_While(node, scope)) yield value;          break;
        case DoWhile:       for (let value of it_DoWhile(node, scope)) yield value;        break;
        case For:           for (let value of it_For(node, scope)) yield value;            break;
        case Foreach:       for (let value of it_Foreach(node, scope)) yield value;        break;
        case Try:           for (let value of it_Try(node, scope)) yield value;            break;
        case Event:         for (let value of it_Event(node, scope)) yield value;          break;
        case Var:           for (let value of it_Var(node, scope)) yield value;            break;
        // case VarArg:        for (let value of it_VarArg(node, scope)) yield value;         break;
        case KV:            for (let value of it_KV(node, scope)) yield value;             break;
        case Literal:       for (let value of it_Literal(node, scope)) yield value;        break;
        case Lookup:        for (let value of it_Lookup(node, scope)) yield value;         break;
        case Index:         for (let value of it_Index(node, scope)) yield value;          break;
        case Unary:         for (let value of it_Unary(node, scope)) yield value;          break;
        case Binary:        for (let value of it_Binary(node, scope)) yield value;         break;
        case Ternary:       for (let value of it_Ternary(node, scope)) yield value;        break;
        
        case Array:
            for (let el of node) {
                for (let value of Iterate(el, scope))
                    yield value;
            }
            break;
        
        default: throw new UnexpectedNode(node);
    }
    
    scope.IterateLeave(node);
}

/**
 * @param {Root} root 
 * @param {Options} options
 */
export default function(root, e2data, options){
    let scope = new Scope(options, e2data);
    
    scope.pushBufferStack();
    
    for (let {} of Iterate(root, scope));
    
    return scope.bufferToString();
};