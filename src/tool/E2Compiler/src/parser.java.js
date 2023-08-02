import { CommonTokenStream, InputStream, TerminalNode } from 'antlr4';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export default {
    parserWrapper (grammarsPath, java, workDir, useLite = false) {
        return (input, raw = false) => {
            if (raw) {
                return this.parserLite(grammarsPath, input);
            } else {
                if (useLite) {
                    return this.parserLiteFile(grammarsPath, path.join(workDir, input));
                } else {
                    return this.parser(grammarsPath, java, path.join(workDir, input));
                }
            }
        };
    },
    
    parser (grammarsPath, java, filePath, useLite = false) {
        if (useLite) {
            return this.parserLiteFile(grammarsPath, filePath);
        }
        
        const chunks = [];
        const parser = spawn(
            path.join(java, 'bin/java'),
            [
                '-cp',
                `${path.join(grammarsPath, 'dist')};`
                + `${path.join(grammarsPath, 'bin/antlr-4.13.0-complete.jar')};`
                + `${path.join(grammarsPath, 'bin/gson-2.10.1.jar')}`,
                'grammar_parser',
            ]
        );
        
        parser.stdout.on('data', (buff) => {
            chunks.push(buff)
        });
        
        parser.stderr.on('data', (stream) => {
            process.stderr.write(stream.toString());
        });
        
        return new Promise((resolve, reject) => {
            fs.createReadStream(filePath)
                .on('error', (e) => { reject(e); })
                .pipe(parser.stdin);
            
            parser.on('exit', (code) => {
                if(code != 0)
                    reject(new Error(`java exit code: ${code}`));
                
                resolve(
                    JSON.parse(
                        Buffer.concat(chunks).toString()
                    )
                );
            });
        });
    },
    
    parserLiteFile (grammarsPath, file) {
        return new Promise((resolve, reject) => {
            fs.readFile(file, async (err, data) => {
                if (err) reject(err);
                
                resolve(await this.parserLite(grammarsPath, data.toString()));
            });
        });
    },
    
    parserLite: (grammarsPath, code) => {
        return new Promise(async (resolve) => {
            let input = new InputStream(code);
            let lexer = new (await import(
                (path.join('file://', grammarsPath, 'dist', 'E2Lexer.js'))
            )).default(input);
            
            let tokens = new CommonTokenStream(lexer);
            let parser = new (await import(
                (path.join('file://', grammarsPath, 'dist', 'E2Parser.js'))
            )).default(tokens);
            
            let map = {};
            let traverse = (tree, map) => {
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
                        traverse(tree.getChild(i), nested);
                    }
                }
            };
            
            traverse(parser.root(), map);
            resolve(map);
        });
    },
    
    grammarGenerate: async (grammarsPath, java) => {
        await new Promise((resolve, reject) => {
            const grammarJava = spawn(
                path.join(java, '/bin/java'),
                [
                    '-jar', path.join(grammarsPath, 'bin/antlr-4.13.0-complete.jar'),
                    '-Dlanguage=Java',
                    '-lib', path.join(grammarsPath, './'),
                    '-o',   path.join(grammarsPath, 'dist'),
                    '-visitor', '-Xexact-output-dir',
                    path.join(grammarsPath, 'E2.g4'),
                ]
            );
            
            grammarJava.stdout.on('data', (buff) => {
                process.stdout.write(buff.toString());
            });
            
            grammarJava.stderr.on('data', (buff) => {
                process.stderr.write(buff.toString());
            });
            
            grammarJava.on('exit', async (code) => {
                if(code != 0) reject(code);
                resolve();
            });
        });
        
        await new Promise((resolve, reject) => {
            const grammarJS = spawn(
                path.join(java, '/bin/java'),
                [
                    '-jar', path.join(grammarsPath, 'bin/antlr-4.13.0-complete.jar'),
                    '-Dlanguage=JavaScript',
                    '-lib', path.join(grammarsPath, './'),
                    '-o',   path.join(grammarsPath, 'dist'),
                    '-visitor', '-Xexact-output-dir',
                    path.join(grammarsPath, 'E2.g4'),
                ]
            );
            
            grammarJS.stdout.on('data', (buff) => {
                process.stdout.write(buff.toString());
            });
            
            grammarJS.stderr.on('data', (buff) => {
                process.stderr.write(buff.toString());
            });
            
            grammarJS.on('exit', (code) => {
                if(code != 0) reject(code);
                resolve();
            });
        });
        
        await new Promise((resolve, reject) => {
            const javac = spawn(
                path.join(java, '/bin/javac'),
                [
                    '-cp',
                    `${path.join(grammarsPath, 'dist')};`
                    + `${path.join(grammarsPath, 'bin/antlr-4.13.0-complete.jar')};`
                    + `${path.join(grammarsPath, 'bin/gson-2.10.1.jar')}`,
                    `${path.join(grammarsPath, 'grammar_parser.java')}`,
                    '-d', `${path.join(grammarsPath, 'dist')}`,
                ]
            );
            
            javac.stdout.on('data', (buff) => {
                process.stdout.write(buff.toString());
            });
            
            javac.stderr.on('data', (buff) => {
                process.stderr.write(buff.toString());
            });
            
            javac.on('exit', (code) => {
                if(code != 0) reject(code);
                resolve();
            });
        });
    },
}