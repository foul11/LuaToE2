import { CommonTokenStream, InputStream, TerminalNode } from 'antlr4';
import { asyncReadable } from 'async-readable'
import { spawn } from 'child_process';
import EventEmitter from 'events';
import path from 'path';
import fs from 'fs';

const top = 0;
const parent = i => ((i + 1) >>> 1) - 1;
const left = i => (i << 1) + 1;
const right = i => (i + 1) << 1;

class PriorityQueue {
    constructor(comparator = (a, b) => a > b) {
        this._heap = [];
        this._comparator = comparator;
    }
    size() {
        return this._heap.length;
    }
    isEmpty() {
        return this.size() == 0;
    }
    peek() {
        return this._heap[top];
    }
    push(...values) {
        values.forEach(value => {
            this._heap.push(value);
            this._siftUp();
        });
        return this.size();
    }
    pop() {
        const poppedValue = this.peek();
        const bottom = this.size() - 1;
        if (bottom > top) {
            this._swap(top, bottom);
        }
        this._heap.pop();
        this._siftDown();
        return poppedValue;
    }
    replace(value) {
        const replacedValue = this.peek();
        this._heap[top] = value;
        this._siftDown();
        return replacedValue;
    }
    _greater(i, j) {
        return this._comparator(this._heap[i], this._heap[j]);
    }
    _swap(i, j) {
        [this._heap[i], this._heap[j]] = [this._heap[j], this._heap[i]];
    }
    _siftUp() {
        let node = this.size() - 1;
        while (node > top && this._greater(node, parent(node))) {
            this._swap(node, parent(node));
            node = parent(node);
        }
    }
    _siftDown() {
        let node = top;
        while (
            (left(node) < this.size() && this._greater(left(node), node)) ||
            (right(node) < this.size() && this._greater(right(node), node))
        ) {
            let maxChild = (right(node) < this.size() && this._greater(right(node), left(node))) ? right(node) : left(node);
            this._swap(node, maxChild);
            node = maxChild;
        }
    }
}

export class WorkerNotFound extends Error {}
export class NeedBuild extends Error {}

class Worker extends EventEmitter {
    /**
     * @typedef {{
     *  grammarsdir: string,
     *  workdir: string,
     *  priority: number,
     * }} WorkerOptions
     */
    
    /** @param {WorkerOptions} options */
    constructor(options) {
        super();
        
        this.grammarsdir = options.grammarsdir;
        this.workdir = options.workdir;
        this.priority = options.priority; // 0 - disables selection if there are alternatives
        this.inited = false;
    }
    
    async init() {
        this.inited = true;
        return this;
    }
    
    /**
     * @param {string} filePath
     * @return {Promise<any>}
     */
    async parseFile(filePath) {
        let file = path.join(this.workdir, filePath);
        let data = await fs.promises.readFile(file);
        
        return await this.parseCode(data.toString());
    }
    
    /**
     * @param {string} filePath
     * @return {any}
     */
    parseLiteFile(filePath) {
        let file = path.join(this.workdir, filePath);
        let data = fs.readFileSync(file);
        
        return this.parseLiteCode(data.toString());
    }
    
    /**
     * @param {string} code
     * @return {Promise<any>}
     */
    // eslint-disable-next-line no-unused-vars
    async parseCode(code) {
        throw new Error('Should not be called');
    }
    
    /**
     * @param {string} code
     * @return {any}
     */
    // eslint-disable-next-line no-unused-vars
    parseLiteCode(code) {
        throw new Error('Should not be called');
    }
}

// class WorkerJSExternal { // TODO: maybe someday

// }

class WorkerJSInternal extends Worker {
    /**
     * @typedef {WorkerOptions} WorkerJSInternalOptions
     */
    
    /** @param {WorkerJSInternalOptions} options */
    constructor(options) {
        super(options);
        
        this.lexer = null;
        this.parser = null;
    }
    
    _traverse(tree, map) {
        if (tree instanceof TerminalNode) {
            let token = tree.getSymbol();

            map['type'] = token.type;
            map['text'] = token.text;
            map['line'] = token.line;
        } else {
            let list = [];
            let name = tree.constructor.name.match(/(.+)Context/)[1];
            map[`${name[0].toLowerCase()}${name.slice(1)}`] = list;

            for (let i = 0; i < tree.getChildCount(); i++) {
                let nested = {};
                list.push(nested);
                this._traverse(tree.getChild(i), nested);
            }
        }
    }
    
