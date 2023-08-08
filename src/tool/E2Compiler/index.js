#!/bin/env node

import { fileURLToPath } from 'url';
import process from 'process';
import path from 'path';
import fs from 'fs';

import E2Data from './src/tree/E2Data.js';
import grammarsBuilder from './src/grammars.js';
import { hideBin } from 'yargs/helpers';
import tree from './src/tree.js';
import yargs from 'yargs';
import { spawn } from 'child_process';
import { readAll } from './src/Helpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const grammarsdir = path.join(__dirname, 'grammars');

let grammars = null;
/** @type {import('./src/grammars.js').Workers} */
let parser = null;
/** @type {import('./src/tree/E2Data.js').default} */
let fat = null;

async function init(argv) {
	if (argv._[0] == 'clua')
		return;
		
	let threads = argv.threads;
	let useJava = argv.usejava;
	
	grammars = grammarsBuilder(grammarsdir, argv.incdir, argv.java);
	
	if (argv._[0] == 'generate')
		return;
	
	if (argv.grammar) {
		try {
			await grammars.build();
			
			process.stdout.write('\n');
			console.log('Generate success');
		} catch(e) {
			process.stdout.write('\n');
			console.error(`Generate error with code: ${e.toString()}`);
		}
	}
	
	parser = await grammars.create({
		countJava: threads,
		liteonly: !useJava
	});
	
	// console.log(argv.fat);
	fat = new E2Data(argv.fat, argv.fatwarn ? { warnConflictOps: false, warnConflictRetType: false } : null);
}

