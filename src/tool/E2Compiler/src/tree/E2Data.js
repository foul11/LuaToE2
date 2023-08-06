import { globIterateSync } from 'glob';
import { Type } from './Clear.js';
import fs from 'fs';

export default class E2Data {
    /**
     * @typedef {{
     *  warnConflictRetType?: boolean,
     *  warnConflictOps?: boolean,
     * }} E2DataSettings
     */
    
    /**
     * @param {string} glob 
     * @param {E2DataSettings} settings 
     */
    constructor(glob, settings = {}) {
        this.void = new Type('void', '');
        this.default = new Type('number', 'n');
        
        this.functions = {};
        this.isfunc = {};
        this.rtypes = {
            '': this.void,
            'n': this.default,
        };
        this.types = {
            'void': this.void,
            'number': this.default,
        };
        
        if (!settings)
            settings = {};
        
        for(let file of globIterateSync(glob, { windowsPathsNoEscape: true })) {
            let json = JSON.parse(fs.readFileSync(file).toString());
            let fobj = { file };
            
            for(let [ type, [tag] ] of Object.entries(json[1])) {
                let ltype = type.toLocaleLowerCase();
                let finded = Type.map[ltype];
                
                if (finded && finded.tag != tag) {
                    throw new IncompatibleTypes(`for type [${ltype}] '${finded.tag}' != '${tag}'`);
                }
                
                this.rtypes[tag] = new Type(type, tag);
                this.types[ltype] = this.rtypes[tag];
            }
            
            for(let [ sign, { 2: ret, 4: cost } ] of Object.entries(json[0])) {
                let func = this.functions[sign];
                let rett = this.rtypes[ret];
                
                if (rett === undefined) {
                    throw new TypeNotFound(ret);
                }
                
                if (func && func.ops != cost && (settings.warnConflictOps ?? true)) {
                    console.warn(`[${fobj.file}:${sign};${rett.type};${cost}] different ops count from [${func.extend.file}:${sign};${func.return.type};${func.ops}]`);
                }
                
                if (func && func.return != rett && (settings.warnConflictRetType ?? true)) {
                    console.warn(`[${fobj.file}:${sign};${rett.type};${cost}] conflict from [${func.extend.file}:${sign};${func.return.type};${func.ops}]`);
                }
                
                this.isfunc[sign.match(/^((?:\w+:)?\w+)\(.*$/)[1]] = true;
                this.functions[sign] = {
                    return: rett,
                    ops: cost,
                    extend: fobj,
                };
            }
        }
    }
}

class IncompatibleTypes extends Error {}
class TypeNotFound extends Error {}