    async init() {
        if (this.inited) return;
        
        try {
            this.lexer = (await import(
                (path.join('file://', this.grammarsdir, 'dist', 'E2Lexer.js'))
            )).default;
            
            this.parser = (await import(
                (path.join('file://', this.grammarsdir, 'dist', 'E2Parser.js'))
            )).default;
        } catch (e) {
            throw new NeedBuild(e);
        }
        
        this.inited = true;
        
        return this;
    }
    
    async parseCode(code) {
        return this.parseLiteCode(code);
    }
    
    parseLiteCode(code) {
        if (!this.inited)
            throw new NeedBuild('WorkerJSInternal has not been init');
        
        let input = new InputStream(code);
        let lexer = new this.lexer(input);
        let tokens = new CommonTokenStream(lexer);
        let parser = new this.parser(tokens);
        
        let map = {};
        this._traverse(parser.root(), map);
        
        return map;
    }
}

class WorkerJava extends Worker {
    /**
     * @typedef {WorkerOptions & {
     *  javadir: string,
     * }} WorkerJavaOptions
     */
    
    /** @param {WorkerJavaOptions} options */
    constructor(options) {
        super(options);
        
        this.javadir = options.javadir;
        this.asyncReader = null;
        this.parser = null;
        this.needed = 0;
    }
    
    async init() {
        if (this.inited) return;
        
        try {
            this.parser = spawn(
                path.join(this.javadir, 'bin/java'),
                [
                    '-cp',
                    `${path.join(this.grammarsdir, 'dist')};`
                    + `${path.join(this.grammarsdir, 'bin/antlr-4.13.0-complete.jar')};`
                    + `${path.join(this.grammarsdir, 'bin/gson-2.10.1.jar')}`,
                    'grammar_parser',
                ]
            );
            
            this.parser.stderr.on('data', (stream) => {
                process.stderr.write(stream.toString());
            });
            
            this.parser.on('error', (e) => {
                throw e;
            });
            
            this.parser.on('exit', (e) => {
                throw e;
            });
            
            await new Promise((resolve, reject) => {
                this.parser.once('spawn', resolve);
                this.parser.once('error', reject);
            });
            
            this.asyncReader = asyncReadable(this.parser.stdout);
        } catch (e) {
            throw new NeedBuild(e);
        }
        
        this.inited = true;
        
        return this;
    }
    
    _toBytesInt32(num) {
        let arr = new ArrayBuffer(4);
        let view = new DataView(arr);
        view.setUint32(0, num, false);
        return Buffer.from(arr);
    }
    
    /** @param {Buffer} bytes */
    _fromBytesInt32(bytes) {
        return bytes.readUInt32BE();
    }
    
    async parseCode(code) {
        if (!this.inited)
            await this.init();
        
        let buff = Buffer.from(code);
        
        this.parser.stdin.write(this._toBytesInt32(buff.length));
        this.parser.stdin.write(buff);
        
        let size = await this.asyncReader.read(4);
        let out = await this.asyncReader.read(this._fromBytesInt32(size));
        
        this.emit('release', this);
        
        return JSON.parse(out.toString());
    }
}

export class Workers extends EventEmitter {
    /** @param {Worker[]} workers  */
    constructor(workers) {
        super();
        
        this.setMaxListeners(0); // for more queue
        
        this.autoSelectZeroPriority = true;
        this.workers = workers;
        this.workersq = new PriorityQueue((a, b) => a.priority > b.priority);
        
        for (const worker of workers) {
            if (worker.priority) {
                this.autoSelectZeroPriority = false;
                this.workersq.push(worker);
            }
        }
    }
    
    async _waitWorkerRelease() {
        return new Promise((resolve) => {
            this.once('workerRelease', () => {
                resolve();
            });
        });
    }
    
    _selectZeroPriorityWorker() {
        let worker = this.workers.find((worker) => worker.priority == 0);
        
        if (!worker)
            throw new WorkerNotFound();
        
        return worker;
    }
    
