import { Call, Index, Literal, Lookup, Include, PreProcessor, Reference, Token, Type, Var } from "./Clear.js";

function tab(str, count) {
    return '  '.repeat(count) + str
}

/**
 * @param {any} node
 * @param {Object} opt
 * @return {{
 *  out: string | null,
 *  recurse: boolean,
 * }}
 */
function tokensToString(node, opt) {
    let out = null;
    let recurse = true;
    
    switch(true){
        case node instanceof Call:
            out = `${node.callee} [${node.return.type}]`;
            break;
            
        case node instanceof Literal:
            out = `${node.value}`;
            break;
            
        case node instanceof Var:
            out = `(${node.name}:${node.type.type})`;
            recurse = false;
            break;
            
        case node instanceof Type:
            out = `${node.type}`;
            break;
            
        case node instanceof Index:
            out = `[${tokensToString(node.value, opt).out},${tokensToString(node.type, opt).out}]`;
            break;
            
        case node instanceof Lookup:
            out = `${tokensToString(node.object, opt).out}${tokensToString(node.member, opt).out}`;
            recurse = false;
            break;
            
        case node instanceof Include:
            out = `"${node.path}"`;
            break;
            
        case node instanceof PreProcessor:
            out = `${node.value}`;
            break;
    }
    
    return {
        out,
        recurse,
    }
}

function stringJoin(obj, glue) {
    let join = [];
    
    for (let val of Object.values(obj)) {
        if (typeof val == 'string') {
            join.push(val);
        }
    }
    
    return join.join(glue);
}

// eslint-disable-next-line no-unused-vars
function tokenAnnotations(node, opt) {
    let anno = [];
    
    if (node.annotations.length) {
        for (let ann of node.annotations) {
            let args;
            
            if (ann.value)
                args = stringJoin(ann.value, ' ');
            
            anno.push(`@${ann.name}${args ? ` ${args}` : ''}`);
        }
    }
    
    return anno.join(', ');
}

function treeToConsole(Root, depth = -1, opt = { count: 0 }) {
    depth++;
    
    for(let node of Object.values(Root)) {
        if (node instanceof Token && !(node instanceof Reference)) {
            opt.count++;
            
            let { out, recurse } = tokensToString(node, opt);
            let anno = tokenAnnotations(node, opt);
            
            console.log(
                `[${opt.count.toString().padEnd(5)}] ${tab(node.constructor.name, depth)} ${out ?? ''} [${node.totalOps},${node.ops}]${anno ? ` {${anno}}` : ''}`
            );
            
            if (recurse)
                treeToConsole(node, depth, opt);
        } else if (node instanceof Array) {
            treeToConsole(node, depth - 1, opt);
        }
    }
}

export default function(root){
    treeToConsole(root);
};