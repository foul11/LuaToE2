#!/bin/env node

import { fileURLToPath } from 'url';
import process from 'process';
import path from 'path';

import MultiClass from './src/MultiClass.js';
import tree from './src/tree.js';
import java from './src/parser.java.js';
import { hideBin } from 'yargs/helpers';
// import { traverseDir } from './src/helpers.js';
import yargs from 'yargs';
import LoadData, { E2Data } from './src/tree/LoadData.js';
import { globIterateSync } from 'glob';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const grammars = path.join(__dirname, 'grammars');

// TODO: преобразуем дерево antlr в свое крутое
// 		 после парсим и обрабатываем разные штуки которые я хотел
//       мб потом добавить проверку валидности и всего такого

/* eslint-disable no-unused-vars */ 
const argv = await yargs(hideBin(process.argv))
	.scriptName("E2Compiler")
	.usage('$0 <cmd> [args]')
	.option('java', {
		requiresArg: true,
		default: process.env['JAVA_HOME_18']
			  || process.env['JAVA_HOME_17']
			  || process.env['JAVA_HOME_16']
			  || process.env['JAVA_HOME'],
	})
	.option('fat', {
		requiresArg: true,
		type: 'string',
		describe: 'path for dir or file fat.dat (function and types e2)',
		default: 'data/*.dat'
	})
	.option('IncDir', {
		requiresArg: true,
		type: 'string',
		describe: 'path to Includes file for e2',
		default: 'e2s'
	})
	.option('UseJava', {
		requiresArg: true,
		type: 'boolean',
		describe: 'use java binaries in lexer and parser',
		default: true
	})
	.command('build <in> <out>', 'Compile file', (yargs) => {
		yargs.positional('in', {
			type: 'string',
			describe: 'input file'
		})
		
		yargs.positional('out', {
			type: 'string',
			describe: 'output file',
		})
	}, async (argv) => {
		const parser = java.parserWrapper(grammars, argv.java, argv.IncDir, !argv.UseJava);
		const json = await java.parser(grammars, argv.java, argv.in, !argv.UseJava);
		const fat = new E2Data(argv.fat, { warnConflictOps: false });
		
		console.log(await tree.compile(await tree.clear(json, fat, parser), fat, { pretty: true, opcounter: true, debug: false }));
		// console.log(json);
	})
	.command('generate', 'Generate java from grammar', (yargs) => {
	}, async (argv) => {
		try {
			await java.grammarGenerate(grammars, argv.java);
			
			process.stdout.write('\n');
			console.log('Generate success');
		} catch(e) {
			process.stdout.write('\n');
			console.error(`Generate error with code: ${e}`);
		}
	})
	// .command('update [in]', 'updating types and function from json', (yargs) => {
	// 	yargs.positional('in', {
	// 		type: 'string',
	// 		default: 'data/e2.dat',
	// 		describe: 'input file',
	// 	})
	// }, async (argv) => {
	// 	let path = /** @type {string} */ (argv.in);
		
	// 	console.log(fs.readFileSync(path));
	// })
	.command('printTree <in>', '', (yargs) => {
		yargs.positional('in', {
			type: 'string',
			describe: 'input file'
		})
	}, async (argv) => {
		const parser = java.parserWrapper(grammars, argv.java, argv.IncDir, !argv.UseJava);
		const json = await java.parser(grammars, argv.java, argv.in, !argv.UseJava);
		
		tree.simpleOutput(await tree.clear(json, new E2Data(argv.fat), parser));
	})
	.command('test [subcommand]', 'test command', (yargs) => {
		yargs.positional('subcommand', {
			type: 'string',
		})
		yargs.option('target', {
			type: 'string',
		})
	}, async (argv) => {
		switch(argv.subcommand) {
			case 'multicalss':
				class A {
					test1(){
						console.log('A', this);
					}
				}
				
				class B {
					test2(){
						console.log('B', this);
					}
				}
				
				class C extends MultiClass(A, B) {
					test1(){
						console.log('C', this);
					}
				}
				
				class D extends MultiClass(C, B) {
					test2(){
						console.log('D', this);
					}
				}
				
				let c = new C();
				let a = new A();
				let b = new B();
				let d = new D();
				
				console.log(C.prototype); // A + B
				console.log(D.prototype); // C + B
				
				console.log(A instanceof B); // false
				console.log(B instanceof A); // false
				console.log(C.prototype, C.prototype instanceof A); // true/false
				console.log(C.prototype, C.prototype instanceof B); // true/false
				console.log(C instanceof A); // false
				console.log(a instanceof A); // true
				console.log(b instanceof A); // false
				console.log();
				console.log(c instanceof C); // true
				console.log(c instanceof A); // true
				console.log(c instanceof B); // true
				
				c.test1(); // C C
				c.test2(); // B C
				d.test2(); // D D
				break;
				
			case 'e2s':
				let fat = new E2Data(argv.fat, { warnConflictOps: false });
				
				for(let file of globIterateSync(/** @type {string} */ (argv.target) ?? './e2s/**/*.txt')) {
					console.log(file);
					
					try {
						const parser = java.parserWrapper(grammars, argv.java, argv.IncDir, !argv.UseJava);
						const json = await java.parser(grammars, argv.java, file, !argv.UseJava);
						
						await tree.clear(json, fat, parser);
					} catch (e) {
						console.error(e);
					}
				}
				break;
				
			case 'loaddat':
				console.log(
					LoadData(argv.fat)
				);
				debugger
				break;
		}
	})
	.epilog(`use lua "file.Write('fat.dat', util.TableToJSON({ wire_expression2_funcs, wire_expression_types }))" for collect data`)
	.epilog('Use keyword ("stdin" for <in>) or ("stdout" for <out>)')
	.fail((msg, err) => {
		throw err;
	})
	.help()
	.argv
/* eslint-enable no-unused-vars */ 

// console.log(argv)

process.exit(0);