    async _selectWorker() {
        while (true) {
            let worker = this.workersq.pop();
            if (worker){
                worker.once('release', (worker) => {
                    this.workersq.push(worker);
                    this.emit('workerRelease');
                });
                
                return worker;
            }
            
            if (this.autoSelectZeroPriority) {
                return this._selectZeroPriorityWorker();
            }
            
            await this._waitWorkerRelease();
        }
    }
    
    
    /** @param {string} filePath */
    parseLiteFile(filePath) {
        let worker = this._selectZeroPriorityWorker();
        return worker.parseLiteFile(filePath);
    }
    
    /** @param {string} code */
    parseLiteCode(code) {
        let worker = this._selectZeroPriorityWorker();
        return worker.parseLiteCode(code);
    }
    
    /** @param {string} filePath */
    async parseFile(filePath) {
        let worker = await this._selectWorker();
        return worker.parseFile(filePath);
    }
    
    /** @param {string} code */
    async parseCode(code) {
        let worker = await this._selectWorker();
        return worker.parseCode(code);
    }
}

export default function (grammarsdir, workdir, java) {
    /**
     * @typedef {{
     *  countJava?: number,
     *  priorityJava?: number,
     *  liteonly?: boolean,
     * }} createOptions
     */
    
    /** @param {createOptions} options */
    async function create(options) {
        options = Object.assign({
            countJava: 4,
            priorityJava: 50,
            liteonly: false,
        }, options);
        
        /** @type {WorkerOptions} */
        let defConfig = { grammarsdir, workdir, priority: 0 };
        /** @type {Worker[]} */
        let workers = [
            await (new WorkerJSInternal(defConfig)).init(),
        ];
        
        if (options.liteonly) {
            return new Workers(workers);
        }
        
        for (let i = 0; i < options.countJava; i++) {
            workers.push(new WorkerJava({ ...defConfig, javadir: java, priority: options.priorityJava }));
        }
        
        return new Workers(workers);
    }
    
    async function build() {
        await new Promise((resolve, reject) => {
            const grammarJava = spawn(
                path.join(java, '/bin/java'),
                [
                    '-jar', path.join(grammarsdir, 'bin/antlr-4.13.0-complete.jar'),
                    '-Dlanguage=Java',
                    '-lib', path.join(grammarsdir, './'),
                    '-o', path.join(grammarsdir, 'dist'),
                    '-visitor', '-Xexact-output-dir',
                    '-package', 'dist',
                    path.join(grammarsdir, 'E2.g4'),
                ]
            );

            grammarJava.stdout.on('data', (buff) => {
                process.stdout.write(buff.toString());
            });

            grammarJava.stderr.on('data', (buff) => {
                process.stderr.write(buff.toString());
            });

            grammarJava.on('exit', async (code) => {
                if (code != 0) reject(code);
                resolve();
            });
        });

        await new Promise((resolve, reject) => {
            const grammarJS = spawn(
                path.join(java, '/bin/java'),
                [
                    '-jar', path.join(grammarsdir, 'bin/antlr-4.13.0-complete.jar'),
                    '-Dlanguage=JavaScript',
                    '-lib', path.join(grammarsdir, './'),
                    '-o', path.join(grammarsdir, 'dist'),
                    '-visitor', '-Xexact-output-dir',
                    path.join(grammarsdir, 'E2.g4'),
                ]
            );

            grammarJS.stdout.on('data', (buff) => {
                process.stdout.write(buff.toString());
            });

            grammarJS.stderr.on('data', (buff) => {
                process.stderr.write(buff.toString());
            });

            grammarJS.on('exit', (code) => {
                if (code != 0) reject(code);
                resolve();
            });
        });

        await new Promise((resolve, reject) => {
            const javac = spawn(
                path.join(java, '/bin/javac'),
                [
                    '-cp',
                    `${path.join(grammarsdir, 'dist')};`
                    + `${path.join(grammarsdir, 'bin/antlr-4.13.0-complete.jar')};`
                    + `${path.join(grammarsdir, 'bin/gson-2.10.1.jar')}`,
                    '-d', path.join(grammarsdir, 'dist'),
                    path.join(grammarsdir, 'grammar_parser.java'),
                    path.join(grammarsdir, 'dist/*.java'),
                ]
            );

            javac.stdout.on('data', (buff) => {
                process.stdout.write(buff.toString());
            });

            javac.stderr.on('data', (buff) => {
                process.stderr.write(buff.toString());
            });

            javac.on('exit', (code) => {
                if (code != 0) reject(code);
                resolve();
            });
        });
    };
    
    return {
        create,
        build,
    }
}