// eslint-disable-next-line no-unused-vars
const yarg = yargs(hideBin(process.argv))
	.strict(true)
	.scriptName("E2Compiler")
	.usage('$0 <cmd> [args]')
	.option('java', {
		requiresArg: true,
		default: process.env['JAVA_HOME_18']
			  || process.env['JAVA_HOME_17']
			  || process.env['JAVA_HOME_16']
			  || process.env['JAVA_HOME'],
	})
	.option('pretty', {
		alias: 'p',
		type: 'boolean',
		describe: 'enable flag pretty (@pretty)',
	})
	.option('opcounter', {
		alias: 'o',
		type: 'boolean',
		describe: 'enable flag opcounter (@opcounter)',
	})
	.option('debug', {
		alias: 'd',
		type: 'boolean',
		describe: 'enable flag debug (@debug)',
	})
	.option('fat', {
		requiresArg: true,
		alias: 'f',
		type: 'string',
		describe: 'path for dir or file fat.dat (function and types e2)',
		default: path.join(__dirname, 'data/*.dat'),
	})
	.option('fatwarn', {
		alias: 'w',
		type: 'boolean',
		describe: 'disable warn in time include fat.dat',
	})
	.option('incdir', {
		requiresArg: true,
		alias: 'I',
		type: 'string',
		describe: 'path to Includes file for e2',
		default: './',
	})
	.option('grammar', {
		alias: 'g',
		type: 'boolean',
		describe: 'rebuild grammars',
	})
	.option('usejava', {
		requiresArg: true,
		alias: 'j',
		type: 'boolean',
		describe: 'use java binaries in lexer and parser, use --no-usejava for disable',
		default: true,
	})
	.option('threads', {
		requiresArg: true,
		alias: 't',
		type: 'number',
		describe: 'count threads (proccess) for use',
		default: 4
	})
	.middleware(init)
	.command('build <in> <out>', 'Compile E2 file', (yargs) => {
		yargs.positional('in', {
			type: 'string',
			describe: 'input file'
		})
		
		yargs.positional('out', {
			type: 'string',
			describe: 'output directory',
		})
	}, async (argv) => {
		const outdir = /** @type {string} */ (argv.out);
		const input = /** @type {string} */ (argv.in);
		
		const [ outs, firstname ] = tree.compile(
			await tree.clear(input == 'stdin' ? process.stdin : input, fat, parser), fat, {
				pretty: argv.pretty ?? false,
				opcounter: argv.opcounter ?? false,
				debug: argv.debug ?? false
			}
		);
		
		if (outdir != 'stdout') {
			if (!fs.existsSync(outdir))
				fs.mkdirSync(outdir, { recursive: true });
			
			for (let [ name, cont ] of Object.entries(outs))
				fs.writeFileSync(path.join(outdir, `${name}.txt`), cont);
		} else {
			process.stdout.write(outs[firstname]);
		}
	})
	.command('clua <in> <out>', 'Compile Lua file', (yargs) => {
		yargs.positional('in', {
			type: 'string',
			describe: 'input file'
		})
		
		yargs.positional('out', {
			type: 'string',
			describe: 'output file',
		})
	}, async (argv) => {
		await new Promise(async (resolve) => {
			const output = /** @type {string} */ (argv.out);
			const input = /** @type {string} */ (argv.in);
				
			let wdir = process.cwd();
			process.chdir(path.join(__dirname, '../clua/'));
				const compiler = spawn(
					'lua',
					[ 'compiler.lua' ]
				);
			process.chdir(wdir);
			
			compiler.stderr.on('data', (buff) => {
				process.stderr.write(buff.toString());
			});
			
			compiler.on('exit', resolve);
			
			await new Promise((resolve, reject) => {
				compiler.on('spawn', resolve);
				compiler.on('error', reject);
			});
			
			compiler.stdin.end(
				await readAll(input == 'stdin' ?  process.stdin : fs.createReadStream(input))
			);
			
			let content = await readAll(compiler.stdout);
			
			if (output != 'stdout') {
				fs.writeFileSync(output, content)
			} else {
				process.stdout.write(content);
			}
		});
	})
	.command('generate', 'Build grammars', () => {}, async () => {
		try {
			await grammars.build();
			
			process.stdout.write('\n');
			console.log('Generate success');
		} catch(e) {
			process.stdout.write('\n');
			console.error(`Generate error with code: ${e.toString()}`);
		}
	})
	.command('tree <in>', '', (yargs) => {
		yargs.positional('in', {
			type: 'string',
			describe: 'input file'
		})
	}, async (argv) => {
		const input = /** @type {string} */ (argv.in);
		
		tree.simpleOutput(
			await tree.clear(input, fat, parser)
		);
	})
	.command('test [subcommand]', 'test command', (yargs) => {
		yargs.positional('subcommand', {
			type: 'string',
		})
		yargs.option('target', {
			type: 'string',
		})
	}, async (argv) => {
		const input = /** @type {string} */ (argv.target);
		
		switch(argv.subcommand) {
			case 'multicalss': await  await import('./tests/MultiClass.js'  );                     			 break;
			case 'e2s':        await (await import('./tests/e2s.js')        ).default(input, parser, fat); break;
			case 'loaddat':    await (await import('./tests/loaddat.js')    ).default(argv.fat); 			 break;
		}
	})
	// .coerce(['java', 'fat', 'fatwarn', 'IncDir', 'UseJava', 'threads', 'grammar', 'build', 'generate', 'tree', 'test'], (arg) => {
	// 	if(typeof(arg) == 'string')
	// 		return arg.toLowerCase();
	// 	else if(Array.isArray(arg)) 
	// 		return arg.map(v => v.toLowerCase());
	// 	return arg;
	// })
	.epilog(`Use lua "file.Write('fat.dat', util.TableToJSON({ wire_expression2_funcs, wire_expression_types }))" for collect data`)
	.epilog('Use keyword ("stdin" for <in>) or ("stdout" for <out>)')
	.fail((msg, err) => {
		if (err) {
			// console.error(err);
		} else {
			process.stdout.write(msg);
			process.stdout.write(`\n\n`);
			yarg.showHelp();
		}
	})
	.help()
	.demandCommand(1)
	.wrap(yargs().terminalWidth());

await yarg.parse();
process.exit(0);